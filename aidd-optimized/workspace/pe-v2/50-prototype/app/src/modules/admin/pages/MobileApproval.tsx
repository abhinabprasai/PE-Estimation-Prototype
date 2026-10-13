// FX-WF-MOBILE Mobile approval view [DOC:p.11 W.1; Book IV §7.7]: approve or reject from a phone, and the signed-link
// landing pages opened from an approval email (ActionLanding.tsx). Rendered on KioskPage (floor-touch template: 48 px
// targets, 64 px primary, bottom bar) with the content held to a phone column of 390 px (design value, AR-36).
// A decision made here reaches the same engine as WF-INBOX, with channel "Mobile".

import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ErrorAlert, EmptyState, SkeletonRows } from "@/components/patterns"
import { KioskPage, KioskFact } from "@/components/templates"
import { fmtMoney } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { decide } from "../data/actions"
import { canAct, inboxRows, waitingFor, type InboxRow } from "../lib/engine"
import { fmtDateTime } from "../lib/time"
import { SlaClock, userName } from "../components/common"
import { useView } from "../components/states"
import { StatePicker } from "../components/states"

export function MobileApproval() {
  const a = useSlice("admin")
  const c = useSlice("adminCfg")
  const core = useCore()
  const view = useView("FX-WF-MOBILE")
  const [sel, setSel] = useState<string | null>(null)
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view")
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)
  const rows = inboxRows(core.approvals, a).filter((r) => !r.outcome && waitingFor(r, core.role, core.userId, a.delegations))
  const row: InboxRow | undefined = rows.find((r) => r.id === sel)
  const chk = row ? canAct(row, core.role, core.userId, a.delegations) : undefined
  const reset = () => { setMode("view"); setComment(""); setError(null) }
  const send = (outcome: "Approved" | "Rejected") => {
    const w = view.writeError()
    if (w) return setError(w)
    const r = decide(row!.id, outcome, comment.trim() || undefined, "Mobile")
    if (!r.ok) return setError(r.error)
    toast.success(r.value)
    setSel(null)
    reset()
  }
  const online = view.state !== "offline"

  const actions = row && view.state !== "denied"
    ? mode === "view"
      ? [
          { label: "Approve", primary: true, onClick: () => setMode("approve"), disabled: !chk?.can || !online },
          { label: "Reject", onClick: () => setMode("reject"), disabled: !chk?.can || !online },
          { label: "Back to the list", onClick: () => { setSel(null); reset() } },
        ]
      : [
          { label: mode === "approve" ? "Confirm approval" : "Confirm rejection", primary: true, destructive: mode === "reject", onClick: () => send(mode === "approve" ? "Approved" : "Rejected"), disabled: !online },
          { label: "Cancel", onClick: reset },
        ]
    : []

  return (
    <KioskPage
      title="Approvals"
      screenId="FX-WF-MOBILE"
      operator={userName(core.userId)}
      station={core.role}
      online={online}
      exitTo="/approvals"
      banners={
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between"><span className="text-base text-muted-foreground">Phone view, 390 px column. Prototype state:</span><StatePicker view={view} /></div>
          {view.state === "degraded" && <p role="status" className="rounded-md bg-offline-banner-bg px-4 py-3 text-base text-status-pending-ink">Degraded: notifications are slow. Your decision records at once; the confirmation email is late.</p>}
          {!online && <p role="status" className="rounded-md bg-offline-banner-bg px-4 py-3 text-base text-status-pending-ink">You are offline. A decision must reach the approval engine, so nothing is queued: approve and reject are off until you reconnect.</p>}
          {view.state === "readonly" && <p role="status" className="rounded-md bg-muted px-4 py-3 text-base">Read-only: you can read your queue and decide nothing.</p>}
        </div>
      }
      actions={actions}
    >
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-4">
        {view.state === "denied" ? (
          <ErrorAlert title="You do not have access to the approvals queue">Your role holds no approval step. Nothing is shown.</ErrorAlert>
        ) : view.loading ? (
          <SkeletonRows cols={2} rows={4} />
        ) : !row ? (
          <>
            <h2 className="text-xl font-semibold">Waiting for you</h2>
            {view.empty || rows.length === 0 ? (
              <EmptyState title="Nothing waits for you.">Requests that need your decision appear here and in your email.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-3">
                {rows.map((r) => {
                  return (
                    <li key={r.id}>
                      <button className="flex min-h-14 w-full flex-col gap-1 rounded-lg border p-4 text-left hover:bg-muted" onClick={() => setSel(r.id)}>
                        <span className="text-base font-semibold">{r.kind}{r.amount != null ? ` · ${fmtMoney(r.amount, r.currency)}` : ""}</span>
                        <span className="text-sm">{r.title}</span>
                        <span className="font-mono text-xs text-muted-foreground">{r.id}{r.overdue ? " · over SLA" : ""}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <section aria-label="Email links" className="flex flex-col gap-2 border-t pt-4">
              <h3 className="text-base font-semibold">Open an email link (prototype)</h3>
              <p className="text-sm text-muted-foreground">Each approval email carries a signed link. These open the four landing pages.</p>
              <ul className="flex flex-col gap-1 text-sm">
                {c.links.map((l) => (
                  <li key={l.token}><Link className="text-link underline-offset-4 hover:underline" to={`/approvals/action/${l.token}`}>{l.action} {l.requestId}</Link> <span className="text-muted-foreground">for the {l.forRole}</span></li>
                ))}
                <li><Link className="text-link underline-offset-4 hover:underline" to="/approvals/action/not-a-real-token">A link that was never issued</Link></li>
              </ul>
            </section>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">{row.kind}</h2>
            <p className="text-base">{row.title}</p>
            <div className="grid grid-cols-2 gap-4">
              <KioskFact label="Request">{row.id}</KioskFact>
              <KioskFact label="Amount">{row.amount != null ? fmtMoney(row.amount, row.currency) : "None"}</KioskFact>
            </div>
            <SlaClock ageHours={row.ageHours} slaHours={row.steps[row.open[0]].slaHours} overdue={row.overdue} escalateTo={row.steps[row.open[0]].escalateTo} />
            <p className="text-sm">Raised by {row.raisedBy}, {fmtDateTime(row.raisedAt)}. Subject: <Link className="text-link underline-offset-4 hover:underline" to={row.subject.route}>{row.subject.label}</Link></p>
            <ol className="flex flex-col gap-1 text-sm">
              {row.steps.map((st, n) => <li key={n}>{n + 1}. {st.role}: {st.decided ? `${st.decided.outcome.toLowerCase()} by ${userName(st.decided.by)}` : row.open.includes(n) ? "waiting" : "later"}</li>)}
            </ol>
            {!chk?.can && <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">{chk?.reason}</p>}
            {mode !== "view" && (
              <div className="flex flex-col gap-2">
                <p className="rounded-md bg-muted px-3 py-2 text-sm">{mode === "approve" ? `Approves ${row.id}${row.steps.length > row.open.length + row.steps.filter((s) => s.decided).length ? " and sends it to the next step" : ""}. This cannot be undone from the phone.` : `Rejects ${row.id} and returns it to ${row.raisedBy} with your comment.`}</p>
                <Label htmlFor="mob-comment" className="text-base">{mode === "reject" ? "Comment (required)" : "Comment (optional)"}</Label>
                <Textarea id="mob-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={mode === "reject" && !comment.trim() && !!error} className="text-base" />
              </div>
            )}
            {error && <p role="alert" className="text-base text-destructive">{error}</p>}
            <Button variant="link" asChild className="self-start px-0"><Link to={`/approvals?req=${row.id}`}>Open the full request on the desktop inbox</Link></Button>
          </>
        )}
      </div>
    </KioskPage>
  )
}
