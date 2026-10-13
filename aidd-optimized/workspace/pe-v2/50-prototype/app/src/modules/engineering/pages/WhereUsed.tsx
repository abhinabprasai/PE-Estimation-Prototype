// FX-ENG-WHEREUSED Where-Used explorer (Workbench, design value) [DOC:p.61 §3.3 Where-Used; p.67 §7;
// p.256 §6.1]. For any component: all EBOMs / MBOMs using it with revision and status, then where each
// parent is used in turn (multi-level). The mandatory pre-check surface for ECR impact analysis, and
// the audit and obsolescence tool. Kit memberships are listed with the BOMs.

import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { WorkbenchPage } from "@/components/templates"
import type { MaterialId } from "@/data/domain"
import { useSlice } from "@/store"
import { MassReplaceDialog } from "../dialogs"
import { NoPostings } from "../components"
import { ScreenFrame, StatePreviewAll, useStates } from "../states"
import { engineeringItems, itemInfo, whereUsedExplosion, type WhereUsedNode } from "../data/logic"
import { isKitId } from "../data/reference"

const routeOf = (n: WhereUsedNode) => (n.kind === "MBOM" ? `/engineering/mbom-transform/${n.recordId}` : `/engineering/boms/${n.recordId}`)

export function WhereUsed() {
  const s = useSlice("engineering")
  const st = useStates("FX-ENG-WHEREUSED")
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const items = useMemo(() => engineeringItems(s), [s])
  const item = params.get("item") ?? "RAW-TBD-BSH145"
  const [draft, setDraft] = useState(item)
  const [queue, setQueue] = useState("all")
  const [levels, setLevels] = useState("6")
  const [active, setActive] = useState<string | undefined>()
  const [mass, setMass] = useState(false)
  const known = items.some((i) => i.id === item)
  const info = itemInfo(s, item)
  const all = useMemo(() => (st.empty ? [] : whereUsedExplosion(s, item, Number(levels))), [s, item, levels, st.empty])
  const rows = all.filter((n) => (queue === "all" ? true : queue === "ebom" ? n.kind === "EBOM" : queue === "mbom" ? n.kind === "MBOM" : n.kind === "Sales kit"))
  const key = (n: WhereUsedNode) => `${n.kind}:${n.recordId}:${n.line}:${n.level}`
  const activeRows = all.filter((n) => n.active)
  const go = (v: string) => {
    const id = v.trim().toUpperCase()
    params.set("item", id)
    setParams(params, { replace: true })
  }
  const columns: Column<WhereUsedNode>[] = [
    { id: "rec", header: "Record", value: (n) => n.recordId, mono: true, sortable: true },
    { id: "level", header: "Level", value: (n) => n.level, align: "right", sortable: true, filterable: true, cell: (n) => <span className="tabular rounded border px-1 font-mono text-xs">{n.level}</span> },
    { id: "kind", header: "Kind", value: (n) => n.kind, filterable: true },
    { id: "rev", header: "Rev", value: (n) => n.rev, mono: true },
    { id: "status", header: "Status", value: (n) => n.status, filterable: true, cell: (n) => <StatusBadge kind={n.kind === "MBOM" ? "mbom" : "ebom"} status={n.status} size="sm" /> },
    { id: "parent", header: "Parent item", value: (n) => n.parentItemId, mono: true },
    { id: "line", header: "Find #", value: (n) => n.line, align: "right", mono: true },
    { id: "qty", header: "Qty per", value: (n) => n.qty, align: "right", mono: true, cell: (n) => `${n.qty} ${n.uom}` },
    { id: "via", header: "Via", value: (n) => n.via, mono: true },
  ]
  const sel = all.find((n) => key(n) === active)
  return (
    <ScreenFrame st={st} what="Where-Used explorer" who="Engineers, the Engineering Manager, production, purchasing and quality read BOMs" source="DOC:p.67 §7" handleLoading={false}
      text={{ degraded: "Stock and open-order impact come from other modules and may lag; the BOM usage shown here is current.", readonly: "Read-only: the explorer never changes a BOM. Replacing a component creates an ECO." }}>
      <WorkbenchPage<WhereUsedNode>
        header={{
          title: "Where-Used explorer",
          screenId: "FX-ENG-WHEREUSED",
          crumbs: [{ label: "Where-Used" }],
          description: "All EBOMs, MBOMs and sales kits that use an item, and where each parent is used in turn. Run it before any ECR: it is the mandatory pre-check for impact analysis.",
          actions: (
            <>
              <StatePreviewAll st={st} />
              <Button variant="outline" disabled={st.offline || !all.some((n) => n.kind === "EBOM")} title={all.some((n) => n.kind === "EBOM") ? undefined : "No EBOM uses this item"} onClick={() => setMass(true)}>Mass replace…</Button>
            </>
          ),
          primary: <Button disabled={!known || st.offline} onClick={() => nav(`/engineering/change-requests/new?affected=material:${item}`)}>Raise ECR for {item}</Button>,
        }}
        kpis={[
          { label: "Records using it", value: all.length, hint: `${all.filter((n) => n.level === 1).length} directly` },
          { label: "Active usage", value: activeRows.length, hint: "Draft, In Review, Released or Active" },
          { label: "Deepest level", value: all.reduce((m, n) => Math.max(m, n.level), 0) },
          { label: "Sales kits", value: all.filter((n) => n.kind === "Sales kit").length, hint: "kit memberships" },
        ]}
        queues={[
          { id: "all", label: "All", count: all.length },
          { id: "ebom", label: "EBOMs", count: all.filter((n) => n.kind === "EBOM").length },
          { id: "mbom", label: "MBOMs", count: all.filter((n) => n.kind === "MBOM").length },
          { id: "kit", label: "Sales kits", count: all.filter((n) => n.kind === "Sales kit").length },
        ]}
        queue={queue}
        onQueueChange={setQueue}
        table={{
          rows, columns, rowId: key, rowHref: (n) => routeOf(n), onRowClick: (n) => setActive(key(n)), activeId: active, loading: st.loading, error: st.error, onRetry: st.retry, densityKey: "FX-ENG-WHEREUSED", initialSort: { id: "level", dir: "asc" },
          toolbar: (
            <span className="flex flex-wrap items-end gap-2">
              <span className="flex flex-col gap-1">
                <Label htmlFor="wu-item" className="text-xs">Item (material number)</Label>
                <Input id="wu-item" list="wu-items" className="h-8 w-60" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go(draft)} onBlur={() => draft !== item && go(draft)} />
                <datalist id="wu-items">{items.map((i) => <option key={i.id} value={i.id}>{i.description}</option>)}</datalist>
              </span>
              <span className="flex flex-col gap-1">
                <Label className="text-xs">Levels</Label>
                <Select value={levels} onValueChange={setLevels}>
                  <SelectTrigger size="sm" className="h-8 w-24" aria-label="Levels"><SelectValue /></SelectTrigger>
                  <SelectContent>{["1", "2", "3", "6"].map((l) => <SelectItem key={l} value={l}>{l === "6" ? "All" : l}</SelectItem>)}</SelectContent>
                </Select>
              </span>
            </span>
          ),
          empty: { title: known ? `Nothing uses ${item}` : `${item} is not on any EBOM`, body: known ? "No EBOM, MBOM or sales kit holds this item, so it can be obsoleted or replaced without a BOM change." : "Enter a material number from the list." },
        }}
        bulkActions={(ids) => (
          <>
            <Button size="sm" variant="outline" onClick={() => nav(`/engineering/change-requests/new?affected=ebom:${all.find((n) => ids.includes(key(n)) && n.kind === "EBOM")?.recordId ?? ""}`)} disabled={!all.some((n) => ids.includes(key(n)) && n.kind === "EBOM")}>Raise ECR on selected EBOM</Button>
            <Button size="sm" variant="outline" onClick={() => setMass(true)}>Mass replace…</Button>
          </>
        )}
        panel={{
          open: !!sel, onOpenChange: (o) => !o && setActive(undefined), title: sel ? `${sel.kind} ${sel.recordId}` : "", description: sel ? `Level ${sel.level}, line ${sel.line}` : undefined,
          content: sel && (
            <div className="flex flex-col gap-3 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <KV k="Status"><StatusBadge kind={sel.kind === "MBOM" ? "mbom" : "ebom"} status={sel.status} size="sm" /></KV>
                <KV k="Revision">{sel.rev}</KV>
                <KV k="Parent item"><span className="font-mono">{sel.parentItemId}</span></KV>
                <KV k="Qty per parent">{sel.qty} {sel.uom}</KV>
              </dl>
              <p>Path: <span className="font-mono">{item}</span>{sel.path.map((p) => <span key={p}> › <span className="font-mono">{p}</span></span>)}</p>
              {!sel.active && <p className="text-muted-foreground">This record is {sel.status}: historical only. It does not block obsolescence.</p>}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm"><Link to={routeOf(sel)}>Open {sel.recordId}</Link></Button>
                {sel.kind !== "MBOM" && <Button asChild size="sm" variant="outline"><Link to={`/engineering/compare-revisions?ebom=${sel.recordId}`}>Compare revisions</Link></Button>}
                <Button size="sm" variant="ghost" onClick={() => { setDraft(sel.parentItemId); go(sel.parentItemId) }}>Where is {sel.parentItemId} used?</Button>
              </div>
            </div>
          ),
        }}
      />
      <section aria-label="Item" className="rounded-lg border p-4 text-sm">
        <h2 className="mb-2 font-semibold">{item}</h2>
        <p className="text-muted-foreground">{info.description}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          {isKitId(item) ? <Chip kind="design" note="Sales kit header (type KIT), non-stocked">Kit header</Chip> : <StatusBadge kind="material" status={info.status} size="sm" />}
          {info.placeholder && <Chip kind="flag">Placeholder</Chip>}
          {info.blocks.map((b) => <Chip key={b.block} kind="block" note={b.reason}>{b.block}</Chip>)}
          {(info.status === "Obsolete" || info.status === "Restricted") && activeRows.length > 0 && <Chip kind="flag" note="Obsolescence sweep: active BOMs still use this item">Active usage on a {info.status} item</Chip>}
          <Link className="text-link underline" to={`/inventory/items/${item}`}>Open in Materials</Link>
        </p>
      </section>
      <NoPostings />
      <RulesPanel rules={[
        ["Where-Used", "For any component: all EBOMs/MBOMs using it, with revision and status; mandatory pre-check surface for ECR impact analysis", "DOC:p.61 §3.3"],
        ["Where-Used Explosion", "Full multi-level where-used for any item (audit and obsolescence tool)", "DOC:p.67 §7"],
        ["Kit membership", "Where used from any component lists its kit memberships", "DOC:p.256 §6.1"],
        ["C-15", "Mass replace from here creates an ECO; it is never silent", "DOC:p.61 §3.3"],
      ]} />
      {mass && <MassReplaceDialog key={item} open onOpenChange={setMass} initialFrom={item as MaterialId} />}
    </ScreenFrame>
  )
}
