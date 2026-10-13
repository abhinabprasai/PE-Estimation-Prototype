// Feature-list additions for the sales group (12 October 2026): lead import, billing plan, ETO cost,
// sales kits, shipments, change / cancel / reprice, de-peg, customer property, quotation panels,
// tax profile, exclusions catalog, credit memo, billable repair and pack-station extensions.
//
// All of it lives in `db.fx` inside the existing "sales" slice, so one action can change an order and
// its feature record in a single atomic write. Lists the PRD gives carry their page; anything the PRD
// leaves open is a design value and is shown on screen as a reading (SR-25 onward, see README).

import type { Activity } from "../data/model"

// ============================================================================ the nine screen states
/** Nine states every screen can show (the feature list's state matrix). Pages read `?state=`. */
export const FX_STATES = ["normal", "empty", "loading", "validation", "authorization", "conflict", "offline", "degraded", "read-only"] as const
export type FxScreenState = (typeof FX_STATES)[number]

// ============================================================================ lead import (Book VI §4)
export type InboundChannel = "Web form" | "Email" | "Trade contact import"
export const INBOUND_CHANNELS: InboundChannel[] = ["Web form", "Email", "Trade contact import"]
/** Review states of an inbound capture: design values (the PRD names the channels, not a status list; SR-25). */
export type InboundStatus = "New" | "Needs review" | "Possible duplicate" | "Accepted" | "Merged" | "Rejected"
export interface InboundCapture {
  id: string
  channel: InboundChannel
  receivedAt: string
  batchId?: string
  company: string
  contactName: string
  contactTitle: string
  email: string
  phone: string
  subject: string
  body: string
  /** Attributes the parser lifted from the text, in the lead requirement fields. */
  parsed: { kva?: string; primaryV?: string; secondaryV?: string; standards?: string; region?: string }
  confidence: number
  issues: string[]
  status: InboundStatus
  leadId?: string
  reason?: string
  decidedBy?: string
}
export interface ImportBatch {
  id: string
  channel: InboundChannel
  fileName: string
  at: string
  by: string
  rows: number
  imported: number
  rejected: number
  errors: { row: number; message: string }[]
}
export const INBOUND_REJECT_REASONS = ["Spam or unrelated", "Outside PE product range", "Personal contact, no project", "Duplicate of a lead already worked", "Other"] as const

// ============================================================================ billing plan (Book I B §4.4, p.53)
export const BILLING_KINDS = ["On Shipment", "Milestone", "On Delivery Confirmation"] as const
export type BillingKind = (typeof BILLING_KINDS)[number]
export interface Milestone {
  id: string
  label: string
  pct: number
  /** Trigger and evidence are the PRD's default template [DOC:p.53 §4.4]. */
  trigger: string
  evidence: string
  state: "Planned" | "Invoice request raised" | "Invoiced"
  irId?: string
  raisedOn?: string
}
export interface BillingPlan {
  soId: string
  kind: BillingKind
  milestones: Milestone[]
  version: number
  history: Activity[]
}
/** Default ETO template, editable per order, must total 100% [DOC:p.53 §4.4]. */
export const DEFAULT_MILESTONES: { label: string; pct: number; trigger: string; evidence: string }[] = [
  { label: "Order Acceptance / Down Payment", pct: 20, trigger: "SO status Confirmed", evidence: "Signed order confirmation" },
  { label: "Design Approval", pct: 10, trigger: "Customer drawing approval milestone complete (Part C §4)", evidence: "Approved drawing transmittal" },
  { label: "Major Materials Procured", pct: 20, trigger: "All long-lead POs (core steel, copper, bushings, tap changer) confirmed", evidence: "PO confirmations report" },
  { label: "Production Complete / Tested", pct: 30, trigger: "Final Test passed (FTR issued)", evidence: "Certified test report" },
  { label: "Shipment", pct: 15, trigger: "PGI posted", evidence: "BOL" },
  { label: "Delivery / Commissioning Support", pct: 5, trigger: "POD or site acceptance", evidence: "POD" },
]

