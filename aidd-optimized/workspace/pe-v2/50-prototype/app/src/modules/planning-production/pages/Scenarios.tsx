// FX-PLN-SCENARIOS Interactive schedule board and multi-scenario compare.
// Scenarios are what-if variations of the live plan: moves, overtime or an added shift, expedited
// orders, an outage. Each runs through the same finite engine; none touches the floor or a promise.
// Moves can be promoted to the SCH-BOARD sandbox, which publishes with a diff and a snapshot ID.
// The sandbox, publish diff and snapshot rules are the PRD's [DOC:p.193 Book III E §3]; the scenario
// levers and the six-scenario limit are design values.

import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Chip, RulesPanel, EmptyState } from "@/components/patterns"
import { DialogShell, PageHeader } from "@/components/templates"
import type { ISODate } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { AccessNote, StateBanner, StatePreview, WoLink, useActDialog, useScreenState } from "../components"
import * as act from "../lib/actions"
import * as ext from "../lib/actions-ext"
import { addWorkdays, allWorkCenters, opKey, schedule, TRANSIT_BUFFER_DAYS } from "../lib/plan"
import { Gantt, ganttOps, workdayRange } from "../widgets/Gantt"
import type { Scenario } from "../data/extra"

const ROLES = ["Production Scheduler", "Planner", "Planning Manager"] as const

