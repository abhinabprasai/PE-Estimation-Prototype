// Count rules used by the handheld and the Count Plan wizard (Book I Part A §7, p.36-37).
// The count documents belong to the materials slice (documents stay the system of record); these
// are the same thresholds the materials screens apply, kept here because a module may not import
// another module's files. Types are read off the shared slice registry, not imported.
import type { SliceStates } from "@/store"
import { MATERIALS } from "@/data/shared"
import { COUNT_RULES } from "./rules"

export type MatState = SliceStates["materials"]
export type CountDoc = MatState["countDocuments"][number]
export type CountLine = CountDoc["lines"][number]

export const finalQty = (l: CountLine) => l.thirdCount ?? l.recount ?? l.count
export function lineVar(l: CountLine) {
  const f = finalQty(l)
  if (f == null) return { qty: 0, value: 0, counted: false }
  const qty = f - (l.expected + l.interim)
  return { qty, value: qty * l.rate, counted: true }
}
/** Beyond ±2% or ±$500 on the line: recount is mandatory (p.37 §7.5). */
export function needsRecount(l: CountLine) {
  const { qty, value, counted } = lineVar(l)
  if (!counted) return false
  const base = l.expected + l.interim
  const pct = base === 0 ? (qty === 0 ? 0 : 100) : (Math.abs(qty) / base) * 100
  return pct > COUNT_RULES.recountPct || Math.abs(value) > COUNT_RULES.recountAmount
}
/** R-CNT-03: the recount differs from the first count by more than the threshold again. */
export function needsThirdCount(l: CountLine) {
  if (l.recount == null || l.count == null) return false
  const diff = l.recount - l.count
  const pct = l.count === 0 ? (diff === 0 ? 0 : 100) : (Math.abs(diff) / l.count) * 100
  return pct > COUNT_RULES.recountPct || Math.abs(diff * l.rate) > COUNT_RULES.recountAmount
}
export const rateOf = (d: MatState, id: string) => {
  const v = d.valuations.filter((x) => x.materialId === id).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
  const std = (MATERIALS.find((m) => m.id === id) ?? d.created.find((m) => m.id === id))?.stdCost
  if (v) return (v.method === "Standard" ? v.stdCost : v.mav) ?? std ?? 0
  return std ?? 0
}
export const abcOf = (d: MatState, itemId: string): "A" | "B" | "C" => d.views[itemId]?.abc ?? "A"
export const FREEZE_STATUSES = ["Generated", "Assigned", "Counting", "Submitted", "Recount", "Variance Review"] as const
export const freezingDoc = (docs: CountDoc[], warehouseId: string, bin: string) =>
  docs.find((c) => (FREEZE_STATUSES as readonly string[]).includes(c.status) && c.warehouseId === warehouseId && c.lines.some((l) => l.bin === bin))

/** What the counter's handheld receives: no Expected Qty and no variance, ever (p.37 §7.3, enforced
 *  where the data is built, not by hiding a column). Recount lines carry no first count. */
export interface CounterLine {
  no: number
  bin: string
  itemId: string
  batch?: string
  uom: string
  /** The quantity this counter entered (first count, or the recount in Recount). */
  entered?: number
  serialized: boolean
  scannedSerials: string[]
  unlisted: boolean
  confirmedEmpty: boolean
  movedDuringCount: boolean
}
export interface CounterDoc {
  id: string
  plan: string
  location: string
  status: CountDoc["status"]
  recount: boolean
  blind: boolean
  softFreeze: boolean
  lines: CounterLine[]
}
export function counterView(d: CountDoc): CounterDoc {
  const recount = d.status === "Recount"
  const src = recount ? d.lines.filter((l) => l.flags.includes("Recount Required") && !l.flags.includes("Third Count Required")) : d.lines
  return {
    id: d.id, plan: d.planId, location: d.location, status: d.status, recount, blind: d.blind, softFreeze: d.softFreeze,
    lines: src.map((l) => ({
      no: l.no, bin: l.bin, itemId: l.itemId, batch: l.batch, uom: l.uom, entered: recount ? l.recount : l.count, serialized: !!l.expectedSerials, scannedSerials: l.scannedSerials ?? [],
      unlisted: l.flags.includes("Unlisted Batch"), confirmedEmpty: !!l.confirmedEmpty, movedDuringCount: l.flags.includes("Moved During Count"),
    })),
  }
}

// ============================================================================ Generate Count Sheets (p.36 §7.1)
export type SheetBasis = "Zone" | "Aisle" | "Item group"
export interface SheetInput {
  warehouseId: string
  basis: SheetBasis
  /** Restrict to these material types (empty: all). */
  types: string[]
}
export interface SheetPreview {
  key: string
  label: string
  rows: MatState["stock"]
  bins: number
  value: number
}
const typeOf = (d: MatState, id: string) => (MATERIALS.find((m) => m.id === id) ?? d.created.find((m) => m.id === id))?.type ?? "?"
const countable = (d: MatState, warehouseId: string) =>
  d.stock.filter((r) => r.warehouseId === warehouseId && r.qty > 0 && r.bucket !== "Consignment" && r.bucket !== "Customer Property" && r.bucket !== "In-Transit")
export const unitKey = (basis: SheetBasis, d: MatState, r: MatState["stock"][number]) =>
  basis === "Zone" ? r.bin.charAt(0) : basis === "Aisle" ? r.bin.split("-").slice(0, 2).join("-") : typeOf(d, r.materialId)
export const unitLabel = (basis: SheetBasis, key: string) => (basis === "Zone" ? `Zone ${key}` : basis === "Aisle" ? `Aisle ${key}` : `Item group ${key}`)

export function previewSheets(d: MatState, i: SheetInput, rate: (id: string) => number) {
  const all = countable(d, i.warehouseId).filter((r) => !i.types.length || i.types.includes(typeOf(d, r.materialId)))
  const busy = all.filter((r) => freezingDoc(d.countDocuments, r.warehouseId, r.bin))
  const free = all.filter((r) => !busy.includes(r))
  const groups = new Map<string, MatState["stock"]>()
  for (const r of free) {
    const k = unitKey(i.basis, d, r)
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const units: SheetPreview[] = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => ({ key, label: unitLabel(i.basis, key), rows, bins: new Set(rows.map((r) => r.bin)).size, value: rows.reduce((a, r) => a + r.qty * rate(r.materialId), 0) }))
  return { units, skipped: busy.length, total: all.length }
}
