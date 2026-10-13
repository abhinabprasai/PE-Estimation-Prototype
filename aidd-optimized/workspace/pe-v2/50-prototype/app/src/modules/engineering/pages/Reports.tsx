// FX-ENG-REPORTS Engineering reports (Dashboard, design value) [DOC:p.67 §7]. The five reports the PRD
// names: Design Reuse, Change Cycle Time, Placeholder Aging, Drawing Approval Status, Where-Used Explosion.
// Everything the seeded records can answer is computed live from the store; what they cannot (design hours,
// change history before the seed) is a labelled design value (data/extra.ts). Each report exports to CSV.

import { useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chip, DataTable, EmptyState, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DashboardCard, DashboardPage, PageHeader } from "@/components/templates"
import { TODAY } from "@/data/shared"
import { daysBetween } from "@/lib/format"
import { useSlice } from "@/store"
import { NoPostings, RefLink } from "../components"
import { ScreenFrame, StatePreviewAll, useStates, type States } from "../states"
import { engineeringItems, itemInfo, userName, whereUsedExplosion, type WhereUsedNode } from "../data/logic"
import { CHANGE_HISTORY, DESIGN_HOURS, percentile, quarterOf } from "../data/extra"
import type { EngineeringState } from "../data/slice"
import type { DesignType } from "../data/types"

type Csv = { name: string; head: string[]; rows: (string | number)[][] }
function downloadCsv({ name, head, rows }: Csv) {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const url = URL.createObjectURL(new Blob([[head, ...rows].map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`${name}.csv exported`)
}

/** A horizontal bar in a table cell; the number is always printed beside it (colour never carries it alone). */
const Bar = ({ value, max }: { value: number; max: number }) => (
  <span className="inline-flex items-center gap-2">
    <span className="inline-block h-2 w-24 rounded-full bg-muted" aria-hidden="true"><span className="block h-2 rounded-full bg-primary" style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }} /></span>
    <span className="tabular">{value}</span>
  </span>
)

// ------------------------------------------------------------------ report models
interface ReportDef { id: string; title: string; blurb: string; content: string; chip?: string }
const REPORTS: ReportDef[] = [
  { id: "design-reuse", title: "Design Reuse", blurb: "New designs vs variants vs repeats per quarter; average design hours by type", content: "Counts engineering requests by design type and the quarter they were opened. Average design hours are design values (the store records no hours)." },
  { id: "change-cycle", title: "Change Cycle Time", blurb: "ECR to ECO to released duration percentiles; emergency change count", content: "Calendar days from the ECR being raised to its ECO being released, with P50, P75 and P90, and the emergency count." },
  { id: "placeholder-aging", title: "Placeholder Aging", blurb: "Draft placeholder parts by age and owning engineer", content: "Draft placeholders on EBOMs by age. Older than 14 days is the PRD's aging threshold; each blocks its EBOM's release (V-ENG-03)." },
  { id: "drawing-approval", title: "Drawing Approval Status", blurb: "Transmittals awaiting customer response with age; approval loop counts per order", content: "For Approval transmittals with no response yet, oldest first, and the number of review loops on each order's engineering request." },
  { id: "where-used", title: "Where-Used Explosion", blurb: "Full multi-level where-used for any item (audit and obsolescence tool)", content: "Every EBOM, MBOM and sales kit that holds an item, and where each parent is used in turn, to any depth." },
]

