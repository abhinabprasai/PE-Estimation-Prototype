// Materials rules and computations, each tied to its PRD source [DOC:p.n] (asserted).
// Where the PRD is silent the value is a reading: it is listed in READINGS (shown on screen as a
// "Reading" chip and logged in this module's README) and never presented as a PRD rule.

import type { Material, MaterialStatus, MaterialType, Role } from "@/data/domain"
import { TODAY } from "@/data/shared"
import type { AcctRow, CountDocRecord, CountLine, EoPolicy, MaterialViews, McrTask, SafetyStockRow } from "../data/types"

// ============================================================================ readings
/** PRD-silent choices, shown as chips and logged in README "Readings". */
export const READINGS = {
  "RD-MM-01": "Warehouse Manager (MCR Warehouse task owner, p.150) is not a role in the role list; the task goes to the Warehouse supervisor.",
  "RD-MM-02": "SPARE and NSTK are not columns of the MCR task matrix (p.150); SPARE uses the TRADE column and NSTK the SERV column.",
  "RD-MM-03": "TRADE Quality task is 'Config' in the matrix (p.150); the prototype includes it only when QI at receipt is ON.",
  "RD-MM-04": "p.150 says a placeholder creates the material in Draft; p.149 and p.156 allow only Data Completion on EBOM placeholder lines. The prototype creates placeholders in Data Completion.",
  "RD-MM-05": "Engineering placeholder payload carries no material type; the prototype reserves a RAW number and the steward can withdraw and re-request.",
  "RD-MM-06": "Identifier formats: Book II gives MCR-{YYYY}-{SEQ:4} and IR-{SEQ:6}, but the spine uses MCR-TBD-0301 and IR- is taken by invoice requests, so the prototype uses MCR-TBD-nnnn and IRC-nnnnnn.",
  "RD-MM-07": "A supersession can be sent for approval only when its successor is Active. The PRD does not state this gate.",
  "RD-MM-08": "Lifecycle transitions Active to Restricted or Blocked, and back, are pressed by the Materials Manager; p.149 names the role only for reinstatement.",
  "RD-MM-09": "Info record status Active / Expired / Blocked (p.158) is not in the S-1..S-43 catalog; it is shown with a family badge until the catalog row exists (request R-1). A Disqualified vendor counts as blocked.",
  "RD-MM-10": "E&O reserve rates per type and bucket are design values; the PRD names the buckets (6/12/24+ months) and the policy table but no percentages.",
  "RD-MM-11": "Step-up MFA on matrix release is shown as an attestation checkbox; the prototype has no authentication.",
  "RD-MM-12": "Inventory Admin (safety stock editor, p.43) is not a role in the role list; the Warehouse supervisor stands in for it beside the Planner.",
  "RD-MM-13": "Item sales tab (Book I Part A §4): a change above ±5% raises the shared kind 'Price change on sales tab' and a row below the margin floor raises 'Below price floor'. The PRD asks the Controller to approve a below-floor customer price; the shared engine routes that kind to the Pricing Manager then the Sales Director (request R-10). Price-list and customer-price row statuses (Draft / Pending Approval / Active / Expired) have no S-row and show as family badges. The margin floor is the product line floor in table F (PC-100 22%, PC-300 18%); other product lines show no floor. Commission groups and the Avalara tax-code list are design values.",
  "RD-MM-14": "Count documents: the PRD names the bands, the Finance Manager and a third Controller approval (p.37 §7.5). 'Finance Manager' is not in the role list and the shared engine has no Finance step, no class-A trigger and no third step (request R-8). The screen computes the PRD ladder and shows it; the engine request is raised with the Controller standing in for the Finance Manager, a class-A line is passed to the engine as a line above the supervisor band so the second step is added, and in the Controller band the Controller's step covers both the Finance and the third approval. ABC class is read from the Planning view; a material with no ABC class uses the class-A tolerance (the tightest).",
  "RD-MM-15": "Counter and Count Supervisor (p.36 §7.3) are not roles in the role list; counting is done as Warehouse operator, supervision as Warehouse supervisor.",
  "RD-MM-16": "Data-completeness checks use a subset of each view's mandatory fields; the full field dictionary (Section 18) is not extracted.",
  "RD-MM-17": "GRN events carry no material or quantity; receipts against the spine's POs resolve from the PO, others are listed as unresolved (request R-6).",
  "RD-MM-18": "Run-out progress is predecessor stock against stock at approval; the PRD names the progress bar but not its basis.",
  "RD-MM-19": "Third count (R-CNT-03) has no status of its own in S-40; the document stays in Recount, the third count is entered by the Warehouse supervisor and the finance witness is named on entry.",
  "RD-MM-20": "Inventory freeze (E-CNT-01) is keyed by warehouse and bin of the document's lines; 'Soft Freeze' ON lets the movement post and flags the line Moved During Count.",
  "RD-MM-21": "E&O aging uses the last consumption (goods issue to production, sales or scrap) per material; receipts, transfers and count adjustments do not reset it. Materials with no recorded consumption age from their first receipt in stock.",
  "RD-MM-22": "Safety stock: 'Suggested SS' and 'Service Level' are reserved read-only columns for the Phase 2 statistical engine and stay empty. Seasonal multipliers are edited per row with a reason code; the 25% approval test is applied to the base value and to every month's effective value, so a multiplier change that moves any month by more than 25% also waits for the Planning Manager. 'Over-buffered' uses the 12-month breach count held on the row.",
  "RD-MM-23": "Rejected and Deleted are transition names with no status row (K-16). Reject ends a Data Completion material (Materials Manager); Delete removes a Draft material with zero references. Both drop the material from lists and keep a row in the change history.",
  "RD-MM-24": "Material list 'My Materials' filter uses the acting user's ownership: the steward, buyer or planner field on the General view equals the acting user. Roles that own none of the three see all materials.",
  "RD-MM-25": "Counter visibility (§7.3): a Warehouse operator sees only documents assigned to them in Counting (first counter) or Recount (assigned recounter). Assigned to Counting is pressed by the Warehouse supervisor or the assigned counter; the supervisor assigns the recounter.",
  "RD-MM-26": "Count plan: 'Generate Count Sheets' creates one document per warehouse zone (the bin's first letter), from the stock rows in that warehouse at the moment of generation; the plan's other settings (per aisle, per item group) are not offered.",
  "RD-MM-27": "MCR SLA escalation goes to the manager of the task's role: steward to Materials Manager, Planner to Planning Manager, Buyer to Purchasing Manager, Manufacturing engineer to Engineering Manager, Quality engineer to Quality Manager, Cost accountant to Controller, Sales admin to Sales Director, Warehouse supervisor to Shipping Manager.",
  "RD-MM-28": "Sellable ON where the type default is OFF (RAW, SEMI, PACK, CONS, NSTK) runs as a Class 2 MCH. The PRD names Sales Admin and Materials Manager approval; the shared kind 'Material change' routes to the Materials Manager only (request R-11), so the Sales admin's concurrence is recorded as the requester of the MCH.",
  "RD-MM-29": "MM-VAL-001 simulation: dimensions follow derivation rule 3 for inventory movements (warehouse cost center, item product line) and rule 4 for PGI / COGS (product line only). The cost center of a warehouse comes from the shared warehouse master.",
  "RD-MM-30": "Supersession approval: the worklist is generated from the predecessor's where-used references held on the material (open POs, BOM lines, customer part cross-references); documents held only in other modules are not swept.",
} as const
export type ReadingId = keyof typeof READINGS

