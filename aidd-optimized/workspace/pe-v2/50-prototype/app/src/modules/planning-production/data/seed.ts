// planning-production seed: realistic volume for PE Transformer's Fargo plant (fictitious, GUARDRAILS 7).
// Spine documents seeded with their spine IDs and statuses: WO-TBD-0301 Closed (TECO),
// RWO-TBD-0012 Open, PLO-TBD-0377. New documents use the specification's formats where it gives one
// (WO-{YYYY}-{SEQ:5} [DOC:p.74 §5.1], RWO-{YYYY}-{SEQ:4} [DOC:p.79 §9]); others carry TBD (OQ-30).
// Every quantity, hour, rate and date is a design value.

import { MATERIALS, TODAY, WORK_CENTERS } from "@/data/shared"
import type { Activity, ISODate, MaterialId, ProductionOrderStatus, SerialNo, WorkCenterId } from "@/data/domain"
import { addWorkdays, applySchedule, deterministic, escalateLate, nextWorkday, opHours, round2, schedule, SHIP_PREP_DAYS } from "../lib/plan"
import { extraSeed } from "./extra"
import type {
  AtRiskRecord,
  CompBatch,
  CompSerial,
  CostStd,
  GenealogyRow,
  JournalEntry,
  LocalWorkCenter,
  MrpException,
  MrpRun,
  OpComponent,
  PPConfirmation,
  PPOperation,
  PPPlannedOrder,
  PPReworkOrder,
  PPRouting,
  PPWarehouseTask,
  PPWorkOrder,
  PlanningProductionState,
  PromiseCandidate,
  Qualification,
  SchedulePublish,
  Settlement,
  WcOverride,
} from "./types"

