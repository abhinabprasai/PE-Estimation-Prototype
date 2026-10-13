// Materials module record types. Each extends a shared entity by intersection (APP-ARCHITECTURE.md §1:
// do not edit src/data/domain/entities.ts). Field names follow Book II where it names them
// [DOC:pp.141-170] (asserted). Fields marked "design" are prototype conveniences.

import type {
  AcctDeterminationRow,
  Activity,
  CountDocument,
  CountDocumentStatus,
  Currency,
  DocRef,
  EoReserveRun,
  InfoRecord,
  ISODate,
  Material,
  MaterialType,
  Mch,
  Mcr,
  Role,
  SourceListRow,
  StockStatus,
  Supersession,
  UserId,
  VendorId,
  WarehouseId,
} from "@/data/domain"

// ------------------------------------------------------------------ material views (Book II §3.4-3.13)
export type MrpType = "MRP" | "Reorder Point" | "None"
export type Procurement = "Buy" | "Make" | "Both"
export type SourcePolicy = "AVL Rank" | "Source List Fixed" | "RFQ Always"

/** Global + plant-level view data held per material in this slice. One plant at go-live (§3.3). */
export interface MaterialViews {
  materialId: Material["id"]
  // General §3.4
  groupPath: string[] // L1 / L2 / L3
  legacyCode?: string
  longText?: string
  mfrParts: { manufacturer: string; mpn: string; preferred: boolean }[]
  characteristics: { key: string; value: string }[]
  hts?: string
  scheduleB?: string
  coo?: string
  hazardous: boolean
  hazmat?: string
  buyAmerica: boolean
  stewardId?: UserId
  buyerId?: UserId
  plannerId?: UserId
  // Units §3.5
  altUoms: { uom: string; num: number; den: number; usage: "Purchase" | "Sales" | "Issue" | "Other" }[]
  netWeight?: number
  grossWeight?: number
  weightUom?: string
  dims?: string
  volume?: string
  hasPostings: boolean // base UoM immutable after first posting (E-MM-04)
  // Planning §3.6
  mrpType: MrpType
  procurement: Procurement
  specialProc?: string
  lotSizing: string
  plannedDeliveryDays?: number
  grProcDays?: number
  inHouseDays?: number
  fenceDays?: number
  scrapPct?: number
  backflush: boolean
  issueMethod?: string
  strategy?: string
  abc?: "A" | "B" | "C"
  xyz?: "X" | "Y" | "Z"
  reorderPoint?: number
  maxStock?: number
  // Purchasing §3.7
  purchUom?: string
  moq?: number
  overTolPct?: number
  underTolPct?: number
  grBasedIv: boolean
  sourcePolicy?: SourcePolicy
  qualityClauses: string[]
  purchText?: string
  taxCategory?: string
  // Production §3.8
  schedulerId?: UserId
  issueWarehouse?: WarehouseId
  batchSize?: number
  serializationAt?: string
  batchAt?: string
  mbomRef?: string
  routingRef?: string
  workNotes?: string
  // Warehouse §3.9
  defaultWarehouse?: WarehouseId
  defaultBin?: string
  putaway?: string
  picking?: string
  storage: string[]
  shelfLifeDays?: number
  countClass?: string
  // Quality §3.10
  qiReceipt: boolean
  qiProduction?: boolean
  certs: string[]
  vendorQualReq: boolean
  batchReqs: string[]
  plans: string[]
  // Accounting and costing §3.11
  valuationClass?: string
  method?: "Standard" | "Moving Average"
  priceUnit: 1 | 100 | 1000
  overheadGroup?: string
  costingLotSize?: number
  doNotCost: boolean
  futureStd?: number
  prevStd?: number
  // Sales §3.12
  sellable: boolean
  salesUom?: string
  salesTaxCategory?: string
  warrantyMonths?: number
  priceLists: string[]
  // Reference tabs §3.13
  documents: { id: string; title: string; status: string }[]
  whereUsed: { ref: string; kind: string; note?: string }[]
}

/** Field-level change history entry (§3.13: immutable; source screen / MCH / migration). */
export interface ChangeEntry {
  materialId: Material["id"]
  field: string
  old: string
  new: string
  by: UserId
  at: ISODate
  source: string
}

// ------------------------------------------------------------------ stock (Stock Overview tab, §14.1)
export type StockBucket = "Own" | "At Subcontractor" | "Consignment" | "Customer Property" | "SO-Pegged" | "In-Transit"
export interface StockRow {
  id: string
  materialId: Material["id"]
  warehouseId: WarehouseId
  bin: string
  batchId?: string
  serials?: string[]
  status: StockStatus
  qty: number
  bucket: StockBucket
  pegRef?: string
  grnId?: string
  lastMovement: ISODate
  /** De-Peg requested (reason stored), waiting for the Sales Director's decision (§14.4). */
  depeg?: { reason: string; by: UserId; on: ISODate }
}

