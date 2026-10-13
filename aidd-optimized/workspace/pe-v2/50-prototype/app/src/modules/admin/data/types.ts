// Admin slice types. Records with no status list in the specification (workflow instance, job run,
// interface message, delegation, incident) carry their state as text, never a StatusBadge (OQ-21);
// the words used are design values listed in the README (AR-1).

import type { DocRef, FiscalPeriodStatus, LegalEntityId, Role, UserId } from "@/data/domain"
import type { Approver, Rule, Severity } from "./catalog"
export type { Approver, Rule }

// ---------------------------------------------------------------- workflow definitions (WF-DEF)
export interface DefStep {
  role: Role
  /** How the approver is resolved: role (default), named user or derived owner [DOC:p.216 §7.7]. */
  approver?: Approver
  /** Conditional step, present only when this rule fires. */
  when?: string
  slaHours: number
  escalateTo: Role
  parallel?: boolean
  reminderHours: number
}
/** Version state words are design values (AR-1): Active, Scheduled, Retired, Pending co-sign. */
export type VersionState = "Active" | "Scheduled" | "Retired" | "Pending co-sign" | "Rejected"
export interface DefVersion {
  version: number
  effectiveFrom: string
  effectiveTo?: string
  trigger: string
  /** Condition rules in the rule grammar: field, operator, value [DOC:p.216 §7.7]. */
  rules: Rule[]
  steps: DefStep[]
  terminalActions: string[]
  changedBy: UserId
  changedOn: string
  changeNote: string
  state: VersionState
  /** Approval request that carries the Controller co-sign when the workflow gates a posting. */
  requestId?: string
}
export interface WorkflowDefinition {
  id: string // WF-01..WF-27
  versions: DefVersion[]
}

// ---------------------------------------------------------------- admin engine instances (WF-INBOX)
export type Channel = "In-app" | "Email link" | "Mobile"
export interface InstDecision {
  outcome: "Approved" | "Rejected"
  by: UserId
  role: Role
  on: string // ISO date-time
  reason?: string
  channel: Channel
  /** Set when a delegate acted: whose step it was. */
  onBehalfOf?: UserId
}
export interface InstStep {
  role: Role
  /** Named-user resolution: only this user decides the step (or their delegate). */
  approverUser?: UserId
  /** Derived owner the seat stands for, shown beside the role. */
  derived?: string
  /** Steps of a parallel run open together and all must approve (CCB votes) [DOC:p.10 W.1]. */
  parallel?: boolean
  slaHours: number
  escalateTo: Role
  openedAt?: string
  decided?: InstDecision
  escalatedAt?: string
  note?: string
}
/** A subject that is not a typed document (vendor, period, matrix, setting) links by route. */
export interface LooseSubject {
  id: string
  label: string
  route: string
}
export type Subject = { ref: DocRef } | { loose: LooseSubject }
/** Outcome words: the Book IV §7.12 lifecycle names (pending → approved / rejected / recalled). */
export type InstOutcome = "Approved" | "Rejected" | "Recalled"
export interface WfInstance {
  id: `APR-${string}`
  wfId: string // WF-nn, or "W.1-VER" (definition change), "CFG-CHG" (configuration change), "TAX-RATE"
  kindLabel: string
  version: number
  subject: Subject
  title: string
  amount?: number
  currency?: "USD" | "CAD"
  raisedBy: Role
  raisedByUser: UserId
  raisedAt: string
  steps: InstStep[]
  outcome?: InstOutcome
  delegationAllowed: boolean
  reading?: string
  /** Earlier rounds kept on resubmit (history preserved). */
  rounds: { steps: InstStep[]; outcome: InstOutcome; closedAt: string }[]
  /** What a terminal action does when approved (handled in actions.ts). */
  effect?: InstEffect
}
export type InstEffect =
  | { type: "periodReopen"; periodId: string }
  | { type: "defVersion"; wfId: string; version: number }
  | { type: "configChange"; settingId: string; changeId: string }
  | { type: "taxRate"; rateId: string }
  | { type: "taxAdjustment"; reconId: string }
  | { type: "sodGrant"; sodId: string }
  | { type: "seriesChange"; seriesId: string; changeId: string }

// ---------------------------------------------------------------- delegation and audit
export interface Delegation {
  id: string
  fromUser: UserId
  fromRole: Role
  toUser: UserId
  toRole: Role
  validFrom: string
  validTo: string
  /** "All workflows" or a list of WF ids. */
  scope: "All workflows" | string[]
  reason: string
  createdBy: UserId
  createdOn: string
  revokedOn?: string
  /** One-off delegation of a single request step (the Delegate action in WF-INBOX). */
  requestId?: string
}
export interface AuditEntry {
  at: string
  requestId: string
  action: "Raised" | "Approved" | "Rejected" | "Delegated" | "Recalled" | "Resubmitted" | "Escalated" | "Reminder sent"
  by: UserId
  role: Role
  channel: Channel
  comment?: string
  onBehalfOf?: UserId
  /** The step's role when a delegate acted on a shared-engine step. */
  stepRole?: Role
}

