// Calculations for the feature-list screens of purchasing-finance. Pure functions over the slice state and
// the shared masters; each rule cites its source. Design values are named where they are used.

import type { ISODate, MaterialId } from "@/data/domain"
import { PROFIT_CENTERS, TODAY, WORK_CENTERS } from "@/data/shared"
import { daysBetween } from "@/lib/format"
import { store } from "@/store"
import type { PurchasingFinanceState } from "./slice"
import { allAvl, businessDaysBetween, material, stdOf, vendorOf } from "./logic"
import { qualityRating } from "./compliance"
import type { ContractRec, DriverRate, InfoRec, RfqScoring, ScoringWeights } from "./xtypes"
import type { PoLineX, PoRec } from "./types"

// ------------------------------------------------------------------ purchase price determination (Book II §7.3)
export const scalePrice = (scales: { fromQty: number; price: number }[], qty: number): number | undefined => {
  const hit = [...scales].sort((a, b) => b.fromQty - a.fromQty).find((s) => qty >= s.fromQty)
  return hit?.price
}
export function activeContract(s: PurchasingFinanceState, vendorId: string, itemId: string, on: ISODate): ContractRec | undefined {
  return s.contracts.find((c) => c.vendorId === vendorId && c.state === "Active" && c.validFrom <= on && c.validTo >= on && c.items.some((i) => i.itemId === itemId))
}
export function activeInfoRecord(s: PurchasingFinanceState, vendorId: string, itemId: string, on: ISODate): InfoRec | undefined {
  return s.infoRecords.find((r) => r.vendorId === vendorId && r.itemId === itemId && r.status === "Active" && r.validFrom <= on && (!r.validTo || r.validTo >= on))
}
export type PriceSourceKind = "Manual" | "Contract" | "Info Record" | "Last PO" | "No basis"
export interface PriceSourceInfo {
  kind: PriceSourceKind
  ref?: string
  basisPrice?: number
  basisDate?: ISODate
  /** Last PO price older than 12 months [DOC:p.157 §7.3]. */
  stale?: boolean
  text: string
}
/** Order of the Purchase Pricing Service: manual, contract / scheduling agreement, info record, last PO, none. The line
 *  is stamped with the first source whose price equals the line price; a price that matches none is Manual. */
export function lineSource(s: PurchasingFinanceState, p: Pick<PoRec, "id" | "vendorId" | "createdOn">, l: Pick<PoLineX, "itemId" | "qty" | "price">): PriceSourceInfo {
  if (!l.price) return { kind: "No basis", text: "No basis: the line enters at zero and must be priced manually" }
  const eq = (a?: number) => a != null && Math.abs(a - l.price) < 0.005
  const ctr = activeContract(s, p.vendorId, l.itemId, p.createdOn)
  const cp = ctr ? scalePrice(ctr.items.find((i) => i.itemId === l.itemId)!.scales, l.qty) : undefined
  if (ctr && eq(cp)) return { kind: "Contract", ref: ctr.id, basisPrice: cp, basisDate: ctr.validFrom, text: `${ctr.kind} ${ctr.id}` }
  const ir = activeInfoRecord(s, p.vendorId, l.itemId, p.createdOn)
  const ip = ir ? (scalePrice(ir.scales, l.qty) ?? ir.price) : undefined
  if (ir && eq(ip)) return { kind: "Info Record", ref: ir.id, basisPrice: ip, basisDate: ir.validFrom, text: `Info record ${ir.id}` }
  const last = lastPoPrice(s, p.vendorId, l.itemId, p.id, p.createdOn)
  if (last && eq(last.price)) {
    const stale = daysBetween(last.on, p.createdOn) > 365
    return { kind: "Last PO", ref: last.poId, basisPrice: last.price, basisDate: last.on, stale, text: `Last PO ${last.poId} of ${last.on}${stale ? ": basis stale (older than 12 months)" : ""}` }
  }
  const basis = ir ? { price: ip!, ref: ir.id, on: ir.validFrom } : ctr && cp ? { price: cp, ref: ctr.id, on: ctr.validFrom } : last ? { price: last.price, ref: last.poId, on: last.on } : undefined
  return { kind: "Manual", basisPrice: basis?.price, ref: basis?.ref, basisDate: basis?.on, text: basis ? `Manual price against ${basis.ref} at ${basis.price}` : "Manual price: no basis on file" }
}
export function lastPoPrice(s: PurchasingFinanceState, vendorId: string, itemId: string, excludePo: string, before: ISODate) {
  return s.purchaseOrders
    .filter((q) => q.id !== excludePo && q.vendorId === vendorId && q.status !== "Cancelled" && q.status !== "Draft" && q.createdOn <= before)
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn))
    .flatMap((q) => q.lines.filter((l) => l.itemId === itemId && l.price > 0).map((l) => ({ price: l.price, poId: q.id, on: q.createdOn })))[0]
}
/** E-MM-32: a PO cannot be Sent with zero-price valuated lines [DOC:p.157 §7.3]. Services and non-stock items are not valuated. */
export function zeroPriceBlocker(p: Pick<PoRec, "lines">): string | null {
  for (const l of p.lines) {
    if (l.status === "Cancelled" || l.price > 0) continue
    const t = material(l.itemId)?.type
    if (t === "NSTK" || t === "SERV") continue
    return `E-MM-32: line ${l.no} (${l.itemId}) has no price basis and enters at zero. Price the line manually: a PO cannot be sent with a zero-price valuated line.`
  }
  return null
}
/** E-MM-35: a blocked source-list row is a hard block at PO entry for the period [DOC:p.158 §7.4]. The period is checked on the PO date. */
export function sourceListBlocker(s: PurchasingFinanceState, p: Pick<PoRec, "vendorId" | "createdOn" | "lines">): string | null {
  for (const l of p.lines) {
    if (l.status === "Cancelled") continue
    const row = s.sourceList.find((r) => r.blocked && r.vendorId === p.vendorId && r.itemId === l.itemId && r.validFrom <= p.createdOn && r.validTo >= p.createdOn)
    if (row) return `E-MM-35: ${row.vendorId} may not supply ${l.itemId} from ${row.validFrom} to ${row.validTo} (source list ${row.id}: ${row.note}). This is a hard block at PO entry, regardless of the AVL.`
  }
  return null
}

