// Seed data for the feature-list screens of purchasing-finance. All fictitious (GUARDRAILS 7). Values the
// PRD does not give (prices, dates, registration numbers, budgets) are design values and are labelled so
// on the screens that show them.

import type { CostCenterId, UserId, VendorId } from "@/data/domain"
import type {
  AltHierarchy, AvlProposal, BidVersion, BudgetLine, ContractRec, DriverRate, DriverTemplate, FloorBreach, HierMove, InfoRec, ItemFloor, RfqScoring, ScoreHistory, SkfChange,
  SourceRow, SupDevRec, VendorTaxProfile,
} from "./xtypes"

const BUYER_A: UserId = "USR-TBD-039"
const BUYER_B: UserId = "USR-TBD-040"
const PM: UserId = "USR-TBD-041"
const COST_ACC: UserId = "USR-TBD-011"
const CONTROLLER: UserId = "USR-TBD-009"
const ANALYST: UserId = "USR-TBD-012"
const PRICING: UserId = "USR-TBD-006"

// ===================================================================== info records (Book II §7.2)
const ir = (n: number, itemId: InfoRec["itemId"], vendorId: VendorId, price: number, unit: string, validFrom: string, source: InfoRec["source"], leadDays: number, extra: Partial<InfoRec> = {}): InfoRec => ({
  id: `IR-00${4200 + n}`, itemId, vendorId, price, unit, currency: "USD", validFrom, scales: [], source, leadDays, status: "Active", ...extra,
})
export const SEED_INFO_RECORDS: InfoRec[] = ([
  ir(1, "RAW-TBD-CRGO23", "VEN-TBD-0101", 3.85, "kg", "2026-01-01", "Contract", 45, { ref: "CTR-TBD-0001", moq: 5000, scales: [{ fromQty: 0, price: 3.9 }, { fromQty: 20000, price: 3.85 }, { fromQty: 100000, price: 3.8 }] }),
  ir(2, "RAW-TBD-CTC", "VEN-TBD-0102", 13.4, "kg", "2026-01-12", "Manual", 28, { ref: "Approved by Purchasing Manager 2026-01-12", moq: 2000, scales: [{ fromQty: 0, price: 13.4 }, { fromQty: 50000, price: 13.1 }] }),
  ir(3, "RAW-TBD-OLTC", "VEN-TBD-0103", 74500, "EA", "2026-02-10", "RFQ Award", 70, { ref: "RFQ-TBD-0301" }),
  ir(4, "RAW-TBD-BSH145", "VEN-TBD-0104", 18900, "EA", "2026-02-12", "RFQ Award", 90, { ref: "Award 2026-02 (STP-000302 basis)" }),
  { ...ir(5, "RAW-TBD-OIL", "VEN-TBD-0105", 1.95, "L", "2026-01-01", "Manual", 14), validTo: "2026-08-31", status: "Expired" as const },
  ir(6, "RAW-TBD-OIL", "VEN-TBD-0105", 1.92, "L", "2026-09-01", "Contract", 14, { ref: "CTR-TBD-0002", id: "IR-004216" as const }),
  ir(7, "RAW-TBD-PLATE", "VEN-TBD-0106", 1.36, "kg", "2026-01-01", "Manual", 21, { ref: "Approved by Purchasing Manager 2026-01-05", moq: 10000 }),
  ir(8, "RAW-TBD-BSH015", "VEN-TBD-0112", 1240, "EA", "2026-01-01", "Manual", 49, { status: "Blocked", ref: "Vendor Restricted; AVL Suspended cascades here" }),
  ir(9, "RAW-TBD-BSH015", "VEN-TBD-0104", 1265, "EA", "2026-03-01", "Manual", 56),
  { ...ir(10, "RAW-TBD-KRAFT", "VEN-TBD-0107", 11.7, "kg", "2026-01-01", "Contract", 30, { ref: "CTR-TBD-0003" }), currency: "CAD" },
  ir(11, "RAW-TBD-RAD", "VEN-TBD-0108", 2380, "EA", "2026-07-01", "Contract", 56, { ref: "CTR-TBD-0004" }),
  ir(12, "RAW-TBD-FOIL", "VEN-TBD-0102", 12.1, "kg", "2026-03-20", "RFQ Award", 21, { ref: "RFQ-TBD-0379", moq: 1000 }),
] as InfoRec[])

// ===================================================================== source lists (Book II §7.4)
export const SEED_SOURCE_ROWS: SourceRow[] = [
  { id: "SL-TBD-001", itemId: "RAW-TBD-CRGO23", vendorId: "VEN-TBD-0101", validFrom: "2026-01-01", validTo: "2026-12-31", fixed: true, blocked: false, mrpRelevant: true, note: "Fixed source for the 2026 contract" },
  { id: "SL-TBD-002", itemId: "RAW-TBD-OIL", vendorId: "VEN-TBD-0105", validFrom: "2026-01-01", validTo: "2027-08-31", fixed: true, blocked: false, mrpRelevant: true, note: "Fixed source under the scheduling agreement" },
  { id: "SL-TBD-003", itemId: "PACK-TBD-SKID", vendorId: "VEN-TBD-0109", validFrom: "2026-10-01", validTo: "2026-12-31", fixed: false, blocked: true, mrpRelevant: false, note: "Commercial embargo: tariff dispute under legal review" },
  { id: "SL-TBD-004", itemId: "CONS-TBD-WELD", vendorId: "VEN-TBD-0106", validFrom: "2026-10-01", validTo: "2026-12-31", fixed: false, blocked: true, mrpRelevant: false, note: "Commercial embargo: supplier of this wire is under export-control review" },
  { id: "SL-TBD-005", itemId: "RAW-TBD-RAD", vendorId: "VEN-TBD-0108", validFrom: "2026-07-01", validTo: "2027-06-30", fixed: true, blocked: false, mrpRelevant: true, note: "Fixed source under the extended contract" },
]

