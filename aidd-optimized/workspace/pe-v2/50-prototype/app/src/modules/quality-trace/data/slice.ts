// quality-trace slice: inspection plans, inspections, final tests, NCR links, CAPA, SCAR, calibration,
// deviations, recalls, the genealogy event store, batches, serials, traceability controls and
// barcode administration. Seeded in ./seed.ts with the spine IDs; reactions to other modules'
// events are in `subscribe` below (README "Cross-module events").

import { defineSlice, type SearchHit } from "@/store"
import type { DocLink, DocRef, LinkKind, TraceEventCode } from "@/data/domain"
import { materialById, vendorById } from "@/data/shared"
import "./events"
import { appendEvent, dedupeKey } from "./chain"
import { openFinalTest, openGateLot, type OrderForTest } from "./intake"
import { recall } from "./actions"
import { buildSeed, P, type Seed } from "./seed"
import { extraSeed, patchSeed, type ExtraSeed } from "./extra-seed"
import type { FinalTest, QtBatch, QtEvent, QtSerial } from "./types"
import type { InspectionLotId } from "@/data/domain"

export interface QualityTraceState extends Seed, ExtraSeed {
  seq: number
}

declare module "@/store/types" {
  interface SliceStates {
    qualityTrace: QualityTraceState
  }
}

/** Fresh seed; called at start and on Scenario reset. */
export function seed(): QualityTraceState {
  const base = buildSeed()
  patchSeed(base)
  return { ...base, ...extraSeed(), seq: 500 }
}

const G = "Quality and traceability"

function search(s: QualityTraceState): SearchHit[] {
  const out: SearchHit[] = []
  const hit = (title: string, subtitle: string, route: string, ref?: DocRef, status?: SearchHit["status"]) => out.push({ title, subtitle, route, ref, status, group: G })
  for (const p of s.plans) {
    const cur = p.revisions[p.revisions.length - 1]
    hit(p.id, `Inspection plan rev ${cur.rev} · ${p.name}`, `/quality/inspection-plans/${p.id}`, undefined, { kind: "inspectionPlan", value: cur.status })
  }
  for (const l of s.lots) hit(l.id, `Inspection ${l.gate} · ${l.batchId ?? l.subject.id} · ${l.decision ?? "open"}`, `/quality/inspections/${l.id}`, { type: "inspectionLot", id: l.id })
  for (const f of s.finalTests) {
    hit(f.id, `Final test ${f.serial} · ${f.finalResult ?? "in progress"}`, `/quality/final-test/${f.id}`, { type: "inspectionLot", id: f.id })
    if (f.ftrId) hit(f.ftrId, `Final Test Report for ${f.serial}`, `/quality/final-test/${f.id}`)
  }
  for (const n of s.ncrs) hit(n.id, `${n.title} · ${n.severity} · ${n.stage}`, `/quality/capa?ncr=${n.id}`, { type: "ncr", id: n.id })
  for (const c of s.capas) hit(c.id, c.title, `/quality/capa/${c.id}`, { type: "capa", id: c.id }, { kind: "capa", value: c.status })
  for (const x of s.scars) hit(x.id, `${x.title} · ${vendorById(x.vendorId)?.name ?? x.vendorId} · ${x.open ? "open" : "closed"}`, `/quality/scar/${x.id}`, { type: "scar", id: x.id })
  for (const i of s.instruments) hit(i.label, `${i.name} (${i.id})`, `/quality/calibration?ins=${i.id}`, undefined, { kind: "instrument", value: i.status })
  for (const d of s.deviations) hit(d.id, `${d.type}: ${d.title} · ${d.state}`, `/quality/deviations/${d.id}`, { type: "deviation", id: d.id })
  for (const r of s.recalls) hit(r.id, r.title, `/quality/recalls/${r.id}`, { type: "recall", id: r.id }, { kind: "recall", value: r.stage })
  for (const b of s.batches) hit(b.id, `Batch · ${materialById(b.materialId)?.description ?? b.materialId}${b.vendorBatch ? ` · ${b.vendorBatch}` : ""}`, `/traceability/explorer?q=${b.id}`, { type: "batch", id: b.id }, { kind: "stock", value: b.stock })
  for (const x of s.serials) hit(x.id, `Serial · ${materialById(x.materialId)?.description ?? x.materialId}`, `/traceability/explorer?q=${x.id}`, { type: "serial", id: x.id }, { kind: "serial", value: x.status })
  return out
}

