// Materials seed. Every name, number and price is a fictitious design value (GUARDRAILS 7).
// Spine documents owned here keep their exact IDs: MCR-TBD-0301, RAW-TBD-OLTC (Active),
// GRN-TBD-0301 (9 HV bushings, batch BAT-TBD-B0301, vendor batch HP-26-0412).
// Shared materials (src/data/shared/materials.ts) are referenced by ID; this slice holds only the
// materials created through MCRs in the prototype (C-47) and edits to shared ones (matEdits).

import type { Material, MaterialType, UserId, WarehouseId } from "@/data/domain"
import { MATERIALS, TODAY } from "@/data/shared"
import { addBusinessDays, MCR_TASK_MATRIX, VALUATION_CLASS } from "../lib/rules"
import type {
  AcctRow,
  ChangeEntry,
  CountDocRecord,
  CountLine,
  CustomerBuffer,
  EoPolicy,
  EoRunRecord,
  GrnRecord,
  InfoRecordRecord,
  MaterialViews,
  MchRecord,
  McrRecord,
  McrTask,
  SafetyStockRow,
  SalesPriceRow,
  SourceListRecord,
  StockRow,
  SupersessionRecord,
} from "./types"

// ------------------------------------------------------------------ people
export const U = {
  steward: "USR-TBD-020",
  mm: "USR-TBD-021",
  buyer1: "USR-TBD-039",
  buyer2: "USR-TBD-040",
  planner: "USR-TBD-028",
  planMgr: "USR-TBD-029",
  scheduler: "USR-TBD-030",
  mfgEng: "USR-TBD-025",
  whSup: "USR-TBD-019",
  whOp: "USR-TBD-018",
  receiving: "USR-TBD-017",
  qe: "USR-TBD-036",
  qm: "USR-TBD-037",
  costAcc: "USR-TBD-011",
  controller: "USR-TBD-009",
  salesAdmin: "USR-TBD-002",
  purMgr: "USR-TBD-041",
  eng: "USR-TBD-022",
  engMgr: "USR-TBD-024",
} as const satisfies Record<string, UserId>

// ------------------------------------------------------------------ materials created through MCRs in this prototype
type NewRow = [Material["id"], MaterialType, string, string, Material["status"], Material["profitCenterId"], number | undefined, number | undefined, Partial<Material>?]
const NEW_ROWS: NewRow[] = [
  ["RAW-TBD-BSH145B", "RAW", "HV condenser bushing, 145 kV, 800 A, revised flange seal", "EA", "Data Completion", "PC-200", undefined, undefined, { batchFlag: true, serialProfileId: "SP-COMP" }],
  ["RAW-TBD-ESTER", "RAW", "Natural ester dielectric fluid, bulk", "L", "Data Completion", "PC-200", undefined, undefined, { batchFlag: true }],
  ["RAW-TBD-RELAY", "RAW", "Buchholz relay, 80 mm, with alarm and trip contacts", "EA", "Data Completion", "PC-200", undefined, undefined],
  ["TRADE-TBD-ELB2", "TRADE", "Loadbreak elbow connector, 200 A, 25 kV", "EA", "Draft", "PC-300", undefined, undefined],
  ["RAW-TBD-BSH015B", "RAW", "LV bushing, 15 kV, 3,000 A, alternate design", "EA", "Active", "PC-200", 1310, undefined, { batchFlag: true }],
  ["SEMI-TBD-CORE75", "SEMI", "Stacked core, 7.5 MVA, for stainless pad-mount", "EA", "Active", "PC-200", 41800, undefined, { serialProfileId: "SP-SEMI" }],
  ["RAW-TBD-PRESS", "RAW", "Pressboard, 3 mm, high-density", "KG", "Active", "PC-200", 6.4, undefined, { batchFlag: true }],
  ["RAW-TBD-GAUGE", "RAW", "Oil level gauge, magnetic, with alarm contacts", "EA", "Active", "PC-200", 465, undefined],
  ["RAW-TBD-CUWIRE", "RAW", "Paper-insulated rectangular copper wire", "KG", "Active", "PC-200", 12.9, undefined, { batchFlag: true }],
  ["RAW-TBD-CRGO27", "RAW", "CRGO electrical steel coil, 0.27 mm, grade M-5", "KG", "Active", "PC-200", 3.62, undefined, { batchFlag: true }],
  ["FIN-TBD-0300PM", "FIN", "Three-phase pad-mount transformer, 300 kVA, 12.47 kV - 208Y/120 V", "EA", "Active", "PC-100", 14650, 18900, { serialProfileId: "SP-FIN" }],
  ["SPARE-TBD-GAUGE", "SPARE", "Spare oil temperature gauge, dial, 2 contacts", "EA", "Active", "PC-400", 520, 940],
  ["SPARE-TBD-VALVE", "SPARE", "Drain valve, 2 in, bronze (legacy)", "EA", "Obsolete", "PC-400", 85, 160],
  ["PACK-TBD-TOTE", "PACK", "Oil tote, 1,000 L, returnable", "EA", "Active", "PC-900", 310, undefined],
  ["CONS-TBD-BLADE", "CONS", "Bandsaw blades, bi-metal, 27 mm", "EA", "Active", "PC-900", 48, undefined],
  ["TRADE-TBD-CUTOUT", "TRADE", "Fused cutout, 15 kV, 100 A", "EA", "Active", "PC-300", 96, 168],
  ["SERV-TBD-ENG", "SERV", "Engineering services, design hour", "HR", "Active", "PC-400", 135, 210],
]
export const NEW_MATERIALS: Material[] = NEW_ROWS.map(([id, type, description, baseUom, status, profitCenterId, stdCost, listPrice, extra]) => ({
  id, materialNo: id, type, description, baseUom, status, profitCenterId, stdCost, listPrice,
  groups: [type], blocks: [], batchFlag: false, valuationClass: VALUATION_CLASS[type] ?? "n/a (non-valuated)", ...extra,
}))

/** Edits to shared materials (status, blocks) held in this slice and merged by ID. */
export function seedEdits(): Record<string, Partial<Material>> {
  const base = (id: string) => MATERIALS.find((m) => m.id === id)!
  return {
    "SPARE-TBD-OLTCK": { blocks: [...base("SPARE-TBD-OLTCK").blocks] },
    "SPARE-TBD-GSKT20": { blocks: [{ block: "Shipping Block", reason: "Gasket kit lot under product-level quality hold (NCR follow-up)", setBy: U.qm, on: "2026-10-03" }] },
  }
}
/** Blocks on materials created here (S-43: every block word appears at least once). */
const NEW_BLOCKS: Record<string, Material["blocks"]> = {
  "SEMI-TBD-CORE75": [{ block: "Production Block", reason: "Clamping-frame design problem under ECR-TBD-0052", setBy: U.engMgr, on: "2026-09-29" }],
  "RAW-TBD-PRESS": [{ block: "Posting Block", reason: "Valuation investigation: MAV jump after mixed-currency receipt", setBy: U.controller, on: "2026-10-06" }],
}
for (const m of NEW_MATERIALS) if (NEW_BLOCKS[m.id]) m.blocks = NEW_BLOCKS[m.id]

// ------------------------------------------------------------------ views
const GROUPS: Record<string, string[]> = {
  "RAW-TBD-CRGO23": ["CRG Core Steel", "CRGO Standard Grades", "M-OH"],
  "RAW-TBD-CRGO27": ["CRG Core Steel", "CRGO Standard Grades", "M-5"],
  "RAW-TBD-CTC": ["CU Copper & Conductors", "CTC"],
  "RAW-TBD-FOIL": ["CU Copper & Conductors", "Foil"],
  "RAW-TBD-CUWIRE": ["CU Copper & Conductors", "Wire"],
  "RAW-TBD-OIL": ["OIL Fluids", "Mineral Oil", "D3487 Type II"],
  "RAW-TBD-ESTER": ["OIL Fluids", "Ester Fluid"],
  "RAW-TBD-KRAFT": ["INS Insulation", "Kraft/Crepe"],
  "RAW-TBD-PRESS": ["INS Insulation", "Pressboard"],
  "RAW-TBD-PLATE": ["STL Steel & Fabrication", "Plate"],
  "RAW-TBD-BSH145": ["BSH Components", "Bushings", "145 kV class"],
  "RAW-TBD-BSH145B": ["BSH Components", "Bushings", "145 kV class"],
  "RAW-TBD-BSH015": ["BSH Components", "Bushings", "15 kV class"],
  "RAW-TBD-BSH015B": ["BSH Components", "Bushings", "15 kV class"],
  "RAW-TBD-OLTC": ["BSH Components", "Tap Changers", "115 kV class"],
  "RAW-TBD-RAD": ["BSH Components", "Radiators"],
  "RAW-TBD-CT600": ["BSH Components", "Relays"],
  "RAW-TBD-GAUGE": ["BSH Components", "Gauges"],
  "RAW-TBD-RELAY": ["BSH Components", "Relays"],
}
const groupFor = (m: Material): string[] => {
  if (GROUPS[m.id]) return GROUPS[m.id]
  switch (m.type) {
    case "FIN":
      return ["TX Transformers", m.description.includes("pole") || m.description.includes("Pole") ? "Pole-mount" : m.description.includes("ubstation") ? "Power" : "Pad-mount"]
    case "SEMI":
      return ["SA Sub-assemblies", m.description.includes("core") || m.description.includes("core,") ? "Cores" : m.description.includes("winding") ? "Coils" : "Tanks"]
    case "TRADE":
      return ["GC Grid Components", "Distribution accessories"]
    case "PACK":
      return ["PKG Packaging", m.description.includes("Desiccant") ? "Dunnage" : "Crates"]
    case "SPARE":
      return ["SP Service Spares", "Transformer spares"]
    case "CONS":
      return ["MRO Consumables", m.description.includes("Weld") ? "Weld" : "Shop"]
    case "SERV":
      return ["SV Services", "Services"]
    case "NSTK":
      return ["NS Non-stock", "One-time buys"]
    default:
      return ["BSH Components"]
  }
}