// ===================================================================== contracts and scheduling agreements
export const SEED_CONTRACTS: ContractRec[] = [
  { id: "CTR-TBD-0001", kind: "Contract", title: "Northstar Electrical Steel: CRGO 0.23 mm, 2026 price agreement", vendorId: "VEN-TBD-0101", currency: "USD", validFrom: "2026-01-01", validTo: "2026-12-31", state: "Active",
    items: [{ itemId: "RAW-TBD-CRGO23", unit: "kg", targetQty: 600000, surchargeIndex: "CRGO basis $/kg", scales: [{ fromQty: 0, price: 3.9 }, { fromQty: 20000, price: 3.85 }, { fromQty: 100000, price: 3.8 }] }],
    releases: [{ no: 1, itemId: "RAW-TBD-CRGO23", qty: 20000, date: "2026-10-20", state: "Released", poId: "PO-TBD-0316", poLine: 10 }, { no: 2, itemId: "RAW-TBD-CRGO23", qty: 54000, date: "2026-12-15", state: "Released", poId: "PO-TBD-0377", poLine: 10 }],
    createdOn: "2025-12-18", createdBy: BUYER_A, history: [{ on: "2025-12-18", by: BUYER_A, text: "Created from RFQ price review" }, { on: "2026-01-02", by: PM, text: "Activated" }] },
  { id: "CTR-TBD-0002", kind: "Scheduling agreement", title: "Great Lakes Dielectric Oils: transformer oil scheduling agreement", vendorId: "VEN-TBD-0105", currency: "USD", validFrom: "2026-09-01", validTo: "2027-08-31", state: "Active",
    items: [{ itemId: "RAW-TBD-OIL", unit: "L", targetQty: 720000, scales: [{ fromQty: 0, price: 1.92 }] }],
    releases: [
      { no: 1, itemId: "RAW-TBD-OIL", qty: 20000, date: "2026-10-06", state: "Released", poId: "PO-TBD-0311", poLine: 10 },
      { no: 2, itemId: "RAW-TBD-OIL", qty: 20000, date: "2026-11-03", state: "Released", poId: "PO-TBD-0311", poLine: 10 },
      { no: 3, itemId: "RAW-TBD-OIL", qty: 20000, date: "2026-12-01", state: "Released", poId: "PO-TBD-0311", poLine: 10 },
      { no: 4, itemId: "RAW-TBD-OIL", qty: 60000, date: "2027-01-05", state: "Planned" },
      { no: 5, itemId: "RAW-TBD-OIL", qty: 60000, date: "2027-02-02", state: "Planned" },
    ],
    createdOn: "2026-08-20", createdBy: BUYER_B, history: [{ on: "2026-08-20", by: BUYER_B, text: "Created; replaces the manual info record IR-004205" }, { on: "2026-08-28", by: PM, text: "Activated" }] },
  { id: "CTR-TBD-0003", kind: "Contract", title: "Laurentian Insulation Papers: kraft and pressboard 2026 (CAD)", vendorId: "VEN-TBD-0107", currency: "CAD", validFrom: "2026-01-01", validTo: "2026-12-31", state: "Active",
    items: [{ itemId: "RAW-TBD-KRAFT", unit: "kg", targetQty: 40000, scales: [{ fromQty: 0, price: 11.7 }] }],
    releases: [{ no: 1, itemId: "RAW-TBD-KRAFT", qty: 9500, date: "2026-09-30", state: "Delivered", poId: "PO-TBD-0313", poLine: 10 }],
    createdOn: "2025-12-10", createdBy: BUYER_B, history: [{ on: "2025-12-10", by: BUYER_B, text: "Created" }, { on: "2026-01-02", by: PM, text: "Activated" }] },
  { id: "CTR-TBD-0004", kind: "Contract", title: "Heartland Radiator Works: radiator banks, extension to June 2027", vendorId: "VEN-TBD-0108", currency: "USD", validFrom: "2026-07-01", validTo: "2027-06-30", state: "Active",
    items: [{ itemId: "RAW-TBD-RAD", unit: "EA", targetQty: 160, scales: [{ fromQty: 0, price: 2380 }] }],
    releases: [{ no: 1, itemId: "RAW-TBD-RAD", qty: 40, date: "2026-10-02", state: "Released", poId: "PO-TBD-0328", poLine: 10 }, { no: 2, itemId: "RAW-TBD-RAD", qty: 24, date: "2026-11-26", state: "Released", poId: "PO-TBD-0314", poLine: 10 }],
    createdOn: "2026-06-24", createdBy: BUYER_B, history: [{ on: "2026-06-24", by: BUYER_B, text: "Created; RFQ-TBD-0388 cancelled because of this extension" }, { on: "2026-06-30", by: PM, text: "Activated" }] },
  { id: "CTR-TBD-0005", kind: "Contract", title: "Keystone Copper Conductors: CTC annual blanket 2027", vendorId: "VEN-TBD-0102", currency: "USD", validFrom: "2027-01-01", validTo: "2027-12-31", state: "Draft",
    items: [{ itemId: "RAW-TBD-CTC", unit: "kg", targetQty: 85000, surchargeIndex: "COMEX copper $/lb", scales: [{ fromQty: 0, price: 13.4 }, { fromQty: 50000, price: 13.1 }] }],
    releases: [{ no: 1, itemId: "RAW-TBD-CTC", qty: 21250, date: "2027-01-04", state: "Planned" }, { no: 2, itemId: "RAW-TBD-CTC", qty: 21250, date: "2027-04-05", state: "Planned" }],
    createdOn: "2026-10-01", createdBy: BUYER_A, history: [{ on: "2026-10-01", by: BUYER_A, text: "Created from the PO-TBD-0317 blanket draft" }] },
  { id: "CTR-TBD-0006", kind: "Contract", title: "Prairie Plate & Fab: tank plate A572, 2025 price agreement", vendorId: "VEN-TBD-0106", currency: "USD", validFrom: "2025-01-01", validTo: "2025-12-31", state: "Expired",
    items: [{ itemId: "RAW-TBD-PLATE", unit: "kg", targetQty: 300000, scales: [{ fromQty: 0, price: 1.31 }] }], releases: [],
    createdOn: "2024-12-12", createdBy: BUYER_A, history: [{ on: "2024-12-12", by: BUYER_A, text: "Created" }, { on: "2025-01-03", by: PM, text: "Activated" }, { on: "2026-01-01", by: BUYER_A, text: "Expired at end of validity" }] },
]

