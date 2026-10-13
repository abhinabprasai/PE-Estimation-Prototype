// THROWAWAY PROTOTYPE - FL-09. Seed data per prompt 5.4. All names, numbers and identifiers are fictitious.
// Identifier formats other than SO-{YYYY}-{SEQ:5} are placeholders (OQ-30).
import { ruleIdFor } from "../fx/model"
import {
  type Activity,
  type Approval,
  type Customer,
  type DB,
  type Delivery,
  type Flags,
  type HU,
  type POD,
  type Quotation,
  type SalesOrder,
  type Serial,
  type SOLine,
  type Schedule,
  addDays,
  fmtSO,
  product,
} from "./model"
import { extendSeed } from "./ext-seed"

const A = (at: string, by: string, text: string): Activity => ({ at, by, text })
const WH = "WH-TBD-01 Fargo, ND"
const WH2 = "WH-TBD-02 Regina, SK"
const SNAP = "PLN-SNAP-TBD-0919"

export const CUSTOMERS: Customer[] = [
  { id: "CUS-TBD-0031", name: "Prairie Ridge Electric Cooperative", cls: "Co-op", status: "Active", currency: "USD", incoterms: "DAP", creditLimit: 750000, exposure: 486300, creditHold: false, pastDue30: false, risk: "B", priority: "A", billTo: "PO Box 118, Minot, ND 58702", shipTo: "Substation yard, 4410 County Road 12, Minot, ND 58701" },
  { id: "CUS-TBD-0044", name: "Coopérative d'électricité du Lac-Saint-Jean", cls: "Co-op", status: "Active", currency: "CAD", incoterms: "DAP", creditLimit: 1200000, exposure: 402000, creditHold: false, pastDue30: false, risk: "A", priority: "B", billTo: "215, rue Racine Est, Chicoutimi, QC G7H 1R9", shipTo: "Poste de distribution, 1880 boul. Sacré-Cœur, Alma, QC G8B 5W1" },
  { id: "CUS-TBD-0052", name: "Northern Saskatchewan Municipal Power and Light Utility Commission, Prince Albert Regional Distribution District", cls: "Municipal Utility", status: "Active", currency: "CAD", incoterms: "FCA", creditLimit: 900000, exposure: 311400, creditHold: false, pastDue30: false, risk: "B", priority: "B", billTo: "1084 Central Avenue, Prince Albert, SK S6V 4V7", shipTo: "Operations yard, 36 River Street West, Prince Albert, SK S6V 2Z1" },
  { id: "CUS-TBD-0017", name: "O'Hara-Bell Electrical Contractors, Inc.", cls: "EPC Contractor", status: "Active", currency: "USD", incoterms: "EXW", creditLimit: 400000, exposure: 122600, creditHold: false, pastDue30: false, risk: "C", priority: "B", billTo: "77 Harbor Point Drive, Duluth, MN 55802", shipTo: "Job site 2291, Hwy 53 & Rice Lake Rd, Duluth, MN 55811" },
  { id: "CUS-TBD-0009", name: "Volt Co.", cls: "Distributor", status: "Active", currency: "USD", incoterms: "FCA", creditLimit: 150000, exposure: 148900, creditHold: true, pastDue30: false, risk: "C", priority: "C", billTo: "12 Spark Lane, Sioux Falls, SD 57104", shipTo: "Dock 3, 12 Spark Lane, Sioux Falls, SD 57104" },
  { id: "CUS-TBD-0060", name: "Bluewater Ridge Solar EPC, LLC", cls: "EPC Contractor", status: "Prospect", currency: "USD", incoterms: "DAP", creditLimit: 0, exposure: 0, creditHold: false, pastDue30: false, risk: "D", priority: "C", billTo: "500 Lakeview Plaza, Madison, WI 53703", shipTo: "Not recorded" },
  { id: "CUS-TBD-0023", name: "Cascade Valley Public Utility District", cls: "Municipal Utility", status: "On Hold", currency: "USD", incoterms: "DAP", creditLimit: 600000, exposure: 210000, creditHold: false, pastDue30: false, risk: "B", priority: "B", billTo: "900 Orchard Way, Wenatchee, WA 98801", shipTo: "Service center, 4102 Malaga Hwy, Wenatchee, WA 98801" },
  { id: "CUS-TBD-0038", name: "Ironworks Mill Industrial Park Ltd.", cls: "Industrial", status: "Blocked", currency: "USD", incoterms: "FCA", creditLimit: 250000, exposure: 0, creditHold: false, pastDue30: true, risk: "D", priority: "C", billTo: "1 Foundry Road, Gary, IN 46402", shipTo: "Gate 4, 1 Foundry Road, Gary, IN 46402" },
  { id: "CUS-TBD-0011", name: "Tri-County Rural Electric Association", cls: "Co-op", status: "Inactive", currency: "USD", incoterms: "DAP", creditLimit: 0, exposure: 0, creditHold: false, pastDue30: false, risk: "C", priority: "C", billTo: "PO Box 40, Hettinger, ND 58639", shipTo: "Not recorded" },
  { id: "CUS-TBD-0027", name: "Lakeshore Municipal Light & Water", cls: "Municipal Utility", status: "Active", currency: "USD", incoterms: "DAP", creditLimit: 1000000, exposure: 812300, creditHold: false, pastDue30: false, risk: "B", priority: "A", billTo: "300 Harbor Street, Manitowoc, WI 54220", shipTo: "North substation, 2600 Lake Shore Road, Manitowoc, WI 54220" },
  { id: "CUS-TBD-0041", name: "Granite Peak Mining Operations", cls: "Industrial", status: "Active", currency: "USD", incoterms: "FCA", creditLimit: 500000, exposure: 188400, creditHold: false, pastDue30: true, risk: "C", priority: "B", billTo: "88 Ore Road, Butte, MT 59701", shipTo: "Mill switchyard, 2 Continental Drive, Butte, MT 59701" },
  { id: "CUS-TBD-0035", name: "Fraser Delta Power Contractors Ltd.", cls: "EPC Contractor", status: "Active", currency: "CAD", incoterms: "DAP", creditLimit: 800000, exposure: 264000, creditHold: false, pastDue30: false, risk: "B", priority: "B", billTo: "4400 No. 3 Road, Richmond, BC V6X 2C2", shipTo: "Site laydown, 7100 River Road, Delta, BC V4G 1B6" },
  { id: "CUS-TBD-0048", name: "Midland Plains Grid Constructors", cls: "EPC Contractor", status: "Active", currency: "USD", incoterms: "DAP", creditLimit: 5000000, exposure: 1940000, creditHold: false, pastDue30: false, risk: "A", priority: "A", billTo: "1200 Commerce Street, Omaha, NE 68102", shipTo: "Project laydown, 16500 Fort Street, Omaha, NE 68116", noPartial: true },
]
const cust = (id: string) => CUSTOMERS.find((c) => c.id === id)!
const CAD = 1.36
const priceFor = (item: string, currency: "USD" | "CAD") => {
  const p = product(item).unitPrice
  return currency === "CAD" ? Math.round(p * CAD) : p
}

