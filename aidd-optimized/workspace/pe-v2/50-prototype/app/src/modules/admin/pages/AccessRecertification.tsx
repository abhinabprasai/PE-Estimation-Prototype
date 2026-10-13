// FX-WF-RECERT Access recertification and SoD exception request [DOC:p.188 Book III C §3; W.4 WF-26, WF-27]:
// "Recertification: quarterly access review per role owner with attestation; failed attestations auto-revoke; report
// retained as audit evidence." "The engine blocks toxic combinations at role-assignment time, not just at transaction
// time; exceptions require CFO approval with expiry date." Each attestation is the WF-27 request on WF-INBOX.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Chip, EmptyState, KV, RulesPanel } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import { ALL_ROLES, type Role, type UserId } from "@/data/domain"
import { TODAY, USERS, userById } from "@/data/shared"
import { addDays, fmtDate } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { requestSod } from "../data/actions"
import { attestSheet, failSheet, setRecertAnswer } from "../data/cfg-actions"
import type { RecertSheet } from "../data/cfg-types"
import type { SodException } from "../data/seed"
import { SOD_PAIRS, toxicPairsFor } from "../lib/cfg"
import { fmtDateTime } from "../lib/time"
import { Field, SimpleSelect, StateText, userName } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

type Queue = "attest" | "sod" | "check"
const userOptions = USERS.map((u) => ({ value: u.id, label: `${u.name} (${u.roles[0]})` }))

