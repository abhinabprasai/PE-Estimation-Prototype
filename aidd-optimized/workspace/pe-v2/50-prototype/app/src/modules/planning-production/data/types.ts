// planning-production local types. Shared entity types (src/data/domain/entities.ts) are extended by
// intersection here, never edited. Fields marked "design" are prototype values the PRD does not give.

import type {
  Activity,
  BatchId,
  DocRef,
  ISODate,
  MaterialId,
  MrpRunId,
  PlannedOrder,
  ProductionOrder,
  ProductionOrderStatus,
  ReworkOrder,
  ReworkOrderId,
  Routing,
  RoutingOp,
  SalesOrderId,
  SerialNo,
  StockStatus,
  TemplateNo,
  UserId,
  WarehouseTask,
  WorkCenterId,
  WorkCenterStatus,
  ProductionOrderId,
  ConfirmationId,
  Confirmation,
} from "@/data/domain"

export type ExCode = "EX-01" | "EX-02" | "EX-03" | "EX-04" | "EX-05" | "EX-06" | "EX-07" | "EX-08" | "EX-09" | "EX-10"

/** Exception messages EX-01..EX-07 [DOC:p.72 §3.2]; EX-08 and EX-09 [DOC:p.149; p.157 Book II] (asserted). */
export const EX_CATALOG: Record<ExCode, { message: string; action: string; source: string; buy: boolean }> = {
  "EX-01": { message: "Shortage: no supply covers requirement on date", action: "Create PR / Create WO", source: "[DOC:p.72 §3.2]", buy: true },
  "EX-02": { message: "Reschedule In: supply later than need", action: "Expedite (writes to PO Expedite Board)", source: "[DOC:p.72 §3.2]", buy: true },
  "EX-03": { message: "Reschedule Out: supply earlier than need", action: "Push out (PO change proposal / WO reschedule)", source: "[DOC:p.72 §3.2]", buy: true },
  "EX-04": { message: "Excess: supply exceeds demand horizon", action: "Cancel proposal", source: "[DOC:p.72 §3.2]", buy: false },
  "EX-05": { message: "SS-BREACH: plan dips below safety stock", action: "Raise supply proposal", source: "[DOC:p.72 §3.2; Part A §10.2]", buy: false },
  "EX-06": { message: "Past-due supply", action: "Expedite / re-date", source: "[DOC:p.72 §3.2]", buy: true },
  "EX-07": { message: "BOM/routing missing or unreleased for make item", action: "Open Engineering exception", source: "[DOC:p.72 §3.2]", buy: false },
  "EX-08": { message: "Inside planning fence: change not applied automatically", action: "Planner decision with reason", source: "[DOC:p.149 Book II §3.6]", buy: false },
  "EX-09": { message: "No valid source of supply", action: "Start RFQ or AVL qualification (buyer)", source: "[DOC:p.157 Book II §7.5]", buy: true },
  "EX-10": { message: "Unworkable network demand: inactive lane or no valid production version at the supplying plant", action: "Reactivate lane or change sourcing (planner)", source: "[DOC:p.283 Book IX §4.4]", buy: false },
}

export interface MrpRun {
  id: MrpRunId
  kind: "Regenerative (nightly)" | "Net change (on demand)"
  scope: string
  startedAt: string // ISO timestamp
  minutes: number
  snapshotId: string
  plannedOrders: number
  exceptions: number
  by: string
  published: boolean
}

export interface MrpException {
  id: string
  code: ExCode
  runId: MrpRunId
  itemId: MaterialId
  needDate: ISODate
  supplyDate?: ISODate
  qty: number
  supply?: DocRef
  peg?: { soId: SalesOrderId; line: number; sched: number }
  raisedOn: ISODate
  /** Item is bought: buyers see these (EX-01/02/03/06/09 on buy items) [DOC:p.88 Part G]. */
  buy: boolean
  detail: string
  resolved?: { action: string; by: string; on: ISODate; note?: string }
}

/** Planned order with the planning fields the screens need. There is no planned-order status list
 *  in the PRD (OQ-21 pattern): the conversion state is shown as text. */
