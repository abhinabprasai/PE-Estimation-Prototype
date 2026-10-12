// ENG-REQ-001 Engineering Request (Detail) [DOC:p.59 §2; p.255] (asserted), with its register.
// The design job container linking EBOM, drawings, MBOM, estimate and the sales milestone. Created
// automatically when an ETO order confirms; the Engineering Manager assigns, engineers execute.

import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { USERS, CUSTOMERS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import type { UserId } from "@/data/domain"
import { DetailState, NoPostings, RefLink, StatePreview, useAct, useActDialog, useScreenState } from "../components"
import { checklistProgress, rowDone, rowStatus, userName } from "../data/logic"
import * as act from "../data/actions"
import type { DesignType, ErRecord } from "../data/types"

const customerName = (id: string) => CUSTOMERS.find((c) => c.id === id)?.name ?? id

export function RequestList() {
  const s = useSlice("engineering")
  const st = useScreenState("ENG-REQ-001-list")
  const rows = st.empty ? [] : s.requests
  const columns: Column<ErRecord>[] = [
    { id: "id", header: "Request", value: (r) => r.id, sortable: true, mono: true },
    { id: "so", header: "SO line", value: (r) => `${r.soId} / ${r.soLine}`, cell: (r) => <span className="font-mono">{r.soId} / {r.soLine}</span> },
    { id: "cust", header: "Customer", value: (r) => customerName(r.customerId), sortable: true },
    { id: "title", header: "Design", value: (r) => r.title },
    { id: "type", header: "Design type", value: (r) => r.designType, filterable: true },
    { id: "level", header: "Release level", value: (r) => r.releaseLevel, filterable: true, cell: (r) => <StatusBadge kind="releaseLevel" status={r.releaseLevel} size="sm" /> },
    { id: "due", header: "Design due", value: (r) => r.due, cell: (r) => fmtDate(r.due), sortable: true },
    { id: "eng", header: "Engineers", value: (r) => r.assigneeIds.map(userName).join(", ") || "Unassigned" },
    { id: "prog", header: "Deliverables", align: "right", value: (r) => checklistProgress(s, r).done, cell: (r) => { const p = checklistProgress(s, r); return `${p.done} of ${p.total}` } },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, sortable: true, cell: (r) => <StatusBadge kind="engineeringRequest" status={r.status} size="sm" /> },
  ]
  return (
    <ListPage<ErRecord>
      header={{
        title: "Engineering requests",
        screenId: "ENG-REQ-001",
        description: "One request per ETO or MTO order line, created automatically when the order confirms. Open one to assign engineers, track deliverables and release the design.",
      }}
      table={{
        rows, columns, rowId: (r) => r.id, rowHref: (r) => `/engineering/requests/${r.id}`, searchText: (r) => `${r.id} ${r.soId} ${r.title} ${customerName(r.customerId)}`,
        loading: st.loading, error: st.error, onRetry: st.retry, initialSort: { id: "due", dir: "asc" }, toolbar: <StatePreview />,
        empty: { title: "No engineering requests yet", body: "A request appears here when Sales confirms an order line that needs design (ETO or MTO)." },
      }}
    />
  )
}

export function RequestDetail() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useScreenState("ENG-REQ-001")
  const er = s.requests.find((r) => r.id === id)
  return (
    <DetailState state={st} found={!!er} what={`Engineering request ${id}`} back={{ to: "/engineering/requests", label: "Back to engineering requests" }}>
      {er && <RequestBody er={er} />}
    </DetailState>
  )
}

