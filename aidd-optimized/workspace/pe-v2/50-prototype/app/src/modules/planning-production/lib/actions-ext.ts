// planning-production actions for the feature-list rows (12 October 2026): STO-001, scheduling
// masters, capture templates, labor export (IF-22), subcontract operations, scenarios, the
// confirmation-reversal dual sign-off, the oven batch confirm and the SP-13 nameplate check.
// Same contract as ./actions.ts: run inside store.mutate("planningProduction", ...), throw ProtoError to refuse.

import { ProtoError, type MutateCtx } from "@/store"
import { MATERIALS, TODAY, USERS } from "@/data/shared"
import type { Activity, ISODate, MaterialId, Role, UserId, WorkCenterId } from "@/data/domain"
import type { PPConfirmation, PPWorkOrder, PlanningProductionState } from "../data/types"
import type { CaptureField, CrewRoster, MaintWindow, Scenario, SetupFamily, StoLine, StoStatus, SubcontractOp, ToolRec, TransportOrder } from "../data/extra"
import { STO_PATH } from "../data/extra"
import { addWorkdays, allWorkCenters, schedule, TRANSIT_BUFFER_DAYS, type ScheduleResult } from "./plan"
import { completeOp, isOpenWo, post, reschedule, reverseConfirmation, revalidate, startOp, startedQty } from "./actions"
import { captureBlock, captureIssues, NAMEPLATE_KEY, needsNameplate, nameplateRemaining, publishedTemplateFor, verifiedSerials } from "./capture"
export * from "./capture"

