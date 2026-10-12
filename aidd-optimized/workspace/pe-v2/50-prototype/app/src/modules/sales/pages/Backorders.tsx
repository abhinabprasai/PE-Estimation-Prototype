// OM-BO-001 Backorder Workbench [DOC:p.250 Book VI; fields and rules Book IV §2.2, p.207] (asserted).
// Exception cards per shortage with supply options, priority class columns, and the mass re-promise
// run panel after MRP. Actions: reallocate with dual audit (Sales Director approves in WF-INBOX),
// re-promise, split, substitute per engineering-approved alternates. Postings and scans: none.

import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell, PageHeader, WorkbenchPage } from "@/components/templates"
import { ApprovalButton, Chip, ErrorAlert, KV, RulesPanel, useFirstVisitLoading, type Column } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { listDate, product } from "../data/model"
import {
  applyMassRepromise, backorderRows, donorsFor, massRepromisePlan, optionsFor, proposeReallocation, repromise, splitSchedule, substitute, type BoRow,
} from "../data/ext-actions"
import { A, Reading, Section } from "../components/ext"

const RULES: [string, string, string][] = [
  ["OM-BO-a", "Allocation priority: contractual buffers first, then customer priority class, then requested date, then entry time.", "DOC:p.207 §2.2"],
  ["OM-BO-b", "Reallocating confirmed supply from one order to another needs Sales Director approval and writes an audit entry on both orders.", "DOC:p.207 §2.2"],
  ["OM-BO-c", "Substitution only to engineering-approved alternates; a customer-visible substitution needs Customer service confirmation with the customer.", "DOC:Book I C §3.2"],
  ["OM-BO-d", "The backorder flag stays on while the confirmed date is later than the requested date.", "DOC:p.206 §2.1"],
  ["OM-BO-e", "After an MRP run, a mass re-confirmation proposes new dates for every backordered schedule a supply option covers.", "DOC:p.250 Book VI"],
]

