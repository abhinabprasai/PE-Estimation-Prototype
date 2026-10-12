// ENG-HOME-001 Engineering Workspace (Workbench) [DOC:p.58 §1; p.255] (asserted). Panels for my design
// queue, open changes with aging, awaiting my approval, the last 20 released BOMs and drawings, and the
// three PRD exceptions (AVL empty, drawings referenced but not Released, placeholders older than 14 days)
// plus the EBOM-ahead flag [DOC:p.66 Dev Note]. Open any queued object; approvals are decided in WF-INBOX (C-1), linked from here.

import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { WorkbenchPage } from "@/components/templates"
import type { DocRef, RecordKind } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { StatePreview, useScreenState } from "../components"
import { checklistProgress, currentRev, docStatus, ebomAhead, ecoBlockers, itemInfo, releasedRev, userName } from "../data/logic"

interface Row {
  id: string
  what: string
  title: string
  route: string
  ref?: DocRef
  status?: { kind: RecordKind; value: string }
  stage?: string
  date?: string
  note: string
  soLine?: string
  config?: string
  custApproval?: boolean
}
const ENG_APPROVALS = ["EBOM release", "Production version release", "ECR (CCB)"]
const days = (from: string) => Math.round((new Date(TODAY).getTime() - new Date(from).getTime()) / 86_400_000)
/** Placeholder aging threshold: "placeholder parts older than 14 days" [DOC:p.58 §1] (asserted). */
const AGING_DAYS = 14

