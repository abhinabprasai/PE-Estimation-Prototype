// Gate triggers and sampling rules of QM-PLAN / QM-EXEC [DOC:pp.33-35 §6.2-6.5; p.264 QM-EXEC "Arrives from
// GRN QI rows, routing checkpoints, shipment gates, RMA receipts"]. Pure helpers plus `openGateLot`, which
// every trigger (GRN, routing checkpoint, shipment gate, RMA receipt) calls inside its own mutate.

import { THRESHOLDS } from "@/data/domain"
import type { BatchId, DocRef, InspectionLotId, MaterialId, SerialNo, VendorId, WorkCenterId } from "@/data/domain"
import { MATERIALS } from "@/data/shared"
import { addDays } from "@/lib/format"
import type { QualityTraceState } from "./slice"
import { finSpec } from "./seed"
import type { AutoAcceptWarning, FinalTest, Gate, InspectionLot, PlanRevision, PlanType, QtPlan, VendorLots } from "./types"

export const AQL_VALUES = [0.65, 1.0, 1.5, 2.5, 4.0] as const
export const AQL_LEVELS = ["S1", "S2", "S3", "S4", "G1", "G2", "G3"] as const
export const DEFAULT_AQL_LEVEL = "G2"

// ---------------------------------------------------------------- sample size (derived from lot size + level)
/** Design table (reading QT-R25): the specification says "sample size auto-derives from lot size + level" and gives no table. */
const G2_TABLE: [max: number, n: number][] = [[8, 2], [15, 3], [25, 5], [50, 8], [90, 13], [150, 20], [280, 32], [500, 50], [1200, 80], [3200, 125], [10000, 200], [Infinity, 315]]
export function sampleSizeFor(lotSize: number, level: string = DEFAULT_AQL_LEVEL, state: "Normal" | "Tightened" | "Reduced" = "Normal"): number {
  const base = G2_TABLE.find(([m]) => lotSize <= m)![1]
  let n = base
  if (level.startsWith("S")) n = [2, 3, 5, 8][Math.max(0, Math.min(3, Number(level.slice(1)) - 1))]
  else if (level === "G1") n = Math.ceil(base * 0.6)
  else if (level === "G3") n = Math.ceil(base * 1.6)
  if (state === "Tightened") n = Math.ceil(n * 1.5)
  if (state === "Reduced") n = Math.max(2, Math.ceil(n * 0.6))
  return Math.max(1, Math.min(lotSize, n))
}

// ---------------------------------------------------------------- plan resolution
export const planTypeOf = (g: Exclude<Gate, "FQC"> | "FQC"): PlanType => ({ IQC: "INC", IPQC: "INP", FQC: "FIN", OQC: "PSI", RQC: "RMA" } as const)[g]

export const activeRevOn = (p: QtPlan, today: string): PlanRevision | undefined =>
  p.revisions.find((r) => r.status === "Active" && r.effectiveFrom <= today && (!r.effectiveTo || r.effectiveTo >= today))

/** Most specific active plan wins; ties broken by newest effective date [DOC:p.33 §6.2]. */
export function resolvePlan(d: { plans: QtPlan[] }, type: PlanType, o: { itemId: string; vendorId?: string; wc?: string }, today: string): { plan: QtPlan; rev: PlanRevision } | undefined {
  const hits: { plan: QtPlan; rev: PlanRevision; rank: number }[] = []
  for (const plan of d.plans) {
    if (plan.type !== type) continue
    const rev = activeRevOn(plan, today)
    if (!rev) continue
    let rank = 0
    if (plan.scope === "Item" && plan.itemId === o.itemId) rank = 2
    else if (plan.scope === "Item Group" && (plan.itemGroup?.includes(o.itemId) || plan.itemGroup?.includes(`-${o.itemId.split("-").pop()}`))) rank = 1
    else if (plan.scope === "Item + Vendor" && plan.itemId === o.itemId && plan.vendorId === o.vendorId) rank = 3
    else if (plan.scope === "Item + Operation" && plan.itemId === o.itemId && (!o.wc || plan.operation?.startsWith(o.wc))) rank = 3
    if (rank) hits.push({ plan, rev, rank })
  }
  hits.sort((a, b) => b.rank - a.rank || (a.rev.effectiveFrom < b.rev.effectiveFrom ? 1 : -1))
  return hits[0]
}

