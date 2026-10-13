// Approval limits and routing, reference table F [DOC pages per row] (asserted).
// One shared approval engine, no module-specific approvals [DOC:pp.10-12 §W] (asserted, C-1):
// every approve / reject control in the app goes through ApprovalButton -> WF-INBOX.
// Delegation is prohibited above $250k for financial approvals (C-2).
// Where the specification names a threshold but not the approver, `reading` says so and the
// request is routed to the role the screen entry names; that routing is a reading, shown as a chip.

import type { Role } from "./roles"

export type ApprovalKind =
  | "PO approval"
  | "RMA approval"
  | "No-quote sales order"
  | "Credit release"
  | "Price change on sales tab"
  | "Below price floor"
  | "Reallocation of confirmed supply"
  | "ECR (CCB)"
  | "Long-lead release"
  | "WO reopen"
  | "Count variance"
  | "Period reopen"
  | "Safety stock change"
  | "Intercompany price deviation"
  | "Recall external notification"
  | "EBOM release"
  | "Production version release"
  | "Price list approval"
  | "Material change"
  | "Bad debt write-off"
  // Added in the integration pass (module requests); each route is a reading unless a [DOC] source is cited.
  | "Manual info record price"
  | "Valuation change"
  | "Consignment true-up"
  | "Inspection plan approval"
  | "Deviation approval"
  | "Recall partial recovery"
  | "Final test scrap"
  | "Reprint approval"
  | "RMA disposition"
  | "Warranty extension"
  | "Sales change order"
  | "Cancellation fee waiver"
  | "De-peg"

export interface ApprovalContext {
  amount?: number
  /** RMA class and flags */
  rmaClass?: "RC1" | "RC2" | "RC3" | "RC4" | "Recall"
  warranty?: boolean
  goodwill?: boolean
  /** LLR */
  riskClass?: "Low" | "Medium" | "High"
  /** Price floor: how many points below the floor */
  pointsBelowFloor?: number
  /** ECR cost delta */
  costDelta?: number
  /** Count variance per line */
  lineAmount?: number
  /** Whether the approval is financial (drives C-2) */
  financial?: boolean
}

export interface ApprovalRoute {
  steps: Role[]
  /** All steps must approve in order (period reopen, recall notification) */
  sequential: boolean
  delegationAllowed: boolean
  rule: string
  source: string
  reading?: string
}

const FIN_LIMIT = 250_000

