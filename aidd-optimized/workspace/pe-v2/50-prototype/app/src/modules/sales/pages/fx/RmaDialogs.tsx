// FX-RMA-DIALOGS RMA action dialogs (/sales/dialogs/rma-actions) [DOC:pp.26-27 Book I A §3.8-3.10].
// Approve or reject (and recall) while Pending Approval, cancel before first receipt, close short on a partial
// receipt, reopen within 30 days of Closed (Controller), and the decision on an Unauthorized Return line.
import { useState } from "react"
import { Link } from "react-router"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { store, useCore, useRole, useSlice } from "@/store"
import { cancelRma, closeShort, recallRma, reopenRma } from "../../data/ext-actions"
import type { Rma } from "../../data/ext-model"
import { decideUnauthorized } from "../../fx/actions"
import { DialogPage, PickField, report, useFxState } from "./kit"

const rmaLabel = (db: ReturnType<typeof useSlice<"sales">>, r: Rma) => `${r.id} · ${r.cls} · ${r.status} · ${db.customers.find((c) => c.id === r.customerId)?.name ?? r.customerId}`

export function RmaApprovalDialog({ rma, open, onOpenChange }: { rma: Rma; open: boolean; onOpenChange: (o: boolean) => void }) {
  const core = useCore()
  const [role] = useRole()
  const [mode, setMode] = useState<"Approved" | "Rejected" | "Recall">("Approved")
  const req = core.approvals.find((a) => !a.outcome && a.kind === "RMA approval" && a.subject.type === "rma" && a.subject.id === rma.id)
  const step = req?.steps.find((s) => !s.decided)
  const block = rma.status !== "Pending Approval" ? `${rma.id} is ${rma.status}: approve, reject and recall apply while it is Pending Approval.` : !req ? "No open approval request for this RMA." : null
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`${mode === "Recall" ? "Recall" : mode === "Approved" ? "Approve" : "Reject"} ${rma.id}`} description={req ? `${req.id} waits for ${step?.role ?? "no one"}. You are acting as ${role}.` : "No open request."}
      consequence={mode === "Approved" ? `Records your step on ${req?.id ?? "the request"}. When the last step approves, ${rma.id} becomes Authorized and the RMA barcode is ready on the return instructions.` : mode === "Rejected" ? `Rejects ${rma.id}: it becomes Rejected, a terminal status, and the reason goes to the requester.` : `Withdraws ${rma.id} to Draft so the requester can edit and resubmit; the open request is held until then.`}
      requireReason={mode !== "Approved"} reasonLabel={mode === "Rejected" ? "Reason for rejecting (required)" : "Why is it recalled? (required)"} confirmLabel={mode === "Approved" ? "Approve" : mode === "Rejected" ? "Reject" : "Recall to Draft"} destructive={mode === "Rejected"} confirmDisabled={!!block}
      onConfirm={(reason) => {
        if (mode === "Recall") return report(recallRma(rma.id, reason), `${rma.id} recalled to Draft`)
        if (!req) return "No open approval request."
        const r = store.decideApproval(req.id, mode, reason)
        return report(r, mode === "Approved" ? (r.ok && r.value.outcome ? `${rma.id} approved: Authorized` : "Your step is recorded; the next approver is notified") : `${rma.id} rejected`)
      }}>
      {block && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{block}</p>}
      {req && <ol className="text-sm">{req.steps.map((s, i) => <li key={i}>Step {i + 1}: {s.role} · {s.decided ? `${s.decided.outcome} ${s.decided.on}` : "waiting"}</li>)}</ol>}
      <PickField label="Action" value={mode} onChange={(v) => setMode(v as typeof mode)} options={[{ value: "Approved", label: "Approve" }, { value: "Rejected", label: "Reject" }, { value: "Recall", label: "Recall (requester)" }]} />
      <p className="text-xs text-muted-foreground">Approval is decided here or in the inbox by the role the step names; this is the same shared engine (C-1). <Chip kind="oq" id="OQ-21" note="Approval request status: no list in the PRD." /></p>
    </DialogShell>
  )
}

