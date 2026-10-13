// Maintenance rules as functions over the slice draft (Book IX §8). Used by the equipment, plan, order, board and dashboard
// screens and by the machine-integration deltas. They throw ProtoError so every write is atomic.
import { ProtoError } from "@/store"
import type { TargetStateState } from "./data/slice"
import { TODAY_M, costCenterOf, governedWc, moCost, nextDue, stdCostOf, type Equipment, type MPlan, type Mo, type MoType } from "./data/maint"
import { NOW } from "./data/machine"

export const MO_OPEN = ["Created", "Released", "In Progress", "On Hold"]
export const MO_ALL = ["Created", "Released", "In Progress", "On Hold", "Completed", "Closed (TECO)", "Cancelled"]
export const moFamily = (s: string) => ({ Created: "draft", Released: "pending", "In Progress": "active", "On Hold": "blocked", Completed: "done", "Closed (TECO)": "done", Cancelled: "cancelled" } as Record<string, "draft" | "pending" | "active" | "blocked" | "done" | "cancelled">)[s] ?? "draft"
const addD = (iso: string, d: number) => new Date(new Date(iso + "T12:00:00Z").getTime() + d * 86400000).toISOString().slice(0, 10)
export const overlaps = (a: { from: string; to: string }, b: { from: string; to: string }) => a.from <= b.to && b.from <= a.to

