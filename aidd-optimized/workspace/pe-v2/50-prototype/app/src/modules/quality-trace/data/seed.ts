// quality-trace seed. Every name and number is fictitious (GUARDRAILS 7). Spine documents use the
// exact IDs and statuses of src/data/shared/spine.ts; everything else exists so each screen shows
// every status of its record at realistic volume. Values the specification does not give are
// design values (README "Readings").

import type { BatchId, InstrumentId, ScanPointCode, SerialNo, UserId } from "@/data/domain"
import { SCAN_POINTS } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { addDays, daysBetween } from "@/lib/format"
import { appendEvent, type NewEvent } from "./chain"
import type {
  Dossier, FinalTest, InspectionLot, LabelTemplate, PlanRevision, PopulationRow, Printer, QtBatch, QtCapa, QtCharacteristic,
  QtDeviation, QtEvent, QtInstrument, QtNcr, QtPlan, QtRecall, QtScar, QtSerial, Reprint, ResultRow, ScanException, ScanPolicy,
  TestRun, TraceException, AutoAcceptWarning, VendorLots,
} from "./types"

// people (src/data/shared/users.ts)
export const P = {
  inspector: "USR-TBD-034", tester: "USR-TBD-035", qe: "USR-TBD-036", qm: "USR-TBD-037", qit: "USR-TBD-038",
  receiving: "USR-TBD-017", operator: "USR-TBD-032", whop: "USR-TBD-018", engMgr: "USR-TBD-024", plantIt: "USR-TBD-043",
  exec: "USR-TBD-044", controller: "USR-TBD-009", packer: "USR-TBD-015", shipping: "USR-TBD-014", supervisor: "USR-TBD-031",
} as const satisfies Record<string, UserId>

// ============================================================================ instruments (S-26)
type InsRow = [n: number, name: string, type: string, range: string, location: string, wc: QtInstrument["workCenterId"], interval: number, last: string, oos?: { on: string; reason: string }]
const INS: InsRow[] = [
  [101, "Transformer turns ratio tester, three-phase", "TTR", "0.8 to 50,000:1", "Test Lab bay 1", "WC-500", 365, "2026-02-10"],
  [102, "Winding resistance meter", "Resistance", "1 µΩ to 2 kΩ, 50 A", "Test Lab bay 1", "WC-500", 365, "2025-11-02"],
  [103, "Insulation resistance tester, 5 kV", "Megohmmeter", "0.5 MΩ to 10 TΩ", "Test Lab bay 2", "WC-500", 365, "2026-04-01"],
  [104, "Power analyzer and loss measurement system", "Loss system", "0.05 to 30 MVA, 0.1% accuracy class", "Test Lab bay 1", "WC-500", 365, "2026-01-15"],
  [105, "AC applied-voltage test set", "Hipot", "0 to 200 kV, 60 Hz", "Test Lab HV cage", "WC-500", 365, "2025-10-14"],
  [106, "Partial discharge measurement system", "PD", "0.1 to 10,000 pC", "Test Lab HV cage", "WC-500", 365, "2026-03-03"],
  [107, "Oil dielectric breakdown tester, ASTM D877", "BDV", "0 to 100 kV", "Quality lab", undefined, 365, "2025-10-04"],
  [108, "Karl Fischer moisture titrator, ASTM D1533", "Moisture", "1 to 5,000 ppm", "Quality lab", undefined, 365, "2026-06-12"],
  [109, "Capacitance and tan delta bridge", "C / tan δ", "10 pF to 1 µF; 0 to 10%", "Receiving inspection", undefined, 365, "2026-05-01"],
  [110, "Helium leak detector", "Leak", "1e-9 to 1e-1 mbar·L/s", "Receiving inspection", undefined, 365, "2026-03-12", { on: "2026-10-03", reason: "Failed daily verification against the reference leak; sent to Precision Cal Services" }],
  [111, "Digital caliper", "Dimensional", "0 to 600 mm, 0.01 mm", "Receiving inspection", undefined, 180, "2026-06-02"],
  [112, "Bolt-circle gauge, 540 mm", "Dimensional", "535 to 545 mm", "Receiving inspection", undefined, 180, "2026-04-20"],
  [113, "Epstein frame core loss tester, ASTM A343", "Core loss", "0.5 to 1.9 T, 50/60 Hz", "Quality lab", "WC-110", 365, "2026-02-18"],
  [114, "Coating thickness gauge (DFT)", "Dimensional", "0 to 1,500 µm", "Paint & Finishing", "WC-600", 180, "2026-03-25"],
  [115, "Pressure gauge, tank test", "Pressure", "0 to 30 psi", "Tank Fabrication", "WC-050", 365, "2026-01-08"],
  [116, "Thermocouple data logger, 24 ch", "Temperature", "-50 to 250 °C", "Test Lab bay 2", "WC-500", 365, "2026-05-20"],
  [117, "Outside micrometer, 0 to 25 mm", "Dimensional", "0 to 25 mm, 1 µm", "Quality lab", "WC-100", 365, "2026-07-01"],
  [118, "Torque wrench, 20 to 200 N·m", "Torque", "20 to 200 N·m", "Final Assembly", "WC-400", 180, "2026-04-15"],
]
export function instrumentStatus(i: Pick<QtInstrument, "dueOn" | "outOfService">, today = TODAY): QtInstrument["status"] {
  if (i.outOfService) return "Out of Service"
  const d = daysBetween(today, i.dueOn)
  if (d < 0) return "Overdue"
  if (d <= 30) return "Due Soon"
  return "In Cal"
}
function instruments(): QtInstrument[] {
  return INS.map(([n, name, type, range, location, wc, interval, last, oos]) => {
    const dueOn = addDays(last, interval)
    const events: QtInstrument["events"] = [
      { on: addDays(last, -interval), result: "Pass", certificate: `PCS-${n}-${addDays(last, -interval).slice(0, 4)}.pdf`, lab: "Precision Cal Services (ISO/IEC 17025)" },
      { on: last, result: "Pass", certificate: `PCS-${n}-${last.slice(0, 4)}.pdf`, lab: "Precision Cal Services (ISO/IEC 17025)" },
    ]
    const i: QtInstrument = {
      id: `INS-TBD-0${n}` as InstrumentId, label: `CAL-0${n}`, name, type, range, location, ownerId: P.qe, workCenterId: wc,
      intervalDays: interval, lastCalOn: last, dueOn, outOfService: oos, events, status: "In Cal",
    }
    i.status = instrumentStatus(i)
    return i
  })
}

// ============================================================================ inspection plans (S-24)
const ch = (seq: number, name: string, method: string, charType: QtCharacteristic["charType"], parameter: string, o: Partial<QtCharacteristic> = {}): QtCharacteristic => ({
  seq, name, method, charType, parameter, critical: false, ...o,
})
const rev = (r: string, status: PlanRevision["status"], from: string, chars: QtCharacteristic[], o: Partial<PlanRevision> = {}): PlanRevision => ({
  rev: r, status, effectiveFrom: from, sampling: "AQL Sampling", aql: { level: "G2", value: 1.0, switching: true, state: "Normal" }, characteristics: chars,
  createdBy: P.qe, createdOn: addDays(from, -10), activatedBy: status === "Draft" || status === "In Review" ? undefined : P.qm, activatedOn: status === "Draft" || status === "In Review" ? undefined : from, ...o,
})

const BSH_B: QtCharacteristic[] = [
  ch(1, "Visual inspection, housing and flange", "WI-QA-021", "Attributive", "Cracks, chips, sheds, flange casting", { critical: true, sampleInstruction: "Every sampled bushing, under 1,000 lux" }),
  ch(2, "Flange bolt circle", "Drawing BSH-145-800 rev D", "Quantitative", "Bolt circle diameter", { uom: "mm", min: 539.5, target: 540, max: 540.5, instrumentClass: "Dimensional", sampleInstruction: "Measure at 0° and 90°, report the larger" }),
  ch(3, "Capacitance C1", "IEEE C57.19.01", "Quantitative", "C1 at 10 kV", { uom: "pF", min: 430, target: 452, max: 475, instrumentClass: "C / tan δ" }),
  ch(4, "Power factor C1", "IEEE C57.19.01", "Quantitative", "Power factor at 10 kV, 20 °C corrected", { uom: "%", max: 0.5, instrumentClass: "C / tan δ", critical: true }),
  ch(5, "Oil level and seal check", "WI-QA-021", "Attributive", "Sight glass level, no weep at flange gasket", { certRequired: true }),
]
const BSH_C: QtCharacteristic[] = [
  ...BSH_B,
  ch(6, "Flange seal leak test", "WI-QA-044 (new, CAPA-TBD-0015)", "Quantitative", "Helium leak rate at flange gasket", { uom: "mbar·L/s", max: 1e-6, instrumentClass: "Leak", critical: true, sampleInstruction: "Hood test at the flange, 10 min dwell" }),
]
const CRGO: QtCharacteristic[] = [
  ch(1, "Specific core loss", "ASTM A343", "Quantitative", "P1.7/60 specific loss", { uom: "W/kg", max: 0.85, target: 0.8, instrumentClass: "Core loss", critical: true, sampleInstruction: "One strip per coil, mid-width" }),
  ch(2, "Lamination thickness", "ASTM A343", "Quantitative", "Thickness", { uom: "mm", min: 0.22, target: 0.23, max: 0.24, instrumentClass: "Dimensional" }),
  ch(3, "Coating insulation", "Franklin test, ASTM A717", "Attributive", "Surface insulation resistance acceptable"),
  ch(4, "Mill certificate chemistry", "Mill certificate", "Attributive", "Si content and grade per PO", { certRequired: true }),
]
const OIL: QtCharacteristic[] = [
  ch(1, "Dielectric breakdown voltage", "ASTM D877", "Quantitative", "BDV, 2.5 mm gap", { uom: "kV", min: 30, instrumentClass: "BDV", critical: true, sampleInstruction: "Two samples per tanker, top and bottom valve" }),
  ch(2, "Moisture content", "ASTM D1533", "Quantitative", "Water content", { uom: "ppm", max: 35, instrumentClass: "Moisture" }),
  ch(3, "Visual and colour", "ASTM D1524", "Attributive", "Clear and bright, colour ≤ 0.5"),
]
const CTC: QtCharacteristic[] = [
  ch(1, "Strand dimensions", "Drawing CTC-27", "Quantitative", "Strand width", { uom: "mm", min: 5.9, target: 6.0, max: 6.1, instrumentClass: "Dimensional" }),
  ch(2, "Enamel thickness", "IEC 60317", "Quantitative", "Enamel build per side", { uom: "mm", min: 0.05, max: 0.07, instrumentClass: "Dimensional" }),
  ch(3, "Conductivity certificate", "Vendor certificate", "Attributive", "≥ 100% IACS", { certRequired: true }),
]
const LVB: QtCharacteristic[] = [
  ch(1, "Visual, porcelain and terminal", "WI-QA-022", "Attributive", "No cracks at terminal threads", { critical: true }),
  ch(2, "Terminal stud length", "Drawing BSH-015-3000", "Quantitative", "Stud length", { uom: "mm", min: 119, target: 120, max: 121, instrumentClass: "Dimensional" }),
  ch(3, "Applied voltage withstand", "IEEE C57.19.01", "Attributive", "34 kV, 1 min, no breakdown", { instrumentClass: "Hipot" }),
]
const OLTC: QtCharacteristic[] = [
  ch(1, "Type test certificate review", "IEC 60214-1", "Attributive", "Certificate matches STP-000301 version", { certRequired: true, critical: true }),
  ch(2, "Diverter switch transition check", "Vendor routine test report", "Attributive", "Routine test report attached and passed", { certRequired: true }),
  ch(3, "Shipping damage inspection", "WI-QA-025", "Attributive", "Crate, impact recorder, desiccant"),
]
const CT600: QtCharacteristic[] = [
  ch(1, "Ratio check 600:5", "IEEE C57.13", "Quantitative", "Ratio error", { uom: "%", min: -0.3, max: 0.3, instrumentClass: "TTR" }),
  ch(2, "Polarity", "IEEE C57.13", "Attributive", "Subtractive polarity marking"),
]
const CORE_INP: QtCharacteristic[] = [
  ch(1, "Core loss pre-check", "WI-PR-110", "Quantitative", "No-load loss at 1.0 pu, before coil assembly", { uom: "kW", max: 13.2, instrumentClass: "Core loss", critical: true }),
  ch(2, "Core diameter", "Drawing CORE-20 rev B", "Quantitative", "Limb diameter", { uom: "mm", min: 548, target: 550, max: 552, instrumentClass: "Dimensional" }),
]
const HVW_INP: QtCharacteristic[] = [
  ch(1, "Turns count per disc", "WI-PR-210", "Attributive", "Counter reading equals winding card", { critical: true }),
  ch(2, "Coil radial build", "Drawing HVC-20 rev B", "Quantitative", "Radial build", { uom: "mm", min: 86, target: 87, max: 88, instrumentClass: "Dimensional" }),
  ch(3, "Ratio check at coil stage", "WI-PR-212", "Quantitative", "Ratio deviation", { uom: "%", min: -0.5, max: 0.5, instrumentClass: "TTR" }),
]
const TANK_INP: QtCharacteristic[] = [
  ch(1, "Pressure test", "WI-PR-055", "Quantitative", "Hold pressure, 12 h, no leak", { uom: "psi", min: 10, target: 12, max: 14, instrumentClass: "Pressure", critical: true }),
  ch(2, "Weld visual", "AWS D1.1", "Attributive", "No porosity or undercut"),
]
/** IP-FIN routine tests for power transformers [DOC:p.86 Part E §3] (asserted). Bounds per unit are
 *  materialised on each final test record from its design values. */
