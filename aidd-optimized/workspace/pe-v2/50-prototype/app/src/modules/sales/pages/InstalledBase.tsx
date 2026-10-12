// IB-001 Installed Base [DOC:p.253 Book VI; Book IV §7.4, p.215] (asserted). CS maintains, all read.
// One record per shipped serial with customer, site, dates, warranty state from the entitlement
// service and a service history timeline. Actions: record ownership transfer, capture commissioning
// date, extend warranty with approval. Created automatically at PGI (sales.pgiPosted); RMA screens
// read it. Postings and scans: none.

import { useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage, PageHeader } from "@/components/templates"
import { Chip, ErrorAlert, KV, RulesPanel, SkeletonRows, useFirstVisitLoading, type Column } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { STATUS } from "@/data/domain"
import { useCore, useRole, useSlice } from "@/store"
import { listDate, product, TODAY, type DB } from "../data/model"
import type { Ib } from "../data/ext-model"
import { captureCommissioning, decideExtension, entitlement, EXTENSION_APPROVER, proposeExtension, recordTransfer } from "../data/ext-actions"
import { A, Reading, Section, StatPill } from "../components/ext"

const RULES: [string, string, string][] = [
  ["IB-a", "One installed base record per shipped serial, created automatically at PGI; POD marks it Installed; commissioning marks it In Service.", "DOC:p.253 Book VI; p.215 §7.4"],
  ["IB-b", "Warranty start is the ship date by default; the contract may elect the POD or commissioning date, capped at ship + N months.", "DOC:p.215 §7.4"],
  ["IB-c", "Duration from the item's warranty months, overridden by the sales order where it says so; extensions are dated records that count only once approved.", "DOC:p.215 §7.4"],
  ["IB-c2", "Extend warranty with approval: the Customer Service Manager approves (reading SR-14, approver not stated); the requester cannot approve their own extension.", "DOC:p.253 Book VI IB-001"],
  ["IB-d", "An ownership transfer needs its document; the entitlement follows the unit.", "DOC:p.215 §7.4"],
  ["IB-e", "Customer service maintains the record; every role reads it.", "DOC:p.253 Book VI"],
]
const openRecallOf = (ib: Ib) => ib.history.find((h) => h.doc?.type === "recall")?.doc?.id
const cname = (db: DB, id: string) => db.customers.find((c) => c.id === id)?.name ?? id

export function InstalledBaseList() {
  const db = useSlice("sales")
  const [sp, setSp] = useSearchParams()
  const sim = sp.get("state")
  const st = sp.get("status")
  const loading = useFirstVisitLoading("IB-001")
  const all = sim === "empty" ? [] : db.ib
  const rows = st ? all.filter((i) => i.status === st) : all
  const header = { title: "Installed base", screenId: "IB-001", description: "Every shipped transformer, where it stands and what its warranty covers today." }
  if (sim === "error")
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        <ErrorAlert title="Installed base could not be loaded" action={<button className="underline" onClick={() => setSp({})}>Retry</button>}>
          The service did not answer. Nothing was changed. Retry, or search a serial with Ctrl K.
        </ErrorAlert>
      </div>
    )
  const columns: Column<Ib>[] = [
    { id: "id", header: "Record", value: (i) => i.id, sortable: true, mono: true },
    { id: "serial", header: "Serial", value: (i) => i.serial, mono: true, sortable: true },
    { id: "item", header: "Unit", value: (i) => product(i.itemId).description, className: "max-w-60 truncate", filterable: true },
    { id: "cust", header: "Owner", value: (i) => cname(db, i.customerId), className: "max-w-60 truncate", filterable: true },
    { id: "site", header: "Site", value: (i) => i.site, className: "max-w-72 truncate" },
    { id: "status", header: "Status", value: (i) => i.status, cell: (i) => <StatusBadge kind="installedBase" status={i.status} size="sm" />, filterable: true, sortable: true },
    { id: "ship", header: "Shipped", value: (i) => i.shipDate, cell: (i) => listDate(i.shipDate), sortable: true },
    { id: "comm", header: "Commissioned", value: (i) => i.commissioningDate ?? "", cell: (i) => (i.commissioningDate ? listDate(i.commissioningDate) : "Not captured") },
    { id: "war", header: "Warranty today", value: (i) => entitlement(i, TODAY, openRecallOf(i)).verdict, cell: (i) => {
      const e = entitlement(i, TODAY, openRecallOf(i))
      return <span className="text-xs">{e.verdict === "covered" ? "Covered" : e.verdict === "conditional" ? "Covered, conditional" : "Not covered"} to {listDate(e.end)}</span>
    }, filterable: true },
  ]
  return (
    <ListPage<Ib>
      header={header}
      above={
        <div className="flex flex-wrap gap-2" aria-label="Installed base by status">
          <StatPill label="All" value={all.length} active={!st} onClick={() => setSp({})} />
          {STATUS.installedBase.statuses.map((s) => (
            <StatPill key={s} label={s} value={all.filter((i) => i.status === s).length} active={st === s} onClick={() => setSp({ status: s })} />
          ))}
        </div>
      }
      table={{
        rows, columns, rowId: (i) => i.id, rowHref: (i) => `/service/installed-base/${i.id}`, loading, densityKey: "ib-001",
        searchText: (i) => `${i.id} ${i.serial} ${cname(db, i.customerId)} ${i.site} ${i.soId ?? ""}`, searchPlaceholder: "Search serial, customer, site, order",
        empty: { title: "No installed base yet", body: "Records are created automatically when a finished transformer is shipped (PGI)." }, initialSort: { id: "ship", dir: "desc" },
      }}
      below={<RulesPanel rules={RULES} />}
    />
  )
}