// ============================================================================ dates
export const addBusinessDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z")
  let left = n
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) left--
  }
  return d.toISOString().slice(0, 10)
}
export const businessDaysBetween = (a: string, b: string) => {
  let n = 0
  const d = new Date(a + "T12:00:00Z")
  const end = new Date(b + "T12:00:00Z")
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) n++
  }
  return n
}
export const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = a.split("-").map(Number)
  const [yb, mb] = b.split("-").map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

// ============================================================================ type model §2
/** Valuation classes [DOC:p.153 §5.1] (asserted). SERV and NSTK are never valuated. */
export const VALUATION_CLASS: Record<MaterialType, string | undefined> = {
  RAW: "VC-3000", SEMI: "VC-7900", FIN: "VC-7920", TRADE: "VC-3100", PACK: "VC-3060", SPARE: "VC-3040", CONS: "VC-3080", SERV: undefined, NSTK: undefined,
}
export const VALUATION_CLASS_LABEL: Record<string, string> = {
  "VC-3000": "VC-3000 Raw Materials",
  "VC-3010": "VC-3010 Raw Materials - Fluids",
  "VC-7900": "VC-7900 Semi-Finished",
  "VC-7920": "VC-7920 Finished Goods",
  "VC-3100": "VC-3100 Trading Goods",
  "VC-3060": "VC-3060 Packaging",
  "VC-3040": "VC-3040 Spares",
  "VC-3080": "VC-3080 Consumables",
}
export const isValuated = (t: MaterialType) => t !== "SERV" && t !== "NSTK"
/** Type behavior matrix rows used by the screens [DOC:p.138 §2.2] (asserted). */
export const TYPE_BEHAVIOR: Record<MaterialType, { inventory: string; sellableDefault: string; batchDefault: string; serialDefault: string; qiDefault: string; costing: string; producible: string }> = {
  RAW: { inventory: "Yes", sellableDefault: "Off", batchDefault: "On", serialDefault: "Off", qiDefault: "On", costing: "Std/MAV", producible: "No" },
  SEMI: { inventory: "Yes", sellableDefault: "Off", batchDefault: "Config", serialDefault: "Config", qiDefault: "On (prod.)", costing: "Standard", producible: "Yes" },
  FIN: { inventory: "Yes", sellableDefault: "On", batchDefault: "Off", serialDefault: "On", qiDefault: "On (prod.)", costing: "Standard", producible: "Yes" },
  TRADE: { inventory: "Yes", sellableDefault: "On", batchDefault: "Config", serialDefault: "Config", qiDefault: "Config", costing: "MAV", producible: "No" },
  PACK: { inventory: "Yes", sellableDefault: "Off", batchDefault: "Off", serialDefault: "Off", qiDefault: "Off", costing: "MAV", producible: "No" },
  SPARE: { inventory: "Yes", sellableDefault: "Config", batchDefault: "Config", serialDefault: "Config", qiDefault: "Config", costing: "MAV", producible: "Config" },
  CONS: { inventory: "Config", sellableDefault: "Off", batchDefault: "Off", serialDefault: "Off", qiDefault: "Off", costing: "Expense", producible: "No" },
  SERV: { inventory: "No", sellableDefault: "On", batchDefault: "n/a", serialDefault: "n/a", qiDefault: "n/a", costing: "Rate only", producible: "No" },
  NSTK: { inventory: "No", sellableDefault: "Off", batchDefault: "n/a", serialDefault: "n/a", qiDefault: "n/a", costing: "Expense", producible: "No" },
}

