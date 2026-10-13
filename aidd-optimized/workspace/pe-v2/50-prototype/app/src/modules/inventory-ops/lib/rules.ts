// Rules and pure computations for inventory-ops, each tied to its PRD source [DOC:p.n] (asserted).
// Where the PRD is silent the choice is a reading (lib/readings.ts), never presented as a PRD rule.

import type { Role, ScanPointCode } from "@/data/domain"
import { MATERIALS } from "@/data/shared"
import type { SliceStates } from "@/store"
import type { CertDoc, CertType, InvTask, TaskQueue, TaskType } from "../data/types"

// ============================================================================ warehouse tasks
export const TASK_CFG: Record<TaskType, { sp: ScanPointCode; queue: TaskQueue; roles: Role[]; hint: string }> = {
  Receiving: { sp: "SP-01", queue: "Inbound", roles: ["Receiving clerk", "Warehouse supervisor"], hint: "Identify against the PO: scan the PO barcode, then the item." },
  Putaway: { sp: "SP-04", queue: "Inbound", roles: ["Warehouse operator", "Warehouse supervisor"], hint: "Scan the batch label, then the destination bin." },
  Replenishment: { sp: "SP-04", queue: "Internal", roles: ["Warehouse operator", "Warehouse supervisor"], hint: "Move from bulk to the fixed pick bin: scan the batch label, then the pick bin." },
  Pick: { sp: "SP-15", queue: "Outbound", roles: ["Warehouse operator", "Warehouse supervisor"], hint: "Scan the bin, then the item or batch to pick." },
  Stage: { sp: "SP-09", queue: "Internal", roles: ["Warehouse operator", "Warehouse supervisor"], hint: "Scan the picklist, then the staging location." },
  Pack: { sp: "SP-16", queue: "Outbound", roles: ["Packer", "Warehouse supervisor"], hint: "Scan the handling unit, then the item or batch added to it." },
  Load: { sp: "SP-18", queue: "Outbound", roles: ["Packer", "Shipping office", "Warehouse supervisor"], hint: "Scan each handling unit at the truck, then the shipment document." },
  Transfer: { sp: "SP-06", queue: "Internal", roles: ["Warehouse operator", "Warehouse supervisor"], hint: "Scan the item or batch, then the receiving bin." },
}
/** RD-IO-03. */
export const canWorkTask = (role: Role, type: TaskType) => TASK_CFG[type].roles.includes(role)
/** RD-IO-04. */
export const SUPERVISOR_ROLES: Role[] = ["Warehouse supervisor"]
/** Roles that carry a handheld and badge in to the work queue (SP-07). */
export const FLOOR_ROLES: Role[] = ["Warehouse operator", "Receiving clerk", "Packer", "Shipping office", "Warehouse supervisor"]
export const TASK_STATUS_ORDER = ["Queued", "Assigned", "In Progress", "Done/Exception"] as const
export const PRIORITY_RANK = { Urgent: 0, High: 1, Normal: 2 } as const

/** Scan error text per scan point; the E-code where the PRD gives one. */
export const SCAN_ERROR: Partial<Record<ScanPointCode, string>> = { "SP-18": "E-BC-08" }

export const taskAgeHours = (t: Pick<InvTask, "createdAt">, now = "2026-10-09T12:00") =>
  Math.max(0, Math.round((new Date(now + ":00Z").getTime() - new Date(t.createdAt + ":00Z").getTime()) / 3600000))

// ============================================================================ count rules (p.36-37 §7)
export const COUNT_RULES = { recountPct: 2, recountAmount: 500, abcTolerancePct: { A: 0.5, B: 2, C: 5 } as Record<"A" | "B" | "C", number> }
export const FLOOR_COUNT_ROLES: Role[] = ["Warehouse operator", "Warehouse supervisor"]