const A = (at: ISODate, by: string, text: string): Activity => ({ at, by, text })
const std = (id: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0

// ------------------------------------------------------------------ work-center capacity and rates (design values)
type WcRow = [WorkCenterId, shifts: number, hoursPerShift: number, labor: number, overhead: number, crew: number, alt?: WorkCenterId, cycle?: [number, number]]
const WC_ROWS: WcRow[] = [
  ["WC-050", 2, 8, 58, 64, 3, "WC-310"],
  ["WC-100", 2, 8, 61, 88, 2],
  ["WC-110", 2, 8, 61, 80, 3],
  ["WC-200", 2, 8, 63, 72, 2, "WC-210"],
  ["WC-210", 2, 8, 66, 78, 2],
  ["WC-220", 2, 8, 62, 70, 3],
  ["WC-230", 3, 8, 48, 140, 1, undefined, [3, 46]],
  ["WC-300", 2, 8, 64, 74, 3],
  ["WC-310", 2, 8, 60, 68, 3],
  ["WC-320", 3, 8, 52, 96, 1],
  ["WC-400", 2, 8, 65, 72, 3],
  ["WC-500", 2, 8, 78, 120, 2],
  ["WC-600", 2, 8, 54, 62, 2],
  ["WC-700", 2, 8, 50, 46, 3],
  ["WC-105", 1, 8, 61, 88, 2, "WC-100"],
]
export const OWN_WORK_CENTERS: LocalWorkCenter[] = [
  { id: "WC-105", name: "Core Cutting line 1 (retired shear)", function: "Legacy CRGO shear, replaced by the WC-100 step-lap line", costCenterId: "CC-1100", capacityHoursPerDay: 8, efficiencyPct: 70, status: "Inactive" },
]

function wcOverrides(): Record<string, WcOverride> {
  const out: Record<string, WcOverride> = {}
  for (const [id, shifts, hps, labor, overhead, crew, alt, cycle] of WC_ROWS) {
    const base = [...WORK_CENTERS, ...OWN_WORK_CENTERS].find((w) => w.id === id)!
    out[id] = {
      status: base.status,
      maintenanceUntil: id === "WC-600" ? "2026-10-21" : undefined,
      shifts,
      hoursPerShift: hps,
      stations: 1,
      utilizationTarget: 85,
      laborRate: labor,
      overheadRate: overhead,
      machineRate: id === "WC-100" || id === "WC-210" ? 34 : undefined,
      queueHours: id === "WC-230" || id === "WC-320" ? 8 : 4,
      moveHours: 2,
      crew,
      alternate: alt ? { wcId: alt, efficiencyPct: 80 } : undefined,
      cycleSize: cycle?.[0],
      cycleHours: cycle?.[1],
      issueWarehouse: "WH-TBD-01",
      history:
        id === "WC-600"
          ? [A("2026-10-06", "Production supervisor", "Status Active → Maintenance: blast room dust collector rebuild, planned to Oct 21, 2026. Scheduler warned.")]
          : id === "WC-105"
            ? [A("2026-03-31", "Manufacturing engineer", "Status Active → Inactive: shear retired, cutting moved to WC-100 step-lap line")]
            : [A("2026-01-05", "Manufacturing engineer", "Capacity model and rates loaded at go-live")],
    }
  }
  return out
}

// ------------------------------------------------------------------ routings
type CompT = [MaterialId, number, "manual" | "backflush", boolean?]
type OpT = { no: number; wc: WorkCenterId; text: string; setup: number; run: number; crew: number; qc?: string; plan?: string; milestone?: boolean; capture?: string[]; comps?: CompT[]; wi?: string[] }
const op = (no: number, wc: WorkCenterId, text: string, setup: number, run: number, crew: number, extra: Partial<OpT> = {}): OpT => ({ no, wc, text, setup, run, crew, ...extra })

const R20: OpT[] = [
  op(10, "WC-100", "Slit and step-lap cut CRGO laminations", 4, 36, 2, { comps: [["RAW-TBD-CRGO23", 18000, "manual"]], wi: ["DOC-TBD-WI-100"] }),
  op(20, "WC-110", "Stack core, clamp, core-loss pre-check", 2, 60, 3, { qc: "Core loss pre-check", plan: "IP-TBD-INP-CORE" }),
  op(30, "WC-210", "Wind HV disc coils, three phases", 3, 110, 2, { qc: "Winding", plan: "IP-TBD-INP-WND", capture: ["Turns count", "Measured resistance (mΩ)", "Radial build (mm)"], comps: [["RAW-TBD-CTC", 4200, "manual"]], wi: ["DOC-TBD-WI-210"] }),
  op(40, "WC-200", "Wind LV foil coils, three phases", 2, 54, 2, { capture: ["Turns count", "Measured resistance (mΩ)"], comps: [["RAW-TBD-FOIL", 2600, "manual"], ["RAW-TBD-KRAFT", 900, "backflush"]] }),
  op(50, "WC-220", "Assemble phases, size and braze", 2, 62, 3),
  op(60, "WC-230", "Vapor-phase drying cycle", 1, 46, 1, { capture: ["Cycle #", "Final moisture (%)", "Cycle chart attached"] }),
  op(70, "WC-050", "Fabricate main tank, radiator headers; leak test", 6, 150, 3, { comps: [["RAW-TBD-PLATE", 14500, "manual"], ["CONS-TBD-WELD", 220, "backflush"]] }),
  op(80, "WC-300", "Core-coil marriage, cleating, tap lead connection", 3, 84, 3),
  op(90, "WC-310", "Tank the active part, gasket, cover fit", 2, 36, 3),
  op(100, "WC-320", "Vacuum cycle, degassed oil fill, standing time", 2, 44, 1, { qc: "Pre-Test", plan: "IP-TBD-INP-PRE", comps: [["RAW-TBD-OIL", 28000, "manual"]] }),
  op(110, "WC-400", "Install HV bushings, OLTC, radiators, conservator, wiring", 4, 104, 3, { comps: [["RAW-TBD-BSH145", 3, "manual", true], ["RAW-TBD-OLTC", 1, "manual", true], ["RAW-TBD-RAD", 8, "backflush"]], wi: ["DOC-TBD-WI-400"] }),
  op(120, "WC-500", "Final test per IEEE C57.12.90", 2, 34, 2, { qc: "Final Test", plan: "IP-TBD-FIN-20M", milestone: true }),
  op(130, "WC-600", "Blast, prime, topcoat; nameplate (SP-13)", 2, 36, 2, { comps: [["CONS-TBD-PAINT", 180, "backflush"]] }),
  op(140, "WC-700", "Drain and gas-fill for transport, crate accessories, load", 2, 22, 3, { comps: [["PACK-TBD-SKID", 1, "backflush"], ["PACK-TBD-CRATE", 2, "backflush"]] }),
]
const R75: OpT[] = [
  op(10, "WC-100", "Cut CRGO laminations", 2, 14, 2, { comps: [["RAW-TBD-CRGO23", 5200, "manual"]] }),
  op(20, "WC-110", "Stack and clamp core", 1, 22, 2, { qc: "Core loss pre-check", plan: "IP-TBD-INP-CORE" }),
  op(30, "WC-210", "Wind HV coils", 2, 40, 2, { qc: "Winding", plan: "IP-TBD-INP-WND", capture: ["Turns count", "Measured resistance (mΩ)"], comps: [["RAW-TBD-CTC", 1300, "manual"]] }),
  op(40, "WC-200", "Wind LV foil coils", 1, 22, 2, { comps: [["RAW-TBD-FOIL", 900, "manual"], ["RAW-TBD-KRAFT", 260, "backflush"]] }),
  op(50, "WC-230", "Vapor-phase drying cycle", 1, 30, 1, { capture: ["Cycle #", "Final moisture (%)"] }),
  op(60, "WC-050", "Fabricate stainless tank", 3, 60, 2, { comps: [["RAW-TBD-PLATE", 4200, "manual"]] }),
  op(70, "WC-300", "Core-coil assembly", 2, 30, 2),
  op(80, "WC-310", "Tanking", 1, 14, 2),
  op(90, "WC-320", "Vacuum and oil fill", 1, 18, 1, { qc: "Pre-Test", plan: "IP-TBD-INP-PRE", comps: [["RAW-TBD-OIL", 6800, "manual"]] }),
  op(100, "WC-400", "Install LV bushings, radiators, accessories", 2, 34, 2, { comps: [["RAW-TBD-BSH015", 3, "manual", true], ["RAW-TBD-RAD", 4, "backflush"]] }),
  op(110, "WC-500", "Final test per IEEE C57.12.90", 1, 16, 2, { qc: "Final Test", plan: "IP-TBD-FIN-PM", milestone: true }),
  op(120, "WC-600", "Paint and nameplate (SP-13)", 1, 14, 2, { comps: [["CONS-TBD-PAINT", 60, "backflush"]] }),
  op(130, "WC-700", "Pack and load", 1, 8, 2, { comps: [["PACK-TBD-SKID", 1, "backflush"]] }),
]
const R5M: OpT[] = [
  op(10, "WC-100", "Cut CRGO laminations", 2, 12, 2, { comps: [["RAW-TBD-CRGO23", 4100, "manual"]] }),
  op(20, "WC-110", "Stack and clamp core", 1, 18, 2, { qc: "Core loss pre-check", plan: "IP-TBD-INP-CORE" }),
  op(30, "WC-210", "Wind HV coils", 2, 34, 2, { qc: "Winding", plan: "IP-TBD-INP-WND", capture: ["Turns count", "Measured resistance (mΩ)"], comps: [["RAW-TBD-CTC", 1050, "manual"]] }),
  op(40, "WC-200", "Wind LV strip coils", 1, 18, 2, { comps: [["RAW-TBD-CTC", 740, "manual"], ["RAW-TBD-KRAFT", 210, "backflush"]] }),
  op(50, "WC-230", "Vapor-phase drying cycle", 1, 28, 1, { capture: ["Cycle #", "Final moisture (%)"] }),
  op(60, "WC-050", "Fabricate tank", 2, 48, 2, { comps: [["RAW-TBD-PLATE", 3600, "manual"]] }),
  op(70, "WC-300", "Core-coil assembly", 2, 26, 2),
  op(80, "WC-310", "Tanking", 1, 12, 2),
  op(90, "WC-320", "Vacuum and oil fill", 1, 16, 1, { qc: "Pre-Test", plan: "IP-TBD-INP-PRE", comps: [["RAW-TBD-OIL", 5600, "manual"]] }),
  op(100, "WC-400", "Install LV bushings, radiators, accessories", 2, 28, 2, { comps: [["RAW-TBD-BSH015", 3, "manual", true], ["RAW-TBD-RAD", 4, "backflush"]] }),
  op(110, "WC-500", "Final test per IEEE C57.12.90", 1, 14, 2, { qc: "Final Test", plan: "IP-TBD-FIN-PM", milestone: true }),
  op(120, "WC-600", "Paint and nameplate (SP-13)", 1, 12, 2, { comps: [["CONS-TBD-PAINT", 50, "backflush"]] }),
  op(130, "WC-700", "Pack and load", 1, 6, 2, { comps: [["PACK-TBD-SKID", 1, "backflush"]] }),
]
const R25: OpT[] = [
  op(10, "WC-100", "Cut CRGO laminations", 1, 4, 1, { comps: [["RAW-TBD-CRGO23", 1900, "manual"]] }),
  op(20, "WC-110", "Stack and clamp core", 1, 6, 1),
  op(30, "WC-200", "Wind LV foil coil", 1, 5, 1, { comps: [["RAW-TBD-FOIL", 320, "manual"]] }),
  op(40, "WC-210", "Wind HV coil", 1, 7, 1, { qc: "Winding", plan: "IP-TBD-INP-WND-PM", capture: ["Turns count", "Measured resistance (mΩ)"], comps: [["RAW-TBD-CTC", 420, "manual"]] }),
  op(50, "WC-230", "Drying cycle", 1, 1.5, 1),
  op(60, "WC-300", "Core-coil assembly", 1, 5, 1),
  op(70, "WC-310", "Tanking", 1, 2.5, 1),
  op(80, "WC-320", "Vacuum and oil fill", 1, 2, 1, { qc: "Pre-Test", plan: "IP-TBD-INP-PRE", comps: [["RAW-TBD-OIL", 1900, "manual"]] }),
  op(90, "WC-400", "Fittings and cabinet", 1, 4, 1),
  op(100, "WC-500", "Routine test", 1, 2.5, 1, { qc: "Final Test", plan: "IP-TBD-FIN-PM", milestone: true }),
  op(110, "WC-600", "Paint and nameplate", 1, 1.5, 1, { comps: [["CONS-TBD-PAINT", 14, "backflush"]] }),
  op(120, "WC-700", "Pack", 0.5, 1, 1, { comps: [["PACK-TBD-CRATE", 1, "backflush"]] }),
]
const scaleOps = (src: OpT[], f: number, comp: number): OpT[] =>
  src.map((o) => ({ ...o, run: round2(o.run * f), comps: o.comps?.map(([m, q, i, s]) => [m, s ? q : Math.round(q * comp), i, s] as CompT) }))
const R10 = scaleOps(R25, 0.6, 0.55)
const R167: OpT[] = [
  op(10, "WC-100", "Cut core strip", 0.5, 0.8, 1, { comps: [["RAW-TBD-CRGO23", 180, "manual"]] }),
  op(20, "WC-110", "Wound-core form and anneal", 0.5, 1, 1),
  op(30, "WC-200", "Wind LV coil", 0.5, 1.2, 1, { comps: [["RAW-TBD-FOIL", 45, "manual"]] }),
  op(40, "WC-210", "Wind HV coil", 0.5, 1.5, 1, { qc: "Winding", plan: "IP-TBD-INP-WND-PL", comps: [["RAW-TBD-CTC", 60, "manual"]] }),
  op(50, "WC-230", "Drying cycle", 1, 0.2, 1),
  op(60, "WC-310", "Assemble and tank", 0.5, 0.8, 1),
  op(70, "WC-320", "Oil fill", 0.5, 0.5, 1, { comps: [["RAW-TBD-OIL", 160, "manual"]] }),
  op(80, "WC-500", "Routine test", 0.5, 0.6, 1, { qc: "Final Test", plan: "IP-TBD-FIN-PL", milestone: true }),
  op(90, "WC-600", "Paint and nameplate", 0.5, 0.4, 1, { comps: [["CONS-TBD-PAINT", 2, "backflush"]] }),
  op(100, "WC-700", "Pack", 0.5, 0.3, 1),
]
const RCORE: OpT[] = [
  op(10, "WC-100", "Cut CRGO laminations", 4, 36, 2, { comps: [["RAW-TBD-CRGO23", 18000, "manual"]] }),
  op(20, "WC-110", "Stack core, clamp, core-loss pre-check", 2, 60, 3, { qc: "Core loss pre-check", plan: "IP-TBD-INP-CORE" }),
]
const RTANK: OpT[] = [op(10, "WC-050", "Fabricate main tank, radiator headers; leak test", 6, 150, 3, { comps: [["RAW-TBD-PLATE", 14500, "manual"]] }), op(20, "WC-600", "Blast and prime tank", 2, 14, 2)]

const ROUTING_OPS: Record<string, OpT[]> = {
  "RTG-TBD-20MVA": R20,
  "RTG-TBD-7500MTO": R75,
  "RTG-TBD-5000SS": R5M,
  "RTG-TBD-2500PM": R25,
  "RTG-TBD-1000PM": R10,
  "RTG-TBD-0167PL": R167,
  "RTG-TBD-CORE20": RCORE,
  "RTG-TBD-TANK20": RTANK,
}
export const routingIdFor = (item: string) =>
  ({ "FIN-TBD-20MVA": "RTG-TBD-20MVA", "FIN-TBD-7500MTO": "RTG-TBD-7500MTO", "FIN-TBD-5000SS": "RTG-TBD-5000SS", "FIN-TBD-2500PM": "RTG-TBD-2500PM", "FIN-TBD-1000PM": "RTG-TBD-1000PM", "FIN-TBD-0167PL": "RTG-TBD-0167PL", "SEMI-TBD-CORE20": "RTG-TBD-CORE20", "SEMI-TBD-TANK20": "RTG-TBD-TANK20" })[item] ?? "RTG-TBD-2500PM"

function buildRoutings(): PPRouting[] {
  const mk = (id: string, materialId: MaterialId, rev: string, status: PPRouting["status"], description: string, validFrom: ISODate, author: string, activity: Activity[], extra: Partial<PPRouting> = {}, src = ROUTING_OPS[id]): PPRouting => ({
    id: `${id}` as PPRouting["id"],
    materialId,
    rev,
    status,
    description,
    validFrom,
    author,
    activity,
    ops: src.map((o) => ({ no: o.no, workCenterId: o.wc, text: o.text, setupHours: o.setup, runHours: o.run, qcFlag: !!o.qc, wiDocIds: (o.wi ?? []) as `DOC-${string}`[] })),
    opsDetail: src.map((o) => ({
      no: o.no, workCenterId: o.wc, text: o.text, setupHours: o.setup, runHours: o.run, qcFlag: !!o.qc, wiDocIds: (o.wi ?? []) as `DOC-${string}`[],
      crew: o.crew, basis: o.wc === "WC-230" ? "per cycle" : "per unit", qcPlan: o.plan, milestone: o.milestone, components: (o.comps ?? []).map(([m, q]) => `${m} × ${q}`),
    })),
    ...extra,
  })
  const r20a = R20.map((o) => (o.no === 110 ? { ...o, text: "Install HV bushings, OLTC (15 positions), radiators, wiring" } : o))
  const r20c = R20.map((o) => (o.no === 110 ? { ...o, text: "Install HV bushings (alternate source pending), OLTC, radiators, wiring", run: 108 } : o))
  return [
    mk("RTG-TBD-20MVA", "FIN-TBD-20MVA", "B", "Released", "20 MVA ONAN/ONAF, 115 kV - 13.8 kV, Omaha North configuration", "2026-03-24", "Grace Mwangi", [A("2026-03-20", "Manufacturing engineer", "Rev B authored from EBOM-TBD-0301 rev B (tap range 17 positions)"), A("2026-03-23", "Manufacturing engineer", "Draft → In Review"), A("2026-03-24", "Engineering Manager", "In Review → Released; paired in PV-TBD-0301")], { productionVersionId: "PV-TBD-0301" }),
    { ...mk("RTG-TBD-20MVA", "FIN-TBD-20MVA", "A", "Superseded", "20 MVA, first issue (15-position OLTC)", "2026-02-16", "Grace Mwangi", [A("2026-02-16", "Engineering Manager", "Released"), A("2026-03-24", "System", "Released → Superseded by rev B")], {}, r20a), id: "RTG-TBD-20MVA" },
    { ...mk("RTG-TBD-20MVA", "FIN-TBD-20MVA", "C", "Draft", "20 MVA phase 2 (SO-2026-00377): bushing change after the recall", "2026-10-07", "Grace Mwangi", [A("2026-10-07", "Manufacturing engineer", "Rev C drafted from rev B for ER-TBD-0377; final assembly time under review")], { ecoRef: "ECO-TBD-0024" }, r20c), id: "RTG-TBD-20MVA" },
    mk("RTG-TBD-7500MTO", "FIN-TBD-7500MTO", "A", "Released", "7.5 MVA stainless pad-mount, MTO", "2026-05-11", "Grace Mwangi", [A("2026-05-11", "Engineering Manager", "Released")]),
    mk("RTG-TBD-5000SS", "FIN-TBD-5000SS", "C", "Released", "5 MVA secondary unit substation", "2026-06-02", "Grace Mwangi", [A("2026-06-02", "Engineering Manager", "Released; rev B superseded")]),
    { ...mk("RTG-TBD-5000SS", "FIN-TBD-5000SS", "B", "Superseded", "5 MVA secondary unit substation, previous oven recipe", "2025-11-03", "Grace Mwangi", [A("2026-06-02", "System", "Released → Superseded by rev C")]), id: "RTG-TBD-5000SS" },
    mk("RTG-TBD-2500PM", "FIN-TBD-2500PM", "D", "Released", "2,500 kVA pad-mount", "2026-01-12", "Grace Mwangi", [A("2026-01-12", "Engineering Manager", "Released")]),
    { ...mk("RTG-TBD-2500PM", "FIN-TBD-2500PM", "E", "In Review", "2,500 kVA pad-mount: tank gasket change through ECO-TBD-0021", "2026-10-05", "Grace Mwangi", [A("2026-10-02", "Manufacturing engineer", "Rev E drafted for ECO-TBD-0021"), A("2026-10-05", "Manufacturing engineer", "Draft → In Review")], { ecoRef: "ECO-TBD-0021" }), id: "RTG-TBD-2500PM" },
    mk("RTG-TBD-1000PM", "FIN-TBD-1000PM", "B", "Released", "1,000 kVA pad-mount", "2026-01-12", "Grace Mwangi", [A("2026-01-12", "Engineering Manager", "Released")]),
    mk("RTG-TBD-0167PL", "FIN-TBD-0167PL", "E", "Released", "167 kVA pole-mount, wound core", "2025-09-15", "Grace Mwangi", [A("2025-09-15", "Engineering Manager", "Released")]),
    mk("RTG-TBD-CORE20", "SEMI-TBD-CORE20", "A", "Released", "Stacked core, 20 MVA three-limb", "2026-03-24", "Grace Mwangi", [A("2026-03-24", "Engineering Manager", "Released")]),
    mk("RTG-TBD-TANK20", "SEMI-TBD-TANK20", "A", "In Review", "Main tank 20 MVA as a separate sub-assembly order", "2026-10-01", "Grace Mwangi", [A("2026-10-01", "Manufacturing engineer", "Draft → In Review")]),
    { ...mk("RTG-TBD-CORE25", "SEMI-TBD-CORE25", "A", "Draft", "Stacked core, 2,500 kVA (material in Data Completion)", "2026-10-08", "Grace Mwangi", [A("2026-10-08", "Manufacturing engineer", "Draft authored; waits for SEMI-TBD-CORE25 to become Active")], {}, RCORE.map((o) => ({ ...o, run: round2(o.run * 0.12), comps: [["RAW-TBD-CRGO23", 1900, "manual"]] as CompT[] }))), id: "RTG-TBD-CORE25" },
  ]
}

// ------------------------------------------------------------------ production orders
const OPEN_STATES = new Set<ProductionOrderStatus>(["Created", "Released", "In Progress", "Testing", "On Hold"])

interface WoSpec {
  id: PPWorkOrder["id"]
  item: MaterialId
  qty: number
  status: ProductionOrderStatus
  orderType: PPWorkOrder["orderType"]
  priority: number
  peg?: { soId: `SO-${string}`; line: number; sched: number }
  /** Completed operations count. */
  done: number
  /** For finished orders: last operation finish (FG receipt next working day). */
  finishedOn?: ISODate
  inProgress?: boolean
  serial?: SerialNo
  lotSerialPrefix?: string
  created: ISODate
  mbomRev?: string
  routingRev?: string
  pv?: string
  plannedOrderId?: string
  holdReason?: string
  promiseDate?: ISODate
  gate?: Partial<PPWorkOrder["gateInputs"]>
  costStd?: CostStd
  settledOn?: ISODate
  scrapUnits?: number
  cancelDisposition?: string
  readings?: string[]
  /** Variance factors on actual hours and material (design). */
  hf?: number
  mf?: number
  bushingsPending?: boolean
}

const DESIGN_STD_7500 = 176000 // design: MTO item has no material-master standard; cost estimate per order not seeded

function costFor(item: MaterialId, qty: number, ops: OpT[], rates: Record<string, WcOverride>): CostStd {
  let hours = 0
  let labor = 0
  let overhead = 0
  for (const o of ops) {
    const h = (o.setup + o.run * qty) * o.crew
    hours += h
    labor += h * rates[o.wc].laborRate
    overhead += h * rates[o.wc].overheadRate
  }
  const unit = item === "FIN-TBD-7500MTO" ? DESIGN_STD_7500 : item === "FIN-TBD-20MVA" ? 948600 : std(item)
  const total = unit * qty
  return { material: round2(Math.max(total - labor - overhead, total * 0.4)), labor: round2(labor), overhead: round2(overhead), subcontract: 0, hours: round2(hours) }
}

/** Operations flagged with a required skill (QAL register) [DOC:p.193 Book III E §2]. Which work centers
 *  carry a skill flag is a design value. */
export const SKILL_BY_WC: Partial<Record<string, string>> = { "WC-210": "HV winding", "WC-400": "HV bushing installation", "WC-500": "HV routine testing" }

function buildOps(spec: WoSpec, src: OpT[]): PPOperation[] {
  return src.map((o, i) => {
    const comps: OpComponent[] = (o.comps ?? []).map(([m, q, issue, serialized]) => ({ materialId: m, qtyPerUnit: q, issue, serialized: !!serialized, issued: 0, lots: [] }))
    const status: PPOperation["status"] = i < spec.done ? "Completed" : i === spec.done && spec.inProgress ? "In Progress" : "Not Started"
    return {
      no: o.no,
      workCenterId: o.wc,
      text: o.text,
      setupHours: o.setup,
      runHours: round2(o.run * spec.qty),
      crew: o.crew,
      qcGate: o.qc,
      milestone: o.milestone,
      captureTemplate: o.capture,
      requiredSkill: SKILL_BY_WC[o.wc],
      components: comps,
      status,
      start: spec.created,
      finish: spec.created,
      sequence: 0,
      crewIds: [],
      staged: status !== "Not Started",
      confirmedGood: 0,
      confirmedScrap: 0,
      confirmedRework: 0,
      actualHours: 0,
    }
  })
}

const BATCH_FOR: Record<string, string> = {
  "RAW-TBD-CRGO23": "BAT-TBD-C2611",
  "RAW-TBD-CTC": "BAT-TBD-U0912",
  "RAW-TBD-FOIL": "BAT-TBD-F0877",
  "RAW-TBD-OIL": "BAT-TBD-O1440",
  "RAW-TBD-KRAFT": "BAT-TBD-K0305",
  "RAW-TBD-PLATE": "BAT-TBD-P0418",
  "RAW-TBD-RAD": "BAT-TBD-R0230",
  "CONS-TBD-PAINT": "BAT-TBD-T0090",
  "CONS-TBD-WELD": "BAT-TBD-W0311",
}

export function seed(): PlanningProductionState {
  const wc = wcOverrides()
  const rnd = deterministic("pe-v2-planning-production")
  let jeSeq = 4100
  let cnfSeq = 20400
  let genSeq = 9100
  const journal: JournalEntry[] = []
  const confirmations: PPConfirmation[] = []
  const genealogy: GenealogyRow[] = []
  const je = (template: JournalEntry["template"], amount: number, date: ISODate, source: JournalEntry["source"], detail: string, wip1320: number, wip1325 = 0, reverses?: string) => {
    const e: JournalEntry = { id: `JE-TBD-${++jeSeq}`, template, amount: round2(amount), date, period: date.slice(0, 7), source, detail, wip1320: round2(wip1320), wip1325: round2(wip1325), reverses }
    journal.push(e)
    return e
  }
  const gen = (row: Omit<GenealogyRow, "id">) => genealogy.push({ id: `GEN-TBD-${++genSeq}`, ...row })

  const specs: WoSpec[] = [
    // hero: phase 1 unit, settled
    { id: "WO-TBD-0301", item: "FIN-TBD-20MVA", qty: 1, status: "Closed (TECO)", orderType: "ETO", priority: 1, peg: { soId: "SO-2026-00301", line: 10, sched: 10 }, done: 14, finishedOn: "2026-08-07", serial: "SN-TBD-20M-0301", created: "2026-04-06", mbomRev: "B", routingRev: "B", pv: "PV-TBD-0301", settledOn: "2026-08-14", promiseDate: "2026-08-11", hf: 1.023, mf: 1.0107, costStd: undefined },
    // MTO in production: WC-600 maintenance sits in its path
    { id: "WO-2026-00389", item: "FIN-TBD-7500MTO", qty: 1, status: "In Progress", orderType: "MTO", priority: 2, peg: { soId: "SO-2026-00389", line: 10, sched: 10 }, done: 7, inProgress: true, serial: "SN-TBD-7M5-0389", created: "2026-08-24", promiseDate: "2026-11-20", hf: 1.04, mf: 1.012 },
    { id: "WO-2026-00402", item: "FIN-TBD-7500MTO", qty: 1, status: "Created", orderType: "MTO", priority: 6, peg: { soId: "SO-2026-00402", line: 10, sched: 10 }, done: 0, created: "2026-10-07", plannedOrderId: "PLO-TBD-0410", promiseDate: "2026-11-30", readings: ["Standard cost: MTO item has no standard; warning and CVA exception per check 5"] },
    { id: "WO-2026-00395", item: "FIN-TBD-5000SS", qty: 1, status: "Testing", orderType: "MTS", priority: 3, done: 10, inProgress: true, serial: "SN-TBD-5M-0395", created: "2026-08-31", hf: 1.06, mf: 1.004 },
    { id: "WO-2026-00396", item: "FIN-TBD-5000SS", qty: 1, status: "In Progress", orderType: "MTS", priority: 4, done: 9, inProgress: true, serial: "SN-TBD-5M-0396", created: "2026-09-08", hf: 1.02, mf: 1.0, bushingsPending: true },
    { id: "WO-2026-00404", item: "FIN-TBD-5000SS", qty: 1, status: "Released", orderType: "MTS", priority: 9, done: 0, serial: "SN-TBD-5M-0404", created: "2026-10-05" },
    { id: "WO-2026-00410", item: "FIN-TBD-2500PM", qty: 4, status: "Released", orderType: "MTS", priority: 10, done: 0, lotSerialPrefix: "SN-TBD-25P-0410", created: "2026-10-06" },
    { id: "WO-2026-00411", item: "FIN-TBD-1000PM", qty: 6, status: "In Progress", orderType: "MTS", priority: 5, done: 2, inProgress: true, lotSerialPrefix: "SN-TBD-10P-0411", created: "2026-09-28", hf: 1.08, mf: 1.02 },
    { id: "WO-2026-00412", item: "FIN-TBD-0167PL", qty: 20, status: "In Progress", orderType: "MTS", priority: 7, done: 4, lotSerialPrefix: "SN-TBD-PL-0412", created: "2026-09-25", hf: 0.97, mf: 1.01 },
    { id: "WO-2026-00413", item: "FIN-TBD-0167PL", qty: 12, status: "Created", orderType: "MTS", priority: 12, done: 0, created: "2026-10-07", plannedOrderId: "PLO-TBD-0405" },
    { id: "WO-2026-00414", item: "FIN-TBD-2500PM", qty: 2, status: "Created", orderType: "MTS", priority: 13, done: 0, created: "2026-10-08", plannedOrderId: "PLO-TBD-0406", gate: { inspectionPlansActive: false } },
    { id: "WO-2026-00415", item: "FIN-TBD-1000PM", qty: 4, status: "Released", orderType: "MTS", priority: 11, done: 0, lotSerialPrefix: "SN-TBD-10P-0415", created: "2026-10-02", plannedOrderId: "PLO-TBD-0407" },
    { id: "WO-2026-00416", item: "FIN-TBD-0167PL", qty: 15, status: "Released", orderType: "MTS", priority: 14, done: 0, lotSerialPrefix: "SN-TBD-PL-0416", created: "2026-10-05", plannedOrderId: "PLO-TBD-0408" },
    { id: "WO-2026-00417", item: "FIN-TBD-5000SS", qty: 1, status: "Created", orderType: "MTS", priority: 15, done: 0, created: "2026-10-08", plannedOrderId: "PLO-TBD-0409" },
    { id: "WO-2026-00405", item: "FIN-TBD-2500PM", qty: 3, status: "In Progress", orderType: "MTS", priority: 8, done: 4, inProgress: true, lotSerialPrefix: "SN-TBD-25P-0405", created: "2026-09-22", hf: 1.03, mf: 0.995 },
    { id: "WO-2026-00406", item: "FIN-TBD-1000PM", qty: 2, status: "Testing", orderType: "MTS", priority: 4, done: 9, inProgress: true, lotSerialPrefix: "SN-TBD-10P-0406", created: "2026-09-14", hf: 1.05, mf: 1.0 },
    { id: "WO-2026-00398", item: "FIN-TBD-1000PM", qty: 4, status: "Completed", orderType: "MTS", priority: 20, done: 12, finishedOn: "2026-09-30", lotSerialPrefix: "SN-TBD-10P-0398", created: "2026-09-02", hf: 1.06, mf: 1.015 },
    { id: "WO-2026-00399", item: "FIN-TBD-2500PM", qty: 2, status: "Completed", orderType: "MTS", priority: 20, done: 12, finishedOn: "2026-10-06", lotSerialPrefix: "SN-TBD-25P-0399", created: "2026-09-10", hf: 0.96, mf: 0.99 },
    { id: "WO-2026-00393", item: "FIN-TBD-5000SS", qty: 1, status: "Completed", orderType: "MTS", priority: 20, done: 13, finishedOn: "2026-10-07", serial: "SN-TBD-5M-0393", created: "2026-08-17", hf: 1.11, mf: 1.03 },
    { id: "WO-2026-00390", item: "FIN-TBD-0167PL", qty: 30, status: "Closed (TECO)", orderType: "MTS", priority: 20, done: 10, finishedOn: "2026-09-24", lotSerialPrefix: "SN-TBD-PL-0390", created: "2026-09-01", settledOn: "2026-09-30", scrapUnits: 1, hf: 1.02, mf: 1.02 },
    { id: "WO-2026-00386", item: "FIN-TBD-2500PM", qty: 3, status: "Closed (TECO)", orderType: "MTS", priority: 20, done: 12, finishedOn: "2026-09-18", lotSerialPrefix: "SN-TBD-25P-0386", created: "2026-08-12", settledOn: "2026-09-30", hf: 0.98, mf: 1.0 },
    { id: "WO-2026-00385", item: "FIN-TBD-1000PM", qty: 4, status: "Closed (TECO)", orderType: "MTS", priority: 20, done: 12, finishedOn: "2026-09-11", lotSerialPrefix: "SN-TBD-10P-0385", created: "2026-08-10", settledOn: "2026-09-30", hf: 1.04, mf: 1.01 },
    { id: "WO-2026-00387", item: "FIN-TBD-5000SS", qty: 1, status: "Closed (TECO)", orderType: "MTS", priority: 20, done: 13, finishedOn: "2026-09-25", serial: "SN-TBD-5M-0387", created: "2026-07-27", settledOn: "2026-09-30", hf: 1.01, mf: 0.99 },
    { id: "WO-2026-00397", item: "FIN-TBD-2500PM", qty: 2, status: "On Hold", orderType: "MTS", priority: 16, done: 6, lotSerialPrefix: "SN-TBD-25P-0397", created: "2026-09-21", holdReason: "ECO immediate effectivity: ECO-TBD-0021 tank gasket material; open WOs blocked until QM + EM joint release (C-20)", hf: 1.0, mf: 1.0 },
    { id: "WO-2026-00400", item: "FIN-TBD-1000PM", qty: 3, status: "On Hold", orderType: "MTS", priority: 17, done: 4, lotSerialPrefix: "SN-TBD-10P-0400", created: "2026-09-24", holdReason: "Quality hold: HV winding resistance out of tolerance on 1 of 3 coils, NCR-TBD-0047", hf: 1.1, mf: 1.0 },
    { id: "WO-2026-00392", item: "FIN-TBD-0167PL", qty: 10, status: "Cancelled", orderType: "MTS", priority: 20, done: 3, lotSerialPrefix: "SN-TBD-PL-0392", created: "2026-09-03", cancelDisposition: "Stop-scrap: 10 cut cores scrapped; collected costs to scrap and variance per Controller decision", hf: 1.0, mf: 1.0 },
  ]

  const routings = buildRoutings()
  const productionOrders: PPWorkOrder[] = []
  for (const s of specs) {
    const rid = routingIdFor(s.item)
    const src = ROUTING_OPS[rid]
    const ops = buildOps(s, src)
    const costStd = s.costStd ?? (s.id === "WO-TBD-0301" ? { material: 612400, labor: 118900, overhead: 147300, subcontract: 70000, hours: round2(src.reduce((a, o) => a + (o.setup + o.run) * o.crew, 0)) } : costFor(s.item, s.qty, src, wc))
    // operation dates: completed ops laid out forward from the start (finished orders backward from finish)
    const durs = ops.map((o) => Math.max(1, Math.ceil(opHours(o) / 13.6)))
    let cursor: ISODate
    if (s.finishedOn) {
      const total = durs.slice(0, s.done).reduce((a, b) => a + b, 0)
      cursor = addWorkdays(s.finishedOn, -(total - 1))
    } else {
      const total = durs.slice(0, s.done).reduce((a, b) => a + b, 0)
      cursor = addWorkdays(TODAY, -(total + (s.inProgress ? 1 : 0)))
    }
    const start = cursor
    ops.forEach((o, i) => {
      if (i < s.done || (i === s.done && s.inProgress)) {
        o.start = nextWorkday(cursor)
        o.finish = i === s.done ? TODAY : addWorkdays(o.start, durs[i] - 1)
        cursor = addWorkdays(o.finish, 1)
      }
    })
    if (s.id === "WO-TBD-0301") {
      const fixed: [ISODate, ISODate][] = [
        ["2026-04-06", "2026-04-09"], ["2026-04-10", "2026-04-17"], ["2026-04-20", "2026-05-01"], ["2026-05-04", "2026-05-08"], ["2026-05-11", "2026-05-15"], ["2026-05-18", "2026-05-20"],
        ["2026-04-13", "2026-04-30"], ["2026-05-21", "2026-06-01"], ["2026-06-02", "2026-06-04"], ["2026-06-05", "2026-06-10"], ["2026-07-13", "2026-07-22"], ["2026-07-23", "2026-07-28"],
        ["2026-07-29", "2026-08-03"], ["2026-08-04", "2026-08-07"],
      ]
      ops.forEach((o, i) => ([o.start, o.finish] = fixed[i]))
    }
    const serials: SerialNo[] = s.serial ? [s.serial] : s.lotSerialPrefix && s.status !== "Created" ? Array.from({ length: s.qty }, (_, i) => `${s.lotSerialPrefix}-${String(i + 1).padStart(2, "0")}` as SerialNo) : []
    const isHero = s.id === "WO-TBD-0301"
    const wo: PPWorkOrder = {
      id: s.id,
      itemId: s.item,
      serial: s.serial,
      serials,
      mbomRev: s.mbomRev ?? (s.item === "FIN-TBD-20MVA" ? "B" : "A"),
      routingRev: s.routingRev ?? routings.find((r) => r.id === rid && r.status === "Released")?.rev ?? "A",
      routingId: rid,
      productionVersionId: (s.pv ?? `PV-TBD-${rid.slice(8)}`) as PPWorkOrder["productionVersionId"],
      status: s.status,
      holdReason: s.holdReason,
      pegs: s.peg ? [s.peg] : [],
      qty: s.qty,
      start,
      finish: ops[ops.length - 1].finish,
      operations: ops,
      orderType: s.orderType,
      priority: s.priority,
      costStd,
      createdOn: s.created,
      createdBy: "USR-TBD-030",
      activity: [A(s.created, s.plannedOrderId ? "Planner" : "Production Scheduler", s.plannedOrderId ? `Created from planned order ${s.plannedOrderId} (run ID logged); pegs preserved` : "Created")],
      readings: s.readings,
      gateInputs: {
        mbomActive: true,
        drawingsReleased: s.orderType === "ETO" ? true : "n/a",
        customerApproval: s.orderType === "ETO" ? true : "n/a",
        inspectionPlansActive: true,
        productionBlock: false,
        ...s.gate,
      },
      plannedOrderId: s.plannedOrderId,
      promiseDate: s.promiseDate,
      cancelDisposition: s.cancelDisposition,
      previousStatus: s.status === "On Hold" ? "In Progress" : undefined,
    }
    // activity trail
    if (s.status !== "Created") wo.activity.push(A(addWorkdays(start, -1), "Production Scheduler", `Released; revisions frozen (MBOM rev ${wo.mbomRev}, routing rev ${wo.routingRev})${serials.length ? `; serial${serials.length > 1 ? "s" : ""} ${serials.length > 1 ? `${serials[0]}..${serials.at(-1)}` : serials[0]} generated` : ""}; dispatch entries created`))

    // confirmations and journal for completed (and partly for in-progress) operations
    const lr = costStd.hours ? costStd.labor / costStd.hours : 0
    const oh = costStd.hours ? costStd.overhead / costStd.hours : 0
    const modelled = ops.reduce((a, o) => a + o.components.reduce((b, c) => b + c.qtyPerUnit * s.qty * std(c.materialId), 0), 0)
    const factor = modelled > 0 ? costStd.material / modelled : 0
    const scrapUnits = s.scrapUnits ?? 0
    ops.forEach((o, i) => {
      const finishing = i < s.done
      const partial = i === s.done && s.inProgress
      if (!finishing && !partial) return
      const ref = { type: "productionOrder" as const, id: s.id }
      // material issue (#28): manual items at issue, backflush at confirmation
      const matValue = o.components.reduce((a, c) => a + c.qtyPerUnit * s.qty * std(c.materialId), 0) * factor * (s.mf ?? 1)
      const issueAll = finishing || (partial && !(s.bushingsPending && o.workCenterId === "WC-400"))
      for (const c of o.components) {
        if (!issueAll && c.serialized) continue
        if (partial && c.issue === "backflush") continue
        c.issued = c.qtyPerUnit * s.qty
        if (c.serialized) {
          if (isHero && c.materialId === "RAW-TBD-BSH145") c.lots = ["SN-TBD-BSH-0301", "SN-TBD-BSH-0302", "SN-TBD-BSH-0303"]
          else if (isHero && c.materialId === "RAW-TBD-OLTC") c.lots = ["SN-TBD-OLTC-0301"]
          else c.lots = Array.from({ length: c.issued }, (_, k) => `SN-TBD-B15-${s.id.slice(-3)}${k + 1}`)
        } else c.lots = [isHero && c.materialId === "RAW-TBD-CRGO23" ? "BAT-TBD-C2402" : BATCH_FOR[c.materialId] ?? "BAT-TBD-GEN01"]
      }
      if (matValue > 0 && (finishing || partial)) {
        const portion = finishing ? 1 : o.components.filter((c) => c.issue === "manual" && c.issued > 0).reduce((a, c) => a + c.qtyPerUnit * std(c.materialId), 0) / Math.max(1, o.components.reduce((a, c) => a + c.qtyPerUnit * std(c.materialId), 0))
        if (portion > 0) {
          const amt = matValue * portion
          je(28, amt, o.start, ref, `Op ${o.no} ${o.workCenterId}: ${o.components.filter((c) => c.issued > 0).map((c) => `${c.materialId} ${c.lots[0] ?? ""}`).join(", ")}`, amt)
          for (const c of o.components.filter((c) => c.issued > 0 && c.issue === "manual"))
            gen({ code: "T05", at: `${o.start}T08:${String(10 + i).padStart(2, "0")}:00`, woId: s.id, op: o.no, batch: c.serialized ? undefined : c.lots[0], serial: c.serialized ? c.lots.join(", ") : undefined, scanPoint: "SP-08", userId: "USR-TBD-032", text: `Issued ${c.issued} ${c.materialId} to op ${o.no}` })
        }
      }
      if (!finishing) return
      const crewHours = opHours(o) * o.crew
      const hours = round2(crewHours * (s.hf ?? 1) * (0.97 + rnd() * 0.06))
      const good = i === ops.length - 1 ? s.qty - scrapUnits : s.qty
      const scrap = i === 1 && scrapUnits ? scrapUnits : 0
      const id = `CNF-TBD-${++cnfSeq}` as PPConfirmation["id"]
      confirmations.push({ id, woId: s.id, op: o.no, good: s.qty - scrap, scrap, rework: 0, hours, operatorId: o.workCenterId === "WC-400" ? "USR-TBD-032" : o.workCenterId === "WC-210" || o.workCenterId === "WC-220" ? "USR-TBD-033" : "USR-TBD-031", at: o.finish, eventUuid: `evt-${s.id}-${o.no}-seed`, crewSize: o.crew, scrapReason: scrap ? "SR-02 lamination burr out of tolerance" : undefined })
      o.status = "Completed"
      o.confirmedGood = good
      o.confirmedScrap = scrap
      o.actualHours = hours
      o.staged = true
      if (o.captureTemplate) o.capture = Object.fromEntries(o.captureTemplate.map((f) => [f, f.startsWith("Turns") ? "1,284" : f.startsWith("Measured") ? "412.6" : f.startsWith("Cycle #") ? `VPD-26-${String(300 + i).padStart(4, "0")}` : f.startsWith("Final moisture") ? "0.42" : f.startsWith("Radial") ? "86.5" : "Yes"]))
      if (o.qcGate) o.inspection = { id: isHero && o.qcGate === "Final Test" ? "IL-TBD-0302" : `IL-TBD-${s.id.slice(-4)}${o.no}`, result: "Passed", requestedOn: o.finish }
      je(29, hours * (lr + oh), o.finish, ref, `Op ${o.no} ${o.workCenterId}: ${hours} h × std labor ${lr.toFixed(2)} + overhead ${oh.toFixed(2)}`, hours * (lr + oh))
      if (scrap) {
        const sv = (costStd.material / s.qty) * 0.08 * scrap
        je(30, sv, o.finish, ref, `Op ${o.no}: ${scrap} unit scrapped, reason SR-02`, -sv)
      }
      gen({ code: "T07", at: `${o.finish}T15:30:00`, woId: s.id, op: o.no, serial: serials[0], scanPoint: "SP-11", userId: "USR-TBD-032", text: `Op ${o.no} confirmed: good ${good}, scrap ${scrap}, ${hours} h (MBOM rev ${wo.mbomRev}, routing rev ${wo.routingRev})` })
      if (isHero && o.no === 70) je(35, 70000, o.finish, ref, "Subcontract receipt: radiator hot-dip galvanizing SERV-TBD-GALV, PO price", 70000)
      if (o.components.some((c) => c.serialized) && o.workCenterId === "WC-400")
        for (const c of o.components.filter((c) => c.serialized))
          for (const lot of c.lots) gen({ code: "T06", at: `${o.finish}T11:00:00`, woId: s.id, op: o.no, serial: serials[0], child: lot, scanPoint: "SP-12", userId: "USR-TBD-032", text: `Installed ${lot} (${c.materialId}) in ${serials[0] ?? s.id}` })
      if (o.qcGate === "Final Test") gen({ code: "T08", at: `${o.finish}T17:00:00`, woId: s.id, op: o.no, serial: serials[0], scanPoint: "SP-14", userId: "USR-TBD-035", text: `Final test passed: ${isHero ? "IL-TBD-0302, " : ""}routine tests per IEEE C57.12.90; instruments in calibration` })
    })
    // partial confirmations so in-progress ops carry hours
    const ip = ops.find((o) => o.status === "In Progress")
    if (ip) ip.actualHours = round2(opHours(ip) * ip.crew * 0.45)

    if (s.status === "Testing") {
      const t = ops.find((o) => o.qcGate === "Final Test")!
      t.inspection = { id: `IL-TBD-${s.id.slice(-4)}${t.no}`, requestedOn: addWorkdays(TODAY, -1) }
    }
    if (["Completed", "Closed (TECO)"].includes(s.status)) {
      const fg = addWorkdays(s.finishedOn!, 1)
      wo.fgReceivedOn = fg
      wo.completedOn = fg
      wo.testPassed = true
      const good = s.qty - scrapUnits
      const recv = ((costStd.material + costStd.labor + costStd.overhead + costStd.subcontract) / s.qty) * good
      je(31, recv, fg, { type: "productionOrder", id: s.id }, `FG receipt: ${good} × ${s.item} at released standard${isHero ? " (CE-TBD-0301)" : ""}; to WH-TBD-01${isHero ? " STAGE-OUT, reserved to SO-2026-00301 line 10" : ""}`, -recv)
      gen({ code: "T09", at: `${fg}T09:00:00`, woId: s.id, serial: serials.length > 1 ? `${serials[0]}..${serials.at(-1)}` : serials[0], text: `Finished receipt: ${good} × ${s.item}, standard cost version 2026-01, quality status Unrestricted` })
      wo.activity.push(A(fg, "System", `Final operation confirmed; received to stock (#31); status Testing → Completed`))
    }
    if (isHero) wo.start = ops[0].start
    if (s.status === "Cancelled") wo.activity.push(A("2026-09-17", "Controller", `Cancelled. Disposition: ${s.cancelDisposition}`))
    if (s.status === "On Hold") wo.activity.push(A(addWorkdays(TODAY, -2), "Production supervisor", `In Progress → On Hold. Reason: ${s.holdReason}`))
    productionOrders.push(wo)
  }

  // Cancelled order: residual collected cost settled to scrap/variance at cancellation.
  {
    const wo = productionOrders.find((w) => w.id === "WO-2026-00392")!
    const bal = journal.filter((j) => j.source.id === wo.id).reduce((a, j) => a + j.wip1320, 0)
    je(30, bal, "2026-09-17", { type: "productionOrder", id: wo.id }, "Cancellation stop-scrap: collected costs to 5320 per Controller decision", -bal)
  }

  // Settlements (#32): residual WIP to variance accounts, zero WIP by construction.
  const settlements: Settlement[] = []
  const settle = (id: string, on: ISODate, by: string, woIds: string[]) => {
    const st: Settlement = { id, postedOn: on, period: on.slice(0, 7), by, orders: [] }
    for (const woId of woIds) {
      const wo = productionOrders.find((w) => w.id === woId)!
      const rows = journal.filter((j) => j.source.type === "productionOrder" && j.source.id === woId)
      const residual = rows.reduce((a, j) => a + j.wip1320, 0)
      const hoursAct = confirmations.filter((c) => c.woId === woId).reduce((a, c) => a + c.hours, 0)
      const lr = wo.costStd.labor / wo.costStd.hours
      const oh = wo.costStd.overhead / wo.costStd.hours
      const good = wo.operations.at(-1)!.confirmedGood
      const stdHours = (wo.costStd.hours * good) / wo.qty
      const lev = round2((hoursAct - stdHours) * lr)
      const oav = round2((hoursAct - stdHours) * oh)
      const mat = round2(residual - lev - oav)
      const e = je(32, residual, on, { type: "productionOrder", id: woId }, `Settlement ${id}: 5220 ${mat.toFixed(2)}, 5230 0.00, 5240 ${lev.toFixed(2)}, 5250 ${oav.toFixed(2)}`, -residual)
      st.orders.push({ woId: wo.id, mat, lrv: 0, lev, oav, journalId: e.id })
      wo.settledOn = on
      wo.settlementId = id
      wo.activity.push(A(on, "Cost accountant", `Settlement ${id} posted (#32); WIP 0.00; Completed → Closed (TECO)`))
    }
    settlements.push(st)
  }
  settle("SET-TBD-0301", "2026-08-14", "USR-TBD-011", ["WO-TBD-0301"])
  settle("SET-TBD-0930", "2026-09-30", "USR-TBD-011", ["WO-2026-00385", "WO-2026-00386", "WO-2026-00387", "WO-2026-00390"])

  // ------------------------------------------------------------------ rework orders
  const reworkOrders: PPReworkOrder[] = [
    {
      id: "RWO-TBD-0012", title: "Rework: inspect and reseal returned bushing", origin: { type: "rma", id: "RMA-TBD-0012" }, originKind: "RMA warranty", receiver: "2610 Warranty Reserve (overflow 6300)", status: "Open",
      itemId: "RAW-TBD-BSH145", serial: "SN-TBD-BSH-0302", qty: 1, reinspection: "required", laborRate: 65,
      ops: [
        { no: 10, workCenterId: "WC-400", text: "Inspect flange seal, record leak path", hours: 3, done: false },
        { no: 20, workCenterId: "WC-400", text: "Replace flange gasket, reseal, torque per WI", hours: 4, done: false },
        { no: 30, workCenterId: "WC-500", text: "Re-test: power factor and capacitance, leak test", hours: 2.5, done: false },
      ],
      materials: [], createdOn: "2026-10-05",
      activity: [A("2026-10-05", "Quality engineer", "Created from RMA-TBD-0012 disposition Repair (RC3 warranty). Receiver 2610 Warranty Reserve; settles with #21.")],
    },
    {
      id: "RWO-2026-0031", title: "Rework one LV coil: foil edge burr", origin: { type: "productionOrder", id: "WO-2026-00411" }, originKind: "Production rework", parentWoId: "WO-2026-00411", originOp: 20, receiver: "Parent WO-2026-00411 (costs merge before its settlement)", status: "In Progress",
      itemId: "FIN-TBD-1000PM", qty: 1, reinspection: "not required", laborRate: 63,
      ops: [{ no: 10, workCenterId: "WC-200", text: "Deburr foil edge, re-insulate layer 4", hours: 2, done: true }, { no: 20, workCenterId: "WC-200", text: "Re-measure resistance", hours: 0.5, done: false }],
      materials: [{ materialId: "RAW-TBD-KRAFT", qty: 6, value: 51.6, lot: "BAT-TBD-K0305" }], createdOn: "2026-10-07",
      activity: [A("2026-10-07", "Operator", "Created from op 20 confirmation: rework qty 1 (PP-SFT-001)"), A("2026-10-08", "Production supervisor", "Open → In Progress")],
    },
    {
      id: "RWO-2026-0029", title: "Test failure: ratio test out of limits on unit 2", origin: { type: "productionOrder", id: "WO-2026-00406" }, originKind: "Test failure", parentWoId: "WO-2026-00406", originOp: 100, receiver: "Parent WO-2026-00406 (costs merge before its settlement)", status: "Completed",
      itemId: "FIN-TBD-1000PM", serial: "SN-TBD-10P-0406-02", qty: 1, reinspection: "required", reinspectionResult: "Passed", laborRate: 66,
      ops: [{ no: 10, workCenterId: "WC-310", text: "Untank, correct tap lead on position 3", hours: 6, done: true }, { no: 20, workCenterId: "WC-500", text: "Repeat ratio and resistance tests", hours: 2, done: true }],
      materials: [{ materialId: "RAW-TBD-OIL", qty: 240, value: 460.8, lot: "BAT-TBD-O1440" }], createdOn: "2026-10-02",
      activity: [A("2026-10-02", "Test technician", "Created from Final Test failure disposition (QM-FIN-001)"), A("2026-10-05", "Production supervisor", "Open → In Progress"), A("2026-10-07", "Inspector", "Re-inspection passed"), A("2026-10-07", "Production supervisor", "In Progress → Completed")],
    },
    {
      id: "RWO-2026-0033", title: "Rewind HV coil phase B (NCR-TBD-0047)", origin: { type: "ncr", id: "NCR-TBD-0047" }, originKind: "NCR disposition", parentWoId: "WO-2026-00400", originOp: 40, receiver: "Parent WO-2026-00400 (production-caused)", status: "Open",
      itemId: "FIN-TBD-1000PM", qty: 1, reinspection: "not required", laborRate: 66,
      ops: [{ no: 10, workCenterId: "WC-210", text: "Strip and rewind HV coil phase B", hours: 9, done: false }],
      materials: [], createdOn: "2026-10-08",
      activity: [A("2026-10-08", "Quality engineer", "Created from NCR-TBD-0047 disposition Rework")],
    },
    {
      id: "RWO-2026-0024", title: "Replace cracked LV bushing insulator (vendor-caused)", origin: { type: "ncr", id: "NCR-TBD-0039" }, originKind: "NCR vendor-caused", receiver: "5320 Scrap and Waste (no recovery agreement with VEN-TBD-0112)", status: "Settled",
      itemId: "RAW-TBD-BSH015", qty: 2, reinspection: "not required", laborRate: 65,
      ops: [{ no: 10, workCenterId: "WC-400", text: "Replace insulator, re-torque", hours: 3, done: true }],
      materials: [{ materialId: "RAW-TBD-BSH015", qty: 2, value: 2480, lot: "BAT-TBD-L0988" }], createdOn: "2026-09-08", settledOn: "2026-09-16",
      activity: [A("2026-09-08", "Quality engineer", "Created from NCR-TBD-0039 disposition Rework"), A("2026-09-12", "Production supervisor", "Completed"), A("2026-09-16", "Cost accountant", "Settled to 5320 (no vendor recovery agreement)")],
    },
    {
      id: "RWO-2026-0027", title: "Billable repair: customer-damaged radiator panel", origin: { type: "rma", id: "RMA-TBD-0009" }, originKind: "RMA billable", receiver: "5130 COGS-Service; service invoice 4150", status: "Settled",
      itemId: "FIN-TBD-2500PM", serial: "SN-TBD-25P-0371-02", qty: 1, reinspection: "required", reinspectionResult: "Passed", laborRate: 58,
      ops: [{ no: 10, workCenterId: "WC-050", text: "Replace radiator panel, leak test", hours: 7, done: true }, { no: 20, workCenterId: "WC-500", text: "Routine re-test", hours: 1.5, done: true }],
      materials: [{ materialId: "RAW-TBD-RAD", qty: 1, value: 2380, lot: "BAT-TBD-R0230" }], createdOn: "2026-09-14", settledOn: "2026-09-29",
      activity: [A("2026-09-14", "Customer Service Manager", "Created from RMA-TBD-0009 disposition Repair (billable)"), A("2026-09-25", "Inspector", "Re-inspection passed"), A("2026-09-29", "Cost accountant", "Settled with #22")],
    },
  ]
  for (const r of reworkOrders) {
    const src = { type: "reworkOrder" as const, id: r.id }
    for (const o of r.ops.filter((o) => o.done)) je("RWK", o.hours * r.laborRate, r.createdOn, src, `Rework op ${o.no} ${o.workCenterId}: ${o.hours} h collected in 1325`, 0, o.hours * r.laborRate)
    for (const m of r.materials) je("RWK", m.value, r.createdOn, src, `Rework material ${m.materialId} × ${m.qty} (${m.lot}) collected in 1325`, 0, m.value)
    if (r.status === "Settled") {
      const bal = journal.filter((j) => j.source.id === r.id).reduce((a, j) => a + j.wip1325, 0)
      je(r.originKind === "RMA billable" ? 22 : 33, bal, r.settledOn!, src, r.originKind === "RMA billable" ? "RWO close: cost to 5130 COGS-Service; service invoice raised" : "RWO close: vendor-caused, no recovery agreement: to 5320", 0, -bal)
    }
  }

  // ------------------------------------------------------------------ component stock snapshot (reservation view)
  const batches: CompBatch[] = [
    { id: "BAT-TBD-C2611", materialId: "RAW-TBD-CRGO23", stock: "Unrestricted", qty: 31500, bin: "BIN-A-0102", receivedOn: "2026-08-19", vendorBatch: "NS-26-7781" },
    { id: "BAT-TBD-C2614", materialId: "RAW-TBD-CRGO23", stock: "Unrestricted", qty: 22000, bin: "BIN-A-0104", receivedOn: "2026-09-21", vendorBatch: "NS-26-8020" },
    { id: "BAT-TBD-C2602", materialId: "RAW-TBD-CRGO23", stock: "QI Hold", qty: 18000, bin: "BIN-Q-0001", receivedOn: "2026-10-07", vendorBatch: "NS-26-8188" },
    { id: "BAT-TBD-U0912", materialId: "RAW-TBD-CTC", stock: "Unrestricted", qty: 6800, bin: "BIN-B-0210", receivedOn: "2026-09-02" },
    { id: "BAT-TBD-F0877", materialId: "RAW-TBD-FOIL", stock: "Unrestricted", qty: 1900, bin: "BIN-B-0301", receivedOn: "2026-08-28" },
    { id: "BAT-TBD-F0881", materialId: "RAW-TBD-FOIL", stock: "Unrestricted", qty: 1100, bin: "BIN-B-0302", receivedOn: "2026-09-24" },
    { id: "BAT-TBD-O1440", materialId: "RAW-TBD-OIL", stock: "Unrestricted", qty: 62000, bin: "TANK-OIL-2", receivedOn: "2026-09-15" },
    { id: "BAT-TBD-K0305", materialId: "RAW-TBD-KRAFT", stock: "Unrestricted", qty: 3100, bin: "BIN-C-0110", receivedOn: "2026-07-30" },
    { id: "BAT-TBD-K0298", materialId: "RAW-TBD-KRAFT", stock: "Unrestricted", qty: 450, bin: "BIN-C-0108", receivedOn: "2026-06-11" },
    { id: "BAT-TBD-P0418", materialId: "RAW-TBD-PLATE", stock: "Unrestricted", qty: 40000, bin: "YARD-P-04", receivedOn: "2026-09-09" },
    { id: "BAT-TBD-R0230", materialId: "RAW-TBD-RAD", stock: "Unrestricted", qty: 36, bin: "YARD-R-02", receivedOn: "2026-09-18" },
    { id: "BAT-TBD-L1101", materialId: "RAW-TBD-BSH015", stock: "Unrestricted", qty: 6, bin: "BIN-D-0402", receivedOn: "2026-09-29", vendorBatch: "HP-26-0577" },
    { id: "BAT-TBD-L1120", materialId: "RAW-TBD-BSH015", stock: "Unrestricted", qty: 6, bin: "BIN-D-0403", receivedOn: "2026-10-06", vendorBatch: "HP-26-0601" },
    { id: "BAT-TBD-S0012", materialId: "PACK-TBD-SKID", stock: "Unrestricted", qty: 14, bin: "YARD-K-01", receivedOn: "2026-09-03" },
    { id: "BAT-TBD-S0031", materialId: "PACK-TBD-CRATE", stock: "Unrestricted", qty: 30, bin: "YARD-K-02", receivedOn: "2026-09-03" },
    { id: "BAT-TBD-L0988", materialId: "RAW-TBD-BSH015", stock: "Quarantine", qty: 4, bin: "BIN-Q-0007", receivedOn: "2026-08-21", vendorBatch: "TS-26-0102" },
    { id: "BAT-TBD-B0301", materialId: "RAW-TBD-BSH145", stock: "Blocked", qty: 6, bin: "BIN-D-0410", receivedOn: "2026-05-04", vendorBatch: "HP-26-0412" },
    { id: "BAT-TBD-B0322", materialId: "RAW-TBD-BSH145", stock: "Unrestricted", qty: 4, bin: "BIN-D-0411", receivedOn: "2026-09-30", vendorBatch: "HP-26-0590" },
    { id: "BAT-TBD-T0090", materialId: "CONS-TBD-PAINT", stock: "Unrestricted", qty: 520, bin: "PAINT-01", receivedOn: "2026-09-01" },
    { id: "BAT-TBD-U0931", materialId: "RAW-TBD-CTC", stock: "Unrestricted", qty: 4000, bin: "BIN-B-0212", receivedOn: "2026-10-06" },
    { id: "BAT-TBD-T0102", materialId: "CONS-TBD-PAINT", stock: "Unrestricted", qty: 400, bin: "PAINT-02", receivedOn: "2026-10-05" },
    { id: "BAT-TBD-W0311", materialId: "CONS-TBD-WELD", stock: "Unrestricted", qty: 900, bin: "BIN-E-0101", receivedOn: "2026-09-12" },
  ]
  const serials: CompSerial[] = [
    ...["0301", "0303"].map((n) => ({ id: `SN-TBD-BSH-${n}` as SerialNo, materialId: "RAW-TBD-BSH145" as MaterialId, batchId: "BAT-TBD-B0301" as const, status: "Shipped" as const, woId: "WO-TBD-0301" as const, parent: "SN-TBD-20M-0301" })),
    { id: "SN-TBD-BSH-0302", materialId: "RAW-TBD-BSH145", batchId: "BAT-TBD-B0301", status: "QI Hold", woId: "WO-TBD-0301", parent: undefined },
    ...["0304", "0305", "0306", "0307", "0308", "0309"].map((n) => ({ id: `SN-TBD-BSH-${n}` as SerialNo, materialId: "RAW-TBD-BSH145" as MaterialId, batchId: "BAT-TBD-B0301" as const, status: "Reserved" as const })),
    ...["0322", "0323", "0324", "0325"].map((n) => ({ id: `SN-TBD-BSH-${n}` as SerialNo, materialId: "RAW-TBD-BSH145" as MaterialId, batchId: "BAT-TBD-B0322" as const, status: "Available" as const })),
    { id: "SN-TBD-OLTC-0301", materialId: "RAW-TBD-OLTC", status: "Shipped", woId: "WO-TBD-0301", parent: "SN-TBD-20M-0301" },
    ...["1101", "1102", "1103", "1104", "1105", "1106"].map((n, i) => ({ id: `SN-TBD-B15-${n}` as SerialNo, materialId: "RAW-TBD-BSH015" as MaterialId, batchId: "BAT-TBD-L1101" as const, status: "Reserved" as CompSerial["status"], woId: i < 3 ? ("WO-2026-00396" as const) : ("WO-2026-00404" as const) })),
    ...["1201", "1202", "1203", "1204", "1205", "1206"].map((n) => ({ id: `SN-TBD-B15-${n}` as SerialNo, materialId: "RAW-TBD-BSH015" as MaterialId, batchId: "BAT-TBD-L1120" as const, status: "Available" as CompSerial["status"] })),
  ]
  // issued serials on other orders (from the confirmations above)
  for (const wo of productionOrders)
    for (const o of wo.operations)
      for (const c of o.components.filter((c) => c.serialized && c.issued > 0))
        for (const lot of c.lots) if (!serials.some((x) => x.id === lot)) serials.push({ id: lot as SerialNo, materialId: c.materialId, status: wo.status === "Closed (TECO)" || wo.status === "Completed" ? "Shipped" : "In Production", woId: wo.id, parent: wo.serials[0] })

  // ------------------------------------------------------------------ schedule: finite plan from today
  // Due dates [DOC:p.74 §5.1]: pegged orders work back from the promise less staging; stock orders keep
  // the finish of a first forward pass as their due date (design). Then the default backward schedule.
  const s0 = { productionOrders, workCenters: OWN_WORK_CENTERS, wc }
  applySchedule(productionOrders, schedule(s0, {}))
  for (const w of productionOrders.filter((w) => OPEN_STATES.has(w.status))) w.dueDate = w.promiseDate ? addWorkdays(w.promiseDate, -SHIP_PREP_DAYS) : w.finish
  // finished and cancelled orders keep the due date they carried (same derivation; not rescheduled)
  for (const w of productionOrders.filter((w) => !w.dueDate)) w.dueDate = w.promiseDate ? addWorkdays(w.promiseDate, -SHIP_PREP_DAYS) : w.finish
  let r = schedule(s0, {})
  applySchedule(productionOrders, r)
  if (escalateLate(productionOrders, r, TODAY as ISODate).length) {
    r = schedule(s0, {})
    applySchedule(productionOrders, r)
  }
  // dispatch sequence per work center, by op start then priority
  const byWc = new Map<string, PPOperation[]>()
  for (const wo of productionOrders.filter((w) => OPEN_STATES.has(w.status)))
    for (const o of wo.operations.filter((o) => o.status !== "Completed")) byWc.set(o.workCenterId, [...(byWc.get(o.workCenterId) ?? []), Object.assign(o, { __p: wo.priority }) as PPOperation])
  for (const ops of byWc.values()) ops.sort((a, b) => a.start.localeCompare(b.start) || ((a as unknown as { __p: number }).__p - (b as unknown as { __p: number }).__p)).forEach((o, i) => {
    o.sequence = i + 1
    delete (o as unknown as { __p?: number }).__p
  })
  // staging: next ops at the work center within 3 working days have their kit staged
  for (const wo of productionOrders.filter((w) => w.status === "In Progress" || w.status === "Released" || w.status === "Testing"))
    for (const o of wo.operations.filter((o) => o.status === "Not Started")) o.staged = o.start <= addWorkdays(TODAY, 2) && !(wo.id === "WO-2026-00415")
  // crews
  const assign = (woId: string, no: number, ids: `USR-${string}`[]) => {
    const o = productionOrders.find((w) => w.id === woId)?.operations.find((x) => x.no === no)
    if (o) o.crewIds = ids
  }
  assign("WO-2026-00396", 100, ["USR-TBD-032", "USR-TBD-031"])
  assign("WO-2026-00411", 30, ["USR-TBD-033"])
  assign("WO-2026-00389", 80, ["USR-TBD-031"])
  // andon on one running operation
  const andonOp = productionOrders.find((w) => w.id === "WO-2026-00411")!.operations.find((o) => o.status === "In Progress")
  if (andonOp) andonOp.andon = { reason: "Machine down: foil winder tension fault", at: `${TODAY}T07:42:00`, by: "Miguel Santos" }
  // Testing orders: final-test inspection requested
  const publishes: SchedulePublish[] = [
    { snapshotId: "SNP-TBD-0038", publishedOn: "2026-09-28T16:05:00", by: "Fatima Haddad", moves: 6, note: "Weekly publish; SO-2026-00377 promise referenced", dates: {} },
    { snapshotId: "SNP-TBD-0041", publishedOn: "2026-10-05T16:10:00", by: "Fatima Haddad", moves: 9, note: "Weekly publish; WC-600 maintenance window entered", dates: {} },
  ]
  publishes[1].dates = Object.fromEntries(Object.entries(r.dates))

  // warehouse tasks: next-op staging signals (SP-09 kit delivery)
  const warehouseTasks: PPWarehouseTask[] = []
  let wtSeq = 600
  const tStatuses: PPWarehouseTask["status"][] = ["Queued", "Assigned", "In Progress", "Done/Exception"]
  for (const wo of productionOrders.filter((w) => w.status === "In Progress" || w.status === "Released")) {
    const next = wo.operations.find((o) => o.status === "Not Started" && o.components.length)
    if (!next) continue
    const st = tStatuses[wtSeq % 4]
    warehouseTasks.push({ id: `WT-TBD-0${++wtSeq}`, type: "Pick", status: next.staged ? "Done/Exception" : st === "Done/Exception" ? "Queued" : st, assigneeId: st === "Queued" ? undefined : "USR-TBD-018", device: "TC77-07", doc: { type: "productionOrder", id: wo.id }, woId: wo.id, op: next.no, text: `Stage kit for op ${next.no} at ${next.workCenterId}: ${next.components.map((c) => c.materialId).join(", ")}`, created: addWorkdays(TODAY, -1) })
  }

  // ------------------------------------------------------------------ MRP runs, planned orders, exceptions
  const mrpRuns: MrpRun[] = [
    ["MRP-TBD-1009", "2026-10-09T01:00:00", 22, 41, 31],
    ["MRP-TBD-1008", "2026-10-08T01:00:00", 21, 39, 29],
    ["MRP-TBD-1007", "2026-10-07T01:00:00", 24, 44, 33],
    ["MRP-TBD-1006", "2026-10-06T01:00:00", 23, 43, 30],
    ["MRP-TBD-1005", "2026-10-05T01:00:00", 19, 36, 27],
    ["MRP-TBD-1002", "2026-10-02T01:00:00", 26, 47, 35],
  ].map(([id, at, min, plo, ex], i) => ({ id: id as MrpRun["id"], kind: "Regenerative (nightly)" as const, scope: "Plant PL-TBD-01, all items", startedAt: at as string, minutes: min as number, snapshotId: `INS-SNAP-${String(at).slice(0, 10).replaceAll("-", "")}-01`, plannedOrders: plo as number, exceptions: ex as number, by: "System (nightly)", published: true, ...(i === 3 ? { kind: "Net change (on demand)" as const, scope: "Item FIN-TBD-20MVA (SO-2026-00377 confirmed)", by: "Sarah Bjornson", startedAt: "2026-10-06T10:14:00", minutes: 2 } : {}) }))

  const P = (id: string, materialId: MaterialId, qty: number, kind: "make" | "buy", state: PPPlannedOrder["state"], start: ISODate, finish: ISODate, runId: string, extra: Partial<PPPlannedOrder> = {}): PPPlannedOrder => ({
    id: id as PPPlannedOrder["id"], materialId, qty, kind, start, finish, mrpRunId: runId as PPPlannedOrder["mrpRunId"], firmed: state === "Firmed", state, mbomActive: true, routingReleased: true,
    activity: [A(runId === "MRP-TBD-1006" ? "2026-10-06" : "2026-10-09", "System", `Proposed by ${runId}`)], ...extra,
  })
  const plannedOrders: PPPlannedOrder[] = [
    P("PLO-TBD-0377", "FIN-TBD-20MVA", 3, "make", "Firmed", "2026-11-30", "2027-03-05", "MRP-TBD-1006", {
      peg: { soId: "SO-2026-00377", line: 10, sched: 10 }, mbomActive: false, routingReleased: false, ebomId: "EBOM-TBD-0377", mbomId: "MBOM-TBD-0377",
      activity: [A("2026-10-06", "System", "Proposed by MRP-TBD-1006 (net change after SO-2026-00377 confirmation); pegged line 10 schedule 10"), A("2026-10-06", "Planner", "Firmed: date and quantity locked; survives the next regenerative run"), A("2026-10-06", "System", "EX-07: MBOM for phase 2 not active (EBOM-TBD-0377 Draft); routing rev C Draft")],
    }),
    P("PLO-TBD-0379", "RAW-TBD-OLTC", 3, "buy", "Proposed", "2026-10-19", "2027-01-15", "MRP-TBD-1009", { peg: { soId: "SO-2026-00377", line: 10, sched: 10 }, vendorHint: "VEN-TBD-0103 Rheinwerk Tap Changers (AVL rank 1)" }),
    P("PLO-TBD-0380", "RAW-TBD-BSH145", 9, "buy", "Proposed", "2026-10-19", "2027-01-29", "MRP-TBD-1009", { peg: { soId: "SO-2026-00377", line: 10, sched: 10 }, vendorHint: "VEN-TBD-0104 Hanseong (AVL Conditional, FAI-TBD-0031 open)" }),
    P("PLO-TBD-0401", "FIN-TBD-2500PM", 4, "make", "Proposed", "2026-10-26", "2026-11-13", "MRP-TBD-1009"),
    P("PLO-TBD-0402", "FIN-TBD-1000PM", 6, "make", "Firmed", "2026-10-19", "2026-11-06", "MRP-TBD-1008", { activity: [A("2026-10-08", "System", "Proposed by MRP-TBD-1008"), A("2026-10-08", "Planner", "Firmed")] }),
    P("PLO-TBD-0403", "FIN-TBD-0167PL", 25, "make", "Proposed", "2026-10-21", "2026-11-04", "MRP-TBD-1009"),
    P("PLO-TBD-0404", "FIN-TBD-5000SS", 1, "make", "Proposed", "2026-11-02", "2026-12-04", "MRP-TBD-1009"),
    P("PLO-TBD-0405", "FIN-TBD-0167PL", 12, "make", "Converted", "2026-10-12", "2026-10-23", "MRP-TBD-1007", { convertedTo: "WO-2026-00413", activity: [A("2026-10-07", "Planner", "Converted to WO-2026-00413; run ID MRP-TBD-1007 logged")] }),
    P("PLO-TBD-0406", "FIN-TBD-2500PM", 2, "make", "Converted", "2026-10-13", "2026-10-30", "MRP-TBD-1008", { convertedTo: "WO-2026-00414", activity: [A("2026-10-08", "Planner", "Converted to WO-2026-00414; run ID MRP-TBD-1008 logged")] }),
    P("PLO-TBD-0407", "FIN-TBD-1000PM", 4, "make", "Converted", "2026-10-05", "2026-10-23", "MRP-TBD-1005", { convertedTo: "WO-2026-00415", activity: [A("2026-10-02", "Planner", "Converted to WO-2026-00415; run ID MRP-TBD-1002 logged")] }),
    P("PLO-TBD-0408", "FIN-TBD-0167PL", 15, "make", "Converted", "2026-10-06", "2026-10-20", "MRP-TBD-1005", { convertedTo: "WO-2026-00416", activity: [A("2026-10-05", "Planner", "Converted to WO-2026-00416; run ID MRP-TBD-1005 logged")] }),
    P("PLO-TBD-0409", "FIN-TBD-5000SS", 1, "make", "Converted", "2026-10-19", "2026-11-20", "MRP-TBD-1008", { convertedTo: "WO-2026-00417", activity: [A("2026-10-08", "Planner", "Converted to WO-2026-00417; run ID MRP-TBD-1008 logged")] }),
    P("PLO-TBD-0410", "FIN-TBD-7500MTO", 1, "make", "Converted", "2026-10-12", "2026-11-25", "MRP-TBD-1007", { peg: { soId: "SO-2026-00402", line: 10, sched: 10 }, convertedTo: "WO-2026-00402", activity: [A("2026-10-07", "Planner", "Converted to WO-2026-00402; pegs preserved; run ID MRP-TBD-1007 logged")] }),
    P("PLO-TBD-0411", "FIN-TBD-2500PM", 3, "make", "Cancelled", "2026-11-09", "2026-11-27", "MRP-TBD-1007", { cancelReason: "EX-04 excess: supply exceeds demand horizon", activity: [A("2026-10-07", "Planner", "Cancelled proposal (EX-04 excess)")] }),
    P("PLO-TBD-0412", "SEMI-TBD-CORE25", 4, "make", "Proposed", "2026-10-26", "2026-11-06", "MRP-TBD-1009", { mbomActive: false, routingReleased: false }),
    P("PLO-TBD-0413", "SEMI-TBD-TANK20", 3, "make", "Proposed", "2026-12-07", "2027-01-22", "MRP-TBD-1009", { peg: { soId: "SO-2026-00377", line: 10, sched: 10 }, routingReleased: false, mbomActive: false, ebomId: "EBOM-TBD-0377", mbomId: "MBOM-TBD-0377" }),
    P("PLO-TBD-0420", "RAW-TBD-FOIL", 4000, "buy", "Proposed", "2026-10-12", "2026-10-30", "MRP-TBD-1009", { vendorHint: "VEN-TBD-0102 Keystone Copper Conductors" }),
    P("PLO-TBD-0421", "RAW-TBD-CTC", 3000, "buy", "Firmed", "2026-10-12", "2026-11-13", "MRP-TBD-1008", { vendorHint: "VEN-TBD-0102 Keystone Copper Conductors" }),
    P("PLO-TBD-0422", "RAW-TBD-OIL", 40000, "buy", "Proposed", "2026-10-19", "2026-11-02", "MRP-TBD-1009", { vendorHint: "VEN-TBD-0105 Great Lakes Dielectric Oils (contract)" }),
    P("PLO-TBD-0423", "RAW-TBD-BSH015", 12, "buy", "Proposed", "2026-10-12", "2026-11-20", "MRP-TBD-1009", { vendorHint: "VEN-TBD-0104 Hanseong (AVL rank 2; rank 1 Suspended)" }),
    P("PLO-TBD-0424", "RAW-TBD-RAD", 24, "buy", "Converted", "2026-10-05", "2026-10-26", "MRP-TBD-1005", { convertedTo: "PR-TBD-0424", vendorHint: "VEN-TBD-0108 Heartland Radiator Works", activity: [A("2026-10-05", "Planner", "Converted to PR-TBD-0424 (grouped by vendor); run ID MRP-TBD-1005 logged")] }),
    P("PLO-TBD-0425", "CONS-TBD-PAINT", 400, "buy", "Proposed", "2026-10-12", "2026-10-23", "MRP-TBD-1009"),
    P("PLO-TBD-0426", "PACK-TBD-SKID", 6, "buy", "Proposed", "2026-10-12", "2026-10-16", "MRP-TBD-1009", { vendorHint: "VEN-TBD-0109 Cascade Crate & Pallet" }),
    P("PLO-TBD-0427", "RAW-TBD-KRAFT", 1200, "buy", "Cancelled", "2026-10-19", "2026-11-09", "MRP-TBD-1007", { cancelReason: "EX-04 excess after WO-2026-00392 cancellation", activity: [A("2026-10-07", "Planner", "Cancelled proposal (EX-04 excess)")] }),
    P("PLO-TBD-0428", "RAW-TBD-PLATE", 18000, "buy", "Proposed", "2026-11-02", "2026-11-23", "MRP-TBD-1009", { peg: { soId: "SO-2026-00377", line: 10, sched: 10 }, vendorHint: "VEN-TBD-0106 Prairie Plate & Fab" }),
  ]

  let exSeq = 300
  const X = (code: MrpException["code"], itemId: MaterialId, needDate: ISODate, qty: number, raisedOn: ISODate, detail: string, extra: Partial<MrpException> = {}): MrpException => ({
    id: `EXC-TBD-${++exSeq}`, code, runId: "MRP-TBD-1009", itemId, needDate, qty, raisedOn, detail, buy: (MATERIALS.find((m) => m.id === itemId)?.type ?? "RAW") !== "FIN" && (MATERIALS.find((m) => m.id === itemId)?.type ?? "RAW") !== "SEMI", ...extra,
  })
  const exceptions: MrpException[] = [
    X("EX-07", "FIN-TBD-20MVA", "2026-11-30", 3, "2026-10-06", "MBOM for phase 2 not active: EBOM-TBD-0377 is Draft; routing RTG-TBD-20MVA rev C is Draft", { peg: { soId: "SO-2026-00377", line: 10, sched: 10 }, supply: { type: "plannedOrder", id: "PLO-TBD-0377" }, runId: "MRP-TBD-1006" }),
    X("EX-07", "SEMI-TBD-CORE25", "2026-10-26", 4, "2026-10-08", "Make item in Data Completion; routing RTG-TBD-CORE25 rev A is Draft", { supply: { type: "plannedOrder", id: "PLO-TBD-0412" } }),
    X("EX-07", "SEMI-TBD-TANK20", "2026-12-07", 3, "2026-10-09", "Routing RTG-TBD-TANK20 rev A In Review, not Released", { supply: { type: "plannedOrder", id: "PLO-TBD-0413" }, peg: { soId: "SO-2026-00377", line: 10, sched: 10 } }),
    X("EX-01", "RAW-TBD-FOIL", "2026-10-12", 2140, "2026-10-07", "WO-2026-00413 needs 540 kg and WO-2026-00410 1,280 kg beyond on-hand 1,900 kg; no supply on date", { supply: { type: "plannedOrder", id: "PLO-TBD-0420" } }),
    X("EX-01", "FIN-TBD-5000SS", "2026-11-20", 1, "2026-10-09", "Stock falls to zero on Nov 20 after SO-2026-00394 and QT-TBD-0425-V1 demand", { supply: { type: "plannedOrder", id: "PLO-TBD-0404" } }),
    X("EX-01", "RAW-TBD-BSH145", "2027-01-11", 9, "2026-10-08", "Phase 2 needs 9 HV bushings; 6 reserved bushings in BAT-TBD-B0301 are Blocked by RCL-2026-001", { peg: { soId: "SO-2026-00377", line: 10, sched: 10 }, supply: { type: "plannedOrder", id: "PLO-TBD-0380" } }),
    X("EX-02", "RAW-TBD-CRGO23", "2026-11-23", 54000, "2026-10-06", "PO-TBD-0377 CRGO confirmed Dec 14; needed Nov 23 for phase 2 core cutting", { supply: { type: "purchaseOrder", id: "PO-TBD-0377" }, supplyDate: "2026-12-14", peg: { soId: "SO-2026-00377", line: 10, sched: 10 } }),
    X("EX-02", "RAW-TBD-CTC", "2026-10-26", 1300, "2026-10-08", "PO-TBD-0398 line 10 confirmed Nov 6; WO-2026-00402 op 30 needs it Oct 26", { supplyDate: "2026-11-06" }),
    X("EX-02", "RAW-TBD-RAD", "2026-10-21", 8, "2026-10-09", "PR-TBD-0424 not yet ordered; WO-2026-00404 op 100 needs Oct 21", { supply: { type: "requisition", id: "PR-TBD-0424" }, supplyDate: "2026-10-26" }),
    X("EX-03", "RAW-TBD-OIL", "2026-11-16", 20000, "2026-10-08", "Oil delivery Oct 19 is four weeks ahead of the next fill", { supplyDate: "2026-10-19" }),
    X("EX-03", "FIN-TBD-2500PM", "2026-11-27", 4, "2026-10-09", "WO-2026-00410 completes Oct 30; demand not until Nov 27", { buy: false, supply: { type: "productionOrder", id: "WO-2026-00410" }, supplyDate: "2026-10-30" }),
    X("EX-04", "FIN-TBD-0167PL", "2026-12-31", 15, "2026-10-09", "WO-2026-00416 plus PLO-TBD-0403 exceed demand in the horizon by 15 units", { supply: { type: "plannedOrder", id: "PLO-TBD-0403" } }),
    X("EX-04", "RAW-TBD-KRAFT", "2026-12-31", 1200, "2026-10-07", "Excess after WO-2026-00392 cancellation", { supply: { type: "plannedOrder", id: "PLO-TBD-0427" }, resolved: { action: "Cancel proposal", by: "Sarah Bjornson", on: "2026-10-07" } }),
    X("EX-05", "FIN-TBD-2500PM", "2026-10-26", 4, "2026-10-05", "Projected stock 1 below safety stock 4 from Oct 26", { supply: { type: "plannedOrder", id: "PLO-TBD-0401" } }),
    X("EX-05", "RAW-TBD-BSH015", "2026-10-19", 12, "2026-10-08", "Below safety stock 8 after WO-2026-00396 and WO-2026-00404 issues", { supply: { type: "plannedOrder", id: "PLO-TBD-0423" } }),
    X("EX-05", "SPARE-TBD-GSKT20", "2026-10-15", 10, "2026-10-02", "Service stock below safety stock 10", { buy: true, resolved: { action: "Raise supply proposal", by: "Sarah Bjornson", on: "2026-10-03" } }),
    X("EX-06", "RAW-TBD-CTC", "2026-10-02", 1000, "2026-10-03", "PO-TBD-0381 line 20 was due Oct 2; not received", { supplyDate: "2026-10-02" }),
    X("EX-06", "PACK-TBD-CRATE", "2026-10-05", 20, "2026-10-06", "PO-TBD-0390 crates due Oct 5; not received", { supplyDate: "2026-10-05" }),
    X("EX-08", "PACK-TBD-SKID", "2026-10-14", 6, "2026-10-09", "New requirement inside the 5-day planning fence; proposal not auto-applied", { supply: { type: "plannedOrder", id: "PLO-TBD-0426" } }),
    X("EX-08", "FIN-TBD-1000PM", "2026-10-15", 2, "2026-10-09", "WO-2026-00411 quantity change inside the fence; not auto-applied", { buy: false, supply: { type: "productionOrder", id: "WO-2026-00411" } }),
    X("EX-09", "CONS-TBD-PAINT", "2026-10-23", 400, "2026-10-07", "No valid source: Coastal Coatings Ltd. Disqualified; no other AVL row or info record", { supply: { type: "plannedOrder", id: "PLO-TBD-0425" } }),
    X("EX-09", "RAW-TBD-CT600", "2026-12-01", 9, "2026-10-09", "Material Draft; no info record or AVL row (VEN-TBD-0115 onboarding Draft)", { peg: { soId: "SO-2026-00377", line: 10, sched: 10 } }),
    X("EX-01", "RAW-TBD-OLTC", "2027-01-15", 3, "2026-10-06", "Phase 2 OLTCs: no supply; LLR-2026-0011 waits in WF-INBOX", { peg: { soId: "SO-2026-00377", line: 10, sched: 10 }, supply: { type: "plannedOrder", id: "PLO-TBD-0379" }, runId: "MRP-TBD-1006" }),
    X("EX-10", "RAW-TBD-FOIL", "2026-11-04", 1500, "2026-10-08", "Network demand at Fargo (PL-TBD-01) is sourced from Duluth (PL-TBD-03) over lane LN-TBD-02, which is inactive: the transfer proposal cannot be placed", { buy: false, runId: "MRP-TBD-1009" }),
    X("EX-10", "SEMI-TBD-CORE25", "2026-11-12", 4, "2026-10-09", "Supplying plant PL-TBD-03 has no valid production version for SEMI-TBD-CORE25 (routing RTG-TBD-CORE25 rev A is Draft)", { buy: false, runId: "MRP-TBD-1009" }),
    X("EX-06", "RAW-TBD-PLATE", "2026-10-01", 6000, "2026-10-02", "PO-TBD-0386 plate overdue", { supplyDate: "2026-10-01", resolved: { action: "Expedite / re-date", by: "Olivia Grant", on: "2026-10-03", note: "Vendor re-dated to Oct 12" } }),
  ]
  // aging spread: older raised dates on a few
  exceptions[6].raisedOn = "2026-09-29"

  // ------------------------------------------------------------------ promises (CTP) and at-risk
  const promises: PromiseCandidate[] = [
    { id: "CTP-TBD-0402", doc: { type: "salesOrder", id: "SO-2026-00402" }, line: 10, customerId: "CUS-TBD-0027", itemId: "FIN-TBD-7500MTO", qty: 1, orderType: "MTO", requestedDate: "2026-11-30", decision: "Result ready",
      result: { ranOn: "2026-10-06T14:22:00", ms: 3400, materialDate: "2026-10-26", completion: "2026-12-15", shipDate: "2026-12-18", binding: "Test Lab (WC-500) weeks 47 to 49", bindingKind: "capacity", snapshotId: "SNP-TBD-0041", seeded: true,
        options: [{ label: "Overtime shift on WC-500 (planner decision)", shipDate: "2026-12-09", note: "Adds a Saturday shift in weeks 47-48" }, { label: "Requested date", shipDate: "2026-11-30", note: "Not feasible: Test Lab full in week 48" }] },
      log: [A("2026-10-06", "Sales rep", "CTP requested at order confirmation (MTO line 10)")] },
    { id: "CTP-TBD-0417", doc: { type: "quotation", id: "QT-TBD-0417-V1" }, line: 10, customerId: "CUS-TBD-0052", itemId: "FIN-TBD-20MVA", qty: 1, orderType: "ETO", requestedDate: "2027-05-28", decision: "Not checked",
      log: [A("2026-10-08", "Estimator", "Firm ETO quotation in Internal Review: needs a CTP result before it can be issued")] },
    { id: "CTP-TBD-0377", doc: { type: "salesOrder", id: "SO-2026-00377" }, line: 10, customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", qty: 3, orderType: "ETO", requestedDate: "2027-03-15", decision: "Accepted",
      result: { ranOn: "2026-06-12T10:05:00", ms: 6100, materialDate: "2026-11-23", completion: "2027-03-05", shipDate: "2027-03-15", binding: "HV bushing lead time 16 wks", bindingKind: "material", snapshotId: "SNP-TBD-0024", seeded: true, options: [] },
      reservation: { kind: "Firm", on: "2026-06-12", snapshotId: "SNP-TBD-0024" },
      log: [A("2026-06-12", "Sales rep", "Accepted Mar 15, 2027 (binding: HV bushing lead time 16 wks); SO confirmation converted the soft reservation to firm load")] },
    { id: "CTP-TBD-0389", doc: { type: "salesOrder", id: "SO-2026-00389" }, line: 10, customerId: "CUS-TBD-0052", itemId: "FIN-TBD-7500MTO", qty: 1, orderType: "MTO", requestedDate: "2026-11-20", decision: "Accepted",
      result: { ranOn: "2026-08-03T09:12:00", ms: 2900, materialDate: "2026-08-24", completion: "2026-11-13", shipDate: "2026-11-20", binding: "Requested date is feasible", bindingKind: "requested", snapshotId: "SNP-TBD-0031", seeded: true, options: [] },
      reservation: { kind: "Firm", on: "2026-08-03", snapshotId: "SNP-TBD-0031" },
      log: [A("2026-08-03", "Sales rep", "Accepted Nov 20, 2026; firm load at confirmation")] },
    { id: "CTP-TBD-0301", doc: { type: "salesOrder", id: "SO-2026-00301" }, line: 10, customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", qty: 1, orderType: "ETO", requestedDate: "2026-08-14", decision: "Accepted",
      result: { ranOn: "2025-12-10T11:40:00", ms: 5200, materialDate: "2026-05-04", completion: "2026-08-07", shipDate: "2026-08-11", binding: "OLTC lead time 20 wks", bindingKind: "material", snapshotId: "SNP-TBD-0002", seeded: true, options: [] },
      reservation: { kind: "Firm", on: "2026-01-08", snapshotId: "SNP-TBD-0002" },
      log: [A("2025-12-10", "Estimator", "CTP on QT-TBD-0301-V2 line 10: ship Aug 11, 2026"), A("2026-01-08", "System", "SO confirmation converted the soft reservation to firm load"), A("2026-08-11", "System", "Shipped on the promised date")] },
    { id: "CTP-TBD-0416", doc: { type: "quotation", id: "QT-TBD-0416-V1" }, line: 10, customerId: "CUS-TBD-0027", itemId: "FIN-TBD-7500MTO", qty: 1, orderType: "MTO", requestedDate: "2026-12-11", decision: "Declined",
      result: { ranOn: "2026-10-01T15:00:00", ms: 3100, materialDate: "2026-10-19", completion: "2027-01-08", shipDate: "2027-01-13", binding: "Test Lab (WC-500) weeks 48 to 50", bindingKind: "capacity", snapshotId: "SNP-TBD-0041", seeded: true, options: [] },
      log: [A("2026-10-01", "Sales rep", "Declined: customer needs mid-December; soft reservation released")] },
  ]

  const atRisk: AtRiskRecord[] = [
    { id: "ARK-TBD-0021", soId: "SO-2026-00389", line: 10, customerId: "CUS-TBD-0052", itemId: "FIN-TBD-7500MTO", woIds: ["WO-2026-00389"], promiseDate: "2026-11-20", projected: "2026-11-24", trigger: "WC outage inside its path", cause: "WC-600 Paint & Finishing in Maintenance to Oct 21; paint op queues behind three orders", raisedOn: "2026-10-06", state: "Open",
      options: [
        { id: "overtime", label: "Overtime shift on WC-600 after maintenance", projected: "2026-11-18", note: "Saturday shifts Oct 24 and 31; Production Scheduler books crew" },
        { id: "alternate", label: "Alternate work center", projected: "2026-11-24", note: "WC-600 has no alternate in its capacity model" },
        { id: "partial", label: "Partial ship", projected: "2026-11-24", note: "Single unit: not applicable" },
        { id: "repromise", label: "Re-promise through a sales change order", projected: "2026-11-27", note: "Customer notification per class policy; promise changes only through the change order path" },
      ], decisions: [A("2026-10-06", "System", "Revalidation: WC-600 status Active → Maintenance; projected completion beyond promise minus transit buffer")] },
    { id: "ARK-TBD-0022", soId: "SO-2026-00377", line: 10, customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", woIds: [], promiseDate: "2027-03-15", projected: "2027-04-02", trigger: "Supply slip on a pegged PO", cause: "PO-TBD-0377 CRGO confirmed Dec 14 vs needed Nov 23 (EX-02); 6 reserved HV bushings Blocked by RCL-2026-001", raisedOn: "2026-10-08", state: "Open",
      options: [
        { id: "overtime", label: "Overtime on core cutting and stacking (WC-100, WC-110)", projected: "2027-03-19", note: "Recovers about two weeks of the steel slip" },
        { id: "alternate", label: "Alternate work center for stacking", projected: "2027-03-24", note: "WC-110 has no alternate; WC-105 is Inactive" },
        { id: "partial", label: "Partial ship: 2 units Mar 15, 1 unit Apr 2", projected: "2027-03-15", note: "Customer no-partial flag is off for this order (design)" },
        { id: "repromise", label: "Re-promise through a sales change order", projected: "2027-04-02", note: "Needs reason, impact and customer notification" },
      ], decisions: [A("2026-10-08", "System", "Revalidation: supply slip on pegged PO-TBD-0377 and recall containment on BAT-TBD-B0301")] },
    { id: "ARK-TBD-0014", soId: "SO-2026-00301", line: 10, customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", woIds: ["WO-TBD-0301"], promiseDate: "2026-08-11", projected: "2026-08-13", trigger: "Schedule publish moved its operations", cause: "Publish SNP-TBD-0019 moved final test behind a type test in week 30", raisedOn: "2026-07-13", state: "Resolved",
      options: [{ id: "overtime", label: "Overtime shift on WC-500", projected: "2026-08-07", note: "Two Saturday shifts" }],
      decisions: [A("2026-07-13", "System", "Revalidation after publish SNP-TBD-0019"), A("2026-07-14", "Production Scheduler", "Recovery chosen: overtime shift on WC-500 (with Sales owner Dana Whitfield)"), A("2026-08-11", "System", "Shipped on promise; resolved")] },
    { id: "ARK-TBD-0019", soId: "SO-2026-00402", line: 10, customerId: "CUS-TBD-0027", itemId: "FIN-TBD-7500MTO", woIds: ["WO-2026-00402"], promiseDate: "2026-11-30", projected: "2026-12-18", trigger: "Schedule publish moved its operations", cause: "Requested date not yet promised: CTP result Dec 18 waits for a decision; Test Lab full in week 48", raisedOn: "2026-10-07", state: "Sales change order requested",
      options: [{ id: "repromise", label: "Re-promise through a sales change order", projected: "2026-12-18", note: "Sales owner informed" }],
      decisions: [A("2026-10-07", "System", "At-risk record from publish SNP-TBD-0041"), A("2026-10-08", "Production Scheduler", "Re-promise unavoidable: sales change order path triggered (reason: Test Lab capacity)")] },
  ]

  return {
    mrpRuns,
    exceptions,
    plannedOrders,
    workCenters: OWN_WORK_CENTERS,
    wc,
    routings,
    productionOrders,
    confirmations,
    reworkOrders,
    warehouseTasks,
    journal,
    settlements,
    genealogy,
    batches,
    serials,
    publishes,
    moves: [],
    sandbox: null,
    promises,
    atRisk,
    ncrs: [],
    offlineQueue: [],
    qualifications: QUALIFICATIONS,
    cvaExceptions: productionOrders
      .filter((w) => w.status !== "Created" && w.status !== "Cancelled" && MATERIALS.find((m) => m.id === w.itemId)?.stdCost == null)
      .map((w, i) => ({ id: `CVA-TBD-${String(301 + i).padStart(4, "0")}`, itemId: w.itemId, woId: w.id, raisedOn: w.createdOn, text: `${w.itemId} released on ${w.id} without a standard cost` })),
    seq: 500,
    ...extraSeed(),
  }
}


/** Operator qualification register (QAL-) seed: one expired record shows the SP-07 interlock. */
const QUALIFICATIONS: Qualification[] = [
  { id: "QAL-TBD-0101", userId: "USR-TBD-033", skill: "HV winding", level: 3, expires: "2027-06-30" },
  { id: "QAL-TBD-0102", userId: "USR-TBD-035", skill: "HV routine testing", level: 3, expires: "2027-03-31" },
  { id: "QAL-TBD-0103", userId: "USR-TBD-032", skill: "HV bushing installation", level: 2, expires: "2026-09-30" },
  { id: "QAL-TBD-0104", userId: "USR-TBD-031", skill: "HV bushing installation", level: 3, expires: "2027-09-30" },
  { id: "QAL-TBD-0105", userId: "USR-TBD-031", skill: "HV winding", level: 2, expires: "2027-01-31" },
]

/** Build a Created production order from the released routing of an item (planned order conversion,
 *  ETO split at release). Used by the slice actions. */
export function newWorkOrder(
  wc: Record<string, WcOverride>,
  o: { id: PPWorkOrder["id"]; item: MaterialId; qty: number; orderType: PPWorkOrder["orderType"]; priority: number; created: ISODate; peg?: { soId: `SO-${string}`; line: number; sched: number }; plannedOrderId?: string; gate?: Partial<PPWorkOrder["gateInputs"]>; start: ISODate; by: string },
): PPWorkOrder {
  const rid = routingIdFor(o.item)
  const src = ROUTING_OPS[rid]
  const spec: WoSpec = { id: o.id, item: o.item, qty: o.qty, status: "Created", orderType: o.orderType, priority: o.priority, done: 0, created: o.created }
  const ops = buildOps(spec, src)
  ops.forEach((x) => {
    x.start = o.start
    x.finish = o.start
    x.staged = false
  })
  return {
    id: o.id, itemId: o.item, serials: [], mbomRev: o.item === "FIN-TBD-20MVA" ? "C" : "A", routingRev: o.item === "FIN-TBD-20MVA" ? "C" : "A", routingId: rid,
    productionVersionId: `PV-TBD-${rid.slice(8)}` as PPWorkOrder["productionVersionId"], status: "Created", pegs: o.peg ? [o.peg] : [], qty: o.qty, start: o.start, finish: o.start,
    operations: ops, orderType: o.orderType, priority: o.priority, costStd: costFor(o.item, o.qty, src, wc), createdOn: o.created, createdBy: "USR-TBD-028",
    activity: [A(o.created, o.by, o.plannedOrderId ? `Created from planned order ${o.plannedOrderId}; pegs preserved` : "Created")],
    gateInputs: { mbomActive: true, drawingsReleased: o.orderType === "ETO" ? false : "n/a", customerApproval: o.orderType === "ETO" ? false : "n/a", inspectionPlansActive: true, productionBlock: false, ...o.gate },
    plannedOrderId: o.plannedOrderId,
  }
}
export const routingOps = (rid: string) => ROUTING_OPS[rid] ?? []
