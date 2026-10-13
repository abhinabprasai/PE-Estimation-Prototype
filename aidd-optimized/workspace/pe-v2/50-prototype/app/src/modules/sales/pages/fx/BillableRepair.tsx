// FX-RMA-BILLABLE Billable repair quote and customer approval gate (/sales/dialogs/billable-repair)
// [DOC:p.24 Book I A §3.6.1]. An RC4 return or a line dispositioned Repair, Billable gets a service quote first:
// no work order starts until the customer approves it. A decline returns the unit as-is at customer cost.
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell } from "@/components/templates"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { listDate, money } from "../../data/model"
import { createRepairQuote, repairQuoteStep } from "../../fx/actions"
import type { RepairQuote } from "../../fx/model"
import { Reading, Section } from "../../components/ext"
import { DialogPage, Inline, PickField, TextField, report, useFxState, type FxState } from "./kit"

const total = (q: Pick<RepairQuote, "lines">) => q.lines.reduce((s, l) => s + l.qty * l.price, 0)

export function RepairQuotePanel({ rmaId, st }: { rmaId: string; st: FxState }) {
  const db = useSlice("sales")
  const quotes = db.fx.repairQuotes.filter((q) => q.rmaId === rmaId)
  const [lines, setLines] = useState<{ label: string; qty: number; price: number }[]>([{ label: "", qty: 1, price: 0 }])
  const [err, setErr] = useState<{ text: string; field?: string } | null>(null)
  const [dec, setDec] = useState<{ id: string; mode: "approve" | "decline" } | null>(null)
  const [by, setBy] = useState("")
  const [ref, setRef] = useState("")
  const r = db.rmas.find((x) => x.id === rmaId)
  const eligible = !!r && (r.cls === "RC4" || r.lines.some((l) => l.disposition === "Repair — Billable"))
  const open = quotes.some((q) => ["Draft", "Sent to customer", "Approved"].includes(q.state))
  const set = (i: number, p: Partial<(typeof lines)[number]>) => setLines((x) => x.map((l, j) => (j === i ? { ...l, ...p } : l)))
  return (
    <div className="flex flex-col gap-3">
      {!eligible && <p className="text-sm text-muted-foreground">A billable repair quote applies to an RC4 return or a line dispositioned Repair, Billable. {rmaId} is {r?.cls}.</p>}
      {quotes.map((q) => (
        <div key={q.id} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm"><strong>{q.id}</strong> <span className="rounded border px-2">{q.state}</span> <span className="tabular">{money(total(q))}</span>{q.sentOn && <span className="text-muted-foreground">sent {listDate(q.sentOn)}, valid to {listDate(q.validUntil)}</span>}</div>
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>{q.lines.map((l, i) => <TableRow key={i}><TableCell>{l.label}</TableCell><TableCell className="tabular text-right">{l.qty}</TableCell><TableCell className="tabular text-right">{money(l.price)}</TableCell><TableCell className="tabular text-right">{money(l.qty * l.price)}</TableCell></TableRow>)}</TableBody></Table>
          {q.decidedOn && <p className="text-sm">{q.state} on {listDate(q.decidedOn)} by {q.decidedBy}{q.approvalRef ? `, ref ${q.approvalRef}` : ""}{q.reason ? `: ${q.reason}` : ""}.</p>}
          <div className="flex flex-wrap gap-2">
            {q.state === "Draft" && <Button onClick={() => { const x = repairQuoteStep(q.id, "send"); if (x.ok) toast.success(`${q.id} sent to the customer`); else setErr({ text: x.error }) }} disabled={!st.writable}>Send to customer</Button>}
            {q.state === "Sent to customer" && <><Button onClick={() => setDec({ id: q.id, mode: "approve" })} disabled={!st.writable}>Record customer approval</Button><Button variant="outline" onClick={() => setDec({ id: q.id, mode: "decline" })} disabled={!st.writable}>Record decline</Button></>}
            {q.state === "Approved" && <p className="text-sm">Gate open: the rework order may start. <PostingPreviewNote /></p>}
            {q.state === "Declined" && <p className="text-sm">Gate closed: no work starts; the unit returns as-is at customer cost.</p>}
          </div>
        </div>
      ))}
      <Inline error={err} onDismiss={() => setErr(null)} />
      {eligible && !open && (
        <Section title="New repair quote">
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Description</TableHead><TableHead className="w-24 text-right">Qty</TableHead><TableHead className="w-36 text-right">Price</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{lines.map((l, i) => (
              <TableRow key={i}><TableCell><Input aria-label={`Quote line ${i + 1} description`} value={l.label} onChange={(e) => set(i, { label: e.target.value })} aria-invalid={err?.field === "lines" && !l.label.trim()} /></TableCell><TableCell><Input aria-label={`Quote line ${i + 1} quantity`} type="number" className="text-right" value={l.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} /></TableCell><TableCell><Input aria-label={`Quote line ${i + 1} price`} type="number" className="text-right" value={l.price} onChange={(e) => set(i, { price: Number(e.target.value) })} /></TableCell><TableCell><Button size="icon" variant="ghost" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></Button></TableCell></TableRow>
            ))}</TableBody></Table>
          <div className="flex items-center gap-2"><Button variant="outline" onClick={() => setLines((x) => [...x, { label: "", qty: 1, price: 0 }])}><Plus aria-hidden="true" /> Add line</Button><span className="tabular text-sm">Total {money(total({ lines }))}</span><Button className="ml-auto" disabled={!st.writable} onClick={() => { const x = createRepairQuote(rmaId, lines); if (x.ok) { toast.success(`${x.value} drafted`); setLines([{ label: "", qty: 1, price: 0 }]); setErr(null) } else setErr({ text: x.error, field: x.field }) }}>Draft quote</Button></div>
        </Section>
      )}
      {dec && (
        <DialogShell open onOpenChange={(o) => !o && setDec(null)} title={`${dec.mode === "approve" ? "Customer approval" : "Customer decline"}: ${dec.id}`} description="Recorded from the customer's purchase order, signed quote or email." consequence={dec.mode === "approve" ? "Opens the gate: the rework order with settlement receiver COGS-Service can start; #22 posts cost and the service invoice at its close." : "Closes the gate: no work starts and the unit goes back as-is at customer cost."} requireReason={dec.mode === "decline"} reasonLabel="Why did the customer decline? (required)" confirmLabel={dec.mode === "approve" ? "Record approval" : "Record decline"} destructive={dec.mode === "decline"}
          onConfirm={(reason) => report(repairQuoteStep(dec.id, dec.mode, { by, reason: dec.mode === "approve" ? ref : reason }), dec.mode === "approve" ? "Approval recorded; work may start" : "Decline recorded")}>
          <TextField id="rq-by" label="Who at the customer decided" value={by} onChange={setBy} />
          {dec.mode === "approve" && <TextField id="rq-ref" label="Reference (customer PO or signed quote)" value={ref} onChange={setRef} />}
        </DialogShell>
      )}
    </div>
  )
}
const PostingPreviewNote = () => <span className="text-muted-foreground">#22 posts at rework close.</span>

