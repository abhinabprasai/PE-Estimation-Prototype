// FX-WF-MOBILE email-action landing pages [DOC:p.11 W.1; Book IV §7.7]: a signed link in an approval email opens one of
// four pages: confirm, expired, already actioned, unauthorized. The link only prepares the decision: the approver
// still presses Confirm, and the decision goes through the same engine as WF-INBOX with channel "Email link".

import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { CheckCircle2, Clock, Lock, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { KioskFact, KioskPage } from "@/components/templates"
import { fmtMoney } from "@/lib/format"
import { store, useCore, useSlice } from "@/store"
import { actionByLink, reissueLink } from "../data/cfg-actions"
import { NOW } from "../data/seed"
import { canAct, inboxRows } from "../lib/engine"
import { fmtDateTime } from "../lib/time"
import { SlaClock, userName } from "../components/common"
import { StatePicker, useView } from "../components/states"

export function ActionLanding() {
  const { token = "" } = useParams()
  const navigate = useNavigate()
  const a = useSlice("admin")
  const c = useSlice("adminCfg")
  const core = useCore()
  const view = useView("FX-WF-MOBILE-LINK")
  const [done, setDone] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const link = c.links.find((l) => l.token === token)
  const row = link ? inboxRows(core.approvals, a).find((r) => r.id === link.requestId) : undefined
  const online = view.state !== "offline"

  let body: React.ReactNode
  let title = "Approval link"
  let actions: { label: string; onClick: () => void; primary?: boolean; destructive?: boolean; disabled?: boolean }[] = []

  const home = { label: "Open the approvals inbox", onClick: () => navigate("/approvals") }
  const closer = (outcome: string, by?: string, on?: string) => (
    <p className="text-base">{outcome}{by ? ` by ${by}` : ""}{on ? ` on ${fmtDateTime(on)}` : ""}.</p>
  )

  if (!link || !row) {
    title = "Link not recognised"
    body = (
      <div className="flex flex-col gap-3"><Lock className="size-10" aria-hidden="true" />
        <h2 className="text-xl font-semibold">This link is not valid</h2>
        <p className="text-base">The link was altered, or it was never issued by this system. No decision was recorded. Open the request from your approvals inbox instead.</p></div>
    )
    actions = [{ ...home, primary: true }]
  } else if (done) {
    title = "Decision recorded"
    body = <div className="flex flex-col gap-3"><CheckCircle2 className="size-10" aria-hidden="true" /><h2 className="text-xl font-semibold">Recorded</h2><p className="text-base">{done}</p></div>
    actions = [{ ...home, primary: true }]
  } else if (link.usedAt || row.outcome) {
    const lastStep = [...row.steps].reverse().find((s) => s.decided)
    title = "Already actioned"
    body = (
      <div className="flex flex-col gap-3"><CheckCircle2 className="size-10" aria-hidden="true" />
        <h2 className="text-xl font-semibold">This request was already actioned</h2>
        {row.outcome ? closer(`${row.id} is ${row.outcome.toLowerCase()}`, lastStep?.decided ? userName(lastStep.decided.by) : undefined, lastStep?.decided?.on) : closer(`${row.id}: your step was ${link.action === "Approve" ? "approved" : "decided"}`, userName(link.usedBy ?? ""), link.usedAt)}
        <p className="text-sm text-muted-foreground">A link works once. Nothing changes if you open it again.</p></div>
    )
    actions = [{ ...home, primary: true }]
  } else if (link.expiresAt < NOW) {
    title = "Link expired"
    body = (
      <div className="flex flex-col gap-3"><Clock className="size-10" aria-hidden="true" />
        <h2 className="text-xl font-semibold">This link has expired</h2>
        <p className="text-base">The link for {row.id} was valid until {fmtDateTime(link.expiresAt)}. The request is still waiting for the {link.forRole}.</p>
        {fresh ? <p role="status" className="rounded-md bg-muted px-3 py-2 text-base">A new link was sent to {userName(link.forUser)}. <Link className="text-link underline-offset-4 hover:underline" to={`/approvals/action/${fresh}`}>Prototype: open the new link</Link></p> : null}
        {error && <p role="alert" className="text-base text-destructive">{error}</p>}</div>
    )
    actions = [
      { label: "Send me a new link", primary: true, disabled: !!fresh || !online, onClick: () => { const r = reissueLink(link.token); if (r.ok) setFresh(r.value); else setError(r.error) } },
      home,
    ]
  } else if (core.role !== link.forRole) {
    title = "Not authorized"
    body = (
      <div className="flex flex-col gap-3"><ShieldAlert className="size-10" aria-hidden="true" />
        <h2 className="text-xl font-semibold">This link is not for you</h2>
        <p className="text-base">It was sent to {userName(link.forUser)}, the {link.forRole}. You are signed in as the {core.role}. No decision was recorded and nothing about the request is shown here.</p>
        <p className="text-sm text-muted-foreground">Sign in as the approver to continue. A forwarded link does not carry the approver's authority.</p></div>
    )
    actions = [{ label: `Sign in as the ${link.forRole}`, primary: true, onClick: () => store.setRole(link.forRole) }, home]
  } else {
    const chk = canAct(row, core.role, core.userId, a.delegations)
    const reject = link.action === "Reject"
    title = `${link.action} ${row.id}`
    body = (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{reject ? "Reject" : "Approve"} this request?</h2>
        <p className="text-base">{row.title}</p>
        <div className="grid grid-cols-2 gap-4"><KioskFact label="Request">{row.id}</KioskFact><KioskFact label="Amount">{row.amount != null ? fmtMoney(row.amount, row.currency) : "None"}</KioskFact></div>
        <SlaClock ageHours={row.ageHours} slaHours={row.steps[row.open[0]].slaHours} overdue={row.overdue} escalateTo={row.steps[row.open[0]].escalateTo} />
        <p className="rounded-md bg-muted px-3 py-2 text-base">{reject ? `Rejects ${row.id} and returns it to ${row.raisedBy} with your comment.` : `Approves ${row.id} as the ${link.forRole}. The decision is recorded with channel Email link.`}</p>
        <div className="flex flex-col gap-2"><Label htmlFor="lnk-comment" className="text-base">{reject ? "Comment (required)" : "Comment (optional)"}</Label><Textarea id="lnk-comment" rows={3} className="text-base" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
        {!chk.can && <p role="status" className="rounded-md bg-muted px-3 py-2 text-base">{chk.reason}</p>}
        {error && <p role="alert" className="text-base text-destructive">{error}</p>}
      </div>
    )
    actions = [
      { label: reject ? "Confirm rejection" : "Confirm approval", primary: true, destructive: reject, disabled: !chk.can || !online, onClick: () => {
        const w = view.writeError()
        if (w) return setError(w)
        const r = actionByLink(link.token, reject ? "Rejected" : "Approved", comment)
        if (!r.ok) return setError(r.error)
        toast.success(r.value)
        setError(null)
        setDone(r.value)
      } },
      { label: "Open the full request instead", onClick: () => navigate(`/approvals?req=${row.id}`) },
    ]
  }

  return (
    <KioskPage
      title={title}
      screenId="FX-WF-MOBILE"
      operator={userName(core.userId)}
      station={`Acting as ${core.role}`}
      online={online}
      exitTo="/approvals"
      banners={<div className="flex items-center justify-between"><span className="text-base text-muted-foreground">Signed link {token.slice(0, 6)}…</span><StatePicker view={view} /></div>}
      actions={view.state === "denied" ? [] : actions}
    >
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-4">{view.state === "denied" ? <p className="text-base">Your role cannot open approval links.</p> : body}</div>
    </KioskPage>
  )
}