export type PlanState = "Proposed" | "Firmed" | "Converted" | "Cancelled"
export type PPPlannedOrder = PlannedOrder & {
  kind: "make" | "buy"
  firmed: boolean
  state: PlanState
  /** For make items: the MBOM / routing state MRP saw (EX-07 when not released). */
  mbomId?: string
  ebomId?: string
  mbomActive: boolean
  routingReleased: boolean
  vendorHint?: string
  cancelReason?: string
  activity: Activity[]
}

export type OpStatus = "Not Started" | "In Progress" | "Completed" | "Cancelled"
export interface OpComponent {
  materialId: MaterialId
  qtyPerUnit: number
  /** "manual" = SP-08 scan issue (#28 at issue); "backflush" = issued at confirmation (#28). */
  issue: "manual" | "backflush"
  serialized?: boolean
  issued: number
  /** Batches / serials issued so far (genealogy). */
  lots: string[]
}
export interface PPOperation {
  no: number
  workCenterId: WorkCenterId
  text: string
  setupHours: number
  runHours: number // total for the order quantity
  crew: number
  qcGate?: string // name of the in-process gate ("Winding", "Pre-Test", "Final Test")
  milestone?: boolean
  captureTemplate?: string[]
  components: OpComponent[]
  status: OpStatus
  start: ISODate
  finish: ISODate
  /** Earliest start set by a reschedule (design: the scheduler honours it). */
  notBefore?: ISODate
  sequence: number // dispatch priority within the work center queue
  crewIds: UserId[]
  andon?: { reason: string; at: string; by: string }
  staged: boolean
  inspection?: { id: string; result?: InspectionResult; requestedOn: ISODate; restriction?: string; by?: string }
  /** Required operator skill (QAL register); the terminal interlocks at SP-07 for flagged ops [DOC:p.193 Book III E §2]. */
  requiredSkill?: string
  cancelledReason?: string
  confirmedGood: number
  confirmedScrap: number
  confirmedRework: number
  capture?: Record<string, string>
  actualHours: number
}

/** Inspection results at a QC checkpoint: pass, fail, or a Quality Manager conditional pass with a
 *  restriction note [DOC:p.73 §4]. */
export type InspectionResult = "Passed" | "Failed" | "Conditional pass"
export const gatePassed = (r?: InspectionResult) => r === "Passed" || r === "Conditional pass"

export interface CostStd {
  material: number
  labor: number
  overhead: number
  subcontract: number
  hours: number
}
export type PPWorkOrder = Omit<ProductionOrder, "operations"> & {
  operations: PPOperation[]
  routingId: string
  orderType: "ETO" | "MTO" | "MTS" | "Component"
  priority: number
  serials: SerialNo[]
  costStd: CostStd
  /** Planner "Release Short" override flag [DOC:p.74 §5.2 check 2]. */
  releaseShortFlag?: { by: string; on: ISODate }
  shortage?: boolean
  gateInputs: { mbomActive: boolean; drawingsReleased: boolean | "n/a"; customerApproval: boolean | "n/a"; inspectionPlansActive: boolean; productionBlock: boolean }
  previousStatus?: ProductionOrderStatus
  fgReceivedOn?: ISODate
  completedOn?: ISODate
  settledOn?: ISODate
  settlementId?: string
  plannedOrderId?: string
  cancelDisposition?: string
  /** Cancellation disposition chosen [DOC:p.179 FL-04 f11]: finish / stop-scrap / hold. */
  cancelKind?: CancelDisposition
  /** Scrap disposition after a failed Final Test (C-26) [DOC:p.78 §8.2 "FG received or scrap-disposed"]. */
  scrapDisposedOn?: ISODate
  scrapDisposition?: string
  testPassed?: boolean
  /** Due date the backward scheduler works from [DOC:p.74 §5.1]. */
  dueDate?: ISODate
  /** Scheduling mode: backward from due date (default) or forward from release on demand [DOC:p.74 §5.1; p.192 §3]. */
  scheduleMode?: "Backward" | "Forward"
  /** Priority before an automatic escalation of a late pegged order [DOC:p.74 §5.1]. */
  escalatedFrom?: number
  promiseDate?: ISODate
  reopenRequestedOn?: ISODate
}

