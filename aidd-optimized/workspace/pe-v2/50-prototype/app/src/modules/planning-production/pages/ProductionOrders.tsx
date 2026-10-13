// PP-WO-001 (list) and PP-WO-002 (detail) [DOC:pp.74-78 §5-§8; p.261-262 Book VI] (asserted).
// Header with frozen revisions and serial, the release-gate checklist with red and green rows,
// operations, materials, cost with live WIP, genealogy. Release when gates pass (or short with the
// Planner's flag), Print traveler, Hold, Receive to Stock, Close (runs the settlement checks).
// Postings happen through terminal confirmations and receipt, not here (except receipt and close).

import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { CheckCircle2, CircleSlash, Printer, TriangleAlert, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApprovalButton, Chip, KV, PostingPreview, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { MATERIALS, PROFIT_CENTERS, TODAY } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { ActivityList, BodyState, Item, RefLink, SoLink, StatePreview, custName, matDesc, qty, useAct, useActDialog, useScreenState, userName, Marker } from "../components"
import * as act from "../lib/actions"
import { closeChecks, releaseGates, shortages, unsettledBreach } from "../lib/gates"
import { allWorkCenters, goodQty, laborRateOf, modeOf, ohRateOf, opHours, projected, stdTotal, variances, woWip } from "../lib/plan"
import type { CancelDisposition, PPWorkOrder } from "../data/types"
import { WoDecisionDialog, type WoDecisionKind } from "../widgets/WoDecisionDialogs"

export function ProductionOrderList() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-WO-001")
  const rows = st.empty ? [] : s.productionOrders
  const columns: Column<PPWorkOrder>[] = [
    { id: "id", header: "WO", value: (w) => w.id, sortable: true, mono: true },
    { id: "item", header: "Item", value: (w) => w.itemId, filterable: true, cell: (w) => <Item id={w.itemId} /> },
    { id: "qty", header: "Qty", value: (w) => w.qty, align: "right", mono: true },
    { id: "serial", header: "Serial", value: (w) => w.serials[0] ?? "", cell: (w) => <span className="font-mono text-xs">{w.serials.length > 1 ? `${w.serials[0]} +${w.serials.length - 1}` : w.serials[0] ?? "at release"}</span> },
    { id: "type", header: "Type", value: (w) => w.orderType, filterable: true },
    { id: "peg", header: "SO peg", value: (w) => w.pegs[0]?.soId ?? "", cell: (w) => (w.pegs[0] ? <span className="font-mono text-xs">{w.pegs[0].soId}/{w.pegs[0].line}</span> : <span className="text-muted-foreground">stock</span>) },
    { id: "prio", header: "Prio", value: (w) => w.priority, align: "right", sortable: true, mono: true, cell: (w) => <span className="inline-flex items-center gap-1">{w.priority}{w.escalatedFrom != null && <Chip kind="flag" note={`Late pegged order: auto-escalated from ${w.escalatedFrom}`}>Escalated</Chip>}</span> },
    { id: "due", header: "Due", value: (w) => w.dueDate ?? "", sortable: true, cell: (w) => (w.dueDate ? fmtDate(w.dueDate) : "") },
    { id: "start", header: "Start", value: (w) => w.start, sortable: true, cell: (w) => fmtDate(w.start) },
    { id: "finish", header: "Projected finish", value: (w) => projected(w), sortable: true, cell: (w) => <span className={w.promiseDate && projected(w) > w.promiseDate ? "text-status-exception-ink" : undefined}>{fmtDate(projected(w))}</span> },
    { id: "promise", header: "Promise", value: (w) => w.promiseDate ?? "", cell: (w) => (w.promiseDate ? fmtDate(w.promiseDate) : "") },
    {
      id: "status", header: "Status", value: (w) => w.status, filterable: true, sortable: true,
      cell: (w) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <StatusBadge kind="productionOrder" status={w.status} size="sm" />
          {w.shortage && <Chip kind="backorder" note="Released short with the Planner's flag">Shortage</Chip>}
          {unsettledBreach(w) && <Chip kind="flag" note="Completed more than 5 days and not settled">Unsettled &gt; 5 d</Chip>}
        </span>
      ),
    },
  ]
  const open = s.productionOrders.filter((w) => act.isOpenWo(w)).length
  return (
    <ListPage<PPWorkOrder>
      header={{
        title: "Production orders",
        screenId: "PP-WO-001/2",
        description: `${open} open orders at PL-TBD-01 Fargo. Orders arrive from planned-order conversion and ETO design release; release runs the six hard checks.`,
        primary: (
          <Button asChild>
            <Link to="/production/planned-orders">Convert planned orders</Link>
          </Button>
        ),
        actions: (
          <Button variant="outline" asChild>
            <Link to="/production/settlement">Settlement run</Link>
          </Button>
        ),
      }}
      table={{
        rows, columns, rowId: (w) => w.id, rowHref: (w) => `/production/orders/${w.id}`,
        searchText: (w) => `${w.id} ${w.itemId} ${matDesc(w.itemId)} ${w.serials.join(" ")} ${w.pegs.map((p) => p.soId).join(" ")}`,
        searchPlaceholder: "Search WO, item, serial, sales order",
        loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "start", dir: "desc" },
        empty: { title: "No production orders yet", body: "Convert a planned order on the MRP workbench or Planned Orders to create one." },
      }}
    />
  )
}

