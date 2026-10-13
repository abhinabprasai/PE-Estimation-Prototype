// Global search corpus and ranking: materials (also by legacy code), documents, customers, vendors,
// serials and batches (ADR-04, "search everywhere"). Ranking: exact id, id prefix, id contains, text.
import { docLabel, docRoute, type RecordKind } from "@/data/domain"
import { CUSTOMERS, MATERIALS, SPINE_DOCS, VENDORS } from "@/data/shared"
import { store } from "@/store"
import { LEGACY_CODES } from "../data/seed"

export type ResultKind = "Material" | "Document" | "Customer" | "Vendor" | "Serial or batch"
export const RESULT_KINDS: ResultKind[] = ["Material", "Document", "Customer", "Vendor", "Serial or batch"]
export interface SearchResult {
  kind: ResultKind
  id: string
  title: string
  subtitle: string
  route: string
  status?: { kind: RecordKind; value: string }
  /** Extra text matched but not shown in the title (legacy code, vendor batch). */
  extra?: string
}

export function buildCorpus(): SearchResult[] {
  const out: SearchResult[] = []
  const seen = new Set<string>()
  const push = (r: SearchResult) => {
    const k = r.kind + r.id + r.route
    if (seen.has(k)) return
    seen.add(k)
    out.push(r)
  }
  for (const m of MATERIALS) push({ kind: "Material", id: m.id, title: m.id, subtitle: m.description, route: `/inventory/items/${m.id}`, status: { kind: "material", value: m.status }, extra: LEGACY_CODES[m.id] ? `legacy code ${LEGACY_CODES[m.id]}` : undefined })
  for (const c of CUSTOMERS) push({ kind: "Customer", id: c.id, title: c.id, subtitle: c.name, route: `/sales/customers/${c.id}`, status: { kind: "customer", value: c.status } })
  for (const v of VENDORS) push({ kind: "Vendor", id: v.id, title: v.id, subtitle: v.name, route: `/purchasing/vendors/${v.id}`, status: { kind: "vendorOnboarding", value: v.onboarding } })
  for (const s of SPINE_DOCS) {
    const serial = s.ref.type === "serial" || s.ref.type === "batch"
    push({ kind: serial ? "Serial or batch" : "Document", id: s.ref.id, title: s.ref.id, subtitle: `${docLabel(s.ref)} · ${s.title}`, route: docRoute(s.ref), status: s.status, extra: s.summary })
  }
  for (const h of store.search()) {
    if (h.group === "Notifications") continue
    const serial = /^(SN|BAT)-/.test(h.title)
    push({ kind: serial ? "Serial or batch" : h.group === "Master data" ? "Material" : "Document", id: h.title, title: h.title, subtitle: h.subtitle ?? h.group, route: h.route, status: h.status })
  }
  // serials seeded by the hero thread that have no spine header of their own
  for (const n of ["0301", "0302", "0303"]) push({ kind: "Serial or batch", id: `SN-TBD-BSH-${n}`, title: `SN-TBD-BSH-${n}`, subtitle: "Serial · HV bushing, batch BAT-TBD-B0301", route: "/traceability/explorer", extra: "vendor batch HP-26-0412" })
  return out
}

export function rank(r: SearchResult, q: string): number {
  const id = r.id.toLowerCase()
  if (id === q) return 100
  if (id.startsWith(q)) return 80
  if (id.includes(q)) return 60
  if (r.extra && LEGACY_MATCH(r.extra, q)) return 55
  if (r.subtitle.toLowerCase().includes(q)) return 40
  if (r.extra?.toLowerCase().includes(q)) return 20
  return 0
}
const LEGACY_MATCH = (extra: string, q: string) => extra.toLowerCase().startsWith("legacy") && extra.toLowerCase().includes(q)

export function runSearch(corpus: SearchResult[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return corpus
    .map((r) => ({ r, s: rank(r, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.r.id.localeCompare(b.r.id))
    .map((x) => x.r)
}

/** Nearest ids for a "did you mean": edit distance on ids sharing the first two characters. */
export function didYouMean(corpus: SearchResult[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (q.length < 3) return []
  const dist = (a: string, b: string) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
    for (let j = 0; j <= b.length; j++) dp[0][j] = j
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    return dp[a.length][b.length]
  }
  return corpus
    .map((r) => ({ id: r.id, d: dist(q, r.id.toLowerCase().slice(0, q.length + 2)) }))
    .filter((x) => x.d <= 3)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((x) => x.id)
}
