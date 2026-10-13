// Pages at /engineering/dialogs/...: each feature-list dialog drawn inline in the state chosen with
// "State preview", plus the same dialog as a modal (the way the editor and the registers open it).
// Dialog entries are built twice by design (APP-ARCHITECTURE.md section 2): component + page.

import { useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, RulesPanel } from "@/components/patterns"
import { PageHeader } from "@/components/templates"
import { useSlice } from "@/store"
import { CopyFromDialog, EbomReleaseDialog, MassReplaceDialog } from "../dialogs"
import { ScreenFrame, StatePreviewAll, useStates, type States } from "../states"
import { NoPostings } from "../components"

const MATRIX: [state: string, what: string][] = [
  ["Normal", "The dialog with live data from the engineering store; the primary works."],
  ["Empty", "Nothing to act on: the dialog says what to do first."],
  ["Loading", "A skeleton while the first visit loads (600 ms)."],
  ["Validation", "The rule that blocks the primary is named, with the field."],
  ["Authorization", "The designed denied experience: who may do this and how to continue."],
  ["Conflict", "Another user changed a record while the dialog was open; confirm refuses and says reload."],
  ["Offline", "The primary is disabled and says it needs the server; nothing is queued silently."],
  ["Degraded", "The page keeps working on the last data; a banner names what is delayed."],
  ["Read-only", "The primary is disabled: the record is released or the view is read-only."],
]

function DialogPage({ screenId, title, description, usedFrom, rules, st, children }: { screenId: string; title: string; description: string; usedFrom: [label: string, to: string][]; rules: [string, string, string][]; st: States; children: (view: ReturnType<typeof viewOf>) => ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} screenId={screenId} crumbs={[{ label: "Dialogs" }, { label: title }]} description={description} actions={<StatePreviewAll st={st} />} chips={<Chip kind="design" note="Dialog entries are a design-value route: the dialog is a component opened from the screens below and a page that shows it in each state">Dialog page</Chip>} />
      <ScreenFrame st={st} what={title} who="Engineers, the Engineering Manager and document control prepare and release EBOMs; production, purchasing and quality read released objects" source="DOC:p.67 §7" handleLoading banners={false}>
        {children(viewOf(st))}
      </ScreenFrame>
      <section aria-label="Opened from" className="text-sm">
        <h2 className="font-semibold">Opened from</h2>
        <ul className="list-disc pl-5">{usedFrom.map(([l, to]) => <li key={l}><Link className="text-link underline" to={to}>{l}</Link></li>)}</ul>
      </section>
      <section aria-label="State matrix" className="max-w-3xl overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-table-head"><TableRow><TableHead>State</TableHead><TableHead>What the dialog shows</TableHead></TableRow></TableHeader>
          <TableBody>{MATRIX.map(([a, b]) => <TableRow key={a} className="h-8 text-[13px]"><TableCell className="font-medium">{a}</TableCell><TableCell>{b}</TableCell></TableRow>)}</TableBody>
        </Table>
      </section>
      <NoPostings />
      <RulesPanel rules={rules} />
    </div>
  )
}
const viewOf = (st: States) => ({ offline: st.offline, degraded: st.degraded, readonly: st.readonly, conflict: st.conflict, validation: st.validation, empty: st.empty })

