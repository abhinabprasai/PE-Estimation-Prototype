// OPS-INT Integration console (Workbench, one of the OPS-JOBS/INT pair) [DOC:pp.275-276 §15]:
// "Message monitor with lag, DLQ depth, correlation search, replay tools. Retry. Replay after fix.
// Escalate per severity." Interface catalog IF-01..IF-20 [DOC:pp.185-186 B §3]; console elements
// [DOC:p.187 B §4]: message monitor per interface, DLQ inspect / edit-and-replay (restricted and
// audited) / bulk replay after fix / discard with mandatory reason (financially relevant command
// needs the Controller), correlation tracing. Message states are text, not badges (AR-1).

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Chip, DataTable, EmptyState, ErrorAlert, KV, RulesPanel, StatusBadge, useFirstVisitLoading, type Column } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import { docRoute } from "@/data/domain"
import { HERO } from "@/data/shared"
import { store, useCore, useSlice } from "@/store"
import { INTERFACES, RECON_SCHEDULE, interfaceById, jobById, type InterfaceDef } from "../data/catalog"
import { canEditPayload, discard, markFixed, replay, runRecon } from "../data/actions"
import type { InterfaceMessage } from "../data/types"
import { fmtDateTime, fmtDuration } from "../lib/time"
import { act, Field, StateText } from "../components/common"
import { EscalateDialog } from "./OpsJobs"
import { SagaPanel } from "../components/SagaPanel"

type Queue = "dlq" | "retrying" | "all"
const failed = (m: InterfaceMessage) => m.state === "Dead-lettered" || m.state === "Retrying"
const HERO_COR = "COR-7F3A-0301"

