// FX-OM-CHANGE Sales change order, cancellation and reprice dialogs (/sales/dialogs/change-cancel-reprice)
// [DOC:p.53 Book I B §4.5]. After confirmation an order changes only through a Sales Change Order: a diff with a
// reason, a re-credit check when the value goes up, and a confirmation PDF per version. Cancellation carries a
// contract fee and hands a started work order to the Production Manager. Reprice shows the diff first.
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { listDate, money, orderValue, type SalesOrder } from "../../data/model"
import { applyChangeOrder, applyReprice, cancelOrder, cancelPreview, changePreview, decideWoDisposition, repricePreview } from "../../fx/actions"
import { CHANGE_FIELDS, WO_DISPOSITIONS, cancelFeeDefault, type ChangeField } from "../../fx/model"
import { Reading, Section } from "../../components/ext"
import { DialogPage, PickField, TextField, report, useFxState } from "./kit"

export function ChangeOrderDialog({ so, open, onOpenChange }: { so: SalesOrder; open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useSlice("sales")
  const [line, setLine] = useState(String(so.lines[0]?.no ?? 10))
  const [field, setField] = useState<ChangeField>("Quantity")
  const [value, setValue] = useState("")
  const p = useMemo(() => changePreview(db, { soId: so.id, line: Number(line), field, newValue: value, reason: "" }), [db, so.id, line, field, value])
  const after = p && value ? p.after : null
  const up = !!p && after != null && after > p.before
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Sales Change Order on ${so.id}`} description="One change per order. The diff shows what moves; the reason is mandatory."
      consequence={<>Creates change order v{db.fx.changes.filter((c) => c.soId === so.id).length + 2} on {so.id} and issues a new confirmation PDF. {up ? "The order value goes up, so the credit check re-runs and a failure sets Credit Hold." : "The order value does not go up, so no credit check runs."}{field === "ETO configuration" ? " An ETO configuration change after Design Release needs an ECR with a cost and schedule impact first." : ""}</>}
      requireReason reasonLabel="Reason for the change (required)" confirmLabel="Apply change order"
      onConfirm={(reason) => report(applyChangeOrder({ soId: so.id, line: Number(line), field, newValue: value, reason }), (r) => `${r.id} applied${r.creditResult === "failed" ? "; credit check failed: order is in Credit Hold" : ""}`)}>
      <div className="grid gap-3 md:grid-cols-3">
        <PickField label="Line" value={line} onChange={setLine} options={so.lines.map((l) => ({ value: String(l.no), label: `${l.no} · ${l.item} · ${l.status}` }))} />
        <PickField label="Field" value={field} onChange={(v) => { setField(v as ChangeField); setValue("") }} options={CHANGE_FIELDS} />
        <TextField id="sco-new" label={field === "Requested ship date" ? "New date (YYYY-MM-DD)" : field === "ETO configuration" ? "Describe the new configuration" : `New ${field.toLowerCase()}`} value={value} onChange={setValue} type={field === "Quantity" || field === "Unit price" ? "number" : "text"} />
      </div>
      {p && (
        <Table>
          <TableHeader className="bg-table-head"><TableRow><TableHead>Diff</TableHead><TableHead>Old</TableHead><TableHead>New</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>{field}, line {line}</TableCell><TableCell>{p.oldValue}</TableCell><TableCell>{value || "Not entered"}</TableCell></TableRow>
            <TableRow><TableCell>Order value</TableCell><TableCell className="tabular">{money(p.before, so.currency)}</TableCell><TableCell className="tabular">{after != null ? money(after, so.currency) : "Not entered"}</TableCell></TableRow>
            <TableRow><TableCell>Credit re-check</TableCell><TableCell colSpan={2}>{up ? "Runs: value goes up" : "Not needed"}</TableCell></TableRow>
          </TableBody>
        </Table>
      )}
    </DialogShell>
  )
}

export function CancelDialog({ so, open, onOpenChange }: { so: SalesOrder; open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useSlice("sales")
  const [scope, setScope] = useState<"Full order" | "Line">("Full order")
  const [line, setLine] = useState(String(so.lines[0]?.no ?? 10))
  const [fee, setFee] = useState(String(cancelFeeDefault(so.type)))
  const [wo, setWo] = useState<(typeof WO_DISPOSITIONS)[number]>("Finish to stock")
  const pv = cancelPreview(db, { soId: so.id, scope, line: Number(line), feePct: Number(fee) || 0 })
  const live = pv?.wo.filter((w) => w.inProgress) ?? []
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Cancel ${scope === "Line" ? `line ${line} of ` : ""}${so.id}`} description="Shipped lines are immutable: only what is still open can be cancelled."
      consequence={pv ? <>Cancels {money(pv.value, so.currency)} of open value{(Number(fee) || 0) > 0 ? ` and invoices a cancellation fee of ${money(pv.fee, so.currency)} through a service line` : " with no fee"}.{live.length ? ` ${live.map((w) => w.woId).join(", ")} has started: the Production Manager's disposition closes the line.` : ""} Credit exposure falls by the cancelled value.</> : "Choose an order."}
      requireReason reasonLabel="Reason for the cancellation (required)" confirmLabel="Cancel" destructive
      onConfirm={(reason) => report(cancelOrder({ soId: so.id, scope, line: Number(line), feePct: Number(fee), reason, woChoice: live.length ? wo : undefined }), (r) => r.pending ? "Cancellation recorded; waiting for the work order disposition" : "Cancellation complete")}>
      <div className="grid gap-3 md:grid-cols-3">
        <PickField label="Scope" value={scope} onChange={(v) => setScope(v as typeof scope)} options={["Full order", "Line"]} />
        {scope === "Line" && <PickField label="Line" value={line} onChange={setLine} options={so.lines.map((l) => ({ value: String(l.no), label: `${l.no} · ${l.item} · ${l.status}` }))} />}
        <TextField id="cnl-fee" label="Cancellation fee %" type="number" value={fee} onChange={setFee} hint={<>Contract-based; default {cancelFeeDefault(so.type)}% for {so.type} <Reading id="SR-27" note="The PRD says the fee is contract-based and gives no figure." /></>} />
      </div>
      {pv && (
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Lines affected</dt><dd>{pv.lines.length ? pv.lines.map((l) => l.no).join(", ") : "None open"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Open value</dt><dd className="tabular">{money(pv.value, so.currency)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Fee</dt><dd className="tabular">{money(pv.fee, so.currency)}</dd></div>
        </dl>
      )}
      {live.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <p className="text-sm font-medium">{live.map((w) => w.woId).join(", ")} is in progress: choose its disposition</p>
          <RadioGroup value={wo} onValueChange={(v) => setWo(v as typeof wo)} aria-label="Work order disposition">
            {WO_DISPOSITIONS.map((d) => <div key={d} className="flex items-center gap-2"><RadioGroupItem id={`wo-${d}`} value={d} /><Label htmlFor={`wo-${d}`} className="font-normal">{d}</Label></div>)}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">Recorded now; the line closes when the Production Manager confirms it (WO decision dialogs, Production).</p>
        </div>
      )}
    </DialogShell>
  )
}

