// THROWAWAY PROTOTYPE - FL-09 - for correction at Gate 1.
// Entity model per prompt part 3 (TENTATIVE, every list asserted, none confirmed).
//
// Unknown, do not invent (prompt part 3):
// - Claim status: the PRD gives no list. Claims show type, value, carrier reference and resolution path; no status badge.
// - Approval request status: the PRD gives no list (OQ-21). Inbox shows pending items and an activity entry after a decision; no badge.
// - Invoice request status: owned by ACC (ASM-EXT-1). Activity text only ("created at PGI", "withdrawn").
// - The "16 stages" of Flow A: no stage table (OQ-14). No stage numbering anywhere.
// - N in "missing POD after expected date + N days alerts": not stated. Show aging in days only.
// - Split and merge rule IDs: not stated. Rule shown by name with placeholder ID RULE-TBD.
// - Order status while a no-quote order over $250,000 waits for the Sales Director: not stated. Kept at Submitted (OQ-31).
// - Transition triggers given only as status order: taken from the prompt's step table, flagged "Reading OQ-32".

export { TODAY, OPEN_PERIOD } from "@/data/shared/org"
import { materialById } from "@/data/shared/materials"
import type { CustExt, Ib, Lead, Reallocation, Rma, SupplyOption, AsBuiltLine } from "./ext-model"

// Roles: the app-wide role union lives in the shared domain (src/data/domain/roles.ts); FL-09 uses
// these nine of them. The "Acting as" switcher in the app shell lists every PRD role.
import type { Role } from "@/data/domain"
export type { Role }
export const ROLES: Role[] = [
  "Sales rep",
  "Sales admin",
  "Customer service",
  "Finance (credit)",
  "Controller",
  "Sales Director",
  "Shipping office",
  "Packer",
  "Shipping Manager",
]

export type Entity = "customer" | "quotation" | "order" | "soline" | "schedule" | "delivery" | "hu" | "pod" | "serial"
export type Family = "draft" | "pending" | "active" | "blocked" | "done" | "cancelled" | "exception"

// Lifecycle order per part 3.
export const LIFECYCLE: Record<Entity, string[]> = {
  customer: ["Prospect", "Active", "On Hold", "Blocked", "Inactive"],
  quotation: ["Draft", "Internal Review", "Issued", "Won", "Lost", "Expired", "Superseded"],
  order: ["Draft", "Submitted", "Credit Hold", "Confirmed", "In Fulfillment", "Partially Shipped", "Shipped", "Invoiced/Closed", "Cancelled", "Rejected"],
  soline: ["Open", "In Engineering", "In Production", "Ready to Ship", "Partially Shipped", "Shipped", "Invoiced", "Closed", "Cancelled"],
  schedule: ["Open", "Confirmed", "Allocated/Pegged", "Delivery Due", "Partially Delivered", "Delivered", "Closed", "Cancelled"],
  delivery: ["Planned", "Released", "Picking", "Packed", "Quality Cleared", "Loaded", "PGI", "Delivered/Closed"],
  hu: ["Open", "Closed", "Loaded", "Shipped"],
  pod: ["Expected", "Received", "Exception", "Resolved/Closed"],
  serial: ["Available", "Reserved", "Shipped"], // partial list, OQ-24: show no other value
}

// Family per entity and status pair (prompt 5.2, from status-encoding-input.md, TENTATIVE OQ-18).
const F = (m: Partial<Record<Family, string[]>>) => {
  const out: Record<string, Family> = {}
  for (const [fam, list] of Object.entries(m)) for (const s of list ?? []) out[s] = fam as Family
  return out
}
export const FAMILY: Record<Entity, Record<string, Family>> = {
  customer: F({ draft: ["Prospect"], active: ["Active"], blocked: ["On Hold", "Blocked"], done: ["Inactive"] }),
  quotation: F({ draft: ["Draft"], pending: ["Internal Review"], active: ["Issued"], done: ["Won", "Superseded", "Expired"], cancelled: ["Lost"] }),
  order: F({
    draft: ["Draft"],
    pending: ["Submitted"],
    active: ["Confirmed", "In Fulfillment", "Partially Shipped", "Shipped"],
    blocked: ["Credit Hold"],
    done: ["Invoiced/Closed"],
    cancelled: ["Cancelled", "Rejected"],
  }),
  soline: F({
    draft: ["Open"],
    active: ["In Engineering", "In Production", "Ready to Ship", "Partially Shipped", "Shipped"],
    done: ["Invoiced", "Closed"],
    cancelled: ["Cancelled"],
  }),
  schedule: F({
    draft: ["Open"],
    active: ["Confirmed", "Allocated/Pegged", "Delivery Due", "Partially Delivered", "Delivered"],
    done: ["Closed"],
    cancelled: ["Cancelled"],
  }),
  delivery: F({
    draft: ["Planned"],
    active: ["Released", "Picking", "Packed", "Quality Cleared", "Loaded", "PGI"],
    done: ["Delivered/Closed"],
  }),
  hu: F({ active: ["Open", "Closed", "Loaded", "Shipped"] }),
  pod: F({ draft: ["Expected"], active: ["Received"], done: ["Resolved/Closed"], exception: ["Exception"] }),
  serial: F({ active: ["Available", "Reserved", "Shipped"] }),
}

