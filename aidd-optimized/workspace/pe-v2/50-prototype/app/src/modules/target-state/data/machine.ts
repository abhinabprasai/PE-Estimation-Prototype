// Direct Machine Integration, OEE and Downtime (Book IX §6). Rules the data follows:
// - signals become the same confirmation and status events the terminal produces; unmapped tags log and never post
// - one current state per machine (run, idle, down, setup) with a full history; reason required for down states
// - a down state beyond a configured grace opens a downtime record automatically; the operator codes the reason at the
//   terminal within the shift from the maintained reason tree (planned separated from unplanned); uncoded downtime
//   escalates to the supervisor and never silently ages out
// - OEE per work center per shift from posted data only: availability = run time / planned production time (capacity
//   calendar); performance = ideal cycle time x count / run time (routing standard); quality = good / total (confirmations)
// - machine counted quantities reconcile daily against operator confirmations; differences beyond tolerance land on the
//   production reconciliation worklist before settlement
// Shift times, grace, hard-down threshold, tolerance and the reason tree contents are design values (shown as readings).

import { hash, prng, r2 } from "../components"

export const NOW = "2026-10-09 14:30"
export const GRACE_MIN = 5
export const HARD_DOWN_MIN = 30
export const RECON_TOL_PCT = 2
export const SHIFTS = [{ id: "1", label: "Shift 1 (06:00-14:00)", start: "06:00", end: "14:00" }, { id: "2", label: "Shift 2 (14:00-22:00)", start: "14:00", end: "22:00" }, { id: "3", label: "Shift 3 (22:00-06:00)", start: "22:00", end: "06:00" }]
export const REASON_TREE: Record<"Planned" | "Unplanned", Record<string, string[]>> = {
  Planned: { "Changeover and setup": ["Product changeover", "Tool change"], "Planned maintenance": ["Preventive maintenance", "Calibration"], "Scheduled stops": ["Break", "Meeting"] },
  Unplanned: { "Equipment failure": ["Mechanical", "Electrical", "Controls"], Material: ["Waiting for material", "Waiting for quality release"], Quality: ["Rework stop", "Inspection hold"], Labor: ["No operator", "Training"], Utilities: ["Power", "Compressed air"] },
}
export const MI_WCS = [
  { wc: "WC-100", machine: "MCH-TBD-100", gateway: "GW-TBD-01", name: "Core Cutting" },
  { wc: "WC-200", machine: "MCH-TBD-200", gateway: "GW-TBD-02", name: "LV Winding" },
  { wc: "WC-210", machine: "MCH-TBD-210", gateway: "GW-TBD-02", name: "HV Winding" },
  { wc: "WC-230", machine: "MCH-TBD-230", gateway: "GW-TBD-03", name: "Vapor Phase Drying / Oven" },
  { wc: "WC-500", machine: "MCH-TBD-500", gateway: "GW-TBD-04", name: "Test Lab" },
]

export type Meaning = "State" | "Cycle count" | "Alarm code" | "Measured value"
export interface SignalRow { id: string; wc: string; machine: string; tag: string; meaning: Meaning; mapTo: string; tolerance: string; effectiveFrom: string; effectiveTo?: string; version: number; status: "Active" | "Draft" | "Superseded" }
export interface DowntimeRec { id: string; wc: string; machine: string; start: string; end?: string; shift: string; reason?: [string, string, string]; state: "Open" | "Coded" | "Escalated"; source: "Gateway" | "Manual"; moId?: string; codedBy?: string }
export interface OeeRow { date: string; wc: string; shift: string; plannedMin: number; runMin: number; idealSec: number; count: number; good: number; machineCount: number; confirmed: number }
export interface MachineStateRow { wc: string; state: "run" | "idle" | "down" | "setup"; since: string }
export interface MachineState {
  signals: SignalRow[]
  unmapped: { tag: string; machine: string; lastSeen: string; count: number }[]
  downtime: DowntimeRec[]
  oee: OeeRow[]
  states: MachineStateRow[]
  reconCleared: string[]
  seq: number
}

export const minsBetween = (a: string, b: string) => Math.round((new Date(b.replace(" ", "T") + "Z").getTime() - new Date(a.replace(" ", "T") + "Z").getTime()) / 60000)
export const shiftOf = (hhmm: string) => (hhmm >= "06:00" && hhmm < "14:00" ? "1" : hhmm >= "14:00" && hhmm < "22:00" ? "2" : "3")
export const dtMinutes = (d: DowntimeRec) => minsBetween(d.start, d.end ?? NOW)
export const shiftEnded = (d: DowntimeRec) => {
  const sh = shiftOf(d.start.slice(11, 16))
  const date = d.start.slice(0, 10)
  const end = sh === "1" ? `${date} 14:00` : sh === "2" ? `${date} 22:00` : `${new Date(new Date(date + "T12:00:00Z").getTime() + 86400000).toISOString().slice(0, 10)} 06:00`
  return NOW >= end
}
export const isUncoded = (d: DowntimeRec) => !d.reason
export const hardDown = (d: DowntimeRec) => dtMinutes(d) >= HARD_DOWN_MIN && !d.end