export function OpsIntegrations() {
  const s = useSlice("admin")
  const { role } = useCore()
  const loading = useFirstVisitLoading("OPS-INT")
  const [params, setParams] = useSearchParams()
  const [queue, setQueue] = useState<Queue>("dlq")
  const [dialog, setDialog] = useState<null | "fix" | "edit" | "discard" | "escalate">(null)
  const [payload, setPayload] = useState("")
  const ifFilter = params.get("if")
  const msgId = params.get("msg")
  const cor = params.get("cor") ?? ""
  const [corInput, setCorInput] = useState(cor)
  const active = s.messages.find((m) => m.id === msgId)
  const base = ifFilter ? s.messages.filter((m) => m.interfaceId === ifFilter) : s.messages
  const rows = base.filter((m) => (queue === "dlq" ? m.state === "Dead-lettered" : queue === "retrying" ? m.state === "Retrying" : true))
  const latestRecon = (id: string) => s.recon.filter((r) => r.interfaceId === id).sort((a, b) => b.at.localeCompare(a.at))[0]
  const dlqDepth = (id: string) => s.messages.filter((m) => m.interfaceId === id && m.state === "Dead-lettered").length
  const setParam = (k: string, v?: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next)
  }

  const columns: Column<InterfaceMessage>[] = [
    { id: "id", header: "Message", value: (m) => m.id, mono: true, sortable: true },
    { id: "if", header: "Interface", value: (m) => m.interfaceId, filterable: true, cell: (m) => <span><span className="font-mono">{m.interfaceId}</span> <span className="text-xs text-muted-foreground">{interfaceById(m.interfaceId)?.name}</span></span> },
    { id: "at", header: "Produced", value: (m) => m.at, sortable: true, cell: (m) => <span className="text-xs tabular">{fmtDateTime(m.at)}</span> },
    { id: "doc", header: "Document", value: (m) => m.docRef?.id ?? "", cell: (m) => (m.docRef ? <Link onClick={(e) => e.stopPropagation()} to={docRoute(m.docRef)} className="font-mono text-link underline-offset-4 hover:underline">{m.docRef.id}</Link> : "") },
    { id: "summary", header: "What", value: (m) => m.summary, className: "max-w-[320px]" },
    { id: "state", header: "State", value: (m) => m.state, filterable: true, cell: (m) => <StateText tone={failed(m) ? "attention" : "muted"}>{m.state}{m.fixed && failed(m) ? " · fixed" : ""}</StateText> },
    { id: "att", header: "Attempts", value: (m) => m.attempts, align: "right", mono: true },
    { id: "cor", header: "Correlation", value: (m) => m.correlationId, mono: true },
  ]

  const trace = useMemo(() => {
    const q = cor.trim()
    if (!q) return []
    const msgs = s.messages.filter((m) => m.correlationId === q || m.docRef?.id === q).map((m) => ({ at: m.at, kind: `${m.interfaceId} message`, id: m.id, what: m.summary, state: m.state, doc: m.docRef, href: `/operations/integrations?msg=${m.id}&cor=${q}` }))
    const runs = s.runs.filter((r) => r.correlationId === q).map((r) => ({ at: r.scheduledAt, kind: "Job run", id: r.id, what: `${jobById(r.jobId)?.name}: ${r.output ?? r.error ?? ""}`, state: r.state, doc: undefined, href: `/operations/jobs?run=${r.id}` }))
    return [...msgs, ...runs].sort((a, b) => a.at.localeCompare(b.at))
  }, [cor, s.messages, s.runs])

  return (
    <div className="flex flex-col gap-8">
      {msgId && !active && <ErrorAlert title={`Message ${msgId} not found`} onDismiss={() => setParam("msg")}>It may have been cleared by Scenario reset.</ErrorAlert>}
      <WorkbenchPage<InterfaceMessage>
        header={{
          title: "Integration console",
          screenId: "OPS-JOBS/INT",
          description: "Message monitor per cataloged interface: throughput, lag, error rate, DLQ depth and oldest unprocessed age; drill to a message with its full envelope and correlation chain. No module-to-module dependency exists unless it is in this catalog.",
          chips: <Chip kind="design" note="Route /operations/integrations, message state words and monitor figures are design values (AR-1, AR-22)">Design route</Chip>,
          crumbs: [{ label: "Integration console" }],
          actions: (
            <>
              {ifFilter && <Button variant="ghost" onClick={() => setParam("if")}>Clear {ifFilter}</Button>}
              <Button variant="outline" asChild><Link to="/operations/jobs">Job console</Link></Button>
            </>
          ),
        }}
        kpis={[
          { label: "DLQ depth", value: s.messages.filter((m) => m.state === "Dead-lettered").length, hint: "all interfaces" },
          { label: "Retrying", value: s.messages.filter((m) => m.state === "Retrying").length },
          { label: "Interfaces with errors", value: s.stats.filter((x) => x.errorRatePct > 0).length, hint: "error rate above 0% this hour" },
          { label: "Oldest unprocessed", value: fmtDuration(Math.max(...s.stats.map((x) => x.oldestUnprocessedMin)) / 60), hint: s.stats.reduce((a, b) => (b.oldestUnprocessedMin > a.oldestUnprocessedMin ? b : a)).interfaceId },
        ]}
        queues={[
          { id: "dlq", label: "Dead letters", count: base.filter((m) => m.state === "Dead-lettered").length },
          { id: "retrying", label: "Retrying", count: base.filter((m) => m.state === "Retrying").length },
          { id: "all", label: ifFilter ? `All ${ifFilter} messages` : "All messages", count: base.length },
        ]}
        queue={queue}
        onQueueChange={(q) => setQueue(q as Queue)}
        bulkActions={(sel, clear) => (
          <Button size="sm" variant="outline" onClick={() => { if (!act(replay(sel))) clear() }}>
            Replay selected after fix
          </Button>
        )}
        table={{
          rows,
          columns,
          rowId: (m) => m.id,
          loading,
          onRowClick: (m) => setParam("msg", m.id),
          activeId: active?.id,
          searchText: (m) => `${m.id} ${m.interfaceId} ${m.summary} ${m.docRef?.id ?? ""} ${m.correlationId} ${m.error ?? ""}`,
          searchPlaceholder: "Search messages",
          initialSort: { id: "at", dir: "desc" },
          empty: { title: queue === "dlq" ? "The dead-letter queue is empty." : "No messages in this queue.", body: queue === "dlq" ? "Every message was delivered or replayed." : undefined },
          caption: "Interface messages",
        }}
        panel={{
          open: !!active,
          onOpenChange: (o) => !o && setParam("msg"),
          title: active ? `${active.id} · ${active.interfaceId}` : "",
          description: active?.summary,
          content: active && (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-4">
                <KV k="Interface">{interfaceById(active.interfaceId)?.name} ({interfaceById(active.interfaceId)?.flow})</KV>
                <KV k="State">{active.state}{active.fixed ? " · root cause fixed" : ""}</KV>
                <KV k="Attempts">{active.attempts}</KV>
                <KV k="Produced">{fmtDateTime(active.at)}</KV>
                <KV k="Document">{active.docRef ? <Link className="font-mono text-link underline-offset-4 hover:underline" to={docRoute(active.docRef)}>{active.docRef.id}</Link> : "None"}</KV>
                <KV k="Correlation"><button className="font-mono text-link underline-offset-4 hover:underline" onClick={() => { setCorInput(active.correlationId); setParam("cor", active.correlationId) }}>{active.correlationId}</button></KV>
              </dl>
              {active.error && <ErrorAlert title="Last error">{active.error}</ErrorAlert>}
              {active.discardReason && <p className="text-sm">Discarded: {active.discardReason}</p>}
              <section aria-label="Envelope">
                <h3 className="text-sm font-semibold">Envelope</h3>
                <dl className="grid grid-cols-1 gap-1 rounded-md border p-2 font-mono text-xs">
                  {Object.entries(active.envelope).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-muted-foreground">{k}</dt><dd>{String(v)}</dd></div>)}
                  {active.editedPayload && <div className="flex gap-2"><dt className="text-muted-foreground">edited_payload</dt><dd>{active.editedPayload}</dd></div>}
                </dl>
              </section>
              {failed(active) && (
                <div className="flex flex-wrap gap-2">
                  {!active.fixed && <Button variant="outline" onClick={() => setDialog("fix")}>Mark root cause fixed</Button>}
                  <Button onClick={() => act(replay([active.id]))} disabled={!active.fixed} title={active.fixed ? undefined : "Replay after fix: mark the root cause fixed first"}>Replay</Button>
                  <Button variant="outline" onClick={() => { setPayload(JSON.stringify(active.envelope)); setDialog("edit") }} disabled={!canEditPayload(role) || !active.fixed} title={!canEditPayload(role) ? "Edit-and-replay is restricted to Plant IT, Engineering IT and Quality IT (AR-23)" : !active.fixed ? "Mark the root cause fixed first" : undefined}>Edit and replay</Button>
                  <Button variant="outline" onClick={() => setDialog("discard")}>Discard</Button>
                  <Button variant="ghost" onClick={() => setDialog("escalate")}>Escalate</Button>
                </div>
              )}
              {interfaceById(active.interfaceId)?.financial && failed(active) && <p className="text-xs text-muted-foreground">{active.interfaceId} carries a financially relevant command: discarding it requires the Controller.</p>}
            </div>
          ),
        }}
      />

      <section aria-label="Correlation search" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Correlation search</h2>
        <p className="text-sm text-muted-foreground">One search reconstructs the distributed flow from the originating action through every event, job and posting [DOC:p.187 §4].</p>
        <form className="flex max-w-2xl gap-2" onSubmit={(e) => { e.preventDefault(); setParam("cor", corInput.trim() || undefined) }}>
          <Input aria-label="Correlation id or document id" value={corInput} onChange={(e) => setCorInput(e.target.value)} placeholder="COR-… or a document id" />
          <Button type="submit" variant="outline"><Search aria-hidden="true" /> Trace</Button>
          <Button type="button" variant="ghost" onClick={() => { setCorInput(HERO_COR); setParam("cor", HERO_COR) }}>Trace {HERO.phase1Order}</Button>
        </form>
        {cor && (trace.length === 0 ? (
          <EmptyState title={`Nothing carries ${cor}.`}>Try a correlation id from a message, or a document id such as {HERO.phase1Order}.</EmptyState>
        ) : (
          <ol className="flex flex-col gap-1 border-l-2 pl-4 text-sm">
            {trace.map((t) => {
              const info = t.doc ? store.lookup(t.doc) : undefined
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-xs text-muted-foreground">{fmtDateTime(t.at)}</span>
                  <span className="text-xs">{t.kind}</span>
                  <Link to={t.href} className="font-mono text-link underline-offset-4 hover:underline">{t.id}</Link>
                  <span>{t.what}</span>
                  {t.doc && <Link to={docRoute(t.doc)} className="font-mono text-xs text-link underline-offset-4 hover:underline">{t.doc.id}</Link>}
                  {info?.status && <StatusBadge kind={info.status.kind} status={info.status.value} size="sm" />}
                  <StateText tone={t.state === "Dead-lettered" || t.state === "Failed" ? "attention" : "muted"}>{t.state}</StateText>
                </li>
              )
            })}
          </ol>
        ))}
      </section>

      <SagaPanel />

      <section aria-label="Message monitor">
        <h2 className="mb-2 text-sm font-semibold">Message monitor: interface catalog IF-01 to IF-20</h2>
        <DataTable<InterfaceDef>
          rows={INTERFACES}
          rowId={(f) => f.id}
          densityKey="OPS-INT-monitor"
          caption="Interface monitor"
          onRowClick={(f) => { setParam("if", f.id); setQueue("all") }}
          activeId={ifFilter ?? undefined}
          columns={[
            { id: "id", header: "Id", value: (f) => f.id, mono: true },
            { id: "name", header: "Interface", value: (f) => f.name, cell: (f) => <span>{f.name}{f.phase && <span className="text-xs text-muted-foreground"> · {f.phase}</span>}</span> },
            { id: "type", header: "Type", value: (f) => f.type },
            { id: "flow", header: "Producer → consumer", value: (f) => f.flow },
            { id: "owner", header: "Owner", value: (f) => f.owner, filterable: true },
            { id: "tp", header: "Per hour", value: (f) => s.stats.find((x) => x.interfaceId === f.id)?.throughputPerHour ?? 0, align: "right", mono: true, sortable: true },
            { id: "lag", header: "Lag", value: (f) => s.stats.find((x) => x.interfaceId === f.id)?.lagSeconds ?? 0, align: "right", mono: true, sortable: true, cell: (f) => { const l = s.stats.find((x) => x.interfaceId === f.id)?.lagSeconds ?? 0; return l >= 60 ? fmtDuration(l / 3600) : `${l} s` } },
            { id: "err", header: "Error rate", value: (f) => s.stats.find((x) => x.interfaceId === f.id)?.errorRatePct ?? 0, align: "right", mono: true, sortable: true, cell: (f) => `${s.stats.find((x) => x.interfaceId === f.id)?.errorRatePct ?? 0}%` },
            { id: "dlq", header: "DLQ depth", value: (f) => dlqDepth(f.id), align: "right", mono: true, sortable: true },
            { id: "old", header: "Oldest unprocessed", value: (f) => s.stats.find((x) => x.interfaceId === f.id)?.oldestUnprocessedMin ?? 0, align: "right", sortable: true, cell: (f) => { const m = s.stats.find((x) => x.interfaceId === f.id)?.oldestUnprocessedMin ?? 0; return m ? fmtDuration(m / 60) : "None" } },
            { id: "rec", header: "Reconciliation control", value: (f) => f.reconciliation, className: "max-w-[260px]" },
          ]}
        />
      </section>

      <section aria-label="Reconciliation reports">
        <h2 className="mb-2 text-sm font-semibold">Reconciliation reports</h2>
        <p className="mb-2 max-w-3xl text-sm">
          The per-interface control of §3 runs on a schedule. A failed control opens an incident and pages on-call per Part D §5; it is never just logged [DOC:p.187 §4]. Run one now to check an interface after a fix.
        </p>
        <DataTable<InterfaceDef>
          rows={INTERFACES}
          rowId={(f) => f.id}
          loading={loading}
          densityKey="OPS-INT-recon"
          caption="Reconciliation reports"
          empty={{ title: "No interfaces." }}
          columns={[
            { id: "id", header: "Interface", value: (f) => `${f.id} ${f.name}`, cell: (f) => <span><span className="font-mono">{f.id}</span> {f.name}</span> },
            { id: "ctl", header: "Control (§3)", value: (f) => f.reconciliation, className: "max-w-[280px]" },
            { id: "sched", header: "Schedule", value: (f) => RECON_SCHEDULE[f.id] ?? "", cell: (f) => <span className="text-xs">{f.phase ? `${RECON_SCHEDULE[f.id]} · ${f.phase}` : RECON_SCHEDULE[f.id]}</span> },
            { id: "last", header: "Last run", value: (f) => latestRecon(f.id)?.at ?? "", sortable: true, cell: (f) => { const r = latestRecon(f.id); return r ? <span className="text-xs tabular">{fmtDateTime(r.at)}<br />{r.by === "Scheduler" ? "Scheduler" : "Run by a user"}</span> : <span className="text-xs text-muted-foreground">No run yet</span> } },
            { id: "res", header: "Result", value: (f) => latestRecon(f.id)?.result ?? "", filterable: true, cell: (f) => { const r = latestRecon(f.id); return r ? <StateText tone={r.result === "Exceptions" ? "attention" : "muted"}>{r.result === "Clean" ? "Clean" : `${r.exceptions} exception${r.exceptions === 1 ? "" : "s"}`}</StateText> : "" } },
            { id: "finding", header: "Finding", value: (f) => latestRecon(f.id)?.finding ?? "", className: "max-w-[300px]" },
            { id: "inc", header: "Incident", value: (f) => latestRecon(f.id)?.incidentId ?? "", cell: (f) => { const i = latestRecon(f.id)?.incidentId; const inc = s.incidents.find((x) => x.id === i); return i ? <span className="text-xs"><span className="font-mono">{i}</span> {inc ? `${inc.severity} · ${inc.state}` : ""}{inc?.paged?.length ? " · paged" : ""}</span> : "" } },
            { id: "run", header: "", cell: (f) => <Button size="sm" variant="outline" onClick={() => act(runRecon(f.id))}>Run now</Button> },
          ]}
        />
        <p className="mt-1 text-xs text-muted-foreground">The control text is the PRD's [DOC:pp.185-186 §3]; the run times and the severity of a failed control (S2 on a financially relevant interface, else S3) are design values (AR-29).</p>
      </section>

      <RulesPanel
        rules={[
          ["B§3", "No module-to-module dependency exists unless it appears in the interface catalog with a contract in the registry", "DOC:p.187 B §3 Build Note"],
          ["B§4-a", "DLQ: inspect, edit-and-replay (edit rights restricted + audited), bulk replay after fix, discard with mandatory reason", "DOC:p.187 B §4"],
          ["B§4-b", "Discard of a financially relevant command requires Controller", "DOC:p.187 B §4"],
          ["B§4-c", "correlation_id propagates from the originating user action through every API call, event, job and journal line", "DOC:p.187 B §4"],
          ["B§4-d", "Reconciliation reports: the per-interface controls run scheduled; failures raise incidents per Part D §5", "DOC:p.187 B §4"],
          ["B§2", "Transactional outbox: events written in the same transaction as the state change, published at-least-once", "DOC:p.185 B §2"],
        ]}
      />

      <DialogShell open={dialog === "fix"} onOpenChange={(o) => !o && setDialog(null)} title={`Mark ${active?.id ?? ""} fixed`} consequence="Records what was fixed on the envelope; replay is then offered. Nothing is resent yet." requireReason reasonLabel="What was fixed (required)" confirmLabel="Mark fixed" onConfirm={(r) => (active ? act(markFixed(active.id, r)) : "No message.")} />
      <DialogShell open={dialog === "edit"} onOpenChange={(o) => !o && setDialog(null)} title={`Edit and replay ${active?.id ?? ""}`} consequence="Replays the message with the edited payload. The edit is audited on the envelope (who, when, what)." confirmLabel="Replay edited" onConfirm={() => (active ? act(replay([active.id], payload)) : "No message.")} wide>
        <Field id="edit-payload" label="Payload"><Textarea id="edit-payload" className="font-mono text-xs" rows={8} value={payload} onChange={(e) => setPayload(e.target.value)} /></Field>
      </DialogShell>
      <DialogShell open={dialog === "discard"} onOpenChange={(o) => !o && setDialog(null)} title={`Discard ${active?.id ?? ""}`} consequence={active ? `Removes ${active.id} from the queue for good; ${interfaceById(active.interfaceId)?.reconciliation} will show the gap.` : undefined} requireReason destructive confirmLabel="Discard" onConfirm={(r) => (active ? act(discard(active.id, r)) : "No message.")} />
      <EscalateDialog open={dialog === "escalate"} onClose={() => setDialog(null)} source={active ? { kind: "message", id: active.id } : undefined} title={active ? `${active.interfaceId} ${active.state.toLowerCase()}: ${active.summary}` : ""} />
    </div>
  )
}
