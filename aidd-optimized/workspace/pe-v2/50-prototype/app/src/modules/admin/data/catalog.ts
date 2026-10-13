// Admin reference catalogs, copied from the PRD text (not invented):
// - W.4 Workflow Catalog, the 27-row binding register [DOC:pp.11-12 §W.4] (asserted)
// - W.1 engine elements and Book IV §7.7 definition schema [DOC:pp.10-11 §W.1; pp.216-217 §7.7] (asserted)
// - W.3 standing job catalog [DOC:p.11 §W.3] and job contract fields [DOC:p.217 §7.7] (asserted)
// - Interface catalog IF-01..IF-20 [DOC:pp.185-186 Book III B §3] and console [DOC:p.187 §4] (asserted)
// - Severity matrix [DOC:p.190 Book III D §5] (asserted)
// - Fiscal period control INV §9 [DOC:pp.41-42] and tax configuration INV §11 [DOC:pp.45-46] (asserted)
// Values the PRD does not give are marked `design: true` or carry a reading id (AR-n, see README).

import type { ApprovalKind, Role } from "@/data/domain"

// ============================================================================ W.4 register
/** Rule grammar row (field, operator, value) [DOC:p.216 §7.7]; `then` is what the rule does to the chain. */
export type RuleOp = "=" | "≠" | "<" | "<=" | ">" | ">=" | "in" | "is set" | "is true"
export const RULE_OPS: RuleOp[] = ["=", "≠", "<", "<=", ">", ">=", "in", "is set", "is true"]
export interface Rule {
  field: string
  op: RuleOp
  value: string
  then: string
}
export const fmtRule = (r: Rule) => `${r.field} ${r.op}${r.op === "is set" || r.op === "is true" ? "" : ` ${r.value}`}${r.then ? ` → ${r.then}` : ""}`

/** Approver resolution per step: a role, a named user or a derived owner such as the Cost Center Manager
 *  [DOC:p.10 W.1; p.216 §7.7]. `role` on the step stays the seat the engine routes to (for a derived owner it is
 *  the fallback seat that stands in until the owner is resolved from the document). */
export type ApproverKind = "role" | "user" | "derived"
export interface Approver {
  kind: ApproverKind
  userId?: string
  derived?: string
}

export interface W4Step {
  role: Role
  /** Default is a role. */
  approver?: Approver
  /** Conditional step: only when this rule fires (e.g. "budget check fails"). */
  when?: string
  /** SLA hours per step. PRD gives 24 h (ECR emergency) and 2 days (MCR); others are AR-2 design values. */
  slaHours: number
  /** CCB votes run as a parallel step [DOC:p.10 W.1]. */
  parallel?: boolean
  note?: string
}
export interface W4Row {
  id: string // WF-01..WF-27 (design id; the register has no numbers)
  workflow: string // verbatim register name
  chain: string // verbatim "Trigger / Chain Summary"
  specifiedIn: string // verbatim "Specified In"
  owner: string // verbatim owner column
  ownerRole: Role // the role that may version it (AR-3 where the owner is not in the role list)
  documentType: string
  /** Shared-engine approval kinds this row covers (ApprovalButton kinds). Empty: runs on the admin engine queue (R-1). */
  coreKinds: ApprovalKind[]
  steps: W4Step[]
  /** Condition rules in the rule grammar (field, operator, value) [DOC:p.216 §7.7]. */
  conditions: string[]
  terminalActions: string[]
  /** Counts as a financial approval for the no-delegation-above-$250k rule (OQ-29, AR-4). */
  financial: boolean
  /** Changes need the owner plus the Controller when the workflow gates a posting [DOC:p.11 W.1 Versioning]. */
  gatesPosting: boolean
  flows: string[]
  reading?: string
}

const s = (role: Role, slaHours = 24, extra: Partial<W4Step> = {}): W4Step => ({ role, slaHours, ...extra })
const FM = "Finance Manager"