type S = PlanningProductionState
const A = (ctx: MutateCtx, text: string, by?: string): Activity => ({ at: ctx.today as ISODate, by: by ?? ctx.role, text })
const userName = (id: string) => USERS.find((u) => u.id === id)?.name ?? id
const pad = (n: number, w: number) => String(n).padStart(w, "0")
const std = (id: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0
const nextNo = (ids: string[], prefix: string) => Math.max(0, ...ids.map((i) => Number(i.slice(prefix.length)) || 0)) + 1
const inRoles = (ctx: MutateCtx, roles: Role[]) => roles.includes(ctx.role as Role)

// ============================================================================ STO-001 (Book IX §4.3)
/** "Planners create, warehouses execute" [DOC:p.283 STO-001]. */
export const STO_PLANNER_ROLES: Role[] = ["Planner", "Planning Manager", "Production Scheduler"]
export const STO_WAREHOUSE_ROLES: Role[] = ["Warehouse operator", "Warehouse supervisor", "Receiving clerk", "Material steward"]

function stoOf(d: S, id: string) {
  const t = d.transportOrders.find((x) => x.id === id)
  if (!t) throw new ProtoError(`Transport order ${id} not found.`)
  return t
}
const stoLog = (t: TransportOrder, ctx: MutateCtx, text: string, by?: string) => t.activity.push(A(ctx, text, by))
export const stoOpen = (l: StoLine) => l.qty - l.receivedQty

export function createSto(d: S, ctx: MutateCtx, x: { laneId: string; priority: TransportOrder["priority"]; requiredBy: ISODate; lines: { materialId: MaterialId; qty: number; uom: string }[] }) {
  if (!inRoles(ctx, STO_PLANNER_ROLES)) throw new ProtoError("Planners create transport orders [DOC:p.283 STO-001]. Switch Acting as to Planner, Planning Manager or Production Scheduler.")
  const lane = d.lanes.find((l) => l.id === x.laneId)
  if (!lane) throw new ProtoError("Choose a lane.", "laneId")
  if (!lane.active) throw new ProtoError(`Lane ${lane.id} is inactive: it stops new transfer proposals (EX-10). Reactivate it in the lane master first.`, "laneId")
  if (!x.lines.length) throw new ProtoError("Add at least one line.", "lines")
  for (const [i, l] of x.lines.entries()) {
    if (!l.materialId) throw new ProtoError(`Line ${i + 1} needs a material.`, "lines")
    if (!(l.qty > 0)) throw new ProtoError(`Line ${i + 1} quantity must be more than zero.`, "lines")
  }
  if (x.requiredBy < ctx.today) throw new ProtoError("Required-by date cannot be in the past.", "requiredBy")
  const id = `STO-TBD-${pad(nextNo(d.transportOrders.map((t) => t.id), "STO-TBD-"), 4)}`
  const t: TransportOrder = {
    id, laneId: lane.id, fromPlant: lane.from, toPlant: lane.to, priority: x.priority, createdOn: ctx.today as ISODate, requiredBy: x.requiredBy, status: "Created", source: "Manual planner action", transitValue: 0,
    lines: x.lines.map((l, i) => ({ no: (i + 1) * 10, materialId: l.materialId, qty: l.qty, issuedQty: 0, receivedQty: 0, lots: [], uom: l.uom })), activity: [],
  }
  stoLog(t, ctx, `Created from the planner workbench on lane ${lane.id} (${lane.transitDays} transit days)`)
  d.transportOrders.unshift(t)
  return id
}

export function releaseSto(d: S, ctx: MutateCtx, id: string) {
  if (!inRoles(ctx, STO_PLANNER_ROLES)) throw new ProtoError("Planners release transport orders. Switch Acting as to a planning role.")
  const t = stoOf(d, id)
  if (t.status !== "Created") throw new ProtoError(`${id} is ${t.status}: only a Created order is released.`)
  const lane = d.lanes.find((l) => l.id === t.laneId)
  if (!lane?.active) throw new ProtoError(`Lane ${t.laneId} is inactive (EX-10): reactivate the lane or change sourcing before release.`)
  t.status = "Released"
  stoLog(t, ctx, "Released to the source warehouse for issue")
}

/** SP-06 at the source: item/batch/serial + from bin. The scanned batch or serial must be a real code
 *  (BAT-... or SN-...); the material is the line's. Issue posts DR 1350 In transit, CR 13xx at source. */
export function issueStoLine(d: S, ctx: MutateCtx, id: string, no: number, code: string, qty: number) {
  if (!inRoles(ctx, STO_WAREHOUSE_ROLES)) throw new ProtoError("Warehouses issue and receive transport orders [DOC:p.283 STO-001]. Switch Acting as to a warehouse role.")
  const t = stoOf(d, id)
  if (t.status !== "Released" && t.status !== "Issued") throw new ProtoError(`${id} is ${t.status}: issue is possible after Release.`)
  const l = t.lines.find((x) => x.no === no)
  if (!l) throw new ProtoError(`${id} has no line ${no}.`)
  if (!/^(BAT|SN)-TBD-[A-Z0-9-]+$/.test(code)) throw new ProtoError(`${code} is not a batch or serial label (expected BAT-TBD-... or SN-TBD-...).`, "scan")
  const b = d.batches.find((x) => x.id === code)
  if (b && b.materialId !== l.materialId) throw new ProtoError(`${code} is ${b.materialId}; line ${no} is ${l.materialId}.`, "scan")
  if (b && b.stock !== "Unrestricted") throw new ProtoError(`${code} is ${b.stock}: only Unrestricted stock can be transferred.`, "scan")
  if (!(qty > 0)) throw new ProtoError("Quantity must be more than zero.", "qty")
  if (l.issuedQty + qty > l.qty) throw new ProtoError(`Line ${no}: ${l.qty - l.issuedQty} ${l.uom} left to issue; you entered ${qty}.`, "qty")
  l.issuedQty += qty
  if (!l.lots.includes(code)) l.lots.push(code)
  t.transitValue += qty * std(l.materialId)
  t.issuedOn = ctx.today as ISODate
  if (t.lines.every((x) => x.issuedQty >= x.qty)) t.status = "Issued"
  stoLog(t, ctx, `Issued ${qty} ${l.uom} of ${l.materialId} from ${code} at ${t.fromPlant} (SP-06): DR 1350 In transit, CR 13xx`)
  ctx.emit("trace.eventRecorded", { code: "T04", doc: { type: "batch", id: code }, batch: code })
}

export function handToCarrier(d: S, ctx: MutateCtx, id: string) {
  if (!inRoles(ctx, STO_WAREHOUSE_ROLES)) throw new ProtoError("Warehouses execute transport orders. Switch Acting as to a warehouse role.")
  const t = stoOf(d, id)
  if (t.status !== "Issued") throw new ProtoError(`${id} is ${t.status}: hand over after every line is issued.`)
  t.status = "In Transit"
  stoLog(t, ctx, "Handed to the carrier; stock stays in bucket 1350 until receipt")
}

export function receiveStoLine(d: S, ctx: MutateCtx, id: string, no: number, code: string, qty: number) {
  if (!inRoles(ctx, STO_WAREHOUSE_ROLES)) throw new ProtoError("Warehouses issue and receive transport orders. Switch Acting as to a warehouse role.")
  const t = stoOf(d, id)
  if (t.status !== "In Transit" && t.status !== "Issued") throw new ProtoError(`${id} is ${t.status}: receipt is possible once stock is issued.`)
  const l = t.lines.find((x) => x.no === no)
  if (!l) throw new ProtoError(`${id} has no line ${no}.`)
  if (!l.lots.includes(code)) throw new ProtoError(`${code} was not issued on line ${no} (issued: ${l.lots.join(", ") || "nothing"}).`, "scan")
  if (!(qty > 0)) throw new ProtoError("Quantity must be more than zero.", "qty")
  if (l.receivedQty + qty > l.issuedQty) throw new ProtoError(`Line ${no}: only ${l.issuedQty - l.receivedQty} ${l.uom} are in transit.`, "qty")
  l.receivedQty += qty
  t.transitValue = Math.max(0, t.transitValue - qty * std(l.materialId))
  t.receivedOn = ctx.today as ISODate
  if (t.lines.every((x) => x.receivedQty >= x.qty)) t.status = "Received"
  stoLog(t, ctx, `Received ${qty} ${l.uom} of ${l.materialId} at ${t.toPlant} (SP-06): DR 13xx, CR 1350 In transit`)
  ctx.emit("trace.eventRecorded", { code: "T04", doc: { type: "batch", id: code }, batch: code })
}

export function closeSto(d: S, ctx: MutateCtx, id: string) {
  const t = stoOf(d, id)
  if (t.status !== "Received") throw new ProtoError(`${id} is ${t.status}: close after full receipt, or short-close with a reason.`)
  t.status = "Closed"
  t.closedOn = ctx.today as ISODate
  stoLog(t, ctx, "Closed")
}
export function shortCloseSto(d: S, ctx: MutateCtx, id: string, reason: string) {
  if (!inRoles(ctx, STO_PLANNER_ROLES)) throw new ProtoError("Short close is a planner decision. Switch Acting as to a planning role.")
  const t = stoOf(d, id)
  if (t.status === "Closed" || t.status === "Created" || t.status === "Released") throw new ProtoError(`${id} is ${t.status}: short close applies once stock has moved.`)
  if (!reason.trim()) throw new ProtoError("Short close needs a reason.", "reason")
  const open = t.lines.reduce((a, l) => a + Math.max(0, l.qty - l.receivedQty), 0)
  if (open <= 0) throw new ProtoError(`${id} is fully received: use Close.`)
  t.shortCloseReason = reason
  t.status = "Closed"
  t.closedOn = ctx.today as ISODate
  stoLog(t, ctx, `Short closed with ${open} open: ${reason}. ${t.transitValue > 0 ? `${t.transitValue.toFixed(2)} stays in bucket 1350 for the difference (the PRD names no write-off)` : ""}`.trim())
}

export function setLaneActive(d: S, ctx: MutateCtx, laneId: string, active: boolean) {
  const l = d.lanes.find((x) => x.id === laneId)
  if (!l) throw new ProtoError(`Lane ${laneId} not found.`)
  if (!inRoles(ctx, ["Planning Manager", "Planner"])) throw new ProtoError("Lanes are maintained by the Planning Manager (MP-LANE-001). Switch Acting as to Planning Manager.")
  l.active = active
  // EX-10 clears when its lane comes back
  if (active) for (const x of d.exceptions) if (x.code === "EX-10" && !x.resolved && x.detail.includes(laneId)) x.resolved = { action: "Reactivate lane", by: userName(ctx.userId), on: ctx.today as ISODate, note: `${laneId} reactivated` }
}

export const stoStep = (s: StoStatus) => STO_PATH.indexOf(s)

// ============================================================================ FX-PLN-CONSTRAINTS
export const FLOOR_SKILL_ROLES: Role[] = ["Operator", "Production supervisor", "Test technician"]
export function saveQualification(d: S, _ctx: MutateCtx, x: { id?: string; userId: UserId; skill: string; level: number; expires: ISODate }) {
  if (!x.skill.trim()) throw new ProtoError("Name the skill.", "skill")
  const u = USERS.find((y) => y.id === x.userId)
  if (!u) throw new ProtoError("Choose an operator.", "userId")
  if (!u.roles.some((r) => FLOOR_SKILL_ROLES.includes(r))) throw new ProtoError(`${u.name} is ${u.roles.join(", ")}: qualifications are held by floor roles.`, "userId")
  if (!(x.level >= 1 && x.level <= 5)) throw new ProtoError("Level is 1 to 5 (design scale).", "level")
  if (!x.expires) throw new ProtoError("Enter the expiry date.", "expires")
  if (x.id) {
    const q = d.qualifications.find((y) => y.id === x.id)
    if (!q) throw new ProtoError(`${x.id} not found.`)
    Object.assign(q, { userId: x.userId, skill: x.skill.trim(), level: x.level, expires: x.expires })
    return q.id
  }
  if (d.qualifications.some((q) => q.userId === x.userId && q.skill.toLowerCase() === x.skill.trim().toLowerCase())) throw new ProtoError(`${u.name} already holds ${x.skill}: renew that record instead.`, "skill")
  const id = `QAL-TBD-${pad(nextNo(d.qualifications.map((q) => q.id), "QAL-TBD-"), 4)}`
  d.qualifications.push({ id, userId: x.userId, skill: x.skill.trim(), level: x.level, expires: x.expires })
  return id
}
export function removeQualification(d: S, _ctx: MutateCtx, id: string) {
  const i = d.qualifications.findIndex((q) => q.id === id)
  if (i < 0) throw new ProtoError(`${id} not found.`)
  d.qualifications.splice(i, 1)
}

export function saveTool(d: S, _ctx: MutateCtx, x: Omit<ToolRec, "id"> & { id?: string }) {
  if (!x.name.trim()) throw new ProtoError("Name the tool.", "name")
  if (!x.wcIds.length) throw new ProtoError("Choose at least one work center.", "wcIds")
  if (!(x.qty >= 1)) throw new ProtoError("Quantity is at least 1.", "qty")
  if (x.id) {
    const t = d.tools.find((y) => y.id === x.id)
    if (!t) throw new ProtoError(`${x.id} not found.`)
    Object.assign(t, x)
    return t.id
  }
  const id = `TL-TBD-${pad(nextNo(d.tools.map((t) => t.id), "TL-TBD-"), 4)}`
  d.tools.push({ ...x, id })
  return id
}
export function removeTool(d: S, _ctx: MutateCtx, id: string) {
  d.tools = d.tools.filter((t) => t.id !== id)
}

export function saveSetupFamily(d: S, _ctx: MutateCtx, x: Omit<SetupFamily, "id"> & { id?: string }) {
  if (!x.name.trim()) throw new ProtoError("Name the family.", "name")
  if (!x.items.length) throw new ProtoError("Add at least one item.", "items")
  if (!(x.changeoverHours >= 0)) throw new ProtoError("Changeover hours cannot be negative.", "changeoverHours")
  const clash = d.setupFamilies.find((f) => f.id !== x.id && f.wcId === x.wcId && f.items.some((i) => x.items.includes(i)))
  if (clash) throw new ProtoError(`${clash.id} already holds ${clash.items.filter((i) => x.items.includes(i)).join(", ")} at ${x.wcId}: an item is in one family per work center.`, "items")
  if (x.id) {
    const f = d.setupFamilies.find((y) => y.id === x.id)
    if (!f) throw new ProtoError(`${x.id} not found.`)
    Object.assign(f, x)
    return f.id
  }
  const id = `SF-TBD-${pad(nextNo(d.setupFamilies.map((f) => f.id), "SF-TBD-"), 2)}`
  d.setupFamilies.push({ ...x, id })
  return id
}
export function removeSetupFamily(d: S, _ctx: MutateCtx, id: string) {
  d.setupFamilies = d.setupFamilies.filter((f) => f.id !== id)
}

export function saveCrew(d: S, _ctx: MutateCtx, x: Omit<CrewRoster, "id"> & { id?: string }) {
  if (!x.name.trim()) throw new ProtoError("Name the crew.", "name")
  if (!x.members.length) throw new ProtoError("A crew has at least one member.", "members")
  if (!x.members.includes(x.leadId)) throw new ProtoError("The lead must be a member of the crew.", "leadId")
  if (!(x.heads >= x.members.length)) throw new ProtoError(`Heads per shift (${x.heads}) cannot be fewer than the ${x.members.length} named members.`, "heads")
  const dup = d.crewRoster.find((c) => c.id !== x.id && c.active && x.active && c.wcId === x.wcId && c.shift === x.shift)
  if (dup) throw new ProtoError(`${dup.id} already covers ${x.wcId} on that shift: deactivate it or choose the other shift.`, "shift")
  if (x.id) {
    const c = d.crewRoster.find((y) => y.id === x.id)
    if (!c) throw new ProtoError(`${x.id} not found.`)
    Object.assign(c, x)
    return c.id
  }
  const id = `CRW-TBD-${pad(nextNo(d.crewRoster.map((c) => c.id), "CRW-TBD-"), 2)}`
  d.crewRoster.push({ ...x, id })
  return id
}
export function removeCrew(d: S, _ctx: MutateCtx, id: string) {
  d.crewRoster = d.crewRoster.filter((c) => c.id !== id)
}

/** A maintenance window removes the work center from the plan for its days; the finite engine
 *  re-plans, and a window inside the path of a pegged promise raises an at-risk record [DOC:p.71 §2; p.193 §4]. */
export function addMaintWindow(d: S, ctx: MutateCtx, x: { wcId: WorkCenterId; from: ISODate; to: ISODate; kind: MaintWindow["kind"]; note: string }) {
  if (!allWorkCenters(d).some((w) => w.id === x.wcId)) throw new ProtoError("Choose a work center.", "wcId")
  if (!x.from || !x.to) throw new ProtoError("Enter both dates.", "from")
  if (x.to < x.from) throw new ProtoError("The window ends before it starts.", "to")
  if (x.kind !== "Breakdown" && x.from < ctx.today) throw new ProtoError("A planned window cannot start in the past (record a breakdown instead).", "from")
  const clash = d.maintWindows.find((m) => m.wcId === x.wcId && (m.status === "Scheduled" || m.status === "In progress") && m.from <= x.to && x.from <= m.to)
  if (clash) throw new ProtoError(`${clash.id} already blocks ${x.wcId} from ${clash.from} to ${clash.to}.`, "from")
  if (!x.note.trim()) throw new ProtoError("Say what the window is for.", "note")
  const id = `MNT-TBD-${pad(nextNo(d.maintWindows.map((m) => m.id), "MNT-TBD-"), 4)}`
  d.maintWindows.push({ id, wcId: x.wcId, from: x.from, to: x.to, kind: x.kind, note: x.note, status: x.from <= ctx.today ? "In progress" : "Scheduled" })
  reschedule(d, ctx)
  return { id, atRisk: revalidate(d, ctx, "WC outage inside its path", `Maintenance window ${id} on ${x.wcId} (${x.from} to ${x.to})`) }
}
export function setMaintStatus(d: S, ctx: MutateCtx, id: string, status: MaintWindow["status"]) {
  const m = d.maintWindows.find((x) => x.id === id)
  if (!m) throw new ProtoError(`${id} not found.`)
  if (m.status === "Done" || m.status === "Cancelled") throw new ProtoError(`${id} is ${m.status}.`)
  m.status = status
  reschedule(d, ctx)
}

// ============================================================================ FX-PRD-CAPTURE
export function saveCaptureTemplate(d: S, ctx: MutateCtx, x: { id?: string; name: string; wcIds: WorkCenterId[]; fields: CaptureField[] }) {
  if (!x.name.trim()) throw new ProtoError("Name the template.", "name")
  if (!x.wcIds.length) throw new ProtoError("Choose the work centers it applies to.", "wcIds")
  if (!x.fields.length) throw new ProtoError("Add at least one field.", "fields")
  const labels = x.fields.map((f) => f.label.trim().toLowerCase())
  if (labels.some((l) => !l)) throw new ProtoError("Every field needs a label.", "fields")
  if (new Set(labels).size !== labels.length) throw new ProtoError("Field labels must be unique within a template.", "fields")
  for (const f of x.fields) {
    if (f.kind === "number" && f.min != null && f.max != null && f.min > f.max) throw new ProtoError(`${f.label}: the minimum is above the maximum.`, "fields")
    if (f.kind === "choice" && !(f.options?.length ?? 0)) throw new ProtoError(`${f.label}: a choice field needs options.`, "fields")
  }
  if (x.id) {
    const t = d.captureTemplates.find((y) => y.id === x.id)
    if (!t) throw new ProtoError(`${x.id} not found.`)
    if (t.status !== "Draft") throw new ProtoError(`${t.id} is ${t.status}: it is not edited in place. Create a new version.`)
    Object.assign(t, { name: x.name.trim(), wcIds: x.wcIds, fields: x.fields })
    t.activity.push(A(ctx, "Draft saved"))
    return t.id
  }
  const id = `CAP-TBD-${pad(nextNo(d.captureTemplates.map((t) => t.id), "CAP-TBD-"), 4)}`
  d.captureTemplates.push({ id, name: x.name.trim(), version: 1, status: "Draft", fields: x.fields, wcIds: x.wcIds, activity: [A(ctx, "Draft created")] })
  return id
}
export function newCaptureVersion(d: S, ctx: MutateCtx, id: string) {
  const t = d.captureTemplates.find((y) => y.id === id)
  if (!t) throw new ProtoError(`${id} not found.`)
  if (t.status !== "Published") throw new ProtoError(`${id} is ${t.status}: only a Published template is versioned.`)
  if (d.captureTemplates.some((y) => y.name === t.name && y.status === "Draft")) throw new ProtoError(`A draft of "${t.name}" already exists.`)
  const nid = `CAP-TBD-${pad(nextNo(d.captureTemplates.map((y) => y.id), "CAP-TBD-"), 4)}`
  d.captureTemplates.push({ id: nid, name: t.name, version: t.version + 1, status: "Draft", fields: t.fields.map((f) => ({ ...f })), wcIds: [...t.wcIds], activity: [A(ctx, `Draft version ${t.version + 1} created from ${t.id}`)] })
  return nid
}
export function publishCaptureTemplate(d: S, ctx: MutateCtx, id: string) {
  if (!inRoles(ctx, ["Manufacturing engineer", "Engineer", "Engineering Manager", "Quality engineer", "Quality Manager"])) throw new ProtoError("Capture templates are published by Engineering or Quality (design reading). Switch Acting as to Manufacturing engineer.")
  const t = d.captureTemplates.find((y) => y.id === id)
  if (!t) throw new ProtoError(`${id} not found.`)
  if (t.status !== "Draft") throw new ProtoError(`${id} is ${t.status}.`)
  const clash = d.captureTemplates.find((y) => y.id !== id && y.status === "Published" && y.name !== t.name && y.wcIds.some((w) => t.wcIds.includes(w)))
  if (clash) throw new ProtoError(`${clash.id} "${clash.name}" is already published for ${clash.wcIds.filter((w) => t.wcIds.includes(w)).join(", ")}: one published template per work center. Supersede it first.`, "wcIds")
  for (const y of d.captureTemplates) if (y.id !== id && y.name === t.name && y.status === "Published") (y.status = "Superseded"), y.activity.push(A(ctx, `Superseded by version ${t.version}`))
  t.status = "Published"
  t.effectiveFrom = ctx.today as ISODate
  t.activity.push(A(ctx, `Version ${t.version} published; terminals at ${t.wcIds.join(", ")} use it from the next operation opened`))
}
export function deleteCaptureDraft(d: S, _ctx: MutateCtx, id: string) {
  const t = d.captureTemplates.find((y) => y.id === id)
  if (!t || t.status !== "Draft") throw new ProtoError("Only a Draft is deleted; Published versions stay in history.")
  d.captureTemplates = d.captureTemplates.filter((y) => y.id !== id)
}

/** Terminal capture entry: validates against the published template for the work center. */
export function captureField(d: S, ctx: MutateCtx, woId: string, no: number, label: string, value: string) {
  const w = d.productionOrders.find((x) => x.id === woId)
  const o = w?.operations.find((x) => x.no === no)
  if (!w || !o) throw new ProtoError("Operation not found.")
  if (o.status !== "In Progress") throw new ProtoError(`Op ${no} is ${o.status}: start it before capturing data.`)
  const t = publishedTemplateFor(d, o.workCenterId)
  const next = { ...(o.capture ?? {}), [label]: value }
  const hard = captureIssues(t, next).find((i) => i.field.label === label && i.level === "hard")
  if (hard) throw new ProtoError(hard.text, label)
  o.capture = next
  void ctx
}
// ============================================================================ SP-13 nameplate (E-BC-06)
export function verifyNameplate(d: S, ctx: MutateCtx, woId: string, no: number, code: string) {
  const w = d.productionOrders.find((x) => x.id === woId)
  const o = w?.operations.find((x) => x.no === no)
  if (!w || !o) throw new ProtoError("Operation not found.")
  if (!needsNameplate(o)) throw new ProtoError(`Op ${no} has no nameplate step.`)
  if (o.status !== "In Progress") throw new ProtoError(`Op ${no} is ${o.status}: start it first.`)
  const left = nameplateRemaining(w, o)
  if (!left.length) throw new ProtoError("Every serial of this order is already verified.")
  if (!left.includes(code as never)) {
    const other = d.productionOrders.find((x) => x.id !== w.id && x.serials.includes(code as never))
    throw new ProtoError(`The nameplate reads ${code}${other ? ` (a serial of ${other.id})` : ""}; this order's serial${left.length > 1 ? "s are" : " is"} ${left.slice(0, 3).join(", ")}${left.length > 3 ? "…" : ""}.`, "E-BC-06")
  }
  o.capture = { ...(o.capture ?? {}), [NAMEPLATE_KEY]: [...verifiedSerials(o), code].join(", ") }
  w.activity.push(A(ctx, `Nameplate verification (SP-13) at op ${no}: ${code} matches the order serial`))
  return left.length - 1
}

// ============================================================================ oven batch confirm (WC-230 batch resource)
export const batchCandidates = (d: S, wcId: string) =>
  d.productionOrders.filter((w) => isOpenWo(w) && w.status !== "On Hold").flatMap((w) => w.operations.filter((o) => o.workCenterId === wcId && (o.status === "In Progress" || o.status === "Not Started") && !w.operations.some((p) => p.no < o.no && p.status !== "Completed" && p.status !== "Cancelled")).map((o) => ({ w, o })))

/** Start every selected operation in one oven load (SP-10 for each), within the cycle size. */
export function startBatch(d: S, ctx: MutateCtx, wcId: string, keys: string[], crew: UserId[]) {
  const wc = allWorkCenters(d).find((w) => w.id === wcId)
  if (!wc?.batchResource) throw new ProtoError(`${wcId} is not a batch resource.`)
  if (!keys.length) throw new ProtoError("Select the orders in this load.")
  if (wc.cycleSize && keys.length > wc.cycleSize) throw new ProtoError(`${wcId} holds ${wc.cycleSize} orders per cycle; ${keys.length} selected.`)
  for (const k of keys) {
    const [woId, no] = k.split("/")
    const o = d.productionOrders.find((x) => x.id === woId)?.operations.find((x) => x.no === Number(no))
    if (o?.status === "Not Started") startOp(d, ctx, woId, Number(no), crew)
  }
}
/** Confirm a whole oven load: shared cycle number and final moisture, each order confirmed at its started quantity. */
export function completeBatch(d: S, ctx: MutateCtx, wcId: string, keys: string[], x: { cycle: string; moisture: string; eventBase: string; hours?: Record<string, number> }) {
  const wc = allWorkCenters(d).find((w) => w.id === wcId)
  if (!wc?.batchResource) throw new ProtoError(`${wcId} is not a batch resource.`)
  if (!keys.length) throw new ProtoError("Select the orders to confirm.")
  if (!x.cycle.trim()) throw new ProtoError("Enter the cycle number printed on the oven chart.", "cycle")
  const m = Number(x.moisture)
  if (!Number.isFinite(m)) throw new ProtoError("Enter the final moisture as a number.", "moisture")
  for (const k of keys) {
    const [woId, no] = k.split("/")
    const w = d.productionOrders.find((y) => y.id === woId)
    const o = w?.operations.find((y) => y.no === Number(no))
    if (!w || !o) throw new ProtoError(`${k} not found.`)
    if (o.status !== "In Progress") throw new ProtoError(`${k} is ${o.status}: start the load first.`)
    o.capture = { ...(o.capture ?? {}), "Cycle #": x.cycle.trim(), "Final moisture (%)": String(m) }
    const block = captureBlock(d, o)
    if (block) throw new ProtoError(`${k}: ${block}`)
    const started = startedQty(w, o.no)
    const hrs = x.hours?.[k] ?? Math.round((o.setupHours + o.runHours) * o.crew * 10) / 10
    completeOp(d, ctx, woId, o.no, { good: started, scrap: 0, rework: 0, hours: hrs, eventUuid: `${x.eventBase}-${k}` })
  }
  return keys.length
}

// ============================================================================ FX-PRD-WODIALOGS: confirmation reversal dual sign-off
/** Supervisor requests, a second person signs [DOC:p.215 §7.2 "supervisor corrections ... with dual sign-off"].
 *  The PRD does not name the second signer's role: reading, one of these roles, never the requester. */
export const SECOND_SIGNER_ROLES: Role[] = ["Production Scheduler", "Planning Manager", "Cost accountant", "Controller", "Quality Manager"]

export function reversalBlock(d: Pick<S, "confirmations" | "productionOrders">, cnfId: string): string | null {
  const c = d.confirmations.find((x) => x.id === cnfId)
  if (!c) return `${cnfId} not found.`
  if (c.reversalOf) return `${cnfId} is itself a reversal.`
  if (c.reversedBy) return `${cnfId} was already reversed by ${c.reversedBy}.`
  const w = d.productionOrders.find((x) => x.id === c.woId)
  if (!w) return `${c.woId} not found.`
  if (!["Released", "In Progress", "Testing", "On Hold"].includes(w.status) || w.fgReceivedOn) return `${w.id} is ${w.status}${w.fgReceivedOn ? " and received to stock" : ""}: confirmations are corrected before FG receipt.`
  const later = w.operations.filter((x) => x.no > c.op && x.status !== "Not Started" && x.status !== "Cancelled")
  if (later.length) return `Op ${later[0].no} has started: reverse from the latest confirmation backwards.`
  return null
}
export function requestReversal(d: S, ctx: MutateCtx, cnfId: string, reason: string) {
  if (ctx.role !== "Production supervisor") throw new ProtoError("A confirmation correction is requested by a supervisor. Switch Acting as to Production supervisor.")
  if (!reason.trim()) throw new ProtoError("A correction needs a reason.", "reason")
  const block = reversalBlock(d, cnfId)
  if (block) throw new ProtoError(block)
  if (d.reversalRequests.some((r) => r.cnfId === cnfId && r.status === "Awaiting second sign-off")) throw new ProtoError(`${cnfId} already awaits a second sign-off.`)
  const c = d.confirmations.find((x) => x.id === cnfId)!
  const id = `RVR-TBD-${pad(nextNo(d.reversalRequests.map((r) => r.id), "RVR-TBD-"), 4)}`
  d.reversalRequests.push({ id, cnfId, woId: c.woId, reason, requestedBy: userName(ctx.userId), requestedById: ctx.userId, requestedOn: ctx.today as ISODate, status: "Awaiting second sign-off" })
  d.productionOrders.find((x) => x.id === c.woId)?.activity.push(A(ctx, `Reversal of ${cnfId} requested (${id}); posts only after a second sign-off: ${reason}`))
  return id
}
export function decideReversal(d: S, ctx: MutateCtx, id: string, sign: boolean, note: string) {
  const r = d.reversalRequests.find((x) => x.id === id)
  if (!r) throw new ProtoError(`${id} not found.`)
  if (r.status !== "Awaiting second sign-off") throw new ProtoError(`${id} is ${r.status}.`)
  if (ctx.userId === r.requestedById) throw new ProtoError("The second sign-off must come from a different person than the requester. Switch Acting as to another user.")
  if (!inRoles(ctx, SECOND_SIGNER_ROLES)) throw new ProtoError(`The second sign-off is given by ${SECOND_SIGNER_ROLES.join(", ")} (design reading: the PRD names no role). Switch Acting as.`)
  const w = d.productionOrders.find((x) => x.id === r.woId)
  if (!sign) {
    if (!note.trim()) throw new ProtoError("Say why the reversal is rejected.", "reason")
    r.status = "Rejected"
    r.signedBy = userName(ctx.userId)
    r.signedById = ctx.userId
    r.decisionNote = note
    w?.activity.push(A(ctx, `Reversal ${id} of ${r.cnfId} rejected: ${note}`))
    return
  }
  const block = reversalBlock(d, r.cnfId)
  if (block) throw new ProtoError(block)
  r.signedBy = userName(ctx.userId)
  r.signedById = ctx.userId
  r.decisionNote = note || undefined
  r.reversalId = postReversal(d, ctx, r.cnfId, `${r.reason} (requested by ${r.requestedBy}, signed by ${userName(ctx.userId)})`)
  r.status = "Signed and posted"
}

function postReversal(d: S, ctx: MutateCtx, cnfId: string, reason: string) {
  return reverseConfirmation(d, ctx, cnfId, reason, { userId: ctx.userId })
}

// ============================================================================ FX-PRD-LABOR (IF-22)
export interface LaborRow {
  cnfId: string
  woId: string
  op: number
  at: ISODate
  operators: { userId: string; hours: number }[]
  hours: number
  state: "Awaiting approval" | "Approved" | "Exported" | "Reversed" | "Correction"
  batchId?: string
  flags: string[]
  conf: PPConfirmation
}
export function laborRows(s: Pick<S, "confirmations" | "productionOrders" | "laborApprovals" | "laborBatches">): LaborRow[] {
  const approved = new Map(s.laborApprovals.map((a) => [a.cnfId, a]))
  const exported = new Map<string, string>()
  for (const b of s.laborBatches) if (b.status === "File generated") for (const id of b.cnfIds) exported.set(id, b.id)
  return s.confirmations
    .filter((c) => c.hours !== 0)
    .map((c) => {
      const w = s.productionOrders.find((x) => x.id === c.woId)
      const o = w?.operations.find((x) => x.no === c.op)
      const crew = o?.crewIds?.length === c.crewSize && c.crewSize > 0 ? o.crewIds : [c.operatorId]
      const operators = crew.map((u) => ({ userId: u, hours: Math.round((c.hours / crew.length) * 100) / 100 }))
      const flags: string[] = []
      if (c.supervisor) flags.push(`Outside the ±20% hours guard or scrap threshold: supervisor ${c.supervisor.by}`)
      if (c.offlineReplay) flags.push("Replayed from the offline queue")
      if (crew.length < c.crewSize || (o && o.crewIds.length !== c.crewSize)) flags.push(`Crew of ${c.crewSize} not fully recorded: hours go to the confirming operator`)
      const batchId = exported.get(c.id)
      const state: LaborRow["state"] = c.reversalOf ? (batchId ? "Exported" : "Correction") : c.reversedBy ? "Reversed" : batchId ? "Exported" : approved.has(c.id) ? "Approved" : "Awaiting approval"
      return { cnfId: c.id, woId: c.woId, op: c.op, at: c.at, operators, hours: c.hours, state, batchId, flags, conf: c }
    })
}
export function approveLabor(d: S, ctx: MutateCtx, cnfIds: string[]) {
  if (ctx.role !== "Production supervisor") throw new ProtoError("Labor confirmations are approved by the supervisor before export. Switch Acting as to Production supervisor.")
  const rows = laborRows(d)
  let n = 0
  for (const id of cnfIds) {
    const r = rows.find((x) => x.cnfId === id)
    if (!r) throw new ProtoError(`${id} not found.`)
    if (r.state === "Reversed") throw new ProtoError(`${id} was reversed: the reversal row nets it out.`)
    if (r.state !== "Awaiting approval") continue
    d.laborApprovals.push({ cnfId: id, by: userName(ctx.userId), on: ctx.today as ISODate })
    n++
  }
  if (!n) throw new ProtoError("Nothing to approve in the selection.")
  return n
}
function hashHex(s: string) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, "0")
}
export function generateLaborExport(d: S, ctx: MutateCtx, period: string) {
  if (!inRoles(ctx, ["Production supervisor", "Cost accountant", "Controlling analyst"])) throw new ProtoError("The IF-22 file is generated by the supervisor or Costing. Switch Acting as.")
  const rows = laborRows(d)
  const take = rows.filter((r) => r.at.startsWith(period) && (r.state === "Approved" || (r.state === "Correction" && rows.some((o) => o.conf.reversedBy === r.cnfId && o.state === "Exported"))))
  if (!take.length) throw new ProtoError(`No approved, unexported labor rows in ${period}. Approve confirmations first; corrections of exported rows export automatically.`)
  const id = `LBX-TBD-${pad(nextNo(d.laborBatches.map((b) => b.id), "LBX-TBD-"), 4)}`
  const body = take.map((r) => `${r.cnfId}|${r.woId}/${r.op}|${r.operators.map((o) => `${o.userId}:${o.hours}`).join(",")}`).join(";")
  d.laborBatches.push({ id, period, createdOn: ctx.today as ISODate, by: userName(ctx.userId), status: "File generated", cnfIds: take.map((r) => r.cnfId), hours: Math.round(take.reduce((a, r) => a + r.hours, 0) * 100) / 100, rows: take.reduce((a, r) => a + r.operators.length, 0), checksum: hashHex(body) })
  return id
}
export function csvOfBatch(s: Pick<S, "confirmations" | "productionOrders" | "laborApprovals" | "laborBatches">, batchId: string) {
  const b = s.laborBatches.find((x) => x.id === batchId)
  if (!b) return ""
  const rows = laborRows(s).filter((r) => b.cnfIds.includes(r.cnfId))
  const head = "batch,confirmation,work_order,operation,operator_id,operator,hours,confirmed_on"
  const lines = rows.flatMap((r) => r.operators.map((o) => [b.id, r.cnfId, r.woId, r.op, o.userId, `"${userName(o.userId)}"`, o.hours, r.at].join(",")))
  return [head, ...lines].join("\n")
}

