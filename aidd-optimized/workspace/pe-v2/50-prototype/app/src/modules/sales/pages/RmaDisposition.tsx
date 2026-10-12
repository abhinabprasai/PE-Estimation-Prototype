// RMA-DISP Inspection and Disposition [DOC:p.253 Book VI; Book I A §3.6; Book IV §7.4] (asserted).
// Findings with the teardown checklist for RC3, the entitlement service verdict with its rule trail,
// a per-line disposition selector with an outcome preview. Actions: adjudicate warranty, approve
// dispositions (inspectors propose, Quality Manager approves; local until FR-10), convert denial to
// billable. Creates credit memo requests, rework orders, replacement orders, scrap postings, and an
// NCR / SCAR when attributable. Postings #18 to #23 per outcome.

import { useState } from "react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell } from "@/components/templates"
import { ApprovalButton, Chip, ErrorAlert, KV, PostingPreview, RulesPanel, SkeletonRows, useFirstVisitLoading } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import type { PostingLine } from "@/data/domain"
import { useCore, useRole, useSlice } from "@/store"
import { listDate, money, product } from "../data/model"
import { ATTRIBUTABLE, DISPOSITIONS, EXCLUSIONS, TEARDOWN_ITEMS, type Attributable, type Disposition, type Rma, type RmaLine } from "../data/ext-model"
import { adjudicatorIsActor, attachInspectionPhoto, exclusionNeeded, goodwillValue, needsGoodwill, closeRma, convertDenialToBillable, createScar, decideDispositions, dispositionErrors, entitlement, ncrForced, proposeDispositions, retryStep, saveFindings, startInspection, userName as userNameOf, INSPECT_ROLES, type Findings } from "../data/ext-actions"
import { A, ActivityList, Reading, RmaClassBadge, Section } from "../components/ext"

const RULES: [string, string, string][] = [
  ["DISP-a", "Inspectors propose dispositions; the Quality Manager approves them. Receiving cannot disposition.", "DOC:p.253 Book VI"],
  ["DISP-a2", "Segregation of duties: the person who recorded the warranty adjudication does not approve the disposition that creates the credit.", "FL-05 owners and roles"],
  ["DISP-b", "RC3 needs the teardown checklist (winding, core, oil test, bushing, tap changer) and photographs before a disposition.", "DOC:p.25 §3.6"],
  ["DISP-c", "Warranty Claim = Yes needs Failure Attributable To and a warranty adjudication (Approved or Denied) with a justification.", "DOC:p.25 §3.6"],
  ["DISP-d", "Manufacturing Defect or Component Supplier forces NCR Required: an NCR is created and linked; Component Supplier also offers a SCAR.", "DOC:INV 15.4; Part E §8"],
  ["DISP-e", "Each outcome runs as a separate retry-safe step: Restock #18 + #19, Repair Warranty #21 at RWO close, Repair Billable #22, Replace #23 at the $0 order's PGI + #19, Scrap #20.", "DOC:p.26 §3.7; Part J"],
  ["DISP-f", "A credit to a customer on credit hold stops at E-RMA-07 until the Controller releases it. Closure is blocked while a linked document is open.", "DOC:p.26 §3.7-3.8"],
  ["DISP-h", "Replace on an out-of-warranty or denied line is a goodwill replacement: the Controller approves it at any value (it posts to 5120 COGS without revenue) before the dispositions are approved.", "DOC:p.25 §3.6.1; p.27 §3.10"],
  ["DISP-i", "Return to Customer As-Is reverses the receipt entry (DR 5120 / CR 1335) because ownership returns to the customer; freight DR 6410 / CR 2100 when PE pays.", "DOC:p.25 §3.6.1"],
  ["DISP-j", "Adjudication references the exclusions catalog (site conditions, installation error categories).", "DOC:p.215 §7.4"],
  ["DISP-g", "Warranty start: ship date by default; the contract may elect POD or commissioning date, capped at ship + N months; extensions are dated and approved.", "DOC:p.215 §7.4"],
]