// ============================================================================ lifecycle §4.1
/** Allowed transitions [DOC:p.149 §4.1] (asserted, S-42). Draft to Deleted and Data Completion to
 *  Rejected are transition names with no status row (K-16, RD-MM-23): separate actions, not targets here. */
export const LIFECYCLE_NEXT: Record<MaterialStatus, MaterialStatus[]> = {
  Draft: ["Data Completion"],
  "Data Completion": ["Active", "Draft"],
  Active: ["Restricted", "Blocked", "Obsolete"],
  Restricted: ["Active", "Blocked", "Obsolete"],
  Blocked: ["Active", "Restricted", "Obsolete"],
  Obsolete: [],
}

/** Function-specific blocks and the role that sets each [DOC:p.151 §4.5] (asserted). */
export const BLOCK_SETTER = {
  "Purchasing Block": { role: "Purchasing Manager", blocks: "New PRs, RFQs and POs (open POs stay receivable)" },
  "Sales Block": { role: "Sales Director", blocks: "New quotes and SO lines (open SOs shippable unless Shipping Block too)" },
  "Production Block": { role: "Engineering Manager", blocks: "New WOs; existing WOs continue unless an Immediate ECO says otherwise" },
  "Shipping Block": { role: "Quality Manager", blocks: "PGI for this material" },
  "Posting Block": { role: "Controller", blocks: "All stock movements (count corrections exempt)" },
} as const satisfies Record<string, { role: Role; blocks: string }>

// ============================================================================ MCR task matrix §4.2
type Col = "RAW" | "SEMIFIN" | "TRADE" | "PACKCONS" | "SERV"
const colOf = (t: MaterialType): Col =>
  t === "RAW" ? "RAW" : t === "SEMI" || t === "FIN" ? "SEMIFIN" : t === "TRADE" || t === "SPARE" ? "TRADE" : t === "PACK" || t === "CONS" ? "PACKCONS" : "SERV"

/** The default task matrix [DOC:p.150 §4.2] (asserted); SPARE / NSTK mapping is RD-MM-02. */
export const MCR_TASK_MATRIX: { view: string; role: Role; applies: (t: MaterialType, o: { buyComplete?: boolean; qi?: boolean; sellable?: boolean }) => boolean }[] = [
  { view: "General + classification + UoM", role: "Material steward", applies: () => true },
  { view: "Planning (MRP)", role: "Planner", applies: (t) => colOf(t) !== "SERV" },
  { view: "Purchasing + first Info Record", role: "Buyer", applies: (t, o) => (colOf(t) === "SEMIFIN" ? !!o.buyComplete : true) },
  { view: "Production", role: "Manufacturing engineer", applies: (t) => colOf(t) === "SEMIFIN" },
  { view: "Warehouse", role: "Warehouse supervisor", applies: (t) => colOf(t) !== "SERV" },
  { view: "Quality (+ inspection plan check)", role: "Quality engineer", applies: (t, o) => colOf(t) === "RAW" || colOf(t) === "SEMIFIN" || (colOf(t) === "TRADE" && !!o.qi) },
  { view: "Accounting & Costing", role: "Cost accountant", applies: () => true },
  { view: "Sales (when sellable)", role: "Sales admin", applies: (t, o) => (t === "FIN" || colOf(t) === "TRADE" || colOf(t) === "SERV" ? o.sellable !== false : false) },
]
export const ACCOUNTING_TASK = "Accounting & Costing"
/** Accounting & Costing requires Planning and Purchasing done first (§4.2). */
export function taskBlockedBy(task: McrTask, tasks: McrTask[]): string[] {
  if (task.view !== ACCOUNTING_TASK) return []
  return tasks.filter((t) => (t.view.startsWith("Planning") || t.view.startsWith("Purchasing")) && !t.done).map((t) => t.view)
}
export const SLA_BUSINESS_DAYS = 2
/** Breach escalates to the role's manager (§4.2 [DOC:p.150]); the mapping is RD-MM-27. */
export const ESCALATE_TO: Partial<Record<Role, Role>> = {
  "Material steward": "Materials Manager", Planner: "Planning Manager", Buyer: "Purchasing Manager", "Manufacturing engineer": "Engineering Manager",
  "Quality engineer": "Quality Manager", "Cost accountant": "Controller", "Sales admin": "Sales Director", "Warehouse supervisor": "Shipping Manager",
}
export type SlaState = "On time" | "Due today" | "Breached" | "Done"
export function slaState(t: McrTask, today = TODAY): SlaState {
  if (t.done) return "Done"
  if (t.slaDue < today) return "Breached"
  if (t.slaDue === today) return "Due today"
  return "On time"
}

