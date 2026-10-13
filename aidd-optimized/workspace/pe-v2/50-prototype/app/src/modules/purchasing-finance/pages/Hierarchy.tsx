// FX-CO-HIERARCHY Hierarchy tree editor (/controlling/hierarchy) and FX-CO-ALT Alternate CC and PC reporting hierarchies
// (/controlling/alternate-hierarchies); source Book I H §2 [DOC:p.111]: "tree editor with drag-move (effective-dated moves;
// history preserved for comparative reporting), where-used check before deactivation (open WOs, budget lines, allocation cycles,
// WC links), and alternate hierarchies (reporting-only groupings) in Phase 2". Summary nodes are not postable (V-CO-01), so only a
// summary node takes children. Hierarchy changes are the Controller's [DOC:p.115 §6]. Routes and archetype are design values.
import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, GripVertical, MoveRight, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState, KV, StatusBadge } from "@/components/patterns"
import { PROFIT_CENTERS, TODAY, OPEN_PERIOD } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { allCenters } from "../data/centers"
import { parentAsOf, whereUsedCc } from "../data/xlogic"
import { addAltGroup, assignToAltGroup, cancelScheduledMove, createAlt, deactivateCostCenter, deleteAlt, deleteAltGroup, moveCostCenter, removeFromAltGroup } from "../data/xactions"
import type { AltHierarchy } from "../data/xtypes"
import { CsvButton, Design, Reading, report, Section } from "../components/common"
import { RecLink, SelectField, TextField, userName } from "../components/bits"
import { StateGate, useNineStates, writeProps } from "../components/states"
import { cn } from "@/lib/utils"

const PERIODS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]

interface Node {
  id: string
  name: string
  postable: boolean
  status: "Active" | "Blocked" | "Inactive"
  managerId?: string
  parentId?: string
  children: Node[]
  own: number
  rollup: number
}

