// Period-close checklist additions (Book I Part J, ACC 26.2 steps 5b, 6b-6e, 9b) and the inventory
// tie-out by valuation class (Book II §13). Each step reads the report of the module that owns the
// data and answers Passed or Held; a held step holds the gate and never passes silently
// (FL-06 field 10). Source: 03-bookI ... "Period Close Additions" [DOC: Book I Part J] (asserted).

import { TODAY } from "@/data/shared"
import type { SliceStates } from "@/store"
import type { CloseSignoff, InventoryOpsState } from "../data/types"
import { VC_BY_TYPE, VC_ORDER, round2, subledgerByClass } from "./rules"
import { businessDaysBetween } from "./dates"
import { icViews, icBlocksClose } from "./ic"

export type StepResult = "Passed" | "Held" | "Not run" | "Not applicable"
export interface CloseStep {
  id: string
  label: string
  /** The PRD's validation text. */
  validation: string
  result: StepResult
  detail: string
  /** Where the work is done. */
  link?: { to: string; label: string }
  /** Executor is not the approver where flagged (RD-IO-15). */
  flagged?: boolean
  /** Who executed the step's work (for the separation check). */
  executor?: string
  signoff?: CloseSignoff
  /** A step the checklist adds (in the PRD's list) versus a related step shown for the gate. */
  addition: boolean
}
export interface TieRow {
  vc: string
  label: string
  account: string
  subledger: number
  gl: number
  diff: number
  diffs: InventoryOpsState["tieDiffs"]
  open: boolean
}
export interface CloseView {
  key: string
  steps: CloseStep[]
  tie: TieRow[]
  inTransit: number
  /** WIP numbers behind step 6c. */
  wip?: { open: number; gl1320: number; gl1325: number }
  warranty?: { reserve: number; exposure: number; shortfall: number }
  unresolved: number
}
export const closeKey = (entityId: string, month: string) => `${entityId}|${month}`
const MANUFACTURING_ENTITY = "LE-TBD-10"

interface Slices {
  admin: SliceStates["admin"]
  materials: SliceStates["materials"]
  pf: SliceStates["purchasingFinance"]
  pp: SliceStates["planningProduction"]
  sales: SliceStates["sales"]
  io: InventoryOpsState
}

