// Feature-list additions to the materials slice (12 October 2026): batch master, duplicate merge queue,
// bulk import jobs, consignment withdrawals and settlements, ownership tags, plant sourcing (dormant
// until DEC-07), statistical safety stock, GR/IR open items for the valuation-change variant, and
// EBOM-ahead notes. Types, seed and pure selectors only; the actions are in ext-actions.ts.
// Rows marked "design" are prototype values the PRD does not give; they are shown as readings.

import type { ISODate, Material, UserId, VendorId, WarehouseId } from "@/data/domain"
import type { StockRow } from "./types"
import { U } from "./seed"

// ------------------------------------------------------------------ batch master (Book II §15.1)
/** §15.1 batch status words. Unrestricted, QI Hold and Blocked are S-28 rows; Consumed and Expired are not. */
export type BatchStatus = "Unrestricted" | "QI Hold" | "Blocked" | "Consumed" | "Expired"
export interface BatchCert {
  name: string
  ref: string
  attachedOn: ISODate
}
export interface BatchRecord {
  id: string
  materialId: Material["id"]
  vendorId?: VendorId
  vendorBatch?: string
  /** Heat number: the traceability key for CRGO and copper. */
  heatNo?: string
  poId?: string
  grnId?: string
  mfgDate?: ISODate
  receiptDate: ISODate
  expiry?: ISODate
  coo?: string
  certs: BatchCert[]
  status: BatchStatus
  /** Measured characteristics copied from incoming inspection (search: "all CRGO batches with loss at or under X"). */
  characteristics: { key: string; value: number; unit: string; source: string }[]
  alert?: string
}

// ------------------------------------------------------------------ duplicate merge queue (Book IV §7.1)
export interface DupeCandidate {
  id: string
  aId: Material["id"]
  bId: Material["id"]
  /** Trigram similarity from the matching job (design value), threshold 0.9 review, 0.97 auto-flag. */
  score: number
  basis: string
  decision?: { kind: "Not a duplicate" | "Merged"; note: string; by: UserId; on: ISODate; survivor?: Material["id"]; supersessionId?: string }
}

// ------------------------------------------------------------------ bulk import (Book II §16.2)
export interface ImportJob {
  id: string
  view: string
  fileName: string
  templateVersion: string
  uploadedOn: ISODate
  by: UserId
  rows: number
  outcome: "Rejected" | "Accepted"
  diffs: { column: string; issue: string }[]
  created: { kind: "MCR" | "MCH"; id: string }[]
  rowErrors: number
}

// ------------------------------------------------------------------ consignment (Book II §14.2)
export interface Withdrawal {
  id: string
  vendorId: VendorId
  materialId: Material["id"]
  qty: number
  uom: string
  on: ISODate
  /** The consuming document (issue to WO). */
  ref: string
  /** Settlement run that billed it. */
  settledIn?: string
}
export interface Settlement {
  id: string
  vendorId: VendorId
  period: string
  lines: { withdrawalId: string; materialId: Material["id"]; qty: number; basis: number; amount: number }[]
  total: number
  /** True-up delta posted to 5215 (Controller approval, rare by design). */
  trueUp: number
  postedOn: ISODate
  by: UserId
  billRef: string
}

// ------------------------------------------------------------------ ownership tags on GRN and WO (Book II §14.1-14.3)
export type OwnerTag = "Consignment" | "Customer Property"
export interface OwnershipTag {
  id: string
  docType: "GRN" | "WO"
  docId: string
  line: number
  materialId: Material["id"]
  qty: number
  tag: OwnerTag
  owner: string
  zeroCost: boolean
  note?: string
}

// ------------------------------------------------------------------ plant sourcing (Book VII §4.1, §4.4)
export type SourceKind = "Own production" | "Transfer" | "Purchase"
export interface SourcingRow {
  id: string
  materialId: Material["id"]
  plantId: string
  rank: number
  source: SourceKind
  fromPlant?: string
  laneId?: string
  note?: string
}
export interface Lane {
  id: string
  from: string
  to: string
  transitDays: number
  mode: string
  active: boolean
}
export interface PlantSourcing {
  /** DEC-07 (multi-plant) has not fired: every row is dormant and MRP ignores it. */
  dec07: boolean
  plants: { id: string; name: string; status: "Active" | "Planned" }[]
  lanes: Lane[]
  rows: SourcingRow[]
}

