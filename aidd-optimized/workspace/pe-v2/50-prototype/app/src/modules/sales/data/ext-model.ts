// Sales and service records beyond the FL-09 build: leads (OM-LEAD), customer master extension
// (OM-CUST), backorder supply and reallocation (OM-BO), RMAs (RMA-*), installed base (IB-001) and the
// as-built structure the spares finder reads (SVC-SPF-001). They live in the same "sales" slice as
// FL-09 so a conversion (lead -> prospect customer -> quotation) or a settlement (RMA -> replacement
// SO) is one atomic write.
//
// Lists quoted verbatim from the specification carry their page. Lists the specification does not
// give are design values and are marked so on screen (Chip kind="design") and in README "Readings".

import type { DocRef, Family, InstalledBaseStatus, RmaStatus, TemplateNo, WarrantyClaimBadge } from "@/data/domain"
import type { Activity } from "./model"

// ============================================================================ OM-LEAD (Book VI §4.1, p.249)
/** Lead stages, verbatim [DOC:p.249 §4.1] (asserted). Not yet in the shared status catalog (Request FR-1). */
export const LEAD_STAGES = ["Open", "Qualified", "Quoting", "Won", "Lost", "Disqualified"] as const
export type LeadStage = (typeof LEAD_STAGES)[number]
/** Family per stage: design value until the catalog row exists (OQ-18 families). */
export const LEAD_STAGE_FAMILY: Record<LeadStage, Family> = { Open: "draft", Qualified: "active", Quoting: "active", Won: "done", Lost: "cancelled", Disqualified: "cancelled" }
/** Lead source values, verbatim [DOC:p.249 §4.1]. */
export const LEAD_SOURCES = ["Referral", "Trade Show", "Website", "Direct", "Agent", "Other"] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]
/** Win probability defaulted by stage: the percentages are design values (the PRD says only "defaulted by stage"). */
export const DEFAULT_WIN_PROB: Record<LeadStage, number> = { Open: 10, Qualified: 25, Quoting: 50, Won: 100, Lost: 0, Disqualified: 0 }
/** Disqualify reason codes: the PRD requires a code but lists none (design value). */
export const DISQUALIFY_REASONS = ["No budget or funding", "No decision authority reached", "Outside PE product range", "Duplicate of an existing lead", "Project cancelled by owner", "Other"] as const
/** Qualification checklist items: the PRD names the checklist, not its items (design value). */
export const QUAL_CHECKLIST = ["Budget or funding confirmed", "Decision maker identified", "Required on-site date known", "Technical requirement captured"] as const
export const REGIONS = ["US Midwest", "US Upper Midwest", "US Pacific Northwest", "US Mountain", "Canada Prairies", "Canada Quebec", "Canada Pacific"] as const

/** Requirement capture = the quotation configuration attribute set [DOC:p.249 §4.1]. */
export interface Requirement {
  kva?: string
  primaryV?: string
  secondaryV?: string
  phases?: string
  frequency?: string
  vectorGroup?: string
  cooling?: string
  impedancePct?: string
  tap?: string
  standards?: string
  special?: string
}
export const REQ_FIELDS: [keyof Requirement, string][] = [
  ["kva", "kVA rating"],
  ["primaryV", "Primary voltage"],
  ["secondaryV", "Secondary voltage"],
  ["phases", "Phases"],
  ["frequency", "Frequency"],
  ["vectorGroup", "Vector group"],
  ["cooling", "Cooling class"],
  ["impedancePct", "Impedance percent"],
  ["tap", "Tap arrangement"],
  ["standards", "Applicable standards"],
  ["special", "Special requirements"],
]
export type PriorDecision = "New Design" | "Variant of Existing" | "Repeat Build"
export interface PriorMatch {
  ref: string
  label: string
  score: number
  source: "Design library" | "Installed base"
  matched: string[]
}
export interface Lead {
  id: string
  oppId?: string
  title: string
  source: LeadSource
  ownerId: string
  region: string
  company: string
  contactName: string
  contactTitle: string
  email: string
  phone: string
  address: string
  req: Requirement
  priorMatches?: PriorMatch[]
  priorBuild?: { ref: string; score: number; decision: PriorDecision }
  estValue: number
  currency: "USD" | "CAD"
  awardDate: string
  competitor: string
  winProb: number
  stage: LeadStage
  stageSince: string
  created: string
  checklist: Record<string, boolean>
  disqualifyReason?: string
  customerId?: string
  quotationIds: string[]
  activity: Activity[]
}