export function ReportsHome() {
  const s = useSlice("engineering")
  const st = useStates("FX-ENG-REPORTS")
  const nav = useNavigate()
  const drafts = s.placeholders.filter((p) => p.status === "Draft")
  const aging = drafts.filter((p) => daysBetween(p.createdOn, TODAY) > 14)
  const awaiting = s.transmittals.filter((t) => t.purpose === "For Approval" && t.sentOn && !t.responses.length)
  const cycles = cycleRows(s).map((r) => r.days)
  return (
    <ScreenFrame st={st} what="Engineering reports" who="Engineers, the Engineering Manager, production, purchasing and quality" source="DOC:p.67 §7" handleLoading={false}
      text={{ readonly: "Reports are read-only for every role.", degraded: "Reports are computed from the last refresh; records changed in the last few minutes may be missing." }}>
      <DashboardPage
        header={{
          title: "Engineering reports",
          screenId: "FX-ENG-REPORTS",
          crumbs: [{ label: "Engineering reports" }],
          description: "The five reports the PRD names for engineering. Open one to see the table, filter and export it.",
          actions: <StatePreviewAll st={st} />,
          primary: <Button onClick={() => nav("/engineering/reports/change-cycle")}>Open Change Cycle Time</Button>,
        }}
        tiles={st.empty ? [] : [
          { label: "Change cycle P50 (days)", value: percentile(cycles, 50), hint: `${cycles.length} released changes` },
          { label: "Draft placeholders", value: drafts.length, hint: `${aging.length} older than 14 days`, tone: aging.length ? "attention" : "default", to: "/engineering/reports/placeholder-aging" },
          { label: "Awaiting customer response", value: awaiting.length, hint: "For Approval transmittals", to: "/engineering/reports/drawing-approval" },
          { label: "Engineering requests", value: s.requests.length, hint: "all design types", to: "/engineering/reports/design-reuse" },
        ]}
      >
        {st.loading ? <p aria-busy="true">Loading reports…</p> : st.empty ? <EmptyState title="No data to report on">Reports fill in as requests, changes and transmittals are recorded.</EmptyState> : (
          <div className="grid gap-4 md:grid-cols-2">
            {REPORTS.map((r) => (
              <DashboardCard key={r.id} title={r.title} action={<Button variant="outline" size="sm" asChild><Link to={`/engineering/reports/${r.id}`}>Open</Link></Button>}>
                <p className="text-sm">{r.blurb}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.content}</p>
              </DashboardCard>
            ))}
          </div>
        )}
      </DashboardPage>
      <NoPostings />
    </ScreenFrame>
  )
}

export function ReportDetail() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useStates("FX-ENG-REPORTS")
  const def = REPORTS.find((r) => r.id === id)
  return (
    <ScreenFrame st={st} what={def?.title ?? "Report"} who="Engineers, the Engineering Manager, production, purchasing and quality" source="DOC:p.67 §7" handleLoading={false}
      text={{ readonly: "Reports are read-only for every role.", degraded: "Computed from the last refresh; the newest records may be missing." }}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={def?.title ?? "Report not found"}
          screenId="FX-ENG-REPORTS"
          crumbs={[{ label: "Engineering reports", to: "/engineering/reports" }, { label: def?.title ?? id }]}
          description={def?.blurb}
          actions={<StatePreviewAll st={st} />}
        />
        {!def ? <EmptyState title="No such report">The five reports are listed on <Link className="text-link underline" to="/engineering/reports">Engineering reports</Link>.</EmptyState>
          : id === "design-reuse" ? <DesignReuse s={s} st={st} />
          : id === "change-cycle" ? <ChangeCycle s={s} st={st} />
          : id === "placeholder-aging" ? <PlaceholderAging s={s} st={st} />
          : id === "drawing-approval" ? <DrawingApproval s={s} st={st} />
          : <WhereUsedReport s={s} st={st} />}
        <p className="text-xs text-muted-foreground">{def?.content}</p>
        <NoPostings />
        <RulesPanel rules={[["Engineering reports", "Design Reuse, Change Cycle Time, Placeholder Aging, Drawing Approval Status, Where-Used Explosion", "DOC:p.67 §7"]]} />
      </div>
    </ScreenFrame>
  )
}

function Frame({ st, csv, children, empty }: { st: States; csv: Csv; children: ReactNode; empty: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end"><Button variant="outline" size="sm" disabled={st.offline || empty} onClick={() => downloadCsv(csv)}><Download aria-hidden="true" />Export CSV</Button></div>
      {empty ? <EmptyState title="Nothing to report">No records match this report yet.</EmptyState> : children}
    </div>
  )
}