// ============================================================================ ETO order cost panel (Book IV §7.6)
export interface CostLine {
  id: string
  label: string
  estimate: number
  /** Committed = open POs + LLR exposure + subcontract commitments (the PRD's committed cost). */
  committed: number
  actual: number
  remaining: number
}
export interface LlrExposure {
  id: string
  label: string
  cap: number
  openPoValue: number
  cancellationFees: number
  risk: "Low" | "Medium" | "High"
}
export interface EtoCost {
  soId: string
  ceId: string
  units: number
  lines: CostLine[]
  llr: LlrExposure[]
  baselines: { version: number; at: string; reason: string; estimate: number; by: string }[]
}
/** EAC = actuals + remaining operations at standard + unissued material at current basis + open commitments
 *  not yet consumed [DOC:p.211 Book IV §7.6]. `remaining` holds the second and third terms (uncommitted); `committed`
 *  (open POs, LLR exposure, subcontract commitments) is the fourth. */
export function etoTotals(c: EtoCost, quoted: number) {
  const estimate = c.lines.reduce((s, l) => s + l.estimate, 0)
  const llrExposure = c.llr.reduce((s, l) => s + l.openPoValue + l.cancellationFees, 0)
  const committed = c.lines.reduce((s, l) => s + l.committed, 0) + llrExposure
  const actual = c.lines.reduce((s, l) => s + l.actual, 0)
  const remaining = c.lines.reduce((s, l) => s + l.remaining, 0)
  const eac = actual + remaining + committed
  const mac = quoted - eac
  return { estimate, llrExposure, committed, actual, remaining, eac, mac, macPct: quoted ? (mac / quoted) * 100 : 0, estMarginPct: quoted ? ((quoted - estimate) / quoted) * 100 : 0, variance: eac - estimate }
}

// ============================================================================ sales kits (Book IV §6.1, p.257)
export interface KitDef {
  id: string
  name: string
  /** Header is a material of type KIT: non-stocked, non-valuated (the shared catalogue has no KIT type yet; FR-16). */
  headerPrice: number
  pricing: "Header price" | "Component priced"
  components: { item: string; qty: number; price: number }[]
  /** Usage Sales BOM, single level, released through the EBOM review path. */
  bomRev: string
  status: "Released" | "Draft"
}
export interface KitLine {
  /** "QT-TBD-0412-V2/10" or "SO-2026-00301/20". */
  key: string
  docType: "quotation" | "salesOrder"
  docId: string
  lineNo: number
  kitId: string
  by: string
  at: string
}

// ============================================================================ shipments (Book I B §5, p.55)
export const DOC_KEYS = ["BOL", "Packing list", "CoC", "Test reports (FTR)", "Export documents"] as const
export type DocKey = (typeof DOC_KEYS)[number]
export type DocState = "Not generated" | "Draft" | "Generated"
export interface ShipDoc {
  state: DocState
  at?: string
  by?: string
}
export type TenderState = "Not tendered" | "Tendered" | "Accepted" | "Rejected"
export const CARRIERS = ["Heartland Heavy Haul", "Prairie Freightways", "Northline Carriers", "Big Sky Flatbed Co.", "Lakeland Transformer Logistics", "Cascade Heavy Transport"] as const
export const PERMIT_ITEMS = ["Oversize/overweight permit", "Escort vehicle arranged", "Route survey done", "Utility line clearance confirmed", "Bridge and weight-restriction check"] as const
export interface ExportItem {
  id: string
  label: string
  state: "Not started" | "Prepared" | "Verified"
  note?: string
}
export interface ShipExt {
  deliveryId: string
  tender: TenderState
  tenderAt?: string
  rejectedReason?: string
  carrierHistory: Activity[]
  /** Permit items applicable to this load (over-dimensional units state a checklist). */
  permitItems: string[]
  /** HU ids in loading sequence (SP-18 confirms it). */
  loadSeq: string[]
  appointment?: string
  docs: Record<DocKey, ShipDoc>
  psi: { state: "Open" | "Passed" | "Failed"; reason?: string; at?: string; by?: string; cocId?: string }
  export: ExportItem[] | null
  outOfSeq: { hu: string; expected: string; at: string; by: string; reason: string }[]
  scanLog: { at: string; code: string; result: string }[]
}
export const EXPORT_CHECKLIST: Omit<ExportItem, "state">[] = [
  { id: "X1", label: "Commercial invoice with HS code per line" },
  { id: "X2", label: "Packing list with HU weights and country of origin" },
  { id: "X3", label: "Certificate of origin (USMCA)" },
  { id: "X4", label: "Export declaration filed (EEI) or CBSA import data sent to the broker" },
  { id: "X5", label: "Shipper's letter of instruction to the carrier or broker" },
  { id: "X6", label: "Dangerous goods declaration (oil totes shipped separately)" },
]

