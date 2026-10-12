// The sales slice (FL-09 DB plus leads, customer master, backorders, RMAs and installed base),
// registered with the root store from this folder.
import { defineSlice, type SearchHit } from "@/store"
import type { DocLink, DocRef } from "@/data/domain"
import { TODAY, type DB } from "./model"
import { buildSeed } from "./seed"
import { applyReallocationDecision, ibFromPgi, ibFromPod, onRmaDecided, onRmaRequested, raiseRmaSlaAlerts, recallRmas, rmaApprovalCtx, rmaValue } from "./ext-actions"

declare module "@/store/types" {
  interface SliceStates {
    sales: DB
  }
}
declare module "@/store/events" {
  interface DomainEvents {
    /** Module-only (Request FR-5): an RMA disposition forced an NCR (Manufacturing Defect or Component Supplier). */
    "sales.ncrRequested": { rmaId: string; ncrId: string; attributable: string }
    /** Module-only (Request FR-13): receipt-to-inspection SLA breached; alert to the Quality Manager (p.27 §3.10, INV 15.11). */
    "sales.rmaSlaBreached": { rmaId: string; notify: "Quality Manager"; businessDays: number }
  }
}

const linkKindFor = (r: DocRef): DocLink["kind"] => (r.type === "reworkOrder" ? "reworks" : r.type === "ncr" || r.type === "scar" ? "escalates" : "creates")