// ---------- orders driven by deliveries ----------
type DSpec = {
  dlv: number
  status: string
  cust: string
  item: string
  qty: number
  so: number
  so2?: number // order line no within shared order
  rule: string
  shipDate?: string
  period?: string
  transit?: number
  orderStatus: string
  invoicePosted?: boolean
  pod?: "Expected" | "Received" | "Exception" | "Resolved/Closed"
  docsMissing?: boolean
  noCarrier?: boolean
  forceFail?: boolean
  year?: number
  partialOf?: number // schedule requested qty greater than delivered (Partially Delivered)
  shipToOverride?: string
}
const R = {
  shipTo: "Split, mandatory: different ship-to sites",
  inco: "Split, mandatory: different Incoterms",
  hazmat: "Split, mandatory: hazmat segregation",
  overdim: "Split, mandatory: over-dimensional units",
  nopartial: "Split, mandatory: customer \"no partial\" flag (waits for full quantity)",
  elective: "Split, elective: schedules more than 7 days apart",
}
const DSPECS: DSpec[] = [
  { dlv: 72, status: "Planned", cust: "CUS-TBD-0027", item: "FIN-TBD-0167PL", qty: 3, so: 408, rule: R.shipTo, orderStatus: "Confirmed", noCarrier: true },
  { dlv: 73, status: "Planned", cust: "CUS-TBD-0035", item: "FIN-TBD-1000PM", qty: 1, so: 409, rule: R.elective, orderStatus: "Confirmed", noCarrier: true },
  { dlv: 70, status: "Released", cust: "CUS-TBD-0048", item: "FIN-TBD-2500PM", qty: 1, so: 406, rule: R.nopartial, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 74, status: "Picking", cust: "CUS-TBD-0017", item: "FIN-TBD-0167PL", qty: 3, so: 403, rule: R.inco, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 75, status: "Picking", cust: "CUS-TBD-0031", item: "FIN-TBD-1000PM", qty: 2, so: 395, rule: R.elective, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 76, status: "Picking", cust: "CUS-TBD-0052", item: "FIN-TBD-5000SS", qty: 1, so: 394, rule: R.overdim, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 77, status: "Picking", cust: "CUS-TBD-0044", item: "FIN-TBD-0167PL", qty: 2, so: 392, rule: R.shipTo, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 78, status: "Picking", cust: "CUS-TBD-0027", item: "FIN-TBD-1000PM", qty: 1, so: 391, rule: R.hazmat, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 79, status: "Picking", cust: "CUS-TBD-0048", item: "FIN-TBD-0167PL", qty: 2, so: 390, rule: R.nopartial, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 80, status: "Picking", cust: "CUS-TBD-0035", item: "FIN-TBD-2500PM", qty: 1, so: 388, rule: R.elective, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 81, status: "Packed", cust: "CUS-TBD-0031", item: "FIN-TBD-0167PL", qty: 2, so: 387, rule: R.shipTo, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 82, status: "Quality Cleared", cust: "CUS-TBD-0044", item: "FIN-TBD-2500PM", qty: 1, so: 386, rule: R.elective, orderStatus: "In Fulfillment", noCarrier: true },
  { dlv: 88, status: "Loaded", cust: "CUS-TBD-0048", item: "FIN-TBD-1000PM", qty: 2, so: 385, rule: R.nopartial, orderStatus: "In Fulfillment", transit: 2, forceFail: true },
  { dlv: 83, status: "Loaded", cust: "CUS-TBD-0035", item: "FIN-TBD-0167PL", qty: 3, so: 383, rule: R.shipTo, orderStatus: "In Fulfillment", transit: 4, docsMissing: true },
  { dlv: 59, status: "PGI", cust: "CUS-TBD-0027", item: "FIN-TBD-1000PM", qty: 1, so: 370, rule: R.hazmat, shipDate: "2026-09-30", period: "2026-09", transit: 3, orderStatus: "Shipped", pod: "Expected" },
  { dlv: 64, status: "PGI", cust: "CUS-TBD-0017", item: "FIN-TBD-0167PL", qty: 3, so: 384, rule: R.inco, shipDate: "2026-10-07", period: "2026-10", transit: 2, orderStatus: "Shipped", pod: "Expected" },
  { dlv: 66, status: "PGI", cust: "CUS-TBD-0048", item: "FIN-TBD-2500PM", qty: 1, so: 378, rule: R.nopartial, shipDate: "2026-10-02", period: "2026-10", transit: 4, orderStatus: "Invoiced/Closed", invoicePosted: true, pod: "Expected" },
  { dlv: 67, status: "PGI", cust: "CUS-TBD-0044", item: "FIN-TBD-1000PM", qty: 2, so: 380, rule: R.elective, shipDate: "2026-10-06", period: "2026-10", transit: 5, orderStatus: "Partially Shipped", partialOf: 4, pod: "Expected" },
  { dlv: 68, status: "PGI", cust: "CUS-TBD-0031", item: "FIN-TBD-0167PL", qty: 3, so: 381, rule: R.shipTo, shipDate: "2026-10-08", period: "2026-10", transit: 2, orderStatus: "Shipped", pod: "Expected" },
  { dlv: 65, status: "PGI", cust: "CUS-TBD-0031", item: "FIN-TBD-1000PM", qty: 1, so: 381, so2: 20, rule: R.shipTo, shipDate: "2026-10-07", period: "2026-10", transit: 3, orderStatus: "Shipped", pod: "Expected", shipToOverride: "Pole yard, 18 Burdick Expressway East, Minot, ND 58701" },
  { dlv: 69, status: "PGI", cust: "CUS-TBD-0035", item: "FIN-TBD-5000SS", qty: 1, so: 382, rule: R.overdim, shipDate: "2026-10-05", period: "2026-10", transit: 2, orderStatus: "Shipped", pod: "Exception" },
  { dlv: 60, status: "Delivered/Closed", cust: "CUS-TBD-0031", item: "FIN-TBD-2500PM", qty: 2, so: 372, rule: R.elective, shipDate: "2026-09-14", period: "2026-09", transit: 3, orderStatus: "Invoiced/Closed", invoicePosted: true, pod: "Received" },
  { dlv: 61, status: "Delivered/Closed", cust: "CUS-TBD-0017", item: "FIN-TBD-0167PL", qty: 3, so: 373, rule: R.inco, shipDate: "2026-09-29", period: "2026-09", transit: 2, orderStatus: "Shipped", pod: "Received" },
  { dlv: 62, status: "Delivered/Closed", cust: "CUS-TBD-0052", item: "FIN-TBD-1000PM", qty: 1, so: 374, rule: R.shipTo, shipDate: "2026-10-01", period: "2026-10", transit: 4, orderStatus: "Shipped", pod: "Received" },
  { dlv: 63, status: "Delivered/Closed", cust: "CUS-TBD-0048", item: "FIN-TBD-5000SS", qty: 1, so: 375, rule: R.overdim, shipDate: "2026-09-08", period: "2026-09", transit: 3, orderStatus: "Invoiced/Closed", invoicePosted: true, pod: "Resolved/Closed" },
  { dlv: 58, status: "Delivered/Closed", cust: "CUS-TBD-0044", item: "FIN-TBD-0167PL", qty: 3, so: 371, rule: R.shipTo, shipDate: "2026-09-10", period: "2026-09", transit: 5, orderStatus: "Invoiced/Closed", invoicePosted: true, pod: "Received" },
  { dlv: 57, status: "Delivered/Closed", cust: "CUS-TBD-0041", item: "FIN-TBD-1000PM", qty: 2, so: 369, rule: R.hazmat, shipDate: "2026-08-20", period: "2026-08", transit: 2, orderStatus: "Invoiced/Closed", invoicePosted: true, pod: "Received" },
  { dlv: 56, status: "Delivered/Closed", cust: "CUS-TBD-0035", item: "FIN-TBD-2500PM", qty: 1, so: 368, rule: R.elective, shipDate: "2026-08-25", period: "2026-08", transit: 2, orderStatus: "Invoiced/Closed", invoicePosted: true, pod: "Resolved/Closed" },
  { dlv: 55, status: "Delivered/Closed", cust: "CUS-TBD-0027", item: "FIN-TBD-0167PL", qty: 2, so: 370, so2: 20, rule: R.shipTo, shipDate: "2026-09-18", period: "2026-09", transit: 3, orderStatus: "Shipped", pod: "Received", shipToOverride: "Pump station 2, 1410 Viebahn Street, Manitowoc, WI 54220" },
  { dlv: 41, status: "Delivered/Closed", cust: "CUS-TBD-0009", item: "FIN-TBD-1000PM", qty: 1, so: 911, year: 2025, rule: R.inco, shipDate: "2025-10-31", period: "2025-10", transit: 3, orderStatus: "Invoiced/Closed", invoicePosted: true, pod: "Received" },
]

