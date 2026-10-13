// Pure helpers for the feature-list screens: no store access, no React. Everything here reads a DB
// and returns a value, so pages and actions share one reading of each rule.

import { materialById } from "@/data/shared/materials"
import { addDays, daysBetween, orderValue, product, TODAY, type DB, type Delivery, type Quotation, type SalesOrder } from "../data/model"
import { spareAtp } from "../data/ext-actions"
import { planFromOrder } from "./seed"
import {
  DATE_WINDOW_DAYS, MARGIN_FLOOR_PCT, MARGIN_TARGET_PCT, VEHICLE_CAPACITY_KG,
  type BillingPlan, type KitDef, type QuoteExt, type RunGroup,
} from "./model"

export const CAD_RATE = 1.36 // OQ-42
export const fxOf = (db: DB) => db.fx

// ============================================================================ billing
export const billingPlanOf = (db: DB, o: SalesOrder): BillingPlan => db.fx.billing[o.id] ?? planFromOrder(o)
export const planTotal = (p: Pick<BillingPlan, "milestones">) => Math.round(p.milestones.reduce((s, m) => s + (Number.isFinite(m.pct) ? m.pct : 0), 0) * 1000) / 1000

// ============================================================================ quotations
export function quoteExtOf(db: DB, q: Quotation): QuoteExt {
  const stored = db.fx.quoteExt[q.id]
  if (stored) return stored
  const costPerUnit: QuoteExt["costPerUnit"] = {}
  const lead: QuoteExt["leadTimeWeeks"] = {}
  const ctp: QuoteExt["ctp"] = {}
  for (const l of q.lines) {
    const p = product(l.item)
    const cad = db.customers.find((c) => c.id === q.customerId)?.currency === "CAD"
    costPerUnit[l.no] = Math.round((p.stdCost ?? l.price * 0.78) * (cad ? CAD_RATE : 1))
    lead[l.no] = p.kind === "ETO" ? 40 : p.kind === "MTO" ? 8 : p.stdCost && p.stdCost > 100000 ? 12 : 4
    ctp[l.no] = p.kind === "MTS" ? { state: "Not required" } : { state: "Pending" }
  }
  return { type: "Firm", costPerUnit, leadTimeWeeks: lead, ctp, surcharges: [] }
}
export const isEtoLine = (item: string) => product(item).kind === "ETO"
/** Lead-time band for a budgetary quote: ±25% [DOC:p.50 §3.1 Budgetary (±25%)]. */
export const leadBand = (weeks: number) => ({ low: Math.max(1, Math.round(weeks * 0.75)), high: Math.round(weeks * 1.25) })

export interface WaterStep { type: string; label: string; value?: number; won?: boolean; note: string }
/** The pricing waterfall of Book I Part A §4.4 / Book IV §5.1 for one document line. The line price is the result;
 *  the steps show which access level existed and which won (reading SR-29: a price below the list rate reads as a
 *  customer agreement, a price at the list rate as the price list, ETO lines come from the cost estimate). */
export function priceWaterfall(item: string, price: number, source: string, currency: "USD" | "CAD", opts: { eto?: boolean; ce?: string; cost?: number } = {}): { steps: WaterStep[]; source: string } {
  const p = product(item)
  const list = Math.round(p.unitPrice * (currency === "CAD" ? CAD_RATE : 1))
  const below = price < list - 0.5
  const eto = !!opts.eto || p.kind === "ETO"
  let winner = eto ? "Cost estimate and margin" : below ? "Customer agreement" : "Price list"
  if (source === "Manual") winner = "Manual"
  const steps: WaterStep[] = [
    { type: "PB00 step 1", label: "Manual override on the line", note: source === "Manual" ? "Entered within the user's override authority" : "Not entered", won: winner === "Manual", value: source === "Manual" ? price : undefined },
    { type: "PB00 step 2", label: "Customer-specific price", note: below && !eto ? "Active agreement row on the pricing date; first hit wins" : "No active agreement for this item", won: winner === "Customer agreement", value: below && !eto ? price : undefined },
    { type: "PB00 step 3", label: "Price list rate with quantity breaks", note: eto ? "ETO items have no list rate; priced from the cost estimate" : `Rate ${list.toLocaleString("en-US")}; no quantity break reached`, won: winner === "Price list", value: eto ? undefined : list },
    { type: "PB00 step 4", label: "Item default (fixed price or markup)", note: eto ? `Cost estimate ${opts.ce ?? "CE"} plus margin` : "Fixed price on the Sales tab; not reached when step 2 or 3 hits", won: winner === "Cost estimate and margin", value: eto ? price : undefined },
    { type: "DIS1", label: "Discount %", note: "One discount per line within the role limit; none on this line", value: 0 },
  ]
  return { steps, source: source === "Quotation" ? `Quotation (frozen); ${winner} at quote time` : winner }
}
export function marginOf(price: number, cost: number) {
  const pct = price ? ((price - cost) / price) * 100 : 0
  return { margin: price - cost, pct, verdict: pct < MARGIN_FLOOR_PCT ? ("below floor" as const) : pct < MARGIN_TARGET_PCT ? ("below target" as const) : ("on target" as const) }
}