export function HierarchyEditor() {
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-CO-HIERARCHY", { writers: "the Controller", degraded: "Posted amounts are from the ledger feed, which answered slowly: rollups may miss the last hour.", validation: ["Choose a summary node as the new parent (V-CO-01).", "The effective date cannot be before the open period."] })
  const [asOf, setAsOf] = useState(TODAY)
  const [period, setPeriod] = useState("2026-09")
  const [open, setOpen] = useState<string[]>(["CC-1000", "CC-9000"])
  const [sel, setSel] = useState<string>("CC-1100")
  const [dlg, setDlg] = useState<null | { move: string; to?: string } | { deact: string }>(null)
  const [mv, setMv] = useState({ to: "", eff: TODAY, reason: "" })
  const [dr, setDr] = useState({ eff: TODAY, reason: "" })
  const [drag, setDrag] = useState<string | null>(null)
  const viewing = asOf !== TODAY

  const centers = allCenters(s)
  const tree = useMemo(() => {
    const own = (id: string) => s.journal.filter((j) => j.costCenterId === id && j.period === period).reduce((t, j) => t + j.amount, 0)
    const base = centers.map((c) => ({ ...c, parentId: parentAsOf(s, "cost", c.id, c.parentId, asOf) }))
    const mk = (parent?: string): Node[] =>
      base
        .filter((c) => c.parentId === parent)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) => {
          const children = mk(c.id)
          const o = own(c.id)
          return { id: c.id, name: c.name, postable: c.postable, status: c.status, managerId: c.managerId, parentId: c.parentId, children, own: o, rollup: o + children.reduce((t, x) => t + x.rollup, 0) }
        })
    return mk(undefined)
  }, [s, centers, asOf, period])
  const flat = useMemo(() => {
    const out: Node[] = []
    const walk = (n: Node[]) => n.forEach((x) => { out.push(x); walk(x.children) })
    walk(tree)
    return out
  }, [tree])
  const summaries = flat.filter((n) => !n.postable && n.status !== "Inactive")
  const node = flat.find((n) => n.id === sel)
  const wu = node ? whereUsedCc(s, node.id) : undefined
  const canEdit = !viewing && !st.blockReason

  const startMove = (id: string, to?: string) => { setMv({ to: to ?? "", eff: TODAY, reason: "" }); setDlg({ move: id, to }) }

  const row = (n: Node, depth: number): React.ReactNode => {
    const isOpen = open.includes(n.id)
    return (
      <li key={n.id} role="treeitem" aria-expanded={n.children.length ? isOpen : undefined} aria-selected={sel === n.id}>
        <div
          className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-sm", sel === n.id && "bg-secondary", drag && !n.postable && drag !== n.id && "outline-dashed outline-1 outline-border")}
          style={{ paddingLeft: 8 + depth * 20 }}
          draggable={canEdit}
          onDragStart={(e) => { setDrag(n.id); e.dataTransfer.setData("text/plain", n.id) }}
          onDragEnd={() => setDrag(null)}
          onDragOver={(e) => { if (drag && !n.postable) e.preventDefault() }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setDrag(null); if (id && id !== n.id) startMove(id, n.id) }}
        >
          {n.children.length ? (
            <Button variant="ghost" size="sm" className="size-6 p-0" aria-label={`${isOpen ? "Collapse" : "Expand"} ${n.id}`} onClick={() => setOpen(isOpen ? open.filter((x) => x !== n.id) : [...open, n.id])}>
              {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
            </Button>
          ) : (
            <span className="inline-block size-6" />
          )}
          {canEdit && <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />}
          <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setSel(n.id)}>
            <span className="font-mono">{n.id}</span>
            <span>{n.name}</span>
            {!n.postable && <Chip kind="design" note="Summary node: not postable (V-CO-01)">Summary</Chip>}
            {n.status !== "Active" && <StatusBadge kind="costCenter" status={n.status} size="sm" />}
          </button>
          <span className="tabular w-28 text-right text-muted-foreground" title={`Rollup of ${period}`}>{fmtMoney(n.rollup)}</span>
          <Button variant="ghost" size="sm" aria-label={`Move ${n.id}`} disabled={!canEdit} title={st.blockReason ?? (viewing ? "Return to today's structure to edit" : undefined)} onClick={() => startMove(n.id)}>
            <MoveRight aria-hidden="true" />
          </Button>
        </div>
        {n.children.length > 0 && isOpen && <ul role="group">{n.children.map((c) => row(c, depth + 1))}</ul>}
      </li>
    )
  }

  const moves = [...s.hierarchyMoves].sort((a, b) => b.effective.localeCompare(a.effective))
  const target = dlg && "move" in dlg ? flat.find((n) => n.id === dlg.move) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-CO-HIERARCHY",
          title: "Hierarchy tree editor",
          description: "Move a cost center by dragging it onto a summary node, or with the move button. Moves are effective-dated and the history stays for comparative reporting.",
          chips: (
            <>
              <Design note="Route and archetype are design values; the editor is Book I H §2" />
              {viewing && <Chip kind="flag" note="Structure as of a date other than today is read-only">Viewing {fmtDate(asOf)}: read-only</Chip>}
            </>
          ),
          actions: (
            <>
              {st.menu}
              <CsvButton filename="cost-center-hierarchy.csv" rows={flat.map((n) => ({ Id: n.id, Name: n.name, Parent: n.parentId, Postable: n.postable ? "yes" : "no", Status: n.status, AsOf: asOf }))} />
            </>
          ),
          children: st.banner,
        }}
        summary={
          <>
            <KV k="As of"><TextField id="h-asof" type="date" label="" value={asOf} onChange={(v) => setAsOf(v || TODAY)} /></KV>
            <KV k="Rollup period"><SelectField id="h-period" label="" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} /></KV>
            <KV k="Nodes">{flat.length} cost centers, {summaries.length} summary nodes</KV>
            <KV k="Scheduled moves">{s.hierarchyMoves.filter((m) => m.effective > TODAY).length}</KV>
          </>
        }
        tabs={[
          {
            id: "tree",
            label: "Cost centers",
            count: flat.length,
            content: (
              <StateGate st={st} cols={4} emptyTitle="No cost centers" emptyBody="The cost center master is empty.">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    <div className="flex justify-end px-2 pb-1 text-xs text-muted-foreground"><span className="w-28 text-right">Actual {period} (rollup)</span><span className="w-10" /></div>
                    <ul role="tree" aria-label="Cost center hierarchy" className="flex flex-col">{tree.map((n) => row(n, 0))}</ul>
                    <p className="mt-2 text-xs text-muted-foreground">Drag a center onto a summary node to move it; keyboard and touch users use the move button. {canEdit ? "" : st.blockReason ?? "Editing is off while you view another date."}</p>
                  </div>
                  <Section title={node ? `${node.id} ${node.name}` : "Select a node"}>
                    {node && wu ? (
                      <div className="flex flex-col gap-2 text-sm">
                        <dl className="grid grid-cols-2 gap-2">
                          <KV k="Manager">{userName(node.managerId)}</KV>
                          <KV k="Status"><StatusBadge kind="costCenter" status={node.status} size="sm" /></KV>
                          <KV k="Actual (own)">{fmtMoney(node.own)}</KV>
                          <KV k="Rollup">{fmtMoney(node.rollup)}</KV>
                        </dl>
                        <p className="font-medium">Where-used before deactivation</p>
                        <ul className="list-disc pl-5">
                          <li>Open production orders: {wu.openWos.length}{wu.openWos.length ? ` (${wu.openWos.slice(0, 3).join(", ")})` : ""}</li>
                          <li>Work center links: {wu.wcs.length}{wu.wcs.length ? ` (${wu.wcs.join(", ")})` : ""}</li>
                          <li>Allocation cycles: {wu.cycles.length}{wu.cycles.length ? ` (${wu.cycles.join(", ")})` : ""}</li>
                          <li>Budget lines (FY2026 on): {wu.budgets}</li>
                        </ul>
                        <Button variant="outline" disabled={!canEdit || node.status === "Inactive" || !node.postable} title={!node.postable ? "A summary node is retired by moving its children first" : st.blockReason ?? undefined} onClick={() => { setDr({ eff: TODAY, reason: "" }); setDlg({ deact: node.id }) }}>
                          Deactivate
                        </Button>
                        <p className="text-xs text-muted-foreground">Deactivation proceeds only when nothing blocks it <Reading id="OQ-PF-30" />.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Choose a cost center to see where it is used.</p>
                    )}
                  </Section>
                </div>
              </StateGate>
            ),
          },
          {
            id: "profit",
            label: "Profit centers",
            count: PROFIT_CENTERS.length + s.addedProfitCenters.length,
            content: (
              <div className="flex flex-col gap-3">
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Profit center</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...PROFIT_CENTERS, ...s.addedProfitCenters].map((p) => (
                      <TableRow key={p.id} className="h-8 text-[13px]">
                        <TableCell><RecLink to={`/controlling/profit-centers/${p.id}`}>{p.id}</RecLink> {p.name}</TableCell>
                        <TableCell>{p.scope}</TableCell>
                        <TableCell><StatusBadge kind="costCenter" status={p.status} size="sm" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-sm text-muted-foreground">The profit centers form one flat set (the CFO defines it; every P&L posting carries exactly one). Groupings for reporting are kept as <RecLink to="/controlling/alternate-hierarchies">alternate hierarchies</RecLink>.</p>
              </div>
            ),
          },
          {
            id: "history",
            label: "Move history",
            count: moves.length,
            content: moves.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Move</TableHead>
                    <TableHead>Center</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moves.map((m) => (
                    <TableRow key={m.id} className="h-8 text-[13px]">
                      <TableCell className="font-mono">{m.id}</TableCell>
                      <TableCell>{m.nodeId}</TableCell>
                      <TableCell>{m.fromParent ?? "Top level"}</TableCell>
                      <TableCell>{m.toParent ?? "Top level"}</TableCell>
                      <TableCell>{fmtDate(m.effective)} {m.effective > TODAY && <Chip kind="flag">Scheduled</Chip>}</TableCell>
                      <TableCell>{userName(m.by)} · {fmtDate(m.on)}</TableCell>
                      <TableCell>{m.reason}</TableCell>
                      <TableCell>{m.effective > TODAY && <Button size="sm" variant="ghost" {...writeProps(st)} onClick={() => report(cancelScheduledMove(m.id), "Scheduled move cancelled")}>Cancel</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No moves yet">A move appears here with its effective date, who made it and why.</EmptyState>
            ),
          },
        ]}
        aside={<p className="text-xs text-muted-foreground">Hierarchy changes are the Controller's (Part H role table). Effective dates start at the open period {OPEN_PERIOD} <Reading id="OQ-PF-32" />.</p>}
      />
      <DialogShell
        open={!!dlg && "move" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        requireReason
        title={target ? `Move ${target.id} ${target.name}` : "Move"}
        confirmLabel={mv.eff > TODAY ? "Schedule move" : "Move"}
        consequence={`Moves the center under the chosen summary node from the effective date. Postings keep their original structure for comparative reporting; reports from the effective date use the new one.${mv.eff > TODAY ? " The move is scheduled: today's tree does not change." : ""}`}
        onConfirm={(r) => (dlg && "move" in dlg ? st.guard() ?? report(moveCostCenter(dlg.move, (mv.to || undefined) as string | undefined, mv.eff, r), (x) => (x.scheduled ? `${x.id} scheduled` : `${x.id} applied`)) : null)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="mv-to" label="New parent (summary node)" value={mv.to} onChange={(v) => setMv({ ...mv, to: v })} options={[{ value: "", label: "Top level (no parent)" }, ...summaries.filter((n) => n.id !== target?.id).map((n) => ({ value: n.id, label: `${n.id} ${n.name}` }))]} hint="Only a summary node takes children (V-CO-01)." />
          <TextField id="mv-eff" type="date" label="Effective from" value={mv.eff} onChange={(v) => setMv({ ...mv, eff: v })} />
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: a postable parent, a cycle, or a date before the open period is refused.</p>}
      </DialogShell>
      <DialogShell
        open={!!dlg && "deact" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        requireReason
        destructive
        title={dlg && "deact" in dlg ? `Deactivate ${dlg.deact}` : "Deactivate"}
        confirmLabel="Deactivate"
        consequence="Retires the cost center from the effective date: it is never deleted, history stays. The where-used check must be clear. Controller only."
        onConfirm={(r) => (dlg && "deact" in dlg ? st.guard() ?? report(deactivateCostCenter(dlg.deact, dr.eff, r), "Cost center deactivated") : null)}
      >
        <TextField id="dc-eff" type="date" label="Effective from" value={dr.eff} onChange={(v) => setDr({ ...dr, eff: v })} />
      </DialogShell>
    </>
  )
}

// =============================================================== alternate hierarchies
export function AlternateHierarchies() {
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-CO-ALT", { writers: "the Controlling analyst or Controller", degraded: "Posted amounts are from the ledger feed, which answered slowly: rollups may miss the last hour.", validation: ["Name the group.", "Choose a postable cost center or a profit center."] })
  const [period, setPeriod] = useState("2026-09")
  const [dlg, setDlg] = useState<null | "create-cost" | "create-profit" | { group: string } | { assign: { alt: string; group: string } } | { del: string }>(null)
  const [f, setF] = useState({ name: "", purpose: "", member: "" })
  const centers = allCenters(s)
  const amountOf = (alt: AltHierarchy, ids: string[]) =>
    s.journal.filter((j) => j.period === period && ids.includes((alt.kind === "cost" ? j.costCenterId : j.profitCenterId) ?? "")).reduce((t, j) => t + j.amount, 0)
  const members = (alt: AltHierarchy) => (alt.kind === "cost" ? centers.filter((c) => c.postable && c.status !== "Inactive").map((c) => ({ id: c.id as string, name: c.name })) : [...PROFIT_CENTERS, ...s.addedProfitCenters].map((p) => ({ id: p.id as string, name: p.name })))
  const nameOf = (alt: AltHierarchy, id: string) => members(alt).find((m) => m.id === id)?.name ?? id

  const card = (alt: AltHierarchy) => {
    const assigned = new Set(alt.groups.flatMap((g) => g.memberIds))
    const missing = members(alt).filter((m) => !assigned.has(m.id))
    const total = alt.groups.reduce((t, g) => t + amountOf(alt, g.memberIds), 0)
    return (
      <Section key={alt.id} title={`${alt.id} · ${alt.name}`} action={<Chip kind="design" note="Reporting only: no posting, derivation rule or allocation reads an alternate hierarchy">Reporting only</Chip>}>
        <p className="text-sm text-muted-foreground">{alt.purpose} · created {fmtDate(alt.createdOn)} by {userName(alt.createdBy)}</p>
        {alt.groups.length ? (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="text-right">Actual {period}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {alt.groups.map((g) => (
                <TableRow key={g.id} className="align-top text-[13px]">
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell>
                    <ul className="flex flex-wrap gap-1">
                      {g.memberIds.map((m) => (
                        <li key={m} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
                          {m} {nameOf(alt, m)}
                          <button aria-label={`Remove ${m} from ${g.name}`} className="text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={!!st.blockReason} title={st.blockReason ?? undefined} onClick={() => report(removeFromAltGroup(alt.id, m), `${m} removed`)}>×</button>
                        </li>
                      ))}
                      {!g.memberIds.length && <li className="text-xs text-muted-foreground">Empty</li>}
                    </ul>
                  </TableCell>
                  <TableCell className="tabular text-right">{fmtMoney(amountOf(alt, g.memberIds))}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button size="sm" variant="outline" {...writeProps(st)} onClick={() => { setF({ name: "", purpose: "", member: "" }); setDlg({ assign: { alt: alt.id, group: g.id } }) }}>Assign</Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete group ${g.name}`} {...writeProps(st)} onClick={() => report(deleteAltGroup(alt.id, g.id), "Group deleted")}><Trash2 aria-hidden="true" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted text-[13px] font-semibold">
                <TableCell>Total in groups</TableCell>
                <TableCell />
                <TableCell className="tabular text-right">{fmtMoney(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No groups yet">Add a group, then assign centers to it.</EmptyState>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" {...writeProps(st)} onClick={() => { setF({ name: "", purpose: "", member: "" }); setDlg({ group: alt.id }) }}><Plus aria-hidden="true" /> Add group</Button>
          <Button size="sm" variant="ghost" {...writeProps(st)} onClick={() => setDlg({ del: alt.id })}>Delete hierarchy</Button>
          {missing.length > 0 ? <span className="text-xs text-muted-foreground">Not in any group ({missing.length}): {missing.slice(0, 6).map((m) => m.id).join(", ")}{missing.length > 6 ? "..." : ""}. They are left out of this view's totals.</span> : <span className="text-xs text-muted-foreground">Every {alt.kind === "cost" ? "postable cost center" : "profit center"} is in a group.</span>}
        </div>
      </Section>
    )
  }
  const tabFor = (kind: "cost" | "profit") => {
    const list = s.altHierarchies.filter((a) => a.kind === kind)
    return (
      <StateGate st={st} cols={4} emptyTitle="No alternate hierarchies" emptyBody="Define a grouping for a report; it never changes the standard hierarchy.">
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-2">
            <div className="w-40"><SelectField id={`alt-p-${kind}`} label="Rollup period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} /></div>
            <Button variant="outline" {...writeProps(st)} onClick={() => { setF({ name: "", purpose: "", member: "" }); setDlg(kind === "cost" ? "create-cost" : "create-profit") }}><Plus aria-hidden="true" /> New alternate hierarchy</Button>
          </div>
          {list.length ? list.map(card) : <EmptyState title={`No alternate ${kind === "cost" ? "cost center" : "profit center"} hierarchy`}>Create one to group centers for a report.</EmptyState>}
        </div>
      </StateGate>
    )
  }
  const grp = dlg && typeof dlg === "object" && "assign" in dlg ? dlg.assign : undefined
  const grpAlt = grp ? s.altHierarchies.find((a) => a.id === grp.alt) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-CO-ALT",
          title: "Alternate reporting hierarchies",
          description: "Reporting-only groupings of cost centers and profit centers. They never change postings, derivation or allocations.",
          chips: <Design note="Phase 2 in the specification; route and archetype are design values">Phase 2</Design>,
          actions: st.menu,
          children: st.banner,
        }}
        tabs={[
          { id: "cost", label: "Cost center groupings", count: s.altHierarchies.filter((a) => a.kind === "cost").length, content: tabFor("cost") },
          { id: "profit", label: "Profit center groupings", count: s.altHierarchies.filter((a) => a.kind === "profit").length, content: tabFor("profit") },
        ]}
      />
      <DialogShell
        open={dlg === "create-cost" || dlg === "create-profit"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="New alternate hierarchy"
        confirmLabel="Create"
        consequence="Creates an empty reporting hierarchy. Nothing posts and the standard hierarchy does not change."
        onConfirm={() => st.guard() ?? report(createAlt(dlg === "create-profit" ? "profit" : "cost", f.name, f.purpose), (id) => `${id} created`)}
      >
        <TextField id="al-n" label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} />
        <TextField id="al-p" label="Purpose" value={f.purpose} onChange={(v) => setF({ ...f, purpose: v })} />
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: a name that already exists is refused.</p>}
      </DialogShell>
      <DialogShell
        open={!!dlg && typeof dlg === "object" && "group" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Add a group"
        confirmLabel="Add group"
        consequence="Adds an empty group to this hierarchy."
        onConfirm={() => (dlg && typeof dlg === "object" && "group" in dlg ? st.guard() ?? report(addAltGroup(dlg.group, f.name), "Group added") : null)}
      >
        <TextField id="ag-n" label="Group name" value={f.name} onChange={(v) => setF({ ...f, name: v })} />
      </DialogShell>
      <DialogShell
        open={!!grp}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Assign a center to the group"
        confirmLabel="Assign"
        consequence="A center sits in one group per hierarchy: assigning it here removes it from its other group."
        onConfirm={() => (grp ? st.guard() ?? report(assignToAltGroup(grp.alt, grp.group, f.member), "Assigned") : null)}
      >
        {grpAlt && <SelectField id="as-m" label={grpAlt.kind === "cost" ? "Postable cost center" : "Profit center"} value={f.member} onChange={(v) => setF({ ...f, member: v })} options={members(grpAlt).map((m) => ({ value: m.id, label: `${m.id} ${m.name}` }))} />}
      </DialogShell>
      <DialogShell
        open={!!dlg && typeof dlg === "object" && "del" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        destructive
        title="Delete the alternate hierarchy"
        confirmLabel="Delete"
        consequence="Removes this reporting grouping. Reports that used it fall back to the standard hierarchy. Controller only."
        onConfirm={() => (dlg && typeof dlg === "object" && "del" in dlg ? st.guard() ?? report(deleteAlt(dlg.del), "Hierarchy deleted") : null)}
      />
    </>
  )
}
