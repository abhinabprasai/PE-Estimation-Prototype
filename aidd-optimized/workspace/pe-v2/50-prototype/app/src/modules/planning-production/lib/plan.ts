// Planning arithmetic for the planning-production group: plant calendar, finite-capacity scheduler,
// work-center load buckets, capable-to-promise and cost / variance math.
//
// The scheduler follows Book III E §2-§3 [DOC:pp.192-193] (asserted): finite buckets per work
// center, operations consume capacity, overload is impossible in the finite plan, maintenance blocks
// capacity, a reschedule sets an earliest start the engine honours. Mode per order [DOC:p.74 §5.1;
// p.192 Book III E §3]: backward from the due date (default), forward from release on demand. A
// backward order that cannot fit before its due date falls back to forward loading and is late; late
// pegged orders auto-escalate priority (§5.1). Orders load in priority order; within an order each
// operation takes the latest (backward) or earliest (forward) free hours of its work center. The
// heuristic itself is a design reading; same inputs give the same schedule.

import { WORK_CENTERS, TODAY } from "@/data/shared"
import type { ISODate, WorkCenterId } from "@/data/domain"
import type { CostStd, LocalWorkCenter, PPOperation, PPWorkOrder, PlanningProductionState, WcOverride } from "../data/types"

// ------------------------------------------------------------------ calendar (Mon-Fri, design value)
const D = (iso: string) => new Date(iso + "T12:00:00Z")
const iso = (d: Date) => d.toISOString().slice(0, 10)
export const isWorkday = (d: ISODate) => {
  const w = D(d).getUTCDay()
  return w !== 0 && w !== 6
}
export const addCalDays = (d: ISODate, n: number) => {
  const x = D(d)
  x.setUTCDate(x.getUTCDate() + n)
  return iso(x)
}
export function addWorkdays(d: ISODate, n: number): ISODate {
  let cur = d
  let left = Math.abs(n)
  const step = n < 0 ? -1 : 1
  while (left > 0) {
    cur = addCalDays(cur, step)
    if (isWorkday(cur)) left--
  }
  return cur
}
export function prevWorkday(d: ISODate): ISODate {
  let cur = d
  while (!isWorkday(cur)) cur = addCalDays(cur, -1)
  return cur
}
export function nextWorkday(d: ISODate): ISODate {
  let cur = d
  while (!isWorkday(cur)) cur = addCalDays(cur, 1)
  return cur
}
export function workdaysBetween(a: ISODate, b: ISODate): number {
  if (a === b) return 0
  const sign = a < b ? 1 : -1
  let cur = a
  let n = 0
  while (cur !== b) {
    cur = addCalDays(cur, sign)
    if (isWorkday(cur)) n += sign
  }
  return n
}
/** Monday of the ISO week containing d. */
export function weekStart(d: ISODate): ISODate {
  const x = D(d)
  const wd = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - wd)
  return iso(x)
}
/** ISO week number. */
export function isoWeek(d: ISODate): number {
  const x = D(d)
  const day = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - day + 3)
  const firstThu = new Date(Date.UTC(x.getUTCFullYear(), 0, 4, 12))
  return 1 + Math.round(((x.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7)
}
export const weekLabel = (d: ISODate) => `W${String(isoWeek(d)).padStart(2, "0")}`

// ------------------------------------------------------------------ work centers (shared + own records)
export type EffectiveWc = LocalWorkCenter & WcOverride
export function allWorkCenters(s: Pick<PlanningProductionState, "workCenters" | "wc">): EffectiveWc[] {
  const base: LocalWorkCenter[] = [...WORK_CENTERS, ...s.workCenters]
  return base.map((w) => {
    const o = s.wc[w.id]
    return { ...w, ...o, status: o?.status ?? w.status } as EffectiveWc
  })
}
export const wcById = (s: Pick<PlanningProductionState, "workCenters" | "wc">, id: string) => allWorkCenters(s).find((w) => w.id === id)

/** Hours a work center can load on one working day: shifts x hours x stations x efficiency. */
export function dailyCapacity(w: EffectiveWc, day: ISODate): number {
  if (!isWorkday(day)) return 0
  if (w.status === "Inactive") return 0
  if (w.status === "Maintenance" && (!w.maintenanceUntil || day <= w.maintenanceUntil)) return 0
  return (w.shifts * w.hoursPerShift * w.stations * w.efficiencyPct) / 100
}

export const opHours = (op: Pick<PPOperation, "setupHours" | "runHours">) => op.setupHours + op.runHours
export const opKey = (woId: string, no: number) => `${woId}/${no}`

const SCHEDULABLE = new Set(["Created", "Released", "In Progress", "Testing", "On Hold"])

export interface ScheduleResult {
  dates: Record<string, [ISODate, ISODate]>
  /** wcId -> day -> loaded hours */
  load: Record<string, Record<string, number>>
  unschedulable: string[]
  /** woId -> how the engine placed it. */
  mode: Record<string, "Backward" | "Forward" | "Forward (backward infeasible)">
  /** Orders whose projected finish passes their due date. */
  late: string[]
}

/** Effective scheduling mode: backward when the order has a due date, unless forward is requested. */
export const modeOf = (o: Pick<PPWorkOrder, "scheduleMode" | "dueDate">) => (o.scheduleMode === "Forward" || !o.dueDate ? "Forward" : "Backward")

/** Finite scheduler. `extra` lets CTP insert a hypothetical order (no due date: forward, earliest). */
export function schedule(
  s: Pick<PlanningProductionState, "productionOrders" | "workCenters" | "wc">,
  notBefore: Record<string, ISODate> = {},
  extra: PPWorkOrder[] = [],
  from: ISODate = TODAY,
): ScheduleResult {
  const wcs = new Map(allWorkCenters(s).map((w) => [w.id, w]))
  const load: Record<string, Record<string, number>> = {}
  const dates: Record<string, [ISODate, ISODate]> = {}
  const unschedulable: string[] = []
  const mode: ScheduleResult["mode"] = {}
  const late: string[] = []
  const used = (wc: string, day: string) => load[wc]?.[day] ?? 0
  const add = (wc: string, day: string, h: number) => {
    load[wc] ??= {}
    load[wc][day] = (load[wc][day] ?? 0) + h
  }
  const orders = [...s.productionOrders.filter((o) => SCHEDULABLE.has(o.status)), ...extra].sort((a, b) => a.priority - b.priority || (a.dueDate ?? a.finish).localeCompare(b.dueDate ?? b.finish))
  const start0 = nextWorkday(from)
  const hoursOf = (op: PPOperation) => (op.status === "In Progress" ? Math.max(opHours(op) - op.actualHours / Math.max(op.crew, 1), opHours(op) * 0.15) : opHours(op))

  /** Forward placement of one operation from `day`; returns its first and last day. */
  const forward = (k: string, op: PPOperation, day0: ISODate): [ISODate, ISODate] => {
    let remaining = hoursOf(op)
    const w = wcs.get(op.workCenterId)
    let day = day0
    const nb = notBefore[k] ?? op.notBefore
    if (nb && nb > day) day = nextWorkday(nb)
    let first: string | undefined = op.status === "In Progress" ? op.start : undefined
    let guard = 0
    while (remaining > 0.001 && guard < 500) {
      guard++
      if (!w) break
      const free = dailyCapacity(w, day) - used(w.id, day)
      if (free > 0.01) {
        const take = Math.min(free, remaining)
        add(w.id, day, take)
        remaining -= take
        first ??= day
      }
      if (remaining > 0.001) day = nextWorkday(addCalDays(day, 1))
    }
    if (remaining > 0.001) unschedulable.push(k)
    return [first ?? day, day]
  }

  for (const o of orders) {
    const ops = [...o.operations].sort((a, b) => a.no - b.no)
    let cursor = o.start > start0 ? nextWorkday(o.start) : start0
    // completed and cancelled operations keep their dates; running operations continue from today
    for (const op of ops) {
      const k = opKey(o.id, op.no)
      if (op.status === "Completed" || op.status === "Cancelled") dates[k] = [op.start, op.finish]
      else if (op.status === "In Progress") {
        dates[k] = forward(k, op, start0)
        cursor = dates[k][1]
      }
    }
    const open = ops.filter((op) => op.status === "Not Started")
    const m = modeOf(o)
    let placed = false
    if (m === "Backward" && open.length) {
      // tentative backward pass from the due date; committed only if every operation fits
      const lower = o.operations.some((x) => x.status === "In Progress") ? cursor : start0
      const tent: [string, string, number][] = []
      const tUsed = (wc: string, day: string) => used(wc, day) + tent.filter((t) => t[0] === wc && t[1] === day).reduce((a, t) => a + t[2], 0)
      const out: Record<string, [ISODate, ISODate]> = {}
      let latest = prevWorkday(o.dueDate!)
      let ok = latest >= lower
      for (const op of [...open].reverse()) {
        if (!ok) break
        const k = opKey(o.id, op.no)
        const w = wcs.get(op.workCenterId)
        let remaining = hoursOf(op)
        let day = latest
        let last: string | undefined
        let first: string | undefined
        let guard = 0
        while (remaining > 0.001 && guard < 500) {
          guard++
          if (!w || day < lower) break
          const free = dailyCapacity(w, day) - tUsed(w.id, day)
          if (free > 0.01) {
            const take = Math.min(free, remaining)
            tent.push([w.id, day, take])
            remaining -= take
            last ??= day
            first = day
          }
          if (remaining > 0.001) day = prevWorkday(addCalDays(day, -1))
        }
        const nb = notBefore[k] ?? op.notBefore
        if (remaining > 0.001 || !first || (nb && first < nb)) ok = false
        else {
          out[k] = [first, last!]
          latest = first
        }
      }
      if (ok) {
        for (const [wc, day, h] of tent) add(wc, day, h)
        Object.assign(dates, out)
        mode[o.id] = "Backward"
        placed = true
      }
    }
    if (!placed) {
      mode[o.id] = m === "Backward" && open.length ? "Forward (backward infeasible)" : "Forward"
      for (const op of open) {
        const k = opKey(o.id, op.no)
        dates[k] = forward(k, op, cursor)
        cursor = dates[k][1]
      }
    }
    const lastOp = [...ops].reverse().find((x) => x.status !== "Cancelled")
    const fin = lastOp ? dates[opKey(o.id, lastOp.no)]?.[1] : undefined
    if (o.dueDate && fin && fin > o.dueDate) late.push(o.id)
  }
  return { dates, load, unschedulable, mode, late }
}

/** Late pegged orders auto-escalate priority [DOC:p.74 §5.1] (asserted). The new priority (1, the
 *  top of the dispatch order) is a design value. Returns the escalated order IDs. */
export function escalateLate(orders: PPWorkOrder[], r: ScheduleResult, today: ISODate): string[] {
  const out: string[] = []
  for (const o of orders) {
    if (!r.late.includes(o.id) || !o.pegs.length || o.escalatedFrom != null || o.priority <= 1) continue
    o.escalatedFrom = o.priority
    o.priority = 1
    o.activity.push({ at: today, by: "System", text: `Late pegged order: projected finish after due date ${o.dueDate}; priority auto-escalated ${o.escalatedFrom} → 1` })
    out.push(o.id)
  }
  return out
}

/** Apply a schedule result to the orders' operation dates (in a draft). */
export function applySchedule(orders: PPWorkOrder[], r: ScheduleResult) {
  for (const o of orders) {
    for (const op of o.operations) {
      const d = r.dates[opKey(o.id, op.no)]
      if (d && op.status !== "Completed" && op.status !== "Cancelled") {
        op.start = op.status === "In Progress" ? op.start : d[0]
        op.finish = d[1]
      }
    }
    const last = [...o.operations].sort((a, b) => b.no - a.no)[0]
    const first = [...o.operations].sort((a, b) => a.no - b.no)[0]
    if (last && SCHEDULABLE.has(o.status)) {
      o.finish = last.finish
      if (o.status === "Created" || o.status === "Released") o.start = first.start
    }
  }
}

export interface Bucket {
  week: ISODate
  hours: number
  capacity: number
}
/** Weekly load buckets per work center from a schedule result. */
export function weeklyBuckets(w: EffectiveWc, r: ScheduleResult, from: ISODate, weeks: number): Bucket[] {
  const out: Bucket[] = []
  let ws = weekStart(from)
  for (let i = 0; i < weeks; i++) {
    let hours = 0
    let capacity = 0
    for (let d = 0; d < 7; d++) {
      const day = addCalDays(ws, d)
      hours += r.load[w.id]?.[day] ?? 0
      capacity += dailyCapacity(w, day)
    }
    out.push({ week: ws, hours, capacity })
    ws = addCalDays(ws, 7)
  }
  return out
}

/** Freeze horizon: inside N working days (default 5, per WC) the schedule does not auto-move
 *  [DOC:p.193 §3] (asserted). Both the default and the per-WC parameter are the PRD's. */
export const FREEZE_DAYS = 5
export const freezeDaysOf = (s: Pick<PlanningProductionState, "wc">, wcId?: string) => (wcId ? s.wc[wcId]?.freezeDays : undefined) ?? FREEZE_DAYS
export const freezeEnd = (from: ISODate = TODAY, days = FREEZE_DAYS) => addWorkdays(from, days)

// ------------------------------------------------------------------ cost and variance math
export const laborRateOf = (c: CostStd) => (c.hours ? c.labor / c.hours : 0)
export const ohRateOf = (c: CostStd) => (c.hours ? c.overhead / c.hours : 0)
export const stdTotal = (c: CostStd) => c.material + c.labor + c.overhead + c.subcontract

export function woWip(s: Pick<PlanningProductionState, "journal">, woId: string) {
  const rows = s.journal.filter((j) => j.source.type === "productionOrder" && j.source.id === woId)
  const by = (t: number) => rows.filter((j) => j.template === t).reduce((a, j) => a + j.wip1320, 0)
  return {
    material: by(28),
    labor: by(29),
    subcontract: by(35),
    scrap: by(30),
    receipt: by(31),
    settled: by(32),
    rework: by(33),
    total: rows.reduce((a, j) => a + j.wip1320, 0),
  }
}

/** Variance split per Book I D §8.2 / Part A §8 [DOC:p.78] (asserted). Labor is applied by #29 at
 *  standard rates, so the labor rate variance carries no WIP residual in the prototype (design). */
export function variances(s: Pick<PlanningProductionState, "journal" | "confirmations">, wo: PPWorkOrder) {
  const w = woWip(s, wo.id)
  const good = goodQty(wo)
  const per = wo.qty ? good / wo.qty : 1
  const stdMat = wo.costStd.material * per
  const stdHours = wo.costStd.hours * per
  const actHours = s.confirmations.filter((c) => c.woId === wo.id).reduce((a, c) => a + c.hours, 0)
  const lr = laborRateOf(wo.costStd)
  const oh = ohRateOf(wo.costStd)
  const mat = w.material + w.scrap + w.rework - stdMat // scrap is negative in WIP terms
  const lev = (actHours - stdHours) * lr
  const oav = (actHours - stdHours) * oh
  const lrv = 0
  const residual = w.total
  // Rounding and the subcontract difference land on material usage so the order clears to exactly zero.
  const adj = residual - (mat + lev + oav + lrv)
  return { stdMat, stdHours, actHours, lr, oh, mat: round2(mat + adj), lrv, lev: round2(lev), oav: round2(oav), residual: round2(residual), wip: w }
}

export const round2 = (n: number) => Math.round(n * 100) / 100
export function goodQty(wo: PPWorkOrder) {
  if (wo.scrapDisposedOn) return 0
  const last = [...wo.operations].filter((o) => o.status !== "Cancelled").sort((a, b) => b.no - a.no)[0]
  return last && last.status === "Completed" ? last.confirmedGood : wo.qty
}

export const SHIP_PREP_DAYS = 3 // design: paint/pack ops are in the routing; this is staging to the truck
export const TRANSIT_BUFFER_DAYS = 3 // design: "promise minus transit buffer" [DOC:p.193 §5]; buffer value not given

/** Projected completion for an order from its operations. */
export const projected = (wo: PPWorkOrder) => [...wo.operations].filter((o) => o.status !== "Cancelled").sort((a, b) => b.no - a.no)[0]?.finish ?? wo.finish

export function deterministic(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export type { WorkCenterId }
