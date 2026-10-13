// Pure rules for the feature-list screens (12 October 2026): valuation-change variant, duplicate
// merge worklist, consignment settlement basis, statistical safety stock, network exceptions and the
// stock projection used by the safety-stock exception report. Each rule names its source; where the
// PRD is silent the value is a reading (EXT_READINGS) shown on screen as a chip.

import type { Material } from "@/data/domain"
import { FISCAL_PERIODS, TODAY } from "@/data/shared"
import type { MaterialsState } from "../data/state"
import { getMaterial, onHand, rateOf } from "../data/state"
import type { SafetyStockRow, ValuationChange } from "../data/types"
import type { AbcClass, OwnershipTag, StatSafety } from "../data/ext"
import { available, isValuated, resolveRow, ssEffective, type ReadingId } from "./rules"
import type { AcctRow } from "../data/types"

/** Readings added with the feature-list pass; same chip as READINGS, text kept here to leave rules.ts alone. */
export const EXT_READINGS = {
  "RD-MM-31": "Valuation change approval: the PRD names Controller approval (§5.4); the shared engine has no valuation kind, so the request runs as 'Material change' (Materials Manager) and the Controller applies it (request R-13).",
  "RD-MM-32": "Open GR/IR (GRN without invoice) per material is seeded here; invoice matching lives in purchasing. The BOM edges behind the where-used explosion are seeded here; the BOM is owned by engineering.",
  "RD-MM-33": "Import templates are exported and uploaded as CSV with the same columns as the PRD's XLSX templates (the prototype has no spreadsheet library). A first line carries the template name and version.",
  "RD-MM-34": "Consignment settlement posting is done by the Cost accountant or the Controller; a true-up to 5215 needs the Controller (§14.2). The shared engine has no kind for it.",
  "RD-MM-35": "Costing-run mark window dates and the second plant PL-TBD-02 are design values; DEC-07 is shown as a switch so the dormant screens can be exercised.",
  "RD-MM-36": "Statistical safety stock (Phase 2, flagged not in the current build): demand variation by XYZ class (X 0.25, Y 0.5, Z 0.9 of ADU) and the service levels per ABC class are design values.",
  "RD-MM-37": "Duplicate candidates carry a stored match score (the matching job is not modelled); the review threshold is 0.9 and the auto-flag 0.97 (Book IV §7.1).",
  "RD-MM-38": "Where-used impact lists come from the references held on the material (open POs, BOM lines, price rows, info records, source lists, plans); documents held only in other modules are listed from those references.",
  "RD-MM-40": "An engineering placeholder carries material group level 1 only; the steward's General task sets level 2 to Other so activation (V-MM-01) can pass, and the steward refines it afterwards.",
  "RD-MM-39": "De-Peg runs through the shared kind 'Reallocation of confirmed supply' (Sales Director); the PRD names the Sales Director and a reason but no kind of its own (§14.4).",
} as const
export type ExtReadingId = keyof typeof EXT_READINGS
export type AnyReadingId = ReadingId | ExtReadingId

// ============================================================================ valuation change (§5.4)
export const isPeriodStart = (iso: string) => iso.slice(8, 10) === "01"
const monthOf = (iso: string) => iso.slice(0, 7)
/** Fiscal period status of a date for the main legal entity (shared FISCAL_PERIODS); later months count as Open. */
export function periodStatus(iso: string) {
  const p = FISCAL_PERIODS.find((x) => x.entityId === "LE-TBD-10" && x.month === monthOf(iso))
  return p?.status ?? (monthOf(iso) > "2026-10" ? "Open" : "Hard Close")
}

