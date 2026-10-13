// FX-PRD-REPORTS: the six production reports of Book I D §12 [DOC:p.82]: Order Status / Late Orders,
// Scrap Pareto, Efficiency, Throughput, WIP Aging, Genealogy (per serial). Pure functions over the
// slice. Prior-month history for the trend views is seeded here (fictitious, design values) because
// the live seed holds only the current weeks; live records add to it.

import type { ISODate } from "@/data/domain"
import { MATERIALS, TODAY } from "@/data/shared"
import { addCalDays, allWorkCenters, goodQty, opHours, projected, stdTotal, TRANSIT_BUFFER_DAYS, addWorkdays, woWip, workdaysBetween } from "./plan"
import { isOpenWo } from "./actions"
import type { PPWorkOrder, PlanningProductionState } from "../data/types"

type S = PlanningProductionState
const day = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

export const REPORTS = [
  { id: "order-status", title: "Order status and late orders", blurb: "All open production orders against the schedule; late and at-risk, with the pegged sales order exposure.", source: "Book I D §12" },
  { id: "scrap-pareto", title: "Scrap Pareto", blurb: "Scrap value by reason code, work center and item, with the monthly trend.", source: "Book I D §12" },
  { id: "efficiency", title: "Efficiency", blurb: "Standard hours earned against actual hours by work center and crew; utilization against capacity.", source: "Book I D §12" },
  { id: "throughput", title: "Throughput", blurb: "Units and standard value produced per period per product line.", source: "Book I D §12" },
  { id: "wip-aging", title: "WIP aging", blurb: "Open order value by age bucket, and stalled orders with no confirmation in N days.", source: "Book I D §12" },
  { id: "genealogy", title: "Genealogy (per serial)", blurb: "The complete build record of one unit: batches consumed by operation, child serials, operators, inspections and test results.", source: "Book I D §12; INV 10.4" },
] as const
export type ReportId = (typeof REPORTS)[number]["id"]

// ------------------------------------------------------------------ 1. order status
export interface StatusRow { wo: PPWorkOrder; projected: ISODate; due?: ISODate; daysLate: number; state: "Late" | "At risk" | "On schedule"; pegs: string; exposure: number }
export function orderStatus(s: S): StatusRow[] {
  return s.productionOrders.filter((w) => isOpenWo(w)).map((wo) => {
    const p = projected(wo)
    const limit = wo.promiseDate ? addWorkdays(wo.promiseDate, -TRANSIT_BUFFER_DAYS) : undefined
    const due = wo.dueDate as ISODate | undefined
    const late = due && p > due ? workdaysBetween(due, p) : 0
    const state: StatusRow["state"] = late > 0 ? "Late" : limit && p > limit ? "At risk" : wo.status === "On Hold" ? "At risk" : "On schedule"
    return { wo, projected: p, due, daysLate: late, state, pegs: wo.pegs.map((g) => `${g.soId}/${g.line}`).join(", "), exposure: wo.pegs.length ? Math.round(stdTotal(wo.costStd)) : 0 }
  }).sort((a, b) => (a.state === b.state ? b.daysLate - a.daysLate : a.state === "Late" ? -1 : b.state === "Late" ? 1 : a.state === "At risk" ? -1 : 1))
}

