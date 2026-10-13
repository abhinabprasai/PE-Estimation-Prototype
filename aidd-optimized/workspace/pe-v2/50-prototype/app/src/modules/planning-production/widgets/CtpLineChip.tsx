// Per-line CTP chip for the sales quote and order pages (CTP-DLG "dialog on quotes and orders",
// README request R-1). The sales module renders <CtpLineChip .../> beside an MTO or ETO line; the chip
// shows the promise state as text and opens the Promise Dialog, or opens a new check for the line.
// MTS lines keep ATP (stock plus scheduled receipts) and show no chip [DOC:p.193 §4].
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { DocRef, ISODate, MaterialId } from "@/data/domain"
import { fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { useAct } from "../components"
import * as act from "../lib/actions"
import { PromiseDialog } from "../pages/Planning"

export interface CtpLineChipProps {
  doc: DocRef
  line: number
  itemId: MaterialId
  qty: number
  customerId: string
  orderType: string
  requestedDate: ISODate
  quoteType?: "Budgetary" | "Firm"
}

export function CtpLineChip(p: CtpLineChipProps) {
  const s = useSlice("planningProduction")
  const run = useAct()
  const [open, setOpen] = useState<string | null>(null)
  if (p.orderType !== "MTO" && p.orderType !== "ETO") return null
  const c = s.promises.find((x) => x.doc.id === p.doc.id && x.line === p.line && x.decision !== "Declined" && x.decision !== "Expired")
  const label = c ? `CTP: ${act.promiseState(c)}${c.result ? ` · ship ${fmtDate(c.result.shipDate)}` : ""}` : "Check promise (CTP)"
  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => {
        if (c) return setOpen(c.id)
        const id = run((d, ctx) => act.addPromiseCheck(d, ctx, { doc: p.doc, line: p.line, customerId: p.customerId, itemId: p.itemId, qty: p.qty, orderType: p.orderType, quoteType: p.quoteType, requestedDate: p.requestedDate }))
        if (id) setOpen(id)
      }}>{label}</Button>
      {open && <PromiseDialog id={open} open onOpenChange={(o) => !o && setOpen(null)} />}
    </>
  )
}
