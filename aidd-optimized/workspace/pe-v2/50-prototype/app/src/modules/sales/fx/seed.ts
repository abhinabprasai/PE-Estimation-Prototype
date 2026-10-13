// Seed for db.fx. Built from the FL-09 and extension seed (called last in extendSeed) so every record
// points at documents that exist. All names and numbers are fictitious.

import { addDays, product, TODAY, type Activity, type DB, type Delivery, type SalesOrder } from "../data/model"
import {
  DEFAULT_MILESTONES, DOC_KEYS, EXPORT_CHECKLIST, PERMIT_ITEMS,
  type BillingPlan, type CustProp, type EtoCost, type FxData, type ImportBatch, type InboundCapture, type KitDef, type Milestone, type QuoteExt, type ShipExt, type TaxProfile, type DePeg, type ChangeOrder, type CreditMemoReq, type Exclusion, type RepairQuote, type PackExt,
} from "./model"

const A = (at: string, by: string, text: string): Activity => ({ at, by, text })
const CANADA = /,\s*(QC|SK|BC|MB|ON|AB)\b/

// ---------------------------------------------------------------------------- lead import
function inboundSeed(db: DB): { inbound: InboundCapture[]; batches: ImportBatch[] } {
  const known = new Set(db.leads.map((l) => l.company.toLowerCase()))
  const mk = (n: number, p: Omit<InboundCapture, "id" | "status" | "issues"> & { status?: InboundCapture["status"]; issues?: string[] }): InboundCapture => {
    const dup = known.has(p.company.toLowerCase())
    const issues = [...(p.issues ?? [])]
    if (dup) issues.push("V-OM-40 company already on a lead or customer")
    return { id: `INB-TBD-${String(n).padStart(4, "0")}`, issues, status: p.status ?? (dup ? "Possible duplicate" : issues.length ? "Needs review" : "New"), ...p }
  }
  const inbound: InboundCapture[] = [
    mk(101, { channel: "Web form", receivedAt: "2026-10-09", company: "Red Cedar Public Power District", contactName: "Alan Whitcomb", contactTitle: "Engineering Manager", email: "awhitcomb@redcedarppd.example", phone: "+1 712 555 0142", subject: "Quote request: 2 x 10 MVA substation transformers", body: "We are replacing two 10 MVA units at the Sioux Center substation. 69 kV primary, 12.47 kV secondary, ONAN/ONAF, DOE 2016 efficiency. Need a budgetary price this month and delivery by Q3 2027.", parsed: { kva: "10000", primaryV: "69 kV", secondaryV: "12.47 kV", standards: "DOE 2016", region: "US Midwest" }, confidence: 0.92 }),
    mk(102, { channel: "Web form", receivedAt: "2026-10-09", company: "Midland Plains Grid Constructors", contactName: "Rosa Delgado", contactTitle: "Procurement Lead", email: "rdelgado@midlandplains.example", phone: "+1 402 555 0188", subject: "Omaha North phase 3", body: "Following phases 1 and 2 we expect a third phase of two more 20 MVA units. Please open a new opportunity.", parsed: { kva: "20000", primaryV: "115 kV", secondaryV: "13.8 kV", region: "US Midwest" }, confidence: 0.88 }),
    mk(103, { channel: "Email", receivedAt: "2026-10-10", company: "Saskatoon Rural Electric Co-op", contactName: "Colette Bouchard", contactTitle: "Operations Director", email: "cbouchard@saskrec.example", phone: "+1 306 555 0173", subject: "FW: pad-mount units for the Warman feeder", body: "Forwarding the tender summary. Looks like 6 pad-mount units, 1500 kVA, 25 kV class. Tender closes November 20. Details are in the attached PDF (not parsed).", parsed: { kva: "1500", primaryV: "25 kV", region: "Canada Prairies" }, confidence: 0.61, issues: ["Secondary voltage not found in the text", "Attachment not parsed"] }),
    mk(104, { channel: "Email", receivedAt: "2026-10-10", company: "", contactName: "Unknown sender", contactTitle: "", email: "orders@bulkparts-mail.example", phone: "", subject: "Cheap transformer oil, bulk offer", body: "Best prices on mineral oil. Click here.", parsed: {}, confidence: 0.12, issues: ["No company found", "No product requirement found"] }),
    mk(105, { channel: "Web form", receivedAt: "2026-10-11", company: "Bluewater Ridge Solar EPC, LLC", contactName: "Jordan Pak", contactTitle: "Project Engineer", email: "jpak@bluewaterridge.example", phone: "+1 608 555 0129", subject: "Collector substation transformer, 34.5 kV", body: "75 MW solar collector substation, need a 60/80/100 MVA, 34.5 kV to 138 kV GSU transformer. Interconnect date August 2028.", parsed: { kva: "100000", primaryV: "34.5 kV", secondaryV: "138 kV", region: "US Midwest" }, confidence: 0.84, issues: ["Rating above the catalogued ETO range (20 MVA): engineering review before qualifying"] }),
    mk(106, { channel: "Trade contact import", receivedAt: "2026-10-06", batchId: "IMP-TBD-0007", company: "Lac Seul Hydro Cooperative", contactName: "Marc Tremblay", contactTitle: "Maintenance Supervisor", email: "mtremblay@lacseul.example", phone: "+1 807 555 0160", subject: "Trade show contact, Utility Expo 2026", body: "Met at the booth. Interested in spares for two 2500 kVA units.", parsed: { kva: "2500", region: "Canada Prairies" }, confidence: 0.7 }),
    mk(107, { channel: "Trade contact import", receivedAt: "2026-10-06", batchId: "IMP-TBD-0007", company: "Ironwood County PUD", contactName: "Devon Hart", contactTitle: "General Manager", email: "dhart@ironwoodpud.example", phone: "+1 906 555 0111", subject: "Trade show contact, Utility Expo 2026", body: "Asked for a call back about a replacement 5 MVA unit.", parsed: { kva: "5000", region: "US Upper Midwest" }, confidence: 0.74 }),
    mk(108, { channel: "Web form", receivedAt: "2026-10-04", company: "Eastgate Utility Services", contactName: "Priya Raman", contactTitle: "Buyer", email: "praman@eastgate.example", phone: "+1 701 555 0150", subject: "Pole-mount 167 kVA, 40 units", body: "Annual stock order for 167 kVA single-phase pole-mount units, 7.2 kV, 120/240 V. 40 units, delivery in January.", parsed: { kva: "167", primaryV: "7.2 kV", secondaryV: "120/240 V", region: "US Upper Midwest" }, confidence: 0.95, status: "Accepted", leadId: "LEAD-TBD-0431", decidedBy: "Dana Whitfield" }),
    mk(109, { channel: "Email", receivedAt: "2026-10-03", company: "Pinecrest Builders", contactName: "Sam Holt", contactTitle: "Owner", email: "sam@pinecrestbuilders.example", phone: "", subject: "Home backup generator question", body: "Do you sell residential generators?", parsed: {}, confidence: 0.2, status: "Rejected", reason: "Outside PE product range", decidedBy: "Dana Whitfield" }),
  ]
  const batches: ImportBatch[] = [
    { id: "IMP-TBD-0007", channel: "Trade contact import", fileName: "utility-expo-2026-contacts.csv", at: "2026-10-06", by: "Dana Whitfield", rows: 14, imported: 12, rejected: 2, errors: [{ row: 5, message: "Email address is not valid (missing @)" }, { row: 11, message: "Company name is empty" }] },
  ]
  return { inbound, batches }
}

