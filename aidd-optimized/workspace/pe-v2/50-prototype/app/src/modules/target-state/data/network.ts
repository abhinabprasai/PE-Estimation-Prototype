// Advanced Scheduling Optimizer (Book IX §2) and Global Multi-Plant ATP/CTP (Book IX §3).
// Optimizer rules the data follows: fixed seed, fixed time box, best solution returned with its bound (same inputs and
// profile reproduce the same schedule); freeze horizons are absolute; published promises may not degrade without an
// at-risk record; a solver version that does not beat the heuristic on the weighted objective must not publish.
// GATP rules: an ordered walk per material group and customer class (own plant stock, partner plant stock plus lane
// transit, production CTP at each plant holding a valid production version, purchase lead time where policy allows);
// cross-entity steps need a valid transfer price. Second plant, lanes, stocks and slots are design values.

import { CUSTOMERS } from "@/data/shared"
import { addDays } from "@/lib/format"
import { hash, prng, r2 } from "../components"

// ---------------------------------------------------------------- optimizer
export interface Weights { lateness: number; setup: number; wip: number; overtime: number }
export interface OptProfile {
  id: string
  name: string
  weights: Weights
  horizonDays: number
  version: number
  effectiveFrom: string
  status: "Draft" | "Released" | "Retired"
  approvedBy?: string
  history: { at: string; by: string; text: string }[]
}
export interface Kpi { lateness: number; setup: number; wip: number; overtime: number; makespan: number }
export interface Impact { order: string; wo: string; promised: string; before: string; after: string; frozen: boolean }
export interface OptRun {
  id: string
  profileId: string
  horizonDays: number
  timeBoxSec: number
  seed: number
  status: "Queued" | "Running" | "Completed" | "Published" | "Superseded" | "Discarded"
  progress: number
  trace: number[]
  bound: number
  createdOn: string
  by: string
  kpi: Kpi
  impacts: Impact[]
  overrides: { move: string; contribution: number }[]
  atRisk: string[]
  publishedOn?: string
}
export interface BenchVersion { id: string; date: string; lateness: number; setup: number; makespan: number; weighted: number }
export interface OptState {
  profiles: OptProfile[]
  runs: OptRun[]
  versions: BenchVersion[]
  shadow: { days: number; of: number; breaches: number }
}

export const HEURISTIC: Kpi = { lateness: 118, setup: 64, wip: 41, overtime: 36, makespan: 23 }
export const FREEZE_DAYS = 5
export const TRACE_LEN = 12
const KEYS: (keyof Weights)[] = ["lateness", "setup", "wip", "overtime"]

export function weighted(k: Kpi, w: Weights) {
  const tot = w.lateness + w.setup + w.wip + w.overtime || 1
  return r2(KEYS.reduce((s, key) => s + (w[key] / tot) * (k[key] / HEURISTIC[key]) * 100, 0))
}

