// Dialog components of the Engineering group, each usable as a modal from the screens that need it
// and drawn inline on its own page (/engineering/dialogs/...) in every state:
//   EbomReleaseDialog  FX-ENG-RELEASE   EBOM review and release package [DOC:p.61 §3.1, §3.4]
//   CopyFromDialog     FX-ENG-COPYFROM  EBOM Copy From and base-design picker [DOC:p.61 §3.3; p.59 §2]
//   MassReplaceDialog  FX-ENG-MASSREPLACE Mass replace component, always creates an ECO (C-15) [DOC:p.61 §3.3; §4]

import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Chip, EmptyState, StatusBadge } from "@/components/patterns"
import { routeApproval, sameRef, type MaterialId } from "@/data/domain"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { store, useCore, useRole, useSlice } from "@/store"
import { DlgFrame } from "./DlgFrame"
import { StateBanners, type StateFlags } from "./states"
import { useActDialog } from "./components"
import { diffLines, itemDesc, itemInfo, levelLabels, pickableMaterials, userName, validateEbom, isProductionEbom } from "./data/logic"
import * as act from "./data/actions"
import type { EbomRecord } from "./data/types"

export interface DialogCommon {
  open?: boolean
  onOpenChange?: (o: boolean) => void
  /** Draw inline on the dialog's own page instead of as a modal. */
  embedded?: boolean
  /** Screen states to show (offline, read-only, conflict, validation, empty ...). */
  view?: StateFlags
}

// ================================================================== EBOM review and release package
type Gate = { rule: string; label: string; state: "pass" | "fail" | "warn"; detail: string; to?: string }
const GATE_ICON = { pass: CheckCircle2, fail: CircleX, warn: CircleAlert }
const GATE_WORD = { pass: "Pass", fail: "Blocks release", warn: "Warning" }

export function releaseGates(s: ReturnType<typeof useSlice<"engineering">>, e: EbomRecord): Gate[] {
  const v = validateEbom(s, e)
  const by = (rule: string) => v.filter((x) => x.rule === rule)
  const er = s.requests.find((r) => r.id === e.engineeringRequestId)
  const rule = (id: string, label: string, ok: string, sev: "fail" | "warn" = "fail"): Gate => {
    const x = by(id)
    return x.length ? { rule: id, label, state: sev, detail: x.map((y) => y.text).slice(0, 2).join(" ") + (x.length > 2 ? ` (+${x.length - 2} more)` : "") } : { rule: id, label, state: "pass", detail: ok }
  }
  const drawings = [...new Set(e.lines.map((l) => l.drawingId).filter(Boolean))] as string[]
  const unreleased = drawings.filter((id) => {
    const d = s.documents.find((x) => x.id === id)
    return !d || !d.revisions.some((r) => r.status === "Released")
  })
  const evidence = !er ? undefined : er.customerApprovalRequired ? er.customerApprovalEvidence : "n/a"
  const comments = e.reviewNotes.length + e.lines.reduce((n, l) => n + (l.comments?.length ?? 0), 0)
  const gates: Gate[] = [
    rule("V-ENG-03", "No Draft placeholder parts", "Every placeholder is Active"),
    rule("V-ENG-04", "Made parts carry a drawing reference", "All made parts have a drawing"),
    rule("V-ENG-06", "Make items have a Released EBOM", "Every make item has a Released EBOM"),
    rule("Qty", "No zero quantities", "All quantities above 0"),
    rule("UoM", "UoM conversions exist", "All UoMs convert"),
    rule("Circular", "No circular reference", "Structure is acyclic"),
    rule("C-16", "No Obsolete components", "No Obsolete components"),
    { rule: "Drawings", label: "Linked drawings are Released", state: unreleased.length ? "fail" : "pass", detail: unreleased.length ? `Not Released: ${unreleased.join(", ")}. Release stamps the rendition only when the drawing itself is released.` : `${drawings.length} drawing${drawings.length === 1 ? "" : "s"} linked, all with a Released revision` },
    { rule: "Evidence", label: "Customer drawing approval evidence", state: evidence ? "pass" : "fail", detail: !er ? "No engineering request: no customer approval loop" : evidence === "n/a" ? `${er.id}: customer approval loop is off` : evidence ? `Transmittal ${evidence} holds an Approved / Approved as Noted response` : `${er.id} needs an Approved or Approved as Noted response on a For Approval transmittal`, to: !evidence && er ? `/engineering/transmittals/new?er=${er.id}` : undefined },
    { rule: "V-ENG-05", label: "Consume At Operation mapped", state: by("V-ENG-05").length ? "warn" : "pass", detail: by("V-ENG-05").length ? `${by("V-ENG-05").length} line(s) unmapped: mandatory before MBOM release, not before EBOM release.` : "All lines mapped" },
    { rule: "Comments", label: "Reviewer comments", state: comments ? "warn" : "pass", detail: comments ? `${comments} comment${comments === 1 ? "" : "s"} on this revision: read them before approving.` : "No open comments" },
  ]
  if (e.usage === "Sales") gates.splice(3, 0, rule("Kit", "Sales kit rules (single level, no phantoms, no nested kits)", "Kit structure is valid"))
  return gates
}

