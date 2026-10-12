// purchasing-finance calculations. Pure functions over this slice's state and the shared masters.
// Each rule cites its source; values the specification does not give are named as design values
// or readings where the screens show them.

import type { AvlEntry, CustomerId, ISODate, MaterialId, Vendor } from "@/data/domain"
import { routeApproval, THRESHOLDS } from "@/data/domain"
import { AVL, CUSTOMERS, MATERIALS, PROFIT_CENTERS, TODAY, VENDORS } from "@/data/shared"
import type { PurchasingFinanceState } from "./slice"
import type { CeRec, IndexRec, LlrRec, PoRec, SurchargeRec, VarianceRow, VarianceType } from "./types"

// ------------------------------------------------------------------ vendors
/** Vendors this module needs that are not in the shared master yet (requested from foundation, R-1):
 *  the intercompany partner and RFQ prospects ("AVL + prospects", Book I G §4). Fictitious. */
export const EXTRA_VENDORS: Vendor[] = [
  { id: "VEN-TBD-0120", name: "PE Grid Components (intercompany)", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["Intercompany relationship IC-10-20"], overdueScars: 0, currency: "USD", commodity: "Grid components (intercompany seller LE-TBD-20)" },
  { id: "VEN-TBD-0121", name: "Northwind Tap Changer Corp.", country: "US", onboarding: "Docs Pending", quality: "Conditional", complianceDocs: ["W-9"], overdueScars: 0, currency: "USD", commodity: "On-load tap changers (prospect)" },
  { id: "VEN-TBD-0122", name: "Hokuriku OLTC Works", country: "JP", onboarding: "Under Review", quality: "Conditional", complianceDocs: ["ISO 9001"], overdueScars: 0, currency: "USD", commodity: "On-load tap changers (prospect)" },
  { id: "VEN-TBD-0123", name: "Prairie Insulator & Bushing Co.", country: "US", onboarding: "Under Review", quality: "Conditional", complianceDocs: ["ISO 9001", "Buy America certificate"], overdueScars: 0, currency: "USD", commodity: "HV bushings (prospect)" },
  { id: "VEN-TBD-0124", name: "Great Northern Electrical Steel", country: "US", onboarding: "Draft", quality: "Conditional", complianceDocs: [], overdueScars: 0, currency: "USD", commodity: "CRGO electrical steel (prospect)" },
  { id: "VEN-TBD-0125", name: "Cuivre Saint-Laurent Ltée", country: "CA", onboarding: "Active", quality: "Approved", complianceDocs: ["ISO 9001"], overdueScars: 0, currency: "CAD", commodity: "Copper foil and strip" },
]

export function allVendors(s: PurchasingFinanceState): Vendor[] {
  return [...VENDORS, ...EXTRA_VENDORS].map((v) => {
    const o = s.vendorOverlay[v.id]
    return o ? { ...v, onboarding: o.onboarding ?? v.onboarding, quality: o.quality ?? v.quality } : v
  })
}
export const vendorOf = (s: PurchasingFinanceState, id?: string) => allVendors(s).find((v) => v.id === id)
export const vendorName = (s: PurchasingFinanceState, id?: string) => vendorOf(s, id)?.name ?? id ?? "Not recorded"

export function allAvl(s: PurchasingFinanceState): (AvlEntry & { leadDays?: number; note?: string })[] {
  return [...AVL, ...s.avlAdded].map((a) => {
    const o = s.avlOverlay[a.id]
    return o ? { ...a, status: o.status ?? a.status, priceBasis: o.priceBasis ?? a.priceBasis, leadDays: o.leadDays, note: o.note } : a
  })
}

/** Order eligibility (C-31, C-32): no PO before onboarding Active; Restricted needs a Purchasing
 *  Manager override; Disqualified hard-blocks [DOC:p.101 §2.1] (asserted). */