export function oeeOf(r: OeeRow, downMin: number) {
  const runMin = r.runMin
  const a = r.plannedMin ? runMin / r.plannedMin : 0
  const p = runMin ? Math.min(1, (r.idealSec * r.count) / (runMin * 60)) : 0
  const q = r.count ? r.good / r.count : 0
  return { a, p, q, oee: a * p * q, downMin }
}

const ALL_REASONS: [string, string, string][] = []
for (const t of ["Planned", "Unplanned"] as const) for (const [c, rs] of Object.entries(REASON_TREE[t])) for (const r of rs) ALL_REASONS.push([t, c, r])

export function seedMachine(): MachineState {
  const signals: SignalRow[] = [
    { id: "SIG-TBD-001", wc: "WC-200", machine: "MCH-TBD-200", tag: "ns=2;s=WC200.Winder.RunState", meaning: "State", mapTo: "Machine state: run, idle, down, setup", tolerance: "n/a", effectiveFrom: "2026-09-01", version: 1, status: "Active" },
    { id: "SIG-TBD-002", wc: "WC-200", machine: "MCH-TBD-200", tag: "ns=2;s=WC200.Winder.TurnCount", meaning: "Cycle count", mapTo: "Operation confirmation quantity (SP-11 event)", tolerance: "2%", effectiveFrom: "2026-09-01", version: 1, status: "Active" },
    { id: "SIG-TBD-003", wc: "WC-200", machine: "MCH-TBD-200", tag: "ns=2;s=WC200.Winder.AlarmCode", meaning: "Alarm code", mapTo: "Downtime reason hint (operator still codes)", tolerance: "n/a", effectiveFrom: "2026-09-01", version: 1, status: "Active" },
    { id: "SIG-TBD-004", wc: "WC-200", machine: "MCH-TBD-200", tag: "ns=2;s=WC200.Tension.N", meaning: "Measured value", mapTo: "Capture template WND-LV-02, field Tension (N)", tolerance: "3%", effectiveFrom: "2026-09-01", version: 2, status: "Active" },
    { id: "SIG-TBD-005", wc: "WC-200", machine: "MCH-TBD-200", tag: "ns=2;s=WC200.Tension.N", meaning: "Measured value", mapTo: "Capture template WND-LV-02, field Tension (N)", tolerance: "5%", effectiveFrom: "2026-01-01", effectiveTo: "2026-08-31", version: 1, status: "Superseded" },
    { id: "SIG-TBD-006", wc: "WC-210", machine: "MCH-TBD-210", tag: "ns=2;s=WC210.Winder.RunState", meaning: "State", mapTo: "Machine state: run, idle, down, setup", tolerance: "n/a", effectiveFrom: "2026-09-01", version: 1, status: "Active" },
    { id: "SIG-TBD-007", wc: "WC-210", machine: "MCH-TBD-210", tag: "ns=2;s=WC210.Winder.DiscCount", meaning: "Cycle count", mapTo: "Operation confirmation quantity (SP-11 event)", tolerance: "2%", effectiveFrom: "2026-09-01", version: 1, status: "Active" },
    { id: "SIG-TBD-008", wc: "WC-230", machine: "MCH-TBD-230", tag: "mqtt:plant/oven1/vacuum_mbar", meaning: "Measured value", mapTo: "Capture template DRY-01, field Vacuum (mbar)", tolerance: "5%", effectiveFrom: "2026-09-15", version: 1, status: "Active" },
    { id: "SIG-TBD-009", wc: "WC-230", machine: "MCH-TBD-230", tag: "mqtt:plant/oven1/temp_c", meaning: "Measured value", mapTo: "Capture template DRY-01, field Temperature (C)", tolerance: "2%", effectiveFrom: "2026-09-15", version: 1, status: "Active" },
    { id: "SIG-TBD-010", wc: "WC-230", machine: "MCH-TBD-230", tag: "mqtt:plant/oven1/state", meaning: "State", mapTo: "Machine state: run, idle, down, setup", tolerance: "n/a", effectiveFrom: "2026-09-15", version: 1, status: "Active" },
    { id: "SIG-TBD-011", wc: "WC-100", machine: "MCH-TBD-100", tag: "ns=2;s=WC100.Cutter.CutCount", meaning: "Cycle count", mapTo: "Operation confirmation quantity (SP-11 event)", tolerance: "2%", effectiveFrom: "2026-10-12", version: 1, status: "Draft" },
    { id: "SIG-TBD-012", wc: "WC-500", machine: "MCH-TBD-500", tag: "file:ImpulseBench/result.csv#instrument", meaning: "Measured value", mapTo: "Final test capture template, field Instrument ID (calibration interlock unchanged)", tolerance: "exact", effectiveFrom: "2026-10-01", version: 1, status: "Active" },
  ]
  const unmapped = [
    { tag: "ns=2;s=WC200.Winder.CoolantTemp", machine: "MCH-TBD-200", lastSeen: "2026-10-09 14:28", count: 412 },
    { tag: "mqtt:plant/oven1/door_open", machine: "MCH-TBD-230", lastSeen: "2026-10-09 13:51", count: 38 },
  ]
  const downtime: DowntimeRec[] = []
  const oee: OeeRow[] = []
  const days = ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]
  let n = 100
  for (const d of days) {
    for (const m of MI_WCS.slice(0, 4)) {
      for (const sh of ["1", "2", "3"]) {
        if (d === "2026-10-09" && sh !== "1") continue
        if (["2026-10-04"].includes(d) && sh !== "1") continue
        const rnd = prng(hash(`${d}${m.wc}${sh}`))
        const planned = 450
        let down = 0
        const nRec = rnd() < 0.55 ? 1 + (rnd() < 0.3 ? 1 : 0) : 0
        for (let i = 0; i < nRec; i++) {
          const min = Math.round(8 + rnd() * 40)
          const sStart = sh === "1" ? 6 : sh === "2" ? 14 : 22
          const startMin = Math.round(30 + rnd() * 300)
          const hh = (sStart + Math.floor(startMin / 60)) % 24
          const mm = startMin % 60
          const dayShift = sh === "3" && hh < 6 ? 1 : 0
          const date = dayShift ? new Date(new Date(d + "T12:00:00Z").getTime() + 86400000).toISOString().slice(0, 10) : d
          const start = `${date} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
          const endT = new Date(new Date(start.replace(" ", "T") + "Z").getTime() + min * 60000).toISOString().slice(0, 16).replace("T", " ")
          const today = d === "2026-10-09"
          const reason = today && i === 0 && m.wc !== "WC-100" ? undefined : ALL_REASONS[Math.floor(rnd() * ALL_REASONS.length)]
          downtime.push({ id: `DT-TBD-${++n}`, wc: m.wc, machine: m.machine, start, end: endT, shift: sh, reason, state: reason ? "Coded" : "Open", source: rnd() < 0.8 ? "Gateway" : "Manual", codedBy: reason ? "Operator" : undefined })
          down += min
        }
        const run = planned - down
        const idealSec = m.wc === "WC-230" ? 5400 : m.wc === "WC-100" ? 95 : m.wc === "WC-200" ? 1800 : 2400
        const count = Math.max(1, Math.round((run * 60 * (0.78 + rnd() * 0.18)) / idealSec))
        const good = Math.max(0, count - (rnd() < 0.3 ? 1 : 0))
        const machineCount = count + (rnd() < 0.12 ? Math.max(1, Math.round(count * 0.04)) : 0)
        oee.push({ date: d, wc: m.wc, shift: sh, plannedMin: planned, runMin: run, idealSec, count, good, machineCount, confirmed: count })
      }
    }
  }
  // WC-210 is down right now (gateway), uncoded, beyond the hard-down threshold
  downtime.push({ id: "DT-TBD-0990", wc: "WC-210", machine: "MCH-TBD-210", start: "2026-10-09 13:40", shift: "1", state: "Open", source: "Gateway" })
  downtime.push({ id: "DT-TBD-0991", wc: "WC-200", machine: "MCH-TBD-200", start: "2026-10-09 14:12", shift: "2", state: "Open", source: "Gateway" })
  downtime.push({ id: "DT-TBD-0985", wc: "WC-230", machine: "MCH-TBD-230", start: "2026-10-08 22:40", end: "2026-10-08 23:05", shift: "3", state: "Escalated", source: "Gateway" })
  for (const x of downtime) if (!x.reason && x.state === "Open" && shiftEnded(x)) x.state = "Escalated"
  const states: MachineStateRow[] = [
    { wc: "WC-100", state: "run", since: "2026-10-09 06:02" },
    { wc: "WC-200", state: "down", since: "2026-10-09 14:12" },
    { wc: "WC-210", state: "down", since: "2026-10-09 13:40" },
    { wc: "WC-230", state: "run", since: "2026-10-09 11:15" },
    { wc: "WC-500", state: "idle", since: "2026-10-09 13:00" },
  ]
  return { signals, unmapped, downtime, oee, states, reconCleared: [], seq: 1000 }
}

/** Value a live tag test panel shows; deterministic per tag and tick. */
export function liveValue(sig: SignalRow, tick: number) {
  const r = prng(hash(sig.tag + tick))()
  if (sig.meaning === "State") return ["run", "run", "run", "idle", "run", "setup"][tick % 6]
  if (sig.meaning === "Cycle count") return String(1200 + tick * 3 + Math.floor(r * 2))
  if (sig.meaning === "Alarm code") return tick % 7 === 6 ? "A-204" : "none"
  return r2(sig.tag.includes("vacuum") ? 0.8 + r * 0.1 : sig.tag.includes("temp") ? 118 + r * 3 : 410 + r * 14).toString()
}
