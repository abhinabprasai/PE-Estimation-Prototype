// FX-PRD-REPORTS Production reports (six) [DOC:p.82 Book I D §12]. /production/reports is the index
// with a headline per report; /production/reports/:id is the report. Reports are read-only views over
// the live records (plus seeded prior months for trends); export is a CSV of what is on screen.

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Chip, EmptyState, RulesPanel, type Column } from "@/components/patterns"
import { DataTable } from "@/components/patterns/DataTable"
import { DashboardCard, DashboardPage, PageHeader } from "@/components/templates"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { StateBanner, StatePreview, WoLink, matDesc, useScreenState, userName, Item, SoLink } from "../components"
import { WipAging } from "../widgets/WipAging"
import * as R from "../lib/reports"
import type { ReportId } from "../lib/reports"

function download(name: string, header: string[], rows: (string | number)[][]) {
  const csv = [header.join(","), ...rows.map((r) => r.map((x) => (typeof x === "string" && /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(","))].join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
const ExportBtn = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => <Button variant="outline" size="sm" disabled={disabled} onClick={onClick}><Download aria-hidden="true" /> Export CSV</Button>
const Tag = ({ s }: { s: string }) => <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${s === "Late" ? "border-status-exception" : ""}`}>{s}</span>

export function ReportsIndex() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PRD-REPORTS")
  const status = R.orderStatus(s)
  const scrap = R.scrapRows(s)
  const eff = R.efficiency(s, "wc")
  const thr = R.throughput(s)
  const aging = R.wipAging(s)
  const lastMonth = thr.at(-1)?.month
  const headline: Record<ReportId, string> = {
    "order-status": `${status.filter((r) => r.state === "Late").length} late, ${status.filter((r) => r.state === "At risk").length} at risk of ${status.length} open`,
    "scrap-pareto": `${fmtMoney(R.pareto(scrap, "reason")[0]?.value ?? 0)} top cause: ${R.pareto(scrap, "reason")[0]?.key.split(" ")[0] ?? "none"}`,
    efficiency: eff.length ? `${Math.round((eff.reduce((a, r) => a + r.earned, 0) / Math.max(1, eff.reduce((a, r) => a + r.actual, 0))) * 100)}% earned over actual, 90 days` : "no confirmed hours",
    throughput: `${thr.filter((r) => r.month === lastMonth).reduce((a, r) => a + r.units, 0)} units in ${lastMonth ?? "the latest period"}`,
    "wip-aging": `${aging.filter((r) => r.stalled).length} stalled of ${aging.length} open orders`,
    genealogy: `${s.productionOrders.reduce((a, w) => a + w.serials.length, 0)} serials on file`,
  }
  return (
    <DashboardPage
      header={{
        title: "Production reports",
        screenId: "FX-PRD-REPORTS",
        description: "The six production reports of the specification. Each opens as its own view with filters and an export.",
        actions: <StatePreview extended />,
        chips: <Chip kind="design" note="The six reports and their content are the PRD's [DOC:p.82]; layouts, trend history and the stalled-days value are prototype values">Layouts: design</Chip>,
      }}
    >
      {st.loading ? <div className="col-span-full flex flex-col gap-2" aria-busy="true" aria-label="Loading"><div className="h-24 rounded-lg border" /><div className="h-24 rounded-lg border" /></div>
        : st.error ? <p role="alert" className="col-span-full rounded-md border border-status-blocked px-4 py-2 text-sm">{st.error} <button className="underline" onClick={st.retry}>Try again</button></p>
        : st.empty ? <div className="col-span-full"><EmptyState title="No report data">Reports fill as orders are confirmed.</EmptyState></div>
        : R.REPORTS.map((r) => (
          <DashboardCard key={r.id} title={r.title} action={<Link className="text-sm font-normal text-link underline-offset-4 hover:underline" to={`/production/reports/${r.id}`}>Open</Link>}>
            <p className="text-sm text-muted-foreground">{r.blurb}</p>
            <p className="tabular text-lg font-semibold">{headline[r.id]}</p>
          </DashboardCard>
        ))}
      <div className="col-span-full"><StateBanner st={st} /></div>
    </DashboardPage>
  )
}

export function ReportDetail() {
  const { id = "" } = useParams()
  const meta = R.REPORTS.find((r) => r.id === id)
  const st = useScreenState(`FX-PRD-REPORTS-${id}`)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={meta?.title ?? "Report not found"} screenId="FX-PRD-REPORTS" crumbs={[{ label: "Production reports", to: "/production/reports" }, { label: meta?.title ?? id }]}
        description={meta?.blurb} actions={<StatePreview extended />}
        chips={<Chip kind="design" note="Report content follows the PRD; layout and prior-month history are prototype values">Layout: design</Chip>}
      />
      <StateBanner st={st} />
      {!meta ? <EmptyState title="Report not found">There are six production reports. <Link className="text-link underline" to="/production/reports">Back to the list</Link></EmptyState>
        : st.loading ? <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading"><div className="h-48 rounded-lg border" /><div className="h-48 rounded-lg border" /></div>
        : st.error ? <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{st.error} <button className="underline" onClick={st.retry}>Try again</button></p>
        : st.empty ? <EmptyState title="No data for this report">Nothing matches the current records.</EmptyState>
        : id === "order-status" ? <OrderStatus />
        : id === "scrap-pareto" ? <ScrapPareto />
        : id === "efficiency" ? <Efficiency />
        : id === "throughput" ? <Throughput />
        : id === "wip-aging" ? <WipAging />
        : <Genealogy />}
      <RulesPanel rules={[
        ["§12", "Order Status / Late Orders: all open work orders against schedule; late and at-risk with pegged SO exposure", "DOC:p.82 Book I D §12"],
        ["§12", "Scrap Pareto: scrap value by reason code, work center and item; month trend", "DOC:p.82"],
        ["§12", "Efficiency: standard hours earned against actual by work center and crew; utilization against capacity", "DOC:p.82"],
        ["§12", "Throughput: units and standard value produced per period per line", "DOC:p.82"],
        ["§12", "WIP Aging: open order value by age bucket; stalled orders with no confirmation in N days", "DOC:p.82"],
        ["§12", "Genealogy per serial: batches consumed by operation, child serials, operators, inspections, test results (production slice of INV 10.4)", "DOC:p.82"],
      ]} />
    </div>
  )
}

function OrderStatus() {
  const s = useSlice("planningProduction")
  const rows = useMemo(() => R.orderStatus(s), [s])
  const cols: Column<R.StatusRow>[] = [
    { id: "wo", header: "Order", value: (r) => r.wo.id, cell: (r) => <WoLink id={r.wo.id} />, sortable: true },
    { id: "item", header: "Item", value: (r) => r.wo.itemId, cell: (r) => <Item id={r.wo.itemId} />, filterable: true },
    { id: "state", header: "State", value: (r) => r.state, filterable: true, cell: (r) => <Tag s={r.state} /> },
    { id: "due", header: "Due", value: (r) => r.due ?? "", cell: (r) => (r.due ? fmtDate(r.due) : "") },
    { id: "fin", header: "Projected finish", value: (r) => r.projected, sortable: true, cell: (r) => fmtDate(r.projected) },
    { id: "late", header: "Days late", value: (r) => r.daysLate, align: "right", mono: true, sortable: true },
    { id: "peg", header: "Pegged SO", value: (r) => r.pegs, cell: (r) => r.wo.pegs[0] ? <span className="font-mono text-xs"><SoLink id={r.wo.pegs[0].soId} />/{r.wo.pegs[0].line}</span> : <span className="text-muted-foreground">stock</span> },
    { id: "exp", header: "Exposure (std value)", value: (r) => r.exposure, align: "right", mono: true, cell: (r) => (r.exposure ? fmtMoney(r.exposure) : "") },
    { id: "status", header: "Order status", value: (r) => r.wo.status, filterable: true },
  ]
  return (
    <>
      <p className="text-sm text-muted-foreground">{rows.filter((r) => r.state === "Late").length} late, {rows.filter((r) => r.state === "At risk").length} at risk (past the promise less the 3-day transit buffer, or On Hold), {fmtMoney(rows.reduce((a, r) => a + r.exposure, 0))} of standard value pegged to sales orders.</p>
      <DataTable<R.StatusRow> rows={rows} columns={cols} rowId={(r) => r.wo.id} densityKey="rpt-order-status" searchText={(r) => `${r.wo.id} ${r.wo.itemId} ${r.pegs}`}
        toolbar={<ExportBtn onClick={() => download("order-status.csv", ["order", "item", "state", "due", "projected", "days_late", "pegs", "exposure"], rows.map((r) => [r.wo.id, r.wo.itemId, r.state, r.due ?? "", r.projected, r.daysLate, r.pegs, r.exposure]))} />}
        empty={{ title: "No open orders" }} />
    </>
  )
}

function ScrapPareto() {
  const s = useSlice("planningProduction")
  const [by, setBy] = useState<"reason" | "wcId" | "itemId">("reason")
  const [from, setFrom] = useState("all")
  const all = R.scrapRows(s)
  const months = [...new Set(all.map((r) => r.month))].sort()
  const rows = from === "all" ? all : all.filter((r) => r.month >= from)
  const p = R.pareto(rows, by)
  const trend = R.scrapTrend(rows)
  const cfg: ChartConfig = { value: { label: "Scrap value", color: "var(--chart-2)" }, cum: { label: "Cumulative %", color: "var(--chart-4)" } }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>By</span>
        <Select value={by} onValueChange={(v) => setBy(v as typeof by)}><SelectTrigger size="sm" className="w-36" aria-label="Group by"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reason">Reason code</SelectItem><SelectItem value="wcId">Work center</SelectItem><SelectItem value="itemId">Item</SelectItem></SelectContent></Select>
        <span>from</span>
        <Select value={from} onValueChange={setFrom}><SelectTrigger size="sm" className="w-32" aria-label="From month"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All months</SelectItem>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        <span className="ml-auto"><ExportBtn onClick={() => download("scrap.csv", ["month", "reason", "work_center", "item", "qty", "value"], rows.map((r) => [r.month, r.reason, r.wcId, r.itemId, r.qty, Math.round(r.value)]))} /></span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Pareto" className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-semibold">Pareto: scrap value by {by === "reason" ? "reason code" : by === "wcId" ? "work center" : "item"}</h2>
          <ChartContainer config={cfg} className="h-64 w-full">
            <ComposedChart data={p}>
              <CartesianGrid vertical={false} /><XAxis dataKey="key" tickFormatter={(k: string) => k.split(" ")[0]} /><YAxis yAxisId="l" /><YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" />
              <ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="l" dataKey="value" fill="var(--color-value)" /><Line yAxisId="r" dataKey="cum" stroke="var(--color-cum)" strokeWidth={2} dot />
            </ComposedChart>
          </ChartContainer>
        </section>
        <section aria-label="Month trend" className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-semibold">Monthly trend</h2>
          <ChartContainer config={cfg} className="h-64 w-full">
            <BarChart data={trend}><CartesianGrid vertical={false} /><XAxis dataKey="month" /><YAxis /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" fill="var(--color-value)" /></BarChart>
          </ChartContainer>
        </section>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-table-head text-left"><tr>{["Group", "Scrap qty", "Value", "Cumulative"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody className="[&_td]:px-3 [&_td]:py-1.5 [&_tr]:border-t">{p.map((x) => <tr key={x.key}><td>{by === "itemId" ? `${x.key} ${matDesc(x.key)}` : x.key}</td><td className="tabular">{x.qty}</td><td className="tabular">{fmtMoney(x.value)}</td><td className="tabular">{x.cum}%</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Months before October 2026 are seeded history; live scrap confirmations add to it. Value is the #30 entry of the confirmation, or standard material per unit when none carries it. Reason codes SR-01..SR-05 are the terminal's list.</p>
    </>
  )
}

function Efficiency() {
  const s = useSlice("planningProduction")
  const [by, setBy] = useState<"wc" | "crew">("wc")
  const [days, setDays] = useState("90")
  const rows = R.efficiency(s, by, Number(days))
  const cfg: ChartConfig = { earned: { label: "Standard hours earned", color: "var(--chart-2)" }, actual: { label: "Actual hours", color: "var(--chart-4)" } }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>By</span>
        <Select value={by} onValueChange={(v) => setBy(v as typeof by)}><SelectTrigger size="sm" className="w-32" aria-label="Group by"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="wc">Work center</SelectItem><SelectItem value="crew">Crew</SelectItem></SelectContent></Select>
        <span>last</span>
        <Select value={days} onValueChange={setDays}><SelectTrigger size="sm" className="w-28" aria-label="Window"><SelectValue /></SelectTrigger><SelectContent>{["30", "60", "90", "180"].map((d) => <SelectItem key={d} value={d}>{d} days</SelectItem>)}</SelectContent></Select>
        <span className="ml-auto"><ExportBtn disabled={!rows.length} onClick={() => download("efficiency.csv", ["key", "label", "earned_h", "actual_h", "efficiency_pct", "capacity_h", "utilization_pct"], rows.map((r) => [r.key, r.label, r.earned, r.actual, r.eff, r.capacity, r.util]))} /></span>
      </div>
      {rows.length === 0 ? <EmptyState title="No confirmed hours in this window">Widen the window or confirm operations at the terminal.</EmptyState> : (
        <>
          <section aria-label="Earned against actual" className="rounded-lg border p-4">
            <ChartContainer config={cfg} className="h-64 w-full">
              <BarChart data={rows}><CartesianGrid vertical={false} /><XAxis dataKey="key" /><YAxis /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} /><Bar dataKey="earned" fill="var(--color-earned)" /><Bar dataKey="actual" fill="var(--color-actual)" /></BarChart>
            </ChartContainer>
          </section>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-table-head text-left"><tr>{["Group", "Earned (h)", "Actual (h)", "Efficiency", "Capacity (h)", "Utilization"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody className="[&_td]:px-3 [&_td]:py-1.5 [&_tr]:border-t">{rows.map((r) => <tr key={r.key}><td>{r.label}</td><td className="tabular">{r.earned}</td><td className="tabular">{r.actual}</td><td className={`tabular ${r.eff < 85 ? "text-status-exception-ink" : ""}`}>{r.eff}%</td><td className="tabular">{r.capacity}</td><td className="tabular">{r.util}%</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Earned = standard crew hours of the operation × (good + rework) / order quantity. Capacity = shifts × hours × stations × efficiency over the window's working weeks. Crew rows use the active roster crew at the work center. Reversed confirmations are excluded.</p>
        </>
      )}
    </>
  )
}

function Throughput() {
  const s = useSlice("planningProduction")
  const rows = R.throughput(s)
  const lines = [...new Set(rows.map((r) => r.line))]
  const months = [...new Set(rows.map((r) => r.month))]
  const data = months.map((m) => ({ month: m, ...Object.fromEntries(lines.map((l, i) => [`line${i}`, rows.find((r) => r.month === m && r.line === l)?.units ?? 0])) }))
  const cfg: ChartConfig = Object.fromEntries(lines.map((l, i) => [`line${i}`, { label: l, color: `var(--chart-${(i % 5) + 1})` }]))
  return (
    <>
      <div className="flex justify-end"><ExportBtn onClick={() => download("throughput.csv", ["period", "line", "units", "std_value"], rows.map((r) => [r.month, r.line, r.units, r.value]))} /></div>
      <section aria-label="Units per period" className="rounded-lg border p-4">
        <ChartContainer config={cfg} className="h-64 w-full">
          <BarChart data={data}><CartesianGrid vertical={false} /><XAxis dataKey="month" /><YAxis /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />{lines.map((l, i) => <Bar key={l} dataKey={`line${i}`} stackId="u" fill={`var(--color-line${i})`} />)}</BarChart>
        </ChartContainer>
      </section>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-table-head text-left"><tr>{["Period", "Line", "Units", "Standard value"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody className="[&_td]:px-3 [&_td]:py-1.5 [&_tr]:border-t">{rows.map((r) => <tr key={r.month + r.line}><td>{r.month}</td><td>{r.line}</td><td className="tabular">{r.units}</td><td className="tabular">{fmtMoney(r.value)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Period = month of the FG receipt. May to August are seeded history; later months add received orders. Line is a grouping of items (design reading: the PRD says "per line" without naming the lines).</p>
    </>
  )
}

function Genealogy() {
  const s = useSlice("planningProduction")
  const nav = useNavigate()
  const serials = s.productionOrders.flatMap((w) => w.serials.map((sn) => ({ sn, w })))
  const [sel, setSel] = useState(serials.find((x) => x.w.id === "WO-TBD-0301")?.sn ?? serials[0]?.sn ?? "")
  const cur = serials.find((x) => x.sn === sel)
  if (!cur) return <EmptyState title="No serials">Serials are generated when an order releases.</EmptyState>
  const w = cur.w
  const conf = s.confirmations.filter((c) => c.woId === w.id)
  const gen = s.genealogy.filter((g) => g.woId === w.id && (!g.serial || g.serial.includes(sel) || w.serials.length > 1))
  const kids = gen.filter((g) => g.child)
  const tests = w.operations.filter((o) => o.qcGate)
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Serial</span>
        <Select value={sel} onValueChange={(v) => setSel(v as typeof sel)}><SelectTrigger size="sm" className="w-64" aria-label="Serial"><SelectValue /></SelectTrigger><SelectContent>{serials.map((x) => <SelectItem key={x.sn} value={x.sn}>{x.sn} · {x.w.id}</SelectItem>)}</SelectContent></Select>
        <Button size="sm" variant="outline" onClick={() => nav(`/production/orders/${w.id}`)}>Open {w.id}</Button>
        <span className="ml-auto"><ExportBtn onClick={() => download(`genealogy-${sel}.csv`, ["op", "work_center", "component", "lots", "operators", "inspection"], w.operations.flatMap((o) => (o.components.length ? o.components : [{ materialId: "", lots: [] as string[] }]).map((c) => [o.no, o.workCenterId, c.materialId, c.lots.join(" "), [...new Set(conf.filter((x) => x.op === o.no).map((x) => userName(x.operatorId)))].join("; "), o.inspection?.result ?? ""])))} /></span>
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Unit</dt><dd className="font-mono">{sel}</dd></div><div><dt className="text-muted-foreground">Item</dt><dd>{w.itemId} {matDesc(w.itemId)}</dd></div>
        <div><dt className="text-muted-foreground">Order</dt><dd><WoLink id={w.id} /> ({w.status})</dd></div><div><dt className="text-muted-foreground">Final Test</dt><dd>{w.testPassed ? "Passed" : "Not passed yet"}</dd></div>
      </dl>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-table-head text-left"><tr>{["Op", "Work center", "Operation", "Batches and serials consumed", "Operators", "Inspection"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody className="[&_td]:px-3 [&_td]:py-1.5 [&_tr]:border-t">
            {w.operations.map((o) => (
              <tr key={o.no}>
                <td className="tabular">{o.no}</td><td className="font-mono text-xs">{o.workCenterId}</td><td>{o.text}<span className="block text-xs text-muted-foreground">{o.status}</span></td>
                <td className="font-mono text-xs">{o.components.flatMap((c) => c.lots.map((l) => `${c.materialId}: ${l}`)).join("; ") || "none"}</td>
                <td className="text-xs">{[...new Set(conf.filter((x) => x.op === o.no && !x.reversalOf).map((x) => userName(x.operatorId)))].join(", ") || "none yet"}</td>
                <td className="text-xs">{o.inspection ? `${o.inspection.id}: ${o.inspection.result ?? "waiting"}${o.inspection.restriction ? ` (${o.inspection.restriction})` : ""}` : o.qcGate ? `${o.qcGate}: not requested` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-label="Child serials and events" className="flex flex-col gap-1 text-sm">
        <h2 className="text-base font-semibold">Child serials and trace events</h2>
        {kids.length === 0 && <p className="text-muted-foreground">No child serial was installed on this unit.</p>}
        {kids.map((g) => <p key={g.id} className="tabular"><span className="font-mono">{g.code}</span> {g.at.slice(0, 10)} {g.child} installed{g.scanPoint ? ` (${g.scanPoint})` : ""}: {g.text}</p>)}
        <ul className="mt-1 max-h-48 overflow-y-auto">{gen.filter((g) => !g.child).map((g) => <li key={g.id} className="tabular border-b py-0.5"><span className="font-mono text-xs">{g.code}</span> {g.at.slice(0, 10)} {g.text}</li>)}</ul>
        {tests.length > 0 && <p className="text-xs text-muted-foreground">Test results: {tests.map((o) => `${o.qcGate} ${o.inspection?.result ?? "pending"}`).join(" · ")}.</p>}
      </section>
    </>
  )
}