const dlvId = (n: number) => `DLV-TBD-${String(n).padStart(4, "0")}`
const STATUS_INDEX = ["Planned", "Released", "Picking", "Packed", "Quality Cleared", "Loaded", "PGI", "Delivered/Closed"]
const atLeast = (s: string, t: string) => STATUS_INDEX.indexOf(s) >= STATUS_INDEX.indexOf(t)

function lineStatusFor(spec: DSpec): { line: string; sched: string } {
  if (spec.status === "Planned") return { line: "Open", sched: "Delivery Due" }
  if (!atLeast(spec.status, "PGI")) return { line: "Ready to Ship", sched: "Delivery Due" }
  if (spec.partialOf) return { line: "Partially Shipped", sched: "Partially Delivered" }
  if (spec.orderStatus === "Invoiced/Closed") return spec.year === 2025 ? { line: "Closed", sched: "Closed" } : { line: "Invoiced", sched: "Closed" }
  return { line: "Shipped", sched: "Delivered" }
}

function mkSched(no: number, qty: number, date: string, status: string, extra: Partial<Schedule> = {}): Schedule {
  const confirmed = !["Open", "Cancelled"].includes(status)
  return {
    no,
    reqQty: qty,
    reqDate: date,
    confQty: confirmed ? qty : undefined,
    confDate: confirmed ? date : undefined,
    constraint: confirmed ? "on-hand stock" : undefined,
    snapshot: confirmed ? SNAP : undefined,
    deliveredQty: 0,
    cancelledQty: 0,
    backorder: false,
    status,
    ...extra,
  }
}