export function RmaCancelDialog({ rma, open, onOpenChange }: { rma: Rma; open: boolean; onOpenChange: (o: boolean) => void }) {
  return <DialogShell open={open} onOpenChange={onOpenChange} title={`Cancel ${rma.id}`} description="Allowed from Authorized, until the first receipt. Customer Service Manager." consequence={`Cancels ${rma.id}; it becomes Cancelled (terminal) and the return instructions are void.`} requireReason reasonLabel="Reason for the cancellation (required)" confirmLabel="Cancel RMA" destructive confirmDisabled={rma.status !== "Authorized"} onConfirm={(r) => report(cancelRma(rma.id, r), `${rma.id} cancelled`)}>
    {rma.status !== "Authorized" && <p role="alert" className="text-sm text-destructive">Cancel is allowed until first receipt, from Authorized. {rma.id} is {rma.status}.</p>}
  </DialogShell>
}
export function RmaCloseShortDialog({ rma, open, onOpenChange }: { rma: Rma; open: boolean; onOpenChange: (o: boolean) => void }) {
  const open_ = rma.lines.filter((l) => !l.unauthorized && l.qtyAuth > l.qtyRecd)
  return <DialogShell open={open} onOpenChange={onOpenChange} title={`Close ${rma.id} short`} description="A supervisor action on a Partially Received RMA." consequence={`Cuts the open remainder (${open_.map((l) => `line ${l.no}: ${l.qtyAuth - l.qtyRecd}`).join(", ") || "none"}) and moves ${rma.id} to Received so inspection can start.`} requireReason reasonLabel="Why is the remainder closed short? (required)" confirmLabel="Close short" confirmDisabled={rma.status !== "Partially Received"} onConfirm={(r) => report(closeShort(rma.id, r), `${rma.id} closed short`)}>
    {rma.status !== "Partially Received" && <p role="alert" className="text-sm text-destructive">Close Short applies to a Partially Received RMA. {rma.id} is {rma.status}.</p>}
  </DialogShell>
}
export function RmaReopenDialog({ rma, open, onOpenChange }: { rma: Rma; open: boolean; onOpenChange: (o: boolean) => void }) {
  return <DialogShell open={open} onOpenChange={onOpenChange} title={`Reopen ${rma.id}`} description={rma.closedOn ? `Closed ${rma.closedOn}. The window is 30 days. Controller only.` : "Reopen applies to a Closed RMA."} consequence={`Moves ${rma.id} Closed → Disposition Pending with the reason in its history.`} requireReason reasonLabel="Reason for reopening (required)" confirmLabel="Reopen" confirmDisabled={rma.status !== "Closed"} onConfirm={(r) => report(reopenRma(rma.id, r), `${rma.id} reopened`)}>
    {rma.status !== "Closed" && <p role="alert" className="text-sm text-destructive">Reopen applies to a Closed RMA. {rma.id} is {rma.status}.</p>}
  </DialogShell>
}
export function UnauthorizedLineDialog({ rma, open, onOpenChange }: { rma: Rma; open: boolean; onOpenChange: (o: boolean) => void }) {
  const lines = rma.lines.filter((l) => l.unauthorized)
  const [no, setNo] = useState(String(lines[0]?.no ?? ""))
  const [dec, setDec] = useState<"append" | "return">("append")
  const l = lines.find((x) => String(x.no) === no)
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Unauthorized return line on ${rma.id}`} description="Booked at receipt with a supervisor override. It is inspected on its own before the decision." consequence={dec === "append" ? "Appends the line to the RMA by a change; the RMA needs re-approval before the line can be dispositioned." : "Returns the unit to the customer at customer cost; the line closes with that decision."} requireReason reasonLabel="Reason for the decision (required)" confirmLabel={dec === "append" ? "Append via change" : "Return at customer cost"} confirmDisabled={!l || !!l.unauthorizedDecision}
      onConfirm={(r) => report(decideUnauthorized(rma.id, Number(no), dec, r), dec === "append" ? "Line appended; re-approval required" : "Line returned to the customer at customer cost")}>
      {lines.length === 0 ? <p className="text-sm text-muted-foreground">No Unauthorized Return line on this RMA.</p> : (
        <>
          <PickField label="Line" value={no} onChange={setNo} options={lines.map((x) => ({ value: String(x.no), label: `${x.no} · ${x.itemId}${x.serial ? ` ${x.serial}` : ""} · ${x.unauthorizedDecision ? `decided: ${x.unauthorizedDecision.decision}` : "undecided"}` }))} />
          {l && <p className="text-sm">Quantity received {l.qtyRecd}, condition {l.condition ?? "not inspected"}. {l.notes}</p>}
          <PickField label="Decision" value={dec} onChange={(v) => setDec(v as typeof dec)} options={[{ value: "append", label: "Append via change (re-approval)" }, { value: "return", label: "Return to customer at customer cost" }]} disabled={!!l?.unauthorizedDecision} />
          {l?.unauthorizedDecision && <p className="text-sm">Decided {l.unauthorizedDecision.on} by {l.unauthorizedDecision.by}: {l.unauthorizedDecision.decision}. {l.unauthorizedDecision.reason}</p>}
        </>
      )}
    </DialogShell>
  )
}

export function RmaActionsPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const first = (f: (r: Rma) => boolean) => db.rmas.find(f)?.id ?? db.rmas[0]?.id ?? ""
  const [ap, setAp] = useState(first((r) => r.status === "Pending Approval"))
  const [ca, setCa] = useState(first((r) => r.status === "Authorized"))
  const [cs, setCs] = useState(first((r) => r.status === "Partially Received"))
  const [re, setRe] = useState(first((r) => r.status === "Closed"))
  const [un, setUn] = useState(first((r) => r.lines.some((l) => l.unauthorized)))
  const get = (id: string) => db.rmas.find((r) => r.id === id)
  const pick = (v: string, set: (s: string) => void, label: string, r?: Rma) => (
    <div className="flex flex-col gap-1"><PickField label={label} value={v} onChange={set} options={db.rmas.map((x) => ({ value: x.id, label: rmaLabel(db, x) }))} />{r && <span className="flex items-center gap-2 text-xs"><StatusBadge kind="rma" status={r.status} size="sm" /><Link className="text-link underline" to={`/sales/rma/${r.id}`}>Open RMA</Link></span>}</div>
  )
  const cards = [
    { id: "ap", title: "Approve, reject or recall", open: "Open approval", body: pick(ap, setAp, "RMA", get(ap)), el: (o: boolean, c: (o: boolean) => void) => get(ap) && <RmaApprovalDialog rma={get(ap)!} open={o} onOpenChange={c} /> },
    { id: "ca", title: "Cancel (before first receipt)", open: "Open cancel", body: pick(ca, setCa, "RMA", get(ca)), el: (o: boolean, c: (o: boolean) => void) => get(ca) && <RmaCancelDialog rma={get(ca)!} open={o} onOpenChange={c} /> },
    { id: "cs", title: "Close short", open: "Open close short", body: pick(cs, setCs, "RMA", get(cs)), el: (o: boolean, c: (o: boolean) => void) => get(cs) && <RmaCloseShortDialog rma={get(cs)!} open={o} onOpenChange={c} /> },
    { id: "re", title: "Reopen (Controller, 30 days)", open: "Open reopen", body: pick(re, setRe, "RMA", get(re)), el: (o: boolean, c: (o: boolean) => void) => get(re) && <RmaReopenDialog rma={get(re)!} open={o} onOpenChange={c} /> },
    { id: "un", title: "Unauthorized-line decision", open: "Open decision", body: pick(un, setUn, "RMA", get(un)), el: (o: boolean, c: (o: boolean) => void) => get(un) && <UnauthorizedLineDialog rma={get(un)!} open={o} onOpenChange={c} /> },
  ]
  return (
    <DialogPage
      screenId="FX-RMA-DIALOGS"
      title="RMA action dialogs"
      description="The five decisions on an RMA, each with its eligibility, its consequence and a reason where the PRD asks for one."
      st={st}
      cards={cards.map((c) => ({ id: c.id, title: c.title, open: c.open, body: c.body, render: (o, cl) => c.el(o, cl) }))}
      rules={[
        ["RMA-1", "Lifecycle actions: Approve, Reject, Recall while Pending Approval; Cancel until first receipt (CS Manager); Close Short on a partial receipt (supervisor); Reopen within 30 days of Closed (Controller).", "DOC:p.26 §3.8; p.27 §3.10"],
        ["RMA-2", "Closed Short and Reopened are transitions, not statuses (K-14).", "K-14"],
        ["RMA-3", "An Unauthorized Return line is booked with a supervisor override, inspected on its own, then appended by a change (re-approval) or returned at customer cost.", "DOC:p.25 §3.5"],
      ]}
    />
  )
}
