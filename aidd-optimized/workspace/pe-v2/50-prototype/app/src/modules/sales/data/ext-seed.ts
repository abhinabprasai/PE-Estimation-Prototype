// Seed for the sales and service screens beyond FL-09, plus the full records of the hero spine
// documents the sales group owns (src/data/shared/spine.ts): CUS-TBD-0048, LEAD-TBD-0301,
// OPP-TBD-0301, QT-TBD-0301-V1/V2, SO-2026-00301, DLV-TBD-0031, POD-TBD-0031, IR-TBD-0031,
// IB-TBD-0301, RMA-TBD-0012, LEAD-TBD-0377. Same IDs, statuses and dates as the spine headers.
// Every name, number and identifier is fictitious (GUARDRAILS 7). Formats other than the
// specification's are placeholders carrying "TBD" (OQ-30).

import { MATERIALS } from "@/data/shared/materials"
import type { InstalledBaseStatus, RmaStatus, WarrantyClaimBadge } from "@/data/domain"
import { addDays, product, type Activity, type DB, type Quotation, type SalesOrder, type Schedule, type SOLine } from "./model"
import type { AsBuiltLine, CustExt, DesignEntry, Ib, Lead, LeadSource, LeadStage, Requirement, Rma, RmaClass, RmaLine, RmaReason, SupplyOption } from "./ext-model"
import { freightDefault, restockDefault } from "./ext-model"
import { buildFxSeed } from "../fx/seed"

const A = (at: string, by: string, text: string): Activity => ({ at, by, text })
const WH = "WH-TBD-01 Fargo, ND"
const WH2 = "WH-TBD-02 Regina, SK"
export const QUARANTINE = "WH-TBD-01 Fargo, ND · Quarantine zone Q1"

/** Per-customer reservation buffers (contractual customer buffers) [DOC:p.43 Book I A §10.3: Customer +
 *  Item + Warehouse + Reserved Buffer Qty + Valid From/To, for utility frame agreements]. Fictitious rows. */
export const CUSTOMER_BUFFERS: { customerId: string; item: string; warehouse: string; qty: number; validFrom: string; validTo: string; agreement: string }[] = [
  { customerId: "CUS-TBD-0031", item: "FIN-TBD-5000SS", warehouse: WH, qty: 1, validFrom: "2026-01-01", validTo: "2026-12-31", agreement: "Frame agreement FA-TBD-0031" },
]
/** Valuation rate at original issue: standard cost, or 74% of the price where no standard exists (ETO). Design value. */
export const valuationOf = (item: string, price: number) => product(item).stdCost ?? Math.round(price * 0.74)

// ============================================================================ design library (p.249 Build Note)
export const DESIGNS: DesignEntry[] = [
  { ref: "EBOM-TBD-0301", label: "EBOM FIN-TBD-20MVA rev B (Omaha North)", req: { kva: "20000", primaryV: "115 kV", secondaryV: "13.8 kV", phases: "3", frequency: "60 Hz", vectorGroup: "Dyn1", cooling: "ONAN/ONAF", impedancePct: "9.5", tap: "OLTC ±10%, 17 positions", standards: "IEEE C57.12.00" } },
  { ref: "EBOM-TBD-0188", label: "EBOM 10 MVA 69 kV substation unit rev C", req: { kva: "10000", primaryV: "69 kV", secondaryV: "12.47 kV", phases: "3", frequency: "60 Hz", vectorGroup: "Dyn1", cooling: "ONAN", impedancePct: "7.5", tap: "OLTC ±10%, 33 positions", standards: "IEEE C57.12.00" } },
  { ref: "EBOM-TBD-0244", label: "EBOM 25 MVA 138 kV substation unit rev A", req: { kva: "25000", primaryV: "138 kV", secondaryV: "13.8 kV", phases: "3", frequency: "60 Hz", vectorGroup: "Dyn1", cooling: "ONAN/ONAF/ONAF", impedancePct: "10.0", tap: "OLTC ±10%, 17 positions", standards: "CSA C88" } },
  { ref: "EBOM-TBD-0212", label: "EBOM FIN-TBD-5000SS unit substation rev B", req: { kva: "5000", primaryV: "34.5 kV", secondaryV: "4.16 kV", phases: "3", frequency: "60 Hz", vectorGroup: "Dyn1", cooling: "ONAN", impedancePct: "6.5", tap: "DETC ±2 x 2.5%", standards: "IEEE C57.12.00" } },
  { ref: "EBOM-TBD-0276", label: "EBOM FIN-TBD-7500MTO stainless pad-mount rev A", req: { kva: "7500", primaryV: "24.94 kV", secondaryV: "600Y/347 V", phases: "3", frequency: "60 Hz", vectorGroup: "Dyn1", cooling: "ONAN", impedancePct: "5.75", tap: "DETC ±2 x 2.5%", standards: "CSA C2.2" } },
]
/** Design behind each FIN item (installed base surfaces in the prior build search through this). */
export const DESIGN_OF_ITEM: Record<string, string> = { "FIN-TBD-20MVA": "EBOM-TBD-0301", "FIN-TBD-5000SS": "EBOM-TBD-0212", "FIN-TBD-7500MTO": "EBOM-TBD-0276" }

const HERO_REQ: Requirement = DESIGNS[0].req

