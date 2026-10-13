// inventory-ops seed. Everything is fictitious (GUARDRAILS 7). IDs follow the shared conventions:
// placeholders carry TBD (OQ-30). Dates are relative to TODAY = 2026-10-09.
import type { UserId } from "@/data/domain"
import type { CertDoc, IcPair, InboundReceipt, GrnCheck, InvTask, InventoryOpsState, TieDiff, TaskStep, TaskType } from "./types"
import { TASK_CFG } from "../lib/rules"

const U = {
  recv: "USR-TBD-017" as UserId, // Owen Pelletier, Receiving clerk
  op: "USR-TBD-018" as UserId, // Ngozi Eze, Warehouse operator
  sup: "USR-TBD-019" as UserId, // Carl Halvorsen, Warehouse supervisor
  packer: "USR-TBD-015" as UserId, // Luis Ortega, Packer
  ship: "USR-TBD-014" as UserId, // Kim Yoder, Shipping office
  qm: "USR-TBD-037" as UserId, // Nathan Brooks, Quality Manager
  ctl: "USR-TBD-009" as UserId, // Victor Lindqvist, Controller
  insp: "USR-TBD-034" as UserId, // Chloe Martin, Inspector
}
export const SEED_USERS = U

const st = (...pairs: [string, string][]): TaskStep[] => pairs.map(([label, code]) => ({ label, code }))

let n = 700
function task(type: TaskType, o: Partial<InvTask> & Pick<InvTask, "status" | "docLabel" | "qty" | "uom" | "steps" | "createdAt">): InvTask {
  const cfg = TASK_CFG[type]
  const id = `WT-TBD-0${++n}`
  return {
    id,
    type,
    queue: cfg.queue,
    priority: "Normal",
    scanPoint: cfg.sp,
    scans: [],
    history: [{ at: o.createdAt, by: "System", text: `Task created from ${o.docLabel}` }],
    ...o,
  }
}
const hist = (t: InvTask, ...h: [string, string, string][]) => {
  t.history.push(...h.map(([at, by, text]) => ({ at, by, text })))
  return t
}