function RequestBody({ er }: { er: ErRecord }) {
  const s = useSlice("engineering")
  const [role] = useRole()
  const nav = useNavigate()
  const run = useAct()
  const runD = useActDialog()
  const [dlg, setDlg] = useState<null | "assign" | "block" | "release" | "complete" | "due" | "level" | "type">(null)
  const [dt, setDt] = useState<{ type: DesignType; base: string }>({ type: er.designType, base: er.baseDesignEbomId ?? "" })
  const releasedEboms = s.eboms.filter((x) => x.status === "Released")
  const typeChangeable = (er.status === "Open" || er.status === "In Design") && !er.checklist.some((r) => r.ref && (r.ref.type === "ebom" || r.ref.type === "mbom"))
  const [pick, setPick] = useState<UserId[]>(er.assigneeIds)
  const [due, setDue] = useState(er.due)
  const prog = checklistProgress(s, er)
  const isEM = role === "Engineering Manager"
  const ebomRow = er.checklist.find((r) => r.key === "ebom")
  const ebomId = ebomRow?.ref?.id
  const trs = s.transmittals.filter((t) => t.engineeringRequestId === er.id)
  const engineers = USERS.filter((u) => u.roles.includes("Engineer"))
  const emOnly = isEM ? undefined : "The Engineering Manager does this (switch Acting as)"

  let primary = null
  if (er.status === "Open") primary = <Button disabled={!isEM} title={emOnly} onClick={() => setDlg("assign")}>Assign engineers</Button>
  else if (er.status === "In Design" && er.customerApprovalRequired && !er.customerApprovalEvidence)
    primary = <Button onClick={() => nav(`/engineering/transmittals/new?er=${er.id}`)}>Send drawings for approval</Button>
  else if (er.status === "In Design" || er.status === "Customer Review") primary = <Button disabled={!isEM} title={emOnly} onClick={() => setDlg("release")}>Release design</Button>
  else if (er.status === "Released") primary = <Button onClick={() => setDlg("complete")}>Complete request</Button>
  else if (er.status === "Blocked") primary = <Button onClick={() => run((d, c) => act.unblockEr(d, c, er.id), `${er.id} unblocked`)}>Unblock</Button>

  const terminal = er.status === "Closed"
  return (
    <>
      <DetailPage
        header={{
          title: `${er.id} ${er.title}`,
          screenId: "ENG-REQ-001",
          crumbs: [{ label: "Engineering requests", to: "/engineering/requests" }, { label: er.id }],
          description: `${er.designType} for ${customerName(er.customerId)}, ${er.soId} line ${er.soLine}.${er.blockedReason ? ` Blocked: ${er.blockedReason}` : ""}`,
          chips: (
            <>
              {er.customerApprovalRequired && <Chip kind="flag" note="Customer approval loop is on: the Drawing Approval milestone applies">Customer approval</Chip>}
              {er.status === "Blocked" && <Chip kind="block" note={er.blockedReason}>Blocked: {er.blockedReason}</Chip>}
              {er.readings?.map((r) => <Chip key={r} kind="oq" id={r} />)}
            </>
          ),
          primary,
          actions: !terminal && (
            <>
              {er.status !== "Open" && er.status !== "Released" && <Button variant="outline" disabled={!isEM} title={emOnly} onClick={() => setDlg("assign")}>Assign engineers</Button>}
              {er.status !== "Blocked" && er.status !== "Released" && <Button variant="outline" onClick={() => setDlg("block")}>Block</Button>}
              <Button variant="outline" disabled={!isEM} title={emOnly} onClick={() => setDlg("level")}>Advance release level</Button>
              <Button variant="ghost" disabled={!isEM} title={emOnly} onClick={() => setDlg("due")}>Edit due date</Button>
              {typeChangeable && <Button variant="outline" disabled={!isEM} title={emOnly} onClick={() => { setDt({ type: er.designType, base: er.baseDesignEbomId ?? releasedEboms[0]?.id ?? "" }); setDlg("type") }}>Set design type</Button>}
            </>
          ),
        }}
        status={{ kind: "engineeringRequest", value: er.status }}
        doc={{ type: "engineeringRequest", id: er.id }}
        summary={
          <>
            <KV k="Sales order line"><RefLink r={{ type: "salesOrder", id: er.soId }}>{`${er.soId} / ${er.soLine}`}</RefLink></KV>
            <KV k="Customer">{customerName(er.customerId)}</KV>
            <KV k="Item"><span className="font-mono">{er.itemId}</span></KV>
            <KV k="Design type">{er.designType}{er.baseDesignEbomId && <> from <RefLink r={{ type: "ebom", id: er.baseDesignEbomId }} /></>}{typeChangeable && er.activity.some((a) => a.text.startsWith("Created automatically")) && er.designType === "New Design" && <Chip kind="design" note="The PRD does not say who picks the design type when the request is auto-created; it opens as New Design and the Engineering Manager sets it (reading R-ER-1)">default</Chip>}</KV>
            <KV k="Release level"><StatusBadge kind="releaseLevel" status={er.releaseLevel} size="sm" /></KV>
            <KV k="Design due date">
              {fmtDate(er.due)}
              <span className="block text-xs text-muted-foreground">Promised ship {fmtDate(er.promisedShip)} − production {er.productionLeadDays} d − long-lead {er.longLeadDays} d <Chip kind="design" note="Lead times are design values; the formula is the PRD's [DOC:p.59]">lead times</Chip></span>
            </KV>
            <KV k="Engineers">{er.assigneeIds.length ? er.assigneeIds.map(userName).join(", ") : "Unassigned"}</KV>
            <KV k="Deliverables">{prog.done} of {prog.total} done</KV>
          </>
        }
        tabs={[
          {
            id: "checklist", label: "Deliverables", count: er.checklist.length,
            content: (
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-table-head">
                      <TableRow><TableHead>Deliverable</TableHead><TableHead>Object</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Done</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {er.checklist.map((r) => {
                        const rs = rowStatus(s, r)
                        const done = rowDone(s, r)
                        const manual = !r.ref || r.ref.type === "costEstimate"
                        return (
                          <TableRow key={r.key} className="h-8 text-[13px]">
                            <TableCell>{r.item}</TableCell>
                            <TableCell>{r.ref ? <RefLink r={r.ref} /> : r.key === "ebom" && !terminal ? <Link className="text-link underline" to="/engineering/boms">Create or copy an EBOM</Link> : <span className="text-muted-foreground">No linked object</span>}</TableCell>
                            <TableCell>{rs.kind ? <StatusBadge kind={rs.kind} status={rs.value} size="sm" /> : <span>{rs.value}</span>}</TableCell>
                            <TableCell>
                              <Checkbox
                                aria-label={`${r.item} done`}
                                checked={done}
                                disabled={!manual || terminal}
                                title={manual ? undefined : "Follows the linked object's status"}
                                onCheckedChange={(v) => run((d, c) => act.setChecklistDone(d, c, er.id, r.key, !!v))}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">Rows linked to an object follow its status (a drawing counts when a revision is Released, the EBOM when Released, the MBOM when Active). The request completes only when every row is done.</p>
              </div>
            ),
          },
          {
            id: "config", label: "Configuration",
            content: (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Read only: the configuration attribute set carried from {er.soId} line {er.soLine}.</p>
                <dl className="grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-3">{er.config.map(([k, v]) => <KV key={k} k={k}>{v}</KV>)}</dl>
              </div>
            ),
          },
          {
            id: "approval", label: "Customer approval", count: trs.length,
            content: (
              <div className="flex max-w-3xl flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Switch id="cust-appr" checked={er.customerApprovalRequired} disabled={terminal || er.status === "Released"} onCheckedChange={() => run((d, c) => act.toggleCustomerApproval(d, c, er.id))} />
                  <Label htmlFor="cust-appr">Customer approval required (inserts the Drawing Approval milestone)</Label>
                </div>
                <p className="text-sm">
                  Evidence: {er.customerApprovalEvidence ? <RefLink r={{ type: "transmittal", id: er.customerApprovalEvidence }} /> : "none yet"} · review loops {er.reviewLoops}
                </p>
                {trs.length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {trs.map((t) => (
                      <li key={t.id}>
                        <RefLink r={{ type: "transmittal", id: t.id }} /> {t.purpose}, sent {fmtDate(t.sentOn)}: {t.responses.length ? t.responses.map((x) => `${x.response} (${fmtDate(x.on)})`).join(", ") : "awaiting response"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No transmittal yet.</p>
                )}
                {!terminal && <div><Button variant="outline" onClick={() => nav(`/engineering/transmittals/new?er=${er.id}`)}>New transmittal</Button></div>}
              </div>
            ),
          },
          {
            id: "activity", label: "Activity", count: er.activity.length,
            content: <ul className="flex flex-col gap-1 text-sm">{[...er.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}</ul>,
          },
        ]}
      />
      <NoPostings />
      <RulesPanel
        rules={[
          ["ENG-REQ", "Created automatically when an ETO order confirms; Engineering Manager assigns, engineers execute", "DOC:p.255"],
          ["Due date", "Back-scheduled: promised ship date − production lead time − procurement long-lead time; editable by the Engineering Manager with a schedule-impact warning to the SO", "DOC:p.59 §2"],
          ["Checklist", "Generated from design type; each row links its object and shows status; request completes only when all rows are done", "DOC:p.59 §2"],
          ["Status", "Open → In Design → Customer Review (optional loop) → Released → Closed; Blocked (with reason) from any state", "DOC:p.59 §2"],
          ["C-21", "Release levels move forward only, except via ECO", "DOC:p.209 §3.1"],
          ["FL-02", "Configuration change after Design Release only via ECR → Sales Change Order", "DOC:p.177 f11"],
        ]}
      />

      <DialogShell open={dlg === "assign"} onOpenChange={(o) => !o && setDlg(null)} title={`Assign engineers to ${er.id}`} confirmLabel="Assign"
        consequence={er.status === "Open" ? `${er.id} moves from Open to In Design.` : "Replaces the assigned engineers."}
        onConfirm={() => runD((d, c) => act.assignEngineers(d, c, er.id, pick), `${er.id} assigned`)}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Electrical and mechanical designers</legend>
          {engineers.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={pick.includes(u.id)} onCheckedChange={(v) => setPick((p) => (v ? [...p, u.id] : p.filter((x) => x !== u.id)))} />
              {u.name}
            </label>
          ))}
        </fieldset>
      </DialogShell>
      <DialogShell open={dlg === "block"} onOpenChange={(o) => !o && setDlg(null)} title={`Block ${er.id}`} confirmLabel="Block" destructive requireReason reasonLabel="Reason (required, shown on the request)"
        consequence={`${er.id} moves to Blocked; Unblock returns it to ${er.status}.`} onConfirm={(r) => runD((d, c) => act.blockEr(d, c, er.id, r), `${er.id} blocked`)} />
      <DialogShell open={dlg === "release"} onOpenChange={(o) => !o && setDlg(null)} title={`Release design ${er.id}`} confirmLabel="Release design"
        consequence={`${er.id} moves to Released and its release level to Released for Production. Needs ${ebomId ?? "the EBOM"} Released, every linked drawing Released${er.customerApprovalRequired ? " and the customer's approval evidence" : ""}.`}
        onConfirm={() => runD((d, c) => act.releaseDesign(d, c, er.id), `${er.id} released`)} />
      <DialogShell open={dlg === "complete"} onOpenChange={(o) => !o && setDlg(null)} title={`Complete ${er.id}`} confirmLabel="Complete"
        consequence={`${er.id} moves to Closed (terminal, read-only). ${prog.done} of ${prog.total} deliverables are done.`} onConfirm={() => runD((d, c) => act.completeEr(d, c, er.id), `${er.id} closed`)} />
      <DialogShell open={dlg === "level"} onOpenChange={(o) => !o && setDlg(null)} title="Advance release level" confirmLabel="Advance"
        consequence={`Moves ${er.id} from ${er.releaseLevel} to the next level. Levels only move forward; going back starts an ECO (C-21).`} onConfirm={() => runD((d, c) => act.advanceReleaseLevel(d, c, er.id), "Release level advanced")} />
      <DialogShell open={dlg === "type"} onOpenChange={(o) => !o && setDlg(null)} title={`Design type for ${er.id}`} confirmLabel="Set design type"
        consequence={dt.type === "New Design" ? "Regenerates the full deliverables checklist; no starting point is copied."
          : dt.type === "Variant of Existing" ? `Copies ${dt.base || "the base design"}'s EBOM (as a new Draft EBOM) and its released drawing set (as WIP rev A) as the starting point, and links them to the checklist.`
          : `Repeat: no engineering. ${er.id} completes now (Closed) and the Active MBOM of ${dt.base || "the released design"} is released to ${er.soId} line ${er.soLine} immediately.`}
        onConfirm={() => runD((d, c) => act.setDesignType(d, c, er.id, dt.type, dt.type === "New Design" ? undefined : dt.base), "Design type set")}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Design type</legend>
          {(["New Design", "Variant of Existing", "Repeat"] as DesignType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm"><input type="radio" name="dtype" checked={dt.type === t} onChange={() => setDt({ ...dt, type: t })} />{t}</label>
          ))}
        </fieldset>
        {dt.type !== "New Design" && (
          <div className="flex flex-col gap-1">
            <Label>Base design (Released EBOM)</Label>
            <Select value={dt.base} onValueChange={(v) => setDt({ ...dt, base: v })}>
              <SelectTrigger aria-label="Base design"><SelectValue placeholder="Pick a released EBOM" /></SelectTrigger>
              <SelectContent>{releasedEboms.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} rev {x.rev} · {x.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </DialogShell>
      <DialogShell open={dlg === "due"} onOpenChange={(o) => !o && setDlg(null)} title="Edit design due date" confirmLabel="Save due date"
        consequence={`Sends a schedule-impact warning to ${er.soId}.`} onConfirm={() => runD((d, c) => act.setDueDate(d, c, er.id, due), "Due date saved")}>
        <Label htmlFor="due">Design due date</Label>
        <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </DialogShell>
    </>
  )
}