export function EbomReleaseDialog({ ebomId, ...c }: DialogCommon & { ebomId: string }) {
  const s = useSlice("engineering")
  const core = useCore()
  const nav = useNavigate()
  const [role] = useRole()
  const e = s.eboms.find((x) => x.id === ebomId)
  const [ack, setAck] = useState(false)
  if (!e) return null
  const gates = releaseGates(s, e)
  const blocking = gates.filter((g) => g.state === "fail")
  const warns = gates.filter((g) => g.state === "warn")
  const prior = e.priorRevs[0]
  const diff = prior ? diffLines(prior.lines, e.lines) : []
  const drawings = [...new Set(e.lines.map((l) => l.drawingId).filter(Boolean))] as string[]
  const alternates = e.lines.reduce((n, l) => n + (l.alternates?.length ?? 0), 0)
  const route = routeApproval("EBOM release", {})
  const open = core.approvals.find((a) => !a.outcome && a.kind === "EBOM release" && sameRef(a.subject, { type: "ebom", id: e.id }))
  const own = !!e.submittedBy && e.submittedBy === core.userId && role === "Engineering Manager"
  let blocked: string | undefined
  if (c.view?.offline) blocked = "you are offline; sending for approval needs the server"
  else if (c.view?.readonly || e.status === "Released") blocked = e.status === "Released" ? `rev ${e.rev} is already Released and immutable (C-14); raise an ECR to change it` : "this view is read-only"
  else if (e.status === "Draft") blocked = "submit the EBOM for review first (Validate runs then)"
  else if (e.status !== "In Review") blocked = `${e.id} is ${e.status}`
  else if (open) blocked = `${open.id} is already waiting for ${open.steps.find((x) => !x.decided)?.role}`
  else if (blocking.length) blocked = `${blocking.length} gate${blocking.length === 1 ? "" : "s"} block release`
  else if (own) blocked = "you submitted this revision; an engineer cannot approve their own release (another approver decides in WF-INBOX)"
  else if (warns.length && !ack) blocked = "acknowledge the warnings below"
  return (
    <DlgFrame
      {...c}
      wide
      title={`Release package: ${e.id} rev ${e.rev}`}
      description={`${e.title}. Parent item ${e.parentItemId}, usage ${e.usage}. Release is approved by the Engineering Manager in WF-INBOX; with customer approval, evidence of the customer's drawing approval is attached.`}
      confirmLabel="Send for release approval"
      blockedReason={blocked}
      consequence={`Raises an "EBOM release" request in WF-INBOX (${route.steps.join(" then ")}). On approval ${e.id} rev ${e.rev} becomes Released and immutable (C-14), and MBOM transformation opens. Rejecting returns it to Draft with comments.`}
      onConfirm={() => {
        if (c.view?.conflict) return `${e.id} changed while this was open (another user edited a line). Reload the EBOM and check the gates again.`
        const r = store.raiseApproval({ kind: "EBOM release", subject: { type: "ebom", id: e.id }, title: `${e.id} rev ${e.rev}: ${e.title}` })
        toast.success(`${r.id} sent; it waits for ${r.steps[0].role}`)
        if (!c.embedded) nav(`/approvals?req=${r.id}`)
        return null
      }}
    >
      <StateBanners st={c.view ?? {}} text={{ conflict: `${e.id} changed after you opened this package. Reload to see the current gates.`, validation: `${blocking.length || 1} gate${blocking.length === 1 ? "" : "s"} block release: fix them in the editor, then reopen this package.` }} />
      <section aria-label="Release gates" className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Gates ({blocking.length} block, {warns.length} warn, {gates.length - blocking.length - warns.length} pass)</h3>
        <ul className="divide-y rounded-md border">
          {gates.map((g) => {
            const Icon = GATE_ICON[g.state]
            return (
              <li key={g.rule} className="flex items-start gap-2 px-3 py-2 text-sm">
                <Icon className={cn("mt-0.5 size-4 shrink-0", g.state === "fail" && "text-destructive")} aria-hidden="true" />
                <span className="flex-1">
                  <span className="font-medium">{g.label}</span> <span className="text-xs text-muted-foreground">{g.rule}</span>
                  <span className="block text-muted-foreground">{g.detail}{g.to && <> <Link className="text-link underline" to={g.to}>Send one</Link></>}</span>
                </span>
                <span className="text-xs font-medium">{GATE_WORD[g.state]}</span>
              </li>
            )
          })}
        </ul>
      </section>
      <section aria-label="Package contents" className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Structure</p><p className="tabular">{e.lines.length} lines, {new Set(levelLabels(e.lines).values()).size} nodes</p></div>
        <div><p className="text-xs text-muted-foreground">Drawings</p><p>{drawings.length} linked</p></div>
        <div><p className="text-xs text-muted-foreground">Alternates</p><p>{alternates} defined</p></div>
        <div><p className="text-xs text-muted-foreground">Change evidence</p><p>{prior ? `${diff.filter((d) => d.kind === "Added").length} added, ${diff.filter((d) => d.kind === "Removed").length} removed, ${diff.filter((d) => d.kind === "Changed").length} changed vs rev ${prior.rev}` : "First revision: nothing to compare"}</p></div>
      </section>
      <p className="text-sm text-muted-foreground">
        Submitted by {userName(e.submittedBy)}. Approval route: {route.steps.join(" then ")} <Chip kind="design" note={route.reading ?? route.rule}>Route</Chip>
        {prior && <> · <Link className="text-link underline" to={`/engineering/compare-revisions?ebom=${e.id}&from=${e.id}@${prior.rev}&to=${e.id}@${e.rev}`}>Open the full revision compare</Link></>}
      </p>
      {warns.length > 0 && !blocking.length && (
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={ack} onCheckedChange={(v) => setAck(!!v)} />I have read the {warns.length} warning{warns.length === 1 ? "" : "s"} and the reviewer comments</label>
      )}
    </DlgFrame>
  )
}

