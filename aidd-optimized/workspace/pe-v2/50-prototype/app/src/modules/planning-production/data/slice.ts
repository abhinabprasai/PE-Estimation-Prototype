// planning-production slice: planned orders, MRP exceptions, routings, work-center capacity,
// production orders, confirmations, rework orders, warehouse staging tasks, the WIP journal,
// settlements, schedule publishes, promises (CTP) and at-risk records.
// State shape: ./types.ts. Seed: ./seed.ts. Actions: ../lib/actions.ts.
import { defineSlice, type SearchHit } from "@/store"
import { MATERIALS, SPINE_LINKS, CUSTOMERS } from "@/data/shared"
import { refKey, type DocLink, type DocRef } from "@/data/domain"
import "./events"
import { seed } from "./seed"
import type { PlanningProductionState } from "./types"
import { onEcoReleased, onEngineeringMbomActivated, onInspectionClosed, onRecallStage, onSalesOrderConfirmed, onSupplySlip, onWoReopenDecided } from "../lib/actions"

export type { PlanningProductionState }

declare module "@/store/types" {
  interface SliceStates {
    planningProduction: PlanningProductionState
  }
}

const G = "planning-production"
const mat = (id: string) => MATERIALS.find((m) => m.id === id)?.description ?? id
const cust = (id: string) => CUSTOMERS.find((c) => c.id === id)?.name ?? id

function search(s: PlanningProductionState): SearchHit[] {
  const out: SearchHit[] = []
  for (const w of s.productionOrders)
    out.push({
      title: w.id,
      subtitle: `Production order · ${mat(w.itemId)} × ${w.qty}${w.serials.length ? ` · ${w.serials.length > 1 ? `${w.serials[0]}..` : w.serials[0]}` : ""}${w.pegs[0] ? ` · ${w.pegs[0].soId}` : ""}`,
      route: `/production/orders/${w.id}`,
      ref: { type: "productionOrder", id: w.id },
      status: { kind: "productionOrder", value: w.status },
      group: G,
    })
  for (const p of s.plannedOrders)
    out.push({
      title: p.id,
      subtitle: `Planned order (${p.state}) · ${mat(p.materialId)} × ${p.qty}${p.peg ? ` · ${p.peg.soId}` : ""}`,
      route: `/production/planned-orders?id=${p.id}`,
      ref: { type: "plannedOrder", id: p.id },
      group: G,
    })
  for (const r of s.reworkOrders)
    out.push({ title: r.id, subtitle: `Rework order · ${r.title}`, route: `/production/rework/${r.id}`, ref: { type: "reworkOrder", id: r.id }, status: { kind: "reworkOrder", value: r.status }, group: G })
  const seenRtg = new Set<string>()
  for (const r of s.routings) {
    const k = `${r.id}/${r.rev}`
    if (seenRtg.has(k)) continue
    seenRtg.add(k)
    out.push({ title: `${r.id} rev ${r.rev}`, subtitle: `Routing · ${r.description}`, route: `/production/routings/${r.id}?rev=${r.rev}`, status: { kind: "routing", value: r.status }, group: G })
  }
  for (const w of s.workCenters) out.push({ title: w.id, subtitle: `Work center · ${w.name}`, route: `/production/work-centers/${w.id}`, status: { kind: "workCenter", value: s.wc[w.id]?.status ?? w.status }, group: G })
  for (const a of s.atRisk) out.push({ title: a.id, subtitle: `At-risk promise · ${a.soId} line ${a.line} · ${cust(a.customerId)} (${a.state})`, route: `/production/at-risk?id=${a.id}`, group: G })
  for (const st of s.settlements) out.push({ title: st.id, subtitle: `Settlement run · ${st.orders.length} order(s) · ${st.postedOn}`, route: `/production/settlement?run=${st.id}`, group: G })
  return out
}

function links(s: PlanningProductionState): DocLink[] {
  const out: DocLink[] = []
  const seen = new Set(SPINE_LINKS.map((l) => `${refKey(l.from)}>${refKey(l.to)}`))
  const add = (from: DocRef, to: DocRef, kind: DocLink["kind"], note?: string) => {
    const k = `${refKey(from)}>${refKey(to)}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ from, to, kind, note })
  }
  for (const p of s.plannedOrders) {
    if (p.peg) add({ type: "salesOrder", id: p.peg.soId }, { type: "plannedOrder", id: p.id }, "pegs", `line ${p.peg.line} schedule ${p.peg.sched}`)
    if (p.convertedTo) add({ type: "plannedOrder", id: p.id }, { type: p.convertedTo.startsWith("WO-") ? "productionOrder" : "requisition", id: p.convertedTo }, "converts to")
  }
  for (const w of s.productionOrders) {
    for (const g of w.pegs) add({ type: "salesOrder", id: g.soId }, { type: "productionOrder", id: w.id }, "pegs", `line ${g.line} schedule ${g.sched}`)
    for (const sn of w.serials) add({ type: "productionOrder", id: w.id }, { type: "serial", id: sn }, "produces")
    for (const o of w.operations) if (o.inspection && /^IL-TBD-\d{4}$/.test(o.inspection.id)) add({ type: "productionOrder", id: w.id }, { type: "inspectionLot", id: o.inspection.id }, "inspects", `op ${o.no} ${o.qcGate ?? ""}`.trim())
  }
  for (const r of s.reworkOrders) add(r.origin, { type: "reworkOrder", id: r.id }, "reworks", r.originOp ? `op ${r.originOp}` : undefined)
  return out
}

export const planningProductionSlice = defineSlice({
  key: "planningProduction",
  seed,
  search,
  links,
  subscribe: (api) => {
    api.on("engineering.mbomActivated", (p) => api.mutate("planningProduction", (d, ctx) => onEngineeringMbomActivated(d, ctx, p.mbomId, p.ebomId)))
    api.on("sales.orderConfirmed", (p) => {
      // customer and quote come from the sales record, so a confirmation only firms its own quote's reservation
      const so = (api.getSlice("sales") as { orders?: { id: string; customerId: string; quoteRef?: string; requestedShip?: string }[] } | undefined)?.orders?.find((o) => o.id === p.soId)
      api.mutate("planningProduction", (d, ctx) => onSalesOrderConfirmed(d, ctx, { ...p, customerId: so?.customerId, quoteRef: so?.quoteRef, requestedShip: so?.requestedShip }))
    })
    api.on("engineering.ecoReleased", (p) => api.mutate("planningProduction", (d, ctx) => onEcoReleased(d, ctx, p.ecoId, p.affected)))
    api.on("purchasing.poDeliveryDateChanged", (p) => api.mutate("planningProduction", (d, ctx) => onSupplySlip(d, ctx, { itemId: p.itemId, supply: { type: "purchaseOrder", id: p.poId }, newDate: p.newDate as never, soId: p.soId })))
    api.on("quality.inspectionClosed", (p) => api.mutate("planningProduction", (d, ctx) => onInspectionClosed(d, ctx, p.lotId, p.subject, p.passed)))
    api.on("quality.recallStageChanged", (p) => api.mutate("planningProduction", (d, ctx) => onRecallStage(d, ctx, p.recallId, p.stage)))
    api.on("approval.decided", (p) => {
      if (p.kind !== "WO reopen" || p.subject.type !== "productionOrder") return
      api.mutate("planningProduction", (d, ctx) => onWoReopenDecided(d, ctx, p.subject.id, p.outcome, p.reason))
    })
  },
})