export function EngineeringHome() {
  const s = useSlice("engineering")
  const core = useCore()
  const st = useScreenState("ENG-HOME-001")
  const nav = useNavigate()
  const [queue, setQueue] = useState("design")
  const [active, setActive] = useState<Row | null>(null)
  const isEM = core.role === "Engineering Manager"

  const q = useMemo(() => {
    const mine = (ids: string[]) => isEM || ids.includes(core.userId)
    const design: Row[] = [
      ...s.requests.filter((r) => r.status !== "Closed" && (mine(r.assigneeIds) || (isEM && r.status === "Open"))).map((r) => {
        const p = checklistProgress(s, r)
        return {
          id: r.id, what: "Engineering request", title: r.title, route: `/engineering/requests/${r.id}`, ref: { type: "engineeringRequest" as const, id: r.id }, status: { kind: "engineeringRequest" as const, value: r.status }, date: r.due,
          soLine: `${r.soId} / ${r.soLine}`, config: r.config.slice(0, 3).map(([, v]) => v).join(" · "), custApproval: r.customerApprovalRequired,
          note: `${p.done} of ${p.total} deliverables; design due ${fmtDate(r.due)}${r.blockedReason ? `; blocked: ${r.blockedReason}` : ""}`,
        }
      }),
      ...s.eboms.filter((e) => (e.status === "Draft" || e.status === "In Review") && mine(e.assigneeIds)).map((e) => ({ id: e.id, what: "EBOM", title: e.title, route: `/engineering/boms/${e.id}`, ref: { type: "ebom" as const, id: e.id }, status: { kind: "ebom" as const, value: e.status }, date: e.createdOn, note: `rev ${e.rev}, ${e.lines.length} lines` })),
      ...s.documents.filter((d) => currentRev(d).checkedOutBy && (isEM || currentRev(d).checkedOutBy === core.userId)).map((d) => ({ id: d.id, what: "Document", title: d.title, route: `/engineering/documents/${d.id}`, ref: { type: "document" as const, id: d.id }, status: { kind: "document" as const, value: docStatus(d) }, date: currentRev(d).checkedOutSince, note: `Checked out by ${userName(currentRev(d).checkedOutBy)}` })),
    ]
    const changes: Row[] = [
      ...s.ecrs.filter((e) => e.stage === "Draft" || e.stage === "Submitted to CCB" || e.stage === "Deferred").map((e) => ({ id: e.id, what: "ECR", title: e.title, route: `/engineering/change-requests/${e.id}`, ref: { type: "ecr" as const, id: e.id }, stage: e.stage, date: e.raisedOn, note: `${days(e.raisedOn)} days open; ${e.priority}, ${e.classification}` })),
      ...s.ecos.filter((e) => e.stage !== "Released").map((e) => ({ id: e.id, what: "ECO", title: e.title, route: `/engineering/change-orders/${e.id}`, ref: { type: "eco" as const, id: e.id }, stage: e.stage, date: e.createdOn, note: `${days(e.createdOn)} days open; ${e.tasks.filter((t) => t.done).length} of ${e.tasks.length} tasks; ${ecoBlockers(e).length} release blockers; ${e.effectivity} effectivity` })),
    ]
    const approvals: Row[] = core.approvals
      .filter((a) => !a.outcome && ENG_APPROVALS.includes(a.kind) && a.steps.find((x) => !x.decided)?.role === core.role)
      .map((a) => ({ id: a.id, what: a.kind, title: a.title, route: `/approvals?req=${a.id}`, ref: a.subject, stage: "Waiting for you", date: a.raisedOn, note: `Raised by ${a.raisedBy}; decide in WF-INBOX` }))
    const releases: Row[] = [
      ...s.eboms.filter((e) => e.releasedOn && e.status === "Released").map((e) => ({ id: e.id, what: "EBOM", title: `${e.title}, rev ${e.rev}`, route: `/engineering/boms/${e.id}`, ref: { type: "ebom" as const, id: e.id }, status: { kind: "ebom" as const, value: e.status }, date: e.releasedOn, note: `Released rev ${e.rev}` })),
      ...s.mboms.filter((m) => m.status === "Active").map((m) => ({ id: m.id, what: "MBOM", title: `${m.parentItemId} rev ${m.revision}`, route: `/engineering/mbom-transform/${m.id}`, ref: { type: "mbom" as const, id: m.id }, status: { kind: "mbom" as const, value: m.status }, date: m.releasedOn, note: `From ${m.ebomId} rev ${m.ebomRev}` })),
      ...s.documents.flatMap((d) => d.revisions.filter((r) => r.status === "Released" && r.releasedOn).map((r) => ({ id: `${d.id}#${r.rev}`, what: "Document", title: `${d.title}, rev ${r.rev}`, route: `/engineering/documents/${d.id}`, ref: { type: "document" as const, id: d.id }, status: { kind: "document" as const, value: r.status }, date: r.releasedOn, note: r.stamp ?? "" }))),
    ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 20)
    // Exceptions [DOC:p.58 §1]: AVL empty, drawings referenced but not Released, placeholders older than 14 days; plus EBOM ahead [DOC:p.66].
    const released = s.eboms.filter((e) => e.status === "Released")
    const noVendor = new Map<string, string[]>()
    for (const e of released)
      for (const l of e.lines) {
        const info = itemInfo(s, l.componentId)
        if (info.makeBuy !== "Buy" || info.placeholder) continue
        if (info.avl.some((a) => a.status === "Qualified" || a.status === "Conditional")) continue
        noVendor.set(l.componentId, [...(noVendor.get(l.componentId) ?? []), `${e.id} rev ${e.rev}`])
      }
    const unreleasedDrawings = new Map<string, string[]>()
    for (const e of s.eboms.filter((x) => x.status !== "Obsolete" && x.status !== "Superseded"))
      for (const l of e.lines) {
        if (!l.drawingId) continue
        const d = s.documents.find((x) => x.id === l.drawingId)
        if (d && releasedRev(d)) continue
        unreleasedDrawings.set(l.drawingId, [...(unreleasedDrawings.get(l.drawingId) ?? []), `${e.id} line ${l.no}`])
      }
    const exceptions: Row[] = [
      ...[...noVendor].map(([id, uses]) => ({ id, what: "AVL empty", title: itemInfo(s, id).description, route: `/engineering/boms/${uses[0].split(" ")[0]}`, ref: { type: "material" as const, id }, stage: "No qualified vendor", note: `Used in released ${uses.join(", ")}; the AVL has no Qualified or Conditional vendor` })),
      ...[...unreleasedDrawings].map(([id, uses]) => {
        const d = s.documents.find((x) => x.id === id)
        return { id, what: "Drawing not Released", title: d?.title ?? "Document not found", route: `/engineering/documents/${id}`, ref: { type: "document" as const, id }, status: d ? { kind: "document" as const, value: docStatus(d) } : undefined, stage: d ? undefined : "Missing", date: d?.createdOn, note: `Referenced by ${uses.join(", ")}` }
      }),
      ...s.placeholders.filter((p) => p.status === "Draft" && days(p.createdOn) > AGING_DAYS).map((p) => ({ id: p.id, what: "Placeholder aging", title: p.description, route: `/engineering/boms/${p.ebomId}`, ref: { type: "material" as const, id: p.id }, stage: `${days(p.createdOn)} days in Draft`, date: p.createdOn, note: `${p.ebomId} line ${p.line}; older than ${AGING_DAYS} days; owner ${userName(p.engineerId)}; blocks release until its MCR completes (V-ENG-03)` })),
      ...s.mboms.filter((m) => ebomAhead(s, m)).map((m) => ({ id: m.id, what: "EBOM ahead", title: `${m.parentItemId} MBOM rev ${m.revision}`, route: `/engineering/mbom-transform/${m.id}`, ref: { type: "mbom" as const, id: m.id }, status: { kind: "mbom" as const, value: m.status }, date: m.releasedOn, note: ebomAhead(s, m)! })),
    ]
    return { design, changes, approvals, releases, exceptions }
  }, [s, core, isEM])

  const rows = st.empty ? [] : q[queue as keyof typeof q]
  const columns: Column<Row>[] = [
    { id: "id", header: "Object", value: (r) => r.id, mono: true, sortable: true, cell: (r) => <Link className="font-mono text-link underline-offset-4 hover:underline" to={r.route}>{r.id.split("#")[0]}</Link> },
    { id: "what", header: "Type", value: (r) => r.what, filterable: true },
    { id: "title", header: "Title", value: (r) => r.title },
    { id: "date", header: queue === "releases" ? "Released" : queue === "design" ? "Due or since" : "Date", value: (r) => r.date ?? "", cell: (r) => fmtDate(r.date), sortable: true },
    ...(queue === "design"
      ? ([
          { id: "so", header: "SO line", value: (r) => r.soLine ?? "", mono: true },
          { id: "cfg", header: "Configuration", value: (r) => r.config ?? "", cell: (r) => <span className="text-sm">{r.config ?? ""}</span> },
          { id: "ca", header: "Customer approval", value: (r) => (r.custApproval == null ? "" : r.custApproval ? "Required" : "Not required"), filterable: true },
        ] as Column<Row>[])
      : []),
    ...(queue === "changes" ? ([{ id: "age", header: "Aging (days)", align: "right", value: (r) => (r.date ? days(r.date) : 0), sortable: true }] as Column<Row>[]) : []),
    { id: "note", header: "Detail", value: (r) => r.note, cell: (r) => <span className="text-sm text-muted-foreground">{r.note}</span> },
    { id: "status", header: "Status", value: (r) => r.status?.value ?? r.stage ?? "", filterable: true, cell: (r) => (r.status ? <StatusBadge kind={r.status.kind} status={r.status.value} size="sm" /> : <span className="text-sm">{r.stage}</span>) },
  ]
  const aging = s.placeholders.filter((p) => p.status === "Draft" && days(p.createdOn) > AGING_DAYS).length
  return (
    <>
      <WorkbenchPage<Row>
        header={{
          title: "Engineering workspace",
          screenId: "ENG-HOME-001",
          description: isEM ? "Everything open across the engineering team, with what waits for your approval." : `Work assigned to ${userName(core.userId)}, open changes and exceptions.`,
          primary: q.approvals.length ? <Button onClick={() => nav("/approvals")}>Decide {q.approvals.length} in WF-INBOX</Button> : <Button onClick={() => nav("/engineering/requests")}>Open engineering requests</Button>,
          actions: (
            <>
              <Button variant="outline" onClick={() => nav("/engineering/change-requests/new")}>Raise ECR</Button>
              <Button variant="ghost" onClick={() => nav("/engineering/boms")}>EBOMs</Button>
            </>
          ),
        }}
        kpis={[
          { label: "My design queue", value: q.design.length, hint: isEM ? "team-wide (Engineering Manager)" : "assigned to me" },
          { label: "Open changes", value: q.changes.length, hint: `${s.ecos.filter((e) => e.stage !== "Released").length} ECOs not yet cut over` },
          { label: "Awaiting my approval", value: q.approvals.length, hint: "decided in WF-INBOX" },
          { label: "Exceptions", value: q.exceptions.length, hint: `${aging} placeholder${aging === 1 ? "" : "s"} past ${AGING_DAYS} days` },
        ]}
        queues={[
          { id: "design", label: "My design queue", count: q.design.length },
          { id: "changes", label: "Open changes", count: q.changes.length },
          { id: "approvals", label: "Awaiting my approval", count: q.approvals.length },
          { id: "releases", label: "Recently released", count: q.releases.length },
          { id: "exceptions", label: "Exceptions", count: q.exceptions.length },
        ]}
        queue={queue}
        onQueueChange={(x) => { setQueue(x); setActive(null) }}
        table={{
          rows, columns, rowId: (r) => r.id, onRowClick: setActive, activeId: active?.id, searchText: (r) => `${r.id} ${r.title} ${r.what}`,
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "date", dir: queue === "design" ? "asc" : "desc" },
          empty:
            queue === "approvals" ? { title: "Nothing waits for your approval", body: "EBOM releases, production version releases and CCB votes routed to your role appear here. Switch Acting as to Engineering Manager to see them." }
            : queue === "design" ? { title: "Your design queue is empty", body: "Requests, EBOMs and documents assigned to you appear here." }
            : { title: "Nothing here", body: "This panel is clear." },
        }}
        panel={{
          open: !!active, onOpenChange: (o) => !o && setActive(null), title: active ? `${active.what} ${active.id.split("#")[0]}` : "",
          content: active ? (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-4">
                <KV k="Title">{active.title}</KV>
                <KV k="Status">{active.status ? <StatusBadge kind={active.status.kind} status={active.status.value} size="sm" /> : active.stage}</KV>
                <KV k="Date">{fmtDate(active.date)}</KV>
                <KV k="Detail">{active.note}</KV>
              </dl>
              <div><Button onClick={() => nav(active.route)}>{queue === "approvals" ? "Decide in WF-INBOX" : `Open ${active.id.split("#")[0]}`}</Button></div>
            </div>
          ) : null,
        }}
      />
      <p className="text-xs text-muted-foreground">Postings and scans: none on this screen (Book VI entry, asserted). Navigation only.</p>
      <RulesPanel
        rules={[
          ["ENG-HOME", "My design queue (SO line, configuration summary, due date, status, customer-approval flag); open ECRs/ECOs with aging; awaiting my approval; last 20 released BOMs and drawings", "DOC:p.58 §1"],
          ["Exceptions", "Items used in released BOMs that lost their vendor (AVL empty), drawings referenced but not Released, placeholder parts older than 14 days", "DOC:p.58 §1"],
          ["C-1", "Approvals are decided in the shared WF-INBOX; this workspace links there and never shows its own approve button", "erd-sketch C-1"],
          ["V-ENG-03", "A Draft placeholder blocks EBOM release until its MCR completes", "DOC:p.61"],
          ["Dev note", "An Active MBOM transformed from an older EBOM revision is flagged EBOM ahead and appears in the exceptions panel", "DOC:p.66"],
        ]}
      />
    </>
  )
}
