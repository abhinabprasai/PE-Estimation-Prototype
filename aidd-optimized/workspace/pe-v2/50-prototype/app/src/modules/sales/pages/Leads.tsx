// OM-LEAD-001/2 Leads and Opportunities [DOC:pp.248-249 Book VI §4, §4.1] (asserted).
// Pipeline board grouped by stage with value and age on every card, plus a register with the
// standard filter bar. Detail: contact block, requirement capture (the quotation's configuration
// attributes), prior build lookup on the design library, qualification checklist, activity timeline.
// Postings and scans: none; no credit exposure exists before a quotation.

import { useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DetailPage, DialogShell, ListPage, PageHeader } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, KV, RulesPanel, SkeletonRows, useFirstVisitLoading, type Column } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { Table, TableBody } from "@/components/ui/table"
import { USERS } from "@/data/shared/users"
import { useCore, useRole, useSlice } from "@/store"
import { daysBetween, money, product, TODAY } from "../data/model"
import { DISQUALIFY_REASONS, LEAD_SOURCES, LEAD_STAGES, QUAL_CHECKLIST, REGIONS, REQ_FIELDS, type Lead, type LeadSource, type LeadStage, type PriorDecision, type Requirement } from "../data/ext-model"
import {
  ageDays, choosePriorBuild, convertLeadToQuote, createLead, deleteLead, disqualifyLead, qualifyLead, reassignLead, runPriorSearch, toggleChecklist, updateLead, userName, type NewLead,
  ITEM_BY_KVA,
} from "../data/ext-actions"
import { A, ActivityList, LeadStageBadge, Reading, Section, StatPill } from "../components/ext"
import { cn } from "@/lib/utils"

const RULES: [string, string, string][] = [
  ["V-OM-40", "Duplicate warning on company name and email domain across leads and customers, on save.", "DOC:p.249 §4.1"],
  ["V-OM-41", "Stage transitions only along Open → Qualified → Quoting → Won / Lost; Disqualified from Open or Qualified with a reason code. Won and Lost only from the linked quotation, never by hand.", "DOC:p.249 §4.1"],
  ["V-OM-42", "Conversion blocked while mandatory contact fields are empty (company, contact name, email).", "DOC:p.249 §4.1"],
  ["E-OM-43", "Hard stop on deleting a lead that owns a quotation; disqualify instead.", "DOC:p.249 §4.1"],
  ["OM-LEAD-a", "Open to Qualified requires the qualification checklist complete; Qualified to Quoting happens automatically at quotation creation.", "DOC:p.249 §4.1"],
  ["OM-LEAD-b", "Conversion creates the customer in Prospect with no credit limit; a prospect is not selectable on a sales order.", "DOC:p.249 §4.1"],
  ["OM-LEAD-c", "Owner defaults to the creator and is reassigned only by the Sales Director.", "DOC:p.249 §4.1"],
  ["OM-LEAD-d", "Sales reps own their records: a Sales rep cannot change another rep's lead. The Sales Director reads all.", "DOC:p.248 OM-LEAD users"],
]

const PRODUCT_CLASSES = ["ETO", "MTO", "MTS"] as const
const productClass = (l: Lead) => {
  const item = ITEM_BY_KVA[(l.req.kva ?? "").replace(/[^0-9]/g, "")]
  return item ? product(item).kind : "ETO"
}
const valueUsd = (l: Lead) => (l.currency === "CAD" ? l.estValue / 1.36 : l.estValue)