export const salesSlice = defineSlice({
  key: "sales",
  seed: buildSeed,
  search: (db): SearchHit[] => {
    const cname = (id: string) => db.customers.find((c) => c.id === id)?.name ?? id
    return [
      ...db.quotations.map((q) => ({ title: q.id, subtitle: `Quotation · ${q.status} · ${cname(q.customerId)}`, route: `/sales/quotations/${q.id}`, ref: { type: "quotation" as const, id: q.id }, status: { kind: "quotation" as const, value: q.status }, group: "Sales" })),
      ...db.orders.map((o) => ({ title: o.id, subtitle: `Sales order · ${o.type} · ${o.status} · ${cname(o.customerId)}`, route: `/sales/orders/${o.id}`, ref: { type: "salesOrder" as const, id: o.id }, status: { kind: "salesOrder" as const, value: o.status }, group: "Sales" })),
      ...db.deliveries.map((d) => ({ title: d.id, subtitle: `Delivery · ${d.status} · ${d.soId}`, route: `/sales/deliveries?d=${d.id}`, ref: { type: "delivery" as const, id: d.id }, status: { kind: "delivery" as const, value: d.status }, group: "Sales" })),
      ...db.pods.map((p) => ({ title: p.id, subtitle: `Proof of delivery · ${p.status} · ${p.deliveryId}`, route: `/sales/pod/${p.id}`, ref: { type: "pod" as const, id: p.id }, status: { kind: "pod" as const, value: p.status }, group: "Sales" })),
      ...db.deliveries.filter((d) => d.irId).map((d) => ({ title: d.irId!, subtitle: `Invoice request (ACC) · ${d.irWithdrawn ? "withdrawn" : "handed to Finance"} · ${d.id}`, route: `/sales/orders/${d.soId}`, ref: { type: "invoiceRequest" as const, id: d.irId! }, group: "Sales" })),
      ...db.customers.map((c) => ({ title: c.id, subtitle: `Customer · ${c.status} · ${c.name}`, route: `/sales/customers/${c.id}`, ref: { type: "customer" as const, id: c.id }, status: { kind: "customer" as const, value: c.status }, group: "Sales" })),
      ...db.leads.map((l) => ({ title: l.id, subtitle: `Lead · ${l.stage} · ${l.company} · ${l.title}`, route: `/sales/leads/${l.id}`, ref: { type: "lead" as const, id: l.id }, group: "Sales" })),
      ...db.leads.filter((l) => l.oppId).map((l) => ({ title: l.oppId!, subtitle: `Opportunity · ${l.stage} · ${l.company}`, route: `/sales/leads/${l.id}`, ref: { type: "opportunity" as const, id: l.oppId! }, group: "Sales" })),
      ...db.rmas.map((r) => ({ title: r.id, subtitle: `RMA · ${r.cls} · ${r.status} · ${cname(r.customerId)}`, route: `/sales/rma/${r.id}`, ref: { type: "rma" as const, id: r.id }, status: { kind: "rma" as const, value: r.status }, group: "Returns" })),
      ...db.ib.map((i) => ({ title: i.id, subtitle: `Installed base · ${i.status} · ${i.serial} · ${cname(i.customerId)}`, route: `/service/installed-base/${i.id}`, ref: { type: "installedBase" as const, id: i.id }, status: { kind: "installedBase" as const, value: i.status }, group: "Returns" })),
    ]
  },
  links: (db): DocLink[] => {
    const out: DocLink[] = []
    for (const q of db.quotations) {
      if (q.successor) out.push({ from: { type: "quotation", id: q.id }, to: { type: "quotation", id: q.successor }, kind: "revises" })
      if (q.orderRef) out.push({ from: { type: "quotation", id: q.id }, to: { type: "salesOrder", id: q.orderRef }, kind: "converts to" })
      if (q.ibId) out.push({ from: { type: "installedBase", id: q.ibId }, to: { type: "quotation", id: q.id }, kind: "creates", note: "spares quotation" })
    }
    for (const d of db.deliveries) {
      out.push({ from: { type: "salesOrder", id: d.soId }, to: { type: "delivery", id: d.id }, kind: "fulfils", note: d.refs.map((r) => `line ${r.line} schedule ${r.sched}`).join("; ") })
      if (d.irId) out.push({ from: { type: "delivery", id: d.id }, to: { type: "invoiceRequest", id: d.irId }, kind: "bills" })
    }
    for (const p of db.pods) out.push({ from: { type: "delivery", id: p.deliveryId }, to: { type: "pod", id: p.id }, kind: "closes" })
    for (const l of db.leads) {
      if (l.oppId) out.push({ from: { type: "lead", id: l.id }, to: { type: "opportunity", id: l.oppId }, kind: "converts to" })
      const first = l.quotationIds.find((id) => !db.quotations.find((q) => q.id === id)?.predecessor)
      if (first) out.push({ from: l.oppId ? { type: "opportunity", id: l.oppId } : { type: "lead", id: l.id }, to: { type: "quotation", id: first }, kind: "converts to" })
      if (l.customerId) out.push({ from: { type: "customer", id: l.customerId }, to: { type: "lead", id: l.id }, kind: "creates", note: "customer of the lead" })
    }
    for (const r of db.rmas) {
      if (r.ibId) out.push({ from: { type: "installedBase", id: r.ibId }, to: { type: "rma", id: r.id }, kind: "returns" })
      else if (r.refType === "Sales Order" && r.refDoc) out.push({ from: { type: "salesOrder", id: r.refDoc }, to: { type: "rma", id: r.id }, kind: "returns" })
      else if (r.refType === "Serial Number" && r.refDoc) {
        const ib = db.ib.find((i) => i.serial === r.refDoc)
        if (ib) out.push({ from: { type: "installedBase", id: ib.id }, to: { type: "rma", id: r.id }, kind: "returns" })
      }
      if (r.recallId) out.push({ from: { type: "recall", id: r.recallId }, to: { type: "rma", id: r.id }, kind: "creates" })
      for (const x of r.linked) out.push({ from: { type: "rma", id: r.id }, to: x, kind: linkKindFor(x) })
    }
    for (const o of db.orders) if (o.rmaRef) out.push({ from: { type: "rma", id: o.rmaRef }, to: { type: "salesOrder", id: o.id }, kind: "creates", note: "replacement at $0" })
    for (const i of db.ib) if (i.id !== "IB-TBD-0301") out.push({ from: { type: "serial", id: i.serial }, to: { type: "installedBase", id: i.id }, kind: "installs" })
    return out
  },
  subscribe: (api) => {
    // Installed base: created automatically at PGI (p.253 IB-001 "Arrives from"); POD date marks it Installed.
    api.on("sales.pgiPosted", ({ deliveryId, serials }) => api.mutate("sales", (db) => ibFromPgi(db, deliveryId, serials)))
    api.on("sales.podRecorded", ({ podId, deliveryId }) => api.mutate("sales", (db) => ibFromPod(db, podId, deliveryId)))
    // RMA authorization and disposition approvals, and reallocations, decided in WF-INBOX.
    api.on("approval.requested", ({ requestId, kind, subject }) => {
      if (kind === "RMA approval" && subject.type === "rma") api.mutate("sales", (db, ctx) => onRmaRequested(db, ctx, subject.id, requestId))
    })
    api.on("approval.decided", ({ requestId, kind, subject, outcome, reason }) => {
      if (kind === "RMA approval" && subject.type === "rma") api.mutate("sales", (db, ctx) => onRmaDecided(db, ctx, subject.id, outcome, requestId, reason))
      if (kind === "Reallocation of confirmed supply" && subject.type === "salesOrder") api.mutate("sales", (db, ctx) => applyReallocationDecision(db, ctx, subject.id, outcome, requestId, reason))
    })
    // Finished goods received from a production order: the MTO/ETO schedule lines pegged to it are ready to ship.
    api.on("production.fgReceived", ({ woId, serial, itemId }) =>
      api.mutate("sales", (db, ctx) => {
        for (const o of db.orders)
          for (const l of o.lines)
            for (const s of l.schedules)
              if (s.peg === woId && l.item === itemId && !["Delivered", "Closed", "Cancelled"].includes(s.status))
                o.activity.push({ at: TODAY, by: ctx.role, text: `Finished goods received from ${woId}${serial ? ` (serial ${serial})` : ""}: line ${l.no} schedule ${s.no} ready to ship` })
        const opt = db.supply.find((x) => x.ref === woId && x.itemId === itemId)
        if (opt) opt.note = `${opt.note ? opt.note + "; " : ""}FG receipt posted${serial ? ` (${serial})` : ""}`
      }),
    )
    // Recall campaigns entering Recover draft RMAs for the field population (FL-08 to FL-05).
    api.on("quality.recallStageChanged", ({ recallId, stage }) => {
      if (stage === "Recover") api.mutate("sales", (db, ctx) => recallRmas(db, ctx, recallId))
    })
    // Seeded RMAs waiting for approval get their request in the shared engine at start.
    const db = api.getSlice("sales")
    for (const r of db.rmas.filter((x) => x.status === "Pending Approval"))
      api.raiseApproval({ kind: "RMA approval", subject: { type: "rma", id: r.id }, title: `${r.id} ${r.cls} ${r.reason}, ${db.customers.find((c) => c.id === r.customerId)?.name}`, amount: rmaValue(r), ctx: rmaApprovalCtx(r) })
    // Receipt-to-inspection SLA: breaches open at start alert the Quality Manager; later breaches are
    // swept after each RMA receipt or status change below.
    api.mutate("sales", (d, ctx) => raiseRmaSlaAlerts(d, ctx))
    api.on("sales.rmaReceived", () => api.mutate("sales", (d, ctx) => raiseRmaSlaAlerts(d, ctx)))
  },
})
