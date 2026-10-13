// Sales reports (Book I B §6, p.56; Book VI §4.1): pure functions over the sales DB. Dimensions and thresholds the
// PRD names are used as written; anything else is a design value (readings SR-28, SR-33 and SR-34 in the README).
import { addDays, daysBetween, orderValue, product, TODAY, type DB, type SalesOrder } from "../data/model"
import { LEAD_STAGES } from "../data/ext-model"
import { MARGIN_FLOOR_PCT, MARGIN_TARGET_PCT, etoTotals } from "./model"
import { CAD_RATE } from "./derive"

export const REPORTS = [
  { id: "open-order-book", title: "Open order book", blurb: "All open SO lines: value, promised date, status, pegged supply status, late flags; grouped by customer, product line or month.", source: "DOC:p.56 §6" },
  { id: "bbb", title: "Bookings, billings and backlog", blurb: "Monthly BBB with product line and entity dimensions: the management headline report.", source: "DOC:p.56 §6" },
  { id: "otd", title: "On-time delivery", blurb: "Promised against actual PGI; OTD % by month, customer and product line.", source: "DOC:p.56 §6" },
  { id: "margin", title: "Margin by order", blurb: "Three-margin view: quoted, standard at PGI, actual at work order settlement.", source: "DOC:p.56 §6" },
  { id: "funnel", title: "Quote funnel", blurb: "Quotes by status and age, win rate by segment, loss reasons Pareto.", source: "DOC:p.56 §6" },
  { id: "late", title: "Late and at-risk lines", blurb: "Promised date within 7 days without Ready to Ship, or pegged work order behind schedule.", source: "DOC:p.56 §6" },
  { id: "lead-pipeline", title: "Lead pipeline", blurb: "Open pipeline by stage with weighted value and age; funnel from lead to won.", source: "DOC:p.249 §4.1" },
] as const
export type ReportId = (typeof REPORTS)[number]["id"]

const usd = (v: number, cur: "USD" | "CAD") => (cur === "CAD" ? v / CAD_RATE : v)
export const productLine = (item: string) => product(item).kind
export const month = (iso: string) => iso.slice(0, 7)
const OPEN_STATUS = ["Confirmed", "In Fulfillment", "Partially Shipped", "Credit Hold", "Submitted"]
export const entityOf = (o: SalesOrder) => (o.currency === "CAD" ? "Canadian entity (CAD)" : "US entity (USD)")

// ---------------------------------------------------------------------------- open order book
export interface BookRow { so: string; line: number; customer: string; item: string; productLine: string; openQty: number; value: number; promised: string; month: string; status: string; supply: string; late: boolean; currency: "USD" | "CAD" }
export function openOrderBook(db: DB): BookRow[] {
  const rows: BookRow[] = []
  for (const o of db.orders) {
    if (!OPEN_STATUS.includes(o.status)) continue
    const cname = db.customers.find((c) => c.id === o.customerId)?.name ?? o.customerId
    for (const l of o.lines) {
      if (["Shipped", "Invoiced", "Closed", "Cancelled"].includes(l.status)) continue
      const open = l.schedules.reduce((s, x) => s + Math.max(0, (x.confQty ?? x.reqQty) - x.deliveredQty - x.cancelledQty), 0)
      if (!open) continue
      const promised = l.promisedShip ?? l.requestedShip
      const pegs = l.schedules.map((s) => s.peg).filter(Boolean) as string[]
      rows.push({ so: o.id, line: l.no, customer: cname, item: l.item, productLine: productLine(l.item), openQty: open, value: usd(open * l.unitPrice, o.currency), promised, month: month(promised), status: l.status, supply: pegs.length ? (pegs.some((p) => p.startsWith("WO-")) ? `Production order ${pegs.find((p) => p.startsWith("WO-"))}` : "Pegged to stock") : l.schedules.some((s) => s.backorder) ? "Backorder: no supply" : "Not yet pegged", late: promised < TODAY, currency: o.currency })
    }
  }
  return rows
}