export function vendorEligibility(v: Vendor | undefined): { ok: boolean; needsOverride: boolean; reason?: string } {
  if (!v) return { ok: false, needsOverride: false, reason: "Vendor not found." }
  if (v.onboarding !== "Active") return { ok: false, needsOverride: false, reason: `${v.name} onboarding is ${v.onboarding}; no PO before Active (C-31).` }
  if (v.quality === "Disqualified") return { ok: false, needsOverride: false, reason: `${v.name} is Disqualified; new POs are hard-blocked (C-32).` }
  if (v.quality === "Restricted") return { ok: true, needsOverride: true, reason: `${v.name} is Restricted; a new PO needs a Purchasing Manager override (C-32).` }
  return { ok: true, needsOverride: false }
}

// ------------------------------------------------------------------ materials and money
export const material = (id?: string) => MATERIALS.find((m) => m.id === id)
export const itemText = (id?: string) => material(id)?.description ?? id ?? ""
export const stdOf = (s: PurchasingFinanceState, id: string) => s.standards[id]?.std ?? material(id)?.stdCost
export const poTotal = (p: Pick<PoRec, "lines">) => Math.round(p.lines.filter((l) => l.status !== "Cancelled").reduce((t, l) => t + l.qty * l.price, 0) * 100) / 100
export const prTotal = (lines: { qty: number; estPrice: number }[]) => Math.round(lines.reduce((t, l) => t + l.qty * l.estPrice, 0) * 100) / 100
export const ladder = (amount: number) => routeApproval("PO approval", { amount })

export function businessDaysBetween(a: ISODate, b: ISODate) {
  let n = 0
  const d = new Date(a + "T12:00:00Z")
  const end = new Date(b + "T12:00:00Z")
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) n++
  }
  return n
}
/** Unconfirmed POs older than 3 business days surface on the workbench [DOC:p.100 §G1.5] (asserted). */
export const isUnconfirmedOverdue = (p: PoRec) => p.status === "Sent" && !!p.sentOn && businessDaysBetween(p.sentOn, TODAY) > THRESHOLDS.unconfirmedPoBusinessDays

export const OPEN_PO = (p: PoRec) => !["Matched/Closed", "Cancelled", "Received"].includes(p.status)

// ------------------------------------------------------------------ LLR (Book IV §3.2)
/** Running exposure = open LLR PO value + cancellation fees [DOC:p.209 §3.2] (asserted). */
export function llrRunningExposure(s: PurchasingFinanceState, llr: LlrRec) {
  if (llr.state === "Closed") return 0
  const open = s.purchaseOrders.filter((p) => p.llrId === llr.id && p.status !== "Cancelled" && p.status !== "Matched/Closed")
  const value = open.reduce((t, p) => t + p.lines.filter((l) => l.status !== "Cancelled").reduce((u, l) => u + (l.qty - l.received) * l.price, 0), 0)
  return Math.round(value + llr.cancellationFees)
}

// ------------------------------------------------------------------ surcharges (Book I I §6.4)
export function indexAt(values: IndexRec[], index: string, month: string): IndexRec | undefined {
  return values.filter((v) => v.index === index && v.month <= month).sort((a, b) => b.month.localeCompare(a.month))[0]
}
/** surcharge = (index at pricing date - base index) x content x pass-through % */
export function surchargeFor(rule: SurchargeRec, idx: number) {
  return Math.round((idx - rule.baseValue) * rule.contentPerUnit * (rule.passThroughPct / 100) * 100) / 100
}

