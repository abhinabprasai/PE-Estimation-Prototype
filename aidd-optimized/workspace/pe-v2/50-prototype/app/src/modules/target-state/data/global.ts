// Broader International Localization (Book IX §9) and Carrier Integration IF-21 (DEC-04, Book IV).
// Localization: each country is an activation kit from one framework with five layers (compliance matrix, tax regime,
// documents, language, currency); a country goes live only when all five pass its checklist; the compliance matrix is
// owned by the Controller and its row is the activation trigger; the first activation follows the written playbook.
// Carrier: go-live is manual carrier selection, PRO/BOL capture, freight accrual #26 and POD capture (DEC-04); carrier API
// rating, tendering, tracking and e-POD is Phase 3 as interface IF-21; the manual path is never removed.
// Countries, rates, mandates, owners (other than the Controller) and carriers are design values.

export const LAYERS = ["Compliance matrix", "Tax regime", "Documents", "Language", "Currency"] as const
export type Layer = (typeof LAYERS)[number]
export const PLAYBOOK = ["Entity and books", "Registrations", "Regime configuration", "Template variants", "Translated texts", "Opening balances", "Statutory close simulation", "Gate"]
export interface LayerRow { status: "Not started" | "In progress" | "Passed" | "Failed"; owner: string; evidence: string[]; note: string }
export interface Country { code: string; name: string; currency: string; entity: string; layers: Record<Layer, LayerRow>; playbook: boolean[]; decision?: { outcome: "Go" | "No-go"; by: string; on: string; reason: string } }
export interface TaxRegime {
  id: string; country: string; name: string; type: "VAT" | "GST"
  rates: { cls: string; pct: number }[]; reverseCharge: boolean; importTax: string
  einvoice: { mandate: string; adapter: string; clearance: "Before invoice issue" | "Reporting after issue" | "Not required" }
  nexus: { id: string; jurisdiction: string; regNo: string; from: string }[]
  effectiveFrom: string; version: number; status: "Draft" | "Simulated" | "Released"; inForce?: number
  history: { at: string; by: string; text: string }[]
}
export interface LocState { countries: Country[]; regimes: TaxRegime[] }

