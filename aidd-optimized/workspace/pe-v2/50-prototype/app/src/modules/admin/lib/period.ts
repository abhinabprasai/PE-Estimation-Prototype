// Period gate: every posting validates the period of its posting date [DOC:p.41 §9.1], against the
// module behavior matrix [DOC:pp.41-42 §9.2], the back-posting policy [DOC:p.42 §9.4] and the
// standard errors E-PER-01..04 [DOC:p.42 §9.5] (all asserted). Pure functions over the admin slice.

import type { LegalEntityId } from "@/data/domain"
import { BEHAVIOR_MATRIX, fillMsg, type EPerCode } from "../data/catalog"
import type { Period } from "../data/types"
import { nextMonth } from "./time"

export interface GateResult {
  level: "post" | "warn" | "block"
  code?: EPerCode
  message: string
  period?: Period
}

const isClosed = (p: Period) => p.status === "Hard Close" || p.status === "Year-End Closed"

/** Validate a posting date for an entity and a transaction row of the behavior matrix. */
export function checkPostingDate(periods: Period[], entityId: LegalEntityId, date: string, transaction: string = BEHAVIOR_MATRIX[0][0]): GateResult {
  const row = BEHAVIOR_MATRIX.find((r) => r[0] === transaction) ?? BEHAVIOR_MATRIX[0]
  if (row[1].startsWith("Always allowed")) return { level: "post", message: `${transaction}: ${row[1]}.` }
  const month = date.slice(0, 7)
  const mine = periods.filter((p) => p.entityId === entityId)
  const open = mine.find((p) => p.status === "Open")
  const period = mine.find((p) => p.month === month)
  // Future beyond the next open period (E-PER-04).
  if (open && month > nextMonth(open.month)) return { level: "block", code: "E-PER-04", message: fillMsg("E-PER-04", { date }) }
  if (!period) {
    if (open && month > open.month) return { level: "block", code: "E-PER-04", message: fillMsg("E-PER-04", { date }) }
    return { level: "block", code: "E-PER-01", message: fillMsg("E-PER-01", { date, period: month }) }
  }
  if (isClosed(period)) return { level: "block", code: "E-PER-01", message: fillMsg("E-PER-01", { date, period: month }), period }
  if (period.status === "Soft Close") {
    if (row[2].startsWith("Blocked")) return { level: "block", message: `${transaction} in Soft Close: ${row[2]}.`, period }
    return { level: "warn", code: "E-PER-02", message: `${fillMsg("E-PER-02", { period: month })} (${row[2]})`, period }
  }
  return { level: "post", message: `Period ${month} is Open: ${row[1]}.`, period }
}

/** R-PER-01: always exactly one Open and at most one Soft Close period per entity [DOC:p.42 §9.3]. */
export function rPer01(periods: Period[], entityId: LegalEntityId) {
  const mine = periods.filter((p) => p.entityId === entityId)
  return { open: mine.filter((p) => p.status === "Open"), soft: mine.filter((p) => p.status === "Soft Close") }
}