// ---------------------------------------------------------------------------- BBB
export interface BbbRow { month: string; dim: string; bookings: number; billings: number; backlog: number }
export function bbb(db: DB, dim: "Product line" | "Entity"): BbbRow[] {
  const key = (o: SalesOrder) => (dim === "Entity" ? entityOf(o) : o.type)
  const months = new Set<string>()
  const book = new Map<string, number>()
  const bill = new Map<string, number>()
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)
  for (const o of db.orders) {
    if (["Draft", "Rejected"].includes(o.status)) continue
    const bm = month(o.created)
    months.add(bm)
    add(book, `${bm}|${key(o)}`, usd(orderValue(o), o.currency))
    if (o.invoicePosted && o.closedOn) { months.add(month(o.closedOn)); add(bill, `${month(o.closedOn)}|${key(o)}`, usd(orderValue(o), o.currency)) }
  }
  const dims = [...new Set(db.orders.filter((o) => !["Draft", "Rejected"].includes(o.status)).map(key))].sort()
  const ms = [...months].sort()
  const out: BbbRow[] = []
  const run = new Map<string, number>()
  for (const m of ms)
    for (const d of dims) {
      const b = book.get(`${m}|${d}`) ?? 0
      const i = bill.get(`${m}|${d}`) ?? 0
      const backlog = (run.get(d) ?? 0) + b - i
      run.set(d, backlog)
      if (b || i || backlog) out.push({ month: m, dim: d, bookings: b, billings: i, backlog })
    }
  return out
}

// ---------------------------------------------------------------------------- OTD
export interface OtdRow { delivery: string; so: string; customer: string; productLine: string; promised: string; actual: string; daysLate: number; onTime: boolean; month: string }
export function otd(db: DB): OtdRow[] {
  const rows: OtdRow[] = []
  for (const d of db.deliveries) {
    if (!d.shipDate) continue
    const o = db.orders.find((x) => x.id === d.soId)
    if (!o) continue
    const ref = d.refs[0]
    const l = o.lines.find((x) => x.no === ref?.line)
    const promised = l?.promisedShip ?? l?.requestedShip ?? o.requestedShip
    const late = daysBetween(promised, d.shipDate)
    rows.push({ delivery: d.id, so: o.id, customer: db.customers.find((c) => c.id === d.customerId)?.name ?? d.customerId, productLine: l ? productLine(l.item) : o.type, promised, actual: d.shipDate, daysLate: Math.max(0, late), onTime: late <= 0, month: month(d.shipDate) })
  }
  return rows
}

// ---------------------------------------------------------------------------- margin by order (quoted, standard, actual)
export interface MarginRow { so: string; customer: string; type: string; value: number; quotedCost: number | null; quotedPct: number | null; stdCost: number | null; stdPct: number | null; actualCost: number | null; actualPct: number | null; note: string }
export function marginByOrder(db: DB): MarginRow[] {
  const rows: MarginRow[] = []
  for (const o of db.orders) {
    if (["Draft", "Rejected", "Cancelled"].includes(o.status)) continue
    const value = usd(orderValue(o), o.currency)
    const cname = db.customers.find((c) => c.id === o.customerId)?.name ?? o.customerId
    const q = o.quoteRef ? db.quotations.find((x) => x.id === o.quoteRef) : undefined
    const qe = q ? db.fx.quoteExt[q.id] : undefined
    const eto = db.fx.etoCost[o.id]
    const quotedCost = eto ? etoTotals(eto, value).estimate : qe ? o.lines.reduce((s, l) => s + (qe.costPerUnit[l.no] ?? 0) * l.qty, 0) : null
    const shippedValue = o.lines.reduce((s, l) => s + l.schedules.reduce((a, x) => a + x.deliveredQty, 0) * l.unitPrice, 0)
    const stdShipped = o.lines.reduce((s, l) => s + l.schedules.reduce((a, x) => a + x.deliveredQty, 0) * (product(l.item).stdCost ?? 0), 0)
    const hasStd = shippedValue > 0 && stdShipped > 0
    const actualCost = eto ? etoTotals(eto, value).actual + etoTotals(eto, value).remaining + etoTotals(eto, value).committed : null
    const pct = (rev: number, cost: number | null) => (cost == null || !rev ? null : ((rev - cost) / rev) * 100)
    rows.push({
      so: o.id, customer: cname, type: o.type, value,
      quotedCost: quotedCost != null ? usd(quotedCost, "USD") : null, quotedPct: pct(value, quotedCost),
      stdCost: hasStd ? usd(stdShipped, o.currency) : null, stdPct: hasStd ? pct(usd(shippedValue, o.currency), usd(stdShipped, o.currency)) : null,
      actualCost, actualPct: pct(value, actualCost),
      note: eto ? "Actual column is the estimate at completion until the work orders settle (EAC)" : hasStd ? "Standard at PGI on shipped lines" : "Nothing shipped yet: standard margin is taken at PGI",
    })
  }
  return rows
}
export const marginVerdict = (p: number | null) => (p == null ? "n/a" : p < MARGIN_FLOOR_PCT ? "Below floor" : p < MARGIN_TARGET_PCT ? "Below target" : "On target")

