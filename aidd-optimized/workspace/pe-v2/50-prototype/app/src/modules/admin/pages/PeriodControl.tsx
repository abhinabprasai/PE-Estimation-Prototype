// INV-CONFIG-PERIOD Fiscal Period Control (Config) [DOC:p.281 Book VII; pp.41-42 INV §9] (asserted):
// "Period grid per entity with the three status presentation, pre close validation list with document
// links and owners, module behavior matrix reference panel. Soft close. Run inventory close. Hard close
// after checklist. Reopen dual control with tagged postings." One period record per entity per month,
// two presentations (finance Open / Soft Close / Hard Close / Year-End Closed; inventory Open /
// Closing / Closed). Serves FL-06.

import { useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router"
import { CircleCheck, CircleX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, EmptyState, ErrorAlert, KV, LifecycleStrip, PostingPreview, RulesPanel, StatusBadge, useFirstVisitLoading, type Column } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { docRoute, type LegalEntityId, type PostingLine } from "@/data/domain"
import { LEGAL_ENTITIES, SPINE_DOCS, TODAY } from "@/data/shared"
import { useCore, useSlice } from "@/store"
import { BEHAVIOR_MATRIX, CLOSE_SEQUENCE, E_PER, INVENTORY_LABEL, TRANSACTIONS, jobById } from "../data/catalog"
import { failedCloseCritical, hardClose, requestReopen, resolvePreClose, runInventoryClose, setFinanceChecklist, softClose, unresolved } from "../data/actions"
import type { Period, PreCloseItem } from "../data/types"
import { checkPostingDate, rPer01 } from "../lib/period"
import { fmtDateTime, fmtMonth } from "../lib/time"
import { act, Field, SimpleSelect, StateText, userName } from "../components/common"

export function PeriodControl() {
  const s = useSlice("admin")
  const { role } = useCore()
  const loading = useFirstVisitLoading("INV-CONFIG-PERIOD")
  const [params, setParams] = useSearchParams()
  const pid = params.get("p")
  const selected = s.periods.find((p) => p.id === pid)
  const [entity, setEntity] = useState<string>(selected?.entityId ?? "LE-TBD-10")
  const section = params.get("section") ?? (selected ? selected.entityId : entity)
  const entityId = (LEGAL_ENTITIES.some((e) => e.id === section) ? section : entity) as LegalEntityId
  const periods = s.periods.filter((p) => p.entityId === entityId).sort((a, b) => b.month.localeCompare(a.month))
  const focus = selected && selected.entityId === entityId ? selected : periods.find((p) => p.status === "Soft Close") ?? periods.find((p) => p.status === "Open")
  const { open, soft } = rPer01(s.periods, entityId)

  const columns: Column<Period>[] = [
    { id: "id", header: "Period", value: (p) => p.id, mono: true },
    { id: "month", header: "Month", value: (p) => p.month, sortable: true, cell: (p) => fmtMonth(p.month) },
    { id: "status", header: "Finance status", value: (p) => p.status, filterable: true, cell: (p) => <StatusBadge kind="fiscalPeriod" status={p.status} size="sm" /> },
    { id: "inv", header: "Inventory", value: (p) => INVENTORY_LABEL[p.status], cell: (p) => <span className="text-sm">{INVENTORY_LABEL[p.status]}</span> },
    { id: "soft", header: "Soft closed", value: (p) => p.softClosedAt ?? "", cell: (p) => <span className="text-xs tabular">{p.softClosedAt ? fmtDateTime(p.softClosedAt) : ""}</span> },
    { id: "invclose", header: "Inventory close run", value: (p) => p.inventoryCloseRunAt ?? "", cell: (p) => <span className="text-xs tabular">{p.inventoryCloseRunAt ? fmtDateTime(p.inventoryCloseRunAt) : ""}</span> },
    { id: "hard", header: "Hard closed", value: (p) => p.hardClosedAt ?? "", cell: (p) => <span className="text-xs tabular">{p.hardClosedAt ? fmtDateTime(p.hardClosedAt) : ""}</span> },
    { id: "blk", header: "Open blockers", value: (p) => unresolved(s, p.id).length, align: "right", mono: true },
    { id: "reopen", header: "Reopen", value: (p) => p.reopen?.requestId ?? "", cell: (p) => (p.reopen ? <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${p.reopen.requestId}`}>{p.reopen.requestId}</Link> : "") },
  ]

  return (
    <ConfigPage
      header={{
        title: "Fiscal period control",
        screenId: "INV-CONFIG-PERIOD",
        description: "The posting-date gate every transaction validates against, at save and again at post. Periods are owned by Finance; inventory shows the same record as Open / Closing / Closed. No independent inventory calendar exists.",
        chips: (
          <>
            <Chip kind="oq" id="OQ-22" note="Open / Soft Close / Hard Close / Year-End Closed read as the period list; inventory labels map onto the first three" />
            <Chip kind="design" note="Served at the PRD URL pattern /inventory/configuration/fiscal-periods [DOC:p.41 INV §9]; the shared registry still lists /configuration/periods, which redirects here (R-7)">PRD route</Chip>
          </>
        ),
      }}
      sections={[
        ...LEGAL_ENTITIES.map((e) => ({ id: e.id, label: e.name })),
        { id: "check", label: "Posting-date check" },
        { id: "matrix", label: "Module behavior matrix" },
      ]}
      section={section}
      onSectionChange={(id) => {
        if (LEGAL_ENTITIES.some((e) => e.id === id)) setEntity(id)
        setParams({ section: id })
      }}
    >
      {pid && !selected && <ErrorAlert title={`Period ${pid} not found`} onDismiss={() => setParams({})}>Periods run from 2025-12 to the open month.</ErrorAlert>}
      {section === "matrix" ? (
        <MatrixPanel />
      ) : section === "check" ? (
        <GateCheck />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-sm">
            R-PER-01 for {LEGAL_ENTITIES.find((e) => e.id === entityId)?.name}: Open {open.map((p) => p.month).join(", ") || "none"} · Soft Close {soft.map((p) => p.month).join(", ") || "none"}.{" "}
            {open.length === 1 && soft.length <= 1 ? <span className="text-muted-foreground">Holds (exactly one Open, at most one Soft Close).</span> : <span className="font-semibold text-destructive">Violated.</span>}
          </p>
          <DataTable
            rows={periods}
            columns={columns}
            rowId={(p) => p.id}
            loading={loading}
            onRowClick={(p) => setParams({ section: entityId, p: p.id })}
            activeId={focus?.id}
            densityKey="INV-CONFIG-PERIOD"
            caption="Fiscal periods"
            empty={{ title: "No periods for this entity." }}
          />
          {focus && <PeriodDetail p={focus} role={role} />}
        </div>
      )}
      <RulesPanel
        className="mt-8 rounded-lg border"
        rules={[
          ["R-PER-01", "Always exactly one Open and at most one Soft Close period per entity; the next period opens automatically at first Soft Close", "DOC:p.42 §9.3"],
          ["§9.5-a", "Set Soft Close / reopen to Open: Controller. Set Hard Close: Controller after checklist green; the system enforces prerequisite completion", "DOC:p.42 §9.5"],
          ["C-43", "Reopen Hard Closed: Controller + CFO dual action, two distinct users, sequential confirm", "DOC:p.42 §9.5"],
          ["§9.3-5", "The reopen reason and every posting made during a reopen window are tagged Reopened Posting and listed in the close report", "DOC:p.42 §9.3"],
          ["C-41", "Posting into a Closed period is blocked for everyone; corrections post now with Reference Date", "DOC:p.42 §9.4"],
          ["C-42", "Soft Close warns, it does not block", "DOC:p.42 §9.5"],
          ["W.3", "Failed close-critical jobs hold the period-close gate", "DOC:p.11 W.3"],
          ...Object.entries(E_PER).map(([k, v]) => [k, v, "DOC:p.42 §9.5"] as [string, string, string]),
        ]}
      />
    </ConfigPage>
  )
}

function PeriodDetail({ p, role }: { p: Period; role: string }) {
  const s = useSlice("admin")
  const [stepUp, setStepUp] = useState(false) // local until the shell publishes its step-up state (README request R-10)
  const [dialog, setDialog] = useState<null | "soft" | "hard" | "reopen" | "inv" | { resolve: PreCloseItem }>(null)
  const items = s.preClose.filter((i) => i.periodId === p.id)
  const open = unresolved(s, p.id)
  const failedJobs = failedCloseCritical(s, p.entityId, p.month)
  const controller = role === "Controller"
  const notCtl = controller ? undefined : "Controller only [DOC:p.42 §9.5]"
  const tagged = s.tagged.filter((t) => t.periodId === p.id)
  const reopenReq = p.reopen ? s.instances.find((i) => i.id === p.reopen!.requestId) : undefined
  const pendingReopen = s.instances.find((i) => !i.outcome && i.effect?.type === "periodReopen" && i.effect.periodId === p.id)
  const warranty = s.runs.filter((r) => r.jobId === "JOB-07" && r.entityId === p.entityId && r.period === p.month).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt) || b.attempt - a.attempt)[0]
  const alloc = s.runs.filter((r) => r.jobId === "JOB-06" && r.entityId === p.entityId && r.period === p.month).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0]
  const currency = p.entityId === "LE-TBD-30" ? "CAD" : "USD"
  const lines: PostingLine[] = [
    warranty?.posting ? { template: 24, amount: warranty.posting.amount, currency, detail: `${warranty.id} · ${warranty.output}` } : { template: 24, amount: null, notPostedReason: warranty ? `${warranty.state} (${warranty.id})` : p.entityId === "LE-TBD-40" ? "No FG shipments" : "Not run yet" },
    { template: 36, amount: null, notPostedReason: alloc ? `${alloc.state}${alloc.output ? `: ${alloc.output}` : ""}` : "Not run yet" },
  ]
  const spineHere = p.entityId === "LE-TBD-10" ? SPINE_DOCS.filter((d) => d.date.startsWith(p.month) && ["delivery", "invoiceRequest", "grn", "productionOrder", "pod", "purchaseOrder"].includes(d.ref.type)) : []
  const checklist: [string, boolean, string][] = [
    ["Pre-close validation: zero unresolved documents", open.length === 0, open.length ? fillE03(open.length) : "No blockers"],
    ["Close-critical jobs succeeded (W.3)", failedJobs.length === 0, failedJobs.map((r) => `${jobById(r.jobId)?.name} ${r.state} (${r.id})`).join("; ") || "All succeeded"],
    ["Inventory close run (ACC 26.2 step 6b)", !!p.inventoryCloseRunAt, p.inventoryCloseRunAt ? `${fmtDateTime(p.inventoryCloseRunAt)} by ${userName(p.inventoryCloseBy)}` : "Not run"],
    ["ACC 26.2 finance checklist", !!p.financeChecklistDone, "Steps are in ACC V2.0, outside the KB (ASM-EXT-1)"],
  ]
  const green = checklist.every((c) => c[1])

  let primary: ReactNode = null
  if (p.status === "Open") primary = <Button onClick={() => setDialog("soft")} disabled={!controller} title={notCtl}>Soft close {p.month}</Button>
  else if (p.status === "Soft Close") primary = <Button onClick={() => setDialog("hard")} disabled={!controller || !green} title={notCtl ?? (!green ? "Hard close after checklist green" : undefined)}>Hard close {p.month}</Button>
  else if (p.status === "Hard Close") primary = pendingReopen ? <Link to={`/approvals?req=${pendingReopen.id}`} className="text-sm text-link underline-offset-4 hover:underline">{pendingReopen.id} waits for the {pendingReopen.steps.find((x) => !x.decided)?.role}</Link> : <Button variant="outline" onClick={() => setDialog("reopen")} disabled={!controller} title={notCtl}>Request reopen (Controller + CFO)</Button>

  return (
    <section aria-label={`Period ${p.month}`} className="flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{fmtMonth(p.month)} · {LEGAL_ENTITIES.find((e) => e.id === p.entityId)?.name}</h2>
        <StatusBadge kind="fiscalPeriod" status={p.status} />
        <span className="text-sm text-muted-foreground">Inventory: {INVENTORY_LABEL[p.status]}</span>
        {(p.status === "Hard Close" || p.status === "Year-End Closed") && <Chip kind="design" note="Closed periods take no postings; only the reopen path is offered (C-41, C-55)">Read-only</Chip>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {p.status === "Soft Close" && <Button variant="outline" onClick={() => setDialog("inv")} disabled={!controller || !!p.inventoryCloseRunAt} title={notCtl ?? (p.inventoryCloseRunAt ? "Already run" : undefined)}>Run inventory close</Button>}
          {p.status === "Soft Close" && <Button variant="outline" disabled title="R-PER-01: the next period is already Open, so returning this one to Open would make two Open periods (AR-24)">Reopen to Open</Button>}
          {primary}
        </div>
      </header>
      <LifecycleStrip kind="fiscalPeriod" status={p.status} />
      {p.status === "Year-End Closed" && <p className="text-sm text-muted-foreground">Year-End Closed: no reopen is offered; the specification covers Closed → Soft Close only.</p>}

      {p.status === "Soft Close" && (
        <section aria-label="Close checklist">
          <h3 className="text-sm font-semibold">Close checklist</h3>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {checklist.map(([label, ok, note]) => (
              <li key={label} className="flex flex-wrap items-center gap-2">
                {ok ? <CircleCheck className="size-4 text-status-done" aria-label="done" /> : <CircleX className="size-4 text-destructive" aria-label="not done" />}
                <span>{label}</span>
                <span className="text-xs text-muted-foreground">{note}</span>
                {label.startsWith("ACC 26.2") && (
                  <label className="ml-auto flex items-center gap-2 text-xs">
                    <Checkbox checked={!!p.financeChecklistDone} disabled={!controller} onCheckedChange={(v) => act(setFinanceChecklist(p.id, v === true))} /> Controller attests complete
                  </label>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Pre-close validation">
        <h3 className="mb-1 text-sm font-semibold">Pre-close validation ({open.length} unresolved of {items.length})</h3>
        {items.length === 0 ? (
          <EmptyState title="No pre-close documents for this period.">{p.status === "Open" ? "The list fills when the period goes to Soft Close." : "Nothing was left open."}</EmptyState>
        ) : (
          <DataTable
            rows={items}
            rowId={(i) => i.id}
            densityKey="INV-CONFIG-PERIOD-pcv"
            caption="Pre-close validation list"
            columns={[
              { id: "kind", header: "Kind", value: (i) => i.kind, filterable: true },
              { id: "doc", header: "Document", value: (i) => i.ref?.id ?? i.loose?.id ?? "", cell: (i) => <Link className="font-mono text-link underline-offset-4 hover:underline" to={i.ref ? docRoute(i.ref) : i.loose!.route}>{i.ref?.id ?? i.loose?.id}</Link> },
              { id: "what", header: "What", value: (i) => i.description, className: "max-w-[360px]" },
              { id: "owner", header: "Owner", value: (i) => i.owner, filterable: true },
              { id: "state", header: "Resolved", value: (i) => (i.resolved ? "Yes" : "No"), cell: (i) => (i.resolved ? <span className="text-xs">{userName(i.resolved.by)} · {fmtDateTime(i.resolved.at)}: {i.resolved.note}</span> : <span className="text-sm font-semibold text-status-pending-ink">Open</span>) },
              { id: "act", header: "", cell: (i) => (i.resolved ? "" : i.jobRunId ? <Link className="text-sm text-link underline-offset-4 hover:underline" to={`/operations/jobs?run=${i.jobRunId}`}>Retry in job console</Link> : <Button size="sm" variant="outline" onClick={() => setDialog({ resolve: i })}>Resolve</Button>) },
            ]}
          />
        )}
      </section>

      <PostingPreview title="Period-end postings (FL-06)" period={p.month} lines={lines} />
      <p className="text-xs text-muted-foreground">The inventory close posts the closing JE and takes the valuation snapshot; that JE has no template number in Part J and posts on the ACC side. #36 belongs to CO-ALC-001/2.</p>

      {spineHere.length > 0 && (
        <section aria-label="Hero thread postings in this period">
          <h3 className="text-sm font-semibold">Spine documents dated in {p.month}</h3>
          <ul className="text-sm">
            {spineHere.map((d) => (
              <li key={d.ref.id} className="flex flex-wrap items-center gap-2">
                <Link className="font-mono text-link underline-offset-4 hover:underline" to={docRoute(d.ref)}>{d.ref.id}</Link>
                <span className="text-xs text-muted-foreground">{d.date} · {d.title}</span>
                {d.status && <StatusBadge kind={d.status.kind} status={d.status.value} size="sm" />}
              </li>
            ))}
          </ul>
          {(p.status === "Hard Close" || p.status === "Year-End Closed") && <p className="text-xs text-muted-foreground">A correction to any of these posts in the open period with Reference Date = the original date (C-41); try it under Posting-date check.</p>}
        </section>
      )}

      {(p.reopen || tagged.length > 0) && (
        <section aria-label="Close report: reopen window">
          <h3 className="text-sm font-semibold">Close report: reopen window</h3>
          {p.reopen && (
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KV k="Request"><Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${p.reopen.requestId}`}>{p.reopen.requestId}</Link></KV>
              <KV k="Reason">{reopenReq?.title ?? p.reopen.reason}</KV>
              <KV k="Opened">{fmtDateTime(p.reopen.openedAt)}</KV>
              <KV k="Closed">{p.reopen.closedAt ? fmtDateTime(p.reopen.closedAt) : "Still open: postings are tagged"}</KV>
            </dl>
          )}
          <ul className="mt-2 text-sm">
            {tagged.length === 0 ? <li className="text-muted-foreground">No postings in the window yet.</li> : tagged.map((t, n) => <li key={n}><span className="font-semibold">{t.tag}</span> · {t.template} {t.amount.toLocaleString("en-US", { style: "currency", currency: t.currency })} · <Link className="font-mono text-link underline-offset-4 hover:underline" to={docRoute(t.source)}>{t.source.id}</Link> · {fmtDateTime(t.at)}</li>)}
          </ul>
        </section>
      )}

      <section aria-label="History">
        <h3 className="text-sm font-semibold">History</h3>
        <ol className="text-xs">
          {p.history.map((h, n) => <li key={n}><span className="tabular text-muted-foreground">{fmtDateTime(h.at)}</span> · {h.from} → {h.to} · {userName(h.by)}{h.note ? ` · ${h.note}` : ""}</li>)}
        </ol>
      </section>

      <DialogShell open={dialog === "soft"} onOpenChange={(o) => !o && setDialog(null)} title={`Soft close ${p.month}`} consequence={`${p.month} goes to Soft Close (inventory: Closing). Operational posting continues with the E-PER-02 warning; the next month opens automatically (R-PER-01). Finance and every module are told.`} confirmLabel="Soft close" onConfirm={() => act(softClose(p.id))} />
      <DialogShell open={dialog === "inv"} onOpenChange={(o) => !o && setDialog(null)} title={`Run inventory close for ${p.month}`} consequence={`Checks the pre-close list (must be zero), takes the valuation snapshot and posts the closing JE for ${p.month}. ACC 26.2 step 6b is then done.`} confirmLabel="Run inventory close" onConfirm={() => act(runInventoryClose(p.id))} />
      <DialogShell open={dialog === "hard"} onOpenChange={(o) => !o && setDialog(null)} title={`Hard close ${p.month}`} consequence={`${p.month} goes to Hard Close (inventory: Closed). Every posting dated in it is blocked for everyone (E-PER-01); corrections post in the open period with a Reference Date. Reopening needs Controller + CFO.`} confirmLabel="Hard close" destructive onConfirm={() => act(hardClose(p.id))} />
      <DialogShell open={dialog === "reopen"} onOpenChange={(o) => !o && setDialog(null)} title={`Request reopen of ${p.month}`} consequence={`Raises a Fiscal period reopen request: Controller, then CFO, two distinct users in sequence (C-43). On approval ${p.month} returns to Soft Close and every posting in the window is tagged Reopened Posting.`} requireReason reasonLabel="Reopen reason (required, tagged on the audit trail)" confirmLabel="Send for approval" confirmDisabled={!stepUp} onConfirm={(r) => { const e = act(requestReopen(p.id, r)); if (!e) setStepUp(false); return e }}>
        <div role="group" aria-label="Step-up authentication" className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
          <span className="flex-1 min-w-[220px]">A period reopen is a dual-control action, so it asks for step-up multi-factor authentication first. <Link className="text-link underline-offset-4 hover:underline" to="/auth/step-up">See the step-up prompt</Link>.</span>
          {stepUp ? <StateText>Step-up confirmed for this action</StateText> : <Button type="button" size="sm" variant="outline" onClick={() => setStepUp(true)}>Confirm step-up (prototype)</Button>}
        </div>
      </DialogShell>
      <DialogShell open={typeof dialog === "object" && dialog !== null} onOpenChange={(o) => !o && setDialog(null)} title={`Resolve ${typeof dialog === "object" && dialog ? (dialog.resolve.ref?.id ?? dialog.resolve.loose?.id) : ""}`} consequence="Marks the row resolved on the pre-close list with your note. The document itself is corrected on its own screen." requireReason reasonLabel="How it was resolved (required)" confirmLabel="Mark resolved" onConfirm={(r) => (typeof dialog === "object" && dialog ? act(resolvePreClose(dialog.resolve.id, r)) : "Nothing selected.")} />
    </section>
  )
}

