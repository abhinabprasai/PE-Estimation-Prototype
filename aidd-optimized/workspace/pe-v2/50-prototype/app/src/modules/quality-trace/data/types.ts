// quality-trace local types. Shared entity types (src/data/domain/entities.ts) are extended here by
// intersection, never edited. Fields the specification names carry its words; fields marked
// "design" are prototype conveniences (see README "Readings").

import type {
  Activity, BatchId, Capa, CustomerId, DocRef, GenealogyEvent, GenealogyEventId, InspectionLotId, InspectionPlanId,
  InspectionPlanStatus, Instrument, InstrumentId, ISODate, MaterialId, NcrId, NcrRef, ProductionOrderId, RecallCampaign,
  RecallStage, RmaId, Role, SalesOrderId, Scar, ScanPointCode, SerialNo, Batch, Serial, UserId, VendorId, WarehouseId,
  WorkCenterId, CapaId, ScarId, DeviationId, Deviation, ReworkOrderId,
} from "@/data/domain"

// ------------------------------------------------------------------ gates and plans (Book I A §6, E §1)
/** Quality gates [DOC:p.84 Part E §1] (asserted). */
export type Gate = "IQC" | "IPQC" | "FQC" | "OQC" | "RQC"
/** Plan types per [DOC:p.33 §6.2]: INC / INP / FIN / PSI / RMA. The shared entity names the fifth
 *  type "RQC"; the specification says RMA (request R-1). */
export type PlanType = "INC" | "INP" | "FIN" | "PSI" | "RMA"

export const GATES: { gate: Gate; label: string; planType: PlanType; trigger: string; executedIn: string; pass: string; fail: string }[] = [
  { gate: "IQC", label: "Incoming (IQC)", planType: "INC", trigger: "GRN line, QI-required item", executedIn: "INV 6.1", pass: "QI Hold → Unrestricted", fail: "Blocked → NCR / RTV / Scrap disposition; vendor rating hit" },
  { gate: "IPQC", label: "In-Process (IPQC)", planType: "INP", trigger: "Routing op flagged QC Checkpoint", executedIn: "INV 15.2", pass: "Operation may complete", fail: "Op blocked; rework / NCR; Emergency ECR path for design causes" },
  { gate: "FQC", label: "Final Test (FQC)", planType: "FIN", trigger: "Test operation (WC-500)", executedIn: "QM-FIN-001", pass: "FTR issued; order proceeds to finish", fail: "Rework loop and full retest; NCR mandatory" },
  { gate: "OQC", label: "Pre-Shipment (OQC)", planType: "PSI", trigger: "Shipment for FG", executedIn: "INV 15.3", pass: "CoC generated; PGI enabled", fail: "Shipment blocked; NCR" },
  { gate: "RQC", label: "Return (RQC)", planType: "RMA", trigger: "RMA receipt", executedIn: "RMA Part A §3.6", pass: "Disposition path", fail: "Disposition path" },
]
export const gateOf = (t: PlanType): Gate => GATES.find((g) => g.planType === t)!.gate

export type SamplingMethod = "100%" | "AQL Sampling" | "Skip-Lot" | "Fixed Sample Size"
export type AssignmentScope = "Item" | "Item Group" | "Item + Vendor" | "Item + Operation"

export interface QtCharacteristic {
  seq: number
  name: string
  method: string
  charType: "Quantitative" | "Attributive"
  parameter: string
  uom?: string
  min?: number
  target?: number
  max?: number
  /** R-QM-02: a fail on a critical characteristic rejects the whole inspection. */
  critical: boolean
  sampleInstruction?: string
  instrumentClass?: string
  certRequired?: boolean
}

export interface PlanRevision {
  rev: string
  status: InspectionPlanStatus
  effectiveFrom: ISODate
  effectiveTo?: ISODate
  sampling: SamplingMethod
  aql?: { level: string; value: number; switching: boolean; state: "Normal" | "Tightened" | "Reduced"; /** 10 consecutive lots accepted: reduced inspection may be approved by the Quality Manager. */ reduceEligible?: boolean }
  skipLot?: { n: number }
  fixedSize?: number
  characteristics: QtCharacteristic[]
  createdBy: UserId
  createdOn: ISODate
  reviewNote?: string
  activatedBy?: UserId
  activatedOn?: ISODate
}

export interface QtPlan {
  id: InspectionPlanId
  name: string
  type: PlanType
  scope: AssignmentScope
  itemId?: MaterialId
  itemGroup?: string
  vendorId?: VendorId
  operation?: string
  revisions: PlanRevision[]
  activity: Activity[]
}

