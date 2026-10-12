// Document flow: the linkage spine [DOC:pp.276-277 §16] (asserted) as typed links.
// A DocRef points at one document; a DocLink says "predecessor -> successor, because <kind>".
// DocumentFlowPanel walks these links both ways from any document.

import type { RecordKind } from "./status"

export const DOC_TYPES = {
  lead: { label: "Lead", route: (id: string) => `/sales/leads/${id}`, status: undefined },
  opportunity: { label: "Opportunity", route: (id: string) => `/sales/leads/${id}`, status: undefined },
  customer: { label: "Customer", route: (id: string) => `/sales/customers/${id}`, status: "customer" },
  quotation: { label: "Quotation", route: (id: string) => `/sales/quotations/${id}`, status: "quotation" },
  costEstimate: { label: "Cost estimate", route: (id: string) => `/costing/estimates/${id}`, status: "costEstimate" },
  salesOrder: { label: "Sales order", route: (id: string) => `/sales/orders/${id}`, status: "salesOrder" },
  engineeringRequest: { label: "Engineering request", route: (id: string) => `/engineering/requests/${id}`, status: "engineeringRequest" },
  ebom: { label: "EBOM", route: (id: string) => `/engineering/boms/${id}`, status: "ebom" },
  mbom: { label: "MBOM", route: (id: string) => `/engineering/mbom-transform/${id}`, status: "mbom" },
  productionVersion: { label: "Production version", route: (id: string) => `/engineering/production-versions/${id}`, status: "productionVersion" },
  document: { label: "Document", route: (id: string) => `/engineering/documents/${id}`, status: "document" },
  transmittal: { label: "Transmittal", route: (id: string) => `/engineering/transmittals/${id}`, status: undefined },
  ecr: { label: "ECR", route: (id: string) => `/engineering/change-requests/${id}`, status: undefined },
  eco: { label: "ECO", route: (id: string) => `/engineering/change-orders/${id}`, status: undefined },
  mcr: { label: "Material creation request", route: (id: string) => `/materials/creation-requests/${id}`, status: undefined },
  material: { label: "Material", route: (id: string) => `/inventory/items/${id}`, status: "material" },
  llr: { label: "Long-lead release", route: (id: string) => `/purchasing/long-lead/${id}`, status: undefined },
  stp: { label: "Supplier technical package", route: (id: string) => `/purchasing/long-lead/${id}`, status: undefined },
  requisition: { label: "Purchase requisition", route: (id: string) => `/purchasing/requisitions/${id}`, status: "requisition" },
  rfq: { label: "RFQ", route: (id: string) => `/purchasing/rfqs/${id}`, status: "rfq" },
  purchaseOrder: { label: "Purchase order", route: (id: string) => `/purchasing/orders/${id}`, status: "purchaseOrder" },
  grn: { label: "Goods receipt (INV)", route: (id: string) => `/traceability/explorer?q=${id}`, status: undefined },
  batch: { label: "Batch", route: (id: string) => `/traceability/explorer?q=${id}`, status: "stock" },
  serial: { label: "Serial", route: (id: string) => `/traceability/explorer?q=${id}`, status: "serial" },
  inspectionLot: { label: "Inspection", route: (id: string) => `/quality/inspections/${id}`, status: undefined },
  plannedOrder: { label: "Planned order", route: (id: string) => `/production/planned-orders?id=${id}`, status: undefined },
  productionOrder: { label: "Production order", route: (id: string) => `/production/orders/${id}`, status: "productionOrder" },
  reworkOrder: { label: "Rework order", route: (id: string) => `/production/rework/${id}`, status: "reworkOrder" },
  delivery: { label: "Delivery", route: (id: string) => `/sales/deliveries?d=${id}`, status: "delivery" },
  pod: { label: "Proof of delivery", route: (id: string) => `/sales/pod/${id}`, status: "pod" },
  invoiceRequest: { label: "Invoice request (ACC)", route: (id: string) => `/sales/orders?ir=${id}`, status: undefined },
  installedBase: { label: "Installed base", route: (id: string) => `/service/installed-base/${id}`, status: "installedBase" },
  rma: { label: "RMA", route: (id: string) => `/sales/rma/${id}`, status: "rma" },
  ncr: { label: "NCR (INV)", route: (id: string) => `/quality/capa?ncr=${id}`, status: undefined },
  capa: { label: "CAPA", route: (id: string) => `/quality/capa/${id}`, status: "capa" },
  scar: { label: "SCAR", route: (id: string) => `/quality/scar/${id}`, status: undefined },
  recall: { label: "Recall campaign", route: (id: string) => `/quality/recalls/${id}`, status: "recall" },
  deviation: { label: "Deviation / waiver", route: (id: string) => `/quality/deviations/${id}`, status: undefined },
  approval: { label: "Approval request", route: (id: string) => `/approvals?req=${id}`, status: undefined },
} as const satisfies Record<string, { label: string; route: (id: string) => string; status: RecordKind | undefined }>

