// OPS-JOBS Job console (Workbench, one of the OPS-JOBS/INT pair) [DOC:pp.275-276 §15] (asserted):
// "Job runs with SLA timers and dependency chains. Retry. Escalate per severity." W.3 standing job
// catalog [DOC:p.11]; job contracts [DOC:p.217 §7.7]; batch framework and severity matrix
// [DOC:p.190 Book III D §5]. Close-critical jobs hold the period-close gate (FL-06).
// Run states have no list in the specification: text, never a badge (AR-1).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Chip, DataTable, ErrorAlert, KV, PostingPreview, RulesPanel, useFirstVisitLoading, type Column } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import type { LegalEntityId } from "@/data/domain"
import { LEGAL_ENTITIES, OPEN_PERIOD } from "@/data/shared"
import { useSlice } from "@/store"
import { JOBS, SEVERITIES, jobById, type JobDef, type Severity } from "../data/catalog"
import { NOW } from "../data/seed"
import { escalate, retryRun, runNow, setIncident, triggerJob } from "../data/actions"
import type { JobRun } from "../data/types"
import { fmtDateTime, fmtDuration, hoursBetween, prevMonth } from "../lib/time"
import { act, Field, SimpleSelect, StateText } from "../components/common"

type Queue = "attention" | "upcoming" | "all"