export const W4: W4Row[] = [
  { id: "WF-01", workflow: "PO approval ladder", chain: "Value bands: Buyer ≤ $25k → Purchasing Mgr ≤ $250k → Controller → CFO > $1M", specifiedIn: "Book I Part G §1", owner: "Purchasing Mgr", ownerRole: "Purchasing Manager", documentType: "Purchase order", coreKinds: ["PO approval"], steps: [s("Buyer"), s("Purchasing Manager"), s("Controller"), s("CFO", 48)], conditions: ["amount <= 25,000 → Buyer", "amount <= 250,000 → Purchasing Manager", "amount > 250,000 → + Controller", "amount > 1,000,000 → + CFO"], terminalActions: ["PO status In Approval → Released", "IF-01 PO transmission"], financial: true, gatesPosting: false, flows: ["FL-03", "FL-02", "FL-10"] },
  { id: "WF-02", workflow: "PR approval (manual/expense)", chain: "Cost-center + budget check routing", specifiedIn: "Book I Part G §3; ACC 21", owner: "Controller", ownerRole: "Controller", documentType: "Purchase requisition", coreKinds: [], steps: [s("Controller", 24, { approver: { kind: "derived", derived: "Cost Center Manager" }, note: "derived owner; the Controller seat stands in until the cost center resolves" }), s("Controller", 24, { when: "budget check fails", note: "added when the budget check fails" })], conditions: ["approver = cost center owner (derived)", "budget check fails → + Controller"], terminalActions: ["PR status → Approved"], financial: true, gatesPosting: false, flows: ["FL-03"], reading: "AR-5: the derived cost center owner is resolved to the department head role of the cost center" },
  { id: "WF-03", workflow: "Credit release", chain: "Credit hold → Finance queue (release / reject / raise limit)", specifiedIn: "Book I Part B §2.2", owner: "Controller", ownerRole: "Controller", documentType: "Sales order", coreKinds: ["Credit release"], steps: [s("Finance (credit)", 8)], conditions: ["exposure + order value > credit limit", "manual hold flag set"], terminalActions: ["SO Credit Hold → Confirmed (release) or Cancelled (reject, OQ-28)"], financial: true, gatesPosting: false, flows: ["FL-01", "FL-09"] },
  { id: "WF-04", workflow: "Price floor breach", chain: "Below floor: Pricing Mgr → Sales Director → CFO (floor −5pts)", specifiedIn: "Book I Part I §6.3", owner: "Pricing Mgr", ownerRole: "Pricing Manager", documentType: "Quotation / sales order line", coreKinds: ["Below price floor"], steps: [s("Pricing Manager"), s("Sales Director"), s("CFO", 48)], conditions: ["margin < floor (PC-100 22%, PC-300 18%)", "more than 5 points below floor → + CFO"], terminalActions: ["line price released"], financial: true, gatesPosting: false, flows: ["FL-01", "FL-02"] },
  { id: "WF-05", workflow: "Quotation internal review", chain: "Margin below target → estimator + pricing approval", specifiedIn: "Book I Part B §3.3", owner: "Sales Director", ownerRole: "Sales Director", documentType: "Quotation", coreKinds: [], steps: [s("Estimator"), s("Pricing Manager")], conditions: ["quoted margin < target margin"], terminalActions: ["quotation may be sent"], financial: true, gatesPosting: false, flows: ["FL-02"] },
  { id: "WF-06", workflow: "Sales change order", chain: "Post-confirm commercial changes; re-credit-check on increase", specifiedIn: "Book I Part B §4.5", owner: "Sales Director", ownerRole: "Sales Director", documentType: "Sales order", coreKinds: [], steps: [s("Sales Director")], conditions: ["order status after Confirmed", "value increase → re-run credit check"], terminalActions: ["change applied to the order; audit entry"], financial: true, gatesPosting: false, flows: ["FL-01", "FL-02", "FL-09"] },
  { id: "WF-07", workflow: "RMA approval matrix", chain: "Class/value/warranty routing: CS Mgr → Quality Mgr → Controller", specifiedIn: "Book I Part A §3.10", owner: "CS Mgr", ownerRole: "Customer Service Manager", documentType: "RMA", coreKinds: ["RMA approval"], steps: [s("Customer Service Manager"), s("Quality Manager"), s("Controller")], conditions: ["value <= 10,000 → CS Manager", "RC3 or warranty → + Quality Manager", "value > 50,000 or goodwill → + Controller"], terminalActions: ["RMA Pending Approval → Authorized"], financial: true, gatesPosting: false, flows: ["FL-05"] },
  { id: "WF-08", workflow: "RMA disposition & warranty adjudication", chain: "Inspector proposes → authorized role approves; goodwill → Controller", specifiedIn: "Book I Part A §3.6", owner: "Quality Mgr", ownerRole: "Quality Manager", documentType: "RMA disposition", coreKinds: [], steps: [s("Quality Manager"), s("Controller")], conditions: ["goodwill (out of warranty) → + Controller"], terminalActions: ["disposition posts #17-#23 per outcome"], financial: true, gatesPosting: true, flows: ["FL-05"], reading: "AR-6: the 'authorized role' is the Quality Manager (register owner)" },
  { id: "WF-09", workflow: "ECR / CCB decision", chain: "Impact analysis → CCB votes (parallel step); emergency 24 h SLA", specifiedIn: "Book I Part C §4.1", owner: "Engineering Mgr", ownerRole: "Engineering Manager", documentType: "ECR", coreKinds: ["ECR (CCB)"], steps: [s("Engineering Manager", 72, { parallel: true, note: "CCB vote; Emergency class 24 h" }), s("Controller")], conditions: ["class Emergency → SLA 24 h", "cost delta > 10,000 → + Controller"], terminalActions: ["ECR approved → ECO created"], financial: false, gatesPosting: false, flows: ["FL-10"] },
  { id: "WF-10", workflow: "ECO task set & release", chain: "Task checklist; atomic effectivity release", specifiedIn: "Book I Part C §4.2", owner: "Engineering Mgr", ownerRole: "Engineering Manager", documentType: "ECO", coreKinds: [], steps: [s("Engineering Manager", 48)], conditions: ["all ECO tasks done"], terminalActions: ["effectivity applied to all affected objects at once"], financial: false, gatesPosting: false, flows: ["FL-10"] },
  { id: "WF-11", workflow: "EBOM / routing / plan / document release", chain: "Draft → In Review → Released with role approvals", specifiedIn: "Book I Parts C–E", owner: "Engineering/Quality Mgr", ownerRole: "Engineering Manager", documentType: "EBOM, routing, inspection plan, document, production version", coreKinds: ["EBOM release", "Production version release"], steps: [s("Engineering Manager", 48)], conditions: ["inspection plan → Quality Manager", "author ≠ approver"], terminalActions: ["object status → Released"], financial: false, gatesPosting: false, flows: ["FL-02", "FL-10"] },
  { id: "WF-12", workflow: "MCR data-completion", chain: "Per-department task chain with 2-day SLAs → Materials Mgr activation", specifiedIn: "Book II §4.2", owner: "Materials Mgr", ownerRole: "Materials Manager", documentType: "Material creation request", coreKinds: [], steps: [s("Engineer", 48), s("Buyer", 48), s("Cost accountant", 48), s("Quality engineer", 48), s("Materials Manager", 48)], conditions: ["material type decides which department views are required"], terminalActions: ["material Data Completion → Active"], financial: false, gatesPosting: false, flows: ["FL-10", "FL-02"], reading: "AR-7: the department chain uses one role per view: Engineering, Purchasing, Costing, Quality" },
  { id: "WF-13", workflow: "MCH governed change / mass change", chain: "Class 2 field rules; simulation → approval → scheduled apply", specifiedIn: "Book II §4.4/§16.1", owner: "Materials Mgr", ownerRole: "Materials Manager", documentType: "Material change request", coreKinds: ["Material change"], steps: [s("Materials Manager", 48)], conditions: ["field class 2 → approval", "mass change → simulation first"], terminalActions: ["scheduled apply"], financial: false, gatesPosting: false, flows: ["FL-10"] },
  { id: "WF-14", workflow: "Supersession", chain: "Predecessor run-out policy approval", specifiedIn: "Book II §4.6", owner: "Materials Mgr", ownerRole: "Materials Manager", documentType: "Supersession", coreKinds: [], steps: [s("Materials Manager", 48)], conditions: ["run-out policy chosen"], terminalActions: ["supersession effective"], financial: false, gatesPosting: false, flows: ["FL-10"], reading: "AR-8: MM-SUP-001 sends supersessions as 'Material change' today; this row is where they belong" },
  { id: "WF-15", workflow: "Valuation method / class change", chain: "Period-boundary procedure, Controller approval", specifiedIn: "Book II §5.4", owner: "Controller", ownerRole: "Controller", documentType: "Material valuation", coreKinds: [], steps: [s("Controller", 48)], conditions: ["effective at a period boundary only"], terminalActions: ["valuation change applied at the boundary; revaluation posting"], financial: true, gatesPosting: true, flows: ["FL-06"] },
  { id: "WF-16", workflow: "Account determination matrix release", chain: "Mark → release with completeness check, step-up MFA", specifiedIn: "Book II §5.3", owner: "Controller", ownerRole: "Controller", documentType: "Account determination matrix", coreKinds: [], steps: [s("Controller", 48, { note: "step-up MFA at release" })], conditions: ["completeness check passes"], terminalActions: ["matrix version released"], financial: false, gatesPosting: true, flows: ["FL-06"] },
  { id: "WF-17", workflow: "Count variance approvals", chain: "Tolerance bands: Supervisor → Finance → Controller", specifiedIn: "Book I Part A §7.5", owner: "Warehouse Mgr", ownerRole: "Warehouse supervisor", documentType: "Count document", coreKinds: ["Count variance"], steps: [s("Warehouse supervisor"), s("Controlling analyst", 24, { approver: { kind: "derived", derived: FM }, when: "above the supervisor band or any ABC class-A variance", note: "Finance Manager band (INV §7.5); the Controlling analyst seat stands in, AR-26" }), s("Controller", 24, { when: "document net variance above $25,000" })], conditions: ["line <= 2,000 and document <= 10,000 → supervisor alone", "above the supervisor band, or any ABC class-A item variance → + Finance Manager", "document net variance > 25,000 → + Controller"], terminalActions: ["count posts"], financial: true, gatesPosting: true, flows: ["FL-06"], reading: "AR-3: 'Warehouse Mgr' is not in the role list; the Warehouse supervisor versions it. AR-26: 'Finance Manager' is not in the role list either; the Controlling analyst seat carries that band" },
  { id: "WF-18", workflow: "Costing run mark/release; WC rate release", chain: "Two-step release; revaluation posting", specifiedIn: "Book I Part I §2–3", owner: "Controller", ownerRole: "Controller", documentType: "Costing run / work center rates", coreKinds: [], steps: [s("Cost accountant", 24, { note: "mark" }), s("Controller", 24, { note: "release" })], conditions: ["mark before release", "two distinct users"], terminalActions: ["standard cost released; revaluation posting"], financial: true, gatesPosting: true, flows: ["FL-04", "FL-06"] },
  { id: "WF-19", workflow: "Safety stock change > 25%", chain: "Planner edit → Planning Mgr approval", specifiedIn: "Book I Part A §10.1", owner: "Planning Mgr", ownerRole: "Planning Manager", documentType: "Safety stock row", coreKinds: ["Safety stock change"], steps: [s("Planning Manager")], conditions: ["delta > 25%"], terminalActions: ["new safety stock effective"], financial: false, gatesPosting: false, flows: ["FL-04"] },
  { id: "WF-20", workflow: "Fiscal period reopen", chain: "Controller + CFO dual control, tagged postings", specifiedIn: "Book I Part A §9.3", owner: "CFO", ownerRole: "CFO", documentType: "Fiscal period", coreKinds: [], steps: [s("Controller", 8), s("CFO", 8)], conditions: ["period Hard Close", "two distinct users, in sequence (C-43)"], terminalActions: ["period Hard Close → Soft Close; postings tagged Reopened Posting"], financial: false, gatesPosting: true, flows: ["FL-06"], reading: "AR-9: runs on the admin engine queue; the shared engine has a 'Period reopen' kind (Controller, CFO) but no fiscal-period document type to attach it to (R-2)" },
  { id: "WF-21", workflow: "Vendor onboarding", chain: "Docs → review → Active (no PO before Active)", specifiedIn: "Book I Part G §2.1; ACC 22", owner: "Purchasing Mgr", ownerRole: "Purchasing Manager", documentType: "Vendor", coreKinds: [], steps: [s("Quality engineer", 48), s("Purchasing Manager", 48)], conditions: ["compliance documents complete"], terminalActions: ["vendor Under Review → Active"], financial: false, gatesPosting: false, flows: ["FL-03"], reading: "AR-10: the review step is the Quality engineer, then the Purchasing Manager activates" },
  { id: "WF-22", workflow: "SCAR escalation", chain: "Vendor response SLA → AVL Restricted on 2 overdue", specifiedIn: "Book I Part E §6", owner: "Quality Mgr", ownerRole: "Quality Manager", documentType: "SCAR", coreKinds: [], steps: [s("Quality Manager", 336, { note: "vendor response window" })], conditions: ["response overdue", "2 overdue SCARs → AVL Restricted"], terminalActions: ["vendor quality status → Restricted"], financial: false, gatesPosting: false, flows: ["FL-08", "FL-03"] },
  { id: "WF-23", workflow: "Recall campaign notifications", chain: "Dual approval (Quality Mgr + executive) before external send", specifiedIn: "Book III Part A FL-08", owner: "Quality Mgr", ownerRole: "Quality Manager", documentType: "Recall campaign", coreKinds: ["Recall external notification"], steps: [s("Quality Manager", 8), s("Executive", 8)], conditions: ["external notification text"], terminalActions: ["notification may be sent (C-52)"], financial: false, gatesPosting: false, flows: ["FL-08"] },
  { id: "WF-24", workflow: "Promise-date change / at-risk", chain: "At-risk record → recovery decision → customer notification per class", specifiedIn: "Book III Part E §5", owner: "Production Scheduler", ownerRole: "Production Scheduler", documentType: "At-risk promise", coreKinds: [], steps: [s("Production Scheduler"), s("Customer Service Manager")], conditions: ["promise at risk"], terminalActions: ["recovery applied; customer notified per class"], financial: false, gatesPosting: false, flows: ["FL-02", "FL-04", "FL-09"], reading: "AR-11: the customer-notification step sits with the Customer Service Manager" },
  { id: "WF-25", workflow: "De-peg SO stock", chain: "Sales Director approval with reason, logged both orders", specifiedIn: "Book II §14.4", owner: "Sales Director", ownerRole: "Sales Director", documentType: "Sales order stock", coreKinds: ["Reallocation of confirmed supply"], steps: [s("Sales Director")], conditions: ["stock pegged to a sales order"], terminalActions: ["audit pair on both orders"], financial: false, gatesPosting: false, flows: ["FL-09", "FL-02"], reading: "AR-12: OM-BO reallocation (p.207 §2.2) uses the same chain, so it is counted under this row" },
  { id: "WF-26", workflow: "SoD exception grant", chain: "CFO approval with expiry", specifiedIn: "Book III Part C §3", owner: "CFO", ownerRole: "CFO", documentType: "SoD exception", coreKinds: [], steps: [s("CFO", 24)], conditions: ["toxic role pair requested"], terminalActions: ["exception granted until its expiry date"], financial: false, gatesPosting: false, flows: [] },
  { id: "WF-27", workflow: "Access recertification", chain: "Quarterly attestation; failed = auto-revoke", specifiedIn: "Book III Part C §3", owner: "ISO", ownerRole: "Plant IT", documentType: "Access review", coreKinds: [], steps: [s("Engineering Manager", 120)], conditions: ["quarterly", "attestation failed → auto-revoke"], terminalActions: ["access kept, or revoked automatically"], financial: false, gatesPosting: false, flows: [], reading: "AR-3: 'ISO' is not in the role list; Plant IT versions it. The attesting manager is resolved per department" },
]