// ------------------------------------------------------------------ statistical safety stock (Book I A §10.2, Phase 2)
export type AbcClass = "A" | "B" | "C"
export interface StatSafety {
  active: boolean
  activatedOn?: ISODate
  by?: UserId
  levels: Record<AbcClass, number>
  /** Suggested SS per safety-stock row id once activated (read-only columns on the grid). */
  suggestions: Record<string, { suggested: number; z: number; sigma: number; level: number; capped: boolean }>
}

// ------------------------------------------------------------------ valuation change variant (Book II §5.4)
export interface GrIrOpen {
  materialId: Material["id"]
  grnId: string
  poId: string
  qty: number
  value: number
  since: ISODate
}
/** Costing-run mark window (E-MM-22): the price unit cannot change while it is open (design dates). */
export interface MarkWindow {
  from: ISODate
  to: ISODate
  run: string
}

// ------------------------------------------------------------------ EBOM ahead (Book II §3.13, passthrough)
export interface EbomAhead {
  materialId: Material["id"]
  ebomRef: string
  ebomRev: string
  mbomRef: string
  mbomRev: string
  note: string
}

export interface MaterialsExt {
  batches: BatchRecord[]
  dupes: DupeCandidate[]
  imports: ImportJob[]
  withdrawals: Withdrawal[]
  settlements: Settlement[]
  tags: OwnershipTag[]
  plantSrc: PlantSourcing
  stat: StatSafety
  grir: GrIrOpen[]
  markWindow: MarkWindow
  ebomAhead: EbomAhead[]
  /** Parent to children, for the where-used explosion report (BOM is owned by engineering; design). */
  bom: { parent: Material["id"]; child: Material["id"]; qty: number }[]
}

const m = (id: string) => id as Material["id"]
const v = (id: string) => id as VendorId

