// One view over both approval queues: the shared engine (store core, C-1) and the admin engine
// queue for W.4 rows the shared engine has no kind for (R-1). WF-INBOX renders InboxRow only, so
// both queues get the same SLA clock, delegation rule, recall and audit trail.

import type { DocRef, Role, UserId } from "@/data/domain"
import { docLabel, docRoute } from "@/data/domain"
import { TODAY } from "@/data/shared"
import type { ApprovalRequest } from "@/store"
import { escalationOf, w4ById, w4ForKind } from "../data/catalog"
import { NOW } from "../data/seed"
import type { AdminState } from "../data/slice"
import type { Channel, Delegation, InstOutcome, WfInstance } from "../data/types"
import { hoursBetween } from "./time"

export interface InboxStep {
  role: Role
  slaHours: number
  escalateTo: Role
  openedAt?: string
  decided?: { outcome: "Approved" | "Rejected"; by: UserId; on: string; reason?: string; channel?: Channel; onBehalfOf?: UserId }
  note?: string
}
export interface InboxRow {
  id: string
  source: "shared" | "admin"
  wfId: string
  kind: string
  title: string
  subject: { id: string; label: string; route: string; ref?: DocRef }
  amount?: number
  currency?: "USD" | "CAD"
  raisedBy: Role
  raisedAt: string
  steps: InboxStep[]
  outcome?: InstOutcome
  delegationAllowed: boolean
  rule: string
  ruleSource: string
  reading?: string
  version?: number
  rounds: number
  /** index of the waiting step, -1 when decided */
  current: number
  ageHours: number
  overdue: boolean
}

const firstDecidedDelegate = (admin: AdminState, reqId: string, stepRole: Role) =>
  admin.audit.find((e) => e.requestId === reqId && (e.action === "Approved" || e.action === "Rejected") && e.onBehalfOf && e.stepRole === stepRole)

function finish(row: Omit<InboxRow, "current" | "ageHours" | "overdue">): InboxRow {
  const current = row.outcome ? -1 : row.steps.findIndex((s) => !s.decided)
  const st = current >= 0 ? row.steps[current] : undefined
  const ageHours = st?.openedAt ? hoursBetween(st.openedAt, NOW) : 0
  return { ...row, current, ageHours, overdue: !!st && ageHours > st.slaHours }
}

export function fromShared(a: ApprovalRequest, admin: AdminState): InboxRow {
  const row = w4ForKind(a.kind)
  let opened: string | undefined = `${a.raisedOn}T09:00`
  const steps: InboxStep[] = a.steps.map((s) => {
    const sla = row?.steps.find((x) => x.role === s.role)?.slaHours ?? 24
    const deleg = s.decided ? firstDecidedDelegate(admin, a.id, s.role) : undefined
    const step: InboxStep = {
      role: s.role, slaHours: sla, escalateTo: escalationOf(s.role), openedAt: opened,
      decided: s.decided ? { outcome: s.decided.outcome, by: deleg?.by ?? s.decided.by, on: s.decided.on, reason: s.decided.reason, channel: deleg?.channel ?? "In-app", onBehalfOf: deleg ? s.decided.by : undefined } : undefined,
    }
    opened = s.decided ? (s.decided.on.length === 10 ? `${s.decided.on}T12:00` : s.decided.on) : undefined
    return step
  })
  return finish({
    id: a.id, source: "shared", wfId: row?.id ?? "outside W.4", kind: a.kind, title: a.title,
    subject: { id: a.subject.id, label: docLabel(a.subject), route: docRoute(a.subject), ref: a.subject },
    amount: a.amount, currency: a.currency, raisedBy: a.raisedBy, raisedAt: `${a.raisedOn}T09:00`, steps, outcome: a.outcome,
    delegationAllowed: a.route.delegationAllowed, rule: a.route.rule, ruleSource: a.route.source, reading: a.route.reading, rounds: 0,
  })
}

export function fromAdmin(i: WfInstance, admin: AdminState): InboxRow {
  const w = w4ById(i.wfId)
  const def = admin.definitions.find((d) => d.id === i.wfId)
  const subject = "ref" in i.subject ? { id: i.subject.ref.id, label: docLabel(i.subject.ref), route: docRoute(i.subject.ref), ref: i.subject.ref } : { id: i.subject.loose.id, label: i.subject.loose.label, route: i.subject.loose.route }
  return finish({
    id: i.id, source: "admin", wfId: i.wfId, kind: i.kindLabel, title: i.title, subject, amount: i.amount, currency: i.currency,
    raisedBy: i.raisedBy, raisedAt: i.raisedAt, steps: i.steps, outcome: i.outcome, delegationAllowed: i.delegationAllowed,
    rule: w ? `${w.workflow}: ${w.chain}` : i.kindLabel, ruleSource: w ? `[${w.specifiedIn}; DOC:pp.11-12 §W.4]` : "[DOC:pp.10-11 §W.1]",
    reading: i.reading, version: def ? i.version : undefined, rounds: i.rounds.length,
  })
}

export function inboxRows(approvals: ApprovalRequest[], admin: AdminState): InboxRow[] {
  return [...admin.instances.map((i) => fromAdmin(i, admin)), ...approvals.map((a) => fromShared(a, admin))].sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))
}

// ---------------------------------------------------------------- delegation [DOC:p.11 W.1]
export const delegationState = (d: Delegation): "Active" | "Scheduled" | "Expired" | "Revoked" =>
  d.revokedOn ? "Revoked" : TODAY < d.validFrom ? "Scheduled" : TODAY > d.validTo ? "Expired" : "Active"

const inScope = (d: Delegation, row: InboxRow) => (d.requestId ? d.requestId === row.id : d.scope === "All workflows" || d.scope.includes(row.wfId))

/** The delegation that lets `userId` act on the waiting step, if any. */
export function delegationFor(row: InboxRow, userId: UserId, delegations: Delegation[]): Delegation | undefined {
  if (row.current < 0) return undefined
  const st = row.steps[row.current]
  return delegations.find((d) => delegationState(d) === "Active" && d.toUser === userId && d.fromRole === st.role && inScope(d, row))
}

export interface ActCheck {
  can: boolean
  asDelegate?: Delegation
  reason?: string
}
export function canAct(row: InboxRow, role: Role, userId: UserId, delegations: Delegation[]): ActCheck {
  if (row.outcome) return { can: false, reason: `Decided: ${row.outcome}. No further action.` }
  const st = row.steps[row.current]
  if (row.steps.some((s) => s.decided?.by === userId)) return { can: false, reason: "The same person cannot decide two steps of one request." }
  if (st.role === role) return { can: true }
  const d = delegationFor(row, userId, delegations)
  if (d) {
    if (!row.delegationAllowed) return { can: false, asDelegate: d, reason: `You hold ${d.id} for the ${st.role}, but delegation is not allowed on a financial approval above $250,000 (C-2). The ${st.role} decides.` }
    return { can: true, asDelegate: d }
  }
  return { can: false, reason: `This step waits for the ${st.role}. Switch “Acting as” to ${st.role} to decide it.` }
}

/** Rows in a role's queue: waiting step is theirs, or they hold an active delegation for it. */
export function waitingFor(row: InboxRow, role: Role, userId: UserId, delegations: Delegation[]) {
  return row.current >= 0 && (row.steps[row.current].role === role || !!delegationFor(row, userId, delegations))
}