export function evaluateClose(entityId: string, month: string, s: Slices): CloseView {
  const key = closeKey(entityId, month)
  const ran = s.io.closeRuns.some((r) => r.key === key)
  const period = s.admin.periods.find((p) => p.entityId === entityId && p.month === month)
  const manufacturing = entityId === MANUFACTURING_ENTITY
  const sign = (id: string) => s.io.signoffs.find((x) => x.key === key && x.step === id)
  const steps: CloseStep[] = []
  const add = (x: Omit<CloseStep, "signoff" | "result"> & { result: StepResult }) => steps.push({ ...x, result: !ran && x.result !== "Not applicable" ? "Not run" : x.result, signoff: sign(x.id) })

  // ---- 5b allocation cycles posted
  const cycles = s.pf.allocationCycles.filter((c) => c.entityId === entityId && c.status !== "Reversed")
  const missing = cycles.filter((c) => !s.pf.allocRuns.some((r) => r.cycleId === c.id && r.period === month && r.state === "Posted"))
  const lastRun = [...s.pf.allocRuns].filter((r) => r.period === month && cycles.some((c) => c.id === r.cycleId) && r.state === "Posted").sort((a, b) => b.postedOn.localeCompare(a.postedOn))[0]
  add({
    id: "5b", label: "Allocation cycles posted", validation: "All active cycles have a posted run for the period", flagged: true, addition: true,
    result: !cycles.length ? "Not applicable" : missing.length ? "Held" : "Passed",
    detail: !cycles.length ? "No active allocation cycle for this entity" : missing.length ? `${missing.length} of ${cycles.length} active cycle(s) have no posted run for ${month}: ${missing.map((c) => c.id).join(", ")}` : `${cycles.length} active cycle(s), each with a posted run (template #36, net zero)`,
    link: { to: "/controlling/allocations", label: "Open allocation cycles" }, executor: lastRun?.postedBy,
  })
  // ---- 6 subledger reconciliation (tie-out by valuation class)
  const sub = subledgerByClass(s.materials)
  const diffs = s.io.tieDiffs.filter((d) => d.key === key)
  const tie: TieRow[] = VC_ORDER.map((vc) => {
    const t = Object.values(VC_BY_TYPE).find((x) => x.vc === vc)!
    const subledger = round2(sub.byVc.get(vc) ?? 0)
    const d = diffs.filter((x) => x.valuationClass === vc)
    const diff = round2(d.reduce((a, x) => a + x.amount, 0))
    return { vc, label: t.label, account: t.account, subledger, gl: round2(subledger + diff), diff, diffs: d, open: d.some((x) => !x.resolvedAt) }
  })
  const openTie = tie.filter((r) => r.open)
  add({
    id: "6", label: "Subledger reconciliation by valuation class", validation: "Inventory subledger by valuation class ties to the 13xx accounts; a mapping error shows as a class-level difference, not a plug", addition: true,
    result: openTie.length ? "Held" : "Passed",
    detail: openTie.length ? `${openTie.length} valuation class(es) differ from the GL without an explanation: ${openTie.map((r) => `${r.vc} ${r.diff > 0 ? "+" : ""}${r.diff.toLocaleString("en-US")}`).join(", ")}` : "Every valuation class ties to its inventory account",
    link: { to: "/materials/account-determination", label: "Open account determination" },
  })
  // ---- 6b inventory period closed
  const invClosed = !!period && (!!period.inventoryCloseRunAt || period.status === "Hard Close" || period.status === "Year-End Closed")
  add({
    id: "6b", label: "Inventory period closed", validation: "INV 8.3 status = Closed for the period", addition: true,
    result: !period ? "Held" : invClosed ? "Passed" : "Held",
    detail: !period ? "No period record for this entity and month" : invClosed ? `Inventory closed${period.inventoryCloseRunAt ? ` (run ${period.inventoryCloseRunAt.replace("T", " ")})` : ""}` : `Inventory is ${period.status === "Open" ? "Open" : "Closing"}: the inventory close has not run (Open / Closing / Closed map to Open / Soft Close / Hard Close)`,
    link: { to: "/inventory/configuration/fiscal-periods", label: "Open period configuration" },
  })
  // ---- 6c WIP reconciliation
  let wip: CloseView["wip"]
  if (!manufacturing) add({ id: "6c", label: "WIP reconciliation", validation: "Sum of open WO WIP = GL 1320 + 1325 balances", result: "Not applicable", detail: "PE Transformer holds the plant; this entity has no production orders", addition: true })
  else {
    const open = new Set(s.pp.productionOrders.filter((w) => w.status !== "Closed (TECO)" && w.status !== "Cancelled").map((w) => w.id as string))
    const openRwo = new Set(s.pp.reworkOrders.filter((r) => r.status !== "Settled").map((r) => r.id as string))
    let openWip = 0, gl1320 = 0, gl1325 = 0
    for (const j of s.pp.journal) {
      gl1320 += j.wip1320
      gl1325 += j.wip1325
      const isOpen = open.has(j.source.id) || (j.rwoId ? openRwo.has(j.rwoId) : false) || openRwo.has(j.source.id)
      if (isOpen) openWip += j.wip1320 + j.wip1325
    }
    wip = { open: round2(openWip), gl1320: round2(gl1320), gl1325: round2(gl1325) }
    const diff = round2(wip.gl1320 + wip.gl1325 - wip.open)
    add({
      id: "6c", label: "WIP reconciliation", validation: "Sum of open WO WIP = GL 1320 + 1325 balances", addition: true,
      result: Math.abs(diff) < 0.5 ? "Passed" : "Held",
      detail: Math.abs(diff) < 0.5 ? `Open order WIP ${fmt(wip.open)} = GL 1320 ${fmt(wip.gl1320)} + 1325 ${fmt(wip.gl1325)}` : `Open order WIP ${fmt(wip.open)} differs from GL 1320 + 1325 (${fmt(wip.gl1320 + wip.gl1325)}) by ${fmt(diff)}`,
      link: { to: "/production/reports", label: "Open WIP report" },
    })
  }
  // ---- 6d production orders settled
  if (!manufacturing) add({ id: "6d", label: "Production orders settled", validation: "No WO in Completed status older than 5 days unsettled", result: "Not applicable", detail: "No production orders in this entity", addition: true })
  else {
    const late = s.pp.productionOrders.filter((w) => w.status === "Completed" && !w.settledOn && w.completedOn && businessDaysBetween(w.completedOn, TODAY) > 5)
    const completedInPeriod = s.pp.productionOrders.filter((w) => w.status === "Completed" && !w.settledOn).length
    add({
      id: "6d", label: "Production orders settled", validation: "No WO in Completed status older than 5 days unsettled", addition: true,
      result: late.length ? "Held" : "Passed",
      detail: late.length ? `${late.length} order(s) Completed more than 5 days ago and unsettled: ${late.map((w) => w.id).join(", ")}` : `No unsettled order older than 5 days (${completedInPeriod} Completed and within the window)`,
      link: { to: "/production/settlement", label: "Open settlement" },
    })
  }
  // ---- 6e RMA aging review
  if (!manufacturing) add({ id: "6e", label: "RMA aging review", validation: "No RMA in Settling with posted-document gaps", result: "Not applicable", detail: "RMAs are read for PE Transformer only (RD-IO-11)", addition: true })
  else {
    const gaps = s.sales.rmas.filter((r) => r.status === "Settling" && r.settlement.some((x) => !x.done))
    add({
      id: "6e", label: "RMA aging review", validation: "No RMA in Settling with posted-document gaps", addition: true,
      result: gaps.length ? "Held" : "Passed",
      detail: gaps.length ? `${gaps.length} RMA(s) in Settling with a settlement document not yet posted: ${gaps.map((r) => `${r.id} (${r.settlement.filter((x) => !x.done).length} open)`).join(", ")}` : "No Settling RMA with a gap",
      link: { to: "/sales/rma", label: "Open RMA list" },
    })
  }
  // ---- 9b warranty reserve adequacy
  let warranty: CloseView["warranty"]
  if (!manufacturing) add({ id: "9b", label: "Warranty reserve adequacy", validation: "Reserve balance vs open warranty RWO exposure; top-up JE proposed", result: "Not applicable", detail: "No warranty reserve in this entity", addition: true })
  else {
    const open = s.pp.reworkOrders.filter((r) => r.originKind === "RMA warranty" && r.status !== "Settled")
    const exposure = round2(open.reduce((a, r) => a + r.materials.reduce((m, x) => m + x.value, 0) + r.ops.reduce((h, o) => h + o.hours, 0) * r.laborRate, 0))
    const topUp = s.io.topUps.find((t) => t.key === key)
    const reserve = round2((s.io.reserve[key] ?? 0) + (topUp?.amount ?? 0))
    warranty = { reserve, exposure, shortfall: Math.max(0, round2(exposure - reserve)) }
    add({
      id: "9b", label: "Warranty reserve adequacy", validation: "Reserve balance vs open warranty RWO exposure; top-up JE proposed", flagged: true, addition: true,
      result: warranty.shortfall > 0 ? "Held" : "Passed",
      detail: warranty.shortfall > 0 ? `Reserve ${fmt(reserve)} is below open warranty RWO exposure ${fmt(exposure)} (${open.length} order(s)); top-up of ${fmt(warranty.shortfall)} proposed (#24)` : `Reserve ${fmt(reserve)} covers open warranty exposure ${fmt(exposure)}${topUp ? ` (top-up ${topUp.je} posted)` : ""}`,
      link: { to: "/production/rework", label: "Open rework orders" }, executor: topUp?.by,
    })
  }
  // ---- intercompany pairs (FL-06 step 7, not an addition)
  const unexplained = icViews(s.io.icPairs, s.pf).filter((p) => p.month === month && (p.sellerEntityId === entityId || p.buyerEntityId === entityId)).filter(icBlocksClose)
  add({
    id: "IC", label: "Intercompany pairs reconciled", validation: "IC AR = IC AP per pair before Hard Close; close blocks on unexplained pairs", addition: false,
    result: unexplained.length ? "Held" : "Passed",
    detail: unexplained.length ? `${unexplained.length} pair(s) unexplained: ${unexplained.map((p) => p.id).join(", ")}` : "Every pair of the month matches or is explained",
    link: { to: "/inventory-ops/intercompany-recon", label: "Open the recon report" },
  })
  const unresolved = steps.filter((x) => x.result === "Held" || x.result === "Not run" || (x.flagged && x.result === "Passed" && !x.signoff)).length
  return { key, steps, tie, inTransit: round2(sub.inTransit), wip, warranty, unresolved }
}

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export { fmt as fmtUsd }