export function defaultViews(m: Material): MaterialViews {
  const t = m.type
  const make = t === "SEMI" || t === "FIN"
  const valuated = t !== "SERV" && t !== "NSTK"
  const raw = t === "RAW"
  return {
    materialId: m.id,
    groupPath: groupFor(m),
    legacyCode: `LG-${m.id.split("-").pop()}-${(m.id.length * 37) % 900 + 100}`,
    mfrParts: [],
    characteristics: [],
    hazardous: false,
    buyAmerica: make || raw,
    stewardId: U.steward,
    buyerId: make || t === "SERV" ? (t === "SERV" ? U.buyer2 : undefined) : m.id.includes("CU") || m.id.includes("CTC") || m.id.includes("FOIL") ? U.buyer2 : U.buyer1,
    plannerId: t === "SERV" || t === "NSTK" ? undefined : U.planner,
    altUoms: m.baseUom === "KG" ? [{ uom: "LB", num: 45359237, den: 100000000, usage: "Purchase" }] : m.baseUom === "L" ? [{ uom: "GAL", num: 3785411784, den: 1000000000, usage: "Purchase" }] : [],
    netWeight: t === "FIN" || t === "SEMI" || raw ? (m.baseUom === "EA" ? 120 : 1) : undefined,
    grossWeight: t === "FIN" || t === "SEMI" || raw ? (m.baseUom === "EA" ? 135 : 1) : undefined,
    weightUom: "KG",
    dims: t === "FIN" ? "2,150 x 1,840 x 1,960 mm" : undefined,
    hasPostings: m.status !== "Draft" && m.status !== "Data Completion",
    mrpType: t === "SERV" || t === "NSTK" ? "None" : t === "PACK" || t === "CONS" || t === "SPARE" ? "Reorder Point" : "MRP",
    procurement: make ? "Make" : "Buy",
    lotSizing: "Lot-for-Lot",
    plannedDeliveryDays: make ? undefined : raw ? 42 : 14,
    grProcDays: raw ? 3 : 1,
    inHouseDays: make ? 20 : undefined,
    fenceDays: make ? 10 : undefined,
    backflush: t === "PACK",
    issueMethod: make ? "Staged Kit" : raw ? "Direct Issue" : undefined,
    strategy: make ? (m.id.includes("20MVA") || m.id.includes("MTO") ? "MTO/ETO" : "MTS") : undefined,
    abc: (m.stdCost ?? 0) > 10000 ? "A" : (m.stdCost ?? 0) > 100 ? "B" : "C",
    xyz: make ? "Z" : "Y",
    reorderPoint: t === "PACK" || t === "CONS" || t === "SPARE" ? 6 : undefined,
    maxStock: t === "PACK" || t === "CONS" || t === "SPARE" ? 24 : undefined,
    purchUom: m.baseUom === "KG" ? "LB" : undefined,
    moq: raw && m.baseUom === "KG" ? 1000 : undefined,
    overTolPct: raw ? 5 : 0,
    underTolPct: raw ? 5 : 0,
    grBasedIv: true,
    sourcePolicy: make ? undefined : "AVL Rank",
    qualityClauses: raw ? ["Q1", "Q3"] : [],
    taxCategory: make ? undefined : "Taxable purchase",
    schedulerId: make ? U.scheduler : undefined,
    issueWarehouse: make ? "WH-TBD-01" : undefined,
    batchSize: make ? 1 : undefined,
    serializationAt: t === "FIN" ? "WO Release" : t === "SEMI" ? "FG Receipt" : undefined,
    batchAt: undefined,
    mbomRef: m.id === "FIN-TBD-20MVA" ? "MBOM-TBD-0301" : undefined,
    routingRef: m.id === "FIN-TBD-20MVA" ? "RTG-TBD-20MVA rev B" : undefined,
    defaultWarehouse: t === "SPARE" ? "WH-TBD-03" : valuated ? "WH-TBD-01" : undefined,
    defaultBin: valuated ? `${t === "SPARE" ? "S" : "A"}-${(m.id.length * 7) % 40 + 10}-0${(m.id.length % 4) + 1}` : undefined,
    putaway: valuated ? (raw ? "Zone by Group" : "Next Empty") : undefined,
    picking: valuated ? (m.batchFlag ? "FIFO" : t === "FIN" ? "Serial-Directed" : "FIFO") : undefined,
    storage: m.id.includes("OIL") || m.id.includes("ESTER") ? ["Oil Containment"] : t === "PACK" ? ["Outdoor Allowed"] : ["Indoor Dry"],
    qiReceipt: raw || make,
    qiProduction: make ? true : undefined,
    certs: m.id.includes("CRGO") ? ["Mill Cert per Heat"] : m.id.includes("OIL") || m.id.includes("ESTER") ? ["CoA"] : raw ? ["CoC per Shipment"] : [],
    vendorQualReq: raw,
    batchReqs: m.id.includes("CRGO") ? ["Heat # mandatory", "Vendor batch mandatory"] : m.batchFlag ? ["Vendor batch mandatory"] : [],
    plans: raw ? [`IP-TBD-INC-${m.id.split("-").pop()}`] : make ? ["IP-TBD-FT-20MVA"] : [],
    valuationClass: VALUATION_CLASS[t],
    method: valuated ? (make ? "Standard" : m.id.includes("CRGO") || m.id === "RAW-TBD-CTC" ? "Standard" : "Moving Average") : undefined,
    priceUnit: m.baseUom === "KG" ? 100 : 1,
    overheadGroup: valuated ? (raw ? "MOH-RAW" : "MOH-STD") : undefined,
    costingLotSize: make ? 1 : undefined,
    doNotCost: false,
    prevStd: m.stdCost != null && make ? Math.round(m.stdCost * 0.97) : undefined,
    futureStd: m.stdCost != null && make ? Math.round(m.stdCost * 1.031) : undefined,
    sellable: t === "FIN" || t === "TRADE" || t === "SERV" || (t === "SPARE" && m.listPrice != null),
    salesUom: t === "FIN" || t === "TRADE" || t === "SERV" || t === "SPARE" ? m.baseUom : undefined,
    salesTaxCategory: t === "FIN" || t === "TRADE" || t === "SPARE" ? "Taxable goods" : t === "SERV" ? "Taxable service" : undefined,
    warrantyMonths: t === "FIN" ? 24 : t === "SPARE" ? 12 : undefined,
    priceLists: t === "FIN" ? ["PL-PRC-2026-DIST"] : t === "TRADE" ? ["PL-PRC-2026-GC"] : t === "SPARE" ? ["PL-PRC-2026-SVC"] : [],
    documents: make ? [{ id: `DOC-TBD-${m.id.split("-").pop()}-DWG`, title: "Assembly drawing", status: "Released" }] : [],
    whereUsed: [],
  }
}

/** Per-material overrides on the defaults (hero thread and every status case). */
const VIEW_OVERRIDES: Record<string, Partial<MaterialViews>> = {
  "RAW-TBD-OLTC": {
    mfrParts: [{ manufacturer: "Rheinwerk Tap Changers GmbH", mpn: "RTC-V3-17-115", preferred: true }],
    characteristics: [{ key: "Voltage class", value: "115 kV" }, { key: "Positions", value: "17" }, { key: "Rated current", value: "600 A" }],
    hts: "8536.50", coo: "DE", plannedDeliveryDays: 140, sourcePolicy: "RFQ Always", method: "Moving Average",
    longText: "On-load tap changer, vacuum type, 17 positions, for 115 kV class power transformers. Supplied per STP-000301.",
    whereUsed: [{ ref: "EBOM-TBD-0301", kind: "EBOM line 40", note: "rev B" }, { ref: "MBOM-TBD-0301", kind: "MBOM line 40" }, { ref: "EBOM-TBD-0377", kind: "EBOM line 40", note: "phase 2 rev A" }],
    documents: [{ id: "STP-000301", title: "Supplier technical package, OLTC, version 1", status: "Released" }],
  },
  "RAW-TBD-BSH145": {
    mfrParts: [{ manufacturer: "Hanseong Porcelain & Polymer", mpn: "HPP-COND-145-800", preferred: true }],
    characteristics: [{ key: "Voltage class", value: "145 kV" }, { key: "Rated current", value: "800 A" }, { key: "BIL", value: "650 kV" }],
    hts: "8546.20", coo: "KR", plannedDeliveryDays: 84,
    whereUsed: [{ ref: "EBOM-TBD-0301", kind: "EBOM line 50", note: "3 per unit" }, { ref: "MBOM-TBD-0301", kind: "MBOM line 50" }, { ref: "EBOM-TBD-0377", kind: "EBOM line 50", note: "under review after RCL-2026-001" }, { ref: "IP-TBD-INC-BSH", kind: "Inspection plan", note: "rev 2" }],
  },
  "RAW-TBD-BSH145B": {
    mfrParts: [{ manufacturer: "Hanseong Porcelain & Polymer", mpn: "HPP-COND-145-800-R2", preferred: true }],
    characteristics: [{ key: "Voltage class", value: "145 kV" }],
    plannedDeliveryDays: undefined, sourcePolicy: undefined, taxCategory: undefined, putaway: undefined, picking: undefined,
    valuationClass: undefined, method: undefined, hasPostings: false,
    whereUsed: [{ ref: "EBOM-TBD-0377", kind: "EBOM placeholder line 50", note: "replaces RAW-TBD-BSH145 after the recall" }],
  },
  "RAW-TBD-ESTER": {
    groupPath: ["OIL Fluids", "Ester Fluid"], valuationClass: "VC-3010", method: undefined, plannedDeliveryDays: 28, sourcePolicy: "AVL Rank",
    putaway: undefined, picking: undefined, hasPostings: false, characteristics: [{ key: "Standard", value: "IEEE C57.147" }],
  },
  "RAW-TBD-RELAY": { hasPostings: false, characteristics: [{ key: "Pipe size", value: "80 mm" }] },
  "TRADE-TBD-ELB2": {
    stewardId: undefined, plannerId: undefined, buyerId: undefined, sourcePolicy: undefined, taxCategory: undefined, putaway: undefined, picking: undefined,
    valuationClass: undefined, method: undefined, salesUom: undefined, salesTaxCategory: undefined, hasPostings: false, mfrParts: [{ manufacturer: "Not recorded", mpn: "LBE-25-200", preferred: false }],
  },
  "RAW-TBD-CT600": { plannerId: undefined, sourcePolicy: undefined, putaway: undefined, picking: undefined, valuationClass: undefined, method: undefined, hasPostings: false },
  "SEMI-TBD-CORE25": { schedulerId: undefined, issueWarehouse: undefined, putaway: undefined, picking: undefined, hasPostings: false },
  "FIN-TBD-20MVA": {
    characteristics: [{ key: "Rating", value: "20 MVA ONAN/ONAF" }, { key: "Primary", value: "115 kV" }, { key: "Secondary", value: "13.8 kV" }, { key: "Tap changer", value: "OLTC, 17 positions" }],
    dims: "6,800 x 4,100 x 5,300 mm", netWeight: 48200, grossWeight: 61500,
    whereUsed: [{ ref: "SO-2026-00301", kind: "Sales order line 10" }, { ref: "SO-2026-00377", kind: "Sales order line 10" }, { ref: "PV-TBD-0301", kind: "Production version" }],
    documents: [{ id: "DOC-TBD-0301-GA", title: "General arrangement drawing, rev C", status: "Released" }],
  },
  "RAW-TBD-CRGO23": { sourcePolicy: "Source List Fixed", characteristics: [{ key: "Thickness", value: "0.23 mm" }, { key: "Grade", value: "M-OH" }] },
  "RAW-TBD-OIL": { hazardous: false, volume: "Bulk, by tank", specialProc: "Consignment" },
  "RAW-TBD-PLATE": { specialProc: "Subcontracting" },
  "PACK-TBD-DESIC": { shelfLifeDays: 730, picking: "FEFO" },
  "TRADE-TBD-FCI": { qiReceipt: false },
  "SPARE-TBD-BSH145": { doNotCost: false },
}

