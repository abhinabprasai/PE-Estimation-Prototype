// FX-PLN-RUNMRP Run MRP dialog: regenerative vs net change, scope and horizon, a progress view with
// the stages of a run, and a summary (proposals, exceptions, firmed kept, snapshot ID).
// Opened from the MRP workbench (and from here, which also shows the dialog in each state).
// Nightly regenerative and net change on demand [DOC:p.72 §3.1-§3.3]; firmed planned orders survive [DOC:p.72 §3.3].

import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Chip, KV, RulesPanel } from "@/components/patterns"
import { PageHeader } from "@/components/templates"
import { MATERIALS } from "@/data/shared"
import { useRole, useSlice } from "@/store"
import { AccessNote, StateBanner, StatePreview, qty, useAct, useScreenState } from "../components"
import * as act from "../lib/actions"
import { EX_CATALOG, type ExCode, type MrpRun } from "../data/types"

export const MRP_ROLES = ["Planner", "Planning Manager"] as const
const STAGES = ["Reading demand: sales orders, forecasts, safety stock", "Exploding BOMs by low-level code", "Netting demand against stock, open orders and transfers", "Applying lot sizing (Lot-for-Lot, Fixed Qty, Min/Multiple)", "Writing proposals and exception messages"]
/** One run at a time per plant: a second start while one is going is a conflict. */
let runningNow = false

type Phase = "configure" | "running" | "summary"
export type RunPreview = "validation" | "authorization" | "conflict" | "offline" | "running" | "summary"

interface Summary {
  run: MrpRun
  prev?: MrpRun
  firmedKept: number
  reScheduled: number
  byCode: Partial<Record<ExCode, number>>
}