/** Deterministic solve: the same inputs and profile give the same trace, KPIs and impact list. */
export function solve(profile: OptProfile, horizonDays: number, timeBoxSec: number, seed: number) {
  const rnd = prng(hash(`${profile.id}:${profile.version}:${horizonDays}:${timeBoxSec}:${seed}`))
  const tot = KEYS.reduce((s, k) => s + profile.weights[k], 0) || 1
  const tb = 0.7 + 0.3 * Math.min(1, timeBoxSec / 300)
  const red = (k: keyof Weights) => Math.min(0.75, (0.06 + 0.62 * (profile.weights[k] / tot) + 0.08 * rnd()) * tb)
  const kpi: Kpi = {
    lateness: r2(HEURISTIC.lateness * (1 - red("lateness"))),
    setup: r2(HEURISTIC.setup * (1 - red("setup"))),
    wip: r2(HEURISTIC.wip * (1 - red("wip"))),
    overtime: r2(HEURISTIC.overtime * (1 - red("overtime"))),
    makespan: r2(HEURISTIC.makespan * (1 - 0.03 - 0.07 * rnd())),
  }
  const final = weighted(kpi, profile.weights)
  const trace: number[] = []
  let prev = 100
  for (let i = 0; i < TRACE_LEN; i++) {
    const v = r2(Math.min(prev, final + (100 - final) * Math.exp(-i / 2.6) + 0.6 * rnd()))
    trace.push(i === TRACE_LEN - 1 ? final : v)
    prev = trace[i]
  }
  const orders: [string, string, string, string][] = [
    ["SO-2026-00377/10 sched 10", "WO-TBD-0377A", "2027-03-15", "2027-03-02"],
    ["SO-2026-00377/10 sched 20", "WO-TBD-0377B", "2027-04-12", "2027-04-05"],
    ["SO-2026-00355/10", "WO-TBD-0355", "2026-11-20", "2026-11-18"],
    ["SO-2026-00362/20", "WO-TBD-0362", "2026-11-27", "2026-11-24"],
    ["SO-2026-00340/10", "WO-TBD-0340", "2026-10-30", "2026-10-28"],
    ["SO-2026-00348/30", "WO-TBD-0348", "2026-12-04", "2026-12-01"],
  ]
  const today = "2026-10-09"
  const impacts: Impact[] = orders.map(([order, wo, promised, before]) => {
    const frozen = before <= addDays(today, FREEZE_DAYS) || order.includes("00340")
    const d = frozen ? 0 : Math.round(rnd() * 9 - 6)
    return { order, wo, promised, before, after: addDays(before, d), frozen }
  })
  const overrides = [
    { move: `Moved ${orders[0][1]} op 20 from WC-210 to WC-220 (planner preference: WC-210)`, contribution: r2(-1.2 - 2 * rnd()) },
    { move: `Resequenced setup family on WC-050 (planner preference: due-date order)`, contribution: r2(-0.4 - 1.5 * rnd()) },
  ]
  return { trace, kpi, bound: r2(final * 0.93), impacts, overrides }
}

export function seedOpt(): OptState {
  const profiles: OptProfile[] = [
    { id: "OPT-PRF-TBD-01", name: "Promise first (default)", weights: { lateness: 50, setup: 25, wip: 15, overtime: 10 }, horizonDays: 28, version: 2, effectiveFrom: "2026-09-01", status: "Released", approvedBy: "Planning Manager", history: [{ at: "2026-08-28", by: "Planning Manager", text: "Version 2 released: lateness weight 45 to 50" }, { at: "2026-07-10", by: "Planner", text: "Version 1 released" }] },
    { id: "OPT-PRF-TBD-02", name: "Throughput month-end", weights: { lateness: 30, setup: 40, wip: 20, overtime: 10 }, horizonDays: 14, version: 1, effectiveFrom: "2026-10-15", status: "Draft", history: [{ at: "2026-10-06", by: "Planner", text: "Draft created" }] },
    { id: "OPT-PRF-TBD-03", name: "Overtime squeeze", weights: { lateness: 35, setup: 15, wip: 15, overtime: 35 }, horizonDays: 14, version: 1, effectiveFrom: "2026-06-01", status: "Retired", approvedBy: "Planning Manager", history: [{ at: "2026-09-14", by: "Planning Manager", text: "Retired" }] },
  ]
  const make = (n: number, pid: string, horizon: number, tb: number, seed: number, status: OptRun["status"], on: string): OptRun => {
    const p = profiles.find((x) => x.id === pid)!
    const s = solve(p, horizon, tb, seed)
    return { id: `OPT-RUN-TBD-${String(n).padStart(4, "0")}`, profileId: pid, horizonDays: horizon, timeBoxSec: tb, seed, status, progress: TRACE_LEN, trace: s.trace, bound: s.bound, createdOn: on, by: "Production Scheduler", kpi: s.kpi, impacts: s.impacts, overrides: s.overrides, atRisk: [] }
  }
  const runs = [make(1, "OPT-PRF-TBD-01", 28, 300, 42, "Published", "2026-10-02"), make(2, "OPT-PRF-TBD-01", 28, 120, 42, "Completed", "2026-10-07"), make(3, "OPT-PRF-TBD-02", 14, 120, 7, "Discarded", "2026-10-08")]
  runs[0].publishedOn = "2026-10-02"
  const w = profiles[0].weights
  const ver = (id: string, date: string, k: Kpi): BenchVersion => ({ id, date, lateness: k.lateness, setup: k.setup, makespan: k.makespan, weighted: weighted(k, w) })
  const versions = [
    ver("SOLV-0.6.0", "2026-07-02", { lateness: 126, setup: 61, wip: 43, overtime: 38, makespan: 24 }),
    ver("SOLV-0.7.0", "2026-08-05", { lateness: 119, setup: 62, wip: 41, overtime: 37, makespan: 23.4 }),
    ver("SOLV-0.8.0", "2026-09-03", { lateness: 96, setup: 55, wip: 38, overtime: 33, makespan: 21.8 }),
    ver("SOLV-0.9.0", "2026-10-01", { lateness: 81, setup: 49, wip: 35, overtime: 31, makespan: 20.9 }),
  ]
  return { profiles, runs, versions, shadow: { days: 21, of: 30, breaches: 0 } }
}

