// Floor and planning components: scan feedback, kiosk control set, test characteristic row with
// calibration interlock, finite schedule / Gantt with capacity bars, board and pipeline cards.
import { useState } from "react"
import { Check, Minus, OctagonAlert, Pause, Play, Square, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chip, FamilyBadge, ScanField, StatusBadge, type ScanOutcome } from "@/components/patterns"
import { DialogShell } from "@/components/templates"
import { USERS, WORK_CENTERS } from "@/data/shared"
import { STATUS, type Family, type RecordKind } from "@/data/domain"
import { cn } from "@/lib/utils"
import { OfflineBanner } from "./states"

// ====================================================================================== scan feedback
const SUPERVISORS = USERS.filter((u) => u.roles.some((r) => r === "Warehouse supervisor" || r === "Production supervisor" || r === "Shipping Manager"))
/** Scan input and feedback: focus-locked field (ScanField), success flash, E-code failure banner naming what
 *  was scanned and expected and the next action, offline queue banner, supervisor badge override. */
export function ScanFeedbackDemo({ offline }: { offline?: boolean }) {
  const [queued, setQueued] = useState(offline ? 7 : 0)
  const [overridden, setOverridden] = useState<string[]>([])
  const [pendingOverride, setPendingOverride] = useState<string | null>(null)
  const [badge, setBadge] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  const expected = "component batch BAT-TBD-C0412 (FEFO first) for operation 40"
  const onScan = (code: string): ScanOutcome => {
    if (offline) {
      setQueued((q) => q + 1)
      return { ok: true, message: `queued (${queued + 1} waiting); replays when online` }
    }
    if (overridden.includes(code)) return { ok: true, message: "issued under a supervisor override, logged" }
    if (code === "BAT-TBD-C0412") return { ok: true, message: "issue posted (#28), genealogy row written" }
    if (code === "BAT-TBD-B0301") return { ok: false, errorCode: "E-PP-07", message: "batch is Blocked by recall RCL-2026-001", expected: "an Unrestricted batch of the component on this operation", next: "Scan the FEFO batch, or ask a supervisor to override and record why." }
    setPendingOverride(code)
    return { ok: false, errorCode: "E-PP-07", message: "this batch is not the FEFO suggestion", expected, next: "Scan the suggested batch. A supervisor can override: scan a supervisor badge below." }
  }
  return (
    <div className="flex flex-col gap-4">
      {offline && <OfflineBanner queued={queued} />}
      <ScanField scanPoint="SP-08" expected={expected} onScan={onScan} />
      <p className="text-xs text-muted-foreground">Try: BAT-TBD-C0412 (success), BAT-TBD-B0301 (blocked batch), anything else (not FEFO). Feedback target under 400 ms (P95); one beep on success, two low beeps on failure.</p>
      {pendingOverride && !offline && (
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <p className="text-sm font-medium">Supervisor override for {pendingOverride}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="sup-badge" className="text-xs">
                Scan the supervisor badge
              </Label>
              <Input id="sup-badge" value={badge} onChange={(e) => setBadge(e.target.value)} placeholder={SUPERVISORS[0]?.badge} className="h-12 w-48 font-mono" />
            </div>
            <Button
              className="h-12"
              onClick={() => {
                const u = SUPERVISORS.find((s) => s.badge === badge.trim())
                if (!u) return setMsg(`Badge ${badge || "(empty)"} is not a supervisor badge.`)
                setOverridden((o) => [...o, pendingOverride])
                setMsg(`Override accepted from ${u.name}. Scan ${pendingOverride} again; the issue is logged with the override.`)
                setPendingOverride(null)
                setBadge("")
              }}
            >
              Confirm override
            </Button>
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className="rounded-md bg-muted p-2 text-sm">
          {msg}
        </p>
      )}
    </div>
  )
}