export interface Product {
  item: string
  description: string
  kva: string
  voltages: string
  unitPrice: number
  stdCost: number | null
  kind: "MTS" | "ETO" | "MTO"
  huKg: number
}

export const PRODUCTS: Product[] = [
  { item: "FIN-TBD-2500PM", description: "Three-phase pad-mount transformer", kva: "2,500 (2.5 MVA)", voltages: "12.47 kV – 480Y/277 V", unitPrice: 78400, stdCost: 61200, kind: "MTS", huKg: 7940 },
  { item: "FIN-TBD-1000PM", description: "Three-phase pad-mount transformer", kva: "1,000 (1 MVA)", voltages: "13.2 kV – 208Y/120 V", unitPrice: 41850, stdCost: 32640, kind: "MTS", huKg: 4310 },
  { item: "FIN-TBD-0167PL", description: "Single-phase pole-mount transformer", kva: "167", voltages: "7.2 kV – 120/240 V", unitPrice: 6980, stdCost: 5410, kind: "MTS", huKg: 610 },
  { item: "FIN-TBD-5000SS", description: "Secondary unit substation transformer, liquid-filled", kva: "5,000 (5 MVA)", voltages: "34.5 kV – 4.16 kV", unitPrice: 186300, stdCost: 149900, kind: "MTS", huKg: 14600 },
  { item: "FIN-TBD-20MVA", description: "Substation power transformer, ONAN/ONAF", kva: "20,000 (20 MVA)", voltages: "115 kV – 13.8 kV", unitPrice: 1284000, stdCost: null, kind: "ETO", huKg: 0 },
  { item: "FIN-TBD-7500MTO", description: "Pad-mount transformer, stainless tank", kva: "7,500 (7.5 MVA)", voltages: "24.94 kV – 600Y/347 V", unitPrice: 243700, stdCost: null, kind: "MTO", huKg: 0 },
]
/** FL-09 product row, or a row built from the shared material master for any other item
 *  (spares, components) so quotation and order pages render spares quotations (SVC-SPF-001). */
export const product = (item: string): Product => {
  const p = PRODUCTS.find((x) => x.item === item)
  if (p) return p
  const m = materialById(item)
  return { item, description: m?.description ?? item, kva: "n/a", voltages: "n/a", unitPrice: m?.listPrice ?? m?.stdCost ?? 0, stdCost: m?.stdCost ?? null, kind: "MTS", huKg: 0 }
}

export interface Activity {
  at: string // ISO date
  by: string
  text: string
}

export interface Customer {
  id: string
  name: string
  cls: string
  status: string
  currency: "USD" | "CAD"
  incoterms: string
  creditLimit: number
  exposure: number
  creditHold: boolean
  pastDue30: boolean
  risk: "A" | "B" | "C" | "D"
  priority: "A" | "B" | "C"
  billTo: string
  shipTo: string
  noPartial?: boolean
}

export interface QLine {
  no: number
  item: string
  qty: number
  price: number
  /** Spares quotation: the transformer serial carried on every line (SVC-SPF-001). */
  serial?: string
  note?: string
  engineeringReview?: boolean
}
export interface Quotation {
  id: string
  version: number
  status: string
  customerId: string
  validUntil: string
  lines: QLine[]
  lossReason?: string
  orderRef?: string
  predecessor?: string
  successor?: string
  activity: Activity[]
  /** Lead the quotation was converted from (funnel reporting, p.249 Build Note). */
  leadId?: string
  /** Requirement attributes carried from the lead unchanged. */
  config?: Record<string, string>
  priorBuildRef?: string
  /** Spares quotation created from the spares finder. */
  ibId?: string
  complianceRequired?: boolean
  complianceDone?: boolean
}