// ------------------------------------------------------------------ pricing service (Book I A §4.4, Book IV §5.1)
export interface SimStep {
  step: 10 | 20 | 30 | 40 | 50
  type: "PB00" | "DIS1" | "SURC" | "FRT1" | "TAX"
  label: string
  accesses: { name: string; result: string; won?: boolean }[]
  value: number | null
  note?: string
}
export interface SimResult {
  ok: boolean
  error?: string
  steps: SimStep[]
  source?: string
  base: number
  net: number
  cost?: number
  marginPct?: number
  floorPct?: number
  pcId?: string
  floorVerdict: "Above floor" | "Below floor" | "No floor stated" | "No standard cost"
  pointsBelow?: number
}
export function simulatePrice(
  s: PurchasingFinanceState,
  inp: { customerId: CustomerId; itemId: MaterialId; qty: number; date: ISODate; manual?: number; discountPct?: number },
): SimResult {
  const cust = CUSTOMERS.find((c) => c.id === inp.customerId)
  const item = material(inp.itemId)
  const steps: SimStep[] = []
  const acc: SimStep["accesses"] = []
  let base: number | undefined
  let source: string | undefined
  // 1) manual override
  if (inp.manual != null && inp.manual > 0) {
    acc.push({ name: "1 Manual override", result: `entered ${inp.manual}`, won: true })
    base = inp.manual
    source = "Manual"
  } else acc.push({ name: "1 Manual override", result: "not entered" })
  // 2) customer-specific price valid on the pricing date
  const agr = s.agreements.flatMap((a) => a.rows.map((r) => ({ a, r }))).find(({ r }) => r.customerId === inp.customerId && r.itemId === inp.itemId && r.validFrom <= inp.date && (!r.validTo || r.validTo >= inp.date))
  if (base == null && agr) {
    acc.push({ name: "2 Customer agreement", result: `${agr.a.id} row ${agr.r.price}`, won: true })
    base = agr.r.price
    source = "Customer Agreement"
  } else acc.push({ name: "2 Customer agreement", result: agr ? `${agr.a.id} row ${agr.r.price} (not reached)` : "no valid row" })
  // 3) price list assigned to the customer
  const pl = s.priceLists.find((p) => p.id === cust?.priceListId)
  const plRow = pl?.status === "Active" ? pl.rates.filter((r) => r.itemId === inp.itemId && r.validFrom <= inp.date).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] : undefined
  if (base == null && plRow) {
    acc.push({ name: `3 Price list ${pl!.id}`, result: `rate ${plRow.price} (no quantity breaks on this list)`, won: true })
    base = plRow.price
    source = "Price List"
  } else acc.push({ name: `3 Price list ${cust?.priceListId ?? "none"}`, result: plRow ? `rate ${plRow.price} (not reached)` : pl ? `${pl.status}, no row for the item` : "no list assigned" })
  // 4) item default
  if (base == null && item?.listPrice != null) {
    const conv = cust?.currency === "CAD" ? 1.36 : 1
    acc.push({ name: "4 Item default", result: `fixed ${Math.round(item.listPrice * conv)}`, won: true })
    base = Math.round(item.listPrice * conv)
    source = "Item Default"
  } else acc.push({ name: "4 Item default", result: base == null ? "no fixed price or markup method" : "not reached" })
  if (base == null) {
    steps.push({ step: 10, type: "PB00", label: "Base price", accesses: acc, value: null })
    return { ok: false, error: `E-SAL-01 No valid price for item ${inp.itemId} / customer ${cust?.name ?? inp.customerId} on ${inp.date}`, steps, base: 0, net: 0, floorVerdict: "No standard cost" }
  }
  steps.push({ step: 10, type: "PB00", label: "Base price", accesses: acc, value: base, note: `Price Source = ${source}` })
  // 20 discount: one DIS1 per line
  const disc = inp.discountPct ? Math.round(base * (inp.discountPct / 100) * 100) / 100 : 0
  steps.push({ step: 20, type: "DIS1", label: "Discount", accesses: [{ name: "Line entry within role limit", result: inp.discountPct ? `${inp.discountPct}%` : "none" }], value: disc ? -disc : 0, note: "One DIS1 per line; stacked discounts prohibited" })
  // 30 surcharge
  const month = inp.date.slice(0, 7)
  const rules = s.surchargeRules.filter((r) => r.itemIds.includes(inp.itemId))
  let sur = 0
  const surAcc = rules.map((r) => {
    const iv = indexAt(s.indexValues, r.index, month)
    const v = iv ? surchargeFor(r, iv.value) : 0
    sur += v
    return { name: `${r.id} ${r.commodity}`, result: iv ? `(${iv.value} - ${r.baseValue}) x ${r.contentPerUnit} ${r.contentUnit} x ${r.passThroughPct}% = ${v.toFixed(2)}` : "no index value", won: true }
  })
  steps.push({ step: 30, type: "SURC", label: "Commodity surcharge", accesses: surAcc.length ? surAcc : [{ name: "Surcharge rule", result: "none for this item" }], value: Math.round(sur * 100) / 100 })
  // 40 freight
  const inc = cust?.incoterms ?? "DAP"
  steps.push({ step: 40, type: "FRT1", label: "Freight", accesses: [{ name: `Incoterms ${inc}`, result: inc === "DAP" ? "estimated pass-through (accrual basis)" : "included, no element" }], value: 0, note: "Never buried in PB00; margin excludes pass-through freight" })
  // 50 tax
  steps.push({ step: 50, type: "TAX", label: "Tax", accesses: [{ name: "External engine", result: cust?.taxProfile.exempt ? "exempt profile" : "estimate at quote / SO save; committed at invoice" }], value: null, note: "Not computed in the simulation" })
  const net = Math.round((base - disc + sur) * 100) / 100
  const cost = stdOf(s, inp.itemId) ?? s.costEstimates.find((c) => c.itemId === inp.itemId && c.status === "Released")?.total
  const pcId = item?.profitCenterId
  const floorPct = PROFIT_CENTERS.find((p) => p.id === pcId)?.priceFloorPct
  if (cost == null) return { ok: true, steps, source, base, net, pcId, floorPct, floorVerdict: "No standard cost" }
  const marginPct = Math.round(((net - sur - cost) / (net - sur)) * 1000) / 10
  if (floorPct == null) return { ok: true, steps, source, base, net, cost, marginPct, pcId, floorVerdict: "No floor stated" }
  const below = marginPct < floorPct
  return { ok: true, steps, source, base, net, cost, marginPct, pcId, floorPct, floorVerdict: below ? "Below floor" : "Above floor", pointsBelow: below ? Math.round((floorPct - marginPct) * 10) / 10 : undefined }
}

