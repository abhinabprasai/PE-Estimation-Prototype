// ENG-ECR/ECO Change Requests and Change Orders [DOC:p.62 §4.1-4.2; p.256; p.209 §3.2] (asserted).
// ECR: computed impact panel (open orders, stock, POs, cost delta simulation); submitted to the CCB
// through the shared approval engine (C-1). ECO: task checklist, effectivity selector (Date, Serial,
// Immediate), old-stock and open-order disposition grids, LLR commercial decisions, and an atomic
// release at effectivity. ECR and ECO have no status list in the PRD (OQ-21): stage is text.

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ApprovalButton, Chip, EmptyState, ErrorAlert, KV, RulesPanel, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage, WizardPage } from "@/components/templates"
import type { DocRef, MaterialId } from "@/data/domain"
import { CUSTOMERS, TODAY } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { DetailState, Item, RefLink, StageText, StatePreview, useAct, useActDialog, useScreenState } from "../components"
import { ccbLabel, ccbMembers, ccbSla, CCB_COST_THRESHOLD, ecoBlockers, itemDesc, pickableMaterials, userName } from "../data/logic"
import * as act from "../data/actions"
import type { CcbVoteValue, EbomChange, EcoRecord, EcrClass, EcrPriority, EcrRecord, EcrSource, EffectivityMode, LlrDecision, StockDisposition, WoDisposition } from "../data/types"
import type { EngineeringState } from "../data/slice"

const customerName = (id: string) => CUSTOMERS.find((c) => c.id === id)?.name ?? id
const SOURCES: EcrSource[] = ["Engineering", "Production", "Quality (NCR link)", "Purchasing", "Sales", "RMA/Field Failure"]
const CLASSES: EcrClass[] = ["Safety/Regulatory", "Cost Reduction", "Quality/CAPA", "Supply Continuity", "Customer Request", "Documentation Only"]
const PRIORITIES: EcrPriority[] = ["Emergency", "Urgent", "Standard"]
const STOCK_DISP: StockDisposition[] = ["Use-Up", "Rework", "Scrap", "Return to Vendor (RTV)"]
const WO_DISP: WoDisposition[] = ["Complete As-Is", "Incorporate Change", "Stop & Rework"]
const LLR_DEC: LlrDecision[] = ["Proceed", "Change order to vendor", "Stop with exposure booking"]

function ChangeTabs({ active }: { active: "ecr" | "eco" }) {
  return (
    <nav aria-label="Change records" className="flex gap-1 border-b">
      <Link to="/engineering/change-requests" aria-current={active === "ecr" ? "page" : undefined} className={active === "ecr" ? "h-8 border-b-2 border-primary px-3 text-sm font-semibold" : "h-8 px-3 text-sm text-muted-foreground"}>Change requests (ECR)</Link>
      <Link to="/engineering/change-orders" aria-current={active === "eco" ? "page" : undefined} className={active === "eco" ? "h-8 border-b-2 border-primary px-3 text-sm font-semibold" : "h-8 px-3 text-sm text-muted-foreground"}>Change orders (ECO)</Link>
    </nav>
  )
}

const opText = (s: EngineeringState, ebomId: string, op: EbomChange["ops"][number]) => {
  const l = op.kind !== "add" ? s.eboms.find((e) => e.id === ebomId)?.lines.find((x) => x.no === op.line) : undefined
  if (op.kind === "replace") return `Line ${op.line}: replace ${l?.componentId ?? "?"} with ${op.componentId}`
  if (op.kind === "qty") return `Line ${op.line}: quantity ${l ? fmtNumber(l.qty, 2) : "?"} to ${fmtNumber(op.qty, 2)} ${l?.uom ?? ""}`
  if (op.kind === "remove") return `Line ${op.line}: remove ${l?.componentId ?? ""}`
  return `Add line ${op.line.no}: ${op.line.componentId} × ${fmtNumber(op.line.qty, 2)}`
}

// ===================================================================================== ECR list
export function EcrList() {
  const s = useSlice("engineering")
  const st = useScreenState("ENG-ECR-list")
  const nav = useNavigate()
  const rows = st.empty ? [] : s.ecrs
  const columns: Column<EcrRecord>[] = [
    { id: "id", header: "ECR", value: (e) => e.id, sortable: true, mono: true },
    { id: "title", header: "Title", value: (e) => e.title, cell: (e) => <span className="inline-flex flex-wrap items-center gap-1">{e.title}{e.emergency && <Chip kind="flag" note="Emergency: CCB decides within 24 hours">Emergency</Chip>}</span> },
    { id: "source", header: "Source", value: (e) => e.source, filterable: true },
    { id: "class", header: "Classification", value: (e) => e.classification, filterable: true },
    { id: "prio", header: "Priority", value: (e) => e.priority, filterable: true },
    { id: "raised", header: "Raised", value: (e) => e.raisedOn, cell: (e) => fmtDate(e.raisedOn), sortable: true },
    { id: "delta", header: "Cost delta", align: "right", value: (e) => e.costDelta ?? 0, cell: (e) => (e.costDelta == null ? "Not simulated" : `${e.costDelta >= 0 ? "+" : ""}${fmtMoney(e.costDelta)}`), sortable: true },
    { id: "eco", header: "ECO", value: (e) => e.ecoId ?? "", cell: (e) => (e.ecoId ? <RefLink r={{ type: "eco", id: e.ecoId }} /> : "") },
    { id: "stage", header: "Stage", value: (e) => e.stage, filterable: true, cell: (e) => <span className="text-sm">{e.stage}</span> },
  ]
  return (
    <ListPage<EcrRecord>
      header={{
        title: "Change requests and change orders",
        screenId: "ENG-ECR/ECO",
        description: "Anyone raises an ECR; the CCB decides in WF-INBOX; an approved ECR spawns an ECO that the Engineering Manager releases atomically at effectivity.",
        primary: <Button onClick={() => nav("/engineering/change-requests/new")}>Raise ECR</Button>,
        chips: <Chip kind="oq" id="OQ-21" note="ECR and ECO have no status list in the PRD; stage is shown as text, never a badge" />,
      }}
      above={<ChangeTabs active="ecr" />}
      table={{
        rows, columns, rowId: (e) => e.id, rowHref: (e) => `/engineering/change-requests/${e.id}`, searchText: (e) => `${e.id} ${e.title} ${e.source} ${e.classification}`,
        loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "id", dir: "desc" },
        empty: { title: "No change requests", body: "Raise one here, or use Propose Change on an EBOM, NCR or supplier deviation." },
      }}
    />
  )
}

