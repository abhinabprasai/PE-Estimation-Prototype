// INV-CVA-001 Cost Variance Workbench [DOC:p.272] (asserted); rules Book I A §8.
// Summary tiles per variance type with trends, grouped grid with drill to transaction and journal in
// three clicks, pareto and trend charts. Actions: filter, drill, export the four report layouts.
// Creates explanations and the exception list for missing standards. Posts nothing: it reads what
// others posted (GRN, match, WO settlement, standard release) and every live posting.posted event.
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Link } from "react-router"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardCard, WorkbenchPage } from "@/components/templates"
import { Chip, KV, type Column } from "@/components/patterns"
import { MATERIALS, WORK_CENTERS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { itemText, sumStd, sumVar, VARIANCE_TYPES, vendorName } from "../data/logic"
import type { VarianceRow, VarianceType } from "../data/types"
import { CsvButton, DocLink, useDemoState, VarAmount } from "../components/common"
import { ccName, SelectField } from "../components/bits"

type GroupBy = "item" | "vendor" | "workCenter" | "source" | "period"
interface Group {
  id: string
  label: string
  rows: VarianceRow[]
  variance: number
  std: number
  types: string
}
const keyOf = (r: VarianceRow, g: GroupBy) => (g === "item" ? r.itemId : g === "vendor" ? r.vendorId : g === "workCenter" ? r.workCenterId : g === "source" ? r.source.id : r.period) ?? "(none)"
const PERIODS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]

