// purchasing-finance record types. Shared entity types (src/data/domain/entities.ts) extended by
// intersection, never edited (APP-ARCHITECTURE.md section 1). Fields added here are prototype fields:
// the specification names most of them (Book I G, H, I; Book IV §3.2, §3.3, §5) and the comments say
// which are design values.

import type {
  AllocationCycle, CostCenterId, CostEstimate, CostingRun, Currency, CustomerId, CustomerPrice, DocRef, GrnRef, ISODate,
  LegalEntityId, Llr, MaterialId, PriceList, ProfitCenterId, PurchaseOrder, Requisition, Rfq, RfqResponse, Role, Stp,
  SurchargeRule, UserId, VendorId, WcRateVersion, WorkCenterId,
} from "@/data/domain"

// ------------------------------------------------------------------ purchasing (Book I G)
export type PrRec = Requisition & {
  title: string
  entityId: LegalEntityId
  requesterId: UserId
  buyerId: UserId
  /** Mandatory for expense / MRO purchases (Book I G §3). */
  costCenterId?: CostCenterId
  /** Budget remaining on the cost center + account (ACC 21), shown on expense PRs. Design value. */
  budgetRemaining?: number
  suggestedVendorId?: VendorId
  poIds: PurchaseOrder["id"][]
  rfqId?: Rfq["id"]
  note?: string
}

export type RfqRec = Rfq & {
  title: string
  buyerId: UserId
  prIds: Requisition["id"][]
  /** Engineering's technical pass / fail is recorded before commercial bids open (FL-10 stage 8). */
  technicalReviewed: boolean
  awardedVendorId?: VendorId
  awardNote?: string
  poIds: PurchaseOrder["id"][]
  cancelReason?: string
}

export type RfqResp = RfqResponse & {
  received: boolean
  receivedOn?: ISODate
  /** Landed-cost elements, percent of price (Book I G §4: price + est. freight + duty %). */
  freightPct: number
  dutyPct: number
  validUntil: ISODate
  buyAmerica: boolean
  technicalNote?: string
}

export interface PoChange {
  field: string
  old: string
  new: string
}
export interface PoRevision {
  rev: number
  on: ISODate
  by: UserId
  changes: PoChange[]
  /** Re-approval needed (value increase beyond threshold, Book I G §5.3). */
  reapproval: boolean
}
export interface ExpediteEntry {
  on: ISODate
  by: UserId
  kind: "Promise" | "Push out" | "Pull in" | "Escalate" | "Call" | "Email"
  text: string
  line?: number
  newDate?: ISODate
}
export type PoType = "Standard" | "Subcontract" | "Intercompany"
export type PoLineX = PurchaseOrder["lines"][number] & {
  needBy: ISODate
  /** Vendor-confirmed date (IF-02 capture), per line. */
  confirmedDate?: ISODate
  received: number
  invoiced: number
  /** Long-Lead — Preliminary Revision flag (Book IV §3.2). */
  llrFlag?: boolean
  promiseHistory: { on: ISODate; date: ISODate; by: UserId }[]
}
export type PoRec = Omit<PurchaseOrder, "lines"> & {
  title: string
  type: PoType
  buyerId: UserId
  shipToWarehouseId: `WH-${string}`
  qualityClauses: ("Q1" | "Q2" | "Q3" | "Q4" | "Q5")[]
  buyAmerica: boolean
  prIds: Requisition["id"][]
  rfqId?: Rfq["id"]
  lines: PoLineX[]
  revision: number
  revisions: PoRevision[]
  sentOn?: ISODate
  confirmedOn?: ISODate
  /** Purchasing Manager override for a Restricted vendor (C-32). */
  restrictedOverride?: { by: UserId; on: ISODate; reason: string }
  cancelReason?: string
  shortCloseReason?: string
  expedite: ExpediteEntry[]
  /** Intercompany pair (FL-07): seller entity and paired seller sales order. */
  ic?: { sellerEntityId: LegalEntityId; pairedSo: string; transferPriceListId: PriceList["id"] }
  /** Subcontract: components provided to the vendor (Book I G §6). */
  provided?: { itemId: MaterialId; qty: number; issued: boolean }[]
  /** Engineering change impact flagged by engineering.ecoReleased. */
  ecoImpact?: { ecoId: string; on: ISODate; note: string }[]
  /** Invoice price per line at three-way match (ACC volume; captured for IPV). */
  invoice?: { no: string; on: ISODate; lines: { line: number; price: number }[] }
}

