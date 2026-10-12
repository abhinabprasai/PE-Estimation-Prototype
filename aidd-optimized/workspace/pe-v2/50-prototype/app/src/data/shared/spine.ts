// Linkage-spine documents: the cross-module thread every flow hangs on [DOC:pp.276-277 §16]
// (asserted), see 40-models/as-is/README.md section 3.
//
// HERO THREAD (ETO). Midland Plains Grid Constructors (CUS-TBD-0048), "Omaha North 115 kV
// substation", buys 20 MVA substation transformers (FIN-TBD-20MVA) in two phases:
//   Phase 1, SO-2026-00301: one unit, the complete chain lead -> quote -> SO -> engineering request
//     -> EBOM -> MBOM -> MCR / LLR / STP -> PR -> RFQ -> PO -> GRN batch -> production order ->
//     final test -> delivery -> POD -> installed base -> RMA -> NCR / SCAR / CAPA -> recall.
//   Phase 2, SO-2026-00377 (already in the FL-09 sales seed): three units, now in engineering with a
//     long-lead release and a purchase order in approval. The recall's suspect bushing batch sits
//     in stock reserved for phase 2, so the recall reaches back into an open order.
//
// These are HEADERS. Each document's full record is seeded by the module that owns it (`owner`),
// using exactly the ID, status and links below. A module may add documents of its own; it may not
// change a spine header without a "Requests to foundation" entry in its README.
// Every value is a fictitious design value; statuses are verbatim S-n names.

import type { DocLink, DocRef, RecordKind } from "@/data/domain"
import type { ModuleGroup } from "@/data/modules"

export interface SpineDoc {
  ref: DocRef
  title: string
  status?: { kind: RecordKind; value: string }
  date: string
  owner: ModuleGroup
  summary: string
  phase: 1 | 2
}

const d = (type: DocRef["type"], id: string, title: string, owner: ModuleGroup, date: string, summary: string, status?: SpineDoc["status"], phase: 1 | 2 = 1): SpineDoc => ({
  ref: { type, id }, title, owner, date, summary, status, phase,
})

export const HERO = {
  customerId: "CUS-TBD-0048",
  itemId: "FIN-TBD-20MVA",
  project: "Omaha North 115 kV substation",
  phase1Order: "SO-2026-00301",
  phase2Order: "SO-2026-00377",
  unitSerial: "SN-TBD-20M-0301",
  suspectBatch: "BAT-TBD-B0301",
  recall: "RCL-2026-001",
} as const

