// MM-MCR-001/2 Material Creation Requests [DOC:pp.245-246] (asserted); rules Book II §4.2, §4.3.
// Queue with SLA aging; detail with the per-department task checklist. Actions: Complete my task,
// Reassign, Activate (Materials Manager), Reject to task with comments. FL-10 / FL-03 master-data side.
// MCR has no status list in the PRD (OQ-21): the stage is text, never a badge.
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, WorkbenchPage } from "@/components/templates"
import { EmptyState, KV, RulesPanel, type Column } from "@/components/patterns"
import type { MaterialType, UserId } from "@/data/domain"
import { MATERIAL_TYPES, USERS } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { DUPLICATE_THRESHOLD, businessDaysBetween, completeness, slaState, taskBlockedBy, ESCALATE_TO } from "../lib/rules"
import { getMaterial, R } from "../data/state"
import { activateMcr, completeTask, createMcr, duplicateCandidates, reassignTask, rejectToTask, submitMcr, withdrawMcr } from "../data/actions"
import type { McrRecord } from "../data/types"
import { Completeness, DocLinkText, MatLink, MaterialStatus, NoStatusList, Reading, Section, SlaTag, TypeBadge, userName, useListState } from "../components/common"
import { confirmRun, run } from "../components/run"

const worstSla = (r: McrRecord) => {
  const open = r.tasks.filter((t) => !t.done)
  if (!open.length) return undefined
  const states = open.map((t) => slaState(t))
  return states.includes("Breached") ? "Breached" : states.includes("Due today") ? "Due today" : "On time"
}

// ============================================================================ queue (MM-MCR-001)
export function McrQueue() {
  const s = useSlice("materials")
  const [role] = useRole()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const st = useListState("MM-MCR-001")
  const [queue, setQueue] = useState("open")
  const rows = s.mcrs
  const mine = rows.filter((r) => r.stage === "Tasks open" && r.tasks.some((t) => !t.done && t.ownerRole === role))
  const q: Record<string, McrRecord[]> = {
    open: rows.filter((r) => r.stage === "Tasks open"),
    mine,
    ready: rows.filter((r) => r.stage === "Ready to activate"),
    draft: rows.filter((r) => r.stage === "Draft"),
    closed: rows.filter((r) => r.stage === "Activated" || r.stage === "Withdrawn"),
    all: rows,
  }
  const breached = rows.flatMap((r) => r.tasks).filter((t) => slaState(t) === "Breached").length
  const done = rows.filter((r) => r.stage === "Activated" && r.activatedOn)
  const cycle = done.length ? Math.round(done.reduce((a, r) => a + businessDaysBetween(r.createdOn, r.activatedOn!), 0) / done.length) : 0
  const cols: Column<McrRecord>[] = [
    { id: "id", header: "MCR", value: (r) => r.id, sortable: true, mono: true },
    { id: "desc", header: "Description", value: (r) => r.description, sortable: true },
    { id: "type", header: "Type", value: (r) => r.requestedType, filterable: true, cell: (r) => <TypeBadge type={r.requestedType} /> },
    { id: "path", header: "Path", value: (r) => r.path, filterable: true },
    { id: "stage", header: "Stage", value: (r) => r.stage, filterable: true, cell: (r) => <span className="text-sm">{r.stage}</span> },
    { id: "tasks", header: "Tasks done", value: (r) => r.tasks.filter((t) => t.done).length, align: "right", mono: true, cell: (r) => `${r.tasks.filter((t) => t.done).length} / ${r.tasks.length}` },
    { id: "sla", header: "SLA aging", value: (r) => worstSla(r) ?? "Done", filterable: true, cell: (r) => (worstSla(r) ? <SlaTag state={worstSla(r)!} /> : r.stage === "Withdrawn" || r.stage === "Rejected" ? "" : <SlaTag state="Done" />) },
    { id: "origin", header: "Origin", value: (r) => r.originRef?.id ?? "", cell: (r) => (r.originRef ? <span className="font-mono text-xs">{r.originRef.id}</span> : "") },
    { id: "created", header: "Created", value: (r) => r.createdOn, sortable: true, cell: (r) => fmtDate(r.createdOn) },
  ]
  return (
    <>
      <WorkbenchPage
        header={{
          screenId: "MM-MCR-001/2",
          title: "Material creation requests",
          description: "Every new material runs here (C-47). Each department completes its view within 2 business days; the Materials Manager activates once every task is done and V-MM-01 passes.",
          chips: <NoStatusList />,
          primary: (
            <Button onClick={() => setSp({ new: "1" })}>
              <Plus aria-hidden="true" /> New request
            </Button>
          ),
        }}
        kpis={[
          { label: "Open requests", value: q.open.length },
          { label: "Tasks past SLA", value: breached, hint: "2 business days per task" },
          { label: "Ready to activate", value: q.ready.length },
          { label: "Avg cycle time", value: `${cycle} days`, hint: "Created to activated, business days" },
        ]}
        queues={[
          { id: "open", label: "Open", count: q.open.length },
          { id: "mine", label: `My tasks (${role})`, count: q.mine.length },
          { id: "ready", label: "Ready to activate", count: q.ready.length },
          { id: "draft", label: "Draft", count: q.draft.length },
          { id: "closed", label: "Activated or withdrawn", count: q.closed.length },
          { id: "all", label: "All", count: rows.length },
        ]}
        queue={queue}
        onQueueChange={setQueue}
        table={{
          rows: st.empty ? [] : q[queue],
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => R.mcr(r.id),
          searchText: (r) => `${r.id} ${r.description} ${r.materialId ?? ""} ${r.originRef?.id ?? ""}`,
          loading: st.loading,
          error: st.error,
          onRetry: st.onRetry,
          toolbar: st.toolbar,
          empty: { title: queue === "mine" ? `No open task for ${role}` : "No requests in this queue", body: "Switch queue or start a new request." },
          initialSort: { id: "created", dir: "desc" },
        }}
        bulkActions={(ids, clear) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              let n = 0
              for (const id of ids) if (activateMcr(id).ok) n++
              run(n ? { ok: true, value: n } : { ok: false, error: "None activated: activation needs the Materials Manager, every task done and V-MM-01 passing." }, (v) => `${v} request(s) activated`)
              clear()
            }}
          >
            Activate selected
          </Button>
        )}
      />
      <NewMcrDialog open={sp.get("new") === "1"} copyFrom={sp.get("copy") ?? undefined} onClose={() => setSp({})} onCreated={(id) => nav(R.mcr(id))} />
      <McrRules />
    </>
  )
}