export type GrnRec = GrnRef & {
  lines: { poLine: number; itemId: MaterialId; qty: number; price: number; std: number }[]
  postedBy: UserId
}

/** LLR has no status list in the specification (OQ-21): its state is text, never a badge. */
export type LlrState = "Draft" | "Awaiting approval" | "Approved" | "Closed"
export type LlrRec = Llr & {
  title: string
  soId: string
  state: LlrState
  createdOn: ISODate
  /** Accepted cancellation exposure recorded with the approval (Book IV §3.2). */
  acceptedCancellation?: number
  cancellationFees: number
  stpIds: Stp["id"][]
  ecoImpacts: { ecoId: string; poId: PurchaseOrder["id"]; decision?: "Proceed" | "Change order to vendor" | "Stop with exposure booking"; on?: ISODate; exposureBooked?: number }[]
  closedOn?: ISODate
  closeNote?: string
}

export type StpRec = Stp & {
  title: string
  itemId: MaterialId
  createdOn: ISODate
  supersededBy?: Stp["id"]
  llrId?: Llr["id"]
}

// ------------------------------------------------------------------ costing (Book I I)
export type CostSource = "Standard" | "AVL basis" | "Manual override" | "Driver rate" | "WC rate"
export interface CeItem {
  component: "Material" | "Labor" | "Overhead" | "Subcontract"
  text: string
  ref?: string
  qty: number
  unit: string
  rate: number
  value: number
  source: CostSource
  note?: string
}
export type CeBasis = "Released MBOM + routing" | "Draft EBOM" | "Parametric ETO model"
export type CeRec = CostEstimate & {
  title: string
  basis: CeBasis
  version: number
  createdOn: ISODate
  createdBy: UserId
  releasedOn?: ISODate
  supersededBy?: CostEstimate["id"]
  drivers?: { name: string; qty: number; unit: string }[]
  items: CeItem[]
  /** Comparison view (Book I I §3.1): last actual of settled WOs of the same or similar design. */
  lastActual?: number
}

export type RunStage = "Scoped" | "Rolled" | "Marked" | "Released"
export interface RunItem {
  itemId: MaterialId
  oldStd: number
  newStd: number
  onHand: number
  error?: string
}
export type RunRec = CostingRun & {
  stage: RunStage
  scopeKind: "All standard-cost items" | "Item groups" | "Changed-BOM flag only" | "New items only"
  createdOn: ISODate
  createdBy: UserId
  markedBy?: UserId
  releasedBy?: UserId
  releasedOn?: ISODate
  effectiveFrom?: ISODate
  items: RunItem[]
}

export type WcRateRec = WcRateVersion & {
  plannedLaborCost: number
  plannedOverheadPool: number
  plannedMachinePool: number
  plannedHours: number
  machineHours: number
  /** Released versions are never edited (C-50); a draft becomes the next dated version. */
  state: "Draft" | "Released"
  releasedBy?: UserId
}

// ------------------------------------------------------------------ pricing (Book I I §6, Book IV §5)
export type PriceListRec = PriceList & {
  code: string
  entityId: LegalEntityId
  basis: "Manual rates" | "Derived"
  derivation?: string
  rounding: "Nearest $1" | "Nearest $5" | "Two decimals"
  validFrom: ISODate
  validTo?: ISODate
  transfer?: boolean
  history: { on: ISODate; by: UserId; text: string }[]
}
export type ContractTerm = "Fixed at Order" | "Ship-Date Adjusted"
export interface AgreementRec {
  id: `AGR-${string}`
  customerId: CustomerId
  name: string
  validFrom: ISODate
  validTo: ISODate
  scope: string
  rebate?: string
  contractTerm: ContractTerm
  attachment: string
  rows: CustomerPrice[]
}
export type SurchargeRec = SurchargeRule & {
  family: string
  itemIds: MaterialId[]
  contentPerUnit: number
  contentUnit: "lb" | "kg"
  passThroughPct: number
  validFrom: ISODate
  maintainedBy: UserId
}
export type IndexRec = { index: string; month: string; value: number; postedOn: ISODate; postedBy: UserId; source: string }