// ------------------------------------------------------------------ delivery schedule (Book I G §5.2): each sub-row receivable independently
export interface ScheduleStatus {
  no: number
  qty: number
  date: ISODate
  received: number
  open: number
  state: "Received" | "Partly received" | "Open" | "Late"
}
/** Receipts fill the earliest sub-rows first; each sub-row then shows its own state. */
export function scheduleStatus(l: Pick<PoLineX, "schedules" | "received" | "status">, today: ISODate = TODAY): ScheduleStatus[] {
  let left = l.received
  return [...l.schedules].sort((a, b) => a.date.localeCompare(b.date)).map((x) => {
    const got = Math.min(x.qty, left)
    left -= got
    const open = x.qty - got
    const state: ScheduleStatus["state"] = open === 0 ? "Received" : got > 0 ? "Partly received" : x.date < today && l.status !== "Cancelled" ? "Late" : "Open"
    return { no: x.no, qty: x.qty, date: x.date, received: got, open, state }
  })
}
export const CLAUSES: Record<string, { name: string; detail: string }> = {
  Q1: { name: "Mill certificates per heat", detail: "Each shipment carries the mill certificate for every heat; the receiving clerk matches heat numbers to the certificate before release from QI Hold." },
  Q2: { name: "First-article inspection required", detail: "The first delivery is inspected against the drawing and the STP; the FAI report is approved by Quality before the AVL row moves to Qualified." },
  Q3: { name: "100% inspection", detail: "Every unit of every shipment is inspected at receipt (Conditional AVL rows force this)." },
  Q4: { name: "Certificate of conformance each shipment", detail: "A signed CoC accompanies each shipment and is filed to the batch or serial record." },
  Q5: { name: "PPAP-lite", detail: "The vendor submits a reduced production-part approval file before the first production shipment." },
}