// ---------------------------------------------------------------- V-QM-01: one Active plan per type + scope + date
export function overlapsActive(d: { plans: QtPlan[] }, p: QtPlan, rev: Pick<PlanRevision, "effectiveFrom" | "effectiveTo">): QtPlan | undefined {
  const a0 = rev.effectiveFrom
  const a1 = rev.effectiveTo ?? "9999-12-31"
  return d.plans.find(
    (o) =>
      o.id !== p.id && o.type === p.type && o.scope === p.scope && (o.itemId ?? "") === (p.itemId ?? "") && (o.itemGroup ?? "") === (p.itemGroup ?? "") && (o.vendorId ?? "") === (p.vendorId ?? "") && (o.operation ?? "") === (p.operation ?? "") &&
      o.revisions.some((r) => r.status === "Active" && r.effectiveFrom <= a1 && (r.effectiveTo ?? "9999-12-31") >= a0),
  )
}

// ---------------------------------------------------------------- skip-lot qualification [DOC:p.33 §6.2]
export function skipLotQualified(v?: VendorLots): { qualified: boolean; rating: number; streak: number } {
  const rating = v && v.lots ? v.accepted / v.lots : 0
  const streak = v?.streak ?? 0
  return { qualified: streak >= 10 && rating >= 0.98, rating, streak }
}

// ---------------------------------------------------------------- AQL switching [DOC:p.33 §6.2]
/** Re-evaluate the switching state of a plan revision after an IQC decision. Returns a note when the state changed. */
export function evaluateSwitching(d: Pick<QualityTraceState, "lots" | "plans">, planId: string): string | undefined {
  const p = d.plans.find((x) => x.id === planId)
  const r = p && [...p.revisions].reverse().find((x) => x.status === "Active")
  if (!p || !r?.aql?.switching) return
  const decided = d.lots.filter((l) => l.planId === planId && l.decision).sort((a, b) => ((a.decidedOn ?? "") + a.id < (b.decidedOn ?? "") + b.id ? -1 : 1))
  const last5 = decided.slice(-5)
  const rejected5 = last5.filter((l) => l.decision === "Rejected").length
  const lastN = decided.slice(-THRESHOLDS.inspectionReduceAfterAccepted)
  const run10 = lastN.length === THRESHOLDS.inspectionReduceAfterAccepted && lastN.every((l) => l.decision === "Accepted")
  const run5 = last5.length === 5 && last5.every((l) => l.decision === "Accepted")
  const a = r.aql
  if (a.state !== "Tightened" && rejected5 >= THRESHOLDS.inspectionTightenRejectedOf5) {
    a.state = "Tightened"
    a.reduceEligible = false
    return `Switching: ${rejected5} of the last 5 lots rejected; inspection is now Tightened`
  }
  if (a.state === "Reduced" && decided[decided.length - 1]?.decision === "Rejected") {
    a.state = "Normal"
    return "Switching: a lot was rejected; Reduced inspection returns to Normal"
  }
  if (a.state === "Tightened" && run5) {
    a.state = "Normal"
    return "Switching: 5 consecutive lots accepted; Tightened inspection returns to Normal"
  }
  if (a.state === "Normal" && run10 && !a.reduceEligible) {
    a.reduceEligible = true
    return `Switching: ${THRESHOLDS.inspectionReduceAfterAccepted} consecutive lots accepted; Reduced inspection can be approved by the Quality Manager`
  }
  return
}

// ---------------------------------------------------------------- gate triggers
export interface GateTrigger {
  gate: Exclude<Gate, "FQC">
  /** Reuse the inspection number the requesting module already issued (routing checkpoint). */
  id?: string
  subject: DocRef
  itemId: MaterialId
  vendorId?: VendorId
  batchId?: BatchId
  serials?: SerialNo[]
  lotSize: number
  workCenterId?: WorkCenterId
}
export const slaFor = (g: Gate) => (g === "IQC" ? 3 : g === "RQC" ? 5 : 1)
/** Items a QI check applies to; the rest fall under Auto-Accept with Warning when no plan exists (non-QI-required only). */
const QI_TYPES = new Set(["RAW", "SEMI", "FIN", "SPARE"])
export const qiRequired = (itemId: string) => QI_TYPES.has(MATERIALS.find((m) => m.id === itemId)?.type ?? "RAW")

