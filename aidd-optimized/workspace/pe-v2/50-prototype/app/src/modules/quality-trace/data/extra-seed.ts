// Seed for the feature-list screens of quality-trace. Every name and number is fictitious
// (GUARDRAILS 7). Values the specification does not give are design values (README "Readings").

import type { BatchId, SerialNo } from "@/data/domain"
import { addDays } from "@/lib/format"
import { P } from "./seed"
import type { AsBuiltDossier, BinExpected, ContactAttempt, ParetoRow, PiiDisclosure, PrintJob, QtAudit, RelabelRecord, ScanTelemetry, SpcAck, SpcSeries, StockMove, TestImportLog, VendorResponse } from "./extra-types"
import type { InspectionLot, Printer, Reprint, ScanException } from "./types"

export interface ExtraSeed {
  telemetry: ScanTelemetry[]
  printJobs: PrintJob[]
  binExpected: BinExpected[]
  relabels: RelabelRecord[]
  spcSeries: SpcSeries[]
  spcAcks: SpcAck[]
  audits: QtAudit[]
  asBuiltDossiers: AsBuiltDossier[]
  testImports: TestImportLog[]
  stockMoves: StockMove[]
  contacts: ContactAttempt[]
  piiLog: PiiDisclosure[]
  pareto: ParetoRow[]
  vendorResponses: VendorResponse[]
}

// ---------------------------------------------------------------- scan telemetry (24 months in the real system; 6 days here)
function telemetry(): ScanTelemetry[] {
  const rows: Omit<ScanTelemetry, "id">[] = [
    { at: "2026-10-09T08:02:11", device: "HH-03", userId: P.receiving, sp: "SP-01", payload: "PO-TBD-0357", result: "OK" },
    { at: "2026-10-09T08:03:40", device: "HH-03", userId: P.receiving, sp: "SP-02", payload: "BAT-TBD-CT1003", result: "OK" },
    { at: "2026-10-09T08:05:02", device: "HH-03", userId: P.receiving, sp: "SP-04", payload: "BAT-TBD-CT1003 > BIN-TBD-A-01-02", result: "OK" },
    { at: "2026-10-09T08:41:19", device: "HH-05", userId: P.whop, sp: "SP-15", payload: "SN-TBD-5M-0365", result: "Rejected", error: "Serial not Reserved for this picklist" },
    { at: "2026-10-09T09:10:55", device: "TERM-WC500", userId: P.tester, sp: "SP-14", payload: "CAL-0107", result: "Rejected", error: "E-QM-05 calibration Overdue" },
    { at: "2026-10-09T09:11:30", device: "TERM-WC500", userId: P.tester, sp: "SP-14", payload: "CAL-0103", result: "OK" },
    { at: "2026-10-09T09:32:08", device: "PACK-1", userId: P.packer, sp: "SP-16", payload: "HU-TBD-0052-1 + SN-TBD-2500-1155", result: "OK" },
    { at: "2026-10-09T09:33:41", device: "PACK-1", userId: P.packer, sp: "SP-17", payload: "HU-TBD-0052-1 weight 412.0 kg", result: "Failed", error: "Weight outside ±2% of expected" },
    { at: "2026-10-09T10:02:00", device: "HH-07", userId: P.whop, sp: "SP-20", payload: "BIN-TBD-F-02-01 + BAT-TBD-K0602", result: "Queued" },
    { at: "2026-10-09T10:41:27", device: "HH-07", userId: P.whop, sp: "SP-20", payload: "BIN-TBD-F-02-01 + BAT-TBD-K0602", result: "Replayed" },
    { at: "2026-10-08T14:22:03", device: "TERM-WC400", userId: P.operator, sp: "SP-12", payload: "SN-TBD-7M5-0391 + SN-TBD-HVC-0391A", result: "OK" },
    { at: "2026-10-08T14:25:44", device: "TERM-WC600", userId: P.operator, sp: "SP-13", payload: "SN-TBD-5M-0372", result: "Rejected", error: "E-BC-06 nameplate serial differs from WO serial" },
    { at: "2026-10-08T14:26:30", device: "TERM-WC600", userId: P.operator, sp: "SP-13", payload: "SN-TBD-5M-0388", result: "OK" },
    { at: "2026-10-08T07:30:12", device: "HH-07", userId: P.whop, sp: "SP-15", payload: "SN-TBD-5M-0365", result: "Replayed", error: "Replayed 5 h 20 min after capture (over the 4 h limit)" },
    { at: "2026-10-07T17:15:09", device: "HH-05", userId: P.whop, sp: "SP-21", payload: "BAT-TBD-L0905 > SCRAP-1", result: "Replayed", error: "Queued while the scrap approval was open" },
    { at: "2026-10-07T11:02:48", device: "DOCK-2", userId: P.shipping, sp: "SP-18", payload: "HU-TBD-0031-3", result: "Rejected", error: "E-BC-08 HU not on this shipment" },
    { at: "2026-10-06T08:40:11", device: "PRN-TBD-02", userId: P.receiving, sp: "SP-02", payload: "BAT-TBD-C2690", result: "OK" },
    { at: "2026-10-06T11:00:30", device: "HH-02", userId: P.whop, sp: "SP-06", payload: "BAT-TBD-K0921 > WH-TBD-02", result: "Queued" },
    { at: "2026-10-06T11:20:02", device: "HH-02", userId: P.whop, sp: "SP-06", payload: "BAT-TBD-K0921 > WH-TBD-02", result: "Failed", error: "Transfer line already closed by Regina receipt" },
    { at: "2026-10-05T13:30:41", device: "PACK-1", userId: P.packer, sp: "SP-16", payload: "SN-TBD-2500-1156", result: "Rejected", error: "Serial not picked for this pack order" },
    { at: "2026-10-05T08:10:00", device: "TERM-WC100", userId: P.operator, sp: "SP-07", payload: "BDG-7032", result: "OK" },
    { at: "2026-10-05T08:11:12", device: "TERM-WC100", userId: P.operator, sp: "SP-10", payload: "WO-TBD-0398 op 20", result: "OK" },
    { at: "2026-10-04T16:02:20", device: "TERM-WC500", userId: P.tester, sp: "SP-05", payload: "BAT-TBD-OIL-0930 + BDG-7034", result: "OK" },
  ]
  return rows.map((r, i) => ({ id: `TLM-${String(9000 + i)}`, ...r }))
}