/** Goods receipt record (owned by INV V3.0, ASM-EXT-1; this module holds the material side). */
export interface GrnRecord {
  id: `GRN-${string}`
  poId: string
  vendorId: VendorId
  on: ISODate
  lines: { materialId: Material["id"]; qty: number; batchId?: string; vendorBatch?: string; serials: string[]; status: StockStatus; value: number }[]
  /** Material could not be resolved from the event payload (design; see README request R-6). */
  unresolved?: boolean
  note?: string
}

// ------------------------------------------------------------------ MCR (Book II §4.2-4.3)
export type McrPath = "Engineering Placeholder" | "Purchasing Initiated" | "Sales Initiated" | "Migration"
export interface McrTask {
  id: string
  view: string
  ownerRole: Role
  ownerUserId: UserId
  slaDue: ISODate
  done: boolean
  doneOn?: ISODate
  doneBy?: UserId
  comment?: string
  /** Accounting & Costing waits for Planning and Purchasing (§4.2). */
  after?: string[]
}
/** No status list in the PRD (OQ-21): `stage` is descriptive text, never a badge. */
export type McrStage = "Draft" | "Tasks open" | "Ready to activate" | "Activated" | "Withdrawn" | "Rejected"
export type McrRecord = Omit<Mcr, "tasks"> & {
  tasks: McrTask[]
  path: McrPath
  stage: McrStage
  createdOn: ISODate
  createdBy: UserId
  group: string
  uom: string
  estCost?: number
  targetVendor?: string
  duplicateNote?: string
  activatedOn?: ISODate
  activatedBy?: UserId
  activity: Activity[]
}

// ------------------------------------------------------------------ MCH (§4.4, §16.1)
export type MchStage = "Draft" | "In approval" | "Approved" | "Rejected" | "Scheduled" | "Applied" | "Applied with errors" | "Cancelled"
/** Valuation-change variant of an MCH (Book II §5.4): method or price unit, period-boundary check, revaluation delta. */
export interface ValuationChange {
  kind: "Method change" | "Price unit change"
  effective: ISODate
  /** Open GRN-without-invoice per material at creation (warning list). */
  grirWarnings: { materialId: Material["id"]; grnId: string; value: number }[]
  reval: { materialId: Material["id"]; qty: number; from: number; to: number; delta: number; note?: string }[]
  totalDelta: number
  glDebit: string
  glCredit: string
  /** Release step: the Controller applies after approval (README R-13). */
  controllerApplied?: { by: UserId; on: ISODate }
}
export type MchRecord = Mch & {
  valuation?: ValuationChange
  title: string
  stage: MchStage
  fieldKey: string
  fieldClass: 1 | 2
  mode: "Set" | "Adjust %" | "Find/replace"
  apply: "Immediate" | "Effective-dated"
  effective?: ISODate
  excluded: { materialId: Material["id"]; reason: string }[]
  reason: string
  ecoRef?: string
  createdOn: ISODate
  createdBy: UserId
  log: string[]
  activity: Activity[]
}

// ------------------------------------------------------------------ supersession (§4.6)
export type SupStage = "Draft" | "In approval" | "Approved, run-out" | "Rejected" | "Closed"
export type SupersessionRecord = Supersession & {
  relationship: "One-for-One" | "One-for-Many"
  stage: SupStage
  originRef?: string
  reason: string
  disposition?: "Rework" | "Scrap" | "Return to vendor"
  startQty: number
  createdOn: ISODate
  approvedOn?: ISODate
  closedOn?: ISODate
  tasks: { id: string; doc: string; kind: string; action: string; done: boolean }[]
  activity: Activity[]
}

// ------------------------------------------------------------------ info record and source list (§7.2, §7.4)
export type IrSource = "RFQ Award" | "Contract" | "Manual" | "Migration"
export interface IrPriceRow {
  id: string
  price: number
  validFrom: ISODate
  validTo?: ISODate
  source: IrSource
  ref?: string
  /** Manual row above 5% delta waits for the Purchasing Manager (design: see README request R-3). */
  pending?: boolean
  createdBy: UserId
}
export type InfoRecordRecord = InfoRecord & {
  vendorPart?: string
  vendorDesc?: string
  purchUom?: string
  priceUnit: number
  priceRows: IrPriceRow[]
  scales: { fromQty: number; price: number }[]
  surcharge?: string
  moq?: number
  rounding?: number
  incoterms?: string
  freightPct?: number
  taxCode?: string
  actuals: { kind: "Last PO" | "Last GRN" | "Last invoice"; doc: string; price: number; on: ISODate }[]
  manualExpired?: boolean
}
export type SourceListRecord = SourceListRow & { id: string; mrpRelevant: boolean; note?: string }

// ------------------------------------------------------------------ account determination (§5.2-5.3)
/** Row state is text: the matrix has a mark/release pattern but no status list (C-50: never edited in place). */
export type AcctRowState = "Released" | "Marked" | "Draft" | "Superseded"
/** valuation_class is NULLABLE in the PRD (§18.1, key-only fallback rows); the shared type makes it
 *  required, so it is relaxed here (README request R-4). */
export type AcctRow = Omit<AcctDeterminationRow, "valuationClass"> & {
  valuationClass?: string
  id: string
  validFrom?: ISODate
  state: AcctRowState
  note?: string
  createdBy: UserId
}