// ------------------------------------------------------------------ 1. design reuse
function DesignReuse({ s, st }: { s: EngineeringState; st: States }) {
  const types: DesignType[] = ["New Design", "Variant of Existing", "Repeat"]
  const rows = useMemo(() => {
    const m = new Map<string, Record<DesignType, number>>()
    for (const r of st.empty ? [] : s.requests) {
      const q = quarterOf(r.createdOn)
      const cur = m.get(q) ?? { "New Design": 0, "Variant of Existing": 0, Repeat: 0 }
      cur[r.designType]++
      m.set(q, cur)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([quarter, c]) => ({ quarter, ...c, total: c["New Design"] + c["Variant of Existing"] + c.Repeat }))
  }, [s.requests, st.empty])
  const max = Math.max(1, ...rows.map((r) => r.total))
  const reuse = rows.reduce((a, r) => a + r["Variant of Existing"] + r.Repeat, 0)
  const all = rows.reduce((a, r) => a + r.total, 0)
  type R = (typeof rows)[number]
  const cols: Column<R>[] = [
    { id: "q", header: "Quarter", value: (r) => r.quarter, sortable: true, mono: true },
    { id: "n", header: "New Design", value: (r) => r["New Design"], align: "right", cell: (r) => <Bar value={r["New Design"]} max={max} /> },
    { id: "v", header: "Variant of Existing", value: (r) => r["Variant of Existing"], align: "right", cell: (r) => <Bar value={r["Variant of Existing"]} max={max} /> },
    { id: "r", header: "Repeat", value: (r) => r.Repeat, align: "right", cell: (r) => <Bar value={r.Repeat} max={max} /> },
    { id: "t", header: "Total", value: (r) => r.total, align: "right", mono: true },
  ]
  return (
    <Frame st={st} empty={!rows.length} csv={{ name: "design-reuse", head: ["Quarter", ...types, "Total"], rows: rows.map((r) => [r.quarter, r["New Design"], r["Variant of Existing"], r.Repeat, r.total]) }}>
      <p className="text-sm" aria-live="polite"><span className="font-medium">{all ? Math.round((reuse / all) * 100) : 0}% reuse</span> ({reuse} of {all} requests are a variant or a repeat).</p>
      <DataTable<R> rows={rows} columns={cols} rowId={(r) => r.quarter} densityKey="FX-ENG-REPORTS-reuse" loading={st.loading} error={st.error} onRetry={st.retry} initialSort={{ id: "q", dir: "asc" }} />
      <div className="overflow-x-auto rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-semibold">Average design hours by type <Chip kind="design" note="The store records no hours; the PRD asks for the average. These are design values per type (data/extra.ts)">Design value</Chip></h3>
        <ul className="flex flex-col gap-1 text-sm">{types.map((t) => <li key={t}><span className="inline-block w-48">{t}</span><Bar value={DESIGN_HOURS[t]} max={Math.max(...Object.values(DESIGN_HOURS))} /> h</li>)}</ul>
      </div>
    </Frame>
  )
}

