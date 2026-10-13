// EDI-PART-001 partner profiles (list and detail) and EDI-MON-001 envelope monitor and reprocessing [Book IX §5].
// Partner onboarding is configuration, never code: mapping profile, identifiers, channel, certificates, envelope options.
// Every envelope logs control numbers, parse state, created documents and errors; failed envelopes land in the
// reprocessing console where edit rights are restricted and audited (same discipline as the integration DLQ).

import { useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, EmptyState, KV, RulesPanel, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage, WorkbenchPage } from "@/components/templates"
import { VENDORS } from "@/data/shared"
import { daysBetween, fmtDate } from "@/lib/format"
import type { Role } from "@/data/domain"
import { ProtoError, useMutate, useSlice } from "@/store"
import { Field, Loading, Section, Tag, TargetFrame, useScreenState } from "../components"
import { EDI_SETS, REQUIRED_SEGMENTS, continuity, parseEnvelope, type AckState, type EdiEnvelope, type EdiPartner, type EdiSet, type EdiStage, type ParseState } from "../data/edi"
import { NOW } from "../data/machine"
import { nid, vendorName } from "../lib"

const EVIDENCE = "three months of parallel running with the top volume vendor reconciling to the manual flow with zero unexplained differences, then cutover partner by partner"
const stageFamily = (s: EdiStage) => (s === "Draft" ? "draft" : s === "Parallel run" ? "active" : "done")
const parseFamily = (s: ParseState) => (s === "Failed" || s === "Rejected" ? "exception" : s === "Received" ? "pending" : "done")
const ackFamily = (s: AckState) => (s === "997 overdue" ? "exception" : s === "Awaiting 997" ? "pending" : "done")
const RESTRICTED = { roles: ["Plant IT", "Engineering IT"] as Role[], why: "Editing an envelope is restricted and audited; the PRD names no role (reading: IT roles)" }

/** Acknowledgement state as the monitor shows it: a missing 997 beyond the partner window alerts. */
function ackOf(e: EdiEnvelope, p?: EdiPartner): AckState {
  if (e.ack !== "Awaiting 997" || !p) return e.ack
  const mins = (new Date(NOW.replace(" ", "T") + "Z").getTime() - new Date(e.at.replace(" ", "T") + "Z").getTime()) / 60000
  return mins > p.ackWindowHrs * 60 ? "997 overdue" : "Awaiting 997"
}
const monthsRun = (p: EdiPartner) => (p.parallelStart ? daysBetween(p.parallelStart, "2026-10-09") / 30.4 : 0)

