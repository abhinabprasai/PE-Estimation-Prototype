// ENG-BOM-002 EBOM Editor (Detail, three panes) [DOC:pp.60-61 §3; p.255] (asserted).
// Left: structure tree with level badges and per-node item status. Centre: keyboard-first line grid
// for the selected node (Enter = next row, Tab = next cell). Right: context panel with item card,
// drawing thumbnail, where-used and alternates. Header: Validate, Compare, Import, Copy From, Release.

import { useMemo, useState, type KeyboardEvent } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { FilePlus2, ListChecks } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ApprovalButton, Chip, EmptyState, ErrorAlert, KV, RulesPanel, StatusBadge } from "@/components/patterns"
import { DetailPage, DialogShell } from "@/components/templates"
import { familyOf, type MaterialId } from "@/data/domain"
import { VENDORS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { DetailState, Item, NoPostings, RefLink, useAct, useActDialog, useScreenState } from "../components"
import { docStatus, itemInfo, kitMemberships, kitStandard, kitsForDesign, levelLabels, pickableMaterials, revisionPool, userName, validateEbom } from "../data/logic"
import { RevisionCompare } from "../RevisionCompare"
import { CopyFromDialog, EbomReleaseDialog, MassReplaceDialog } from "../dialogs"
import { ROUTINGS } from "../data/reference"
import * as act from "../data/actions"
import type { EbomLineX, EbomRecord } from "../data/types"
import type { EngineeringState } from "../data/slice"

export function EbomEditor() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useScreenState("ENG-BOM-002")
  const e = s.eboms.find((x) => x.id === id)
  return (
    <DetailState state={st} found={!!e} what={`EBOM ${id}`} back={{ to: "/engineering/boms", label: "Back to EBOMs" }}>
      {e && <Editor key={e.id} e={e} />}
    </DetailState>
  )
}

const DOT: Record<string, string> = { draft: "bg-status-draft", pending: "bg-status-pending", active: "bg-status-active", blocked: "bg-status-blocked", done: "bg-status-done", cancelled: "bg-status-cancelled", exception: "bg-status-exception" }