// ============================================================================ certificates vs STP (p.209-210 §3.3; p.150 §3.10)
/** RD-IO-09: certificate requirements per material (a Quality-view field in the PRD). */
const CERT_REQ: Record<string, CertType[]> = {
  "RAW-TBD-BSH145": ["CoC per Shipment", "FAI Report"],
  "RAW-TBD-BSH015": ["CoC per Shipment", "FAI Report"],
  "RAW-TBD-OLTC": ["CoC per Shipment", "FAI Report", "CoA"],
  "RAW-TBD-CRGO23": ["Mill Cert per Heat"],
  "RAW-TBD-PLATE": ["Mill Cert per Heat"],
  "RAW-TBD-OIL": ["CoA"],
  "RAW-TBD-CTC": ["CoC per Shipment"],
}
export const certRequirements = (itemId: string): CertType[] => CERT_REQ[itemId] ?? (MATERIALS.find((m) => m.id === itemId)?.type === "RAW" ? ["CoC per Shipment"] : [])

export type CheckResult = "Pass" | "Fail" | "Missing" | "Wrong revision" | "Note" | "Not applicable"
export interface CheckRow {
  id: string
  label: string
  required: string
  found: string
  result: CheckResult
  /** What the failure blocks: the receipt posting (E-DTS-04) or its acceptance (E-QM-06 and the revision rule). */
  blocks?: "post" | "accept"
  /** The STP diff shown for wrong-revision documentation (p.210 §3.3). */
  diff?: { drawing: string; required: string; found: string }
  code?: string
}
interface StpLike {
  id: string
  version: number
  superseded: boolean
  supersededBy?: string
  drawingRevisions: string[]
  acknowledgements: { vendorId: string; status: string; on: string }[]
}
const parseDrawing = (s: string) => {
  const m = s.match(/^(.*?)\s+rev\s+(\S+)$/i)
  return m ? { drawing: m[1].trim(), rev: m[2] } : { drawing: s.trim(), rev: undefined as string | undefined }
}

/** The certificate-vs-STP checklist for one receipt line (FL-10 stage 13). `post` rows gate the posting; `accept` rows gate acceptance. */
export function receiptChecklist(i: { itemId: string; vendorId: string; stp?: StpLike; certs: CertDoc[]; vendorBatch?: string; posted: boolean }): CheckRow[] {
  const rows: CheckRow[] = []
  const { stp } = i
  if (!stp) {
    rows.push({ id: "stp", label: "Supplier technical package on the PO line", required: "Not required for this line", found: "No STP referenced", result: "Not applicable" })
  } else {
    rows.push({ id: "stp", label: "PO line references exactly one STP version", required: "One STP version", found: `${stp.id} version ${stp.version}`, result: "Pass" })
    rows.push(
      stp.superseded
        ? { id: "stp-current", label: "STP version is current", required: "Not superseded (E-DTS-03 for new documents)", found: `Superseded by ${stp.supersededBy ?? "a later version"}`, result: i.posted ? "Note" : "Fail", blocks: i.posted ? undefined : "post", code: "E-DTS-03" }
        : { id: "stp-current", label: "STP version is current", required: "Not superseded", found: "Current", result: "Pass" },
    )
    const ack = stp.acknowledgements.find((a) => a.vendorId === i.vendorId)
    rows.push({
      id: "ack",
      label: "Vendor acknowledged this STP version",
      required: "Acknowledged (RD-IO-08)",
      found: ack ? `${ack.status} on ${ack.on}` : "Never acknowledged",
      result: ack?.status === "Acknowledged" ? "Pass" : "Fail",
      blocks: i.posted ? undefined : "post",
      code: "E-DTS-04",
    })
  }
  for (const t of certRequirements(i.itemId)) {
    const c = i.certs.find((x) => x.type === t)
    if (!c) {
      rows.push({ id: t, label: t, required: `${t} attached (E-QM-06)`, found: "Not attached", result: "Missing", blocks: "accept", code: "E-QM-06" })
      continue
    }
    if (t === "Mill Cert per Heat") {
      const ok = !i.vendorBatch || !c.cites || c.cites === i.vendorBatch
      rows.push({ id: t, label: t, required: i.vendorBatch ? `Heat ${i.vendorBatch}` : "Heat number", found: `${c.docNo}${c.cites ? `, heat ${c.cites}` : ""}`, result: ok ? "Pass" : "Fail", blocks: ok ? undefined : "accept" })
      continue
    }
    if (c.cites && stp) {
      const cite = parseDrawing(c.cites)
      const want = stp.drawingRevisions.map(parseDrawing).find((d) => d.drawing === cite.drawing)
      if (want && want.rev && cite.rev !== want.rev) {
        rows.push({ id: t, label: t, required: `${want.drawing} rev ${want.rev}`, found: `${c.docNo} cites rev ${cite.rev}`, result: "Wrong revision", blocks: "accept", diff: { drawing: want.drawing, required: `rev ${want.rev}`, found: `rev ${cite.rev}` } })
        continue
      }
    }
    rows.push({ id: t, label: t, required: stp?.drawingRevisions[0] ? `Cites the STP drawing revision` : `${t} attached`, found: `${c.docNo}${c.cites ? ` cites ${c.cites}` : ""}`, result: "Pass" })
  }
  return rows
}
export const blocksPost = (rows: CheckRow[]) => rows.filter((r) => r.blocks === "post" && r.result !== "Pass")
export const blocksAccept = (rows: CheckRow[]) => rows.filter((r) => r.blocks === "accept" && r.result !== "Pass")

