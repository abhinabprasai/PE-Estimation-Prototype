// Reference data the engineering screens read but do not own.
//
// ROUTINGS mirrors the routing headers and operations that planning-production owns (PP-RTG-001/2).
// MBOM-TRF validates "Consume At Operation" against a routing [DOC:p.66 §6 step 3] and PV-001 pairs
// an MBOM with a Released routing [DOC:p.214] (asserted); until that group exports its routings,
// these are read-only design values (shown with a design chip) using the shared work centers.
// LLR_MIRROR mirrors the two long-lead releases on the spine (owned by purchasing-finance) so an ECO
// can show the per-PO commercial decision [DOC:p.209 §3.2] (asserted).

import type { LlrId, MaterialId, RoutingId, RoutingStatus, WorkCenterId } from "@/data/domain"

export interface RoutingOp {
  op: number
  wc: WorkCenterId
  text: string
}
export interface RoutingMirror {
  id: RoutingId
  rev: string
  status: RoutingStatus
  materialId: MaterialId
  ops: RoutingOp[]
}

const TRANSFORMER_OPS: RoutingOp[] = [
  { op: 10, wc: "WC-050", text: "Tank fabrication, welding, radiator fit-up" },
  { op: 20, wc: "WC-100", text: "Core cutting, step-lap" },
  { op: 30, wc: "WC-110", text: "Core stacking and clamping" },
  { op: 40, wc: "WC-200", text: "LV winding" },
  { op: 50, wc: "WC-210", text: "HV winding" },
  { op: 60, wc: "WC-220", text: "Coil assembly and sizing" },
  { op: 70, wc: "WC-230", text: "Vapor phase drying" },
  { op: 80, wc: "WC-300", text: "Core and coil assembly" },
  { op: 90, wc: "WC-310", text: "Tanking and gasketing" },
  { op: 100, wc: "WC-400", text: "Final assembly and fittings" },
  { op: 110, wc: "WC-320", text: "Vacuum and oil filling" },
  { op: 120, wc: "WC-500", text: "Routine tests, IEEE C57.12.90" },
  { op: 130, wc: "WC-600", text: "Paint and finishing" },
  { op: 140, wc: "WC-700", text: "Packing and shipping prep" },
]
const PAD_OPS = TRANSFORMER_OPS.filter((o) => ![30, 70].includes(o.op))

export const ROUTINGS: RoutingMirror[] = [
  { id: "RTG-TBD-20MVA", rev: "B", status: "Released", materialId: "FIN-TBD-20MVA", ops: TRANSFORMER_OPS },
  { id: "RTG-TBD-20MVA", rev: "A", status: "Superseded", materialId: "FIN-TBD-20MVA", ops: TRANSFORMER_OPS },
  { id: "RTG-TBD-5000SS", rev: "C", status: "Released", materialId: "FIN-TBD-5000SS", ops: TRANSFORMER_OPS },
  { id: "RTG-TBD-2500PM", rev: "B", status: "Released", materialId: "FIN-TBD-2500PM", ops: PAD_OPS },
  { id: "RTG-TBD-2500PM", rev: "C", status: "Released", materialId: "FIN-TBD-2500PM", ops: PAD_OPS },
  { id: "RTG-TBD-2500PS", rev: "A", status: "Released", materialId: "FIN-TBD-2500PM", ops: PAD_OPS },
  { id: "RTG-TBD-1000PM", rev: "A", status: "Released", materialId: "FIN-TBD-1000PM", ops: PAD_OPS },
  { id: "RTG-TBD-0167PL", rev: "B", status: "Released", materialId: "FIN-TBD-0167PL", ops: PAD_OPS },
  { id: "RTG-TBD-7500", rev: "A", status: "Released", materialId: "FIN-TBD-7500MTO", ops: PAD_OPS },
  { id: "RTG-TBD-7500", rev: "B", status: "In Review", materialId: "FIN-TBD-7500MTO", ops: PAD_OPS },
  { id: "RTG-TBD-0050PL", rev: "D", status: "Draft", materialId: "FIN-TBD-0050PL", ops: PAD_OPS },
]
export const routingFor = (id: string, rev: string) => ROUTINGS.find((r) => r.id === id && r.rev === rev)
export const releasedRoutingsFor = (materialId: string) => ROUTINGS.filter((r) => r.materialId === materialId && r.status === "Released")

export const LLR_MIRROR: { id: LlrId; items: MaterialId[]; pos: { poId: string; itemId: MaterialId }[]; open: boolean }[] = [
  { id: "LLR-2026-0004", items: ["RAW-TBD-CRGO23", "RAW-TBD-OLTC"], pos: [{ poId: "PO-TBD-0301", itemId: "RAW-TBD-OLTC" }], open: false },
  { id: "LLR-2026-0011", items: ["RAW-TBD-CRGO23", "RAW-TBD-OLTC"], pos: [{ poId: "PO-TBD-0377", itemId: "RAW-TBD-CRGO23" }], open: true },
]

/** Long-lead flagged items [DOC:p.209 §3.2] (asserted): core steel, copper, bushings, tap changers. */
export const LONG_LEAD_ITEMS: MaterialId[] = ["RAW-TBD-CRGO23", "RAW-TBD-CTC", "RAW-TBD-FOIL", "RAW-TBD-BSH145", "RAW-TBD-OLTC"]