/** Workflows the PRD names as W.4 additions elsewhere: not rows of the 27-row register, but governed actions
 *  that "ship through change control" [DOC:p.12 W.4 Build Note]. Run on the admin engine queue. */
export const W4_ADDITIONS: W4Row[] = [
  {
    id: "WF-A1", workflow: "Supplier Deviation", chain: "Vendor-proposed alternate or deviation → Supplier Deviation record routed to Engineering + Quality; approval scope: affected lots/orders, expiry",
    specifiedIn: "Book IV §3.4 (E-DTS-04), workflow W.4 addition", owner: "Quality Mgr", ownerRole: "Quality Manager", documentType: "Supplier Deviation (QM-DEV-001)", coreKinds: [],
    steps: [s("Engineering Manager", 48, { parallel: true, note: "Engineering vote, in parallel with Quality" }), s("Quality Manager", 48, { parallel: true, note: "Quality vote, in parallel with Engineering" })],
    conditions: ["origin = Supplier deviation request → route to Engineering + Quality", "approval scope has expiry or quantity → required", "customer serials affected and type = Waiver → customer evidence attached"],
    terminalActions: ["Deviation Approved with expiry; approved deviations link into genealogy so affected serials are queryable (Traceability §4.3)"], financial: false, gatesPosting: false, flows: ["FL-04"],
    reading: "AR-27: the PRD names the routing (Engineering + Quality) and calls it a W.4 addition without a row; both seats vote in parallel and both must approve (QM-DEV-001 needs two approvals)",
  },
]
export const W4_ALL: W4Row[] = [...W4, ...W4_ADDITIONS]

