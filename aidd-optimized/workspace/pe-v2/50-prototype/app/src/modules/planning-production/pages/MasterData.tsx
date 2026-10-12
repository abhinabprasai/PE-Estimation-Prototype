// PP-WC-001/2 Work Centers [DOC:p.71 §2; p.261 Book VI] and PP-RTG-001/2 Routings [DOC:p.73 §4] (asserted).
// Work centers: capacity model, cost center link, batch resource settings, alternate; Maintain
// capacity; set Maintenance, which warns the scheduler. Routings: operation grid with times, QC
// checkpoint toggles, work-instruction links, component mapping; author, release through the review
// lifecycle (Draft → In Review → Released → Superseded), change through ECO.

import { useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import type { ISODate, WorkCenterId, WorkCenterStatus } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { ActivityList, BodyState, Item, LoadBar, StatePreview, WoLink, qty, useAct, useActDialog, useScreenState } from "../components"
import * as act from "../lib/actions"
import { allWorkCenters, dailyCapacity, freezeDaysOf, schedule, weekLabel, weeklyBuckets, type EffectiveWc } from "../lib/plan"
import type { PPRouting, WcOverride } from "../data/types"

const capPerDay = (w: EffectiveWc) => (w.shifts * w.hoursPerShift * w.stations * w.efficiencyPct) / 100

// ============================================================================ PP-WC-001
export function WorkCenterList() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-WC-001")
  const rows = st.empty ? [] : allWorkCenters(s)
  const cols: Column<EffectiveWc>[] = [
    { id: "id", header: "Work center", value: (w) => w.id, mono: true, sortable: true },
    { id: "name", header: "Name", value: (w) => w.name, cell: (w) => <span className="flex flex-col"><span>{w.name}</span><span className="text-xs text-muted-foreground">{w.function}</span></span> },
    { id: "cc", header: "Cost center", value: (w) => w.costCenterId, mono: true, filterable: true },
    { id: "cap", header: "Capacity h/day", value: (w) => capPerDay(w), align: "right", mono: true, sortable: true, cell: (w) => qty(capPerDay(w)) },
    { id: "shifts", header: "Shifts", value: (w) => `${w.shifts} × ${w.hoursPerShift} h`, mono: true },
    { id: "eff", header: "Eff %", value: (w) => w.efficiencyPct, align: "right", mono: true },
    { id: "rates", header: "Labor / OH rate", value: (w) => w.laborRate, align: "right", cell: (w) => <span className="tabular">{fmtMoney(w.laborRate)} / {fmtMoney(w.overheadRate)}</span> },
    { id: "batch", header: "Batch resource", value: (w) => (w.batchResource ? "Yes" : "No"), filterable: true, cell: (w) => (w.batchResource ? `${w.cycleSize ?? 1} / cycle, ${w.cycleHours ?? "?"} h` : "") },
    { id: "alt", header: "Alternate", value: (w) => w.alternate?.wcId ?? "", mono: true, cell: (w) => (w.alternate ? `${w.alternate.wcId} @ ${w.alternate.efficiencyPct}%` : "") },
    { id: "status", header: "Status", value: (w) => w.status, filterable: true, sortable: true, cell: (w) => <span className="inline-flex items-center gap-1"><StatusBadge kind="workCenter" status={w.status} size="sm" />{w.status === "Maintenance" && w.maintenanceUntil && <span className="text-xs text-muted-foreground">to {fmtDate(w.maintenanceUntil)}</span>}</span> },
  ]
  return (
    <ListPage<EffectiveWc>
      header={{
        title: "Work centers",
        screenId: "PP-WC-001/2",
        description: "Capacity and rate basis for scheduling and costing at PL-TBD-01 Fargo. Setting Maintenance blocks capacity and warns the scheduler.",
        primary: <Button asChild><Link to="/production/schedule">Schedule board</Link></Button>,
      }}
      table={{
        rows, columns: cols, rowId: (w) => w.id, rowHref: (w) => `/production/work-centers/${w.id}`, searchText: (w) => `${w.id} ${w.name} ${w.function} ${w.costCenterId}`,
        loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, empty: { title: "No work centers", body: "Work centers come from the plant master." },
      }}
    />
  )
}

