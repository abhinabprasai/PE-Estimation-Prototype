import { Fragment, useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Chip,
  DensityToggle,
  DetailHeader,
  EmptyState,
  ErrorAlert,
  FlagPill,
  KV,
  ReadinessFlags,
  RulesPanel,
  SkeletonRows,
  StatusBadge,
  rowCls,
  useFirstVisitLoading,
  type Density,
} from "../components/common"
import { useStore } from "../data/store"
import { LIFECYCLE, PRODUCTS, TODAY, listDate, money, openQty, orderValue, product, type SalesOrder } from "../data/model"

export function OrderList() {
  const { db } = useStore()
  const loading = useFirstVisitLoading("orders")
  const [density, setDensity] = useState<Density>("compact")
  const [filter, setFilter] = useState("All")
  const rows = db.orders.filter((o) => filter === "All" || o.status === filter)
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Sales orders</h1>
        <label className="flex items-center gap-2 text-sm">
          Status
          <select className="h-8 rounded-md border border-input bg-background px-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>All</option>
            {LIFECYCLE.order.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span className="text-sm text-muted-foreground">{rows.length} rows</span>
        <Chip kind="k" id="N-2 / OQ-13" note="9 sales order statuses from the page table, not the digest's 8" />
        <div className="ml-auto flex gap-2">
          <DensityToggle value={density} onChange={setDensity} />
          <Button asChild>
            <Link to="/sales/orders/new">New direct-entry order</Link>
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Requested ship</TableHead>
            <TableHead>Customer PO #</TableHead>
            <TableHead>Quotation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <SkeletonRows cols={8} />
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8}>
                <EmptyState title={`No sales orders with status ${filter}.`}>
                  <Button variant="outline" onClick={() => setFilter("All")}>
                    Clear filter
                  </Button>
                </EmptyState>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((o) => {
              const c = db.customers.find((x) => x.id === o.customerId)!
              return (
                <TableRow key={o.id} className={rowCls(density)}>
                  <TableCell>
                    <Link className="text-link underline" to={`/sales/orders/${o.id}`}>
                      {o.id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-80 truncate" title={c.name}>
                    {c.name}
                  </TableCell>
                  <TableCell>{o.type}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <StatusBadge entity="order" status={o.status} />
                      {o.status === "Rejected" && <Chip kind="k" id="K-15" note="Rejected is an exit from Submitted although the status table has no Rejected row" />}
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-right">{money(orderValue(o), o.currency)}</TableCell>
                  <TableCell>{listDate(o.requestedShip)}</TableCell>
                  <TableCell>{o.customerPO || "Not recorded"}</TableCell>
                  <TableCell>{o.quoteRef ?? "Direct entry"}</TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function CreditPanel({ o }: { o: SalesOrder }) {
  const { db } = useStore()
  const c = db.customers.find((x) => x.id === o.customerId)!
  const chk = o.creditChecks.at(-1)
  const avail = c.creditLimit - c.exposure
  return (
    <section aria-labelledby="credit-h" className="rounded-lg border p-4">
      <h2 id="credit-h" className="mb-2 font-semibold">
        Credit check
      </h2>
      <dl className="mb-2 grid grid-cols-3 gap-2">
        <KV k="Credit limit">
          <span className="tabular">{money(c.creditLimit, c.currency)}</span>
        </KV>
        <KV k="Exposure now">
          <span className="tabular">{money(c.exposure, c.currency)}</span>
        </KV>
        <KV k="Available credit (limit − exposure)">
          <span className={`tabular font-semibold ${avail < 0 ? "text-destructive" : ""}`}>{money(avail, c.currency)}</span>
        </KV>
      </dl>
      {!chk ? (
        <p className="text-sm text-muted-foreground">No credit check has run on this order yet. It runs at conversion, at submit, on value increases and at shipment release (R-1).</p>
      ) : (
        <div className="text-sm">
          <p className="mb-1">
            Last run {chk.when} on {chk.at}:
          </p>
          <ul className="space-y-1">
            <li>
              Test 1, exposure + new order value ≤ credit limit: <span className="tabular">{money(chk.exposure, c.currency)} + {money(chk.orderValue, c.currency)} = {money(chk.exposure + chk.orderValue, c.currency)}</span> against{" "}
              <span className="tabular">{money(chk.limit, c.currency)}</span> → <strong>{chk.passLimit ? "passed" : "failed"}</strong>
              {c.creditHold && " (customer credit hold flag is set)"}
            </li>
            <li>
              Test 2, no invoice more than 30 days past due: {chk.pastDue30 ? "an invoice is more than 30 days past due" : "none past due over 30 days"} → <strong>{chk.passPastDue ? "passed" : "failed"}</strong>
            </li>
          </ul>
          {o.creditChecks.length > 1 && <p className="mt-1 text-xs text-muted-foreground">{o.creditChecks.length} checks recorded on this order.</p>}
        </div>
      )}
    </section>
  )
}

function CtpDialog({ o, open, onOpenChange }: { o: SalesOrder; open: boolean; onOpenChange: (b: boolean) => void }) {
  const { actions } = useStore()
  const [secs, setSecs] = useState(900)
  useEffect(() => {
    if (!open) return
    setSecs(900)
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [open])
  const decided = o.lines[0].schedules[0].status !== "Open"
  const run = (d: "accept" | "decline" | "review") => {
    const r = actions.ctpDecide(o.id, d)
    if (!r.ok) toast.error(r.error)
    else onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>CTP-DLG Promise dialog · {o.id}</DialogTitle>
          <DialogDescription>Capable-to-promise result for line 10, 1 × FIN-TBD-7500MTO. Seeded result; no planning engine runs in this prototype.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-2">
          <KV k="Feasible date">2026-12-18</KV>
          <KV k="Binding constraint">
            Test bay capacity, weeks 47 to 49 <Chip kind="k" id="K-09" note="Finite capacity: the binding constraint can be capacity (Book III controls, C-01)" />
          </KV>
          <KV k="Requested date">{o.lines[0].requestedShip}</KV>
          <KV k="Soft reservation expires in">
            <span className="tabular" aria-live="off">
              {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
            </span>{" "}
            (15:00 is a design value)
          </KV>
        </dl>
        <div>
          <p className="text-sm font-medium">Alternatives (seeded)</p>
          <ul className="list-disc pl-6 text-sm">
            <li>Alternative 1: 2026-12-04 with the tank from an alternate supplier; constraint moves to material lead time</li>
            <li>Alternative 2: 2027-01-08 with no capacity change; no binding constraint inside the horizon</li>
          </ul>
        </div>
        {decided && <p className="text-sm">The promise on this schedule line is already decided ({o.lines[0].schedules[0].status}).</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => run("review")}>
            Request planner review
          </Button>
          <Button variant="outline" onClick={() => run("decline")}>
            Decline
          </Button>
          <Button disabled={decided || secs === 0} onClick={() => run("accept")}>
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function OrderDetail() {
  const { id = "" } = useParams()
  const [sp, setSp] = useSearchParams()
  const { db, role, actions } = useStore()
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null)
  const [atpOpen, setAtpOpen] = useState(false)
  const [atpChoice, setAtpChoice] = useState<"later" | "split" | "backorder">("split")
  const [stub, setStub] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const o = db.orders.find((x) => x.id === id)
  const ctpOpen = sp.get("ctp") === "1"
  if (!o) return <ErrorAlert title="Sales order not found">No order {id} in this prototype. Open the order list.</ErrorAlert>
  const c = db.customers.find((x) => x.id === o.customerId)!
  const terminal = ["Invoiced/Closed", "Cancelled", "Rejected"].includes(o.status)
  const appr = db.approvals.find((a) => a.soId === o.id && !a.decided)
  const hasOpenSched = o.lines.some((l) => l.schedules.some((s) => s.status === "Open"))
  const deliveries = db.deliveries.filter((d) => d.soId === o.id)
  const shortfalls = actions.atpCheck(o.id, db).filter((x) => x.avail < x.qty)

  const onSubmit = () => {
    const r = actions.submit(o.id)
    if (!r.ok) setErr({ msg: r.error, field: r.field })
    else {
      setErr(null)
      toast.info(r.value === "hold" ? "Submitted. Credit check failed: order on Credit Hold." : r.value === "sd" ? "Submitted. Waiting for Sales Director." : "Submitted. Credit check passed: Confirmed.")
    }
  }
  const onConfirm = () => {
    if (o.type !== "MTS") {
      setSp({ ctp: "1" })
      return
    }
    if (shortfalls.length) setAtpOpen(true)
    else {
      const r = actions.confirmATP(o.id, "split")
      if (!r.ok) setErr({ msg: r.error })
      else toast.success("ATP ran per line. Schedule lines confirmed and allocated.")
    }
  }

  return (
    <div className="max-w-[1200px]">
      <DetailHeader
        title={o.id}
        entity="order"
        status={o.status}
        chips={
          <>
            {o.status === "Rejected" && <Chip kind="k" id="K-15" note="Rejected is an exit from Submitted although the status table has no Rejected row" />}
            {o.status === "Submitted" && appr?.kind === "R-OM-02 no-quote order" && <Chip kind="oq" id="OQ-31" note="Order stays Submitted while waiting for the Sales Director" />}
            <Chip kind="k" id="N-2 / OQ-13" note="9 sales order statuses from the page table, not the digest's 8" />
          </>
        }
        sub={
          <p className="text-sm">
            {o.type} order · {c.name} · <span className="tabular">{money(orderValue(o), o.currency)}</span>
          </p>
        }
        actions={
          <>
            {o.status === "Draft" && <Button onClick={onSubmit}>Submit</Button>}
            {o.status === "Confirmed" && hasOpenSched && (
              <Button onClick={onConfirm}>
                Confirm schedule lines ({o.type === "MTS" ? "ATP" : "CTP"})
              </Button>
            )}
            {o.status === "Shipped" && (
              <Button variant="outline" onClick={() => {
                const r = actions.simulateInvoice(o.id)
                if (!r.ok) setErr({ msg: r.error })
              }}>
                Simulate invoice posted (ACC) – dev only
              </Button>
            )}
            {o.status === "Invoiced/Closed" && role === "Controller" && (
              <Button variant="outline" onClick={() => setStub("Reopen of an Invoiced/Closed order is Controller only (R-22). The status it reopens to is not stated in the specification, so this prototype stops here.")}>
                Reopen
              </Button>
            )}
          </>
        }
      />
      {o.status === "Credit Hold" && (
        <div className="mb-4 rounded-lg border border-status-blocked p-4 text-sm">
          Waiting for Finance credit release. Sales roles cannot release credit holds (R-2).{" "}
          <Link className="text-link underline" to="/approvals">
            Open the inbox item{appr ? ` ${appr.id}` : ""}
          </Link>
        </div>
      )}
      {o.status === "Submitted" && appr && (
        <div className="mb-4 rounded-lg border border-status-pending p-4 text-sm">
          Pending approval: {appr.kind} for the {appr.forRoles.join(" / ")}. <Link className="text-link underline" to="/approvals">Open the inbox</Link> <Chip kind="oq" id="OQ-31" />
        </div>
      )}
      {terminal && <p className="mb-4 text-sm text-muted-foreground">This order is {o.status}; it opens read-only{o.status === "Invoiced/Closed" ? ". Only the Controller can reopen it (R-22)" : ""}.</p>}
      {err && (
        <div className="mb-4">
          <ErrorAlert title={err.field === "customer" ? "Order not submitted: customer not Active" : "Action not done"} onDismiss={() => setErr(null)}>
            {err.msg}
          </ErrorAlert>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <dl className="grid grid-cols-3 content-start gap-4">
          <KV k="Customer">
            <span className="flex flex-wrap items-center gap-1">
              {c.name} ({c.id}) <StatusBadge entity="customer" status={c.status} /> {c.creditHold && <Chip kind="hold" />}
            </span>
          </KV>
          <KV k="Customer PO # (required)">
            {o.status === "Draft" ? (
              <>
                <Input
                  id="customerPO"
                  aria-label="Customer PO number"
                  aria-invalid={err?.field === "customerPO"}
                  aria-describedby={err?.field === "customerPO" ? "po-err" : undefined}
                  value={o.customerPO}
                  onChange={(e) => actions.setPO(o.id, e.target.value)}
                  className="h-9"
                />
                {err?.field === "customerPO" && (
                  <span id="po-err" className="text-xs text-destructive">
                    Customer PO # is required (R-7).
                  </span>
                )}
              </>
            ) : (
              o.customerPO || "Not recorded"
            )}
          </KV>
          <KV k="Quotation">{o.quoteRef ? <Link className="text-link underline" to={`/sales/quotations/${o.quoteRef}`}>{o.quoteRef}</Link> : "Direct entry (no quotation)"}</KV>
          <KV k="Order type">{o.type}</KV>
          <KV k="Bill-To">{o.billTo}</KV>
          <KV k="Ship-To">{o.shipTo}</KV>
          <KV k="Requested ship date">{o.requestedShip}</KV>
          <KV k="Incoterms">{o.incoterms}</KV>
          <KV k="Freight terms">{o.freightTerms}</KV>
          <KV k="Carrier">{o.carrier ?? "Not recorded"}</KV>
          <KV k="Billing plan">{o.billingPlan}</KV>
          <KV k="Currency and booked rate">
            {o.currency} · {o.bookedRate}
          </KV>
          <KV k="Created">{o.created}</KV>
          {o.closedOn && <KV k="Closed on">{o.closedOn}</KV>}
          <KV k="Readiness (from deliveries)">
            {deliveries.length === 0 ? (
              <span className="flex flex-wrap gap-1">
                {(["supply", "credit", "quality", "documents"] as const).map((k) => (
                  <FlagPill key={k} name={k} state="not passed" />
                ))}
                <span className="text-xs text-muted-foreground">No delivery yet</span>
              </span>
            ) : (
              deliveries.map((d) => (
                <div key={d.id} className="mb-1">
                  <span className="text-xs">{d.id}</span> <ReadinessFlags flags={d.flags} />
                </div>
              ))
            )}
          </KV>
        </dl>
        <CreditPanel o={o} />
      </div>

      <h2 className="mt-8 mb-2 font-semibold">Lines and schedule lines</h2>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow className="h-8">
            <TableHead>Line</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead>Price source</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Promised</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Line status</TableHead>
            <TableHead>Schedules</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {o.lines.map((l) => {
            const open = expanded[l.no] ?? true
            return (
              <Fragment key={l.no}>
                <TableRow className="h-8 text-[13px]">
                  <TableCell className="tabular">{l.no}</TableCell>
                  <TableCell>
                    {l.item} <span className="text-xs text-muted-foreground">{product(l.item).description}</span>
                  </TableCell>
                  <TableCell className="tabular text-right">{l.qty}</TableCell>
                  <TableCell className="tabular text-right">{money(l.unitPrice, o.currency)}</TableCell>
                  <TableCell>
                    <span className="rounded-md border px-1 text-xs">{l.priceSource}</span>
                    {l.priceSource === "Quotation" && <span className="ml-1 text-xs text-muted-foreground">frozen</span>}
                  </TableCell>
                  <TableCell>{l.requestedShip}</TableCell>
                  <TableCell>{l.promisedShip ?? "Not promised"}</TableCell>
                  <TableCell>{l.warehouse}</TableCell>
                  <TableCell>
                    <StatusBadge entity="soline" status={l.status} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setExpanded({ ...expanded, [l.no]: !open })}>
                      {open ? "Hide" : "Show"} {l.schedules.length}
                    </Button>
                  </TableCell>
                </TableRow>
                {open &&
                  l.schedules.map((s) => (
                    <TableRow key={`${l.no}-${s.no}`} className="h-8 bg-muted/40 text-[13px]">
                      <TableCell />
                      <TableCell colSpan={9}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="font-medium">Schedule {s.no}</span>
                          <StatusBadge entity="schedule" status={s.status} />
                          {s.backorder && <Chip kind="backorder" note="Display only; reallocation is out of scope (R-21)" />}
                          <span className="tabular">
                            req {s.reqQty} on {s.reqDate}
                          </span>
                          <span className="tabular">
                            confirmed {s.confQty ?? "—"} on {s.confDate ?? "—"}
                          </span>
                          <span>constraint: {s.constraint ?? "—"}</span>
                          <span>snapshot: {s.snapshot ?? "—"}</span>
                          <span className="tabular">
                            delivered {s.deliveredQty} · open {openQty(s)}
                          </span>
                          {s.deliveryId && <span>delivery {s.deliveryId}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          Pegging (schedule level) <Chip kind="k" id="K-19" note="Pegs sit on schedule lines; Book I line-level pegs read as schedule 10 (Book IV outranks Book I)" />
        </h2>
        <ul className="text-sm">
          {o.lines.flatMap((l) =>
            l.schedules.map((s) => (
              <li key={`${l.no}-${s.no}`}>
                SO line {l.no} / schedule {s.no}: {s.peg ?? "not pegged"}
              </li>
            )),
          )}
        </ul>
      </section>

      <h2 className="mt-6 mb-2 font-semibold">Activity</h2>
      <ul className="space-y-1 text-sm">
        {[...o.activity].reverse().map((a, i) => (
          <li key={i}>
            <span className="tabular text-muted-foreground">{a.at}</span> · {a.by} · {a.text}
          </li>
        ))}
      </ul>

      <Dialog open={atpOpen} onOpenChange={setAtpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Partial availability (ATP)</DialogTitle>
            <DialogDescription>
              ATP ran per line. {shortfalls.map((s) => `Line ${s.line}: ${s.avail} available of ${s.qty} (${s.item}).`).join(" ")} Choose how to confirm the short quantity. <Chip kind="oq" id="OQ-32" note="Confirm runs on an order that is already Confirmed after credit release" />
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="sr-only">Option</legend>
            {(
              [
                ["later", "Accept later date", "Confirm the full quantity on the later date (Oct 30, 2026, incoming stock from production order)."],
                ["split", "Split line", "Confirm what is available now; a second schedule line takes the rest at the later date with the Backorder flag."],
                ["backorder", "Backorder", "Allocate what is available; the rest stays Open on a backordered schedule line with no confirmed date."],
              ] as const
            ).map(([v, t, d]) => (
              <label key={v} className="flex items-start gap-2 rounded-md border p-2">
                <input type="radio" name="atp" value={v} checked={atpChoice === v} onChange={() => setAtpChoice(v)} className="mt-1" />
                <span>
                  <span className="font-medium">{t}</span>
                  <span className="block text-xs text-muted-foreground">{d}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtpOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const r = actions.confirmATP(o.id, atpChoice)
                setAtpOpen(false)
                if (!r.ok) setErr({ msg: r.error })
                else toast.success("Schedule lines confirmed.")
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {o.ctpSeed && <CtpDialog o={o} open={ctpOpen} onOpenChange={(b) => setSp(b ? { ctp: "1" } : {})} />}
      <Dialog open={!!stub} onOpenChange={() => setStub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not built in this prototype</DialogTitle>
            <DialogDescription>{stub}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <RulesPanel
        rules={[
          ["R-1", "Credit check at conversion, submit, value increase and shipment release: exposure + new order value ≤ limit and no invoice > 30 days past due; failure sets Credit Hold.", "DOC:p.49 §2.2"],
          ["R-2", "Sales roles cannot release credit holds; release, reject and raise-limit live in the Finance queue; raise limit is Controller only.", "DOC:p.49 §2.2; p.176 f13"],
          ["R-5", "Manual orders above $250,000 without a quote need Sales Director approval (R-OM-02); exactly $250,000.00 does not.", "DOC:p.52 §4.1"],
          ["R-6", "Only Active customers on a sales order (E-OM-02).", "DOC:p.52 §4.1; p.249 §4.1"],
          ["R-7", "Customer PO # is mandatory.", "DOC:p.52 §4.1"],
          ["R-8", "Prices copied from the quotation are frozen, Price Source = Quotation.", "DOC:p.51 §3.3"],
          ["R-9", "MTS ATP per line; partial availability offers accept later date, split line, or backorder; confirmed date stores constraint and plan snapshot ID.", "DOC:p.53 §4.3; p.206 §2.1"],
          ["R-10", "Pegging is schedule-level; deliveries consume schedule lines, never raw order lines.", "DOC:p.206 §2.1"],
          ["R-21", "No reallocation control; backorder flags are display only.", "DOC:p.207 §2.2"],
          ["R-22", "Closed orders reopen only by the Controller; terminal records open read-only.", "DOC:p.54 §4.6; p.242 §10.2-10.3"],
          ["R-23", "Detail header carries a status badge and a lifecycle strip.", "DOC:p.242 §10.2"],
        ]}
      />
    </div>
  )
}

export function NewOrder() {
  const { db, actions } = useStore()
  const nav = useNavigate()
  const [customerId, setCustomerId] = useState("")
  const [po, setPo] = useState("")
  const [reqShip, setReqShip] = useState("2026-10-26")
  const [lines, setLines] = useState([{ item: "FIN-TBD-1000PM", qty: 1 }])
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null)
  const mts = PRODUCTS.filter((p) => p.kind === "MTS")
  const c = db.customers.find((x) => x.id === customerId)
  const cad = c?.currency === "CAD"
  const value = lines.reduce((s, l) => s + l.qty * (cad ? Math.round(product(l.item).unitPrice * 1.36) : product(l.item).unitPrice), 0)
  return (
    <div className="max-w-[960px]">
      <h1 className="mb-1 text-xl font-semibold">New direct-entry order</h1>
      <p className="mb-6 text-sm text-muted-foreground">Direct entry exists in this prototype only to show R-5, R-6 and R-7. Prices come from the price list; no pricing simulation.</p>
      {err && (
        <div className="mb-4">
          <ErrorAlert title="Order not created" onDismiss={() => setErr(null)}>
            {err.msg}
          </ErrorAlert>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-1">
          <Label htmlFor="cust">Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger id="cust" className="h-9 w-full" aria-invalid={err?.field === "customer"}>
              <SelectValue placeholder="Choose an Active customer" />
            </SelectTrigger>
            <SelectContent>
              {db.customers.map((x) => (
                <SelectItem key={x.id} value={x.id} disabled={x.status !== "Active"}>
                  <span className="flex items-center gap-2">
                    {x.name} ({x.id}) <StatusBadge entity="customer" status={x.status} />
                    {x.creditHold && <Chip kind="hold" />}
                    {x.status !== "Active" && <span className="text-xs">E-OM-02: only Active customers can be on a sales order</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="po">Customer PO # (required at submit)</Label>
          <Input id="po" className="h-9" value={po} onChange={(e) => setPo(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rs">Requested ship date</Label>
          <Input id="rs" type="date" className="h-9" value={reqShip} onChange={(e) => setReqShip(e.target.value)} />
        </div>
      </div>
      <h2 className="mt-6 mb-2 font-semibold">Lines</h2>
      {lines.map((l, i) => (
        <div key={i} className="mb-2 flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Item, line {(i + 1) * 10}
            <select className="h-9 rounded-md border border-input bg-background px-2" value={l.item} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}>
              {mts.map((p) => (
                <option key={p.item} value={p.item}>
                  {p.item} · {p.description} · {money(cad ? Math.round(p.unitPrice * 1.36) : p.unitPrice, c?.currency ?? "USD")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Qty
            <Input type="number" min={1} className="h-9 w-24" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
          </label>
          {lines.length > 1 && (
            <Button variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
              Remove line {(i + 1) * 10}
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" onClick={() => setLines([...lines, { item: "FIN-TBD-0167PL", qty: 1 }])}>
        Add line
      </Button>
      <p className="mt-4 text-sm">
        Order value: <span className="tabular font-semibold">{money(value, c?.currency ?? "USD")}</span>
        {value > 250000 ? " · above $250,000.00 without a quote: submit will raise a Sales Director item (R-5)" : value === 250000 ? " · exactly $250,000.00: no Sales Director item" : ""}
      </p>
      <div className="mt-6">
        <Button
          onClick={() => {
            const r = actions.createDirectOrder({ customerId, customerPO: po, requestedShip: reqShip || TODAY, lines })
            if (!r.ok) setErr({ msg: r.error, field: r.field })
            else nav(`/sales/orders/${r.value}`)
          }}
        >
          Create draft order
        </Button>
      </div>
      <RulesPanel
        rules={[
          ["R-5", "Manual orders above $250,000 without a quote need Sales Director approval (R-OM-02).", "DOC:p.52 §4.1"],
          ["R-6", "Only Active customers on a sales order (E-OM-02); a Prospect is never selectable.", "DOC:p.52 §4.1; p.249 §4.1"],
          ["R-7", "Customer PO # is mandatory.", "DOC:p.52 §4.1"],
        ]}
      />
    </div>
  )
}