export type CancelDisposition = "Finish" | "Stop-scrap" | "Hold"
export type PPConfirmation = Confirmation & { reversalOf?: ConfirmationId; reversedBy?: ConfirmationId; scrapReason?: string; crewSize: number; offlineReplay?: boolean; supervisor?: { by: string; reason: string; for: string } }

export type PPReworkOrder = ReworkOrder & {
  id: ReworkOrderId
  title: string
  originKind: "Production rework" | "Test failure" | "NCR disposition" | "RMA warranty" | "RMA billable" | "NCR vendor-caused"
  parentWoId?: ProductionOrderId
  originOp?: number
  itemId: MaterialId
  serial?: string
  qty: number
  /** Re-inspection mandatory before Complete when origin is test failure or RMA [DOC:p.79 §9]. */
  reinspection: "required" | "not required"
  reinspectionResult?: "Passed" | "Failed"
  reinspectionRequestedOn?: ISODate
  ops: { no: number; workCenterId: WorkCenterId; text: string; hours: number; done: boolean }[]
  materials: { materialId: MaterialId; qty: number; value: number; lot?: string }[]
  laborRate: number
  createdOn: ISODate
  settledOn?: ISODate
  activity: Activity[]
}

export interface JournalEntry {
  id: string
  template: TemplateNo | "RWK"
  amount: number
  date: ISODate
  period: string
  source: DocRef
  detail: string
  /** Signed effect on GL 1320 WIP and 1325 WIP-Rework (design: how the WIP report reconciles). */
  wip1320: number
  wip1325: number
  reverses?: string
  /** Rework order whose 1325 balance this entry moves (production rework merge #33). */
  rwoId?: string
  /** Confirmation that caused this entry (for mirror reversal). */
  cnfId?: string
}

export interface Settlement {
  id: string
  postedOn: ISODate
  period: string
  by: string
  orders: { woId: ProductionOrderId; mat: number; lrv: number; lev: number; oav: number; journalId: string }[]
  reversed?: { on: ISODate; journalIds: string[] }
}

export interface GenealogyRow {
  id: string
  code: "T05" | "T06" | "T07" | "T08" | "T09"
  at: string
  woId: ProductionOrderId | string
  op?: number
  serial?: string
  batch?: string
  child?: string
  scanPoint?: string
  userId?: string
  text: string
}

export interface CompBatch {
  id: BatchId
  materialId: MaterialId
  stock: StockStatus
  qty: number
  bin: string
  receivedOn: ISODate
  vendorBatch?: string
}
export interface CompSerial {
  id: SerialNo
  materialId: MaterialId
  batchId?: BatchId
  status: "Available" | "QI Hold" | "In Production" | "Reserved" | "Picked" | "Shipped"
  woId?: ProductionOrderId
  parent?: string
}

export interface WcOverride {
  status: WorkCenterStatus
  maintenanceUntil?: ISODate
  shifts: number
  hoursPerShift: number
  stations: number
  utilizationTarget: number
  laborRate: number
  overheadRate: number
  machineRate?: number
  queueHours: number
  moveHours: number
  /** Freeze horizon in working days, per work center (default 5) [DOC:p.193 Book III E §3]. */
  freezeDays?: number
  crew: number
  /** Scenario what-if: extra hours per working day (overtime or an added shift). Not set on live records. */
  extraHoursPerDay?: number
  alternate?: { wcId: WorkCenterId; efficiencyPct: number }
  cycleSize?: number
  cycleHours?: number
  issueWarehouse: string
  history: Activity[]
}

export interface LocalWorkCenter {
  id: WorkCenterId
  name: string
  function: string
  costCenterId: `CC-${string}`
  capacityHoursPerDay: number
  efficiencyPct: number
  status: WorkCenterStatus
  batchResource?: boolean
}

export type PPRouting = Routing & {
  description: string
  validFrom: ISODate
  author: string
  ecoRef?: string
  productionVersionId?: string
  opsDetail: (RoutingOp & { crew: number; basis: "per unit" | "per lot" | "per cycle"; qcPlan?: string; milestone?: boolean; components: string[] })[]
  activity: Activity[]
}

