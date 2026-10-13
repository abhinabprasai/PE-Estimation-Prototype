// FX-OM-CUSTPROP Customer property return and SO closure reconciliation (/sales/dialogs/customer-property)
// [DOC:p.220 Book II §14.3]. Customer-supplied material is received as non-valuated special stock; at the end it is
// consumed, returned on a zero-value delivery with a property return note, or scrapped with the customer's
// consent. The SO closure checklist cannot reconcile while property is still with PE.
import { useState } from "react"
import { Link } from "react-router"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { useSlice } from "@/store"
import { customerPropAction, receiveCustProp, reconcileClosure } from "../../fx/actions"
import type { CustProp } from "../../fx/model"
import { ActivityList, Section } from "../../components/ext"
import { DialogPage, PickField, TextField, report, useFxState } from "./kit"

const left = (c: CustProp) => c.received - c.consumed - c.returned - c.scrapped

export function CustPropActionDialog({ cp, kind, open, onOpenChange }: { cp: CustProp; kind: "return" | "scrap" | "consume"; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [qty, setQty] = useState(String(left(cp)))
  const label = { return: "Return to customer", scrap: "Scrap with consent", consume: "Consume into production" }[kind]
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title={`${label}: ${cp.description}`} description={`${cp.item} · ${cp.batchOrSerial} · ${left(cp)} of ${cp.received} still with PE`}
      consequence={kind === "return" ? "Returns the quantity on a zero-value delivery that carries a property return note. No stock value or ledger posting is involved." : kind === "scrap" ? "Scraps the quantity; the customer's consent goes in the reason. No value is posted." : "Consumes the quantity into a work order; no material value is posted and genealogy records the consumption."}
      requireReason={kind === "scrap"} reasonLabel="Customer consent and reason (required)" confirmLabel={label} destructive={kind === "scrap"}
      onConfirm={(reason) => report(customerPropAction(cp.id, kind, Number(qty), reason), `${label}: ${qty}`)}>
      <TextField id="cp-qty" label="Quantity" type="number" value={qty} onChange={setQty} />
    </DialogShell>
  )
}

export function CustPropReceiveDialog({ soId, open, onOpenChange }: { soId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [d, setD] = useState("")
  const [ref, setRef] = useState("")
  const [qty, setQty] = useState("1")
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title={`Receive customer property for ${soId}`} description="Customer-supplied material is received at zero cost as special stock owned by the customer." consequence="Creates the receipt with a CUSTPROP item. No inventory value is posted; the SO closure checklist now waits for its return or consumption." confirmLabel="Receive"
      onConfirm={() => report(receiveCustProp(soId, d, ref, Number(qty)), "Customer property received")}>
      <TextField id="cpr-d" label="Description" value={d} onChange={setD} />
      <TextField id="cpr-ref" label="Serial or batch" value={ref} onChange={setRef} />
      <TextField id="cpr-q" label="Quantity" type="number" value={qty} onChange={setQty} />
    </DialogShell>
  )
}

export function CustomerPropertyPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const ids = [...new Set(db.fx.custProp.map((c) => c.soId))]
  const [soId, setSoId] = useState(ids.find((x) => x === "SO-2026-00377") ?? ids[0] ?? "SO-2026-00377")
  const rows = db.fx.custProp.filter((c) => c.soId === soId)
  const closure = db.fx.soClosure[soId]
  const open = rows.filter((c) => left(c) > 0)
  const [act, setAct] = useState<{ id: string; kind: "return" | "scrap" | "consume" } | null>(null)
  const [recv, setRecv] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const target = rows.find((r) => r.id === act?.id)
  return (
    <DialogPage
      screenId="FX-OM-CUSTPROP"
      title="Customer property and SO closure"
      description="Customer-supplied material is returned, consumed or scrapped before the order can close."
      st={st}
      context={
        <div className="flex max-w-xl flex-col gap-1">
          <PickField label="Sales order" value={soId} onChange={setSoId} options={[...new Set([...ids, ...db.orders.filter((o) => o.type === "ETO").map((o) => o.id)])].map((id) => ({ value: id, label: id }))} />
          <Link className="text-sm text-link underline" to={`/sales/orders/${soId}`}>Open {soId}</Link>
        </div>
      }
      cards={[
        { id: "recv", title: "Receive customer property", open: "Open receipt", body: "Zero-cost, non-valuated receipt; flagged Customer Property at goods receipt.", render: (o, c) => <CustPropReceiveDialog soId={soId} open={o} onOpenChange={c} /> },
      ]}
      extra={
        <div className="mt-4 flex flex-col gap-4">
          <Section title={`Customer property on ${soId}`}>
            <Table>
              <TableHeader className="bg-table-head"><TableRow><TableHead>Item</TableHead><TableHead>Serial or batch</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Consumed</TableHead><TableHead className="text-right">Returned</TableHead><TableHead className="text-right">Scrapped</TableHead><TableHead className="text-right">With PE</TableHead><TableHead>Return note</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.description}<span className="block text-xs text-muted-foreground">{c.item}</span></TableCell>
                    <TableCell>{c.batchOrSerial}</TableCell>
                    <TableCell className="tabular text-right">{c.received}</TableCell><TableCell className="tabular text-right">{c.consumed}</TableCell><TableCell className="tabular text-right">{c.returned}</TableCell><TableCell className="tabular text-right">{c.scrapped}</TableCell>
                    <TableCell className="tabular text-right font-semibold">{left(c)}</TableCell>
                    <TableCell>{c.returnNote ? `${c.returnNote} on ${c.returnDelivery}` : "None"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(["return", "consume", "scrap"] as const).map((k) => <Button key={k} size="sm" variant="outline" className="mr-1" disabled={!st.writable || left(c) === 0} title={left(c) === 0 ? "Nothing left with PE" : st.why || undefined} onClick={() => setAct({ id: c.id, kind: k })}>{k === "return" ? "Return" : k === "consume" ? "Consume" : "Scrap"}</Button>)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-muted-foreground">No customer property on this order. Receive some to see the return path.</TableCell></TableRow>}
              </TableBody>
            </Table>
            {rows.length > 0 && <ActivityList items={rows.flatMap((r) => r.log)} />}
          </Section>
          <Section title="SO closure checklist">
            <p className="text-sm">Customer property reconciled: <strong>{closure?.reconciled ? `Yes (${closure.at}, ${closure.by})` : open.length ? `No, ${open.length} item(s) still with PE` : "Not yet confirmed"}</strong></p>
            <div><Button onClick={() => { const r = reconcileClosure(soId); const e = report(r, "Customer property reconciled on the closure checklist"); if (e) setErr(e) }} disabled={!st.writable || !!closure?.reconciled}>Reconcile for closure</Button></div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <Chip kind="design" note="The closure checklist has more items in Finance (invoice posted, revenue contract). Only the customer-property item is built here." />
          </Section>
          {target && act && <CustPropActionDialog cp={target} kind={act.kind} open onOpenChange={(o) => !o && setAct(null)} />}
          <CustPropReceiveDialog soId={soId} open={recv} onOpenChange={setRecv} />
        </div>
      }
      rules={[
        ["CP-1", "Customer property is received at zero cost as non-valuated special stock owned by the customer; no #-posting applies.", "DOC:p.220 §14.3"],
        ["CP-2", "At the end it is consumed, returned on a zero-value delivery with a property return note, or scrapped with consent.", "DOC:p.220 §14.3"],
        ["CP-3", "The sales order cannot close while customer property is still held.", "DOC:p.220 §14.3"],
      ]}
    />
  )
}