// ---------------------------------------------------------------------------- billing plan
export function planFromOrder(o: SalesOrder): BillingPlan {
  const eto = o.type === "ETO"
  if (!eto)
    return { soId: o.id, kind: o.billingPlan.toLowerCase().includes("delivery confirmation") ? "On Delivery Confirmation" : "On Shipment", milestones: [{ id: "M1", label: o.billingPlan.toLowerCase().includes("delivery confirmation") ? "On delivery confirmation" : "On shipment (PGI)", pct: 100, trigger: o.billingPlan.toLowerCase().includes("delivery confirmation") ? "POD received" : "PGI posted", evidence: o.billingPlan.toLowerCase().includes("delivery confirmation") ? "POD" : "BOL", state: o.status === "Invoiced/Closed" ? "Invoiced" : "Planned" }], version: 1, history: [] }
  const ms: Milestone[] = DEFAULT_MILESTONES.map((m, i) => {
    const src = o.milestones?.[i]
    return {
      id: `M${i + 1}`, label: m.label, pct: src?.pct ?? m.pct, trigger: m.trigger, evidence: m.evidence,
      state: src?.state === "Invoice request posted" ? "Invoice request raised" : "Planned", irId: src?.irId, raisedOn: src?.irId ? "2026-" + (i < 2 ? "01" : i < 4 ? "04" : "08") + "-15" : undefined,
    }
  })
  return { soId: o.id, kind: "Milestone", milestones: ms, version: 1, history: [A(o.created, "Sales admin", "Default ETO template applied (20/10/20/30/15/5%)")] }
}
const billingSeed = (db: DB) => Object.fromEntries(db.orders.filter((o) => o.type === "ETO").map((o) => [o.id, planFromOrder(o)]))

