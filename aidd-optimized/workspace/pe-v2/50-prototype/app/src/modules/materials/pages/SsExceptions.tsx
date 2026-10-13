// FX-MM-SSEXC: Safety-stock exception report (SS-EX-01) and projection delta [Book I Part A §10.4].
// The report lists rows that are over-buffered (above max, dead buffer, never breached in 12 months,
// above the shelf-life cap) or under-buffered (breached three or more times in 90 days). Opening a
// row shows the 12-week projected available balance against the safety stock line; a proposed value
// is compared with the current one (weeks below the line, carrying value) before it is sent as a
// change. Above 25% the change waits for the Planning Manager.

import { useMemo, useState } from "react"
import { Link } from "react-router"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { WorkbenchPage } from "@/components/templates"
import { ApprovalButton, Chip, FamilyBadge, KV, RulesPanel, type Column } from "@/components/patterns"
import { fmtMoney, fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { SS_APPROVAL_PCT, available, ssBase, ssDeltaPct, ssEffective } from "../lib/rules"
import { crossings, projection, ssExceptionKinds, type SsExceptionKind } from "../lib/ext-rules"
import { getMaterial, rateOf } from "../data/state"
import { changeSs, withdrawSsChange } from "../data/actions"
import type { SafetyStockRow, SsReason } from "../data/types"
import { MatLink, Reading, Section } from "../components/common"
import { useViewState } from "../components/states"
import { run } from "../components/run"

const REASONS: SsReason[] = ["Demand Change", "Lead Time Change", "Service Level Change", "New Item", "Annual Review"]
const QUEUES: { id: string; label: string; test: (k: SsExceptionKind[]) => boolean }[] = [
  { id: "all", label: "All exceptions", test: (k) => k.length > 0 },
  { id: "over", label: "Over-buffered", test: (k) => k.some((x) => x !== "Breached 3 or more times in 90 days") },
  { id: "under", label: "Under-buffered", test: (k) => k.includes("Breached 3 or more times in 90 days") },
]
const cfg = { level: { label: "Projected available", color: "var(--chart-1)" } } satisfies ChartConfig

function weeksBelow(r: SafetyStockRow, ss: number) {
  const pts = projection(r)
  return { pts, below: pts.filter((p) => p.level < ss).length, first: crossings(pts, ss)[0] }
}

export function SsExceptions() {
  const s = useSlice("materials")
  const [role] = useRole()
  const st = useViewState("FX-MM-SSEXC", { degradedWhat: "The demand history feed is slow", authorizedRoles: ["Planner", "Warehouse supervisor"] })
  const [queue, setQueue] = useState("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [proposed, setProposed] = useState("")
  const [reason, setReason] = useState<SsReason>("Annual Review")
  const all = st.empty ? [] : s.safetyStock.map((r) => ({ r, kinds: ssExceptionKinds(r) })).filter((x) => x.kinds.length)
  const q = QUEUES.find((x) => x.id === queue)!
  const rows = all.filter((x) => q.test(x.kinds))
  const row = s.safetyStock.find((r) => r.id === openId)
  const cur = row ? ssEffective(row) : 0
  const prop = proposed === "" ? undefined : Number(proposed)
  const valid = prop != null && Number.isFinite(prop) && prop >= 0
  const before = row ? weeksBelow(row, cur) : undefined
  const after = row && valid ? weeksBelow(row, prop! * (cur / (ssBase(row) || 1))) : undefined
  const pct = row && valid ? ssDeltaPct(ssBase(row), row.multipliers, prop!, row.multipliers) : 0
  const rate = row ? rateOf(s, row.materialId) : 0
  const data = useMemo(() => (before ? before.pts.map((p) => ({ week: `W${p.week}`, date: p.date, level: p.level })) : []), [before])
  const cols: Column<{ r: SafetyStockRow; kinds: SsExceptionKind[] }>[] = [
    { id: "mat", header: "Material", value: (x) => x.r.materialId, sortable: true, cell: (x) => <MatLink id={x.r.materialId} /> },
    { id: "wh", header: "Warehouse", value: (x) => x.r.warehouseId, mono: true, filterable: true },
    { id: "ss", header: "Safety stock", value: (x) => ssEffective(x.r), align: "right", mono: true, sortable: true, cell: (x) => `${fmtNumber(ssEffective(x.r))} ${x.r.uom}` },
    { id: "max", header: "Max stock", value: (x) => x.r.maxStock, align: "right", mono: true, cell: (x) => fmtNumber(x.r.maxStock) },
    { id: "adu", header: "ADU", value: (x) => x.r.adu, align: "right", mono: true },
    { id: "b12", header: "Breaches 12 m", value: (x) => x.r.breaches12m, align: "right", mono: true },
    { id: "b90", header: "Breaches 90 d", value: (x) => x.r.breaches90, align: "right", mono: true },
    { id: "ex", header: "Exception (SS-EX-01)", value: (x) => x.kinds.join("; "), cell: (x) => <span className="flex flex-wrap gap-1">{x.kinds.map((k) => <Chip key={k} kind="flag">{k}</Chip>)}</span> },
    { id: "pend", header: "Change", value: (x) => (x.r.pending ? x.r.pending.changeId : ""), cell: (x) => (x.r.pending ? <Chip kind="change">{x.r.pending.changeId}</Chip> : "") },
  ]
  return (
    <>
      <WorkbenchPage
        header={{
          screenId: "FX-MM-SSEXC",
          title: "Safety-stock exception report",
          description: "SS-EX-01: buffers that look too big or too small against the last year. Open a row to see the 12-week projection and what a different safety stock would change.",
          chips: <Reading id="RD-MM-22" />,
          actions: <Button variant="outline" asChild><Link to="/inventory/planning/safety-stock">Safety stock maintenance</Link></Button>,
        }}
        kpis={[
          { label: "Rows in exception", value: all.length, hint: `of ${s.safetyStock.length} rows` },
          { label: "Over-buffered", value: all.filter((x) => QUEUES[1].test(x.kinds)).length },
          { label: "Under-buffered", value: all.filter((x) => QUEUES[2].test(x.kinds)).length, hint: "3+ breaches in 90 days" },
          { label: "Changes waiting", value: s.safetyStock.filter((r) => r.pending).length },
        ]}
        queues={QUEUES.map((x) => ({ id: x.id, label: x.label, count: all.filter((y) => x.test(y.kinds)).length }))}
        queue={queue}
        onQueueChange={setQueue}
        table={{
          rows,
          columns: cols,
          rowId: (x) => x.r.id,
          onRowClick: (x) => (setOpenId(x.r.id), setProposed("")),
          activeId: openId ?? undefined,
          searchText: (x) => `${x.r.materialId} ${x.r.warehouseId} ${x.kinds.join(" ")}`,
          searchPlaceholder: "Search material, warehouse, exception",
          loading: st.loading,
          error: st.error,
          onRetry: st.onRetry,
          toolbar: st.toolbar,
          densityKey: "FX-MM-SSEXC",
          empty: { title: "No safety-stock exception", body: "Every buffer is within max stock, has demand, and has been breached in the last 12 months." },
        }}
        panel={{
          open: !!row,
          onOpenChange: (o) => !o && setOpenId(null),
          title: row ? `${row.materialId} at ${row.warehouseId}` : "Safety stock",
          description: row ? `Safety stock ${cur} ${row.uom} · max ${row.maxStock} · ADU ${row.adu} · lead time ${row.ltDays} d` : undefined,
          content:
            row && before && (
              <div className="flex flex-col gap-4 p-4">
                {st.banners}
                <dl className="grid grid-cols-2 gap-3">
                  <KV k="Available now">{fmtNumber(available(row))} {row.uom}</KV>
                  <KV k="On order">{fmtNumber(row.onOrder)} {row.uom}</KV>
                  <KV k="Exceptions">{ssExceptionKinds(row).join("; ")}</KV>
                  <KV k="Weeks below safety stock (12)">{before.below}</KV>
                </dl>
                <Section title="12-week projected available balance">
                  <ChartContainer config={cfg} className="h-56 w-full">
                    <LineChart data={data}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={52} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ReferenceLine y={cur} strokeDasharray="4 4" stroke="var(--chart-5)" label={{ value: `SS ${cur}`, position: "insideTopRight", fontSize: 11 }} />
                      {after && <ReferenceLine y={prop! * (cur / (ssBase(row) || 1))} strokeDasharray="2 2" stroke="var(--chart-3)" label={{ value: `Proposed ${prop}`, position: "insideBottomRight", fontSize: 11 }} />}
                      <Line isAnimationActive={false} dataKey="level" stroke="var(--color-level)" strokeWidth={2} dot />
                    </LineChart>
                  </ChartContainer>
                  <p className="text-xs text-muted-foreground">Available now, less ADU x 7 each week, plus the open order at its lead time. A design projection, not an MRP run.</p>
                  {before.first && <p className="text-sm">First dips below safety stock in the week of {before.first.date}.</p>}
                </Section>
                {row.pending ? (
                  <Section title={`Change ${row.pending.changeId} is waiting`}>
                    <p className="text-sm">Proposed {row.pending.newSs ?? "reset"}; delta {row.pending.pct.toFixed(1)}%. Reason: {row.pending.reason}.</p>
                    <div className="flex flex-wrap gap-2">
                      <ApprovalButton kind="Safety stock change" subject={{ type: "material", id: row.pending.changeId }} title={`${row.pending.changeId}: ${row.materialId} ${row.warehouseId} safety stock change, delta ${row.pending.pct.toFixed(1)}%`} variant="default" stay />
                      <Button variant="ghost" onClick={() => run(withdrawSsChange(row.id), "Change withdrawn")}>Withdraw change</Button>
                    </div>
                  </Section>
                ) : (
                  <Section title="Projection delta: try a different safety stock">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="ssx-new">New safety stock ({row.uom})</Label>
                        <Input id="ssx-new" type="number" min={0} value={proposed} onChange={(e) => setProposed(e.target.value)} className="h-8 w-32" aria-invalid={(proposed !== "" && !valid) || (st.validation && proposed === "") ? true : undefined} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="ssx-reason">Reason code</Label>
                        <Select value={reason} onValueChange={(v) => setReason(v as SsReason)}>
                          <SelectTrigger id="ssx-reason" size="sm" className="h-8 w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>{REASONS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    {((proposed !== "" && !valid) || (st.validation && proposed === "")) && <p className="text-xs text-destructive">Enter a quantity of zero or more.</p>}
                    {after && (
                      <dl className="grid grid-cols-2 gap-3 rounded-md border p-3">
                        <KV k="Weeks below the line">{before.below} to {after.below}</KV>
                        <KV k="Change">{pct.toFixed(1)}% {pct > SS_APPROVAL_PCT ? <FamilyBadge family="pending" label="Needs Planning Manager" size="sm" /> : <span className="text-muted-foreground">applies directly</span>}</KV>
                        <KV k="Carrying value of safety stock">{fmtMoney(cur * rate)} to {fmtMoney(prop! * (cur / (ssBase(row) || 1)) * rate)}</KV>
                        <KV k="Rate used">{fmtMoney(rate)} per {row.uom} ({getMaterial(s, row.materialId)?.type})</KV>
                      </dl>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button disabled={!st.canWrite || !valid} title={st.blockedWhy} onClick={() => run(changeSs(row.id, prop!, reason, "From the exception report"), (r) => (r.pending ? `${r.changeId} waits for the Planning Manager (${r.pct.toFixed(1)}%)` : `Safety stock set to ${prop}`))}>
                        Propose change
                      </Button>
                      <span className="text-xs text-muted-foreground">Acting as {role}. Planner or Warehouse supervisor edits (RD-MM-12); above {SS_APPROVAL_PCT}% the Planning Manager approves.</span>
                    </div>
                  </Section>
                )}
              </div>
            ),
        }}
      />
      <RulesPanel
        rules={[
          ["SS-EX-01", "Exception report: safety stock above max stock, with zero ADU, never breached in 12 months, or above the shelf-life cap (over-buffered); breached three or more times in 90 days (under-buffered).", "[Book I A §10.4]"],
          ["§10.1", "A safety-stock change above 25% delta routes to the Planning Manager; every change carries a reason code.", "[Book I A §10.1]"],
          ["W-SS-02", "For shelf-life materials the safety stock may not exceed shelf life / 2 x ADU.", "[Book I A §10.4]"],
        ]}
      />
    </>
  )
}