function seedTasks(): InvTask[] {
  const t: InvTask[] = []
  // ---- inbound
  t.push(task("Receiving", { status: "Queued", priority: "High", docLabel: "PO-TBD-0311", docRef: { type: "purchaseOrder", id: "PO-TBD-0311" }, itemId: "RAW-TBD-OIL", qty: 20000, uom: "L", to: "Dock D-02", createdAt: "2026-10-09T06:10", steps: st(["PO barcode", "PO-TBD-0311"], ["Item barcode", "RAW-TBD-OIL"]) }))
  t.push(hist(task("Receiving", { status: "Assigned", assigneeId: U.recv, device: "TC77-02", docLabel: "PO-TBD-0310", docRef: { type: "purchaseOrder", id: "PO-TBD-0310" }, itemId: "RAW-TBD-CTC", qty: 9000, uom: "KG", to: "Dock D-01", createdAt: "2026-10-09T07:05", steps: st(["PO barcode", "PO-TBD-0310"], ["Item barcode", "RAW-TBD-CTC"]) }), ["2026-10-09T07:20", "Carl Halvorsen", "Assigned to Owen Pelletier"]))
  t.push(hist(task("Receiving", { status: "In Progress", assigneeId: U.recv, device: "TC77-02", docLabel: "PO-TBD-0312", docRef: { type: "purchaseOrder", id: "PO-TBD-0312" }, itemId: "RAW-TBD-PLATE", qty: 21000, uom: "KG", to: "Dock D-03", createdAt: "2026-10-09T05:40", startedAt: "2026-10-09T08:02", scans: ["PO-TBD-0312"], steps: st(["PO barcode", "PO-TBD-0312"], ["Item barcode", "RAW-TBD-PLATE"]) }), ["2026-10-09T07:50", "Carl Halvorsen", "Assigned to Owen Pelletier"], ["2026-10-09T08:02", "Owen Pelletier", "Started on TC77-02"]))
  t.push(task("Putaway", { status: "Queued", docLabel: "GRN-TBD-0313", docRef: { type: "grn", id: "GRN-TBD-0313" }, itemId: "RAW-TBD-KRAFT", batch: "BAT-TBD-K0929", qty: 9500, uom: "KG", from: "Dock D-01", to: "E-01-04", createdAt: "2026-10-09T06:30", steps: st(["Batch label", "BAT-TBD-K0929"], ["Destination bin", "E-01-04"]) }))
  t.push(hist(task("Putaway", { status: "Assigned", assigneeId: U.op, device: "TC77-05", docLabel: "GRN-TBD-0312", docRef: { type: "grn", id: "GRN-TBD-0312" }, itemId: "RAW-TBD-PLATE", batch: "BAT-TBD-P0912", qty: 21000, uom: "KG", from: "Dock D-03", to: "F-01-02", createdAt: "2026-10-09T07:15", steps: st(["Batch label", "BAT-TBD-P0912"], ["Destination bin", "F-01-02"]) }), ["2026-10-09T07:40", "Carl Halvorsen", "Assigned to Ngozi Eze"]))
  t.push(hist(task("Putaway", { status: "Done/Exception", outcome: "Done", assigneeId: U.op, device: "TC77-05", docLabel: "GRN-TBD-0325", itemId: "RAW-TBD-CTC", batch: "BAT-TBD-C0914", qty: 16000, uom: "KG", from: "Dock D-01", to: "D-07-01", createdAt: "2026-10-08T13:10", startedAt: "2026-10-08T13:42", doneAt: "2026-10-08T13:58", scans: ["BAT-TBD-C0914", "D-07-01"], steps: st(["Batch label", "BAT-TBD-C0914"], ["Destination bin", "D-07-01"]) }), ["2026-10-08T13:42", "Ngozi Eze", "Started"], ["2026-10-08T13:58", "Ngozi Eze", "Done: bin D-07-01 confirmed by scan (SP-04)"]))
  t.push(task("Replenishment", { status: "Queued", priority: "Urgent", docLabel: "Pick bin M-02-03 below minimum", itemId: "CONS-TBD-WELD", qty: 120, uom: "KG", from: "M-01-01", to: "M-02-03", createdAt: "2026-10-09T08:45", steps: st(["Item label", "CONS-TBD-WELD"], ["Pick bin", "M-02-03"]) }))
  t.push(hist(task("Replenishment", { status: "In Progress", assigneeId: U.op, device: "TC77-05", docLabel: "Pick bin D-06-01 below minimum", itemId: "RAW-TBD-FOIL", batch: "BAT-TBD-F0815", qty: 400, uom: "KG", from: "D-04-01", to: "D-06-01", createdAt: "2026-10-09T07:55", startedAt: "2026-10-09T08:30", scans: ["BAT-TBD-F0815"], steps: st(["Batch label", "BAT-TBD-F0815"], ["Pick bin", "D-06-01"]) }), ["2026-10-09T08:30", "Ngozi Eze", "Started on TC77-05"]))
  // ---- outbound
  t.push(task("Pick", { status: "Queued", priority: "High", queue: "Outbound", docLabel: "Picklist PL-TBD-0412 (SO-2026-00377)", itemId: "SPARE-TBD-GSKT20", qty: 2, uom: "EA", from: "S-02-01", createdAt: "2026-10-09T08:10", steps: st(["Bin", "S-02-01"], ["Item", "SPARE-TBD-GSKT20"]) }))
  t.push(hist(task("Pick", { status: "Assigned", assigneeId: U.op, device: "TC77-05", docLabel: "Picklist PL-TBD-0415 (SO-TBD-IC-0022)", itemId: "TRADE-TBD-ARR", qty: 300, uom: "EA", from: "T-01-02", createdAt: "2026-10-09T08:20", steps: st(["Bin", "T-01-02"], ["Item", "TRADE-TBD-ARR"]) }), ["2026-10-09T08:25", "Carl Halvorsen", "Assigned to Ngozi Eze"]))
  const shortPick = task("Pick", { status: "Done/Exception", outcome: "Exception", assigneeId: U.op, device: "TC77-05", docLabel: "Picklist PL-TBD-0409", itemId: "RAW-TBD-BSH015", qty: 18, uom: "EA", from: "B-02-03", createdAt: "2026-10-08T09:00", startedAt: "2026-10-08T09:20", doneAt: "2026-10-08T09:34", scans: ["B-02-03"], steps: st(["Bin", "B-02-03"], ["Item", "RAW-TBD-BSH015"]) })
  shortPick.exception = { reason: "Bin B-02-03 holds 16 of 18; two units missing. Count document line flagged for recount.", at: "2026-10-08T09:34", by: U.op }
  t.push(hist(shortPick, ["2026-10-08T09:20", "Ngozi Eze", "Started"], ["2026-10-08T09:34", "Ngozi Eze", "Exception: bin short, 16 of 18 found"]))
  t.push(task("Stage", { status: "Queued", queue: "Outbound", docLabel: "Picklist PL-TBD-0412 (SO-2026-00377)", qty: 1, uom: "picklist", to: "STG-OUT-02", createdAt: "2026-10-09T08:12", steps: st(["Picklist", "PL-TBD-0412"], ["Staging location", "STG-OUT-02"]) }))
  t.push(hist(task("Pack", { status: "Assigned", assigneeId: U.packer, device: "TC77-09", docLabel: "Pack order PK-TBD-0088", itemId: "SPARE-TBD-OLTCK", qty: 2, uom: "EA", to: "HU-TBD-0088", createdAt: "2026-10-09T07:30", steps: st(["Handling unit", "HU-TBD-0088"], ["Item", "SPARE-TBD-OLTCK"]) }), ["2026-10-09T07:45", "Carl Halvorsen", "Assigned to Luis Ortega"]))
  t.push(hist(task("Pack", { status: "In Progress", assigneeId: U.packer, device: "TC77-09", docLabel: "Pack order PK-TBD-0087", itemId: "SPARE-TBD-GSKT20", qty: 4, uom: "EA", to: "HU-TBD-0087", createdAt: "2026-10-09T07:00", startedAt: "2026-10-09T08:15", scans: ["HU-TBD-0087"], steps: st(["Handling unit", "HU-TBD-0087"], ["Item", "SPARE-TBD-GSKT20"]) }), ["2026-10-09T08:15", "Luis Ortega", "Started"]))
  t.push(hist(task("Load", { status: "Assigned", assigneeId: U.ship, device: "TC77-01", docLabel: "Shipment SHP-TBD-0042 (dock 2)", qty: 2, uom: "HU", to: "Truck dock 2", createdAt: "2026-10-09T09:00", steps: st(["Handling unit at the truck", "HU-TBD-0087"], ["Shipment document", "SHP-TBD-0042"]) }), ["2026-10-09T09:05", "Carl Halvorsen", "Assigned to Kim Yoder"]))
  // ---- internal
  t.push(task("Transfer", { status: "Queued", docLabel: "Transfer TR-TBD-0212, WH-TBD-01 to WH-TBD-03", itemId: "SPARE-TBD-OLTCK", qty: 2, uom: "EA", from: "WH-TBD-01 B-06-02", to: "S-03-01", createdAt: "2026-10-09T08:50", steps: st(["Item", "SPARE-TBD-OLTCK"], ["Receiving bin", "S-03-01"]) }))
  // ---- scrap bin (SP-21): one with an approved disposition, one waiting for approval
  const rmaScrap = task("Transfer", {
    status: "Assigned", assigneeId: U.op, device: "TC77-05", priority: "High", docLabel: "RMA-TBD-0015 disposition: scrap cracked HV bushing", docRef: { type: "rma", id: "RMA-TBD-0015" }, itemId: "RAW-TBD-BSH145", batch: "BAT-TBD-B0301", qty: 1, uom: "EA",
    from: "RMA-01", to: "SCRAP-01", createdAt: "2026-10-09T08:35", scanPoint: "SP-21", steps: st(["Item and batch label", "BAT-TBD-B0301"], ["Scrap location", "SCRAP-01"]),
    scrap: { source: "RMA", srcRef: { type: "rma", id: "RMA-TBD-0015" }, approvedBy: U.qm, approvedReason: "Cracked at the skirt in transit; not repairable (RMA disposition approved)", approvedOn: "2026-10-08", binCode: "SCRAP-01", amount: 18900 },
  })
  t.push(hist(rmaScrap, ["2026-10-09T08:40", "Carl Halvorsen", "Assigned to Ngozi Eze"]))
  t.push(task("Transfer", {
    status: "Queued", docLabel: "WO-2026-00396 scrap: radiator panel damaged at fit-up", docRef: { type: "productionOrder", id: "WO-2026-00396" }, itemId: "RAW-TBD-RAD", qty: 1, uom: "EA", from: "WC-400 line side", to: "SCRAP-01", createdAt: "2026-10-09T09:10", scanPoint: "SP-21",
    steps: st(["Item label", "RAW-TBD-RAD"], ["Scrap location", "SCRAP-01"]),
    scrap: { source: "Production", srcRef: { type: "productionOrder", id: "WO-2026-00396" }, binCode: "SCRAP-01", amount: 2380 },
  }))
  return t
}