// ------------------------------------------------------------------ inspections (QM-EXEC, QM-FIN-001)
export interface ResultRow {
  seq: number
  value?: number
  attr?: "Pass" | "Fail" | "NA"
  instrumentId?: InstrumentId
  by?: UserId
  at?: ISODate
  adHoc?: boolean
}
export type Decision = "Accepted" | "Rejected"
export type Disposition = "Use as is under deviation" | "Return to vendor" | "Scrap" | "Rework"

/** One executed inspection. The specification gives no status list for an inspection record
 *  (reading QT-R01): it is open until a decision is recorded. */
export interface InspectionLot {
  id: InspectionLotId
  gate: Exclude<Gate, "FQC">
  planId?: InspectionPlanId
  planRev?: string
  /** No-plan policy "Manual Inspection": ad-hoc rows, Quality Manager sign-off mandatory. */
  adHoc?: boolean
  adHocRows?: QtCharacteristic[]
  subject: DocRef
  itemId: MaterialId
  vendorId?: VendorId
  batchId?: BatchId
  serials: SerialNo[]
  lotSize: number
  sampleSize: number
  samplePulled?: { by: UserId; on: ISODate; /** SP-05 reads the inspector badge with the batch. */ badge?: string }
  /** Skip-lot: a qualified vendor's lot that the plan does not inspect (1 of N is inspected). */
  skipped?: boolean
  instruments: InstrumentId[]
  results: ResultRow[]
  certificate?: string
  inspectorId?: UserId
  createdOn: ISODate
  /** design: SLA in days for the age colouring on the dashboard. */
  slaDays: number
  decision?: Decision
  decidedOn?: ISODate
  decidedBy?: UserId
  /** Conditional pass: Accepted with a restriction note [DOC: Book I Part D terminal QC gate; Part E roles, conditional releases] (QT-R28). */
  conditional?: { note: string; scope: string; expiresOn?: ISODate; by: UserId; on: ISODate }
  disposition?: Disposition
  ncrId?: NcrId
  deviationId?: DeviationId
  workCenterId?: WorkCenterId
  activity: Activity[]
}

export interface TestRun {
  run: number
  sessions: ISODate[]
  results: ResultRow[]
  instruments: InstrumentId[]
  testerId: UserId
  ambient: string
  outcome?: "Pass" | "Fail"
  retestScope?: number[]
}

/** Final test record for one WO serial (QM-FIN-001). Characteristics materialise from IP-FIN with
 *  the unit's design values as bounds [DOC:p.86 §3]. */
export interface FinalTest {
  id: InspectionLotId
  planId: InspectionPlanId
  planRev: string
  woId: ProductionOrderId
  woStatusText: string
  serial: SerialNo
  itemId: MaterialId
  soId: SalesOrderId
  customerId: CustomerId
  promisedOn: ISODate
  nameplate: { mva: string; voltage: string; cooling: string; impedance: string; taps: string }
  spec: QtCharacteristic[]
  typeTestOrdered: boolean
  runs: TestRun[]
  finalResult?: "Pass" | "Fail"
  ftrId?: string
  ftrIssuedOn?: ISODate
  testerSigned?: UserId
  qmCountersign?: { by: UserId; on: ISODate }
  ncrId?: NcrId
  disposition?: "Rework" | "Engineering Review" | "Scrap"
  /** Set only when planning-production has drafted the RWO; this module never invents the number. */
  rwoId?: ReworkOrderId
  /** Rework requested from planning-production through quality.reworkRequested (README R-4). */
  rwoRequestedOn?: ISODate
  /** Engineering Review: the ECR the unit is linked to, or the date a new ECR was requested [DOC:p.87 §4]. */
  ecrId?: string
  ecrRequestedOn?: ISODate
  /** Scrap needs the Controller and the Engineering Manager [DOC:p.87 §4]; the result is Fail only after both. */
  scrapApprovals?: { role: Role; by: UserId; on: ISODate }[]
  activity: Activity[]
}

// ------------------------------------------------------------------ NCR, CAPA, SCAR
export type NcrSeverity = "Critical" | "Major" | "Minor"
/** NCR is owned by INV 15.4 (ASM-EXT-1); this is the link record plus what the dashboard funnel
 *  needs. Its stage words are a reading (QT-R02), not a specification status list. */
