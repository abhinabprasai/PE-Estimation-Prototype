// FX-QM-AUDIT Quality audit management, DEC-09 (Phase 2) [DOC:p.37; CAPA sources p.88 §5] (asserted).
// Schedule internal, supplier, customer and certification audits; run the checklist; record
// findings graded Major, Minor or Observation; issue the report; raise a CAPA from a finding
// (audit findings are a CAPA source); close findings with evidence, then close the audit. The
// specification gives no audit status list or finding grades (README QT-R33): state words are shown
// as text.

import { useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, KV, RulesPanel, type Column } from "@/components/patterns"
import { TODAY, VENDORS } from "@/data/shared"
import { useRole, useSlice } from "@/store"
import { auditX } from "../data/extra-actions"
import { AUDIT_TYPES, type AuditFinding, type AuditState, type AuditType, type QtAudit } from "../data/extra-types"
import { ActivityList, NoList, NotFound, Pick, Reading, Stat, TextField, report, userName, vendorName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"

const RULES: [string, string, string][] = [
  ["AU-1", "Audits are Phase 2 (DEC-09): internal process, supplier, customer and certification audits, with a checklist, findings and a report.", "DOC:p.37 DEC-09"],
  ["AU-2", "Audit findings are a CAPA source; the CAPA links back to the finding it came from.", "DOC:p.88 Part E §5"],
  ["AU-3", "Every nonconforming checklist answer needs a finding before the report is issued; a Major finding closes after its CAPA is Closed.", "README QT-R33"],
  ["AU-4", "Only the Quality Manager closes or cancels an audit; a Quality engineer or Quality Manager runs it.", "README QT-R33"],
]
const STATES: AuditState[] = ["Planned", "In progress", "Report issued", "Closed", "Cancelled"]
const gradeChip = (g: AuditFinding["grade"]) => (g === "Major" ? <Chip kind="flag">Major</Chip> : g)
const openFindings = (a: QtAudit) => a.findings.filter((f) => f.state === "Open")

// ============================================================================ list
export function AuditList() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-QM-AUDIT")
  const [role] = useRole()
  const [dlg, setDlg] = useState(false)
  const canRun = role === "Quality engineer" || role === "Quality Manager"
  const cols: Column<QtAudit>[] = [
    { id: "id", header: "Audit", value: (a) => a.id, mono: true, sortable: true },
    { id: "title", header: "Title", value: (a) => a.title },
    { id: "type", header: "Type", value: (a) => a.type, filterable: true },
    { id: "who", header: "Auditee", value: (a) => (a.vendorId ? vendorName(a.vendorId) : a.auditee), filterable: true },
    { id: "auditor", header: "Auditor", value: (a) => userName(a.auditorId) },
    { id: "plan", header: "Planned", value: (a) => a.plannedOn, mono: true, sortable: true },
    { id: "state", header: "State", value: (a) => a.state, filterable: true, cell: (a) => <NoList text={a.state} /> },
    { id: "find", header: "Open findings", value: (a) => openFindings(a).length, align: "right", mono: true, sortable: true, cell: (a) => `${openFindings(a).length} of ${a.findings.length}` },
  ]
  const rows = s.audits
  return (
    <>
      <StateFrame ss={ss} title="Quality audits" screenId="FX-QM-AUDIT" entity="audits" allowed="Quality engineer or Quality Manager" validation={["Name the audit and state its scope.", "The planned date cannot be in the past."]} conflict={{ what: "audit AUD-2026-0006", mine: "Issue the report", theirs: "The Quality Manager added finding F2 a minute ago" }} degraded="Linked CAPA status may be a few minutes old.">
        <ListPage
          header={{
            title: "Quality audits",
            screenId: "FX-QM-AUDIT",
            crumbs: [{ label: "Quality" }, { label: "Audits" }],
            description: "Plan and run internal, supplier, customer and certification audits. Findings flow into CAPA.",
            chips: <><Chip kind="design" note="DEC-09, Phase 2">Phase 2</Chip><Reading id="QT-R33" /></>,
            primary: <Button disabled={!canRun || ss.locked} onClick={() => setDlg(true)}>Schedule audit</Button>,
          }}
          above={
            <div className="flex flex-wrap gap-2">
              <Stat label="Planned" value={rows.filter((a) => a.state === "Planned").length} />
              <Stat label="In progress" value={rows.filter((a) => a.state === "In progress").length} />
              <Stat label="Open findings" value={rows.reduce((n, a) => n + openFindings(a).length, 0)} tone={rows.some((a) => openFindings(a).some((f) => f.dueOn && f.dueOn < TODAY)) ? "attention" : undefined} />
              <Stat label="Findings past due" value={rows.reduce((n, a) => n + openFindings(a).filter((f) => f.dueOn && f.dueOn < TODAY).length, 0)} />
              {!canRun && <span className="self-center text-xs text-muted-foreground">Scheduling is for the Quality engineer or Quality Manager; you are acting as {role}.</span>}
            </div>
          }
          table={{
            rows: ss.state === "empty" ? [] : rows,
            columns: cols,
            rowId: (a) => a.id,
            rowHref: (a) => `/quality/audits/${a.id}`,
            searchText: (a) => `${a.id} ${a.title} ${a.auditee} ${vendorName(a.vendorId)}`,
            searchPlaceholder: "Search audit, auditee, vendor",
            initialSort: { id: "plan", dir: "desc" },
            empty: { title: "No audits", body: "Schedule the first audit." },
          }}
        />
      </StateFrame>
      {dlg && <ScheduleDialog onClose={() => setDlg(false)} />}
    </>
  )
}