// ================================================================== EBOM Copy From and base-design picker
export function BaseDesignPicker({ value, onChange, forItem, query, setQuery }: { value: string; onChange: (id: string) => void; forItem?: string; query: string; setQuery: (q: string) => void }) {
  const s = useSlice("engineering")
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return s.eboms
      .filter((e) => e.status === "Released" && isProductionEbom(e))
      .filter((e) => !q || `${e.id} ${e.parentItemId} ${e.title} ${e.baseDesign ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.parentItemId === forItem) - Number(a.parentItemId === forItem) || a.parentItemId.localeCompare(b.parentItemId))
  }, [s.eboms, query, forItem])
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="base-search">Search released designs (similar designs first)</Label>
      <Input id="base-search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Item, EBOM number or title" />
      <RadioGroup value={value} onValueChange={onChange} aria-label="Base design" className="max-h-60 overflow-y-auto rounded-md border p-1">
        {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No released design matches.</p>}
        {rows.map((e) => (
          <label key={e.id} className={cn("flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm hover:bg-accent", value === e.id && "bg-secondary")}>
            <RadioGroupItem value={e.id} aria-label={`${e.id} rev ${e.rev}`} className="mt-1" />
            <span className="flex-1">
              <span className="font-mono">{e.id}</span> rev {e.rev} · <span className="font-mono">{e.parentItemId}</span>
              {forItem && e.parentItemId === forItem && <span className="ml-2"><Chip kind="flag" note="Same parent item as the target: the closest base design">Same item</Chip></span>}
              <span className="block text-muted-foreground">{e.title}</span>
              <span className="block text-xs text-muted-foreground">{e.lines.length} lines · released {fmtDate(e.releasedOn)}{e.baseDesign ? ` · base: ${e.baseDesign}` : ""}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}

export function CopyFromDialog({ target, erId, onCopied, ...c }: DialogCommon & { target?: string; erId?: string; onCopied?: (id: string) => void }) {
  const s = useSlice("engineering")
  const nav = useNavigate()
  const runD = useActDialog()
  const drafts = s.eboms.filter((e) => e.status === "Draft")
  const tgt = s.eboms.find((e) => e.id === target)
  const released = s.eboms.filter((e) => e.status === "Released" && isProductionEbom(e))
  const [mode, setMode] = useState<"whole" | "subtree">(target ? "subtree" : "whole")
  const [src, setSrc] = useState<string>(released.find((e) => e.parentItemId === tgt?.parentItemId)?.id ?? released[0]?.id ?? "")
  const [q, setQ] = useState("")
  const [er, setEr] = useState(erId ?? "__none")
  const [root, setRoot] = useState<string>("")
  const [to, setTo] = useState<string>(target ?? drafts[0]?.id ?? "")
  const [parent, setParent] = useState("__root")
  const source = s.eboms.find((e) => e.id === src)
  const targetEbom = s.eboms.find((e) => e.id === to)
  const labels = source ? levelLabels(source.lines) : new Map<number, string>()
  const rootNo = root ? Number(root) : source?.lines.find((l) => l.parent == null)?.no
  const subtreeCount = useMemo(() => {
    if (!source || rootNo == null) return 0
    const ids = new Set<number>([rootNo])
    for (let grew = true; grew; ) {
      grew = false
      for (const l of source.lines) if (l.parent != null && ids.has(l.parent) && !ids.has(l.no)) (ids.add(l.no), (grew = true))
    }
    return ids.size
  }, [source, rootNo])
  const none = c.view?.empty || released.length === 0
  const blocked = c.view?.offline ? "you are offline; copying creates a record on the server" : c.view?.readonly ? "this view is read-only" : mode === "subtree" && !targetEbom ? "choose a Draft EBOM to copy into" : undefined
  return (
    <DlgFrame
      {...c}
      wide
      title="Copy From a released design"
      description="Copy an entire released EBOM (or a subtree) of a similar design, then edit the deltas. The source stays unchanged and provenance is stored as Base Design, for design-reuse reporting."
      confirmLabel={mode === "whole" ? "Create Draft copy" : "Copy subtree"}
      blockedReason={blocked}
      consequence={mode === "whole" ? `Creates a new Draft EBOM, rev A, with every line of ${src || "the source"}; Base Design records "Copy From ${src || "…"}".` : `Appends ${subtreeCount} line${subtreeCount === 1 ? "" : "s"} (renumbered Find #) to ${to || "the target"}; its Base Design is kept or set to the source.`}
      onConfirm={() => {
        if (c.view?.conflict) return `${to || src} was edited by someone else while you chose. Reload and pick again.`
        if (mode === "whole") {
          let id = ""
          const e = runD((d, x) => void (id = act.copyEbom(d, x, src, er === "__none" ? undefined : er)), "Draft copy created")
          if (e) return e
          onCopied?.(id)
          if (!c.embedded) nav(`/engineering/boms/${id}`)
          return null
        }
        const e = runD((d, x) => void act.copySubtree(d, x, src, rootNo ?? -1, to, parent === "__root" ? undefined : Number(parent)), "Subtree copied")
        if (!e) onCopied?.(to)
        return e
      }}
    >
      <StateBanners st={c.view ?? {}} text={{ validation: "Choose a Released design to copy from. Obsolete and Draft designs are not offered (C-16)." }} />
      {none ? (
        <EmptyState title="No released design to copy from">Release an EBOM first, or ask the Engineering Manager. Only Released production EBOMs can be a base design.</EmptyState>
      ) : (
        <>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "whole" | "subtree")} className="grid-cols-2" aria-label="What to copy">
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="whole" />Entire EBOM into a new Draft</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="subtree" />A subtree into an existing Draft</label>
          </RadioGroup>
          <BaseDesignPicker value={src} onChange={(v) => { setSrc(v); setRoot("") }} forItem={tgt?.parentItemId} query={q} setQuery={setQ} />
          {mode === "whole" ? (
            <div className="flex flex-col gap-1">
              <Label>For engineering request (optional)</Label>
              <Select value={er} onValueChange={setEr}>
                <SelectTrigger aria-label="Engineering request"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {s.requests.filter((r) => r.status !== "Closed").map((r) => <SelectItem key={r.id} value={r.id}>{r.id} · {r.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label>Subtree root (source line)</Label>
                <Select value={String(rootNo ?? "")} onValueChange={setRoot}>
                  <SelectTrigger aria-label="Subtree root"><SelectValue /></SelectTrigger>
                  <SelectContent>{source?.lines.map((l) => <SelectItem key={l.no} value={String(l.no)}>{labels.get(l.no)} · line {l.no} {l.componentId}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Into Draft EBOM</Label>
                <Select value={to} onValueChange={(v) => { setTo(v); setParent("__root") }}>
                  <SelectTrigger aria-label="Target Draft EBOM"><SelectValue placeholder="No Draft EBOM" /></SelectTrigger>
                  <SelectContent>{drafts.map((e) => <SelectItem key={e.id} value={e.id}>{e.id} · {e.parentItemId}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Under line</Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger aria-label="Under line"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__root">Top level</SelectItem>{targetEbom?.lines.map((l) => <SelectItem key={l.no} value={String(l.no)}>Line {l.no} {l.componentId}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          {source && <p className="text-xs text-muted-foreground">Copying from {source.id} rev {source.rev}: {mode === "whole" ? `${source.lines.length} lines` : `${subtreeCount} line${subtreeCount === 1 ? "" : "s"} under the chosen root`}.</p>}
        </>
      )}
    </DlgFrame>
  )
}

// ================================================================== Mass replace component
export function MassReplaceDialog({ initialFrom, initialTo, ...c }: DialogCommon & { initialFrom?: MaterialId; initialTo?: MaterialId }) {
  const s = useSlice("engineering")
  const nav = useNavigate()
  const runD = useActDialog()
  const mats = pickableMaterials()
  const [from, setFrom] = useState<MaterialId>(initialFrom ?? "RAW-TBD-BSH015")
  const [to, setTo] = useState<MaterialId>(initialTo ?? "SPARE-TBD-BSH145")
  const [sel, setSel] = useState<string[]>([])
  const using = s.eboms.filter((e) => e.status !== "Obsolete" && e.status !== "Superseded" && e.lines.some((l) => l.componentId === from))
  const fi = itemInfo(s, from)
  const ti = itemInfo(s, to)
  const cost = (id: string) => itemInfo(s, id).stdCost ?? 0
  const picked = using.filter((e) => sel.includes(e.id))
  const affectedLines = picked.flatMap((e) => e.lines.filter((l) => l.componentId === from).map((l) => ({ e, l })))
  const delta = affectedLines.reduce((t, { l }) => t + l.qty * (cost(to) - cost(from)), 0)
  const activeMboms = s.mboms.filter((m) => m.status === "Active" && picked.some((e) => e.id === m.ebomId))
  const clash = s.ecos.filter((x) => x.stage !== "Released" && picked.some((e) => x.changes.some((ch) => ch.ebomId === e.id)))
  let problem: string | undefined
  if (from === to) problem = "Pick a replacement that is a different component."
  else if (ti.status === "Obsolete") problem = `${to} is Obsolete (C-16); pick an active replacement.`
  else if (ti.uom !== fi.uom) problem = `${to} is stocked in ${ti.uom} and ${from} in ${fi.uom}; there is no conversion, so quantities cannot carry over.`
  const blocked = c.view?.offline ? "you are offline; this creates an ECO on the server" : c.view?.readonly ? "this view is read-only" : problem ?? (!picked.length ? "select at least one EBOM" : undefined)
  return (
    <DlgFrame
      {...c}
      wide
      title="Mass replace a component"
      description="Replace component A with B across selected BOMs. It cannot be done silently: it always creates an ECO, and nothing changes until that ECO is released (C-15)."
      confirmLabel="Create ECO"
      blockedReason={blocked}
      consequence={`Creates one ECO carrying the replacement of ${from} with ${to} on ${picked.length} EBOM${picked.length === 1 ? "" : "s"} (${affectedLines.length} line${affectedLines.length === 1 ? "" : "s"}). The ECO task list is generated; ${activeMboms.length} Active MBOM${activeMboms.length === 1 ? "" : "s"} will need regenerating.`}
      onConfirm={() => {
        if (c.view?.conflict) return `ECO ${clash[0]?.id ?? "ECO-2026-0008"} is already changing one of these EBOMs. Finish or amend it first.`
        let ecoId = ""
        const e = runD((d, x) => void (ecoId = act.massReplace(d, x, sel, from, to)), "ECO created from mass replace")
        if (!e) {
          if (!c.embedded) nav(`/engineering/change-orders/${ecoId}`)
          else toast.message(`Created ${ecoId}`, { description: "Open it from Change orders." })
        }
        return e
      }}
    >
      <StateBanners st={c.view ?? {}} text={{ validation: problem ?? "Pick a replacement component and at least one EBOM.", conflict: "Another ECO already changes one of the selected EBOMs." }} />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label>Replace component</Label>
          <Select value={from} onValueChange={(v) => { setFrom(v as MaterialId); setSel([]) }}>
            <SelectTrigger aria-label="Component to replace"><SelectValue /></SelectTrigger>
            <SelectContent>{mats.map((m) => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{itemDesc(from)} · {fi.uom} · {fmtMoney(cost(from))}</span>
        </div>
        <div className="flex flex-col gap-1">
          <Label>With</Label>
          <Select value={to} onValueChange={(v) => setTo(v as MaterialId)}>
            <SelectTrigger aria-label="Replacement component" aria-invalid={!!problem}><SelectValue /></SelectTrigger>
            <SelectContent>{mats.map((m) => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{itemDesc(to)} · {ti.uom} · {fmtMoney(cost(to))}</span>
        </div>
      </div>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 flex items-center gap-3 text-sm font-medium">
          EBOMs using {from} ({using.length})
          {using.length > 0 && <button type="button" className="text-link underline" onClick={() => setSel(sel.length === using.length ? [] : using.map((e) => e.id))}>{sel.length === using.length ? "Clear" : "Select all"}</button>}
        </legend>
        {using.length === 0 && <p className="text-sm text-muted-foreground">No current EBOM uses this component.</p>}
        {using.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={sel.includes(e.id)} onCheckedChange={(v) => setSel((p) => (v ? [...p, e.id] : p.filter((x) => x !== e.id)))} />
            <span className="font-mono">{e.id}</span> rev {e.rev} · {e.title} <StatusBadge kind="ebom" status={e.status} size="sm" />
          </label>
        ))}
      </fieldset>
      {picked.length > 0 && (
        <p className="text-sm">
          Preview: {affectedLines.map(({ e, l }) => `${e.id} line ${l.no} (${fmtNumber(l.qty, 2)} ${l.uom})`).join("; ")}. Standard-cost effect <span className="tabular font-medium">{delta >= 0 ? "+" : ""}{fmtMoney(Math.round(delta))}</span> <Chip kind="design" note="Standard cost of the replacement minus the current, per unit of parent; the ECO runs the formal costing simulation">estimate</Chip>
        </p>
      )}
      {clash.length > 0 && <p className="text-sm"><Chip kind="flag" note={clash.map((x) => x.id).join(", ")}>Open ECO</Chip> {clash.map((x) => x.id).join(", ")} already changes a selected EBOM; the ECO list shows both.</p>}
    </DlgFrame>
  )
}
