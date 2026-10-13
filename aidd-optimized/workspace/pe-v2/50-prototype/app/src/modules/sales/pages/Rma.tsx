// RMA-LIST/CREATE RMA Register and Authorization [DOC:p.253 Book VI; fields and rules Book I A §3.3,
// §3.4, pp.21-27] (asserted). Register with class badges and SLA aging. The create form pulls the
// reference document and fills lines with shipped serials and prices; class RC3 exposes the oil and
// transport fields. Actions: submit for approval (WF-INBOX), print return instructions with barcode,
// email customer, cancel before receipt. Postings and scans: none until receipt (RMA-RECEIPT).

import { RmaApprovalDialog, UnauthorizedLineDialog } from "./fx/RmaDialogs"
import { CreditMemoPanel } from "./fx/CreditMemo"
import { RepairQuotePanel } from "./fx/BillableRepair"
import { useFxState } from "./fx/kit"
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage, PageHeader, WizardPage } from "@/components/templates"
import { ApprovalButton, Chip, ErrorAlert, KV, PostingPreview, RulesPanel, SkeletonRows, useFirstVisitLoading, type Column } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { STATUS, type PostingLine } from "@/data/domain"
import { USERS } from "@/data/shared/users"
import { useCore, useRole, useSlice } from "@/store"
import { listDate, money, product, TODAY, type DB } from "../data/model"
import { EXCLUSIONS, EXPECTED_DISPOSITIONS, QUARANTINE_WAREHOUSES, RMA_CLASSES, RMA_REASONS, REF_TYPES, freightDefault, restockDefault, restockRoleLimit, type ExpectedDisposition, type RefType, type Rma, type RmaClass, type RmaFreight, type RmaReason } from "../data/ext-model"
import { SALEABLE_RETURN_ITEMS } from "../data/ext-seed"
import {
  ageDays, assignRmaOwner, businessDays, cancelRma, recordFreightRecovery, serialWarranty, warrantyDefault, closeShort, createRma, deleteDraftRma, recallRma, referenceLines, reopenRma, resubmitRma, returnableQty, rmaApprovalCtx, rmaGross, rmaNote, rmaSlaBreached, rmaSubmitErrors, rmaValue, userName, type NewRma,
} from "../data/ext-actions"
import { A, ActivityList, Reading, RmaClassBadge, Section, StatPill } from "../components/ext"

export const RMA_RULES: [string, string, string][] = [
  ["V-RMA-01", "Quantity authorized cannot exceed shipped less already returned for the reference line or serial.", "DOC:p.23 §3.4"],
  ["RMA-a", "Reference document required unless Reference Type = No Reference; the No-Reference path credits list price less 20% and an unverified serial makes the warranty Denied pending manual verification.", "DOC:p.22 §3.3"],
  ["RMA-b", "Reason detail is free text of at least 20 characters. RC3 needs oil drained, oil volume, nitrogen blanket and impact recorder.", "DOC:p.22 §3.3"],
  ["RMA-c", "Restocking fee defaults by reason (Customer Convenience 15%, Wrong Item Ordered 10%); freight terms default by reason.", "DOC:p.23 §3.4; p.27 §3.10"],
  ["RMA-d", "Approval: up to $10,000 CS Manager; RC3 or warranty adds the Quality Manager; above $50,000 or goodwill adds the Controller.", "DOC:p.21; p.27 §3"],
  ["RMA-d2", "No Reference: CS Manager approval regardless of value, and Controller approval is mandatory for any credit.", "DOC:p.26 §3.9"],
  ["RMA-d3", "Pending Approval allows Approve, Reject and Recall; Recall returns the RMA to Draft.", "DOC:p.26 §3.8"],
  ["RMA-e", "Customer Service creates; CS Manager cancels until first receipt; Close Short is a supervisor action; Reopen is Controller only within 30 days.", "DOC:p.26 §3.8; p.27 §3.10"],
  ["RMA-g", "Warranty Claim defaults ON when every referenced serial is inside its warranty window, checked by the entitlement service; a manual ON makes adjudication mandatory at disposition.", "DOC:p.23 §3.4.1; p.216 §7.4"],
  ["RMA-h", "Goodwill replacement (out of warranty) adds the Controller to the approval at any value; it posts to 5120 COGS without revenue.", "DOC:p.27 §3.10; p.25 §3.6.1"],
  ["RMA-i", "Restocking fee editable within role limit; above-limit values route to approval. Return warehouse: quarantine-type warehouses only. Owner defaults to the creator.", "DOC:p.23 §3.4.1"],
  ["RMA-j", "Damaged-in-transit with PE freight: Condition = Damaged opens a freight claim (carrier, claim #, amount, status) tracked on Financials; recovery posts DR 1010 / CR 6410.", "DOC:p.27 §3.9"],
  ["RMA-f", "Receipt-to-inspection SLA: 5 business days after receipt; a breach alerts the Quality Manager (alert rules INV 15.11).", "DOC:p.25 §3.6; p.27 §3.10"],
]

const approvalCtx = rmaApprovalCtx
const cname = (db: DB, id: string) => db.customers.find((c) => c.id === id)?.name ?? id