// ---------------------------------------------------------------- jobs, interfaces, incidents
/** Run state words are design values (AR-1). */
export type RunState = "Scheduled" | "Running" | "Succeeded" | "Failed" | "Held (dependency)"
export interface JobRun {
  id: string
  jobId: string
  period?: string
  entityId?: LegalEntityId
  scheduledAt: string
  startedAt?: string
  endedAt?: string
  state: RunState
  attempt: number
  error?: string
  /** What the run produced (document id or count). */
  output?: string
  correlationId: string
  /** Posting the run made (template number + amount), for #24. */
  posting?: { template: 24 | 36; amount: number }
  incidentId?: string
  /** Set on a failed run once a retry of it succeeded (history stays). */
  retriedBy?: string
}
export type MessageState = "Delivered" | "Retrying" | "Dead-lettered" | "Replayed" | "Discarded"
export interface InterfaceMessage {
  id: string
  interfaceId: string
  correlationId: string
  at: string
  docRef?: DocRef
  docLabel?: string
  summary: string
  state: MessageState
  attempts: number
  error?: string
  /** Set when the root cause is marked fixed; replay is offered after fix. */
  fixed?: boolean
  envelope: Record<string, string | number>
  editedPayload?: string
  discardReason?: string
}
export interface InterfaceStat {
  interfaceId: string
  throughputPerHour: number
  lagSeconds: number
  errorRatePct: number
  oldestUnprocessedMin: number
}
export interface Incident {
  id: string
  severity: Severity
  title: string
  source: { kind: "job" | "message" | "interface"; id: string }
  openedAt: string
  openedBy: UserId
  responseDue: string
  state: "Open" | "Acknowledged" | "Resolved"
  onCall: Role
  /** Pages sent to the on-call role: failed close-critical jobs page, they are never just logged [DOC:p.190 Part D §5]. */
  paged?: { at: string; to: Role; reason: string }[]
}

// ---------------------------------------------------------------- fiscal periods (INV-CONFIG-PERIOD)
export interface Period {
  id: `FP-${string}`
  entityId: LegalEntityId
  month: string
  status: FiscalPeriodStatus
  inventoryCloseRunAt?: string
  inventoryCloseBy?: UserId
  /** ACC 26.2 checklist complete (outside the KB, ASM-EXT-1): a Controller attestation here. */
  financeChecklistDone?: boolean
  softClosedAt?: string
  hardClosedAt?: string
  reopen?: { reason: string; requestId: string; openedAt: string; closedAt?: string }
  history: { at: string; from: FiscalPeriodStatus | "—"; to: FiscalPeriodStatus; by: UserId; note?: string }[]
}
export interface PreCloseItem {
  id: string
  periodId: string
  kind: string // Draft GRN, Open count, Unsettled WO, Close-critical job
  ref?: DocRef
  loose?: { id: string; route: string }
  description: string
  owner: Role
  resolved?: { by: UserId; at: string; note: string }
  jobRunId?: string
}
export interface TaggedPosting {
  at: string
  periodId: string
  template: string
  amount: number
  currency: "USD" | "CAD"
  source: DocRef
  tag: "Reopened Posting"
}

// ---------------------------------------------------------------- tax (INV-CONFIG-TAX)
export interface NexusRow {
  id: string
  state: string // US state or Canadian jurisdiction
  country: "US" | "CA"
  entityId: LegalEntityId
  type: "Physical" | "Economic"
  effectiveFrom: string
  registrationNo: string
  filingFrequency: "Monthly" | "Quarterly" | "Annual"
  addedBy: UserId
  addedOn: string
}
export interface NexusThreshold {
  state: string
  salesThreshold: number
  txnThreshold?: number
  rolling12Sales: number
  rolling12Txns: number
  alertRaisedOn?: string
}
export interface ManualRate {
  id: string
  jurisdiction: string
  ratePct: number
  validFrom: string
  validTo?: string
  state: "Active" | "Pending approval" | "Superseded" | "Rejected"
  createdBy: UserId
  createdOn: string
  requestId?: string
}
export interface TaxRecon {
  id: string
  month: string
  entityId: LegalEntityId
  glTax: number
  avalaraTax: number
  explained: number
  reviewedBy?: UserId
  reviewedOn?: string
  adjustmentRequestId?: string
}
export interface TaxConfig {
  engineMode: "Avalara" | "Manual Tables"
  defaultCodes: Record<string, string>
  triggers: Record<string, boolean>
  nexus: NexusRow[]
  thresholds: NexusThreshold[]
  manualRates: ManualRate[]
  recon: TaxRecon[]
  audit: { at: string; by: UserId; change: string; effectiveFrom: string; firstDocument: string }[]
}

// ---------------------------------------------------------------- core configuration (CFG-CORE)
export interface SettingVersion {
  value: string
  effectiveFrom: string
  by: UserId | "PRD seed"
  note: string
  state: "Active" | "Pending approval" | "Superseded" | "Rejected" | "Scheduled"
  requestId?: string
  changeId: string
}
export interface Setting {
  id: string
  section: string
  label: string
  unit?: string
  owner: Role
  source: string
  /** Gates a posting: Controller joins the approval [DOC:p.11 W.1]. */
  gatesPosting?: boolean
  design?: boolean
  versions: SettingVersion[]
}
export interface SeriesVersion {
  format: string
  /** Next number to issue from the effective date; never lower than the number in force (no duplicates). */
  next: number
  effectiveFrom: string
  by: UserId
  note: string
  state: "Pending approval" | "Scheduled" | "Rejected"
  requestId?: string
  changeId: string
}
export interface NumberSeries {
  id: string
  object: string
  format: string
  next: number
  gapFree: boolean
  source: string
  /** Proposed changes under change control (history of approved ones stays here too). */
  changes: SeriesVersion[]
}

// ---------------------------------------------------------------- reconciliation reports (OPS-INT)
export interface ReconRun {
  id: string
  interfaceId: string
  at: string
  by: UserId | "Scheduler"
  result: "Clean" | "Exceptions"
  exceptions: number
  finding: string
  incidentId?: string
}