export function EbomReleasePage() {
  const s = useSlice("engineering")
  const st = useStates("FX-ENG-RELEASE")
  const [params, setParams] = useSearchParams()
  const reviewable = s.eboms.filter((e) => e.status === "In Review" || e.status === "Draft" || e.status === "Released")
  const id = params.get("ebom") ?? s.eboms.find((e) => e.status === "In Review")?.id ?? reviewable[0]?.id ?? ""
  const [open, setOpen] = useState(false)
  return (
    <DialogPage
      screenId="FX-ENG-RELEASE" title="EBOM review and release package" st={st}
      description="What the Engineering Manager sees before approving an EBOM release: every gate, the package contents, the change evidence and the approval route."
      usedFrom={[["EBOM editor, header button Release Package", "/engineering/boms"], ["Engineering workspace, Awaiting my approval", "/engineering"]]}
      rules={[
        ["Release", "Engineering Manager approves; with customer approval, evidence of customer drawing approval attached; an engineer cannot approve their own release", "DOC:p.61 §3.4; p.177"],
        ["V-ENG-03", "Release is blocked while any placeholder remains Draft", "DOC:p.60 §3.2"],
        ["V-ENG-04 / 06", "Made parts need a drawing reference and a Released EBOM", "DOC:p.60-61 §3.2"],
        ["C-14", "Released EBOM is immutable; any change needs an ECO", "DOC:p.61 §3.4"],
      ]}
    >
      {(view) => (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span>EBOM</span>
            <Select value={id} onValueChange={(v) => { params.set("ebom", v); setParams(params, { replace: true }) }}>
              <SelectTrigger size="sm" className="w-96" aria-label="EBOM to review"><SelectValue /></SelectTrigger>
              <SelectContent>{reviewable.map((e) => <SelectItem key={e.id} value={e.id}>{e.id} rev {e.rev} · {e.status} · {e.parentItemId}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Open as modal</Button>
          </div>
          <EbomReleaseDialog embedded ebomId={id} view={view} />
          <EbomReleaseDialog open={open} onOpenChange={setOpen} ebomId={id} view={view} />
        </>
      )}
    </DialogPage>
  )
}

export function CopyFromPage() {
  const st = useStates("FX-ENG-COPYFROM")
  const [open, setOpen] = useState(false)
  const [params] = useSearchParams()
  return (
    <DialogPage
      screenId="FX-ENG-COPYFROM" title="EBOM Copy From and base-design picker" st={st}
      description="Start from a similar released design: copy the whole EBOM into a new Draft, or a subtree into an existing Draft. The same picker chooses the base design of a Variant of Existing request."
      usedFrom={[["EBOM register, Copy From", "/engineering/boms"], ["EBOM editor, Copy From", "/engineering/boms"], ["Engineering request, Set design type", "/engineering/requests"]]}
      rules={[
        ["Copy From", "Copy an entire released EBOM (or subtree) of a similar design, then edit deltas; provenance stored (Base Design) for design-reuse reporting", "DOC:p.61 §3.3"],
        ["Variant", "Variant of Existing: select base design; copies its EBOM and drawing set as the starting point", "DOC:p.59 §2"],
        ["C-16", "Obsolete EBOMs cannot be used in new MBOMs or orders", "DOC:p.61 §3.4"],
      ]}
    >
      {(view) => (
        <>
          <div><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Open as modal</Button></div>
          <CopyFromDialog embedded view={view} target={params.get("target") ?? undefined} />
          <CopyFromDialog open={open} onOpenChange={setOpen} view={view} target={params.get("target") ?? undefined} />
        </>
      )}
    </DialogPage>
  )
}

export function MassReplacePage() {
  const st = useStates("FX-ENG-MASSREPLACE")
  const [open, setOpen] = useState(false)
  return (
    <DialogPage
      screenId="FX-ENG-MASSREPLACE" title="Mass replace component" st={st}
      description="Replace component A with B across selected BOMs. It always creates an ECO automatically: it is never a silent save."
      usedFrom={[["EBOM register, Mass update", "/engineering/boms"], ["Where-Used explorer", "/engineering/where-used"]]}
      rules={[
        ["C-15", "EBOM mass replace always creates an ECO; it is never a silent save", "DOC:p.61 §3.3"],
        ["C-16", "An Obsolete component cannot be the replacement", "DOC:p.61 §3.4"],
        ["UoM", "UoM conversion must exist between the old and new component", "DOC:p.61 §3.3"],
      ]}
    >
      {(view) => (
        <>
          <div><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Open as modal</Button></div>
          <MassReplaceDialog embedded view={view} />
          <MassReplaceDialog open={open} onOpenChange={setOpen} view={view} />
        </>
      )}
    </DialogPage>
  )
}
