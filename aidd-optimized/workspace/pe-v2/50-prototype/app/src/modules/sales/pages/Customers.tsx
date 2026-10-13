// OM-CUST-001/2 Customer Master [DOC:p.250 Book VI; fields and rules Book I B §2, p.49] (asserted).
// List + detail. Detail tabs: general, addresses, contacts, commercial, credit, tax, history,
// documents. The credit tab is read-only for sales roles. Primary actions: Create, Activate with
// address validation, credit hold toggle for Finance. Postings and scans: none.

import { useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage, PageHeader } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, KV, RulesPanel, SkeletonRows, useFirstVisitLoading, type Column } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { STATUS } from "@/data/domain"
import { useRole, useSlice } from "@/store"
import { money } from "../data/model"
import type { Customer } from "../data/model"
import { AUTO_HOLD_EXEMPTABLE, CUSTOMER_CLASSES, type CustAddress, type CustContact } from "../data/ext-model"
import {
  FIN_ROLES, activateCustomer, activationCheck, addAddress, addContact, createCustomer, setAutoHoldExempt, setCreditLimit, setCustomerClass, setCustomerStatus, setPriceList, setPriorityClass, setRiskClass, toggleCreditHold, userName,
} from "../data/ext-actions"
import { TaxTab } from "./fx/CustomerTax"
import { A, ActivityList, Reading, Section, StatPill } from "../components/ext"

const RULES: [string, string, string][] = [
  ["V-OM-01", "At least one Bill-To and one Ship-To address before status Active.", "DOC:p.49 §2.1"],
  ["OM-CUST-a", "Activate runs address validation (US ZIP or Canadian postal code on every address) and needs a price list.", "DOC:p.250 Book VI"],
  ["OM-CUST-b", "Credit tab: Finance edits, sales roles read only. Credit limit is Controller-owned. Sales cannot release credit holds.", "DOC:p.49 §2.1; p.250"],
  ["OM-CUST-c", "A Prospect is not selectable on a sales order; leads convert into Prospect with no credit limit.", "DOC:p.249 §4.1"],
  ["OM-CUST-d", "Customer priority class (backorder allocation order) is owned by the Sales Director.", "DOC:p.207 §2.2"],
  ["OM-CUST-e", "Inactive is refused while the customer has open sales orders.", "Reading SR-7"],
]
const PRICE_LISTS = ["PL-PRC-TBD-US26", "PL-PRC-TBD-CA26", "PL-PRC-TBD-DIST26"]
const CLASSES = CUSTOMER_CLASSES
const isFin = (r: string) => (FIN_ROLES as string[]).includes(r)

