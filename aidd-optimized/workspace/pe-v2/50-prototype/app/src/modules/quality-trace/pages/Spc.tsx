// FX-QM-SPC SPC control charts, capability and trend alerts, DEC-09 (Phase 2) [DOC:p.37] (asserted).
// Individuals charts on IP-INP and IP-FIN characteristics: centre line and 3-sigma limits locked on
// the first 20 points, specification limits, capability (Cp, Cpk) with a band, a moving-range chart,
// and trend alerts that a Quality engineer acknowledges with a note. Rules and bands: QT-R29.

import { useState } from "react"
import { Link } from "react-router"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { DashboardCard, DialogShell } from "@/components/templates"
import { Chip, KV, RulesPanel } from "@/components/patterns"
import { useRole, useSlice } from "@/store"
import { BASELINE_N, CPK_CAPABLE, CPK_MARGINAL, RULES, signalsOf, statsOf, type SpcSignal } from "../data/spc"
import { spcX } from "../data/extra-actions"
import type { SpcSeries } from "../data/extra-types"
import { Reading, Stat, report, userName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"
import { useSearchParams } from "react-router"

const cfg = { value: { label: "Measurement", color: "var(--chart-1)" } } satisfies ChartConfig
const mrCfg = { mr: { label: "Moving range", color: "var(--chart-3)" } } satisfies ChartConfig
const SPC_RULES: [string, string, string][] = [
  ["SPC-1", "Control charts, capability and trend alerts apply to the characteristics of in-process (IP-INP) and final (IP-FIN) plans. Phase 2.", "DOC:p.37 DEC-09"],
  ["SPC-2", `Limits are locked on the first ${BASELINE_N} points of the series; later points are judged against them.`, "README QT-R29"],
  ["SPC-3", `Cpk ${CPK_CAPABLE} or more is Capable, ${CPK_MARGINAL.toFixed(2)} to ${CPK_CAPABLE} Marginal, below ${CPK_MARGINAL.toFixed(2)} Not capable. A one-sided limit gives Cpk only.`, "README QT-R29"],
  ...(Object.entries(RULES).map(([k, v]) => [`SPC-${k}`, v, "README QT-R29"]) as [string, string, string][]),
]

export function SpcCharts() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-QM-SPC")
  const [role] = useRole()
  const [params, setParams] = useSearchParams()
  const [gate, setGate] = useState<"all" | "IPQC" | "FQC">("all")
  const list = s.spcSeries.filter((x) => gate === "all" || x.gate === gate)
  const id = params.get("series") ?? list[0]?.id ?? ""
  const series = s.spcSeries.find((x) => x.id === id) ?? list[0]
  const all = s.spcSeries.map((x) => ({ x, st: statsOf(x), sig: signalsOf(x) }))
  const open = all.flatMap((a) => a.sig.map((g) => ({ a, g }))).filter(({ g }) => !s.spcAcks.some((k) => k.key === g.key))
  const [ack, setAck] = useState<SpcSignal | null>(null)
  const canAck = role === "Quality engineer" || role === "Quality Manager"
  return (
    <>
      <StateFrame
        ss={ss}
        title="SPC control charts"
        screenId="FX-QM-SPC"
        entity="control charts"
        allowed="Quality engineer or Quality Manager"
        validation={["Record what was checked or done about the signal before you acknowledge it."]}
        conflict={{ what: "the alert on SPC-LOAD-LOSS", mine: "Acknowledge: transformer winding batch checked", theirs: "Another engineer acknowledged it with a different note" }}
        degraded="The last final-test results may not be in the charts yet; the rest is current."
        header={{
          title: "SPC control charts",
          screenId: "FX-QM-SPC",
          crumbs: [{ label: "Quality" }, { label: "SPC" }],
          description: "Process control for the characteristics of in-process and final test plans: charts with control limits, capability, and trend alerts to acknowledge.",
          chips: <><Chip kind="design" note="DEC-09, Phase 2">Phase 2</Chip><Reading id="QT-R29" /></>,
        }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Stat label="Characteristics monitored" value={all.length} />
            <Stat label="Capable" value={all.filter((a) => a.st.band === "Capable").length} />
            <Stat label="Marginal or not capable" value={all.filter((a) => a.st.band === "Marginal" || a.st.band === "Not capable").length} tone={all.some((a) => a.st.band === "Not capable" || a.st.band === "Marginal") ? "attention" : undefined} />
            <Stat label="Open trend alerts" value={open.length} tone={open.length ? "attention" : undefined} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <nav aria-label="Characteristics" className="flex flex-col gap-2">
              <div role="group" aria-label="Gate" className="flex gap-1">
                {(["all", "IPQC", "FQC"] as const).map((g) => (
                  <Button key={g} size="sm" variant={gate === g ? "default" : "outline"} aria-pressed={gate === g} onClick={() => setGate(g)}>
                    {g === "all" ? "All" : g === "IPQC" ? "In-process" : "Final test"}
                  </Button>
                ))}
              </div>
              {list.length === 0 && <p className="text-sm text-muted-foreground">No characteristic in this gate.</p>}
              {list.map((x) => {
                const st = statsOf(x)
                const sg = signalsOf(x).filter((g) => !s.spcAcks.some((k) => k.key === g.key))
                return (
                  <button key={x.id} type="button" aria-current={x.id === series?.id} onClick={() => (params.set("series", x.id), setParams(params, { replace: true }))} className={`flex min-h-12 flex-col gap-1 rounded-lg border p-3 text-left text-sm ${x.id === series?.id ? "border-primary bg-muted" : ""}`}>
                    <span className="flex items-center justify-between gap-2 font-medium">{x.characteristic}<span className="text-xs text-muted-foreground">{x.gate}</span></span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Cpk {st.cpk != null ? st.cpk.toFixed(2) : "n/a"}</span>
                      {st.band === "Capable" ? <span>Capable</span> : st.band === "No limits" ? <span>No limits</span> : <Chip kind="flag">{st.band}</Chip>}
                      {sg.length > 0 && <Chip kind="flag">{sg.length} alert{sg.length > 1 ? "s" : ""}</Chip>}
                    </span>
                  </button>
                )
              })}
            </nav>
            {series ? <SeriesView series={series} onAck={setAck} canAck={canAck && !ss.locked} acks={s.spcAcks} /> : <p className="text-sm text-muted-foreground">Choose a characteristic.</p>}
          </div>
          <DashboardCard title={`Trend alerts (${open.length} open)`}>
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open alerts. Acknowledged alerts stay under the chart of their characteristic.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Characteristic</TableHead><TableHead>Rule</TableHead><TableHead>When</TableHead><TableHead>Detail</TableHead><TableHead><span className="sr-only">Act</span></TableHead></TableRow></TableHeader>
                <TableBody>
                  {open.map(({ a, g }) => (
                    <TableRow key={g.key}>
                      <TableCell>{a.x.characteristic}</TableCell>
                      <TableCell>{g.rule}: {RULES[g.rule]}</TableCell>
                      <TableCell className="tabular">{g.at} · {g.ref}</TableCell>
                      <TableCell>{g.detail}</TableCell>
                      <TableCell><Button size="sm" variant="outline" disabled={!canAck || ss.locked} onClick={() => setAck(g)}>Acknowledge</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!canAck && <p className="text-xs text-muted-foreground">Acknowledging is for the Quality engineer or Quality Manager; you are acting as {role}.</p>}
          </DashboardCard>
          <RulesPanel rules={SPC_RULES} />
        </div>
      </StateFrame>
      {ack && <AckDialog g={ack} onClose={() => setAck(null)} />}
    </>
  )
}

function SeriesView({ series, onAck, canAck, acks }: { series: SpcSeries; onAck: (g: SpcSignal) => void; canAck: boolean; acks: { key: string; by: string; on: string; note: string }[] }) {
  const st = statsOf(series)
  const sig = signalsOf(series)
  const flagged = new Set(sig.map((g) => g.idx))
  const data = series.points.map((p, i) => ({ i, ref: p.ref, at: p.at, value: p.value, mr: i ? Math.abs(p.value - series.points[i - 1].value) : undefined, bad: flagged.has(i) }))
  const vals = series.points.map((p) => p.value)
  const lo = Math.min(...vals, st.lcl, series.lsl ?? Infinity)
  const hi = Math.max(...vals, st.ucl, series.usl ?? -Infinity)
  const pad = (hi - lo) * 0.08
  const mrBar = st.sigma * 1.128 * 3.267
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DashboardCard title={`${series.characteristic} (${series.unit})`} action={<span className="text-xs text-muted-foreground">{series.planId} · {series.gate === "IPQC" ? "in-process" : "final test"} · {series.points.length} points</span>}>
        <ChartContainer config={cfg} className="h-64 w-full">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="at" tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis tickLine={false} axisLine={false} width={52} domain={[lo - pad, hi + pad]} tickFormatter={(v: number) => v.toFixed(1)} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_l, p) => `${p?.[0]?.payload?.ref ?? ""} · ${p?.[0]?.payload?.at ?? ""}`} />} />
            <ReferenceLine y={st.baselineMean} stroke="var(--muted-foreground)" label={{ value: "CL", position: "right", fontSize: 10 }} />
            <ReferenceLine y={st.ucl} stroke="var(--chart-5)" strokeDasharray="4 3" label={{ value: "UCL", position: "right", fontSize: 10 }} />
            <ReferenceLine y={st.lcl} stroke="var(--chart-5)" strokeDasharray="4 3" label={{ value: "LCL", position: "right", fontSize: 10 }} />
            {series.usl != null && <ReferenceLine y={series.usl} stroke="var(--destructive)" label={{ value: "USL", position: "right", fontSize: 10 }} />}
            {series.lsl != null && <ReferenceLine y={series.lsl} stroke="var(--destructive)" label={{ value: "LSL", position: "right", fontSize: 10 }} />}
            <ReferenceLine x={series.points[BASELINE_N - 1].at} stroke="var(--border)" strokeDasharray="2 2" label={{ value: "limits locked", position: "insideTopLeft", fontSize: 10 }} />
            <Line isAnimationActive={false} dataKey="value" stroke="var(--color-value)" strokeWidth={1.5} dot={(p: { cx?: number; cy?: number; payload?: { bad: boolean }; index?: number }) => (
              <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload?.bad ? 5 : 2.5} fill={p.payload?.bad ? "var(--destructive)" : "var(--color-value)"} stroke={p.payload?.bad ? "var(--background)" : "none"} />
            )} />
          </LineChart>
        </ChartContainer>
        <p className="text-xs text-muted-foreground">Filled red points break a rule. Limits are locked on the first {BASELINE_N} points. Target {series.target} {series.unit}{series.lsl != null || series.usl != null ? `; specification ${series.lsl ?? "no lower limit"} to ${series.usl ?? "no upper limit"}` : ""}.</p>
      </DashboardCard>
      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard title="Capability">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <KV k="Cpk">{st.cpk != null ? st.cpk.toFixed(2) : "No limits"}</KV>
            <KV k="Cp">{st.cp != null ? st.cp.toFixed(2) : "Needs both limits"}</KV>
            <KV k="Band">{st.band === "Capable" || st.band === "No limits" ? st.band : <Chip kind="flag">{st.band}</Chip>}</KV>
            <KV k="Mean (all points)">{st.mean.toFixed(3)}</KV>
            <KV k="Sigma (moving range)">{st.sigma.toFixed(3)}</KV>
            <KV k="Limits (3 sigma)">{`${st.lcl.toFixed(2)} to ${st.ucl.toFixed(2)}`}</KV>
          </dl>
        </DashboardCard>
        <DashboardCard title="Moving range">
          <ChartContainer config={mrCfg} className="h-36 w-full">
            <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="at" tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => v.toFixed(1)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={mrBar} stroke="var(--chart-5)" strokeDasharray="4 3" />
              <Line isAnimationActive={false} dataKey="mr" stroke="var(--color-mr)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ChartContainer>
        </DashboardCard>
      </div>
      <DashboardCard title={`Alerts on this characteristic (${sig.length})`}>
        {sig.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rule is broken. The process is in control.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {sig.map((g) => {
              const k = acks.find((a) => a.key === g.key)
              return (
                <li key={g.key} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <Chip kind="flag">{g.rule}</Chip>
                  <span className="tabular text-muted-foreground">{g.at} · {g.ref}</span>
                  <span>{g.detail}</span>
                  {k ? <span className="ml-auto text-muted-foreground">Acknowledged {k.on} by {userName(k.by)}: {k.note}</span> : <Button size="sm" className="ml-auto" variant="outline" disabled={!canAck} onClick={() => onAck(g)}>Acknowledge</Button>}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Source records: <Link className="text-link underline-offset-4 hover:underline" to={series.gate === "FQC" ? "/quality/final-test" : "/quality/inspections?gate=IPQC"}>{series.gate === "FQC" ? "Final Test and FTR" : "In-process inspections"}</Link></p>
      </DashboardCard>
    </div>
  )
}

function AckDialog({ g, onClose }: { g: SpcSignal; onClose: () => void }) {
  const s = useSlice("qualityTrace")
  const name = s.spcSeries.find((x) => g.key.startsWith(x.id + "|"))?.characteristic ?? ""
  return (
    <DialogShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Acknowledge ${g.rule} on ${name}`}
      description={g.detail}
      consequence="Marks the alert as seen with your note and your name. The signal stays on the chart; acknowledging does not change any inspection or stock."
      confirmLabel="Acknowledge"
      requireReason
      reasonLabel="What was checked or done (required)"
      onConfirm={(note) => {
        const r = spcX.acknowledge(g.key, note)
        return report(r, "Alert acknowledged") ? null : (r as { error: string }).error
      }}
    />
  )
}