export function BackorderWorkbench() {
  const db = useSlice("sales")
  const [sp, setSp] = useSearchParams()
  const sim = sp.get("state")
  const queue = sp.get("q") ?? "all"
  const loading = useFirstVisitLoading("OM-BO-001")
  const [active, setActive] = useState<string | null>(null)
  const [massOpen, setMassOpen] = useState(false)
  const all = useMemo(() => (sim === "empty" ? [] : backorderRows(db)), [db, sim])
  const plan = useMemo(() => massRepromisePlan(db), [db])
  const cname = (id: string) => db.customers.find((c) => c.id === id)?.name ?? id
  const row = all.find((r) => r.key === active)
  const rows = queue === "all" || queue === "rea" ? all : all.filter((r) => r.kind === queue)
  const header = {
    title: "Backorder workbench",
    screenId: "OM-BO-001",
    description: "Every short schedule line in allocation priority order, with the supply that could cover it.",
    primary: (
      <Button onClick={() => setMassOpen(true)} disabled={!plan.length}>
        Mass re-promise after MRP ({plan.length})
      </Button>
    ),
  }
  if (sim === "error")
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        <ErrorAlert title="Backorders could not be loaded" action={<button className="underline" onClick={() => setSp({})}>Retry</button>}>
          The ATP service did not answer. No promise was changed. Retry in a moment.
        </ErrorAlert>
      </div>
    )

  const columns: Column<BoRow>[] = [
    { id: "rank", header: "Rank", value: (r) => r.rank, sortable: true, align: "right", mono: true },
    { id: "so", header: "Sales order", value: (r) => r.soId, cell: (r) => <A to={`/sales/orders/${r.soId}`}>{r.soId}</A>, mono: true, sortable: true },
    { id: "ls", header: "Line / sched.", value: (r) => `${r.line}/${r.sched}`, mono: true },
    { id: "cust", header: "Customer", value: (r) => cname(r.customerId), className: "max-w-60 truncate", filterable: true },
    { id: "prio", header: "Priority class", value: (r) => r.priority, cell: (r) => (r.buffer ? <span className="flex flex-col gap-1">{r.priority}<Chip kind="flag" note="Contractual customer buffer (Book I A §10.3): allocated before priority class">{r.buffer}</Chip></span> : r.priority), filterable: true, sortable: true },
    { id: "item", header: "Item", value: (r) => r.item, mono: true, filterable: true },
    { id: "open", header: "Open qty", value: (r) => r.openQty, align: "right", mono: true },
    { id: "req", header: "Requested", value: (r) => r.reqDate, cell: (r) => listDate(r.reqDate), sortable: true },
    { id: "conf", header: "Confirmed", value: (r) => r.confDate ?? "", cell: (r) => (r.confDate ? listDate(r.confDate) : "Not confirmed") },
    { id: "status", header: "Schedule status", value: (r) => r.status, cell: (r) => <StatusBadge kind="scheduleLine" status={r.status} size="sm" />, filterable: true },
    { id: "kind", header: "Exception", value: (r) => r.kind, cell: (r) => (
      <span className="flex items-center gap-1">
        <Chip kind="backorder">{r.kind}</Chip>
        {r.atRiskBy != null && <span className="text-xs">supply {r.atRiskBy} d late</span>}
      </span>
    ), filterable: true },
    { id: "act", header: "", value: () => "", cell: (r) => (
      <Button size="sm" variant="outline" onClick={() => setActive(r.key)}>
        Supply options
      </Button>
    ) },
  ]
  const kinds = ["Unconfirmed backorder", "Slipped promise", "At risk"] as const
  const waiting = db.reallocations.filter((x) => x.state === "Waiting for Sales Director").length

  return (
    <>
      <WorkbenchPage<BoRow>
        header={header}
        kpis={[
          { label: "Short schedule lines", value: all.length },
          { label: "Units short", value: all.reduce((s, r) => s + r.openQty, 0) },
          { label: "At risk (supply later than promise)", value: all.filter((r) => r.kind === "At risk").length },
          { label: "Reallocations waiting", value: waiting, hint: "Sales Director decides in the approvals inbox" },
        ]}
        queues={[
          { id: "all", label: "All exceptions", count: all.length },
          ...kinds.map((k) => ({ id: k, label: k, count: all.filter((r) => r.kind === k).length })),
          { id: "rea", label: "Reallocations", count: db.reallocations.length },
        ]}
        queue={queue}
        onQueueChange={(q) => setSp(q === "all" ? {} : { q })}
        table={{
          rows: queue === "rea" ? [] : rows, columns, rowId: (r) => r.key, loading, activeId: active ?? undefined,
          searchText: (r) => `${r.soId} ${r.item} ${cname(r.customerId)}`, searchPlaceholder: "Search order, item, customer",
          empty: queue === "rea" ? { title: "Reallocation log below", body: "Reallocations are listed under the table." } : { title: "No backorders", body: "Every open schedule line is confirmed on time. New shortages arrive from schedule-line backorder flags and MRP run completion." },
          initialSort: { id: "rank", dir: "asc" },
        }}
        panel={{
          open: !!row,
          onOpenChange: (o) => !o && setActive(null),
          title: row ? `${row.soId} line ${row.line} schedule ${row.sched}` : "",
          description: row ? `${row.openQty} × ${row.item} · ${cname(row.customerId)} · priority ${row.priority}` : undefined,
          content: row ? <SupplyPanel row={row} /> : null,
        }}
      />
      <div className="mt-4 flex flex-col gap-4">
        <Reallocations />
        <RulesPanel rules={RULES} />
      </div>
      <DialogShell
        open={massOpen}
        onOpenChange={setMassOpen}
        title="Mass re-promise after MRP run MRP-TBD-1006"
        consequence={`${plan.length} schedule line(s) get a new confirmed quantity and date on the supply shown. Customers see the new promise on their order acknowledgement.`}
        confirmLabel={`Re-confirm ${plan.length}`}
        confirmDisabled={!plan.length}
        wide
        onConfirm={() => {
          const r = applyMassRepromise(plan)
          if (!r.ok) return r.error
          toast.success(`${r.value} schedule line(s) re-confirmed`)
          return null
        }}
      >
        <Table aria-label="Proposed re-confirmations">
          <TableHeader>
            <TableRow>
              <TableHead>Schedule</TableHead>
              <TableHead>Supply</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>New date</TableHead>
              <TableHead>Allocation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.map((p) => (
              <TableRow key={p.key}>
                <TableCell className="font-mono">{p.key}</TableCell>
                <TableCell className="font-mono">{p.ref}</TableCell>
                <TableCell className="tabular text-right">{p.qty}{p.qty < p.open && <span className="block text-xs">of {p.open}; rest split, stays backorder</span>}</TableCell>
                <TableCell>{listDate(p.date)}</TableCell>
                <TableCell className="text-xs">{p.fairShare ? `Fair share: ${p.fairShare.available} free across ${p.fairShare.classOpen} open in ${p.fairShare.tier}, prorated by open quantity` : "Full open quantity"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          Slipped promises are left for a person to decide. <Reading id="SR-8" note="Allocation order and fair share are the PRD's (p.207 §2.2: contractual buffers, then priority class, then requested date, then entry time; fair share within a class prorates by open quantity). Readings: supply is taken from the earliest option first, shares are rounded to whole units by largest remainder, and one supply option is proposed per schedule" />
        </p>
      </DialogShell>
    </>
  )
}

function SupplyPanel({ row }: { row: BoRow }) {
  const db = useSlice("sales")
  const [err, setErr] = useState<string | null>(null)
  const [split, setSplit] = useState<Record<string, string>>({})
  const [cs, setCs] = useState(false)
  const opts = optionsFor(db, row.item)
  const donors = donorsFor(db, row)
  const pending = db.reallocations.find((x) => x.state === "Waiting for Sales Director" && x.receiver.soId === row.soId)
  const run = (r: { ok: boolean; error?: string }, msg: string) => {
    if (!r.ok) setErr(r.error ?? "Not done")
    else {
      setErr(null)
      toast.success(msg)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      {err && (
        <ErrorAlert title="Action not done" onDismiss={() => setErr(null)}>
          {err}
        </ErrorAlert>
      )}
      <dl className="grid grid-cols-2 gap-2">
        <KV k="Requested">{listDate(row.reqDate)}</KV>
        <KV k="Confirmed">{row.confDate ? listDate(row.confDate) : "Not confirmed"}</KV>
        <KV k="Pegged to">{row.peg ?? "Nothing"}</KV>
        <KV k="Item">
          {row.item} · {product(row.item).description}
        </KV>
      </dl>
      <Section title="Supply options">
        {opts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No production order, other-warehouse stock or approved alternate for {row.item}. Reallocate, or wait for the next MRP run.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {opts.map((o) => (
              <li key={o.id} className="flex flex-col gap-2 rounded-md border p-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{o.kind}</span> <span className="font-mono">{o.ref}</span> · {o.free} of {o.qty} free · {listDate(o.date)}
                </span>
                {o.note && <span className="text-xs text-muted-foreground">{o.note}</span>}
                {o.forItem ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={cs} onCheckedChange={(v) => setCs(v === true)} /> Customer service confirmed with the customer
                    </label>
                    <Button size="sm" variant="outline" onClick={() => run(substitute(row.key, o.id, cs), `Substituted with ${o.itemId}`)}>
                      Substitute
                    </Button>
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" disabled={o.free === 0} onClick={() => run(repromise(row.key, o.id), `Re-promised on ${o.ref}`)}>
                      Re-promise all {row.openQty}
                    </Button>
                    <Input aria-label={`Split quantity on ${o.ref}`} className="h-8 w-20" type="number" min={1} value={split[o.id] ?? ""} onChange={(e) => setSplit({ ...split, [o.id]: e.target.value })} />
                    <Button size="sm" variant="outline" disabled={!split[o.id]} onClick={() => run(splitSchedule(row.key, o.id, Number(split[o.id])), `Split: ${split[o.id]} confirmed on ${o.ref}`)}>
                      Split
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Reallocate confirmed supply (dual audit)">
        {pending ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {pending.id}: {pending.qty} × {pending.item} from {pending.donor.soId} line {pending.donor.line}/{pending.donor.sched}, proposed {pending.on}.
            </p>
            <ApprovalButton
              kind="Reallocation of confirmed supply"
              subject={{ type: "salesOrder", id: row.soId }}
              title={`${pending.id}: move ${pending.qty} × ${pending.item} from ${pending.donor.soId} to ${row.soId}`}
              label="Send to Sales Director"
              stay
            />
          </div>
        ) : donors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other order holds allocated stock of {row.item}.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {donors.map((d) => (
              <li key={`${d.soId}/${d.line}/${d.sched}`} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <A to={`/sales/orders/${d.soId}`}>{d.soId}</A> line {d.line}/{d.sched} · {d.qty} allocated · priority {d.priority} · confirmed {d.confDate ? listDate(d.confDate) : "n/a"}
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => run(proposeReallocation(row.key, `${d.soId}/${d.line}/${d.sched}`), "Reallocation proposed: send it to the Sales Director")}>
                  Propose
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">On approval the receiver takes the allocation and the donor goes back to Open with the backorder flag; both orders get the audit entry.</p>
      </Section>
    </div>
  )
}

function Reallocations() {
  const db = useSlice("sales")
  return (
    <Section title={`Reallocation log (${db.reallocations.length})`}>
      {db.reallocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reallocation proposed yet. Open a row's supply options and propose a donor.</p>
      ) : (
        <Table aria-label="Reallocations">
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>From (donor)</TableHead>
              <TableHead>To (receiver)</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Approval</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.reallocations.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.id}</TableCell>
                <TableCell className="font-mono">{r.item}</TableCell>
                <TableCell className="tabular text-right">{r.qty}</TableCell>
                <TableCell>
                  <A to={`/sales/orders/${r.donor.soId}`}>{r.donor.soId}</A> {r.donor.line}/{r.donor.sched}
                </TableCell>
                <TableCell>
                  <A to={`/sales/orders/${r.receiver.soId}`}>{r.receiver.soId}</A> {r.receiver.line}/{r.receiver.sched}
                </TableCell>
                <TableCell>
                  {r.state} <Chip kind="oq" id="OQ-21" note="Reallocation requests have no status list in the specification" />
                  {r.reason && <span className="block text-xs">Reason: {r.reason}</span>}
                </TableCell>
                <TableCell>
                  {r.state === "Waiting for Sales Director" ? (
                    <ApprovalButton kind="Reallocation of confirmed supply" subject={{ type: "salesOrder", id: r.receiver.soId }} title={`${r.id}: move ${r.qty} × ${r.item} from ${r.donor.soId} to ${r.receiver.soId}`} label="Send to Sales Director" stay />
                  ) : (
                    `Decided ${r.decidedOn}`
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  )
}
