// Release checks for a production order [DOC:p.74 §5.2] (asserted), extended by E-PP-08 "material
// blocked for production" [DOC:p.157 Book II §8] (asserted); and the close checks [DOC:p.78 §8.2].
// Material availability is a full-kit check against reservations: orders already released hold their
// remaining requirement first (design reading of "against reservations").

import { MATERIALS, TODAY } from "@/data/shared"
import { addCalDays } from "./plan"
import type { PPWorkOrder, PlanningProductionState } from "../data/types"

export interface GateRow {
  no: number
  name: string
  code?: string
  state: "pass" | "fail" | "warn" | "n/a"
  detail: string
  source: string
}

export interface Shortage {
  materialId: string
  need: number
  available: number
  short: number
  supply?: string
  supplyDate?: string
}

const RESERVING = new Set(["Released", "In Progress", "Testing", "On Hold"])

function remainingNeeds(wo: PPWorkOrder) {
  const m = new Map<string, number>()
  for (const op of wo.operations.filter((o) => o.status !== "Cancelled"))
    for (const c of op.components) {
      const left = c.qtyPerUnit * wo.qty - c.issued
      if (left > 0) m.set(c.materialId, (m.get(c.materialId) ?? 0) + left)
    }
  return m
}

/** Full-kit check: what this order still needs against what is unrestricted and not reserved. */
export function shortages(s: PlanningProductionState, wo: PPWorkOrder): Shortage[] {
  const out: Shortage[] = []
  const needs = remainingNeeds(wo)
  for (const [mat, need] of needs) {
    const serialized = s.serials.some((x) => x.materialId === mat)
    let available: number
    if (serialized) {
      available = s.serials.filter((x) => x.materialId === mat && (x.status === "Available" || (x.status === "Reserved" && x.woId === wo.id)) && s.batches.find((b) => b.id === x.batchId)?.stock !== "Blocked").length
    } else {
      const onHand = s.batches.filter((b) => b.materialId === mat && b.stock === "Unrestricted").reduce((a, b) => a + b.qty, 0)
      const reserved = s.productionOrders
        .filter((o) => o.id !== wo.id && RESERVING.has(o.status))
        .reduce((a, o) => a + (remainingNeeds(o).get(mat) ?? 0), 0)
      available = Math.max(0, onHand - (RESERVING.has(wo.status) ? 0 : reserved))
    }
    if (need > available + 0.001) {
      const plo = s.plannedOrders.find((p) => p.materialId === mat && p.kind === "buy" && p.state !== "Cancelled")
      out.push({ materialId: mat, need, available, short: need - available, supply: plo ? (plo.convertedTo ?? plo.id) : undefined, supplyDate: plo?.finish })
    }
  }
  return out
}

