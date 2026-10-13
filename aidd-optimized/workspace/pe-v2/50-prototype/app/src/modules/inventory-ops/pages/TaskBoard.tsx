// FX-INV-WBOARD Warehouse task supervisor board. "Every task must be a record with a queue, an owner,
// a device and a status, so supervisors balance load" [DOC: Book VIII §5.3] (asserted). A Workbench:
// KPI strip, queue tabs, selectable table, bulk assign / release / re-prioritise, side panel for the
// task. Kit-staging picks created by Production (planning-production, SP-09) are listed read-only.
import { useState } from "react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WorkbenchPage, DialogShell } from "@/components/templates"
import { Chip, ErrorAlert, KV, type Column } from "@/components/patterns"
import { USERS } from "@/data/shared"
import type { UserId } from "@/data/domain"
import { useSlice } from "@/store"
import { L, Reading, matShort, userName } from "../components/bits"
import { PriorityChip, TaskStatus } from "../components/TaskBits"
import { useViewState } from "../components/states"
import { FLOOR_ROLES, PRIORITY_RANK, SUPERVISOR_ROLES, TASK_CFG, taskAgeHours } from "../lib/rules"
import type { InvTask, TaskPriority } from "../data/types"
import * as A from "../data/actions"

interface Row {
  id: string
  source: "io" | "pp"
  type: string
  status: InvTask["status"]
  outcome?: InvTask["outcome"]
  priority: InvTask["priority"]
  assigneeId?: string
  device?: string
  queue: string
  doc: string
  what: string
  age: number | null
  task?: InvTask
  followUp?: string
}

const QUEUES = ["open", "Queued", "Assigned", "In Progress", "Done/Exception", "exceptions"] as const
const LABEL: Record<(typeof QUEUES)[number], string> = { open: "All open", Queued: "Queued", Assigned: "Assigned", "In Progress": "In Progress", "Done/Exception": "Done/Exception", exceptions: "Exceptions" }
const floorUsers = USERS.filter((u) => u.roles.some((r) => FLOOR_ROLES.includes(r)))

