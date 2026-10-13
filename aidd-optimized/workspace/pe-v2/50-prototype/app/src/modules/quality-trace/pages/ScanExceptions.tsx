// FX-BC-EXCEPTIONS Scan exception queue (offline replay conflicts) [DOC:p.94 Part F; Book V §8.4] (asserted).
// A handheld queues scans for up to 4 hours of network loss; queued events post in order with their
// original timestamps; a conflict at sync (for example stock moved meanwhile) lands here for
// supervisor resolution and is never silently dropped. The conflict card shows the queued scan
// against the current state; the supervisor accepts, rejects or re-posts, and is named on the record.

import { useState } from "react"
import { Link } from "react-router"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { WorkbenchPage } from "@/components/templates"
import { Chip, RulesPanel, type Column } from "@/components/patterns"
import { SCAN_POINTS } from "@/data/domain"
import { useRole, useSlice } from "@/store"
import { scanX } from "../data/extra-actions"
import type { ScanException } from "../data/types"
import { KV } from "@/components/patterns"
import { Reading, report, userName } from "../components/bits"
import { fmtMinutes, minutesBetween, OFFLINE_LIMIT_MIN } from "../components/fmt"
import { StateFrame, useScreenState } from "../components/states"

const RULES: [string, string, string][] = [
  ["BC-E1", "Offline terminals queue scan events locally for up to 4 hours of network loss; queued events post in order with their original timestamps.", "DOC:p.94 Part F"],
  ["BC-E2", "Conflicts at sync (for example stock moved meanwhile) land in the Scan Exception queue for supervisor resolution and are never silently dropped.", "DOC:p.94 Part F"],
  ["BC-E3", "Every scan event, failures included, is kept in scan telemetry: device, user, timestamp, payload, result.", "DOC:p.97 Part F"],
  ["BC-E4", "A genealogy fix after a resolved conflict is a correction pair (reversal and replacement), never an edit (C-53).", "DOC:p.211 Book IV §4"],
]

const stateOf = (x: ScanException) => (x.resolvedOn ? (x.decision ?? "Resolved") : "Open")
const delay = (x: ScanException) => minutesBetween(x.capturedAt, x.syncedAt)

export function ScanExceptionQueue() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-BC-EXCEPTIONS")
  const [role] = useRole()
  const [q, setQ] = useState("open")
  const [activeId, setActive] = useState<string | null>(null)
  const active = s.scanExceptions.find((x) => x.id === activeId)
  const open = s.scanExceptions.filter((x) => !x.resolvedOn)
  const rows = s.scanExceptions.filter((x) => (q === "all" ? true : q === "open" ? !x.resolvedOn : !!x.resolvedOn))
  const cols: Column<ScanException>[] = [
    { id: "id", header: "Exception", value: (x) => x.id, mono: true, sortable: true },
    { id: "sp", header: "Scan point", value: (x) => x.sp, filterable: true, cell: (x) => `${x.sp} · ${SCAN_POINTS[x.sp].step}` },
    { id: "dev", header: "Device", value: (x) => x.device, filterable: true },
    { id: "cap", header: "Captured (original)", value: (x) => x.capturedAt, mono: true, sortable: true },
    { id: "delay", header: "Queued for", value: (x) => delay(x), align: "right", mono: true, sortable: true, cell: (x) => <span className={delay(x) > OFFLINE_LIMIT_MIN ? "font-semibold text-destructive" : undefined}>{fmtMinutes(delay(x))}{delay(x) > OFFLINE_LIMIT_MIN ? " (over 4 h)" : ""}</span> },
    { id: "code", header: "Scanned", value: (x) => x.code, mono: true },
    { id: "conf", header: "Conflict", value: (x) => x.conflict },
    { id: "state", header: "State", value: stateOf, filterable: true, cell: (x) => (x.resolvedOn ? <span className="text-muted-foreground">{stateOf(x)} · {userName(x.supervisorId)}</span> : <Chip kind="flag">Open</Chip>) },
  ]
  return (
    <>
      <StateFrame ss={ss} title="Scan exception queue" screenId="FX-BC-EXCEPTIONS" entity="scan conflicts" allowed="Warehouse supervisor or Production supervisor" validation={["Enter the supervisor reason before you accept, reject or re-post.", "Choose one conflict to resolve."]} conflict={{ what: "SCX-TBD-0201", mine: "Accept: replay the pick with the original 02:10 timestamp", theirs: "Another supervisor re-posted it at 08:05 on HH-03" }} degraded="The telemetry store is slow; the scan log under each card may lag by a few minutes.">
        <WorkbenchPage
          header={{
            title: "Scan exception queue",
            screenId: "FX-BC-EXCEPTIONS",
            description: "Offline replay conflicts from handheld and fixed terminals. Each card shows what the device queued against what the system holds now. A supervisor accepts, rejects or re-posts, with a reason; nothing is dropped silently.",
            crumbs: [{ label: "Label and Scan Administration", to: "/configuration/barcode" }, { label: "Scan exceptions" }],
            chips: <Reading id="QT-R32" />,
            actions: (
              <Button variant="outline" asChild>
                <Link to="/configuration/barcode?s=telemetry">Scan telemetry log</Link>
              </Button>
            ),
          }}
          kpis={[
            { label: "Open conflicts", value: open.length },
            { label: "Over the 4 h limit", value: open.filter((x) => delay(x) > OFFLINE_LIMIT_MIN).length, hint: "Queued longer than the offline limit" },
            { label: "Oldest open", value: open.length ? open.map((x) => x.capturedAt).sort()[0].slice(0, 10) : "None" },
            { label: "Resolved", value: s.scanExceptions.length - open.length, hint: `${s.scanExceptions.filter((x) => x.decision === "Rejected").length} rejected, none dropped` },
          ]}
          queues={[{ id: "open", label: "Open", count: open.length }, { id: "resolved", label: "Resolved", count: s.scanExceptions.length - open.length }, { id: "all", label: "All", count: s.scanExceptions.length }]}
          queue={q}
          onQueueChange={setQ}
          table={{
            rows,
            columns: cols,
            rowId: (x) => x.id,
            activeId: activeId ?? undefined,
            onRowClick: (x) => setActive(x.id),
            searchText: (x) => `${x.id} ${x.code} ${x.device} ${x.conflict}`,
            searchPlaceholder: "Search exception, device, scanned code",
            initialSort: { id: "cap", dir: "desc" },
            empty: { title: q === "open" ? "No open conflicts" : "Nothing here", body: "Conflicts at sync appear here for a supervisor. Nothing is dropped silently." },
          }}
          panel={{ open: !!active, onOpenChange: (o) => !o && setActive(null), title: active ? `${active.id} · ${active.sp}` : "", description: active ? SCAN_POINTS[active.sp].step : undefined, content: active ? <ConflictCard x={active} role={role} locked={ss.locked} /> : null }}
        />
        <RulesPanel rules={RULES} />
      </StateFrame>
    </>
  )
}

