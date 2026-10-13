// PP-MRP-001 MRP Workbench and PLO-001 Planned Orders [DOC:p.72 §3; p.259-260 Book VI] (asserted).
// Exception cards EX-01..EX-09 grouped by type with counts and aging, a proposal grid with pegging
// drill, run history with input snapshot IDs. One-click action per exception type, Firm, mass
// Convert with preview. Conversion creates production orders (Created) and purchase requisitions
// with pegs preserved; the PR side is created by purchasing on planning.plannedOrderConverted.

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Chip, DataTable, KV, RulesPanel, type Column } from "@/components/patterns"
import { DialogShell, ListPage, WorkbenchPage } from "@/components/templates"
import { TODAY } from "@/data/shared"
import type { ISODate } from "@/data/domain"
import { daysBetween, fmtDate } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { ActivityList, Item, RefLink, SoLink, StatePreview, matDesc, qty, useAct, useActDialog, useScreenState, Marker } from "../components"
import * as act from "../lib/actions"
import { RunMrpDialog } from "./RunMrp"
import { EX_CATALOG, type ExCode, type MrpException, type MrpRun, type PPPlannedOrder } from "../data/types"

const CODES = Object.keys(EX_CATALOG) as ExCode[]
const age = (x: MrpException) => daysBetween(x.raisedOn, TODAY)

function ConvertPreview({ ids }: { ids: string[] }) {
  const s = useSlice("planningProduction")
  const rows = s.plannedOrders.filter((p) => ids.includes(p.id))
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
      {rows.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{p.id}</span> → {p.kind === "make" ? "production order (Created)" : "purchase requisition (MRP, pre-approved)"} · {p.materialId} × {qty(p.qty)}
          {p.peg && <span className="text-muted-foreground">peg {p.peg.soId}/{p.peg.line}</span>}
          {p.kind === "make" && (!p.mbomActive || !p.routingReleased) && <Chip kind="flag" note="Release check 1 will stop the order until the MBOM is active and the routing released">EX-07 open</Chip>}
          {p.state !== "Proposed" && p.state !== "Firmed" && <Chip kind="block">{p.state}: skipped</Chip>}
        </li>
      ))}
      {(() => {
        const groups = new Map<string, string[]>()
        for (const p of rows.filter((p) => p.kind === "buy" && (p.state === "Proposed" || p.state === "Firmed"))) {
          const k = p.vendorHint?.match(/VEN-[A-Z]+-\d+/)?.[0] ?? "no source"
          groups.set(k, [...(groups.get(k) ?? []), p.id])
        }
        return groups.size ? <li className="mt-2 font-medium">Purchase requisitions: {groups.size} (one per vendor) · {[...groups.entries()].map(([v, ids]) => `${v}: ${ids.join(", ")}`).join(" · ")}</li> : null
      })()}
    </ul>
  )
}