// ============================================================================ delivery rules (Book IV §2.3, E-DLV-01)
export interface DeliveryRule {
  id: string
  kind: "Split, mandatory" | "Split, planner elective" | "Merge, allowed" | "Group"
  name: string
  source: string
}
/** The PRD says every split or merge decision stores the rule that fired and that E-DLV-01 messages name it,
 *  but gives no rule identifiers (the earlier build showed RULE-TBD). These ids are design values (reading SR-26). */
export const DELIVERY_RULES: DeliveryRule[] = [
  { id: "DLV-SPLIT-M1", kind: "Split, mandatory", name: "Split, mandatory: different ship-to sites", source: "DOC:p.207 §2.3" },
  { id: "DLV-SPLIT-M2", kind: "Split, mandatory", name: "Split, mandatory: different Incoterms", source: "DOC:p.207 §2.3" },
  { id: "DLV-SPLIT-M3", kind: "Split, mandatory", name: "Split, mandatory: hazmat segregation (oil totes vs electronics)", source: "DOC:p.207 §2.3" },
  { id: "DLV-SPLIT-M4", kind: "Split, mandatory", name: "Split, mandatory: over-dimensional units", source: "DOC:p.207 §2.3" },
  { id: "DLV-SPLIT-M5", kind: "Split, mandatory", name: "Split, mandatory: customer no-partial flag", source: "DOC:p.207 §2.3" },
  { id: "DLV-SPLIT-E1", kind: "Split, planner elective", name: "Split, elective: schedules more than 7 days apart", source: "DOC:p.207 §2.3" },
  { id: "DLV-SPLIT-E2", kind: "Split, planner elective", name: "Split, elective: equipment type differs (flatbed vs van)", source: "DOC:p.207 §2.3" },
  { id: "DLV-SPLIT-E3", kind: "Split, planner elective", name: "Split, elective: weight over vehicle capacity", source: "DOC:p.207 §2.3" },
  { id: "DLV-MERGE-1", kind: "Merge, allowed", name: "Merge: same customer, ship-to, Incoterms and date window across orders", source: "DOC:p.207 §2.3" },
  { id: "DLV-GROUP-0", kind: "Group", name: "Grouped: same ship-to and Incoterms, all schedules due in the horizon", source: "DOC:p.207 §2.3" },
]
export const ruleById = (id: string) => DELIVERY_RULES.find((r) => r.id === id)
/** Map the rule text stored on a delivery to its design id (older records carry RULE-TBD). */
export function ruleIdFor(ruleText: string, stored?: string): string {
  if (stored && stored !== "RULE-TBD" && ruleById(stored)) return stored
  const t = ruleText.toLowerCase()
  const hit = DELIVERY_RULES.find((r) => t.startsWith(r.name.toLowerCase().slice(0, 22)) || t.includes(r.name.toLowerCase().split(": ")[1] ?? "~~"))
  return hit?.id ?? "RULE-TBD"
}
/** E-DLV-01 explanation: the message names the rule that fired. */
export const explainRule = (ruleText: string, stored?: string) => {
  const id = ruleIdFor(ruleText, stored)
  const r = ruleById(id)
  return { id, text: r ? `E-DLV-01 ${id}: ${r.name}. Source ${r.source}.` : `E-DLV-01: rule not recorded (${ruleText})` }
}
export const VEHICLE_CAPACITY_KG = 20000 // design value (reading SR-26): the PRD says "vehicle capacity" without a figure
export const DATE_WINDOW_DAYS = 7 // PRD default N = 7 [DOC:p.207 §2.3]

export interface RunGroup {
  key: string
  customerId: string
  shipTo: string
  incoterms: string
  warehouse: string
  soIds: string[]
  items: { soId: string; line: number; sched: number; qty: number; item: string; kg: number }[]
  ruleId: string
  why: string
  /** True when the rule kept schedules apart or waiting rather than grouped. */
  held?: boolean
  mergeGroup?: string
}
export interface DeliveryRunLog {
  id: string
  at: string
  by: string
  mode: "On demand" | "Nightly"
  horizonDays: number
  scope: string
  created: { deliveryId: string; ruleId: string; soIds: string[] }[]
  held: { key: string; why: string }[]
}