const fillE03 = (n: number) => E_PER["E-PER-03"].replace("{n}", String(n))

function MatrixPanel() {
  return (
    <section className="flex flex-col gap-4">
      <table className="w-full text-sm">
        <caption className="mb-2 text-left text-sm font-semibold">Module behavior matrix [DOC:pp.41-42 §9.2] (asserted)</caption>
        <thead className="bg-table-head text-left text-xs">
          <tr><th className="p-2">Module / transaction</th><th className="p-2">Open</th><th className="p-2">Closing (Soft)</th><th className="p-2">Closed (Hard)</th></tr>
        </thead>
        <tbody>
          {BEHAVIOR_MATRIX.map((r) => <tr key={r[0]} className="border-t align-top"><td className="p-2 font-medium">{r[0]}</td><td className="p-2">{r[1]}</td><td className="p-2">{r[2]}</td><td className="p-2">{r[3]}</td></tr>)}
        </tbody>
      </table>
      <section>
        <h3 className="text-sm font-semibold">Open / close sequence [DOC:p.42 §9.3]</h3>
        <ol className="list-decimal pl-6 text-sm">{CLOSE_SEQUENCE.map((x) => <li key={x}>{x}</li>)}</ol>
      </section>
    </section>
  )
}

function GateCheck() {
  const s = useSlice("admin")
  const [entityId, setEntityId] = useState<string>("LE-TBD-10")
  const [date, setDate] = useState("2026-08-11")
  const [txn, setTxn] = useState("Sales PGI / shipment")
  const r = checkPostingDate(s.periods, entityId as LegalEntityId, date, txn)
  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm">Every posting in every module validates the period of its posting date, at save and again at post. Try a date: the default is a correction to the Omaha North shipment DLV-TBD-0031 (posted 2026-08-11).</p>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="gc-ent" label="Entity"><SimpleSelect id="gc-ent" value={entityId} onChange={setEntityId} options={LEGAL_ENTITIES.map((e) => ({ value: e.id, label: e.name }))} /></Field>
        <Field id="gc-date" label="Posting date"><Input id="gc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field id="gc-txn" label="Transaction"><SimpleSelect id="gc-txn" value={txn} onChange={setTxn} options={TRANSACTIONS.map((t) => ({ value: t, label: t }))} /></Field>
      </div>
      <div role="status" className={r.level === "block" ? "rounded-md border border-destructive px-4 py-2 text-sm" : r.level === "warn" ? "rounded-md border border-status-exception px-4 py-2 text-sm" : "rounded-md border px-4 py-2 text-sm"}>
        <p className="font-semibold">{r.level === "block" ? "Blocked" : r.level === "warn" ? "Posts with warning" : "Posts"}{r.code ? ` · ${r.code}` : ""}</p>
        <p>{r.message}</p>
        {r.code === "E-PER-01" && <p className="mt-1 text-xs">Post it in the open period ({s.periods.find((p) => p.entityId === entityId && p.status === "Open")?.month}) with Reference Date = {date}, so operational reports can restate while GL integrity holds (C-41). Today is {TODAY}.</p>}
      </div>
    </section>
  )
}