export const FIN_POWER: QtCharacteristic[] = [
  ch(1, "Winding resistance", "IEEE C57.12.90 §5", "Quantitative", "R per phase, HV at nominal tap, 75 °C corrected", { uom: "mΩ", instrumentClass: "Resistance" }),
  ch(2, "Turns ratio and polarity", "IEEE C57.12.90 §6", "Quantitative", "Ratio deviation per tap per phase", { uom: "%", min: -0.5, max: 0.5, instrumentClass: "TTR", critical: true }),
  ch(3, "Insulation resistance", "IEEE C57.12.90", "Quantitative", "HV-LV+G, 1 min", { uom: "MΩ", min: 1000, instrumentClass: "Megohmmeter" }),
  ch(4, "No-load loss and excitation current", "IEEE C57.12.90 §8", "Quantitative", "No-load loss at 100% V", { uom: "kW", instrumentClass: "Loss system" }),
  ch(5, "Load loss and impedance", "IEEE C57.12.90 §9", "Quantitative", "%Z at 85 °C reference", { uom: "%", instrumentClass: "Loss system" }),
  ch(6, "Applied voltage (hipot)", "IEEE C57.12.90 §10", "Attributive", "Withstand, 1 min", { instrumentClass: "Hipot", critical: true }),
  ch(7, "Induced voltage with PD", "IEEE C57.12.90 §10.7", "Quantitative", "Partial discharge at 1.5 pu", { uom: "pC", max: 250, instrumentClass: "PD", critical: true }),
  ch(8, "Oil tests", "ASTM D877 / D1533", "Quantitative", "BDV", { uom: "kV", min: 30, instrumentClass: "BDV" }),
  ch(9, "Temperature rise (type test, when ordered)", "IEEE C57.12.90 §11", "Quantitative", "Average winding rise", { uom: "K", max: 65, instrumentClass: "Temperature" }),
  // Further captured values the specification lists for the same tests [DOC:p.86 §3]; numbered after 9 so the
  // seqs of earlier records stay stable. Bounds for the loss and excitation rows come from fin() below.
  ch(10, "Insulation resistance HV-G", "IEEE C57.12.90", "Quantitative", "HV-G, 1 min", { uom: "MΩ", min: 1000, instrumentClass: "Megohmmeter" }),
  ch(11, "Insulation resistance LV-G", "IEEE C57.12.90", "Quantitative", "LV-G, 1 min", { uom: "MΩ", min: 1000, instrumentClass: "Megohmmeter" }),
  ch(12, "Polarization index (PI)", "IEEE C57.12.90", "Quantitative", "PI = 10 min / 1 min insulation resistance", { uom: "ratio", min: 1.5, instrumentClass: "Megohmmeter" }),
  ch(13, "Excitation current", "IEEE C57.12.90 §8", "Quantitative", "%I at 100% V", { uom: "%", instrumentClass: "Loss system" }),
  ch(14, "No-load loss at 110% V", "IEEE C57.12.90 §8", "Quantitative", "No-load loss at 110% V", { uom: "kW", instrumentClass: "Loss system" }),
  ch(15, "Load loss at rated current", "IEEE C57.12.90 §9", "Quantitative", "Load loss at rated current, 85 °C reference", { uom: "kW", instrumentClass: "Loss system" }),
  ch(16, "Oil moisture", "ASTM D1533", "Quantitative", "Water content", { uom: "ppm", max: 35, instrumentClass: "Moisture" }),
]
const FIN_PAD: QtCharacteristic[] = FIN_POWER.filter((c) => c.seq !== 9).map((c) => (c.seq === 7 ? { ...c, name: "Induced voltage", charType: "Attributive", parameter: "Withstand at 2 pu, 7,200 cycles", uom: undefined, max: undefined, instrumentClass: "Hipot" } : c))
const PSI_POWER: QtCharacteristic[] = [
  ch(1, "Nameplate matches serial and order", "WI-QA-070", "Attributive", "Nameplate serial = WO serial (SP-13 record)", { critical: true }),
  ch(2, "Transport gas pressure", "WI-QA-071", "Quantitative", "Dry air / N2 pressure for transport", { uom: "psi", min: 2, max: 5, instrumentClass: "Pressure" }),
  ch(3, "Impact recorder installed and armed", "WI-QA-072", "Attributive", "Recorder serial noted on BOL"),
  ch(4, "Paint dry film thickness", "SSPC-PA 2", "Quantitative", "DFT", { uom: "µm", min: 125, instrumentClass: "Dimensional" }),
  ch(5, "Accessory crate count", "Packing list", "Attributive", "Crates = packing list"),
]
const RMA_BSH: QtCharacteristic[] = [
  ch(1, "Teardown photographs", "RMA Part A §3.6", "Attributive", "Photographs attached (mandatory for RC3)", { critical: true }),
  ch(2, "Flange seal condition", "WI-QA-021", "Attributive", "Gasket intact, no oil path", { critical: true }),
  ch(3, "Power factor C1", "IEEE C57.19.01", "Quantitative", "Power factor at 10 kV", { uom: "%", max: 0.5, instrumentClass: "C / tan δ" }),
]
const PAINT: QtCharacteristic[] = [ch(1, "Adhesion", "ASTM D3359", "Attributive", "Cross-hatch 4B or better", { critical: true })]

function plans(): QtPlan[] {
  const p = (id: QtPlan["id"], name: string, type: QtPlan["type"], scope: QtPlan["scope"], o: Partial<QtPlan>, revisions: PlanRevision[]): QtPlan => ({
    id, name, type, scope, revisions, activity: revisions.map((r) => ({ at: r.createdOn, by: "Quality engineer", text: `Rev ${r.rev} authored` })), ...o,
  })
  return [
    p("IP-INC-0031", "HV bushing 145 kV incoming: dimensional, C1 / PF, seal", "INC", "Item + Vendor", { itemId: "RAW-TBD-BSH145", vendorId: "VEN-TBD-0104" }, [
      rev("A", "Superseded", "2025-11-01", BSH_B.slice(0, 4), { effectiveTo: "2026-03-31" }),
      rev("B", "Active", "2026-04-01", BSH_B),
      rev("C", "In Review", "2026-10-20", BSH_C, { createdOn: "2026-10-06", reviewNote: "Adds the flange seal leak test from CAPA-TBD-0015 (action 2)" }),
    ]),
    p("IP-INC-0027", "CRGO Incoming — Core Loss & Chemistry", "INC", "Item", { itemId: "RAW-TBD-CRGO23" }, [
      rev("A", "Superseded", "2024-06-01", CRGO.slice(0, 2), { effectiveTo: "2025-02-28", sampling: "Fixed Sample Size", aql: undefined, fixedSize: 1 }),
      rev("B", "Superseded", "2025-03-01", CRGO.slice(0, 3), { effectiveTo: "2026-01-31", sampling: "Fixed Sample Size", aql: undefined, fixedSize: 1 }),
      rev("C", "Active", "2026-02-01", CRGO, { sampling: "100%", aql: undefined }),
    ]),
    p("IP-INC-0033", "Transformer oil incoming: BDV and moisture", "INC", "Item", { itemId: "RAW-TBD-OIL" }, [rev("A", "Active", "2025-09-01", OIL, { sampling: "Skip-Lot", aql: undefined, skipLot: { n: 5 } })]),
    p("IP-INC-0035", "CTC conductor incoming", "INC", "Item + Vendor", { itemId: "RAW-TBD-CTC", vendorId: "VEN-TBD-0102" }, [rev("A", "Active", "2025-10-01", CTC)]),
    p("IP-INC-0038", "LV bushing 15 kV incoming", "INC", "Item + Vendor", { itemId: "RAW-TBD-BSH015", vendorId: "VEN-TBD-0112" }, [
      rev("A", "Superseded", "2025-05-01", LVB.slice(0, 2), { effectiveTo: "2026-05-31" }),
      rev("B", "Active", "2026-06-01", LVB, { aql: { level: "G2", value: 1.0, switching: true, state: "Tightened" } }),
    ]),
    p("IP-INC-0040", "OLTC incoming: certificate and transit review", "INC", "Item", { itemId: "RAW-TBD-OLTC" }, [rev("A", "Active", "2026-01-15", OLTC, { sampling: "100%", aql: undefined })]),
    p("IP-INC-0041", "Bushing CT 600:5 incoming", "INC", "Item + Vendor", { itemId: "RAW-TBD-CT600", vendorId: "VEN-TBD-0115" }, [rev("A", "Draft", "2026-11-01", CT600, { createdOn: "2026-10-05" })]),
    p("IP-INC-0019", "Paint system incoming (vendor disqualified)", "INC", "Item + Vendor", { itemId: "CONS-TBD-PAINT", vendorId: "VEN-TBD-0113" }, [rev("A", "Obsolete", "2024-09-01", PAINT, { effectiveTo: "2026-06-30" })]),
    p("IP-INP-0012", "Core loss pre-check at stacking", "INP", "Item + Operation", { itemId: "SEMI-TBD-CORE20", operation: "WC-110 Core Stacking, op 0020" }, [rev("A", "Active", "2025-08-01", CORE_INP, { sampling: "100%", aql: undefined })]),
    p("IP-INP-0014", "HV winding turns and build check", "INP", "Item + Operation", { itemId: "SEMI-TBD-HVC20", operation: "WC-210 HV Winding, op 0030" }, [rev("A", "Active", "2025-08-01", HVW_INP, { sampling: "100%", aql: undefined })]),
    p("IP-INP-0015", "Tank pressure test", "INP", "Item + Operation", { itemId: "SEMI-TBD-TANK20", operation: "WC-050 Tank Fabrication, op 0090" }, [
      rev("A", "Superseded", "2024-11-01", TANK_INP.slice(0, 1), { effectiveTo: "2026-02-28", sampling: "100%", aql: undefined }),
      rev("B", "Active", "2026-03-01", TANK_INP, { sampling: "100%", aql: undefined }),
    ]),
    p("IP-FIN-0003", "Power transformer routine tests (IEEE C57.12.90)", "FIN", "Item Group", { itemGroup: "Transformers: substation and power (FIN-TBD-20MVA, -5000SS, -7500MTO)" }, [
      rev("C", "Superseded", "2025-01-01", FIN_POWER.slice(0, 8), { effectiveTo: "2025-12-31", sampling: "100%", aql: undefined }),
      rev("D", "Active", "2026-01-01", FIN_POWER, { sampling: "100%", aql: undefined }),
    ]),
    p("IP-FIN-0004", "Pad-mount routine tests", "FIN", "Item Group", { itemGroup: "Transformers: pad-mount (FIN-TBD-2500PM, -1000PM)" }, [rev("A", "Active", "2025-06-01", FIN_PAD, { sampling: "100%", aql: undefined })]),
    p("IP-FIN-0002", "Pole-mount 50 kVA routine tests (legacy design)", "FIN", "Item", { itemId: "FIN-TBD-0050PL" }, [rev("B", "Obsolete", "2023-01-01", FIN_PAD.slice(0, 4), { effectiveTo: "2025-12-31", sampling: "100%", aql: undefined })]),
    p("IP-PSI-0006", "Pre-shipment inspection: power transformers", "PSI", "Item Group", { itemGroup: "Transformers: substation and power" }, [rev("A", "Active", "2025-06-01", PSI_POWER, { sampling: "100%", aql: undefined })]),
    p("IP-PSI-0007", "Pre-shipment inspection: pad-mount", "PSI", "Item Group", { itemGroup: "Transformers: pad-mount" }, [rev("A", "Active", "2025-06-01", PSI_POWER.filter((c) => c.seq !== 3), { sampling: "100%", aql: undefined })]),
    p("IP-RMA-0002", "Return inspection: RC3 teardown, bushings", "RMA", "Item Group", { itemGroup: "Bushings (RAW-TBD-BSH145, SPARE-TBD-BSH145)" }, [rev("A", "Active", "2026-02-01", RMA_BSH, { sampling: "100%", aql: undefined })]),
  ]
}

// ============================================================================ batches and serials
function batches(): QtBatch[] {
  const b = (id: BatchId, materialId: QtBatch["materialId"], stock: QtBatch["stock"], qty: number, qtyReceived: number, receivedOn: string, o: Partial<QtBatch> = {}): QtBatch => ({
    id, materialId, stock, qty, qtyReceived, receivedOn, warehouseId: "WH-TBD-01", ...o,
  })
  return [
    b("BAT-TBD-B0301", "RAW-TBD-BSH145", "Blocked", 6, 9, "2026-05-04", { vendorId: "VEN-TBD-0104", vendorBatch: "HP-26-0412", grnId: "GRN-TBD-0301", poId: "PO-TBD-0302", reservedFor: "SO-2026-00377", certificate: "HP-26-0412 routine test certificate" }),
    b("BAT-TBD-C2611", "RAW-TBD-CRGO23", "Unrestricted", 2150, 18400, "2026-03-02", { vendorId: "VEN-TBD-0101", vendorBatch: "NS-26-0311", heatNo: "NS-H-77812", grnId: "GRN-TBD-0262", poId: "PO-TBD-0262" }),
    b("BAT-TBD-CT0907", "RAW-TBD-CTC", "Unrestricted", 640, 4200, "2026-03-09", { vendorId: "VEN-TBD-0102", vendorBatch: "KC-0907", grnId: "GRN-TBD-0266", poId: "PO-TBD-0266" }),
    b("BAT-TBD-FL0911", "RAW-TBD-FOIL", "Unrestricted", 310, 2600, "2026-03-11", { vendorId: "VEN-TBD-0102", vendorBatch: "KC-F-0911", grnId: "GRN-TBD-0268", poId: "PO-TBD-0266" }),
    b("BAT-TBD-K0602", "RAW-TBD-KRAFT", "Unrestricted", 188, 900, "2026-02-06", { vendorId: "VEN-TBD-0107", vendorBatch: "LIP-2602", grnId: "GRN-TBD-0251", poId: "PO-TBD-0249" }),
    b("BAT-TBD-OIL-0712", "RAW-TBD-OIL", "Unrestricted", 0, 38000, "2026-07-12", { vendorId: "VEN-TBD-0105", vendorBatch: "GL-T-0712", grnId: "GRN-TBD-0318", poId: "PO-TBD-0311" }),
    b("BAT-TBD-C2690", "RAW-TBD-CRGO23", "QI Hold", 21600, 21600, "2026-10-06", { vendorId: "VEN-TBD-0101", vendorBatch: "NS-26-1002", heatNo: "NS-H-79140", grnId: "GRN-TBD-0372", poId: "PO-TBD-0352" }),
    b("BAT-TBD-OIL-0930", "RAW-TBD-OIL", "QI Hold", 38000, 38000, "2026-10-07", { vendorId: "VEN-TBD-0105", vendorBatch: "GL-T-0930", grnId: "GRN-TBD-0374", poId: "PO-TBD-0355" }),
    b("BAT-TBD-L1002", "RAW-TBD-BSH015", "QI Hold", 24, 24, "2026-10-01", { vendorId: "VEN-TBD-0112", vendorBatch: "TSB-1002", grnId: "GRN-TBD-0375", poId: "PO-TBD-0340" }),
    b("BAT-TBD-CT1003", "RAW-TBD-CTC", "QI Hold", 3900, 3900, "2026-10-08", { vendorId: "VEN-TBD-0102", vendorBatch: "KC-1003", grnId: "GRN-TBD-0377", poId: "PO-TBD-0357" }),
    b("BAT-TBD-CT6-0001", "RAW-TBD-CT600", "QI Hold", 4, 4, "2026-10-06", { vendorId: "VEN-TBD-0115", vendorBatch: "KIT-26-88", grnId: "GRN-TBD-0371", poId: "PO-TBD-0349" }),
    b("BAT-TBD-R0918", "RAW-TBD-RAD", "Blocked", 12, 12, "2026-09-18", { vendorId: "VEN-TBD-0108", vendorBatch: "HRW-0918", grnId: "GRN-TBD-0360", poId: "PO-TBD-0333" }),
    b("BAT-TBD-L0905", "RAW-TBD-BSH015", "Blocked", 18, 18, "2026-09-05", { vendorId: "VEN-TBD-0112", vendorBatch: "TSB-0905", grnId: "GRN-TBD-0351", poId: "PO-TBD-0330" }),
    b("BAT-TBD-K0921", "RAW-TBD-KRAFT", "Unrestricted", 900, 900, "2026-09-21", { vendorId: "VEN-TBD-0107", vendorBatch: "LIP-2609", grnId: "GRN-TBD-0362", poId: "PO-TBD-0336", warehouseId: "WH-TBD-02" }),
    b("BAT-TBD-C2655", "RAW-TBD-CRGO23", "Unrestricted", 9800, 17900, "2026-08-24", { vendorId: "VEN-TBD-0101", vendorBatch: "NS-26-0819", heatNo: "NS-H-78560", grnId: "GRN-TBD-0341", poId: "PO-TBD-0322" }),
    b("BAT-TBD-L0815", "RAW-TBD-BSH015", "Quarantine", 9, 40, "2026-08-15", { vendorId: "VEN-TBD-0112", vendorBatch: "TSB-0815", grnId: "GRN-TBD-0336", poId: "PO-TBD-0318" }),
    b("BAT-TBD-GS0714", "SPARE-TBD-GSKT20", "Quarantine", 14, 30, "2026-07-14", { vendorId: "VEN-TBD-0111", vendorBatch: "SGS-0714", grnId: "GRN-TBD-0320", poId: "PO-TBD-0310", warehouseId: "WH-TBD-03" }),
    b("BAT-TBD-SK0301", "SPARE-TBD-OLTCK", "Unrestricted", 22, 30, "2026-03-01", { vendorId: "VEN-TBD-0103", vendorBatch: "RW-K-0301", grnId: "GRN-TBD-0259", poId: "PO-TBD-0255", warehouseId: "WH-TBD-03" }),
    b("BAT-TBD-R2507", "RAW-TBD-RAD", "Unrestricted", 0, 48, "2025-07-25", { vendorId: "VEN-TBD-0108", vendorBatch: "HRW-2507", grnId: "GRN-TBD-0144", poId: "PO-TBD-0139" }),
  ]
}