// ============================================================================ list
export function CustomerList() {
  const db = useSlice("sales")
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const sim = sp.get("state")
  const status = sp.get("status")
  const loading = useFirstVisitLoading("OM-CUST-001")
  const [open, setOpen] = useState(false)
  const all = sim === "empty" ? [] : db.customers
  const rows = status ? all.filter((c) => c.status === status) : all
  const header = {
    title: "Customer master",
    screenId: "OM-CUST-001/2",
    description: "The customer every sales document requires. Sales edits commercial data; Finance edits credit.",
    primary: <Button onClick={() => setOpen(true)}>Create customer</Button>,
  }
  if (sim === "error")
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        <ErrorAlert title="Customers could not be loaded" action={<button className="underline" onClick={() => setSp({})}>Retry</button>}>
          The customer service did not answer. Nothing was changed. Retry, or open a customer from global search (Ctrl K).
        </ErrorAlert>
      </div>
    )
  const columns: Column<Customer>[] = [
    { id: "id", header: "Customer", value: (c) => c.id, sortable: true, mono: true },
    { id: "name", header: "Legal name", value: (c) => c.name, sortable: true, className: "max-w-80 truncate" },
    { id: "cls", header: "Class", value: (c) => c.cls, filterable: true },
    { id: "status", header: "Status", value: (c) => c.status, cell: (c) => <StatusBadge kind="customer" status={c.status} size="sm" />, filterable: true, sortable: true },
    { id: "cur", header: "Currency", value: (c) => c.currency, filterable: true },
    { id: "limit", header: "Credit limit", value: (c) => c.creditLimit, cell: (c) => money(c.creditLimit, c.currency), sortable: true, align: "right", mono: true },
    { id: "exp", header: "Exposure", value: (c) => c.exposure, cell: (c) => money(c.exposure, c.currency), sortable: true, align: "right", mono: true },
    { id: "util", header: "Used %", value: (c) => (c.creditLimit ? Math.round((c.exposure / c.creditLimit) * 100) : 0), sortable: true, align: "right", mono: true },
    { id: "flags", header: "Flags", value: (c) => `${c.creditHold ? "Credit hold " : ""}${c.pastDue30 ? "Past due 30+" : ""}`, cell: (c) => (
      <span className="flex gap-1">
        {c.creditHold && <Chip kind="hold">Credit hold</Chip>}
        {c.pastDue30 && <Chip kind="block">Past due 30+</Chip>}
      </span>
    ) },
    { id: "risk", header: "Risk", value: (c) => c.risk, filterable: true },
    { id: "prio", header: "Priority", value: (c) => c.priority, filterable: true },
    { id: "owner", header: "Owner", value: (c) => userName(db.custExt[c.id]?.ownerId), filterable: true },
  ]
  return (
    <>
      <ListPage<Customer>
        header={header}
        above={
          <div className="flex flex-wrap gap-2" aria-label="Customers by status">
            <StatPill label="All" value={all.length} active={!status} onClick={() => setSp({})} />
            {STATUS.customer.statuses.map((s) => (
              <StatPill key={s} label={s} value={all.filter((c) => c.status === s).length} active={status === s} onClick={() => setSp({ status: s })} />
            ))}
          </div>
        }
        table={{
          rows, columns, rowId: (c) => c.id, rowHref: (c) => `/sales/customers/${c.id}`, loading, densityKey: "om-cust",
          searchText: (c) => `${c.id} ${c.name} ${c.billTo} ${c.shipTo}`, searchPlaceholder: "Search customer, name, address",
          empty: { title: "No customers yet", body: "Create the first customer, or convert a qualified lead (it arrives as a Prospect)." }, initialSort: { id: "name", dir: "asc" },
        }}
        below={<RulesPanel rules={RULES} />}
      />
      <CreateCustomerDialog open={open} onOpenChange={setOpen} onCreated={(id) => nav(`/sales/customers/${id}`)} />
    </>
  )
}

function CreateCustomerDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("")
  const [cls, setCls] = useState<string>(CLASSES[0])
  const [currency, setCurrency] = useState<"USD" | "CAD">("USD")
  const [inco, setInco] = useState("DAP")
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Create customer"
      consequence="The customer is created in Prospect with no credit limit. It cannot be used on a sales order until Finance activates it."
      confirmLabel="Create in Prospect"
      onConfirm={() => {
        const r = createCustomer({ name, cls, currency, incoterms: inco })
        if (!r.ok) return r.error
        toast.success(`${r.value} created in Prospect`)
        setName("")
        onCreated(r.value)
        return null
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-1">
          <Label htmlFor="cc-name">Legal name</Label>
          <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Pick id="cc-cls" label="Customer class" value={cls} options={CLASSES} onChange={setCls} />
        <Pick id="cc-cur" label="Currency" value={currency} options={["USD", "CAD"]} onChange={(v) => setCurrency(v as "USD" | "CAD")} />
        <Pick id="cc-inco" label="Incoterms" value={inco} options={["EXW", "FCA", "DAP", "DDP"]} onChange={setInco} />
      </div>
    </DialogShell>
  )
}

