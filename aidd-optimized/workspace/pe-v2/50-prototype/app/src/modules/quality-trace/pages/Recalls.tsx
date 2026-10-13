// RCL-001 Recall Campaigns [DOC:p.266 Book VI; Book III A FL-08 p.182; Book IV §4] (asserted).
// Workbench: population panel from forward trace with version history, containment status,
// notification list export, recovery tracker, effectiveness gate. Actions: derive population, mass
// hold, dual-approved notification (WF-INBOX, C-52), track recovery to 100% accounted. Creates mass
// holds, recall-class RMAs (sales module) and the evidence dossier. Postings: through the RMAs.

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { FilePlus2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, WorkbenchPage } from "@/components/templates"
import { ApprovalButton, Chip, DataTable, ErrorAlert, KV, LifecycleStrip, PostingPreview, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { STATUS, type BatchId, type SerialNo } from "@/data/domain"
import { fmtMoney } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { recall as act } from "../data/actions"
import type { PopulationRow, QtRecall } from "../data/types"
import { ContactLog, PiiLog } from "./RecallContacts"
import { ActivityList, DocLinkText, NotFound, Pick, Reading, Section, TextField, customerName, materialText, report, useDataState, userName } from "../components/bits"

export const RCL_RULES: [string, string, string][] = [
  ["RCL-1", "Stages Identify → Contain → Notify → Recover → Disposition → Effectiveness → Closed.", "DOC:p.182 FL-08"],
  ["RCL-2", "The population is derived by forward trace from the suspect batches or serials; a re-derivation that differs creates a new version with its diff.", "DOC:p.182 FL-08; Book IV §4.4"],
  ["RCL-3", "Mass hold blocks all on-hand affected stock in one action; stock already held is a logged no-op.", "DOC:p.182 FL-08"],
  ["RCL-4", "C-52: the external notification text needs dual approval, Quality Manager plus an executive, through WF-INBOX. Exporting the customer list is logged as a PII disclosure.", "DOC:p.182 FL-08 field 4"],
  ["RCL-5", "Recall-class RMAs are created in bulk for field units; PE pays freight.", "DOC:p.182 FL-08"],
  ["RCL-6", "Closing needs 100% of the population accounted (recovered, field-corrected or documented exception), or partial recovery signed by the Quality Manager and an executive; the CAPA must be linked.", "DOC:p.182 FL-08"],
]

const accounted = (r: QtRecall) => r.population.filter((p) => p.disposition).length
const pct = (r: QtRecall) => (r.population.length ? Math.round((accounted(r) / r.population.length) * 100) : 0)
const STAGES = STATUS.recall.statuses

// ============================================================================ workbench
export function RecallWorkbench() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("RCL-001")
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [queue, setQueue] = useState("active")
  const [active, setActive] = useState<string | null>(null)
  const prefill = params.get("new")
  const [open, setOpen] = useState(!!prefill)
  const rows = ds.empty ? [] : s.recalls.filter((r) => (queue === "active" ? r.stage !== "Closed" : queue === "all" ? true : r.stage === queue))
  const cols: Column<QtRecall>[] = [
    { id: "id", header: "Campaign", value: (r) => r.id, mono: true, sortable: true, className: "w-32" },
    { id: "title", header: "Title", value: (r) => r.title },
    { id: "stage", header: "Stage", value: (r) => r.stage, sortable: true, cell: (r) => <StatusBadge kind="recall" status={r.stage} size="sm" /> },
    { id: "trigger", header: "Trigger", value: (r) => r.trigger, filterable: true },
    { id: "suspect", header: "Suspect", value: (r) => [...r.suspect.batches, ...r.suspect.serials].join(", "), cell: (r) => <span className="tabular text-xs">{[...r.suspect.batches, ...r.suspect.serials].slice(0, 3).join(", ")}{r.suspect.serials.length + r.suspect.batches.length > 3 ? " …" : ""}</span> },
    { id: "pop", header: "Population", value: (r) => r.population.length, align: "right", mono: true, cell: (r) => `${r.population.length} (v${r.populationVersion})` },
    { id: "acc", header: "Accounted", value: pct, align: "right", mono: true, cell: (r) => `${pct(r)}%` },
    { id: "cost", header: "Cost to date", value: (r) => r.costToDate, align: "right", mono: true, cell: (r) => fmtMoney(r.costToDate) },
    { id: "opened", header: "Opened", value: (r) => r.createdOn, sortable: true, mono: true },
  ]
  const cur = s.recalls.find((r) => r.id === active)
  return (
    <>
      <WorkbenchPage
        header={{
          title: "Recall Campaigns",
          screenId: "RCL-001",
          description: "Field-failure, NCR and supplier-notice campaigns from population to 100% accounted. The executive approves notifications through WF-INBOX.",
          primary: (
            <Button onClick={() => setOpen(true)}>
              <FilePlus2 aria-hidden="true" /> Open campaign
            </Button>
          ),
          actions: (
            <Button variant="outline" asChild>
              <Link to="/traceability/explorer">Trace Explorer</Link>
            </Button>
          ),
        }}
        kpis={[
          { label: "Active campaigns", value: s.recalls.filter((r) => r.stage !== "Closed").length },
          { label: "Field units open", value: s.recalls.filter((r) => r.stage !== "Closed").reduce((a, r) => a + r.population.filter((p) => (p.where === "In field" || p.where === "Returned") && !p.disposition).length, 0), hint: "In field or returned, not yet accounted" },
          { label: "Awaiting notification approval", value: s.recalls.filter((r) => r.stage === "Contain").length },
          { label: "Cost to date (active)", value: fmtMoney(s.recalls.filter((r) => r.stage !== "Closed").reduce((a, r) => a + r.costToDate, 0)) },
        ]}
        queues={[
          { id: "active", label: "Active", count: s.recalls.filter((r) => r.stage !== "Closed").length },
          ...STAGES.map((st) => ({ id: st, label: st, count: s.recalls.filter((r) => r.stage === st).length })),
          { id: "all", label: "All", count: s.recalls.length },
        ]}
        queue={queue}
        onQueueChange={setQueue}
        table={{
          rows, columns: cols, rowId: (r) => r.id, rowHref: (r) => `/quality/recalls/${r.id}`, onRowClick: (r) => setActive(r.id), activeId: active ?? undefined,
          searchText: (r) => `${r.id} ${r.title} ${r.suspect.batches.join(" ")} ${r.suspect.serials.join(" ")} ${r.population.map((p) => p.serial).join(" ")}`,
          searchPlaceholder: "Search campaign, batch, serial", loading: ds.loading, error: ds.error, onRetry: ds.retry,
          empty: { title: "No campaigns in this queue", body: "Open a campaign from a suspect batch, a field failure or a supplier notice." },
        }}
        bulkActions={(ids, clear) => (
          <Button size="sm" variant="outline" onClick={() => { const res = ids.map((id) => act.derive(id)); const bad = res.find((x) => !x.ok); report(bad ?? { ok: true as const, value: res.length }, (n) => `Population re-derived for ${n} campaign(s)`); clear() }}>
            Re-derive population
          </Button>
        )}
        panel={{
          open: !!cur, onOpenChange: (o) => !o && setActive(null), title: cur ? `${cur.id}` : "", description: cur?.title,
          content: cur ? (
            <div className="flex flex-col gap-4">
              <LifecycleStrip kind="recall" status={cur.stage} />
              <dl className="grid grid-cols-2 gap-4">
                <KV k="Population">{`${cur.population.length} (v${cur.populationVersion})`}</KV>
                <KV k="Accounted">{`${accounted(cur)} (${pct(cur)}%)`}</KV>
                <KV k="Held">{cur.population.filter((p) => p.held).length}</KV>
                <KV k="RMAs">{cur.rmaIds.join(", ") || "None"}</KV>
                <KV k="CAPA">{cur.capaId ?? "Not linked"}</KV>
                <KV k="Owner">{userName(cur.ownerId)}</KV>
              </dl>
              <p className="text-sm">{cur.reason}</p>
              <Button asChild><Link to={`/quality/recalls/${cur.id}`}>Open campaign</Link></Button>
            </div>
          ) : null,
        }}
      />
      <RCLRules />
      <OpenDialog
        open={open}
        prefill={prefill ?? undefined}
        onClose={() => {
          setOpen(false)
          if (prefill) (params.delete("new"), setParams(params, { replace: true }))
        }}
        onDone={(id) => nav(`/quality/recalls/${id}`)}
      />
    </>
  )
}
const RCLRules = () => <RulesPanel rules={RCL_RULES} />

