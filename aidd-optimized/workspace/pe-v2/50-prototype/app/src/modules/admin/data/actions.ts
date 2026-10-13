// Admin actions. Each is one atomic store.mutate("admin", ...) (or a shared-engine call) that
// returns {ok, value} or {ok:false, error}. Rules cite the PRD; readings carry an AR-n id (README).

import type { ApprovalRequestId, DocRef, FiscalPeriodStatus, LegalEntityId, Role, UserId } from "@/data/domain"
import { roleGroupOf } from "@/data/domain"
import { TODAY, USERS } from "@/data/shared"
import { ProtoError, store, type ApprovalRequest, type MutateCtx, type Result } from "@/store"
import { addDays } from "@/lib/format"
import { INTERFACES, SEVERITIES, W4_ALL, escalationOf, fillMsg, jobById, w4ById, type Severity } from "./catalog"
import { NOW, periodId } from "./seed"
import type { AdminState } from "./slice"
import type { Channel, DefStep, Delegation, InstEffect, InstOutcome, InstStep, Rule, Subject, WfInstance } from "./types"
import { canAct, fromAdmin, fromShared, runOf } from "../lib/engine"
import { rPer01 } from "../lib/period"
import { addHours, nextMonth } from "../lib/time"

const mutate = <T,>(fn: (d: AdminState, ctx: MutateCtx) => T): Result<T> => store.mutate("admin", fn)
const admin = () => store.getSlice("admin")

// ============================================================================ admin engine: raise
export interface RaiseInput {
  wfId: string
  kindLabel: string
  subject: Subject
  title: string
  amount?: number
  currency?: "USD" | "CAD"
  steps?: Role[]
  /** Names of conditional steps whose rule fired (DefStep.when). */
  conditions?: string[]
  effect?: InstEffect
  reading?: string
}
function activeVersion(d: AdminState, wfId: string) {
  const def = d.definitions.find((x) => x.id === wfId)
  return def?.versions.filter((v) => v.state === "Active" && v.effectiveFrom <= TODAY).sort((a, b) => b.version - a.version)[0]
}
/** Raise a request on the admin engine queue, using the definition version in force today
 *  (in-flight instances complete on the version they started [DOC:p.11 W.1]). */
export function raiseIn(d: AdminState, ctx: MutateCtx, input: RaiseInput): WfInstance {
  const open = d.instances.find((i) => !i.outcome && i.wfId === input.wfId && sameSubject(i.subject, input.subject))
  if (open) throw new ProtoError(`${open.id} is already open for ${subjectId(input.subject)}; decide or recall it first.`)
  const v = activeVersion(d, input.wfId)
  // Conditional steps (e.g. "budget check fails") join only when the raiser names the rule that fired.
  const base: { role: Role; slaHours: number; parallel?: boolean; approver?: DefStep["approver"] }[] = input.steps
    ? input.steps.map((role) => ({ role, slaHours: v?.steps.find((x) => x.role === role)?.slaHours ?? 24 }))
    : ((v?.steps ?? [{ role: "Controller" as Role, slaHours: 24 }]) as Partial<DefStep>[] as DefStep[]).filter((x) => !x.when || input.conditions?.includes(x.when))
  const steps: InstStep[] = base.map((st) => ({
    role: st.role, slaHours: st.slaHours, escalateTo: escalationOf(st.role), parallel: st.parallel ?? (v?.steps.find((x) => x.role === st.role)?.parallel),
    ...(st.approver?.kind === "user" && st.approver.userId ? { approverUser: st.approver.userId as UserId } : {}),
    ...(st.approver?.kind === "derived" ? { derived: st.approver.derived } : {}),
  }))
  // The first run opens now (a parallel run opens together).
  const [, last] = runOf(steps, 0)
  for (let n = 0; n <= last; n++) steps[n].openedAt = NOW
  const w = w4ById(input.wfId)
  const id = `APR-TBD-${String(d.seq++).padStart(4, "0")}` as const
  const inst: WfInstance = {
    id, wfId: input.wfId, kindLabel: input.kindLabel, version: v?.version ?? 1, subject: input.subject, title: input.title, amount: input.amount, currency: input.currency ?? (input.amount != null ? "USD" : undefined),
    raisedBy: ctx.role, raisedByUser: ctx.userId, raisedAt: NOW, steps, delegationAllowed: !((w?.financial ?? false) && (input.amount ?? 0) > 250_000),
    rounds: [], effect: input.effect, reading: input.reading ?? w?.reading,
  }
  d.instances.unshift(inst)
  d.audit.push({ at: NOW, requestId: id, action: "Raised", by: ctx.userId, role: ctx.role, channel: "In-app" })
  if ("ref" in input.subject) ctx.link({ from: { type: "approval", id }, to: input.subject.ref, kind: "approves", note: input.kindLabel })
  return inst
}
const subjectId = (s: Subject) => ("ref" in s ? s.ref.id : s.loose.id)
const sameSubject = (a: Subject, b: Subject) => subjectId(a) === subjectId(b)

// ============================================================================ decide (both queues)
export function decide(requestId: string, outcome: "Approved" | "Rejected", reason?: string, channel: Channel = "In-app"): Result<string> {
  const core = store.getCore()
  const shared = core.approvals.find((a) => a.id === requestId)
  if (shared) {
    const row = fromShared(shared, admin())
    const chk = canAct(row, core.role, core.userId, admin().delegations)
    if (!chk.can) return { ok: false, error: chk.reason ?? "Not allowed." }
    if (outcome === "Rejected" && !reason?.trim()) return { ok: false, error: "A reason is required to reject.", field: "reason" }
    const actor = { role: core.role, userId: core.userId }
    const stepRole = row.steps[chk.stepIndex ?? row.current].role
    // A delegate acts in the step role's seat on the shared engine (R-4); the real actor is logged here.
    if (chk.asDelegate) store.setRole(stepRole)
    const r = store.decideApproval(shared.id, outcome, reason)
    if (chk.asDelegate) store.setRole(actor.role)
    if (!r.ok) return r
    mutate((d) => {
      d.audit.push({ at: NOW, requestId, action: outcome, by: actor.userId, role: actor.role, channel, comment: reason, onBehalfOf: chk.asDelegate?.fromUser, stepRole: chk.asDelegate ? stepRole : undefined })
    })
    return { ok: true, value: r.value.outcome ? `${requestId}: ${r.value.outcome.toLowerCase()}, all steps done.` : `${requestId}: step approved, sent to the ${r.value.steps.find((s) => !s.decided)?.role}.` }
  }
  return mutate((d, ctx) => {
    const i = d.instances.find((x) => x.id === requestId)
    if (!i) throw new ProtoError(`Request ${requestId} not found.`)
    const row = fromAdmin(i, d)
    const chk = canAct(row, ctx.role, ctx.userId, d.delegations)
    if (!chk.can) throw new ProtoError(chk.reason ?? "Not allowed.")
    if (outcome === "Rejected" && !reason?.trim()) throw new ProtoError("A reason is required to reject.", "reason")
    const idx = chk.stepIndex ?? row.current
    const st = i.steps[idx]
    // R-PER-01 holds at the moment a reopen lands, not only when it is raised [DOC:p.42 §9.3].
    const lastApproval = outcome === "Approved" && row.open.length === 1 && !i.steps.some((x, n) => n > idx && !x.decided)
    if (lastApproval && i.effect?.type === "periodReopen") {
      const eff = i.effect
      const p = d.periods.find((x) => x.id === eff.periodId)
      if (p) {
        const { soft } = rPer01(d.periods, p.entityId)
        if (soft.length) throw new ProtoError(`R-PER-01: ${soft[0].month} is in Soft Close for this entity, so reopening ${p.month} would give it two Soft Close periods. Hard close ${soft[0].month} first, then decide this reopen (or reject it with a comment).`)
      }
    }
    st.decided = { outcome, by: ctx.userId, role: ctx.role, on: NOW, reason, channel, onBehalfOf: chk.asDelegate?.fromUser }
    d.audit.push({ at: NOW, requestId, action: outcome, by: ctx.userId, role: ctx.role, channel, comment: reason, onBehalfOf: chk.asDelegate?.fromUser })
    if (outcome === "Approved") {
      // A parallel run (CCB votes) completes only when every member has approved.
      const waiting = i.steps.filter((x, n) => n !== idx && !x.decided && runOf(i.steps, idx)[0] <= n && n <= runOf(i.steps, idx)[1])
      if (waiting.length) return `${requestId}: vote recorded, still waiting for the ${waiting.map((x) => x.role).join(" and ")}.`
      const nextIdx = i.steps.findIndex((x) => !x.decided)
      if (nextIdx >= 0) {
        const [a, b] = runOf(i.steps, nextIdx)
        for (let n = a; n <= b; n++) i.steps[n].openedAt = NOW
        return `${requestId}: step approved, sent to the ${i.steps.slice(a, b + 1).map((x) => x.role).join(" and ")}.`
      }
    }
    i.outcome = outcome
    applyEffect(d, ctx, i)
    ctx.emit("admin.workflowDecided", { requestId: i.id, wfId: i.wfId, subject: "ref" in i.subject ? i.subject.ref : { id: i.subject.loose.id, route: i.subject.loose.route }, outcome, by: ctx.role })
    return `${requestId}: ${outcome === "Approved" ? "approved, all steps done" : "rejected; returned to the initiator with your comment"}.`
  })
}