function serials(): QtSerial[] {
  const s = (id: SerialNo, materialId: QtSerial["materialId"], status: QtSerial["status"], bornOn: string, o: Partial<QtSerial> = {}): QtSerial => ({ id, materialId, status, bornOn, ...o })
  const hero = { customerId: "CUS-TBD-0048", site: "Omaha North 115 kV substation" } as const
  const out: QtSerial[] = [
    s("SN-TBD-20M-0301", "FIN-TBD-20MVA", "Shipped", "2026-04-06", { woId: "WO-TBD-0301", ...hero }),
    s("SN-TBD-CORE-0301", "SEMI-TBD-CORE20", "Shipped", "2026-04-20", { parentSerial: "SN-TBD-20M-0301", woId: "WO-TBD-0301" }),
    ...(["A", "B", "C"] as const).flatMap((ph) => [
      s(`SN-TBD-HVC-0301${ph}`, "SEMI-TBD-HVC20", "Shipped", "2026-05-11", { parentSerial: "SN-TBD-20M-0301", woId: "WO-TBD-0301" }),
      s(`SN-TBD-LVC-0301${ph}`, "SEMI-TBD-LVC20", "Shipped", "2026-05-06", { parentSerial: "SN-TBD-20M-0301", woId: "WO-TBD-0301" }),
    ]),
    s("SN-TBD-OLTC-0301", "RAW-TBD-OLTC", "Shipped", "2026-04-27", { parentSerial: "SN-TBD-20M-0301", vendorSerial: "RW-OL-26-1187" }),
    s("SN-TBD-BSH-0301", "RAW-TBD-BSH145", "Shipped", "2026-05-04", { parentSerial: "SN-TBD-20M-0301", batchId: "BAT-TBD-B0301", vendorSerial: "HP-412-01" }),
    s("SN-TBD-BSH-0302", "RAW-TBD-BSH145", "QI Hold", "2026-05-04", { batchId: "BAT-TBD-B0301", vendorSerial: "HP-412-02" }),
    s("SN-TBD-BSH-0303", "RAW-TBD-BSH145", "Shipped", "2026-05-04", { parentSerial: "SN-TBD-20M-0301", batchId: "BAT-TBD-B0301", vendorSerial: "HP-412-03" }),
    ...[4, 5, 6, 7, 8, 9].map((n) => s(`SN-TBD-BSH-030${n}`, "RAW-TBD-BSH145", "Reserved", "2026-05-04", { batchId: "BAT-TBD-B0301", vendorSerial: `HP-412-0${n}` })),
    s("SN-TBD-BSH-S0117", "SPARE-TBD-BSH145", "Shipped", "2025-12-02", { parentSerial: "SN-TBD-20M-0301", vendorSerial: "HP-388-17" }),
    // final test queue and other units
    s("SN-TBD-5M-0388", "FIN-TBD-5000SS", "In Production", "2026-08-03", { woId: "WO-TBD-0388", customerId: "CUS-TBD-0027" }),
    s("SN-TBD-7M5-0391", "FIN-TBD-7500MTO", "In Production", "2026-08-10", { woId: "WO-TBD-0391", customerId: "CUS-TBD-0035" }),
    s("SN-TBD-5M-0395", "FIN-TBD-5000SS", "In Production", "2026-08-24", { woId: "WO-2026-00395", customerId: "CUS-TBD-0044" }),
    s("SN-TBD-2500-0397", "FIN-TBD-2500PM", "In Production", "2026-09-07", { woId: "WO-TBD-0397", customerId: "CUS-TBD-0031" }),
    s("SN-TBD-5M-0372", "FIN-TBD-5000SS", "Picked", "2026-06-15", { woId: "WO-TBD-0372", customerId: "CUS-TBD-0041" }),
    s("SN-TBD-5M-0365", "FIN-TBD-5000SS", "Available", "2026-06-01", { woId: "WO-TBD-0365" }),
    s("SN-TBD-CORE-0395", "SEMI-TBD-CORE20", "In Production", "2026-09-28", { woId: "WO-2026-00395" }),
    s("SN-TBD-CORE-0398", "SEMI-TBD-CORE20", "In Production", "2026-10-02", { woId: "WO-TBD-0398" }),
    s("SN-TBD-HVC-0393A", "SEMI-TBD-HVC20", "In Production", "2026-09-22", { woId: "WO-TBD-0393" }),
    s("SN-TBD-HVC-0391A", "SEMI-TBD-HVC20", "In Production", "2026-09-01", { woId: "WO-TBD-0391", parentSerial: "SN-TBD-7M5-0391" }),
    ...[1, 2, 3, 4].map((n) => s(`SN-TBD-CT6-000${n}`, "RAW-TBD-CT600", "QI Hold", "2026-10-06", { batchId: "BAT-TBD-CT6-0001" })),
  ]
  // pad-mount units in the field with the suspect LV bushing batch (RCL-2026-003)
  const pads: [string, QtSerial["customerId"], string][] = [
    ["1141", "CUS-TBD-0031", "Minot substation yard"], ["1142", "CUS-TBD-0031", "Minot substation yard"], ["1146", "CUS-TBD-0027", "Manitowoc north substation"],
    ["1147", "CUS-TBD-0027", "Manitowoc north substation"], ["1150", "CUS-TBD-0041", "Butte mill switchyard"], ["1153", "CUS-TBD-0017", "Duluth job site 2291"],
  ]
  for (const [n, c, site] of pads) out.push(s(`SN-TBD-2500-${n}`, "FIN-TBD-2500PM", "Shipped", "2026-08-20", { customerId: c, site }))
  // spare OLTC contact kits from BAT-TBD-SK0301 (RCL-2026-002, still at Identify)
  const kits: [string, QtSerial["status"], QtSerial["customerId"], string?][] = [["01", "Shipped", "CUS-TBD-0031", "Minot substation yard"], ["02", "Shipped", "CUS-TBD-0044", "Poste Alma"], ["03", "Shipped", "CUS-TBD-0052", "Prince Albert operations yard"], ["04", "Available", undefined], ["05", "Available", undefined]]
  for (const [n, st, c, site] of kits) out.push(s(`SN-TBD-OK-0301-${n}`, "SPARE-TBD-OLTCK", st, "2026-03-01", { batchId: "BAT-TBD-SK0301", customerId: c, site }))
  out.push(s("SN-TBD-2500-1155", "FIN-TBD-2500PM", "Available", "2026-08-28"), s("SN-TBD-2500-1156", "FIN-TBD-2500PM", "Reserved", "2026-08-28"))
  return out
}

// ============================================================================ genealogy (FL-11, T01..T13)
function genealogy(): QtEvent[] {
  const log: QtEvent[] = []
  const add = (e: Omit<NewEvent, "doc"> & { doc: NewEvent["doc"] }) => appendEvent(log, e)
  const at = (d: string, t = "09:00") => `${d}T${t}:00`
  const HERO_WO = { type: "productionOrder", id: "WO-TBD-0301" } as const
  // T01 supplier source
  add({ type: "T01", at: at("2026-02-10", "14:12"), doc: { type: "purchaseOrder", id: "PO-TBD-0301" }, userId: "USR-TBD-039", evidence: "VEN-TBD-0103 Rheinwerk, site Regensburg, PO line 10, MPN RW-VRC-115-17, STP-000301 v1" })
  add({ type: "T01", at: at("2026-02-12", "10:40"), doc: { type: "purchaseOrder", id: "PO-TBD-0302" }, userId: "USR-TBD-039", evidence: "VEN-TBD-0104 Hanseong, site Changwon, PO line 10, MPN HP-OIP-145-800" })
  add({ type: "T01", at: at("2026-02-20", "08:55"), doc: { type: "purchaseOrder", id: "PO-TBD-0262" }, userId: "USR-TBD-040", evidence: "VEN-TBD-0101 Northstar, mill Butler IN, grade M-OH 0.23 mm" })
  // T02 receipt identity
  add({ type: "T02", at: at("2026-03-02", "07:30"), batch: "BAT-TBD-C2611", doc: { type: "grn", id: "GRN-TBD-0262" }, scanPoint: "SP-02", qty: 18400, userId: P.receiving, evidence: "Vendor batch NS-26-0311, heat NS-H-77812, 18,400 kg, CoO US, mill cert checksum 7c1e9a02" })
  add({ type: "T02", at: at("2026-03-09", "08:10"), batch: "BAT-TBD-CT0907", doc: { type: "grn", id: "GRN-TBD-0266" }, scanPoint: "SP-02", qty: 4200, userId: P.receiving, evidence: "Vendor batch KC-0907, 4,200 kg, CoO US, conductivity cert 101.2% IACS" })
  add({ type: "T02", at: at("2026-03-11", "08:25"), batch: "BAT-TBD-FL0911", doc: { type: "grn", id: "GRN-TBD-0268" }, scanPoint: "SP-02", qty: 2600, userId: P.receiving, evidence: "Vendor batch KC-F-0911, 2,600 kg" })
  add({ type: "T02", at: at("2026-02-06", "10:05"), batch: "BAT-TBD-K0602", doc: { type: "grn", id: "GRN-TBD-0251" }, scanPoint: "SP-02", qty: 900, userId: P.receiving, evidence: "Vendor batch LIP-2602, 900 kg, CoO CA" })
  add({ type: "T02", at: at("2026-04-27", "13:00"), serial: "SN-TBD-OLTC-0301", doc: { type: "grn", id: "GRN-TBD-0288" }, scanPoint: "SP-03", qty: 1, userId: P.receiving, evidence: "Vendor serial RW-OL-26-1187, CoO DE, routine test report checksum 3fa0b611" })
  add({ type: "T02", at: at("2026-05-04", "08:02"), batch: "BAT-TBD-B0301", doc: { type: "grn", id: "GRN-TBD-0301" }, scanPoint: "SP-02", qty: 9, userId: P.receiving, evidence: "Vendor batch HP-26-0412, 9 EA, CoO KR, certificate checksum a91d44e0" })
  for (let n = 1; n <= 9; n++)
    add({ type: "T02", at: at("2026-05-04", `08:${String(4 + n).padStart(2, "0")}`), serial: `SN-TBD-BSH-030${n}`, batch: "BAT-TBD-B0301", doc: { type: "grn", id: "GRN-TBD-0301" }, scanPoint: "SP-03", qty: 1, userId: P.receiving, evidence: `Vendor serial HP-412-0${n}; status QI Hold` })
  // T03 incoming quality, T04 putaway
  add({ type: "T03", at: at("2026-05-05", "11:20"), batch: "BAT-TBD-B0301", doc: { type: "inspectionLot", id: "IL-TBD-0301" }, scanPoint: "SP-14", userId: P.inspector, evidence: "IP-INC-0031 rev B, sample 2 of 9, all pass, instruments CAL-0109 / CAL-0111 / CAL-0112, disposition Accept" })
  add({ type: "T04", at: at("2026-05-05", "13:45"), batch: "BAT-TBD-B0301", doc: { type: "grn", id: "GRN-TBD-0301" }, scanPoint: "SP-04", qty: 9, userId: P.whop, device: "HH-03", evidence: "Dock → BIN-TBD-A-14-03, QI Hold → Unrestricted, PE-owned" })
  // production of the hero unit
  add({ type: "T07", at: at("2026-04-20", "15:10"), serial: "SN-TBD-CORE-0301", doc: HERO_WO, scanPoint: "SP-11", userId: P.operator, evidence: "WC-110 op 0020 core stacking, MBOM-TBD-0301 rev B, RTG-TBD-20MVA rev B, good 1" })
  add({ type: "T05", at: at("2026-04-14", "07:40"), serial: "SN-TBD-CORE-0301", batch: "BAT-TBD-C2611", doc: HERO_WO, scanPoint: "SP-08", qty: 16250, userId: P.operator, evidence: "Issue 16,250 kg to WO-TBD-0301 op 0010 WC-100, bin BIN-TBD-C-02-01, FIFO" })
  for (const ph of ["A", "B", "C"]) {
    add({ type: "T05", at: at("2026-05-04", "07:15"), serial: `SN-TBD-LVC-0301${ph}`, batch: "BAT-TBD-FL0911", doc: HERO_WO, scanPoint: "SP-08", qty: 760, userId: "USR-TBD-033", evidence: "Issue 760 kg copper foil to op 0040 WC-200" })
    add({ type: "T05", at: at("2026-05-07", "07:20"), serial: `SN-TBD-HVC-0301${ph}`, batch: "BAT-TBD-CT0907", doc: HERO_WO, scanPoint: "SP-08", qty: 1180, userId: "USR-TBD-033", evidence: "Issue 1,180 kg CTC to op 0050 WC-210" })
    add({ type: "T05", at: at("2026-05-07", "07:25"), serial: `SN-TBD-HVC-0301${ph}`, batch: "BAT-TBD-K0602", doc: HERO_WO, scanPoint: "SP-08", qty: 64, userId: "USR-TBD-033", evidence: "Issue 64 kg kraft paper to op 0050 WC-210" })
  }
  add({ type: "T07", at: at("2026-06-02", "16:30"), serial: "SN-TBD-20M-0301", doc: HERO_WO, scanPoint: "SP-11", userId: P.operator, evidence: "WC-300 op 0100 core and coil assembly, good 1, labor 46.5 h" })
  for (const [child, op] of [["SN-TBD-CORE-0301", "0100"], ["SN-TBD-HVC-0301A", "0100"], ["SN-TBD-HVC-0301B", "0100"], ["SN-TBD-HVC-0301C", "0100"], ["SN-TBD-LVC-0301A", "0100"], ["SN-TBD-LVC-0301B", "0100"], ["SN-TBD-LVC-0301C", "0100"]] as const)
    add({ type: "T06", at: at("2026-06-02", "16:35"), serial: child, parentSerial: "SN-TBD-20M-0301", doc: HERO_WO, scanPoint: "SP-12", action: "install", userId: P.operator, evidence: `Installed in SN-TBD-20M-0301 at op ${op} WC-300` })
  add({ type: "T05", at: at("2026-06-15", "06:50"), serial: "SN-TBD-20M-0301", batch: "BAT-TBD-OIL-0712", doc: HERO_WO, scanPoint: "SP-08", qty: 14200, userId: P.operator, evidence: "Issue 14,200 L oil to op 0130 WC-320, vacuum fill" })
  add({ type: "T05", at: at("2026-06-22", "07:05"), batch: "BAT-TBD-B0301", doc: HERO_WO, scanPoint: "SP-08", qty: 3, userId: P.operator, evidence: "Issue 3 EA to op 0150 WC-400 from BIN-TBD-A-14-03" })
  for (const child of ["SN-TBD-BSH-0301", "SN-TBD-BSH-0302", "SN-TBD-BSH-0303", "SN-TBD-OLTC-0301"] as const)
    add({ type: "T06", at: at("2026-06-23", "10:20"), serial: child, parentSerial: "SN-TBD-20M-0301", doc: HERO_WO, scanPoint: "SP-12", action: "install", userId: P.operator, evidence: "Installed in SN-TBD-20M-0301 at op 0150 WC-400" })
  add({ type: "T07", at: at("2026-06-26", "17:00"), serial: "SN-TBD-20M-0301", doc: HERO_WO, scanPoint: "SP-11", userId: P.operator, evidence: "WC-400 op 0150 final assembly and fittings, good 1" })
  add({ type: "T08", at: at("2026-07-28", "16:45"), serial: "SN-TBD-20M-0301", doc: { type: "inspectionLot", id: "IL-TBD-0302" }, scanPoint: "SP-14", userId: P.tester, evidence: "IP-FIN-0003 rev D, run 1, all pass, calibration current for CAL-0101..0108; FTR-2026-0188" })
  add({ type: "T09", at: at("2026-07-30", "09:30"), serial: "SN-TBD-20M-0301", doc: HERO_WO, userId: P.supervisor, evidence: "FG receipt, standard cost version 2026-01, location WH-TBD-01 yard, quality status Unrestricted" })
  add({ type: "T10", at: at("2026-08-07", "15:40"), serial: "SN-TBD-20M-0301", doc: { type: "delivery", id: "DLV-TBD-0031" }, scanPoint: "SP-17", userId: P.packer, evidence: "HU-TBD-0031-1 (main tank), HU-TBD-0031-2..4 (radiators, bushings crate, accessories); seals 44120-44123" })
  add({ type: "T11", at: at("2026-08-11", "06:15"), serial: "SN-TBD-20M-0301", doc: { type: "delivery", id: "DLV-TBD-0031" }, scanPoint: "SP-18", userId: P.shipping, evidence: "BOL-TBD-0031, carrier Great Plains Heavy Haul, PGI posted (#25), site Omaha North" })
  add({ type: "T11", at: at("2026-08-14", "12:00"), serial: "SN-TBD-20M-0301", doc: { type: "pod", id: "POD-TBD-0031" }, userId: P.shipping, evidence: "POD signed, condition: no damage; impact recorder below 3 g" })
  // field event: bushing replaced from spares, returned on RMA
  add({ type: "T06", at: at("2026-09-26", "14:00"), serial: "SN-TBD-BSH-0302", parentSerial: "SN-TBD-20M-0301", doc: { type: "rma", id: "RMA-TBD-0012" }, action: "remove", userId: "USR-TBD-003", evidence: "Removed in the field by PE service: oil weep at flange (reason)" })
  add({ type: "T06", at: at("2026-09-26", "16:10"), serial: "SN-TBD-BSH-S0117", parentSerial: "SN-TBD-20M-0301", doc: { type: "rma", id: "RMA-TBD-0012" }, action: "install", userId: "USR-TBD-003", evidence: "Installed spare SPARE-TBD-BSH145 as replacement" })
  add({ type: "T12", at: at("2026-09-29", "10:30"), serial: "SN-TBD-BSH-0302", doc: { type: "rma", id: "RMA-TBD-0012" }, scanPoint: "SP-19", userId: P.receiving, evidence: "RMA receipt, condition: oil film on flange, crated; to return inspection" })
  // recall
  add({ type: "T13", at: at("2026-10-02", "15:00"), batch: "BAT-TBD-B0301", doc: { type: "recall", id: "RCL-2026-001" }, userId: P.qm, evidence: "Campaign opened from NCR-TBD-0044, population v1: 3 serials in the field" })
  add({ type: "T13", at: at("2026-10-03", "08:30"), batch: "BAT-TBD-B0301", doc: { type: "recall", id: "RCL-2026-001" }, evidence: "System bulk job. Mass hold: 6 EA in stock Unrestricted → Blocked; 0 no-op" })
  add({ type: "T13", at: at("2026-10-06", "11:10"), batch: "BAT-TBD-B0301", doc: { type: "recall", id: "RCL-2026-001" }, userId: P.qm, evidence: "Population v2: +6 serials in stock reserved for SO-2026-00377 (diff logged)" })
  // other units in the final test queue
  add({ type: "T07", at: at("2026-09-30", "16:00"), serial: "SN-TBD-5M-0388", doc: { type: "productionOrder", id: "WO-TBD-0388" }, scanPoint: "SP-11", userId: P.operator, evidence: "WC-400 op 0150 final assembly, good 1" })
  add({ type: "T08", at: at("2026-10-07", "17:20"), serial: "SN-TBD-5M-0388", doc: { type: "inspectionLot", id: "IL-TBD-0352" }, scanPoint: "SP-14", userId: P.tester, evidence: "IP-FIN-0003 rev D, run 1 session 1, characteristics 1-3 captured" })
  add({ type: "T08", at: at("2026-10-02", "15:45"), serial: "SN-TBD-7M5-0391", doc: { type: "inspectionLot", id: "IL-TBD-0353" }, scanPoint: "SP-14", userId: P.tester, evidence: "IP-FIN-0003 rev D, run 1 FAIL: PD 410 pC above 250 pC; NCR-TBD-0049" })
  add({ type: "T05", at: at("2026-10-05", "07:30"), serial: "SN-TBD-CORE-0395", batch: "BAT-TBD-C2655", doc: { type: "productionOrder", id: "WO-2026-00395" }, scanPoint: "SP-08", qty: 12400, userId: P.operator, evidence: "Issue 12,400 kg to op 0010 WC-100" })
  add({ type: "T05", at: at("2026-10-05", "07:42"), serial: "SN-TBD-CORE-0398", batch: "BAT-TBD-C2611", doc: { type: "productionOrder", id: "WO-TBD-0398" }, scanPoint: "SP-08", qty: 1200, userId: P.operator, evidence: "Issue 1,200 kg to op 0010 WC-100 (wrong batch scanned; operator meant BAT-TBD-C2655)" })
  add({ type: "T05", at: at("2026-10-05", "08:05"), serial: "SN-TBD-CORE-0398", batch: "BAT-TBD-C2611", doc: { type: "productionOrder", id: "WO-TBD-0398" }, scanPoint: "SP-08", qty: 1200, userId: P.supervisor, correction: "Reversed", refersTo: log[log.length - 1].id, evidence: "Reversal of the wrong-batch issue (correction pair, replacement pending)" })
  add({ type: "T10", at: at("2026-10-08", "14:20"), serial: "SN-TBD-5M-0372", doc: { type: "delivery", id: "DLV-TBD-0052" }, scanPoint: "SP-17", userId: P.packer, evidence: "HU-TBD-0052-1, seal 44290" })
  add({ type: "T04", at: at("2026-10-08", "02:10"), serial: "SN-TBD-5M-0365", doc: { type: "productionOrder", id: "WO-TBD-0365" }, scanPoint: "SP-15", userId: P.whop, device: "HH-07", delayedMin: 320, evidence: "Pick to staging lane 4 (captured offline, synced 07:30)" })
  add({ type: "T04", at: at("2026-10-08", "09:40"), serial: "SN-TBD-CT6-0003", doc: { type: "grn", id: "GRN-TBD-0371" }, scanPoint: "SP-04", userId: P.whop, device: "HH-03", delayedMin: 70, evidence: "Putaway to BIN-TBD-Q-01-02 (no T02 receipt event found for this serial)" })
  // deviation evidence rows: affected serials / batches link to the approved deviation [DOC:p.215 Book IV §7.3]
  const devRows: [string, string, string[], string[], string, string][] = [
    ["DEV-2026-0008", "2026-02-07", ["SN-TBD-HVC-0301A", "SN-TBD-HVC-0301B", "SN-TBD-HVC-0301C"], ["BAT-TBD-K0602"], "Kraft paper density 0.78 g/cm³ accepted (≥ 0.76); customer concession MPG-2026-0207", "2026-05-07"],
    ["DEV-2026-0011", "2026-08-28", ["SN-TBD-CORE-0395", "SN-TBD-CORE-0398"], ["BAT-TBD-C2655"], "CRGO lamination 0.243 mm accepted (≤ 0.245 mm; core loss within guarantee)", "2026-10-05"],
    ["DEV-2026-0009", "2026-07-03", [], ["BAT-TBD-R2507"], "Radiator fin pitch 52 ± 1 mm accepted, temporary, expired 2026-09-30", "2026-07-03"],
  ]
  for (const [dev, on, sers, bats, text, serOn] of devRows) {
    for (const sn of sers) add({ type: "T08", at: at(serOn, "15:30"), serial: sn as SerialNo, doc: { type: "deviation", id: dev }, userId: P.qm, evidence: `${dev} applies: ${text}` })
    for (const b of bats) add({ type: "T03", at: at(on, "15:35"), batch: b as BatchId, doc: { type: "deviation", id: dev }, userId: P.qm, evidence: `${dev} approved: ${text}` })
  }
  // closed recall from 2025
  add({ type: "T13", at: at("2025-08-12", "10:00"), batch: "BAT-TBD-R2507", doc: { type: "recall", id: "RCL-2025-004" }, userId: P.qm, evidence: "Campaign closed: 12 of 12 accounted, effectiveness check passed" })
  return log
}

