// TRC-DASH Traceability Completeness Dashboard [DOC:p.274 Book VI; Book IV §4.3] (asserted).
// Coverage percent, orphan and missing event counts, delayed offline events, unresolved corrections,
// each with an assigned-owner worklist. Actions: assign; resolve through the correction pair flow.
// Arrives from the daily control jobs. Postings and scans: none.

import { useState } from "react"
import { Link } from "react-router"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { DashboardCard, DashboardPage, DialogShell } from "@/components/templates"
import { EmptyState, ErrorAlert, RulesPanel } from "@/components/patterns"
import { USERS } from "@/data/shared"
import { fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { traceOps } from "../data/actions"
import { verifyChain } from "../data/chain"
import { CONTROL_RUNS } from "../data/seed"
import type { TraceException } from "../data/types"
import { Pick, Reading, report, useDataState, userName, SkeletonTable } from "../components/bits"

export const TRCD_RULES: [string, string, string][] = [
  ["TRC-D1", "A daily control job compares traceability postings with the transactions that should have produced them; gaps become orphan or missing events.", "DOC:Book IV §4.3"],
  ["TRC-D2", "Offline captures queue for up to 4 hours; later syncs are delayed offline events for review.", "DOC:Book IV §4.3; p.96"],
  ["TRC-D3", "An unresolved correction is a reversal with no replacement; it is resolved only through the correction pair flow (C-53).", "DOC:p.212 §4.2-4.3"],
  ["TRC-D4", "Every exception has an assigned owner until resolved.", "DOC:p.274 TRC-DASH"],
]

const KINDS: TraceException["kind"][] = ["Orphan event", "Missing event", "Delayed offline event", "Unresolved correction"]
const chartCfg = { accepted: { label: "Accepted", color: "var(--chart-2)" }, gap: { label: "Gap", color: "var(--chart-4)" } } satisfies ChartConfig
const OWNERS = USERS.filter((u) => u.roles.some((r) => ["Quality IT", "Plant IT", "Production supervisor", "Receiving clerk", "Warehouse supervisor", "Quality engineer"].includes(r)))

export function TraceDashboard() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("TRC-DASH")
  const [resolving, setResolving] = useState<TraceException | null>(null)
  const open = s.traceExceptions.filter((x) => !x.resolvedOn)
  const postings = CONTROL_RUNS.reduce((a, r) => a + r.postings, 0)
  const acceptedN = CONTROL_RUNS.reduce((a, r) => a + r.accepted, 0)
  const gaps = open.filter((x) => x.kind === "Orphan event" || x.kind === "Missing event").length
  const coverage = ((acceptedN - gaps) / postings) * 100
  const bad = verifyChain(s.genealogy)
  if (ds.error) return <ErrorAlert title="Could not load the control results" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  const count = (k: TraceException["kind"]) => open.filter((x) => x.kind === k).length
  return (
    <>
      <DashboardPage
        header={{
          title: "Traceability Completeness",
          screenId: "TRC-DASH",
          description: "Worklists that keep the genealogy chain trustworthy, fed by the daily control job.",
          chips: <><Reading id="QT-R13" /><Reading id="QT-R22" /></>,
          primary: <Button onClick={() => report(traceOps.runControls(), (n) => (n ? `${n} new exception(s) raised` : "Control run complete: no new gaps"))}>Run control job now</Button>,
          actions: <Button variant="outline" asChild><Link to="/traceability/explorer">Trace Explorer</Link></Button>,
        }}
        tiles={
          ds.loading
            ? undefined
            : [
                { label: "Coverage (7 days)", value: fmtPct(coverage, 2), hint: `${acceptedN.toLocaleString("en-US")} of ${postings.toLocaleString("en-US")} postings, less ${gaps} open gaps`, tone: coverage < 99.5 ? "attention" : "default" },
                { label: "Orphan + missing events", value: count("Orphan event") + count("Missing event"), hint: `${count("Orphan event")} orphan, ${count("Missing event")} missing`, tone: gaps ? "attention" : "default" },
                { label: "Delayed offline events", value: count("Delayed offline event"), hint: "synced after the 4 h queue" },
                { label: "Unresolved corrections", value: count("Unresolved correction"), hint: bad.length ? `${bad.length} hash links broken` : "hash chain verified", tone: count("Unresolved correction") ? "attention" : "default" },
              ]
        }
      >
        {ds.loading ? (
          <DashboardCard title="Loading" className="lg:col-span-2"><SkeletonTable cols={5} rows={6} /></DashboardCard>
        ) : (
          <>
            <DashboardCard title="Daily control runs" className="lg:col-span-2">
              <ChartContainer config={chartCfg} className="h-56 w-full">
                <BarChart data={CONTROL_RUNS.map((r) => ({ day: r.day.slice(5), accepted: r.accepted, gap: r.postings - r.accepted }))}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar isAnimationActive={false} dataKey="accepted" stackId="a" fill="var(--color-accepted)" />
                  <Bar isAnimationActive={false} dataKey="gap" stackId="a" fill="var(--color-gap)" />
                </BarChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground">Control-run figures are seeded summaries (design values).</p>
            </DashboardCard>
            {KINDS.map((k) => (
              <DashboardCard key={k} title={`${k}s (${count(k)} open)`}>
                <Worklist items={ds.empty ? [] : s.traceExceptions.filter((x) => x.kind === k)} onResolve={setResolving} />
              </DashboardCard>
            ))}
          </>
        )}
      </DashboardPage>
      <div className="mt-4">
        <RulesPanel rules={TRCD_RULES} />
      </div>
      <DialogShell
        open={!!resolving}
        onOpenChange={(o) => !o && setResolving(null)}
        title={`Resolve ${resolving?.id}`}
        consequence={resolving?.kind === "Orphan event" ? `Records the missing T02 receipt for ${resolving?.object} as a late capture (append-only, with your reason) and closes the exception.` : `Closes the exception on ${resolving?.object}. The event store itself is not changed.`}
        confirmLabel="Resolve"
        requireReason
        reasonLabel="Resolution (required)"
        onConfirm={(reason) => {
          if (!resolving) return null
          const r = traceOps.resolve(resolving.id, reason)
          return report(r, "Resolved") ? null : (r as { error: string }).error
        }}
      />
    </>
  )
}