// ============================================================================ partners list
export function EdiPartners() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("edi-partners", { validation: "Validation: a partner needs an Active vendor, a unique ISA identifier of at most 15 characters, a channel endpoint and a certificate expiry date." })
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ vendorId: "", mapping: "", qual: "ZZ", isaId: "", channel: "AS2" as "AS2" | "SFTP", endpoint: "", cert: "", ack: "4" })
  const [err, setErr] = useState<Record<string, string>>({})
  const free = VENDORS.filter((v) => !s.edi.partners.some((p) => p.vendorId === v.id))
  const cols: Column<EdiPartner>[] = [
    { id: "id", header: "Partner profile", value: (p) => p.id, mono: true, sortable: true },
    { id: "vendor", header: "Vendor", value: (p) => vendorName(p.vendorId), sortable: true, filterable: true },
    { id: "channel", header: "Channel", value: (p) => p.channel, filterable: true },
    { id: "stage", header: "Onboarding stage", value: (p) => p.stage, filterable: true, cell: (p) => <Tag family={stageFamily(p.stage)} label={p.stage} /> },
    { id: "sets", header: "Transaction sets", value: (p) => Object.entries(p.sets).filter(([, v]) => v).map(([k]) => k).join(" ") },
    { id: "cert", header: "Certificate expires", value: (p) => p.certExpiry, sortable: true, cell: (p) => <span>{fmtDate(p.certExpiry)} {daysBetween("2026-10-09", p.certExpiry) < 60 && <Chip kind="flag" note="Certificate expires inside 60 days (design threshold)">Renew soon</Chip>}</span> },
    { id: "par", header: "Parallel run", value: (p) => (p.stage === "Draft" ? "" : `${monthsRun(p).toFixed(1)} of 3 months`), cell: (p) => (p.stage === "Draft" ? "Not started" : `${monthsRun(p).toFixed(1)} of 3 months, ${p.unexplainedDiffs} unexplained`) },
  ]
  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.vendorId) e.vendorId = "Choose a vendor."
    else {
      const v = VENDORS.find((x) => x.id === f.vendorId)!
      if (v.onboarding !== "Active" || v.quality === "Disqualified") e.vendorId = `${v.name} is ${v.onboarding} / ${v.quality}; only an Active, qualified vendor can exchange purchase orders.`
    }
    if (!f.mapping.trim()) e.mapping = "Name the mapping profile."
    if (!f.isaId.trim()) e.isaId = "Enter the interchange identifier."
    else if (f.isaId.length > 15) e.isaId = "At most 15 characters."
    else if (s.edi.partners.some((p) => p.isaId.toLowerCase() === f.isaId.toLowerCase())) e.isaId = "Another partner already uses this identifier."
    if (!f.endpoint.trim()) e.endpoint = "Enter the endpoint (AS2 URL or SFTP host)."
    if (!f.cert) e.cert = "Enter the certificate expiry date."
    else if (f.cert <= "2026-10-09") e.cert = "The certificate is already expired."
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => {
      const id = nid(d, "EDI-PTR")
      d.edi.partners.push({ id, vendorId: f.vendorId, mappingProfile: f.mapping.trim(), isaQualifier: f.qual, isaId: f.isaId.trim(), channel: f.channel, endpoint: f.endpoint.trim(), certExpiry: f.cert, envelopeOptions: "Element *, segment ~", ackWindowHrs: Number(f.ack) || 4, sets: { "850": true, "860": false, "855": true, "856": true, "810": false, "997": true }, stage: "Draft", unexplainedDiffs: 0, volumeRank: d.edi.partners.length + 1, version: 1, history: [{ at: "2026-10-09", by: "Plant IT", text: "Profile created" }] })
    })
    if (!r.ok) return r.error
    setF({ vendorId: "", mapping: "", qual: "ZZ", isaId: "", channel: "AS2", endpoint: "", cert: "", ack: "4" })
    return null
  }
  return (
    <>
      <TargetFrame st={st} decision="Full EDI is a Book IX target-state module (Book IX §5)" evidence={EVIDENCE} />
      <ListPage
        header={{
          title: "EDI partner profiles", screenId: "EDI-PART-001",
          description: "Partner onboarding is governed configuration: a mapping profile, identifiers, channel, certificates and envelope options. No code. Channels AS2 and SFTP.",
          primary: <Button disabled={st.locked} onClick={() => { setErr({}); setOpen(true) }}>New partner profile</Button>,
        }}
        table={{ rows: st.rows(s.edi.partners), columns: cols, rowId: (p) => p.id, rowHref: (p) => `/target/edi/partners/${p.id}`, searchText: (p) => `${p.id} ${vendorName(p.vendorId)} ${p.isaId}`, loading: st.loading, empty: { title: "No EDI partner yet", body: "Create a profile for the first vendor; the top volume vendor goes first." } }}
        below={<RulesPanel rules={[["EDI-1", "Every envelope is functionally acknowledged (997); a missing 997 beyond the partner window alerts.", "Book IX §5.1"], ["EDI-2", "Cutover is partner by partner, after three months of parallel running that reconcile with zero unexplained differences.", "Book IX §5 evidence"], ["EDI-3", "A transaction that would create a state a screen could not create is rejected at the boundary.", "Book IX §5"]]} />}
      />
      <DialogShell open={open} onOpenChange={setOpen} title="New EDI partner profile" description="Configuration only. The profile starts in Draft; a parallel run comes before cutover." confirmLabel="Create profile" onConfirm={submit} consequence="Creates the profile in Draft for the chosen vendor. No envelope is sent until the profile enters its parallel run." wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor" id="ep-v" error={err.vendorId}>
            <Select value={f.vendorId} onValueChange={(v) => setF({ ...f, vendorId: v })}><SelectTrigger id="ep-v"><SelectValue placeholder="Choose a vendor" /></SelectTrigger><SelectContent>{free.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Mapping profile" id="ep-m" error={err.mapping}><Input id="ep-m" value={f.mapping} onChange={(e) => setF({ ...f, mapping: e.target.value })} placeholder="MAP-TBD-VENDOR-v1" /></Field>
          <Field label="Interchange qualifier" id="ep-q"><Select value={f.qual} onValueChange={(v) => setF({ ...f, qual: v })}><SelectTrigger id="ep-q"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ZZ">ZZ mutually defined</SelectItem><SelectItem value="01">01 DUNS</SelectItem></SelectContent></Select></Field>
          <Field label="Interchange ID" id="ep-i" error={err.isaId} hint="At most 15 characters"><Input id="ep-i" value={f.isaId} onChange={(e) => setF({ ...f, isaId: e.target.value })} /></Field>
          <Field label="Channel" id="ep-c"><Select value={f.channel} onValueChange={(v) => setF({ ...f, channel: v as "AS2" | "SFTP" })}><SelectTrigger id="ep-c"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AS2">AS2</SelectItem><SelectItem value="SFTP">SFTP</SelectItem></SelectContent></Select></Field>
          <Field label="Endpoint" id="ep-e" error={err.endpoint}><Input id="ep-e" value={f.endpoint} onChange={(e) => setF({ ...f, endpoint: e.target.value })} /></Field>
          <Field label="Certificate expires" id="ep-x" error={err.cert}><Input id="ep-x" type="date" value={f.cert} onChange={(e) => setF({ ...f, cert: e.target.value })} /></Field>
          <Field label="997 window (hours)" id="ep-a" hint="Design default 4"><Input id="ep-a" inputMode="numeric" value={f.ack} onChange={(e) => setF({ ...f, ack: e.target.value })} /></Field>
        </div>
      </DialogShell>
    </>
  )
}