// ===================================================================== supplier deviations
const none = { state: "Pending" as const }
export const SEED_DEVIATIONS: SupDevRec[] = [
  { id: "SDV-TBD-0001", vendorId: "VEN-TBD-0104", rfqId: "RFQ-TBD-0397", stpId: "STP-000303", characteristic: "Flange gasket compound", kind: "Alternate", original: "FKM, compression-set test per lot", proposed: "EPDM, compression-set test per shipment",
    reason: "FKM compound lead time is 18 weeks; EPDM is in stock", attachments: ["HPP-gasket-EPDM-datasheet.pdf"], priceDelta: -240, leadDaysDelta: -35, submittedOn: "2026-10-08", submittedBy: "Vendor portal", engineering: none, quality: none,
    activity: [{ at: "2026-10-08", by: "System", text: "Submitted by the vendor; routed to Engineering and Quality" }] },
  { id: "SDV-TBD-0002", vendorId: "VEN-TBD-0104", poId: "PO-TBD-0302", poLine: 10, stpId: "STP-000302", characteristic: "Creepage distance", kind: "Concession", original: "3,650 mm minimum", proposed: "3,625 mm on 2 of 9 units",
    reason: "Two units measured 25 mm short after glaze firing; electrical type test passed", attachments: ["HPP-creepage-report.pdf", "HPP-type-test-0302.pdf"], submittedOn: "2026-04-08", submittedBy: "Vendor portal",
    engineering: { state: "Accepted", by: "USR-TBD-024", on: "2026-04-09", note: "Dielectric margin adequate for the 145 kV class" }, quality: { state: "Accepted", by: "USR-TBD-037", on: "2026-04-10", note: "Accepted for these two serials only" },
    activity: [{ at: "2026-04-08", by: "System", text: "Submitted by the vendor" }, { at: "2026-04-09", by: "Engineering", text: "Accepted" }, { at: "2026-04-10", by: "Quality", text: "Accepted for two serials" }] },
  { id: "SDV-TBD-0003", vendorId: "VEN-TBD-0103", poId: "PO-TBD-0378", poLine: 10, stpId: "STP-000304", characteristic: "Cable box length", kind: "Deviation", original: "620 mm", proposed: "740 mm",
    reason: "Hokuriku-style cable box fitted to match the revised terminal board", attachments: ["RTC-cablebox-drawing-rev-D.pdf"], leadDaysDelta: 0, submittedOn: "2026-10-09", submittedBy: "Vendor portal",
    engineering: { state: "Accepted", by: "USR-TBD-024", on: "2026-10-09", note: "Tank cover clearance checked: fits" }, quality: none,
    activity: [{ at: "2026-10-09", by: "System", text: "Submitted by the vendor" }, { at: "2026-10-09", by: "Engineering", text: "Accepted; waiting for Quality" }] },
  { id: "SDV-TBD-0004", vendorId: "VEN-TBD-0112", poId: "PO-TBD-0321", poLine: 10, stpId: "STP-000305", characteristic: "Terminal plating", kind: "Alternate", original: "Silver-plated copper", proposed: "Tin-plated copper",
    reason: "Silver surcharge", attachments: [], priceDelta: -85, submittedOn: "2026-09-12", submittedBy: BUYER_B,
    engineering: { state: "Accepted", by: "USR-TBD-024", on: "2026-09-14", note: "Acceptable electrically" }, quality: { state: "Rejected", by: "USR-TBD-037", on: "2026-09-15", note: "Open SCARs on this vendor; tin plating not qualified in the PPAP-lite file" },
    activity: [{ at: "2026-09-12", by: "Buyer", text: "Recorded on the vendor's behalf" }, { at: "2026-09-15", by: "Quality", text: "Rejected" }] },
  { id: "SDV-TBD-0005", vendorId: "VEN-TBD-0101", poId: "PO-TBD-0377", poLine: 10, characteristic: "Lamination thickness tolerance", kind: "Alternate", original: "0.23 mm +/- 0.02", proposed: "0.23 mm +/- 0.03", reason: "Mill coil run", attachments: [],
    submittedOn: "2026-10-06", submittedBy: "Vendor portal", engineering: none, quality: none, withdrawn: true,
    activity: [{ at: "2026-10-06", by: "System", text: "Submitted by the vendor" }, { at: "2026-10-07", by: "Vendor portal", text: "Withdrawn by the vendor (mill found conforming coils)" }] },
  { id: "SDV-TBD-0006", vendorId: "VEN-TBD-0123", rfqId: "RFQ-TBD-0397", stpId: "STP-000303", characteristic: "Flange material", kind: "Alternate", original: "Cast aluminium alloy 356", proposed: "Stainless 304 flange", reason: "Corrosion resistance claim",
    attachments: ["PIB-flange-alt.pdf"], priceDelta: 410, leadDaysDelta: 14, submittedOn: "2026-10-08", submittedBy: "Vendor portal",
    engineering: { state: "Rejected", by: "USR-TBD-024", on: "2026-10-09", note: "Changes the verified clamp design" }, quality: none,
    activity: [{ at: "2026-10-08", by: "System", text: "Submitted by the vendor" }, { at: "2026-10-09", by: "Engineering", text: "Rejected" }] },
]