// ------------------------------------------------------------------ controlling (Book I H)
export interface CenterOverlay {
  status?: "Active" | "Blocked" | "Inactive"
  parentId?: CostCenterId
  managerId?: UserId
  history: { on: ISODate; by: UserId; text: string; effective: ISODate }[]
}
export interface AddedCostCenter {
  id: CostCenterId
  name: string
  parentId?: CostCenterId
  postable: boolean
  entityId: LegalEntityId
  defaultProfitCenterId?: ProfitCenterId
  status: "Active" | "Blocked" | "Inactive"
  validFrom: ISODate
  validTo?: ISODate
}
export type Driver = "Fixed %" | "Headcount" | "Sq Ft" | "Machine Hours" | "Labor Hours" | "Revenue Share"
export interface AllocSegment {
  no: number
  senderIds: CostCenterId[]
  accountRange: string
  receiverIds: CostCenterId[]
  driver: Driver
  fixedPct?: Record<string, number>
}
export type AllocCycleRec = AllocationCycle & {
  sequence: number
  entityId: LegalEntityId
  segments: AllocSegment[]
}
export interface AllocRunLine {
  segment: number
  senderId: CostCenterId
  receiverId: CostCenterId
  driverValue: number
  amount: number
}
export interface AllocRun {
  id: `ALC-${string}`
  cycleId: AllocationCycle["id"]
  period: string
  state: "Posted" | "Reversed"
  postedOn: ISODate
  postedBy: UserId
  lines: AllocRunLine[]
  total: number
  replaces?: `ALC-${string}`
  reversedBy?: `ALC-${string}`
}
export interface SkfValue {
  costCenterId: CostCenterId
  period: string // quarter label, e.g. 2026-Q3
  headcount: number
  sqft: number
  machineHours: number
  laborHours: number
  revenueShare: number
}

// ------------------------------------------------------------------ variances and journal (Part A §8, Part J)
export type VarianceType = "PPV" | "IPV" | "MUV" | "LRV" | "LEV" | "OAV" | "SPV" | "RVV"
export interface VarianceRow {
  id: string
  type: VarianceType
  period: string
  on: ISODate
  itemId?: MaterialId
  workCenterId?: WorkCenterId
  vendorId?: VendorId
  qty: number
  stdBasis: number
  actual: number
  /** positive = unfavorable (actual exceeded standard) */
  variance: number
  source: DocRef
  journalId: `JE-${string}`
  costCenterId: CostCenterId
  profitCenterId: ProfitCenterId
  reversal?: boolean
}
export interface JournalEntry {
  id: `JE-${string}`
  on: ISODate
  period: string
  template: string
  text: string
  amount: number
  currency: Currency
  source?: DocRef
  costCenterId?: CostCenterId
  profitCenterId?: ProfitCenterId
  /** Derivation rule that fired (Book I H §3); 7 = fallback, lands on CO-R4. */
  rule: 1 | 2 | 3 | 4 | 5 | 6 | 7
  live?: boolean
}

// ------------------------------------------------------------------ vendor overlay (shared master is read-only here)
export interface VendorOverlay {
  onboarding?: "Draft" | "Docs Pending" | "Under Review" | "Active"
  quality?: "Approved" | "Conditional" | "Restricted" | "Disqualified"
  history: { on: ISODate; by: UserId; role: Role; text: string }[]
}
export interface AvlOverlay {
  status?: "Qualified" | "Conditional" | "Suspended"
  priceBasis?: string
  leadDays?: number
  note?: string
}
export interface MrpException {
  id: string
  code: "EX-01" | "EX-02" | "EX-03" | "EX-06"
  text: string
  itemId: MaterialId
  poId?: PurchaseOrder["id"]
  line?: number
  suggestedDate?: ISODate
  peg?: DocRef
  buyerId: UserId
  done?: boolean
}