export function routeApproval(kind: ApprovalKind, ctx: ApprovalContext = {}): ApprovalRoute {
  const amt = ctx.amount ?? 0
  const financial = ctx.financial ?? FINANCIAL.has(kind)
  const delegationAllowed = !(financial && amt > FIN_LIMIT)
  const r = (steps: Role[], rule: string, source: string, extra: Partial<ApprovalRoute> = {}): ApprovalRoute => ({
    steps, rule, source, sequential: true, delegationAllowed, ...extra,
  })
  switch (kind) {
    case "PO approval":
      if (amt <= 25_000) return r(["Buyer"], "PO up to $25k: Buyer", "[DOC:p.11 §W.4; p.104]")
      if (amt <= 250_000) return r(["Purchasing Manager"], "PO up to $250k: Purchasing Manager", "[DOC:p.11 §W.4; p.104]")
      if (amt <= 1_000_000) return r(["Purchasing Manager", "Controller"], "PO above $250k: + Controller", "[DOC:p.11 §W.4; p.104]")
      return r(["Purchasing Manager", "Controller", "CFO"], "PO above $1M: + CFO", "[DOC:p.11 §W.4; p.104]")
    case "RMA approval": {
      const steps: Role[] = ["Customer Service Manager"]
      if (ctx.rmaClass === "RC3" || ctx.warranty) steps.push("Quality Manager")
      if (amt > 50_000 || ctx.goodwill) steps.push("Controller")
      return r(steps, "RMA: up to $10,000 CS Manager; RC3/warranty + Quality Manager; above $50,000 or goodwill + Controller", "[DOC:p.21; p.27 §3]", amt > 10_000 && amt <= 50_000 ? { reading: "Approver between $10,000 and $50,000 is not stated; routed to CS Manager" } : {})
    }
    case "No-quote sales order":
      return r(["Sales Director"], "Order above $250k without a quotation: Sales Director (R-OM-02)", "[DOC:p.52 §4.1]")
    case "Credit release":
      return r(["Finance (credit)"], "Credit Hold released by Finance only; Sales cannot release (C-12)", "[DOC:p.49 §2.2; p.11 W.4]", { reading: "Table F names the Controller as releaser; C-12 names Finance. FL-09 routes to Finance (credit)" })
    case "Price change on sales tab":
      return r(["Pricing Manager"], "Price change above ±5% needs approval", "[DOC:pp.28-29 §4]", { reading: "Approver not stated; routed to Pricing Manager" })
    case "Below price floor": {
      const steps: Role[] = ["Pricing Manager", "Sales Director"]
      if ((ctx.pointsBelowFloor ?? 0) > 5) steps.push("CFO")
      return r(steps, "Below floor: Pricing Manager, then Sales Director; more than 5 points below: + CFO (floor PC-100 22%, PC-300 18%)", "[DOC:p.122 §6.3]")
    }
    case "Reallocation of confirmed supply":
      return r(["Sales Director"], "Reallocating confirmed supply: Sales Director; audit pair on both orders", "[DOC:p.207 §2.2]")
    case "ECR (CCB)": {
      const steps: Role[] = ["Engineering Manager"]
      if ((ctx.costDelta ?? 0) > 10_000) steps.push("Controller")
      return r(steps, "CCB decides (Emergency within 24 h); adds Controller if cost delta above $10k", "[DOC:p.62 §4.1]", { reading: "CCB membership is not listed; Engineering Manager stands for the CCB" })
    }
    case "Long-lead release": {
      const steps: Role[] = ["Engineering Manager", "Purchasing Manager"]
      if (amt > 100_000 || ctx.riskClass === "High") steps.push("Controller")
      return r(steps, "LLR: Engineering Manager + Purchasing Manager; Controller above $100k exposure or risk High", "[DOC:p.209 §3.2]")
    }
    case "WO reopen":
      return r(["Controller"], "Production order reopen: Controller", "[DOC:p.179 field 4]")
    case "Count variance": {
      const steps: Role[] = []
      if (amt <= 10_000 && (ctx.lineAmount ?? 0) <= 2_000) steps.push("Warehouse supervisor")
      else steps.push("Warehouse supervisor", "Controller")
      return r(steps, "Count: supervisor up to $2,000 per line and $10,000 per document; Controller above $25,000", "[DOC:pp.36-37 §7]", amt > 10_000 && amt <= 25_000 ? { reading: "Approver between $10,000 and $25,000 is not stated; routed to supervisor + Controller" } : {})
    }
    case "Period reopen":
      return r(["Controller", "CFO"], "Reopen a closed period: Controller + CFO, two distinct users, in sequence (C-43)", "[DOC:pp.41-42 §9; p.180]")
    case "Safety stock change":
      return r(["Planning Manager"], "Safety stock change above 25%: Planning Manager", "[DOC:pp.43-44 §10]")
    case "Intercompany price deviation":
      return r(["Controller"], "IC price deviation from the transfer price list: Controller on both sides", "[DOC:p.181 FL-07 field 4]")
    case "Recall external notification":
      return r(["Quality Manager", "Executive"], "External notification text: dual approval Quality Manager + executive (C-52)", "[DOC:p.182 FL-08 field 4]")
    case "EBOM release":
      return r(["Engineering Manager"], "Manager releases; an engineer cannot approve their own EBOM release", "[DOC:p.177; p.255]")
    case "Production version release":
      return r(["Engineering Manager"], "Draft to Released by the Engineering Manager", "[DOC:p.214]")
    case "Price list approval":
      return r(["Pricing Manager"], "Price list Draft to Pending Approval to Active", "[DOC:p.122 §6.1]", { reading: "Approver list is cut in the extraction; routed to Pricing Manager" })
    case "Material change":
      return r(["Materials Manager"], "Owners request, class rules approve", "[DOC:p.245 §3]", { reading: "Class rules are not extracted; routed to Materials Manager" })
    case "Bad debt write-off":
      return r(["Controller"], "Bad debt write-off needs the Controller", "[DOC:pp.176-177 FL-01 field 11]")
    case "Manual info record price":
      return r(["Purchasing Manager"], "Manual info record price above 5% delta: Purchasing Manager", "[DOC:p.247]")
    case "Valuation change":
      return r(["Materials Manager", "Controller"], "Valuation change: Materials Manager, then Controller (released at the period boundary)", "[Book II §5.4]")
    case "Consignment true-up":
      return r(["Controller"], "Consignment true-up to 5215: Controller", "[Book II §14.2]")
    case "Inspection plan approval":
      return r(["Quality Manager"], "Inspection plan approved by the Quality Manager", "[QT-R08]")
    case "Deviation approval":
      return r(["Quality Manager", "Engineering Manager"], "Deviation: Quality Manager + Engineering Manager", "[DOC:p.215 Book IV §7.3]", { reading: "Controller for value above a threshold is not stated (QT-R27)" })
    case "Recall partial recovery":
      return r(["Quality Manager", "Executive"], "Recall closed with partial recovery: Quality Manager + executive", "[QT-R11]")
    case "Final test scrap":
      return r(["Controller", "Engineering Manager"], "Scrap after final test: Controller + Engineering Manager", "[QT-R18]")
    case "Reprint approval":
      return r(["Quality Manager"], "Serial and nameplate reprint: Quality Manager", "[QT-R31]", { reading: "Approver not stated in the PRD" })
    case "RMA disposition":
      return r(["Quality Manager"], "Inspectors propose, Quality Manager approves the disposition", "[DOC:p.253]")
    case "Warranty extension":
      return r(["Customer Service Manager"], "Extend warranty with approval", "[DOC:p.215 §7.4]", { reading: "Approver is not stated; routed to Customer Service Manager" })
    case "Sales change order":
    case "Cancellation fee waiver":
    case "De-peg":
      return r(["Sales Director"], `${kind}: Sales Director`, "[feature list]", { reading: "Approver is not stated for this kind; routed to Sales Director" })
  }
}

