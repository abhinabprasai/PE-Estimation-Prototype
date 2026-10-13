// QM-DEV-001 Deviations and Waivers [DOC:pp.265-266 Book VI; Book IV §7.3] (asserted).
// Scope selector, specification versus accepted values, validity by date or quantity, customer
// evidence slot, affected serial links. Quality and Engineering managers approve with expiry; auto
// expiry blocks further use. Creates traceable acceptances disclosed on as-built records.
// No status list in the specification (OQ-21): the state shows as text. Postings and scans: none.

import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { FilePlus2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, ErrorAlert, KV, RulesPanel, type Column } from "@/components/patterns"
import type { DocRef } from "@/data/domain"
import { TODAY, VENDORS } from "@/data/shared"
import { addDays } from "@/lib/format"
import { useSlice } from "@/store"
import { dev as act } from "../data/actions"
import { DEVIATION_TYPES, type QtDeviation } from "../data/types"
import { DEV_CONTROLLER_THRESHOLD, devApprovers, devNeedsCustomer } from "../data/derive"
import { ActivityList, DocLinkText, NoList, NotFound, Pick, Reading, Section, Stat, TextField, report, useDataState, userName, vendorName } from "../components/bits"

export const DEV_RULES: [string, string, string][] = [
  ["QM-D1", "A deviation (before the fact) or waiver (after the fact) names its scope, the specification versus the accepted value, and validity by date or by quantity.", "DOC:p.265 QM-DEV-001"],
  ["QM-D2", "The Quality Manager and the Engineering Manager approve, with expiry; the Controller approves as well when the value impact passes the threshold. Types: Use-As-Is (waiver), Temporary Process Deviation, Customer-Approved Concession.", "DOC:p.265 QM-DEV-001; p.215 Book IV §7.3"],
  ["QM-D3", "Auto expiry: past the validity date, or once the quantity is used up, further use is blocked.", "DOC:p.265 QM-DEV-001"],
  ["QM-D4", "Acceptances are traceable and disclosed on the as-built record of every affected serial; affected serials and batches are written as genealogy evidence rows. Customer approval evidence (attachment + reference) is mandatory when the customer flag or contract requires it.", "DOC:p.265; p.215 Book IV §7.3"],
]

const remaining = (d: QtDeviation) => (d.validQty ? d.validQty - d.usedQty : undefined)

export function DeviationList() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-DEV-001")
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const due = s.deviations.filter((d) => d.state === "Approved" && d.validUntil && d.validUntil < TODAY).length
  const cols: Column<QtDeviation>[] = [
    { id: "id", header: "Deviation", value: (d) => d.id, mono: true, sortable: true, className: "w-32" },
    { id: "type", header: "Type", value: (d) => d.type, filterable: true },
    { id: "title", header: "Title", value: (d) => d.title },
    { id: "origin", header: "Origin", value: (d) => d.origin, filterable: true },
    { id: "scope", header: "Scope", value: (d) => d.scope.map((x) => x.id).join(", "), cell: (d) => <span className="flex flex-wrap gap-1">{d.scope.map((x) => <DocLinkText key={x.id} r={x} />)}</span> },
    { id: "spec", header: "Spec → accepted", value: (d) => `${d.specValue} → ${d.acceptedValue}`, cell: (d) => <span className="text-sm">{d.specValue} → <strong>{d.acceptedValue}</strong></span> },
    { id: "valid", header: "Valid until", value: (d) => d.validUntil ?? "", sortable: true, mono: true },
    { id: "qty", header: "Used / qty", value: (d) => d.usedQty, align: "right", mono: true, cell: (d) => (d.validQty ? `${d.usedQty} / ${d.validQty}` : `${d.usedQty}`) },
    { id: "state", header: "State", value: (d) => d.state, filterable: true },
  ]
  return (
    <>
      <ListPage
        header={{
          title: "Deviations and Waivers",
          screenId: "QM-DEV-001",
          description: "Traceable acceptances of material or product outside specification, approved by the Quality and Engineering managers with an expiry.",
          chips: <NoList text="State" />,
          primary: (
            <Button onClick={() => setOpen(true)}>
              <FilePlus2 aria-hidden="true" /> Request deviation
            </Button>
          ),
          actions: (
            <Button variant="outline" onClick={() => report(act.expire(), (n) => (n ? `${n} deviation(s) expired; further use blocked` : "Nothing past its validity date"))}>
              Run auto expiry {due ? `(${due} due)` : ""}
            </Button>
          ),
        }}
        above={
          <div className="flex flex-wrap gap-2">
            {(["Requested", "Approved", "Rejected", "Expired"] as const).map((st) => (
              <Stat key={st} label={st} value={s.deviations.filter((d) => d.state === st).length} tone={st === "Requested" ? "attention" : undefined} />
            ))}
          </div>
        }
        table={{
          rows: ds.empty ? [] : s.deviations, columns: cols, rowId: (d) => d.id, rowHref: (d) => `/quality/deviations/${d.id}`,
          searchText: (d) => `${d.id} ${d.title} ${d.scope.map((x) => x.id).join(" ")} ${d.affectedSerials.join(" ")}`, loading: ds.loading, error: ds.error, onRetry: ds.retry,
          empty: { title: "No deviations", body: "Deviations arrive from inspection failures worth accepting and from supplier deviation requests." },
        }}
        below={<RulesPanel rules={DEV_RULES} />}
      />
      <NewDeviation open={open} onClose={() => setOpen(false)} onDone={(id) => nav(`/quality/deviations/${id}`)} />
    </>
  )
}

