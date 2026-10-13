// FX-OM-EXPORT Export documentation checklist on a shipment (/sales/dialogs/export-docs)
// [DOC:p.46 Book I A §11.4; p.55 Book I B §5.1]. A shipment whose ship-to is outside the origin country is zero-rated
// only with export documents: each item is prepared and then verified, and the export document set is generated
// when none is left Not started.
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell } from "@/components/templates"
import { useSlice } from "@/store"
import type { Delivery } from "../../data/model"
import { generateDoc, setExportItem, startExportChecklist } from "../../fx/actions"
import { countryOf, isExport, shipIdOf } from "../../fx/derive"
import type { ExportItem } from "../../fx/model"
import { DialogPage, Inline, PickField, useFxState, type FxState } from "./kit"

export function ExportChecklist({ d, st }: { d: Delivery; st: FxState }) {
  const db = useSlice("sales")
  const s = db.fx.ship[d.id]
  const [err, setErr] = useState<{ text: string } | null>(null)
  if (!s) return <p className="text-sm text-muted-foreground">No shipment record.</p>
  if (!s.export)
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>Ship-to {d.shipTo} is in {countryOf(d)}: no export documentation applies to this shipment.</p>
        <div><Button variant="outline" disabled={!st.writable} onClick={() => { const r = startExportChecklist(d.id); if (r.ok) toast.success("Export checklist started"); else setErr({ text: r.error }) }}>Start export checklist anyway</Button></div>
        <Inline error={err} />
      </div>
    )
  const done = s.export.filter((e) => e.state === "Verified").length
  const doc = s.docs["Export documents"]
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">Ship-to in {countryOf(d)}: tax zero-rated with export documents. {done} of {s.export.length} items verified. Export document set: <strong>{doc.state}</strong>{doc.at ? ` (${doc.at})` : ""}.</p>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Item</TableHead><TableHead className="w-48">State</TableHead></TableRow></TableHeader>
        <TableBody>
          {s.export.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.label}</TableCell>
              <TableCell>
                <Select value={e.state} disabled={!st.writable || d.status === "Delivered/Closed"} onValueChange={(v) => { const r = setExportItem(d.id, e.id, v as ExportItem["state"]); if (!r.ok) setErr({ text: r.error }); else setErr(null) }}>
                  <SelectTrigger size="sm" aria-label={`State of ${e.label}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{["Not started", "Prepared", "Verified"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Inline error={err} onDismiss={() => setErr(null)} />
      <div className="flex gap-2">
        <Button disabled={!st.writable || doc.state === "Generated"} title={st.why || undefined} onClick={() => { const r = generateDoc(d.id, "Export documents"); if (r.ok) toast.success("Export document set generated"); else setErr({ text: r.error }) }}>Generate export documents</Button>
        <Button variant="outline" asChild><Link to={`/sales/shipments/${shipIdOf(d.id)}`}>Open shipment</Link></Button>
      </div>
    </div>
  )
}

export function ExportDocsDialog({ d, open, onOpenChange }: { d: Delivery; open: boolean; onOpenChange: (o: boolean) => void }) {
  const st = useFxState()
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Export documentation for ${shipIdOf(d.id)}`} description={`${d.id} to ${d.shipTo}`} consequence="Each item moves Not started, Prepared, Verified. Generating the set needs every item prepared; the PGI document gate reads it." confirmLabel="Done" onConfirm={() => null}>
      <ExportChecklist d={d} st={st} />
    </DialogShell>
  )
}

export function ExportDocsPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const exportable = db.deliveries.filter((d) => isExport(d) || db.fx.ship[d.id]?.export)
  const [id, setId] = useState(exportable.find((d) => d.status !== "Delivered/Closed")?.id ?? exportable[0]?.id ?? db.deliveries[0]?.id ?? "")
  const d = db.deliveries.find((x) => x.id === id)
  return (
    <DialogPage
      screenId="FX-OM-EXPORT"
      title="Export documentation checklist"
      description="Zero-rated export needs its documents. The checklist sits on the shipment and the dialog opens from it."
      st={st}
      context={<div className="max-w-xl"><PickField label="Shipment" value={id} onChange={setId} options={db.deliveries.map((x) => ({ value: x.id, label: `${shipIdOf(x.id)} · ${x.id} · ${countryOf(x)} · ${x.status}` }))} /></div>}
      cards={d ? [{ id: "x", title: "Checklist dialog", open: "Open checklist", body: `${d.id}: ship-to in ${countryOf(d)}.`, render: (o, c) => <ExportDocsDialog d={d} open={o} onOpenChange={c} /> }] : []}
      extra={d ? <div className="mt-4 rounded-lg border p-4"><h2 className="mb-2 text-sm font-semibold">Checklist on the shipment</h2><ExportChecklist d={d} st={st} /></div> : null}
      rules={[
        ["EXP-1", "A shipment to a ship-to outside the origin country is zero-rated only with export documents on file.", "DOC:p.46 §11.4"],
        ["EXP-2", "The export document set generates when every checklist item is prepared; it is part of the shipping documents bundle.", "DOC:p.55 §5.1"],
        ["EXP-3", "Items: commercial invoice with HS codes, packing list with weights and origin, certificate of origin, export declaration or broker data, shipper's letter of instruction, dangerous goods declaration.", "Design value (checklist wording)"],
      ]}
    />
  )
}
