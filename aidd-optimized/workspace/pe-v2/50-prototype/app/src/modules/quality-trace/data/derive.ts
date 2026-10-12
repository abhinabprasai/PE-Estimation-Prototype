// Read-only derivations shared by the quality-trace screens.
import { daysBetween } from "@/lib/format"
import type { InspectionLot, PlanRevision, QtCharacteristic, QtPlan, ResultRow } from "./types"

interface HasPlans {
  plans: QtPlan[]
}

export function planOf(s: HasPlans, id?: string, rev?: string): { plan?: QtPlan; rev?: PlanRevision } {
  const plan = s.plans.find((p) => p.id === id)
  return { plan, rev: plan?.revisions.find((r) => r.rev === rev) }
}
export const currentRev = (p: QtPlan) => [...p.revisions].reverse().find((r) => r.status === "Active") ?? p.revisions[p.revisions.length - 1]
export const latestRev = (p: QtPlan) => p.revisions[p.revisions.length - 1]

/** The characteristics an inspection executes: exactly the plan revision's rows, or ad-hoc rows. */
export function lotChars(s: HasPlans, l: InspectionLot): QtCharacteristic[] {
  if (l.adHoc) return l.adHocRows ?? []
  return planOf(s, l.planId, l.planRev).rev?.characteristics ?? []
}

/** Automatic Pass / Fail from bounds (quantitative) or the attribute (attributive). */
export function charOutcome(c: QtCharacteristic, r?: ResultRow): "Pass" | "Fail" | "NA" | undefined {
  if (!r) return undefined
  if (c.charType === "Attributive") return r.attr
  if (r.value == null) return undefined
  if (c.min != null && r.value < c.min) return "Fail"
  if (c.max != null && r.value > c.max) return "Fail"
  return "Pass"
}

export const fmtBounds = (c: QtCharacteristic) => {
  if (c.charType === "Attributive") return c.parameter
  const u = c.uom ? ` ${c.uom}` : ""
  if (c.min != null && c.max != null) return `${c.min} to ${c.max}${u}${c.target != null ? ` (target ${c.target})` : ""}`
  if (c.min != null) return `≥ ${c.min}${u}`
  if (c.max != null) return `≤ ${c.max}${u}${c.target != null ? ` (design ${c.target})` : ""}`
  return c.parameter
}

export const lotAge = (l: InspectionLot, today: string) => daysBetween(l.createdOn, today)
export const lotOverdue = (l: InspectionLot, today: string) => !l.decision && lotAge(l, today) > l.slaDays