export function TaskBoard() {
  const s = useSlice("inventoryOps")
  const pp = useSlice("planningProduction")
  const ss = useViewState("FX-INV-WBOARD", { degradedWhat: "Device status is slow, so assigned devices may show as offline", authorizedRoles: SUPERVISOR_ROLES })
  const [sp, setSp] = useSearchParams()
  const [queue, setQueue] = useState<(typeof QUEUES)[number]>("open")
  const [err, setErr] = useState<string | null>(null)
  const [dlg, setDlg] = useState<null | { kind: "scrap"; id: string }>(null)
  const activeId = sp.get("task") ?? undefined
  const setActive = (id?: string) => {
    const n = new URLSearchParams(sp)
    if (id) n.set("task", id)
    else n.delete("task")
    setSp(n, { replace: true })
  }

  const rows: Row[] = [
    ...s.tasks.map<Row>((t) => ({
      id: t.id, source: "io", type: t.type, status: t.status, outcome: t.outcome, priority: t.priority, assigneeId: t.assigneeId, device: t.device, queue: t.queue, doc: t.docLabel,
      what: `${t.itemId ? `${t.qty.toLocaleString("en-US")} ${t.uom} ${matShort(t.itemId)}` : `${t.qty} ${t.uom}`}${t.from || t.to ? ` · ${t.from ?? ""} → ${t.to ?? ""}` : ""}`, age: taskAgeHours(t), task: t, followUp: s.tasks.find((x) => x.followsUp === t.id)?.id,
    })),
    ...pp.warehouseTasks.map<Row>((t) => ({
      id: t.id, source: "pp", type: t.type, status: t.status, priority: "Normal", assigneeId: t.assigneeId, device: t.device, queue: "Internal", doc: `${t.doc.type === "productionOrder" ? "Production order" : t.doc.type} ${t.doc.id}`, what: t.text ?? "", age: null,
    })),
  ]
  const open = rows.filter((r) => r.status !== "Done/Exception")
  const excs = rows.filter((r) => r.outcome === "Exception")
  const view = ss.empty ? [] : queue === "open" ? open : queue === "exceptions" ? excs : rows.filter((r) => r.status === queue)
  const count = (q: (typeof QUEUES)[number]) => (q === "open" ? open.length : q === "exceptions" ? excs.length : rows.filter((r) => r.status === q).length)
  const stale = rows.filter((r) => r.status === "Queued" && r.age != null && r.age >= 4)
  const load = floorUsers.map((u) => ({ u, n: rows.filter((r) => r.assigneeId === u.id && (r.status === "Assigned" || r.status === "In Progress")).length }))
  const active = activeId ? rows.find((r) => r.id === activeId) : undefined
  const writable = ss.canWrite && !ss.loading && !ss.degraded

  const run = <T,>(r: { ok: true; value: T } | { ok: false; error: string }, msg: string | ((v: T) => string), after?: () => void) => {
    if (!r.ok) {
      setErr(r.error)
      toast.error(r.error)
      return
    }
    setErr(null)
    toast.success(typeof msg === "function" ? msg(r.value) : msg)
    after?.()
  }

  const cols: Column<Row>[] = [
    { id: "id", header: "Task", value: (r) => r.id, sortable: true, mono: true, cell: (r) => <button className="font-mono text-link underline-offset-4 hover:underline" onClick={(e) => (e.stopPropagation(), setActive(r.id))}>{r.id}</button> },
    { id: "type", header: "Type", value: (r) => r.type, sortable: true, filterable: true },
    { id: "status", header: "Status", value: (r) => r.status, sortable: true, filterable: true, cell: (r) => <TaskStatus t={r} size="sm" /> },
    { id: "priority", header: "Priority", value: (r) => PRIORITY_RANK[r.priority], sortable: true, cell: (r) => <PriorityChip p={r.priority} /> },
    { id: "assignee", header: "Owner", value: (r) => (r.assigneeId ? userName(r.assigneeId) : "Unassigned"), sortable: true, filterable: true },
    { id: "device", header: "Device", value: (r) => r.device ?? "", mono: true },
    { id: "queue", header: "Queue", value: (r) => r.queue, filterable: true },
    { id: "doc", header: "Document", value: (r) => r.doc, cell: (r) => <span>{r.doc}{r.source === "pp" && <> <Chip kind="design" note="Created by Production at operation release (SP-09); worked and closed on the production floor">Kit staging</Chip></>}</span> },
    { id: "what", header: "What and where", value: (r) => r.what },
    { id: "age", header: "Age", value: (r) => r.age ?? undefined, sortable: true, align: "right", cell: (r) => (r.age == null ? <span className="text-muted-foreground">n/a</span> : <span className="tabular">{r.age} h</span>) },
  ]

  return (
    <>
      <WorkbenchPage<Row>
        header={{
          title: "Warehouse task board",
          screenId: "FX-INV-WBOARD",
          description: "Every receiving, putaway, replenishment, pick, stage, pack, load and transfer task with its queue, owner, device and status. Balance the load, release tasks back to the queue and deal with exceptions. The handheld work queue reads these tasks; the documents stay the system of record.",
          actions: ss.toolbar,
          children: (
            <div className="flex flex-col gap-2">
              {ss.banners}
              {err && <ErrorAlert title="That did not go through" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
              <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Load per operator" role="group">
                <span className="text-muted-foreground">Open tasks per person</span>
                {load.map(({ u, n }) => (
                  <span key={u.id} className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5">
                    {u.name} <span className="tabular font-semibold">{n}</span>
                  </span>
                ))}
                <Reading id="RD-IO-04" />
              </div>
            </div>
          ),
        }}
        kpis={[
          { label: "Queued", value: count("Queued"), hint: "waiting for someone" },
          { label: "Assigned or in progress", value: count("Assigned") + count("In Progress") },
          { label: "Queued 4 h or more", value: stale.length, hint: "design threshold" },
          { label: "Exceptions", value: excs.length, hint: `${excs.filter((r) => !r.followUp).length} without a follow-up` },
        ]}
        queues={QUEUES.map((q) => ({ id: q, label: LABEL[q], count: count(q) }))}
        queue={queue}
        onQueueChange={(q) => setQueue(q as (typeof QUEUES)[number])}
        table={{
          rows: view,
          columns: cols,
          rowId: (r) => r.id,
          searchText: (r) => `${r.id} ${r.type} ${r.doc} ${r.what} ${userName(r.assigneeId)}`,
          searchPlaceholder: "Search tasks, documents, people",
          onRowClick: (r) => setActive(r.id),
          activeId,
          loading: ss.loading,
          error: ss.error,
          onRetry: ss.onRetry,
          empty: { title: "No tasks in this queue", body: "Tasks are created from receiving, putaway, replenishment, picking, packing, loading and transfer documents." },
          initialSort: { id: "priority", dir: "asc" },
          caption: "Warehouse tasks",
        }}
        bulkActions={(selected, clear) => <BulkBar selected={selected} rows={rows} clear={clear} writable={writable} why={ss.blockedWhy ?? (ss.degraded ? "Device status is degraded" : undefined)} run={run} />}
        panel={{
          open: !!active,
          onOpenChange: (o) => !o && setActive(undefined),
          title: active ? `${active.id} · ${active.type}` : "",
          description: active?.doc,
          content: active ? <TaskPanel row={active} writable={writable} why={ss.blockedWhy} run={run} onScrap={() => setDlg({ kind: "scrap", id: active.id })} /> : null,
        }}
      />
      <DialogShell
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Approve the scrap disposition on ${dlg?.id}`}
        consequence="Releases the scrap task for SP-21 confirmation at the scrap bin. The posting (#30 operation scrap, or #20 for an RMA) is made when the operator confirms."
        confirmLabel="Approve disposition"
        requireReason
        reasonLabel="Reason for the scrap (required)"
        onConfirm={(reason) => {
          if (!dlg) return null
          const r = A.approveScrap(dlg.id, reason)
          if (!r.ok) return r.error
          toast.success(`Scrap disposition on ${dlg.id} approved`)
          return null
        }}
      />
    </>
  )
}

type Run = <T>(r: { ok: true; value: T } | { ok: false; error: string }, msg: string | ((v: T) => string), after?: () => void) => void

function BulkBar({ selected, rows, clear, writable, why, run }: { selected: string[]; rows: Row[]; clear: () => void; writable: boolean; why?: string; run: Run }) {
  const [who, setWho] = useState("")
  const mine = selected.filter((id) => rows.find((r) => r.id === id)?.source === "io")
  const foreign = selected.length - mine.length
  return (
    <>
      <Select value={who} onValueChange={setWho}>
        <SelectTrigger size="sm" aria-label="Assign to" className="h-8 w-52"><SelectValue placeholder="Assign to..." /></SelectTrigger>
        <SelectContent>{floorUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.roles[0]})</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" disabled={!writable || !who || !mine.length} title={why} onClick={() => run(A.assignTasks(mine, who as UserId), (n) => `${n} task(s) assigned to ${userName(who)}`, clear)}>Assign</Button>
      <Button size="sm" variant="outline" disabled={!writable || !mine.length} title={why} onClick={() => run(A.releaseTasks(mine), (n) => `${n} task(s) released to the queue`, clear)}>Release to queue</Button>
      {(["Urgent", "High", "Normal"] as TaskPriority[]).map((p) => (
        <Button key={p} size="sm" variant="outline" disabled={!writable || !mine.length} title={why} onClick={() => run(A.setPriority(mine, p), (n) => `${n} task(s) set to ${p}`, clear)}>{p}</Button>
      ))}
      {foreign > 0 && <span className="text-xs text-muted-foreground">{foreign} kit-staging task(s) belong to Production and are skipped.</span>}
    </>
  )
}

function TaskPanel({ row, writable, why, run, onScrap }: { row: Row; writable: boolean; why?: string; run: Run; onScrap: () => void }) {
  const t = row.task
  const [who, setWho] = useState<string>("")
  if (!t)
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p>Kit-staging pick created by Production for an operation (SP-09). It is worked and closed on the production floor; this board shows it so the load is complete.</p>
        <dl className="grid grid-cols-2 gap-3">
          <KV k="Status"><TaskStatus t={row} size="sm" /></KV>
          <KV k="Owner">{userName(row.assigneeId)}</KV>
          <KV k="Device">{row.device ?? "not set"}</KV>
          <KV k="Document">{row.doc}</KV>
        </dl>
        <p className="text-muted-foreground">{row.what}</p>
      </div>
    )
  const eligible = floorUsers.filter((u) => u.roles.some((r) => TASK_CFG[t.type].roles.includes(r)))
  return (
    <div className="flex flex-col gap-4 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <KV k="Status"><TaskStatus t={t} size="sm" /></KV>
        <KV k="Priority">{t.priority}</KV>
        <KV k="Owner">{userName(t.assigneeId)}</KV>
        <KV k="Device">{t.device ?? "not set"}</KV>
        <KV k="Queue">{t.queue}</KV>
        <KV k="Scan point">{t.scanPoint}</KV>
        <KV k="Item">{t.itemId ? `${t.qty.toLocaleString("en-US")} ${t.uom} ${t.itemId}` : `${t.qty} ${t.uom}`}</KV>
        <KV k="Batch">{t.batch ?? "none"}</KV>
        <KV k="From">{t.from ?? "none"}</KV>
        <KV k="To">{t.to ?? "none"}</KV>
        <KV k="Document">{t.docRef ? <L to={docPath(t)}>{t.docLabel}</L> : t.docLabel}</KV>
        <KV k="Created">{t.createdAt.replace("T", " ")}</KV>
      </dl>
      {t.exception && <ErrorAlert title="Exception">{t.exception.reason} ({userName(t.exception.by)})</ErrorAlert>}
      {t.followsUp && <p className="text-muted-foreground">Follow-up of {t.followsUp}.</p>}
      <section aria-label="Scans">
        <h3 className="mb-1 font-semibold">Scans ({t.scans.length} of {t.steps.length})</h3>
        <ol className="flex flex-col gap-0.5">
          {t.steps.map((st, i) => (
            <li key={i} className="flex gap-2"><span aria-hidden="true">{i < t.scans.length ? "✓" : "·"}</span>{st.label} <span className="tabular font-mono text-muted-foreground">{st.code}</span></li>
          ))}
        </ol>
      </section>
      {t.scrap && (
        <section aria-label="Scrap disposition" className="flex flex-col gap-1 rounded-md border p-3">
          <h3 className="font-semibold">Scrap disposition (SP-21) <Reading id="RD-IO-07" /></h3>
          <p>{t.scrap.source === "RMA" ? "RMA disposition" : "Production scrap"} {t.scrap.srcRef.id} · bin {t.scrap.binCode} · ${t.scrap.amount.toLocaleString("en-US")} · posting #{t.scrap.source === "RMA" ? 20 : 30}</p>
          {t.scrap.approvedBy ? <p>Approved by {userName(t.scrap.approvedBy)}: {t.scrap.approvedReason}{t.scrap.confirmedAt ? ` · confirmed at the bin ${t.scrap.confirmedAt.replace("T", " ")}` : ""}</p> : (
            <div className="flex items-center gap-2"><Chip kind="block">Disposition not approved</Chip><Button size="sm" disabled={!writable} title={why} onClick={onScrap}>Approve scrap</Button></div>
          )}
        </section>
      )}
      {(t.status === "Queued" || t.status === "Assigned") && (
        <section aria-label="Assign" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="panel-assign">{t.status === "Queued" ? "Assign to" : "Reassign to"}</Label>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger id="panel-assign" size="sm" className="h-8 w-56"><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent>{eligible.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.roles[0]})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!writable || !who} title={why} onClick={() => run(A.assignTasks([t.id], who as UserId), `${t.id} assigned to ${userName(who)}`)}>{t.status === "Queued" ? "Assign" : "Reassign"}</Button>
          {t.status === "Assigned" && <Button size="sm" variant="outline" disabled={!writable} title={why} onClick={() => run(A.releaseTasks([t.id]), `${t.id} released to the queue`)}>Release to queue</Button>}
        </section>
      )}
      {t.outcome === "Exception" && !row.followUp && (
        <Button size="sm" className="w-fit" disabled={!writable} title={why} onClick={() => run(A.requeueTask(t.id), (nid) => `${nid} queued as a follow-up`)}>Requeue as a new task</Button>
      )}
      {row.followUp && <p className="text-muted-foreground">Requeued as {row.followUp}.</p>}
      <section aria-label="History">
        <h3 className="mb-1 font-semibold">History</h3>
        <ul className="flex flex-col gap-0.5 text-muted-foreground">
          {[...t.history].reverse().map((h, i) => <li key={i}>{h.at.replace("T", " ")} · {h.by}: {h.text}</li>)}
        </ul>
      </section>
    </div>
  )
}
const docPath = (t: InvTask) => (t.docRef?.type === "purchaseOrder" ? `/purchasing/orders/${t.docRef.id}` : t.docRef?.type === "rma" ? `/sales/rma/${t.docRef.id}` : t.docRef?.type === "productionOrder" ? `/production/orders/${t.docRef.id}` : t.docRef?.type === "grn" ? `/inventory-ops/goods-receipts/${t.docRef.id}` : "/")