function NewDeviation({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const s = useSlice("qualityTrace")
  const [o, setO] = useState({ title: "", type: "Use-As-Is (waiver)" as QtDeviation["type"], customerRequired: "", valueImpact: "", origin: "Inspection failure" as QtDeviation["origin"], scope: "", specReference: "", characteristic: "", specValue: "", acceptedValue: "", validUntil: addDays(TODAY, 60), validQty: "", vendorId: "", serials: "" })
  const set = (k: keyof typeof o) => (v: string) => setO({ ...o, [k]: v })
  const scopeOptions = [
    ...s.lots.filter((l) => !l.decision || l.decision === "Rejected").map((l) => ({ value: `inspectionLot:${l.id}`, label: `${l.id} · inspection ${l.batchId ?? l.serials[0] ?? ""}` })),
    ...s.batches.map((b) => ({ value: `batch:${b.id}`, label: `${b.id} · batch` })),
  ]
  return (
    <DialogShell
      open={open}
      onOpenChange={(x) => !x && onClose()}
      title="Request deviation or waiver"
      consequence="Creates the request; the Quality Manager and the Engineering Manager approve it with expiry (and the Controller above the value threshold) before it can be used."
      confirmLabel="Request"
      wide
      onConfirm={() => {
        const [type, id] = o.scope.split(":")
        const r = act.create({
          title: o.title, type: o.type, origin: o.origin, scope: o.scope ? [{ type, id } as DocRef] : [], specReference: o.specReference, characteristic: o.characteristic, specValue: o.specValue, acceptedValue: o.acceptedValue,
          validUntil: o.validUntil || undefined, validQty: o.validQty ? Number(o.validQty) : undefined, affectedSerials: o.serials.split(/[ ,]+/).filter(Boolean) as QtDeviation["affectedSerials"], vendorId: (o.vendorId || undefined) as QtDeviation["vendorId"],
          customerRequired: o.customerRequired === "Yes", valueImpact: o.valueImpact ? Number(o.valueImpact) : undefined,
        })
        if (!r.ok) return r.error
        report(r, (x) => `${x} requested`)
        onDone(r.value)
        return null
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField id="dv-title" label="Title" value={o.title} onChange={set("title")} />
        <Pick id="dv-type" label="Type" value={o.type} onChange={set("type")} options={DEVIATION_TYPES} />
        <Pick id="dv-cust" label="Customer flag or contract requires approval" value={o.customerRequired} onChange={set("customerRequired")} options={["Yes", "No"]} placeholder="No" />
        <TextField id="dv-val" label="Value impact (USD)" type="number" value={o.valueImpact} onChange={set("valueImpact")} hint={`Above ${DEV_CONTROLLER_THRESHOLD.toLocaleString("en-US")} the Controller also approves (QT-R27)`} />
        <Pick id="dv-origin" label="Origin" value={o.origin} onChange={set("origin")} options={["Inspection failure", "Supplier deviation request"]} />
        <Pick id="dv-scope" label="Scope" value={o.scope} onChange={set("scope")} options={scopeOptions} />
        <TextField id="dv-ref" label="Specification reference" value={o.specReference} onChange={set("specReference")} />
        <TextField id="dv-char" label="Characteristic" value={o.characteristic} onChange={set("characteristic")} />
        <TextField id="dv-spec" label="Specification value" value={o.specValue} onChange={set("specValue")} />
        <TextField id="dv-acc" label="Accepted value" value={o.acceptedValue} onChange={set("acceptedValue")} />
        <Pick id="dv-vendor" label="Vendor (supplier request)" value={o.vendorId} onChange={set("vendorId")} options={VENDORS.map((v) => ({ value: v.id, label: v.name }))} />
        <TextField id="dv-until" label="Valid until" type="date" value={o.validUntil} onChange={set("validUntil")} />
        <TextField id="dv-qty" label="Or valid for quantity" type="number" value={o.validQty} onChange={set("validQty")} />
        <TextField id="dv-ser" label="Affected serials" value={o.serials} onChange={set("serials")} placeholder="SN-TBD-..., comma separated" />
      </div>
    </DialogShell>
  )
}

export function DeviationDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-DEV-002")
  const d = s.deviations.find((x) => x.id === id)
  const [dlg, setDlg] = useState<null | "approve" | "reject" | "use">(null)
  const [ev, setEv] = useState("")
  const [qty, setQty] = useState("1")
  if (ds.error) return <ErrorAlert title="Could not load the deviation" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  if (!d) return <NotFound what="deviation" id={id} back={{ to: "/quality/deviations", label: "Back to Deviations and Waivers" }} />
  const blocked = d.state === "Expired" || d.state === "Rejected" || (d.validQty != null && d.usedQty >= d.validQty)
  const usingLots = s.lots.filter((l) => l.deviationId === d.id)
  return (
    <>
      <DetailPage
        header={{
          title: `${d.id} · ${d.title}`,
          screenId: "QM-DEV-001",
          crumbs: [{ label: "Deviations and Waivers", to: "/quality/deviations" }, { label: d.id }],
          description: `${d.type} from ${d.origin.toLowerCase()}. ${d.specReference}`,
          chips: (
            <>
              <NoList text={d.state} />
              {blocked && <Chip kind="block">Further use blocked</Chip>}
              {d.state === "Requested" && <><Reading id="QT-R08" /><Reading id="QT-R27" /></>}
            </>
          ),
          primary: d.state === "Requested" ? <Button onClick={() => setDlg("approve")}>Approve with expiry</Button> : d.state === "Approved" && !blocked ? <Button onClick={() => setDlg("use")}>Record use</Button> : undefined,
          actions: d.state === "Requested" ? <Button variant="outline" onClick={() => setDlg("reject")}>Reject</Button> : undefined,
        }}
        doc={{ type: "deviation", id: d.id }}
        summary={
          <>
            <KV k="Characteristic">{d.characteristic}</KV>
            <KV k="Specification">{d.specValue}</KV>
            <KV k="Accepted">{d.acceptedValue}</KV>
            <KV k="Valid until">{d.validUntil ?? "By quantity"}</KV>
            <KV k="Quantity">{d.validQty ? `${d.usedQty} used of ${d.validQty}` : `${d.usedQty} used`}</KV>
            <KV k="Vendor">{vendorName(d.vendorId) || "None"}</KV>
            <KV k="Requested">{`${d.requestedOn} by ${userName(d.requestedBy)}`}</KV>
            <KV k="Approvals">{`${d.approvals.length} of ${devApprovers(d).length}`}</KV>
          </>
        }
        tabs={[
          {
            id: "scope", label: "Scope and serials",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Scope">
                  <ul className="text-sm">{d.scope.map((x) => <li key={x.id}><DocLinkText r={x} /> <span className="text-muted-foreground">({x.type})</span></li>)}</ul>
                  {usingLots.length > 0 && <p className="text-sm">Accepted inspections: {usingLots.map((l) => l.id).join(", ")}</p>}
                </Section>
                <Section title="Affected serials (disclosed on as-built)">
                  {d.affectedSerials.length ? (
                    <ul className="flex flex-wrap gap-2 text-sm">{d.affectedSerials.map((x) => <li key={x}><DocLinkText r={{ type: "serial", id: x }} /></li>)}</ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No serial named.</p>
                  )}
                </Section>
                {d.validQty != null && (
                  <Section title="Quantity validity">
                    <Progress value={(d.usedQty / d.validQty) * 100} aria-label="Quantity used" />
                    <p className="text-sm">{remaining(d)} remaining</p>
                  </Section>
                )}
              </div>
            ),
          },
          {
            id: "evidence", label: "Customer evidence",
            content: (
              <Section title="Customer evidence slot">
                {d.customerEvidence ? <p className="text-sm">{d.customerEvidence}</p> : <p className="text-sm text-muted-foreground">{devNeedsCustomer(d) ? "Required before approval: the customer flag or contract requires the customer's approval (attachment + reference)." : "Not attached."}</p>}
                {d.state === "Requested" && (
                  <div className="flex items-end gap-2">
                    <TextField id="dv-ev" label="Evidence file" value={ev} onChange={setEv} placeholder="Customer concession letter.pdf" />
                    <Button variant="outline" size="sm" onClick={() => report(act.evidence(d.id, ev), "Evidence attached") && setEv("")}>Attach</Button>
                  </div>
                )}
              </Section>
            ),
          },
          {
            id: "approvals", label: "Approvals", count: d.approvals.length,
            content: (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow><TableHead>Role</TableHead><TableHead>By</TableHead><TableHead>On</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {devApprovers(d).map((r) => {
                    const a = d.approvals.find((x) => x.role === r)
                    return (
                      <TableRow key={r}>
                        <TableCell>{r}</TableCell>
                        <TableCell>{a ? userName(a.by) : "Pending"}</TableCell>
                        <TableCell className="tabular">{a?.on ?? ""}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ),
          },
          { id: "activity", label: "Activity", content: <ActivityList items={d.activity} /> },
          { id: "rules", label: "Rules", content: <RulesPanel rules={DEV_RULES} /> },
        ]}
      />
      <DialogShell
        open={dlg === "approve"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Approve ${d.id}`}
        consequence={`Records your approval. With every required approver (${devApprovers(d).join(", ")}), ${d.id} becomes Approved, valid ${d.validUntil ? `until ${d.validUntil}` : `for ${d.validQty} units`}; it then expires automatically.`}
        confirmLabel="Approve"
        onConfirm={() => {
          const r = act.approve(d.id)
          return report(r, "Approval recorded") ? null : (r as { error: string }).error
        }}
      >
        <p className="text-xs text-muted-foreground">Recorded here until WF-INBOX has a deviation approval kind <Reading id="QT-R08" /></p>
      </DialogShell>
      <DialogShell
        open={dlg === "reject"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Reject ${d.id}`}
        consequence="The request is rejected; the material stays under its inspection disposition."
        confirmLabel="Reject"
        destructive
        requireReason
        onConfirm={(r0) => {
          const r = act.reject(d.id, r0)
          return report(r, "Rejected") ? null : (r as { error: string }).error
        }}
      />
      <DialogShell
        open={dlg === "use"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Record use of ${d.id}`}
        consequence={`Consumes quantity under ${d.id}${d.validQty ? `; ${remaining(d)} remain` : ""}. Use is blocked after ${d.validUntil ?? "the quantity runs out"}.`}
        confirmLabel="Record use"
        onConfirm={() => {
          const r = act.use(d.id, Number(qty))
          return report(r, `Used ${qty}`) ? null : (r as { error: string }).error
        }}
      >
        <TextField id="dv-use" label="Quantity" type="number" value={qty} onChange={setQty} />
      </DialogShell>
    </>
  )
}