function printJobs(): PrintJob[] {
  return [
    { id: "PJ-TBD-0101", labelId: "HU-TBD-0052-2", template: "HU / SSCC label v2", printerId: "PRN-TBD-06", requestedBy: P.packer, at: "2026-10-09T09:34", status: "Failed", error: "Paper out", attempts: 2 },
    { id: "PJ-TBD-0102", labelId: "BAT-TBD-CT1003", template: "Batch label v3", printerId: "PRN-TBD-02", requestedBy: P.receiving, at: "2026-10-09T08:03", status: "Failed", error: "Printer offline (no answer on 10.20.4.22)", attempts: 3 },
    { id: "PJ-TBD-0103", labelId: "SN-TBD-5M-0388", template: "Nameplate verification v1", printerId: "PRN-TBD-05", requestedBy: P.operator, at: "2026-10-08T14:20", status: "Failed", error: "Ribbon out", attempts: 1 },
    { id: "PJ-TBD-0104", labelId: "CAL-0112", template: "CAL instrument label v1", printerId: "PRN-TBD-08", requestedBy: P.qe, at: "2026-10-08T10:12", status: "Printed", error: "Head open", attempts: 2, resolvedOn: "2026-10-08", resolvedBy: P.qe },
    { id: "PJ-TBD-0105", labelId: "BAT-TBD-OIL-0930", template: "Batch label v3", printerId: "PRN-TBD-01", requestedBy: P.receiving, at: "2026-10-07T09:02", status: "Printed", error: "Printer offline", attempts: 1, redirectedTo: "PRN-TBD-02", resolvedOn: "2026-10-07", resolvedBy: P.receiving },
  ]
}