export interface QtNcr extends NcrRef {
  severity: NcrSeverity
  stage: "Open" | "Dispositioned" | "Closed"
  openedOn: ISODate
  itemId?: MaterialId
  vendorId?: VendorId
  batchId?: BatchId
  serial?: SerialNo
  attributableTo: "Component Supplier" | "Production" | "Design" | "Not determined"
  description: string
  capaId?: CapaId
  scarId?: ScarId
}

export interface CapaAction {
  id: string
  type: "Containment" | "Corrective" | "Preventive"
  description: string
  ownerId: UserId
  dueOn: ISODate
  done: boolean
  evidence?: string
}
export interface QtCapa extends Capa {
  sources: DocRef[]
  problem: string
  method?: "5-Why" | "Fishbone" | "8D" | "FMEA"
  rootCause?: string
  actions: CapaAction[]
  effectiveness?: { method: string; checkOn: ISODate; result?: "Pass" | "Fail" }
  ownerId: UserId
  openedOn: ISODate
  activity: Activity[]
}

export type EightD = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8"
export const EIGHT_D: { d: EightD; title: string; by: "PE" | "Vendor" }[] = [
  { d: "D1", title: "Team", by: "PE" },
  { d: "D2", title: "Problem description", by: "PE" },
  { d: "D3", title: "Containment expected", by: "PE" },
  { d: "D4", title: "Root cause", by: "Vendor" },
  { d: "D5", title: "Permanent corrective action chosen", by: "Vendor" },
  { d: "D6", title: "Corrective action implemented and verified", by: "Vendor" },
  { d: "D7", title: "Recurrence prevention", by: "Vendor" },
  { d: "D8", title: "Closure and team recognition", by: "Vendor" },
]
export interface QtScar extends Scar {
  title: string
  issuedOn: ISODate
  sections: Partial<Record<EightD, string>>
  respondedOn?: ISODate
  closedOn?: ISODate
  recovery?: { amount: number; creditNote?: string }
  /** A SCAR can also start from an RMA failure attributable to a component supplier [DOC:p.89 §6]. */
  rmaId?: RmaId
  escalations: { on: ISODate; text: string }[]
  activity: Activity[]
}

// ------------------------------------------------------------------ calibration (E §7)
export interface CalEvent {
  on: ISODate
  result: "Pass" | "Fail"
  certificate: string
  lab: string
}
export interface QtInstrument extends Omit<Instrument, "events"> {
  label: string // CAL-{SEQ:4}
  type: string
  range: string
  location: string
  ownerId: UserId
  workCenterId?: WorkCenterId
  intervalDays: number
  lastCalOn: ISODate
  outOfService?: { on: ISODate; reason: string }
  events: CalEvent[]
}

// ------------------------------------------------------------------ deviations and waivers
/** No status list in the specification (OQ-21); `state` is shown as text. */
/** Deviation types of the specification [DOC:p.215 Book IV §7.3]. The shared entity still says Deviation / Waiver (README R-7). */
export type DeviationType = "Use-As-Is (waiver)" | "Temporary Process Deviation" | "Customer-Approved Concession"
export const DEVIATION_TYPES: DeviationType[] = ["Use-As-Is (waiver)", "Temporary Process Deviation", "Customer-Approved Concession"]
export interface QtDeviation extends Omit<Deviation, "type"> {
  type: DeviationType
  /** The customer flag or contract requires customer approval evidence before approval. */
  customerRequired?: boolean
  /** Value impact in USD; above the threshold the Controller approves as well (QT-R27). */
  valueImpact?: number
  title: string
  origin: "Inspection failure" | "Supplier deviation request"
  characteristic: string
  specValue: string
  acceptedValue: string
  validQty?: number
  usedQty: number
  customerEvidence?: string
  affectedSerials: SerialNo[]
  vendorId?: VendorId
  requestedBy: UserId
  requestedOn: ISODate
  state: "Requested" | "Approved" | "Rejected" | "Expired"
  approvals: { role: Role; by: UserId; on: ISODate }[]
  activity: Activity[]
}