export type DocType = keyof typeof DOC_TYPES

export interface DocRef {
  type: DocType
  id: string
}

/** Why two documents are linked. Spine verbs from [DOC:pp.276-277 §16] (asserted). */
export type LinkKind =
  | "converts to" // lead -> opportunity -> quotation -> sales order
  | "revises" // quotation V(n) -> V(n+1)
  | "prices" // cost estimate -> quotation
  | "triggers" // SO line -> engineering request
  | "delivers" // engineering request -> EBOM / document / transmittal
  | "transforms to" // EBOM -> MBOM
  | "paired in" // MBOM -> production version
  | "creates" // engineering request -> MCR, MCR -> material, recall -> RMA
  | "authorises" // LLR -> PO
  | "references" // STP -> RFQ / PO line
  | "pegs" // SO schedule line -> WO / PR / planned order
  | "sources" // PR -> RFQ -> PO
  | "receives" // PO -> GRN
  | "consumes" // batch / serial -> WO (genealogy)
  | "produces" // WO -> serial
  | "fulfils" // SO -> delivery
  | "closes" // delivery -> POD
  | "bills" // delivery -> invoice request
  | "installs" // serial -> installed base
  | "returns" // installed base / delivery -> RMA
  | "inspects" // GRN / WO -> inspection
  | "escalates" // NCR -> CAPA / SCAR, RMA -> NCR
  | "contains" // recall -> batch / serial / WO
  | "reworks" // RMA / WO / NCR -> rework order
  | "approves" // approval request -> document

export interface DocLink {
  from: DocRef
  to: DocRef
  kind: LinkKind
  /** Optional detail such as "line 10, schedule 10". */
  note?: string
}

export const ref = (type: DocType, id: string): DocRef => ({ type, id })
export const sameRef = (a: DocRef, b: DocRef) => a.type === b.type && a.id === b.id
export const refKey = (r: DocRef) => `${r.type}:${r.id}`
export const docRoute = (r: DocRef) => DOC_TYPES[r.type].route(r.id)
export const docLabel = (r: DocRef) => DOC_TYPES[r.type].label

/** Walk links from a document. direction "up" = predecessors, "down" = successors.
 *  `exclude` holds documents already shown on the other side, so a cycle in the graph (a recall
 *  that contains a batch its own chain consumed) does not list a document twice. */
export function walk(links: DocLink[], start: DocRef, direction: "up" | "down", maxDepth = 12, exclude: Set<string> = new Set()) {
  const out: { link: DocLink; depth: number }[] = []
  const seen = new Set([refKey(start), ...exclude])
  let frontier = [start]
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: DocRef[] = []
    for (const node of frontier)
      for (const l of links) {
        const hit = direction === "down" ? sameRef(l.from, node) : sameRef(l.to, node)
        if (!hit) continue
        const other = direction === "down" ? l.to : l.from
        if (seen.has(refKey(other))) continue
        seen.add(refKey(other))
        out.push({ link: l, depth })
        next.push(other)
      }
    frontier = next
  }
  return out
}