function ConflictCard({ x, role, locked }: { x: ScanException; role: string; locked: boolean }) {
  const [reason, setReason] = useState("")
  const m = delay(x)
  const sp = SCAN_POINTS[x.sp]
  const act = (d: "Accepted" | "Rejected" | "Re-posted") => {
    const r = scanX.decide(x.id, d, reason)
    if (report(r, `${x.id} ${d.toLowerCase()}; attributed to the supervisor and logged`)) setReason("")
  }
  return (
    <div className="flex flex-col gap-4 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <KV k="Device">{x.device}</KV>
        <KV k="Scanned">{x.code}</KV>
        <KV k="Captured (original timestamp)">{x.capturedAt.replace("T", " ")}</KV>
        <KV k="Synced">{x.syncedAt.replace("T", " ")}</KV>
        <KV k="Queued for">{fmtMinutes(m)}{m > OFFLINE_LIMIT_MIN && " (over the 4 h limit)"}</KV>
        <KV k="Writes event">{sp.trace ?? "None (count entry)"}</KV>
      </dl>
      <div className="grid gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold text-muted-foreground">Queued on the device</p>
          <p>{x.queued ?? x.conflict}</p>
        </div>
        <div className="rounded-lg border border-status-exception p-3">
          <p className="text-xs font-semibold text-muted-foreground">System now</p>
          <p>{x.current ?? "The record changed after the scan was captured."}</p>
        </div>
        <p className="text-muted-foreground">Conflict: {x.conflict}</p>
      </div>
      {x.resolvedOn ? (
        <div className="rounded-lg border p-3">
          <p className="inline-flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4" aria-hidden="true" /> {x.decision ?? "Resolved"} on {x.resolvedOn}
          </p>
          <p>{x.resolution}</p>
          <p className="text-xs text-muted-foreground">Supervisor: {userName(x.supervisorId)}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="scx-reason">Supervisor reason (required)</Label>
          <Textarea id="scx-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this decision" />
          <p className="text-xs text-muted-foreground">Accept replays the scan with its original timestamp. Re-post posts it now. Reject discards it with your reason. The decision is attributed to you ({role}) and written to scan telemetry.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={locked} onClick={() => act("Accepted")}>Accept (replay)</Button>
            <Button variant="outline" disabled={locked} onClick={() => act("Re-posted")}>Re-post now</Button>
            <Button variant="outline" disabled={locked} onClick={() => act("Rejected")}>Reject</Button>
          </div>
          {x.sp !== "SP-20" && <p className="text-xs text-muted-foreground">If the genealogy must change afterwards, use <Link className="text-link underline-offset-4 hover:underline" to="/traceability/genealogy-correction">the correction pair flow</Link>.</p>}
        </div>
      )}
    </div>
  )
}