export interface ValuationInput {
  fieldKey: "method" | "priceUnit"
  value: string
  apply: "Immediate" | "Effective-dated"
  effective?: string
}
export interface ValuationRowCheck {
  materialId: string
  old: string
  new: string
  error?: string
  warning?: string
}
/** Checks that apply to the whole change (period boundary, mark window), then per-row checks. */
export function checkValuation(d: MaterialsState, ids: string[], i: ValuationInput, today = TODAY) {
  const date = i.apply === "Immediate" ? today : i.effective ?? ""
  const global: string[] = []
  if (i.fieldKey === "method") {
    if (!date) global.push("Choose the effective date: a method change applies at a period boundary only (§5.4).")
    else if (!isPeriodStart(date)) global.push(`§5.4: a valuation method change is allowed at a period boundary only. ${date} is not the first day of a fiscal period; choose the first of the month.`)
    else if (periodStatus(date) !== "Open") global.push(`${date} falls in a ${periodStatus(date)} period; choose the first day of an Open period.`)
    else if (i.apply === "Effective-dated" && date <= today) global.push("An effective-dated change needs a future date.")
  } else {
    const w = d.x.markWindow
    if (date >= w.from && date <= w.to) global.push(`E-MM-22: the price unit cannot change inside the costing-run mark window (${w.from} to ${w.to}, ${w.run}). Choose a date after ${w.to}.`)
  }
  const rows: ValuationRowCheck[] = ids.map((id) => {
    const m = getMaterial(d, id)
    const v = d.views[id]
    const old = i.fieldKey === "method" ? (v?.method ?? "") : String(v?.priceUnit ?? "")
    const row: ValuationRowCheck = { materialId: id, old, new: i.value }
    if (!m || !v) return { ...row, error: "Material not found" }
    if (m.status === "Obsolete") return { ...row, error: "Obsolete materials are not changed" }
    if (!isValuated(m.type)) return { ...row, error: `${m.type} is not valuated` }
    if (old === i.value) return { ...row, error: "No change (new value equals current value)" }
    if (i.fieldKey === "method") {
      if ((m.type === "SEMI" || m.type === "FIN") && i.value !== "Standard") return { ...row, error: "§5.4: Standard is mandatory for make items" }
      if (i.value === "Standard") {
        if (m.stdCost == null && !v.futureStd) return { ...row, error: "§5.4: a released standard is required before Moving Average becomes Standard" }
        const open = d.x.grir.filter((g) => g.materialId === id)
        if (open.length) return { ...row, error: `§5.4: ${open.length} open goods receipt(s) without invoice (${open.map((g) => g.grnId).join(", ")}); match or clear them first` }
      } else {
        const open = d.x.grir.filter((g) => g.materialId === id)
        if (open.length) row.warning = `${open.length} open GRN without invoice: invoice price differences will book against the new MAV baseline`
      }
    } else if (!["1", "100", "1000"].includes(i.value)) return { ...row, error: "Price unit is 1, 100 or 1000" }
    return row
  })
  return { global, rows }
}

/** Revaluation delta and GL preview for the rows that pass (§5.4: conversion posts REVAL for the on-hand delta). */
export function revalueMethod(d: MaterialsState, ids: string[], to: "Standard" | "Moving Average", live: AcctRow[]) {
  const reval: ValuationChange["reval"] = ids.map((id) => {
    const m = getMaterial(d, id)!
    const qty = onHand(d, id)
    const cur = rateOf(d, id)
    const std = m.stdCost ?? d.views[id]?.futureStd ?? cur
    return to === "Standard"
      ? { materialId: id as Material["id"], qty, from: cur, to: std, delta: Math.round(qty * (std - cur) * 100) / 100 }
      : { materialId: id as Material["id"], qty, from: cur, to: cur, delta: 0, note: "On-hand revalues to the current standard as opening MAV; PPV baseline note recorded" }
  })
  const total = Math.round(reval.reduce((s, r) => s + r.delta, 0) * 100) / 100
  const vc = d.views[ids[0]]?.valuationClass
  const stock = resolveRow(live, "STOCK", vc)
  const rv = resolveRow(live, "REVAL", vc)
  const up = total >= 0
  const glDebit = up ? (stock?.drKey ?? "E-MM-21 gap: STOCK") : (rv?.drKey ?? "E-MM-21 gap: REVAL")
  const glCredit = up ? (rv?.crKey ?? "E-MM-21 gap: REVAL") : (stock?.crKey ?? "E-MM-21 gap: STOCK")
  return { reval, total, glDebit, glCredit }
}