// ============================================================================ inspection lots (QM-EXEC)
const R = (seq: number, v: number | "Pass" | "Fail" | "NA", instrumentId?: InstrumentId, by: UserId = P.inspector, at = TODAY): ResultRow =>
  typeof v === "number" ? { seq, value: v, instrumentId, by, at } : { seq, attr: v, instrumentId, by, at }

function lots(): InspectionLot[] {
  const L = (o: Partial<InspectionLot> & Pick<InspectionLot, "id" | "gate" | "subject" | "itemId" | "lotSize" | "sampleSize" | "createdOn">): InspectionLot => ({
    serials: [], instruments: [], results: [], slaDays: o.gate === "IQC" ? 3 : o.gate === "RQC" ? 5 : 1, activity: [{ at: o.createdOn, by: "System", text: "Inspection created by the gate trigger" }], ...o,
  })
  return [
    L({ id: "IL-TBD-0301", gate: "IQC", planId: "IP-INC-0031", planRev: "B", subject: { type: "grn", id: "GRN-TBD-0301" }, itemId: "RAW-TBD-BSH145", vendorId: "VEN-TBD-0104", batchId: "BAT-TBD-B0301",
      serials: ["SN-TBD-BSH-0301", "SN-TBD-BSH-0302", "SN-TBD-BSH-0303", "SN-TBD-BSH-0304", "SN-TBD-BSH-0305", "SN-TBD-BSH-0306", "SN-TBD-BSH-0307", "SN-TBD-BSH-0308", "SN-TBD-BSH-0309"],
      lotSize: 9, sampleSize: 2, createdOn: "2026-05-04", samplePulled: { by: P.inspector, on: "2026-05-05" }, instruments: ["INS-TBD-0109", "INS-TBD-0111", "INS-TBD-0112"],
      results: [R(1, "Pass", undefined, P.inspector, "2026-05-05"), R(2, 540.1, "INS-TBD-0112", P.inspector, "2026-05-05"), R(3, 455, "INS-TBD-0109", P.inspector, "2026-05-05"), R(4, 0.31, "INS-TBD-0109", P.inspector, "2026-05-05"), R(5, "Pass", undefined, P.inspector, "2026-05-05")],
      certificate: "HP-26-0412 routine test certificate.pdf", inspectorId: P.inspector, decision: "Accepted", decidedOn: "2026-05-05", decidedBy: P.inspector }),
    L({ id: "IL-TBD-0361", gate: "IQC", planId: "IP-INC-0027", planRev: "C", subject: { type: "grn", id: "GRN-TBD-0372" }, itemId: "RAW-TBD-CRGO23", vendorId: "VEN-TBD-0101", batchId: "BAT-TBD-C2690", lotSize: 8, sampleSize: 8, createdOn: "2026-10-06" }),
    L({ id: "IL-TBD-0362", gate: "IQC", planId: "IP-INC-0033", planRev: "A", subject: { type: "grn", id: "GRN-TBD-0374" }, itemId: "RAW-TBD-OIL", vendorId: "VEN-TBD-0105", batchId: "BAT-TBD-OIL-0930", lotSize: 38000, sampleSize: 2, createdOn: "2026-10-07",
      samplePulled: { by: P.inspector, on: "2026-10-08" }, instruments: ["INS-TBD-0108"], results: [R(2, 18, "INS-TBD-0108", P.inspector, "2026-10-08"), R(3, "Pass", undefined, P.inspector, "2026-10-08")], inspectorId: P.inspector }),
    L({ id: "IL-TBD-0363", gate: "IQC", planId: "IP-INC-0038", planRev: "B", subject: { type: "grn", id: "GRN-TBD-0375" }, itemId: "RAW-TBD-BSH015", vendorId: "VEN-TBD-0112", batchId: "BAT-TBD-L1002", lotSize: 24, sampleSize: 8, createdOn: "2026-10-01" }),
    L({ id: "IL-TBD-0364", gate: "IQC", planId: "IP-INC-0035", planRev: "A", subject: { type: "grn", id: "GRN-TBD-0377" }, itemId: "RAW-TBD-CTC", vendorId: "VEN-TBD-0102", batchId: "BAT-TBD-CT1003", lotSize: 3900, sampleSize: 3, createdOn: "2026-10-08" }),
    L({ id: "IL-TBD-0365", gate: "IQC", adHoc: true, adHocRows: [ch(1, "Ratio check 600:5 (ad hoc)", "IEEE C57.13", "Quantitative", "Ratio error", { uom: "%", min: -0.3, max: 0.3, instrumentClass: "TTR" })], subject: { type: "grn", id: "GRN-TBD-0371" }, itemId: "RAW-TBD-CT600", vendorId: "VEN-TBD-0115", batchId: "BAT-TBD-CT6-0001",
      serials: ["SN-TBD-CT6-0001", "SN-TBD-CT6-0002", "SN-TBD-CT6-0003", "SN-TBD-CT6-0004"], lotSize: 4, sampleSize: 4, createdOn: "2026-10-06", ncrId: "NCR-TBD-0050" }),
    L({ id: "IL-TBD-0356", gate: "IQC", planId: "IP-INC-0019", planRev: "A", subject: { type: "grn", id: "GRN-TBD-0360" }, itemId: "RAW-TBD-RAD", vendorId: "VEN-TBD-0108", batchId: "BAT-TBD-R0918", lotSize: 12, sampleSize: 3, createdOn: "2026-09-18",
      results: [R(1, "Fail", undefined, P.inspector, "2026-09-19")], inspectorId: P.inspector, decision: "Rejected", decidedOn: "2026-09-19", decidedBy: P.qm, disposition: "Return to vendor", ncrId: "NCR-TBD-0047" }),
    L({ id: "IL-TBD-0357", gate: "IQC", planId: "IP-INC-0027", planRev: "C", subject: { type: "grn", id: "GRN-TBD-0362" }, itemId: "RAW-TBD-KRAFT", vendorId: "VEN-TBD-0107", batchId: "BAT-TBD-K0921", lotSize: 900, sampleSize: 3, createdOn: "2026-09-21",
      results: [R(1, 0.79, "INS-TBD-0113", P.inspector, "2026-09-22"), R(2, 0.23, "INS-TBD-0117", P.inspector, "2026-09-22"), R(3, "Pass", undefined, P.inspector, "2026-09-22"), R(4, "Pass", undefined, P.inspector, "2026-09-22")], certificate: "LIP-2609 certificate.pdf",
      inspectorId: P.inspector, decision: "Accepted", decidedOn: "2026-09-22", decidedBy: P.inspector }),
    L({ id: "IL-TBD-0358", gate: "IQC", planId: "IP-INC-0038", planRev: "B", subject: { type: "grn", id: "GRN-TBD-0351" }, itemId: "RAW-TBD-BSH015", vendorId: "VEN-TBD-0112", batchId: "BAT-TBD-L0905", lotSize: 18, sampleSize: 8, createdOn: "2026-09-05",
      results: [R(1, "Fail", undefined, P.inspector, "2026-09-06"), R(2, 120.2, "INS-TBD-0111", P.inspector, "2026-09-06"), R(3, "Pass", "INS-TBD-0105", P.inspector, "2026-09-06")], inspectorId: P.inspector, decision: "Rejected", decidedOn: "2026-09-06", decidedBy: P.qm, disposition: "Scrap", ncrId: "NCR-TBD-0046" }),
    L({ id: "IL-TBD-0359", gate: "IQC", planId: "IP-INC-0027", planRev: "C", subject: { type: "grn", id: "GRN-TBD-0341" }, itemId: "RAW-TBD-CRGO23", vendorId: "VEN-TBD-0101", batchId: "BAT-TBD-C2655", lotSize: 7, sampleSize: 7, createdOn: "2026-08-24",
      results: [R(1, 0.82, "INS-TBD-0113", P.inspector, "2026-08-25"), R(2, 0.243, "INS-TBD-0117", P.inspector, "2026-08-25"), R(3, "Pass", undefined, P.inspector, "2026-08-25"), R(4, "Pass", undefined, P.inspector, "2026-08-25")], certificate: "NS-26-0819 mill cert.pdf",
      inspectorId: P.inspector, decision: "Accepted", decidedOn: "2026-08-27", decidedBy: P.qm, disposition: "Use as is under deviation", deviationId: "DEV-2026-0011" }),
    L({ id: "IL-TBD-0366", gate: "IPQC", planId: "IP-INP-0012", planRev: "A", subject: { type: "productionOrder", id: "WO-2026-00395" }, itemId: "SEMI-TBD-CORE20", serials: ["SN-TBD-CORE-0395"], lotSize: 1, sampleSize: 1, createdOn: "2026-10-08", workCenterId: "WC-110" }),
    L({ id: "IL-TBD-0367", gate: "IPQC", planId: "IP-INP-0015", planRev: "B", subject: { type: "productionOrder", id: "WO-TBD-0398" }, itemId: "SEMI-TBD-TANK20", lotSize: 1, sampleSize: 1, createdOn: "2026-10-07", workCenterId: "WC-050",
      instruments: ["INS-TBD-0115"], results: [R(1, 12.1, "INS-TBD-0115", "USR-TBD-034", "2026-10-08")], inspectorId: P.inspector }),
    L({ id: "IL-TBD-0350", gate: "IPQC", planId: "IP-INP-0014", planRev: "A", subject: { type: "productionOrder", id: "WO-TBD-0391" }, itemId: "SEMI-TBD-HVC20", serials: ["SN-TBD-HVC-0391A"], lotSize: 1, sampleSize: 1, createdOn: "2026-09-01", workCenterId: "WC-210",
      results: [R(1, "Pass", undefined, P.inspector, "2026-09-01"), R(2, 87.2, "INS-TBD-0111", P.inspector, "2026-09-01"), R(3, 0.08, "INS-TBD-0101", P.inspector, "2026-09-01")], inspectorId: P.inspector, decision: "Accepted", decidedOn: "2026-09-01", decidedBy: P.inspector }),
    L({ id: "IL-TBD-0351", gate: "IPQC", planId: "IP-INP-0014", planRev: "A", subject: { type: "productionOrder", id: "WO-TBD-0393" }, itemId: "SEMI-TBD-HVC20", serials: ["SN-TBD-HVC-0393A"], lotSize: 1, sampleSize: 1, createdOn: "2026-09-22", workCenterId: "WC-210",
      results: [R(1, "Fail", undefined, P.inspector, "2026-09-22"), R(2, 87.4, "INS-TBD-0111", P.inspector, "2026-09-22"), R(3, 0.92, "INS-TBD-0101", P.inspector, "2026-09-22")], inspectorId: P.inspector, decision: "Rejected", decidedOn: "2026-09-22", decidedBy: P.qm, disposition: "Rework", ncrId: "NCR-TBD-0048" }),
    L({ id: "IL-TBD-0303", gate: "OQC", planId: "IP-PSI-0006", planRev: "A", subject: { type: "delivery", id: "DLV-TBD-0031" }, itemId: "FIN-TBD-20MVA", serials: ["SN-TBD-20M-0301"], lotSize: 1, sampleSize: 1, createdOn: "2026-08-09",
      results: [R(1, "Pass", undefined, P.inspector, "2026-08-10"), R(2, 3.5, "INS-TBD-0115", P.inspector, "2026-08-10"), R(3, "Pass", undefined, P.inspector, "2026-08-10"), R(4, 160, "INS-TBD-0114", P.inspector, "2026-08-10"), R(5, "Pass", undefined, P.inspector, "2026-08-10")],
      inspectorId: P.inspector, decision: "Accepted", decidedOn: "2026-08-10", decidedBy: P.inspector }),
    L({ id: "IL-TBD-0369", gate: "OQC", planId: "IP-PSI-0006", planRev: "A", subject: { type: "delivery", id: "DLV-TBD-0052" }, itemId: "FIN-TBD-5000SS", serials: ["SN-TBD-5M-0372"], lotSize: 1, sampleSize: 1, createdOn: "2026-10-08" }),
    L({ id: "IL-TBD-0304", gate: "RQC", planId: "IP-RMA-0002", planRev: "A", subject: { type: "rma", id: "RMA-TBD-0012" }, itemId: "RAW-TBD-BSH145", vendorId: "VEN-TBD-0104", batchId: "BAT-TBD-B0301", serials: ["SN-TBD-BSH-0302"], lotSize: 1, sampleSize: 1, createdOn: "2026-09-29",
      results: [R(1, "Pass", undefined, P.inspector, "2026-10-01"), R(2, "Fail", undefined, P.inspector, "2026-10-01")], inspectorId: P.inspector, ncrId: "NCR-TBD-0044",
      activity: [{ at: "2026-09-29", by: "System", text: "Created by RMA receipt (SP-19)" }, { at: "2026-10-01", by: "Inspector", text: "Flange seal fail recorded; NCR-TBD-0044 created" }] }),
    L({ id: "IL-TBD-0370", gate: "RQC", planId: "IP-RMA-0002", planRev: "A", subject: { type: "rma", id: "RMA-TBD-0015" }, itemId: "SPARE-TBD-BSH145", serials: [], lotSize: 1, sampleSize: 1, createdOn: "2026-10-02" }),
  ]
}