// ===================================================================== AVL proposals
export const SEED_AVL_PROPOSALS: AvlProposal[] = [
  { id: "AVP-TBD-001", avlId: "AVL-TBD-0004", vendorId: "VEN-TBD-0104", itemId: "RAW-TBD-BSH145", to: "Conditional", reason: "Scorecard: IQC acceptance below 95% and one overdue SCAR", source: "Scorecard", status: "Applied", by: BUYER_A, on: "2026-08-04", decidedBy: "USR-TBD-037", decidedOn: "2026-08-05" },
]

// ===================================================================== vendor tax profile (Part A §11.3)
const reg = (jurisdiction: string, number: string, kind: VendorTaxProfile["registrations"][number]["kind"] = "State sales/use tax") => ({ jurisdiction, number, kind })
export const SEED_TAX: Record<string, VendorTaxProfile> = {
  "VEN-TBD-0101": { registrations: [reg("OH", "OH-3301-884120"), reg("PA", "PA-62-0481133")], defaultTaxCode: "EXM-MFG (exempt: manufacturing input)", certificates: [{ id: "EXC-0101-OH", jurisdiction: "OH", state: "Verified", expires: "2027-06-30" }], useTaxAccrual: false, taxAddressRole: "Ship-To", updatedOn: "2026-02-03", updatedBy: CONTROLLER },
  "VEN-TBD-0102": { registrations: [reg("IN", "IN-004-77120")], defaultTaxCode: "EXM-MFG (exempt: manufacturing input)", certificates: [{ id: "EXC-0102-IN", jurisdiction: "IN", state: "Verified", expires: "2027-03-31" }], useTaxAccrual: false, taxAddressRole: "Ship-To", updatedOn: "2026-02-03", updatedBy: CONTROLLER },
  "VEN-TBD-0103": { registrations: [reg("DE", "DE-VAT-318400112", "VAT / other")], defaultTaxCode: "IMP-NOTAX (imported, no US tax charged)", certificates: [], useTaxAccrual: true, taxAddressRole: "Ship-To", updatedOn: "2026-02-10", updatedBy: "USR-TBD-013" },
  "VEN-TBD-0104": { registrations: [reg("KR", "KR-BRN-214-81-55220", "VAT / other")], defaultTaxCode: "IMP-NOTAX (imported, no US tax charged)", certificates: [], useTaxAccrual: true, taxAddressRole: "Ship-To", updatedOn: "2026-02-12", updatedBy: "USR-TBD-013" },
  "VEN-TBD-0106": { registrations: [reg("IA", "IA-540-22190")], defaultTaxCode: "TAX-STD (taxable, state rate)", certificates: [{ id: "EXC-0106-IA", jurisdiction: "IA", state: "Expired", expires: "2026-06-30" }], useTaxAccrual: false, taxAddressRole: "Ship-To", updatedOn: "2026-01-20", updatedBy: CONTROLLER },
  "VEN-TBD-0107": { registrations: [reg("QC", "QC-1229884411 TQ0001", "Province GST/HST"), reg("CA-FED", "CA-GST-889120334 RT0001", "Province GST/HST")], defaultTaxCode: "GST-HST (Canadian goods)", certificates: [], useTaxAccrual: false, taxAddressRole: "Ship-To", updatedOn: "2026-03-11", updatedBy: "USR-TBD-013" },
  "VEN-TBD-0114": { registrations: [reg("NE", "NE-31-0018822")], defaultTaxCode: "TAX-SVC (taxable service)", certificates: [], useTaxAccrual: true, taxAddressRole: "Bill-To", updatedOn: "2026-04-02", updatedBy: CONTROLLER },
  "VEN-TBD-0116": { registrations: [reg("KS", "KS-009-51190")], defaultTaxCode: "TAX-SVC (taxable service)", certificates: [{ id: "EXC-0116-KS", jurisdiction: "KS", state: "Pending" }], useTaxAccrual: false, taxAddressRole: "Bill-To", updatedOn: "2026-05-14", updatedBy: "USR-TBD-013" },
}
export const TAX_CODES = [
  "EXM-MFG (exempt: manufacturing input)", "TAX-STD (taxable, state rate)", "TAX-SVC (taxable service)", "IMP-NOTAX (imported, no US tax charged)", "GST-HST (Canadian goods)",
]

