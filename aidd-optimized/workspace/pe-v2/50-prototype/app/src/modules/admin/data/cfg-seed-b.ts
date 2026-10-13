// Seed for the master-data configuration screens: number series, RMA policy, quality no-plan policy,
// material settings, plants and lanes, intercompany, reason codes, GL mapping. Fictitious values
// (GUARDRAILS 7). PRD values carry their source; the rest are design values (README AR-32..AR-50).

import type { LegalEntityId } from "@/data/domain"
import { LEGAL_ENTITIES, USERS } from "@/data/shared"
import { uid } from "./seed"
import type { CharacteristicClass, GlAccount, IcMarkup, IcPair, IcPrice, Lane, MatGroup, NewSeries, NoPlanRow, PlantRecord, ReasonCode, RmaReason, SerialProfile, SetupStep, TypeBehaviour } from "./cfg-types"

const E = LEGAL_ENTITIES.map((e) => e.id)
const [PT, GC, PG, PE] = E as [LegalEntityId, LegalEntityId, LegalEntityId, LegalEntityId]
const SEED = (value: object, note = "Specification seed (Book I §2.2 / Book II §2.7)") => ({ value, effectiveFrom: "2026-01-01", by: "PRD seed" as const, note })

// ---------------------------------------------------------------- number series (delta)
type S = [group: NewSeries["group"], docType: string, format: string, example: string, entityAware: boolean, next: number]
const SERIES_ROWS: S[] = [
  ["Book I §2.2", "Quotation", "QT-{YYYY}-{SEQ:5}", "QT-2026-00311", true, 412],
  ["Book I §2.2", "Sales Order", "SO-{YYYY}-{SEQ:5}", "SO-2026-01184", true, 403],
  ["Book I §2.2", "Delivery / Shipment", "SHP-{YYYY}-{SEQ:5}", "SHP-2026-00092", true, 93],
  ["Book I §2.2", "Handling Unit (Packing)", "HU-{SEQ:8}", "HU-00004417", false, 4418],
  ["Book I §2.2", "RMA", "RMA-{YYYY}-{SEQ:4}", "RMA-2026-0038", true, 39],
  ["Book I §2.2", "Credit Memo Request", "CMR-{YYYY}-{SEQ:4}", "CMR-2026-0021", true, 22],
  ["Book I §2.2", "Production Order", "WO-{YYYY}-{SEQ:5}", "WO-2026-00266", false, 409],
  ["Book I §2.2", "Rework Order", "RWO-{YYYY}-{SEQ:4}", "RWO-2026-0007", false, 8],
  ["Book I §2.2", "Planned Order", "PLO-{SEQ:6}", "PLO-018223", false, 18224],
  ["Book I §2.2", "Routing", "RTG-{TYPE}-{SEQ:4}", "RTG-PAD-0012", false, 13],
  ["Book I §2.2", "Engineering BOM", "EBOM-{SEQ:5}", "EBOM-00341", false, 342],
  ["Book I §2.2", "Engineering Change Request", "ECR-{YYYY}-{SEQ:4}", "ECR-2026-0102", false, 103],
  ["Book I §2.2", "Engineering Change Order", "ECO-{YYYY}-{SEQ:4}", "ECO-2026-0059", false, 60],
  ["Book I §2.2", "CAD / Controlled Document", "DOC-{TYPE}-{SEQ:5}", "DOC-GA-00873", false, 874],
  ["Book I §2.2", "Purchase Requisition", "PR-{YYYY}-{SEQ:5}", "PR-2026-00944", true, 945],
  ["Book I §2.2", "Request for Quotation", "RFQ-{YYYY}-{SEQ:4}", "RFQ-2026-0116", true, 117],
  ["Book I §2.2", "Purchase Order", "PO-{YYYY}-{ENTITY}-{SEQ:5}", "PO-2026-PT-00532", true, 533],
  ["Book I §2.2", "Inspection Plan", "IP-{TYPE}-{SEQ:4}", "IP-INC-0027", false, 28],
  ["Book I §2.2", "Final Test Report", "FTR-{YYYY}-{SEQ:4}", "FTR-2026-0201", false, 202],
  ["Book I §2.2", "CAPA", "CAPA-{YYYY}-{SEQ:4}", "CAPA-2026-0013", false, 14],
  ["Book I §2.2", "Supplier Corrective Action", "SCAR-{YYYY}-{SEQ:4}", "SCAR-2026-0006", false, 7],
  ["Book I §2.2", "Cost Estimate", "CE-{YYYY}-{SEQ:5}", "CE-2026-00187", true, 188],
  ["Book I §2.2", "Costing Run", "CR-{YYYY}-{SEQ:3}", "CR-2026-004", true, 5],
  ["Book I §2.2", "Allocation Cycle Run", "ALC-{YYYY}{MM}-{SEQ:2}", "ALC-202607-01", true, 2],
  ["Book I §2.2", "Count Document", "CD-{CountPlan}-{SEQ:3}", "CD-CP-2026-001-014", false, 15],
  ["Book II §2.7", "Material Creation Request", "MCR-{YYYY}-{SEQ:4}", "MCR-2026-0117", false, 118],
  ["Book II §2.7", "Material Change Request", "MCH-{YYYY}-{SEQ:4}", "MCH-2026-0031", false, 32],
  ["Book II §2.7", "Purchasing Info Record", "IR-{SEQ:6}", "IR-004215", true, 4216],
  ["Book II §2.7", "Supersession Record", "SUP-{YYYY}-{SEQ:4}", "SUP-2026-0009", false, 10],
  ["Book II §2.7", "E&O Reserve Run", "EOR-{YYYY}{MM}-{SEQ:2}", "EOR-202607-01", true, 2],
  ["Book II §2.3", "Material RAW", "RM-{GROUP:3}-{SEQ:5}", "RM-CRG-00114", false, 115],
  ["Book II §2.3", "Material SEMI", "SA-{GROUP:3}-{SEQ:5}", "SA-COIL-00092", false, 93],
  ["Book II §2.3", "Material FIN", "TX-{FAMILY:3}-{SEQ:5}", "TX-PAD-00034", false, 35],
  ["Book II §2.3", "Material TRADE", "GC-{GROUP:3}-{SEQ:5}", "GC-BSH-00220", false, 221],
  ["Book II §2.3", "Material PACK", "PK-{SEQ:5}", "PK-00017", false, 18],
  ["Book II §2.3", "Material SPARE", "SP-{GROUP:3}-{SEQ:5}", "SP-GSK-00456", false, 457],
  ["Book II §2.3", "Material CONS", "MRO-{SEQ:5}", "MRO-00873", false, 874],
  ["Book II §2.3", "Material SERV", "SV-{SEQ:5}", "SV-00041", false, 42],
  ["Book II §2.3", "Material NSTK", "NS-{SEQ:5}", "NS-00202", false, 203],
]
export function seedSeriesNew(): NewSeries[] {
  return SERIES_ROWS.map(([group, docType, format, example, entityAware, next], n) => ({
    id: `NSN-${String(n + 1).padStart(2, "0")}`, group, docType, example, entityAware,
    counters: entityAware ? { [PT]: next, [GC]: Math.max(1, Math.round(next * 0.28)), [PG]: Math.max(1, Math.round(next * 0.17)), [PE]: 1 } : { ALL: next },
    versions: [SEED({ format, next }, group === "Book II §2.3" ? "Specification seed (Book II §2.3, extends INV 11.3)" : undefined) as never],
  }))
}