// ---------------------------------------------------------------- global ATP / CTP
export interface GPlant { id: string; name: string; entityId: string; city: string }
export interface GLane { id: string; from: string; to: string; transitDays: number; crossEntity: boolean; transferPriceValidTo?: string }
export interface GStock { plantId: string; materialId: string; onHand: number; reserved: number; blocked: number; inbound: { qty: number; date: string }[]; slots: { date: string; qty: number }[]; validVersion: boolean; purchaseLeadDays?: number }
export type GStepName = "Own plant stock" | "Partner plant stock and lane transit" | "Production CTP" | "Purchase lead time"
export interface GSequence { id: string; group: string; customerClass: string; steps: GStepName[]; allowPurchase: boolean; version: number; effectiveFrom: string; status: "Draft" | "Released" }
export interface GPromise { id: string; soId: string; materialId: string; qty: number; requestDate: string; plant: string; lane?: string; snapshot: string; sequence: string; promiseDate: string; prefer?: { plant: string; reason: string }; at: string }
export interface GBackorder { id: string; soId: string; line: number; customerId: string; prio: "A" | "B" | "C"; materialId: string; qty: number; requestDate: string; home: string; status: "Backordered" | "Re-promised" | "Reallocation proposed"; plant?: string; lane?: string; promiseDate?: string; snapshot?: string; realloc?: { soId: string; plant: string } }
export interface GatpState {
  plants: GPlant[]
  lanes: GLane[]
  stocks: GStock[]
  sequences: GSequence[]
  promises: GPromise[]
  backorders: GBackorder[]
  runs: { id: string; at: string; snapshot: string; repromised: number; remaining: number; proposed: number }[]
  snapSeq: number
}
export const ALL_STEPS: GStepName[] = ["Own plant stock", "Partner plant stock and lane transit", "Production CTP", "Purchase lead time"]
export const MATERIAL_GROUPS: Record<string, string> = {
  "FIN-TBD-2500PM": "Pad-mount distribution", "FIN-TBD-1000PM": "Pad-mount distribution", "FIN-TBD-7500MTO": "Pad-mount distribution",
  "FIN-TBD-0167PL": "Pole-mount distribution", "FIN-TBD-0050PL": "Pole-mount distribution",
  "FIN-TBD-5000SS": "Power and ETO", "FIN-TBD-20MVA": "Power and ETO",
  "TRADE-TBD-ARR": "Grid components (trade)", "TRADE-TBD-FCI": "Grid components (trade)",
}
export const GROUP_LIST = ["Pad-mount distribution", "Pole-mount distribution", "Power and ETO", "Grid components (trade)"]
export const CUSTOMER_CLASSES = [...new Set(CUSTOMERS.map((c) => c.class))]