// ---------------------------------------------------------------------------- ETO cost (the spine values for CE-TBD-0301 and CE-TBD-0377)
function etoCostSeed(): Record<string, EtoCost> {
  const c301: EtoCost = {
    soId: "SO-2026-00301", ceId: "CE-TBD-0301", units: 1,
    lines: [
      { id: "mat", label: "Material", estimate: 612400, committed: 0, actual: 619800, remaining: 0 },
      { id: "lab", label: "Labor (operations at standard rates)", estimate: 118900, committed: 0, actual: 126300, remaining: 0 },
      { id: "ovh", label: "Overhead", estimate: 147300, committed: 0, actual: 149100, remaining: 0 },
      { id: "sub", label: "Subcontract (testing and galvanizing)", estimate: 70000, committed: 0, actual: 74200, remaining: 0 },
    ],
    llr: [{ id: "LLR-2026-0004", label: "CRGO steel and OLTC", cap: 420000, openPoValue: 0, cancellationFees: 0, risk: "Medium" }],
    baselines: [{ version: 1, at: "2026-01-08", reason: "Order confirmed from QT-TBD-0301-V2 (CE-TBD-0301 released)", estimate: 948600, by: "Estimator" }],
  }
  const c377: EtoCost = {
    soId: "SO-2026-00377", ceId: "CE-TBD-0377", units: 3,
    lines: [
      { id: "mat", label: "Material", estimate: 1845000, committed: 640000, actual: 412600, remaining: 189400 },
      { id: "lab", label: "Labor (operations at standard rates)", estimate: 358200, committed: 0, actual: 96400, remaining: 268900 },
      { id: "ovh", label: "Overhead", estimate: 440500, committed: 0, actual: 118300, remaining: 331500 },
      { id: "sub", label: "Subcontract (testing and galvanizing)", estimate: 204755, committed: 150000, actual: 0, remaining: 62000 },
    ],
    llr: [{ id: "LLR-2026-0011", label: "CRGO steel and 3 OLTCs, phase 2", cap: 650000, openPoValue: 590000, cancellationFees: 22000, risk: "Medium" }],
    baselines: [
      { version: 1, at: "2026-06-12", reason: "Order confirmed from QT-TBD-0377-V1 (CE rev A)", estimate: 2812000, by: "Estimator" },
      { version: 2, at: "2026-08-04", reason: "Re-baseline after the HV bushing supplier change (CE-TBD-0377 released)", estimate: 2848455, by: "Estimator" },
    ],
  }
  return { [c301.soId]: c301, [c377.soId]: c377 }
}

// ---------------------------------------------------------------------------- kits
const KITS: KitDef[] = [
  { id: "KIT-TBD-0001", name: "Commissioning kit, 20 MVA", headerPrice: 9800, pricing: "Header price", bomRev: "Sales BOM rev A", status: "Released", components: [{ item: "SPARE-TBD-GSKT20", qty: 2, price: 1150 }, { item: "SPARE-TBD-OLTCK", qty: 1, price: 6200 }, { item: "TRADE-TBD-ARR", qty: 3, price: 149 }] },
  { id: "KIT-TBD-0002", name: "Recommended spares package, 20 MVA", headerPrice: 31400, pricing: "Component priced", bomRev: "Sales BOM rev B", status: "Released", components: [{ item: "SPARE-TBD-BSH145", qty: 1, price: 26400 }, { item: "SPARE-TBD-GSKT20", qty: 1, price: 1150 }, { item: "SPARE-TBD-OLTCK", qty: 1, price: 6200 }] },
  { id: "KIT-TBD-0003", name: "Pad-mount installation hardware set", headerPrice: 760, pricing: "Header price", bomRev: "Sales BOM rev A", status: "Released", components: [{ item: "TRADE-TBD-ELB", qty: 6, price: 73 }, { item: "TRADE-TBD-FCI", qty: 1, price: 112 }, { item: "TRADE-TBD-ARR", qty: 3, price: 149 }] },
]