// ------------------------------------------------------------------ seed
function seedBatches(): BatchRecord[] {
  const b = (id: string, materialId: string, o: Partial<BatchRecord> & { receiptDate: ISODate }): BatchRecord => ({
    id: `BAT-TBD-${id}`, materialId: m(materialId), certs: [], status: "Unrestricted", characteristics: [], ...o,
  })
  const loss = (x: number) => ({ key: "Core loss @1.7 T, 50 Hz", value: x, unit: "W/kg", source: "Incoming inspection" })
  return [
    b("B0301", "RAW-TBD-BSH145", { vendorId: v("VEN-TBD-0104"), vendorBatch: "HP-26-0412", poId: "PO-TBD-0302", grnId: "GRN-TBD-0301", receiptDate: "2026-05-04", mfgDate: "2026-03-30", coo: "KR", status: "Blocked", alert: "Blocked by recall RCL-2026-001: flange seal escape in vendor batch HP-26-0412", certs: [{ name: "CoC per Shipment", ref: "COC-HPP-0412", attachedOn: "2026-05-04" }], characteristics: [{ key: "Partial discharge", value: 4, unit: "pC", source: "Incoming inspection" }] }),
    b("C0911", "RAW-TBD-CRGO23", { vendorId: v("VEN-TBD-0101"), vendorBatch: "NS-4471", heatNo: "H-7734", poId: "PO-TBD-0341", grnId: "GRN-TBD-0911", receiptDate: "2026-09-11", mfgDate: "2026-08-20", coo: "US", certs: [{ name: "Mill Cert per Heat", ref: "MTR-H-7734", attachedOn: "2026-09-11" }], characteristics: [loss(0.88), { key: "Thickness", value: 0.23, unit: "mm", source: "Incoming inspection" }] }),
    b("C1006", "RAW-TBD-CRGO23", { vendorId: v("VEN-TBD-0101"), vendorBatch: "NS-4502", heatNo: "H-7790", poId: "PO-TBD-0341", grnId: "GRN-TBD-1006", receiptDate: "2026-10-06", mfgDate: "2026-09-18", coo: "US", status: "QI Hold", alert: "Waiting for the mill certificate (E-QM-06): GRN cannot accept until it is attached", certs: [], characteristics: [loss(0.97)] }),
    b("C0201", "RAW-TBD-CRGO23", { vendorId: v("VEN-TBD-0101"), vendorBatch: "NS-4188", heatNo: "H-7201", receiptDate: "2026-02-03", mfgDate: "2026-01-12", coo: "US", status: "Consumed", certs: [{ name: "Mill Cert per Heat", ref: "MTR-H-7201", attachedOn: "2026-02-03" }], characteristics: [loss(0.86)] }),
    b("C0312", "RAW-TBD-CRGO27", { vendorId: v("VEN-TBD-0101"), vendorBatch: "NS-3120", heatNo: "H-6120", receiptDate: "2025-03-18", mfgDate: "2025-02-24", coo: "US", certs: [{ name: "Mill Cert per Heat", ref: "MTR-H-6120", attachedOn: "2025-03-18" }], characteristics: [loss(1.02), { key: "Thickness", value: 0.27, unit: "mm", source: "Incoming inspection" }] }),
    b("K0920", "RAW-TBD-CTC", { vendorId: v("VEN-TBD-0102"), vendorBatch: "KC-0920", heatNo: "K-5521", receiptDate: "2026-09-18", mfgDate: "2026-08-30", coo: "US", certs: [{ name: "Conductivity cert", ref: "CND-K-5521", attachedOn: "2026-09-18" }], characteristics: [{ key: "Conductivity", value: 100.4, unit: "%IACS", source: "Incoming inspection" }] }),
    b("F0815", "RAW-TBD-FOIL", { vendorId: v("VEN-TBD-0102"), vendorBatch: "KF-0815", heatNo: "K-5388", receiptDate: "2026-08-15", coo: "US", certs: [{ name: "Conductivity cert", ref: "CND-K-5388", attachedOn: "2026-08-15" }], characteristics: [{ key: "Conductivity", value: 100.1, unit: "%IACS", source: "Incoming inspection" }] }),
    b("W0902", "RAW-TBD-CUWIRE", { vendorId: v("VEN-TBD-0102"), vendorBatch: "KW-0902", heatNo: "K-5497", receiptDate: "2026-09-02", coo: "US", certs: [{ name: "Conductivity cert", ref: "CND-K-5497", attachedOn: "2026-09-02" }], characteristics: [{ key: "Conductivity", value: 100.3, unit: "%IACS", source: "Incoming inspection" }] }),
    b("O0904", "RAW-TBD-OIL", { vendorId: v("VEN-TBD-0105"), vendorBatch: "GL-0904", receiptDate: "2026-09-04", mfgDate: "2026-08-22", expiry: "2027-03-04", coo: "US", certs: [{ name: "CoA", ref: "COA-GL-0904", attachedOn: "2026-09-04" }], characteristics: [{ key: "Breakdown voltage", value: 72, unit: "kV", source: "Incoming inspection" }, { key: "Moisture", value: 8, unit: "ppm", source: "Incoming inspection" }] }),
    b("O0919", "RAW-TBD-OIL", { vendorId: v("VEN-TBD-0105"), vendorBatch: "GL-0919", receiptDate: "2026-09-19", mfgDate: "2026-09-08", expiry: "2027-03-19", coo: "US", certs: [{ name: "CoA", ref: "COA-GL-0919", attachedOn: "2026-09-19" }], characteristics: [{ key: "Breakdown voltage", value: 70, unit: "kV", source: "Incoming inspection" }, { key: "Moisture", value: 9, unit: "ppm", source: "Incoming inspection" }], alert: "Consignment stock: vendor-owned until withdrawn (§14.2)" }),
    b("O0411", "RAW-TBD-OIL", { vendorId: v("VEN-TBD-0105"), vendorBatch: "GL-0411", receiptDate: "2025-04-11", mfgDate: "2025-03-30", expiry: "2026-09-30", coo: "US", status: "Expired", alert: "Expired on 30 Sep 2026: the nightly job moved the stock to Blocked and raised an alert", certs: [{ name: "CoA", ref: "COA-GL-0411", attachedOn: "2025-04-11" }], characteristics: [{ key: "Breakdown voltage", value: 69, unit: "kV", source: "Incoming inspection" }, { key: "Moisture", value: 11, unit: "ppm", source: "Incoming inspection" }] }),
    b("P0828", "RAW-TBD-KRAFT", { vendorId: v("VEN-TBD-0107"), vendorBatch: "LP-0828", receiptDate: "2026-08-28", mfgDate: "2026-08-10", expiry: "2026-10-25", coo: "CA", certs: [{ name: "CoC per Shipment", ref: "COC-LP-0828", attachedOn: "2026-08-28" }], characteristics: [{ key: "Moisture", value: 4.1, unit: "%", source: "Incoming inspection" }], alert: "Expires in 16 days: FEFO picks it first (V-MM-09)" }),
    b("P0710", "RAW-TBD-PRESS", { vendorId: v("VEN-TBD-0107"), vendorBatch: "LB-0710", receiptDate: "2026-07-10", coo: "CA", certs: [{ name: "CoC per Shipment", ref: "COC-LB-0710", attachedOn: "2026-07-10" }], characteristics: [{ key: "Density", value: 1.15, unit: "g/cm3", source: "Incoming inspection" }] }),
    b("S0908", "RAW-TBD-PLATE", { vendorId: v("VEN-TBD-0106"), vendorBatch: "PP-0908", heatNo: "S-8841", receiptDate: "2026-09-08", coo: "US", certs: [{ name: "Mill Cert per Heat", ref: "MTR-S-8841", attachedOn: "2026-09-08" }], characteristics: [{ key: "Yield strength", value: 365, unit: "MPa", source: "Incoming inspection" }] }),
    b("S0915", "RAW-TBD-PLATE", { vendorId: v("VEN-TBD-0106"), vendorBatch: "PP-0915", heatNo: "S-8870", receiptDate: "2026-09-15", coo: "US", certs: [{ name: "Mill Cert per Heat", ref: "MTR-S-8870", attachedOn: "2026-09-15" }], characteristics: [{ key: "Yield strength", value: 358, unit: "MPa", source: "Incoming inspection" }], alert: "At subcontractor VEN-TBD-0106 for galvanizing" }),
    b("L0612", "RAW-TBD-BSH015", { vendorId: v("VEN-TBD-0112"), vendorBatch: "TS-0612", receiptDate: "2026-06-12", coo: "US", certs: [{ name: "CoC per Shipment", ref: "COC-TS-0612", attachedOn: "2026-06-12" }] }),
    b("L0918", "RAW-TBD-BSH015B", { vendorId: v("VEN-TBD-0104"), vendorBatch: "HP-26-0918", receiptDate: "2026-09-18", coo: "KR", certs: [{ name: "CoC per Shipment", ref: "COC-HP-0918", attachedOn: "2026-09-18" }] }),
  ]
}

