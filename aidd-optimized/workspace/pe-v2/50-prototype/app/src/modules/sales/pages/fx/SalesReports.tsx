// FX-OM-REPORTS Sales reports (seven) (/sales/reports, /sales/reports/:id) [DOC:p.56 Book I B §6; Book VI §4.1].
// Open order book, bookings/billings/backlog, on-time delivery, margin by order (three margins), quote funnel,
// late and at-risk lines, lead pipeline. Role rights follow the PRD: the Sales Director sees all reports; a Sales
// rep sees no cost, so margin is withheld unless the company setting allows it (design value, reading SR-33).
import { useMemo, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router"
import { Download } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { DashboardCard, DashboardPage, PageHeader } from "@/components/templates"
import { Chip, EmptyState, RulesPanel } from "@/components/patterns"
import { useRole, useSlice } from "@/store"
import { money, TODAY } from "../../data/model"
import { REPORTS, bbb, funnel, lateAtRisk, leadPipeline, marginByOrder, marginVerdict, openOrderBook, otd, type ReportId } from "../../fx/reports"
import { MARGIN_FLOOR_PCT, MARGIN_TARGET_PCT } from "../../fx/model"
import { Reading } from "../../components/ext"
import { PickField, StaleTag, StateBar, StateGate, useFxState, type FxState } from "./kit"

const pct = (n: number | null) => (n == null ? "n/a" : `${n.toFixed(1)}%`)
const usd = (n: number) => money(Math.round(n))

function csv(name: string, head: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const blob = new Blob([[head, ...rows].map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${name}-${TODAY}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function SalesReportsHome() {
  const db = useSlice("sales")
  const st = useFxState()
  const book = openOrderBook(db)
  const late = lateAtRisk(db)
  const o = otd(db)
  const ontime = o.length ? Math.round((o.filter((r) => r.onTime).length / o.length) * 100) : 0
  const pipe = leadPipeline(db)
  return (
    <div className="flex flex-col gap-4">
      {(st.loading || st.empty) && <PageHeader title="Sales reports" screenId="FX-OM-REPORTS" description="Seven reports over orders, deliveries, quotations and leads." />}
      <StateBar st={st} />
      <StateGate st={st} empty={{ title: "No sales data", body: "Reports fill as orders, deliveries and quotations are created." }}>
        <DashboardPage
          header={{ title: "Sales reports", screenId: "FX-OM-REPORTS", description: "Seven reports over orders, deliveries, quotations and leads. Open one for its filters, chart, table and CSV export." }}
          tiles={[
            { label: "Open order book", value: usd(book.reduce((s, r) => s + r.value, 0)), hint: `${book.length} open lines`, to: "/sales/reports/open-order-book" },
            { label: "On-time delivery", value: `${ontime}%`, hint: `${o.length} shipped deliveries`, to: "/sales/reports/otd" },
            { label: "Late and at-risk lines", value: late.length, hint: `${late.filter((l) => l.kind === "Late").length} late`, to: "/sales/reports/late", tone: late.length ? "attention" : "default" },
            { label: "Weighted pipeline", value: usd(pipe.filter((p) => !["Won", "Lost", "Disqualified"].includes(p.stage)).reduce((s, p) => s + p.weighted, 0)), hint: "open stages", to: "/sales/reports/lead-pipeline" },
          ]}
        >
          {REPORTS.map((r) => (
            <DashboardCard key={r.id} title={r.title}>
              <p className="text-sm text-muted-foreground">{r.blurb}</p>
              <p className="text-xs text-muted-foreground">[{r.source}] (asserted)</p>
              <div><Button variant="outline" asChild><Link to={`/sales/reports/${r.id}${st.state !== "normal" ? `?state=${st.state}` : ""}`}>Open report</Link></Button></div>
            </DashboardCard>
          ))}
        </DashboardPage>
      </StateGate>
    </div>
  )
}

function Frame({ id, st, children, onExport, empty }: { id: ReportId; st: FxState; children: ReactNode; onExport: () => void; empty?: boolean }) {
  const r = REPORTS.find((x) => x.id === id)!
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={r.title} screenId="FX-OM-REPORTS" crumbs={[{ label: "Sales reports", to: "/sales/reports" }, { label: r.title }]} description={r.blurb}
        actions={<Button variant="outline" onClick={onExport} disabled={st.state === "offline" || st.state === "authorization"} title={st.state === "offline" ? "Offline: export needs a connection" : undefined}><Download aria-hidden="true" /> Export CSV</Button>} chips={<Chip kind="design" note="Report layout and filters are design values; the columns and dimensions are the PRD's.">Layout: design value</Chip>} />
      <StateBar st={st} />
      <StateGate st={{ ...st, empty: st.empty || !!empty }} empty={{ title: "Nothing to report", body: "No records match this report and filter." }}>{children}</StateGate>
    </div>
  )
}

export function SalesReport() {
  const { id } = useParams()
  const st = useFxState()
  const db = useSlice("sales")
  const [role] = useRole()
  const rid = (REPORTS.some((r) => r.id === id) ? id : "open-order-book") as ReportId
  const deg = st.state === "degraded"
  const denied = rid === "margin" && role === "Sales rep"
  const stx: FxState = denied ? { ...st, state: "authorization", writable: false, why: "The sales rep role has no cost visibility; margin reports are for the Sales Director and Finance." } : st
  if (id && !REPORTS.some((r) => r.id === id))
    return <EmptyState title={`No report ${id}`}><Link className="text-link underline" to="/sales/reports">Back to the seven reports</Link></EmptyState>
  return (
    <>
      {rid === "open-order-book" && <OpenBook st={stx} db={db} deg={deg} />}
      {rid === "bbb" && <Bbb st={stx} db={db} />}
      {rid === "otd" && <Otd st={stx} db={db} />}
      {rid === "margin" && <Margin st={stx} db={db} denied={denied} />}
      {rid === "funnel" && <Funnel st={stx} db={db} />}
      {rid === "late" && <Late st={stx} db={db} deg={deg} />}
      {rid === "lead-pipeline" && <Pipeline st={stx} db={db} />}
      <div className="mt-6"><RulesPanel rules={[
        ["REP-1", "Sales rep: no cost visibility; margin shows only where the company setting allows reps to see margin (config per company: Y/N).", "DOC:p.56 §6 Role Rights"],
        ["REP-2", "Sales Director: all reports. Read-only view: all reports, export none.", "DOC:p.56 §6 Role Rights"],
        ["REP-3", "Late and at-risk: promised date within 7 days without Ready to Ship, or a pegged work order behind schedule.", "DOC:p.56 §6"],
        ["REP-4", "Margin by order shows three margins: quoted (price against estimate), standard (at PGI) and actual (at work order settlement).", "DOC:p.56 §6"],
      ]} /></div>
    </>
  )
}
type P = { st: FxState; db: ReturnType<typeof useSlice<"sales">> }

function OpenBook({ st, db, deg }: P & { deg: boolean }) {
  const [group, setGroup] = useState("Customer")
  const rows = useMemo(() => openOrderBook(db), [db])
  const key = (r: (typeof rows)[number]) => (group === "Customer" ? r.customer : group === "Product line" ? r.productLine : r.month)
  const groups = [...new Set(rows.map(key))].sort()
  return (
    <Frame id="open-order-book" st={st} empty={rows.length === 0} onExport={() => csv("open-order-book", ["SO", "Line", "Customer", "Item", "Product line", "Open qty", "Value USD", "Promised", "Status", "Supply", "Late"], rows.map((r) => [r.so, r.line, r.customer, r.item, r.productLine, r.openQty, Math.round(r.value), r.promised, r.status, r.supply, r.late ? "Yes" : "No"]))}>
      <div className="max-w-xs"><PickField label="Group by" value={group} onChange={setGroup} options={["Customer", "Product line", "Month"]} /></div>
      <p className="text-sm">{rows.length} open lines worth {usd(rows.reduce((s, r) => s + r.value, 0))} (CAD converted at {1.36}, OQ-42). {rows.filter((r) => r.late).length} late.<StaleTag show={deg} /></p>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>SO / line</TableHead><TableHead>Customer</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Open qty</TableHead><TableHead className="text-right">Value (USD)</TableHead><TableHead>Promised</TableHead><TableHead>Status</TableHead><TableHead>Pegged supply</TableHead><TableHead>Late</TableHead></TableRow></TableHeader>
        <TableBody>
          {groups.map((g) => (
            <GroupRows key={g} label={g} cols={9} total={rows.filter((r) => key(r) === g).reduce((s, r) => s + r.value, 0)}>
              {rows.filter((r) => key(r) === g).map((r) => (
                <TableRow key={`${r.so}-${r.line}`}>
                  <TableCell><Link className="text-link underline" to={`/sales/orders/${r.so}`}>{r.so}</Link> / {r.line}</TableCell><TableCell>{r.customer}</TableCell><TableCell>{r.item} <span className="text-xs text-muted-foreground">{r.productLine}</span></TableCell>
                  <TableCell className="tabular text-right">{r.openQty}</TableCell><TableCell className="tabular text-right">{usd(r.value)}</TableCell><TableCell>{r.promised}</TableCell><TableCell>{r.status}</TableCell><TableCell>{r.supply}</TableCell><TableCell>{r.late ? "Late" : ""}</TableCell>
                </TableRow>
              ))}
            </GroupRows>
          ))}
        </TableBody>
      </Table>
    </Frame>
  )
}
function GroupRows({ label, total, cols, children }: { label: string; total: number; cols: number; children: ReactNode }) {
  return (<><TableRow className="bg-muted/50"><TableCell colSpan={cols - 1} className="font-semibold">{label}</TableCell><TableCell className="tabular text-right font-semibold">{usd(total)}</TableCell></TableRow>{children}</>)
}

function Bbb({ st, db }: P) {
  const [dim, setDim] = useState<"Product line" | "Entity">("Product line")
  const rows = useMemo(() => bbb(db, dim), [db, dim])
  const months = [...new Set(rows.map((r) => r.month))].sort()
  const data = months.map((m) => ({ month: m, bookings: Math.round(rows.filter((r) => r.month === m).reduce((s, r) => s + r.bookings, 0)), billings: Math.round(rows.filter((r) => r.month === m).reduce((s, r) => s + r.billings, 0)) }))
  return (
    <Frame id="bbb" st={st} empty={rows.length === 0} onExport={() => csv("bbb", ["Month", dim, "Bookings USD", "Billings USD", "Backlog USD"], rows.map((r) => [r.month, r.dim, Math.round(r.bookings), Math.round(r.billings), Math.round(r.backlog)]))}>
      <div className="max-w-xs"><PickField label="Dimension" value={dim} onChange={(v) => setDim(v as typeof dim)} options={["Product line", "Entity"]} /></div>
      <ChartContainer config={{ bookings: { label: "Bookings", color: "var(--chart-3)" }, billings: { label: "Billings", color: "var(--chart-2)" } }} className="h-64 w-full">
        <BarChart data={data}><CartesianGrid vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `${Math.round(v / 1e6)}M`} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="bookings" fill="var(--color-bookings)" /><Bar dataKey="billings" fill="var(--color-billings)" /></BarChart>
      </ChartContainer>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Month</TableHead><TableHead>{dim}</TableHead><TableHead className="text-right">Bookings</TableHead><TableHead className="text-right">Billings</TableHead><TableHead className="text-right">Backlog</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((r) => <TableRow key={r.month + r.dim}><TableCell>{r.month}</TableCell><TableCell>{r.dim}</TableCell><TableCell className="tabular text-right">{usd(r.bookings)}</TableCell><TableCell className="tabular text-right">{usd(r.billings)}</TableCell><TableCell className="tabular text-right">{usd(r.backlog)}</TableCell></TableRow>)}</TableBody>
      </Table>
      <p className="text-xs text-muted-foreground"><Reading id="SR-34" note="Bookings = value of orders created in the month (not Draft or Rejected); billings = invoice-posted orders in their closing month; backlog = running bookings less billings per dimension." /> Entity dimension is the currency of the order (US or Canadian entity).</p>
    </Frame>
  )
}

function Otd({ st, db }: P) {
  const [by, setBy] = useState("Month")
  const rows = useMemo(() => otd(db), [db])
  const key = (r: (typeof rows)[number]) => (by === "Month" ? r.month : by === "Customer" ? r.customer : r.productLine)
  const groups = [...new Set(rows.map(key))].sort()
  const stat = groups.map((g) => { const x = rows.filter((r) => key(r) === g); return { g, n: x.length, on: x.filter((r) => r.onTime).length, pct: x.length ? (x.filter((r) => r.onTime).length / x.length) * 100 : 0 } })
  return (
    <Frame id="otd" st={st} empty={rows.length === 0} onExport={() => csv("otd", ["Delivery", "SO", "Customer", "Product line", "Promised", "Actual PGI", "Days late"], rows.map((r) => [r.delivery, r.so, r.customer, r.productLine, r.promised, r.actual, r.daysLate]))}>
      <div className="max-w-xs"><PickField label="OTD % by" value={by} onChange={setBy} options={["Month", "Customer", "Product line"]} /></div>
      <ChartContainer config={{ pct: { label: "OTD %", color: "var(--chart-3)" } }} className="h-56 w-full"><BarChart data={stat.map((s) => ({ g: s.g.slice(0, 18), pct: Math.round(s.pct) }))}><CartesianGrid vertical={false} /><XAxis dataKey="g" /><YAxis domain={[0, 100]} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="pct" fill="var(--color-pct)" /></BarChart></ChartContainer>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>{by}</TableHead><TableHead className="text-right">Deliveries</TableHead><TableHead className="text-right">On time</TableHead><TableHead className="text-right">OTD %</TableHead></TableRow></TableHeader>
        <TableBody>{stat.map((s) => <TableRow key={s.g}><TableCell>{s.g}</TableCell><TableCell className="tabular text-right">{s.n}</TableCell><TableCell className="tabular text-right">{s.on}</TableCell><TableCell className="tabular text-right">{s.pct.toFixed(0)}%</TableCell></TableRow>)}</TableBody>
      </Table>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Delivery</TableHead><TableHead>Order</TableHead><TableHead>Promised</TableHead><TableHead>Actual PGI</TableHead><TableHead className="text-right">Days late</TableHead></TableRow></TableHeader>
        <TableBody>{rows.filter((r) => !r.onTime).map((r) => <TableRow key={r.delivery}><TableCell>{r.delivery}</TableCell><TableCell>{r.so}</TableCell><TableCell>{r.promised}</TableCell><TableCell>{r.actual}</TableCell><TableCell className="tabular text-right">{r.daysLate}</TableCell></TableRow>)}{rows.every((r) => r.onTime) && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Every shipped delivery was on time.</TableCell></TableRow>}</TableBody>
      </Table>
    </Frame>
  )
}

function Margin({ st, db, denied }: P & { denied: boolean }) {
  const [view, setView] = useState("quoted")
  const rows = useMemo(() => marginByOrder(db), [db])
  const v = (r: (typeof rows)[number]) => (view === "quoted" ? [r.quotedCost, r.quotedPct] : view === "standard" ? [r.stdCost, r.stdPct] : [r.actualCost, r.actualPct]) as [number | null, number | null]
  return (
    <Frame id="margin" st={st} empty={rows.length === 0} onExport={() => csv("margin-by-order", ["SO", "Customer", "Type", "Value USD", "Quoted cost", "Quoted %", "Standard cost", "Standard %", "Actual cost", "Actual %"], rows.map((r) => [r.so, r.customer, r.type, Math.round(r.value), r.quotedCost ?? "", r.quotedPct?.toFixed(1) ?? "", r.stdCost ?? "", r.stdPct?.toFixed(1) ?? "", r.actualCost ?? "", r.actualPct?.toFixed(1) ?? ""]))}>
      {denied && <p role="alert" className="rounded-md border px-4 py-3 text-sm">Sales reps see no cost: the company setting hides margin from reps (<Reading id="SR-33" note="PRD: 'config per company: reps see margin Y/N'. The prototype default is N." />). Switch Acting as to Sales Director or a Finance role.</p>}
      {!denied && (
        <>
          <Tabs value={view} onValueChange={setView}>
            <TabsList><TabsTrigger value="quoted">Quoted</TabsTrigger><TabsTrigger value="standard">Standard at PGI</TabsTrigger><TabsTrigger value="actual">Actual at settlement</TabsTrigger></TabsList>
          </Tabs>
          <p className="text-sm text-muted-foreground">Target {MARGIN_TARGET_PCT}%, floor {MARGIN_FLOOR_PCT}% (design values, <Reading id="SR-28" note="The PRD says margin below target and floor without figures." />).</p>
          <Table>
            <TableHeader className="bg-table-head"><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Value (USD)</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Margin %</TableHead><TableHead>Against target</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => { const [c, p] = v(r); return <TableRow key={r.so}><TableCell><Link className="text-link underline" to={`/sales/orders/${r.so}`}>{r.so}</Link></TableCell><TableCell>{r.customer}</TableCell><TableCell>{r.type}</TableCell><TableCell className="tabular text-right">{usd(r.value)}</TableCell><TableCell className="tabular text-right">{c == null ? "n/a" : usd(c)}</TableCell><TableCell className="tabular text-right">{pct(p)}</TableCell><TableCell>{marginVerdict(p)}</TableCell><TableCell className="text-xs text-muted-foreground">{r.note}</TableCell></TableRow> })}
            </TableBody>
          </Table>
        </>
      )}
    </Frame>
  )
}