const NUM_FIELDS: [keyof WcOverride, string][] = [
  ["shifts", "Shifts per day"], ["hoursPerShift", "Hours per shift"], ["stations", "Parallel stations"], ["utilizationTarget", "Utilization target %"],
  ["queueHours", "Queue time (h)"], ["moveHours", "Move time (h)"], ["crew", "Default crew"], ["freezeDays", "Freeze horizon (working days)"],
]

export function WorkCenterDetail() {
  const { id = "" } = useParams()
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-WC-002")
  const runD = useActDialog()
  const w = allWorkCenters(s).find((x) => x.id === id)
  const [edit, setEdit] = useState<Record<string, string> | null>(null)
  const [why, setWhy] = useState("")
  const [statusDlg, setStatusDlg] = useState<WorkCenterStatus | null>(null)
  const [until, setUntil] = useState<string>("")
  return (
    <BodyState state={st} found={!!w} what={`Work center ${id}`} back={{ to: "/production/work-centers", label: "Back to work centers" }}>
      {w && detail(w)}
    </BodyState>
  )
  function detail(w: EffectiveWc) {
    const r = schedule(s, {})
    const buckets = weeklyBuckets(w, r, TODAY, 8)
    const rtgs = s.routings.filter((x) => x.ops.some((o) => o.workCenterId === w.id) && x.status !== "Superseded")
    const queue = act.wcQueue(s, w.id)
    return (
      <>
        <DetailPage
          header={{
            title: `${w.id} · ${w.name}`,
            screenId: "PP-WC-001/2",
            crumbs: [{ label: "Work centers", to: "/production/work-centers" }, { label: w.id }],
            description: w.function,
            primary: <Button onClick={() => setEdit(Object.fromEntries(NUM_FIELDS.map(([k]) => [k, String(k === "freezeDays" ? freezeDaysOf(s, w.id) : (w[k] ?? ""))])))}>Maintain capacity</Button>,
            actions: (
              <>
                {w.status !== "Maintenance" && <Button variant="outline" onClick={() => setStatusDlg("Maintenance")}>Set Maintenance</Button>}
                {w.status !== "Active" && <Button variant="outline" onClick={() => setStatusDlg("Active")}>Set Active</Button>}
                {w.status !== "Inactive" && <Button variant="ghost" onClick={() => setStatusDlg("Inactive")}>Set Inactive</Button>}
                <Button variant="outline" asChild><Link to={`/production/dispatch?wc=${w.id}`}>Dispatch list</Link></Button>
              </>
            ),
          }}
          status={{ kind: "workCenter", value: w.status }}
          summary={
            <>
              <KV k="Capacity per day">{qty(capPerDay(w))} h ({w.shifts} × {w.hoursPerShift} h × {w.stations} station, {w.efficiencyPct}%)</KV>
              <KV k="Cost center">{w.costCenterId}</KV>
              <KV k="Standard rates (read-only)">{fmtMoney(w.laborRate)} labor · {fmtMoney(w.overheadRate)} overhead{w.machineRate ? ` · ${fmtMoney(w.machineRate)} machine` : ""} /h · <Link className="text-link underline" to="/costing/work-center-rates">rate screen</Link></KV>
              <KV k="Freeze horizon">{freezeDaysOf(s, w.id)} working days{w.freezeDays == null ? " (default)" : ""}</KV>
              <KV k="Alternate">{w.alternate ? `${w.alternate.wcId} at ${w.alternate.efficiencyPct}%` : "none"}</KV>
              <KV k="Batch resource">{w.batchResource ? `Yes: ${w.cycleSize ?? 1} unit(s) per ${w.cycleHours ?? "?"} h cycle` : "No"}</KV>
              <KV k="Queue / move">{w.queueHours} h / {w.moveHours} h</KV>
              <KV k="Issue warehouse">{w.issueWarehouse}</KV>
              <KV k="Maintenance">{w.status === "Maintenance" ? `to ${fmtDate(w.maintenanceUntil)}` : "none"}</KV>
            </>
          }
          tabs={[
            {
              id: "load", label: "Load (8 weeks)",
              content: (
                <div className="grid gap-2 md:grid-cols-4">
                  {buckets.map((b) => <div key={b.week} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{weekLabel(b.week)} · {fmtDate(b.week)}</p><LoadBar hours={b.hours} capacity={b.capacity} label={`${w.id} ${weekLabel(b.week)}`} /></div>)}
                  <p className="text-sm text-muted-foreground md:col-span-4">Today's capacity {qty(dailyCapacity(w, TODAY))} h. Finite plan: load never exceeds capacity; the excess moves out.</p>
                </div>
              ),
            },
            {
              id: "queue", label: "Queue", count: queue.length,
              content: (
                <ul className="flex flex-col gap-1 text-sm">
                  {queue.map(({ wo, op }) => <li key={`${wo.id}${op.no}`} className="flex gap-2"><span className="tabular w-6">{op.sequence}</span><WoLink id={wo.id} /> op {op.no} {op.text} <span className="text-muted-foreground">{op.status}</span></li>)}
                  {!queue.length && <li className="text-muted-foreground">Queue empty.</li>}
                </ul>
              ),
            },
            {
              id: "rtg", label: "Routings", count: rtgs.length,
              content: (
                <ul className="flex flex-col gap-1 text-sm">
                  {rtgs.map((x) => <li key={`${x.id}${x.rev}`}><Link className="font-mono text-link" to={`/production/routings/${x.id}?rev=${x.rev}`}>{x.id} rev {x.rev}</Link> {x.description} <StatusBadge kind="routing" status={x.status} size="sm" /></li>)}
                </ul>
              ),
            },
            { id: "hist", label: "History", content: <ActivityList items={[...w.history].reverse()} /> },
          ]}
        />
        <RulesPanel className="mt-6" rules={[
          ["§2", "Capacity model, cost center link, batch resource settings, alternate work center", "DOC:p.71 §2"],
          ["§2", "Maintenance blocks new dispatch (operations cannot start), warns the scheduler and blocks capacity in the finite plan", "DOC:p.71 §2; p.192 E §2"],
          ["§2", "Standard labor rate is read-only here and comes from the rate calculation (CST-RATE-001); standards are never edited by hand", "DOC:p.71 §2; p.179 FL-04"],
          ["E §3", "Freeze horizon per work center, default 5 working days", "DOC:p.193 Book III E §3"],
          ["Design", "Shift pattern, rate values and queue/move times are seeded design values", "design value"],
        ]} />
        <DialogShell open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={`Maintain capacity · ${w.id}`} confirmLabel="Save capacity model" wide
          consequence="Changes the capacity model and freeze horizon; the finite plan recalculates at once. Standard rates are not edited here (rate screen CST-RATE-001)."
          onConfirm={() => {
            const patch: Partial<WcOverride> = {}
            for (const [k] of NUM_FIELDS) (patch as Record<string, number>)[k] = Number(edit![k])
            return runD((d, c) => act.updateWc(d, c, w.id, patch, why), "Capacity model saved")
          }}>
          {edit && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {NUM_FIELDS.map(([k, label]) => (
                <div key={k} className="grid gap-1">
                  <Label htmlFor={`wc-${k}`}>{label}</Label>
                  <Input id={`wc-${k}`} type="number" min={0} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
                </div>
              ))}
              <div className="col-span-full grid gap-1">
                <Label htmlFor="wc-why">Reason (logged)</Label>
                <Input id="wc-why" value={why} onChange={(e) => setWhy(e.target.value)} />
              </div>
            </div>
          )}
        </DialogShell>
        <DialogShell open={!!statusDlg} onOpenChange={(o) => !o && setStatusDlg(null)} title={`${w.id}: set ${statusDlg}`} confirmLabel={`Set ${statusDlg}`} requireReason
          consequence={statusDlg === "Maintenance" ? "Capacity drops to zero until the end date; the scheduler is warned, operations move out and pegged promises are revalidated." : statusDlg === "Inactive" ? "The work center leaves the capacity model; queued operations cannot be placed until moved." : "Capacity returns from today; the plan recalculates."}
          onConfirm={(r) => runD((d, c) => act.setWcStatus(d, c, w.id, statusDlg!, (until || undefined) as ISODate | undefined, r), `${w.id} ${statusDlg}`)}>
          {statusDlg === "Maintenance" && (
            <div className="grid gap-1">
              <Label htmlFor="wc-until">Maintenance until</Label>
              <Input id="wc-until" type="date" value={until} min={TODAY} onChange={(e) => setUntil(e.target.value)} />
            </div>
          )}
        </DialogShell>
      </>
    )
  }
}