// ============================================================================ final tests (QM-FIN-001)
export function finSpec(nll: number, z: number, wr: number, typeTest = false, pad = false): QtCharacteristic[] {
  return (pad ? FIN_PAD : FIN_POWER).filter((c) => typeTest || c.seq !== 9).map((c) => {
    // winding resistance: the specification says "design sheet ±tolerances" without a number; ±2% is a reading (QT-R24)
    if (c.seq === 1) return { ...c, target: wr, min: +(wr * 0.98).toFixed(1), max: +(wr * 1.02).toFixed(1) }
    if (c.seq === 4) return { ...c, target: nll, max: +(nll * 1.1).toFixed(2) } // single unit: guarantee +10% [DOC:p.86 §3]
    if (c.seq === 5) return { ...c, target: z, min: +(z * 0.925).toFixed(2), max: +(z * 1.075).toFixed(2) } // ±7.5% two-winding [DOC:p.86 §3]
    // design values of the further rows: guarantee with the same single-unit +10% band (reading QT-R24)
    if (c.seq === 13) return { ...c, target: +(0.55 - nll * 0.02).toFixed(2), max: +((0.55 - nll * 0.02) * 1.1).toFixed(2) }
    if (c.seq === 14) return { ...c, target: +(nll * 1.32).toFixed(2), max: +(nll * 1.32 * 1.1).toFixed(2) }
    if (c.seq === 15) return { ...c, target: +(nll * 7.4).toFixed(1), max: +(nll * 7.4 * 1.1).toFixed(1) }
    return c
  })
}
const run = (n: number, sessions: string[], results: [number, number | "Pass" | "Fail"][], instruments: InstrumentId[], outcome?: TestRun["outcome"], retestScope?: number[]): TestRun => ({
  run: n, sessions, instruments, testerId: P.tester, ambient: "22 °C, 41% RH", outcome, retestScope,
  results: results.map(([seq, v]) => R(seq, v, undefined, P.tester, sessions[sessions.length - 1])),
})
const FIN_INS: InstrumentId[] = ["INS-TBD-0101", "INS-TBD-0102", "INS-TBD-0103", "INS-TBD-0104", "INS-TBD-0105", "INS-TBD-0106", "INS-TBD-0107", "INS-TBD-0108"]

function finalTests(): FinalTest[] {
  const np = (mva: string, voltage: string, z: string): FinalTest["nameplate"] => ({ mva, voltage, cooling: "ONAN/ONAF", impedance: z, taps: "OLTC ±8 × 1.25%" })
  return [
    { id: "IL-TBD-0302", planId: "IP-FIN-0003", planRev: "D", woId: "WO-TBD-0301", woStatusText: "Closed (TECO)", serial: "SN-TBD-20M-0301", itemId: "FIN-TBD-20MVA", soId: "SO-2026-00301", customerId: "CUS-TBD-0048", promisedOn: "2026-08-10",
      nameplate: np("20 / 26.7 MVA", "115 kV - 13.8 kV", "9.5%"), spec: finSpec(12.0, 9.5, 412.0), typeTestOrdered: false,
      runs: [run(1, ["2026-07-27", "2026-07-28"], [[1, 411.6], [2, 0.11], [3, 8200], [4, 11.6], [5, 9.42], [6, "Pass"], [7, 92], [8, 62], [10, 6400], [11, 7100], [12, 2.6], [13, 0.3], [14, 15.6], [15, 89.9], [16, 12]], FIN_INS, "Pass")],
      finalResult: "Pass", ftrId: "FTR-2026-0188", ftrIssuedOn: "2026-07-28", testerSigned: P.tester, qmCountersign: { by: P.qm, on: "2026-07-29" },
      activity: [{ at: "2026-07-27", by: "Test technician", text: "Run 1 started" }, { at: "2026-07-28", by: "Test technician", text: "All pass; FTR-2026-0188 issued; milestone Production Complete / Tested fired" }, { at: "2026-07-29", by: "Quality Manager", text: "FTR countersigned" }] },
    { id: "IL-TBD-0341", planId: "IP-FIN-0003", planRev: "D", woId: "WO-TBD-0372", woStatusText: "Completed", serial: "SN-TBD-5M-0372", itemId: "FIN-TBD-5000SS", soId: "SO-2026-00309", customerId: "CUS-TBD-0041", promisedOn: "2026-09-30",
      nameplate: np("5 / 6.25 MVA", "34.5 kV - 4.16 kV", "6.5%"), spec: finSpec(4.1, 6.5, 186.0, true), typeTestOrdered: true,
      runs: [run(1, ["2026-09-14", "2026-09-15", "2026-09-17"], [[1, 185.2], [2, 0.09], [3, 6400], [4, 4.02], [5, 6.61], [6, "Pass"], [7, 120], [8, 58], [9, 61.4], [10, 4800], [11, 5200], [12, 2.2], [13, 0.46], [14, 5.3], [15, 30.9], [16, 14]], [...FIN_INS, "INS-TBD-0116"], "Pass")],
      finalResult: "Pass", ftrId: "FTR-2026-0193", ftrIssuedOn: "2026-09-17", testerSigned: P.tester, qmCountersign: { by: P.qm, on: "2026-09-18" }, activity: [{ at: "2026-09-17", by: "Test technician", text: "FTR-2026-0193 issued" }] },
    { id: "IL-TBD-0352", planId: "IP-FIN-0003", planRev: "D", woId: "WO-TBD-0388", woStatusText: "Testing", serial: "SN-TBD-5M-0388", itemId: "FIN-TBD-5000SS", soId: "SO-2026-00318", customerId: "CUS-TBD-0027", promisedOn: "2026-10-16",
      nameplate: np("5 / 6.25 MVA", "34.5 kV - 4.16 kV", "6.5%"), spec: finSpec(4.1, 6.5, 186.0), typeTestOrdered: false,
      runs: [run(1, ["2026-10-07"], [[1, 186.4], [2, 0.12], [3, 7100]], ["INS-TBD-0101", "INS-TBD-0102", "INS-TBD-0103"])], activity: [{ at: "2026-10-07", by: "Test technician", text: "Run 1 session 1 saved (partial)" }] },
    { id: "IL-TBD-0353", planId: "IP-FIN-0003", planRev: "D", woId: "WO-TBD-0391", woStatusText: "Testing", serial: "SN-TBD-7M5-0391", itemId: "FIN-TBD-7500MTO", soId: "SO-2026-00322", customerId: "CUS-TBD-0035", promisedOn: "2026-10-23",
      nameplate: np("7.5 MVA", "24.94 kV - 600Y/347 V", "5.75%"), spec: finSpec(5.6, 5.75, 96.0), typeTestOrdered: false,
      runs: [run(1, ["2026-10-01", "2026-10-02"], [[1, 96.3], [2, 0.14], [3, 5200], [4, 5.48], [5, 5.81], [6, "Pass"], [7, 410], [8, 55], [10, 3900], [11, 4300], [12, 1.9], [13, 0.43], [14, 7.2], [15, 41.9], [16, 16]], FIN_INS, "Fail", [7])],
      ncrId: "NCR-TBD-0049", disposition: "Rework", rwoRequestedOn: "2026-10-03",
      activity: [{ at: "2026-10-02", by: "Test technician", text: "Run 1 FAIL on characteristic 7 (PD 410 pC); NCR-TBD-0049 created" }, { at: "2026-10-03", by: "Quality Manager", text: "Disposition Rework: RWO requested from Production planning, retest scope characteristic 7" }] },
    { id: "IL-TBD-0354", planId: "IP-FIN-0003", planRev: "D", woId: "WO-2026-00395", woStatusText: "Testing", serial: "SN-TBD-5M-0395", itemId: "FIN-TBD-5000SS", soId: "SO-2026-00331", customerId: "CUS-TBD-0044", promisedOn: "2026-11-06",
      nameplate: np("5 / 6.25 MVA", "34.5 kV - 4.16 kV", "6.5%"), spec: finSpec(4.1, 6.5, 186.0, true), typeTestOrdered: true, runs: [], activity: [{ at: "2026-10-09", by: "System", text: "WO reached Testing; added to the final test queue" }] },
    { id: "IL-TBD-0355", planId: "IP-FIN-0004", planRev: "A", woId: "WO-TBD-0397", woStatusText: "Testing", serial: "SN-TBD-2500-0397", itemId: "FIN-TBD-2500PM", soId: "SO-2026-00340", customerId: "CUS-TBD-0031", promisedOn: "2026-10-13",
      nameplate: { mva: "2,500 kVA", voltage: "12.47 kV - 480Y/277 V", cooling: "KNAN", impedance: "5.75%", taps: "DETC ±2 × 2.5%" },
      spec: finSpec(2.9, 5.75, 640, false, true),
      typeTestOrdered: false, runs: [run(1, ["2026-10-08", "2026-10-09"], [[1, 641.2], [2, 0.1], [3, 4100], [4, 2.84], [5, 5.7], [6, "Pass"], [7, "Pass"], [10, 3100], [11, 3300], [12, 1.8], [13, 0.48], [14, 3.7], [15, 21.2], [16, 18]], ["INS-TBD-0101", "INS-TBD-0102", "INS-TBD-0103", "INS-TBD-0104", "INS-TBD-0105", "INS-TBD-0108"])],
      activity: [{ at: "2026-10-09", by: "Test technician", text: "Run 1 saved with the oil BDV (characteristic 8) still open: the only BDV tester, CAL-0107, is Overdue (E-QM-05)" }] },
  ]
}