function Editor({ e }: { e: EbomRecord }) {
  const s = useSlice("engineering")
  const nav = useNavigate()
  const run = useAct()
  const runD = useActDialog()
  const [node, setNode] = useState<number | undefined>(undefined)
  const [line, setLine] = useState<number | undefined>(e.lines[0]?.no)
  const [showVal, setShowVal] = useState(false)
  const [dlg, setDlg] = useState<null | "placeholder" | "submit" | "comment" | "package" | "copy" | "mass">(null)
  const editable = e.status === "Draft"
  const labels = useMemo(() => levelLabels(e.lines), [e.lines])
  const validation = useMemo(() => validateEbom(s, e), [s, e])
  const errors = validation.filter((v) => v.severity === "error")
  const er = s.requests.find((r) => r.id === e.engineeringRequestId)
  const evidenceMissing = !!er && er.customerApprovalRequired && !er.customerApprovalEvidence
  const visible = e.lines.filter((l) => l.parent === node)
  const sel = e.lines.find((l) => l.no === line)
  const ops = (ROUTINGS.find((r) => r.materialId === e.parentItemId && r.status === "Released") ?? ROUTINGS[0]).ops
  const placeholders = e.lines.filter((l) => itemInfo(s, l.componentId).placeholder)
  const mboms = s.mboms.filter((m) => m.ebomId === e.id)
  const kits = useMemo(() => kitsForDesign(s, e), [s, e])

  let primary = null
  if (e.status === "Draft") primary = <Button onClick={() => setDlg("submit")}>Submit for review</Button>
  else if (e.status === "In Review")
    primary = (
      <ApprovalButton kind="EBOM release" subject={{ type: "ebom", id: e.id }} title={`${e.id} rev ${e.rev}: ${e.title}`} label="Release package" variant="default"
        disabled={evidenceMissing} disabledReason={`Customer drawing approval evidence is missing on ${er?.id}`} />
    )
  else if (e.status === "Released") primary = <Button onClick={() => nav(`/engineering/change-requests/new?affected=ebom:${e.id}`)}>Raise ECR</Button>

  return (
    <>
      <DetailPage
        header={{
          title: `${e.id} rev ${e.rev}`,
          screenId: "ENG-BOM-002",
          crumbs: [{ label: "EBOMs", to: "/engineering/boms" }, { label: e.id }],
          description: `${e.title}. Parent item ${e.parentItemId}; usage ${e.usage}${e.baseDesign ? `; base design: ${e.baseDesign}` : ""}.`,
          chips: (
            <>
              {e.cadAhead && <Chip kind="flag" note={e.cadAhead}>CAD ahead</Chip>}
              {placeholders.length > 0 && <Chip kind="flag" note="Release is blocked while any placeholder remains Draft (V-ENG-03)">{placeholders.length} placeholder{placeholders.length > 1 ? "s" : ""}</Chip>}
            </>
          ),
          primary,
          actions: (
            <>
              <Button variant="outline" onClick={() => setShowVal((v) => !v)}><ListChecks aria-hidden="true" />{showVal ? "Hide validation" : "Validate"}</Button>
              <Button variant="outline" disabled={!editable} title={editable ? undefined : "Import adds lines to a Draft EBOM only"} onClick={() => nav(`/engineering/boms/${e.id}/import`)}>Import</Button>
              {e.status === "Released" && <Button variant="outline" onClick={() => nav(`/engineering/mbom-transform/new/${e.id}`)}>Transform to MBOM</Button>}
              {e.status === "In Review" && <Button variant="ghost" onClick={() => setDlg("comment")}>Comment</Button>}
              {(e.status === "Draft" || e.status === "In Review") && <Button variant="outline" onClick={() => setDlg("package")}>Review release package</Button>}
              <Button variant="ghost" disabled={!editable} title={editable ? undefined : "Copy From fills a Draft EBOM"} onClick={() => setDlg("copy")}>Copy From…</Button>
              <Button variant="ghost" onClick={() => setDlg("mass")}>Mass replace…</Button>
              <Button variant="ghost" asChild><Link to={`/engineering/where-used?item=${e.parentItemId}`}>Where-used</Link></Button>
            </>
          ),
        }}
        status={{ kind: "ebom", value: e.status }}
        doc={{ type: "ebom", id: e.id }}
        summary={
          <>
            <KV k="Parent item"><Item s={s} id={e.parentItemId} showDesc={false} /></KV>
            <KV k="Engineering request">{e.engineeringRequestId ? <RefLink r={{ type: "engineeringRequest", id: e.engineeringRequestId }} /> : "None"}</KV>
            <KV k="Engineers">{e.assigneeIds.map(userName).join(", ") || "Unassigned"}</KV>
            <KV k="Released">{e.releasedOn ? fmtDate(e.releasedOn) : "Not released"}</KV>
          </>
        }
        aside={<ContextPanel s={s} e={e} line={sel} editable={editable} onMove={(parent) => sel && run((d, c) => act.updateLine(d, c, e.id, sel.no, { parent }), `Line ${sel.no} moved`)} />}
        tabs={[
          {
            id: "structure", label: "Structure", count: e.lines.length,
            content: (
              <div className="flex flex-col gap-4">
                {e.status === "Released" && <p className="rounded-md bg-muted px-4 py-2 text-sm">Rev {e.rev} is Released and immutable (C-14). Any change goes through an ECR and ECO.</p>}
                {e.status === "In Review" && <p className="rounded-md bg-muted px-4 py-2 text-sm">Locked for review. Reviewers comment per line; approval happens in WF-INBOX (Engineering Manager). An engineer cannot approve their own EBOM release.</p>}
                {evidenceMissing && e.status !== "Released" && (
                  <ErrorAlert title="Customer drawing approval evidence missing">
                    {er?.id} has the customer approval loop on. Release needs an Approved or Approved as Noted response on a For Approval transmittal (<Link className="underline" to={`/engineering/transmittals/new?er=${er?.id}`}>send one</Link>).
                  </ErrorAlert>
                )}
                {showVal && (
                  <section aria-label="Validation results" className="rounded-lg border">
                    <h3 className="border-b px-4 py-2 text-sm font-semibold">Validate: {errors.length} error{errors.length === 1 ? "" : "s"}, {validation.length - errors.length} warning{validation.length - errors.length === 1 ? "" : "s"}</h3>
                    {validation.length === 0 ? <p className="px-4 py-2 text-sm">No findings. V-ENG rules, circular reference, UoM, duplicates and zero quantities all pass.</p> : (
                      <ul className="flex flex-col">
                        {validation.map((v, i) => (
                          <li key={i}>
                            <button className="flex w-full items-start gap-2 px-4 py-1 text-left text-sm hover:bg-accent" onClick={() => { const l = e.lines.find((x) => x.no === v.line); if (l) { setNode(l.parent); setLine(l.no) } }}>
                              <Chip kind={v.severity === "error" ? "block" : "flag"}>{v.severity === "error" ? "Error" : "Warning"} {v.rule}</Chip>
                              <span>{v.text}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
                <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <Tree s={s} e={e} labels={labels} node={node} line={line} onNode={(n) => { setNode(n); setLine(e.lines.find((l) => l.parent === n)?.no) }} onLine={(l) => { setLine(l.no); setNode(l.parent) }} />
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      Lines under {node == null ? <span className="font-mono">{e.parentItemId}</span> : <>line {node} <span className="font-mono">{e.lines.find((l) => l.no === node)?.componentId}</span></>}
                    </p>
                    <LineGrid s={s} e={e} rows={visible} labels={labels} ops={ops} editable={editable} active={line} onActive={setLine} />
                    {editable && <AddRow s={s} e={e} parent={node} ops={ops} onPlaceholder={() => setDlg("placeholder")} />}
                  </div>
                </div>
              </div>
            ),
          },
          { id: "compare", label: "Compare revisions", count: e.priorRevs.length, content: <Compare s={s} e={e} /> },
          { id: "kits", label: "Sales kits", count: kits.length, content: <KitPanel s={s} e={e} kits={kits} /> },
          {
            id: "review", label: "Review comments", count: e.reviewNotes.length + e.lines.reduce((n, l) => n + (l.comments?.length ?? 0), 0),
            content: (
              <ul className="flex max-w-3xl flex-col gap-2 text-sm">
                {e.reviewNotes.map((c, i) => <li key={`n${i}`}><span className="text-muted-foreground">{fmtDate(c.on)} · {userName(c.by)} · header:</span> {c.text}</li>)}
                {e.lines.flatMap((l) => (l.comments ?? []).map((c, i) => <li key={`${l.no}-${i}`}><span className="text-muted-foreground">{fmtDate(c.on)} · {userName(c.by)} · line {l.no}:</span> {c.text}</li>))}
                {!e.reviewNotes.length && !e.lines.some((l) => l.comments?.length) && <li className="text-muted-foreground">No review comments.</li>}
              </ul>
            ),
          },
          {
            id: "mbom", label: "MBOMs", count: mboms.length,
            content: mboms.length ? (
              <ul className="flex flex-col gap-1 text-sm">{mboms.map((m) => <li key={m.id}><RefLink r={{ type: "mbom", id: m.id }} /> rev {m.revision} from EBOM rev {m.ebomRev} · <StatusBadge kind="mbom" status={m.status} size="sm" /></li>)}</ul>
            ) : <EmptyState title="No MBOM yet">{e.status === "Released" ? <Link className="text-link underline" to={`/engineering/mbom-transform/new/${e.id}`}>Transform this revision</Link> : "An MBOM is transformed from a Released revision."}</EmptyState>,
          },
          { id: "activity", label: "Activity", count: e.activity.length, content: <ul className="flex flex-col gap-1 text-sm">{[...e.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}</ul> },
        ]}
      />
      <NoPostings />
      <RulesPanel
        rules={[
          ["V-ENG-03", "Release is blocked while any placeholder remains Draft", "DOC:p.60 §3.2"],
          ["V-ENG-04", "Drawing reference mandatory for fabricated / made parts", "DOC:p.60 §3.2"],
          ["V-ENG-05", "Consume At Operation mandatory before MBOM release", "DOC:p.60 §3.2"],
          ["V-ENG-06", "Make items must carry a released EBOM before parent release", "DOC:p.61 §3.2"],
          ["Effectivity", "Line-level Effectivity From / To (dates or serial numbers) for running changes", "DOC:p.60 §3.2"],
          ["C-14", "Released EBOM is immutable; any change needs an ECO", "DOC:p.61 §3.4"],
          ["Release", "Engineering Manager approves; with customer approval, evidence of customer drawing approval attached; an engineer cannot approve their own release", "DOC:p.61 §3.4; p.177"],
          ["Alternates", "MRP may not auto-substitute; alternates are planner-selected", "DOC:p.60 §3.2"],
        ]}
      />

      <PlaceholderDialog open={dlg === "placeholder"} onClose={() => setDlg(null)} e={e} parent={node} ops={ops} />
      <DialogShell open={dlg === "submit"} onOpenChange={(o) => !o && setDlg(null)} title={`Submit ${e.id} rev ${e.rev} for review`} confirmLabel="Submit for review"
        consequence={`Runs Validate; with no errors the EBOM moves to In Review and locks. ${errors.length ? `Validate currently finds ${errors.length} error${errors.length > 1 ? "s" : ""}.` : "Validate currently passes."}`}
        onConfirm={() => runD((d, c) => act.submitEbom(d, c, e.id), `${e.id} In Review`)} />
      <EbomReleaseDialog open={dlg === "package"} onOpenChange={(o) => !o && setDlg(null)} ebomId={e.id} />
      <CopyFromDialog open={dlg === "copy"} onOpenChange={(o) => !o && setDlg(null)} target={e.id} erId={e.engineeringRequestId} />
      <MassReplaceDialog open={dlg === "mass"} onOpenChange={(o) => !o && setDlg(null)} initialFrom={e.lines[0]?.componentId as MaterialId | undefined} />
      <CommentDialog open={dlg === "comment"} onClose={() => setDlg(null)} e={e} line={line} />
    </>
  )
}

function Tree({ s, e, labels, node, line, onNode, onLine }: { s: EngineeringState; e: EbomRecord; labels: Map<number, string>; node?: number; line?: number; onNode: (n?: number) => void; onLine: (l: EbomLineX) => void }) {
  const render = (parent: number | undefined, depth: number): React.ReactNode[] =>
    e.lines.filter((l) => l.parent === parent).sort((a, b) => a.no - b.no).flatMap((l) => {
      const info = itemInfo(s, l.componentId)
      const fam = familyOf("material", info.status) ?? "draft"
      const hasKids = e.lines.some((c) => c.parent === l.no)
      return [
        <li key={l.no}>
          <button
            onClick={() => (hasKids ? onNode(l.no) : onLine(l))}
            aria-current={line === l.no || node === l.no ? "true" : undefined}
            className={cn("flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-[13px] hover:bg-accent", (line === l.no || node === l.no) && "bg-secondary font-semibold")}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
          >
            <span className="tabular rounded border px-1 font-mono text-[11px]">{labels.get(l.no)}</span>
            <span className={cn("size-2 shrink-0 rounded-full", DOT[fam])} title={`Item status ${info.status}`} aria-label={`Item status ${info.status}`} />
            <span className="truncate font-mono">{l.componentId}</span>
            {l.phantom && <span className="text-xs text-muted-foreground">phantom</span>}
          </button>
        </li>,
        ...render(l.no, depth + 1),
      ]
    })
  return (
    <nav aria-label="Structure tree" className="rounded-lg border p-2">
      <button onClick={() => onNode(undefined)} aria-current={node == null ? "true" : undefined} className={cn("mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] font-semibold hover:bg-accent", node == null && "bg-secondary")}>
        <span className="tabular rounded border px-1 font-mono text-[11px]">0</span>
        <span className="font-mono">{e.parentItemId}</span>
      </button>
      <ul className="flex flex-col">{render(undefined, 0)}</ul>
      <p className="mt-2 px-2 text-xs text-muted-foreground">Dot = component item status (S-42). Move a line under another node from the context panel.</p>
    </nav>
  )
}

function LineGrid({ s, e, rows, labels, ops, editable, active, onActive }: { s: EngineeringState; e: EbomRecord; rows: EbomLineX[]; labels: Map<number, string>; ops: { op: number; text: string }[]; editable: boolean; active?: number; onActive: (n: number) => void }) {
  const run = useAct()
  const docs = s.documents.filter((d) => docStatus(d) !== "Obsolete")
  const upd = (no: number, patch: Partial<EbomLineX>) => run((d, c) => act.updateLine(d, c, e.id, no, patch))
  // Keyboard-first grid contract: Enter = same column, next row (Shift+Enter previous row); Tab / Shift+Tab =
  // next / previous cell; Esc = cancel the edit and put the old value back. Past the last row, Enter lands on
  // the add-a-line field, so a whole structure can be keyed without the mouse.
  const onKey = (ev: KeyboardEvent<HTMLInputElement>, row: number, col: string) => {
    if (ev.key === "Escape") {
      ev.currentTarget.value = ev.currentTarget.defaultValue
      ev.currentTarget.blur()
      return
    }
    if (ev.key !== "Enter") return
    ev.preventDefault()
    const at = (r: number) => document.querySelector<HTMLInputElement>(`[data-grid="${e.id}"][data-row="${r}"][data-col="${col}"]`)
    if (ev.shiftKey) {
      at(row - 1)?.focus()
      return
    }
    ;(at(row + 1) ?? document.querySelector<HTMLInputElement>(`[data-grid="${e.id}"][data-col="add-component"]`))?.focus()
  }
  if (!rows.length) return <EmptyState title="No lines under this node">{editable ? "Add a component below, or create a placeholder part." : "This node has no child lines."}</EmptyState>
  return (
    <div className="flex flex-col gap-1">
    {editable && <p className="text-xs text-muted-foreground" id={`${e.id}-keys`}>Keyboard: Enter next row, Shift+Enter previous row, Tab next cell, Esc cancels the edit. After the last row Enter jumps to Add a line.</p>}
    <div className="overflow-x-auto rounded-lg border" aria-describedby={editable ? `${e.id}-keys` : undefined}>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead className="w-16">Find #</TableHead><TableHead>Component</TableHead><TableHead className="w-24 text-right">Qty</TableHead><TableHead>UoM</TableHead>
            <TableHead className="w-20 text-right">Scrap %</TableHead><TableHead>Ref des</TableHead><TableHead>Phantom</TableHead><TableHead>Consume at op</TableHead>
            <TableHead>Drawing</TableHead><TableHead>Make/Buy</TableHead><TableHead>Effectivity from / to (date YYYY-MM-DD or serial)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((l, i) => {
            const info = itemInfo(s, l.componentId)
            return (
              <TableRow key={l.no} data-state={active === l.no ? "selected" : undefined} className="h-8 text-[13px]" onClick={() => onActive(l.no)}>
                <TableCell className="font-mono">{l.no}<span className="block text-[11px] text-muted-foreground">{labels.get(l.no)}</span></TableCell>
                <TableCell className="min-w-56"><Item s={s} id={l.componentId} />{l.comments?.length ? <Chip kind="change" note={l.comments.map((c) => c.text).join(" | ")}>{l.comments.length} comment{l.comments.length > 1 ? "s" : ""}</Chip> : null}</TableCell>
                <TableCell className="text-right">
                  {editable ? <Input data-grid={e.id} data-row={i} data-col="qty" aria-label={`Qty line ${l.no}`} className="h-7 w-24 text-right" type="number" defaultValue={l.qty} onKeyDown={(ev) => onKey(ev, i, "qty")} onBlur={(ev) => Number(ev.target.value) !== l.qty && upd(l.no, { qty: Number(ev.target.value) })} /> : <span className={cn("tabular", !(l.qty > 0) && "text-destructive")}>{fmtNumber(l.qty, 2)}</span>}
                  {info.uom !== l.uom && <span className="block text-[11px] text-muted-foreground">{info.uom}</span>}
                </TableCell>
                <TableCell>{l.uom}</TableCell>
                <TableCell className="text-right">{editable ? <Input data-grid={e.id} data-row={i} data-col="scrap" aria-label={`Scrap % line ${l.no}`} className="h-7 w-20 text-right" type="number" defaultValue={l.scrapPct} onKeyDown={(ev) => onKey(ev, i, "scrap")} onBlur={(ev) => Number(ev.target.value) !== l.scrapPct && upd(l.no, { scrapPct: Number(ev.target.value) })} /> : <span className="tabular">{l.scrapPct}</span>}</TableCell>
                <TableCell>{editable ? <Input data-grid={e.id} data-row={i} data-col="refdes" aria-label={`Reference designators line ${l.no}`} className="h-7 w-32" defaultValue={l.refDes ?? ""} onKeyDown={(ev) => onKey(ev, i, "refdes")} onBlur={(ev) => ev.target.value !== (l.refDes ?? "") && upd(l.no, { refDes: ev.target.value })} /> : l.refDes}</TableCell>
                <TableCell><Checkbox aria-label={`Phantom line ${l.no}`} checked={!!l.phantom} disabled={!editable} onCheckedChange={(v) => upd(l.no, { phantom: !!v })} /></TableCell>
                <TableCell>
                  {editable ? (
                    <Select value={l.consumeAtOp ? String(l.consumeAtOp) : "__none"} onValueChange={(v) => upd(l.no, { consumeAtOp: v === "__none" ? undefined : Number(v) })}>
                      <SelectTrigger size="sm" className="h-7 w-28" aria-label={`Consume at operation line ${l.no}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="__none">Not mapped</SelectItem>{ops.map((o) => <SelectItem key={o.op} value={String(o.op)}>{o.op} {o.text}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : l.consumeAtOp ? <span className="tabular">{l.consumeAtOp}</span> : <span className="text-muted-foreground">Not mapped</span>}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Select value={l.drawingId ?? "__none"} onValueChange={(v) => upd(l.no, { drawingId: v === "__none" ? undefined : (v as never) })}>
                      <SelectTrigger size="sm" className="h-7 w-40" aria-label={`Drawing line ${l.no}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="__none">None</SelectItem>{docs.map((d) => <SelectItem key={d.id} value={d.id}>{d.id}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : l.drawingId ? <RefLink r={{ type: "document", id: l.drawingId }} /> : ""}
                </TableCell>
                <TableCell><span className="rounded border px-1 text-xs">{info.makeBuy}</span></TableCell>
                <TableCell className="text-xs">
                  {editable ? (
                    <span className="flex items-center gap-1">
                      <Input data-grid={e.id} data-row={i} data-col="efffrom" aria-label={`Effectivity from line ${l.no} (date or serial)`} placeholder="From" className="h-7 w-28" defaultValue={l.effFrom ?? ""} onKeyDown={(ev) => onKey(ev, i, "efffrom")} onBlur={(ev) => ev.target.value.trim() !== (l.effFrom ?? "") && upd(l.no, { effFrom: ev.target.value.trim() || undefined })} />
                      <Input data-grid={e.id} data-row={i} data-col="effto" aria-label={`Effectivity to line ${l.no} (date or serial)`} placeholder="To" className="h-7 w-28" defaultValue={l.effTo ?? ""} onKeyDown={(ev) => onKey(ev, i, "effto")} onBlur={(ev) => ev.target.value.trim() !== (l.effTo ?? "") && upd(l.no, { effTo: ev.target.value.trim() || undefined })} />
                    </span>
                  ) : l.effFrom || l.effTo ? `${l.effFrom ?? "start"} to ${l.effTo ?? "open"}` : (l.effectivity ?? "All")}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    </div>
  )
}

function AddRow({ s, e, parent, ops, onPlaceholder }: { s: EngineeringState; e: EbomRecord; parent?: number; ops: { op: number; text: string }[]; onPlaceholder: () => void }) {
  const run = useAct()
  const [comp, setComp] = useState("")
  const [qty, setQty] = useState("1")
  const [op, setOp] = useState("__none")
  const mats = pickableMaterials()
  const listId = `mat-${e.id}`
  const add = () => {
    const id = comp.trim().toUpperCase()
    if (!id) {
      toast.error("Enter a material number, or create a placeholder part.")
      return
    }
    if (!mats.some((m) => m.id === id) && !s.placeholders.some((p) => p.id === id)) {
      toast.error(`${id} is not an active material. Pick one from the list, or create a placeholder part for a new item (V-ENG-03).`)
      return
    }
    const r = run((d, c) => act.addLine(d, c, e.id, { componentId: id as MaterialId, qty: Number(qty), parent, consumeAtOp: op === "__none" ? undefined : Number(op) }), (n) => `Line ${n} added`)
    if (r.ok) (setComp(""), setQty("1"))
  }
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-2" role="group" aria-label="Add a line">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${e.id}-add`} className="text-xs">Component (material #)</Label>
        <Input id={`${e.id}-add`} data-grid={e.id} data-col="add-component" list={listId} className="h-8 w-64" placeholder="Search the material master" value={comp} onChange={(ev) => setComp(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && add()} />
        <datalist id={listId}>{mats.map((m) => <option key={m.id} value={m.id}>{m.description}</option>)}</datalist>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${e.id}-qty`} className="text-xs">Qty per</Label>
        <Input id={`${e.id}-qty`} className="h-8 w-24" type="number" value={qty} onChange={(ev) => setQty(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && add()} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Consume at op</Label>
        <Select value={op} onValueChange={setOp}>
          <SelectTrigger size="sm" className="h-8 w-36" aria-label="Consume at operation for the new line"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="__none">Not mapped</SelectItem>{ops.map((o) => <SelectItem key={o.op} value={String(o.op)}>{o.op} {o.text}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button variant="outline" onClick={add}>Add line</Button>
      <Button variant="ghost" onClick={onPlaceholder}><FilePlus2 aria-hidden="true" />Create placeholder part</Button>
    </div>
  )
}

function ContextPanel({ s, e, line, editable, onMove }: { s: EngineeringState; e: EbomRecord; line?: EbomLineX; editable: boolean; onMove: (parent?: number) => void }) {
  const run = useAct()
  const [alt, setAlt] = useState("")
  if (!line) return <section aria-label="Context panel" className="rounded-lg border p-4 text-sm text-muted-foreground">Select a line to see its item card, drawing, where-used and alternates.</section>
  const info = itemInfo(s, line.componentId)
  const drawing = line.drawingId ? s.documents.find((d) => d.id === line.drawingId) : undefined
  const usedIn = s.eboms.filter((x) => x.lines.some((l) => l.componentId === line.componentId))
  const usedInM = s.mboms.filter((x) => x.lines.some((l) => l.componentId === line.componentId))
  const ph = s.placeholders.find((p) => p.id === line.componentId)
  const parents = e.lines.filter((l) => l.no !== line.no && l.parent == null)
  const memberships = kitMemberships(s, line.componentId)
  return (
    <section aria-label="Context panel" className="flex flex-col gap-4 rounded-lg border p-4 text-sm">
      <div>
        <h3 className="mb-2 font-semibold">Line {line.no}: item card</h3>
        <p className="font-mono">{info.id}</p>
        <p className="text-muted-foreground">{info.description}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <KV k="Item status"><StatusBadge kind="material" status={info.status} size="sm" /></KV>
          <KV k="Make / Buy">{info.makeBuy}</KV>
          <KV k="Std cost">{info.stdCost != null ? fmtMoney(info.stdCost) : "Not set"}</KV>
          <KV k="Base UoM">{info.uom}</KV>
        </dl>
        {info.blocks.map((b) => <div key={b.block} className="mt-1"><Chip kind="block" note={b.reason}>{b.block}</Chip></div>)}
        <p className="mt-2 text-xs text-muted-foreground">AVL: {info.avl.length ? info.avl.map((a) => `${VENDORS.find((v) => v.id === a.vendorId)?.name ?? a.vendorId} (rank ${a.rank}, ${a.status})`).join("; ") : "no approved vendor"}</p>
        <p className="text-xs text-muted-foreground">Stock and lead time: shown by Materials (MM-MAT-001) <Chip kind="design" note="Stock and lead time are owned by the materials module">link</Chip> <Link className="text-link underline" to={`/inventory/items/${info.id}`}>open item</Link></p>
        {ph && <p className="mt-1 text-xs">Placeholder created {fmtDate(ph.createdOn)} by {userName(ph.engineerId)}; status <StatusBadge kind="material" status={ph.status} size="sm" />{ph.mcrId && <> · {ph.mcrId}</>}</p>}
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Drawing</h3>
        {drawing ? (
          <Link to={`/engineering/documents/${drawing.id}`} className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border bg-muted text-center hover:bg-accent">
            <span className="font-mono text-xs">{drawing.id}</span>
            <span className="text-xs">rev {drawing.revisions[drawing.revisions.length - 1].rev}</span>
            <StatusBadge kind="document" status={docStatus(drawing)} size="sm" />
          </Link>
        ) : <p className="text-muted-foreground">No drawing linked{info.makeBuy === "Make" ? " (required for made parts, V-ENG-04)" : ""}.</p>}
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Where used ({usedIn.length + usedInM.length})</h3>
        <ul className="flex flex-col gap-1">
          {usedIn.map((x) => <li key={x.id}><RefLink r={{ type: "ebom", id: x.id }} /> rev {x.rev} <StatusBadge kind="ebom" status={x.status} size="sm" /></li>)}
          {usedInM.map((x) => <li key={x.id}><RefLink r={{ type: "mbom", id: x.id }} /> rev {x.revision} <StatusBadge kind="mbom" status={x.status} size="sm" /></li>)}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Sales kit usage ({memberships.length})</h3>
        {memberships.length ? (
          <ul className="flex flex-col gap-1">{memberships.map((m) => <li key={m.ebom.id}><RefLink r={{ type: "ebom", id: m.ebom.id }} /> <span className="font-mono text-xs">{m.ebom.parentItemId}</span> × {fmtNumber(m.line.qty, 2)} <StatusBadge kind="ebom" status={m.ebom.status} size="sm" /></li>)}</ul>
        ) : <p className="text-muted-foreground">Not a member of any sales kit.</p>}
        <p className="mt-1 text-xs text-muted-foreground">Where used from any component lists its kit memberships [DOC:p.256 §6.1].</p>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Alternates</h3>
        {line.alternates?.length ? <ul className="flex flex-col gap-1">{line.alternates.map((a) => <li key={a.componentId}><span className="font-mono">{a.componentId}</span> rank {a.rank}: {a.condition}</li>)}</ul> : <p className="text-muted-foreground">None. MRP never auto-substitutes; a planner selects alternates.</p>}
        {editable && (
          <div className="mt-2 flex gap-2">
            <Input aria-label="Alternate component" list={`mat-${e.id}`} className="h-8" placeholder="Material #" value={alt} onChange={(ev) => setAlt(ev.target.value)} />
            <Button variant="outline" size="sm" onClick={() => alt && run((d, c) => act.updateLine(d, c, e.id, line.no, { alternates: [...(line.alternates ?? []), { componentId: alt.toUpperCase() as MaterialId, rank: (line.alternates?.length ?? 0) + 2, condition: "Planner-selected" }] }), "Alternate added") && setAlt("")}>Add</Button>
          </div>
        )}
      </div>
      {editable && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <Label className="text-xs">Move under</Label>
          <Select value={line.parent ? String(line.parent) : "__root"} onValueChange={(v) => onMove(v === "__root" ? undefined : Number(v))}>
            <SelectTrigger size="sm" aria-label="Move line under"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__root">{e.parentItemId} (level 1)</SelectItem>{parents.map((p) => <SelectItem key={p.no} value={String(p.no)}>Line {p.no} {p.componentId}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => run((d, c) => act.removeLine(d, c, e.id, line.no), `Line ${line.no} removed`)}>Remove line {line.no}</Button>
        </div>
      )}
    </section>
  )
}

function KitPanel({ s, e, kits }: { s: EngineeringState; e: EbomRecord; kits: ReturnType<typeof kitsForDesign> }) {
  if (e.usage === "Sales")
    return (
      <div className="flex max-w-3xl flex-col gap-2 text-sm">
        <p className="rounded-md bg-muted px-4 py-2">{e.id} is a sales kit: its header {e.parentItemId} is a material of type KIT, non-stocked and non-valuated by default. A kit is sold as a line on an order and is never transformed to an MBOM.</p>
        <p>Report-only cost rollup (sum of component standards): <span className="tabular font-medium">{fmtMoney(kitStandard(s, e))}</span> <Chip kind="design" note="A kit has no cost of its own; this sum is for the Costing view only">Report only</Chip></p>
      </div>
    )
  if (!kits.length) return <EmptyState title="No sales kit carries this design">Commissioning kits, recommended-spares packages and installation hardware sets that include this design's components appear here.</EmptyState>
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Sales kits (commissioning, recommended spares, installation hardware) that carry components of this design. A change to a shared component also changes what these kits sell [DOC:p.256 §6.1].</p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-table-head"><TableRow><TableHead>Kit EBOM</TableHead><TableHead>Kit item</TableHead><TableHead>Status</TableHead><TableHead>Shared components</TableHead><TableHead className="text-right">Report-only standard</TableHead></TableRow></TableHeader>
          <TableBody>
            {kits.map(({ kit, shared, sameFamily }) => (
              <TableRow key={kit.id} className="h-8 text-[13px]">
                <TableCell><RefLink r={{ type: "ebom", id: kit.id }} /></TableCell>
                <TableCell><span className="font-mono">{kit.parentItemId}</span><span className="block text-xs text-muted-foreground">{kit.title}</span></TableCell>
                <TableCell><StatusBadge kind="ebom" status={kit.status} size="sm" /></TableCell>
                <TableCell className="font-mono text-xs">{shared.length ? shared.map((l) => l.componentId).join(", ") : sameFamily ? "Same product family" : ""}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(kitStandard(s, kit))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function Compare({ s, e }: { s: EngineeringState; e: EbomRecord }) {
  const pool = useMemo(() => revisionPool(s, e.parentItemId), [s, e.parentItemId])
  const cur = `${e.id}@${e.rev}`
  const [from, setFrom] = useState(() => (e.priorRevs[0] ? `${e.id}@${e.priorRevs[0].rev}` : (pool.find((o) => o.key !== cur)?.key ?? "")))
  const [to, setTo] = useState(cur)
  return (
    <div className="flex flex-col gap-2">
      <RevisionCompare options={pool} fromKey={from} toKey={to} onFrom={setFrom} onTo={setTo} />
      <p className="text-xs text-muted-foreground">The same view stands alone at <Link className="text-link underline" to={`/engineering/compare-revisions?ebom=${e.id}`}>Compare revisions</Link>.</p>
    </div>
  )
}

function PlaceholderDialog({ open, onClose, e, parent, ops }: { open: boolean; onClose: () => void; e: EbomRecord; parent?: number; ops: { op: number; text: string }[] }) {
  const runD = useActDialog()
  const [f, setF] = useState({ description: "", category: "RAW" as "RAW" | "SEMI" | "CONS" | "PACK", uom: "EA", estCost: "0", vendor: "__none", qty: "1", op: "__none" })
  return (
    <DialogShell open={open} onOpenChange={(o) => !o && onClose()} title="Create placeholder part" confirmLabel="Create placeholder"
      consequence={`Creates a Draft item flagged Engineering Placeholder, adds it as a line of ${e.id}, and sends an Item Creation Request to Materials. ${e.id} cannot be released while it stays Draft (V-ENG-03).`}
      onConfirm={() => runD((d, c) => void act.createPlaceholder(d, c, e.id, { description: f.description, category: f.category, uom: f.uom, estCost: Number(f.estCost), targetVendorId: f.vendor === "__none" ? undefined : f.vendor, qty: Number(f.qty), parent, consumeAtOp: f.op === "__none" ? undefined : Number(f.op) }), "Placeholder created; MCR requested")}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1"><Label htmlFor="ph-desc">Description</Label><Input id="ph-desc" value={f.description} onChange={(ev) => setF({ ...f, description: ev.target.value })} /></div>
        <div className="flex flex-col gap-1"><Label>Category</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as typeof f.category })}><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger><SelectContent>{["RAW", "SEMI", "CONS", "PACK"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex flex-col gap-1"><Label htmlFor="ph-uom">UoM</Label><Input id="ph-uom" value={f.uom} onChange={(ev) => setF({ ...f, uom: ev.target.value.toUpperCase() })} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="ph-cost">Estimated cost (USD)</Label><Input id="ph-cost" type="number" value={f.estCost} onChange={(ev) => setF({ ...f, estCost: ev.target.value })} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="ph-qty">Qty per</Label><Input id="ph-qty" type="number" value={f.qty} onChange={(ev) => setF({ ...f, qty: ev.target.value })} /></div>
        <div className="flex flex-col gap-1"><Label>Target vendor</Label>
          <Select value={f.vendor} onValueChange={(v) => setF({ ...f, vendor: v })}><SelectTrigger aria-label="Target vendor"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Not known</SelectItem>{VENDORS.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex flex-col gap-1"><Label>Consume at op</Label>
          <Select value={f.op} onValueChange={(v) => setF({ ...f, op: v })}><SelectTrigger aria-label="Consume at operation"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Not mapped</SelectItem>{ops.map((o) => <SelectItem key={o.op} value={String(o.op)}>{o.op} {o.text}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
    </DialogShell>
  )
}

function CommentDialog({ open, onClose, e, line }: { open: boolean; onClose: () => void; e: EbomRecord; line?: number }) {
  const runD = useActDialog()
  const [text, setText] = useState("")
  const [onLine, setOnLine] = useState(true)
  return (
    <DialogShell open={open} onOpenChange={(o) => !o && onClose()} title="Reviewer comment" confirmLabel="Add comment" onConfirm={() => runD((d, c) => act.commentEbom(d, c, e.id, text, onLine ? line : undefined), "Comment added")}>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={onLine && line != null} disabled={line == null} onCheckedChange={(v) => setOnLine(!!v)} />On line {line ?? "(none selected)"}</label>
      <Textarea aria-label="Comment" value={text} onChange={(ev) => setText(ev.target.value)} />
    </DialogShell>
  )
}
