// Status catalog S-1..S-43, word for word from 40-models/_tentative/erd-sketch.md section 3
// [DOC: pages cited per row] (asserted). Families per 40-models/_tentative/status-encoding-input.md
// F1..F7 (TENTATIVE, OQ-18). Family is chosen per record type and status pair, never per word (C-4).
//
// `main` is the happy path drawn as the lifecycle strip; `exits` are branches and exits drawn apart
// from it (fixes critique F-02: no exit status is drawn after a terminal status).
// A status word not on a record's list is a violation (color.md C-3) - add nothing here without a
// source. Records with no list in the specification (ECR, ECO, MCR, MCH, SCAR, DEV, LLR, RMA line,
// approval request) are deliberately absent: see erd-sketch section 3 "Named lifecycles with no
// status list" and OQ-21.

export type Family = "draft" | "pending" | "active" | "blocked" | "done" | "cancelled" | "exception"
export const FAMILIES: Family[] = ["draft", "pending", "active", "blocked", "done", "cancelled", "exception"]
export const FAMILY_LABEL: Record<Family, string> = {
  draft: "F1 Draft",
  pending: "F2 Pending approval",
  active: "F3 Active or in progress",
  blocked: "F4 Blocked or on hold",
  done: "F5 Done",
  cancelled: "F6 Cancelled or rejected",
  exception: "F7 Exception",
}

interface Def<S extends string> {
  ref: string
  label: string
  statuses: readonly S[]
  main: readonly S[]
  exits?: readonly S[]
  terminal?: readonly S[]
  family: Record<S, Family>
  source: string
}
const def = <const S extends string>(d: Def<S>) => d