function binExpected(): BinExpected[] {
  const l = (materialId: string, batchId: string, qty: number, uom: string) => ({ materialId, batchId: batchId as BatchId, qty, uom }) as BinExpected["lines"][number]
  return [
    { bin: "BIN-TBD-F-02-01", warehouseId: "WH-TBD-01", lines: [l("RAW-TBD-KRAFT", "BAT-TBD-K0602", 188, "kg"), l("RAW-TBD-FOIL", "BAT-TBD-FL0911", 310, "kg")] },
    { bin: "BIN-TBD-A-01-02", warehouseId: "WH-TBD-01", lines: [l("RAW-TBD-CTC", "BAT-TBD-CT1003", 3900, "kg")] },
    { bin: "BIN-TBD-C-04-03", warehouseId: "WH-TBD-01", lines: [l("RAW-TBD-CRGO23", "BAT-TBD-C2655", 9800, "kg"), l("RAW-TBD-CRGO23", "BAT-TBD-C2611", 2150, "kg")] },
    { bin: "BIN-TBD-S-01-01", warehouseId: "WH-TBD-03", lines: [l("SPARE-TBD-OLTCK", "BAT-TBD-SK0301", 22, "EA")] },
    { bin: "BIN-TBD-E-00-00", warehouseId: "WH-TBD-01", lines: [] },
  ]
}
function relabels(): RelabelRecord[] {
  return [
    { id: "RLB-TBD-0001", bin: "BIN-TBD-F-02-01", materialId: "RAW-TBD-KRAFT", batchId: "BAT-TBD-K0602", qty: 188, printerId: "PRN-TBD-01", labelId: "BAT-TBD-K0602", by: P.supervisor, on: "2026-09-30T10:15", outcome: "Resolved to expected stock", note: "Pallet label torn off in the aisle" },
    { id: "RLB-TBD-0002", bin: "BIN-TBD-E-00-00", qty: 3, printerId: "PRN-TBD-01", by: P.supervisor, on: "2026-10-02T14:40", outcome: "No expected match: count exception", note: "Three unlabeled rolls in an empty bin; sent to the count team" },
    { id: "RLB-TBD-0003", bin: "BIN-TBD-A-01-02", materialId: "RAW-TBD-CTC", batchId: "BAT-TBD-CT1003", qty: 3900, printerId: "PRN-TBD-02", labelId: "BAT-TBD-CT1003", by: P.whop, on: "2026-10-08T15:05", outcome: "Resolved to expected stock" },
  ]
}

// ---------------------------------------------------------------- SPC series (design values; the data is fictitious)
function lcg(seed: number) {
  // mulberry32: a small, well-mixed generator so consecutive points are independent
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())
function series(id: string, characteristic: string, planId: string, gate: "IPQC" | "FQC", unit: string, target: number, sd: number, lsl: number | undefined, usl: number | undefined, seed: number, refPrefix: string, shape?: (i: number, v: number) => number): SpcSeries {
  const r = lcg(seed)
  const n = 32
  return {
    id, characteristic, planId, gate, unit, target, lsl, usl,
    points: Array.from({ length: n }, (_, i) => {
      const v = target + gauss(r) * sd
      return { at: addDays("2026-09-01", i), value: Math.round((shape ? shape(i, v) : v) * 1000) / 1000, ref: `${refPrefix}${300 + i}` }
    }),
  }
}
function spcSeries(): SpcSeries[] {
  return [
    series("SPC-CORE-DIA", "Core diameter", "IP-INP-0012", "IPQC", "mm", 550, 0.4, 548, 552, 11, "WO-TBD-0"),
    series("SPC-HVC-BUILD", "Coil radial build", "IP-INP-0014", "IPQC", "mm", 87, 0.2, 85.8, 88.2, 23, "WO-TBD-0", (i, v) => (i >= 23 ? v + 0.45 : v)),
    series("SPC-RATIO", "Ratio check at coil stage", "IP-INP-0014", "IPQC", "%", 0, 0.12, -0.5, 0.5, 37, "WO-TBD-0", (i, v) => (i === 27 ? 0.55 + v * 0.3 : v)),
    series("SPC-LOAD-LOSS", "Load loss, % of guarantee", "IP-FIN-0003", "FQC", "%", 98, 1.3, undefined, 110, 41, "SN-TBD-0", (i, v) => (i >= 24 ? 98 + (i - 24) * 0.8 + (v - 98) * 0.25 : v)),
    series("SPC-BDV", "Oil breakdown voltage (BDV)", "IP-FIN-0003", "FQC", "kV", 62, 2.4, 30, undefined, 53, "SN-TBD-0"),
    series("SPC-TANK-PSI", "Tank pressure hold", "IP-INP-0015", "IPQC", "psi", 12, 0.45, 10, 14, 67, "WO-TBD-0"),
  ]
}