/** Design library index (the one ENG-REQ-001 also reads [DOC:p.249 Build Note]). Design values. */
export interface DesignEntry {
  ref: string
  label: string
  req: Requirement
}

// ============================================================================ OM-CUST (Book I B §2, p.49)
/** Customer Class [DOC:p.49 §2.1 General, dropdown, required]. */
export const CUSTOMER_CLASSES = ["Investor-Owned Utility", "Municipal Utility", "Co-op", "EPC Contractor", "Distributor", "OEM", "Industrial", "Government"] as const
/** Government/municipal class customers can be flagged Exempt from Auto Hold (Controller only) [DOC:p.49 §2.2]. */
export const AUTO_HOLD_EXEMPTABLE = ["Municipal Utility", "Government"]
export interface CustAddress {
  kind: "Bill-To" | "Ship-To" | "Both"
  isDefault: boolean
  site: string
  text: string
  instructions?: string
  crane?: boolean
  maxVehicle?: string
}
export interface CustContact {
  name: string
  title: string
  roles: ("Purchasing" | "Engineering" | "AP" | "Receiving")[]
  email: string
  phone: string
  primary: boolean
}
export interface CustExt {
  dba?: string
  segment: string
  parentId?: string
  ownerId: string
  addresses: CustAddress[]
  contacts: CustContact[]
  priceList?: string
  paymentTerms: string
  freightTerms: string
  invoiceDelivery: "Email PDF" | "Portal" | "EDI (phase 3)"
  consolidation: "Per shipment" | "Per order" | "Monthly"
  ratingRef?: string
  lastReview?: string
  reviewer?: string
  taxExempt: boolean
  nexus: string[]
  exemptFromAutoHold: boolean
  documents: string[]
  activity: Activity[]
}

// ============================================================================ OM-BO (Book IV §2.2, p.207)
export interface SupplyOption {
  id: string
  kind: "Production order" | "Stock in another warehouse" | "Engineering-approved alternate"
  ref: string
  itemId: string
  /** For an alternate: the item it replaces. */
  forItem?: string
  qty: number
  free: number
  date: string
  note?: string
}
export interface Reallocation {
  id: string
  item: string
  qty: number
  receiver: { soId: string; line: number; sched: number }
  donor: { soId: string; line: number; sched: number }
  proposedBy: string
  on: string
  state: "Waiting for Sales Director" | "Approved and moved" | "Rejected"
  decidedOn?: string
  reason?: string
}

// ============================================================================ RMA (Book I A §3, pp.21-27)
export type RmaClass = "RC1" | "RC2" | "RC3" | "RC4"
export const RMA_CLASSES: { id: RmaClass; label: string }[] = [
  { id: "RC1", label: "RC1 Component / distribution return" },
  { id: "RC2", label: "RC2 Finished transformer, not yet energized" },
  { id: "RC3", label: "RC3 Field return of installed / energized unit" },
  { id: "RC4", label: "RC4 Return for billable repair / refurbishment" },
]
export const REF_TYPES = ["Invoice", "Sales Order", "Serial Number", "No Reference"] as const
export type RefType = (typeof REF_TYPES)[number]
export const RMA_REASONS = [
  "Defective — Warranty",
  "Defective — Out of Warranty",
  "Damaged in Transit",
  "Wrong Item Shipped",
  "Wrong Item Ordered",
  "Overshipment",
  "Customer Convenience",
  "Recall",
  "Billable Repair",
] as const
export type RmaReason = (typeof RMA_REASONS)[number]
/** Restocking fee default by reason [DOC:p.23 §3.4; p.27 §3.10]. */
export const restockDefault = (r: RmaReason) => (r === "Customer Convenience" ? 15 : r === "Wrong Item Ordered" ? 10 : 0)
/** Freight terms default by reason [DOC:p.23 §3.4]. */
export const freightDefault = (r: RmaReason): RmaFreight => (["Defective — Warranty", "Wrong Item Shipped", "Recall"].includes(r) ? "PE Pays" : "Customer Pays")
export type RmaFreight = "PE Pays" | "Customer Pays" | "Third Party"
/** Restocking fee role limit (reading SR-17: the PRD says "editable within role limit; above-limit values
 *  route to approval" [DOC:p.23 §3.4.1] but gives no limits). Customer service may set up to the reason's
 *  policy default; the Customer Service Manager up to 25%. Above the actor's limit the RMA carries a flag
 *  and the CS Manager approves the fee on the RMA approval (step 1 of every route). */