function seedDupes(): DupeCandidate[] {
  return [
    { id: "DUP-0001", aId: m("RAW-TBD-BSH015"), bId: m("RAW-TBD-BSH015B"), score: 0.93, basis: "Description trigram 0.93, same group L1 BSH Components" },
    { id: "DUP-0002", aId: m("RAW-TBD-BSH145"), bId: m("RAW-TBD-BSH145B"), score: 0.98, basis: "Description trigram 0.98 (auto-flag, at or above 0.97); manufacturer part HPP-COND-145-800 against -R2" },
    { id: "DUP-0003", aId: m("RAW-TBD-CRGO23"), bId: m("RAW-TBD-CRGO27"), score: 0.91, basis: "Description trigram 0.91, same group L1 CRG Core Steel", decision: { kind: "Not a duplicate", note: "Different lamination thickness (0.23 mm against 0.27 mm) and grade; both are bought and stocked.", by: U.steward, on: "2026-09-14" } },
    { id: "DUP-0004", aId: m("PACK-TBD-SKID"), bId: m("PACK-TBD-CRATE"), score: 0.9, basis: "Description trigram 0.90, same group L1 Packaging" },
  ]
}

function seedImports(): ImportJob[] {
  return [
    { id: "IMP-0007", view: "Planning", fileName: "planning-update-sep.csv", templateVersion: "v3", uploadedOn: "2026-09-29", by: U.planner, rows: 6, outcome: "Accepted", diffs: [], created: [{ kind: "MCH", id: "MCH-2026-0034" }], rowErrors: 1 },
    { id: "IMP-0008", view: "General", fileName: "general-load-wave2.csv", templateVersion: "v2", uploadedOn: "2026-10-05", by: U.steward, rows: 40, outcome: "Rejected", diffs: [{ column: "Group L3", issue: "Column removed in v3 (material groups are three levels, effective-dated)" }, { column: "Serial profile", issue: "Column added in v3" }], created: [], rowErrors: 0 },
  ]
}

