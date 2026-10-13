// inventory-ops record types. Status words come from the shared S-1..S-43 catalog; anything the
// specification gives no list for is plain text or a reading (RD-IO-nn).
import type { DocRef, LegalEntityId, PurchaseOrderStatus, SalesOrderStatus, ScanPointCode, UserId, WarehouseTaskStatus } from "@/data/domain"

// ============================================================================ warehouse tasks (Book IV §7.2)
export const TASK_TYPES = ["Receiving", "Putaway", "Replenishment", "Pick", "Stage", "Pack", "Load", "Transfer"] as const
export type TaskType = (typeof TASK_TYPES)[number]
export type TaskQueue = "Inbound" | "Outbound" | "Internal"
export type TaskPriority = "Normal" | "High" | "Urgent"
export type TaskOutcome = "Done" | "Exception"

export interface TaskStep {
  label: string
  /** The code the scan must match (case-insensitive). */
  code: string
}
export interface ScrapInfo {
  /** Where the scrap disposition comes from; decides the posting template (#20 RMA scrap, #30 operation scrap). */
  source: "RMA" | "Production"
  srcRef: DocRef
  approvedBy?: UserId
  approvedReason?: string
  approvedOn?: string
  binCode: string
  amount: number
  confirmedAt?: string
}
export interface InvTask {
  id: string
  type: TaskType
  status: WarehouseTaskStatus
  /** Set when status is Done/Exception (RD-IO-02). */
  outcome?: TaskOutcome
  queue: TaskQueue
  priority: TaskPriority
  assigneeId?: UserId
  device?: string
  /** The document the task is layered on (documents stay the system of record, Book IV §7.2). */
  docLabel: string
  docRef?: DocRef
  itemId?: string
  batch?: string
  qty: number
  uom: string
  from?: string
  to?: string
  scanPoint: ScanPointCode
  steps: TaskStep[]
  scans: string[]
  createdAt: string
  startedAt?: string
  doneAt?: string
  exception?: { reason: string; at: string; by: UserId }
  scrap?: ScrapInfo
  /** Task this one was created from (a requeue after an exception). */
  followsUp?: string
  history: { at: string; by: string; text: string }[]
}

// ============================================================================ goods receipt delta (FL-10)
export type CertType = "Mill Cert per Heat" | "CoC per Shipment" | "CoA" | "FAI Report"
export interface CertDoc {
  type: CertType
  docNo: string
  /** What the document cites: a drawing and revision ("DWG-TBD-BSH015 rev C") or a heat number. */
  cites?: string
  attachedOn: string
}
/** A delivery at the dock, not yet a GRN. */
export interface InboundReceipt {
  id: string
  poId: string
  line: number
  qty: number
  dock: string
  arrivedOn: string
  vendorBatch?: string
  deliveryNote: string
  certs: CertDoc[]
  /** Set when the receipt was posted. */
  postedAs?: string
}
/** Certificate side of a posted GRN. */
export interface GrnCheck {
  grnId: string
  certs: CertDoc[]
  vendorBatch?: string
  accepted?: { by: UserId; on: string; note?: string }
}

// ============================================================================ period close (Book I Part J, Book II §13)
export interface CloseSignoff {
  key: string
  step: string
  by: UserId
  at: string
  note?: string
}
export interface CloseRun {
  key: string
  at: string
  by: UserId
}
export interface TieDiff {
  key: string
  valuationClass: string
  /** GL minus subledger. */
  amount: number
  cause: string
  resolvedBy?: UserId
  resolvedAt?: string
  resolution?: string
}
export interface TopUp {
  key: string
  amount: number
  by: UserId
  at: string
  je: string
}

// ============================================================================ intercompany (FL-07)
export interface IcPair {
  id: string
  month: string
  sellerEntityId: LegalEntityId
  buyerEntityId: LegalEntityId
  itemId: string
  qty: number
  sellerSo?: string
  buyerPo?: string
  sellerSoStatus?: SalesOrderStatus
  buyerPoStatus?: PurchaseOrderStatus
  /** Seller IC receivable (transfer price, seller currency) and buyer IC payable (PO price, buyer currency). */
  sellerAr: number
  buyerAp: number
  sellerCurrency: "USD" | "CAD"
  buyerCurrency: "USD" | "CAD"
  /** Rate to USD for a CAD side, when one exists. */
  fxToUsd?: number
  /** Pairing rolled back at creation: neither document exists (IF-14 dead letter). */
  rolledBack?: { message: string; incident: string }
  explained?: { by: UserId; at: string; reason: string }
  note?: string
}

// ============================================================================ count plans made by the wizard
export interface CountPlanRun {
  planId: string
  at: string
  by: UserId
  warehouseId: string
  basis: "Zone" | "Aisle" | "Item group"
  team: UserId[]
  blind: boolean
  softFreeze: boolean
  docIds: string[]
  skipped: number
}

// ============================================================================ state
export interface InventoryOpsState {
  seq: number
  tasks: InvTask[]
  inbound: InboundReceipt[]
  grnChecks: GrnCheck[]
  signoffs: CloseSignoff[]
  closeRuns: CloseRun[]
  tieDiffs: TieDiff[]
  topUps: TopUp[]
  /** Warranty reserve balance per entity|month (design value, RD-IO-13). */
  reserve: Record<string, number>
  icPairs: IcPair[]
  icRecon: { month: string; at: string; by: UserId }[]
  countPlans: CountPlanRun[]
}
