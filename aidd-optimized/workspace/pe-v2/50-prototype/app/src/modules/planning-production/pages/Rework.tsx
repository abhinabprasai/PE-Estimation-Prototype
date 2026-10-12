// RWO-001 Rework Orders, list + detail [DOC:p.79 §9; p.263 Book VI] (asserted).
// Free-form operation list, ad-hoc materials, settlement receiver banner naming where costs land.
// Add operations; Complete with mandatory re-inspection when the origin demands it (test failure or
// RMA). Actuals only, collected in 1325 WIP-Rework; #21 / #22 / #33 per origin at settlement.

import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, KV, PostingPreview, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import type { DocRef, MaterialId, WorkCenterId } from "@/data/domain"
import { MATERIALS } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { ActivityList, BodyState, Item, RefLink, StatePreview, qty, useAct, useActDialog, useScreenState } from "../components"
import * as act from "../lib/actions"
import { allWorkCenters } from "../lib/plan"
import type { PPReworkOrder } from "../data/types"

const ORIGINS = Object.keys(act.RECEIVER) as PPReworkOrder["originKind"][]
const settleTemplate = (r: PPReworkOrder) => (r.parentWoId && ["Production rework", "Test failure", "NCR disposition"].includes(r.originKind) ? 33 : r.originKind === "RMA warranty" ? 21 : r.originKind === "RMA billable" ? 22 : null)

export function ReworkList() {
  const s = useSlice("planningProduction")
  const st = useScreenState("RWO-001")
  const nav = useNavigate()
  const runD = useActDialog()
  const [dlg, setDlg] = useState(false)
  const [f, setF] = useState({ originKind: "Production rework" as PPReworkOrder["originKind"], originId: "WO-2026-00405", parentWoId: "WO-2026-00405", itemId: "FIN-TBD-2500PM", qty: "1", title: "" })
  const rows = st.empty ? [] : s.reworkOrders
  const cols: Column<PPReworkOrder>[] = [
    { id: "id", header: "Rework order", value: (r) => r.id, mono: true, sortable: true },
    { id: "title", header: "Title", value: (r) => r.title },
    { id: "origin", header: "Origin", value: (r) => r.origin.id, cell: (r) => <span className="flex flex-col"><RefLink r={r.origin} /><span className="text-xs text-muted-foreground">{r.originKind}</span></span> },
    { id: "kind", header: "Origin kind", value: (r) => r.originKind, filterable: true },
    { id: "item", header: "Item / serial", value: (r) => r.itemId, cell: (r) => <span className="flex flex-col"><Item id={r.itemId} short />{r.serial && <span className="font-mono text-xs text-muted-foreground">{r.serial}</span>}</span> },
    { id: "rcv", header: "Settlement receiver", value: (r) => r.receiver, cell: (r) => <span className="text-sm">{r.receiver}</span> },
    { id: "bal", header: "1325 balance", value: (r) => act.rwoBalance(s, r.id), align: "right", sortable: true, cell: (r) => <span className="tabular">{fmtMoney(act.rwoBalance(s, r.id))}</span> },
    { id: "re", header: "Re-inspection", value: (r) => r.reinspection, filterable: true, cell: (r) => (r.reinspection === "required" ? <Chip kind="flag" note="Mandatory before Complete">{r.reinspectionResult ?? "required"}</Chip> : <span className="text-muted-foreground">not required</span>) },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, sortable: true, cell: (r) => <StatusBadge kind="reworkOrder" status={r.status} size="sm" /> },
  ]
  return (
    <>
      <ListPage<PPReworkOrder>
        header={{
          title: "Rework orders",
          screenId: "RWO-001",
          description: "Repairs from terminal rework quantities, test failures, NCR dispositions and RMA repairs. No standard cost: actuals collect in 1325 WIP-Rework and settle to the receiver on close.",
          primary: <Button onClick={() => setDlg(true)}>New rework order</Button>,
        }}
        table={{
          rows, columns: cols, rowId: (r) => r.id, rowHref: (r) => `/production/rework/${r.id}`, searchText: (r) => `${r.id} ${r.title} ${r.origin.id} ${r.parentWoId ?? ""} ${r.serial ?? ""}`,
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "id", dir: "desc" },
          empty: { title: "No rework orders", body: "They open from terminal rework quantities, test failures, NCR dispositions and RMA repairs." },
        }}
      />
      <DialogShell open={dlg} onOpenChange={setDlg} title="New rework order" confirmLabel="Create rework order"
        consequence={`Creates RWO-2026-nnnn linked to ${f.originId}; costs will settle to: ${act.RECEIVER[f.originKind]}.`}
        onConfirm={() => {
          const t = f.originKind.startsWith("RMA") ? "rma" : f.originKind.startsWith("NCR") ? "ncr" : "productionOrder"
          let id = ""
          const e = runD((d, c) => void (id = act.createRwo(d, c, { originKind: f.originKind, origin: { type: t, id: f.originId } as DocRef, parentWoId: f.originKind.startsWith("RMA") || f.originKind === "NCR vendor-caused" ? undefined : f.parentWoId, itemId: f.itemId, qty: Number(f.qty), title: f.title })), "Rework order created")
          if (!e) nav(`/production/rework/${id}`)
          return e
        }}>
        <div className="grid gap-2">
          <Label>Origin</Label>
          <Select value={f.originKind} onValueChange={(v) => setF({ ...f, originKind: v as PPReworkOrder["originKind"] })}>
            <SelectTrigger aria-label="Origin kind"><SelectValue /></SelectTrigger>
            <SelectContent>{ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
          <Label htmlFor="rw-origin">Origin document (WO, NCR or RMA)</Label>
          <Input id="rw-origin" value={f.originId} onChange={(e) => setF({ ...f, originId: e.target.value })} />
          {!f.originKind.startsWith("RMA") && f.originKind !== "NCR vendor-caused" && (
            <>
              <Label>Parent production order</Label>
              <Select value={f.parentWoId} onValueChange={(v) => setF({ ...f, parentWoId: v, itemId: s.productionOrders.find((w) => w.id === v)?.itemId ?? f.itemId })}>
                <SelectTrigger aria-label="Parent WO"><SelectValue /></SelectTrigger>
                <SelectContent>{s.productionOrders.filter((w) => act.isOpenWo(w)).map((w) => <SelectItem key={w.id} value={w.id}>{w.id} · {w.itemId}</SelectItem>)}</SelectContent>
              </Select>
            </>
          )}
          <Label htmlFor="rw-qty">Quantity</Label>
          <Input id="rw-qty" type="number" min={1} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
          <Label htmlFor="rw-title">Title</Label>
          <Input id="rw-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
      </DialogShell>
    </>
  )
}

