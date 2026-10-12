import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DensityToggle, DetailHeader, EmptyState, ErrorAlert, KV, RulesPanel, SkeletonRows, StatusBadge, rowCls, useFirstVisitLoading, type Density } from "../components/common"
import { useStore } from "../data/store"
import { LIFECYCLE, listDate, money, product, quoteValue } from "../data/model"

export function QuotationList() {
  const { db } = useStore()
  const loading = useFirstVisitLoading("quotes")
  const [density, setDensity] = useState<Density>("compact")
  const [filter, setFilter] = useState("All")
  const rows = db.quotations.filter((q) => filter === "All" || q.status === filter)
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Quotations</h1>
        <label className="flex items-center gap-2 text-sm">
          Status
          <select className="h-8 rounded-md border border-input bg-background px-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>All</option>
            {LIFECYCLE.quotation.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span className="text-sm text-muted-foreground">{rows.length} rows</span>
        <div className="ml-auto">
          <DensityToggle value={density} onChange={setDensity} />
        </div>
      </div>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Quotation</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Valid until</TableHead>
            <TableHead>Order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <SkeletonRows cols={6} />
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState title={`No quotations with status ${filter}.`}>
                  <Button variant="outline" onClick={() => setFilter("All")}>
                    Clear filter
                  </Button>
                </EmptyState>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((q) => {
              const c = db.customers.find((x) => x.id === q.customerId)!
              return (
                <TableRow key={q.id} className={rowCls(density)}>
                  <TableCell>
                    <Link className="text-link underline" to={`/sales/quotations/${q.id}`}>
                      {q.id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-80 truncate" title={c.name}>
                    {c.name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge entity="quotation" status={q.status} />
                  </TableCell>
                  <TableCell className="tabular text-right">{money(quoteValue(q), c.currency)}</TableCell>
                  <TableCell>{listDate(q.validUntil)}</TableCell>
                  <TableCell>{q.orderRef ?? "—"}</TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function QuotationDetail() {
  const { id = "" } = useParams()
  const { db, actions } = useStore()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [lossOpen, setLossOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [lossErr, setLossErr] = useState<string | null>(null)
  const q = db.quotations.find((x) => x.id === id)
  if (!q) return <ErrorAlert title="Quotation not found">No quotation {id} in this prototype. Open the quotation list.</ErrorAlert>
  const c = db.customers.find((x) => x.id === q.customerId)!
  const locked = q.status !== "Draft"
  return (
    <div className="max-w-[960px]">
      <DetailHeader
        title={q.id}
        entity="quotation"
        status={q.status}
        sub={
          <p className="text-sm">
            {c.name} · {c.id}
          </p>
        }
        actions={
          <>
            {q.status === "Issued" && (
              <>
                <Button
                  onClick={() => {
                    const r = actions.recordWin(q.id)
                    if (!r.ok) setError(r.error)
                    else toast.success("Win recorded. Quotation Won.")
                  }}
                >
                  Record win
                </Button>
                <Button variant="outline" onClick={() => setLossOpen(true)}>
                  Record loss
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const r = actions.revise(q.id)
                    if (r.ok) nav(`/sales/quotations/${r.value}`)
                    else setError(r.error)
                  }}
                >
                  Revise
                </Button>
              </>
            )}
            {q.status === "Won" && !q.orderRef && (
              <Button
                onClick={() => {
                  const r = actions.convert(q.id)
                  if (r.ok) {
                    toast.success(`Order ${r.value} created in Draft.`)
                    nav(`/sales/orders/${r.value}`)
                  } else setError(r.error)
                }}
              >
                Convert to order
              </Button>
            )}
          </>
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorAlert title="Action not done" onDismiss={() => setError(null)}>
            {error}
          </ErrorAlert>
        </div>
      )}
      <dl className="mb-6 grid grid-cols-3 gap-4">
        <KV k="Valid until">{q.validUntil}</KV>
        <KV k="Version">V{q.version}</KV>
        <KV k="Total">
          <span className="tabular">{money(quoteValue(q), c.currency)}</span>
        </KV>
        <KV k="Version chain">
          {q.predecessor && (
            <>
              Predecessor <Link className="text-link underline" to={`/sales/quotations/${q.predecessor}`}>{q.predecessor}</Link>{" "}
            </>
          )}
          {q.successor && (
            <>
              Successor <Link className="text-link underline" to={`/sales/quotations/${q.successor}`}>{q.successor}</Link>
            </>
          )}
          {!q.predecessor && !q.successor && "Single version"}
        </KV>
        <KV k="Order cross-reference">{q.orderRef ? <Link className="text-link underline" to={`/sales/orders/${q.orderRef}`}>{q.orderRef} (quotation locked)</Link> : "None"}</KV>
        {q.lossReason && <KV k="Loss reason">{q.lossReason}</KV>}
      </dl>
      {locked && q.status === "Issued" && <p className="mb-2 text-sm text-muted-foreground">Issued content is locked. No Edit; use Revise to create the next version (R-8).</p>}
      <h2 className="mb-2 font-semibold">Lines</h2>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow className="h-8">
            <TableHead>Line</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>kVA rating</TableHead>
            <TableHead>Primary – secondary voltage</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Line value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.lines.map((l) => {
            const p = product(l.item)
            return (
              <TableRow key={l.no} className="h-8 text-[13px]">
                <TableCell className="tabular">{l.no}</TableCell>
                <TableCell>
                  {l.item}
                  <div className="text-xs text-muted-foreground">{p.description}</div>
                </TableCell>
                <TableCell className="tabular">{p.kva}</TableCell>
                <TableCell>{p.voltages}</TableCell>
                <TableCell className="tabular text-right">{l.qty}</TableCell>
                <TableCell className="tabular text-right">{money(l.price, c.currency)}</TableCell>
                <TableCell className="tabular text-right">{money(l.price * l.qty, c.currency)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <h2 className="mt-6 mb-2 font-semibold">Activity</h2>
      <ul className="space-y-1 text-sm">
        {[...q.activity].reverse().map((a, i) => (
          <li key={i}>
            <span className="tabular text-muted-foreground">{a.at}</span> · {a.by} · {a.text}
          </li>
        ))}
      </ul>
      <Dialog open={lossOpen} onOpenChange={setLossOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record loss</DialogTitle>
            <DialogDescription>A loss reason is required.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="lossReason">Loss reason</Label>
          <Input id="lossReason" value={reason} aria-invalid={!!lossErr} aria-describedby={lossErr ? "lossErr" : undefined} onChange={(e) => setReason(e.target.value)} />
          {lossErr && (
            <p id="lossErr" className="text-sm text-destructive">
              {lossErr}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const r = actions.recordLoss(q.id, reason)
                if (!r.ok) setLossErr(r.error)
                else setLossOpen(false)
              }}
            >
              Record loss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RulesPanel
        rules={[
          ["R-8", "Convert to order only from Won; prices copied and frozen, Price Source = Quotation; Issued quote content is locked (Revise only).", "DOC:p.51 §3.3"],
          ["R-1", "Credit check runs at quote-to-order conversion (result recorded on the order).", "DOC:p.49 §2.2"],
          ["R-23", "Detail header carries a status badge and a lifecycle strip.", "DOC:p.242 §10.2"],
        ]}
      />
    </div>
  )
}