// ============================================================================ change, cancel, reprice, de-peg (Book I B §4.5; Book II §14.4)
export type ChangeField = "Quantity" | "Requested ship date" | "Unit price" | "ETO configuration"
export const CHANGE_FIELDS: ChangeField[] = ["Quantity", "Requested ship date", "Unit price", "ETO configuration"]
export interface ChangeOrder {
  id: string
  soId: string
  line: number
  field: ChangeField
  oldValue: string
  newValue: string
  reason: string
  initiator: string
  at: string
  version: number
  valueBefore: number
  valueAfter: number
  creditRechecked: boolean
  creditResult?: "passed" | "failed"
  repromised?: string
  ecrRef?: string
  confirmationPdf: string
}
export interface CancelRecord {
  id: string
  soId: string
  scope: "Full order" | "Line"
  line?: number
  feePct: number
  feeAmount: number
  feeLineRef?: string
  reason: string
  at: string
  by: string
  woDisposition?: { woId: string; choice?: "Finish to stock" | "Stop and scrap" | "Stop and hold"; state: "Waiting for Production Manager" | "Decided"; decidedBy?: string; decidedAt?: string }
  state: "Complete" | "Pending WO disposition"
}
export const WO_DISPOSITIONS = ["Finish to stock", "Stop and scrap", "Stop and hold"] as const
export interface DePeg {
  id: string
  soId: string
  line: number
  sched: number
  toSo: string
  toLine: number
  toSched: number
  stock: string
  reason: string
  requestedBy: string
  at: string
  state: "Waiting for Sales Director" | "Approved" | "Rejected"
  decidedBy?: string
  decidedAt?: string
  decisionReason?: string
}
/** Contract cancellation fee: contract-based in the PRD, no figure given. Default 10% for ETO, 5% otherwise (reading SR-27). */
export const cancelFeeDefault = (type: string) => (type === "ETO" ? 10 : 5)

// ============================================================================ customer property (Book II §14.3)
export interface CustProp {
  id: string
  soId: string
  item: string
  description: string
  batchOrSerial: string
  received: number
  consumed: number
  returned: number
  scrapped: number
  returnNote?: string
  /** Zero-value delivery that carried the property return note. */
  returnDelivery?: string
  log: Activity[]
}

// ============================================================================ quotation additions (Book I B §3; Book IV §5)
export const LOSS_REASONS = ["Price", "Lead Time", "Technical", "Relationship", "No-Bid", "Other"] as const
export type LossReason = (typeof LOSS_REASONS)[number]
export interface SurchargeLine {
  line: number
  kind: "Copper" | "CRGO steel"
  index: string
  basisDate: string
  basis: number
  current: number
  contentPerUnit: number
  unit: string
}
export interface QuoteExt {
  type: "Budgetary" | "Firm"
  ceId?: string
  /** Estimate cost per unit by line (ETO lines carry the CE total; catalogue lines the standard). */
  costPerUnit: Record<number, number>
  leadTimeWeeks: Record<number, number>
  ctp: Record<number, { state: "Feasible" | "Pending" | "Not required" | "Band only"; date?: string; constraint?: string }>
  surcharges: SurchargeLine[]
  winLoss?: { outcome: "Won" | "Lost"; reason?: LossReason; notes: string; at: string; by: string; competitor?: string }
  /** Binding-estimate datasheet values by line (ETO configuration). */
  datasheet?: Record<number, Record<string, string>>
}
/** Quote margin thresholds are not in the PRD ("Margin below target" and "floor"); design values (reading SR-28). */
export const MARGIN_TARGET_PCT = 22
export const MARGIN_FLOOR_PCT = 15
/** Customer-agreement discount rate and volume break used to rebuild price waterfalls (reading SR-29). */
export const PRICE_ACCESS = ["Manual override", "Customer agreement", "Price list", "Item default"] as const

