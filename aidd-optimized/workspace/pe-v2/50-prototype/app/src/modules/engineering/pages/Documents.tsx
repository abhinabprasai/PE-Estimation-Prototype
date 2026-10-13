// ENG-DOC-001/2 Controlled Documents (List + detail) [DOC:pp.64-65 §5; pp.257-258] (asserted).
// Register with type and security class filters. Detail with revision history, native and rendition
// files, title block metadata, linked objects and check-out state. Check out and in, submit for
// review with redlines, release (stamps the rendition), obsolete with a where-used warning.

import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { FileText, Lock } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Chip, EmptyState, ErrorAlert, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import type { DocRef } from "@/data/domain"
import { fmtDate } from "@/lib/format"
import { useCore, useRole, useSlice } from "@/store"
import { RenditionPreview, isUnreleased } from "../Rendition"
import { DetailState, NoPostings, RefLink, StatePreview, useAct, useActDialog, useScreenState } from "../components"
import { canSeeDoc, currentRev, docStatus, EAR_FLAG_USERS, hasEarFlag, releasedRev, userName, whereUsedDoc } from "../data/logic"
import * as act from "../data/actions"
import type { DocRecord, DocTypeCode, SecurityClass, TitleBlock } from "../data/types"
import { USERS } from "@/data/shared"

const TYPE_LABEL: Record<DocTypeCode, string> = { GA: "General arrangement", NP: "Nameplate", SCH: "Schematic and wiring", WND: "Winding diagram", COR: "Core and coil design", TNK: "Tank fabrication", TP: "Test plan", WI: "Work instruction", TC: "Terms and conditions", CERT: "Certificate template" }
const SECURITY: SecurityClass[] = ["Internal", "Customer-Shareable", "Restricted"]
const RULES: [string, string, string][] = [
  ["Lifecycle", "WIP, In Review, Released, Superseded, Obsolete; releasing a revision supersedes the prior released one", "DOC:p.64 §5.2"],
  ["Check-out", "One user holds the lock on a WIP revision; check-in changes nothing for consumers until release", "DOC:p.64 §5.2"],
  ["C-17", "A lock can be force-released only by the Engineering Manager, with a logged reason", "erd-sketch C-17"],
  ["C-18", "The floor and customers see only the current Released rendition, never a superseded one", "erd-sketch C-18"],
  ["Release", "Engineers author; the Engineering Manager releases, which stamps the rendition", "DOC:p.258"],
  ["Obsolete", "Obsolete shows a where-used warning and removes the document from every pick-up point", "DOC:p.258"],
  ["Security", "Restricted (export-controlled) documents are visible only to users with the EAR flag; each access is logged", "DOC:p.64 §5.1; Book III C §3"],
  ["Native files", "DWG, DXF, SLDDRW, SLDPRT, STEP, PDF, DOCX; max 500 MB; checksum stored; virus-scanned", "DOC:p.64 §5.1"],
  ["Title block", "Drawn, Checked and Approved By, Scale, Sheet x of y, Size A-E, Project/SO are entered at check-in", "DOC:p.64 §5.1"],
]