export function AccessRecertification() {
  const [params, setParams] = useSearchParams()
  const queue = (params.get("queue") as Queue) ?? "attest"
  const sheetId = params.get("sheet")
  const s = useSlice("adminCfg")
  const a = useSlice("admin")
  const { role } = useCore()
  const view = useView("FX-WF-RECERT")
  const [dialog, setDialog] = useState<null | "sod" | "fail" | "attest">(null)
  const [answers, setAnswers] = useState<Record<string, "Keep" | "Revoke">>({})
  const sheet = s.recert.find((x) => x.id === sheetId)
  const inst = (sh: RecertSheet) => a.instances.find((i) => i.id === sh.requestId)
  const stateOf = (sh: RecertSheet): "Open" | "Overdue" | "Attested" | "Failed" => {
    const i = inst(sh)
    if (i?.outcome === "Approved") return "Attested"
    if (i?.outcome === "Rejected") return "Failed"
    return sh.dueOn < TODAY ? "Overdue" : "Open"
  }
  const sods = a.sod.map((x) => (x.state === "Active" && x.expires < TODAY ? { ...x, state: "Expired" as const } : x))
  const rows = view.empty ? [] : s.recert
  const revoked = s.recert.flatMap((x) => x.items).filter((i) => i.answer === "Revoke").length

  const setParam = (k: string, v?: string) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n })
  const header = {
    title: "Access recertification and SoD exceptions",
    screenId: "FX-WF-RECERT",
    description: "Quarterly attestation per department manager, with failed attestations revoking access automatically; and the CFO-approved, expiring exceptions to the separation-of-duties rules.",
    chips: <Chip kind="design" note="Route /configuration/access-recertification is a design value">Design route</Chip>,
    actions: (<><StatePicker view={view} /><Button variant="outline" asChild><Link to="/approvals?kind=WF-27">Attestation requests in WF-INBOX</Link></Button></>),
    primary: <Button onClick={() => setDialog("sod")} disabled={!!view.writeError()}>Request SoD exception</Button>,
  }
  const kpis = [
    { label: "Attestations open", value: s.recert.filter((x) => ["Open", "Overdue"].includes(stateOf(x))).length, hint: `2026 Q3, due ${fmtDate("2026-10-16")}` },
    { label: "Failed", value: s.recert.filter((x) => stateOf(x) === "Failed").length, hint: "auto-revoked" },
    { label: "Access rights revoked", value: revoked },
    { label: "SoD exceptions active", value: sods.filter((x) => x.state === "Active").length, hint: `${sods.filter((x) => x.state === "Pending approval").length} waiting for the CFO` },
  ]
  const queues = [{ id: "attest", label: "Attestations", count: s.recert.length }, { id: "sod", label: "SoD exceptions", count: a.sod.length }, { id: "check", label: "Role-assignment check" }]

  const body =
    queue === "attest" ? (
      <WorkbenchPage<RecertSheet>
        header={header}
        kpis={kpis}
        queues={queues}
        queue={queue}
        onQueueChange={(q) => setParam("queue", q)}
        table={{
          rows,
          rowId: (x) => x.id,
          loading: view.loading,
          caption: "Attestations",
          onRowClick: (x) => { setAnswers({}); setParam("sheet", x.id) },
          activeId: sheet?.id,
          empty: { title: "No attestation is open.", body: "JOB-12 generates the next quarter's sheets on the first day of the quarter." },
          columns: [
            { id: "id", header: "Sheet", value: (x) => x.id, mono: true, sortable: true },
            { id: "dep", header: "Department", value: (x) => x.department, filterable: true },
            { id: "mgr", header: "Attesting manager", value: (x) => x.managerRole },
            { id: "n", header: "Users", value: (x) => x.items.length, align: "right", mono: true },
            { id: "due", header: "Due", value: (x) => x.dueOn, sortable: true, cell: (x) => fmtDate(x.dueOn) },
            { id: "st", header: "State", value: (x) => stateOf(x), filterable: true, cell: (x) => <StateText tone={["Overdue", "Failed"].includes(stateOf(x)) ? "attention" : stateOf(x) === "Attested" ? "muted" : "default"}>{stateOf(x) === "Failed" ? "Failed, auto-revoked" : stateOf(x)}</StateText> },
            { id: "req", header: "WF-27 request", value: (x) => x.requestId, cell: (x) => <Link onClick={(e) => e.stopPropagation()} className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${x.requestId}`}>{x.requestId}</Link> },
          ],
        }}
        panel={{
          open: !!sheet,
          onOpenChange: (o) => !o && setParam("sheet"),
          title: sheet ? `${sheet.id} · ${sheet.department}` : "",
          description: sheet ? `Attesting manager: ${sheet.managerRole}. Due ${fmtDate(sheet.dueOn)}.` : undefined,
          content: sheet && (
            <SheetBody sheet={sheet} state={stateOf(sheet)} answers={answers} setAnswers={setAnswers} canAct={role === sheet.managerRole} onAttest={() => setDialog("attest")} onFail={() => setDialog("fail")} />
          ),
        }}
      />
    ) : queue === "sod" ? (
      <WorkbenchPage<SodException>
        header={header}
        kpis={kpis}
        queues={queues}
        queue={queue}
        onQueueChange={(q) => setParam("queue", q)}
        table={{
          rows: view.empty ? [] : sods,
          rowId: (x) => x.id,
          loading: view.loading,
          caption: "SoD exceptions",
          empty: { title: "No SoD exception granted.", body: "Request one when a toxic role pair is unavoidable; it needs the CFO and an expiry date." },
          columns: [
            { id: "id", header: "Exception", value: (x) => x.id, mono: true },
            { id: "user", header: "User", value: (x) => userName(x.user) },
            { id: "grant", header: "Combination", value: (x) => x.grant, className: "max-w-[340px]" },
            { id: "exp", header: "Expires", value: (x) => x.expires, mono: true, sortable: true, cell: (x) => <span className={x.expires <= addDays(TODAY, 14) && x.state === "Active" ? "font-semibold text-status-pending-ink" : undefined}>{x.expires}</span> },
            { id: "state", header: "State", value: (x) => x.state, filterable: true, cell: (x) => <StateText tone={x.state === "Pending approval" ? "attention" : x.state === "Expired" ? "muted" : "default"}>{x.state}</StateText> },
            { id: "req", header: "CFO approval (WF-26)", value: (x) => x.requestId ?? "", cell: (x) => (x.requestId ? <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${x.requestId}`}>{x.requestId}</Link> : "") },
          ],
        }}
      />
    ) : (
      <WorkbenchPage<(typeof SOD_PAIRS)[number]>
        header={header}
        kpis={kpis}
        queues={queues}
        queue={queue}
        onQueueChange={(q) => setParam("queue", q)}
        table={{
          rows: SOD_PAIRS,
          rowId: (x) => x.id,
          caption: "SoD rule set",
          columns: [
            { id: "a", header: "One role", value: (x) => x.pair[0], cell: (x) => <span>{x.pair[0]}<span className="block text-xs text-muted-foreground">{x.roles[0].join(", ")}</span></span> },
            { id: "b", header: "Cannot also hold", value: (x) => x.pair[1], cell: (x) => <span>{x.pair[1]}<span className="block text-xs text-muted-foreground">{x.roles[1].join(", ")}</span></span> },
            { id: "r", header: "Rule", value: (x) => x.rule },
          ],
        }}
      />
    )

  return (
    <div className="flex flex-col gap-6">
      <StateFrame view={view} cols={6} emptyTitle="No attestation sheets." emptyBody="JOB-12 generates one sheet per department manager each quarter." degraded="Degraded: the identity provider sync (IF-18) is behind. Attestations still record; revocations reach the IdP when it catches up.">
        {body}
        {queue === "check" && <CheckPanel />}
      </StateFrame>
      <RulesPanel
        rules={[
          ["C§3-a", "Quarterly access review per role owner with attestation; failed attestations auto-revoke; the report is retained as audit evidence", "DOC:p.188 C §3"],
          ["C§3-b", "The engine blocks toxic combinations at role-assignment time, not just at transaction time", "DOC:p.188 C §3"],
          ["C§3-c", "Exceptions require CFO approval with an expiry date; SoD exception use is security-event logged", "DOC:pp.188-189 C §3, §6"],
          ["W.4", "WF-26 SoD exception grant: CFO approval with expiry. WF-27 Access recertification: quarterly attestation, failed = auto-revoke", "DOC:p.12 W.4"],
        ]}
      />
      <SodDialog open={dialog === "sod"} onClose={() => setDialog(null)} view={view} />
      <DialogShell open={dialog === "attest"} onOpenChange={(o) => !o && setDialog(null)} title={`Attest ${sheet?.id ?? ""}`} consequence={sheet ? `Approves the WF-27 request ${sheet.requestId}. ${Object.values({ ...Object.fromEntries(sheet.items.map((i) => [i.id, i.answer])), ...answers }).filter((x) => x === "Revoke").length} access rights are revoked; the rest are kept for the next quarter.` : undefined} requireReason reasonLabel="Attestation comment (required)" confirmLabel="Attest" onConfirm={(c) => view.run(() => attestSheet(sheet!.id, answers, c))} />
      <DialogShell open={dialog === "fail"} onOpenChange={(o) => !o && setDialog(null)} title={`Fail ${sheet?.id ?? ""}`} consequence="Rejects the WF-27 request. Every access right with no answer is revoked automatically, and the report is kept as audit evidence." requireReason reasonLabel="Why the attestation failed (required)" destructive confirmLabel="Fail and auto-revoke" onConfirm={(r) => view.run(() => failSheet(sheet!.id, r))} />
    </div>
  )
}