// ---------------------------------------------------------------- RMA policy (Book I A §3.10)
const rr = (id: string, reason: string, pct: number, freight: RmaReason["freightPaidBy"], source: RmaReason["source"]): RmaReason => ({ id, reason, restockPct: pct, freightPaidBy: freight, source, versions: [SEED({ restockPct: pct }, "Specification seed (Book I A §3.1, §3.10)") as never] })
export function seedRmaReasons(): RmaReason[] {
  return [
    rr("RR-01", "Defective — Warranty", 0, "PE", "PRD"),
    rr("RR-02", "Defective — Out of Warranty", 0, "Customer", "PRD"),
    rr("RR-03", "Damaged in Transit", 0, "Carrier claim", "PRD"),
    rr("RR-04", "Wrong Item Shipped", 0, "PE", "PRD"),
    rr("RR-05", "Wrong Item Ordered", 10, "Customer", "PRD"),
    rr("RR-06", "Overshipment", 0, "PE", "PRD"),
    rr("RR-07", "Customer Convenience", 15, "Customer", "PRD"),
    rr("RR-08", "Recall", 0, "PE", "PRD"),
    rr("RR-09", "Billable Repair", 0, "Customer", "PRD"),
  ]
}

// ---------------------------------------------------------------- Quality no-plan policy (Book I A §6.5)
export function seedNoPlan(): NoPlanRow[] {
  const row = (planType: NoPlanRow["planType"], label: string, policy: NoPlanRow["versions"][number]["value"]["policy"], note: string): NoPlanRow => ({
    planType, label, versions: [{ value: { policy }, effectiveFrom: "2026-01-01", by: "PRD seed", note }],
  })
  return [
    row("INC", "Incoming (GRN line, QI-required item)", "Block", "Default for INC on QI-required items (§6.5)"),
    row("INP", "In-Process (production order operation)", "Manual Inspection", "Design value: the specification gives defaults for INC and FIN only"),
    row("FIN", "Final (finished unit test)", "Block", "Default for FIN (§6.5); Auto-Accept is never allowed"),
    row("PSI", "Pre-shipment inspection", "Block", "Design value; Auto-Accept is never allowed for PSI (§6.5)"),
    row("RMA", "RMA (return inspection)", "Manual Inspection", "Design value: the specification gives defaults for INC and FIN only"),
  ]
}