// ============================================================================ FX-PRD-RECEIPT: subcontract (#34, #35)
export function sendSubcontract(d: S, ctx: MutateCtx, id: string, qty: number) {
  if (!inRoles(ctx, [...STO_WAREHOUSE_ROLES, "Production supervisor"])) throw new ProtoError("Material is issued to the vendor by the warehouse. Switch Acting as to a warehouse role.")
  const s = d.subcontracts.find((x) => x.id === id)
  if (!s) throw new ProtoError(`${id} not found.`)
  if (s.status === "Received") throw new ProtoError(`${id} is fully received.`)
  if (!(qty > 0)) throw new ProtoError("Quantity must be more than zero.", "qty")
  if (s.sentQty + qty > s.qty) throw new ProtoError(`${s.qty - s.sentQty} left to send; you entered ${qty}.`, "qty")
  const value = s.providedMaterial.reduce((a, m) => a + (m.value * qty) / s.qty, 0)
  post(d, ctx, 34, value, { type: "productionOrder", id: s.woId }, `Issue to subcontractor ${s.vendorId} (${s.poRef}): ${qty} × ${s.service}`, 0)
  s.sentQty += qty
  s.sentOn ??= ctx.today as ISODate
  s.status = "At vendor"
  s.activity.push(A(ctx, `Issued ${qty} to the vendor: #34 DR 1315 Subcontract at Vendor, CR 1310 (${value.toFixed(2)})`))
}
export function receiveSubcontract(d: S, ctx: MutateCtx, id: string, qty: number) {
  if (!inRoles(ctx, [...STO_WAREHOUSE_ROLES, "Production supervisor"])) throw new ProtoError("Receipt from the vendor is a warehouse step. Switch Acting as to a warehouse role.")
  const s = d.subcontracts.find((x) => x.id === id)
  if (!s) throw new ProtoError(`${id} not found.`)
  if (!(qty > 0)) throw new ProtoError("Quantity must be more than zero.", "qty")
  if (s.receivedQty + qty > s.sentQty) throw new ProtoError(`Only ${s.sentQty - s.receivedQty} are at the vendor; you entered ${qty}.`, "qty")
  const service = qty * s.unitPrice
  const material = s.providedMaterial.reduce((a, m) => a + (m.value * qty) / s.qty, 0)
  post(d, ctx, 35, service + material, { type: "productionOrder", id: s.woId }, `Subcontract receipt (${s.poRef}): ${qty} × ${s.service}; service ${service.toFixed(2)} at PO price plus ${material.toFixed(2)} provided material`, service + material)
  s.receivedQty += qty
  s.status = s.receivedQty >= s.qty ? "Received" : "Partly received"
  if (s.status === "Received") s.receivedOn = ctx.today as ISODate
  s.activity.push(A(ctx, `Received ${qty}: #35 DR 1320 WIP, CR 2110 GR/IR and 1315 (${(service + material).toFixed(2)}); price variance to 5260 posts at invoice`))
}
export const subOpen = (s: SubcontractOp) => s.qty - s.receivedQty

