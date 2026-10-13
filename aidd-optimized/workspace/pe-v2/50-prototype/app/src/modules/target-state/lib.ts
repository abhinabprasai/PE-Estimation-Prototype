// Small helpers shared by the target-state pages.
import { CUSTOMERS, VENDORS, MATERIALS } from "@/data/shared"
import type { TargetStateState } from "./data/slice"

/** Next id for a record created here: PREFIX-TBD-nnnn (placeholder format, OQ-30). */
export function nid(d: TargetStateState, prefix: string) {
  d.seq += 1
  return `${prefix}-TBD-${String(d.seq + 3000).padStart(4, "0")}`
}
export const vendorName = (id: string) => VENDORS.find((v) => v.id === id)?.name ?? id
export const customerName = (id: string) => CUSTOMERS.find((c) => c.id === id)?.name ?? id
export const customerClass = (id: string) => CUSTOMERS.find((c) => c.id === id)?.class ?? "Utility"
export const matDesc = (id: string) => MATERIALS.find((m) => m.id === id)?.description ?? id
export const TODAY_TS = "2026-10-09"
export const NOW_TS = "2026-10-09 14:30"
export const money = (n: number, d = 0) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d }).format(n)
export const num = (n: number, d = 0) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`

// ---- shared between machine integration (Book IX §6) and maintenance (§8) ----
import { governedWc, type MaintState, type Mo } from "./data/maint"
export const OPEN_MO = ["Created", "Released", "In Progress", "On Hold"]
/** An open breakdown order against equipment governed by this work center (S-20: shows Maintenance status). */
export function openBreakdown(m: MaintState, wc: string): Mo | undefined {
  return m.orders.find((o) => o.type === "Breakdown" && OPEN_MO.includes(o.status) && (() => { const e = m.equipment.find((x) => x.id === o.equipmentId); return !!e && governedWc(e, m.equipment) === wc })())
}
export const wcStatusOf = (m: MaintState, wc: string): "Active" | "Maintenance" => (openBreakdown(m, wc) ? "Maintenance" : "Active")
/** Raise a breakdown order for a work center's governing machine (terminal hold reason "machine down" or a gateway hard down). Returns the order id; an open one is reused. */
export function raiseBreakdown(d: TargetStateState, wc: string, source: string, desc: string): { id: string; created: boolean } | null {
  const open = openBreakdown(d.maint, wc)
  if (open) return { id: open.id, created: false }
  const eq = d.maint.equipment.find((e) => e.workCenterId === wc && e.type === "Machine")
  if (!eq) return null
  d.maint.seq += 1
  const id = `MO-TBD-${String(d.maint.seq).padStart(4, "0")}`
  d.maint.orders.push({ id, type: "Breakdown", equipmentId: eq.id, desc, status: "Created", window: { from: TODAY_TS, to: TODAY_TS }, tasks: [{ text: "Diagnose and restore", hrs: 2, done: false }], parts: [], labor: [], permit: "", source })
  return { id, created: true }
}
