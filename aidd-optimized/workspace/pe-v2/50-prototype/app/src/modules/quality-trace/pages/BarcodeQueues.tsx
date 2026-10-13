// BC-ADMIN sections: failed-print queue (retry, redirect) and scan telemetry log
// [DOC:p.93 Part F §2 printer registry with failover; p.97 Part F §4 telemetry kept 24 months] (asserted).
// A job that fails stays in the queue until retried on its printer, redirected to another
// registered printer that carries the label type, or cancelled with a reason. Telemetry lists every
// scan event, failures included (README QT-R35).

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DialogShell } from "@/components/templates"
import { Chip, DataTable, EmptyState, type Column } from "@/components/patterns"
import { SCAN_POINTS } from "@/data/domain"
import { useSlice } from "@/store"
import { printQ } from "../data/extra-actions"
import type { PrintJob, ScanTelemetry } from "../data/extra-types"
import { Pick, Reading, Section, Stat, report, userName } from "../components/bits"

export function PrinterHealth({ health, active }: { health?: string; active: boolean }) {
  if (!active) return <span className="text-muted-foreground">Inactive</span>
  return health && health !== "Online" ? <Chip kind="flag">{health}</Chip> : <span>Online</span>
}

export function FailedPrintQueue({ locked = false }: { locked?: boolean }) {
  const s = useSlice("qualityTrace")
  const [tab, setTab] = useState<"Failed" | "all">("Failed")
  const [target, setTarget] = useState<{ j: PrintJob; mode: "redirect" | "cancel" } | null>(null)
  const [prn, setPrn] = useState("")
  const failed = s.printJobs.filter((j) => j.status === "Failed")
  const rows = s.printJobs.filter((j) => (tab === "all" ? true : j.status === "Failed"))
  const alts = target ? printQ.alternatives(s, target.j) : []
  const cols: Column<PrintJob>[] = [
    { id: "id", header: "Job", value: (j) => j.id, mono: true, sortable: true },
    { id: "label", header: "Label", value: (j) => j.labelId, mono: true },
    { id: "tpl", header: "Template", value: (j) => j.template, filterable: true },
    { id: "prn", header: "Printer", value: (j) => j.printerId, filterable: true, cell: (j) => { const p = printQ.jobFor(s, j); return `${j.printerId}${p ? ` · ${p.station}` : ""}` } },
    { id: "health", header: "Device now", value: (j) => printQ.jobFor(s, j)?.health ?? "", cell: (j) => { const p = printQ.jobFor(s, j); return p ? <PrinterHealth health={p.health} active={p.active} /> : "" } },
    { id: "err", header: "Error", value: (j) => j.error },
    { id: "att", header: "Attempts", value: (j) => j.attempts, align: "right", mono: true },
    { id: "at", header: "Requested", value: (j) => j.at, mono: true, sortable: true, cell: (j) => j.at.replace("T", " ") },
    { id: "by", header: "By", value: (j) => userName(j.requestedBy) },
    {
      id: "state", header: "State", value: (j) => j.status, filterable: true,
      cell: (j) =>
        j.status === "Failed" ? (
          <span className="flex flex-wrap items-center gap-1">
            <Chip kind="flag">Failed</Chip>
            <Button size="sm" variant="outline" disabled={locked} onClick={() => report(printQ.retry(j.id), (v) => v.message)}>Retry</Button>
            <Button size="sm" variant="outline" disabled={locked} onClick={() => (setPrn(""), setTarget({ j, mode: "redirect" }))}>Redirect</Button>
            <Button size="sm" variant="ghost" disabled={locked} onClick={() => setTarget({ j, mode: "cancel" })}>Cancel</Button>
          </span>
        ) : (
          <span className="text-muted-foreground">{j.status}{j.redirectedTo ? ` on ${j.redirectedTo}` : ""} · {j.resolvedOn}</span>
        ),
    },
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="Failed jobs" value={failed.length} tone={failed.length ? "attention" : undefined} />
        <Stat label="Printers not online" value={s.printers.filter((p) => !p.active || (p.health && p.health !== "Online")).length} />
        <Reading id="QT-R35" />
      </div>
      <div role="tablist" aria-label="Print queue" className="flex gap-1 border-b">
        {([["Failed", `Failed (${failed.length})`], ["all", `All jobs (${s.printJobs.length})`]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-8 border-b-2 px-3 text-sm ${tab === id ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      <DataTable rows={rows} columns={cols} rowId={(j) => j.id} densityKey="BC-PJ" searchText={(j) => `${j.id} ${j.labelId} ${j.error}`} empty={{ title: "No failed prints", body: "Jobs that fail on a printer wait here until retried, redirected or cancelled." }} />
      <Section title="Printers needing attention">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {s.printers.filter((p) => !p.active || (p.health && p.health !== "Online")).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <span>
                <span className="block font-medium">{p.id} · {p.station}</span>
                <span className="block text-muted-foreground"><PrinterHealth health={p.health} active={p.active} /></span>
              </span>
              <Button size="sm" variant="outline" disabled={locked || !p.active} onClick={() => report(printQ.fixPrinter(p.id), `${p.station} is back online`)}>Fixed at the device</Button>
            </li>
          ))}
          {s.printers.every((p) => p.active && (!p.health || p.health === "Online")) && <li className="text-muted-foreground">All printers are online.</li>}
        </ul>
        <p className="text-xs text-muted-foreground">Fix the paper, ribbon or connection at the device, then mark it fixed and retry the job. Inactive printers are activated in the registry.</p>
      </Section>
      <DialogShell
        open={target?.mode === "redirect"}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Redirect ${target?.j.id}`}
        consequence={`Prints ${target?.j.labelId} on the printer you choose instead of ${target?.j.printerId}; the job leaves the failed queue and the redirect is logged.`}
        confirmLabel="Redirect and print"
        onConfirm={() => {
          if (!target) return null
          const r = printQ.redirect(target.j.id, prn)
          return report(r, `${target.j.id} printed on ${prn}`) ? null : (r as { error: string }).error
        }}
      >
        {alts.length ? (
          <Pick id="pj-prn" label="Online printer that carries this label type" value={prn} onChange={setPrn} options={alts.map((p) => ({ value: p.id, label: `${p.id} · ${p.station}` }))} />
        ) : (
          <EmptyState title="No online printer carries this label type">Fix the original printer, or register a printer for {target?.j.template}.</EmptyState>
        )}
      </DialogShell>
      <DialogShell
        open={target?.mode === "cancel"}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Cancel ${target?.j.id}`}
        consequence={`Drops the print job for ${target?.j.labelId}; nothing prints and the cancellation is logged with your reason.`}
        confirmLabel="Cancel job"
        destructive
        requireReason
        onConfirm={(reason) => {
          if (!target) return null
          const r = printQ.cancel(target.j.id, reason)
          return report(r, `${target.j.id} cancelled`) ? null : (r as { error: string }).error
        }}
      />
    </div>
  )
}

const RESULTS = ["OK", "Rejected", "Failed", "Queued", "Replayed"] as const
export function TelemetryLog() {
  const s = useSlice("qualityTrace")
  const [res, setRes] = useState<string>("all")
  const rows = s.telemetry.filter((t) => res === "all" || t.result === res)
  const cols: Column<ScanTelemetry>[] = [
    { id: "at", header: "Timestamp", value: (t) => t.at, mono: true, sortable: true, cell: (t) => t.at.replace("T", " ") },
    { id: "dev", header: "Device", value: (t) => t.device, filterable: true, cell: (t) => <span>{t.device}{t.camera && <> <Chip kind="design" note="Camera fallback scan, supervisors only, logged">Camera</Chip></>}</span> },
    { id: "user", header: "User", value: (t) => userName(t.userId), filterable: true },
    { id: "sp", header: "Scan point", value: (t) => t.sp, filterable: true, cell: (t) => `${t.sp} · ${SCAN_POINTS[t.sp].step}` },
    { id: "payload", header: "Payload", value: (t) => t.payload, mono: true },
    { id: "result", header: "Result", value: (t) => t.result, filterable: true, cell: (t) => (t.result === "OK" || t.result === "Replayed" ? t.result : <Chip kind="flag">{t.result}</Chip>) },
    { id: "err", header: "Detail", value: (t) => t.error ?? "" },
  ]
  const fails = s.telemetry.filter((t) => t.result === "Rejected" || t.result === "Failed")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="Events in view" value={s.telemetry.length} />
        <Stat label="Rejected or failed" value={fails.length} tone={fails.length ? "attention" : undefined} />
        <Stat label="Camera scans" value={s.telemetry.filter((t) => t.camera).length} />
        <span className="text-xs text-muted-foreground">Kept 24 months in the real system (DOC p.97); the prototype shows the last days.</span>
      </div>
      <div role="group" aria-label="Result filter" className="flex flex-wrap gap-1">
        {["all", ...RESULTS].map((r) => (
          <Button key={r} size="sm" variant={res === r ? "default" : "outline"} aria-pressed={res === r} onClick={() => setRes(r)}>
            {r === "all" ? "All results" : r}
          </Button>
        ))}
      </div>
      <DataTable rows={rows} columns={cols} rowId={(t) => t.id} densityKey="BC-TLM" searchText={(t) => `${t.payload} ${t.device} ${t.sp} ${t.error ?? ""}`} searchPlaceholder="Search payload, device, scan point" initialSort={{ id: "at", dir: "desc" }} empty={{ title: "No scan events", body: "Every scan, failures included, is logged with device, user, timestamp, payload and result." }} />
    </div>
  )
}