function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const [o, setO] = useState({ title: "", type: "Internal process" as AuditType, scope: "", auditee: "", plannedOn: "", vendorId: "", checklist: "" })
  return (
    <DialogShell
      open
      onOpenChange={(x) => !x && onClose()}
      title="Schedule audit"
      wide
      consequence={`Creates an audit in Planned with you as auditor${o.checklist.trim() ? ` and ${o.checklist.split("\n").filter((l) => l.trim()).length} checklist question(s)` : ""}. Nothing is sent to the auditee.`}
      confirmLabel="Schedule"
      onConfirm={() => {
        const r = auditX.create({ ...o, vendorId: o.vendorId || undefined, checklist: o.checklist.split("\n") })
        return report(r, (id) => `${id} scheduled`) ? null : (r as { error: string }).error
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextField id="au-title" label="Title" value={o.title} onChange={(v) => setO({ ...o, title: v })} /></div>
        <Pick id="au-type" label="Type" value={o.type} onChange={(v) => setO({ ...o, type: v })} options={AUDIT_TYPES} />
        <TextField id="au-date" label="Planned date" type="date" value={o.plannedOn} onChange={(v) => setO({ ...o, plannedOn: v })} />
        {o.type === "Supplier" && <Pick id="au-ven" label="Vendor" value={o.vendorId} onChange={(v) => setO({ ...o, vendorId: v, auditee: o.auditee || vendorName(v) })} options={VENDORS.map((v) => ({ value: v.id, label: v.name }))} />}
        <TextField id="au-auditee" label="Auditee" value={o.auditee} onChange={(v) => setO({ ...o, auditee: v })} />
        <div className="sm:col-span-2"><TextField id="au-scope" label="Scope" value={o.scope} onChange={(v) => setO({ ...o, scope: v })} /></div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="au-cl">Checklist (one question per line)</Label>
          <Textarea id="au-cl" rows={4} value={o.checklist} onChange={(e) => setO({ ...o, checklist: e.target.value })} />
        </div>
      </div>
    </DialogShell>
  )
}

// ============================================================================ detail
export function AuditDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-QM-AUDIT")
  const [role] = useRole()
  const a = s.audits.find((x) => x.id === id)
  const [dlg, setDlg] = useState<null | "finding" | "cancel" | "close" | { capa: string } | { close: string }>(null)
  if (!a) return <NotFound what="audit" id={id} back={{ to: "/quality/audits", label: "Back to audits" }} />
  const terminal = a.state === "Closed" || a.state === "Cancelled"
  const canRun = (role === "Quality engineer" || role === "Quality Manager") && !ss.locked && !terminal
  const isQm = role === "Quality Manager" && !ss.locked
  const unanswered = a.checklist.filter((q) => !q.result).length
  const act = <T,>(r: { ok: true; value: T } | { ok: false; error: string }, m: string) => void report(r, m)
  const flow = STATES.filter((x) => x !== "Cancelled" || a.state === "Cancelled")
  return (
    <>
      <StateFrame ss={ss} title={a.id} screenId="FX-QM-AUDIT" entity="audit records" allowed="Quality engineer or Quality Manager" validation={["Answer every checklist question.", "Every nonconforming answer needs a finding."]} conflict={{ what: a.id, mine: "Close finding F1", theirs: "The Quality Manager reopened it with a new note" }} degraded="Linked CAPA status may be a few minutes old.">
        <DetailPage
          header={{
            title: `${a.id} · ${a.title}`,
            screenId: "FX-QM-AUDIT",
            crumbs: [{ label: "Audits", to: "/quality/audits" }, { label: a.id }],
            description: a.scope,
            chips: (
              <>
                <NoList text={a.state} />
                {terminal && <Chip kind="design" note="A closed or cancelled audit opens read-only (C-55)">Read-only</Chip>}
                <Reading id="QT-R33" />
              </>
            ),
            primary:
              a.state === "Planned" ? <Button disabled={!canRun} onClick={() => act(auditX.start(a.id), "Audit started")}>Start audit</Button>
              : a.state === "In progress" ? <Button disabled={!canRun || unanswered > 0} title={unanswered ? `${unanswered} question(s) unanswered` : undefined} onClick={() => act(auditX.issueReport(a.id), "Report issued")}>Issue report</Button>
              : a.state === "Report issued" ? <Button disabled={!isQm || openFindings(a).length > 0} title={openFindings(a).length ? `${openFindings(a).length} finding(s) open` : undefined} onClick={() => setDlg("close")}>Close audit</Button>
              : undefined,
            actions: (
              <>
                {a.state === "In progress" && <Button variant="outline" disabled={!canRun} onClick={() => setDlg("finding")}>Add finding</Button>}
                {a.state === "Planned" && <Button variant="outline" disabled={!isQm} onClick={() => setDlg("cancel")}>Cancel audit</Button>}
              </>
            ),
          }}
          summary={
            <>
              <KV k="Type">{a.type}</KV>
              <KV k="Auditee">{a.vendorId ? vendorName(a.vendorId) : a.auditee}</KV>
              <KV k="Auditor">{userName(a.auditorId)}</KV>
              <KV k="Planned">{a.plannedOn}</KV>
              <KV k="Started">{a.startedOn ?? "Not started"}</KV>
              <KV k="Report">{a.reportOn ?? "Not issued"}</KV>
              <KV k="Closed">{a.closedOn ?? "Open"}</KV>
              <KV k="Findings">{`${openFindings(a).length} open of ${a.findings.length}`}</KV>
            </>
          }
          tabs={[
            {
              id: "check", label: "Checklist", count: a.checklist.length,
              content: (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">States: {flow.map((x) => (x === a.state ? `[${x}]` : x)).join(" → ")}</p>
                  {a.checklist.length === 0 && <p className="text-sm text-muted-foreground">No checklist questions.</p>}
                  <ol className="flex flex-col gap-2">
                    {a.checklist.map((q, i) => <Question key={`${a.id}${i}${q.result}`} a={a} i={i} editable={a.state === "In progress" && canRun} />)}
                  </ol>
                </div>
              ),
            },
            {
              id: "find", label: "Findings", count: a.findings.length,
              content: (
                <div className="flex flex-col gap-3">
                  {a.findings.length === 0 && <p className="text-sm text-muted-foreground">No findings recorded.</p>}
                  {a.findings.map((f) => {
                    const capa = f.capaId ? s.capas.find((c) => c.id === f.capaId) : undefined
                    return (
                      <div key={f.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{f.id}</strong> {gradeChip(f.grade)} <span className="text-muted-foreground">{f.clause}</span>
                          <span className="ml-auto">{f.state === "Closed" ? `Closed ${f.closedOn}` : f.dueOn ? <span className={f.dueOn < TODAY ? "font-semibold text-destructive" : undefined}>Due {f.dueOn}{f.dueOn < TODAY ? " (past due)" : ""}</span> : "No due date"}</span>
                        </div>
                        <p>{f.text}</p>
                        {f.closeNote && <p className="text-muted-foreground">Evidence: {f.closeNote}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          {f.capaId ? <span>CAPA <Link className="text-link underline-offset-4 hover:underline" to={`/quality/capa/${f.capaId}`}>{f.capaId}</Link>{capa ? ` · ${capa.status}` : ""}</span> : null}
                          {!f.capaId && f.grade !== "Observation" && f.state === "Open" && <Button size="sm" variant="outline" disabled={!canRun || a.state === "Planned"} onClick={() => act(auditX.raiseCapa(a.id, f.id), "CAPA opened and linked")}>Raise CAPA</Button>}
                          {f.state === "Open" && a.state !== "Planned" && <Button size="sm" variant="outline" disabled={!canRun && !(isQm && a.state === "Report issued")} onClick={() => setDlg({ close: f.id })}>Close finding</Button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ),
            },
            { id: "activity", label: "Activity", content: <ActivityList items={a.activity} /> },
            { id: "rules", label: "Rules", content: <RulesPanel rules={RULES} /> },
          ]}
        />
      </StateFrame>
      {dlg === "finding" && <FindingDialog a={a} onClose={() => setDlg(null)} />}
      <DialogShell
        open={dlg === "close"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Close ${a.id}`}
        consequence={`Closes the audit with all ${a.findings.length} finding(s) closed. A closed audit is read-only.`}
        confirmLabel="Close audit"
        onConfirm={() => {
          const r = auditX.close(a.id)
          return report(r, "Audit closed") ? null : (r as { error: string }).error
        }}
      />
      <DialogShell
        open={dlg === "cancel"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Cancel ${a.id}`}
        consequence="Cancels a planned audit; it stays on the list as Cancelled, read-only."
        confirmLabel="Cancel audit"
        destructive
        requireReason
        onConfirm={(reason) => {
          const r = auditX.cancel(a.id, reason)
          return report(r, "Audit cancelled") ? null : (r as { error: string }).error
        }}
      />
      {dlg && typeof dlg === "object" && "close" in dlg && (
        <DialogShell
          open
          onOpenChange={(o) => !o && setDlg(null)}
          title={`Close finding ${dlg.close}`}
          consequence="Closes the finding with the evidence you give. A Major finding closes only after its CAPA is Closed."
          confirmLabel="Close finding"
          requireReason
          reasonLabel="Evidence that closes the finding (required)"
          onConfirm={(note) => {
            const r = auditX.closeFinding(a.id, dlg.close, note)
            return report(r, "Finding closed") ? null : (r as { error: string }).error
          }}
        />
      )}
    </>
  )
}

function Question({ a, i, editable }: { a: QtAudit; i: number; editable: boolean }) {
  const q = a.checklist[i]
  const [note, setNote] = useState(q.note ?? "")
  const [err, setErr] = useState<string | null>(null)
  const set = (r: "Conforming" | "Nonconforming" | "NA") => {
    const x = auditX.answer(a.id, i, r, note)
    setErr(x.ok ? null : x.error)
  }
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <p><span className="tabular text-muted-foreground">{i + 1}.</span> {q.q}</p>
      <div className="flex flex-wrap items-center gap-2">
        {(["Conforming", "Nonconforming", "NA"] as const).map((r) => (
          <Button key={r} size="sm" variant={q.result === r ? "default" : "outline"} aria-pressed={q.result === r} disabled={!editable} onClick={() => set(r)}>{r === "NA" ? "Not applicable" : r}</Button>
        ))}
        {!q.result && <span className="text-muted-foreground">Not answered</span>}
      </div>
      {(editable || q.note) && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`qn-${i}`} className="sr-only">Note for question {i + 1}</Label>
          {editable ? <Textarea id={`qn-${i}`} rows={2} placeholder="Note (required for Nonconforming)" value={note} onChange={(e) => setNote(e.target.value)} /> : <p className="text-muted-foreground">{q.note}</p>}
        </div>
      )}
      {err && <p role="alert" className="text-destructive">{err}</p>}
    </li>
  )
}

function FindingDialog({ a, onClose }: { a: QtAudit; onClose: () => void }) {
  const [o, setO] = useState({ clause: "", text: "", grade: "Minor" as AuditFinding["grade"], dueOn: "" })
  return (
    <DialogShell
      open
      onOpenChange={(x) => !x && onClose()}
      title={`Add finding to ${a.id}`}
      consequence={`Records a ${o.grade} finding${o.grade !== "Observation" ? " with a response due date" : ""}. A Minor or Major finding can open a CAPA.`}
      confirmLabel="Record finding"
      onConfirm={() => {
        const r = auditX.addFinding(a.id, o)
        return report(r, "Finding recorded") ? null : (r as { error: string }).error
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Pick id="fd-grade" label="Grade" value={o.grade} onChange={(v) => setO({ ...o, grade: v })} options={["Major", "Minor", "Observation"] as AuditFinding["grade"][]} />
        <TextField id="fd-due" label={o.grade === "Observation" ? "Due date (optional)" : "Due date"} type="date" value={o.dueOn} onChange={(v) => setO({ ...o, dueOn: v })} />
        <div className="sm:col-span-2"><TextField id="fd-clause" label="Clause or area" value={o.clause} onChange={(v) => setO({ ...o, clause: v })} /></div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="fd-text">Finding</Label>
          <Textarea id="fd-text" rows={3} value={o.text} onChange={(e) => setO({ ...o, text: e.target.value })} />
        </div>
      </div>
    </DialogShell>
  )
}

