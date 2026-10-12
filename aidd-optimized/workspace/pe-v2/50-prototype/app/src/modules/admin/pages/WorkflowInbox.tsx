// WF-INBOX Approvals Inbox (Workbench) [DOC:p.275 §15] (asserted): "Unified queue with SLA clocks,
// document context cards, act buttons inline, delegation banner when active. Approve. Reject with
// comments. Delegate. Recall own submissions. Every W.4 workflow routes here."
// One view over two queues (lib/engine.ts): the shared engine in the store core (C-1, every
// ApprovalButton) and the admin engine queue for the W.4 rows the shared engine has no kind for (R-1).
// Approval requests have no status list (OQ-21): outcome is text, never a badge.

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { ShieldAlert, UserRoundCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DocumentFlowPanel, ErrorAlert, KV, RulesPanel, StatusBadge, useFirstVisitLoading, type Column } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import type { Role, UserId } from "@/data/domain"
import { TODAY, USERS } from "@/data/shared"
import { fmtMoney } from "@/lib/format"
import { store, useCore, useSlice } from "@/store"
import { useModules } from "@/app/modules-context"
import { W4 } from "../data/catalog"
import { NOW } from "../data/seed"
import { addDelegation, decide, delegateStep, recall, resubmit, revokeDelegation } from "../data/actions"
import type { Channel } from "../data/types"
import { canAct, delegationFor, delegationState, inboxRows, waitingFor, type InboxRow } from "../lib/engine"
import { fmtDateTime } from "../lib/time"
import { act, Field, SimpleSelect, SlaClock, StateText, userName } from "../components/common"

type Queue = "mine" | "escalated" | "submitted" | "open" | "decided"
type DialogKind = null | "reject" | "delegate" | "recall" | "resubmit" | "delegations"