// ---------------------------------------------------------------- material settings (Book II §2.2, §2.4, §15.2)
const mg = (id: string, level: 1 | 2 | 3, code: string, name: string, parentId?: string, extra: Partial<MatGroup> = {}): MatGroup => ({ id, level, code, name, parentId, validFrom: "2026-01-01", by: "PRD seed", ...extra })
export function seedMatGroups(): MatGroup[] {
  return [
    mg("G-CRG", 1, "CRG", "Core Steel"),
    mg("G-CRG-STD", 2, "CRGO-STD", "CRGO Standard Grades", "G-CRG"), mg("G-CRG-HIB", 2, "CRGO-HIB", "CRGO HiB", "G-CRG"),
    mg("G-CRG-HIB-M", 3, "M-4/M-5", "M-4, M-5, 23ZDKH85", "G-CRG-HIB"),
    mg("G-CU", 1, "CU", "Copper & Conductors"),
    mg("G-CU-W", 2, "CU-W", "Wire", "G-CU"), mg("G-CU-CTC", 2, "CU-CTC", "CTC", "G-CU"), mg("G-CU-F", 2, "CU-F", "Foil", "G-CU"), mg("G-CU-B", 2, "CU-B", "Busbar", "G-CU"),
    mg("G-CU-W-G", 3, "CU-W-GAUGE", "By gauge/spec family", "G-CU-W"),
    mg("G-INS", 1, "INS", "Insulation"),
    mg("G-INS-K", 2, "INS-K", "Kraft/Crepe", "G-INS"), mg("G-INS-P", 2, "INS-P", "Pressboard", "G-INS"), mg("G-INS-D", 2, "INS-D", "DDP", "G-INS"), mg("G-INS-R", 2, "INS-R", "Resins", "G-INS"),
    mg("G-INS-K-S", 3, "INS-K-SPEC", "By spec", "G-INS-K"),
    mg("G-OIL", 1, "OIL", "Fluids"),
    mg("G-OIL-M", 2, "OIL-M", "Mineral Oil", "G-OIL"), mg("G-OIL-E", 2, "OIL-E", "Ester Fluid", "G-OIL"),
    mg("G-OIL-M-S", 3, "OIL-M-STD", "By standard (D3487 Type II…)", "G-OIL-M"),
    mg("G-STL", 1, "STL", "Steel & Fabrication"),
    mg("G-STL-P", 2, "STL-P", "Plate", "G-STL"), mg("G-STL-S", 2, "STL-S", "Structural", "G-STL"), mg("G-STL-H", 2, "STL-H", "Hardware", "G-STL"),
    mg("G-STL-P-G", 3, "STL-P-GRADE", "By grade/size family", "G-STL-P"),
    mg("G-BSH", 1, "BSH", "Components"),
    mg("G-BSH-B", 2, "BSH-B", "Bushings", "G-BSH"), mg("G-BSH-T", 2, "BSH-T", "Tap Changers", "G-BSH"), mg("G-BSH-G", 2, "BSH-G", "Gauges", "G-BSH"), mg("G-BSH-R", 2, "BSH-R", "Relays", "G-BSH"), mg("G-BSH-RD", 2, "BSH-RD", "Radiators", "G-BSH"),
    mg("G-BSH-B-V", 3, "BSH-B-VOLT", "By voltage class / vendor family", "G-BSH-B"),
    mg("G-PKG", 1, "PKG", "Packaging"),
    mg("G-PKG-C", 2, "PKG-C", "Crates", "G-PKG"), mg("G-PKG-T", 2, "PKG-T", "Totes", "G-PKG"), mg("G-PKG-D", 2, "PKG-D", "Dunnage", "G-PKG"),
    mg("G-MRO", 1, "MRO", "Consumables"),
    mg("G-MRO-W", 2, "MRO-W", "Weld", "G-MRO"), mg("G-MRO-P", 2, "MRO-P", "PPE", "G-MRO"), mg("G-MRO-S", 2, "MRO-S", "Shop", "G-MRO"),
    mg("G-CU-FF", 2, "CU-FF", "Flexible leads (retired grade)", "G-CU", { deactivatedFrom: "2026-07-01" }),
  ]
}
const cc = (n: number, groupId: string, key: string, type: CharacteristicClass["type"], unit: string | undefined, values?: string): CharacteristicClass => ({ id: `CH-${String(n).padStart(2, "0")}`, groupId, key, type, unit, values, searchable: true, printable: n % 2 === 1 })
export function seedCharClasses(): CharacteristicClass[] {
  return [
    cc(1, "G-CRG", "Grade", "List", undefined, "M-3, M-4, M-5, 23ZDKH85"), cc(2, "G-CRG", "Thickness", "Number", "mm"), cc(3, "G-CRG", "Core loss", "Number", "W/kg"),
    cc(4, "G-CU", "Conductor gauge", "Text", undefined), cc(5, "G-CU", "Cross-section", "Number", "mm²"), cc(6, "G-CU", "Insulation class", "List", undefined, "A, B, F, H"),
    cc(7, "G-INS", "Thickness", "Number", "mm"), cc(8, "G-INS", "Thermal class", "List", undefined, "105 °C, 120 °C"),
    cc(9, "G-OIL", "Standard", "List", undefined, "D3487 Type I, D3487 Type II, IEC 60296"), cc(10, "G-OIL", "Breakdown voltage", "Number", "kV"),
    cc(11, "G-STL", "Grade", "List", undefined, "A36, A572 Gr. 50, A240 304L"), cc(12, "G-STL", "Plate thickness", "Number", "mm"),
    cc(13, "G-BSH", "Voltage class", "Number", "kV"), cc(14, "G-BSH", "Current rating", "Number", "A"), cc(15, "G-BSH", "kVA", "Number", "kVA"),
    cc(16, "G-PKG", "Load rating", "Number", "t"), cc(17, "G-MRO", "Hazard class", "Text", undefined),
  ]
}
export function seedSerialProfiles(): SerialProfile[] {
  return [
    { id: "SN-FIN", appliesTo: "Transformer FIN transformers", timing: "Serial at WO release", format: "PE-{TYPE}-{YYYY}-{SEQ:4}", warrantyRelevant: true, installLinks: false, legacyId: "SP-FIN" },
    { id: "SN-COMP", appliesTo: "Serialized Component: TRADE/SPARE serialized (bushings, tap changers, relays)", timing: "Serial at GRN (vendor serial captured or PE label printed)", format: "Vendor serial, or PE label", warrantyRelevant: true, installLinks: true, legacyId: "SP-COMP" },
    { id: "SN-SEMI", appliesTo: "Optional SEMI where engineering elects", timing: "Serial at WO release or FG receipt per §3.8", format: "Per §3.8", warrantyRelevant: false, installLinks: false, legacyId: "SP-SEMI" },
    { id: "SN-NONE", appliesTo: "Everything else", timing: "No serialization", format: "None", warrantyRelevant: false, installLinks: false, legacyId: "SP-NONE" },
  ]
}
const M = (behaviour: string, vals: string): TypeBehaviour => {
  const types = ["RAW", "SEMI", "FIN", "TRADE", "PACK", "SPARE", "CONS", "SERV", "NSTK"]
  const v = vals.split("|")
  return { behaviour, cells: Object.fromEntries(types.map((t, n) => [t, v[n]])) }
}
export function seedTypeMatrix(): TypeBehaviour[] {
  return [
    M("Inventory-managed", "Yes|Yes|Yes|Yes|Yes|Yes|Config|No|No"),
    M("Valuated", "Yes|Yes|Yes|Yes|Yes|Yes|Config|No|No"),
    M("Purchasable", "Yes|Exception|Exception|Yes|Yes|Yes|Yes|Yes|Yes"),
    M("Producible (BOM parent)", "No|Yes|Yes|No|No|Config|No|No|No"),
    M("Usable as BOM component", "Yes|Yes|Yes|Yes|Yes|Yes|Yes|Subcontract op only|No"),
    M("Sellable default", "Off|Off|On|On|Off|Config|Off|On|Off"),
    M("Batch-managed default", "On|Config|Off|Config|Off|Config|Off|n/a|n/a"),
    M("Serialized default", "Off|Config|On|Config|Off|Config|Off|n/a|n/a"),
    M("QI at receipt default", "On|On (prod.)|On (prod.)|Config|Off|Config|Off|n/a|n/a"),
    M("Costing relevance", "Std/MAV|Standard|Standard|MAV|MAV|MAV|Expense|Rate only|Expense"),
  ]
}