export function CostVariance() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("INV-CVA-001")
  const [type, setType] = useState<"all" | VarianceType>("all")
  const [period, setPeriod] = useState("all")
  const [group, setGroup] = useState<GroupBy>("item")
  const [active, setActive] = useState<string | null>(null)
  const [tx, setTx] = useState<VarianceRow | null>(null)

  const filtered = useMemo(() => s.variances.filter((r) => (type === "all" || r.type === type) && (period === "all" || r.period === period)), [s, type, period])
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, VarianceRow[]>()
    for (const r of filtered) {
      const k = keyOf(r, group)
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()].map(([id, rows]) => ({
      id,
      label: group === "item" ? itemText(id) : group === "vendor" ? vendorName(s, id) : group === "workCenter" ? (WORK_CENTERS.find((w) => w.id === id)?.name ?? id) : id,
      rows,
      variance: sumVar(rows),
      std: sumStd(rows),
      types: [...new Set(rows.map((r) => r.type))].join(", "),
    }))
  }, [filtered, group, s])
  const act = groups.find((g) => g.id === active)
  const periodRows = (t: VarianceType) => PERIODS.map((p) => sumVar(s.variances.filter((r) => r.type === t && r.period === p)))
  const trend = PERIODS.map((p) => Object.fromEntries([["period", p], ...VARIANCE_TYPES.map((t) => [t.code, sumVar(s.variances.filter((r) => r.type === t.code && r.period === p))])]))
  const pareto = [...groups].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).slice(0, 10).map((g) => ({ name: g.id.replace("RAW-TBD-", "").replace("FIN-TBD-", "").replace("VEN-TBD-", "V"), variance: g.variance }))
  const missing = MATERIALS.filter((m) => ["RAW", "SEMI", "FIN", "SPARE", "TRADE", "PACK"].includes(m.type) && m.stdCost == null && !s.standards[m.id])
  const je = tx ? s.journal.find((j) => j.id === tx.journalId) : undefined

  const cols: Column<Group>[] = [
    { id: "id", header: group === "item" ? "Item" : group === "vendor" ? "Vendor" : group === "workCenter" ? "Work center" : group === "source" ? "Source document" : "Period", value: (g) => g.id, mono: true, sortable: true },
    { id: "label", header: "Name", value: (g) => g.label, cell: (g) => <span className="line-clamp-1 max-w-[280px]">{g.label}</span> },
    { id: "types", header: "Types", value: (g) => g.types, filterable: true },
    { id: "n", header: "Transactions", value: (g) => g.rows.length, align: "right", mono: true, sortable: true },
    { id: "std", header: "Standard basis", value: (g) => g.std, align: "right", mono: true, sortable: true, cell: (g) => fmtMoney(g.std) },
    { id: "var", header: "Variance", value: (g) => g.variance, align: "right", sortable: true, cell: (g) => <VarAmount v={g.variance} /> },
    { id: "pct", header: "% of standard", value: (g) => (g.std ? (g.variance / g.std) * 100 : 0), align: "right", mono: true, sortable: true, cell: (g) => (g.std ? `${fmtNumber((g.variance / g.std) * 100, 2)}%` : "") },
  ]
  const layout = (name: string, by: GroupBy) => {
    const m = new Map<string, VarianceRow[]>()
    for (const r of filtered) m.set(keyOf(r, by), [...(m.get(keyOf(r, by)) ?? []), r])
    return { name, rows: [...m.entries()].map(([k, rs]) => ({ [by]: k, transactions: rs.length, standard: sumStd(rs), variance: sumVar(rs) })) }
  }
  const layouts = [layout("variance-by-item.csv", "item"), layout("variance-by-vendor.csv", "vendor"), layout("variance-by-work-center.csv", "workCenter"), layout("variance-by-period.csv", "period")]
  const cfg: ChartConfig = Object.fromEntries(VARIANCE_TYPES.map((t, i) => [t.code, { label: t.code, color: `var(--chart-${(i % 5) + 1})` }]))

  return (
    <div className="flex flex-col gap-6">
      <WorkbenchPage
        header={{
          screenId: "INV-CVA-001",
          title: "Cost variance workbench",
          description: "Actuals against standard, split into purchase price, usage, labor rate, efficiency, overhead, subcontract and revaluation causes. Positive is unfavorable.",
          actions: (
            <>
              {st.menu}
              <div className="w-40">
                <SelectField id="cva-p" label="Period" value={period} onChange={setPeriod} options={[{ value: "all", label: "All periods" }, ...PERIODS.map((p) => ({ value: p, label: p }))]} />
              </div>
              <div className="w-44">
                <SelectField id="cva-g" label="Group by" value={group} onChange={(v) => (setGroup(v), setActive(null))} options={[{ value: "item", label: "Item" }, { value: "vendor", label: "Vendor" }, { value: "workCenter", label: "Work center" }, { value: "source", label: "Source document" }, { value: "period", label: "Period" }]} />
              </div>
            </>
          ),
          primary: (
            <span className="flex flex-wrap gap-1">
              {layouts.map((l) => (
                <CsvButton key={l.name} filename={l.name} rows={l.rows} label={l.name.replace("variance-", "").replace(".csv", "")} />
              ))}
            </span>
          ),
        }}
        kpis={VARIANCE_TYPES.map((t) => {
          const v = sumVar(s.variances.filter((r) => r.type === t.code && (period === "all" || r.period === period)))
          const tr = periodRows(t.code)
          return { label: `${t.code} ${t.name}`, value: <VarAmount v={v} />, hint: `${t.account} · trend ${tr.map((x) => (x > 0 ? "▲" : x < 0 ? "▼" : "·")).join("")}` }
        })}
        queues={[{ id: "all", label: "All types", count: s.variances.filter((r) => period === "all" || r.period === period).length }, ...VARIANCE_TYPES.map((t) => ({ id: t.code, label: t.code, count: s.variances.filter((r) => r.type === t.code && (period === "all" || r.period === period)).length }))]}
        queue={type}
        onQueueChange={(q) => (setType(q as typeof type), setActive(null))}
        table={{
          rows: st.empty ? [] : groups,
          columns: cols,
          rowId: (g) => g.id,
          onRowClick: (g) => (setActive(g.id), setTx(null)),
          activeId: active ?? undefined,
          searchText: (g) => `${g.id} ${g.label}`,
          loading: st.loading,
          error: st.error,
          onRetry: st.retry,
          initialSort: { id: "var", dir: "desc" },
          empty: { title: "No variances for this filter", body: "Variances arrive from GRN (PPV), three-way match (IPV), WO settlement (MUV, LRV, LEV, OAV), subcontract receipts (SPV) and standard releases (RVV)." },
        }}
        panel={{
          open: !!act,
          onOpenChange: (o) => !o && (setActive(null), setTx(null)),
          title: act ? `${act.id} · ${act.label}` : "",
          description: act ? `${act.rows.length} transactions · variance ${fmtMoney(act.variance)}` : undefined,
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
            </div>
          ) : null,
        }}
      />
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
        <DashboardCard title="Trend by period and type">
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
        <DashboardCard title={`Exceptions: missing standards (${missing.length})`} className="lg:col-span-2">
          {missing.length ? (
            <ul className="text-sm">
              {missing.map((m) => (
                <li key={m.id}>
                  <span className="font-mono">{m.id}</span> {m.description} · {m.status}: no standard cost, so receipts and issues cannot split a variance. Roll it on the next costing run.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">Every valued material has a standard.</p>
          )}
          <Link className="text-sm text-link underline-offset-4 hover:underline" to="/costing/runs">
            Open costing runs
          </Link>
        </DashboardCard>
      </div>
    </div>
  )
}
