import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DensityToggle, EmptyState, ErrorAlert, KV, RulesPanel, SkeletonRows, StatusBadge, rowCls, useFirstVisitLoading, type Density } from "../components/common"
import { DetailPage } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { ActivityList } from "../components/ext"
import { recordQuoteOutcome } from "../fx/actions"
import { quoteExtOf } from "../fx/derive"
import { BudgetaryBanner, LossDialog, QuoteEto, QuoteLines, QuoteMargin, QuoteVersions, QuoteWinLoss } from "./fx/QuotationPanels"
import { QuoteToOrderDialog } from "./fx/QuoteToOrder"
import { StateBar, useFxState } from "./fx/kit"
import { useStore } from "../data/store"
import { LIFECYCLE, listDate, money, quoteValue } from "../data/model"

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
  const st = useFxState()
  const [error, setError] = useState<string | null>(null)
  const [lossOpen, setLossOpen] = useState(false)
  const [convOpen, setConvOpen] = useState(false)
  const q = db.quotations.find((x) => x.id === id)
  if (!q) return <ErrorAlert title="Quotation not found">No quotation {id} in this prototype. Open the quotation list.</ErrorAlert>
  const c = db.customers.find((x) => x.id === q.customerId)!
  const ext = quoteExtOf(db, q)
  const locked = q.status !== "Draft"
  const win = () => {
    const r = recordQuoteOutcome(q.id, "Won", { notes: "" })
    if (!r.ok) setError(r.error)
    else toast.success("Win recorded. Quotation Won.")
  }
  return (
    <>
      <DetailPage
        header={{
          title: q.id,
          screenId: "OM-QT-001/2",
          crumbs: [{ label: "Quotations", to: "/sales/quotations" }, { label: q.id }],
          description: `${c.name} · ${c.id}`,
          chips: <><Chip kind="design" note="Quote type from the quote header: Budgetary (±25%, watermarked, no ATP) or Firm (binding, full costing).">{ext.type}</Chip>{q.status === "Issued" && <Chip kind="design" note="Issued content is locked; use Revise (R-8).">Content locked</Chip>}</>,
          actions: (
            <>
              {q.status === "Issued" && (
                <>
                  <Button variant="outline" onClick={() => setLossOpen(true)} disabled={!st.writable} title={st.why || undefined}>
                    Record loss
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!st.writable}
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
            </>
          ),
          primary:
            q.status === "Issued" ? (
              <Button onClick={win} disabled={!st.writable} title={st.why || undefined}>
                Record win
              </Button>
            ) : q.status === "Won" && !q.orderRef ? (
              <Button onClick={() => setConvOpen(true)} disabled={!st.writable} title={st.why || undefined}>
                Convert to order
              </Button>
            ) : undefined,
        }}
        status={{ kind: "quotation", value: q.status }}
        doc={{ type: "quotation", id: q.id }}
        summary={
          <>
            <KV k="Valid until">{q.validUntil}</KV>
            <KV k="Version">V{q.version}</KV>
            <KV k="Total">
              <span className="tabular">{money(quoteValue(q), c.currency)}</span>
            </KV>
            <KV k="Order cross-reference">{q.orderRef ? <Link className="text-link underline" to={`/sales/orders/${q.orderRef}`}>{q.orderRef} (quotation locked)</Link> : "None"}</KV>
            {q.lossReason && <KV k="Loss reason">{q.lossReason}</KV>}
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
          </>
        }
        tabs={[
          {
            id: "lines",
            label: "Lines",
            count: q.lines.length,
            content: (
              <div className="flex flex-col gap-3">
                <StateBar st={st} />
                {error && (
                  <ErrorAlert title="Action not done" onDismiss={() => setError(null)}>
                    {error}
                  </ErrorAlert>
                )}
                {locked && q.status === "Issued" && <p className="text-sm text-muted-foreground">Issued content is locked. No Edit; use Revise to create the next version (R-8).</p>}
                <QuoteLines q={q} db={db} writable={st.writable} />
              </div>
            ),
          },
          { id: "eto", label: "ETO configuration", content: <QuoteEto q={q} db={db} /> },
          { id: "margin", label: "Cost and margin", content: <QuoteMargin q={q} db={db} /> },
          { id: "versions", label: "Versions", content: <QuoteVersions q={q} db={db} /> },
          { id: "winloss", label: "Win and loss", content: <QuoteWinLoss q={q} db={db} onLoss={() => setLossOpen(true)} onWin={win} /> },
          { id: "activity", label: "Activity", content: <ActivityList items={q.activity} /> },
        ]}
      />
      {ext.type === "Budgetary" && <div className="mt-4"><BudgetaryBanner /></div>}
      <LossDialog q={q} open={lossOpen} onOpenChange={setLossOpen} />
      <QuoteToOrderDialog qt={q} open={convOpen} onOpenChange={setConvOpen} />
      <RulesPanel
        rules={[
          ["R-8", "Convert to order only from Won; prices copied and frozen, Price Source = Quotation; Issued quote content is locked (Revise only).", "DOC:p.51 §3.3"],
          ["R-1", "Credit check runs at quote-to-order conversion (result recorded on the order).", "DOC:p.49 §2.2"],
          ["R-23", "Detail header carries a status badge and a lifecycle strip.", "DOC:p.242 §10.2"],
          ["QT-1", "Quote type: Budgetary (±25%, watermarked BUDGETARY, no ATP) or Firm (binding, full costing); a Firm ETO quote needs a linked cost estimate.", "DOC:p.50 §3.1"],
          ["QT-2", "A loss reason is mandatory when the status goes to Lost: Price, Lead Time, Technical, Relationship, No-Bid, Other with notes.", "DOC:p.50 §3.1"],
          ["QT-3", "Commodity surcharge lines show index, base, date and the math; margin below target needs estimator and pricing approval, below floor routes to the Pricing Manager, Sales Director and CFO.", "DOC:p.122 §6.3-6.4"],
        ]}
      />
    </>
  )
}