// ------------------------------------------------------------------ count documents (Book I Part A §7)
export interface CountLine {
  no: number
  bin: string
  itemId: Material["id"]
  batch?: string
  uom: string
  expected: number
  count?: number
  recount?: number
  thirdCount?: number
  interim: number
  rate: number
  flags: ("Recount Required" | "Third Count Required" | "Moved During Count" | "Auto-Approved" | "Unlisted Batch")[]
  confirmedEmpty?: boolean
  /** R-CNT-03: who entered the third count and the finance witness present (RD-MM-19). */
  thirdBy?: UserId
  thirdWitness?: UserId
  /** Unlisted Batch line (§7.4 item 4): supervisor confirmation creates the batch record correction. */
  unlistedConfirmed?: boolean
  /** Serialized lines (§7.4 item 4): serials expected at snapshot and serials scanned at count. */
  expectedSerials?: string[]
  scannedSerials?: string[]
  lineDecision?: "Approved" | "Rejected"
}
export type CountDocRecord = Omit<CountDocument, "lines"> & {
  status: CountDocumentStatus
  planId: string
  warehouseId: WarehouseId
  zone: string
  blind: boolean
  softFreeze: boolean
  snapshotAt: ISODate
  generatedBy: UserId
  counterIds: UserId[]
  /** Recount by a different counter (R-CNT-02), assigned by the supervisor (RD-MM-25). */
  recounterId?: UserId
  lines: CountLine[]
  voidReason?: string
  postedOn?: ISODate
  adjustmentRef?: string
  activity: Activity[]
}

// ------------------------------------------------------------------ E&O run (§17.3)
export interface EoPolicy {
  version: string
  validFrom: ISODate
  /** reserve % per bucket per material type (design values; the PRD gives buckets, not rates) */
  rates: Record<MaterialType, [number, number, number]> // 6, 12, 24+ months
  overrides: { materialId: Material["id"]; pct: number; reason: string }[]
}
export type EoStage = "Draft" | "Computed" | "Reviewed" | "Posted"
export type EoRunRecord = Omit<EoReserveRun, "rows"> & {
  stage: EoStage
  postedOn?: ISODate
  journalRef?: string
  rows: { materialId: Material["id"]; bucket: string; value: number; pct: number; reserve: number; existing: number; reserveDelta: number; lastMovement: ISODate; note?: string }[]
}

// ------------------------------------------------------------------ safety stock (Book I Part A §10)
export type SsReason = "Demand Change" | "Lead Time Change" | "Service Level Change" | "New Item" | "Annual Review"
export interface SafetyStockRow {
  id: string
  materialId: Material["id"]
  warehouseId: WarehouseId
  ss?: number // blank row inherits the item default (§10.3)
  defaultSs: number
  uom: string
  adu: number
  ltDays: number
  onHand: number
  reserved: number
  qiHold: number
  blocked: number
  onOrder: number
  maxStock: number
  reorderQty: number
  orderMultiple: number
  breaches90: number
  /** Breaches in the trailing 12 months (SS-EX-01 over-buffered candidates, §10.4). */
  breaches12m: number
  shelfLifeDays?: number
  /** Optional 12 monthly multipliers (default 1.0); effective SS in month m = base x multiplier[m] (§10.3). */
  multipliers?: number[]
  pending?: { changeId: string; newSs?: number; newMultipliers?: number[]; reset?: boolean; pct: number; reason: SsReason; note: string; by: UserId; on: ISODate }
  history: { on: ISODate; by: UserId; old: number; new: number; reason: SsReason; approval?: string; what?: string }[]
}
export interface CustomerBuffer {
  id: string
  customerId: `CUS-${string}`
  materialId: Material["id"]
  warehouseId: WarehouseId
  qty: number
  validFrom: ISODate
  validTo?: ISODate
}

/** Data-quality worklist assignment (MM-DQ-001 "Assign owners"). */
export interface DqAssignment {
  key: string
  userId: UserId
  on: ISODate
}

export type { Currency, DocRef }

// ------------------------------------------------------------------ item sales tab (Book I Part A §4.2-4.3)
/** Row status words from §4.2 / §4.3; no S-row exists (RD-MM-13), shown as family badges. */
export type SalesPriceStatus = "Draft" | "Pending Approval" | "Active" | "Expired" | "Rejected"
export interface SalesPriceRow {
  id: string
  materialId: Material["id"]
  kind: "Price list" | "Customer"
  priceListId?: string
  customerId?: `CUS-${string}`
  currency: Currency
  price: number
  validFrom: ISODate
  validTo?: ISODate
  breaks: { fromQty: number; price: number }[]
  agreement?: string
  status: SalesPriceStatus
  approvalKind?: "Price change on sales tab" | "Below price floor"
  approvalRef?: string
  createdBy: UserId
  createdOn: ISODate
  note?: string
}
/** Material ended by a transition with no status row (K-16, RD-MM-23). */
export interface EndedMaterial {
  materialId: Material["id"]
  how: "Rejected" | "Deleted"
  on: ISODate
  by: UserId
  reason: string
}
