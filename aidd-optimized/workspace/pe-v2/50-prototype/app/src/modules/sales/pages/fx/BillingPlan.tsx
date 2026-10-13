// FX-OM-BILLPLAN Billing plan and milestone editor (/sales/billing-plan) [DOC:p.53 Book I B §4.4].
// The default ETO template is 20/10/20/30/15/5%; it is editable per order and must total exactly 100%.
// A milestone whose trigger fires creates an Invoice Request in the Finance queue, never an auto-posted invoice.
import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, RulesPanel } from "@/components/patterns"
import { PageHeader } from "@/components/templates"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { money, orderValue, type SalesOrder } from "../../data/model"
import { raiseMilestone, saveBillingPlan } from "../../fx/actions"
import { billingPlanOf, planTotal } from "../../fx/derive"
import { BILLING_KINDS, type BillingKind, type Milestone } from "../../fx/model"
import { ActivityList, Section } from "../../components/ext"
import { Inline, PickField, StateBar, StateGate, TextField, useFxState, type FxState } from "./kit"

export function BillingPlanEditor({ order, st }: { order: SalesOrder; st: FxState }) {
  const db = useSlice("sales")
  const plan = billingPlanOf(db, order)
  return <PlanForm key={`${order.id}-${plan.version}-${plan.milestones.map((m) => m.state).join("")}`} order={order} st={st} />
}