// ===================================================================== RFQ scoring and bid versions
export const DEFAULT_WEIGHTS = { landed: 50, lead: 20, quality: 20, buyAmerica: 10 }
const bv = (rfqId: string, vendorId: VendorId, version: number, receivedOn: string, price: number, leadDays: number, extra: Partial<BidVersion> = {}): BidVersion => ({
  rfqId, vendorId, version, receivedOn, price, leadDays, freightPct: 3, dutyPct: 0, validUntil: "2026-12-31", buyAmerica: false, note: version === 1 ? "Original bid" : "Revised bid", deviations: [], ...extra,
})
export const SEED_BID_VERSIONS: BidVersion[] = [
  bv("RFQ-TBD-0301", "VEN-TBD-0103", 1, "2026-02-05", 74500, 70, { freightPct: 2.5, validUntil: "2026-04-30" }),
  bv("RFQ-TBD-0301", "VEN-TBD-0121", 1, "2026-02-05", 71900, 112, { freightPct: 2, buyAmerica: true, validUntil: "2026-04-30", deviations: ["Diverter switch rated 350 A against the 400 A STP"] }),
  bv("RFQ-TBD-0301", "VEN-TBD-0122", 1, "2026-02-05", 76800, 84, { freightPct: 4.5, dutyPct: 2.5, validUntil: "2026-04-30", deviations: ["Cable box 80 mm longer than the STP drawing"] }),
  bv("RFQ-TBD-0397", "VEN-TBD-0104", 1, "2026-10-06", 20100, 105, { freightPct: 4, validUntil: "2026-12-31", deviations: ["Gasket compound EPDM instead of FKM (see SDV-TBD-0001)"] }),
  bv("RFQ-TBD-0397", "VEN-TBD-0104", 2, "2026-10-08", 19450, 98, { freightPct: 4, validUntil: "2026-12-31", note: "Revised after buyer call: volume discount for 6 units", deviations: ["Gasket compound EPDM instead of FKM (see SDV-TBD-0001)"] }),
  bv("RFQ-TBD-0397", "VEN-TBD-0112", 1, "2026-10-07", 17800, 63, { freightPct: 2, buyAmerica: true, validUntil: "2026-12-15" }),
  bv("RFQ-TBD-0397", "VEN-TBD-0123", 1, "2026-10-07", 21400, 84, { buyAmerica: true, validUntil: "2027-01-31", deviations: ["Flange material stainless 304 (see SDV-TBD-0006)"] }),
  bv("RFQ-TBD-0397", "VEN-TBD-0123", 2, "2026-10-08", 20900, 77, { buyAmerica: true, validUntil: "2027-01-31", note: "Revised: lead time shortened", deviations: ["Flange material stainless 304 (see SDV-TBD-0006)"] }),
  bv("RFQ-TBD-0402", "VEN-TBD-0101", 1, "2026-10-07", 3.79, 45, { buyAmerica: true, validUntil: "2027-12-31" }),
  bv("RFQ-TBD-0379", "VEN-TBD-0102", 1, "2026-03-18", 12.1, 21, { buyAmerica: true }),
  bv("RFQ-TBD-0379", "VEN-TBD-0125", 1, "2026-03-19", 11.95, 35, { freightPct: 5.5 }),
]
export const SEED_SCORING: Record<string, RfqScoring> = {
  "RFQ-TBD-0301": { weights: { ...DEFAULT_WEIGHTS }, selected: { "VEN-TBD-0103": 1, "VEN-TBD-0121": 1, "VEN-TBD-0122": 1 } },
  "RFQ-TBD-0397": { weights: { ...DEFAULT_WEIGHTS }, selected: { "VEN-TBD-0104": 2, "VEN-TBD-0112": 1, "VEN-TBD-0123": 2 } },
  "RFQ-TBD-0402": { weights: { ...DEFAULT_WEIGHTS }, selected: { "VEN-TBD-0101": 1 } },
  "RFQ-TBD-0379": { weights: { ...DEFAULT_WEIGHTS }, selected: { "VEN-TBD-0102": 1, "VEN-TBD-0125": 1 } },
}