export function RepriceDialog({ so, open, onOpenChange }: { so: SalesOrder; open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useSlice("sales")
  const p = repricePreview(db, so.id)
  const changed = p?.rows.some((r) => r.next !== r.old)
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Reprice ${so.id}`} description={`Price determination runs again on the open lines. List change effective ${listDate("2026-10-01")}: +${(db.fx.priceUplift * 100).toFixed(1)}% on list items.`}
      consequence={p ? `Replaces frozen prices with re-determined ones on ${p.rows.filter((r) => r.next !== r.old).length} line(s): ${money(p.before, so.currency)} to ${money(p.after, so.currency)}. ${p.after > p.before ? "The value goes up, so the credit check re-runs." : "No credit check is needed."} Shipped lines keep their price.` : "Choose an order."}
      requireReason reasonLabel="Reason for the reprice (required)" confirmLabel="Confirm reprice" confirmDisabled={!changed}
      onConfirm={(reason) => report(applyReprice(so.id, reason), "Reprice confirmed")}>
      {p && (
        <Table>
          <TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Old price</TableHead><TableHead className="text-right">New price</TableHead><TableHead className="text-right">Change</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
          <TableBody>
            {p.rows.map((r) => (
              <TableRow key={r.line}>
                <TableCell className="tabular">{r.line}</TableCell><TableCell>{r.item}</TableCell><TableCell className="tabular text-right">{r.qty}</TableCell>
                <TableCell className="tabular text-right">{money(r.old, so.currency)}</TableCell><TableCell className="tabular text-right">{money(r.next, so.currency)}</TableCell>
                <TableCell className="tabular text-right">{r.next - r.old >= 0 ? "+" : ""}{money(r.next - r.old, so.currency)}</TableCell>
                <TableCell>{r.locked ? "Shipped or closed: keeps its price" : r.eto ? "ETO: priced from the estimate" : r.next !== r.old ? "Price list re-determined" : "Unchanged"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!changed && <p className="text-sm text-muted-foreground">Price determination returns the same prices: nothing to change.</p>}
    </DialogShell>
  )
}

export function ChangeCancelPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const eligible = db.orders.filter((o) => ["Confirmed", "In Fulfillment", "Partially Shipped", "Credit Hold", "Draft", "Submitted"].includes(o.status))
  const [id, setId] = useState(eligible.find((o) => o.id === "SO-2026-00377")?.id ?? eligible[0]?.id ?? "")
  const so = db.orders.find((o) => o.id === id)
  const sco = db.fx.changes.filter((c) => !so || c.soId === so.id)
  const cnl = db.fx.cancels.filter((c) => !so || c.soId === so.id)
  const [pick, setPick] = useState<WoPick | null>(null)
  return (
    <DialogPage
      screenId="FX-OM-CHANGE"
      title="Change order, cancellation and reprice"
      description="After confirmation an order changes only through these three dialogs. Each shows its diff, asks for a reason and says what it does."
      st={st}
      context={
        <div className="max-w-xl">
          <PickField label="Sales order" value={id} onChange={setId} options={eligible.map((o) => ({ value: o.id, label: `${o.id} · ${o.type} · ${o.status} · ${money(orderValue(o), o.currency)}` }))} />
          {so && <p className="mt-1 flex items-center gap-2 text-sm"><StatusBadge kind="salesOrder" status={so.status} /><Link className="text-link underline" to={`/sales/orders/${so.id}`}>Open order</Link></p>}
        </div>
      }
      cards={so ? [
        { id: "change", title: "Sales Change Order", open: "Open change order", body: "Quantity, requested date, unit price or ETO configuration. Value up: credit re-check. ETO configuration after Design Release: ECR first.", render: (o, c) => <ChangeOrderDialog so={so} open={o} onOpenChange={c} /> },
        { id: "cancel", title: "Cancel order or line", open: "Open cancellation", body: "Fee as a percentage (contract-based), reason, and the work order disposition when production has started.", render: (o, c) => <CancelDialog so={so} open={o} onOpenChange={c} /> },
        { id: "reprice", title: "Reprice", open: "Open reprice", body: "Re-run price determination on open lines; the diff comes first and a value increase re-runs credit.", render: (o, c) => <RepriceDialog so={so} open={o} onOpenChange={c} /> },
      ] : []}
      extra={
        <div className="mt-4 flex flex-col gap-4">
          <Section title={`Change orders${so ? ` on ${so.id}` : ""}`}>
            <Table>
              <TableHeader className="bg-table-head"><TableRow><TableHead>Change</TableHead><TableHead>Order</TableHead><TableHead>Version</TableHead><TableHead>Field</TableHead><TableHead>Old → new</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Credit re-check</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
              <TableBody>
                {sco.map((c) => <TableRow key={c.id}><TableCell>{c.id}</TableCell><TableCell>{c.soId}</TableCell><TableCell>v{c.version}</TableCell><TableCell>{c.field} (line {c.line})</TableCell><TableCell>{c.oldValue} → {c.newValue}</TableCell><TableCell className="tabular text-right">{money(c.valueBefore)} → {money(c.valueAfter)}</TableCell><TableCell>{c.creditRechecked ? c.creditResult : "Not needed"}</TableCell><TableCell>{c.reason}</TableCell></TableRow>)}
                {sco.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No change orders yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Section>
          <Section title="Cancellations">
            <Table>
              <TableHeader className="bg-table-head"><TableRow><TableHead>Cancellation</TableHead><TableHead>Order</TableHead><TableHead>Scope</TableHead><TableHead className="text-right">Fee</TableHead><TableHead>Work order</TableHead><TableHead>State</TableHead></TableRow></TableHeader>
              <TableBody>
                {cnl.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.id}</TableCell><TableCell>{c.soId}</TableCell><TableCell>{c.scope}{c.line ? ` ${c.line}` : ""}</TableCell>
                    <TableCell className="tabular text-right">{c.feePct}% = {money(c.feeAmount)}{c.feeLineRef ? ` (${c.feeLineRef})` : ""}</TableCell>
                    <TableCell>{c.woDisposition ? `${c.woDisposition.woId}: ${c.woDisposition.choice ?? "no choice"} · ${c.woDisposition.state}` : "None started"}</TableCell>
                    <TableCell>{c.state} {c.state === "Pending WO disposition" && <Button size="sm" variant="outline" onClick={() => setPick({ id: c.id })} disabled={!st.writable}>Decide disposition</Button>}</TableCell>
                  </TableRow>
                ))}
                {cnl.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No cancellations.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <Chip kind="oq" id="SR-27" note="Production Manager is not a role in the shared list; the Production supervisor, Planning Manager or Production Scheduler decides the disposition." />
          </Section>
          <WoDecision pick={pick} onClose={() => setPick(null)} />
        </div>
      }
      rules={[
        ["CO-1", "After Confirmed, changes go through a Sales Change Order with a reason; Draft orders are edited freely.", "DOC:p.53 §4.5"],
        ["CO-2", "A change that raises the order value re-runs the credit check; a failure sets Credit Hold.", "DOC:p.53 §4.5"],
        ["CO-3", "Each change order issues a new confirmation PDF with its version; shipped lines are immutable.", "DOC:p.53 §4.5"],
        ["CO-4", "An ETO technical configuration is locked after Design Release; changing it needs an ECR with cost and schedule impact.", "DOC:p.53 §4.5; Part C §4"],
        ["CN-1", "Cancellation carries a contract fee invoiced through a service line; a started work order waits for the Production Manager's disposition.", "DOC:p.53 §4.5"],
      ]}
    />
  )
}

interface WoPick { id: string }
function WoDecision({ pick, onClose }: { pick: WoPick | null; onClose: () => void }) {
  const [choice, setChoice] = useState<(typeof WO_DISPOSITIONS)[number]>("Finish to stock")
  return (
    <DialogShell open={!!pick} onOpenChange={(o) => !o && onClose()} title={`Work order disposition for ${pick?.id ?? ""}`} description="The Production Manager's call on a work order whose sales line is cancelled." consequence="Closes the cancelled lines once the disposition is recorded." confirmLabel="Record disposition" onConfirm={() => { if (!pick) return null; return report(decideWoDisposition(pick.id, choice), "Disposition recorded; cancelled lines closed") }}>
      <PickField label="Disposition" value={choice} onChange={(v) => setChoice(v as typeof choice)} options={WO_DISPOSITIONS} />
    </DialogShell>
  )
}