// ============================================================================ leads (Book VI §4.1)
type LeadRow = [id: string, title: string, company: string, customerId: string | undefined, source: LeadSource, owner: string, region: string, stage: LeadStage, created: string, stageSince: string, value: number, currency: "USD" | "CAD", quotes: string[], req: Requirement, extra?: Partial<Lead>]
const LEADS: LeadRow[] = [
  ["LEAD-TBD-0301", "Omaha North 115 kV substation: power transformer", "Midland Plains Grid Constructors", "CUS-TBD-0048", "Direct", "USR-TBD-001", "US Midwest", "Won", "2025-11-03", "2025-12-19", 1284000, "USD", ["QT-TBD-0301-V1", "QT-TBD-0301-V2"], HERO_REQ, { oppId: "OPP-TBD-0301", competitor: "Northfield Power Equipment", priorBuild: { ref: "EBOM-TBD-0188", score: 50, decision: "New Design" }, awardDate: "2025-12-19" }],
  ["LEAD-TBD-0377", "Omaha North phase 2: three more 20 MVA units", "Midland Plains Grid Constructors", "CUS-TBD-0048", "Referral", "USR-TBD-001", "US Midwest", "Won", "2026-05-11", "2026-06-10", 3852000, "USD", ["QT-TBD-0377-V1"], HERO_REQ, { priorBuild: { ref: "EBOM-TBD-0301", score: 100, decision: "Repeat Build" }, awardDate: "2026-06-10" }],
  ["LEAD-TBD-0402", "Manitowoc north substation stainless pad-mount", "Lakeshore Municipal Light & Water", "CUS-TBD-0027", "Website", "USR-TBD-001", "US Upper Midwest", "Won", "2026-08-20", "2026-10-02", 243700, "USD", ["QT-TBD-0402-V1"], DESIGNS[4].req, { priorBuild: { ref: "EBOM-TBD-0276", score: 100, decision: "Repeat Build" } }],
  ["LEAD-TBD-0417", "Prince Albert east 20 MVA replacement unit", "Northern Saskatchewan Municipal Power and Light Utility Commission, Prince Albert Regional Distribution District", "CUS-TBD-0052", "Trade Show", "USR-TBD-001", "Canada Prairies", "Quoting", "2026-09-01", "2026-09-28", 1746240, "CAD", ["QT-TBD-0417-V1"], { ...HERO_REQ, primaryV: "138 kV", standards: "CSA C88" }, { priorBuild: { ref: "EBOM-TBD-0301", score: 71, decision: "Variant of Existing" }, competitor: "Prairie Electric Works" }],
  ["LEAD-TBD-0420", "Alma distribution station refurbishment", "Coopérative d'électricité du Lac-Saint-Jean", "CUS-TBD-0044", "Agent", "USR-TBD-001", "Canada Quebec", "Quoting", "2026-09-04", "2026-09-22", 310000, "CAD", ["QT-TBD-0420-V1", "QT-TBD-0420-V2"], DESIGNS[3].req, { priorBuild: { ref: "EBOM-TBD-0212", score: 86, decision: "Variant of Existing" } }],
  ["LEAD-TBD-0423", "Bluewater Ridge 80 MW solar collector pad-mounts", "Bluewater Ridge Solar EPC, LLC", "CUS-TBD-0060", "Website", "USR-TBD-001", "US Upper Midwest", "Quoting", "2026-09-18", "2026-10-01", 313600, "USD", ["QT-TBD-0423-V1"], { kva: "2500", primaryV: "34.5 kV", secondaryV: "630 V", phases: "3", frequency: "60 Hz", cooling: "ONAN", standards: "IEEE C57.12.34" }],
  ["LEAD-TBD-0431", "Wenatchee service center spare unit", "Cascade Valley Public Utility District", "CUS-TBD-0023", "Referral", "USR-TBD-001", "US Pacific Northwest", "Qualified", "2026-09-10", "2026-09-30", 186300, "USD", [], DESIGNS[3].req, { oppId: "OPP-TBD-0431" }],
  ["LEAD-TBD-0433", "Delta Port expansion 25 MVA unit", "Fraser Delta Power Contractors Ltd.", "CUS-TBD-0035", "Trade Show", "USR-TBD-001", "Canada Pacific", "Qualified", "2026-09-15", "2026-10-03", 2380000, "CAD", [], DESIGNS[2].req, { oppId: "OPP-TBD-0433", competitor: "Pacific Coil Industries" }],
  ["LEAD-TBD-0436", "Butte mill switchyard 10 MVA", "Granite Peak Mining Operations", "CUS-TBD-0041", "Direct", "USR-TBD-001", "US Mountain", "Qualified", "2026-09-24", "2026-10-06", 742000, "USD", [], DESIGNS[1].req, { oppId: "OPP-TBD-0436" }],
  ["LEAD-TBD-0438", "Duluth harbor crane feeder transformers", "O'Hara-Bell Electrical Contractors, Inc.", "CUS-TBD-0017", "Agent", "USR-TBD-001", "US Upper Midwest", "Open", "2026-10-01", "2026-10-01", 167400, "USD", [], { kva: "1000", primaryV: "13.2 kV", secondaryV: "480Y/277 V" }],
  ["LEAD-TBD-0440", "Rural feeder upgrade, pole-mount program", "Heartland Valley Electric Membership Corp.", undefined, "Trade Show", "USR-TBD-001", "US Midwest", "Open", "2026-10-03", "2026-10-03", 418800, "USD", [], { kva: "167", primaryV: "7.2 kV", secondaryV: "120/240 V", phases: "1" }, { email: "procurement@heartlandvalley-emc.example", contactName: "Rosa Lindgren", contactTitle: "Procurement lead" }],
  ["LEAD-TBD-0441", "Data center campus 34.5 kV step-down", "Northgate Data Campus Holdings", undefined, "Website", "USR-TBD-001", "US Midwest", "Open", "2026-10-06", "2026-10-06", 1490000, "USD", [], { kva: "20000", primaryV: "34.5 kV" }, { email: "", contactName: "" }],
  ["LEAD-TBD-0442", "Winnipeg industrial park substation", "Red River Industrial Utilities Ltd.", undefined, "Other", "USR-TBD-001", "Canada Prairies", "Open", "2026-10-08", "2026-10-08", 905000, "CAD", [], {}, { email: "tenders@redriver-iu.example", contactName: "Martin Ouellette", contactTitle: "Tender manager" }],
  ["LEAD-TBD-0391", "Wenatchee feeder pad-mounts", "Cascade Valley Public Utility District", "CUS-TBD-0023", "Direct", "USR-TBD-001", "US Pacific Northwest", "Lost", "2026-07-20", "2026-09-15", 125550, "USD", ["QT-TBD-0391-V1"], { kva: "1000", primaryV: "13.2 kV", secondaryV: "208Y/120 V" }],
  ["LEAD-TBD-0394", "Butte concentrator unit substation", "Granite Peak Mining Operations", "CUS-TBD-0041", "Referral", "USR-TBD-001", "US Mountain", "Lost", "2026-07-28", "2026-09-22", 186300, "USD", ["QT-TBD-0394-V1"], DESIGNS[3].req],
  ["LEAD-TBD-0396", "Gary foundry backup transformer", "Ironworks Mill Industrial Park Ltd.", "CUS-TBD-0038", "Direct", "USR-TBD-001", "US Midwest", "Disqualified", "2026-08-02", "2026-08-19", 78400, "USD", [], { kva: "2500" }, { disqualifyReason: "No budget or funding" }],
  ["LEAD-TBD-0399", "Hettinger co-op storm stock", "Tri-County Rural Electric Association", "CUS-TBD-0011", "Other", "USR-TBD-001", "US Upper Midwest", "Disqualified", "2026-08-11", "2026-08-25", 34900, "USD", [], { kva: "167", phases: "1" }, { disqualifyReason: "Duplicate of an existing lead" }],
]

function buildLeads(db: DB): Lead[] {
  return LEADS.map(([id, title, company, customerId, source, ownerId, region, stage, created, stageSince, estValue, currency, quotationIds, req, extra]) => {
    const c = customerId ? db.customers.find((x) => x.id === customerId) : undefined
    const qualified = !["Open"].includes(stage)
    const l: Lead = {
      id, title, source, ownerId, region, company, customerId,
      contactName: "Purchasing desk", contactTitle: "Buyer", email: customerId ? `purchasing@${customerId.toLowerCase()}.example` : "", phone: "+1 555 0100",
      address: c?.billTo ?? "Not recorded",
      req, estValue, currency, awardDate: addDays(stageSince, 60), competitor: "", winProb: { Open: 10, Qualified: 25, Quoting: 50, Won: 100, Lost: 0, Disqualified: 0 }[stage],
      stage, stageSince, created,
      checklist: { "Budget or funding confirmed": qualified, "Decision maker identified": qualified, "Required on-site date known": qualified || id === "LEAD-TBD-0438", "Technical requirement captured": qualified || Object.keys(req).length >= 3 },
      quotationIds,
      activity: [A(created, "Sales rep", `Lead created from ${source}`)],
      ...extra,
    }
    if (qualified && stage !== "Disqualified") l.activity.push(A(addDays(created, 7), "Sales rep", `Qualification checklist complete. Stage Open → Qualified${l.oppId ? `; opportunity ${l.oppId}` : ""}`))
    if (quotationIds.length) l.activity.push(A(addDays(created, 14), "Sales rep", `Quotation ${quotationIds[0]} created from the lead. Stage Qualified → Quoting (automatic)`))
    if (stage === "Won") l.activity.push(A(stageSince, "System", "Win recorded on the linked quotation. Stage Quoting → Won"))
    if (stage === "Lost") l.activity.push(A(stageSince, "System", "Loss recorded on the linked quotation. Stage Quoting → Lost"))
    if (stage === "Disqualified") l.activity.push(A(stageSince, "Sales rep", `Disqualified: ${l.disqualifyReason}`))
    return l
  })
}