/** View data for a newly reserved number: only the requester's General data exists; every other
 *  department fills its view through its MCR task (§4.2). */
export function emptyViews(m: Material, groupPath: string[]): MaterialViews {
  const d = defaultViews(m)
  return {
    ...d, groupPath, legacyCode: undefined, stewardId: undefined, buyerId: undefined, plannerId: undefined, netWeight: undefined, grossWeight: undefined, dims: undefined, hasPostings: false,
    plannedDeliveryDays: undefined, sourcePolicy: undefined, taxCategory: undefined, schedulerId: undefined, issueWarehouse: undefined, putaway: undefined, picking: undefined,
    valuationClass: undefined, method: undefined, salesUom: undefined, salesTaxCategory: undefined, reorderPoint: undefined, maxStock: undefined, whereUsed: [], documents: [],
  }
}

/** Fields each MCR task fills when its owner completes it (the department completes its view). */
export const TASK_FIELDS: Record<string, (keyof MaterialViews)[]> = {
  "General + classification + UoM": ["stewardId", "legacyCode", "netWeight", "grossWeight", "dims"],
  "Planning (MRP)": ["plannerId", "mrpType", "procurement", "lotSizing", "reorderPoint", "maxStock", "grProcDays", "inHouseDays", "fenceDays", "strategy"],
  "Purchasing + first Info Record": ["buyerId", "plannedDeliveryDays", "sourcePolicy", "taxCategory", "purchUom", "moq"],
  Production: ["schedulerId", "issueWarehouse", "batchSize", "serializationAt", "issueMethod"],
  Warehouse: ["defaultWarehouse", "defaultBin", "putaway", "picking", "storage"],
  "Quality (+ inspection plan check)": ["qiReceipt", "certs", "batchReqs", "plans"],
  "Accounting & Costing": ["valuationClass", "method", "priceUnit", "overheadGroup", "costingLotSize"],
  "Sales (when sellable)": ["sellable", "salesUom", "salesTaxCategory", "warrantyMonths"],
}

export function seedViews(all: Material[]): Record<string, MaterialViews> {
  const out: Record<string, MaterialViews> = {}
  for (const m of all) out[m.id] = { ...defaultViews(m), ...VIEW_OVERRIDES[m.id] }
  return out
}

// ------------------------------------------------------------------ MCRs
const mkTasks = (type: MaterialType, created: string, doneUpTo: number, opts: { buyComplete?: boolean; qi?: boolean; sellable?: boolean } = {} ): McrTask[] => {
  const owners: Record<string, UserId> = {
    "Material steward": U.steward, Planner: U.planner, Buyer: U.buyer1, "Manufacturing engineer": U.mfgEng, "Warehouse supervisor": U.whSup, "Quality engineer": U.qe, "Cost accountant": U.costAcc, "Sales admin": U.salesAdmin,
  }
  const rows = MCR_TASK_MATRIX.filter((r) => r.applies(type, { qi: true, sellable: true, ...opts }))
  return rows.map((r, i) => ({
    id: `T${i + 1}`,
    view: r.view,
    ownerRole: r.role,
    ownerUserId: owners[r.role],
    slaDue: addBusinessDays(created, 2),
    done: i < doneUpTo,
    doneOn: i < doneUpTo ? addBusinessDays(created, 1 + (i % 2)) : undefined,
    doneBy: i < doneUpTo ? owners[r.role] : undefined,
    after: r.view === "Accounting & Costing" ? ["Planning (MRP)", "Purchasing + first Info Record"] : undefined,
  }))
}

export function seedMcrs(): McrRecord[] {
  const act = (at: string, by: string, text: string) => ({ at, by, text })
  const m = (r: Omit<McrRecord, "open">): McrRecord => ({ ...r, open: r.stage !== "Activated" && r.stage !== "Withdrawn" })
  return [
    // hero thread: the OLTC placeholder from ER-TBD-0301, completed 2026-02-02
    m({
      id: "MCR-TBD-0301", materialId: "RAW-TBD-OLTC", originRef: { type: "engineeringRequest", id: "ER-TBD-0301" }, requestedType: "RAW",
      description: "On-load tap changer, 115 kV class, 17 positions", path: "Engineering Placeholder", stage: "Activated", createdOn: "2026-01-20", createdBy: U.eng,
      group: "BSH Components / Tap Changers", uom: "EA", estCost: 78000, targetVendor: "VEN-TBD-0103 Rheinwerk Tap Changers", activatedOn: "2026-02-02", activatedBy: U.mm,
      tasks: mkTasks("RAW", "2026-01-20", 99),
      activity: [
        act("2026-01-20", "Engineer", "Placeholder part created in EBOM-TBD-0301 rev A; number RAW-TBD-OLTC reserved; tasks generated"),
        act("2026-01-27", "Buyer", "Purchasing task done; first info record IRC-004206 from RFQ-TBD-0301 award"),
        act("2026-02-02", "Materials Manager", "Activated after V-MM-01; EBOM placeholder flag cleared"),
      ],
    }),
    // phase 2: replacement bushing after the recall, open with tasks running
    m({
      id: "MCR-TBD-0377", materialId: "RAW-TBD-BSH145B", originRef: { type: "engineeringRequest", id: "ER-TBD-0377" }, requestedType: "RAW",
      description: "HV condenser bushing, 145 kV, 800 A, revised flange seal", path: "Engineering Placeholder", stage: "Tasks open", createdOn: "2026-10-07", createdBy: U.eng,
      group: "BSH Components / Bushings", uom: "EA", estCost: 19650, targetVendor: "VEN-TBD-0104 Hanseong (revised seal design)",
      duplicateNote: "Not a duplicate of RAW-TBD-BSH145: revised flange seal changes form-fit; supersession planned (SUP-2026-0014)",
      tasks: mkTasks("RAW", "2026-10-07", 2),
      activity: [act("2026-10-07", "Engineer", "Placeholder created from EBOM-TBD-0377 line 50 after RCL-2026-001; duplicate warning answered")],
    }),
    m({
      id: "MCR-TBD-0412", materialId: "RAW-TBD-ESTER", requestedType: "RAW", description: "Natural ester dielectric fluid, bulk", path: "Purchasing Initiated", stage: "Tasks open",
      createdOn: "2026-10-01", createdBy: U.buyer1, group: "OIL Fluids / Ester Fluid", uom: "L", estCost: 4.8,
      tasks: mkTasks("RAW", "2026-10-01", 3),
      activity: [act("2026-10-01", "Buyer", "Requested for the Lakeshore Municipal retrofit enquiry; proposes valuation class VC-3010 (fluids split)")],
    }),
    m({
      id: "MCR-TBD-0409", materialId: "SEMI-TBD-CORE25", requestedType: "SEMI", description: "Stacked core, 2,500 kVA pad-mount", path: "Engineering Placeholder", stage: "Tasks open",
      originRef: { type: "engineeringRequest", id: "ER-TBD-0366" }, createdOn: "2026-09-22", createdBy: U.eng, group: "SA Sub-assemblies / Cores", uom: "EA", estCost: 9800,
      tasks: mkTasks("SEMI", "2026-09-22", 2),
      activity: [act("2026-09-22", "Engineer", "Placeholder from the 2,500 kVA redesign; tasks generated")],
    }),
    m({
      id: "MCR-TBD-0414", materialId: "RAW-TBD-RELAY", requestedType: "RAW", description: "Buchholz relay, 80 mm, with alarm and trip contacts", path: "Purchasing Initiated", stage: "Ready to activate",
      createdOn: "2026-10-02", createdBy: U.buyer2, group: "BSH Components / Relays", uom: "EA", estCost: 610,
      tasks: mkTasks("RAW", "2026-10-02", 99),
      activity: [act("2026-10-02", "Buyer", "Requested: second source for protection relays"), act("2026-10-08", "Cost accountant", "Accounting & Costing done; all tasks complete")],
    }),
    m({
      id: "MCR-TBD-0415", materialId: "TRADE-TBD-ELB2", requestedType: "TRADE", description: "Loadbreak elbow connector, 200 A, 25 kV", path: "Sales Initiated", stage: "Draft",
      createdOn: "2026-10-08", createdBy: U.salesAdmin, group: "GC Grid Components / Distribution accessories", uom: "EA",
      tasks: mkTasks("TRADE", "2026-10-08", 0, { qi: false }),
      activity: [act("2026-10-08", "Sales admin", "Draft: number reserved; not yet submitted for completion")],
    }),
    m({
      id: "MCR-TBD-0420", materialId: "RAW-TBD-CT600", requestedType: "RAW", description: "Bushing current transformer, 600:5 MR", path: "Engineering Placeholder", stage: "Draft",
      originRef: { type: "engineeringRequest", id: "ER-TBD-0377" }, createdOn: "2026-10-07", createdBy: U.eng, group: "BSH Components / Relays", uom: "EA",
      tasks: mkTasks("RAW", "2026-10-07", 0),
      activity: [act("2026-10-07", "Engineer", "Draft placeholder; vendor VEN-TBD-0115 still in onboarding")],
    }),
    m({
      id: "MCR-TBD-0298", materialId: "RAW-TBD-BSH015B", requestedType: "RAW", description: "LV bushing, 15 kV, 3,000 A, alternate design", path: "Purchasing Initiated", stage: "Activated",
      createdOn: "2026-08-24", createdBy: U.buyer1, group: "BSH Components / Bushings", uom: "EA", activatedOn: "2026-09-01", activatedBy: U.mm,
      tasks: mkTasks("RAW", "2026-08-24", 99), activity: [act("2026-09-01", "Materials Manager", "Activated; successor for SUP-2026-0011")],
    }),
    m({
      id: "MCR-TBD-0285", materialId: "SEMI-TBD-CORE75", requestedType: "SEMI", description: "Stacked core, 7.5 MVA, for stainless pad-mount", path: "Engineering Placeholder", stage: "Activated",
      originRef: { type: "engineeringRequest", id: "ER-TBD-0352" }, createdOn: "2026-07-14", createdBy: U.eng, group: "SA Sub-assemblies / Cores", uom: "EA", activatedOn: "2026-07-23", activatedBy: U.mm,
      tasks: mkTasks("SEMI", "2026-07-14", 99), activity: [act("2026-07-23", "Materials Manager", "Activated")],
    }),
    m({
      id: "MCR-TBD-0279", materialId: "RAW-TBD-PRESS", requestedType: "RAW", description: "Pressboard, 3 mm, high-density", path: "Purchasing Initiated", stage: "Activated",
      createdOn: "2026-06-29", createdBy: U.buyer1, group: "INS Insulation / Pressboard", uom: "KG", activatedOn: "2026-07-03", activatedBy: U.mm,
      tasks: mkTasks("RAW", "2026-06-29", 99), activity: [act("2026-07-03", "Materials Manager", "Activated")],
    }),
    m({
      id: "MCR-TBD-0271", materialId: "RAW-TBD-GAUGE", requestedType: "RAW", description: "Oil level gauge, magnetic, with alarm contacts", path: "Purchasing Initiated", stage: "Activated",
      createdOn: "2026-06-08", createdBy: U.buyer2, group: "BSH Components / Gauges", uom: "EA", activatedOn: "2026-06-17", activatedBy: U.mm,
      tasks: mkTasks("RAW", "2026-06-08", 99), activity: [act("2026-06-17", "Materials Manager", "Activated")],
    }),
    m({
      id: "MCR-TBD-0266", materialId: "FIN-TBD-0300PM", requestedType: "FIN", description: "Three-phase pad-mount transformer, 300 kVA", path: "Sales Initiated", stage: "Activated",
      createdOn: "2026-05-18", createdBy: U.salesAdmin, group: "TX Transformers / Pad-mount", uom: "EA", activatedOn: "2026-06-02", activatedBy: U.mm,
      tasks: mkTasks("FIN", "2026-05-18", 99), activity: [act("2026-06-02", "Materials Manager", "Activated after standard cost release")],
    }),
    m({
      id: "MCR-TBD-0262", materialId: "SPARE-TBD-GAUGE", requestedType: "SPARE", description: "Spare oil temperature gauge", path: "Sales Initiated", stage: "Activated",
      createdOn: "2026-05-04", createdBy: U.salesAdmin, group: "SP Service Spares", uom: "EA", activatedOn: "2026-05-08", activatedBy: U.mm,
      tasks: mkTasks("SPARE", "2026-05-04", 99), activity: [act("2026-05-08", "Materials Manager", "Activated")],
    }),
    m({
      id: "MCR-TBD-0255", materialId: "RAW-TBD-CUWIRE", requestedType: "RAW", description: "Paper-insulated rectangular copper wire", path: "Purchasing Initiated", stage: "Activated",
      createdOn: "2026-04-13", createdBy: U.buyer2, group: "CU Copper & Conductors / Wire", uom: "KG", activatedOn: "2026-04-21", activatedBy: U.mm,
      tasks: mkTasks("RAW", "2026-04-13", 99), activity: [act("2026-04-21", "Materials Manager", "Activated")],
    }),
    m({
      id: "MCR-TBD-0248", materialId: "TRADE-TBD-CUTOUT", requestedType: "TRADE", description: "Fused cutout, 15 kV, 100 A", path: "Sales Initiated", stage: "Activated",
      createdOn: "2026-03-30", createdBy: U.salesAdmin, group: "GC Grid Components", uom: "EA", activatedOn: "2026-04-06", activatedBy: U.mm,
      tasks: mkTasks("TRADE", "2026-03-30", 99, { qi: false }), activity: [act("2026-04-06", "Materials Manager", "Activated")],
    }),
    m({
      id: "MCR-TBD-0402", requestedType: "RAW", description: "Kraft paper, thermally upgraded, 0.08 mm", path: "Purchasing Initiated", stage: "Withdrawn",
      createdOn: "2026-09-15", createdBy: U.buyer1, group: "INS Insulation / Kraft/Crepe", uom: "KG",
      tasks: mkTasks("RAW", "2026-09-15", 0),
      activity: [act("2026-09-15", "Buyer", "Requested"), act("2026-09-16", "Materials Manager", "Withdrawn: confirmed duplicate of RAW-TBD-KRAFT (similarity 0.93); Draft number released")],
    }),
  ]
}