// ============================================================================ duplicate check §4.4
const grams = (s: string) => {
  const n = ` ${s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim()} `
  const out = new Set<string>()
  for (let i = 0; i < n.length - 2; i++) out.add(n.slice(i, i + 3))
  return out
}
/** Trigram similarity (Jaccard). The PRD threshold is >= 0.9 within the same group L1 [DOC:p.151 §4.4]. */
export function similarity(a: string, b: string) {
  const ga = grams(a)
  const gb = grams(b)
  let inter = 0
  for (const g of ga) if (gb.has(g)) inter++
  return inter / (ga.size + gb.size - inter || 1)
}
export const DUPLICATE_THRESHOLD = 0.9

// ============================================================================ field classes §4.4
export interface FieldDef {
  key: string
  label: string
  cls: 1 | 2 | 3
  view: string
  options?: string[]
  numeric?: boolean
  /** owner role (field-group ownership, §3.2) */
  owner: Role
}
export const FIELD_DEFS: FieldDef[] = [
  { key: "stewardId", label: "Steward", cls: 1, view: "General", owner: "Material steward" },
  // Steward / Buyer / Planner user lookups sit on the General view (§3.4 [DOC:p.143]), owned by the steward (§3.2)
  { key: "buyerId", label: "Buyer", cls: 1, view: "General", owner: "Material steward" },
  { key: "plannerId", label: "Planner", cls: 1, view: "General", owner: "Material steward" },
  { key: "longText", label: "Long description", cls: 1, view: "General", owner: "Material steward" },
  { key: "purchText", label: "Purchasing text", cls: 1, view: "Purchasing", owner: "Buyer" },
  { key: "plannedDeliveryDays", label: "Planned delivery time (days)", cls: 1, view: "Planning", numeric: true, owner: "Planner" },
  { key: "grProcDays", label: "GR processing time (days)", cls: 1, view: "Planning", numeric: true, owner: "Planner" },
  { key: "lotSizing", label: "Lot sizing", cls: 1, view: "Planning", options: ["Lot-for-Lot", "Fixed Qty", "Min Qty / Order Multiple", "Period"], owner: "Planner" },
  { key: "overTolPct", label: "Over-delivery tolerance %", cls: 1, view: "Purchasing", numeric: true, owner: "Buyer" },
  { key: "mrpType", label: "MRP type", cls: 2, view: "Planning", options: ["MRP", "Reorder Point", "None"], owner: "Planner" },
  { key: "procurement", label: "Procurement type", cls: 2, view: "Planning", options: ["Buy", "Make", "Both"], owner: "Planner" },
  { key: "method", label: "Valuation method", cls: 2, view: "Accounting and Costing", options: ["Standard", "Moving Average"], owner: "Cost accountant" },
  { key: "valuationClass", label: "Valuation class", cls: 2, view: "Accounting and Costing", options: Object.keys(VALUATION_CLASS_LABEL), owner: "Cost accountant" },
  { key: "profitCenterId", label: "Profit center", cls: 2, view: "Accounting and Costing", options: ["PC-100", "PC-200", "PC-300", "PC-400", "PC-900"], owner: "Cost accountant" },
  { key: "sellable", label: "Sellable", cls: 2, view: "Sales", options: ["Yes", "No"], owner: "Sales admin" },
  { key: "type", label: "Material type", cls: 3, view: "General", owner: "Material steward" },
  { key: "materialNo", label: "Material number", cls: 3, view: "General", owner: "Material steward" },
  { key: "baseUom", label: "Base UoM (after first posting)", cls: 3, view: "Units", owner: "Material steward" },
]
export const fieldDef = (k: string) => FIELD_DEFS.find((f) => f.key === k)