export const STATUS = {
  customer: def({
    ref: "S-1", label: "Customer", source: "[DOC:p.49 §2]",
    statuses: ["Prospect", "Active", "On Hold", "Blocked", "Inactive"],
    main: ["Prospect", "Active", "Inactive"], exits: ["On Hold", "Blocked"],
    family: { Prospect: "draft", Active: "active", "On Hold": "blocked", Blocked: "blocked", Inactive: "done" },
  }),
  quotation: def({
    ref: "S-2", label: "Quotation", source: "[DOC:p.51 §3.3]",
    statuses: ["Draft", "Internal Review", "Issued", "Won", "Lost", "Expired", "Superseded"],
    main: ["Draft", "Internal Review", "Issued", "Won"], exits: ["Lost", "Expired", "Superseded"],
    family: { Draft: "draft", "Internal Review": "pending", Issued: "active", Won: "done", Lost: "cancelled", Expired: "done", Superseded: "done" },
  }),
  salesOrder: def({
    ref: "S-3", label: "Sales order", source: "[DOC:p.54 §4.6]",
    // Rejected appears only as an exit from Submitted (OQ-13, K-row in STATE.md).
    statuses: ["Draft", "Submitted", "Credit Hold", "Confirmed", "In Fulfillment", "Partially Shipped", "Shipped", "Invoiced/Closed", "Cancelled", "Rejected"],
    main: ["Draft", "Submitted", "Confirmed", "In Fulfillment", "Partially Shipped", "Shipped", "Invoiced/Closed"],
    exits: ["Credit Hold", "Cancelled", "Rejected"], terminal: ["Invoiced/Closed", "Cancelled"],
    family: { Draft: "draft", Submitted: "pending", "Credit Hold": "blocked", Confirmed: "active", "In Fulfillment": "active", "Partially Shipped": "active", Shipped: "active", "Invoiced/Closed": "done", Cancelled: "cancelled", Rejected: "cancelled" },
  }),
  soLine: def({
    ref: "S-4", label: "Sales order line", source: "[DOC:p.53 §4.2]",
    statuses: ["Open", "In Engineering", "In Production", "Ready to Ship", "Partially Shipped", "Shipped", "Invoiced", "Closed", "Cancelled"],
    main: ["Open", "In Engineering", "In Production", "Ready to Ship", "Partially Shipped", "Shipped", "Invoiced", "Closed"], exits: ["Cancelled"],
    family: { Open: "draft", "In Engineering": "active", "In Production": "active", "Ready to Ship": "active", "Partially Shipped": "active", Shipped: "active", Invoiced: "done", Closed: "done", Cancelled: "cancelled" },
  }),
  scheduleLine: def({
    ref: "S-5", label: "Schedule line", source: "[DOC:p.206 §2]",
    statuses: ["Open", "Confirmed", "Allocated/Pegged", "Delivery Due", "Partially Delivered", "Delivered", "Closed", "Cancelled"],
    main: ["Open", "Confirmed", "Allocated/Pegged", "Delivery Due", "Partially Delivered", "Delivered", "Closed"], exits: ["Cancelled"],
    family: { Open: "draft", Confirmed: "active", "Allocated/Pegged": "active", "Delivery Due": "active", "Partially Delivered": "active", Delivered: "active", Closed: "done", Cancelled: "cancelled" },
  }),
  delivery: def({
    ref: "S-6", label: "Delivery", source: "[DOC:p.207 §2.4; p.208]",
    statuses: ["Planned", "Released", "Picking", "Packed", "Quality Cleared", "Loaded", "PGI", "Delivered/Closed"],
    main: ["Planned", "Released", "Picking", "Packed", "Quality Cleared", "Loaded", "PGI", "Delivered/Closed"],
    family: { Planned: "draft", Released: "active", Picking: "active", Packed: "active", "Quality Cleared": "active", Loaded: "active", PGI: "active", "Delivered/Closed": "done" },
  }),
  pod: def({
    ref: "S-7", label: "POD", source: "[DOC:p.207 §2.4]",
    statuses: ["Expected", "Received", "Exception", "Resolved/Closed"],
    main: ["Expected", "Received", "Resolved/Closed"], exits: ["Exception"],
    family: { Expected: "draft", Received: "active", Exception: "exception", "Resolved/Closed": "done" },
  }),
  handlingUnit: def({
    ref: "S-8", label: "Handling unit", source: "[DOC:p.31 §5; p.208]",
    statuses: ["Open", "Closed", "Loaded", "Shipped"],
    main: ["Open", "Closed", "Loaded", "Shipped"],
    family: { Open: "active", Closed: "active", Loaded: "active", Shipped: "active" },
  }),
  rma: def({
    ref: "S-9", label: "RMA", source: "[DOC:p.26 §3.8]",
    // Closed Short and Reopened are transition-only names (K-14); not statuses here.
    statuses: ["Draft", "Pending Approval", "Authorized", "Partially Received", "Received", "In Inspection", "Disposition Pending", "Settling", "Closed", "Rejected", "Cancelled"],
    main: ["Draft", "Pending Approval", "Authorized", "Partially Received", "Received", "In Inspection", "Disposition Pending", "Settling", "Closed"],
    exits: ["Rejected", "Cancelled"], terminal: ["Rejected", "Cancelled"],
    family: { Draft: "draft", "Pending Approval": "pending", Authorized: "pending", "Partially Received": "active", Received: "active", "In Inspection": "active", "Disposition Pending": "pending", Settling: "active", Closed: "done", Rejected: "cancelled", Cancelled: "cancelled" },
  }),
  warrantyClaim: def({
    ref: "S-10", label: "RMA warranty claim badge", source: "[DOC:p.22 §3.3]",
    statuses: ["Yes", "No", "Approved", "Denied"],
    main: ["Yes", "Approved"], exits: ["No", "Denied"],
    family: { Yes: "exception", No: "exception", Approved: "exception", Denied: "exception" },
  }),
  installedBase: def({
    ref: "S-11", label: "Installed base record", source: "[DOC:p.215 §7.4]",
    statuses: ["Shipped", "Installed", "In Service", "Returned", "Scrapped"],
    main: ["Shipped", "Installed", "In Service"], exits: ["Returned", "Scrapped"],
    family: { Shipped: "active", Installed: "active", "In Service": "active", Returned: "done", Scrapped: "done" },
  }),
  engineeringRequest: def({
    ref: "S-12", label: "Engineering request", source: "[DOC:p.59 §2]",
    statuses: ["Open", "In Design", "Customer Review", "Released", "Closed", "Blocked"],
    main: ["Open", "In Design", "Customer Review", "Released", "Closed"], exits: ["Blocked"],
    family: { Open: "draft", "In Design": "active", "Customer Review": "pending", Released: "active", Closed: "done", Blocked: "blocked" },
  }),
  ebom: def({
    ref: "S-13", label: "EBOM", source: "[DOC:p.61 §3.4]",
    statuses: ["Draft", "In Review", "Released", "Superseded", "Obsolete"],
    main: ["Draft", "In Review", "Released", "Superseded", "Obsolete"],
    family: { Draft: "draft", "In Review": "pending", Released: "active", Superseded: "done", Obsolete: "done" },
  }),
  mbom: def({
    ref: "S-14", label: "MBOM", source: "[DOC:p.66 §6]",
    statuses: ["Active", "Superseded"], main: ["Active", "Superseded"],
    family: { Active: "active", Superseded: "done" },
  }),
  routing: def({
    ref: "S-15", label: "Routing", source: "[DOC:p.73]",
    statuses: ["Draft", "In Review", "Released", "Superseded"], main: ["Draft", "In Review", "Released", "Superseded"],
    family: { Draft: "draft", "In Review": "pending", Released: "active", Superseded: "done" },
  }),
  document: def({
    ref: "S-16", label: "Document", source: "[DOC:p.64 §5.2]",
    statuses: ["WIP", "In Review", "Released", "Superseded", "Obsolete"], main: ["WIP", "In Review", "Released", "Superseded", "Obsolete"],
    family: { WIP: "draft", "In Review": "pending", Released: "active", Superseded: "done", Obsolete: "done" },
  }),
  releaseLevel: def({
    ref: "S-17", label: "Design package release level", source: "[DOC:pp.208-209 §3.1]",
    statuses: ["Concept", "Preliminary / RFQ Package", "Long-Lead Purchase Release (LLR)", "Approved for Purchase", "Released for Production", "Superseded / Obsolete"],
    main: ["Concept", "Preliminary / RFQ Package", "Long-Lead Purchase Release (LLR)", "Approved for Purchase", "Released for Production", "Superseded / Obsolete"],
    family: { Concept: "draft", "Preliminary / RFQ Package": "active", "Long-Lead Purchase Release (LLR)": "active", "Approved for Purchase": "active", "Released for Production": "active", "Superseded / Obsolete": "done" },
  }),
  productionVersion: def({
    ref: "S-18", label: "Production version", source: "[DOC:p.214]",
    statuses: ["Draft", "Released", "Superseded/Obsolete"], main: ["Draft", "Released", "Superseded/Obsolete"],
    family: { Draft: "draft", Released: "active", "Superseded/Obsolete": "done" },
  }),
  stpAck: def({
    ref: "S-19", label: "STP vendor acknowledgement", source: "[DOC:p.209 §3.3]",
    statuses: ["Acknowledged", "Exception", "Rejected"], main: ["Acknowledged"], exits: ["Exception", "Rejected"],
    family: { Acknowledged: "active", Exception: "exception", Rejected: "cancelled" },
  }),
  workCenter: def({
    ref: "S-20", label: "Work center", source: "[DOC:p.71]",
    statuses: ["Active", "Maintenance", "Inactive"], main: ["Active", "Inactive"], exits: ["Maintenance"],
    family: { Active: "active", Maintenance: "blocked", Inactive: "done" },
  }),
  productionOrder: def({
    ref: "S-21", label: "Production order", source: "[DOC:pp.74-75 §5.3; p.76; p.87]",
    statuses: ["Created", "Released", "In Progress", "Testing", "Completed", "Closed (TECO)", "On Hold", "Cancelled"],
    main: ["Created", "Released", "In Progress", "Testing", "Completed", "Closed (TECO)"], exits: ["On Hold", "Cancelled"], terminal: ["Cancelled"],
    family: { Created: "draft", Released: "active", "In Progress": "active", Testing: "active", Completed: "active", "Closed (TECO)": "done", "On Hold": "blocked", Cancelled: "cancelled" },
  }),
  reworkOrder: def({
    ref: "S-22", label: "Rework order", source: "[DOC:p.79]",
    statuses: ["Open", "In Progress", "Completed", "Settled"], main: ["Open", "In Progress", "Completed", "Settled"],
    family: { Open: "draft", "In Progress": "active", Completed: "active", Settled: "done" },
  }),
  warehouseTask: def({
    ref: "S-23", label: "Warehouse task", source: "[DOC:p.215 §7.2]",
    statuses: ["Queued", "Assigned", "In Progress", "Done/Exception"], main: ["Queued", "Assigned", "In Progress", "Done/Exception"],
    family: { Queued: "draft", Assigned: "active", "In Progress": "active", "Done/Exception": "done" },
  }),
  inspectionPlan: def({
    ref: "S-24", label: "Inspection plan", source: "[DOC:p.34 §6.4]",
    statuses: ["Draft", "In Review", "Active", "Superseded", "Obsolete"], main: ["Draft", "In Review", "Active", "Superseded"], exits: ["Obsolete"], terminal: ["Superseded", "Obsolete"],
    family: { Draft: "draft", "In Review": "pending", Active: "active", Superseded: "done", Obsolete: "done" },
  }),
  capa: def({
    ref: "S-25", label: "CAPA", source: "[DOC:p.88]",
    statuses: ["Open", "Analysis", "Actions In Progress", "Implemented", "Effectiveness Check", "Closed", "Reopened"],
    main: ["Open", "Analysis", "Actions In Progress", "Implemented", "Effectiveness Check", "Closed"], exits: ["Reopened"],
    family: { Open: "draft", Analysis: "active", "Actions In Progress": "active", Implemented: "active", "Effectiveness Check": "active", Closed: "done", Reopened: "exception" },
  }),
  instrument: def({
    ref: "S-26", label: "Calibration instrument", source: "[DOC:p.90]",
    statuses: ["In Cal", "Due Soon", "Overdue", "Out of Service"], main: ["In Cal", "Due Soon", "Overdue"], exits: ["Out of Service"],
    family: { "In Cal": "active", "Due Soon": "blocked", Overdue: "blocked", "Out of Service": "blocked" },
  }),
  recall: def({
    ref: "S-27", label: "Recall campaign", source: "[DOC:p.182 FL-08]",
    statuses: ["Identify", "Contain", "Notify", "Recover", "Disposition", "Effectiveness", "Closed"],
    main: ["Identify", "Contain", "Notify", "Recover", "Disposition", "Effectiveness", "Closed"],
    family: { Identify: "draft", Contain: "active", Notify: "active", Recover: "active", Disposition: "active", Effectiveness: "active", Closed: "done" },
  }),
  stock: def({
    ref: "S-28", label: "Stock status", source: "[DOC:pp.84-85]",
    statuses: ["Unrestricted", "QI Hold", "Blocked", "Quarantine"], main: ["QI Hold", "Unrestricted"], exits: ["Blocked", "Quarantine"],
    family: { Unrestricted: "active", "QI Hold": "blocked", Blocked: "blocked", Quarantine: "blocked" },
  }),
  serial: def({
    ref: "S-29", label: "Serial status", source: "[DOC:p.95; p.32; p.208]",
    statuses: ["Available", "QI Hold", "In Production", "Reserved", "Picked", "Shipped"],
    main: ["Available", "In Production", "Reserved", "Picked", "Shipped"], exits: ["QI Hold"],
    family: { Available: "active", "QI Hold": "blocked", "In Production": "active", Reserved: "active", Picked: "active", Shipped: "active" },
  }),
  vendorOnboarding: def({
    ref: "S-30", label: "Vendor onboarding", source: "[DOC:p.101 §2.1]",
    statuses: ["Draft", "Docs Pending", "Under Review", "Active"], main: ["Draft", "Docs Pending", "Under Review", "Active"],
    family: { Draft: "draft", "Docs Pending": "pending", "Under Review": "pending", Active: "active" },
  }),
  vendorQuality: def({
    ref: "S-31", label: "Vendor quality approval", source: "[DOC:p.101 §2.1]",
    statuses: ["Approved", "Conditional", "Restricted", "Disqualified"], main: ["Approved"], exits: ["Conditional", "Restricted", "Disqualified"],
    family: { Approved: "active", Conditional: "blocked", Restricted: "blocked", Disqualified: "cancelled" },
  }),
  avl: def({
    ref: "S-32", label: "AVL qualification", source: "[DOC:p.101 §2.2]",
    statuses: ["Qualified", "Conditional", "Suspended"], main: ["Conditional", "Qualified"], exits: ["Suspended"],
    family: { Qualified: "active", Conditional: "blocked", Suspended: "blocked" },
  }),
  requisition: def({
    ref: "S-33", label: "Purchase requisition", source: "[DOC:p.102 §3]",
    statuses: ["Open", "In Approval", "Approved", "Converted", "Rejected", "Cancelled"],
    main: ["Open", "In Approval", "Approved", "Converted"], exits: ["Rejected", "Cancelled"],
    family: { Open: "draft", "In Approval": "pending", Approved: "pending", Converted: "done", Rejected: "cancelled", Cancelled: "cancelled" },
  }),
  rfq: def({
    ref: "S-34", label: "RFQ", source: "[DOC:p.103 §4]",
    statuses: ["Draft", "Issued", "Responses In", "Awarded", "Cancelled"], main: ["Draft", "Issued", "Responses In", "Awarded"], exits: ["Cancelled"],
    family: { Draft: "draft", Issued: "active", "Responses In": "active", Awarded: "done", Cancelled: "cancelled" },
  }),
  purchaseOrder: def({
    ref: "S-35", label: "Purchase order", source: "[DOC:p.104 §5.1]",
    // "Change Pending" is an overlay chip (C-5), not a status.
    statuses: ["Draft", "In Approval", "Approved", "Sent", "Confirmed", "Partially Received", "Received", "Matched/Closed", "Cancelled"],
    main: ["Draft", "In Approval", "Approved", "Sent", "Confirmed", "Partially Received", "Received", "Matched/Closed"], exits: ["Cancelled"],
    family: { Draft: "draft", "In Approval": "pending", Approved: "pending", Sent: "active", Confirmed: "active", "Partially Received": "active", Received: "active", "Matched/Closed": "done", Cancelled: "cancelled" },
  }),
  poLine: def({
    ref: "S-36", label: "PO line", source: "[DOC:p.104 §5.2]",
    statuses: ["Open", "Partial", "Received", "Closed", "Cancelled"], main: ["Open", "Partial", "Received", "Closed"], exits: ["Cancelled"],
    family: { Open: "draft", Partial: "active", Received: "active", Closed: "done", Cancelled: "cancelled" },
  }),
  costCenter: def({
    ref: "S-37", label: "Cost center / profit center", source: "[DOC:p.111]",
    statuses: ["Active", "Blocked", "Inactive"], main: ["Active", "Inactive"], exits: ["Blocked"],
    family: { Active: "active", Blocked: "blocked", Inactive: "done" },
  }),
  costEstimate: def({
    ref: "S-38", label: "Cost estimate", source: "[DOC:p.119 §3.1]",
    statuses: ["Draft", "Released", "Superseded"], main: ["Draft", "Released", "Superseded"],
    family: { Draft: "draft", Released: "active", Superseded: "done" },
  }),
  priceList: def({
    ref: "S-39", label: "Price list", source: "[DOC:p.122 §6.1]",
    statuses: ["Draft", "Pending Approval", "Active", "Archived"], main: ["Draft", "Pending Approval", "Active", "Archived"],
    family: { Draft: "draft", "Pending Approval": "pending", Active: "active", Archived: "done" },
  }),
  countDocument: def({
    ref: "S-40", label: "Count document", source: "[DOC:p.36 §7.2]",
    statuses: ["Generated", "Assigned", "Counting", "Submitted", "Recount", "Variance Review", "Approved", "Posted", "Void"],
    main: ["Generated", "Assigned", "Counting", "Submitted", "Variance Review", "Approved", "Posted"], exits: ["Recount", "Void"], terminal: ["Posted", "Void"],
    family: { Generated: "draft", Assigned: "active", Counting: "active", Submitted: "pending", Recount: "active", "Variance Review": "pending", Approved: "pending", Posted: "done", Void: "cancelled" },
  }),
  fiscalPeriod: def({
    ref: "S-41", label: "Fiscal period", source: "[DOC:p.41 §9.1; p.42 §9.3]",
    statuses: ["Open", "Soft Close", "Hard Close", "Year-End Closed"], main: ["Open", "Soft Close", "Hard Close", "Year-End Closed"],
    family: { Open: "active", "Soft Close": "active", "Hard Close": "done", "Year-End Closed": "done" },
  }),
  material: def({
    ref: "S-42", label: "Material lifecycle", source: "[DOC:p.149 §4.1]",
    // Deleted and Rejected are transition-only names (K-16); not statuses here.
    statuses: ["Draft", "Data Completion", "Active", "Restricted", "Blocked", "Obsolete"],
    main: ["Draft", "Data Completion", "Active", "Obsolete"], exits: ["Restricted", "Blocked"], terminal: ["Obsolete"],
    family: { Draft: "draft", "Data Completion": "pending", Active: "active", Restricted: "blocked", Blocked: "blocked", Obsolete: "done" },
  }),
  materialBlock: def({
    ref: "S-43", label: "Material function-specific block (chip)", source: "[DOC:p.151 §4.5]",
    statuses: ["Purchasing Block", "Sales Block", "Production Block", "Shipping Block", "Posting Block"],
    main: ["Purchasing Block", "Sales Block", "Production Block", "Shipping Block", "Posting Block"],
    family: { "Purchasing Block": "blocked", "Sales Block": "blocked", "Production Block": "blocked", "Shipping Block": "blocked", "Posting Block": "blocked" },
  }),
} as const

