// SVC-SPF-001 Spares Finder [DOC:pp.253-254 Book VI §5, §5.1] (asserted). Workbench for customer
// service, the service desk and spare parts sales. One search input accepting a transformer serial,
// a customer name or a sales order number. The result header shows the unit from the installed base;
// below it the as-built structure from the trace record as an indented parts list with stock,
// spares price, info-record lead time when not stocked, and a supersession chip. Primary action:
// select lines and create a spares quotation in one step (OM-QT path, serial on every line).
// Postings and scans: none; the downstream quotation, order and delivery carry the money.

import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody } from "@/components/ui/table"
import { DialogShell, PageHeader, WorkbenchPage } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, KV, RulesPanel, SkeletonRows, useFirstVisitLoading, type Column } from "@/components/patterns"
import { materialById } from "@/data/shared/materials"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { listDate, money, product, TODAY, type DB } from "../data/model"
import type { AsBuiltLine, Ib } from "../data/ext-model"
import { createSparesQuote, entitlement, spareAtp, spareFailureLinks } from "../data/ext-actions"
import { A, Reading } from "../components/ext"

const RULES: [string, string, string][] = [
  ["SPF-a", "Resolution order: serial → installed base record → as-built genealogy → current material master state. The list shows what is inside that unit, not the current BOM revision.", "DOC:p.254 §5.1"],
  ["SPF-b", "Supersession: the built part is shown greyed with its identity intact, the successor is the default orderable line.", "DOC:p.254 §5.1"],
  ["SPF-c", "A line with neither stock nor an info-record lead time opens an engineering review task; the quotation cannot issue until it closes (no promise is invented).", "DOC:p.254 §5.1"],
  ["SPF-d", "Hazardous or export-controlled lines need the compliance checklist before the quotation issues.", "DOC:p.254 §5.1"],
  ["SPF-f", "The user may force the original part where stock remains and policy allows (not on a blocked or recalled batch).", "DOC:p.254 §5.1"],
  ["SPF-g", "Before quoting the entitlement service runs: a unit under warranty whose part relates to an open or attributable failure is warned and offered the RMA path instead of a sale.", "DOC:p.254 §5.1"],
  ["SPF-h", "Stocked SPARE materials show ATP; non-stocked lines show the info record lead time.", "DOC:p.254 §5.1"],
  ["SPF-e", "The spares quotation follows the standard OM-QT path with the transformer serial carried on every line.", "DOC:p.253 Book VI"],
]

type Row = AsBuiltLine & { key: string; orderable: string; stock: number; atp?: number; leadWeeks?: number; price: number; review: boolean; canForce: boolean; forced: boolean; forceWhy?: string }

function resolve(db: DB, q: string): { units: Ib[]; how: string } {
  const v = q.trim()
  if (!v) return { units: [], how: "" }
  const up = v.toUpperCase()
  const bySerial = db.ib.filter((i) => i.serial.toUpperCase() === up || i.id.toUpperCase() === up)
  if (bySerial.length) return { units: bySerial, how: "serial" }
  const bySo = db.ib.filter((i) => i.soId?.toUpperCase() === up)
  if (bySo.length) return { units: bySo, how: "sales order" }
  const cust = db.customers.filter((c) => c.name.toLowerCase().includes(v.toLowerCase()) || c.id.toUpperCase() === up)
  return { units: db.ib.filter((i) => cust.some((c) => c.id === i.customerId)), how: "customer" }
}

