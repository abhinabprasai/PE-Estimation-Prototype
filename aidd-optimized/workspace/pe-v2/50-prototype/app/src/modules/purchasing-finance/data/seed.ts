// purchasing-finance seed. Spine documents use exactly the IDs, statuses and dates in
// src/data/shared/spine.ts; every other record is a fictitious design value at realistic volume
// (PE Transformer, Fargo ND plant; US and Canadian customers; power and distribution transformers).
// Each record kind shows every status on its S-n list at least once (S-33 PR, S-34 RFQ, S-35 PO,
// S-36 PO line, S-19 STP acknowledgement, S-38 cost estimate, S-39 price list, S-37 centers).

import type { CostCenterId, CustomerPrice, ISODate, MaterialId, PriceList, UserId, VendorId, WorkCenterId } from "@/data/domain"
import { MATERIALS, WORK_CENTERS } from "@/data/shared"
import type {
  AddedCostCenter, AgreementRec, AllocCycleRec, CeRec, GrnRec, IndexRec, JournalEntry, LlrRec, MrpException,
  PoLineX, PoRec, PrRec, PriceListRec, RfqRec, RfqResp, RunRec, SkfValue, StpRec, SurchargeRec, VarianceRow, VarianceType, WcRateRec,
} from "./types"

const BUYER_A: UserId = "USR-TBD-039" // Olivia Grant
const BUYER_B: UserId = "USR-TBD-040" // Ahmed Karimi
const PM: UserId = "USR-TBD-041" // Rebecca Thorne, Purchasing Manager
const PLANNER: UserId = "USR-TBD-028"
const COST_ACC: UserId = "USR-TBD-011"
const CONTROLLER: UserId = "USR-TBD-009"
const ESTIMATOR: UserId = "USR-TBD-005"
const PRICING: UserId = "USR-TBD-006"