// ============================================================================ valuation classes (Book II §5.1, §13)
/** Material type to PRD valuation class and the inventory account it posts to (p.145 §5.1). */
export const VC_BY_TYPE: Record<string, { vc: string; label: string; account: string }> = {
  RAW: { vc: "VC-3000", label: "Raw Materials", account: "1310" },
  SEMI: { vc: "VC-7900", label: "Semi-Finished", account: "1310" },
  FIN: { vc: "VC-7920", label: "Finished Goods", account: "1330" },
  TRADE: { vc: "VC-3100", label: "Trading Goods", account: "1330" },
  PACK: { vc: "VC-3060", label: "Packaging", account: "1360" },
  SPARE: { vc: "VC-3040", label: "Spares", account: "1340" },
  CONS: { vc: "VC-3080", label: "Consumables", account: "1310" },
}
export const VC_ORDER = ["VC-3000", "VC-7900", "VC-3080", "VC-7920", "VC-3100", "VC-3060", "VC-3040"]

type Mat = SliceStates["materials"]
const materialType = (s: Mat, id: string) => (MATERIALS.find((m) => m.id === id) ?? s.created.find((m) => m.id === id))?.type
const rateOf = (s: Mat, id: string) => {
  const v = s.valuations.filter((x) => x.materialId === id).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
  const std = (MATERIALS.find((m) => m.id === id) ?? s.created.find((m) => m.id === id))?.stdCost
  if (v) return (v.method === "Standard" ? v.stdCost : v.mav) ?? std ?? 0
  return std ?? 0
}
/** Own stock value by valuation class, and what sits in transit (account 1350). */
export function subledgerByClass(s: Mat) {
  const byVc = new Map<string, number>()
  let inTransit = 0
  for (const r of s.stock) {
    if (r.bucket === "Consignment" || r.bucket === "Customer Property" || r.bucket === "At Subcontractor") continue
    const v = r.qty * rateOf(s, r.materialId)
    if (r.bucket === "In-Transit") {
      inTransit += v
      continue
    }
    const t = materialType(s, r.materialId)
    const vc = t ? VC_BY_TYPE[t]?.vc : undefined
    if (!vc) continue
    byVc.set(vc, (byVc.get(vc) ?? 0) + v)
  }
  return { byVc, inTransit }
}
export const round2 = (n: number) => Math.round(n * 100) / 100
