// Field service rules as functions over the slice draft, shared by the service order screens, the dispatch board,
// the mobile execution set and the van stock screen (Book IX §7.2). They throw ProtoError so a write is atomic.
import { ProtoError } from "@/store"
import type { TargetStateState } from "./data/slice"
import { COST_RATE, SERVICE_RATE, SVO_PATH, WARRANTY_RESERVE, costOf, hrsOf, listOf, openCost, travelMin, type FieldState, type Svo, type SvoStatus, type Tech } from "./data/field"

export const DAY_CAPACITY_H = 8
export const svoFamily = (s: SvoStatus) => ({ New: "draft", Triaged: "pending", Scheduled: "pending", Dispatched: "active", "On Site": "active", "Work Complete": "active", "Customer Signed": "pending", Settled: "done", Closed: "done" } as const)[s]
export const nextOf = (s: SvoStatus) => SVO_PATH[SVO_PATH.indexOf(s) + 1] as SvoStatus | undefined
export const quoteFor = (s: Svo) => Math.round(hrsOf(s) * SERVICE_RATE + s.parts.reduce((a, p) => a + p.qty * listOf(p.materialId), 0))
export const reserveUsed = (f: FieldState) =>
  Math.min(WARRANTY_RESERVE, f.svos.filter((v) => v.entitlement.basis === "Warranty" && (v.status === "Settled" || v.status === "Closed")).reduce((a, v) => a + (v.settlement ? (v.settlement.lines.find((l) => l.label === "Warranty reserve")?.amount ?? 0) : v.settledAmount), 0))

