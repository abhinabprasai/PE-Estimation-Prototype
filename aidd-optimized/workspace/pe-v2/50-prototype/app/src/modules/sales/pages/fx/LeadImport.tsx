// FX-OM-LEADIMPORT Lead import and inbound capture review (/sales/leads/import). Workbench: web-form, email and
// trade-contact captures wait here for a person. Accept makes a lead (V-OM-40 duplicate warning), merge adds the
// capture to a lead already worked, reject needs a reason. A CSV import validates row by row [DOC:p.249 Book VI §4].
import { useRef, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { WorkbenchPage, DialogShell } from "@/components/templates"
import { Chip, RulesPanel, type Column } from "@/components/patterns"
import { useSlice } from "@/store"
import { listDate } from "../../data/model"
import { duplicateCheck } from "../../data/ext-actions"
import { acceptInbound, importCsv, mergeInbound, rejectInbound, type CsvResult } from "../../fx/actions"
import { INBOUND_REJECT_REASONS, type InboundCapture } from "../../fx/model"
import { A, Reading, Section } from "../../components/ext"
import { Inline, PickField, StateBar, report, useFxState } from "./kit"

const SAMPLE = `company,contact,title,email,phone,note
Plainsview Electric Cooperative,Hannah Brooks,Engineering Manager,hbrooks@plainsview.example,+1 701 555 0142,Needs two 5 MVA unit substations 2027
Granite Falls Public Utilities,Omar Reyes,Operations Lead,oreyes@granitefalls.example,,Asked for a pad-mount quote at the expo
,Nobody,,missing-company@example.com,,
Cedar Hollow Energy,Ana Petrov,Buyer,not-an-email,,`

const QUEUES = [
  { id: "review", label: "Needs review" },
  { id: "dup", label: "Possible duplicate" },
  { id: "new", label: "New" },
  { id: "done", label: "Decided" },
  { id: "batches", label: "Import batches" },
]

export function LeadImport() {
  const db = useSlice("sales")
  const st = useFxState()
  const [queue, setQueue] = useState("review")
  const [openId, setOpenId] = useState<string | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const rows = db.fx.inbound
  const bucket = (c: InboundCapture) => (["Accepted", "Merged", "Rejected"].includes(c.status) ? "done" : c.status === "Possible duplicate" ? "dup" : c.status === "Needs review" ? "review" : "new")
  const count = (q: string) => rows.filter((c) => bucket(c) === q).length
  const shown = queue === "batches" ? [] : rows.filter((c) => bucket(c) === queue)
  const open = rows.find((c) => c.id === openId)

  const cols: Column<InboundCapture>[] = [
    { id: "id", header: "Capture", value: (c) => c.id, mono: true, sortable: true },
    { id: "ch", header: "Channel", value: (c) => c.channel, filterable: true },
    { id: "co", header: "Company", value: (c) => c.company || "No company found", sortable: true },
    { id: "ct", header: "Contact", value: (c) => c.contactName },
    { id: "sub", header: "Subject", value: (c) => c.subject, cell: (c) => <span className="line-clamp-1 max-w-72">{c.subject}</span> },
    { id: "conf", header: "Parse confidence", align: "right", value: (c) => c.confidence, cell: (c) => `${Math.round(c.confidence * 100)}%`, sortable: true },
    { id: "iss", header: "Issues", value: (c) => c.issues.length, cell: (c) => (c.issues.length ? <Badge variant="outline">{c.issues.length}</Badge> : "None"), align: "right" },
    { id: "st", header: "Status", value: (c) => c.status, filterable: true, cell: (c) => <Badge variant="outline">{c.status}</Badge> },
    { id: "at", header: "Received", value: (c) => c.receivedAt, cell: (c) => listDate(c.receivedAt), sortable: true },
  ]

  const batchCols: Column<(typeof db.fx.batches)[number]>[] = [
    { id: "id", header: "Batch", value: (b) => b.id, mono: true },
    { id: "f", header: "File", value: (b) => b.fileName },
    { id: "at", header: "Imported", value: (b) => b.at, cell: (b) => listDate(b.at) },
    { id: "by", header: "By", value: (b) => b.by },
    { id: "r", header: "Rows", value: (b) => b.rows, align: "right" },
    { id: "i", header: "Imported", value: (b) => b.imported, align: "right" },
    { id: "x", header: "Rejected", value: (b) => b.rejected, align: "right", cell: (b) => (b.rejected ? <span title={b.errors.map((e) => `Row ${e.row}: ${e.message}`).join("\n")}>{b.rejected} (rows {b.errors.map((e) => e.row).join(", ")})</span> : "0") },
  ]

  const header = {
    title: "Lead import and inbound capture review",
    screenId: "FX-OM-LEADIMPORT",
    description: "Inbound captures from the web form and the sales mailbox, and trade-contact imports, wait here until a person accepts, merges or rejects them. Nothing becomes a lead on its own.",
    chips: <Chip kind="design" note="Channels are the PRD's (web form, email, trade contact import). The review statuses are design values.">Review statuses: design values</Chip>,
    actions: <Button variant="outline" asChild><Link to="/sales/leads">Back to leads</Link></Button>,
    primary: <Button onClick={() => setCsvOpen(true)} disabled={!st.writable} title={st.why || undefined}><Upload aria-hidden="true" /> Import trade contacts</Button>,
  }
  const kpis = [
    { label: "Needs review", value: count("review"), hint: "parsed with issues or low confidence" },
    { label: "Possible duplicates", value: count("dup"), hint: "V-OM-40 hit on company or domain" },
    { label: "New", value: count("new") },
    { label: "Decided", value: count("done"), hint: "accepted, merged or rejected" },
  ]
  const queues = QUEUES.map((q) => ({ ...q, count: q.id === "batches" ? db.fx.batches.length : count(q.id) }))
  return (
    <div className="flex flex-col gap-4">
      <StateBar st={st} />
      {st.state === "degraded" && <p className="text-sm text-status-pending-ink">Parsing service degraded: confidence values may be old. Accept still works; check the parsed attributes by hand.</p>}
      {queue === "batches" ? (
        <WorkbenchPage header={header} kpis={kpis} queues={queues} queue={queue} onQueueChange={setQueue} table={{ rows: st.empty ? [] : db.fx.batches, columns: batchCols, rowId: (b) => b.id, loading: st.loading, empty: { title: "No import batches", body: "Import a trade-contact CSV to create the first batch." } }} />
      ) : (
        <WorkbenchPage
          header={header}
          kpis={kpis}
          queues={queues}
          queue={queue}
          onQueueChange={setQueue}
          table={{ rows: st.empty ? [] : shown, columns: cols, rowId: (c) => c.id, loading: st.loading, error: st.state === "offline" ? "Offline: the last list loaded is shown." : undefined, onRetry: () => st.setState("normal"), searchText: (c) => `${c.id} ${c.company} ${c.contactName} ${c.email}`, searchPlaceholder: "Search captures", onRowClick: (c) => setOpenId(c.id), activeId: openId ?? undefined, densityKey: "FX-OM-LEADIMPORT", empty: { title: "No captures in this queue", body: queue === "review" ? "Everything parsed cleanly. Check New or Possible duplicate." : "Nothing here." } }}
          panel={{ open: !!open, onOpenChange: (o) => !o && setOpenId(null), title: open ? `${open.id} ${open.company || "No company found"}` : "Capture", description: open ? `${open.channel}, received ${listDate(open.receivedAt)}` : undefined, content: open ? <CapturePanel key={open.id} c={open} st={st} onDone={() => setOpenId(null)} /> : null }}
        />
      )}
      <ImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
      <RulesPanel rules={[
        ["V-OM-40", "Duplicate warning on company name and email domain across leads and customers, on accept and on import.", "DOC:p.249 §4.1"],
        ["OM-LEAD-b", "Accepting a capture creates a lead only (Open); the customer is made at conversion, in Prospect, with no credit limit.", "DOC:p.249 §4.1"],
        ["IMP-1", "Parsed attributes (kVA, voltages, standards) land in the lead's requirement panel unchanged; a person confirms them.", "Design value"],
        ["IMP-2", "A CSV needs company, contact and email; rows that fail are listed with the row number and the reason, valid rows still import for review.", "Design value"],
      ]} />
    </div>
  )
}

function CapturePanel({ c, st, onDone }: { c: InboundCapture; st: ReturnType<typeof useFxState>; onDone: () => void }) {
  const db = useSlice("sales")
  const [err, setErr] = useState<{ text: string; field?: string } | null>(null)
  const [mergeId, setMergeId] = useState("")
  const [rejectOpen, setRejectOpen] = useState(false)
  const dups = duplicateCheck(db, c.company, c.email)
  const decided = ["Accepted", "Merged", "Rejected"].includes(c.status)
  const lock = !st.writable || decided
  const accept = (force: boolean) => {
    const r = acceptInbound(c.id, force)
    if (r.ok) {
      toast.success(`${r.value} created from ${c.id}. Parsed attributes carried into its requirement panel.`)
      setErr(null)
      onDone()
    } else setErr({ text: r.error, field: r.field })
  }
  return (
    <div className="flex flex-col gap-4">
      <Section title="What arrived">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Contact</dt><dd>{c.contactName}{c.contactTitle ? `, ${c.contactTitle}` : ""}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Email</dt><dd>{c.email || "Not recorded"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{c.phone || "Not recorded"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Batch</dt><dd>{c.batchId ?? "None (single capture)"}</dd></div>
        </dl>
        <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-line">{c.subject}{c.body ? `\n\n${c.body}` : ""}</p>
      </Section>
      <Section title="Parsed requirement attributes" action={<Reading id="IMP-1" note="Attributes the parser lifted from the text. A person confirms them on the lead." />}>
        {Object.keys(c.parsed).length === 0 ? <p className="text-sm text-muted-foreground">Nothing could be read from the text. The lead opens with an empty requirement panel.</p> : (
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {Object.entries(c.parsed).map(([k, v]) => <li key={k}><span className="text-muted-foreground">{k}: </span>{v}</li>)}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Confidence {Math.round(c.confidence * 100)}%</p>
      </Section>
      {(c.issues.length > 0 || dups.length > 0) && (
        <Section title="Checks">
          <ul className="list-disc pl-5 text-sm">
            {c.issues.map((i) => <li key={i}>{i}</li>)}
            {dups.map((d) => <li key={d}>V-OM-40 matches <A to={d.startsWith("LEAD") ? `/sales/leads/${d.split(" ")[0]}` : `/sales/customers/${d.split(" ")[0]}`}>{d}</A></li>)}
          </ul>
        </Section>
      )}
      <Inline error={err} onDismiss={() => setErr(null)} />
      {decided ? (
        <p className="text-sm">{c.status}{c.leadId ? <> into <A to={`/sales/leads/${c.leadId}`}>{c.leadId}</A></> : null}{c.reason ? `: ${c.reason}` : ""}. Decided by {c.decidedBy ?? "Not recorded"}. The capture is read-only now.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Button onClick={() => accept(false)} disabled={lock} title={st.why || undefined}>Accept as lead</Button>
            {err?.field === "duplicate" && <Button variant="outline" onClick={() => accept(true)} disabled={lock}>Accept anyway (new requirement)</Button>}
            <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={lock}>Reject</Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <PickField label="Merge into a lead already worked" value={mergeId} onChange={setMergeId} options={db.leads.filter((l) => !["Won", "Lost", "Disqualified"].includes(l.stage)).map((l) => ({ value: l.id, label: `${l.id} ${l.company}` }))} disabled={lock} />
            </div>
            <Button variant="outline" disabled={lock || !mergeId} onClick={() => { const r = mergeInbound(c.id, mergeId); if (report(r, `${c.id} merged into ${mergeId}`)) setErr({ text: (r as { error: string }).error }); else onDone() }}>Merge</Button>
          </div>
        </>
      )}
      <DialogShell open={rejectOpen} onOpenChange={setRejectOpen} title={`Reject ${c.id}`} description={c.company || "No company found"} consequence={`Closes ${c.id} as Rejected with the reason. No lead is created; the capture stays on this list.`} confirmLabel="Reject capture" destructive requireReason reasonLabel={`Reason (${INBOUND_REJECT_REASONS.join(", ")})`} onConfirm={(reason) => { const r = rejectInbound(c.id, reason); const e = report(r, `${c.id} rejected`); if (!e) onDone(); return e }} />
    </div>
  )
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("")
  const [name, setName] = useState("trade-contacts.csv")
  const [err, setErr] = useState<{ text: string; field?: string } | null>(null)
  const [res, setRes] = useState<CsvResult | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const run = () => {
    const r = importCsv(name, text)
    if (r.ok) {
      setRes(r.value)
      setErr(null)
      toast.success(`${r.value.imported} of ${r.value.rows} rows imported for review in ${r.value.batchId}`)
    } else setErr({ text: r.error, field: r.field })
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setRes(null); setErr(null) } onOpenChange(o) }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import trade contacts</DialogTitle>
          <DialogDescription>CSV with company, contact, title, email, phone, note. Each row is checked on its own; valid rows land here for review, never straight on the lead list.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={file} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose a CSV file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setName(f.name); setText(await f.text()); setRes(null) } }} />
          <Button variant="outline" onClick={() => file.current?.click()}>Choose file</Button>
          <Button variant="ghost" onClick={() => { setText(SAMPLE); setName("utility-expo-oct-contacts.csv"); setRes(null) }}>Use the sample file</Button>
          <span className="text-sm text-muted-foreground">{name}</span>
        </div>
        <Textarea aria-label="CSV text" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste CSV text or choose a file" className="font-mono text-xs" />
        <Inline error={err} />
        {res && (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">{res.batchId}: {res.imported} imported, {res.rejected} rejected of {res.rows} rows</p>
            {res.errors.length > 0 && <ul className="list-disc pl-5">{res.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{res ? "Close" : "Cancel"}</Button>
          <Button onClick={run} disabled={!text.trim()}>Validate and import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