/** Terminal actions of admin-engine workflows (status transition, release) [DOC:p.10 W.1]. */
function applyEffect(d: AdminState, ctx: MutateCtx, i: WfInstance) {
  const e = i.effect
  if (!e) return
  const ok = i.outcome === "Approved"
  if (e.type === "periodReopen") {
    const p = d.periods.find((x) => x.id === e.periodId)!
    if (!ok) return
    p.history.push({ at: NOW, from: p.status, to: "Soft Close", by: ctx.userId, note: `Reopen ${i.id} (Controller + CFO)` })
    p.status = "Soft Close"
    p.reopen = { reason: i.title, requestId: i.id, openedAt: NOW }
    ctx.emit("finance.periodStatusChanged", { entityId: p.entityId, month: p.month, status: "Soft Close" })
  }
  if (e.type === "defVersion") {
    const v = d.definitions.find((x) => x.id === e.wfId)?.versions.find((x) => x.version === e.version)
    if (v) v.state = ok ? (v.effectiveFrom <= TODAY ? "Active" : "Scheduled") : "Rejected"
  }
  if (e.type === "configChange") {
    const s = d.settings.find((x) => x.id === e.settingId)
    const v = s?.versions.find((x) => x.changeId === e.changeId)
    if (s && v) {
      v.state = ok ? (v.effectiveFrom <= TODAY ? "Active" : "Scheduled") : "Rejected"
      if (ok) ctx.emit("admin.configChanged", { settingId: s.id, value: v.value, effectiveFrom: v.effectiveFrom })
    }
  }
  if (e.type === "taxRate") {
    const r = d.tax.manualRates.find((x) => x.id === e.rateId)
    if (!r) return
    r.state = ok ? "Active" : "Rejected"
    if (ok)
      for (const o of d.tax.manualRates)
        if (o !== r && o.jurisdiction === r.jurisdiction && o.state === "Active" && !o.validTo) {
          o.validTo = addDays(r.validFrom, -1)
          o.state = "Superseded"
        }
    if (ok) d.tax.audit.push({ at: NOW, by: ctx.userId, change: `Manual rate ${r.jurisdiction} ${r.ratePct}% (new dated row, ${i.id})`, effectiveFrom: r.validFrom, firstDocument: "First document with tax point on or after the effective date" })
  }
  if (e.type === "taxAdjustment") {
    const r = d.tax.recon.find((x) => x.id === e.reconId)
    if (r && ok) {
      r.explained = Math.round((r.avalaraTax - r.glTax) * 100) / 100
      d.tax.audit.push({ at: NOW, by: ctx.userId, change: `Tax adjustment JE for ${r.month} approved (${i.id}); remittance correction, no document restated`, effectiveFrom: TODAY, firstDocument: "None (tax-only adjustment JE)" })
    }
  }
  if (e.type === "seriesChange") {
    const ns = d.series.find((x) => x.id === e.seriesId)
    const v = ns?.changes.find((x) => x.changeId === e.changeId)
    if (ns && v) v.state = ok ? "Scheduled" : "Rejected"
    if (ns && v && ok) ctx.emit("admin.configChanged", { settingId: ns.id, value: `${v.format}, next ${v.next}`, effectiveFrom: v.effectiveFrom })
  }
  if (e.type === "sodGrant") {
    const s = d.sod.find((x) => x.id === e.sodId)
    if (s) s.state = ok ? "Active" : "Expired"
  }
}

// ============================================================================ delegate, recall, resubmit
export function delegateStep(requestId: string, toUser: UserId, toRole: Role, days: number, reason: string): Result<string> {
  return mutate((d, ctx) => {
    const core = store.getCore()
    const shared = core.approvals.find((a) => a.id === requestId)
    const inst = d.instances.find((x) => x.id === requestId)
    const row = shared ? fromShared(shared, d) : inst ? fromAdmin(inst, d) : undefined
    if (!row) throw new ProtoError(`Request ${requestId} not found.`)
    if (row.outcome) throw new ProtoError("The request is decided; nothing to delegate.")
    const mine = row.open.find((n) => row.steps[n].role === ctx.role)
    if (mine == null) throw new ProtoError(`Only the ${row.steps[row.open[0]].role} can delegate this step.`)
    if (!row.delegationAllowed) throw new ProtoError("Delegation is not allowed on a financial approval above $250,000 (C-2).")
    if (toUser === ctx.userId) throw new ProtoError("Choose someone other than yourself.", "toUser")
    if (!reason.trim()) throw new ProtoError("A reason is required; delegation is logged on every action.", "reason")
    const id = `DLG-TBD-${String(d.delegations.length + 1).padStart(4, "0")}`
    d.delegations.unshift({ id, fromUser: ctx.userId, fromRole: ctx.role, toUser, toRole, validFrom: TODAY, validTo: addDays(TODAY, days), scope: [row.wfId], reason, createdBy: ctx.userId, createdOn: TODAY, requestId })
    d.audit.push({ at: NOW, requestId, action: "Delegated", by: ctx.userId, role: ctx.role, channel: "In-app", comment: `To ${toRole} until ${addDays(TODAY, days)}: ${reason}` })
    return `${requestId} step ${mine + 1} delegated (${id}).`
  })
}

export function recall(requestId: string, reason: string): Result<string> {
  const sharedReq = store.getCore().approvals.find((a) => a.id === requestId)
  if (sharedReq) return recallShared(sharedReq, reason)
  return mutate((d, ctx) => {
    const i = d.instances.find((x) => x.id === requestId)
    if (!i) throw new ProtoError(`Request ${requestId} not found.`)
    if (i.outcome) throw new ProtoError(`${requestId} is already ${i.outcome.toLowerCase()}.`)
    if (i.raisedBy !== ctx.role) throw new ProtoError(`Only the initiator (${i.raisedBy}) can recall.`)
    if (i.steps.some((s) => s.decided)) throw new ProtoError("The initiator may recall only before the first approval [DOC:p.11 W.1].")
    i.outcome = "Recalled"
    d.audit.push({ at: NOW, requestId, action: "Recalled", by: ctx.userId, role: ctx.role, channel: "In-app", comment: reason })
    applyEffect(d, ctx, { ...i, outcome: "Rejected" })
    ctx.emit("admin.workflowDecided", { requestId: i.id, wfId: i.wfId, subject: "ref" in i.subject ? i.subject.ref : { id: i.subject.loose.id, route: i.subject.loose.route }, outcome: "Recalled", by: ctx.role })
    return `${requestId} recalled.`
  })
}

