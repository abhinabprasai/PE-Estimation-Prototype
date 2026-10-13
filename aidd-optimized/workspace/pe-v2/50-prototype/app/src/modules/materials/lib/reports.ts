// MM reports MM-R1 to MM-R8 [Book II §17]. Pure builders over the materials slice: each returns
// columns, rows and a headline, so the report screen, the index tiles and the CSV export read the
// same numbers. Where the PRD names a column but not its rule, the rule is a reading (RD-MM-nn) or
// a design value, and the report says so in `notes`.

import { AVL, TODAY, vendorById } from "@/data/shared"
import { daysBetween } from "@/lib/format"
import type { MaterialsState } from "../data/state"
import { allMaterials, onHand, rateOf } from "../data/state"
import { irStatus } from "../data/actions"
import { settlementLines } from "../data/ext-actions"
import { ownerOfBucket } from "./ext-rules"
import { IR_STALE_MONTHS, completeness, eoBucket, isValuated, monthsBetween } from "./rules"

export type Cell = string | number
export interface ReportCol {
  id: string
  header: string
  kind?: "mat" | "num" | "money" | "text"
  filterable?: boolean
}
export interface ReportResult {
  columns: ReportCol[]
  rows: Record<string, Cell>[]
  headline: { label: string; value: string | number }
  notes: string[]
  /** Drill target per row for the first column, when it is not a material. */
  href?: (row: Record<string, Cell>) => string | undefined
}
export interface ReportDef {
  id: string
  title: string
  content: string
  /** Where it feeds or links to. */
  links?: { label: string; to: string }[]
  /** Needs a material picked first (R2). */
  needsMaterial?: boolean
  build: (s: MaterialsState, p: { material?: string }) => ReportResult
}

const BUY_TYPES = ["RAW", "TRADE", "SPARE", "CONS", "PACK"]

function statusSince(s: MaterialsState, id: string) {
  const h = s.history.find((x) => x.materialId === id && x.field === "Status")
  return h?.at
}