// ---------------------------------------------------------------------------- shipments
const isOversize = (db: DB, d: Delivery) => d.refs.some((r) => {
  const l = db.orders.find((o) => o.id === r.soId)?.lines.find((x) => x.no === r.line)
  const p = l ? product(l.item) : undefined
  return !!p && (p.kind === "ETO" || p.huKg >= 14000)
})
const AFTER_PACK = ["Packed", "Quality Cleared", "Loaded", "PGI", "Delivered/Closed"]
const AFTER_PSI = ["Quality Cleared", "Loaded", "PGI", "Delivered/Closed"]
const AFTER_LOAD = ["Loaded", "PGI", "Delivered/Closed"]
export function defaultShip(db: DB, d: Delivery): ShipExt {
  const hus = db.hus.filter((h) => h.deliveryId === d.id).map((h) => h.id).sort()
  const big = isOversize(db, d)
  const eu = CANADA.test(d.shipTo)
  const doc = (state: ShipExt["docs"][keyof ShipExt["docs"]]["state"], at?: string) => ({ state, at, by: state === "Generated" ? "Shipping office" : undefined })
  const gen = d.shipDate ?? TODAY
  const hasBol = AFTER_LOAD.includes(d.status) && !!d.carrier && !!d.pro
  return {
    deliveryId: d.id,
    tender: !d.carrier ? "Not tendered" : AFTER_LOAD.includes(d.status) ? "Accepted" : "Tendered",
    carrierHistory: d.carrier ? [A(addDays(gen, -3), "Shipping office", `Tendered to ${d.carrier}${AFTER_LOAD.includes(d.status) ? "; accepted" : ""}`)] : [],
    permitItems: big ? [...PERMIT_ITEMS] : [],
    loadSeq: hus,
    appointment: d.slot,
    docs: Object.fromEntries(DOC_KEYS.map((k) => {
      if (k === "BOL") return [k, hasBol ? doc("Generated", gen) : doc("Not generated")]
      if (k === "Packing list") return [k, AFTER_PACK.includes(d.status) ? doc("Generated", gen) : d.status === "Picking" ? doc("Draft") : doc("Not generated")]
      if (k === "CoC") return [k, AFTER_PSI.includes(d.status) ? doc("Generated", gen) : doc("Not generated")]
      if (k === "Test reports (FTR)") return [k, AFTER_PSI.includes(d.status) && big ? doc("Generated", gen) : doc("Not generated")]
      return [k, doc("Not generated")]
    })) as ShipExt["docs"],
    psi: AFTER_PSI.includes(d.status) ? { state: "Passed", at: gen, by: "Quality engineer", cocId: `COC-TBD-${d.id.slice(-4)}` } : { state: "Open" },
    export: eu ? EXPORT_CHECKLIST.map((e) => ({ ...e, state: AFTER_LOAD.includes(d.status) ? ("Verified" as const) : ("Not started" as const) })) : null,
    outOfSeq: [],
    scanLog: [],
  }
}
function shipSeed(db: DB): Record<string, ShipExt> {
  const out: Record<string, ShipExt> = {}
  for (const d of db.deliveries) out[d.id] = defaultShip(db, d)
  // one carrier rejection waiting for reassignment, one failed PSI
  const quality = db.deliveries.find((d) => d.status === "Quality Cleared")
  if (quality) {
    // the carrier named on the load plan has already said no; the office must reassign before loading
    quality.carrier ??= "Lakeland Transformer Logistics"
    const s = out[quality.id]
    s.tender = "Rejected"
    s.rejectedReason = "Carrier cannot supply an RGN trailer on the planned date"
    s.carrierHistory.push(A(TODAY, "Shipping office", `${quality.carrier} rejected the tender: carrier cannot supply an RGN trailer on the planned date`))
  }
  const packed = db.deliveries.find((d) => d.status === "Packed")
  if (packed) out[packed.id].psi = { state: "Failed", reason: "Insulation resistance below the acceptance limit; retest booked", at: TODAY, by: "Quality engineer" }
  return out
}