// ------------------------------------------------------------------ 2. scrap
export interface ScrapRow { month: string; reason: string; wcId: string; itemId: string; value: number; qty: number; live: boolean }
/** Seeded history of earlier months (fictitious, design values). */
const SCRAP_HISTORY: ScrapRow[] = [
  { month: "2026-05", reason: "SR-02 lamination burr out of tolerance", wcId: "WC-100", itemId: "FIN-TBD-2500PM", value: 1840, qty: 3, live: false },
  { month: "2026-05", reason: "SR-04 winding insulation damage", wcId: "WC-210", itemId: "FIN-TBD-5000SS", value: 4120, qty: 1, live: false },
  { month: "2026-06", reason: "SR-02 lamination burr out of tolerance", wcId: "WC-100", itemId: "FIN-TBD-1000PM", value: 960, qty: 2, live: false },
  { month: "2026-06", reason: "SR-01 operator error", wcId: "WC-220", itemId: "FIN-TBD-2500PM", value: 740, qty: 1, live: false },
  { month: "2026-07", reason: "SR-04 winding insulation damage", wcId: "WC-210", itemId: "FIN-TBD-7500MTO", value: 5260, qty: 1, live: false },
  { month: "2026-07", reason: "SR-03 material defect", wcId: "WC-300", itemId: "FIN-TBD-0167PL", value: 410, qty: 4, live: false },
  { month: "2026-08", reason: "SR-02 lamination burr out of tolerance", wcId: "WC-100", itemId: "FIN-TBD-2500PM", value: 1520, qty: 2, live: false },
  { month: "2026-08", reason: "SR-05 test failure beyond repair", wcId: "WC-500", itemId: "FIN-TBD-5000SS", value: 6900, qty: 1, live: false },
  { month: "2026-09", reason: "SR-03 material defect", wcId: "WC-300", itemId: "FIN-TBD-1000PM", value: 880, qty: 2, live: false },
  { month: "2026-09", reason: "SR-01 operator error", wcId: "WC-400", itemId: "FIN-TBD-2500PM", value: 560, qty: 1, live: false },
]
export function scrapRows(s: S): ScrapRow[] {
  const live: ScrapRow[] = s.confirmations.filter((c) => c.scrap > 0 && !c.reversalOf && !c.reversedBy).map((c) => {
    const w = s.productionOrders.find((x) => x.id === c.woId)
    const o = w?.operations.find((x) => x.no === c.op)
    const je = s.journal.filter((j) => j.template === 30 && j.cnfId === c.id).reduce((a, j) => a + j.amount, 0)
    return { month: c.at.slice(0, 7), reason: c.scrapReason ?? "SR-?? reason not recorded", wcId: o?.workCenterId ?? "", itemId: w?.itemId ?? "", value: je || (w ? (w.costStd.material / Math.max(1, w.qty)) * c.scrap : 0), qty: c.scrap, live: true }
  })
  return [...SCRAP_HISTORY, ...live]
}
export function pareto(rows: ScrapRow[], by: "reason" | "wcId" | "itemId") {
  const m = new Map<string, { value: number; qty: number }>()
  for (const r of rows) {
    const k = by === "reason" ? r.reason.split(" ")[0] + " " + r.reason.split(" ").slice(1).join(" ") : r[by]
    const x = m.get(k) ?? { value: 0, qty: 0 }
    x.value += r.value
    x.qty += r.qty
    m.set(k, x)
  }
  const sorted = [...m.entries()].map(([k, v]) => ({ key: k, value: Math.round(v.value), qty: v.qty })).sort((a, b) => b.value - a.value)
  const total = sorted.reduce((a, x) => a + x.value, 0)
  let cum = 0
  return sorted.map((x) => ((cum += x.value), { ...x, cum: total ? Math.round((cum / total) * 100) : 0 }))
}
export const scrapTrend = (rows: ScrapRow[]) => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.month, (m.get(r.month) ?? 0) + r.value)
  return [...m.entries()].sort().map(([month, value]) => ({ month, value: Math.round(value) }))
}

// ------------------------------------------------------------------ 3. efficiency
export interface EffRow { key: string; label: string; earned: number; actual: number; eff: number; capacity: number; util: number }
export function efficiency(s: S, by: "wc" | "crew", sinceDays = 90): EffRow[] {
  const from = addCalDays(TODAY as ISODate, -sinceDays)
  const m = new Map<string, { earned: number; actual: number }>()
  for (const c of s.confirmations) {
    if (c.at < from || c.hours <= 0 || c.reversedBy) continue
    const w = s.productionOrders.find((x) => x.id === c.woId)
    const o = w?.operations.find((x) => x.no === c.op)
    if (!w || !o) continue
    const earned = opHours(o) * o.crew * ((c.good + c.rework) / Math.max(1, w.qty))
    const key = by === "wc" ? o.workCenterId : (s.crewRoster.find((r) => r.active && r.wcId === o.workCenterId)?.id ?? `CRW-none-${o.workCenterId}`)
    const x = m.get(key) ?? { earned: 0, actual: 0 }
    x.earned += earned
    x.actual += c.hours
    m.set(key, x)
  }
  const wcs = allWorkCenters(s)
  const weeks = Math.max(1, sinceDays / 7)
  return [...m.entries()].map(([key, v]) => {
    const wcId = by === "wc" ? key : s.crewRoster.find((r) => r.id === key)?.wcId ?? key.replace("CRW-none-", "")
    const wc = wcs.find((w) => w.id === wcId)
    const capacity = wc ? ((wc.shifts * wc.hoursPerShift * wc.stations * wc.efficiencyPct) / 100) * 5 * weeks : 0
    const label = by === "wc" ? `${key} ${wc?.name ?? ""}` : s.crewRoster.find((r) => r.id === key)?.name ?? `No crew on roster (${wcId})`
    return { key, label, earned: Math.round(v.earned * 10) / 10, actual: Math.round(v.actual * 10) / 10, eff: v.actual ? Math.round((v.earned / v.actual) * 100) : 0, capacity: Math.round(capacity), util: capacity ? Math.round((v.actual / capacity) * 100) : 0 }
  }).sort((a, b) => a.key.localeCompare(b.key))
}