export const SPINE_DOCS: SpineDoc[] = [
  // ---------------- phase 1: complete chain
  d("customer", "CUS-TBD-0048", "Midland Plains Grid Constructors", "sales", "2025-06-02", "EPC contractor, credit limit $5,000,000, priority A, no-partial flag", { kind: "customer", value: "Active" }),
  d("lead", "LEAD-TBD-0301", "Omaha North 115 kV substation: power transformer", "sales", "2025-11-03", "Inbound from the EPC's bid package; converted to an opportunity"),
  d("opportunity", "OPP-TBD-0301", "Omaha North phase 1, one 20 MVA unit", "sales", "2025-11-17", "Estimated $1.28M; won 2025-12-19"),
  d("costEstimate", "CE-TBD-0301", "Cost estimate, FIN-TBD-20MVA, Omaha North configuration", "purchasing-finance", "2025-12-01", "Material $612,400, labor $118,900, overhead $147,300, subcontract $70,000; total $948,600", { kind: "costEstimate", value: "Released" }),
  d("quotation", "QT-TBD-0301-V1", "Firm quotation V1", "sales", "2025-12-03", "Superseded after the customer changed the tap range", { kind: "quotation", value: "Superseded" }),
  d("quotation", "QT-TBD-0301-V2", "Firm quotation V2", "sales", "2025-12-12", "1 x FIN-TBD-20MVA at $1,284,000; won", { kind: "quotation", value: "Won" }),
  d("salesOrder", "SO-2026-00301", "ETO sales order, phase 1", "sales", "2026-01-08", "1 x FIN-TBD-20MVA, milestone billing 20/10/20/30/15/5%; shipped 2026-08-11", { kind: "salesOrder", value: "Shipped" }),
  d("engineeringRequest", "ER-TBD-0301", "Design: 20 MVA ONAN/ONAF, 115 kV - 13.8 kV, OLTC 17 positions", "engineering", "2026-01-12", "Released for Production 2026-03-20; closed", { kind: "engineeringRequest", value: "Closed" }),
  d("document", "DOC-TBD-0301-GA", "General arrangement drawing, rev C", "engineering", "2026-02-27", "Customer approved as noted in TR-TBD-0301", { kind: "document", value: "Released" }),
  d("transmittal", "TR-TBD-0301", "Approval drawings to Midland Plains", "engineering", "2026-02-27", "Response: Approved as noted, 2026-03-06"),
  d("ebom", "EBOM-TBD-0301", "EBOM FIN-TBD-20MVA, Omaha North, rev B", "engineering", "2026-03-18", "Rev A superseded by customer tap-range change", { kind: "ebom", value: "Released" }),
  d("mcr", "MCR-TBD-0301", "Create RAW-TBD-OLTC (17-position OLTC)", "materials", "2026-01-20", "Placeholder material from the engineering request; completed and Active"),
  d("material", "RAW-TBD-OLTC", "On-load tap changer, 115 kV class, 17 positions", "materials", "2026-02-02", "Born from MCR-TBD-0301", { kind: "material", value: "Active" }),
  d("llr", "LLR-2026-0004", "Long-lead release: CRGO steel and OLTC", "purchasing-finance", "2026-01-26", "Cap $420,000; risk Medium; approved by Engineering Manager, Purchasing Manager and Controller"),
  d("stp", "STP-000301", "Supplier technical package, OLTC, version 1", "purchasing-finance", "2026-01-27", "Acknowledged by VEN-TBD-0103 on 2026-01-30"),
  d("requisition", "PR-TBD-0301", "Requisition: OLTC and HV bushings", "purchasing-finance", "2026-01-27", "From MRP on the SO peg; converted", { kind: "requisition", value: "Converted" }),
  d("rfq", "RFQ-TBD-0301", "RFQ: OLTC, three vendors, sealed", "purchasing-finance", "2026-01-28", "Technical pass by Engineering before commercial bids opened; awarded to VEN-TBD-0103", { kind: "rfq", value: "Awarded" }),
  d("purchaseOrder", "PO-TBD-0301", "PO to Rheinwerk Tap Changers: 1 x OLTC", "purchasing-finance", "2026-02-10", "$74,500; matched and closed", { kind: "purchaseOrder", value: "Matched/Closed" }),
  d("purchaseOrder", "PO-TBD-0302", "PO to Hanseong Porcelain & Polymer: 9 x HV bushing 145 kV", "purchasing-finance", "2026-02-12", "$170,100 (3 for phase 1, 6 for phase 2); matched and closed", { kind: "purchaseOrder", value: "Matched/Closed" }),
  d("grn", "GRN-TBD-0301", "Goods receipt, HV bushings (INV)", "materials", "2026-05-04", "9 serials SN-TBD-BSH-0301..0309 in batch BAT-TBD-B0301, vendor batch HP-26-0412"),
  d("inspectionLot", "IL-TBD-0301", "Incoming inspection, HV bushings", "quality-trace", "2026-05-05", "Sampled 2 of 9 per plan IP-TBD-INC-BSH rev 2; accepted"),
  d("batch", "BAT-TBD-B0301", "Batch of 9 HV bushings, vendor batch HP-26-0412", "quality-trace", "2026-05-04", "Suspect since 2026-10-02; remaining stock Blocked by recall containment", { kind: "stock", value: "Blocked" }),
  d("productionOrder", "WO-TBD-0301", "Production order, 20 MVA unit SN-TBD-20M-0301", "planning-production", "2026-04-06", "Routing RTG-TBD-20MVA rev B, MBOM rev B; settled, zero WIP", { kind: "productionOrder", value: "Closed (TECO)" }),
  d("mbom", "MBOM-TBD-0301", "MBOM FIN-TBD-20MVA rev B", "engineering", "2026-03-24", "Transformed from EBOM-TBD-0301 rev B", { kind: "mbom", value: "Active" }),
  d("productionVersion", "PV-TBD-0301", "Production version 20 MVA, lot size 1-3", "engineering", "2026-03-25", "MBOM-TBD-0301 + RTG-TBD-20MVA rev B", { kind: "productionVersion", value: "Released" }),
  d("serial", "SN-TBD-20M-0301", "Transformer serial SN-TBD-20M-0301", "quality-trace", "2026-04-06", "Born at WO release; HV bushings SN-TBD-BSH-0301..0303 installed at WC-400 (SP-12)", { kind: "serial", value: "Shipped" }),
  d("inspectionLot", "IL-TBD-0302", "Final test and FTR, SN-TBD-20M-0301", "quality-trace", "2026-07-28", "Routine tests per IEEE C57.12.90 passed; instruments in calibration (SP-14)"),
  d("delivery", "DLV-TBD-0031", "Delivery to Omaha North, over-dimensional", "sales", "2026-08-11", "Split, mandatory: over-dimensional units; PGI #25 posted", { kind: "delivery", value: "Delivered/Closed" }),
  d("pod", "POD-TBD-0031", "Proof of delivery, Omaha North", "sales", "2026-08-14", "Received with no damage; delivery milestone fired once", { kind: "pod", value: "Resolved/Closed" }),
  d("invoiceRequest", "IR-TBD-0031", "Milestone invoice request: delivery (15%)", "sales", "2026-08-14", "$192,600; posted by Finance (ACC)"),
  d("installedBase", "IB-TBD-0301", "Installed base: SN-TBD-20M-0301 at Omaha North", "sales", "2026-08-28", "Commissioned 2026-08-28", { kind: "installedBase", value: "In Service" }),
  d("rma", "RMA-TBD-0012", "RMA: HV bushing oil weep at flange, SN-TBD-BSH-0302", "sales", "2026-09-24", "RC3 warranty; bushing replaced in the field from spares and returned", { kind: "rma", value: "In Inspection" }),
  d("ncr", "NCR-TBD-0044", "NCR: flange seal leak, HV bushing (INV 15.4)", "quality-trace", "2026-10-01", "Root cause suspected in vendor batch HP-26-0412"),
  d("scar", "SCAR-TBD-0009", "SCAR to Hanseong Porcelain & Polymer", "quality-trace", "2026-10-02", "Response due 2026-10-16"),
  d("capa", "CAPA-TBD-0015", "CAPA: bushing flange seal escape", "quality-trace", "2026-10-02", "Containment through recall RCL-2026-001", { kind: "capa", value: "Analysis" }),
  d("recall", "RCL-2026-001", "Recall: HV bushing flange seal, batch BAT-TBD-B0301", "quality-trace", "2026-10-02", "Population v2: 9 bushings, 3 in the field on SN-TBD-20M-0301 (1 already returned), 6 in stock reserved for phase 2", { kind: "recall", value: "Contain" }),
  d("reworkOrder", "RWO-TBD-0012", "Rework: inspect and reseal returned bushing", "planning-production", "2026-10-05", "Origin RMA-TBD-0012; warranty repair, settles with #21", { kind: "reworkOrder", value: "Open" }),
  // ---------------- phase 2: the open order in the FL-09 seed
  d("lead", "LEAD-TBD-0377", "Omaha North phase 2: three more 20 MVA units", "sales", "2026-05-11", "Repeat business after phase 1 design release", undefined, 2),
  d("quotation", "QT-TBD-0377-V1", "Firm quotation, phase 2", "sales", "2026-05-29", "3 x FIN-TBD-20MVA at $1,284,000 (in the FL-09 seed)", { kind: "quotation", value: "Won" }, 2),
  d("salesOrder", "SO-2026-00377", "ETO sales order, phase 2", "sales", "2026-06-12", "3 x FIN-TBD-20MVA, requested 2027-03-15; line 10 In Engineering (in the FL-09 seed)", { kind: "salesOrder", value: "In Fulfillment" }, 2),
  d("engineeringRequest", "ER-TBD-0377", "Design: phase 2, three units from rev B with bushing change", "engineering", "2026-06-15", "Release level Long-Lead Purchase Release (LLR)", { kind: "engineeringRequest", value: "In Design" }, 2),
  d("ebom", "EBOM-TBD-0377", "EBOM FIN-TBD-20MVA, phase 2, rev A", "engineering", "2026-07-02", "Copied from EBOM-TBD-0301 rev B; bushing line under review after the recall", { kind: "ebom", value: "Draft" }, 2),
  d("llr", "LLR-2026-0011", "Long-lead release: CRGO steel and 3 OLTCs, phase 2", "purchasing-finance", "2026-09-30", "Exposure $612,000; above $100k so the Controller joins; waiting in WF-INBOX", undefined, 2),
  d("requisition", "PR-TBD-0377", "Requisition: CRGO steel for three cores", "purchasing-finance", "2026-10-01", "54,000 kg RAW-TBD-CRGO23; approved", { kind: "requisition", value: "Approved" }, 2),
  d("purchaseOrder", "PO-TBD-0377", "PO to Northstar Electrical Steel: CRGO 54,000 kg", "purchasing-finance", "2026-10-05", "$207,900; Purchasing Manager band; waiting in WF-INBOX", { kind: "purchaseOrder", value: "In Approval" }, 2),
  d("plannedOrder", "PLO-TBD-0377", "Planned orders for three 20 MVA units", "planning-production", "2026-10-06", "From MRP run MRP-TBD-1006; pegged to SO-2026-00377 line 10 schedule 10", undefined, 2),
]

