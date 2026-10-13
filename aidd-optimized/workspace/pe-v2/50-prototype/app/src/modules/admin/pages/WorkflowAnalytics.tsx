// FX-WF-ANALYTICS Workflow analytics dashboard [DOC:p.217 Book IV §7.7]: the monthly review of each workflow owner
// (W.4 governance loop): SLA attainment, aging by step, bottleneck approvers, rejection rate, delegation usage and
// override frequency. The PRD names the measures; the formulas are reading AR-31 and are printed under each figure.

import { Link, useSearchParams } from "react-router"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Chip, DataTable, EmptyState, RulesPanel } from "@/components/patterns"
import { DashboardCard, DashboardPage } from "@/components/templates"
import { useCore, useSlice } from "@/store"
import { fmtMonth } from "../lib/time"
import { analyse, monthsOf, pct, type WfStats } from "../lib/analytics"
import { inboxRows } from "../lib/engine"
import { SimpleSelect, Field } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

const slaCfg = { attained: { label: "SLA attainment %", color: "var(--chart-2)" } } satisfies ChartConfig
const agingCfg = { within: { label: "Within SLA", color: "var(--chart-2)" }, near: { label: "Past half the SLA", color: "var(--chart-4)" }, over: { label: "Over the SLA", color: "var(--chart-1)" } } satisfies ChartConfig

