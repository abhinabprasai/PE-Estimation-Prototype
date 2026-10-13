// SCH-BOARD Schedule Board, AT-RISK At Risk Promises, CTP-DLG Promise Dialog
// [DOC:pp.192-193 Book III E §2-§5; p.260 Book VI] (asserted).
// - Finite buckets per work center with load bars, freeze-horizon shading, sandbox banner and a
//   publish diff dialog; publishes carry snapshot IDs that promises reference.
// - CTP: feasible date with the binding constraint named in words, alternative options and the
//   soft-reservation countdown; Accept reserves capacity, Decline, Request planner review.
// - At risk: cards per endangered promise with recovery options and a decision log; a re-promise
//   triggers the sales change order path (the promise itself changes only there).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import type { ISODate } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { daysBetween, fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { ActivityList, BodyState, Item, LoadBar, RefLink, SoLink, StatePreview, WoLink, custName, matDesc, useAct, useActDialog, useScreenState, Marker } from "../components"
import * as act from "../lib/actions"
import { addWorkdays, allWorkCenters, freezeDaysOf, freezeEnd, FREEZE_DAYS, opKey, schedule, TRANSIT_BUFFER_DAYS, weekLabel, weeklyBuckets, weekStart, type EffectiveWc } from "../lib/plan"
import { leadTimeBand } from "../lib/ctp"
import type { AtRiskRecord, PromiseCandidate } from "../data/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRole } from "@/store"
import { Gantt, ganttOps, workdayRange } from "../widgets/Gantt"

const WEEKS = 8