// ===================================================================== driver rates (Book I I §3.1)
const dr = (id: string, driver: string, unit: string, family: string, versions: DriverRate["versions"], index?: string): DriverRate => ({ id, driver, unit, family, versions, index })
const FAM = "Power transformers 20 MVA (ETO)"
export const SEED_DRIVER_RATES: DriverRate[] = [
  dr("DRV-001", "Core steel, CRGO 0.23 mm", "kg", FAM, [{ validFrom: "2025-12-01", rate: 3.85, by: COST_ACC, note: "CRGO basis 3.58 + 0.27 conversion" }, { validFrom: "2026-10-01", rate: 4.15, by: COST_ACC, note: "CRGO basis 3.88 + 0.27 conversion" }], "CRGO basis $/kg"),
  dr("DRV-002", "Copper CTC, HV windings", "kg", FAM, [{ validFrom: "2025-12-01", rate: 13.4, by: COST_ACC, note: "COMEX 4.08 $/lb basis + drawing premium" }, { validFrom: "2026-10-01", rate: 14.05, by: COST_ACC, note: "COMEX 4.61 $/lb basis + drawing premium" }], "COMEX copper $/lb"),
  dr("DRV-003", "Copper foil, LV windings", "kg", FAM, [{ validFrom: "2025-12-01", rate: 12.1, by: COST_ACC, note: "RFQ-TBD-0379 award" }]),
  dr("DRV-004", "Transformer oil", "L", FAM, [{ validFrom: "2025-12-01", rate: 1.92, by: COST_ACC, note: "Contract price" }]),
  dr("DRV-005", "Tank steel plate", "kg", FAM, [{ validFrom: "2025-12-01", rate: 1.35, by: COST_ACC, note: "Standard cost" }]),
  dr("DRV-006", "HV bushing 145 kV", "EA", FAM, [{ validFrom: "2025-12-01", rate: 18900, by: COST_ACC, note: "AVL basis" }, { validFrom: "2026-10-09", rate: 19450, by: COST_ACC, note: "RFQ-TBD-0397 basis (STP-000303)" }]),
  dr("DRV-007", "On-load tap changer, 17 positions", "EA", FAM, [{ validFrom: "2025-12-01", rate: 74500, by: COST_ACC, note: "RFQ-TBD-0301 award" }]),
  dr("DRV-008", "Radiator panel bank", "EA", FAM, [{ validFrom: "2025-12-01", rate: 2380, by: COST_ACC, note: "Contract price" }]),
  dr("DRV-009", "Core steel, CRGO 0.23 mm", "kg", "Substation 5 MVA (ETO)", [{ validFrom: "2026-01-01", rate: 3.95, by: COST_ACC, note: "Smaller lots: scale price 0 to 20,000 kg" }], "CRGO basis $/kg"),
  dr("DRV-010", "Copper CTC, HV windings", "kg", "Substation 5 MVA (ETO)", [{ validFrom: "2026-01-01", rate: 13.9, by: COST_ACC, note: "Scale price below 50,000 kg" }], "COMEX copper $/lb"),
]
export const SEED_DRIVER_TEMPLATES: DriverTemplate[] = [
  { id: "TPL-20MVA", family: FAM, basis: "Seeded from three settled WOs of 20 MVA ETO units (WO-2026 actuals)", historicalWos: 3,
    rows: [{ driver: "Core weight", unit: "kg", qty: 36000 }, { driver: "Copper weight (CTC + foil)", unit: "kg", qty: 16500 }, { driver: "Oil volume", unit: "gal", qty: 6340 }, { driver: "Tank steel weight", unit: "kg", qty: 22000 }, { driver: "HV bushings 145 kV", unit: "EA", qty: 3 }, { driver: "OLTC 17 positions", unit: "EA", qty: 1 },
      { driver: "Labor hours WC-050 Tank Fabrication", unit: "h", qty: 520 }, { driver: "Labor hours WC-210 HV Winding", unit: "h", qty: 430 }, { driver: "Labor hours WC-300 Core & Coil Assembly", unit: "h", qty: 280 }] },
  { id: "TPL-5MVA", family: "Substation 5 MVA (ETO)", basis: "Scaled from the 20 MVA template at 0.3 of core and copper weight; no settled WOs yet", historicalWos: 0,
    rows: [{ driver: "Core weight", unit: "kg", qty: 10800 }, { driver: "Copper weight (CTC + foil)", unit: "kg", qty: 4950 }, { driver: "Oil volume", unit: "gal", qty: 1900 }, { driver: "Tank steel weight", unit: "kg", qty: 7000 }, { driver: "HV bushings 145 kV", unit: "EA", qty: 3 }, { driver: "Labor hours WC-050 Tank Fabrication", unit: "h", qty: 210 }] },
]

