// FX-OM-ATP ATP partial-availability dialog (/sales/dialogs/atp-partial) [DOC:p.52 Book I B §4.3].
// Confirm on an MTS order runs ATP per open schedule line. Where stock is short the planner chooses: accept the
// later date, split (available now, rest at the later date) or backorder (rest stays Open with the Backorder
// flag). The confirmed date is written back to the line as the promised ship date.
import { useState } from "react"
import { Link } from "react-router"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { addDays, listDate, type DB, type SalesOrder } from "../../data/model"
import { useStore, ATP_LATER_DATE } from "../../data/store"
import { PickField, DialogPage, report, useFxState } from "./kit"

type Choice = "later" | "split" | "backorder"
export function atpRows(db: DB, o: SalesOrder) {
  const rows: { line: number; sched: number; item: string; req: number; avail: number; short: boolean; later: string; constraint: string; date: string }[] = []
  for (const l of o.lines)
    for (const s of l.schedules.filter((x) => x.status === "Open")) {
      const avail = db.atp[l.item] ?? 0
      const later = ATP_LATER_DATE[l.item] ?? { date: addDays(s.reqDate, 21), constraint: "incoming stock from production order" }
      rows.push({ line: l.no, sched: s.no, item: l.item, req: s.reqQty, avail, short: avail < s.reqQty, later: later.date, constraint: later.constraint, date: avail >= s.reqQty ? s.reqDate : later.date })
    }
  return rows
}
export const atpBlock = (o: SalesOrder) => (o.status !== "Confirmed" ? `Confirm (ATP) runs on a Confirmed order; ${o.id} is ${o.status}.` : o.type !== "MTS" ? `${o.id} is ${o.type}: Confirm runs CTP, not ATP. Use the promise dialog.` : null)

export function AtpPartialDialog({ so, open, onOpenChange }: { so: SalesOrder; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db, actions } = useStore()
  const [choice, setChoice] = useState<Choice>("split")
  const rows = atpRows(db, so)
  const short = rows.filter((r) => r.short)
  const block = atpBlock(so)
  const text: Record<Choice, string> = {
    later: "Accept the later date: the whole schedule line confirms at the date incoming supply arrives.",
    split: "Split: what is on hand ships on the requested date and is pegged; the rest becomes a new schedule line confirmed at the later date.",
    backorder: "Backorder: what is on hand is pegged; the rest stays Open with the Backorder flag until supply is promised (Backorder Workbench).",
  }
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`Confirm ${so.id}: partial availability`}
      description={short.length ? `${short.length} schedule line${short.length === 1 ? " is" : "s are"} short against stock on hand.` : "Stock covers every open schedule line."}
      consequence={short.length ? <>{text[choice]} The confirmed date is written back to the line as the promised ship date.</> : "Every open schedule line confirms on its requested date and is pegged to stock."}
      confirmLabel="Confirm with this choice"
      confirmDisabled={!!block || rows.length === 0}
      onConfirm={() => report(actions.confirmATP(so.id, choice), `${so.id} confirmed (${short.length ? choice : "all available"})`)}
    >
      {block && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{block}</p>}
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Line / schedule</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Requested</TableHead><TableHead className="text-right">Available</TableHead><TableHead>Requested date</TableHead><TableHead>Later date</TableHead><TableHead>Supply</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.line}-${r.sched}`}>
              <TableCell className="tabular">{r.line}/{r.sched}</TableCell>
              <TableCell>{r.item}</TableCell>
              <TableCell className="tabular text-right">{r.req}</TableCell>
              <TableCell className={`tabular text-right ${r.short ? "text-destructive" : ""}`}>{r.avail}</TableCell>
              <TableCell>{listDate(so.lines.find((l) => l.no === r.line)?.schedules.find((s) => s.no === r.sched)?.reqDate)}</TableCell>
              <TableCell>{r.short ? listDate(r.later) : "Not needed"}</TableCell>
              <TableCell>{r.short ? r.constraint : "on-hand stock"}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No Open schedule lines: ATP has already run on this order.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {short.length > 0 && (
        <RadioGroup value={choice} onValueChange={(v) => setChoice(v as Choice)} className="gap-3" aria-label="How to confirm the short schedule lines">
          {(["later", "split", "backorder"] as Choice[]).map((c) => (
            <div key={c} className="flex items-start gap-2">
              <RadioGroupItem id={`atp-${c}`} value={c} />
              <Label htmlFor={`atp-${c}`} className="flex flex-col items-start gap-0 font-normal">
                <span className="font-medium">{c === "later" ? "Accept later date" : c === "split" ? "Split" : "Backorder"}</span>
                <span className="text-sm text-muted-foreground">{text[c]}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
      {short.some((r) => r.avail === 0) && <p className="text-sm text-status-pending-ink">Nothing is on hand for {short.filter((r) => r.avail === 0).map((r) => r.item).join(", ")}: split and backorder have nothing to ship now, so those lines take the later date. <Chip kind="oq" id="OQ-32" /></p>}
    </DialogShell>
  )
}

export function AtpPartialPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const mts = db.orders.filter((o) => o.type === "MTS" && ["Confirmed", "Submitted", "Draft"].includes(o.status))
  const [id, setId] = useState(mts.find((o) => o.status === "Confirmed" && atpRows(db, o).some((r) => r.short))?.id ?? mts.find((o) => o.status === "Confirmed")?.id ?? mts[0]?.id ?? "")
  const o = db.orders.find((x) => x.id === id)
  return (
    <DialogPage
      screenId="FX-OM-ATP"
      title="ATP partial-availability dialog"
      description="Opened from Confirm on an MTS order when stock covers only part of a schedule line."
      st={st}
      context={
        <div className="max-w-xl">
          <PickField label="MTS order" value={id} onChange={setId} options={mts.map((x) => ({ value: x.id, label: `${x.id} · ${x.status}${atpRows(db, x).some((r) => r.short) ? " · short" : ""}` }))} />
          {o && <p className="mt-1 flex items-center gap-2 text-sm"><StatusBadge kind="salesOrder" status={o.status} /><Link className="text-link underline" to={`/sales/orders/${o.id}`}>Open order</Link></p>}
        </div>
      }
      cards={o ? [{ id: "atp", title: "Partial availability", open: "Open dialog", body: atpBlock(o) ?? `${atpRows(db, o).filter((r) => r.short).length} short schedule line(s) on ${o.id}.`, render: (open, c) => <AtpPartialDialog so={o} open={open} onOpenChange={c} /> }] : []}
      rules={[
        ["ATP-1", "Confirm on an MTS order runs ATP per schedule line; short lines offer accept-later-date, split or backorder.", "DOC:p.52 §4.3"],
        ["ATP-2", "The confirmed date writes back to the line's promised ship date; a split makes a new schedule line, a backorder keeps the Backorder flag.", "DOC:p.52 §4.3"],
        ["ATP-3", "Confirm needs a Confirmed order: release any credit hold first. Non-MTS orders run CTP.", "DOC:p.52 §4.3"],
      ]}
    />
  )
}