function seedWithdrawals(): Withdrawal[] {
  return [
    { id: "WDR-0101", vendorId: v("VEN-TBD-0105"), materialId: m("RAW-TBD-OIL"), qty: 8000, uom: "L", on: "2026-08-12", ref: "WO-TBD-0371", settledIn: "CSD-2026-0008" },
    { id: "WDR-0102", vendorId: v("VEN-TBD-0105"), materialId: m("RAW-TBD-OIL"), qty: 6000, uom: "L", on: "2026-09-03", ref: "WO-TBD-0377" },
    { id: "WDR-0103", vendorId: v("VEN-TBD-0105"), materialId: m("RAW-TBD-OIL"), qty: 4000, uom: "L", on: "2026-09-17", ref: "WO-TBD-0379" },
    { id: "WDR-0104", vendorId: v("VEN-TBD-0105"), materialId: m("RAW-TBD-OIL"), qty: 3000, uom: "L", on: "2026-10-05", ref: "WO-TBD-0383" },
    { id: "WDR-0105", vendorId: v("VEN-TBD-0107"), materialId: m("RAW-TBD-KRAFT"), qty: 250, uom: "KG", on: "2026-09-09", ref: "WO-TBD-0377" },
    { id: "WDR-0106", vendorId: v("VEN-TBD-0107"), materialId: m("RAW-TBD-KRAFT"), qty: 180, uom: "KG", on: "2026-09-24", ref: "WO-TBD-0379" },
  ]
}
function seedSettlements(): Settlement[] {
  return [
    { id: "CSD-2026-0008", vendorId: v("VEN-TBD-0105"), period: "2026-08", lines: [{ withdrawalId: "WDR-0101", materialId: m("RAW-TBD-OIL"), qty: 8000, basis: 1.92, amount: 15360 }], total: 15360, trueUp: 0, postedOn: "2026-09-02", by: U.costAcc, billRef: "ACC-6 self-bill SB-TBD-0008" },
  ]
}

function seedTags(): OwnershipTag[] {
  return [
    { id: "TAG-001", docType: "GRN", docId: "GRN-TBD-0919", line: 1, materialId: m("RAW-TBD-OIL"), qty: 18000, tag: "Consignment", owner: "VEN-TBD-0105 until withdrawal", zeroCost: false, note: "Consignment PO type, no commitment value; memo quantity only (1311)" },
    { id: "TAG-002", docType: "GRN", docId: "GRN-TBD-0828", line: 1, materialId: m("RAW-TBD-KRAFT"), qty: 900, tag: "Consignment", owner: "VEN-TBD-0107 until withdrawal", zeroCost: false },
    { id: "TAG-003", docType: "GRN", docId: "GRN-TBD-0924", line: 1, materialId: m("RAW-TBD-GAUGE"), qty: 4, tag: "Customer Property", owner: "Midland Plains Grid Constructors", zeroCost: true, note: "Customer-supplied oil level gauges for SO-2026-00301; zero value, never in ATP, never in E&O" },
    { id: "TAG-004", docType: "WO", docId: "WO-TBD-0377", line: 60, materialId: m("RAW-TBD-GAUGE"), qty: 2, tag: "Customer Property", owner: "Midland Plains Grid Constructors", zeroCost: true, note: "Consumed without a material value; genealogy still records the consumption" },
    { id: "TAG-005", docType: "WO", docId: "WO-TBD-0377", line: 30, materialId: m("RAW-TBD-OIL"), qty: 6000, tag: "Consignment", owner: "VEN-TBD-0105 (converted at consumption)", zeroCost: false, note: "Withdrawal WDR-0102 wrote a settlement line" },
  ]
}