// ===================================================================== margin floors
export const SEED_ITEM_FLOORS: ItemFloor[] = [
  { itemId: "FIN-TBD-2500PM", floorPct: 24, setBy: PRICING, on: "2026-03-02", note: "Stricter than PC-100: pad-mount 2,500 kVA copper content volatility" },
  { itemId: "FIN-TBD-20MVA", floorPct: 24, setBy: PRICING, on: "2026-01-12", note: "ETO power units: no PC-200 floor stated, item floor protects the estimate margin" },
]
export const SEED_BREACHES: FloorBreach[] = [
  { id: "FB-2026-0007", on: "2026-10-02", source: "Quote", ref: "QT-TBD-0412-V2", itemId: "FIN-TBD-2500PM", customerId: "CUS-TBD-0031", price: 76900, cost: 61200, marginPct: 20.4, floorPct: 24, points: 3.6, status: "Approved",
    justification: "Renewal of the Prairie Ridge supply agreement; 14 units committed for 2027 and copper surcharge covers the cost move.", route: ["Pricing Manager", "Sales Director"], approvedBy: "Lena Fischer, Graham Stout (2026-10-02)" },
  { id: "FB-2026-0006", on: "2026-09-24", source: "Quote", ref: "QT-TBD-0387-V1", itemId: "FIN-TBD-0167PL", customerId: "CUS-TBD-0031", price: 6790, cost: 5410, marginPct: 20.3, floorPct: 22, points: 1.7, status: "Approved",
    justification: "Existing agreement price AGR-TBD-0031 renewed unchanged for the year.", route: ["Pricing Manager", "Sales Director"], approvedBy: "Lena Fischer, Graham Stout (2026-09-24)" },
  { id: "FB-2026-0005", on: "2026-09-10", source: "Quote", ref: "QT-TBD-0391-V1", itemId: "TRADE-TBD-ARR", customerId: "CUS-TBD-0009", price: 104, cost: 88, marginPct: 15.4, floorPct: 18, points: 2.6, status: "Rejected",
    justification: "Distributor asked for a Q4 promotion price; Sales Director declined, re-quoted at the agreement price.", route: ["Pricing Manager", "Sales Director"], approvedBy: "Declined by Graham Stout (2026-09-11)" },
  { id: "FB-2026-0004", on: "2026-08-19", source: "Sales order", ref: "SO-2026-00372", itemId: "FIN-TBD-1000PM", customerId: "CUS-TBD-0044", price: 36000, cost: 32640, marginPct: 9.3, floorPct: 22, points: 12.7, status: "Rejected",
    justification: "Competitive bid against two regional makers.", route: ["Pricing Manager", "Sales Director", "CFO"], approvedBy: "Declined by Margaret Osei (2026-08-20): re-quote at floor" },
  { id: "FB-2026-0008", on: "2026-10-08", source: "Quote", ref: "QT-TBD-0416-V1", itemId: "FIN-TBD-0167PL", customerId: "CUS-TBD-0027", price: 6800, cost: 5410, marginPct: 20.4, floorPct: 22, points: 1.6, status: "Pending",
    justification: "Municipal customer renewal; quote held at the prior year price while the copper surcharge covers the cost increase.", route: ["Pricing Manager", "Sales Director"] },
]

// ===================================================================== hierarchy
export const SEED_MOVES: HierMove[] = [
  { id: "HM-2026-001", kind: "cost", nodeId: "CC-1700", fromParent: "CC-2000", toParent: "CC-1000", effective: "2026-01-01", by: CONTROLLER, on: "2025-12-12", reason: "Shipping dock integrated with production reporting" },
  { id: "HM-2026-002", kind: "cost", nodeId: "CC-4000", fromParent: undefined, toParent: "CC-9000", effective: "2027-01-01", by: CONTROLLER, on: "2026-10-01", reason: "Planned FY27 reorganisation: Purchasing & Materials reports under G&A" },
]
export const SEED_ALT: AltHierarchy[] = [
  { id: "ALT-CC-01", kind: "cost", name: "Function view", purpose: "Spend by function for the quarterly operations review (reporting only)", createdBy: ANALYST, createdOn: "2026-02-10",
    groups: [
      { id: "g1", name: "Direct production", memberIds: ["CC-1100", "CC-1150", "CC-1200", "CC-1250", "CC-1300", "CC-1400", "CC-1600"] },
      { id: "g2", name: "Quality and test", memberIds: ["CC-1500"] },
      { id: "g3", name: "Logistics", memberIds: ["CC-1700", "CC-2000"] },
      { id: "g4", name: "Engineering and purchasing", memberIds: ["CC-3000", "CC-4000"] },
      { id: "g5", name: "Commercial", memberIds: ["CC-5000"] },
      { id: "g6", name: "Corporate", memberIds: ["CC-9100", "CC-9200", "CC-9300", "CC-9400", "CC-9500"] },
    ] },
  { id: "ALT-CC-02", kind: "cost", name: "Plant versus overhead", purpose: "Plant cost against overhead for the board pack (reporting only)", createdBy: ANALYST, createdOn: "2026-03-04",
    groups: [
      { id: "g1", name: "Plant", memberIds: ["CC-1100", "CC-1150", "CC-1200", "CC-1250", "CC-1300", "CC-1400", "CC-1500", "CC-1600", "CC-1700"] },
      { id: "g2", name: "Overhead", memberIds: ["CC-2000", "CC-3000", "CC-4000", "CC-5000", "CC-9100", "CC-9200", "CC-9300", "CC-9400", "CC-9500"] },
    ] },
  { id: "ALT-PC-01", kind: "profit", name: "Business view", purpose: "Transformers against components and service for the CFO pack (reporting only)", createdBy: ANALYST, createdOn: "2026-02-10",
    groups: [
      { id: "g1", name: "Transformers", memberIds: ["PC-100", "PC-200"] },
      { id: "g2", name: "Components and service", memberIds: ["PC-300", "PC-400"] },
      { id: "g3", name: "Unassigned", memberIds: ["PC-900"] },
    ] },
]

