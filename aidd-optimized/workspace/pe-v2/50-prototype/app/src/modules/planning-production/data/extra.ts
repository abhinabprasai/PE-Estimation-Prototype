// planning-production: records added for the feature-list rows (12 October 2026). STO-001 transport
// orders, scheduling constraint masters, capture templates, labor export batches, subcontract
// operations, promise reliability history, schedule scenarios, decision requests.
// Everything here is fictitious. Values the PRD does not give carry a "design" note in the screens.

import type { Activity, ISODate, MaterialId, UserId, WorkCenterId } from "@/data/domain"

const D = (s: string) => s as ISODate
const act = (at: string, by: string, text: string): Activity => ({ at: D(at), by, text })

// ============================================================================ STO-001 (Book IX §4.3, Book III F §5)
/** STO status path [DOC:p.283 STO-001]: Created, Released, Issued, In Transit, Received, Closed.
 *  No status list exists in the catalog S-1..S-43 for it, so screens show the words as text (OQ-21 pattern). */
export type StoStatus = "Created" | "Released" | "Issued" | "In Transit" | "Received" | "Closed"
export const STO_PATH: StoStatus[] = ["Created", "Released", "Issued", "In Transit", "Received", "Closed"]

export interface TransferLane {
  id: string // LN-TBD-nn
  from: string
  to: string
  transitDays: number
  mode: "Truck" | "Rail" | "Truck LTL"
  calendar: string
  costPerKg: number
  active: boolean
  direction: "from to only" | "both ways"
}
/** Plants named on lanes. PL-TBD-01 is the shared master; the others are design plants for the
 *  network case (DEC-07 activation): the shared masters hold one plant. */
export const NETWORK_PLANTS: { id: string; name: string; hasProductionVersion: boolean }[] = [
  { id: "PL-TBD-01", name: "Fargo, ND (PE Transformer plant)", hasProductionVersion: true },
  { id: "PL-TBD-02", name: "Regina, SK (design plant)", hasProductionVersion: true },
  { id: "PL-TBD-03", name: "Duluth, MN (design plant)", hasProductionVersion: false },
]

export interface StoLine {
  no: number
  materialId: MaterialId
  qty: number
  issuedQty: number
  receivedQty: number
  /** Batch or serial selected at issue (SP-06 both ends). */
  lots: string[]
  uom: string
}
export interface TransportOrder {
  id: string // STO-TBD-nnnn
  laneId: string
  fromPlant: string
  toPlant: string
  priority: "Normal" | "High" | "Critical"
  createdOn: ISODate
  requiredBy: ISODate
  status: StoStatus
  source: "Network MRP proposal" | "Manual planner action"
  lines: StoLine[]
  issuedOn?: ISODate
  receivedOn?: ISODate
  closedOn?: ISODate
  shortCloseReason?: string
  /** In-transit value in bucket 1350 while Issued or In Transit (valuation, USD). */
  transitValue: number
  activity: Activity[]
}

// ============================================================================ FX-PLN-CONSTRAINTS
export interface ToolRec {
  id: string // TL-TBD-nnnn
  name: string
  wcIds: WorkCenterId[]
  qty: number
  status: "Available" | "In use" | "Calibration due" | "Out of service"
  location: string
  /** Operations that need this tool, by routing text keyword (design). */
  usedFor: string
}
export interface SetupFamily {
  id: string // SF-TBD-nn
  name: string
  wcId: WorkCenterId
  /** Items that belong to the family (no changeover inside a family). */
  items: MaterialId[]
  /** Hours added when the previous order on the work center is of another family. */
  changeoverHours: number
}
export interface CrewRoster {
  id: string // CRW-TBD-nn
  name: string
  shift: "Day (06:00-14:30)" | "Evening (14:30-23:00)"
  wcId: WorkCenterId
  leadId: UserId
  members: UserId[]
  /** Heads available per shift; the finite engine uses the operation crew size. */
  heads: number
  active: boolean
}
export interface MaintWindow {
  id: string // MNT-TBD-nnnn
  wcId: WorkCenterId
  from: ISODate
  to: ISODate
  kind: "Planned" | "Calibration" | "Breakdown"
  note: string
  status: "Scheduled" | "In progress" | "Done" | "Cancelled"
  /** Capacity removed: the whole work center for the window (design: partial-day windows are not modeled). */
}

