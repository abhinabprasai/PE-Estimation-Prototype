// STO-001 Stock Transport Orders (Book IX §4.3, target state, after DEC-07) [DOC:p.283]: planners
// create, warehouses execute. Path Created, Released, Issued, In Transit, Received, Closed; issue and
// receipt are scanned with SP-06 (item/batch/serial + bin) and the value rides in bucket 1350 In
// transit between the two. Lanes (MP-LANE-001) gate creation: an inactive lane raises EX-10.
// The status list is not in the catalog (S-1..S-43), so the words show as text (OQ-21 pattern).

import { useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, KV, RulesPanel, ScanField, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import type { ISODate, MaterialId } from "@/data/domain"
import { MATERIALS, TODAY } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { AccessNote, ActivityList, BodyState, Item, StateBanner, StatePreview, matDesc, qty, useAct, useActDialog, useScreenState } from "../components"
import * as ext from "../lib/actions-ext"
import { NETWORK_PLANTS, STO_PATH, type TransferLane, type TransportOrder } from "../data/extra"

const plant = (id: string) => NETWORK_PLANTS.find((p) => p.id === id)?.name ?? id
const Status = ({ s }: { s: string }) => <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">{s}</span>
const Prio = ({ p }: { p: TransportOrder["priority"] }) => (p === "Normal" ? <span>{p}</span> : <Chip kind="flag" note={`${p} priority`}>{p}</Chip>)

export function StoList() {
  const s = useSlice("planningProduction")
  const st = useScreenState("STO-001")
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const [dlg, setDlg] = useState(false)
  const [form, setForm] = useState({ laneId: "LN-TBD-01", priority: "Normal" as TransportOrder["priority"], requiredBy: "2026-10-30", lines: [{ materialId: "" as string, qty: "", uom: "EA" }] })
  const [lanes, setLanes] = useState(false)
  const can = ext.STO_PLANNER_ROLES.includes(role as never) && !st.readOnly
  const rows = st.empty ? [] : s.transportOrders
  const columns: Column<TransportOrder>[] = [
    { id: "id", header: "Transport order", value: (t) => t.id, sortable: true, mono: true },
    { id: "route", header: "From → to", value: (t) => `${t.fromPlant} → ${t.toPlant}`, cell: (t) => <span className="text-xs">{plant(t.fromPlant)} → {plant(t.toPlant)}</span> },
    { id: "lane", header: "Lane", value: (t) => t.laneId, filterable: true, mono: true },
    { id: "prio", header: "Priority", value: (t) => t.priority, filterable: true, cell: (t) => <Prio p={t.priority} /> },
    { id: "lines", header: "Lines", value: (t) => t.lines.length, align: "right", mono: true },
    { id: "req", header: "Required by", value: (t) => t.requiredBy, sortable: true, cell: (t) => <span className={t.requiredBy < TODAY && !["Received", "Closed"].includes(t.status) ? "text-status-exception-ink" : undefined}>{fmtDate(t.requiredBy)}</span> },
    { id: "val", header: "In transit (1350)", value: (t) => t.transitValue, align: "right", mono: true, cell: (t) => (t.transitValue ? fmtMoney(t.transitValue) : "") },
    { id: "status", header: "Status", value: (t) => t.status, filterable: true, sortable: true, cell: (t) => <Status s={t.status} /> },
  ]
  const laneOf = (id: string) => s.lanes.find((l) => l.id === id)
  const submit = () =>
    runD((d, c) => ext.createSto(d, c, { laneId: form.laneId, priority: form.priority, requiredBy: form.requiredBy as ISODate, lines: form.lines.filter((l) => l.materialId || l.qty).map((l) => ({ materialId: l.materialId as MaterialId, qty: Number(l.qty), uom: l.uom })) }), (id) => `${id} created`)
  const inactive = s.lanes.filter((l) => !l.active)
  return (
    <>
      <ListPage<TransportOrder>
        header={{
          title: "Stock transport orders",
          screenId: "STO-001",
          description: "Planners create transfers between plants; warehouses issue and receive them with a scan. Stock rides in bucket 1350 In transit until receipt.",
          chips: <Chip kind="design" note="Target state, live at activation after DEC-07 (Book IX §4.3). The shared masters hold one plant, so the second and third plants are design plants">Target state (DEC-07)</Chip>,
          primary: <Button disabled={!can} title={!can ? "Planners create transport orders" : undefined} onClick={() => setDlg(true)}>New transport order</Button>,
          actions: <><Button variant="outline" onClick={() => setLanes((v) => !v)}>{lanes ? "Hide lanes" : `Lanes (${s.lanes.length})`}</Button><StatePreview extended /></>,
        }}
        above={
          <>
            <StateBanner st={st} />
            <AccessNote roles={ext.STO_PLANNER_ROLES} role={role} what="Creating and releasing transport orders" />
            {inactive.length > 0 && <p role="status" className="mb-4 rounded-md border border-status-pending bg-status-pending-tint px-4 py-2 text-sm"><strong>EX-10.</strong> {inactive.map((l) => `${l.id} (${l.from} → ${l.to})`).join(", ")} is inactive: network demand through it cannot be placed. Reactivate it in the lane list to clear the exception.</p>}
            {lanes && (
              <section aria-label="Transfer lanes" className="mb-4 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-table-head"><TableRow>{["Lane", "From", "To", "Direction", "Mode", "Transit", "Calendar", "Cost / kg", "State", ""].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {s.lanes.map((l: TransferLane) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.id}</TableCell><TableCell className="text-xs">{plant(l.from)}</TableCell><TableCell className="text-xs">{plant(l.to)}</TableCell>
                        <TableCell className="text-xs">{l.direction}</TableCell><TableCell>{l.mode}</TableCell><TableCell className="tabular">{l.transitDays} d</TableCell><TableCell className="text-xs">{l.calendar}</TableCell>
                        <TableCell className="tabular">{l.costPerKg.toFixed(2)}</TableCell><TableCell>{l.active ? "Active" : "Inactive"}</TableCell>
                        <TableCell><Button size="sm" variant="ghost" disabled={st.readOnly} onClick={() => run((d, c) => ext.setLaneActive(d, c, l.id, !l.active), l.active ? `${l.id} deactivated` : `${l.id} reactivated`)}>{l.active ? "Deactivate" : "Reactivate"}</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">Lane values are seeded design values; the lane master is MP-LANE-001 (Planning Manager). An item supplied by a plant without a valid production version cannot be sourced there (EX-10).</p>
              </section>
            )}
          </>
        }
        table={{
          rows, columns, rowId: (t) => t.id, rowHref: (t) => `/production/transport-orders/${t.id}`,
          searchText: (t) => `${t.id} ${t.laneId} ${t.lines.map((l) => `${l.materialId} ${matDesc(l.materialId)}`).join(" ")}`, searchPlaceholder: "Search order, lane, material",
          loading: st.loading, error: st.error, onRetry: st.retry, densityKey: "STO-001", initialSort: { id: "req", dir: "asc" },
          empty: { title: "No transport orders", body: "Create one for a plant that is short, or accept a network MRP proposal." },
        }}
        below={
          <RulesPanel rules={[
            ["STO-001", "Planners create; warehouses execute: issue and receive are scanned (SP-06)", "DOC:p.283 Book IX §4.3"],
            ["Path", "Created, Released, Issued, In Transit, Received, Closed", "DOC:p.283"],
            ["Valuation", "Stock moves to bucket 1350 In transit at issue and out of it at receipt", "DOC:p.283"],
            ["EX-10", "A lane that is inactive, or a source plant without a valid production version, raises EX-10", "DOC:p.283 Book IX §4.4"],
          ]} />
        }
      />
      <DialogShell open={dlg} onOpenChange={setDlg} wide title="New transport order" confirmLabel="Create transport order"
        consequence={`Creates a Created order on lane ${form.laneId}${laneOf(form.laneId) ? ` (${laneOf(form.laneId)!.transitDays} transit days)` : ""}. It moves stock only after Release, issue and receipt.`}
        onConfirm={() => submit()}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1"><Label>Lane</Label>
            <Select value={form.laneId} onValueChange={(v) => setForm({ ...form, laneId: v })}><SelectTrigger aria-label="Lane"><SelectValue /></SelectTrigger><SelectContent>{s.lanes.map((l) => <SelectItem key={l.id} value={l.id}>{l.id} {l.from} → {l.to}{l.active ? "" : " (inactive)"}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1"><Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TransportOrder["priority"] })}><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger><SelectContent>{["Normal", "High", "Critical"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1"><Label htmlFor="sto-req">Required by</Label><Input id="sto-req" type="date" value={form.requiredBy} onChange={(e) => setForm({ ...form, requiredBy: e.target.value })} /></div>
        </div>
        <div className="flex flex-col gap-2">
          {form.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_96px_72px_auto] items-end gap-2">
              <div className="grid gap-1"><Label>Material, line {(i + 1) * 10}</Label>
                <Select value={l.materialId} onValueChange={(v) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, materialId: v, uom: MATERIALS.find((m) => m.id === v)?.baseUom ?? "EA" } : x)) })}>
                  <SelectTrigger aria-label="Material"><SelectValue placeholder="Choose material" /></SelectTrigger>
                  <SelectContent>{MATERIALS.filter((m) => m.type === "RAW" || m.type === "SEMI" || m.type === "CONS").slice(0, 40).map((m) => <SelectItem key={m.id} value={m.id}>{m.id} · {m.description}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid gap-1"><Label>Quantity</Label><Input inputMode="decimal" value={l.qty} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} /></div>
              <span className="pb-2 text-sm">{l.uom}</span>
              <Button variant="ghost" size="sm" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>Remove</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setForm({ ...form, lines: [...form.lines, { materialId: "", qty: "", uom: "EA" }] })}>Add line</Button>
        </div>
      </DialogShell>
    </>
  )
}

export function StoDetail() {
  const { id = "" } = useParams()
  const s = useSlice("planningProduction")
  const st = useScreenState("STO-001")
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const [dlg, setDlg] = useState<null | "short">(null)
  const [pick, setPick] = useState<{ no: number; mode: "issue" | "receive" } | null>(null)
  const [q, setQ] = useState("")
  const t = s.transportOrders.find((x) => x.id === id)
  const planner = ext.STO_PLANNER_ROLES.includes(role as never)
  const wh = ext.STO_WAREHOUSE_ROLES.includes(role as never)
  const ro = st.readOnly
  return (
    <BodyState state={st} found={!!t} what={`Transport order ${id}`} back={{ to: "/production/transport-orders", label: "Back to transport orders" }}>
      {t && (
        <>
          <DetailPage
            header={{
              title: `${t.id} · ${plant(t.fromPlant)} → ${plant(t.toPlant)}`, screenId: "STO-001",
              crumbs: [{ label: "Transport orders", to: "/production/transport-orders" }, { label: t.id }],
              chips: <><Status s={t.status} /><Chip kind="design" note="Target state, live at activation after DEC-07">Target state</Chip>{t.priority !== "Normal" && <Prio p={t.priority} />}</>,
              description: t.shortCloseReason ? `Short closed: ${t.shortCloseReason}` : `Required by ${fmtDate(t.requiredBy)} on lane ${t.laneId}. ${t.source}.`,
              primary: t.status === "Created" ? <Button disabled={!planner || ro} title={!planner ? "Planners release" : undefined} onClick={() => run((d, c) => ext.releaseSto(d, c, t.id), `${t.id} released`)}>Release</Button>
                : t.status === "Issued" ? <Button disabled={!wh || ro} title={!wh ? "Warehouses hand over to the carrier" : undefined} onClick={() => run((d, c) => ext.handToCarrier(d, c, t.id), "Handed to the carrier")}>Hand to carrier</Button>
                : t.status === "Received" ? <Button disabled={ro} onClick={() => run((d, c) => ext.closeSto(d, c, t.id), `${t.id} closed`)}>Close</Button> : undefined,
              actions: <>
                <StatePreview extended />
                {["Issued", "In Transit"].includes(t.status) && <Button variant="outline" disabled={!planner || ro} onClick={() => setDlg("short")}>Short close</Button>}
              </>,
            }}
            summary={<>
              <KV k="Lane">{t.laneId}</KV><KV k="Priority">{t.priority}</KV><KV k="Created">{fmtDate(t.createdOn)}</KV>
              <KV k="Issued">{t.issuedOn ? fmtDate(t.issuedOn) : "not yet"}</KV><KV k="Received">{t.receivedOn ? fmtDate(t.receivedOn) : "not yet"}</KV>
              <KV k="In transit value (1350)">{t.transitValue ? fmtMoney(t.transitValue) : "none"}</KV>
            </>}
            tabs={[
              {
                id: "lines", label: "Lines", count: t.lines.length,
                content: (
                  <div className="flex flex-col gap-4">
                    <StateBanner st={st} />
                    <AccessNote roles={[...ext.STO_PLANNER_ROLES, ...ext.STO_WAREHOUSE_ROLES]} role={role} what="Working a transport order" />
                    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Status path">
                      {STO_PATH.map((p, i) => <li key={p} className={`rounded-md border px-2 py-1 ${p === t.status ? "bg-secondary font-semibold" : i < ext.stoStep(t.status) ? "text-muted-foreground" : ""}`}>{i + 1}. {p}</li>)}
                    </ol>
                    <Table>
                      <TableHeader className="bg-table-head"><TableRow>{["Line", "Material", "Quantity", "Issued", "Received", "Batch / serial", ""].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                      <TableBody>
                        {t.lines.map((l) => (
                          <TableRow key={l.no}>
                            <TableCell className="tabular">{l.no}</TableCell><TableCell><Item id={l.materialId} /></TableCell>
                            <TableCell className="tabular">{qty(l.qty)} {l.uom}</TableCell><TableCell className="tabular">{qty(l.issuedQty)}</TableCell><TableCell className="tabular">{qty(l.receivedQty)}</TableCell>
                            <TableCell className="font-mono text-xs">{l.lots.join(", ") || "none yet"}</TableCell>
                            <TableCell className="text-right">
                              {t.status === "Released" || (t.status === "Issued" && l.issuedQty < l.qty) ? <Button size="sm" variant="outline" disabled={!wh || ro} title={!wh ? "Warehouses issue" : undefined} onClick={() => (setPick({ no: l.no, mode: "issue" }), setQ(String(l.qty - l.issuedQty)))}>Issue (SP-06)</Button> : null}
                              {["Issued", "In Transit"].includes(t.status) && l.receivedQty < l.issuedQty ? <Button size="sm" variant="outline" disabled={!wh || ro} title={!wh ? "Warehouses receive" : undefined} onClick={() => (setPick({ no: l.no, mode: "receive" }), setQ(String(l.issuedQty - l.receivedQty)))}>Receive (SP-06)</Button> : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground">Issue: DR 1350 In transit, CR the source stock account. Receipt: DR the destination stock account, CR 1350. The entries follow the in-transit rule of Book IX §4.3; the catalog has no template number for them.</p>
                  </div>
                ),
              },
              { id: "activity", label: "Activity", content: <ActivityList items={t.activity} /> },
            ]}
            doc={undefined}
          />
          <DialogShell open={!!pick} onOpenChange={(o) => !o && setPick(null)} title={pick?.mode === "issue" ? `Issue line ${pick?.no}` : `Receive line ${pick?.no}`} confirmLabel="Close" onConfirm={() => null}
            consequence={pick?.mode === "issue" ? "Scan the batch or serial label (SP-06) and set the quantity. The value moves to 1350 In transit." : "Scan the batch or serial that was issued (SP-06). The value leaves 1350 for the destination stock."}>
            {pick && (
              <>
                <div className="grid max-w-40 gap-1"><Label htmlFor="sto-q">Quantity</Label><Input id="sto-q" inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <ScanField scanPoint="SP-06" expected={pick.mode === "issue" ? `the batch or serial of line ${pick.no} (BAT-TBD-... or SN-TBD-...)` : `a batch or serial issued on line ${pick.no}: ${t.lines.find((l) => l.no === pick.no)?.lots.join(", ") ?? ""}`}
                  onScan={(code) => {
                    const r = runD((d, c) => (pick.mode === "issue" ? ext.issueStoLine(d, c, t.id, pick.no, code, Number(q)) : ext.receiveStoLine(d, c, t.id, pick.no, code, Number(q))), pick.mode === "issue" ? "Issued" : "Received")
                    return r ? { ok: false, expected: pick.mode === "issue" ? "a valid batch or serial of this material" : "a lot issued on this line", next: "Check the label and the quantity, then scan again", message: r } : { ok: true, message: `${code} ${pick.mode === "issue" ? "issued" : "received"}` }
                  }} />
              </>
            )}
          </DialogShell>
          <DialogShell open={dlg === "short"} onOpenChange={(o) => !o && setDlg(null)} title={`Short close ${t.id}`} confirmLabel="Short close" destructive requireReason reasonLabel="Why the open quantity will not arrive"
            consequence={`The order closes with ${t.lines.reduce((a, l) => a + Math.max(0, l.qty - l.receivedQty), 0)} units still open. ${t.transitValue > 0 ? `${fmtMoney(t.transitValue)} stays in bucket 1350 for the difference: the PRD names no write-off.` : ""}`}
            onConfirm={(r) => runD((d, c) => ext.shortCloseSto(d, c, t.id, r), `${t.id} short closed`)} />
        </>
      )}
    </BodyState>
  )
}
void Link