export function WorkflowInbox() {
  const core = useCore()
  const admin = useSlice("admin")
  const modules = useModules()
  const loading = useFirstVisitLoading("WF-INBOX")
  const [params, setParams] = useSearchParams()
  const [queue, setQueue] = useState<Queue>("mine")
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [channel, setChannel] = useState<Channel>("In-app")
  const { role, userId } = core
  const rows = useMemo(() => inboxRows(core.approvals, admin), [core.approvals, admin])
  const reqId = params.get("req")
  const active = rows.find((r) => r.id === reqId)
  const dl = admin.delegations

  const inQueue = (r: InboxRow, q: Queue) =>
    q === "mine" ? waitingFor(r, role, userId, dl)
    : q === "escalated" ? r.overdue && r.current >= 0 && r.steps[r.current].escalateTo === role
    : q === "submitted" ? r.raisedBy === role
    : q === "open" ? !r.outcome
    : !!r.outcome
  const shown = rows.filter((r) => inQueue(r, queue))
  const mine = rows.filter((r) => inQueue(r, "mine"))
  const decidedToday = admin.audit.filter((e) => e.at.startsWith(TODAY) && (e.action === "Approved" || e.action === "Rejected")).length

  // Delegation banner [DOC:p.275]: shown when the acting user has an active delegation either way.
  const outgoing = dl.filter((d) => d.fromUser === userId && !d.requestId && delegationState(d) === "Active")
  const incoming = dl.filter((d) => d.toUser === userId && delegationState(d) === "Active")

  const columns: Column<InboxRow>[] = [
    { id: "id", header: "Request", value: (r) => r.id, sortable: true, mono: true },
    { id: "wf", header: "Workflow", value: (r) => `${r.wfId} ${r.kind}`, filterable: true, cell: (r) => <span><span className="font-mono text-xs text-muted-foreground">{r.wfId}</span> {r.kind}</span> },
    { id: "doc", header: "Document", value: (r) => r.subject.id, cell: (r) => <Link to={r.subject.route} onClick={(e) => e.stopPropagation()} className="font-mono text-link underline-offset-4 hover:underline">{r.subject.id}</Link> },
    { id: "title", header: "What", value: (r) => r.title, className: "max-w-[360px]" },
    { id: "amount", header: "Amount", value: (r) => r.amount ?? null, cell: (r) => (r.amount == null ? "" : fmtMoney(r.amount, r.currency)), align: "right", sortable: true, mono: true },
    {
      id: "waiting", header: "Waiting for", filterable: true,
      value: (r) => (r.outcome ? `Decided: ${r.outcome}` : r.steps[r.current].role),
      cell: (r) => r.outcome ? <StateText tone="muted">{r.outcome}</StateText> : (
        <span className="flex flex-col">
          <span>{r.steps[r.current].role} <span className="text-xs text-muted-foreground">step {r.current + 1} of {r.steps.length}</span></span>
          {delegationFor(r, userId, dl) && <span className="text-xs">you, as delegate</span>}
        </span>
      ),
    },
    { id: "sla", header: "SLA clock", value: (r) => (r.current >= 0 ? r.ageHours / r.steps[r.current].slaHours : -1), sortable: true, cell: (r) => (r.current >= 0 ? <SlaClock ageHours={r.ageHours} slaHours={r.steps[r.current].slaHours} overdue={r.overdue} escalateTo={r.steps[r.current].escalateTo} /> : "") },
    { id: "raised", header: "Raised", value: (r) => r.raisedAt, cell: (r) => <span className="text-xs">{fmtDateTime(r.raisedAt)}<br />{r.raisedBy}</span>, sortable: true },
  ]

  const check = active ? canAct(active, role, userId, dl) : undefined
  const approve = (r: InboxRow) => act(decide(r.id, "Approved", undefined, channel))

  return (
    <div className="flex flex-col gap-8">
      {(outgoing.length > 0 || incoming.length > 0) && (
        <Alert role="status">
          <UserRoundCheck aria-hidden="true" />
          <AlertTitle>Delegation active</AlertTitle>
          <AlertDescription>
            {outgoing.map((d) => <p key={d.id}>{d.id}: your {d.fromRole} steps go to {userName(d.toUser)} ({d.toRole}) until {d.validTo}{d.scope === "All workflows" ? "" : ` for ${d.scope.join(", ")}`}. Financial approvals above $250,000 stay with you (C-2).</p>)}
            {incoming.map((d) => <p key={d.id}>{d.id}: you act for {userName(d.fromUser)} ({d.fromRole}) until {d.validTo}{d.requestId ? ` on ${d.requestId}` : d.scope === "All workflows" ? "" : ` for ${d.scope.join(", ")}`}. Every action you take is logged as “on behalf of”.</p>)}
          </AlertDescription>
        </Alert>
      )}
      {reqId && !active && (
        <ErrorAlert title={`Request ${reqId} not found`} onDismiss={() => setParams({})}>
          The link points at a request that does not exist in this scenario. Scenario reset restores the seed.
        </ErrorAlert>
      )}
      <WorkbenchPage<InboxRow>
        header={{
          title: "Approvals inbox",
          screenId: "WF-INBOX",
          description: (
            <>
              Every governed action of the W.4 register routes here ({W4.length} workflows), on one queue for <strong>{role}</strong>. SLA clocks run per step; an overdue step escalates to the role's manager. Delegation is never offered on financial approvals above $250,000 (C-2).
            </>
          ),
          chips: (
            <>
              <Chip kind="oq" id="OQ-21" note="Approval requests have no status list in the specification; outcome shown as text" />
              <Chip kind="design" note={`Prototype clock ${NOW}; SLA hours other than 24 h ECR emergency and 2-day MCR are design values (AR-2)`}>SLA clock</Chip>
            </>
          ),
          actions: (
            <Button variant="outline" onClick={() => setDialog("delegations")}>
              Delegations ({dl.filter((d) => d.fromUser === userId || d.toUser === userId).length})
            </Button>
          ),
        }}
        kpis={[
          { label: "Waiting for me", value: mine.length, hint: incoming.length ? "includes steps you hold as delegate" : undefined },
          { label: "Over SLA in my queue", value: mine.filter((r) => r.overdue).length },
          { label: "Escalated to me", value: rows.filter((r) => inQueue(r, "escalated")).length, hint: "breached steps of roles reporting to you" },
          { label: "Decided today", value: decidedToday },
        ]}
        queues={[
          { id: "mine", label: "Waiting for me", count: mine.length },
          { id: "escalated", label: "Escalated to me", count: rows.filter((r) => inQueue(r, "escalated")).length },
          { id: "submitted", label: "My submissions", count: rows.filter((r) => inQueue(r, "submitted")).length },
          { id: "open", label: "All open", count: rows.filter((r) => !r.outcome).length },
          { id: "decided", label: "Decided", count: rows.filter((r) => r.outcome).length },
        ]}
        queue={queue}
        onQueueChange={(q) => setQueue(q as Queue)}
        bulkActions={(sel, clear) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              let ok = 0
              const skipped: string[] = []
              for (const id of sel) {
                const r = rows.find((x) => x.id === id)
                if (!r || !canAct(r, role, userId, dl).can) {
                  skipped.push(id)
                  continue
                }
                const res = decide(r.id, "Approved", undefined, channel)
                if (res.ok) ok++
                else skipped.push(id)
              }
              toast[skipped.length ? "warning" : "success"](`${ok} approved${skipped.length ? `; skipped ${skipped.join(", ")} (not yours to decide)` : ""}. Reject needs a comment, so it is one at a time.`)
              clear()
            }}
          >
            Approve selected
          </Button>
        )}
        table={{
          rows: shown,
          columns,
          rowId: (r) => r.id,
          loading,
          searchText: (r) => `${r.id} ${r.wfId} ${r.kind} ${r.subject.id} ${r.title} ${r.raisedBy}`,
          searchPlaceholder: "Search requests, documents, workflows",
          onRowClick: (r) => setParams({ req: r.id }),
          activeId: active?.id,
          initialSort: { id: "raised", dir: "desc" },
          empty: {
            title: queue === "mine" ? `Nothing is waiting for ${role}.` : queue === "escalated" ? "Nothing is escalated to you." : queue === "submitted" ? `${role} has not raised any request.` : "No requests in this queue.",
            body: queue === "mine" ? "Switch “Acting as” to another approver, or look at All open." : undefined,
          },
          caption: "Approval requests",
        }}
        panel={{
          open: !!active,
          onOpenChange: (o) => !o && setParams({}),
          title: active ? `${active.id} · ${active.kind}` : "",
          description: active?.title,
          content: active && check && (
            <RequestPanel row={active} check={check} channel={channel} setChannel={setChannel} onApprove={() => approve(active)} onDialog={setDialog} />
          ),
        }}
      />

      <RulesPanel
        rules={[
          ["C-1", "One shared approval engine; every approve / reject control routes to this inbox", "DOC:p.10 W.1"],
          ["C-2", "No delegation of financial approvals above $250,000", "DOC:pp.10-11 W"],
          ["W.1-a", "Per-user delegate with date range; delegation logged on every action taken", "DOC:p.11 W.1"],
          ["W.1-b", "Per step: SLA hours, reminder cadence, escalation target (role manager) on breach", "DOC:p.11 W.1"],
          ["W.1-c", "Initiator may recall before first approval; rejection returns with mandatory comments; resubmission preserves history", "DOC:p.11 W.1"],
          ["W.1-d", "Every action records user, timestamp, channel and comment on the immutable audit trail", "DOC:p.11 W.1"],
          ["C-43", "Period reopen: Controller + CFO, two distinct users, in sequence", "DOC:p.42 §9.5"],
          ["W.4", "A governed action not present in the register is added through change control or does not ship", "DOC:p.12 W.4 Build Note"],
        ]}
      />

      {modules
        .filter((m) => m.inboxSection)
        .map((m) => (
          <section key={m.group} aria-label={m.inboxSection!.title} className="border-t pt-6">
            <p className="mb-2 text-sm text-muted-foreground">{m.inboxSection!.title}: kept from the FL-09 build until it moves onto the shared engine.</p>
            {m.inboxSection!.element}
          </section>
        ))}

      <DialogShell
        open={dialog === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reject ${active?.id ?? ""}`}
        consequence={active ? `Rejects ${active.kind} for ${active.subject.id}. The request returns to the initiator (${active.raisedBy}) with your comment; the owning module is told and the document stays where it is.` : undefined}
        requireReason
        reasonLabel="Comment for the initiator (required)"
        destructive
        confirmLabel="Reject"
        onConfirm={(reason) => (active ? act(decide(active.id, "Rejected", reason, channel)) : "No request selected.")}
      />
      <DelegateDialog open={dialog === "delegate"} onClose={() => setDialog(null)} row={active} />
      <DialogShell
        open={dialog === "recall"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Recall ${active?.id ?? ""}`}
        consequence={active ? `Withdraws ${active.kind} for ${active.subject.id} before anyone has approved it. You can resubmit it later; history is kept.` : undefined}
        requireReason
        confirmLabel="Recall"
        onConfirm={(reason) => (active ? act(recall(active.id, reason)) : "No request selected.")}
      />
      <DialogShell
        open={dialog === "resubmit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Resubmit ${active?.id ?? ""}`}
        consequence={active ? `Starts a new round of the same chain from step 1. The earlier round and its comments stay on the request.` : undefined}
        requireReason
        reasonLabel="What changed (required)"
        confirmLabel="Resubmit"
        onConfirm={(reason) => (active ? act(resubmit(active.id, reason)) : "No request selected.")}
      />
      <DelegationsDialog open={dialog === "delegations"} onClose={() => setDialog(null)} />
    </div>
  )
}

