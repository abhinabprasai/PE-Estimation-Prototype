// Capable-to-promise [DOC:p.193 Book III E §4] (asserted): explode the BOM and routing, check
// material availability dates (supply picture + lead times for unstocked buys) AND finite capacity
// insertion across constrained work centers; return the earliest feasible completion and ship date
// with the binding constraint named in words. Accepted soft reservations of other quotes are loaded
// first so parallel quotes do not double-promise the same bottleneck slot.
// Lead times below are design values (info records belong to purchasing).

import { MATERIALS, TODAY } from "@/data/shared"
import type { ISODate, MaterialId } from "@/data/domain"
import { newWorkOrder, routingIdFor, routingOps } from "../data/seed"
import type { CtpResult, PlanningProductionState, PromiseCandidate, PPWorkOrder } from "../data/types"
import { addCalDays, addWorkdays, allWorkCenters, schedule, SHIP_PREP_DAYS, weekLabel } from "./plan"
import { shortages } from "./gates"

export const LEAD_WEEKS: Partial<Record<string, number>> = {
  "RAW-TBD-CRGO23": 10, "RAW-TBD-CTC": 6, "RAW-TBD-FOIL": 4, "RAW-TBD-OIL": 2, "RAW-TBD-PLATE": 3, "RAW-TBD-BSH145": 16, "RAW-TBD-BSH015": 8,
  "RAW-TBD-OLTC": 20, "RAW-TBD-RAD": 5, "RAW-TBD-KRAFT": 4, "CONS-TBD-PAINT": 2, "CONS-TBD-WELD": 1, "PACK-TBD-SKID": 2, "PACK-TBD-CRATE": 2,
}
const SHORT_NAME: Record<string, string> = {
  "RAW-TBD-BSH145": "HV bushing", "RAW-TBD-OLTC": "OLTC", "RAW-TBD-CRGO23": "CRGO steel", "RAW-TBD-CTC": "CTC conductor", "RAW-TBD-BSH015": "LV bushing", "RAW-TBD-FOIL": "copper foil",
}

let hypoSeq = 0
function hypothetical(s: PlanningProductionState, itemId: MaterialId, qty: number, start: ISODate, priority: number, tag: string): PPWorkOrder {
  return newWorkOrder(s.wc, { id: `WO-CTP-${tag}-${++hypoSeq}` as PPWorkOrder["id"], item: itemId, qty, orderType: "MTO", priority, created: TODAY, start, by: "CTP" })
}

/** Material availability date: today when covered after reservations, else today + lead time. */
export function materialDate(s: PlanningProductionState, itemId: MaterialId, qty: number): { date: ISODate; driver?: MaterialId } {
  const probe = hypothetical(s, itemId, qty, TODAY, 999, "MAT")
  const short = shortages(s, probe)
  let date = TODAY
  let driver: MaterialId | undefined
  for (const x of short) {
    const d = addCalDays(TODAY, (LEAD_WEEKS[x.materialId] ?? 4) * 7)
    if (d > date) {
      date = d
      driver = x.materialId as MaterialId
    }
  }
  return { date, driver }
}

function lastFinish(r: ReturnType<typeof schedule>, wo: PPWorkOrder) {
  const ops = routingOps(wo.routingId)
  const last = ops[ops.length - 1]
  return r.dates[`${wo.id}/${last.no}`]?.[1] ?? TODAY
}