export function DocList() {
  const s = useSlice("engineering")
  const st = useScreenState("ENG-DOC-001")
  const nav = useNavigate()
  const runD = useActDialog()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ typeCode: "GA" as DocTypeCode, title: "", security: "Internal" as SecurityClass, er: "__none" })
  const core = useCore()
  const hidden = s.documents.filter((d) => !canSeeDoc(d, core.userId)).length
  const rows = st.empty ? [] : s.documents.filter((d) => canSeeDoc(d, core.userId))
  const columns: Column<DocRecord>[] = [
    { id: "id", header: "Document", value: (d) => d.id, sortable: true, mono: true },
    { id: "type", header: "Type", value: (d) => `${d.typeCode} ${TYPE_LABEL[d.typeCode]}`, filterable: true },
    { id: "title", header: "Title", value: (d) => d.title },
    { id: "rev", header: "Rev", value: (d) => currentRev(d).rev, mono: true },
    { id: "sec", header: "Security class", value: (d) => d.security, filterable: true, cell: (d) => (d.security === "Restricted" ? <Chip kind="block" note="Export-controlled: visible only to users with the EAR flag">Restricted</Chip> : d.security) },
    { id: "lock", header: "Checked out", value: (d) => currentRev(d).checkedOutBy ?? "", cell: (d) => { const r = currentRev(d); return r.checkedOutBy ? <span className="inline-flex items-center gap-1"><Lock className="size-3" aria-hidden="true" />{userName(r.checkedOutBy)}</span> : "" } },
    { id: "rel", header: "Released rev", value: (d) => releasedRev(d)?.rev ?? "", cell: (d) => releasedRev(d)?.rev ?? "None", mono: true },
    { id: "status", header: "Status", value: (d) => docStatus(d), filterable: true, sortable: true, cell: (d) => <StatusBadge kind="document" status={docStatus(d)} size="sm" /> },
  ]
  return (
    <>
      <ListPage<DocRecord>
        header={{
          title: "Controlled documents",
          screenId: "ENG-DOC-001/2",
          description: "Drawings, nameplates, test plans, work instructions and templates under revision control. The floor and customers consume only released renditions.",
          primary: <Button onClick={() => setOpen(true)}>New document</Button>,
          chips: (
            <>
              {hidden > 0 && <Chip kind="block" note="Restricted (export-controlled) documents are visible only to users with the EAR flag">{hidden} Restricted hidden: no EAR flag</Chip>}
              {hasEarFlag(core.userId) && <Chip kind="flag" note="You hold the EAR flag: Restricted documents are shown and each access is logged">EAR flag</Chip>}
              <Chip kind="design" note={`EAR flag holders in this prototype: ${EAR_FLAG_USERS.map(userName).join(", ")} (reading R-DOC-1)`}>EAR holders</Chip>
            </>
          ),
        }}
        table={{
          rows, columns, rowId: (d) => d.id, rowHref: (d) => `/engineering/documents/${d.id}`, searchText: (d) => `${d.id} ${d.title} ${d.typeCode}`,
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "id", dir: "asc" },
          empty: { title: "No controlled documents", body: "Create one, or check one in from the CAD vault." },
        }}
      />
      <RulesPanel rules={RULES} />
      <DialogShell open={open} onOpenChange={setOpen} title="New controlled document" confirmLabel="Create rev A"
        consequence="Creates rev A as WIP, checked out to you. Nothing is visible to the floor or customers until a revision is released."
        onConfirm={() => {
          let id = ""
          const er = s.requests.find((r) => r.id === f.er)
          const linked: DocRef[] = er ? [{ type: "salesOrder", id: er.soId }, { type: "material", id: er.itemId }] : []
          const e = runD((d, c) => void (id = act.createDoc(d, c, { typeCode: f.typeCode, title: f.title, security: f.security, linkedTo: linked, erId: er?.id })), "Document created")
          if (!e) nav(`/engineering/documents/${id}`)
          return e
        }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><Label>Type</Label>
            <Select value={f.typeCode} onValueChange={(v) => setF({ ...f, typeCode: v as DocTypeCode })}><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(TYPE_LABEL) as DocTypeCode[]).map((k) => <SelectItem key={k} value={k}>{k} {TYPE_LABEL[k]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-col gap-1"><Label>Security class</Label>
            <Select value={f.security} onValueChange={(v) => setF({ ...f, security: v as SecurityClass })}><SelectTrigger aria-label="Security class"><SelectValue /></SelectTrigger><SelectContent>{SECURITY.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1"><Label htmlFor="doc-title">Title</Label><Input id="doc-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="col-span-2 flex flex-col gap-1"><Label>Deliverable of engineering request (optional)</Label>
            <Select value={f.er} onValueChange={(v) => setF({ ...f, er: v })}><SelectTrigger aria-label="Engineering request"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">None</SelectItem>{s.requests.filter((r) => r.status !== "Closed").map((r) => <SelectItem key={r.id} value={r.id}>{r.id} · {r.title}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
      </DialogShell>
    </>
  )
}

export function DocDetail() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const core = useCore()
  const st = useScreenState("ENG-DOC-002")
  const d = s.documents.find((x) => x.id === id)
  return (
    <DetailState state={st} found={!!d} what={`Document ${id}`} back={{ to: "/engineering/documents", label: "Back to controlled documents" }}>
      {d && !canSeeDoc(d, core.userId) ? (
        <EmptyState title={`${d.id} is Restricted`}>Export-controlled documents are visible only to users with the EAR flag. {userName(core.userId)} does not hold it. Ask document control for access.</EmptyState>
      ) : d && <DocBody key={`${d.id}-${core.userId}`} d={d} />}
    </DetailState>
  )
}

