// RevisionCompare: side-by-side revision diff [DOC:p.61 §3.3 Compare Revisions]: added (green),
// removed (red), changed (amber), each row also labelled in words (C-5). Exportable: this is the
// change-evidence document for ECO review. Used by the EBOM editor's Compare tab and by the
// stand-alone view at /engineering/compare-revisions.

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/patterns"
import { fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { diffLines, type DiffRow, type RevisionOption } from "./data/logic"
import type { EbomLineX } from "./data/types"

const TINT: Record<DiffRow["kind"], string> = { Added: "bg-status-passed-tint", Removed: "bg-destructive/10", Changed: "bg-status-pending-tint", Same: "" }
const cell = (l?: EbomLineX) => (l ? `${l.componentId} × ${fmtNumber(l.qty, 2)} ${l.uom}${l.scrapPct ? ` · scrap ${l.scrapPct}%` : ""}${l.refDes ? ` · ${l.refDes}` : ""}` : "")

export function RevisionCompare({ options, fromKey, toKey, onFrom, onTo, disabled }: {
  options: RevisionOption[]
  fromKey: string
  toKey: string
  onFrom: (k: string) => void
  onTo: (k: string) => void
  /** Offline: the diff stays readable but export is off. */
  disabled?: boolean
}) {
  const from = options.find((o) => o.key === fromKey)
  const to = options.find((o) => o.key === toKey)
  const [onlyChanges, setOnlyChanges] = useState(false)
  const rows = useMemo(() => (from && to ? diffLines(from.lines, to.lines) : []), [from, to])
  if (options.length < 2) return <EmptyState title="Nothing to compare">This EBOM has no earlier revision and no other EBOM shares its parent item.</EmptyState>
  const n = (k: DiffRow["kind"]) => rows.filter((r) => r.kind === k).length
  const shown = onlyChanges ? rows.filter((r) => r.kind !== "Same") : rows
  const exportCsv = () => {
    if (!from || !to) return
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`
    const text = ["Find #,Change,Fields,Was,Now", ...rows.filter((r) => r.kind !== "Same").map((r) => [r.no, r.kind, q(r.fields.join("; ")), q(cell(r.a)), q(cell(r.b))].join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `compare-${from.ebomId}-rev${from.rev}-to-${to.ebomId}-rev${to.rev}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Change evidence exported (CSV)")
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label>Compare (was)</Label>
          <Select value={fromKey} onValueChange={onFrom}>
            <SelectTrigger size="sm" className="w-72" aria-label="Compare from"><SelectValue /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>With (now)</Label>
          <Select value={toKey} onValueChange={onTo}>
            <SelectTrigger size="sm" className="w-72" aria-label="Compare to"><SelectValue /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyChanges} onCheckedChange={(v) => setOnlyChanges(!!v)} />Only changes</label>
        <Button variant="outline" size="sm" disabled={disabled || !from || !to} onClick={exportCsv}><Download aria-hidden="true" />Export change evidence (CSV)</Button>
      </div>
      {from && to && from.key === to.key && <p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">Both sides are the same revision; choose two different revisions to see a difference.</p>}
      <p className="text-sm" aria-live="polite">
        <span className="font-medium">{n("Added")} added</span>, <span className="font-medium">{n("Removed")} removed</span>, <span className="font-medium">{n("Changed")} changed</span>, {n("Same")} unchanged.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow><TableHead>Find #</TableHead><TableHead>Change</TableHead><TableHead>Was{from ? ` (rev ${from.rev})` : ""}</TableHead><TableHead>Now{to ? ` (rev ${to.rev})` : ""}</TableHead><TableHead>Fields changed</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.no} className={cn("h-8 text-[13px]", TINT[r.kind])}>
                <TableCell className="font-mono">{r.no}</TableCell>
                <TableCell className="font-medium">{r.kind}</TableCell>
                <TableCell>{cell(r.a)}</TableCell>
                <TableCell>{cell(r.b)}</TableCell>
                <TableCell>{r.fields.join(", ")}</TableCell>
              </TableRow>
            ))}
            {!shown.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No differences between these revisions.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Added, Removed and Changed rows are labelled in words as well as tinted. Rows are matched on the stable Find #. This is the change-evidence document for ECO review.</p>
    </div>
  )
}