export function ReworkDetail() {
  const { id = "" } = useParams()
  const s = useSlice("planningProduction")
  const st = useScreenState("RWO-002")
  const run = useAct()
  const runD = useActDialog()
  const [dlg, setDlg] = useState<null | "op" | "mat" | "settle" | "complete">(null)
  const [op, setOp] = useState({ wc: "WC-400", text: "", hours: "2" })
  const [mat, setMat] = useState({ materialId: "RAW-TBD-KRAFT", qty: "1", lot: "" })
  const r = s.reworkOrders.find((x) => x.id === id)
  return (
    <BodyState state={st} found={!!r} what={`Rework order ${id}`} back={{ to: "/production/rework", label: "Back to rework orders" }}>
      {r && detail(r)}
    </BodyState>
  )
  function detail(r: PPReworkOrder) {
    const bal = act.rwoBalance(s, r.id)
    const tpl = settleTemplate(r)
    const allDone = r.ops.length > 0 && r.ops.every((o) => o.done)
    const settled = r.status === "Settled"
    const journal = s.journal.filter((j) => j.source.id === r.id || j.rwoId === r.id)
    let primary = null
    if (r.status === "Completed") primary = <Button onClick={() => setDlg("settle")}>Settle to receiver</Button>
    else if (!settled && allDone && (r.reinspection === "not required" || r.reinspectionResult === "Passed")) primary = <Button onClick={() => setDlg("complete")}>Complete</Button>
    else if (!settled && allDone && r.reinspection === "required" && !r.reinspectionRequestedOn) primary = <Button onClick={() => run((d, c) => act.requestReinspection(d, c, r.id), "Re-inspection requested")}>Request re-inspection</Button>
    const primaryIsAddOp = !primary && !settled
    if (primaryIsAddOp) primary = <Button onClick={() => setDlg("op")}>Add operation</Button>
    return (
      <>
        <DetailPage
          header={{
            title: `${r.id} · ${r.title}`,
            screenId: "RWO-001",
            crumbs: [{ label: "Rework orders", to: "/production/rework" }, { label: r.id }],
            chips: r.reinspection === "required" ? <Chip kind="flag" note="Mandatory before Complete when the origin is a test failure or an RMA">Re-inspection {r.reinspectionResult ?? (r.reinspectionRequestedOn ? "requested" : "required")}</Chip> : undefined,
            description: `Settlement receiver: ${r.receiver}. Costs collect in 1325 WIP-Rework (actuals only, no standard) and land there on settlement.`,
            primary,
            actions: !settled && r.status !== "Completed" ? (
              <>
                {!primaryIsAddOp && <Button variant="outline" onClick={() => setDlg("op")}>Add operation</Button>}
                <Button variant="outline" onClick={() => setDlg("mat")}>Add material</Button>
              </>
            ) : undefined,
          }}
          status={{ kind: "reworkOrder", value: r.status }}
          doc={{ type: "reworkOrder", id: r.id }}
          summary={
            <>
              <KV k="Origin">{r.originKind}: <RefLink r={r.origin} />{r.originOp ? ` op ${r.originOp}` : ""}</KV>
              <KV k="Parent WO">{r.parentWoId ? <RefLink r={{ type: "productionOrder", id: r.parentWoId }} /> : "none"}</KV>
              <KV k="Item / serial">{r.itemId}{r.serial ? ` · ${r.serial}` : ""} × {r.qty}</KV>
              <KV k="1325 balance">{fmtMoney(bal)}</KV>
              <KV k="Labor rate (actual)">{fmtMoney(r.laborRate)}/h</KV>
              <KV k="Created">{fmtDate(r.createdOn)}</KV>
              <KV k="Settled">{r.settledOn ? fmtDate(r.settledOn) : "not yet"}</KV>
            </>
          }
          tabs={[
            {
              id: "ops", label: "Operations", count: r.ops.length,
              content: (
                <div className="flex flex-col gap-3">
                  <p className="rounded-md border px-4 py-2 text-sm">Costs land in: <span className="font-semibold">{r.receiver}</span>{tpl ? ` (template #${tpl})` : " (no template number in the posting table)"}</p>
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Op</TableHead><TableHead>Work center</TableHead><TableHead>Text</TableHead><TableHead className="text-right">Hours</TableHead><TableHead className="text-right">Cost</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {r.ops.map((o) => (
                        <TableRow key={o.no}>
                          <TableCell className="tabular">{o.no}</TableCell>
                          <TableCell className="font-mono text-xs">{o.workCenterId}</TableCell>
                          <TableCell>{o.text}</TableCell>
                          <TableCell className="tabular text-right">{qty(o.hours)}</TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(o.hours * r.laborRate)}</TableCell>
                          <TableCell>{o.done ? <span className="text-sm text-muted-foreground">Confirmed</span> : !settled && <Button size="sm" variant="outline" onClick={() => run((d, c) => act.confirmRwoOp(d, c, r.id, o.no), `Op ${o.no} confirmed; cost to 1325`)}>Confirm</Button>}</TableCell>
                        </TableRow>
                      ))}
                      {!r.ops.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No operations yet: add them as needed from any work center.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                  {r.reinspection === "required" && r.reinspectionRequestedOn && !r.reinspectionResult && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                      Re-inspection requested {r.reinspectionRequestedOn}: waiting for Quality.
                      <Chip kind="design" note="Stand-in until QM-INSP sends quality.inspectionClosed for rework subjects (README request R-2)">Stand-in</Chip>
                      <Button size="sm" variant="outline" onClick={() => run((d, c) => act.recordReinspection(d, c, r.id, true), "Re-inspection passed")}>Post Pass</Button>
                      <Button size="sm" variant="outline" onClick={() => run((d, c) => act.recordReinspection(d, c, r.id, false), "Re-inspection failed")}>Post Fail</Button>
                    </div>
                  )}
                </div>
              ),
            },
            {
              id: "mat", label: "Materials", count: r.materials.length,
              content: (
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Lot</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.materials.map((m, i) => <TableRow key={i}><TableCell><Item id={m.materialId} /></TableCell><TableCell className="tabular text-right">{qty(m.qty)}</TableCell><TableCell className="font-mono text-xs">{m.lot}</TableCell><TableCell className="tabular text-right">{fmtMoney(m.value)}</TableCell></TableRow>)}
                    {!r.materials.length && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No ad-hoc material yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              ),
            },
            {
              id: "cost", label: "Cost collection", count: journal.length,
              content: (
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Journal</TableHead><TableHead>Template</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead><TableHead className="text-right">1325 effect</TableHead></TableRow></TableHeader>
                  <TableBody>{journal.map((j) => <TableRow key={j.id}><TableCell className="font-mono text-xs">{j.id}</TableCell><TableCell>{typeof j.template === "number" ? `#${j.template}` : "collection"}</TableCell><TableCell className="tabular text-xs">{j.date}</TableCell><TableCell className="text-sm">{j.detail}</TableCell><TableCell className="tabular text-right">{fmtMoney(j.wip1325)}</TableCell></TableRow>)}</TableBody>
                </Table>
              ),
            },
            { id: "act", label: "Activity", content: <ActivityList items={r.activity} /> },
          ]}
        />
        <RulesPanel className="mt-6" rules={[
          ["§9", "Created from op completion (rework qty), Final Test failure, NCR disposition Rework, or RMA disposition Repair; RWO-{YYYY}-{SEQ:4}", "DOC:p.79 §9"],
          ["§9", "Receivers: production rework → parent WO before its settlement; RMA warranty → 2610 (overflow 6300); RMA billable → 5130; NCR vendor-caused → 1355 with a recovery agreement, else 5320", "DOC:p.79 §9"],
          ["§9", "Open → In Progress → Completed → Settled; re-inspection mandatory before Complete when the origin is a test failure or RMA", "DOC:p.79 §9"],
        ]} />
        <DialogShell open={dlg === "op"} onOpenChange={(o) => !o && setDlg(null)} title="Add operation" confirmLabel="Add operation"
          onConfirm={() => runD((d, c) => act.addRwoOp(d, c, r.id, op.wc as WorkCenterId, op.text, Number(op.hours)), "Operation added")}>
          <div className="grid gap-2">
            <Label>Work center</Label>
            <Select value={op.wc} onValueChange={(v) => setOp({ ...op, wc: v })}>
              <SelectTrigger aria-label="Work center"><SelectValue /></SelectTrigger>
              <SelectContent>{allWorkCenters(s).filter((w) => w.status !== "Inactive").map((w) => <SelectItem key={w.id} value={w.id}>{w.id} {w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label htmlFor="rwo-text">Description</Label>
            <Input id="rwo-text" value={op.text} onChange={(e) => setOp({ ...op, text: e.target.value })} />
            <Label htmlFor="rwo-h">Hours (actual)</Label>
            <Input id="rwo-h" type="number" min={0} step="0.5" value={op.hours} onChange={(e) => setOp({ ...op, hours: e.target.value })} />
          </div>
        </DialogShell>
        <DialogShell open={dlg === "mat"} onOpenChange={(o) => !o && setDlg(null)} title="Add ad-hoc material" confirmLabel="Add material"
          consequence="Collects the material value in 1325 WIP-Rework at valuation."
          onConfirm={() => runD((d, c) => act.addRwoMaterial(d, c, r.id, mat.materialId as MaterialId, Number(mat.qty), mat.lot || undefined), "Material added")}>
          <div className="grid gap-2">
            <Label>Material</Label>
            <Select value={mat.materialId} onValueChange={(v) => setMat({ ...mat, materialId: v })}>
              <SelectTrigger aria-label="Material"><SelectValue /></SelectTrigger>
              <SelectContent>{MATERIALS.filter((m) => ["RAW", "CONS", "SPARE", "PACK"].includes(m.type) && m.stdCost).map((m) => <SelectItem key={m.id} value={m.id}>{m.id} · {m.description}</SelectItem>)}</SelectContent>
            </Select>
            <Label htmlFor="rwm-q">Quantity</Label>
            <Input id="rwm-q" type="number" min={0} value={mat.qty} onChange={(e) => setMat({ ...mat, qty: e.target.value })} />
            <Label htmlFor="rwm-l">Batch / serial (optional)</Label>
            <Input id="rwm-l" value={mat.lot} onChange={(e) => setMat({ ...mat, lot: e.target.value })} />
          </div>
        </DialogShell>
        <DialogShell open={dlg === "complete"} onOpenChange={(o) => !o && setDlg(null)} title={`Complete ${r.id}`} confirmLabel="Complete"
          consequence={`${r.id} goes ${r.status} → Completed. It then settles to ${r.receiver}.`}
          onConfirm={() => runD((d, c) => act.completeRwo(d, c, r.id), `${r.id} Completed`)} />
        <DialogShell open={dlg === "settle"} onOpenChange={(o) => !o && setDlg(null)} title={`Settle ${r.id}`} confirmLabel="Post settlement"
          consequence={`Moves ${fmtMoney(bal)} out of 1325 WIP-Rework to ${r.receiver}; ${r.id} becomes Settled (read-only).`}
          onConfirm={() => runD((d, c) => act.settleRwo(d, c, r.id), `${r.id} Settled`)}>
          {tpl ? <PostingPreview lines={[{ template: tpl, amount: bal, detail: r.receiver }]} /> : <p className="text-sm">Vendor-caused: 1355 vendor claim receivable when a recovery agreement exists, else 5320. No template number in the posting table.</p>}
        </DialogShell>
      </>
    )
  }
}
