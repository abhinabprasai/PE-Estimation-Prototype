// FX-DOC-REDLINE PDF redline review layer (Detail, design value) [DOC:p.64 §5.2 In Review]. While a
// revision is In Review the reviewers mark up its PDF rendition: pins on the sheet (click, or pick a
// zone for keyboard use), a comment each, resolve and reopen, and a reviewer approval. Release stays
// the Engineering Manager's action on the document. Released and unreleased renditions differ: an
// unreleased rendition carries NOT FOR MANUFACTURE. Markups are read-only once the revision leaves review.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Check, MapPin, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Chip, EmptyState, KV, RulesPanel, StatusBadge } from "@/components/patterns"
import { DetailPage } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { useCore, useRole, useSlice } from "@/store"
import { NoPostings, RefLink, useAct } from "../components"
import { RenditionPreview, ZONE_COLS, ZONE_ROWS, zoneCentre, zoneOf } from "../Rendition"
import { ScreenFrame, StatePreviewAll, useStates } from "../states"
import { currentRev, docStatus, userName } from "../data/logic"
import * as act from "../data/actions"

export function RedlineReview() {
  const s = useSlice("engineering")
  const st = useStates("FX-DOC-REDLINE")
  const run = useAct()
  const [role] = useRole()
  const core = useCore()
  const [params, setParams] = useSearchParams()
  const reviewable = s.documents.filter((d) => docStatus(d) === "In Review")
  const docId = params.get("doc") ?? reviewable[0]?.id ?? s.documents[0]?.id
  const d = s.documents.find((x) => x.id === docId)
  const [selected, setSelected] = useState<string | undefined>()
  const [placing, setPlacing] = useState(false)
  const [zone, setZone] = useState("C2")
  const [text, setText] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const empty = st.empty || !d
  const r = d ? currentRev(d) : undefined
  const open = !!r && r.status === "In Review" && !st.readonly && !st.offline
  const marks = r?.redlines ?? []
  const unresolved = marks.filter((m) => !m.resolved).length
  const mine = r?.reviewerApprovals?.find((a) => a.by === core.userId)
  const place = (x: number, y: number, comment: string) => {
    if (!d) return
    if (!comment.trim()) {
      setFormError("Enter the markup comment before placing the pin.")
      return
    }
    const res = run((a, c) => act.addMarkup(a, c, d.id, { x, y, page: 1, text: comment }), "Markup added")
    if (res.ok) {
      setText("")
      setPlacing(false)
      setFormError(null)
    } else setFormError(res.error)
  }
  const pick = (id: string) => {
    params.set("doc", id)
    setParams(params, { replace: true })
    setSelected(undefined)
  }
  return (
    <ScreenFrame st={st} what="Redline review" who="Design engineers, the Engineering Manager and named reviewers mark up renditions; customers never see a markup" source="DOC:p.67 §7"
      text={{
        conflict: "Another reviewer added or resolved a markup while you were typing. Reload the markup list; your comment stays in the box.",
        offline: "You are offline: markups already loaded stay readable. Adding, resolving and approving are disabled so nothing is lost silently.",
        readonly: "Read-only: this revision is not In Review, so its markups are frozen with the revision.",
        validation: "A markup needs a comment and a position on the sheet; the message names the field.",
      }}>
      <DetailPage
        header={{
          title: "PDF redline review",
          screenId: "FX-DOC-REDLINE",
          crumbs: [{ label: "Controlled documents", to: "/engineering/documents" }, { label: "Redline review" }],
          description: "Reviewers mark up the PDF rendition of a revision that is In Review. Release stays the Engineering Manager's action on the document.",
          actions: <StatePreviewAll st={st} />,
          primary: d && r ? (r.status === "In Review" ? <Button onClick={() => setPlacing((p) => !p)} disabled={!open}>{placing ? "Click the sheet to place" : "Add markup"}</Button> : <Button asChild><Link to={`/engineering/documents/${d.id}`}>Open {d.id}</Link></Button>) : undefined,
        }}
        status={d && r ? { kind: "document", value: r.status } : undefined}
        doc={d ? { type: "document", id: d.id } : undefined}
        summary={
          d && r && !empty ? (
            <>
              <KV k="Document">
                <Select value={d.id} onValueChange={pick}>
                  <SelectTrigger size="sm" className="w-64" aria-label="Document"><SelectValue /></SelectTrigger>
                  <SelectContent>{s.documents.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} · {docStatus(x)}</SelectItem>)}</SelectContent>
                </Select>
              </KV>
              <KV k="Revision">{r.rev} <StatusBadge kind="document" status={r.status} size="sm" /></KV>
              <KV k="Open markups">{unresolved} of {marks.length}</KV>
              <KV k="Reviewer approvals">{r.reviewerApprovals?.length ?? 0}</KV>
              <KV k="Record"><RefLink r={{ type: "document", id: d.id }} /></KV>
            </>
          ) : undefined
        }
        tabs={[
          {
            id: "sheet", label: "Sheet and markups", count: marks.length,
            content:
              empty || !d || !r ? (
                <EmptyState title="Nothing in review">No document is In Review. Submit a WIP revision for review from its document page and it appears here.</EmptyState>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                  <div className="flex flex-col gap-3">
                    {r.status !== "In Review" && <p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">Rev {r.rev} is {r.status}: markups are read-only{r.status === "Released" ? " and the rendition carries the release stamp" : ""}.</p>}
                    <RenditionPreview doc={d} rev={r} markups={marks} selected={selected} onSelect={setSelected} placing={placing && open} onPlace={(x, y) => place(x, y, text)} />
                    {placing && open && <p role="status" className="text-sm">Click the sheet to drop the pin for: <span className="font-medium">{text || "(enter the comment first)"}</span></p>}
                  </div>
                  <div className="flex flex-col gap-4">
                    <fieldset className="flex flex-col gap-2 rounded-lg border p-4" disabled={!open}>
                      <legend className="px-1 text-sm font-medium">New markup</legend>
                      <Label htmlFor="mk-text">Comment</Label>
                      <Textarea id="mk-text" value={text} aria-invalid={!!formError} onChange={(e) => { setText(e.target.value); setFormError(null) }} placeholder="What must change on the drawing?" />
                      <div className="flex items-end gap-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="mk-zone">Sheet zone (keyboard)</Label>
                          <Select value={zone} onValueChange={setZone}>
                            <SelectTrigger id="mk-zone" size="sm" className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>{ZONE_ROWS.flatMap((row) => ZONE_COLS.map((c) => <SelectItem key={c + row} value={c + row}>{c}{row}</SelectItem>))}</SelectContent>
                          </Select>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { const p = zoneCentre(zone); place(Math.round(p.x), Math.round(p.y), text) }}><MapPin aria-hidden="true" />Place in zone</Button>
                      </div>
                      {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
                      {!open && <p className="text-xs text-muted-foreground">{r.status !== "In Review" ? `Rev ${r.rev} is ${r.status}.` : st.offline ? "Offline." : "Read-only."}</p>}
                    </fieldset>
                    <ul className="flex flex-col gap-2" aria-label="Markups">
                      {marks.length === 0 && <li className="text-sm text-muted-foreground">No markups on rev {r.rev} yet.</li>}
                      {marks.map((m, i) => (
                        <li key={m.id ?? i} className={`rounded-md border px-3 py-2 text-sm ${selected === m.id ? "ring-2 ring-ring" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => m.id && setSelected(m.id)}>
                              {i + 1}. {m.x != null && m.y != null ? `Zone ${zoneOf(m.x, m.y)}` : "No pin"}
                            </button>
                            <span className="text-xs">{m.resolved ? <Chip kind="design" note="Resolved by the author or a reviewer">Resolved</Chip> : "Open"}</span>
                          </div>
                          <p className="text-muted-foreground">{userName(m.by)}, {fmtDate(m.on)}</p>
                          <p>{m.text}</p>
                          {m.id && (
                            <Button variant="ghost" size="sm" disabled={!open} onClick={() => run((a, c) => act.resolveMarkup(a, c, d.id, m.id!, !m.resolved), m.resolved ? "Markup reopened" : "Markup resolved")}>
                              {m.resolved ? <><RotateCcw aria-hidden="true" />Reopen</> : <><Check aria-hidden="true" />Resolve</>}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ),
          },
          {
            id: "approve", label: "Reviewer approvals", count: r?.reviewerApprovals?.length ?? 0,
            content:
              !d || !r || empty ? <EmptyState title="Nothing in review" /> : (
                <div className="flex max-w-3xl flex-col gap-3">
                  <ul className="flex flex-col gap-1 text-sm">
                    {(r.reviewerApprovals ?? []).map((a) => <li key={a.by}>{userName(a.by)} approved on {fmtDate(a.on)}{a.note ? `: ${a.note}` : ""}</li>)}
                    {!(r.reviewerApprovals ?? []).length && <li className="text-muted-foreground">No reviewer has approved rev {r.rev} yet.</li>}
                  </ul>
                  <Label htmlFor="rv-note">Approval note (optional)</Label>
                  <Textarea id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button disabled={!open || unresolved > 0} title={unresolved ? `${unresolved} markup${unresolved === 1 ? "" : "s"} still open` : undefined} onClick={() => run((a, c) => act.reviewerApprove(a, c, d.id, note), "Reviewer approval recorded")}>
                      {mine ? "Update my approval" : "Approve as reviewer"}
                    </Button>
                    {unresolved > 0 && <span className="text-sm text-muted-foreground">Resolve the {unresolved} open markup{unresolved === 1 ? "" : "s"} first.</span>}
                    <Button variant="outline" asChild><Link to={`/engineering/documents/${d.id}`}>{role === "Engineering Manager" ? "Go to release" : "Open document (release is the Engineering Manager's)"}</Link></Button>
                  </div>
                </div>
              ),
          },
        ]}
      />
      <NoPostings />
      <RulesPanel rules={[
        ["In Review", "Reviewers mark up the PDF rendition; release is the Engineering Manager's action and stamps RELEASED Rev X + date", "DOC:p.64 §5.2"],
        ["NOT FOR MANUFACTURE", "Every unreleased rendition (WIP, In Review) is watermarked; the floor sees only the current Released rendition (C-18)", "feature list ENG-DOC-002"],
        ["Pins and zones", "Markup position (pin on the sheet, drawing zone A-H by 1-4) is a design value: the PRD names the redline layer, not its geometry", "design value"],
      ]} />
    </ScreenFrame>
  )
}