function baseOrder(seq: number, custId: string, status: string, created: string, opts: Partial<SalesOrder> = {}, year = 2026): SalesOrder {
  const c = cust(custId)
  return {
    id: fmtSO(seq, year),
    customerId: custId,
    customerPO: `PO-${(seq * 37) % 9000 + 1000}-${c.id.slice(-2)}`,
    type: "MTS",
    directEntry: false,
    billTo: c.billTo,
    shipTo: c.shipTo,
    requestedShip: addDays(created, 14),
    incoterms: c.incoterms,
    freightTerms: c.incoterms === "EXW" ? "Customer-paid" : "PE-paid",
    billingPlan: "Single invoice at goods issue",
    currency: c.currency,
    bookedRate: c.currency === "CAD" ? "1.3600 CAD per USD" : "1.0000",
    status,
    created,
    lines: [],
    creditChecks: [],
    activity: [A(created, "Sales admin", "Order created")],
    ...opts,
  }
}

export function buildSeed(): DB {
  const orders: SalesOrder[] = []
  const deliveries: Delivery[] = []
  const hus: HU[] = []
  const serials: Serial[] = []
  const pods: POD[] = []
  let huN = 150
  let serialN = 3100
  const serialPrefix: Record<string, string> = { "FIN-TBD-2500PM": "25", "FIN-TBD-1000PM": "10", "FIN-TBD-0167PL": "01", "FIN-TBD-5000SS": "50" }
  const sscc = (n: number) => `0006141410000${String(1828 + n).padStart(5, "0")}`

  for (const s of DSPECS) {
    const c = cust(s.cust)
    const year = s.year ?? 2026
    const soId = fmtSO(s.so, year)
    const created = s.shipDate ? addDays(s.shipDate, -21) : "2026-09-24"
    const reqDate = s.shipDate ?? addDays(TODAY_SEED, 3)
    let o = orders.find((x) => x.id === soId)
    if (!o) {
      o = baseOrder(s.so, s.cust, s.orderStatus, created, {}, year)
      if (s.orderStatus === "Invoiced/Closed") {
        o.invoicePosted = true
        o.closedOn = year === 2025 ? "2025-11-14" : addDays(s.shipDate!, 1)
      }
      orders.push(o)
    }
    const ls = lineStatusFor(s)
    const lineNo = s.so2 ?? 10
    const qtyReq = s.partialOf ?? s.qty
    const sched = mkSched(10, qtyReq, reqDate, ls.sched, { peg: `Stock ${s.item}, ${c.currency === "CAD" ? WH2 : WH}`, deliveryId: dlvId(s.dlv) })
    if (atLeast(s.status, "PGI")) sched.deliveredQty = s.qty
    const line: SOLine = {
      no: lineNo,
      item: s.item,
      qty: qtyReq,
      unitPrice: priceFor(s.item, c.currency),
      priceSource: lineNo === 10 && s.so % 2 === 1 ? "Quotation" : "Price list",
      requestedShip: reqDate,
      promisedShip: reqDate,
      warehouse: c.currency === "CAD" ? WH2 : WH,
      status: ls.line,
      schedules: [sched],
    }
    o.lines.push(line)
    if (line.priceSource === "Quotation") o.quoteRef = `QT-TBD-0${s.so}-V1`

    const flags: Flags = {
      supply: "passed",
      credit: atLeast(s.status, "Released") ? "passed" : "not passed",
      quality: atLeast(s.status, "Quality Cleared") ? "passed" : "not passed",
      documents: atLeast(s.status, "Loaded") && !s.docsMissing ? "passed" : "not passed",
    }
    const hasLoad = atLeast(s.status, "Loaded")
    const d: Delivery = {
      id: dlvId(s.dlv),
      soId,
      customerId: s.cust,
      shipTo: s.shipToOverride ?? c.shipTo,
      incoterms: c.incoterms,
      status: s.status,
      rule: s.rule,
      ruleId: ruleIdFor(s.rule),
      refs: [{ soId, line: lineNo, sched: 10, qty: s.qty }],
      flags,
      permits: hasLoad && s.item === "FIN-TBD-5000SS" ? ["Oversize/overweight permit"] : [],
      equipment: hasLoad ? (s.item === "FIN-TBD-5000SS" ? "Lowboy trailer" : "Flatbed") : undefined,
      door: hasLoad ? String((s.dlv % 6) + 1) : undefined,
      slot: hasLoad ? `${s.shipDate ?? "2026-10-12"} 08:00–10:00` : undefined,
      carrier: s.noCarrier ? undefined : c.incoterms === "EXW" ? "Customer pickup (O'Hara-Bell fleet)" : "Northline Freightways",
      pro: s.noCarrier || s.docsMissing ? undefined : `PRO ${7700 + s.dlv}-${String(s.dlv * 13).padStart(4, "0")}`,
      transitDays: s.noCarrier ? undefined : s.transit,
      freight: s.noCarrier ? null : c.incoterms === "EXW" ? 0 : 1200 + s.dlv * 25,
      freightPaidBy: c.incoterms === "EXW" ? "Customer-paid" : "PE-paid",
      shipDate: s.shipDate,
      pgiId: s.shipDate ? `PGI-TBD-${String(s.dlv).padStart(4, "0")}` : undefined,
      pgiPeriod: s.period,
      irId: s.shipDate ? `IR-TBD-${String(100 + s.dlv).padStart(4, "0")}` : undefined,
      forcePgiFail: s.forceFail,
      warehouse: c.currency === "CAD" ? WH2 : WH,
      activity: [A(addDays(created, 2), "Shipping office", `Delivery created. Grouped by: ${s.rule} (${ruleIdFor(s.rule)})`)],
    }
    if (s.shipDate) d.activity.push(A(s.shipDate, "Shipping office", `Goods issue posted ${d.pgiId} in period ${s.period}. Invoice request ${d.irId} created at PGI`))
    deliveries.push(d)

    // HUs and serials, one transformer serial per primary HU
    for (let i = 0; i < s.qty; i++) {
      const sid = `PE-TBD-${serialPrefix[s.item]}-${String(serialN++).padStart(6, "0")}`
      const shipped = atLeast(s.status, "PGI")
      serials.push({ id: sid, item: s.item, status: shipped ? "Shipped" : "Reserved", deliveryId: d.id })
      let huStatus: string | null = null
      if (s.dlv === 74 && i === 0) huStatus = "Open"
      else if (atLeast(s.status, "PGI")) huStatus = "Shipped"
      else if (s.status === "Loaded") huStatus = "Loaded"
      else if (atLeast(s.status, "Packed")) huStatus = "Closed"
      if (huStatus) {
        const exp = product(s.item).huKg
        const n = huN++
        hus.push({
          id: `HU-TBD-${String(n).padStart(4, "0")}`,
          sscc: sscc(n),
          deliveryId: d.id,
          item: s.item,
          expectedKg: exp,
          actualKg: huStatus === "Open" ? undefined : Math.round(exp * 1.006),
          status: huStatus,
          labelPrinted: huStatus !== "Open",
          serial: sid,
          scaleAttempts: 0,
        })
      }
    }

    if (s.pod) {
      const exp = addDays(s.shipDate!, s.transit ?? 3)
      const p: POD = {
        id: `POD-TBD-${String(s.dlv).padStart(4, "0")}`,
        deliveryId: d.id,
        status: s.pod,
        expectedDate: exp,
        milestoneFired: s.pod !== "Expected",
        activity: [A(s.shipDate!, "Shipping office", `POD row created at Expected (ship date + ${s.transit} transit days)`)],
      }
      if (s.pod === "Received" || s.pod === "Resolved/Closed") {
        p.receiver = ["Dale Kowalczyk", "M. Tremblay", "Priya Raman", "Jon Ferreira", "S. Whitehorse"][s.dlv % 5]
        p.date = addDays(exp, s.dlv % 2)
        p.condition = s.pod === "Resolved/Closed" ? (s.dlv === 63 ? "Shortage" : "Damage") : "No damage"
        p.docName = `signed-bol-${d.id.toLowerCase()}.pdf`
        p.activity.push(A(p.date, "Shipping office", "POD recorded. Delivery/Commissioning milestone fired (once)"))
      }
      if (s.pod === "Resolved/Closed") {
        p.claim =
          s.dlv === 63
            ? { id: "CLM-TBD-0005", type: "shortage", qty: 1, carrierRef: "NF-CLM-55120", resolution: "Create redelivery" }
            : { id: "CLM-TBD-0006", type: "damage", value: 4200, carrierRef: "NF-CLM-55031", resolution: "Create credit memo request (ACC)" }
        p.notes = s.dlv === 63 ? "One accessory crate missing on arrival" : "Radiator fin bent, field-repairable"
        p.activity.push(A(addDays(p.date!, 9), "Customer service", `Claim ${p.claim.id} resolved: ${p.claim.resolution}`))
      }
      if (s.pod === "Exception") {
        p.receiver = "Ken Abernathy"
        p.date = exp
        p.condition = "Damage"
        p.notes = "Tank dented on the low-voltage side; oil seep at the drain valve. Receiver signed with exception."
        p.docName = "signed-bol-dlv-tbd-0069-exception.pdf"
        p.claim = { id: "CLM-TBD-0007", type: "damage", value: 18600, carrierRef: "NF-CLM-55311" }
        p.activity.push(A(exp, "Shipping office", "POD recorded with exception. Claim CLM-TBD-0007 opened (damage, $18,600.00)"))
      }
      pods.push(p)
    }
  }
  // order 00380 Partially Shipped: remaining 2 open on the same schedule (Partially Delivered)
  for (const o of orders) {
    const st = o.status
    o.activity.push(A(o.created, "Sales admin", "Submitted. Credit check passed (both tests)"))
    if (st !== "Confirmed") o.activity.push(A(addDays(o.created, 3), "Shipping office", `Status now ${st}`))
  }

  // ---------- extra orders (12) ----------
  const extra: SalesOrder[] = []
  // exactly at threshold, direct entry (no Sales Director item)
  extra.push(
    baseOrder(398, "CUS-TBD-0027", "Confirmed", "2026-10-05", {
      directEntry: true,
      lines: [
        { no: 10, item: "FIN-TBD-5000SS", qty: 1, unitPrice: 250000, priceSource: "Price list", requestedShip: "2026-10-20", promisedShip: "2026-10-20", warehouse: WH, status: "Open", schedules: [mkSched(10, 1, "2026-10-20", "Allocated/Pegged", { peg: `Stock FIN-TBD-5000SS, ${WH}` })] },
      ],
      activity: [
        A("2026-10-05", "Sales admin", "Direct-entry order created (no quotation)"),
        A("2026-10-05", "Sales admin", "Submitted. No Sales Director item: $250,000.00 is not above $250,000.00 (R-5)"),
        A("2026-10-05", "Sales admin", "Credit check passed (both tests). Status Confirmed"),
      ],
    }),
  )
  // above threshold, CAD, waiting for Sales Director (OQ-31)
  extra.push(
    baseOrder(405, "CUS-TBD-0044", "Submitted", "2026-10-07", {
      directEntry: true,
      lines: [
        { no: 10, item: "FIN-TBD-5000SS", qty: 1, unitPrice: 255240, priceSource: "Price list", requestedShip: "2026-11-02", warehouse: WH2, status: "Open", schedules: [mkSched(10, 1, "2026-11-02", "Open")] },
        { no: 20, item: "FIN-TBD-1000PM", qty: 1, unitPrice: 57240, priceSource: "Price list", requestedShip: "2026-11-02", warehouse: WH2, status: "Open", schedules: [mkSched(10, 1, "2026-11-02", "Open")] },
      ],
      activity: [A("2026-10-07", "Sales admin", "Direct-entry order created (no quotation)"), A("2026-10-07", "Sales admin", "Submitted. Above $250,000.00 without a quote: Sales Director approval requested (R-OM-02)")],
    }),
  )
  // ETO maximum magnitude
  extra.push(
    baseOrder(377, "CUS-TBD-0048", "In Fulfillment", "2026-06-12", {
      type: "ETO",
      quoteRef: "QT-TBD-0377-V1",
      requestedShip: "2027-03-15",
      billingPlan: "Milestone billing (ACC; not built)",
      lines: [
        { no: 10, item: "FIN-TBD-20MVA", qty: 3, unitPrice: 1284000, priceSource: "Quotation", requestedShip: "2027-03-15", promisedShip: "2027-03-15", warehouse: WH, status: "In Engineering", schedules: [mkSched(10, 3, "2027-03-15", "Confirmed", { constraint: "engineering release and test bay capacity" })] },
      ],
    }),
  )
  // MTO in production
  extra.push(
    baseOrder(389, "CUS-TBD-0052", "In Fulfillment", "2026-08-03", {
      type: "MTO",
      lines: [
        { no: 10, item: "FIN-TBD-7500MTO", qty: 1, unitPrice: priceFor("FIN-TBD-7500MTO", "CAD"), priceSource: "Price list", requestedShip: "2026-11-20", promisedShip: "2026-11-20", warehouse: WH2, status: "In Production", schedules: [mkSched(10, 1, "2026-11-20", "Confirmed", { constraint: "production order capacity (CTP)" })] },
      ],
    }),
  )
  // MTO with seeded CTP result (CTP-DLG)
  extra.push(
    baseOrder(402, "CUS-TBD-0027", "Confirmed", "2026-10-06", {
      type: "MTO",
      quoteRef: "QT-TBD-0402-V1",
      ctpSeed: true,
      lines: [
        { no: 10, item: "FIN-TBD-7500MTO", qty: 1, unitPrice: 243700, priceSource: "Quotation", requestedShip: "2026-11-30", warehouse: WH, status: "Open", schedules: [mkSched(10, 1, "2026-11-30", "Open")] },
      ],
    }),
  )
  // Credit Hold: past-due test fails (delegate allowed, under $250,000)
  extra.push(
    baseOrder(396, "CUS-TBD-0041", "Credit Hold", "2026-10-06", {
      lines: [{ no: 10, item: "FIN-TBD-0167PL", qty: 20, unitPrice: 6980, priceSource: "Price list", requestedShip: "2026-10-23", warehouse: WH, status: "Open", schedules: [mkSched(10, 20, "2026-10-23", "Open")] }],
      creditChecks: [{ at: "2026-10-06", when: "at submit", exposure: 188400, orderValue: 139600, limit: 500000, pastDue30: true, passLimit: true, passPastDue: false }],
      activity: [A("2026-10-06", "Sales admin", "Submitted. Credit check failed: invoice more than 30 days past due. Status Credit Hold")],
    }),
  )
  // Credit Hold: manual credit hold flag (Volt Co.)
  extra.push(
    baseOrder(399, "CUS-TBD-0009", "Credit Hold", "2026-10-07", {
      lines: [{ no: 10, item: "FIN-TBD-0167PL", qty: 12, unitPrice: 6980, priceSource: "Price list", requestedShip: "2026-10-21", warehouse: WH, status: "Open", schedules: [mkSched(10, 12, "2026-10-21", "Open")] }],
      creditChecks: [{ at: "2026-10-07", when: "at submit", exposure: 148900, orderValue: 83760, limit: 150000, pastDue30: false, passLimit: false, passPastDue: true }],
      activity: [A("2026-10-07", "Sales admin", "Submitted. Credit check failed: exposure + order value above limit. Customer credit hold flag set. Status Credit Hold")],
    }),
  )
  // Credit Hold over $250,000 (no delegate)
  extra.push(
    baseOrder(401, "CUS-TBD-0027", "Credit Hold", "2026-10-08", {
      lines: [{ no: 10, item: "FIN-TBD-5000SS", qty: 2, unitPrice: 186300, priceSource: "Price list", requestedShip: "2026-10-28", warehouse: WH, status: "Open", schedules: [mkSched(10, 2, "2026-10-28", "Open")] }],
      creditChecks: [{ at: "2026-10-08", when: "at submit", exposure: 812300, orderValue: 372600, limit: 1000000, pastDue30: false, passLimit: false, passPastDue: true }],
      activity: [A("2026-10-08", "Sales admin", "Submitted. Credit check failed: exposure + order value above limit. Status Credit Hold")],
    }),
  )
  // Submitted, waiting for Sales Director (USD)
  extra.push(
    baseOrder(407, "CUS-TBD-0048", "Submitted", "2026-10-08", {
      directEntry: true,
      lines: [
        { no: 10, item: "FIN-TBD-2500PM", qty: 2, unitPrice: 78400, priceSource: "Price list", requestedShip: "2026-10-30", warehouse: WH, status: "Open", schedules: [mkSched(10, 2, "2026-10-30", "Open")] },
        { no: 20, item: "FIN-TBD-1000PM", qty: 2, unitPrice: 41850, priceSource: "Price list", requestedShip: "2026-10-30", warehouse: WH, status: "Open", schedules: [mkSched(10, 2, "2026-10-30", "Open")] },
        { no: 30, item: "FIN-TBD-0167PL", qty: 4, unitPrice: 6980, priceSource: "Price list", requestedShip: "2026-10-30", warehouse: WH, status: "Open", schedules: [mkSched(10, 4, "2026-10-30", "Open")] },
      ],
      activity: [A("2026-10-08", "Sales admin", "Direct-entry order created (no quotation)"), A("2026-10-08", "Sales admin", "Submitted. Above $250,000.00 without a quote: Sales Director approval requested (R-OM-02)")],
    }),
  )
  // Draft, direct entry, customer no longer Active (error 4, E-OM-02)
  extra.push(
    baseOrder(415, "CUS-TBD-0023", "Draft", "2026-10-08", {
      directEntry: true,
      customerPO: "CVPUD-20417",
      lines: [{ no: 10, item: "FIN-TBD-1000PM", qty: 2, unitPrice: 41850, priceSource: "Price list", requestedShip: "2026-10-26", warehouse: WH, status: "Open", schedules: [mkSched(10, 2, "2026-10-26", "Open")] }],
      activity: [A("2026-10-08", "Customer service", "Direct-entry order drafted. Customer CUS-TBD-0023 was Active when drafted; now On Hold")],
    }),
  )
  // Cancelled (Finance reject, OQ-28)
  extra.push(
    baseOrder(393, "CUS-TBD-0035", "Cancelled", "2026-09-28", {
      lines: [{ no: 10, item: "FIN-TBD-2500PM", qty: 1, unitPrice: priceFor("FIN-TBD-2500PM", "CAD"), priceSource: "Price list", requestedShip: "2026-10-14", warehouse: WH2, status: "Cancelled", schedules: [mkSched(10, 1, "2026-10-14", "Cancelled", { cancelledQty: 1 })] }],
      activity: [A("2026-09-28", "Sales admin", "Submitted. Credit check failed. Status Credit Hold"), A("2026-09-30", "Finance (credit)", "Rejected by Finance (credit) on Sep 30, 2026. Status Cancelled (Reading OQ-28)")],
    }),
  )
  // Rejected (K-15): Sales Director rejected a no-quote order from Submitted
  extra.push(
    baseOrder(397, "CUS-TBD-0041", "Rejected", "2026-10-02", {
      directEntry: true,
      lines: [{ no: 10, item: "FIN-TBD-2500PM", qty: 4, unitPrice: 78400, priceSource: "Price list", requestedShip: "2026-10-22", warehouse: WH, status: "Open", schedules: [mkSched(10, 4, "2026-10-22", "Open")] }],
      activity: [A("2026-10-02", "Sales admin", "Submitted. Sales Director approval requested (R-OM-02)"), A("2026-10-05", "Sales Director", "Rejected by Sales Director on Oct 5, 2026. Status Rejected (K-15)")],
    }),
  )
  orders.push(...extra)

  // one Allocated/Pegged-but-not-delivered and Open schedules exist above; Delivered with open qty 0 exists on PGI orders.
  orders.sort((a, b) => (a.id < b.id ? 1 : -1))

  // ---------- available serials (stock) ----------
  serials.push(
    { id: "PE-TBD-25-004417", item: "FIN-TBD-2500PM", status: "Available" },
    { id: "PE-TBD-25-004418", item: "FIN-TBD-2500PM", status: "Available" },
    { id: "PE-TBD-10-002093", item: "FIN-TBD-1000PM", status: "Available" },
    { id: "PE-TBD-10-002094", item: "FIN-TBD-1000PM", status: "Available" },
    { id: "PE-TBD-10-002095", item: "FIN-TBD-1000PM", status: "Available" },
    { id: "PE-TBD-10-002096", item: "FIN-TBD-1000PM", status: "Available" },
    { id: "PE-TBD-50-000812", item: "FIN-TBD-5000SS", status: "Available" },
  )

  const quotations = buildQuotes()
  const approvals: Approval[] = [
    { id: "APR-TBD-0051", kind: "Credit Release", soId: "SO-2026-00396", amount: 139600, currency: "USD", forRoles: ["Finance (credit)", "Controller"], reason: "Credit check failed: invoice more than 30 days past due", raised: "2026-10-06" },
    { id: "APR-TBD-0052", kind: "Credit Release", soId: "SO-2026-00399", amount: 83760, currency: "USD", forRoles: ["Finance (credit)", "Controller"], reason: "Credit check failed: exposure + order value above limit; customer credit hold flag set", raised: "2026-10-07" },
    { id: "APR-TBD-0053", kind: "Credit Release", soId: "SO-2026-00401", amount: 372600, currency: "USD", forRoles: ["Finance (credit)", "Controller"], reason: "Credit check failed: exposure + order value above limit", raised: "2026-10-08" },
    { id: "APR-TBD-0054", kind: "R-OM-02 no-quote order", soId: "SO-2026-00405", amount: 312480, currency: "CAD", forRoles: ["Sales Director"], reason: "Direct-entry order above $250,000.00 without a quotation", raised: "2026-10-07" },
    { id: "APR-TBD-0055", kind: "R-OM-02 no-quote order", soId: "SO-2026-00407", amount: 268420, currency: "USD", forRoles: ["Sales Director"], reason: "Direct-entry order above $250,000.00 without a quotation", raised: "2026-10-08" },
    { id: "APR-TBD-0049", kind: "Credit Release", soId: "SO-2026-00393", amount: priceFor("FIN-TBD-2500PM", "CAD"), currency: "CAD", forRoles: ["Finance (credit)", "Controller"], reason: "Credit check failed: exposure + order value above limit", raised: "2026-09-28", decided: { text: "Rejected by Finance (credit) on Sep 30, 2026. Order set to Cancelled (Reading OQ-28)", on: "2026-09-30" } },
  ]

  return extendSeed({
    customers: structuredClone(CUSTOMERS),
    quotations,
    orders,
    deliveries,
    hus,
    serials,
    pods,
    approvals,
    atp: { "FIN-TBD-2500PM": 2, "FIN-TBD-1000PM": 4, "FIN-TBD-0167PL": 40, "FIN-TBD-5000SS": 1 },
    seq: { so: 412, dlv: 71, hu: 203, pod: 71, ir: 144, clm: 8, appr: 56 },
  })
}

