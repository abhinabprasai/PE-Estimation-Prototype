// planning-production actions. Every function runs inside `store.mutate("planningProduction", ...)`
// on a draft and throws ProtoError to refuse (the write is then atomic: nothing changes).
// Rules cite the specification where it gives them; anything marked "design" is a prototype value
// shown on screen with a Design value chip and listed in the group README "Readings".

import { ProtoError, type MutateCtx } from "@/store"
import { MATERIALS, USERS, TODAY } from "@/data/shared"
import type { DocRef, ISODate, MaterialId, OrderType, ProductionOrderId, RecallStage, SalesOrderId, SerialNo, TemplateNo, UserId, WorkCenterId, WorkCenterStatus } from "@/data/domain"
import { newWorkOrder, routingIdFor } from "../data/seed"
import { gatePassed, type AtRiskRecord, type AtRiskTrigger, type CancelDisposition, type ExCode, type InspectionResult, type JournalEntry, type MrpException, type PPPlannedOrder, type PPReworkOrder, type PPRouting, type PPWorkOrder, type PlanningProductionState, type PromiseCandidate, type WcOverride } from "../data/types"
import { canRelease, closeChecks, releaseGates, shortages } from "./gates"
import { addCalDays, addWorkdays, allWorkCenters, applySchedule, escalateLate, freezeDaysOf, freezeEnd, laborRateOf, ohRateOf, opKey, projected, round2, schedule, SHIP_PREP_DAYS, stdTotal, TRANSIT_BUFFER_DAYS, variances, woWip } from "./plan"
import { runCtp } from "./ctp"

