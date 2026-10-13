// TRC-EXPL Trace Explorer [DOC:p.274 Book VI; Book I F §5; Book IV §4.4] (asserted).
// Input accepts a serial, a batch or a heat number. The tree renders both directions (five levels,
// reading QT-R12) with evidence drill per node from the append-only, hash-chained event store
// (C-53). Actions: trace forward, trace backward, export dossier, feed a recall population; a
// correction is a reversal + replacement pair, never an edit. Postings and scans: none.

import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { ChevronDown, ChevronRight, Download, Search, Siren } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { TRACE_EVENTS, type BatchId, type SerialNo } from "@/data/domain"
import { useSlice } from "@/store"
import { cn } from "@/lib/utils"
import { traceOps } from "../data/actions"
import { effectiveState, verifyChain } from "../data/chain"
import { backward, countNodes, eventsFor, forward, resolveInput, treeDeviations, MAX_DEPTH, type TraceNode } from "../data/trace"
import type { QtEvent } from "../data/types"
import { DocLinkText, Reading, TextField, report, useDataState, userName } from "../components/bits"

export const TRC_RULES: [string, string, string][] = [
  ["TRC-1", "Genealogy is append-only and hash-chained per object; nothing is updated or deleted. A correction is a reversal event plus a replacement event referencing the original (C-53).", "DOC:p.212 §4.2-4.3"],
  ["TRC-2", "Thirteen event types T01..T13 are captured at the scan points and transactions; every capture lands in one store.", "DOC:pp.95-96 Part F; p.212 §4"],
  ["TRC-3", "Backward trace answers what went into a unit (as built); forward trace answers where a batch went (where used) and feeds the recall population.", "DOC:p.274 TRC-EXPL; Book IV §4.4"],
  ["TRC-4", "The dossier export packages the tree with every event's evidence and certificate references.", "DOC:p.274 TRC-EXPL"],
]

type Dir = "backward" | "forward"
interface Row {
  node: TraceNode
  /** Unique path key: the same batch can sit under several serials at one depth. */
  path: string
  parents: string[]
  hasKids: boolean
}
const KIND: Record<TraceNode["kind"], string> = { serial: "Serial", batch: "Batch", grn: "Goods receipt", purchaseOrder: "Purchase order", productionOrder: "Production order", delivery: "Shipment", site: "Customer site" }

function rowsOf(n: TraceNode, parents: string[] = []): Row[] {
  const path = [...parents, n.key].join(">")
  return [{ node: n, path, parents, hasKids: n.children.length > 0 }, ...n.children.flatMap((c) => rowsOf(c, [...parents, path]))]
}