// ============================================================================ FX-PLN-SCENARIOS
export function createScenario(d: S, ctx: MutateCtx, x: { name: string; note: string; copyFrom?: string }) {
  if (!x.name.trim()) throw new ProtoError("Name the scenario.", "name")
  if (d.scenarios.some((s) => s.name.toLowerCase() === x.name.trim().toLowerCase())) throw new ProtoError(`A scenario named "${x.name}" exists.`, "name")
  if (d.scenarios.length >= 6) throw new ProtoError("Six scenarios at most (design value): delete one first.")
  const src = d.scenarios.find((s) => s.id === x.copyFrom)
  const id = `SCN-TBD-${pad(nextNo(d.scenarios.map((s) => s.id), "SCN-TBD-"), 2)}`
  d.scenarios.push({ id, name: x.name.trim(), note: x.note, createdBy: userName(ctx.userId), createdOn: ctx.today as ISODate, moves: src?.moves.map((m) => ({ ...m })) ?? [], extraHours: { ...(src?.extraHours ?? {}) }, expedite: [...(src?.expedite ?? [])], down: [...(src?.down ?? [])] })
  return id
}
export function updateScenario(d: S, _ctx: MutateCtx, id: string, patch: Partial<Pick<Scenario, "name" | "note" | "extraHours" | "expedite" | "down" | "moves">>) {
  const s = d.scenarios.find((x) => x.id === id)
  if (!s) throw new ProtoError(`${id} not found.`)
  if (s.baseline) throw new ProtoError("The live plan is the reference and is not edited.")
  Object.assign(s, patch)
}
export function moveInScenario(d: S, ctx: MutateCtx, id: string, key: string, notBefore: ISODate) {
  const s = d.scenarios.find((x) => x.id === id)
  if (!s || s.baseline) throw new ProtoError("Choose a what-if scenario.")
  const [woId, no] = key.split("/")
  const w = d.productionOrders.find((x) => x.id === woId)
  const o = w?.operations.find((x) => x.no === Number(no))
  if (!w || !o) throw new ProtoError(`${key} not found.`)
  if (o.status !== "Not Started") throw new ProtoError(`Op ${no} is ${o.status}: it cannot move.`)
  if (notBefore < ctx.today) throw new ProtoError("A move cannot go into the past.")
  s.moves = [...s.moves.filter((m) => m.key !== key), { key, notBefore }]
}
export function deleteScenario(d: S, _ctx: MutateCtx, id: string) {
  const s = d.scenarios.find((x) => x.id === id)
  if (!s) throw new ProtoError(`${id} not found.`)
  if (s.baseline) throw new ProtoError("The live plan cannot be deleted.")
  d.scenarios = d.scenarios.filter((x) => x.id !== id)
}
/** Plan for a scenario without touching the live schedule. */
export function scenarioPlan(d: Pick<S, "productionOrders" | "workCenters" | "wc" | "maintWindows">, sc: Scenario): ScheduleResult {
  const wc: S["wc"] = { ...d.wc }
  for (const [id, h] of Object.entries(sc.extraHours)) if (h > 0 && wc[id]) wc[id] = { ...wc[id], extraHoursPerDay: h }
  for (const id of sc.down) if (wc[id]) wc[id] = { ...wc[id], status: "Maintenance", maintenanceUntil: addWorkdays(TODAY as ISODate, 3) }
  const orders = d.productionOrders.map((o) => (sc.expedite.includes(o.id) ? { ...o, priority: 0, scheduleMode: "Forward" as const } : o))
  const nb: Record<string, ISODate> = {}
  for (const m of sc.moves) nb[m.key] = m.notBefore
  return schedule({ productionOrders: orders, workCenters: d.workCenters, wc, maintWindows: d.maintWindows }, nb)
}
export interface ScenarioMetrics {
  lateOrders: number
  unschedulable: number
  makespan: ISODate
  /** Pegged orders whose projected finish passes the promise less the transit buffer, with days late. */
  promisesLate: { woId: string; soId: string; daysLate: number }[]
  utilization: number
}
export function scenarioMetrics(d: Pick<S, "productionOrders" | "workCenters" | "wc" | "maintWindows">, r: ScheduleResult): ScenarioMetrics {
  const open = d.productionOrders.filter((w) => isOpenWo(w))
  const fin = (w: PPWorkOrder) => open.length ? w.operations.filter((o) => o.status !== "Cancelled").map((o) => r.dates[`${w.id}/${o.no}`]?.[1] ?? o.finish).sort().at(-1) ?? w.finish : w.finish
  let makespan = TODAY as ISODate
  const promisesLate: ScenarioMetrics["promisesLate"] = []
  for (const w of open) {
    const f = fin(w)
    if (f > makespan) makespan = f
    if (w.pegs.length && w.promiseDate) {
      const limit = addWorkdays(w.promiseDate, -TRANSIT_BUFFER_DAYS)
      if (f > limit) promisesLate.push({ woId: w.id, soId: w.pegs[0].soId, daysLate: Math.round((Date.parse(f) - Date.parse(limit)) / 86400000) })
    }
  }
  let hours = 0
  let cap = 0
  const wcs = allWorkCenters(d)
  for (const w of wcs) {
    for (const [day, h] of Object.entries(r.load[w.id] ?? {})) {
      if (day >= TODAY && day <= addWorkdays(TODAY as ISODate, 20)) hours += h
    }
    for (let i = 1; i <= 20; i++) {
      cap += (w.shifts * w.hoursPerShift * w.stations * w.efficiencyPct) / 100 + (w.extraHoursPerDay ?? 0)
    }
  }
  return { lateOrders: r.late.length, unschedulable: r.unschedulable.length, makespan, promisesLate, utilization: cap ? Math.round((hours / cap) * 100) : 0 }
}