// ============================================================================ completeness §16.4
type Check = { view: string; label: string; applies: (m: Material) => boolean; ok: (m: Material, v: MaterialViews) => boolean }
const buy = (v: MaterialViews) => v.procurement !== "Make"
/** Mandatory-for-use checks (RD-MM-16: a subset of the field dictionary). */
export const COMPLETENESS_CHECKS: Check[] = [
  { view: "General", label: "Material group L1/L2", applies: () => true, ok: (_m, v) => v.groupPath.length >= 2 },
  { view: "General", label: "Steward", applies: () => true, ok: (_m, v) => !!v.stewardId },
  { view: "General", label: "Buyer (buy items)", applies: (m) => m.type !== "SEMI" && m.type !== "FIN", ok: (_m, v) => !buy(v) || !!v.buyerId },
  { view: "General", label: "Planner", applies: (m) => m.type !== "SERV" && m.type !== "NSTK", ok: (_m, v) => !!v.plannerId },
  { view: "Units", label: "Net / gross weight", applies: (m) => ["FIN", "SEMI", "RAW"].includes(m.type), ok: (_m, v) => v.netWeight != null && v.grossWeight != null },
  { view: "Units", label: "Dimensions L x W x H", applies: (m) => m.type === "FIN", ok: (_m, v) => !!v.dims },
  { view: "Planning", label: "MRP type", applies: () => true, ok: (_m, v) => !!v.mrpType },
  { view: "Planning", label: "Reorder point / max stock", applies: () => true, ok: (_m, v) => v.mrpType !== "Reorder Point" || (v.reorderPoint != null && v.maxStock != null) },
  { view: "Planning", label: "Planned delivery time", applies: (m) => isValuated(m.type), ok: (_m, v) => !buy(v) || v.plannedDeliveryDays != null },
  { view: "Purchasing", label: "Source determination policy", applies: (m) => m.type !== "SEMI" && m.type !== "FIN", ok: (_m, v) => !buy(v) || !!v.sourcePolicy },
  { view: "Purchasing", label: "Tax category (purchase)", applies: (m) => m.type !== "SEMI" && m.type !== "FIN", ok: (_m, v) => !buy(v) || !!v.taxCategory },
  { view: "Production", label: "Production scheduler", applies: (m) => m.type === "SEMI" || m.type === "FIN", ok: (_m, v) => !!v.schedulerId },
  { view: "Production", label: "Default issue warehouse", applies: (m) => m.type === "SEMI" || m.type === "FIN", ok: (_m, v) => !!v.issueWarehouse },
  { view: "Warehouse", label: "Putaway / picking strategy", applies: (m) => isValuated(m.type), ok: (_m, v) => !!v.putaway && !!v.picking },
  { view: "Quality", label: "QI at receipt decided", applies: (m) => ["RAW", "SEMI", "FIN"].includes(m.type), ok: (_m, v) => v.qiReceipt != null },
  { view: "Accounting and Costing", label: "Valuation class + method", applies: (m) => isValuated(m.type), ok: (_m, v) => !!v.valuationClass && !!v.method },
  { view: "Accounting and Costing", label: "Profit center", applies: (m) => isValuated(m.type), ok: (m) => !!m.profitCenterId },
  { view: "Sales", label: "Sales UoM and tax category (sellable)", applies: () => true, ok: (_m, v) => !v.sellable || (!!v.salesUom && !!v.salesTaxCategory) },
]
export function completeness(m: Material, v: MaterialViews | undefined) {
  if (!v) return { pct: 0, missing: COMPLETENESS_CHECKS.filter((c) => c.applies(m)).map((c) => `${c.view}: ${c.label}`) }
  const cs = COMPLETENESS_CHECKS.filter((c) => c.applies(m))
  const missing = cs.filter((c) => !c.ok(m, v)).map((c) => `${c.view}: ${c.label}`)
  return { pct: Math.round(((cs.length - missing.length) / (cs.length || 1)) * 100), missing }
}

// ============================================================================ account determination §5.2
/** Event keys, closed list [DOC:pp.153-154 §5.2] (asserted). */
export const EVENT_KEYS: { key: string; firesOn: string }[] = [
  { key: "STOCK", firesOn: "Any valuated stock increase / decrease" },
  { key: "GRIR", firesOn: "Goods receipt / invoice receipt clearing" },
  { key: "PPV", firesOn: "Purchase price variance at GRN, IPV at match" },
  { key: "USAGE", firesOn: "Production issue offset (component to WIP)" },
  { key: "ABSORB", firesOn: "Labor / overhead absorption credit" },
  { key: "VARSET", firesOn: "Settlement variance split" },
  { key: "SUBCON", firesOn: "Subcontract provision and receipt legs" },
  { key: "SCRAP", firesOn: "Scrap and waste disposals" },
  { key: "ADJ", firesOn: "Count and stock adjustments" },
  { key: "REVAL", firesOn: "Standard cost release revaluation" },
  { key: "COGS", firesOn: "PGI and COGS recognition" },
  { key: "RETQ", firesOn: "RMA quarantine stock" },
  { key: "CONSIG", firesOn: "Consignment withdrawal liability" },
  { key: "CONSPV", firesOn: "Consignment settlement price variance" },
  { key: "EORES", firesOn: "Excess and obsolete reserve" },
  { key: "INTRANS", firesOn: "Stock in transit between own locations" },
]
/** Resolution order exact (key+class+qualifier) -> (key+class) -> (key) [DOC:p.154] (asserted). */
export function resolveRow(rows: AcctRow[], key: string, vc?: string, qualifier?: string): AcctRow | undefined {
  const live = rows
  return (
    (qualifier ? live.find((r) => r.eventKey === key && r.valuationClass === vc && r.qualifier === qualifier) : undefined) ??
    live.find((r) => r.eventKey === key && r.valuationClass === vc && !r.qualifier) ??
    live.find((r) => r.eventKey === key && !r.valuationClass && !r.qualifier)
  )
}
/** Transactions offered in the simulation panel, as debit / credit event-key legs (design mapping
 *  from the postings each key "fires on", §5.2). */