const std = (id: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0

// ===================================================================== requisitions (S-33)
type PrLine = PrRec["lines"][number]
const prl = (no: number, itemId: MaterialId, qty: number, needBy: ISODate, estPrice?: number, peg?: PrLine["peg"]): PrLine => ({
  no, itemId, qty, needBy, estPrice: estPrice ?? std(itemId), peg,
})
const pr = (id: PrRec["id"], title: string, status: PrRec["status"], origin: PrRec["origin"], createdOn: ISODate, buyerId: UserId, lines: PrLine[], extra: Partial<PrRec> = {}): PrRec => ({
  id, title, status, origin, createdOn, createdBy: origin === "MRP" || origin === "Reorder" ? PLANNER : extra.requesterId ?? PLANNER, activity: [{ at: createdOn, by: origin === "MRP" ? "System" : "Planner", text: `Created (${origin})` }],
  entityId: "LE-TBD-10", requesterId: extra.requesterId ?? PLANNER, buyerId, lines, poIds: [], ...extra,
})

export const SEED_PRS: PrRec[] = [
  // ---- hero thread
  pr("PR-TBD-0301", "Requisition: OLTC and HV bushings", "Converted", "MRP", "2026-01-27", BUYER_A,
    [prl(10, "RAW-TBD-OLTC", 1, "2026-04-20", 74500, { type: "salesOrder", id: "SO-2026-00301" }), prl(20, "RAW-TBD-BSH145", 9, "2026-05-01", 18900, { type: "salesOrder", id: "SO-2026-00301" })],
    { poIds: ["PO-TBD-0301", "PO-TBD-0302"], rfqId: "RFQ-TBD-0301", suggestedVendorId: "VEN-TBD-0103", note: "Nine bushings: three for phase 1, six held for phase 2 (customer option)" }),
  pr("PR-TBD-0377", "Requisition: CRGO steel for three cores", "Approved", "MRP", "2026-10-01", BUYER_A,
    [prl(10, "RAW-TBD-CRGO23", 54000, "2026-12-15", 3.85, { type: "plannedOrder", id: "PLO-TBD-0377" })],
    { poIds: ["PO-TBD-0377"], suggestedVendorId: "VEN-TBD-0101", note: "Under LLR-2026-0011; MRP PRs are pre-approved by policy" }),
  // ---- open queue
  pr("PR-TBD-0380", "OLTC x 3, phase 2 (LLR-2026-0011)", "Approved", "MRP", "2026-10-02", BUYER_A,
    [prl(10, "RAW-TBD-OLTC", 3, "2027-01-10", 74500, { type: "plannedOrder", id: "PLO-TBD-0377" })], { suggestedVendorId: "VEN-TBD-0103", poIds: ["PO-TBD-0378"] }),
  pr("PR-TBD-0381", "Copper CTC for Q1 power units", "Approved", "MRP", "2026-10-05", BUYER_A,
    [prl(10, "RAW-TBD-CTC", 22000, "2026-12-01", 13.4)], { suggestedVendorId: "VEN-TBD-0102" }),
  pr("PR-TBD-0382", "Copper foil, pad-mount LV coils", "Approved", "Reorder", "2026-10-06", BUYER_B,
    [prl(10, "RAW-TBD-FOIL", 6500, "2026-11-04", 12.1)], { suggestedVendorId: "VEN-TBD-0102" }),
  pr("PR-TBD-0383", "Transformer oil, bulk", "Approved", "MRP", "2026-10-06", BUYER_B,
    [prl(10, "RAW-TBD-OIL", 48000, "2026-11-18", 1.92)], { suggestedVendorId: "VEN-TBD-0105" }),
  pr("PR-TBD-0384", "Radiator banks for SO-2026-00377", "Approved", "MRP", "2026-10-07", BUYER_A,
    [prl(10, "RAW-TBD-RAD", 24, "2027-01-20", 2380, { type: "plannedOrder", id: "PLO-TBD-0377" })], { suggestedVendorId: "VEN-TBD-0108" }),
  pr("PR-TBD-0385", "Bushing current transformers 600:5", "Approved", "MRP", "2026-10-07", BUYER_A,
    [prl(10, "RAW-TBD-CT600", 9, "2027-01-05", 2150, { type: "plannedOrder", id: "PLO-TBD-0377" })], { note: "Material still Draft; no AVL source (source gap)" }),
  pr("PR-TBD-0386", "LV bushings 15 kV", "Approved", "Reorder", "2026-10-08", BUYER_B,
    [prl(10, "RAW-TBD-BSH015", 60, "2026-11-12", 1240)], { suggestedVendorId: "VEN-TBD-0112", note: "Rank-1 AVL source Suspended; rank 2 is VEN-TBD-0104" }),
  pr("PR-TBD-0387", "Kraft insulation paper", "Approved", "Reorder", "2026-10-08", BUYER_B,
    [prl(10, "RAW-TBD-KRAFT", 4200, "2026-11-10", 8.6)], { suggestedVendorId: "VEN-TBD-0107" }),
  pr("PR-TBD-0388", "Tank plate A572 Gr. 50", "Approved", "MRP", "2026-10-08", BUYER_A,
    [prl(10, "RAW-TBD-PLATE", 36000, "2026-11-25", 1.35)], { suggestedVendorId: "VEN-TBD-0106" }),
  pr("PR-TBD-0389", "Test lab: annual calibration services", "Open", "Expense", "2026-10-08", BUYER_B,
    [prl(10, "NSTK-TBD-CAL", 1, "2026-11-30", 18400)], { requesterId: "USR-TBD-037", costCenterId: "CC-1500", budgetRemaining: 41200, suggestedVendorId: "VEN-TBD-0114" }),
  pr("PR-TBD-0390", "Shop PPE replenishment", "In Approval", "Expense", "2026-10-07", BUYER_B,
    [prl(10, "NSTK-TBD-PPE", 400, "2026-10-30", 14.5)], { requesterId: "USR-TBD-031", costCenterId: "CC-1300", budgetRemaining: 3900, note: "Over budget on CC-1300 + 6200: approval flagged" }),
  pr("PR-TBD-0391", "Welding wire ER70S-6", "Approved", "Reorder", "2026-10-05", BUYER_B,
    [prl(10, "CONS-TBD-WELD", 2000, "2026-10-28", 4.1)], { suggestedVendorId: "VEN-TBD-0106", poIds: ["PO-TBD-0318"] }),
  pr("PR-TBD-0392", "Spare gasket kits for service stock", "Open", "Manual", "2026-10-09", BUYER_B,
    [prl(10, "SPARE-TBD-GSKT20", 12, "2026-11-20", 640)], { requesterId: "USR-TBD-004", suggestedVendorId: "VEN-TBD-0111" }),
  pr("PR-TBD-0393", "Paint topcoat ANSI 70", "Cancelled", "Reorder", "2026-08-21", BUYER_B,
    [prl(10, "CONS-TBD-PAINT", 1200, "2026-09-15", 22.5)], { suggestedVendorId: "VEN-TBD-0113", note: "Cancelled: vendor disqualified; requirement moved to PR-TBD-0394" }),
  pr("PR-TBD-0394", "Paint topcoat ANSI 70 (re-sourced)", "Converted", "Reorder", "2026-08-28", BUYER_B,
    [prl(10, "CONS-TBD-PAINT", 1200, "2026-09-25", 22.5)], { poIds: ["PO-TBD-0326"] }),
  pr("PR-TBD-0395", "Engineering workstation upgrades", "Rejected", "Expense", "2026-09-29", BUYER_B,
    [prl(10, "NSTK-TBD-PPE", 1, "2026-10-31", 26800)], { requesterId: "USR-TBD-024", costCenterId: "CC-3000", budgetRemaining: 9800, note: "Rejected by Purchasing Manager: not in FY26 capital plan" }),
  pr("PR-TBD-0396", "Galvanizing, radiator headers", "Approved", "Manual", "2026-10-03", BUYER_A,
    [prl(10, "SERV-TBD-GALV", 420000, "2026-12-10", 0.6)], { requesterId: PLANNER, suggestedVendorId: "VEN-TBD-0106", poIds: ["PO-TBD-0320"] }),
  pr("PR-TBD-0397", "HV bushings 145 kV, replacement for recall batch", "Approved", "Manual", "2026-10-06", BUYER_A,
    [prl(10, "RAW-TBD-BSH145", 6, "2027-01-15", 18900, { type: "salesOrder", id: "SO-2026-00377" })], { requesterId: "USR-TBD-028", suggestedVendorId: "VEN-TBD-0104", rfqId: "RFQ-TBD-0397", note: "Replaces the six phase 2 bushings blocked by RCL-2026-001" }),
  pr("PR-TBD-0398", "Copper CTC annual blanket call-off 2027", "Converted", "Manual", "2026-09-30", BUYER_A,
    [prl(10, "RAW-TBD-CTC", 85000, "2027-01-04", 13.4)], { requesterId: PM, poIds: ["PO-TBD-0317"] }),
  pr("PR-TBD-0399", "Arresters for PE Grid Components resale", "Converted", "Manual", "2026-09-18", BUYER_B,
    [prl(10, "TRADE-TBD-ARR", 300, "2026-10-20", 98.56)], { poIds: ["PO-TBD-0322"] }),
]

// ===================================================================== STPs (Book IV §3.3) and LLRs (§3.2)
export const SEED_STPS: StpRec[] = [
  { id: "STP-000301", version: 1, title: "Supplier technical package, OLTC, version 1", itemId: "RAW-TBD-OLTC", createdOn: "2026-01-27", llrId: "LLR-2026-0004",
    drawingRevisions: ["DOC-TBD-0301-GA rev C", "DWG-TBD-OLTC-ARR rev B"], specs: ["IEC 60214-1", "17 positions, 115 kV class, 400 A"], clauses: ["Q1", "Q2", "Q4"],
    checksum: "sha256:9f2c4e81b07a5d3c6e1f0a8b2d4c7e9f1a3b5c7d9e0f2a4b6c8d0e2f4a6b8c0d", superseded: false,
    acknowledgements: [{ vendorId: "VEN-TBD-0103", status: "Acknowledged", on: "2026-01-30" }] },
  { id: "STP-000302", version: 1, title: "Supplier technical package, HV bushing 145 kV, version 1", itemId: "RAW-TBD-BSH145", createdOn: "2026-01-27",
    drawingRevisions: ["DWG-TBD-BSH145 rev A"], specs: ["IEEE C57.19.01", "145 kV BIL 650 kV, 800 A"], clauses: ["Q1", "Q4"],
    checksum: "sha256:2a7b1c9d4e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b", superseded: true, supersededBy: "STP-000303",
    acknowledgements: [{ vendorId: "VEN-TBD-0104", status: "Acknowledged", on: "2026-02-14" }] },
  { id: "STP-000303", version: 2, title: "Supplier technical package, HV bushing 145 kV, version 2 (flange seal spec revised)", itemId: "RAW-TBD-BSH145", createdOn: "2026-10-06",
    drawingRevisions: ["DWG-TBD-BSH145 rev B"], specs: ["IEEE C57.19.01", "Flange gasket FKM, compression set test per lot"], clauses: ["Q1", "Q2", "Q3", "Q4"],
    checksum: "sha256:7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d", superseded: false,
    acknowledgements: [{ vendorId: "VEN-TBD-0104", status: "Exception", on: "2026-10-08" }] },
  { id: "STP-000304", version: 1, title: "Supplier technical package, OLTC phase 2, version 1", itemId: "RAW-TBD-OLTC", createdOn: "2026-09-30", llrId: "LLR-2026-0011",
    drawingRevisions: ["DWG-TBD-OLTC-ARR rev B"], specs: ["IEC 60214-1", "17 positions, 115 kV class, 400 A"], clauses: ["Q1", "Q2", "Q4"],
    checksum: "sha256:0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d", superseded: false, acknowledgements: [] },
  { id: "STP-000305", version: 1, title: "Supplier technical package, LV bushing 15 kV, version 1", itemId: "RAW-TBD-BSH015", createdOn: "2026-07-14",
    drawingRevisions: ["DWG-TBD-BSH015 rev D"], specs: ["IEEE C57.19.01", "15 kV, 3,000 A"], clauses: ["Q1", "Q4"],
    checksum: "sha256:5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e", superseded: false,
    acknowledgements: [{ vendorId: "VEN-TBD-0112", status: "Rejected", on: "2026-07-22" }] },
]

export const SEED_LLRS: LlrRec[] = [
  { id: "LLR-2026-0004", title: "Long-lead release: CRGO steel and OLTC", soId: "SO-2026-00301", state: "Closed", createdOn: "2026-01-26",
    itemIds: ["RAW-TBD-CRGO23", "RAW-TBD-OLTC"], qtyCap: 2, valueCap: { amount: 420000, currency: "USD" }, exposure: { amount: 0, currency: "USD" },
    revisionBasis: "STP-000301 version 1", riskClass: "Medium", engineeringRequestId: "ER-TBD-0301",
    approvals: [{ role: "Engineering Manager", on: "2026-01-26" }, { role: "Purchasing Manager", on: "2026-01-26" }, { role: "Controller", on: "2026-01-27" }],
    acceptedCancellation: 61000, cancellationFees: 0, stpIds: ["STP-000301"], ecoImpacts: [], closedOn: "2026-03-20", closeNote: "Final release confirmed the purchased revision (no-change path), ER-TBD-0301 Released for Production" },
  { id: "LLR-2026-0011", title: "Long-lead release: CRGO steel and 3 OLTCs, phase 2", soId: "SO-2026-00377", state: "Awaiting approval", createdOn: "2026-09-30",
    itemIds: ["RAW-TBD-CRGO23", "RAW-TBD-OLTC"], qtyCap: 54003, valueCap: { amount: 650000, currency: "USD" }, exposure: { amount: 612000, currency: "USD" },
    revisionBasis: "STP-000304 version 1; core steel to parametric spec", riskClass: "Medium", engineeringRequestId: "ER-TBD-0377",
    approvals: [], cancellationFees: 180600, stpIds: ["STP-000304"], ecoImpacts: [] },
  { id: "LLR-2026-0009", title: "Long-lead release: copper CTC and tap changer, Lac-Saint-Jean 33 MVA", soId: "SO-2026-00396", state: "Approved", createdOn: "2026-08-12",
    itemIds: ["RAW-TBD-CTC", "RAW-TBD-OLTC"], qtyCap: 16001, valueCap: { amount: 310000, currency: "USD" }, exposure: { amount: 0, currency: "USD" },
    revisionBasis: "Parametric spec, geometry still moving", riskClass: "High", engineeringRequestId: "ER-TBD-0396",
    approvals: [{ role: "Engineering Manager", on: "2026-08-13" }, { role: "Purchasing Manager", on: "2026-08-13" }, { role: "Controller", on: "2026-08-14" }],
    acceptedCancellation: 48000, cancellationFees: 22000, stpIds: [], ecoImpacts: [{ ecoId: "ECO-TBD-0038", poId: "PO-TBD-0327" }] },
  { id: "LLR-2026-0012", title: "Long-lead release: CRGO for 5 MVA substation units (draft)", soId: "SO-2026-00399", state: "Draft", createdOn: "2026-10-08",
    itemIds: ["RAW-TBD-CRGO23"], qtyCap: 18000, valueCap: { amount: 72000, currency: "USD" }, exposure: { amount: 69300, currency: "USD" },
    revisionBasis: "Catalog core design CORE-5MVA rev F", riskClass: "Low", engineeringRequestId: "ER-TBD-0399",
    approvals: [], cancellationFees: 8000, stpIds: [], ecoImpacts: [] },
]

// ===================================================================== RFQs (S-34) and responses
const rfq = (id: RfqRec["id"], title: string, status: RfqRec["status"], createdOn: ISODate, dueOn: ISODate, vendorIds: VendorId[], lines: RfqRec["lines"], extra: Partial<RfqRec> = {}): RfqRec => ({
  id, title, status, createdOn, dueOn, vendorIds, lines, sealed: true, createdBy: BUYER_A, buyerId: BUYER_A, activity: [{ at: createdOn, by: "Buyer", text: "RFQ created" }],
  prIds: [], technicalReviewed: false, poIds: [], ...extra,
})
export const SEED_RFQS: RfqRec[] = [
  rfq("RFQ-TBD-0301", "RFQ: OLTC, three vendors, sealed", "Awarded", "2026-01-28", "2026-02-06", ["VEN-TBD-0103", "VEN-TBD-0121", "VEN-TBD-0122"], [{ no: 10, itemId: "RAW-TBD-OLTC", qty: 1, stpId: "STP-000301" }],
    { prIds: ["PR-TBD-0301"], technicalReviewed: true, awardedVendorId: "VEN-TBD-0103", awardNote: "Lowest landed cost; technical pass on STP-000301", poIds: ["PO-TBD-0301"] }),
  rfq("RFQ-TBD-0397", "RFQ: HV bushings 145 kV, replacement for recall batch", "Responses In", "2026-10-06", "2026-10-08", ["VEN-TBD-0104", "VEN-TBD-0112", "VEN-TBD-0123"], [{ no: 10, itemId: "RAW-TBD-BSH145", qty: 6, stpId: "STP-000303" }],
    { prIds: ["PR-TBD-0397"] }),
  rfq("RFQ-TBD-0402", "RFQ: CRGO steel 2027 annual price agreement", "Issued", "2026-10-01", "2026-10-21", ["VEN-TBD-0101", "VEN-TBD-0124"], [{ no: 10, itemId: "RAW-TBD-CRGO23", qty: 400000 }], { buyerId: BUYER_A }),
  rfq("RFQ-TBD-0403", "RFQ: bushing current transformers 600:5", "Draft", "2026-10-09", "2026-10-30", ["VEN-TBD-0115", "VEN-TBD-0110"], [{ no: 10, itemId: "RAW-TBD-CT600", qty: 9 }], { prIds: ["PR-TBD-0385"], buyerId: BUYER_A, sealed: false }),
  rfq("RFQ-TBD-0388", "RFQ: radiator panel banks 2026 H2", "Cancelled", "2026-07-02", "2026-07-20", ["VEN-TBD-0108", "VEN-TBD-0106"], [{ no: 10, itemId: "RAW-TBD-RAD", qty: 120 }], { cancelReason: "Contract price extended with Heartland Radiator Works; RFQ not needed", sealed: false }),
  rfq("RFQ-TBD-0379", "RFQ: copper foil 1.0 mm, 2026 contract", "Awarded", "2026-03-03", "2026-03-20", ["VEN-TBD-0102", "VEN-TBD-0125"], [{ no: 10, itemId: "RAW-TBD-FOIL", qty: 60000 }], { technicalReviewed: true, awardedVendorId: "VEN-TBD-0102", awardNote: "Lowest landed; domestic", sealed: false }),
]
const resp = (rfqId: RfqResp["rfqId"], vendorId: VendorId, price: number, leadDays: number, extra: Partial<RfqResp> = {}): RfqResp => ({
  rfqId, vendorId, prices: [{ line: 10, price, leadDays }], received: true, receivedOn: "2026-02-05", freightPct: 3, dutyPct: 0, validUntil: "2026-04-30", buyAmerica: false, ...extra,
})
export const SEED_RESPONSES: RfqResp[] = [
  resp("RFQ-TBD-0301", "VEN-TBD-0103", 74500, 70, { technicalPass: true, freightPct: 2.5, dutyPct: 0, technicalNote: "Meets STP-000301" }),
  resp("RFQ-TBD-0301", "VEN-TBD-0121", 71900, 112, { technicalPass: false, freightPct: 2, buyAmerica: true, technicalNote: "Diverter switch rating below 400 A" }),
  resp("RFQ-TBD-0301", "VEN-TBD-0122", 76800, 84, { technicalPass: true, freightPct: 4.5, dutyPct: 2.5, technicalNote: "Meets STP-000301; longer cable box" }),
  resp("RFQ-TBD-0397", "VEN-TBD-0104", 19450, 98, { receivedOn: "2026-10-08", freightPct: 4, dutyPct: 0, validUntil: "2026-12-31", technicalNote: "Exception raised on STP-000303 gasket compound" }),
  resp("RFQ-TBD-0397", "VEN-TBD-0112", 17800, 63, { receivedOn: "2026-10-07", freightPct: 2, dutyPct: 0, buyAmerica: true, validUntil: "2026-12-15" }),
  resp("RFQ-TBD-0397", "VEN-TBD-0123", 20900, 77, { receivedOn: "2026-10-08", freightPct: 3, dutyPct: 0, buyAmerica: true, validUntil: "2027-01-31" }),
  resp("RFQ-TBD-0402", "VEN-TBD-0101", 3.79, 45, { received: true, receivedOn: "2026-10-07", validUntil: "2027-12-31", buyAmerica: true }),
  resp("RFQ-TBD-0402", "VEN-TBD-0124", 0, 0, { received: false, receivedOn: undefined }),
  resp("RFQ-TBD-0379", "VEN-TBD-0102", 12.1, 21, { receivedOn: "2026-03-18", technicalPass: true, buyAmerica: true, validUntil: "2026-12-31" }),
  resp("RFQ-TBD-0379", "VEN-TBD-0125", 11.95, 35, { receivedOn: "2026-03-19", technicalPass: true, freightPct: 5.5, validUntil: "2026-12-31" }),
]

// ===================================================================== purchase orders (S-35, S-36)
type L = [no: number, itemId: MaterialId, qty: number, price: number, status: PoLineX["status"], needBy: ISODate, extra?: Partial<PoLineX>]
const line = ([no, itemId, qty, price, status, needBy, extra]: L): PoLineX => ({
  no, itemId, qty, price, status, needBy, schedules: [{ no: 10, qty, date: needBy }], received: status === "Received" || status === "Closed" ? qty : 0,
  invoiced: status === "Closed" ? qty : 0, promiseHistory: [], ...extra,
})
const po = (id: PoRec["id"], title: string, status: PoRec["status"], vendorId: VendorId, createdOn: ISODate, lines: L[], extra: Partial<PoRec> = {}): PoRec => ({
  id, title, status, vendorId, createdOn, createdBy: extra.buyerId ?? BUYER_A, buyerId: BUYER_A, changePending: false, entityId: "LE-TBD-10", currency: "USD",
  activity: [{ at: createdOn, by: "Buyer", text: "PO created" }], type: "Standard", shipToWarehouseId: "WH-TBD-01", qualityClauses: [], buyAmerica: false,
  prIds: [], lines: lines.map(line), revision: 0, revisions: [], expedite: [], ...extra,
})

export const SEED_POS: PoRec[] = [
  // ---- hero thread
  po("PO-TBD-0301", "PO to Rheinwerk Tap Changers: 1 x OLTC", "Matched/Closed", "VEN-TBD-0103", "2026-02-10",
    [[10, "RAW-TBD-OLTC", 1, 74500, "Closed", "2026-04-20", { stpId: "STP-000301", llrFlag: true, confirmedDate: "2026-04-17", peg: { type: "salesOrder", id: "SO-2026-00301" } }]],
    { llrId: "LLR-2026-0004", prIds: ["PR-TBD-0301"], rfqId: "RFQ-TBD-0301", qualityClauses: ["Q1", "Q2", "Q4"], sentOn: "2026-02-11", confirmedOn: "2026-02-13",
      invoice: { no: "RTC-26-01188", on: "2026-04-24", lines: [{ line: 10, price: 74500 }] } }),
  po("PO-TBD-0302", "PO to Hanseong Porcelain & Polymer: 9 x HV bushing 145 kV", "Matched/Closed", "VEN-TBD-0104", "2026-02-12",
    [[10, "RAW-TBD-BSH145", 9, 18900, "Closed", "2026-05-01", { stpId: "STP-000302", confirmedDate: "2026-04-30", peg: { type: "salesOrder", id: "SO-2026-00301" } }]],
    { prIds: ["PR-TBD-0301"], qualityClauses: ["Q1", "Q4"], sentOn: "2026-02-12", confirmedOn: "2026-02-16", invoice: { no: "HPP-2604-0071", on: "2026-05-11", lines: [{ line: 10, price: 18950 }] } }),
  po("PO-TBD-0377", "PO to Northstar Electrical Steel: CRGO 54,000 kg", "In Approval", "VEN-TBD-0101", "2026-10-05",
    [[10, "RAW-TBD-CRGO23", 54000, 3.85, "Open", "2026-12-15", { llrFlag: true, peg: { type: "plannedOrder", id: "PLO-TBD-0377" }, schedules: [{ no: 10, qty: 27000, date: "2026-12-01" }, { no: 20, qty: 27000, date: "2026-12-15" }] }]],
    { llrId: "LLR-2026-0011", prIds: ["PR-TBD-0377"], qualityClauses: ["Q1"], buyAmerica: true }),
  po("PO-TBD-0378", "PO to Rheinwerk Tap Changers: 3 x OLTC, phase 2", "Draft", "VEN-TBD-0103", "2026-10-07",
    [[10, "RAW-TBD-OLTC", 3, 74500, "Open", "2027-01-10", { stpId: "STP-000304", llrFlag: true, peg: { type: "plannedOrder", id: "PLO-TBD-0377" } }]],
    { llrId: "LLR-2026-0011", prIds: ["PR-TBD-0380"], qualityClauses: ["Q1", "Q2", "Q4"] }),
  // ---- open business
  po("PO-TBD-0310", "Copper CTC for October power-unit windings", "Sent", "VEN-TBD-0102", "2026-09-30",
    [[10, "RAW-TBD-CTC", 18000, 13.4, "Open", "2026-11-02"]], { sentOn: "2026-10-02", qualityClauses: ["Q1"] }),
  po("PO-TBD-0311", "Transformer oil, Q4 bulk deliveries", "Confirmed", "VEN-TBD-0105", "2026-09-12",
    [[10, "RAW-TBD-OIL", 60000, 1.92, "Open", "2026-10-06", { confirmedDate: "2026-10-14", schedules: [{ no: 10, qty: 20000, date: "2026-10-06" }, { no: 20, qty: 20000, date: "2026-11-03" }, { no: 30, qty: 20000, date: "2026-12-01" }] }]],
    { sentOn: "2026-09-14", confirmedOn: "2026-09-16", buyerId: BUYER_B }),
  po("PO-TBD-0312", "Tank plate for 20 MVA tanks", "Partially Received", "VEN-TBD-0106", "2026-08-25",
    [[10, "RAW-TBD-PLATE", 42000, 1.36, "Partial", "2026-09-22", { received: 21000, confirmedDate: "2026-09-22", schedules: [{ no: 10, qty: 21000, date: "2026-09-08" }, { no: 20, qty: 21000, date: "2026-09-22" }] }]],
    { sentOn: "2026-08-26", confirmedOn: "2026-08-28", qualityClauses: ["Q1"] }),
  po("PO-TBD-0313", "Kraft insulation paper, Q3", "Received", "VEN-TBD-0107", "2026-08-18",
    [[10, "RAW-TBD-KRAFT", 9500, 11.7, "Received", "2026-09-30", { confirmedDate: "2026-09-29" }]],
    { currency: "CAD", sentOn: "2026-08-19", confirmedOn: "2026-08-21", buyerId: BUYER_B }),
  po("PO-TBD-0314", "Radiator banks for SO-2026-00393", "Approved", "VEN-TBD-0108", "2026-10-06",
    [[10, "RAW-TBD-RAD", 24, 2380, "Open", "2026-11-26", { peg: { type: "salesOrder", id: "SO-2026-00393" } }]]),
  po("PO-TBD-0315", "Topcoat paint, ANSI 70 gray", "Cancelled", "VEN-TBD-0113", "2026-08-14",
    [[10, "CONS-TBD-PAINT", 1200, 22.5, "Cancelled", "2026-09-10"]], { cancelReason: "Vendor Disqualified 2026-08-20 after third overdue SCAR; requirement re-sourced", sentOn: "2026-08-15", buyerId: BUYER_B }),
  po("PO-TBD-0316", "CRGO for pad-mount cores", "Confirmed", "VEN-TBD-0101", "2026-09-02",
    [[10, "RAW-TBD-CRGO23", 20000, 3.85, "Open", "2026-10-20", { confirmedDate: "2026-10-20" }], [20, "RAW-TBD-CRGO23", 4000, 3.85, "Cancelled", "2026-10-20"]],
    { sentOn: "2026-09-03", confirmedOn: "2026-09-05", changePending: true, revision: 1,
      revisions: [{ rev: 1, on: "2026-10-07", by: BUYER_A, reapproval: false, changes: [{ field: "Line 10 quantity", old: "20,000 kg", new: "24,000 kg" }, { field: "Line 20", old: "Open", new: "Cancelled (merged into line 10)" }] }] }),
  po("PO-TBD-0317", "Copper CTC annual blanket 2027", "Draft", "VEN-TBD-0102", "2026-10-01",
    [[10, "RAW-TBD-CTC", 85000, 13.4, "Open", "2027-01-04", { schedules: [{ no: 10, qty: 21250, date: "2027-01-04" }, { no: 20, qty: 21250, date: "2027-04-05" }, { no: 30, qty: 21250, date: "2027-07-05" }, { no: 40, qty: 21250, date: "2027-10-04" }] }]],
    { prIds: ["PR-TBD-0398"], qualityClauses: ["Q1"] }),
  po("PO-TBD-0318", "Welding wire ER70S-6", "Draft", "VEN-TBD-0106", "2026-10-06", [[10, "CONS-TBD-WELD", 2000, 4.1, "Open", "2026-10-28"]], { prIds: ["PR-TBD-0391"], buyerId: BUYER_B }),
  po("PO-TBD-0320", "Subcontract: hot-dip galvanizing, radiator headers", "Draft", "VEN-TBD-0106", "2026-10-04",
    [[10, "SERV-TBD-GALV", 420000, 0.6, "Open", "2026-12-10"]],
    { type: "Subcontract", prIds: ["PR-TBD-0396"], provided: [{ itemId: "RAW-TBD-PLATE", qty: 18000, issued: false }] }),
  po("PO-TBD-0321", "LV bushings 15 kV", "Sent", "VEN-TBD-0112", "2026-09-08",
    [[10, "RAW-TBD-BSH015", 40, 1240, "Open", "2026-10-01", { stpId: "STP-000305" }]],
    { sentOn: "2026-09-10", buyerId: BUYER_B, restrictedOverride: { by: PM, on: "2026-09-09", reason: "Sole stock source for Q3 pad-mount build; SCAR response plan received" } }),
  po("PO-TBD-0322", "Intercompany: surge arresters from PE Grid Components", "Confirmed", "VEN-TBD-0120", "2026-09-18",
    [[10, "TRADE-TBD-ARR", 300, 98.56, "Open", "2026-10-20", { confirmedDate: "2026-10-20" }]],
    { type: "Intercompany", prIds: ["PR-TBD-0399"], sentOn: "2026-09-18", confirmedOn: "2026-09-18", buyerId: BUYER_B,
      ic: { sellerEntityId: "LE-TBD-20", pairedSo: "SO-TBD-IC-0022", transferPriceListId: "PL-PRC-TBD-IC26" } }),
  po("PO-TBD-0323", "Intercompany: fault indicators from PE Grid Components", "Draft", "VEN-TBD-0120", "2026-10-08",
    [[10, "TRADE-TBD-FCI", 500, 79, "Open", "2026-11-12"]],
    { type: "Intercompany", buyerId: BUYER_B, ic: { sellerEntityId: "LE-TBD-20", pairedSo: "SO-TBD-IC-0023", transferPriceListId: "PL-PRC-TBD-IC26" } }),
  po("PO-TBD-0324", "Oil for September tanking", "Matched/Closed", "VEN-TBD-0105", "2026-08-03",
    [[10, "RAW-TBD-OIL", 30000, 1.95, "Closed", "2026-08-31", { confirmedDate: "2026-08-31" }]],
    { sentOn: "2026-08-04", confirmedOn: "2026-08-05", invoice: { no: "GLD-88412", on: "2026-09-08", lines: [{ line: 10, price: 1.95 }] } }),
  po("PO-TBD-0325", "CTC for August windings", "Received", "VEN-TBD-0102", "2026-07-20",
    [[10, "RAW-TBD-CTC", 16000, 13.85, "Received", "2026-09-15", { confirmedDate: "2026-09-12" }]], { sentOn: "2026-07-21", confirmedOn: "2026-07-23" }),
  po("PO-TBD-0326", "Topcoat paint, ANSI 70 gray (re-sourced)", "Partially Received", "VEN-TBD-0106", "2026-08-28",
    [[10, "CONS-TBD-PAINT", 1200, 23.4, "Partial", "2026-09-25", { received: 800, confirmedDate: "2026-09-29" }]], { prIds: ["PR-TBD-0394"], sentOn: "2026-08-29", confirmedOn: "2026-09-01", buyerId: BUYER_B }),
  po("PO-TBD-0327", "Tap changer for Lac-Saint-Jean 33 MVA (LLR)", "Confirmed", "VEN-TBD-0103", "2026-08-20",
    [[10, "RAW-TBD-OLTC", 1, 78200, "Open", "2026-12-04", { llrFlag: true, confirmedDate: "2026-12-11", peg: { type: "salesOrder", id: "SO-2026-00396" } }]],
    { llrId: "LLR-2026-0009", sentOn: "2026-08-21", confirmedOn: "2026-08-25", qualityClauses: ["Q1", "Q2", "Q4"],
      ecoImpact: [{ ecoId: "ECO-TBD-0038", on: "2026-10-02", note: "Tap range changed from 17 to 19 positions; commercial decision needed on LLR-2026-0009" }] }),
  po("PO-TBD-0328", "Radiator banks for pad-mount Q4", "Confirmed", "VEN-TBD-0108", "2026-09-15",
    [[10, "RAW-TBD-RAD", 40, 2380, "Open", "2026-10-02", { confirmedDate: "2026-10-02" }]], { sentOn: "2026-09-15", confirmedOn: "2026-09-17", buyerId: BUYER_B }),
  po("PO-TBD-0329", "Copper foil, pad-mount LV coils", "Matched/Closed", "VEN-TBD-0102", "2026-07-06",
    [[10, "RAW-TBD-FOIL", 7000, 12.1, "Closed", "2026-08-03", { confirmedDate: "2026-08-03" }]],
    { sentOn: "2026-07-06", confirmedOn: "2026-07-08", invoice: { no: "KCC-55120", on: "2026-08-12", lines: [{ line: 10, price: 12.1 }] } }),
  po("PO-TBD-0330", "Calibration services, test lab instruments", "Sent", "VEN-TBD-0114", "2026-10-07",
    [[10, "NSTK-TBD-CAL", 1, 7900, "Open", "2026-10-31"]], { sentOn: "2026-10-08", buyerId: BUYER_B }),
]

export const SEED_GRNS: GrnRec[] = [
  { id: "GRN-TBD-0300", poId: "PO-TBD-0301", on: "2026-04-21", batches: [], serials: ["SN-TBD-OLTC-0301"], postedBy: "USR-TBD-017", lines: [{ poLine: 10, itemId: "RAW-TBD-OLTC", qty: 1, price: 74500, std: 74500 }] },
  { id: "GRN-TBD-0301", poId: "PO-TBD-0302", on: "2026-05-04", batches: ["BAT-TBD-B0301"], serials: ["SN-TBD-BSH-0301", "SN-TBD-BSH-0302", "SN-TBD-BSH-0303", "SN-TBD-BSH-0304", "SN-TBD-BSH-0305", "SN-TBD-BSH-0306", "SN-TBD-BSH-0307", "SN-TBD-BSH-0308", "SN-TBD-BSH-0309"], postedBy: "USR-TBD-017", lines: [{ poLine: 10, itemId: "RAW-TBD-BSH145", qty: 9, price: 18900, std: 18900 }] },
  { id: "GRN-TBD-0312", poId: "PO-TBD-0312", on: "2026-09-08", batches: ["BAT-TBD-P0912"], serials: [], postedBy: "USR-TBD-017", lines: [{ poLine: 10, itemId: "RAW-TBD-PLATE", qty: 21000, price: 1.36, std: 1.35 }] },
  { id: "GRN-TBD-0313", poId: "PO-TBD-0313", on: "2026-09-29", batches: ["BAT-TBD-K0929"], serials: [], postedBy: "USR-TBD-017", lines: [{ poLine: 10, itemId: "RAW-TBD-KRAFT", qty: 9500, price: 11.7, std: 11.7 }] },
  { id: "GRN-TBD-0324", poId: "PO-TBD-0324", on: "2026-08-31", batches: ["BAT-TBD-O0831"], serials: [], postedBy: "USR-TBD-017", lines: [{ poLine: 10, itemId: "RAW-TBD-OIL", qty: 30000, price: 1.95, std: 1.92 }] },
  { id: "GRN-TBD-0325", poId: "PO-TBD-0325", on: "2026-09-14", batches: ["BAT-TBD-C0914"], serials: [], postedBy: "USR-TBD-017", lines: [{ poLine: 10, itemId: "RAW-TBD-CTC", qty: 16000, price: 13.85, std: 13.4 }] },
  { id: "GRN-TBD-0326", poId: "PO-TBD-0326", on: "2026-09-29", batches: ["BAT-TBD-T0929"], serials: [], postedBy: "USR-TBD-017", lines: [{ poLine: 10, itemId: "CONS-TBD-PAINT", qty: 800, price: 23.4, std: 22.5 }] },
  { id: "GRN-TBD-0329", poId: "PO-TBD-0329", on: "2026-08-03", batches: ["BAT-TBD-F0803"], serials: [], postedBy: "USR-TBD-017", lines: [{ poLine: 10, itemId: "RAW-TBD-FOIL", qty: 7000, price: 12.1, std: 12.1 }] },
]

export const SEED_MRP_EXCEPTIONS: MrpException[] = [
  { id: "MX-TBD-0101", code: "EX-02", text: "Expedite: need 2026-10-26, confirmed 2026-11-02", itemId: "RAW-TBD-CTC", poId: "PO-TBD-0310", line: 10, suggestedDate: "2026-10-26", peg: { type: "salesOrder", id: "SO-2026-00393" }, buyerId: BUYER_A },
  { id: "MX-TBD-0102", code: "EX-06", text: "Past due: schedule 10 due 2026-10-06, not received", itemId: "RAW-TBD-OIL", poId: "PO-TBD-0311", line: 10, suggestedDate: "2026-10-12", peg: { type: "salesOrder", id: "SO-2026-00377" }, buyerId: BUYER_B },
  { id: "MX-TBD-0103", code: "EX-03", text: "De-expedite: requirement moved to 2027-01-18", itemId: "RAW-TBD-OLTC", poId: "PO-TBD-0327", line: 10, suggestedDate: "2027-01-18", peg: { type: "salesOrder", id: "SO-2026-00396" }, buyerId: BUYER_A },
  { id: "MX-TBD-0104", code: "EX-01", text: "New requirement without supply: bushing CTs for PLO-TBD-0377", itemId: "RAW-TBD-CT600", peg: { type: "plannedOrder", id: "PLO-TBD-0377" }, buyerId: BUYER_A },
  { id: "MX-TBD-0105", code: "EX-06", text: "Past due: line 10 due 2026-10-01, vendor Restricted", itemId: "RAW-TBD-BSH015", poId: "PO-TBD-0321", line: 10, suggestedDate: "2026-10-15", buyerId: BUYER_B },
  { id: "MX-TBD-0106", code: "EX-02", text: "Expedite: radiators needed 2026-10-02 for WO-TBD-0388 tanking", itemId: "RAW-TBD-RAD", poId: "PO-TBD-0328", line: 10, suggestedDate: "2026-10-02", peg: { type: "productionOrder", id: "WO-TBD-0388" }, buyerId: BUYER_B },
  { id: "MX-TBD-0107", code: "EX-06", text: "Past due: schedule 20 due 2026-09-22", itemId: "RAW-TBD-PLATE", poId: "PO-TBD-0312", line: 10, suggestedDate: "2026-10-13", peg: { type: "salesOrder", id: "SO-2026-00377" }, buyerId: BUYER_A },
]

// ===================================================================== cost estimates (S-38)
// CE-TBD-0301 totals are the spine values: material 612,400, labor 118,900, overhead 147,300,
// subcontract 70,000, total 948,600. Itemization below sums to them exactly.
const WC_HOURS_0301: [WorkCenterId, number, number, number][] = [
  // [WC, hours, labor rate 2025, overhead rate 2025]
  ["WC-050", 520, 46, 40], ["WC-100", 150, 44, 38], ["WC-110", 220, 44, 38], ["WC-200", 170, 47, 41], ["WC-210", 430, 48, 43],
  ["WC-220", 160, 46, 40], ["WC-230", 95, 40, 62], ["WC-300", 280, 47, 41], ["WC-310", 120, 46, 40], ["WC-320", 80, 44, 46],
  ["WC-400", 180, 48, 42], ["WC-500", 56, 55, 58], ["WC-600", 70, 42, 36], ["WC-700", 50, 41, 34],
]
const wcName = (id: string) => WORK_CENTERS.find((w) => w.id === id)?.name ?? id
const mat = (text: string, ref: string | undefined, qty: number, unit: string, rate: number, source: CeRec["items"][number]["source"], note?: string): CeRec["items"][number] => ({
  component: "Material", text, ref, qty, unit, rate, value: Math.round(qty * rate * 100) / 100, source, note,
})
const items0301: CeRec["items"] = [
  mat("CRGO core steel 0.23 mm", "RAW-TBD-CRGO23", 36000, "kg", 3.85, "Driver rate"),
  mat("CTC copper, HV windings", "RAW-TBD-CTC", 12500, "kg", 13.4, "Driver rate"),
  mat("Copper foil, LV windings", "RAW-TBD-FOIL", 4000, "kg", 12.1, "Standard"),
  mat("Transformer oil", "RAW-TBD-OIL", 24000, "L", 1.92, "Standard"),
  mat("Tank plate A572", "RAW-TBD-PLATE", 22000, "kg", 1.35, "Standard"),
  mat("Kraft and pressboard insulation", "RAW-TBD-KRAFT", 2500, "kg", 8.6, "Standard"),
  mat("HV bushings 145 kV", "RAW-TBD-BSH145", 3, "EA", 18900, "AVL basis"),
  mat("On-load tap changer, 17 positions", "RAW-TBD-OLTC", 1, "EA", 74500, "AVL basis", "Quote per STP"),
  mat("Radiator panel banks", "RAW-TBD-RAD", 8, "EA", 2380, "Standard"),
  mat("LV bushings, CTs, gaskets, accessories", undefined, 1, "lot", 10380, "Manual override", "Estimator allowance from FIN-TBD-5000SS actuals scaled to 20 MVA"),
  ...WC_HOURS_0301.map(([wc, h, l]): CeRec["items"][number] => ({ component: "Labor", text: `${wcName(wc)} labor`, ref: wc, qty: h, unit: "h", rate: l, value: h * l, source: "WC rate" })),
  { component: "Overhead", text: "Material overhead, procurement and handling burden (blended 6.48% of material)", qty: 1, unit: "lot", rate: 39702, value: 39702, source: "Driver rate" },
  ...WC_HOURS_0301.map(([wc, h, , o]): CeRec["items"][number] => ({ component: "Overhead", text: `${wcName(wc)} production overhead`, ref: wc, qty: h, unit: "h", rate: o, value: h * o, source: "WC rate" })),
  { component: "Subcontract", text: "Tank fabrication overflow, Prairie Plate & Fab (op 20)", ref: "VEN-TBD-0106", qty: 1, unit: "lot", rate: 61000, value: 61000, source: "AVL basis" },
  { component: "Subcontract", text: "Hot-dip galvanizing, radiator headers", ref: "SERV-TBD-GALV", qty: 15000, unit: "kg", rate: 0.6, value: 9000, source: "Standard" },
]

const sumBy = (items: CeRec["items"], c: CeRec["items"][number]["component"]) => Math.round(items.filter((i) => i.component === c).reduce((s, i) => s + i.value, 0) * 100) / 100
export function ceTotals(items: CeRec["items"]) {
  const material = sumBy(items, "Material"), labor = sumBy(items, "Labor"), overhead = sumBy(items, "Overhead"), subcontract = sumBy(items, "Subcontract")
  return { material, labor, overhead, subcontract, total: Math.round((material + labor + overhead + subcontract) * 100) / 100 }
}
const scale = (items: CeRec["items"], f: number, overrides: Record<string, number> = {}): CeRec["items"] =>
  items.map((i) => {
    const qty = overrides[i.ref ?? ""] ?? (i.unit === "EA" || i.unit === "lot" ? i.qty : Math.round(i.qty * f))
    const value = i.unit === "lot" ? Math.round(i.value * f) : Math.round(qty * i.rate * 100) / 100
    return { ...i, qty, value, rate: i.unit === "lot" ? Math.round(i.value * f) : i.rate }
  })
const ce = (id: CeRec["id"], itemId: MaterialId, status: CeRec["status"], title: string, basis: CeRec["basis"], createdOn: ISODate, items: CeRec["items"], extra: Partial<CeRec> = {}): CeRec => ({
  id, itemId, status, title, basis, version: 1, createdOn, createdBy: ESTIMATOR, items, ...ceTotals(items), ...extra,
})
const items0300 = scale(items0301, 0.97, { "RAW-TBD-OLTC": 1 })
const items0377 = items0301.map((i) => (i.ref === "RAW-TBD-BSH145" ? { ...i, rate: 19450, value: 3 * 19450, note: "Replacement bushings to STP-000303 (RFQ-TBD-0397 basis)" } : i.ref === "RAW-TBD-CRGO23" ? { ...i, rate: 3.79, value: Math.round(36000 * 3.79 * 100) / 100, note: "RFQ-TBD-0402 2027 basis" } : i))
const DRIVERS_20 = [
  { name: "Core weight", qty: 36000, unit: "kg" }, { name: "Copper weight (CTC + foil)", qty: 16500, unit: "kg" }, { name: "Oil volume", qty: 6340, unit: "gal" },
  { name: "Tank steel weight", qty: 22000, unit: "kg" }, { name: "HV bushings 145 kV", qty: 3, unit: "EA" }, { name: "OLTC 17 positions", qty: 1, unit: "EA" },
]
const smallItems = (itemId: MaterialId, matVal: number, labHours: number): CeRec["items"] => [
  { component: "Material", text: "Released MBOM components at standard", ref: itemId, qty: 1, unit: "lot", rate: matVal, value: matVal, source: "Standard" },
  { component: "Labor", text: "Routing labor at released WC rates", ref: "WC-300", qty: labHours, unit: "h", rate: 48.5, value: Math.round(labHours * 48.5 * 100) / 100, source: "WC rate" },
  { component: "Overhead", text: "Production overhead at released WC rates", ref: "WC-300", qty: labHours, unit: "h", rate: 42.5, value: Math.round(labHours * 42.5 * 100) / 100, source: "WC rate" },
]
export const SEED_CES: CeRec[] = [
  ce("CE-TBD-0300", "FIN-TBD-20MVA", "Superseded", "Cost estimate, FIN-TBD-20MVA, Omaha North, original tap range", "Parametric ETO model", "2025-11-26", items0300,
    { quotationId: "QT-TBD-0301-V1", releasedOn: "2025-11-28", supersededBy: "CE-TBD-0301", drivers: DRIVERS_20 }),
  ce("CE-TBD-0301", "FIN-TBD-20MVA", "Released", "Cost estimate, FIN-TBD-20MVA, Omaha North configuration", "Parametric ETO model", "2025-12-01", items0301,
    { quotationId: "QT-TBD-0301-V2", version: 2, releasedOn: "2025-12-01", drivers: DRIVERS_20, lastActual: 972350 }),
  ce("CE-TBD-0377", "FIN-TBD-20MVA", "Released", "Cost estimate, phase 2, three units from rev B with bushing change (per unit)", "Draft EBOM", "2026-05-27", items0377,
    { quotationId: "QT-TBD-0377-V1", releasedOn: "2026-05-28", lastActual: 972350 }),
  ce("CE-TBD-0402", "FIN-TBD-7500MTO", "Released", "Cost estimate, 7.5 MVA stainless pad-mount (MTO)", "Released MBOM + routing", "2026-09-28", smallItems("FIN-TBD-7500MTO", 151200, 410),
    { quotationId: "QT-TBD-0402-V1", releasedOn: "2026-09-29" }),
  ce("CE-TBD-0420", "FIN-TBD-5000SS", "Draft", "Standard simulation, 5 MVA secondary unit substation", "Released MBOM + routing", "2026-10-07", smallItems("FIN-TBD-5000SS", 112600, 395), { quotationId: "QT-TBD-0420-V2", lastActual: 151880 }),
  ce("CE-TBD-0421", "FIN-TBD-20MVA", "Draft", "Budgetary estimate, 25 MVA variant for Fraser Delta", "Parametric ETO model", "2026-10-08",
    scale(items0301, 1.18, { "RAW-TBD-OLTC": 1, "RAW-TBD-BSH145": 3 }), { drivers: DRIVERS_20.map((d) => (d.unit === "EA" ? d : { ...d, qty: Math.round(d.qty * 1.18) })) }),
  ce("CE-TBD-0410", "FIN-TBD-2500PM", "Released", "Standard simulation, 2,500 kVA pad-mount", "Released MBOM + routing", "2026-09-02", smallItems("FIN-TBD-2500PM", 44100, 152)),
  ce("CE-TBD-0409", "FIN-TBD-2500PM", "Superseded", "Standard simulation, 2,500 kVA pad-mount (pre copper reset)", "Released MBOM + routing", "2026-06-02", smallItems("FIN-TBD-2500PM", 46300, 152), { releasedOn: "2026-06-03", supersededBy: "CE-TBD-0410" }),
  ce("CE-TBD-0411", "SEMI-TBD-CORE25", "Draft", "Engineering what-if, 2,500 kVA core (draft EBOM)", "Draft EBOM", "2026-10-05", smallItems("SEMI-TBD-CORE25", 9800, 28)),
  ce("CE-TBD-0396", "FIN-TBD-20MVA", "Released", "Cost estimate, Lac-Saint-Jean 33 MVA (parametric)", "Parametric ETO model", "2026-07-30",
    scale(items0301, 1.42, { "RAW-TBD-OLTC": 1, "RAW-TBD-BSH145": 3 }), { releasedOn: "2026-07-31" }),
]

// ===================================================================== costing runs and WC rates
export const SEED_RUNS: RunRec[] = [
  { id: "CR-TBD-2026A", period: "2026-01", scope: "Plant PL-TBD-01, all standard-cost items", scopeKind: "All standard-cost items", marked: true, released: true, stage: "Released",
    createdOn: "2025-12-15", createdBy: COST_ACC, markedBy: COST_ACC, releasedBy: CONTROLLER, releasedOn: "2026-01-02", effectiveFrom: "2026-01-01",
    items: [
      { itemId: "FIN-TBD-2500PM", oldStd: 59400, newStd: 61200, onHand: 4 }, { itemId: "FIN-TBD-1000PM", oldStd: 31900, newStd: 32640, onHand: 6 },
      { itemId: "FIN-TBD-5000SS", oldStd: 146200, newStd: 149900, onHand: 1 }, { itemId: "SEMI-TBD-CORE20", oldStd: 93100, newStd: 96400, onHand: 1 },
      { itemId: "RAW-TBD-CTC", oldStd: 12.95, newStd: 13.4, onHand: 21400 }, { itemId: "RAW-TBD-CRGO23", oldStd: 3.72, newStd: 3.85, onHand: 38200 },
    ] },
  { id: "CR-TBD-2026W40", period: "2026-10", scope: "New items only (weekly)", scopeKind: "New items only", marked: true, released: false, stage: "Marked",
    createdOn: "2026-10-05", createdBy: COST_ACC, markedBy: COST_ACC,
    items: [{ itemId: "SPARE-TBD-OLTCK", oldStd: 3900, newStd: 4020, onHand: 14 }, { itemId: "SPARE-TBD-GSKT20", oldStd: 640, newStd: 655, onHand: 22 }, { itemId: "PACK-TBD-CRATE", oldStd: 185, newStd: 192, onHand: 60 }] },
  { id: "CR-TBD-2026W41", period: "2026-10", scope: "Changed-BOM flag only", scopeKind: "Changed-BOM flag only", marked: false, released: false, stage: "Rolled",
    createdOn: "2026-10-08", createdBy: COST_ACC,
    items: [
      { itemId: "FIN-TBD-1000PM", oldStd: 32640, newStd: 33120, onHand: 6 }, { itemId: "SEMI-TBD-CORE25", oldStd: 0, newStd: 0, onHand: 0, error: "Missing rate: WC-600 in Maintenance, no released rate" },
      { itemId: "RAW-TBD-CT600", oldStd: 0, newStd: 0, onHand: 0, error: "Missing AVL basis: no rank-1 vendor" },
    ] },
]

/** Planned hours = capacity h/day x 250 working days x efficiency 85% (250 days is a design value). */
const plannedHours = (wc: WorkCenterId) => {
  const w = WORK_CENTERS.find((x) => x.id === wc)!
  return Math.round(w.capacityHoursPerDay * 250 * (w.efficiencyPct / 100))
}
const RATE_2025: Record<string, [number, number, number]> = Object.fromEntries(WC_HOURS_0301.map(([wc, , l, o]) => [wc, [l, o, wc === "WC-100" || wc === "WC-210" || wc === "WC-230" ? 18 : 0]]))
const RATE_2026: Record<string, [number, number, number]> = Object.fromEntries(
  Object.entries(RATE_2025).map(([wc, [l, o, m]]) => [wc, [Math.round(l * 1.04 * 100) / 100, Math.round(o * 1.03 * 100) / 100, m ? Math.round(m * 1.05 * 100) / 100 : 0]]),
)
const rateRec = (wc: WorkCenterId, validFrom: ISODate, [l, o, m]: [number, number, number], state: WcRateRec["state"]): WcRateRec => {
  const h = plannedHours(wc)
  const mh = m ? Math.round(h * 0.8) : 0
  return { workCenterId: wc, validFrom, laborRate: l, overheadRate: o, machineRate: m, plannedHours: h, machineHours: mh,
    plannedLaborCost: Math.round(l * h), plannedOverheadPool: Math.round(o * h), plannedMachinePool: Math.round(m * mh), state, releasedBy: state === "Released" ? CONTROLLER : undefined }
}
export const SEED_WC_RATES: WcRateRec[] = [
  ...WORK_CENTERS.map((w) => rateRec(w.id, "2025-01-01", RATE_2025[w.id], "Released")),
  ...WORK_CENTERS.map((w) => rateRec(w.id, "2026-01-01", RATE_2026[w.id], "Released")),
]

// ===================================================================== price lists (S-39), agreements, surcharges
const SELLABLE = MATERIALS.filter((m) => m.listPrice != null && (m.type === "FIN" || m.type === "TRADE" || m.type === "SPARE" || m.type === "SERV"))
const rows = (f: (p: number) => number, validFrom: ISODate) => SELLABLE.filter((m) => m.status !== "Obsolete" || validFrom < "2026-01-01").map((m) => ({ itemId: m.id, price: f(m.listPrice!), validFrom }))
const plist = (id: PriceList["id"], code: string, name: string, currency: PriceListRec["currency"], status: PriceListRec["status"], validFrom: ISODate, r: PriceListRec["rates"], extra: Partial<PriceListRec> = {}): PriceListRec => ({
  id, code, name, currency, status, validFrom, rates: r, entityId: currency === "CAD" ? "LE-TBD-30" : "LE-TBD-10", basis: "Manual rates", rounding: "Nearest $1",
  history: [{ on: validFrom, by: PRICING, text: "Created" }], ...extra,
})
export const SEED_PRICE_LISTS: PriceListRec[] = [
  plist("PL-PRC-TBD-US26", "WHOLESALE-US", "US wholesale 2026", "USD", "Active", "2026-01-01", rows((p) => p, "2026-01-01"), { validTo: "2026-12-31" }),
  plist("PL-PRC-TBD-CA26", "WHOLESALE-CA", "Canada wholesale 2026", "CAD", "Active", "2026-01-01", rows((p) => Math.round(p * 1.36), "2026-01-01"),
    { basis: "Derived", derivation: "US wholesale 2026 x 1.36 (fixed booked rate, OQ-42)", validTo: "2026-12-31" }),
  plist("PL-PRC-TBD-US27", "WHOLESALE-US", "US wholesale 2027 (mass update +4.5%)", "USD", "Draft", "2027-01-01", rows((p) => Math.round(p * 1.045), "2027-01-01"),
    { basis: "Derived", derivation: "US wholesale 2026 + 4.5%, rounded to nearest $1" }),
  plist("PL-PRC-TBD-GC27", "DISTRIB", "Distributor list 2027, grid components", "USD", "Pending Approval", "2027-01-01",
    SELLABLE.filter((m) => m.type === "TRADE").map((m) => ({ itemId: m.id, price: Math.round(m.listPrice! * 0.92), validFrom: "2027-01-01" })), { entityId: "LE-TBD-20", derivation: "Grid components list less 8% for distributors", basis: "Derived" }),
  plist("PL-PRC-TBD-US25", "WHOLESALE-US", "US wholesale 2025", "USD", "Archived", "2025-01-01", rows((p) => Math.round(p * 0.96), "2025-01-01"), { validTo: "2025-12-31" }),
  plist("PL-PRC-TBD-IC26", "TRANSFER", "Intercompany transfer prices 2026 (PE Grid Components to PE Transformer)", "USD", "Active", "2026-01-01",
    SELLABLE.filter((m) => m.type === "TRADE").map((m) => ({ itemId: m.id, price: Math.round((m.stdCost ?? 0) * 112) / 100, validFrom: "2026-01-01" })),
    { entityId: "LE-TBD-20", transfer: true, basis: "Derived", derivation: "Seller standard cost + 12% (transfer price maintenance: Controlling only)", rounding: "Two decimals" }),
]

const cp = (customerId: CustomerPrice["customerId"], itemId: MaterialId, price: number, validFrom: ISODate, validTo?: ISODate): CustomerPrice => ({ customerId, itemId, price, validFrom, validTo })
export const SEED_AGREEMENTS: AgreementRec[] = [
  { id: "AGR-TBD-0048", customerId: "CUS-TBD-0048", name: "Omaha North substation framework, phases 1 and 2", validFrom: "2025-12-19", validTo: "2027-12-31", scope: "FIN-TBD-20MVA, spares", contractTerm: "Ship-Date Adjusted",
    attachment: "MPGC-PE-framework-signed.pdf", rebate: "None", rows: [cp("CUS-TBD-0048", "FIN-TBD-20MVA", 1284000, "2025-12-19", "2027-12-31"), cp("CUS-TBD-0048", "SPARE-TBD-BSH145", 25200, "2025-12-19", "2027-12-31")] },
  { id: "AGR-TBD-0031", customerId: "CUS-TBD-0031", name: "Prairie Ridge distribution supply 2026", validFrom: "2026-01-01", validTo: "2026-12-31", scope: "Pad-mount and pole-mount families", contractTerm: "Fixed at Order",
    attachment: "PREC-supply-2026.pdf", rebate: "1.5% volume rebate above $1.5M shipped (accrual note to ACC)", rows: [cp("CUS-TBD-0031", "FIN-TBD-2500PM", 76900, "2026-01-01", "2026-12-31"), cp("CUS-TBD-0031", "FIN-TBD-0167PL", 6790, "2026-01-01", "2026-12-31")] },
  { id: "AGR-TBD-0009", customerId: "CUS-TBD-0009", name: "Volt Co. distributor terms", validFrom: "2026-03-01", validTo: "2027-02-28", scope: "Grid components (TRADE)", contractTerm: "Fixed at Order",
    attachment: "VoltCo-distributor-agreement.pdf", rebate: "None", rows: [cp("CUS-TBD-0009", "TRADE-TBD-ARR", 131, "2026-03-01", "2027-02-28"), cp("CUS-TBD-0009", "TRADE-TBD-FCI", 99, "2026-03-01", "2027-02-28")] },
  { id: "AGR-TBD-0044", customerId: "CUS-TBD-0044", name: "Lac-Saint-Jean framework (CAD)", validFrom: "2026-02-01", validTo: "2027-01-31", scope: "Pad-mount 1,000 kVA", contractTerm: "Fixed at Order",
    attachment: "CELSJ-cadre-2026.pdf", rows: [cp("CUS-TBD-0044", "FIN-TBD-1000PM", 55900, "2026-02-01", "2027-01-31")] },
]

export const SEED_SURCHARGES: SurchargeRec[] = [
  { id: "SUR-TBD-001", commodity: "Copper", index: "COMEX copper $/lb", baseValue: 4.1, shareOfPricePct: 100, passThroughPct: 100, shipDateAdjusted: false, family: "Pad-mount 2,500 kVA", itemIds: ["FIN-TBD-2500PM"], contentPerUnit: 1850, contentUnit: "lb", validFrom: "2026-01-01", maintainedBy: PRICING },
  { id: "SUR-TBD-002", commodity: "Copper", index: "COMEX copper $/lb", baseValue: 4.1, shareOfPricePct: 100, passThroughPct: 100, shipDateAdjusted: false, family: "Pad-mount 1,000 kVA", itemIds: ["FIN-TBD-1000PM"], contentPerUnit: 980, contentUnit: "lb", validFrom: "2026-01-01", maintainedBy: PRICING },
  { id: "SUR-TBD-003", commodity: "Copper", index: "COMEX copper $/lb", baseValue: 4.05, shareOfPricePct: 100, passThroughPct: 100, shipDateAdjusted: true, family: "Power transformers 20 MVA (ETO)", itemIds: ["FIN-TBD-20MVA"], contentPerUnit: 36376, contentUnit: "lb", validFrom: "2025-12-01", maintainedBy: PRICING },
  { id: "SUR-TBD-004", commodity: "CRGO", index: "CRGO basis $/kg", baseValue: 3.6, shareOfPricePct: 100, passThroughPct: 100, shipDateAdjusted: true, family: "Power transformers 20 MVA (ETO)", itemIds: ["FIN-TBD-20MVA"], contentPerUnit: 36000, contentUnit: "kg", validFrom: "2025-12-01", maintainedBy: PRICING },
  { id: "SUR-TBD-005", commodity: "Copper", index: "COMEX copper $/lb", baseValue: 4.1, shareOfPricePct: 100, passThroughPct: 75, shipDateAdjusted: false, family: "Pole-mount 167 kVA", itemIds: ["FIN-TBD-0167PL"], contentPerUnit: 140, contentUnit: "lb", validFrom: "2026-01-01", maintainedBy: PRICING },
]
const COPPER = [4.02, 4.08, 4.12, 4.19, 4.27, 4.22, 4.31, 4.4, 4.46, 4.38, 4.52, 4.61]
const CRGO = [3.55, 3.58, 3.6, 3.62, 3.66, 3.7, 3.74, 3.77, 3.79, 3.82, 3.85, 3.88]
const MONTHS12 = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
export const SEED_INDEX_VALUES: IndexRec[] = [
  ...MONTHS12.map((m, i): IndexRec => ({ index: "COMEX copper $/lb", month: m, value: COPPER[i], postedOn: `${m}-03`, postedBy: COST_ACC, source: "COMEX monthly average, first business day" })),
  ...MONTHS12.map((m, i): IndexRec => ({ index: "CRGO basis $/kg", month: m, value: CRGO[i], postedOn: `${m}-03`, postedBy: COST_ACC, source: "Published internal basis (Costing)" })),
]

// ===================================================================== controlling (Book I H)
export const SEED_ADDED_CCS: AddedCostCenter[] = [
  { id: "CC-1450", name: "Legacy Coil Repair", parentId: "CC-1000", postable: true, entityId: "LE-TBD-10", defaultProfitCenterId: "PC-400", status: "Inactive", validFrom: "2019-01-01", validTo: "2025-12-31" },
]
const skf = (cc: CostCenterId, headcount: number, sqft: number, machineHours: number, laborHours: number, revenueShare: number): SkfValue => ({ costCenterId: cc, period: "2026-Q3", headcount, sqft, machineHours, laborHours, revenueShare })
export const SEED_SKF: SkfValue[] = [
  skf("CC-1100", 14, 18000, 4200, 6400, 0), skf("CC-1150", 22, 26000, 1800, 10200, 0), skf("CC-1200", 31, 22000, 5100, 14600, 0), skf("CC-1250", 4, 6000, 6200, 1900, 0),
  skf("CC-1300", 26, 24000, 900, 12100, 0), skf("CC-1400", 18, 16000, 300, 8300, 0), skf("CC-1500", 11, 9000, 1200, 4800, 0), skf("CC-1600", 7, 8000, 400, 3100, 0),
  skf("CC-1700", 9, 12000, 200, 4000, 0), skf("CC-2000", 12, 30000, 0, 0, 0), skf("CC-3000", 19, 5000, 0, 0, 0), skf("CC-4000", 9, 2500, 0, 0, 0),
  skf("CC-5000", 16, 4000, 0, 0, 100), skf("CC-9100", 4, 1500, 0, 0, 0), skf("CC-9200", 8, 2000, 0, 0, 0), skf("CC-9300", 6, 1800, 0, 0, 0), skf("CC-9400", 4, 1200, 0, 0, 0),
]
const PROD = ["CC-1100", "CC-1150", "CC-1200", "CC-1250", "CC-1300", "CC-1400", "CC-1500", "CC-1600", "CC-1700"] as CostCenterId[]
export const SEED_CYCLES: AllocCycleRec[] = [
  { id: "ALC-CYC-01", name: "Facilities to occupants by floor space", sequence: 1, entityId: "LE-TBD-10", senderCostCenterIds: ["CC-9500"], receiverCostCenterIds: [...PROD, "CC-2000", "CC-3000", "CC-4000", "CC-5000"], driver: "Sq Ft", period: "2026-10", status: "Defined",
    segments: [{ no: 10, senderIds: ["CC-9500"], accountRange: "6000-6999", receiverIds: [...PROD, "CC-2000", "CC-3000", "CC-4000", "CC-5000"], driver: "Sq Ft" }] },
  { id: "ALC-CYC-02", name: "IT to all centers by headcount", sequence: 2, entityId: "LE-TBD-10", senderCostCenterIds: ["CC-9300"], receiverCostCenterIds: [...PROD, "CC-2000", "CC-3000", "CC-4000", "CC-5000"], driver: "Headcount", period: "2026-10", status: "Posted",
    segments: [{ no: 10, senderIds: ["CC-9300"], accountRange: "6000-6999", receiverIds: [...PROD, "CC-2000", "CC-3000", "CC-4000", "CC-5000"], driver: "Headcount" }] },
  { id: "ALC-CYC-03", name: "Finance and HR to operations by headcount", sequence: 3, entityId: "LE-TBD-10", senderCostCenterIds: ["CC-9200", "CC-9400"], receiverCostCenterIds: [...PROD, "CC-2000", "CC-4000"], driver: "Headcount", period: "2026-10", status: "Simulated",
    segments: [{ no: 10, senderIds: ["CC-9200"], accountRange: "6000-6999", receiverIds: [...PROD, "CC-2000", "CC-4000"], driver: "Headcount" }, { no: 20, senderIds: ["CC-9400"], accountRange: "6000-6999", receiverIds: [...PROD, "CC-2000", "CC-4000"], driver: "Headcount" }] },
  { id: "ALC-CYC-04", name: "Warehousing to production by labor hours", sequence: 4, entityId: "LE-TBD-10", senderCostCenterIds: ["CC-2000"], receiverCostCenterIds: PROD, driver: "Labor Hours", period: "2026-10", status: "Reversed",
    segments: [{ no: 10, senderIds: ["CC-2000"], accountRange: "6000-6999", receiverIds: PROD, driver: "Labor Hours" }] },
]
/** Sender balances by period, account range 6000-6999 (design values). */
export const SENDER_BALANCES: Record<string, Record<string, number>> = {
  "2026-08": { "CC-9500": 148200, "CC-9300": 96400, "CC-9200": 121700, "CC-9400": 54300, "CC-2000": 88900 },
  "2026-09": { "CC-9500": 151900, "CC-9300": 98100, "CC-9200": 118300, "CC-9400": 55900, "CC-2000": 91200 },
  "2026-10": { "CC-9500": 146600, "CC-9300": 97800, "CC-9200": 124100, "CC-9400": 56200, "CC-2000": 90400 },
}

// ===================================================================== variances (Part A §8) and journal
let rnd = 20261009
const rand = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648)
const PERIODS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
let jeSeq = 41000
const je = (): `JE-${string}` => `JE-TBD-${++jeSeq}`
const vr = (type: VarianceType, period: string, day: number, variance: number, stdBasis: number, qty: number, source: VarianceRow["source"], cc: CostCenterId, pc: VarianceRow["profitCenterId"], extra: Partial<VarianceRow> = {}): VarianceRow => ({
  id: `VAR-${type}-${period}-${jeSeq}`, type, period, on: `${period}-${String(day).padStart(2, "0")}`, variance: Math.round(variance * 100) / 100, stdBasis: Math.round(stdBasis * 100) / 100,
  actual: Math.round((stdBasis + variance) * 100) / 100, qty, source, journalId: je(), costCenterId: cc, profitCenterId: pc, ...extra,
})
function buildVariances(): VarianceRow[] {
  const out: VarianceRow[] = []
  // PPV from the seeded GRNs (actual PO price - standard) x qty
  for (const g of SEED_GRNS)
    for (const l of g.lines) {
      const v = (l.price - l.std) * l.qty
      if (Math.abs(v) < 0.005) continue
      const pc = MATERIALS.find((m) => m.id === l.itemId)?.profitCenterId ?? "PC-900"
      out.push(vr("PPV", g.on.slice(0, 7), Number(g.on.slice(8)), v, l.std * l.qty, l.qty, { type: "grn", id: g.id }, "CC-2000", pc, { itemId: l.itemId, vendorId: SEED_POS.find((p) => p.id === g.poId)?.vendorId }))
    }
  // IPV on the hero bushing PO: invoice 18,950 vs PO 18,900 x 9
  out.push(vr("IPV", "2026-05", 11, 450, 170100, 9, { type: "purchaseOrder", id: "PO-TBD-0302" }, "CC-2000", "PC-200", { itemId: "RAW-TBD-BSH145", vendorId: "VEN-TBD-0104" }))
  out.push(vr("IPV", "2026-09", 8, 0, 58500, 30000, { type: "purchaseOrder", id: "PO-TBD-0324" }, "CC-2000", "PC-200", { itemId: "RAW-TBD-OIL", vendorId: "VEN-TBD-0105" }))
  // Hero WO settlement, Aug 2026 (WO-TBD-0301): MUV / LRV / LEV / OAV
  const wo0301 = { type: "productionOrder" as const, id: "WO-TBD-0301" }
  out.push(vr("MUV", "2026-08", 6, 9840, 612400, 1, wo0301, "CC-1300", "PC-200", { itemId: "FIN-TBD-20MVA" }))
  out.push(vr("LRV", "2026-08", 6, 2310, 118900, 2581, wo0301, "CC-1200", "PC-200", { workCenterId: "WC-210", itemId: "FIN-TBD-20MVA" }))
  out.push(vr("LEV", "2026-08", 6, 6880, 118900, 2581, wo0301, "CC-1200", "PC-200", { workCenterId: "WC-210", itemId: "FIN-TBD-20MVA" }))
  out.push(vr("OAV", "2026-08", 6, 4420, 147300, 2581, wo0301, "CC-1300", "PC-200", { workCenterId: "WC-300", itemId: "FIN-TBD-20MVA" }))
  // Production variances on MTS orders, every period
  const woItems: [MaterialId, number][] = [["FIN-TBD-2500PM", 61200], ["FIN-TBD-1000PM", 32640], ["FIN-TBD-0167PL", 5410], ["FIN-TBD-5000SS", 149900]]
  const wcs: [WorkCenterId, CostCenterId][] = [["WC-200", "CC-1200"], ["WC-210", "CC-1200"], ["WC-300", "CC-1300"], ["WC-400", "CC-1400"], ["WC-100", "CC-1100"], ["WC-050", "CC-1150"]]
  let woSeq = 250
  for (const p of PERIODS)
    for (const [item, s] of woItems) {
      const n = item === "FIN-TBD-0167PL" ? 3 : 2
      for (let k = 0; k < n; k++) {
        const wo = { type: "productionOrder" as const, id: `WO-TBD-0${++woSeq}` }
        const pc = item === "FIN-TBD-5000SS" ? "PC-200" : "PC-100"
        const [wc, cc] = wcs[Math.floor(rand() * wcs.length)]
        const mat = s * 0.66, lab = s * 0.14, oh = s * 0.2
        out.push(vr("MUV", p, 3 + k * 7, mat * (rand() * 0.05 - 0.015), mat, 1, wo, "CC-1300", pc, { itemId: item }))
        out.push(vr("LRV", p, 3 + k * 7, lab * (rand() * 0.04 - 0.012), lab, Math.round(lab / 48), wo, cc, pc, { itemId: item, workCenterId: wc }))
        out.push(vr("LEV", p, 3 + k * 7, lab * (rand() * 0.1 - 0.03), lab, Math.round(lab / 48), wo, cc, pc, { itemId: item, workCenterId: wc }))
        out.push(vr("OAV", p, 3 + k * 7, oh * (rand() * 0.06 - 0.03), oh, Math.round(lab / 48), wo, cc, pc, { itemId: item, workCenterId: wc }))
      }
    }
  // PPV / IPV volume on raw materials each period
  const raws: [MaterialId, VendorId, number, number][] = [["RAW-TBD-CTC", "VEN-TBD-0102", 13.4, 9000], ["RAW-TBD-CRGO23", "VEN-TBD-0101", 3.85, 18000], ["RAW-TBD-OIL", "VEN-TBD-0105", 1.92, 25000], ["RAW-TBD-FOIL", "VEN-TBD-0102", 12.1, 5000], ["RAW-TBD-KRAFT", "VEN-TBD-0107", 8.6, 3000], ["RAW-TBD-RAD", "VEN-TBD-0108", 2380, 20]]
  let grnSeq = 200
  for (const p of PERIODS.slice(0, 5))
    for (const [item, ven, s, q] of raws) {
      const price = s * (1 + (rand() * 0.06 - 0.02))
      const g = { type: "grn" as const, id: `GRN-TBD-0${++grnSeq}` }
      const pc = MATERIALS.find((m) => m.id === item)?.profitCenterId ?? "PC-200"
      out.push(vr("PPV", p, 9 + Math.floor(rand() * 15), (price - s) * q, s * q, q, g, "CC-2000", pc, { itemId: item, vendorId: ven }))
      out.push(vr("IPV", p, 20 + Math.floor(rand() * 8), price * q * (rand() * 0.008 - 0.002), price * q, q, g, "CC-2000", pc, { itemId: item, vendorId: ven }))
    }
  // SPV: subcontract galvanizing and tank fabrication
  for (const p of PERIODS) out.push(vr("SPV", p, 18, 9000 * (rand() * 0.08 - 0.02), 9000, 15000, { type: "purchaseOrder", id: "PO-TBD-0320" }, "CC-1150", "PC-200", { itemId: "SERV-TBD-GALV", vendorId: "VEN-TBD-0106" }))
  // RVV: annual costing run release 2026-01 is outside the six periods; a mid-year release in June
  out.push(vr("RVV", "2026-06", 30, 4280, 182600, 21400, { type: "material", id: "RAW-TBD-CTC" }, "CC-2000", "PC-200", { itemId: "RAW-TBD-CTC" }))
  out.push(vr("RVV", "2026-06", 30, -1910, 61200, 4, { type: "material", id: "FIN-TBD-2500PM" }, "CC-2000", "PC-100", { itemId: "FIN-TBD-2500PM" }))
  // A return to vendor: mirror-image PPV flagged Reversal
  out.push(vr("PPV", "2026-09", 24, -900, 21000 * 1.35, -2000, { type: "grn", id: "GRN-TBD-0312" }, "CC-2000", "PC-200", { itemId: "RAW-TBD-PLATE", vendorId: "VEN-TBD-0106", reversal: true }))
  return out
}
export const SEED_VARIANCES: VarianceRow[] = buildVariances()