// ============================================================================ PP-RTG-001
const stdHours = (r: PPRouting) => r.opsDetail.reduce((a, o) => a + (o.setupHours + o.runHours) * o.crew, 0)

export function RoutingList() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-RTG-001")
  const rows = st.empty ? [] : s.routings
  const cols: Column<PPRouting>[] = [
    { id: "id", header: "Routing", value: (r) => `${r.id}/${r.rev}`, mono: true, sortable: true, cell: (r) => <span className="font-mono">{r.id}</span> },
    { id: "rev", header: "Rev", value: (r) => r.rev, mono: true },
    { id: "item", header: "Item", value: (r) => r.materialId, filterable: true, cell: (r) => <Item id={r.materialId} /> },
    { id: "desc", header: "Description", value: (r) => r.description },
    { id: "ops", header: "Ops", value: (r) => r.ops.length, align: "right", mono: true },
    { id: "qc", header: "QC gates", value: (r) => r.ops.filter((o) => o.qcFlag).length, align: "right", mono: true },
    { id: "hrs", header: "Std crew h / unit", value: (r) => stdHours(r), align: "right", mono: true, sortable: true, cell: (r) => qty(stdHours(r)) },
    { id: "from", header: "Valid from", value: (r) => r.validFrom, sortable: true, cell: (r) => fmtDate(r.validFrom) },
    { id: "eco", header: "ECO", value: (r) => r.ecoRef ?? "", mono: true },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, sortable: true, cell: (r) => <StatusBadge kind="routing" status={r.status} size="sm" /> },
  ]
  return (
    <ListPage<PPRouting>
      header={{
        title: "Routings",
        screenId: "PP-RTG-001/2",
        description: "Operation sequences with times and QC gates: the source of scheduling and of labor and overhead standards. Lifecycle mirrors the EBOM; released routings change through an ECO.",
        primary: <Button asChild><Link to="/production/work-centers">Work centers</Link></Button>,
      }}
      table={{
        rows, columns: cols, rowId: (r) => `${r.id}/${r.rev}`, rowHref: (r) => `/production/routings/${r.id}?rev=${r.rev}`, searchText: (r) => `${r.id} ${r.materialId} ${r.description} ${r.ecoRef ?? ""}`,
        loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "id", dir: "asc" }, empty: { title: "No routings", body: "Author one from a released MBOM." },
      }}
    />
  )
}

