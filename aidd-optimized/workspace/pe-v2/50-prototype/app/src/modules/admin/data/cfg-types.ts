// Types for the feature-list configuration screens (second admin slice, key "adminCfg").
// Versioned records never change in place (C-50): a change adds a version; its state is read off the
// approval request on the admin engine (no copy of the decision is kept here).

import type { LegalEntityId, Role, UserId } from "@/data/domain"

export interface Ver<T> {
  value: T
  effectiveFrom: string
  by: UserId | "PRD seed"
  note: string
  /** Approval request on the admin engine; none for a seed version. */
  requestId?: string
}
export type VerState = "Active" | "Scheduled" | "Pending approval" | "Rejected" | "Superseded"

export interface HistoryEntry {
  at: string
  by: UserId | "PRD seed" | "Scheduler"
  what: string
}

// ---------------------------------------------------------------- W.2 alert rules
export type AlertSeverity = "Critical" | "Warning" | "Info"
export type DigestMode = "Off" | "Daily 07:00" | "Weekly Monday 07:00"
export interface AlertRule {
  id: string
  name: string
  trigger: "Event" | "Scheduled"
  /** Event name, or the schedule for a scheduled rule. */
  when: string
  condition: string
  scope: string
  severity: AlertSeverity
  roles: Role[]
  users: UserId[]
  channels: { inApp: boolean; email: boolean }
  dedupeMinutes: number
  digest: DigestMode
  owner: Role
  enabled: boolean
  version: number
  source: string
  history: HistoryEntry[]
  /** Last 30 days, for the monthly noise review. */
  noise: { fired: number; suppressed: number; acknowledged: number }
  noiseReview?: { month: string; by: UserId; note: string }
}

// ---------------------------------------------------------------- notification templates
export type Locale = "en-US" | "fr-CA"
export interface TemplateVersion {
  version: number
  state: "Draft" | "Active" | "Retired"
  subject: Record<Locale, string>
  body: Record<Locale, string>
  effectiveFrom: string
  by: UserId | "PRD seed"
  note: string
}
export interface NotificationTemplate {
  id: string
  name: string
  event: string
  audience: "Internal" | "Customer" | "Vendor"
  owner: Role
  placeholders: string[]
  versions: TemplateVersion[]
}

// ---------------------------------------------------------------- KPI dictionary
export type Freshness = "Real-time" | "15-minute" | "Daily"
export interface KpiValue {
  formula: string
  grain: string
  filters: string
  target: string
  lineage: string
  freshness: Freshness
}
export interface Kpi {
  id: string
  name: string
  owner: Role
  source: string
  /** Dashboards or screens that show the number (a KPI on two dashboards from two formulas is a defect). */
  shownOn: string[]
  /** Another screen computing the same KPI from a different formula: the defect the dictionary exists to catch. */
  competing?: { where: string; formula: string }[]
  versions: Ver<KpiValue>[]
}

// ---------------------------------------------------------------- recertification
export interface RecertItem {
  id: string
  userId: UserId
  role: Role
  entitlements: string
  lastUsed: string
  /** The manager's answer; a failed attestation turns every remaining Pending item into an auto-revoke. */
  answer: "Pending" | "Keep" | "Revoke"
}
export interface RecertSheet {
  id: string
  campaign: string
  department: string
  managerRole: Role
  requestId: string
  dueOn: string
  items: RecertItem[]
  /** Set when the attestation failed or was rejected: the items revoked automatically. */
  autoRevoked?: { on: string; reason: string }
}

// ---------------------------------------------------------------- number series (new, delta)
export interface NewSeries {
  id: string
  group: "Book I §2.2" | "Book II §2.7" | "Book II §2.3"
  docType: string
  example: string
  entityAware: boolean
  counters: Record<string, number>
  versions: Ver<{ format: string; next: number }>[]
}

// ---------------------------------------------------------------- RMA policy
export interface RmaReason {
  id: string
  reason: string
  restockPct: number
  freightPaidBy: "Customer" | "PE" | "Carrier claim" | "Case by case"
  source: "PRD" | "Design value"
  versions: Ver<{ restockPct: number }>[]
}

// ---------------------------------------------------------------- Quality no-plan policy
export type PlanType = "INC" | "INP" | "FIN" | "PSI" | "RMA"
export type NoPlanPolicy = "Block" | "Manual Inspection" | "Auto-Accept with Warning"
export interface NoPlanRow {
  planType: PlanType
  label: string
  versions: Ver<{ policy: NoPlanPolicy; qiRequiredOnly?: boolean }>[]
}

// ---------------------------------------------------------------- material settings
export interface MatGroup {
  id: string
  level: 1 | 2 | 3
  parentId?: string
  code: string
  name: string
  /** Effective-dated: a node deactivates, never deletes. */
  validFrom: string
  deactivatedFrom?: string
  /** Request that adds the node (none for a seed node) and the request that deactivates it. */
  requestId?: string
  deactivateRequestId?: string
  by: UserId | "PRD seed"
}
export interface CharacteristicClass {
  id: string
  groupId: string
  key: string
  type: "Number" | "Text" | "List"
  unit?: string
  values?: string
  searchable: boolean
  printable: boolean
}
export interface SerialProfile {
  id: "SN-FIN" | "SN-COMP" | "SN-SEMI" | "SN-NONE"
  appliesTo: string
  timing: string
  format: string
  warrantyRelevant: boolean
  installLinks: boolean
  /** Shared material records carrying this profile id (SP-FIN etc. in the shared master). */
  legacyId: string
}
export type MatrixCell = string
export interface TypeBehaviour {
  behaviour: string
  /** Value per material type RAW SEMI FIN TRADE PACK SPARE CONS SERV NSTK. */
  cells: Record<string, MatrixCell>
  pending?: { type: string; value: string; requestId: string }[]
}