// ---------------------------------------------------------------------------- customer property
const CUSTPROP: CustProp[] = [
  { id: "CP-TBD-0001", soId: "SO-2026-00377", item: "CUSTPROP-TBD-RLY751", description: "Customer-specified protection relay, feeder type", batchOrSerial: "Serials SEL-0911..0916", received: 6, consumed: 3, returned: 0, scrapped: 0, log: [A("2026-09-02", "Receiving clerk", "Received 6 as Customer Property: zero value, never in ATP, never in E&O")] },
  { id: "CP-TBD-0002", soId: "SO-2026-00301", item: "CUSTPROP-TBD-CTTEST", description: "Customer-supplied bushing CT burden test set", batchOrSerial: "Serial BT-7740", received: 1, consumed: 0, returned: 1, scrapped: 0, returnNote: "CPR-TBD-0001", returnDelivery: "DLV-TBD-0031", log: [A("2026-03-02", "Receiving clerk", "Received 1 as Customer Property"), A("2026-08-11", "Shipping office", "Returned on the zero-value delivery DLV-TBD-0031 with property return note CPR-TBD-0001")] },
]

// ---------------------------------------------------------------------------- quotation additions
function quoteExtSeed(db: DB): Record<string, QuoteExt> {
  const out: Record<string, QuoteExt> = {}
  const eto = (id: string, ce: string, costPerUnit: number, price: number, lead: number, ctpDate: string | undefined, extra: Partial<QuoteExt> = {}) => {
    const q = db.quotations.find((x) => x.id === id)
    const line = q?.lines[0]?.no ?? 10
    out[id] = {
      type: "Firm", ceId: ce, costPerUnit: { [line]: costPerUnit }, leadTimeWeeks: { [line]: lead },
      ctp: { [line]: ctpDate ? { state: "Feasible", date: ctpDate, constraint: "Test bay capacity, weeks 47 to 49" } : { state: "Pending" } },
      surcharges: [
        { line, kind: "Copper", index: "COMEX copper $/lb, monthly value", basisDate: "2025-11-30", basis: 4.05, current: 4.28, contentPerUnit: 14200, unit: "lb" },
        { line, kind: "CRGO steel", index: "CRGO basis $/kg, internal published basis", basisDate: "2025-11-30", basis: 3.7, current: 3.85, contentPerUnit: 31000, unit: "kg" },
      ],
      datasheet: { [line]: { "Rating": "20 MVA ONAN / 26.7 MVA ONAF", "Primary / secondary": "115 kV / 13.8 kV", "Vector group": "YNyn0", "Impedance": "9.5 %", "BIL": "550 kV HV / 110 kV LV", "Cooling": "ONAN / ONAF", "Tap range": "±10% OLTC, 17 positions", "Temperature rise": "65 degC", "Efficiency standard": "DOE 2016", "Bushing configuration": "HV 145 kV condenser, LV 15 kV", "Accessories": "Oil level gauge, WTI/OTI, Buchholz, pressure relief" } },
      ...extra,
    }
    void price
  }
  eto("QT-TBD-0301-V2", "CE-TBD-0301", 948600, 1284000, 38, "2026-08-11", { winLoss: { outcome: "Won", notes: "Customer accepted the 17-position tap range at V2.", at: "2025-12-19", by: "Sales rep", competitor: "Two other bidders" } })
  eto("QT-TBD-0301-V1", "CE-TBD-0301", 951400, 1296500, 38, "2026-08-11")
  eto("QT-TBD-0377-V1", "CE-TBD-0377", 949485, 1284000, 42, "2027-03-15", { winLoss: { outcome: "Won", notes: "Repeat build of the phase 1 design with a bushing change.", at: "2026-06-12", by: "Sales rep" } })
  eto("QT-TBD-0417-V1", "CE-TBD-0409", 1010000, 1284000, 44, undefined)
  out["QT-TBD-0402-V1"] = { type: "Firm", costPerUnit: { 10: 189400 }, leadTimeWeeks: { 10: 7 }, ctp: { 10: { state: "Feasible", date: "2026-12-18", constraint: "Test bay capacity, weeks 47 to 49" } }, surcharges: [], winLoss: { outcome: "Won", notes: "Won on delivery date.", at: "2026-10-06", by: "Sales rep" } }
  out["QT-TBD-0423-V1"] = { type: "Budgetary", costPerUnit: { 10: 61200 }, leadTimeWeeks: { 10: 8 }, ctp: { 10: { state: "Band only", constraint: "Budgetary quotes carry a lead-time band without CTP (±25%)" } }, surcharges: [] }
  out["QT-TBD-0391-V1"] = { type: "Firm", costPerUnit: { 10: 32640 }, leadTimeWeeks: { 10: 4 }, ctp: { 10: { state: "Not required" } }, surcharges: [], winLoss: { outcome: "Lost", reason: "Price", notes: "Competitor about 6% lower.", at: "2026-10-03", by: "Sales rep", competitor: "Regional OEM" } }
  out["QT-TBD-0394-V1"] = { type: "Firm", costPerUnit: { 10: 149900 }, leadTimeWeeks: { 10: 12 }, ctp: { 10: { state: "Not required" } }, surcharges: [], winLoss: { outcome: "Lost", reason: "Lead Time", notes: "Customer needed delivery within 6 weeks.", at: "2026-10-05", by: "Sales rep" } }
  return out
}