export function SparesFinder() {
  const db = useSlice("sales")
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const q = sp.get("q") ?? ""
  const sim = sp.get("state")
  const [text, setText] = useState(q)
  const [filter, setFilter] = useState<"all" | "wear" | "safety">("all")
  const [qty, setQty] = useState<Record<string, number>>({})
  const [err, setErr] = useState<string | null>(null)
  const [force, setForce] = useState<Record<string, boolean>>({})
  const [warnFor, setWarnFor] = useState<{ sel: string[]; clear: () => void; warn: string[] } | null>(null)
  const loading = useFirstVisitLoading("SVC-SPF-001")
  const res = useMemo(() => resolve(db, q), [db, q])
  const unitId = sp.get("unit") ?? (res.units.length === 1 ? res.units[0].id : null)
  const ib = unitId ? db.ib.find((i) => i.id === unitId) : undefined
  const rows: Row[] = useMemo(() => {
    if (!ib) return []
    return (db.asBuilt[ib.serial] ?? []).map((l, i) => {
      const key = `${i}`
      // Force the original where stock remains and policy allows (p.254 §5.1); policy: not a blocked batch.
      const origStock = db.spareStock[l.itemId]?.qty ?? 0
      const canForce = !!l.successor && origStock > 0 && !l.forceBlocked
      const forceWhy = !l.successor ? undefined : l.forceBlocked ? l.forceBlocked : origStock > 0 ? undefined : "No stock of the original remains"
      const forced = canForce && !!force[key]
      const orderable = forced ? l.itemId : l.successor ?? l.itemId
      const s = db.spareStock[orderable] ?? { qty: 0 }
      const spare = materialById(orderable)?.type === "SPARE"
      return { ...l, key, orderable, stock: s.qty, atp: spare && s.qty > 0 ? spareAtp(db, orderable).atp : undefined, leadWeeks: s.leadWeeks, price: product(orderable).unitPrice, review: s.qty === 0 && s.leadWeeks == null, canForce, forced, forceWhy }
    })
  }, [db, ib, force])
  const shown = rows.filter((r) => (filter === "wear" ? r.wear : filter === "safety" ? r.safetyCritical : true))
  const search = (v: string) => setSp(v ? { q: v } : {})

  const header = {
    title: "Spares finder",
    screenId: "SVC-SPF-001",
    description: "What is inside this specific unit, and what can be ordered for it today.",
    actions: (
      <>
        <Button variant="outline" disabled={!ib} asChild={!!ib}>
          {ib ? <Link to={`/traceability/explorer?serial=${ib.serial}`}>Open full trace record</Link> : <span>Open full trace record</span>}
        </Button>
        <Button variant="outline" disabled={!ib} onClick={() => window.print()}>
          Print parts list
        </Button>
      </>
    ),
  }
  const searchBar = (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        search(text)
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Serial number, customer name or sales order number
        <Input className="w-96" value={text} onChange={(e) => setText(e.target.value)} placeholder="SN-TBD-20M-0301" />
      </label>
      <Button type="submit" variant="outline">Search</Button>
      <span className="text-xs text-muted-foreground">Try SN-TBD-20M-0301 (the Omaha North unit), SO-2026-00301 or "Lakeshore".</span>
    </form>
  )
  if (sim === "error")
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        <ErrorAlert title="The trace record could not be read" action={<button className="underline" onClick={() => setSp(q ? { q } : {})}>Retry</button>}>
          The as-built genealogy service did not answer. Nothing was created. Retry in a moment.
        </ErrorAlert>
      </div>
    )

  if (loading)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        <Table aria-label="Loading spares finder">
          <TableBody>
            <SkeletonRows cols={6} rows={6} />
          </TableBody>
        </Table>
      </div>
    )
  if (!ib)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        {searchBar}
        {!q ? (
          <EmptyState title="Search a unit">Arrive from a customer, an installed base record or an RMA, or type a serial here.</EmptyState>
        ) : res.units.length === 0 ? (
          <EmptyState title={`Nothing found for "${q}"`}>No installed base record matches that serial, customer or sales order. Units appear here once shipped (PGI).</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm">{res.units.length} units match the {res.how}. Pick one:</p>
            <ul className="flex flex-col gap-1">
              {res.units.map((u) => (
                <li key={u.id}>
                  <button className="flex w-full flex-wrap items-center gap-2 rounded-md border p-2 text-left text-sm" onClick={() => setSp({ q, unit: u.id })}>
                    <span className="font-mono">{u.serial}</span> {product(u.itemId).description} · {u.site.split(",")[0]} <StatusBadge kind="installedBase" status={u.status} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <RulesPanel rules={RULES} />
      </div>
    )

  const ent = entitlement(ib, TODAY, ib.history.find((h) => h.doc?.type === "recall")?.doc?.id)
  const columns: Column<Row>[] = [
    { id: "part", header: "Built part", value: (r) => r.itemId, cell: (r) => (
      <span className={r.level === 2 ? "pl-6" : ""}>
        <span className={r.successor ? "font-mono text-muted-foreground" : "font-mono"}>{r.level === 2 ? "└ " : ""}{r.itemId}</span>
        <span className="block text-xs text-muted-foreground">{product(r.itemId).description}{r.serials ? ` · ${r.serials.join(", ")}` : ""}{r.batch ? ` · batch ${r.batch}` : ""}</span>
      </span>
    ) },
    { id: "orderable", header: "Orderable", value: (r) => r.orderable, cell: (r) => (
      <span className="flex flex-col gap-1">
        <span className="font-mono">{r.orderable}</span>
        {r.successor && !r.forced && <Chip kind="change" note={r.supersessionNote}>Superseded by {r.successor}</Chip>}
        {r.forced && <Chip kind="flag" note={`Successor ${r.successor} not ordered`}>Original forced</Chip>}
        {r.successor && (
          <label className="flex items-center gap-1 text-xs" title={r.forceWhy}>
            <input type="checkbox" checked={r.forced} disabled={!r.canForce} onChange={(e) => setForce({ ...force, [r.key]: e.target.checked })} />
            Order the original{!r.canForce && r.forceWhy ? ` (${r.forceWhy.toLowerCase()})` : ""}
          </label>
        )}
      </span>
    ) },
    { id: "marks", header: "Marking", value: (r) => `${r.wear ? "Wear " : ""}${r.safetyCritical ? "Safety critical " : ""}${r.hazardous ? "Hazardous" : ""}`, cell: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.wear && <Chip kind="flag">Wear part</Chip>}
        {r.safetyCritical && <Chip kind="block">Safety critical</Chip>}
        {r.hazardous && <Chip kind="hold">Hazardous</Chip>}
        {r.exportControlled && <Chip kind="hold">Export controlled</Chip>}
      </span>
    ) },
    { id: "built", header: "Qty in unit", value: (r) => r.qty, align: "right", mono: true },
    { id: "stock", header: "Availability", value: (r) => r.atp ?? r.stock, cell: (r) => (r.atp != null ? `ATP ${r.atp.toLocaleString("en-US")} (on hand ${r.stock.toLocaleString("en-US")})` : r.stock > 0 ? `On hand ${r.stock.toLocaleString("en-US")}` : r.leadWeeks != null ? `Not stocked · lead time ${r.leadWeeks} wk (info record)` : "Not stocked, no lead time: engineering review"), align: "right" },
    { id: "price", header: "Spares price", value: (r) => r.price, cell: (r) => money(r.price), align: "right", mono: true },
    { id: "qty", header: "Order qty", value: (r) => qty[r.key] ?? 0, cell: (r) => (
      <Input aria-label={`Order quantity ${r.orderable}`} type="number" min={0} className="ml-auto h-8 w-20" value={qty[r.key] ?? 1} onChange={(e) => setQty({ ...qty, [r.key]: Number(e.target.value) })} />
    ), align: "right" },
  ]
  const c = db.customers.find((x) => x.id === ib.customerId)
  const quote = (sel: string[], clear: () => void, reason?: string) => {
    const lines = sel.map((k) => rows.find((r) => r.key === k)!).map((r) => ({ itemId: r.orderable, built: r.itemId, serials: r.serials, qty: qty[r.key] ?? 1, price: r.price, engineeringReview: r.review, hazardous: !!r.hazardous || !!r.exportControlled }))
    const res = createSparesQuote(ib.id, lines, reason)
    if (!res.ok) return res.error
    clear()
    toast.success(`${res.value} created in Draft`)
    nav(`/sales/quotations/${res.value}`)
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkbenchPage<Row>
        header={{
          ...header,
          description: `${ib.serial} · ${product(ib.itemId).description}`,
          children: (
            <div className="flex flex-col gap-2">
              {searchBar}
              {err && <ErrorAlert title="Quotation not created" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
            </div>
          ),
        }}
        kpis={[
          { label: "Unit", value: <A to={`/service/installed-base/${ib.id}`}>{ib.serial}</A>, hint: `${c?.name} · ${ib.site.split(",")[0]}` },
          { label: "Commissioned", value: ib.commissioningDate ? listDate(ib.commissioningDate) : "Not captured", hint: `Shipped ${listDate(ib.shipDate)}` },
          { label: "Warranty", value: ent.verdict === "covered" ? "Covered" : ent.verdict === "conditional" ? "Conditional" : "Not covered", hint: `to ${listDate(ent.end)}` },
          { label: "As-built lines", value: rows.length, hint: `${rows.filter((r) => r.successor).length} superseded` },
        ]}
        queues={[
          { id: "all", label: "All parts", count: rows.length },
          { id: "wear", label: "Wear parts", count: rows.filter((r) => r.wear).length },
          { id: "safety", label: "Safety critical", count: rows.filter((r) => r.safetyCritical).length },
        ]}
        queue={filter}
        onQueueChange={(v) => setFilter(v as typeof filter)}
        table={{
          rows: shown, columns, rowId: (r) => r.key,
          empty: { title: "No as-built structure", body: "The trace record holds no genealogy for this serial yet." },
          caption: `As-built structure of ${ib.serial} (trace record)`,
        }}
        bulkActions={(sel, clear) => (
          <>
            <span className="text-xs">
              {sel.length} line(s) · {money(sel.reduce((s, k) => { const r = rows.find((x) => x.key === k)!; return s + r.price * (qty[k] ?? 1) }, 0))}
            </span>
            <Button
              size="sm"
              onClick={() => {
                const warn = sel.flatMap((k) => { const r = rows.find((x) => x.key === k)!; return spareFailureLinks(db, ib, { itemId: r.itemId, orderable: r.orderable, serials: r.serials }).map((x) => `${r.orderable}: ${x.rmaId}, ${x.why}`) })
                if (warn.length) return setWarnFor({ sel, clear, warn })
                quote(sel, clear)
              }}
            >
              Create spares quotation
            </Button>
          </>
        )}
      />
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <KV k="Owner"><A to={`/sales/customers/${ib.customerId}`}>{c?.name}</A></KV>
        <KV k="Sales order">{ib.soId ? <A to={`/sales/orders/${ib.soId}`}>{ib.soId}</A> : "None"}</KV>
      </dl>
      <p className="text-xs text-muted-foreground">
        Select lines with the checkboxes, set quantities, then Create spares quotation. <Reading id="SR-21" note="ATP = on hand less open sales order demand for the SPARE item; the prototype has no scheduled receipts" /> <Reading id="SR-11" note="CAD customers are priced at the USD spares price × 1.36 (FL-09 rate, OQ-42); the PRD says 'active spares price' without a CAD list" />
      </p>
      <RulesPanel rules={RULES} />
      <DialogShell
        open={!!warnFor}
        onOpenChange={(o) => !o && setWarnFor(null)}
        title={`${ib.serial} is under warranty`}
        consequence={`The selected part relates to a failure on this unit: ${warnFor?.warn.join("; ")}. Use the RMA path instead of a sale. Quote anyway only with a reason; it is written on the quotation's trail.`}
        confirmLabel="Quote anyway"
        requireReason
        onConfirm={(reason) => {
          if (!warnFor) return null
          const e = quote(warnFor.sel, warnFor.clear, reason)
          if (!e) setWarnFor(null)
          return e
        }}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant="outline" asChild><Link to={`/sales/rma/new?serial=${ib.serial}`}>Open the RMA path for {ib.serial}</Link></Button>
          <Reading id="SR-20" note="A part relates to a failure when it (or one of its serials) is on an RMA of this unit that is still open, or whose failure was attributed to a Manufacturing Defect or Component Supplier" />
        </div>
      </DialogShell>
    </div>
  )
}