// ============================================================================ list + board
export function LeadList() {
  const db = useSlice("sales")
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const view = sp.get("view") === "register" ? "register" : "board"
  const sim = sp.get("state")
  const loading = useFirstVisitLoading("OM-LEAD-001")
  const [open, setOpen] = useState(false)
  const leads = sim === "empty" ? [] : db.leads

  const stats = useMemo(() => {
    const by = Object.fromEntries(LEAD_STAGES.map((s) => [s, leads.filter((l) => l.stage === s)])) as Record<LeadStage, Lead[]>
    const reachedQualified = leads.filter((l) => l.stage !== "Open" && l.stage !== "Disqualified").length
    const reachedQuoting = leads.filter((l) => ["Quoting", "Won", "Lost"].includes(l.stage)).length
    const decided = leads.filter((l) => l.stage === "Won" || l.stage === "Lost")
    const winBySource = LEAD_SOURCES.map((src) => {
      const d = decided.filter((l) => l.source === src)
      return { src, n: d.length, rate: d.length ? Math.round((d.filter((l) => l.stage === "Won").length / d.length) * 100) : null }
    }).filter((x) => x.n)
    const winByClass = PRODUCT_CLASSES.map((pc) => {
      const d = decided.filter((l) => productClass(l) === pc)
      return { pc, n: d.length, rate: d.length ? Math.round((d.filter((l) => l.stage === "Won").length / d.length) * 100) : null }
    }).filter((x) => x.n)
    const avgAge = Object.fromEntries(LEAD_STAGES.map((s) => [s, by[s].length ? Math.round(by[s].reduce((a, l) => a + daysBetween(l.stageSince, TODAY), 0) / by[s].length) : null])) as Record<LeadStage, number | null>
    return { by, convQ: leads.length ? Math.round((reachedQualified / leads.length) * 100) : 0, convQt: reachedQualified ? Math.round((reachedQuoting / reachedQualified) * 100) : 0, convWon: reachedQuoting ? Math.round((decided.filter((l) => l.stage === "Won").length / reachedQuoting) * 100) : 0, convLost: reachedQuoting ? Math.round((decided.filter((l) => l.stage === "Lost").length / reachedQuoting) * 100) : 0, winBySource, winByClass, avgAge }
  }, [leads])

  const header = {
    title: "Leads and opportunities",
    screenId: "OM-LEAD-001/2",
    description: "The first formal record of demand, before the customer master. Answer the repeat-build question before engineering spends an hour.",
    actions: (
      <div role="radiogroup" aria-label="View" className="inline-flex gap-1 rounded-md border p-1 text-xs">
        {(["board", "register"] as const).map((v) => (
          <button key={v} role="radio" aria-checked={view === v} onClick={() => setSp(v === "board" ? {} : { view: v })} className={cn("h-6 rounded-md px-2", view === v && "bg-secondary font-semibold")}>
            {v === "board" ? "Pipeline board" : "Register"}
          </button>
        ))}
      </div>
    ),
    primary: <Button onClick={() => setOpen(true)}>New lead</Button>,
  }
  const summary = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" aria-label="Pipeline report: count and value by stage">
        {LEAD_STAGES.map((s) => (
          <StatPill key={s} label={s} value={`${stats.by[s].length} · ${money(stats.by[s].reduce((a, l) => a + valueUsd(l), 0))} · avg ${stats.avgAge[s] ?? 0} d`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Conversion Open → Qualified {stats.convQ}% · Qualified → Quoting {stats.convQt}% · Quoting → Won {stats.convWon}% / Lost {stats.convLost}% · Win rate by source: {stats.winBySource.map((w) => `${w.src} ${w.rate}% (${w.n})`).join(", ") || "no decided leads"} · Win rate by product class: {stats.winByClass.map((w) => `${w.pc} ${w.rate}% (${w.n})`).join(", ") || "no decided leads"} · Average age per stage = days in the current stage (avg d on each pill) · Values in USD (CAD at 1.36) <Reading id="SR-2" note="Pipeline values mix USD and CAD; converted at the fixed 1.36 rate the FL-09 build uses (OQ-42)" /> <Reading id="SR-23" note="Product class of a lead = the make class (ETO, MTO, MTS) of the catalogue item its kVA rating maps to; leads with no mapped rating count as ETO. Average age = days since the lead entered its current stage" />
      </p>
    </div>
  )
  const dialog = <NewLeadDialog open={open} onOpenChange={setOpen} onCreated={(id) => nav(`/sales/leads/${id}`)} />

  if (sim === "error")
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        <ErrorAlert title="Leads could not be loaded" action={<button className="underline" onClick={() => setSp({})}>Retry</button>}>The pipeline service did not answer. Nothing was changed. Retry, or open a lead from global search (Ctrl K).</ErrorAlert>
      </div>
    )

  if (view === "board")
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        {summary}
        {!loading && leads.length === 0 ? (
          <EmptyState title="No leads yet">Leads arrive from the Sales sidebar, inbound web and email capture, and trade contact import. Create the first one with New lead.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6" aria-label="Pipeline board grouped by stage">
            {LEAD_STAGES.map((s) => (
              <section key={s} aria-label={`${s} column`} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted p-2">
                <h2 className="flex items-center justify-between text-sm font-semibold">
                  <LeadStageBadge stage={s} size="sm" />
                  <span className="tabular text-xs text-muted-foreground">{stats.by[s].length}</span>
                </h2>
                {loading ? (
                  <div className="h-16 animate-pulse rounded-md bg-background" aria-hidden="true" />
                ) : stats.by[s].length === 0 ? (
                  <p className="text-xs text-muted-foreground">None</p>
                ) : (
                  stats.by[s].map((l) => (
                    <A key={l.id} to={`/sales/leads/${l.id}`} className="block rounded-md border bg-background p-2 text-sm no-underline">
                      <span className="block font-mono text-xs">{l.id}</span>
                      <span className="block truncate font-medium text-foreground" title={l.title}>
                        {l.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground" title={l.company}>
                        {l.company}
                      </span>
                      <span className="tabular mt-1 flex justify-between text-xs text-foreground">
                        <span>{money(l.estValue, l.currency)}</span>
                        <span>{ageDays(l.stageSince)} d in stage</span>
                      </span>
                    </A>
                  ))
                )}
              </section>
            ))}
          </div>
        )}
        {dialog}
        <RulesPanel rules={RULES} />
      </div>
    )

  const columns: Column<Lead>[] = [
    { id: "id", header: "Lead", value: (l) => l.id, sortable: true, mono: true },
    { id: "title", header: "Title", value: (l) => l.title, className: "max-w-72 truncate" },
    { id: "company", header: "Company", value: (l) => l.company, sortable: true, className: "max-w-60 truncate" },
    { id: "stage", header: "Stage", value: (l) => l.stage, cell: (l) => <LeadStageBadge stage={l.stage} size="sm" />, filterable: true, sortable: true },
    { id: "source", header: "Source", value: (l) => l.source, filterable: true },
    { id: "region", header: "Region", value: (l) => l.region, filterable: true },
    { id: "owner", header: "Owner", value: (l) => userName(l.ownerId), filterable: true },
    { id: "value", header: "Estimated value", value: (l) => valueUsd(l), cell: (l) => money(l.estValue, l.currency), sortable: true, align: "right", mono: true },
    { id: "prob", header: "Win %", value: (l) => l.winProb, sortable: true, align: "right", mono: true },
    { id: "age", header: "Age in stage (d)", value: (l) => ageDays(l.stageSince), sortable: true, align: "right", mono: true },
    { id: "quotes", header: "Quotations", value: (l) => l.quotationIds.join(", ") || "None" },
  ]
  return (
    <>
      <ListPage<Lead>
        header={header}
        above={summary}
        table={{
          rows: leads, columns, rowId: (l) => l.id, rowHref: (l) => `/sales/leads/${l.id}`, loading,
          searchText: (l) => `${l.id} ${l.title} ${l.company} ${l.email}`, searchPlaceholder: "Search lead, company, email",
          empty: { title: "No leads yet", body: "Create the first one with New lead." }, initialSort: { id: "age", dir: "desc" },
        }}
        below={<RulesPanel rules={RULES} />}
      />
      {dialog}
    </>
  )
}

function NewLeadDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const blank: NewLead = { title: "", company: "", contactName: "", contactTitle: "", email: "", phone: "", address: "", source: "Website", region: REGIONS[0], estValue: 0, currency: "USD" }
  const [f, setF] = useState<NewLead>(blank)
  const [dup, setDup] = useState<string | null>(null)
  const save = (force: boolean) => {
    const r = createLead(f, force)
    if (r.ok) {
      setF(blank)
      setDup(null)
      onOpenChange(false)
      toast.success(`${r.value} created in Open`)
      onCreated(r.value)
      return null
    }
    if (r.field === "duplicate") {
      setDup(r.error)
      return r.error
    }
    return r.error
  }
  const field = (k: keyof NewLead, label: string, type = "text") => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`nl-${k}`}>{label}</Label>
      <Input id={`nl-${k}`} type={type} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
    </div>
  )
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setDup(null)
      }}
      wide
      title="New lead"
      description="Company name is mandatory. Owner defaults to you. The duplicate check runs on save (V-OM-40)."
      confirmLabel="Save lead"
      onConfirm={() => save(false)}
      secondary={dup ? <Button variant="outline" onClick={() => save(true)}>Save anyway</Button> : undefined}
    >
      <div className="grid grid-cols-2 gap-4">
        {field("title", "Title")}
        {field("company", "Company name (required)")}
        {field("contactName", "Contact name")}
        {field("contactTitle", "Contact title")}
        {field("email", "Email", "email")}
        {field("phone", "Phone")}
        <div className="col-span-2">{field("address", "Address")}</div>
        <div className="flex flex-col gap-1">
          <Label>Source</Label>
          <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v as LeadSource })}>
            <SelectTrigger aria-label="Source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Region</Label>
          <Select value={f.region} onValueChange={(v) => setF({ ...f, region: v })}>
            <SelectTrigger aria-label="Region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field("estValue", "Estimated value", "number")}
        <div className="flex flex-col gap-1">
          <Label>Currency (from the entity)</Label>
          <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "USD" | "CAD" })}>
            <SelectTrigger aria-label="Currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD (LE-TBD-10)</SelectItem>
              <SelectItem value="CAD">CAD (LE-TBD-30)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {dup && <p className="rounded-md border border-status-exception px-4 py-2 text-sm">{dup}</p>}
    </DialogShell>
  )
}