export function WorkflowAnalytics() {
  const [params, setParams] = useSearchParams()
  const a = useSlice("admin")
  const core = useCore()
  const view = useView("FX-WF-ANALYTICS")
  const rows = inboxRows(core.approvals, a)
  const months = monthsOf(rows)
  const month = params.get("month") ?? months[0] ?? "all"
  const owner = params.get("owner") ?? "all"
  const data = analyse(rows, month)
  const wfs = data.workflows.filter((w) => owner === "all" || w.owner === owner)
  const owners = [...new Set(data.workflows.map((w) => w.owner))].sort()
  const sum = (f: (w: WfStats) => number) => wfs.reduce((n, w) => n + f(w), 0)
  const steps = sum((w) => w.stepsDecided)
  const within = sum((w) => w.stepsWithinSla)
  const decided = sum((w) => w.decidedRequests)
  const rejected = sum((w) => w.rejectedRequests)
  const delegated = sum((w) => w.delegated)
  const overrides = sum((w) => w.overrides)
  const overOpen = sum((w) => w.aging.over)
  const setParam = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); if (v === "all" && k === "owner") n.delete(k); else n.set(k, v); return n })
  const slaChart = wfs.filter((w) => w.stepsDecided > 0).map((w) => ({ wf: w.wfId, attained: Math.round((w.stepsWithinSla / w.stepsDecided) * 100) }))
  const agingChart = data.aging.filter((x) => wfs.some((w) => w.wfId === x.wfId)).slice(0, 10).map((x) => ({ step: `${x.wfId} ${x.step}`, within: x.within, near: x.near, over: x.over }))
  const noData = wfs.length === 0

  return (
    <div className="flex flex-col gap-6">
      <DashboardPage
        header={{
          title: "Workflow analytics",
          screenId: "FX-WF-ANALYTICS",
          description: `Read by each workflow owner at the monthly review. ${month === "all" ? "All time" : fmtMonth(month)}${owner === "all" ? ", all workflow owners" : `, owner ${owner}`}.`,
          chips: <Chip kind="design" note="Route /approvals/analytics and every formula are design values (AR-31)">Design route</Chip>,
          crumbs: [{ label: "Approvals", to: "/approvals" }, { label: "Analytics" }],
          actions: (
            <>
              <StatePicker view={view} />
              <Button variant="outline" asChild><Link to="/approvals">Back to the inbox</Link></Button>
            </>
          ),
        }}
        tiles={view.state === "normal" || view.state === "degraded" || view.state === "offline" || view.state === "readonly" || view.state === "conflict" ? [
          { label: "SLA attainment", value: pct(within, steps), hint: `${within} of ${steps} decided steps within SLA` },
          { label: "Steps over SLA now", value: overOpen, hint: "open steps older than their SLA", tone: overOpen ? "attention" : "default" },
          { label: "Rejection rate", value: pct(rejected, decided), hint: `${rejected} of ${decided} decided requests` },
          { label: "Delegation / override", value: `${pct(delegated, steps)} / ${pct(overrides, steps)}`, hint: "of decided steps" },
        ] : undefined}
      >
        <div className="lg:col-span-2 flex flex-wrap items-end gap-4">
          <Field id="an-month" label="Month" className="w-48"><SimpleSelect id="an-month" value={month} onChange={(v) => setParam("month", v)} options={[{ value: "all", label: "All time" }, ...months.map((m) => ({ value: m, label: fmtMonth(m) }))]} /></Field>
          <Field id="an-owner" label="Workflow owner" className="w-56"><SimpleSelect id="an-owner" value={owner} onChange={(v) => setParam("owner", v)} options={[{ value: "all", label: "All owners" }, ...owners.map((o) => ({ value: o, label: o }))]} /></Field>
        </div>
        <div className="lg:col-span-2 flex flex-col gap-4">
          <StateFrame view={view} cols={6} emptyTitle="No approval activity to analyse." emptyBody="Requests raised from the module screens and decided in WF-INBOX appear here." degraded="Degraded: the reporting replica is behind. Figures may miss the last few minutes of decisions." subject="workflow analytics">
            {noData ? (
              <EmptyState title={`No approval activity in ${month === "all" ? "this period" : fmtMonth(month)}.`}>Pick another month or owner.</EmptyState>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <DashboardCard title="SLA attainment by workflow">
                  {slaChart.length ? (
                    <ChartContainer config={slaCfg} className="h-64 w-full">
                      <BarChart data={slaChart}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="wf" />
                        <YAxis domain={[0, 100]} unit="%" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="attained" fill="var(--color-attained)" radius={2} />
                      </BarChart>
                    </ChartContainer>
                  ) : <p className="text-sm text-muted-foreground">No step was decided in this view, so no attainment can be computed.</p>}
                  <p className="text-xs text-muted-foreground">Formula: steps decided within their SLA ÷ steps decided in the month (AR-31).</p>
                </DashboardCard>
                <DashboardCard title="Aging by step: open steps against their SLA">
                  {agingChart.length ? (
                    <ChartContainer config={agingCfg} className="h-64 w-full">
                      <BarChart data={agingChart} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="step" width={150} tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="within" stackId="a" fill="var(--color-within)" />
                        <Bar dataKey="near" stackId="a" fill="var(--color-near)" />
                        <Bar dataKey="over" stackId="a" fill="var(--color-over)" />
                      </BarChart>
                    </ChartContainer>
                  ) : <p className="text-sm text-muted-foreground">No step is open in this view.</p>}
                  <p className="text-xs text-muted-foreground">Buckets: under half the SLA, half to the full SLA, over the SLA (AR-31).</p>
                </DashboardCard>
                <DashboardCard title="Bottleneck approvers" className="lg:col-span-2">
                  <DataTable
                    rows={data.bottlenecks}
                    rowId={(b) => b.role}
                    densityKey="FX-WF-ANALYTICS-approvers"
                    caption="Bottleneck approvers"
                    initialSort={{ id: "over", dir: "desc" }}
                    empty={{ title: "No approver has steps in this view." }}
                    columns={[
                      { id: "role", header: "Approver role", value: (b) => b.role, filterable: true },
                      { id: "dec", header: "Steps decided", value: (b) => b.stepsDecided, align: "right", mono: true, sortable: true },
                      { id: "avg", header: "Average time to decide (h)", value: (b) => Math.round(b.avgHours * 10) / 10, align: "right", mono: true, sortable: true },
                      { id: "open", header: "Open now", value: (b) => b.open, align: "right", mono: true, sortable: true },
                      { id: "over", header: "Over SLA now", value: (b) => b.overdue, align: "right", mono: true, sortable: true },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">Ranked by steps over SLA now, then by average time to decide.</p>
                </DashboardCard>
                <DashboardCard title="Rates by workflow" className="lg:col-span-2">
                  <DataTable<WfStats>
                    rows={wfs}
                    rowId={(w) => w.wfId}
                    densityKey="FX-WF-ANALYTICS-rates"
                    caption="Rejection, delegation and override rates"
                    rowHref={(w) => `/configuration/workflows?wf=${w.wfId}`}
                    searchText={(w) => `${w.wfId} ${w.workflow} ${w.owner}`}
                    columns={[
                      { id: "wf", header: "Workflow", value: (w) => `${w.wfId} ${w.workflow}`, cell: (w) => <span><span className="font-mono">{w.wfId}</span> {w.workflow}</span> },
                      { id: "own", header: "Owner", value: (w) => w.owner, filterable: true },
                      { id: "req", header: "Requests", value: (w) => w.requests, align: "right", mono: true, sortable: true },
                      { id: "sla", header: "SLA attained", value: (w) => (w.stepsDecided ? w.stepsWithinSla / w.stepsDecided : -1), align: "right", sortable: true, cell: (w) => pct(w.stepsWithinSla, w.stepsDecided) },
                      { id: "rej", header: "Rejected", value: (w) => (w.decidedRequests ? w.rejectedRequests / w.decidedRequests : -1), align: "right", sortable: true, cell: (w) => pct(w.rejectedRequests, w.decidedRequests) },
                      { id: "del", header: "Delegated", value: (w) => (w.stepsDecided ? w.delegated / w.stepsDecided : -1), align: "right", sortable: true, cell: (w) => pct(w.delegated, w.stepsDecided) },
                      { id: "ovr", header: "Overrides", value: (w) => (w.stepsDecided ? w.overrides / w.stepsDecided : -1), align: "right", sortable: true, cell: (w) => pct(w.overrides, w.stepsDecided) },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">Override = a step decided by a delegate or after its SLA had breached. Delegation usage = steps decided by a delegate. Both are readings (AR-31): the PRD names the measures only.</p>
                </DashboardCard>
              </div>
            )}
          </StateFrame>
        </div>
      </DashboardPage>
      <RulesPanel
        rules={[
          ["7.7-a", "Workflow analytics for each workflow owner's monthly review: SLA attainment, aging by step, bottleneck approvers, rejection rate, delegation usage, override frequency", "DOC:p.217 §7.7"],
          ["W.4", "Every governed action routes to the one approvals inbox; owners are the register's owner column", "DOC:pp.11-12 W.4"],
          ["7.5-b", "A number that appears on two screens from two formulas is a defect: these formulas are the only ones used here", "DOC:p.217 §7.5"],
        ]}
      />
    </div>
  )
}
