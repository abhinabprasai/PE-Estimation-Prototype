// CAD-SYNC CAD Sync Monitor and Conflict Queue (Workbench) [DOC:p.258; Book III Part G §2-§3,
// pp.198-199] (asserted). Vault event stream with retry states, conflict cards showing both values
// side by side with the owning role highlighted, publish failure queue. Resolve per field ownership,
// replay failed events, open the linked object. The PDM connector (IF-17) is mocked in this slice.

import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Chip, KV, RulesPanel, type Column } from "@/components/patterns"
import { WorkbenchPage } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useRole, useSlice } from "@/store"
import { RefLink, StatePreview, useAct, useScreenState } from "../components"
import { userName } from "../data/logic"
import * as act from "../data/actions"
import type { SyncConflict, VaultEvent } from "../data/types"

type Row = { id: string; ev?: VaultEvent; cf?: SyncConflict }
const isPublishFailure = (e: VaultEvent) => (e.kind === "Rendition publish" || e.kind === "Release") && e.state !== "Delivered"

export function CadSync() {
  const s = useSlice("engineering")
  const st = useScreenState("CAD-SYNC")
  const [role] = useRole()
  const run = useAct()
  const nav = useNavigate()
  const [queue, setQueue] = useState("events")
  const [active, setActive] = useState<Row | null>(null)
  const openConflicts = s.conflicts.filter((c) => !c.resolved)
  const failures = s.vaultEvents.filter(isPublishFailure)
  const retrying = s.vaultEvents.filter((e) => e.state === "Retrying").length
  const failed = s.vaultEvents.filter((e) => e.state === "Failed").length

  const rows: Row[] = st.empty ? [] : queue === "conflicts" ? s.conflicts.map((c) => ({ id: c.id, cf: c })) : (queue === "failures" ? failures : s.vaultEvents).map((e) => ({ id: e.id, ev: e }))
  const evCols: Column<Row>[] = [
    { id: "at", header: "Time", value: (r) => r.ev!.at, sortable: true, mono: true },
    { id: "tx", header: "Vault transaction", value: (r) => r.ev!.vaultTx, mono: true },
    { id: "kind", header: "Event", value: (r) => r.ev!.kind, filterable: true },
    { id: "obj", header: "Object", value: (r) => r.ev!.object, cell: (r) => <span className="inline-flex flex-wrap items-center gap-1">{r.ev!.object}{r.ev!.ref && <RefLink r={r.ev!.ref} />}</span> },
    { id: "att", header: "Attempts", align: "right", value: (r) => r.ev!.attempts },
    { id: "err", header: "Error", value: (r) => r.ev!.error ?? "", cell: (r) => <span className="text-sm">{r.ev!.error ?? ""}</span> },
    { id: "state", header: "Delivery", value: (r) => r.ev!.state, filterable: true, cell: (r) => <span className="inline-flex items-center gap-1">{r.ev!.state === "Failed" ? <Chip kind="block">{r.ev!.state}</Chip> : r.ev!.state === "Retrying" ? <Chip kind="hold">{r.ev!.state}</Chip> : <span className="text-sm">{r.ev!.state}</span>}</span> },
  ]
  const cfCols: Column<Row>[] = [
    { id: "id", header: "Conflict", value: (r) => r.cf!.id, mono: true, sortable: true },
    { id: "mat", header: "Material", value: (r) => r.cf!.materialId, mono: true },
    { id: "field", header: "Field", value: (r) => r.cf!.field, filterable: true },
    { id: "erp", header: "ERP value", value: (r) => r.cf!.erpValue },
    { id: "pdm", header: "PDM value", value: (r) => r.cf!.pdmValue },
    { id: "owner", header: "System of record", value: (r) => r.cf!.owner, filterable: true },
    { id: "who", header: "Resolver", value: (r) => r.cf!.resolverRole, filterable: true },
    { id: "state", header: "State", value: (r) => (r.cf!.resolved ? "Resolved" : "Open"), filterable: true, cell: (r) => (r.cf!.resolved ? `Resolved: ${r.cf!.resolved.side} value kept` : <Chip kind="flag">Open</Chip>) },
  ]
  const a = active && (active.ev ? s.vaultEvents.find((x) => x.id === active.id) : s.conflicts.find((x) => x.id === active.id))

  return (
    <>
      <WorkbenchPage<Row>
        header={{
          title: "CAD sync monitor and conflict queue",
          screenId: "CAD-SYNC",
          description: "Events from the PDM vault, their delivery and retry state, attribute conflicts between ERP and PDM, and failed publishes.",
          chips: <><Chip kind="design" note="IF-17 PDM connector is mocked in this prototype; use the simulate buttons to fire vault events">Mocked connector (IF-17)</Chip><Chip kind="oq" id="OQ-21" note="No delivery-state list in the PRD; Delivered, Retrying, Failed, Queued are a reading (R-CAD-1)" /></>,
          primary: openConflicts.length ? <Button onClick={() => { setQueue("conflicts"); setActive({ id: openConflicts[0].id, cf: openConflicts[0] }) }}>Resolve next conflict</Button> : undefined,
          actions: (
            <>
              <Button variant="outline" onClick={() => run((d, c) => act.simulateVault(d, c, "Assembly extraction"), (pid) => `Assembly extracted for EBOM-TBD-0377: proposal ${pid} staged for import`)}>Simulate assembly extraction</Button>
              <Button variant="outline" onClick={() => run((d, c) => act.simulateVault(d, c, "New part"), (pid) => `New part from CAD: placeholder ${pid} created, MCR requested`)}>Simulate new part</Button>
              <Button variant="ghost" onClick={() => run((d, c) => act.simulateVault(d, c, "Check-in"), "Check-in event queued")}>Simulate check-in</Button>
            </>
          ),
        }}
        kpis={[
          { label: "Events in stream", value: s.vaultEvents.length },
          { label: "Retrying", value: retrying, hint: "transport errors; retried automatically" },
          { label: "Failed", value: failed, hint: "replay, or fix at the source" },
          { label: "Open conflicts", value: openConflicts.length },
        ]}
        queues={[
          { id: "events", label: "Vault event stream", count: s.vaultEvents.length },
          { id: "failures", label: "Publish failures", count: failures.length },
          { id: "conflicts", label: "Conflicts", count: openConflicts.length },
        ]}
        queue={queue}
        onQueueChange={(q) => { setQueue(q); setActive(null) }}
        table={{
          rows, columns: queue === "conflicts" ? cfCols : evCols, rowId: (r) => r.id, onRowClick: (r) => setActive(r), activeId: active?.id,
          searchText: (r) => (r.ev ? `${r.ev.vaultTx} ${r.ev.object} ${r.ev.kind}` : `${r.cf!.materialId} ${r.cf!.field}`),
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: queue === "conflicts" ? { id: "id", dir: "desc" } : { id: "at", dir: "desc" },
          empty: queue === "conflicts" ? { title: "No conflicts", body: "ERP and PDM agree on every synchronized attribute." } : queue === "failures" ? { title: "No publish failures", body: "Every rendition and release reached ERP." } : { title: "No vault events", body: "The connector has not sent anything yet." },
        }}
        bulkActions={queue === "conflicts" ? undefined : (sel, clear) => (
          <Button size="sm" onClick={() => { const r = run((d, c) => act.replayEvents(d, c, sel), (n) => `${n} event${n === 1 ? "" : "s"} delivered on replay; vault-rule failures stay Failed until fixed at the source`); if (r.ok) clear() }}>Replay selected</Button>
        )}
        panel={{
          open: !!a, onOpenChange: (o) => !o && setActive(null),
          title: a ? (active?.ev ? `${(a as VaultEvent).kind}: ${(a as VaultEvent).vaultTx}` : `Conflict ${a.id}`) : "",
          content: a ? (active?.ev ? <EventPanel e={a as VaultEvent} onReplay={() => run((d, c) => act.replayEvents(d, c, [a.id]), (n) => (n ? "Delivered on replay" : "Still failing: fix at the source"))} onImport={(ebomId) => nav(`/engineering/boms/${ebomId}/import`)} /> : (
            <ConflictCard c={a as SyncConflict} role={role} onResolve={(side) => run((d, c) => act.resolveConflict(d, c, a.id, side), `Resolved: ${side} value kept`)} />
          )) : null,
        }}
      />
      <p className="text-xs text-muted-foreground">Postings and scans: none on this screen (Book VI entry, asserted).</p>
      <RulesPanel
        rules={[
          ["Ownership", "Each synchronized field has one system of record; PDM owns geometry-derived attributes, ERP owns commercial and logistic ones", "DOC:p.198 G §2"],
          ["Resolver", "A conflict is resolved by the role that owns the field", "DOC:p.258"],
          ["Replay", "Failed events can be replayed; failures raised by vault rules stay failed until fixed at the source", "DOC:p.199 G §3"],
          ["New part", "A part with no ERP number creates a Draft placeholder and an MCR; the number is written back to the PDM attribute", "DOC:p.199 G §3"],
          ["Extraction", "An assembly extraction stages an EBOM proposal for the import wizard; nothing changes on the EBOM until commit", "DOC:p.259"],
        ]}
      />
    </>
  )
}