// ============================================================================ NCR, CAPA, SCAR
function ncrs(): QtNcr[] {
  const n = (id: QtNcr["id"], title: string, source: QtNcr["source"], severity: QtNcr["severity"], stage: QtNcr["stage"], openedOn: string, attributableTo: QtNcr["attributableTo"], description: string, o: Partial<QtNcr> = {}): QtNcr => ({
    id, title, source, severity, stage, openedOn, attributableTo, description, ...o,
  })
  return [
    n("NCR-TBD-0044", "NCR: flange seal leak, HV bushing (INV 15.4)", { type: "rma", id: "RMA-TBD-0012" }, "Critical", "Open", "2026-10-01", "Component Supplier", "Oil weep at the flange gasket of SN-TBD-BSH-0302 after 4 weeks in service. Return inspection IL-TBD-0304 confirms the gasket seated off-groove. Root cause suspected in vendor batch HP-26-0412.", { itemId: "RAW-TBD-BSH145", vendorId: "VEN-TBD-0104", batchId: "BAT-TBD-B0301", serial: "SN-TBD-BSH-0302", capaId: "CAPA-TBD-0015", scarId: "SCAR-TBD-0009" }),
    n("NCR-TBD-0046", "NCR: LV bushing terminal crack at receiving", { type: "inspectionLot", id: "IL-TBD-0358" }, "Major", "Closed", "2026-09-06", "Component Supplier", "3 of 8 sampled LV bushings with hairline cracks at the terminal thread root.", { itemId: "RAW-TBD-BSH015", vendorId: "VEN-TBD-0112", batchId: "BAT-TBD-L0905", scarId: "SCAR-TBD-0007" }),
    n("NCR-TBD-0047", "NCR: radiator weld porosity", { type: "inspectionLot", id: "IL-TBD-0356" }, "Major", "Dispositioned", "2026-09-19", "Component Supplier", "Visible porosity on header welds of 2 of 3 sampled radiator banks.", { itemId: "RAW-TBD-RAD", vendorId: "VEN-TBD-0108", batchId: "BAT-TBD-R0918", scarId: "SCAR-TBD-0010" }),
    n("NCR-TBD-0048", "NCR: HV winding turns count error", { type: "inspectionLot", id: "IL-TBD-0351" }, "Major", "Dispositioned", "2026-09-22", "Production", "Disc 14 one turn short; winding machine counter skipped on a crossover.", { itemId: "SEMI-TBD-HVC20", serial: "SN-TBD-HVC-0393A", capaId: "CAPA-TBD-0016" }),
    n("NCR-TBD-0049", "NCR: partial discharge above limit at final test", { type: "inspectionLot", id: "IL-TBD-0353" }, "Critical", "Open", "2026-10-02", "Production", "PD 410 pC at 1.5 pu against a 250 pC limit on SN-TBD-7M5-0391. Suspected loose lead clamp near the LV exit.", { itemId: "FIN-TBD-7500MTO", serial: "SN-TBD-7M5-0391" }),
    n("NCR-TBD-0037", "NCR: bushing sight glass fogging at receiving", { type: "grn", id: "GRN-TBD-0344" }, "Minor", "Dispositioned", "2026-09-01", "Component Supplier", "Sight glass fogging on 2 of 6 sampled HV bushings at receiving; vendor to replace the glasses on open orders.", { itemId: "RAW-TBD-BSH145", vendorId: "VEN-TBD-0104", scarId: "SCAR-TBD-0006" }),
    n("NCR-TBD-0040", "NCR: paint adhesion failure", { type: "grn", id: "GRN-TBD-0222" }, "Major", "Closed", "2026-05-12", "Component Supplier", "Cross-hatch adhesion 2B on topcoat batch from Coastal Coatings.", { vendorId: "VEN-TBD-0113", capaId: "CAPA-TBD-0011", scarId: "SCAR-TBD-0003" }),
    n("NCR-TBD-0041", "NCR: batch label misprint at receiving", { type: "grn", id: "GRN-TBD-0251" }, "Minor", "Closed", "2026-02-06", "Production", "Label printed with the vendor batch in the internal batch field; reprinted with reason.", { capaId: "CAPA-TBD-0010" }),
    n("NCR-TBD-0042", "NCR: main tank gasket compression set", { type: "rma", id: "RMA-TBD-0009" }, "Major", "Closed", "2026-06-20", "Component Supplier", "Gaskets from Saguaro batch SGS-0714 took a permanent set at 70% after 60 days.", { vendorId: "VEN-TBD-0111", batchId: "BAT-TBD-GS0714", capaId: "CAPA-TBD-0013", scarId: "SCAR-TBD-0005" }),
    n("NCR-TBD-0043", "NCR: tap changer contact kit torque marks missing", { type: "rma", id: "RMA-TBD-0013" }, "Minor", "Open", "2026-09-30", "Component Supplier", "Spare contact kits shipped without torque witness marks; field crew could not verify assembly.", { vendorId: "VEN-TBD-0103", batchId: "BAT-TBD-SK0301", capaId: "CAPA-TBD-0017" }),
    n("NCR-TBD-0045", "NCR: LV bushing terminal crack in the field", { type: "rma", id: "RMA-TBD-0011" }, "Critical", "Open", "2026-09-10", "Component Supplier", "Two pad-mount units report LV terminal cracks from batch TSB-0815.", { vendorId: "VEN-TBD-0112", batchId: "BAT-TBD-L0815", scarId: "SCAR-TBD-0008" }),
    n("NCR-TBD-0050", "NCR: CT nameplate data missing", { type: "inspectionLot", id: "IL-TBD-0365" }, "Minor", "Open", "2026-10-07", "Component Supplier", "Bushing CTs received without ratio and accuracy class on the nameplate; no active plan (IP-INC-0041 in Draft).", { vendorId: "VEN-TBD-0115", batchId: "BAT-TBD-CT6-0001" }),
  ]
}

function capas(): QtCapa[] {
  const a = (id: string, type: QtCapa["actions"][number]["type"], description: string, ownerId: UserId, dueOn: string, done: boolean, evidence?: string) => ({ id, type, description, ownerId, dueOn, done, evidence })
  const c = (o: Omit<QtCapa, "activity"> & { activity?: QtCapa["activity"] }): QtCapa => ({ activity: [{ at: o.openedOn, by: "Quality engineer", text: "CAPA opened" }], ...o })
  return [
    c({ id: "CAPA-TBD-0015", title: "CAPA: bushing flange seal escape", status: "Analysis", ncrIds: ["NCR-TBD-0044"], sources: [{ type: "ncr", id: "NCR-TBD-0044" }, { type: "rma", id: "RMA-TBD-0012" }, { type: "scar", id: "SCAR-TBD-0009" }], openedOn: "2026-10-02", ownerId: P.qe,
      problem: "HV bushing from vendor batch HP-26-0412 leaked oil at the flange gasket after 4 weeks in service on SN-TBD-20M-0301. Incoming plan IP-INC-0031 rev B has no seal leak test, so the escape was not detectable at receiving.",
      method: "8D", rootCause: "Under analysis with the vendor (SCAR-TBD-0009 D4). Working theory: gasket groove machining out of tolerance in one shift.",
      actions: [
        a("A1", "Containment", "Recall RCL-2026-001: hold all stock of BAT-TBD-B0301, notify Midland Plains", P.qm, "2026-10-05", true, "RCL-2026-001 mass hold log"),
        a("A2", "Corrective", "Add flange seal leak test to IP-INC-0031 (rev C)", P.qe, "2026-10-20", false),
        a("A3", "Preventive", "Extend the leak test to every OIP bushing plan", P.qe, "2026-11-15", false),
      ] }),
    c({ id: "CAPA-TBD-0016", title: "CAPA: HV winding turns counter skip", status: "Actions In Progress", ncrIds: ["NCR-TBD-0048"], sources: [{ type: "ncr", id: "NCR-TBD-0048" }], openedOn: "2026-09-23", ownerId: P.qe,
      problem: "Winding machine WM-2 counter skipped a turn on a disc crossover (NCR-TBD-0048).", method: "5-Why", rootCause: "Counter sensor bracket loosened; no daily verification step.",
      actions: [a("A1", "Containment", "Re-check turns on all discs wound on WM-2 since 2026-09-15", P.supervisor, "2026-09-25", true, "Recheck sheet RS-0925"), a("A2", "Corrective", "Replace bracket; add daily counter verification to WI-PR-210", P.supervisor, "2026-10-15", false)] }),
    c({ id: "CAPA-TBD-0014", title: "CAPA: oil sampling valve contamination", status: "Implemented", ncrIds: [], sources: [{ type: "batch", id: "BAT-TBD-OIL-0712" }], openedOn: "2026-08-18", ownerId: P.qe, implementedOn: "2026-09-20",
      problem: "Moisture readings high on two tanker receipts traced to the sampling valve, not the oil.", method: "Fishbone", rootCause: "Sampling valve not flushed before draw.",
      actions: [a("A1", "Corrective", "Flush procedure added to the oil sample instruction", P.qe, "2026-09-15", true, "IP-INC-0033 sample instruction"), a("A2", "Preventive", "Train receiving on the flush step", P.qe, "2026-09-20", true, "Training record TR-0920")],
      effectiveness: { method: "Compare moisture results on the next 5 tanker receipts", checkOn: "2026-10-20" } }),
    c({ id: "CAPA-TBD-0012", title: "CAPA: nameplate verification skipped at WC-600", status: "Effectiveness Check", ncrIds: [], sources: [{ type: "productionOrder", id: "WO-TBD-0365" }], openedOn: "2026-07-02", ownerId: P.qe, implementedOn: "2026-08-15",
      problem: "SP-13 nameplate verification bypassed on two units during a paint backlog.", method: "5-Why", rootCause: "Operation could complete without the SP-13 event.",
      actions: [a("A1", "Corrective", "SP-13 made mandatory before WC-600 confirmation", P.plantIt, "2026-08-10", true, "BC-ADMIN policy change log"), a("A2", "Preventive", "Daily completeness control lists units without SP-13", P.qit, "2026-08-15", true)],
      effectiveness: { method: "No unit leaves WC-600 without SP-13 for 30 days", checkOn: "2026-09-25" } }),
    c({ id: "CAPA-TBD-0011", title: "CAPA: paint adhesion from Coastal Coatings", status: "Closed", ncrIds: ["NCR-TBD-0040"], sources: [{ type: "ncr", id: "NCR-TBD-0040" }, { type: "scar", id: "SCAR-TBD-0003" }], openedOn: "2026-05-13", ownerId: P.qe, implementedOn: "2026-06-30",
      problem: "Repeat adhesion failures on topcoat.", method: "8D", rootCause: "Vendor resin batch out of spec; vendor disqualified.", actions: [a("A1", "Corrective", "Switch to alternate paint system; disqualify vendor", "USR-TBD-041", "2026-06-30", true, "Vendor master change")],
      effectiveness: { method: "Adhesion results on 20 units", checkOn: "2026-08-05", result: "Pass" }, activity: [{ at: "2026-08-06", by: "Quality Manager", text: "Closed after effectiveness Pass" }] }),
    c({ id: "CAPA-TBD-0013", title: "CAPA: tank gasket compression set", status: "Reopened", ncrIds: ["NCR-TBD-0042"], sources: [{ type: "ncr", id: "NCR-TBD-0042" }, { type: "scar", id: "SCAR-TBD-0005" }], openedOn: "2026-06-21", ownerId: P.qe, implementedOn: "2026-07-20",
      problem: "Main tank gaskets take a permanent set.", method: "8D", rootCause: "Compound hardness below spec.", actions: [a("A1", "Corrective", "Durometer check added at receiving", P.qe, "2026-07-20", true), a("A2", "Corrective", "Second source qualification", "USR-TBD-041", "2026-11-30", false)],
      effectiveness: { method: "Compression set test on 3 lots", checkOn: "2026-09-01", result: "Fail" }, activity: [{ at: "2026-09-02", by: "Quality Manager", text: "Effectiveness Fail; actions reopened" }] }),
    c({ id: "CAPA-TBD-0017", title: "CAPA: contact kit torque witness marks", status: "Open", ncrIds: ["NCR-TBD-0043"], sources: [{ type: "ncr", id: "NCR-TBD-0043" }], openedOn: "2026-10-01", ownerId: P.qe, problem: "Spare contact kits ship without torque witness marks.", actions: [] }),
    c({ id: "CAPA-TBD-0010", title: "CAPA: batch label field mapping", status: "Closed", ncrIds: ["NCR-TBD-0041"], sources: [{ type: "ncr", id: "NCR-TBD-0041" }], openedOn: "2026-02-07", ownerId: P.qe, implementedOn: "2026-02-20",
      problem: "Batch label template mapped the vendor batch into the internal batch field.", method: "5-Why", rootCause: "Template v2 field mapping error.", actions: [a("A1", "Corrective", "Batch label template v3 published", P.plantIt, "2026-02-20", true)],
      effectiveness: { method: "Reprint log shows no mapping reprints for 30 days", checkOn: "2026-03-25", result: "Pass" } }),
  ]
}

function scars(): QtScar[] {
  const s = (id: QtScar["id"], vendorId: QtScar["vendorId"], title: string, ncrIds: QtScar["ncrIds"], issuedOn: string, dueOn: string, open: boolean, sections: QtScar["sections"], o: Partial<QtScar> = {}): QtScar => ({
    id, vendorId, title, ncrIds, issuedOn, dueOn, open, sections, escalations: [], activity: [{ at: issuedOn, by: "Quality engineer", text: "SCAR issued; D1-D3 sent to the vendor" }], ...o,
  })
  const pe = (team: string, problem: string, containment: string) => ({ D1: team, D2: problem, D3: containment })
  return [
    s("SCAR-TBD-0009", "VEN-TBD-0104", "SCAR to Hanseong Porcelain & Polymer", ["NCR-TBD-0044"], "2026-10-02", "2026-10-16", true, pe("L. Engstrom (PE QE), N. Brooks (PE QM), vendor QA lead", "Flange gasket seated off-groove on HP-26-0412 serial HP-412-02; oil weep in service.", "Vendor to hold all bushings machined on the same shift; PE holds BAT-TBD-B0301 (RCL-2026-001).")),
    s("SCAR-TBD-0006", "VEN-TBD-0104", "Bushing sight glass fogging", ["NCR-TBD-0037"], "2026-09-02", "2026-09-30", true, pe("L. Engstrom, vendor QA", "Sight glass fogging on 2 bushings at receiving.", "Vendor to replace glasses on open orders."), { escalations: [{ on: "2026-10-01", text: "Overdue: reminder to vendor QA director" }] }),
    s("SCAR-TBD-0007", "VEN-TBD-0112", "LV bushing terminal crack at receiving", ["NCR-TBD-0046"], "2026-08-15", "2026-09-12", true, pe("L. Engstrom, Tri-State QA", "Cracks at terminal thread root.", "Vendor sorts stock."), { escalations: [{ on: "2026-09-13", text: "Overdue: escalated to Purchasing Manager" }] }),
    s("SCAR-TBD-0008", "VEN-TBD-0112", "LV bushing field cracks, batch TSB-0815", ["NCR-TBD-0045"], "2026-09-11", "2026-10-01", true, pe("L. Engstrom, Tri-State QA", "Field cracks on two pad-mount units.", "Quarantine BAT-TBD-L0815 (RCL-2026-003)."), { escalations: [{ on: "2026-10-02", text: "Second overdue SCAR: vendor quality set to Restricted (≥ 2 open overdue)" }] }),
    s("SCAR-TBD-0002", "VEN-TBD-0113", "Paint viscosity drift", [], "2026-04-01", "2026-04-29", true, pe("PE QE", "Viscosity out of range.", "Stop use.")),
    s("SCAR-TBD-0003", "VEN-TBD-0113", "Paint adhesion failure", ["NCR-TBD-0040"], "2026-05-13", "2026-06-10", true, pe("PE QE", "Adhesion 2B.", "Stop use.")),
    s("SCAR-TBD-0004", "VEN-TBD-0113", "Paint certificate missing", [], "2026-05-20", "2026-06-17", true, pe("PE QE", "No batch certificate.", "Hold receipts.")),
    s("SCAR-TBD-0005", "VEN-TBD-0111", "Gasket compression set", ["NCR-TBD-0042"], "2026-06-22", "2026-07-20", false, { ...pe("PE QE, Saguaro QA", "Compression set 70%.", "Quarantine BAT-TBD-GS0714."), D4: "Compound mixed below hardness spec on one press.", D5: "Durometer check per batch at the mixer.", D6: "Implemented 2026-07-15; 3 lots verified.", D7: "Mixer recipe locked.", D8: "Closed by PE QM." }, { respondedOn: "2026-07-16", closedOn: "2026-08-30", recovery: { amount: 4200, creditNote: "CN-SGS-0830" } }),
    s("SCAR-TBD-0010", "VEN-TBD-0108", "Radiator header weld porosity", ["NCR-TBD-0047"], "2026-09-22", "2026-10-20", true, { ...pe("PE QE, Heartland QA", "Porosity on header welds.", "Return batch BAT-TBD-R0918."), D4: "Shielding gas flow alarm disabled on line 2." }, { respondedOn: "2026-10-06" }),
  ]
}