export function seedLoc(): LocState {
  const L = (status: LayerRow["status"], owner: string, evidence: string[], note = ""): LayerRow => ({ status, owner, evidence, note })
  const countries: Country[] = [
    { code: "MX", name: "Mexico", currency: "MXN", entity: "New entity LE-TBD-50 (planned)",
      layers: { "Compliance matrix": L("Passed", "Controller", ["EVID-TBD-MX-01 registrations (RFC) filed", "EVID-TBD-MX-02 statutory books and filing calendar approved"]), "Tax regime": L("In progress", "Cost accountant", ["TXR-TBD-MX-IVA draft"], "Clearance by CFDI before invoice issue still to simulate"), Documents: L("In progress", "Document control", ["Template variant INV-MX draft"]), Language: L("Passed", "Customer Service Manager", ["EVID-TBD-MX-05 Spanish customer-facing texts reviewed"]), Currency: L("Not started", "Controller", []) },
      playbook: [true, true, false, false, true, false, false, false] },
    { code: "DE", name: "Germany", currency: "EUR", entity: "New entity LE-TBD-60 (planned)",
      layers: { "Compliance matrix": L("In progress", "Controller", ["EVID-TBD-DE-01 filing calendar draft"], "VAT registration pending"), "Tax regime": L("Not started", "Cost accountant", []), Documents: L("Not started", "Document control", []), Language: L("In progress", "Customer Service Manager", ["German texts 60 percent"]), Currency: L("Not started", "Controller", []) },
      playbook: [true, false, false, false, false, false, false, false] },
    { code: "IN", name: "India", currency: "INR", entity: "Not yet planned",
      layers: { "Compliance matrix": L("Failed", "Controller", ["EVID-TBD-IN-01 matrix review"], "Statutory books requirement for a branch office is unresolved"), "Tax regime": L("Not started", "Cost accountant", []), Documents: L("Not started", "Document control", []), Language: L("Not started", "Customer Service Manager", []), Currency: L("Not started", "Controller", []) },
      playbook: [false, false, false, false, false, false, false, false] },
    { code: "CA", name: "Canada (live, entity LE-TBD-30)", currency: "CAD", entity: "LE-TBD-30",
      layers: Object.fromEntries(LAYERS.map((l) => [l, L("Passed", l === "Compliance matrix" ? "Controller" : "Process owner", [`Archived checklist CHK-TBD-CA-${l.slice(0, 3).toUpperCase()}`])])) as Record<Layer, LayerRow>,
      playbook: PLAYBOOK.map(() => true), decision: { outcome: "Go", by: "Controller", on: "2026-01-12", reason: "All five layers passed; statutory period closed and reconciled; checklist archived as the template" } },
  ]
  const regimes: TaxRegime[] = [
    { id: "TXR-TBD-MX-IVA", country: "MX", name: "Mexico IVA", type: "VAT", rates: [{ cls: "Standard", pct: 16 }, { cls: "Border region", pct: 8 }, { cls: "Zero-rated export", pct: 0 }], reverseCharge: false, importTax: "IVA on import value plus duties, creditable", einvoice: { mandate: "CFDI 4.0", adapter: "ADP-TBD-CFDI", clearance: "Before invoice issue" }, nexus: [{ id: "NEX-TBD-MX-01", jurisdiction: "Mexico federal", regNo: "RFC TBD-pending", from: "2027-01-01" }], effectiveFrom: "2027-01-01", version: 1, status: "Draft", history: [{ at: "2026-10-01", by: "Cost accountant", text: "Draft created from the framework" }] },
    { id: "TXR-TBD-DE-VAT", country: "DE", name: "Germany VAT (Umsatzsteuer)", type: "VAT", rates: [{ cls: "Standard", pct: 19 }, { cls: "Reduced", pct: 7 }, { cls: "Intra-EU supply", pct: 0 }], reverseCharge: true, importTax: "Import VAT at customs, deductible as input tax", einvoice: { mandate: "EN 16931 structured invoice", adapter: "ADP-TBD-XRECH", clearance: "Reporting after issue" }, nexus: [], effectiveFrom: "2027-04-01", version: 1, status: "Draft", history: [] },
    { id: "TXR-TBD-IN-GST", country: "IN", name: "India GST", type: "GST", rates: [{ cls: "Standard 18", pct: 18 }, { cls: "Capital goods 28", pct: 28 }, { cls: "Export (LUT)", pct: 0 }], reverseCharge: true, importTax: "IGST on import value plus customs duty", einvoice: { mandate: "IRN e-invoice", adapter: "ADP-TBD-IRN", clearance: "Before invoice issue" }, nexus: [], effectiveFrom: "2027-07-01", version: 1, status: "Draft", history: [] },
    { id: "TXR-TBD-CA-GST", country: "CA", name: "Canada GST/HST (live)", type: "GST", rates: [{ cls: "GST", pct: 5 }, { cls: "HST Ontario", pct: 13 }, { cls: "Zero-rated export", pct: 0 }], reverseCharge: false, importTax: "GST at customs on import value", einvoice: { mandate: "None", adapter: "None", clearance: "Not required" }, nexus: [{ id: "NEX-TBD-CA-01", jurisdiction: "Canada federal", regNo: "BN TBD-123456789", from: "2024-01-01" }], effectiveFrom: "2024-01-01", version: 3, status: "Released", history: [{ at: "2026-01-05", by: "Controller", text: "Version 3 released after simulation" }] },
  ]
  return { countries, regimes }
}

export function simulateTax(r: TaxRegime, net: number, flow: "Domestic sale" | "Export" | "Import purchase" | "Reverse-charge purchase") {
  const std = r.rates[0]
  const lines: { label: string; base: number; pct: number; tax: number }[] = []
  if (flow === "Domestic sale") lines.push({ label: `${std.cls} ${r.type}`, base: net, pct: std.pct, tax: Math.round(net * std.pct) / 100 })
  else if (flow === "Export") lines.push({ label: r.rates.find((x) => x.pct === 0)?.cls ?? "Zero-rated", base: net, pct: 0, tax: 0 })
  else if (flow === "Import purchase") lines.push({ label: `Import ${r.type}: ${r.importTax}`, base: net, pct: std.pct, tax: Math.round(net * std.pct) / 100 })
  else lines.push({ label: r.reverseCharge ? `Reverse charge ${r.type} (self-assessed)` : "Reverse charge not configured for this regime", base: net, pct: r.reverseCharge ? std.pct : 0, tax: r.reverseCharge ? Math.round(net * std.pct) / 100 : 0 })
  return lines
}

