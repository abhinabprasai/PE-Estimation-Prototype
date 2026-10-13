// One view over both approval queues: the shared engine (store core, C-1) and the admin engine
// queue for W.4 rows the shared engine has no kind for (R-1). WF-INBOX renders InboxRow only, so
// both queues get the same SLA clock, delegation rule, recall and audit trail.

import type { DocRef, Role, UserId } from "@/data/domain"
import { docLabel, docRoute } from "@/data/domain"
import { TODAY } from "@/data/shared"
import type { ApprovalRequest } from "@/store"
import { escalationOf, w4ById, w4ForKind } from "../data/catalog"
import { legacyOutcome } from "../data/queue"
import { NOW } from "../data/seed"
import type { AdminState } from "../data/slice"
import type { Channel, Delegation, InstOutcome, WfInstance } from "../data/types"
import { hoursBetween } from "./time"

export interface InboxStep {
  role: Role
  approverUser?: UserId
  derived?: string
  /** Steps of a parallel run open together; all must approve [DOC:p.10 W.1]. */
  parallel?: boolean
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
  /** index of the first waiting step, -1 when decided */
  current: number
  /** indexes of every step open now: one, or the undecided members of a parallel run */
  open: number[]
  ageHours: number
  overdue: boolean
}

const firstDecidedDelegate = (admin: AdminState, reqId: string, stepRole: Role) =>
  admin.audit.find((e) => e.requestId === reqId && (e.action === "Approved" || e.action === "Rejected") && e.onBehalfOf && e.stepRole === stepRole)

/** The steps open now: the first undecided one, plus the other undecided members when it sits in a parallel run. */
export function openIndexes(steps: { parallel?: boolean; decided?: unknown }[], outcome?: string): number[] {
  const first = outcome ? -1 : steps.findIndex((s) => !s.decided)
  if (first < 0) return []
  if (!steps[first].parallel) return [first]
  let a = first
  let b = first
  while (a > 0 && steps[a - 1].parallel) a--
  while (b < steps.length - 1 && steps[b + 1].parallel) b++
  const out: number[] = []
  for (let n = a; n <= b; n++) if (!steps[n].decided) out.push(n)
  return out
}
/** Run bounds [from, to] of the parallel run containing step i (a single step is its own run). */
export function runOf(steps: { parallel?: boolean }[], i: number): [number, number] {
  let a = i
  let b = i
  if (steps[i].parallel) {
    while (a > 0 && steps[a - 1].parallel) a--
    while (b < steps.length - 1 && steps[b + 1].parallel) b++
  }
  return [a, b]
}

function finish(row: Omit<InboxRow, "current" | "ageHours" | "overdue" | "open">): InboxRow {
  const open = openIndexes(row.steps, row.outcome)
  const ages = open.map((n) => (row.steps[n].openedAt ? hoursBetween(row.steps[n].openedAt!, NOW) : 0))
  // The clock that matters is the step closest to its SLA.
  const worst = open.length ? open.reduce((w, n, k) => (ages[k] / row.steps[n].slaHours > ages[w] / row.steps[open[w]].slaHours ? k : w), 0) : -1
  const ageHours = worst >= 0 ? ages[worst] : 0
  return { ...row, open, current: worst >= 0 ? open[worst] : -1, ageHours, overdue: worst >= 0 && ageHours > row.steps[open[worst]].slaHours }
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
    amount: a.amount, currency: a.currency, raisedBy: a.raisedBy, raisedAt: `${a.raisedOn}T09:00`, steps,
    // a credit release or no-quote order closed on the sales side (Controller raised the limit) reads as decided here too
    outcome: admin.sharedLineage[a.id]?.recalled ? "Recalled" : a.outcome ?? (a.subject.type === "salesOrder" ? legacyOutcome(a.kind, a.subject.id)?.outcome : undefined),
    delegationAllowed: a.route.delegationAllowed, rule: a.route.rule, ruleSource: a.route.source, rounds: admin.sharedLineage[a.id]?.rounds.length ?? 0,
    reading: [a.route.reading, a.kind === "Count variance" ? "The shared route has no Finance Manager band: INV §7.5 reads Supervisor → Finance Manager → Controller above $25,000 (request R-7); WF-17's definition carries the full chain" : undefined].filter(Boolean).join(" · ") || undefined,
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

/** Earlier rounds of a request on either engine (kept on resubmit). */
export const roundsOf = (id: string, admin: AdminState) => admin.instances.find((i) => i.id === id)?.rounds ?? admin.sharedLineage[id]?.rounds ?? []

export function inboxRows(approvals: ApprovalRequest[], admin: AdminState): InboxRow[] {
  return [...admin.instances.map((i) => fromAdmin(i, admin)), ...approvals.map((a) => fromShared(a, admin))].sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))
}