/** Monthly journal summary per cost center for the controlling reports (design values). */
const CC_BASE: Record<string, number> = {
  "CC-1100": 61000, "CC-1150": 92000, "CC-1200": 118000, "CC-1250": 38000, "CC-1300": 104000, "CC-1400": 76000, "CC-1500": 52000, "CC-1600": 33000, "CC-1700": 41000,
  "CC-2000": 90000, "CC-3000": 142000, "CC-4000": 68000, "CC-5000": 121000, "CC-9100": 74000, "CC-9200": 122000, "CC-9300": 97000, "CC-9400": 55000, "CC-9500": 148000,
}
export const SEED_JOURNAL: JournalEntry[] = (() => {
  const out: JournalEntry[] = []
  for (const p of PERIODS)
    for (const [cc, base] of Object.entries(CC_BASE)) {
      const pc = cc.startsWith("CC-1") ? (cc === "CC-1700" ? "PC-100" : "PC-200") : cc === "CC-5000" ? "PC-100" : "PC-900"
      const groups: [string, number][] = [["Personnel 6100-6199", 0.58], ["Materials and supplies 6200-6299", 0.14], ["Facilities and utilities 6300-6399", 0.12], ["Depreciation 6600-6699", 0.1], ["Other 6900-6999", 0.06]]
      for (const [g, share] of groups)
        out.push({ id: je(), on: `${p}-28`, period: p, template: "ACC expense", text: g, amount: Math.round(base * share * (0.94 + rand() * 0.12)), currency: "USD", costCenterId: cc as CostCenterId, profitCenterId: pc as JournalEntry["profitCenterId"], rule: 1 })
    }
  // rule-7 fallbacks and a posting to a blocked center for the CO-R4 exception report
  out.push({ id: je(), on: "2026-10-03", period: "2026-10", template: "ACC expense", text: "Freight-in invoice without cost center (VEN-TBD-0116)", amount: 3840, currency: "USD", costCenterId: "CC-9000", profitCenterId: "PC-900", rule: 7, source: { type: "purchaseOrder", id: "PO-TBD-0311" } })
  out.push({ id: je(), on: "2026-10-06", period: "2026-10", template: "ACC expense", text: "Janitorial services posted to CC-9500 while Blocked", amount: 1260, currency: "USD", costCenterId: "CC-9500", profitCenterId: "PC-900", rule: 1 })
  out.push({ id: je(), on: "2026-09-29", period: "2026-09", template: "ACC expense", text: "Trade show booth, no PC on line", amount: 7400, currency: "USD", costCenterId: "CC-5000", profitCenterId: "PC-900", rule: 7 })
  return out
})()

