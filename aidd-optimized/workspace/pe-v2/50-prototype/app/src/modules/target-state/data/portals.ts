// Supplier and Customer Portals (Book IX §4). External skins over the same services, authorization engine and
// validations as the internal screens: every write below is validated by the rule the internal screen applies,
// every record is scoped to the signed-in partner, and a portal write can never reach a state an internal screen
// could not create (e.g. an acknowledgement that changes price or date is a deviation request, not an overwrite).
// PO and sales-order statuses use S-35 and S-3 verbatim. Ids marked TBD follow the placeholder convention (OQ-30).

export interface PortalUser { id: string; name: string; email: string; kind: "supplier" | "customer"; partnerId: string; mfa: "Enrolled" | "Pending"; status: "Active" | "Invited" | "Locked" }
export interface PortalInvite { id: string; email: string; kind: "supplier" | "customer"; partnerId: string; sentOn: string; expiresOn: string; state: "Sent" | "Accepted" | "Expired" }

export interface SupLine { no: number; materialId: string; desc: string; qty: number; uom: string; price: number; schedules: { date: string; qty: number }[]; stp: { id: string; version: number }; ack?: { qty: number; date: string; price: number; stpAccepted: boolean; at: string; by: string }; deviationId?: string }
export interface SupPo { id: string; vendorId: string; status: "Sent" | "Confirmed" | "Partially Received" | "Received"; sentOn: string; drawing: { name: string; checksum: string; size: string }; lines: SupLine[] }
export interface Deviation { id: string; vendorId: string; poId: string; lineNo: number; stpChar: string; type: "Alternate" | "Concession"; proposal: string; qty: number; attachment?: string; createdOn: string; routedTo: string[]; by: string }
export interface Asn { id: string; vendorId: string; poId: string; shipDate: string; carrier: string; tracking: string; lines: { poLine: number; schedule: string; qty: number; batch: string; cert: string }[]; packages: { id: string; type: string; lines: number[] }[]; createdOn: string }
export interface VInvoice { id: string; vendorId: string; poId: string; amount: number; date: string; match: "Matched" | "Held: price variance" | "Held: quantity variance" | "Awaiting receipt" | "Rejected: duplicate number"; reason: string; paid: boolean; remits: { date: string; amount: number; ref: string }[] }
export interface Scorecard { vendorId: string; onTime: number; quality: number; trend: { m: string; onTime: number; quality: number }[] }
export const D8 = ["D1 Team", "D2 Problem description", "D3 Containment", "D4 Root cause", "D5 Corrective action", "D6 Implementation", "D7 Prevent recurrence", "D8 Close and recognise"] as const
export interface Scar { id: string; vendorId: string; title: string; due: string; state: "Open" | "Response submitted" | "Overdue"; d8: Record<string, string>; submittedOn?: string }

export interface CusLine { no: number; materialId: string; desc: string; qty: number; schedules: { date: string; qty: number; promise: string; state: "On track" | "At risk" | "Shipped" }[] }
export interface CusOrder { id: string; customerId: string; status: string; project: string; eto: boolean; milestone: number; atRisk?: string; lines: CusLine[] }
export const ETO_MILESTONES = ["Order confirmed", "Design", "Drawing approval", "Materials", "Production", "Final test", "Shipment", "Delivery"]
export interface Pin { n: number; x: number; y: number; text: string }
export interface Transmittal { id: string; soId: string; customerId: string; sentOn: string; dueOn: string; docs: { id: string; rev: string; title: string; checksum: string }[]; pins: Pin[]; response?: { decision: "Approved" | "Approved as noted" | "Revise and resubmit"; at: string; by: string } }
export interface CusShipment { id: string; deliveryId: string; soId: string; customerId: string; status: string; carrier: string; pro: string; hus: string[]; pod: "Expected" | "Received" | "Exception" | "Resolved/Closed"; signedBy?: string; signedAt?: string; dossier: { name: string; kind: "Packing list" | "CoC" | "FTR"; checksum: string }[] }
export interface ReturnReq { id: string; customerId: string; serial: string; reason: string; description: string; contact: string; createdOn: string; status: "Draft" }
export const SHIPPED_SERIALS: { serial: string; item: string; customerId: string; shipped: string }[] = [
  { serial: "SN-TBD-20M-0301", item: "FIN-TBD-20MVA 20 MVA substation transformer", customerId: "CUS-TBD-0048", shipped: "2026-08-11" },
  { serial: "SN-TBD-BSH-0302", item: "RAW-TBD-BSH145 HV bushing, on SN-TBD-20M-0301", customerId: "CUS-TBD-0048", shipped: "2026-08-11" },
  { serial: "SN-TBD-0167-1021", item: "FIN-TBD-0167PL pole-mount 167 kVA", customerId: "CUS-TBD-0027", shipped: "2026-09-18" },
  { serial: "SN-TBD-0167-1022", item: "FIN-TBD-0167PL pole-mount 167 kVA", customerId: "CUS-TBD-0027", shipped: "2026-09-18" },
]
export const RETURN_REASONS = ["Defect on arrival", "Failed in service", "Damaged in transit", "Wrong item shipped", "Other (describe)"]