function McrRules() {
  return (
    <RulesPanel
      rules={[
        ["C-47", "A material is created only through an MCR; the number is reserved in Draft.", "[Book II §4.2]"],
        ["§4.2", "Task matrix by type: steward, planner, buyer (+ first info record), manufacturing engineer, warehouse, quality, cost accountant, sales admin; SLA 2 business days each.", "[Book II §4.2]"],
        ["§4.2", "Accounting & Costing waits for Planning and Purchasing.", "[Book II §4.2]"],
        ["§4.4", "Duplicate check: similarity at or above 0.9 in the same group L1 warns and needs a reason; identical MPN and manufacturer is a hard block (E-MM-02).", "[Book II §4.4]"],
        ["V-MM-01", "Activation by the Materials Manager only when every mandatory-for-use field is filled; activation unblocks the originating EBOM line, PR or quote.", "[Book II §4.2, §4.3]"],
        ["RD-MM-01..05", "Task owners and placeholder behaviour where the matrix is silent are readings.", "README Readings"],
      ]}
    />
  )
}

// ============================================================================ create (C-47)
function NewMcrDialog({ open, copyFrom, onClose, onCreated }: { open: boolean; copyFrom?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const s = useSlice("materials")
  const src = copyFrom ? getMaterial(s, copyFrom) : undefined
  const srcV = copyFrom ? s.views[copyFrom] : undefined
  const [type, setType] = useState<MaterialType>(src?.type ?? "RAW")
  const [desc, setDesc] = useState(src ? `${src.description} (copy)` : "")
  const [l1, setL1] = useState(srcV?.groupPath[0] ?? "")
  const [l2, setL2] = useState(srcV?.groupPath[1] ?? "")
  const [uom, setUom] = useState(src?.baseUom ?? "EA")
  const [path, setPath] = useState<McrRecord["path"]>("Purchasing Initiated")
  const [mfr, setMfr] = useState("")
  const [mpn, setMpn] = useState("")
  const [cost, setCost] = useState("")
  const [note, setNote] = useState("")
  const [qi, setQi] = useState(false)
  const groups = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const v of Object.values(s.views)) if (v.groupPath[0]) m.set(v.groupPath[0], (m.get(v.groupPath[0]) ?? new Set()).add(v.groupPath[1] ?? ""))
    return m
  }, [s.views])
  const dups = desc.trim().length >= 8 && l1 ? duplicateCandidates(s, desc, l1, mpn) : []
  const hard = dups.some((d) => d.score >= DUPLICATE_THRESHOLD)
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      wide
      title={copyFrom ? `New material request, copied from ${copyFrom}` : "New material request"}
      description="Reserves the material number in Draft and generates the department tasks for the chosen type (Book II §4.2)."
      consequence="Creates the MCR and a Draft material record. Submit it from the request to start the task SLAs."
      confirmLabel="Create request"
      onConfirm={() =>
        confirmRun(
          createMcr({ type, description: desc, groupL1: l1, groupL2: l2, uom, path, manufacturer: mfr || undefined, mpn: mpn || undefined, estCost: cost ? Number(cost) : undefined, duplicateNote: note || undefined, qi: type === "TRADE" || type === "SPARE" ? qi : undefined }),
          (id) => {
            setTimeout(() => onCreated(id), 0)
            return `${id} created; number reserved in Draft`
          },
        )
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="mcr-type">Material type (immutable)</Label>
          <Select value={type} onValueChange={(v) => setType(v as MaterialType)}>
            <SelectTrigger id="mcr-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mcr-path">Path</Label>
          <Select value={path} onValueChange={(v) => setPath(v as McrRecord["path"])}>
            <SelectTrigger id="mcr-path">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["Purchasing Initiated", "Sales Initiated", "Engineering Placeholder", "Migration"] as const).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label htmlFor="mcr-desc">Short description</Label>
          <Input id="mcr-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. HV condenser bushing, 145 kV, 1,250 A" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mcr-l1">Group level 1</Label>
          <Select value={l1} onValueChange={(v) => (setL1(v), setL2(""))}>
            <SelectTrigger id="mcr-l1">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {[...groups.keys()].sort().map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mcr-l2">Group level 2</Label>
          <Select value={l2} onValueChange={setL2} disabled={!l1}>
            <SelectTrigger id="mcr-l2">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {[...(groups.get(l1) ?? [])].filter(Boolean).map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mcr-uom">Base UoM</Label>
          <Select value={uom} onValueChange={setUom}>
            <SelectTrigger id="mcr-uom">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["EA", "KG", "L", "M", "HR", "SET"].map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mcr-cost">Estimated cost (USD per base unit)</Label>
          <Input id="mcr-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mcr-mfr">Manufacturer</Label>
          <Input id="mcr-mfr" value={mfr} onChange={(e) => setMfr(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mcr-mpn">Manufacturer part number</Label>
          <Input id="mcr-mpn" value={mpn} onChange={(e) => setMpn(e.target.value)} />
        </div>
        {(type === "TRADE" || type === "SPARE") && (
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <Checkbox checked={qi} onCheckedChange={(x) => setQi(!!x)} /> QI at receipt (type default Config): adds the Quality task <Reading id="RD-MM-03" />
          </label>
        )}
      </div>
      {dups.length > 0 && (
        <Section title="Possible duplicates (description in the same group L1, or manufacturer part number)">
          <ul className="text-sm">
            {dups.map((d) => (
              <li key={d.m.id}>
                <MatLink id={d.m.id} /> {d.m.description} · {d.by} similarity {d.score.toFixed(2)}
                {d.score >= DUPLICATE_THRESHOLD && " (at or above 0.9)"}
              </li>
            ))}
          </ul>
          {hard && (
            <>
              <Label htmlFor="mcr-note">Not a duplicate because... (required)</Label>
              <Textarea id="mcr-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </>
          )}
        </Section>
      )}
    </DialogShell>
  )
}

// ============================================================================ detail (MM-MCR-002)
export function McrDetail() {
  const { id = "" } = useParams()
  const s = useSlice("materials")
  const [role] = useRole()
  const r = s.mcrs.find((x) => x.id === id)
  const [dlg, setDlg] = useState<null | "activate" | "reject" | "withdraw" | "reassign">(null)
  const [taskId, setTaskId] = useState("")
  const [user, setUser] = useState<string>("")
  if (!r)
    return (
      <EmptyState title={`Material creation request ${id} not found`}>
        <Link to="/materials/creation-requests" className="text-link underline">
          Back to the queue
        </Link>
      </EmptyState>
    )
  const m = r.materialId ? getMaterial(s, r.materialId) : undefined
  const comp = m ? completeness(m, s.views[m.id]) : undefined
  const closed = r.stage === "Activated" || r.stage === "Withdrawn"
  const task = r.tasks.find((t) => t.id === taskId)
  const primary =
    r.stage === "Draft" ? (
      <Button onClick={() => run(submitMcr(r.id), "Submitted; tasks sent to owners with a 2 business day SLA")}>Submit for completion</Button>
    ) : r.stage === "Ready to activate" ? (
      <Button onClick={() => setDlg("activate")}>Activate</Button>
    ) : undefined
  const checklist = (
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead>View task</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>SLA</TableHead>
          <TableHead>Done</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {r.tasks.map((t) => {
          const blockers = taskBlockedBy(t, r.tasks)
          const mineTask = t.ownerRole === role
          return (
            <TableRow key={t.id} className="h-10 align-top text-sm">
              <TableCell>
                {t.view}
                {blockers.length > 0 && !t.done && <div className="text-xs text-muted-foreground">Waits for {blockers.join(" and ")}</div>}
                {t.comment && <div className="text-xs text-destructive">Returned: {t.comment}</div>}
              </TableCell>
              <TableCell>
                {t.ownerRole}
                <div className="text-xs text-muted-foreground">{userName(t.ownerUserId)}</div>
              </TableCell>
              <TableCell>{r.stage === "Draft" ? <span className="text-xs text-muted-foreground">Starts on submit</span> : <>
                    <SlaTag state={slaState(t)} due={t.done ? undefined : t.slaDue} />
                    {slaState(t) === "Breached" && <span className="ml-1 text-xs">escalated to the {ESCALATE_TO[t.ownerRole] ?? "Materials Manager"}</span>}
                  </>}</TableCell>
              <TableCell className="text-xs">{t.done ? `${fmtDate(t.doneOn)} by ${userName(t.doneBy)}` : ""}</TableCell>
              <TableCell className="text-right">
                {r.stage === "Tasks open" && !t.done && (
                  <span className="inline-flex gap-1">
                    <Button size="sm" variant={mineTask ? "default" : "outline"} disabled={!mineTask || blockers.length > 0} title={!mineTask ? `Owned by the ${t.ownerRole}; switch Acting as` : undefined} onClick={() => run(completeTask(r.id, t.id), `${t.view} done`)}>
                      Complete my task
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => (setTaskId(t.id), setUser(""), setDlg("reassign"))}>
                      Reassign
                    </Button>
                  </span>
                )}
                {(r.stage === "Tasks open" || r.stage === "Ready to activate") && t.done && (
                  <Button size="sm" variant="ghost" onClick={() => (setTaskId(t.id), setDlg("reject"))}>
                    Reject to task
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
  return (
    <>
      <DetailPage
        header={{
          screenId: "MM-MCR-001/2",
          title: `${r.id} ${r.description}`,
          crumbs: [{ label: "Creation requests", to: "/materials/creation-requests" }, { label: r.id }],
          chips: (
            <>
              <span className="rounded-md border px-2 py-0.5 text-sm">Stage: {r.stage}</span>
              <NoStatusList />
            </>
          ),
          primary,
          actions:
            r.stage === "Draft" ? (
              <Button variant="outline" onClick={() => setDlg("withdraw")}>
                Withdraw
              </Button>
            ) : undefined,
        }}
        doc={{ type: "mcr", id: r.id }}
        summary={
          <>
            <KV k="Material">{m ? <MatLink id={m.id} /> : "Number released"}</KV>
            <KV k="Material status">{m ? <MaterialStatus m={m} /> : "None"}</KV>
            <KV k="Type / UoM">
              {r.requestedType} / {r.uom}
            </KV>
            <KV k="Completeness">{comp ? <Completeness pct={comp.pct} active /> : "n/a"}</KV>
            <KV k="Path">{r.path}</KV>
            <KV k="Origin">{r.originRef ? <span className="font-mono">{r.originRef.id}</span> : "None"}</KV>
            <KV k="Created">
              {fmtDate(r.createdOn)} by {userName(r.createdBy)}
            </KV>
            <KV k="Estimated cost">{r.estCost != null ? fmtMoney(r.estCost) : "Not given"}</KV>
          </>
        }
        tabs={[
          { id: "tasks", label: "Task checklist", count: r.tasks.length, content: checklist },
          {
            id: "request",
            label: "Request",
            content: (
              <dl className="grid max-w-3xl grid-cols-2 gap-4">
                <KV k="Material group">{r.group}</KV>
                <KV k="Target vendor">{r.targetVendor ?? "None"}</KV>
                <KV k="Duplicate check">{r.duplicateNote ?? "No candidate at or above 0.9"}</KV>
                <KV k="Activated">{r.activatedOn ? `${fmtDate(r.activatedOn)} by ${userName(r.activatedBy)}` : "Not yet"}</KV>
                <KV k="Placeholder rule">{r.path === "Engineering Placeholder" ? <Reading id="RD-MM-04" /> : "n/a"}</KV>
                <KV k="Missing for use">{comp?.missing.length ? comp.missing.join("; ") : "Nothing"}</KV>
              </dl>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <ul className="flex flex-col gap-1 text-sm">
                {r.activity.map((a, i) => (
                  <li key={i}>
                    <span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
        aside={
          closed ? (
            <p className="rounded-md border p-3 text-sm">
              {r.stage === "Activated" ? (
                <>
                  Closed: material <DocLinkText to={R.material(r.materialId!)}>{r.materialId}</DocLinkText> is Active.
                </>
              ) : (
                "Withdrawn: the Draft number was released."
              )}
            </p>
          ) : undefined
        }
      />
      <McrRules />
      <DialogShell
        open={dlg === "activate"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Activate ${r.materialId}`}
        description={`Acting as ${role}. Activation is pressed by the Materials Manager.`}
        consequence={`${r.materialId} moves from Data Completion to Active after V-MM-01; ${r.id} closes${r.originRef ? ` and ${r.originRef.id} is unblocked` : ""}.`}
        confirmLabel="Activate material"
        onConfirm={() => confirmRun(activateMcr(r.id), `${r.materialId} is Active`)}
      />
      <DialogShell
        open={dlg === "reject"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Reject to task: ${task?.view ?? ""}`}
        consequence={`The ${task?.view} task reopens for the ${task?.ownerRole} with a new 2 business day SLA.`}
        requireReason
        reasonLabel="Comment for the task owner (required)"
        confirmLabel="Reject to task"
        onConfirm={(reason) => confirmRun(rejectToTask(r.id, taskId, reason), `${task?.view} returned`)}
      />
      <DialogShell
        open={dlg === "withdraw"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Withdraw ${r.id}`}
        consequence={`The Draft material ${r.materialId ?? ""} has no references; it is removed and its number released (Book II §4.1).`}
        requireReason
        destructive
        confirmLabel="Withdraw request"
        onConfirm={(reason) => confirmRun(withdrawMcr(r.id, reason), `${r.id} withdrawn`)}
      />
      <DialogShell
        open={dlg === "reassign"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Reassign ${task?.view ?? ""}`}
        confirmLabel="Reassign"
        confirmDisabled={!user}
        onConfirm={() => confirmRun(reassignTask(r.id, taskId, user as UserId), "Task reassigned")}
      >
        <Label htmlFor="ra-user">New owner ({task?.ownerRole})</Label>
        <Select value={user} onValueChange={setUser}>
          <SelectTrigger id="ra-user">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {USERS.filter((u) => task && u.roles.includes(task.ownerRole)).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogShell>
    </>
  )
}