// ============================================================================ partner detail
export function EdiPartnerDetail() {
  const { id } = useParams()
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("edi-partner-detail", { validation: "Validation: a profile needs at least the 850 and the 997 enabled." })
  const [cut, setCut] = useState(false)
  const p = s.edi.partners.find((x) => x.id === id)
  if (!p) return <EmptyState title="Partner profile not found">No EDI partner has id {id}. <Link className="text-link underline" to="/target/edi/partners">Back to partner profiles</Link></EmptyState>
  const envs = s.edi.envelopes.filter((e) => e.partnerId === p.id)
  const cont = continuity(s.edi.envelopes, p.id)
  const months = monthsRun(p)
  const canCut = p.stage === "Parallel run" && months >= 3 && p.unexplainedDiffs === 0
  const toggle = (set: EdiSet, on: boolean) =>
    st.run(() => {
      const r = mutate((d) => {
        const x = d.edi.partners.find((q) => q.id === p.id)!
        const next = { ...x.sets, [set]: on }
        if (!next["850"] || !next["997"]) throw new ProtoError("An 850 outbound and the 997 are always enabled: every envelope must be acknowledged.")
        x.sets = next
        x.version += 1
        x.history.unshift({ at: "2026-10-09", by: "Plant IT", text: `Version ${x.version}: ${set} ${on ? "enabled" : "disabled"}` })
      })
      return r.ok ? { ok: `Profile ${p.id} is now version ${p.version + 1}` } : r.error
    })
  const sendTest = () =>
    st.run(() => {
      mutate((d) => {
        const x = d.edi.envelopes.filter((e) => e.partnerId === p.id)
        const icn = Math.max(0, ...x.map((e) => e.icn)) + 1
        d.edi.envelopes.push({ id: nid(d, "EDI-ENV"), partnerId: p.id, dir: "Outbound", set: "850", icn, at: "2026-10-09 14:30", parse: "Parsed", ack: "Awaiting 997", docs: [], errors: [], raw: "ST*850*0001~BEG*00*SA*TEST~PO1*10*1*EA*1~SE*4*0001~", audit: [{ at: "2026-10-09", by: "Plant IT", text: "Test 850 sent" }] })
      })
      return { ok: "Test 850 sent; a 997 is expected" }
    })
  const cutover = () => {
    const g = st.guard()
    if (g) return g
    if (!canCut) return `Cutover needs three months of parallel running (now ${months.toFixed(1)}) and zero unexplained differences (now ${p.unexplainedDiffs}).`
    const r = mutate((d) => {
      const x = d.edi.partners.find((q) => q.id === p.id)!
      x.stage = "Cutover"
      x.history.unshift({ at: "2026-10-09", by: "Controller", text: "Cutover after a reconciled parallel run" })
    })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision="Full EDI is a Book IX target-state module (Book IX §5)" evidence={EVIDENCE} />
      <DetailPage
        header={{ title: `${p.id}: ${vendorName(p.vendorId)}`, screenId: "EDI-PART-001", crumbs: [{ label: "Partner profiles", to: "/target/edi/partners" }, { label: p.id }], chips: <Tag family={stageFamily(p.stage)} label={p.stage} />, description: `Mapping ${p.mappingProfile}, version ${p.version}. A change creates a new version; the history stays visible.`, actions: <Button variant="outline" disabled={st.locked} onClick={sendTest}>Send test 850</Button>, primary: p.stage === "Parallel run" ? <Button disabled={st.locked} onClick={() => setCut(true)}>Cut over this partner</Button> : undefined }}
        summary={<><KV k="Channel">{p.channel}</KV><KV k="Endpoint">{p.endpoint}</KV><KV k="Interchange ID">{p.isaQualifier}:{p.isaId}</KV><KV k="Certificate expires">{fmtDate(p.certExpiry)}</KV></>}
        tabs={[
          { id: "sets", label: "Transaction sets", content: st.loading ? <Loading /> : (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Set</TableHead><TableHead>Direction</TableHead><TableHead>Binding behavior</TableHead><TableHead>Enabled</TableHead></TableRow></TableHeader>
              <TableBody>{EDI_SETS.map((x) => (
                <TableRow key={x.set}><TableCell className="font-mono">{x.set} {x.name}</TableCell><TableCell>{x.dir}</TableCell><TableCell className="max-w-xl whitespace-normal text-sm">{x.binding}<div className="text-xs text-muted-foreground">Required segments: {REQUIRED_SEGMENTS[x.set].join(", ")}</div></TableCell>
                  <TableCell><Switch aria-label={`Enable ${x.set}`} checked={p.sets[x.set]} disabled={st.locked} onCheckedChange={(v) => toggle(x.set, v)} /></TableCell></TableRow>
              ))}</TableBody></Table>
          ) },
          { id: "env", label: "Envelopes", count: envs.length, content: (
            <div className="flex flex-col gap-3">
              <p className="text-sm">Control number continuity (inbound): {cont.from != null ? `${String(cont.from).padStart(6, "0")} to ${String(cont.to).padStart(6, "0")}` : "no inbound envelope yet"}. {cont.gaps.length ? <span className="font-semibold text-destructive">Gap: {cont.gaps.map((g) => String(g).padStart(6, "0")).join(", ")} missing.</span> : "No gap."}</p>
              {envs.length === 0 ? <EmptyState title="No envelope yet">Send a test 850 to start the log.</EmptyState> : <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Envelope</TableHead><TableHead>Direction and set</TableHead><TableHead>Control</TableHead><TableHead>Parse</TableHead><TableHead>Acknowledgement</TableHead></TableRow></TableHeader><TableBody>{envs.map((e) => <TableRow key={e.id}><TableCell className="font-mono">{e.id}</TableCell><TableCell>{e.dir} {e.set}</TableCell><TableCell className="tabular">{String(e.icn).padStart(6, "0")}</TableCell><TableCell><Tag family={parseFamily(e.parse)} label={e.parse} /></TableCell><TableCell><Tag family={ackFamily(ackOf(e, p))} label={ackOf(e, p)} /></TableCell></TableRow>)}</TableBody></Table>}
              <Link className="text-sm text-link underline" to="/target/edi/monitor">Open the envelope monitor</Link>
            </div>
          ) },
          { id: "par", label: "Parallel run", content: (
            <div className="flex max-w-xl flex-col gap-2 text-sm">
              <p>Parallel run beside the manual flow: {p.stage === "Draft" ? "not started" : `${months.toFixed(1)} of 3 months since ${fmtDate(p.parallelStart)}`}.</p>
              <p>Unexplained differences against the manual flow: <span className="tabular font-semibold">{p.unexplainedDiffs}</span> (cutover needs zero).</p>
              <p className="text-muted-foreground">Volume rank {p.volumeRank}: the top volume vendor runs first.</p>
              {p.stage === "Draft" && <Button variant="outline" disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => { const x = d.edi.partners.find((q) => q.id === p.id)!; x.stage = "Parallel run"; x.parallelStart = "2026-10-09"; x.history.unshift({ at: "2026-10-09", by: "Plant IT", text: "Parallel run started" }) }); return r.ok ? { ok: "Parallel run started" } : r.error })}>Start parallel run</Button>}
            </div>
          ) },
          { id: "hist", label: "Version history", content: <ul className="space-y-1 text-sm">{p.history.map((h, i) => <li key={i}><span className="tabular">{fmtDate(h.at)}</span> {h.by}: {h.text}</li>)}</ul> },
        ]}
      />
      <DialogShell open={cut} onOpenChange={setCut} title={`Cut over ${vendorName(p.vendorId)}`} confirmLabel="Cut over" onConfirm={cutover} consequence={`Moves ${p.id} from parallel run to cutover: envelopes become the vendor paper flow for this partner. The manual path stays available as the fallback.`} />
    </>
  )
}