const L = (fromType: DocRef["type"], fromId: string, kind: DocLink["kind"], toType: DocRef["type"], toId: string, note?: string): DocLink => ({
  from: { type: fromType, id: fromId }, to: { type: toType, id: toId }, kind, note,
})

export const SPINE_LINKS: DocLink[] = [
  // phase 1
  L("lead", "LEAD-TBD-0301", "converts to", "opportunity", "OPP-TBD-0301"),
  L("opportunity", "OPP-TBD-0301", "converts to", "quotation", "QT-TBD-0301-V1"),
  L("quotation", "QT-TBD-0301-V1", "revises", "quotation", "QT-TBD-0301-V2"),
  L("costEstimate", "CE-TBD-0301", "prices", "quotation", "QT-TBD-0301-V2", "line 10"),
  L("quotation", "QT-TBD-0301-V2", "converts to", "salesOrder", "SO-2026-00301"),
  L("salesOrder", "SO-2026-00301", "triggers", "engineeringRequest", "ER-TBD-0301", "line 10"),
  L("engineeringRequest", "ER-TBD-0301", "delivers", "document", "DOC-TBD-0301-GA"),
  L("document", "DOC-TBD-0301-GA", "delivers", "transmittal", "TR-TBD-0301"),
  L("engineeringRequest", "ER-TBD-0301", "delivers", "ebom", "EBOM-TBD-0301"),
  L("engineeringRequest", "ER-TBD-0301", "creates", "mcr", "MCR-TBD-0301"),
  L("mcr", "MCR-TBD-0301", "creates", "material", "RAW-TBD-OLTC"),
  L("ebom", "EBOM-TBD-0301", "transforms to", "mbom", "MBOM-TBD-0301"),
  L("mbom", "MBOM-TBD-0301", "paired in", "productionVersion", "PV-TBD-0301"),
  L("engineeringRequest", "ER-TBD-0301", "authorises", "llr", "LLR-2026-0004", "release level LLR"),
  L("engineeringRequest", "ER-TBD-0301", "delivers", "stp", "STP-000301"),
  L("salesOrder", "SO-2026-00301", "pegs", "requisition", "PR-TBD-0301", "line 10 schedule 10"),
  L("requisition", "PR-TBD-0301", "sources", "rfq", "RFQ-TBD-0301", "OLTC"),
  L("stp", "STP-000301", "references", "rfq", "RFQ-TBD-0301"),
  L("rfq", "RFQ-TBD-0301", "sources", "purchaseOrder", "PO-TBD-0301"),
  L("llr", "LLR-2026-0004", "authorises", "purchaseOrder", "PO-TBD-0301"),
  L("requisition", "PR-TBD-0301", "sources", "purchaseOrder", "PO-TBD-0302", "HV bushings"),
  L("purchaseOrder", "PO-TBD-0302", "receives", "grn", "GRN-TBD-0301"),
  L("grn", "GRN-TBD-0301", "inspects", "inspectionLot", "IL-TBD-0301"),
  L("grn", "GRN-TBD-0301", "receives", "batch", "BAT-TBD-B0301"),
  L("salesOrder", "SO-2026-00301", "pegs", "productionOrder", "WO-TBD-0301", "line 10 schedule 10"),
  L("productionVersion", "PV-TBD-0301", "paired in", "productionOrder", "WO-TBD-0301"),
  L("batch", "BAT-TBD-B0301", "consumes", "productionOrder", "WO-TBD-0301", "3 bushings at WC-400, SP-12"),
  L("productionOrder", "WO-TBD-0301", "produces", "serial", "SN-TBD-20M-0301"),
  L("productionOrder", "WO-TBD-0301", "inspects", "inspectionLot", "IL-TBD-0302", "final test, SP-14"),
  L("salesOrder", "SO-2026-00301", "fulfils", "delivery", "DLV-TBD-0031"),
  L("serial", "SN-TBD-20M-0301", "fulfils", "delivery", "DLV-TBD-0031", "SP-18"),
  L("delivery", "DLV-TBD-0031", "closes", "pod", "POD-TBD-0031"),
  L("delivery", "DLV-TBD-0031", "bills", "invoiceRequest", "IR-TBD-0031"),
  L("serial", "SN-TBD-20M-0301", "installs", "installedBase", "IB-TBD-0301"),
  L("installedBase", "IB-TBD-0301", "returns", "rma", "RMA-TBD-0012", "bushing SN-TBD-BSH-0302"),
  L("rma", "RMA-TBD-0012", "escalates", "ncr", "NCR-TBD-0044"),
  L("ncr", "NCR-TBD-0044", "escalates", "scar", "SCAR-TBD-0009"),
  L("ncr", "NCR-TBD-0044", "escalates", "capa", "CAPA-TBD-0015"),
  L("capa", "CAPA-TBD-0015", "creates", "recall", "RCL-2026-001"),
  L("recall", "RCL-2026-001", "contains", "batch", "BAT-TBD-B0301"),
  L("recall", "RCL-2026-001", "contains", "serial", "SN-TBD-20M-0301", "3 bushings in the field"),
  L("rma", "RMA-TBD-0012", "reworks", "reworkOrder", "RWO-TBD-0012"),
  // phase 2
  L("salesOrder", "SO-2026-00301", "converts to", "lead", "LEAD-TBD-0377", "repeat business"),
  L("lead", "LEAD-TBD-0377", "converts to", "quotation", "QT-TBD-0377-V1"),
  L("quotation", "QT-TBD-0377-V1", "converts to", "salesOrder", "SO-2026-00377"),
  L("salesOrder", "SO-2026-00377", "triggers", "engineeringRequest", "ER-TBD-0377", "line 10"),
  L("ebom", "EBOM-TBD-0301", "revises", "ebom", "EBOM-TBD-0377", "copied as phase 2 rev A"),
  L("engineeringRequest", "ER-TBD-0377", "delivers", "ebom", "EBOM-TBD-0377"),
  L("engineeringRequest", "ER-TBD-0377", "authorises", "llr", "LLR-2026-0011"),
  L("salesOrder", "SO-2026-00377", "pegs", "plannedOrder", "PLO-TBD-0377", "line 10 schedule 10"),
  L("plannedOrder", "PLO-TBD-0377", "sources", "requisition", "PR-TBD-0377"),
  L("requisition", "PR-TBD-0377", "sources", "purchaseOrder", "PO-TBD-0377"),
  L("llr", "LLR-2026-0011", "authorises", "purchaseOrder", "PO-TBD-0377"),
  L("batch", "BAT-TBD-B0301", "pegs", "salesOrder", "SO-2026-00377", "6 bushings reserved, now Blocked"),
]

export const spineDoc = (r: DocRef) => SPINE_DOCS.find((x) => x.ref.type === r.type && x.ref.id === r.id)
