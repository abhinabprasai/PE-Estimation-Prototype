// FX-WF-DIALOGS Approval history, recall and reject dialogs [DOC:pp.10-11 W.1]: reject with mandatory comments, recall
// before the first approval, resubmit preserving history. Dialog entry: the dialogs are components
// (components/ApprovalDialogs.tsx) and this page shows each one against live requests in every state, so the route is
// never empty. WF-INBOX keeps its own inline reject and delegate dialogs.

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Chip, DataTable, RulesPanel } from "@/components/patterns"
import { ListPage } from "@/components/templates"
import { useCore, useSlice } from "@/store"
import { canAct, inboxRows, roundsOf, type InboxRow } from "../lib/engine"
import { HistoryDialog, RecallDialog, RejectDialog, ResubmitDialog, recallWhy, resubmitWhy } from "../components/ApprovalDialogs"
import { StateText } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

type Which = null | { kind: "history" | "reject" | "recall" | "resubmit"; id: string }

export function ApprovalDialogs() {
  const a = useSlice("admin")
  const core = useCore()
  const view = useView("FX-WF-DIALOGS")
  const [open, setOpen] = useState<Which>(null)
  const rows = view.empty ? [] : inboxRows(core.approvals, a)
  const row = open ? rows.find((r) => r.id === open.id) ?? null : null
  const rounds = row ? roundsOf(row.id, a) : []
  const stateOf = (r: InboxRow) => (r.outcome ? r.outcome : r.steps.some((s) => s.decided) ? "Partly approved" : "Waiting")
  const guard = (fn: () => void) => () => { const w = view.writeError(); w ? view.run(() => ({ ok: false as const, error: w })) : fn() }

  const specimen = [
    { name: "Reject", state: "Validation", text: "Sending with no comment keeps the dialog open: \"Enter a reason to continue.\" The comment is mandatory." },
    { name: "Reject", state: "Authorization", text: "Only the approver whose step is open (or a delegate) can reject; everyone else sees the reason the button is off." },
    { name: "Recall", state: "Refused", text: "After the first approval the initiator can no longer recall: \"The initiator may recall only before the first approval.\"" },
    { name: "Recall", state: "Normal", text: "Before any approval, the initiator recalls with a reason; approvers stop seeing the request." },
    { name: "Resubmit", state: "Normal", text: "A rejected or recalled request restarts on the same id as the next round; earlier rounds and comments stay on the history." },
    { name: "History", state: "Read-only", text: "Earlier rounds and the immutable audit trail; decided requests are read-only." },
  ]

  return (
    <div className="flex flex-col gap-6">
      <StateFrame view={view} cols={7} emptyTitle="No approval requests." emptyBody="Requests raised on any module screen appear here." degraded="Degraded: the notification service is slow. Decisions record at once; the emails that follow them are queued." subject="the approval dialogs">
        <ListPage<InboxRow>
          header={{
            title: "Approval history, recall and reject",
            screenId: "FX-WF-DIALOGS",
            description: "The four dialogs of the approval lifecycle, offered per request with the rule that allows or refuses each. Reject needs a comment, recall works only before the first approval, resubmit keeps every earlier round.",
            chips: <Chip kind="design" note="Route /approvals/dialogs is a design value; the dialogs are the W.1 lifecycle">Dialog page</Chip>,
            crumbs: [{ label: "Approvals", to: "/approvals" }, { label: "Dialogs" }],
            actions: (<><StatePicker view={view} /><Button variant="outline" asChild><Link to="/approvals">Approvals inbox</Link></Button></>),
          }}
          table={{
            rows,
            rowId: (r) => r.id,
            loading: view.loading,
            caption: "Requests and the dialogs each allows",
            searchText: (r) => `${r.id} ${r.title} ${r.kind} ${r.raisedBy}`,
            searchPlaceholder: "Search requests",
            columns: [
              { id: "id", header: "Request", value: (r) => r.id, mono: true, sortable: true },
              { id: "kind", header: "Kind", value: (r) => r.kind, filterable: true },
              { id: "title", header: "What", value: (r) => r.title, className: "max-w-[300px]" },
              { id: "by", header: "Initiator", value: (r) => r.raisedBy },
              { id: "st", header: "State", value: (r) => stateOf(r), filterable: true, cell: (r) => <StateText tone={r.outcome === "Rejected" || r.outcome === "Recalled" ? "attention" : "default"}>{stateOf(r)}{r.rounds ? ` · round ${r.rounds + 1}` : ""}</StateText> },
              { id: "act", header: "Dialogs", cell: (r) => {
                const chk = canAct(r, core.role, core.userId, a.delegations)
                const rw = recallWhy(r, core.role)
                const sw = resubmitWhy(r, core.role)
                return (
                  <span className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setOpen({ kind: "history", id: r.id })}>History</Button>
                    <Button size="sm" variant="outline" disabled={!chk.can} title={chk.can ? undefined : chk.reason} onClick={guard(() => setOpen({ kind: "reject", id: r.id }))}>Reject</Button>
                    <Button size="sm" variant="outline" disabled={!!rw} title={rw ?? undefined} onClick={guard(() => setOpen({ kind: "recall", id: r.id }))}>Recall</Button>
                    <Button size="sm" variant="outline" disabled={!!sw} title={sw ?? undefined} onClick={guard(() => setOpen({ kind: "resubmit", id: r.id }))}>Resubmit</Button>
                  </span>
                )
              } },
            ],
          }}
          below={
            <section aria-label="Dialog states" className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">The states of each dialog</h2>
              <DataTable
                rows={specimen}
                rowId={(x) => `${x.name}-${x.state}`}
                densityKey="FX-WF-DIALOGS-states"
                caption="Dialog states"
                columns={[{ id: "n", header: "Dialog", value: (x) => x.name }, { id: "s", header: "State", value: (x) => x.state, filterable: true }, { id: "t", header: "What the user sees", value: (x) => x.text, className: "max-w-[560px]" }]}
              />
              <p className="text-xs text-muted-foreground">Hover a disabled button to read why it is off. Recall and Resubmit work on both queues. On the shared engine a recall closes the open step as a rejection, and a resubmit raises a new request linked to the earlier one, carrying its rounds (request R-3 asks the core for one id).</p>
            </section>
          }
        />
      </StateFrame>
      <RulesPanel
        rules={[
          ["W.1-a", "Reject needs a comment; the request returns to the initiator", "DOC:pp.10-11 W.1"],
          ["W.1-b", "The initiator may recall before the first approval", "DOC:p.11 W.1"],
          ["W.1-c", "Resubmit keeps the history of earlier rounds", "DOC:p.11 W.1"],
          ["W.1-d", "Every decision and every recall is on an immutable audit trail with its channel", "DOC:p.11 W.1"],
        ]}
      />
      <RejectDialog row={open?.kind === "reject" ? row : null} onClose={() => setOpen(null)} />
      <RecallDialog row={open?.kind === "recall" ? row : null} onClose={() => setOpen(null)} />
      <ResubmitDialog row={open?.kind === "resubmit" ? row : null} onClose={() => setOpen(null)} />
      <HistoryDialog row={open?.kind === "history" ? row : null} audit={row ? a.audit.filter((e) => e.requestId === row.id) : []} rounds={rounds.map((r) => ({ outcome: r.outcome, closedAt: r.closedAt, steps: r.steps.map((s) => ({ role: s.role, decided: s.decided && { outcome: s.decided.outcome, by: s.decided.by, on: s.decided.on, reason: s.decided.reason } })) }))} onClose={() => setOpen(null)} />
    </div>
  )
}