function Worklist({ items, onResolve }: { items: TraceException[]; onResolve: (x: TraceException) => void }) {
  if (!items.length) return <EmptyState title="Nothing in this worklist">The last control run found no exception of this kind.</EmptyState>
  return (
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead>Object</TableHead>
          <TableHead>Detail</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead><span className="sr-only">Action</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...items].sort((a, b) => Number(!!a.resolvedOn) - Number(!!b.resolvedOn)).map((x) => (
          <TableRow key={x.id} className={x.resolvedOn ? "text-muted-foreground" : undefined}>
            <TableCell className="tabular">
              <Link className="text-link underline-offset-4 hover:underline" to={`/traceability/explorer?q=${x.object}`}>{x.object}</Link>
              <div className="text-xs text-muted-foreground">{x.id} · {x.raisedOn}</div>
            </TableCell>
            <TableCell className="text-xs">{x.detail}{x.resolvedOn && <div>Resolved {x.resolvedOn}: {x.resolution}</div>}</TableCell>
            <TableCell>
              {x.resolvedOn ? userName(x.ownerId) : (
                <Pick id={`own-${x.id}`} value={x.ownerId ?? ""} placeholder="Assign" onChange={(v) => report(traceOps.assign(x.id, v), `Assigned to ${userName(v)}`)} options={OWNERS.map((u) => ({ value: u.id, label: u.name }))} />
              )}
            </TableCell>
            <TableCell>
              {!x.resolvedOn &&
                (x.kind === "Unresolved correction" ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/traceability/explorer?q=${x.object}`}>Correction pair</Link>
                  </Button>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {x.kind === "Orphan event" && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/traceability/explorer?q=${x.object}`}>Correction pair</Link>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onResolve(x)}>{x.kind === "Orphan event" ? "Record missing receipt" : "Resolve"}</Button>
                  </span>
                ))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