function SheetBody({ sheet, state, answers, setAnswers, canAct, onAttest, onFail }: { sheet: RecertSheet; state: string; answers: Record<string, "Keep" | "Revoke">; setAnswers: (a: Record<string, "Keep" | "Revoke">) => void; canAct: boolean; onAttest: () => void; onFail: () => void }) {
  const decided = state === "Attested" || state === "Failed"
  const val = (id: string, cur: string) => answers[id] ?? (cur === "Pending" ? "" : cur)
  return (
    <div className="flex flex-col gap-4">
      {sheet.autoRevoked && <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">Failed on {fmtDateTime(sheet.autoRevoked.on)}: {sheet.autoRevoked.reason}</p>}
      {!decided && !canAct && <p className="text-sm text-muted-foreground">Only the {sheet.managerRole} attests this sheet. You can read it.</p>}
      <ul className="flex flex-col divide-y rounded-md border">
        {sheet.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
            <span className="min-w-40 font-medium">{userName(i.userId)}<span className="block text-xs font-normal text-muted-foreground">{i.role} · last used {i.lastUsed}</span></span>
            <span className="flex-1 text-xs">{i.entitlements}</span>
            <SimpleSelect id={`ans-${i.id}`} value={val(i.id, i.answer)} className="w-28" disabled={decided || !canAct} onChange={(v) => setAnswers({ ...answers, [i.id]: v as "Keep" | "Revoke" })} options={[{ value: "Keep", label: "Keep" }, { value: "Revoke", label: "Revoke" }]} placeholder="Answer" />
          </li>
        ))}
      </ul>
      {!decided && (
        <div className="flex gap-2">
          <Button onClick={onAttest} disabled={!canAct}>Attest sheet</Button>
          <Button variant="outline" onClick={onFail} disabled={!canAct}>Fail attestation</Button>
        </div>
      )}
      {decided && <p className="text-xs text-muted-foreground">Decided: the sheet is read-only. The report is retained as audit evidence.</p>}
    </div>
  )
}

