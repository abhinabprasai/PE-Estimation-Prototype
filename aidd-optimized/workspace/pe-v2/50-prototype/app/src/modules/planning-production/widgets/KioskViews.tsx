// Kiosk views added for PP-SFT-001 (floor-touch, 1280 x 800): published capture-template entry and the
// oven multi-order batch confirm (WC-230 is a batch resource). Targets are 48 px or more. Posting and
// validation are the same actions as the office screens (lib/actions-ext.ts).
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chip } from "@/components/patterns"
import type { UserId } from "@/data/domain"
import { qty, matDesc } from "../components"
import * as ext from "../lib/actions-ext"
import { allWorkCenters } from "../lib/plan"
import type { CaptureField, CaptureTemplate } from "../data/extra"
import type { PlanningProductionState } from "../data/types"

type Exec = (text: string, fn: (d: PlanningProductionState, c: import("@/store").MutateCtx) => unknown) => { ok: true } | { ok: false; error: string; field?: string }

/** Typed entry for the capture template published for this work center. Hard limits are refused on
 *  save; soft limits warn; required fields block Complete (checked when the operation completes). */
export function CaptureEntry({ template, values, onSet }: { template: CaptureTemplate; values?: Record<string, string>; onSet: (label: string, value: string) => string | null }) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [err, setErr] = useState<Record<string, string>>({})
  const issues = ext.captureIssues(template, { ...values, ...draft })
  const save = (f: CaptureField, v: string) => {
    setDraft((d) => ({ ...d, [f.label]: v }))
    if (v === (values?.[f.label] ?? "")) return
    const e = onSet(f.label, v)
    setErr((x) => ({ ...x, [f.label]: e ?? "" }))
  }
  return (
    <section aria-label="Data capture" className="flex flex-col gap-2">
      <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">Data capture <span className="text-sm font-normal text-muted-foreground">{template.name} version {template.version}</span></h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {template.fields.map((f) => {
          const v = draft[f.label] ?? values?.[f.label] ?? ""
          const iss = issues.find((x) => x.field.id === f.id && x.level !== "missing")
          const missing = issues.find((x) => x.field.id === f.id && x.level === "missing")
          return (
            <div key={f.id} className="grid content-start gap-1">
              <Label htmlFor={`kc-${f.id}`} className="text-base">{f.label}{f.unit ? ` (${f.unit})` : ""}{f.required ? " *" : ""}</Label>
              {f.kind === "pass-fail" ? (
                <div className="flex gap-2" role="radiogroup" aria-label={f.label}>{["Pass", "Fail"].map((o) => <Button key={o} role="radio" aria-checked={v === o} variant={v === o ? "secondary" : "outline"} className="h-16 flex-1 text-lg" onClick={() => save(f, o)}>{o}</Button>)}</div>
              ) : f.kind === "choice" ? (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={f.label}>{(f.options ?? []).map((o) => <Button key={o} role="radio" aria-checked={v === o} variant={v === o ? "secondary" : "outline"} className="h-12" onClick={() => save(f, o)}>{o}</Button>)}</div>
              ) : f.kind === "attachment" ? (
                <Button variant={v ? "secondary" : "outline"} className="h-12" onClick={() => save(f, "Attached (simulated photo)")}>{v ? v : "Attach photo"}</Button>
              ) : (
                <Input id={`kc-${f.id}`} className="h-12 text-lg" inputMode={f.kind === "number" ? "decimal" : undefined} value={v} onChange={(e) => setDraft({ ...draft, [f.label]: e.target.value })} onBlur={(e) => save(f, e.target.value)} aria-invalid={!!err[f.label]} />
              )}
              {err[f.label] && <span role="alert" className="text-sm text-destructive">{err[f.label]}</span>}
              {!err[f.label] && iss && <span role="status" className="text-sm text-status-pending-ink">{iss.level === "soft" ? "Warning: " : ""}{iss.text}</span>}
              {!err[f.label] && !iss && missing && v === "" && <span className="text-sm text-muted-foreground">Required to complete</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Oven multi-order load: select the orders in this cycle, start them together, then confirm all with one cycle number and moisture. */
export function OvenBatch({ s, wcId, crewIds, exec, notify }: { s: PlanningProductionState; wcId: string; crewIds: UserId[]; exec: Exec; notify: (kind: "info" | "error", text: string) => void }) {
  const [pick, setPick] = useState<string[]>([])
  const [cycle, setCycle] = useState("")
  const [moist, setMoist] = useState("")
  const cands = ext.batchCandidates(s, wcId)
  const wc = allWorkCenters(s).find((w) => w.id === wcId)
  const cap = wc?.cycleSize ?? 4
  const running = cands.filter((x) => x.o.status === "In Progress")
  const key = (x: (typeof cands)[number]) => `${x.w.id}/${x.o.no}`
  const toggle = (k: string) => setPick((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  const startable = pick.filter((k) => cands.find((x) => key(x) === k)?.o.status === "Not Started")
  const confirmable = pick.filter((k) => cands.find((x) => key(x) === k)?.o.status === "In Progress")
  return (
    <section aria-label="Oven load" className="flex flex-col gap-4">
      <p className="text-lg">One vapor-phase cycle holds up to {cap} orders. Select the orders in this load, start them together, then confirm the whole load with one cycle number and the final moisture.</p>
      {cands.length === 0 && <p className="text-lg text-muted-foreground">No order is ready for the oven.</p>}
      <ul className="flex flex-col gap-2">
        {cands.map((x) => (
          <li key={key(x)}>
            <button aria-pressed={pick.includes(key(x))} onClick={() => toggle(key(x))} className={`grid min-h-16 w-full grid-cols-[32px_180px_minmax(0,1fr)_160px] items-center gap-4 rounded-md border px-4 text-left text-base ${pick.includes(key(x)) ? "bg-secondary" : ""}`}>
              <span aria-hidden="true">{pick.includes(key(x)) ? "☑" : "☐"}</span><span className="font-mono">{key(x)}</span><span className="truncate">{matDesc(x.w.itemId)} · {x.o.text}</span><span>{x.o.status === "In Progress" ? <Chip kind="design" note="Started in an earlier load">In oven</Chip> : "Ready"} · {qty(x.w.qty)} unit</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <Button className="h-16 px-6 text-lg" disabled={!startable.length || pick.length > cap} onClick={() => { const r = exec(`Start oven load ${startable.join(", ")}`, (d, c) => ext.startBatch(d, c, wcId, pick, crewIds)); r.ok ? (notify("info", `${startable.length} order(s) started together (SP-10 each)`)) : notify("error", r.error) }}>Start load ({startable.length})</Button>
        <span className="grid gap-1"><Label htmlFor="ov-cycle" className="text-base">Cycle # (oven chart)</Label><Input id="ov-cycle" className="h-12 w-44 text-lg" value={cycle} onChange={(e) => setCycle(e.target.value)} /></span>
        <span className="grid gap-1"><Label htmlFor="ov-moist" className="text-base">Final moisture (%)</Label><Input id="ov-moist" inputMode="decimal" className="h-12 w-44 text-lg" value={moist} onChange={(e) => setMoist(e.target.value)} /></span>
        <Button className="h-16 px-6 text-lg" disabled={!confirmable.length} onClick={() => { const r = exec(`Confirm oven load ${confirmable.join(", ")}`, (d, c) => ext.completeBatch(d, c, wcId, confirmable, { cycle, moisture: moist, eventBase: `evt-batch-${Date.now()}` })); if (r.ok) { notify("info", `${confirmable.length} order(s) confirmed from cycle ${cycle}: #29 posted for each`); setPick([]); setCycle(""); setMoist("") } else notify("error", r.error) }}>Confirm load ({confirmable.length})</Button>
      </div>
      {pick.length > cap && <p role="alert" className="text-destructive">{pick.length} selected; one cycle holds {cap}.</p>}
      <p className="text-sm text-muted-foreground">{running.length} order(s) currently in the oven. Final moisture is a hard limit of the published capture template; a load above it is refused. Cycle size is the work center's setting.</p>
    </section>
  )
}