// ============================================================================ customer master extension
const CONTACTS: Record<string, [string, string][]> = {
  "CUS-TBD-0048": [["Ruth Vandermolen", "Project manager, Omaha North"], ["Arjun Mehta", "Electrical lead engineer"], ["Colleen Price", "Accounts payable"]],
  "CUS-TBD-0031": [["Dale Kowalczyk", "Materials supervisor"], ["Erin Bauer", "System engineer"]],
  "CUS-TBD-0044": [["Mathieu Tremblay", "Responsable approvisionnement"]],
  "CUS-TBD-0027": [["Priya Raman", "Utility engineer"], ["Glen Hoffmann", "Purchasing agent"]],
}
function buildCustExt(db: DB): Record<string, CustExt> {
  const out: Record<string, CustExt> = {}
  for (const c of db.customers) {
    const named = CONTACTS[c.id] ?? [["Purchasing desk", "Buyer"]]
    out[c.id] = {
      segment: ["Investor-Owned Utility", "Municipal Utility", "Co-op"].includes(c.cls) ? "Transmission and distribution" : c.cls === "EPC Contractor" ? "Projects" : c.cls === "Distributor" ? "Channel" : "Industrial",
      ownerId: c.priority === "A" ? "USR-TBD-001" : "USR-TBD-002",
      addresses: [
        ...(c.billTo !== "Not recorded" ? [{ kind: "Bill-To" as const, isDefault: true, site: "Head office", text: c.billTo }] : []),
        ...(c.shipTo !== "Not recorded" ? [{ kind: "Ship-To" as const, isDefault: true, site: c.shipTo.split(",")[0], text: c.shipTo, crane: c.id === "CUS-TBD-0048", maxVehicle: c.id === "CUS-TBD-0048" ? "Multi-axle hydraulic trailer, 180 t" : "53 ft flatbed" }] : []),
      ],
      contacts: named.map(([name, title], i) => ({ name, title, roles: i === 0 ? ["Purchasing", "Receiving"] : title.toLowerCase().includes("payable") ? ["AP"] : ["Engineering"], email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${c.id.toLowerCase()}.example`, phone: `+1 555 01${String(i + 10)}`, primary: i === 0 })),
      priceList: c.status === "Prospect" ? undefined : c.currency === "CAD" ? "PL-PRC-TBD-CA26" : "PL-PRC-TBD-US26",
      paymentTerms: c.id === "CUS-TBD-0048" ? "Milestone per contract, Net 45" : "Net 30",
      freightTerms: c.incoterms === "EXW" ? "Customer pays" : "PE pays, prepaid and add",
      invoiceDelivery: c.cls === "Distributor" ? "Portal" : "Email PDF",
      consolidation: c.id === "CUS-TBD-0048" ? "Per order" : "Per shipment",
      ratingRef: c.status === "Prospect" ? undefined : `D&B ${String(Number(c.id.slice(-4)) * 7919).padStart(9, "0")}`,
      lastReview: c.status === "Prospect" ? undefined : "2026-06-30",
      reviewer: c.status === "Prospect" ? undefined : "USR-TBD-008",
      taxExempt: c.cls === "Municipal Utility" || c.cls === "Government",
      nexus: [c.currency === "CAD" ? "CA" : "US"],
      exemptFromAutoHold: c.cls === "Municipal Utility" || c.cls === "Government",
      documents: c.id === "CUS-TBD-0048" ? ["Frame agreement MPGC-FA-2025.pdf", "W-9 request 2025.pdf"] : [],
      activity: [A("2026-01-05", "Sales admin", "Record migrated from the legacy customer list")],
    }
  }
  return out
}

// ============================================================================ hero spine: phase 1 sales documents
function heroOrder(): SalesOrder {
  const sched: Schedule = { no: 10, reqQty: 1, reqDate: "2026-08-10", confQty: 1, confDate: "2026-08-11", constraint: "engineering release and test bay capacity (CTP)", snapshot: "PLN-SNAP-TBD-0112", deliveredQty: 1, cancelledQty: 0, backorder: false, peg: "WO-TBD-0301", status: "Delivered", deliveryId: "DLV-TBD-0031" }
  const line: SOLine = { no: 10, item: "FIN-TBD-20MVA", qty: 1, unitPrice: 1284000, priceSource: "Quotation", requestedShip: "2026-08-10", promisedShip: "2026-08-11", warehouse: WH, status: "Shipped", schedules: [sched] }
  return {
    id: "SO-2026-00301", customerId: "CUS-TBD-0048", customerPO: "MPGC-ON115-T1", quoteRef: "QT-TBD-0301-V2", type: "ETO", directEntry: false,
    billTo: "1200 Commerce Street, Omaha, NE 68102", shipTo: "Omaha North 115 kV substation, 16500 Fort Street, Omaha, NE 68116", requestedShip: "2026-08-10",
    incoterms: "DAP", freightTerms: "PE-paid", carrier: "Heartland Heavy Haul", billingPlan: "Milestone billing 20/10/20/30/15/5% (ACC)", currency: "USD", bookedRate: "1.0000",
    status: "Shipped", created: "2026-01-08", lines: [line],
    creditChecks: [{ at: "2026-01-08", when: "at quote-to-order conversion", exposure: 655000, orderValue: 1284000, limit: 5000000, pastDue30: false, passLimit: true, passPastDue: true }],
    milestones: [
      { pct: 20, label: "Milestone 1", state: "Invoice request posted", irId: "IR-TBD-0027" },
      { pct: 10, label: "Milestone 2", state: "Invoice request posted", irId: "IR-TBD-0028" },
      { pct: 20, label: "Milestone 3", state: "Invoice request posted", irId: "IR-TBD-0029" },
      { pct: 30, label: "Milestone 4", state: "Invoice request posted", irId: "IR-TBD-0030" },
      { pct: 15, label: "Delivery", state: "Invoice request posted", irId: "IR-TBD-0031" },
      { pct: 5, label: "Milestone 6", state: "Open" },
    ],
    activity: [
      A("2026-01-08", "Sales admin", "Created in Draft from QT-TBD-0301-V2: lines, prices (frozen) and configuration copied. Credit check at conversion: passed"),
      A("2026-01-09", "Sales admin", "Submitted. Credit check passed: Confirmed"),
      A("2026-01-12", "System", "Line 10 is ETO: engineering request ER-TBD-0301 opened (In Engineering)"),
      A("2026-04-06", "System", "Production order WO-TBD-0301 released and pegged to line 10 schedule 10 (In Production)"),
      A("2026-08-11", "Shipping office", "PGI-TBD-0031 posted on DLV-TBD-0031 (#25, #26). Order Shipped"),
      A("2026-08-14", "Shipping office", "POD-TBD-0031 recorded; Delivery milestone fired once; IR-TBD-0031 (15%) handed to Finance"),
    ],
  }
}

function heroQuotes(): Quotation[] {
  const base = { customerId: "CUS-TBD-0048", leadId: "LEAD-TBD-0301", config: HERO_REQ as Record<string, string>, priorBuildRef: "EBOM-TBD-0188" }
  return [
    { ...base, id: "QT-TBD-0301-V2", version: 2, status: "Won", validUntil: "2026-01-11", lines: [{ no: 10, item: "FIN-TBD-20MVA", qty: 1, price: 1284000 }], predecessor: "QT-TBD-0301-V1", orderRef: "SO-2026-00301",
      activity: [A("2025-12-12", "Sales rep", "Revised from QT-TBD-0301-V1: customer changed the tap range to 17 positions"), A("2025-12-12", "Estimator", "Priced from CE-TBD-0301 (released)"), A("2025-12-15", "Sales rep", "Issued to customer"), A("2025-12-19", "Sales rep", "Win recorded. Status Issued → Won"), A("2026-01-08", "Sales admin", "Converted to SO-2026-00301. Quotation locked with order cross-reference")] },
    { ...base, id: "QT-TBD-0301-V1", version: 1, status: "Superseded", validUntil: "2026-01-02", lines: [{ no: 10, item: "FIN-TBD-20MVA", qty: 1, price: 1296500 }], successor: "QT-TBD-0301-V2",
      activity: [A("2025-12-03", "Sales rep", "Quotation QT-TBD-0301-V1 created from LEAD-TBD-0301 (opportunity OPP-TBD-0301); attributes carried forward"), A("2025-12-05", "Sales rep", "Issued to customer"), A("2025-12-12", "Sales rep", "Revised to QT-TBD-0301-V2. Status Issued → Superseded")] },
  ]
}

// ============================================================================ backorders (Book IV §2.2)
function mkOrder(seq: number, db: DB, custId: string, status: string, created: string, item: string, schedules: Schedule[], extra: Partial<SalesOrder> = {}): SalesOrder {
  const c = db.customers.find((x) => x.id === custId)!
  const price = c.currency === "CAD" ? Math.round(product(item).unitPrice * 1.36) : product(item).unitPrice
  const qty = schedules.reduce((s, x) => s + x.reqQty, 0)
  return {
    id: `SO-2026-${String(seq).padStart(5, "0")}`, customerId: custId, customerPO: `PO-${(seq * 37) % 9000 + 1000}-${c.id.slice(-2)}`, type: "MTS", directEntry: false,
    billTo: c.billTo, shipTo: c.shipTo, requestedShip: schedules[0].reqDate, incoterms: c.incoterms, freightTerms: c.incoterms === "EXW" ? "Customer-paid" : "PE-paid",
    billingPlan: "Single invoice at goods issue", currency: c.currency, bookedRate: c.currency === "CAD" ? "1.3600 CAD per USD" : "1.0000", status, created,
    lines: [{ no: 10, item, qty, unitPrice: price, priceSource: "Price list", requestedShip: schedules[0].reqDate, promisedShip: schedules.map((s) => s.confDate).filter(Boolean).sort().at(-1), warehouse: c.currency === "CAD" ? WH2 : WH, status: "Open", schedules }],
    creditChecks: [{ at: created, when: "at SO submit", exposure: c.exposure, orderValue: qty * price, limit: c.creditLimit, pastDue30: c.pastDue30, passLimit: true, passPastDue: !c.pastDue30 }],
    activity: [A(created, "Sales admin", "Order created"), A(addDays(created, 1), "Sales admin", "Submitted. Credit check passed: Confirmed")],
    ...extra,
  }
}
const S = (no: number, reqQty: number, reqDate: string, status: string, x: Partial<Schedule> = {}): Schedule => ({ no, reqQty, reqDate, deliveredQty: 0, cancelledQty: 0, backorder: false, status, ...x })
const SNAP = "PLN-SNAP-TBD-1006"

function backorderOrders(db: DB): SalesOrder[] {
  const o = [
    mkOrder(341, db, "CUS-TBD-0027", "Confirmed", "2026-09-14", "FIN-TBD-2500PM", [S(10, 3, "2026-10-05", "Open", { backorder: true })], { activity: [A("2026-09-14", "Sales admin", "Order created"), A("2026-09-15", "Sales admin", "Submitted. Credit check passed: Confirmed"), A("2026-09-15", "Sales admin", "ATP line 10: 0 of 3 available. Backorder: schedule 10 Open, Backorder flag on")] }),
    mkOrder(342, db, "CUS-TBD-0031", "Confirmed", "2026-09-21", "FIN-TBD-5000SS", [S(10, 1, "2026-10-14", "Allocated/Pegged", { confQty: 1, confDate: "2026-10-27", constraint: "on-hand stock", snapshot: SNAP, peg: `Stock FIN-TBD-5000SS, ${WH}` }), S(20, 1, "2026-10-14", "Open", { backorder: true })]),
    mkOrder(343, db, "CUS-TBD-0041", "Confirmed", "2026-09-02", "FIN-TBD-1000PM", [S(10, 4, "2026-10-12", "Confirmed", { confQty: 4, confDate: "2026-11-06", constraint: "incoming stock from production order", snapshot: SNAP, backorder: true, peg: "WO-TBD-0458" })]),
    mkOrder(344, db, "CUS-TBD-0035", "Confirmed", "2026-09-29", "FIN-TBD-2500PM", [S(10, 2, "2026-10-20", "Open", { backorder: true })]),
    mkOrder(345, db, "CUS-TBD-0017", "In Fulfillment", "2026-09-25", "FIN-TBD-0167PL", [S(10, 18, "2026-10-15", "Allocated/Pegged", { confQty: 18, confDate: "2026-10-23", constraint: "on-hand stock", snapshot: SNAP, peg: `Stock FIN-TBD-0167PL, ${WH}` }), S(20, 12, "2026-10-15", "Open", { backorder: true })]),
    mkOrder(346, db, "CUS-TBD-0009", "Confirmed", "2026-09-30", "FIN-TBD-2500PM", [S(10, 2, "2026-11-03", "Allocated/Pegged", { confQty: 2, confDate: "2026-11-03", constraint: "on-hand stock", snapshot: SNAP, peg: `Stock FIN-TBD-2500PM, ${WH}` })]),
    mkOrder(347, db, "CUS-TBD-0044", "Confirmed", "2026-10-01", "FIN-TBD-1000PM", [S(10, 3, "2026-10-26", "Allocated/Pegged", { confQty: 3, confDate: "2026-10-26", constraint: "on-hand stock", snapshot: SNAP, peg: `Stock FIN-TBD-1000PM, ${WH2}` })]),
    mkOrder(348, db, "CUS-TBD-0052", "Confirmed", "2026-10-02", "FIN-TBD-5000SS", [S(10, 1, "2026-11-10", "Allocated/Pegged", { confQty: 1, confDate: "2026-11-10", constraint: "on-hand stock", snapshot: SNAP, peg: `Stock FIN-TBD-5000SS, ${WH2}` })]),
    mkOrder(349, db, "CUS-TBD-0048", "Confirmed", "2026-09-28", "FIN-TBD-1000PM", [S(10, 2, "2026-10-19", "Confirmed", { confQty: 2, confDate: "2026-11-02", constraint: "incoming stock from production order", snapshot: SNAP, backorder: true, peg: "WO-TBD-0458" })]),
    mkOrder(350, db, "CUS-TBD-0027", "Confirmed", "2026-09-22", "FIN-TBD-2500PM", [S(10, 2, "2026-10-30", "Confirmed", { confQty: 2, confDate: "2026-10-30", constraint: "incoming stock from production order", snapshot: SNAP, peg: "WO-TBD-0452" })]),
  ]
  return o
}
const SUPPLY: SupplyOption[] = [
  { id: "SUP-OPT-01", kind: "Production order", ref: "WO-TBD-0451", itemId: "FIN-TBD-2500PM", qty: 4, free: 4, date: "2026-10-30", note: "MRP run MRP-TBD-1006" },
  { id: "SUP-OPT-02", kind: "Production order", ref: "WO-TBD-0452", itemId: "FIN-TBD-2500PM", qty: 2, free: 0, date: "2026-11-09", note: "Pegged to SO-2026-00350; slipped from Oct 30 after a tank weld repair" },
  { id: "SUP-OPT-03", kind: "Production order", ref: "WO-TBD-0455", itemId: "FIN-TBD-5000SS", qty: 2, free: 2, date: "2026-11-18", note: "MRP run MRP-TBD-1006" },
  { id: "SUP-OPT-04", kind: "Stock in another warehouse", ref: WH2, itemId: "FIN-TBD-1000PM", qty: 2, free: 2, date: "2026-10-16", note: "Stock transfer Regina to Fargo, 5 days" },
  { id: "SUP-OPT-05", kind: "Production order", ref: "WO-TBD-0457", itemId: "FIN-TBD-0167PL", qty: 40, free: 40, date: "2026-10-21", note: "MRP run MRP-TBD-1006" },
  { id: "SUP-OPT-06", kind: "Production order", ref: "WO-TBD-0458", itemId: "FIN-TBD-1000PM", qty: 6, free: 0, date: "2026-11-04", note: "Pegged to SO-2026-00343 and SO-2026-00349" },
  { id: "SUP-OPT-07", kind: "Engineering-approved alternate", ref: "FIN-TBD-2500PM", itemId: "FIN-TBD-2500PM", forItem: "FIN-TBD-1000PM", qty: 1, free: 1, date: "2026-10-12", note: "Upsized unit at the ordered price; customer-visible substitution" },
]

// ============================================================================ installed base (Book IV §7.4)
function buildIb(db: DB): Ib[] {
  const out: Ib[] = [{
    id: "IB-TBD-0301", serial: "SN-TBD-20M-0301", itemId: "FIN-TBD-20MVA", customerId: "CUS-TBD-0048", site: "Omaha North 115 kV substation, 16500 Fort Street, Omaha, NE 68116",
    soId: "SO-2026-00301", deliveryId: "DLV-TBD-0031", shipDate: "2026-08-11", podDate: "2026-08-14", commissioningDate: "2026-08-28", status: "In Service",
    warrantyBasis: "Commissioning date", warrantyMonths: 18, soOverrideMonths: 60, extensions: [], transfers: [],
    history: [
      { on: "2026-08-11", text: "Shipped on DLV-TBD-0031 (PGI-TBD-0031). Installed base record created at PGI", doc: { type: "delivery", id: "DLV-TBD-0031" } },
      { on: "2026-08-14", text: "POD-TBD-0031 received with no damage", doc: { type: "pod", id: "POD-TBD-0031" } },
      { on: "2026-08-28", text: "Commissioning date captured from the site acceptance report. Status In Service" },
      { on: "2026-09-24", text: "RMA-TBD-0012: HV bushing SN-TBD-BSH-0302 oil weep at flange; replaced in the field from spares", doc: { type: "rma", id: "RMA-TBD-0012" } },
      { on: "2026-10-02", text: "Campaign RCL-2026-001: the remaining HV bushings SN-TBD-BSH-0301 and 0303 are in the suspect population", doc: { type: "recall", id: "RCL-2026-001" } },
      { on: "2026-10-05", text: "RWO-TBD-0012 opened to inspect and reseal the returned bushing", doc: { type: "reworkOrder", id: "RWO-TBD-0012" } },
    ],
  }]
  let n = 1001
  for (const s of db.serials.filter((x) => x.status === "Shipped" && x.id !== "SN-TBD-20M-0301")) {
    const d = db.deliveries.find((x) => x.id === s.deliveryId)
    if (!d || !d.shipDate) continue
    const pod = db.pods.find((p) => p.deliveryId === d.id)
    const delivered = pod && (pod.status === "Received" || pod.status === "Resolved/Closed")
    const commissioned = delivered && pod?.date && pod.date < "2026-09-20"
    const status: InstalledBaseStatus = commissioned ? "In Service" : delivered ? "Installed" : "Shipped"
    out.push({
      id: `IB-TBD-${n++}`, serial: s.id, itemId: s.item, customerId: d.customerId, site: d.shipTo, soId: d.soId, deliveryId: d.id, shipDate: d.shipDate, podDate: delivered ? pod?.date : undefined,
      commissioningDate: commissioned ? addDays(pod!.date!, 12) : undefined, status,
      warrantyBasis: d.customerId === "CUS-TBD-0027" ? "POD date" : "Ship date", warrantyMonths: s.item === "FIN-TBD-5000SS" ? 24 : 18, extensions: [], transfers: [],
      history: [{ on: d.shipDate, text: `Shipped on ${d.id} (${d.pgiId}). Installed base record created at PGI`, doc: { type: "delivery", id: d.id } }, ...(delivered ? [{ on: pod!.date!, text: `${pod!.id} recorded. Status Installed (POD date)`, doc: { type: "pod" as const, id: pod!.id } }] : []), ...(commissioned ? [{ on: addDays(pod!.date!, 12), text: "Commissioning date captured. Status In Service" }] : [])],
    })
  }
  // EPC-bought units ship to a job site; the owner's final site is not known until someone records it (IB-001 unknown-site worklist).
  for (const x of out)
    if (["CUS-TBD-0017", "CUS-TBD-0035"].includes(x.customerId)) {
      x.history.push({ on: x.shipDate, text: `Shipped to ${x.site.split(",")[0]}, a contractor job site. The final installation site is not recorded` })
      x.site = "Not recorded"
    }
  // EPC hand-over: an O'Hara-Bell job-site unit assigned to the owner utility, an ownership transfer on record.
  const handed = out.filter((x) => x.deliveryId === "DLV-TBD-0061")[1]
  if (handed) {
    handed.transfers.push({ on: "2026-10-05", fromCustomerId: "CUS-TBD-0017", toCustomerId: "CUS-TBD-0027", document: "Assignment of warranty OHB-LMLW-2291.pdf", by: "Customer service" })
    handed.customerId = "CUS-TBD-0027"
    handed.history.push({ on: "2026-10-05", text: "Ownership transferred from O'Hara-Bell Electrical Contractors, Inc. to Lakeshore Municipal Light & Water (EPC hand-over with assignment document)" })
  }
  return out
}

// ============================================================================ RMAs (Book I A §3)
type RmaSpec = {
  id: string; cls: RmaClass; status: RmaStatus; warranty: WarrantyClaimBadge; cust: string; refType: Rma["refType"]; refDoc?: string; reason: RmaReason; detail: string
  requested: string; statusSince: string; lines: SpecLine[]
  extra?: Partial<Rma>
}
type SpecLine = Omit<RmaLine, "valuation" | "qtyRecd" | "customerProperty"> & { customerProperty?: boolean }
function mkRma(s: RmaSpec, received: Partial<Record<number, number>>): Rma {
  const lines: RmaLine[] = s.lines.map((l) => ({
    ...l, qtyRecd: received[l.no] ?? 0, valuation: valuationOf(l.itemId, l.origPrice), customerProperty: l.customerProperty ?? (l.expected === "Repair"),
  }))
  return {
    id: s.id, cls: s.cls, status: s.status, warranty: s.warranty, customerId: s.cust, refType: s.refType, refDoc: s.refDoc, reason: s.reason, reasonDetail: s.detail,
    warehouse: QUARANTINE, freight: freightDefault(s.reason), restockPct: restockDefault(s.reason), ownerId: "USR-TBD-003", requested: s.requested, statusSince: s.statusSince,
    lines, receipts: [], settlement: [], linked: [], activity: [A(s.requested, "Customer service", `RMA created from ${s.refType === "No Reference" ? "the No-Reference exception path" : `${s.refType} ${s.refDoc}`}. Status Draft`)],
    ...s.extra,
  }
}

function buildRmas(db: DB): Rma[] {
  const ser = (dlv: string) => db.serials.filter((x) => x.deliveryId === dlv).map((x) => x.id)
  const price = (item: string, cur: "USD" | "CAD" = "USD") => (cur === "CAD" ? Math.round(product(item).unitPrice * 1.36) : product(item).unitPrice)
  const list: Rma[] = []
  const push = (s: RmaSpec, received: Partial<Record<number, number>> = {}, after?: (r: Rma) => void) => {
    const r = mkRma(s, received)
    after?.(r)
    list.push(r)
  }
  push({ id: "RMA-TBD-0001", cls: "RC1", status: "Closed", warranty: "No", cust: "CUS-TBD-0031", refType: "Invoice", refDoc: "IR-TBD-0160", reason: "Wrong Item Ordered", detail: "Customer ordered 10 kV MCOV arresters; the feeder needs a different rating. Six units unopened.", requested: "2026-08-04", statusSince: "2026-08-30",
    lines: [{ no: 10, itemId: "TRADE-TBD-ARR", qtyAuth: 6, origPrice: 149, expected: "Restock", disposition: "Restock" }] }, { 10: 6 }, (r) => {
    r.receivedDate = "2026-08-12"; r.closedOn = "2026-08-30"; r.lines[0].condition = "Undamaged"
    r.findings = "Six arresters in original cartons, seals intact. Restock to Fargo."
    r.settlement = [
      { id: "S1", line: 10, label: "Stock transfer Quarantine → WH-TBD-01 (restock)", template: 18, amount: 6 * 88, detail: "6 × TRADE-TBD-ARR at $88.00 valuation", done: true },
      { id: "S2", line: 10, label: "Credit memo request CMR-TBD-0041 → ACC credit note", template: 19, amount: Math.round(6 * 149 * 0.9 * 100) / 100, detail: "Return value $894.00 less 10% restocking fee ($89.40 to 4910)", doc: undefined, done: true },
    ]
    r.receipts = [{ id: "RCP-TBD-0101", date: "2026-08-12", by: "Owen Pelletier", lines: [{ line: 10, qty: 6, condition: "Undamaged" }], posted17: 6 * 88 }]
    r.activity.push(A("2026-08-05", "Customer Service Manager", "Approved (APR, single step: RC1 up to $10,000). Status Authorized"), A("2026-08-12", "Receiving clerk", "Return receipt RCP-TBD-0101: 6 received, Undamaged. #17 posted"), A("2026-08-14", "Inspector", "Disposition proposed: Restock"), A("2026-08-15", "Quality Manager", "Dispositions approved. Status Settling"), A("2026-08-30", "System", "All linked documents posted. Status Closed"))
  })
  const d56 = ser("DLV-TBD-0056")
  push({ id: "RMA-TBD-0002", cls: "RC2", status: "Closed", warranty: "No", cust: "CUS-TBD-0035", refType: "Serial Number", refDoc: d56[0], reason: "Damaged in Transit", detail: "Tank wall punctured during offload at the Delta laydown; unit never energized. Carrier notified at delivery.", requested: "2026-08-28", statusSince: "2026-09-26",
    lines: [{ no: 10, itemId: "FIN-TBD-2500PM", serial: d56[0], qtyAuth: 1, origPrice: price("FIN-TBD-2500PM", "CAD"), expected: "Replace", disposition: "Scrap" }] }, { 10: 1 }, (r) => {
    r.freight = "PE Pays"; r.receivedDate = "2026-09-08"; r.closedOn = "2026-09-26"; r.lines[0].condition = "Damaged Product"; r.lines[0].photo = "rcp-0102-tank-wall.jpg"
    r.findings = "Core displaced, tank wall breached, oil contaminated. Not economical to repair."; r.attributable = "Transit Damage"
    r.freightClaim = { carrier: "Northline Freightways", claimNo: "NF-CLM-55031", amount: 61200, status: "Recovered" }
    r.settlement = [{ id: "S1", line: 10, label: "Goods issue to scrap from quarantine", template: 20, amount: 61200, detail: "1 × FIN-TBD-2500PM at $61,200.00 valuation; cost center CC-1500 Quality", done: true }]
    r.receipts = [{ id: "RCP-TBD-0102", date: "2026-09-08", by: "Owen Pelletier", lines: [{ line: 10, qty: 1, condition: "Damaged Product", photo: "rcp-0102-tank-wall.jpg", serial: d56[0] }], posted17: 61200 }]
    r.activity.push(A("2026-09-26", "System", "Scrap posted (#20); freight claim NF-CLM-55031 recovered. Status Closed"))
  })
  push({ id: "RMA-TBD-0003", cls: "RC1", status: "Rejected", warranty: "No", cust: "CUS-TBD-0009", refType: "Invoice", refDoc: "IR-TBD-0141", reason: "Customer Convenience", detail: "Distributor overstocked after a cancelled project and asks to return 40 pole-mounts.", requested: "2026-09-12", statusSince: "2026-09-15",
    lines: [{ no: 10, itemId: "FIN-TBD-0167PL", qtyAuth: 40, origPrice: 6980, expected: "Credit" }] }, {}, (r) => {
    r.activity.push(A("2026-09-15", "Customer Service Manager", "Rejected: quantity exceeds what was shipped on the reference invoice (V-RMA-01) and the units are past the return window. Status Rejected"))
  })
  push({ id: "RMA-TBD-0004", cls: "RC1", status: "Cancelled", warranty: "No", cust: "CUS-TBD-0027", refType: "Sales Order", refDoc: "SO-2026-00370", reason: "Overshipment", detail: "One extra pole-mount unit found on the Manitowoc pump station drop; customer later kept it.", requested: "2026-09-20", statusSince: "2026-09-25",
    lines: [{ no: 10, itemId: "FIN-TBD-0167PL", qtyAuth: 1, origPrice: 6980, expected: "Restock" }] }, {}, (r) => {
    r.cancelReason = "Customer decided to keep the unit and accepted an invoice for it."
    r.activity.push(A("2026-09-21", "Customer Service Manager", "Approved. Status Authorized"), A("2026-09-25", "Customer Service Manager", `Cancelled before receipt. Reason: ${r.cancelReason}`))
  })
  push({ id: "RMA-TBD-0005", cls: "RC1", status: "Draft", warranty: "No", cust: "CUS-TBD-0017", refType: "Invoice", refDoc: "IR-TBD-0164", reason: "Wrong Item Shipped", detail: "Overhead fault indicators shipped instead of the underground type on the Duluth job.", requested: "2026-10-08", statusSince: "2026-10-08",
    lines: [{ no: 10, itemId: "TRADE-TBD-FCI", qtyAuth: 20, origPrice: 112, expected: "Credit" }] })
  const d57 = ser("DLV-TBD-0057")
  push({ id: "RMA-TBD-0006", cls: "RC3", status: "Pending Approval", warranty: "Yes", cust: "CUS-TBD-0041", refType: "Serial Number", refDoc: d57[0], reason: "Defective — Warranty", detail: "Unit tripped on Buchholz alarm two weeks after energizing; DGA shows acetylene. De-energized and ready to ship back.", requested: "2026-10-06", statusSince: "2026-10-07",
    lines: [{ no: 10, itemId: "FIN-TBD-1000PM", serial: d57[0], qtyAuth: 1, origPrice: 41850, expected: "Repair" }] }, {}, (r) => {
    r.rc3 = { oilDrained: false, oilGal: 410, nitrogen: false, impactRecorder: true }
    r.activity.push(A("2026-10-07", "Customer service", "Submitted for approval (RC3 + warranty: CS Manager then Quality Manager). Status Pending Approval"))
  })
  const d58 = ser("DLV-TBD-0058")
  push({ id: "RMA-TBD-0007", cls: "RC1", status: "Authorized", warranty: "No", cust: "CUS-TBD-0044", refType: "Sales Order", refDoc: "SO-2026-00371", reason: "Wrong Item Shipped", detail: "Two 167 kVA units with the wrong secondary voltage shipped to Alma; customer needs 120/240 V dual secondary.", requested: "2026-10-01", statusSince: "2026-10-02",
    lines: [{ no: 10, itemId: "FIN-TBD-0167PL", serial: d58[0], qtyAuth: 1, origPrice: price("FIN-TBD-0167PL", "CAD"), expected: "Replace" }, { no: 20, itemId: "FIN-TBD-0167PL", serial: d58[1], qtyAuth: 1, origPrice: price("FIN-TBD-0167PL", "CAD"), expected: "Replace" }] }, {}, (r) => {
    r.expectedReturn = "2026-10-12"; r.carrier = "Northline Freightways"
    r.activity.push(A("2026-10-02", "Customer Service Manager", "Approved. Status Authorized. Return instructions with RMA barcode printed and emailed"))
  })
  const d59 = ser("DLV-TBD-0059")
  push({ id: "RMA-TBD-0008", cls: "RC2", status: "Authorized", warranty: "No", cust: "CUS-TBD-0027", refType: "Serial Number", refDoc: d59[0], reason: "Damaged in Transit", detail: "Radiator fins crushed on arrival at Manitowoc; unit refused at delivery and held by the carrier.", requested: "2026-10-03", statusSince: "2026-10-05",
    lines: [{ no: 10, itemId: "FIN-TBD-1000PM", serial: d59[0], qtyAuth: 1, origPrice: 41850, expected: "Repair", customerProperty: false }] }, {}, (r) => {
    r.freight = "PE Pays"; r.expectedReturn = "2026-10-08"
    r.freightClaim = { carrier: "Northline Freightways", claimNo: "NF-CLM-55402", amount: 6800, status: "Filed" }
    r.activity.push(A("2026-10-05", "Customer Service Manager", "Approved. Status Authorized"))
  })
  push({ id: "RMA-TBD-0009", cls: "RC1", status: "Partially Received", warranty: "No", cust: "CUS-TBD-0031", refType: "Invoice", refDoc: "IR-TBD-0168", reason: "Overshipment", detail: "Twelve arresters shipped above the ordered quantity on the Minot delivery.", requested: "2026-09-29", statusSince: "2026-10-06",
    lines: [{ no: 10, itemId: "TRADE-TBD-ARR", qtyAuth: 12, origPrice: 149, expected: "Restock" }] }, { 10: 8 }, (r) => {
    r.receivedDate = "2026-10-06"; r.lines[0].condition = "Undamaged"
    r.receipts = [{ id: "RCP-TBD-0108", date: "2026-10-06", by: "Owen Pelletier", lines: [{ line: 10, qty: 8, condition: "Undamaged" }], posted17: 8 * 88 }]
    r.activity.push(A("2026-09-30", "Customer Service Manager", "Approved. Status Authorized"), A("2026-10-06", "Receiving clerk", "Return receipt RCP-TBD-0108: 8 of 12 received (4 open). Status Partially Received. #17 posted"))
  })
  const d61 = ser("DLV-TBD-0061")
  push({ id: "RMA-TBD-0010", cls: "RC1", status: "Received", warranty: "Yes", cust: "CUS-TBD-0017", refType: "Serial Number", refDoc: d61[0], reason: "Defective — Warranty", detail: "Pole-mount unit hums loudly and runs hot at 60% load; replaced by the contractor from stock.", requested: "2026-09-22", statusSince: "2026-09-29",
    lines: [{ no: 10, itemId: "FIN-TBD-0167PL", serial: d61[0], qtyAuth: 1, origPrice: 6980, expected: "Replace" }] }, { 10: 1 }, (r) => {
    r.receivedDate = "2026-09-29"; r.lines[0].condition = "Undamaged"
    r.lines.push({ no: 20, itemId: "FIN-TBD-0167PL", qtyAuth: 0, qtyRecd: 1, origPrice: 0, valuation: valuationOf("FIN-TBD-0167PL", 6980), customerProperty: true, unauthorized: true, condition: "Undamaged", notes: "Second pole-mount unit in the same crate, not on the RMA" })
    r.activity.push(A("2026-09-29", "Receiving clerk", "Unauthorized Return line 20: 1 × FIN-TBD-0167PL booked with supervisor override. Own inspection required; append by change (re-approval) or return at customer cost"))
    r.receipts = [{ id: "RCP-TBD-0105", date: "2026-09-29", by: "Owen Pelletier", lines: [{ line: 10, qty: 1, condition: "Undamaged", serial: d61[0] }], posted17: 5410 }]
    r.activity.push(A("2026-09-24", "Quality Manager", "Approved (CS Manager, then Quality Manager for the warranty claim). Status Authorized"), A("2026-09-29", "Receiving clerk", "Return receipt RCP-TBD-0105. Serial verified (SP-19). Status Received. Return inspection created"))
  })
  push({ id: "RMA-TBD-0011", cls: "RC4", status: "Received", warranty: "Denied", cust: "CUS-TBD-0041", refType: "Sales Order", refDoc: "SO-2026-00369", reason: "Billable Repair", detail: "Out-of-warranty refurbishment: rewind LV after a lightning-related fault at the mill.", requested: "2026-10-02", statusSince: "2026-10-07",
    lines: [{ no: 10, itemId: "FIN-TBD-1000PM", serial: ser("DLV-TBD-0057")[1], qtyAuth: 1, origPrice: 41850, expected: "Repair", customerProperty: true }] }, { 10: 1 }, (r) => {
    r.receivedDate = "2026-10-07"; r.lines[0].condition = "Damaged Product"; r.lines[0].photo = "rcp-0109-lv-lead.jpg"
    r.adjudication = { verdict: "Warranty Denied", justification: "Failure caused by a lightning surge with no arrester on the mill feeder (site conditions); exclusion applies.", by: "Quality Manager", on: "2026-10-03" }
    r.receipts = [{ id: "RCP-TBD-0109", date: "2026-10-07", by: "Owen Pelletier", lines: [{ line: 10, qty: 1, condition: "Damaged Product", photo: "rcp-0109-lv-lead.jpg" }], posted17: 0 }]
    r.activity.push(A("2026-10-03", "Quality Manager", "Warranty denied; converted to RC4 billable repair (customer letter generated)"), A("2026-10-07", "Receiving clerk", "Received as customer property: non-valuated, no #17"))
  })
  push({ id: "RMA-TBD-0012", cls: "RC3", status: "In Inspection", warranty: "Yes", cust: "CUS-TBD-0048", refType: "Serial Number", refDoc: "SN-TBD-20M-0301", reason: "Defective — Warranty", detail: "HV bushing SN-TBD-BSH-0302 weeping oil at the mounting flange 4 weeks after energizing; replaced in the field from spares.", requested: "2026-09-24", statusSince: "2026-10-05",
    lines: [{ no: 10, itemId: "RAW-TBD-BSH145", serial: "SN-TBD-BSH-0302", batch: "BAT-TBD-B0301", qtyAuth: 1, origPrice: 26400, expected: "Replace" }] }, { 10: 1 }, (r) => {
    r.ibId = "IB-TBD-0301"; r.receivedDate = "2026-10-03"; r.lines[0].condition = "Leaking Oil"; r.lines[0].photo = "rcp-0106-flange-weep.jpg"
    r.rc3 = { oilDrained: true, oilGal: 9, nitrogen: false, impactRecorder: false }
    r.teardown = { "Bushing condition": "Oil film around the flange gasket seat; porcelain sound; C1 power factor 0.31% (limit 0.5%)", "Oil test results": "Moisture 18 ppm; acceptable" }
    r.ncrId = "NCR-TBD-0044"; r.scarId = "SCAR-TBD-0009"
    r.linked = [{ type: "ncr", id: "NCR-TBD-0044" }, { type: "reworkOrder", id: "RWO-TBD-0012" }]
    r.receipts = [{ id: "RCP-TBD-0106", date: "2026-10-03", by: "Owen Pelletier", lines: [{ line: 10, qty: 1, condition: "Leaking Oil", photo: "rcp-0106-flange-weep.jpg", serial: "SN-TBD-BSH-0302" }], posted17: 18900 }]
    r.activity.push(
      A("2026-09-25", "Quality Manager", "Approved (CS Manager, then Quality Manager: RC3 with warranty claim). Status Authorized"),
      A("2026-10-03", "Receiving clerk", "Return receipt RCP-TBD-0106: SN-TBD-BSH-0302 scanned and verified (SP-19), Leaking Oil, photo attached. #17 posted. Status Received"),
      A("2026-10-05", "Inspector", "Return inspection started; teardown checklist opened. Status In Inspection"),
    )
  })
  const d60 = ser("DLV-TBD-0060")
  push({ id: "RMA-TBD-0013", cls: "RC3", status: "Disposition Pending", warranty: "Yes", cust: "CUS-TBD-0031", refType: "Serial Number", refDoc: d60[0], reason: "Defective — Warranty", detail: "Pad-mount unit failed winding resistance check during the utility's 30-day acceptance test.", requested: "2026-09-16", statusSince: "2026-10-06",
    lines: [{ no: 10, itemId: "FIN-TBD-2500PM", serial: d60[0], qtyAuth: 1, origPrice: 78400, expected: "Repair", disposition: "Repair — Warranty" }] }, { 10: 1 }, (r) => {
    r.receivedDate = "2026-09-24"; r.lines[0].condition = "Undamaged"
    r.rc3 = { oilDrained: true, oilGal: 520, nitrogen: true, impactRecorder: false }
    r.findings = "LV winding phase B: open strand at the lead brazed joint. Workmanship defect at WC-300."
    r.teardown = { "Winding condition": "Phase B LV lead joint cracked", "Core condition": "No defects", "Oil test results": "Acceptable", "Bushing condition": "No defects", "Tap changer condition": "DETC contacts clean" }
    r.attributable = "Manufacturing Defect"
    r.adjudication = { verdict: "Warranty Approved", justification: "Manufacturing defect inside the ship-date warranty window (18 months).", by: "Inspector (proposed)", on: "2026-10-06" }
    r.ncrId = "NCR-TBD-0047"; r.linked = [{ type: "ncr", id: "NCR-TBD-0047" }]
    r.receipts = [{ id: "RCP-TBD-0103", date: "2026-09-24", by: "Owen Pelletier", lines: [{ line: 10, qty: 1, condition: "Undamaged", serial: d60[0] }], posted17: 0 }]
    r.lines[0].customerProperty = true
    r.activity.push(A("2026-09-24", "Receiving clerk", "Received as customer property (repair expected): non-valuated, no #17"), A("2026-10-06", "Inspector", "Findings recorded; NCR-TBD-0047 created (Manufacturing Defect). Disposition proposed: Repair — Warranty. Status Disposition Pending"))
  })
  const d41 = ser("DLV-TBD-0041")
  push({ id: "RMA-TBD-0014", cls: "RC1", status: "Settling", warranty: "No", cust: "CUS-TBD-0009", refType: "Serial Number", refDoc: d41[0], reason: "Wrong Item Ordered", detail: "Distributor ordered a 1,000 kVA unit for a job that needed 2,500 kVA; unit unused in its crate.", requested: "2026-09-08", statusSince: "2026-09-30",
    lines: [{ no: 10, itemId: "FIN-TBD-1000PM", serial: d41[0], qtyAuth: 1, origPrice: 41850, expected: "Restock", disposition: "Restock" }] }, { 10: 1 }, (r) => {
    r.receivedDate = "2026-09-18"; r.lines[0].condition = "Damaged Packaging"; r.lines[0].photo = "rcp-0104-crate.jpg"
    r.findings = "Crate corner broken; unit undamaged, tests as new."
    r.receipts = [{ id: "RCP-TBD-0104", date: "2026-09-18", by: "Owen Pelletier", lines: [{ line: 10, qty: 1, condition: "Damaged Packaging", photo: "rcp-0104-crate.jpg", serial: d41[0] }], posted17: 32640 }]
    r.settlement = [
      { id: "S1", line: 10, label: "Stock transfer Quarantine → WH-TBD-01 (restock), quality status Unrestricted", template: 18, amount: 32640, detail: "1 × FIN-TBD-1000PM at $32,640.00 valuation", done: true },
      { id: "S2", line: 10, label: "Credit memo request → ACC credit note", template: 19, amount: 37665, detail: "Return value $41,850.00 less 10% restocking fee ($4,185.00 to 4910)", done: false, error: "E-RMA-07 Customer is on credit hold — credit requires Controller release" },
    ]
    r.activity.push(A("2026-09-30", "Quality Manager", "Dispositions approved. Status Settling"), A("2026-09-30", "System", "Restock posted (#18). Credit memo request blocked: E-RMA-07 Customer is on credit hold — credit requires Controller release"))
  })
  const d69 = ser("DLV-TBD-0069")
  push({ id: "RMA-TBD-0015", cls: "RC2", status: "Settling", warranty: "No", cust: "CUS-TBD-0035", refType: "Serial Number", refDoc: d69[0], reason: "Damaged in Transit", detail: "Unit substation arrived with a cracked HV bushing and oil on the trailer deck (POD exception).", requested: "2026-10-06", statusSince: "2026-10-08",
    lines: [{ no: 10, itemId: "FIN-TBD-5000SS", serial: d69[0], qtyAuth: 1, origPrice: price("FIN-TBD-5000SS", "CAD"), expected: "Replace", disposition: "Replace" }] }, { 10: 1 }, (r) => {
    r.freight = "PE Pays"; r.receivedDate = "2026-10-07"; r.lines[0].condition = "Leaking Oil"; r.lines[0].photo = "rcp-0110-bushing.jpg"
    r.findings = "HV bushing H2 cracked at the skirt; tank intact; oil loss about 30 gal."; r.attributable = "Transit Damage"
    r.freightClaim = { carrier: "Northline Freightways", claimNo: "NF-CLM-55311", amount: 18600, status: "Filed" }
    r.receipts = [{ id: "RCP-TBD-0110", date: "2026-10-07", by: "Owen Pelletier", lines: [{ line: 10, qty: 1, condition: "Leaking Oil", photo: "rcp-0110-bushing.jpg", serial: d69[0] }], posted17: 149900 }]
    r.settlement = [
      { id: "S1", line: 10, label: "Replacement sales order at $0 net price referencing the RMA", template: 23, amount: null, detail: "#23 posts at the replacement order's PGI (standard cost to 6300 or 5120)", done: false },
      { id: "S2", line: 10, label: "Credit memo request for the original line → ACC credit note", template: 19, amount: price("FIN-TBD-5000SS", "CAD"), detail: "Original line credited in full", done: false },
    ]
    r.activity.push(A("2026-10-08", "Quality Manager", "Dispositions approved. Status Settling"))
  })
  return list
}

// ============================================================================ as-built (Book IV §4.4 trace record, read-only here)
const HERO_ASBUILT: AsBuiltLine[] = [
  { level: 1, itemId: "SEMI-TBD-CORE20", qty: 1, serials: ["SN-TBD-CORE-0301"] },
  { level: 1, itemId: "SEMI-TBD-HVC20", qty: 3, serials: ["SN-TBD-HVC-0301A", "SN-TBD-HVC-0301B", "SN-TBD-HVC-0301C"] },
  { level: 1, itemId: "SEMI-TBD-LVC20", qty: 3 },
  { level: 1, itemId: "SEMI-TBD-TANK20", qty: 1, serials: ["SN-TBD-TNK-0301"] },
  { level: 2, itemId: "RAW-TBD-OLTC", qty: 1, serials: ["SN-TBD-OLTC-0301"], successor: "SPARE-TBD-OLTCK", supersessionNote: "Sold as the contact kit for field service", wear: true, safetyCritical: true },
  { level: 2, itemId: "RAW-TBD-BSH145", qty: 3, serials: ["SN-TBD-BSH-0301", "SN-TBD-BSH-0302", "SN-TBD-BSH-0303"], batch: "BAT-TBD-B0301", successor: "SPARE-TBD-BSH145", supersessionNote: "Built batch BAT-TBD-B0301 is under recall RCL-2026-001; service stock bushing is the orderable successor", safetyCritical: true, forceBlocked: "Built batch BAT-TBD-B0301 is under recall RCL-2026-001" },
  { level: 2, itemId: "RAW-TBD-BSH015", qty: 3, safetyCritical: true },
  { level: 2, itemId: "RAW-TBD-RAD", qty: 8 },
  { level: 2, itemId: "RAW-TBD-CT600", qty: 6 },
  { level: 1, itemId: "SPARE-TBD-GSKT20", qty: 1, wear: true },
  { level: 1, itemId: "RAW-TBD-OIL", qty: 21000, hazardous: true },
]
const DIST_ASBUILT = (item: string): AsBuiltLine[] => [
  { level: 1, itemId: "RAW-TBD-BSH015", qty: item === "FIN-TBD-0167PL" ? 2 : 4, safetyCritical: true },
  { level: 1, itemId: "TRADE-TBD-ARR", qty: 3, wear: true },
  { level: 1, itemId: "TRADE-TBD-ELB", qty: item === "FIN-TBD-0167PL" ? 0 : 6, wear: true },
  { level: 1, itemId: "SPARE-TBD-GSKT20", qty: 1, wear: true },
  { level: 1, itemId: "RAW-TBD-OIL", qty: item === "FIN-TBD-5000SS" ? 4200 : item === "FIN-TBD-2500PM" ? 1900 : item === "FIN-TBD-1000PM" ? 1550 : 120, hazardous: true },
].filter((l) => l.qty > 0)

// ============================================================================ the extension
export function extendSeed(base: Omit<DB, "leads" | "custExt" | "supply" | "reallocations" | "rmas" | "ib" | "asBuilt" | "spareStock" | "seq2" | "fx">): DB {
  const db = base as DB
  // hero phase 1 sales documents
  db.orders.unshift(heroOrder())
  db.quotations.push(...heroQuotes())
  const q377 = db.quotations.find((q) => q.id === "QT-TBD-0377-V1")
  if (q377) {
    q377.leadId = "LEAD-TBD-0377"
    q377.config = HERO_REQ as Record<string, string>
    q377.priorBuildRef = "EBOM-TBD-0301"
  }
  for (const [lead, qs] of [["LEAD-TBD-0402", ["QT-TBD-0402-V1"]], ["LEAD-TBD-0417", ["QT-TBD-0417-V1"]], ["LEAD-TBD-0420", ["QT-TBD-0420-V1", "QT-TBD-0420-V2"]], ["LEAD-TBD-0423", ["QT-TBD-0423-V1"]], ["LEAD-TBD-0391", ["QT-TBD-0391-V1"]], ["LEAD-TBD-0394", ["QT-TBD-0394-V1"]]] as const)
    for (const id of qs) {
      const q = db.quotations.find((x) => x.id === id)
      if (q) q.leadId = lead
    }
  const so377 = db.orders.find((o) => o.id === "SO-2026-00377")
  if (so377) so377.milestones = [20, 10, 20, 30, 15, 5].map((pct, i) => ({ pct, label: i === 4 ? "Delivery" : `Milestone ${i + 1}`, state: i === 0 ? "Invoice request posted" : "Open", irId: i === 0 ? "IR-TBD-0122" : undefined }))
  db.deliveries.push({
    id: "DLV-TBD-0031", soId: "SO-2026-00301", customerId: "CUS-TBD-0048", shipTo: "Omaha North 115 kV substation, 16500 Fort Street, Omaha, NE 68116", incoterms: "DAP", status: "Delivered/Closed",
    rule: "Split, mandatory: over-dimensional units", ruleId: "DLV-SPLIT-M4", refs: [{ soId: "SO-2026-00301", line: 10, sched: 10, qty: 1 }],
    flags: { supply: "passed", credit: "passed", quality: "passed", documents: "passed" }, equipment: "Multi-axle hydraulic trailer, 180 t", permits: ["Oversize/overweight permit, Nebraska DOT", "Escort vehicles, two"],
    door: "1", slot: "2026-08-11 05:00–07:00", carrier: "Heartland Heavy Haul", pro: "PRO 8031-0301", transitDays: 3, freight: 48600, freightPaidBy: "PE-paid", shipDate: "2026-08-11",
    pgiId: "PGI-TBD-0031", pgiPeriod: "2026-08", irId: "IR-TBD-0031", warehouse: WH,
    activity: [A("2026-07-30", "Shipping office", "Delivery created. Grouped by: Split, mandatory: over-dimensional units (DLV-SPLIT-M4)"), A("2026-08-10", "Quality engineer", "Pre-shipment inspection passed (final test IL-TBD-0302 and FTR on file)"), A("2026-08-11", "Shipping office", "SP-18 load scan of HU-TBD-0131. PGI-TBD-0031 posted in period 2026-08 (#25, #26)"), A("2026-08-14", "Shipping office", "POD-TBD-0031 recorded. Status Delivered/Closed; milestone invoice request IR-TBD-0031 (15%)")],
  })
  db.hus.push({ id: "HU-TBD-0131", sscc: "000614141000001931", deliveryId: "DLV-TBD-0031", item: "FIN-TBD-20MVA", expectedKg: 41800, actualKg: 41950, status: "Shipped", labelPrinted: true, serial: "SN-TBD-20M-0301", scaleAttempts: 1 })
  db.serials.push({ id: "SN-TBD-20M-0301", item: "FIN-TBD-20MVA", status: "Shipped", deliveryId: "DLV-TBD-0031" })
  db.pods.push({ id: "POD-TBD-0031", deliveryId: "DLV-TBD-0031", status: "Resolved/Closed", expectedDate: "2026-08-14", receiver: "Ruth Vandermolen (project manager)", date: "2026-08-14", condition: "No damage", docName: "signed-bol-dlv-tbd-0031.pdf", milestoneFired: true,
    activity: [A("2026-08-11", "Shipping office", "POD row created at Expected (ship date + 3 transit days)"), A("2026-08-14", "Shipping office", "POD recorded, no damage. Delivery milestone fired (once); IR-TBD-0031 handed to Finance"), A("2026-08-28", "Customer service", "Site acceptance on file; POD closed")] })
  db.orders.push(...backorderOrders(db))

  db.leads = buildLeads(db)
  db.custExt = buildCustExt(db)
  db.supply = structuredClone(SUPPLY)
  db.reallocations = []
  db.ib = buildIb(db)
  db.rmas = buildRmas(db)
  // Installed base status follows returns: units on received RC2/RC3 RMAs are Returned; the scrapped one is Scrapped.
  for (const r of db.rmas)
    for (const l of r.lines) {
      const ib = db.ib.find((x) => x.serial === l.serial)
      if (!ib) continue
      if (r.id === "RMA-TBD-0002") ib.status = "Scrapped"
      else if (l.qtyRecd > 0 && (r.cls === "RC2" || r.cls === "RC3") && !l.customerProperty && r.status !== "Closed") ib.status = "Returned"
      ib.history.push({ on: r.requested, text: `${r.id} (${r.cls}, ${r.reason})`, doc: { type: "rma", id: r.id } })
    }
  db.asBuilt = { "SN-TBD-20M-0301": HERO_ASBUILT }
  for (const ib of db.ib) if (!db.asBuilt[ib.serial]) db.asBuilt[ib.serial] = DIST_ASBUILT(ib.itemId)
  db.spareStock = {
    "SPARE-TBD-BSH145": { qty: 4 }, "SPARE-TBD-GSKT20": { qty: 12 }, "SPARE-TBD-OLTCK": { qty: 0, leadWeeks: 10 }, "RAW-TBD-BSH015": { qty: 0, leadWeeks: 6 },
    "RAW-TBD-RAD": { qty: 16 }, "RAW-TBD-OIL": { qty: 38000 }, "TRADE-TBD-ARR": { qty: 140 }, "TRADE-TBD-ELB": { qty: 0, leadWeeks: 3 }, "RAW-TBD-BSH145": { qty: 0 }, "RAW-TBD-OLTC": { qty: 2 },
  }
  db.seq2 = { lead: 443, opp: 437, cus: 61, qt: 430, rma: 16, ib: 2000, rea: 1, ncr: 48, rwo: 13, cmr: 42, rcp: 111, ext: 1 }
  db.fx = buildFxSeed(db)
  return db
}

/** Materials used by the spares finder and RMA create screens. */
export const SALEABLE_RETURN_ITEMS = MATERIALS.filter((m) => ["FIN", "TRADE", "SPARE"].includes(m.type) && m.status === "Active").map((m) => m.id)