export function ScenarioBoard() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PLN-SCENARIOS")
  const [role] = useRole()
  const runD = useActDialog()
  const [sel, setSel] = useState("SCN-TBD-02")
  const [dlg, setDlg] = useState<null | "new" | "levers" | "delete" | "promote">(null)
  const [form, setForm] = useState({ name: "", note: "", copy: "SCN-TBD-01" })
  const [lev, setLev] = useState<{ ot: Record<string, string>; exp: string[]; down: string[] }>({ ot: {}, exp: [], down: [] })
  const [move, setMove] = useState<{ key: string; date: string } | null>(null)
  const [horizon, setHorizon] = useState("20")
  const can = (ROLES as readonly string[]).includes(role) && !st.readOnly

  const scenarios = st.empty ? [] : s.scenarios
  const cur = s.scenarios.find((x) => x.id === sel) ?? s.scenarios[0]
  const plans = useMemo(() => scenarios.map((sc) => {
    const r = ext.scenarioPlan(s, sc)
    return { sc, r, m: ext.scenarioMetrics(s, r) }
  }), [s, scenarios])
  const base = plans.find((p) => p.sc.baseline)
  const curPlan = plans.find((p) => p.sc.id === cur?.id)
  const wcs = allWorkCenters(s).filter((w) => w.status !== "Inactive")
  const openOrders = s.productionOrders.filter((w) => act.isOpenWo(w))
  const pegged = openOrders.filter((w) => w.pegs.length)
  const diff = curPlan && base ? Object.entries(curPlan.r.dates).filter(([k, v]) => base.r.dates[k] && base.r.dates[k][1] !== v[1]) : []

  const openLevers = () => {
    if (!cur) return
    setLev({ ot: Object.fromEntries(Object.entries(cur.extraHours).map(([k, v]) => [k, String(v)])), exp: [...cur.expedite], down: [...cur.down] })
    setDlg("levers")
  }
  const delta = (v: number, b?: number, unit = "") => (b == null || v === b ? "" : ` (${v > b ? "+" : ""}${v - b}${unit})`)
  const best = (f: (p: (typeof plans)[number]) => number) => Math.min(...plans.map(f))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Interactive schedule board and scenario compare"
        screenId="FX-PLN-SCENARIOS"
        description="Build what-if scenarios on the live plan, move operations on the board, and compare them side by side before anything is published. Nothing here reaches the floor or a promise."
        chips={<Chip kind="design" note="Scenario levers (overtime, expedite, outage) and the limit of six scenarios are prototype values; the sandbox, publish diff and snapshot ID are the PRD's">Design levers</Chip>}
        actions={<><StatePreview extended /><Button variant="outline" asChild><Link to="/production/schedule">Schedule board</Link></Button></>}
        primary={<Button disabled={!can} onClick={() => (setForm({ name: "", note: "", copy: "SCN-TBD-01" }), setDlg("new"))}>New scenario</Button>}
      />
      <StateBanner st={st} />
      <AccessNote roles={ROLES} role={role} what="Building scenarios" />

      {st.loading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading"><div className="h-32 rounded-lg border" /><div className="h-64 rounded-lg border" /></div>
      ) : st.error ? (
        <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{st.error} <button className="underline" onClick={st.retry}>Try again</button></p>
      ) : !scenarios.length ? (
        <EmptyState title="No scenarios yet">Create one from the live plan to compare it.</EmptyState>
      ) : (
        <>
          <section aria-label="Scenario compare" className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-table-head text-left">
                <tr>
                  <th scope="col" className="px-3 py-2">Measure</th>
                  {plans.map((p) => (
                    <th key={p.sc.id} scope="col" className="px-3 py-2">
                      <button className={`text-left underline-offset-4 hover:underline ${cur?.id === p.sc.id ? "font-semibold text-primary" : ""}`} onClick={() => setSel(p.sc.id)} aria-pressed={cur?.id === p.sc.id}>{p.sc.name}</button>
                      <span className="block text-xs font-normal text-muted-foreground">{p.sc.id}{p.sc.baseline ? " · reference" : ""}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-t">
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal">Pegged promises past the transit buffer</th>
                  {plans.map((p) => <td key={p.sc.id} className={`tabular ${p.m.promisesLate.length === best((x) => x.m.promisesLate.length) && plans.length > 1 ? "font-semibold" : ""}`}>{p.m.promisesLate.length}{delta(p.m.promisesLate.length, base?.m.promisesLate.length)}</td>)}
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal">Late orders (finish past due date)</th>
                  {plans.map((p) => <td key={p.sc.id} className="tabular">{p.m.lateOrders}{delta(p.m.lateOrders, base?.m.lateOrders)}</td>)}
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal">Unschedulable operations</th>
                  {plans.map((p) => <td key={p.sc.id} className="tabular">{p.m.unschedulable}{delta(p.m.unschedulable, base?.m.unschedulable)}</td>)}
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal">Last finish of open orders</th>
                  {plans.map((p) => <td key={p.sc.id} className={`tabular ${p.m.makespan === [...plans].sort((a, b) => a.m.makespan.localeCompare(b.m.makespan))[0].m.makespan && plans.length > 1 ? "font-semibold" : ""}`}>{fmtDate(p.m.makespan)}</td>)}
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal">Load over the next 20 working days</th>
                  {plans.map((p) => <td key={p.sc.id} className="tabular">{p.m.utilization}%{delta(p.m.utilization, base?.m.utilization, " pt")}</td>)}
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal">Levers</th>
                  {plans.map((p) => (
                    <td key={p.sc.id} className="text-xs text-muted-foreground">
                      {p.sc.baseline ? "none" : [Object.keys(p.sc.extraHours).length && `+h/day at ${Object.keys(p.sc.extraHours).join(", ")}`, p.sc.expedite.length && `${p.sc.expedite.length} expedited`, p.sc.down.length && `${p.sc.down.join(", ")} down 3 days`, p.sc.moves.length && `${p.sc.moves.length} move(s)`].filter(Boolean).join(" · ") || "none yet"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>

          {cur && curPlan && (
            <section aria-label="Scenario board" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{cur.name}</h2>
                {cur.baseline ? <Chip kind="design">Live plan: reference</Chip> : <span className="text-sm text-muted-foreground">{cur.note} Created by {cur.createdBy}, {fmtDate(cur.createdOn)}.</span>}
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <Select value={horizon} onValueChange={setHorizon}>
                    <SelectTrigger size="sm" className="h-8 w-36" aria-label="Board horizon"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="10">2 weeks</SelectItem><SelectItem value="20">4 weeks</SelectItem><SelectItem value="30">6 weeks</SelectItem></SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={!can || !!cur.baseline} onClick={openLevers}>Edit levers</Button>
                  <Button size="sm" variant="outline" disabled={!can || !!cur.baseline || !cur.moves.length} onClick={() => setDlg("promote")}>Promote moves to sandbox</Button>
                  <Button size="sm" variant="ghost" disabled={!can || !!cur.baseline} onClick={() => setDlg("delete")}>Delete</Button>
                </span>
              </div>
              <Gantt
                wcs={wcs}
                ops={ganttOps(s.productionOrders, curPlan.r, new Set(cur.moves.map((m) => m.key)), (w, f) => !!w.pegs.length && !!w.promiseDate && f > addWorkdays(w.promiseDate, -TRANSIT_BUFFER_DAYS))}
                days={workdayRange(TODAY as ISODate, Number(horizon))}
                freezeOf={(id) => addWorkdays(TODAY as ISODate, s.wc[id]?.freezeDays ?? 5)}
                windows={s.maintWindows}
                onBar={(o) => cur.baseline ? undefined : (s.productionOrders.find((w) => w.id === o.woId)?.operations.find((x) => x.no === o.no)?.status === "Not Started" ? setMove({ key: o.key, date: o.start }) : undefined)}
              />
              <p className="text-xs text-muted-foreground">{cur.baseline ? "Select a what-if scenario to move operations on its board." : "Click a planned bar to move it (earliest start) in this scenario. Running operations do not move."}</p>
              {!cur.baseline && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-semibold">Against the live plan: {diff.length} operation finish date(s) differ, {curPlan.m.promisesLate.length} pegged promise(s) past the transit buffer.</p>
                  <ul className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto tabular">
                    {diff.slice(0, 20).map(([k, v]) => <li key={k}><span className="font-mono">{k}</span>: {fmtDate(base!.r.dates[k][1])} → {fmtDate(v[1])}</li>)}
                    {!diff.length && <li className="text-muted-foreground">No finish date differs: the levers do not change this plan yet.</li>}
                  </ul>
                  {curPlan.m.promisesLate.length > 0 && (
                    <p className="mt-2 text-muted-foreground">Late promises: {curPlan.m.promisesLate.map((x) => <span key={x.woId} className="mr-2"><WoLink id={x.woId} /> ({x.soId}, {x.daysLate} d)</span>)}</p>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <RulesPanel rules={[
        ["E §3", "A what-if sandbox never reaches the floor or a promise; publishing creates a snapshot ID that promises reference and shows a diff first", "DOC:p.193 Book III E §3"],
        ["E §2", "Finite buckets, maintenance blocks capacity, running operations do not move; the same engine plans every scenario", "DOC:p.192 Book III E §2"],
        ["Design", "Overtime hours per day, expediting an order (priority 1, forward from release), a 3-working-day outage and the six-scenario limit are prototype values. Only moves can be promoted to the sandbox: capacity levers are assumptions, not plan data", "design value"],
      ]} />

      <DialogShell open={dlg === "new"} onOpenChange={(o) => !o && setDlg(null)} title="New scenario" confirmLabel="Create scenario" consequence="Creates a what-if copy of the chosen scenario. It is planned by the same finite engine; the live plan is unchanged."
        onConfirm={() => runD((d, c) => { const id = ext.createScenario(d, c, { name: form.name, note: form.note, copyFrom: form.copy }); setSel(id); return id }, (id) => `${id} created`)}>
        <div className="grid gap-2">
          <Label htmlFor="sc-name">Name</Label>
          <Input id="sc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Label htmlFor="sc-note">What are you testing?</Label>
          <Textarea id="sc-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Label htmlFor="sc-copy">Start from</Label>
          <Select value={form.copy} onValueChange={(v) => setForm({ ...form, copy: v })}>
            <SelectTrigger id="sc-copy"><SelectValue /></SelectTrigger>
            <SelectContent>{s.scenarios.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </DialogShell>

      <DialogShell open={dlg === "levers"} onOpenChange={(o) => !o && setDlg(null)} title={`Levers: ${cur?.name}`} confirmLabel="Apply levers" wide
        consequence="The scenario is re-planned with these levers. The live plan and every promise stay as they are."
        onConfirm={() => {
          const extraHours: Scenario["extraHours"] = {}
          for (const [k, v] of Object.entries(lev.ot)) {
            if (v === "" || Number(v) === 0) continue
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0 || n > 16) return `Overtime at ${k} must be 0 to 16 hours a day.`
            extraHours[k] = n
          }
          return runD((d, c) => ext.updateScenario(d, c, cur!.id, { extraHours, expedite: lev.exp, down: lev.down }), "Levers applied")
        }}>
        <div className="grid max-h-80 gap-4 overflow-y-auto md:grid-cols-3">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">Extra hours per working day</legend>
            {wcs.filter((w) => w.status === "Active").map((w) => (
              <div key={w.id} className="flex items-center gap-2 text-sm">
                <Label htmlFor={`ot-${w.id}`} className="w-16 font-mono text-xs">{w.id}</Label>
                <Input id={`ot-${w.id}`} type="number" min={0} max={16} className="h-8 w-20" value={lev.ot[w.id] ?? ""} onChange={(e) => setLev({ ...lev, ot: { ...lev.ot, [w.id]: e.target.value } })} />
              </div>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">Expedite (priority 1)</legend>
            {pegged.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm"><Checkbox checked={lev.exp.includes(w.id)} onCheckedChange={(c) => setLev({ ...lev, exp: c ? [...lev.exp, w.id] : lev.exp.filter((x) => x !== w.id) })} /><span className="font-mono text-xs">{w.id}</span></label>
            ))}
            {!pegged.length && <p className="text-sm text-muted-foreground">No pegged open orders.</p>}
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">Outage for 3 working days</legend>
            {wcs.filter((w) => w.status === "Active").map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm"><Checkbox checked={lev.down.includes(w.id)} onCheckedChange={(c) => setLev({ ...lev, down: c ? [...lev.down, w.id] : lev.down.filter((x) => x !== w.id) })} /><span className="font-mono text-xs">{w.id}</span><span className="truncate text-muted-foreground">{w.name}</span></label>
            ))}
          </fieldset>
        </div>
      </DialogShell>

      <DialogShell open={!!move} onOpenChange={(o) => !o && setMove(null)} title={`Move ${move?.key} in ${cur?.name}`} confirmLabel="Apply move" consequence="Sets an earliest start for this operation in this scenario only. The finite engine re-plans it and everything after it."
        onConfirm={() => runD((d, c) => ext.moveInScenario(d, c, cur!.id, move!.key, move!.date as ISODate), "Move applied in the scenario")}>
        {move && (
          <div className="grid gap-2">
            <Label htmlFor="sm-date">Not before</Label>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" aria-label="One working day earlier" onClick={() => setMove({ ...move, date: addWorkdays(move.date as ISODate, -1) })}>-1 d</Button>
              <Input id="sm-date" type="date" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })} />
              <Button size="sm" variant="outline" aria-label="One working day later" onClick={() => setMove({ ...move, date: addWorkdays(move.date as ISODate, 1) })}>+1 d</Button>
            </div>
            <p className="text-xs text-muted-foreground">Freeze-horizon rules apply when the move is promoted to the sandbox: inside it a Production Scheduler action with a reason is needed.</p>
          </div>
        )}
      </DialogShell>

      <DialogShell open={dlg === "promote"} onOpenChange={(o) => !o && setDlg(null)} title={`Promote ${cur?.moves.length ?? 0} move(s) to the sandbox`} confirmLabel="Promote to sandbox"
        consequence="The moves are applied in the SCH-BOARD what-if sandbox under its freeze-horizon rules (Production Scheduler with a reason inside the horizon). Publishing is still a separate step with a diff. Overtime, expedite and outage levers stay in the scenario."
        requireReason reasonLabel="Reason (used for any move inside the freeze horizon)"
        onConfirm={(r) => runD((d, c) => {
          if (!d.sandbox) act.openSandbox(d, c)
          for (const m of cur!.moves) act.moveOp(d, c, m.key.split("/")[0], Number(m.key.split("/")[1]), m.notBefore, r)
          return cur!.moves.length
        }, (n) => `${n} move(s) are in the sandbox; publish them on the schedule board`)}>
        <ul className="max-h-40 overflow-y-auto text-sm">{cur?.moves.map((m) => <li key={m.key} className="tabular"><span className="font-mono">{m.key}</span> not before {fmtDate(m.notBefore)}</li>)}</ul>
      </DialogShell>

      <DialogShell open={dlg === "delete"} onOpenChange={(o) => !o && setDlg(null)} title={`Delete ${cur?.name}`} confirmLabel="Delete scenario" destructive consequence="The scenario and its levers are removed. The live plan is not affected."
        onConfirm={() => runD((d, c) => { ext.deleteScenario(d, c, cur!.id); setSel("SCN-TBD-01") }, "Scenario deleted")} />
      {void opKey}{void schedule}
    </div>
  )
}
