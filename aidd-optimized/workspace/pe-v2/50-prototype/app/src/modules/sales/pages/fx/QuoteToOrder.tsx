// FX-OM-QT2SO Quote to order conversion dialog (/sales/dialogs/quote-to-order) [DOC:p.51 Book I B §3.3].
// Won quotation -> Draft sales order: lines, frozen prices (Price Source = Quotation), configuration and estimate
// links are copied; the quotation locks with the SO cross-reference. The credit check runs at conversion.
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { money, product, quoteValue, type DB, type Quotation } from "../../data/model"
import { useStore } from "../../data/store"
import { quoteExtOf } from "../../fx/derive"
import { PickField, TextField, DialogPage, report, useFxState } from "./kit"

/** Why a quotation cannot convert (null = it can). */
export function convertBlock(db: DB, q: Quotation): string | null {
  if (q.status !== "Won") return `Convert to order is available only on a Won quotation (R-8). ${q.id} is ${q.status}.`
  if (q.orderRef) return `Already converted to ${q.orderRef}. The quotation is locked with that cross-reference.`
  const c = db.customers.find((x) => x.id === q.customerId)
  if (c && c.status !== "Active") return `E-OM-02: customer ${c.id} is ${c.status}. Only Active customers can be on a sales order; activate the customer first.`
  return null
}

export function QuoteToOrderDialog({ qt, open, onOpenChange }: { qt: Quotation; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db, actions } = useStore()
  const nav = useNavigate()
  const [po, setPo] = useState("")
  const c = db.customers.find((x) => x.id === qt.customerId)!
  const ext = quoteExtOf(db, qt)
  const value = quoteValue(qt)
  const passLimit = c.exposure + value <= c.creditLimit && !c.creditHold
  const passPast = !c.pastDue30
  const block = convertBlock(db, qt)
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`Convert ${qt.id} to a sales order`}
      description={`${c.name}. Quotation ${qt.status}, value ${money(value, c.currency)}.`}
      consequence={<>Creates a Draft sales order from {qt.id}: {qt.lines.length} line{qt.lines.length === 1 ? "" : "s"} with frozen quotation prices, configuration and estimate link{ext.ceId ? ` ${ext.ceId}` : "s"}. The quotation locks with the order number. The order is not committed until it is submitted.</>}
      confirmLabel="Create sales order"
      confirmDisabled={!!block}
      onConfirm={() => {
        const r = actions.convert(qt.id)
        if (!r.ok) return r.error
        if (po.trim()) actions.setPO(r.value, po.trim())
        report(r, (id) => `${id} created in Draft from ${qt.id}`)
        nav(`/sales/orders/${r.value}`)
        return null
      }}
    >
      {block && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{block}</p>}
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow><TableHead>Line</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Frozen price</TableHead><TableHead>Price Source</TableHead><TableHead>Estimate link</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {qt.lines.map((l) => (
            <TableRow key={l.no}>
              <TableCell className="tabular">{l.no}</TableCell>
              <TableCell>{l.item}<span className="block text-xs text-muted-foreground">{product(l.item).description}</span></TableCell>
              <TableCell className="tabular text-right">{l.qty}</TableCell>
              <TableCell className="tabular text-right">{money(l.price, c.currency)}</TableCell>
              <TableCell>Quotation</TableCell>
              <TableCell>{product(l.item).kind === "ETO" ? (ext.ceId ?? "None linked") : "Not needed"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Credit exposure now</dt><dd className="tabular">{money(c.exposure, c.currency)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Order value</dt><dd className="tabular">{money(value, c.currency)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Credit limit</dt><dd className="tabular">{money(c.creditLimit, c.currency)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Check at conversion</dt><dd>{passLimit && passPast ? "Would pass" : "Would fail"}</dd></div>
      </dl>
      {!(passLimit && passPast) && <p className="text-sm text-status-pending-ink">{!passLimit ? "Exposure plus this order exceeds the limit or the customer is on credit hold. " : ""}{!passPast ? "An invoice is more than 30 days past due. " : ""}The order still opens in Draft: the status table has no Draft to Credit Hold step <Chip kind="oq" id="OQ-32" />. The hold is set at submit.</p>}
      <TextField id="qt2so-po" label="Customer PO # (optional here)" value={po} onChange={setPo} hint="Required before the order can be submitted (R-7). It can be entered on the order." />
    </DialogShell>
  )
}

export function QuoteToOrderPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const [id, setId] = useState(db.quotations.find((q) => q.status === "Won" && !q.orderRef)?.id ?? db.quotations[0]?.id ?? "")
  const q = db.quotations.find((x) => x.id === id)
  const block = q ? convertBlock(db, q) : null
  return (
    <DialogPage
      screenId="FX-OM-QT2SO"
      title="Quote to order conversion"
      description="The dialog on a Won quotation. Pick a quotation to see it enabled, or refused with its reason."
      st={st}
      context={
        <div className="max-w-xl">
          <PickField label="Quotation" value={id} onChange={setId} options={db.quotations.map((x) => ({ value: x.id, label: `${x.id} · ${x.status}${x.orderRef ? ` · ${x.orderRef}` : ""}` }))} />
          {q && <p className="mt-1 flex items-center gap-2 text-sm"><StatusBadge kind="quotation" status={q.status} /><Link className="text-link underline" to={`/sales/quotations/${q.id}`}>Open quotation</Link></p>}
        </div>
      }
      cards={q ? [
        { id: "convert", title: "Convert to order", open: "Open dialog", body: block ?? "Ready: the quotation is Won, not yet converted, and the customer is Active.", render: (o, c) => <QuoteToOrderDialog qt={q} open={o} onOpenChange={c} /> },
      ] : []}
      rules={[
        ["R-8", "Convert to order only from Won; the quotation locks with the SO cross-reference.", "DOC:p.51 §3.3"],
        ["R-9", "Prices are copied frozen (Price Source = Quotation); a later price-list change does not touch them.", "DOC:p.51 §3.3"],
        ["E-OM-02", "Only Active customers can be on a sales order.", "DOC:p.52 §4.1"],
        ["OQ-32", "The credit check runs at conversion; a failure keeps the order in Draft (no Draft to Credit Hold transition).", "OQ-32"],
      ]}
    />
  )
}