function SodDialog({ open, onClose, view }: { open: boolean; onClose: () => void; view: ReturnType<typeof useView> }) {
  const [userId, setUserId] = useState("")
  const [pair, setPair] = useState("")
  const [expires, setExpires] = useState(addDays(TODAY, 30))
  const [reason, setReason] = useState("")
  const p = SOD_PAIRS.find((x) => x.id === pair)
  const grant = p ? `${p.pair[0]} and ${p.pair[1]}` : ""
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => { if (!o) { setUserId(""); setPair(""); setReason(""); onClose() } }}
      title="Request a SoD exception"
      consequence={`Sends the exception to the CFO (WF-26). It takes effect only on approval and ends on ${expires || "the expiry date"}; after that the engine blocks the combination again.`}
      confirmLabel="Send for approval"
      onConfirm={() => view.run(() => requestSod({ userId: userId as UserId, grant, expires, reason }))}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="sod-user" label="User"><SimpleSelect id="sod-user" value={userId} onChange={setUserId} options={userOptions} placeholder="Pick a user" /></Field>
        <Field id="sod-pair" label="Toxic combination"><SimpleSelect id="sod-pair" value={pair} onChange={setPair} options={SOD_PAIRS.map((x) => ({ value: x.id, label: `${x.pair[0]} + ${x.pair[1]}` }))} placeholder="Pick a pair" /></Field>
        <Field id="sod-exp" label="Expires" hint="Required; 180 days at most (design value, AR-35)"><Input id="sod-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
        <Field id="sod-reason" label="Justification" className="md:col-span-2"><Textarea id="sod-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </DialogShell>
  )
}

function CheckPanel() {
  const a = useSlice("admin")
  const [userId, setUserId] = useState("")
  const [add, setAdd] = useState("")
  const u = userById(userId)
  const roles = u ? [...u.roles, ...(add ? [add as Role] : [])] : []
  const toxic = u && add ? toxicPairsFor(roles) : []
  const exc = (pairLabel: string) => a.sod.find((x) => x.user === userId && x.state === "Active" && x.expires >= TODAY && pairLabel.split(" and ").every((r) => x.grant.includes(r)))
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Role-assignment check" className="flex max-w-3xl flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Role-assignment check</h2>
        <p className="text-sm text-muted-foreground">The engine blocks a toxic combination when a role is assigned, not only at transaction time. Pick a user and the role to add.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="chk-user" label="User"><SimpleSelect id="chk-user" value={userId} onChange={setUserId} options={userOptions} placeholder="Pick a user" /></Field>
          <Field id="chk-role" label="Role to add"><SimpleSelect id="chk-role" value={add} onChange={setAdd} options={ALL_ROLES.map((r) => ({ value: r, label: r }))} placeholder="Pick a role" /></Field>
        </div>
        {u && add && (toxic.length === 0 ? (
          <p role="status" className="text-sm">No toxic combination: {u.name} may hold {roles.join(" and ")}.</p>
        ) : (
          <ul className="flex flex-col gap-2" role="status">
            {toxic.map((t) => {
              const e = exc(`${t.pair[0]} and ${t.pair[1]}`)
              return <li key={t.id} className="rounded-md border p-2 text-sm"><span className="font-semibold">{e ? "Allowed under an exception" : "Blocked"}:</span> {t.pair[0]} + {t.pair[1]} ({t.rule}). {e ? `${e.id} runs until ${e.expires}.` : "Request an exception: it needs the CFO and an expiry date."}</li>
            })}
          </ul>
        ))}
        {!u && <EmptyState title="Pick a user and a role." />}
        <KV k="Rule set">{SOD_PAIRS.length} pairs consolidated from the volumes (Book III C §3)</KV>
      </section>
    </div>
  )
}
void setRecertAnswer
void Input
