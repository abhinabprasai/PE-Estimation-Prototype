// Record types for the feature-list screens of purchasing-finance (13 October 2026): AVL view, contracts,
// supplier deviations, info records and source lists, vendor tax profile, RFQ scoring and bid versions,
// driver rates, margin floors, hierarchies, statistical key figures history and budgets. Where the PRD
// gives a field it is cited; fields marked "design" are prototype values shown with a design chip.

import type { CostCenterId, Currency, ISODate, MaterialId, ProfitCenterId, StpId, UserId, VendorId } from "@/data/domain"

// ------------------------------------------------------------------ info records and source lists (Book II §7.2, §7.4)
export type InfoRecSource = "RFQ Award" | "Contract" | "Manual"
export interface InfoRec {
  id: `IR-${string}` // IR-{SEQ:6} [DOC:p.157 §7.2]
  itemId: MaterialId
  vendorId: VendorId
  price: number
  unit: string
  currency: Currency
  validFrom: ISODate
  validTo?: ISODate
  scales: { fromQty: number; price: number }[]
  source: InfoRecSource
  leadDays: number
  moq?: number
  status: "Active" | "Expired" | "Blocked"
  ref?: string
}
/** Period-based source list row (Book II §7.4): Blocked is the explicit negative, a hard block at PO entry (E-MM-35). */
export interface SourceRow {
  id: string
  itemId: MaterialId
  vendorId: VendorId
  validFrom: ISODate
  validTo: ISODate
  fixed: boolean
  blocked: boolean
  mrpRelevant: boolean
  note: string
}

// ------------------------------------------------------------------ contracts and scheduling agreements (Book II §7.3, Phase 2 object)
export type ContractKind = "Contract" | "Scheduling agreement"
/** The contract has no status list in the specification (OQ-21): its state is text, never a badge. */
export type ContractState = "Draft" | "Active" | "Expired" | "Closed"
export interface ContractItem {
  itemId: MaterialId
  unit: string
  targetQty: number
  scales: { fromQty: number; price: number }[]
  /** Surcharge index applied on the purchase side (Book II §7.2 surcharge linkage). */
  surchargeIndex?: string
}
export interface ContractRelease {
  no: number
  itemId: MaterialId
  qty: number
  date: ISODate
  state: "Planned" | "Released" | "Delivered"
  poId?: string
  poLine?: number
}
export interface ContractRec {
  id: `CTR-${string}`
  kind: ContractKind
  title: string
  vendorId: VendorId
  currency: Currency
  validFrom: ISODate
  validTo: ISODate
  state: ContractState
  items: ContractItem[]
  releases: ContractRelease[]
  createdOn: ISODate
  createdBy: UserId
  history: { on: ISODate; by: UserId; text: string }[]
}

// ------------------------------------------------------------------ supplier deviation (Book IV E-DTS-04; Book IX supplier portal)
export type DeviationKind = "Alternate" | "Concession" | "Deviation"
export interface DeviationDecision {
  state: "Pending" | "Accepted" | "Rejected"
  by?: UserId
  on?: ISODate
  note?: string
}
/** No status list in the specification (OQ-21): derived text from the two decisions. */
export interface SupDevRec {
  id: `SDV-${string}`
  vendorId: VendorId
  poId?: string
  poLine?: number
  rfqId?: string
  stpId?: StpId
  characteristic: string
  kind: DeviationKind
  original: string
  proposed: string
  reason: string
  attachments: string[]
  priceDelta?: number
  leadDaysDelta?: number
  submittedOn: ISODate
  submittedBy: "Vendor portal" | UserId
  engineering: DeviationDecision
  quality: DeviationDecision
  withdrawn?: boolean
  activity: { at: ISODate; by: string; text: string }[]
}

// ------------------------------------------------------------------ AVL proposals fed by the scorecard (Book I G §7)
export interface AvlProposal {
  id: string
  avlId: string
  vendorId: VendorId
  itemId: MaterialId
  to: "Qualified" | "Conditional" | "Suspended"
  reason: string
  source: "Scorecard" | "Buyer"
  status: "Open" | "Applied" | "Declined"
  by: UserId
  on: ISODate
  decidedBy?: UserId
  decidedOn?: ISODate
}