export interface AssignCheck { blocks: string[]; warns: string[] }
/** Skill, certification, territory and capacity guardrails for assigning a service order to a technician on a day. */
export function checkAssign(f: FieldState, v: Svo, t: Tech, date: string): AssignCheck {
  const blocks: string[] = [], warns: string[] = []
  if (t.status === "On leave") blocks.push(`${t.name} is on leave.`)
  for (const sk of new Set(v.tasks.map((x) => x.skill))) {
    const have = t.skills.find((x) => x.skill === sk)
    if (!have) blocks.push(`${t.name} does not hold the skill "${sk}" required by a task.`)
    else if (have.expires < date) blocks.push(`Certification ${have.cert} for "${sk}" expires ${have.expires}, before ${date}.`)
  }
  const tm = travelMin(t, v.region)
  if (!t.territory.includes(v.region)) warns.push(`Travel warning: ${v.region} is outside ${t.name}'s territory (${t.territory.join(", ")}); about ${Math.round(tm / 60)} h travel each way.`)
  const load = f.svos.filter((x) => x.id !== v.id && x.techId === t.id && x.date === date && x.status !== "Closed").reduce((a, x) => a + hrsOf(x) + travelMin(t, x.region) / 60, 0)
  const need = hrsOf(v) + tm / 60
  if (load + need > DAY_CAPACITY_H) blocks.push(`Capacity: ${t.name} has ${load.toFixed(1)} h booked on ${date}; this order needs ${need.toFixed(1)} h with travel (day is ${DAY_CAPACITY_H} h).`)
  if (v.entitlement.basis === "Billable" && !v.quote?.approved) warns.push("Billable: the customer must approve the quote before dispatch.")
  return { blocks, warns }
}
export function assign(d: TargetStateState, id: string, techId: string, date: string, startHr: number) {
  const v = d.field.svos.find((x) => x.id === id)
  const t = d.field.techs.find((x) => x.id === techId)
  if (!v || !t) throw new ProtoError("Service order or technician not found.")
  if (["Dispatched", "On Site", "Work Complete", "Customer Signed", "Settled", "Closed"].includes(v.status)) throw new ProtoError(`${v.id} is ${v.status}; it can no longer be rescheduled.`)
  if (v.status === "New") throw new ProtoError("Triage the order first: triage calls the entitlement service and sets the priority.")
  const c = checkAssign(d.field, v, t, date)
  if (c.blocks.length) throw new ProtoError(c.blocks[0])
  v.techId = techId; v.date = date; v.startHr = startHr; v.status = "Scheduled"
}
export function triage(d: TargetStateState, id: string) {
  const v = d.field.svos.find((x) => x.id === id)!
  if (v.status !== "New") throw new ProtoError(`${v.id} is already ${v.status}.`)
  v.status = "Triaged"
  if (v.entitlement.basis === "Billable" && !v.quote) v.quote = { amount: quoteFor(v), approved: false }
}
export function advance(d: TargetStateState, id: string, signedBy?: string) {
  const v = d.field.svos.find((x) => x.id === id)
  if (!v) throw new ProtoError("Service order not found.")
  const to = nextOf(v.status)
  if (!to) throw new ProtoError(`${v.id} is ${v.status}: nothing follows.`)
  if (to === "Triaged") return triage(d, id)
  if (to === "Scheduled") throw new ProtoError("Schedule it on the dispatch board or in the Schedule tab: it needs a technician and a day.")
  if (to === "Dispatched") {
    if (!v.techId || !v.date) throw new ProtoError("Assign a technician and a day first.")
    if (d.field.techs.find((t) => t.id === v.techId)?.status === "On leave") throw new ProtoError("The assigned technician is on leave: reassign before dispatch.")
    if (v.entitlement.basis === "Billable" && !v.quote?.approved) throw new ProtoError("Billable work needs the customer's approval of the quote, in writing or in the portal, before dispatch.")
  }
  if (to === "Work Complete") {
    if (v.hoursLogged <= 0) throw new ProtoError("No labor logged: start and stop the clock, or key the hours.")
    if (v.tasks.some((t) => !t.done)) throw new ProtoError("Every task must be done before the work is complete.")
  }
  if (to === "Customer Signed") {
    const who = (signedBy ?? v.signedBy ?? "").trim()
    if (!who) throw new ProtoError("The customer's signature is required: enter the signer's name.")
    v.signedBy = who
  }
  if (to === "Settled") return settle(d, id)
  if (to === "Closed" && Math.abs(openCost(v)) >= 0.01) throw new ProtoError(`Open cost of ${openCost(v).toFixed(2)} remains: a service order settles to zero before it closes.`)
  v.status = to
}
export function settle(d: TargetStateState, id: string) {
  const v = d.field.svos.find((x) => x.id === id)!
  if (v.status !== "Customer Signed") throw new ProtoError("Settlement needs a signed order.")
  const c = costOf(v)
  const lines: { label: string; amount: number }[] = []
  if (v.entitlement.basis === "Warranty") {
    const room = Math.max(0, WARRANTY_RESERVE - reserveUsed(d.field))
    const toReserve = Math.min(room, c.total)
    lines.push({ label: "Warranty reserve", amount: toReserve })
    if (c.total - toReserve > 0.005) lines.push({ label: "Warranty expense (overflow beyond the reserve)", amount: c.total - toReserve })
  } else if (v.entitlement.basis === "Contract") lines.push({ label: `Contract cost ${v.entitlement.ref}`, amount: c.total })
  else {
    lines.push({ label: "Service COGS", amount: c.total })
    lines.push({ label: "Service revenue (service invoice, at service rates)", amount: -(v.quote?.amount ?? quoteFor(v)) })
  }
  v.settlement = { origin: v.entitlement.basis, lines }
  v.settledAmount = c.total
  v.status = "Settled"
}
export function consumePart(d: TargetStateState, id: string, code: string) {
  const v = d.field.svos.find((x) => x.id === id)!
  if (!v.techId) throw new ProtoError("No technician on this order: parts come from the technician's van stock.")
  const line = d.field.van.find((l) => l.techId === v.techId && l.materialId === code.trim())
  if (!line) throw new ProtoError(`${code} is not stocked on this technician's van.`)
  if (line.onHand <= 0) throw new ProtoError(`The van is out of ${code}. Request a transfer on the van stock screen.`)
  const p = v.parts.find((x) => x.materialId === code.trim())
  if (!p) throw new ProtoError(`${code} is not planned on this order.`)
  if (p.used >= p.qty) throw new ProtoError(`The plan holds ${p.qty} of ${code}; ${p.used} already used.`)
  line.onHand -= 1; p.used += 1
}
export { COST_RATE }
