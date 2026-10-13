// Gantt for SCH-BOARD and the scenario board: one row per work center, one bar per operation,
// working days across. Freeze horizon is shaded per work center, maintenance windows are blocked
// bands with their label, and each day cell shows the work center's shift boundaries (a bar spans
// shifts; the tooltip gives the hours). Token classes only; positions are inline geometry.

import { addWorkdays, isWorkday, addCalDays, opHours, opKey, type EffectiveWc, type ScheduleResult } from "../lib/plan"
import type { ISODate } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MaintWindow } from "../data/extra"
import type { PPWorkOrder } from "../data/types"

export interface GanttOp {
  key: string
  woId: string
  no: number
  wcId: string
  start: ISODate
  finish: ISODate
  label: string
  running: boolean
  late: boolean
  moved: boolean
  hours: number
  priority: number
}

/** Operations of open orders with the plan's dates (live plan, sandbox or scenario). */
export function ganttOps(orders: PPWorkOrder[], plan: ScheduleResult, moved: Set<string> = new Set(), lateOf?: (w: PPWorkOrder, finish: ISODate) => boolean): GanttOp[] {
  const out: GanttOp[] = []
  for (const w of orders) {
    if (!["Created", "Released", "In Progress", "Testing", "On Hold"].includes(w.status)) continue
    for (const o of w.operations) {
      if (o.status === "Completed" || o.status === "Cancelled") continue
      const k = opKey(w.id, o.no)
      const d = plan.dates[k]
      const start = d?.[0] ?? o.start
      const finish = d?.[1] ?? o.finish
      out.push({ key: k, woId: w.id, no: o.no, wcId: o.workCenterId, start, finish, label: `${w.id.replace("WO-", "")}/${o.no}`, running: o.status === "In Progress", late: lateOf?.(w, finish) ?? false, moved: moved.has(k), hours: opHours(o), priority: w.priority })
    }
  }
  return out
}

export function workdayRange(from: ISODate, n: number): ISODate[] {
  const out: ISODate[] = []
  let d: ISODate = isWorkday(from) ? from : addWorkdays(from, 1)
  for (let i = 0; i < n; i++) {
    out.push(d)
    d = addWorkdays(d, 1)
  }
  return out
}

const LANE = 24
const GAP = 3