// ------------------------------------------------------------------ vendor tax profile (Part A §11.3)
export interface TaxRegistration {
  jurisdiction: string
  number: string
  kind: "State sales/use tax" | "Province GST/HST" | "VAT / other"
}
export interface ExemptionCert {
  id: string
  jurisdiction: string
  state: "Verified" | "Pending" | "Expired"
  expires?: ISODate
}
export interface VendorTaxProfile {
  registrations: TaxRegistration[]
  defaultTaxCode: string
  /** Read-only embed of ACC 19.2 records; Add deep-links to the accounting screen. */
  certificates: ExemptionCert[]
  useTaxAccrual: boolean
  taxAddressRole: "Ship-To" | "Bill-To"
  updatedOn?: ISODate
  updatedBy?: UserId
}

// ------------------------------------------------------------------ RFQ weighted scoring and bid versions (Book IV §3.3 table)
export interface ScoringWeights {
  landed: number
  lead: number
  quality: number
  buyAmerica: number
}
export interface BidVersion {
  rfqId: string
  vendorId: VendorId
  version: number
  receivedOn: ISODate
  price: number
  leadDays: number
  freightPct: number
  dutyPct: number
  validUntil: ISODate
  buyAmerica: boolean
  note: string
  /** Deviations from the RFQ package listed on this bid (free text; structured ones are SupDevRec). */
  deviations: string[]
}
export interface RfqScoring {
  weights: ScoringWeights
  /** Selected bid version per vendor; the grid and the award read it. */
  selected: Record<string, number>
}

// ------------------------------------------------------------------ driver rates (Book I I §3.1 parametric basis)
export interface DriverRate {
  id: string
  driver: string
  unit: string
  family: string
  /** Index the rate follows, when it tracks a commodity basis. */
  index?: string
  versions: { validFrom: ISODate; rate: number; by: UserId; note: string }[]
}
export interface DriverTemplate {
  id: string
  family: string
  basis: string
  /** Template drivers per product family, seeded from historical actuals (Book I I §3.1). */
  rows: { driver: string; unit: string; qty: number }[]
  historicalWos: number
}

// ------------------------------------------------------------------ margin floors (Book I I §6.3)
export interface ItemFloor {
  itemId: MaterialId
  floorPct: number
  setBy: UserId
  on: ISODate
  note: string
}
export type BreachStatus = "Pending" | "Approved" | "Rejected"
export interface FloorBreach {
  id: string
  on: ISODate
  source: "Quote" | "Sales order" | "Price list row" | "Agreement row"
  ref: string
  itemId: MaterialId
  customerId?: string
  price: number
  cost: number
  marginPct: number
  floorPct: number
  points: number
  status: BreachStatus
  justification: string
  route: string[]
  approvedBy?: string
  requestId?: string
}

// ------------------------------------------------------------------ hierarchy and alternate hierarchies (Book I H §2)
export interface HierMove {
  id: string
  kind: "cost" | "profit"
  nodeId: string
  fromParent?: string
  toParent?: string
  effective: ISODate
  by: UserId
  on: ISODate
  reason: string
}
export interface AltNode {
  id: string
  name: string
  memberIds: string[]
}
export interface AltHierarchy {
  id: string
  kind: "cost" | "profit"
  name: string
  purpose: string
  groups: AltNode[]
  createdBy: UserId
  createdOn: ISODate
}

// ------------------------------------------------------------------ SKF history and budgets
export interface SkfChange {
  id: string
  costCenterId: CostCenterId
  period: string
  field: string
  old: number
  new: number
  by: UserId
  on: ISODate
  via: "Edit" | "Import"
}
/** FY budget by cost center and account group (ACC 21 stand-in: design values). */
export interface BudgetLine {
  costCenterId: CostCenterId
  fy: number
  group: string
  annual: number
  status: "Approved" | "Draft"
  by?: UserId
}
export interface ScoreHistory {
  vendorId: VendorId
  quarter: string
  otdPct: number
  qualityPct: number
  pricePct: number
}
export type { ProfitCenterId }
