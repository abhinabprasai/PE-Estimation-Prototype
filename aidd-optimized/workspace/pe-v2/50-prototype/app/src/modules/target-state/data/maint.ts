// Plant Maintenance and EAM (Book IX §8). Rules the data follows:
// - equipment master (EQ series): hierarchy location, machine, component; link to work center or tool; criticality class;
//   counters (hours, cycles); spare parts list of SPARE materials; calibration stays in the quality register and links here
// - maintenance plans: time based or counter based cycles, task lists, tolerance windows, next due computed continuously;
//   preventive plans generate orders inside the planning horizon and reserve the equipment window as blocked capacity
// - maintenance orders (MO series): preventive, corrective, breakdown, inspection; status path parallel to production orders;
//   settlement to the owning cost center expense, never to product WIP
// - MTBF and MTTR compute per equipment from the state history and order durations
// - a work center whose governing equipment holds an open breakdown order shows Maintenance status (S-20)
// Criticality classes A/B/C, labor rate, horizon and the production blocks are design values shown as readings.

import { WORK_CENTERS, MATERIALS } from "@/data/shared"

export const MO_TYPES = ["Preventive", "Corrective", "Breakdown", "Inspection"] as const
export type MoType = (typeof MO_TYPES)[number]
export const MO_PATH = ["Created", "Released", "In Progress", "Completed", "Closed (TECO)"] as const
export const MAINT_LABOR_RATE = 62
export const HORIZON_DEFAULT = 14
export const OP_HOURS_PER_DAY = 16
export const PERIOD_DAYS = 90

export interface Equipment {
  id: string; name: string; type: "Location" | "Machine" | "Component" | "Tool"; parentId?: string; workCenterId?: string
  criticality: "A" | "B" | "C"; hours: number; cycles: number; dailyHours: number
  calibration?: { instrumentId: string; due: string; status: "In calibration" | "Due" }
  spares: { materialId: string; qty: number; reorderPoint: number }[]
  failures: { start: string; end: string; moId?: string }[]
  docs: string[]
}
export interface PlanTask { text: string; hrs: number; parts: { materialId: string; qty: number }[] }
export interface MPlan {
  id: string; equipmentId: string; name: string; cycle: { kind: "Time" | "Counter"; every: number; unit: "days" | "hours" | "cycles" }
  lastDone: string; lastCounter?: number; toleranceDays: number; horizonDays: number; tasks: PlanTask[]; status: "Active" | "Paused"
}
export interface Mo {
  id: string; type: MoType; equipmentId: string; desc: string; status: string
  window: { from: string; to: string }; tasks: { text: string; hrs: number; done: boolean }[]
  parts: { materialId: string; qty: number; issued: number }[]; labor: { who: string; hrs: number }[]
  permit: string; source: string; planId?: string
  settled?: { at: string; amount: number }
}
export interface ProdBlock { wc: string; woId: string; from: string; to: string }
export interface Blocked { id: string; equipmentId: string; wc?: string; from: string; to: string; moId: string }
export interface MaintState { equipment: Equipment[]; plans: MPlan[]; orders: Mo[]; prod: ProdBlock[]; blocked: Blocked[]; seq: number }