// ============================================================================ SCH-BOARD
export function ScheduleBoard() {
  const s = useSlice("planningProduction")
  const st = useScreenState("SCH-BOARD")
  const run = useAct()
  const runD = useActDialog()
  const [active, setActive] = useState<string | null>(null)
  const [publish, setPublish] = useState(false)
  const [move, setMove] = useState<{ key: string; date: string; reason: string } | null>(null)
  const [horizon, setHorizon] = useState("20")
  const plan = s.sandbox ? act.sandboxPlan(s) : schedule(s, {})
  const base = schedule(s, {})
  const wcs = allWorkCenters(s).filter((w) => w.status !== "Inactive" || Object.keys(plan.load[w.id] ?? {}).length)
  const weeks = Array.from({ length: WEEKS }, (_, i) => addWorkdays(weekStart(TODAY), i * 5))
  const fe = freezeEnd()
  const feOf = (wcId: string) => freezeEnd(TODAY, freezeDaysOf(s, wcId))
  const [role] = useRole()
  const last = s.publishes.at(-1)
  const diff = Object.entries(plan.dates).filter(([k, v]) => base.dates[k] && base.dates[k][1] !== v[1])
  const aw = wcs.find((w) => w.id === active)
  const awOps = aw
    ? s.productionOrders.filter((w) => act.isOpenWo(w)).flatMap((w) => w.operations.filter((o) => o.workCenterId === aw.id && o.status !== "Completed").map((o) => ({ w, o, d: plan.dates[opKey(w.id, o.no)] }))).sort((a, b) => (a.d?.[0] ?? "").localeCompare(b.d?.[0] ?? ""))
    : []
  const util = (w: EffectiveWc) => {
    const b = weeklyBuckets(w, plan, TODAY, 4)
    const h = b.reduce((a, x) => a + x.hours, 0)
    const c = b.reduce((a, x) => a + x.capacity, 0)
    return c ? Math.round((h / c) * 100) : 0
  }
  const columns: Column<EffectiveWc>[] = [
    { id: "id", header: "Work center", value: (w) => w.id, mono: true, cell: (w) => <span className="flex flex-col"><span className="font-mono text-xs">{w.id}</span><span className="text-xs text-muted-foreground">{w.name}</span></span> },
    { id: "status", header: "Status", value: (w) => w.status, filterable: true, cell: (w) => <span className="inline-flex flex-col gap-1"><StatusBadge kind="workCenter" status={w.status} size="sm" />{w.maintenanceUntil && w.status === "Maintenance" && <span className="text-xs text-muted-foreground">to {fmtDate(w.maintenanceUntil)}</span>}</span> },
    ...weeks.map((wk, i): Column<EffectiveWc> => ({
      id: `w${i}`, header: `${weekLabel(wk)}${i === 0 ? " (freeze)" : ""}`, value: () => i,
      cell: (w) => {
        const b = weeklyBuckets(w, plan, wk, 1)[0]
        return <div className={wk <= feOf(w.id) ? "rounded bg-muted p-1" : "p-1"}><LoadBar hours={b.hours} capacity={b.capacity} label={`${w.id} ${weekLabel(wk)}`} /></div>
      },
    })),
    { id: "freeze", header: "Freeze", value: (w) => freezeDaysOf(s, w.id), align: "right", mono: true, cell: (w) => `${freezeDaysOf(s, w.id)} d` },
    { id: "util", header: "4-wk load %", value: (w) => util(w), align: "right", mono: true, sortable: true },
  ]
  return (
    <>
      <WorkbenchPage<EffectiveWc>
        header={{
          title: "Schedule board",
          screenId: "SCH-BOARD",
          description: `Finite capacity per work center: overload is impossible in the plan, maintenance blocks capacity. Orders schedule backward from their due date by default. Freeze horizon per work center (default ${FREEZE_DAYS} working days, to ${fmtDate(fe)}): a change inside it needs Production Scheduler action with a reason. Published ${last?.snapshotId ?? "never"}.`,
          chips: s.sandbox ? <Chip kind="change" note={`Opened ${s.sandbox.openedOn} by ${s.sandbox.by}`}>Sandbox: {s.sandbox.moves.length} move(s)</Chip> : undefined,
          primary: s.sandbox ? <Button onClick={() => setPublish(true)}>Publish with diff</Button> : <Button onClick={() => run((d, c) => act.openSandbox(d, c), "What-if sandbox opened")}><FlaskConical aria-hidden="true" /> Open what-if sandbox</Button>,
          actions: (
            <>
              <StatePreview />
              {s.sandbox && <Button variant="outline" onClick={() => run((d) => act.discardSandbox(d), "Sandbox discarded")}>Discard sandbox</Button>}
              <Button variant="outline" asChild><Link to="/production/at-risk">At-risk promises ({s.atRisk.filter((a) => a.state === "Open").length})</Link></Button>
            </>
          ),
          children: s.sandbox && (
            <p role="status" className="rounded-md border border-status-pending bg-status-pending-tint px-4 py-2 text-sm">
              What-if sandbox: nothing here reaches the floor or any promise until you publish. {s.sandbox.moves.length} move(s), {diff.length} operation finish date(s) differ from the live plan.
            </p>
          ),
        }}
        kpis={[
          { label: "Last publish", value: last?.snapshotId ?? "none", hint: last ? `${last.publishedOn.replace("T", " ")} · ${last.by}` : undefined },
          { label: "Work centers in Maintenance", value: wcs.filter((w) => w.status === "Maintenance").length, hint: wcs.filter((w) => w.status === "Maintenance").map((w) => w.id).join(", ") },
          { label: "Unschedulable operations", value: plan.unschedulable.length, hint: plan.unschedulable.length ? "no capacity in the horizon" : "all placed" },
          { label: "Open at-risk records", value: s.atRisk.filter((a) => a.state === "Open").length },
        ]}
        table={{
          rows: st.empty ? [] : wcs, columns, rowId: (w) => w.id, onRowClick: (w) => setActive(w.id), activeId: active ?? undefined,
          loading: st.loading, error: st.error, onRetry: st.retry, empty: { title: "No work centers", body: "Maintain work centers first." },
        }}
        panel={aw ? {
          open: !!aw, onOpenChange: (o) => !o && setActive(null), title: `${aw.id} ${aw.name}`, description: `${aw.shifts} × ${aw.hoursPerShift} h shifts, ${aw.efficiencyPct}% efficiency${aw.status === "Maintenance" ? `; Maintenance to ${aw.maintenanceUntil}` : ""}`,
          content: (
            <ul className="flex flex-col gap-2 text-sm">
              {awOps.length === 0 && <li className="text-muted-foreground">No open operations.</li>}
              {awOps.map(({ w, o, d }) => {
                const k = opKey(w.id, o.no)
                const mv = s.sandbox?.moves.find((m) => m.key === k)
                return (
                  <li key={k} className="flex flex-wrap items-center gap-2 border-b pb-2">
                    <WoLink id={w.id} /> op {o.no} · {o.text.slice(0, 40)}
                    <span className="tabular text-xs text-muted-foreground">{d ? `${fmtDate(d[0])} → ${fmtDate(d[1])}` : ""}</span>
                    {o.status === "In Progress" && <Marker>running</Marker>}
                    {mv && <Chip kind="change">not before {fmtDate(mv.notBefore)}</Chip>}
                    {s.sandbox && o.status === "Not Started" && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setMove({ key: k, date: d?.[0] ?? TODAY, reason: "" })}>Move</Button>}
                  </li>
                )
              })}
            </ul>
          ),
        } : undefined}
      />
      <section aria-label="Gantt by work center" className="mt-8 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Gantt by work center</h2>
          <Select value={horizon} onValueChange={setHorizon}>
            <SelectTrigger size="sm" className="h-8 w-40" aria-label="Gantt horizon"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">2 weeks</SelectItem>
              <SelectItem value="20">4 weeks</SelectItem>
              <SelectItem value="30">6 weeks</SelectItem>
            </SelectContent>
          </Select>
          <Chip kind="design" note="Day columns are working days (Mon-Fri). A bar spans the shifts of its work center; the hours per shift are in the tooltip.">Working-day axis</Chip>
          <span className="text-xs text-muted-foreground">{s.sandbox ? "Click a bar to move it in the sandbox." : "Click a bar to open its work center. Open the sandbox to move operations."}</span>
        </div>
        {st.loading || st.error ? (
          <div className="h-40 rounded-lg border" aria-busy="true" />
        ) : (
          <Gantt
            wcs={wcs}
            ops={ganttOps(s.productionOrders, plan, new Set((s.sandbox?.moves ?? []).map((m) => m.key)), (w, f) => !!w.pegs.length && !!w.promiseDate && f > addWorkdays(w.promiseDate, -TRANSIT_BUFFER_DAYS))}
            days={workdayRange(TODAY, Number(horizon))}
            freezeOf={feOf}
            windows={s.maintWindows}
            selected={move?.key ?? null}
            onBar={(o) => (s.sandbox && s.productionOrders.find((w) => w.id === o.woId)?.operations.find((x) => x.no === o.no)?.status === "Not Started" ? setMove({ key: o.key, date: o.start, reason: "" }) : setActive(o.wcId))}
          />
        )}
      </section>
      <RulesPanel className="mt-6" rules={[
        ["E §2", "Finite buckets; operations consume capacity; maintenance blocks capacity; a reschedule sets an earliest start the engine honours", "DOC:p.192 Book III E §2"],
        ["E §3", "Freeze horizon: inside it the schedule does not auto-move; publish creates a snapshot ID that promises reference", "DOC:p.193 Book III E §3"],
        ["E §3", `Freeze horizon: default ${FREEZE_DAYS} working days, per work center; changes inside it need Production Scheduler action with a reason`, "DOC:p.193 Book III E §3"],
        ["E §3", "Modes: backward from due date (default), forward from release on demand; late pegged orders auto-escalate priority", "DOC:p.192 Book III E §3; p.74 §5.1"],
        ["Design", "Mon-Fri calendar; orders load in priority order, each operation taking the latest (backward) or earliest (forward) free hours; an escalated order gets priority 1", "design value"],
      ]} />
      <DialogShell open={!!move} onOpenChange={(o) => !o && setMove(null)} title={`Move ${move?.key}`} confirmLabel="Apply in sandbox"
        consequence="Sets an earliest start for this operation in the sandbox; the finite engine places it and everything after it. Nothing is published yet."
        onConfirm={() => runD((d, c) => act.moveOp(d, c, move!.key.split("/")[0], Number(move!.key.split("/")[1]), move!.date as ISODate, move!.reason), "Moved in sandbox")}>
        {move && (
          <div className="grid gap-2">
            <Label htmlFor="mv-date">Not before</Label>
            <Input id="mv-date" type="date" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })} />
            {(() => {
              const o = s.productionOrders.find((w) => w.id === move.key.split("/")[0])?.operations.find((x) => x.no === Number(move.key.split("/")[1]))
              const f = feOf(o?.workCenterId ?? "")
              const inside = move.date < f || (o?.start ?? "") < f
              return (
                <>
                  {inside && <p className={role === "Production Scheduler" ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>Inside the {o?.workCenterId} freeze horizon (to {fmtDate(f)}): Production Scheduler action with a reason{role === "Production Scheduler" ? "." : `. You are acting as ${role}.`}</p>}
                  <Label htmlFor="mv-why">Reason {inside ? "(required inside the freeze horizon)" : "(optional)"}</Label>
                </>
              )
            })()}
            <Textarea id="mv-why" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} />
          </div>
        )}
      </DialogShell>
      <DialogShell open={publish} onOpenChange={setPublish} title="Publish schedule" confirmLabel="Publish" wide
        consequence={`Publishes a new snapshot that promises reference, applies ${s.sandbox?.moves.length ?? 0} move(s) and revalidates every pegged promise (at-risk records raise automatically).`}
        onConfirm={() => runD((d, c) => act.publishSchedule(d, c, ""), (id) => `${id} published`)}>
        <div className="max-h-72 overflow-y-auto text-sm">
          <p className="font-semibold">Diff against the live plan</p>
          {diff.length === 0 && <p className="text-muted-foreground">No operation finish date changes.</p>}
          <ul className="mt-1 flex flex-col gap-1">
            {diff.slice(0, 40).map(([k, v]) => <li key={k} className="tabular"><span className="font-mono">{k}</span>: finish {fmtDate(base.dates[k][1])} → {fmtDate(v[1])}</li>)}
          </ul>
          {s.sandbox?.moves.map((m) => <p key={m.key} className="mt-1 text-muted-foreground">Move {m.key} not before {m.notBefore}{m.reason ? ` · ${m.reason}` : ""}</p>)}
        </div>
      </DialogShell>
    </>
  )
}

