// QM-PLAN-001/2 Inspection Plans [DOC:p.264 Book VI; fields and rules Book I A §6, pp.33-35] (asserted).
// List + detail: header with type, scope and sampling, ordered characteristics grid, revision compare
// view. Actions: author, approve to Active, new revision, copy plan, where used. Status S-24.
// Postings and scans: none.

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { Copy, FilePlus2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, ErrorAlert, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { STATUS, THRESHOLDS } from "@/data/domain"
import { MATERIALS, VENDORS } from "@/data/shared"
import { useSlice } from "@/store"
import { plans as act } from "../data/actions"
import { currentRev, latestRev } from "../data/derive"
import { GATES, gateOf, type AssignmentScope, type PlanRevision, type PlanType, type QtCharacteristic, type QtPlan, type SamplingMethod } from "../data/types"
import { ActivityList, NotFound, Pick, Reading, Section, TextField, materialText, report, useDataState, userName, vendorName } from "../components/bits"
import { fmtBounds } from "../data/derive"

export const PLAN_RULES: [string, string, string][] = [
  ["QM-P1", "Plan types INC / INP / FIN / PSI / RMA map to the gates IQC / IPQC / FQC / OQC / RQC.", "DOC:p.33 §6.2; p.84 E §1"],
  ["QM-P2", "Lifecycle Draft → In Review → Active → Superseded; Obsolete as an exit. An Active plan is immutable: any change is a new revision.", "DOC:p.34 §6.4"],
  ["QM-P3", "Assignment scope: Item, Item Group, Item + Vendor or Item + Operation; the most specific match wins.", "DOC:p.33 §6.2"],
  ["QM-P4", `AQL switching: tightened after ${THRESHOLDS.inspectionTightenRejectedOf5} rejected of 5 lots; reduced after ${THRESHOLDS.inspectionReduceAfterAccepted} accepted in a row.`, "DOC:pp.33-35 §6"],
  ["QM-P5", "R-QM-02: a fail on a critical characteristic rejects the whole inspection.", "DOC:p.34 §6.3"],
  ["QM-P6", "Setting Obsolete is blocked when a QI-required item would be left with no plan and the no-plan policy is Block (E-QM-01).", "DOC:p.35 §6.5"],
]

const planStatus = (p: QtPlan) => latestRev(p).status
const scopeText = (p: QtPlan) =>
  p.scope === "Item Group" ? p.itemGroup ?? "" : p.scope === "Item + Vendor" ? `${p.itemId} · ${vendorName(p.vendorId)}` : p.scope === "Item + Operation" ? `${p.itemId} · ${p.operation}` : `${p.itemId} · ${materialText(p.itemId)}`
const samplingText = (r: PlanRevision) =>
  r.sampling === "AQL Sampling" && r.aql ? `AQL ${r.aql.value} level ${r.aql.level} (${r.aql.state})` : r.sampling === "Skip-Lot" && r.skipLot ? `Skip-lot: inspect 1 in ${r.skipLot.n}` : r.sampling === "Fixed Sample Size" ? `Fixed, ${r.fixedSize} units` : r.sampling

// ============================================================================ list
export function PlanList() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-PLAN-001")
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const rows = ds.empty ? [] : s.plans
  const cols: Column<QtPlan>[] = [
    { id: "id", header: "Plan", value: (p) => p.id, sortable: true, mono: true, className: "w-32" },
    { id: "name", header: "Name", value: (p) => p.name, sortable: true },
    { id: "type", header: "Type / gate", value: (p) => `${p.type} · ${gateOf(p.type)}`, filterable: true, className: "w-32" },
    { id: "scope", header: "Scope", value: (p) => p.scope, filterable: true, cell: (p) => <span title={scopeText(p)}>{p.scope}</span> },
    { id: "target", header: "Applies to", value: (p) => scopeText(p), cell: (p) => <span className="line-clamp-1 text-muted-foreground">{scopeText(p)}</span> },
    { id: "rev", header: "Rev", value: (p) => latestRev(p).rev, mono: true, className: "w-14" },
    { id: "status", header: "Status", value: planStatus, filterable: true, sortable: true, cell: (p) => <StatusBadge kind="inspectionPlan" status={planStatus(p)} size="sm" /> },
    { id: "sampling", header: "Sampling", value: (p) => latestRev(p).sampling, filterable: true },
    { id: "chars", header: "Tests", value: (p) => latestRev(p).characteristics.length, align: "right", mono: true },
    { id: "eff", header: "Effective from", value: (p) => latestRev(p).effectiveFrom, sortable: true, mono: true },
  ]
  return (
    <>
      <ListPage
        header={{
          title: "Inspection Plans",
          screenId: "QM-PLAN-001/2",
          description: "The test rows every inspection materializes, one plan per gate and scope. Quality engineers author; the Quality Manager approves to Active.",
          primary: (
            <Button onClick={() => setOpen(true)}>
              <FilePlus2 aria-hidden="true" /> Author plan
            </Button>
          ),
        }}
        above={
          <div className="flex flex-wrap gap-2">
            {STATUS.inspectionPlan.statuses.map((st) => (
              <span key={st} className="inline-flex items-center gap-1 text-sm">
                <StatusBadge kind="inspectionPlan" status={st} size="sm" />
                <span className="tabular text-muted-foreground">{s.plans.filter((p) => planStatus(p) === st).length}</span>
              </span>
            ))}
          </div>
        }
        table={{
          rows,
          columns: cols,
          rowId: (p) => p.id,
          rowHref: (p) => `/quality/inspection-plans/${p.id}`,
          searchText: (p) => `${p.id} ${p.name} ${p.itemId ?? ""} ${p.itemGroup ?? ""} ${vendorName(p.vendorId)}`,
          searchPlaceholder: "Search plan, item, vendor",
          loading: ds.loading,
          error: ds.error,
          onRetry: ds.retry,
          empty: { title: "No inspection plans yet", body: "Author the first plan; until a QI-required item has an Active plan, the no-plan policy applies at the gate." },
        }}
        below={<RulesPanel rules={PLAN_RULES} />}
      />
      <NewPlanDialog open={open} onOpenChange={setOpen} onDone={(id) => nav(`/quality/inspection-plans/${id}`)} />
    </>
  )
}

function NewPlanDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (id: string) => void }) {
  const [name, setName] = useState("")
  const [type, setType] = useState<PlanType>("INC")
  const [scope, setScope] = useState<AssignmentScope>("Item + Vendor")
  const [itemId, setItemId] = useState("")
  const [itemGroup, setItemGroup] = useState("")
  const [vendorId, setVendorId] = useState("")
  const [operation, setOperation] = useState("")
  const [sampling, setSampling] = useState<SamplingMethod>("AQL Sampling")
  const items = MATERIALS.filter((m) => ["RAW", "SEMI", "FIN", "SPARE", "CONS"].includes(m.type))
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Author inspection plan"
      description="Creates the plan header with an empty Draft revision A. Add characteristics on the plan, then submit for review."
      confirmLabel="Create Draft"
      wide
      onConfirm={() => {
        const r = act.create({ name, type, scope, itemId: itemId || undefined, itemGroup, vendorId: vendorId || undefined, operation, sampling })
        if (!r.ok) return r.error
        report(r, (id) => `${id} created at Draft`)
        onDone(r.value)
        return null
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="pl-name" label="Plan name" value={name} onChange={setName} placeholder="e.g. HV bushing 145 kV incoming" />
        <Pick id="pl-type" label="Plan type (gate)" value={type} onChange={setType} options={GATES.map((g) => ({ value: g.planType, label: `${g.planType} · ${g.label}` }))} />
        <Pick id="pl-scope" label="Assignment scope" value={scope} onChange={setScope} options={["Item", "Item Group", "Item + Vendor", "Item + Operation"] as AssignmentScope[]} />
        {scope === "Item Group" ? (
          <TextField id="pl-group" label="Item group" value={itemGroup} onChange={setItemGroup} />
        ) : (
          <Pick id="pl-item" label="Item" value={itemId} onChange={setItemId} options={items.map((m) => ({ value: m.id, label: `${m.id} · ${m.description}` }))} />
        )}
        {scope === "Item + Vendor" && <Pick id="pl-vendor" label="Vendor" value={vendorId} onChange={setVendorId} options={VENDORS.map((v) => ({ value: v.id, label: `${v.id} · ${v.name}` }))} />}
        {scope === "Item + Operation" && <TextField id="pl-op" label="Operation" value={operation} onChange={setOperation} placeholder="WC-210 HV Winding, op 0030" />}
        <Pick id="pl-sampling" label="Sampling" value={sampling} onChange={setSampling} options={["100%", "AQL Sampling", "Skip-Lot", "Fixed Sample Size"] as SamplingMethod[]} />
      </div>
    </DialogShell>
  )
}

// ============================================================================ detail
export function PlanDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-PLAN-002")
  const nav = useNavigate()
  const p = s.plans.find((x) => x.id === id)
  const [dlg, setDlg] = useState<null | "approve" | "reject" | "obsolete">(null)
  if (ds.error) return <ErrorAlert title="Could not load the plan" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  if (!p) return <NotFound what="inspection plan" id={id} back={{ to: "/quality/inspection-plans", label: "Back to Inspection Plans" }} />
  const last = latestRev(p)
  const cur = currentRev(p)
  const draft = p.revisions.find((r) => r.status === "Draft")
  const review = p.revisions.find((r) => r.status === "In Review")
  const usedLots = s.lots.filter((l) => l.planId === p.id)
  const usedFin = s.finalTests.filter((f) => f.planId === p.id)

  const primary = draft ? (
    <Button onClick={() => report(act.submit(p.id), `Rev ${draft.rev} submitted for review`)}>Submit rev {draft.rev} for review</Button>
  ) : review ? (
    <Button onClick={() => setDlg("approve")}>Approve rev {review.rev} to Active</Button>
  ) : last.status === "Active" ? (
    <Button onClick={() => report(act.newRevision(p.id), (r) => `Rev ${r} created at Draft`)}>New revision</Button>
  ) : undefined

  return (
    <>
      <DetailPage
        header={{
          title: `${p.id} · ${p.name}`,
          screenId: "QM-PLAN-001/2",
          crumbs: [{ label: "Inspection Plans", to: "/quality/inspection-plans" }, { label: p.id }],
          description: `${p.type} plan for the ${gateOf(p.type)} gate. Showing rev ${last.rev}${cur.rev !== last.rev ? `; rev ${cur.rev} is the one inspections use today` : ""}.`,
          primary,
          actions: (
            <>
              {review && <Button variant="outline" onClick={() => setDlg("reject")}>Reject to Draft</Button>}
              {last.status === "Active" && (
                <Button variant="outline" onClick={() => setDlg("obsolete")}>
                  Set Obsolete
                </Button>
              )}
              <Button variant="outline" onClick={() => report(act.copy(p.id), (nid) => (nav(`/quality/inspection-plans/${nid}`), `Copied to ${nid} (Draft)`))}>
                <Copy aria-hidden="true" /> Copy plan
              </Button>
            </>
          ),
          chips: review ? <Reading id="QT-R09" /> : undefined,
        }}
        status={{ kind: "inspectionPlan", value: last.status }}
        summary={
          <>
            <KV k="Type / gate">{`${p.type} · ${GATES.find((g) => g.planType === p.type)?.label}`}</KV>
            <KV k="Scope">{p.scope}</KV>
            <KV k="Applies to">{scopeText(p)}</KV>
            <KV k="Sampling">{samplingText(last)}</KV>
            <KV k="Effective">{`${last.effectiveFrom}${last.effectiveTo ? ` to ${last.effectiveTo}` : ""}`}</KV>
            <KV k="Created">{`${last.createdOn} by ${userName(last.createdBy)}`}</KV>
            <KV k="Activated">{last.activatedOn ? `${last.activatedOn} by ${userName(last.activatedBy)}` : "Not yet"}</KV>
            <KV k="Where used">{`${usedLots.length + usedFin.length} inspections`}</KV>
          </>
        }
        tabs={[
          { id: "chars", label: "Characteristics", count: last.characteristics.length, content: <CharGrid plan={p} rev={last} editable={last.status === "Draft"} /> },
          { id: "revs", label: "Revisions", count: p.revisions.length, content: <RevisionCompare plan={p} /> },
          {
            id: "used",
            label: "Where used",
            count: usedLots.length + usedFin.length,
            content: (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Inspection</TableHead>
                    <TableHead>Rev</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usedLots.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell><Link className="text-link underline-offset-4 hover:underline" to={`/quality/inspections/${l.id}`}>{l.id}</Link></TableCell>
                      <TableCell className="tabular">{l.planRev}</TableCell>
                      <TableCell>{l.batchId ?? l.serials[0] ?? l.subject.id}</TableCell>
                      <TableCell className="tabular">{l.createdOn}</TableCell>
                      <TableCell>{l.decision ?? "Open"}</TableCell>
                    </TableRow>
                  ))}
                  {usedFin.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell><Link className="text-link underline-offset-4 hover:underline" to={`/quality/final-test/${f.id}`}>{f.id}</Link></TableCell>
                      <TableCell className="tabular">{f.planRev}</TableCell>
                      <TableCell>{f.serial}</TableCell>
                      <TableCell className="tabular">{f.runs[0]?.sessions[0] ?? "Queued"}</TableCell>
                      <TableCell>{f.finalResult ?? "In test"}</TableCell>
                    </TableRow>
                  ))}
                  {!usedLots.length && !usedFin.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">No inspection has used this plan yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ),
          },
          { id: "activity", label: "Activity", content: <ActivityList items={p.activity} /> },
          { id: "rules", label: "Rules", content: <RulesPanel rules={PLAN_RULES} /> },
        ]}
      />
      <DialogShell
        open={dlg === "approve"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Approve ${p.id} rev ${review?.rev} to Active`}
        consequence={`Rev ${review?.rev} becomes Active and immutable${cur.status === "Active" && cur.rev !== review?.rev ? `; rev ${cur.rev} becomes Superseded` : ""}. New inspections materialize its ${review?.characteristics.length} characteristics.`}
        confirmLabel="Approve to Active"
        requireReason
        reasonLabel="Review comment (required)"
        onConfirm={(c) => {
          const r = act.approve(p.id, c)
          return report(r, `Rev ${review?.rev} is Active`) ? null : (r as { error: string }).error
        }}
      >
        <p className="text-sm">
          Recorded by the Quality Manager on this screen <Reading id="QT-R09" />
        </p>
      </DialogShell>
      <DialogShell
        open={dlg === "reject"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Reject ${p.id} rev ${review?.rev}`}
        consequence="The revision returns to Draft with your comment for the author."
        confirmLabel="Reject to Draft"
        requireReason
        destructive
        onConfirm={(c) => {
          const r = act.reject(p.id, c)
          return report(r, "Returned to Draft") ? null : (r as { error: string }).error
        }}
      />
      <DialogShell
        open={dlg === "obsolete"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Set ${p.id} Obsolete`}
        consequence={`Rev ${last.rev} stops applying today. The plan can no longer be selected for inspections; history stays readable.`}
        confirmLabel="Set Obsolete"
        requireReason
        destructive
        onConfirm={(c) => {
          const r = act.obsolete(p.id, c)
          return report(r, `${p.id} is Obsolete`) ? null : (r as { error: string }).error
        }}
      />
    </>
  )
}

function CharGrid({ plan, rev, editable }: { plan: QtPlan; rev: PlanRevision; editable: boolean }) {
  const [c, setC] = useState<Partial<QtCharacteristic>>({ charType: "Quantitative", critical: false })
  const set = (k: keyof QtCharacteristic, v: unknown) => setC((x) => ({ ...x, [k]: v }))
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v))
  return (
    <div className="flex flex-col gap-4">
      {rev.reviewNote && (
        <p className="rounded-md bg-muted px-4 py-2 text-sm">
          <span className="font-medium">Review note:</span> {rev.reviewNote}
        </p>
      )}
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Test</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Specification</TableHead>
            <TableHead>Instrument class</TableHead>
            <TableHead>Sample instruction</TableHead>
            <TableHead>Critical</TableHead>
            {editable && <TableHead className="w-10"><span className="sr-only">Remove</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rev.characteristics.map((x) => (
            <TableRow key={x.seq}>
              <TableCell className="tabular">{x.seq}</TableCell>
              <TableCell className="font-medium">
                {x.name}
                {x.certRequired && <span className="ml-2 text-xs text-muted-foreground">certificate required</span>}
              </TableCell>
              <TableCell className="text-muted-foreground">{x.method}</TableCell>
              <TableCell>{x.charType}</TableCell>
              <TableCell className="tabular">{fmtBounds(x)}</TableCell>
              <TableCell>{x.instrumentClass ?? "None"}</TableCell>
              <TableCell className="text-muted-foreground">{x.sampleInstruction ?? ""}</TableCell>
              <TableCell>{x.critical ? <Chip kind="flag" note="R-QM-02: a fail rejects the whole inspection">Critical</Chip> : "No"}</TableCell>
              {editable && (
                <TableCell>
                  <Button variant="ghost" size="icon" aria-label={`Remove characteristic ${x.seq}`} onClick={() => report(act.removeCharacteristic(plan.id, x.seq), "Removed")}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {!rev.characteristics.length && (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground">No characteristics yet. A plan needs at least one before review.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {editable ? (
        <Section title={`Add characteristic to rev ${rev.rev}`}>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <TextField id="c-name" label="Test name" value={c.name ?? ""} onChange={(v) => set("name", v)} />
            <TextField id="c-method" label="Method" value={c.method ?? ""} onChange={(v) => set("method", v)} placeholder="IEEE C57.12.90 §8" />
            <Pick id="c-type" label="Type" value={c.charType} onChange={(v) => set("charType", v)} options={["Quantitative", "Attributive"]} />
            <TextField id="c-param" label={c.charType === "Attributive" ? "Acceptance criterion" : "Parameter"} value={c.parameter ?? ""} onChange={(v) => set("parameter", v)} />
            {c.charType === "Quantitative" && (
              <>
                <TextField id="c-uom" label="Unit" value={c.uom ?? ""} onChange={(v) => set("uom", v)} />
                <TextField id="c-min" label="Lower limit" type="number" value={c.min?.toString() ?? ""} onChange={(v) => set("min", num(v))} />
                <TextField id="c-target" label="Target" type="number" value={c.target?.toString() ?? ""} onChange={(v) => set("target", num(v))} />
                <TextField id="c-max" label="Upper limit" type="number" value={c.max?.toString() ?? ""} onChange={(v) => set("max", num(v))} />
              </>
            )}
            <TextField id="c-inst" label="Instrument class (SP-14)" value={c.instrumentClass ?? ""} onChange={(v) => set("instrumentClass", v || undefined)} placeholder="TTR, Megohmmeter, Leak" />
            <TextField id="c-sample" label="Sample instruction" value={c.sampleInstruction ?? ""} onChange={(v) => set("sampleInstruction", v || undefined)} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!c.critical} onCheckedChange={(v) => set("critical", v === true)} /> Critical (R-QM-02)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!c.certRequired} onCheckedChange={(v) => set("certRequired", v === true)} /> Vendor certificate required
            </label>
          </div>
          <div>
            <Button
              variant="outline"
              onClick={() => {
                const r = act.addCharacteristic(plan.id, { name: c.name ?? "", method: c.method ?? "", charType: c.charType ?? "Quantitative", parameter: c.parameter ?? "", uom: c.uom, min: c.min, target: c.target, max: c.max, critical: !!c.critical, instrumentClass: c.instrumentClass, sampleInstruction: c.sampleInstruction, certRequired: c.certRequired })
                if (report(r, "Characteristic added")) setC({ charType: "Quantitative", critical: false })
              }}
            >
              Add characteristic
            </Button>
          </div>
        </Section>
      ) : (
        <p className="text-xs text-muted-foreground">Rev {rev.rev} is {rev.status}: characteristics are fixed. Use New revision to change them.</p>
      )}
    </div>
  )
}

function RevisionCompare({ plan }: { plan: QtPlan }) {
  const revs = plan.revisions
  const [a, setA] = useState(revs.length > 1 ? revs[revs.length - 2].rev : revs[0].rev)
  const [b, setB] = useState(revs[revs.length - 1].rev)
  const ra = revs.find((r) => r.rev === a)!
  const rb = revs.find((r) => r.rev === b)!
  const diff = useMemo(() => {
    const names = [...new Set([...ra.characteristics.map((c) => c.name), ...rb.characteristics.map((c) => c.name)])]
    return names.map((n) => {
      const x = ra.characteristics.find((c) => c.name === n)
      const y = rb.characteristics.find((c) => c.name === n)
      const change = !x ? "Added" : !y ? "Removed" : fmtBounds(x) !== fmtBounds(y) || x.critical !== y.critical || x.method !== y.method ? "Changed" : "Same"
      return { n, x, y, change }
    })
  }, [ra, rb])
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Rev</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Effective</TableHead>
            <TableHead>Sampling</TableHead>
            <TableHead className="text-right">Tests</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...revs].reverse().map((r) => (
            <TableRow key={r.rev}>
              <TableCell className="tabular font-medium">{r.rev}</TableCell>
              <TableCell><StatusBadge kind="inspectionPlan" status={r.status} size="sm" /></TableCell>
              <TableCell className="tabular">{`${r.effectiveFrom}${r.effectiveTo ? ` to ${r.effectiveTo}` : ""}`}</TableCell>
              <TableCell>{samplingText(r)}</TableCell>
              <TableCell className="tabular text-right">{r.characteristics.length}</TableCell>
              <TableCell className="tabular">{`${r.createdOn} · ${userName(r.createdBy)}`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Section title="Compare revisions">
        <div className="flex flex-wrap items-end gap-4">
          <Pick id="cmp-a" label="From" value={a} onChange={setA} options={revs.map((r) => ({ value: r.rev, label: `Rev ${r.rev} (${r.status})` }))} />
          <Pick id="cmp-b" label="To" value={b} onChange={setB} options={revs.map((r) => ({ value: r.rev, label: `Rev ${r.rev} (${r.status})` }))} />
          <span className="text-sm text-muted-foreground">
            Sampling: {samplingText(ra)} → {samplingText(rb)}
          </span>
        </div>
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Rev {a}</TableHead>
              <TableHead>Rev {b}</TableHead>
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {diff.map((d) => (
              <TableRow key={d.n} className={d.change === "Same" ? "text-muted-foreground" : undefined}>
                <TableCell>{d.n}</TableCell>
                <TableCell className="tabular">{d.x ? fmtBounds(d.x) : "None"}</TableCell>
                <TableCell className="tabular">{d.y ? fmtBounds(d.y) : "None"}</TableCell>
                <TableCell>{d.change === "Same" ? "Same" : <Chip kind="change">{d.change}</Chip>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  )
}