// ---------------------------------------------------------------- plants and lanes (Book VII §4)
const STEP_DEF: [string, string, boolean][] = [
  ["Create the plant with entity, calendar and address", "MP-PLANT-001", false],
  ["Create its warehouses, zones and bins", "INV warehouse model", true],
  ["Create work centers, cost center nodes and rates for the plant", "Book I D §2, H, I §2", true],
  ["Extend materials to the plant with plant-level data completion", "MM Extend action, Book II §3.3", true],
  ["Pair production versions per material and plant", "Book IV §6.1", true],
  ["Define transfer lanes in both directions with transit times", "MP-LANE-001", false],
  ["Set sourcing rules per material and plant", "Planning view special procurement; §4.4 sourcing table", false],
  ["Configure intercompany pairing where the plants sit in different entities", "Book III F §3, FL-07", false],
  ["Run the multi-plant test packs and the cross-plant recall drill", "FL-04, FL-07, FL-08 in network configuration", false],
]
const steps = (doneTo: number[], by: ReturnType<typeof uid>): SetupStep[] =>
  STEP_DEF.map(([action, where, gate], i) => ({ n: i + 1, action, where, gate, done: doneTo.includes(i + 1), ...(doneTo.includes(i + 1) ? { evidence: "Verified at go-live", by, on: "2026-01-05" } : {}) }))
