// Trace tree and recall population, read from the append-only event store and the batch / serial
// records [DOC:p.212 §4.4; p.274 TRC-EXPL] (asserted). Five levels deep (design value, QT-R12):
// transformer serial → component serial → material batch → goods receipt → purchase order (backward),
// and batch → component serial → parent unit → shipment → customer site (forward).

import type { DocRef, RecordKind } from "@/data/domain"
import { CUSTOMERS, materialById, vendorById } from "@/data/shared"
import { effectiveState } from "./chain"
import type { PopulationRow, PopulationWhere, QtBatch, QtEvent, QtSerial } from "./types"

export interface TraceSource {
  genealogy: QtEvent[]
  batches: QtBatch[]
  serials: QtSerial[]
}
export interface TraceNode {
  key: string
  kind: "serial" | "batch" | "grn" | "purchaseOrder" | "productionOrder" | "delivery" | "site"
  id: string
  label: string
  sub?: string
  status?: { kind: RecordKind; value: string }
  doc?: DocRef
  removed?: boolean
  note?: string
  depth: number
  children: TraceNode[]
}
export const MAX_DEPTH = 5

const customerName = (id?: string) => CUSTOMERS.find((c) => c.id === id)?.name
const active = (s: TraceSource) => s.genealogy.filter((e) => effectiveState(s.genealogy, e) !== "Reversed" && e.correction !== "Reversed")

export function resolveInput(s: TraceSource, q: string): { type: "serial" | "batch"; id: string; via?: string } | null {
  const t = q.trim().toUpperCase()
  if (!t) return null
  const ser = s.serials.find((x) => x.id.toUpperCase() === t || x.vendorSerial?.toUpperCase() === t)
  if (ser) return { type: "serial", id: ser.id, via: ser.id.toUpperCase() === t ? undefined : `vendor serial ${ser.vendorSerial}` }
  const bat = s.batches.find((x) => x.id.toUpperCase() === t || x.vendorBatch?.toUpperCase() === t || x.heatNo?.toUpperCase() === t)
  if (bat) return { type: "batch", id: bat.id, via: bat.id.toUpperCase() === t ? undefined : bat.heatNo?.toUpperCase() === t ? `heat ${bat.heatNo}` : `vendor batch ${bat.vendorBatch}` }
  return null
}

export function eventsFor(s: TraceSource, id: string) {
  return s.genealogy.filter((e) => e.serial === id || e.batch === id || e.parentSerial === id || e.doc.id === id)
}

function serialNode(s: TraceSource, id: string, depth: number, extra: Partial<TraceNode> = {}): TraceNode {
  const ser = s.serials.find((x) => x.id === id)
  const m = ser && materialById(ser.materialId)
  return {
    key: `serial:${id}:${depth}`, kind: "serial", id, depth, children: [], doc: { type: "serial", id },
    label: id, sub: m ? `${m.id} · ${m.description}` : "Serial not on record", status: ser ? { kind: "serial", value: ser.status } : undefined, ...extra,
  }
}
function batchNode(s: TraceSource, id: string, depth: number, note?: string): TraceNode {
  const b = s.batches.find((x) => x.id === id)
  const m = b && materialById(b.materialId)
  return {
    key: `batch:${id}:${depth}`, kind: "batch", id, depth, children: [], doc: { type: "batch", id }, note,
    label: id, sub: b ? `${m?.description ?? b.materialId}${b.vendorBatch ? ` · vendor batch ${b.vendorBatch}` : ""}${b.heatNo ? ` · heat ${b.heatNo}` : ""}` : "Batch not on record",
    status: b ? { kind: "stock", value: b.stock } : undefined,
  }
}