// ===================================================================== SKF history and budgets
export const SEED_SKF_HISTORY: SkfChange[] = [
  { id: "SKC-001", costCenterId: "CC-1300", period: "2026-Q3", field: "headcount", old: 24, new: 26, by: ANALYST, on: "2026-07-08", via: "Edit" },
  { id: "SKC-002", costCenterId: "CC-2000", period: "2026-Q3", field: "sqft", old: 28000, new: 30000, by: ANALYST, on: "2026-07-08", via: "Import" },
  { id: "SKC-003", costCenterId: "CC-1200", period: "2026-Q2", field: "laborHours", old: 14100, new: 14600, by: ANALYST, on: "2026-04-06", via: "Import" },
]
const CC_BASE: Record<string, number> = {
  "CC-1100": 61000, "CC-1150": 92000, "CC-1200": 118000, "CC-1250": 38000, "CC-1300": 104000, "CC-1400": 76000, "CC-1500": 52000, "CC-1600": 33000, "CC-1700": 41000,
  "CC-2000": 90000, "CC-3000": 142000, "CC-4000": 68000, "CC-5000": 121000, "CC-9100": 74000, "CC-9200": 122000, "CC-9300": 97000, "CC-9400": 55000, "CC-9500": 148000,
}
export const BUDGET_GROUPS: [string, number][] = [["Personnel 6100-6199", 0.58], ["Materials and supplies 6200-6299", 0.14], ["Facilities and utilities 6300-6399", 0.12], ["Depreciation 6600-6699", 0.1], ["Other 6900-6999", 0.06]]
export const SEED_BUDGETS: BudgetLine[] = [
  ...Object.entries(CC_BASE).flatMap(([cc, base]) => BUDGET_GROUPS.map(([group, share]): BudgetLine => ({ costCenterId: cc as CostCenterId, fy: 2026, group, annual: Math.round((base * share * 12 * 1.015) / 100) * 100, status: "Approved" }))),
  // FY2027 budget cycle in progress: only some centers have entered rows (completeness check)
  ...["CC-1100", "CC-1150", "CC-1200", "CC-1500", "CC-2000"].flatMap((cc) => BUDGET_GROUPS.map(([group, share]): BudgetLine => ({ costCenterId: cc as CostCenterId, fy: 2027, group, annual: Math.round((CC_BASE[cc] * share * 12 * 1.04) / 100) * 100, status: cc === "CC-2000" ? "Approved" : "Draft", by: "USR-TBD-031" }))),
]

// ===================================================================== scorecard history (design values)
const sh = (vendorId: VendorId, quarter: string, otdPct: number, qualityPct: number, pricePct: number): ScoreHistory => ({ vendorId, quarter, otdPct, qualityPct, pricePct })
export const SEED_SCORE_HISTORY: ScoreHistory[] = [
  sh("VEN-TBD-0101", "2026-Q1", 96, 99.1, 100), sh("VEN-TBD-0101", "2026-Q2", 95, 98.8, 100), sh("VEN-TBD-0101", "2026-Q3", 97, 99.4, 100),
  sh("VEN-TBD-0102", "2026-Q1", 91, 98.2, 96), sh("VEN-TBD-0102", "2026-Q2", 88, 98.0, 94), sh("VEN-TBD-0102", "2026-Q3", 84, 97.6, 92),
  sh("VEN-TBD-0103", "2026-Q1", 100, 100, 100), sh("VEN-TBD-0103", "2026-Q2", 100, 100, 100), sh("VEN-TBD-0103", "2026-Q3", 92, 100, 100),
  sh("VEN-TBD-0104", "2026-Q1", 82, 96.5, 98), sh("VEN-TBD-0104", "2026-Q2", 78, 94.2, 96), sh("VEN-TBD-0104", "2026-Q3", 74, 93.0, 94),
  sh("VEN-TBD-0105", "2026-Q1", 90, 99.0, 100), sh("VEN-TBD-0105", "2026-Q2", 86, 98.5, 100), sh("VEN-TBD-0105", "2026-Q3", 81, 98.9, 100),
  sh("VEN-TBD-0106", "2026-Q1", 93, 97.2, 100), sh("VEN-TBD-0106", "2026-Q2", 94, 97.8, 100), sh("VEN-TBD-0106", "2026-Q3", 95, 98.1, 100),
  sh("VEN-TBD-0107", "2026-Q1", 99, 99.5, 100), sh("VEN-TBD-0107", "2026-Q2", 98, 99.2, 100), sh("VEN-TBD-0107", "2026-Q3", 99, 99.6, 100),
  sh("VEN-TBD-0108", "2026-Q1", 88, 97.0, 100), sh("VEN-TBD-0108", "2026-Q2", 84, 96.2, 100), sh("VEN-TBD-0108", "2026-Q3", 79, 95.4, 100),
  sh("VEN-TBD-0112", "2026-Q1", 70, 88.0, 92), sh("VEN-TBD-0112", "2026-Q2", 61, 82.5, 90), sh("VEN-TBD-0112", "2026-Q3", 52, 76.0, 88),
]