/** Recall on the shared engine, done from here (R-3): the core has no recall, so the open step is closed as a rejection
 *  (modules react to approval.decided) and this slice marks the request Recalled, with the initiator's reason on the audit trail. */
function recallShared(req: ApprovalRequest, reason: string): Result<string> {
  const core = store.getCore()
  const row = fromShared(req, admin())
  if (row.outcome) return { ok: false, error: `${req.id} is already ${row.outcome.toLowerCase()}.` }
  if (req.raisedBy !== core.role) return { ok: false, error: `Only the initiator (${req.raisedBy}) can recall.` }
  if (req.steps.some((s) => s.decided)) return { ok: false, error: "The initiator may recall only before the first approval [DOC:p.11 W.1]." }
  if (!reason.trim()) return { ok: false, error: "A reason is required.", field: "reason" }
  const actor = { role: core.role, userId: core.userId }
  const stepRole = req.steps[0].role
  store.setRole(stepRole)
  const r = store.decideApproval(req.id, "Rejected", `Recalled by the initiator: ${reason}`)
  store.setRole(actor.role)
  if (!r.ok) return r
  mutate((d) => {
    d.sharedLineage[req.id] = { recalled: true, rounds: d.sharedLineage[req.id]?.rounds ?? [] }
    d.audit.push({ at: NOW, requestId: req.id, action: "Recalled", by: actor.userId, role: actor.role, channel: "In-app", comment: reason })
  })
  return { ok: true, value: `${req.id} recalled.` }
}

/** Resubmit on the shared engine: the closed request is kept as an earlier round and a new request is raised for the same
 *  document, linked to it (the core cannot reopen a decided request, so the id changes; the history travels with it). */
function resubmitShared(req: ApprovalRequest, note: string): Result<string> {
  const core = store.getCore()
  const row = fromShared(req, admin())
  if (row.outcome !== "Rejected" && row.outcome !== "Recalled") return { ok: false, error: "Only a rejected or recalled request can be resubmitted." }
  if (req.raisedBy !== core.role) return { ok: false, error: `Only the initiator (${req.raisedBy}) can resubmit.` }
  if (!note.trim()) return { ok: false, error: "Say what changed.", field: "reason" }
  const prior = admin().sharedLineage[req.id]?.rounds ?? []
  const closed = { steps: row.steps.map((s): InstStep => ({ role: s.role, slaHours: s.slaHours, escalateTo: s.escalateTo, openedAt: s.openedAt, decided: s.decided && { ...s.decided, role: s.role, channel: s.decided.channel ?? "In-app" } })), outcome: row.outcome as InstOutcome, closedAt: row.steps.find((s) => s.decided?.outcome === "Rejected")?.decided?.on ?? NOW }
  const next = store.raiseApproval({ kind: req.kind, subject: req.subject, title: req.title, amount: req.amount, currency: req.currency, note: `Resubmitted from ${req.id}: ${note}` })
  if (next.id === req.id) return { ok: false, error: "The request is still open." }
  mutate((d, ctx) => {
    d.sharedLineage[next.id] = { rounds: [...prior, { ...closed, closedAt: closed.closedAt.length === 10 ? `${closed.closedAt}T12:00` : closed.closedAt }] }
    d.audit.push({ at: NOW, requestId: next.id, action: "Resubmitted", by: ctx.userId, role: ctx.role, channel: "In-app", comment: `Round ${prior.length + 2}, from ${req.id}: ${note}` })
  })
  return { ok: true, value: `${req.id} resubmitted as ${next.id}; history kept (round ${prior.length + 2}).` }
}

export function resubmit(requestId: string, note: string): Result<string> {
  const sharedReq = store.getCore().approvals.find((a) => a.id === requestId)
  if (sharedReq) return resubmitShared(sharedReq, note)
  return mutate((d, ctx) => {
    const i = d.instances.find((x) => x.id === requestId)
    if (!i) throw new ProtoError(`Request ${requestId} not found.`)
    if (i.outcome !== "Rejected" && i.outcome !== "Recalled") throw new ProtoError("Only a rejected or recalled request can be resubmitted.")
    if (i.raisedBy !== ctx.role) throw new ProtoError(`Only the initiator (${i.raisedBy}) can resubmit.`)
    if (!note.trim()) throw new ProtoError("Say what changed.", "reason")
    i.rounds.push({ steps: structuredClone(i.steps), outcome: i.outcome, closedAt: NOW })
    i.steps = i.steps.map((s) => ({ role: s.role, slaHours: s.slaHours, escalateTo: s.escalateTo, approverUser: s.approverUser, derived: s.derived, parallel: s.parallel }))
    for (let n = 0; n <= runOf(i.steps, 0)[1]; n++) i.steps[n].openedAt = NOW
    i.outcome = undefined
    if (i.effect?.type === "defVersion") {
      const v = d.definitions.find((x) => x.id === (i.effect as { wfId: string }).wfId)?.versions.find((x) => x.version === (i.effect as { version: number }).version)
      if (v) v.state = "Pending co-sign"
    }
    if (i.effect?.type === "configChange") {
      const ef = i.effect
      const v = d.settings.find((x) => x.id === ef.settingId)?.versions.find((x) => x.changeId === ef.changeId)
      if (v) v.state = "Pending approval"
    }
    if (i.effect?.type === "seriesChange") {
      const ef = i.effect
      const v = d.series.find((x) => x.id === ef.seriesId)?.changes.find((x) => x.changeId === ef.changeId)
      if (v) v.state = "Pending approval"
    }
    d.audit.push({ at: NOW, requestId, action: "Resubmitted", by: ctx.userId, role: ctx.role, channel: "In-app", comment: note })
    return `${requestId} resubmitted; history kept (round ${i.rounds.length + 1}).`
  })
}

// ============================================================================ standing delegations
export function addDelegation(input: { toUser: UserId; toRole: Role; validFrom: string; validTo: string; scope: "All workflows" | string[]; reason: string }): Result<string> {
  return mutate((d, ctx) => {
    if (input.toUser === ctx.userId) throw new ProtoError("Choose someone other than yourself.", "toUser")
    if (!input.validFrom || !input.validTo || input.validTo < input.validFrom) throw new ProtoError("Enter a date range that ends after it starts.", "validTo")
    if (input.validTo < TODAY) throw new ProtoError("The range is already over.", "validTo")
    if (!input.reason.trim()) throw new ProtoError("A reason is required.", "reason")
    const id = `DLG-TBD-${String(d.delegations.length + 10).padStart(4, "0")}`
    const dl: Delegation = { id, fromUser: ctx.userId, fromRole: ctx.role, toUser: input.toUser, toRole: input.toRole, validFrom: input.validFrom, validTo: input.validTo, scope: input.scope, reason: input.reason, createdBy: ctx.userId, createdOn: TODAY }
    d.delegations.unshift(dl)
    return `${id} saved. Financial approvals above $250,000 stay with you (C-2).`
  })
}
export function revokeDelegation(id: string): Result<string> {
  return mutate((d, ctx) => {
    const dl = d.delegations.find((x) => x.id === id)
    if (!dl) throw new ProtoError(`${id} not found.`)
    if (dl.fromUser !== ctx.userId) throw new ProtoError("Only the person who delegated can revoke it.")
    dl.revokedOn = TODAY
    return `${id} revoked.`
  })
}

