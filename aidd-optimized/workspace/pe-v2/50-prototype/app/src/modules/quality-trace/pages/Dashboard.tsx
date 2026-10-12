// QM-DASH-001 Quality Dashboard [DOC:p.264 Book VI; Book I E §2] (asserted).
// Widgets: open inspections by gate, first pass yield, NCR funnel, vendor quality, cost of quality,
// hold inventory. Primary action: drill to each queue. Navigation only; no postings or scans.

import { Link } from "react-router"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { DashboardCard, DashboardPage } from "@/components/templates"
import { Chip, ErrorAlert, StatusBadge } from "@/components/patterns"
import { TODAY } from "@/data/shared"
import { fmtMoney, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { isOverdue } from "../data/actions"
import { lotOverdue } from "../data/derive"
import { COQ, FPY_BY_WC, FPY_TREND, VENDOR_LOTS, instrumentStatus } from "../data/seed"
import { GATES } from "../data/types"
import { DocLinkText, Reading, materialText, useDataState, vendorName, SkeletonTable } from "../components/bits"

const fpyCfg = { IQC: { label: "IQC", color: "var(--chart-1)" }, IPQC: { label: "IPQC", color: "var(--chart-3)" }, FQC: { label: "FQC", color: "var(--chart-5)" } } satisfies ChartConfig
const coqCfg = { scrap: { label: "Scrap", color: "var(--chart-2)" }, rework: { label: "Rework", color: "var(--chart-3)" }, warranty: { label: "Warranty and recall", color: "var(--chart-5)" } } satisfies ChartConfig
const gateCfg = { open: { label: "Open", color: "var(--chart-3)" }, over: { label: "Over SLA", color: "var(--chart-5)" } } satisfies ChartConfig
const FLAG_PCT = 95 // reading QT-R04

export function QualityDashboard() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-DASH-001")
  if (ds.error) return <ErrorAlert title="Could not load quality figures" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  const open = s.lots.filter((l) => !l.decision)
  const finOpen = s.finalTests.filter((f) => !f.finalResult)
  const byGate = GATES.map((g) => {
    const lots = g.gate === "FQC" ? finOpen.map(() => ({ over: false })) : open.filter((l) => l.gate === g.gate).map((l) => ({ over: lotOverdue(l, TODAY) }))
    return { gate: g.gate, label: g.label, open: lots.length - lots.filter((x) => x.over).length, over: lots.filter((x) => x.over).length, to: g.gate === "FQC" ? "/quality/final-test" : `/quality/inspections?gate=${g.gate}` }
  })
  const funnel = (["Open", "Dispositioned", "Closed"] as const).map((st) => ({ st, n: s.ncrs.filter((n) => n.stage === st).length }))
  const escalated = { capa: s.ncrs.filter((n) => n.capaId).length, scar: s.ncrs.filter((n) => n.scarId).length }
  const holds = s.batches.filter((b) => b.stock !== "Unrestricted" && b.qty > 0)
  const fpyNow = FPY_TREND[FPY_TREND.length - 1]
  const vendors = VENDOR_LOTS.map((v) => ({ ...v, pct: (v.accepted / v.lots) * 100, overdue: s.scars.filter((x) => x.vendorId === v.vendorId && isOverdue(x, TODAY)).length })).sort((a, b) => a.pct - b.pct)
  const hero = s.recalls.find((r) => r.id === "RCL-2026-001")
  return (
    <DashboardPage
      header={{
        title: "Quality Dashboard",
        screenId: "QM-DASH-001",
        description: "Quality team landing page. Every figure drills to its queue.",
        chips: <Reading id="QT-R19" />,
      }}
      tiles={
        ds.loading
          ? undefined
          : [
              { label: "Open inspections", value: open.length + finOpen.length, hint: `${open.filter((l) => lotOverdue(l, TODAY)).length} over SLA`, to: "/quality/inspections", tone: open.some((l) => lotOverdue(l, TODAY)) ? "attention" : "default" },
              { label: "First pass yield, final test (Oct)", value: fmtPct(fpyNow.FQC), hint: `IQC ${fmtPct(fpyNow.IQC)} · IPQC ${fmtPct(fpyNow.IPQC)}`, to: "/quality/final-test?q=fail" },
              { label: "NCRs open", value: funnel[0].n + funnel[1].n, hint: `${escalated.capa} to CAPA, ${escalated.scar} to SCAR`, to: "/quality/capa?tab=ncr" },
              { label: "Hold inventory batches", value: holds.length, hint: `${holds.filter((b) => b.stock === "Blocked").length} Blocked`, to: "/traceability/explorer", tone: holds.some((b) => b.stock === "Blocked") ? "attention" : "default" },
            ]
      }
    >
      {ds.loading ? (
        <DashboardCard title="Loading" className="lg:col-span-2">
          <SkeletonTable cols={4} rows={6} />
        </DashboardCard>
      ) : (
        <>
          <DashboardCard title="Open inspections by gate">
            <ChartContainer config={gateCfg} className="h-48 w-full">
              <BarChart data={byGate}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="gate" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar isAnimationActive={false} dataKey="open" stackId="g" fill="var(--color-open)" />
                <Bar isAnimationActive={false} dataKey="over" stackId="g" fill="var(--color-over)" />
              </BarChart>
            </ChartContainer>
            <ul className="flex flex-wrap gap-4 text-sm">
              {byGate.map((g) => (
                <li key={g.gate}>
                  <Link className="text-link underline-offset-4 hover:underline" to={g.to}>{g.label}: {g.open + g.over}</Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard title="First pass yield by gate (6 months)">
            <ChartContainer config={fpyCfg} className="h-48 w-full">
              <LineChart data={FPY_TREND}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis domain={[88, 100]} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line isAnimationActive={false} dataKey="IQC" stroke="var(--color-IQC)" dot={false} strokeWidth={2} />
                <Line isAnimationActive={false} dataKey="IPQC" stroke="var(--color-IPQC)" dot={false} strokeWidth={2} />
                <Line isAnimationActive={false} dataKey="FQC" stroke="var(--color-FQC)" dot={false} strokeWidth={2} />
              </LineChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground">Lowest work center this month: {[...FPY_BY_WC].sort((a, b) => a.fpy - b.fpy).slice(0, 2).map((w) => `${w.wc} ${fmtPct(w.fpy)}`).join(", ")}</p>
          </DashboardCard>
          <DashboardCard title="NCR funnel" action={<Link className="text-sm font-normal text-link" to="/quality/capa?tab=ncr">All NCRs</Link>}>
            <Table>
              <TableBody>
                {funnel.map((f) => (
                  <TableRow key={f.st}>
                    <TableCell>{f.st}</TableCell>
                    <TableCell className="tabular text-right">{f.n}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>Escalated to CAPA</TableCell>
                  <TableCell className="tabular text-right"><Link className="text-link" to="/quality/capa">{escalated.capa}</Link></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Escalated to SCAR</TableCell>
                  <TableCell className="tabular text-right"><Link className="text-link" to="/quality/scar">{escalated.scar}</Link></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">Stage words <Reading id="QT-R02" /></p>
          </DashboardCard>
          <DashboardCard title="Vendor quality (rolling 90 days)" action={<Reading id="QT-R04" />}>
            <Table>
              <TableHeader className="bg-table-head">
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Lots</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead>Overdue SCARs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.slice(0, 6).map((v) => (
                  <TableRow key={v.vendorId}>
                    <TableCell>
                      {vendorName(v.vendorId)} {v.pct < FLAG_PCT && <Chip kind="flag">Below threshold</Chip>}
                    </TableCell>
                    <TableCell className="tabular text-right">{v.lots}</TableCell>
                    <TableCell className="tabular text-right">{fmtPct(v.pct)}</TableCell>
                    <TableCell>{v.overdue ? <Link className="text-link" to="/quality/scar">{v.overdue}</Link> : "0"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DashboardCard>
          <DashboardCard title="Cost of quality (USD)">
            <ChartContainer config={coqCfg} className="h-48 w-full">
              <BarChart data={COQ}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar isAnimationActive={false} dataKey="scrap" stackId="c" fill="var(--color-scrap)" />
                <Bar isAnimationActive={false} dataKey="rework" stackId="c" fill="var(--color-rework)" />
                <Bar isAnimationActive={false} dataKey="warranty" stackId="c" fill="var(--color-warranty)" />
              </BarChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground">October to date: {fmtMoney(COQ[COQ.length - 1].scrap + COQ[COQ.length - 1].rework + COQ[COQ.length - 1].warranty)}; live figures come from accounting.</p>
          </DashboardCard>
          <DashboardCard title="Hold inventory">
            <Table>
              <TableHeader className="bg-table-head">
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holds.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="tabular"><DocLinkText r={{ type: "batch", id: b.id }} /></TableCell>
                    <TableCell className="text-xs">{materialText(b.materialId)}</TableCell>
                    <TableCell className="tabular text-right">{b.qty.toLocaleString("en-US")}</TableCell>
                    <TableCell>
                      <StatusBadge kind="stock" status={b.stock} size="sm" />
                      {b.reservedFor && <span className="ml-1 text-xs text-muted-foreground">reserved {b.reservedFor}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DashboardCard>
          <DashboardCard title="Calibration due" action={<Link className="text-sm font-normal text-link" to="/quality/calibration">Register</Link>}>
            <ul className="flex flex-col gap-1 text-sm">
              {s.instruments
                .filter((i) => instrumentStatus(i, TODAY) !== "In Cal")
                .map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <Link className="text-link" to={`/quality/calibration?ins=${i.id}`}>{i.label}</Link> {i.name} <StatusBadge kind="instrument" status={instrumentStatus(i, TODAY)} size="sm" />
                  </li>
                ))}
            </ul>
          </DashboardCard>
          {hero && (
            <DashboardCard title="Hero thread SO-2026-00301: quality path">
              <ol className="flex flex-col gap-1 text-sm">
                <li>Incoming bushings <DocLinkText r={{ type: "inspectionLot", id: "IL-TBD-0301" }} /> accepted, batch <DocLinkText r={{ type: "batch", id: "BAT-TBD-B0301" }} /></li>
                <li>Final test <Link className="text-link" to="/quality/final-test/IL-TBD-0302">IL-TBD-0302</Link>, FTR-2026-0188 on SN-TBD-20M-0301</li>
                <li>Return inspection <DocLinkText r={{ type: "inspectionLot", id: "IL-TBD-0304" }} /> raised <DocLinkText r={{ type: "ncr", id: "NCR-TBD-0044" }} /></li>
                <li><DocLinkText r={{ type: "scar", id: "SCAR-TBD-0009" }} /> and <DocLinkText r={{ type: "capa", id: "CAPA-TBD-0015" }} /></li>
                <li className="flex items-center gap-2">
                  <DocLinkText r={{ type: "recall", id: hero.id }} /> <StatusBadge kind="recall" status={hero.stage} size="sm" />
                </li>
                <li><Link className="text-link" to="/traceability/explorer?q=SN-TBD-20M-0301">Trace SN-TBD-20M-0301</Link></li>
              </ol>
            </DashboardCard>
          )}
        </>
      )}
    </DashboardPage>
  )
}
