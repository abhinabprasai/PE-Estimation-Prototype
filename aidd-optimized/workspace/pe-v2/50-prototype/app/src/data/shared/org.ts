// Organisation master data shared by every module.
// Sources: four legal entities [DOC: title page; p.195 §F] (asserted); one plant at go-live
// [DOC:p.195 §F] (asserted); cost centers and profit centers [DOC: Book I Part H §1.1-1.2] (asserted);
// work centers WC-050..WC-700 with cost centers, default efficiency 85% [DOC:pp.69, 71] (asserted).
// Identifier formats for entities, plant and warehouses are placeholders (OQ-30).
// Locations and capacities are fictitious design values.

import type { CostCenter, FiscalPeriod, LegalEntity, Plant, ProfitCenter, Warehouse, WorkCenter } from "@/data/domain"

export const TODAY = "2026-10-09"
export const OPEN_PERIOD = "2026-10"

export const LEGAL_ENTITIES: LegalEntity[] = [
  { id: "LE-TBD-10", name: "PE Transformer", country: "US", currency: "USD", role: "Manufacturing entity; owns the plant" },
  { id: "LE-TBD-20", name: "PE Grid Components", country: "US", currency: "USD", role: "Merchandise business (intercompany FL-07 live at go-live)" },
  { id: "LE-TBD-30", name: "PE Power Grids", country: "CA", currency: "CAD", role: "Canadian sales and service entity" },
  { id: "LE-TBD-40", name: "Power Electronics", country: "US", currency: "USD", role: "Holding and corporate services" },
]

export const PLANTS: Plant[] = [{ id: "PL-TBD-01", name: "PE Transformer plant", entityId: "LE-TBD-10", city: "Fargo, ND" }]

export const WAREHOUSES: Warehouse[] = [
  { id: "WH-TBD-01", name: "WH-TBD-01 Fargo, ND", plantId: "PL-TBD-01", costCenterId: "CC-2000" },
  { id: "WH-TBD-02", name: "WH-TBD-02 Regina, SK", plantId: "PL-TBD-01", costCenterId: "CC-2000" },
  { id: "WH-TBD-03", name: "WH-TBD-03 Fargo spares", plantId: "PL-TBD-01", costCenterId: "CC-2000" },
]

const cc = (id: CostCenter["id"], name: string, parentId: CostCenter["parentId"], postable: boolean, pc?: ProfitCenter["id"]): CostCenter => ({
  id, name, parentId, postable, entityId: "LE-TBD-10", defaultProfitCenterId: pc, status: "Active", validFrom: "2026-01-01",
})
export const COST_CENTERS: CostCenter[] = [
  cc("CC-1000", "Manufacturing", undefined, false),
  cc("CC-1100", "Core Shop", "CC-1000", true, "PC-200"),
  cc("CC-1150", "Fabrication", "CC-1000", true, "PC-200"),
  cc("CC-1200", "Winding", "CC-1000", true, "PC-200"),
  cc("CC-1250", "Drying", "CC-1000", true, "PC-200"),
  cc("CC-1300", "Assembly", "CC-1000", true, "PC-200"),
  cc("CC-1400", "Final Assembly", "CC-1000", true, "PC-200"),
  cc("CC-1500", "Quality", "CC-1000", true, "PC-200"),
  cc("CC-1600", "Paint & Finish", "CC-1000", true, "PC-200"),
  cc("CC-1700", "Pack & Ship", "CC-1000", true, "PC-100"),
  cc("CC-2000", "Warehousing", undefined, true, "PC-900"),
  cc("CC-3000", "Engineering", undefined, true, "PC-200"),
  cc("CC-4000", "Purchasing & Materials", undefined, true, "PC-900"),
  cc("CC-5000", "Sales & Customer Service", undefined, true, "PC-100"),
  cc("CC-9000", "G&A", undefined, false),
  cc("CC-9100", "Executive", "CC-9000", true, "PC-900"),
  cc("CC-9200", "Finance", "CC-9000", true, "PC-900"),
  cc("CC-9300", "IT", "CC-9000", true, "PC-900"),
  cc("CC-9400", "HR", "CC-9000", true, "PC-900"),
  { ...cc("CC-9500", "Facilities", "CC-9000", true, "PC-900"), status: "Blocked" },
]