/** Revenue and COGS by profit center and period for CO-R2 (design values). */
export const PC_PNL: Record<string, { revenue: number; cogs: number }> = {
  "PC-100": { revenue: 2410000, cogs: 1792000 },
  "PC-200": { revenue: 3180000, cogs: 2401000 },
  "PC-300": { revenue: 412000, cogs: 331000 },
  "PC-400": { revenue: 268000, cogs: 171000 },
  "PC-900": { revenue: 0, cogs: 0 },
}

// ===================================================================== margin facts (PRC-MARG)
export interface QuoteMargin { quoteId: string; customerId: string; itemId: MaterialId; ceId?: string; price: number; cost: number; floorPct?: number; approval?: string; outcome: "Won" | "Lost" | "Open" | "Superseded" }
export const SEED_QUOTE_MARGINS: QuoteMargin[] = [
  { quoteId: "QT-TBD-0301-V1", customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", ceId: "CE-TBD-0300", price: 1262000, cost: 920142, outcome: "Superseded" },
  { quoteId: "QT-TBD-0301-V2", customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", ceId: "CE-TBD-0301", price: 1284000, cost: 948600, outcome: "Won" },
  { quoteId: "QT-TBD-0377-V1", customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", ceId: "CE-TBD-0377", price: 1284000, cost: 949485, outcome: "Won" },
  { quoteId: "QT-TBD-0402-V1", customerId: "CUS-TBD-0027", itemId: "FIN-TBD-7500MTO", ceId: "CE-TBD-0402", price: 243700, cost: 188510, outcome: "Won" },
  { quoteId: "QT-TBD-0412-V2", customerId: "CUS-TBD-0031", itemId: "FIN-TBD-2500PM", price: 76900, cost: 61200, floorPct: 22, approval: "APR-TBD-0081 Pricing Manager, Sales Director (2026-10-02)", outcome: "Open" },
  { quoteId: "QT-TBD-0416-V1", customerId: "CUS-TBD-0027", itemId: "FIN-TBD-0167PL", price: 6800, cost: 5410, floorPct: 22, outcome: "Open" },
  { quoteId: "QT-TBD-0420-V2", customerId: "CUS-TBD-0044", itemId: "FIN-TBD-5000SS", price: 253300, cost: 149900, outcome: "Open" },
  { quoteId: "QT-TBD-0414-V1", customerId: "CUS-TBD-0044", itemId: "FIN-TBD-1000PM", price: 55900, cost: 44390, floorPct: 22, outcome: "Won" },
  { quoteId: "QT-TBD-0387-V1", customerId: "CUS-TBD-0031", itemId: "FIN-TBD-0167PL", price: 6790, cost: 5410, floorPct: 22, approval: "APR-TBD-0066 Pricing Manager, Sales Director (2026-09-24)", outcome: "Won" },
  { quoteId: "QT-TBD-0391-V1", customerId: "CUS-TBD-0009", itemId: "TRADE-TBD-ARR", price: 104, cost: 88, floorPct: 18, approval: "APR-TBD-0059 Pricing Manager, Sales Director, CFO (2026-09-10)", outcome: "Lost" },
  { quoteId: "QT-TBD-0394-V1", customerId: "CUS-TBD-0041", itemId: "FIN-TBD-1000PM", price: 41850, cost: 32640, floorPct: 22, outcome: "Lost" },
]
/** Three-view order margin (Book I I §7): quoted vs estimate, standard at PGI, actual at settlement. */
export interface OrderMargin { soId: string; line: number; itemId: MaterialId; price: number; estimate?: number; standardAtPgi?: number; actual?: number }
export const SEED_ORDER_MARGINS: OrderMargin[] = [
  { soId: "SO-2026-00301", line: 10, itemId: "FIN-TBD-20MVA", price: 1284000, estimate: 948600, standardAtPgi: 948600, actual: 972350 },
  { soId: "SO-2026-00377", line: 10, itemId: "FIN-TBD-20MVA", price: 3852000, estimate: 2848455 },
  { soId: "SO-2026-00402", line: 10, itemId: "FIN-TBD-7500MTO", price: 243700, estimate: 188510 },
  { soId: "SO-2026-00380", line: 10, itemId: "FIN-TBD-1000PM", price: 223600, estimate: 130560, standardAtPgi: 130560, actual: 133120 },
  { soId: "SO-2026-00387", line: 10, itemId: "FIN-TBD-0167PL", price: 13580, estimate: 10820, standardAtPgi: 10820, actual: 10955 },
]