export function seedGatp(): GatpState {
  const plants: GPlant[] = [
    { id: "PL-TBD-01", name: "PE Transformer plant", entityId: "LE-TBD-10", city: "Fargo, ND" },
    { id: "PL-TBD-02", name: "Regina plant (network design value)", entityId: "LE-TBD-30", city: "Regina, SK" },
  ]
  const lanes: GLane[] = [
    { id: "LN-TBD-01", from: "PL-TBD-02", to: "PL-TBD-01", transitDays: 3, crossEntity: true, transferPriceValidTo: "2026-09-30" },
    { id: "LN-TBD-02", from: "PL-TBD-01", to: "PL-TBD-02", transitDays: 3, crossEntity: true, transferPriceValidTo: "2027-03-31" },
  ]
  const s = (plantId: string, materialId: string, onHand: number, reserved: number, extra: Partial<GStock> = {}): GStock => ({ plantId, materialId, onHand, reserved, blocked: 0, inbound: [], slots: [], validVersion: true, ...extra })
  const stocks: GStock[] = [
    s("PL-TBD-01", "FIN-TBD-1000PM", 6, 4, { slots: [{ date: "2026-10-19", qty: 2 }, { date: "2026-10-26", qty: 3 }] }),
    s("PL-TBD-02", "FIN-TBD-1000PM", 10, 2, { slots: [{ date: "2026-10-21", qty: 2 }] }),
    s("PL-TBD-01", "FIN-TBD-0167PL", 40, 25, { slots: [{ date: "2026-10-16", qty: 20 }] }),
    s("PL-TBD-02", "FIN-TBD-0167PL", 0, 0, { validVersion: false }),
    s("PL-TBD-01", "FIN-TBD-2500PM", 2, 2, { slots: [{ date: "2026-11-02", qty: 1 }, { date: "2026-11-09", qty: 2 }] }),
    s("PL-TBD-02", "FIN-TBD-2500PM", 3, 0, { slots: [{ date: "2026-11-05", qty: 1 }] }),
    s("PL-TBD-01", "FIN-TBD-5000SS", 0, 0, { inbound: [{ qty: 1, date: "2026-11-16" }], slots: [{ date: "2026-12-07", qty: 1 }] }),
    s("PL-TBD-02", "FIN-TBD-5000SS", 1, 0, { validVersion: false }),
    s("PL-TBD-01", "FIN-TBD-20MVA", 0, 0, { slots: [{ date: "2027-03-01", qty: 1 }, { date: "2027-04-05", qty: 1 }] }),
    s("PL-TBD-02", "FIN-TBD-20MVA", 0, 0, { validVersion: false }),
    s("PL-TBD-01", "TRADE-TBD-ARR", 500, 120, { purchaseLeadDays: 21 }),
    s("PL-TBD-02", "TRADE-TBD-ARR", 200, 0, { purchaseLeadDays: 21 }),
  ]
  const std: GStepName[] = ALL_STEPS.slice(0, 3)
  const sequences: GSequence[] = [
    { id: "GSEQ-TBD-01", group: "Pad-mount distribution", customerClass: "Utility", steps: std, allowPurchase: false, version: 2, effectiveFrom: "2026-09-01", status: "Released" },
    { id: "GSEQ-TBD-02", group: "Pad-mount distribution", customerClass: "Distributor", steps: ["Own plant stock", "Production CTP"], allowPurchase: false, version: 1, effectiveFrom: "2026-09-01", status: "Released" },
    { id: "GSEQ-TBD-03", group: "Pole-mount distribution", customerClass: "Utility", steps: std, allowPurchase: false, version: 1, effectiveFrom: "2026-09-01", status: "Released" },
    { id: "GSEQ-TBD-04", group: "Power and ETO", customerClass: "EPC contractor", steps: ["Own plant stock", "Production CTP"], allowPurchase: false, version: 1, effectiveFrom: "2026-09-01", status: "Released" },
    { id: "GSEQ-TBD-05", group: "Grid components (trade)", customerClass: "Distributor", steps: [...ALL_STEPS], allowPurchase: true, version: 1, effectiveFrom: "2026-09-01", status: "Released" },
    { id: "GSEQ-TBD-06", group: "Pad-mount distribution", customerClass: "Utility", steps: [...ALL_STEPS.slice(0, 3)], allowPurchase: false, version: 3, effectiveFrom: "2026-11-01", status: "Draft" },
  ]
  const bo = (n: number, soId: string, line: number, customerId: string, prio: GBackorder["prio"], materialId: string, qty: number, requestDate: string, extra: Partial<GBackorder> = {}): GBackorder => ({ id: `BO-TBD-${String(n).padStart(4, "0")}`, soId, line, customerId, prio, materialId, qty, requestDate, home: "PL-TBD-01", status: "Backordered", ...extra })
  const backorders: GBackorder[] = [
    bo(11, "SO-2026-00377", 20, "CUS-TBD-0048", "A", "FIN-TBD-1000PM", 3, "2026-10-14"),
    bo(12, "SO-2026-00355", 10, "CUS-TBD-0031", "A", "FIN-TBD-2500PM", 2, "2026-10-30"),
    bo(13, "SO-2026-00362", 20, "CUS-TBD-0027", "B", "FIN-TBD-0167PL", 8, "2026-10-12"),
    bo(14, "SO-2026-00340", 10, "CUS-TBD-0041", "B", "FIN-TBD-5000SS", 1, "2026-11-20"),
    bo(15, "SO-2026-00348", 30, "CUS-TBD-0017", "C", "FIN-TBD-1000PM", 2, "2026-10-13"),
    bo(16, "SO-2026-00351", 10, "CUS-TBD-0009", "C", "TRADE-TBD-ARR", 400, "2026-10-12"),
    bo(17, "SO-2026-00358", 10, "CUS-TBD-0044", "B", "FIN-TBD-2500PM", 1, "2026-10-20", { realloc: { soId: "SO-2026-00333", plant: "PL-TBD-02" } }),
  ]
  return { plants, lanes, stocks, sequences, promises: [], backorders, runs: [], snapSeq: 14 }
}