export function releaseGates(s: PlanningProductionState, wo: PPWorkOrder): GateRow[] {
  const rtg = s.routings.find((r) => r.id === wo.routingId && r.rev === wo.routingRev)
  const item = MATERIALS.find((m) => m.id === wo.itemId)
  const short = shortages(s, wo)
  const comps = [...new Set(wo.operations.flatMap((o) => o.components.map((c) => c.materialId)))]
  const blocked = [wo.itemId, ...comps].filter((id) => {
    const m = MATERIALS.find((x) => x.id === id)
    return m && (m.status === "Blocked" || m.blocks.some((b) => b.block === "Production Block"))
  })
  const eto = wo.orderType === "ETO"
  return [
    {
      no: 1, name: "MBOM and routing revisions Released", code: "E-PP-01",
      state: wo.gateInputs.mbomActive && rtg?.status === "Released" ? "pass" : "fail",
      detail: `MBOM rev ${wo.mbomRev} ${wo.gateInputs.mbomActive ? "Active" : "not active"}; routing ${wo.routingId} rev ${wo.routingRev} ${rtg?.status ?? "not found"}`,
      source: "[DOC:p.74 §5.2 check 1]",
    },
    {
      no: 2, name: "Material availability: full kit against reservations",
      state: short.length === 0 ? "pass" : wo.releaseShortFlag ? "warn" : "fail",
      detail: short.length === 0 ? "All components available" : `${short.length} short: ${short.map((x) => `${x.materialId} short ${fmtQ(x.short)}${x.supplyDate ? ` (supply ${x.supply} ${x.supplyDate})` : " (no supply)"}`).join("; ")}${wo.releaseShortFlag ? `. Release Short flag set by the Planner on ${wo.releaseShortFlag.on}` : ". Release with shortages needs the Planner's Release Short flag"}`,
      source: "[DOC:p.74 §5.2 check 2]",
    },
    {
      no: 3, name: "Drawings Released and customer approval milestone (ETO)", code: "E-PP-03",
      state: !eto ? "n/a" : wo.gateInputs.drawingsReleased === true && wo.gateInputs.customerApproval === true ? "pass" : "fail",
      detail: !eto ? "Not an ETO order" : `Deliverables list drawings ${wo.gateInputs.drawingsReleased === true ? "all Released" : "not all Released"}; customer approval ${wo.gateInputs.customerApproval === true ? "complete" : "pending"}`,
      source: "[DOC:p.74 §5.2 check 3]",
    },
    {
      no: 4, name: "Inspection plans Active for every QC checkpoint operation", code: "E-PP-04",
      state: wo.gateInputs.inspectionPlansActive ? "pass" : "fail",
      detail: `${wo.operations.filter((o) => o.qcGate).length} checkpoint operations; ${wo.gateInputs.inspectionPlansActive ? "all plans Active" : "plan IP-TBD-INP-WND-PM is In Review, not Active"}`,
      source: "[DOC:p.74 §5.2 check 4]",
    },
    {
      no: 5, name: "Standard cost exists for the item",
      state: item?.stdCost != null ? "pass" : "warn",
      detail: item?.stdCost != null ? `Standard cost ${item.stdCost.toLocaleString("en-US")} USD per ${item.baseUom}` : `No standard cost: warning; release adds the item to the CVA exception list${s.cvaExceptions.some((x) => x.woId === wo.id) ? ` (${s.cvaExceptions.find((x) => x.woId === wo.id)!.id})` : ""}. Release is not blocked`,
      source: "[DOC:p.74 §5.2 check 5]",
    },
    {
      no: 6, name: "Item and components not blocked for production", code: "E-PP-08",
      state: blocked.length || wo.gateInputs.productionBlock ? "fail" : "pass",
      detail: blocked.length ? `Production Block or Blocked: ${blocked.join(", ")}` : "No Production Block on the item or its components",
      source: "[DOC:p.157 Book II §8]",
    },
  ]
}

export const fmtQ = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })

export function canRelease(gates: GateRow[]) {
  return gates.every((g) => g.state !== "fail")
}

/** Close is allowed when all ops are confirmed or cancelled, all inspections closed, FG received or
 *  scrap-disposed [DOC:p.78 §8.2] (asserted); production rework merges first (§9). */
export function closeChecks(s: PlanningProductionState, wo: PPWorkOrder) {
  // An Open rework order that never collected anything is not waiting to merge when the unit was
  // scrap-disposed or its quantity was withdrawn by a confirmation reversal (design reading).
  const idle = (r: (typeof s.reworkOrders)[number]) => r.status === "Open" && !r.ops.length && !r.materials.length && (!!wo.scrapDisposedOn || r.qty === 0)
  const openRwo = s.reworkOrders.filter((r) => r.parentWoId === wo.id && r.status !== "Settled" && !idle(r))
  return [
    { name: "All operations confirmed or cancelled", ok: wo.operations.every((o) => o.status === "Completed" || o.status === "Cancelled") },
    { name: "All inspections closed", ok: wo.operations.every((o) => !o.inspection || !!o.inspection.result) },
    { name: "FG received or scrap-disposed", ok: !!wo.fgReceivedOn || !!wo.scrapDisposedOn, detail: wo.scrapDisposedOn ? `scrap-disposed ${wo.scrapDisposedOn}` : undefined },
    { name: "Production rework orders settled into this order", ok: openRwo.length === 0, detail: openRwo.map((r) => `${r.id} ${r.status}`).join(", ") },
  ]
}

/** Completed over 5 days unsettled is a breach [DOC:p.126; p.179 f13] (asserted); calendar days. */
export const unsettledBreach = (wo: PPWorkOrder) => wo.status === "Completed" && !!wo.completedOn && addCalDays(wo.completedOn, 5) < TODAY