// ============================================================================ duplicate merge (Book IV §7.1)
export interface UsageCounts {
  stockQty: number
  stockRows: number
  whereUsed: number
  openDocs: number
  infoRecords: number
  sourceRows: number
  priceRows: number
}
export function usageCounts(d: MaterialsState, id: string): UsageCounts {
  const wu = d.views[id]?.whereUsed ?? []
  return {
    stockQty: onHand(d, id),
    stockRows: d.stock.filter((r) => r.materialId === id && r.qty > 0).length,
    whereUsed: wu.length,
    openDocs: wu.filter((w) => /PO|SO|WO|Open|order/i.test(`${w.kind} ${w.ref}`)).length + d.mchs.filter((c) => c.rows.some((r) => r.materialId === id && !r.appliedAt) && ["Draft", "In approval", "Approved", "Scheduled"].includes(c.stage)).length,
    infoRecords: d.infoRecords.filter((x) => x.materialId === id).length,
    sourceRows: d.sourceList.filter((x) => x.materialId === id).length,
    priceRows: d.salesPrices.filter((x) => x.materialId === id).length,
  }
}
export interface MergeItem {
  kind: string
  ref: string
  action: string
  /** Resolved by the merge itself (stock, info records); otherwise a task raised for its owner. */
  auto: boolean
}
/** Unresolvable references block the merge with a worklist (Book IV §7.1). */
export function mergeBlockers(d: MaterialsState, loserId: string, survivorId: string): { ref: string; text: string }[] {
  const L = getMaterial(d, loserId)
  const S = getMaterial(d, survivorId)
  const out: { ref: string; text: string }[] = []
  if (!L || !S) return [{ ref: loserId, text: "Material not found" }]
  if (S.status !== "Active") out.push({ ref: S.id, text: `The survivor must be Active (it is ${S.status}).` })
  if (!["Active", "Restricted", "Blocked"].includes(L.status)) out.push({ ref: L.id, text: `A merge is a supersession: the loser must be Active, Restricted or Blocked (it is ${L.status}); withdraw its request instead.` })
  if (L.type !== S.type) out.push({ ref: L.id, text: `Material type differs (${L.type} against ${S.type}); type is immutable (V-MM-02).` })
  if (L.baseUom !== S.baseUom) out.push({ ref: L.id, text: `Base UoM differs (${L.baseUom} against ${S.baseUom}): stock cannot transfer batch by batch.` })
  if (L.batchFlag !== S.batchFlag) out.push({ ref: L.id, text: "Batch-managed flag differs (V-MM-03): changes only by supersession." })
  for (const r of d.mcrs.filter((x) => x.materialId === L.id && x.open)) out.push({ ref: r.id, text: `Open creation request ${r.id}: close it before merging.` })
  for (const c of d.countDocuments.filter((x) => x.status !== "Posted" && x.status !== "Void" && x.lines.some((l) => l.itemId === L.id))) out.push({ ref: c.id, text: `Count document ${c.id} (${c.status}) holds this material: post or void it first.` })
  for (const r of d.stock.filter((x) => x.materialId === L.id && x.qty > 0 && x.status === "Blocked" && x.batchId)) out.push({ ref: r.batchId!, text: `Batch ${r.batchId} is Blocked (${r.pegRef ?? "hold"}): genealogy continuity cannot be written until it is released.` })
  for (const c of d.mchs.filter((x) => x.rows.some((r) => r.materialId === L.id && !r.appliedAt) && ["Draft", "In approval", "Approved", "Scheduled"].includes(x.stage))) out.push({ ref: c.id, text: `Change request ${c.id} is pending on this material.` })
  if (L.blocks.some((b) => b.block === "Posting Block")) out.push({ ref: L.id, text: "Posting Block is set: stock cannot be moved." })
  return out
}
/** What the merge rewrites (§7.1): BOM lines via ECO tasks, price rows re-keyed with approval, info records merged keeping the best basis, stock transferred batch by batch. */
export function mergeWorklist(d: MaterialsState, loserId: string, survivorId: string): MergeItem[] {
  const out: MergeItem[] = []
  for (const w of d.views[loserId]?.whereUsed ?? []) if (/BOM/i.test(w.kind)) out.push({ kind: w.kind, ref: w.ref, action: `Rewrite to ${survivorId} through an ECO task`, auto: false })
  for (const ir of d.infoRecords.filter((x) => x.materialId === loserId)) {
    const twin = d.infoRecords.find((x) => x.materialId === survivorId && x.vendorId === ir.vendorId)
    out.push({ kind: "Info record", ref: ir.id, action: twin ? `Merge into ${twin.id} keeping the better basis; history retained` : `Re-point to ${survivorId}; history retained`, auto: true })
  }
  for (const p of d.salesPrices.filter((x) => x.materialId === loserId && x.status !== "Expired" && x.status !== "Rejected")) out.push({ kind: "Price row", ref: p.priceListId ?? p.customerId ?? p.id, action: `Re-key to ${survivorId} with approval`, auto: false })
  for (const r of d.sourceList.filter((x) => x.materialId === loserId && !x.blocked)) out.push({ kind: "Source list row", ref: r.vendorId, action: `Re-key to ${survivorId}`, auto: true })
  for (const s of d.stock.filter((x) => x.materialId === loserId && x.qty > 0)) out.push({ kind: "Stock", ref: s.batchId ?? s.bin, action: `Transfer ${s.qty} to ${survivorId} with a genealogy continuity event`, auto: true })
  return out
}