function Pick({ id, label, value, options, onChange, disabled }: { id: string; label: string; value: string; options: readonly string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ============================================================================ detail
export function CustomerDetail() {
  const { id = "" } = useParams()
  const db = useSlice("sales")
  const [role] = useRole()
  const loading = useFirstVisitLoading(`cust-${id}`)
  const [err, setErr] = useState<string | null>(null)
  const [statusDlg, setStatusDlg] = useState<"On Hold" | "Blocked" | "Inactive" | null>(null)
  const [holdDlg, setHoldDlg] = useState(false)
  const [exemptDlg, setExemptDlg] = useState(false)
  const [activateDlg, setActivateDlg] = useState(false)
  const [limit, setLimit] = useState<string>("")
  const c = db.customers.find((x) => x.id === id)
  const x = db.custExt[id]
  const related = useMemo(
    () => ({
      quotes: db.quotations.filter((q) => q.customerId === id),
      orders: db.orders.filter((o) => o.customerId === id),
      rmas: db.rmas.filter((r) => r.customerId === id),
      ib: db.ib.filter((i) => i.customerId === id),
      leads: db.leads.filter((l) => l.customerId === id),
    }),
    [db, id],
  )
  if (!c || !x) return <ErrorAlert title="Customer not found">No customer {id} in this prototype. Open the customer list.</ErrorAlert>
  if (loading)
    return (
      <Table aria-label="Loading customer">
        <TableBody>
          <SkeletonRows cols={4} rows={6} />
        </TableBody>
      </Table>
    )
  const fin = isFin(role)
  const run = (res: { ok: boolean; error?: string }, msg: string) => {
    if (!res.ok) setErr(res.error ?? "Not done")
    else {
      setErr(null)
      toast.success(msg)
    }
    return res.ok
  }
  const checks = activationCheck(db, c.id)
  const canActivate = ["Prospect", "On Hold", "Inactive"].includes(c.status)
  const utilization = c.creditLimit ? Math.round((c.exposure / c.creditLimit) * 100) : 0

  return (
    <>
      <DetailPage
        header={{
          title: `${c.id} · ${c.name}`,
          screenId: "OM-CUST-001/2",
          crumbs: [{ label: "Customer master", to: "/sales/customers" }, { label: c.id }],
          description: `${c.cls} · ${x.segment} · ${c.currency}`,
          chips: (
            <>
              {c.creditHold && <Chip kind="hold">Credit hold</Chip>}
              {c.pastDue30 && <Chip kind="block">Past due 30+</Chip>}
            </>
          ),
          actions: (
            <>
              {(["On Hold", "Blocked", "Inactive"] as const).map((s) => (
                <Button key={s} variant="outline" disabled={c.status === s} onClick={() => setStatusDlg(s)}>
                  Set {s}
                </Button>
              ))}
              <Button variant="outline" onClick={() => setHoldDlg(true)} disabled={!fin} title={fin ? undefined : "Finance toggles the credit hold"}>
                {c.creditHold ? "Release credit hold" : "Set credit hold"}
              </Button>
            </>
          ),
          primary: canActivate ? <Button onClick={() => setActivateDlg(true)}>Activate</Button> : undefined,
        }}
        status={{ kind: "customer", value: c.status }}
        doc={{ type: "customer", id: c.id }}
        summary={
          <>
            <KV k="Credit">{money(c.exposure, c.currency)} of {money(c.creditLimit, c.currency)} ({utilization}%)</KV>
            <KV k="Risk / priority">
              {c.risk} / {c.priority}
            </KV>
            <KV k="Owner">{userName(x.ownerId)}</KV>
            <KV k="Open sales orders">{related.orders.filter((o) => !["Invoiced/Closed", "Cancelled", "Rejected"].includes(o.status)).length}</KV>
          </>
        }
        tabs={[
          {
            id: "general",
            label: "General",
            content: (
              <div className="flex flex-col gap-4">
                {err && (
                  <ErrorAlert title="Action not done" onDismiss={() => setErr(null)}>
                    {err}
                  </ErrorAlert>
                )}
                <Section title="General">
                  <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <KV k="Legal name">{c.name}</KV>
                    <KV k="Doing business as">{x.dba ?? "Not recorded"}</KV>
                    <KV k="Customer class">
                      <Pick id="cu-cls" label="Customer class (required)" value={c.cls} options={CLASSES} onChange={(v) => run(setCustomerClass(c.id, v), `Customer class ${v}`)} />
                      {!c.cls && <span className="text-xs text-status-blocked">Not set: required before activation</span>}
                    </KV>
                    <KV k="Segment">{x.segment}</KV>
                    <KV k="Parent account">{x.parentId ? <A to={`/sales/customers/${x.parentId}`}>{x.parentId}</A> : "None"}</KV>
                    <KV k="Account owner">{userName(x.ownerId)}</KV>
                  </dl>
                </Section>
                <Section title="Activation check (address validation)">
                  {checks.length === 0 ? (
                    <p className="text-sm">All checks pass: Bill-To and Ship-To present, every postal code valid, price list set.</p>
                  ) : (
                    <ul className="list-disc pl-4 text-sm">
                      {checks.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
            ),
          },
          { id: "addresses", label: "Addresses", count: x.addresses.length, content: <Addresses id={c.id} addresses={x.addresses} onRun={run} /> },
          { id: "contacts", label: "Contacts", count: x.contacts.length, content: <Contacts id={c.id} contacts={x.contacts} onRun={run} /> },
          {
            id: "commercial",
            label: "Commercial",
            content: (
              <Section title="Commercial (Sales edits)">
                <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Pick id="pl" label="Price list" value={x.priceList ?? ""} options={PRICE_LISTS} onChange={(v) => run(setPriceList(c.id, v), `Price list ${v}`)} />
                  </div>
                  <KV k="Payment terms">
                    {x.paymentTerms} <Chip kind="design" note="Payment terms are owned by ACC (Finance system); shown read-only here">ACC</Chip>
                  </KV>
                  <KV k="Incoterms">{c.incoterms}</KV>
                  <KV k="Freight terms">{x.freightTerms}</KV>
                  <KV k="Invoice delivery">{x.invoiceDelivery}</KV>
                  <KV k="Invoice consolidation">{x.consolidation}</KV>
                  <KV k="Partial shipments">{c.noPartial ? "Not allowed (no partial)" : "Allowed"}</KV>
                  <KV k="Priority class">
                    {role === "Sales Director" ? (
                      <Pick id="prio" label="Priority class (Sales Director)" value={c.priority} options={["A", "B", "C"]} onChange={(v) => run(setPriorityClass(c.id, v as Customer["priority"]), `Priority ${v}`)} />
                    ) : (
                      <>{c.priority} (Sales Director sets)</>
                    )}
                  </KV>
                </dl>
              </Section>
            ),
          },
          {
            id: "credit",
            label: "Credit",
            content: (
              <Section title={fin ? "Credit (Finance edits)" : "Credit (read only for sales roles)"}>
                {!fin && <p className="text-sm text-muted-foreground">You are acting as {role}. Switch "Acting as" to Finance (credit), Controller or CFO to edit.</p>}
                <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <KV k="Credit limit">
                    {role === "Controller" ? (
                      <span className="flex items-center gap-2">
                        <Input aria-label="Credit limit" className="h-8 w-36" type="number" placeholder={String(c.creditLimit)} value={limit} onChange={(e) => setLimit(e.target.value)} />
                        <Button size="sm" variant="outline" disabled={limit === ""} onClick={() => run(setCreditLimit(c.id, Number(limit)), "Credit limit saved") && setLimit("")}>
                          Save
                        </Button>
                      </span>
                    ) : (
                      <>{money(c.creditLimit, c.currency)} (Controller-owned)</>
                    )}
                  </KV>
                  <KV k="Exposure">{money(c.exposure, c.currency)}</KV>
                  <KV k="Utilization">{utilization}%</KV>
                  <KV k="Risk class">
                    {fin ? <Pick id="risk" label="Risk class" value={c.risk} options={["A", "B", "C", "D"]} onChange={(v) => run(setRiskClass(c.id, v as Customer["risk"]), `Risk class ${v}`)} /> : c.risk}
                  </KV>
                  <KV k="Credit hold">{c.creditHold ? "Set" : "Not set"}</KV>
                  <KV k="Past due over 30 days">{c.pastDue30 ? "Yes" : "No"}</KV>
                  <KV k="Exempt from Auto Hold">
                    <span className="flex flex-wrap items-center gap-2">
                      {x.exemptFromAutoHold ? "Yes" : "No"}
                      {role === "Controller" && (AUTO_HOLD_EXEMPTABLE.includes(c.cls) || x.exemptFromAutoHold) && (
                        <Button size="sm" variant="outline" onClick={() => setExemptDlg(true)}>{x.exemptFromAutoHold ? "Clear exemption" : "Set exemption"}</Button>
                      )}
                      <span className="text-xs text-muted-foreground">Controller only; Government or municipal class customers only</span>
                    </span>
                  </KV>
                  <KV k="Rating reference">{x.ratingRef ?? "Not recorded"}</KV>
                  <KV k="Last review">
                    {x.lastReview ?? "Never"} {x.reviewer && `by ${userName(x.reviewer)}`}
                  </KV>
                </dl>
              </Section>
            ),
          },
          {
            id: "tax",
            label: "Tax",
            content: <TaxTab custId={c.id} />,
          },
          {
            id: "history",
            label: "History",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Related documents">
                  <dl className="flex flex-col gap-2 text-sm">
                    <KV k="Leads">{related.leads.length ? related.leads.map((l) => <A key={l.id} to={`/sales/leads/${l.id}`} className="mr-2">{l.id}</A>) : "None"}</KV>
                    <KV k="Quotations">{related.quotes.length ? related.quotes.map((q) => <A key={q.id} to={`/sales/quotations/${q.id}`} className="mr-2">{q.id}</A>) : "None"}</KV>
                    <KV k="Sales orders">{related.orders.length ? related.orders.map((o) => <A key={o.id} to={`/sales/orders/${o.id}`} className="mr-2">{o.id}</A>) : "None"}</KV>
                    <KV k="RMAs">{related.rmas.length ? related.rmas.map((r) => <A key={r.id} to={`/sales/rma/${r.id}`} className="mr-2">{r.id}</A>) : "None"}</KV>
                    <KV k="Installed base">{related.ib.length ? related.ib.map((i) => <A key={i.id} to={`/service/installed-base/${i.id}`} className="mr-2">{i.id}</A>) : "None"}</KV>
                  </dl>
                </Section>
                <Section title="Activity">
                  <ActivityList items={x.activity} />
                </Section>
              </div>
            ),
          },
          {
            id: "documents",
            label: "Documents",
            count: x.documents.length,
            content: (
              <Section title="Documents">
                {x.documents.length ? (
                  <ul className="list-disc pl-4 text-sm">
                    {x.documents.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No documents">Frame agreements, tax certificates and W-9 or GST forms attach here.</EmptyState>
                )}
              </Section>
            ),
          },
        ]}
        aside={<RulesPanel rules={RULES} />}
      />
      <DialogShell
        open={activateDlg}
        onOpenChange={setActivateDlg}
        title={`Activate ${c.id}`}
        consequence="The customer becomes Active and can be used on quotations and sales orders. Address validation runs first."
        confirmLabel="Activate"
        confirmDisabled={checks.length > 0}
        onConfirm={() => (run(activateCustomer(c.id), `${c.id} Active`) ? null : "Not activated")}
      >
        {checks.length ? (
          <ul className="list-disc pl-4 text-sm">
            {checks.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">Address validation passed. Activation is done by Finance (credit), Controller or CFO.</p>
        )}
      </DialogShell>
      <DialogShell
        open={!!statusDlg}
        onOpenChange={(o) => !o && setStatusDlg(null)}
        title={`Set ${c.id} to ${statusDlg}`}
        consequence={statusDlg === "Inactive" ? "No new documents for this customer. Refused while sales orders are open." : "New orders for this customer are held until it returns to Active."}
        confirmLabel={`Set ${statusDlg}`}
        requireReason
        onConfirm={(reason) => {
          const r = setCustomerStatus(c.id, statusDlg!, reason)
          if (!r.ok) return r.error
          toast.success(`${c.id} ${statusDlg}`)
          return null
        }}
      />
      <DialogShell
        open={exemptDlg}
        onOpenChange={setExemptDlg}
        title={x.exemptFromAutoHold ? `Clear the auto-hold exemption on ${c.id}` : `Exempt ${c.id} from automatic hold`}
        consequence={x.exemptFromAutoHold ? "Automatic credit holds apply to this customer again." : "Automatic credit holds (limit or past due) no longer stop this customer's orders; manual holds still apply."}
        confirmLabel={x.exemptFromAutoHold ? "Clear exemption" : "Set exemption"}
        requireReason
        onConfirm={(reason) => {
          const r = setAutoHoldExempt(c.id, !x.exemptFromAutoHold, reason)
          return r.ok ? null : r.error
        }}
      />
      <DialogShell
        open={holdDlg}
        onOpenChange={setHoldDlg}
        title={c.creditHold ? `Release the credit hold on ${c.id}` : `Set a credit hold on ${c.id}`}
        consequence={c.creditHold ? "Held orders for this customer can be released through the credit check." : "Every new and open order for this customer stops at the credit gate."}
        confirmLabel={c.creditHold ? "Release hold" : "Set hold"}
        requireReason
        onConfirm={(reason) => {
          const r = toggleCreditHold(c.id, reason)
          return r.ok ? null : r.error
        }}
      />
    </>
  )
}

function Addresses({ id, addresses, onRun }: { id: string; addresses: CustAddress[]; onRun: (r: { ok: boolean; error?: string }, msg: string) => boolean }) {
  const blank: CustAddress = { kind: "Ship-To", isDefault: false, site: "", text: "", instructions: "", crane: false, maxVehicle: "" }
  const [f, setF] = useState<CustAddress>(blank)
  return (
    <div className="flex flex-col gap-4">
      <Table aria-label="Addresses">
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Delivery instructions</TableHead>
            <TableHead>Crane on site</TableHead>
            <TableHead>Max vehicle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {addresses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                No addresses yet. V-OM-01 needs one Bill-To and one Ship-To before Active.
              </TableCell>
            </TableRow>
          ) : (
            addresses.map((a, i) => (
              <TableRow key={i}>
                <TableCell>{a.kind}</TableCell>
                <TableCell>{a.site}</TableCell>
                <TableCell className="max-w-80 truncate" title={a.text}>
                  {a.text}
                </TableCell>
                <TableCell>{a.isDefault ? "Yes" : "No"}</TableCell>
                <TableCell>{a.instructions || "None"}</TableCell>
                <TableCell>{a.kind === "Bill-To" ? "n/a" : a.crane ? "Yes" : "No"}</TableCell>
                <TableCell>{a.maxVehicle || "Not recorded"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Section title="Add address">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Pick id="ad-kind" label="Type" value={f.kind} options={["Bill-To", "Ship-To", "Both"]} onChange={(v) => setF({ ...f, kind: v as CustAddress["kind"] })} />
          <div className="flex flex-col gap-1">
            <Label htmlFor="ad-site">Site name</Label>
            <Input id="ad-site" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="ad-text">Address (with ZIP or postal code)</Label>
            <Input id="ad-text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="ad-instr">Delivery instructions</Label>
            <Input id="ad-instr" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ad-veh">Max vehicle</Label>
            <Input id="ad-veh" value={f.maxVehicle} onChange={(e) => setF({ ...f, maxVehicle: e.target.value })} />
          </div>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={f.isDefault} onCheckedChange={(v) => setF({ ...f, isDefault: v === true })} /> Default for its type
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={!!f.crane} onCheckedChange={(v) => setF({ ...f, crane: v === true })} /> Crane on site
            </label>
          </div>
        </div>
        <div>
          <Button variant="outline" onClick={() => onRun(addAddress(id, { ...f, site: f.site || f.kind }), "Address added") && setF(blank)}>
            Add address
          </Button>
        </div>
      </Section>
    </div>
  )
}

function Contacts({ id, contacts, onRun }: { id: string; contacts: CustContact[]; onRun: (r: { ok: boolean; error?: string }, msg: string) => boolean }) {
  const blank: CustContact = { name: "", title: "", roles: ["Purchasing"], email: "", phone: "", primary: false }
  const [f, setF] = useState<CustContact>(blank)
  const ROLES = ["Purchasing", "Engineering", "AP", "Receiving"] as const
  return (
    <div className="flex flex-col gap-4">
      <Table aria-label="Contacts">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Primary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((k, i) => (
            <TableRow key={i}>
              <TableCell>{k.name}</TableCell>
              <TableCell>{k.title}</TableCell>
              <TableCell>{k.roles.join(", ")}</TableCell>
              <TableCell className="font-mono text-xs">{k.email}</TableCell>
              <TableCell className="tabular">{k.phone}</TableCell>
              <TableCell>{k.primary ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
          {contacts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No contacts yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Section title="Add contact">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(["name", "title", "email", "phone"] as const).map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <Label htmlFor={`ct-${k}`} className="capitalize">
                {k}
              </Label>
              <Input id={`ct-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 text-xs text-muted-foreground">Contact roles</legend>
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <Checkbox checked={f.roles.includes(r)} onCheckedChange={(v) => setF({ ...f, roles: v === true ? [...f.roles, r] : f.roles.filter((x) => x !== r) })} /> {r}
            </label>
          ))}
          <Reading id="SR-7" note="Contact role values (Purchasing, Engineering, AP, Receiving) and 'Inactive refused while sales orders are open' are design values; the PRD names contacts and statuses without these lists" />
        </fieldset>
        <div>
          <Button variant="outline" onClick={() => onRun(addContact(id, f), "Contact added") && setF(blank)}>
            Add contact
          </Button>
        </div>
      </Section>
    </div>
  )
}