/** Shared-engine kinds that are not rows of the W.4 register. The Build Note says such an action is
 *  "either added through change control or it does not ship" [DOC:p.12 W.4]. Shown as flags. */
export const KINDS_OUTSIDE_W4: { kind: ApprovalKind; source: string }[] = [
  { kind: "No-quote sales order", source: "R-OM-02 [DOC:p.52 §4.1]" },
  { kind: "Price change on sales tab", source: "[DOC:pp.28-29 §4]" },
  { kind: "Long-lead release", source: "[DOC:p.209 §3.2]" },
  { kind: "WO reopen", source: "[DOC:p.179 field 4]" },
  { kind: "Intercompany price deviation", source: "[DOC:p.181 FL-07 field 4]" },
  { kind: "Price list approval", source: "[DOC:p.122 §6.1]" },
  { kind: "Bad debt write-off", source: "[DOC:pp.176-177 FL-01 field 11]" },
]

export const w4ById = (id: string) => W4_ALL.find((w) => w.id === id)
export const w4ForKind = (k: ApprovalKind) => W4_ALL.find((w) => w.coreKinds.includes(k))

/** Escalation target = the step role's manager [DOC:p.11 W.1 Escalation]. The PRD gives no
 *  reporting lines, so this map is reading AR-13. */