export function runCtp(s: PlanningProductionState, c: PromiseCandidate, moves: Record<string, ISODate>): CtpResult {
  const t0 = performance.now()
  const mat = materialDate(s, c.itemId, c.qty)
  // soft reservations of other accepted quotes load first
  const others = s.promises
    .filter((p) => p.id !== c.id && p.decision === "Accepted" && p.reservation?.kind === "Soft" && (!p.reservation.expires || p.reservation.expires >= TODAY))
    .map((p, i) => hypothetical(s, p.itemId, p.qty, p.result?.materialDate ?? TODAY, 500 + i, "SOFT"))
  const hypo = hypothetical(s, c.itemId, c.qty, mat.date, 900, "RUN")
  const r = schedule(s, moves, [...others, hypo])
  const completion = lastFinish(r, hypo)
  // the same order on empty capacity: what material alone allows
  const free = schedule({ productionOrders: [], workCenters: s.workCenters, wc: s.wc }, {}, [hypothetical(s, c.itemId, c.qty, mat.date, 900, "FREE")])
  const freeFinish = Object.values(free.dates).reduce((a, d) => (d[1] > a ? d[1] : a), TODAY)
  let binding: string
  let kind: CtpResult["bindingKind"]
  let bindingWc: string | undefined
  if (completion > addWorkdays(freeFinish, 2)) {
    // the op that waited longest behind other load
    let worst = { wait: -1, wc: "", start: TODAY }
    const ops = routingOps(hypo.routingId)
    let prevFinish = mat.date
    for (const o of ops) {
      const d = r.dates[`${hypo.id}/${o.no}`]
      if (!d) continue
      const wait = (new Date(d[0]).getTime() - new Date(prevFinish).getTime()) / 86400000
      if (wait > worst.wait) worst = { wait, wc: o.wc, start: d[0] }
      prevFinish = d[1]
    }
    const wc = allWorkCenters(s).find((w) => w.id === worst.wc)
    bindingWc = worst.wc
    binding = `${wc?.name ?? worst.wc} (${worst.wc}) ${weekLabel(worst.start)}`
    kind = "capacity"
  } else if (mat.driver) {
    binding = `${SHORT_NAME[mat.driver] ?? MATERIALS.find((m) => m.id === mat.driver)?.description ?? mat.driver} lead time ${LEAD_WEEKS[mat.driver] ?? 4} wks`
    kind = "material"
  } else {
    binding = "Routing lead time on free capacity"
    kind = "material"
  }
  const shipDate = addWorkdays(completion, SHIP_PREP_DAYS)
  const options: CtpResult["options"] = []
  if (kind === "capacity" && bindingWc) {
    const w = allWorkCenters(s).find((x) => x.id === bindingWc)
    options.push({ label: `Overtime shift on ${bindingWc} (planner decision)`, shipDate: addWorkdays(shipDate, -5), note: "Adds weekend shifts on the binding work center; needs planner review" })
    if (w?.alternate) options.push({ label: `Alternate work center ${w.alternate.wcId} at ${w.alternate.efficiencyPct}% efficiency`, shipDate: addWorkdays(shipDate, -3), note: "Engine-selectable alternate, logged as a decision" })
  }
  if (c.qty > 1) {
    const one = hypothetical(s, c.itemId, 1, mat.date, 900, "ONE")
    const r1 = schedule(s, moves, [...others, one])
    options.push({ label: `Partial ship: first unit`, shipDate: addWorkdays(lastFinish(r1, one), SHIP_PREP_DAYS), note: `${c.qty - 1} remaining unit(s) on the full date` })
  }
  options.push(c.requestedDate >= shipDate ? { label: "Requested date", shipDate: c.requestedDate, note: "Feasible: on or after the earliest ship date" } : { label: "Requested date", shipDate: c.requestedDate, note: `Not feasible: ${binding}` })
  return {
    ranOn: new Date().toISOString().slice(0, 19),
    ms: Math.max(1, Math.round(performance.now() - t0)),
    materialDate: mat.date,
    completion,
    shipDate,
    binding,
    bindingKind: kind,
    options,
    snapshotId: s.publishes.at(-1)?.snapshotId ?? "SNP-TBD-0000",
  }
}

/** Lead-time band for a Budgetary quote: no CTP [DOC:p.193 §4 "Budgetary quotes may quote lead-time bands
 *  without CTP, watermarked accordingly"] (asserted). Band = longest component lead time + routing hours
 *  at one shift-day per 16 h, widened by the Budgetary ±25% [DOC:p.45]; the arithmetic is a design reading. */
export function leadTimeBand(itemId: string): { low: number; high: number } {
  const ops = routingOps(routingIdFor(itemId))
  const mat = Math.max(0, ...ops.flatMap((o) => (o.comps ?? []).map(([m]) => LEAD_WEEKS[m] ?? 4)))
  const hours = ops.reduce((a, o) => a + o.setup + o.run, 0)
  const weeks = mat + hours / 16 / 5
  return { low: Math.max(1, Math.floor(weeks * 0.75)), high: Math.ceil(weeks * 1.25) }
}

export { routingOps }