export function MrpWorkbench() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-MRP-001")
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const [params, setParams] = useSearchParams()
  const buyerView = role === "Buyer" || role === "Purchasing Manager"
  const queue = params.get("q") ?? "open"
  const setQueue = (q: string) => (params.set("q", q), setParams(params, { replace: true }))
  const [active, setActive] = useState<string | null>(null)
  const [reasonFor, setReasonFor] = useState<string | null>(null)
  const [redate, setRedate] = useState<{ id: string; date: string; note: string } | null>(null)
  const [convert, setConvert] = useState<string[] | null>(null)
  const [selPlo, setSelPlo] = useState<string[]>([])
  const [runDlg, setRunDlg] = useState(false)

  const visibleEx = s.exceptions.filter((x) => !buyerView || x.buy)
  const open = visibleEx.filter((x) => !x.resolved)
  const rows = st.empty ? [] : queue === "open" ? open : queue === "handled" ? visibleEx.filter((x) => x.resolved) : open.filter((x) => x.code === queue)
  const ax = s.exceptions.find((x) => x.id === active)
  const lastRun = s.mrpRuns[0]
  const proposals = s.plannedOrders.filter((p) => p.state === "Proposed" || p.state === "Firmed")

  const doEx = (x: MrpException) => {
    if (x.code === "EX-08") return setReasonFor(x.id)
    run((d, c) => act.resolveException(d, c, x.id), (r) => `${x.id}: ${r?.resolved?.action}${r?.resolved?.note ? ` (${r.resolved.note})` : ""}`)
  }

  const columns: Column<MrpException>[] = [
    { id: "code", header: "Type", value: (x) => x.code, sortable: true, cell: (x) => <span className="font-mono text-xs" title={EX_CATALOG[x.code].message}>{x.code}</span> },
    { id: "item", header: "Item", value: (x) => x.itemId, filterable: true, cell: (x) => <Item id={x.itemId} /> },
    { id: "msg", header: "Exception", value: (x) => x.detail, cell: (x) => <span className="text-sm">{x.detail}</span> },
    { id: "need", header: "Need date", value: (x) => x.needDate, sortable: true, cell: (x) => fmtDate(x.needDate) },
    { id: "qty", header: "Qty", value: (x) => x.qty, align: "right", mono: true, cell: (x) => qty(x.qty) },
    { id: "peg", header: "Peg", value: (x) => x.peg?.soId ?? "", cell: (x) => (x.peg ? <SoLink id={x.peg.soId} /> : "") },
    { id: "age", header: "Age (d)", value: (x) => age(x), align: "right", sortable: true, mono: true },
    {
      id: "act", header: "Action", value: (x) => x.resolved?.action ?? EX_CATALOG[x.code].action,
      cell: (x) => (x.resolved ? <span className="text-xs text-muted-foreground">{x.resolved.action} · {x.resolved.by} {x.resolved.on}</span> : <Button size="sm" variant="outline" onClick={(e) => (e.stopPropagation(), doEx(x))}>{EX_CATALOG[x.code].action.split(" (")[0]}</Button>),
    },
  ]
  const ploCols: Column<PPPlannedOrder>[] = [
    { id: "id", header: "Planned order", value: (p) => p.id, mono: true, sortable: true, cell: (p) => <Link className="font-mono text-link" to={`/production/planned-orders?id=${p.id}`}>{p.id}</Link> },
    { id: "item", header: "Item", value: (p) => p.materialId, cell: (p) => <Item id={p.materialId} /> },
    { id: "kind", header: "Make / buy", value: (p) => p.kind, filterable: true },
    { id: "qty", header: "Qty", value: (p) => p.qty, align: "right", mono: true, cell: (p) => qty(p.qty) },
    { id: "dates", header: "Start → finish", value: (p) => p.finish, sortable: true, cell: (p) => <span className="tabular text-xs">{fmtDate(p.start)} → {fmtDate(p.finish)}</span> },
    { id: "peg", header: "Pegging", value: (p) => p.peg?.soId ?? "", cell: (p) => (p.peg ? <span><SoLink id={p.peg.soId} /> /{p.peg.line}/{p.peg.sched}</span> : <span className="text-muted-foreground">independent</span>) },
    { id: "firm", header: "Firmed", value: (p) => (p.firmed ? "Firmed" : ""), cell: (p) => (p.firmed ? <Marker note="Firm flag: survives the next regenerative run">Firmed</Marker> : "") },
    { id: "run", header: "Run", value: (p) => p.mrpRunId, mono: true },
  ]
  const runCols: Column<MrpRun>[] = [
    { id: "id", header: "Run", value: (r) => r.id, mono: true },
    { id: "kind", header: "Kind", value: (r) => r.kind },
    { id: "at", header: "Started", value: (r) => r.startedAt, cell: (r) => r.startedAt.replace("T", " ") },
    { id: "min", header: "Minutes", value: (r) => r.minutes, align: "right", mono: true },
    { id: "snap", header: "Input snapshot", value: (r) => r.snapshotId, mono: true },
    { id: "plo", header: "Proposals", value: (r) => r.plannedOrders, align: "right", mono: true },
    { id: "ex", header: "Exceptions", value: (r) => r.exceptions, align: "right", mono: true },
    { id: "by", header: "By", value: (r) => r.by },
  ]

  return (
    <>
      <WorkbenchPage<MrpException>
        header={{
          title: "MRP workbench",
          screenId: "PP-MRP-001",
          description: buyerView ? "Buyer view: exceptions on bought items only (EX-01, EX-02, EX-03, EX-06, EX-09)." : "Nightly regenerative run; net change on demand. Act on exceptions, firm proposals (they survive the next regenerative run), convert with preview.",
          chips: buyerView ? <Chip kind="design" note="Buyers see their exceptions [DOC:p.259]; the filter is by bought item">Buyer filter</Chip> : <Chip kind="design" note="The nightly run time 01:00 is a design value; the PRD names a nightly regenerative run, not its time">Nightly 01:00</Chip>,
          primary: <Button onClick={() => setRunDlg(true)}>Run MRP</Button>,
          actions: (
            <>
              <StatePreview />
              <Button variant="outline" asChild><Link to="/production/dialogs/run-mrp">Run dialog states</Link></Button>
              <Button variant="outline" asChild><Link to="/production/planned-orders">Planned orders</Link></Button>
            </>
          ),
          children: (
            <div className="grid grid-cols-3 gap-2 md:grid-cols-5 xl:grid-cols-10" role="list" aria-label="Exception types">
              {CODES.map((c) => {
                const xs = open.filter((x) => x.code === c)
                const oldest = xs.reduce((a, x) => Math.max(a, age(x)), 0)
                return (
                  <button key={c} role="listitem" onClick={() => setQueue(c)} className={`flex flex-col rounded-lg border p-2 text-left ${queue === c ? "border-primary" : ""}`} title={`${EX_CATALOG[c].message}. Action: ${EX_CATALOG[c].action}`}>
                    <span className="font-mono text-xs">{c}</span>
                    <span className="tabular text-xl font-semibold">{xs.length}</span>
                    <span className="truncate text-xs text-muted-foreground">{EX_CATALOG[c].message.split(":")[0]}</span>
                    <span className="tabular text-xs text-muted-foreground">{xs.length ? `oldest ${oldest} d` : "none"}</span>
                  </button>
                )
              })}
            </div>
          ),
        }}
        kpis={[
          { label: "Open exceptions", value: open.length, hint: `${open.filter((x) => age(x) > 5).length} older than 5 days` },
          { label: "Open proposals", value: proposals.length, hint: `${proposals.filter((p) => p.firmed).length} firmed` },
          { label: "Last run", value: lastRun?.id ?? "none", hint: lastRun ? `${lastRun.kind}, ${lastRun.minutes} min, ${lastRun.snapshotId}` : undefined },
          { label: "Pegged to SO-2026-00377", value: s.plannedOrders.filter((p) => p.peg?.soId === "SO-2026-00377" && p.state !== "Cancelled").length, hint: "phase 2 ETO proposals" },
        ]}
        queues={[{ id: "open", label: "All open", count: open.length }, ...CODES.map((c) => ({ id: c, label: c, count: open.filter((x) => x.code === c).length })), { id: "handled", label: "Handled", count: visibleEx.length - open.length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{
          rows, columns, rowId: (x) => x.id, onRowClick: (x) => setActive(x.id), activeId: active ?? undefined,
          searchText: (x) => `${x.id} ${x.itemId} ${matDesc(x.itemId)} ${x.detail} ${x.peg?.soId ?? ""}`,
          loading: st.loading, error: st.error, onRetry: st.retry, initialSort: { id: "age", dir: "desc" },
          empty: { title: queue === "handled" ? "Nothing handled yet" : "No open exceptions", body: "The last run raised nothing in this group." },
        }}
        bulkActions={(sel, clear) => (
          <Button size="sm" onClick={() => {
            let n = 0
            for (const id of sel) {
              const x = s.exceptions.find((e) => e.id === id)
              if (!x || x.resolved || x.code === "EX-08") continue
              if (run((d, c) => act.resolveException(d, c, id))) n++
            }
            clear()
            run(() => n, `${n} exception(s) handled; EX-08 needs a reason one by one`)
          }}>Apply the one-click action</Button>
        )}
        panel={ax ? {
          open: !!ax, onOpenChange: (o) => !o && setActive(null), title: `${ax.id} · ${ax.code}`, description: EX_CATALOG[ax.code].message,
          content: (
            <div className="flex flex-col gap-4 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <KV k="Item">{ax.itemId}</KV>
                <KV k="Description">{matDesc(ax.itemId)}</KV>
                <KV k="Need date">{fmtDate(ax.needDate)}</KV>
                <KV k="Supply date">{ax.supplyDate ? fmtDate(ax.supplyDate) : "none"}</KV>
                <KV k="Quantity">{qty(ax.qty)}</KV>
                <KV k="Run">{ax.runId}</KV>
              </dl>
              <p>{ax.detail}</p>
              <div>
                <p className="font-semibold">Pegging drill</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {ax.peg && <li>Demand: <SoLink id={ax.peg.soId} /> line {ax.peg.line} schedule {ax.peg.sched}</li>}
                  {ax.supply && <li>Supply: <RefLink r={ax.supply} /></li>}
                  {!ax.peg && !ax.supply && <li className="text-muted-foreground">Independent demand (stock / forecast)</li>}
                </ul>
              </div>
              <p className="text-muted-foreground">One-click action: {EX_CATALOG[ax.code].action} {EX_CATALOG[ax.code].source}</p>
              {ax.resolved ? <p>Handled: {ax.resolved.action} by {ax.resolved.by} on {ax.resolved.on}{ax.resolved.note ? `. ${ax.resolved.note}` : ""}</p> : (
                <span className="flex flex-wrap gap-2">
                  <Button onClick={() => doEx(ax)}>{EX_CATALOG[ax.code].action}</Button>
                  {(ax.code === "EX-02" || ax.code === "EX-06") && <Button variant="outline" onClick={() => setRedate({ id: ax.id, date: ax.supplyDate ?? ax.needDate, note: "" })}>Re-date supply</Button>}
                </span>
              )}
            </div>
          ),
        } : undefined}
      />

      <section aria-label="Proposals" className="mt-8 flex flex-col gap-2">
        <h2 className="text-base font-semibold">Proposals ({proposals.length})</h2>
        <DataTable<PPPlannedOrder>
          densityKey="PP-MRP-001-plo" rows={st.empty ? [] : proposals} columns={ploCols} rowId={(p) => p.id} selectable selected={selPlo} onSelectedChange={setSelPlo}
          loading={st.loading} searchText={(p) => `${p.id} ${p.materialId} ${p.peg?.soId ?? ""}`}
          toolbar={
            <span className="inline-flex gap-2">
              <Button size="sm" variant="outline" disabled={!selPlo.length} onClick={() => run((d, c) => act.firmPlanned(d, c, selPlo, true), `${selPlo.length} firmed`)}>Firm</Button>
              <Button size="sm" disabled={!selPlo.length} onClick={() => setConvert(selPlo)}>Convert with preview</Button>
              <Button size="sm" variant="outline" disabled={!proposals.some((p) => p.firmed)} onClick={() => setConvert(proposals.filter((p) => p.firmed).map((p) => p.id))}>Convert all firmed ({proposals.filter((p) => p.firmed).length})</Button>
              <Button size="sm" variant="ghost" disabled={!proposals.length} onClick={() => (setSelPlo(proposals.map((p) => p.id)), setConvert(proposals.map((p) => p.id)))}>Convert all open ({proposals.length})</Button>
            </span>
          }
          empty={{ title: "No open proposals", body: "Every proposal is converted or cancelled." }}
        />
      </section>
      <section aria-label="Run history" className="mt-8 flex flex-col gap-2">
        <h2 className="text-base font-semibold">Run history</h2>
        <DataTable<MrpRun> densityKey="PP-MRP-001-runs" rows={st.empty ? [] : s.mrpRuns} columns={runCols} rowId={(r) => r.id} loading={st.loading} empty={{ title: "No runs yet" }} />
      </section>
      <RunMrpDialog open={runDlg} onOpenChange={setRunDlg} />
      <RulesPanel className="mt-6" rules={[
        ["EX-10", "Network demand that cannot be placed (an inactive lane, or a supplying plant without a valid production version) raises EX-10; reactivating the lane clears it. Target state, live at activation (DEC-07)", "DOC:p.283 Book IX §4.4"],
        ["EX-01..EX-07", "Exception messages and their one-click actions", "DOC:p.72 §3.2"],
        ["EX-08 / EX-09", "Inside the planning fence the planner decides; no valid source sends the buyer to RFQ or AVL qualification", "DOC:p.149; p.157"],
        ["Convert", "Creates production order drafts and purchase requisitions with pegs preserved; the run ID is logged", "DOC:p.259 Book VI"],
        ["§3.3", "Buy proposals convert to PRs grouped by vendor per lot sizing; firmed planned orders survive the next regenerative run", "DOC:p.72 §3.3"],
        ["E §4", "A re-dated pegged supply (supply slip) revalidates the pegged promises", "DOC:p.193 Book III E §4"],
      ]} />

      <DialogShell open={!!redate} onOpenChange={(o) => !o && setRedate(null)} title={`Re-date supply · ${redate?.id}`} confirmLabel="Re-date"
        consequence="Records the new confirmed supply date. A later date on supply pegged to an order is a supply slip: the consuming operations wait for it and the pegged promises revalidate (at-risk records raise automatically)."
        onConfirm={() => runD((d, c) => act.redateSupply(d, c, redate!.id, redate!.date as ISODate, redate!.note), (ids) => (ids.length ? `Re-dated; at risk: ${ids.join(", ")}` : "Re-dated; pegged promises hold"))}>
        {redate && (
          <div className="grid gap-2">
            <Label htmlFor="rd-date">New confirmed supply date</Label>
            <Input id="rd-date" type="date" value={redate.date} onChange={(e) => setRedate({ ...redate, date: e.target.value })} />
            <Label htmlFor="rd-note">Note (vendor confirmation)</Label>
            <Textarea id="rd-note" value={redate.note} onChange={(e) => setRedate({ ...redate, note: e.target.value })} />
          </div>
        )}
      </DialogShell>
      <DialogShell open={!!reasonFor} onOpenChange={(o) => !o && setReasonFor(null)} title={`${reasonFor}: planner decision inside the fence`} confirmLabel="Record decision" requireReason reasonLabel="Decision and reason"
        consequence="The change is not applied automatically inside the planning fence; your decision and reason are logged on the exception."
        onConfirm={(r) => runD((d, c) => act.resolveException(d, c, reasonFor!, r), "Decision recorded")} />
      <DialogShell open={!!convert} onOpenChange={(o) => !o && setConvert(null)} title={`Convert ${convert?.length ?? 0} proposal(s)`} confirmLabel="Convert" wide
        consequence="Make items become production orders in Created status; buy items become purchase requisitions on the purchasing side. Pegs and the run ID carry over."
        onConfirm={() => runD((d, c) => act.convertPlanned(d, c, (convert ?? []).filter((id) => proposals.some((p) => p.id === id))), (refs) => {
          setSelPlo([])
          return `Created ${refs.map((r) => r.id).join(", ")}`
        })}>
        {convert && <ConvertPreview ids={convert} />}
      </DialogShell>
    </>
  )
}

export function PlannedOrderList() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PLO-001")
  const run = useAct()
  const runD = useActDialog()
  const [params, setParams] = useSearchParams()
  const [sel, setSel] = useState<string[]>([])
  const [dlg, setDlg] = useState<null | "convert" | "cancel">(null)
  const [why, setWhy] = useState("")
  const openId = params.get("id")
  const p = s.plannedOrders.find((x) => x.id === openId)
  const rows = useMemo(() => (st.empty ? [] : s.plannedOrders), [st.empty, s.plannedOrders])
  const cols: Column<PPPlannedOrder>[] = [
    { id: "id", header: "Planned order", value: (p) => p.id, mono: true, sortable: true },
    { id: "item", header: "Item", value: (p) => p.materialId, filterable: true, cell: (p) => <Item id={p.materialId} /> },
    { id: "kind", header: "Make / buy", value: (p) => p.kind, filterable: true },
    { id: "qty", header: "Qty", value: (p) => p.qty, align: "right", mono: true, cell: (p) => qty(p.qty) },
    { id: "start", header: "Start", value: (p) => p.start, sortable: true, cell: (p) => fmtDate(p.start) },
    { id: "finish", header: "Finish", value: (p) => p.finish, sortable: true, cell: (p) => fmtDate(p.finish) },
    { id: "peg", header: "Pegs", value: (p) => p.peg?.soId ?? "", cell: (p) => (p.peg ? <span><SoLink id={p.peg.soId} />/{p.peg.line}/{p.peg.sched}</span> : <span className="text-muted-foreground">independent</span>) },
    { id: "firm", header: "Firmed", value: (p) => (p.firmed ? "Yes" : "No"), filterable: true, cell: (p) => (p.firmed ? <Marker note="Survives the next regenerative run">Firmed</Marker> : "") },
    {
      id: "state", header: "Conversion state", value: (p) => p.state, filterable: true, sortable: true,
      cell: (p) => (
        <span className="inline-flex flex-wrap items-center gap-1 text-sm">
          {p.state}{p.convertedTo && <> → <RefLink r={{ type: p.convertedTo.startsWith("WO-") ? "productionOrder" : "requisition", id: p.convertedTo }} /></>}
          {p.kind === "make" && (p.state === "Proposed" || p.state === "Firmed") && (!p.mbomActive || !p.routingReleased) && <Chip kind="flag" note="BOM or routing missing or unreleased">EX-07</Chip>}
        </span>
      ),
    },
  ]
  const openSel = sel.filter((id) => s.plannedOrders.find((x) => x.id === id && (x.state === "Proposed" || x.state === "Firmed")))
  return (
    <>
      <ListPage<PPPlannedOrder>
        header={{
          title: "Planned orders",
          screenId: "PLO-001",
          description: "MRP proposals with firmed flag, pegs and conversion state. There is no planned-order status list in the specification, so the conversion state is shown as text.",
          chips: <Chip kind="oq" id="OQ-21" note="No status list for planned orders: conversion state as text, no badge" />,
          primary: <Button disabled={!openSel.length} onClick={() => setDlg("convert")}>Convert ({openSel.length})</Button>,
          actions: (
            <>
              <Button variant="outline" disabled={!openSel.length} onClick={() => run((d, c) => act.firmPlanned(d, c, openSel, true), `${openSel.length} firmed`)}>Firm</Button>
              <Button variant="outline" disabled={!openSel.length} onClick={() => run((d, c) => act.firmPlanned(d, c, openSel, false), "Firm flag removed")}>Unfirm</Button>
              <Button variant="ghost" disabled={!openSel.length} onClick={() => setDlg("cancel")}>Cancel proposals</Button>
            </>
          ),
        }}
        table={{
          rows, columns: cols, rowId: (p) => p.id, selectable: true, selected: sel, onSelectedChange: setSel, activeId: openId ?? undefined,
          onRowClick: (p) => (params.set("id", p.id), setParams(params, { replace: true })),
          searchText: (p) => `${p.id} ${p.materialId} ${matDesc(p.materialId)} ${p.peg?.soId ?? ""} ${p.convertedTo ?? ""}`,
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "start", dir: "asc" },
          empty: { title: "No planned orders", body: "Run MRP on the workbench to propose supply." },
        }}
      />
      <Sheet open={!!p} onOpenChange={(o) => !o && (params.delete("id"), setParams(params, { replace: true }))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {p && (
            <>
              <SheetHeader>
                <SheetTitle>{p.id} · {p.state}</SheetTitle>
                <SheetDescription>{matDesc(p.materialId)} × {qty(p.qty)} ({p.kind})</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <KV k="Start / finish">{fmtDate(p.start)} → {fmtDate(p.finish)}</KV>
                  <KV k="MRP run">{p.mrpRunId}</KV>
                  <KV k="Peg">{p.peg ? <><SoLink id={p.peg.soId} /> line {p.peg.line} sched {p.peg.sched}</> : "independent"}</KV>
                  <KV k="Converted to">{p.convertedTo ? <RefLink r={{ type: p.convertedTo.startsWith("WO-") ? "productionOrder" : "requisition", id: p.convertedTo }} /> : "not yet"}</KV>
                  {p.kind === "make" && <KV k="MBOM / routing">{p.mbomId ?? "standard"} {p.mbomActive ? "Active" : "not active"} · routing {p.routingReleased ? "Released" : "not released"}</KV>}
                  {p.vendorHint && <KV k="Source hint">{p.vendorHint}</KV>}
                  {p.cancelReason && <KV k="Cancel reason">{p.cancelReason}</KV>}
                </dl>
                <ActivityList items={p.activity} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <DialogShell open={dlg === "convert"} onOpenChange={(o) => !o && setDlg(null)} title={`Convert ${openSel.length} proposal(s)`} confirmLabel="Convert" wide
        consequence="Make items become production orders in Created status; buy items become purchase requisitions. Pegs and the run ID carry over."
        onConfirm={() => runD((d, c) => act.convertPlanned(d, c, openSel), (refs) => (setSel([]), `Created ${refs.map((r) => r.id).join(", ")}`))}>
        <ConvertPreview ids={openSel} />
      </DialogShell>
      <DialogShell open={dlg === "cancel"} onOpenChange={(o) => !o && setDlg(null)} title={`Cancel ${openSel.length} proposal(s)`} confirmLabel="Cancel proposals" destructive
        consequence="The proposals end as Cancelled; linked exceptions are marked handled."
        onConfirm={() => runD((d, c) => act.cancelPlanned(d, c, openSel, why), () => (setSel([]), setWhy(""), "Proposals cancelled"))}>
        <Label htmlFor="plo-why">Reason</Label>
        <Textarea id="plo-why" value={why} onChange={(e) => setWhy(e.target.value)} />
      </DialogShell>
    </>
  )
}