// ============================================================================ consignment settlement (§14.2)
/** IR basis valid at a withdrawal date, per base unit (self-billing price; a deviation at true-up posts to 5215). */
export function irBasisAt(d: MaterialsState, materialId: string, vendorId: string, on: string) {
  const ir = d.infoRecords.find((x) => x.materialId === materialId && x.vendorId === vendorId)
  if (!ir) return undefined
  const row = [...ir.priceRows].filter((r) => !r.pending && r.validFrom <= on && (!r.validTo || r.validTo >= on)).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
  return row ? { perUnit: row.price / (ir.priceUnit || 1), ir: ir.id, currency: ir.currency, row: row.id } : undefined
}

// ============================================================================ ownership (§14.1-14.3)
export const ownerOfBucket = (bucket: string, pegRef?: string) =>
  bucket === "Consignment" ? `Vendor ${pegRef ?? ""} until withdrawal` : bucket === "Customer Property" ? `Customer (${pegRef ?? ""})` : bucket === "At Subcontractor" ? `PE, held by ${pegRef ?? "subcontractor"}` : bucket === "SO-Pegged" ? `PE, pegged to ${pegRef ?? ""}` : bucket === "In-Transit" ? "PE, in transit" : "PE"
export const tagOwnerNote = (t: OwnershipTag) => (t.zeroCost ? "Zero cost: customer-supplied" : t.tag === "Consignment" ? "Vendor-owned until consumed" : "")

