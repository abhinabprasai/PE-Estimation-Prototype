// FX-PLN-LOAD Work center load view and FX-PLN-RELIABILITY Promise reliability report.
// Load: finite load against capacity per work center per week, from the same engine as the schedule
// board; a scenario can be chosen to see its load instead. Capacity comes from shifts, hours,
// stations and efficiency; a maintenance window removes the days. The finite plan never loads past
// capacity, so a full week means the next order waits; the 90% flag is a design value.
// Reliability: promises made against promises kept [DOC:p.193 §4-5 promise checks and at-risk]; the
// history is seeded (fictitious), the on-time tolerance of 0 days late is a design value.

import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Chip, EmptyState, RulesPanel, type Column } from "@/components/patterns"
import { DataTable } from "@/components/patterns/DataTable"
import { DashboardCard, DashboardPage } from "@/components/templates"
import type { ISODate } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { fmtDate, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { Item, SoLink, StateBanner, StatePreview, custName, useScreenState, WoLink } from "../components"
import * as ext from "../lib/actions-ext"
import { addCalDays, allWorkCenters, opKey, opHours, weekLabel, weeklyBuckets, schedule } from "../lib/plan"
import type { ReliabilityRow } from "../data/extra"

const FLAG = 90

export function WorkCenterLoad() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PLN-LOAD")
  const [weeks, setWeeks] = useState("8")
  const [scn, setScn] = useState("SCN-TBD-01")
  const [cell, setCell] = useState<{ wc: string; week: ISODate } | null>(null)
  const sc = s.scenarios.find((x) => x.id === scn) ?? s.scenarios[0]
  const plan = useMemo(() => (sc ? ext.scenarioPlan(s, sc) : schedule(s, {})), [s, sc])
  const wcs = allWorkCenters(s).filter((w) => w.status !== "Inactive")
  const n = Number(weeks)
  const grid = wcs.map((w) => ({ w, b: weeklyBuckets(w, plan, TODAY as ISODate, n) }))
  const pct = (h: number, c: number) => (c > 0 ? Math.round((h / c) * 100) : h > 0 ? 999 : 0)
  const flagged = grid.flatMap((g) => g.b.filter((x) => pct(x.hours, x.capacity) >= FLAG).map((x) => ({ wc: g.w.id, week: x.week })))
  const totals = grid.map((g) => ({ w: g.w, h: g.b.reduce((a, x) => a + x.hours, 0), c: g.b.reduce((a, x) => a + x.capacity, 0) }))
  const top = [...totals].sort((a, b) => pct(b.h, b.c) - pct(a.h, a.c))[0]
  const free = totals.reduce((a, t) => a + Math.max(0, t.c - t.h), 0)
  const windowsIn = s.maintWindows.filter((m) => (m.status === "Scheduled" || m.status === "In progress") && m.from <= addCalDays(TODAY as ISODate, n * 7)).length
  const cellOps = cell ? s.productionOrders.flatMap((w) => w.operations.filter((o) => o.workCenterId === cell.wc && o.status !== "Cancelled" && o.status !== "Completed").map((o) => ({ w, o, d: plan.dates[opKey(w.id, o.no)] }))).filter((x) => x.d && x.d[0] <= addCalDays(cell.week, 6) && x.d[1] >= cell.week) : []
  const cfg: ChartConfig = { h: { label: "Loaded hours", color: "var(--chart-2)" }, free: { label: "Free hours", color: "var(--chart-1)" } }
  const chart = totals.map((t) => ({ wc: t.w.id, h: Math.round(t.h), free: Math.round(Math.max(0, t.c - t.h)) }))

  return (
    <DashboardPage
      header={{
        title: "Work center load",
        screenId: "FX-PLN-LOAD",
        description: "Finite load against capacity by week for every active work center. Pick a scenario to see its load instead of the live plan.",
        chips: <Chip kind="design" note="The 90% flag and the horizon choices are prototype values; load, capacity and maintenance windows come from the same engine as the schedule board">{FLAG}% flag: design</Chip>,
        actions: <><StatePreview extended /><Link className="text-sm text-link underline" to="/production/schedule/scenarios">Scenarios</Link></>,
      }}
      tiles={[
        { label: "Most loaded work center", value: top ? top.w.id : "none", hint: top ? `${pct(top.h, top.c)}% over ${n} weeks` : undefined, tone: top && pct(top.h, top.c) >= FLAG ? "attention" : "default" },
        { label: `Weeks at ${FLAG}% or more`, value: flagged.length, hint: "work center and week pairs", tone: flagged.length ? "attention" : "default" },
        { label: "Free hours in the horizon", value: fmtNumber(Math.round(free)), hint: `${n} weeks, all work centers` },
        { label: "Maintenance windows", value: windowsIn, hint: "Scheduled or in progress", to: "/production/scheduling-masters" },
      ]}
    >
      <div className="col-span-full flex flex-col gap-3">
        <StateBanner st={st} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Plan</span>
          <Select value={sc?.id ?? ""} onValueChange={setScn}><SelectTrigger size="sm" className="w-56" aria-label="Plan"><SelectValue /></SelectTrigger><SelectContent>{s.scenarios.map((x) => <SelectItem key={x.id} value={x.id}>{x.baseline ? "Live plan" : x.name}</SelectItem>)}</SelectContent></Select>
          <span>Horizon</span>
          <Select value={weeks} onValueChange={setWeeks}><SelectTrigger size="sm" className="w-28" aria-label="Horizon"><SelectValue /></SelectTrigger><SelectContent>{["4", "8", "12"].map((x) => <SelectItem key={x} value={x}>{x} weeks</SelectItem>)}</SelectContent></Select>
        </div>
        {st.loading ? <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading"><div className="h-64 rounded-lg border" /></div>
          : st.error ? <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{st.error} <button className="underline" onClick={st.retry}>Try again</button></p>
          : st.empty ? <EmptyState title="Nothing loaded">No open order is loaded on any work center.</EmptyState> : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-table-head text-left"><tr><th scope="col" className="px-3 py-2">Work center</th>{grid[0]?.b.map((b) => <th key={b.week} scope="col" className="px-2 py-2 text-center">{weekLabel(b.week)}<span className="block text-xs font-normal text-muted-foreground">{fmtDate(b.week).slice(0, 6)}</span></th>)}<th scope="col" className="px-2 py-2 text-right">Total</th></tr></thead>
              <tbody className="[&_tr]:border-t">
                {grid.map(({ w, b }) => {
                  const th = b.reduce((a, x) => a + x.hours, 0)
                  const tc = b.reduce((a, x) => a + x.capacity, 0)
                  return (
                    <tr key={w.id}>
                      <th scope="row" className="px-3 py-1.5 text-left font-normal"><Link className="font-mono text-xs text-link underline-offset-4 hover:underline" to={`/production/work-centers/${w.id}`}>{w.id}</Link><span className="block text-xs text-muted-foreground">{w.name}{w.status !== "Active" ? ` · ${w.status}` : ""}</span></th>
                      {b.map((x) => {
                        const p = pct(x.hours, x.capacity)
                        const down = x.capacity === 0
                        return (
                          <td key={x.week} className="p-1 text-center">
                            <button onClick={() => setCell({ wc: w.id, week: x.week })} aria-label={`${w.id} ${weekLabel(x.week)}: ${down ? "no capacity" : `${p}% loaded`}`}
                              className={`tabular h-9 w-full rounded-md border text-xs ${down ? "bg-muted text-muted-foreground" : p >= FLAG ? "border-status-exception bg-status-pending-tint font-semibold text-status-exception-ink" : p >= 60 ? "bg-status-active-tint" : ""}`}>
                              {down ? "down" : `${p}%`}
                            </button>
                          </td>
                        )
                      })}
                      <td className="tabular px-2 text-right text-xs">{pct(th, tc)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Cell = loaded hours over capacity for the week. "down" = no capacity (maintenance window, Maintenance status or a scenario outage). Colour is never the only signal: flagged cells are bold with the exception tint and read in the cell label.</p>
      </div>
      {!st.loading && !st.error && !st.empty && (
        <>
          <DashboardCard title="Loaded and free hours over the horizon">
            <ChartContainer config={cfg} className="h-56 w-full"><BarChart data={chart}><CartesianGrid vertical={false} /><XAxis dataKey="wc" /><YAxis /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="h" stackId="a" fill="var(--color-h)" /><Bar dataKey="free" stackId="a" fill="var(--color-free)" /></BarChart></ChartContainer>
          </DashboardCard>
          <DashboardCard title={cell ? `${cell.wc} · ${weekLabel(cell.week)}` : "Drill into a cell"}>
            {!cell ? <p className="text-sm text-muted-foreground">Select a cell to list the operations loaded on that work center that week.</p> : cellOps.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is loaded there that week.</p> : (
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">{cellOps.map(({ w, o, d }) => <li key={opKey(w.id, o.no)} className="tabular flex flex-wrap gap-x-2 border-b pb-1"><WoLink id={w.id} /> op {o.no} {o.text} · {fmtNumber(opHours(o), 1)} h · {fmtDate(d[0])} to {fmtDate(d[1])}</li>)}</ul>
            )}
          </DashboardCard>
        </>
      )}
      <div className="col-span-full">
        <RulesPanel rules={[
          ["Finite", "Capacity is shifts × hours × stations × efficiency; maintenance windows remove the days; the plan never loads past capacity", "DOC:p.71 §2; p.193 Book III E"],
          ["Scenario", "A what-if scenario runs through the same finite engine and never touches the floor", "DOC:p.193 §3 (sandbox)"],
        ]} />
      </div>
    </DashboardPage>
  )
}

// ============================================================================ reliability
const cause = (r: ReliabilityRow) => r.cause ?? "none"
const late = (r: ReliabilityRow) => Math.max(0, Math.round((Date.parse(r.actual) - Date.parse(r.promised)) / 86400000))
export function PromiseReliability() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PLN-RELIABILITY")
  const [grp, setGrp] = useState<"customer" | "item" | "month">("month")
  const rows = st.empty ? [] : s.reliability
  const kept = rows.filter((r) => late(r) === 0)
  const rate = rows.length ? Math.round((kept.length / rows.length) * 100) : 0
  const avgLate = rows.filter((r) => late(r) > 0).reduce((a, r) => a + late(r), 0) / Math.max(1, rows.filter((r) => late(r) > 0).length)
  const key = (r: ReliabilityRow) => (grp === "customer" ? r.customerId : grp === "item" ? r.itemId : r.promised.slice(0, 7))
  const groups = [...new Set(rows.map(key))].sort().map((k) => {
    const g = rows.filter((r) => key(r) === k)
    return { key: k, label: grp === "customer" ? custName(k) : k, n: g.length, kept: g.filter((r) => late(r) === 0).length, pct: Math.round((g.filter((r) => late(r) === 0).length / g.length) * 100) }
  })
  const causes = [...new Set(rows.filter((r) => late(r) > 0).map(cause))].map((c) => ({ cause: c, n: rows.filter((r) => late(r) > 0 && cause(r) === c).length })).sort((a, b) => b.n - a.n)
  const live = s.atRisk.filter((a) => a.state !== "Resolved").length
  const cfg: ChartConfig = { pct: { label: "Kept on or before the promise (%)", color: "var(--chart-2)" } }
  const cols: Column<ReliabilityRow>[] = [
    { id: "so", header: "Sales order", value: (r) => r.soId, cell: (r) => <><SoLink id={r.soId} />/{r.line}</>, sortable: true },
    { id: "cust", header: "Customer", value: (r) => custName(r.customerId), filterable: true },
    { id: "item", header: "Item", value: (r) => r.itemId, cell: (r) => <Item id={r.itemId} /> },
    { id: "prom", header: "Promised", value: (r) => r.promised, sortable: true, cell: (r) => fmtDate(r.promised) },
    { id: "act", header: "Shipped", value: (r) => r.actual, cell: (r) => fmtDate(r.actual) },
    { id: "late", header: "Days late", value: (r) => late(r), align: "right", mono: true, sortable: true },
    { id: "cause", header: "Cause", value: (r) => cause(r), filterable: true },
    { id: "snap", header: "Snapshot", value: (r) => r.snapshotId, mono: true },
  ]
  return (
    <DashboardPage
      header={{
        title: "Promise reliability", screenId: "FX-PLN-RELIABILITY",
        description: "How often a promise made by a promise check was kept, by customer, item or month, and what broke the ones that slipped.",
        chips: <Chip kind="design" note="History is seeded (fictitious). On time means shipped on or before the promised date; the PRD gives no tolerance">Seeded history</Chip>,
        actions: <StatePreview extended />,
      }}
      tiles={[
        { label: "Promises kept", value: `${rate}%`, hint: `${kept.length} of ${rows.length} shipped on or before the promise`, tone: rate < 80 ? "attention" : "default" },
        { label: "Average days late", value: fmtNumber(avgLate, 1), hint: "of the late ones" },
        { label: "Top cause", value: causes[0]?.cause ?? "none", hint: causes[0] ? `${causes[0].n} late promise(s)` : undefined },
        { label: "Promises at risk now", value: live, hint: "Open at-risk records", to: "/production/at-risk" },
      ]}
    >
      <div className="col-span-full flex flex-col gap-3">
        <StateBanner st={st} />
        {st.loading ? <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading"><div className="h-48 rounded-lg border" /></div>
          : st.error ? <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{st.error} <button className="underline" onClick={st.retry}>Try again</button></p>
          : st.empty ? <EmptyState title="No promise history">Reliability appears once promised orders ship.</EmptyState> : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span>Group by</span>
              <Select value={grp} onValueChange={(v) => setGrp(v as typeof grp)}><SelectTrigger size="sm" className="w-32" aria-label="Group by"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">Month</SelectItem><SelectItem value="customer">Customer</SelectItem><SelectItem value="item">Item</SelectItem></SelectContent></Select>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardCard title="Reliability by group">
                <ChartContainer config={cfg} className="h-56 w-full"><BarChart data={groups}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickFormatter={(v: string) => v.slice(0, 10)} /><YAxis domain={[0, 100]} unit="%" /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="pct" fill="var(--color-pct)" /></BarChart></ChartContainer>
              </DashboardCard>
              <DashboardCard title="Causes of late promises">
                {causes.length === 0 ? <p className="text-sm text-muted-foreground">No late promise.</p> : <ul className="flex flex-col gap-1 text-sm">{causes.map((c) => <li key={c.cause} className="tabular flex justify-between border-b pb-1"><span>{c.cause}</span><span>{c.n}</span></li>)}</ul>}
                <p className="text-xs text-muted-foreground">Causes follow the revalidation triggers of the at-risk board (supply slip, ECO, work center outage) plus rework, test failure and customer change.</p>
              </DashboardCard>
            </div>
            <DataTable<ReliabilityRow> rows={rows} columns={cols} rowId={(r) => r.id} densityKey="FX-PLN-RELIABILITY" searchText={(r) => `${r.soId} ${r.itemId} ${custName(r.customerId)} ${cause(r)}`} initialSort={{ id: "prom", dir: "desc" }} empty={{ title: "No shipped promises" }} />
          </>
        )}
      </div>
      <div className="col-span-full"><RulesPanel rules={[
        ["§4", "A promise made by CTP is revalidated on supply slip, ECO, work center outage and rework; a slip raises an at-risk record", "DOC:p.193 §4"],
        ["Snapshot", "Each promise references the schedule snapshot it was made against", "DOC:p.193 §3"],
      ]} /></div>
    </DashboardPage>
  )
}