function OpenDialog({ open, prefill, onClose, onDone }: { open: boolean; prefill?: string; onClose: () => void; onDone: (id: string) => void }) {
  const s = useSlice("qualityTrace")
  const ids = prefill ? prefill.split(",").filter(Boolean) : []
  const isSerial = (x: string) => s.serials.some((y) => y.id === x)
  const [title, setTitle] = useState("")
  const [batches, setBatches] = useState(ids.filter((x) => !isSerial(x)).join(", "))
  const [serials, setSerials] = useState(ids.filter(isSerial).join(", "))
  const [trigger, setTrigger] = useState<QtRecall["trigger"]>("NCR")
  const [reason, setReason] = useState("")
  const [capaId, setCapaId] = useState("")
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Open recall campaign"
      consequence="Opens the campaign at Identify and writes a T13 event. Next: derive the population by forward trace, then mass hold."
      confirmLabel="Open campaign"
      wide
      onConfirm={() => {
        const split = (v: string) => v.split(/[ ,]+/).filter(Boolean)
        const r = act.open({ title, batches: split(batches) as BatchId[], serials: split(serials) as SerialNo[], trigger, reason, capaId: (capaId || undefined) as QtRecall["capaId"] })
        if (!r.ok) return r.error
        report(r, (id) => `${id} opened at Identify`)
        onDone(r.value)
        return null
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="rc-title" label="Title" value={title} onChange={setTitle} placeholder="Recall: ..." />
        <Pick id="rc-trigger" label="Trigger" value={trigger} onChange={setTrigger} options={["NCR", "Field failure", "Supplier notice"] as QtRecall["trigger"][]} />
        <TextField id="rc-batches" label="Suspect batches" value={batches} onChange={setBatches} placeholder="BAT-TBD-..." />
        <TextField id="rc-serials" label="Suspect serials" value={serials} onChange={setSerials} placeholder="SN-TBD-..." />
        <TextField id="rc-reason" label="Reason" value={reason} onChange={setReason} />
        <Pick id="rc-capa" label="CAPA" value={capaId} onChange={setCapaId} options={s.capas.filter((c) => c.status !== "Closed").map((c) => ({ value: c.id, label: `${c.id} · ${c.title}` }))} />
      </div>
    </DialogShell>
  )
}

// ============================================================================ campaign
export function RecallDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ds = useDataState("RCL-002")
  const r = s.recalls.find((x) => x.id === id)
  const [dlg, setDlg] = useState<null | "hold" | "rmas" | "advance" | "export">(null)
  if (ds.error) return <ErrorAlert title="Could not load the campaign" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  if (!r) return <NotFound what="recall campaign" id={id} back={{ to: "/quality/recalls", label: "Back to Recall Campaigns" }} />
  const next = STAGES[STAGES.indexOf(r.stage) + 1]
  const primary =
    r.stage === "Identify" ? (
      r.population.length ? <Button onClick={() => setDlg("hold")}>Mass hold</Button> : <Button onClick={() => report(act.derive(r.id), (x) => `Population: +${x.added}, ${x.total} total`)}>Derive population</Button>
    ) : r.stage === "Contain" ? (
      <ApprovalButton kind="Recall external notification" subject={{ type: "recall", id: r.id }} title={`Notification text for ${r.id}`} label="Send notification for approval" variant="default" disabled={!r.notification?.text} disabledReason="Write the notification text first" />
    ) : r.stage === "Notify" ? (
      r.notification?.exportedOn ? <Button onClick={() => setDlg("rmas")}>Create recall RMAs</Button> : <Button onClick={() => setDlg("export")}>Export notification list</Button>
    ) : next ? (
      <Button onClick={() => setDlg("advance")}>Advance to {next}</Button>
    ) : undefined
  return (
    <>
      <DetailPage
        header={{
          title: `${r.id} · ${r.title}`,
          screenId: "RCL-001",
          crumbs: [{ label: "Recall Campaigns", to: "/quality/recalls" }, { label: r.id }],
          description: `${r.trigger}: ${r.reason}`,
          primary,
          actions: r.stage !== "Closed" && r.stage !== "Identify" ? <Button variant="outline" onClick={() => report(act.derive(r.id), (x) => (x.added ? `Population v${r.populationVersion + 1}: +${x.added}` : "No change: population is current"))}>Re-derive population</Button> : undefined,
          chips: <Reading id="QT-R06" />,
        }}
        status={{ kind: "recall", value: r.stage }}
        doc={{ type: "recall", id: r.id }}
        summary={
          <>
            <KV k="Suspect">{[...r.suspect.batches, ...r.suspect.serials].join(", ")}</KV>
            <KV k="Population">{`${r.population.length} (v${r.populationVersion})`}</KV>
            <KV k="Held">{`${r.population.filter((p) => p.held).length}`}</KV>
            <KV k="Accounted">{`${accounted(r)} of ${r.population.length} (${pct(r)}%)`}</KV>
            <KV k="CAPA">{r.capaId ? <DocLinkText r={{ type: "capa", id: r.capaId }} /> : "Not linked"}</KV>
            <KV k="RMAs">{r.rmaIds.length ? <span className="flex flex-wrap gap-2">{r.rmaIds.map((x) => <DocLinkText key={x} r={{ type: "rma", id: x }} />)}</span> : "None"}</KV>
            <KV k="Cost to date">{fmtMoney(r.costToDate)}</KV>
            <KV k="Owner">{userName(r.ownerId)}</KV>
          </>
        }
        tabs={[
          { id: "pop", label: "Population", count: r.population.length, content: <Population r={r} /> },
          { id: "contain", label: "Containment", content: <Containment r={r} onHold={() => setDlg("hold")} /> },
          { id: "notify", label: "Notification", content: <Notification r={r} onExport={() => setDlg("export")} /> },
          { id: "contact", label: "Contact log", content: <ContactLog r={r} /> },
          { id: "recover", label: "Recovery", content: <Recovery r={r} /> },
          { id: "eff", label: "Effectiveness", content: <Effectiveness r={r} /> },
          { id: "activity", label: "Activity", content: <ActivityList items={r.activity} /> },
          { id: "rules", label: "Rules", content: <RulesPanel rules={RCL_RULES} /> },
        ]}
      />
      <DialogShell
        open={dlg === "hold"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Mass hold for ${r.id}`}
        consequence={`Blocks all on-hand affected stock (${r.population.filter((p) => ["In stock", "WIP", "Returned"].includes(p.where) && !p.held).length} newly, ${r.population.filter((p) => p.held).length} already held as a logged no-op) and suspect batches ${r.suspect.batches.join(", ") || "none"}. ${r.stage === "Identify" ? "The campaign moves to Contain." : ""} Materials is told through stockStatusChanged.`}
        confirmLabel="Apply mass hold"
        destructive
        onConfirm={() => {
          const x = act.massHold(r.id)
          return report(x, (v) => `${v.held} blocked, ${v.noop} already held`) ? null : (x as { error: string }).error
        }}
      />
      <ExportDialog r={r} open={dlg === "export"} onClose={() => setDlg(null)} />
      <DialogShell
        open={dlg === "rmas"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Create recall-class RMAs for ${r.id}`}
        consequence={`Requests one recall-class RMA per customer for ${r.population.filter((p) => p.where === "In field" && !p.rmaId).length} field unit(s); PE pays freight. The campaign moves to Recover; Sales drafts the RMAs and they link back here.`}
        confirmLabel="Create RMAs"
        wide
        onConfirm={() => {
          const x = act.createRmas(r.id)
          return report(x, (log) => `${log.length} RMA request(s) sent to Sales`) ? null : (x as { error: string }).error
        }}
      >
        <PostingPreview title="Postings through the RMAs (at receipt and disposition)" lines={[{ template: 17, amount: null, notPostedReason: "Posted at RMA receipt (RMA-RECEIPT)" }, { template: 20, amount: null, notPostedReason: "Posted only on a Scrap disposition (RMA-DISP)" }]} />
        <p className="text-xs text-muted-foreground">One RMA per customer <Reading id="QT-R07" /> <Reading id="QT-R23" /></p>
      </DialogShell>
      <DialogShell
        open={dlg === "advance"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Advance ${r.id} to ${next}`}
        consequence={next === "Closed" ? `Closes the campaign with ${pct(r)}% accounted and the effectiveness report; the CAPA must be linked.` : `Moves the campaign to ${next}.`}
        confirmLabel={`Advance to ${next}`}
        onConfirm={() => {
          const x = act.advance(r.id)
          return report(x, `Stage ${next}`) ? null : (x as { error: string }).error
        }}
      />
    </>
  )
}

function Population({ r }: { r: QtRecall }) {
  const [sel, setSel] = useState<string[]>([])
  const [disp, setDisp] = useState<NonNullable<PopulationRow["disposition"]>>("Recovered")
  const canDispose = r.stage === "Recover" || r.stage === "Disposition"
  const cols: Column<PopulationRow>[] = [
    { id: "serial", header: "Serial", value: (p) => p.serial, mono: true, sortable: true, cell: (p) => <DocLinkText r={{ type: "serial", id: p.serial }} /> },
    { id: "item", header: "Item", value: (p) => p.itemId, cell: (p) => <span title={materialText(p.itemId)}>{p.itemId}</span> },
    { id: "batch", header: "Batch", value: (p) => p.batchId, mono: true },
    { id: "where", header: "Where", value: (p) => p.where, filterable: true },
    { id: "parent", header: "Installed in", value: (p) => p.parentSerial ?? "", mono: true },
    { id: "loc", header: "Customer site / warehouse", value: (p) => (p.customerId ? `${customerName(p.customerId)} · ${p.site}` : p.warehouseId ?? "") },
    { id: "held", header: "Held", value: (p) => (p.held ? "Held" : ""), filterable: true },
    { id: "notified", header: "Notified", value: (p) => p.notifiedOn ?? "", mono: true },
    { id: "rma", header: "RMA", value: (p) => p.rmaId ?? (p.rmaRequestedOn ? "Requested" : ""), cell: (p) => (p.rmaId ? <DocLinkText r={{ type: "rma", id: p.rmaId }} /> : p.rmaRequestedOn ? <span className="text-muted-foreground">Requested {p.rmaRequestedOn}</span> : "") },
    { id: "disp", header: "Accounted as", value: (p) => p.disposition ?? "", filterable: true },
    { id: "v", header: "Added in", value: (p) => p.addedInVersion, cell: (p) => `v${p.addedInVersion}`, mono: true },
  ]
  return (
    <div className="flex flex-col gap-4">
      {canDispose && sel.length > 0 && (
        <div role="region" aria-label="Disposition" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-4 py-2 text-sm">
          <span className="font-medium">{sel.length} selected</span>
          <Pick id="pop-disp" value={disp} onChange={setDisp} options={["Recovered", "Field-corrected", "Documented exception"] as NonNullable<PopulationRow["disposition"]>[]} />
          <Button size="sm" onClick={() => report(act.dispose(r.id, sel, disp), `${sel.length} accounted as ${disp}`) && setSel([])}>Record</Button>
        </div>
      )}
      <DataTable
        rows={r.population}
        columns={cols}
        rowId={(p) => p.serial}
        selectable={canDispose}
        selected={sel}
        onSelectedChange={setSel}
        densityKey="RCL-POP"
        searchText={(p) => `${p.serial} ${p.parentSerial ?? ""} ${customerName(p.customerId)} ${p.site ?? ""}`}
        empty={{ title: "No population yet", body: "Derive the population by forward trace from the suspect batches and serials." }}
      />
      <Section title="Population versions">
        {r.versions.length ? (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow><TableHead>Version</TableHead><TableHead>On</TableHead><TableHead>By</TableHead><TableHead className="text-right">Units</TableHead><TableHead>Diff</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {[...r.versions].reverse().map((v) => (
                <TableRow key={v.v}>
                  <TableCell className="tabular">v{v.v}</TableCell>
                  <TableCell className="tabular">{v.on}</TableCell>
                  <TableCell>{userName(v.by)}</TableCell>
                  <TableCell className="tabular text-right">{v.count}</TableCell>
                  <TableCell>{v.diff}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No version yet.</p>
        )}
      </Section>
      <p className="text-xs text-muted-foreground">Location words <Reading id="QT-R17" /></p>
    </div>
  )
}

function Containment({ r, onHold }: { r: QtRecall; onHold: () => void }) {
  const s = useSlice("qualityTrace")
  const onHand = r.population.filter((p) => ["In stock", "WIP", "Returned"].includes(p.where))
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Suspect batches" action={r.stage !== "Closed" && r.population.length > 0 ? <Button size="sm" variant="outline" onClick={onHold}>Mass hold</Button> : undefined}>
        <ul className="flex flex-col gap-2 text-sm">
          {r.suspect.batches.map((b) => {
            const bt = s.batches.find((x) => x.id === b)
            return (
              <li key={b} className="flex flex-wrap items-center gap-2">
                <DocLinkText r={{ type: "batch", id: b }} /> {bt ? <StatusBadge kind="stock" status={bt.stock} size="sm" /> : null}
                {bt?.reservedFor && <Chip kind="hold" note="Reserved stock stays blocked until the campaign releases it">Reserved for {bt.reservedFor}</Chip>}
                <span className="text-muted-foreground">{bt ? `${bt.qty} on hand · ${bt.vendorBatch ?? ""}` : ""}</span>
              </li>
            )
          })}
          {!r.suspect.batches.length && <li className="text-muted-foreground">Serial-based campaign: {r.suspect.serials.join(", ")}</li>}
        </ul>
      </Section>
      <Section title="On-hand affected stock">
        <p className="text-sm">{onHand.filter((p) => p.held).length} of {onHand.length} held</p>
        <Progress value={onHand.length ? (onHand.filter((p) => p.held).length / onHand.length) * 100 : 0} aria-label="Held share" />
        <ul className="text-sm">{onHand.map((p) => <li key={p.serial}>{p.serial} · {p.where} {p.warehouseId ?? ""} · {p.held ? "held" : "not held"}</li>)}</ul>
      </Section>
    </div>
  )
}

function Notification({ r, onExport }: { r: QtRecall; onExport: () => void }) {
  const [text, setText] = useState(r.notification?.text ?? "")
  const core = useCore()
  const editable = r.stage === "Identify" || r.stage === "Contain"
  const req = core.approvals.filter((a) => a.kind === "Recall external notification" && a.subject.id === r.id)
  const list = r.population.filter((p) => p.where === "In field" || p.where === "Returned")
  const byCustomer = useMemo(() => [...new Set(list.map((p) => p.customerId))], [list])
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="External notification text">
        <Label htmlFor="ntext" className="sr-only">Notification text</Label>
        <Textarea id="ntext" rows={8} value={text} onChange={(e) => setText(e.target.value)} disabled={!editable} />
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => report(act.setText(r.id, text), "Text saved")}>Save text</Button>
            {r.stage === "Contain" && <ApprovalButton kind="Recall external notification" subject={{ type: "recall", id: r.id }} title={`Notification text for ${r.id}`} label="Send for dual approval" stay disabled={!r.notification?.text} disabledReason="Save the text first" />}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">The text is fixed once approved.</p>
        )}
      </Section>
      <Section title="Dual approval (C-52)">
        <ul className="text-sm">
          {r.notificationApprovals.length ? r.notificationApprovals.map((a) => <li key={a.role}>{a.role} · {a.on}</li>) : <li className="text-muted-foreground">Not approved yet. Quality Manager and an executive approve in WF-INBOX.</li>}
        </ul>
        {req.map((a) => (
          <p key={a.id} className="text-sm">
            <Link className="text-link underline-offset-4 hover:underline" to={`/approvals?req=${a.id}`}>{a.id}</Link> · {a.outcome ?? "waiting"}
          </p>
        ))}
      </Section>
      <Section title={`Notification list (${list.length} units, ${byCustomer.length} customers)`} action={r.stage !== "Identify" && r.stage !== "Contain" ? <Button size="sm" variant="outline" onClick={onExport}>Export list</Button> : undefined}>
        <ul className="text-sm">{byCustomer.map((c) => <li key={c}>{customerName(c)}: {list.filter((p) => p.customerId === c).map((p) => p.serial).join(", ")}</li>)}</ul>
        <p className="text-xs text-muted-foreground">{r.notification?.exportedOn ? `Exported ${r.notification.exportedOn} (logged as a PII disclosure)` : "Not exported."}</p>
      </Section>
      <div className="lg:col-span-2">
        <PiiLog recallId={r.id} />
      </div>
    </div>
  )
}

function ExportDialog({ r, open, onClose }: { r: QtRecall; open: boolean; onClose: () => void }) {
  const [ack, setAck] = useState(false)
  const n = r.population.filter((p) => p.where === "In field" || p.where === "Returned").length
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => {
        if (!o) setAck(false)
        if (!o) onClose()
      }}
      title={`Export notification list for ${r.id}`}
      description="The list holds customer names, sites and serial numbers: personal and commercial data."
      consequence={`Exports ${n} customer site rows with the approved text and writes a PII disclosure entry (who, when, rows, purpose). It cannot be undone; the entry stays on the campaign.`}
      confirmLabel="Export list"
      requireReason
      reasonLabel="Purpose of the disclosure (required)"
      confirmDisabled={!ack}
      onConfirm={(purpose) => {
        const x = act.exportList(r.id, purpose)
        if (!report(x, "Notification list exported and logged as a PII disclosure")) return (x as { error: string }).error
        setAck(false)
        return null
      }}
    >
      <label className="flex min-h-8 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        I confirm the file goes only to the recall notification mailing and is not kept outside the campaign.
      </label>
    </DialogShell>
  )
}

function Recovery({ r }: { r: QtRecall }) {
  const field = r.population.filter((p) => p.where === "In field" || p.where === "Returned")
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Recovery tracker">
        <p className="text-sm">{accounted(r)} of {r.population.length} accounted ({pct(r)}%)</p>
        <Progress value={pct(r)} aria-label="Accounted" />
        <Table>
          <TableBody>
            {(["Recovered", "Field-corrected", "Documented exception"] as const).map((d) => (
              <TableRow key={d}><TableCell>{d}</TableCell><TableCell className="tabular text-right">{r.population.filter((p) => p.disposition === d).length}</TableCell></TableRow>
            ))}
            <TableRow><TableCell>Not yet accounted</TableCell><TableCell className="tabular text-right">{r.population.filter((p) => !p.disposition).length}</TableCell></TableRow>
          </TableBody>
        </Table>
      </Section>
      <Section title="Recall-class RMAs">
        <ul className="text-sm">
          {r.rmaIds.map((x) => <li key={x}><DocLinkText r={{ type: "rma", id: x }} /> · {r.population.filter((p) => p.rmaId === x).map((p) => p.serial).join(", ")}</li>)}
          {!r.rmaIds.length && <li className="text-muted-foreground">None yet: requested at Notify for {field.filter((p) => p.where === "In field").length} field units.</li>}
          {r.population.some((p) => p.rmaRequestedOn && !p.rmaId) && <li className="text-muted-foreground">Requested, waiting for Sales: {r.population.filter((p) => p.rmaRequestedOn && !p.rmaId).map((p) => p.serial).join(", ")}</li>}
        </ul>
      </Section>
      <Section title="Partial recovery sign-off">
        <p className="text-sm">Needed only when 100% cannot be accounted. Quality Manager plus an executive. <Reading id="QT-R11" /></p>
        <ul className="text-sm">{(r.partialSignoff ?? []).map((x) => <li key={x.role}>{x.role}: {userName(x.by)} · {x.on}</li>)}</ul>
        {r.stage !== "Closed" && <Button size="sm" variant="outline" onClick={() => report(act.signPartial(r.id), "Sign-off recorded")}>Sign partial recovery</Button>}
      </Section>
    </div>
  )
}

function Effectiveness({ r }: { r: QtRecall }) {
  return (
    <div className="flex max-w-[960px] flex-col gap-4 text-sm">
      <p>Gate: 100% accounted, or partial recovery signed by the Quality Manager and an executive; CAPA {r.capaId ? <DocLinkText r={{ type: "capa", id: r.capaId }} /> : "not linked"}.</p>
      {r.effectiveness ? (
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KV k="Closed on">{r.effectiveness.on}</KV>
          <KV k="By">{userName(r.effectiveness.by)}</KV>
          <KV k="Accounted">{`${r.effectiveness.accountedPct}%`}</KV>
          <KV k="Cost report">{r.effectiveness.costReport}</KV>
        </dl>
      ) : (
        <p className="text-muted-foreground">Effectiveness report is produced when the campaign closes.</p>
      )}
      <p>Evidence dossier: <Link className="text-link underline-offset-4 hover:underline" to={`/traceability/explorer?q=${r.suspect.batches[0] ?? r.suspect.serials[0]}&dir=forward`}>forward trace of {r.suspect.batches[0] ?? r.suspect.serials[0]}</Link></p>
    </div>
  )
}