const TODAY_SEED = "2026-10-09"

function buildQuotes(): Quotation[] {
  const q = (id: string, version: number, status: string, customerId: string, validUntil: string, lines: [string, number][], extra: Partial<Quotation> = {}): Quotation => {
    const c = cust(customerId)
    return {
      id,
      version,
      status,
      customerId,
      validUntil,
      lines: lines.map(([item, qty], i) => ({ no: (i + 1) * 10, item, qty, price: priceFor(item, c.currency) })),
      activity: [A(addDays(validUntil, -30), "Sales rep", `Quotation ${id} created`)],
      ...extra,
    }
  }
  const list: Quotation[] = [
    q("QT-TBD-0412-V2", 2, "Issued", "CUS-TBD-0031", "2026-10-30", [["FIN-TBD-2500PM", 3], ["FIN-TBD-1000PM", 1]], {
      predecessor: "QT-TBD-0412-V1",
      activity: [A("2026-09-28", "Sales rep", "Revised from QT-TBD-0412-V1 (quantity on line 10 changed 2 → 3)"), A("2026-09-30", "Sales rep", "Issued to customer")],
    }),
    q("QT-TBD-0412-V1", 1, "Superseded", "CUS-TBD-0031", "2026-10-15", [["FIN-TBD-2500PM", 2], ["FIN-TBD-1000PM", 1]], { successor: "QT-TBD-0412-V2" }),
    q("QT-TBD-0377-V1", 1, "Won", "CUS-TBD-0048", "2026-06-30", [["FIN-TBD-20MVA", 3]], { orderRef: "SO-2026-00377" }),
    q("QT-TBD-0402-V1", 1, "Won", "CUS-TBD-0027", "2026-10-20", [["FIN-TBD-7500MTO", 1]], { orderRef: "SO-2026-00402" }),
    q("QT-TBD-0381-V1", 1, "Won", "CUS-TBD-0031", "2026-09-30", [["FIN-TBD-0167PL", 3], ["FIN-TBD-1000PM", 1]], { orderRef: "SO-2026-00381" }),
    q("QT-TBD-0387-V1", 1, "Won", "CUS-TBD-0031", "2026-10-10", [["FIN-TBD-0167PL", 2]], { orderRef: "SO-2026-00387" }),
    q("QT-TBD-0420-V1", 1, "Superseded", "CUS-TBD-0044", "2026-10-22", [["FIN-TBD-5000SS", 1]], { successor: "QT-TBD-0420-V2" }),
    q("QT-TBD-0420-V2", 2, "Issued", "CUS-TBD-0044", "2026-11-06", [["FIN-TBD-5000SS", 1], ["FIN-TBD-0167PL", 6]], { predecessor: "QT-TBD-0420-V1" }),
    q("QT-TBD-0421-V1", 1, "Issued", "CUS-TBD-0052", "2026-11-12", [["FIN-TBD-1000PM", 2]]),
    q("QT-TBD-0422-V1", 1, "Issued", "CUS-TBD-0017", "2026-10-28", [["FIN-TBD-0167PL", 8]]),
    q("QT-TBD-0423-V1", 1, "Draft", "CUS-TBD-0060", "2026-11-20", [["FIN-TBD-2500PM", 4]]),
    q("QT-TBD-0424-V1", 1, "Draft", "CUS-TBD-0035", "2026-11-18", [["FIN-TBD-1000PM", 1]]),
    q("QT-TBD-0425-V1", 1, "Draft", "CUS-TBD-0048", "2026-11-25", [["FIN-TBD-5000SS", 2]]),
    q("QT-TBD-0416-V1", 1, "Internal Review", "CUS-TBD-0027", "2026-11-09", [["FIN-TBD-2500PM", 2], ["FIN-TBD-0167PL", 10]]),
    q("QT-TBD-0417-V1", 1, "Internal Review", "CUS-TBD-0052", "2026-11-14", [["FIN-TBD-20MVA", 1]]),
    q("QT-TBD-0418-V1", 1, "Internal Review", "CUS-TBD-0009", "2026-11-02", [["FIN-TBD-0167PL", 15]]),
    q("QT-TBD-0391-V1", 1, "Lost", "CUS-TBD-0023", "2026-09-15", [["FIN-TBD-1000PM", 3]], { lossReason: "Price: competitor about 6% lower" }),
    q("QT-TBD-0394-V1", 1, "Lost", "CUS-TBD-0041", "2026-09-22", [["FIN-TBD-5000SS", 1]], { lossReason: "Lead time: customer needed delivery within 6 weeks" }),
    q("QT-TBD-0400-V1", 1, "Lost", "CUS-TBD-0038", "2026-10-01", [["FIN-TBD-2500PM", 1]], { lossReason: "Project cancelled by customer" }),
    q("QT-TBD-0362-V1", 1, "Expired", "CUS-TBD-0011", "2026-07-31", [["FIN-TBD-0167PL", 12]]),
    q("QT-TBD-0368-V1", 1, "Expired", "CUS-TBD-0035", "2026-08-29", [["FIN-TBD-1000PM", 2]]),
    q("QT-TBD-0379-V1", 1, "Expired", "CUS-TBD-0017", "2026-09-19", [["FIN-TBD-2500PM", 1]]),
    q("QT-TBD-0419-V1", 1, "Issued", "CUS-TBD-0048", "2026-11-04", [["FIN-TBD-2500PM", 6]]),
    q("QT-TBD-0414-V1", 1, "Won", "CUS-TBD-0044", "2026-10-11", [["FIN-TBD-1000PM", 4]], { orderRef: "SO-2026-00380" }),
  ]
  return list
}