// ====================================================================================== kiosk control set
export function NumericKeypad({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "Clear", "0", "Back"]
  return (
    <div role="group" aria-label="Numeric keypad" className="flex w-72 flex-col gap-2">
      <output aria-live="polite" className="tabular flex h-14 items-center justify-end rounded-md border px-4 text-2xl font-semibold">
        {value || "0"}
      </output>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <Button key={k} variant="outline" className="h-14 text-xl" onClick={() => onChange(k === "Clear" ? "" : k === "Back" ? value.slice(0, -1) : (value + k).slice(0, 6))}>
            {k}
          </Button>
        ))}
      </div>
      <Button className="h-16 text-lg" onClick={onEnter}>
        Enter quantity
      </Button>
    </div>
  )
}

const ANDON = ["Material shortage", "Quality problem", "Machine down", "Safety stop"] as const
const CREW = ["Luis Ortega", "Ngozi Eze", "Owen Pelletier", "Mei Lin"]
export function KioskControlSet() {
  const [hc, setHc] = useState(false)
  const [run, setRun] = useState<"Ready" | "Running" | "Done">("Ready")
  const [qty, setQty] = useState("")
  const [hold, setHold] = useState<string | null>(null)
  const [andon, setAndon] = useState<string | null>(null)
  const [crew, setCrew] = useState<string[]>([CREW[0]])
  const [badge, setBadge] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const add = (t: string) => setLog((l) => [t, ...l].slice(0, 5))
  return (
    <div className={cn("flex flex-col gap-4", hc && "[&_button]:border-4 [&_button]:border-foreground [&_button]:font-bold")} data-contrast={hc ? "high" : "normal"}>
      <label className="flex h-12 items-center gap-2 text-base">
        <input type="checkbox" className="size-6" checked={hc} onChange={(e) => setHc(e.target.checked)} /> High contrast (heavier borders and bold labels; kiosk stays on the light theme)
      </label>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Badge login" className="flex flex-col gap-2 rounded-lg border p-4">
          <h3 className="text-lg font-semibold">Badge login (SP-07)</h3>
          {badge ? (
            <p className="text-base">
              Operator <strong>{badge}</strong> logged in at WC-400. <Button variant="outline" className="ml-2 h-12" onClick={() => (setBadge(null), add("Badge out"))}>Badge out</Button>
            </p>
          ) : (
            <ScanField scanPoint="SP-07" expected="your badge, for example BDG-7018" onScan={(c) => (/^BDG-\d{4}$/.test(c) ? (setBadge(USERS.find((u) => u.badge === c)?.name ?? c), add(`Login ${c}`), { ok: true, message: "logged in" }) : { ok: false, expected: "a badge like BDG-7018", next: "Scan the badge again.", message: "not a badge" })} />
          )}
        </section>
        <section aria-label="Crew clock-in" className="flex flex-col gap-2 rounded-lg border p-4">
          <h3 className="text-lg font-semibold">Crew clock-in</h3>
          <ul className="grid grid-cols-2 gap-2">
            {CREW.map((c) => {
              const on = crew.includes(c)
              return (
                <li key={c}>
                  <Button variant={on ? "default" : "outline"} aria-pressed={on} className="h-12 w-full text-base" onClick={() => (setCrew(on ? crew.filter((x) => x !== c) : [...crew, c]), add(`${on ? "Clock out" : "Clock in"} ${c}`))}>
                    {on ? "In: " : "Out: "}
                    {c}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
        <section aria-label="Start and complete" className="flex flex-col gap-2 rounded-lg border p-4">
          <h3 className="text-lg font-semibold">Operation 40, winding: start and complete</h3>
          <p className="text-base">
            State: <strong>{run}</strong>
          </p>
          <Button className="h-16 text-lg" disabled={run !== "Ready"} onClick={() => (setRun("Running"), add("Operation started (SP-10)"))}>
            <Play aria-hidden="true" /> Start operation
          </Button>
          <Button className="h-16 text-lg" variant="outline" disabled={run !== "Running" || !qty} onClick={() => (setRun("Done"), add(`Completed qty ${qty} (SP-11)`))}>
            <Square aria-hidden="true" /> Complete operation
          </Button>
          {run === "Running" && !qty && <p className="text-base text-muted-foreground">Enter the good quantity on the keypad to complete.</p>}
          {run === "Done" && <Button variant="ghost" className="h-12" onClick={() => (setRun("Ready"), setQty(""))}>Reset demo</Button>}
        </section>
        <section aria-label="Quantity keypad" className="flex flex-col gap-2 rounded-lg border p-4">
          <h3 className="text-lg font-semibold">Numeric keypad</h3>
          <NumericKeypad value={qty} onChange={setQty} onEnter={() => add(`Quantity ${qty || 0} entered`)} />
        </section>
        <section aria-label="Hold and andon" className="flex flex-col gap-2 rounded-lg border p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold">Hold and andon</h3>
          <div className="grid gap-2 md:grid-cols-4">
            {ANDON.map((a) => (
              <Button key={a} variant={andon === a ? "destructive" : "outline"} className="h-16 text-base" onClick={() => (setAndon(andon === a ? null : a), add(andon === a ? `Andon cleared: ${a}` : `Andon raised: ${a}`))}>
                <OctagonAlert aria-hidden="true" /> {a}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-12 text-base" disabled={run !== "Running"} onClick={() => setHold("hold")}>
              <Pause aria-hidden="true" /> Put the operation on hold
            </Button>
            {hold === "reason-set" && <FamilyBadge family="blocked" label="Operation on hold" size="lg" />}
          </div>
          {andon && <p role="alert" className="rounded-md bg-destructive p-2 text-base text-destructive-foreground">Andon active: {andon}. The supervisor is called on the dispatch list.</p>}
        </section>
      </div>
      <DialogShell open={hold === "hold"} onOpenChange={(o) => !o && setHold((h) => (h === "hold" ? null : h))} title="Put operation 40 on hold?" consequence="The labor clock stops and the supervisor is notified." requireReason reasonLabel="Reason (required)" confirmLabel="Hold operation" onConfirm={(r) => (setHold("reason-set"), add(`Hold: ${r}`), null)} />
      <ul aria-label="Event log" className="text-sm text-muted-foreground">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

// ====================================================================================== test characteristic row
type CalState = "In Cal" | "Due Soon" | "Overdue" | "Out of Service"
export const INSTRUMENTS: { id: string; name: string; state: CalState; due: string }[] = [
  { id: "CAL-TBD-014", name: "Ratio bridge TTR-3", state: "In Cal", due: "2027-02-14" },
  { id: "CAL-TBD-022", name: "Hipot tester 60 kV", state: "Due Soon", due: "2026-10-23" },
  { id: "CAL-TBD-031", name: "Winding resistance meter", state: "Overdue", due: "2026-09-30" },
  { id: "CAL-TBD-040", name: "Power analyzer", state: "Out of Service", due: "2026-08-15" },
]
const CAL_FAMILY: Record<CalState, Family> = { "In Cal": "active", "Due Soon": "pending", Overdue: "blocked", "Out of Service": "blocked" }
export interface Characteristic {
  name: string
  unit: string
  min?: number
  max?: number
  method: string
}
export const CHARACTERISTICS: Characteristic[] = [
  { name: "Turns ratio deviation", unit: "%", min: -0.5, max: 0.5, method: "IEEE C57.12.90 section 8" },
  { name: "No-load loss", unit: "kW", max: 21.5, method: "IEEE C57.12.90 section 8.6" },
  { name: "HV winding resistance, phase A", unit: "mOhm", min: 410, max: 430, method: "IEEE C57.12.90 section 5" },
]
export function TestCharacteristicRow({ c, history }: { c: Characteristic; history?: { run: number; value: number }[] }) {
  const [inst, setInst] = useState(INSTRUMENTS[0].id)
  const [val, setVal] = useState("")
  const [runs, setRuns] = useState(history ?? [])
  const i = INSTRUMENTS.find((x) => x.id === inst)!
  const blocked = i.state === "Overdue" || i.state === "Out of Service"
  const n = val === "" ? NaN : Number(val)
  const verdict = Number.isNaN(n) ? null : (c.min == null || n >= c.min) && (c.max == null || n <= c.max)
  return (
    <div className="flex flex-col gap-2 rounded-md border p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-56">
          <p className="font-medium">{c.name}</p>
          <p className="text-xs text-muted-foreground">
            {c.method} · limits {c.min ?? "no min"} to {c.max ?? "no max"} {c.unit}
          </p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`inst-${c.name}`} className="text-xs">
            Instrument (SP-14 scan CAL label)
          </Label>
          <select id={`inst-${c.name}`} value={inst} onChange={(e) => setInst(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            {INSTRUMENTS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id} {x.name}
              </option>
            ))}
          </select>
        </div>
        <StatusBadge kind="instrument" status={i.state} />
        <div className="grid gap-1">
          <Label htmlFor={`val-${c.name}`} className="text-xs">
            Measured ({c.unit})
          </Label>
          <Input id={`val-${c.name}`} type="number" step="any" value={val} disabled={blocked} onChange={(e) => setVal(e.target.value)} className="h-9 w-28" />
        </div>
        <div aria-live="polite" className="min-w-20">
          {verdict == null ? <span className="text-xs text-muted-foreground">Enter a value</span> : <FamilyBadge family={verdict ? "done" : "blocked"} label={verdict ? "Pass" : "Fail"} />}
        </div>
        <Button size="sm" disabled={blocked || verdict == null} onClick={() => (setRuns([...runs, { run: runs.length + 1, value: n }]), setVal(""))}>
          Record run
        </Button>
      </div>
      {i.state === "Due Soon" && (
        <p className="flex items-center gap-2 text-sm text-status-pending-ink">
          <TriangleAlert className="size-4" aria-hidden="true" /> Calibration due {i.due}. The test is allowed; alerts fire at 30, 14 and 3 days.
        </p>
      )}
      {blocked && (
        <p role="alert" className="flex items-center gap-2 rounded-md bg-destructive p-2 text-sm text-destructive-foreground">
          <OctagonAlert className="size-4" aria-hidden="true" /> E-QM-05: instrument {i.id} is {i.state}; calibration is not current. Choose another instrument or send this one to calibration. Results already captured with it stay flagged.
        </p>
      )}
      {runs.length > 0 && (
        <p className="tabular text-xs text-muted-foreground">
          Run history: {runs.map((r) => `#${r.run} ${r.value} ${c.unit}`).join(" · ")}
        </p>
      )}
      <span className="sr-only">{CAL_FAMILY[i.state]}</span>
    </div>
  )
}

// ====================================================================================== schedule / Gantt
const DAYS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 9 + i))
  return { iso: d.toISOString().slice(0, 10), label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, weekend: [0, 6].includes(d.getUTCDay()) }
})
const FREEZE_DAYS = 3
interface Op {
  id: string
  wo: string
  op: string
  wc: string
  start: number
  len: number
  hours: number
}
const OPS0: Op[] = [
  { id: "o1", wo: "WO-TBD-0377-1", op: "10 Core cutting", wc: "WC-100", start: 0, len: 3, hours: 38 },
  { id: "o2", wo: "WO-TBD-0377-1", op: "20 Core stacking", wc: "WC-110", start: 3, len: 2, hours: 26 },
  { id: "o3", wo: "WO-TBD-0377-1", op: "30 LV winding", wc: "WC-200", start: 4, len: 4, hours: 52 },
  { id: "o4", wo: "WO-TBD-0377-1", op: "40 HV winding", wc: "WC-210", start: 4, len: 5, hours: 64 },
  { id: "o5", wo: "WO-TBD-0377-1", op: "50 Drying", wc: "WC-230", start: 9, len: 2, hours: 48 },
  { id: "o6", wo: "WO-TBD-0378-1", op: "10 Tank welding", wc: "WC-050", start: 1, len: 5, hours: 70 },
]
const MAINT: Record<string, number[]> = { "WC-600": [2, 3, 4, 5], "WC-110": [7] }
export function ScheduleGantt() {
  const [ops, setOps] = useState(OPS0)
  const [sandbox, setSandbox] = useState(true)
  const [moving, setMoving] = useState<Op | null>(null)
  const [target, setTarget] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const wcs = WORK_CENTERS.filter((w) => ["WC-050", "WC-100", "WC-110", "WC-200", "WC-210", "WC-230", "WC-600"].includes(w.id))
  const load = (wc: string, day: number) => {
    const w = WORK_CENTERS.find((x) => x.id === wc)!
    const hrs = ops.filter((o) => o.wc === wc && day >= o.start && day < o.start + o.len).reduce((s, o) => s + o.hours / o.len, 0)
    return Math.round((hrs / (w.capacityHoursPerDay * (w.efficiencyPct / 100))) * 100)
  }
  const problems = (o: Op, start: number) => {
    const p: { level: "Error" | "Warning"; text: string }[] = []
    if (start < FREEZE_DAYS) p.push({ level: "Error", text: `Day ${DAYS[start].label} is inside the freeze horizon (first ${FREEZE_DAYS} days): moves need a supervisor override.` })
    if ((MAINT[o.wc] ?? []).some((m) => m >= start && m < start + o.len)) p.push({ level: "Error", text: `${o.wc} has a maintenance window in that range.` })
    if (start + o.len > DAYS.length) p.push({ level: "Error", text: "The operation would run past the end of the horizon." })
    const peak = Math.max(...Array.from({ length: o.len }, (_, k) => { const day = start + k; const others = ops.filter((x) => x.id !== o.id && x.wc === o.wc && day >= x.start && day < x.start + x.len).reduce((s, x) => s + x.hours / x.len, 0); const w = WORK_CENTERS.find((x) => x.id === o.wc)!; return Math.round(((others + o.hours / o.len) / (w.capacityHoursPerDay * (w.efficiencyPct / 100))) * 100) }))
    if (peak > 100) p.push({ level: "Warning", text: `Load reaches ${peak}% of finite capacity on ${o.wc}.` })
    return p
  }
  const probs = moving ? problems(moving, target) : []
  return (
    <section aria-label="Finite schedule" className="flex flex-col gap-2 rounded-lg border p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Finite schedule, 12 days from Oct 9</h3>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} /> Sandbox
        </label>
        <Chip kind="design" note="Shift buckets: the specification names shifts, not their length. Load shown per day">Daily buckets (2 shifts)</Chip>
      </header>
      {sandbox ? (
        <p role="note" className="rounded-md bg-status-pending-tint p-2 text-sm text-status-pending-ink">
          Sandbox: moves here do not touch the live schedule until you publish.
        </p>
      ) : (
        <p role="note" className="rounded-md bg-muted p-2 text-sm">
          Live schedule: moves change dispatch lists now.
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `150px repeat(${DAYS.length}, minmax(52px,1fr))` }}>
          <div className="bg-table-head p-1 text-xs font-semibold">Work center</div>
          {DAYS.map((d, i) => (
            <div key={d.iso} className={cn("bg-table-head p-1 text-center text-xs", d.weekend && "text-muted-foreground")}>
              {d.label}
              {i < FREEZE_DAYS && <div className="text-[10px] text-status-pending-ink">frozen</div>}
            </div>
          ))}
          {wcs.map((w) => (
            <div key={w.id} className="contents">
              <div className="border-t p-1 text-xs">
                <span className="font-mono">{w.id}</span> {w.name}
                {w.status === "Maintenance" && <span className="ml-1 rounded border px-1">Maintenance</span>}
              </div>
              {DAYS.map((d, i) => {
                const l = load(w.id, i)
                const m = (MAINT[w.id] ?? []).includes(i)
                return (
                  <div key={d.iso} className={cn("relative border-l border-t p-1 text-center text-[11px]", i < FREEZE_DAYS && "bg-muted", m && "border-dashed bg-secondary")}>
                    {m ? <span className="font-medium">Maint.</span> : l > 0 && <span className={cn("tabular", l > 100 && "font-bold text-status-cancelled-ink")}>{l}%{l > 100 && " over"}</span>}
                    {!m && l > 0 && <div className={cn("mt-0.5 h-1 rounded", l > 100 ? "bg-status-blocked" : l > 85 ? "bg-status-pending" : "bg-status-active")} style={{ width: `${Math.min(100, l)}%` }} />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <h4 className="mt-2 text-sm font-semibold">Operations</h4>
      <ul className="flex flex-col gap-1">
        {ops.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-xs">{o.wo}</span>
            {o.op} on {o.wc}: {DAYS[o.start].label} for {o.len} d, {o.hours} h
            <Button size="sm" variant="outline" aria-label={`Move ${o.op}`} onClick={() => (setMoving(o), setTarget(o.start), setMsg(null))}>
              Move
            </Button>
          </li>
        ))}
      </ul>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <p className="text-xs text-muted-foreground">Load is hours against capacity per day at 85% default efficiency. Finite capacity treats the bar as a limit: above 100% the move is a warning, not allowed silently. Moves use the Move button, never drag only.</p>
      <DialogShell
        open={!!moving}
        onOpenChange={(o) => !o && setMoving(null)}
        title={`Move ${moving?.op ?? ""}`}
        consequence={sandbox ? "Applies in the sandbox only." : "Applies to the live schedule and re-sequences the dispatch list."}
        confirmLabel="Move"
        confirmDisabled={probs.some((p) => p.level === "Error")}
        onConfirm={() => {
          if (!moving) return null
          setOps((x) => x.map((o) => (o.id === moving.id ? { ...o, start: target } : o)))
          setMsg(`${moving.op} moved to ${DAYS[target].label}${probs.length ? ` with ${probs.length} warning` : ""}.`)
          return null
        }}
      >
        {moving && (
          <div className="grid gap-2">
            <Label htmlFor="move-day">New start day</Label>
            <select id="move-day" value={target} onChange={(e) => setTarget(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
              {DAYS.map((d, i) => (
                <option key={d.iso} value={i}>
                  {d.label}
                </option>
              ))}
            </select>
            <ul aria-label="Validation" className="text-sm">
              {probs.length === 0 && (
                <li className="flex items-center gap-1">
                  <Check className="size-4" aria-hidden="true" /> No conflicts.
                </li>
              )}
              {probs.map((p, i) => (
                <li key={i} className={cn("flex items-start gap-1", p.level === "Error" ? "text-destructive" : "text-status-pending-ink")}>
                  <Minus className="mt-1 size-3" aria-hidden="true" /> {p.level}: {p.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogShell>
    </section>
  )
}

// ====================================================================================== board / pipeline
export interface BoardCard {
  id: string
  title: string
  sub: string
  col: string
  value?: string
}
export interface BoardDef {
  id: string
  title: string
  kind?: RecordKind
  columns: string[]
  cards: BoardCard[]
  note: string
}
const wipCols = [...STATUS.productionOrder.main.filter((s) => s !== "Closed (TECO)"), "On Hold"]
export const BOARDS: BoardDef[] = [
  {
    id: "wip",
    title: "WIP board, production orders",
    kind: "productionOrder",
    columns: wipCols,
    note: "Columns are the production-order statuses (S-21).",
    cards: [
      { id: "WO-TBD-0377-1", title: "WO-TBD-0377-1", sub: "20 MVA unit 1, SO-2026-00377", col: "Released", value: "WC-100" },
      { id: "WO-TBD-0378-1", title: "WO-TBD-0378-1", sub: "Tank for unit 2", col: "In Progress", value: "WC-050" },
      { id: "WO-TBD-0360-2", title: "WO-TBD-0360-2", sub: "2,500 kVA pad-mount", col: "Testing", value: "WC-500" },
      { id: "WO-TBD-0355-1", title: "WO-TBD-0355-1", sub: "1,500 kVA pad-mount", col: "Completed", value: "WC-700" },
      { id: "WO-TBD-0371-1", title: "WO-TBD-0371-1", sub: "Waiting for bushings", col: "On Hold", value: "Recall" },
    ],
  },
  {
    id: "delivery",
    title: "Delivery status pipeline",
    kind: "delivery",
    columns: [...STATUS.delivery.statuses],
    note: "Columns are the delivery statuses (S-6).",
    cards: [
      { id: "DLV-TBD-0033", title: "DLV-TBD-0033", sub: "Prairie Ridge Electric", col: "Picking", value: "$78,400" },
      { id: "DLV-TBD-0034", title: "DLV-TBD-0034", sub: "Lakeshore Municipal", col: "Packed", value: "$122,000" },
      { id: "DLV-TBD-0035", title: "DLV-TBD-0035", sub: "Volt Co. (credit hold flag)", col: "Released", value: "$18,900" },
      { id: "DLV-TBD-0031", title: "DLV-TBD-0031", sub: "Omaha North, over-dimensional", col: "Delivered/Closed", value: "$1,284,000" },
    ],
  },
  {
    id: "leads",
    title: "Lead pipeline",
    columns: ["New", "Qualified", "Opportunity", "Quoted", "Won", "Lost"],
    note: "Leads have no status list in the PRD: the stage names are design values, so no status badge is shown.",
    cards: [
      { id: "LEAD-TBD-0377", title: "LEAD-TBD-0377", sub: "Omaha North phase 2", col: "Won", value: "$3.85M" },
      { id: "LEAD-TBD-0402", title: "LEAD-TBD-0402", sub: "Bluewater Ridge Solar", col: "Qualified", value: "$640K" },
      { id: "LEAD-TBD-0405", title: "LEAD-TBD-0405", sub: "Granite Peak Mining", col: "New", value: "$210K" },
      { id: "LEAD-TBD-0398", title: "LEAD-TBD-0398", sub: "Fraser Delta substations", col: "Quoted", value: "$1.1M" },
    ],
  },
]
export function KanbanBoard({ def }: { def: BoardDef }) {
  const [cards, setCards] = useState(def.cards)
  const [drag, setDrag] = useState<string | null>(null)
  const move = (id: string, col: string) => setCards((c) => c.map((x) => (x.id === id ? { ...x, col } : x)))
  return (
    <section aria-label={def.title} className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{def.title}</h3>
      <p className="text-xs text-muted-foreground">{def.note} Move a card with its menu or by dragging.</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {def.columns.map((col) => {
          const inCol = cards.filter((c) => c.col === col)
          return (
            <div key={col} role="group" aria-label={`${col}, ${inCol.length} cards`} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && (move(drag, col), setDrag(null))} className="flex w-52 shrink-0 flex-col gap-2 rounded-md bg-muted p-2">
              <h4 className="flex items-center justify-between text-xs font-semibold">
                {col} <span className="tabular">{inCol.length}</span>
              </h4>
              {inCol.map((c) => (
                <article key={c.id} draggable onDragStart={() => setDrag(c.id)} className="flex flex-col gap-1 rounded-md border bg-card p-2 text-sm">
                  <span className="font-mono text-xs">{c.title}</span>
                  <span>{c.sub}</span>
                  <span className="flex items-center justify-between text-xs text-muted-foreground">
                    {c.value}
                    {def.kind && <StatusBadge kind={def.kind} status={c.col} size="sm" />}
                  </span>
                  <select aria-label={`Move ${c.title}`} value={c.col} onChange={(e) => move(c.id, e.target.value)} className="h-7 rounded border bg-background px-1 text-xs">
                    {def.columns.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </article>
              ))}
              {inCol.length === 0 && <p className="text-xs text-muted-foreground">Empty</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