// ============================================================================ deviations
function deviations(): QtDeviation[] {
  const d = (o: Omit<QtDeviation, "activity"> & { activity?: QtDeviation["activity"] }): QtDeviation => ({ activity: [{ at: o.requestedOn, by: "Quality engineer", text: "Requested" }], ...o })
  return [
    d({ id: "DEV-2026-0011", title: "CRGO lamination 0.243 mm on heat NS-H-78560", type: "Use-As-Is (waiver)", valueImpact: 12400, origin: "Inspection failure", scope: [{ type: "batch", id: "BAT-TBD-C2655" }, { type: "inspectionLot", id: "IL-TBD-0359" }], specReference: "IP-INC-0027 rev C char 2", characteristic: "Lamination thickness", specValue: "0.22 to 0.24 mm", acceptedValue: "≤ 0.245 mm; core loss within guarantee", validUntil: "2026-12-31", validQty: 9000, usedQty: 8100, affectedSerials: ["SN-TBD-CORE-0395", "SN-TBD-CORE-0398"], vendorId: "VEN-TBD-0101", requestedBy: P.qe, requestedOn: "2026-08-25", state: "Approved", approvals: [{ role: "Quality Manager", by: P.qm, on: "2026-08-27" }, { role: "Engineering Manager", by: P.engMgr, on: "2026-08-27" }, { role: "Controller", by: P.controller, on: "2026-08-28" }] }),
    d({ id: "DEV-2026-0012", title: "CTC enamel build 0.048 mm per side", type: "Use-As-Is (waiver)", valueImpact: 18200, origin: "Supplier deviation request", scope: [{ type: "batch", id: "BAT-TBD-CT1003" }], specReference: "IP-INC-0035 rev A char 2", characteristic: "Enamel thickness", specValue: "0.05 to 0.07 mm", acceptedValue: "≥ 0.045 mm", validQty: 3900, usedQty: 0, affectedSerials: [], vendorId: "VEN-TBD-0102", requestedBy: P.qe, requestedOn: "2026-10-08", state: "Requested", approvals: [] }),
    d({ id: "DEV-2026-0013", title: "Paint DFT 118 µm on SN-TBD-5M-0388", type: "Customer-Approved Concession", customerRequired: true, valueImpact: 2100, origin: "Inspection failure", scope: [{ type: "serial", id: "SN-TBD-5M-0388" }], specReference: "IP-PSI-0006 rev A char 4", characteristic: "Paint dry film thickness", specValue: "≥ 125 µm", acceptedValue: "≥ 115 µm with touch-up at site", validQty: 1, usedQty: 0, affectedSerials: ["SN-TBD-5M-0388"], requestedBy: P.qe, requestedOn: "2026-10-08", state: "Requested", approvals: [{ role: "Quality Manager", by: P.qm, on: "2026-10-09" }] }),
    d({ id: "DEV-2026-0009", title: "Radiator fin pitch 52 mm (temporary)", type: "Temporary Process Deviation", valueImpact: 3600, origin: "Supplier deviation request", scope: [{ type: "batch", id: "BAT-TBD-R2507" }], specReference: "Drawing RAD-520 rev C", characteristic: "Fin pitch", specValue: "50 ± 1 mm", acceptedValue: "52 ± 1 mm", validUntil: "2026-09-30", usedQty: 36, affectedSerials: [], vendorId: "VEN-TBD-0108", requestedBy: P.qe, requestedOn: "2026-07-01", state: "Expired", approvals: [{ role: "Quality Manager", by: P.qm, on: "2026-07-03" }, { role: "Engineering Manager", by: P.engMgr, on: "2026-07-03" }], activity: [{ at: "2026-10-01", by: "System", text: "Auto expiry: validity date passed; further use blocked" }] }),
    d({ id: "DEV-2026-0010", title: "Use tank plate A36 instead of A572", type: "Use-As-Is (waiver)", origin: "Supplier deviation request", scope: [{ type: "productionOrder", id: "WO-TBD-0398" }], specReference: "Drawing TANK-20 rev B", characteristic: "Plate material", specValue: "A572 Gr. 50", acceptedValue: "A36", usedQty: 0, affectedSerials: [], vendorId: "VEN-TBD-0106", requestedBy: P.qe, requestedOn: "2026-09-12", state: "Rejected", approvals: [], activity: [{ at: "2026-09-14", by: "Engineering Manager", text: "Rejected: yield strength margin insufficient for vacuum rating" }] }),
    d({ id: "DEV-2026-0008", title: "Kraft paper density 0.78 g/cm³", type: "Use-As-Is (waiver)", customerRequired: true, customerEvidence: "Midland Plains concession letter MPG-CL-0207.pdf (ref MPG-2026-0207)", valueImpact: 1200, origin: "Inspection failure", scope: [{ type: "batch", id: "BAT-TBD-K0602" }], specReference: "Material spec RAW-TBD-KRAFT", characteristic: "Apparent density", specValue: "0.80 ± 0.02 g/cm³", acceptedValue: "≥ 0.76 g/cm³", validQty: 900, usedQty: 900, affectedSerials: ["SN-TBD-HVC-0301A", "SN-TBD-HVC-0301B", "SN-TBD-HVC-0301C"], vendorId: "VEN-TBD-0107", requestedBy: P.qe, requestedOn: "2026-02-06", state: "Approved", approvals: [{ role: "Quality Manager", by: P.qm, on: "2026-02-07" }, { role: "Engineering Manager", by: P.engMgr, on: "2026-02-07" }], activity: [{ at: "2026-05-07", by: "System", text: "Valid quantity fully used; further use blocked" }] }),
  ]
}

// ============================================================================ recalls (FL-08)
function recalls(): QtRecall[] {
  const hero: PopulationRow[] = [
    { serial: "SN-TBD-BSH-0301", itemId: "RAW-TBD-BSH145", batchId: "BAT-TBD-B0301", where: "In field", parentSerial: "SN-TBD-20M-0301", customerId: "CUS-TBD-0048", site: "Omaha North 115 kV substation", held: false, addedInVersion: 1 },
    { serial: "SN-TBD-BSH-0302", itemId: "RAW-TBD-BSH145", batchId: "BAT-TBD-B0301", where: "Returned", customerId: "CUS-TBD-0048", site: "Omaha North 115 kV substation", held: true, rmaId: "RMA-TBD-0012", addedInVersion: 1 },
    { serial: "SN-TBD-BSH-0303", itemId: "RAW-TBD-BSH145", batchId: "BAT-TBD-B0301", where: "In field", parentSerial: "SN-TBD-20M-0301", customerId: "CUS-TBD-0048", site: "Omaha North 115 kV substation", held: false, addedInVersion: 1 },
    ...[4, 5, 6, 7, 8, 9].map((n): PopulationRow => ({ serial: `SN-TBD-BSH-030${n}`, itemId: "RAW-TBD-BSH145", batchId: "BAT-TBD-B0301", where: "In stock", warehouseId: "WH-TBD-01", held: true, addedInVersion: 2 })),
  ]
  const pad = (n: string, c: PopulationRow["customerId"], site: string, o: Partial<PopulationRow> = {}): PopulationRow => ({ serial: `SN-TBD-2500-${n}`, itemId: "FIN-TBD-2500PM", batchId: "BAT-TBD-L0815", where: "In field", customerId: c, site, held: false, addedInVersion: 1, ...o })
  const R = (o: Omit<QtRecall, "createdBy" | "createdOn" | "activity" | "rmaIds" | "notificationApprovals"> & Partial<QtRecall> & { opened: string }): QtRecall => {
    const { opened, ...rest } = o
    return { createdBy: o.ownerId, createdOn: opened, activity: [{ at: opened, by: "Quality Manager", text: `Campaign opened (${o.trigger})` }], rmaIds: [], notificationApprovals: [], ...rest }
  }
  return [
    R({ id: "RCL-2026-001", title: "Recall: HV bushing flange seal, batch BAT-TBD-B0301", stage: "Contain", opened: "2026-10-02", ownerId: P.qm, trigger: "NCR", reason: "Flange seal leak (NCR-TBD-0044); vendor batch HP-26-0412", capaId: "CAPA-TBD-0015",
      suspect: { batches: ["BAT-TBD-B0301"], serials: [] }, populationVersion: 2, population: hero, rmaIds: ["RMA-TBD-0012"], costToDate: 31850,
      versions: [{ v: 1, on: "2026-10-02", by: P.qm, count: 3, diff: "Initial: 3 serials in the field on SN-TBD-20M-0301 (forward trace from NCR-TBD-0044)" }, { v: 2, on: "2026-10-06", by: P.qm, count: 9, diff: "+6 serials in stock (WH-TBD-01), reserved for SO-2026-00377; scope widened to the whole batch" }],
      notification: { text: "Midland Plains Grid Constructors: two 145 kV bushings on unit SN-TBD-20M-0301 at Omaha North belong to a batch under investigation for flange seal leaks. PE will inspect and, if needed, replace them at no cost. No action is needed from site staff beyond the weekly sight-glass check." },
      activity: [{ at: "2026-10-02", by: "Quality Manager", text: "Campaign opened from NCR-TBD-0044 (Identify)" }, { at: "2026-10-03", by: "System", text: "Mass hold: 6 EA Blocked in 4 s; stage Contain" }, { at: "2026-10-06", by: "Quality Manager", text: "Population v2 derived (+6)" }, { at: "2026-10-08", by: "Quality Manager", text: "Customer notification text sent for dual approval (APR-TBD-0103)" }] }),
    R({ id: "RCL-2026-002", title: "Recall: OLTC contact kit torque marks, batch BAT-TBD-SK0301", stage: "Identify", opened: "2026-10-07", ownerId: P.qm, trigger: "Field failure", reason: "NCR-TBD-0043: contact kits without torque witness marks", capaId: "CAPA-TBD-0017",
      suspect: { batches: ["BAT-TBD-SK0301"], serials: [] }, populationVersion: 0, population: [], versions: [], costToDate: 0 }),
    R({ id: "RCL-2026-003", title: "Recall: LV bushing terminal crack, batch BAT-TBD-L0815", stage: "Notify", opened: "2026-09-12", ownerId: P.qm, trigger: "Field failure", reason: "NCR-TBD-0045: terminal cracks on pad-mount units",
      suspect: { batches: ["BAT-TBD-L0815"], serials: [] }, populationVersion: 1, costToDate: 12400,
      population: [pad("1141", "CUS-TBD-0031", "Minot substation yard", { notifiedOn: "2026-09-20" }), pad("1142", "CUS-TBD-0031", "Minot substation yard", { notifiedOn: "2026-09-20" }), pad("1146", "CUS-TBD-0027", "Manitowoc north substation", { notifiedOn: "2026-09-20" }), pad("1147", "CUS-TBD-0027", "Manitowoc north substation", { notifiedOn: "2026-09-20" }), pad("1150", "CUS-TBD-0041", "Butte mill switchyard"), pad("1153", "CUS-TBD-0017", "Duluth job site 2291"), pad("1155", undefined, "", { where: "In stock", warehouseId: "WH-TBD-01", held: true, site: undefined }), pad("1156", undefined, "", { where: "In transit", held: false, site: undefined })],
      versions: [{ v: 1, on: "2026-09-14", by: P.qm, count: 8, diff: "Initial: 6 in the field, 1 in stock, 1 in transit" }],
      notificationApprovals: [{ role: "Quality Manager", on: "2026-09-18" }, { role: "Executive", on: "2026-09-19" }], notification: { text: "Your pad-mount transformer contains a 15 kV LV bushing from a batch with possible terminal cracks. PE will inspect and replace the bushing.", exportedOn: "2026-09-20" } }),
    R({ id: "RCL-2026-004", title: "Recall: main tank gasket kits, batch BAT-TBD-GS0714", stage: "Recover", opened: "2026-07-01", ownerId: P.qm, trigger: "Supplier notice", reason: "Saguaro notice: compound below hardness spec (NCR-TBD-0042)",
      suspect: { batches: ["BAT-TBD-GS0714"], serials: [] }, populationVersion: 1, costToDate: 8600, rmaIds: ["RMA-TBD-0016", "RMA-TBD-0017"],
      population: [
        { serial: "SN-TBD-GK-0714-01", itemId: "SPARE-TBD-GSKT20", batchId: "BAT-TBD-GS0714", where: "In field", customerId: "CUS-TBD-0035", site: "Delta laydown", held: false, notifiedOn: "2026-07-10", rmaId: "RMA-TBD-0016", disposition: "Recovered", addedInVersion: 1 },
        { serial: "SN-TBD-GK-0714-02", itemId: "SPARE-TBD-GSKT20", batchId: "BAT-TBD-GS0714", where: "In field", customerId: "CUS-TBD-0044", site: "Alma poste", held: false, notifiedOn: "2026-07-10", rmaId: "RMA-TBD-0017", addedInVersion: 1 },
        { serial: "SN-TBD-GK-0714-03", itemId: "SPARE-TBD-GSKT20", batchId: "BAT-TBD-GS0714", where: "In field", customerId: "CUS-TBD-0052", site: "Prince Albert yard", held: false, notifiedOn: "2026-07-10", addedInVersion: 1 },
        { serial: "SN-TBD-GK-0714-04", itemId: "SPARE-TBD-GSKT20", batchId: "BAT-TBD-GS0714", where: "In stock", warehouseId: "WH-TBD-03", held: true, disposition: "Recovered", addedInVersion: 1 },
      ],
      versions: [{ v: 1, on: "2026-07-02", by: P.qm, count: 4, diff: "Initial: 3 kits shipped, 1 in spares stock" }], notificationApprovals: [{ role: "Quality Manager", on: "2026-07-08" }, { role: "Executive", on: "2026-07-09" }] }),
    R({ id: "RCL-2025-006", title: "Recall: conservator relay wiring, units SN-TBD-5M-02xx", stage: "Disposition", opened: "2025-11-04", ownerId: P.qm, trigger: "Field failure", reason: "Buchholz relay wired to alarm instead of trip",
      suspect: { batches: [], serials: ["SN-TBD-5M-0211", "SN-TBD-5M-0214"] }, populationVersion: 1, costToDate: 22900, rmaIds: ["RMA-TBD-0004"],
      population: [
        { serial: "SN-TBD-5M-0211", itemId: "FIN-TBD-5000SS", batchId: "BAT-TBD-R2507", where: "In field", customerId: "CUS-TBD-0027", site: "Manitowoc north substation", held: false, notifiedOn: "2025-11-12", disposition: "Field-corrected", addedInVersion: 1 },
        { serial: "SN-TBD-5M-0214", itemId: "FIN-TBD-5000SS", batchId: "BAT-TBD-R2507", where: "Returned", customerId: "CUS-TBD-0041", site: "Butte mill switchyard", held: true, notifiedOn: "2025-11-12", rmaId: "RMA-TBD-0004", addedInVersion: 1 },
      ],
      versions: [{ v: 1, on: "2025-11-05", by: P.qm, count: 2, diff: "Initial: 2 units" }], notificationApprovals: [{ role: "Quality Manager", on: "2025-11-10" }, { role: "Executive", on: "2025-11-11" }] }),
    R({ id: "RCL-2025-007", title: "Recall: OLTC motor drive firmware, three units", stage: "Effectiveness", opened: "2025-09-15", ownerId: P.qm, trigger: "Supplier notice", reason: "Rheinwerk service bulletin RW-SB-25-07",
      suspect: { batches: [], serials: ["SN-TBD-20M-0188", "SN-TBD-20M-0192", "SN-TBD-20M-0201"] }, populationVersion: 1, costToDate: 9400,
      population: ["0188", "0192", "0201"].map((n, i): PopulationRow => ({ serial: `SN-TBD-20M-${n}`, itemId: "FIN-TBD-20MVA", batchId: "BAT-TBD-SK0301", where: "In field", customerId: (["CUS-TBD-0031", "CUS-TBD-0044", "CUS-TBD-0035"] as const)[i], site: "Substation", held: false, notifiedOn: "2025-09-25", disposition: i === 2 ? "Documented exception" : "Field-corrected", addedInVersion: 1 })),
      versions: [{ v: 1, on: "2025-09-16", by: P.qm, count: 3, diff: "Initial: 3 units" }], notificationApprovals: [{ role: "Quality Manager", on: "2025-09-22" }, { role: "Executive", on: "2025-09-23" }],
      partialSignoff: [{ by: P.qm, on: "2026-01-12", role: "Quality Manager" }, { by: P.exec, on: "2026-01-13", role: "Executive" }] }),
    R({ id: "RCL-2025-004", title: "Recall: radiator weld porosity, batch BAT-TBD-R2507", stage: "Closed", opened: "2025-07-28", ownerId: P.qm, trigger: "NCR", reason: "Weld porosity found at PSI on two units",
      suspect: { batches: ["BAT-TBD-R2507"], serials: [] }, populationVersion: 2, costToDate: 41300,
      population: Array.from({ length: 12 }, (_, i): PopulationRow => ({ serial: `SN-TBD-RAD-25${String(i + 1).padStart(2, "0")}`, itemId: "RAW-TBD-RAD", batchId: "BAT-TBD-R2507", where: i < 7 ? "In field" : "In stock", held: true, disposition: i < 7 ? "Field-corrected" : "Recovered", addedInVersion: i < 9 ? 1 : 2 })),
      versions: [{ v: 1, on: "2025-07-29", by: P.qm, count: 9, diff: "Initial: 9 banks" }, { v: 2, on: "2025-08-01", by: P.qm, count: 12, diff: "+3 banks found in WIP" }],
      notificationApprovals: [{ role: "Quality Manager", on: "2025-07-30" }, { role: "Executive", on: "2025-07-30" }], effectiveness: { on: "2025-08-12", by: P.qm, accountedPct: 100, costReport: "Total cost $41,300: field labor $28,100, parts $9,800, freight $3,400" } }),
  ]
}