// ---------------------------------------------------------------- audits
function audits(): QtAudit[] {
  const q = (text: string, result?: "Conforming" | "Nonconforming" | "NA", note?: string) => ({ q: text, result, note })
  return [
    {
      id: "AUD-2026-0007", title: "Supplier audit: Hanseong Porcelain & Polymer, flange seal process", type: "Supplier", scope: "Seal gasket sourcing, flange assembly, final leak test, retained samples", vendorId: "VEN-TBD-0104", auditorId: P.qe, auditee: "Hanseong QA lead",
      plannedOn: "2026-10-20", state: "Planned",
      checklist: [q("Gasket material certificates traceable to batch HP-26-0412"), q("Flange torque sequence documented and monitored"), q("Final leak test records kept per lot"), q("Retained samples held for 24 months"), q("Corrective actions from SCAR-TBD-0009 verified")],
      findings: [], activity: [{ at: "2026-10-05", by: "Quality engineer", text: "Audit scheduled after SCAR-TBD-0009 (vendor response due)" }],
    },
    {
      id: "AUD-2026-0006", title: "Internal process audit: Final test and calibration control", type: "Internal process", scope: "WC-500 Test Lab: instrument binding, calibration interlock, FTR issue", auditorId: P.qm, auditee: "Test Lab supervisor",
      plannedOn: "2026-10-06", startedOn: "2026-10-06", state: "In progress",
      checklist: [q("Every test result carries an instrument ID", "Conforming"), q("Overdue instruments are blocked from selection (E-QM-05)", "Conforming"), q("Out-of-service instrument tagged on the bench", "Nonconforming", "CAL-0110 tag missing on the helium leak detector"), q("FTR countersigned within one working day", "Conforming"), q("Ambient conditions recorded for every run"), q("Retest scope limited to failed characteristics")],
      findings: [{ id: "F1", clause: "Calibration control (Book I E §7)", text: "Out-of-service tag missing on CAL-0110 although the register shows Out of Service.", grade: "Minor", dueOn: "2026-10-27", state: "Open" }],
      activity: [{ at: "2026-10-06", by: "Quality Manager", text: "Audit started" }, { at: "2026-10-07", by: "Quality Manager", text: "Finding F1 recorded (Minor)" }],
    },
    {
      id: "AUD-2026-0005", title: "Supplier audit: Saguaro gasket kits", type: "Supplier", scope: "Gasket kit lot control and shipping inspection", vendorId: "VEN-TBD-0111", auditorId: P.qe, auditee: "Saguaro plant manager",
      plannedOn: "2026-07-21", startedOn: "2026-07-21", reportOn: "2026-07-28", state: "Report issued",
      checklist: [q("Lot numbers on every kit", "Conforming"), q("Incoming inspection of elastomer hardness", "Nonconforming", "Hardness checked on first lot only"), q("Shipping packaging protects the seal faces", "Conforming")],
      findings: [{ id: "F1", clause: "Incoming inspection", text: "Elastomer hardness is checked on the first lot of a shipment only.", grade: "Major", dueOn: "2026-08-28", state: "Open", capaId: "CAPA-TBD-0012" }, { id: "F2", clause: "Packaging", text: "Seal faces are packed without a cover sheet; bruising observed on two kits.", grade: "Observation", state: "Open" }],
      activity: [{ at: "2026-07-21", by: "Quality engineer", text: "Audit started on site" }, { at: "2026-07-28", by: "Quality engineer", text: "Report issued with 2 findings; CAPA-TBD-0012 raised for F1" }],
    },
    {
      id: "AUD-2026-0003", title: "Certification surveillance: quality management system", type: "Certification", scope: "Clauses 7 to 10, document control, nonconforming product, CAPA", auditorId: P.qm, auditee: "Registrar (external)",
      plannedOn: "2026-05-12", startedOn: "2026-05-12", reportOn: "2026-05-14", closedOn: "2026-06-30", state: "Closed",
      checklist: [q("Document control", "Conforming"), q("Nonconforming product control", "Conforming"), q("CAPA effectiveness checks", "Conforming")],
      findings: [{ id: "F1", clause: "Monitoring and measurement", text: "One calibration certificate filed under the wrong instrument.", grade: "Minor", dueOn: "2026-06-12", state: "Closed", closedOn: "2026-06-10", closeNote: "Certificate re-filed; register checked for similar cases" }],
      activity: [{ at: "2026-05-12", by: "Quality Manager", text: "Surveillance audit started" }, { at: "2026-06-30", by: "Quality Manager", text: "All findings closed; audit closed" }],
    },
  ]
}