export function OpsJobs() {
  const s = useSlice("admin")
  const loading = useFirstVisitLoading("OPS-JOBS")
  const [params, setParams] = useSearchParams()
  const [queue, setQueue] = useState<Queue>("attention")
  const [dialog, setDialog] = useState<null | "start" | "escalate">(null)
  const runId = params.get("run")
  const jobFilter = params.get("job")
  const active = s.runs.find((r) => r.id === runId)
  const base = jobFilter ? s.runs.filter((r) => r.jobId === jobFilter) : s.runs
  const needs = (r: JobRun) => (r.state === "Failed" && !r.retriedBy) || r.state === "Held (dependency)"
  const rows = base.filter((r) => (queue === "attention" ? needs(r) : queue === "upcoming" ? r.state === "Scheduled" || r.state === "Running" : true))
  const failedCrit = s.runs.filter((r) => r.state === "Failed" && !r.retriedBy && jobById(r.jobId)?.closeCriticality === "Close-critical")

  const columns: Column<JobRun>[] = [
    { id: "id", header: "Run", value: (r) => r.id, mono: true, sortable: true },
    { id: "job", header: "Job", value: (r) => jobById(r.jobId)?.name ?? r.jobId, filterable: true },
    { id: "scope", header: "Period / entity", value: (r) => (r.period ? `${r.period} ${r.entityId ?? ""}` : "") },
    { id: "when", header: "Scheduled", value: (r) => r.scheduledAt, cell: (r) => <span className="text-xs tabular">{fmtDateTime(r.scheduledAt)}</span>, sortable: true },
    { id: "state", header: "State", value: (r) => r.state, filterable: true, cell: (r) => <StateText tone={needs(r) ? "attention" : r.state === "Succeeded" ? "muted" : "default"}>{r.state}{r.retriedBy ? ` · retried by ${r.retriedBy}` : ""}</StateText> },
    { id: "attempt", header: "Attempt", value: (r) => r.attempt, align: "right", mono: true },
    { id: "sla", header: "SLA timer", value: (r) => r.state, cell: (r) => <SlaTimer run={r} /> },
    { id: "out", header: "Output or error", value: (r) => r.error ?? r.output ?? "", className: "max-w-[320px]" },
    { id: "crit", header: "Close-critical", value: (r) => jobById(r.jobId)?.closeCriticality ?? "", filterable: true },
  ]

  return (
    <div className="flex flex-col gap-8">
      {runId && !active && <ErrorAlert title={`Run ${runId} not found`} onDismiss={() => setParams({})}>It may have been cleared by Scenario reset.</ErrorAlert>}
      <WorkbenchPage<JobRun>
        header={{
          title: "Job console",
          screenId: "OPS-JOBS/INT",
          description: "Background processing on the one batch framework: run history, SLA timers, dependency chains, auto-retry and failure escalation. Failed close-critical jobs hold the period-close gate and page on-call, never just log.",
          chips: <Chip kind="design" note="Route /operations/jobs and the run state words are design values; Book VI gives /operations/* (AR-1)">Design route</Chip>,
          crumbs: [{ label: "Job console" }],
          actions: <Button variant="outline" asChild><Link to="/operations/integrations">Integration console</Link></Button>,
          primary: <Button onClick={() => setDialog("start")}>Start a job</Button>,
        }}
        kpis={[
          { label: "Failed, not retried", value: s.runs.filter((r) => r.state === "Failed" && !r.retriedBy).length },
          { label: "Close-critical holding the close", value: failedCrit.length, hint: failedCrit.map((r) => `${r.entityId} ${r.period}`).join(", ") || undefined },
          { label: "Running or scheduled", value: s.runs.filter((r) => r.state === "Running" || r.state === "Scheduled").length },
          { label: "Open incidents", value: s.incidents.filter((i) => i.state !== "Resolved").length },
        ]}
        queues={[
          { id: "attention", label: "Needs attention", count: base.filter(needs).length },
          { id: "upcoming", label: "Running and scheduled", count: base.filter((r) => r.state === "Scheduled" || r.state === "Running").length },
          { id: "all", label: jobFilter ? `All runs of ${jobFilter}` : "All runs", count: base.length },
        ]}
        queue={queue}
        onQueueChange={(q) => setQueue(q as Queue)}
        table={{
          rows,
          columns,
          rowId: (r) => r.id,
          loading,
          onRowClick: (r) => setParams({ run: r.id }),
          activeId: active?.id,
          searchText: (r) => `${r.id} ${r.jobId} ${jobById(r.jobId)?.name} ${r.output ?? ""} ${r.error ?? ""} ${r.correlationId}`,
          searchPlaceholder: "Search runs, jobs, correlation ids",
          initialSort: { id: "when", dir: "desc" },
          empty: { title: queue === "attention" ? "No failed or held runs." : "Nothing in this queue.", body: queue === "attention" ? "Every job's last run succeeded." : undefined },
          caption: "Job runs",
        }}
        panel={{
          open: !!active,
          onOpenChange: (o) => !o && setParams(jobFilter ? { job: jobFilter } : {}),
          title: active ? `${active.id} · ${jobById(active.jobId)?.name}` : "",
          description: active ? `${active.state}${active.period ? ` · ${active.period} ${active.entityId}` : ""}` : undefined,
          content: active && <RunPanel run={active} onEscalate={() => setDialog("escalate")} />,
        }}
      />

      <section aria-label="Incidents">
        <h2 className="mb-2 text-sm font-semibold">Incidents</h2>
        <DataTable
          rows={s.incidents}
          rowId={(i) => i.id}
          densityKey="OPS-incidents"
          caption="Incidents"
          empty={{ title: "No incidents." }}
          columns={[
            { id: "id", header: "Incident", value: (i) => i.id, mono: true },
            { id: "sev", header: "Severity", value: (i) => i.severity, filterable: true },
            { id: "title", header: "What", value: (i) => i.title },
            { id: "src", header: "Source", value: (i) => i.source.id, cell: (i) => <Link className="font-mono text-link underline-offset-4 hover:underline" to={i.source.kind === "job" ? `/operations/jobs?run=${i.source.id}` : `/operations/integrations?msg=${i.source.id}`}>{i.source.id}</Link> },
            { id: "due", header: "Response due", value: (i) => i.responseDue, cell: (i) => <span className="text-xs">{i.responseDue === "Queued" ? "Queued" : fmtDateTime(i.responseDue)}</span> },
            { id: "state", header: "State", value: (i) => i.state, filterable: true },
            { id: "act", header: "", cell: (i) => (i.state === "Resolved" ? "" : <span className="flex gap-1">{i.state === "Open" && <Button size="sm" variant="ghost" onClick={() => act(setIncident(i.id, "Acknowledged"))}>Acknowledge</Button>}<Button size="sm" variant="ghost" onClick={() => act(setIncident(i.id, "Resolved"))}>Resolve</Button></span>) },
          ]}
        />
        <p className="mt-1 text-xs text-muted-foreground">Severity matrix: {SEVERITIES.map((x) => `${x.id} ${x.rule} → ${x.response}`).join(" · ")} [DOC:p.190 D §5] (asserted). On-call role is Plant IT (AR-20).</p>
      </section>

      <section aria-label="Job catalog">
        <h2 className="mb-2 text-sm font-semibold">Standing job catalog (W.3) and job contracts</h2>
        <DataTable<JobDef>
          rows={JOBS}
          rowId={(j) => j.id}
          densityKey="OPS-catalog"
          caption="Job catalog"
          rowHref={(j) => `/operations/jobs?job=${j.id}`}
          columns={[
            { id: "id", header: "Job", value: (j) => j.id, mono: true },
            { id: "name", header: "Name", value: (j) => j.name },
            { id: "cal", header: "Calendar", value: (j) => j.calendar },
            { id: "crit", header: "Close-criticality", value: (j) => j.closeCriticality, filterable: true },
            { id: "dep", header: "Depends on", value: (j) => j.dependsOn.map((d) => `${d} ${jobById(d)?.name}`).join(", ") || "None" },
            { id: "retry", header: "Retry policy", value: (j) => j.retryPolicy },
            { id: "idem", header: "Idempotency key", value: (j) => j.idempotencyKey },
            { id: "out", header: "Output", value: (j) => j.output, cell: (j) => (j.screen ? <span>{j.output} · <Link className="text-link underline-offset-4 hover:underline" to={j.screen.route}>{j.screen.id}</Link></span> : j.output) },
            { id: "rec", header: "Reconciliation", value: (j) => j.reconciliation },
          ]}
        />
        <p className="mt-1 text-xs text-muted-foreground">Names and calendars from W.3 [DOC:p.11]; contract fields from §7.7 [DOC:p.217]. SLA minutes, retry counts, owners and times of day are design values (AR-21).</p>
      </section>

      <RulesPanel
        rules={[
          ["W.3", "Jobs declare their close-criticality so the period-close gate (FL-06) can hold on failures automatically", "DOC:p.11 W.3"],
          ["D§5", "Batch framework with run history, SLA timers, dependency chains, auto-retry policy and failure escalation; failed close-critical jobs page, never just log", "DOC:p.190 D §5"],
          ["FL-06", "Steps re-runnable; allocation rerun = reversal + repost; failed batch steps hold the gate", "DOC:pp.180-181 FL-06"],
        ]}
      />

      <StartJobDialog open={dialog === "start"} onClose={() => setDialog(null)} />
      <EscalateDialog open={dialog === "escalate"} onClose={() => setDialog(null)} source={active ? { kind: "job", id: active.id } : undefined} title={active ? `${jobById(active.jobId)?.name} ${active.state.toLowerCase()} (${active.id})` : ""} />
    </div>
  )
}

