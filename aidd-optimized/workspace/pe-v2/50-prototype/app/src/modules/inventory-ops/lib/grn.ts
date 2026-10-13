// Goods receipt delta (FL-10 stage 13): one view over a dock receipt (not yet a GRN) and a posted GRN,
// with the supplier technical package (STP) chip data, the E-DTS-04 block and the certificate-vs-STP
// checklist. Sources: Book IV §3.3 [DOC:pp.209-210] (STP object, vendor acknowledgement, "receipt
// against a PO whose vendor never acknowledged a revised STP hard-blocks (E-DTS-04)", "GRN validates
// the batch/certificates against the STP requirements (extends E-QM-06); wrong-revision documentation
// at receipt blocks acceptance with the STP diff shown"); Book II §3.10 (certificate requirements,
// E-QM-06) (asserted).
import { MATERIALS, VENDORS } from "@/data/shared"
import type { SliceStates } from "@/store"
import type { CertDoc, GrnCheck, InventoryOpsState } from "../data/types"
import { blocksAccept, blocksPost, certRequirements, receiptChecklist, type CheckRow } from "./rules"

type PF = SliceStates["purchasingFinance"]
type Mat = SliceStates["materials"]

export interface ReceiptView {
  kind: "dock" | "grn"
  id: string
  poId: string
  line?: number
  vendorId: string
  vendorName: string
  itemId: string
  qty: number
  uom: string
  on: string
  batch?: string
  vendorBatch?: string
  dock?: string
  deliveryNote?: string
  poStatus?: string
  stp?: PF["stps"][number]
  ack?: { status: string; on: string }
  certs: CertDoc[]
  rows: CheckRow[]
  accepted?: GrnCheck["accepted"]
  postedAs?: string
  price?: number
  std?: number
  value?: number
  currency?: "USD" | "CAD"
  serials: string[]
  note?: string
  required: string[]
  hasRecord: boolean
  poMissing: boolean
}

const vendorName = (id: string) => VENDORS.find((v) => v.id === id)?.name ?? (id === "VEN-TBD-0120" ? "PE Grid Components (intercompany)" : id)
const uom = (id: string) => MATERIALS.find((m) => m.id === id)?.baseUom ?? "EA"

export function dockView(pf: PF, io: InventoryOpsState, id: string): ReceiptView | undefined {
  const r = io.inbound.find((x) => x.id === id)
  if (!r) return undefined
  const po = pf.purchaseOrders.find((p) => p.id === r.poId)
  const l = po?.lines.find((x) => x.no === r.line)
  const stp = l?.stpId ? pf.stps.find((s) => s.id === l.stpId) : undefined
  const ack = stp?.acknowledgements.find((a) => a.vendorId === po?.vendorId)
  const itemId = l?.itemId ?? ""
  return {
    kind: "dock", id: r.id, poId: r.poId, line: r.line, vendorId: po?.vendorId ?? "", vendorName: vendorName(po?.vendorId ?? ""), itemId, qty: r.qty, uom: uom(itemId), on: r.arrivedOn, vendorBatch: r.vendorBatch, dock: r.dock, deliveryNote: r.deliveryNote,
    poStatus: po?.status, stp, ack, certs: r.certs, postedAs: r.postedAs, price: l?.price, currency: po?.currency, value: l ? Math.round(r.qty * l.price * 100) / 100 : undefined, serials: [],
    rows: receiptChecklist({ itemId, vendorId: po?.vendorId ?? "", stp, certs: r.certs, vendorBatch: r.vendorBatch, posted: false }), required: certRequirements(itemId), hasRecord: true, poMissing: !po,
  }
}

export function grnView(pf: PF, mats: Mat, io: InventoryOpsState, id: string): ReceiptView | undefined {
  const g = pf.grns.find((x) => x.id === id)
  const mg = mats.grns.find((x) => x.id === id)
  if (!g && !mg) return undefined
  const poId = g?.poId ?? mg!.poId
  const po = pf.purchaseOrders.find((p) => p.id === poId)
  const line = g?.lines[0]
  const itemId = line?.itemId ?? mg?.lines[0]?.materialId ?? ""
  const l = po?.lines.find((x) => x.no === line?.poLine)
  const stp = l?.stpId ? pf.stps.find((s) => s.id === l.stpId) : undefined
  const vendorId = po?.vendorId ?? mg?.vendorId ?? ""
  const ack = stp?.acknowledgements.find((a) => a.vendorId === vendorId)
  const chk = io.grnChecks.find((c) => c.grnId === id)
  const qty = g ? g.lines.reduce((a, x) => a + x.qty, 0) : (mg?.lines.reduce((a, x) => a + x.qty, 0) ?? 0)
  const batch = g?.batches[0] ?? mg?.lines[0]?.batchId
  const vendorBatch = chk?.vendorBatch ?? mg?.lines[0]?.vendorBatch
  return {
    kind: "grn", id, poId, line: line?.poLine, vendorId, vendorName: vendorName(vendorId), itemId, qty, uom: uom(itemId), on: g?.on ?? mg!.on, batch, vendorBatch, poStatus: po?.status, stp, ack, certs: chk?.certs ?? [], accepted: chk?.accepted,
    price: line?.price, std: line?.std, value: g ? Math.round(g.lines.reduce((a, x) => a + x.qty * x.price, 0) * 100) / 100 : mg?.lines.reduce((a, x) => a + x.value, 0), currency: po?.currency ?? "USD", serials: g?.serials ?? mg?.lines.flatMap((x) => x.serials) ?? [], note: mg?.note,
    rows: receiptChecklist({ itemId, vendorId, stp, certs: chk?.certs ?? [], vendorBatch, posted: true }), required: certRequirements(itemId), hasRecord: !!chk, poMissing: !po,
  }
}

/** Every posted GRN: the purchasing slice's, plus any only the materials slice holds. */
export function grnIds(pf: PF, mats: Mat): string[] {
  const ids = new Set<string>(pf.grns.map((g) => g.id))
  for (const g of mats.grns) ids.add(g.id)
  return [...ids]
}

export function summarize(v: ReceiptView) {
  const accept = blocksAccept(v.rows)
  const post = blocksPost(v.rows)
  const certRows = v.rows.filter((r) => v.required.includes(r.id))
  const pass = certRows.filter((r) => r.result === "Pass").length
  const wrong = certRows.filter((r) => r.result === "Wrong revision").length
  const missing = certRows.filter((r) => r.result === "Missing").length
  return { accept, post, certTotal: certRows.length, pass, wrong, missing }
}