// ============================================================================ FX-PRD-CAPTURE
export type CaptureKind = "number" | "text" | "pass-fail" | "choice" | "scan" | "attachment"
export interface CaptureField {
  id: string
  label: string
  kind: CaptureKind
  unit?: string
  min?: number
  max?: number
  required: boolean
  options?: string[]
  /** An out-of-range number blocks (hard) or only warns (soft). */
  limit?: "hard" | "soft"
}
export interface CaptureTemplate {
  id: string // CAP-TBD-nnnn
  name: string
  version: number
  status: "Draft" | "Published" | "Superseded"
  fields: CaptureField[]
  /** Work centers the template applies to (routing operations pick it by work center + name). */
  wcIds: WorkCenterId[]
  effectiveFrom?: ISODate
  activity: Activity[]
}

// ============================================================================ FX-PRD-LABOR (IF-22)
export interface LaborApproval {
  cnfId: string
  by: string
  on: ISODate
}
export interface LaborBatch {
  id: string // LBX-TBD-nnnn
  period: string
  createdOn: ISODate
  by: string
  /** IF-22 is reserved for Phase 2 [DOC:p.215 §7.2]: the batch is a file for review, never transmitted here. */
  status: "File generated" | "Superseded"
  cnfIds: string[]
  hours: number
  rows: number
  checksum: string
  supersedes?: string
}

// ============================================================================ FX-PRD-RECEIPT: subcontract operations
export type SubStatus = "To send" | "At vendor" | "Partly received" | "Received"
export interface SubcontractOp {
  id: string // SUBC-TBD-nnnn
  woId: string
  op: number
  vendorId: `VEN-${string}`
  poRef: string
  service: string
  qty: number
  sentQty: number
  receivedQty: number
  status: SubStatus
  providedMaterial: { materialId: MaterialId; qty: number; value: number }[]
  /** PO price for the service per unit (USD). */
  unitPrice: number
  expectedBack: ISODate
  sentOn?: ISODate
  receivedOn?: ISODate
  activity: Activity[]
}

// ============================================================================ FX-PLN-RELIABILITY
export interface ReliabilityRow {
  id: string
  soId: string
  line: number
  customerId: string
  itemId: MaterialId
  promised: ISODate
  /** Date the promised quantity left the dock. */
  actual: ISODate
  /** Snapshot the promise referenced when it was made. */
  snapshotId: string
  cause?: "Supply slip" | "ECO" | "Work center outage" | "Rework" | "Customer change" | "Test failure"
}

// ============================================================================ FX-PLN-SCENARIOS
export interface Scenario {
  id: string // SCN-TBD-nn
  name: string
  note: string
  createdBy: string
  createdOn: ISODate
  /** Earliest-start moves by `${woId}/${op}`. */
  moves: { key: string; notBefore: ISODate }[]
  /** Extra hours per working day at a work center (overtime or an added shift). */
  extraHours: Record<string, number>
  /** Orders pulled to priority 1 in this scenario. */
  expedite: string[]
  /** Work centers treated as down for this scenario (what-if outage). */
  down: string[]
  baseline?: boolean
}

// ============================================================================ FX-PRD-WODIALOGS
export interface ReversalRequest {
  id: string // RVR-TBD-nnnn
  cnfId: string
  woId: string
  reason: string
  requestedBy: string
  requestedById: string
  requestedOn: ISODate
  status: "Awaiting second sign-off" | "Signed and posted" | "Rejected"
  signedBy?: string
  signedById?: string
  decisionNote?: string
  reversalId?: string
}

export interface ExtraState {
  lanes: TransferLane[]
  transportOrders: TransportOrder[]
  tools: ToolRec[]
  setupFamilies: SetupFamily[]
  crewRoster: CrewRoster[]
  maintWindows: MaintWindow[]
  captureTemplates: CaptureTemplate[]
  laborApprovals: LaborApproval[]
  laborBatches: LaborBatch[]
  subcontracts: SubcontractOp[]
  reliability: ReliabilityRow[]
  scenarios: Scenario[]
  reversalRequests: ReversalRequest[]
}