function links(s: QualityTraceState): DocLink[] {
  const out: DocLink[] = []
  const L = (from: DocRef, kind: LinkKind, to: DocRef, note?: string) => out.push({ from, to, kind, note })
  for (const l of s.lots) {
    const me: DocRef = { type: "inspectionLot", id: l.id }
    L(l.subject, "inspects", me, l.gate)
    if (l.ncrId) L(me, "escalates", { type: "ncr", id: l.ncrId })
    if (l.deviationId) L(me, "escalates", { type: "deviation", id: l.deviationId }, "accepted under deviation")
  }
  for (const f of s.finalTests) {
    const me: DocRef = { type: "inspectionLot", id: f.id }
    L({ type: "productionOrder", id: f.woId }, "inspects", me, "final test")
    if (f.ncrId) L(me, "escalates", { type: "ncr", id: f.ncrId })
    if (f.rwoId) L({ type: "ncr", id: f.ncrId ?? "" }, "reworks", { type: "reworkOrder", id: f.rwoId })
  }
  for (const n of s.ncrs) {
    const me: DocRef = { type: "ncr", id: n.id }
    if (n.source.type !== "inspectionLot") L(n.source, "escalates", me)
    if (n.capaId) L(me, "escalates", { type: "capa", id: n.capaId })
    if (n.scarId) L(me, "escalates", { type: "scar", id: n.scarId })
  }
  for (const r of s.recalls) {
    const me: DocRef = { type: "recall", id: r.id }
    if (r.capaId) L({ type: "capa", id: r.capaId }, "creates", me)
    for (const b of r.suspect.batches) L(me, "contains", { type: "batch", id: b })
    for (const x of r.rmaIds) L(me, "creates", { type: "rma", id: x }, "recall-class RMA")
  }
  for (const d of s.deviations) for (const sc of d.scope) if (sc.type !== "inspectionLot") L(sc, "escalates", { type: "deviation", id: d.id }, d.type)
  for (const b of s.batches) if (b.grnId && b.id !== "BAT-TBD-B0301") L({ type: "grn", id: b.grnId }, "receives", { type: "batch", id: b.id })
  for (const x of s.serials) if (x.woId && x.id !== "SN-TBD-20M-0301" && !x.parentSerial) L({ type: "productionOrder", id: x.woId }, "produces", { type: "serial", id: x.id })
  return out
}

/** Record an event coming from another module's transaction, once (dedupe by code + doc + object). */
function recordExternal(draft: QualityTraceState, today: string, code: TraceEventCode, doc: DocRef, o: Partial<QtEvent> & { evidence: string }) {
  const key = dedupeKey(code, doc.id, o.serial, o.batch)
  if (draft.genealogy.some((e) => dedupeKey(e.type, e.doc.id, e.serial, e.batch) === key)) return false
  // stamped with the scenario's date (ctx.today), never the real clock
  appendEvent(draft.genealogy, { type: code, at: `${today}T12:00:00`, doc, ...o })
  return true
}

/** Minimal structural views of other modules' slices (read through the store; never imported). */
type PpView = { productionOrders?: (OrderForTest & { operations: { no: number; workCenterId: string; qcGate?: string }[]; qty: number })[] }
type PurView = { grns?: { id: string; poId: string; lines: { itemId: string; qty: number }[] }[]; purchaseOrders?: { id: string; vendorId: string }[] }
type SalesView = { orders?: { id: string; customerId: string }[]; rmas?: { id: string; lines: { itemId: string; serial?: string; qtyRecd: number }[] }[] }
const customerOf = (api: { getSlice: (k: "sales") => unknown }, soId?: string) => (api.getSlice("sales") as SalesView).orders?.find((o) => o.id === soId)?.customerId