export const restockRoleLimit = (role: string, reason: RmaReason) => (role === "Customer Service Manager" ? 25 : restockDefault(reason))
/** Return warehouses of type Quarantine (reading SR-18: the shared warehouse master has no type field yet, FR-14). */
export const QUARANTINE_WAREHOUSES = ["WH-TBD-01 Fargo, ND · Quarantine zone Q1", "WH-TBD-02 Regina, SK · Quarantine zone Q2"] as const
/** Warranty exclusions catalog referenced by adjudication [DOC:p.215 §7.4 "exclusions catalog (site
 *  conditions, installation error categories)"]. The two categories are the PRD's; the entries are
 *  design values (reading SR-19). */
export const EXCLUSIONS: { code: string; category: "Site conditions" | "Installation error"; text: string }[] = [
  { code: "EXC-SC-01", category: "Site conditions", text: "Lightning or switching surge beyond the unit's BIL rating" },
  { code: "EXC-SC-02", category: "Site conditions", text: "Flooding, fire or seismic event at the site" },
  { code: "EXC-SC-03", category: "Site conditions", text: "Sustained overload beyond nameplate rating" },
  { code: "EXC-IE-01", category: "Installation error", text: "Incorrect tap or connection set at commissioning" },
  { code: "EXC-IE-02", category: "Installation error", text: "Oil filled or topped up with an unapproved fluid" },
  { code: "EXC-IE-03", category: "Installation error", text: "Bushing or accessory fitted without PE instructions" },
]
export const CONDITIONS = ["Undamaged", "Damaged Packaging", "Damaged Product", "Leaking Oil"] as const
export type Condition = (typeof CONDITIONS)[number]
export const ATTRIBUTABLE = ["Manufacturing Defect", "Component Supplier", "Transit Damage", "Installation Error", "Site Conditions", "Normal Wear", "Undetermined"] as const
export type Attributable = (typeof ATTRIBUTABLE)[number]
export const DISPOSITIONS = ["Restock", "Repair — Warranty", "Repair — Billable", "Replace", "Scrap", "Return to Customer As-Is"] as const
export type Disposition = (typeof DISPOSITIONS)[number]
export const EXPECTED_DISPOSITIONS = ["Restock", "Repair", "Replace", "Credit"] as const
export type ExpectedDisposition = (typeof EXPECTED_DISPOSITIONS)[number]
export const TEARDOWN_ITEMS = ["Winding condition", "Core condition", "Oil test results", "Bushing condition", "Tap changer condition"] as const

