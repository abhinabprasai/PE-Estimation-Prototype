// FX-RMA-CREDITMEMO Credit memo request panel and Controller credit release (/sales/dialogs/credit-memo)
// [DOC:p.23 Book I A §3.2; §3.6.1; §3.9]. A credit memo request follows the disposition. If the customer is on
// credit hold the request is blocked (E-RMA-07) and only the Controller can release it, with a reason; the credit
// note itself is created by ACC.
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell } from "@/components/templates"
import { Chip, PostingPreview } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { listDate, money } from "../../data/model"
import { decideCreditMemo, requestCreditMemo, rmaCreditBasis } from "../../fx/actions"
import { Section } from "../../components/ext"
import { DialogPage, Inline, PickField, report, useFxState, type FxState } from "./kit"

export function CreditMemoPanel({ rmaId, st }: { rmaId: string; st: FxState }) {
  const db = useSlice("sales")
  const b = rmaCreditBasis(db, rmaId)
  const memos = db.fx.creditMemos.filter((c) => c.rmaId === rmaId)
  const [err, setErr] = useState<{ text: string } | null>(null)
  const [dlg, setDlg] = useState<{ id: string; mode: "release" | "reject" } | null>(null)
  if (!b) return <p className="text-sm text-muted-foreground">RMA not found.</p>
  const live = memos.find((m) => m.state !== "Rejected")
  const req = (force?: boolean) => { const r = requestCreditMemo(rmaId, force); if (r.ok) { toast.success(r.value.blocked ? `${r.value.id} blocked: customer on credit hold (E-RMA-07)` : `${r.value.id} requested`); setErr(null) } else setErr({ text: r.error }) }
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <div><dt className="text-xs text-muted-foreground">Return value</dt><dd className="tabular">{money(b.gross)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Restocking fee ({b.r.restockPct}%)</dt><dd className="tabular">{money(b.restocking)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Credit to request</dt><dd className="tabular font-semibold">{money(b.net)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{b.cust?.name}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Credit hold</dt><dd>{b.onHold ? "On hold: E-RMA-07 applies" : "No hold"}</dd></div>
      </dl>
      <PostingPreview lines={[{ template: 19, amount: b.net, detail: `Credit memo request → ACC credit note. Return value ${money(b.gross)} less ${b.r.restockPct}% restocking fee ${money(b.restocking)} to 4910` }]} title="Posting on credit note (ACC)" />
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Request</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>State</TableHead><TableHead>Requested</TableHead><TableHead>Controller release</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {memos.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.id}</TableCell><TableCell className="tabular text-right">{money(m.amount)}</TableCell><TableCell>{m.state}</TableCell><TableCell>{listDate(m.requestedAt)} · {m.requestedBy}</TableCell>
              <TableCell className="text-sm">{m.releasedBy ? `${m.releasedBy} ${m.releasedAt}${m.reason ? `: ${m.reason}` : ""}` : m.state.startsWith("Blocked") ? m.note : "Not needed"}</TableCell>
              <TableCell className="whitespace-nowrap">
                {m.state.startsWith("Blocked") && <><Button size="sm" onClick={() => setDlg({ id: m.id, mode: "release" })} disabled={!st.writable}>Release (Controller)</Button> <Button size="sm" variant="outline" onClick={() => setDlg({ id: m.id, mode: "reject" })} disabled={!st.writable}>Reject</Button></>}
                {(m.state === "Requested" || m.state === "Released by Controller") && <Button size="sm" variant="outline" disabled={!st.writable} onClick={() => { const r = decideCreditMemo(m.id, "post", ""); if (r.ok) toast.success(`${m.id} posted to ACC`); else setErr({ text: r.error }) }}>Post credit note (Finance)</Button>}
              </TableCell>
            </TableRow>
          ))}
          {memos.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No credit memo request yet for {rmaId}.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <Inline error={err} onDismiss={() => setErr(null)} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => req()} disabled={!st.writable || !!live} title={live ? `${live.id} already exists` : st.why || undefined}>Request credit memo</Button>
        <Button variant="outline" onClick={() => req(true)} disabled={!st.writable || !!live}>Simulate customer on credit hold</Button>
      </div>
      {dlg && <DialogShell open onOpenChange={(o) => !o && setDlg(null)} title={`${dlg.mode === "release" ? "Release" : "Reject"} ${dlg.id}`} description="The customer is on credit hold (E-RMA-07). Only the Controller decides." consequence={dlg.mode === "release" ? "Releases the credit despite the hold: the settlement step can complete and ACC creates the credit note. The release is logged with your reason." : "Rejects the credit request; no credit note is created and the RMA stays in Settling."} requireReason reasonLabel="Reason (required)" confirmLabel={dlg.mode === "release" ? "Release credit" : "Reject request"} destructive={dlg.mode === "reject"} onConfirm={(r) => report(decideCreditMemo(dlg.id, dlg.mode, r), dlg.mode === "release" ? "Credit released by the Controller" : "Request rejected")} />}
    </div>
  )
}

export function CreditMemoPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const cand = db.rmas.filter((r) => r.cls !== "RC4" && !["Draft", "Rejected", "Cancelled"].includes(r.status))
  const [id, setId] = useState(db.fx.creditMemos.find((c) => c.state.startsWith("Blocked"))?.rmaId ?? cand[0]?.id ?? "")
  const r = db.rmas.find((x) => x.id === id)
  return (
    <DialogPage
      screenId="FX-RMA-CREDITMEMO"
      title="Credit memo request and Controller release"
      description="A credit follows the disposition. A customer on credit hold blocks it until the Controller releases it."
      chips={<Chip kind="oq" id="OQ-33" note="Release of a credit is a Controller action; the credit note itself is created in ACC (ASM-EXT-1)." />}
      st={st}
      context={<div className="max-w-xl"><PickField label="RMA" value={id} onChange={setId} options={cand.map((x) => ({ value: x.id, label: `${x.id} · ${x.status} · ${db.customers.find((c) => c.id === x.customerId)?.name}` }))} />{r && <p className="mt-1 flex items-center gap-2 text-sm"><StatusBadge kind="rma" status={r.status} /><Link className="text-link underline" to={`/sales/rma/${r.id}`}>Open RMA</Link></p>}</div>}
      cards={[]}
      extra={id ? <Section title={`Credit memo panel for ${id}`}><CreditMemoPanel key={id} rmaId={id} st={st} /></Section> : null}
      rules={[
        ["E-RMA-07", "A customer on credit hold blocks the credit memo request; credit requires Controller release.", "DOC:p.23 §3.2; p.27 §3.9"],
        ["RMA-CM-1", "Credit = return value less the restocking fee (to 4910); the credit note is created by ACC.", "DOC:p.23 §3.2"],
        ["RMA-CM-2", "Segregation of duties: the warranty adjudicator is not the credit approver (FL-05).", "FL-05"],
      ]}
    />
  )
}