// ============================================================================ WF-DEF: versions
export function saveVersion(wfId: string, draft: { effectiveFrom: string; steps: DefStep[]; rules: Rule[]; changeNote: string }): Result<string> {
  return mutate((d, ctx) => {
    const w = w4ById(wfId)
    const def = d.definitions.find((x) => x.id === wfId)
    if (!w || !def) throw new ProtoError(`${wfId} not found.`)
    if (ctx.role !== w.ownerRole && ctx.role !== "Process owner") throw new ProtoError(`Changes need the owning role in W.4 (${w.owner} → ${w.ownerRole}) [DOC:p.11 W.1].`)
    if (!draft.effectiveFrom || draft.effectiveFrom <= TODAY) throw new ProtoError("Effective date must be after today: in-flight requests finish on their version and history is never edited (C-50).", "effectiveFrom")
    if (!draft.steps.length) throw new ProtoError("A chain needs at least one step.", "steps")
    if (draft.steps.some((s) => !(s.slaHours > 0))) throw new ProtoError("Every step needs SLA hours above zero.", "steps")
    for (const [n, st] of draft.steps.entries()) {
      if (st.approver?.kind === "user" && !st.approver.userId) throw new ProtoError(`Step ${n + 1}: choose the named user.`, "steps")
      if (st.approver?.kind === "derived" && !st.approver.derived?.trim()) throw new ProtoError(`Step ${n + 1}: name the derived owner (for example Cost Center Manager).`, "steps")
    }
    for (const [n, rl] of draft.rules.entries()) {
      if (!rl.field.trim()) throw new ProtoError(`Rule ${n + 1}: choose the document field.`, "rules")
      if (rl.op !== "is set" && rl.op !== "is true" && !rl.value.trim()) throw new ProtoError(`Rule ${n + 1}: enter the value to compare with.`, "rules")
      if (["<", "<=", ">", ">="].includes(rl.op) && !/\d/.test(rl.value) && !/limit|floor|target|today/.test(rl.value)) throw new ProtoError(`Rule ${n + 1}: ${rl.op} compares numbers or dates; “${rl.value}” is neither.`, "rules")
    }
    if (!draft.changeNote.trim()) throw new ProtoError("Describe the change.", "changeNote")
    if (def.versions.some((v) => v.state === "Pending co-sign")) throw new ProtoError("A version is already waiting for the Controller co-sign.")
    const base = def.versions[def.versions.length - 1]
    const version = Math.max(...def.versions.map((v) => v.version)) + 1
    const gated = w.gatesPosting
    def.versions.push({ ...base, version, effectiveFrom: draft.effectiveFrom, effectiveTo: undefined, steps: draft.steps, rules: draft.rules, changedBy: ctx.userId, changedOn: TODAY, changeNote: draft.changeNote, state: gated ? "Pending co-sign" : "Scheduled", requestId: undefined })
    // The previous scheduled/active version ends the day before.
    for (const v of def.versions) if (v.version !== version && (v.state === "Active" || v.state === "Scheduled") && !v.effectiveTo && v.effectiveFrom < draft.effectiveFrom) v.effectiveTo = addDays(draft.effectiveFrom, -1)
    if (gated) {
      const inst = raiseIn(d, ctx, {
        wfId: "W.1-VER", kindLabel: "Workflow definition change", subject: { loose: { id: `${wfId} v${version}`, label: `Workflow definition · ${w.workflow}`, route: `/configuration/workflows?wf=${wfId}` } },
        title: `${w.workflow} v${version}: ${draft.changeNote}, effective ${draft.effectiveFrom}`, steps: ["Controller"], effect: { type: "defVersion", wfId, version },
        reading: "AR-14: the Controller co-sign required by W.1 Versioning is raised as an approval request",
      })
      def.versions[def.versions.length - 1].requestId = inst.id
      return `v${version} saved; it gates a posting, so ${inst.id} asks the Controller to co-sign.`
    }
    return `v${version} scheduled from ${draft.effectiveFrom}.`
  })
}

// ============================================================================ OPS-JOBS
/** A failed close-critical run pages the on-call role and carries an incident; it is never just logged
 *  [DOC:p.190 Part D §5]. The open incident of the earlier attempt moves to the new run; otherwise one is opened. */
function pageFailure(d: AdminState, run: AdminState["runs"][number], job: NonNullable<ReturnType<typeof jobById>>, previousRunId: string | undefined, by: UserId) {
  if (job.closeCriticality !== "Close-critical" || run.state !== "Failed") return
  const reason = `Close-critical job failed again (attempt ${run.attempt})`
  const inc = previousRunId ? d.incidents.find((i) => i.source.id === previousRunId && i.state !== "Resolved") : undefined
  if (inc) {
    inc.source = { kind: "job", id: run.id }
    inc.paged = [...(inc.paged ?? []), { at: NOW, to: inc.onCall, reason }]
    run.incidentId = inc.id
    return
  }
  const id = `INC-TBD-${String(d.incSeq++).padStart(4, "0")}`
  d.incidents.unshift({ id, severity: "S2", title: `Close-critical job failed: ${job.name}, ${run.entityId ?? ""} ${run.period ?? ""}`.trim(), source: { kind: "job", id: run.id }, openedAt: NOW, openedBy: by, responseDue: addHours(NOW, 1), state: "Open", onCall: "Plant IT", paged: [{ at: NOW, to: "Plant IT", reason }] })
  run.incidentId = id
}

function newRun(d: AdminState, jobId: string, extra: Partial<AdminState["runs"][number]>) {
  const id = `RUN-TBD-${d.runSeq++}`
  const r = { id, jobId, scheduledAt: NOW, startedAt: NOW, endedAt: addHours(NOW, 0.1), state: "Succeeded" as const, attempt: 1, correlationId: `COR-${id.slice(-5)}`, ...extra }
  d.runs.unshift(r)
  return r
}

export function retryRun(runId: string): Result<string> {
  const r = retryRunInner(runId)
  // A retry that ran and failed again is committed (run history) but reported as an error.
  return r.ok && r.value.includes("failed again") ? { ok: false, error: r.value } : r
}
/** Allocation posting (#36) is restricted to the Controller [DOC:pp.180-181 FL-06 field 13]. */
const allocationGate = (jobId: string, role: Role) => {
  if (jobId === "JOB-06" && role !== "Controller") throw new ProtoError("Allocation cycles post #36: allocation posting is restricted to the Controller (FL-06 field 13).")
}
function retryRunInner(runId: string): Result<string> {
  return mutate((d, ctx) => {
    const r = d.runs.find((x) => x.id === runId)
    if (!r) throw new ProtoError(`${runId} not found.`)
    if (r.state !== "Failed") throw new ProtoError("Only a failed run can be retried.")
    if (r.retriedBy) throw new ProtoError(`Already retried by ${r.retriedBy}.`)
    if (d.runs.some((x) => x.jobId === r.jobId && x.entityId === r.entityId && x.period === r.period && x.state === "Succeeded" && x.scheduledAt > r.scheduledAt)) throw new ProtoError("A later run already succeeded.")
    const job = jobById(r.jobId)!
    allocationGate(r.jobId, ctx.role)
    // The warranty accrual failed on a missing determination row: it succeeds only after matrix v14 is released (WF-16).
    if (r.jobId === "JOB-07" && r.entityId === "LE-TBD-10" && d.instances.find((i) => i.id === "APR-TBD-5019")?.outcome !== "Approved") {
      const again = newRun(d, r.jobId, { period: r.period, entityId: r.entityId, attempt: r.attempt + 1, state: "Failed", error: "Same error: release account determination matrix v14 (APR-TBD-5019, WF-16) first, then retry", correlationId: r.correlationId })
      r.retriedBy = again.id
      for (const it of d.preClose) if (it.jobRunId === r.id) it.jobRunId = again.id
      pageFailure(d, again, job, r.id, ctx.userId)
      return `Retry ${again.id} failed again: account 2610 still has no determination row. Release matrix v14 (APR-TBD-5019) in WF-INBOX, then retry ${again.id}.`
    }
    const amount = r.jobId === "JOB-07" ? 41280 : undefined
    const nr = newRun(d, r.jobId, { period: r.period, entityId: r.entityId, attempt: r.attempt + 1, correlationId: r.correlationId, output: amount ? `JE-TBD-W${(r.period ?? "").replace("-", "").slice(2)}-10 posted (#24)` : `${job.output}: done`, posting: amount ? { template: 24, amount } : undefined })
    r.retriedBy = nr.id
    // Close gate: the pre-close item clears; the held dependent runs are released.
    for (const it of d.preClose) if (it.jobRunId === r.id && !it.resolved) it.resolved = { by: ctx.userId, at: NOW, note: `Cleared by ${nr.id}` }
    for (const h of d.runs) if (h.state === "Held (dependency)" && h.entityId === r.entityId && h.period === r.period && jobById(h.jobId)?.dependsOn.includes(r.jobId)) h.state = "Scheduled"
    for (const inc of d.incidents) if (inc.source.id === r.id && inc.state !== "Resolved") inc.state = "Resolved"
    return `${nr.id} succeeded${amount ? `: #24 warranty accrual $${amount.toLocaleString("en-US")} posted` : ""}.`
  })
}