function RequestPanel({ row, check, channel, setChannel, onApprove, onDialog }: { row: InboxRow; check: ReturnType<typeof canAct>; channel: Channel; setChannel: (c: Channel) => void; onApprove: () => void; onDialog: (d: DialogKind) => void }) {
  const admin = useSlice("admin")
  const { role } = useCore()
  const info = row.subject.ref ? store.lookup(row.subject.ref) : undefined
  const audit = admin.audit.filter((e) => e.requestId === row.id)
  const inst = admin.instances.find((i) => i.id === row.id)
  const step = row.current >= 0 ? row.steps[row.current] : undefined
  const mineToRecall = !row.outcome && row.raisedBy === role && !row.steps.some((s) => s.decided)
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Document context" className="rounded-lg border p-4">
        <h3 className="text-xs text-muted-foreground">{row.subject.label}</h3>
        <p className="flex flex-wrap items-center gap-2">
          <Link className="font-mono text-link underline-offset-4 hover:underline" to={row.subject.route}>{row.subject.id}</Link>
          {info?.status && <StatusBadge kind={info.status.kind} status={info.status.value} size="sm" />}
          {info && !info.status && <Chip kind="oq" id="OQ-21" note="This document type has no status list in the specification" />}
        </p>
        {info?.subtitle && <p className="text-xs text-muted-foreground">{info.subtitle}</p>}
      </section>
      <dl className="grid grid-cols-2 gap-4">
        <KV k="Amount">{row.amount == null ? "Not applicable" : fmtMoney(row.amount, row.currency)}</KV>
        <KV k="Raised">{fmtDateTime(row.raisedAt)} by {row.raisedBy}</KV>
        <KV k="Delegation">{row.delegationAllowed ? "Allowed" : "Not allowed (C-2)"}</KV>
        <KV k="Queue">{row.source === "shared" ? "Shared engine" : `Admin engine${row.version ? `, definition v${row.version}` : ""}`}</KV>
        <KV k="Outcome">{row.outcome ?? "Pending"}</KV>
        <KV k="Workflow">{row.wfId}</KV>
      </dl>
      <div>
        <h3 className="text-sm font-semibold">Route</h3>
        <p className="text-xs text-muted-foreground">{row.rule} {row.ruleSource} (asserted)</p>
        {row.reading && (
          <p className="mt-1 flex items-center gap-2 text-xs">
            <Chip kind="design" note={row.reading}>Routing reading</Chip> {row.reading}
          </p>
        )}
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {row.steps.map((s, i) => (
            <li key={i} className="flex flex-col rounded-md border px-2 py-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular w-5">{i + 1}.</span>
                <span className="font-medium">{s.role}</span>
                {s.note && <span className="text-xs text-muted-foreground">{s.note}</span>}
              </span>
              {s.decided ? (
                <span className="pl-7 text-xs text-muted-foreground">
                  {s.decided.outcome} by {userName(s.decided.by)}{s.decided.onBehalfOf ? ` on behalf of ${userName(s.decided.onBehalfOf)}` : ""} · {fmtDateTime(s.decided.on)} · {s.decided.channel ?? "In-app"}
                  {s.decided.reason ? `: “${s.decided.reason}”` : ""}
                </span>
              ) : i === row.current ? (
                <span className="pl-7"><SlaClock ageHours={row.ageHours} slaHours={s.slaHours} overdue={row.overdue} escalateTo={s.escalateTo} /></span>
              ) : (
                <span className="pl-7 text-xs text-muted-foreground">after the step above · SLA {s.slaHours} h</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      {row.outcome ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-md bg-muted px-4 py-2 text-sm">Decided: {row.outcome}.{row.outcome === "Rejected" && row.source === "admin" && row.raisedBy === role ? " You raised it: resubmit with what changed." : " No further action."}</p>
          {row.source === "admin" && (row.outcome === "Rejected" || row.outcome === "Recalled") && row.raisedBy === role && (
            <Button variant="outline" className="self-start" onClick={() => onDialog("resubmit")}>Resubmit</Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {check.asDelegate && check.can && (
            <p className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm">
              <UserRoundCheck className="size-4" aria-hidden="true" /> You act for {userName(check.asDelegate.fromUser)} ({check.asDelegate.fromRole}) under {check.asDelegate.id}; the audit trail records both names.
            </p>
          )}
          {!check.can && (
            <p className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm">
              <ShieldAlert className="size-4" aria-hidden="true" /> {check.reason}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Field id="act-channel" label="Acting surface" className="w-40">
              <SimpleSelect id="act-channel" value={channel} onChange={(v) => setChannel(v as Channel)} options={["In-app", "Email link", "Mobile"].map((c) => ({ value: c, label: c }))} />
            </Field>
            {check.can && (
              <>
                <Button variant="outline" onClick={() => onDialog("reject")}>Reject</Button>
                {step?.role === role && <Button variant="outline" onClick={() => onDialog("delegate")} disabled={!row.delegationAllowed} title={row.delegationAllowed ? undefined : "Not allowed: financial approval above $250,000 (C-2)"}>Delegate</Button>}
                <Button onClick={onApprove}>Approve step {row.current + 1} of {row.steps.length}</Button>
              </>
            )}
            {mineToRecall && (
              <Button variant="outline" onClick={() => onDialog("recall")} disabled={row.source === "shared"} title={row.source === "shared" ? "The shared engine has no recall yet (R-3)" : undefined}>
                Recall
              </Button>
            )}
          </div>
        </div>
      )}

      {inst && inst.rounds.length > 0 && (
        <section aria-label="Earlier rounds">
          <h3 className="text-sm font-semibold">Earlier rounds ({inst.rounds.length})</h3>
          <ul className="text-xs text-muted-foreground">
            {inst.rounds.map((r, n) => <li key={n}>Round {n + 1}: {r.outcome} on {fmtDateTime(r.closedAt)} · {r.steps.filter((s) => s.decided).map((s) => `${s.role} ${s.decided!.outcome}${s.decided!.reason ? ` (“${s.decided!.reason}”)` : ""}`).join("; ") || "no step decided"}</li>)}
          </ul>
        </section>
      )}

      <section aria-label="Audit trail">
        <h3 className="text-sm font-semibold">Audit trail ({audit.length})</h3>
        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">Seeded before the audit trail started; the steps above carry the decisions.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-xs">
            {audit.map((e, n) => (
              <li key={n}>
                <span className="tabular text-muted-foreground">{fmtDateTime(e.at)}</span> · {e.action} by {userName(e.by)} ({e.role}){e.onBehalfOf ? ` on behalf of ${userName(e.onBehalfOf)}` : ""} · {e.channel}{e.comment ? `: “${e.comment}”` : ""}
              </li>
            ))}
          </ol>
        )}
      </section>

      {row.subject.ref ? <DocumentFlowPanel doc={row.subject.ref} /> : (
        <p className="text-xs text-muted-foreground">
          {row.subject.label} has no document type on the spine; open it at <Link className="text-link underline-offset-4 hover:underline" to={row.subject.route}>{row.subject.id}</Link>.
        </p>
      )}
    </div>
  )
}

function DelegateDialog({ open, onClose, row }: { open: boolean; onClose: () => void; row?: InboxRow }) {
  const { userId } = useCore()
  const [to, setTo] = useState<string>("")
  const [days, setDays] = useState("5")
  const target = USERS.find((u) => u.id === to)
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setTo("")
          onClose()
        }
      }}
      title={`Delegate ${row?.id ?? ""} step`}
      consequence={row && target ? `${target.name} (${target.roles[0]}) can decide step ${row.current + 1} of ${row.id} until ${days} days from today. Every action is logged as on behalf of you.` : "Choose who decides this step for you."}
      requireReason
      confirmLabel="Delegate"
      confirmDisabled={!target}
      onConfirm={(reason) => (row && target ? act(delegateStep(row.id, target.id as UserId, target.roles[0], Number(days) || 5, reason)) : "Choose a person.")}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field id="dlg-to" label="Delegate to">
          <SimpleSelect id="dlg-to" value={to} onChange={setTo} placeholder="Choose a person" options={USERS.filter((u) => u.id !== userId).map((u) => ({ value: u.id, label: `${u.name} · ${u.roles[0]}` }))} />
        </Field>
        <Field id="dlg-days" label="For how many days">
          <Input id="dlg-days" type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
      </div>
    </DialogShell>
  )
}

function DelegationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const admin = useSlice("admin")
  const { userId, role } = useCore()
  const [to, setTo] = useState("")
  const [from, setFrom] = useState(TODAY)
  const [until, setUntil] = useState("")
  const [scope, setScope] = useState("All workflows")
  const target = USERS.find((u) => u.id === to)
  const list = admin.delegations
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      wide
      title="Delegations"
      description={`Per-user delegate with a date range [DOC:p.11 W.1]. You are ${userName(userId)} (${role}).`}
      consequence={target && until ? `From ${from} to ${until}, ${target.name} decides your ${role} steps${scope === "All workflows" ? "" : ` for ${scope}`}. Financial approvals above $250,000 are never delegated (C-2).` : "Add a delegate for your own steps, or revoke one you set."}
      requireReason
      reasonLabel="Reason (required for a new delegation)"
      confirmLabel="Add delegation"
      confirmDisabled={!target || !until}
      onConfirm={(reason) => (target ? act(addDelegation({ toUser: target.id as UserId, toRole: target.roles[0] as Role, validFrom: from, validTo: until, scope: scope === "All workflows" ? "All workflows" : [scope], reason })) : "Choose a person.")}
    >
      <div className="max-h-64 overflow-y-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-table-head text-left">
            <tr><th className="p-2">Id</th><th className="p-2">From</th><th className="p-2">To</th><th className="p-2">Range</th><th className="p-2">Scope</th><th className="p-2">State</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-2 font-mono">{d.id}</td>
                <td className="p-2">{userName(d.fromUser)}<br /><span className="text-muted-foreground">{d.fromRole}</span></td>
                <td className="p-2">{userName(d.toUser)}<br /><span className="text-muted-foreground">{d.toRole}</span></td>
                <td className="p-2 tabular">{d.validFrom} → {d.validTo}</td>
                <td className="p-2">{d.requestId ? `Request ${d.requestId}` : d.scope === "All workflows" ? d.scope : d.scope.join(", ")}</td>
                <td className="p-2">{delegationState(d)}</td>
                <td className="p-2">{d.fromUser === userId && !d.revokedOn && delegationState(d) !== "Expired" && <Button size="sm" variant="ghost" onClick={() => act(revokeDelegation(d.id))}>Revoke</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field id="sd-to" label="Delegate to">
          <SimpleSelect id="sd-to" value={to} onChange={setTo} placeholder="Choose a person" options={USERS.filter((u) => u.id !== userId).map((u) => ({ value: u.id, label: `${u.name} · ${u.roles[0]}` }))} />
        </Field>
        <Field id="sd-from" label="From"><Input id="sd-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field id="sd-until" label="Until"><Input id="sd-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
        <Field id="sd-scope" label="Scope">
          <SimpleSelect id="sd-scope" value={scope} onChange={setScope} options={[{ value: "All workflows", label: "All workflows" }, ...W4.filter((w) => w.steps.some((s) => s.role === role) || w.ownerRole === role).map((w) => ({ value: w.id, label: `${w.id} ${w.workflow}` }))]} />
        </Field>
      </div>
    </DialogShell>
  )
}