export const PROFIT_CENTERS: ProfitCenter[] = [
  { id: "PC-100", name: "Distribution Transformers", scope: "Pad-mount and pole-type product families", status: "Active", priceFloorPct: 22 },
  { id: "PC-200", name: "Power Transformers", scope: "Medium and large power units", status: "Active" },
  { id: "PC-300", name: "Grid Components", scope: "PE Grid Components merchandise business", status: "Active", priceFloorPct: 18 },
  { id: "PC-400", name: "Service & Repair", scope: "Billable repair, field service, testing services", status: "Active" },
  { id: "PC-900", name: "Corporate / Unassigned", scope: "Pending classification; target zero balance", status: "Active" },
]

const wc = (id: WorkCenter["id"], name: string, fn: string, costCenterId: WorkCenter["costCenterId"], hours = 16, extra: Partial<WorkCenter> = {}): WorkCenter => ({
  id, name, function: fn, costCenterId, capacityHoursPerDay: hours, efficiencyPct: 85, status: "Active", ...extra,
})
export const WORK_CENTERS: WorkCenter[] = [
  wc("WC-050", "Tank Fabrication & Welding", "Steel cutting, forming, welding, pressure test of tanks, radiator fit-up", "CC-1150"),
  wc("WC-100", "Core Cutting", "CRGO slitting, cropping, mitred cutting (step-lap)", "CC-1100"),
  wc("WC-110", "Core Stacking", "Lamination stacking, core clamping, core loss pre-check", "CC-1100"),
  wc("WC-200", "LV Winding", "Foil/strip LV coils", "CC-1200"),
  wc("WC-210", "HV Winding", "Wire/CTC HV coils, layer/disc winding", "CC-1200"),
  wc("WC-220", "Coil Assembly & Sizing", "Phase assembly, sizing press, brazing", "CC-1200"),
  wc("WC-230", "Vapor Phase Drying / Oven", "Insulation drying cycles (batch resource)", "CC-1250", 24, { batchResource: true }),
  wc("WC-300", "Core & Coil Assembly", "Core-coil marriage, cleating, lead dressing, tap lead connection", "CC-1300"),
  wc("WC-310", "Tanking", "Active part into tank, gasketing, cover fit", "CC-1300"),
  wc("WC-320", "Vacuum & Oil Filling", "Vacuum cycle, degassed oil fill, standing time", "CC-1300", 24),
  wc("WC-400", "Final Assembly & Fittings", "Bushings, tap changer, radiators, conservator, cabinet, wiring, accessories", "CC-1400"),
  wc("WC-500", "Test Lab", "Routine tests per IEEE C57.12.90; type tests when ordered", "CC-1500"),
  wc("WC-600", "Paint & Finishing", "Blast, prime, topcoat, nameplate mounting", "CC-1600", 16, { status: "Maintenance" }),
  wc("WC-700", "Packing & Shipping Prep", "Drain/gas-fill for transport, accessory crating, loading", "CC-1700"),
]

export const FISCAL_PERIODS: FiscalPeriod[] = LEGAL_ENTITIES.flatMap((e) => [
  { id: `FP-${e.id.slice(3)}-2026-08` as const, entityId: e.id, month: "2026-08", status: "Hard Close" as const },
  { id: `FP-${e.id.slice(3)}-2026-09` as const, entityId: e.id, month: "2026-09", status: "Soft Close" as const },
  { id: `FP-${e.id.slice(3)}-2026-10` as const, entityId: e.id, month: "2026-10", status: "Open" as const },
])