export function runNow(runId: string): Result<string> {
  return mutate((d, ctx) => {
    const r = d.runs.find((x) => x.id === runId)
    if (!r) throw new ProtoError(`${runId} not found.`)
    allocationGate(r.jobId, ctx.role)
    if (r.state === "Held (dependency)") throw new ProtoError(`Held: ${r.error ?? "a job it depends on has not succeeded"}.`)
    if (r.state !== "Scheduled") throw new ProtoError("Only a scheduled run can be started now.")
    const job = jobById(r.jobId)!
    r.state = "Succeeded"
    r.startedAt = NOW
    r.endedAt = addHours(NOW, 0.1)
    r.error = undefined
    r.output = r.jobId === "JOB-06" ? `ALC-${(r.period ?? "").replace("-", "")}-02 posted (#36), net zero; record on CO-ALC` : r.jobId === "JOB-05" ? "Thresholds checked" : `${job.output}: done`
    if (r.jobId === "JOB-05") for (const t of d.tax.thresholds) if (!t.alertRaisedOn && t.rolling12Sales >= 0.8 * t.salesThreshold) t.alertRaisedOn = TODAY
    return `${r.id} ran: ${r.output}.`
  })
}

export function triggerJob(jobId: string, period?: string, entityId?: LegalEntityId): Result<string> {
  return mutate((d, ctx) => {
    const job = jobById(jobId)
    if (!job) throw new ProtoError(`${jobId} not found.`)
    allocationGate(jobId, ctx.role)
    for (const dep of job.dependsOn) {
      const last = d.runs.find((x) => x.jobId === dep && (!entityId || x.entityId === entityId || !x.entityId) && (!period || x.period === period || !x.period))
      if (last && last.state === "Failed") throw new ProtoError(`${job.name} depends on ${jobById(dep)?.name}, whose last run failed (${last.id}).`)
    }
    const r = newRun(d, jobId, { period, entityId, output: `${job.output}: done (manual start)` })
    if (jobId === "JOB-05") for (const t of d.tax.thresholds) if (!t.alertRaisedOn && t.rolling12Sales >= 0.8 * t.salesThreshold) t.alertRaisedOn = TODAY
    return `${r.id} started and finished.`
  })
}

export function escalate(source: { kind: "job" | "message" | "interface"; id: string }, severity: Severity, title: string): Result<string> {
  return mutate((d, ctx) => {
    if (d.incidents.some((i) => i.source.id === source.id && i.state !== "Resolved")) throw new ProtoError(`An open incident already covers ${source.id}.`)
    const sev = SEVERITIES.find((s) => s.id === severity)!
    const id = `INC-TBD-${String(d.incSeq++).padStart(4, "0")}`
    const responseDue = severity === "S1" ? addHours(NOW, 0.25) : severity === "S2" ? addHours(NOW, 1) : "Queued"
    d.incidents.unshift({ id, severity, title, source, openedAt: NOW, openedBy: ctx.userId, responseDue, state: "Open", onCall: "Plant IT" })
    const run = d.runs.find((r) => r.id === source.id)
    if (run) run.incidentId = id
    return `${id} (${severity}: ${sev.response}).`
  })
}
export function setIncident(id: string, state: "Acknowledged" | "Resolved"): Result<string> {
  return mutate((d) => {
    const i = d.incidents.find((x) => x.id === id)
    if (!i) throw new ProtoError(`${id} not found.`)
    i.state = state
    return `${id} ${state.toLowerCase()}.`
  })
}

// ============================================================================ OPS-INT
const EDIT_ROLES: Role[] = ["Plant IT", "Engineering IT", "Quality IT"]
export const canEditPayload = (r: Role) => EDIT_ROLES.includes(r)

export function markFixed(msgId: string, note: string): Result<string> {
  return mutate((d, ctx) => {
    const m = d.messages.find((x) => x.id === msgId)
    if (!m) throw new ProtoError(`${msgId} not found.`)
    if (m.state !== "Dead-lettered" && m.state !== "Retrying") throw new ProtoError("Only a failed message needs a fix.")
    if (!note.trim()) throw new ProtoError("Say what was fixed.", "reason")
    m.fixed = true
    m.envelope = { ...m.envelope, fix_note: note, fixed_by: ctx.userId }
    return `${msgId} marked fixed; replay is now offered.`
  })
}
export function replay(msgIds: string[], editedPayload?: string): Result<string> {
  return mutate((d, ctx) => {
    if (editedPayload != null && !canEditPayload(ctx.role)) throw new ProtoError("Edit-and-replay rights are restricted (Plant IT, Engineering IT, Quality IT) and audited.")
    let n = 0
    for (const id of msgIds) {
      const m = d.messages.find((x) => x.id === id)
      if (!m || (m.state !== "Dead-lettered" && m.state !== "Retrying")) continue
      if (!m.fixed) throw new ProtoError(`${id}: replay after fix. Mark the root cause fixed first.`)
      m.state = "Replayed"
      m.attempts += 1
      if (editedPayload != null) m.editedPayload = editedPayload
      m.envelope = { ...m.envelope, replayed_by: ctx.userId, replayed_at: NOW, ...(editedPayload != null ? { edited: "yes (audited)" } : {}) }
      n++
    }
    if (!n) throw new ProtoError("Nothing to replay in the selection.")
    return `${n} message${n === 1 ? "" : "s"} replayed.`
  })
}
export function discard(msgId: string, reason: string): Result<string> {
  return mutate((d, ctx) => {
    const m = d.messages.find((x) => x.id === msgId)
    if (!m) throw new ProtoError(`${msgId} not found.`)
    if (m.state !== "Dead-lettered" && m.state !== "Retrying") throw new ProtoError("Only a failed message can be discarded.")
    if (!reason.trim()) throw new ProtoError("A reason is mandatory to discard.", "reason")
    const f = INTERFACES.find((x) => x.id === m.interfaceId)
    if (f?.financial && ctx.role !== "Controller") throw new ProtoError(`${f.id} carries a financially relevant command: discard requires the Controller [DOC:p.187 §4].`)
    m.state = "Discarded"
    m.discardReason = reason
    m.envelope = { ...m.envelope, discarded_by: ctx.userId, discarded_at: NOW }
    return `${msgId} discarded.`
  })
}

/** Reconciliation reports [DOC:p.187 §4]: the interface's control from §3 runs now (the schedule is RECON_SCHEDULE);
 *  a failure raises an incident per Part D §5 and is never just logged. Exceptions are the interface's failed
 *  messages that nobody has replayed or discarded. */