function asBuilt(): AsBuiltDossier[] {
  return [
    {
      id: "ABD-TBD-0001", serial: "SN-TBD-20M-0301" as SerialNo, revision: 1, assembledOn: "2026-08-10", by: P.qm,
      items: [
        { key: "bom", label: "As-built bill of material with batch and serial genealogy" },
        { key: "ftr", label: "Final Test Report", ref: "FTR-2026-0188" },
        { key: "coc", label: "Certificate of conformance (OQC IL-TBD-0303)", ref: "IL-TBD-0303" },
        { key: "mat", label: "Material and component certificates" },
        { key: "dev", label: "Deviations and waivers disclosed" },
        { key: "np", label: "Nameplate record (SP-13)" },
      ],
      transmittedTo: "Midland Plains Grid Constructors, document control", transmittalNo: "TRN-TBD-0031", transmittedOn: "2026-08-12",
    },
  ]
}
function testImports(): TestImportLog[] {
  return [{ id: "TIM-TBD-0001", finalTestId: "IL-TBD-0353", run: 1, template: "TS-TPL-02 Loss and impedance set", fileName: "7M5-0391_loss_run1.csv", rows: 4, recorded: 4, on: "2026-10-02", by: P.tester }]
}
function stockMoves(): StockMove[] {
  return [
    { id: "SMV-TBD-0001", at: "2026-10-01", batchId: "BAT-TBD-L1002", from: "(receipt)", to: "QI Hold", gate: "IQC", source: "GRN-TBD-0375", reason: "QI-required item: receipt posts to QI Hold", by: "System" },
    { id: "SMV-TBD-0002", at: "2026-09-22", batchId: "BAT-TBD-K0921", from: "QI Hold", to: "Unrestricted", gate: "IQC", source: "IL-TBD-0357", reason: "Inspection accepted", by: P.inspector },
    { id: "SMV-TBD-0003", at: "2026-09-19", batchId: "BAT-TBD-R0918", from: "QI Hold", to: "Blocked", gate: "IQC", source: "IL-TBD-0356", reason: "Inspection rejected: return to vendor", by: P.qm },
    { id: "SMV-TBD-0004", at: "2026-09-06", batchId: "BAT-TBD-L0905", from: "QI Hold", to: "Blocked", gate: "IQC", source: "IL-TBD-0358", reason: "Inspection rejected", by: P.inspector },
    { id: "SMV-TBD-0005", at: "2026-10-03", batchId: "BAT-TBD-B0301", from: "Unrestricted", to: "Blocked", gate: "RQC", source: "RCL-2026-001", reason: "Mass hold of the recall population", by: "System" },
    { id: "SMV-TBD-0006", at: "2026-09-12", batchId: "BAT-TBD-L0815", from: "Unrestricted", to: "Quarantine", gate: "RQC", source: "RCL-2026-003", reason: "Campaign opened: stock quarantined", by: P.qm },
    { id: "SMV-TBD-0007", at: "2026-10-01", serial: "SN-TBD-BSH-0302", from: "In field", to: "QI Hold", gate: "RQC", source: "IL-TBD-0304", reason: "Returned unit held for return inspection", by: P.inspector },
    { id: "SMV-TBD-0008", at: "2026-08-27", batchId: "BAT-TBD-C2655", from: "QI Hold", to: "Unrestricted", gate: "IQC", source: "IL-TBD-0359", reason: "Accepted under deviation DEV-2026-0011", by: P.qm },
  ] as StockMove[]
}

