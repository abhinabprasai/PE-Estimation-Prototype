// Saga step view for the integration console [DOC: Book III B §2.3]: a multi-step command across modules runs as a saga;
// each step has a compensator, a failed step is retried (same event_id, so idempotent) or the saga is compensated in reverse
// order. Compensating a saga that carries a financially relevant command (IF-12, IF-14) needs the Controller. Step state words
// and saga ids are design values (AR-1, AR-45).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, EmptyState, ErrorAlert } from "@/components/patterns"
import { DialogShell } from "@/components/templates"
import { docRoute } from "@/data/domain"
import { useCore, useSlice } from "@/store"
import { compensateSaga, retrySagaStep } from "../data/cfg-actions"
import type { Saga } from "../data/cfg-types"
import { can } from "../lib/cfg"
import { fmtDateTime } from "../lib/time"
import { act, Field, StateText, userName } from "./common"

const tone = (s: string) => (s === "Failed" ? "attention" : s === "Done" || s === "Completed" ? "default" : "muted")

export function SagaPanel() {
  const [params, setParams] = useSearchParams()
  const s = useSlice("adminCfg")
  const { role } = useCore()
  const [dlg, setDlg] = useState<null | "compensate">(null)
  const [reason, setReason] = useState("")
  const id = params.get("saga")
  const active = s.sagas.find((x) => x.id === id)
  const open = (sid?: string) => { const n = new URLSearchParams(params); if (sid) n.set("saga", sid); else n.delete("saga"); setParams(n, { replace: true }) }
  const financial = active ? ["IF-12", "IF-14"].includes(active.interfaceId) : false
  const mayCompensate = active ? (financial ? can.sagaFinancial(role) : can.sagaOps(role)) : false
  return (
    <section aria-label="Sagas" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Sagas: multi-step commands</h2>
      <p className="max-w-3xl text-sm">A command that touches several modules runs as steps, each with a compensator. A failed step is retried, or the completed steps are reversed in reverse order. Both are audited on the saga.</p>
      {id && !active && <ErrorAlert title={`Saga ${id} not found`} onDismiss={() => open()}>It may have been cleared by Scenario reset.</ErrorAlert>}
      <DataTable<Saga>
        rows={s.sagas}
        rowId={(g) => g.id}
        densityKey="OPS-INT-sagas"
        caption="Sagas"
        onRowClick={(g) => open(g.id)}
        activeId={active?.id}
        empty={{ title: "No sagas have run." }}
        initialSort={{ id: "at", dir: "desc" }}
        columns={[
          { id: "id", header: "Saga", value: (g) => g.id, mono: true },
          { id: "n", header: "Command", value: (g) => g.name, className: "max-w-[320px]" },
          { id: "if", header: "Interface", value: (g) => g.interfaceId, mono: true, filterable: true },
          { id: "doc", header: "Document", value: (g) => g.doc?.id ?? "", cell: (g) => (g.doc ? <Link onClick={(e) => e.stopPropagation()} className="font-mono text-link underline-offset-4 hover:underline" to={docRoute(g.doc)}>{g.doc.id}</Link> : "") },
          { id: "at", header: "Started", value: (g) => g.startedAt, sortable: true, cell: (g) => <span className="text-xs tabular">{fmtDateTime(g.startedAt)}</span> },
          { id: "p", header: "Steps done", value: (g) => g.steps.filter((x) => x.state === "Done").length, align: "right", mono: true, cell: (g) => `${g.steps.filter((x) => x.state === "Done" || x.state === "Compensated").length} of ${g.steps.length}` },
          { id: "st", header: "State", value: (g) => g.state, filterable: true, cell: (g) => <StateText tone={tone(g.state)}>{g.state}</StateText> },
        ]}
      />
      {active && (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{active.id} · {active.name}</h3>
            <StateText tone={tone(active.state)}>{active.state}</StateText>
            <Chip kind="design" note="Saga ids and state words are design values">Design value</Chip>
            <Button size="sm" variant="ghost" onClick={() => open()}>Close</Button>
          </div>
          <p className="text-xs text-muted-foreground">Correlation <button className="font-mono text-link underline-offset-4 hover:underline" onClick={() => { const n = new URLSearchParams(params); n.set("cor", active.correlationId); setParams(n, { replace: true }) }}>{active.correlationId}</button> · started {fmtDateTime(active.startedAt)}</p>
          <ol className="flex flex-col gap-2">
            {active.steps.map((st) => (
              <li key={st.n} className="rounded-md border p-3">
                <div className="flex flex-wrap items-baseline gap-2 text-sm"><span className="tabular text-muted-foreground">{st.n}</span><span className="font-medium">{st.name}</span><span className="text-xs text-muted-foreground">{st.module}</span><StateText tone={tone(st.state)}>{st.state}</StateText>{st.at && <span className="text-xs tabular text-muted-foreground">{fmtDateTime(st.at)}</span>}</div>
                <p className="text-xs text-muted-foreground">Compensator: {st.compensator}</p>
                {st.error && <p role="alert" className="mt-1 text-xs">{st.error}</p>}
              </li>
            ))}
          </ol>
          {active.state === "Failed" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => act(retrySagaStep(active.id))} disabled={!can.sagaOps(role)} title={can.sagaOps(role) ? undefined : "Plant IT, Engineering IT, Quality IT or the Controller retries a step"}>Retry failed step</Button>
              <Button variant="outline" onClick={() => { setReason(""); setDlg("compensate") }} disabled={!mayCompensate} title={mayCompensate ? undefined : financial ? `Only the Controller compensates ${active.interfaceId}: it carries a financially relevant command` : "Plant IT or the Controller compensates"}>Compensate</Button>
              {financial && !mayCompensate && <span className="text-xs text-muted-foreground">{active.interfaceId} carries a financially relevant command: the Controller compensates it.</span>}
            </div>
          )}
          <section aria-label="Saga log"><h4 className="text-xs font-semibold">Log</h4><ul className="mt-1 flex flex-col gap-1 text-xs">{active.log.map((l, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDateTime(l.at)}</span> {l.what} · {l.by === "PRD seed" || l.by === "Scheduler" ? l.by : userName(l.by)}</li>)}</ul></section>
        </div>
      )}
      {!active && !id && <EmptyState title="Pick a saga to see its steps.">Each step shows its module, state and compensator.</EmptyState>}
      <DialogShell open={dlg === "compensate"} onOpenChange={(o) => !o && setDlg(null)} title={`Compensate ${active?.id ?? ""}`} consequence="Reverses every completed step in reverse order using its compensator, and skips the steps not yet run. The saga ends Compensated." destructive confirmLabel="Compensate" onConfirm={() => (active ? act(compensateSaga(active.id, reason)) : null)}>
        <Field id="sg-why" label="Reason (at least 10 characters)"><Input id="sg-why" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </DialogShell>
    </section>
  )
}