export const qualityTraceSlice = defineSlice({
  key: "qualityTrace",
  seed,
  search,
  links,
  subscribe: (api) => {
    // Every traceability capture made elsewhere lands in the one append-only store (FL-11).
    api.on("trace.eventRecorded", ({ code, doc, serial, batch }) =>
      api.mutate("qualityTrace", (d, ctx) => {
        recordExternal(d, ctx.today, code, doc, { serial: serial as QtEvent["serial"], batch: batch as QtEvent["batch"], evidence: `Recorded by ${doc.type} ${doc.id}` })
        // shipment gate: packing a unit for a delivery opens the pre-shipment inspection (OQC) [DOC:p.84 E §1]
        if (code === "T10" && doc.type === "delivery" && serial) {
          const ser = d.serials.find((x) => x.id === serial)
          if (ser) openGateLot(d, { gate: "OQC", subject: doc, itemId: ser.materialId, serials: [ser.id], lotSize: 1 }, ctx.today)
        }
      }))
    // T02: receipt identity; the GRN line of a QI-required item opens an IQC inspection (gate trigger, [DOC:p.33 §6.1]).
    api.on("purchasing.grnPosted", ({ grnId, poId, batches, serials }) =>
      api.mutate("qualityTrace", (d, ctx) => {
        for (const b of batches) recordExternal(d, ctx.today, "T02", { type: "grn", id: grnId }, { batch: b as QtEvent["batch"], scanPoint: "SP-02", evidence: `GRN ${grnId} for ${poId}` })
        for (const sn of serials) recordExternal(d, ctx.today, "T02", { type: "grn", id: grnId }, { serial: sn as QtEvent["serial"], scanPoint: "SP-03", evidence: `GRN ${grnId} for ${poId}` })
        const pur = api.getSlice("purchasingFinance") as unknown as PurView
        const grn = pur.grns?.find((g) => g.id === grnId)
        const line = grn?.lines[0]
        if (!line) return
        const vendorId = pur.purchaseOrders?.find((p) => p.id === poId)?.vendorId
        const batchId = batches[0] as QtBatch["id"] | undefined
        if (batchId && !d.batches.some((b) => b.id === batchId))
          d.batches.push({ id: batchId as QtBatch["id"], materialId: line.itemId as QtBatch["materialId"], stock: "QI Hold", qty: line.qty, qtyReceived: line.qty, receivedOn: ctx.today, vendorId: vendorId as QtBatch["vendorId"], grnId, poId, warehouseId: "WH-TBD-01" })
        for (const sn of serials)
          if (!d.serials.some((x) => x.id === sn)) d.serials.push({ id: sn as QtSerial["id"], materialId: line.itemId as QtSerial["materialId"], status: "QI Hold", bornOn: ctx.today, batchId: batchId as QtSerial["batchId"] })
        const r = openGateLot(d, { gate: "IQC", subject: { type: "grn", id: grnId }, itemId: line.itemId as QtBatch["materialId"], vendorId: vendorId as QtBatch["vendorId"], batchId, serials: serials as QtSerial["id"][], lotSize: line.qty }, ctx.today)
        if (r.lot?.skipped && batchId) {
          const b = d.batches.find((x) => x.id === batchId)
          if (b) b.stock = "Unrestricted"
        }
        if (r.warning && batchId) {
          const b = d.batches.find((x) => x.id === batchId)
          if (b) b.stock = "Unrestricted"
        }
        if (r.lot && r.note !== "exists") ctx.emit("quality.inspectionOpened", { lotId: r.lot.id as InspectionLotId, gate: "IQC", subject: { type: "grn", id: grnId } })
      }))
    api.on("sales.pgiPosted", ({ deliveryId, serials }) =>
      api.mutate("qualityTrace", (d, ctx) => {
        for (const sn of serials) {
          recordExternal(d, ctx.today, "T11", { type: "delivery", id: deliveryId }, { serial: sn as QtEvent["serial"], scanPoint: "SP-18", evidence: `PGI posted for ${deliveryId}` })
          const ser = d.serials.find((x) => x.id === sn)
          if (ser) ser.status = "Shipped"
        }
      }))
    api.on("production.confirmationPosted", ({ woId, op, good, scrap }) =>
      api.mutate("qualityTrace", (d, ctx) => void recordExternal(d, ctx.today, "T07", { type: "productionOrder", id: woId }, { scanPoint: "SP-11", evidence: `Op ${op}: good ${good}, scrap ${scrap}`, qty: good })))
    api.on("production.fgReceived", ({ woId, serial }) =>
      api.mutate("qualityTrace", (d, ctx) => void recordExternal(d, ctx.today, "T09", { type: "productionOrder", id: woId }, { serial, evidence: "Finished goods receipt" })))
    api.on("production.orderReleased", ({ woId, serial }) =>
      api.mutate("qualityTrace", (d, ctx) => {
        if (!serial || d.serials.some((x) => x.id === serial)) return
        // the serial's item comes from the production order itself, born on the scenario date
        const wo = (api.getSlice("planningProduction") as unknown as PpView).productionOrders?.find((w) => w.id === woId)
        d.serials.push({ id: serial, materialId: (wo?.itemId ?? "FIN-TBD-20MVA") as QtSerial["materialId"], status: "In Production", bornOn: ctx.today, woId })
      }))
    // Routing checkpoints: a requested in-process inspection opens an IPQC lot; the Final Test op opens the final test record.
    api.on("production.inspectionRequested", ({ woId, op, gate, inspectionId }) =>
      api.mutate("qualityTrace", (d, ctx) => {
        const wo = (api.getSlice("planningProduction") as unknown as PpView).productionOrders?.find((w) => w.id === woId)
        if (!wo) return
        if (gate === "Final Test") {
          openFinalTest(d, wo, customerOf(api, wo.pegs[0]?.soId), ctx.today, inspectionId)
          return
        }
        const wc = wo.operations.find((o) => o.no === op)?.workCenterId
        const r = openGateLot(d, { gate: "IPQC", id: inspectionId, subject: { type: "productionOrder", id: wo.id as QtSerial["woId"] & string }, itemId: wo.itemId as QtBatch["materialId"], serials: wo.serials as QtSerial["id"][], lotSize: wo.qty || 1, workCenterId: wc as never }, ctx.today)
        if (r.lot && r.note !== "exists") ctx.emit("quality.inspectionOpened", { lotId: r.lot.id as InspectionLotId, gate: "IPQC", subject: r.lot.subject })
      }))
    // The rework order Production planning drafts for a failed final test is linked back by its NCR.
    api.on("production.reworkOrderCreated", ({ rwoId, origin }) =>
      api.mutate("qualityTrace", (d) => {
        const f = d.finalTests.find((x) => x.disposition === "Rework" && !x.rwoId && ((origin.type === "ncr" && origin.id === x.ncrId) || (origin.type === "productionOrder" && origin.id === x.woId)))
        if (f) f.rwoId = rwoId as FinalTest["rwoId"]
      }))
    // RMA receipt: opens the return inspection (RQC), SLA 5 business days.
    api.on("sales.rmaReceived", ({ rmaId, serials }) =>
      api.mutate("qualityTrace", (d, ctx) => {
        for (const sn of serials) recordExternal(d, ctx.today, "T12", { type: "rma", id: rmaId }, { serial: sn as QtEvent["serial"], scanPoint: "SP-19", evidence: `RMA receipt ${rmaId}` })
        const rma = (api.getSlice("sales") as unknown as SalesView).rmas?.find((r) => r.id === rmaId)
        const line = rma?.lines.find((l) => l.qtyRecd > 0 && (!serials.length || (l.serial && serials.includes(l.serial)))) ?? rma?.lines[0]
        if (!line) return
        const ser = d.serials.find((x) => x.id === serials[0])
        const batch = ser?.batchId ? d.batches.find((b) => b.id === ser.batchId) : undefined
        const r = openGateLot(d, { gate: "RQC", subject: { type: "rma", id: rmaId }, itemId: line.itemId as QtBatch["materialId"], vendorId: batch?.vendorId, batchId: batch?.id, serials: serials as QtSerial["id"][], lotSize: serials.length || 1 }, ctx.today)
        if (r.lot && r.note !== "exists") ctx.emit("quality.inspectionOpened", { lotId: r.lot.id as InspectionLotId, gate: "RQC", subject: { type: "rma", id: rmaId } })
      }))
    // Recover: Sales drafts the recall-class RMAs on the same event; link them back once it has run.
    api.on("quality.recallStageChanged", ({ recallId, stage }) => {
      if (stage !== "Recover") return
      setTimeout(() => {
        const sales = api.getSlice("sales") as unknown as { rmas?: { id: string; recallId?: string; lines: { serial?: string }[] }[] }
        const rmas = (sales.rmas ?? []).filter((x) => x.recallId === recallId).map((x) => ({ id: x.id, serials: x.lines.map((l) => l.serial ?? "").filter(Boolean) }))
        if (rmas.length) recall.linkRmas(recallId, rmas)
      }, 0)
    })
    // Dual approval of the external notification text (C-52) moves Contain → Notify.
    api.on("approval.decided", ({ kind, subject, outcome, by }) => {
      if (kind !== "Recall external notification" || subject.type !== "recall") return
      const r = api.mutate("qualityTrace", (d, ctx) => {
        const rc = d.recalls.find((x) => x.id === subject.id)
        if (!rc) return false
        if (outcome === "Rejected") {
          rc.activity.push({ at: ctx.today, by, text: "Notification text rejected in WF-INBOX; revise and resend" })
          return false
        }
        rc.notificationApprovals = [{ role: "Quality Manager", on: ctx.today }, { role: "Executive", on: ctx.today }]
        rc.activity.push({ at: ctx.today, by, text: "Notification text approved (Quality Manager + Executive)" })
        if (rc.stage === "Contain") {
          rc.stage = "Notify"
          appendEvent(d.genealogy, { type: "T13", at: `${ctx.today}T12:00:00`, doc: { type: "recall", id: rc.id }, batch: rc.suspect.batches[0], userId: P.qm, evidence: "Notification approved; stage Notify" })
          ctx.emit("quality.recallStageChanged", { recallId: rc.id, stage: "Notify" })
        }
        return true
      })
      return r
    })
  },
})