function seedPlantSrc(): PlantSourcing {
  return {
    dec07: false,
    plants: [
      { id: "PL-TBD-01", name: "PE Transformer plant, Fargo ND", status: "Active" },
      { id: "PL-TBD-02", name: "Second plant (planned, design value)", status: "Planned" },
    ],
    lanes: [
      { id: "LANE-01", from: "PL-TBD-01", to: "PL-TBD-02", transitDays: 3, mode: "Truck", active: true },
      { id: "LANE-02", from: "PL-TBD-02", to: "PL-TBD-01", transitDays: 4, mode: "Truck", active: false },
    ],
    rows: [
      { id: "PS-01", materialId: m("SEMI-TBD-CORE20"), plantId: "PL-TBD-02", rank: 1, source: "Transfer", fromPlant: "PL-TBD-01", laneId: "LANE-01", note: "Cores are cut in Fargo" },
      { id: "PS-02", materialId: m("RAW-TBD-CRGO23"), plantId: "PL-TBD-02", rank: 1, source: "Transfer", fromPlant: "PL-TBD-01", laneId: "LANE-01" },
      { id: "PS-03", materialId: m("RAW-TBD-CRGO23"), plantId: "PL-TBD-02", rank: 2, source: "Purchase", note: "Direct from VEN-TBD-0101 when Fargo cannot supply" },
      { id: "PS-04", materialId: m("RAW-TBD-OIL"), plantId: "PL-TBD-02", rank: 1, source: "Purchase" },
      { id: "PS-05", materialId: m("SEMI-TBD-TANK20"), plantId: "PL-TBD-01", rank: 1, source: "Transfer", fromPlant: "PL-TBD-02", laneId: "LANE-02", note: "Lane back to Fargo is inactive: raises EX-10 once the network engine is on" },
      { id: "PS-06", materialId: m("SEMI-TBD-CORE20"), plantId: "PL-TBD-01", rank: 1, source: "Own production" },
    ],
  }
}

/** Extra stock rows for the batch, special-stock and consignment screens (appended to seedStock). */
export function extraStock(): StockRow[] {
  const s = (id: string, materialId: string, qty: number, status: StockRow["status"], o: Partial<StockRow>): StockRow => ({
    id, materialId: m(materialId), warehouseId: "WH-TBD-01" as WarehouseId, bin: "A-01-01", status, qty, bucket: "Own", lastMovement: "2026-09-30", ...o,
  })
  return [
    s("STK-X001", "RAW-TBD-OIL", 1200, "Blocked", { bin: "TANK-03", batchId: "BAT-TBD-O0411", lastMovement: "2026-09-30" }),
    s("STK-X002", "RAW-TBD-KRAFT", 900, "Unrestricted", { bin: "E-01-04", batchId: "BAT-TBD-P0828", bucket: "Consignment", pegRef: "VEN-TBD-0107", grnId: "GRN-TBD-0828", lastMovement: "2026-08-28" }),
    s("STK-X003", "RAW-TBD-GAUGE", 4, "Unrestricted", { bin: "B-08-02", bucket: "Customer Property", pegRef: "SO-2026-00301 / Midland Plains Grid Constructors", grnId: "GRN-TBD-0924", lastMovement: "2026-09-24" }),
  ]
}

