// FX-OM-KIT Sales kit BOM explode on quote and order lines (/sales/dialogs/kit-explode) [DOC:p.257 Book VI §6.1].
// A kit is a non-stocked, non-valuated header with a single-level Usage Sales BOM. Entering a kit explodes it
// into component sub lines; ATP runs on the components, the kit line confirms at the last component date.
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { materialById } from "@/data/shared/materials"
import { useSlice } from "@/store"
import { listDate, money } from "../../data/model"
import { addKitLine } from "../../fx/actions"
import { kitComponentAtp, kitComponentTotal, kitConfirmDate } from "../../fx/derive"
import { PickField, TextField, DialogPage, report, useFxState } from "./kit"

export function KitExplodeDialog({ docType, docId, open, onOpenChange }: { docType: "quotation" | "salesOrder"; docId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useSlice("sales")
  const nav = useNavigate()
  const [kitId, setKitId] = useState(db.fx.kits.find((k) => k.status === "Released")?.id ?? "")
  const [qty, setQty] = useState("1")
  const kit = db.fx.kits.find((k) => k.id === kitId)
  const q = Number(qty) > 0 ? Number(qty) : 1
  const rows = kit ? kitComponentAtp(db, kit, q) : []
  const date = kitConfirmDate(rows)
  const price = kit ? (kit.pricing === "Header price" ? kit.headerPrice : kitComponentTotal(kit)) : 0
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`Add a kit line to ${docId}`}
      description="The kit header is not stocked and not valued. Its single-level sales BOM explodes into component sub lines."
      consequence={kit ? <>Adds {kit.id} × {q} to {docId} and {kit.components.length} component sub lines. {docType === "salesOrder" ? `ATP runs on the components; the kit line confirms at the last component date, ${listDate(date)}.` : "The quotation line carries the kit price; ATP runs when the quotation converts."}</> : "Choose a kit."}
      confirmLabel="Explode and add"
      confirmDisabled={!kit}
      onConfirm={() => {
        const r = addKitLine(docType, docId, kitId, Number(qty))
        const e = report(r, (n) => `Kit ${kitId} added as line ${n} with ${kit?.components.length} sub lines`)
        if (!e) nav(docType === "quotation" ? `/sales/quotations/${docId}` : `/sales/orders/${docId}`)
        return e
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <PickField label="Sales kit" value={kitId} onChange={setKitId} options={db.fx.kits.map((k) => ({ value: k.id, label: `${k.id} · ${k.name}${k.status === "Draft" ? " (Draft BOM)" : ""}` }))} />
        <TextField id="kit-qty" label="Quantity of kits" type="number" value={qty} onChange={setQty} />
      </div>
      {kit && (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm">Pricing: <strong>{kit.pricing}</strong> ({money(price)} per kit) · BOM {kit.bomRev} · {kit.status}
            <Chip kind="design" note="The shared catalogue has no KIT material type yet (Request FR-16). The header is shown as a non-stocked, non-valuated kit.">Kit type: design value</Chip></p>
          <Table>
            <TableHeader className="bg-table-head"><TableRow><TableHead>Component</TableHead><TableHead className="text-right">Per kit</TableHead><TableHead className="text-right">Needed</TableHead><TableHead className="text-right">Available</TableHead><TableHead>ATP date</TableHead><TableHead>Material status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => {
                const m = materialById(r.item)
                return (
                  <TableRow key={r.item}>
                    <TableCell>{r.item}<span className="block text-xs text-muted-foreground">{m?.description}</span></TableCell>
                    <TableCell className="tabular text-right">{r.qty}</TableCell>
                    <TableCell className="tabular text-right">{r.need}</TableCell>
                    <TableCell className="tabular text-right">{r.atp}</TableCell>
                    <TableCell>{!r.ok ? `Short: ${listDate(r.date)}` : "On hand"}</TableCell>
                    <TableCell>{m?.status ?? "Not on master"}{m && ["Blocked", "Restricted"].includes(m.status) ? " (E-SAL-02)" : ""}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </>
      )}
    </DialogShell>
  )
}

export function KitExplodePage() {
  const db = useSlice("sales")
  const st = useFxState()
  const [target, setTarget] = useState("QT-TBD-0423-V1")
  const draftQuotes = db.quotations.filter((q) => ["Draft", "Internal Review"].includes(q.status))
  const draftOrders = db.orders.filter((o) => o.status === "Draft")
  const opts = [...draftQuotes.map((q) => ({ value: q.id, label: `${q.id} · quotation ${q.status}` })), ...draftOrders.map((o) => ({ value: o.id, label: `${o.id} · order ${o.status}` }))]
  const valid = opts.some((o) => o.value === target)
  const tgt = valid ? target : opts[0]?.value ?? ""
  const isQuote = tgt.startsWith("QT")
  return (
    <DialogPage
      screenId="FX-OM-KIT"
      title="Sales kit BOM explode"
      description="Add a kit to a Draft quotation or Draft order line; the single-level sales BOM explodes into component sub lines."
      st={st}
      context={
        <div className="flex max-w-xl flex-col gap-2">
          <PickField label="Add the kit to" value={tgt} onChange={setTarget} options={opts} />
          {tgt && <Link className="text-sm text-link underline" to={isQuote ? `/sales/quotations/${tgt}` : `/sales/orders/${tgt}`}>Open {tgt}</Link>}
          <p className="text-sm text-muted-foreground">Kits released: {db.fx.kits.filter((k) => k.status === "Released").length} of {db.fx.kits.length}. Kit lines already added this session: {db.fx.kitLines.length}.</p>
        </div>
      }
      cards={tgt ? [
        { id: "explode", title: "Explode a kit onto a line", open: "Open dialog", body: "Choose the kit and quantity. Components that cannot be sold (Blocked or Restricted) block the line (E-SAL-02); a Draft sales BOM cannot be exploded.", render: (o, c) => <KitExplodeDialog docType={isQuote ? "quotation" : "salesOrder"} docId={tgt} open={o} onOpenChange={c} /> },
      ] : []}
      extra={
        <div className="mt-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Kits</h2>
          <Table>
            <TableHeader className="bg-table-head"><TableRow><TableHead>Kit</TableHead><TableHead>Name</TableHead><TableHead>Pricing</TableHead><TableHead className="text-right">Header price</TableHead><TableHead className="text-right">Components</TableHead><TableHead>BOM</TableHead></TableRow></TableHeader>
            <TableBody>
              {db.fx.kits.map((k) => <TableRow key={k.id}><TableCell>{k.id}</TableCell><TableCell>{k.name}</TableCell><TableCell>{k.pricing}</TableCell><TableCell className="tabular text-right">{money(k.headerPrice)}</TableCell><TableCell className="tabular text-right">{k.components.length}</TableCell><TableCell>{k.bomRev} · {k.status}</TableCell></TableRow>)}
            </TableBody>
          </Table>
          {db.fx.kitLines.length > 0 && <ul className="text-sm">{db.fx.kitLines.map((k) => <li key={k.key}>{k.key}: {k.kitId} added {k.at}</li>)}</ul>}
        </div>
      }
      rules={[
        ["KIT-1", "A kit header is a material of type KIT: non-stocked, non-valuated; usage Sales BOM, single level, released through the EBOM review path.", "DOC:p.257 §6.1"],
        ["KIT-2", "Entering a kit on a quote or order line explodes it into component sub lines; price is the header price or the component total, as the kit says.", "DOC:p.257 §6.1"],
        ["E-SAL-02", "A component that cannot be sold blocks the kit line.", "DOC:p.257 §6.1"],
      ]}
    />
  )
}