// ---------------------------------------------------------------- plants and lanes (Book VII §4)
export type PlantState = "Draft" | "Active" | "Inactive"
export interface SetupStep {
  n: number
  action: string
  where: string
  /** Steps 2 to 5 must verify before activation. */
  gate: boolean
  done: boolean
  evidence?: string
  by?: UserId
  on?: string
}
export interface PlantRecord {
  id: string
  code: string
  name: string
  entityId: LegalEntityId
  address: string
  calendar: string
  receivingWarehouse: string
  shippingWarehouse: string
  shippingPoints: string[]
  planning: { leadTimeDays: number; planningTimeFenceDays: number; mrpArea: string; safetyTimeDays: number }
  state: PlantState
  /** Activation or deactivation waits on a Controller request; the state shown is read off it. */
  stateRequestId?: string
  stateTarget?: "Active" | "Inactive"
  steps: SetupStep[]
  history: HistoryEntry[]
}
export interface Lane {
  id: string
  fromPlant: string
  toPlant: string
  transitDays: number
  mode: "Truck" | "Rail" | "Air" | "Ocean"
  calendar: string
  costPerKg: number
  active: boolean
  history: HistoryEntry[]
}

// ---------------------------------------------------------------- intercompany
export interface IcPair {
  id: string
  seller: LegalEntityId
  buyer: LegalEntityId
  priceList: string
  accountPair: string
  taxTreatment: string
  live: boolean
  /** A new pair trades only once the Controller has approved it (undefined pairs cannot trade). */
  requestId?: string
}
export interface IcMarkup {
  id: string
  pairId: string
  family: string
  versions: Ver<{ markupPct: number; rationale: string }>[]
}
export interface IcPrice {
  id: string
  pairId: string
  material: string
  price: number
  currency: "USD" | "CAD"
  validFrom: string
  validTo?: string
}

// ---------------------------------------------------------------- reason codes and lookups
export type CatalogId = "scrap" | "hold" | "rma" | "loss" | "count" | "block" | "shortpack"
export interface ReasonCode {
  id: string
  catalog: CatalogId
  code: string
  label: string
  source: "PRD" | "Design value"
  active: boolean
  validFrom: string
  deactivatedFrom?: string
  usedBy: string
  history: HistoryEntry[]
}

// ---------------------------------------------------------------- denied-party screening
export interface DpsChecklist {
  id: string
  partyType: "Customer" | "Vendor"
  partyId: string
  partyName: string
  country: string
  items: { id: string; text: string; state: "Open" | "Done" | "Not applicable"; note?: string; by?: UserId; on?: string }[]
  result?: "Clear" | "Potential match" | "Confirmed match"
  completedBy?: UserId
  completedOn?: string
}
export interface DpsHit {
  id: string
  partyType: "Customer" | "Vendor"
  partyId: string
  partyName: string
  list: string
  listedName: string
  score: number
  runOn: string
  state: "New" | "In review" | "Cleared" | "Confirmed match"
  reviewer?: UserId
  decision?: string
  decidedOn?: string
}

// ---------------------------------------------------------------- GL mapping
export interface GlAccount {
  key: string
  account: number
  name: string
  type: string
  usedBy: string
  book: "Book I §2.4" | "Book II §2.6"
  status: "Proposed" | "Confirmed" | "Remapped"
  proposed: number
  history: HistoryEntry[]
}

// ---------------------------------------------------------------- email-action links
export interface ActionLink {
  token: string
  requestId: string
  /** The approver the link was addressed to. */
  forRole: Role
  forUser: UserId
  action: "Approve" | "Reject"
  issuedAt: string
  expiresAt: string
  usedAt?: string
  usedBy?: UserId
}

// ---------------------------------------------------------------- sagas (Book III B §2.3)
export type SagaStepState = "Done" | "Failed" | "Pending" | "Compensated" | "Skipped"
export interface SagaStep {
  n: number
  name: string
  module: string
  compensator: string
  state: SagaStepState
  at?: string
  error?: string
}
export interface Saga {
  id: string
  interfaceId: string
  name: string
  correlationId: string
  startedAt: string
  doc?: { type: "rma" | "salesOrder"; id: string }
  steps: SagaStep[]
  state: "Running" | "Failed" | "Compensating" | "Compensated" | "Completed"
  log: HistoryEntry[]
}

export interface CfgState {
  alerts: AlertRule[]
  templates: NotificationTemplate[]
  recert: RecertSheet[]
  kpis: Kpi[]
  series: NewSeries[]
  rmaReasons: RmaReason[]
  noPlan: NoPlanRow[]
  matGroups: MatGroup[]
  charClasses: CharacteristicClass[]
  serialProfiles: SerialProfile[]
  typeMatrix: TypeBehaviour[]
  plants: PlantRecord[]
  lanes: Lane[]
  icPairs: IcPair[]
  icMarkups: IcMarkup[]
  icPrices: IcPrice[]
  reasons: ReasonCode[]
  dpsChecklists: DpsChecklist[]
  dpsHits: DpsHit[]
  gl: GlAccount[]
  links: ActionLink[]
  sagas: Saga[]
  /** Pack-order creation rule and credit rules live as settings in the admin slice; these are the extra rows. */
  seq: number
}
