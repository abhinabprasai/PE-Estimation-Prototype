// Approval history, reject, recall and resubmit dialogs [DOC:pp.10-11 W.1]: "reject with mandatory comments, recall
// before first approval, resubmit preserving history". Built once here and shown in every state at /approvals/dialogs.
// Recall and resubmit act on both queues; the shared engine has no recall or resubmit, so admin/data/actions.ts does them (request R-3).

import { Link } from "react-router"
import { DialogShell } from "@/components/templates"
import { userName } from "./common"
import { decide, recall, resubmit } from "../data/actions"
import type { InboxRow } from "../lib/engine"
import type { AuditEntry } from "../data/types"
import { fmtDateTime } from "../lib/time"
import { act } from "./common"

/** Why an action is or is not offered for a request, in words. null = offered. */
export function recallWhy(row: InboxRow, role: string): string | null {
  if (row.outcome) return `Already ${row.outcome.toLowerCase()}: nothing to recall.`
  if (row.steps.some((s) => s.decided)) return "A step has already been approved: the initiator may recall only before the first approval."
  if (row.raisedBy !== role) return `Only the initiator (${row.raisedBy}) can recall.`
  return null
}
export function resubmitWhy(row: InboxRow, role: string): string | null {
  if (row.outcome !== "Rejected" && row.outcome !== "Recalled") return "Only a rejected or recalled request can be resubmitted."
  if (row.raisedBy !== role) return `Only the initiator (${row.raisedBy}) can resubmit.`
  return null
}

export function RejectDialog({ row, onClose }: { row: InboxRow | null; onClose: () => void }) {
  return (
    <DialogShell
      open={!!row}
      onOpenChange={(o) => !o && onClose()}
      title={`Reject ${row?.id ?? ""}`}
      description={row?.title}
      consequence="Ends this round and returns the request to the initiator with your comment. The initiator can resubmit; every round stays on the history."
      requireReason
      reasonLabel="Comment for the initiator (required)"
      confirmLabel="Reject request"
      destructive
      onConfirm={(c) => act(decide(row!.id, "Rejected", c))}
    />
  )
}
export function RecallDialog({ row, onClose }: { row: InboxRow | null; onClose: () => void }) {
  return (
    <DialogShell
      open={!!row}
      onOpenChange={(o) => !o && onClose()}
      title={`Recall ${row?.id ?? ""}`}
      description={row?.title}
      consequence="Withdraws the request before anyone approved it. Approvers stop seeing it; it can be resubmitted later with the history kept."
      requireReason
      reasonLabel="Why you recall it (required)"
      confirmLabel="Recall request"
      destructive
      onConfirm={(c) => act(recall(row!.id, c))}
    />
  )
}
export function ResubmitDialog({ row, onClose }: { row: InboxRow | null; onClose: () => void }) {
  return (
    <DialogShell
      open={!!row}
      onOpenChange={(o) => !o && onClose()}
      title={`Resubmit ${row?.id ?? ""}`}
      description={row?.title}
      consequence={row ? `Starts round ${row.rounds + 2} with the same approvers (a request on the shared engine gets a new id, linked to this one). Round ${row.rounds + 1} and its comments stay on the history.` : undefined}
      requireReason
      reasonLabel="What changed since the last round (required)"
      confirmLabel="Resubmit request"
      onConfirm={(c) => act(resubmit(row!.id, c))}
    />
  )
}

export function HistoryDialog({ row, audit, rounds, onClose }: { row: InboxRow | null; audit: AuditEntry[]; rounds: { outcome: string; closedAt: string; steps: { role: string; decided?: { outcome: string; by: string; on: string; reason?: string } }[] }[]; onClose: () => void }) {
  return (
    <DialogShell open={!!row} onOpenChange={(o) => !o && onClose()} title={`History of ${row?.id ?? ""}`} description={row?.title} confirmLabel="Close" onConfirm={() => null} wide>
      {row && (
        <div className="flex flex-col gap-4 text-sm">
          {rounds.length > 0 && (
            <section aria-label="Earlier rounds">
              <h3 className="font-semibold">Earlier rounds (kept on resubmit)</h3>
              <ol className="flex flex-col gap-1">
                {rounds.map((r, n) => (
                  <li key={n}>Round {n + 1}: {r.outcome}, closed {fmtDateTime(r.closedAt)}. {r.steps.filter((s) => s.decided).map((s) => `${s.role} ${s.decided!.outcome.toLowerCase()}${s.decided!.reason ? ` ("${s.decided!.reason}")` : ""}`).join("; ")}</li>
                ))}
              </ol>
            </section>
          )}
          <section aria-label="Audit trail">
            <h3 className="font-semibold">Audit trail (immutable)</h3>
            {audit.length === 0 ? <p className="text-muted-foreground">No entries.</p> : (
              <ol className="flex flex-col gap-1 border-l-2 pl-3">
                {audit.map((e, n) => (
                  <li key={n}><span className="tabular text-xs text-muted-foreground">{fmtDateTime(e.at)}</span> {e.action} by {userName(e.by)} ({e.role}) via {e.channel}{e.onBehalfOf ? `, on behalf of ${userName(e.onBehalfOf)}` : ""}{e.comment ? `: "${e.comment}"` : ""}</li>
                ))}
              </ol>
            )}
          </section>
          <p><Link className="text-link underline-offset-4 hover:underline" to={`/approvals?req=${row.id}`}>Open in the inbox</Link></p>
        </div>
      )}
    </DialogShell>
  )
}