function seedBom(): MaterialsExt["bom"] {
  const e = (parent: string, child: string, qty: number) => ({ parent: m(parent), child: m(child), qty })
  return [
    e("FIN-TBD-20MVA", "SEMI-TBD-CORE20", 1), e("FIN-TBD-20MVA", "SEMI-TBD-HVC20", 3), e("FIN-TBD-20MVA", "SEMI-TBD-LVC20", 3), e("FIN-TBD-20MVA", "SEMI-TBD-TANK20", 1),
    e("FIN-TBD-20MVA", "RAW-TBD-OLTC", 1), e("FIN-TBD-20MVA", "RAW-TBD-BSH145", 3), e("FIN-TBD-20MVA", "RAW-TBD-BSH015", 3), e("FIN-TBD-20MVA", "RAW-TBD-RAD", 4), e("FIN-TBD-20MVA", "RAW-TBD-OIL", 14000), e("FIN-TBD-20MVA", "RAW-TBD-GAUGE", 2), e("FIN-TBD-20MVA", "PACK-TBD-SKID", 1),
    e("SEMI-TBD-CORE20", "RAW-TBD-CRGO23", 21000), e("SEMI-TBD-HVC20", "RAW-TBD-CTC", 900), e("SEMI-TBD-HVC20", "RAW-TBD-KRAFT", 60), e("SEMI-TBD-LVC20", "RAW-TBD-FOIL", 700), e("SEMI-TBD-LVC20", "RAW-TBD-KRAFT", 40),
    e("SEMI-TBD-TANK20", "RAW-TBD-PLATE", 6200), e("SEMI-TBD-TANK20", "CONS-TBD-WELD", 40),
    e("FIN-TBD-2500PM", "RAW-TBD-CRGO27", 2600), e("FIN-TBD-2500PM", "RAW-TBD-OIL", 1800), e("FIN-TBD-2500PM", "SEMI-TBD-CORE25", 1),
    e("SPARE-TBD-BSH145", "RAW-TBD-BSH145", 1),
  ]
}

export function seedExt(): MaterialsExt {
  return {
    batches: seedBatches(),
    dupes: seedDupes(),
    imports: seedImports(),
    withdrawals: seedWithdrawals(),
    settlements: seedSettlements(),
    tags: seedTags(),
    plantSrc: seedPlantSrc(),
    stat: { active: false, levels: { A: 0.99, B: 0.95, C: 0.9 }, suggestions: {} },
    grir: [
      { materialId: m("RAW-TBD-CRGO23"), grnId: "GRN-TBD-1006", poId: "PO-TBD-0341", qty: 14200, value: 54670, since: "2026-10-06" },
      { materialId: m("RAW-TBD-CTC"), grnId: "GRN-TBD-0988", poId: "PO-TBD-0329", qty: 6400, value: 85760, since: "2026-09-18" },
      { materialId: m("TRADE-TBD-FCI"), grnId: "GRN-TBD-1003", poId: "PO-TBD-0344", qty: 200, value: 12800, since: "2026-10-03" },
    ],
    markWindow: { from: "2026-10-08", to: "2026-10-15", run: "CR-2026-10 (mark)" },
    ebomAhead: [
      { materialId: m("FIN-TBD-20MVA"), ebomRef: "EBOM-TBD-0377", ebomRev: "A", mbomRef: "MBOM-TBD-0301", mbomRev: "B", note: "Phase 2 EBOM line 50 is under review after RCL-2026-001; the active MBOM still carries the phase 1 structure." },
      { materialId: m("RAW-TBD-BSH145"), ebomRef: "EBOM-TBD-0377", ebomRev: "A", mbomRef: "MBOM-TBD-0301", mbomRev: "B", note: "Placeholder RAW-TBD-BSH145B replaces this bushing on EBOM line 50 once its MCR activates." },
    ],
    bom: seedBom(),
  }
}

// ------------------------------------------------------------------ pure helpers
/** §15.1: the nightly job flips a batch to Expired at its expiry date; shown here from the date alone. */
export const batchExpired = (b: Pick<BatchRecord, "expiry" | "status">, today: ISODate) => b.status !== "Consumed" && !!b.expiry && b.expiry < today
export const batchStatusOf = (b: BatchRecord, today: ISODate): BatchStatus => (batchExpired(b, today) ? "Expired" : b.status)
/** Certificates the material requires (Quality view) that the batch does not carry yet (E-QM-06). */
export const missingCerts = (b: BatchRecord, required: string[]) => required.filter((r) => !b.certs.some((c) => c.name === r || c.name.startsWith(r.split(" ")[0])))
