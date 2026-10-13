// Simulate GL (Material Detail global action, Book II §5.3 / Part H §3): pick a transaction and a
// quantity, and see how the released account determination matrix resolves its accounts for this
// material's valuation class. Nothing posts; a missing key shows E-MM-21.

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { SIM_TRANSACTIONS, isValuated, simulate } from "../lib/rules"
import { getMaterial, rateOf } from "../data/state"
import { liveRows } from "../data/actions"
import { Reading, TextPostingPreview } from "./common"

export function SimulateGlDialog({ materialId, open, onOpenChange }: { materialId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useSlice("materials")
  const [tx, setTx] = useState("grn")
  const [qty, setQty] = useState("1")
  const m = getMaterial(s, materialId)
  if (!m) return null
  const vc = s.views[materialId]?.valuationClass
  const rate = rateOf(s, materialId)
  const n = Number(qty)
  const valid = Number.isFinite(n) && n > 0
  const legs = isValuated(m.type) ? simulate(liveRows(s.acctDetermination), tx, vc, valid ? Math.round(n * rate * 100) / 100 : 0) : []
  const gaps = legs.filter((l) => !l.account)
  const label = SIM_TRANSACTIONS.find((t) => t.id === tx)?.label ?? tx
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Simulate GL: {m.id}</DialogTitle>
          <DialogDescription>Shows how the released matrix would post one transaction for this material. Nothing is posted.</DialogDescription>
        </DialogHeader>
        {!isValuated(m.type) ? (
          <p className="text-sm">{m.type} is not valuated: it has no inventory postings, so there is nothing to simulate.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="sim-tx">Transaction</Label>
                <Select value={tx} onValueChange={setTx}>
                  <SelectTrigger id="sim-tx" className="w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>{SIM_TRANSACTIONS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sim-qty">Quantity ({m.baseUom})</Label>
                <Input id="sim-qty" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className="w-28" aria-invalid={!valid ? true : undefined} />
              </div>
              <p className="text-sm text-muted-foreground">Class {vc ?? "none"} · rate {fmtMoney(rate)} per {m.baseUom}</p>
            </div>
            {!valid && <p role="alert" className="text-sm text-destructive">Enter a quantity above zero.</p>}
            <Table>
              <TableHeader className="bg-table-head">
                <TableRow><TableHead>Side</TableHead><TableHead>Key</TableHead><TableHead>Account</TableHead><TableHead>Matrix row</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {legs.map((l, i) => (
                  <TableRow key={i} className={cn("h-8 text-[13px]", !l.account && "text-destructive")}>
                    <TableCell>{l.side}</TableCell><TableCell className="font-mono">{l.key}</TableCell><TableCell>{l.account ?? "E-MM-21: no row resolves"}</TableCell><TableCell className="font-mono text-xs">{l.rowId ?? ""}</TableCell>
                    <TableCell className="tabular text-right">{fmtMoney(l.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {gaps.length > 0 ? (
              <p role="alert" className="rounded-md border border-status-blocked px-3 py-2 text-sm">E-MM-21: {gaps.map((g) => g.key).join(", ")} does not resolve for class {vc ?? "none"}. The transaction would be refused. <Link to="/materials/account-determination" className="text-link underline-offset-4 hover:underline">Open account determination</Link></p>
            ) : valid ? (
              <TextPostingPreview title="Simulated entry" lines={[{ transaction: label, debit: legs[0]?.account ?? "", credit: legs[1]?.account ?? "", amount: legs[0]?.amount ?? 0, detail: `${n} ${m.baseUom} ${m.id}` }]} note="Simulation only; nothing is posted." />
            ) : null}
            <Reading id="RD-MM-29" />
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
