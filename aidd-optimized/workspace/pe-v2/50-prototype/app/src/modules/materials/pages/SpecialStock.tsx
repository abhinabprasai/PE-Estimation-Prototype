// FX-MM-SPECIAL: Special-stock and ownership deltas [Book II §14.1-14.4]. Stock by bucket with the
// owner and peg columns, the Consignment and Customer Property tags that GRN and WO lines carry,
// and a zero-cost badge for customer-supplied material (never valued, never in ATP, never in E&O).
// De-Peg releases SO-pegged stock to anonymous stock: a reason, then the Sales Director's approval.

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell, ListPage } from "@/components/templates"
import { ApprovalButton, Chip, EmptyState, FamilyBadge, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { requestDepeg } from "../data/ext-actions"
import type { StockRow } from "../data/types"
import { ownerOfBucket, tagOwnerNote } from "../lib/ext-rules"
import { MatLink, Reading, Section } from "../components/common"
import { useViewState } from "../components/states"
import { confirmRun } from "../components/run"

const BUCKETS = ["all special", "Consignment", "Customer Property", "SO-Pegged", "At Subcontractor", "In-Transit", "Own"]

export function SpecialStock() {
  const s = useSlice("materials")
  const st = useViewState("FX-MM-SPECIAL", { degradedWhat: "Sales order pegging is not refreshing" })
  const [bucket, setBucket] = useState("all special")
  const [depeg, setDepeg] = useState<StockRow | null>(null)
  const rows = st.empty ? [] : s.stock.filter((r) => (bucket === "all special" ? r.bucket !== "Own" : r.bucket === bucket))
  const cols: Column<StockRow>[] = [
    { id: "id", header: "Stock row", value: (r) => r.id, mono: true, sortable: true },
    { id: "mat", header: "Material", value: (r) => r.materialId, sortable: true, cell: (r) => <MatLink id={r.materialId} /> },
    { id: "loc", header: "Location", value: (r) => `${r.warehouseId} / ${r.bin}`, mono: true },
    { id: "batch", header: "Batch", value: (r) => r.batchId ?? "", cell: (r) => (r.batchId ? <Link to={`/inventory/batches/${r.batchId}`} className="font-mono text-link underline-offset-4 hover:underline">{r.batchId}</Link> : "") },
    { id: "qty", header: "Qty", value: (r) => r.qty, align: "right", mono: true, sortable: true, cell: (r) => fmtNumber(r.qty) },
    { id: "status", header: "Stock status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="stock" status={r.status} size="sm" /> },
    {
      id: "bucket", header: "Bucket", value: (r) => r.bucket, filterable: true,
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          {r.bucket}
          {r.bucket === "Customer Property" && <Chip kind="design" note="Customer-supplied: zero value, never in ATP, never in E&O (§14.3)">Zero cost</Chip>}
        </span>
      ),
    },
    { id: "owner", header: "Owner", value: (r) => ownerOfBucket(r.bucket, r.pegRef) },
    { id: "peg", header: "Peg / reference", value: (r) => r.pegRef ?? "", mono: true },
    { id: "grn", header: "GRN", value: (r) => r.grnId ?? "", mono: true },
    {
      id: "act", header: "Action", value: () => "",
      cell: (r) =>
        r.bucket !== "SO-Pegged" ? null : r.depeg ? (
          <ApprovalButton kind="Reallocation of confirmed supply" subject={{ type: "material", id: r.id }} title={`De-Peg ${r.qty} ${r.materialId} (${r.id}) from ${r.pegRef}: ${r.depeg.reason}`} variant="outline" stay disabled={!st.canWrite} disabledReason={st.blockedWhy} />
        ) : (
          <Button size="sm" variant="outline" disabled={!st.canWrite} title={st.blockedWhy} onClick={() => setDepeg(r)}>
            De-Peg
          </Button>
        ),
    },
  ]
  const tags = st.empty ? [] : s.x.tags
  return (
    <>
      <ListPage
        header={{
          screenId: "FX-MM-SPECIAL",
          title: "Special stock and ownership",
          description: "Stock that is not plain own stock: consignment (vendor-owned until withdrawn), customer property (zero cost), SO-pegged, at a subcontractor, in transit. Owner and peg are columns; goods receipts and work orders carry the ownership tag.",
          chips: <Reading id="RD-MM-39" />,
          actions: (
            <Button variant="outline" asChild>
              <Link to="/inventory/consignment-settlement">Consignment settlement</Link>
            </Button>
          ),
        }}
        above={
          <div className="flex flex-col gap-3">
            {st.banners}
            <div className="flex max-w-xs flex-col gap-1">
              <Label htmlFor="sp-bucket">Bucket</Label>
              <Select value={bucket} onValueChange={setBucket}>
                <SelectTrigger id="sp-bucket" size="sm" className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{BUCKETS.map((b) => <SelectItem key={b} value={b}>{b === "all special" ? "All special stock" : b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        }
        table={{
          rows,
          columns: cols,
          rowId: (r) => r.id,
          searchText: (r) => `${r.id} ${r.materialId} ${r.bin} ${r.batchId ?? ""} ${r.pegRef ?? ""} ${r.grnId ?? ""} ${r.bucket}`,
          searchPlaceholder: "Search material, batch, owner, peg, GRN",
          loading: st.loading,
          error: st.error,
          onRetry: st.onRetry,
          toolbar: st.toolbar,
          densityKey: "FX-MM-SPECIAL",
          empty: { title: "No special stock", body: "Consignment, customer property and pegged stock appear here when a goods receipt carries an ownership tag." },
        }}
        below={
          <div className="mt-6 flex flex-col gap-6">
            <Section title={`Ownership tags on GRN and WO lines (${tags.length})`}>
              {tags.length === 0 ? (
                <EmptyState title="No tagged line">A GRN line is tagged Consignment or Customer Property when it is received.</EmptyState>
              ) : (
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow><TableHead>Document</TableHead><TableHead>Line</TableHead><TableHead>Material</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Tag</TableHead><TableHead>Owner</TableHead><TableHead>Value</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {tags.map((t) => (
                      <TableRow key={t.id} className="align-top">
                        <TableCell className="font-mono">{t.docType} {t.docId}</TableCell>
                        <TableCell className="tabular">{t.line}</TableCell>
                        <TableCell><MatLink id={t.materialId} /></TableCell>
                        <TableCell className="tabular text-right">{fmtNumber(t.qty)}</TableCell>
                        <TableCell>
                          <FamilyBadge family={t.tag === "Consignment" ? "pending" : "active"} label={t.tag} size="sm" title="Ownership tag (§14.1); not an S-row" />
                        </TableCell>
                        <TableCell>{t.owner}</TableCell>
                        <TableCell>
                          {t.zeroCost ? <FamilyBadge family="done" label="Zero cost: customer-supplied" size="sm" /> : <span className="text-muted-foreground">{tagOwnerNote(t)}</span>}
                          {t.note && <span className="block text-xs text-muted-foreground">{t.note}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>
          </div>
        }
      />
      {depeg && (
        <DialogShell
          open
          onOpenChange={(o) => !o && setDepeg(null)}
          title={`De-Peg ${depeg.qty} ${depeg.materialId}`}
          description={`${depeg.id} is pegged to ${depeg.pegRef}.`}
          consequence="De-Peg only records your reason and prepares the request. When the Sales Director approves it in the inbox, the stock becomes anonymous own stock and the reason is logged on both sales order lines."
          requireReason
          reasonLabel="Reason (logged on both SO lines)"
          confirmLabel="Prepare De-Peg request"
          confirmDisabled={!st.canWrite}
          onConfirm={(reason) => (st.canWrite ? confirmRun(requestDepeg(depeg.id, reason), "Reason stored: send it to the Sales Director from the row") : (st.blockedWhy ?? "Blocked"))}
        />
      )}
      <RulesPanel
        rules={[
          ["§14.1", "Special stock buckets: Own, At Subcontractor, Consignment, Customer Property, SO-Pegged, In-Transit. Stock reports show owner and peg as columns.", "[Book II §14.1]"],
          ["§14.2", "Consignment is vendor-owned until withdrawn: memo quantity only on goods receipt, converted to a valued issue at consumption and settled monthly.", "[Book II §14.2]"],
          ["§14.3", "Customer-supplied material is received at zero value, never counts in ATP or E&O, and consumption writes genealogy without a value.", "[Book II §14.3]"],
          ["§14.4", "De-Peg of SO-pegged stock needs the Sales Director and a reason, logged on both lines.", "[Book II §14.4]"],
        ]}
      />
    </>
  )
}