// ============================================================================ customer tax profile (Book I A §11.3, pp.45-46)
export interface TaxRegistration {
  jurisdiction: string
  number: string
  type: "Sales tax permit" | "GST/HST" | "QST" | "PST"
  verified: boolean
}
export interface ExemptionCert {
  id: string
  state: string
  status: "Verified" | "Pending review" | "Expired"
  validTo: string
  reason: string
}
export interface TaxProfile {
  registrations: TaxRegistration[]
  defaultTaxCode: string
  certificates: ExemptionCert[]
  /** Use tax accrual toggle is a vendor field in the PRD; shown here as the customer-side "not applicable" with the vendor rule. */
  useTaxAccrual: boolean
  addressRole: "Ship-To" | "Bill-To"
  nexusStates: string[]
  note?: string
}

// ============================================================================ warranty exclusions catalog (Book IV §7.4, p.215)
export interface Exclusion {
  code: string
  category: "Site conditions" | "Installation error"
  text: string
  active: boolean
  version: number
  effectiveFrom: string
  /** Prior versions (effective-dated; history stays visible, C-50). */
  history: { version: number; text: string; effectiveFrom: string; changedBy: string; reason: string }[]
}

// ============================================================================ credit memo and billable repair (Book I A §3.2, §3.6.1, §3.9)
export interface CreditMemoReq {
  id: string
  rmaId: string
  amount: number
  restocking: number
  state: "Requested" | "Blocked: credit hold" | "Released by Controller" | "Posted" | "Rejected"
  requestedAt: string
  requestedBy: string
  note?: string
  releasedBy?: string
  releasedAt?: string
  reason?: string
}
export interface RepairQuote {
  id: string
  rmaId: string
  lines: { label: string; qty: number; price: number }[]
  state: "Draft" | "Sent to customer" | "Approved" | "Declined" | "Expired"
  sentOn?: string
  validUntil?: string
  decidedOn?: string
  decidedBy?: string
  approvalRef?: string
  reason?: string
}

// ============================================================================ pack station extensions (Book I A §5.3)
export interface PackNode {
  hu: string
  /** Nested under this parent HU (tote inside crate, crate on skid). */
  parent?: string
  type: string
  /** Contents lines beyond the primary serial: accessories, desiccant, documents. */
  contents: { item: string; qty: number; note?: string }[]
}
export interface PackExt {
  deliveryId: string
  nodes: PackNode[]
  shortPack?: { reason: "Short Pick" | "Damage" | "Hold"; qty: number; by: string; at: string; note: string }
  creationRule: "Per picklist" | "Per shipment"
  photos: { hu: string; kind: string; at: string }[]
  scaleLog: { at: string; kg: number; state: "connected" | "error" | "stale" }[]
}
export const HU_TYPES = ["Heavy skid", "Accessory crate", "Tote (oil)", "Pallet", "Flatbed Load"] as const
export const SHORT_PACK_REASONS = ["Short Pick", "Damage", "Hold"] as const
export const PHOTO_KINDS = ["Corner 1", "Corner 2", "Corner 3", "Corner 4", "Nameplate"] as const

// ============================================================================ the whole state
export interface FxData {
  inbound: InboundCapture[]
  batches: ImportBatch[]
  billing: Record<string, BillingPlan>
  etoCost: Record<string, EtoCost>
  kits: KitDef[]
  kitLines: KitLine[]
  ship: Record<string, ShipExt>
  runs: DeliveryRunLog[]
  changes: ChangeOrder[]
  cancels: CancelRecord[]
  depegs: DePeg[]
  custProp: CustProp[]
  soClosure: Record<string, { reconciled: boolean; at?: string; by?: string }>
  quoteExt: Record<string, QuoteExt>
  tax: Record<string, TaxProfile>
  exclusions: Exclusion[]
  creditMemos: CreditMemoReq[]
  repairQuotes: RepairQuote[]
  packExt: Record<string, PackExt>
  /** Pack order creation rule (config): one pack order per picklist or per shipment [DOC:p.31 §5.2]. */
  packRule: "Per picklist" | "Per shipment"
  /** Price list change effective 2026-10-01 used by Reprice (reading SR-29). */
  priceUplift: number
  seq: { inbound: number; batch: number; sco: number; cnl: number; depeg: number; cp: number; kit: number; run: number; cmr: number; rq: number; shp: number; fee: number }
}

/** Surcharge = (index at pricing date - base index) x content per unit x pass-through % (default 100) [DOC:p.122 §6.4]. */
export const surchargeAmount = (s: SurchargeLine, passThroughPct = 100) => Math.round((s.current - s.basis) * s.contentPerUnit * (passThroughPct / 100) * 100) / 100