export function RoutingDetail() {
  const { id = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-RTG-002")
  const run = useAct()
  const runD = useActDialog()
  const revs = s.routings.filter((r) => r.id === id).sort((a, b) => a.rev.localeCompare(b.rev))
  const rev = params.get("rev") ?? revs.find((r) => r.status === "Released")?.rev ?? revs.at(-1)?.rev
  const r = revs.find((x) => x.rev === rev)
  const [dlg, setDlg] = useState<null | "eco" | "back" | "op">(null)
  const [eco, setEco] = useState("ECO-TBD-")
  const [newOp, setNewOp] = useState({ wc: "WC-400", text: "", setup: "1", run: "2" })
  return (
    <BodyState state={st} found={!!r} what={`Routing ${id}`} back={{ to: "/production/routings", label: "Back to routings" }}>
      {r && detail(r)}
    </BodyState>
  )
  function detail(r: PPRouting) {
    const draft = r.status === "Draft"
    const usedBy = s.productionOrders.filter((w) => w.routingId === r.id && w.routingRev === r.rev)
    const setRev = (v: string) => (params.set("rev", v), setParams(params, { replace: true }))
    let primary = null
    if (r.status === "Draft") primary = <Button onClick={() => run((d, c) => act.routingTransition(d, c, r.id, r.rev, "In Review"), "Sent to review")}>Submit for review</Button>
    else if (r.status === "In Review") primary = <Button onClick={() => run((d, c) => act.routingTransition(d, c, r.id, r.rev, "Released"), `Rev ${r.rev} Released`)}>Release</Button>
    else if (r.status === "Released") primary = <Button onClick={() => setDlg("eco")}>Change through ECO</Button>
    return (
      <>
        <DetailPage
          header={{
            title: `${r.id} rev ${r.rev} · ${r.description}`,
            screenId: "PP-RTG-001/2",
            crumbs: [{ label: "Routings", to: "/production/routings" }, { label: `${r.id} rev ${r.rev}` }],
            chips: (
              <>
                {r.ecoRef && <Chip kind="change" note="Revision raised through this ECO">{r.ecoRef}</Chip>}
                {r.status === "In Review" && <Chip kind="design" note="The specification names no routing reviewer role; any role may release in the prototype (ASM-PERM-1)">Reviewer: any role</Chip>}
              </>
            ),
            primary,
            actions: (
              <>
                <Select value={r.rev} onValueChange={setRev}>
                  <SelectTrigger className="h-8 w-40" aria-label="Revision"><SelectValue /></SelectTrigger>
                  <SelectContent>{revs.map((x) => <SelectItem key={x.rev} value={x.rev}>Rev {x.rev} · {x.status}</SelectItem>)}</SelectContent>
                </Select>
                {r.status === "In Review" && <Button variant="outline" onClick={() => setDlg("back")}>Return to Draft</Button>}
                {draft && <Button variant="outline" onClick={() => setDlg("op")}>Add operation</Button>}
              </>
            ),
          }}
          status={{ kind: "routing", value: r.status }}
          summary={
            <>
              <KV k="Item">{r.materialId}</KV>
              <KV k="Valid from">{fmtDate(r.validFrom)}</KV>
              <KV k="Author">{r.author}</KV>
              <KV k="Std crew hours / unit">{qty(stdHours(r))}</KV>
              <KV k="Production version">{r.productionVersionId ?? "n/a"}</KV>
              <KV k="QC checkpoints">{r.ops.filter((o) => o.qcFlag).length}</KV>
              <KV k="Open orders on this rev">{usedBy.filter((w) => act.isOpenWo(w)).length}</KV>
            </>
          }
          tabs={[
            {
              id: "ops", label: "Operations", count: r.opsDetail.length,
              content: (
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow><TableHead>Op</TableHead><TableHead>Work center</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Setup h</TableHead><TableHead className="text-right">Run h</TableHead><TableHead>Basis</TableHead><TableHead className="text-right">Crew</TableHead><TableHead>QC checkpoint</TableHead><TableHead>Milestone</TableHead><TableHead>Work instructions</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.opsDetail.map((o) => (
                      <TableRow key={o.no}>
                        <TableCell className="tabular">{o.no}</TableCell>
                        <TableCell><Link className="font-mono text-link" to={`/production/work-centers/${o.workCenterId}`}>{o.workCenterId}</Link></TableCell>
                        <TableCell className="max-w-72">{o.text}</TableCell>
                        {(["setupHours", "runHours"] as const).map((k) => (
                          <TableCell key={k} className="text-right">
                            {draft ? <Input aria-label={`Op ${o.no} ${k}`} className="h-8 w-20 text-right" type="number" min={0} step="0.5" defaultValue={o[k]} onBlur={(e) => Number(e.target.value) !== o[k] && run((d, c) => act.editRoutingOp(d, c, r.id, r.rev, o.no, { [k]: Number(e.target.value) }), `Op ${o.no} updated`)} /> : <span className="tabular">{o[k]}</span>}
                          </TableCell>
                        ))}
                        <TableCell className="text-sm">{o.basis}</TableCell>
                        <TableCell className="text-right">{draft ? <Input aria-label={`Op ${o.no} crew`} className="h-8 w-16 text-right" type="number" min={1} defaultValue={o.crew} onBlur={(e) => Number(e.target.value) !== o.crew && run((d, c) => act.editRoutingOp(d, c, r.id, r.rev, o.no, { crew: Number(e.target.value) }), `Op ${o.no} updated`)} /> : <span className="tabular">{o.crew}</span>}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            <Switch checked={o.qcFlag} disabled={!draft} aria-label={`QC checkpoint op ${o.no}`} onCheckedChange={(v) => run((d, c) => act.editRoutingOp(d, c, r.id, r.rev, o.no, { qcFlag: v }), v ? "QC checkpoint on" : "QC checkpoint off")} />
                            {o.qcFlag && <span className="font-mono text-xs">{o.qcPlan}</span>}
                          </span>
                        </TableCell>
                        <TableCell><Switch checked={!!o.milestone} disabled={!draft} aria-label={`Milestone op ${o.no}`} onCheckedChange={(v) => run((d, c) => act.editRoutingOp(d, c, r.id, r.rev, o.no, { milestone: v }), "Milestone flag updated")} /></TableCell>
                        <TableCell className="font-mono text-xs">{o.wiDocIds.map((d) => <Link key={d} className="block text-link" to={`/engineering/documents/${d}`}>{d}</Link>)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ),
            },
            {
              id: "comp", label: "Component mapping",
              content: (
                <div className="flex flex-col gap-2 text-sm">
                  <p className="text-muted-foreground">MBOM lines mapped to operations (Consume At Operation); read-only from the BOM.</p>
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Op</TableHead><TableHead>Components</TableHead></TableRow></TableHeader>
                    <TableBody>{r.opsDetail.filter((o) => o.components.length).map((o) => <TableRow key={o.no}><TableCell className="tabular">{o.no}</TableCell><TableCell className="font-mono text-xs">{o.components.join(" · ")}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              ),
            },
            {
              id: "used", label: "Orders", count: usedBy.length,
              content: <ul className="flex flex-col gap-1 text-sm">{usedBy.map((w) => <li key={w.id} className="flex items-center gap-2"><WoLink id={w.id} /><StatusBadge kind="productionOrder" status={w.status} size="sm" /></li>)}{!usedBy.length && <li className="text-muted-foreground">No order uses this revision.</li>}</ul>,
            },
            { id: "act", label: "Activity", content: <ActivityList items={r.activity} /> },
          ]}
        />
        <RulesPanel className="mt-6" rules={[
          ["§4", "QC checkpoint ON inserts an in-process inspection gate: the operation cannot complete until the IP-INP inspection passes", "DOC:p.73 §4"],
          ["§4", "Lifecycle mirrors the EBOM: Draft → In Review → Released → Superseded; changes via ECO", "DOC:p.73 §4"],
          ["§4", "Standard hours from released routings feed the cost rollup and the labor efficiency variance", "DOC:p.73 §4"],
        ]} />
        <DialogShell open={dlg === "eco"} onOpenChange={(o) => !o && setDlg(null)} title={`Change ${r.id} through an ECO`} confirmLabel="Create Draft revision"
          consequence={`Creates the next revision as Draft, copied from rev ${r.rev}. Rev ${r.rev} stays Released until the new one is released, then becomes Superseded. Open orders keep their frozen revision.`}
          onConfirm={() => runD((d, c) => act.newRoutingRevision(d, c, r.id, eco), (nr) => (setRev(nr), `Rev ${nr} drafted`))}>
          <Label htmlFor="rtg-eco">Engineering change order</Label>
          <Input id="rtg-eco" value={eco} onChange={(e) => setEco(e.target.value)} />
        </DialogShell>
        <DialogShell open={dlg === "back"} onOpenChange={(o) => !o && setDlg(null)} title="Return to Draft" confirmLabel="Return to Draft" requireReason reasonLabel="Review comment"
          consequence={`Rev ${r.rev} goes In Review → Draft with your comment for the author.`}
          onConfirm={(c) => runD((d, ctx) => act.routingTransition(d, ctx, r.id, r.rev, "Draft", c), "Returned to Draft")} />
        <DialogShell open={dlg === "op"} onOpenChange={(o) => !o && setDlg(null)} title="Add operation" confirmLabel="Add operation"
          onConfirm={() => runD((d, c) => act.addRoutingOp(d, c, r.id, r.rev, newOp.wc as WorkCenterId, newOp.text, Number(newOp.setup), Number(newOp.run)), "Operation added")}>
          <div className="grid gap-2">
            <Label>Work center</Label>
            <Select value={newOp.wc} onValueChange={(v) => setNewOp({ ...newOp, wc: v })}>
              <SelectTrigger aria-label="Work center"><SelectValue /></SelectTrigger>
              <SelectContent>{allWorkCenters(s).filter((w) => w.status !== "Inactive").map((w) => <SelectItem key={w.id} value={w.id}>{w.id} {w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label htmlFor="op-text">Description</Label>
            <Textarea id="op-text" value={newOp.text} onChange={(e) => setNewOp({ ...newOp, text: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <span className="grid gap-1"><Label htmlFor="op-setup">Setup h</Label><Input id="op-setup" type="number" min={0} value={newOp.setup} onChange={(e) => setNewOp({ ...newOp, setup: e.target.value })} /></span>
              <span className="grid gap-1"><Label htmlFor="op-run">Run h</Label><Input id="op-run" type="number" min={0} value={newOp.run} onChange={(e) => setNewOp({ ...newOp, run: e.target.value })} /></span>
            </div>
          </div>
        </DialogShell>
      </>
    )
  }
}