export const REPORTS: ReportDef[] = [
  {
    id: "MM-R1",
    title: "Master data completeness",
    content: "KPI drill per §16.4: by type, owner and view; row-level missing-field list; export.",
    links: [{ label: "Data quality dashboard", to: "/materials/data-quality" }],
    build(s) {
      const mats = allMaterials(s).filter((m) => m.status === "Active" || m.status === "Data Completion")
      const rows = mats.flatMap((m) => {
        const c = completeness(m, s.views[m.id])
        const steward = s.views[m.id]?.stewardId ?? ""
        const byView = new Map<string, string[]>()
        for (const x of c.missing) {
          const [view, ...rest] = x.split(": ")
          byView.set(view, [...(byView.get(view) ?? []), rest.join(": ")])
        }
        if (!byView.size) return [{ material: m.id, type: m.type, status: m.status, owner: steward, view: "All views", pct: c.pct, missing: "Complete" }]
        return [...byView.entries()].map(([view, miss]) => ({ material: m.id, type: m.type, status: m.status, owner: steward, view, pct: c.pct, missing: miss.join("; ") }))
      })
      const avg = mats.length ? Math.round(mats.reduce((a, m) => a + completeness(m, s.views[m.id]).pct, 0) / mats.length) : 100
      return {
        columns: [
          { id: "material", header: "Material", kind: "mat" },
          { id: "type", header: "Type", filterable: true },
          { id: "status", header: "Lifecycle", filterable: true },
          { id: "owner", header: "Steward", filterable: true },
          { id: "view", header: "View with gaps", filterable: true },
          { id: "pct", header: "Complete %", kind: "num" },
          { id: "missing", header: "Missing fields" },
        ],
        rows,
        headline: { label: "Average completeness", value: `${avg}%` },
        notes: ["Completeness uses a subset of each view's mandatory fields (RD-MM-16)."],
      }
    },
  },
  {
    id: "MM-R2",
    title: "Where-used explosion",
    content: "Multi-level where-used for any material across BOMs, plans, price rows, info records and source lists.",
    needsMaterial: true,
    links: [{ label: "Material detail", to: "/inventory/items" }],
    build(s, p) {
      const id = p.material ?? ""
      const rows: Record<string, Cell>[] = []
      const walk = (child: string, level: number, mult: number, seen: string[]) => {
        for (const e of s.x.bom.filter((b) => b.child === child)) {
          if (seen.includes(e.parent)) continue
          rows.push({ level, kind: "BOM parent", reference: e.parent, via: child, qty: mult * e.qty, note: `${e.qty} per ${e.parent}` })
          walk(e.parent, level + 1, mult * e.qty, [...seen, e.parent])
        }
      }
      if (id) {
        walk(id, 1, 1, [id])
        for (const w of s.views[id]?.whereUsed ?? []) rows.push({ level: 1, kind: w.kind, reference: w.ref, via: id, qty: "", note: w.note ?? "" })
        for (const r of s.infoRecords.filter((x) => x.materialId === id)) rows.push({ level: 1, kind: "Info record", reference: r.id, via: id, qty: "", note: r.vendorId })
        for (const r of s.sourceList.filter((x) => x.materialId === id)) rows.push({ level: 1, kind: "Source list row", reference: r.vendorId, via: id, qty: "", note: r.blocked ? "Blocked" : r.fixed ? "Fixed source" : "Valid" })
        for (const r of s.salesPrices.filter((x) => x.materialId === id)) rows.push({ level: 1, kind: "Price row", reference: r.priceListId ?? r.customerId ?? r.id, via: id, qty: "", note: `${r.kind}, ${r.status}` })
        for (const r of s.safetyStock.filter((x) => x.materialId === id)) rows.push({ level: 1, kind: "Safety stock plan", reference: r.warehouseId, via: id, qty: "", note: `SS ${r.ss ?? r.defaultSs} ${r.uom}` })
      }
      return {
        columns: [
          { id: "level", header: "Level", kind: "num", filterable: true },
          { id: "kind", header: "Kind", filterable: true },
          { id: "reference", header: "Reference" },
          { id: "via", header: "Through", kind: "mat" },
          { id: "qty", header: "Cumulative qty per top parent", kind: "num" },
          { id: "note", header: "Note" },
        ],
        rows,
        headline: { label: "References", value: rows.length },
        notes: ["BOM edges are seeded here and owned by engineering; other references come from the material's own records (RD-MM-32, RD-MM-38)."],
      }
    },
  },
  {
    id: "MM-R3",
    title: "Sourcing coverage",
    content: "Buy materials by AVL rows, active info record, source list state and lead time; gaps highlighted: no source, single source on A-class, stale basis.",
    links: [{ label: "Info records", to: "/purchasing/info-records" }, { label: "Source lists", to: "/purchasing/source-lists" }],
    build(s) {
      const mats = allMaterials(s).filter((m) => m.status === "Active" && BUY_TYPES.includes(m.type) && s.views[m.id]?.procurement !== "Make")
      const rows = mats.map((m) => {
        const avl = AVL.filter((a) => a.itemId === m.id)
        const irs = s.infoRecords.filter((x) => x.materialId === m.id)
        const activeIr = irs.filter((x) => irStatus(s, x.id, TODAY) === "Active")
        const src = s.sourceList.filter((x) => x.materialId === m.id && !x.blocked && x.validFrom <= TODAY && (!x.validTo || x.validTo >= TODAY))
        const vendors = new Set([...avl.map((a) => a.vendorId), ...activeIr.map((x) => x.vendorId), ...src.map((x) => x.vendorId)])
        const abc = s.views[m.id]?.abc ?? "C"
        const stale = irs.length > 0 && irs.every((x) => monthsBetween(x.actuals.find((a) => a.kind === "Last PO")?.on ?? x.validFrom, TODAY) > IR_STALE_MONTHS)
        const gaps: string[] = []
        if (!avl.length && !activeIr.length && !src.length) gaps.push("No source")
        else if (abc === "A" && vendors.size <= 1) gaps.push("Single source on A-class")
        if (stale) gaps.push("Stale basis")
        return { material: m.id, abc, avl: avl.length, ir: activeIr.length, src: src.length, lead: s.views[m.id]?.plannedDeliveryDays ?? "", gap: gaps.join("; ") || "Covered" }
      })
      return {
        columns: [
          { id: "material", header: "Material", kind: "mat" },
          { id: "abc", header: "ABC", filterable: true },
          { id: "avl", header: "AVL rows", kind: "num" },
          { id: "ir", header: "Active info records", kind: "num" },
          { id: "src", header: "Valid source list rows", kind: "num" },
          { id: "lead", header: "Lead time (d)", kind: "num" },
          { id: "gap", header: "Gap", filterable: true },
        ],
        rows,
        headline: { label: "Materials with a gap", value: rows.filter((r) => r.gap !== "Covered").length },
        notes: [`Stale basis: last purchase-order price older than ${IR_STALE_MONTHS} months (Book II §7.3).`],
      }
    },
  },
  {
    id: "MM-R4",
    title: "Slow-moving and dead stock",
    content: "No consumption in 6, 12 or 24 months, with on-hand value, last movement and a disposition suggestion; feeds the E&O run.",
    links: [{ label: "E&O reserve run", to: "/materials/eo-reserve" }],
    build(s) {
      const rows = allMaterials(s)
        .filter((m) => isValuated(m.type))
        .flatMap((m) => {
          const stock = s.stock.filter((r) => r.materialId === m.id && r.qty > 0 && r.bucket !== "Consignment" && r.bucket !== "Customer Property")
          if (!stock.length) return []
          const last = stock.map((r) => r.lastMovement).sort().at(-1)!
          const months = monthsBetween(last, TODAY)
          if (months < 6) return []
          const bucket = eoBucket(last, TODAY)
          const value = onHand(s, m.id) * rateOf(s, m.id)
          const disposition = months >= 24 ? "Scrap or return to vendor" : months >= 12 ? "Sell off or rework" : "Review demand and reorder point"
          return [{ material: m.id, type: m.type, last, months, bucket, qty: onHand(s, m.id), value: Math.round(value), disposition }]
        })
      return {
        columns: [
          { id: "material", header: "Material", kind: "mat" },
          { id: "type", header: "Type", filterable: true },
          { id: "last", header: "Last movement" },
          { id: "months", header: "Months idle", kind: "num" },
          { id: "bucket", header: "E&O bucket", filterable: true },
          { id: "qty", header: "On hand", kind: "num" },
          { id: "value", header: "Value", kind: "money" },
          { id: "disposition", header: "Disposition suggestion (design)", filterable: true },
        ],
        rows,
        headline: { label: "Value idle 6 months or more", value: `$${rows.reduce((a, r) => a + Number(r.value), 0).toLocaleString("en-US")}` },
        notes: ["Consumption age is taken from the last stock movement (RD-MM-21). The disposition suggestion is a design value."],
      }
    },
  },
  {
    id: "MM-R5",
    title: "Supersession status",
    content: "Open supersessions with run-out progress, remaining predecessor stock and blocked documents.",
    links: [{ label: "Supersessions", to: "/materials/supersessions" }],
    build(s) {
      const rows = s.supersessions
        .filter((x) => x.stage !== "Closed" && x.stage !== "Rejected")
        .map((x) => {
          const left = onHand(s, x.predecessorId)
          const progress = x.startQty > 0 ? Math.max(0, Math.min(100, Math.round(((x.startQty - left) / x.startQty) * 100))) : x.stage === "Approved, run-out" ? 0 : ""
          return { supersession: x.id, predecessor: x.predecessorId, successor: x.successorId, stage: x.stage, policy: x.policy, effective: x.effective, startQty: x.startQty, left, progress, blocked: x.tasks.filter((t) => !t.done).length }
        })
      return {
        columns: [
          { id: "supersession", header: "Supersession" },
          { id: "predecessor", header: "Predecessor", kind: "mat" },
          { id: "successor", header: "Successor" },
          { id: "stage", header: "Stage (text, OQ-21)", filterable: true },
          { id: "policy", header: "Policy", filterable: true },
          { id: "effective", header: "Effective" },
          { id: "startQty", header: "Stock at approval", kind: "num" },
          { id: "left", header: "Predecessor stock left", kind: "num" },
          { id: "progress", header: "Run-out %", kind: "num" },
          { id: "blocked", header: "Open tasks (blocked documents)", kind: "num" },
        ],
        rows,
        headline: { label: "Open supersessions", value: rows.length },
        notes: ["Run-out progress is predecessor stock against stock at approval (RD-MM-18)."],
        href: (r) => `/materials/supersessions?id=${r.supersession}`,
      }
    },
  },
  {
    id: "MM-R6",
    title: "Consignment position",
    content: "By vendor: on-hand consignment quantity, memo value, period withdrawals, unsettled balance against 2120.",
    links: [{ label: "Consignment settlement", to: "/inventory/consignment-settlement" }],
    build(s) {
      const vendors = [...new Set([...s.stock.filter((r) => r.bucket === "Consignment").map((r) => r.pegRef ?? ""), ...s.x.withdrawals.map((w) => w.vendorId)])].filter(Boolean)
      const rows = vendors.map((v) => {
        const stock = s.stock.filter((r) => r.bucket === "Consignment" && r.pegRef === v)
        const memo = stock.reduce((a, r) => a + r.qty * rateOf(s, r.materialId), 0)
        const month = TODAY.slice(0, 7)
        const period = s.x.withdrawals.filter((w) => w.vendorId === v && w.on.startsWith(month)).reduce((a, w) => a + w.qty, 0)
        const unsettled = s.x.withdrawals.filter((w) => w.vendorId === v && !w.settledIn)
        const bal = [...new Set(unsettled.map((w) => w.on.slice(0, 7)))].flatMap((p) => settlementLines(s, v, p)).reduce((a, l) => a + l.amount, 0)
        return { vendor: `${v} ${vendorById(v)?.name ?? ""}`.trim(), qty: stock.reduce((a, r) => a + r.qty, 0), memo: Math.round(memo), period, unsettledLines: unsettled.length, balance: Math.round(bal * 100) / 100 }
      })
      return {
        columns: [
          { id: "vendor", header: "Vendor" },
          { id: "qty", header: "On-hand consignment qty", kind: "num" },
          { id: "memo", header: "Memo value", kind: "money" },
          { id: "period", header: "Withdrawn this period (qty)", kind: "num" },
          { id: "unsettledLines", header: "Unsettled withdrawals", kind: "num" },
          { id: "balance", header: "Unsettled balance (2120)", kind: "money" },
        ],
        rows,
        headline: { label: "Unsettled against 2120", value: `$${rows.reduce((a, r) => a + Number(r.balance), 0).toLocaleString("en-US")}` },
        notes: ["Memo value uses the material's valuation rate; consignment has no commitment value on the ledger until withdrawn (§14.1)."],
      }
    },
  },
  {
    id: "MM-R7",
    title: "Special stock overview",
    content: "All §14.1 buckets by material and warehouse with document references.",
    links: [{ label: "Special stock", to: "/inventory/special-stock" }],
    build(s) {
      const rows = s.stock.map((r) => ({ material: r.materialId, warehouse: r.warehouseId, bin: r.bin, bucket: r.bucket, qty: r.qty, status: r.status, owner: ownerOfBucket(r.bucket, r.pegRef), doc: r.grnId ?? r.pegRef ?? "" }))
      return {
        columns: [
          { id: "material", header: "Material", kind: "mat" },
          { id: "warehouse", header: "Warehouse", filterable: true },
          { id: "bin", header: "Bin" },
          { id: "bucket", header: "Bucket", filterable: true },
          { id: "qty", header: "Qty", kind: "num" },
          { id: "status", header: "Stock status", filterable: true },
          { id: "owner", header: "Owner" },
          { id: "doc", header: "Document reference" },
        ],
        rows,
        headline: { label: "Special-stock rows", value: rows.filter((r) => r.bucket !== "Own").length },
        notes: [],
      }
    },
  },
  {
    id: "MM-R8",
    title: "Lifecycle funnel",
    content: "Materials by status with aging; Restricted and Blocked with reason codes and owner.",
    links: [{ label: "Lifecycle dialogs", to: "/inventory/dialogs/lifecycle" }],
    build(s) {
      const rows = allMaterials(s).map((m) => {
        const since = statusSince(s, m.id)
        const reasons = m.blocks.map((b) => `${b.block}: ${b.reason}`).join("; ")
        return { material: m.id, type: m.type, status: m.status, since: since ?? "", age: since ? daysBetween(since, TODAY) : "", reason: m.status === "Restricted" || m.status === "Blocked" || reasons ? reasons || "No reason code recorded" : "", owner: s.views[m.id]?.stewardId ?? "" }
      })
      return {
        columns: [
          { id: "material", header: "Material", kind: "mat" },
          { id: "type", header: "Type", filterable: true },
          { id: "status", header: "Lifecycle", filterable: true },
          { id: "since", header: "In status since" },
          { id: "age", header: "Age (days)", kind: "num" },
          { id: "reason", header: "Block reason code" },
          { id: "owner", header: "Owner (steward)", filterable: true },
        ],
        rows,
        headline: { label: "Restricted or Blocked", value: rows.filter((r) => r.status === "Restricted" || r.status === "Blocked").length },
        notes: ["Age counts from the last recorded status change; a seeded material with no recorded change shows no age."],
      }
    },
  },
]
export const reportById = (id: string) => REPORTS.find((r) => r.id === id)

export function toCsv(r: ReportResult) {
  const esc = (v: Cell) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  return [r.columns.map((c) => esc(c.header)).join(","), ...r.rows.map((row) => r.columns.map((c) => esc(row[c.id] ?? "")).join(","))].join("\n")
}