/** Keep the equipment window reserved as blocked capacity while the order is open (visible to the scheduler before publishing). */
export function syncBlock(d: TargetStateState, mo: Mo) {
  const e = d.maint.equipment.find((x) => x.id === mo.equipmentId)
  const wc = e ? governedWc(e, d.maint.equipment) : undefined
  d.maint.blocked = d.maint.blocked.filter((b) => b.moId !== mo.id)
  if (wc && MO_OPEN.includes(mo.status)) d.maint.seq += 1, d.maint.blocked.push({ id: `BLK-TBD-${String(d.maint.seq).padStart(4, "0")}`, equipmentId: mo.equipmentId, wc, from: mo.window.from, to: mo.window.to, moId: mo.id })
}
export function conflictOf(d: TargetStateState, mo: Mo) {
  const e = d.maint.equipment.find((x) => x.id === mo.equipmentId)
  const wc = e ? governedWc(e, d.maint.equipment) : undefined
  return wc ? d.maint.prod.find((p) => p.wc === wc && overlaps(p, mo.window)) : undefined
}
export function newMo(d: TargetStateState, p: { type: MoType; equipmentId: string; desc: string; from: string; to: string; tasks: { text: string; hrs: number }[]; permit?: string; source: string; planId?: string; parts?: { materialId: string; qty: number }[] }): Mo {
  d.maint.seq += 1
  const mo: Mo = { id: `MO-TBD-${String(d.maint.seq).padStart(4, "0")}`, type: p.type, equipmentId: p.equipmentId, desc: p.desc, status: "Created", window: { from: p.from, to: p.to }, tasks: p.tasks.map((t) => ({ ...t, done: false })), parts: (p.parts ?? []).map((x) => ({ ...x, issued: 0 })), labor: [], permit: p.permit ?? "", source: p.source, planId: p.planId }
  d.maint.orders.push(mo)
  syncBlock(d, mo)
  return mo
}
export function moAdvance(d: TargetStateState, id: string, to: string, reason?: string) {
  const mo = d.maint.orders.find((x) => x.id === id)
  if (!mo) throw new ProtoError("Maintenance order not found.")
  const from = mo.status
  const ok: Record<string, string[]> = { Created: ["Released", "Cancelled"], Released: ["In Progress", "On Hold", "Cancelled"], "In Progress": ["Completed", "On Hold"], "On Hold": ["In Progress", "Cancelled"], Completed: ["Closed (TECO)"] }
  if (!ok[from]?.includes(to)) throw new ProtoError(`${id} is ${from}: it cannot move to ${to}.`)
  if (to === "Released" && mo.tasks.length === 0) throw new ProtoError("Add at least one task before release.")
  if (to === "Completed") {
    if (mo.tasks.some((t) => !t.done)) throw new ProtoError("Every task must be done before the order is completed.")
    if (mo.labor.reduce((s, l) => s + l.hrs, 0) <= 0) throw new ProtoError("No labor booked: log the hours worked.")
  }
  if (to === "On Hold" && !reason?.trim()) throw new ProtoError("A reason is required to hold an order.")
  if (to === "Cancelled") {
    if (mo.parts.some((p) => p.issued > 0)) throw new ProtoError("Parts are already issued to this order: complete it, or return the parts first.")
    if (!reason?.trim()) throw new ProtoError("A reason is required to cancel an order.")
  }
  const e = d.maint.equipment.find((x) => x.id === mo.equipmentId)!
  if (to === "Completed" && mo.type === "Breakdown") {
    if (!e.failures.some((f) => f.moId === mo.id)) e.failures.push({ start: `${mo.window.from} 08:00`, end: NOW, moId: mo.id })
    const wc = governedWc(e, d.maint.equipment)
    if (wc) {
      for (const t of d.machine.downtime) if (t.wc === wc && !t.end) { t.end = NOW; t.moId = t.moId ?? mo.id }
      const ms = d.machine.states.find((s) => s.wc === wc)
      if (ms && ms.state === "down") { ms.state = "run"; ms.since = NOW }
    }
  }
  if (to === "Closed (TECO)") {
    const c = moCost(mo)
    mo.settled = { at: TODAY_M, amount: c.total }
    if (mo.planId) {
      const pl = d.maint.plans.find((x) => x.id === mo.planId)
      if (pl) { pl.lastDone = TODAY_M; if (pl.cycle.kind === "Counter") pl.lastCounter = pl.cycle.unit === "hours" ? e.hours : e.cycles }
    }
  }
  if (to === "On Hold") mo.source = `${mo.source}; hold: ${reason}`
  mo.status = to
  syncBlock(d, mo)
}
export function issuePart(d: TargetStateState, id: string, materialId: string) {
  const mo = d.maint.orders.find((x) => x.id === id)!
  if (!["Released", "In Progress"].includes(mo.status)) throw new ProtoError(`Parts issue only to a Released or In Progress order; ${id} is ${mo.status}.`)
  const p = mo.parts.find((x) => x.materialId === materialId)
  if (!p) throw new ProtoError(`${materialId} is not reserved on this order.`)
  if (p.issued >= p.qty) throw new ProtoError(`The reservation of ${p.qty} is fully issued.`)
  const e = d.maint.equipment.find((x) => x.id === mo.equipmentId)!
  const sp = e.spares.find((x) => x.materialId === materialId)
  if (sp) {
    if (sp.qty <= 0) throw new ProtoError(`No ${materialId} in the spares stock for ${e.name}: the reorder point ${sp.reorderPoint} has been passed and the spare is on order.`)
    sp.qty -= 1
  }
  p.issued += 1
}
export function logLabor(d: TargetStateState, id: string, who: string, hrs: number) {
  const mo = d.maint.orders.find((x) => x.id === id)!
  if (!["In Progress", "Released"].includes(mo.status)) throw new ProtoError(`Labor books to an In Progress order; ${id} is ${mo.status}.`)
  if (!(hrs > 0 && hrs <= 24)) throw new ProtoError("Hours must be more than 0 and at most 24.")
  mo.labor.push({ who: who.trim() || "Maintenance crew", hrs })
}
/** Preventive plans generate orders inside the planning horizon and reserve the window as blocked capacity. */
export function generatePreventive(d: TargetStateState, planIds?: string[]): string[] {
  const made: string[] = []
  for (const p of d.maint.plans) {
    if (p.status !== "Active" || (planIds && !planIds.includes(p.id))) continue
    const e = d.maint.equipment.find((x) => x.id === p.equipmentId)!
    const due = nextDue(p, e).date
    if (due > addD(TODAY_M, p.horizonDays)) continue
    if (d.maint.orders.some((o) => o.planId === p.id && o.status !== "Cancelled" && o.window.from > p.lastDone)) continue
    const from = due < TODAY_M ? TODAY_M : due
    const mo = newMo(d, { type: "Preventive", equipmentId: p.equipmentId, desc: p.name, from, to: addD(from, Math.max(0, Math.ceil(p.tasks.reduce((s, t) => s + t.hrs, 0) / 8) - 1)), tasks: p.tasks, source: `Plan ${p.id}`, planId: p.id, parts: p.tasks.flatMap((t) => t.parts) })
    made.push(mo.id)
  }
  return made
}
export const planOverdue = (p: MPlan, e: Equipment) => nextDue(p, e).date < TODAY_M
export const eqTree = (all: Equipment[]) => {
  const out: { e: Equipment; depth: number }[] = []
  const walk = (parent: string | undefined, depth: number) => { for (const e of all.filter((x) => x.parentId === parent)) { out.push({ e, depth }); walk(e.id, depth + 1) } }
  walk(undefined, 0)
  return out
}
export const costCenter = (d: TargetStateState, e: Equipment) => costCenterOf(e, d.maint.equipment)
export { stdCostOf }
