// Material master shared by every module, across all nine material types
// RAW, SEMI, FIN, TRADE, PACK, SPARE, CONS, SERV, NSTK [DOC:p.137 §2.1] (asserted).
// Lifecycle uses S-42 verbatim; function-specific blocks are chips (S-43, C-49).
// The six FIN-TBD-* items are the FL-09 product table (same IDs, prices and standard costs).
// Descriptions, prices and costs are fictitious design values.

import type { Material, MaterialType } from "@/data/domain"

type Row = [Material["id"], MaterialType, string, string, Material["status"], Material["profitCenterId"], number | undefined, number | undefined, Partial<Material>?]
const ROWS: Row[] = [
  // ---- FIN: finished goods (FL-09 product table)
  ["FIN-TBD-2500PM", "FIN", "Three-phase pad-mount transformer, 2,500 kVA, 12.47 kV - 480Y/277 V", "EA", "Active", "PC-100", 61200, 78400, { serialProfileId: "SP-FIN" }],
  ["FIN-TBD-1000PM", "FIN", "Three-phase pad-mount transformer, 1,000 kVA, 13.2 kV - 208Y/120 V", "EA", "Active", "PC-100", 32640, 41850, { serialProfileId: "SP-FIN" }],
  ["FIN-TBD-0167PL", "FIN", "Single-phase pole-mount transformer, 167 kVA, 7.2 kV - 120/240 V", "EA", "Active", "PC-100", 5410, 6980, { serialProfileId: "SP-FIN" }],
  ["FIN-TBD-5000SS", "FIN", "Secondary unit substation transformer, liquid-filled, 5 MVA, 34.5 kV - 4.16 kV", "EA", "Active", "PC-200", 149900, 186300, { serialProfileId: "SP-FIN" }],
  ["FIN-TBD-20MVA", "FIN", "Substation power transformer, ONAN/ONAF, 20 MVA, 115 kV - 13.8 kV (ETO)", "EA", "Active", "PC-200", undefined, 1284000, { serialProfileId: "SP-FIN" }],
  ["FIN-TBD-7500MTO", "FIN", "Pad-mount transformer, stainless tank, 7.5 MVA, 24.94 kV - 600Y/347 V (MTO)", "EA", "Active", "PC-200", undefined, 243700, { serialProfileId: "SP-FIN" }],
  ["FIN-TBD-0050PL", "FIN", "Single-phase pole-mount transformer, 50 kVA (legacy design)", "EA", "Obsolete", "PC-100", 2100, 2690],
  // ---- SEMI: made in-house
  ["SEMI-TBD-CORE20", "SEMI", "Stacked core, step-lap, 20 MVA three-limb", "EA", "Active", "PC-200", 96400, undefined, { serialProfileId: "SP-SEMI" }],
  ["SEMI-TBD-HVC20", "SEMI", "HV disc winding, 115 kV, per phase", "EA", "Active", "PC-200", 38750, undefined, { serialProfileId: "SP-SEMI" }],
  ["SEMI-TBD-LVC20", "SEMI", "LV foil winding, 13.8 kV, per phase", "EA", "Active", "PC-200", 21300, undefined, { serialProfileId: "SP-SEMI" }],
  ["SEMI-TBD-TANK20", "SEMI", "Fabricated main tank with radiator headers, 20 MVA", "EA", "Active", "PC-200", 58200, undefined],
  ["SEMI-TBD-CORE25", "SEMI", "Stacked core, 2,500 kVA pad-mount", "EA", "Data Completion", "PC-100", undefined, undefined],
  // ---- RAW: purchased, batch-managed by default
  ["RAW-TBD-CRGO23", "RAW", "CRGO electrical steel coil, 0.23 mm, grade M-OH", "KG", "Active", "PC-200", 3.85, undefined, { batchFlag: true }],
  ["RAW-TBD-CTC", "RAW", "Continuously transposed copper conductor, epoxy bonded", "KG", "Active", "PC-200", 13.4, undefined, { batchFlag: true }],
  ["RAW-TBD-FOIL", "RAW", "Copper foil, 1.0 mm x 600 mm", "KG", "Active", "PC-100", 12.1, undefined, { batchFlag: true }],
  ["RAW-TBD-OIL", "RAW", "Transformer mineral oil, inhibited, bulk", "L", "Active", "PC-200", 1.92, undefined, { batchFlag: true }],
  ["RAW-TBD-KRAFT", "RAW", "Thermally upgraded kraft insulation paper", "KG", "Active", "PC-200", 8.6, undefined, { batchFlag: true }],
  ["RAW-TBD-PLATE", "RAW", "Tank steel plate, A572 Gr. 50, 12 mm", "KG", "Active", "PC-200", 1.35, undefined, { batchFlag: true }],
  ["RAW-TBD-BSH145", "RAW", "HV condenser bushing, 145 kV, 800 A", "EA", "Active", "PC-200", 18900, undefined, { batchFlag: true, serialProfileId: "SP-COMP" }],
  ["RAW-TBD-BSH015", "RAW", "LV bushing, 15 kV, 3,000 A", "EA", "Restricted", "PC-200", 1240, undefined, { batchFlag: true }],
  ["RAW-TBD-OLTC", "RAW", "On-load tap changer, 115 kV class, 17 positions", "EA", "Active", "PC-200", 74500, undefined, { serialProfileId: "SP-COMP" }],
  ["RAW-TBD-RAD", "RAW", "Radiator panel bank, 520 mm, hot-dip galvanized", "EA", "Active", "PC-200", 2380, undefined],
  ["RAW-TBD-CT600", "RAW", "Bushing current transformer, 600:5 MR", "EA", "Draft", "PC-200", undefined, undefined],
  // ---- TRADE: resold merchandise (PE Grid Components)
  ["TRADE-TBD-FCI", "TRADE", "Faulted circuit indicator, overhead", "EA", "Active", "PC-300", 64, 112],
  ["TRADE-TBD-ARR", "TRADE", "Distribution surge arrester, 10 kV MCOV", "EA", "Active", "PC-300", 88, 149],
  ["TRADE-TBD-ELB", "TRADE", "Loadbreak elbow connector, 200 A, 15 kV", "EA", "Blocked", "PC-300", 41, 73],
  // ---- PACK: packaging
  ["PACK-TBD-SKID", "PACK", "Heavy skid, 20 t, heat-treated", "EA", "Active", "PC-900", 420, undefined],
  ["PACK-TBD-CRATE", "PACK", "Accessory crate, plywood, ISPM 15", "EA", "Active", "PC-900", 185, undefined],
  ["PACK-TBD-DESIC", "PACK", "Desiccant bag, 1 kg", "EA", "Active", "PC-900", 3.2, undefined],
  // ---- SPARE: spare parts sold to customers
  ["SPARE-TBD-BSH145", "SPARE", "Spare HV bushing, 145 kV, 800 A (service stock)", "EA", "Active", "PC-400", 18900, 26400],
  ["SPARE-TBD-GSKT20", "SPARE", "Gasket kit, 20 MVA main tank", "EA", "Active", "PC-400", 640, 1150],
  ["SPARE-TBD-OLTCK", "SPARE", "Tap changer contact kit", "EA", "Active", "PC-400", 3900, 6200],
  // ---- CONS: consumables
  ["CONS-TBD-WELD", "CONS", "Welding wire ER70S-6, 1.2 mm", "KG", "Active", "PC-900", 4.1, undefined],
  ["CONS-TBD-PAINT", "CONS", "Topcoat, ANSI 70 gray, polyurethane", "L", "Active", "PC-900", 22.5, undefined],
  // ---- SERV: services
  ["SERV-TBD-FIELD", "SERV", "Field service technician day", "DAY", "Active", "PC-400", 950, 1800],
  ["SERV-TBD-TEST", "SERV", "Witness and type testing service", "EA", "Active", "PC-400", 4200, 7500],
  ["SERV-TBD-GALV", "SERV", "Subcontract hot-dip galvanizing", "KG", "Active", "PC-200", 0.6, undefined],
  // ---- NSTK: non-stock
  ["NSTK-TBD-CAL", "NSTK", "Instrument calibration (non-stock purchase)", "EA", "Active", "PC-900", undefined, undefined],
  ["NSTK-TBD-PPE", "NSTK", "Shop PPE, gloves cut level A4", "EA", "Active", "PC-900", undefined, undefined],
]