// ---------------------------------------------------------------- delegation [DOC:p.11 W.1]
export const delegationState = (d: Delegation): "Active" | "Scheduled" | "Expired" | "Revoked" =>
  d.revokedOn ? "Revoked" : TODAY < d.validFrom ? "Scheduled" : TODAY > d.validTo ? "Expired" : "Active"

const inScope = (d: Delegation, row: InboxRow) => (d.requestId ? d.requestId === row.id : d.scope === "All workflows" || d.scope.includes(row.wfId))

/** Does this step wait for the acting role or user? A named user is resolved to that person only. */
const seatMatches = (st: InboxStep, role: Role, userId: UserId) => (st.approverUser ? st.approverUser === userId : st.role === role)

/** The open step a delegation covers for `userId`, with the delegation. */
function delegationHit(row: InboxRow, userId: UserId, delegations: Delegation[]): { d: Delegation; idx: number } | undefined {
  for (const idx of row.open)
    for (const d of delegations)
      if (delegationState(d) === "Active" && d.toUser === userId && d.fromRole === row.steps[idx].role && inScope(d, row)) return { d, idx }
  return undefined
}
/** The delegation that lets `userId` act on a waiting step, if any. */
export const delegationFor = (row: InboxRow, userId: UserId, delegations: Delegation[]): Delegation | undefined => delegationHit(row, userId, delegations)?.d

export interface ActCheck {
  can: boolean
  asDelegate?: Delegation
  /** The step the acting user decides (first of the open steps that is theirs). */
  stepIndex?: number
  reason?: string
}
export function canAct(row: InboxRow, role: Role, userId: UserId, delegations: Delegation[]): ActCheck {
  if (row.outcome) return { can: false, reason: `Decided: ${row.outcome}. No further action.` }
  if (row.steps.some((s) => s.decided?.by === userId)) return { can: false, reason: "The same person cannot decide two steps of one request." }
  const own = row.open.find((n) => seatMatches(row.steps[n], role, userId))
  if (own != null) return { can: true, stepIndex: own }
  const hit = delegationHit(row, userId, delegations)
  if (hit) {
    const st = row.steps[hit.idx]
    if (!row.delegationAllowed) return { can: false, asDelegate: hit.d, reason: `You hold ${hit.d.id} for the ${st.role}, but delegation is not allowed on a financial approval above $250,000 (C-2). The ${st.role} decides.` }
    return { can: true, asDelegate: hit.d, stepIndex: hit.idx }
  }
  const waiting = row.open.map((n) => (row.steps[n].approverUser ? `${row.steps[n].role} (${row.steps[n].approverUser})` : row.steps[n].role)).join(" and ")
  return { can: false, reason: `This step waits for the ${waiting}. Switch “Acting as” to ${row.steps[row.open[0]].role} to decide it.` }
}

/** Rows in a role's queue: an open step is theirs, or they hold an active delegation for it. */
export function waitingFor(row: InboxRow, role: Role, userId: UserId, delegations: Delegation[]) {
  return row.open.some((n) => seatMatches(row.steps[n], role, userId)) || !!delegationHit(row, userId, delegations)
}