// ============================================================================ register
const CS_USERS = USERS.filter((u) => u.roles.some((x) => x === "Customer service" || x === "Customer Service Manager"))
/** Quick stats pills, exactly the PRD set [DOC:p.22 §3.3]. Which statuses each pill counts is reading SR-9. */
const QUICK: { id: string; label: string; test: (r: Rma) => boolean; tone?: "attention" }[] = [
  { id: "open", label: "Open RMAs", test: (r) => !["Closed", "Rejected", "Cancelled"].includes(r.status) },
  { id: "receipt", label: "Awaiting Receipt", test: (r) => r.status === "Authorized" || r.status === "Partially Received" },
  { id: "inspection", label: "In Inspection", test: (r) => r.status === "Received" || r.status === "In Inspection" },
  { id: "disposition", label: "Pending Disposition", test: (r) => r.status === "Disposition Pending" },
  { id: "credit", label: "Pending Credit", test: (r) => r.status === "Settling" && r.settlement.some((x) => x.template === 19 && !x.done) },
  { id: "sla", label: "Aged > SLA", test: rmaSlaBreached, tone: "attention" },
]
function csv(rows: Rma[], db: DB) {
  const head = ["RMA", "Customer", "Return Class", "Reference", "Lines", "Total Qty", "Expected Value", "Warranty Claim", "Status", "Requested Date", "Received Date", "Age (Days)", "Owner", "Warehouse"]
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const body = rows.map((r) => [r.id, cname(db, r.customerId), r.cls, r.refType === "No Reference" ? "No Reference" : `${r.refType} ${r.refDoc}`, r.lines.length, r.lines.reduce((s, l) => s + l.qtyAuth, 0), rmaValue(r).toFixed(2), r.warranty, r.status, r.requested, r.receivedDate ?? "", ageDays(r.statusSince), userName(r.ownerId), r.warehouse].map(q).join(","))
  return [head.map(q).join(","), ...body].join("\n")
}
export function RmaList() {
  const db = useSlice("sales")
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const sim = sp.get("state")
  const quick = sp.get("quick")
  const loading = useFirstVisitLoading("RMA-LIST")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [wh, setWh] = useState("all")
  const [sel, setSel] = useState<string[]>([])
  const [owner, setOwner] = useState("")
  const [bulkErr, setBulkErr] = useState<string | null>(null)
  const all = sim === "empty" ? [] : db.rmas
  const q = QUICK.find((x) => x.id === quick)
  const rows = all.filter((r) => (!q || q.test(r)) && (!from || r.requested >= from) && (!to || r.requested <= to) && (wh === "all" || r.warehouse === wh))
  const header = {
    title: "RMA register",
    screenId: "RMA-LIST/CREATE",
    description: "Returns from authorization to settlement. Customer Service creates; managers approve per the matrix.",
    actions: (
      <Button variant="outline" asChild>
        <Link to="/sales/rma/receipt">Open return receipt (kiosk)</Link>
      </Button>
    ),
    primary: <Button onClick={() => nav("/sales/rma/new")}>Create RMA</Button>,
  }
  if (sim === "error")
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        <ErrorAlert title="RMAs could not be loaded" action={<button className="underline" onClick={() => setSp({})}>Retry</button>}>
          The returns service did not answer. Nothing was changed. Retry, or open an RMA from global search (Ctrl K).
        </ErrorAlert>
      </div>
    )
  const columns: Column<Rma>[] = [
    { id: "id", header: "RMA #", value: (r) => r.id, sortable: true, mono: true },
    { id: "cust", header: "Customer", value: (r) => cname(db, r.customerId), cell: (r) => <A to={`/sales/customers/${r.customerId}`} className="block max-w-60 truncate">{cname(db, r.customerId)}</A>, filterable: true },
    { id: "cls", header: "Return Class", value: (r) => r.cls, cell: (r) => <RmaClassBadge cls={r.cls} />, filterable: true },
    { id: "ref", header: "Reference Doc", value: (r) => `${r.refType} ${r.refDoc ?? ""}`, cell: (r) => (r.refType === "No Reference" ? "No Reference" : r.refType === "Sales Order" ? <A to={`/sales/orders/${r.refDoc}`} className="font-mono text-xs">{r.refDoc}</A> : <span className="font-mono text-xs">{r.refDoc}</span>) },
    { id: "items", header: "Items / Qty", value: (r) => r.lines.reduce((s, l) => s + l.qtyAuth, 0), cell: (r) => `${r.lines.length} / ${r.lines.reduce((s, l) => s + l.qtyAuth, 0)}`, align: "right", mono: true },
    { id: "value", header: "Expected Value", value: (r) => rmaValue(r), cell: (r) => (r.cls === "RC4" ? "Billable" : money(rmaValue(r))), sortable: true, align: "right", mono: true },
    { id: "war", header: "Warranty Claim", value: (r) => r.warranty, cell: (r) => <StatusBadge kind="warrantyClaim" status={r.warranty} size="sm" />, filterable: true },
    { id: "status", header: "Status", value: (r) => r.status, cell: (r) => <StatusBadge kind="rma" status={r.status} size="sm" />, filterable: true, sortable: true },
    { id: "req", header: "Requested Date", value: (r) => r.requested, cell: (r) => listDate(r.requested), sortable: true },
    { id: "rcv", header: "Received Date", value: (r) => r.receivedDate ?? "", cell: (r) => (r.receivedDate ? listDate(r.receivedDate) : ""), sortable: true },
    { id: "age", header: "Age (Days)", value: (r) => ageDays(r.statusSince), cell: (r) =>
      rmaSlaBreached(r) ? <Chip kind="block" note={`Past the 5-business-day receipt-to-inspection SLA (${businessDays(r.receivedDate!, TODAY)} business days)${r.slaAlert ? `; alert sent to the ${r.slaAlert.to} on ${r.slaAlert.on}` : ""}`}>{ageDays(r.statusSince)}</Chip> : ageDays(r.statusSince), sortable: true, align: "right", mono: true },
    { id: "owner", header: "Owner", value: (r) => userName(r.ownerId), filterable: true },
  ]
  const selected = all.filter((r) => sel.includes(r.id))
  const printable = selected.filter((r) => r.status === "Authorized" || r.status === "Partially Received")
  const exportRows = (list: Rma[]) => {
    const blob = new Blob([csv(list, db)], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `rma-register-${TODAY}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`${list.length} RMA(s) exported`)
  }
  return (
    <ListPage<Rma>
      header={header}
      above={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2" aria-label="Quick stats">
            <StatPill label="All" value={all.length} active={!quick} onClick={() => setSp({})} />
            {QUICK.map((x) => (
              <StatPill key={x.id} label={x.label} value={all.filter(x.test).length} tone={x.tone} active={quick === x.id} onClick={() => setSp({ quick: x.id })} />
            ))}
            <Reading id="SR-9" note="The six pills are the PRD's [DOC:p.22 §3.3]. Which statuses each counts is a reading: Awaiting Receipt = Authorized + Partially Received; In Inspection = Received + In Inspection; Pending Credit = Settling with a credit memo step still open; Aged > SLA = Received past 5 business days" />
          </div>
          <div className="flex flex-wrap items-end gap-2" aria-label="Filters">
            <label className="flex flex-col gap-1 text-xs">Requested from<Input type="date" className="h-8 w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-xs">Requested to<Input type="date" className="h-8 w-40" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-xs">
              Warehouse
              <Select value={wh} onValueChange={setWh}>
                <SelectTrigger className="h-8 w-80" aria-label="Warehouse"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All warehouses</SelectItem>
                  {[...new Set([...QUARANTINE_WAREHOUSES, ...all.map((r) => r.warehouse)])].map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            {(from || to || wh !== "all") && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setWh("all") }}>Clear filters</Button>}
            <span className="text-xs text-muted-foreground">Status, class, customer, warranty flag and owner filter from the column headers.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" aria-label="Bulk actions">
            <span className="text-xs">{sel.length ? `${sel.length} selected` : "Select RMAs for bulk actions"}</span>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="h-8 w-56" aria-label="New owner"><SelectValue placeholder="New owner" /></SelectTrigger>
              <SelectContent>{CS_USERS.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={!sel.length || !owner} onClick={() => {
              const x = assignRmaOwner(sel, owner)
              if (!x.ok) return setBulkErr(x.error)
              setBulkErr(null)
              toast.success(`Owner assigned on ${x.value} RMA(s)`)
              setSel([])
            }}>Assign Owner</Button>
            <Button size="sm" variant="outline" disabled={!printable.length} title={sel.length && !printable.length ? "Return instructions print for Authorized or Partially Received RMAs" : undefined} onClick={() => {
              for (const r of printable) {
                const x = rmaNote(r.id, `Return instructions printed with RMA barcode ${r.id} (Code128) and the quarantine address ${r.warehouse}`)
                if (!x.ok) return setBulkErr(x.error)
              }
              setBulkErr(null)
              toast.success(`Return instructions printed for ${printable.length} RMA(s)${printable.length < sel.length ? `; ${sel.length - printable.length} skipped (not authorized)` : ""}`)
            }}>Print Return Instructions</Button>
            <Button size="sm" variant="outline" onClick={() => exportRows(sel.length ? selected : rows)}>{sel.length ? "Export selected" : "Export"}</Button>
          </div>
          {bulkErr && <ErrorAlert title="Bulk action not done" onDismiss={() => setBulkErr(null)}>{bulkErr}</ErrorAlert>}
          <p className="text-xs text-muted-foreground">
            Statuses: {STATUS.rma.statuses.map((s) => `${s} ${all.filter((r) => r.status === s).length}`).join(" · ")}
          </p>
        </div>
      }
      table={{
        rows, columns, rowId: (r) => r.id, rowHref: (r) => `/sales/rma/${r.id}`, loading, densityKey: "rma-list",
        selectable: true, selected: sel, onSelectedChange: setSel,
        searchText: (r) => `${r.id} ${cname(db, r.customerId)} ${r.refDoc ?? ""} ${r.lines.map((l) => `${l.itemId} ${l.serial ?? ""}`).join(" ")}`,
        searchPlaceholder: "Search RMA, customer, reference, serial",
        empty: { title: "No RMAs yet", body: "Create one from a customer, an invoice, a serial lookup or a POD claim." },
        initialSort: { id: "req", dir: "desc" },
      }}
      below={<RulesPanel rules={RMA_RULES} />}
    />
  )
}

// ============================================================================ create (wizard)
type DraftLine = { key: string; itemId: string; serial?: string; batch?: string; shipped: number; max: number; price: number; pick: boolean; qty: number; expected?: ExpectedDisposition }

function refOptions(db: DB, customerId: string, t: RefType): string[] {
  if (!customerId || t === "No Reference") return []
  const dels = db.deliveries.filter((d) => d.customerId === customerId && d.shipDate)
  if (t === "Sales Order") return [...new Set(dels.map((d) => d.soId))]
  if (t === "Invoice") return dels.map((d) => d.irId).filter(Boolean) as string[]
  const sers = db.serials.filter((s) => dels.some((d) => d.id === s.deliveryId)).map((s) => s.id)
  const ib = db.ib.filter((i) => i.customerId === customerId).map((i) => i.serial)
  return [...new Set([...ib, ...sers])]
}

export function RmaNew() {
  const db = useSlice("sales")
  const [role] = useRole()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const pre = sp.get("serial") ?? sp.get("so") ?? sp.get("invoice") ?? ""
  const preIb = sp.get("serial") ? db.ib.find((i) => i.serial === sp.get("serial")) : undefined
  const [customerId, setCustomerId] = useState(sp.get("customer") ?? preIb?.customerId ?? "")
  const [refType, setRefType] = useState<RefType>(sp.get("serial") ? "Serial Number" : sp.get("so") ? "Sales Order" : sp.get("invoice") ? "Invoice" : "Sales Order")
  const [refDoc, setRefDoc] = useState(pre)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [loadedFor, setLoadedFor] = useState("")
  const [manual, setManual] = useState({ itemId: SALEABLE_RETURN_ITEMS[0] ?? "", serial: "", qty: 1 })
  const [cls, setCls] = useState<RmaClass>(preIb ? "RC3" : "RC1")
  const [reason, setReason] = useState<RmaReason>(preIb ? "Defective — Warranty" : "Wrong Item Shipped")
  const [detail, setDetail] = useState("")
  // Warranty Claim: defaulted ON when every referenced serial is inside its warranty window, through the
  // entitlement service [DOC:p.23 §3.4.1; p.216 §7.4]; the user may switch it manually after that.
  const [warrantyManual, setWarrantyManual] = useState<boolean | null>(null)
  const [goodwill, setGoodwill] = useState(false)
  const [warehouse, setWarehouse] = useState<string>(QUARANTINE_WAREHOUSES[0])
  const { userId } = useCore()
  const [ownerId, setOwnerId] = useState<string>(userId)
  const [freight, setFreight] = useState<RmaFreight>(freightDefault(preIb ? "Defective — Warranty" : "Wrong Item Shipped"))
  const [restock, setRestock] = useState(restockDefault(preIb ? "Defective — Warranty" : "Wrong Item Shipped"))
  const [expectedReturn, setExpectedReturn] = useState("")
  const [rc3, setRc3] = useState({ oilDrained: false, oilGal: 0, nitrogen: false, impactRecorder: false })
  const customers = db.customers.filter((c) => c.status !== "Prospect")

  const loadLines = () => {
    const ref = referenceLines(db, refType, refDoc)
    setLines(ref.map((l, i) => {
      const max = returnableQty(db, l.itemId, l.serial, l.qty)
      return { key: `${i}`, itemId: l.itemId, serial: l.serial, shipped: l.qty, max, price: l.price, pick: false, qty: Math.min(1, max), expected: undefined }
    }))
    setLoadedFor(`${refType}:${refDoc}`)
  }
  const picked = lines.filter((l) => l.pick)
  const autoWarranty = warrantyDefault(db, picked.map((l) => l.serial), refType === "Serial Number" ? refDoc : undefined)
  const warranty = warrantyManual ?? autoWarranty
  const restockLimit = restockRoleLimit(role, reason)
  const gross = picked.reduce((s, l) => s + l.qty * l.price, 0)
  const credit = cls === "RC4" ? 0 : gross * (1 - restock / 100)

  const steps = [
    {
      id: "ref",
      title: "Customer and reference",
      validate: () => (!customerId ? "Pick the customer." : refType !== "No Reference" && !refDoc ? "Pick the reference document, or use Reference Type = No Reference." : null),
      content: (
        <div className="grid max-w-3xl grid-cols-2 gap-4">
          <Field label="Customer" id="rn-cust">
            <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setRefDoc(""); setLines([]) }}>
              <SelectTrigger id="rn-cust"><SelectValue placeholder="Pick a customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.id} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reference type" id="rn-rt">
            <Select value={refType} onValueChange={(v) => { setRefType(v as RefType); setRefDoc(""); setLines([]) }}>
              <SelectTrigger id="rn-rt"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REF_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {refType !== "No Reference" && (
            <Field label={`${refType}`} id="rn-doc">
              <Select value={refDoc} onValueChange={(v) => { setRefDoc(v); setLines([]) }}>
                <SelectTrigger id="rn-doc"><SelectValue placeholder={customerId ? "Pick the document" : "Pick the customer first"} /></SelectTrigger>
                <SelectContent>
                  {refOptions(db, customerId, refType).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          {refType === "No Reference" && (
            <p className="col-span-2 text-sm text-muted-foreground">
              Exception path: credit basis is the list price less 20%; a serial that is not on record makes the warranty claim Denied pending manual verification.
            </p>
          )}
          {db.customers.find((c) => c.id === customerId)?.creditHold && (
            <p className="col-span-2"><Chip kind="hold">Customer on credit hold: the RMA can be created; settlement by credit stays blocked until the hold clears</Chip></p>
          )}
        </div>
      ),
    },
    {
      id: "lines",
      title: "Lines",
      validate: () => {
        if (!picked.length) return "Select at least one line."
        for (const l of picked) {
          if (l.qty < 1) return `${l.itemId}: quantity must be at least 1.`
          if (refType !== "No Reference" && l.qty > l.max) return `V-RMA-01: ${l.itemId}${l.serial ? ` ${l.serial}` : ""} quantity ${l.qty} exceeds shipped less already returned (${l.max}).`
        }
        return null
      },
      content: (
        <div className="flex flex-col gap-4">
          {refType !== "No Reference" ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadLines}>
                Pull lines from {refDoc}
              </Button>
              {loadedFor && <span className="text-xs text-muted-foreground">Shipped items, serials and net prices from {refDoc}.</span>}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Item" id="rn-item">
                <Select value={manual.itemId} onValueChange={(v) => setManual({ ...manual, itemId: v as typeof manual.itemId })}>
                  <SelectTrigger id="rn-item" className="w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SALEABLE_RETURN_ITEMS.map((i) => <SelectItem key={i} value={i}>{i} {product(i).description}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Serial (if any)" id="rn-ser"><Input id="rn-ser" value={manual.serial} onChange={(e) => setManual({ ...manual, serial: e.target.value })} /></Field>
              <Field label="Qty" id="rn-qty"><Input id="rn-qty" type="number" className="w-20" value={manual.qty} onChange={(e) => setManual({ ...manual, qty: Number(e.target.value) })} /></Field>
              <Button variant="outline" onClick={() => setLines([...lines, { key: `m${lines.length}`, itemId: manual.itemId, serial: manual.serial || undefined, shipped: manual.qty, max: manual.qty, price: Math.round(product(manual.itemId).unitPrice * 0.8 * 100) / 100, pick: true, qty: manual.qty }])}>
                Add line
              </Button>
            </div>
          )}
          <Table aria-label="RMA lines">
            <TableHeader>
              <TableRow>
                <TableHead>Return</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Warranty window · install · site</TableHead>
                <TableHead className="text-right">Shipped</TableHead>
                <TableHead className="text-right">Returnable</TableHead>
                <TableHead className="text-right">Qty authorized</TableHead>
                <TableHead className="text-right">Original net price</TableHead>
                <TableHead>Expected disposition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-muted-foreground">{refType === "No Reference" ? "Add the returned items." : "Pull the lines from the reference document."}</TableCell></TableRow>
              ) : (
                lines.map((l, i) => (
                  <TableRow key={l.key}>
                    <TableCell><Checkbox aria-label={`Return ${l.itemId} ${l.serial ?? ""}`} checked={l.pick} disabled={l.max === 0} onCheckedChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, pick: v === true } : x)))} /></TableCell>
                    <TableCell className="font-mono text-xs">{l.itemId}<span className="block font-sans text-muted-foreground">{product(l.itemId).description}</span></TableCell>
                    <TableCell className="font-mono text-xs">{l.serial ?? "None"}</TableCell>
                    <TableCell className="text-xs">
                      {(() => {
                        const w = serialWarranty(db, l.serial, refType === "Serial Number" ? refDoc : undefined)
                        if (!l.serial) return "Not serialized"
                        if (!w) return "No installed base record"
                        return (
                          <span className="flex flex-col">
                            <span>{listDate(w.start)} to {listDate(w.end)} · {w.end >= TODAY && w.verdict !== "not covered" ? "inside" : "outside"}</span>
                            <span className="text-muted-foreground">{w.ib.commissioningDate ? `installed ${listDate(w.ib.commissioningDate)}` : w.ib.podDate ? `delivered ${listDate(w.ib.podDate)}` : "install date not captured"} · {w.ib.site.split(",")[0]}</span>
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="tabular text-right">{l.shipped}</TableCell>
                    <TableCell className="tabular text-right">{l.max}{l.max === 0 && <span className="block text-xs">already returned</span>}</TableCell>
                    <TableCell className="text-right"><Input aria-label="Quantity authorized" type="number" className="ml-auto h-8 w-20" disabled={!l.pick || !!l.serial} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} /></TableCell>
                    <TableCell className="tabular text-right">{money(l.price)}</TableCell>
                    <TableCell>
                      <Select value={l.expected ?? ""} onValueChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, expected: v as ExpectedDisposition } : x)))}>
                        <SelectTrigger aria-label="Expected disposition" className="h-8 w-32"><SelectValue placeholder="Not set" /></SelectTrigger>
                        <SelectContent>{EXPECTED_DISPOSITIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">Expected disposition Repair marks the line customer property: repair and return, received non-valuated (no #17).</p>
        </div>
      ),
    },
    {
      id: "reason",
      title: "Class, reason and terms",
      validate: () => (detail.trim().length < 20 ? "Reason detail: at least 20 characters." : cls === "RC3" && rc3.oilGal <= 0 && rc3.oilDrained ? "RC3: enter the oil volume drained." : null),
      content: (
        <div className="grid max-w-3xl grid-cols-2 gap-4">
          <Field label="Return class" id="rn-cls">
            <Select value={cls} onValueChange={(v) => setCls(v as RmaClass)}>
              <SelectTrigger id="rn-cls"><SelectValue /></SelectTrigger>
              <SelectContent>{RMA_CLASSES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Reason" id="rn-reason">
            <Select value={reason} onValueChange={(v) => { const r = v as RmaReason; setReason(r); setFreight(freightDefault(r)); setRestock(restockDefault(r)) }}>
              <SelectTrigger id="rn-reason"><SelectValue /></SelectTrigger>
              <SelectContent>{RMA_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Reason detail (at least 20 characters)" id="rn-detail" wide>
            <Textarea id="rn-detail" value={detail} onChange={(e) => setDetail(e.target.value)} />
            <span className="text-xs text-muted-foreground">{detail.trim().length} characters</span>
          </Field>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={warranty} onCheckedChange={(v) => { setWarrantyManual(v === true); if (v === true) setGoodwill(false) }} /> Warranty claim</label>
            <span className="text-xs text-muted-foreground">
              {warrantyManual == null
                ? autoWarranty ? "ON by default: every referenced serial is inside its warranty window (entitlement service)." : "OFF by default: not every referenced serial is inside its warranty window, or no serial is referenced."
                : `Set by hand; the entitlement default is ${autoWarranty ? "ON" : "OFF"}.${warranty && !autoWarranty ? " Adjudication is mandatory at disposition." : ""}`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={goodwill} disabled={warranty || cls === "RC4"} onCheckedChange={(v) => setGoodwill(v === true)} /> Goodwill replacement (out of warranty)</label>
            <span className="text-xs text-muted-foreground">Adds the Controller to the RMA approval at any value; the replacement posts to 5120 COGS (#23).</span>
          </div>
          <Field label="Return warehouse (quarantine only)" id="rn-wh">
            <Select value={warehouse} onValueChange={setWarehouse}>
              <SelectTrigger id="rn-wh"><SelectValue /></SelectTrigger>
              <SelectContent>{QUARANTINE_WAREHOUSES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
            </Select>
            <Reading id="SR-18" note="Quarantine warehouses are design values: the shared warehouse master has no warehouse type yet (FR-14)" />
          </Field>
          <Field label="Owner" id="rn-owner">
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger id="rn-owner"><SelectValue /></SelectTrigger>
              <SelectContent>{[...new Set([ownerId, ...CS_USERS.map((u) => u.id)])].map((u) => <SelectItem key={u} value={u}>{userName(u)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Freight terms (defaulted by reason)" id="rn-fr">
            <Select value={freight} onValueChange={(v) => setFreight(v as RmaFreight)}>
              <SelectTrigger id="rn-fr"><SelectValue /></SelectTrigger>
              <SelectContent>{(["PE Pays", "Customer Pays", "Third Party"] as const).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Restocking fee % (defaulted by reason)" id="rn-rs">
            <Input id="rn-rs" type="number" min={0} max={100} value={restock} onChange={(e) => setRestock(Number(e.target.value))} />
            <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Your limit as {role}: {restockLimit}%.
              {restock > restockLimit && <Chip kind="flag">Above limit: the CS Manager approves the fee on the RMA approval</Chip>}
              <Reading id="SR-17" note="Role limits are not stated: Customer service up to the reason's policy default, Customer Service Manager up to 25%. Above the limit the fee routes to the CS Manager on the RMA approval" />
            </span>
          </Field>
          <Field label="Expected return date" id="rn-erd"><Input id="rn-erd" type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} /></Field>
          {cls === "RC3" && (
            <fieldset className="col-span-2 grid grid-cols-2 gap-4 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">RC3 oil and transport</legend>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={rc3.oilDrained} onCheckedChange={(v) => setRc3({ ...rc3, oilDrained: v === true })} /> Oil drained before transport</label>
              <Field label="Oil volume (US gal)" id="rn-oil"><Input id="rn-oil" type="number" value={rc3.oilGal} onChange={(e) => setRc3({ ...rc3, oilGal: Number(e.target.value) })} /></Field>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={rc3.nitrogen} onCheckedChange={(v) => setRc3({ ...rc3, nitrogen: v === true })} /> Nitrogen blanket</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={rc3.impactRecorder} onCheckedChange={(v) => setRc3({ ...rc3, impactRecorder: v === true })} /> Impact recorder fitted</label>
            </fieldset>
          )}
        </div>
      ),
    },
    {
      id: "review",
      title: "Review",
      content: (
        <div className="flex max-w-3xl flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4">
            <KV k="Customer">{cname(db, customerId)}</KV>
            <KV k="Reference">{refType === "No Reference" ? "No Reference" : `${refType} ${refDoc}`}</KV>
            <KV k="Class">{RMA_CLASSES.find((c) => c.id === cls)?.label}</KV>
            <KV k="Reason">{reason}</KV>
            <KV k="Lines">{picked.length} ({picked.reduce((s, l) => s + l.qty, 0)} units)</KV>
            <KV k="Credit value">{cls === "RC4" ? "Billable repair: no credit" : `${money(credit)} (gross ${money(gross)}, restocking ${restock}%)`}</KV>
            <KV k="Warranty claim">{warranty ? "Yes" : "No"}{goodwill ? " · goodwill replacement (Controller approves)" : ""}</KV>
            <KV k="Return warehouse">{warehouse}</KV>
            <KV k="Owner">{userName(ownerId)}</KV>
          </dl>
          <PostingPreview title="Postings" lines={[{ template: 17, amount: null, notPostedReason: "Nothing posts at authorization; #17 posts at receipt when ownership returns" }]} />
          {role !== "Customer service" && role !== "Customer Service Manager" && (
            <ErrorAlert title="Customer Service creates RMAs">You are acting as {role}. Switch "Acting as" to Customer service to finish.</ErrorAlert>
          )}
        </div>
      ),
    },
  ]

  return (
    <WizardPage
      header={{ title: "Create RMA", screenId: "RMA-LIST/CREATE", crumbs: [{ label: "RMA register", to: "/sales/rma" }, { label: "Create" }], description: "Pull the reference document, choose lines, then submit for approval from the RMA." }}
      steps={steps}
      finishLabel="Create RMA in Draft"
      consequence="The RMA is created in Draft. Submitting it for approval is the next step, on the RMA."
      onCancel={() => nav("/sales/rma")}
      onFinish={() => {
        const f: NewRma = {
          customerId, cls, refType, refDoc: refType === "No Reference" ? undefined : refDoc, warranty, goodwill: goodwill && !warranty, warehouse, ownerId, reason, reasonDetail: detail, freight, restockPct: restock, expectedReturn: expectedReturn || undefined,
          rc3: cls === "RC3" ? rc3 : undefined, ibId: preIb?.id ?? (refType === "Serial Number" ? db.ib.find((i) => i.serial === refDoc)?.id : undefined),
          lines: picked.map((l) => ({ itemId: l.itemId, serial: l.serial, batch: l.batch, qtyAuth: l.qty, origPrice: l.price, expected: l.expected, maxQty: refType === "No Reference" ? undefined : l.max })),
        }
        const r = createRma(f)
        if (!r.ok) return r.error
        toast.success(`${r.value} created in Draft`)
        nav(`/sales/rma/${r.value}`)
        return null
      }}
    />
  )
}

function Field({ label, id, children, wide }: { label: string; id: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 flex flex-col gap-1" : "flex flex-col gap-1"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

// ============================================================================ detail
export function RmaDetail() {
  const { id = "" } = useParams()
  const db = useSlice("sales")
  const [role] = useRole()
  const nav = useNavigate()
  const loading = useFirstVisitLoading(`rma-${id}`)
  const [err, setErr] = useState<string | null>(null)
  const [dlg, setDlg] = useState<"cancel" | "short" | "reopen" | "delete" | "recall" | null>(null)
  const [apprDlg, setApprDlg] = useState(false)
  const [unDlg, setUnDlg] = useState(false)
  const r = db.rmas.find((x) => x.id === id)
  const ib = useMemo(() => (r?.ibId ? db.ib.find((i) => i.id === r.ibId) : r?.lines.map((l) => db.ib.find((i) => i.serial === l.serial)).find(Boolean)), [db, r])
  if (!r) return <ErrorAlert title="RMA not found">No RMA {id} in this prototype. Open the RMA register.</ErrorAlert>
  if (loading)
    return (
      <Table aria-label="Loading RMA">
        <TableBody>
          <SkeletonRows cols={5} rows={6} />
        </TableBody>
      </Table>
    )
  const run = (res: { ok: boolean; error?: string }, msg: string) => {
    if (!res.ok) setErr(res.error ?? "Not done")
    else {
      setErr(null)
      toast.success(msg)
    }
  }
  const submitErrs = rmaSubmitErrors(r)
  const c = db.customers.find((x) => x.id === r.customerId)
  const toDisp = ["Received", "In Inspection", "Disposition Pending", "Settling"].includes(r.status)
  const primary =
    r.status === "Draft" && r.recalledReq ? (
      <Button disabled={submitErrs.length > 0} title={submitErrs.join(" ") || undefined} onClick={() => run(resubmitRma(r.id), `${r.id} resubmitted on ${r.recalledReq}`)}>Resubmit for approval</Button>
    ) : r.status === "Draft" ? (
      <ApprovalButton kind="RMA approval" subject={{ type: "rma", id: r.id }} title={`${r.id} ${r.cls} ${r.reason}, ${c?.name}`} amount={rmaValue(r)} ctx={approvalCtx(r)} label="Submit for approval" variant="default" disabled={submitErrs.length > 0} disabledReason={submitErrs.join(" ")} stay />
    ) : r.status === "Pending Approval" ? (
      <ApprovalButton kind="RMA approval" subject={{ type: "rma", id: r.id }} title={r.id} amount={rmaValue(r)} ctx={approvalCtx(r)} />
    ) : r.status === "Authorized" ? (
      <Button onClick={() => run(rmaNote(r.id, `Return instructions printed with RMA barcode ${r.id} (Code128) and the quarantine address ${r.warehouse}`), "Return instructions printed")}>Print return instructions</Button>
    ) : r.status === "Partially Received" ? (
      <Button asChild><Link to={`/sales/rma/receipt?rma=${r.id}`}>Receive the rest</Link></Button>
    ) : toDisp ? (
      <Button asChild><Link to={`/sales/rma/${r.id}/disposition`}>Open inspection and disposition</Link></Button>
    ) : r.status === "Closed" && role === "Controller" ? (
      <Button onClick={() => setDlg("reopen")}>Reopen</Button>
    ) : undefined

  return (
    <>
      <DetailPage
        header={{
          title: r.id,
          screenId: "RMA-LIST/CREATE",
          crumbs: [{ label: "RMA register", to: "/sales/rma" }, { label: r.id }],
          description: `${c?.name ?? r.customerId} · ${r.reason}`,
          chips: (
            <>
              <RmaClassBadge cls={r.cls} />
              <span className="inline-flex items-center gap-1 text-xs">Warranty claim <StatusBadge kind="warrantyClaim" status={r.warranty} size="sm" /></span>
              {r.recallId && <Chip kind="flag" note="Raised by a recall campaign">Recall {r.recallId}</Chip>}
              {rmaSlaBreached(r) && <Chip kind="block" note={r.slaAlert ? `Alert sent to the ${r.slaAlert.to} on ${r.slaAlert.on}` : undefined}>Inspection SLA breached{r.slaAlert ? ", Quality Manager alerted" : ""}</Chip>}
              {r.refType === "No Reference" && r.cls !== "RC4" && <Reading id="SR-15" note="No Reference: the Controller step is added to the RMA approval through the shared route's goodwill flag, because the route has no no-reference flag yet (FR-12). The PRD rule itself is asserted [DOC:p.26 §3.9]" />}
              {r.recalledReq && <Chip kind="flag" note="The shared engine cannot withdraw a request yet (FR-11); a decision on it while the RMA is Draft does not apply">Recalled; {r.recalledReq} still open</Chip>}
              {c?.creditHold && <Chip kind="hold">Customer credit hold</Chip>}
            </>
          ),
          actions: (
            <>
              {r.status === "Draft" && <Button variant="ghost" onClick={() => setDlg("delete")}>Delete draft</Button>}
              {r.status === "Pending Approval" && <Button variant="outline" onClick={() => setApprDlg(true)}>Approve or reject</Button>}
              {r.status === "Pending Approval" && <Button variant="outline" onClick={() => setDlg("recall")}>Recall to Draft</Button>}
              {r.lines.some((l) => l.unauthorized) && <Button variant="outline" onClick={() => setUnDlg(true)}>Unauthorized-line decision</Button>}
              <Button variant="ghost" asChild><Link to="/sales/dialogs/rma-actions">All RMA actions</Link></Button>
              {r.status === "Authorized" && (
                <>
                  <Button variant="outline" onClick={() => run(rmaNote(r.id, `Return instructions emailed to the customer's primary contact with barcode ${r.id}`), "Customer emailed")}>Email customer</Button>
                  <Button variant="outline" asChild><Link to={`/sales/rma/receipt?rma=${r.id}`}>Receive (kiosk)</Link></Button>
                  <Button variant="outline" onClick={() => setDlg("cancel")}>Cancel RMA</Button>
                </>
              )}
              {r.status === "Partially Received" && <Button variant="outline" onClick={() => setDlg("short")}>Close short</Button>}
              {(r.status === "Settling" || r.status === "Closed") && <Button variant="outline" asChild><Link to={`/sales/rma/${r.id}/disposition`}>Disposition and settlement</Link></Button>}
            </>
          ),
          primary,
        }}
        status={{ kind: "rma", value: r.status }}
        doc={{ type: "rma", id: r.id }}
        summary={
          <>
            <KV k="Credit value">{r.cls === "RC4" ? "Billable repair" : `${money(rmaValue(r))} (gross ${money(rmaGross(r))}, restocking ${r.restockPct}%)`}</KV>
            <KV k="Reference">{r.refType === "No Reference" ? "No Reference" : r.refType === "Sales Order" ? <A to={`/sales/orders/${r.refDoc}`}>{r.refDoc}</A> : `${r.refType} ${r.refDoc}`}</KV>
            <KV k="Installed base">{ib ? <A to={`/service/installed-base/${ib.id}`}>{ib.id}</A> : "None"}</KV>
            <KV k="In status">{ageDays(r.statusSince)} days (since {r.statusSince})</KV>
          </>
        }
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: <RmaOverview r={r} db={db} err={err} onDismiss={() => setErr(null)} submitErrs={submitErrs} />,
          },
          {
            id: "lines",
            label: "Lines",
            count: r.lines.length,
            content: (
              <Table aria-label="RMA lines">
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Serial / batch</TableHead>
                    <TableHead className="text-right">Authorized</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Inspected</TableHead>
                    <TableHead className="text-right">Disposed</TableHead>
                    <TableHead className="text-right">Original net price</TableHead>
                    <TableHead className="text-right">Return value</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Line status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.lines.map((l) => {
                    const inspected = ["Disposition Pending", "Settling", "Closed"].includes(r.status) ? l.qtyRecd : 0
                    const disposed = r.settlement.some((x) => x.line === l.no) && r.settlement.filter((x) => x.line === l.no).every((x) => x.done) ? l.qtyRecd : 0
                    const lineStatus = disposed ? `Disposed: ${l.disposition}` : l.disposition && inspected ? `Disposition ${l.disposition} proposed` : l.qtyRecd >= l.qtyAuth && l.qtyRecd > 0 ? "Received" : l.qtyRecd > 0 ? `Open ${l.qtyAuth - l.qtyRecd}` : "Awaiting receipt"
                    return (
                      <TableRow key={l.no}>
                        <TableCell className="tabular">{l.no}</TableCell>
                        <TableCell className="font-mono text-xs">{l.itemId}<span className="block font-sans text-muted-foreground">{product(l.itemId).description}</span></TableCell>
                        <TableCell className="font-mono text-xs">
                          {l.serial ?? l.batch ?? "None"}
                          {l.unverifiedSerial && <Chip kind="block">Unverified serial</Chip>}
                          {l.unauthorized && <Chip kind="flag">Unauthorized return</Chip>}
                          {l.customerProperty && <span className="block font-sans">Customer property</span>}
                        </TableCell>
                        <TableCell className="tabular text-right">{l.qtyAuth}</TableCell>
                        <TableCell className="tabular text-right">{l.qtyRecd}</TableCell>
                        <TableCell className="tabular text-right">{inspected}</TableCell>
                        <TableCell className="tabular text-right">{disposed}</TableCell>
                        <TableCell className="tabular text-right">{money(l.origPrice)}</TableCell>
                        <TableCell className="tabular text-right">{r.cls === "RC4" ? "Billable" : money(l.qtyAuth * l.origPrice * (1 - r.restockPct / 100))}</TableCell>
                        <TableCell>{l.expected ?? "Not set"}</TableCell>
                        <TableCell className="text-xs">{lineStatus}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ),
          },
          {
            id: "receipts",
            label: "Receipts",
            count: r.receipts.length,
            content: r.receipts.length ? (
              <div className="flex flex-col gap-4">
                {r.receipts.map((x) => (
                  <Section key={x.id} title={`${x.id} · ${listDate(x.date)} · ${x.by}`}>
                    <ul className="text-sm">
                      {x.lines.map((l, i) => (
                        <li key={i}>Line {l.line} × {l.qty} · {l.condition}{l.serial && ` · ${l.serial}`}{l.bin && ` · bin ${l.bin}`}{l.photo && ` · photo ${l.photo}`}</li>
                      ))}
                    </ul>
                    <PostingPreview title="Posted at receipt" lines={[x.posted17 ? { template: 17, amount: x.posted17, detail: "Quantity × valuation at original issue" } : { template: 17, amount: null, notPostedReason: "Customer property: non-valuated receipt" }]} />
                  </Section>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing received yet. Receipts are posted at the return receipt kiosk (SP-19).</p>
            ),
          },
          {
            id: "inspection",
            label: "Inspection",
            content: <RmaInspection r={r} />,
          },
          {
            id: "financials",
            label: "Financials",
            content: <RmaFinancials r={r} role={role} />,
          },
          {
            id: "documents",
            label: "Documents",
            content: <RmaDocuments r={r} />,
          },
          { id: "activity", label: "Activity", content: <ActivityList items={r.activity} /> },
        ]}
        defaultTab="overview"
        aside={<RulesPanel rules={RMA_RULES} />}
      />
      <RmaApprovalDialog rma={r} open={apprDlg} onOpenChange={setApprDlg} />
      <UnauthorizedLineDialog rma={r} open={unDlg} onOpenChange={setUnDlg} />
      <DialogShell
        open={dlg === "cancel"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Cancel ${r.id}`}
        consequence="The RMA ends as Cancelled. The customer can no longer ship against this barcode. Allowed until the first receipt (CS Manager)."
        confirmLabel="Cancel RMA"
        destructive
        requireReason
        onConfirm={(reason) => {
          const x = cancelRma(r.id, reason)
          return x.ok ? null : x.error
        }}
      />
      <DialogShell
        open={dlg === "short"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Close ${r.id} short`}
        consequence="The open remainder is cancelled and the RMA moves to Received with what has arrived. Supervisor action."
        confirmLabel="Close short"
        requireReason
        onConfirm={(reason) => {
          const x = closeShort(r.id, reason)
          return x.ok ? null : x.error
        }}
      />
      <DialogShell
        open={dlg === "reopen"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Reopen ${r.id}`}
        consequence="The RMA goes back to Disposition Pending. Controller only, within 30 days of closing."
        confirmLabel="Reopen"
        requireReason
        onConfirm={(reason) => {
          const x = reopenRma(r.id, reason)
          return x.ok ? null : x.error
        }}
      />
      <DialogShell
        open={dlg === "recall"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Recall ${r.id} from approval`}
        consequence="The RMA goes back to Draft so Customer Service can change it. A decision taken on the open request while it is Draft does not apply; resubmit to continue."
        confirmLabel="Recall to Draft"
        requireReason
        onConfirm={(reason) => {
          const x = recallRma(r.id, reason)
          return x.ok ? null : x.error
        }}
      />
      <DialogShell
        open={dlg === "delete"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Delete draft ${r.id}`}
        consequence="The draft is removed. Nothing was authorized or posted."
        confirmLabel="Delete draft"
        destructive
        onConfirm={() => {
          const x = deleteDraftRma(r.id)
          if (!x.ok) return x.error
          nav("/sales/rma")
          return null
        }}
      />
    </>
  )
}

// ============================================================================ detail tabs [DOC:p.26 §3.7]
const linkTo = (d: { type: string; id: string }, rmaId: string) =>
  d.type === "salesOrder" ? `/sales/orders/${d.id}` : d.type === "quotation" ? `/sales/quotations/${d.id}` : d.type === "installedBase" ? `/service/installed-base/${d.id}` : d.type === "scar" ? `/quality/scar/${d.id}` : `/sales/rma/${rmaId}/disposition`

function RmaOverview({ r, db, err, onDismiss, submitErrs }: { r: Rma; db: DB; err: string | null; onDismiss: () => void; submitErrs: string[] }) {
  // Status timeline from the immutable trail: every entry that moved the status.
  const timeline = [{ at: r.requested, text: "Draft (created)" }, ...r.activity.filter((a) => /Status /.test(a.text)).map((a) => ({ at: a.at, text: a.text.slice(a.text.indexOf("Status ")).replace(/\.$/, "") }))]
  const credits = r.settlement.filter((x) => x.template === 19 && x.done).map((x) => x.label.match(/CMR-TBD-\d+/)?.[0]).filter(Boolean) as string[]
  const chips: { label: string; to?: string }[] = [
    ...(r.refType === "Invoice" && r.refDoc ? [{ label: `Invoice ${r.refDoc}` }] : []),
    ...(r.refType === "Sales Order" && r.refDoc ? [{ label: `Sales order ${r.refDoc}`, to: `/sales/orders/${r.refDoc}` }] : []),
    ...credits.map((c) => ({ label: `Credit note request ${c}` })),
    ...r.linked.map((d) => ({ label: `${d.type === "reworkOrder" ? "Rework order" : d.type === "salesOrder" ? "Replacement SO" : d.type === "ncr" ? "NCR" : d.type === "scar" ? "SCAR" : d.type === "quotation" ? "Service quote" : d.type} ${d.id}`, to: d.type === "ncr" ? undefined : linkTo(d, r.id) })),
    ...(r.recallId ? [{ label: `Recall ${r.recallId}` }] : []),
  ]
  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorAlert title="Action not done" onDismiss={onDismiss}>{err}</ErrorAlert>}
      {r.status === "Draft" && submitErrs.length > 0 && <ErrorAlert title="Not ready to submit">{submitErrs.join(" ")}</ErrorAlert>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Header">
          <dl className="flex flex-col gap-2">
            <KV k="Customer"><A to={`/sales/customers/${r.customerId}`}>{cname(db, r.customerId)}</A></KV>
            <KV k="Reason">{r.reason}</KV>
            <KV k="Detail">{r.reasonDetail}</KV>
            <KV k="Requested">{listDate(r.requested)} · owner {userName(r.ownerId)}</KV>
            <KV k="Return to">{r.warehouse}</KV>
            <KV k="Freight terms">{r.freight}{r.carrier && ` · ${r.carrier}`}</KV>
            <KV k="Expected return">{r.expectedReturn ? listDate(r.expectedReturn) : "Not set"}</KV>
            <KV k="Restocking fee">{r.restockPct}%{r.restockAboveLimit && <Chip kind="flag" note="Reading SR-17">Above the {r.restockAboveLimit.role} limit of {r.restockAboveLimit.limit}%: CS Manager approves</Chip>}</KV>
            {r.goodwill && <KV k="Goodwill">Goodwill replacement (out of warranty){r.goodwillDecision ? `: Controller ${r.goodwillDecision.outcome.toLowerCase()} (${r.goodwillDecision.requestId})` : ": Controller approval required"}</KV>}
            {r.rc3 && (
              <KV k="RC3 oil and transport">
                Oil drained {r.rc3.oilDrained ? `yes (${r.rc3.oilGal} US gal)` : "no"} · nitrogen blanket {r.rc3.nitrogen ? "yes" : "no"} · impact recorder {r.rc3.impactRecorder ? "yes" : "no"}
              </KV>
            )}
            {r.cancelReason && <KV k="Cancel reason">{r.cancelReason}</KV>}
          </dl>
        </Section>
        <div className="flex flex-col gap-4">
          <Section title="Status timeline">
            <ol className="flex flex-col gap-1 border-l pl-3 text-sm" aria-label="Status timeline">
              {timeline.map((t, i) => (
                <li key={i}><span className="tabular text-xs text-muted-foreground">{listDate(t.at)}</span> {t.text}</li>
              ))}
            </ol>
          </Section>
          <Section title="Linked documents">
            {chips.length ? (
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (c.to ? <Button key={c.label} variant="outline" size="sm" asChild><Link to={c.to}>{c.label}</Link></Button> : <span key={c.label} className="rounded-md border px-2 py-1 text-xs">{c.label}</span>))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No credit note, rework order, replacement order, NCR or SCAR yet.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function RmaInspection({ r }: { r: Rma }) {
  if (!r.findings && !r.adjudication && !r.attributable)
    return <p className="text-sm text-muted-foreground">No inspection results yet. Inspection runs on the disposition screen after receipt. <A to={`/sales/rma/${r.id}/disposition`}>Open inspection and disposition</A></p>
  const exc = EXCLUSIONS.find((x) => x.code === r.adjudication?.exclusion)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Inspection results">
        <dl className="flex flex-col gap-2">
          <KV k="Findings">{r.findings ?? "Not recorded"}</KV>
          <KV k="Failure attributable to">{r.attributable ?? "Not set"}</KV>
          <KV k="Photographs">{r.inspectionPhotos?.length ? r.inspectionPhotos.join(", ") : "None attached"}</KV>
          {r.ncrId && <KV k="NCR">{r.ncrId}</KV>}
        </dl>
      </Section>
      <Section title="Warranty adjudication">
        <dl className="flex flex-col gap-2">
          <KV k="Verdict">{r.adjudication ? `${r.adjudication.verdict} · ${r.adjudication.by} · ${listDate(r.adjudication.on)}` : "Not adjudicated"}</KV>
          <KV k="Justification">{r.adjudication?.justification || "None"}</KV>
          <KV k="Exclusion">{exc ? `${exc.code} ${exc.category}: ${exc.text}` : "None cited"}</KV>
        </dl>
      </Section>
      {r.teardown && Object.keys(r.teardown).length > 0 && (
        <Section title="Teardown checklist" className="lg:col-span-2">
          <dl className="grid gap-2 md:grid-cols-2">
            {Object.entries(r.teardown).map(([k, v]) => <KV key={k} k={k}>{v || "Empty"}</KV>)}
          </dl>
        </Section>
      )}
    </div>
  )
}

function RmaFinancials({ r, role }: { r: Rma; role: string }) {
  const fxst = useFxState()
  const [amt, setAmt] = useState(r.freightClaim?.amount ?? 0)
  const [err, setErr] = useState<string | null>(null)
  const gross = rmaGross(r)
  const expected = rmaValue(r)
  const actual = r.settlement.filter((x) => x.template === 19 && x.done).reduce((s, x) => s + (x.amount ?? 0), 0)
  const fee = r.cls === "RC4" ? 0 : gross * (r.restockPct / 100)
  const freight = r.settlement.filter((x) => x.template === 26).reduce((s, x) => s + (x.amount ?? 0), 0)
  const repair = r.settlement.filter((x) => x.template === 21 || x.template === 22)
  const gl: PostingLine[] = [
    ...r.receipts.map((x) => (x.posted17 ? { template: 17 as const, amount: x.posted17, detail: `${x.id} return receipt` } : { template: 17 as const, amount: null, notPostedReason: `${x.id}: customer property, non-valuated` })),
    ...r.settlement.filter((x) => x.template && x.done).map((x) => ({ template: x.template!, amount: x.amount, detail: `${x.id} line ${x.line}: ${x.detail}`, notPostedReason: x.amount == null ? x.detail : undefined })),
  ]
  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorAlert title="Action not done" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
      <dl className="grid gap-4 md:grid-cols-3">
        <KV k="Expected credit">{r.cls === "RC4" ? "Billable repair: no credit" : money(expected)}</KV>
        <KV k="Actual credit (credit notes posted)">{money(actual)}</KV>
        <KV k="Restocking fee (4910)">{money(fee)} ({r.restockPct}%)</KV>
        <KV k="Repair cost">{repair.length ? `${repair.map((x) => x.doc?.id ?? x.id).join(", ")}: accumulates on the rework order, settles at close (#${repair[0].template})` : "No rework order"}</KV>
        <KV k="Freight charges">{freight ? money(freight) : "None"}</KV>
        <KV k="Freight claim">
          {r.freightClaim ? `${r.freightClaim.carrier} · ${r.freightClaim.claimNo} · ${money(r.freightClaim.amount)} · ${r.freightClaim.status}${r.freightClaim.recoveredOn ? ` ${listDate(r.freightClaim.recoveredOn)}` : ""}` : "None"}
        </KV>
      </dl>
      {r.freightClaim && r.freightClaim.status !== "Recovered" && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3 text-sm">
          <label className="flex flex-col gap-1 text-xs">Amount received from the carrier<Input type="number" className="h-8 w-40" value={amt} onChange={(e) => setAmt(Number(e.target.value))} /></label>
          <Button size="sm" variant="outline" disabled={!["Finance (credit)", "Controller", "CFO", "Customer Service Manager"].includes(role)} title="Finance or the CS Manager records the recovery" onClick={() => {
            const x = recordFreightRecovery(r.id, amt)
            if (!x.ok) return setErr(x.error)
            setErr(null)
            toast.success("Freight claim recovered")
          }}>Record claim recovery</Button>
          <span className="text-xs text-muted-foreground">Recovery posts DR 1010 Bank / CR 6410 Freight Out [DOC:p.27 §3.9].</span>
        </div>
      )}
      {r.cls !== "RC4" && !["Draft", "Pending Approval", "Rejected", "Cancelled"].includes(r.status) && <Section title="Credit memo request and Controller release (E-RMA-07)"><CreditMemoPanel rmaId={r.id} st={fxst} /></Section>}
      {(r.cls === "RC4" || r.lines.some((l) => l.disposition === "Repair — Billable")) && <Section title="Billable repair quote and customer approval"><RepairQuotePanel rmaId={r.id} st={fxst} /></Section>}
      <PostingPreview title="Running GL entries" lines={gl.length ? gl : [{ template: 17, amount: null, notPostedReason: "Nothing posted yet: #17 posts at receipt" }]} />
      {r.settlement.length > 0 && (
        <Section title="Settlement steps">
          <ul className="flex flex-col gap-2 text-sm">
            {r.settlement.map((s) => (
              <li key={s.id} className="rounded-md border p-2">
                {s.id} · line {s.line} · {s.label} · {s.done ? "done" : s.error ?? "open"}
                {s.doc && <> · <A to={linkTo(s.doc, r.id)}>{s.doc.id}</A></>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function RmaDocuments({ r }: { r: Rma }) {
  const printed = r.activity.some((a) => /Return instructions (printed|emailed)/.test(a.text))
  const docs: { name: string; kind: string; on?: string }[] = [
    ...(!["Draft", "Pending Approval", "Rejected"].includes(r.status) ? [{ name: `return-instructions-${r.id.toLowerCase()}.pdf`, kind: `Return instructions PDF (Code128 barcode ${r.id})${printed ? "" : ", not printed yet"}` }] : []),
    ...r.activity.filter((a) => /emailed|letter/i.test(a.text)).map((a) => ({ name: /letter/i.test(a.text) ? "warranty-denial-letter.pdf" : "email to customer", kind: "Customer correspondence", on: a.at })),
    ...r.receipts.flatMap((x) => x.lines.filter((l) => l.photo).map((l) => ({ name: l.photo!, kind: `Receipt photo (${x.id}, line ${l.line})`, on: x.date }))),
    ...(r.inspectionPhotos ?? []).map((p) => ({ name: p, kind: "Inspection photograph" })),
    ...r.settlement.filter((x) => x.template === 20 && x.done).map((x) => ({ name: `certificate-of-destruction-${r.id.toLowerCase()}-l${x.line}.pdf`, kind: "Certificate of destruction (optional attachment)" })),
  ]
  return docs.length ? (
    <Table aria-label="RMA documents">
      <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Kind</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
      <TableBody>
        {docs.map((d, i) => (
          <TableRow key={i}><TableCell className="font-mono text-xs">{d.name}</TableCell><TableCell>{d.kind}</TableCell><TableCell>{d.on ? listDate(d.on) : ""}</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <p className="text-sm text-muted-foreground">No documents yet. Return instructions are issued once the RMA is authorized.</p>
  )
}