// ------------------------------------------------------------------ recall (FL-08)
export type PopulationWhere = "In field" | "In stock" | "WIP" | "In transit" | "Returned"
export interface PopulationRow {
  serial: SerialNo
  itemId: MaterialId
  batchId: BatchId
  where: PopulationWhere
  parentSerial?: SerialNo
  customerId?: CustomerId
  site?: string
  warehouseId?: WarehouseId
  held: boolean
  notifiedOn?: ISODate
  rmaId?: RmaId
  /** Recall-class RMA requested from Sales (the RMA number arrives when Sales drafts it). */
  rmaRequestedOn?: ISODate
  disposition?: "Recovered" | "Field-corrected" | "Documented exception"
  addedInVersion: number
}
export interface QtRecall extends Omit<RecallCampaign, "population" | "stage"> {
  stage: RecallStage
  population: PopulationRow[]
  versions: { v: number; on: ISODate; by: UserId; count: number; diff: string }[]
  capaId?: CapaId
  ownerId: UserId
  reason: string
  trigger: "NCR" | "Field failure" | "Supplier notice"
  notification?: { text: string; exportedOn?: ISODate }
  partialSignoff?: { by: UserId; on: ISODate; role: Role }[]
  effectiveness?: { on: ISODate; by: UserId; accountedPct: number; costReport: string }
  costToDate: number
}

// ------------------------------------------------------------------ traceability (FL-11)
export interface QtEvent extends GenealogyEvent {
  qty?: number
  evidence: string
  /** T06 install or remove. */
  action?: "install" | "remove"
  /** Reversal / replacement pair: the original event this one corrects (C-53). */
  refersTo?: GenealogyEventId
  /** Captured offline; minutes between capture and sync (offline queue 4 h). */
  delayedMin?: number
  device?: string
}
export type QtBatch = Batch & {
  vendorId?: VendorId
  qtyReceived: number
  receivedOn: ISODate
  warehouseId?: WarehouseId
  reservedFor?: SalesOrderId
  poId?: string
  certificate?: string
}
export type QtSerial = Serial & {
  batchId?: BatchId
  bornOn: ISODate
  customerId?: CustomerId
  site?: string
  vendorSerial?: string
}
export interface TraceException {
  id: string
  kind: "Orphan event" | "Missing event" | "Delayed offline event" | "Unresolved correction"
  object: string
  eventId?: GenealogyEventId
  detail: string
  ownerId?: UserId
  raisedOn: ISODate
  resolvedOn?: ISODate
  resolution?: string
}
export interface Dossier {
  id: string
  root: string
  direction: "forward" | "backward"
  createdOn: ISODate
  by: UserId
  events: number
  nodes: number
}

// ------------------------------------------------------------------ barcode administration
export interface Printer {
  id: string
  station: string
  workCenterId?: WorkCenterId
  model: string
  address: string
  labelTypes: string[]
  registeredOn: ISODate
  active: boolean
  /** design: live state of the device for the failed-print queue (retry or redirect). */
  health?: "Online" | "Offline" | "Paper out" | "Ribbon out" | "Head open"
}
export interface LabelTemplate {
  id: string
  name: string
  symbology: string
  versions: { v: number; state: "Draft" | "Published" | "Retired"; on: ISODate; by: UserId; change: string }[]
}
export interface ScanPolicy {
  sp: ScanPointCode
  enabled: boolean
  offlineAllowed: boolean
  overrideNeedsReason: boolean
}
export interface Reprint {
  id: string
  labelId: string
  template: string
  printerId: string
  by: UserId
  on: string
  reason: string
  /** Governance fields (FX-BC-REPRINT) [DOC:p.97 Part F]: reason code; serial and nameplate reprints need Quality approval; reprints carry DUPLICATE except location labels. */
  reasonCode?: string
  kind?: string
  watermark?: boolean
  state?: "Printed" | "Awaiting Quality approval" | "Rejected"
  approvedBy?: UserId
  approvedOn?: string
}
export interface ScanException {
  id: string
  sp: ScanPointCode
  device: string
  capturedAt: string
  syncedAt: string
  code: string
  conflict: string
  resolvedOn?: ISODate
  resolution?: string
  /** Conflict card (FX-BC-EXCEPTIONS): what the offline device queued against what the system holds now. */
  queued?: string
  current?: string
  decision?: "Accepted" | "Rejected" | "Re-posted"
  supervisorId?: UserId
  reason?: string
}

export type { RecallStage }

/** Auto-Accept-with-Warning events of the no-plan policy [DOC:p.35 §6.5]: shown on the quality dashboard exception panel. */
export interface AutoAcceptWarning {
  id: string
  on: ISODate
  gate: Gate
  itemId: MaterialId
  vendorId?: VendorId
  subject: DocRef
  batchId?: BatchId
  text: string
  acknowledgedBy?: UserId
}
export interface VendorLots {
  vendorId: string
  lots: number
  accepted: number
  /** Consecutive accepted lots with no NCR (skip-lot qualification needs 10 and a rating of 98%). */
  streak?: number
}
