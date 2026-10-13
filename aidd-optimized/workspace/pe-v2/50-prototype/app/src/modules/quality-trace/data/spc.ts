// SPC arithmetic for FX-QM-SPC (DEC-09, Phase 2): individuals chart with moving-range sigma,
// capability (Cp, Cpk), and trend signals on a locked baseline. The rule set and the capability
// bands are design values (reading QT-R29); the specification names only "control charts,
// capability, trend alerts on IP-INP/FIN characteristics" [DOC:p.37 DEC-09].

import type { SpcSeries } from "./extra-types"

export const BASELINE_N = 20
export const CPK_CAPABLE = 1.33
export const CPK_MARGINAL = 1.0

export interface SpcStats {
  n: number
  baselineMean: number
  sigma: number
  ucl: number
  lcl: number
  mean: number
  cp?: number
  cpk?: number
  band: "Capable" | "Marginal" | "Not capable" | "No limits"
}
export interface SpcSignal {
  rule: "R1" | "R2" | "R3" | "R4"
  idx: number
  at: string
  ref: string
  detail: string
  key: string
}
export const RULES: Record<SpcSignal["rule"], string> = {
  R1: "One point beyond 3 sigma",
  R2: "Seven points in a row on one side of the centre line",
  R3: "Six points in a row rising or falling",
  R4: "Two of three points beyond 2 sigma on the same side",
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)

export function statsOf(s: SpcSeries): SpcStats {
  const v = s.points.map((p) => p.value)
  const base = v.slice(0, BASELINE_N)
  const mr = base.slice(1).map((x, i) => Math.abs(x - base[i]))
  const sigma = (avg(mr) / 1.128) || 1e-9
  const baselineMean = avg(base)
  const mean = avg(v)
  let cp: number | undefined
  let cpk: number | undefined
  if (s.usl != null && s.lsl != null) cp = (s.usl - s.lsl) / (6 * sigma)
  const up = s.usl != null ? (s.usl - mean) / (3 * sigma) : undefined
  const lo = s.lsl != null ? (mean - s.lsl) / (3 * sigma) : undefined
  if (up != null || lo != null) cpk = Math.min(up ?? Infinity, lo ?? Infinity)
  const band: SpcStats["band"] = cpk == null ? "No limits" : cpk >= CPK_CAPABLE ? "Capable" : cpk >= CPK_MARGINAL ? "Marginal" : "Not capable"
  return { n: v.length, baselineMean, sigma, ucl: baselineMean + 3 * sigma, lcl: baselineMean - 3 * sigma, mean, cp, cpk, band }
}

export function signalsOf(s: SpcSeries): SpcSignal[] {
  const st = statsOf(s)
  const out: SpcSignal[] = []
  const v = s.points.map((p) => p.value)
  const side = (x: number) => (x > st.baselineMean ? 1 : x < st.baselineMean ? -1 : 0)
  const add = (rule: SpcSignal["rule"], idx: number, detail: string) => out.push({ rule, idx, at: s.points[idx].at, ref: s.points[idx].ref, detail, key: `${s.id}|${rule}|${s.points[idx].at}` })
  for (let i = 0; i < v.length; i++) {
    if (v[i] > st.ucl || v[i] < st.lcl) add("R1", i, `${v[i].toFixed(2)} ${s.unit} is beyond the ${v[i] > st.ucl ? "upper" : "lower"} control limit`)
    if (i >= 6 && v.slice(i - 6, i + 1).every((x) => side(x) === side(v[i]) && side(x) !== 0) && !(i >= 7 && v.slice(i - 7, i).every((x) => side(x) === side(v[i])))) add("R2", i, `Seven points in a row ${side(v[i]) > 0 ? "above" : "below"} the centre line (${s.points[i - 6].ref} to ${s.points[i].ref})`)
    if (i >= 5) {
      const w = v.slice(i - 5, i + 1)
      const up = w.every((x, k) => k === 0 || x > w[k - 1])
      const dn = w.every((x, k) => k === 0 || x < w[k - 1])
      if ((up || dn) && !(i >= 6 && (up ? v[i - 6] < v[i - 5] : v[i - 6] > v[i - 5]))) add("R3", i, `Six points in a row ${up ? "rising" : "falling"} (${s.points[i - 5].ref} to ${s.points[i].ref})`)
    }
    if (i >= 2) {
      const w = v.slice(i - 2, i + 1)
      const hi = w.filter((x) => x > st.baselineMean + 2 * st.sigma).length
      const lo = w.filter((x) => x < st.baselineMean - 2 * st.sigma).length
      if ((hi >= 2 && v[i] > st.baselineMean + 2 * st.sigma) || (lo >= 2 && v[i] < st.baselineMean - 2 * st.sigma)) add("R4", i, `Two of three points beyond 2 sigma on the ${hi >= 2 ? "high" : "low"} side`)
    }
  }
  // a sustained excursion raises one alert per rule, not one per point: keep the first of a run
  const last: Partial<Record<SpcSignal["rule"], number>> = {}
  return out.filter((g) => {
    const prev = last[g.rule]
    last[g.rule] = g.idx
    return prev == null || g.idx - prev > 1
  })
}
