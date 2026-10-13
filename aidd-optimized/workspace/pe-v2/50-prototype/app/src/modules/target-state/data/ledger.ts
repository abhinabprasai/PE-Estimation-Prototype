// Periodic Actual Costing and Material Ledger (Book IX §1). The calculation is the PRD's binding order (§1.2):
//  1 single level: periodic unit price = (beginning actual value + receipt actual value) / (beginning qty + receipt qty);
//    zero or negative denominator parks the material in "Not distributed" with a worklist entry, never a division fault.
//  2 multi level: by ascending low level code, differences allocated to consumption roll into the receiving materials;
//    circular consumption within a level resolves iteratively to a tolerance of one cent per material.
//  3 revaluation preview: inventory delta = ending qty x (periodic unit price - standard); both deltas by valuation class.
//  4 posting: one revaluation journal per entity at close, event keys MLINV and MLCOGS.
// Numbers are fictitious design values; labels that the PRD does not give carry a reading in the UI.

import { MATERIALS } from "@/data/shared"

export const ML_PERIOD = "2026-09"
export type DiffCat = "Price difference (PPV)" | "Price difference (IPV)" | "Exchange difference" | "Settlement variance" | "Transfer difference"
export const DIFF_CATS: DiffCat[] = ["Price difference (PPV)", "Price difference (IPV)", "Exchange difference", "Settlement variance", "Transfer difference"]