function Funnel({ st, db }: P) {
  const rows = useMemo(() => funnel(db), [db])
  const statuses = ["Draft", "Internal Review", "Issued", "Won", "Lost", "Expired", "Superseded"]
  const segs = [...new Set(rows.map((r) => r.segment))].sort()
  const decided = rows.filter((r) => ["Won", "Lost"].includes(r.status))
  const losses = Object.entries(rows.filter((r) => r.loss).reduce<Record<string, number>>((m, r) => ({ ...m, [r.loss!]: (m[r.loss!] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
  const totalLoss = losses.reduce((s, [, n]) => s + n, 0)
  let cum = 0
  return (
    <Frame id="funnel" st={st} empty={rows.length === 0} onExport={() => csv("quote-funnel", ["Quotation", "Customer", "Segment", "Status", "Age days", "Value USD", "Loss reason"], rows.map((r) => [r.id, r.customer, r.segment, r.status, r.ageDays, Math.round(r.value), r.loss ?? ""]))}>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Quotes by status and age"><h2 className="mb-2 text-sm font-semibold">Quotes by status and age</h2>
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Quotes</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Average age (days)</TableHead></TableRow></TableHeader>
            <TableBody>{statuses.map((s) => { const x = rows.filter((r) => r.status === s); return <TableRow key={s}><TableCell>{s}</TableCell><TableCell className="tabular text-right">{x.length}</TableCell><TableCell className="tabular text-right">{usd(x.reduce((a, r) => a + r.value, 0))}</TableCell><TableCell className="tabular text-right">{x.length ? Math.round(x.reduce((a, r) => a + r.ageDays, 0) / x.length) : "n/a"}</TableCell></TableRow> })}</TableBody></Table></section>
        <section aria-label="Win rate by segment"><h2 className="mb-2 text-sm font-semibold">Win rate by segment</h2>
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Segment</TableHead><TableHead className="text-right">Won</TableHead><TableHead className="text-right">Lost</TableHead><TableHead className="text-right">Win rate</TableHead></TableRow></TableHeader>
            <TableBody>{segs.map((s) => { const x = decided.filter((r) => r.segment === s); const w = x.filter((r) => r.status === "Won").length; return <TableRow key={s}><TableCell>{s}</TableCell><TableCell className="tabular text-right">{w}</TableCell><TableCell className="tabular text-right">{x.length - w}</TableCell><TableCell className="tabular text-right">{x.length ? `${Math.round((w / x.length) * 100)}%` : "n/a"}</TableCell></TableRow> })}</TableBody></Table></section>
      </div>
      <section aria-label="Loss reasons Pareto"><h2 className="mb-2 text-sm font-semibold">Loss reasons (Pareto)</h2>
        {losses.length === 0 ? <p className="text-sm text-muted-foreground">No quotation has been recorded as Lost.</p> : (
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Reason</TableHead><TableHead className="text-right">Quotes</TableHead><TableHead className="text-right">Share</TableHead><TableHead className="text-right">Cumulative</TableHead></TableRow></TableHeader>
            <TableBody>{losses.map(([r, n]) => { cum += n; return <TableRow key={r}><TableCell>{r}</TableCell><TableCell className="tabular text-right">{n}</TableCell><TableCell className="tabular text-right">{Math.round((n / totalLoss) * 100)}%</TableCell><TableCell className="tabular text-right">{Math.round((cum / totalLoss) * 100)}%</TableCell></TableRow> })}</TableBody></Table>
        )}
      </section>
    </Frame>
  )
}

function Late({ st, db, deg }: P & { deg: boolean }) {
  const rows = useMemo(() => lateAtRisk(db), [db])
  return (
    <Frame id="late" st={st} empty={rows.length === 0} onExport={() => csv("late-at-risk", ["SO", "Line", "Customer", "Item", "Promised", "Days to promise", "Status", "Kind", "Reason"], rows.map((r) => [r.so, r.line, r.customer, r.item, r.promised, r.daysToPromise, r.status, r.kind, r.reason]))}>
      <p className="text-sm">{rows.filter((r) => r.kind === "Late").length} late, {rows.filter((r) => r.kind === "At risk").length} at risk.<StaleTag show={deg} /> Dispatch data comes from Planning and Production (Part D); a pegged work order behind schedule is read from its confirmed date.</p>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Order / line</TableHead><TableHead>Customer</TableHead><TableHead>Item</TableHead><TableHead>Promised</TableHead><TableHead className="text-right">Days to promise</TableHead><TableHead>Line status</TableHead><TableHead>Flag</TableHead><TableHead>Why</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((r) => <TableRow key={`${r.so}${r.line}`}><TableCell><Link className="text-link underline" to={`/sales/orders/${r.so}`}>{r.so}</Link> / {r.line}</TableCell><TableCell>{r.customer}</TableCell><TableCell>{r.item}</TableCell><TableCell>{r.promised}</TableCell><TableCell className="tabular text-right">{r.daysToPromise}</TableCell><TableCell>{r.status}</TableCell><TableCell>{r.kind}</TableCell><TableCell>{r.reason}</TableCell></TableRow>)}</TableBody>
      </Table>
    </Frame>
  )
}

function Pipeline({ st, db }: P) {
  const rows = useMemo(() => leadPipeline(db), [db])
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <Frame id="lead-pipeline" st={st} empty={total === 0} onExport={() => csv("lead-pipeline", ["Stage", "Leads", "Value USD", "Weighted USD", "Average age days"], rows.map((r) => [r.stage, r.count, Math.round(r.value), Math.round(r.weighted), r.avgAge]))}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--chart-2)" }, weighted: { label: "Weighted", color: "var(--chart-3)" } }} className="h-56 w-full"><BarChart data={rows.map((r) => ({ stage: r.stage, value: Math.round(r.value), weighted: Math.round(r.weighted) }))}><CartesianGrid vertical={false} /><XAxis dataKey="stage" /><YAxis tickFormatter={(v) => `${Math.round(v / 1e6)}M`} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" fill="var(--color-value)" /><Bar dataKey="weighted" fill="var(--color-weighted)" /></BarChart></ChartContainer>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Stage</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Value (USD)</TableHead><TableHead className="text-right">Weighted</TableHead><TableHead className="text-right">Average age (days)</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((r) => <TableRow key={r.stage}><TableCell>{r.stage}</TableCell><TableCell className="tabular text-right">{r.count}</TableCell><TableCell className="tabular text-right">{usd(r.value)}</TableCell><TableCell className="tabular text-right">{usd(r.weighted)}</TableCell><TableCell className="tabular text-right">{r.count ? r.avgAge : "n/a"}</TableCell></TableRow>)}</TableBody>
      </Table>
      <p className="text-xs text-muted-foreground"><Link className="text-link underline" to="/sales/leads">Open the pipeline board</Link>. Weighted value uses the win probability on each lead (<Reading id="SR-3" note="Win probability defaults by stage 10, 25, 50, 100, 0, 0%" />); CAD at 1.36 (OQ-42).</p>
    </Frame>
  )
}