export interface Schedule {
  no: number
  reqQty: number
  reqDate: string
  confQty?: number
  confDate?: string
  constraint?: string
  snapshot?: string
  deliveredQty: number
  cancelledQty: number
  backorder: boolean
  peg?: string
  status: string
  deliveryId?: string
}
export interface SOLine {
  no: number
  item: string
  qty: number
  unitPrice: number
  priceSource: "Quotation" | "Price list"
  requestedShip: string
  promisedShip?: string
  warehouse: string
  status: string
  schedules: Schedule[]
}
export interface CreditCheck {
  at: string
  when: string
  exposure: number
  orderValue: number
  limit: number
  pastDue30: boolean
  passLimit: boolean
  passPastDue: boolean
}
export interface SalesOrder {
  id: string
  customerId: string
  customerPO: string
  quoteRef?: string
  type: "MTS" | "MTO" | "ETO" | "Service" | "Replacement"
  directEntry: boolean
  billTo: string
  shipTo: string
  requestedShip: string
  incoterms: string
  freightTerms: "PE-paid" | "Customer-paid"
  carrier?: string
  billingPlan: string
  currency: "USD" | "CAD"
  bookedRate: string
  status: string
  created: string
  closedOn?: string
  lines: SOLine[]
  creditChecks: CreditCheck[]
  activity: Activity[]
  ctpSeed?: boolean
  invoicePosted?: boolean
  /** ETO milestone billing plan (20/10/20/30/15/5%, p.53 §4.4). */
  milestones?: { pct: number; label: string; irId?: string; state: "Invoice request posted" | "Open" }[]
  /** Replacement order created by an RMA disposition. */
  rmaRef?: string
}

export type FlagState = "passed" | "not passed"
export interface Flags {
  supply: FlagState
  quality: FlagState
  credit: FlagState
  documents: FlagState
}
export interface SchedRef {
  soId: string
  line: number
  sched: number
  qty: number
}
export interface Delivery {
  id: string
  soId: string
  customerId: string
  shipTo: string
  incoterms: string
  status: string
  rule: string
  ruleId: string
  refs: SchedRef[]
  flags: Flags
  equipment?: string
  permits: string[]
  door?: string
  slot?: string
  carrier?: string
  pro?: string
  transitDays?: number
  freight: number | null // null = not recorded
  freightPaidBy: "PE-paid" | "Customer-paid"
  shipDate?: string
  pgiId?: string
  pgiPeriod?: string
  irId?: string
  irWithdrawn?: boolean
  forcePgiFail?: boolean
  warehouse: string
  activity: Activity[]
}
export interface HU {
  id: string
  sscc: string
  deliveryId: string
  item: string
  expectedKg: number
  actualKg?: number
  status: string
  labelPrinted: boolean
  serial?: string
  scaleAttempts: number
}
export interface Serial {
  id: string
  item: string
  status: string
  deliveryId?: string
  peg?: string // "{soId}/{line}/{sched}" while Reserved before a delivery exists
}
export interface Claim {
  id: string
  type: "shortage" | "damage" | "refusal"
  qty?: number
  value?: number
  carrierRef: string
  resolution?: string
}
export interface POD {
  id: string
  deliveryId: string
  status: string
  expectedDate: string
  receiver?: string
  date?: string
  condition?: string
  notes?: string
  docName?: string
  claim?: Claim
  milestoneFired: boolean
  activity: Activity[]
}
export interface Approval {
  id: string
  kind: "Credit Release" | "R-OM-02 no-quote order"
  soId: string
  amount: number
  currency: "USD" | "CAD"
  forRoles: Role[]
  reason: string
  raised: string
  decided?: { text: string; on: string }
}

export interface DB {
  customers: Customer[]
  quotations: Quotation[]
  orders: SalesOrder[]
  deliveries: Delivery[]
  hus: HU[]
  serials: Serial[]
  pods: POD[]
  approvals: Approval[]
  atp: Record<string, number>
  seq: { so: number; dlv: number; hu: number; pod: number; ir: number; clm: number; appr: number }
  // ---- sales and service screens beyond FL-09 (ext-model.ts)
  leads: Lead[]
  custExt: Record<string, CustExt>
  supply: SupplyOption[]
  reallocations: Reallocation[]
  rmas: Rma[]
  ib: Ib[]
  asBuilt: Record<string, AsBuiltLine[]>
  spareStock: Record<string, { qty: number; leadWeeks?: number }>
  seq2: { lead: number; opp: number; cus: number; qt: number; rma: number; ib: number; rea: number; ncr: number; rwo: number; cmr: number; rcp: number; ext: number }
}

// ---------- formatting (en-US) ----------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
export const listDate = (iso?: string) => {
  if (!iso) return "Not recorded"
  const [y, m, d] = iso.split("-").map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
export const money = (n: number, cur: "USD" | "CAD" = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n)
export const kg = (n: number) => `${new Intl.NumberFormat("en-US").format(n)} kg`
export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000)

export const orderValue = (o: SalesOrder) => o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
export const quoteValue = (q: Quotation) => q.lines.reduce((s, l) => s + l.qty * l.price, 0)
export const openQty = (s: Schedule) => (s.confQty ?? 0) - s.deliveredQty - s.cancelledQty
export const fmtSO = (seq: number, year = 2026) => `SO-${year}-${String(seq).padStart(5, "0")}`