// ---------------------------------------------------------------------------- tax profile (Book I A §11.3)
function taxSeed(db: DB): Record<string, TaxProfile> {
  const out: Record<string, TaxProfile> = {}
  for (const c of db.customers) {
    const ca = c.currency === "CAD"
    const state = (c.shipTo.match(/,\s*([A-Z]{2})\s+[A-Z0-9]/)?.[1] ?? (ca ? "SK" : "ND"))
    const exempt = c.cls === "Municipal Utility" || c.cls === "Government"
    out[c.id] = {
      registrations: ca ? [{ jurisdiction: `Canada GST/HST`, number: `${100000000 + Number(c.id.slice(-4)) * 37} RT0001`, type: "GST/HST", verified: c.status === "Active" }, ...(state === "QC" ? [{ jurisdiction: "Quebec QST", number: `${1000000000 + Number(c.id.slice(-4)) * 41} TQ0001`, type: "QST" as const, verified: true }] : []), ...(state === "SK" ? [{ jurisdiction: "Saskatchewan PST", number: `${5000000 + Number(c.id.slice(-4)) * 11}`, type: "PST" as const, verified: true }] : [])]
        : [{ jurisdiction: `${state} sales tax`, number: `${state}-ST-${700000 + Number(c.id.slice(-4)) * 13}`, type: "Sales tax permit", verified: c.status === "Active" }],
      defaultTaxCode: ca ? "S1-CA" : "S1",
      certificates: exempt ? [{ id: `EXC-CERT-${c.id.slice(-4)}`, state, status: c.id === "CUS-TBD-0023" ? "Expired" : "Verified", validTo: c.id === "CUS-TBD-0023" ? "2026-06-30" : "2027-12-31", reason: "Government or municipal purchaser" }] : [],
      useTaxAccrual: false,
      addressRole: c.cls === "EPC Contractor" ? "Ship-To" : "Ship-To",
      nexusStates: ca ? ["CA"] : [state],
      note: c.status === "Prospect" ? "Tax profile is completed at activation" : undefined,
    }
  }
  out["CUS-TBD-0035"].addressRole = "Bill-To"
  out["CUS-TBD-0035"].note = "Services invoices determine tax at the Bill-To address; equipment follows the Ship-To (Book I A §11.3)"
  return out
}

// ---------------------------------------------------------------------------- exclusions catalog (config)
const EXCLUSIONS: Exclusion[] = [
  { code: "EXC-SC-01", category: "Site conditions", text: "Lightning or switching surge beyond the unit's BIL rating", active: true, version: 2, effectiveFrom: "2026-03-01", history: [{ version: 1, text: "Lightning surge beyond BIL rating", effectiveFrom: "2025-11-01", changedBy: "Quality Manager", reason: "Initial catalog" }] },
  { code: "EXC-SC-02", category: "Site conditions", text: "Flooding, fire or seismic event at the site", active: true, version: 1, effectiveFrom: "2025-11-01", history: [] },
  { code: "EXC-SC-03", category: "Site conditions", text: "Sustained overload beyond nameplate rating", active: true, version: 1, effectiveFrom: "2025-11-01", history: [] },
  { code: "EXC-IE-01", category: "Installation error", text: "Incorrect tap or connection set at commissioning", active: true, version: 1, effectiveFrom: "2025-11-01", history: [] },
  { code: "EXC-IE-02", category: "Installation error", text: "Oil filled or topped up with an unapproved fluid", active: true, version: 1, effectiveFrom: "2025-11-01", history: [] },
  { code: "EXC-IE-03", category: "Installation error", text: "Bushing or accessory fitted without PE instructions", active: false, version: 2, effectiveFrom: "2026-08-15", history: [{ version: 1, text: "Bushing or accessory fitted without PE instructions", effectiveFrom: "2025-11-01", changedBy: "Quality Manager", reason: "Initial catalog" }] },
]