/** Backward trace (as-built): what went into this serial or batch. */
export function backward(s: TraceSource, root: { type: "serial" | "batch"; id: string }): TraceNode {
  const ev = active(s)
  const walkSerial = (id: string, depth: number, extra?: Partial<TraceNode>): TraceNode => {
    const n = serialNode(s, id, depth, extra)
    if (depth >= MAX_DEPTH - 1) return n
    for (const c of s.serials.filter((x) => x.parentSerial === id)) n.children.push(walkSerial(c.id, depth + 1))
    for (const r of ev.filter((e) => e.type === "T06" && e.action === "remove" && e.parentSerial === id))
      if (r.serial) n.children.push(serialNode(s, r.serial, depth + 1, { removed: true, note: `Removed ${r.at.slice(0, 10)} (${r.doc.id})` }))
    const ser = s.serials.find((x) => x.id === id)
    const seen = new Set<string>()
    if (ser?.batchId) {
      seen.add(ser.batchId)
      n.children.push(walkBatch(ser.batchId, depth + 1, "Serial belongs to this batch"))
    }
    for (const e of ev.filter((x) => x.type === "T05" && x.serial === id && x.batch))
      if (!seen.has(e.batch!)) {
        seen.add(e.batch!)
        n.children.push(walkBatch(e.batch!, depth + 1, `Issued ${e.qty?.toLocaleString("en-US") ?? ""} at ${e.scanPoint ?? "backflush"}`))
      }
    if (!ser?.batchId) {
      const rec = ev.find((x) => x.type === "T02" && x.serial === id)
      if (rec && depth + 1 < MAX_DEPTH) n.children.push({ key: `grn:${rec.doc.id}:${depth + 1}`, kind: "grn", id: rec.doc.id, label: rec.doc.id, sub: rec.evidence, depth: depth + 1, children: [], doc: rec.doc })
    }
    return n
  }
  const walkBatch = (id: string, depth: number, note?: string): TraceNode => {
    const n = batchNode(s, id, depth, note)
    const b = s.batches.find((x) => x.id === id)
    if (b?.grnId && depth + 1 < MAX_DEPTH) {
      const g: TraceNode = { key: `grn:${b.grnId}:${depth + 1}`, kind: "grn", id: b.grnId, label: b.grnId, sub: `Goods receipt ${b.receivedOn}, ${b.qtyReceived.toLocaleString("en-US")} received`, depth: depth + 1, children: [], doc: { type: "grn", id: b.grnId } }
      if (b.poId && depth + 2 < MAX_DEPTH)
        g.children.push({ key: `po:${b.poId}:${depth + 2}`, kind: "purchaseOrder", id: b.poId, label: b.poId, sub: vendorById(b.vendorId ?? "")?.name ?? b.vendorId, depth: depth + 2, children: [], doc: { type: "purchaseOrder", id: b.poId } })
      n.children.push(g)
    }
    return n
  }
  return root.type === "serial" ? walkSerial(root.id, 0) : walkBatch(root.id, 0)
}

