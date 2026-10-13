// PP-DSP-001 Dispatch List [DOC:p.262 Book VI; p.76 §6] and PP-WIP-001 WIP Board and Valuation
// [DOC:p.77 §7; p.263] (asserted).
// Dispatch: per work-center queue in priority order with material-ready flags and hold markers;
// resequence within guardrails, assign crew, open the terminal view.
// WIP: Kanban mirror by work center (drag disabled: status changes only via confirmations) plus the
// valuation report reconciling to the GL 1320 balance; drill to orders; export for close step 6c.

import { WipAging } from "../widgets/WipAging"
import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ArrowDown, ArrowUp, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import type { UserId } from "@/data/domain"
import { TODAY, USERS } from "@/data/shared"
import { daysBetween, fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { BodyState, Item, StatePreview, WoLink, qty, useAct, useActDialog, useScreenState, userName, Marker } from "../components"
import * as act from "../lib/actions"
import { allWorkCenters, opHours, projected, woWip } from "../lib/plan"
import type { PPOperation, PPWorkOrder } from "../data/types"

type QRow = { key: string; wo: PPWorkOrder; op: PPOperation; pos: number }
/** Green when all the operation's components are staged: issued quantity covers qty per unit × order quantity
 *  (same rule as the terminal) [DOC:p.76 §6]. */
const materialReady = (wo: PPWorkOrder, op: PPOperation) => op.staged || op.components.length === 0 || op.components.every((c) => c.issued >= c.qtyPerUnit * wo.qty || c.issue === "backflush")

// ============================================================================ PP-DSP-001
export function DispatchList() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-DSP-001")
  const run = useAct()
  const runD = useActDialog()
  const [params, setParams] = useSearchParams()
  const wcs = allWorkCenters(s).filter((w) => w.status !== "Inactive")
  const wc = params.get("wc") ?? "WC-400"
  const setWc = (v: string) => (params.set("wc", v), setParams(params, { replace: true }))
  const [crewFor, setCrewFor] = useState<QRow | null>(null)
  const [crew, setCrew] = useState<string[]>([])
  const rows: QRow[] = st.empty ? [] : act.wcQueue(s, wc).map((x, i) => ({ key: `${x.wo.id}/${x.op.no}`, wo: x.wo, op: x.op, pos: i + 1 }))
  const w = wcs.find((x) => x.id === wc)
  const cols: Column<QRow>[] = [
    { id: "pos", header: "#", value: (r) => r.pos, align: "right", mono: true },
    { id: "wo", header: "WO", value: (r) => r.wo.id, cell: (r) => <WoLink id={r.wo.id} /> },
    { id: "item", header: "Item / serial", value: (r) => r.wo.itemId, cell: (r) => <span className="flex flex-col"><Item id={r.wo.itemId} short /><span className="font-mono text-xs text-muted-foreground">{r.wo.serials.length > 1 ? `${r.wo.serials[0]} +${r.wo.serials.length - 1}` : r.wo.serials[0]}</span></span> },
    { id: "op", header: "Op", value: (r) => r.op.no, mono: true, cell: (r) => <span className="flex flex-col"><span className="tabular">{r.op.no}</span><span className="max-w-60 truncate text-xs text-muted-foreground">{r.op.text}</span></span> },
    { id: "qty", header: "Qty", value: (r) => r.wo.qty, align: "right", mono: true },
    { id: "std", header: "Std h", value: (r) => opHours(r.op), align: "right", mono: true, cell: (r) => qty(opHours(r.op)) },
    { id: "start", header: "Planned start", value: (r) => r.op.start, cell: (r) => fmtDate(r.op.start) },
    { id: "ready", header: "Material", value: (r) => (materialReady(r.wo, r.op) ? "Ready" : "Not staged"), filterable: true, cell: (r) => (materialReady(r.wo, r.op) ? <Marker note="All op components staged">Ready</Marker> : <Chip kind="backorder" note="Kit not staged at the work center">Not staged</Chip>) },
    {
      id: "flags", header: "Status / holds", value: (r) => r.op.status,
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <span className="text-sm">{r.op.status}</span>
          {r.wo.status === "On Hold" && <Chip kind="hold" note={r.wo.holdReason}>WO On Hold</Chip>}
          {r.op.andon && <Chip kind="hold" note={`${r.op.andon.by} ${r.op.andon.at}`}>Andon: {r.op.andon.reason}</Chip>}
          {r.op.qcGate && <Chip kind="flag">QC: {r.op.qcGate}</Chip>}
          {r.wo.promiseDate && projected(r.wo) > r.wo.promiseDate && <Chip kind="flag" note="Projected completion after the promise">Late</Chip>}
        </span>
      ),
    },
    { id: "crew", header: "Crew", value: (r) => r.op.crewIds.length, cell: (r) => <span className="text-sm">{r.op.crewIds.map(userName).join(", ")}</span> },
    {
      id: "seq", header: "Resequence", value: () => "",
      cell: (r) => (
        <span className="inline-flex gap-1">
          <Button size="icon" variant="ghost" aria-label={`Move ${r.key} up`} onClick={(e) => (e.stopPropagation(), run((d, c) => act.resequence(d, c, wc, r.wo.id, r.op.no, -1)))}><ArrowUp /></Button>
          <Button size="icon" variant="ghost" aria-label={`Move ${r.key} down`} onClick={(e) => (e.stopPropagation(), run((d, c) => act.resequence(d, c, wc, r.wo.id, r.op.no, 1)))}><ArrowDown /></Button>
          <Button size="sm" variant="outline" onClick={(e) => (e.stopPropagation(), setCrew(r.op.crewIds), setCrewFor(r))}>Crew</Button>
        </span>
      ),
    },
  ]
  const crewCandidates = USERS.filter((u) => u.roles.some((r) => r === "Operator" || r === "Production supervisor" || r === "Test technician"))
  return (
    <>
      <WorkbenchPage<QRow>
        header={{
          title: "Dispatch list",
          screenId: "PP-DSP-001",
          description: "The operator queue the terminal shows, per work center in priority order. Running operations stay on top; holds and unstaged kits are flagged.",
          primary: <Button asChild><Link to={`/production/terminal?wc=${wc}`}>Open terminal view</Link></Button>,
          actions: <StatePreview />,
          children: w && w.status !== "Active" ? <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{w.id} is {w.status}{w.status === "Maintenance" && w.maintenanceUntil ? ` until ${fmtDate(w.maintenanceUntil)}` : ""}: new dispatch is blocked; queued operations cannot start until it is Active [DOC:p.71 §2].</p> : undefined,
        }}
        kpis={[
          { label: `${wc} queue`, value: rows.length, hint: w?.name },
          { label: "Running", value: rows.filter((r) => r.op.status === "In Progress").length },
          { label: "Kit not staged", value: rows.filter((r) => !materialReady(r.wo, r.op)).length },
          { label: "Held (WO or andon)", value: rows.filter((r) => r.wo.status === "On Hold" || r.op.andon).length },
        ]}
        queues={wcs.map((x) => ({ id: x.id, label: x.id, count: act.wcQueue(s, x.id).length }))}
        queue={wc}
        onQueueChange={setWc}
        table={{ rows, columns: cols, rowId: (r) => r.key, loading: st.loading, error: st.error, onRetry: st.retry, empty: { title: `No operations queued at ${wc}`, body: "Released orders and schedule publishes fill the queue." } }}
      />
      <RulesPanel className="mt-6" rules={[
        ["§6", "Dispatch list: operations queued at the work center in priority order with material-ready flag (green when all op components are staged for the order quantity)", "DOC:p.76 §6"],
        ["§2", "A work center in Maintenance or Inactive blocks new dispatch", "DOC:p.71 §2"],
        ["Book VI", "Resequence within guardrails; assign crew; open terminal view", "DOC:p.262"],
        ["Design", "Guardrail: running operations stay at the top; an operation cannot jump ahead of a running one", "design value"],
      ]} />
      <DialogShell open={!!crewFor} onOpenChange={(o) => !o && setCrewFor(null)} title={`Assign crew · ${crewFor?.key}`} confirmLabel="Assign crew"
        consequence="The crew clocks in at the terminal when the operation starts; labor is attributed per crew member."
        onConfirm={() => runD((d, c) => act.assignCrew(d, c, crewFor!.wo.id, crewFor!.op.no, crew as UserId[]), "Crew assigned")}>
        <div className="flex flex-col gap-2">
          {crewCandidates.map((u) => (
            <Label key={u.id} className="flex items-center gap-2 font-normal">
              <Checkbox checked={crew.includes(u.id)} onCheckedChange={(v) => setCrew(v ? [...crew, u.id] : crew.filter((x) => x !== u.id))} />
              {u.name} · {u.roles.join(", ")}{u.workCenterIds?.length ? ` · ${u.workCenterIds.join(", ")}` : ""}
            </Label>
          ))}
        </div>
      </DialogShell>
    </>
  )
}