export function runRecon(interfaceId: string): Result<string> {
  return mutate((d, ctx) => {
    const f = INTERFACES.find((x) => x.id === interfaceId)
    if (!f) throw new ProtoError(`${interfaceId} not found.`)
    const bad = d.messages.filter((m) => m.interfaceId === interfaceId && (m.state === "Dead-lettered" || m.state === "Retrying"))
    const id = `REC-${interfaceId}-${String(1100 + d.reconSeq++)}`
    if (!bad.length) {
      d.recon.unshift({ id, interfaceId, at: NOW, by: ctx.userId, result: "Clean", exceptions: 0, finding: `Control passed: ${f.reconciliation}` })
      return `${id}: clean, no exceptions for ${interfaceId}.`
    }
    const finding = `${f.reconciliation}: ${bad.length} failed message${bad.length === 1 ? "" : "s"} (${bad.map((m) => m.id).join(", ")})`
    let inc = d.incidents.find((i) => i.source.id === interfaceId && i.state !== "Resolved")
    if (!inc) {
      const sev: Severity = f.financial ? "S2" : "S3"
      inc = { id: `INC-TBD-${String(d.incSeq++).padStart(4, "0")}`, severity: sev, title: `Reconciliation failed: ${interfaceId} ${f.name}, ${bad.length} exception${bad.length === 1 ? "" : "s"}`, source: { kind: "interface", id: interfaceId }, openedAt: NOW, openedBy: ctx.userId, responseDue: sev === "S2" ? addHours(NOW, 1) : "Queued", state: "Open", onCall: "Plant IT" }
      d.incidents.unshift(inc)
    }
    d.recon.unshift({ id, interfaceId, at: NOW, by: ctx.userId, result: "Exceptions", exceptions: bad.length, finding, incidentId: inc.id })
    return `${id}: ${bad.length} exception${bad.length === 1 ? "" : "s"}; incident ${inc.id} (${inc.severity}).`
  })
}

// ============================================================================ INV-CONFIG-PERIOD
const needController = (role: Role, what: string) => {
  if (role !== "Controller") throw new ProtoError(`${what} is the Controller's action [DOC:p.42 §9.5].`)
}
function setStatus(p: AdminState["periods"][number], to: FiscalPeriodStatus, ctx: MutateCtx, note?: string) {
  p.history.push({ at: NOW, from: p.status, to, by: ctx.userId, note })
  p.status = to
  ctx.emit("finance.periodStatusChanged", { entityId: p.entityId, month: p.month, status: to })
}

export function softClose(pid: string): Result<string> {
  return mutate((d, ctx) => {
    needController(ctx.role, "Set Soft Close")
    const p = d.periods.find((x) => x.id === pid)
    if (!p) throw new ProtoError(`${pid} not found.`)
    if (p.status !== "Open") throw new ProtoError(`${p.month} is ${p.status}; only an Open period can go to Soft Close.`)
    const { soft } = rPer01(d.periods, p.entityId)
    if (soft.length) throw new ProtoError(`R-PER-01: at most one Soft Close period per entity. Hard close ${soft[0].month} first.`)
    const pendingReopen = d.instances.find((i) => !i.outcome && i.effect?.type === "periodReopen" && d.periods.find((x) => x.id === (i.effect as { periodId: string }).periodId)?.entityId === p.entityId)
    if (pendingReopen) throw new ProtoError(`R-PER-01: ${pendingReopen.id} would reopen a Hard Closed period of this entity into Soft Close. Decide or recall it before setting ${p.month} to Soft Close, so the entity never has two.`)
    setStatus(p, "Soft Close", ctx)
    p.softClosedAt = NOW
    const nm = nextMonth(p.month)
    let next = d.periods.find((x) => x.entityId === p.entityId && x.month === nm)
    if (!next) {
      next = { id: periodId(p.entityId, nm), entityId: p.entityId, month: nm, status: "Open", history: [] }
      d.periods.push(next)
      next.history.push({ at: NOW, from: "—", to: "Open", by: ctx.userId, note: "Opened automatically at the previous period's first Soft Close (R-PER-01)" })
      ctx.emit("finance.periodStatusChanged", { entityId: next.entityId, month: next.month, status: "Open" })
    }
    return `${p.month} is in Soft Close; ${nm} opened (R-PER-01).`
  })
}

export const unresolved = (d: AdminState, pid: string) => d.preClose.filter((i) => i.periodId === pid && !i.resolved)
export function failedCloseCritical(d: AdminState, entityId: LegalEntityId, month: string) {
  const crit = new Set(["JOB-06", "JOB-07", "JOB-08"])
  const latest = new Map<string, AdminState["runs"][number]>()
  for (const r of d.runs) if (crit.has(r.jobId) && r.entityId === entityId && r.period === month) if (!latest.has(r.jobId) || latest.get(r.jobId)!.scheduledAt < r.scheduledAt || (latest.get(r.jobId)!.scheduledAt === r.scheduledAt && latest.get(r.jobId)!.attempt < r.attempt)) latest.set(r.jobId, r)
  return [...latest.values()].filter((r) => r.state !== "Succeeded")
}

export function runInventoryClose(pid: string): Result<string> {
  return mutate((d, ctx) => {
    needController(ctx.role, "Run inventory close")
    const p = d.periods.find((x) => x.id === pid)
    if (!p) throw new ProtoError(`${pid} not found.`)
    if (p.status !== "Soft Close") throw new ProtoError("The inventory close runs on a period in Soft Close.")
    if (p.inventoryCloseRunAt) throw new ProtoError("The inventory close already ran for this period.")
    const n = unresolved(d, pid).length
    if (n) throw new ProtoError(fillMsg("E-PER-03", { n }))
    p.inventoryCloseRunAt = NOW
    p.inventoryCloseBy = ctx.userId
    return `Inventory close for ${p.month}: valuation snapshot taken, closing JE posted; ACC 26.2 step 6b is done.`
  })
}
export function setFinanceChecklist(pid: string, done: boolean): Result<string> {
  return mutate((d, ctx) => {
    needController(ctx.role, "The finance checklist")
    const p = d.periods.find((x) => x.id === pid)
    if (!p || p.status !== "Soft Close") throw new ProtoError("Only a period in Soft Close has an open checklist.")
    p.financeChecklistDone = done
    return done ? "ACC 26.2 checklist marked complete." : "ACC 26.2 checklist reopened."
  })
}
export function hardClose(pid: string): Result<string> {
  return mutate((d, ctx) => {
    needController(ctx.role, "Set Hard Close")
    const p = d.periods.find((x) => x.id === pid)
    if (!p) throw new ProtoError(`${pid} not found.`)
    if (p.status !== "Soft Close") throw new ProtoError("Only a period in Soft Close can Hard Close.")
    const n = unresolved(d, pid).length
    if (n) throw new ProtoError(fillMsg("E-PER-03", { n }))
    const failed = failedCloseCritical(d, p.entityId, p.month)
    if (failed.length) throw new ProtoError(`The close gate holds: close-critical job ${jobById(failed[0].jobId)?.name} is ${failed[0].state} (${failed[0].id}) [DOC:p.11 W.3].`)
    if (!p.inventoryCloseRunAt) throw new ProtoError("Run the inventory close first (ACC 26.2 step 6b “Inventory period closed”).")
    if (!p.financeChecklistDone) throw new ProtoError("Complete the ACC 26.2 checklist first.")
    setStatus(p, "Hard Close", ctx, p.reopen && !p.reopen.closedAt ? "Reopen window closed" : undefined)
    p.hardClosedAt = NOW
    if (p.reopen && !p.reopen.closedAt) p.reopen.closedAt = NOW
    return `${p.month} is Hard Closed; postings into it are blocked for everyone (E-PER-01).`
  })
}
export function requestReopen(pid: string, reason: string): Result<string> {
  return mutate((d, ctx) => {
    needController(ctx.role, "Requesting a reopen")
    const p = d.periods.find((x) => x.id === pid)
    if (!p) throw new ProtoError(`${pid} not found.`)
    if (p.status !== "Hard Close") throw new ProtoError(p.status === "Year-End Closed" ? "A Year-End Closed period is not reopened here; the specification covers Closed → Soft Close only." : "Only a Hard Closed period is reopened with dual control.")
    const { soft } = rPer01(d.periods, p.entityId)
    if (soft.length) throw new ProtoError(`R-PER-01: ${soft[0].month} is already in Soft Close for this entity; hard close it before reopening ${p.month}.`)
    if (!reason.trim()) throw new ProtoError("The reopen reason is mandatory; it is tagged on the audit trail.", "reason")
    const inst = raiseIn(d, ctx, {
      wfId: "WF-20", kindLabel: "Fiscal period reopen", subject: { loose: { id: p.id, label: `Fiscal period ${p.month}`, route: `/inventory/configuration/fiscal-periods?p=${p.id}` } },
      title: `Reopen ${p.month} ${p.entityId}: ${reason}`, effect: { type: "periodReopen", periodId: p.id },
    })
    return `${inst.id} raised: Controller, then CFO (two distinct users, in sequence).`
  })
}
export function resolvePreClose(itemId: string, note: string): Result<string> {
  return mutate((d, ctx) => {
    const it = d.preClose.find((x) => x.id === itemId)
    if (!it) throw new ProtoError(`${itemId} not found.`)
    if (it.resolved) throw new ProtoError("Already resolved.")
    if (it.jobRunId) throw new ProtoError("A failed close-critical job clears only when a retry succeeds (OPS-JOBS).")
    if (ctx.role !== it.owner && ctx.role !== "Controller") throw new ProtoError(`The owner (${it.owner}) or the Controller resolves this row.`)
    if (!note.trim()) throw new ProtoError("Say how it was resolved.", "reason")
    it.resolved = { by: ctx.userId, at: NOW, note }
    return `${it.ref?.id ?? it.loose?.id} resolved.`
  })
}