export function BillableRepairPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const cand = db.rmas.filter((r) => r.cls === "RC4" || r.lines.some((l) => l.disposition === "Repair — Billable"))
  const [id, setId] = useState(cand[0]?.id ?? "")
  const r = db.rmas.find((x) => x.id === id)
  return (
    <DialogPage
      screenId="FX-RMA-BILLABLE"
      title="Billable repair quote and approval gate"
      description="The customer approves the repair quote before any work starts."
      chips={<Reading id="SR-37" note="The PRD gives no validity period for a repair quote; 30 days is a design value." />}
      st={st}
      context={<div className="max-w-xl"><PickField label="RMA" value={id} onChange={setId} options={cand.map((x) => ({ value: x.id, label: `${x.id} · ${x.cls} · ${x.status}` }))} />{r && <p className="mt-1 flex items-center gap-2 text-sm"><StatusBadge kind="rma" status={r.status} /><Link className="text-link underline" to={`/sales/rma/${r.id}`}>Open RMA</Link></p>}</div>}
      cards={[]}
      extra={id ? <Section title={`Repair quote for ${id}`}><RepairQuotePanel key={id} rmaId={id} st={st} /></Section> : null}
      rules={[
        ["BR-1", "RC4 and Repair, Billable dispositions need a service quote; work starts only after the customer approves it.", "DOC:p.24 §3.6.1"],
        ["BR-2", "The rework order settles to COGS-Service and #22 posts cost and the service invoice at its close.", "DOC:p.24 §3.6.1; #22"],
        ["BR-3", "A declined quote returns the unit as-is at customer cost (Return to Customer As-Is).", "DOC:p.24 §3.6.1"],
      ]}
    />
  )
}