export const SIM_TRANSACTIONS: { id: string; label: string; legs: { side: "Dr" | "Cr"; key: string }[] }[] = [
  { id: "grn", label: "Goods receipt (GRN)", legs: [{ side: "Dr", key: "STOCK" }, { side: "Cr", key: "GRIR" }] },
  { id: "issue", label: "Material issue to WO", legs: [{ side: "Dr", key: "USAGE" }, { side: "Cr", key: "STOCK" }] },
  { id: "pgi", label: "PGI, sales shipment", legs: [{ side: "Dr", key: "COGS" }, { side: "Cr", key: "STOCK" }] },
  { id: "adj+", label: "Count adjustment, surplus", legs: [{ side: "Dr", key: "STOCK" }, { side: "Cr", key: "ADJ" }] },
  { id: "adj-", label: "Count adjustment, shortage", legs: [{ side: "Dr", key: "ADJ" }, { side: "Cr", key: "STOCK" }] },
  { id: "scrap", label: "Scrap disposal", legs: [{ side: "Dr", key: "SCRAP" }, { side: "Cr", key: "STOCK" }] },
  { id: "settle", label: "WO settlement variance", legs: [{ side: "Dr", key: "VARSET" }, { side: "Cr", key: "USAGE" }] },
  { id: "eo", label: "E&O reserve build", legs: [{ side: "Dr", key: "EORES" }, { side: "Cr", key: "EORES" }] },
  { id: "consig", label: "Consignment withdrawal", legs: [{ side: "Dr", key: "STOCK" }, { side: "Cr", key: "CONSIG" }] },
  { id: "transit", label: "Transfer into transit", legs: [{ side: "Dr", key: "INTRANS" }, { side: "Cr", key: "STOCK" }] },
]
export function simulate(rows: AcctRow[], txId: string, vc: string | undefined, amount: number, qualifier?: string) {
  const tx = SIM_TRANSACTIONS.find((t) => t.id === txId)!
  return tx.legs.map((l) => {
    const row = resolveRow(rows, l.key, vc, qualifier)
    return { side: l.side, key: l.key, rowId: row?.id, account: row ? (l.side === "Dr" ? row.drKey : row.crKey) : undefined, amount }
  })
}
/** Completeness check: every (event key x valuation class in use) resolves; else E-MM-21. Keys that
 *  are class-independent (one key-only row) resolve for every class by the fallback. */
export function matrixGaps(rows: AcctRow[], classesInUse: Map<string, string[]>) {
  const gaps: { key: string; vc: string; materials: string[] }[] = []
  for (const { key } of EVENT_KEYS)
    for (const [vc, mats] of classesInUse) if (!resolveRow(rows, key, vc)) gaps.push({ key, vc, materials: mats })
  return gaps
}

// ============================================================================ count documents §7.4-7.5
export const COUNT_RULES = {
  recountPct: 2, // ±2% per line [DOC:p.37 §7.5]
  recountAmount: 500, // ±$500 per line
  supervisorLine: 2000,
  supervisorDoc: 10000,
  controllerDoc: 25000,
  abcTolerancePct: { A: 0.5, B: 2, C: 5 } as Record<"A" | "B" | "C", number>,
}
export const finalQty = (l: CountLine) => l.thirdCount ?? l.recount ?? l.count
export function lineVariance(l: CountLine) {
  const f = finalQty(l)
  if (f == null) return { qty: 0, value: 0, counted: false }
  const qty = f - (l.expected + l.interim)
  return { qty, value: qty * l.rate, counted: true }
}
export function needsRecount(l: CountLine) {
  const { qty, value, counted } = lineVariance(l)
  if (!counted) return false
  const base = l.expected + l.interim
  const pct = base === 0 ? (qty === 0 ? 0 : 100) : (Math.abs(qty) / base) * 100
  return pct > COUNT_RULES.recountPct || Math.abs(value) > COUNT_RULES.recountAmount
}
export function docVariance(d: CountDocRecord) {
  const lines = d.lines.map((l) => ({ l, ...lineVariance(l) }))
  const net = lines.reduce((s, x) => s + x.value, 0)
  const abs = lines.reduce((s, x) => s + Math.abs(x.value), 0)
  const maxLine = lines.reduce((s, x) => Math.max(s, Math.abs(x.value)), 0)
  return { lines, net, abs, maxLine }
}