function outcomeLines(r: Rma, l: RmaLine, d?: Disposition): PostingLine[] {
  const qty = l.qtyRecd || l.qtyAuth
  const val = qty * l.valuation
  const credit = Math.round(qty * l.origPrice * (1 - r.restockPct / 100) * 100) / 100
  const cp = "Customer property: non-valuated, nothing to move in inventory"
  switch (d) {
    case "Restock":
      return [l.customerProperty ? { template: 18, amount: null, notPostedReason: cp } : { template: 18, amount: val, detail: `${qty} × ${l.itemId} back to unrestricted` }, { template: 19, amount: credit, detail: `Credit note via CMR${r.restockPct ? `, ${r.restockPct}% restocking fee to 4910` : ""}` }]
    case "Repair — Warranty":
      return [{ template: 21, amount: null, notPostedReason: "Posts actual repair cost at rework order close (2610 Warranty Reserve, overflow 6300)" }]
    case "Repair — Billable":
      return [{ template: 22, amount: null, notPostedReason: "Posts cost and the service invoice at rework order close; service quote first" }]
    case "Replace":
      return [{ template: 23, amount: null, notPostedReason: `Posts standard cost at the $0 replacement order's PGI to ${r.warranty === "No" || r.warranty === "Denied" || r.goodwill ? "5120 COGS (goodwill, Controller approval)" : "6300 Warranty Expense"}` }, { template: 19, amount: Math.round(qty * l.origPrice * 100) / 100, detail: "Original line credited in full" }]
    case "Scrap":
      return [l.customerProperty ? { template: 20, amount: null, notPostedReason: cp } : { template: 20, amount: val, detail: `${qty} × ${l.itemId}, cost center CC-1500 Quality` }]
    case "Return to Customer As-Is":
      return [l.customerProperty ? { template: 17, amount: null, notPostedReason: "Customer property: no receipt entry to reverse" } : { template: 17, amount: -val, detail: "Receipt reversal DR 5120 / CR 1335: ownership returns to the customer" }, { template: 26, amount: r.freight === "PE Pays" ? 1200 : null, detail: "Freight out accrual", notPostedReason: r.freight === "PE Pays" ? undefined : "Customer pays freight" }]
    default:
      return []
  }
}