// ============================================================================ INV-CONFIG-TAX
const isFinance = (r: Role) => roleGroupOf(r) === "Finance"
export function setEngineMode(mode: "Avalara" | "Manual Tables"): Result<string> {
  return mutate((d, ctx) => {
    if (ctx.role !== "Controller") throw new ProtoError("The engine mode is the Controller's setting (AR-17).")
    d.tax.engineMode = mode
    d.tax.audit.push({ at: NOW, by: ctx.userId, change: `Engine mode → ${mode}`, effectiveFrom: TODAY, firstDocument: "Next document with tax point on or after today" })
    return `Tax engine mode: ${mode}.`
  })
}
export function setTrigger(id: string, on: boolean): Result<string> {
  return mutate((d, ctx) => {
    if (!isFinance(ctx.role)) throw new ProtoError("Tax configuration is maintained by Finance.")
    if (["invoice", "credit", "void"].includes(id)) throw new ProtoError("Commit trigger points cannot be disabled; only estimates can [DOC:p.45 §11.2].")
    d.tax.triggers[id] = on
    d.tax.audit.push({ at: NOW, by: ctx.userId, change: `Estimate at ${id === "quote" ? "quote save" : "SO save"} ${on ? "enabled" : "disabled"}`, effectiveFrom: TODAY, firstDocument: "Next save" })
    return "Trigger points saved."
  })
}
export function setDefaultCode(family: string, code: string): Result<string> {
  return mutate((d, ctx) => {
    if (!isFinance(ctx.role)) throw new ProtoError("Tax configuration is maintained by Finance.")
    if (!code.trim()) throw new ProtoError("Enter a tax code.", "code")
    d.tax.defaultCodes[family] = code.trim()
    d.tax.audit.push({ at: NOW, by: ctx.userId, change: `Default tax code ${family} → ${code.trim()}`, effectiveFrom: TODAY, firstDocument: "Next document with tax point on or after today" })
    return `${family} default code saved.`
  })
}
export function addNexus(row: { state: string; country: "US" | "CA"; entityId: LegalEntityId; type: "Physical" | "Economic"; effectiveFrom: string; registrationNo: string; filingFrequency: "Monthly" | "Quarterly" | "Annual" }): Result<string> {
  return mutate((d, ctx) => {
    if (!isFinance(ctx.role)) throw new ProtoError("Nexus rows are maintained by Finance.")
    if (!/^[A-Z]{2}(-[A-Z/]+)?$/.test(row.state)) throw new ProtoError("Enter a two-letter state or province code.", "state")
    if (!row.registrationNo.trim()) throw new ProtoError("Registration number is required.", "registrationNo")
    if (!row.effectiveFrom) throw new ProtoError("Effective from is required.", "effectiveFrom")
    if (d.tax.nexus.some((n) => n.state === row.state && n.entityId === row.entityId)) throw new ProtoError(`${row.state} is already in the register for this entity.`, "state")
    const id = `NX-${String(d.tax.nexus.length + 1).padStart(2, "0")}`
    d.tax.nexus.push({ id, ...row, addedBy: ctx.userId, addedOn: TODAY })
    const t = d.tax.thresholds.find((x) => x.state === row.state)
    if (t) t.alertRaisedOn = t.alertRaisedOn ?? TODAY
    d.tax.audit.push({ at: NOW, by: ctx.userId, change: `Nexus row ${row.state} (${row.type}) added for ${row.entityId}`, effectiveFrom: row.effectiveFrom, firstDocument: "First document with tax point on or after the effective date; posted documents are never restated" })
    return `${row.state} added to the nexus register from ${row.effectiveFrom}.`
  })
}
export function proposeRate(jurisdiction: string, ratePct: number, validFrom: string): Result<string> {
  return mutate((d, ctx) => {
    if (d.tax.engineMode !== "Manual Tables") throw new ProtoError("In Avalara mode the manual rate table is read-only; rates are never maintained in PE ERP [DOC:p.46 §11.5].")
    if (!isFinance(ctx.role)) throw new ProtoError("Manual rates are maintained by Finance.")
    if (!jurisdiction.trim()) throw new ProtoError("Jurisdiction is required.", "jurisdiction")
    if (!(ratePct >= 0 && ratePct < 30)) throw new ProtoError("Enter a rate between 0 and 30%.", "ratePct")
    if (!validFrom || validFrom < TODAY) throw new ProtoError("Valid from cannot be in the past: posted documents are never restated [DOC:p.46 §11.5].", "validFrom")
    const id = `MR-${String(d.tax.manualRates.length + 1).padStart(2, "0")}`
    const inst = raiseIn(d, ctx, { wfId: "TAX-RATE", kindLabel: "Manual tax rate change", subject: { loose: { id, label: `Manual rate · ${jurisdiction}`, route: "/inventory/configuration/tax?section=rates" } }, title: `${jurisdiction}: ${ratePct}% from ${validFrom} (new dated row)`, steps: ["Controller"], effect: { type: "taxRate", rateId: id }, reading: "AR-18: §11.5 routes manual rate changes to the Controller; the W.4 register has no row for it" })
    d.tax.manualRates.push({ id, jurisdiction: jurisdiction.trim(), ratePct, validFrom, state: "Pending approval", createdBy: ctx.userId, createdOn: TODAY, requestId: inst.id })
    return `${id} waits for the Controller (${inst.id}).`
  })
}
export function reviewRecon(id: string): Result<string> {
  return mutate((d, ctx) => {
    if (!isFinance(ctx.role)) throw new ProtoError("The monthly reconciliation is reviewed by Finance.")
    const r = d.tax.recon.find((x) => x.id === id)
    if (!r) throw new ProtoError(`${id} not found.`)
    r.reviewedBy = ctx.userId
    r.reviewedOn = TODAY
    return `${r.month} reconciliation reviewed.`
  })
}
export function proposeTaxAdjustment(id: string): Result<string> {
  return mutate((d, ctx) => {
    const r = d.tax.recon.find((x) => x.id === id)
    if (!r) throw new ProtoError(`${id} not found.`)
    const diff = Math.round((r.avalaraTax - r.glTax - r.explained) * 100) / 100
    if (!diff) throw new ProtoError("No unexplained difference.")
    if (r.adjustmentRequestId) throw new ProtoError(`${r.adjustmentRequestId} already covers it.`)
    const inst = raiseIn(d, ctx, { wfId: "TAX-ADJ", kindLabel: "Tax adjustment JE", subject: { loose: { id: r.id, label: `Tax reconciliation · ${r.month}`, route: "/inventory/configuration/tax?section=recon" } }, title: `Tax adjustment JE: ${r.month} ${r.entityId}, unexplained ${diff.toFixed(2)}`, amount: Math.abs(diff), steps: ["Controller"], effect: { type: "taxAdjustment", reconId: r.id }, reading: "AR-18: §11.5 names the Controller; the W.4 register has no row for it" })
    r.adjustmentRequestId = inst.id
    return `${inst.id} raised for the Controller.`
  })
}