// ============================================================================ goods receipts
const cert = (type: CertDoc["type"], docNo: string, cites: string | undefined, attachedOn: string): CertDoc => ({ type, docNo, cites, attachedOn })
function seedInbound(): InboundReceipt[] {
  return [
    {
      id: "RCV-TBD-0401", poId: "PO-TBD-0321", line: 10, qty: 40, dock: "D-01", arrivedOn: "2026-10-09", vendorBatch: "TSB-26-1002", deliveryNote: "TSB-DN-77120",
      certs: [cert("CoC per Shipment", "TSB-COC-5521", undefined, "2026-10-09"), cert("FAI Report", "TSB-FAI-0912", "DWG-TBD-BSH015 rev C", "2026-10-09")],
    },
    { id: "RCV-TBD-0402", poId: "PO-TBD-0310", line: 10, qty: 9000, dock: "D-01", arrivedOn: "2026-10-09", vendorBatch: "KCC-26-0930", deliveryNote: "KCC-DN-33410", certs: [cert("CoC per Shipment", "KCC-COC-2210", undefined, "2026-10-09")] },
    { id: "RCV-TBD-0403", poId: "PO-TBD-0312", line: 10, qty: 21000, dock: "D-03", arrivedOn: "2026-10-09", vendorBatch: "PPF-H-5512", deliveryNote: "PPF-DN-90871", certs: [cert("Mill Cert per Heat", "PPF-MC-5521", "PPF-H-5521", "2026-10-09")] },
  ]
}
function seedChecks(): GrnCheck[] {
  return [
    { grnId: "GRN-TBD-0301", vendorBatch: "HP-26-0412", certs: [cert("CoC per Shipment", "HPP-COC-0412", undefined, "2026-05-04"), cert("FAI Report", "HPP-FAI-0412", "DWG-TBD-BSH145 rev A", "2026-05-04")], accepted: { by: U.insp, on: "2026-05-05", note: "Accepted with IL-TBD-0301" } },
    { grnId: "GRN-TBD-0300", certs: [cert("CoC per Shipment", "RTC-COC-0098", undefined, "2026-04-21"), cert("FAI Report", "RTC-FAI-0098", "DWG-TBD-OLTC-ARR rev B", "2026-04-21"), cert("CoA", "RTC-COA-0098", undefined, "2026-04-21")], accepted: { by: U.insp, on: "2026-04-22" } },
    { grnId: "GRN-TBD-1006", vendorBatch: "NS-H-88214", certs: [cert("Mill Cert per Heat", "NS-MC-88214", "NS-H-88214", "2026-10-06")] },
    { grnId: "GRN-TBD-0312", certs: [cert("Mill Cert per Heat", "PPF-MC-5101", undefined, "2026-09-08")], accepted: { by: U.insp, on: "2026-09-09" } },
  ]
}

