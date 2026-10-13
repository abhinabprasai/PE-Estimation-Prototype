// Workflow analytics for each workflow owner's monthly review (feeds the W.4 governance loop) [DOC:p.217 Book IV §7.7]:
// SLA attainment, aging by step, bottleneck approvers, rejection rates, delegation usage and override frequency.
// Pure functions over the inbox rows of both queues (lib/engine.ts). The PRD names the measures, not their formulas;
// the formulas below are reading AR-31 and are shown on the screen.

import type { Role } from "@/data/domain"
import { W4_ALL } from "../data/catalog"
import type { InboxRow } from "./engine"
import { hoursBetween } from "./time"
import { NOW } from "../data/seed"

export interface WfStats {
  wfId: string
  workflow: string
  owner: string
  requests: number
  open: number
  decidedRequests: number
  rejectedRequests: number
  /** Steps decided in the month, and how many of them met their SLA. */
  stepsDecided: number
  stepsWithinSla: number
  /** Decided steps taken by a delegate (delegation usage). */
  delegated: number
  /** Decided steps taken after the SLA had already breached, or by a delegate (override frequency, AR-31). */
  overrides: number
  /** Open steps by age against SLA. */
  aging: { within: number; near: number; over: number }
}
export interface ApproverStats {
  role: Role
  stepsDecided: number
  avgHours: number
  open: number
  overdue: number
}
export interface StepAging {
  wfId: string
  step: string
  within: number
  near: number
  over: number
}

const inMonth = (iso: string, month: string) => month === "all" || iso.startsWith(month)

export function analyse(rows: InboxRow[], month: string) {
  const byWf = new Map<string, WfStats>()
  const approvers = new Map<Role, { n: number; hours: number; open: number; overdue: number }>()
  const aging: StepAging[] = []
  const stat = (wfId: string): WfStats => {
    let s = byWf.get(wfId)
    if (!s) {
      const w = W4_ALL.find((x) => x.id === wfId)
      s = { wfId, workflow: w?.workflow ?? wfId, owner: w?.owner ?? "Outside W.4", requests: 0, open: 0, decidedRequests: 0, rejectedRequests: 0, stepsDecided: 0, stepsWithinSla: 0, delegated: 0, overrides: 0, aging: { within: 0, near: 0, over: 0 } }
      byWf.set(wfId, s)
    }
    return s
  }
  const ap = (role: Role) => {
    let a = approvers.get(role)
    if (!a) {
      a = { n: 0, hours: 0, open: 0, overdue: 0 }
      approvers.set(role, a)
    }
    return a
  }
  for (const r of rows) {
    const s = stat(r.wfId)
    const touched = r.steps.some((st) => st.decided && inMonth(st.decided.on, month)) || (!r.outcome && month === "all") || (!r.outcome && inMonth(NOW, month)) || inMonth(r.raisedAt, month)
    if (!touched) continue
    s.requests++
    if (!r.outcome) s.open++
    else {
      s.decidedRequests++
      if (r.outcome === "Rejected") s.rejectedRequests++
    }
    r.steps.forEach((st, n) => {
      if (st.decided && inMonth(st.decided.on, month) && st.openedAt) {
        const h = hoursBetween(st.openedAt, st.decided.on)
        const within = h <= st.slaHours
        s.stepsDecided++
        if (within) s.stepsWithinSla++
        const delegated = !!st.decided.onBehalfOf
        if (delegated) s.delegated++
        if (delegated || !within) s.overrides++
        const a = ap(st.role)
        a.n++
        a.hours += h
      }
      if (r.open.includes(n) && st.openedAt) {
        const age = hoursBetween(st.openedAt, NOW)
        const ratio = age / st.slaHours
        const bucket = ratio > 1 ? "over" : ratio >= 0.5 ? "near" : "within"
        s.aging[bucket]++
        const a = ap(st.role)
        a.open++
        if (ratio > 1) a.overdue++
        let row = aging.find((x) => x.wfId === r.wfId && x.step === `${n + 1}. ${st.role}`)
        if (!row) {
          row = { wfId: r.wfId, step: `${n + 1}. ${st.role}`, within: 0, near: 0, over: 0 }
          aging.push(row)
        }
        row[bucket]++
      }
    })
  }
  const workflows = [...byWf.values()].sort((a, b) => a.wfId.localeCompare(b.wfId))
  const bottlenecks: ApproverStats[] = [...approvers.entries()]
    .map(([role, a]) => ({ role, stepsDecided: a.n, avgHours: a.n ? a.hours / a.n : 0, open: a.open, overdue: a.overdue }))
    .sort((x, y) => y.overdue - x.overdue || y.avgHours - x.avgHours)
  return { workflows, bottlenecks, aging: aging.sort((a, b) => b.over - a.over || a.wfId.localeCompare(b.wfId)) }
}

/** Months with a decision on any row, newest first. */
export const monthsOf = (rows: InboxRow[]) =>
  [...new Set(rows.flatMap((r) => r.steps.filter((s) => s.decided).map((s) => s.decided!.on.slice(0, 7))))].sort().reverse()

export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "no data")