// ============================================================================ monitor
export function EdiMonitor() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("edi-monitor", { degraded: "The AS2 gateway answers slowly. Envelopes logged in the last hour may show Received for a few minutes. Showing the log as of 47 minutes ago.", offline: "The monitor cannot reach the integration console. Showing the last synced log; reprocessing waits for the connection." })
  const [queue, setQueue] = useState("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [raw, setRaw] = useState("")
  const [dlg, setDlg] = useState(false)
  const partnerOf = (e: EdiEnvelope) => s.edi.partners.find((p) => p.id === e.partnerId)
  const rows = s.edi.envelopes.map((e) => ({ ...e, ackD: ackOf(e, partnerOf(e)) }))
  const failed = rows.filter((e) => e.parse === "Failed" || e.parse === "Rejected")
  const awaiting = rows.filter((e) => e.ackD === "Awaiting 997" || e.ackD === "997 overdue")
  const exc = rows.filter((e) => e.exception)
  const gaps = s.edi.partners.map((p) => ({ p, c: continuity(s.edi.envelopes, p.id) })).filter((x) => x.c.gaps.length)
  const shown = queue === "failed" ? failed : queue === "awaiting" ? awaiting : queue === "exceptions" ? exc : rows
  const row = rows.find((e) => e.id === openId)
  const cols: Column<(typeof rows)[number]>[] = [
    { id: "id", header: "Envelope", value: (e) => e.id, mono: true, sortable: true },
    { id: "partner", header: "Partner", value: (e) => vendorName(partnerOf(e)?.vendorId ?? ""), filterable: true },
    { id: "dir", header: "Direction", value: (e) => e.dir, filterable: true },
    { id: "set", header: "Set", value: (e) => e.set, filterable: true, mono: true },
    { id: "icn", header: "Control no.", value: (e) => e.icn, mono: true, sortable: true, cell: (e) => String(e.icn).padStart(6, "0") },
    { id: "at", header: "Logged", value: (e) => e.at, sortable: true },
    { id: "parse", header: "Parse state", value: (e) => e.parse, filterable: true, cell: (e) => <Tag family={parseFamily(e.parse)} label={e.parse} /> },
    { id: "ack", header: "997", value: (e) => e.ackD, filterable: true, cell: (e) => <Tag family={ackFamily(e.ackD)} label={e.ackD} /> },
    { id: "docs", header: "Created documents", value: (e) => e.docs.join(" "), cell: (e) => (e.docs.length ? e.docs.join(", ") : "None") },
  ]
  const reprocess = (reason: string, id: string, text: string): string | null => {
    const g = st.guard(RESTRICTED)
    if (g) return g
    const r = mutate((d) => {
      const e = d.edi.envelopes.find((x) => x.id === id)!
      const p = d.edi.partners.find((x) => x.id === e.partnerId)!
      const edited = text !== e.raw
      const res = parseEnvelope(text, e.set, p.vendorId, d.edi.invoices)
      e.audit.push({ at: "2026-10-09", by: "Plant IT", text: `${edited ? "Edited payload and reprocessed" : "Reprocessed unchanged"}. Reason: ${reason || "none given"}` })
      e.raw = text
      if (res.ok) {
        e.parse = "Reprocessed"; e.errors = []
        const doc = e.set === "855" ? nid(d, "VCONF") : e.set === "856" ? nid(d, "ASN") : e.set === "810" ? `INV-TBD-${res.invoiceNo}` : ""
        if (doc) e.docs = [doc]
        if (e.set === "810" && res.invoiceNo) d.edi.invoices.push({ vendorId: p.vendorId, no: res.invoiceNo })
      } else {
        e.errors = res.errors
        e.parse = res.errors.some((x) => x.startsWith("Duplicate")) ? "Rejected" : "Failed"
      }
    })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision="Full EDI is a Book IX target-state module (Book IX §5)" evidence={EVIDENCE} />
      <WorkbenchPage
        header={{
          title: "EDI envelope monitor", screenId: "EDI-MON-001",
          description: "Inside the integration console. Every envelope logs control numbers, parse state, created documents and errors. Failed envelopes land here for reprocessing; editing is restricted and audited.",
          children: (
            <div className="rounded-lg border p-3 text-sm">
              <p className="mb-1 font-medium">Control number continuity per partner (inbound)</p>
              <ul className="flex flex-wrap gap-x-6 gap-y-1">{s.edi.partners.map((p) => { const c = continuity(s.edi.envelopes, p.id); return <li key={p.id}>{vendorName(p.vendorId)}: {c.from == null ? "no inbound yet" : c.gaps.length ? <span className="font-semibold text-destructive">gap, {c.gaps.map((g) => String(g).padStart(6, "0")).join(", ")} missing</span> : `continuous ${String(c.from).padStart(6, "0")} to ${String(c.to).padStart(6, "0")}`}</li> })}</ul>
            </div>
          ),
        }}
        kpis={[{ label: "Envelopes logged", value: rows.length }, { label: "In the reprocessing console", value: failed.length, hint: "Failed or Rejected" }, { label: "997 overdue", value: rows.filter((e) => e.ackD === "997 overdue").length, hint: "Beyond the partner window" }, { label: "Continuity gaps", value: gaps.length, hint: "Partners with a missing number" }]}
        queues={[{ id: "all", label: "All envelopes", count: rows.length }, { id: "failed", label: "Reprocessing console", count: failed.length }, { id: "awaiting", label: "Awaiting 997", count: awaiting.length }, { id: "exceptions", label: "855 exceptions", count: exc.length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows: st.rows(shown), columns: cols, rowId: (e) => e.id, onRowClick: (e) => { setOpenId(e.id); setRaw(e.raw) }, activeId: openId ?? undefined, searchText: (e) => `${e.id} ${e.set} ${e.icn} ${e.docs.join(" ")}`, loading: st.loading, empty: { title: "No envelope in this queue", body: "Nothing matches the queue." } }}
        bulkActions={(sel, clear) => (
          <Button size="sm" variant="outline" onClick={() => { st.run(() => { let n = 0; for (const id of sel) { const e = rows.find((x) => x.id === id); if (e && (e.parse === "Failed" || e.parse === "Rejected") && reprocess("Bulk reprocess, unedited", id, e.raw) === null) n++ } clear(); return { ok: `${n} failed envelope(s) re-parsed unchanged` } }, RESTRICTED) }}>Reprocess selected unchanged</Button>
        )}
        panel={{
          open: !!row, onOpenChange: (o) => !o && setOpenId(null), title: row?.id ?? "Envelope", description: row ? `${row.dir} ${row.set} for ${vendorName(partnerOf(row)?.vendorId ?? "")}` : undefined,
          content: row && (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3"><KV k="Control number">{String(row.icn).padStart(6, "0")}</KV><KV k="Logged">{row.at}</KV><KV k="Parse state"><Tag family={parseFamily(row.parse)} label={row.parse} /></KV><KV k="997"><Tag family={ackFamily(row.ackD)} label={row.ackD} /></KV></dl>
              {row.exception && <p className="rounded-md border border-status-exception p-3 text-sm"><span className="font-semibold">Exception raised.</span> {row.exception} <Chip kind="oq" id="OQ-TS01" note="The PRD says deviations raise the exception state; where the exception worklist lives is not stated" /></p>}
              {row.errors.length > 0 && <ul className="list-disc pl-5 text-sm text-destructive">{row.errors.map((x) => <li key={x}>{x}</li>)}</ul>}
              <Section title="Created documents">{row.docs.length ? <p className="text-sm">{row.docs.join(", ")}</p> : <p className="text-sm text-muted-foreground">None.</p>}</Section>
              <Section title="Payload">
                <Textarea aria-label="Envelope payload" className="font-mono text-xs" rows={6} value={raw} readOnly={!(row.parse === "Failed" || row.parse === "Rejected")} onChange={(e) => setRaw(e.target.value)} />
                {(row.parse === "Failed" || row.parse === "Rejected") ? <p className="text-xs text-muted-foreground">Editing is restricted to IT roles and every edit is audited.</p> : <p className="text-xs text-muted-foreground">Only Failed or Rejected envelopes can be edited and reprocessed.</p>}
              </Section>
              {(row.parse === "Failed" || row.parse === "Rejected") && <Button disabled={st.locked} onClick={() => setDlg(true)}>Reprocess</Button>}
              <Section title="Audit trail"><ul className="space-y-1 text-sm">{row.audit.map((a, i) => <li key={i}><span className="tabular">{a.at}</span> {a.by}: {a.text}</li>)}</ul></Section>
            </div>
          ),
        }}
      />
      {row && <DialogShell open={dlg} onOpenChange={setDlg} title={`Reprocess ${row.id}`} requireReason reasonLabel="Reason for reprocessing (audited)" confirmLabel="Reprocess" consequence={`Re-parses ${row.id}${raw !== row.raw ? " with your edited payload" : " unchanged"}. The edit and your reason enter the audit trail. A parse that passes creates the documents; one that fails stays here.`} onConfirm={(reason) => reprocess(reason, row.id, raw)} />}
      <div className="mt-6"><RulesPanel rules={[["EDI-4", "Failed envelopes land in the reprocessing console with edit rights restricted and audited.", "Book IX §5.2"], ["EDI-5", "A duplicate invoice number per vendor rejects with a 997 level error.", "Book IX §5.1"], ["EDI-6", "A deviation on an 855 raises the exception state and never silently overwrites the order.", "Book IX §5.1"]]} /></div>
    </>
  )
}