type S = PlanningProductionState
const A = (ctx: MutateCtx, text: string, by?: string) => ({ at: ctx.today as ISODate, by: by ?? ctx.role, text })
const std = (id: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0
const userName = (id: string) => USERS.find((u) => u.id === id)?.name ?? id
const pad = (n: number, w: number) => String(n).padStart(w, "0")
const next = (d: S) => ++d.seq
/** Confirmation IDs continue after the highest one in use (seeded IDs run in the 204xx-205xx range). */
const newCnfId = (d: S) => `CNF-TBD-${Math.max(next(d) + 20000, ...d.confirmations.map((c) => Number(c.id.slice(8)) + 1 || 0))}` as S["confirmations"][number]["id"]

export const OPEN_WO = ["Created", "Released", "In Progress", "Testing", "On Hold"] as const
export const isOpenWo = (w: PPWorkOrder) => (OPEN_WO as readonly string[]).includes(w.status)

/** Soft reservation life for an accepted quote promise: "decaying reservation, config 14 days"
 *  [DOC:p.193 Book III E §4] (asserted). PRD default, configurable. */
export const SOFT_RESERVATION_DAYS = 14
/** Scrap beyond this share of the started quantity needs a supervisor plus a reason [DOC:p.179 FL-04 f13]
 *  (asserted). The threshold value is not given: 5% is a design value (any scrap on a single unit exceeds it). */
export const SCRAP_SUPERVISOR_PCT = 0.05
/** Manual labor entry guardrail: within ±20% of crew × elapsed [DOC:p.76 §6.1]; the prototype checks against standard (design). */
export const LABOR_GUARD = 0.2
/** Scrap reason codes (design list; the PRD requires a reason code, not the list). */
export const SCRAP_REASONS = ["SR-01 Material defect", "SR-02 Lamination burr out of tolerance", "SR-03 Winding fault", "SR-04 Handling damage", "SR-05 Test failure, not repairable"]
export const HOLD_REASONS = ["Material", "Machine down", "Quality", "Drawing question"] as const

function wo(d: S, id: string) {
  const w = d.productionOrders.find((x) => x.id === id)
  if (!w) throw new ProtoError(`Production order ${id} not found.`)
  return w
}
function opOf(w: PPWorkOrder, no: number) {
  const o = w.operations.find((x) => x.no === no)
  if (!o) throw new ProtoError(`${w.id} has no operation ${no}.`)
  return o
}

/** One posting through the shared Posting Service: journal row + `posting.posted` for numbered templates. */
export function post(d: S, ctx: MutateCtx, template: JournalEntry["template"], amount: number, source: DocRef, detail: string, wip1320: number, wip1325 = 0, extra: Partial<JournalEntry> = {}) {
  const e: JournalEntry = { id: `JE-TBD-${pad(next(d) + 4000, 4)}`, template, amount: round2(amount), date: ctx.today as ISODate, period: ctx.today.slice(0, 7), source, detail, wip1320: round2(wip1320), wip1325: round2(wip1325), ...extra }
  d.journal.push(e)
  if (typeof template === "number") ctx.emit("posting.posted", { template: template as TemplateNo, amount: Math.abs(e.amount), currency: "USD", source })
  return e
}

/** Re-run the finite scheduler over every open order (same inputs give the same plan). Late pegged
 *  orders auto-escalate priority [DOC:p.74 §5.1], then the plan is computed once more. */
export function reschedule(d: S, ctx?: MutateCtx) {
  let r = schedule(d, {})
  applySchedule(d.productionOrders, r)
  if (escalateLate(d.productionOrders, r, (ctx?.today ?? TODAY) as ISODate).length) {
    r = schedule(d, {})
    applySchedule(d.productionOrders, r)
  }
  return r
}
const isDoneOp = (o: { status: string }) => o.status === "Completed" || o.status === "Cancelled"

// ============================================================================ MRP (PP-MRP-001, PLO-001)
export const orderTypeFor = (item: string, pegged: boolean): PPWorkOrder["orderType"] =>
  item === "FIN-TBD-20MVA" ? "ETO" : item === "FIN-TBD-7500MTO" ? "MTO" : item.startsWith("SEMI-") ? "Component" : pegged ? "MTO" : "MTS"

export function runMrpNetChange(d: S, ctx: MutateCtx) {
  return mrpRun(d, ctx, "Net change (on demand)")
}
/** Regenerative run on demand (the nightly run, started by hand): unfirmed proposals are re-planned
 *  from their need dates; firmed planned orders survive unchanged [DOC:p.72 §3.3] (asserted). */
export function runMrpRegenerative(d: S, ctx: MutateCtx) {
  return mrpRun(d, ctx, "Regenerative (nightly)")
}
function mrpRun(d: S, ctx: MutateCtx, kind: S["mrpRuns"][number]["kind"]) {
  const id = `MRP-TBD-${Math.max(1009, ...d.mrpRuns.map((r) => Number(r.id.slice(8)) || 0)) + 1}` as S["mrpRuns"][number]["id"]
  if (kind === "Regenerative (nightly)") {
    for (const p of d.plannedOrders.filter((p) => p.state === "Proposed" || p.state === "Firmed")) {
      if (p.firmed) {
        p.activity.push(A(ctx, `Survived regenerative run ${id}: firmed date ${p.finish} and quantity ${p.qty} kept`, "System"))
        continue
      }
      const make = p.kind === "make"
      const start = addWorkdays(p.finish, make ? -15 : -10)
      const moved = start !== p.start
      p.start = start < (TODAY as ISODate) ? (TODAY as ISODate) : start
      p.mrpRunId = id
      p.activity.push(A(ctx, `Re-planned by regenerative run ${id}${moved ? `: start ${p.start}` : ": unchanged"} (not firmed)`, "System"))
    }
  }
  // EX-07 re-evaluation for make proposals [DOC:p.72 §3.2]
  for (const p of d.plannedOrders.filter((p) => p.kind === "make" && (p.state === "Proposed" || p.state === "Firmed"))) {
    const missing = !p.mbomActive || !p.routingReleased
    const open = d.exceptions.find((x) => x.code === "EX-07" && x.supply?.id === p.id && !x.resolved)
    if (missing && !open) d.exceptions.push(newEx(d, "EX-07", p.materialId, p.start, p.qty, `Make item without an active MBOM or released routing (MBOM ${p.mbomActive ? "Active" : "not active"}, routing ${p.routingReleased ? "Released" : "not released"})`, { supply: { type: "plannedOrder", id: p.id }, peg: p.peg, runId: id }))
    if (!missing && open) open.resolved = { action: "Cleared by run", by: "System", on: ctx.today as ISODate, note: `${id}: MBOM and routing now released` }
  }
  const openEx = d.exceptions.filter((x) => !x.resolved).length
  d.mrpRuns.unshift({ id, kind, scope: kind === "Net change (on demand)" ? "Plant PL-TBD-01, changed items since last run" : "Plant PL-TBD-01, all items (started on demand)", startedAt: `${ctx.today}T${new Date().toISOString().slice(11, 19)}`, minutes: kind === "Net change (on demand)" ? 2 : 14, snapshotId: `INS-SNAP-${ctx.today.replaceAll("-", "")}-${pad(d.mrpRuns.length + 1, 2)}`, plannedOrders: d.plannedOrders.filter((p) => p.state === "Proposed" || p.state === "Firmed").length, exceptions: openEx, by: userName(ctx.userId), published: true })
  return id
}

function newEx(d: S, code: ExCode, itemId: MaterialId, needDate: ISODate, qty: number, detail: string, extra: Partial<MrpException> = {}): MrpException {
  const m = MATERIALS.find((x) => x.id === itemId)
  return { id: `EXC-TBD-${next(d)}`, code, runId: d.mrpRuns[0]?.id ?? "MRP-TBD-1009", itemId, needDate, qty, raisedOn: TODAY as ISODate, detail, buy: m ? m.type !== "FIN" && m.type !== "SEMI" : true, ...extra }
}

export function firmPlanned(d: S, ctx: MutateCtx, ids: string[], firm: boolean) {
  for (const id of ids) {
    const p = d.plannedOrders.find((x) => x.id === id)
    if (!p) throw new ProtoError(`${id} not found.`)
    if (p.state !== "Proposed" && p.state !== "Firmed") throw new ProtoError(`${id} is ${p.state}: only open proposals can be ${firm ? "firmed" : "unfirmed"}.`)
    p.firmed = firm
    p.state = firm ? "Firmed" : "Proposed"
    p.activity.push(A(ctx, firm ? "Firmed: date and quantity locked; survives the next regenerative run" : "Firm flag removed: the next run may change it"))
  }
}

export function cancelPlanned(d: S, ctx: MutateCtx, ids: string[], reason: string) {
  if (!reason.trim()) throw new ProtoError("Enter a reason to cancel proposals.", "reason")
  for (const id of ids) {
    const p = d.plannedOrders.find((x) => x.id === id)
    if (!p) throw new ProtoError(`${id} not found.`)
    if (p.state !== "Proposed" && p.state !== "Firmed") throw new ProtoError(`${id} is ${p.state}: it cannot be cancelled.`)
    p.state = "Cancelled"
    p.firmed = false
    p.cancelReason = reason
    p.activity.push(A(ctx, `Cancelled proposal: ${reason}`))
    for (const x of d.exceptions.filter((x) => x.supply?.id === id && !x.resolved)) x.resolved = { action: "Cancel proposal", by: userName(ctx.userId), on: ctx.today as ISODate, note: reason }
  }
}

/** Convert proposals: make items become Created production orders, buy items purchase requisitions
 *  (MRP PRs, pre-approved by policy on the purchasing side). Pegs and the run ID are preserved. */
export function convertPlanned(d: S, ctx: MutateCtx, ids: string[]) {
  const out: DocRef[] = []
  // buy proposals: one PR per vendor (per lot sizing the proposal quantities are kept as lines)
  // [DOC:p.72 §3.3 "buy → PR grouped by vendor per lot-sizing"] (asserted)
  const prByVendor = new Map<string, string>()
  const vendorKey = (p: PPPlannedOrder) => p.vendorHint?.match(/VEN-[A-Z]+-\d+/)?.[0] ?? "no source"
  for (const id of ids) {
    const p = d.plannedOrders.find((x) => x.id === id)
    if (!p) throw new ProtoError(`${id} not found.`)
    if (p.state !== "Proposed" && p.state !== "Firmed") throw new ProtoError(`${id} is ${p.state}: only open proposals convert.`)
    let to: DocRef
    if (p.kind === "make") {
      const woId = `WO-2026-${pad(next(d), 5)}` as ProductionOrderId
      const w = newWorkOrder(d.wc, { id: woId, item: p.materialId, qty: p.qty, orderType: orderTypeFor(p.materialId, !!p.peg), priority: p.peg ? 5 : 12, created: ctx.today as ISODate, start: p.start, by: ctx.role, peg: p.peg, plannedOrderId: p.id })
      const rid = routingIdFor(p.materialId)
      const rel = d.routings.find((r) => r.id === rid && r.status === "Released")
      w.routingRev = p.routingReleased && rel ? rel.rev : w.routingRev
      w.gateInputs.mbomActive = p.mbomActive
      if (p.mbomId) w.activity.push(A(ctx, `MBOM ${p.mbomId} ${p.mbomActive ? "Active" : "not active yet (release gate 1 will stop it)"}`, "System"))
      w.activity[0].text += `; MRP run ${p.mrpRunId} logged`
      w.dueDate = p.finish
      d.productionOrders.push(w)
      to = { type: "productionOrder", id: woId }
    } else {
      const vk = vendorKey(p)
      if (!prByVendor.has(vk)) prByVendor.set(vk, `PR-TBD-${pad(next(d), 4)}`)
      to = { type: "requisition", id: prByVendor.get(vk)! }
    }
    p.state = "Converted"
    p.convertedTo = to.id as PPPlannedOrder["convertedTo"]
    p.activity.push(A(ctx, `Converted to ${to.id}${p.kind === "buy" ? ` (grouped by vendor ${vendorKey(p)})` : ""}; pegs preserved; run ID ${p.mrpRunId} logged`))
    for (const x of d.exceptions.filter((x) => x.supply?.id === id && !x.resolved && x.code !== "EX-07")) x.resolved = { action: p.kind === "make" ? "Create WO" : "Create PR", by: userName(ctx.userId), on: ctx.today as ISODate }
    ctx.emit("planning.plannedOrderConverted", { plannedOrderId: p.id, to })
    if (!out.some((r) => r.id === to.id)) out.push(to)
  }
  reschedule(d, ctx)
  return out
}

/** One-click action per exception type [DOC:p.72 §3.2] (asserted). */
export function resolveException(d: S, ctx: MutateCtx, exId: string, note = "") {
  const x = d.exceptions.find((e) => e.id === exId)
  if (!x) throw new ProtoError(`${exId} not found.`)
  if (x.resolved) throw new ProtoError(`${exId} was already handled (${x.resolved.action}).`)
  const by = userName(ctx.userId)
  const done = (action: string, n = note) => (x.resolved = { action, by, on: ctx.today as ISODate, note: n || undefined })
  const linkedPlo = x.supply?.type === "plannedOrder" ? d.plannedOrders.find((p) => p.id === x.supply!.id && (p.state === "Proposed" || p.state === "Firmed")) : undefined
  switch (x.code) {
    case "EX-01": {
      if (linkedPlo) {
        const [to] = convertPlanned(d, ctx, [linkedPlo.id])
        done(to.type === "productionOrder" ? "Create WO" : "Create PR", `${to.id} from ${linkedPlo.id}`)
      } else {
        const p = newPlanned(d, ctx, x.itemId, x.qty, x.needDate, x.peg)
        const [to] = convertPlanned(d, ctx, [p.id])
        done(to.type === "productionOrder" ? "Create WO" : "Create PR", `${to.id} via ${p.id}`)
      }
      return x
    }
    case "EX-02":
    case "EX-06":
      ctx.emit("planning.expediteRequested", { itemId: x.itemId, supply: x.supply, needDate: x.needDate, exceptionId: x.id })
      done("Expedite", note || "Written to the PO Expedite Board (PUR-EXP-001)")
      return x
    case "EX-03":
      if (x.supply?.type === "productionOrder") {
        const w = d.productionOrders.find((o) => o.id === x.supply!.id)
        const first = w?.operations.find((o) => o.status === "Not Started")
        if (w && first) {
          first.notBefore = addWorkdays(x.needDate, -15)
          w.activity.push(A(ctx, `Rescheduled out from MRP ${x.id}: first open op not before ${first.notBefore}`))
          reschedule(d)
        }
        done("Push out (WO reschedule)")
      } else done("Push out (PO change proposal)", note || "PO change proposal to the buyer")
      return x
    case "EX-04":
      if (linkedPlo) cancelPlanned(d, ctx, [linkedPlo.id], `EX-04 excess (${x.id})`)
      done("Cancel proposal")
      return x
    case "EX-05": {
      const p = newPlanned(d, ctx, x.itemId, x.qty, x.needDate)
      done("Raise supply proposal", `${p.id}`)
      return x
    }
    case "EX-07":
      ctx.emit("planning.engineeringExceptionOpened", { itemId: x.itemId, reason: x.detail, exceptionId: x.id })
      done("Open Engineering exception", note || "Sent to engineering; clears when the MBOM is activated and the routing released")
      return x
    case "EX-08":
      if (!note.trim()) throw new ProtoError("Inside the planning fence the planner decides with a reason.", "reason")
      done("Planner decision", note)
      return x
    case "EX-09":
      ctx.emit("planning.sourcingRequested", { itemId: x.itemId, exceptionId: x.id })
      done("Start RFQ / AVL qualification (buyer)")
      return x
  }
}

function newPlanned(d: S, ctx: MutateCtx, materialId: MaterialId, qty: number, needDate: ISODate, peg?: PPPlannedOrder["peg"]) {
  const m = MATERIALS.find((x) => x.id === materialId)
  const make = m?.type === "FIN" || m?.type === "SEMI"
  const p: PPPlannedOrder = {
    id: `PLO-TBD-${pad(next(d), 4)}` as PPPlannedOrder["id"], materialId, qty, kind: make ? "make" : "buy", state: "Proposed", firmed: false,
    start: addWorkdays(needDate, make ? -15 : -10), finish: needDate, mrpRunId: d.mrpRuns[0]?.id ?? "MRP-TBD-1009", peg, mbomActive: true, routingReleased: true,
    activity: [A(ctx, `Proposed from planner action (${d.mrpRuns[0]?.id ?? "MRP"})`)],
  }
  d.plannedOrders.unshift(p)
  return p
}

/** EX-02 / EX-06 "Expedite / re-date" [DOC:p.72 §3.2]: the confirmed supply date moves. A slip on a
 *  pegged supply is a revalidation trigger [DOC:p.193 §4]. */
export function redateSupply(d: S, ctx: MutateCtx, exId: string, newDate: ISODate, note: string) {
  const x = d.exceptions.find((e) => e.id === exId)
  if (!x) throw new ProtoError(`${exId} not found.`)
  if (x.resolved) throw new ProtoError(`${exId} was already handled (${x.resolved.action}).`)
  if (x.code !== "EX-02" && x.code !== "EX-06") throw new ProtoError("Re-date applies to EX-02 and EX-06 supply.")
  if (!newDate) throw new ProtoError("Enter the new confirmed supply date.", "date")
  const slipped = !x.supplyDate || newDate > x.supplyDate
  x.supplyDate = newDate
  x.resolved = { action: "Re-date", by: userName(ctx.userId), on: ctx.today as ISODate, note: `Supply re-dated to ${newDate}${note ? `. ${note}` : ""}` }
  return slipped && newDate > x.needDate ? onSupplySlip(d, ctx, { itemId: x.itemId, supply: x.supply, newDate, soId: x.peg?.soId }) : []
}

/** Supply slip on a pegged PO: operations consuming the item wait for the new date; the pegged
 *  promises revalidate [DOC:p.193 §4] (asserted). */
export function onSupplySlip(d: S, ctx: MutateCtx, x: { itemId: string; supply?: DocRef; newDate: ISODate; soId?: string }) {
  const hit = d.productionOrders.filter((w) => isOpenWo(w) && w.pegs.length && (x.soId ? w.pegs.some((g) => g.soId === x.soId) : true) && w.operations.some((o) => o.status === "Not Started" && o.components.some((c) => c.materialId === x.itemId && c.issued < c.qtyPerUnit * w.qty)))
  for (const w of hit) {
    const o = w.operations.find((o) => o.status === "Not Started" && o.components.some((c) => c.materialId === x.itemId))!
    o.notBefore = x.newDate > (o.notBefore ?? "") ? x.newDate : o.notBefore
    w.activity.push(A(ctx, `Supply slip: ${x.itemId}${x.supply ? ` on ${x.supply.id}` : ""} now ${x.newDate}; op ${o.no} not before that date`, "System"))
  }
  if (!hit.length) return []
  reschedule(d, ctx)
  return revalidate(d, ctx, "Supply slip on a pegged PO", `${x.itemId}${x.supply ? ` ${x.supply.id}` : ""} re-dated to ${x.newDate}`, hit.map((w) => w.id))
}

/** ECO affecting the order (engineering.ecoReleased): the orders of the affected items, BOMs or
 *  routings revalidate [DOC:p.193 §4] (asserted). */
export function onEcoReleased(d: S, ctx: MutateCtx, ecoId: string, affected: DocRef[]) {
  const ids = new Set(affected.map((a) => a.id))
  const hit = d.productionOrders.filter((w) => isOpenWo(w) && (ids.has(w.id) || ids.has(w.itemId) || ids.has(w.routingId) || w.pegs.some((g) => ids.has(g.soId)) || d.plannedOrders.some((p) => p.convertedTo === w.id && ((p.mbomId && ids.has(p.mbomId)) || (p.ebomId && ids.has(p.ebomId))))))
  for (const w of hit) w.activity.push(A(ctx, `ECO ${ecoId} affects this order: promise revalidated`, "System"))
  return hit.length ? revalidate(d, ctx, "ECO affecting the order", `ECO ${ecoId}`, hit.map((w) => w.id)) : []
}

// ============================================================================ Schedule (SCH-BOARD)
export function openSandbox(d: S, ctx: MutateCtx) {
  if (d.sandbox) throw new ProtoError("A what-if sandbox is already open.")
  d.sandbox = { moves: [], openedOn: new Date().toISOString().slice(0, 19), by: userName(ctx.userId) }
}
export function discardSandbox(d: S) {
  d.sandbox = null
}
/** Reschedule inside guardrails [DOC:p.193 §3] (asserted): completed and running operations do not
 *  move; inside the freeze horizon a move needs a reason; the finite engine keeps sequence and capacity. */
export function moveOp(d: S, ctx: MutateCtx, woId: string, no: number, notBefore: ISODate, reason: string) {
  if (!d.sandbox) throw new ProtoError("Open the what-if sandbox first: moves are published with a diff.")
  const w = wo(d, woId)
  const o = opOf(w, no)
  if (o.status !== "Not Started") throw new ProtoError(`Op ${no} is ${o.status}: it cannot move.`)
  if (!isOpenWo(w)) throw new ProtoError(`${woId} is ${w.status}.`)
  if (notBefore < TODAY) throw new ProtoError("A move cannot go into the past.")
  const fe = freezeEnd(TODAY as ISODate, freezeDaysOf(d, o.workCenterId))
  if (notBefore < fe || o.start < fe) {
    if (ctx.role !== "Production Scheduler") throw new ProtoError(`Inside the freeze horizon of ${o.workCenterId} (to ${fe}) a change needs Production Scheduler action with a reason [DOC:p.193 §3]. Switch Acting as to Production Scheduler.`)
    if (!reason.trim()) throw new ProtoError(`Inside the freeze horizon (to ${fe}) a move needs a reason.`, "reason")
  }
  const key = opKey(woId, no)
  d.sandbox.moves = [...d.sandbox.moves.filter((m) => m.key !== key), { key, notBefore, reason: reason || undefined, by: userName(ctx.userId) }]
}
export function sandboxPlan(d: Pick<S, "productionOrders" | "workCenters" | "wc" | "sandbox">) {
  const nb: Record<string, ISODate> = {}
  for (const m of d.sandbox?.moves ?? []) nb[m.key] = m.notBefore
  return schedule(d, nb)
}
export function publishSchedule(d: S, ctx: MutateCtx, note: string) {
  const moves = d.sandbox?.moves ?? []
  for (const m of moves) {
    const [woId, no] = m.key.split("/")
    const o = d.productionOrders.find((w) => w.id === woId)?.operations.find((x) => x.no === Number(no))
    if (o) o.notBefore = m.notBefore
  }
  d.moves.push(...moves)
  const prev = d.publishes.at(-1)
  const r = reschedule(d, ctx)
  const changed = Object.entries(r.dates).filter(([k, v]) => prev?.dates[k] && prev.dates[k][1] !== v[1]).length
  const snapshotId = `SNP-TBD-${pad(42 + d.publishes.length - 2, 4)}`
  d.publishes.push({ snapshotId, publishedOn: new Date().toISOString().slice(0, 19), by: userName(ctx.userId), moves: moves.length, note: note || `${moves.length} move(s), ${changed} operation date change(s)`, dates: Object.fromEntries(Object.entries(r.dates)) })
  d.sandbox = null
  ctx.emit("planning.schedulePublished", { snapshotId, moves: moves.length })
  revalidate(d, ctx, "Schedule publish moved its operations", `Publish ${snapshotId}`)
  return snapshotId
}

/** Automatic revalidation [DOC:p.193 §5] (asserted): a pegged order whose projected completion passes
 *  the promise minus the transit buffer raises an at-risk record. */
export function revalidate(d: S, ctx: MutateCtx, trigger: AtRiskTrigger, cause: string, only?: string[]) {
  const raised: string[] = []
  for (const w of d.productionOrders.filter((x) => isOpenWo(x) && x.pegs.length && x.promiseDate && (!only || only.includes(x.id)))) {
    const proj = projected(w)
    const limit = addCalDays(w.promiseDate!, -TRANSIT_BUFFER_DAYS)
    if (proj <= limit) {
      if (only) w.activity.push(A(ctx, `Revalidation (${trigger.toLowerCase()}): projected ${proj} holds the promise ${w.promiseDate}`, "System"))
      continue
    }
    const peg = w.pegs[0]
    if (d.atRisk.some((a) => a.soId === peg.soId && a.line === peg.line && a.state !== "Resolved")) continue
    const p = d.promises.find((x) => x.doc.type === "salesOrder" && x.doc.id === peg.soId)
    const late = [...w.operations].filter((o) => o.status !== "Completed").sort((a, b) => b.finish.localeCompare(a.finish))[0]
    const wc = late ? allWorkCenters(d).find((x) => x.id === late.workCenterId) : undefined
    const rec: AtRiskRecord = {
      id: `ARK-TBD-${pad(next(d), 4)}`, soId: peg.soId, line: peg.line, customerId: p?.customerId ?? "CUS-TBD-0000", itemId: w.itemId, woIds: [w.id], promiseDate: w.promiseDate!, projected: proj,
      trigger, cause: `${cause}: projected ${proj} vs promise ${w.promiseDate} less ${TRANSIT_BUFFER_DAYS} days transit buffer`, raisedOn: ctx.today as ISODate, state: "Open",
      options: [
        { id: "overtime", label: `Overtime shift on ${late?.workCenterId ?? "the binding work center"}`, projected: addWorkdays(proj, -4), note: "Production Scheduler books the crew" },
        wc?.alternate ? { id: "alternate", label: `Alternate work center ${wc.alternate.wcId}`, projected: addWorkdays(proj, -2), note: `${wc.alternate.efficiencyPct}% efficiency` } : { id: "alternate", label: "Alternate work center", projected: proj, note: `${late?.workCenterId ?? "This work center"} has no alternate in its capacity model` },
        { id: "partial", label: "Partial ship", projected: proj, note: w.qty > 1 ? "Ship the finished units first" : "Single unit: not applicable" },
        { id: "repromise", label: "Re-promise through a sales change order", projected: addWorkdays(proj, TRANSIT_BUFFER_DAYS), note: "Promise changes only through the change order path" },
      ],
      decisions: [A(ctx, `Revalidation: ${trigger.toLowerCase()} (${cause})`, "System")],
    }
    d.atRisk.unshift(rec)
    raised.push(rec.id)
    ctx.emit("planning.atRiskRaised", { soId: peg.soId, line: peg.line, projected: proj, trigger })
  }
  return raised
}

// ============================================================================ CTP (CTP-DLG)
export function runPromise(d: S, ctx: MutateCtx, id: string) {
  const c = d.promises.find((p) => p.id === id)
  if (!c) throw new ProtoError(`${id} not found.`)
  if (c.quoteType === "Budgetary") throw new ProtoError("A Budgetary quote quotes lead-time bands without CTP [DOC:p.193 §4]. Make the quote Firm to run the check.")
  if (c.decision === "Accepted" && c.reservation?.kind === "Firm") throw new ProtoError("The promise is confirmed (firm load). A new date goes through the sales change order path.")
  c.result = runCtp(d, c, {})
  c.decision = "Result ready"
  c.log.push(A(ctx, `CTP run: ship ${c.result.shipDate} (binding: ${c.result.binding}); ${c.result.ms} ms`))
  return c.result
}
export function decidePromise(d: S, ctx: MutateCtx, id: string, decision: "Accepted" | "Declined" | "Planner review", opts: { optionIdx?: number; note?: string } = {}) {
  const c = d.promises.find((p) => p.id === id)
  if (!c) throw new ProtoError(`${id} not found.`)
  if (c.quoteType === "Budgetary") throw new ProtoError("A Budgetary quote carries a lead-time band, not a promise: nothing to accept or reserve.")
  if (!c.result) throw new ProtoError("Run the check first: there is no result to decide on.")
  if (c.decision === "Accepted" || c.decision === "Declined") throw new ProtoError(`The promise was already ${c.decision.toLowerCase()}.`)
  if (decision === "Planner review" && !opts.note?.trim()) throw new ProtoError("Say what the planner should look at.", "reason")
  const opt = opts.optionIdx != null ? c.result.options[opts.optionIdx] : undefined
  const ship = opt?.shipDate ?? c.result.shipDate
  if (decision === "Accepted") {
    if (opt && opt.note.startsWith("Not feasible")) throw new ProtoError("That option is not feasible: pick the earliest date or another option.")
    const firm = c.doc.type === "salesOrder"
    c.reservation = firm ? { kind: "Firm", on: ctx.today as ISODate, snapshotId: c.result.snapshotId } : { kind: "Soft", on: ctx.today as ISODate, expires: addCalDays(ctx.today as ISODate, SOFT_RESERVATION_DAYS), snapshotId: c.result.snapshotId }
    c.log.push(A(ctx, `Accepted ${ship}${opt ? ` (${opt.label})` : ""}; ${firm ? "firm load on the order" : `soft capacity reservation until ${c.reservation.expires}`}; snapshot ${c.result.snapshotId}`))
    const w = d.productionOrders.find((x) => x.pegs.some((g) => g.soId === c.doc.id && g.line === c.line))
    if (w && firm) {
      w.promiseDate = ship
      w.dueDate = addWorkdays(ship, -SHIP_PREP_DAYS)
      reschedule(d, ctx)
    }
  } else if (decision === "Declined") {
    c.reservation = undefined
    c.log.push(A(ctx, "Declined; no reservation held"))
  } else c.log.push(A(ctx, `Planner review requested: ${opts.note}`))
  c.decision = decision
  ctx.emit("planning.promiseDecided", { doc: c.doc, line: c.line, decision, shipDate: decision === "Accepted" ? ship : undefined, binding: c.result.binding, reservation: c.reservation?.kind, snapshotId: c.result.snapshotId })
  return true
}
/** Open a promise check on a quote line or order line. CTP applies to MTO / ETO; MTS lines keep ATP
 *  [DOC:p.193 §4 "ATP vs CTP boundary"] (asserted). */
export function addPromiseCheck(d: S, ctx: MutateCtx, x: Omit<PromiseCandidate, "id" | "decision" | "log" | "orderType"> & { orderType: string }) {
  if (x.orderType !== "MTO" && x.orderType !== "ETO") throw new ProtoError(`${x.itemId} is ${x.orderType}: MTS lines keep ATP (stock + scheduled receipts); CTP applies to MTO and ETO only.`, "item")
  if (x.qty <= 0) throw new ProtoError("Quantity must be at least 1.", "qty")
  if (x.doc.type === "quotation" && !x.quoteType) throw new ProtoError("Pick the quote type: Budgetary or Firm.", "quoteType")
  if (d.promises.some((p) => p.doc.id === x.doc.id && p.line === x.line && p.decision !== "Declined" && p.decision !== "Expired")) throw new ProtoError(`${x.doc.id} line ${x.line} already has an open promise check.`)
  const c: PromiseCandidate = { ...x, orderType: x.orderType, quoteType: x.doc.type === "quotation" ? x.quoteType : undefined, id: `CTP-TBD-${pad(next(d), 4)}`, decision: "Not checked", log: [A(ctx, `Promise check opened for ${x.doc.id} line ${x.line}${x.quoteType ? ` (${x.quoteType} quote)` : ""}`)] }
  d.promises.unshift(c)
  return c.id
}
/** A Budgetary quote can be made Firm; a Firm ETO quote must carry a CTP result [DOC:p.193 §4]. */
export function setQuoteType(d: S, ctx: MutateCtx, id: string, quoteType: "Budgetary" | "Firm") {
  const c = d.promises.find((p) => p.id === id)
  if (!c) throw new ProtoError(`${id} not found.`)
  if (c.doc.type !== "quotation") throw new ProtoError("Quote type applies to quote lines only.")
  if (c.decision === "Accepted" || c.decision === "Declined") throw new ProtoError(`The promise was already ${c.decision.toLowerCase()}.`)
  c.quoteType = quoteType
  c.log.push(A(ctx, `Quote type ${quoteType}${quoteType === "Firm" && c.orderType === "ETO" ? ": a CTP result is now required" : ""}`))
}
/** True when a firm ETO quote line still has no CTP result (the quote may not go out). */
export const ctpRequired = (c: PromiseCandidate) => c.doc.type === "quotation" && c.quoteType === "Firm" && c.orderType === "ETO" && !c.result
export const promiseState = (c: PromiseCandidate): PromiseCandidate["decision"] =>
  c.decision === "Accepted" && c.reservation?.kind === "Soft" && c.reservation.expires && c.reservation.expires < TODAY ? "Expired" : c.decision

// ============================================================================ At risk (AT-RISK)
export function chooseRecovery(d: S, ctx: MutateCtx, id: string, optionId: AtRiskRecord["options"][number]["id"], note: string) {
  const a = d.atRisk.find((x) => x.id === id)
  if (!a) throw new ProtoError(`${id} not found.`)
  if (a.state === "Resolved" || a.state === "Sales change order requested") throw new ProtoError(`${id} is ${a.state}.`)
  const o = a.options.find((x) => x.id === optionId)
  if (!o) throw new ProtoError("Pick a recovery option.")
  if (o.note.includes("not applicable") || o.note.includes("has no alternate")) throw new ProtoError(`Not available here: ${o.note}.`)
  if (optionId === "repromise") {
    if (!note.trim()) throw new ProtoError("A re-promise needs a reason and impact for the sales change order.", "reason")
    a.state = "Sales change order requested"
    a.projected = o.projected
    a.decisions.push(A(ctx, `Re-promise unavoidable: sales change order path triggered (proposed ${o.projected}). ${note}`))
    ctx.emit("planning.salesChangeOrderRequested", { soId: a.soId, line: a.line, proposedDate: o.projected, reason: note })
  } else {
    a.state = "Recovery chosen"
    a.projected = o.projected
    a.decisions.push(A(ctx, `Recovery chosen: ${o.label}; projected ${o.projected}${note ? `. ${note}` : ""}`))
    ctx.emit("planning.recoveryDecided", { soId: a.soId, line: a.line, recovery: o.label, by: ctx.role })
    for (const woId of a.woIds) {
      const w = d.productionOrders.find((x) => x.id === woId)
      w?.activity.push(A(ctx, `At-risk ${a.id}: recovery "${o.label}" logged on ${a.soId} line ${a.line}`))
    }
  }
}
export function resolveAtRisk(d: S, ctx: MutateCtx, id: string) {
  const a = d.atRisk.find((x) => x.id === id)
  if (!a) throw new ProtoError(`${id} not found.`)
  if (a.state === "Open") throw new ProtoError("Choose a recovery (or trigger the change order) before resolving.")
  a.state = "Resolved"
  a.decisions.push(A(ctx, "Resolved: projected completion inside the promise"))
}

// ============================================================================ Work centers (PP-WC-001/2)
export function updateWc(d: S, ctx: MutateCtx, wcId: string, patch: Partial<WcOverride>, reason: string) {
  const w = d.wc[wcId]
  if (!w) throw new ProtoError(`${wcId} not found.`)
  const changed = Object.entries(patch).filter(([k, v]) => JSON.stringify(w[k as keyof WcOverride]) !== JSON.stringify(v))
  if (!changed.length) throw new ProtoError("Nothing changed.")
  const rate = changed.find(([k]) => k === "laborRate" || k === "overheadRate" || k === "machineRate")
  if (rate) throw new ProtoError(`${rate[0]} is read-only here: standard rates come from the rate calculation (CST-RATE-001) and are never edited by hand [DOC:p.71 §2; p.179 FL-04].`, rate[0])
  if (patch.freezeDays != null && !(Number.isInteger(patch.freezeDays) && patch.freezeDays >= 0)) throw new ProtoError("Freeze horizon is a whole number of working days.", "freezeDays")
  for (const [k, v] of changed) if (typeof v === "number" && (Number.isNaN(v) || v < 0)) throw new ProtoError(`${k} must be zero or more.`, k)
  Object.assign(w, patch)
  w.history.unshift(A(ctx, `Capacity model: ${changed.map(([k, v]) => `${k} → ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")}${reason ? ` (${reason})` : ""}`))
  reschedule(d, ctx)
}
export function setWcStatus(d: S, ctx: MutateCtx, wcId: string, status: WorkCenterStatus, until: ISODate | undefined, reason: string) {
  const w = d.wc[wcId]
  if (!w) throw new ProtoError(`${wcId} not found.`)
  if (w.status === status) throw new ProtoError(`${wcId} is already ${status}.`)
  if (!reason.trim()) throw new ProtoError("Enter a reason for the status change.", "reason")
  if (status === "Maintenance" && !until) throw new ProtoError("Give the planned end of the maintenance window.", "until")
  const from = w.status
  w.status = status
  w.maintenanceUntil = status === "Maintenance" ? until : undefined
  const own = d.workCenters.find((x) => x.id === wcId)
  if (own) own.status = status
  w.history.unshift(A(ctx, `Status ${from} → ${status}${until ? ` to ${until}` : ""}: ${reason}${status === "Maintenance" ? ". Scheduler warned; new dispatch blocked." : ""}`))
  reschedule(d, ctx)
  ctx.emit("production.workCenterStatusChanged", { wcId: wcId as WorkCenterId, status })
  if (status !== "Active") revalidate(d, ctx, "WC outage inside its path", `${wcId} ${status}`)
}

// ============================================================================ Routings (PP-RTG-001/2)
const routing = (d: S, id: string, rev: string) => {
  const r = d.routings.find((x) => x.id === id && x.rev === rev)
  if (!r) throw new ProtoError(`${id} rev ${rev} not found.`)
  return r
}
export function newRoutingRevision(d: S, ctx: MutateCtx, id: string, ecoRef: string) {
  const all = d.routings.filter((r) => r.id === id)
  if (all.some((r) => r.status === "Draft" || r.status === "In Review")) throw new ProtoError(`${id} already has a revision in work (${all.find((r) => r.status === "Draft" || r.status === "In Review")!.rev}).`)
  const base = all.find((r) => r.status === "Released")
  if (!base) throw new ProtoError(`${id} has no Released revision to change.`)
  if (!ecoRef.trim()) throw new ProtoError("A change to a released routing goes through an ECO: name it.", "eco")
  const rev = String.fromCharCode(Math.max(...all.map((r) => r.rev.charCodeAt(0))) + 1)
  const copy: PPRouting = structuredClone(base)
  Object.assign(copy, { rev, status: "Draft", validFrom: ctx.today, author: userName(ctx.userId), ecoRef, activity: [A(ctx, `Rev ${rev} drafted from rev ${base.rev} for ${ecoRef}`)] })
  d.routings.push(copy)
  return rev
}
export function editRoutingOp(d: S, ctx: MutateCtx, id: string, rev: string, no: number, patch: { setupHours?: number; runHours?: number; crew?: number; qcFlag?: boolean; milestone?: boolean; text?: string; workCenterId?: WorkCenterId }) {
  const r = routing(d, id, rev)
  if (r.status !== "Draft") throw new ProtoError(`Rev ${rev} is ${r.status}: only a Draft revision is edited (released routings change through an ECO).`)
  const o = r.opsDetail.find((x) => x.no === no)
  const b = r.ops.find((x) => x.no === no)
  if (!o || !b) throw new ProtoError(`Op ${no} not found.`)
  for (const k of ["setupHours", "runHours", "crew"] as const) if (patch[k] != null && (Number.isNaN(patch[k]) || patch[k]! < 0)) throw new ProtoError(`${k} must be zero or more.`, k)
  if (patch.qcFlag && !o.qcPlan) o.qcPlan = `IP-TBD-INP-${id.slice(8)}-${no}`
  Object.assign(o, patch)
  Object.assign(b, { setupHours: o.setupHours, runHours: o.runHours, qcFlag: o.qcFlag, text: o.text, workCenterId: o.workCenterId })
  r.activity.push(A(ctx, `Op ${no} edited: ${Object.entries(patch).map(([k, v]) => `${k} ${v}`).join(", ")}`))
}
export function addRoutingOp(d: S, ctx: MutateCtx, id: string, rev: string, wcId: WorkCenterId, text: string, setup: number, run: number) {
  const r = routing(d, id, rev)
  if (r.status !== "Draft") throw new ProtoError("Only a Draft revision takes new operations.")
  if (!text.trim()) throw new ProtoError("Describe the operation.", "text")
  const no = Math.max(0, ...r.ops.map((o) => o.no)) + 10
  r.ops.push({ no, workCenterId: wcId, text, setupHours: setup, runHours: run, qcFlag: false, wiDocIds: [] })
  r.opsDetail.push({ no, workCenterId: wcId, text, setupHours: setup, runHours: run, qcFlag: false, wiDocIds: [], crew: 1, basis: "per unit", components: [] })
  r.activity.push(A(ctx, `Op ${no} added at ${wcId}`))
}
export function routingTransition(d: S, ctx: MutateCtx, id: string, rev: string, to: "In Review" | "Released" | "Draft", comment = "") {
  const r = routing(d, id, rev)
  const from = r.status
  const ok = (from === "Draft" && to === "In Review") || (from === "In Review" && (to === "Released" || to === "Draft"))
  if (!ok) throw new ProtoError(`${id} rev ${rev}: ${from} → ${to} is not a lifecycle step (Draft → In Review → Released → Superseded).`)
  if (to === "Draft" && !comment.trim()) throw new ProtoError("Returning to Draft needs a review comment.", "reason")
  if (to === "In Review" && r.ops.length === 0) throw new ProtoError("A routing without operations cannot go to review.")
  if (to === "Released") {
    for (const old of d.routings.filter((x) => x.id === id && x.status === "Released")) {
      old.status = "Superseded"
      old.activity.push(A(ctx, `Released → Superseded by rev ${rev}`, "System"))
    }
  }
  r.status = to
  r.activity.push(A(ctx, `${from} → ${to}${comment ? `: ${comment}` : ""}`))
  if (to === "Released") {
    // standard times now feed costing and the schedule; planned orders on this item clear EX-07 routing side
    for (const p of d.plannedOrders.filter((p) => routingIdFor(p.materialId) === id && (p.state === "Proposed" || p.state === "Firmed"))) {
      p.routingReleased = true
      p.activity.push(A(ctx, `Routing ${id} rev ${rev} Released`, "System"))
    }
  }
}

// ============================================================================ Production orders (PP-WO-001/2)
const SERIAL_CODE: Record<string, string> = { "FIN-TBD-20MVA": "20M", "FIN-TBD-7500MTO": "7M5", "FIN-TBD-5000SS": "5M", "FIN-TBD-2500PM": "25P", "FIN-TBD-1000PM": "10P", "FIN-TBD-0167PL": "PL", "SEMI-TBD-CORE20": "C20", "SEMI-TBD-TANK20": "T20" }

export function setReleaseShort(d: S, ctx: MutateCtx, woId: string, on: boolean) {
  if (ctx.role !== "Planner") throw new ProtoError("Release Short is the Planner's override flag [DOC:p.74 §5.2 check 2]. Switch Acting as to Planner.")
  const w = wo(d, woId)
  if (w.status !== "Created") throw new ProtoError(`${woId} is ${w.status}: the flag applies before release.`)
  w.releaseShortFlag = on ? { by: userName(ctx.userId), on: ctx.today as ISODate } : undefined
  w.activity.push(A(ctx, on ? "Release Short flag set: order may release with shortages (Shortage badge; short items go to the Expedite Board)" : "Release Short flag removed"))
}

/** Release with the six hard checks; on release reservations firm, serials generate, dispatch
 *  entries are created; ETO multi-unit orders split one WO per serial [DOC:p.74 §5.1-§5.2] (asserted). */
export function releaseWo(d: S, ctx: MutateCtx, woId: string) {
  const w = wo(d, woId)
  if (w.status !== "Created") throw new ProtoError(`${woId} is ${w.status}: only a Created order is released.`)
  const gates = releaseGates(d, w)
  if (!canRelease(gates)) {
    const f = gates.filter((g) => g.state === "fail")
    throw new ProtoError(`Release refused: ${f.map((g) => `check ${g.no} ${g.name}${g.code ? ` (${g.code})` : ""}`).join("; ")}.`)
  }
  const short = gates.find((g) => g.no === 2)?.state === "warn"
  const shortList = short ? shortages(d, w) : []
  const noStd = gates.find((g) => g.no === 5)?.state === "warn"
  const units: PPWorkOrder[] = [w]
  if (w.orderType === "ETO" && w.qty > 1) {
    const n = w.qty
    const per = { material: w.costStd.material / n, labor: w.costStd.labor / n, overhead: w.costStd.overhead / n, subcontract: w.costStd.subcontract / n, hours: w.costStd.hours / n }
    w.qty = 1
    w.costStd = { ...per }
    for (const o of w.operations) o.runHours = round2(o.runHours / n)
    for (let i = 1; i < n; i++) {
      const c: PPWorkOrder = structuredClone(w)
      c.id = `WO-2026-${pad(next(d), 5)}` as ProductionOrderId
      c.activity = [A(ctx, `Split from ${woId} at release (ETO: one WO per serialized unit)`)]
      d.productionOrders.push(c)
      units.push(c)
    }
    w.activity.push(A(ctx, `ETO multi-unit order split at release into ${units.map((u) => u.id).join(", ")}`))
  }
  for (const u of units) {
    const sn = `SN-TBD-${SERIAL_CODE[u.itemId] ?? "X"}-${pad(next(d), 4)}` as SerialNo
    u.serials = u.qty === 1 ? [sn] : Array.from({ length: u.qty }, (_, i) => `${sn}-${pad(i + 1, 2)}` as SerialNo)
    u.serial = u.qty === 1 ? sn : undefined
    u.status = "Released"
    u.shortage = short
    // firm reservations: serialized components reserve available serials
    for (const o of u.operations)
      for (const c of o.components.filter((c) => c.serialized)) {
        const need = c.qtyPerUnit * u.qty
        const free = d.serials.filter((x) => x.materialId === c.materialId && x.status === "Available" && d.batches.find((b) => b.id === x.batchId)?.stock !== "Blocked").slice(0, need)
        for (const x of free) {
          x.status = "Reserved"
          x.woId = u.id
        }
      }
    // dispatch entries: queue position at the end of each work center queue
    for (const o of u.operations) {
      const q = d.productionOrders.filter((x) => isOpenWo(x) && x.id !== u.id).flatMap((x) => x.operations.filter((p) => p.workCenterId === o.workCenterId && p.status !== "Completed"))
      o.sequence = Math.max(0, ...q.map((p) => p.sequence)) + 1
    }
    const first = u.operations.find((o) => o.components.length)
    if (first) d.warehouseTasks.push({ id: `WT-TBD-0${next(d)}`, type: "Pick", status: "Queued", doc: { type: "productionOrder", id: u.id }, woId: u.id, op: first.no, text: `Stage kit for op ${first.no} at ${first.workCenterId} (SP-09)`, created: ctx.today as ISODate })
    u.activity.push(A(ctx, `Released; revisions frozen (MBOM rev ${u.mbomRev}, routing rev ${u.routingRev}); serial ${u.serials.length > 1 ? `${u.serials[0]}..${u.serials.at(-1)}` : u.serials[0]} generated; reservations firmed; dispatch entries created${short ? "; released SHORT (Shortage badge, short items on the Expedite Board)" : ""}`))
    ctx.emit("production.orderReleased", { woId: u.id, serial: u.serials[0] })
  }
  // Release Short: the short items appear on the Expedite Board [DOC:p.74 §5.2 check 2] (asserted)
  for (const x of shortList) {
    const exId = `SHORT-${w.id}-${x.materialId}`
    ctx.emit("planning.expediteRequested", { itemId: x.materialId as MaterialId, supply: x.supply ? { type: x.supply.startsWith("PLO-") ? "plannedOrder" : x.supply.startsWith("PR-") ? "requisition" : "purchaseOrder", id: x.supply } as DocRef : undefined, needDate: w.operations.find((o) => o.components.some((c) => c.materialId === x.materialId))?.start ?? (ctx.today as ISODate), exceptionId: exId })
  }
  if (shortList.length) w.activity.push(A(ctx, `Expedite Board (PUR-EXP-001): ${shortList.map((x) => `${x.materialId} short ${x.short}`).join("; ")}`, "System"))
  // Check 5 warning: the item goes on the CVA exception list [DOC:p.74 §5.2 check 5] (asserted)
  if (noStd && !d.cvaExceptions.some((x) => x.itemId === w.itemId && x.woId === w.id)) {
    const cva = { id: `CVA-TBD-${pad(next(d), 4)}`, itemId: w.itemId, woId: w.id, raisedOn: ctx.today as ISODate, text: `${w.itemId} released on ${w.id} without a standard cost` }
    d.cvaExceptions.push(cva)
    ctx.emit("production.cvaExceptionRaised", { cvaId: cva.id, itemId: w.itemId, woId: w.id })
    w.activity.push(A(ctx, `No standard cost: ${cva.id} added to the CVA exception list`, "System"))
  }
  reschedule(d, ctx)
  return units.map((u) => u.id)
}

/** Scheduling mode per order: backward from the due date is the default; forward from release on
 *  demand [DOC:p.74 §5.1; p.192 §3] (asserted). */
export function setScheduleMode(d: S, ctx: MutateCtx, woId: string, mode: "Backward" | "Forward") {
  const w = wo(d, woId)
  if (!isOpenWo(w)) throw new ProtoError(`${woId} is ${w.status}.`)
  if (mode === "Backward" && !w.dueDate) throw new ProtoError(`${woId} has no due date to schedule back from.`)
  w.scheduleMode = mode
  w.activity.push(A(ctx, mode === "Forward" ? "Scheduling: forward from release (on demand)" : `Scheduling: backward from due date ${w.dueDate} (default)`))
  reschedule(d, ctx)
}

export function holdWo(d: S, ctx: MutateCtx, woId: string, reason: string) {
  const w = wo(d, woId)
  if (!["Created", "Released", "In Progress", "Testing"].includes(w.status)) throw new ProtoError(`${woId} is ${w.status}: it cannot be put On Hold.`)
  if (!reason.trim()) throw new ProtoError("On Hold needs a reason (mandatory).", "reason")
  w.previousStatus = w.status
  w.status = "On Hold"
  w.holdReason = reason
  w.activity.push(A(ctx, `${w.previousStatus} → On Hold. Reason: ${reason}`))
}
export function releaseHold(d: S, ctx: MutateCtx, woId: string, note: string) {
  const w = wo(d, woId)
  if (w.status !== "On Hold") throw new ProtoError(`${woId} is not On Hold.`)
  if (!note.trim()) throw new ProtoError("Say what cleared the hold.", "reason")
  w.status = w.previousStatus ?? "Released"
  w.activity.push(A(ctx, `On Hold → ${w.status}: ${note}`))
  w.holdReason = undefined
  w.previousStatus = undefined
}

/** Receive to stock after the final operation (Final Test passed, paint and pack confirmed): #31 at
 *  released standard; STAGE-OUT and auto-reservation for pegged orders [DOC:p.78 §8.1] (asserted). */
export function receiveToStock(d: S, ctx: MutateCtx, woId: string) {
  const w = wo(d, woId)
  if (w.status === "On Hold") throw new ProtoError(`${woId} is On Hold.`)
  if (w.fgReceivedOn) throw new ProtoError(`${woId} was already received.`)
  if (!w.operations.every(isDoneOp)) throw new ProtoError("Receive to Stock is enabled by the final operation's completion: confirm every operation first.")
  if (!w.testPassed) throw new ProtoError("Final Test has not passed (C-26: the order stays in Testing until Pass or scrap disposition).")
  const good = [...w.operations].filter((o) => o.status === "Completed").sort((a, b) => b.no - a.no)[0].confirmedGood
  const amount = (stdTotal(w.costStd) / w.qty) * good
  post(d, ctx, 31, amount, { type: "productionOrder", id: w.id }, `FG receipt: ${good} × ${w.itemId} at released standard; to ${w.pegs.length ? `WH-TBD-01 STAGE-OUT, reserved to ${w.pegs[0].soId} line ${w.pegs[0].line}` : "WH-TBD-01 FG"}`, -amount)
  w.fgReceivedOn = ctx.today as ISODate
  w.completedOn = ctx.today as ISODate
  w.activity.push(A(ctx, `Received to stock (#31): ${good} good; status ${w.status} → Completed`))
  w.status = "Completed"
  d.genealogy.push({ id: `GEN-TBD-${next(d)}`, code: "T09", at: new Date().toISOString().slice(0, 19), woId: w.id, serial: w.serials.join(", "), text: `Finished receipt: ${good} × ${w.itemId}` })
  for (const sn of w.serials.slice(0, Math.max(1, good))) ctx.emit("production.fgReceived", { woId: w.id, serial: sn, itemId: w.itemId })
}

/** WO cancellation with a disposition [DOC:p.179 FL-04 f11] (asserted): Finish (the order runs to
 *  completion into stock, unpegged), Stop-scrap (Cancelled; collected costs settle to scrap per
 *  Controller decision [DOC:p.75 §5.3]) or Hold (On Hold, SO cancellation pending disposition). */
export function cancelWo(d: S, ctx: MutateCtx, woId: string, kind: CancelDisposition, note: string) {
  const w = wo(d, woId)
  if (!["Created", "Released", "In Progress", "Testing", "On Hold"].includes(w.status)) throw new ProtoError(`${woId} is ${w.status}: it cannot be cancelled.`)
  if (!note.trim()) throw new ProtoError("Say why the order is cancelled (for example the SO cancellation).", "reason")
  if (kind === "Hold") {
    if (w.status === "On Hold") throw new ProtoError(`${woId} is already On Hold.`)
    holdWo(d, ctx, woId, `SO cancellation pending disposition: ${note}`)
    w.cancelKind = "Hold"
    return
  }
  if (kind === "Finish") {
    if (w.status === "Created") throw new ProtoError("Nothing has started: a Created order is stopped (Stop-scrap), not finished.")
    if (!w.pegs.length) throw new ProtoError(`${woId} is already a stock order.`)
    const from = w.pegs.map((g) => `${g.soId}/${g.line}`).join(", ")
    w.pegs = []
    w.promiseDate = undefined
    w.cancelKind = "Finish"
    w.cancelDisposition = `Finish: ${note}`
    w.activity.push(A(ctx, `Cancellation disposition Finish: unpegged from ${from}; the order runs to completion into FG stock. ${note}`))
    return
  }
  const bal = woWip(d, w.id).total
  if (Math.abs(bal) > 0.005 && ctx.role !== "Controller") throw new ProtoError(`${woId} carries ${bal.toFixed(2)} USD in WIP: collected costs settle to scrap/variance per Controller decision. Switch Acting as to Controller.`)
  if (Math.abs(bal) > 0.005) post(d, ctx, 30, bal, { type: "productionOrder", id: w.id }, `Cancellation (Stop-scrap): collected costs to 5320 per Controller decision (${note})`, -bal)
  for (const x of d.serials.filter((x) => x.woId === w.id && x.status === "Reserved")) {
    x.status = "Available"
    x.woId = undefined
  }
  for (const o of w.operations.filter((o) => o.status === "Not Started" || o.status === "In Progress")) {
    o.status = "Cancelled"
    o.cancelledReason = "Order cancelled (Stop-scrap)"
  }
  w.activity.push(A(ctx, `${w.status} → Cancelled. Disposition Stop-scrap: ${note}`))
  w.status = "Cancelled"
  w.cancelKind = "Stop-scrap"
  w.cancelDisposition = `Stop-scrap: ${note}`
}

/** Scrap disposition after a failed Final Test: C-26 keeps the order in Testing until Pass or scrap
 *  disposition; the close rule accepts "FG received or scrap-disposed" [DOC:p.78 §8.2] (asserted).
 *  Residual WIP posts #30 to 5320; open operations are cancelled; the order goes Completed for settlement. */
export function scrapDisposeWo(d: S, ctx: MutateCtx, woId: string, reason: string) {
  const w = wo(d, woId)
  const ft = w.operations.find((o) => o.qcGate === "Final Test")
  if (w.status !== "Testing" || !ft || ft.inspection?.result !== "Failed" || w.testPassed) throw new ProtoError("Scrap disposition applies to an order in Testing whose Final Test failed (C-26).")
  if (!reason.trim()) throw new ProtoError("A scrap disposition needs a reason.", "reason")
  const busy = d.reworkOrders.filter((r) => r.parentWoId === w.id && r.status !== "Settled" && (r.status !== "Open" || r.ops.length || r.materials.length))
  if (busy.length) throw new ProtoError(`${busy.map((r) => `${r.id} (${r.status})`).join(", ")} has collected rework: complete and settle it into the order first.`)
  const bal = woWip(d, w.id).total
  if (Math.abs(bal) > 0.005) post(d, ctx, 30, bal, { type: "productionOrder", id: w.id }, `Scrap disposition after failed Final Test: ${reason}`, -bal)
  for (const o of w.operations.filter((o) => o.status === "Not Started" || o.status === "In Progress")) {
    o.status = "Cancelled"
    o.cancelledReason = "Scrap disposition"
  }
  for (const r of d.reworkOrders.filter((r) => r.parentWoId === w.id && r.status === "Open")) r.activity.push(A(ctx, `Not needed: parent ${w.id} scrap-disposed; nothing collected`, "System"))
  w.scrapDisposedOn = ctx.today as ISODate
  w.scrapDisposition = reason
  w.completedOn = ctx.today as ISODate
  w.activity.push(A(ctx, `Scrap disposition (C-26): ${reason}; open operations cancelled; Testing → Completed (awaiting settlement)`))
  w.status = "Completed"
  for (const x of d.serials.filter((x) => x.woId === w.id && x.status === "Reserved")) {
    x.status = "Available"
    x.woId = undefined
  }
}

/** Inspection result for a QC gate: the result comes from Quality (QM-INSP) via quality.inspectionClosed;
 *  the WO detail offers a stand-in until that event is wired (README request R-2). A Quality Manager
 *  may conditional-pass with a restriction note [DOC:p.73 §4] (asserted). */
export function recordInspection(d: S, ctx: MutateCtx, woId: string, no: number, result: InspectionResult | boolean, by = "Quality", restriction = "") {
  const w = wo(d, woId)
  const o = opOf(w, no)
  const res: InspectionResult = result === true ? "Passed" : result === false ? "Failed" : result
  if (!o.inspection) throw new ProtoError(`Op ${no} has no inspection requested.`)
  if (o.inspection.result) throw new ProtoError(`Inspection ${o.inspection.id} is already ${o.inspection.result}.`)
  if (res === "Conditional pass") {
    if (ctx.role !== "Quality Manager") throw new ProtoError("A conditional pass is the Quality Manager's decision [DOC:p.73 §4]. Switch Acting as to Quality Manager.")
    if (!restriction.trim()) throw new ProtoError("A conditional pass needs a restriction note.", "reason")
  }
  o.inspection.result = res
  o.inspection.restriction = res === "Conditional pass" ? restriction : undefined
  o.inspection.by = res === "Conditional pass" ? userName(ctx.userId) : by
  w.activity.push(A(ctx, `Inspection ${o.inspection.id} (${o.qcGate}) ${res}${res === "Conditional pass" ? `. Restriction: ${restriction}` : ""}`, res === "Conditional pass" ? ctx.role : by))
  const passed = gatePassed(res)
  if (o.qcGate === "Final Test") {
    if (passed) {
      w.testPassed = true
      d.genealogy.push({ id: `GEN-TBD-${next(d)}`, code: "T08", at: new Date().toISOString().slice(0, 19), woId: w.id, op: no, serial: w.serials[0], scanPoint: "SP-14", text: `Final test ${res.toLowerCase()}: ${o.inspection.id}${res === "Conditional pass" ? ` (restriction: ${restriction})` : ""}` })
      ctx.emit("trace.eventRecorded", { code: "T08", doc: { type: "productionOrder", id: w.id }, serial: w.serials[0] })
    } else {
      const id = createRwo(d, ctx, { originKind: "Test failure", origin: { type: "productionOrder", id: w.id }, parentWoId: w.id, originOp: no, itemId: w.itemId, serial: w.serials[0], qty: 1, title: `Test failure at op ${no}: repair and re-test` })
      w.activity.push(A(ctx, `Final Test failed: ${id} opened; order stays Testing until Pass or scrap disposition (C-26). Re-test is requested again after the rework`, "System"))
    }
  }
}

/** Reopen after the Controller approved in WF-INBOX: the settlement JE is reversed first [DOC:p.78 §8.2] (asserted). */
export function onWoReopenDecided(d: S, ctx: MutateCtx, woId: string, outcome: "Approved" | "Rejected", reason?: string) {
  const w = d.productionOrders.find((x) => x.id === woId)
  if (!w) return
  if (outcome === "Rejected") {
    w.activity.push(A(ctx, `Reopen rejected by the Controller${reason ? `: ${reason}` : ""}`, "Controller"))
    return
  }
  if (w.status !== "Closed (TECO)") return
  const st = d.settlements.find((s) => s.id === w.settlementId)
  const row = st?.orders.find((o) => o.woId === w.id)
  const je = d.journal.find((j) => j.id === row?.journalId)
  if (je) {
    const rev = post(d, ctx, 32, je.amount, je.source, `Reversal of ${je.id} (settlement ${st!.id}) for reopen`, -je.wip1320, 0, { reverses: je.id })
    st!.reversed = { on: ctx.today as ISODate, journalIds: [...(st!.reversed?.journalIds ?? []), rev.id] }
  }
  w.status = "Completed"
  w.settledOn = undefined
  w.settlementId = undefined
  w.activity.push(A(ctx, `Reopen approved by the Controller: settlement reversed first; Closed (TECO) → Completed`, "Controller"))
}

// ============================================================================ Settlement (PP-SETTLE-001)
export function settlementEligible(d: S, w: PPWorkOrder) {
  return w.status === "Completed" && closeChecks(d, w).every((c) => c.ok)
}
/** #32 per order: residual WIP to 5220 / 5230 / 5240 / 5250, WIP exactly zero after [DOC:p.78 §8.2] (asserted). */
/** Settlement is posted by the Cost accountant (Book VI users "Cost accountant, Controller reopens"
 *  [DOC:p.263]); the person who confirmed an order does not approve its settlement ("WO confirm is not
 *  settlement approve" [DOC:p.179 FL-04 f3]) (asserted). */
export function settlementSod(d: Pick<S, "confirmations">, role: string, userId: string, woIds: string[]): string | null {
  if (role !== "Cost accountant") return "The settlement run is posted by the Cost accountant. Switch Acting as to Cost accountant."
  const own = woIds.filter((id) => d.confirmations.some((c) => c.woId === id && c.operatorId === userId))
  if (own.length) return `Segregation of duties: you confirmed operations on ${own.join(", ")}; WO confirm is not settlement approve.`
  return null
}
export function settleOrders(d: S, ctx: MutateCtx, woIds: string[]) {
  if (!woIds.length) throw new ProtoError("Select at least one order.")
  const sod = settlementSod(d, ctx.role, ctx.userId, woIds)
  if (sod) throw new ProtoError(sod)
  const id = `SET-TBD-${pad(next(d), 4)}`
  const st = { id, postedOn: ctx.today as ISODate, period: ctx.today.slice(0, 7), by: userName(ctx.userId), orders: [] as S["settlements"][number]["orders"] }
  for (const woId of woIds) {
    const w = wo(d, woId)
    if (w.status !== "Completed") throw new ProtoError(`${woId} is ${w.status}: only Completed orders settle.`)
    const failed = closeChecks(d, w).filter((c) => !c.ok)
    if (failed.length) throw new ProtoError(`${woId} cannot close: ${failed.map((c) => c.name).join("; ")}.`)
    const v = variances(d, w)
    const e = post(d, ctx, 32, v.residual, { type: "productionOrder", id: w.id }, `Settlement ${id}: 5220 ${v.mat.toFixed(2)}, 5230 ${v.lrv.toFixed(2)}, 5240 ${v.lev.toFixed(2)}, 5250 ${v.oav.toFixed(2)}`, -v.residual)
    st.orders.push({ woId: w.id, mat: v.mat, lrv: v.lrv, lev: v.lev, oav: v.oav, journalId: e.id })
    w.status = "Closed (TECO)"
    w.settledOn = ctx.today as ISODate
    w.settlementId = id
    w.activity.push(A(ctx, `Settlement ${id} posted (#32, ${e.id}); WIP 0.00; Completed → Closed (TECO)`))
    ctx.emit("production.orderSettled", { woId: w.id })
  }
  d.settlements.push(st)
  return id
}

// ============================================================================ Dispatch (PP-DSP-001)
export function wcQueue(d: Pick<S, "productionOrders">, wcId: string) {
  return d.productionOrders
    .filter((w) => isOpenWo(w) && w.status !== "Created")
    .flatMap((w) => w.operations.filter((o) => o.workCenterId === wcId && !isDoneOp(o)).map((o) => ({ wo: w, op: o })))
    .sort((a, b) => (a.op.status === "In Progress" ? -1 : 0) - (b.op.status === "In Progress" ? -1 : 0) || a.op.sequence - b.op.sequence)
}
/** Resequence within guardrails (design reading of [DOC:p.262]): running operations stay at the
 *  top; an operation cannot jump ahead of a running one. */
export function resequence(d: S, ctx: MutateCtx, wcId: string, woId: string, no: number, dir: -1 | 1) {
  const q = wcQueue(d, wcId)
  const i = q.findIndex((x) => x.wo.id === woId && x.op.no === no)
  if (i < 0) throw new ProtoError("Operation not in this queue.")
  const j = i + dir
  if (j < 0 || j >= q.length) throw new ProtoError("Already at the end of the queue.")
  if (q[i].op.status === "In Progress" || q[j].op.status === "In Progress") throw new ProtoError("Running operations stay at the top of the queue.")
  const a = q[i].op.sequence
  q[i].op.sequence = q[j].op.sequence
  q[j].op.sequence = a
  if (q[i].op.sequence === q[j].op.sequence) q[i].op.sequence += dir
  q[i].wo.activity.push(A(ctx, `Dispatch ${wcId}: op ${no} moved ${dir < 0 ? "up" : "down"} (now position ${j + 1})`))
}
export function assignCrew(d: S, ctx: MutateCtx, woId: string, no: number, ids: UserId[]) {
  const o = opOf(wo(d, woId), no)
  o.crewIds = ids
  wo(d, woId).activity.push(A(ctx, `Crew for op ${no}: ${ids.map(userName).join(", ") || "none"}`))
}

// ============================================================================ Shop floor terminal (PP-SFT-001)
export function startedQty(w: PPWorkOrder, no: number) {
  const prev = [...w.operations].filter((o) => o.no < no && o.status !== "Cancelled").sort((a, b) => b.no - a.no)[0]
  return prev ? prev.confirmedGood : w.qty
}
/** Why an operation cannot start (null when it can). A work center in Maintenance or Inactive blocks
 *  new dispatch [DOC:p.71 §2]; predecessors done; earlier QC gates passed (or conditionally passed). */
export function startCheck(d: Pick<S, "productionOrders" | "workCenters" | "wc">, woId: string, no: number): string | null {
  const w = d.productionOrders.find((x) => x.id === woId)
  if (!w) return `${woId} not found`
  if (!["Released", "In Progress", "Testing"].includes(w.status)) return `${woId} is ${w.status}`
  const o = w.operations.find((x) => x.no === no)
  if (!o) return `no op ${no}`
  if (o.status !== "Not Started") return `op ${no} is ${o.status}`
  const wc = allWorkCenters(d).find((x) => x.id === o.workCenterId)
  if (wc && wc.status !== "Active") return `${wc.id} is ${wc.status}${wc.maintenanceUntil && wc.status === "Maintenance" ? ` until ${wc.maintenanceUntil}` : ""}: new dispatch is blocked`
  const open = w.operations.filter((x) => x.no < no && !isDoneOp(x))
  if (open.length) return `predecessor op ${open[0].no} not complete`
  const gate = w.operations.filter((x) => x.no < no && x.qcGate && x.status !== "Cancelled" && !gatePassed(x.inspection?.result))
  if (gate.length) return `QC gate at op ${gate[0].no} (${gate[0].qcGate}) not cleared`
  return null
}
/** Qualification interlock for an operation flagged with a required skill: the operator needs a
 *  current QAL- record; an expired one removes eligibility [DOC:p.193 Book III E §2] (asserted). */
export function qualificationCheck(d: Pick<S, "qualifications">, userId: string, skill?: string): string | null {
  if (!skill) return null
  const q = d.qualifications.filter((x) => x.userId === userId && x.skill === skill).sort((a, b) => b.expires.localeCompare(a.expires))[0]
  if (!q) return `${userName(userId)} holds no ${skill} qualification`
  if (q.expires < TODAY) return `${userName(userId)}'s ${skill} qualification ${q.id} expired ${q.expires}`
  return null
}
export function startOp(d: S, ctx: MutateCtx, woId: string, no: number, crew: UserId[]) {
  const why = startCheck(d, woId, no)
  if (why) throw new ProtoError(`Cannot start: ${why}.`)
  const w = wo(d, woId)
  const o = opOf(w, no)
  const lead = crew[0] ?? ctx.userId
  const qual = qualificationCheck(d, lead, o.requiredSkill)
  if (qual) throw new ProtoError(`Qualification interlock (SP-07): op ${no} requires ${o.requiredSkill}; ${qual}.`, "E-QAL")
  o.status = "In Progress"
  o.start = ctx.today as ISODate
  o.crewIds = crew.length ? crew : o.crewIds
  o.andon = undefined
  const from = w.status
  if (o.qcGate === "Final Test") w.status = "Testing"
  else if (w.status === "Released") w.status = "In Progress"
  w.activity.push(A(ctx, `Op ${no} started at ${o.workCenterId} (SP-10); labor clock on for ${o.crewIds.map(userName).join(", ") || "crew"}${from !== w.status ? `; ${from} → ${w.status}` : ""}`))
}

export interface IssueResult { materialId: string; qty: number; lot: string; value: number }
/** SP-08 material issue: component must be on this op's list (E-PP-07 hard block; supervisor override
 *  creates an NCR), batch Unrestricted, FIFO or a logged override. Posts #28, writes T05. */
export function issueMaterial(d: S, ctx: MutateCtx, woId: string, no: number, code: string, opts: { qty?: number; overrideReason?: string; overrideBy?: string; fifoReason?: string } = {}): IssueResult {
  const w = wo(d, woId)
  const o = opOf(w, no)
  if (o.status !== "In Progress") throw new ProtoError(`Start op ${no} before issuing material.`)
  const batch = d.batches.find((b) => b.id === code)
  const serial = d.serials.find((s) => s.id === code)
  if (!batch && !serial) throw new ProtoError(`${code} is not a known batch or serial label.`, "E-SCAN")
  const materialId = batch?.materialId ?? serial!.materialId
  let c = o.components.find((x) => x.materialId === materialId)
  if (!c) {
    if (!opts.overrideReason) throw new ProtoError(`${materialId} is not on op ${no}'s component list.`, "E-PP-07")
    const sup = USERS.find((u) => u.id === opts.overrideBy || u.badge === opts.overrideBy)
    if (!sup?.roles.includes("Production supervisor")) throw new ProtoError("Only a Production supervisor's badge can override a wrong-material block.", "E-PP-07")
    const ncrId = `NCR-TBD-${pad(next(d), 4)}`
    d.ncrs.push({ id: ncrId, woId: w.id, op: no, text: `Wrong material ${materialId} (${code}) issued under supervisor override by ${sup.name}: ${opts.overrideReason}`, on: ctx.today as ISODate })
    ctx.emit("production.ncrRaised", { ncrId, woId: w.id, op: no, scanned: code, reason: opts.overrideReason })
    c = { materialId: materialId as MaterialId, qtyPerUnit: 0, issue: "manual", issued: 0, lots: [] }
    o.components.push(c)
  }
  let qty: number
  let lot: string
  if (batch) {
    if (batch.stock !== "Unrestricted") throw new ProtoError(`${batch.id} is ${batch.stock}: only Unrestricted stock issues.`, "E-PP-08")
    const older = d.batches.filter((b) => b.materialId === materialId && b.stock === "Unrestricted" && b.qty > 0 && b.receivedOn < batch.receivedOn)
    if (older.length && !opts.fifoReason) throw new ProtoError(`FIFO: older batch ${older[0].id} (received ${older[0].receivedOn}) should issue first. Scan it or log an override reason.`, "FIFO")
    const remaining = Math.max(0, c.qtyPerUnit * w.qty - c.issued)
    qty = Math.min(opts.qty ?? (remaining || 1), batch.qty)
    if (qty <= 0) throw new ProtoError(`${batch.id} is empty.`)
    batch.qty -= qty
    lot = batch.id
  } else {
    const s = serial!
    if (!(s.status === "Available" || (s.status === "Reserved" && s.woId === w.id))) throw new ProtoError(`${s.id} is ${s.status}${s.woId ? ` for ${s.woId}` : ""}: it cannot issue to ${w.id}.`, "E-BC-05")
    if (d.batches.find((b) => b.id === s.batchId)?.stock === "Blocked") throw new ProtoError(`${s.id} belongs to Blocked batch ${s.batchId}.`, "E-PP-08")
    s.status = "In Production"
    s.woId = w.id
    qty = 1
    lot = s.id
  }
  c.issued += qty
  if (!c.lots.includes(lot)) c.lots.push(lot)
  const value = qty * std(materialId)
  post(d, ctx, 28, value, { type: "productionOrder", id: w.id }, `Op ${no} ${o.workCenterId}: ${qty} ${materialId} ${lot} (SP-08${opts.fifoReason ? `, FIFO override: ${opts.fifoReason}` : ""})`, value)
  d.genealogy.push({ id: `GEN-TBD-${next(d)}`, code: "T05", at: new Date().toISOString().slice(0, 19), woId: w.id, op: no, batch: batch?.id, serial: serial?.id, scanPoint: "SP-08", userId: ctx.userId, text: `Issued ${qty} ${materialId} to op ${no}` })
  ctx.emit("trace.eventRecorded", { code: "T05", doc: { type: "productionOrder", id: w.id }, batch: batch?.id, serial: serial?.id })
  return { materialId, qty, lot, value }
}

/** SP-12: parent serial + child serial; child on the BOM, Available or issued to this WO, not already linked (E-BC-05). */
export function installSerial(d: S, ctx: MutateCtx, woId: string, no: number, parent: string, child: string) {
  const w = wo(d, woId)
  const o = opOf(w, no)
  if (o.status !== "In Progress") throw new ProtoError(`Start op ${no} first.`)
  if (!w.serials.includes(parent as SerialNo)) throw new ProtoError(`${parent} is not a serial of ${w.id} (${w.serials.join(", ") || "none"}).`, "E-BC-05")
  const s = d.serials.find((x) => x.id === child)
  if (!s) throw new ProtoError(`${child} is not a known serial.`, "E-BC-05")
  const c = o.components.find((x) => x.materialId === s.materialId && x.serialized)
  if (!c) throw new ProtoError(`${s.materialId} is not a serialized component of op ${no}.`, "E-BC-05")
  if (s.parent) throw new ProtoError(`${child} is already linked to ${s.parent}.`, "E-BC-05")
  if (!(s.status === "Available" || ((s.status === "Reserved" || s.status === "In Production") && s.woId === w.id))) throw new ProtoError(`${child} is ${s.status}${s.woId ? ` for ${s.woId}` : ""}.`, "E-BC-05")
  if (s.status !== "In Production") issueMaterial(d, ctx, woId, no, child)
  const ss = d.serials.find((x) => x.id === child)!
  ss.parent = parent
  d.genealogy.push({ id: `GEN-TBD-${next(d)}`, code: "T06", at: new Date().toISOString().slice(0, 19), woId: w.id, op: no, serial: parent, child, scanPoint: "SP-12", userId: ctx.userId, text: `Installed ${child} (${s.materialId}) in ${parent}` })
  ctx.emit("trace.eventRecorded", { code: "T06", doc: { type: "productionOrder", id: w.id }, serial: child })
}

export function captureValue(d: S, ctx: MutateCtx, woId: string, no: number, field: string, value: string) {
  const o = opOf(wo(d, woId), no)
  o.capture = { ...(o.capture ?? {}), [field]: value }
  void ctx
}

export function requestInspection(d: S, ctx: MutateCtx, woId: string, no: number) {
  const w = wo(d, woId)
  const o = opOf(w, no)
  if (!o.qcGate) throw new ProtoError(`Op ${no} is not a QC checkpoint.`)
  if (o.status !== "In Progress") throw new ProtoError(`Start op ${no} first.`)
  if (o.inspection && !o.inspection.result) throw new ProtoError(`${o.inspection.id} is already requested.`)
  if (o.inspection?.result === "Passed") throw new ProtoError(`${o.inspection.id} already passed.`)
  const id = `IL-TBD-${pad(next(d), 4)}`
  o.inspection = { id, requestedOn: ctx.today as ISODate }
  w.activity.push(A(ctx, `Request Inspection: ${id} (${o.qcGate === "Final Test" ? "final" : "IP-INP in-process"}) for op ${no}; Complete disabled until the result is posted`))
  ctx.emit("production.inspectionRequested", { woId: w.id, op: no, gate: o.qcGate, inspectionId: id, subject: { type: "productionOrder", id: w.id } })
  return id
}

export interface CompleteInput { good: number; scrap: number; rework: number; scrapReason?: string; hours: number; eventUuid: string; offlineReplay?: boolean; supervisorBadge?: string; supervisorReason?: string }
/** What a confirmation needs a supervisor for: scrap beyond the threshold [DOC:p.179 f13] and hours
 *  outside the ±20% guardrail [DOC:p.76 §6.1] (asserted). */
export function supervisorNeeds(o: { setupHours: number; runHours: number; crew: number }, started: number, x: { scrap: number; hours: number }) {
  const out: string[] = []
  if (x.scrap > 0 && x.scrap / Math.max(1, started) > SCRAP_SUPERVISOR_PCT) out.push(`scrap ${x.scrap} of ${started} is beyond the ${Math.round(SCRAP_SUPERVISOR_PCT * 100)}% threshold`)
  const stdH = (o.setupHours + o.runHours) * o.crew
  if (stdH > 0 && x.hours !== 0 && Math.abs(x.hours - stdH) / stdH > LABOR_GUARD) out.push(`hours ${x.hours} are outside the ±20% guardrail around ${round2(stdH)} crew hours`)
  return out
}
/** SP-11: good + scrap + rework = started; scrap needs a reason; QC checkpoint needs a passed result.
 *  Posts #29 (labor + overhead), #30 (scrap) and #28 (backflush); rework spawns or extends an RWO. */
export function completeOp(d: S, ctx: MutateCtx, woId: string, no: number, x: CompleteInput) {
  if (d.confirmations.some((c) => c.eventUuid === x.eventUuid)) return { duplicate: true as const }
  const w = wo(d, woId)
  const o = opOf(w, no)
  if (o.status !== "In Progress") throw new ProtoError(`Op ${no} is ${o.status}: start it first (SP-10).`)
  if (w.status === "On Hold") throw new ProtoError(`${w.id} is On Hold.`)
  if (o.qcGate && !gatePassed(o.inspection?.result)) throw new ProtoError(o.inspection ? `Waiting for the result of ${o.inspection.id} (${o.qcGate}).` : `QC checkpoint: request the inspection first (${o.qcGate}).`)
  const started = startedQty(w, no)
  for (const [k, v] of Object.entries({ good: x.good, scrap: x.scrap, rework: x.rework, hours: x.hours })) if (!Number.isFinite(v) || v < 0) throw new ProtoError(`${k} must be zero or more.`, k)
  if (x.good + x.scrap + x.rework !== started) throw new ProtoError(`Good ${x.good} + scrap ${x.scrap} + rework ${x.rework} must equal the started quantity ${started}.`, "good")
  if (x.scrap > 0 && !x.scrapReason) throw new ProtoError("Scrap needs a reason code.", "scrapReason")
  const needs = supervisorNeeds(o, started, x)
  let supervisor: { by: string; reason: string; for: string } | undefined
  if (needs.length) {
    const sup = USERS.find((u) => u.badge === x.supervisorBadge || u.id === x.supervisorBadge)
    if (!sup?.roles.includes("Production supervisor")) throw new ProtoError(`${needs.join("; ")}: a Production supervisor's badge and a reason are needed.`, "supervisor")
    if (!x.supervisorReason?.trim()) throw new ProtoError("The supervisor gives a reason.", "supervisor")
    supervisor = { by: sup.name, reason: x.supervisorReason, for: needs.join("; ") }
  }
  const src = { type: "productionOrder" as const, id: w.id }
  const cnfId = newCnfId(d)
  const tag = { cnfId }
  // backflush components at standard qty × confirmed good
  for (const c of o.components.filter((c) => c.issue === "backflush")) {
    const q = c.qtyPerUnit * (x.good + x.rework)
    if (q <= 0) continue
    c.issued += q
    const lot = d.batches.find((b) => b.materialId === c.materialId && b.stock === "Unrestricted" && b.qty > 0)
    if (lot) {
      lot.qty = Math.max(0, lot.qty - q)
      if (!c.lots.includes(lot.id)) c.lots.push(lot.id)
    }
    post(d, ctx, 28, q * std(c.materialId), src, `Backflush op ${no}: ${q} ${c.materialId}${lot ? ` ${lot.id}` : ""}`, q * std(c.materialId), 0, tag)
  }
  const lr = laborRateOf(w.costStd)
  const oh = ohRateOf(w.costStd)
  const lab = x.hours * (lr + oh)
  post(d, ctx, 29, lab, src, `Op ${no} ${o.workCenterId}: ${x.hours} h × std labor ${lr.toFixed(2)} + overhead ${oh.toFixed(2)}${supervisor ? ` (supervisor ${supervisor.by}: ${supervisor.reason})` : ""}`, lab, 0, tag)
  if (x.scrap > 0) {
    // "Component value scrapped" [DOC:p.76 §6.1]: material in WIP per started unit, not labor
    const sv = scrapValue(d, w, started, x.scrap)
    post(d, ctx, 30, sv, src, `Op ${no}: ${x.scrap} scrapped, ${x.scrapReason}: component value${supervisor ? `; supervisor ${supervisor.by}` : ""}`, -sv, 0, tag)
  }
  d.confirmations.push({ id: cnfId, woId: w.id, op: no, good: x.good, scrap: x.scrap, rework: x.rework, hours: x.hours, operatorId: ctx.userId, at: ctx.today as ISODate, eventUuid: x.eventUuid, crewSize: o.crew, scrapReason: x.scrapReason, offlineReplay: x.offlineReplay, supervisor })
  o.status = "Completed"
  o.finish = ctx.today as ISODate
  o.confirmedGood = x.good
  o.confirmedScrap = x.scrap
  o.confirmedRework = x.rework
  o.actualHours = x.hours
  let rwoId: string | undefined
  if (x.rework > 0) {
    const open = d.reworkOrders.find((r) => r.parentWoId === w.id && r.originOp === no && (r.status === "Open" || r.status === "In Progress"))
    if (open) {
      open.qty += x.rework
      open.activity.push(A(ctx, `Extended by ${x.rework} from op ${no} confirmation ${cnfId}`))
      rwoId = open.id
    } else rwoId = createRwo(d, ctx, { originKind: "Production rework", origin: src, parentWoId: w.id, originOp: no, itemId: w.itemId, qty: x.rework, title: `Rework ${x.rework} from op ${no} ${o.workCenterId}` })
  }
  // next-op staging signal to the warehouse
  const nextOp = [...w.operations].filter((p) => p.no > no && p.status !== "Cancelled").sort((a, b) => a.no - b.no)[0]
  if (nextOp?.components.some((c) => c.issue === "manual") && !nextOp.staged) d.warehouseTasks.push({ id: `WT-TBD-0${next(d)}`, type: "Pick", status: "Queued", doc: src, woId: w.id, op: nextOp.no, text: `Stage kit for op ${nextOp.no} at ${nextOp.workCenterId} (SP-09)`, created: ctx.today as ISODate })
  const from = w.status
  if (o.qcGate === "Final Test" && nextOp) w.status = "In Progress"
  w.activity.push(A(ctx, `Op ${no} confirmed (SP-11, ${cnfId}): good ${x.good}, scrap ${x.scrap}, rework ${x.rework}, ${x.hours} h${rwoId ? `; ${rwoId}` : ""}${!nextOp ? "; last operation: Receive to Stock enabled" : ""}${from !== w.status ? `; ${from} → ${w.status}` : ""}${x.offlineReplay ? " (offline replay)" : ""}`))
  d.genealogy.push({ id: `GEN-TBD-${next(d)}`, code: "T07", at: new Date().toISOString().slice(0, 19), woId: w.id, op: no, serial: w.serials[0], scanPoint: "SP-11", userId: ctx.userId, text: `Op ${no} confirmed: good ${x.good}, scrap ${x.scrap}, ${x.hours} h` })
  ctx.emit("production.confirmationPosted", { woId: w.id, op: no, good: x.good, scrap: x.scrap })
  return { duplicate: false as const, cnfId, rwoId }
}

/** Component value per started unit in WIP: material issued (#28) less material already scrapped (#30). */
export function scrapValue(d: Pick<S, "journal">, w: PPWorkOrder, started: number, scrap: number) {
  const mat = d.journal.filter((j) => j.source.id === w.id && (j.template === 28 || j.template === 30)).reduce((a, j) => a + j.wip1320, 0)
  return round2((Math.max(0, mat) / Math.max(1, started)) * scrap)
}

/** Confirmation correction by mirror reversal [DOC:p.179 FL-04 f11] (asserted): every posting of the
 *  confirmation is reversed with the opposite WIP effect, a reversal confirmation is written and the
 *  operation returns to In Progress. Supervisor action ("supervisors override" [DOC:p.262]). Only the
 *  latest confirmation of an order, before the next operation starts and before FG receipt. */
export function reverseConfirmation(d: S, ctx: MutateCtx, cnfId: string, reason: string) {
  if (ctx.role !== "Production supervisor") throw new ProtoError("A confirmation correction is a supervisor action. Switch Acting as to Production supervisor.")
  if (!reason.trim()) throw new ProtoError("A correction needs a reason.", "reason")
  const c = d.confirmations.find((x) => x.id === cnfId)
  if (!c) throw new ProtoError(`${cnfId} not found.`)
  if (c.reversalOf) throw new ProtoError(`${cnfId} is itself a reversal.`)
  if (c.reversedBy) throw new ProtoError(`${cnfId} was already reversed by ${c.reversedBy}.`)
  const w = wo(d, c.woId)
  if (!["Released", "In Progress", "Testing", "On Hold"].includes(w.status) || w.fgReceivedOn) throw new ProtoError(`${w.id} is ${w.status}: confirmations are corrected before FG receipt.`)
  const o = opOf(w, c.op)
  const later = w.operations.filter((x) => x.no > c.op && x.status !== "Not Started" && x.status !== "Cancelled")
  if (later.length) throw new ProtoError(`Op ${later[0].no} has started: reverse from the latest confirmation backwards.`)
  if (o.status !== "Completed") throw new ProtoError(`Op ${c.op} is ${o.status}.`)
  const rwo = c.rework > 0 ? d.reworkOrders.find((r) => r.parentWoId === w.id && r.originOp === c.op && r.status !== "Settled") : undefined
  if (c.rework > 0 && rwo && (rwo.status !== "Open" || rwo.ops.length || rwo.materials.length)) throw new ProtoError(`${rwo.id} already collects rework for this confirmation: settle or adjust it first.`)
  const rows = d.journal.filter((j) => j.cnfId === cnfId && !j.reverses)
  const revId = newCnfId(d)
  for (const j of rows) post(d, ctx, j.template, -j.amount, j.source, `Mirror reversal of ${j.id} (${cnfId}): ${reason}`, -j.wip1320, -j.wip1325, { reverses: j.id, cnfId: revId })
  for (const comp of o.components.filter((x) => x.issue === "backflush")) {
    const q = comp.qtyPerUnit * (c.good + c.rework)
    comp.issued = Math.max(0, comp.issued - q)
    const lot = d.batches.find((b) => comp.lots.includes(b.id))
    if (lot) lot.qty += q
  }
  d.confirmations.push({ id: revId, woId: w.id, op: c.op, good: -c.good, scrap: -c.scrap, rework: -c.rework, hours: -c.hours, operatorId: ctx.userId, at: ctx.today as ISODate, eventUuid: `rev-${cnfId}`, crewSize: c.crewSize, reversalOf: c.id })
  c.reversedBy = revId
  if (rwo) {
    rwo.qty = Math.max(0, rwo.qty - c.rework)
    rwo.activity.push(A(ctx, `Quantity reduced by ${c.rework}: confirmation ${cnfId} reversed (${revId})`))
  }
  o.status = "In Progress"
  o.confirmedGood = 0
  o.confirmedScrap = 0
  o.confirmedRework = 0
  o.actualHours = 0
  if (o.qcGate === "Final Test" && w.status === "In Progress") w.status = "Testing"
  w.activity.push(A(ctx, `Confirmation ${cnfId} reversed by ${revId} (mirror postings ${rows.length}): ${reason}. Op ${c.op} back to In Progress`))
  d.genealogy.push({ id: `GEN-TBD-${next(d)}`, code: "T07", at: new Date().toISOString().slice(0, 19), woId: w.id, op: c.op, serial: w.serials[0], userId: ctx.userId, text: `Confirmation ${cnfId} reversed (${revId}): ${reason}` })
  return revId
}

/** Cancel a not-started operation (close rule "all ops confirmed or cancelled" [DOC:p.78 §8.2]).
 *  Production Scheduler (owns the WO to close [DOC:p.179 FL-04 f3]) or supervisor; QC checkpoints
 *  are never cancelled (C-26 and the inspection gates stay). */
export function cancelOp(d: S, ctx: MutateCtx, woId: string, no: number, reason: string) {
  if (ctx.role !== "Production Scheduler" && ctx.role !== "Production supervisor") throw new ProtoError("Cancelling an operation is a Production Scheduler or supervisor action.")
  if (!reason.trim()) throw new ProtoError("Cancelling an operation needs a reason.", "reason")
  const w = wo(d, woId)
  if (!isOpenWo(w)) throw new ProtoError(`${woId} is ${w.status}.`)
  const o = opOf(w, no)
  if (o.status !== "Not Started") throw new ProtoError(`Op ${no} is ${o.status}: only a not-started operation is cancelled (correct a confirmation by reversal).`)
  if (o.qcGate) throw new ProtoError(`Op ${no} is a QC checkpoint (${o.qcGate}): it cannot be cancelled.`)
  if (o.components.some((c) => c.issued > 0)) throw new ProtoError(`Material is issued to op ${no}: return it first.`)
  o.status = "Cancelled"
  o.cancelledReason = reason
  w.activity.push(A(ctx, `Op ${no} cancelled: ${reason}`))
  reschedule(d, ctx)
}

export function raiseAndon(d: S, ctx: MutateCtx, woId: string, no: number, reason: string) {
  const w = wo(d, woId)
  const o = opOf(w, no)
  if (!reason) throw new ProtoError("Pick a hold reason.", "reason")
  o.andon = { reason, at: new Date().toISOString().slice(0, 19), by: userName(ctx.userId) }
  w.activity.push(A(ctx, `Hold / Andon at op ${no}: ${reason}; labor paused; dispatch flagged; supervisor notified${reason.startsWith("Machine down") ? "; maintenance list notified" : ""}`))
  ctx.emit("production.andonRaised", { woId: w.id, op: no, wcId: o.workCenterId, reason })
}
export function clearAndon(d: S, ctx: MutateCtx, woId: string, no: number) {
  const w = wo(d, woId)
  const o = opOf(w, no)
  if (!o.andon) throw new ProtoError("No hold on this operation.")
  w.activity.push(A(ctx, `Andon cleared at op ${no} (${o.andon.reason})`))
  o.andon = undefined
}

// ============================================================================ Rework orders (RWO-001)
export const RECEIVER: Record<PPReworkOrder["originKind"], string> = {
  "Production rework": "Parent WO (costs merge before its settlement)",
  "Test failure": "Parent WO (costs merge before its settlement)",
  "NCR disposition": "Parent WO (production-caused)",
  "RMA warranty": "2610 Warranty Reserve (overflow 6300)",
  "RMA billable": "5130 COGS-Service; service invoice 4150",
  "NCR vendor-caused": "1355 vendor claim receivable when a recovery agreement exists, else 5320",
}
export function createRwo(d: S, ctx: MutateCtx, x: { originKind: PPReworkOrder["originKind"]; origin: DocRef; parentWoId?: string; originOp?: number; itemId: string; serial?: string; qty: number; title: string }) {
  if (!x.title.trim()) throw new ProtoError("Give the rework order a title.", "title")
  if (x.qty <= 0) throw new ProtoError("Quantity must be at least 1.", "qty")
  const id = `RWO-2026-${pad(next(d) % 10000, 4)}` as PPReworkOrder["id"]
  const parent = x.parentWoId ? ` ${x.parentWoId}` : ""
  const r: PPReworkOrder = {
    id, title: x.title, origin: x.origin, originKind: x.originKind, parentWoId: x.parentWoId as ProductionOrderId | undefined, originOp: x.originOp,
    receiver: RECEIVER[x.originKind].replace("Parent WO", `Parent WO${parent}`), status: "Open", itemId: x.itemId as MaterialId, serial: x.serial, qty: x.qty,
    reinspection: x.originKind === "Test failure" || x.originKind.startsWith("RMA") ? "required" : "not required", laborRate: 64, ops: [], materials: [], createdOn: ctx.today as ISODate,
    activity: [A(ctx, `Created from ${x.origin.type === "productionOrder" ? `${x.origin.id}${x.originOp ? ` op ${x.originOp}` : ""}` : x.origin.id} (${x.originKind})`)],
  }
  d.reworkOrders.unshift(r)
  ctx.emit("production.reworkOrderCreated", { rwoId: id, origin: x.origin })
  return id
}
const rwo = (d: S, id: string) => {
  const r = d.reworkOrders.find((x) => x.id === id)
  if (!r) throw new ProtoError(`${id} not found.`)
  if (r.status === "Settled") throw new ProtoError(`${id} is Settled: read-only.`)
  return r
}
export function addRwoOp(d: S, ctx: MutateCtx, id: string, wcId: WorkCenterId, text: string, hours: number) {
  const r = rwo(d, id)
  if (r.status === "Completed") throw new ProtoError(`${id} is Completed.`)
  if (!text.trim()) throw new ProtoError("Describe the operation.", "text")
  if (!(hours > 0)) throw new ProtoError("Hours must be more than zero.", "hours")
  const no = Math.max(0, ...r.ops.map((o) => o.no)) + 10
  r.ops.push({ no, workCenterId: wcId, text, hours, done: false })
  r.activity.push(A(ctx, `Op ${no} added at ${wcId}: ${text}`))
}
export function confirmRwoOp(d: S, ctx: MutateCtx, id: string, no: number) {
  const r = rwo(d, id)
  const o = r.ops.find((x) => x.no === no)
  if (!o || o.done) throw new ProtoError("Operation already done or missing.")
  o.done = true
  if (r.status === "Open") {
    r.status = "In Progress"
    r.activity.push(A(ctx, "Open → In Progress"))
  }
  post(d, ctx, "RWK", o.hours * r.laborRate, { type: "reworkOrder", id: r.id }, `Rework op ${no} ${o.workCenterId}: ${o.hours} h collected in 1325 (actuals, no standard)`, 0, o.hours * r.laborRate)
  r.activity.push(A(ctx, `Op ${no} confirmed: ${o.hours} h at ${r.laborRate}/h to 1325`))
}
export function addRwoMaterial(d: S, ctx: MutateCtx, id: string, materialId: MaterialId, qty: number, lot?: string) {
  const r = rwo(d, id)
  if (r.status === "Completed") throw new ProtoError(`${id} is Completed.`)
  if (!(qty > 0)) throw new ProtoError("Quantity must be more than zero.", "qty")
  const value = round2(std(materialId) * qty)
  r.materials.push({ materialId, qty, value, lot })
  if (r.status === "Open") {
    r.status = "In Progress"
    r.activity.push(A(ctx, "Open → In Progress"))
  }
  post(d, ctx, "RWK", value, { type: "reworkOrder", id: r.id }, `Rework material ${materialId} × ${qty}${lot ? ` (${lot})` : ""} collected in 1325`, 0, value)
  r.activity.push(A(ctx, `Material ${materialId} × ${qty} added (${value.toFixed(2)} USD)`))
}
export function requestReinspection(d: S, ctx: MutateCtx, id: string) {
  const r = rwo(d, id)
  if (r.reinspection !== "required") throw new ProtoError("This origin does not require re-inspection.")
  if (!r.ops.length || r.ops.some((o) => !o.done)) throw new ProtoError("Confirm every rework operation before re-inspection.")
  if (r.reinspectionRequestedOn && !r.reinspectionResult) throw new ProtoError("Re-inspection already requested.")
  r.reinspectionRequestedOn = ctx.today as ISODate
  r.reinspectionResult = undefined
  const lot = `IL-TBD-${pad(next(d), 4)}`
  r.activity.push(A(ctx, `Re-inspection requested (${lot})`))
  ctx.emit("production.inspectionRequested", { woId: r.parentWoId ?? r.id, op: 0, gate: "Re-inspection", inspectionId: lot, subject: { type: "reworkOrder", id: r.id } })
}
export function recordReinspection(d: S, ctx: MutateCtx, id: string, passed: boolean) {
  const r = rwo(d, id)
  if (!r.reinspectionRequestedOn) throw new ProtoError("Request the re-inspection first.")
  r.reinspectionResult = passed ? "Passed" : "Failed"
  r.activity.push(A(ctx, `Re-inspection ${r.reinspectionResult}`, "Quality"))
  if (!passed) r.reinspectionRequestedOn = undefined
}
export function completeRwo(d: S, ctx: MutateCtx, id: string) {
  const r = rwo(d, id)
  if (r.status === "Completed") throw new ProtoError(`${id} is already Completed.`)
  if (!r.ops.length) throw new ProtoError("Add at least one operation.")
  if (r.ops.some((o) => !o.done)) throw new ProtoError("Confirm every operation first.")
  if (r.reinspection === "required" && r.reinspectionResult !== "Passed") throw new ProtoError("Re-inspection is mandatory before Complete for this origin (test failure or RMA) and has not passed.")
  r.activity.push(A(ctx, `${r.status} → Completed`))
  r.status = "Completed"
  // a test-failure rework on a parent WO: the final test is requested again at the terminal
}
export function rwoBalance(d: Pick<S, "journal">, id: string) {
  return round2(d.journal.filter((j) => j.source.id === id || j.rwoId === id).reduce((a, j) => a + j.wip1325, 0))
}
/** Settlement by origin [DOC:p.79 §9] (asserted): #33 production-caused to the parent WO, #21 warranty, #22 billable;
 *  vendor-caused goes to 1355 or 5320 (no template number in the posting table). */
export function settleRwo(d: S, ctx: MutateCtx, id: string) {
  const r = rwo(d, id)
  if (r.status !== "Completed") throw new ProtoError(`${id} is ${r.status}: settle a Completed rework order.`)
  const bal = rwoBalance(d, id)
  if (r.parentWoId && ["Production rework", "Test failure", "NCR disposition"].includes(r.originKind)) {
    const p = wo(d, r.parentWoId)
    if (p.status === "Closed (TECO)" || p.status === "Cancelled") throw new ProtoError(`Parent ${p.id} is ${p.status}: production rework merges before the parent's settlement.`)
    post(d, ctx, 33, bal, { type: "productionOrder", id: p.id }, `${r.id} settled into parent: 1325 → 1320`, bal, -bal, { rwoId: r.id })
    p.activity.push(A(ctx, `${r.id} rework costs merged (#33): ${bal.toFixed(2)} USD`))
  } else if (r.originKind === "RMA warranty") post(d, ctx, 21, bal, { type: "reworkOrder", id: r.id }, "Warranty repair settlement: 2610 Warranty Reserve", 0, -bal)
  else if (r.originKind === "RMA billable") post(d, ctx, 22, bal, { type: "reworkOrder", id: r.id }, "Billable repair: 5130 COGS-Service; service invoice raised", 0, -bal)
  else post(d, ctx, "RWK", bal, { type: "reworkOrder", id: r.id }, "Vendor-caused: to 5320 (no recovery agreement on file)", 0, -bal)
  r.status = "Settled"
  r.settledOn = ctx.today as ISODate
  r.activity.push(A(ctx, `Completed → Settled to ${r.receiver} (${bal.toFixed(2)} USD)`))
}

// ============================================================================ Subscriptions
export function onEngineeringMbomActivated(d: S, ctx: MutateCtx, mbomId: string, ebomId: string) {
  for (const p of d.plannedOrders.filter((p) => p.mbomId === mbomId || p.ebomId === ebomId)) {
    p.mbomActive = true
    p.activity.push(A(ctx, `MBOM ${mbomId} activated (engineering.mbomActivated)`, "System"))
    if (p.routingReleased) for (const x of d.exceptions.filter((x) => x.code === "EX-07" && x.supply?.id === p.id && !x.resolved)) x.resolved = { action: "Cleared", by: "System", on: ctx.today as ISODate, note: `MBOM ${mbomId} activated` }
  }
  for (const w of d.productionOrders.filter((w) => w.status === "Created" && d.plannedOrders.some((p) => p.convertedTo === w.id && (p.mbomId === mbomId || p.ebomId === ebomId)))) {
    w.gateInputs.mbomActive = true
    w.activity.push(A(ctx, `MBOM ${mbomId} activated: release check 1 (MBOM side) clears`, "System"))
  }
}
/** SO confirmation [DOC:p.193 §4] (asserted): the accepted soft reservation of THIS order's quote
 *  (same customer, same quote, same item) converts to firm load; every MTO / ETO line gets a promise
 *  check on the order (the CTP-DLG arrival "order confirmation for MTO and ETO"). */
export function onSalesOrderConfirmed(d: S, ctx: MutateCtx, p: { soId: SalesOrderId; type: OrderType; lines: { no: number; itemId: string; qty: number }[]; customerId?: string; quoteRef?: string; requestedShip?: string }) {
  if (p.type !== "MTO" && p.type !== "ETO") return
  const base = (id: string) => id.replace(/-V\d+$/, "")
  for (const l of p.lines) {
    const soft = p.quoteRef && p.customerId
      ? d.promises.find((c) => c.doc.type === "quotation" && base(c.doc.id) === base(p.quoteRef!) && c.customerId === p.customerId && c.itemId === l.itemId && act_accepted(c) && c.reservation?.kind === "Soft")
      : undefined
    if (soft) {
      soft.reservation = { ...soft.reservation!, kind: "Firm", expires: undefined }
      soft.log.push(A(ctx, `${p.soId} confirmed: soft capacity reservation converted to firm load`, "System"))
    }
    if (!d.promises.some((c) => c.doc.type === "salesOrder" && c.doc.id === p.soId && c.line === l.no)) {
      const id = `CTP-TBD-${pad(next(d), 4)}`
      d.promises.unshift({
        id, doc: { type: "salesOrder", id: p.soId }, line: l.no, customerId: p.customerId ?? soft?.customerId ?? "CUS-TBD-0000", itemId: l.itemId as MaterialId, qty: l.qty, orderType: p.type,
        requestedDate: (p.requestedShip ?? soft?.requestedDate ?? addWorkdays(TODAY as ISODate, 60)) as ISODate,
        decision: soft ? "Accepted" : "Not checked", result: soft?.result,
        reservation: soft ? { kind: "Firm", on: ctx.today as ISODate, snapshotId: soft.reservation!.snapshotId } : undefined,
        log: [A(ctx, soft ? `Opened at ${p.soId} confirmation from ${soft.id} (${soft.doc.id}); firm load` : `Opened at ${p.soId} confirmation (${p.type} line ${l.no}); run the check`, "System")],
      })
    }
    if (!d.plannedOrders.some((x) => x.peg?.soId === p.soId && x.peg.line === l.no)) {
      const m = MATERIALS.find((x) => x.id === l.itemId)
      if (m?.type === "FIN") {
        const plo = newPlanned(d, ctx, l.itemId as MaterialId, l.qty, addWorkdays(TODAY as ISODate, 60), { soId: p.soId, line: l.no, sched: 10 })
        plo.activity = [A(ctx, `Proposed by net change after ${p.soId} confirmation; pegged line ${l.no} schedule 10`, "System")]
      }
    }
  }
}
const act_accepted = (c: PromiseCandidate) => c.decision === "Accepted" && !(c.reservation?.expires && c.reservation.expires < TODAY)
export function onInspectionClosed(d: S, ctx: MutateCtx, lotId: string, subject: DocRef, passed: boolean) {
  if (subject.type === "productionOrder") {
    const w = d.productionOrders.find((x) => x.id === subject.id)
    const o = w?.operations.find((x) => x.inspection?.id === lotId && !x.inspection.result)
    if (w && o) recordInspection(d, ctx, w.id, o.no, passed ? "Passed" : "Failed", "Quality (QM-INSP)")
  } else if (subject.type === "reworkOrder") {
    const r = d.reworkOrders.find((x) => x.id === subject.id)
    if (r && r.reinspectionRequestedOn && !r.reinspectionResult) recordReinspection(d, ctx, r.id, passed)
  }
}
/** Containment puts open WOs consuming the recalled stock On Hold. */
export function onRecallStage(d: S, ctx: MutateCtx, recallId: string, stage: RecallStage) {
  if (stage !== "Contain") return
  const blocked = new Set<string>(d.batches.filter((b) => b.stock === "Blocked").map((b) => b.id))
  for (const w of d.productionOrders.filter((x) => ["Created", "Released", "In Progress", "Testing"].includes(x.status))) {
    const hit = d.serials.some((s) => s.woId === w.id && s.batchId && blocked.has(s.batchId)) || w.operations.some((o) => o.components.some((c) => c.lots.some((l) => blocked.has(l))))
    if (!hit) continue
    w.previousStatus = w.status
    w.status = "On Hold"
    w.holdReason = `Recall containment ${recallId}: blocked stock reserved or issued`
    w.activity.push(A(ctx, `${w.previousStatus} → On Hold (quality.recallStageChanged ${recallId} Contain)`, "System"))
  }
}