function EventPanel({ e, onReplay, onImport }: { e: VaultEvent; onReplay: () => void; onImport: (ebomId: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4">
        <KV k="Time">{e.at}</KV>
        <KV k="Vault transaction"><span className="font-mono">{e.vaultTx}</span></KV>
        <KV k="Object">{e.object}</KV>
        <KV k="Linked object">{e.ref ? <RefLink r={e.ref} /> : "None"}</KV>
        <KV k="Delivery">{e.state}</KV>
        <KV k="Attempts">{e.attempts}</KV>
      </dl>
      {e.error && <p className="rounded-md bg-muted px-4 py-2 text-sm">{e.error}</p>}
      <div className="flex flex-wrap gap-2">
        {e.state !== "Delivered" && <Button onClick={onReplay}>Replay event</Button>}
        {e.proposalId && e.ref?.type === "ebom" && <Button variant="outline" onClick={() => onImport(e.ref!.id)}>Open import proposal {e.proposalId}</Button>}
        {e.ref && <Button variant="ghost" asChild><Link to={e.ref.type === "document" ? `/engineering/documents/${e.ref.id}` : e.ref.type === "ebom" ? `/engineering/boms/${e.ref.id}` : `/inventory/items/${e.ref.id}`}>Open {e.ref.id}</Link></Button>}
      </div>
    </div>
  )
}

function ConflictCard({ c, role, onResolve }: { c: SyncConflict; role: string; onResolve: (side: "ERP" | "PDM") => void }) {
  const can = role === c.resolverRole && !c.resolved
  const side = (k: "ERP" | "PDM", v: string) => (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-4", c.owner === k && "border-2 border-primary")}>
      <span className="text-xs font-semibold">{k}{c.owner === k && " · system of record"}</span>
      <span className="text-sm">{v}</span>
      {can && <Button size="sm" variant={c.owner === k ? "default" : "outline"} onClick={() => onResolve(k)}>Keep {k} value</Button>}
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4">
        <KV k="Material"><Link className="font-mono text-link underline-offset-4 hover:underline" to={`/inventory/items/${c.materialId}`}>{c.materialId}</Link></KV>
        <KV k="Field">{c.field}</KV>
        <KV k="Raised">{fmtDate(c.raisedOn)} · {c.vaultTx}</KV>
        <KV k="Resolver">{c.resolverRole}</KV>
      </dl>
      <div className="grid grid-cols-2 gap-4">{side("ERP", c.erpValue)}{side("PDM", c.pdmValue)}</div>
      {c.resolved ? <p className="text-sm">Resolved {fmtDate(c.resolved.on)} by {userName(c.resolved.by)}: {c.resolved.side} value "{c.resolved.value}" kept.</p> : !can && <p className="text-sm text-muted-foreground">Resolved by the {c.resolverRole}, who owns {c.field} (switch Acting as).</p>}
    </div>
  )
}