/** Open (or skip, or warn about) the inspection a gate trigger calls for. Idempotent per subject + batch. */
export function openGateLot(d: QualityTraceState, o: GateTrigger, today: string): { lot?: InspectionLot; warning?: AutoAcceptWarning; note: string } {
  const dup = d.lots.find((l) => (o.id && l.id === o.id) || (l.gate === o.gate && l.subject.id === o.subject.id && l.subject.type === o.subject.type && (o.gate === "IQC" ? (l.batchId ?? "") === (o.batchId ?? "") : l.itemId === o.itemId)))
  if (dup) return { lot: dup, note: "exists" }
  const id = (o.id ?? `IL-TBD-${String(++d.seq).padStart(4, "0")}`) as InspectionLotId
  const base: Omit<InspectionLot, "sampleSize" | "activity"> = { id, gate: o.gate, subject: o.subject, itemId: o.itemId, vendorId: o.vendorId, batchId: o.batchId, serials: o.serials ?? [], lotSize: o.lotSize, instruments: [], results: [], createdOn: today, slaDays: slaFor(o.gate), workCenterId: o.workCenterId }
  const hit = resolvePlan(d, planTypeOf(o.gate), { itemId: o.itemId, vendorId: o.vendorId, wc: o.workCenterId }, today)
  if (!hit) {
    if (o.gate === "IQC" && !qiRequired(o.itemId)) {
      const w: AutoAcceptWarning = { id: `WRN-TBD-${String(++d.seq).padStart(4, "0")}`, on: today, gate: o.gate, itemId: o.itemId, vendorId: o.vendorId, subject: o.subject, batchId: o.batchId, text: `No active INC plan for ${o.itemId}; the item is not QI-required, so the receipt passed to Unrestricted under Auto-Accept with Warning.` }
      d.warnings.unshift(w)
      return { warning: w, note: "auto-accept with warning" }
    }
    const lot: InspectionLot = { ...base, adHoc: true, adHocRows: [], sampleSize: o.lotSize, activity: [{ at: today, by: "System", text: `E-QM-01: no active ${planTypeOf(o.gate)} plan for ${o.itemId}${o.vendorId ? ` / ${o.vendorId}` : ""}. Policy Manual Inspection: add ad-hoc rows; Quality Manager sign-off is mandatory. Quality Manager alerted.` }] }
    d.lots.unshift(lot)
    return { lot, note: "manual inspection" }
  }
  const { plan, rev } = hit
  let sampleSize = o.lotSize
  if (rev.sampling === "AQL Sampling" && rev.aql) sampleSize = sampleSizeFor(o.lotSize, rev.aql.level, rev.aql.state)
  else if (rev.sampling === "Fixed Sample Size") sampleSize = Math.min(o.lotSize, rev.fixedSize ?? 3)
  else if (rev.sampling === "Skip-Lot") sampleSize = sampleSizeFor(o.lotSize)
  const lot: InspectionLot = { ...base, planId: plan.id, planRev: rev.rev, sampleSize, activity: [{ at: today, by: "System", text: `Inspection created by the gate trigger (${plan.id} rev ${rev.rev}, sample ${sampleSize} of ${o.lotSize})` }] }
  // skip-lot: a qualified vendor's lot is inspected 1 of N [DOC:p.33 §6.2]
  if (rev.sampling === "Skip-Lot" && o.gate === "IQC") {
    const n = rev.skipLot?.n ?? 5
    const q = skipLotQualified(d.vendorLots.find((v) => v.vendorId === o.vendorId))
    const recent = d.lots.filter((l) => l.planId === plan.id && l.vendorId === o.vendorId).sort((a, b) => (a.createdOn + a.id < b.createdOn + b.id ? 1 : -1))
    let run = 0
    for (const l of recent) {
      if (l.skipped) run++
      else break
    }
    if (q.qualified && run < n - 1) {
      Object.assign(lot, { skipped: true, decision: "Accepted", decidedOn: today, decidedBy: undefined, sampleSize: 0 })
      lot.activity.push({ at: today, by: "System", text: `Skip-lot: vendor qualified (rating ${(q.rating * 100).toFixed(0)}%, ${q.streak} consecutive accepted); lot ${run + 1} of ${n} not inspected, accepted` })
    }
  }
  d.lots.unshift(lot)
  return { lot, note: lot.skipped ? "skipped" : "opened" }
}