// ============================================================================ CFG-CORE
export function proposeSetting(settingId: string, value: string, effectiveFrom: string, note: string): Result<string> {
  return mutate((d, ctx) => {
    const s = d.settings.find((x) => x.id === settingId)
    if (!s) throw new ProtoError(`${settingId} not found.`)
    if (!value.trim()) throw new ProtoError("Enter the new value.", "value")
    if (!effectiveFrom || effectiveFrom <= TODAY) throw new ProtoError("Effective date must be after today; history is never edited in place (C-50).", "effectiveFrom")
    if (!note.trim()) throw new ProtoError("Say why it changes.", "note")
    if (s.versions.some((v) => v.state === "Pending approval")) throw new ProtoError("A change to this setting is already waiting for approval.")
    const changeId = `CHG-TBD-${String(d.chgSeq++).padStart(4, "0")}`
    const steps: Role[] = s.gatesPosting && s.owner !== "Controller" ? [s.owner, "Controller"] : [s.owner]
    const inst = raiseIn(d, ctx, { wfId: "CFG-CHG", kindLabel: "Configuration change", subject: { loose: { id: s.id, label: `Setting · ${s.label}`, route: `/configuration/core?section=${s.section}` } }, title: `${s.label}: ${s.versions.filter((v) => v.state === "Active").at(-1)?.value} → ${value.trim()}, effective ${effectiveFrom}`, steps, effect: { type: "configChange", settingId: s.id, changeId }, reading: "AR-15: CFG-CORE changes route to the setting's owner (+ Controller when it gates a posting)" })
    s.versions.push({ value: value.trim(), effectiveFrom, by: ctx.userId, note, state: "Pending approval", requestId: inst.id, changeId })
    return `${changeId} raised as ${inst.id} for the ${steps.join(", then the ")}.`
  })
}

/** Number series are maintained under change control like every other register row [DOC:p.276 §15 CFG-CORE]: a change is
 *  a new effective-dated version, approved by the series owner (AR-30: Controller for gap-free series, Plant IT otherwise). */
export function proposeSeries(seriesId: string, format: string, next: number, effectiveFrom: string, note: string): Result<string> {
  return mutate((d, ctx) => {
    const ns = d.series.find((x) => x.id === seriesId)
    if (!ns) throw new ProtoError(`${seriesId} not found.`)
    if (ns.next === 0) throw new ProtoError(`${ns.object} numbers come from ACC (V2.0), which is not in the knowledge base; the series cannot be maintained here.`)
    if (!format.trim()) throw new ProtoError("Enter the format.", "format")
    if (!/\{SEQ(:\d+)?\}/.test(format)) throw new ProtoError("The format needs a sequence token such as {SEQ:5}; without it numbers repeat.", "format")
    if (!Number.isInteger(next) || next < ns.next) throw new ProtoError(`The next number cannot go below ${ns.next}: numbers already issued would repeat.`, "next")
    if (!effectiveFrom || effectiveFrom <= TODAY) throw new ProtoError("Effective date must be after today; history is never edited in place (C-50).", "effectiveFrom")
    if (!note.trim()) throw new ProtoError("Say why it changes.", "note")
    if (ns.changes.some((c) => c.state === "Pending approval")) throw new ProtoError("A change to this series is already waiting for approval.")
    if (format.trim() === ns.format && next === ns.next) throw new ProtoError("Nothing changes: enter a new format or a higher next number.", "format")
    const changeId = `CHG-TBD-${String(d.chgSeq++).padStart(4, "0")}`
    const owner: Role = ns.gapFree ? "Controller" : "Plant IT"
    const inst = raiseIn(d, ctx, { wfId: "CFG-CHG", kindLabel: "Configuration change", subject: { loose: { id: ns.id, label: `Number series · ${ns.object}`, route: "/configuration/core?section=numbers" } }, title: `${ns.object} series: ${ns.format} next ${ns.next} → ${format.trim()} next ${next}, effective ${effectiveFrom}`, steps: [owner], effect: { type: "seriesChange", seriesId: ns.id, changeId }, reading: "AR-30: number series have no owner in the register; the Controller approves a gap-free series, Plant IT the others" })
    ns.changes.push({ format: format.trim(), next, effectiveFrom, by: ctx.userId, note, state: "Pending approval", requestId: inst.id, changeId })
    return `${changeId} raised as ${inst.id} for the ${owner}.`
  })
}

export const W4_IDS = W4_ALL.map((w) => w.id)
export type { DocRef }
export const asRequestId = (id: string) => id as ApprovalRequestId

// ============================================================================ requests raised by the configuration screens
/** Raise a configuration request on the admin engine (wfId CFG-CHG) for a subject that lives in the adminCfg slice.
 *  Returns the request id. The decision is read off the request by the screen (lib/cfg.ts requestState). */
export function raiseCfg(i: { id: string; label: string; route: string; title: string; steps: Role[]; kindLabel?: string; reading: string; amount?: number }): Result<string> {
  return mutate((d, ctx) => raiseIn(d, ctx, { wfId: "CFG-CHG", kindLabel: i.kindLabel ?? "Configuration change", subject: { loose: { id: i.id, label: i.label, route: i.route } }, title: i.title, steps: i.steps, amount: i.amount, reading: i.reading }).id)
}

/** SoD exception request: CFO approval with an expiry date [DOC:p.188 C §3; W.4 WF-26]. The grant is Active only once approved. */
export function requestSod(input: { userId: UserId; grant: string; expires: string; reason: string }): Result<string> {
  return mutate((d, ctx) => {
    if (!input.grant.trim()) throw new ProtoError("Name the toxic combination the user needs.", "grant")
    if (!input.expires || input.expires <= TODAY) throw new ProtoError("An exception needs an expiry date after today; it cannot be open-ended.", "expires")
    if (input.expires > addDays(TODAY, 180)) throw new ProtoError("Design limit: an exception runs 180 days at most; renew it with a new request.", "expires")
    if (input.reason.trim().length < 20) throw new ProtoError("Justify the exception in at least 20 characters.", "reason")
    if (d.sod.some((x) => x.user === input.userId && x.grant === input.grant && x.state !== "Expired")) throw new ProtoError("This user already has an open or active exception for this combination.")
    const id = `SOD-TBD-${String(d.sod.length + 2).padStart(3, "0")}`
    const inst = raiseIn(d, ctx, { wfId: "WF-26", kindLabel: "SoD exception grant", subject: { loose: { id, label: "SoD exception", route: "/configuration/access-recertification?queue=sod" } }, title: `${userName(input.userId)}: ${input.grant}, expires ${input.expires}. ${input.reason}`, effect: { type: "sodGrant", sodId: id } })
    d.sod.push({ id, user: input.userId, grant: input.grant, expires: input.expires, requestId: inst.id, state: "Pending approval" })
    return `${id} raised as ${inst.id} for the CFO.`
  })
}
const userName = (id: string) => USERS.find((u) => u.id === id)?.name ?? id