// ============================================================================ kits (Book IV §6.1)
export function kitComponentAtp(db: DB, kit: KitDef, qty: number) {
  return kit.components.map((c) => {
    const m = materialById(c.item)
    const a = spareAtp(db, c.item)
    const need = c.qty * qty
    const weeks = db.spareStock[c.item]?.leadWeeks ?? 0
    const date = a.atp >= need ? TODAY : addDays(TODAY, Math.max(weeks, 1) * 7)
    return { ...c, description: m?.description ?? c.item, status: m?.status ?? "Unknown", atp: a.atp, need, ok: a.atp >= need, date, blocked: !!m && ["Blocked", "Restricted", "Sales Block"].includes(m.status) }
  })
}
/** The kit line confirms at the date the last component confirms. */
export const kitConfirmDate = (rows: ReturnType<typeof kitComponentAtp>) => rows.map((r) => r.date).sort().at(-1) ?? TODAY
export const kitComponentTotal = (kit: KitDef, qty = 1) => kit.components.reduce((s, c) => s + c.qty * c.price, 0) * qty

// ============================================================================ order readiness chips (Book VI OM-SO)
export type Readiness = "ready" | "not ready" | "n/a"
export interface ReadinessChip { key: "supply" | "credit" | "quality" | "documents"; state: Readiness; why: string }
export function orderReadiness(db: DB, o: SalesOrder): ReadinessChip[] {
  const ds = db.deliveries.filter((d) => d.soId === o.id)
  const latest = ds[0]
  const open = o.lines.filter((l) => !["Cancelled", "Shipped", "Invoiced", "Closed"].includes(l.status))
  const supplyOk = open.length === 0 || open.every((l) => l.schedules.every((s) => ["Allocated/Pegged", "Delivery Due", "Partially Delivered", "Delivered", "Closed", "Cancelled"].includes(s.status)))
  const lastCredit = o.creditChecks.at(-1)
  const creditOk = o.status !== "Credit Hold" && (!lastCredit || (lastCredit.passLimit && lastCredit.passPastDue) || ["Confirmed", "In Fulfillment", "Partially Shipped", "Shipped", "Invoiced/Closed"].includes(o.status))
  const done = o.status === "Shipped" || o.status === "Invoiced/Closed"
  return [
    { key: "supply", state: done ? "ready" : supplyOk ? "ready" : "not ready", why: done ? "Everything shipped" : supplyOk ? "Every open schedule line is allocated or in a delivery" : `${open.reduce((n, l) => n + l.schedules.filter((s) => ["Open", "Confirmed"].includes(s.status)).length, 0)} schedule lines still open or only confirmed` },
    { key: "credit", state: o.status === "Credit Hold" ? "not ready" : creditOk ? "ready" : "not ready", why: o.status === "Credit Hold" ? "Waiting for Finance release (R-2)" : lastCredit ? `Last check ${lastCredit.when}: ${lastCredit.passLimit && lastCredit.passPastDue ? "passed" : "failed"}` : "No credit check yet (Draft)" },
    { key: "quality", state: !latest ? "n/a" : latest.flags.quality === "passed" ? "ready" : "not ready", why: !latest ? "No delivery yet" : `Pre-shipment inspection on ${latest.id}: ${latest.flags.quality}` },
    { key: "documents", state: !latest ? "n/a" : latest.flags.documents === "passed" ? "ready" : "not ready", why: !latest ? "No delivery yet" : `Carrier and PRO/BOL on ${latest.id}: ${latest.flags.documents}` },
  ]
}
export const SIX_SLICE_LABELS = ["Order Acceptance", "Design Approval", "Major Materials", "Production / Test", "Shipment", "Delivery / Commissioning"]