/** R-CNT-03: the recount differs from the first count by more than the recount threshold again. */
export function needsThirdCount(l: CountLine) {
  if (l.recount == null || l.count == null) return false
  const diff = l.recount - l.count
  const pct = l.count === 0 ? (diff === 0 ? 0 : 100) : (Math.abs(diff) / l.count) * 100
  return pct > COUNT_RULES.recountPct || Math.abs(diff * l.rate) > COUNT_RULES.recountAmount
}
/** Approval ladder per §7.5 [DOC:p.37] (asserted): supervisor band on absolute line and document
 *  value; Finance band above it or on any class-A item variance; Controller band on the NET document
 *  variance above $25,000. Lines auto-approved within ABC tolerance are outside the ladder. */
export type CountBand = "Supervisor" | "Finance" | "Controller"
export function countLadder(d: CountDocRecord, abcOf: (itemId: string) => "A" | "B" | "C" | undefined) {
  const v = docVariance(d)
  const open = v.lines.filter((x) => x.value !== 0 && !x.l.flags.includes("Auto-Approved"))
  const abs = open.reduce((a, x) => a + Math.abs(x.value), 0)
  const maxLine = open.reduce((a, x) => Math.max(a, Math.abs(x.value)), 0)
  const classA = open.filter((x) => abcOf(x.l.itemId) === "A").map((x) => x.l.no)
  const why: string[] = []
  if (maxLine > COUNT_RULES.supervisorLine) why.push(`a line above $${COUNT_RULES.supervisorLine.toLocaleString()}`)
  if (abs > COUNT_RULES.supervisorDoc) why.push(`document above $${COUNT_RULES.supervisorDoc.toLocaleString()}`)
  if (classA.length) why.push(`class-A item variance on line ${classA.join(", ")}`)
  const controller = Math.abs(v.net) > COUNT_RULES.controllerDoc
  if (controller) why.push(`document net variance above $${COUNT_RULES.controllerDoc.toLocaleString()}`)
  const band: CountBand = controller ? "Controller" : why.length ? "Finance" : "Supervisor"
  const steps = band === "Supervisor" ? ["Count Supervisor"] : band === "Finance" ? ["Count Supervisor", "Finance Manager"] : ["Count Supervisor", "Finance Manager", "Controller"]
  return { band, steps, why, abs, maxLine, net: v.net, classA }
}
/** Count Plan write-back (p.38): the plan reaches Posted only when all its documents are Posted or Void. */
export function planState(docs: CountDocRecord[], planId: string) {
  const mine = docs.filter((x) => x.planId === planId)
  const done = mine.filter((x) => x.status === "Posted" || x.status === "Void").length
  return { total: mine.length, done, posted: mine.length > 0 && done === mine.length }
}
/** Statuses that freeze the document's locations (E-CNT-01): Generated through Variance Review. */
export const FREEZE_STATUSES = ["Generated", "Assigned", "Counting", "Submitted", "Recount", "Variance Review"] as const
/** The open count document that freezes a warehouse bin, if any (Dev Note p.36, RD-MM-20). */
export function freezingDoc(docs: CountDocRecord[], warehouseId: string, bin: string) {
  return docs.find((c) => (FREEZE_STATUSES as readonly string[]).includes(c.status) && c.warehouseId === warehouseId && c.lines.some((l) => l.bin === bin))
}
export const freezeMessage = (bin: string, docId: string) => `E-CNT-01: Location ${bin} is frozen for counting under ${docId}.`
export function serialRecon(l: CountLine) {
  if (!l.expectedSerials) return undefined
  const scanned = l.scannedSerials ?? []
  return { missing: l.expectedSerials.filter((x) => !scanned.includes(x)), unexpected: scanned.filter((x) => !l.expectedSerials!.includes(x)) }
}