// ===================================================================================== ECO list
export function EcoList() {
  const s = useSlice("engineering")
  const st = useScreenState("ENG-ECO-list")
  const rows = st.empty ? [] : s.ecos
  const columns: Column<EcoRecord>[] = [
    { id: "id", header: "ECO", value: (e) => e.id, sortable: true, mono: true },
    { id: "title", header: "Title", value: (e) => e.title },
    { id: "ecr", header: "From ECR", value: (e) => e.ecrIds.join(", "), cell: (e) => (e.ecrIds.length ? e.ecrIds.map((x) => <RefLink key={x} r={{ type: "ecr", id: x }} />) : <span className="text-muted-foreground">Mass update</span>) },
    { id: "eff", header: "Effectivity", value: (e) => e.effectivity, filterable: true, cell: (e) => `${e.effectivity}${e.effectivity === "Date" && e.effectiveOn ? ` ${fmtDate(e.effectiveOn)}` : e.effectivity === "Serial" && e.fromSerial ? ` from ${e.fromSerial}` : ""}` },
    { id: "tasks", header: "Tasks", align: "right", value: (e) => e.tasks.filter((t) => t.done).length, cell: (e) => `${e.tasks.filter((t) => t.done).length} of ${e.tasks.length}` },
    { id: "block", header: "Release blockers", align: "right", value: (e) => (e.stage === "Open" ? ecoBlockers(e).length : 0), cell: (e) => (e.stage === "Open" ? ecoBlockers(e).length || "None" : "") },
    { id: "stage", header: "Stage", value: (e) => e.stage, filterable: true, cell: (e) => <span className="text-sm">{e.stage}</span> },
  ]
  return (
    <ListPage<EcoRecord>
      header={{
        title: "Change requests and change orders",
        screenId: "ENG-ECR/ECO",
        description: "Change orders carry the task checklist, effectivity and dispositions. Release is atomic: every new revision releases together, or nothing does.",
        chips: <Chip kind="oq" id="OQ-21" note="ECR and ECO have no status list in the PRD; stage is shown as text, never a badge" />,
      }}
      above={<ChangeTabs active="eco" />}
      table={{
        rows, columns, rowId: (e) => e.id, rowHref: (e) => `/engineering/change-orders/${e.id}`, searchText: (e) => `${e.id} ${e.title} ${e.ecrIds.join(" ")}`,
        loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "id", dir: "desc" },
        empty: { title: "No change orders", body: "An ECO is spawned when the CCB approves an ECR, or by an EBOM mass update." },
      }}
    />
  )
}

// ===================================================================================== New ECR (wizard)
export function EcrNew() {
  const s = useSlice("engineering")
  const [params] = useSearchParams()
  const nav = useNavigate()
  const runD = useActDialog()
  const pre = params.get("affected")
  const [f, setF] = useState({
    title: "", source: (params.get("source") as EcrSource) ?? "Engineering", sourceRef: params.get("ref") ?? "", classification: "Customer Request" as EcrClass, priority: "Standard" as EcrPriority, description: "", reason: "",
  })
  const [affected, setAffected] = useState<DocRef[]>(() => {
    if (!pre) return []
    const [type, id] = pre.split(":")
    return type && id ? [{ type: type as DocRef["type"], id }] : []
  })
  const [pick, setPick] = useState("ebom:EBOM-TBD-0301")
  const options = useMemo(
    () => [
      ...s.eboms.filter((e) => e.status === "Released" || e.status === "Draft").map((e) => ({ v: `ebom:${e.id}`, label: `EBOM ${e.id} rev ${e.rev} · ${e.title}` })),
      ...s.documents.filter((d) => d.revisions.some((r) => r.status === "Released")).map((d) => ({ v: `document:${d.id}`, label: `Document ${d.id} · ${d.title}` })),
      ...pickableMaterials().slice(0, 40).map((m) => ({ v: `material:${m.id}`, label: `Material ${m.id} · ${m.description}` })),
    ],
    [s.eboms, s.documents],
  )
  const srcRef = (): DocRef | undefined => {
    const v = f.sourceRef.trim()
    if (!v) return undefined
    const type = v.startsWith("NCR") ? "ncr" : v.startsWith("SO-") ? "salesOrder" : v.startsWith("RMA") ? "rma" : v.startsWith("DEV") ? "deviation" : undefined
    return type ? ({ type, id: v } as DocRef) : undefined
  }
  return (
    <WizardPage
      header={{ title: "Raise an engineering change request", screenId: "ENG-ECR/ECO", crumbs: [{ label: "Change requests", to: "/engineering/change-requests" }, { label: "New" }], description: "Anyone may raise an ECR. Impact is computed from the affected objects when it is created." }}
      onCancel={() => nav("/engineering/change-requests")}
      finishLabel="Create Draft ECR"
      consequence={`Creates a Draft ECR on ${affected.length} affected object${affected.length === 1 ? "" : "s"} with its computed impact. Nothing changes on the objects until an ECO releases.`}
      onFinish={() => {
        let id = ""
        const e = runD((d, c) => void (id = act.createEcr(d, c, { ...f, affected, sourceRef: srcRef() })), "ECR created")
        if (!e) nav(`/engineering/change-requests/${id}`)
        return e
      }}
      steps={[
        {
          id: "source", title: "Source and affected objects",
          validate: () => (affected.length ? null : "Name at least one affected object."),
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label>Source</Label>
                <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v as EcrSource })}>
                  <SelectTrigger aria-label="Source"><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ecr-ref">Source reference (NCR, SO, RMA or deviation number)</Label>
                <Input id="ecr-ref" value={f.sourceRef} placeholder="NCR-TBD-0044" onChange={(e) => setF({ ...f, sourceRef: e.target.value.toUpperCase() })} />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Affected objects</Label>
                <div className="flex gap-2">
                  <Select value={pick} onValueChange={setPick}>
                    <SelectTrigger aria-label="Object to add" className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => { const [type, id] = pick.split(":"); if (!affected.some((a) => a.id === id)) setAffected([...affected, { type: type as DocRef["type"], id }]) }}>Add</Button>
                </div>
                {affected.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {affected.map((a) => (
                      <li key={a.id} className="flex items-center gap-2"><span className="text-muted-foreground">{a.type}</span><span className="font-mono">{a.id}</span><Button size="sm" variant="ghost" onClick={() => setAffected(affected.filter((x) => x.id !== a.id))}>Remove</Button></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ),
        },
        {
          id: "what", title: "What and why",
          validate: () => (!f.title.trim() ? "Enter a title." : !f.description.trim() || !f.reason.trim() ? "Describe what changes and why." : null),
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="ecr-title">Title</Label><Input id="ecr-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
              <div className="flex flex-col gap-1">
                <Label>Classification</Label>
                <Select value={f.classification} onValueChange={(v) => setF({ ...f, classification: v as EcrClass })}><SelectTrigger aria-label="Classification"><SelectValue /></SelectTrigger><SelectContent>{CLASSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Priority</Label>
                <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as EcrPriority })}><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
                {f.priority === "Emergency" && <span className="text-xs text-muted-foreground">Emergency: the CCB decides within 24 hours and the ECO defaults to Immediate effectivity with a Quality Manager joint release.</span>}
              </div>
              <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="ecr-desc">Description of the change</Label><Textarea id="ecr-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
              <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="ecr-reason">Reason</Label><Textarea id="ecr-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
            </div>
          ),
        },
        {
          id: "review", title: "Review",
          content: (
            <dl className="grid gap-4 md:grid-cols-2">
              <KV k="Title">{f.title}</KV>
              <KV k="Source">{f.source}{f.sourceRef ? ` · ${f.sourceRef}` : ""}</KV>
              <KV k="Classification">{f.classification}</KV>
              <KV k="Priority">{f.priority}</KV>
              <KV k="Affected">{affected.map((a) => a.id).join(", ")}</KV>
            </dl>
          ),
        },
      ]}
    />
  )
}