export function seedPlants(): PlantRecord[] {
  const it = uid("Plant IT")
  return [
    {
      id: "PL-TBD-01", code: "PL-TBD-01", name: "PE Transformer plant", entityId: PT, address: "Fargo, ND (street address not given in the specification)", calendar: "Plant calendar 2026 (two shifts, Mon-Fri)",
      receivingWarehouse: "WH-TBD-01", shippingWarehouse: "WH-TBD-01", shippingPoints: ["Implicit shipping point (field reserved, Phase 1)"],
      planning: { leadTimeDays: 2, planningTimeFenceDays: 14, mrpArea: "PL-TBD-01 (single plant)", safetyTimeDays: 1 },
      state: "Active", steps: steps([1, 2, 3, 4, 5, 6, 7, 8, 9], it),
      history: [{ at: "2026-01-05T10:00", by: "PRD seed", what: "Plant created and activated at go-live (one plant, four entities)" }],
    },
    {
      id: "PL-TBD-02", code: "PL-TBD-02", name: "PE Power Grids Regina plant (planned)", entityId: PG, address: "Regina, SK (design value)", calendar: "Regina plant calendar 2027 (draft)",
      receivingWarehouse: "WH-TBD-02", shippingWarehouse: "WH-TBD-02", shippingPoints: ["Dock A"],
      planning: { leadTimeDays: 3, planningTimeFenceDays: 21, mrpArea: "PL-TBD-02", safetyTimeDays: 2 },
      state: "Draft", steps: [
        ...steps([1, 2], it).slice(0, 2),
        { ...steps([], it)[2], evidence: "6 of 9 work centers created", by: it, on: "2026-10-02" },
        ...steps([], it).slice(3),
      ],
      history: [{ at: "2026-09-18T11:20", by: it, what: "Draft plant created for the DEC-07 activation project" }],
    },
  ]
}
export function seedLanes(): Lane[] {
  const l = (id: string, from: string, to: string, days: number, mode: Lane["mode"], cost: number, active: boolean): Lane => ({
    id, fromPlant: from, toPlant: to, transitDays: days, mode, calendar: "Carrier calendar, Mon-Fri", costPerKg: cost, active,
    history: [{ at: "2026-09-18T11:40", by: uid("Planning Manager"), what: "Lane created" }],
  })
  return [l("LN-001", "PL-TBD-01", "PL-TBD-02", 3, "Truck", 0.14, true), l("LN-002", "PL-TBD-02", "PL-TBD-01", 4, "Truck", 0.16, true), l("LN-003", "PL-TBD-01", "PL-TBD-02", 2, "Air", 1.9, false)]
}