export interface WalkStep { step: GStepName; plant: string; ok: boolean; reached: boolean; detail: string; date?: string; lane?: string; offered?: string }
export interface WalkResult { steps: WalkStep[]; winner?: WalkStep; sourcingPlant?: string; lane?: string; promiseDate?: string; offered?: WalkStep; ms: number }
export const availOf = (st?: GStock) => (st ? st.onHand - st.reserved - st.blocked : 0)

/** The ordered walk of one check sequence. Every step accepted or rejected, and why. */
export function walk(net: GatpState, seq: Pick<GSequence, "steps" | "allowPurchase">, req: { materialId: string; qty: number; date: string; today: string; home: string; prefer?: string }): WalkResult {
  const t0 = performance.now()
  const out: WalkStep[] = []
  const plantsInOrder = [req.prefer ?? req.home, ...net.plants.map((p) => p.id).filter((id) => id !== (req.prefer ?? req.home))]
  const stOf = (p: string) => net.stocks.find((x) => x.plantId === p && x.materialId === req.materialId)
  const laneTo = (from: string, to: string) => net.lanes.find((l) => l.from === from && l.to === to)
  let winner: WalkStep | undefined
  let offered: WalkStep | undefined
  const push = (w: WalkStep) => { out.push(w); if (w.ok && !winner) winner = w; if (!w.ok && w.offered && (!offered || w.offered < offered.offered!)) offered = w }
  for (const step of seq.steps) {
    if (winner) {
      out.push({ step, plant: "", ok: false, reached: false, detail: "Not reached: an earlier step accepted" })
      continue
    }
    if (step === "Own plant stock") {
      const p = plantsInOrder[0]
      const a = availOf(stOf(p))
      push(a >= req.qty ? { step, plant: p, ok: true, reached: true, detail: `Available ${a} (on hand less reserved) covers ${req.qty}`, date: req.today } : { step, plant: p, ok: false, reached: true, detail: `Available ${a} is below ${req.qty}` })
    } else if (step === "Partner plant stock and lane transit") {
      for (const p of plantsInOrder.slice(1)) {
        const a = availOf(stOf(p))
        const ln = laneTo(p, plantsInOrder[0])
        if (!ln) { push({ step, plant: p, ok: false, reached: true, detail: "No lane to the requesting plant" }); continue }
        if (a < req.qty) { push({ step, plant: p, ok: false, reached: true, detail: `Available ${a} is below ${req.qty}`, lane: ln.id }); continue }
        if (ln.crossEntity && (!ln.transferPriceValidTo || ln.transferPriceValidTo < req.today)) { push({ step, plant: p, ok: false, reached: true, detail: `Intercompany transfer price expired ${ln.transferPriceValidTo}: a promise may not rely on it until it is renewed`, lane: ln.id }); continue }
        const arrive = addDays(req.today, ln.transitDays)
        push(arrive <= req.date ? { step, plant: p, ok: true, reached: true, detail: `Available ${a}; lane ${ln.id} transit ${ln.transitDays} d; transfer price valid to ${ln.transferPriceValidTo}`, date: arrive, lane: ln.id } : { step, plant: p, ok: false, reached: true, detail: `Arrives ${arrive}, after the requested ${req.date}`, lane: ln.id, offered: arrive })
      }
    } else if (step === "Production CTP") {
      for (const p of plantsInOrder) {
        const st = stOf(p)
        if (!st || !st.validVersion) { push({ step, plant: p, ok: false, reached: true, detail: "No valid production version at this plant" }); continue }
        let cum = st.inbound.filter((i) => i.date <= req.date).reduce((s, i) => s + i.qty, 0)
        const slot = st.slots.find((x) => ((cum += x.qty), cum >= req.qty))
        if (!slot) { push({ step, plant: p, ok: false, reached: true, detail: "Capacity slots do not cover the quantity inside the plan snapshot" }); continue }
        const ln = p === plantsInOrder[0] ? undefined : laneTo(p, plantsInOrder[0])
        if (p !== plantsInOrder[0] && !ln) { push({ step, plant: p, ok: false, reached: true, detail: "No lane to the requesting plant" }); continue }
        if (ln?.crossEntity && (!ln.transferPriceValidTo || ln.transferPriceValidTo < req.today)) { push({ step, plant: p, ok: false, reached: true, detail: `Intercompany transfer price expired ${ln.transferPriceValidTo}`, lane: ln.id }); continue }
        const date = addDays(slot.date, ln?.transitDays ?? 0)
        push(date <= req.date ? { step, plant: p, ok: true, reached: true, detail: `CTP slot ${slot.date}${ln ? ` plus transit ${ln.transitDays} d` : ""}`, date, lane: ln?.id } : { step, plant: p, ok: false, reached: true, detail: `Earliest ${date}, after the requested ${req.date}`, lane: ln?.id, offered: date })
      }
    } else {
      const lead = stOf(plantsInOrder[0])?.purchaseLeadDays
      if (!seq.allowPurchase) push({ step, plant: plantsInOrder[0], ok: false, reached: true, detail: "Policy does not allow purchase lead time for this sequence" })
      else if (lead == null) push({ step, plant: plantsInOrder[0], ok: false, reached: true, detail: "No purchase lead time on the material" })
      else {
        const d = addDays(req.today, lead)
        push(d <= req.date ? { step, plant: plantsInOrder[0], ok: true, reached: true, detail: `Purchase lead time ${lead} d`, date: d } : { step, plant: plantsInOrder[0], ok: false, reached: true, detail: `Lead time ${lead} d arrives ${d}, after the requested ${req.date}`, offered: d })
      }
    }
  }
  return { steps: out, winner, sourcingPlant: winner?.plant, lane: winner?.lane, promiseDate: winner?.date, offered, ms: Math.max(1, Math.round(performance.now() - t0)) }
}

export function sequenceFor(net: GatpState, materialId: string, customerClass: string, includeDraft = false) {
  const g = MATERIAL_GROUPS[materialId]
  const pool = net.sequences.filter((s) => s.group === g && s.customerClass === customerClass && (includeDraft || s.status === "Released"))
  return pool.sort((a, b) => b.version - a.version)[0]
}

/** A soft reservation at the sourcing plant: holds stock or consumes capacity slots (decays like a local reservation). */
export function reserve(net: GatpState, plant: string, materialId: string, step: GStepName, qty: number) {
  const st = net.stocks.find((x) => x.plantId === plant && x.materialId === materialId)
  if (!st) return
  if (step === "Own plant stock" || step === "Partner plant stock and lane transit") st.reserved += qty
  else if (step === "Production CTP") {
    let left = qty
    for (const sl of st.slots) {
      const t = Math.min(sl.qty, left)
      sl.qty -= t
      left -= t
      if (left <= 0) break
    }
  }
}
export const nextSnapshot = (net: GatpState) => `SNAP-TBD-${String(++net.snapSeq).padStart(4, "0")}`
