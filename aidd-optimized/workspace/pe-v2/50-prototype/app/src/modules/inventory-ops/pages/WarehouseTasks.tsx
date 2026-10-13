// FX-INV-WTASKS Warehouse task mobile work queue (Zebra TC77). Receiving, putaway, replenishment,
// pick, stage, pack, load, transfer; Queued -> Assigned -> In Progress -> Done/Exception (S-23);
// scrap-bin confirmation at SP-21. "The mobile work queue reads tasks, documents stay the system of
// record" [DOC:p.215 Book IV §7.2]; "every task must be a record with a queue, an owner, a device and
// a status" [DOC: Book VIII §5.3] (asserted).
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogShell, KioskFact, KioskPage } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, PostingPreview, ScanField, type ScanFieldHandle, type ScanOutcome } from "@/components/patterns"
import { USERS } from "@/data/shared"
import { SCAN_POINTS } from "@/data/domain"
import { useCore, useRole, useSlice } from "@/store"
import { cn } from "@/lib/utils"
import { HandheldFrame } from "../components/handheld"
import { matShort, userName, Reading } from "../components/bits"
import { PriorityChip, TaskStatus } from "../components/TaskBits"
import { useViewState } from "../components/states"
import { FLOOR_ROLES, PRIORITY_RANK, SCAN_ERROR, TASK_CFG, canWorkTask, taskAgeHours } from "../lib/rules"
import { TASK_TYPES, type InvTask, type TaskType } from "../data/types"
import * as A from "../data/actions"

type Tab = "mine" | "queue" | "done"