// ------------------------------------------------------------------ change history (immutable)
export function seedHistory(): ChangeEntry[] {
  return [
    { materialId: "RAW-TBD-OLTC", field: "Status", old: "Data Completion", new: "Active", by: U.mm, at: "2026-02-02", source: "MCR-TBD-0301" },
    { materialId: "RAW-TBD-OLTC", field: "Planned delivery time (days)", old: "120", new: "140", by: U.planner, at: "2026-03-10", source: "Screen (Planning view)" },
    { materialId: "RAW-TBD-BSH015", field: "Status", old: "Active", new: "Restricted", by: U.mm, at: "2026-09-02", source: "SUP-2026-0011" },
    { materialId: "RAW-TBD-BSH015", field: "Purchasing Block", old: "", new: "set", by: U.purMgr, at: "2026-09-22", source: "Screen (Set block)" },
    { materialId: "RAW-TBD-CTC", field: "Buyer", old: "Olivia Grant", new: "Ahmed Karimi", by: U.steward, at: "2026-08-03", source: "MCH-2026-0031" },
    { materialId: "RAW-TBD-FOIL", field: "Buyer", old: "Olivia Grant", new: "Ahmed Karimi", by: U.steward, at: "2026-08-03", source: "MCH-2026-0031" },
    { materialId: "FIN-TBD-0050PL", field: "Status", old: "Restricted", new: "Obsolete", by: U.mm, at: "2026-03-31", source: "SUP-2026-0007" },
    ...MATERIALS.filter((m) => m.status === "Active").slice(0, 12).map((m) => ({ materialId: m.id, field: "Record", old: "", new: "Loaded", by: U.steward, at: "2025-12-12", source: "Migration (mock load 2)" })),
  ]
}

// ------------------------------------------------------------------ MCH
export function seedMchs(): MchRecord[] {
  return [
    {
      id: "MCH-2026-0031", title: "Copper group: reassign buyer to Ahmed Karimi", stage: "Applied", fieldKey: "buyerId", fieldClass: 1, mode: "Set", apply: "Immediate",
      approvalRefs: [], rows: [
        { materialId: "RAW-TBD-CTC", field: "Buyer", old: "Olivia Grant", new: "Ahmed Karimi", appliedAt: "2026-08-03" },
        { materialId: "RAW-TBD-FOIL", field: "Buyer", old: "Olivia Grant", new: "Ahmed Karimi", appliedAt: "2026-08-03" },
      ], excluded: [], reason: "Commodity split: copper moves to the second buyer", createdOn: "2026-08-03", createdBy: U.steward,
      log: ["2026-08-03 row RAW-TBD-CTC applied", "2026-08-03 row RAW-TBD-FOIL applied"], activity: [{ at: "2026-08-03", by: "Material steward", text: "Class 1 change applied by the owner role" }],
    },
    {
      id: "MCH-2026-0034", title: "CRGO planned delivery time 42 to 56 days (mill allocation)", stage: "Scheduled", fieldKey: "plannedDeliveryDays", fieldClass: 1, mode: "Set", apply: "Effective-dated", effective: "2026-11-02",
      approvalRefs: [], rows: [
        { materialId: "RAW-TBD-CRGO23", field: "Planned delivery time (days)", old: "42", new: "56" },
        { materialId: "RAW-TBD-CRGO27", field: "Planned delivery time (days)", old: "42", new: "56" },
      ], excluded: [], reason: "Northstar mill allocation for Q4", createdOn: "2026-10-06", createdBy: U.planner, log: [], activity: [{ at: "2026-10-06", by: "Planner", text: "Scheduled for 2026-11-02" }],
    },
    {
      id: "MCH-2026-0036", title: "Spare parts to profit center PC-400 (Service & Repair)", stage: "Draft", fieldKey: "profitCenterId", fieldClass: 2, mode: "Set", apply: "Immediate",
      approvalRefs: [], rows: [
        { materialId: "PACK-TBD-SKID", field: "Profit center", old: "PC-900", new: "PC-400" },
        { materialId: "PACK-TBD-CRATE", field: "Profit center", old: "PC-900", new: "PC-400" },
      ], excluded: [], reason: "Clear PC-900 fallback (DQ-dashboard exception)", createdOn: "2026-10-08", createdBy: U.costAcc, log: [], activity: [{ at: "2026-10-08", by: "Cost accountant", text: "Simulated; ready to send for approval" }],
    },
    {
      id: "MCH-2026-0029", title: "Trading goods to Standard valuation", stage: "Rejected", fieldKey: "method", fieldClass: 2, mode: "Set", apply: "Effective-dated", effective: "2026-10-01",
      approvalRefs: ["APR-TBD-0071"], rows: [
        { materialId: "TRADE-TBD-FCI", field: "Valuation method", old: "Moving Average", new: "Standard" },
        { materialId: "TRADE-TBD-ARR", field: "Valuation method", old: "Moving Average", new: "Standard" },
      ], excluded: [], reason: "PPV visibility on resale items", createdOn: "2026-09-10", createdBy: U.costAcc, log: [],
      activity: [{ at: "2026-09-12", by: "Materials Manager", text: "Rejected: method change needs a released standard first (§5.4)" }],
    },
    {
      id: "MCH-2026-0027", title: "Packaging and consumables to Reorder Point planning", stage: "Applied with errors", fieldKey: "mrpType", fieldClass: 2, mode: "Set", apply: "Immediate",
      approvalRefs: ["APR-TBD-0066"], rows: [
        { materialId: "PACK-TBD-DESIC", field: "MRP type", old: "MRP", new: "Reorder Point", appliedAt: "2026-08-20" },
        { materialId: "CONS-TBD-WELD", field: "MRP type", old: "MRP", new: "Reorder Point", appliedAt: "2026-08-20" },
      ], excluded: [{ materialId: "NSTK-TBD-PPE", reason: "V-MM-07: NSTK is forced to MRP type None" }], reason: "Consumption-based planning for low-value stock", createdOn: "2026-08-18", createdBy: U.planner,
      log: ["2026-08-20 row PACK-TBD-DESIC applied", "2026-08-20 row CONS-TBD-WELD applied", "2026-08-20 row NSTK-TBD-PPE excluded: V-MM-07"], activity: [{ at: "2026-08-20", by: "Materials Manager", text: "Approved; applied with one excluded row" }],
    },
  ]
}