export const ESCALATE_TO: Partial<Record<Role, Role>> = {
  Buyer: "Purchasing Manager", "Purchasing Manager": "Controller", Controller: "CFO", CFO: "Executive",
  "Pricing Manager": "Sales Director", Estimator: "Sales Director", "Sales Director": "Executive",
  "Customer service": "Customer Service Manager", "Customer Service Manager": "Sales Director", "Finance (credit)": "Controller",
  Inspector: "Quality Manager", "Quality engineer": "Quality Manager", "Quality Manager": "Executive",
  Engineer: "Engineering Manager", "Engineering Manager": "Executive", "Cost accountant": "Controller",
  "Material steward": "Materials Manager", "Materials Manager": "Executive", Planner: "Planning Manager", "Planning Manager": "Executive",
  "Production Scheduler": "Planning Manager", "Production supervisor": "Planning Manager", "Warehouse supervisor": "Controller", "Plant IT": "Executive",
}
export const escalationOf = (r: Role): Role => ESCALATE_TO[r] ?? "Executive"

/** W.1 element list, shown on WF-DEF as the definition model [DOC:pp.10-11 §W.1] (asserted). */
export const W1_ELEMENTS: [string, string][] = [
  ["Definition model", "Per document type: trigger, condition rules (any document field via the rule grammar), approver chain (sequential steps; role, named user or derived owner), parallel steps where flagged (CCB votes), terminal actions"],
  ["Versioning", "Effective-dated and versioned; in-flight instances complete on the version they started; changes need the owning role in W.4 plus Controller when the workflow gates a posting"],
  ["Delegation and absence", "Per-user delegate with date range; delegation logged on every action taken; standing delegation of financial approvals above $250k prohibited (SoD rule)"],
  ["Escalation and SLA", "Per step: SLA hours, reminder cadence, escalation target (role manager) on breach; breaches feed the exception dashboards"],
  ["Recall and resubmit", "Initiator may recall before first approval; rejection returns with mandatory comments to the responsible step; resubmission preserves history"],
  ["Acting surface", "In-app queue, email actions with signed links, mobile-responsive approval view; every action records user, timestamp, channel and comment on the immutable audit trail"],
  ["Evidence", "Approval history renders on the document Activity tab and exports with it"],
]

