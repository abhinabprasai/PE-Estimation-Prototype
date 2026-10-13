// FX-OM-CREDIT Credit release and de-peg decision dialogs (/sales/dialogs/credit-release-depeg)
// [DOC:p.49 Book I B §2.2; Book II §14.4]. Credit release is the Finance (credit) action, the limit raise is the
// Controller's (R-2). A de-peg takes stock from a pegged schedule line for another: it needs a reason and the
// Sales Director's decision.
import { useState } from "react"
import { Link } from "react-router"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { useSlice } from "@/store"
import { listDate, money, type Approval } from "../../data/model"
import { useStore } from "../../data/store"
import { decideDePeg, requestDePeg } from "../../fx/actions"
import type { DePeg } from "../../fx/model"
import { Section } from "../../components/ext"
import { DialogPage, PickField, TextField, report, useFxState } from "./kit"

export function CreditDecisionDialog({ approval, open, onOpenChange }: { approval: Approval; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db, actions, role } = useStore()
  const o = db.orders.find((x) => x.id === approval.soId)!
  const c = db.customers.find((x) => x.id === o.customerId)!
  const [mode, setMode] = useState<"release" | "reject" | "raise">("release")
  const [limit, setLimit] = useState(String(Math.ceil((c.exposure + approval.amount) / 50000) * 50000))
  const last = o.creditChecks.at(-1)
  const consequence = {
    release: `Releases the hold on ${o.id}: Credit Hold → Confirmed, logged with your name and the date.`,
    reject: `Rejects the order: ${o.id} goes Credit Hold → Cancelled and its exposure is removed (Reading OQ-28).`,
    raise: `Raises ${c.name}'s limit from ${money(c.creditLimit, c.currency)} to ${money(Number(limit) || 0, c.currency)} and re-runs the check. If it still fails nothing changes.`,
  }[mode]
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Credit decision: ${o.id}`} description={approval.reason} consequence={consequence}
      confirmLabel={mode === "release" ? "Release order" : mode === "reject" ? "Reject order" : "Raise limit"} destructive={mode === "reject"}
      confirmDisabled={!!approval.decided}
      onConfirm={() => report(actions.decide(approval.id, mode, mode === "raise" ? Number(limit) : undefined), mode === "release" ? `${o.id} released` : mode === "reject" ? `${o.id} rejected` : "Limit raised; credit check passed")}
      secondary={<span className="mr-auto text-xs text-muted-foreground">Acting as {role}</span>}>
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{c.name}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Exposure / limit</dt><dd className="tabular">{money(c.exposure, c.currency)} / {money(c.creditLimit, c.currency)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Order value</dt><dd className="tabular">{money(approval.amount, approval.currency)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Past due over 30 days</dt><dd>{c.pastDue30 ? "Yes" : "No"}{c.creditHold ? " · credit hold flag" : ""}</dd></div>
      </dl>
      {last && <p className="text-sm">Last check {last.at} ({last.when}): limit {last.passLimit ? "passed" : "failed"}, past due {last.passPastDue ? "passed" : "failed"}.</p>}
      {approval.decided ? <p className="text-sm">Decided: {approval.decided.text}.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          <PickField label="Decision" value={mode} onChange={(v) => setMode(v as typeof mode)} options={[{ value: "release", label: "Release (Finance (credit))" }, { value: "reject", label: "Reject (Finance (credit))" }, { value: "raise", label: "Raise limit (Controller)" }]} />
          {mode === "raise" && <TextField id="cr-limit" label="New limit" type="number" value={limit} onChange={setLimit} />}
        </div>
      )}
    </DialogShell>
  )
}

export function DePegRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useSlice("sales")
  const pegged = db.orders.flatMap((o) => o.lines.flatMap((l) => l.schedules.filter((s) => s.peg && !["Delivered", "Closed", "Cancelled", "Delivery Due"].includes(s.status)).map((s) => ({ key: `${o.id}|${l.no}|${s.no}`, o, l, s }))))
  const targets = db.orders.flatMap((o) => o.lines.flatMap((l) => l.schedules.filter((s) => ["Open", "Confirmed", "Allocated/Pegged"].includes(s.status)).map((s) => ({ key: `${o.id}|${l.no}|${s.no}`, o, l, s }))))
  const [from, setFrom] = useState(pegged[0]?.key ?? "")
  const [to, setTo] = useState("")
  const f = pegged.find((p) => p.key === from)
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title="Request a de-peg" description="Releases the stock pegged to one schedule line so another can take it. The Sales Director decides." consequence={f ? `Sends the request for ${f.s.peg} to the Sales Director. Nothing moves until it is approved; the donor line then waits for the next supply.` : "Choose the pegged line."} requireReason reasonLabel="Reason (required)" confirmLabel="Send request"
      onConfirm={(reason) => { const [a, al, as] = from.split("|"); const [b, bl, bs] = to.split("|"); return report(requestDePeg({ soId: a, line: Number(al), sched: Number(as), toSo: b ?? "", toLine: Number(bl), toSched: Number(bs), reason }), (id) => `${id} sent to the Sales Director`) }}>
      <PickField label="Release the stock pegged to" value={from} onChange={setFrom} options={pegged.map((p) => ({ value: p.key, label: `${p.o.id} line ${p.l.no}/${p.s.no} · ${p.s.peg}` }))} />
      <PickField label="Give it to" value={to} onChange={setTo} options={targets.filter((t) => t.key !== from).map((t) => ({ value: t.key, label: `${t.o.id} line ${t.l.no}/${t.s.no} · ${t.l.item} · ${db.customers.find((c) => c.id === t.o.customerId)?.name} (priority ${db.customers.find((c) => c.id === t.o.customerId)?.priority})` }))} />
    </DialogShell>
  )
}

export function DePegDecisionDialog({ dp, open, onOpenChange }: { dp: DePeg; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [outcome, setOutcome] = useState<"Approved" | "Rejected">("Approved")
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`De-peg ${dp.id}`} description={`${dp.soId} line ${dp.line}/${dp.sched} gives up ${dp.stock} to ${dp.toSo} line ${dp.toLine}/${dp.toSched}.`} requireReason reasonLabel={outcome === "Rejected" ? "Reason for rejecting (required)" : "Reason (required)"} confirmDisabled={dp.state !== "Waiting for Sales Director"}
      consequence={outcome === "Approved" ? `Moves the peg: ${dp.soId} line ${dp.line}/${dp.sched} goes back to waiting for supply; ${dp.toSo} takes the stock. Both orders log the decision.` : `Keeps the peg where it is; both orders log the rejection.`}
      confirmLabel={outcome === "Approved" ? "Approve de-peg" : "Reject de-peg"} destructive={outcome === "Rejected"}
      onConfirm={(reason) => report(decideDePeg(dp.id, outcome, reason), `${dp.id} ${outcome.toLowerCase()}`)}>
      <p className="text-sm">Requested by {dp.requestedBy} on {listDate(dp.at)}: {dp.reason}</p>
      <PickField label="Decision" value={outcome} onChange={(v) => setOutcome(v as typeof outcome)} options={["Approved", "Rejected"]} disabled={dp.state !== "Waiting for Sales Director"} />
    </DialogShell>
  )
}

export function CreditDepegPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const [role] = [useStore().role]
  const open = db.approvals.filter((a) => a.kind === "Credit Release")
  const [apprId, setApprId] = useState(open.find((a) => !a.decided)?.id ?? open[0]?.id ?? "")
  const appr = open.find((a) => a.id === apprId)
  const [dpId, setDpId] = useState(db.fx.depegs.find((d) => d.state === "Waiting for Sales Director")?.id ?? db.fx.depegs[0]?.id ?? "")
  const dp = db.fx.depegs.find((d) => d.id === dpId)
  const [reqOpen, setReqOpen] = useState(false)
  return (
    <DialogPage
      screenId="FX-OM-CREDIT"
      title="Credit release and de-peg decisions"
      description="Credit holds wait for Finance (credit) or the Controller; a de-peg waits for the Sales Director. Decide here or from the order."
      st={st}
      context={<p className="text-sm text-muted-foreground">Acting as {role}. Release and reject are Finance (credit); raising the limit is the Controller (R-2); a de-peg is decided by the Sales Director.</p>}
      cards={[
        ...(appr ? [{ id: "credit", title: "Credit release decision", open: "Open decision", body: <div className="flex flex-col gap-2"><PickField label="Credit hold item" value={apprId} onChange={setApprId} options={open.map((a) => ({ value: a.id, label: `${a.id} · ${a.soId}${a.decided ? " · decided" : ""}` }))} /><span>{appr.reason}{appr.decided ? ` Decided: ${appr.decided.text}.` : ""}</span></div>, render: (o: boolean, c: (o: boolean) => void) => <CreditDecisionDialog approval={appr} open={o} onOpenChange={c} /> }] : []),
        { id: "depeg-req", title: "Request a de-peg", open: "Open request", body: "Release stock pegged to one schedule line for a higher-priority one. Needs a reason; goes to the Sales Director.", render: (o: boolean, c: (o: boolean) => void) => <DePegRequestDialog open={o} onOpenChange={c} /> },
        ...(dp ? [{ id: "depeg-decide", title: "De-peg decision (Sales Director)", open: "Open decision", body: <div className="flex flex-col gap-2"><PickField label="De-peg request" value={dpId} onChange={setDpId} options={db.fx.depegs.map((d) => ({ value: d.id, label: `${d.id} · ${d.state}` }))} /><span>{dp.soId} → {dp.toSo}: {dp.state}.</span></div>, render: (o: boolean, c: (o: boolean) => void) => <DePegDecisionDialog dp={dp} open={o} onOpenChange={c} /> }] : []),
      ]}
      extra={
        <Section title="De-peg requests" className="mt-4">
          <Table>
            <TableHeader className="bg-table-head"><TableRow><TableHead>Request</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Stock</TableHead><TableHead>State</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader>
            <TableBody>
              {db.fx.depegs.map((d) => <TableRow key={d.id}><TableCell>{d.id}</TableCell><TableCell><Link className="text-link underline" to={`/sales/orders/${d.soId}`}>{d.soId}</Link> {d.line}/{d.sched}</TableCell><TableCell><Link className="text-link underline" to={`/sales/orders/${d.toSo}`}>{d.toSo}</Link> {d.toLine}/{d.toSched}</TableCell><TableCell>{d.stock}</TableCell><TableCell>{d.state}</TableCell><TableCell>{d.decidedBy ? `${d.decidedBy} ${d.decidedAt}${d.decisionReason ? `: ${d.decisionReason}` : ""}` : "Waiting"}</TableCell></TableRow>)}
              {db.fx.depegs.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No de-peg requests.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <div><Button variant="outline" onClick={() => setReqOpen(true)} disabled={!st.writable}>New request</Button><Chip kind="oq" id="OQ-33" note="Release and reject are Finance (credit); raising the limit is Controller only." /></div>
          <DePegRequestDialog open={reqOpen} onOpenChange={setReqOpen} />
        </Section>
      }
      rules={[
        ["R-2", "Raising a credit limit is a Controller action; release and reject are Finance (credit) (Reading OQ-33).", "DOC:p.49 §2.2"],
        ["CR-1", "A failed check at submit puts the order in Credit Hold; the decision is logged on the order with name and date.", "DOC:p.49 §2.2"],
        ["DP-1", "A de-peg needs a reason and the Sales Director's decision; the released line returns to waiting for supply.", "DOC:p.220 Book II §14.4"],
      ]}
    />
  )
}