// ============================================================================ detail
export function LeadDetail() {
  const { id = "" } = useParams()
  const db = useSlice("sales")
  const [role] = useRole()
  const { userId } = useCore()
  const nav = useNavigate()
  const l = db.leads.find((x) => x.id === id || x.oppId === id)
  const [err, setErr] = useState<string | null>(null)
  const [req, setReq] = useState<Requirement | null>(null)
  const [dq, setDq] = useState(false)
  const [dqReason, setDqReason] = useState<string>("")
  const [owner, setOwner] = useState(false)
  const [ownerId, setOwnerId] = useState("")
  const [del, setDel] = useState(false)
  const loading = useFirstVisitLoading(`lead-${id}`)
  if (!l) return <ErrorAlert title="Lead not found">No lead {id} in this prototype. Open the lead list.</ErrorAlert>
  if (loading)
    return (
      <Table aria-label="Loading lead">
        <TableBody>
          <SkeletonRows cols={4} rows={6} />
        </TableBody>
      </Table>
    )
  const closed = ["Won", "Lost", "Disqualified"].includes(l.stage)
  const r = req ?? l.req
  const run = (res: { ok: boolean; error?: string }, msg: string) => {
    if (!res.ok) setErr(res.error ?? "Not done")
    else {
      setErr(null)
      toast.success(msg)
    }
    return res.ok
  }
  const primary =
    l.stage === "Open" ? (
      <Button onClick={() => run(qualifyLead(l.id), "Qualified to opportunity")}>Qualify to opportunity</Button>
    ) : l.stage === "Qualified" || l.stage === "Quoting" ? (
      <Button
        onClick={() => {
          const res = convertLeadToQuote(l.id)
          if (run(res, "Quotation created in Draft") && res.ok) nav(`/sales/quotations/${res.value}`)
        }}
      >
        Convert to quotation
      </Button>
    ) : undefined
  const custStatus = l.customerId ? db.customers.find((c) => c.id === l.customerId)?.status : undefined

  return (
    <>
      <DetailPage
        header={{
          title: `${l.id}${l.oppId ? ` · ${l.oppId}` : ""}`,
          screenId: "OM-LEAD-001/2",
          crumbs: [{ label: "Leads and opportunities", to: "/sales/leads" }, { label: l.id }],
          description: l.title,
          chips: (
            <>
              {role === "Sales rep" && l.ownerId !== userId && <Chip kind="block" note="Sales reps own their records (p.248)">Owned by {userName(l.ownerId)}: read only for you</Chip>}
              <LeadStageBadge stage={l.stage} />
              {closed && <Chip kind="design" note="Won, Lost and Disqualified leads open read-only (C-55 pattern)">Read-only</Chip>}
              <Reading id="SR-1" note="Lead stage list is in the PRD (p.249) but not in the shared status catalog; drawn with family badges until the catalog row exists (Request FR-1)" />
            </>
          ),
          actions: (
            <>
              <Button variant="outline" disabled={closed} onClick={() => run(runPriorSearch(l.id), "Prior build search done")}>
                Run prior build search
              </Button>
              <Button variant="outline" disabled={!["Open", "Qualified"].includes(l.stage)} onClick={() => setDq(true)}>
                Disqualify
              </Button>
              {role === "Sales Director" && (
                <Button variant="outline" onClick={() => setOwner(true)}>
                  Reassign owner
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDel(true)}>
                Delete
              </Button>
            </>
          ),
          primary,
        }}
        doc={{ type: "lead", id: l.id }}
        summary={
          <>
            <KV k="Stage path">
              <span className="flex flex-wrap gap-1 text-xs" aria-label="Lead stage path">
                {LEAD_STAGES.map((s) => (
                  <span key={s} aria-current={s === l.stage ? "step" : undefined} className={cn("rounded-md px-1", s === l.stage ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")}>
                    {s}
                  </span>
                ))}
              </span>
            </KV>
            <KV k="Age in stage">{ageDays(l.stageSince)} days (since {l.stageSince})</KV>
            <KV k="Owner">{userName(l.ownerId)}</KV>
            <KV k="Customer">
              {l.customerId ? (
                <span className="flex flex-wrap items-center gap-1">
                  <A to={`/sales/customers/${l.customerId}`}>{l.customerId}</A> {custStatus && <StatusBadge kind="customer" status={custStatus} size="sm" />}
                </span>
              ) : (
                "None yet: created as Prospect at conversion"
              )}
            </KV>
          </>
        }
        tabs={[
          {
            id: "overview",
            label: "Contact and commercial",
            content: (
              <div className="flex flex-col gap-4">
                {err && (
                  <ErrorAlert title="Action not done" onDismiss={() => setErr(null)}>
                    {err}
                  </ErrorAlert>
                )}
                <div className="grid gap-4 lg:grid-cols-2">
                  <Section title="Contact">
                    <ContactEditor lead={l} disabled={closed} onError={setErr} />
                  </Section>
                  <Section title="Commercial">
                    <dl className="grid grid-cols-2 gap-4">
                      <KV k="Source">{l.source}</KV>
                      <KV k="Region">{l.region}</KV>
                      <KV k="Estimated value">{money(l.estValue, l.currency)}</KV>
                      <KV k="Estimated award date">{l.awardDate}</KV>
                      <KV k="Win probability">
                        {l.winProb}% <Reading id="SR-3" note="Win probability defaults by stage (10/25/50/100/0/0%); the PRD says only 'defaulted by stage and manually adjustable'" />
                      </KV>
                      <KV k="Competitor">{l.competitor || "Not recorded"}</KV>
                      <KV k="Quotations">{l.quotationIds.length ? l.quotationIds.map((q) => <A key={q} to={`/sales/quotations/${q}`} className="mr-2">{q}</A>) : "None"}</KV>
                      {l.disqualifyReason && <KV k="Disqualify reason">{l.disqualifyReason}</KV>}
                    </dl>
                  </Section>
                </div>
              </div>
            ),
          },
          {
            id: "requirement",
            label: "Requirement and prior build",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Section
                  title="Requirement capture (quotation configuration attributes)"
                  action={
                    !closed && (
                      <Button size="sm" variant="outline" disabled={!req} onClick={() => run(updateLead(l.id, { req: r }), "Requirement saved") && setReq(null)}>
                        Save requirement
                      </Button>
                    )
                  }
                >
                  <p className="text-xs text-muted-foreground">Every field optional at this stage; values flow to the quotation unchanged.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {REQ_FIELDS.map(([k, label]) => (
                      <div key={k} className={cn("flex flex-col gap-1", k === "special" && "col-span-2")}>
                        <Label htmlFor={`req-${k}`} className="text-xs">
                          {label}
                        </Label>
                        {k === "special" ? (
                          <Textarea id={`req-${k}`} disabled={closed} value={r[k] ?? ""} onChange={(e) => setReq({ ...r, [k]: e.target.value })} />
                        ) : (
                          <Input id={`req-${k}`} className="h-8" disabled={closed} value={r[k] ?? ""} onChange={(e) => setReq({ ...r, [k]: e.target.value })} />
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
                <PriorBuildPanel lead={l} disabled={closed} onError={setErr} />
              </div>
            ),
          },
          {
            id: "qualification",
            label: "Qualification",
            content: (
              <Section title="Qualification checklist" action={<Reading id="SR-4" note="The PRD names the checklist (Open to Qualified requires it complete) but lists no items; four design items used" />}>
                <ul className="flex flex-col gap-2">
                  {QUAL_CHECKLIST.map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <Checkbox id={`chk-${k}`} checked={!!l.checklist[k]} disabled={l.stage !== "Open"} onCheckedChange={() => run(toggleChecklist(l.id, k), "Checklist updated")} />
                      <Label htmlFor={`chk-${k}`}>{k}</Label>
                    </li>
                  ))}
                </ul>
                {err && <p className="text-sm text-destructive">{err}</p>}
              </Section>
            ),
          },
          { id: "activity", label: "Activity", content: <ActivityList items={l.activity} /> },
        ]}
      />
      <RulesPanel rules={RULES} />
      <DialogShell
        open={dq}
        onOpenChange={setDq}
        title={`Disqualify ${l.id}`}
        consequence={`${l.id} moves to Disqualified and opens read-only. A reason code is mandatory.`}
        confirmLabel="Disqualify"
        destructive
        requireReason
        reasonLabel="Note (required)"
        onConfirm={(note) => {
          const res = disqualifyLead(l.id, dqReason, note)
          return res.ok ? null : res.error
        }}
      >
        <Label>Reason code</Label>
        <Select value={dqReason} onValueChange={setDqReason}>
          <SelectTrigger aria-label="Reason code">
            <SelectValue placeholder="Choose a reason code" />
          </SelectTrigger>
          <SelectContent>
            {DISQUALIFY_REASONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Reading id="SR-5" note="Reason codes are required but not listed in the PRD; six design values" />
      </DialogShell>
      <DialogShell
        open={owner}
        onOpenChange={setOwner}
        title={`Reassign owner of ${l.id}`}
        confirmLabel="Reassign"
        onConfirm={() => {
          const res = reassignLead(l.id, ownerId)
          return res.ok ? null : res.error
        }}
      >
        <Select value={ownerId} onValueChange={setOwnerId}>
          <SelectTrigger aria-label="New owner">
            <SelectValue placeholder="Choose a sales rep" />
          </SelectTrigger>
          <SelectContent>
            {USERS.filter((u) => u.roles.some((x) => ["Sales rep", "Sales admin", "Sales Director"].includes(x))).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} ({u.roles[0]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogShell>
      <DialogShell
        open={del}
        onOpenChange={setDel}
        title={`Delete ${l.id}`}
        consequence={`Deletes ${l.id} permanently. A lead that owns a quotation cannot be deleted (E-OM-43); disqualify it instead.`}
        confirmLabel="Delete lead"
        destructive
        onConfirm={() => {
          const res = deleteLead(l.id)
          if (res.ok) {
            nav("/sales/leads")
            return null
          }
          return res.error
        }}
      />
    </>
  )
}

function ContactEditor({ lead, disabled, onError }: { lead: Lead; disabled: boolean; onError: (e: string | null) => void }) {
  const [f, setF] = useState({ contactName: lead.contactName, contactTitle: lead.contactTitle, email: lead.email, phone: lead.phone, address: lead.address })
  const dirty = JSON.stringify(f) !== JSON.stringify({ contactName: lead.contactName, contactTitle: lead.contactTitle, email: lead.email, phone: lead.phone, address: lead.address })
  return (
    <div className="flex flex-col gap-2">
      <KV k="Company">{lead.company}</KV>
      {(["contactName", "contactTitle", "email", "phone", "address"] as const).map((k) => (
        <div key={k} className="flex flex-col gap-1">
          <Label htmlFor={`c-${k}`} className="text-xs">
            {{ contactName: "Contact name", contactTitle: "Title", email: "Email", phone: "Phone", address: "Address" }[k]}
          </Label>
          <Input id={`c-${k}`} className="h-8" disabled={disabled} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </div>
      ))}
      {!disabled && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={!dirty}
          onClick={() => {
            const r = updateLead(lead.id, f)
            onError(r.ok ? null : r.error)
            if (r.ok) toast.success("Contact saved")
          }}
        >
          Save contact
        </Button>
      )}
    </div>
  )
}

function PriorBuildPanel({ lead, disabled, onError }: { lead: Lead; disabled: boolean; onError: (e: string | null) => void }) {
  const [decision, setDecision] = useState<PriorDecision>("Variant of Existing")
  return (
    <Section title="Prior build lookup (design library and installed base)">
      {lead.priorBuild && (
        <p className="text-sm">
          Decision on file: <strong>{lead.priorBuild.decision}</strong>
          {lead.priorBuild.ref !== "none" && (
            <>
              {" "}
              · {lead.priorBuild.ref} · match {lead.priorBuild.score}%
            </>
          )}
          . Copies to the engineering request when the order confirms.
        </p>
      )}
      {!lead.priorMatches ? (
        <EmptyState title="Search not run yet">Capture the attributes, then Run prior build search. Installed base units surface when the attribute set matches a shipped unit.</EmptyState>
      ) : lead.priorMatches.length === 0 ? (
        <EmptyState title="No design matches 30% or more of the captured attributes">Record New Design, or add attributes and search again.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {lead.priorMatches.map((m) => (
            <li key={m.ref} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
              <span className="font-mono text-xs">{m.ref}</span>
              <span className="min-w-0 flex-1">{m.label}</span>
              <span className="tabular text-xs">match {m.score}%</span>
              <span className="text-xs text-muted-foreground">{m.source}</span>
              {!disabled && (
                <Button size="sm" variant="outline" onClick={() => {
                  const r = choosePriorBuild(lead.id, m.ref, decision)
                  onError(r.ok ? null : r.error)
                }}>
                  Use as {decision}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">Decision</Label>
          <Select value={decision} onValueChange={(v) => setDecision(v as PriorDecision)}>
            <SelectTrigger aria-label="Prior build decision" className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["New Design", "Variant of Existing", "Repeat Build"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => {
            const r = choosePriorBuild(lead.id, "none", "New Design")
            onError(r.ok ? null : r.error)
          }}>
            Record New Design
          </Button>
          <Reading id="SR-6" note="Match score = share of captured attributes equal to the design's (impedance within ±0.5 points); 30% shown, 70% surfaces installed base. The PRD stores a match score but gives no formula" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Searched {TODAY}. Reads the same design library index ENG-REQ-001 uses.</p>
    </Section>
  )
}