// ============================================================================ W.3 job catalog
export type CloseCriticality = "Close-critical" | "Not close-critical"
export interface JobDef {
  id: string
  name: string // verbatim from the W.3 standing catalog
  calendar: string
  closeCriticality: CloseCriticality
  dependsOn: string[]
  owner: Role
  slaMinutes: number
  retryPolicy: string
  idempotencyKey: string
  output: string
  reconciliation: string
  /** Declared inputs (first field of the §7.7 job contract). Values are reading AR-28. */
  inputs: string
  interfaceId?: string
  /** The screen whose records the job writes (the console only runs and monitors it). */
  screen?: { id: string; route: string }
  design?: string
}
const JOBS_RAW: Omit<JobDef, "inputs">[] = [
  { id: "JOB-01", name: "Nightly MRP", calendar: "Daily 01:00", closeCriticality: "Not close-critical", dependsOn: ["JOB-03"], owner: "Planning Manager", slaMinutes: 30, retryPolicy: "2 retries, 10 min apart", idempotencyKey: "run date + plant", output: "MRP run (proposal set)", reconciliation: "Proposal count + exception count per run logged and trended (IF-11)", interfaceId: "IF-11", screen: { id: "PP-MRP-001", route: "/production/mrp" } },
  { id: "JOB-02", name: "ADU and ABC/XYZ classification", calendar: "Monthly, 1st 02:00", closeCriticality: "Not close-critical", dependsOn: [], owner: "Planning Manager", slaMinutes: 60, retryPolicy: "3 retries, 15 min apart", idempotencyKey: "month + plant", output: "ADU and class per item", reconciliation: "Items classified = active stocked items" },
  { id: "JOB-03", name: "Batch expiry sweep", calendar: "Daily 00:30", closeCriticality: "Not close-critical", dependsOn: [], owner: "Warehouse supervisor", slaMinutes: 15, retryPolicy: "3 retries, 5 min apart", idempotencyKey: "run date", output: "Expired batches moved to Blocked", reconciliation: "Expired batches with unrestricted stock = 0" },
  { id: "JOB-04", name: "Vendor rating rollup", calendar: "Daily 03:00", closeCriticality: "Not close-critical", dependsOn: [], owner: "Purchasing Manager", slaMinutes: 20, retryPolicy: "2 retries, 10 min apart", idempotencyKey: "run date", output: "Vendor scores", reconciliation: "Scored vendors = Active vendors" },
  { id: "JOB-05", name: "Economic nexus monitor", calendar: "Daily 04:00", closeCriticality: "Not close-critical", dependsOn: [], owner: "Controller", slaMinutes: 20, retryPolicy: "2 retries, 10 min apart", idempotencyKey: "run date", output: "Rolling 12-month sales and transactions per state; alert at 80% of a threshold", reconciliation: "States monitored = thresholds table rows", screen: { id: "INV-CONFIG-TAX", route: "/inventory/configuration/tax" } },
  { id: "JOB-06", name: "Allocation cycles", calendar: "Period-end", closeCriticality: "Close-critical", dependsOn: ["JOB-07"], owner: "Controller", slaMinutes: 45, retryPolicy: "Rerun = reversal + repost (FL-06)", idempotencyKey: "cycle + period", output: "Allocation run ALC-YYYYMM-NN, posting #36", reconciliation: "Net zero across sender and receiver cost centers", screen: { id: "CO-ALC-001/2", route: "/controlling/allocations" } },
  { id: "JOB-07", name: "Warranty accrual", calendar: "Period-end", closeCriticality: "Close-critical", dependsOn: [], owner: "Controller", slaMinutes: 20, retryPolicy: "2 retries, then page on-call", idempotencyKey: "entity + period", output: "Recurring JE, posting #24 (6300 / 2610)", reconciliation: "Accrual = accrual % × FG shipments of the period" },
  { id: "JOB-08", name: "E&O run", calendar: "Period-end (reserve quarterly)", closeCriticality: "Close-critical", dependsOn: ["JOB-02"], owner: "Controller", slaMinutes: 60, retryPolicy: "2 retries, then page on-call", idempotencyKey: "entity + period", output: "E&O reserve run (DR 6320 / CR 5340)", reconciliation: "Reserve = sum of item reserves", screen: { id: "MM-EOR-001", route: "/materials/eo-reserve" } },
  { id: "JOB-09", name: "Costing runs", calendar: "Per policy", closeCriticality: "Not close-critical", dependsOn: [], owner: "Cost accountant", slaMinutes: 90, retryPolicy: "Manual rerun", idempotencyKey: "run id", output: "Costing run (mark and release via WF-18)", reconciliation: "Items costed = items in scope", screen: { id: "CST-RUN-001", route: "/costing/runs" } },
  { id: "JOB-10", name: "Recalc queue for tax failover", calendar: "Every 15 min", closeCriticality: "Not close-critical", dependsOn: [], owner: "Controller", slaMinutes: 5, retryPolicy: "Retry every 15 min until Avalara answers", idempotencyKey: "document + tax point", output: "Recalculated documents; tax adjustment JEs on discrepancy", reconciliation: "Tax reconciliation report (ACC 19.3)", interfaceId: "IF-16", screen: { id: "INV-CONFIG-TAX", route: "/inventory/configuration/tax" } },
  { id: "JOB-11", name: "Data-quality KPI computation", calendar: "Daily 05:00", closeCriticality: "Not close-critical", dependsOn: [], owner: "Materials Manager", slaMinutes: 30, retryPolicy: "2 retries, 10 min apart", idempotencyKey: "run date", output: "Data quality KPIs", reconciliation: "KPI rows = rule count", screen: { id: "MM-DQ-001", route: "/materials/data-quality" } },
  { id: "JOB-12", name: "Access recertification generation", calendar: "Quarterly", closeCriticality: "Not close-critical", dependsOn: [], owner: "Plant IT", slaMinutes: 30, retryPolicy: "2 retries", idempotencyKey: "quarter", output: "One attestation per department manager (WF-27)", reconciliation: "Attestations = departments with users" },
]
/** Job inputs: the §7.7 contract requires every W.3 job to declare them [DOC:p.217]; the PRD lists the field, not the
 *  values, so each is read off the job's own description (AR-28). */
const JOB_INPUTS: Record<string, string> = {
  "JOB-01": "Open demand (sales orders, forecasts), stock and open supply by plant, planning parameters, batch status from JOB-03",
  "JOB-02": "12 months of issue history per item and plant (ADU), consumption value ranking and variability",
  "JOB-03": "Batch records with expiry date, stock status by batch",
  "JOB-04": "Vendor scorecard events: GRN dates and quantities (IF-08), NCR and SCAR counts, price variances",
  "JOB-05": "Rolling 12-month sales and transaction counts by ship-to state, nexus register",
  "JOB-06": "Allocation cycle definition (CO-ALC), sender and receiver cost objects, period postings; JOB-07 result",
  "JOB-07": "Warranty accrual % per product family, finished goods shipments of the period, account determination row for 2610",
  "JOB-08": "Item reserves by age and demand, ABC/XYZ classes from JOB-02, E&O policy",
  "JOB-09": "Items in scope of the costing run, BOM and routing versions, work center rates, price sources",
  "JOB-10": "Documents queued during an Avalara failover (tax estimates and commits), tax point dates",
  "JOB-11": "Material master rows and the data-quality rule catalog",
  "JOB-12": "User and role assignments per department, the previous quarter's attestations",
}
export const JOBS: JobDef[] = JOBS_RAW.map((j) => ({ ...j, inputs: JOB_INPUTS[j.id] ?? "Declared in the job definition" }))
export const jobById = (id: string) => JOBS.find((j) => j.id === id)