export function TraceExplorer() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("TRC-EXPL")
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get("q") ?? ""
  const dir = (params.get("dir") as Dir) ?? "backward"
  const [input, setInput] = useState(q)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<Row | null>(null)
  const set = (k: string, v: string) => (params.set(k, v), setParams(params, { replace: true }))
  const root = useMemo(() => (q ? resolveInput(s, q) : null), [s, q])
  const tree = useMemo(() => (root ? (dir === "backward" ? backward(s, root) : forward(s, root)) : null), [s, root, dir])
  const all = tree ? rowsOf(tree) : []
  const rows = all.filter((r) => !r.parents.some((p) => collapsed.has(p)))
  const bad = useMemo(() => verifyChain(s.genealogy), [s.genealogy])
  const devs = useMemo(() => (tree ? treeDeviations(s, tree) : []), [s, tree])
  const evCount = tree ? new Set(all.flatMap((r) => eventsFor(s, r.node.id).map((e) => e.id))).size : 0
  const toggle = (k: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n })

  const cols: Column<Row>[] = [
    {
      id: "node", header: "Node", value: (r) => r.node.id,
      cell: (r) => (
        <span className="flex items-center gap-1" style={{ paddingLeft: `${r.node.depth * 20}px` }}>
          {r.hasKids ? (
            <button aria-label={collapsed.has(r.path) ? `Expand ${r.node.id}` : `Collapse ${r.node.id}`} aria-expanded={!collapsed.has(r.path)} className="rounded-sm p-1 hover:bg-accent" onClick={(e) => (e.stopPropagation(), toggle(r.path))}>
              {collapsed.has(r.path) ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            </button>
          ) : (
            <span className="inline-block w-6" />
          )}
          <span className="text-xs text-muted-foreground">{KIND[r.node.kind]}</span>
          <span className={cn("tabular font-medium", r.node.removed && "line-through")}>{r.node.doc ? <DocLinkText r={r.node.doc} label={r.node.label} /> : r.node.label}</span>
        </span>
      ),
    },
    { id: "sub", header: "Detail", value: (r) => r.node.sub ?? "", cell: (r) => <span className="text-muted-foreground">{r.node.sub}</span> },
    { id: "status", header: "Status", value: (r) => r.node.status?.value ?? "", cell: (r) => (r.node.status ? <StatusBadge kind={r.node.status.kind} status={r.node.status.value} size="sm" /> : null) },
    { id: "note", header: "Link", value: (r) => r.node.note ?? "", cell: (r) => <span className="text-xs">{r.node.removed && <Chip kind="change">Removed</Chip>} {r.node.note} {r.node.deviations?.map((d) => <Chip key={d} kind="flag" note="Deviation applies to this record">{d}</Chip>)}</span> },
    { id: "ev", header: "Events", value: (r) => eventsFor(s, r.node.id).length, align: "right", mono: true },
    { id: "lvl", header: "Level", value: (r) => r.node.depth + 1, align: "right", mono: true },
  ]

  return (
    <>
      <WorkbenchPage
        header={{
          title: "Trace Explorer",
          screenId: "TRC-EXPL",
          description: "Serial, batch or heat number in; the as-built tree (backward) or the where-used tree (forward) out, with the evidence behind every link.",
          chips: <><Reading id="QT-R12" /><Reading id="QT-R14" /></>,
          primary: (
            <Button disabled={!root} onClick={() => root && report(traceOps.dossier(root.id, dir, evCount, all.length), (id) => `Dossier ${id} exported (${all.length} nodes, ${evCount} events)`)}>
              <Download aria-hidden="true" /> Export dossier
            </Button>
          ),
          actions: (
            <Button variant="outline" disabled={!root} onClick={() => root && nav(`/quality/recalls?new=${root.id}`)}>
              <Siren aria-hidden="true" /> Feed a recall
            </Button>
          ),
          children: (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setCollapsed(new Set())
                set("q", input.trim())
              }}
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="trace-q" className="text-sm font-medium">Serial, batch or heat number</label>
                <Input id="trace-q" className="w-72" value={input} onChange={(e) => setInput(e.target.value)} placeholder="SN-TBD-20M-0301, BAT-TBD-B0301, HP-26-0412" />
              </div>
              <Button type="submit" variant="outline">
                <Search aria-hidden="true" /> Trace
              </Button>
              {["SN-TBD-20M-0301", "BAT-TBD-B0301", "HP-26-0412"].map((x) => (
                <Button key={x} type="button" variant="ghost" size="sm" onClick={() => (setInput(x), set("q", x))}>
                  {x}
                </Button>
              ))}
            </form>
          ),
        }}
        kpis={
          root
            ? [
                { label: "Root", value: root.id, hint: root.via ? `matched by ${root.via}` : root.type },
                { label: "Nodes", value: tree ? countNodes(tree) : 0, hint: `max ${MAX_DEPTH} levels` },
                { label: "Events behind the tree", value: evCount },
                { label: "Deviations disclosed", value: devs.length, hint: devs.length ? devs.map((d) => d.id).join(", ") : "none apply" },
                { label: "Hash chain", value: bad.length ? `${bad.length} broken` : "Verified", hint: `${s.genealogy.length} events in the store` },
              ]
            : undefined
        }
        queues={[
          { id: "backward", label: "Trace backward (as built)" },
          { id: "forward", label: "Trace forward (where used)" },
        ]}
        queue={dir}
        onQueueChange={(v) => set("dir", v)}
        table={{
          rows: ds.empty ? [] : rows,
          columns: cols,
          rowId: (r) => r.path,
          onRowClick: (r) => setActive(r),
          activeId: active?.path,
          loading: ds.loading,
          error: ds.error,
          onRetry: ds.retry,
          empty: q && !root ? { title: `Nothing traced for ${q}`, body: "No serial, batch, vendor batch or heat number matches. Check the label or scan it again." } : { title: "Enter a serial, batch or heat number", body: "Try the hero unit SN-TBD-20M-0301 or the suspect bushing batch BAT-TBD-B0301." },
        }}
        bulkActions={(ids, clear) => {
          const picked = all.filter((r) => ids.includes(r.path) && (r.node.kind === "batch" || r.node.kind === "serial")).map((r) => r.node.id)
          return (
            <Button size="sm" variant="outline" disabled={!picked.length} onClick={() => (nav(`/quality/recalls?new=${picked.join(",")}`), clear())}>
              Feed {picked.length} to a recall
            </Button>
          )
        }}
        panel={{
          open: !!active,
          onOpenChange: (o) => !o && setActive(null),
          title: active ? `${KIND[active.node.kind]} ${active.node.id}` : "",
          description: active?.node.sub,
          content: active ? <Evidence id={active.node.id} events={eventsFor(s, active.node.id)} log={s.genealogy} bad={bad} /> : null,
        }}
      />
      {devs.length > 0 && (
        <section aria-label="Deviations disclosed" className="mt-4 rounded-lg border border-status-exception p-4">
          <h2 className="mb-2 text-sm font-semibold">Deviations disclosed on this {dir === "backward" ? "as-built record" : "where-used record"}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {devs.map((d) => (
              <li key={d.id}>
                <DocLinkText r={{ type: "deviation", id: d.id }} /> · {d.type} · {d.characteristic}: {d.acceptedValue} accepted against {d.specValue} · {d.state}
                {d.validUntil ? `, valid until ${d.validUntil}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">The exported dossier lists these with the as-built record [DOC:p.215 Book IV §7.3].</p>
        </section>
      )}
      {s.dossiers.length > 0 && (
        <section aria-label="Exported dossiers" className="mt-4 rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-semibold">Exported dossiers</h2>
          <ul className="text-sm">
            {s.dossiers.map((d) => (
              <li key={d.id}>
                <span className="tabular">{d.id}</span> · {d.direction} trace of {d.root} · {d.nodes} nodes, {d.events} events · {d.createdOn} by {userName(d.by)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {ds.error && <ErrorAlert title="Trace service">{ds.error}</ErrorAlert>}
      <div className="mt-4">
        <RulesPanel rules={TRC_RULES} />
      </div>
    </>
  )
}

function Evidence({ id, events, log, bad }: { id: string; events: QtEvent[]; log: QtEvent[]; bad: string[] }) {
  const [fix, setFix] = useState<QtEvent | null>(null)
  const [batch, setBatch] = useState("")
  const [serial, setSerial] = useState("")
  const [qty, setQty] = useState("")
  if (!events.length) return <EmptyState title="No events for this node">Documents such as POs and customer sites carry no genealogy events of their own.</EmptyState>
  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => {
            const st = effectiveState(log, e)
            return (
              <TableRow key={e.id}>
                <TableCell>
                  <span className="font-medium">{e.type}</span> <span className="text-xs text-muted-foreground">{TRACE_EVENTS[e.type].name}</span>
                  <div className="text-xs text-muted-foreground">{e.id}{e.scanPoint ? ` · ${e.scanPoint}` : ""}</div>
                </TableCell>
                <TableCell className="tabular text-xs">{e.at.replace("T", " ")}</TableCell>
                <TableCell className="text-xs">
                  <DocLinkText r={e.doc} /> · {e.evidence}
                  {e.qty != null && ` · qty ${e.qty}`}
                  {e.refersTo && ` · refers to ${e.refersTo}`}
                  {e.userId && ` · ${userName(e.userId)}`}
                </TableCell>
                <TableCell>
                  {st === "Active" ? "Active" : <Chip kind="change">{st}</Chip>}
                  {st === "Active" && (
                    <Button size="sm" variant="ghost" onClick={() => (setFix(e), setBatch(e.batch ?? ""), setSerial(e.serial ?? ""), setQty(e.qty?.toString() ?? ""))}>
                      Correct
                    </Button>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {e.prevHash.slice(0, 6)} → {e.hash.slice(0, 6)}
                  {bad.includes(e.id) && <Chip kind="flag">Broken</Chip>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">{events.length} events for {id}; chain links shown as previous → own hash.</p>
      <DialogShell
        open={!!fix}
        onOpenChange={(o) => !o && setFix(null)}
        title={`Correction pair for ${fix?.id}`}
        description="The original event stays in the store. A reversal and a replacement event are appended, both referencing it (C-53)."
        consequence={`Appends a reversal of ${fix?.id} and a replacement ${fix?.type} event${batch !== fix?.batch ? ` with batch ${batch}` : ""}${serial !== fix?.serial ? ` with serial ${serial}` : ""}. The hash chain continues; an open Unresolved correction exception for this object is resolved.`}
        confirmLabel="Append correction pair"
        requireReason
        reasonLabel="Reason for the correction (required)"
        onConfirm={(reason) => {
          if (!fix) return null
          const r = traceOps.correct(fix.id, { batch: (batch || undefined) as BatchId | undefined, serial: (serial || undefined) as SerialNo | undefined, qty: qty ? Number(qty) : undefined, evidence: reason })
          return report(r, (rid) => `Replacement ${rid} appended`) ? null : (r as { error: string }).error
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField id="cx-batch" label="Batch" value={batch} onChange={setBatch} />
          <TextField id="cx-serial" label="Serial" value={serial} onChange={setSerial} />
          <TextField id="cx-qty" label="Quantity" type="number" value={qty} onChange={setQty} />
        </div>
      </DialogShell>
    </div>
  )
}