export function InstalledBaseDetail() {
  const { id = "" } = useParams()
  const db = useSlice("sales")
  const loading = useFirstVisitLoading(`ib-${id}`)
  const [dlg, setDlg] = useState<"transfer" | "commission" | "extend" | null>(null)
  const [to, setTo] = useState("")
  const [docName, setDocName] = useState("")
  const [date, setDate] = useState(TODAY)
  const [months, setMonths] = useState(12)
  const [rejectExt, setRejectExt] = useState<string | null>(null)
  const [role] = useRole()
  const { userId } = useCore()
  const ib = db.ib.find((x) => x.id === id || x.serial === id)
  if (!ib) return <ErrorAlert title="Installed base record not found">No record {id} in this prototype. Open the installed base list.</ErrorAlert>
  if (loading)
    return (
      <Table aria-label="Loading installed base record">
        <TableBody>
          <SkeletonRows cols={4} rows={6} />
        </TableBody>
      </Table>
    )
  const recall = openRecallOf(ib)
  const ent = entitlement(ib, TODAY, recall)
  const rmas = db.rmas.filter((r) => r.ibId === ib.id || r.lines.some((l) => l.serial === ib.serial) || (r.refType === "Serial Number" && r.refDoc === ib.serial))
  const closed = ib.status === "Scrapped"
  return (
    <>
      <DetailPage
        header={{
          title: `${ib.id} · ${ib.serial}`,
          screenId: "IB-001",
          crumbs: [{ label: "Installed base", to: "/service/installed-base" }, { label: ib.id }],
          description: `${product(ib.itemId).description} · ${cname(db, ib.customerId)}`,
          chips: recall ? <Chip kind="flag" note="An open recall campaign covers this unit">Campaign {recall}</Chip> : undefined,
          actions: (
            <>
              <Button variant="outline" disabled={closed} onClick={() => setDlg("transfer")}>Record ownership transfer</Button>
              <Button variant="outline" disabled={closed} onClick={() => setDlg("extend")}>Extend warranty</Button>
              <Button variant="outline" asChild><Link to={`/service/spares-finder?q=${ib.serial}`}>Spares finder</Link></Button>
              <Button variant="outline" asChild><Link to={`/sales/rma/new?serial=${ib.serial}&customer=${ib.customerId}`}>Create RMA</Link></Button>
            </>
          ),
          primary: !ib.commissioningDate && !closed && ib.status !== "Returned" ? <Button onClick={() => setDlg("commission")}>Capture commissioning date</Button> : undefined,
        }}
        status={{ kind: "installedBase", value: ib.status }}
        doc={{ type: "installedBase", id: ib.id }}
        summary={
          <>
            <KV k="Warranty today">{ent.verdict === "covered" ? "Covered" : ent.verdict === "conditional" ? "Covered, conditional" : "Not covered"}</KV>
            <KV k="Warranty period">{listDate(ent.start)} to {listDate(ent.end)}</KV>
            <KV k="Owner">{cname(db, ib.customerId)}</KV>
            <KV k="Sales order">{ib.soId ? <A to={`/sales/orders/${ib.soId}`}>{ib.soId}</A> : "None"}</KV>
          </>
        }
        tabs={[
          {
            id: "unit",
            label: "Unit and site",
            content: (
              <Section title="Unit and site">
                <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <KV k="Serial">{ib.serial}</KV>
                  <KV k="Item">{ib.itemId} · {product(ib.itemId).description}</KV>
                  <KV k="Customer (owner)"><A to={`/sales/customers/${ib.customerId}`}>{cname(db, ib.customerId)}</A></KV>
                  <KV k="Site">{ib.site}</KV>
                  <KV k="Delivery">{ib.deliveryId ? <A to={`/sales/deliveries?d=${ib.deliveryId}`}>{ib.deliveryId}</A> : "None"}</KV>
                  <KV k="Ship date">{listDate(ib.shipDate)}</KV>
                  <KV k="POD date">{ib.podDate ? listDate(ib.podDate) : "Not recorded"}</KV>
                  <KV k="Commissioning date">{ib.commissioningDate ? listDate(ib.commissioningDate) : "Not captured"}</KV>
                </dl>
              </Section>
            ),
          },
          {
            id: "warranty",
            label: "Warranty",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Entitlement service">
                  <dl className="grid grid-cols-2 gap-2">
                    <KV k="Basis (contract election)">{ib.warrantyBasis}</KV>
                    <KV k="Duration">{ent.months} months</KV>
                    <KV k="Start">{listDate(ent.start)}</KV>
                    <KV k="End">{listDate(ent.end)}</KV>
                  </dl>
                  <ol className="list-decimal pl-4 text-xs text-muted-foreground" aria-label="Rule trail">{ent.trail.map((t) => <li key={t}>{t}</li>)}</ol>
                  <Reading id="SR-10" note="Election cap N = 6 months after ship (the PRD says 'configurable N')" />
                </Section>
                <Section title={`Extensions (${ib.extensions.length})`}>
                  {ib.extensions.length ? (
                    <ul className="text-sm">
                      {ib.extensions.map((x) => (
                        <li key={x.id}>
                          {x.id} · +{x.months} months · {x.reason} · {x.on} · {x.approved ? `approved${x.decided ? ` by ${x.decided.by} on ${x.decided.on}` : ""}` : x.decided ? `rejected by ${x.decided.by}: ${x.decided.reason}` : `waiting for the ${EXTENSION_APPROVER}`}
                          {!x.approved && !x.decided && (
                            <span className="ml-2 inline-flex flex-wrap items-center gap-2">
                              {(() => {
                                const why = role !== EXTENSION_APPROVER ? `The ${EXTENSION_APPROVER} approves extensions. You are acting as ${role}.` : x.byUser === userId ? "You requested this extension; another Customer Service Manager approves it." : undefined
                                return (
                                  <>
                                    <Button size="sm" variant="outline" disabled={!!why} title={why} onClick={() => { const res = decideExtension(ib.id, x.id, "Approved"); if (res.ok) toast.success(`${x.id} approved`); else toast.error(res.error) }}>Approve</Button>
                                    <Button size="sm" variant="ghost" disabled={!!why} title={why} onClick={() => setRejectExt(x.id)}>Reject</Button>
                                  </>
                                )
                              })()}
                              <Reading id="SR-14" note="The PRD does not name the extension approver; the Customer Service Manager decides here (CS maintains IB-001) until the shared engine has a 'Warranty extension' kind (FR-9)" />
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No extensions.</p>
                  )}
                </Section>
                <Section title={`Ownership transfers (${ib.transfers.length})`}>
                  {ib.transfers.length ? (
                    <ul className="text-sm">
                      {ib.transfers.map((t, i) => (
                        <li key={i}>{t.on}: {cname(db, t.fromCustomerId)} → {cname(db, t.toCustomerId)} · {t.document}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Still with the original buyer.</p>
                  )}
                </Section>
              </div>
            ),
          },
          {
            id: "history",
            label: "Service history",
            count: ib.history.length,
            content: (
              <ol className="flex flex-col gap-2 border-l pl-4 text-sm" aria-label="Service history timeline">
                {[...ib.history].sort((a, b) => b.on.localeCompare(a.on)).map((h, i) => (
                  <li key={i}>
                    <span className="tabular text-muted-foreground">{h.on}</span> · {h.text}
                    {h.doc && (
                      <> · {h.doc.type === "rma" ? <A to={`/sales/rma/${h.doc.id}`}>{h.doc.id}</A> : h.doc.type === "pod" ? <A to={`/sales/pod/${h.doc.id}`}>{h.doc.id}</A> : h.doc.type === "quotation" ? <A to={`/sales/quotations/${h.doc.id}`}>{h.doc.id}</A> : <span className="font-mono">{h.doc.id}</span>}</>
                    )}
                  </li>
                ))}
              </ol>
            ),
          },
          {
            id: "rmas",
            label: "Returns",
            count: rmas.length,
            content: rmas.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {rmas.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <A to={`/sales/rma/${r.id}`}>{r.id}</A> <StatusBadge kind="rma" status={r.status} size="sm" /> {r.cls} · {r.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No returns on this unit.</p>
            ),
          },
        ]}
        aside={<RulesPanel rules={RULES} />}
      />
      <DialogShell
        open={dlg === "transfer"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Record ownership transfer of ${ib.serial}`}
        consequence="The unit moves to the new owner; the warranty entitlement follows the unit. The previous owner stays in the history."
        confirmLabel="Record transfer"
        onConfirm={() => {
          const r = recordTransfer(ib.id, to, docName)
          if (!r.ok) return r.error
          toast.success("Ownership transfer recorded")
          return null
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ib-to">New owner</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger id="ib-to"><SelectValue placeholder="Pick the customer" /></SelectTrigger>
              <SelectContent>{db.customers.filter((c) => c.id !== ib.customerId).map((c) => <SelectItem key={c.id} value={c.id}>{c.id} {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ib-doc">Transfer document (resale or assignment)</Label>
            <Input id="ib-doc" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Assignment of warranty.pdf" />
          </div>
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "commission"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Capture commissioning date for ${ib.serial}`}
        consequence={`The unit becomes In Service.${ib.warrantyBasis === "Commissioning date" ? " The contract elects the commissioning date, so the warranty start moves (capped at ship + 6 months)." : ""}`}
        confirmLabel="Capture date"
        onConfirm={() => {
          const r = captureCommissioning(ib.id, date)
          if (!r.ok) return r.error
          toast.success("Commissioning date captured")
          return null
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="ib-date">Commissioning date (from field evidence)</Label>
          <Input id="ib-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </DialogShell>
      <DialogShell
        open={!!rejectExt}
        onOpenChange={(o) => !o && setRejectExt(null)}
        title={`Reject extension ${rejectExt ?? ""}`}
        consequence="The dated extension record stays on file as rejected and does not count toward the entitlement."
        confirmLabel="Reject extension"
        destructive
        requireReason
        onConfirm={(reason) => {
          const r = decideExtension(ib.id, rejectExt!, "Rejected", reason)
          return r.ok ? null : r.error
        }}
      />
      <DialogShell
        open={dlg === "extend"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Extend the warranty on ${ib.serial}`}
        consequence="A dated extension record is created. It counts toward the entitlement only once approved."
        confirmLabel="Request extension"
        requireReason
        onConfirm={(reason) => {
          const r = proposeExtension(ib.id, months, reason)
          if (!r.ok) return r.error
          toast.success("Extension requested")
          return null
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="ib-months">Months</Label>
          <Input id="ib-months" type="number" min={1} max={60} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
        </div>
      </DialogShell>
    </>
  )
}