// ------------------------------------------------------------------ supersessions
export function seedSupersessions(): SupersessionRecord[] {
  return [
    {
      id: "SUP-2026-0014", predecessorId: "RAW-TBD-BSH145", successorId: "RAW-TBD-BSH145B", policy: "Immediate", effective: "2026-10-20", relationship: "One-for-One", stage: "Draft",
      originRef: "CAPA-TBD-0015 / ER-TBD-0377", reason: "Flange seal escape in vendor batch HP-26-0412 (RCL-2026-001); revised seal design", disposition: "Return to vendor", startQty: 6, createdOn: "2026-10-06",
      tasks: [
        { id: "K1", doc: "EBOM-TBD-0377", kind: "BOM line", action: "Flip line 50 to RAW-TBD-BSH145B per ECO effectivity", done: false },
        { id: "K2", doc: "BAT-TBD-B0301", kind: "Stock", action: "Disposition 6 blocked bushings: return to vendor via the recall", done: false },
        { id: "K3", doc: "SPARE-TBD-BSH145", kind: "Service spares", action: "Review spare bushing stock against the recall population", done: false },
      ],
      activity: [{ at: "2026-10-06", by: "Materials Manager", text: "Draft from the recall CAPA; waits for the successor MCR-TBD-0377" }],
    },
    {
      id: "SUP-2026-0011", predecessorId: "RAW-TBD-BSH015", successorId: "RAW-TBD-BSH015B", policy: "Use-up", effective: "2026-09-02", relationship: "One-for-One", stage: "Approved, run-out",
      originRef: "MCH-2026-0024", reason: "Sole vendor VEN-TBD-0112 restricted after two overdue SCARs", startQty: 48, createdOn: "2026-08-28", approvedOn: "2026-09-02",
      tasks: [
        { id: "K1", doc: "PO-TBD-0288", kind: "Open PO", action: "Buyer: receive and close (12 EA in transit)", done: false },
        { id: "K2", doc: "MBOM-TBD-1000PM", kind: "BOM line", action: "Flip LV bushing line when predecessor stock is exhausted", done: false },
        { id: "K3", doc: "Customer part xref CUS-TBD-0031", kind: "Sales xref", action: "Carry customer part number to the successor", done: true },
      ],
      activity: [{ at: "2026-08-28", by: "Materials Manager", text: "Created" }, { at: "2026-09-02", by: "Materials Manager", text: "Approved; predecessor Active to Restricted" }],
    },
    {
      id: "SUP-2026-0007", predecessorId: "FIN-TBD-0050PL", successorId: "FIN-TBD-0167PL", policy: "Use-up", effective: "2026-02-01", relationship: "One-for-One", stage: "Closed",
      originRef: "ECO-TBD-0019", reason: "Legacy 50 kVA design retired; demand moves to 167 kVA platform", startQty: 14, createdOn: "2026-01-20", approvedOn: "2026-01-28", closedOn: "2026-03-31",
      tasks: [{ id: "K1", doc: "PL-PRC-2026-DIST", kind: "Price row", action: "End price row", done: true }],
      activity: [{ at: "2026-03-31", by: "Materials Manager", text: "Closed: V-MM-20 met (zero stock, no open documents); predecessor Obsolete" }],
    },
  ]
}

// ------------------------------------------------------------------ stock
export function seedStock(): StockRow[] {
  let n = 0
  const s = (materialId: string, qty: number, status: StockRow["status"], opts: Partial<StockRow> = {}): StockRow => ({
    id: `STK-${String(++n).padStart(4, "0")}`, materialId: materialId as Material["id"], warehouseId: "WH-TBD-01", bin: `A-${10 + (n % 30)}-0${(n % 4) + 1}`, status, qty, bucket: "Own", lastMovement: "2026-09-28", ...opts,
  })
  return [
    // hero: remaining six bushings of GRN-TBD-0301, Blocked by recall containment, pegged to phase 2
    s("RAW-TBD-BSH145", 6, "Blocked", { bin: "B-04-02", batchId: "BAT-TBD-B0301", serials: ["SN-TBD-BSH-0304", "SN-TBD-BSH-0305", "SN-TBD-BSH-0306", "SN-TBD-BSH-0307", "SN-TBD-BSH-0308", "SN-TBD-BSH-0309"], bucket: "SO-Pegged", pegRef: "SO-2026-00377", grnId: "GRN-TBD-0301", lastMovement: "2026-10-02" }),
    s("RAW-TBD-BSH145", 1, "Quarantine", { bin: "RMA-01", batchId: "BAT-TBD-B0301", serials: ["SN-TBD-BSH-0302"], pegRef: "RMA-TBD-0012", lastMovement: "2026-09-29" }),
    s("RAW-TBD-OLTC", 0, "Unrestricted", { bin: "B-06-01", lastMovement: "2026-06-12", grnId: "GRN-TBD-0298" }),
    s("RAW-TBD-CRGO23", 38500, "Unrestricted", { bin: "C-01-01", batchId: "BAT-TBD-C0911", lastMovement: "2026-10-07" }),
    s("RAW-TBD-CRGO23", 14200, "QI Hold", { bin: "QI-02", batchId: "BAT-TBD-C1006", grnId: "GRN-TBD-1006", lastMovement: "2026-10-06" }),
    s("RAW-TBD-CRGO27", 9800, "Unrestricted", { bin: "C-03-02", batchId: "BAT-TBD-C0312", lastMovement: "2025-03-18" }),
    s("RAW-TBD-CTC", 6400, "Unrestricted", { bin: "D-02-01", batchId: "BAT-TBD-K0920", lastMovement: "2026-10-01" }),
    s("RAW-TBD-FOIL", 3100, "Unrestricted", { bin: "D-04-01", batchId: "BAT-TBD-F0815", lastMovement: "2026-09-21" }),
    s("RAW-TBD-CUWIRE", 2250, "Unrestricted", { bin: "D-05-02", batchId: "BAT-TBD-W0902", lastMovement: "2026-09-30" }),
    s("RAW-TBD-OIL", 42000, "Unrestricted", { bin: "TANK-01", batchId: "BAT-TBD-O0904", lastMovement: "2026-10-05" }),
    s("RAW-TBD-OIL", 18000, "Unrestricted", { bin: "TANK-02", batchId: "BAT-TBD-O0919", bucket: "Consignment", pegRef: "VEN-TBD-0105", lastMovement: "2026-09-19" }),
    s("RAW-TBD-KRAFT", 1850, "Unrestricted", { bin: "E-01-03", batchId: "BAT-TBD-P0828", lastMovement: "2026-09-25" }),
    s("RAW-TBD-PRESS", 940, "Unrestricted", { bin: "E-02-01", batchId: "BAT-TBD-P0710", lastMovement: "2026-09-18" }),
    s("RAW-TBD-PLATE", 21500, "Unrestricted", { bin: "F-01-01", batchId: "BAT-TBD-S0908", lastMovement: "2026-09-29" }),
    s("RAW-TBD-PLATE", 6200, "Unrestricted", { warehouseId: "WH-TBD-01", bin: "SUB-VEN-0106", batchId: "BAT-TBD-S0915", bucket: "At Subcontractor", pegRef: "VEN-TBD-0106", lastMovement: "2026-09-15" }),
    s("RAW-TBD-BSH015", 18, "Unrestricted", { bin: "B-02-03", batchId: "BAT-TBD-L0612", lastMovement: "2026-09-24" }),
    s("RAW-TBD-BSH015B", 30, "Unrestricted", { bin: "B-02-04", batchId: "BAT-TBD-L0918", lastMovement: "2026-09-18" }),
    s("RAW-TBD-RAD", 64, "Unrestricted", { bin: "G-01-01", lastMovement: "2026-09-26" }),
    s("RAW-TBD-GAUGE", 22, "Unrestricted", { bin: "B-08-01", lastMovement: "2026-09-09" }),
    s("SEMI-TBD-CORE20", 1, "Unrestricted", { bin: "WIP-STG-1", serials: ["SN-TBD-CORE-0377A"], bucket: "SO-Pegged", pegRef: "SO-2026-00377", lastMovement: "2026-10-04" }),
    s("SEMI-TBD-CORE75", 2, "Unrestricted", { bin: "WIP-STG-2", lastMovement: "2026-08-30" }),
    s("FIN-TBD-2500PM", 3, "Unrestricted", { bin: "Y-01-01", lastMovement: "2026-09-30" }),
    s("FIN-TBD-1000PM", 5, "Unrestricted", { bin: "Y-01-02", lastMovement: "2026-10-02" }),
    s("FIN-TBD-0167PL", 26, "Unrestricted", { bin: "Y-02-01", lastMovement: "2026-10-03" }),
    s("FIN-TBD-0300PM", 1, "QI Hold", { bin: "QI-01", serials: ["SN-TBD-0300-0012"], lastMovement: "2026-10-08" }),
    s("TRADE-TBD-FCI", 420, "Unrestricted", { warehouseId: "WH-TBD-02", bin: "R-01-01", lastMovement: "2026-09-12" }),
    s("TRADE-TBD-ARR", 260, "Unrestricted", { warehouseId: "WH-TBD-02", bin: "R-01-02", lastMovement: "2026-09-27" }),
    s("TRADE-TBD-ELB", 140, "Blocked", { warehouseId: "WH-TBD-02", bin: "R-02-01", lastMovement: "2024-08-14" }),
    s("TRADE-TBD-CUTOUT", 85, "Unrestricted", { warehouseId: "WH-TBD-02", bin: "R-02-02", lastMovement: "2026-09-02" }),
    s("TRADE-TBD-CUTOUT", 40, "Unrestricted", { warehouseId: "WH-TBD-02", bin: "TRANSIT", bucket: "In-Transit", pegRef: "WH-TBD-01 to WH-TBD-02", lastMovement: "2026-10-08" }),
    s("PACK-TBD-SKID", 14, "Unrestricted", { bin: "YARD-01", lastMovement: "2026-09-30" }),
    s("PACK-TBD-CRATE", 36, "Unrestricted", { bin: "YARD-02", lastMovement: "2026-03-02" }),
    s("PACK-TBD-DESIC", 380, "Unrestricted", { bin: "H-01-01", lastMovement: "2026-09-29" }),
    s("PACK-TBD-TOTE", 12, "Unrestricted", { bin: "YARD-03", lastMovement: "2026-09-10" }),
    s("SPARE-TBD-BSH145", 2, "Unrestricted", { warehouseId: "WH-TBD-03", bin: "S-01-01", lastMovement: "2025-01-21" }),
    s("SPARE-TBD-GSKT20", 3, "Unrestricted", { warehouseId: "WH-TBD-03", bin: "S-02-01", lastMovement: "2026-10-01" }),
    s("SPARE-TBD-OLTCK", 4, "Unrestricted", { warehouseId: "WH-TBD-03", bin: "S-02-02", lastMovement: "2026-07-18" }),
    s("SPARE-TBD-GAUGE", 9, "Unrestricted", { warehouseId: "WH-TBD-03", bin: "S-03-01", lastMovement: "2025-09-30" }),
    s("SPARE-TBD-GAUGE", 2, "Unrestricted", { warehouseId: "WH-TBD-02", bin: "R-05-01", lastMovement: "2026-08-11" }),
    s("CONS-TBD-WELD", 320, "Unrestricted", { bin: "M-01-01", lastMovement: "2026-10-07" }),
    s("CONS-TBD-PAINT", 640, "Unrestricted", { bin: "FLAM-01", lastMovement: "2026-10-06" }),
    s("CONS-TBD-BLADE", 26, "Unrestricted", { bin: "M-02-01", lastMovement: "2026-09-23" }),
    s("FIN-TBD-7500MTO", 1, "Unrestricted", { bin: "Y-03-01", bucket: "Customer Property", pegRef: "CUS-TBD-0041 repair unit", lastMovement: "2026-09-17" }),
  ]
}