// ============================================================================ statistical safety stock (Book I A §10.2, Phase 2)
/** Standard normal quantiles for the offered service levels. */
export const Z_TABLE: { level: number; z: number }[] = [
  { level: 0.9, z: 1.2816 },
  { level: 0.95, z: 1.6449 },
  { level: 0.975, z: 1.96 },
  { level: 0.99, z: 2.3263 },
  { level: 0.995, z: 2.5758 },
]
export const zOf = (level: number) => Z_TABLE.reduce((best, x) => (Math.abs(x.level - level) < Math.abs(best.level - level) ? x : best)).z
const CV: Record<"X" | "Y" | "Z", number> = { X: 0.25, Y: 0.5, Z: 0.9 }
/** Suggested SS = Z(service level) x sigma(daily demand) x sqrt(lead time), capped for shelf-life items at (shelf life / 2) x ADU (W-SS-02). */
export function statSuggestion(r: SafetyStockRow, abc: AbcClass, xyz: "X" | "Y" | "Z" | undefined, levels: StatSafety["levels"]) {
  const level = levels[abc]
  const z = zOf(level)
  const sigma = Math.round(r.adu * CV[xyz ?? "Y"] * 100) / 100
  const raw = Math.ceil(z * sigma * Math.sqrt(r.ltDays))
  const cap = r.shelfLifeDays ? Math.round((r.shelfLifeDays / 2) * r.adu) : undefined
  const capped = cap != null && raw > cap
  return { suggested: capped ? cap! : raw, z, sigma, level, capped, raw }
}

// ============================================================================ SS-EX-01 and projection (§10.4)
export type SsExceptionKind = "Above max stock" | "Zero ADU (dead buffer)" | "Never breached in 12 months" | "Breached 3 or more times in 90 days" | "Above shelf-life cap (W-SS-02)"
export function ssExceptionKinds(r: SafetyStockRow): SsExceptionKind[] {
  const eff = ssEffective(r)
  const out: SsExceptionKind[] = []
  if (eff > r.maxStock) out.push("Above max stock")
  if (r.adu === 0 && eff > 0) out.push("Zero ADU (dead buffer)")
  if (r.breaches12m === 0 && eff > 0) out.push("Never breached in 12 months")
  if (r.breaches90 >= 3) out.push("Breached 3 or more times in 90 days")
  if (r.shelfLifeDays && eff > (r.shelfLifeDays / 2) * r.adu) out.push("Above shelf-life cap (W-SS-02)")
  return out
}
/** Weekly projected available balance for 12 weeks: available now, minus ADU x 7 each week (floored at zero: a stock-out), plus the open order landing at lead time. */
export function projection(r: SafetyStockRow, weeks = 12) {
  const start = available(r)
  const landWeek = Math.max(1, Math.ceil(r.ltDays / 7))
  const pts: { week: number; date: string; level: number }[] = []
  let level = start
  for (let w = 0; w <= weeks; w++) {
    if (w > 0) level = Math.max(0, level - r.adu * 7)
    if (r.onOrder && w === landWeek) level += r.onOrder
    const dt = new Date(`${TODAY}T00:00:00Z`)
    dt.setUTCDate(dt.getUTCDate() + w * 7)
    pts.push({ week: w, date: dt.toISOString().slice(0, 10), level: Math.round(level) })
  }
  return pts
}
export const crossings = (pts: { date: string; level: number }[], ss: number) => pts.filter((p, i) => p.level < ss && (i === 0 || pts[i - 1].level >= ss))

// ============================================================================ plant sourcing network exceptions (Book VII §4.4)
export function network(d: MaterialsState) {
  const { rows, lanes } = d.x.plantSrc
  return rows.flatMap((r) => {
    if (r.source !== "Transfer") return []
    const lane = lanes.find((l) => l.id === r.laneId)
    const out: { row: string; code: "EX-10"; text: string }[] = []
    if (!lane) out.push({ row: r.id, code: "EX-10", text: "Transfer source without a lane" })
    else if (!lane.active) out.push({ row: r.id, code: "EX-10", text: `Lane ${lane.id} is inactive` })
    const m = getMaterial(d, r.materialId)
    const supplyRow = rows.find((x) => x.materialId === r.materialId && x.plantId === r.fromPlant && x.source === "Own production")
    if (m && (m.type === "SEMI" || m.type === "FIN") && r.fromPlant && !supplyRow && !d.views[m.id]?.mbomRef) out.push({ row: r.id, code: "EX-10", text: `Supplying plant ${r.fromPlant} has no valid production version for ${m.id}` })
    return out
  })
}