// ---------------------------------------------------------------- intercompany (Book III F §3-4)
export function seedIc(): { pairs: IcPair[]; markups: IcMarkup[]; prices: IcPrice[] } {
  const pairs: IcPair[] = [
    { id: "IC-01", seller: PT, buyer: GC, priceList: "ICPL-TBD-PT-GC", accountPair: "IC accounts per ACC (not in the KB)", taxTreatment: "Taxable at transfer price; no withholding", live: true },
    { id: "IC-02", seller: GC, buyer: PT, priceList: "ICPL-TBD-GC-PT", accountPair: "IC accounts per ACC (not in the KB)", taxTreatment: "Taxable at transfer price; no withholding", live: true },
    { id: "IC-03", seller: PT, buyer: PG, priceList: "ICPL-TBD-PT-PG", accountPair: "IC accounts per ACC (not in the KB)", taxTreatment: "Cross-border US to Canada: duty and GST review (design value)", live: false },
  ]
  const mk = (id: string, pairId: string, family: string, pct: number, rationale: string) => ({ id, pairId, family, versions: [{ value: { markupPct: pct, rationale }, effectiveFrom: "2026-01-01", by: "PRD seed" as const, note: "Controller-owned markup table (Book III F §4)" }] })
  const markups: IcMarkup[] = [
    mk("IM-01", "IC-01", "Distribution transformers (PC-100)", 8, "Benchmark study 2025, tax compliance file TCF-2025-04"),
    mk("IM-02", "IC-01", "Power transformers (PC-200)", 6, "Benchmark study 2025, tax compliance file TCF-2025-04"),
    mk("IM-03", "IC-02", "Merchandise (PC-300)", 12, "Benchmark study 2025, tax compliance file TCF-2025-05"),
    mk("IM-04", "IC-03", "Distribution transformers (PC-100)", 9, "Draft: pending benchmark for the Canadian entity"),
  ]
  const prices: IcPrice[] = [
    { id: "IP-01", pairId: "IC-02", material: "TRADE-TBD-FCI", price: 78, currency: "USD", validFrom: "2026-01-01" },
    { id: "IP-02", pairId: "IC-02", material: "TRADE-TBD-ARR", price: 104, currency: "USD", validFrom: "2026-01-01" },
    { id: "IP-03", pairId: "IC-01", material: "SPARE-TBD-GSKT20", price: 780, currency: "USD", validFrom: "2026-01-01", validTo: "2026-06-30" },
    { id: "IP-04", pairId: "IC-01", material: "SPARE-TBD-GSKT20", price: 805, currency: "USD", validFrom: "2026-07-01" },
  ]
  return { pairs, markups, prices }
}