export function seedGrns(): GrnRecord[] {
  return [
    {
      id: "GRN-TBD-0301", poId: "PO-TBD-0302", vendorId: "VEN-TBD-0104", on: "2026-05-04",
      lines: [{ materialId: "RAW-TBD-BSH145", qty: 9, batchId: "BAT-TBD-B0301", vendorBatch: "HP-26-0412", serials: Array.from({ length: 9 }, (_, i) => `SN-TBD-BSH-030${i + 1}`), status: "QI Hold", value: 170100 }],
      note: "SP-01 PO scan, SP-02 batch label, SP-03 nine serials; QI Hold to Unrestricted after IL-TBD-0301 (accepted 2026-05-05); 3 issued to WO-TBD-0301 at WC-400; 6 now Blocked by RCL-2026-001",
    },
    {
      id: "GRN-TBD-0298", poId: "PO-TBD-0301", vendorId: "VEN-TBD-0103", on: "2026-03-27",
      lines: [{ materialId: "RAW-TBD-OLTC", qty: 1, serials: ["SN-TBD-OLTC-0301"], status: "QI Hold", value: 74500 }],
      note: "Issued to WO-TBD-0301 at WC-400 on 2026-06-12",
    },
    {
      id: "GRN-TBD-1006", poId: "PO-TBD-0341", vendorId: "VEN-TBD-0101", on: "2026-10-06",
      lines: [{ materialId: "RAW-TBD-CRGO23", qty: 14200, batchId: "BAT-TBD-C1006", vendorBatch: "NS-H-88214", serials: [], status: "QI Hold", value: 54670 }],
      note: "Mill cert per heat attached; waiting for incoming inspection",
    },
  ]
}

// ------------------------------------------------------------------ info records
export function seedInfoRecords(): InfoRecordRecord[] {
  let seq = 4200
  const ir = (materialId: string, vendorId: string, price: number, leadDays: number, rows: Partial<InfoRecordRecord> & { from?: string; source?: InfoRecordRecord["priceRows"][number]["source"]; ref?: string } = {}): InfoRecordRecord => {
    const id = `IRC-00${++seq}` as InfoRecordRecord["id"]
    const from = rows.from ?? "2026-01-01"
    return {
      id, materialId: materialId as Material["id"], vendorId: vendorId as InfoRecordRecord["vendorId"], entityId: "LE-TBD-10", price, currency: "USD", leadDays, validFrom: from, priceUnit: 1,
      priceRows: [{ id: `${id}-P1`, price, validFrom: from, source: rows.source ?? "Contract", ref: rows.ref, createdBy: U.buyer1 }],
      scales: [], actuals: [], ...rows,
    }
  }
  return [
    ir("RAW-TBD-CRGO23", "VEN-TBD-0101", 3.85, 42, {
      vendorPart: "NS-MOH-023", priceUnit: 100, surcharge: "SUR-TBD-CRGO (CRGO index, content 1.0)", incoterms: "FCA Pittsburgh", freightPct: 2.5, moq: 5000, rounding: 500,
      priceRows: [
        { id: "IRC-004201-P0", price: 3.62, validFrom: "2025-07-01", validTo: "2025-12-31", source: "Contract", ref: "CTR-TBD-2025-07", createdBy: U.buyer1 },
        { id: "IRC-004201-P1", price: 3.85, validFrom: "2026-01-01", source: "Contract", ref: "CTR-TBD-2026-01", createdBy: U.buyer1 },
      ],
      scales: [{ fromQty: 10000, price: 3.79 }, { fromQty: 50000, price: 3.71 }],
      actuals: [{ kind: "Last PO", doc: "PO-TBD-0341", price: 3.85, on: "2026-09-08" }, { kind: "Last GRN", doc: "GRN-TBD-1006", price: 3.85, on: "2026-10-06" }, { kind: "Last invoice", doc: "INV-V-TBD-77120", price: 3.92, on: "2026-09-24" }],
    }),
    ir("RAW-TBD-CRGO27", "VEN-TBD-0101", 3.62, 42, { priceUnit: 100, from: "2025-03-01", actuals: [{ kind: "Last PO", doc: "PO-TBD-0118", price: 3.62, on: "2025-02-11" }] }),
    ir("RAW-TBD-CTC", "VEN-TBD-0102", 13.4, 35, {
      priceUnit: 100, surcharge: "SUR-TBD-CU (COMEX copper, content 0.92)", moq: 1000,
      actuals: [{ kind: "Last PO", doc: "PO-TBD-0329", price: 13.4, on: "2026-08-27" }, { kind: "Last GRN", doc: "GRN-TBD-0988", price: 13.4, on: "2026-09-18" }, { kind: "Last invoice", doc: "INV-V-TBD-77031", price: 14.45, on: "2026-09-30" }],
    }),
    ir("RAW-TBD-FOIL", "VEN-TBD-0102", 12.1, 35, { priceUnit: 100, from: "2025-10-01", priceRows: [{ id: "IRC-004204-P1", price: 12.1, validFrom: "2025-10-01", validTo: "2026-06-30", source: "Contract", createdBy: U.buyer2 }], validTo: "2026-06-30" }),
    ir("RAW-TBD-CUWIRE", "VEN-TBD-0102", 12.9, 35, { priceUnit: 100, source: "RFQ Award", ref: "RFQ-TBD-0255", from: "2026-04-15" }),
    ir("RAW-TBD-OLTC", "VEN-TBD-0103", 74500, 140, {
      vendorPart: "RTC-V3-17-115", source: "RFQ Award", ref: "RFQ-TBD-0301", from: "2026-01-30", incoterms: "DAP Fargo", freightPct: 3,
      actuals: [{ kind: "Last PO", doc: "PO-TBD-0301", price: 74500, on: "2026-02-10" }, { kind: "Last GRN", doc: "GRN-TBD-0298", price: 74500, on: "2026-03-27" }, { kind: "Last invoice", doc: "INV-V-TBD-74410", price: 74500, on: "2026-04-02" }],
    }),
    ir("RAW-TBD-BSH145", "VEN-TBD-0104", 18900, 84, {
      vendorPart: "HPP-COND-145-800", incoterms: "CIF Long Beach", freightPct: 4,
      actuals: [{ kind: "Last PO", doc: "PO-TBD-0302", price: 18900, on: "2026-02-12" }, { kind: "Last GRN", doc: "GRN-TBD-0301", price: 18900, on: "2026-05-04" }, { kind: "Last invoice", doc: "INV-V-TBD-75502", price: 18900, on: "2026-05-15" }],
    }),
    ir("RAW-TBD-BSH015", "VEN-TBD-0112", 1240, 30, { from: "2025-11-01", actuals: [{ kind: "Last PO", doc: "PO-TBD-0288", price: 1240, on: "2026-08-12" }] }),
    ir("RAW-TBD-BSH015", "VEN-TBD-0104", 1290, 56, { from: "2026-03-01" }),
    ir("RAW-TBD-BSH015B", "VEN-TBD-0104", 1310, 56, { source: "RFQ Award", ref: "RFQ-TBD-0298", from: "2026-08-28" }),
    ir("RAW-TBD-OIL", "VEN-TBD-0105", 1.92, 10, { purchUom: "GAL", source: "Contract", ref: "CTR-TBD-CONSIG-01", incoterms: "DAP Fargo" }),
    ir("RAW-TBD-KRAFT", "VEN-TBD-0107", 8.6, 21, {
      currency: "CAD", price: 11.7, priceUnit: 100,
      priceRows: [
        { id: "IRC-004212-P1", price: 11.7, validFrom: "2026-01-01", source: "Contract", createdBy: U.buyer1 },
        { id: "IRC-004212-P2", price: 12.65, validFrom: "2026-10-15", source: "Manual", pending: true, createdBy: U.buyer1 },
      ],
    }),
    ir("RAW-TBD-PRESS", "VEN-TBD-0107", 8.7, 21, { currency: "CAD", priceUnit: 100, source: "RFQ Award", ref: "RFQ-TBD-0279", from: "2026-07-01" }),
    ir("RAW-TBD-PLATE", "VEN-TBD-0106", 1.35, 14, { priceUnit: 100, moq: 2000 }),
    ir("RAW-TBD-RAD", "VEN-TBD-0108", 2380, 28, { from: "2025-07-15", source: "Migration", actuals: [{ kind: "Last PO", doc: "PO-TBD-0061", price: 2380, on: "2025-08-04" }] }),
    ir("RAW-TBD-GAUGE", "VEN-TBD-0108", 465, 21, { source: "RFQ Award", ref: "RFQ-TBD-0271", from: "2026-06-10" }),
    ir("PACK-TBD-SKID", "VEN-TBD-0109", 420, 7),
    ir("PACK-TBD-CRATE", "VEN-TBD-0109", 185, 7),
    ir("PACK-TBD-DESIC", "VEN-TBD-0109", 3.2, 7),
    ir("PACK-TBD-TOTE", "VEN-TBD-0109", 310, 10, { from: "2026-02-01" }),
    ir("CONS-TBD-PAINT", "VEN-TBD-0113", 22.5, 10, { currency: "CAD", price: 30.6 }),
    ir("NSTK-TBD-CAL", "VEN-TBD-0114", 380, 10, { source: "Contract" }),
    ir("SERV-TBD-GALV", "VEN-TBD-0106", 0.6, 7, { priceUnit: 100 }),
    { ...ir("SPARE-TBD-GSKT20", "VEN-TBD-0111", 640, 30, { from: "2026-02-01" }), entityId: "LE-TBD-30" },
  ]
}