// ------------------------------------------------------------------ 4. throughput
export interface ThroughputRow { month: string; line: string; units: number; value: number }
export const lineOf = (itemId: string) => {
  const d = MATERIALS.find((m) => m.id === itemId)?.description ?? itemId
  return /pole/i.test(d) ? "Pole-mount" : /pad/i.test(d) ? "Pad-mount" : /(20 ?MVA|substation|7\.5|7500|5000|5 ?MVA)/i.test(d) ? "Substation and ETO" : "Other"
}
const THROUGHPUT_HISTORY: ThroughputRow[] = [
  { month: "2026-05", line: "Pole-mount", units: 42, value: 189000 }, { month: "2026-05", line: "Pad-mount", units: 14, value: 266000 }, { month: "2026-05", line: "Substation and ETO", units: 2, value: 640000 },
  { month: "2026-06", line: "Pole-mount", units: 38, value: 171000 }, { month: "2026-06", line: "Pad-mount", units: 16, value: 304000 }, { month: "2026-06", line: "Substation and ETO", units: 1, value: 410000 },
  { month: "2026-07", line: "Pole-mount", units: 45, value: 202500 }, { month: "2026-07", line: "Pad-mount", units: 12, value: 228000 }, { month: "2026-07", line: "Substation and ETO", units: 2, value: 655000 },
  { month: "2026-08", line: "Pole-mount", units: 40, value: 180000 }, { month: "2026-08", line: "Pad-mount", units: 18, value: 342000 }, { month: "2026-08", line: "Substation and ETO", units: 1, value: 395000 },
]
export function throughput(s: S): ThroughputRow[] {
  const m = new Map<string, ThroughputRow>(THROUGHPUT_HISTORY.map((r) => [`${r.month}|${r.line}`, { ...r }]))
  for (const w of s.productionOrders) {
    if (!w.fgReceivedOn) continue
    const k = `${w.fgReceivedOn.slice(0, 7)}|${lineOf(w.itemId)}`
    const x = m.get(k) ?? { month: w.fgReceivedOn.slice(0, 7), line: lineOf(w.itemId), units: 0, value: 0 }
    x.units += goodQty(w)
    x.value += Math.round((stdTotal(w.costStd) / Math.max(1, w.qty)) * goodQty(w))
    m.set(k, x)
  }
  return [...m.values()].sort((a, b) => a.month.localeCompare(b.month) || a.line.localeCompare(b.line))
}

// ------------------------------------------------------------------ 5. WIP aging
export const AGE_BUCKETS = [["0-7 days", 0, 7], ["8-14 days", 8, 14], ["15-30 days", 15, 30], ["Over 30 days", 31, 9999]] as const
export interface AgingRow { wo: PPWorkOrder; age: number; bucket: string; value: number; lastConfirmed?: ISODate; idleDays: number; stalled: boolean }
/** Stalled = no confirmation in N days. N = 5 is a design value (the PRD says "N days"). */
export const STALLED_DAYS = 5
export function wipAging(s: S, stalledDays = STALLED_DAYS): AgingRow[] {
  return s.productionOrders.filter((w) => ["Released", "In Progress", "Testing", "On Hold"].includes(w.status)).map((wo) => {
    const age = Math.max(0, day(wo.start, TODAY))
    const conf = s.confirmations.filter((c) => c.woId === wo.id && !c.reversalOf).map((c) => c.at).sort().at(-1) as ISODate | undefined
    const idle = day(conf ?? wo.start, TODAY)
    return { wo, age, bucket: AGE_BUCKETS.find(([, a, b]) => age >= a && age <= b)![0], value: Math.round(woWip(s, wo.id).total), lastConfirmed: conf, idleDays: idle, stalled: idle >= stalledDays }
  }).sort((a, b) => b.age - a.age)
}