const DEPEGS: DePeg[] = [
  { id: "DPG-TBD-0001", soId: "SO-2026-00342", line: 10, sched: 10, toSo: "SO-2026-00348", toLine: 10, toSched: 10, stock: "Stock FIN-TBD-5000SS, WH-TBD-01 Fargo, ND", reason: "Customer on SO-2026-00348 is a priority class A utility with an outage window; SO-2026-00342 can wait for production order WO-TBD-0455.", requestedBy: "Sales admin", at: "2026-10-09", state: "Waiting for Sales Director" },
]
const CHANGES: ChangeOrder[] = [
  { id: "SCO-TBD-0001", soId: "SO-2026-00377", line: 10, field: "Requested ship date", oldValue: "2027-02-26", newValue: "2027-03-15", reason: "Customer moved the outage window after the phase 1 commissioning review.", initiator: "Sales admin", at: "2026-08-20", version: 2, valueBefore: 3852000, valueAfter: 3852000, creditRechecked: false, repromised: "2027-03-15", confirmationPdf: "Change Confirmation SCO-TBD-0001.pdf" },
]
const CREDITMEMOS: CreditMemoReq[] = [
  { id: "CMR-TBD-0041", rmaId: "RMA-TBD-0008", amount: 18400, restocking: 2760, state: "Posted", requestedAt: "2026-09-30", requestedBy: "Customer service", releasedBy: "Controller", releasedAt: "2026-10-01", note: "Restock disposition; restocking fee 15% posts to 4910" },
  { id: "CMR-TBD-0042", rmaId: "RMA-TBD-0014", amount: 37665, restocking: 4185, state: "Blocked: credit hold", requestedAt: "2026-09-30", requestedBy: "System", note: "E-RMA-07 Customer is on credit hold: credit requires Controller release" },
]
const REPAIRQUOTES: RepairQuote[] = [
  { id: "RQ-TBD-0001", rmaId: "RMA-TBD-0011", state: "Sent to customer", sentOn: "2026-10-08", validUntil: "2026-11-07", lines: [{ label: "LV winding rewind, 1,000 kVA pad-mount (labor, 120 h)", qty: 1, price: 14200 }, { label: "Materials: copper, insulation, oil top-up", qty: 1, price: 6850 }, { label: "Retest and certification", qty: 1, price: 1900 }, { label: "Return freight, customer cost", qty: 1, price: 1200 }] },
]

function packSeed(db: DB): Record<string, PackExt> {
  const out: Record<string, PackExt> = {}
  for (const d of db.deliveries.filter((x) => ["Picking", "Packed", "Released"].includes(x.status))) {
    const hus = db.hus.filter((h) => h.deliveryId === d.id)
    out[d.id] = {
      deliveryId: d.id,
      creationRule: "Per picklist",
      nodes: hus.map((h) => ({ hu: h.id, type: h.expectedKg > 10000 ? "Heavy skid" : "Pallet", contents: [{ item: "PACK-TBD-DESIC", qty: 2, note: "Desiccant bags" }, { item: "PACK-TBD-CRATE", qty: 1, note: "Accessory crate" }] })),
      photos: [], scaleLog: [],
    }
  }
  return out
}

// ---------------------------------------------------------------------------- delivery creation run demo orders
/** Confirmed orders with allocated schedule lines inside the next two weeks, so the run wizard shows each split
 *  and merge rule: merge across orders, different ship-to, different Incoterms, no-partial hold, equipment and weight. */