// ============================================================================ delivery creation run (Book IV §2.3)
export interface RunOpts { horizonDays: number; warehouses: string[]; customers: string[]; allowMerge: boolean; windowDays: number }
export const defaultRunOpts = (): RunOpts => ({ horizonDays: 7, warehouses: [], customers: [], allowMerge: true, windowDays: DATE_WINDOW_DAYS })
const kgOf = (item: string) => product(item).huKg || (product(item).kind === "ETO" ? 60000 : 900)
const equipmentOf = (item: string) => (kgOf(item) >= 7000 ? "Flatbed" : "Van")
const overDimensional = (item: string) => product(item).kind === "ETO" || product(item).huKg >= 14000

/** Simulated grouping: no write. Applies the PRD split and merge rules in a fixed order so the same data always
 *  gives the same groups, and each group carries the id of the rule that fired. */
export function simulateRun(db: DB, o: RunOpts): { groups: RunGroup[]; held: { key: string; why: string; ruleId: string }[]; considered: number } {
  const end = addDays(TODAY, o.horizonDays)
  const groups: RunGroup[] = []
  const held: { key: string; why: string; ruleId: string }[] = []
  let considered = 0
  const cand: { o: SalesOrder; line: number; sched: number; qty: number; item: string; date: string }[] = []
  for (const so of db.orders) {
    if (!["Confirmed", "In Fulfillment", "Partially Shipped"].includes(so.status)) continue
    const c = db.customers.find((x) => x.id === so.customerId)!
    if (o.customers.length && !o.customers.includes(c.id)) continue
    for (const l of so.lines) {
      if (o.warehouses.length && !o.warehouses.includes(l.warehouse)) continue
      for (const s of l.schedules) {
        if (s.status !== "Allocated/Pegged" || s.deliveryId || !s.confDate) continue
        considered++
        const qty = s.confQty ?? s.reqQty
        if (s.confDate > end) {
          held.push({ key: `${so.id}/${l.no}/${s.no}`, why: `Due ${s.confDate}, outside the ${o.horizonDays}-day horizon (to ${end}). Not in this run.`, ruleId: "DLV-SPLIT-E1" })
          continue
        }
        const stillOpen = so.lines.some((x) => x.schedules.some((y) => !(x.no === l.no && y.no === s.no) && !["Delivered", "Closed", "Cancelled", "Allocated/Pegged", "Delivery Due", "Partially Delivered"].includes(y.status)))
        if (c.noPartial && stillOpen) {
          held.push({ key: `${so.id}/${l.no}/${s.no}`, why: `${c.name} has the no-partial flag and ${so.id} still has quantity not allocated: it waits for the full order.`, ruleId: "DLV-SPLIT-M5" })
          continue
        }
        cand.push({ o: so, line: l.no, sched: s.no, qty, item: l.item, date: s.confDate })
      }
    }
  }
  // 1. one bucket per customer + ship-to + incoterms + warehouse (mandatory splits M1, M2 separate everything else)
  const buckets = new Map<string, typeof cand>()
  for (const x of cand) {
    const wh = x.o.lines.find((l) => l.no === x.line)!.warehouse
    const k = [x.o.customerId, x.o.shipTo, x.o.incoterms, wh].join("|")
    buckets.set(k, [...(buckets.get(k) ?? []), x])
  }
  let seq = 1
  for (const [k, items] of buckets) {
    const [customerId, shipTo, incoterms, warehouse] = k.split("|")
    const cust = db.customers.find((c) => c.id === customerId)!
    const mergeAllowed = o.allowMerge && (db.custExt[customerId]?.consolidation ?? "Per shipment") !== "Per order"
    const mk = (part: typeof items, ruleId: string, why: string): RunGroup => ({
      key: `G${String(seq++).padStart(2, "0")}`, customerId, shipTo, incoterms, warehouse,
      soIds: [...new Set(part.map((x) => x.o.id))],
      items: part.map((x) => ({ soId: x.o.id, line: x.line, sched: x.sched, qty: x.qty, item: x.item, kg: kgOf(x.item) * x.qty })), ruleId, why,
    })
    // M4 over-dimensional ships alone
    const big = items.filter((x) => overDimensional(x.item))
    const rest = items.filter((x) => !overDimensional(x.item))
    for (const b of big) groups.push(mk([b], "DLV-SPLIT-M4", `${b.item} is over-dimensional and needs permits: it ships alone (${cust.name}).`))
    // E1 date window: split schedules more than N days apart
    rest.sort((a, b) => a.date.localeCompare(b.date))
    const windows: (typeof rest)[] = []
    for (const x of rest) {
      const last = windows.at(-1)
      if (last && daysBetween(last[0].date, x.date) <= o.windowDays) last.push(x)
      else windows.push([x])
    }
    for (const w of windows) {
      // E2 equipment type
      const flat = w.filter((x) => equipmentOf(x.item) === "Flatbed")
      const van = w.filter((x) => equipmentOf(x.item) === "Van")
      const parts = flat.length && van.length ? [{ p: flat, r: "DLV-SPLIT-E2", why: "Flatbed units split from van-loadable items (equipment type differs)." }, { p: van, r: "DLV-SPLIT-E2", why: "Van-loadable items split from flatbed units (equipment type differs)." }] : [{ p: w, r: "", why: "" }]
      for (const part of parts) {
        const kg = part.p.reduce((s, x) => s + kgOf(x.item) * x.qty, 0)
        if (kg > VEHICLE_CAPACITY_KG && part.p.length > 1) {
          // E3 weight over capacity: split greedily
          let cur: typeof part.p = []
          let curKg = 0
          for (const x of part.p) {
            const w1 = kgOf(x.item) * x.qty
            if (cur.length && curKg + w1 > VEHICLE_CAPACITY_KG) {
              groups.push(mk(cur, "DLV-SPLIT-E3", `Load would exceed ${VEHICLE_CAPACITY_KG.toLocaleString("en-US")} kg vehicle capacity: split with the load plan.`))
              cur = []
              curKg = 0
            }
            cur.push(x)
            curKg += w1
          }
          if (cur.length) groups.push(mk(cur, "DLV-SPLIT-E3", `Load over ${VEHICLE_CAPACITY_KG.toLocaleString("en-US")} kg vehicle capacity: remainder of the split.`))
        } else {
          const sos = new Set(part.p.map((x) => x.o.id))
          const merged = sos.size > 1
          groups.push(mk(part.p, part.r || (merged && mergeAllowed ? "DLV-MERGE-1" : windows.length > 1 ? "DLV-SPLIT-E1" : "DLV-GROUP-0"), part.why || (merged && mergeAllowed ? `Orders ${[...sos].join(" and ")}: same customer, ship-to, Incoterms and date window; the customer's consolidation rule permits a merge (packing list keeps one section per order).` : windows.length > 1 ? `Schedules ${o.windowDays}+ days apart are kept in separate deliveries.` : "Same ship-to and Incoterms, all schedules due in the horizon.")))
        }
      }
    }
    void incoterms
  }
  // M1 / M2 explanation rows for buckets split by ship-to or incoterms across the same customer
  const byCust = new Map<string, Set<string>>()
  for (const g of groups) byCust.set(g.customerId, new Set([...(byCust.get(g.customerId) ?? []), g.shipTo]))
  for (const g of groups) if ((byCust.get(g.customerId)?.size ?? 0) > 1 && g.ruleId === "DLV-GROUP-0") { g.ruleId = "DLV-SPLIT-M1"; g.why = `${db.customers.find((c) => c.id === g.customerId)?.name} has other schedules for a different ship-to site: ship-to sites never share a delivery.` }
  const byShip = new Map<string, Set<string>>()
  for (const g of groups) byShip.set(g.customerId + g.shipTo, new Set([...(byShip.get(g.customerId + g.shipTo) ?? []), g.incoterms]))
  for (const g of groups) if ((byShip.get(g.customerId + g.shipTo)?.size ?? 0) > 1 && g.ruleId === "DLV-GROUP-0") { g.ruleId = "DLV-SPLIT-M2"; g.why = "Same ship-to but a different Incoterms on another order: Incoterms never share a delivery." }
  // merge group labels
  let mg = 1
  for (const g of groups) if (g.ruleId === "DLV-MERGE-1") g.mergeGroup = `MG-${String(mg++).padStart(4, "0")}`
  return { groups, held, considered }
}

// ============================================================================ shipments
export const shipIdOf = (dlvId: string) => `SHP-TBD-${dlvId.slice(-4)}`
export const dlvIdOfShip = (shpId: string) => `DLV-TBD-${shpId.slice(-4)}`
export function isExport(d: Delivery) { return /,\s*(QC|SK|BC|MB|ON|AB)\b/.test(d.shipTo) }
export const countryOf = (d: Delivery) => (isExport(d) ? "Canada" : "United States")

// ============================================================================ sales value helpers
export const openValue = (o: SalesOrder) => o.lines.reduce((s, l) => s + l.schedules.reduce((a, x) => a + Math.max(0, (x.confQty ?? x.reqQty) - x.deliveredQty - x.cancelledQty), 0) * l.unitPrice, 0)
export { orderValue }
