// INV-CVA-001 Cost Variance Workbench [DOC:p.272] (asserted); rules Book I A §8 [DOC:pp.39-40].
// Filter bar (period range, entity, variance types, item and group, vendor, work center, production order,
// cost center, profit center, only above threshold), one summary tile per variance type with a six-period
// sparkline, a main grid grouped by variance type then item (work center for labor and overhead) whose
// columns switch per type, drill from group to transactions to the journal entry, Pareto and trend charts.
// Actions: filter, drill, export the four report layouts CVA-R1..R4, explain a variance, handle the exception
// list for missing standards. Posts nothing: it reads what GRN, match, subcontract receipt, WO settlement
// (production.orderSettled), standard release and every live posting.posted event wrote.
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Link } from "react-router"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardCard, WorkbenchPage } from "@/components/templates"
import { Chip, KV, type Column } from "@/components/patterns"
import { LEGAL_ENTITIES, MATERIALS, PROFIT_CENTERS, WORK_CENTERS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { itemText, sumStd, sumVar, VARIANCE_TYPES, vendorName } from "../data/logic"
import { acknowledgeException, explainVariance } from "../data/actions"
import { VAR_PERIODS } from "../data/seed"
import type { VarianceRow, VarianceType } from "../data/types"
import { CsvButton, DocLink, Reading, report, useDemoState, VarAmount } from "../components/common"
import { ccName, SelectField, TextField } from "../components/bits"
import { COST_CENTERS } from "@/data/shared"

/** Only-above-threshold toggle: a group counts when its variance is at least this share of its standard basis. A design value (OQ-PF-25). */
const THRESHOLD_PCT = 2
const ALL = "all"
const LABOR: VarianceType[] = ["LRV", "LEV", "OAV"]
const typeIdx = (t: VarianceType) => VARIANCE_TYPES.findIndex((x) => x.code === t)
const entityOf = (r: VarianceRow) => r.entityId ?? "LE-TBD-10"
const keyOf = (r: VarianceRow) => (LABOR.includes(r.type) ? r.workCenterId : r.itemId) ?? "(none)"

interface Group {
  id: string
  type: VarianceType
  key: string
  label: string
  rows: VarianceRow[]
  variance: number
  std: number
  actual: number
  qty: number
  vendors: string
  orders: number
  costCenter: string
  periodText: string
  journals: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (v: number, base: number) => (base ? r2((v / base) * 100) : 0)

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)))
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 56 + 2},${10 - (v / max) * 8}`).join(" ")
  return (
    <svg width="60" height="20" viewBox="0 0 60 20" role="img" aria-label="Six-period trend" className="text-muted-foreground">
      <line x1="2" x2="58" y1="10" y2="10" stroke="currentColor" strokeOpacity="0.3" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function CostVariance() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("INV-CVA-001")
  const [role] = useRole()
  // ---- filter bar (Part A §8.2)
  const [fromP, setFromP] = useState("2026-05")
  const [toP, setToP] = useState("2026-10")
  const [entity, setEntity] = useState(ALL)
  const [types, setTypes] = useState<VarianceType[]>(VARIANCE_TYPES.map((t) => t.code))
  const [item, setItem] = useState(ALL)
  const [group, setGroup] = useState(ALL)
  const [vendor, setVendor] = useState(ALL)
  const [wc, setWc] = useState(ALL)
  const [wo, setWo] = useState(ALL)
  const [cc, setCc] = useState(ALL)
  const [pc, setPc] = useState(ALL)
  const [above, setAbove] = useState(false)
  // ---- view
  const [queue, setQueue] = useState<"all" | VarianceType>("all")
  const [active, setActive] = useState<string | null>(null)
  const [tx, setTx] = useState<VarianceRow | null>(null)
  const [note, setNote] = useState("")

  const inRange = (r: VarianceRow) => r.period >= fromP && r.period <= toP
  const matchesFilters = (r: VarianceRow) =>
    (entity === ALL || entityOf(r) === entity) &&
    types.includes(r.type) &&
    (item === ALL || r.itemId === item) &&
    (group === ALL || (r.itemId && MATERIALS.find((m) => m.id === r.itemId)?.groups.includes(group))) &&
    (vendor === ALL || r.vendorId === vendor) &&
    (wc === ALL || r.workCenterId === wc) &&
    (wo === ALL || r.source.id === wo) &&
    (cc === ALL || r.costCenterId === cc) &&
    (pc === ALL || r.profitCenterId === pc)
  /** Rows in the filters but across every period: R1 and the sparklines need the whole 13-period span. */
  const base = useMemo(() => s.variances.filter(matchesFilters), [s.variances, entity, types, item, group, vendor, wc, wo, cc, pc]) // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => base.filter(inRange), [base, fromP, toP]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, VarianceRow[]>()
    for (const r of filtered) {
      if (queue !== "all" && r.type !== queue) continue
      const k = `${r.type}|${keyOf(r)}`
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()]
      .map(([id, rows]): Group => {
        const [type, key] = id.split("|") as [VarianceType, string]
        const periods = [...new Set(rows.map((r) => r.period))].sort()
        const std = sumStd(rows)
        const variance = sumVar(rows)
        return {
          id, type, key,
          label: LABOR.includes(type) ? (WORK_CENTERS.find((w) => w.id === key)?.name ?? key) : itemText(key),
          rows, variance, std, actual: r2(std + variance), qty: rows.reduce((t, r) => t + r.qty, 0),
          vendors: [...new Set(rows.map((r) => r.vendorId).filter(Boolean))].map((v) => vendorName(s, v)).join(", "),
          orders: new Set(rows.map((r) => r.source.id)).size,
          costCenter: [...new Set(rows.map((r) => r.costCenterId))].join(", "),
          periodText: periods.length === 1 ? periods[0] : `${periods[0]} to ${periods[periods.length - 1]}`,
          journals: `${rows[0].journalId}${rows.length > 1 ? ` +${rows.length - 1}` : ""}`,
        }
      })
      .filter((g) => !above || Math.abs(pct(g.variance, g.std)) >= THRESHOLD_PCT)
      .sort((a, b) => typeIdx(a.type) - typeIdx(b.type) || Math.abs(b.variance) - Math.abs(a.variance))
  }, [filtered, queue, above, s])
  const act = groups.find((g) => g.id === active)
  const je = tx ? s.journal.find((j) => j.id === tx.journalId) : undefined
  const exps = act ? s.explanations.filter((e) => e.type === act.type && e.key === act.key) : []

  // ---- options for the filter selects, from what exists
  const optsOf = <T extends string>(f: (r: VarianceRow) => T | undefined) => [...new Set(s.variances.map(f).filter(Boolean) as T[])].sort()
  const items = optsOf((r) => r.itemId)
  const itemGroups = [...new Set(MATERIALS.filter((m) => items.includes(m.id)).flatMap((m) => m.groups))].sort()
  const vendors = optsOf((r) => r.vendorId)
  const wcs = optsOf((r) => r.workCenterId)
  const wos = optsOf((r) => (r.source.type === "productionOrder" ? r.source.id : undefined))
  const ccs = optsOf((r) => r.costCenterId)
  const periodsShown = VAR_PERIODS.filter((p) => p >= fromP && p <= toP)
  const tilePeriods = (periodsShown.length >= 6 ? periodsShown : VAR_PERIODS.filter((p) => p <= toP)).slice(-6)
  const trend = periodsShown.map((p) => Object.fromEntries([["period", p], ...VARIANCE_TYPES.map((t) => [t.code, sumVar(base.filter((r) => r.type === t.code && r.period === p))])]))
  const pareto = (() => {
    const m = new Map<string, number>()
    for (const r of filtered) m.set(r.itemId ?? r.workCenterId ?? "(none)", (m.get(r.itemId ?? r.workCenterId ?? "(none)") ?? 0) + r.variance)
    return [...m.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 10).map(([k, v]) => ({ name: k.replace(/^(RAW|FIN|SEMI|TRADE|SPARE)-TBD-/, "").replace("VEN-TBD-", "V"), variance: r2(v) }))
  })()
  const cfg: ChartConfig = Object.fromEntries(VARIANCE_TYPES.map((t, i) => [t.code, { label: t.code, color: `var(--chart-${(i % 5) + 1})` }]))

  // ---- grid columns switch per variance type (Part A §8.2)
  const cols = useMemo<Column<Group>[]>(() => {
    const t = queue
    const keyHeader = t === "all" ? "Item / work center" : LABOR.includes(t) ? "Work center" : "Item"
    const out: Column<Group>[] = [
      { id: "type", header: "Type", value: (g) => `${typeIdx(g.type)} ${g.type}`, filterable: true, sortable: true, cell: (g) => <span className="font-mono">{g.type}</span> },
      { id: "id", header: keyHeader, value: (g) => g.key, mono: true, sortable: true },
      { id: "label", header: "Name", value: (g) => g.label, cell: (g) => <span className="line-clamp-1 max-w-[260px]">{g.label}</span> },
      { id: "period", header: "Period", value: (g) => g.periodText, sortable: true },
    ]
    if (t === "PPV" || t === "IPV" || t === "SPV") out.push({ id: "vendors", header: "Vendors", value: (g) => g.vendors, cell: (g) => <span className="line-clamp-1 max-w-[200px]">{g.vendors || "None"}</span> })
    if (t === "MUV" || LABOR.includes(t as VarianceType)) out.push({ id: "orders", header: "Production orders", value: (g) => g.orders, align: "right", mono: true, sortable: true })
    if (t !== "all" && LABOR.includes(t)) out.push({ id: "cc", header: "Cost center", value: (g) => g.costCenter })
    if (t === "RVV") out.push({ id: "qty", header: "On-hand quantity", value: (g) => g.qty, align: "right", mono: true, cell: (g) => fmtNumber(g.qty) })
    out.push(
      { id: "std", header: "Standard basis", value: (g) => g.std, align: "right", mono: true, sortable: true, cell: (g) => fmtMoney(g.std) },
      { id: "actual", header: "Actual", value: (g) => g.actual, align: "right", mono: true, sortable: true, cell: (g) => fmtMoney(g.actual) },
      { id: "var", header: "Variance $", value: (g) => g.variance, align: "right", sortable: true, cell: (g) => <VarAmount v={g.variance} /> },
      { id: "pct", header: "Variance %", value: (g) => pct(g.variance, g.std), align: "right", mono: true, sortable: true, cell: (g) => `${fmtNumber(pct(g.variance, g.std), 2)}%` },
      { id: "n", header: "Transactions", value: (g) => g.rows.length, align: "right", mono: true, sortable: true },
      { id: "gl", header: "GL entry", value: (g) => g.journals, mono: true },
    )
    return out
  }, [queue])

  // ---- the four report layouts (Part A §8.3)
  const r1 = [...VARIANCE_TYPES.map((t) => t.code), "Total"].map((code) => {
    const row: Record<string, string | number> = { "Variance type": code === "Total" ? "Total" : `${code} ${VARIANCE_TYPES.find((t) => t.code === code)!.name}` }
    let tot = 0
    for (const p of VAR_PERIODS) {
      const v = sumVar(base.filter((r) => (code === "Total" || r.type === code) && r.period === p))
      row[p] = v
      tot += v
    }
    row.Total = r2(tot)
    return row
  })
  const r2rows = (() => {
    const ppv = filtered.filter((r) => r.type === "PPV")
    const by = new Map<string, VarianceRow[]>()
    for (const r of ppv) by.set(r.vendorId ?? "(none)", [...(by.get(r.vendorId ?? "(none)") ?? []), r])
    return [...by.entries()].map(([v, rs]) => {
      const std = sumStd(rs)
      const ppvSum = sumVar(rs)
      const pos = new Map<string, number>()
      for (const r of rs) {
        const poId = s.grns.find((g) => g.id === r.source.id)?.poId ?? r.source.id
        pos.set(poId, (pos.get(poId) ?? 0) + r.variance)
      }
      return {
        Vendor: v, "Vendor name": vendorName(s, v), "Received value at standard": std, "Received value at actual": r2(std + ppvSum), "PPV $": ppvSum, "PPV %": pct(ppvSum, std),
        "Top contributing POs": [...pos.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map(([k, x]) => `${k} (${x})`).join("; "),
      }
    })
  })()
  const r3rows = (() => {
    const prod = filtered.filter((r) => ["MUV", "LRV", "LEV", "OAV"].includes(r.type) && r.source.type === "productionOrder")
    const by = new Map<string, VarianceRow[]>()
    for (const r of prod) by.set(r.source.id, [...(by.get(r.source.id) ?? []), r])
    const line = (rows: VarianceRow[]) => {
      const sp = (t: string) => sumVar(rows.filter((r) => r.type === t))
      const stdCost = r2(sumStd(rows.filter((r) => r.type === "MUV")) + sumStd(rows.filter((r) => r.type === "LRV")) + sumStd(rows.filter((r) => r.type === "OAV")))
      const total = sumVar(rows)
      return { qty: rows.find((r) => r.type === "MUV")?.qty ?? rows[0].qty, stdCost, actual: r2(stdCost + total), muv: sp("MUV"), lrv: sp("LRV"), lev: sp("LEV"), oav: sp("OAV"), total, settled: rows.map((r) => r.on).sort().pop() ?? "" }
    }
    const out: Record<string, string | number>[] = []
    const mk = (kind: string, ref: string, l: ReturnType<typeof line>): Record<string, string | number> => ({
      Row: kind, Reference: ref, Item: "", "Product line": "", "Work center": "", "Output qty": l.qty, "Std cost of output": l.stdCost, "Actual cost": l.actual, MUV: l.muv, LRV: l.lrv, LEV: l.lev, OAV: l.oav, "Total variance": l.total, "Settled date": l.settled,
    })
    for (const [woId, rows] of [...by.entries()].sort()) {
      const l = line(rows)
      out.push({ ...mk("Order", woId, l), Item: rows[0].itemId ?? "", "Product line": rows[0].profitCenterId, "Work center": [...new Set(rows.map((r) => r.workCenterId).filter(Boolean))].join(", ") })
    }
    const sub = (kind: string, keyf: (r: VarianceRow) => string | undefined) => {
      const m = new Map<string, VarianceRow[]>()
      for (const r of prod) m.set(keyf(r) ?? "(none)", [...(m.get(keyf(r) ?? "(none)") ?? []), r])
      for (const [k, rows] of [...m.entries()].sort()) out.push(mk(kind, k, line(rows)))
    }
    sub("Subtotal product line", (r) => r.profitCenterId)
    sub("Subtotal work center", (r) => r.workCenterId ?? r.costCenterId)
    return out
  })()
  const r4rows = (() => {
    const m = new Map<string, VarianceRow[]>()
    for (const r of filtered) if (r.itemId && r.qty) m.set(`${r.itemId}|${r.period}`, [...(m.get(`${r.itemId}|${r.period}`) ?? []), r])
    return [...m.entries()].sort().map(([k, rows]) => {
      const [itemId, period] = k.split("|")
      const q = rows.reduce((t, r) => t + Math.abs(r.qty), 0) || 1
      const std = sumStd(rows)
      const v = sumVar(rows)
      return { Period: period, Item: itemId, Standard: r2(std / q), "Actual average": r2((std + v) / q), Variance: v, "Variance %": pct(v, std), "GL posting ref": [...new Set(rows.map((r) => r.journalId))].slice(0, 3).join(", ") }
    })
  })()

  const missing = s.cvaExceptions
  const alertsOpen = missing.filter((x) => !x.acknowledgedBy)

  return (
    <div className="flex flex-col gap-6">
      <WorkbenchPage
        header={{
          screenId: "INV-CVA-001",
          title: "Cost variance workbench",
          description: "Actuals against standard, split into purchase price, usage, labor rate, efficiency, overhead, subcontract and revaluation causes. Positive is unfavorable.",
          chips: role === "Cost accountant" && alertsOpen.length ? <Chip kind="flag">{alertsOpen.length} costing alert{alertsOpen.length > 1 ? "s" : ""} for you</Chip> : undefined,
          actions: st.menu,
          primary: (
            <span className="flex flex-wrap gap-1" role="group" aria-label="Report layouts">
              <CsvButton filename="cva-r1-variance-summary-by-type.csv" rows={r1} label="R1 Summary by type" />
              <CsvButton filename="cva-r2-ppv-by-vendor.csv" rows={r2rows} label="R2 PPV by vendor" />
              <CsvButton filename="cva-r3-production-variances-by-order.csv" rows={r3rows} label="R3 By order" />
              <CsvButton filename="cva-r4-standard-vs-actual-by-item.csv" rows={r4rows} label="R4 Standard vs actual" />
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer aria-hidden="true" /> R1 as PDF
              </Button>
            </span>
          ),
        }}
        kpis={VARIANCE_TYPES.map((t) => {
          const rows = filtered.filter((r) => r.type === t.code)
          const v = sumVar(rows)
          const spark = tilePeriods.map((p) => sumVar(base.filter((r) => r.type === t.code && r.period === p)))
          return { label: `${t.code} ${t.name}`, value: <span className="inline-flex items-center gap-2"><VarAmount v={v} /> <Spark values={spark} /></span>, hint: `${fmtNumber(pct(v, sumStd(rows)), 2)}% of standard · ${t.account}` }
        })}
        queues={[
          { id: "all", label: "All types", count: filtered.length },
          ...VARIANCE_TYPES.map((t) => ({ id: t.code, label: t.code, count: filtered.filter((r) => r.type === t.code).length })),
        ]}
        queue={queue}
        onQueueChange={(q) => (setQueue(q as typeof queue), setActive(null))}
        table={{
          rows: st.empty ? [] : groups,
          columns: cols,
          rowId: (g) => g.id,
          onRowClick: (g) => (setActive(g.id), setTx(null)),
          activeId: active ?? undefined,
          searchText: (g) => `${g.key} ${g.label} ${g.type}`,
          loading: st.loading,
          error: st.error,
          onRetry: st.retry,
          initialSort: { id: "type", dir: "asc" },
          caption: "Grouped by variance type, then item (work center for labor and overhead); column sets follow the selected type",
          empty: { title: "No variances for this filter", body: "Variances arrive from GRN (PPV), three-way match (IPV), WO settlement (MUV, LRV, LEV, OAV), subcontract receipts (SPV) and standard releases (RVV)." },
        }}
        panel={{
          open: !!act,
          onOpenChange: (o) => !o && (setActive(null), setTx(null)),
          title: act ? `${act.type} · ${act.key} · ${act.label}` : "",
          description: act ? `${act.rows.length} transactions · variance ${fmtMoney(act.variance)} (${fmtNumber(pct(act.variance, act.std), 2)}% of standard)` : undefined,
          content: act ? (
            <div className="flex flex-col gap-4">
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...act.rows]
                    .sort((a, b) => b.on.localeCompare(a.on))
                    .slice(0, 60)
                    .map((r) => (
                      <TableRow key={r.id} className="h-8 cursor-pointer text-[13px]" aria-selected={tx?.id === r.id} onClick={() => setTx(r)}>
                        <TableCell>{fmtDate(r.on)}</TableCell>
                        <TableCell>
                          {r.type} {r.reversal && <Chip kind="change">Reversal</Chip>}
                        </TableCell>
                        <TableCell>
                          <DocLink r={r.source} />
                        </TableCell>
                        <TableCell className="text-right">
                          <VarAmount v={r.variance} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {tx && (
                <section aria-label="Journal entry" className="flex flex-col gap-2 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">Journal {tx.journalId}</h3>
                  <dl className="grid grid-cols-2 gap-2">
                    <KV k="Variance type">{VARIANCE_TYPES.find((t) => t.code === tx.type)?.name}</KV>
                    <KV k="Accounts">{VARIANCE_TYPES.find((t) => t.code === tx.type)?.account}</KV>
                    <KV k="Standard basis">{fmtMoney(tx.stdBasis)}</KV>
                    <KV k="Actual">{fmtMoney(tx.actual)}</KV>
                    <KV k="Quantity">{fmtNumber(tx.qty)}</KV>
                    <KV k="Cost / profit center">
                      {tx.costCenterId} {ccName(tx.costCenterId)} / {tx.profitCenterId}
                    </KV>
                    <KV k="Posted">{fmtDate(tx.on)} (period {tx.period})</KV>
                    <KV k="When">{VARIANCE_TYPES.find((t) => t.code === tx.type)?.when}</KV>
                  </dl>
                  {je && <p className="text-xs text-muted-foreground">Journal line in controlling: {je.text}</p>}
                </section>
              )}
              {!tx && <p className="text-sm text-muted-foreground">Choose a transaction to see its journal entry.</p>}
              <section aria-label="Explanations" className="flex flex-col gap-2 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Explanations ({exps.length})</h3>
                {exps.length ? (
                  <ul className="text-sm">
                    {exps.map((e) => (
                      <li key={e.id}>
                        <span className="tabular text-muted-foreground">{fmtDate(e.on)}</span> · {e.role} · {e.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No explanation yet for {act.key} ({act.type}).</p>
                )}
                <TextField id="cva-exp" label="Explain this variance (Cost accountant or Controller)" value={note} onChange={setNote} />
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const r = explainVariance(act.type, act.key, note)
                      report(r, "Explanation recorded")
                      if (r.ok) setNote("")
                    }}
                  >
                    Add explanation
                  </Button>
                </div>
              </section>
            </div>
          ) : null,
        }}
      />
      <section aria-label="Filters" className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Filters</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField id="cva-f" label="Period from" value={fromP} onChange={(v) => setFromP(v > toP ? toP : v)} options={VAR_PERIODS.map((p) => ({ value: p, label: p }))} />
          <SelectField id="cva-t" label="Period to" value={toP} onChange={(v) => setToP(v < fromP ? fromP : v)} options={VAR_PERIODS.map((p) => ({ value: p, label: p }))} />
          <SelectField id="cva-e" label="Entity" value={entity} onChange={setEntity} options={[{ value: ALL, label: "All entities" }, ...LEGAL_ENTITIES.map((e) => ({ value: e.id, label: `${e.id} ${e.name}` }))]} />
          <SelectField id="cva-i" label="Item" value={item} onChange={setItem} options={[{ value: ALL, label: "All items" }, ...items.map((i) => ({ value: i, label: `${i} ${itemText(i).slice(0, 28)}` }))]} />
          <SelectField id="cva-g" label="Item group" value={group} onChange={setGroup} options={[{ value: ALL, label: "All item groups" }, ...itemGroups.map((g) => ({ value: g, label: g }))]} />
          <SelectField id="cva-v" label="Vendor (PPV, IPV, SPV)" value={vendor} onChange={setVendor} options={[{ value: ALL, label: "All vendors" }, ...vendors.map((v) => ({ value: v, label: `${v} ${vendorName(s, v)}` }))]} />
          <SelectField id="cva-w" label="Work center (labor, overhead)" value={wc} onChange={setWc} options={[{ value: ALL, label: "All work centers" }, ...wcs.map((w) => ({ value: w, label: `${w} ${WORK_CENTERS.find((x) => x.id === w)?.name ?? ""}` }))]} />
          <SelectField id="cva-o" label="Production order" value={wo} onChange={setWo} options={[{ value: ALL, label: "All production orders" }, ...wos.map((w) => ({ value: w, label: w }))]} />
          <SelectField id="cva-c" label="Cost center" value={cc} onChange={setCc} options={[{ value: ALL, label: "All cost centers" }, ...ccs.map((c) => ({ value: c, label: `${c} ${COST_CENTERS.find((x) => x.id === c)?.name ?? ""}` }))]} />
          <SelectField id="cva-p" label="Profit center" value={pc} onChange={setPc} options={[{ value: ALL, label: "All profit centers" }, ...PROFIT_CENTERS.map((p) => ({ value: p.id, label: `${p.id} ${p.name}` }))]} />
          <div className="flex items-end gap-2">
            <Switch id="cva-above" checked={above} onCheckedChange={setAbove} />
            <Label htmlFor="cva-above">Only above threshold ({THRESHOLD_PCT}% of standard)</Label>
          </div>
        </div>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="text-sm font-medium">Variance types</legend>
          {VARIANCE_TYPES.map((t) => (
            <label key={t.code} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={types.includes(t.code)} onChange={() => setTypes(types.includes(t.code) ? types.filter((x) => x !== t.code) : [...types, t.code])} />
              {t.code}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          The threshold is a design value <Reading id="OQ-PF-25" />. Entity filters on the source entity; every row here is PE Transformer unless an intercompany posting says otherwise.
        </p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard title="Pareto: largest variances in this view">
          {pareto.length ? (
            <ChartContainer config={{ variance: { label: "Variance", color: "var(--chart-2)" } }} className="h-64 w-full">
              <BarChart data={pareto} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={110} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="variance" fill="var(--color-variance)" />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to chart for this filter.</p>
          )}
        </DashboardCard>
        <DashboardCard title="Monthly trend by type">
          <ChartContainer config={cfg} className="h-64 w-full">
            <LineChart data={trend}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {VARIANCE_TYPES.map((t) => (
                <Line key={t.code} dataKey={t.code} stroke={`var(--color-${t.code})`} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ChartContainer>
        </DashboardCard>
        <DashboardCard title={`Exception list: items with no standard (${missing.length})`} className="lg:col-span-2">
          {missing.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {missing.map((x) => {
                const m = MATERIALS.find((y) => y.id === x.itemId)
                return (
                  <li key={x.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{x.itemId}</span> {m?.description} · {m?.status} · <strong className="font-medium">{x.text}</strong>
                    {x.source && x.source.id !== x.itemId && <DocLink r={x.source} />}
                    {x.acknowledgedBy ? (
                      <Chip kind="design">Alert acknowledged {fmtDate(x.acknowledgedOn)}</Chip>
                    ) : (
                      <>
                        <Chip kind="flag">Alert sent to {x.alertTo}</Chip>
                        {role === "Cost accountant" && (
                          <Button size="sm" variant="outline" onClick={() => report(acknowledgeException(x.id), "Alert acknowledged")}>
                            Acknowledge
                          </Button>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm">Every valued material has a standard.</p>
          )}
          <p className="text-xs text-muted-foreground">
            A receipt or settlement for such an item does not block: it uses the last released standard, or posts at actual with variance zero, and lands here with an alert to the Cost accountant (Part A §8.4).
          </p>
          <Link className="text-sm text-link underline-offset-4 hover:underline" to="/costing/runs">
            Open costing runs
          </Link>
        </DashboardCard>
      </div>
    </div>
  )
}