const FINANCIAL = new Set<ApprovalKind>([
  "PO approval", "RMA approval", "No-quote sales order", "Credit release", "Below price floor", "Long-lead release",
  "Count variance", "Intercompany price deviation", "Bad debt write-off", "Price change on sales tab",
])

/** Other numeric thresholds the screens need (table F), kept in one place. */
export const THRESHOLDS = {
  rfqRequiredAbove: 25_000, // uncontracted spend [DOC:p.100 §G]
  unconfirmedPoBusinessDays: 3, // [DOC:p.104 §G]
  poPriceDeviationPct: 5, // [DOC:p.104 §G]
  infoRecordInvoiceDeviationPct: 5, // [DOC:p.157 §7.2]
  priceChangePct: 5, // [DOC:pp.28-29 §4]
  huWeightTolerancePct: 2, // [DOC:p.32 §5; p.96 SP-17]
  etoMilestonesPct: [20, 10, 20, 30, 15, 5], // [DOC:p.53 §4.4; p.177]
  budgetaryQuoteTolerancePct: 25, // [DOC:p.50 §3.1]
  budgetaryQuoteValidityDays: 30, // [DOC:p.50 §3.1]
  laborGuardrailPct: 20, // [DOC:pp.78-80]
  woUnsettledBreachDays: 5, // [DOC:p.126; p.179]
  countRecountPct: 2, // [DOC:pp.36-37 §7]
  countRecountAmount: 500, // [DOC:pp.36-37 §7]
  safetyStockChangePct: 25, // [DOC:pp.43-44 §10]
  rmaReceiptToInspectionBusinessDays: 5, // [DOC:pp.26-27 §3.8]
  rmaReopenDays: 30, // [DOC:pp.26-27 §3.8]
  rmaRestockingPct: [15, 10, 0], // [DOC:pp.26-27 §3.10]
  noReferenceCreditListLessPct: 20, // [DOC:pp.26-27 §3.10]
  scarOverdueRestrictsVendor: 2, // [DOC:pp.88-90]
  inspectionTightenRejectedOf5: 2, // [DOC:pp.33-35 §6]
  inspectionReduceAfterAccepted: 10, // [DOC:pp.33-35 §6]
  calibrationAlertDays: [30, 14, 3], // [DOC:p.90]
  capaEffectivenessMinDays: 30, // [DOC:p.88]
  priceFloorPct: { "PC-100": 22, "PC-300": 18 }, // [DOC:p.122 §I6]
  taxNexusAlertPct: 80, // [DOC:pp.45-46 §11]
  offlineQueueHours: 4, // [DOC:p.131 §K4]
} as const