export function Gantt({
  wcs, ops, days, freezeOf, windows, selected, onBar, labelCol = 176,
}: {
  wcs: EffectiveWc[]
  ops: GanttOp[]
  days: ISODate[]
  freezeOf: (wcId: string) => ISODate
  windows: MaintWindow[]
  selected?: string | null
  onBar?: (o: GanttOp) => void
  labelCol?: number
}) {
  const n = days.length
  const first = days[0]
  const last = days[n - 1]
  const idxStart = (d: ISODate) => {
    if (d <= first) return 0
    const i = days.findIndex((x) => x >= d)
    return i < 0 ? n : i
  }
  const idxEnd = (d: ISODate) => {
    if (d >= last) return n - 1
    let i = -1
    days.forEach((x, j) => x <= d && (i = j))
    return i
  }
  const pct = (i: number) => `${(i / n) * 100}%`
  const weekBreaks = days.map((d, i) => (i > 0 && new Date(d + "T00:00:00Z").getUTCDay() === 1 ? i : -1)).filter((i) => i >= 0)
  return (
    <div className="overflow-x-auto rounded-lg border" role="group" aria-label="Schedule Gantt, one row per work center">
      <div style={{ minWidth: labelCol + n * 44 }}>
        <div className="grid border-b bg-table-head text-xs" style={{ gridTemplateColumns: `${labelCol}px 1fr` }}>
          <div className="px-2 py-1 font-semibold">Work center · shifts</div>
          <div className="relative flex">
            {days.map((d) => (
              <div key={d} className={cn("flex-1 border-l px-0.5 py-1 text-center tabular", d === TODAY && "font-semibold text-primary")} title={fmtDate(d)}>
                <span className="block">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][new Date(d + "T00:00:00Z").getUTCDay()]}</span>
                <span className="block">{d.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
        {wcs.map((w) => {
          const mine = ops.filter((o) => o.wcId === w.id && o.finish >= first && o.start <= last).sort((a, b) => a.start.localeCompare(b.start) || a.priority - b.priority)
          const laneEnd: number[] = []
          const placed = mine.map((o) => {
            const a = idxStart(o.start)
            const b = Math.max(a, idxEnd(o.finish))
            let lane = laneEnd.findIndex((e) => e < a)
            if (lane < 0) lane = laneEnd.length
            laneEnd[lane] = b
            return { o, a, b, lane }
          })
          const lanes = Math.max(1, laneEnd.length)
          const height = lanes * (LANE + GAP) + GAP
          const fe = freezeOf(w.id)
          const freezeTo = idxEnd(fe)
          const wins = windows.filter((m) => m.wcId === w.id && m.status !== "Done" && m.status !== "Cancelled" && m.to >= first && m.from <= last)
          const tick = w.shifts > 1 ? Array.from({ length: w.shifts - 1 }, (_, i) => ((i + 1) / w.shifts) * 100) : []
          return (
            <div key={w.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `${labelCol}px 1fr` }}>
              <div className="flex flex-col justify-center px-2 py-1 text-xs">
                <span className="font-mono">{w.id}</span>
                <span className="truncate text-muted-foreground">{w.name}</span>
                <span className="text-muted-foreground">{w.shifts} × {w.hoursPerShift} h{w.status !== "Active" ? ` · ${w.status}` : ""}</span>
              </div>
              <div className="relative" style={{ height }}>
                <div className="absolute inset-0 flex" aria-hidden="true">
                  {days.map((d, i) => (
                    <div key={d} className={cn("relative h-full flex-1 border-l", i <= freezeTo && "bg-muted", weekBreaks.includes(i) && "border-l-foreground/30")}>
                      {tick.map((t) => <span key={t} className="absolute top-0 h-full border-l border-dashed border-border" style={{ left: `${t}%` }} />)}
                    </div>
                  ))}
                </div>
                {wins.map((m) => {
                  const a = idxStart(m.from)
                  const b = idxEnd(m.to)
                  if (b < a) return null
                  return (
                    <div key={m.id} title={`${m.id} ${m.kind}: ${m.from} to ${m.to}. ${m.note}`} className="absolute top-0 flex h-full items-center justify-center overflow-hidden border border-dashed border-status-blocked bg-status-cancelled/10 text-xs text-status-cancelled-ink"
                      style={{ left: pct(a), width: `${((b - a + 1) / n) * 100}%` }}>
                      <span className="truncate px-1">{m.kind === "Breakdown" ? "Breakdown" : m.kind === "Calibration" ? "Calibration" : "Maintenance"}</span>
                    </div>
                  )
                })}
                {placed.map(({ o, a, b, lane }) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => onBar?.(o)}
                    title={`${o.woId} op ${o.no}: ${fmtDate(o.start)} to ${fmtDate(o.finish)}, ${o.hours} h over ${w.shifts} shift${w.shifts > 1 ? "s" : ""}${o.running ? ", running" : ""}${o.late ? ", past the promise less transit buffer" : ""}${o.moved ? ", moved in the sandbox" : ""}`}
                    aria-label={`${o.woId} operation ${o.no} at ${w.id}, ${fmtDate(o.start)} to ${fmtDate(o.finish)}`}
                    className={cn(
                      "absolute flex items-center overflow-hidden rounded-sm border px-1 text-left text-xs",
                      o.running ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-secondary-foreground",
                      o.late && "border-status-exception ring-1 ring-status-exception",
                      o.moved && "border-dashed border-status-pending",
                      selected === o.key && "outline outline-2 outline-ring",
                    )}
                    style={{ left: pct(a), width: `${((b - a + 1) / n) * 100}%`, top: GAP + lane * (LANE + GAP), height: LANE }}
                  >
                    <span className="truncate font-mono">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="flex flex-wrap gap-4 border-t px-2 py-1 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-primary align-middle" />running</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm border bg-secondary align-middle" />planned</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm border border-status-exception align-middle" />past promise less transit buffer</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm border border-dashed border-status-pending align-middle" />moved in sandbox</span>
        <span><span className="mr-1 inline-block size-3 bg-muted align-middle" />freeze horizon</span>
        <span><span className="mr-1 inline-block size-3 border border-dashed border-status-blocked align-middle" />maintenance window</span>
        <span>dashed ticks: shift boundaries</span>
        <span>{addCalDays(first, 0) === first ? `${fmtDate(first)} to ${fmtDate(last)}` : ""}</span>
      </p>
    </div>
  )
}