export type RecordKind = keyof typeof STATUS
export type StatusOf<K extends RecordKind> = (typeof STATUS)[K]["statuses"][number]

// Named unions, PRD names verbatim.
export type CustomerStatus = StatusOf<"customer">
export type QuotationStatus = StatusOf<"quotation">
export type SalesOrderStatus = StatusOf<"salesOrder">
export type SoLineStatus = StatusOf<"soLine">
export type ScheduleLineStatus = StatusOf<"scheduleLine">
export type DeliveryStatus = StatusOf<"delivery">
export type PodStatus = StatusOf<"pod">
export type HandlingUnitStatus = StatusOf<"handlingUnit">
export type RmaStatus = StatusOf<"rma">
export type WarrantyClaimBadge = StatusOf<"warrantyClaim">
export type InstalledBaseStatus = StatusOf<"installedBase">
export type EngineeringRequestStatus = StatusOf<"engineeringRequest">
export type EbomStatus = StatusOf<"ebom">
export type MbomStatus = StatusOf<"mbom">
export type RoutingStatus = StatusOf<"routing">
export type DocumentStatus = StatusOf<"document">
export type ReleaseLevel = StatusOf<"releaseLevel">
export type ProductionVersionStatus = StatusOf<"productionVersion">
export type StpAckStatus = StatusOf<"stpAck">
export type WorkCenterStatus = StatusOf<"workCenter">
export type ProductionOrderStatus = StatusOf<"productionOrder">
export type ReworkOrderStatus = StatusOf<"reworkOrder">
export type WarehouseTaskStatus = StatusOf<"warehouseTask">
export type InspectionPlanStatus = StatusOf<"inspectionPlan">
export type CapaStatus = StatusOf<"capa">
export type InstrumentStatus = StatusOf<"instrument">
export type RecallStage = StatusOf<"recall">
export type StockStatus = StatusOf<"stock">
export type SerialStatus = StatusOf<"serial">
export type VendorOnboardingStatus = StatusOf<"vendorOnboarding">
export type VendorQualityStatus = StatusOf<"vendorQuality">
export type AvlStatus = StatusOf<"avl">
export type RequisitionStatus = StatusOf<"requisition">
export type RfqStatus = StatusOf<"rfq">
export type PurchaseOrderStatus = StatusOf<"purchaseOrder">
export type PoLineStatus = StatusOf<"poLine">
export type CostCenterStatus = StatusOf<"costCenter">
export type CostEstimateStatus = StatusOf<"costEstimate">
export type PriceListStatus = StatusOf<"priceList">
export type CountDocumentStatus = StatusOf<"countDocument">
export type FiscalPeriodStatus = StatusOf<"fiscalPeriod">
export type MaterialStatus = StatusOf<"material">
export type MaterialBlock = StatusOf<"materialBlock">

/** Genealogy event correction status [DOC:p.212 §4.2] (asserted). Not an S-row; listed in table E. */
export type GenealogyCorrection = "Active" | "Reversed" | "Replacement"

/** Family for a record type and status pair; undefined when the word is not on that record's list. */
export function familyOf(kind: RecordKind, status: string): Family | undefined {
  return (STATUS[kind].family as Record<string, Family>)[status]
}
export function isStatusOf<K extends RecordKind>(kind: K, status: string): status is StatusOf<K> {
  return (STATUS[kind].statuses as readonly string[]).includes(status)
}
export function isTerminal(kind: RecordKind, status: string): boolean {
  const d = STATUS[kind] as Def<string>
  if (d.terminal) return d.terminal.includes(status)
  const f = familyOf(kind, status)
  return f === "done" || f === "cancelled"
}