export function RmaDisposition() {
  const { id = "" } = useParams()
  const db = useSlice("sales")
  const loading = useFirstVisitLoading(`rma-disp-${id}`)
  const r = db.rmas.find((x) => x.id === id)
  const [form, setForm] = useState<Findings | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [convert, setConvert] = useState(false)
  const [rejectDisp, setRejectDisp] = useState(false)
  const [role] = useRole()
  const { userId } = useCore()
  if (!r) return <ErrorAlert title="RMA not found">No RMA {id} in this prototype. Open the RMA register.</ErrorAlert>
  if (loading)
    return (
      <Table aria-label="Loading disposition">
        <TableBody>
          <SkeletonRows cols={5} rows={6} />
        </TableBody>
      </Table>
    )
  const f: Findings = form ?? {
    findings: r.findings ?? "",
    teardown: r.teardown ?? {},
    attributable: r.attributable,
    verdict: r.adjudication?.verdict,
    justification: r.adjudication?.justification ?? "",
    exclusion: r.adjudication?.exclusion,
    dispositions: Object.fromEntries(r.lines.map((l) => [l.no, l.disposition])),
  }
  const set = (patch: Partial<Findings>) => setForm({ ...f, ...patch })
  const editable = r.status === "In Inspection"
  const ib = r.ibId ? db.ib.find((i) => i.id === r.ibId) : r.lines.map((l) => db.ib.find((i) => i.serial === l.serial)).find(Boolean)
  const recall = r.recallId ?? ib?.history.find((h) => h.doc?.type === "recall")?.doc?.id
  const ent = ib ? entitlement(ib, r.requested, recall) : null
  const run = (res: { ok: boolean; error?: string }, msg: string) => {
    if (!res.ok) setErr(res.error ?? "Not done")
    else {
      setErr(null)
      toast.success(msg)
    }
    return res.ok
  }
  const saveAnd = (then?: () => void) => {
    if (!form) return then?.()
    if (run(saveFindings(r.id, form), "Inspection results saved")) {
      setForm(null)
      then?.()
    }
  }
  const preview = r.lines.flatMap((l) => outcomeLines(r, l, f.dispositions[l.no]))
  const pendingErrs = editable ? dispositionErrors({ ...r, findings: f.findings, teardown: f.teardown, attributable: f.attributable, adjudication: f.verdict ? { verdict: f.verdict, justification: f.justification, by: "", on: "", exclusion: f.exclusion } : r.adjudication, lines: r.lines.map((l) => ({ ...l, disposition: f.dispositions[l.no] })) }) : []
  const c = db.customers.find((x) => x.id === r.customerId)

  const primary =
    r.status === "Received" ? (
      <Button onClick={() => run(startInspection(r.id), "Inspection started")}>Start inspection</Button>
    ) : r.status === "In Inspection" ? (
      <Button disabled={pendingErrs.length > 0} title={pendingErrs.join(" ")} onClick={() => saveAnd(() => run(proposeDispositions(r.id), "Dispositions proposed: the Quality Manager approves them"))}>
        Propose dispositions
      </Button>
    ) : r.status === "Disposition Pending" && needsGoodwill(r) && r.goodwillDecision?.outcome !== "Approved" && !r.goodwillDecision ? (
      <ApprovalButton kind="RMA approval" subject={{ type: "rma", id: r.id }} title={`${r.id} goodwill replacement (out of warranty), ${c?.name}`} amount={goodwillValue(r)} ctx={{ rmaClass: r.cls, warranty: false, goodwill: true }} label="Submit goodwill replacement for approval" variant="default" stay />
    ) : r.status === "Disposition Pending" ? (
      (() => {
        const why = role !== "Quality Manager" ? `The Quality Manager approves dispositions. You are acting as ${role}.` : adjudicatorIsActor(r, role, userId) ? "Segregation of duties: you recorded the warranty adjudication, so another Quality Manager approves." : undefined
        return (
          <Button disabled={!!why} title={why} onClick={() => run(decideDispositions(r.id, "Approved"), "Dispositions approved: settlement started")}>
            Approve dispositions
          </Button>
        )
      })()
    ) : r.status === "Settling" ? (
      <Button onClick={() => run(closeRma(r.id), `${r.id} Closed`)}>Close RMA</Button>
    ) : undefined

  return (
    <>
      <DetailPage
        header={{
          title: `${r.id} · inspection and disposition`,
          screenId: "RMA-DISP",
          crumbs: [{ label: "RMA register", to: "/sales/rma" }, { label: r.id, to: `/sales/rma/${r.id}` }, { label: "Disposition" }],
          description: `${c?.name ?? r.customerId} · ${r.reason} · received ${r.receivedDate ? listDate(r.receivedDate) : "not yet"}`,
          chips: (
            <>
              <RmaClassBadge cls={r.cls} />
              <span className="inline-flex items-center gap-1 text-xs">Warranty claim <StatusBadge kind="warrantyClaim" status={r.warranty} size="sm" /></span>
              {r.ncrId && <Chip kind="flag" note="NCR Required forced by the attributable cause">NCR {r.ncrId}</Chip>}
              {r.scarId && <Chip kind="flag">SCAR {r.scarId}</Chip>}
              {r.goodwill && <Chip kind="flag" note="Replace on an out-of-warranty or denied line posts to 5120 COGS; Controller approval at any value (p.27 §3.10)">Goodwill replacement{r.goodwillDecision ? `: Controller ${r.goodwillDecision.outcome.toLowerCase()}` : r.goodwillReq ? `: waiting for ${r.goodwillReq}` : ": Controller approval needed"}</Chip>}
              {r.status === "Disposition Pending" && <Reading id="SR-16" note="Disposition approval is decided here by the Quality Manager until the shared approval engine has an 'RMA disposition' kind routing to the Quality Manager only (FR-10); the 'RMA approval' route would put the CS Manager first" />}
              {r.adjudication && <Chip kind="design" note="Segregation of duties: the adjudicator does not approve the credit">Adjudicated by {r.adjudication.byUser ? userNameOf(r.adjudication.byUser) : r.adjudication.by}</Chip>}
            </>
          ),
          actions: (
            <>
              {editable && <Button variant="outline" disabled={!form} onClick={() => saveAnd()}>Save results</Button>}
              {r.status === "Disposition Pending" && role === "Quality Manager" && <Button variant="outline" onClick={() => setRejectDisp(true)}>Reject dispositions</Button>}
              {(editable || r.status === "Disposition Pending") && r.adjudication?.verdict === "Warranty Denied" && r.cls !== "RC4" && <Button variant="outline" onClick={() => setConvert(true)}>Convert denial to billable</Button>}
              {r.attributable === "Component Supplier" && !r.scarId && <Button variant="outline" onClick={() => run(createScar(r.id), "SCAR requested")}>Create SCAR</Button>}
              <Button variant="ghost" asChild><Link to={`/sales/rma/${r.id}`}>Open RMA</Link></Button>
            </>
          ),
          primary,
        }}
        status={{ kind: "rma", value: r.status }}
        doc={{ type: "rma", id: r.id }}
        summary={
          <>
            <KV k="Lines">{r.lines.length} ({r.lines.reduce((s, l) => s + l.qtyRecd, 0)} units received)</KV>
            <KV k="Attributable to">{r.attributable ?? "Not set"}</KV>
            <KV k="Adjudication">{r.adjudication ? `${r.adjudication.verdict} (${r.adjudication.by}, ${r.adjudication.on})` : "Not adjudicated"}</KV>
            <KV k="Inspector roles">{INSPECT_ROLES.join(", ")}</KV>
          </>
        }
        tabs={[
          {
            id: "inspect",
            label: "Findings and adjudication",
            content: (
              <div className="flex flex-col gap-4">
                {err && <ErrorAlert title="Action not done" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
                {!["Received", "In Inspection", "Disposition Pending", "Settling", "Closed"].includes(r.status) && (
                  <ErrorAlert title="Nothing to inspect yet">{r.id} is {r.status}. Inspection starts after the return is received at the receipt kiosk.</ErrorAlert>
                )}
                {editable && pendingErrs.length > 0 && (
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">Before proposing:</p>
                    <ul className="list-disc pl-4">{pendingErrs.map((e) => <li key={e}>{e}</li>)}</ul>
                  </div>
                )}
                <div className="grid gap-4 lg:grid-cols-2">
                  <Section title="Entitlement service verdict">
                    {ent ? (
                      <>
                        <p className="text-sm">
                          <span className="font-semibold">{ent.verdict === "covered" ? "Covered" : ent.verdict === "conditional" ? "Covered, conditional" : "Not covered"}</span> · {listDate(ent.start)} to {listDate(ent.end)} ({ent.months} months) · unit <A to={`/service/installed-base/${ib!.id}`}>{ib!.serial}</A>
                        </p>
                        <ol className="list-decimal pl-4 text-xs text-muted-foreground" aria-label="Rule trail">
                          {ent.trail.map((t) => <li key={t}>{t}</li>)}
                        </ol>
                        <Reading id="SR-10" note="Election cap N = 6 months after ship (the PRD says 'configurable N'); claim date = RMA request date" />
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No installed base record for these lines (component or distribution return): warranty is judged on the invoice date and the item's warranty months.</p>
                    )}
                  </Section>
                  <Section title="Warranty adjudication">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="d-attr">Failure attributable to</Label>
                        <Select value={f.attributable ?? ""} onValueChange={(v) => set({ attributable: v as Attributable })} disabled={!editable}>
                          <SelectTrigger id="d-attr"><SelectValue placeholder="Not set" /></SelectTrigger>
                          <SelectContent>{ATTRIBUTABLE.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                        {ncrForced(f.attributable) && <span className="text-xs">NCR Required: forced on</span>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="d-verdict">Verdict</Label>
                        <Select value={f.verdict ?? ""} onValueChange={(v) => set({ verdict: v as Findings["verdict"] })} disabled={!editable || r.warranty === "No"}>
                          <SelectTrigger id="d-verdict"><SelectValue placeholder={r.warranty === "No" ? "No warranty claim" : "Not adjudicated"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Warranty Approved">Warranty Approved</SelectItem>
                            <SelectItem value="Warranty Denied">Warranty Denied</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <Label htmlFor="d-just">Justification</Label>
                        <Textarea id="d-just" value={f.justification} disabled={!editable} onChange={(e) => set({ justification: e.target.value })} />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <Label htmlFor="d-exc">Exclusion (exclusions catalog){exclusionNeeded(f.verdict, f.attributable) ? ", required for this denial" : ""}</Label>
                        <Select value={f.exclusion ?? "none"} onValueChange={(v) => set({ exclusion: v === "none" ? undefined : v })} disabled={!editable || !f.verdict}>
                          <SelectTrigger id="d-exc"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None cited</SelectItem>
                            {EXCLUSIONS.map((x) => <SelectItem key={x.code} value={x.code}>{x.code} {x.category}: {x.text}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          Categories per the PRD: site conditions, installation error.
                          <Reading id="SR-19" note="The catalog entries are design values; the PRD names only the two categories. An exclusion is required when a denial is attributed to Site Conditions or Installation Error" />
                        </span>
                      </div>
                    </div>
                  </Section>
                </div>
                <Section title="Findings">
                  <Textarea aria-label="Findings summary" value={f.findings} disabled={!editable} onChange={(e) => set({ findings: e.target.value })} />
                  {r.cls === "RC3" && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">Photographs (mandatory for RC3):</span>
                      {r.inspectionPhotos?.length ? r.inspectionPhotos.map((p) => <span key={p} className="rounded-md border px-2 py-0.5 font-mono text-xs">{p}</span>) : <span className="text-muted-foreground">None attached</span>}
                      {editable && <Button size="sm" variant="outline" onClick={() => run(attachInspectionPhoto(r.id), "Photograph attached")}>Attach photograph</Button>}
                    </div>
                  )}
                  {r.cls === "RC3" && (
                    <div className="grid gap-2 md:grid-cols-2">
                      <p className="col-span-full text-sm font-medium">RC3 teardown checklist (photographs mandatory)</p>
                      {TEARDOWN_ITEMS.map((t) => (
                        <div key={t} className="flex flex-col gap-1">
                          <Label htmlFor={`td-${t}`} className="text-xs">{t}</Label>
                          <Input id={`td-${t}`} className="h-8" disabled={!editable} value={f.teardown[t] ?? ""} onChange={(e) => set({ teardown: { ...f.teardown, [t]: e.target.value } })} />
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            ),
          },
          {
            id: "dispositions",
            label: "Dispositions",
            count: r.lines.length,
            content: (
              <div className="flex flex-col gap-4">
                {err && <ErrorAlert title="Action not done" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
                <Table aria-label="Per-line disposition">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Item / serial</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Disposition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.lines.map((l) => (
                      <TableRow key={l.no}>
                        <TableCell className="tabular">{l.no}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {l.itemId} {l.serial && `· ${l.serial}`}
                          <span className="block font-sans text-muted-foreground">{product(l.itemId).description}{l.customerProperty ? " · customer property" : ""}{l.unauthorized ? " · unauthorized return" : ""}</span>
                        </TableCell>
                        <TableCell className="tabular text-right">{l.qtyRecd} of {l.qtyAuth}</TableCell>
                        <TableCell>{l.condition ?? "Not received"}{l.photo && <span className="block text-xs">photo {l.photo}</span>}</TableCell>
                        <TableCell>{l.expected ?? "Not set"}</TableCell>
                        <TableCell>
                          <Select value={f.dispositions[l.no] ?? ""} onValueChange={(v) => set({ dispositions: { ...f.dispositions, [l.no]: v as Disposition } })} disabled={!editable}>
                            <SelectTrigger aria-label={`Disposition line ${l.no}`} className="h-8 w-56"><SelectValue placeholder="Choose" /></SelectTrigger>
                            <SelectContent>
                              {DISPOSITIONS.map((d) => (
                                <SelectItem key={d} value={d} disabled={d === "Repair — Warranty" && f.verdict === "Warranty Denied"}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PostingPreview title="Outcome preview: postings per disposition" lines={preview.length ? preview : [{ template: 18, amount: null, notPostedReason: "Choose a disposition per line to preview its postings" }]} />
                {r.lines.some((l) => f.dispositions[l.no] === "Return to Customer As-Is") && <Reading id="SR-12" note="Return-as-is freight accrual shown at $1,200.00 when PE pays; the prototype has no carrier quote source" />}
              </div>
            ),
          },
          {
            id: "settlement",
            label: "Settlement",
            count: r.settlement.length,
            content: r.settlement.length ? (
              <div className="flex flex-col gap-2">
                {err && <ErrorAlert title="Action not done" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
                <Table aria-label="Settlement steps">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.settlement.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono">{s.id}</TableCell>
                        <TableCell className="tabular">{s.line}</TableCell>
                        <TableCell className="max-w-96 whitespace-normal">{s.label}{s.template && <span className="block text-xs text-muted-foreground">#{s.template} · {s.detail}</span>}</TableCell>
                        <TableCell className="tabular text-right">{s.amount != null ? money(s.amount) : "At its trigger"}</TableCell>
                        <TableCell>{s.doc ? <A to={s.doc.type === "salesOrder" ? `/sales/orders/${s.doc.id}` : s.doc.type === "quotation" ? `/sales/quotations/${s.doc.id}` : `/sales/rma/${r.id}`}>{s.doc.id}</A> : "None"}</TableCell>
                        <TableCell>
                          {s.done ? "Done" : s.error ? (
                            <span className="flex flex-col gap-1">
                              <Chip kind="hold">{s.error}</Chip>
                              <Button size="sm" variant="outline" onClick={() => run(retryStep(r.id, s.id), `${s.id} done`)}>Retry step</Button>
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => run(retryStep(r.id, s.id), `${s.id} done`)}>Run step</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PostingPreview title="Settlement postings" lines={r.settlement.filter((s) => s.template).map((s) => ({ template: s.template!, amount: s.amount, detail: s.detail, notPostedReason: s.amount == null ? s.detail : undefined }))} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Settlement runs after the dispositions are approved in the approvals inbox. Each outcome is a separate step you can retry.</p>
            ),
          },
          { id: "activity", label: "Activity", content: <ActivityList items={r.activity} /> },
        ]}
        aside={<RulesPanel rules={RULES} />}
      />
      <DialogShell
        open={rejectDisp}
        onOpenChange={setRejectDisp}
        title={`Reject the dispositions on ${r.id}`}
        consequence="The RMA goes back to In Inspection so the inspector can change the proposal. Nothing is settled or posted."
        confirmLabel="Reject dispositions"
        destructive
        requireReason
        onConfirm={(reason) => {
          const x = decideDispositions(r.id, "Rejected", reason)
          return x.ok ? null : x.error
        }}
      />
      <DialogShell
        open={convert}
        onOpenChange={setConvert}
        title={`Convert ${r.id} to billable repair`}
        consequence="The warranty denial letter goes to the customer from the template, the RMA becomes RC4 Billable Repair, every line becomes Repair — Billable, and a service quote is required before work starts."
        confirmLabel="Convert to billable"
        onConfirm={() => {
          const x = convertDenialToBillable(r.id)
          return x.ok ? null : x.error
        }}
      />
    </>
  )
}