export function seedSourceList(): SourceListRecord[] {
  let n = 0
  const r = (materialId: string, vendorId: string, validFrom: string, validTo: string | undefined, fixed: boolean, blocked = false, mrpRelevant = true, note?: string): SourceListRecord => ({
    id: `SL-${String(++n).padStart(3, "0")}`, materialId: materialId as Material["id"], vendorId: vendorId as SourceListRecord["vendorId"], validFrom, validTo, fixed, blocked, mrpRelevant, note,
  })
  return [
    r("RAW-TBD-CRGO23", "VEN-TBD-0101", "2026-07-01", "2026-12-31", true),
    r("RAW-TBD-CRGO23", "VEN-TBD-0101", "2026-01-01", "2026-06-30", true),
    r("RAW-TBD-CTC", "VEN-TBD-0102", "2026-01-01", "2026-12-31", true),
    r("RAW-TBD-OLTC", "VEN-TBD-0103", "2026-01-30", "2027-01-29", false),
    r("RAW-TBD-BSH145", "VEN-TBD-0104", "2026-01-01", "2026-12-31", false, false, true, "AVL Conditional: FAI-TBD-0031 open"),
    r("RAW-TBD-BSH015", "VEN-TBD-0112", "2026-09-22", "2026-12-31", false, true, true, "Commercial embargo after two overdue SCARs"),
    r("RAW-TBD-BSH015", "VEN-TBD-0104", "2026-09-22", "2026-12-31", true),
    r("RAW-TBD-BSH015B", "VEN-TBD-0104", "2026-09-01", "2027-08-31", true),
    r("RAW-TBD-OIL", "VEN-TBD-0105", "2026-01-01", "2026-12-31", true, false, true, "Consignment contract"),
    r("RAW-TBD-PLATE", "VEN-TBD-0106", "2026-01-01", "2026-12-31", false),
    r("RAW-TBD-RAD", "VEN-TBD-0108", "2026-01-01", "2026-12-31", false),
    r("RAW-TBD-KRAFT", "VEN-TBD-0107", "2026-01-01", "2026-12-31", false, false, false, "Spot buys only"),
  ]
}

// ------------------------------------------------------------------ account determination matrix
export function seedAcct(): AcctRow[] {
  let n = 0
  const row = (eventKey: string, valuationClass: string | undefined, drKey: string, crKey: string, version: number, state: AcctRow["state"] = "Released", extra: Partial<AcctRow> = {}): AcctRow => ({
    id: `ADM-${String(++n).padStart(3, "0")}`, eventKey, valuationClass, drKey, crKey, version, state, validFrom: version === 1 ? "2026-01-01" : version === 2 ? "2026-07-01" : undefined, createdBy: U.controller, ...extra,
  })
  return [
    row("STOCK", "VC-3000", "1310 Raw Materials", "1310 Raw Materials", 1),
    row("STOCK", "VC-7900", "1310 Raw Materials", "1310 Raw Materials", 1, "Released", { note: "WIP flow via 1320 during orders" }),
    row("STOCK", "VC-7920", "1330 Finished Goods", "1330 Finished Goods", 1),
    row("STOCK", "VC-3100", "1330 Finished Goods", "1330 Finished Goods", 1),
    row("STOCK", "VC-3060", "1360 Packaging on Hand", "1360 Packaging on Hand", 1),
    row("STOCK", "VC-3040", "1310 Raw Materials", "1310 Raw Materials", 1, "Superseded"),
    row("STOCK", "VC-3040", "1340 Spare Parts Inventory", "1340 Spare Parts Inventory", 2, "Released", { note: "Controller elected separate spares disclosure" }),
    row("STOCK", "VC-3080", "1310 Raw Materials", "1310 Raw Materials", 1),
    row("GRIR", undefined, "2110 GR/IR", "2110 GR/IR", 1),
    row("PPV", undefined, "5210 Purchase Price Variance", "5210 Purchase Price Variance", 1),
    row("USAGE", undefined, "1320 WIP", "1320 WIP", 1),
    row("ABSORB", undefined, "7500 Absorption", "7500 Absorption", 1),
    row("VARSET", undefined, "5220-5250 Variances", "5220-5250 Variances", 1),
    row("SUBCON", undefined, "1315 Subcontract at Vendor", "5260 Subcontract Variance", 1),
    row("SCRAP", undefined, "5320 Scrap and Waste", "5320 Scrap and Waste", 1),
    row("ADJ", undefined, "5310 Inventory Adjustment", "5310 Inventory Adjustment", 1),
    row("REVAL", undefined, "5330 Revaluation", "5330 Revaluation", 1),
    row("COGS", undefined, "5120 COGS", "5120 COGS", 1),
    row("COGS", "VC-3040", "5130 COGS-Service", "5130 COGS-Service", 2, "Released", { qualifier: "Service order" }),
    row("RETQ", undefined, "1335 RMA Inventory", "1335 RMA Inventory", 1),
    row("CONSIG", undefined, "2120 Consignment Payable Clearing", "2120 Consignment Payable Clearing", 1),
    row("CONSPV", undefined, "5215 Consignment Price Variance", "5215 Consignment Price Variance", 1),
    row("EORES", undefined, "6320 E&O Expense", "5340 Inventory Reserve - E&O", 1),
    row("INTRANS", undefined, "1350 In-Transit", "1350 In-Transit", 1),
    // version 3 candidate: fluids split for the ester MCR (VC-3010); draft until the Controller marks it
    row("STOCK", "VC-3010", "1310 Raw Materials (fluids)", "1310 Raw Materials (fluids)", 3, "Draft", { note: "Controller decision: fluids split for RAW-TBD-ESTER" }),
  ]
}

// ------------------------------------------------------------------ count documents (S-40: every status seeded)
export function seedCounts(rate: (id: string) => number): CountDocRecord[] {
  const L = (no: number, bin: string, itemId: string, uom: string, expected: number, o: Partial<CountLine> = {}): CountLine => ({
    no, bin, itemId: itemId as Material["id"], uom, expected, interim: 0, rate: rate(itemId), flags: [], ...o,
  })
  const doc = (seq: string, plan: string, zone: string, status: CountDocRecord["status"], lines: CountLine[], o: Partial<CountDocRecord> = {}): CountDocRecord => ({
    id: `CD-${plan}-${seq}` as CountDocRecord["id"], plan, planId: plan, location: `WH-TBD-01 / ${zone}`, warehouseId: "WH-TBD-01", zone, status, blind: true, softFreeze: true, snapshotAt: "2026-10-05",
    generatedBy: U.whSup, counterIds: [], lines, activity: [{ at: "2026-10-05", by: "Warehouse supervisor", text: "Generated from count plan; expected quantities frozen" }], ...o,
  })
  const P = "CP-2026-010"
  return [
    doc("001", P, "Zone A core steel", "Generated", [L(1, "C-01-01", "RAW-TBD-CRGO23", "KG", 38500, { batch: "BAT-TBD-C0911" }), L(2, "C-03-02", "RAW-TBD-CRGO27", "KG", 9800, { batch: "BAT-TBD-C0312" }), L(3, "F-01-01", "RAW-TBD-PLATE", "KG", 21500, { batch: "BAT-TBD-S0908" })]),
    doc("002", P, "Zone B conductors", "Assigned", [L(1, "D-02-01", "RAW-TBD-CTC", "KG", 6400, { batch: "BAT-TBD-K0920" }), L(2, "D-04-01", "RAW-TBD-FOIL", "KG", 3100, { batch: "BAT-TBD-F0815" }), L(3, "D-05-02", "RAW-TBD-CUWIRE", "KG", 2250, { batch: "BAT-TBD-W0902" })], { counterIds: [U.whOp] }),
    doc("003", P, "Zone C insulation", "Counting", [
      L(1, "E-01-03", "RAW-TBD-KRAFT", "KG", 1850, { batch: "BAT-TBD-P0828", count: 1846 }),
      L(2, "E-02-01", "RAW-TBD-PRESS", "KG", 940, { batch: "BAT-TBD-P0710", interim: -40, flags: ["Moved During Count"] }),
    ], { counterIds: [U.whOp], softFreeze: false }),
    doc("004", P, "Zone D bushings and fittings", "Submitted", [
      L(1, "B-02-03", "RAW-TBD-BSH015", "EA", 18, { count: 18 }),
      L(2, "B-02-04", "RAW-TBD-BSH015B", "EA", 30, { count: 28, flags: ["Recount Required"] }),
      L(3, "B-08-01", "RAW-TBD-GAUGE", "EA", 22, { count: 22 }),
      L(4, "G-01-01", "RAW-TBD-RAD", "EA", 64, { count: 64 }),
    ], { counterIds: [U.whOp] }),
    doc("005", P, "Zone H packaging", "Recount", [
      L(1, "YARD-01", "PACK-TBD-SKID", "EA", 14, { count: 11, flags: ["Recount Required"] }),
      L(2, "YARD-03", "PACK-TBD-TOTE", "EA", 12, { count: 12 }),
      L(3, "H-01-01", "PACK-TBD-DESIC", "EA", 380, { count: 372 }),
    ], { counterIds: [U.whOp], recounterId: U.whSup as UserId }),
    doc("006", P, "Zone M consumables", "Variance Review", [
      L(1, "M-01-01", "CONS-TBD-WELD", "KG", 320, { count: 314 }),
      L(2, "M-02-01", "CONS-TBD-BLADE", "EA", 26, { count: 26 }),
      L(3, "FLAM-01", "CONS-TBD-PAINT", "L", 640, { count: 631 }),
    ], { counterIds: [U.whOp] }),
    doc("007", P, "Zone D2 copper reserve", "Variance Review", [
      L(1, "D-03-01", "RAW-TBD-CTC", "KG", 4100, { batch: "BAT-TBD-K0811", count: 3180, recount: 3200, flags: ["Recount Required"] }),
      L(2, "D-03-02", "RAW-TBD-FOIL", "KG", 1200, { batch: "BAT-TBD-F0702", count: 1196 }),
      L(3, "D-03-01", "RAW-TBD-CTC", "KG", 0, { batch: "BAT-TBD-K0907", count: 150, flags: ["Unlisted Batch"], unlistedConfirmed: false }),
    ], { counterIds: [U.whOp] }),
    doc("008", P, "Spares cage", "Approved", [
      L(1, "S-01-01", "SPARE-TBD-BSH145", "EA", 2, { count: 2, expectedSerials: ["SN-TBD-SPB-0011", "SN-TBD-SPB-0012"], scannedSerials: ["SN-TBD-SPB-0011", "SN-TBD-SPB-0019"] }),
      L(2, "S-02-01", "SPARE-TBD-GSKT20", "EA", 4, { count: 3 }),
      L(3, "S-02-02", "SPARE-TBD-OLTCK", "EA", 4, { count: 4 }),
    ], { counterIds: [U.whOp], warehouseId: "WH-TBD-03", location: "WH-TBD-03 / Spares cage" }),
    doc("009", P, "Zone T oil tank farm", "Void", [L(1, "TANK-01", "RAW-TBD-OIL", "L", 42000)], { voidReason: "Tank farm counted by flow meter reconciliation instead; void before counting", counterIds: [] }),
    doc("001", "CP-2026-009", "Zone A core steel", "Posted", [L(1, "C-01-01", "RAW-TBD-CRGO23", "KG", 41200, { batch: "BAT-TBD-C0911", count: 41150 }), L(2, "F-01-01", "RAW-TBD-PLATE", "KG", 22800, { batch: "BAT-TBD-S0908", count: 22800 })], {
      snapshotAt: "2026-09-08", postedOn: "2026-09-12", adjustmentRef: "SA-TBD-0912", counterIds: [U.whOp],
    }),
    doc("002", "CP-2026-009", "Zone B conductors", "Posted", [L(1, "D-02-01", "RAW-TBD-CTC", "KG", 7100, { batch: "BAT-TBD-K0920", count: 7100 })], { snapshotAt: "2026-09-08", postedOn: "2026-09-12", counterIds: [U.whOp] }),
  ]
}