function runDemoOrders(db: DB) {
  const mk = (custId: string, shipTo: string | undefined, incoterms: string | undefined, lines: { item: string; qty: number; dayOffset: number; allocated?: boolean }[]) => {
    const c = db.customers.find((x) => x.id === custId)!
    let id = `SO-2026-${String(db.seq.so++).padStart(5, "0")}`
    while (db.orders.some((x) => x.id === id)) id = `SO-2026-${String(db.seq.so++).padStart(5, "0")}`
    const o: SalesOrder = {
      id, customerId: custId, customerPO: `PO-${(db.seq.so * 53) % 9000 + 1000}-${c.id.slice(-2)}`, type: "MTS", directEntry: false, billTo: c.billTo, shipTo: shipTo ?? c.shipTo, requestedShip: addDays(TODAY, 6), incoterms: incoterms ?? c.incoterms,
      freightTerms: (incoterms ?? c.incoterms) === "EXW" ? "Customer-paid" : "PE-paid", billingPlan: "Single invoice at goods issue", currency: c.currency, bookedRate: "1.0000", status: "Confirmed", created: addDays(TODAY, -4),
      lines: lines.map((l, i) => ({
        no: (i + 1) * 10, item: l.item, qty: l.qty, unitPrice: product(l.item).unitPrice, priceSource: "Price list" as const, requestedShip: addDays(TODAY, l.dayOffset), promisedShip: addDays(TODAY, l.dayOffset), warehouse: "WH-TBD-01 Fargo, ND", status: "Open",
        schedules: [{ no: 10, reqQty: l.qty, reqDate: addDays(TODAY, l.dayOffset), confQty: l.allocated === false ? undefined : l.qty, confDate: l.allocated === false ? undefined : addDays(TODAY, l.dayOffset), constraint: l.allocated === false ? undefined : "on-hand stock", deliveredQty: 0, cancelledQty: 0, backorder: l.allocated === false, peg: l.allocated === false ? undefined : `Stock ${l.item}, WH-TBD-01 Fargo, ND`, status: l.allocated === false ? "Open" : "Allocated/Pegged" }],
      })),
      creditChecks: [], activity: [A(addDays(TODAY, -4), "Sales admin", "Order created and confirmed (run-wizard demo order)")],
    }
    db.orders.unshift(o)
    return o
  }
  // merge: same customer, ship-to, Incoterms and date window across two orders
  mk("CUS-TBD-0027", undefined, undefined, [{ item: "FIN-TBD-0167PL", qty: 2, dayOffset: 4 }])
  mk("CUS-TBD-0027", undefined, undefined, [{ item: "FIN-TBD-1000PM", qty: 1, dayOffset: 6 }])
  // mandatory split: same customer, two ship-to sites
  mk("CUS-TBD-0031", undefined, undefined, [{ item: "FIN-TBD-0167PL", qty: 2, dayOffset: 5 }])
  mk("CUS-TBD-0031", "Pole yard, 18 Burdick Expressway East, Minot, ND 58701", undefined, [{ item: "FIN-TBD-0167PL", qty: 1, dayOffset: 5 }])
  // mandatory split: same ship-to, different Incoterms
  mk("CUS-TBD-0035", undefined, "DAP", [{ item: "FIN-TBD-1000PM", qty: 1, dayOffset: 7 }])
  mk("CUS-TBD-0035", undefined, "FCA", [{ item: "FIN-TBD-1000PM", qty: 1, dayOffset: 7 }])
  // no-partial customer: one line allocated, the other still waiting for supply -> held
  mk("CUS-TBD-0048", undefined, undefined, [{ item: "FIN-TBD-2500PM", qty: 1, dayOffset: 3 }, { item: "FIN-TBD-1000PM", qty: 2, dayOffset: 3, allocated: false }])
  // elective splits: date window (3 days vs 12 days), equipment (flatbed unit with van items) and vehicle weight
  mk("CUS-TBD-0041", undefined, undefined, [{ item: "FIN-TBD-2500PM", qty: 3, dayOffset: 2 }, { item: "FIN-TBD-0167PL", qty: 4, dayOffset: 2 }, { item: "FIN-TBD-1000PM", qty: 1, dayOffset: 12 }])
}

export function buildFxSeed(db: DB): FxData {
  runDemoOrders(db)
  const { inbound, batches } = inboundSeed(db)
  return {
    inbound, batches, billing: billingSeed(db), etoCost: etoCostSeed(), kits: structuredClone(KITS), kitLines: [],
    ship: shipSeed(db), runs: [], changes: structuredClone(CHANGES), cancels: [], depegs: structuredClone(DEPEGS), custProp: structuredClone(CUSTPROP),
    soClosure: { "SO-2026-00301": { reconciled: true, at: "2026-08-14", by: "Sales admin" } }, quoteExt: quoteExtSeed(db), tax: taxSeed(db), exclusions: structuredClone(EXCLUSIONS),
    creditMemos: structuredClone(CREDITMEMOS), repairQuotes: structuredClone(REPAIRQUOTES), packExt: packSeed(db), packRule: "Per shipment", priceUplift: 0.035,
    seq: { inbound: 110, batch: 8, sco: 2, cnl: 1, depeg: 2, cp: 3, kit: 4, run: 1, cmr: 43, rq: 2, shp: 1, fee: 1 },
  }
}