// ------------------------------------------------------------------ 2. change cycle time
interface CycleRow { ecr: string; eco: string; raisedOn: string; releasedOn: string; days: number; emergency: boolean; classification: string; seeded: boolean }
function cycleRows(s: EngineeringState): CycleRow[] {
  const live: CycleRow[] = s.ecos.flatMap((eco) => {
    if (!eco.releasedOn) return []
    return (s.ecrs.filter((e) => e.ecoId === eco.id)).map((e) => ({ ecr: e.id, eco: eco.id, raisedOn: e.raisedOn, releasedOn: eco.releasedOn!, days: daysBetween(e.raisedOn, eco.releasedOn!), emergency: e.priority === "Emergency" || e.emergency, classification: e.classification, seeded: false }))
  })
  const hist: CycleRow[] = CHANGE_HISTORY.map((h) => ({ ...h, days: daysBetween(h.raisedOn, h.releasedOn), seeded: true }))
  return [...hist, ...live.filter((l) => !hist.some((h) => h.ecr === l.ecr))]
}
function ChangeCycle({ s, st }: { s: EngineeringState; st: States }) {
  const rows = st.empty ? [] : cycleRows(s)
  const days = rows.map((r) => r.days)
  const emergencies = rows.filter((r) => r.emergency)
  const std = rows.filter((r) => !r.emergency).map((r) => r.days)
  const cols: Column<CycleRow>[] = [
    { id: "ecr", header: "ECR", value: (r) => r.ecr, mono: true, sortable: true },
    { id: "eco", header: "ECO", value: (r) => r.eco, mono: true },
    { id: "cls", header: "Classification", value: (r) => r.classification, filterable: true },
    { id: "raised", header: "ECR raised", value: (r) => r.raisedOn, mono: true, sortable: true },
    { id: "rel", header: "ECO released", value: (r) => r.releasedOn, mono: true, sortable: true },
    { id: "days", header: "Days", value: (r) => r.days, align: "right", mono: true, sortable: true },
    { id: "em", header: "Emergency", value: (r) => (r.emergency ? "Emergency" : "Standard"), filterable: true },
    { id: "src", header: "Source", value: (r) => (r.seeded ? "History" : "Live"), cell: (r) => (r.seeded ? <Chip kind="design" note="Released before the prototype's seed started: a design value so the percentiles have a population">History</Chip> : "Live record") },
  ]
  return (
    <Frame st={st} empty={!rows.length} csv={{ name: "change-cycle-time", head: ["ECR", "ECO", "Classification", "Raised", "Released", "Days", "Emergency"], rows: rows.map((r) => [r.ecr, r.eco, r.classification, r.raisedOn, r.releasedOn, r.days, r.emergency ? "Emergency" : "Standard"]) }}>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {([["P50", percentile(days, 50)], ["P75", percentile(days, 75)], ["P90", percentile(days, 90)], ["Standard P50", percentile(std, 50)], ["Emergency changes", emergencies.length]] as [string, number][]).map(([k, v]) => (
          <div key={k} className="rounded-lg border p-4"><dt className="text-sm text-muted-foreground">{k}{k !== "Emergency changes" && " (days)"}</dt><dd className="tabular text-2xl font-semibold">{v}</dd></div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">Nearest-rank percentiles over {rows.length} released changes. Emergency ECRs are due to the CCB within 24 hours (ENG-ECR); that SLA is on the ECR, not in this duration.</p>
      <DataTable<CycleRow> rows={rows} columns={cols} rowId={(r) => r.ecr} densityKey="FX-ENG-REPORTS-cycle" loading={st.loading} error={st.error} onRetry={st.retry} initialSort={{ id: "days", dir: "desc" }} />
    </Frame>
  )
}

// ------------------------------------------------------------------ 3. placeholder aging
function PlaceholderAging({ s, st }: { s: EngineeringState; st: States }) {
  type R = { id: string; description: string; engineer: string; ebom: string; line: number; age: number; created: string; cad: boolean }
  const rows: R[] = st.empty ? [] : s.placeholders.filter((p) => p.status === "Draft").map((p) => ({ id: p.id, description: p.description, engineer: userName(p.engineerId), ebom: p.ebomId, line: p.line, age: daysBetween(p.createdOn, TODAY), created: p.createdOn, cad: !!p.fromCad }))
  const bucket = (a: number) => (a <= 7 ? "0-7 days" : a <= 14 ? "8-14 days" : "Over 14 days")
  const byEng = [...new Set(rows.map((r) => r.engineer))].map((e) => ({ e, n: rows.filter((r) => r.engineer === e).length }))
  const cols: Column<R>[] = [
    { id: "id", header: "Placeholder", value: (r) => r.id, mono: true, sortable: true },
    { id: "d", header: "Description", value: (r) => r.description, cell: (r) => <span className="inline-flex flex-wrap items-center gap-1">{r.description}{r.cad && <Chip kind="design" note="Raised by the CAD connector new-part flow (IF-17)">From CAD</Chip>}</span> },
    { id: "e", header: "Owning engineer", value: (r) => r.engineer, filterable: true },
    { id: "b", header: "EBOM / line", value: (r) => `${r.ebom} / ${r.line}`, cell: (r) => <RefLink r={{ type: "ebom", id: r.ebom }}>{`${r.ebom} / ${r.line}`}</RefLink> },
    { id: "age", header: "Age (days)", value: (r) => r.age, align: "right", mono: true, sortable: true },
    { id: "bk", header: "Age band", value: (r) => bucket(r.age), filterable: true, cell: (r) => <span className="inline-flex items-center gap-1">{bucket(r.age)}{r.age > 14 && <Chip kind="flag" note="Older than the PRD's 14-day aging threshold [DOC:p.58 §1]">Aging</Chip>}</span> },
    { id: "c", header: "Created", value: (r) => r.created, mono: true, sortable: true },
  ]
  return (
    <Frame st={st} empty={!rows.length} csv={{ name: "placeholder-aging", head: ["Placeholder", "Description", "Engineer", "EBOM", "Line", "Age days", "Created"], rows: rows.map((r) => [r.id, r.description, r.engineer, r.ebom, r.line, r.age, r.created]) }}>
      <p className="text-sm" aria-live="polite">{rows.length} Draft placeholder{rows.length === 1 ? "" : "s"}; {rows.filter((r) => r.age > 14).length} older than 14 days. By engineer: {byEng.map((x) => `${x.e} ${x.n}`).join(", ") || "none"}.</p>
      <DataTable<R> rows={rows} columns={cols} rowId={(r) => r.id} rowHref={(r) => `/engineering/boms/${r.ebom}`} densityKey="FX-ENG-REPORTS-ph" loading={st.loading} error={st.error} onRetry={st.retry} initialSort={{ id: "age", dir: "desc" }} />
    </Frame>
  )
}

// ------------------------------------------------------------------ 4. drawing approval status
function DrawingApproval({ s, st }: { s: EngineeringState; st: States }) {
  type R = { id: string; soId: string; er?: string; customer: string; sent: string; age: number; docs: number; loops: number }
  const rows: R[] = st.empty ? [] : s.transmittals.filter((t) => t.purpose === "For Approval" && t.sentOn && !t.responses.length).map((t) => ({
    id: t.id, soId: t.soId ?? "", er: t.engineeringRequestId, customer: t.recipients[0] ?? "", sent: t.sentOn!, age: daysBetween(t.sentOn!, TODAY), docs: t.documentIds.length,
    loops: s.requests.find((r) => r.id === t.engineeringRequestId)?.reviewLoops ?? 0,
  }))
  const loops = (st.empty ? [] : s.requests.filter((r) => r.customerApprovalRequired)).map((r) => ({ soId: r.soId, er: r.id, loops: r.reviewLoops, resub: s.transmittals.filter((t) => t.engineeringRequestId === r.id && t.responses.some((x) => x.response === "Revise & Resubmit")).length }))
  const cols: Column<R>[] = [
    { id: "id", header: "Transmittal", value: (r) => r.id, mono: true, sortable: true },
    { id: "so", header: "Order", value: (r) => r.soId, mono: true },
    { id: "to", header: "Sent to", value: (r) => r.customer },
    { id: "sent", header: "Sent", value: (r) => r.sent, mono: true, sortable: true },
    { id: "age", header: "Age (days)", value: (r) => r.age, align: "right", mono: true, sortable: true, cell: (r) => <span className="inline-flex items-center gap-1 tabular">{r.age}{r.age > 14 && <Chip kind="flag" note="Waiting more than 14 days (design value: the PRD gives no chase threshold)">Chase</Chip>}</span> },
    { id: "docs", header: "Drawings", value: (r) => r.docs, align: "right", mono: true },
    { id: "loops", header: "Review loops on the request", value: (r) => r.loops, align: "right", mono: true },
  ]
  return (
    <Frame st={st} empty={!rows.length && !loops.length} csv={{ name: "drawing-approval-status", head: ["Transmittal", "Order", "Sent to", "Sent", "Age days", "Drawings", "Loops"], rows: rows.map((r) => [r.id, r.soId, r.customer, r.sent, r.age, r.docs, r.loops]) }}>
      <h3 className="text-sm font-semibold">Awaiting customer response ({rows.length})</h3>
      <DataTable<R> rows={rows} columns={cols} rowId={(r) => r.id} rowHref={(r) => `/engineering/transmittals/${r.id}`} densityKey="FX-ENG-REPORTS-da" loading={st.loading} error={st.error} onRetry={st.retry} initialSort={{ id: "age", dir: "desc" }} empty={{ title: "No transmittal is waiting", body: "Every For Approval transmittal has a customer response." }} />
      <h3 className="text-sm font-semibold">Approval loops per order</h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left"><tr><th className="px-3 py-2">Order</th><th className="px-3 py-2">Engineering request</th><th className="px-3 py-2 text-right">Review loops</th><th className="px-3 py-2 text-right">Revise &amp; Resubmit responses</th></tr></thead>
          <tbody>{loops.map((l) => <tr key={l.er} className="border-t"><td className="px-3 py-1 font-mono">{l.soId}</td><td className="px-3 py-1"><RefLink r={{ type: "engineeringRequest", id: l.er }} /></td><td className="px-3 py-1 text-right tabular">{l.loops}</td><td className="px-3 py-1 text-right tabular">{l.resub}</td></tr>)}</tbody>
        </table>
      </div>
    </Frame>
  )
}

// ------------------------------------------------------------------ 5. where-used explosion
function WhereUsedReport({ s, st }: { s: EngineeringState; st: States }) {
  const [item, setItem] = useState("RAW-TBD-BSH145")
  const [draft, setDraft] = useState(item)
  const known = engineeringItems(s).some((i) => i.id === item)
  const rows = st.empty ? [] : whereUsedExplosion(s, item, 8)
  const cols: Column<WhereUsedNode>[] = [
    { id: "lvl", header: "Level", value: (n) => n.level, align: "right", mono: true, sortable: true, filterable: true },
    { id: "kind", header: "Kind", value: (n) => n.kind, filterable: true },
    { id: "rec", header: "Record", value: (n) => n.recordId, mono: true, sortable: true },
    { id: "rev", header: "Rev", value: (n) => n.rev, mono: true },
    { id: "st", header: "Status", value: (n) => n.status, filterable: true, cell: (n) => <StatusBadge kind={n.kind === "MBOM" ? "mbom" : "ebom"} status={n.status} size="sm" /> },
    { id: "par", header: "Parent item", value: (n) => n.parentItemId, mono: true },
    { id: "q", header: "Qty per", value: (n) => n.qty, align: "right", mono: true, cell: (n) => `${n.qty} ${n.uom}` },
    { id: "path", header: "Path to the top", value: (n) => n.path.join(" > ") },
  ]
  return (
    <Frame st={st} empty={false} csv={{ name: `where-used-${item}`, head: ["Level", "Kind", "Record", "Rev", "Status", "Parent item", "Qty", "UoM", "Path"], rows: rows.map((n) => [n.level, n.kind, n.recordId, n.rev, n.status, n.parentItemId, n.qty, n.uom, n.path.join(" > ")]) }}>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setItem(draft.trim().toUpperCase()) }}>
        <div className="flex flex-col gap-1"><Label htmlFor="wu-item">Item</Label><Input id="wu-item" className="w-64 font-mono" value={draft} onChange={(e) => setDraft(e.target.value)} /></div>
        <Button type="submit" variant="outline">Run explosion</Button>
        <Button variant="ghost" asChild><Link to={`/engineering/where-used?item=${item}`}>Open in the explorer</Link></Button>
      </form>
      <p className="text-sm" aria-live="polite">{known ? <>{item}: {itemInfo(s, item).description}. </> : <span className="text-destructive">{item} is not on any EBOM. </span>}{rows.length} record{rows.length === 1 ? "" : "s"}, deepest level {rows.reduce((m, n) => Math.max(m, n.level), 0)}.</p>
      <DataTable<WhereUsedNode> rows={rows} columns={cols} rowId={(n) => `${n.kind}:${n.recordId}:${n.line}:${n.level}`} densityKey="FX-ENG-REPORTS-wu" loading={st.loading} error={st.error} onRetry={st.retry} initialSort={{ id: "lvl", dir: "asc" }} empty={{ title: "Not used anywhere", body: "No EBOM, MBOM or sales kit holds this item." }} />
    </Frame>
  )
}