function PlanForm({ order, st }: { order: SalesOrder; st: FxState }) {
  const db = useSlice("sales")
  const plan = billingPlanOf(db, order)
  const [kind, setKind] = useState<BillingKind>(plan.kind)
  const [ms, setMs] = useState<Milestone[]>(() => structuredClone(plan.milestones))
  const [reason, setReason] = useState("")
  const [err, setErr] = useState<{ text: string; field?: string } | null>(st.validation ? { text: "The plan totals 80%; it must total exactly 100% before it can be saved (add 20%).", field: "total" } : null)
  const total = planTotal({ milestones: ms })
  const closed = ["Cancelled", "Rejected", "Invoiced/Closed"].includes(order.status)
  const locked = closed || !st.writable
  const value = orderValue(order)
  const dirty = JSON.stringify(ms) !== JSON.stringify(plan.milestones) || kind !== plan.kind
  const set = (i: number, patch: Partial<Milestone>) => setMs((x) => x.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const add = () => setMs((x) => [...x, { id: `M${Date.now() % 100000}`, label: "", pct: 0, trigger: "", evidence: "", state: "Planned" }])
  const save = () => {
    const r = saveBillingPlan(order.id, kind, ms, reason)
    if (r.ok) {
      toast.success(`Billing plan v${plan.version + 1} saved for ${order.id}`)
      setReason("")
      setErr(null)
    } else setErr({ text: r.error, field: r.field })
  }
  const raise = (id: string) => {
    const r = raiseMilestone(order.id, id)
    if (r.ok) toast.success("Invoice request created in the Finance queue")
    else setErr({ text: r.error })
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <PickField label="Billing plan" value={kind} onChange={(v) => setKind(v as BillingKind)} options={BILLING_KINDS} disabled={locked} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Plan total</span>
          <span className={`tabular text-2xl font-semibold ${total === 100 ? "" : "text-destructive"}`} aria-live="polite">{total}%</span>
          <Progress value={Math.min(total, 100)} aria-label="Plan total against 100%" />
          <span className="text-xs text-muted-foreground">{total === 100 ? "Totals 100%: the plan can be saved." : total > 100 ? `Over by ${Math.round((total - 100) * 1000) / 1000}%: remove that much.` : `Short by ${Math.round((100 - total) * 1000) / 1000}%: add that much.`}</span>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Order {order.id}</span>
          <span><StatusBadge kind="salesOrder" status={order.status} /> {money(value, order.currency)}</span>
          <span className="text-muted-foreground">Plan version {plan.version}</span>
        </div>
      </div>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow><TableHead>Milestone</TableHead><TableHead className="w-24 text-right">%</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Trigger</TableHead><TableHead>Evidence</TableHead><TableHead>State</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {ms.map((m, i) => {
            const fixed = m.state !== "Planned"
            const firstPlanned = ms.findIndex((x) => x.state === "Planned") === i
            return (
              <TableRow key={m.id}>
                <TableCell><Input aria-label={`Milestone ${i + 1} name`} value={m.label} onChange={(e) => set(i, { label: e.target.value })} disabled={locked || fixed} aria-invalid={!m.label.trim()} /></TableCell>
                <TableCell><Input aria-label={`${m.label || `Milestone ${i + 1}`} percentage`} type="number" className="text-right" value={m.pct} onChange={(e) => set(i, { pct: Number(e.target.value) })} disabled={locked || fixed} /></TableCell>
                <TableCell className="tabular text-right">{money(Math.round(value * m.pct) / 100, order.currency)}</TableCell>
                <TableCell><Input aria-label={`${m.label || `Milestone ${i + 1}`} trigger`} value={m.trigger} onChange={(e) => set(i, { trigger: e.target.value })} disabled={locked || fixed} /></TableCell>
                <TableCell><Input aria-label={`${m.label || `Milestone ${i + 1}`} evidence`} value={m.evidence} onChange={(e) => set(i, { evidence: e.target.value })} disabled={locked || fixed} /></TableCell>
                <TableCell>{m.state}{m.irId ? <span className="block text-xs text-muted-foreground">{m.irId} · {m.raisedOn}</span> : null}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {m.state === "Planned" ? (
                    <>
                      <Button size="sm" variant="outline" disabled={locked || dirty || !firstPlanned} title={dirty ? "Save the plan before a trigger fires" : !firstPlanned ? "Milestones fire in order" : undefined} onClick={() => raise(m.id)}>Trigger fired</Button>
                      <Button size="icon" variant="ghost" aria-label={`Remove ${m.label || `milestone ${i + 1}`}`} disabled={locked} onClick={() => setMs((x) => x.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></Button>
                    </>
                  ) : <span className="text-xs text-muted-foreground">Locked</span>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={add} disabled={locked || kind !== "Milestone"}><Plus aria-hidden="true" /> Add milestone</Button>
        <Button variant="ghost" disabled={locked} onClick={() => { setKind(plan.kind); setMs(structuredClone(plan.milestones)); setErr(null) }}>Revert</Button>
        {kind !== "Milestone" && <span className="text-sm text-muted-foreground">A {kind.toLowerCase()} plan is a single invoice request at 100%.</span>}
      </div>
      <TextField id="bp-reason" label="Reason for the change (kept in the plan history)" value={reason} onChange={setReason} disabled={locked} error={err?.field === "reason" ? err.text : null} />
      <Inline error={err && err.field !== "reason" ? err : null} onDismiss={() => setErr(null)} />
      <div className="flex gap-2">
        <Button onClick={save} disabled={locked || !dirty} title={st.why || (!dirty ? "No changes to save" : undefined)}>Save plan</Button>
        {closed && <span className="text-sm text-muted-foreground">{order.id} is {order.status}: the plan is read-only.</span>}
      </div>
      <Section title="Plan history"><ActivityList items={plan.history} /></Section>
    </div>
  )
}

export function BillingPlanPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const [sp, setSp] = useSearchParams()
  const eto = db.orders.filter((o) => o.type === "ETO" || sp.get("so") === o.id)
  const all = db.orders
  const soId = sp.get("so") ?? eto.find((o) => o.status !== "Invoiced/Closed")?.id ?? all[0]?.id
  const order = all.find((o) => o.id === soId)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Billing plan and milestone editor"
        screenId="FX-OM-BILLPLAN"
        description="The plan decides when invoice requests reach Finance. Milestones must total exactly 100%; a milestone that already raised an invoice request keeps its percentage."
        chips={<Chip kind="oq" id="OQ-14" note="No stage table is stated for the 16-stage Flow A; milestone triggers follow the default template on p.53." />}
        actions={order ? <Button variant="outline" asChild><Link to={`/sales/orders/${order.id}`}>Open {order.id}</Link></Button> : undefined}
      />
      <StateBar st={st} />
      <div className="max-w-md">
        <PickField label="Sales order" value={soId ?? ""} onChange={(v) => setSp((p) => { const n = new URLSearchParams(p); n.set("so", v); return n }, { replace: true })} options={all.map((o) => ({ value: o.id, label: `${o.id} · ${o.type} · ${o.status}` }))} />
      </div>
      <StateGate st={st} empty={{ title: "No billing plan", body: "Pick an order. Every order has a plan: ETO orders default to the six-milestone template." }}>
        {order ? <BillingPlanEditor order={order} st={st} /> : null}
      </StateGate>
      <RulesPanel rules={[
        ["BP-1", "ETO default template: Order Acceptance 20%, Design Approval 10%, Major Materials Procured 20%, Production Complete / Tested 30%, Shipment 15%, Delivery / Commissioning Support 5%. Editable per order.", "DOC:p.53 §4.4"],
        ["BP-2", "The plan must total exactly 100%; Save is refused with the shortfall or the excess.", "DOC:p.53 §4.4"],
        ["BP-3", "A trigger creates an Invoice Request for Finance review; no invoice is posted from the order.", "DOC:p.53 §4.4"],
        ["BP-4", "A milestone with an invoice request is locked at its percentage and cannot be removed; every change keeps its reason in the plan history.", "Design value"],
        ["BP-5", "Billing plan edits are a Finance (Controller / AR) right; other roles read the plan.", "DOC:p.56 §6 Role Rights"],
      ]} />
    </div>
  )
}