// ---------------------------------------------------------------- reason codes (A-12)
const rc = (catalog: ReasonCode["catalog"], code: string, label: string, source: ReasonCode["source"], usedBy: string, active = true): ReasonCode => ({
  id: `${catalog}-${code}`, catalog, code, label, source, usedBy, active, validFrom: "2026-01-01", ...(active ? {} : { deactivatedFrom: "2026-09-01" }),
  history: [{ at: "2026-01-01T00:00", by: "PRD seed", what: source === "PRD" ? "Specification seed" : "Seed catalog value (design value)" }],
})
export function seedReasons(): ReasonCode[] {
  return [
    ...["Defective — Warranty", "Defective — Out of Warranty", "Damaged in Transit", "Wrong Item Shipped", "Wrong Item Ordered", "Overshipment", "Customer Convenience", "Recall", "Billable Repair"].map((l, n) => rc("rma", `R${n + 1}`, l, "PRD", "RMA header reason; drives restocking fee default and freight payer")),
    rc("shortpack", "SP-SHORT", "Short Pick", "PRD", "Complete Pack Order, short-pack"), rc("shortpack", "SP-DMG", "Damage", "PRD", "Complete Pack Order, short-pack"), rc("shortpack", "SP-HOLD", "Hold", "PRD", "Complete Pack Order, short-pack"),
    rc("scrap", "SC-DIM", "Out of dimension", "Design value", "Production confirmation scrap (posts #20 / 5320; scrap pareto)"), rc("scrap", "SC-WLD", "Weld defect", "Design value", "Production confirmation scrap"), rc("scrap", "SC-MAT", "Material defect", "Design value", "Production confirmation scrap"), rc("scrap", "SC-OPR", "Operator error", "Design value", "Production confirmation scrap"), rc("scrap", "SC-OLD", "Superseded drawing", "Design value", "Production confirmation scrap", false),
    rc("hold", "HD-QI", "Quality inspection pending", "Design value", "Production hold / andon, QI Hold"), rc("hold", "HD-MAT", "Material shortage", "Design value", "Production hold / andon"), rc("hold", "HD-ENG", "Engineering query", "Design value", "Production hold / andon"), rc("hold", "HD-EQP", "Equipment down", "Design value", "Production hold / andon"),
    rc("loss", "LS-PRC", "Price", "Design value", "Quotation Lost"), rc("loss", "LS-LTM", "Lead time", "Design value", "Quotation Lost"), rc("loss", "LS-SPC", "Specification not met", "Design value", "Quotation Lost"), rc("loss", "LS-CMP", "Competitor selected", "Design value", "Quotation Lost"), rc("loss", "LS-DQ", "Disqualified", "PRD", "Lead Disqualified requires a reason code"),
    rc("count", "CT-MIS", "Mis-pick or mis-put", "Design value", "Count variance reason (INV §7)"), rc("count", "CT-DMG", "Damage not booked", "Design value", "Count variance reason"), rc("count", "CT-UOM", "Unit of measure error", "Design value", "Count variance reason"), rc("count", "CT-TIM", "Timing: interim movement", "Design value", "Count variance reason"),
    rc("block", "BL-PUR", "Purchasing block", "Design value", "Function-specific block (Book II §4.5): PO and RFQ"), rc("block", "BL-SAL", "Sales block", "Design value", "Function-specific block: quotation and sales order"), rc("block", "BL-PRD", "Production block", "Design value", "Function-specific block: WO"), rc("block", "BL-QUA", "Quality hold", "Design value", "Function-specific block: receipts and shipments"), rc("block", "BL-RCL", "Recall", "Design value", "Recall campaign block (FL-08)"),
  ]
}