// ---------------------------------------------------------------- carrier
export interface Carrier { id: string; name: string; scac: string; equipment: "Heavy haul" | "LTL" | "Flatbed" | "Intermodal"; base: number; perKm: number; perKg: number; transitPerKm: number; maxKg: number; vendorId?: string }
export interface CarEvent { at: string; status: string; loc: string; source: "IF-21" | "Manual" }
export interface CarShipment {
  id: string; deliveryId: string; soId: string; customerId: string; origin: string; dest: string; km: number; kg: number; overDimensional: boolean
  status: string; carrierId?: string; tender: { state: "Not tendered" | "Tendered" | "Accepted" | "Rejected" | "Expired"; rejectedBy: string[]; at?: string }
  quote?: number; pro?: string; events: CarEvent[]; epod: { state: "Expected" | "Received" | "Exception" | "Resolved/Closed"; signedBy?: string; at?: string; source?: "IF-21" | "Manual" }
}
export interface CarrierState { carriers: Carrier[]; shipments: CarShipment[] }
export function seedCarrier(): CarrierState {
  const carriers: Carrier[] = [
    { id: "CAR-TBD-01", name: "Great Plains Heavy Haul", scac: "GPHH", equipment: "Heavy haul", base: 2400, perKm: 6.1, perKg: 0.012, transitPerKm: 0.0016, maxKg: 120000, vendorId: "VEN-TBD-0116" },
    { id: "CAR-TBD-02", name: "Prairie Express LTL", scac: "PREX", equipment: "LTL", base: 180, perKm: 0.9, perKg: 0.06, transitPerKm: 0.0022, maxKg: 6000 },
    { id: "CAR-TBD-03", name: "Northline Flatbed", scac: "NLFB", equipment: "Flatbed", base: 650, perKm: 2.4, perKg: 0.02, transitPerKm: 0.0018, maxKg: 20000 },
    { id: "CAR-TBD-04", name: "Lakes Intermodal", scac: "LKIM", equipment: "Intermodal", base: 900, perKm: 1.5, perKg: 0.015, transitPerKm: 0.0035, maxKg: 40000 },
  ]
  const ev = (at: string, status: string, loc: string, source: CarEvent["source"] = "IF-21"): CarEvent => ({ at, status, loc, source })
  const shipments: CarShipment[] = [
    { id: "SHP-TBD-0031", deliveryId: "DLV-TBD-0031", soId: "SO-2026-00301", customerId: "CUS-TBD-0048", origin: "Fargo, ND", dest: "Omaha, NE", km: 930, kg: 62000, overDimensional: true, status: "Delivered/Closed", carrierId: "CAR-TBD-01", tender: { state: "Accepted", rejectedBy: [], at: "2026-08-05" }, quote: 9540, pro: "PRO 7731-4421", events: [ev("2026-08-11 07:40", "Picked up", "Fargo, ND"), ev("2026-08-12 15:10", "In transit", "Sioux Falls, SD"), ev("2026-08-14 10:05", "Delivered", "Omaha, NE")], epod: { state: "Resolved/Closed", signedBy: "Calvin Reed", at: "2026-08-14 10:05", source: "IF-21" } },
    { id: "SHP-TBD-0044", deliveryId: "DLV-TBD-0044", soId: "SO-2026-00355", customerId: "CUS-TBD-0031", origin: "Fargo, ND", dest: "Minot, ND", km: 590, kg: 8200, overDimensional: false, status: "Loaded", carrierId: "CAR-TBD-03", tender: { state: "Tendered", rejectedBy: [], at: "2026-10-09 09:00" }, quote: 2255, events: [], epod: { state: "Expected" } },
    { id: "SHP-TBD-0048", deliveryId: "DLV-TBD-0048", soId: "SO-2026-00348", customerId: "CUS-TBD-0017", origin: "Fargo, ND", dest: "Duluth, MN", km: 400, kg: 4100, overDimensional: false, status: "Packed", tender: { state: "Not tendered", rejectedBy: [] }, events: [], epod: { state: "Expected" } },
    { id: "SHP-TBD-0052", deliveryId: "DLV-TBD-0052", soId: "SO-2026-00362", customerId: "CUS-TBD-0027", origin: "Fargo, ND", dest: "Manitowoc, WI", km: 1010, kg: 5400, overDimensional: false, status: "Quality Cleared", carrierId: undefined, tender: { state: "Rejected", rejectedBy: ["CAR-TBD-02"], at: "2026-10-08 16:20" }, events: [], epod: { state: "Expected" } },
    { id: "SHP-TBD-0055", deliveryId: "DLV-TBD-0055", soId: "SO-2026-00340", customerId: "CUS-TBD-0041", origin: "Fargo, ND", dest: "Butte, MT", km: 1190, kg: 17800, overDimensional: false, status: "PGI", carrierId: "CAR-TBD-03", tender: { state: "Accepted", rejectedBy: [], at: "2026-10-07" }, quote: 3720, pro: "PRO 4410-2290", events: [ev("2026-10-08 06:50", "Picked up", "Fargo, ND"), ev("2026-10-09 11:20", "In transit", "Billings, MT")], epod: { state: "Expected" } },
  ]
  return { carriers, shipments }
}

export const quoteOf = (c: Carrier, s: Pick<CarShipment, "km" | "kg">) => Math.round(c.base + c.perKm * s.km + c.perKg * s.kg)
export const transitOf = (c: Carrier, s: Pick<CarShipment, "km">) => Math.max(1, Math.ceil(s.km * c.transitPerKm * 4))
export const eligible = (c: Carrier, s: Pick<CarShipment, "kg" | "overDimensional">) => (s.overDimensional ? c.equipment === "Heavy haul" : c.maxKg >= s.kg && c.equipment !== "Heavy haul")