export function WarehouseTasks() {
  const s = useSlice("inventoryOps")
  const core = useCore()
  const [role, setRole] = useRole()
  const ss = useViewState("FX-INV-WTASKS", { offlineQueues: true, degradedWhat: "The task service is slow, so the queue may be a minute behind", authorizedRoles: FLOOR_ROLES })
  const me = core.userId
  const onFloor = FLOOR_ROLES.includes(role)
  const [tab, setTab] = useState<Tab>("mine")
  const [type, setType] = useState<TaskType | "all">("all")
  const [taskId, setTaskId] = useState<string | null>(null)
  const [dlg, setDlg] = useState<null | "exception">(null)
  const [pending, setPending] = useState<{ taskId: string; code: string }[]>([])
  const [err, setErr] = useState<string | null>(null)
  const scanRef = useRef<ScanFieldHandle>(null)
  const writable = ss.canWrite && !ss.loading

  const t = taskId ? s.tasks.find((x) => x.id === taskId) : undefined
  const rank = (a: InvTask, b: InvTask) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt)
  const mine = s.tasks.filter((x) => x.assigneeId === me && (x.status === "Assigned" || x.status === "In Progress")).sort(rank)
  const queue = s.tasks.filter((x) => x.status === "Queued" && canWorkTask(role, x.type)).sort(rank)
  const done = s.tasks.filter((x) => x.assigneeId === me && x.status === "Done/Exception").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))
  const list = (tab === "mine" ? mine : tab === "queue" ? queue : done).filter((x) => type === "all" || x.type === type)

  // Offline scans wait on the device and replay when the connection returns (queue holds up to 4 h).
  useEffect(() => {
    if (ss.offline || !pending.length) return
    let ok = 0
    for (const q of pending) if (A.scanTask(q.taskId, q.code).ok) ok++
    toast.success(`${ok} queued scan(s) replayed`)
    setPending([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ss.offline])

  const act = <T,>(r: { ok: true; value: T } | { ok: false; error: string }, msg: string) => {
    if (!r.ok) {
      setErr(r.error)
      return false
    }
    setErr(null)
    toast.success(msg)
    return true
  }

  const localScans = t ? t.scans.length + pending.filter((p) => p.taskId === t.id).length : 0
  const onScan = (raw: string): ScanOutcome => {
    if (!t) return { ok: false, expected: "an open task", next: "Open a task first.", message: "No task is open" }
    if (ss.offline) {
      const step = t.steps[localScans]
      if (!step) return { ok: true, message: "All scans queued. Complete the task when online." }
      if (raw.trim().toUpperCase() !== step.code.toUpperCase()) return { ok: false, errorCode: SCAN_ERROR[t.scanPoint], message: `${step.label} does not match this task`, expected: `${step.label} ${step.code}`, next: `Scan the ${step.label.toLowerCase()}.` }
      setPending((p) => [...p, { taskId: t.id, code: raw.trim() }])
      return { ok: true, message: `${step.label} queued on the device` }
    }
    const r = A.scanTask(t.id, raw)
    if (!r.ok) return { ok: false, message: r.error, expected: "a valid scan", next: "Try again." }
    const v = r.value
    return v.ok ? { ok: true, message: v.message } : { ok: false, errorCode: v.errorCode, message: v.message, expected: v.expected, next: v.next }
  }

  const status = t ? t.status : undefined
  const actions = []
  if (t && onFloor) {
    if (status === "Queued") actions.push({ label: "Take task", primary: true, disabled: !writable || ss.degraded || ss.offline, onClick: () => act(A.claimTask(t.id), `${t.id} is yours`) })
    if (status === "Assigned") actions.push({ label: "Start task", primary: true, disabled: !writable || ss.offline, onClick: () => act(A.startTask(t.id), `${t.id} started`) })
    if (status === "In Progress")
      actions.push({
        label: t.scrap ? "Confirm at scrap bin" : "Complete task",
        primary: true,
        disabled: !writable || ss.offline || t.scans.length < t.steps.length,
        onClick: () => {
          const r = A.completeTask(t.id)
          if (act(r, t.scrap ? `${t.id} scrapped; posting #${t.scrap.source === "RMA" ? 20 : 30} made` : `${t.id} done`)) setTaskId(null)
        },
      })
    if (status === "In Progress" || status === "Assigned") actions.push({ label: "Report exception", disabled: !writable || ss.offline, onClick: () => setDlg("exception") })
    actions.push({ label: "Back to the queue", primary: status === "Done/Exception", onClick: () => (setTaskId(null), setErr(null)) })
  }

  const banners = (
    <div className="flex flex-col gap-2 empty:hidden">
      {ss.banners}
      {ss.error && <ErrorAlert title="The work queue could not be loaded" action={<button className="underline" onClick={ss.onRetry}>Try again</button>}>{ss.error}</ErrorAlert>}
      {err && <ErrorAlert title="That did not go through" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
    </div>
  )

  return (
    <KioskPage
      title="Work queue"
      screenId="FX-INV-WTASKS"
      operator={onFloor ? userName(me) : undefined}
      station="Handheld TC77"
      online={!ss.offline}
      queued={pending.length}
      exitTo="/inventory-ops/task-board"
      banners={banners}
      scan={t && onFloor && status === "In Progress" && ss.canWrite ? <ScanField ref={scanRef} scanPoint={t.scanPoint} expected={t.steps[localScans] ? `${t.steps[localScans].label} (${t.steps[localScans].code})` : "nothing more: complete the task"} onScan={onScan} disabled={localScans >= t.steps.length && !ss.offline} label={SCAN_POINTS[t.scanPoint].step} /> : undefined}
      actions={actions}
    >
      <div className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
        <span>Preview a state</span>
        {ss.toolbar}
      </div>
      {!onFloor ? (
        <HandheldFrame>
          <p className="text-base font-semibold">Badge in to the work queue</p>
          <p className="text-base">The queue is worked on a handheld by the floor roles. You are acting as {role}.</p>
          {FLOOR_ROLES.map((r) => (
            <Button key={r} variant="outline" className="h-12 text-base" onClick={() => setRole(r)}>
              Badge in as {r} ({userName(USERS.find((u) => u.roles.includes(r))?.id)})
            </Button>
          ))}
        </HandheldFrame>
      ) : ss.loading ? (
        <HandheldFrame>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </HandheldFrame>
      ) : !t ? (
        <HandheldFrame>
          <div role="tablist" aria-label="Task lists" className="flex gap-1">
            {([["mine", "My tasks", mine.length], ["queue", "Queue", queue.length], ["done", "Done", done.length]] as const).map(([id, label, n]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("h-12 flex-1 rounded-md border text-base", tab === id ? "border-primary font-semibold" : "text-muted-foreground")}>
                {label} {n}
              </button>
            ))}
          </div>
          <Select value={type} onValueChange={(v) => setType(v as TaskType | "all")}>
            <SelectTrigger aria-label="Task type" className="h-12 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All task types</SelectItem>
              {TASK_TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
            </SelectContent>
          </Select>
          {ss.empty || !list.length ? (
            <EmptyState title={tab === "mine" ? "No task is assigned to you" : tab === "queue" ? "The queue is empty for your role" : "Nothing finished yet"}>
              {tab === "mine" ? "Take one from the Queue tab, or wait for the supervisor to assign one." : tab === "queue" ? `Tasks you may take (RD-IO-03): ${TASK_TYPES.filter((x) => canWorkTask(role, x)).join(", ")}.` : "Finished tasks appear here."}
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => (setTaskId(x.id), setErr(null))} className="flex min-h-12 w-full flex-col gap-1 rounded-lg border p-3 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold">{x.type}</span>
                      <span className="tabular font-mono text-base text-muted-foreground">{x.id}</span>
                      <PriorityChip p={x.priority} />
                    </span>
                    <TaskStatus t={x} size="lg" />
                    <span className="text-base">{x.docLabel}</span>
                    <span className="text-base text-muted-foreground">{x.itemId ? `${x.qty.toLocaleString("en-US")} ${x.uom} ${matShort(x.itemId)}` : `${x.qty} ${x.uom}`}{x.from || x.to ? ` · ${x.from ?? ""} → ${x.to ?? ""}` : ""} · {taskAgeHours(x)} h old</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Reading id="RD-IO-03" />
        </HandheldFrame>
      ) : (
        <HandheldFrame>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{t.type}</span>
            <span className="tabular font-mono text-base">{t.id}</span>
            <PriorityChip p={t.priority} />
          </div>
          <TaskStatus t={t} size="lg" />
          <KioskFact label="Document">{t.docLabel}</KioskFact>
          {t.itemId && <KioskFact label="Item">{t.qty.toLocaleString("en-US")} {t.uom} {t.itemId}</KioskFact>}
          {t.batch && <KioskFact label="Batch">{t.batch}</KioskFact>}
          {(t.from || t.to) && <KioskFact label="Move">{t.from ?? "?"} → {t.to ?? "?"}</KioskFact>}
          <p className="text-base text-muted-foreground">{TASK_CFG[t.type].hint} Scan point {t.scanPoint}. Queue {t.queue} · device {t.device ?? "not set"} · assigned to {userName(t.assigneeId)}.{t.type === "Replenishment" || t.type === "Transfer" ? <> <Reading id="RD-IO-01" /></> : null}</p>
          <ol aria-label="Scans for this task" className="flex flex-col gap-1">
            {t.steps.map((st, i) => (
              <li key={i} className="flex items-center gap-2 text-base">
                <span className={cn("flex size-6 items-center justify-center rounded-full border text-base", i < localScans && "border-primary font-semibold")} aria-hidden="true">{i < localScans ? "✓" : i + 1}</span>
                <span>{st.label}</span>
                <span className="tabular font-mono text-muted-foreground">{st.code}</span>
                <span className="sr-only">{i < localScans ? "scanned" : "to scan"}</span>
              </li>
            ))}
          </ol>
          {t.scrap && (
            <div className="flex flex-col gap-2">
              <p className="text-base">
                Scrap bin confirmation (SP-21): {t.scrap.approvedBy ? <>disposition approved by {userName(t.scrap.approvedBy)}{t.scrap.approvedReason ? `: ${t.scrap.approvedReason}` : ""}.</> : <Chip kind="block">Disposition not approved</Chip>}{" "}
                <Reading id="RD-IO-07" />
              </p>
              <PostingPreview title="Posts on confirmation" lines={[{ template: t.scrap.source === "RMA" ? 20 : 30, amount: t.scrap.amount, detail: `${t.scrap.srcRef.id}: ${t.qty} ${t.uom} ${t.itemId ?? ""} to ${t.scrap.binCode}` }]} />
            </div>
          )}
          {t.exception && <ErrorAlert title="Exception">{t.exception.reason} ({userName(t.exception.by)}, {t.exception.at.replace("T", " ")})</ErrorAlert>}
          {t.status === "Done/Exception" && <p className="text-base text-muted-foreground">Finished {t.doneAt?.replace("T", " ")}. A supervisor can requeue an exception from the <Link className="text-link underline" to={`/inventory-ops/task-board?task=${t.id}`}>task board</Link>.</p>}
          <ul className="flex flex-col gap-1 text-base text-muted-foreground" aria-label="History">
            {t.history.slice(-4).map((h, i) => <li key={i}>{h.at.slice(11, 16)} {h.by}: {h.text}</li>)}
          </ul>
        </HandheldFrame>
      )}
      <DialogShell
        open={dlg === "exception"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Report an exception on ${t?.id}`}
        consequence={`Ends ${t?.id} as Done/Exception with outcome Exception. The supervisor sees it on the board and can requeue it. Nothing is posted.`}
        confirmLabel="Report exception"
        requireReason
        reasonLabel="What went wrong (required)"
        onConfirm={(reason) => {
          if (!t) return null
          const r = A.raiseTaskException(t.id, reason)
          if (!r.ok) return r.error
          toast.success(`${t.id} ended as an exception`)
          setTaskId(null)
          return null
        }}
      />
    </KioskPage>
  )
}