export const addBusinessDays = (iso: string, n: number) => {
  let d = iso
  let left = n
  while (left > 0) {
    d = addDays(d, 1)
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return d
}
/** Business days from `from` to `to` (Mon-Fri), excluding the start day. */
export const businessDaysBetween = (from: string, to: string) => {
  if (to <= from) return 0
  let n = 0
  let d = from
  while (d < to) {
    d = addDays(d, 1)
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay()
    if (dow !== 0 && dow !== 6) n++
  }
  return n
}

// ---------------------------------------------------------------- QM-FIN-001: units arrive when the order reaches Testing
/** Design values per finished item (winding resistance mΩ, no-load loss kW, %Z): prototype design values (QT-R24). */
const FIN_DESIGN: Record<string, { nll: number; z: number; wr: number; pad?: boolean; mva: string; voltage: string; cooling: string; impedance: string; taps: string }> = {
  "FIN-TBD-20MVA": { nll: 12.0, z: 9.5, wr: 412, mva: "20 / 26.7 MVA", voltage: "115 kV - 13.8 kV", cooling: "ONAN/ONAF", impedance: "9.5%", taps: "OLTC ±8 × 1.25%" },
  "FIN-TBD-5000SS": { nll: 4.1, z: 6.5, wr: 186, mva: "5 / 6.25 MVA", voltage: "34.5 kV - 4.16 kV", cooling: "ONAN/ONAF", impedance: "6.5%", taps: "OLTC ±8 × 1.25%" },
  "FIN-TBD-7500MTO": { nll: 5.6, z: 5.75, wr: 96, mva: "7.5 MVA", voltage: "24.94 kV - 600Y/347 V", cooling: "ONAN/ONAF", impedance: "5.75%", taps: "OLTC ±8 × 1.25%" },
  "FIN-TBD-2500PM": { nll: 2.9, z: 5.75, wr: 640, pad: true, mva: "2,500 kVA", voltage: "12.47 kV - 480Y/277 V", cooling: "KNAN", impedance: "5.75%", taps: "DETC ±2 × 2.5%" },
  "FIN-TBD-1000PM": { nll: 1.4, z: 5.75, wr: 1280, pad: true, mva: "1,000 kVA", voltage: "12.47 kV - 480Y/277 V", cooling: "KNAN", impedance: "5.75%", taps: "DETC ±2 × 2.5%" },
}
export interface OrderForTest {
  id: string
  itemId: string
  serials: string[]
  pegs: { soId: string }[]
  promiseDate?: string
  finish?: string
  status: string
}
/** Create the final test record for an order at Testing, once. Returns the record or undefined (already there, or no active FIN plan: policy Block). */
export function openFinalTest(d: QualityTraceState, wo: OrderForTest, customerId: string | undefined, today: string, lotId?: string): FinalTest | undefined {
  const have = d.finalTests.find((f) => f.woId === wo.id || (wo.serials[0] && f.serial === wo.serials[0]))
  if (have) {
    if (lotId && have.id !== lotId && !have.runs.length) have.id = lotId as InspectionLotId
    return undefined
  }
  const serial = wo.serials[0]
  if (!serial) return undefined
  const hit = resolvePlan(d, "FIN", { itemId: wo.itemId }, today)
  if (!hit) return undefined
  const dv = FIN_DESIGN[wo.itemId] ?? FIN_DESIGN["FIN-TBD-5000SS"]
  const f: FinalTest = {
    id: (lotId ?? `IL-TBD-${String(++d.seq).padStart(4, "0")}`) as InspectionLotId, planId: hit.plan.id, planRev: hit.rev.rev, woId: wo.id as FinalTest["woId"], woStatusText: wo.status, serial: serial as FinalTest["serial"],
    itemId: wo.itemId as MaterialId, soId: (wo.pegs[0]?.soId ?? "") as FinalTest["soId"], customerId: (customerId ?? "") as FinalTest["customerId"], promisedOn: wo.promiseDate ?? wo.finish ?? today,
    nameplate: { mva: dv.mva, voltage: dv.voltage, cooling: dv.cooling, impedance: dv.impedance, taps: dv.taps }, spec: finSpec(dv.nll, dv.z, dv.wr, false, dv.pad), typeTestOrdered: false, runs: [],
    activity: [{ at: today, by: "System", text: "WO reached Testing; added to the final test queue" }],
  }
  d.finalTests.push(f)
  return f
}