// ------------------------------------------------------------------ E&O
export function seedEoPolicy(): EoPolicy {
  return {
    version: "EO-POL-2026.1",
    validFrom: "2026-01-01",
    rates: {
      RAW: [10, 25, 50], SEMI: [15, 35, 75], FIN: [10, 30, 60], TRADE: [20, 40, 80], PACK: [5, 15, 40], SPARE: [5, 15, 35], CONS: [10, 25, 50], SERV: [0, 0, 0], NSTK: [0, 0, 0],
    },
    overrides: [{ materialId: "SPARE-TBD-BSH145", pct: 0, reason: "Insurance spare held for installed 145 kV units; exempt" }],
  }
}
export function seedEoRuns(): EoRunRecord[] {
  return [
    {
      id: "EOR-202606-01", period: "2026-Q2", policyVersion: "EO-POL-2026.1", stage: "Posted", postedOn: "2026-07-08", journalRef: "JE-TBD-EO-0708",
      rows: [
        { materialId: "TRADE-TBD-ELB", bucket: "12-24 months", value: 5740, pct: 40, reserve: 2296, existing: 0, reserveDelta: 2296, lastMovement: "2024-08-14" },
        { materialId: "RAW-TBD-CRGO27", bucket: "12-24 months", value: 35476, pct: 25, reserve: 8869, existing: 0, reserveDelta: 8869, lastMovement: "2025-03-18" },
        { materialId: "SPARE-TBD-GAUGE", bucket: "6-12 months", value: 4680, pct: 5, reserve: 234, existing: 0, reserveDelta: 234, lastMovement: "2025-09-30" },
      ],
    },
  ]
}

// ------------------------------------------------------------------ safety stock
export function seedSafetyStock(): SafetyStockRow[] {
  let n = 0
  const r = (materialId: string, warehouseId: WarehouseId, ss: number | undefined, defaultSs: number, uom: string, adu: number, ltDays: number, onHand: number, o: Partial<SafetyStockRow> = {}): SafetyStockRow => ({
    id: `SS-${String(++n).padStart(3, "0")}`, materialId: materialId as Material["id"], warehouseId, ss, defaultSs, uom, adu, ltDays, onHand, reserved: 0, qiHold: 0, blocked: 0, onOrder: 0,
    maxStock: Math.round(defaultSs * 4 + adu * ltDays), reorderQty: Math.max(1, Math.round(adu * 10)), orderMultiple: 1, breaches90: 0, breaches12m: 2, history: [], ...o,
  })
  return [
    r("RAW-TBD-CRGO23", "WH-TBD-01", 12000, 10000, "KG", 650, 42, 52700, { qiHold: 14200, reserved: 18000, onOrder: 54000, orderMultiple: 500, history: [{ on: "2026-07-01", by: U.planner, old: 10000, new: 12000, reason: "Lead Time Change" }] }),
    r("RAW-TBD-CTC", "WH-TBD-01", 2500, 2000, "KG", 180, 35, 6400, { reserved: 1900, onOrder: 0, orderMultiple: 100 }),
    r("RAW-TBD-FOIL", "WH-TBD-01", undefined, 800, "KG", 60, 35, 3100, { reserved: 400 }),
    r("RAW-TBD-OIL", "WH-TBD-01", 15000, 15000, "L", 900, 10, 60000, { reserved: 24000, breaches12m: 0, multipliers: [1, 1, 1, 1.1, 1.2, 1.3, 1.3, 1.2, 1.1, 1, 1, 1] }),
    r("RAW-TBD-KRAFT", "WH-TBD-01", 600, 500, "KG", 45, 21, 1850, { reserved: 900, breaches90: 3, breaches12m: 7 }),
    r("RAW-TBD-BSH015B", "WH-TBD-01", 12, 12, "EA", 1.2, 56, 30, { reserved: 12, onOrder: 0 }),
    r("RAW-TBD-RAD", "WH-TBD-01", 16, 16, "EA", 1.5, 28, 64, { reserved: 24 }),
    r("PACK-TBD-DESIC", "WH-TBD-01", 200, 150, "EA", 2.5, 7, 380, { shelfLifeDays: 730 }),
    r("PACK-TBD-SKID", "WH-TBD-01", 6, 6, "EA", 0.4, 7, 14, { reserved: 3 }),
    r("SPARE-TBD-GSKT20", "WH-TBD-03", 6, 4, "EA", 0.2, 30, 3, { onOrder: 0, breaches90: 1 }),
    r("SPARE-TBD-OLTCK", "WH-TBD-03", 4, 4, "EA", 0.1, 45, 4, {
      pending: { changeId: "SSC-TBD-0007", newSs: 8, pct: 100, reason: "Service Level Change", note: "Frame agreement with Prairie Ridge Electric needs two kits on the shelf", by: U.planner, on: "2026-10-08" },
    }),
    r("SPARE-TBD-BSH145", "WH-TBD-03", 2, 2, "EA", 0, 84, 2, { breaches12m: 0 }),
    r("SPARE-TBD-GAUGE", "WH-TBD-03", undefined, 3, "EA", 0.05, 21, 9),
    r("SPARE-TBD-GAUGE", "WH-TBD-02", 2, 3, "EA", 0.03, 21, 2),
    r("TRADE-TBD-FCI", "WH-TBD-02", 120, 100, "EA", 6, 14, 420, { reserved: 60, multipliers: [1, 1, 1, 1.2, 1.3, 1.3, 1.3, 1.3, 1.25, 1.25, 1, 1] }),
    r("TRADE-TBD-ARR", "WH-TBD-02", 80, 80, "EA", 5, 14, 260, { reserved: 150, onOrder: 0 }),
    r("TRADE-TBD-CUTOUT", "WH-TBD-02", 60, 40, "EA", 3.5, 21, 85, { reserved: 20, onOrder: 40 }),
    r("CONS-TBD-WELD", "WH-TBD-01", 100, 100, "KG", 12, 5, 320, { breaches12m: 0 }),
  ]
}
export function seedBuffers(): CustomerBuffer[] {
  return [
    { id: "CB-001", customerId: "CUS-TBD-0031", materialId: "SPARE-TBD-BSH145", warehouseId: "WH-TBD-03", qty: 1, validFrom: "2026-01-01", validTo: "2026-12-31" },
    { id: "CB-002", customerId: "CUS-TBD-0027", materialId: "SPARE-TBD-GSKT20", warehouseId: "WH-TBD-03", qty: 2, validFrom: "2026-04-01" },
    { id: "CB-003", customerId: "CUS-TBD-0044", materialId: "TRADE-TBD-FCI", warehouseId: "WH-TBD-02", qty: 40, validFrom: "2026-06-01", validTo: "2027-05-31" },
  ]
}

export const SEED_TODAY = TODAY

// ------------------------------------------------------------------ item sales tab (Book I Part A §4.2-4.3)
export function seedSalesPrices(): SalesPriceRow[] {
  let n = 0
  const p = (materialId: string, kind: SalesPriceRow["kind"], key: string, currency: "USD" | "CAD", price: number, validFrom: string, status: SalesPriceRow["status"], o: Partial<SalesPriceRow> = {}): SalesPriceRow => ({
    id: `SPR-${String(++n).padStart(4, "0")}`, materialId: materialId as Material["id"], kind, ...(kind === "Price list" ? { priceListId: key } : { customerId: key as `CUS-${string}` }), currency, price, validFrom,
    breaks: [], status, createdBy: U.salesAdmin as UserId, createdOn: validFrom < TODAY ? validFrom : TODAY, ...o,
  })
  return [
    p("FIN-TBD-20MVA", "Price list", "PL-PRC-TBD-US26", "USD", 1284000, "2026-01-01", "Active"),
    p("FIN-TBD-20MVA", "Price list", "PL-PRC-TBD-CA26", "CAD", 1760000, "2026-01-01", "Active"),
    p("FIN-TBD-20MVA", "Customer", "CUS-TBD-0031", "USD", 1259000, "2026-03-01", "Active", { validTo: "2027-02-28", agreement: "CPA-TBD-0031 frame agreement" }),
    p("TRADE-TBD-FCI", "Price list", "PL-PRC-TBD-US25", "USD", 108, "2025-01-01", "Expired", { validTo: "2025-12-31" }),
    p("TRADE-TBD-FCI", "Price list", "PL-PRC-TBD-US26", "USD", 112, "2026-01-01", "Active", { breaks: [{ fromQty: 50, price: 108 }, { fromQty: 200, price: 104 }] }),
    p("TRADE-TBD-FCI", "Price list", "PL-PRC-TBD-GC27", "USD", 103, "2027-01-01", "Draft"),
    p("TRADE-TBD-FCI", "Customer", "CUS-TBD-0009", "USD", 76, "2026-06-01", "Pending Approval", { validTo: "2027-05-31", approvalKind: "Below price floor", note: "Distributor stocking agreement; below the PC-300 floor" }),
    p("TRADE-TBD-ARR", "Price list", "PL-PRC-TBD-US26", "USD", 149, "2026-01-01", "Active"),
    p("TRADE-TBD-ARR", "Price list", "PL-PRC-TBD-US27", "USD", 162, "2027-01-01", "Draft", { note: "Draft rate for the 2027 list; above ±5% against the active rate" }),
  ]
}