export interface MlReceipt {
  doc: string
  cat: "Purchase receipt" | "Production receipt" | "Transfer receipt"
  qty: number
  /** Purchase: PO price and invoice price. Production: settled order actual. Transfer: sending plant actual. */
  po?: number
  inv?: number
  actual?: number
  fx?: number
}
export interface MlCons {
  doc: string
  cat: "Production issue" | "Sales issue" | "Scrap" | "Transfer out"
  qty: number
  /** Receiving material of the consumption (multi-level roll). */
  toMaterial?: string
}
export interface MlRecord {
  materialId: string
  plantId: string
  period: string
  group: string
  llc: number
  begQty: number
  begValAct: number
  receipts: MlReceipt[]
  consumption: MlCons[]
}
export const stdOf = (id: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0
export const uomOf = (id: string) => MATERIALS.find((m) => m.id === id)?.baseUom ?? "EA"
export const descOf = (id: string) => MATERIALS.find((m) => m.id === id)?.description ?? id
export const typeOf = (id: string) => MATERIALS.find((m) => m.id === id)?.type ?? "RAW"
export const valClass = (id: string) => (typeOf(id) === "SEMI" ? "7900 Semi-finished goods" : "3000 Raw materials")

export interface MlConfig {
  entities: { entityId: string; mode: "Not active" | "Parallel" | "Live"; effectiveFrom: string }[]
  mapping: { category: DiffCat; matrixRow: string; eventKey: "MLINV" | "MLCOGS" }[]
  reversal: Record<string, boolean>
  toleranceCent: number
  maxIterations: number
  versions: { v: number; at: string; by: string; text: string; effectiveFrom: string }[]
}

export interface MlRun {
  steps: { status: "Not started" | "Done"; at?: string }[]
  single: Record<string, Single>
  multi: Record<string, Single>
  iterations: { level: number; n: number; delta: number }[]
  worklist: { id: string; materialId: string; reason: string; owner: string; open: boolean }[]
  journal?: { id: string; entityId: string; at: string; reversal: boolean; mode: "Parallel" | "Live"; amount: number }
}
export interface LedgerState {
  records: MlRecord[]
  config: MlConfig
  run: MlRun
}

export interface Single {
  begQty: number
  recQty: number
  recAct: number
  begValAct: number
  inherited: number
  denom: number
  pup: number | null
  parked?: string
  std: number
  consQty: number
  rolledQty: number
  endQty: number
  total: number
  toEnding: number
  toConsumption: number
  toCogs: number
  toRolled: number
  notDistributed: number
}

export function receiptAct(r: MlReceipt) {
  if (r.cat === "Purchase receipt") return r.qty * (r.inv ?? 0) + (r.fx ?? 0)
  return r.qty * (r.actual ?? 0)
}
/** Receipt differences by category, so each stays reportable separately through the rollup (§1.1). */
export function diffsOf(rec: MlRecord): Record<DiffCat, number> {
  const std = stdOf(rec.materialId)
  const d: Record<DiffCat, number> = { "Price difference (PPV)": 0, "Price difference (IPV)": 0, "Exchange difference": 0, "Settlement variance": 0, "Transfer difference": 0 }
  for (const r of rec.receipts) {
    if (r.cat === "Purchase receipt") {
      d["Price difference (PPV)"] += r.qty * ((r.po ?? 0) - std)
      d["Price difference (IPV)"] += r.qty * ((r.inv ?? 0) - (r.po ?? 0))
      d["Exchange difference"] += r.fx ?? 0
    } else if (r.cat === "Production receipt") d["Settlement variance"] += r.qty * ((r.actual ?? 0) - std)
    else d["Transfer difference"] += r.qty * ((r.actual ?? 0) - std)
  }
  return d
}

/** Step one for a single record, with an optional difference inherited from consumed materials (step two). */
export function single(rec: MlRecord, inherited = 0): Single {
  const std = stdOf(rec.materialId)
  const recQty = rec.receipts.reduce((s, r) => s + r.qty, 0)
  const recAct = rec.receipts.reduce((s, r) => s + receiptAct(r), 0)
  const consQty = rec.consumption.reduce((s, c) => s + c.qty, 0)
  const rolledQty = rec.consumption.filter((c) => c.toMaterial).reduce((s, c) => s + c.qty, 0)
  const denom = rec.begQty + recQty
  const endQty = denom - consQty
  const total = rec.begValAct + recAct + inherited - denom * std
  const base = { begQty: rec.begQty, recQty, recAct, begValAct: rec.begValAct, inherited, denom, std, consQty, rolledQty, endQty, total }
  if (denom <= 0) {
    return { ...base, pup: null, parked: denom === 0 ? "Zero denominator: beginning plus receipt quantity is 0" : `Negative denominator: beginning plus receipt quantity is ${denom}`, toEnding: 0, toConsumption: 0, toCogs: 0, toRolled: 0, notDistributed: total }
  }
  const pup = (rec.begValAct + recAct + inherited) / denom
  const per = pup - std
  const toConsumption = consQty * per
  const toRolled = rolledQty * per
  return { ...base, pup, toEnding: endQty * per, toConsumption, toRolled, toCogs: toConsumption - toRolled, notDistributed: 0 }
}

export function runSingle(recs: MlRecord[]) {
  return Object.fromEntries(recs.map((r) => [r.materialId, single(r)])) as Record<string, Single>
}

/** Step two: ascending low level code; same-level circular consumption iterates to the tolerance. */
export function runMulti(recs: MlRecord[], tolCent: number, maxIter: number) {
  const inherited: Record<string, number> = {}
  const out: Record<string, Single> = {}
  const iterations: MlRun["iterations"] = []
  const levels = [...new Set(recs.map((r) => r.llc))].sort((a, b) => a - b)
  for (const lvl of levels) {
    const at = recs.filter((r) => r.llc === lvl)
    const ids = new Set(at.map((r) => r.materialId))
    const circular = at.some((r) => r.consumption.some((c) => c.toMaterial && ids.has(c.toMaterial)))
    let n = 0
    let delta = 0
    do {
      n++
      for (const r of at) out[r.materialId] = single(r, inherited[r.materialId] ?? 0)
      const next: Record<string, number> = {}
      for (const r of at) {
        const s = out[r.materialId]
        if (s.pup == null) continue
        for (const c of r.consumption) if (c.toMaterial && ids.has(c.toMaterial)) next[c.toMaterial] = (next[c.toMaterial] ?? 0) + c.qty * (s.pup - s.std)
      }
      delta = 0
      for (const id of ids) {
        const base = recs.filter((x) => x.llc < lvl).reduce((sum, x) => sum + (out[x.materialId]?.pup == null ? 0 : x.consumption.filter((c) => c.toMaterial === id).reduce((q, c) => q + c.qty * (out[x.materialId].pup! - out[x.materialId].std), 0)), 0)
        const v = base + (next[id] ?? 0)
        delta = Math.max(delta, Math.abs(v - (inherited[id] ?? 0)))
        inherited[id] = v
      }
    } while (circular && delta >= tolCent / 100 && n < maxIter)
    if (circular) iterations.push({ level: lvl, n, delta })
    for (const r of at) out[r.materialId] = single(r, inherited[r.materialId] ?? 0)
  }
  return { multi: out, iterations }
}

export function seedLedger(): LedgerState {
  const P = "PL-TBD-01"
  const rec = (materialId: string, group: string, llc: number, begQty: number, begUnit: number, receipts: MlReceipt[], consumption: MlCons[]): MlRecord => ({ materialId, plantId: P, period: ML_PERIOD, group, llc, begQty, begValAct: Math.round(begQty * begUnit * 100) / 100, receipts, consumption })
  const records: MlRecord[] = [
    rec("RAW-TBD-CRGO23", "Electrical steel", 1, 120000, 3.91, [{ doc: "GRN-TBD-0344", cat: "Purchase receipt", qty: 80000, po: 3.85, inv: 3.97 }, { doc: "GRN-TBD-0352", cat: "Purchase receipt", qty: 60000, po: 3.9, inv: 3.9, fx: 420 }], [{ doc: "WO-TBD-0361", cat: "Production issue", qty: 90000, toMaterial: "SEMI-TBD-CORE20" }, { doc: "SCR-TBD-0412", cat: "Scrap", qty: 2500 }]),
    rec("RAW-TBD-CTC", "Copper conductors", 1, 18000, 13.62, [{ doc: "GRN-TBD-0347", cat: "Purchase receipt", qty: 12000, po: 13.4, inv: 13.55 }], [{ doc: "WO-TBD-0366", cat: "Production issue", qty: 15000, toMaterial: "SEMI-TBD-HVC20" }, { doc: "SCR-TBD-0415", cat: "Scrap", qty: 120 }]),
    rec("RAW-TBD-FOIL", "Copper conductors", 1, 9000, 12.1, [{ doc: "GRN-TBD-0349", cat: "Purchase receipt", qty: 6000, po: 12.35, inv: 12.35 }], [{ doc: "WO-TBD-0367", cat: "Production issue", qty: 8000, toMaterial: "SEMI-TBD-LVC20" }]),
    rec("RAW-TBD-OIL", "Oil and insulation", 1, 60000, 1.92, [{ doc: "GRN-TBD-0351", cat: "Purchase receipt", qty: 40000, po: 1.88, inv: 1.88 }], [{ doc: "WO-TBD-0370", cat: "Production issue", qty: 70000 }]),
    rec("RAW-TBD-KRAFT", "Oil and insulation", 1, -200, 8.8, [{ doc: "GRN-TBD-0353", cat: "Purchase receipt", qty: 150, po: 8.6, inv: 8.6 }], [{ doc: "WO-TBD-0366", cat: "Production issue", qty: 90, toMaterial: "SEMI-TBD-HVC20" }]),
    rec("RAW-TBD-PLATE", "Fabrication steel", 1, 50000, 1.35, [{ doc: "GRN-TBD-0346", cat: "Purchase receipt", qty: 45000, po: 1.35, inv: 1.41 }], [{ doc: "WO-TBD-0368", cat: "Production issue", qty: 60000, toMaterial: "SEMI-TBD-TANK20" }]),
    rec("RAW-TBD-RAD", "Fabrication steel", 1, 0, 0, [], []),
    rec("RAW-TBD-BSH145", "Bushings and tap changers", 1, 6, 18900, [{ doc: "GRN-TBD-0358", cat: "Purchase receipt", qty: 4, po: 18900, inv: 19250 }], [{ doc: "WO-TBD-0301", cat: "Production issue", qty: 3 }]),
    rec("RAW-TBD-OLTC", "Bushings and tap changers", 1, 1, 74500, [{ doc: "GRN-TBD-0360", cat: "Purchase receipt", qty: 1, po: 74500, inv: 76200, fx: 300 }], [{ doc: "WO-TBD-0372", cat: "Production issue", qty: 1 }]),
    rec("SEMI-TBD-CORE20", "Semi-finished", 2, 1, 98100, [{ doc: "WO-TBD-0361", cat: "Production receipt", qty: 1, actual: 97800 }], [{ doc: "WO-TBD-0372", cat: "Production issue", qty: 1 }]),
    rec("SEMI-TBD-HVC20", "Semi-finished", 2, 2, 38900, [{ doc: "WO-TBD-0366", cat: "Production receipt", qty: 3, actual: 39100 }], [{ doc: "WO-TBD-0372", cat: "Production issue", qty: 3 }, { doc: "RWK-TBD-0021", cat: "Production issue", qty: 1, toMaterial: "SEMI-TBD-LVC20" }]),
    rec("SEMI-TBD-LVC20", "Semi-finished", 2, 3, 21400, [{ doc: "WO-TBD-0367", cat: "Production receipt", qty: 2, actual: 21650 }], [{ doc: "WO-TBD-0372", cat: "Production issue", qty: 3 }, { doc: "RWK-TBD-0022", cat: "Production issue", qty: 1, toMaterial: "SEMI-TBD-HVC20" }]),
    rec("SEMI-TBD-TANK20", "Semi-finished", 2, 1, 58200, [{ doc: "WO-TBD-0368", cat: "Production receipt", qty: 2, actual: 59800 }], [{ doc: "WO-TBD-0372", cat: "Production issue", qty: 2 }]),
  ]
  return {
    records,
    config: {
      entities: [
        { entityId: "LE-TBD-10", mode: "Parallel", effectiveFrom: "2026-07-01" },
        { entityId: "LE-TBD-20", mode: "Not active", effectiveFrom: "2027-01-01" },
        { entityId: "LE-TBD-30", mode: "Not active", effectiveFrom: "2027-01-01" },
        { entityId: "LE-TBD-40", mode: "Not active", effectiveFrom: "2027-01-01" },
      ],
      mapping: [
        { category: "Price difference (PPV)", matrixRow: "ADM-TBD-ML-01", eventKey: "MLINV" },
        { category: "Price difference (IPV)", matrixRow: "ADM-TBD-ML-02", eventKey: "MLINV" },
        { category: "Exchange difference", matrixRow: "ADM-TBD-ML-03", eventKey: "MLINV" },
        { category: "Settlement variance", matrixRow: "ADM-TBD-ML-04", eventKey: "MLCOGS" },
        { category: "Transfer difference", matrixRow: "ADM-TBD-ML-05", eventKey: "MLINV" },
      ],
      reversal: { "LE-TBD-10": false, "LE-TBD-20": false, "LE-TBD-30": false, "LE-TBD-40": false },
      toleranceCent: 1,
      maxIterations: 20,
      versions: [{ v: 1, at: "2026-06-30", by: "Controller", text: "Activated LE-TBD-10 in parallel from 2026-07-01; tolerance one cent", effectiveFrom: "2026-07-01" }],
    },
    run: { steps: [{ status: "Not started" }, { status: "Not started" }, { status: "Not started" }, { status: "Not started" }], single: {}, multi: {}, iterations: [], worklist: [] },
  }
}

export const GROUPS = ["Electrical steel", "Copper conductors", "Oil and insulation", "Fabrication steel", "Bushings and tap changers", "Semi-finished"]