export const wcOf = (id?: string) => WORK_CENTERS.find((w) => w.id === id)
export const costCenterOf = (e: Equipment, all: Equipment[]): string => {
  let cur: Equipment | undefined = e
  while (cur) {
    if (cur.workCenterId) return wcOf(cur.workCenterId)?.costCenterId ?? "CC-2000"
    cur = all.find((x) => x.id === cur!.parentId)
  }
  return "CC-2000"
}
/** The work center an equipment (or its ancestor) governs. */
export const governedWc = (e: Equipment, all: Equipment[]): string | undefined => {
  let cur: Equipment | undefined = e
  while (cur) {
    if (cur.workCenterId) return cur.workCenterId
    cur = all.find((x) => x.id === cur!.parentId)
  }
}
export const stdCostOf = (id: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0

const addD = (iso: string, d: number) => new Date(new Date(iso + "T12:00:00Z").getTime() + d * 86400000).toISOString().slice(0, 10)
export const TODAY_M = "2026-10-09"

/** Next due, computed continuously: time cycles add days to the last execution, counter cycles project the counter. */
export function nextDue(p: MPlan, e: Equipment) {
  if (p.cycle.kind === "Time") {
    const date = addD(p.lastDone, p.cycle.every)
    return { date, detail: `${p.lastDone} plus ${p.cycle.every} days` }
  }
  const counter = p.cycle.unit === "hours" ? e.hours : e.cycles
  const due = (p.lastCounter ?? 0) + p.cycle.every
  const remaining = due - counter
  const perDay = p.cycle.unit === "hours" ? e.dailyHours : Math.max(1, Math.round(e.dailyHours * 6))
  return { date: addD(TODAY_M, Math.max(0, Math.ceil(remaining / perDay))), detail: `counter ${counter} of ${due} ${p.cycle.unit}; ${remaining} left at ${perDay} per day` }
}

export function moCost(m: Mo) {
  const parts = m.parts.reduce((s, p) => s + p.issued * stdCostOf(p.materialId), 0)
  const labor = m.labor.reduce((s, l) => s + l.hrs * MAINT_LABOR_RATE, 0)
  return { parts, labor, total: parts + labor }
}

/** MTBF and MTTR per equipment from the state history and order durations. */
export function reliability(e: Equipment) {
  const down = e.failures.reduce((s, f) => s + (new Date(f.end.replace(" ", "T") + "Z").getTime() - new Date(f.start.replace(" ", "T") + "Z").getTime()) / 3600000, 0)
  const n = e.failures.length
  const operating = PERIOD_DAYS * OP_HOURS_PER_DAY - down
  return { n, downHrs: down, mtbf: n ? operating / n : null, mttr: n ? down / n : null, operating }
}

export function seedMaint(): MaintState {
  const eq = (id: string, name: string, type: Equipment["type"], parentId: string | undefined, crit: Equipment["criticality"], extra: Partial<Equipment> = {}): Equipment => ({ id, name, type, parentId, criticality: crit, hours: 0, cycles: 0, dailyHours: 15, spares: [], failures: [], docs: [], ...extra })
  const f = (start: string, end: string, moId?: string) => ({ start, end, moId })
  const equipment: Equipment[] = [
    eq("EQ-TBD-0001", "Fargo plant", "Location", undefined, "C"),
    eq("EQ-TBD-0002", "Winding hall", "Location", "EQ-TBD-0001", "C"),
    eq("EQ-TBD-0010", "LV foil winder", "Machine", "EQ-TBD-0002", "A", { workCenterId: "WC-200", hours: 6120, cycles: 18400, docs: ["Operator manual rev D", "Lubrication chart"], spares: [{ materialId: "SPARE-TBD-GSKT20", qty: 2, reorderPoint: 1 }], failures: [f("2026-07-14 09:10", "2026-07-14 13:40", "MO-TBD-0011"), f("2026-08-22 15:00", "2026-08-22 17:30", "MO-TBD-0012"), f("2026-09-30 07:20", "2026-09-30 11:50", "MO-TBD-0003")] }),
    eq("EQ-TBD-0011", "Tension control unit", "Component", "EQ-TBD-0010", "A", { hours: 6120, failures: [f("2026-09-30 07:20", "2026-09-30 11:50", "MO-TBD-0003")] }),
    eq("EQ-TBD-0012", "Spindle servo drive", "Component", "EQ-TBD-0010", "B", { hours: 6120 }),
    eq("EQ-TBD-0020", "HV disc winder", "Machine", "EQ-TBD-0002", "A", { workCenterId: "WC-210", hours: 5410, cycles: 9900, failures: [f("2026-08-05 10:00", "2026-08-05 12:00", "MO-TBD-0013"), f("2026-10-09 13:40", "2026-10-09 14:30", "MO-TBD-0007")] }),
    eq("EQ-TBD-0021", "Layer insulation feeder", "Component", "EQ-TBD-0020", "B"),
    eq("EQ-TBD-0003", "Drying hall", "Location", "EQ-TBD-0001", "C"),
    eq("EQ-TBD-0030", "Vapor phase drying oven", "Machine", "EQ-TBD-0003", "A", { workCenterId: "WC-230", hours: 4780, cycles: 410, dailyHours: 18, spares: [{ materialId: "SPARE-TBD-GSKT20", qty: 1, reorderPoint: 2 }], failures: [f("2026-07-30 03:00", "2026-07-30 11:00", "MO-TBD-0014")] }),
    eq("EQ-TBD-0031", "Vacuum pump", "Component", "EQ-TBD-0030", "A", { hours: 4780 }),
    eq("EQ-TBD-0032", "Heater bank", "Component", "EQ-TBD-0030", "B", { hours: 4780 }),
    eq("EQ-TBD-0004", "Test lab", "Location", "EQ-TBD-0001", "C"),
    eq("EQ-TBD-0040", "Impulse test bench", "Machine", "EQ-TBD-0004", "B", { workCenterId: "WC-500", hours: 2300, cycles: 1860, dailyHours: 8, calibration: { instrumentId: "INS-TBD-0101", due: "2026-12-15", status: "In calibration" } }),
    eq("EQ-TBD-0005", "Finishing hall", "Location", "EQ-TBD-0001", "C"),
    eq("EQ-TBD-0050", "Paint booth", "Machine", "EQ-TBD-0005", "B", { workCenterId: "WC-600", hours: 7020, cycles: 0, failures: [f("2026-10-07 08:30", "2026-10-09 14:30", "MO-TBD-0001")] }),
    eq("EQ-TBD-0060", "Overhead crane, 25 t", "Machine", "EQ-TBD-0001", "A", { hours: 3050, dailyHours: 6, spares: [{ materialId: "SPARE-TBD-OLTCK", qty: 0, reorderPoint: 1 }] }),
    eq("EQ-TBD-0070", "Torque wrench set", "Tool", "EQ-TBD-0004", "C", { calibration: { instrumentId: "INS-TBD-0118", due: "2026-10-20", status: "Due" } }),
  ]
  const plans: MPlan[] = [
    { id: "MPLAN-TBD-001", equipmentId: "EQ-TBD-0010", name: "Winder lubrication and tension calibration", cycle: { kind: "Time", every: 30, unit: "days" }, lastDone: "2026-09-15", toleranceDays: 3, horizonDays: 14, status: "Active", tasks: [{ text: "Lubricate spindle and guides per chart", hrs: 1.5, parts: [] }, { text: "Calibrate tension control unit", hrs: 2, parts: [{ materialId: "SPARE-TBD-GSKT20", qty: 1 }] }] },
    { id: "MPLAN-TBD-002", equipmentId: "EQ-TBD-0030", name: "Oven vacuum pump service", cycle: { kind: "Counter", every: 500, unit: "hours" }, lastDone: "2026-06-20", lastCounter: 4300, toleranceDays: 2, horizonDays: 14, status: "Active", tasks: [{ text: "Change pump oil and filter", hrs: 3, parts: [] }, { text: "Leak-rate test of vacuum chamber", hrs: 2, parts: [{ materialId: "SPARE-TBD-GSKT20", qty: 1 }] }] },
    { id: "MPLAN-TBD-003", equipmentId: "EQ-TBD-0060", name: "Annual crane inspection", cycle: { kind: "Time", every: 365, unit: "days" }, lastDone: "2025-11-20", toleranceDays: 14, horizonDays: 45, status: "Active", tasks: [{ text: "Hoist brake and limit switch test", hrs: 4, parts: [] }, { text: "Load test at 110 percent", hrs: 3, parts: [] }] },
    { id: "MPLAN-TBD-004", equipmentId: "EQ-TBD-0050", name: "Booth filter change", cycle: { kind: "Time", every: 14, unit: "days" }, lastDone: "2026-09-20", toleranceDays: 1, horizonDays: 14, status: "Active", tasks: [{ text: "Replace intake and exhaust filters", hrs: 2, parts: [] }] },
    { id: "MPLAN-TBD-005", equipmentId: "EQ-TBD-0040", name: "Impulse bench capacitor check", cycle: { kind: "Counter", every: 2000, unit: "cycles" }, lastDone: "2026-03-10", lastCounter: 0, toleranceDays: 7, horizonDays: 30, status: "Paused", tasks: [{ text: "Capacitor leakage and shot counter check", hrs: 3, parts: [] }] },
  ]
  const mo = (n: number, type: MoType, equipmentId: string, desc: string, status: string, from: string, to: string, tasks: Mo["tasks"], extra: Partial<Mo> = {}): Mo => ({ id: `MO-TBD-${String(n).padStart(4, "0")}`, type, equipmentId, desc, status, window: { from, to }, tasks, parts: [], labor: [], permit: "", source: "Planner", ...extra })
  const orders: Mo[] = [
    mo(1, "Breakdown", "EQ-TBD-0050", "Paint booth: exhaust fan seized", "In Progress", "2026-10-07", "2026-10-10", [{ text: "Replace exhaust fan bearing", hrs: 4, done: true }, { text: "Restart and airflow check", hrs: 1, done: false }], { source: "Terminal hold reason: machine down (WC-600)", permit: "Lockout/tagout LOTO-TBD-0031", parts: [{ materialId: "SPARE-TBD-GSKT20", qty: 1, issued: 1 }], labor: [{ who: "Maintenance crew", hrs: 5 }] }),
    mo(2, "Preventive", "EQ-TBD-0060", "Annual crane inspection", "Created", "2026-11-18", "2026-11-20", [{ text: "Hoist brake and limit switch test", hrs: 4, done: false }, { text: "Load test at 110 percent", hrs: 3, done: false }], { planId: "MPLAN-TBD-003" }),
    mo(3, "Corrective", "EQ-TBD-0011", "Tension control unit: erratic reading", "Closed (TECO)", "2026-09-30", "2026-09-30", [{ text: "Replace load cell and recalibrate", hrs: 4, done: true }], { source: "Operator report", labor: [{ who: "Maintenance crew", hrs: 4.5 }], parts: [{ materialId: "SPARE-TBD-GSKT20", qty: 0, issued: 0 }], settled: { at: "2026-10-02", amount: 4.5 * MAINT_LABOR_RATE } }),
    mo(4, "Preventive", "EQ-TBD-0010", "Winder lubrication and tension calibration", "Completed", "2026-10-06", "2026-10-06", [{ text: "Lubricate spindle and guides per chart", hrs: 1.5, done: true }, { text: "Calibrate tension control unit", hrs: 2, done: true }], { planId: "MPLAN-TBD-001", labor: [{ who: "Maintenance crew", hrs: 3.5 }], parts: [{ materialId: "SPARE-TBD-GSKT20", qty: 1, issued: 1 }] }),
    mo(5, "Inspection", "EQ-TBD-0040", "Impulse bench pre-test inspection", "Closed (TECO)", "2026-09-10", "2026-09-10", [{ text: "Visual inspection and ground check", hrs: 1, done: true }], { labor: [{ who: "Maintenance crew", hrs: 1 }], settled: { at: "2026-09-12", amount: MAINT_LABOR_RATE } }),
    mo(6, "Preventive", "EQ-TBD-0030", "Oven vacuum pump service", "Released", "2026-10-09", "2026-10-10", [{ text: "Change pump oil and filter", hrs: 3, done: false }, { text: "Leak-rate test of vacuum chamber", hrs: 2, done: false }], { planId: "MPLAN-TBD-002", parts: [{ materialId: "SPARE-TBD-GSKT20", qty: 1, issued: 0 }] }),
    mo(7, "Breakdown", "EQ-TBD-0020", "HV winder: drive fault F-31", "On Hold", "2026-10-09", "2026-10-09", [{ text: "Diagnose drive fault and reset", hrs: 2, done: false }], { source: "Gateway down state beyond threshold (WC-210)", permit: "Lockout/tagout LOTO-TBD-0034" }),
    mo(8, "Corrective", "EQ-TBD-0021", "Layer feeder: roller wear", "Cancelled", "2026-10-01", "2026-10-02", [{ text: "Replace feed roller", hrs: 2, done: false }], { source: "Operator report" }),
  ]
  const prod: ProdBlock[] = [
    { wc: "WC-230", woId: "WO-TBD-0366", from: "2026-10-09", to: "2026-10-13" },
    { wc: "WC-200", woId: "WO-TBD-0367", from: "2026-10-13", to: "2026-10-16" },
    { wc: "WC-500", woId: "WO-TBD-0361", from: "2026-11-02", to: "2026-11-06" },
    { wc: "WC-600", woId: "WO-TBD-0372", from: "2026-10-08", to: "2026-10-12" },
  ]
  const blocked: Blocked[] = [{ id: "BLK-TBD-0001", equipmentId: "EQ-TBD-0030", wc: "WC-230", from: "2026-10-09", to: "2026-10-10", moId: "MO-TBD-0006" }]
  return { equipment, plans, orders, prod, blocked, seq: 20 }
}