function SlaTimer({ run }: { run: JobRun }) {
  const job = jobById(run.jobId)
  if (!job) return null
  const sla = job.slaMinutes / 60
  if (run.state === "Running" && run.startedAt) {
    const age = hoursBetween(run.startedAt, NOW)
    return <span className={age > sla ? "text-xs font-semibold text-status-pending-ink" : "text-xs text-muted-foreground"}>{fmtDuration(age)} of {fmtDuration(sla)}</span>
  }
  if (run.startedAt && run.endedAt) return <span className="text-xs text-muted-foreground">{fmtDuration(hoursBetween(run.startedAt, run.endedAt))} (SLA {fmtDuration(sla)})</span>
  return <span className="text-xs text-muted-foreground">SLA {fmtDuration(sla)}</span>
}

function RunPanel({ run, onEscalate }: { run: JobRun; onEscalate: () => void }) {
  const s = useSlice("admin")
  const job = jobById(run.jobId)!
  const history = s.runs.filter((r) => r.jobId === run.jobId && r.entityId === run.entityId && r.period === run.period)
  const dependents = JOBS.filter((j) => j.dependsOn.includes(job.id))
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4">
        <KV k="Calendar">{job.calendar}</KV>
        <KV k="Close-criticality">{job.closeCriticality}</KV>
        <KV k="Depends on">{job.dependsOn.map((d) => jobById(d)?.name).join(", ") || "None"}</KV>
        <KV k="Needed by">{dependents.map((d) => d.name).join(", ") || "None"}</KV>
        <KV k="Retry policy">{job.retryPolicy}</KV>
        <KV k="Idempotency key">{job.idempotencyKey}</KV>
        <KV k="Owner">{job.owner}</KV>
        <KV k="Correlation id"><Link className="font-mono text-link underline-offset-4 hover:underline" to={`/operations/integrations?cor=${run.correlationId}`}>{run.correlationId}</Link></KV>
        <KV k="Started">{fmtDateTime(run.startedAt)}</KV>
        <KV k="Ended">{fmtDateTime(run.endedAt)}</KV>
      </dl>
      {run.error && <ErrorAlert title={`${run.state}: attempt ${run.attempt}`}>{run.error}</ErrorAlert>}
      {run.output && <p className="text-sm">Output: {run.output}{job.screen && <> · <Link className="text-link underline-offset-4 hover:underline" to={job.screen.route}>{job.screen.id}</Link></>}</p>}
      <p className="text-xs text-muted-foreground">Reconciliation: {job.reconciliation}</p>
      {run.jobId === "JOB-07" && run.state === "Failed" && (
        <PostingPreview title="Posting on a successful retry" period={run.period} lines={[{ template: 24, amount: 41280, detail: `Warranty accrual ${run.period}, ${run.entityId}: accrual % × FG shipments (amount is a design value)` }]} />
      )}
      {run.posting && <PostingPreview title="Posted by this run" period={run.period} lines={[{ template: run.posting.template, amount: run.posting.amount, currency: run.entityId === "LE-TBD-30" ? "CAD" : "USD" }]} />}
      {run.jobId === "JOB-06" && <p className="text-xs text-muted-foreground">Allocation postings (#36) belong to CO-ALC-001/2; the console starts the cycle and shows its result.</p>}
      <div className="flex flex-wrap gap-2">
        {run.state === "Failed" && !run.retriedBy && <Button onClick={() => act(retryRun(run.id))}>Retry</Button>}
        {run.retriedBy && <Link className="self-center text-sm text-link underline-offset-4 hover:underline" to={`/operations/jobs?run=${run.retriedBy}`}>Retried by {run.retriedBy}</Link>}
        {(run.state === "Scheduled" || run.state === "Held (dependency)") && <Button onClick={() => act(runNow(run.id))}>Run now</Button>}
        {(run.state === "Failed" || run.state === "Held (dependency)") && <Button variant="outline" onClick={onEscalate} disabled={!!run.incidentId && s.incidents.some((i) => i.id === run.incidentId && i.state !== "Resolved")}>Escalate</Button>}
        {run.incidentId && <span className="self-center text-xs">Incident {run.incidentId} · {s.incidents.find((i) => i.id === run.incidentId)?.state}</span>}
      </div>
      <section aria-label="Run history">
        <h3 className="text-sm font-semibold">History of this job{run.period ? ` for ${run.period} ${run.entityId}` : ""}</h3>
        <ol className="text-xs">
          {history.map((h) => <li key={h.id}><span className="font-mono">{h.id}</span> · {fmtDateTime(h.scheduledAt)} · attempt {h.attempt} · {h.state}{h.error ? `: ${h.error}` : ""}</li>)}
        </ol>
      </section>
    </div>
  )
}

function StartJobDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [jobId, setJobId] = useState("JOB-05")
  const [entity, setEntity] = useState<string>("LE-TBD-10")
  const job = jobById(jobId)!
  const periodEnd = job.calendar.startsWith("Period-end")
  const period = prevMonth(OPEN_PERIOD)
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Start a job"
      consequence={`Starts ${job.name} now${periodEnd ? ` for ${period}, ${entity}` : ""}; it runs once with idempotency key “${job.idempotencyKey}”.`}
      confirmLabel="Start"
      onConfirm={() => act(triggerJob(jobId, periodEnd ? period : undefined, periodEnd ? (entity as LegalEntityId) : undefined))}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field id="sj-job" label="Job"><SimpleSelect id="sj-job" value={jobId} onChange={setJobId} options={JOBS.map((j) => ({ value: j.id, label: `${j.id} ${j.name}` }))} /></Field>
        {periodEnd && <Field id="sj-ent" label="Entity"><SimpleSelect id="sj-ent" value={entity} onChange={setEntity} options={LEGAL_ENTITIES.map((e) => ({ value: e.id, label: e.name }))} /></Field>}
      </div>
    </DialogShell>
  )
}

export function EscalateDialog({ open, onClose, source, title }: { open: boolean; onClose: () => void; source?: { kind: "job" | "message" | "interface"; id: string }; title: string }) {
  const [sev, setSev] = useState<Severity>("S2")
  const def = SEVERITIES.find((x) => x.id === sev)!
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Escalate per severity"
      consequence={`Opens an incident for ${source?.id ?? ""} at ${sev}: ${def.rule}; response ${def.response}. On-call (Plant IT) is paged for S1 and S2.`}
      confirmLabel="Open incident"
      onConfirm={() => (source ? act(escalate(source, sev, title)) : "Nothing selected.")}
    >
      <Field id="esc-sev" label="Severity"><SimpleSelect id="esc-sev" value={sev} onChange={(v) => setSev(v as Severity)} options={SEVERITIES.map((x) => ({ value: x.id, label: `${x.id}: ${x.rule}` }))} /></Field>
      <p className="text-xs text-muted-foreground">Opened by the acting user; the incident timeline starts now.</p>
    </DialogShell>
  )
}