// ---------------------------------------------------------------- GL account mapping (Book I §2.4; Book II §2.6)
const gl = (key: string, account: number, name: string, type: string, usedBy: string, book: GlAccount["book"], status: GlAccount["status"] = "Proposed"): GlAccount => ({
  key, account, name, type, usedBy, book, status, proposed: account, history: [{ at: "2026-01-05T09:00", by: "PRD seed", what: "Proposed in the specification; the Controller confirms or remaps once" }],
})
export function seedGl(): GlAccount[] {
  const a = [
    gl("GLK-SUBCON-AT-VENDOR", 1315, "Subcontract Material at Vendor", "Balance sheet (asset)", "Subcontract POs (Part G §6)", "Book I §2.4"),
    gl("GLK-WIP-REWORK", 1325, "WIP — Rework", "Balance sheet (asset)", "Rework orders (Part D §9)", "Book I §2.4"),
    gl("GLK-RMA-INV", 1335, "Return / RMA Inventory (Quarantine)", "Balance sheet (asset)", "RMA receipts (Part A §3)", "Book I §2.4"),
    gl("GLK-PACK-ON-HAND", 1360, "Packaging Materials on Hand", "Balance sheet (asset)", "Packing (Part A §5)", "Book I §2.4"),
    gl("GLK-REFUND-PAYABLE", 2150, "Customer Refunds Payable", "Balance sheet (liability)", "RMA cash refunds", "Book I §2.4"),
    gl("GLK-WARRANTY-RESERVE", 2610, "Warranty Reserve", "Balance sheet (liability)", "Warranty accrual & warranty RMA work", "Book I §2.4"),
    gl("GLK-REV-SERVICE", 4150, "Service & Repair Revenue", "P&L (revenue)", "Billable repair RMAs", "Book I §2.4"),
    gl("GLK-REV-RESTOCK", 4910, "Restocking Fee Income", "P&L (revenue)", "RMA restocking fees", "Book I §2.4"),
    gl("GLK-COGS-SERVICE", 5130, "COGS — Service & Repair", "P&L (expense)", "Billable repair cost", "Book I §2.4"),
    gl("GLK-VAR-LABOR-RATE", 5230, "Labor Rate Variance", "P&L (expense)", "WO settlement (Part I §4)", "Book I §2.4"),
    gl("GLK-VAR-LABOR-EFF", 5240, "Labor Efficiency Variance", "P&L (expense)", "WO settlement", "Book I §2.4"),
    gl("GLK-VAR-OVERHEAD", 5250, "Overhead Absorption Variance", "P&L (expense)", "WO settlement", "Book I §2.4"),
    gl("GLK-VAR-SUBCON-PRICE", 5260, "Subcontract Price Variance", "P&L (expense)", "Subcontract receipt", "Book I §2.4"),
    gl("GLK-EXP-WARRANTY", 6300, "Warranty Expense", "P&L (expense)", "Warranty RMA repair/replacement cost", "Book I §2.4"),
    gl("GLK-EXP-FREIGHT-OUT", 6410, "Freight Out", "P&L (expense)", "Shipments, RMA return freight when PE pays", "Book I §2.4"),
    gl("GLK-ALLOC-CLEARING", 7500, "Cost Center Allocation Clearing", "P&L (contra)", "Allocation cycles (Part H §5)", "Book I §2.4"),
    gl("GLK-CONSIGN-OFFSET", 1311, "Raw Materials — Consignment Offset", "Memo / statistical", "Vendor consignment quantity visibility (§14.2); never in trial balance", "Book II §2.6"),
    gl("GLK-INV-SPARE", 1340, "Spare Parts Inventory", "Balance sheet (asset)", "SPARE type materials when the Controller elects separate disclosure; else maps to 1310", "Book II §2.6"),
    gl("GLK-CONSIGN-CLEARING", 2120, "Consignment Payable Clearing", "Balance sheet (liability)", "Consignment withdrawal to settlement (§14.2)", "Book II §2.6"),
    gl("GLK-VAR-CONSIGN-PRICE", 5215, "Consignment Price Variance", "P&L (expense)", "Consignment settlement price vs info record price (§14.2)", "Book II §2.6"),
    gl("GLK-EO-RESERVE", 5340, "Inventory Reserve — Excess & Obsolete", "Balance sheet (contra-asset)", "E&O reserve postings (§17.3)", "Book II §2.6"),
    gl("GLK-EXP-EO", 6320, "Excess & Obsolete Expense", "P&L (expense)", "E&O reserve build/release", "Book II §2.6"),
  ]
  // Two already confirmed by the Controller at go-live; one remapped (the proposal clashed with a legacy account).
  a[5].status = "Confirmed"; a[5].history.push({ at: "2026-01-12T14:00", by: uid("Controller"), what: "Confirmed as 2610" })
  a[14].status = "Confirmed"; a[14].history.push({ at: "2026-01-12T14:02", by: uid("Controller"), what: "Confirmed as 6410" })
  a[19].status = "Remapped"; a[19].account = 5345; a[19].history.push({ at: "2026-01-12T14:10", by: uid("Controller"), what: "Remapped 5340 to 5345: 5340 is used by a legacy scrap account" })
  return a
}
void USERS