export function RunMrpDialog({ open, onOpenChange, preview, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; preview?: RunPreview; onDone?: (runId: string) => void }) {
  const s = useSlice("planningProduction")
  const [role] = useRole()
  const run = useAct()
  const [kind, setKind] = useState<"net" | "regen">("net")
  const [item, setItem] = useState("")
  const [horizon, setHorizon] = useState(preview === "validation" ? "80" : "26")
  const [phase, setPhase] = useState<Phase>(preview === "running" ? "running" : preview === "summary" ? "summary" : "configure")
  const [pct, setPct] = useState(preview === "running" ? 60 : 0)
  const [err, setErr] = useState<string | null>(preview === "validation" ? "Horizon must be 4 to 52 weeks." : null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const allowed = (MRP_ROLES as readonly string[]).includes(role) && preview !== "authorization"
  const offline = preview === "offline"
  const busy = (runningNow && phase !== "running") || preview === "conflict"
  const unfirmed = s.plannedOrders.filter((p) => (p.state === "Proposed") && !p.firmed).length
  const firmed = s.plannedOrders.filter((p) => p.state === "Firmed" || (p.state === "Proposed" && p.firmed)).length
  const openEx = s.exceptions.filter((x) => !x.resolved).length

  const reset = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    runningNow = false
    setPhase("configure")
    setPct(0)
    setErr(null)
    setSummary(null)
  }
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current)
    if (!preview) runningNow = false
  }, [preview])

  const validate = () => {
    const h = Number(horizon)
    if (!Number.isInteger(h) || h < 4 || h > 52) return "Horizon must be a whole number of weeks from 4 to 52."
    if (item.trim() && !MATERIALS.some((m) => m.id === item.trim())) return `${item.trim()} is not an item in the material master.`
    if (item.trim() && kind === "regen") return "A regenerative run re-plans every item: clear the item to run it, or choose net change for one item."
    return null
  }
  const start = () => {
    const e = validate()
    if (e) return setErr(e)
    if (!allowed) return setErr(`MRP is run by ${MRP_ROLES.join(" or ")}. You are acting as ${role}.`)
    if (busy) return setErr("Another MRP run is in progress for plant PL-TBD-01. Wait for it to finish.")
    setErr(null)
    runningNow = true
    setPhase("running")
    setPct(0)
    const before = { prev: s.mrpRuns[0], firmed, unfirmed }
    let p = 0
    timer.current = setInterval(() => {
      p += 10
      setPct(Math.min(p, 100))
      if (p >= 100) {
        if (timer.current) clearInterval(timer.current)
        timer.current = null
        const scope = `Plant PL-TBD-01, ${item.trim() ? `item ${item.trim()}` : kind === "net" ? "changed items since last run" : "all items"}, horizon ${horizon} weeks`
        const id = run((d, c) => (kind === "net" ? act.runMrpNetChange(d, c, scope) : act.runMrpRegenerative(d, c, scope)))
        runningNow = false
        if (!id) {
          setPhase("configure")
          setErr("The run was refused; nothing changed.")
          return
        }
        setSummary({ run: { id } as MrpRun, prev: before.prev, firmedKept: before.firmed, reScheduled: kind === "regen" ? before.unfirmed : 0, byCode: {} })
        setPhase("summary")
        onDone?.(id)
      }
    }, 280)
  }
  // the summary reads the stored run record, so it reflects what the store holds
  const stored = summary ? s.mrpRuns.find((r) => r.id === summary.run.id) : preview === "summary" ? s.mrpRuns[0] : undefined
  const byCode = (() => {
    const out: Partial<Record<ExCode, number>> = {}
    for (const x of s.exceptions.filter((x) => !x.resolved)) out[x.code] = (out[x.code] ?? 0) + 1
    return out
  })()
  const prev = summary?.prev ?? s.mrpRuns[1]

  const close = (o: boolean) => {
    if (!o) {
      if (phase === "running") reset()
      else if (phase !== "summary") reset()
      else reset()
    }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run MRP</DialogTitle>
          <DialogDescription>
            {phase === "configure" ? "Choose the kind of run and its scope. Firmed planned orders always survive a run." : phase === "running" ? "Planning plant PL-TBD-01. Close to cancel: nothing is written until the run finishes." : "Run finished."}
          </DialogDescription>
        </DialogHeader>

        {phase === "configure" && (
          <div className="flex flex-col gap-4">
            {offline && <p role="status" className="rounded-md border border-status-pending bg-status-pending-tint px-3 py-2 text-sm"><strong>Offline.</strong> The planning service cannot be reached; a run cannot start until the connection returns.</p>}
            {busy && <p role="alert" className="rounded-md border border-status-blocked px-3 py-2 text-sm"><strong>Conflict.</strong> Another MRP run is in progress for plant PL-TBD-01 (started by Sarah Bjornson). Wait for it to finish; two runs would write over each other.</p>}
            {!allowed && <p role="status" className="rounded-md border px-3 py-2 text-sm"><strong>Not authorized.</strong> MRP is run by {MRP_ROLES.join(" or ")}. You are acting as {role}; switch with Acting as.</p>}
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as "net" | "regen")} className="grid gap-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="net" id="mrp-net" className="mt-1" />
                <span className="text-sm"><strong>Net change (on demand)</strong><br />Re-plans only items whose demand or supply changed since the last run. Typically 2 minutes.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="regen" id="mrp-regen" className="mt-1" />
                <span className="text-sm"><strong>Regenerative</strong><br />Re-plans every item from its need dates; the nightly run (01:00) does the same. Typically 14 minutes. {unfirmed} unfirmed proposal(s) are re-planned.</span>
              </label>
            </RadioGroup>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <Label htmlFor="mrp-plant">Plant</Label>
                <Input id="mrp-plant" value="PL-TBD-01 PE Transformer plant" readOnly aria-readonly="true" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="mrp-horizon">Planning horizon (weeks) <Chip kind="design" note="The horizon default and range are design values; the PRD names the run kinds, not the horizon">Design value</Chip></Label>
                <Input id="mrp-horizon" type="number" min={4} max={52} value={horizon} onChange={(e) => setHorizon(e.target.value)} aria-invalid={!!err && /Horizon/.test(err)} />
              </div>
              <div className="col-span-2 grid gap-1">
                <Label htmlFor="mrp-item">Item (optional, net change only)</Label>
                <Input id="mrp-item" value={item} onChange={(e) => setItem(e.target.value)} placeholder="FIN-TBD-20MVA" aria-invalid={!!err && /item/i.test(err)} />
              </div>
            </div>
            <dl className="grid grid-cols-4 gap-3 rounded-md bg-muted p-3 text-sm">
              <KV k="Firmed, kept">{firmed}</KV>
              <KV k="Unfirmed proposals">{unfirmed}</KV>
              <KV k="Open exceptions">{openEx}</KV>
              <KV k="Last run">{s.mrpRuns[0]?.id}</KV>
            </dl>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          </div>
        )}

        {phase === "running" && (
          <div className="flex flex-col gap-3" aria-live="polite">
            <Progress value={pct} aria-label="MRP run progress" />
            <p className="text-sm tabular">{pct}% · {STAGES[Math.min(STAGES.length - 1, Math.floor(pct / 20))]}</p>
            <ol className="flex flex-col gap-1 text-sm">
              {STAGES.map((st, i) => (
                <li key={st} className={i * 20 < pct ? "" : "text-muted-foreground"}>{i * 20 + 20 <= pct ? "Done: " : i * 20 < pct ? "Now: " : "Next: "}{st}</li>
              ))}
            </ol>
          </div>
        )}

        {phase === "summary" && stored && (
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <KV k="Run">{stored.id}</KV>
              <KV k="Kind">{stored.kind}</KV>
              <KV k="Input snapshot">{stored.snapshotId}</KV>
              <KV k="Proposals now">{stored.plannedOrders}{prev ? ` (${stored.plannedOrders - prev.plannedOrders >= 0 ? "+" : ""}${stored.plannedOrders - prev.plannedOrders} vs ${prev.id})` : ""}</KV>
              <KV k="Open exceptions">{stored.exceptions}{prev ? ` (${stored.exceptions - prev.exceptions >= 0 ? "+" : ""}${stored.exceptions - prev.exceptions} vs ${prev.id})` : ""}</KV>
              <KV k="Firmed, kept">{summary?.firmedKept ?? firmed}</KV>
              <KV k="Re-planned (unfirmed)">{summary?.reScheduled ?? 0}</KV>
              <KV k="Scope">{stored.scope}</KV>
              <KV k="Started by">{stored.by}</KV>
            </dl>
            <p className="font-semibold">Open exceptions by type</p>
            <ul className="flex flex-wrap gap-2">
              {(Object.keys(byCode) as ExCode[]).sort().map((c) => (
                <li key={c}><Chip kind={c === "EX-07" || c === "EX-10" ? "flag" : "design"} note={EX_CATALOG[c].message}>{c}: {qty(byCode[c] ?? 0)}</Chip></li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {phase === "configure" && (
            <>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button onClick={start} disabled={offline}>Run MRP</Button>
            </>
          )}
          {phase === "running" && <Button variant="outline" onClick={() => close(false)}>Cancel run</Button>}
          {phase === "summary" && (
            <>
              <Button variant="outline" asChild><Link to="/production/planned-orders">Planned orders</Link></Button>
              <Button onClick={() => close(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The dialog's registry route: the dialog in each of its states. */
export function RunMrpDialogPage() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PLN-RUNMRP")
  const [role] = useRole()
  const [params] = useSearchParams()
  const [open, setOpen] = useState<RunPreview | "live" | null>(params.get("open") as RunPreview | null)
  const states: { id: RunPreview | "live"; title: string; body: string }[] = [
    { id: "live", title: "Normal", body: "Choose net change or regenerative, set scope and horizon, run. The run is real: it writes proposals, exceptions and a run record with its input snapshot ID." },
    { id: "validation", title: "Validation", body: "A horizon outside 4 to 52 weeks, an unknown item, or an item scope on a regenerative run is refused with the reason beside the field." },
    { id: "authorization", title: "Authorization", body: `Only ${MRP_ROLES.join(" or ")} run MRP (design reading). Any other role sees why and cannot start. You are acting as ${role}.` },
    { id: "conflict", title: "Conflict", body: "A second run for the same plant while one is going is refused: two runs would write over each other." },
    { id: "offline", title: "Offline", body: "Without the planning service the Run button is disabled and the dialog says so." },
    { id: "running", title: "Progress", body: "Five stages with a progress bar; closing the dialog cancels, and nothing is written until the run finishes." },
    { id: "summary", title: "Summary", body: "Run ID, snapshot ID, proposals and exceptions against the previous run, firmed orders kept, open exceptions by type." },
  ]
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Run MRP dialog"
        screenId="FX-PLN-RUNMRP"
        description="The dialog behind Run net change and Run regenerative on the MRP workbench, shown here in each of its states. The empty, loading and error states belong to the workbench behind it."
        chips={<Chip kind="design" note="The route is a design value: the dialog is opened from the workbench">Dialog page</Chip>}
        actions={<StatePreview extended />}
        primary={<Button onClick={() => setOpen("live")}>Open the dialog</Button>}
      />
      <StateBanner st={st} />
      {st.loading ? (
        <div className="h-40 rounded-lg border" aria-busy="true" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {states.map((x) => (
            <li key={x.id} className="flex flex-col gap-2 rounded-lg border p-4">
              <h2 className="text-sm font-semibold">{x.title}</h2>
              <p className="text-sm text-muted-foreground">{x.body}</p>
              <span><Button size="sm" variant="outline" onClick={() => setOpen(x.id)} disabled={x.id === "live" && st.readOnly}>Open in this state</Button></span>
            </li>
          ))}
        </ul>
      )}
      <AccessNote roles={MRP_ROLES} role={role} what="Running MRP" />
      <section className="flex flex-col gap-1 text-sm" aria-label="Last run">
        <h2 className="font-semibold">Last run</h2>
        <p>{s.mrpRuns[0]?.id} · {s.mrpRuns[0]?.kind} · {s.mrpRuns[0]?.snapshotId} · {s.mrpRuns[0]?.plannedOrders} proposals · {s.mrpRuns[0]?.exceptions} exceptions · <Link className="text-link underline" to="/production/mrp">MRP workbench</Link></p>
      </section>
      <RulesPanel rules={[
        ["§3.1-§3.3", "Nightly regenerative run, net change on demand; the plan snapshot carries an input snapshot ID", "DOC:p.72 §3"],
        ["§3.3", "Firmed planned orders survive the next regenerative run", "DOC:p.72 §3.3"],
        ["Design", "Horizon 4-52 weeks (default 26), one run at a time per plant, the stage list, and who may start a run are prototype values", "design value"],
      ]} />
      {open && <RunMrpDialog key={open} open onOpenChange={(o) => !o && setOpen(null)} preview={open === "live" ? undefined : open} />}
    </div>
  )
}