export interface PortalState {
  scope: { supplier: string; customer: string }
  users: PortalUser[]
  invites: PortalInvite[]
  signedIn: { supplier?: string; customer?: string }
  pos: SupPo[]
  deviations: Deviation[]
  asns: Asn[]
  invoices: VInvoice[]
  scorecards: Scorecard[]
  scars: Scar[]
  orders: CusOrder[]
  transmittals: Transmittal[]
  shipments: CusShipment[]
  returns: ReturnReq[]
  seq: number
}

export function seedPortals(): PortalState {
  const users: PortalUser[] = [
    { id: "PU-TBD-0001", name: "Elena Marsh", email: "elena.marsh@northstar-steel.example", kind: "supplier", partnerId: "VEN-TBD-0101", mfa: "Enrolled", status: "Active" },
    { id: "PU-TBD-0002", name: "Jonas Keller", email: "jonas.keller@rheinwerk-tc.example", kind: "supplier", partnerId: "VEN-TBD-0103", mfa: "Enrolled", status: "Active" },
    { id: "PU-TBD-0003", name: "Seo-yeon Park", email: "sy.park@hanseong.example", kind: "supplier", partnerId: "VEN-TBD-0104", mfa: "Enrolled", status: "Active" },
    { id: "PU-TBD-0004", name: "Calvin Reed", email: "creed@midlandplains.example", kind: "customer", partnerId: "CUS-TBD-0048", mfa: "Enrolled", status: "Active" },
    { id: "PU-TBD-0005", name: "Tess Lindgren", email: "tlindgren@lakeshorelw.example", kind: "customer", partnerId: "CUS-TBD-0027", mfa: "Enrolled", status: "Active" },
    { id: "PU-TBD-0006", name: "Omar Haddad", email: "ohaddad@prairieridge.example", kind: "customer", partnerId: "CUS-TBD-0031", mfa: "Pending", status: "Invited" },
    { id: "PU-TBD-0007", name: "Rita Voss", email: "rvoss@keystone-cu.example", kind: "supplier", partnerId: "VEN-TBD-0102", mfa: "Enrolled", status: "Locked" },
  ]
  const invites: PortalInvite[] = [
    { id: "INV-TBD-0101", email: "ohaddad@prairieridge.example", kind: "customer", partnerId: "CUS-TBD-0031", sentOn: "2026-10-07", expiresOn: "2026-10-21", state: "Sent" },
    { id: "INV-TBD-0102", email: "ops@saguaro-gasket.example", kind: "supplier", partnerId: "VEN-TBD-0111", sentOn: "2026-09-10", expiresOn: "2026-09-24", state: "Expired" },
    { id: "INV-TBD-0103", email: "sy.park@hanseong.example", kind: "supplier", partnerId: "VEN-TBD-0104", sentOn: "2026-08-20", expiresOn: "2026-09-03", state: "Accepted" },
  ]
  const pkg = (n: string) => ({ name: `Drawing package ${n}.zip`, checksum: "sha256:" + n.replace(/\W/g, "").toLowerCase().padEnd(8, "a").slice(0, 8) + "9c41e07b2d", size: "4.2 MB" })
  const ln = (no: number, materialId: string, desc: string, qty: number, uom: string, price: number, schedules: SupLine["schedules"], stp: SupLine["stp"], extra: Partial<SupLine> = {}): SupLine => ({ no, materialId, desc, qty, uom, price, schedules, stp, ...extra })
  const pos: SupPo[] = [
    { id: "PO-TBD-0412", vendorId: "VEN-TBD-0101", status: "Sent", sentOn: "2026-10-06", drawing: pkg("STP-000377 v1"), lines: [ln(10, "RAW-TBD-CRGO23", "CRGO electrical steel coil, 0.23 mm, grade M-OH", 41000, "KG", 3.85, [{ date: "2026-11-12", qty: 41000 }], { id: "STP-000377", version: 1 }), ln(20, "RAW-TBD-CRGO23", "CRGO electrical steel coil, 0.23 mm, grade M-OH", 13000, "KG", 3.85, [{ date: "2026-12-10", qty: 13000 }], { id: "STP-000377", version: 1 })] },
    { id: "PO-TBD-0371", vendorId: "VEN-TBD-0101", status: "Confirmed", sentOn: "2026-09-22", drawing: pkg("STP-000361 v2"), lines: [ln(10, "RAW-TBD-CRGO23", "CRGO electrical steel coil, 0.23 mm, grade M-OH", 41000, "KG", 3.85, [{ date: "2026-10-22", qty: 20000 }, { date: "2026-11-05", qty: 21000 }], { id: "STP-000361", version: 2 }, { ack: { qty: 41000, date: "2026-10-22", price: 3.85, stpAccepted: true, at: "2026-09-24", by: "Elena Marsh" } })] },
    { id: "PO-TBD-0415", vendorId: "VEN-TBD-0103", status: "Sent", sentOn: "2026-10-07", drawing: pkg("STP-000378 v2"), lines: [ln(10, "RAW-TBD-OLTC", "On-load tap changer, 115 kV class, 17 positions", 3, "EA", 74500, [{ date: "2027-01-18", qty: 1 }, { date: "2027-02-15", qty: 1 }, { date: "2027-03-15", qty: 1 }], { id: "STP-000378", version: 2 })] },
    { id: "PO-TBD-0420", vendorId: "VEN-TBD-0104", status: "Partially Received", sentOn: "2026-08-14", drawing: pkg("STP-000302 v1"), lines: [ln(10, "RAW-TBD-BSH145", "HV condenser bushing, 145 kV, 800 A", 6, "EA", 18900, [{ date: "2026-10-12", qty: 3 }, { date: "2026-10-26", qty: 3 }], { id: "STP-000302", version: 1 }, { ack: { qty: 6, date: "2026-10-12", price: 18900, stpAccepted: true, at: "2026-08-17", by: "Seo-yeon Park" } })] },
    { id: "PO-TBD-0388", vendorId: "VEN-TBD-0102", status: "Sent", sentOn: "2026-10-06", drawing: pkg("STP-000366 v1"), lines: [ln(10, "RAW-TBD-CTC", "Continuously transposed copper conductor, epoxy bonded", 9000, "KG", 13.4, [{ date: "2026-11-02", qty: 9000 }], { id: "STP-000366", version: 1 })] },
    { id: "PO-TBD-0360", vendorId: "VEN-TBD-0106", status: "Confirmed", sentOn: "2026-09-18", drawing: pkg("STP-000360 v1"), lines: [ln(10, "RAW-TBD-PLATE", "Tank steel plate, A572 Gr. 50, 12 mm", 6000, "KG", 1.35, [{ date: "2026-10-20", qty: 6000 }], { id: "STP-000360", version: 1 }, { ack: { qty: 6000, date: "2026-10-20", price: 1.35, stpAccepted: true, at: "2026-09-19", by: "Prairie contact" } })] },
  ]
  const invoices: VInvoice[] = [
    { id: "NS-88121", vendorId: "VEN-TBD-0101", poId: "PO-TBD-0371", amount: 157850, date: "2026-10-08", match: "Matched", reason: "Quantity, price and receipt agree with the order. Scheduled for the next payment run.", paid: false, remits: [] },
    { id: "NS-88070", vendorId: "VEN-TBD-0101", poId: "PO-TBD-0344", amount: 317600, date: "2026-09-16", match: "Held: price variance", reason: "You invoiced $3.97 per kg; the order price is $3.85 per kg. The difference is $9,600 on 80,000 kg. Send a corrected invoice or contact your buyer.", paid: false, remits: [] },
    { id: "NS-87955", vendorId: "VEN-TBD-0101", poId: "PO-TBD-0310", amount: 129500, date: "2026-08-28", match: "Matched", reason: "Matched and paid.", paid: true, remits: [{ date: "2026-09-30", amount: 129500, ref: "REM-TBD-2209" }] },
    { id: "NS-88121-B", vendorId: "VEN-TBD-0101", poId: "PO-TBD-0371", amount: 157850, date: "2026-10-08", match: "Rejected: duplicate number", reason: "Invoice number NS-88121 was already received from you on 2026-10-08. Send a new number if this is a different invoice.", paid: false, remits: [] },
    { id: "RW-20417", vendorId: "VEN-TBD-0103", poId: "PO-TBD-0301", amount: 74500, date: "2026-03-12", match: "Matched", reason: "Matched and paid.", paid: true, remits: [{ date: "2026-04-15", amount: 74500, ref: "REM-TBD-1804" }] },
    { id: "RW-20533", vendorId: "VEN-TBD-0103", poId: "PO-TBD-0415", amount: 74500, date: "2026-10-05", match: "Awaiting receipt", reason: "No goods receipt is recorded yet for this order. Payment waits for the receipt.", paid: false, remits: [] },
    { id: "HS-5521", vendorId: "VEN-TBD-0104", poId: "PO-TBD-0420", amount: 56700, date: "2026-10-02", match: "Held: quantity variance", reason: "You invoiced 3 bushings; 2 were received and accepted, 1 is held at incoming inspection.", paid: false, remits: [] },
  ]
  const trend = (a: number[], q: number[]) => ["May", "Jun", "Jul", "Aug", "Sep", "Oct"].map((m, i) => ({ m, onTime: a[i], quality: q[i] }))
  const scorecards: Scorecard[] = [
    { vendorId: "VEN-TBD-0101", onTime: 96, quality: 99, trend: trend([94, 95, 97, 96, 96, 96], [99, 99, 98, 99, 99, 99]) },
    { vendorId: "VEN-TBD-0102", onTime: 94, quality: 98, trend: trend([92, 93, 95, 94, 94, 94], [98, 98, 97, 98, 98, 98]) },
    { vendorId: "VEN-TBD-0103", onTime: 91, quality: 100, trend: trend([88, 90, 91, 92, 91, 91], [100, 100, 100, 100, 100, 100]) },
    { vendorId: "VEN-TBD-0104", onTime: 82, quality: 91, trend: trend([88, 86, 85, 84, 83, 82], [97, 96, 94, 93, 92, 91]) },
    { vendorId: "VEN-TBD-0106", onTime: 97, quality: 99, trend: trend([96, 97, 97, 98, 97, 97], [99, 99, 99, 99, 99, 99]) },
  ]
  const scars: Scar[] = [
    { id: "SCAR-TBD-0009", vendorId: "VEN-TBD-0104", title: "HV bushing flange seal leak, vendor batch HP-26-0412 (NCR-TBD-0044)", due: "2026-10-16", state: "Open", d8: {} },
    { id: "SCAR-TBD-0007", vendorId: "VEN-TBD-0104", title: "Porcelain chip on shed, lot HP-26-0233", due: "2026-09-25", state: "Overdue", d8: { "D1 Team": "Quality lead, process engineer" } },
    { id: "SCAR-TBD-0003", vendorId: "VEN-TBD-0101", title: "Coil edge burr above limit, lot NS-26-1188", due: "2026-07-30", state: "Response submitted", d8: Object.fromEntries(D8.map((d) => [d, "Provided and accepted"])), submittedOn: "2026-07-22" },
  ]
  const cl = (no: number, materialId: string, desc: string, qty: number, schedules: CusLine["schedules"]): CusLine => ({ no, materialId, desc, qty, schedules })
  const orders: CusOrder[] = [
    { id: "SO-2026-00377", customerId: "CUS-TBD-0048", status: "In Fulfillment", project: "Omaha North phase 2, three 20 MVA units", eto: true, milestone: 2, atRisk: "The HV bushing design is under review after a supplier recall. The first unit date of Mar 15, 2027 holds if drawing approval arrives by Oct 30.", lines: [cl(10, "FIN-TBD-20MVA", "Substation power transformer, 20 MVA, 115 kV - 13.8 kV (ETO)", 3, [{ date: "2027-03-15", qty: 1, promise: "2027-03-15", state: "At risk" }, { date: "2027-04-12", qty: 1, promise: "2027-04-12", state: "On track" }, { date: "2027-05-10", qty: 1, promise: "2027-05-10", state: "On track" }])] },
    { id: "SO-2026-00301", customerId: "CUS-TBD-0048", status: "Shipped", project: "Omaha North phase 1, one 20 MVA unit", eto: true, milestone: 7, lines: [cl(10, "FIN-TBD-20MVA", "Substation power transformer, 20 MVA, 115 kV - 13.8 kV (ETO)", 1, [{ date: "2026-08-11", qty: 1, promise: "2026-08-11", state: "Shipped" }])] },
    { id: "SO-2026-00355", customerId: "CUS-TBD-0031", status: "Confirmed", project: "Minot feeder upgrade", eto: false, milestone: 0, lines: [cl(10, "FIN-TBD-2500PM", "Three-phase pad-mount transformer, 2,500 kVA", 2, [{ date: "2026-10-30", qty: 2, promise: "2026-10-30", state: "On track" }])] },
    { id: "SO-2026-00362", customerId: "CUS-TBD-0027", status: "Partially Shipped", project: "Lake Shore pole replacement", eto: false, milestone: 0, atRisk: "Four units are shipped. The remaining four wait for stock at the plant; the date moved from Oct 12 to Oct 22.", lines: [cl(20, "FIN-TBD-0167PL", "Single-phase pole-mount transformer, 167 kVA", 8, [{ date: "2026-09-18", qty: 4, promise: "2026-09-18", state: "Shipped" }, { date: "2026-10-12", qty: 4, promise: "2026-10-22", state: "At risk" }])] },
    { id: "SO-2026-00340", customerId: "CUS-TBD-0041", status: "Submitted", project: "Mill switchyard unit", eto: false, milestone: 0, lines: [cl(10, "FIN-TBD-5000SS", "Secondary unit substation transformer, 5 MVA", 1, [{ date: "2026-11-20", qty: 1, promise: "2026-11-20", state: "On track" }])] },
    { id: "SO-2026-00348", customerId: "CUS-TBD-0017", status: "In Fulfillment", project: "Duluth job 2291", eto: false, milestone: 0, lines: [cl(30, "FIN-TBD-1000PM", "Three-phase pad-mount transformer, 1,000 kVA", 2, [{ date: "2026-10-13", qty: 2, promise: "2026-10-13", state: "On track" }])] },
  ]
  const tr = (id: string, soId: string, customerId: string, sentOn: string, dueOn: string, docs: Transmittal["docs"], extra: Partial<Transmittal> = {}): Transmittal => ({ id, soId, customerId, sentOn, dueOn, docs, pins: [], ...extra })
  const transmittals: Transmittal[] = [
    tr("TR-TBD-0377", "SO-2026-00377", "CUS-TBD-0048", "2026-10-06", "2026-10-20", [{ id: "DOC-TBD-0377-GA", rev: "A", title: "General arrangement, phase 2", checksum: "sha256:77a1c90e" }, { id: "DOC-TBD-0377-OD", rev: "A", title: "Outline and nameplate drawing", checksum: "sha256:51be3d02" }]),
    tr("TR-TBD-0301", "SO-2026-00301", "CUS-TBD-0048", "2026-02-27", "2026-03-13", [{ id: "DOC-TBD-0301-GA", rev: "C", title: "General arrangement drawing", checksum: "sha256:0c44f8a9" }], { pins: [{ n: 1, x: 62, y: 38, text: "Move the cooling fan guard 50 mm toward the HV side" }], response: { decision: "Approved as noted", at: "2026-03-06", by: "Calvin Reed" } }),
    tr("TR-TBD-0355", "SO-2026-00355", "CUS-TBD-0031", "2026-10-02", "2026-10-16", [{ id: "DOC-TBD-0355-GA", rev: "A", title: "Pad-mount outline, 2,500 kVA", checksum: "sha256:be9120d3" }]),
    tr("TR-TBD-0340", "SO-2026-00340", "CUS-TBD-0041", "2026-09-20", "2026-10-04", [{ id: "DOC-TBD-0340-GA", rev: "B", title: "Unit substation outline", checksum: "sha256:2f18a6c7" }], { pins: [{ n: 1, x: 30, y: 55, text: "Cable entry must be bottom, not side" }], response: { decision: "Revise and resubmit", at: "2026-10-01", by: "Granite Peak contact" } }),
  ]
  const shipments: CusShipment[] = [
    { id: "SHP-TBD-0031", deliveryId: "DLV-TBD-0031", soId: "SO-2026-00301", customerId: "CUS-TBD-0048", status: "Delivered/Closed", carrier: "Great Plains Heavy Haul", pro: "PRO 7731-4421", hus: ["HU-TBD-0301-1", "HU-TBD-0301-2"], pod: "Resolved/Closed", signedBy: "Calvin Reed", signedAt: "2026-08-14", dossier: [{ name: "Packing list DLV-TBD-0031", kind: "Packing list", checksum: "sha256:a19f02c1" }, { name: "Certificate of conformance SN-TBD-20M-0301", kind: "CoC", checksum: "sha256:4de770b2" }, { name: "Final test report IL-TBD-0302", kind: "FTR", checksum: "sha256:90c3a18e" }] },
    { id: "SHP-TBD-0044", deliveryId: "DLV-TBD-0044", soId: "SO-2026-00355", customerId: "CUS-TBD-0031", status: "Loaded", carrier: "Prairie Express LTL", pro: "PRO 2210-9981", hus: ["HU-TBD-0501", "HU-TBD-0502"], pod: "Expected", dossier: [{ name: "Packing list DLV-TBD-0044", kind: "Packing list", checksum: "sha256:61d2b7aa" }] },
    { id: "SHP-TBD-0046", deliveryId: "DLV-TBD-0046", soId: "SO-2026-00362", customerId: "CUS-TBD-0027", status: "PGI", carrier: "Prairie Express LTL", pro: "PRO 2210-9987", hus: ["HU-TBD-0511"], pod: "Expected", dossier: [{ name: "Packing list DLV-TBD-0046", kind: "Packing list", checksum: "sha256:e07c4415" }, { name: "Certificate of conformance, 4 units", kind: "CoC", checksum: "sha256:1b6ad3f0" }] },
    { id: "SHP-TBD-0047", deliveryId: "DLV-TBD-0047", soId: "SO-2026-00362", customerId: "CUS-TBD-0027", status: "Delivered/Closed", carrier: "Prairie Express LTL", pro: "PRO 2198-3302", hus: ["HU-TBD-0490"], pod: "Exception", dossier: [{ name: "Packing list DLV-TBD-0047", kind: "Packing list", checksum: "sha256:83fa5b19" }] },
  ]
  return { scope: { supplier: "VEN-TBD-0101", customer: "CUS-TBD-0048" }, users, invites, signedIn: {}, pos, deviations: [], asns: [], invoices, scorecards, scars, orders, transmittals, shipments, returns: [], seq: 31 }
}