// ============================================================================ Interface catalog
export interface InterfaceDef {
  id: string
  name: string
  type: string
  flow: string // producer → consumer
  owner: string
  reconciliation: string
  phase?: string
  /** Messages in this interface carry a financially relevant command: discard needs the Controller [DOC:p.187 §4]. */
  financial: boolean
}
export const INTERFACES: InterfaceDef[] = [
  { id: "IF-01", name: "PO transmission to vendor", type: "Email PDF (Phase 1) / EDI 850 (Phase 2)", flow: "Purchasing → Vendor", owner: "Purchasing", reconciliation: "Unconfirmed-PO report > 3 days (MFG G §1)", financial: false },
  { id: "IF-02", name: "Vendor confirmation capture", type: "Screen / EDI 855 (Phase 2)", flow: "Vendor → Purchasing", owner: "Purchasing", reconciliation: "Confirmed-vs-need-date exception board", financial: false },
  { id: "IF-03", name: "Engineering lifecycle events", type: "Events", flow: "ENG → MM/PP/CST", owner: "Engineering IT", reconciliation: "Exceptions panel: EBOM-ahead, placeholder aging", financial: false },
  { id: "IF-04", name: "Sales order events", type: "Events", flow: "OM → PP/INV/ACC", owner: "Sales IT", reconciliation: "Open-order book vs pegged supply daily", financial: false },
  { id: "IF-05", name: "WO lifecycle events", type: "Events", flow: "PP → OM/INV/CST", owner: "Production IT", reconciliation: "WIP report = GL tie (close 6c)", financial: false },
  { id: "IF-06", name: "Confirmation postings", type: "Internal atomic + events", flow: "Shop floor → GL/genealogy", owner: "Production IT", reconciliation: "Scan telemetry vs posted confirmations daily count match", financial: true },
  { id: "IF-07", name: "Shipment/PGI events", type: "Events", flow: "OM → ACC/INV", owner: "Sales IT", reconciliation: "Shipped-not-invoiced report", financial: true },
  { id: "IF-08", name: "GRN events", type: "Events", flow: "INV → ACC/QM/PUR", owner: "Inventory IT", reconciliation: "GR/IR aging (FL-03 field 12)", financial: true },
  { id: "IF-09", name: "Invoice requests", type: "Outbox command", flow: "OM/RMA → ACC", owner: "Finance IT", reconciliation: "Request-to-invoice latency + orphan report", financial: true },
  { id: "IF-10", name: "Three-way match basis", type: "Internal contract", flow: "INV/PUR → ACC", owner: "Finance IT", reconciliation: "Match exception queue age", financial: true },
  { id: "IF-11", name: "MRP proposal set", type: "Batch publish (run ID)", flow: "MRP → PUR/PP", owner: "Planning IT", reconciliation: "Proposal count + exception count per run logged and trended", financial: false },
  { id: "IF-12", name: "RMA disposition outcomes", type: "Outbox commands", flow: "RMA → ACC/PP/OM", owner: "Sales IT", reconciliation: "Close step 6e (Settling gaps)", financial: true },
  { id: "IF-13", name: "Close checklist automation", type: "Read APIs", flow: "ACC → all modules", owner: "Finance IT", reconciliation: "The checklist itself", financial: false },
  { id: "IF-14", name: "Intercompany pairing", type: "Atomic internal", flow: "Entity A ↔ Entity B", owner: "Finance IT", reconciliation: "Monthly IC recon (FL-07)", financial: true },
  { id: "IF-15", name: "Recall campaign bulk actions", type: "Bulk jobs", flow: "QM → INV/OM/RMA", owner: "Quality IT", reconciliation: "Per-item result log; population audit", financial: false },
  { id: "IF-16", name: "Tax engine (Avalara)", type: "External REST", flow: "OM/ACC → Avalara", owner: "Finance IT", reconciliation: "Tax reconciliation report (ACC 19.3) + recalc queue", financial: true },
  { id: "IF-17", name: "CAD/PDM connector", type: "External (Part G)", flow: "PDM ↔ ENG", owner: "Engineering IT", reconciliation: "Sync conflict queue (Part G §4)", financial: false },
  { id: "IF-18", name: "Identity provider", type: "OIDC/SAML + SCIM", flow: "IdP → platform", owner: "IT Security", reconciliation: "Access recertification (Part C §3)", financial: false },
  { id: "IF-19", name: "Label/print service", type: "Internal REST", flow: "All → printers", owner: "Plant IT", reconciliation: "Failed-print queue with reprint audit", financial: false },
  { id: "IF-20", name: "Scale/instrument capture", type: "Station integration (Phase 2)", flow: "Devices → QM/Pack", owner: "Plant IT", reconciliation: "Manual-entry fallback flagged rows", phase: "Phase 2", financial: false },
]
/** Reconciliation reports: the per-interface controls in §3 run on a schedule and failures raise incidents per Part D §5
 *  [DOC:p.187 §4]. The cadence is a design value (AR-29); the control text is the PRD's. */
export const RECON_SCHEDULE: Record<string, string> = {
  "IF-01": "Daily 07:00", "IF-02": "Daily 07:00", "IF-03": "Every 4 h", "IF-04": "Daily 05:30", "IF-05": "Daily 06:00", "IF-06": "Daily 23:30", "IF-07": "Daily 06:00",
  "IF-08": "Daily 06:00", "IF-09": "Hourly", "IF-10": "Daily 06:30", "IF-11": "After each MRP run", "IF-12": "Period-end", "IF-13": "Period-end", "IF-14": "Monthly, 1st",
  "IF-15": "After each campaign step", "IF-16": "Monthly, 1st (ACC 19.3)", "IF-17": "Every 4 h", "IF-18": "Quarterly", "IF-19": "Hourly", "IF-20": "Daily 23:00",
}
export const interfaceById = (id: string) => INTERFACES.find((i) => i.id === id)