const GateIcon = ({ state }: { state: string }) =>
  state === "pass" ? <CheckCircle2 className="size-4 text-status-passed-ink" aria-label="Pass" /> : state === "fail" ? <XCircle className="size-4 text-status-cancelled-ink" aria-label="Fail" /> : state === "warn" ? <TriangleAlert className="size-4 text-status-pending-ink" aria-label="Warning" /> : <CircleSlash className="size-4 text-muted-foreground" aria-label="Not applicable" />

export function ProductionOrderDetail() {
  const { id = "" } = useParams()
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-WO-002")
  const [role] = useRole()
  const nav = useNavigate()
  const run = useAct()
  const runD = useActDialog()
  const [dlg, setDlg] = useState<null | "hold" | "unhold" | "cancel" | "receive" | "close" | "traveler" | "scrap">(null)
  const [cancelKind, setCancelKind] = useState<CancelDisposition>("Stop-scrap")
  const [opDlg, setOpDlg] = useState<null | { kind: "cancelOp" | "reverse" | "conditional"; no: number; cnfId?: string; note: string }>(null)
  const [dec, setDec] = useState<null | { kind: WoDecisionKind; cnfId?: string; requestId?: string }>(null)
  const w = s.productionOrders.find((x) => x.id === id)
  return (
    <BodyState state={st} found={!!w} what={`Production order ${id}`} back={{ to: "/production/orders", label: "Back to production orders" }}>
      {w && detail(w)}
    </BodyState>
  )

  function detail(wo: PPWorkOrder) {
    const gates = releaseGates(s, wo)
    const failed = gates.filter((g) => g.state === "fail")
    const short = shortages(s, wo)
    const wip = woWip(s, wo.id)
    const v = variances(s, wo)
    const checks = closeChecks(s, wo)
    const lastDone = wo.operations.every((o) => o.status === "Completed" || o.status === "Cancelled")
    const ftFailed = wo.status === "Testing" && !wo.testPassed && wo.operations.some((o) => o.qcGate === "Final Test" && o.inspection?.result === "Failed")
    const wcs = allWorkCenters(s)
    const hoursByWc = new Map<string, number>()
    for (const o of wo.operations) hoursByWc.set(o.workCenterId, (hoursByWc.get(o.workCenterId) ?? 0) + opHours(o) * o.crew)
    const primaryWc = [...hoursByWc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const costCenter = wcs.find((x) => x.id === primaryWc)?.costCenterId
    const pc = PROFIT_CENTERS.find((p) => p.id === MATERIALS.find((m) => m.id === wo.itemId)?.profitCenterId)
    const liveCnf = s.confirmations.filter((c) => c.woId === wo.id && !c.reversalOf && !c.reversedBy)
    const lastCnf = [...liveCnf].sort((a, b) => b.op - a.op)[0]
    const cva = s.cvaExceptions.filter((x) => x.woId === wo.id)
    const good = goodQty(wo)
    const recvAmount = (stdTotal(wo.costStd) / wo.qty) * good
    const rwos = s.reworkOrders.filter((r) => r.parentWoId === wo.id)
    const gen = s.genealogy.filter((g) => g.woId === wo.id)
    const journal = s.journal.filter((j) => j.source.type === "productionOrder" && j.source.id === wo.id)
    const appr = { kind: "WO reopen" as const, subject: { type: "productionOrder" as const, id: wo.id }, title: `${wo.id} reopen (reverses settlement ${wo.settlementId ?? ""})` }

    let primary = null
    if (wo.status === "Created") primary = <Button onClick={() => run((d, c) => act.releaseWo(d, c, wo.id), (ids) => `Released ${ids.join(", ")}`)} disabled={failed.length > 0} title={failed.length ? `Blocked by ${failed.length} failing check(s)` : undefined}>Release</Button>
    else if (["In Progress", "Testing"].includes(wo.status) && lastDone) primary = <Button onClick={() => setDlg("receive")}>Receive to stock</Button>
    else if (ftFailed) primary = <Button onClick={() => setDlg("scrap")}>Scrap disposition</Button>
    else if (wo.status === "Completed") primary = <Button onClick={() => setDlg("close")}>Close (settle)</Button>
    else if (wo.status === "Closed (TECO)") primary = <ApprovalButton {...appr} variant="default" label="Request reopen (Controller)" stay />
    else if (["Released", "In Progress", "Testing"].includes(wo.status)) primary = <Button asChild><Link to={`/production/terminal?wc=${wo.operations.find((o) => o.status !== "Completed" && o.status !== "Cancelled")?.workCenterId ?? ""}`}>Open terminal view</Link></Button>

    return (
      <>
        <DetailPage
          header={{
            title: `${wo.id} · ${matDesc(wo.itemId)}`,
            screenId: "PP-WO-001/2",
            crumbs: [{ label: "Production orders", to: "/production/orders" }, { label: wo.id }],
            chips: (
              <>
                {wo.shortage && <Chip kind="backorder" note="Released short with the Planner's override flag">Shortage</Chip>}
                {wo.status === "On Hold" && <Chip kind="hold" note={wo.holdReason}>Hold: {wo.holdReason?.split(":")[0]}</Chip>}
                {unsettledBreach(wo) && <Chip kind="flag" note="Completed more than 5 days and not settled [DOC:p.126]">Unsettled &gt; 5 d</Chip>}
                {wo.readings?.map((r) => <Chip key={r} kind="design" note={r}>Reading</Chip>)}
              </>
            ),
            description: wo.status === "On Hold" ? `On Hold: ${wo.holdReason}` : wo.status === "Cancelled" ? `Cancelled. ${wo.cancelDisposition}` : wo.scrapDisposedOn ? `Scrap-disposed ${fmtDate(wo.scrapDisposedOn)}: ${wo.scrapDisposition}` : wo.cancelKind === "Finish" ? `Cancellation disposition Finish: ${wo.cancelDisposition}` : undefined,
            primary,
            actions: (
              <>
                <Button variant="outline" onClick={() => setDlg("traveler")} disabled={wo.status === "Created"} title={wo.status === "Created" ? "The traveler is printable after release" : undefined}>
                  <Printer aria-hidden="true" /> Print traveler
                </Button>
                {wo.status === "Created" && short.length > 0 && (
                  <Button variant="outline" onClick={() => run((d, c) => act.setReleaseShort(d, c, wo.id, !wo.releaseShortFlag), wo.releaseShortFlag ? "Release Short flag removed" : "Release Short flag set")} title={role !== "Planner" ? "Planner only" : undefined}>
                    {wo.releaseShortFlag ? "Remove Release Short" : "Set Release Short (Planner)"}
                  </Button>
                )}
                {["Created", "Released", "In Progress", "Testing"].includes(wo.status) && <Button variant="outline" onClick={() => setDlg("hold")}>Hold</Button>}
                {wo.status === "On Hold" && <Button variant="outline" onClick={() => setDlg("unhold")}>Release hold</Button>}
                {wo.status === "Closed (TECO)" && <Button variant="outline" onClick={() => setDec({ kind: "reopen" })}>Preview reopen</Button>}
                <Button variant="ghost" asChild><Link to={`/production/dialogs/wo-decisions?wo=${wo.id}`}>Decision dialogs</Link></Button>
                {act.isOpenWo(wo) && <Button variant="outline" onClick={() => run((d, c) => act.setScheduleMode(d, c, wo.id, modeOf(wo) === "Backward" ? "Forward" : "Backward"), "Rescheduled")} disabled={!wo.dueDate && modeOf(wo) === "Forward"}>{modeOf(wo) === "Backward" ? "Schedule forward from release" : "Schedule backward from due date"}</Button>}
                {["Created", "Released", "In Progress", "Testing", "On Hold"].includes(wo.status) && <Button variant="ghost" onClick={() => setDlg("cancel")}>Cancel order</Button>}
              </>
            ),
          }}
          status={{ kind: "productionOrder", value: wo.status }}
          doc={{ type: "productionOrder", id: wo.id }}
          summary={
            <>
              <KV k="Item">{wo.itemId}</KV>
              <KV k="Quantity">{wo.qty} EA · {wo.orderType}</KV>
              <KV k="Serial">{wo.serials.length ? (wo.serials.length > 1 ? `${wo.serials[0]}..${wo.serials.at(-1)}` : wo.serials[0]) : "Generated at release"}</KV>
              <KV k="MBOM / routing rev">{`${wo.mbomRev} / ${wo.routingId} ${wo.routingRev}`}{wo.status !== "Created" && " (frozen)"}</KV>
              <KV k="SO peg">{wo.pegs[0] ? <><SoLink id={wo.pegs[0].soId} /> line {wo.pegs[0].line}</> : "Stock order"}</KV>
              <KV k="Start / projected">{fmtDate(wo.start)} → {fmtDate(projected(wo))}</KV>
              <KV k="Due date">{wo.dueDate ? <span className={projected(wo) > wo.dueDate && act.isOpenWo(wo) ? "text-status-exception-ink" : undefined}>{fmtDate(wo.dueDate)}</span> : "None"} <span className="text-xs text-muted-foreground">{act.isOpenWo(wo) ? (modeOf(wo) === "Backward" ? "backward from due date" : "forward from release") : ""}</span></KV>
              <KV k="Promise">{wo.promiseDate ? fmtDate(wo.promiseDate) : "None"}</KV>
              <KV k="Priority">{wo.priority}{wo.escalatedFrom != null && <> <Chip kind="flag" note="Late pegged orders auto-escalate [DOC:p.74 §5.1]">Escalated from {wo.escalatedFrom}</Chip> <Chip kind="design" note="Escalated priority value 1 is a design value">Reading</Chip></>}</KV>
              <KV k="Production cost center">{costCenter ?? ""} <span className="text-xs text-muted-foreground">primary, from {primaryWc} (per operation from its WC)</span></KV>
              <KV k="Profit center">{pc ? `${pc.id} ${pc.name}` : ""}</KV>
              <KV k="Production version">{wo.productionVersionId}</KV>
            </>
          }
          defaultTab={wo.status === "Created" ? "gates" : "ops"}
          tabs={[
            {
              id: "gates", label: "Release checks", count: failed.length || undefined,
              content: (
                <div className="flex flex-col gap-4">
                  <Table>
                    <TableHeader className="bg-table-head">
                      <TableRow><TableHead className="w-10" /><TableHead>Check</TableHead><TableHead>Result</TableHead><TableHead>Source</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {gates.map((g) => (
                        <TableRow key={g.no} className={g.state === "fail" ? "bg-status-cancelled/10" : g.state === "pass" ? "bg-status-passed-tint" : undefined}>
                          <TableCell><GateIcon state={g.state} /></TableCell>
                          <TableCell className="font-medium">{g.no}. {g.name}{g.code && <span className="ml-1 font-mono text-xs text-muted-foreground">{g.code}</span>}</TableCell>
                          <TableCell className="text-sm">{g.detail}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{g.source}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {wo.status !== "Created" && <p className="text-sm text-muted-foreground">Checks shown as they stand now; the order was released on its activity date with revisions frozen.</p>}
                  {short.length > 0 && (
                    <div className="rounded-lg border p-4 text-sm">
                      <p className="font-semibold">Shortages with supply dates</p>
                      <ul className="mt-2 list-disc pl-6">
                        {short.map((x) => <li key={x.materialId}><span className="font-mono">{x.materialId}</span> {matDesc(x.materialId)}: need {qty(x.need)}, available {qty(x.available)}, short {qty(x.short)}{x.supply ? ` · supply ${x.supply} ${fmtDate(x.supplyDate)}` : " · no supply"}</li>)}
                      </ul>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">On release: reservations firm to the order, serial generated, traveler printable, dispatch entries created per operation. ETO multi-unit orders split one WO per serial.</p>
                </div>
              ),
            },
            {
              id: "ops", label: "Operations", count: wo.operations.length,
              content: (
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow><TableHead>Op</TableHead><TableHead>Work center</TableHead><TableHead>Text</TableHead><TableHead className="text-right">Std h</TableHead><TableHead className="text-right">Actual h</TableHead><TableHead>Start → finish</TableHead><TableHead>Good / scrap / rework</TableHead><TableHead>State</TableHead><TableHead /></TableRow>
                  </TableHeader>
                  <TableBody>
                    {wo.operations.map((o) => (
                      <TableRow key={o.no}>
                        <TableCell className="tabular">{o.no}</TableCell>
                        <TableCell><Link className="font-mono text-link" to={`/production/work-centers/${o.workCenterId}`}>{o.workCenterId}</Link></TableCell>
                        <TableCell className="max-w-80">
                          {o.text}
                          <span className="ml-1 inline-flex flex-wrap gap-1">
                            {o.qcGate && <Chip kind="flag" note="Operation cannot complete until its inspection passes">QC: {o.qcGate}</Chip>}
                            {o.milestone && <Marker note="Milestone confirmation reports progress">Milestone</Marker>}
                            {o.andon && <Chip kind="hold" note={`${o.andon.by} ${o.andon.at}`}>Andon: {o.andon.reason}</Chip>}
                          </span>
                        </TableCell>
                        <TableCell className="tabular text-right">{qty(opHours(o) * o.crew)}</TableCell>
                        <TableCell className="tabular text-right">{o.actualHours ? qty(o.actualHours) : ""}</TableCell>
                        <TableCell className="tabular text-xs">{fmtDate(o.start)} → {fmtDate(o.finish)}</TableCell>
                        <TableCell className="tabular">{o.status === "Completed" ? `${o.confirmedGood} / ${o.confirmedScrap} / ${o.confirmedRework}` : ""}</TableCell>
                        <TableCell className="text-sm">{o.status}{o.cancelledReason && <span className="block text-xs text-muted-foreground">{o.cancelledReason}</span>}{o.inspection && <span className="block text-xs text-muted-foreground">{o.inspection.id} {o.inspection.result ?? "requested"}</span>}{o.requiredSkill && <span className="block text-xs text-muted-foreground">Skill: {o.requiredSkill}</span>}</TableCell>
                        <TableCell>
                          {o.status === "Not Started" && !o.qcGate && act.isOpenWo(wo) && <Button size="sm" variant="ghost" onClick={() => setOpDlg({ kind: "cancelOp", no: o.no, note: "" })}>Cancel op</Button>}
                          {o.status === "Completed" && lastCnf?.op === o.no && act.isOpenWo(wo) && !wo.fgReceivedOn && !s.reversalRequests.some((r) => r.cnfId === lastCnf.id && r.status === "Awaiting second sign-off") && <Button size="sm" variant="ghost" onClick={() => setDec({ kind: "reversalRequest", cnfId: lastCnf.id })}>Request reversal of {lastCnf.id}</Button>}
                          {s.reversalRequests.filter((r) => r.woId === wo.id && r.status === "Awaiting second sign-off" && lastCnf?.op === o.no).map((r) => <Button key={r.id} size="sm" variant="outline" onClick={() => setDec({ kind: "reversalSign", requestId: r.id })}>Second sign-off {r.id}</Button>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ),
            },
            {
              id: "mat", label: "Materials",
              content: (
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow><TableHead>Op</TableHead><TableHead>Component</TableHead><TableHead>Issue</TableHead><TableHead className="text-right">Required</TableHead><TableHead className="text-right">Issued</TableHead><TableHead>Batches / serials</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {wo.operations.flatMap((o) => o.components.map((c) => (
                      <TableRow key={`${o.no}-${c.materialId}`}>
                        <TableCell className="tabular">{o.no}</TableCell>
                        <TableCell><Item id={c.materialId} /></TableCell>
                        <TableCell className="text-sm">{c.issue === "manual" ? "Scan (SP-08)" : "Backflush"}{c.serialized && " · serialized (SP-12)"}</TableCell>
                        <TableCell className="tabular text-right">{qty(c.qtyPerUnit * wo.qty)}</TableCell>
                        <TableCell className="tabular text-right">{qty(c.issued)}</TableCell>
                        <TableCell className="font-mono text-xs">{c.lots.join(", ") || (o.staged ? "kit staged" : "")}</TableCell>
                      </TableRow>
                    )))}
                  </TableBody>
                </Table>
              ),
            },
            {
              id: "cost", label: "Cost and WIP",
              content: (
                <div className="flex flex-col gap-4">
                  <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <KV k="Standard (order)">{fmtMoney(stdTotal(wo.costStd))}</KV>
                    <KV k="Material issued (#28)">{fmtMoney(wip.material)}</KV>
                    <KV k="Labor + overhead (#29)">{fmtMoney(wip.labor)}</KV>
                    <KV k="Subcontract (#35)">{fmtMoney(wip.subcontract)}</KV>
                    <KV k="Scrap (#30)">{fmtMoney(wip.scrap)}</KV>
                    <KV k="Rework merged (#33)">{fmtMoney(wip.rework)}</KV>
                    <KV k="FG receipt (#31)">{fmtMoney(wip.receipt)}</KV>
                    <KV k="WIP balance 1320 (live)"><span className="font-semibold">{fmtMoney(wip.total)}</span></KV>
                  </dl>
                  <p className="text-sm text-muted-foreground">Std rates: labor {fmtMoney(laborRateOf(wo.costStd))}/h, overhead {fmtMoney(ohRateOf(wo.costStd))}/h; std hours {qty(wo.costStd.hours)}, actual {qty(v.actHours)}.</p>
                  {wo.status === "Completed" && (
                    <PostingPreview title="Settlement preview (#32)" lines={[{ template: 32, amount: v.residual, detail: `5220 ${fmtMoney(v.mat)} · 5230 ${fmtMoney(v.lrv)} · 5240 ${fmtMoney(v.lev)} · 5250 ${fmtMoney(v.oav)}` }]} period={TODAY.slice(0, 7)} />
                  )}
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Journal</TableHead><TableHead>Template</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">WIP effect</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {journal.map((j) => (
                        <TableRow key={j.id}>
                          <TableCell className="font-mono text-xs">{j.id}</TableCell>
                          <TableCell className="tabular">{typeof j.template === "number" ? `#${j.template}` : j.template}</TableCell>
                          <TableCell className="tabular text-xs">{j.date}</TableCell>
                          <TableCell className="text-sm">{j.detail}</TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(j.amount)}</TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(j.wip1320)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ),
            },
            {
              id: "quality", label: "Inspections",
              content: (
                <div className="flex flex-col gap-3">
                  {wo.operations.filter((o) => o.qcGate).map((o) => (
                    <div key={o.no} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                      <span className="font-medium">Op {o.no} · {o.qcGate}</span>
                      <span className="text-muted-foreground">{o.inspection ? `${o.inspection.id} requested ${o.inspection.requestedOn}: ${o.inspection.result ?? "waiting for result"}${o.inspection.restriction ? `. Restriction: ${o.inspection.restriction} (${o.inspection.by})` : ""}` : "Not requested yet (Request Inspection at the terminal)"}</span>
                      {o.inspection && !o.inspection.result && (
                        <span className="ml-auto inline-flex gap-2">
                          <Chip kind="design" note="Stand-in until QM-INSP sends quality.inspectionClosed for production subjects (README request R-2)">Stand-in</Chip>
                          <Button size="sm" variant="outline" onClick={() => run((d, c) => act.recordInspection(d, c, wo.id, o.no, true), "Result posted: Passed")}>Post Pass</Button>
                          <Button size="sm" variant="outline" onClick={() => run((d, c) => act.recordInspection(d, c, wo.id, o.no, false), "Result posted: Failed; rework order opened")}>Post Fail</Button>
                          <Button size="sm" variant="outline" onClick={() => setOpDlg({ kind: "conditional", no: o.no, note: "" })} title={role !== "Quality Manager" ? "Quality Manager only" : undefined}>Conditional pass (Quality Manager)</Button>
                        </span>
                      )}
                    </div>
                  ))}
                  {rwos.length > 0 && (
                    <div className="text-sm">
                      <p className="font-semibold">Rework orders</p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {rwos.map((r) => <li key={r.id} className="flex items-center gap-2"><RefLink r={{ type: "reworkOrder", id: r.id }} /> <StatusBadge kind="reworkOrder" status={r.status} size="sm" /> {r.title}</li>)}
                      </ul>
                    </div>
                  )}
                  {s.ncrs.filter((n) => n.woId === wo.id).map((n) => <p key={n.id} className="text-sm"><span className="font-mono">{n.id}</span> {n.text}</p>)}
                  {cva.map((x) => <p key={x.id} className="text-sm"><span className="font-mono">{x.id}</span> CVA exception list: {x.text} ({fmtDate(x.raisedOn)})</p>)}
                </div>
              ),
            },
            {
              id: "gen", label: "Genealogy", count: gen.length,
              content: (
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Event</TableHead><TableHead>When</TableHead><TableHead>Op</TableHead><TableHead>Scan</TableHead><TableHead>Serial / batch</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {gen.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-mono text-xs">{g.code}</TableCell>
                        <TableCell className="tabular text-xs">{g.at.replace("T", " ")}</TableCell>
                        <TableCell className="tabular">{g.op ?? ""}</TableCell>
                        <TableCell className="font-mono text-xs">{g.scanPoint ?? ""}</TableCell>
                        <TableCell className="font-mono text-xs">{[g.serial, g.child && `← ${g.child}`, g.batch].filter(Boolean).join(" ")}</TableCell>
                        <TableCell className="text-sm">{g.text}{g.userId && <span className="text-muted-foreground"> · {userName(g.userId)}</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ),
            },
            { id: "act", label: "Activity", content: <ActivityList items={wo.activity} /> },
          ]}
        />
        <RulesPanel
          className="mt-6"
          rules={[
            ["§5.2", "Release runs six hard checks; shortages release only with the Planner's Release Short flag", "DOC:p.74 §5.2"],
            ["§5.3", "On Hold needs a reason; Cancelled is terminal and collected costs settle per Controller decision", "DOC:p.75 §5.3"],
            ["C-26", "The order stays Testing until Final Test passes or a scrap disposition is made; a scrap-disposed order closes without FG receipt", "erd-sketch C-26; DOC:p.78 §8.2"],
            ["§5.1", "Start and due dates: backward scheduling from the due date (forward from release on demand); late pegged orders auto-escalate priority; cost center per operation from its WC, profit center from the item", "DOC:p.74 §5.1"],
            ["FL-04", "Cancellation dispositions finish / stop-scrap / hold; confirmation correction by mirror reversal (supervisor)", "DOC:p.179 FL-04 f11"],
            ["§4", "A QC checkpoint completes after a pass, or a Quality Manager conditional pass with a restriction note", "DOC:p.73 §4"],
            ["§8.2", "Close is allowed when all ops are confirmed, inspections closed, FG received; settlement drives WIP to zero; reopen needs the Controller and reverses the settlement first", "DOC:p.78 §8.2"],
            ["Roles", "Release Short: Planner. Cancel with collected costs: Controller. Conditional pass: Quality Manager. Settlement: Cost accountant, not a confirmer. Cancel op: Production Scheduler or supervisor; reversal: supervisor. Other actions are not role-gated (ASM-PERM-1)", "DOC:p.73; p.74; p.75; p.179; p.263"],
          ]}
        />

        {dec && <WoDecisionDialog kind={dec.kind} wo={wo} cnfId={dec.cnfId} requestId={dec.requestId} open onOpenChange={(o) => !o && setDec(null)} />}
        <DialogShell open={dlg === "hold"} onOpenChange={(o) => !o && setDlg(null)} title={`Put ${wo.id} On Hold`} confirmLabel="Put On Hold" requireReason reasonLabel="Reason (mandatory): quality hold, ECO immediate effectivity, SO cancellation pending disposition, other"
          consequence={`${wo.id} goes ${wo.status} → On Hold. Terminal operations stop; the dispatch list flags it.`}
          onConfirm={(r) => runD((d, c) => act.holdWo(d, c, wo.id, r), `${wo.id} On Hold`)} />
        <DialogShell open={dlg === "unhold"} onOpenChange={(o) => !o && setDlg(null)} title={`Release the hold on ${wo.id}`} confirmLabel="Release hold" requireReason reasonLabel="What cleared the hold"
          consequence={`${wo.id} returns to ${wo.previousStatus ?? "Released"}.`}
          onConfirm={(r) => runD((d, c) => act.releaseHold(d, c, wo.id, r), "Hold released")} />
        <DialogShell open={dlg === "cancel"} onOpenChange={(o) => !o && setDlg(null)} title={`Cancel ${wo.id}`} confirmLabel={cancelKind === "Stop-scrap" ? "Stop and scrap" : cancelKind === "Finish" ? "Finish to stock" : "Put On Hold"} destructive={cancelKind === "Stop-scrap"} requireReason reasonLabel="Why (for example the SO cancellation reference)"
          consequence={cancelKind === "Stop-scrap" ? `${wo.id} becomes Cancelled (terminal); open operations are cancelled. ${Math.abs(wip.total) > 0.005 ? `${fmtMoney(wip.total)} of collected cost settles to 5320 per Controller decision.` : "No collected cost."} Reserved serials return to Available.` : cancelKind === "Finish" ? `${wo.id} is unpegged and runs to completion into FG stock; its status does not change.` : `${wo.id} goes On Hold: SO cancellation pending disposition.`}
          onConfirm={(r) => runD((d, c) => act.cancelWo(d, c, wo.id, cancelKind, r), cancelKind === "Stop-scrap" ? `${wo.id} cancelled` : cancelKind === "Finish" ? `${wo.id} unpegged; finishes to stock` : `${wo.id} On Hold`)}>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-semibold">Disposition [DOC:p.179 FL-04 f11]</legend>
            <RadioGroup value={cancelKind} onValueChange={(v) => setCancelKind(v as CancelDisposition)}>
              {([["Finish", "Finish: complete the unit into stock, unpegged", wo.status === "Created" || !wo.pegs.length], ["Stop-scrap", "Stop-scrap: cancel now; collected cost to scrap", false], ["Hold", "Hold: On Hold until the disposition is decided", wo.status === "On Hold"]] as const).map(([v, l, dis]) => (
                <label key={v} className="flex items-center gap-2"><RadioGroupItem value={v} aria-label={l} disabled={dis} />{l}</label>
              ))}
            </RadioGroup>
          </fieldset>
          {cancelKind === "Stop-scrap" && Math.abs(wip.total) > 0.005 && <PostingPreview lines={[{ template: 30, amount: wip.total, detail: "Residual WIP to scrap per Controller decision" }]} />}
        </DialogShell>
        <DialogShell open={dlg === "scrap"} onOpenChange={(o) => !o && setDlg(null)} title={`Scrap disposition for ${wo.id}`} confirmLabel="Scrap-dispose" destructive requireReason reasonLabel="Disposition reason (failed Final Test)"
          consequence={`Final Test failed: ${wo.id} leaves Testing by scrap disposition (C-26). ${fmtMoney(wip.total)} of WIP posts to 5320; open operations are cancelled; the order goes Completed and closes through settlement without FG receipt.`}
          onConfirm={(r) => runD((d, c) => act.scrapDisposeWo(d, c, wo.id, r), `${wo.id} scrap-disposed`)}>
          {Math.abs(wip.total) > 0.005 && <PostingPreview lines={[{ template: 30, amount: wip.total, detail: "Scrapped unit: residual WIP to 5320" }]} />}
        </DialogShell>
        <DialogShell open={!!opDlg} onOpenChange={(o) => !o && setOpDlg(null)}
          title={opDlg?.kind === "cancelOp" ? `Cancel op ${opDlg.no}` : opDlg?.kind === "reverse" ? `Reverse ${opDlg?.cnfId}` : `Conditional pass, op ${opDlg?.no}`}
          confirmLabel={opDlg?.kind === "cancelOp" ? "Cancel operation" : opDlg?.kind === "reverse" ? "Post mirror reversal" : "Conditional pass"}
          consequence={opDlg?.kind === "cancelOp" ? "The operation is cancelled (it counts as done for close) and the order is rescheduled. Production Scheduler or supervisor." : opDlg?.kind === "reverse" ? "Every posting of the confirmation is reversed with mirror entries (#28 backflush, #29, #30); a reversal confirmation is written and the operation goes back to In Progress. Supervisor action." : "The checkpoint clears with a restriction note that travels with the order. Quality Manager only."}
          onConfirm={() => runD((d, c) => (opDlg!.kind === "cancelOp" ? act.cancelOp(d, c, wo.id, opDlg!.no, opDlg!.note) : opDlg!.kind === "reverse" ? act.reverseConfirmation(d, c, opDlg!.cnfId!, opDlg!.note) : act.recordInspection(d, c, wo.id, opDlg!.no, "Conditional pass", "Quality Manager", opDlg!.note)), "Done")}>
          {opDlg && (
            <div className="grid gap-1">
              <Label htmlFor="op-note">{opDlg.kind === "conditional" ? "Restriction note (required)" : "Reason (required)"}</Label>
              <Textarea id="op-note" value={opDlg.note} onChange={(e) => setOpDlg({ ...opDlg, note: e.target.value })} />
            </div>
          )}
          {opDlg?.kind === "reverse" && <PostingPreview title="Mirror postings" lines={s.journal.filter((j) => j.cnfId === opDlg.cnfId).map((j) => ({ template: j.template as 28, amount: -j.amount, detail: `reverses ${j.id}` }))} />}
        </DialogShell>
        <DialogShell open={dlg === "receive"} onOpenChange={(o) => !o && setDlg(null)} title={`Receive ${wo.id} to stock`} confirmLabel="Post receipt"
          consequence={`Posts #31 for ${good} good × ${wo.itemId} at released standard to ${wo.pegs.length ? `STAGE-OUT, auto-reserved to ${wo.pegs[0].soId} line ${wo.pegs[0].line}` : "FG warehouse WH-TBD-01"}; status → Completed.`}
          onConfirm={() => runD((d, c) => act.receiveToStock(d, c, wo.id), `${wo.id} received; Completed`)}>
          {!wo.testPassed && <p className="text-sm text-destructive">Final Test has not passed: the receipt will be refused (C-26).</p>}
          <PostingPreview lines={[{ template: 31, amount: recvAmount, detail: `${good} × ${fmtMoney(stdTotal(wo.costStd) / wo.qty)}` }]} />
        </DialogShell>
        <DialogShell open={dlg === "close"} onOpenChange={(o) => !o && setDlg(null)} title={`Close ${wo.id}`} confirmLabel="Settle and close" confirmDisabled={!checks.every((c) => c.ok)}
          consequence={`Runs the settlement checks, posts #32 to clear ${fmtMoney(v.residual)} of WIP to the variance accounts and sets ${wo.id} to Closed (TECO). WIP becomes exactly zero.`}
          onConfirm={() => runD((d, c) => act.settleOrders(d, c, [wo.id]), (sid) => `${sid} posted; ${wo.id} Closed (TECO)`)}>
          <ul className="flex flex-col gap-1 text-sm">
            {checks.map((c) => <li key={c.name} className="flex items-center gap-2"><GateIcon state={c.ok ? "pass" : "fail"} />{c.name}{c.detail ? ` (${c.detail})` : ""}</li>)}
          </ul>
          <PostingPreview lines={[{ template: 32, amount: v.residual, detail: `5220 ${fmtMoney(v.mat)} · 5230 ${fmtMoney(v.lrv)} · 5240 ${fmtMoney(v.lev)} · 5250 ${fmtMoney(v.oav)}` }]} />
        </DialogShell>
        <Dialog open={dlg === "traveler"} onOpenChange={(o) => !o && setDlg(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Traveler · {wo.id}</DialogTitle>
              <DialogDescription>Shop packet per [DOC:p.75 §5.4]: cover, operation sheets, pick list, drawing list. Paper trail alongside the digital confirmations.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm">
              <section className="rounded-md border p-3">
                <p className="font-mono text-base">*{wo.id}*</p>
                <p>{wo.itemId} · {matDesc(wo.itemId)} · qty {wo.qty} · serial {wo.serials.join(", ") || "n/a"}</p>
                {wo.pegs[0] && <p>{wo.pegs[0].soId} line {wo.pegs[0].line} · {custName(s.promises.find((p) => p.doc.id === wo.pegs[0].soId)?.customerId ?? "")}</p>}
                <p>Dates {fmtDate(wo.start)} → {fmtDate(projected(wo))} · MBOM rev {wo.mbomRev} · routing {wo.routingId} rev {wo.routingRev}</p>
              </section>
              <section>
                <p className="font-semibold">Operation sheets</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {wo.operations.map((o) => <li key={o.no} className="font-mono text-xs">*{wo.id}/{o.no}* {o.workCenterId} {o.text} · std {qty(opHours(o))} h{o.qcGate ? ` · QC GATE ${o.qcGate}` : ""} · sign-off ____</li>)}
                </ul>
              </section>
              <section>
                <p className="font-semibold">Pick list</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {wo.operations.flatMap((o) => o.components.map((c) => <li key={`${o.no}${c.materialId}`} className="font-mono text-xs">op {o.no} · {c.materialId} × {qty(c.qtyPerUnit * wo.qty)}{c.serialized ? " · serial required" : " · batch required"}</li>))}
                </ul>
              </section>
              <section>
                <p className="font-semibold">Drawing list</p>
                <p className="text-xs text-muted-foreground">{wo.orderType === "ETO" ? "Released deliverables of the engineering request (see document flow)" : "Standard design drawings, released revisions"}</p>
              </section>
              <div className="flex gap-2">
                <Button onClick={() => window.print()}><Printer aria-hidden="true" /> Print</Button>
                <Button variant="outline" onClick={() => setDlg(null)}>Close</Button>
                <Button variant="ghost" onClick={() => nav(`/production/terminal?wc=${wo.operations.find((o) => o.status !== "Completed" && o.status !== "Cancelled")?.workCenterId ?? ""}`)}>Terminal view</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }
}