// ============================================================================ safety stock §10.2
/** Base SS: the row's value, or the item default when the row is blank (§10.3). */
export const ssBase = (r: Pick<SafetyStockRow, "ss" | "defaultSs">) => r.ss ?? r.defaultSs
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const
export const monthIndex = (iso = TODAY) => Number(iso.slice(5, 7)) - 1
/** Effective SS in month m = base SS x multiplier[m]; multipliers default to 1.0 (§10.3 [DOC:p.43]). */
export const ssEffective = (r: Pick<SafetyStockRow, "ss" | "defaultSs" | "multipliers">, month = monthIndex()) => Math.round(ssBase(r) * (r.multipliers?.[month] ?? 1) * 100) / 100
/** Largest month-by-month change (percent) between two (base, multipliers) settings (RD-MM-22). */
export function ssDeltaPct(oldBase: number, oldMult: number[] | undefined, newBase: number, newMult: number[] | undefined) {
  const pct = (a: number, b: number) => (a === 0 ? (b === 0 ? 0 : 100) : (Math.abs(b - a) / a) * 100)
  let max = pct(oldBase, newBase)
  for (let m = 0; m < 12; m++) max = Math.max(max, pct(oldBase * (oldMult?.[m] ?? 1), newBase * (newMult?.[m] ?? 1)))
  return max
}
export const available = (r: SafetyStockRow) => r.onHand - r.reserved - r.qiHold - r.blocked
export const reorderPoint = (r: SafetyStockRow) => Math.round(r.adu * r.ltDays + ssEffective(r))
export function ssAlerts(r: SafetyStockRow) {
  const out: { code: string; text: string; severity: "Critical" | "Warning" | "Info" }[] = []
  const avail = available(r)
  if (avail < ssEffective(r)) out.push({ code: "Below Safety Stock", text: `Available ${avail} < safety stock ${ssEffective(r)}`, severity: "Critical" })
  else if (avail + r.onOrder <= reorderPoint(r)) out.push({ code: "Below Reorder Point", text: `Available + on order ${avail + r.onOrder} <= ROP ${reorderPoint(r)}`, severity: "Warning" })
  if (ssEffective(r) > r.maxStock) out.push({ code: "SS-EX-01", text: "Safety stock above max stock level", severity: "Info" })
  if (r.adu === 0 && ssEffective(r) > 0) out.push({ code: "SS-EX-01", text: "Safety stock with zero ADU (dead buffer)", severity: "Info" })
  if (r.breaches12m === 0 && ssEffective(r) > 0) out.push({ code: "SS-EX-01", text: "Never breached in 12 months (over-buffered candidate)", severity: "Info" })
  if (r.breaches90 >= 3) out.push({ code: "SS-EX-01", text: `Breached ${r.breaches90} times in 90 days (under-buffered)`, severity: "Info" })
  if (r.shelfLifeDays && ssEffective(r) > (r.shelfLifeDays / 2) * r.adu) out.push({ code: "W-SS-02", text: `Above shelf-life cap ${Math.round((r.shelfLifeDays / 2) * r.adu)}`, severity: "Warning" })
  return out
}
/** Proposal when Available + On-Order <= ROP: Max - Available - On-Order, min Reorder Qty, rounded up to the multiple. */
export function reorderProposal(r: SafetyStockRow) {
  const avail = available(r)
  if (avail + r.onOrder > reorderPoint(r)) return 0
  const raw = Math.max(r.maxStock - avail - r.onOrder, r.reorderQty)
  return Math.ceil(raw / (r.orderMultiple || 1)) * (r.orderMultiple || 1)
}
export const SS_APPROVAL_PCT = 25 // changes above 25% delta route to the Planning Manager [DOC:p.43 §10.1]

// ============================================================================ E&O §17.3
export const EO_BUCKETS = ["Under 6 months", "6-12 months", "12-24 months", "24+ months"] as const
export function eoBucket(lastMovement: string, today = TODAY) {
  const m = monthsBetween(lastMovement, today)
  return m < 6 ? EO_BUCKETS[0] : m < 12 ? EO_BUCKETS[1] : m < 24 ? EO_BUCKETS[2] : EO_BUCKETS[3]
}
export function eoPct(policy: EoPolicy, type: MaterialType, bucket: string, materialId: string) {
  const ov = policy.overrides.find((o) => o.materialId === materialId)
  if (ov) return { pct: ov.pct, note: `Override: ${ov.reason}` }
  const i = EO_BUCKETS.indexOf(bucket as (typeof EO_BUCKETS)[number])
  return { pct: i <= 0 ? 0 : policy.rates[type][i - 1], note: undefined }
}

// ============================================================================ info record status §7.2
export type IrStatus = "Active" | "Expired" | "Blocked"
export const IR_DEVIATION_PCT = 5 // invoice vs basis > 5% raises a buyer alert [DOC:p.158]
export const IR_STALE_MONTHS = 12 // last-PO basis older than 12 months is stale [DOC:p.158 §7.3]

// ============================================================================ item sales tab (Book I Part A §4)
/** Margin @ Standard = (price - current standard cost) / price (§4.2 [DOC:p.29]). */
export const marginPct = (price: number, std: number) => (price > 0 ? ((price - std) / price) * 100 : 0)
/** Product line margin floor (table F: PC-100 22%, PC-300 18%); other lines have none (RD-MM-13). */
export const marginFloor = (profitCenterId: string): number | undefined => (({ "PC-100": 22, "PC-300": 18 }) as Record<string, number>)[profitCenterId]
export const PRICE_CHANGE_PCT = 5 // price change above ±5% routes to pricing approval [DOC:p.29 §4.2]