export function extraSeed(): ExtraState {
  const lanes: TransferLane[] = [
    { id: "LN-TBD-01", from: "PL-TBD-02", to: "PL-TBD-01", transitDays: 3, mode: "Truck", calendar: "Mon-Fri departures", costPerKg: 0.11, active: true, direction: "both ways" },
    { id: "LN-TBD-02", from: "PL-TBD-03", to: "PL-TBD-01", transitDays: 2, mode: "Truck LTL", calendar: "Tue and Thu departures", costPerKg: 0.14, active: false, direction: "from to only" },
    { id: "LN-TBD-03", from: "PL-TBD-01", to: "PL-TBD-02", transitDays: 3, mode: "Rail", calendar: "Weekly Wednesday", costPerKg: 0.07, active: true, direction: "from to only" },
  ]
  const line = (no: number, materialId: MaterialId, qty: number, issued: number, received: number, lots: string[], uom = "EA"): StoLine => ({ no, materialId, qty, issuedQty: issued, receivedQty: received, lots, uom })
  const sto = (o: Omit<TransportOrder, "activity" | "transitValue"> & { activity?: Activity[]; transitValue?: number }): TransportOrder => ({ transitValue: 0, activity: [], ...o })
  const transportOrders: TransportOrder[] = [
    sto({
      id: "STO-TBD-0101", laneId: "LN-TBD-01", fromPlant: "PL-TBD-02", toPlant: "PL-TBD-01", priority: "Normal", createdOn: D("2026-10-07"), requiredBy: D("2026-10-23"), status: "Created", source: "Network MRP proposal",
      lines: [line(10, "RAW-TBD-KRAFT", 600, 0, 0, [], "KG"), line(20, "CONS-TBD-PAINT", 120, 0, 0, [], "L")],
      activity: [act("2026-10-07", "System", "Proposed by network MRP run MRP-TBD-0041: Fargo short of kraft paper on 2026-10-23; Regina holds stock; lane LN-TBD-01 offsets 3 days")],
    }),
    sto({
      id: "STO-TBD-0102", laneId: "LN-TBD-01", fromPlant: "PL-TBD-02", toPlant: "PL-TBD-01", priority: "High", createdOn: D("2026-10-05"), requiredBy: D("2026-10-19"), status: "Released", source: "Manual planner action",
      lines: [line(10, "RAW-TBD-RAD", 16, 0, 0, [])],
      activity: [act("2026-10-05", "Planner", "Created from the planner workbench"), act("2026-10-06", "Planning Manager", "Released to the Regina warehouse for issue")],
    }),
    sto({
      id: "STO-TBD-0103", laneId: "LN-TBD-03", fromPlant: "PL-TBD-01", toPlant: "PL-TBD-02", priority: "Normal", createdOn: D("2026-10-01"), requiredBy: D("2026-10-16"), status: "Issued", source: "Network MRP proposal", issuedOn: D("2026-10-08"), transitValue: 18400,
      lines: [line(10, "RAW-TBD-FOIL", 800, 800, 0, ["BAT-TBD-F0212"], "KG")],
      activity: [act("2026-10-01", "System", "Proposed by network MRP"), act("2026-10-08", "Warehouse operator", "Issued at source with SP-06 scan of BAT-TBD-F0212: DR 1350 CR 13xx; in-transit value 18,400.00 in bucket 1350")],
    }),
    sto({
      id: "STO-TBD-0104", laneId: "LN-TBD-01", fromPlant: "PL-TBD-02", toPlant: "PL-TBD-01", priority: "Critical", createdOn: D("2026-09-28"), requiredBy: D("2026-10-12"), status: "In Transit", source: "Manual planner action", issuedOn: D("2026-10-06"), transitValue: 9650,
      lines: [line(10, "RAW-TBD-OLTC", 1, 1, 0, ["SN-TBD-OLT-0377"]), line(20, "RAW-TBD-BSH145", 3, 3, 0, ["BAT-TBD-B0301"])],
      activity: [act("2026-09-28", "Planner", "Created: phase 2 unit SO-2026-00377 needs the OLTC and bushings at Fargo"), act("2026-10-06", "Warehouse operator", "Issued at source (SP-06) and handed to carrier, due at destination 2026-10-09")],
    }),
    sto({
      id: "STO-TBD-0105", laneId: "LN-TBD-01", fromPlant: "PL-TBD-02", toPlant: "PL-TBD-01", priority: "Normal", createdOn: D("2026-09-22"), requiredBy: D("2026-10-05"), status: "Received", source: "Network MRP proposal", issuedOn: D("2026-09-29"), receivedOn: D("2026-10-02"),
      lines: [line(10, "RAW-TBD-CTC", 2400, 2400, 2400, ["BAT-TBD-C0188"], "KG")],
      activity: [act("2026-09-29", "Warehouse operator", "Issued (SP-06)"), act("2026-10-02", "Receiving clerk", "Received at destination (SP-06): DR 13xx CR 1350; full quantity")],
    }),
    sto({
      id: "STO-TBD-0106", laneId: "LN-TBD-01", fromPlant: "PL-TBD-02", toPlant: "PL-TBD-01", priority: "Normal", createdOn: D("2026-09-10"), requiredBy: D("2026-09-24"), status: "Closed", source: "Manual planner action", issuedOn: D("2026-09-15"), receivedOn: D("2026-09-18"), closedOn: D("2026-09-25"),
      shortCloseReason: "Carrier lost 40 kg; remainder closed short",
      lines: [line(10, "RAW-TBD-FOIL", 1000, 1000, 960, ["BAT-TBD-F0199"], "KG")],
      activity: [act("2026-09-18", "Receiving clerk", "Received 960 of 1000 KG"), act("2026-09-25", "Planning Manager", "Short closed: carrier lost 40 kg; remainder closed short")],
    }),
  ]

  const tools: ToolRec[] = [
    { id: "TL-TBD-0001", name: "HV coil winding mandrel 1.2 m", wcIds: ["WC-210"], qty: 2, status: "In use", location: "WC-210 cell A", usedFor: "Wind HV coils" },
    { id: "TL-TBD-0002", name: "LV foil winding arbor", wcIds: ["WC-200"], qty: 1, status: "Available", location: "WC-200 tool crib", usedFor: "Wind LV foil coils" },
    { id: "TL-TBD-0003", name: "Brazing fixture, three-phase", wcIds: ["WC-220"], qty: 1, status: "Calibration due", location: "WC-220", usedFor: "Assemble phases, size and braze" },
    { id: "TL-TBD-0004", name: "Core stacking table, step-lap", wcIds: ["WC-110"], qty: 1, status: "Available", location: "WC-110", usedFor: "Core stacking" },
    { id: "TL-TBD-0005", name: "Bushing lift fixture 145 kV", wcIds: ["WC-400"], qty: 1, status: "Available", location: "WC-400 bay 2", usedFor: "Install HV bushings" },
    { id: "TL-TBD-0006", name: "Torque wrench set, 40-400 N·m", wcIds: ["WC-400", "WC-310"], qty: 3, status: "Out of service", location: "Calibration lab", usedFor: "Bushing and cover bolting" },
  ]
  const setupFamilies: SetupFamily[] = [
    { id: "SF-TBD-01", name: "Pole-mount coils", wcId: "WC-210", items: ["FIN-TBD-2500PM", "FIN-TBD-1000PM", "FIN-TBD-0167PL"], changeoverHours: 1.5 },
    { id: "SF-TBD-02", name: "Pad-mount and substation coils", wcId: "WC-210", items: ["FIN-TBD-5000SS", "FIN-TBD-7500MTO", "FIN-TBD-20MVA"], changeoverHours: 3 },
    { id: "SF-TBD-03", name: "Drying cycle, small units", wcId: "WC-230", items: ["FIN-TBD-2500PM", "FIN-TBD-1000PM", "FIN-TBD-0167PL"], changeoverHours: 0.5 },
    { id: "SF-TBD-04", name: "Drying cycle, large units", wcId: "WC-230", items: ["FIN-TBD-5000SS", "FIN-TBD-7500MTO", "FIN-TBD-20MVA"], changeoverHours: 2 },
  ]
  const crewRoster: CrewRoster[] = [
    { id: "CRW-TBD-01", name: "Winding crew A", shift: "Day (06:00-14:30)", wcId: "WC-210", leadId: "USR-TBD-033", members: ["USR-TBD-033"], heads: 4, active: true },
    { id: "CRW-TBD-02", name: "Final assembly crew", shift: "Day (06:00-14:30)", wcId: "WC-400", leadId: "USR-TBD-031", members: ["USR-TBD-031", "USR-TBD-032"], heads: 5, active: true },
    { id: "CRW-TBD-03", name: "Test lab", shift: "Day (06:00-14:30)", wcId: "WC-500", leadId: "USR-TBD-035", members: ["USR-TBD-035"], heads: 3, active: true },
    { id: "CRW-TBD-04", name: "Winding crew B", shift: "Evening (14:30-23:00)", wcId: "WC-210", leadId: "USR-TBD-033", members: ["USR-TBD-033"], heads: 3, active: false },
  ]
  const maintWindows: MaintWindow[] = [
    { id: "MNT-TBD-0001", wcId: "WC-600", from: D("2026-10-05"), to: D("2026-10-21"), kind: "Planned", note: "Booth filter and extraction rebuild; the work center status is Maintenance until the window ends", status: "In progress" },
    { id: "MNT-TBD-0002", wcId: "WC-230", from: D("2026-11-02"), to: D("2026-11-03"), kind: "Planned", note: "Vapor-phase oven seal replacement and thermocouple check", status: "Scheduled" },
    { id: "MNT-TBD-0003", wcId: "WC-500", from: D("2026-10-27"), to: D("2026-10-27"), kind: "Calibration", note: "Annual calibration of the ratio and loss measurement set (calibration alerts at 30, 14 and 3 days)", status: "Scheduled" },
    { id: "MNT-TBD-0004", wcId: "WC-210", from: D("2026-09-14"), to: D("2026-09-14"), kind: "Breakdown", note: "Winding machine drive fault, repaired same day", status: "Done" },
  ]
  const f = (id: string, label: string, kind: CaptureKind, extra: Partial<CaptureField> = {}): CaptureField => ({ id, label, kind, required: false, ...extra })
  const captureTemplates: CaptureTemplate[] = [
    {
      id: "CAP-TBD-0001", name: "HV winding record", version: 2, status: "Published", wcIds: ["WC-210", "WC-200"], effectiveFrom: D("2026-08-01"),
      fields: [f("turns", "Turns count", "number", { required: true, min: 1, max: 9999, limit: "hard" }), f("res", "Measured resistance (mΩ)", "number", { required: true, unit: "mΩ", min: 380, max: 460, limit: "soft" }), f("radial", "Radial build (mm)", "number", { unit: "mm", min: 20, max: 80, limit: "soft" })],
      activity: [act("2026-07-20", "Manufacturing engineer", "Version 2 published: resistance limits tightened to 380-460 mΩ; version 1 superseded")],
    },
    {
      id: "CAP-TBD-0002", name: "Vapor-phase drying cycle", version: 1, status: "Published", wcIds: ["WC-230"], effectiveFrom: D("2026-06-01"),
      fields: [f("cycle", "Cycle #", "text", { required: true }), f("moist", "Final moisture (%)", "number", { required: true, unit: "%", min: 0, max: 0.5, limit: "hard" }), f("chart", "Cycle chart attached", "attachment")],
      activity: [act("2026-05-28", "Manufacturing engineer", "Published")],
    },
    {
      id: "CAP-TBD-0003", name: "Nameplate check (WC-600)", version: 1, status: "Draft", wcIds: ["WC-600"],
      fields: [f("np", "Nameplate serial", "scan", { required: true }), f("kva", "Rated kVA on plate", "number", { required: true, unit: "kVA", min: 1, max: 30000, limit: "hard" }), f("ok", "Plate matches order", "pass-fail", { required: true })],
      activity: [act("2026-10-06", "Manufacturing engineer", "Draft created for review; not yet applied to routings")],
    },
    {
      id: "CAP-TBD-0004", name: "HV winding record", version: 1, status: "Superseded", wcIds: ["WC-210", "WC-200"], effectiveFrom: D("2026-01-15"),
      fields: [f("turns", "Turns count", "number", { required: true }), f("res", "Measured resistance (mΩ)", "number", { required: true, unit: "mΩ" })],
      activity: [act("2026-01-12", "Manufacturing engineer", "Published"), act("2026-07-20", "Manufacturing engineer", "Superseded by version 2")],
    },
  ]
  const subcontracts: SubcontractOp[] = [
    {
      id: "SUBC-TBD-0001", woId: "WO-2026-00389", op: 110, vendorId: "VEN-TBD-0105", poRef: "PO-TBD-0412", service: "Hot-dip galvanize radiator panels", qty: 8, sentQty: 8, receivedQty: 0, status: "At vendor",
      providedMaterial: [{ materialId: "RAW-TBD-RAD", qty: 8, value: 3920 }], unitPrice: 260, expectedBack: D("2026-10-16"), sentOn: D("2026-10-06"),
      activity: [act("2026-10-06", "Warehouse operator", "Issued 8 radiator panels to the vendor: #34 DR 1315 Subcontract at Vendor, CR 1310")],
    },
    {
      id: "SUBC-TBD-0002", woId: "WO-2026-00411", op: 80, vendorId: "VEN-TBD-0105", poRef: "PO-TBD-0418", service: "Specialty machining of tank flanges", qty: 6, sentQty: 0, receivedQty: 0, status: "To send",
      providedMaterial: [{ materialId: "RAW-TBD-KRAFT", qty: 6, value: 1130 }], unitPrice: 190, expectedBack: D("2026-10-22"),
      activity: [act("2026-10-08", "Planner", "Subcontract operation created from the routing flag; waiting for material issue")],
    },
    {
      id: "SUBC-TBD-0003", woId: "WO-2026-00396", op: 70, vendorId: "VEN-TBD-0103", poRef: "PO-TBD-0398", service: "Core annealing", qty: 4, sentQty: 4, receivedQty: 2, status: "Partly received",
      providedMaterial: [{ materialId: "RAW-TBD-CTC", qty: 4, value: 2340 }], unitPrice: 340, expectedBack: D("2026-10-09"), sentOn: D("2026-09-29"),
      activity: [act("2026-09-29", "Warehouse operator", "Issued 4 to the vendor (#34)"), act("2026-10-08", "Receiving clerk", "Received 2 of 4 back: #35 DR 1320 WIP, CR 2110 GR/IR and 1315")],
    },
    {
      id: "SUBC-TBD-0004", woId: "WO-2026-00405", op: 60, vendorId: "VEN-TBD-0103", poRef: "PO-TBD-0371", service: "Core annealing", qty: 3, sentQty: 3, receivedQty: 3, status: "Received",
      providedMaterial: [{ materialId: "RAW-TBD-CTC", qty: 3, value: 1755 }], unitPrice: 340, expectedBack: D("2026-09-30"), sentOn: D("2026-09-22"), receivedOn: D("2026-09-29"),
      activity: [act("2026-09-29", "Receiving clerk", "Received 3 of 3: #35 posted")],
    },
  ]
  const R = (id: number, soId: string, line: number, customerId: string, itemId: MaterialId, promised: string, actual: string, cause?: ReliabilityRow["cause"]): ReliabilityRow => ({
    id: `REL-TBD-${String(id).padStart(3, "0")}`, soId, line, customerId, itemId, promised: D(promised), actual: D(actual), snapshotId: `SNP-TBD-${String(30 + (id % 9)).padStart(4, "0")}`, cause,
  })
  const reliability: ReliabilityRow[] = [
    R(1, "SO-2026-00211", 10, "CUS-TBD-0031", "FIN-TBD-2500PM", "2026-04-10", "2026-04-10"),
    R(2, "SO-2026-00214", 10, "CUS-TBD-0044", "FIN-TBD-5000SS", "2026-04-24", "2026-04-28", "Supply slip"),
    R(3, "SO-2026-00219", 10, "CUS-TBD-0017", "FIN-TBD-1000PM", "2026-05-08", "2026-05-07"),
    R(4, "SO-2026-00226", 10, "CUS-TBD-0031", "FIN-TBD-0167PL", "2026-05-15", "2026-05-15"),
    R(5, "SO-2026-00231", 10, "CUS-TBD-0009", "FIN-TBD-7500MTO", "2026-05-29", "2026-06-05", "Work center outage"),
    R(6, "SO-2026-00238", 10, "CUS-TBD-0044", "FIN-TBD-2500PM", "2026-06-05", "2026-06-05"),
    R(7, "SO-2026-00244", 10, "CUS-TBD-0023", "FIN-TBD-5000SS", "2026-06-19", "2026-06-19"),
    R(8, "SO-2026-00251", 10, "CUS-TBD-0017", "FIN-TBD-1000PM", "2026-06-26", "2026-07-01", "Test failure"),
    R(9, "SO-2026-00259", 10, "CUS-TBD-0031", "FIN-TBD-0167PL", "2026-07-03", "2026-07-02"),
    R(10, "SO-2026-00266", 10, "CUS-TBD-0009", "FIN-TBD-2500PM", "2026-07-17", "2026-07-17"),
    R(11, "SO-2026-00271", 10, "CUS-TBD-0038", "FIN-TBD-5000SS", "2026-07-24", "2026-08-03", "ECO"),
    R(12, "SO-2026-00279", 10, "CUS-TBD-0044", "FIN-TBD-1000PM", "2026-07-31", "2026-07-31"),
    R(13, "SO-2026-00284", 10, "CUS-TBD-0023", "FIN-TBD-7500MTO", "2026-08-07", "2026-08-07"),
    R(14, "SO-2026-00288", 10, "CUS-TBD-0017", "FIN-TBD-2500PM", "2026-08-14", "2026-08-19", "Supply slip"),
    R(15, "SO-2026-00293", 10, "CUS-TBD-0031", "FIN-TBD-0167PL", "2026-08-21", "2026-08-21"),
    R(16, "SO-2026-00301", 10, "CUS-TBD-0031", "FIN-TBD-20MVA", "2026-08-28", "2026-08-28"),
    R(17, "SO-2026-00303", 10, "CUS-TBD-0009", "FIN-TBD-5000SS", "2026-09-04", "2026-09-04"),
    R(18, "SO-2026-00311", 10, "CUS-TBD-0038", "FIN-TBD-1000PM", "2026-09-11", "2026-09-17", "Rework"),
    R(19, "SO-2026-00316", 10, "CUS-TBD-0044", "FIN-TBD-2500PM", "2026-09-18", "2026-09-18"),
    R(20, "SO-2026-00322", 10, "CUS-TBD-0023", "FIN-TBD-0167PL", "2026-09-25", "2026-09-24"),
    R(21, "SO-2026-00329", 10, "CUS-TBD-0017", "FIN-TBD-5000SS", "2026-10-02", "2026-10-02"),
    R(22, "SO-2026-00334", 10, "CUS-TBD-0031", "FIN-TBD-1000PM", "2026-10-06", "2026-10-08", "Customer change"),
  ]
  const scenarios: Scenario[] = [
    { id: "SCN-TBD-01", name: "Live plan", note: "The published plan with no changes: the reference for every comparison.", createdBy: "System", createdOn: D("2026-10-01"), moves: [], extraHours: {}, expedite: [], down: [], baseline: true },
    { id: "SCN-TBD-02", name: "Second winding shift", note: "Adds 8 hours a day at HV and LV winding to pull the phase 2 unit in.", createdBy: "Production Scheduler", createdOn: D("2026-10-08"), moves: [], extraHours: { "WC-210": 8, "WC-200": 8 }, expedite: [], down: [] },
    { id: "SCN-TBD-03", name: "Drying oven down 3 days", note: "What if the vapor-phase oven fails before the planned seal replacement.", createdBy: "Planner", createdOn: D("2026-10-08"), moves: [], extraHours: {}, expedite: [], down: ["WC-230"] },
  ]
  return { lanes, transportOrders, tools, setupFamilies, crewRoster, maintWindows, captureTemplates, laborApprovals: [], laborBatches: [], subcontracts, reliability, scenarios, reversalRequests: [] }
}