// ============================================================================ PP-WIP-001
type ValRow = { wo: PPWorkOrder; w: ReturnType<typeof woWip> }
export function WipBoard() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-WIP-001")
  const [active, setActive] = useState<string | null>(null)
  const open = s.productionOrders.filter((w) => ["Released", "In Progress", "Testing", "On Hold", "Completed"].includes(w.status))
  const rows: ValRow[] = st.empty ? [] : open.map((wo) => ({ wo, w: woWip(s, wo.id) })).filter((r) => Math.abs(r.w.total) > 0.005 || r.wo.status !== "Completed")
  const sub = rows.reduce((a, r) => a + r.w.total, 0)
  const gl1320 = s.journal.filter((j) => j.source.type === "productionOrder").reduce((a, j) => a + j.wip1320, 0)
  const gl1325 = s.journal.reduce((a, j) => a + j.wip1325, 0)
  const rwoRows = s.reworkOrders.map((r) => ({ r, bal: act.rwoBalance(s, r.id) })).filter((x) => Math.abs(x.bal) > 0.005)
  const sub1325 = rwoRows.reduce((a, x) => a + x.bal, 0)
  const diff = gl1320 + gl1325 - (sub + sub1325)
  const snap = s.publishes.at(-1)
  const wcs = allWorkCenters(s).filter((w) => w.status !== "Inactive")
  const cards = (wcId: string) =>
    s.productionOrders
      .filter((w) => ["Released", "In Progress", "Testing", "On Hold"].includes(w.status))
      .flatMap((w) => {
        const cur = w.operations.find((o) => o.status === "In Progress") ?? w.operations.find((o) => o.status === "Not Started")
        return cur && cur.workCenterId === wcId ? [{ w, o: cur }] : []
      })
  const exportCsv = () => {
    const lines = [["WO", "Item", "Status", "Material #28", "Labor+OH #29", "Subcontract #35", "Scrap #30", "Rework #33", "Receipt #31", "WIP 1320"].join(",")]
    for (const r of rows) lines.push([r.wo.id, r.wo.itemId, r.wo.status, r.w.material, r.w.labor, r.w.subcontract, r.w.scrap, r.w.rework, r.w.receipt, r.w.total].map((x) => (typeof x === "number" ? x.toFixed(2) : x)).join(","))
    lines.push(["Subledger 1320 (orders)", "", "", "", "", "", "", "", "", sub.toFixed(2)].join(","), ["GL 1320 balance", "", "", "", "", "", "", "", "", gl1320.toFixed(2)].join(","))
    lines.push("", ["Rework order", "Origin", "Status", "", "", "", "", "", "", "WIP-Rework 1325"].join(","))
    for (const x of rwoRows) lines.push([x.r.id, x.r.originKind, x.r.status, "", "", "", "", "", "", x.bal.toFixed(2)].join(","))
    lines.push(["Subledger 1325 (rework orders)", "", "", "", "", "", "", "", "", sub1325.toFixed(2)].join(","), ["GL 1325 balance", "", "", "", "", "", "", "", "", gl1325.toFixed(2)].join(","))
    lines.push("", ["WIP report (1320 + 1325)", "", "", "", "", "", "", "", "", (sub + sub1325).toFixed(2)].join(","), ["GL 1320 + 1325", "", "", "", "", "", "", "", "", (gl1320 + gl1325).toFixed(2)].join(","), ["Difference", "", "", "", "", "", "", "", "", diff.toFixed(2)].join(","))
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `wip-reconciliation-${TODAY}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const aw = rows.find((r) => r.wo.id === active)
  const cols: Column<ValRow>[] = [
    { id: "wo", header: "WO", value: (r) => r.wo.id, cell: (r) => <WoLink id={r.wo.id} /> },
    { id: "item", header: "Item", value: (r) => r.wo.itemId, filterable: true, cell: (r) => <Item id={r.wo.itemId} short /> },
    { id: "status", header: "Status", value: (r) => r.wo.status, filterable: true, cell: (r) => <StatusBadge kind="productionOrder" status={r.wo.status} size="sm" /> },
    { id: "mat", header: "Material", value: (r) => r.w.material, align: "right", sortable: true, cell: (r) => <span className="tabular">{fmtMoney(r.w.material)}</span> },
    { id: "lab", header: "Labor + OH", value: (r) => r.w.labor, align: "right", cell: (r) => <span className="tabular">{fmtMoney(r.w.labor)}</span> },
    { id: "sub", header: "Subcontract", value: (r) => r.w.subcontract, align: "right", cell: (r) => <span className="tabular">{fmtMoney(r.w.subcontract)}</span> },
    { id: "scrap", header: "Scrap", value: (r) => r.w.scrap, align: "right", cell: (r) => <span className="tabular">{fmtMoney(r.w.scrap)}</span> },
    { id: "rwk", header: "Rework", value: (r) => r.w.rework, align: "right", cell: (r) => <span className="tabular">{fmtMoney(r.w.rework)}</span> },
    { id: "rcpt", header: "Receipt", value: (r) => r.w.receipt, align: "right", cell: (r) => <span className="tabular">{fmtMoney(r.w.receipt)}</span> },
    { id: "total", header: "WIP value", value: (r) => r.w.total, align: "right", sortable: true, cell: (r) => <span className="tabular font-semibold">{fmtMoney(r.w.total)}</span> },
  ]
  return (
    <>
      <WorkbenchPage<ValRow>
        header={{
          title: "WIP board and valuation",
          screenId: "PP-WIP-001",
          description: "The board mirrors the floor (drag disabled: status changes only via confirmations). The valuation report reconciles to the GL: WIP report = GL 1320 (orders) + 1325 (rework orders), exported for close step 6c.",
          chips: <Chip kind="design" note="Archetype Board + report rendered on the Workbench template (design value)">Board + report</Chip>,
          primary: <Button onClick={exportCsv}><Download aria-hidden="true" /> Export reconciliation</Button>,
          actions: <StatePreview />,
          children: (
            <BodyState state={st} what="WIP board">
              <div className="overflow-x-auto" role="region" aria-label="WIP board by work center (read-only mirror)">
                <div className="flex gap-3 pb-2">
                  {wcs.map((w) => {
                    const cs = cards(w.id)
                    return (
                      <section key={w.id} aria-label={`${w.id} column`} className="flex w-56 shrink-0 flex-col gap-2 rounded-lg border bg-muted p-2">
                        <h3 className="flex items-center justify-between text-xs font-semibold"><span>{w.id} {w.name}</span><span className="tabular">{cs.length}</span></h3>
                        {cs.map(({ w: wo, o }) => (
                          <Link key={wo.id} to={`/production/orders/${wo.id}`} className="flex flex-col gap-1 rounded-md border bg-background p-2 text-xs">
                            <span className="flex items-center justify-between"><span className="font-mono">{wo.id}</span><span className="tabular">P{wo.priority}</span></span>
                            <span className="truncate">op {o.no} · {o.text}</span>
                            <span className="flex flex-wrap items-center gap-1 text-muted-foreground">
                              {o.status === "In Progress" ? `running ${daysBetween(o.start, TODAY)} d` : `waiting since ${fmtDate(o.start)}`}
                              {wo.status === "On Hold" && <Chip kind="hold">Hold</Chip>}
                              {o.andon && <Chip kind="hold">Andon</Chip>}
                            </span>
                          </Link>
                        ))}
                      </section>
                    )
                  })}
                </div>
              </div>
            </BodyState>
          ),
        }}
        kpis={[
          { label: "WIP report 1320 + 1325", value: fmtMoney(sub + sub1325), hint: `${rows.length} orders ${fmtMoney(sub)} · ${rwoRows.length} rework orders ${fmtMoney(sub1325)}` },
          { label: "GL 1320 + 1325", value: fmtMoney(gl1320 + gl1325), hint: `1320 ${fmtMoney(gl1320)} · 1325 ${fmtMoney(gl1325)}` },
          { label: "Difference", value: fmtMoney(diff), hint: Math.abs(diff) < 0.01 ? "Reconciled" : "Investigate before close" },
          { label: "Open rework orders", value: s.reworkOrders.filter((r) => r.status !== "Settled").length, hint: "balances in 1325, in the export" },
        ]}
        table={{ rows, columns: cols, rowId: (r) => r.wo.id, onRowClick: (r) => setActive(r.wo.id), activeId: active ?? undefined, loading: st.loading, error: st.error, onRetry: st.retry, initialSort: { id: "total", dir: "desc" }, empty: { title: "No WIP", body: "No released order carries cost." } }}
        panel={aw ? {
          open: !!aw, onOpenChange: (o) => !o && setActive(null), title: `Order progress · ${aw.wo.id}`, description: `${aw.wo.itemId} · projected ${fmtDate(projected(aw.wo))}${aw.wo.promiseDate ? ` vs promise ${fmtDate(aw.wo.promiseDate)}` : ""}`,
          content: (
            <div className="flex flex-col gap-3 text-sm">
              {(() => {
                const ms = aw.wo.operations.filter((o) => o.milestone && o.status !== "Cancelled")
                const done = ms.filter((o) => s.confirmations.some((c) => c.woId === aw.wo.id && c.op === o.no && !c.reversalOf && !c.reversedBy) || (o.status === "Completed" && !s.confirmations.some((c) => c.woId === aw.wo.id && c.op === o.no)))
                return (
                  <dl className="grid grid-cols-2 gap-3">
                    <KV k="Milestone % complete">{ms.length ? `${Math.round((done.length / ms.length) * 100)}% (${done.length} of ${ms.length} milestone confirmations)` : "No milestone operations on this routing"}</KV>
                    <KV k="WIP value">{fmtMoney(aw.w.total)}</KV>
                  </dl>
                )
              })()}
              <p className="text-xs text-muted-foreground">Scheduled = published snapshot {snap?.snapshotId ?? "none"}; actual for confirmed operations, projected for open ones.</p>
              <ol className="flex flex-col gap-1">
                <li className="grid grid-cols-[40px_70px_minmax(0,1fr)_130px_130px_56px] gap-2 border-b pb-1 text-xs font-semibold"><span>Op</span><span>WC</span><span>State</span><span>Scheduled</span><span>Actual / projected</span><span className="text-right">Δ d</span></li>
                {aw.wo.operations.map((o) => {
                  const sch = snap?.dates[`${aw.wo.id}/${o.no}`]
                  const delta = sch && o.status !== "Cancelled" ? daysBetween(sch[1], o.finish) : undefined
                  return (
                    <li key={o.no} className="grid grid-cols-[40px_70px_minmax(0,1fr)_130px_130px_56px] gap-2 border-b pb-1">
                      <span className="tabular">{o.no}</span>
                      <span className="font-mono text-xs">{o.workCenterId}</span>
                      <span className="truncate">{o.status}{o.milestone ? " · milestone" : ""}</span>
                      <span className="tabular text-xs">{sch ? `${fmtDate(sch[0])} → ${fmtDate(sch[1])}` : "not in snapshot"}</span>
                      <span className="tabular text-xs">{o.status === "Cancelled" ? "cancelled" : `${fmtDate(o.start)} → ${fmtDate(o.finish)}`}</span>
                      <span className={delta && delta > 0 ? "tabular text-right text-xs text-status-exception-ink" : "tabular text-right text-xs"}>{delta == null ? "" : delta > 0 ? `+${delta}` : delta}</span>
                    </li>
                  )
                })}
              </ol>
              <Button asChild variant="outline"><Link to={`/production/orders/${aw.wo.id}`}>Open order</Link></Button>
            </div>
          ),
        } : undefined}
      />
      <div className="mt-6"><WipAging empty={st.empty} /></div>
      <RulesPanel className="mt-6" rules={[
        ["§7", "WIP board: cards = WO operations at each work center with age, priority and hold flags; drag disabled", "DOC:p.77 §7"],
        ["§7", "Valuation: materials, labor and overhead applied, scrap, total WIP per open order; reconciles to GL 1320 (ACC 26.2 step 6)", "DOC:p.77 §7"],
        ["FL-04", "WIP report = GL 1320 + 1325: rework-order balances are reconciled and exported with the order WIP", "DOC:p.179 FL-04 f12"],
        ["§12", "WIP aging: open order value by age bucket; stalled orders with no confirmation in N days", "DOC:p.82 Book I D §12"],
        ["§7", "Order progress: op-by-op timeline actual vs scheduled; milestone % from milestone-flagged confirmations", "DOC:p.77 §7; p.73 §4"],
      ]} />
    </>
  )
}