// ============================================================================ traceability controls and barcode admin
function traceExceptions(): TraceException[] {
  return [
    { id: "TEX-TBD-0101", kind: "Orphan event", object: "SN-TBD-CT6-0003", detail: "T04 putaway with no T02 receipt for this serial", ownerId: P.receiving, raisedOn: "2026-10-09" },
    { id: "TEX-TBD-0102", kind: "Missing event", object: "SN-TBD-5M-0372", detail: "T10 pack recorded, no T09 finished receipt", raisedOn: "2026-10-09" },
    { id: "TEX-TBD-0103", kind: "Missing event", object: "WO-TBD-0388", detail: "Backflush posting #28 for BAT-TBD-CT0907 with no T05 event", ownerId: P.supervisor, raisedOn: "2026-10-08" },
    { id: "TEX-TBD-0104", kind: "Delayed offline event", object: "SN-TBD-5M-0365", detail: "SP-15 pick captured on HH-07 offline, synced 5 h 20 min later (over the 4 h queue limit)", raisedOn: "2026-10-08" },
    { id: "TEX-TBD-0105", kind: "Delayed offline event", object: "SN-TBD-CT6-0003", detail: "SP-04 putaway synced 1 h 10 min late (within 4 h)", ownerId: P.qit, raisedOn: "2026-10-08", resolvedOn: "2026-10-08", resolution: "Within the offline limit; accepted" },
    { id: "TEX-TBD-0106", kind: "Unresolved correction", object: "SN-TBD-CORE-0398", detail: "Reversal of a wrong-batch T05 (BAT-TBD-C2611) has no replacement event", ownerId: P.supervisor, raisedOn: "2026-10-05" },
    { id: "TEX-TBD-0107", kind: "Missing event", object: "SN-TBD-5M-0365", detail: "Serial has two active locations (staging lane 4 and BIN-TBD-F-02-01)", raisedOn: "2026-10-09" },
    { id: "TEX-TBD-0108", kind: "Missing event", object: "BAT-TBD-K0602", detail: "Batch quantity balance: received 900 kg, issued 712 kg, on hand 188 kg; one 64 kg issue not linked to a serial", ownerId: P.qit, raisedOn: "2026-09-30", resolvedOn: "2026-10-01", resolution: "Issue linked to SN-TBD-HVC-0301C by replacement event" },
  ]
}
/** Daily control job figures (design values) for TRC-DASH. */
export const CONTROL_RUNS = [
  { day: "2026-10-03", postings: 1214, accepted: 1209 }, { day: "2026-10-04", postings: 402, accepted: 402 }, { day: "2026-10-05", postings: 388, accepted: 386 },
  { day: "2026-10-06", postings: 1302, accepted: 1296 }, { day: "2026-10-07", postings: 1276, accepted: 1271 }, { day: "2026-10-08", postings: 1331, accepted: 1325 }, { day: "2026-10-09", postings: 1284, accepted: 1279 },
]

function printers(): Printer[] {
  const p = (id: string, station: string, wc: Printer["workCenterId"], model: string, address: string, labelTypes: string[], registeredOn: string, active = true): Printer => ({ id, station, workCenterId: wc, model, address, labelTypes, registeredOn, active })
  return [
    p("PRN-TBD-01", "Receiving dock 1", undefined, "Zebra ZT411 203 dpi", "10.20.4.21", ["Batch label", "Serial label"], "2025-11-04"),
    p("PRN-TBD-02", "Receiving dock 2", undefined, "Zebra ZT411 203 dpi", "10.20.4.22", ["Batch label", "Serial label", "Bin label"], "2025-11-04"),
    p("PRN-TBD-03", "WC-400 Final Assembly", "WC-400", "Zebra ZT231", "10.20.6.40", ["Traveler op barcode"], "2025-12-01"),
    p("PRN-TBD-04", "WC-500 Test Lab", "WC-500", "Zebra ZD621", "10.20.6.50", ["CAL instrument label", "Serial label"], "2025-12-01"),
    p("PRN-TBD-05", "WC-600 Paint & Finishing", "WC-600", "Zebra ZT411", "10.20.6.60", ["Nameplate verification"], "2026-01-10"),
    p("PRN-TBD-06", "WC-700 Pack station 1", "WC-700", "Zebra ZT610 300 dpi", "10.20.6.71", ["HU / SSCC label (GS1-128)"], "2026-01-10"),
    p("PRN-TBD-07", "WC-700 Pack station 2", "WC-700", "Zebra ZT610 300 dpi", "10.20.6.72", ["HU / SSCC label (GS1-128)"], "2026-01-10"),
    p("PRN-TBD-08", "Quality lab", undefined, "Brady i5300", "10.20.7.10", ["CAL instrument label"], "2026-02-02"),
    p("PRN-TBD-09", "Spares warehouse WH-TBD-03", undefined, "Zebra ZT231", "10.20.8.12", ["Batch label", "Bin label", "RMA label"], "2026-03-15"),
    p("PRN-TBD-10", "Regina warehouse WH-TBD-02", undefined, "Zebra ZT231", "10.30.1.12", ["Batch label", "Bin label"], "2026-04-01", false),
  ]
}
function templates(): LabelTemplate[] {
  const t = (id: string, name: string, symbology: string, versions: LabelTemplate["versions"]): LabelTemplate => ({ id, name, symbology, versions })
  const v = (n: number, state: LabelTemplate["versions"][number]["state"], on: string, change: string) => ({ v: n, state, on, by: P.plantIt, change })
  return [
    t("LBL-TBD-BATCH", "Batch label", "Code128", [v(2, "Retired", "2025-11-04", "Initial"), v(3, "Published", "2026-02-20", "Field mapping fix (CAPA-TBD-0010)"), v(4, "Draft", "2026-10-07", "Adds vendor heat number line")]),
    t("LBL-TBD-SERIAL", "Serial label", "Code128", [v(1, "Published", "2025-11-04", "Initial")]),
    t("LBL-TBD-HU", "HU / SSCC label (GS1-128)", "GS1-128", [v(1, "Retired", "2026-01-10", "Initial"), v(2, "Published", "2026-03-02", "Adds gross weight AI (3301)")]),
    t("LBL-TBD-TRAV", "Traveler op barcode", "Code128", [v(1, "Published", "2025-12-01", "Initial")]),
    t("LBL-TBD-CAL", "CAL instrument label", "Code128", [v(1, "Published", "2025-12-01", "Initial: CAL-{SEQ:4}, due date")]),
    t("LBL-TBD-BIN", "Bin label", "Code128", [v(1, "Published", "2025-11-04", "Initial")]),
    t("LBL-TBD-RMA", "RMA label", "Code128", [v(1, "Published", "2026-03-15", "Initial")]),
    t("LBL-TBD-NAME", "Nameplate verification", "Code128", [v(1, "Published", "2026-01-10", "Initial (SP-13)")]),
  ]
}
function policies(): ScanPolicy[] {
  return (Object.keys(SCAN_POINTS) as ScanPointCode[]).map((sp) => ({ sp, enabled: true, offlineAllowed: !["SP-14", "SP-18", "SP-07"].includes(sp), overrideNeedsReason: ["SP-08", "SP-12", "SP-15"].includes(sp) }))
}
function reprints(): Reprint[] {
  const r = (n: number, labelId: string, template: string, printerId: string, by: UserId, on: string, reason: string): Reprint => ({ id: `RPR-TBD-0${n}`, labelId, template, printerId, by, on, reason })
  return [
    r(301, "BAT-TBD-K0602", "Batch label v2", "PRN-TBD-01", P.receiving, "2026-02-06T10:20", "Field mapping error (NCR-TBD-0041)"),
    r(302, "HU-TBD-0031-3", "HU / SSCC label v2", "PRN-TBD-06", P.packer, "2026-08-07T15:55", "Label torn during crating"),
    r(303, "CAL-0105", "CAL instrument label v1", "PRN-TBD-08", P.qe, "2025-10-14T09:10", "New due date after calibration"),
    r(304, "BAT-TBD-C2690", "Batch label v3", "PRN-TBD-02", P.receiving, "2026-10-06T08:40", "Smudged print head"),
    r(305, "SN-TBD-BSH-0304", "Serial label v1", "PRN-TBD-01", P.whop, "2026-10-03T09:00", "Relabel with recall hold tag"),
    r(306, "HU-TBD-0052-1", "HU / SSCC label v2", "PRN-TBD-07", P.packer, "2026-10-08T14:30", "Weight re-entered after scale recalibration"),
  ]
}
function scanExceptions(): ScanException[] {
  return [
    { id: "SCX-TBD-0201", sp: "SP-15", device: "HH-07", capturedAt: "2026-10-08T02:10", syncedAt: "2026-10-08T07:30", code: "SN-TBD-5M-0365", conflict: "Offline more than 4 h; serial moved by another device meanwhile" },
    { id: "SCX-TBD-0202", sp: "SP-04", device: "HH-03", capturedAt: "2026-10-08T09:40", syncedAt: "2026-10-08T10:50", code: "SN-TBD-CT6-0003", conflict: "Serial unknown at sync (no receipt event)" },
    { id: "SCX-TBD-0203", sp: "SP-21", device: "HH-05", capturedAt: "2026-10-07T16:05", syncedAt: "2026-10-07T17:15", code: "BAT-TBD-L0905", conflict: "Scrap bin confirmation while disposition approval was still open" },
    { id: "SCX-TBD-0204", sp: "SP-06", device: "HH-02", capturedAt: "2026-10-06T11:00", syncedAt: "2026-10-06T11:20", code: "BAT-TBD-K0921", conflict: "Transfer line already closed by Regina receipt", resolvedOn: "2026-10-06", resolution: "Duplicate discarded; original kept" },
    { id: "SCX-TBD-0205", sp: "SP-16", device: "PACK-1", capturedAt: "2026-10-05T13:30", syncedAt: "2026-10-05T13:31", code: "SN-TBD-2500-1156", conflict: "Serial not picked for this pack order", resolvedOn: "2026-10-05", resolution: "Rejected scan; operator re-picked" },
  ]
}

// ============================================================================ dashboard series (design values)
export const FPY_TREND = [
  { month: "May", IQC: 96.8, IPQC: 97.9, FQC: 93.8 }, { month: "Jun", IQC: 95.1, IPQC: 98.4, FQC: 94.1 }, { month: "Jul", IQC: 97.4, IPQC: 97.2, FQC: 92.9 },
  { month: "Aug", IQC: 96.2, IPQC: 98.0, FQC: 95.0 }, { month: "Sep", IQC: 93.9, IPQC: 96.6, FQC: 93.3 }, { month: "Oct", IQC: 94.4, IPQC: 97.1, FQC: 90.0 },
]
export const FPY_BY_WC = [
  { wc: "WC-050", fpy: 98.1 }, { wc: "WC-110", fpy: 99.2 }, { wc: "WC-210", fpy: 95.4 }, { wc: "WC-310", fpy: 98.8 }, { wc: "WC-400", fpy: 97.6 }, { wc: "WC-500", fpy: 92.3 },
]
export const COQ = [
  { month: "May", scrap: 18400, rework: 22100, warranty: 9200 }, { month: "Jun", scrap: 15200, rework: 31800, warranty: 7600 }, { month: "Jul", scrap: 21900, rework: 19400, warranty: 12100 },
  { month: "Aug", scrap: 12800, rework: 26600, warranty: 8800 }, { month: "Sep", scrap: 24300, rework: 34100, warranty: 15400 }, { month: "Oct", scrap: 6100, rework: 11200, warranty: 31850 },
]
/** Rolling 90-day lot acceptance by vendor (design values). */
export const VENDOR_LOTS: { vendorId: string; lots: number; accepted: number; streak: number }[] = [
  { vendorId: "VEN-TBD-0101", lots: 14, accepted: 14, streak: 14 }, { vendorId: "VEN-TBD-0102", lots: 11, accepted: 11, streak: 11 }, { vendorId: "VEN-TBD-0103", lots: 4, accepted: 4, streak: 4 },
  { vendorId: "VEN-TBD-0104", lots: 6, accepted: 5, streak: 2 }, { vendorId: "VEN-TBD-0105", lots: 9, accepted: 9, streak: 9 }, { vendorId: "VEN-TBD-0107", lots: 8, accepted: 8, streak: 8 },
  { vendorId: "VEN-TBD-0108", lots: 7, accepted: 6, streak: 0 }, { vendorId: "VEN-TBD-0111", lots: 5, accepted: 4, streak: 1 }, { vendorId: "VEN-TBD-0112", lots: 9, accepted: 6, streak: 0 },
]

// ============================================================================ root seed
export interface Seed {
  plans: QtPlan[]
  lots: InspectionLot[]
  finalTests: FinalTest[]
  ncrs: QtNcr[]
  capas: QtCapa[]
  scars: QtScar[]
  instruments: QtInstrument[]
  deviations: QtDeviation[]
  recalls: QtRecall[]
  genealogy: QtEvent[]
  batches: QtBatch[]
  serials: QtSerial[]
  traceExceptions: TraceException[]
  dossiers: Dossier[]
  printers: Printer[]
  labelTemplates: LabelTemplate[]
  scanPolicies: ScanPolicy[]
  reprints: Reprint[]
  scanExceptions: ScanException[]
  /** Rolling 90-day lot acceptance by vendor (design summary) updated by every IQC decision. */
  vendorLots: VendorLots[]
  /** No-plan policy Auto-Accept with Warning events (non-QI-required items only). */
  warnings: AutoAcceptWarning[]
}
export function buildSeed(): Seed {
  return {
    plans: plans(), lots: lots(), finalTests: finalTests(), ncrs: ncrs(), capas: capas(), scars: scars(), instruments: instruments(), deviations: deviations(),
    recalls: recalls(), genealogy: genealogy(), batches: batches(), serials: serials(), traceExceptions: traceExceptions(),
    dossiers: [{ id: "DOS-TBD-0031", root: "SN-TBD-20M-0301", direction: "backward", createdOn: "2026-08-10", by: P.qm, events: 52, nodes: 24 }],
    printers: printers(), labelTemplates: templates(), scanPolicies: policies(), reprints: reprints(), scanExceptions: scanExceptions(),
    vendorLots: VENDOR_LOTS.map((v) => ({ ...v })),
    warnings: [
      { id: "WRN-TBD-0001", on: "2026-10-05", gate: "IQC", itemId: "CONS-TBD-PAINT", vendorId: "VEN-TBD-0113", subject: { type: "grn", id: "GRN-TBD-0369" }, text: "No active INC plan for CONS-TBD-PAINT (the vendor plan is Obsolete); the item is not QI-required, so the receipt passed to Unrestricted under Auto-Accept with Warning." },
      { id: "WRN-TBD-0002", on: "2026-09-29", gate: "IQC", itemId: "CONS-TBD-PAINT", vendorId: "VEN-TBD-0113", subject: { type: "grn", id: "GRN-TBD-0366" }, text: "Second paint receipt with no active plan passed under Auto-Accept with Warning." },
    ],
  }
}