const VAL_CLASS: Record<MaterialType, string> = {
  RAW: "3000 Raw materials", SEMI: "7900 Semi-finished", FIN: "7920 Finished goods", TRADE: "3100 Trading goods", PACK: "3050 Packaging",
  SPARE: "7930 Spare parts", CONS: "3040 Consumables", SERV: "n/a (non-valuated)", NSTK: "n/a (non-valuated)",
}

export const MATERIALS: Material[] = ROWS.map(([id, type, description, baseUom, status, profitCenterId, stdCost, listPrice, extra]) => ({
  id, materialNo: id, type, description, baseUom, status, profitCenterId, stdCost, listPrice,
  groups: [type === "FIN" || type === "SEMI" ? "Transformers" : type === "RAW" ? "Purchased components" : type],
  blocks: [], batchFlag: false, valuationClass: VAL_CLASS[type], ...extra,
}))

// Function-specific block chips (C-49), seeded on two Active/Restricted materials.
MATERIALS.find((m) => m.id === "RAW-TBD-BSH015")!.blocks.push({ block: "Purchasing Block", reason: "Vendor VEN-TBD-0112 restricted: two overdue SCARs", setBy: "USR-TBD-021", on: "2026-09-22" })
MATERIALS.find((m) => m.id === "TRADE-TBD-FCI")!.blocks.push({ block: "Sales Block", reason: "2027 price list not yet active", setBy: "USR-TBD-006", on: "2026-10-01" })

export const materialById = (id: string) => MATERIALS.find((m) => m.id === id)
export const MATERIAL_TYPES: MaterialType[] = ["RAW", "SEMI", "FIN", "TRADE", "PACK", "SPARE", "CONS", "SERV", "NSTK"]