const BLANK_TB = (tb: TitleBlock): TitleBlock => ({ ...tb })

function DocBody({ d }: { d: DocRecord }) {
  const s = useSlice("engineering")
  const core = useCore()
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const nav = useNavigate()
  const [dlg, setDlg] = useState<null | "checkin" | "submit" | "redline" | "release" | "obsolete" | "unlock">(null)
  const [files, setFiles] = useState<{ name: string; sizeMb: string }[]>([])
  const [tb, setTb] = useState<TitleBlock>(() => BLANK_TB(currentRev(d).titleBlock))
  const [note, setNote] = useState("")
  const logged = useRef(false)
  useEffect(() => {
    if (d.security !== "Restricted" || logged.current) return
    logged.current = true
    run((x, c) => act.logRestrictedAccess(x, c, d.id))
  }, [d.id, d.security, run])
  const r = currentRev(d)
  const rel = releasedRev(d)
  const status = docStatus(d)
  const mine = r.checkedOutBy === core.userId
  const isEM = role === "Engineering Manager"
  const emOnly = isEM ? undefined : "The Engineering Manager does this (switch Acting as)"
  const used = whereUsedDoc(s, d.id)
  const terminal = status === "Obsolete"
  const [revSel, setRevSel] = useState<string | undefined>()
  const shown = d.revisions.find((v) => v.rev === revSel) ?? r

  let primary = null
  if (status === "WIP" && !r.checkedOutBy) primary = <Button onClick={() => run((x, c) => act.checkOut(x, c, d.id), `Rev ${r.rev} checked out`)}>Check out</Button>
  else if (status === "WIP" && mine) primary = <Button onClick={() => { setFiles((r.nativeFiles?.length ? r.nativeFiles.map((f) => ({ name: f.name, sizeMb: String(f.sizeMb) })) : r.native.map((n) => ({ name: n, sizeMb: "" }))).concat(r.native.length ? [] : [{ name: "", sizeMb: "" }])); setTb(BLANK_TB(r.titleBlock)); setDlg("checkin") }}>Check in</Button>
  else if (status === "WIP" && r.checkedOutBy) primary = <Button disabled={!isEM} title={emOnly} onClick={() => setDlg("unlock")}>Force-release lock</Button>
  else if (status === "In Review") primary = <Button disabled={!isEM} title={emOnly} onClick={() => setDlg("release")}>Release and stamp</Button>
  else if (status === "Released") primary = <Button onClick={() => run((x, c) => act.newDocRev(x, c, d.id), "New revision started")}>Start new revision</Button>

  return (
    <>
      <DetailPage
        header={{
          title: `${d.id} rev ${r.rev}`,
          screenId: "ENG-DOC-001/2",
          crumbs: [{ label: "Controlled documents", to: "/engineering/documents" }, { label: d.id }],
          description: `${TYPE_LABEL[d.typeCode]}: ${d.title}. Security class ${d.security}.`,
          chips: (
            <>
              {r.checkedOutBy && <Chip kind="hold" note={`Since ${fmtDate(r.checkedOutSince)}`}>Checked out by {userName(r.checkedOutBy)}</Chip>}
              {d.security === "Restricted" && <Chip kind="block" note="Export-controlled: visible only to users with the EAR flag; this view is logged">Restricted</Chip>}
              {isUnreleased(r) && <Chip kind="block" note="Every unreleased rendition (WIP, In Review) is watermarked NOT FOR MANUFACTURE (feature list ENG-DOC-002)">NOT FOR MANUFACTURE</Chip>}
              {rel && rel !== r && <Chip kind="change" note="Consumers keep seeing the released revision until the new one releases">Rev {rel.rev} in use</Chip>}
            </>
          ),
          primary,
          actions: !terminal && (
            <>
              {status === "WIP" && !r.checkedOutBy && <Button variant="outline" onClick={() => setDlg("submit")}>Submit for review</Button>}
              {status === "In Review" && <Button variant="outline" onClick={() => setDlg("redline")}>Add redline</Button>}
              {(status === "Released" || status === "Superseded") && <Button variant="outline" disabled={!isEM} title={emOnly} onClick={() => setDlg("obsolete")}>Obsolete</Button>}
              {rel && d.security !== "Restricted" && <Button variant="ghost" onClick={() => nav(`/engineering/transmittals/new?doc=${d.id}${d.engineeringRequestId ? `&er=${d.engineeringRequestId}` : ""}`)}>Send on transmittal</Button>}
              {rel && <Button variant="ghost" onClick={() => nav(`/engineering/change-requests/new?affected=document:${d.id}`)}>Propose change</Button>}
            </>
          ),
        }}
        status={{ kind: "document", value: status }}
        doc={{ type: "document", id: d.id }}
        summary={
          <>
            <KV k="Current revision">{r.rev} ({r.status})</KV>
            <KV k="Released rendition">{rel ? <span className="inline-flex items-center gap-1"><FileText className="size-4" aria-hidden="true" />{rel.rendition} · {rel.stamp}</span> : "None released"}</KV>
            <KV k="Engineering request">{d.engineeringRequestId ? <RefLink r={{ type: "engineeringRequest", id: d.engineeringRequestId }} /> : "None"}</KV>
            <KV k="Created">{fmtDate(d.createdOn)}</KV>
          </>
        }
        tabs={[
          {
            id: "rendition", label: "Rendition",
            content: (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="rend-rev">Revision shown</Label>
                  <Select value={revSel ?? r.rev} onValueChange={setRevSel}>
                    <SelectTrigger id="rend-rev" size="sm" className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{[...d.revisions].reverse().map((v) => <SelectItem key={v.rev} value={v.rev}>Rev {v.rev} ({v.status})</SelectItem>)}</SelectContent>
                  </Select>
                  {r.status === "In Review" && <Button asChild variant="outline" size="sm"><Link to={`/engineering/redline-review?doc=${d.id}`}>Open redline review</Link></Button>}
                </div>
                <RenditionPreview doc={d} rev={shown} markups={shown.redlines} className="max-w-3xl" />
              </div>
            ),
          },
          {
            id: "revs", label: "Revisions", count: d.revisions.length,
            content: (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Rev</TableHead><TableHead>Status</TableHead><TableHead>Native files</TableHead><TableHead>Rendition</TableHead><TableHead>Stamp</TableHead><TableHead>Checksum</TableHead><TableHead>Released</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[...d.revisions].reverse().map((v) => (
                      <TableRow key={v.rev} className="h-8 text-[13px]">
                        <TableCell className="font-mono">{v.rev}</TableCell>
                        <TableCell><StatusBadge kind="document" status={v.status} size="sm" /></TableCell>
                        <TableCell className="font-mono">{v.nativeFiles?.length ? v.nativeFiles.map((f) => `${f.name} (${f.sizeMb} MB, scan ${f.scan})`).join(", ") : v.native.join(", ") || "None yet"}</TableCell>
                        <TableCell className="font-mono">{v.rendition ?? "Not generated"}</TableCell>
                        <TableCell>{v.stamp ?? ""}</TableCell>
                        <TableCell className="font-mono text-xs">{v.checksum}</TableCell>
                        <TableCell>{v.releasedOn ? fmtDate(v.releasedOn) : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ),
          },
          {
            id: "tb", label: "Title block",
            content: (
              <dl className="grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
                <KV k="Drawn by">{userName(r.titleBlock.drawnBy)}</KV>
                <KV k="Checked by">{userName(r.titleBlock.checkedBy)}</KV>
                <KV k="Approved by">{userName(r.titleBlock.approvedBy)}</KV>
                <KV k="Scale">{r.titleBlock.scale}</KV>
                <KV k="Sheet">{r.titleBlock.sheet}</KV>
                <KV k="Size">{r.titleBlock.size}</KV>
                <KV k="Project">{r.titleBlock.project ?? "None"}</KV>
              </dl>
            ),
          },
          {
            id: "redlines", label: "Redlines", count: r.redlines.length,
            content: r.redlines.length ? <ul className="flex flex-col gap-2 text-sm">{r.redlines.map((x, i) => <li key={i} className="rounded-md border px-4 py-2"><span className="text-muted-foreground">{userName(x.by)}, {fmtDate(x.on)}:</span> {x.text}</li>)}</ul> : <p className="text-sm text-muted-foreground">No redlines on rev {r.rev}.</p>,
          },
          {
            id: "links", label: "Linked objects", count: d.linkedTo.length + used.length,
            content: (
              <div className="flex flex-col gap-3 text-sm">
                <div><h3 className="font-semibold">Linked to</h3>{d.linkedTo.length ? d.linkedTo.map((l) => <span key={l.id} className="mr-3 inline-block"><RefLink r={l} /></span>) : <p className="text-muted-foreground">Nothing linked.</p>}</div>
                <div><h3 className="font-semibold">Where used</h3>{used.length ? used.map((l) => <span key={l.type + l.id} className="mr-3 inline-block"><RefLink r={l} /></span>) : <p className="text-muted-foreground">Not referenced by any EBOM line, transmittal or request.</p>}</div>
              </div>
            ),
          },
          { id: "activity", label: "Activity", count: d.activity.length, content: <ul className="flex flex-col gap-1 text-sm">{[...d.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}</ul> },
        ]}
      />
      <NoPostings />
      <RulesPanel rules={RULES} />
      <DialogShell open={dlg === "checkin"} onOpenChange={(o) => !o && setDlg(null)} title={`Check in ${d.id} rev ${r.rev}`} confirmLabel="Check in"
        consequence="Stores the working files and releases your lock. Consumers see nothing new until the revision is released."
        onConfirm={() => runD((x, c) => act.checkIn(x, c, d.id, files.map((f) => ({ name: f.name, sizeMb: Number(f.sizeMb) })), tb), "Checked in: virus scan clean")}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Native files ({act.NATIVE_TYPES.join(", ")}; max {act.MAX_FILE_MB} MB each; virus-scanned)</legend>
          {files.map((f, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1"><Label htmlFor={`ci-f-${i}`}>File name</Label><Input id={`ci-f-${i}`} value={f.name} placeholder="PE-20MVA-GA.SLDDRW" onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></div>
              <div className="flex w-28 flex-col gap-1"><Label htmlFor={`ci-s-${i}`}>Size (MB)</Label><Input id={`ci-s-${i}`} type="number" min={0} value={f.sizeMb} onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, sizeMb: e.target.value } : x)))} /></div>
              <Button variant="ghost" size="sm" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <div><Button variant="outline" size="sm" onClick={() => setFiles([...files, { name: "", sizeMb: "" }])}>Add file</Button></div>
          <p className="text-xs text-muted-foreground">Virus scan is simulated <Chip kind="design" note="A file name containing EICAR is treated as the test signature and refused (reading R-DOC-2)">scan</Chip></p>
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-1 text-sm font-medium">Title block (entered at check-in)</legend>
          <TbUser label="Drawn by" value={tb.drawnBy} onChange={(v) => setTb({ ...tb, drawnBy: v as TitleBlock["drawnBy"] })} />
          <TbUser label="Checked by" value={tb.checkedBy} optional onChange={(v) => setTb({ ...tb, checkedBy: (v || undefined) as TitleBlock["checkedBy"] })} />
          <TbUser label="Approved by" value={tb.approvedBy} optional onChange={(v) => setTb({ ...tb, approvedBy: (v || undefined) as TitleBlock["approvedBy"] })} />
          <div className="flex flex-col gap-1"><Label htmlFor="tb-scale">Scale</Label><Input id="tb-scale" value={tb.scale} onChange={(e) => setTb({ ...tb, scale: e.target.value })} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="tb-sheet">Sheet (x of y)</Label><Input id="tb-sheet" value={tb.sheet} onChange={(e) => setTb({ ...tb, sheet: e.target.value })} /></div>
          <div className="flex flex-col gap-1"><Label>Drawing size</Label>
            <Select value={tb.size} onValueChange={(v) => setTb({ ...tb, size: v as TitleBlock["size"] })}><SelectTrigger aria-label="Drawing size"><SelectValue /></SelectTrigger><SelectContent>{(["A", "B", "C", "D", "E"] as const).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1"><Label htmlFor="tb-proj">Project / SO reference</Label><Input id="tb-proj" value={tb.project ?? ""} placeholder="SO-2026-00377" onChange={(e) => setTb({ ...tb, project: e.target.value || undefined })} /></div>
        </fieldset>
      </DialogShell>
      <DialogShell open={dlg === "submit"} onOpenChange={(o) => !o && setDlg(null)} title={`Submit rev ${r.rev} for review`} confirmLabel="Submit for review"
        consequence={`Rev ${r.rev} moves to In Review and a PDF rendition is generated for redlining.`} onConfirm={() => runD((x, c) => act.submitDoc(x, c, d.id, note), "Submitted for review")}>
        <Label htmlFor="sub-note">Note to reviewers (optional, kept as the first redline)</Label>
        <Textarea id="sub-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </DialogShell>
      <DialogShell open={dlg === "redline"} onOpenChange={(o) => !o && setDlg(null)} title="Add redline" confirmLabel="Add redline" onConfirm={() => runD((x, c) => act.redline(x, c, d.id, note), "Redline added")}>
        <Textarea aria-label="Redline comment" value={note} onChange={(e) => setNote(e.target.value)} />
      </DialogShell>
      <DialogShell open={dlg === "release"} onOpenChange={(o) => !o && setDlg(null)} title={`Release ${d.id} rev ${r.rev}`} confirmLabel="Release and stamp"
        consequence={`Stamps the rendition "RELEASED Rev ${r.rev}"${rel ? ` and moves rev ${rel.rev} to Superseded` : ""}. The floor and customers see rev ${r.rev} from now on.`} onConfirm={() => runD((x, c) => act.releaseDoc(x, c, d.id), `Rev ${r.rev} released`)} />
      <DialogShell open={dlg === "obsolete"} onOpenChange={(o) => !o && setDlg(null)} title={`Obsolete ${d.id}`} confirmLabel="Obsolete" destructive requireReason reasonLabel="Reason (required)"
        consequence={`Stamps ${d.id} OBSOLETE and removes it from every pick-up point. Terminal: it cannot be released again.`} onConfirm={(reason) => runD((x, c) => act.obsoleteDoc(x, c, d.id, reason), `${d.id} obsoleted`)}>
        {used.length > 0 && <ErrorAlert title={`Where used: ${used.length} object${used.length > 1 ? "s" : ""}`}>{used.map((u) => u.id).join(", ")} still reference this document. Revise them through an ECO.</ErrorAlert>}
      </DialogShell>
      <DialogShell open={dlg === "unlock"} onOpenChange={(o) => !o && setDlg(null)} title={`Force-release the lock on ${d.id}`} confirmLabel="Force-release" destructive requireReason reasonLabel="Reason (required, logged)"
        consequence={`Releases ${userName(r.checkedOutBy)}'s lock on rev ${r.rev}; their unsaved working copy is not checked in (C-17).`} onConfirm={(reason) => runD((x, c) => act.forceUnlock(x, c, d.id, reason), "Lock released")} />
    </>
  )
}

const ENG_USERS = USERS.filter((u) => u.roles.some((r) => r === "Engineer" || r === "Engineering Manager" || r === "Document control" || r === "Manufacturing engineer"))
function TbUser({ label, value, onChange, optional }: { label: string; value?: string; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
        <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value="__none">Not yet</SelectItem>}
          {ENG_USERS.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