/** Severity matrix [DOC:p.190 Book III D §5] (asserted). */
export const SEVERITIES = [
  { id: "S1", rule: "T1 service down or data-integrity suspicion", response: "15-min response 24×7 during production" },
  { id: "S2", rule: "T2 degradation", response: "1 h business hours" },
  { id: "S3", rule: "Queued", response: "Queued" },
  { id: "S4", rule: "Queued", response: "Queued" },
] as const
export type Severity = (typeof SEVERITIES)[number]["id"]

// ============================================================================ Fiscal period control (INV §9)
/** Inventory presentation of the one period record [DOC:p.41 §9.1] (asserted). */
export const INVENTORY_LABEL: Record<string, string> = { Open: "Open", "Soft Close": "Closing", "Hard Close": "Closed", "Year-End Closed": "Closed" }

/** Module behavior matrix [DOC:pp.41-42 §9.2] (asserted). */
export const BEHAVIOR_MATRIX: [string, string, string, string][] = [
  ["GRN / Check-In, RMA receipt", "Post", "Post with warning banner", "Blocked"],
  ["Check-Out / issues, transfers, scrap", "Post", "Post with warning", "Blocked"],
  ["Stock adjustments, count postings", "Post", "Post with warning; count postings for the closing period allowed (that is their purpose)", "Blocked"],
  ["Production confirmations, WO settlement", "Post", "Settlement allowed (period-end activity); new confirmations warned", "Blocked"],
  ["Standard cost release / revaluation", "Post", "Blocked (must land in an open period)", "Blocked"],
  ["Sales PGI / shipment", "Post", "Post with warning", "Blocked"],
  ["Invoices / credit notes (ACC)", "Post", "Per ACC soft-close rule", "Blocked per ACC"],
  ["Master data changes", "Always allowed — masters are not period-controlled", "—", "—"],
  ["Reservations, picklists, packing (no GL)", "Always allowed — logistics documents without value posting are not period-blocked; only their posting steps are", "—", "—"],
]
export const TRANSACTIONS = BEHAVIOR_MATRIX.map((r) => r[0])

/** Standard errors [DOC:p.42 §9.5] (asserted), with {placeholders}. */
export const E_PER = {
  "E-PER-01": "Posting date {date} falls in period {period}, status Closed. Post to the current open period and set Reference Date if needed.",
  "E-PER-02": "Period {period} is in Soft Close. Your posting will be included in month-end review.",
  "E-PER-03": "Inventory period cannot Hard Close: {n} unresolved documents. Open the Pre-Close Validation list.",
  "E-PER-04": "Posting date {date} is beyond the next open period.",
} as const
export type EPerCode = keyof typeof E_PER
export const fillMsg = (code: EPerCode, vars: Record<string, string | number>) => E_PER[code].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))

export const CLOSE_SEQUENCE: string[] = [
  "Day −2: Finance sets period to Soft Close. Operational posting continues with warnings; teams clear WIP documents (Draft GRNs, open counts, unsettled WOs) driven by the Pre-Close Validation list.",
  "Day +1 to +3: cutoff cleanup. Receipts keyed after month-end post with posting date = actual receipt date, allowed during Soft Close with warning.",
  "Inventory close run: pre-close validation must return zero blockers; valuation snapshot generated, closing JE posted, status → Closed.",
  "Finance completes ACC 26.2 checklist (step 6b “Inventory period closed”); period Hard Closes. The next period was already opened at first Soft Close (R-PER-01).",
  "Reopen: Closed → Soft Close requires Controller + CFO; the reason and every posting made during the reopen window are tagged Reopened Posting and listed in the close report.",
]

// ============================================================================ Tax configuration (INV §11)
export const TAX_PRECEDENCE: [string, string][] = [
  ["Document-line manual tax override", "Role-limited: Finance only; reason mandatory; flagged on the document and in the Avalara Transaction Log as Override"],
  ["Customer exemption certificate (ACC 19.2)", "A Verified, unexpired certificate for the ship-to state sets the exemption code; Avalara returns $0 for exempt lines"],
  ["Customer/vendor tax profile (§11.3)", "Default tax code, nexus-relevant registration numbers, use-tax accrual flag for vendors"],
  ["Item tax data", "Tax Category (Taxable / Tax-Exempt / Zero-Rated) and Avalara product tax code from the Sales tab; HSN/HTS code for customs"],
  ["Jurisdiction", "Ship-from (warehouse address) + ship-to (document address) sent to Avalara; PE nexus configuration decides whether tax is collected at all"],
  ["Failover", "Avalara unreachable → tax code override rate with Override badge; documents post and queue for recalculation every 15 min"],
]
export const TRIGGER_POINTS: { id: string; label: string; event: string; kind: "estimate" | "commit" }[] = [
  { id: "quote", label: "Quote save", event: "estimate", kind: "estimate" },
  { id: "so", label: "SO save", event: "estimate", kind: "estimate" },
  { id: "invoice", label: "Invoice post", event: "commit", kind: "commit" },
  { id: "credit", label: "Credit note post", event: "ReturnInvoice", kind: "commit" },
  { id: "void", label: "Void", event: "DocVoided", kind: "commit" },
]
export const DEFAULT_TAX_CODES: { family: string; code: string; configurable: boolean; note?: string }[] = [
  { family: "Sales", code: "S1", configurable: true },
  { family: "Purchases", code: "U1", configurable: true, note: "use tax" },
  { family: "Intercompany", code: "E-IC", configurable: true, note: "exempt" },
  { family: "RMA credits", code: "Inherit original invoice’s codes", configurable: false, note: "hard rule, not configurable" },
]