// ============================================================================ period close
const tieDiffs = (): TieDiff[] => [
  { key: "LE-TBD-10|2026-09", valuationClass: "VC-3000", amount: 4380, cause: "Packaging backflush at HU close (#27) posted to 1310 instead of 1360: the event-key row for packaging resolved to the raw-material class." },
  { key: "LE-TBD-10|2026-09", valuationClass: "VC-3060", amount: -4380, cause: "Same cause: 1360 is short by what 1310 carries." },
]

// ============================================================================ intercompany
function seedIc(): IcPair[] {
  const LE = { gc: "LE-TBD-20", tf: "LE-TBD-10", pg: "LE-TBD-30" } as const
  const p = (o: Partial<IcPair> & Pick<IcPair, "id" | "month" | "itemId" | "qty" | "sellerAr" | "buyerAp">): IcPair => ({ sellerEntityId: LE.gc, buyerEntityId: LE.tf, sellerCurrency: "USD", buyerCurrency: "USD", ...o })
  return [
    p({ id: "ICP-TBD-0016", month: "2026-09", itemId: "TRADE-TBD-ELB", qty: 12, sellerAr: 0, buyerAp: 0, rolledBack: { message: "Transfer price list PL-PRC-TBD-IC26 has no row for this item valid on 2026-09-30; pairing rolled back, neither document exists (IF-14, MSG-TBD-10077)", incident: "INC-TBD-0043" } }),
    p({ id: "ICP-TBD-0018", month: "2026-09", itemId: "TRADE-TBD-ARR", qty: 200, sellerSo: "SO-TBD-IC-0018", buyerPo: "PO-TBD-0291", sellerSoStatus: "Invoiced/Closed", buyerPoStatus: "Matched/Closed", sellerAr: 19712, buyerAp: 19712 }),
    p({ id: "ICP-TBD-0019", month: "2026-09", itemId: "TRADE-TBD-FCI", qty: 400, sellerSo: "SO-TBD-IC-0019", buyerPo: "PO-TBD-0292", sellerSoStatus: "Invoiced/Closed", buyerPoStatus: "Confirmed", sellerAr: 28672, buyerAp: 28672, note: "Seller shipped and invoiced on 2026-09-26; the buyer has not posted the goods receipt, so the goods still sit in transit (1350)." }),
    p({ id: "ICP-TBD-0020", month: "2026-09", itemId: "TRADE-TBD-ARR", qty: 150, sellerSo: "SO-TBD-IC-0020", buyerPo: "PO-TBD-0293", sellerSoStatus: "Invoiced/Closed", buyerPoStatus: "Matched/Closed", sellerAr: 14784, buyerAp: 15225, explained: { by: U.ctl, at: "2026-10-05T10:20", reason: "Buyer PO keyed at the superseded transfer price list (101.50 instead of 98.56). Controller approved the deviation on both sides; the seller issues a credit of 441.00 in October." } }),
    p({ id: "ICP-TBD-0021", month: "2026-09", itemId: "TRADE-TBD-FCI", qty: 250, buyerEntityId: LE.pg, sellerSo: "SO-TBD-IC-0021", buyerPo: "PO-TBD-0294", sellerSoStatus: "Invoiced/Closed", buyerPoStatus: "Matched/Closed", sellerAr: 17920, buyerAp: 24371.2, buyerCurrency: "CAD", fxToUsd: 0.738, note: "Booked at 1.3600 CAD per USD; closing rate 0.7380 USD per CAD. The difference posts to 7100 at settlement." }),
    p({ id: "ICP-TBD-0022", month: "2026-10", itemId: "TRADE-TBD-ARR", qty: 300, sellerSo: "SO-TBD-IC-0022", buyerPo: "PO-TBD-0322", sellerSoStatus: "Confirmed", buyerPoStatus: "Confirmed", sellerAr: 29568, buyerAp: 29568 }),
    p({ id: "ICP-TBD-0023", month: "2026-10", itemId: "TRADE-TBD-FCI", qty: 500, sellerSo: "SO-TBD-IC-0023", buyerPo: "PO-TBD-0323", sellerSoStatus: "Draft", buyerPoStatus: "Draft", sellerAr: 35840, buyerAp: 39500, note: "Buyer PO price 79.00 is above the transfer price 71.68 (+10.2%): a deviation from the transfer price list needs the Controller on both sides." }),
  ]
}

export function seedInventoryOps(): InventoryOpsState {
  n = 700
  return {
    seq: 100,
    tasks: seedTasks(),
    inbound: seedInbound(),
    grnChecks: seedChecks(),
    signoffs: [],
    closeRuns: [],
    tieDiffs: tieDiffs(),
    topUps: [],
    reserve: { "LE-TBD-10|2026-09": 41000, "LE-TBD-10|2026-10": 41000 },
    icPairs: seedIc(),
    icRecon: [{ month: "2026-08", at: "2026-09-03T09:00", by: U.ctl }],
    countPlans: [],
  }
}