export interface RmaLine {
  no: number
  itemId: string
  serial?: string
  batch?: string
  qtyAuth: number
  qtyRecd: number
  origPrice: number
  /** Valuation rate at original issue (basis of #17, #18, #20). */
  valuation: number
  expected?: ExpectedDisposition
  /** Customer property: repair-and-return; non-valuated receipt, no #17 [DOC:p.24 §3.5]. */
  customerProperty: boolean
  unauthorized?: boolean
  unverifiedSerial?: boolean
  condition?: Condition
  photo?: string
  disposition?: Disposition
  notes?: string
}
export interface RmaReceipt {
  id: string
  date: string
  by: string
  lines: { line: number; qty: number; condition: Condition; photo?: string; serial?: string; bin?: string; customerProperty?: boolean }[]
  posted17: number
}
export interface SettleStep {
  id: string
  line?: number
  label: string
  template?: TemplateNo
  amount: number | null
  /** Posting detail shown in PostingPreview, or why nothing posts now. */
  detail: string
  doc?: DocRef
  done: boolean
  error?: string
}
export interface Rma {
  id: string
  cls: RmaClass
  status: RmaStatus
  warranty: WarrantyClaimBadge
  customerId: string
  refType: RefType
  refDoc?: string
  reason: RmaReason
  reasonDetail: string
  warehouse: string
  freight: RmaFreight
  carrier?: string
  rc3?: { oilDrained: boolean; oilGal: number; nitrogen: boolean; impactRecorder: boolean }
  restockPct: number
  expectedReturn?: string
  ownerId: string
  requested: string
  receivedDate?: string
  statusSince: string
  lines: RmaLine[]
  receipts: RmaReceipt[]
  findings?: string
  teardown?: Record<string, string>
  attributable?: Attributable
  adjudication?: { verdict: "Warranty Approved" | "Warranty Denied"; justification: string; by: string; on: string; /** user who adjudicated (segregation of duties: not the credit approver, FL-05) */ byUser?: string; /** exclusions catalog entry the adjudication relies on (p.215 §7.4) */ exclusion?: string }
  /** RC3 inspection photographs (mandatory attachments, p.21 §3.2 step 5). */
  inspectionPhotos?: string[]
  /** Restocking fee above the creating role's limit (reading SR-17): the CS Manager approves it on the RMA approval. */
  restockAboveLimit?: { pct: number; limit: number; role: string }
  /** Goodwill replacement Controller approval (p.27 §3.10): the request raised at disposition and its outcome. */
  goodwillReq?: string
  goodwillDecision?: { outcome: "Approved" | "Rejected"; requestId: string; on: string; reason?: string }
  /** Disposition approval by the Quality Manager (RMA-DISP "Inspectors propose, Quality Manager approves"). */
  dispositionDecision?: { outcome: "Approved" | "Rejected"; byUser: string; on: string; reason?: string }
  /** Recall from Pending Approval back to Draft: the request the engine still holds open (FR-11). */
  recalledReq?: string
  /** Receipt-to-inspection SLA breach alert raised to the Quality Manager (p.27 §3.10, INV 15.11). */
  slaAlert?: { on: string; to: "Quality Manager"; businessDays: number }
  ncrId?: string
  scarId?: string
  settlement: SettleStep[]
  linked: DocRef[]
  recallId?: string
  ibId?: string
  goodwill?: boolean
  cancelReason?: string
  closedOn?: string
  /** Damaged-in-transit with PE freight: freight claim sub-record (p.27 §3.9), tracked on the Financials tab. */
  freightClaim?: { carrier: string; claimNo: string; amount: number; status: string; opened?: string; recoveredOn?: string }
  activity: Activity[]
}

// ============================================================================ IB-001 (Book IV §7.4, p.215)
export interface Ib {
  id: string
  serial: string
  itemId: string
  customerId: string
  site: string
  soId?: string
  deliveryId?: string
  shipDate: string
  podDate?: string
  commissioningDate?: string
  status: InstalledBaseStatus
  /** Contract election [DOC:p.215 §7.4]: ship date by default. */
  warrantyBasis: "Ship date" | "POD date" | "Commissioning date"
  warrantyMonths: number
  soOverrideMonths?: number
  extensions: { id: string; months: number; reason: string; on: string; by: string; approved: boolean; byUser?: string; decided?: { outcome: "Approved" | "Rejected"; by: string; on: string; reason?: string } }[]
  transfers: { on: string; fromCustomerId: string; toCustomerId: string; document: string; by: string }[]
  history: { on: string; text: string; doc?: DocRef }[]
}

// ============================================================================ SVC-SPF-001 (Book VI §5.1, p.254)
export interface AsBuiltLine {
  level: number
  itemId: string
  qty: number
  serials?: string[]
  batch?: string
  /** The orderable spare when the built part is not sold as-is, or its successor in the supersession register. */
  successor?: string
  supersessionNote?: string
  /** Why the original cannot be forced instead of the successor (policy, p.254 §5.1). */
  forceBlocked?: string
  wear?: boolean
  safetyCritical?: boolean
  hazardous?: boolean
  exportControlled?: boolean
}