// ---------------------------------------------------------------- recall contact attempts
function contacts(): ContactAttempt[] {
  const c = (n: number, recallId: string, customerId: string, at: string, by: string, channel: ContactAttempt["channel"], contactName: string, outcome: ContactAttempt["outcome"], note: string): ContactAttempt => ({ id: `CNT-TBD-${String(n).padStart(4, "0")}`, recallId, customerId, at, by: by as ContactAttempt["by"], channel, contactName, outcome, note })
  return [
    c(1, "RCL-2026-003", "CUS-TBD-0031", "2026-09-21T09:30", P.qm, "Phone", "Plant electrical supervisor", "No answer", "Called twice; no voicemail box"),
    c(2, "RCL-2026-003", "CUS-TBD-0031", "2026-09-21T14:10", P.qm, "Email", "Plant electrical supervisor", "Reached, will respond", "Notification text sent; asked for site access windows"),
    c(3, "RCL-2026-003", "CUS-TBD-0027", "2026-09-22T10:05", P.qe, "Phone", "Operations manager", "Reached, acknowledged", "Two units identified on site; replacement bushing dates agreed"),
    c(4, "RCL-2026-003", "CUS-TBD-0041", "2026-09-22T11:20", P.qe, "Email", "Maintenance planner", "Email bounced", "Address no longer valid; switch to phone"),
    c(5, "RCL-2026-003", "CUS-TBD-0041", "2026-09-23T08:45", P.qe, "Phone", "Maintenance planner", "Left voicemail", "Message left with the notification reference"),
    c(6, "RCL-2026-003", "CUS-TBD-0041", "2026-09-24T15:00", P.qm, "Letter", "Plant manager", "Reached, will respond", "Registered letter sent; plant manager called back"),
    c(7, "RCL-2026-003", "CUS-TBD-0017", "2026-09-22T13:30", P.qe, "Site visit", "Site superintendent", "Reached, acknowledged", "Unit tagged out until the bushing is replaced"),
    c(8, "RCL-2026-004", "CUS-TBD-0027", "2026-07-08T09:00", P.qm, "Email", "Operations manager", "Reached, acknowledged", "Gasket kit replacement scheduled"),
    c(9, "RCL-2026-004", "CUS-TBD-0044", "2026-07-08T10:40", P.qm, "Phone", "Plant engineer", "Declined", "Customer declined the campaign visit; documented exception pending"),
  ]
}

const pareto = (): ParetoRow[] => [
  { cause: "Flange seal leak", count: 14, cost: 38200 },
  { cause: "Winding resistance out of band", count: 9, cost: 21400 },
  { cause: "Partial discharge above limit", count: 7, cost: 41800 },
  { cause: "Dimensional: radial build", count: 6, cost: 6900 },
  { cause: "Paint film thickness", count: 4, cost: 2800 },
  { cause: "Moisture in oil", count: 3, cost: 5100 },
  { cause: "Labelling and nameplate", count: 2, cost: 900 },
  { cause: "Other", count: 3, cost: 2300 },
]