// ===================================================================================== ECR detail
export function EcrDetail() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useScreenState("ENG-ECR")
  const e = s.ecrs.find((x) => x.id === id)
  return (
    <DetailState state={st} found={!!e} what={`ECR ${id}`} back={{ to: "/engineering/change-requests", label: "Back to change requests" }}>
      {e && <EcrBody key={e.id} e={e} />}
    </DetailState>
  )
}

function EcrBody({ e }: { e: EcrRecord }) {
  const s = useSlice("engineering")
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const [dlg, setDlg] = useState<null | "defer" | "reopen" | CcbVoteValue>(null)
  const [narr, setNarr] = useState({ narrative: e.narrative, risk: e.risk })
  const draft = e.stage === "Draft"
  const ebomsAffected = e.affected.filter((a) => a.type === "ebom").map((a) => a.id)
  const [op, setOp] = useState({ ebom: ebomsAffected[0] ?? s.eboms.find((x) => x.status === "Released")?.id ?? "", kind: "replace" as "replace" | "qty" | "remove", line: "", comp: "SPARE-TBD-BSH145", qty: "" })
  const lines = s.eboms.find((x) => x.id === op.ebom)?.lines ?? []
  const isEM = role === "Engineering Manager"

  let primary = null
  // The cost delta goes to the engine so the Controller joins above $10k [DOC:p.62 §4.1].
  const members = ccbMembers(e.costDelta)
  const sla = ccbSla(e, TODAY)
  const myVote = e.votes?.find((v) => v.role === role)
  const canVote = e.stage === "Submitted to CCB" && (role === "Quality Manager" || role === "Production supervisor") && members.includes(role)
  if (draft) primary = <ApprovalButton kind="ECR (CCB)" subject={{ type: "ecr", id: e.id }} title={`${e.id}: ${e.title}`} ctx={{ costDelta: e.costDelta }} label="Submit to CCB" variant="default" stay />
  else if (e.stage === "Submitted to CCB") primary = <ApprovalButton kind="ECR (CCB)" subject={{ type: "ecr", id: e.id }} title={`${e.id}: ${e.title}`} ctx={{ costDelta: e.costDelta }} label="Send CCB vote request" variant="default" stay />
  else if (e.stage === "Deferred") primary = <Button onClick={() => setDlg("reopen")}>Reopen to Draft</Button>
  else if (e.ecoId) primary = <Button asChild><Link to={`/engineering/change-orders/${e.ecoId}`}>Open {e.ecoId}</Link></Button>

  const imp = e.impact
  return (
    <>
      <DetailPage
        header={{
          title: `${e.id} ${e.title}`,
          screenId: "ENG-ECR/ECO",
          crumbs: [{ label: "Change requests", to: "/engineering/change-requests" }, { label: e.id }],
          description: `${e.classification}, ${e.priority} priority. Raised by ${userName(e.requestedBy)} on ${fmtDate(e.raisedOn)} from ${e.source}.`,
          chips: (
            <>
              <StageText value={e.stage} />
              {e.emergency && <Chip kind="flag" note="CCB decision within 24 hours; Immediate effectivity needs a Quality Manager joint release (C-20)">Emergency</Chip>}
              {e.ccbOutcome && <Chip kind="change" note={e.ccbReason}>CCB: {e.ccbOutcome}</Chip>}
              {sla.due && e.stage === "Submitted to CCB" && (sla.breached
                ? <Chip kind="block" note={`Emergency: the CCB decides within 24 hours. Submitted ${fmtDate(e.submittedOn)}, due ${fmtDate(sla.due)}`}>CCB SLA breached</Chip>
                : <Chip kind="hold" note={`Emergency: the CCB decides within 24 hours. Submitted ${fmtDate(e.submittedOn)}`}>CCB due {fmtDate(sla.due)}</Chip>)}
            </>
          ),
          primary,
          actions: e.stage === "Submitted to CCB" && (
            <>
              {canVote && (["Approve", "Reject", "Defer"] as CcbVoteValue[]).map((v) => (
                <Button key={v} variant="outline" onClick={() => (v === "Approve" ? run((d, c) => act.recordVote(d, c, e.id, "Approve"), `CCB vote recorded: ${ccbLabel(role)} Approve`) : setDlg(v))}>Vote {v}</Button>
              ))}
              <Button variant="outline" disabled={!isEM} title={isEM ? undefined : "Recorded by the Engineering Manager as CCB chair (switch Acting as)"} onClick={() => setDlg("defer")}>Record CCB Defer</Button>
            </>
          ),
        }}
        doc={{ type: "ecr", id: e.id }}
        summary={
          <>
            <KV k="Source">{e.source}{e.sourceRef && <> · <RefLink r={e.sourceRef} /></>}</KV>
            <KV k="Affected objects">{e.affected.map((a) => <span key={a.id} className="mr-2 inline-block"><RefLink r={a} /></span>)}</KV>
            <KV k="Cost delta">{e.costDelta == null ? "Not simulated" : `${e.costDelta >= 0 ? "+" : ""}${fmtMoney(e.costDelta)}`}</KV>
            <KV k="Change order">{e.ecoId ? <RefLink r={{ type: "eco", id: e.ecoId }} /> : "None yet"}</KV>
          </>
        }
        tabs={[
          {
            id: "ccb", label: "CCB", count: e.votes?.length ?? 0,
            content: (
              <div className="flex flex-col gap-3">
                <p className="text-sm">Change Control Board: Engineering Manager, Quality Manager, Production Manager{(e.costDelta ?? 0) > CCB_COST_THRESHOLD ? " and the Controller (cost delta above $10k)" : `; the Controller joins when the cost delta is above ${fmtMoney(CCB_COST_THRESHOLD)}`}. Votes are recorded.</p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Member</TableHead><TableHead>Votes in</TableHead><TableHead>Vote</TableHead><TableHead>By</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {members.map((m) => {
                        const v = e.votes?.find((x) => x.role === m)
                        return (
                          <TableRow key={m} className="h-8 text-[13px]">
                            <TableCell>{ccbLabel(m)}</TableCell>
                            <TableCell>{m === "Engineering Manager" || m === "Controller" ? "WF-INBOX (shared engine)" : "This ECR"}</TableCell>
                            <TableCell>{v ? v.vote : e.stage === "Submitted to CCB" ? "Waiting" : ""}</TableCell>
                            <TableCell>{v ? `${userName(v.by)}, ${fmtDate(v.on)}` : ""}</TableCell>
                            <TableCell>{v?.reason ?? ""}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {e.stage === "Submitted to CCB" && <p className="text-xs text-muted-foreground">{myVote ? `Your vote: ${myVote.vote}. ` : ""}Outcome: Approve when every member approves; any Reject rejects; any Defer defers <Chip kind="design" note="The PRD lists the members and says votes are recorded, but gives no decision rule; unanimity is this prototype's reading (R-ECR-4)">decision rule</Chip>. The Production Manager vote is cast by the Production supervisor role <Chip kind="design" note="The role catalog has no Production Manager (reading R-ECR-6, foundation request R-10)">role</Chip></p>}
                {sla.due && <KV k="Emergency SLA">Submitted {fmtDate(e.submittedOn)} · due {fmtDate(sla.due)} (24 h) · age {sla.ageDays} day{sla.ageDays === 1 ? "" : "s"}{sla.breached ? " · breached" : ""}</KV>}
              </div>
            ),
          },
          {
            id: "impact", label: "Impact",
            content: (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">Computed impact: what the change touches today. Open orders, stock and POs come from Production, Inventory and Purchasing <Chip kind="design" note="Snapshot values seeded in this module until those groups publish where-used queries (R-8)">snapshot</Chip></p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ImpactTable title="Open work orders" empty="No open WOs on the affected revisions." head={["WO", "On revision", "State"]} rows={imp.openWos.map((w) => [<RefLink key="w" r={{ type: "productionOrder", id: w.id }} />, w.rev, w.note])} />
                  <ImpactTable title="Stock on hand" empty="No stock of affected items." head={["Item", "Qty", "Value"]} rows={imp.stock.map((x) => [<Item key="i" s={s} id={x.itemId} showDesc={false} />, fmtNumber(x.qty), fmtMoney(x.value)])} />
                  <ImpactTable title="Open purchase orders" empty="No open POs on affected items." head={["PO", "Qty", "Value"]} rows={imp.openPos.map((p) => [<RefLink key="p" r={{ type: "purchaseOrder", id: p.id }} />, fmtNumber(p.qty), fmtMoney(p.value)])} />
                  <ImpactTable title="Open sales order lines" empty="No open SO lines." head={["SO line", "Customer"]} rows={imp.openSoLines.map((o) => [<RefLink key="o" r={{ type: "salesOrder", id: o.id }}>{`${o.id} / ${o.line}`}</RefLink>, customerName(o.customerId)])} />
                </div>
                <ImpactTable title="Customers with serials in the field" empty="No field units affected." head={["Customer", "Serials"]} rows={imp.customers.map((c) => [customerName(c.customerId), c.serials])} />
                <section aria-label="Cost delta simulation" className="flex flex-wrap items-end gap-6 rounded-lg border p-4">
                  <KV k="Current standard">{fmtMoney(imp.costCurrent)}</KV>
                  <KV k="Simulated">{imp.costSimulated != null ? fmtMoney(imp.costSimulated) : "Not run"}</KV>
                  <KV k="Delta">{e.costDelta == null ? "Not run" : `${e.costDelta >= 0 ? "+" : ""}${fmtMoney(e.costDelta)}`}</KV>
                  {draft && <Button variant="outline" className="ml-auto" onClick={() => run((d, c) => act.simulateCost(d, c, e.id), "Costing simulation run")}>Run cost delta simulation</Button>}
                </section>
              </div>
            ),
          },
          {
            id: "changes", label: "Proposed changes", count: e.changes.reduce((n, c) => n + c.ops.length, 0) + e.docChanges.length,
            content: (
              <div className="flex flex-col gap-4">
                {e.changes.length === 0 && e.docChanges.length === 0 && <EmptyState title="No structural change proposed">Add a line change below{draft ? "" : " (Draft only)"}, or record documentation-only changes on the drawing.</EmptyState>}
                {e.changes.map((c) => (
                  <section key={c.ebomId} className="rounded-lg border">
                    <h3 className="border-b px-4 py-2 text-sm font-semibold"><RefLink r={{ type: "ebom", id: c.ebomId }} /></h3>
                    <ul className="flex flex-col">
                      {c.ops.map((o, i) => (
                        <li key={i} className="flex items-center gap-2 px-4 py-1 text-sm">
                          <span className="flex-1">{opText(s, c.ebomId, o)}</span>
                          {draft && <Button size="sm" variant="ghost" onClick={() => run((d, x) => act.removeEcrOp(d, x, e.id, c.ebomId, i), "Change removed")}>Remove</Button>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {e.docChanges.length > 0 && <p className="text-sm">Drawings to revise: {e.docChanges.map((x) => <span key={x} className="mr-2"><RefLink r={{ type: "document", id: x }} /></span>)}</p>}
                {draft && (
                  <section aria-label="Add a line change" className="grid gap-3 rounded-lg border p-4 md:grid-cols-5">
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <Label>EBOM</Label>
                      <Select value={op.ebom} onValueChange={(v) => setOp({ ...op, ebom: v, line: "" })}><SelectTrigger aria-label="EBOM"><SelectValue /></SelectTrigger><SelectContent>{s.eboms.filter((x) => x.status === "Released" || x.status === "Draft").map((x) => <SelectItem key={x.id} value={x.id}>{x.id} rev {x.rev}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Change</Label>
                      <Select value={op.kind} onValueChange={(v) => setOp({ ...op, kind: v as typeof op.kind })}><SelectTrigger aria-label="Change kind"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="replace">Replace component</SelectItem><SelectItem value="qty">Change quantity</SelectItem><SelectItem value="remove">Remove line</SelectItem></SelectContent></Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Line</Label>
                      <Select value={op.line} onValueChange={(v) => setOp({ ...op, line: v })}><SelectTrigger aria-label="Line"><SelectValue placeholder="Pick" /></SelectTrigger><SelectContent>{lines.map((l) => <SelectItem key={l.no} value={String(l.no)}>{l.no} {l.componentId}</SelectItem>)}</SelectContent></Select>
                    </div>
                    {op.kind === "replace" && (
                      <div className="flex flex-col gap-1"><Label>With</Label>
                        <Select value={op.comp} onValueChange={(v) => setOp({ ...op, comp: v })}><SelectTrigger aria-label="Replacement"><SelectValue /></SelectTrigger><SelectContent>{pickableMaterials().map((m) => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}</SelectContent></Select>
                      </div>
                    )}
                    {op.kind === "qty" && <div className="flex flex-col gap-1"><Label htmlFor="op-qty">New qty</Label><Input id="op-qty" type="number" value={op.qty} onChange={(x) => setOp({ ...op, qty: x.target.value })} /></div>}
                    <div className="md:col-span-5">
                      <Button variant="outline" disabled={!op.line} onClick={() => {
                        const line = Number(op.line)
                        const o: EbomChange["ops"][number] = op.kind === "replace" ? { kind: "replace", line, componentId: op.comp as MaterialId } : op.kind === "qty" ? { kind: "qty", line, qty: Number(op.qty) } : { kind: "remove", line }
                        run((d, c) => act.addEcrOp(d, c, e.id, op.ebom, o), "Change added")
                      }}>Add change</Button>
                      {op.kind === "replace" && <span className="ml-2 text-xs text-muted-foreground">{itemDesc(op.comp)}</span>}
                    </div>
                  </section>
                )}
              </div>
            ),
          },
          {
            id: "narrative", label: "Description and risk",
            content: (
              <div className="flex max-w-3xl flex-col gap-4">
                <KV k="Description">{e.description}</KV>
                <KV k="Reason">{e.reason}</KV>
                <div className="flex flex-col gap-1"><Label htmlFor="ecr-narr">Impact narrative</Label><Textarea id="ecr-narr" disabled={!draft} value={narr.narrative} onChange={(x) => setNarr({ ...narr, narrative: x.target.value })} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="ecr-risk">Risk</Label><Input id="ecr-risk" disabled={!draft} value={narr.risk} onChange={(x) => setNarr({ ...narr, risk: x.target.value })} /></div>
                {draft && <div><Button variant="outline" onClick={() => run((d, c) => act.updateEcr(d, c, e.id, narr), "Saved")}>Save narrative</Button></div>}
                {e.ccbReason && <KV k="CCB reason">{e.ccbReason}</KV>}
              </div>
            ),
          },
          { id: "activity", label: "Activity", count: e.activity.length, content: <Activity items={e.activity} /> },
        ]}
      />
      <RulesPanel
        rules={[
          ["ECR", "Anyone raises an ECR; sources include engineering, production, quality NCRs, purchasing, sales and field failures", "DOC:p.62 §4.1"],
          ["CCB", "Engineering Manager + Quality Manager + Production Manager + (cost delta above $10k) Controller; votes recorded; Approve spawns an ECO; Reject or Defer with reason; Emergency decided within 24 hours", "DOC:p.62 §4.1"],
          ["C-1", "The Engineering Manager and Controller decide in the shared approval engine (WF-INBOX); the other members' votes are recorded on the ECR until the engine routes to them (R-10)", "erd-sketch C-1"],
          ["Defer", "WF-INBOX offers Approve and Reject only; Defer is recorded here with a reason (reading, R-7)", "DOC:p.62 §4.1"],
          ["FL-02", "A configuration change after Design Release goes ECR then Sales Change Order", "DOC:p.177 f11"],
        ]}
      />
      <DialogShell open={dlg === "defer"} onOpenChange={(o) => !o && setDlg(null)} title={`Record CCB Defer on ${e.id}`} confirmLabel="Record Defer" requireReason reasonLabel="Reason (required)"
        consequence={`${e.id} moves to Deferred. Reopen returns it to Draft for a later submission. Withdraw the open CCB request in WF-INBOX.`} onConfirm={(r) => runD((d, c) => act.deferEcr(d, c, e.id, r), `${e.id} deferred`)} />
      <DialogShell open={dlg === "Reject" || dlg === "Defer"} onOpenChange={(o) => !o && setDlg(null)} title={`${ccbLabel(role)}: vote ${dlg} on ${e.id}`} confirmLabel={`Vote ${dlg}`} requireReason reasonLabel="Reason (required)" destructive={dlg === "Reject"}
        consequence={dlg === "Reject" ? `${e.id} is Rejected with your reason; no ECO is spawned.` : `${e.id} is Deferred with your reason; it can be reopened to Draft later.`}
        onConfirm={(r) => runD((d, c) => act.recordVote(d, c, e.id, dlg as CcbVoteValue, r), `CCB vote recorded: ${dlg}`)} />
      <DialogShell open={dlg === "reopen"} onOpenChange={(o) => !o && setDlg(null)} title={`Reopen ${e.id}`} confirmLabel="Reopen" consequence={`${e.id} returns to Draft; edit and submit to the CCB again.`} onConfirm={() => runD((d, c) => act.reopenEcr(d, c, e.id), `${e.id} reopened`)} />
    </>
  )
}

function ImpactTable({ title, head, rows, empty }: { title: string; head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <section aria-label={title} className="rounded-lg border">
      <h3 className="border-b px-4 py-2 text-sm font-semibold">{title} <span className="tabular font-normal text-muted-foreground">{rows.length}</span></h3>
      {rows.length === 0 ? <p className="px-4 py-2 text-sm text-muted-foreground">{empty}</p> : (
        <Table>
          <TableHeader className="bg-table-head"><TableRow>{head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map((r, i) => <TableRow key={i} className="h-8 text-[13px]">{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
      )}
    </section>
  )
}

function Activity({ items }: { items: { at: string; by: string; text: string }[] }) {
  return <ul className="flex flex-col gap-1 text-sm">{[...items].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}</ul>
}

// ===================================================================================== ECO detail
export function EcoDetail() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useScreenState("ENG-ECO")
  const e = s.ecos.find((x) => x.id === id)
  return (
    <DetailState state={st} found={!!e} what={`ECO ${id}`} back={{ to: "/engineering/change-orders", label: "Back to change orders" }}>
      {e && <EcoBody key={e.id} e={e} />}
    </DetailState>
  )
}

function EcoBody({ e }: { e: EcoRecord }) {
  const s = useSlice("engineering")
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const [dlg, setDlg] = useState<null | "release" | "eff" | "cutover">(null)
  const [eff, setEff] = useState<{ mode: EffectivityMode; date: string; serial: string }>({ mode: e.effectivity, date: e.effectiveOn ?? "", serial: e.fromSerial ?? "" })
  const open = e.stage === "Open"
  const blockers = ecoBlockers(e)
  const isEM = role === "Engineering Manager"
  const emOnly = isEM ? undefined : "The Engineering Manager does this (switch Acting as)"
  const done = e.tasks.filter((t) => t.done).length

  const waiting = e.stage === "Awaiting effectivity"
  const futureDate = e.effectivity === "Date" && !!e.effectiveOn && e.effectiveOn > TODAY
  const primary = open ? <Button disabled={!isEM} title={emOnly} onClick={() => setDlg("release")}>Release ECO atomically</Button>
    : waiting ? <Button disabled={!isEM} title={emOnly} onClick={() => setDlg("cutover")}>Run cutover at {fmtDate(e.effectiveOn)}</Button> : null
  const effText = e.effectivity === "Date" ? `Date ${e.effectiveOn ? fmtDate(e.effectiveOn) : "(not set)"}` : e.effectivity === "Serial" ? `Serial from ${e.fromSerial ?? "(not set)"}` : "Immediate"
  return (
    <>
      <DetailPage
        header={{
          title: `${e.id} ${e.title}`,
          screenId: "ENG-ECR/ECO",
          crumbs: [{ label: "Change orders", to: "/engineering/change-orders" }, { label: e.id }],
          description: `${e.ecrIds.length ? `From ${e.ecrIds.join(", ")}` : "From an EBOM mass update"}. Effectivity: ${effText}. Created ${fmtDate(e.createdOn)}.`,
          chips: (
            <>
              <StageText value={e.stage} />
              {open && blockers.length > 0 && <Chip kind="block" note={blockers.join(" ")}>{blockers.length} release blocker{blockers.length > 1 ? "s" : ""}</Chip>}
              {e.llrImpacts.length > 0 && <Chip kind="flag" note="Touches a long-lead item under an open LLR: a commercial decision per PO is required">LLR impact</Chip>}
              {e.woHoldRequestedOn && e.stage !== "Released" && <Chip kind="hold" note={`Immediate effectivity: On Hold requested ${fmtDate(e.woHoldRequestedOn)} for open WOs on the old revision, pending disposition`}>WOs held</Chip>}
              {waiting && <Chip kind="hold" note="Release approved; every new revision cuts over together on the effectivity date. Until then consumers keep the current revisions.">Cutover {fmtDate(e.effectiveOn)}</Chip>}
            </>
          ),
          primary,
          actions: open && <Button variant="outline" disabled={!isEM} title={emOnly} onClick={() => setDlg("eff")}>Set effectivity</Button>,
        }}
        doc={{ type: "eco", id: e.id }}
        summary={
          <>
            <KV k="Effectivity">{effText}</KV>
            <KV k="Tasks">{done} of {e.tasks.length} done</KV>
            <KV k="Objects changed">{e.changes.length + e.docChanges.length}</KV>
            <KV k="Released">{e.releasedOn ? `${fmtDate(e.releasedOn)} by ${userName(e.releasedBy)}` : waiting ? `Approved by ${userName(e.releasedBy)}; cutover ${fmtDate(e.effectiveOn)}` : "Not released"}</KV>
          </>
        }
        tabs={[
          {
            id: "tasks", label: "Task checklist", count: e.tasks.length,
            content: (
              <div className="flex flex-col gap-2">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>#</TableHead><TableHead>Task</TableHead><TableHead>Owner</TableHead><TableHead>Due</TableHead><TableHead>Done</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
                    <TableBody>
                      {e.tasks.map((t) => (
                        <TableRow key={t.no} className="h-8 text-[13px]">
                          <TableCell className="font-mono">{t.no}</TableCell>
                          <TableCell>
                            <span className="inline-flex flex-wrap items-center gap-1">{taskLink(e, t) ? <Link className="text-link underline-offset-4 hover:underline" to={taskLink(e, t)!}>{t.text}</Link> : t.text}{t.mandatory && <Chip kind="flag" note="Mandatory: release is blocked until done">Mandatory</Chip>}</span>
                          </TableCell>
                          <TableCell>{t.ownerRole}</TableCell>
                          <TableCell>{fmtDate(t.due)}</TableCell>
                          <TableCell>{t.done ? `${userName(t.doneBy)}, ${fmtDate(t.doneOn)}` : "Open"}</TableCell>
                          <TableCell>{open && !t.done && <Button size="sm" variant="outline" onClick={() => run((d, c) => act.completeTask(d, c, e.id, t.no), `Task #${t.no} done`)}>Mark done</Button>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">Each task is completed by its owner role (or the Engineering Manager). The Quality Manager joint release is completed only by the Quality Manager (C-20). "Update MBOM" is completed by staging the regenerated MBOM from MBOM-TRF on this ECO. Release is impossible while any task is open (C-19).</p>
              </div>
            ),
          },
          {
            id: "disp", label: "Dispositions",
            content: (
              <div className="flex flex-col gap-4">
                <DispositionGrid title="Old stock" empty="No stock of the affected items." head={["Item", "On hand", "Value", "Decision"]}
                  rows={e.stockDispositions.map((x) => [<Item key="i" s={s} id={x.itemId} showDesc={false} />, fmtNumber(x.onHand), fmtMoney(x.value),
                    <Pick key="p" disabled={!open} value={x.decision} options={STOCK_DISP} label={`Disposition for ${x.itemId}`} onChange={(v) => run((d, c) => act.setStockDisposition(d, c, e.id, x.itemId, v as StockDisposition))} />])} />
                {e.woHoldRequestedOn && <p className="text-sm">Immediate effectivity: On Hold requested {fmtDate(e.woHoldRequestedOn)} for the open WOs below, pending disposition. Production applies the hold <Chip kind="design" note="Sent as engineering.woHoldRequested; Production consumes it (README R-11)">hand-off</Chip></p>}
                <DispositionGrid title="Open work orders" empty="No open WOs on the old revision." head={["WO", "On revision", "Decision"]}
                  rows={e.woDispositions.map((x) => [<RefLink key="w" r={{ type: "productionOrder", id: x.woId }} />, x.rev,
                    <Pick key="p" disabled={!open} value={x.decision} options={WO_DISP} label={`Disposition for ${x.woId}`} onChange={(v) => run((d, c) => act.setWoDisposition(d, c, e.id, x.woId, v as WoDisposition))} />])} />
                <DispositionGrid title="Long-lead release impact (commercial decision per PO)" empty="No open LLR touches the changed items." head={["LLR", "PO", "Item", "Decision"]}
                  rows={e.llrImpacts.map((x) => [<RefLink key="l" r={{ type: "llr", id: x.llrId }} />, <RefLink key="p" r={{ type: "purchaseOrder", id: x.poId }} />, <Item key="i" s={s} id={x.itemId} showDesc={false} />,
                    <Pick key="d" disabled={!open} value={x.decision} options={LLR_DEC} label={`LLR decision for ${x.poId}`} onChange={(v) => run((d, c) => act.setLlrDecision(d, c, e.id, x.poId, v as LlrDecision))} />])} />
                <p className="text-xs text-muted-foreground">Postings: none on this screen. Disposition outcomes post through their own documents (scrap 5320, rework order, return to vendor, PO change) in the owning module (Book VI entry, asserted); the cutover hands each one over (see Changes).</p>
              </div>
            ),
          },
          {
            id: "changes", label: "Changes", count: e.changes.length + e.docChanges.length,
            content: (
              <div className="flex flex-col gap-4">
                {e.changes.map((c) => (
                  <section key={c.ebomId} className="rounded-lg border">
                    <h3 className="border-b px-4 py-2 text-sm font-semibold"><RefLink r={{ type: "ebom", id: c.ebomId }} /></h3>
                    <ul className="flex flex-col px-4 py-2 text-sm">{c.ops.map((o, i) => <li key={i}>{opText(s, c.ebomId, o)}</li>)}</ul>
                  </section>
                ))}
                {e.docChanges.length > 0 && <p className="text-sm">Drawings: {e.docChanges.map((x) => <span key={x} className="mr-2"><RefLink r={{ type: "document", id: x }} /></span>)}</p>}
                {(e.stagedMboms?.length ?? 0) > 0 && e.stage !== "Released" && (
                  <section aria-label="MBOMs staged on this ECO" className="rounded-lg border">
                    <h3 className="border-b px-4 py-2 text-sm font-semibold">MBOMs staged for the cutover</h3>
                    <ul className="flex flex-col px-4 py-2 text-sm">{e.stagedMboms!.map((m) => <li key={m.id}><span className="font-mono">{m.id}</span> from <RefLink r={{ type: "ebom", id: m.ebomId }} /> rev {m.ebomRev}, {m.lines.length} lines, {m.routingId} rev {m.routingRev}. Becomes Active at cutover; production versions pairing the current MBOM are superseded.</li>)}</ul>
                  </section>
                )}
                {e.changes.length + e.docChanges.length === 0 && <EmptyState title="No object changes">This ECO only carries tasks.</EmptyState>}
                {e.cutover && (
                  <section aria-label="Cutover evidence" className="rounded-lg border">
                    <h3 className="border-b px-4 py-2 text-sm font-semibold">Cutover evidence (released together on {fmtDate(e.releasedOn)})</h3>
                    <ul className="flex flex-col px-4 py-2 text-sm">{e.cutover.map((c) => <li key={c.ref.id}>{c.ref.type === "productionVersion" ? <>Production version <RefLink r={c.ref} /> released; supersedes {c.from}</> : <><RefLink r={c.ref} /> rev {c.from} to rev {c.to}</>}</li>)}</ul>
                  </section>
                )}
                {e.handoffs && e.handoffs.length > 0 && (
                  <section aria-label="Hand-offs to owning modules" className="rounded-lg border">
                    <h3 className="border-b px-4 py-2 text-sm font-semibold">Hand-offs: documents raised by the owning modules <Chip kind="design" note="Sent with the cutover as engineering.ecoCutover; the owning modules raise and post these documents (README R-11)">hand-off</Chip></h3>
                    <ul className="flex flex-col px-4 py-2 text-sm">{e.handoffs.map((h, i) => <li key={i}><span className="text-muted-foreground">{h.owner}:</span> {h.what}</li>)}</ul>
                  </section>
                )}
              </div>
            ),
          },
          { id: "activity", label: "Activity", count: e.activity.length, content: <Activity items={e.activity} /> },
        ]}
      />
      <RulesPanel
        rules={[
          ["Atomic", "All new revisions release together at effectivity; partial release is impossible", "DOC:p.62 §4.2"],
          ["Effectivity", "Date: the new revision governs documents created on or after the date; Serial: from that serial onward; Immediate: all open WOs blocked instantly pending disposition", "DOC:p.63 §4.5"],
          ["Cutover", "EBOM, MBOM, drawings and production versions switch together at effectivity; a future date waits as Awaiting effectivity (reading R-ECR-5)", "DOC:p.62 §4.2; p.256"],
          ["C-19", "An ECO cannot release while any task is open", "erd-sketch C-19"],
          ["C-20", "Immediate effectivity needs a Quality Manager joint release", "erd-sketch C-20"],
          ["LLR", "A change touching a long-lead item under an LLR needs a commercial decision per PO: proceed, change order to vendor, or stop with exposure booking", "DOC:p.209 §3.2"],
          ["Release", "Releasing an ECO is done by the Engineering Manager", "DOC:p.256"],
        ]}
      />
      <DialogShell open={dlg === "release"} onOpenChange={(o) => !o && setDlg(null)} title={`Release ${e.id}`} confirmLabel="Release atomically"
        consequence={blockers.length ? `Release is refused while: ${blockers.join(" ")}`
          : futureDate ? `Approves the release now. ${[...e.changes.map((c) => c.ebomId), ...e.docChanges, ...(e.stagedMboms ?? []).map((m) => m.id)].join(", ") || "The task set"} cut over together on ${fmtDate(e.effectiveOn)}; until then every consumer keeps the current revisions.`
          : `Releases ${[...e.changes.map((c) => c.ebomId), ...e.docChanges, ...(e.stagedMboms ?? []).map((m) => m.id)].join(", ") || "the task set"} together at ${effText}. Prior revisions and the production versions pairing them become Superseded; production, planning, materials and costing are notified.`}
        onConfirm={() => runD((d, c) => void act.releaseEco(d, c, e.id), futureDate ? `${e.id} approved; cutover ${e.effectiveOn}` : `${e.id} released`)} />
      <DialogShell open={dlg === "cutover"} onOpenChange={(o) => !o && setDlg(null)} title={`Run the ${e.id} cutover`} confirmLabel="Run cutover"
        consequence={`Simulates reaching ${fmtDate(e.effectiveOn)}: every new revision releases together, dated ${fmtDate(e.effectiveOn)}. The prototype clock is fixed, so a reviewer runs the date job here.`}
        onConfirm={() => runD((d, c) => act.runEffectivity(d, c, e.id), `${e.id} cut over`)}>
        <Chip kind="design" note="Prototype control standing in for the effectivity date job">date job</Chip>
      </DialogShell>
      <DialogShell open={dlg === "eff"} onOpenChange={(o) => !o && setDlg(null)} title="Effectivity" confirmLabel="Save effectivity"
        consequence={eff.mode === "Immediate" ? "Immediate: open WOs on the old revision are blocked pending disposition, and a Quality Manager joint release task is added (C-20)." : eff.mode === "Date" ? "The new revisions take effect from the chosen date." : "The new revisions take effect from the chosen serial onward."}
        onConfirm={() => runD((d, c) => act.setEffectivity(d, c, e.id, eff.mode, eff.mode === "Date" ? eff.date : eff.mode === "Serial" ? eff.serial : undefined), "Effectivity saved")}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Mode</legend>
          {(["Date", "Serial", "Immediate"] as EffectivityMode[]).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm"><input type="radio" name="eff" checked={eff.mode === m} onChange={() => setEff({ ...eff, mode: m })} />{m}</label>
          ))}
        </fieldset>
        {eff.mode === "Date" && <><Label htmlFor="eff-date">Effective from</Label><Input id="eff-date" type="date" value={eff.date} onChange={(x) => setEff({ ...eff, date: x.target.value })} /></>}
        {eff.mode === "Serial" && <><Label htmlFor="eff-serial">First serial</Label><Input id="eff-serial" value={eff.serial} placeholder="SN-TBD-20M-0377-1" onChange={(x) => setEff({ ...eff, serial: x.target.value })} /></>}
      </DialogShell>
      {open && blockers.length > 0 && (
        <ErrorAlert title="Why this ECO cannot release yet">
          <ul className="list-disc pl-4">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </ErrorAlert>
      )}
    </>
  )
}

function DispositionGrid({ title, head, rows, empty }: { title: string; head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return <ImpactTable title={title} head={head} rows={rows} empty={empty} />
}

function Pick({ value, options, onChange, disabled, label }: { value?: string; options: string[]; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger size="sm" className="h-8 w-56" aria-label={label}><SelectValue placeholder="Choose" /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  )
}

/** "Update MBOM" opens the transform from this ECO so the regenerated MBOM is staged on it. */
function taskLink(e: EcoRecord, t: EcoRecord["tasks"][number]): string | undefined {
  if (t.text.startsWith("Update MBOM") && e.stage === "Open" && !t.done && e.changes[0]) return `/engineering/mbom-transform/new/${e.changes[0].ebomId}?eco=${e.id}`
  return t.link
}