/** Forward trace (where used): where this batch or serial went. */
export function forward(s: TraceSource, root: { type: "serial" | "batch"; id: string }): TraceNode {
  const ev = active(s)
  const walkSerial = (id: string, depth: number, note?: string): TraceNode => {
    const ser = s.serials.find((x) => x.id === id)
    const n = serialNode(s, id, depth, { note })
    if (depth >= MAX_DEPTH - 1) return n
    const removed = ev.find((e) => e.type === "T06" && e.action === "remove" && e.serial === id)
    if (removed) {
      n.note = `Removed from ${removed.parentSerial} on ${removed.at.slice(0, 10)}; returned on ${removed.doc.id}`
      const ret = ev.find((e) => e.type === "T12" && e.serial === id)
      if (ret) n.children.push({ key: `rma:${ret.doc.id}:${depth + 1}`, kind: "site", id: ret.doc.id, label: ret.doc.id, sub: ret.evidence, depth: depth + 1, children: [], doc: ret.doc })
    }
    if (ser?.parentSerial) n.children.push(walkSerial(ser.parentSerial, depth + 1, "Installed in (SP-12)"))
    else {
      const ships = ev.filter((e) => e.type === "T11" && e.serial === id && e.doc.type === "delivery")
      for (const sh of ships) {
        const d: TraceNode = { key: `dlv:${sh.doc.id}:${depth + 1}`, kind: "delivery", id: sh.doc.id, label: sh.doc.id, sub: sh.evidence, depth: depth + 1, children: [], doc: sh.doc }
        if (ser?.customerId && depth + 2 < MAX_DEPTH) d.children.push({ key: `site:${id}:${depth + 2}`, kind: "site", id: ser.customerId, label: customerName(ser.customerId) ?? ser.customerId, sub: ser.site, depth: depth + 2, children: [], doc: { type: "customer", id: ser.customerId } })
        n.children.push(d)
      }
      if (!ships.length && ser?.customerId && ser.status === "Shipped")
        n.children.push({ key: `site:${id}:${depth + 1}`, kind: "site", id: ser.customerId, label: customerName(ser.customerId) ?? ser.customerId, sub: ser.site, depth: depth + 1, children: [], doc: { type: "customer", id: ser.customerId } })
    }
    return n
  }
  if (root.type === "serial") return walkSerial(root.id, 0)
  const n = batchNode(s, root.id, 0)
  const ids = new Set<string>()
  for (const x of s.serials.filter((x) => x.batchId === root.id)) ids.add(x.id)
  for (const e of ev.filter((x) => x.type === "T05" && x.batch === root.id && x.serial)) ids.add(e.serial!)
  for (const id of ids) n.children.push(walkSerial(id, 1))
  for (const e of ev.filter((x) => x.type === "T05" && x.batch === root.id && !x.serial))
    n.children.push({ key: `wo:${e.doc.id}:1`, kind: "productionOrder", id: e.doc.id, label: e.doc.id, sub: `Issued ${e.qty ?? ""} (${e.scanPoint ?? "backflush"})`, depth: 1, children: [], doc: e.doc })
  return n
}

export const countNodes = (n: TraceNode): number => 1 + n.children.reduce((a, c) => a + countNodes(c), 0)
export const flatten = (n: TraceNode): TraceNode[] => [n, ...n.children.flatMap(flatten)]

/** Recall population by forward trace: every serial in or built from the suspect batches / serials. */
export function derivePopulation(s: TraceSource, suspect: { batches: string[]; serials: string[] }, version: number): PopulationRow[] {
  const ev = active(s)
  const rows: PopulationRow[] = []
  const top = (ser: QtSerial): QtSerial => {
    let cur = ser
    for (let i = 0; i < 6 && cur.parentSerial; i++) {
      const p = s.serials.find((x) => x.id === cur.parentSerial)
      if (!p) break
      cur = p
    }
    return cur
  }
  const add = (ser: QtSerial, batchId: string) => {
    if (rows.some((r) => r.serial === ser.id)) return
    const t = top(ser)
    const returned = ev.some((e) => e.type === "T12" && e.serial === ser.id)
    const where: PopulationWhere = returned ? "Returned" : t.status === "Shipped" ? "In field" : t.status === "In Production" ? "WIP" : t.status === "Picked" ? "In transit" : "In stock"
    const b = s.batches.find((x) => x.id === batchId)
    rows.push({
      serial: ser.id, itemId: ser.materialId, batchId: batchId as PopulationRow["batchId"], where, parentSerial: ser.parentSerial,
      customerId: where === "In field" || where === "Returned" ? t.customerId : undefined, site: where === "In field" || where === "Returned" ? t.site : undefined,
      warehouseId: where === "In stock" ? b?.warehouseId : undefined, held: where === "In stock" || where === "Returned" ? b?.stock === "Blocked" || returned : false, addedInVersion: version,
    })
  }
  for (const bid of suspect.batches) {
    for (const ser of s.serials.filter((x) => x.batchId === bid)) add(ser, bid)
    for (const e of ev.filter((x) => x.type === "T05" && x.batch === bid && x.serial)) {
      const ser = s.serials.find((x) => x.id === e.serial)
      if (ser) add(ser, bid)
    }
  }
  for (const sid of suspect.serials) {
    const ser = s.serials.find((x) => x.id === sid)
    if (ser) add(ser, ser.batchId ?? suspect.batches[0] ?? "BAT-TBD-NONE")
  }
  return rows
}