export interface SchedulePublish {
  snapshotId: string
  publishedOn: string
  by: string
  moves: number
  note: string
  /** Op dates at publish: key `${woId}/${op}` -> [start, finish]. */
  dates: Record<string, [ISODate, ISODate]>
}

export interface ScheduleMove {
  key: string // `${woId}/${op}`
  notBefore: ISODate
  reason?: string
  by: string
}

export interface PromiseCandidate {
  id: string
  doc: DocRef // quotation or salesOrder
  line: number
  customerId: string
  itemId: MaterialId
  qty: number
  orderType: "MTO" | "ETO"
  /** Quote type for quote lines [DOC:p.45 Quote Type; p.193 §4 Quote integration]. Budgetary quotes carry lead-time bands, no CTP. */
  quoteType?: "Budgetary" | "Firm"
  requestedDate: ISODate
  /** Decision state: no status list in the PRD; shown as text. */
  decision: "Not checked" | "Result ready" | "Accepted" | "Declined" | "Planner review" | "Expired"
  result?: CtpResult
  reservation?: { kind: "Soft" | "Firm"; on: ISODate; expires?: ISODate; snapshotId: string }
  log: Activity[]
}

export interface CtpResult {
  ranOn: string
  ms: number
  materialDate: ISODate
  completion: ISODate
  shipDate: ISODate
  binding: string
  bindingKind: "material" | "capacity" | "requested"
  options: { label: string; shipDate: ISODate; note: string }[]
  snapshotId: string
  seeded?: boolean
}

/** The four revalidation triggers [DOC:p.193 §4] plus a planner's manual revalidation (design). */
export type AtRiskTrigger = "ECO affecting the order" | "WC outage inside its path" | "Supply slip on a pegged PO" | "Schedule publish moved its operations" | "Manual revalidation"
export interface AtRiskRecord {
  id: string
  soId: SalesOrderId
  line: number
  customerId: string
  itemId: MaterialId
  woIds: ProductionOrderId[]
  promiseDate: ISODate
  projected: ISODate
  trigger: AtRiskTrigger
  cause: string
  raisedOn: ISODate
  state: "Open" | "Recovery chosen" | "Sales change order requested" | "Resolved"
  options: { id: "overtime" | "alternate" | "partial" | "repromise"; label: string; projected: ISODate; note: string }[]
  decisions: Activity[]
}

export type PPWarehouseTask = WarehouseTask & { woId: ProductionOrderId; op: number; text: string; created: ISODate }

export interface ProdNcr {
  id: string
  woId: ProductionOrderId
  op: number
  text: string
  on: ISODate
}

/** Operator qualification register (QAL-) [DOC:p.193 Book III E §2] (asserted). */
export interface Qualification {
  id: string
  userId: UserId
  skill: string
  level: number
  expires: ISODate
}

/** CVA exception list entry raised by release check 5 (no standard cost) [DOC:p.74 §5.2 check 5]. */
export interface CvaException {
  id: string
  itemId: MaterialId
  woId: ProductionOrderId
  raisedOn: ISODate
  text: string
}

import type { ExtraState } from "./extra"

export interface PlanningProductionState extends ExtraState {
  mrpRuns: MrpRun[]
  exceptions: MrpException[]
  plannedOrders: PPPlannedOrder[]
  workCenters: LocalWorkCenter[] // own records only (shared WORK_CENTERS are referenced, not copied)
  wc: Record<string, WcOverride>
  routings: PPRouting[]
  productionOrders: PPWorkOrder[]
  confirmations: PPConfirmation[]
  reworkOrders: PPReworkOrder[]
  warehouseTasks: PPWarehouseTask[]
  journal: JournalEntry[]
  settlements: Settlement[]
  genealogy: GenealogyRow[]
  batches: CompBatch[]
  serials: CompSerial[]
  publishes: SchedulePublish[]
  moves: ScheduleMove[]
  sandbox: { moves: ScheduleMove[]; openedOn: string; by: string } | null
  promises: PromiseCandidate[]
  atRisk: AtRiskRecord[]
  ncrs: ProdNcr[]
  offlineQueue: { id: string; text: string; at: string }[]
  qualifications: Qualification[]
  cvaExceptions: CvaException[]
  seq: number
}