// ------------------------------------------------------------------ vendor performance (Book I G §7)
export interface Scorecard {
  vendorId: string
  otdPct?: number
  otdLines: number
  qualityPct?: number
  qualityLots: number
  pricePct?: number
  priceLines: number
  confirmDays?: number
  overdueScars: number
  score?: number
  band: "A" | "B" | "C" | "D" | "Not rated"
  proposal?: "Conditional" | "Suspended"
}
/** Composite weights are design values (the PRD names the five measures, not their weights). */
export const SCORE_WEIGHTS = { otd: 35, quality: 30, price: 15, confirm: 10, scar: 10 }
export function scorecardFor(s: PurchasingFinanceState, vendorId: string): Scorecard {
  const v = vendorOf(s, vendorId)
  // OTD: received against the confirmed date, per receipt line
  let on = 0
  let tot = 0
  for (const g of s.grns) {
    const p = s.purchaseOrders.find((x) => x.id === g.poId)
    if (!p || p.vendorId !== vendorId) continue
    for (const gl of g.lines) {
      const pl = p.lines.find((x) => x.no === gl.poLine)
      const due = pl?.confirmedDate ?? pl?.schedules[0]?.date
      if (!due) continue
      tot++
      if (g.on <= due) on++
    }
  }
  // price compliance: invoice price against PO price
  let pOk = 0
  let pTot = 0
  for (const p of s.purchaseOrders.filter((x) => x.vendorId === vendorId)) {
    const inv = p.invoices ?? (p.invoice ? [{ ...p.invoice, lines: p.invoice.lines.map((l) => ({ ...l, qty: 0 })) }] : [])
    for (const iv of inv) for (const il of iv.lines) {
      const pl = p.lines.find((x) => x.no === il.line)
      if (!pl) continue
      pTot++
      if (Math.abs(il.price - pl.price) < 0.005) pOk++
    }
  }
  const days = s.purchaseOrders.filter((p) => p.vendorId === vendorId && p.sentOn && p.confirmedOn).map((p) => businessDaysBetween(p.sentOn!, p.confirmedOn!))
  const confirmDays = days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : undefined
  const q = qualityRating(vendorId)
  const otdPct = tot ? Math.round((on / tot) * 1000) / 10 : undefined
  const pricePct = pTot ? Math.round((pOk / pTot) * 1000) / 10 : undefined
  const parts: [number | undefined, number][] = [
    [otdPct, SCORE_WEIGHTS.otd], [q?.pct, SCORE_WEIGHTS.quality], [pricePct, SCORE_WEIGHTS.price],
    [confirmDays != null ? Math.max(0, 100 - confirmDays * 12) : undefined, SCORE_WEIGHTS.confirm], [v ? Math.max(0, 100 - (v.overdueScars ?? 0) * 25) : undefined, SCORE_WEIGHTS.scar],
  ]
  const have = parts.filter(([x]) => x != null)
  const wsum = have.reduce((a, [, w]) => a + w, 0)
  const score = wsum ? Math.round(have.reduce((a, [x, w]) => a + (x as number) * w, 0) / wsum) : undefined
  const band: Scorecard["band"] = score == null ? "Not rated" : score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : "D"
  return {
    vendorId, otdPct, otdLines: tot, qualityPct: q?.pct, qualityLots: q?.lots ?? 0, pricePct, priceLines: pTot, confirmDays, overdueScars: v?.overdueScars ?? 0, score, band,
    proposal: score != null && score < 50 ? "Suspended" : score != null && score < 70 ? "Conditional" : undefined,
  }
}
export function vendorsWithActivity(s: PurchasingFinanceState): string[] {
  return [...new Set([...s.purchaseOrders.map((p) => p.vendorId), ...allAvl(s).map((a) => a.vendorId)])].sort()
}

// ------------------------------------------------------------------ RFQ scoring (Book IV §3.3 table: weighted award grid)
export function bidFor(s: PurchasingFinanceState, rfqId: string, vendorId: string, version?: number) {
  const sel = version ?? s.rfqScoring[rfqId]?.selected[vendorId]
  const all = s.bidVersions.filter((b) => b.rfqId === rfqId && b.vendorId === vendorId)
  return all.find((b) => b.version === sel) ?? all[all.length - 1]
}
export const landedOf = (b: { price: number; freightPct: number; dutyPct: number }) => Math.round(b.price * (1 + (b.freightPct + b.dutyPct) / 100) * 100) / 100
export interface BidScore {
  vendorId: string
  landed: number
  lead: number
  quality: number
  buyAmerica: number
  total: number
  rank: number
}
/** Criterion scores are 0 to 100: lowest landed and shortest lead score 100 and the rest scale against them; quality is the IQC rating
 *  (vendor quality status when no lots yet: Approved 95, Conditional 80, Restricted 60, Disqualified 0, design values); Buy America 100 or 0. */