export function extraSeed(): ExtraSeed {
  return {
    telemetry: telemetry(), printJobs: printJobs(), binExpected: binExpected(), relabels: relabels(), spcSeries: spcSeries(), spcAcks: [], audits: audits(),
    asBuiltDossiers: asBuilt(), testImports: testImports(), stockMoves: stockMoves(), contacts: contacts(), piiLog: [{ id: "PII-TBD-0001", recallId: "RCL-2026-004", on: "2026-07-03T11:20", by: P.qm, rows: 11, purpose: "Customer notification mailing" }], pareto: pareto(),
    vendorResponses: [{ id: "VRS-TBD-0001", scarId: "SCAR-TBD-0010", on: "2026-10-06T09:40", respondent: "M. Alvarez, Heartland QA", email: "qa@heartland-radiators.example", attachments: ["line2_gas_alarm_log.pdf"] }],
  }
}

/** Patches applied to the base seed (printer health, conflict cards, reprint governance fields, one conditional release). */
export function patchSeed(s: { printers: Printer[]; scanExceptions: ScanException[]; reprints: Reprint[]; lots: InspectionLot[] }) {
  const health: Record<string, Printer["health"]> = { "PRN-TBD-06": "Paper out", "PRN-TBD-02": "Offline", "PRN-TBD-05": "Ribbon out" }
  for (const p of s.printers) p.health = !p.active ? "Offline" : (health[p.id] ?? "Online")
  const conflict: Record<string, Partial<ScanException>> = {
    "SCX-TBD-0201": { queued: "Pick SN-TBD-5M-0365 for picklist PL-TBD-0412 (captured 02:10)", current: "SN-TBD-5M-0365 is now at staging lane 4 (moved by HH-03 at 04:12)" },
    "SCX-TBD-0202": { queued: "Putaway SN-TBD-CT6-0003 to BIN-TBD-A-01-02 (captured 09:40)", current: "No receipt (T02) exists for SN-TBD-CT6-0003" },
    "SCX-TBD-0203": { queued: "Scrap BAT-TBD-L0905 to SCRAP-1 (captured 16:05)", current: "Disposition approval for BAT-TBD-L0905 was still open at capture; approved 16:50" },
    "SCX-TBD-0204": { queued: "Transfer BAT-TBD-K0921 to WH-TBD-02 (captured 11:00)", current: "Transfer line closed by the Regina receipt at 11:12", decision: "Rejected", supervisorId: P.supervisor as ScanException["supervisorId"] },
    "SCX-TBD-0205": { queued: "Add SN-TBD-2500-1156 to HU-TBD-0052-1 (captured 13:30)", current: "SN-TBD-2500-1156 is Reserved but not picked for this pack order", decision: "Rejected", supervisorId: P.supervisor as ScanException["supervisorId"] },
  }
  for (const x of s.scanExceptions) Object.assign(x, conflict[x.id] ?? {})
  const rp: Record<string, Partial<Reprint>> = {
    "RPR-TBD-0301": { reasonCode: "Data corrected", kind: "Batch label", watermark: true, state: "Printed" },
    "RPR-TBD-0302": { reasonCode: "Damaged or unreadable", kind: "HU / SSCC label", watermark: true, state: "Printed" },
    "RPR-TBD-0303": { reasonCode: "Data corrected", kind: "CAL instrument label", watermark: true, state: "Printed" },
    "RPR-TBD-0304": { reasonCode: "Printer fault", kind: "Batch label", watermark: true, state: "Printed" },
    "RPR-TBD-0305": { reasonCode: "Recall hold tag", kind: "Serial label", watermark: true, state: "Printed", approvedBy: P.qm as Reprint["approvedBy"], approvedOn: "2026-10-03" },
    "RPR-TBD-0306": { reasonCode: "Data corrected", kind: "HU / SSCC label", watermark: true, state: "Printed" },
  }
  for (const r of s.reprints) Object.assign(r, rp[r.id] ?? {})
  const l = s.lots.find((x) => x.id === "IL-TBD-0357")
  if (l) l.decidedBy = P.qm
  if (l) l.conditional = { note: "Moisture test was run on the first of two drums only. Use for the current work order; the second drum must pass moisture before further release.", scope: "Work order WO-TBD-0388 only", expiresOn: "2026-10-31", by: P.qm as NonNullable<InspectionLot["conditional"]>["by"], on: "2026-09-22" }
}