// ------------------------------------------------------------------ variances (Part A §8)
export const VARIANCE_TYPES: { code: VarianceType; name: string; account: string; when: string }[] = [
  { code: "PPV", name: "Purchase Price Variance", account: "5210 vs 2110", when: "GRN completion (standard-cost items)" },
  { code: "IPV", name: "Invoice Price Variance", account: "5210 (IPV) vs 2110", when: "Three-way match posting (ACC 6)" },
  { code: "MUV", name: "Material Usage Variance", account: "5220 vs 1320", when: "Production order settlement" },
  { code: "LRV", name: "Labor Rate Variance", account: "5230 vs 1320", when: "WO settlement" },
  { code: "LEV", name: "Labor Efficiency Variance", account: "5240 vs 1320", when: "WO settlement" },
  { code: "OAV", name: "Overhead Absorption Variance", account: "5250 vs 1320", when: "WO settlement" },
  { code: "SPV", name: "Subcontract Price Variance", account: "5260 vs 2110", when: "Subcontract GRN / invoice" },
  { code: "RVV", name: "Revaluation", account: "5330 vs 1310/1330", when: "Standard cost release" },
]
export const sumVar = (rows: VarianceRow[]) => Math.round(rows.reduce((t, r) => t + r.variance, 0) * 100) / 100
export const sumStd = (rows: VarianceRow[]) => Math.round(rows.reduce((t, r) => t + r.stdBasis, 0) * 100) / 100

export const ceComponents = (c: CeRec) => [
  { k: "Material", v: c.material },
  { k: "Labor", v: c.labor },
  { k: "Overhead", v: c.overhead },
  { k: "Subcontract", v: c.subcontract },
]

export function nextId(s: PurchasingFinanceState, prefix: string, width = 4) {
  s.seq += 1
  return `${prefix}${String(s.seq).padStart(width, "0")}`
}