export function scoreBids(s: PurchasingFinanceState, rfqId: string, vendorIds: string[], weights: ScoringWeights): BidScore[] {
  const bids = vendorIds.map((vid) => ({ vid, b: bidFor(s, rfqId, vid) })).filter((x): x is { vid: string; b: NonNullable<ReturnType<typeof bidFor>> } => !!x.b)
  if (!bids.length) return []
  const minL = Math.min(...bids.map((x) => landedOf(x.b)))
  const minLead = Math.min(...bids.map((x) => x.b.leadDays || 1))
  const wsum = weights.landed + weights.lead + weights.quality + weights.buyAmerica || 1
  const rows = bids.map(({ vid, b }) => {
    const v = vendorOf(s, vid)
    const qr = qualityRating(vid)?.pct ?? ({ Approved: 95, Conditional: 80, Restricted: 60, Disqualified: 0 } as Record<string, number>)[v?.quality ?? "Conditional"] ?? 80
    const sc = {
      landed: Math.round((minL / landedOf(b)) * 100),
      lead: Math.round((minLead / (b.leadDays || 1)) * 100),
      quality: Math.round(qr),
      buyAmerica: b.buyAmerica ? 100 : 0,
    }
    const total = Math.round((sc.landed * weights.landed + sc.lead * weights.lead + sc.quality * weights.quality + sc.buyAmerica * weights.buyAmerica) / wsum)
    return { vendorId: vid, ...sc, total, rank: 0 }
  })
  rows.sort((a, b) => b.total - a.total).forEach((r, i) => (r.rank = i + 1))
  return rows
}
export const weightsOf = (s: PurchasingFinanceState, rfqId: string): ScoringWeights => (s.rfqScoring[rfqId] as RfqScoring | undefined)?.weights ?? { landed: 50, lead: 20, quality: 20, buyAmerica: 10 }

// ------------------------------------------------------------------ driver rates
export const rateAt = (d: DriverRate, on: ISODate) => [...d.versions].filter((v) => v.validFrom <= on).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
export const currentRate = (d: DriverRate) => rateAt(d, TODAY)

// ------------------------------------------------------------------ margin floors (Book I I §6.3)
/** Effective floor for an item: the item override when set (stricter), else the profit center floor; undefined when none is stated (PC-200, PC-400). */
export function effectiveFloor(s: PurchasingFinanceState, itemId: string): { pct?: number; level: "Item override" | "Profit center" | "None stated"; pc?: string } {
  const m = material(itemId)
  const pc = PROFIT_CENTERS.find((p) => p.id === m?.profitCenterId)
  const pcFloor = s.addedProfitCenters.find((p) => p.id === pc?.id)?.priceFloorPct ?? pc?.priceFloorPct
  const item = s.itemFloors.find((f) => f.itemId === itemId)
  if (item) return { pct: Math.max(item.floorPct, pcFloor ?? 0), level: "Item override", pc: pc?.id }
  if (pcFloor != null) return { pct: pcFloor, level: "Profit center", pc: pc?.id }
  return { level: "None stated", pc: pc?.id }
}
export const marginOf = (price: number, cost: number) => (price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 0)
/** Breach route [DOC:p.122 §6.3]: Pricing Manager, Sales Director, and the CFO when more than 5 points below the floor. */
export const breachRoute = (points: number) => (points > 5 ? ["Pricing Manager", "Sales Director", "CFO"] : ["Pricing Manager", "Sales Director"])

// ------------------------------------------------------------------ hierarchy
export function parentAsOf(s: PurchasingFinanceState, kind: "cost" | "profit", nodeId: string, base: string | undefined, asOf: ISODate): string | undefined {
  const moves = s.hierarchyMoves.filter((m) => m.kind === kind && m.nodeId === nodeId).sort((a, b) => a.effective.localeCompare(b.effective))
  if (!moves.length) return base
  const hit = [...moves].filter((m) => m.effective <= asOf).pop()
  return hit ? hit.toParent : moves[0].fromParent
}
/** Where-used before deactivation: open production orders, budget lines, allocation cycles, work center links [DOC:p.111 §2]. */
export function whereUsedCc(s: PurchasingFinanceState, id: string) {
  const wcs = WORK_CENTERS.filter((w) => w.costCenterId === id).map((w) => w.id)
  const cycles = s.allocationCycles.filter((c) => c.senderCostCenterIds.includes(id as never) || c.receiverCostCenterIds.includes(id as never)).map((c) => c.id)
  const budgets = s.budgets.filter((b) => b.costCenterId === id && b.fy >= 2026).length
  let openWos: string[] = []
  if (store.hasSlice("planningProduction")) {
    const pp = store.getSlice("planningProduction" as never) as unknown as { productionOrders?: { id: string; status: string; operations: { workCenterId: string }[] }[] }
    openWos = (pp.productionOrders ?? []).filter((w) => !["Closed", "Settled", "Cancelled", "Complete", "Completed"].includes(w.status) && w.operations.some((o) => wcs.includes(o.workCenterId as never))).map((w) => w.id)
  }
  return { openWos, budgets, cycles, wcs, blocking: openWos.length + cycles.length + wcs.length }
}

// ------------------------------------------------------------------ budgets (ACC 21 stand-in)
export const budgetFor = (s: PurchasingFinanceState, cc: string, fy: number) => s.budgets.filter((b) => b.costCenterId === cc && b.fy === fy)
export const stdText = (s: PurchasingFinanceState, id: MaterialId) => stdOf(s, id)