// ---------------------------------------------------------------------------- quote funnel
export interface FunnelQuote { id: string; customer: string; segment: string; status: string; ageDays: number; value: number; loss?: string }
export function funnel(db: DB): FunnelQuote[] {
  return db.quotations.map((q) => {
    const c = db.customers.find((x) => x.id === q.customerId)
    const first = q.activity[0]?.at ?? TODAY
    const ext = db.fx.quoteExt[q.id]
    return { id: q.id, customer: c?.name ?? q.customerId, segment: db.custExt[q.customerId]?.segment && db.custExt[q.customerId].segment !== "Not recorded" ? db.custExt[q.customerId].segment : c?.cls ?? "Not recorded", status: q.status, ageDays: daysBetween(first, TODAY), value: usd(q.lines.reduce((s, l) => s + l.qty * l.price, 0), c?.currency ?? "USD"), loss: ext?.winLoss?.outcome === "Lost" ? ext.winLoss.reason : q.lossReason?.split(":")[0] }
  })
}

// ---------------------------------------------------------------------------- late and at-risk lines
export interface LateRow { so: string; line: number; customer: string; item: string; promised: string; daysToPromise: number; status: string; reason: string; kind: "Late" | "At risk" }
export function lateAtRisk(db: DB): LateRow[] {
  const rows: LateRow[] = []
  for (const o of db.orders) {
    if (!OPEN_STATUS.includes(o.status)) continue
    const cname = db.customers.find((c) => c.id === o.customerId)?.name ?? o.customerId
    for (const l of o.lines) {
      if (["Ready to Ship", "Shipped", "Invoiced", "Closed", "Cancelled"].includes(l.status)) continue
      const promised = l.promisedShip ?? l.requestedShip
      const days = daysBetween(TODAY, promised)
      const wo = l.schedules.find((s) => s.peg?.startsWith("WO-") && s.confDate && s.reqDate && s.confDate > s.reqDate)
      if (days < 0) rows.push({ so: o.id, line: l.no, customer: cname, item: l.item, promised, daysToPromise: days, status: l.status, reason: `${-days} day(s) past the promised date and not Ready to Ship`, kind: "Late" })
      else if (days <= 7) rows.push({ so: o.id, line: l.no, customer: cname, item: l.item, promised, daysToPromise: days, status: l.status, reason: `Promised within ${days} day(s) without Ready to Ship`, kind: "At risk" })
      else if (wo) rows.push({ so: o.id, line: l.no, customer: cname, item: l.item, promised, daysToPromise: days, status: l.status, reason: `Pegged ${wo.peg} is behind schedule (confirmed ${wo.confDate} against requested ${wo.reqDate})`, kind: "At risk" })
    }
  }
  return rows.sort((a, b) => a.daysToPromise - b.daysToPromise)
}

// ---------------------------------------------------------------------------- lead pipeline
export interface StageRow { stage: string; count: number; value: number; weighted: number; avgAge: number }
export function leadPipeline(db: DB): StageRow[] {
  return LEAD_STAGES.map((stage) => {
    const ls = db.leads.filter((l) => l.stage === stage)
    const val = (l: (typeof ls)[number]) => usd(l.estValue, l.currency)
    return { stage, count: ls.length, value: ls.reduce((s, l) => s + val(l), 0), weighted: ls.reduce((s, l) => s + (val(l) * l.winProb) / 100, 0), avgAge: ls.length ? Math.round(ls.reduce((s, l) => s + daysBetween(l.stageSince, TODAY), 0) / ls.length) : 0 }
  })
}
export const nextWeek = () => addDays(TODAY, 7)