// ============================================================================ CTP-DLG
/** The Promise Dialog for one quote or order line. Exported for the sales module (README request R-1). */
export function PromiseDialog({ id, open, onOpenChange }: { id: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useSlice("planningProduction")
  const run = useAct()
  const runD = useActDialog()
  const c = s.promises.find((p) => p.id === id)
  const [opt, setOpt] = useState("0")
  const [note, setNote] = useState("")
  if (!c) return null
  const state = act.promiseState(c)
  const r = c.result
  const decided = state === "Accepted" || state === "Declined" || state === "Expired"
  const left = c.reservation?.expires ? daysBetween(TODAY, c.reservation.expires) : undefined
  const options = r ? [{ label: "Earliest feasible date", shipDate: r.shipDate, note: `Binding: ${r.binding}` }, ...r.options] : []
  const budgetary = c.quoteType === "Budgetary"
  const band = budgetary ? leadTimeBand(c.itemId) : undefined
  return (
    <DialogShell
      open={open} onOpenChange={onOpenChange} wide
      title={`Promise · ${c.doc.id} line ${c.line}`}
      description={`${custName(c.customerId)} · ${matDesc(c.itemId)} × ${c.qty} (${c.orderType}) · requested ${fmtDate(c.requestedDate)}`}
      confirmLabel={c.doc.type === "salesOrder" ? "Accept (firm load)" : "Accept (reserve capacity)"}
      confirmDisabled={!r || decided || c.decision === "Planner review" || budgetary}
      consequence={r && !decided ? (c.doc.type === "salesOrder" ? "Accept books firm load on the schedule and logs the decision on the order." : `Accept holds a soft capacity reservation for ${act.SOFT_RESERVATION_DAYS} days; it converts to firm load at order confirmation.`) : undefined}
      onConfirm={() => runD((d, ctx) => act.decidePromise(d, ctx, c.id, "Accepted", { optionIdx: Number(opt) === 0 ? undefined : Number(opt) - 1 }), `Promise accepted for ${c.doc.id}`)}
      secondary={
        !decided && r ? (
          <span className="mr-auto inline-flex gap-2">
            <Button variant="ghost" onClick={() => run((d, ctx) => act.decidePromise(d, ctx, c.id, "Declined"), "Declined; nothing reserved") && onOpenChange(false)}>Decline</Button>
            <Button variant="outline" onClick={() => run((d, ctx) => act.decidePromise(d, ctx, c.id, "Planner review", { note }), "Planner review requested") && onOpenChange(false)}>Request planner review</Button>
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span>Decision: <span className="font-medium">{state}</span></span>
          <Chip kind="oq" id="OQ-21" note="No status list for promise decisions; shown as text" />
          {c.reservation && (c.reservation.kind === "Firm" ? <Marker note={`Snapshot ${c.reservation.snapshotId}`}>Firm reservation</Marker> : <Chip kind="change" note={`Snapshot ${c.reservation.snapshotId}`}>Soft reservation{left != null ? (left >= 0 ? `: ${left} day(s) left` : ": expired") : ""}</Chip>)}
          {!budgetary && (!r || state === "Result ready" || state === "Planner review") && !(c.reservation?.kind === "Firm") && <Button size="sm" variant="outline" className="ml-auto" onClick={() => run((d, ctx) => act.runPromise(d, ctx, c.id), (x) => `Earliest ship ${fmtDate(x.shipDate)}`)}>{r ? "Re-run check" : "Run check"}</Button>}
        </div>
        {c.doc.type === "quotation" && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Quote type: <span className="font-medium">{c.quoteType ?? "not set"}</span></span>
            {!decided && c.quoteType === "Budgetary" && <Button size="sm" variant="outline" onClick={() => run((d, ctx) => act.setQuoteType(d, ctx, c.id, "Firm"), "Quote line is Firm: run the check")}>Make Firm</Button>}
            {act.ctpRequired(c) && <Chip kind="block" note="Firm ETO quotes must carry a CTP result [DOC:p.193 §4]">CTP result required before the quote goes out</Chip>}
          </div>
        )}
        {budgetary && band ? (
          <div className="relative overflow-hidden rounded-md border p-4">
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-bold tracking-widest text-muted-foreground/20">BUDGETARY</span>
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">BUDGETARY · NO CTP</p>
            <p className="mt-1 text-lg font-semibold">Lead time {band.low} to {band.high} weeks ARO</p>
            <p className="text-muted-foreground">Budgetary quotes quote lead-time bands without a capable-to-promise check; nothing is reserved. Make the line Firm to run CTP.</p>
            <span className="mt-2 inline-flex"><Chip kind="design" note="Band = longest component lead time + routing hours, widened by the Budgetary ±25% (design reading)">Reading</Chip></span>
          </div>
        ) : r ? (
          <>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KV k="Earliest ship date"><span className="text-lg font-semibold">{fmtDate(r.shipDate)}</span></KV>
              <KV k="Completion">{fmtDate(r.completion)}</KV>
              <KV k="Material available">{fmtDate(r.materialDate)}</KV>
              <KV k="Snapshot">{r.snapshotId}</KV>
            </dl>
            <p className="rounded-md bg-muted px-4 py-2">Binding constraint: <span className="font-semibold">{r.binding}</span></p>
            {!decided && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 font-semibold">Options</legend>
                <RadioGroup value={opt} onValueChange={setOpt}>
                  {options.map((o, i) => (
                    <label key={i} className="flex items-start gap-2">
                      <RadioGroupItem value={String(i)} aria-label={o.label} disabled={o.note.startsWith("Not feasible")} />
                      <span><span className="font-medium">{o.label}</span> · {fmtDate(o.shipDate)} <span className="text-muted-foreground">{o.note}</span></span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
            )}
            <p className="text-xs text-muted-foreground">Ran {r.ranOn.replace("T", " ")} in {r.ms} ms{r.seeded ? " (seeded result)" : ""}. Accepted soft reservations of other quotes load first, so parallel quotes cannot promise the same bottleneck slot.</p>
            {!decided && (
              <div className="grid gap-1">
                <Label htmlFor="ctp-note">Note for planner review</Label>
                <Textarea id="ctp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the planner look at?" />
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">No result yet. Run the check: it explodes the BOM and routing, checks material dates and inserts the order into finite capacity.</p>
        )}
        <ActivityList items={c.log} />
      </div>
    </DialogShell>
  )
}

/** Promise checks for quote lines and MTO/ETO order lines (CTP-DLG host in this module). */
export function PromiseChecks() {
  const s = useSlice("planningProduction")
  const sales = useSlice("sales") as unknown as { quotations?: { id: string; customerId: string; status: string; lines: { no: number; item: string; qty: number }[] }[]; orders?: { id: string; customerId: string; type: string; status: string; requestedShip: string; lines: { no: number; item: string; qty: number; requestedShip: string }[] }[] } | undefined
  const runD = useActDialog()
  const [adding, setAdding] = useState<{ docKey: string; quoteType: "Budgetary" | "Firm" } | null>(null)
  const lineChoices = [
    ...(sales?.quotations ?? []).flatMap((q) => q.lines.map((l) => ({ key: `Q|${q.id}|${l.no}`, label: `${q.id} line ${l.no} · ${l.item} × ${l.qty} (quote, ${q.status})`, doc: { type: "quotation" as const, id: q.id }, line: l.no, customerId: q.customerId, itemId: l.item, qty: l.qty, orderType: act.orderTypeFor(l.item, true), requested: addWorkdays(TODAY, 80) }))),
    ...(sales?.orders ?? []).flatMap((o) => o.lines.map((l) => ({ key: `O|${o.id}|${l.no}`, label: `${o.id} line ${l.no} · ${l.item} × ${l.qty} (${o.type} order, ${o.status})`, doc: { type: "salesOrder" as const, id: o.id }, line: l.no, customerId: o.customerId, itemId: l.item, qty: l.qty, orderType: o.type, requested: (l.requestedShip || o.requestedShip) as ISODate }))),
  ].filter((x) => !s.promises.some((p) => p.doc.id === x.doc.id && p.line === x.line && p.decision !== "Declined" && p.decision !== "Expired"))
  const chosen = lineChoices.find((x) => x.key === adding?.docKey)
  const st = useScreenState("CTP-DLG")
  const [params, setParams] = useSearchParams()
  const openId = params.get("ctp")
  const setOpen = (id: string | null) => {
    if (id) params.set("ctp", id)
    else params.delete("ctp")
    setParams(params, { replace: true })
  }
  const cols: Column<PromiseCandidate>[] = [
    { id: "id", header: "Check", value: (c) => c.id, mono: true },
    { id: "doc", header: "Document", value: (c) => c.doc.id, cell: (c) => <span><RefLink r={c.doc} /> line {c.line}</span> },
    { id: "type", header: "On", value: (c) => (c.doc.type === "quotation" ? "Quote line" : "Order line"), filterable: true },
    { id: "cust", header: "Customer", value: (c) => custName(c.customerId), cell: (c) => <span className="line-clamp-2 max-w-64">{custName(c.customerId)}</span> },
    { id: "item", header: "Item", value: (c) => c.itemId, cell: (c) => <Item id={c.itemId} /> },
    { id: "qty", header: "Qty", value: (c) => c.qty, align: "right", mono: true },
    { id: "req", header: "Requested", value: (c) => c.requestedDate, sortable: true, cell: (c) => fmtDate(c.requestedDate) },
    { id: "ship", header: "Earliest ship", value: (c) => c.result?.shipDate ?? "", cell: (c) => (c.result ? <span className={c.result.shipDate > c.requestedDate ? "text-status-exception-ink" : undefined}>{fmtDate(c.result.shipDate)}</span> : "") },
    { id: "bind", header: "Binding constraint", value: (c) => c.result?.binding ?? "", cell: (c) => <span className="text-sm">{c.result?.binding ?? ""}</span> },
    { id: "qt", header: "Quote type", value: (c) => c.quoteType ?? "", filterable: true, cell: (c) => (c.quoteType ? <span className="inline-flex items-center gap-1 text-sm">{c.quoteType}{act.ctpRequired(c) && <Chip kind="block" note="Firm ETO quotes must carry a CTP result">CTP required</Chip>}</span> : "") },
    { id: "dec", header: "Decision", value: (c) => act.promiseState(c), filterable: true, cell: (c) => <span className="inline-flex items-center gap-1 text-sm">{act.promiseState(c)}{c.reservation && (c.reservation.kind === "Firm" ? <Marker>Firm</Marker> : <Chip kind="change">Soft</Chip>)}</span> },
    { id: "open", header: "", value: () => "", cell: (c) => <Button size="sm" variant="outline" onClick={() => setOpen(c.id)}>Open dialog</Button> },
  ]
  return (
    <>
      <WorkbenchPage<PromiseCandidate>
        header={{
          title: "Promise checks (CTP)",
          screenId: "CTP-DLG",
          crumbs: [{ label: "At-risk promises", to: "/production/at-risk" }, { label: "Promise checks" }],
          description: "The Promise Dialog runs on quote lines and on MTO and ETO order confirmation. Sales decides with planner visibility; this list is the planner's view of every check.",
          chips: <Chip kind="design" note="The dialog lives on quotes and orders; this host page in the planning module lists every check (route design value)">Host page</Chip>,
          primary: <Button onClick={() => setAdding({ docKey: "", quoteType: "Firm" })}>New promise check</Button>,
          actions: (
            <>
              <StatePreview />
              <Button variant="outline" asChild><Link to="/production/at-risk">At-risk promises</Link></Button>
            </>
          ),
        }}
        kpis={[
          { label: "Waiting for a decision", value: s.promises.filter((c) => c.decision === "Result ready" || c.decision === "Not checked").length },
          { label: "Soft reservations held", value: s.promises.filter((c) => c.reservation?.kind === "Soft" && act.promiseState(c) === "Accepted").length, hint: `${act.SOFT_RESERVATION_DAYS}-day decaying reservation (PRD default, configurable)` },
          { label: "Planner review", value: s.promises.filter((c) => c.decision === "Planner review").length },
          { label: "Firm load", value: s.promises.filter((c) => c.reservation?.kind === "Firm").length },
        ]}
        table={{ rows: st.empty ? [] : s.promises, columns: cols, rowId: (c) => c.id, onRowClick: (c) => setOpen(c.id), loading: st.loading, error: st.error, onRetry: st.retry, empty: { title: "No promise checks", body: "Checks open from quote lines and from MTO and ETO order confirmation." } }}
      />
      <RulesPanel className="mt-6" rules={[
        ["E §4", "CTP explodes BOM and routing, checks material dates and finite capacity, and names the binding constraint in words", "DOC:p.193 Book III E §4"],
        ["E §4", "Accept on a quote holds a soft capacity reservation that converts to firm load at order confirmation", "DOC:p.193 Book III E §4"],
        ["E §4", `Soft reservation decays after ${act.SOFT_RESERVATION_DAYS} days (config); firm ETO quotes must carry a CTP result; Budgetary quotes carry lead-time bands, watermarked; MTS lines keep ATP, CTP applies to MTO and ETO`, "DOC:p.193 Book III E §4"],
        ["Design", "Ship date = completion + 3 working days staging; Budgetary lead-time band arithmetic", "design value"],
      ]} />
      {openId && <PromiseDialog id={openId} open={!!openId} onOpenChange={(o) => !o && setOpen(null)} />}
      <DialogShell open={!!adding} onOpenChange={(o) => !o && setAdding(null)} title="New promise check" confirmLabel="Open check"
        consequence="Opens a promise check on the chosen quote or order line. CTP applies to MTO and ETO lines; MTS lines keep ATP and are refused."
        onConfirm={() => {
          if (!chosen) return "Pick a quote line or an order line."
          let newId = ""
          const err = runD((d, ctx) => (newId = act.addPromiseCheck(d, ctx, { doc: chosen.doc, line: chosen.line, customerId: chosen.customerId, itemId: chosen.itemId as never, qty: chosen.qty, orderType: chosen.orderType, quoteType: chosen.doc.type === "quotation" ? adding!.quoteType : undefined, requestedDate: chosen.requested })), (id) => `${id} opened`)
          if (!err) setOpen(newId)
          return err
        }}>
        {adding && (
          <div className="grid gap-3 text-sm">
            <div className="grid gap-1">
              <Label htmlFor="ctp-line">Quote line or order line</Label>
              <Select value={adding.docKey} onValueChange={(v) => setAdding({ ...adding, docKey: v })}>
                <SelectTrigger id="ctp-line"><SelectValue placeholder="Choose a line" /></SelectTrigger>
                <SelectContent>{lineChoices.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {chosen && <p className="text-muted-foreground">{custName(chosen.customerId)} · {matDesc(chosen.itemId)} · {chosen.orderType}{chosen.orderType !== "MTO" && chosen.orderType !== "ETO" ? ": MTS lines keep ATP; CTP will be refused" : ""}</p>}
            {chosen?.doc.type === "quotation" && (
              <fieldset className="grid gap-1">
                <legend className="font-medium">Quote type</legend>
                <RadioGroup value={adding.quoteType} onValueChange={(v) => setAdding({ ...adding, quoteType: v as "Budgetary" | "Firm" })}>
                  <label className="flex items-center gap-2"><RadioGroupItem value="Firm" aria-label="Firm" />Firm (binding; ETO needs a CTP result)</label>
                  <label className="flex items-center gap-2"><RadioGroupItem value="Budgetary" aria-label="Budgetary" />Budgetary (lead-time band, no CTP, watermarked)</label>
                </RadioGroup>
                <span><Chip kind="design" note="The sales quotation carries no quote-type field yet; the planner records it here (README request R-1)">Reading</Chip></span>
              </fieldset>
            )}
          </div>
        )}
      </DialogShell>
    </>
  )
}

// ============================================================================ AT-RISK
export function AtRiskBoard() {
  const s = useSlice("planningProduction")
  const st = useScreenState("AT-RISK")
  const runD = useActDialog()
  const run = useAct()
  const [params, setParams] = useSearchParams()
  const [queue, setQueue] = useState("live")
  const [choice, setChoice] = useState<{ id: string; option: AtRiskRecord["options"][number]["id"]; note: string } | null>(null)
  const activeId = params.get("id")
  const a = s.atRisk.find((x) => x.id === activeId)
  const setActive = (id: string | null) => {
    if (id) params.set("id", id)
    else params.delete("id")
    setParams(params, { replace: true })
  }
  const rows = st.empty ? [] : s.atRisk.filter((x) => (queue === "live" ? x.state !== "Resolved" : queue === "resolved" ? x.state === "Resolved" : x.state === queue))
  const cols: Column<AtRiskRecord>[] = [
    { id: "id", header: "Record", value: (x) => x.id, mono: true },
    { id: "so", header: "Order line", value: (x) => x.soId, cell: (x) => <span><SoLink id={x.soId} /> /{x.line}</span> },
    { id: "cust", header: "Customer", value: (x) => custName(x.customerId), cell: (x) => <span className="line-clamp-2 max-w-56">{custName(x.customerId)}</span> },
    { id: "item", header: "Item", value: (x) => x.itemId, cell: (x) => <Item id={x.itemId} short /> },
    { id: "trigger", header: "Trigger", value: (x) => x.trigger, filterable: true },
    { id: "promise", header: "Promise", value: (x) => x.promiseDate, cell: (x) => fmtDate(x.promiseDate) },
    { id: "proj", header: "Projected", value: (x) => x.projected, sortable: true, cell: (x) => <span className={x.projected > x.promiseDate ? "text-status-exception-ink" : undefined}>{fmtDate(x.projected)}</span> },
    { id: "late", header: "Days late", value: (x) => daysBetween(x.promiseDate, x.projected), align: "right", mono: true, sortable: true },
    { id: "state", header: "State", value: (x) => x.state, filterable: true },
  ]
  return (
    <>
      <WorkbenchPage<AtRiskRecord>
        header={{
          title: "At-risk promises",
          screenId: "AT-RISK",
          description: `Raised by automatic revalidation when projected completion passes the promise less the ${TRANSIT_BUFFER_DAYS}-day transit buffer: ECO affecting the order, a WC outage in its path, a supply slip on a pegged PO, or a schedule publish. Scheduler and sales owner decide jointly.`,
          chips: (
            <>
              <Chip kind="oq" id="OQ-21" note="No status list for at-risk records; state shown as text" />
              <Chip kind="design" note="Automatic triggers: ECO released (engineering.ecoReleased), WC outage (status change), supply slip (MRP re-date of EX-02/EX-06, purchasing.poDeliveryDateChanged), schedule publish. 'Revalidate now' is a manual planner run logged as Manual revalidation.">Triggers</Chip>
            </>
          ),
          primary: <Button onClick={() => run((d, c) => act.revalidate(d, c, "Manual revalidation", "Planner revalidated every pegged promise"), (ids) => (ids.length ? `Raised ${ids.join(", ")}` : "All pegged promises hold"))}>Revalidate now</Button>,
          actions: (
            <>
              <StatePreview />
              <Button variant="outline" asChild><Link to="/production/at-risk/promise">Promise checks (CTP)</Link></Button>
              <Button variant="outline" asChild><Link to="/production/schedule">Schedule board</Link></Button>
            </>
          ),
        }}
        kpis={[
          { label: "Open", value: s.atRisk.filter((x) => x.state === "Open").length },
          { label: "Recovery chosen", value: s.atRisk.filter((x) => x.state === "Recovery chosen").length },
          { label: "Sales change order requested", value: s.atRisk.filter((x) => x.state === "Sales change order requested").length },
          { label: "Resolved", value: s.atRisk.filter((x) => x.state === "Resolved").length },
        ]}
        queues={[{ id: "live", label: "Live" }, { id: "Open", label: "Open" }, { id: "Recovery chosen", label: "Recovery chosen" }, { id: "Sales change order requested", label: "Change order" }, { id: "resolved", label: "Resolved" }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows, columns: cols, rowId: (x) => x.id, onRowClick: (x) => setActive(x.id), activeId: activeId ?? undefined, loading: st.loading, error: st.error, onRetry: st.retry, empty: { title: "No promises at risk", body: "Every pegged order projects inside its promise." } }}
        panel={a ? {
          open: !!a, onOpenChange: (o) => !o && setActive(null), title: `${a.id} · ${a.soId} line ${a.line}`, description: `${custName(a.customerId)} · ${matDesc(a.itemId)}`,
          content: (
            <BodyState state={st} what="At-risk record">
              <div className="flex flex-col gap-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <KV k="Promise">{fmtDate(a.promiseDate)}</KV>
                  <KV k="Projected">{fmtDate(a.projected)}</KV>
                  <KV k="Trigger">{a.trigger}</KV>
                  <KV k="State">{a.state}</KV>
                  <KV k="Orders">{a.woIds.length ? a.woIds.map((w) => <WoLink key={w} id={w} />) : "planned (no WO yet)"}</KV>
                  <KV k="Raised">{fmtDate(a.raisedOn)}</KV>
                </dl>
                <p>{a.cause}</p>
                <div className="flex flex-col gap-2">
                  <p className="font-semibold">Recovery options</p>
                  {a.options.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                      <span className="font-medium">{o.label}</span>
                      <span className="tabular text-muted-foreground">→ {fmtDate(o.projected)}</span>
                      <span className="w-full text-xs text-muted-foreground">{o.note}</span>
                      {(a.state === "Open" || a.state === "Recovery chosen") && <Button size="sm" variant={o.id === "repromise" ? "outline" : "secondary"} onClick={() => setChoice({ id: a.id, option: o.id, note: "" })}>{o.id === "repromise" ? "Trigger sales change order" : "Choose"}</Button>}
                    </div>
                  ))}
                </div>
                {a.state !== "Open" && a.state !== "Resolved" && <Button variant="outline" onClick={() => run((d, c) => act.resolveAtRisk(d, c, a.id), `${a.id} resolved`)}>Mark resolved</Button>}
                <div>
                  <p className="font-semibold">Decision log</p>
                  <ActivityList items={a.decisions} />
                </div>
              </div>
            </BodyState>
          ),
        } : undefined}
      />
      <RulesPanel className="mt-6" rules={[
        ["E §5", "Revalidation compares projected completion with the promise minus the transit buffer and raises an at-risk record", "DOC:p.193 Book III E §5"],
        ["E §5", "Recovery: overtime, alternate work center, partial ship; a re-promise goes only through the sales change order path", "DOC:p.193 Book III E §5"],
        ["Design", `Transit buffer ${TRANSIT_BUFFER_DAYS} days`, "design value"],
      ]} />
      <DialogShell open={!!choice} onOpenChange={(o) => !o && setChoice(null)} title={choice?.option === "repromise" ? "Trigger the sales change order path" : "Choose recovery"} confirmLabel={choice?.option === "repromise" ? "Send to sales change order" : "Log recovery"}
        consequence={choice?.option === "repromise" ? "The promise changes only through the sales change order: the order owner receives the proposed date, reason and impact; customer notification follows class policy." : "The recovery decision is logged on the order and on its production orders."}
        onConfirm={() => runD((d, c) => act.chooseRecovery(d, c, choice!.id, choice!.option, choice!.note), "Decision logged")}>
        {choice && (
          <div className="grid gap-1">
            <Label htmlFor="ar-note">{choice.option === "repromise" ? "Reason and impact (required)" : "Note (optional)"}</Label>
            <Textarea id="ar-note" value={choice.note} onChange={(e) => setChoice({ ...choice, note: e.target.value })} />
          </div>
        )}
      </DialogShell>
    </>
  )
}

