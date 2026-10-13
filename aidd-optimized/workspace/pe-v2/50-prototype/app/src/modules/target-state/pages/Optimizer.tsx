// OPT-RUN-001 optimization runs, OPT-PROF-001 objective profiles, OPT-BENCH-001 benchmark board [Book IX §2].
// The solver replaces the seeded heuristic behind the identical constraint model: it changes solution quality, never what
// is feasible, what is frozen or who decides. Fixed seed and time box: the same inputs and profile reproduce the same schedule.

import { useEffect, useState } from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Chip, KV, RulesPanel, type Column } from "@/components/patterns"
import { ConfigPage, DashboardCard, DashboardPage, DialogShell, WorkbenchPage } from "@/components/templates"
import type { Role } from "@/data/domain"
import { fmtDate, daysBetween } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Field, Section, Tag, TargetFrame, hash, prng, r2, useScreenState } from "../components"
import { FREEZE_DAYS, HEURISTIC, TRACE_LEN, solve, weighted, type Kpi, type OptRun, type Weights } from "../data/network"
import { nid } from "../lib"

const DECISION = "The Advanced Scheduling Optimizer is a Book IX target-state module (Book IX §2; DEC-01 keeps the seeded heuristic at go-live)"
const EVIDENCE = "benchmark pack results beating the heuristic, plus one month of shadow running beside it with planner decision logs showing no guardrail breach"
const PLAN_MGR = { roles: ["Planning Manager"] as Role[], why: "approval of an objective profile belongs to the planning manager (Book IX §2.2)" }
const runFamily = (s: OptRun["status"]) => (s === "Running" ? "active" : s === "Queued" ? "draft" : s === "Completed" ? "pending" : s === "Published" ? "done" : "cancelled")
const KPI_LABEL: Record<keyof Kpi, string> = { lateness: "Weighted lateness (h)", setup: "Setup time (h)", wip: "Work in process (days)", overtime: "Overtime (h)", makespan: "Makespan (days)" }

// ============================================================================ runs
export function OptRuns() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("opt-runs", { validation: "Validation: the profile must be Released; horizon 1 to 90 days; time box 10 to 3600 seconds; the seed a whole number.", degraded: "The solver service is queueing: a run may wait before it starts. Showing the last known run states." })
  const [openId, setOpenId] = useState<string | null>(null)
  const [dlg, setDlg] = useState(false)
  const [pub, setPub] = useState(false)
  const released = s.opt.profiles.filter((p) => p.status === "Released")
  const [f, setF] = useState({ profile: released[0]?.id ?? "", horizon: "28", tb: "120", seed: "42" })
  const [err, setErr] = useState<Record<string, string>>({})
  const anyRunning = s.opt.runs.some((r) => r.status === "Running")
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(() => mutate((d) => { for (const r of d.opt.runs) if (r.status === "Running") { r.progress += 1; if (r.progress >= TRACE_LEN) r.status = "Completed" } }), 600)
    return () => clearInterval(t)
  }, [anyRunning, mutate])
  const published = s.opt.runs.find((r) => r.status === "Published")
  const base = published?.kpi ?? HEURISTIC
  const run = s.opt.runs.find((r) => r.id === openId)
  const profile = run && s.opt.profiles.find((p) => p.id === run.profileId)

  const create = () => {
    const e: Record<string, string> = {}
    const p = s.opt.profiles.find((x) => x.id === f.profile)
    if (!p) e.profile = "Choose a profile."
    else if (p.status !== "Released") e.profile = "Only a released profile can run: weight sets are under change control."
    const h = Number(f.horizon), tb = Number(f.tb), seed = Number(f.seed)
    if (!Number.isInteger(h) || h < 1 || h > 90) e.horizon = "Horizon is 1 to 90 days (design range)."
    if (!Number.isInteger(tb) || tb < 10 || tb > 3600) e.tb = "Time box is 10 to 3600 seconds (design range)."
    if (!Number.isInteger(seed)) e.seed = "The seed is a whole number; a fixed seed makes the run reproducible."
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const out = mutate((d) => {
      const prof = d.opt.profiles.find((x) => x.id === f.profile)!
      const res = solve(prof, h, tb, seed)
      d.opt.runs.unshift({ id: nid(d, "OPT-RUN"), profileId: prof.id, horizonDays: h, timeBoxSec: tb, seed, status: "Running", progress: 0, trace: res.trace, bound: res.bound, createdOn: "2026-10-09", by: "Production Scheduler", kpi: res.kpi, impacts: res.impacts, overrides: res.overrides, atRisk: [] })
    })
    return out.ok ? null : out.error
  }
  const degraded = (r: OptRun) => r.impacts.filter((i) => i.after > i.before)
  const publish = () => {
    if (!run) return "No run open."
    const g = st.guard()
    if (g) return g
    const w = profile ? weighted(run.kpi, profile.weights) : 100
    if (w >= 100) return `This run scores ${w} against the heuristic's 100 on the weighted objective: a result that does not beat the heuristic must not publish.`
    const missing = degraded(run).filter((i) => !run.atRisk.includes(i.order))
    if (missing.length) return `Published promises may not degrade without an at-risk record. Record one for: ${missing.map((m) => m.order).join(", ")}.`
    const out = mutate((d) => {
      for (const x of d.opt.runs) if (x.status === "Published") x.status = "Superseded"
      const x = d.opt.runs.find((q) => q.id === run.id)!
      x.status = "Published"; x.publishedOn = "2026-10-09"
    })
    return out.ok ? null : out.error
  }
  const cols: Column<OptRun>[] = [
    { id: "id", header: "Run", value: (r) => r.id, mono: true, sortable: true },
    { id: "p", header: "Profile", value: (r) => s.opt.profiles.find((p) => p.id === r.profileId)?.name ?? r.profileId, filterable: true },
    { id: "h", header: "Horizon", value: (r) => r.horizonDays, cell: (r) => `${r.horizonDays} d`, align: "right" },
    { id: "tb", header: "Time box", value: (r) => r.timeBoxSec, cell: (r) => `${r.timeBoxSec} s`, align: "right" },
    { id: "seed", header: "Seed", value: (r) => r.seed, mono: true },
    { id: "st", header: "State", value: (r) => r.status, filterable: true, cell: (r) => <Tag family={runFamily(r.status)} label={r.status === "Running" ? `Running ${r.progress}/${TRACE_LEN}` : r.status} /> },
    { id: "obj", header: "Incumbent objective", align: "right", value: (r) => r.trace[Math.max(0, r.progress - 1)] ?? "", cell: (r) => (r.progress ? `${r.trace[r.progress - 1]} (bound ${r.bound})` : "Not started") },
    { id: "on", header: "Created", value: (r) => r.createdOn, sortable: true },
  ]
  const cfg: ChartConfig = { objective: { label: "Incumbent objective", color: "var(--chart-3)" } }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{ title: "Optimization runs", screenId: "OPT-RUN-001", description: "Choose a profile, horizon and time box. The run shows its incumbent objective as it improves, compares with the current published schedule, and publishes through the standard diff ceremony. Freeze horizons are absolute.", primary: <Button disabled={st.locked} onClick={() => { setErr({}); setDlg(true) }}>New run</Button> }}
        kpis={[{ label: "Runs", value: s.opt.runs.length }, { label: "Running", value: s.opt.runs.filter((r) => r.status === "Running").length }, { label: "Published schedule", value: published?.id.slice(-4) ?? "Heuristic", hint: published ? `since ${fmtDate(published.publishedOn)}` : "Seeded heuristic" }, { label: "Freeze horizon", value: `${FREEZE_DAYS} d`, hint: "Design value" }]}
        table={{ rows: st.rows(s.opt.runs), columns: cols, rowId: (r) => r.id, onRowClick: (r) => setOpenId(r.id), activeId: openId ?? undefined, searchText: (r) => `${r.id} ${r.profileId}`, loading: st.loading, empty: { title: "No optimization run yet", body: "Start a run with a released profile." } }}
        panel={{
          open: !!run, onOpenChange: (o) => !o && setOpenId(null), title: run?.id ?? "", description: run && profile ? `${profile.name} v${profile.version}, seed ${run.seed}, ${run.timeBoxSec} s time box` : undefined,
          content: run && profile && (
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex items-center gap-2"><Tag family={runFamily(run.status)} label={run.status} />{run.status === "Running" && <Progress value={(run.progress / TRACE_LEN) * 100} className="w-40" />}</div>
              <Section title="Incumbent objective (lower is better, heuristic = 100)">
                <ChartContainer config={cfg} className="h-40 w-full">
                  <LineChart data={run.trace.slice(0, Math.max(1, run.progress)).map((v, i) => ({ i: i + 1, objective: v }))}>
                    <CartesianGrid vertical={false} /><XAxis dataKey="i" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} width={36} tickLine={false} axisLine={false} />
                    <ReferenceLine y={run.bound} strokeDasharray="4 4" stroke="var(--chart-5)" label={{ value: `bound ${run.bound}`, fontSize: 11, position: "insideBottomRight" }} />
                    <ChartTooltip content={<ChartTooltipContent />} /><Line isAnimationActive={false} dataKey="objective" stroke="var(--color-objective)" strokeWidth={2} dot />
                  </LineChart>
                </ChartContainer>
                <p className="text-xs text-muted-foreground">Best found solution is returned with its bound. The same inputs and profile reproduce the same schedule.</p>
              </Section>
              {run.progress >= TRACE_LEN && (
                <>
                  <Section title={`KPIs against the ${published && published.id !== run.id ? `published run ${published.id}` : "published schedule"}`}>
                    <Table><TableHeader className="bg-table-head"><TableRow><TableHead>KPI</TableHead><TableHead className="text-right">Published</TableHead><TableHead className="text-right">This run</TableHead><TableHead className="text-right">Delta</TableHead></TableRow></TableHeader>
                      <TableBody>{(Object.keys(KPI_LABEL) as (keyof Kpi)[]).map((k) => { const d = r2(run.kpi[k] - base[k]); return <TableRow key={k}><TableCell>{KPI_LABEL[k]}</TableCell><TableCell className="tabular text-right">{base[k]}</TableCell><TableCell className="tabular text-right">{run.kpi[k]}</TableCell><TableCell className="tabular text-right">{d > 0 ? "+" : ""}{d}</TableCell></TableRow> })}</TableBody></Table>
                  </Section>
                  <Section title="Per order promise impact">
                    <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Order</TableHead><TableHead>Promised</TableHead><TableHead>Now</TableHead><TableHead>Solver</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                      <TableBody>{run.impacts.map((i) => { const d = daysBetween(i.before, i.after); return (
                        <TableRow key={i.order}><TableCell className="whitespace-normal">{i.order}<div className="font-mono text-xs">{i.wo}</div></TableCell><TableCell>{fmtDate(i.promised)}</TableCell><TableCell>{fmtDate(i.before)}</TableCell><TableCell>{fmtDate(i.after)} ({d > 0 ? "+" : ""}{d} d)</TableCell>
                          <TableCell className="whitespace-normal">{i.frozen ? <Chip kind="hold" note="Inside the freeze horizon: absolute">Frozen, unchanged</Chip> : d > 0 ? (run.atRisk.includes(i.order) ? <Tag family="exception" label="At-risk record raised" /> : run.status === "Completed" ? <Button size="sm" variant="outline" disabled={st.locked} onClick={() => st.run(() => { mutate((x) => { x.opt.runs.find((q) => q.id === run.id)!.atRisk.push(i.order) }); return { ok: `At-risk record raised for ${i.order}` } })}>Raise at-risk record</Button> : <Chip kind="flag">Promise degrades</Chip>) : d < 0 ? "Earlier" : "Unchanged"}</TableCell></TableRow>) })}</TableBody></Table>
                  </Section>
                  <Section title="Run log: moves that override a planner preference">
                    <ul className="list-disc space-y-1 pl-5">{run.overrides.map((o, i) => <li key={i}>{o.move}. Objective contribution {o.contribution}.</li>)}</ul>
                  </Section>
                  {run.status === "Completed" && <Button disabled={st.locked} onClick={() => setPub(true)}>Review diff and publish</Button>}
                </>
              )}
            </div>
          ),
        }}
      />
      <DialogShell open={dlg} onOpenChange={setDlg} title="New optimization run" confirmLabel="Start run" onConfirm={create} consequence="Starts a run with a fixed seed and time box. Nothing is published: the result is compared with the published schedule first." wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Objective profile" id="or-p" error={err.profile}><Select value={f.profile} onValueChange={(v) => setF({ ...f, profile: v })}><SelectTrigger id="or-p"><SelectValue placeholder="Choose a profile" /></SelectTrigger><SelectContent>{s.opt.profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} v{p.version} ({p.status})</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Horizon (days)" id="or-h" error={err.horizon}><Input id="or-h" inputMode="numeric" value={f.horizon} onChange={(e) => setF({ ...f, horizon: e.target.value })} /></Field>
          <Field label="Time box (seconds)" id="or-t" error={err.tb}><Input id="or-t" inputMode="numeric" value={f.tb} onChange={(e) => setF({ ...f, tb: e.target.value })} /></Field>
          <Field label="Seed" id="or-s" error={err.seed}><Input id="or-s" inputMode="numeric" value={f.seed} onChange={(e) => setF({ ...f, seed: e.target.value })} /></Field>
        </div>
      </DialogShell>
      {run && <DialogShell open={pub} onOpenChange={setPub} title={`Publish ${run.id}`} confirmLabel="Publish schedule" onConfirm={publish} requireReason={false} consequence={`Replaces the published schedule: ${run.impacts.filter((i) => !i.frozen && i.after !== i.before).length} order dates move, ${run.impacts.filter((i) => i.frozen).length} frozen orders do not. Published promises that degrade need an at-risk record first.`}>
        <p className="text-sm">The standard diff ceremony: the changes above are the whole diff. The decision stays with the planner.</p>
      </DialogShell>}
      <RulesPanel rules={[["OPT-1", "Freeze horizons are absolute.", "Book IX §2.1"], ["OPT-2", "Published promises may not degrade without an at-risk record.", "Book IX §2.1"], ["OPT-3", "Every solver move that overrides a planner preference lists in the run log with its objective contribution.", "Book IX §2.1"], ["OPT-4", "Fixed seed, fixed time box, best found solution returned with its bound.", "Book IX §2.1"]]} />
    </>
  )
}

// ============================================================================ profiles
export function OptProfiles() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("opt-profiles", { auth: "Not authorized: approval of an objective profile belongs to the planning manager." })
  const [sel, setSel] = useState(s.opt.profiles[0].id)
  const p = s.opt.profiles.find((x) => x.id === sel) ?? s.opt.profiles[0]
  const [w, setW] = useState<Record<keyof Weights, string>>({ lateness: String(p.weights.lateness), setup: String(p.weights.setup), wip: String(p.weights.wip), overtime: String(p.weights.overtime) })
  const [horizon, setHorizon] = useState(String(p.horizonDays))
  const [eff, setEff] = useState(p.effectiveFrom)
  const [rel, setRel] = useState(false)
  const pick = (id: string) => { const q = s.opt.profiles.find((x) => x.id === id)!; setSel(id); setW({ lateness: String(q.weights.lateness), setup: String(q.weights.setup), wip: String(q.weights.wip), overtime: String(q.weights.overtime) }); setHorizon(String(q.horizonDays)); setEff(q.effectiveFrom) }
  const sum = Object.values(w).reduce((a, b) => a + (Number(b) || 0), 0)
  const valid = Object.values(w).every((x) => Number.isInteger(Number(x)) && Number(x) >= 0) && sum === 100
  const editable = p.status === "Draft"
  const save = () => st.run(() => {
    if (!valid) return `Weights are whole numbers that sum to 100 (now ${sum}).`
    const h = Number(horizon)
    if (!Number.isInteger(h) || h < 1 || h > 90) return "Horizon is 1 to 90 days (design range)."
    const weights = { lateness: Number(w.lateness), setup: Number(w.setup), wip: Number(w.wip), overtime: Number(w.overtime) }
    const r = mutate((d) => {
      if (p.status === "Draft") {
        const x = d.opt.profiles.find((q) => q.id === p.id)!
        x.weights = weights; x.horizonDays = h; x.effectiveFrom = eff
        x.history.unshift({ at: "2026-10-09", by: "Planner", text: "Draft edited" })
      } else {
        d.opt.profiles.push({ id: nid(d, "OPT-PRF"), name: p.name, weights, horizonDays: h, version: p.version + 1, effectiveFrom: eff, status: "Draft", history: [{ at: "2026-10-09", by: "Planner", text: `New version drafted from v${p.version}; v${p.version} stays in force until this one is released` }] })
      }
    })
    return r.ok ? { ok: p.status === "Draft" ? "Draft saved" : `Version ${p.version + 1} drafted; version ${p.version} stays in force` } : r.error
  })
  const release = (reason: string) => {
    const g = st.guard(PLAN_MGR)
    if (g) return g
    if (eff <= "2026-10-09") return "A released profile is effective-dated: the effective date must be after today."
    const r = mutate((d) => {
      const x = d.opt.profiles.find((q) => q.id === p.id)!
      x.status = "Released"; x.approvedBy = "Planning Manager"
      x.history.unshift({ at: "2026-10-09", by: "Planning Manager", text: `Released, effective ${eff}. ${reason}` })
      for (const o of d.opt.profiles) if (o.id !== x.id && o.name === x.name && o.status === "Released" && o.version < x.version) { o.status = "Retired"; o.history.unshift({ at: "2026-10-09", by: "System", text: `Superseded by v${x.version}` }) }
    })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ConfigPage
        effectiveDated
        header={{ title: "Objective profiles", screenId: "OPT-PROF-001", description: "Named weight sets under change control: weighted lateness against promises first by default, then setup time, work in process and overtime. Approval by the planning manager.", chips: <Chip kind="oq" id="OQ-TS04" note="The PRD names the order of the four terms for the default; it gives no weight values. The seeded numbers are design values" /> }}
        sections={s.opt.profiles.map((x) => ({ id: x.id, label: `${x.name} v${x.version}` }))}
        section={p.id}
        onSectionChange={pick}
      >
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="flex items-center gap-2 text-sm"><Tag family={p.status === "Released" ? "done" : p.status === "Draft" ? "draft" : "cancelled"} label={p.status} /> {p.approvedBy ? `Approved by ${p.approvedBy}` : "Not approved"}; effective from {fmtDate(p.effectiveFrom)}.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["lateness", "setup", "wip", "overtime"] as const).map((k) => <Field key={k} label={`${KPI_LABEL[k].replace(/ \(.*\)/, "")} weight`} id={`w-${k}`}><Input id={`w-${k}`} inputMode="numeric" value={w[k]} disabled={st.locked} onChange={(e) => setW({ ...w, [k]: e.target.value })} /></Field>)}
            <Field label="Horizon (days)" id="w-h"><Input id="w-h" inputMode="numeric" value={horizon} disabled={st.locked} onChange={(e) => setHorizon(e.target.value)} /></Field>
            <Field label="Effective from" id="w-e"><Input id="w-e" type="date" value={eff} disabled={st.locked} onChange={(e) => setEff(e.target.value)} /></Field>
          </div>
          <p className={sum === 100 ? "text-sm text-muted-foreground" : "text-sm text-destructive"} role={sum === 100 ? undefined : "alert"}>Weights sum to {sum}. They must sum to 100.</p>
          <div className="flex gap-2"><Button variant="outline" disabled={st.locked} onClick={save}>{editable ? "Save draft" : "Draft a new version"}</Button>{editable && <Button disabled={st.locked} onClick={() => setRel(true)}>Release for approval</Button>}</div>
          <Section title="History"><ul className="space-y-1 text-sm">{p.history.map((h, i) => <li key={i}><span className="tabular">{fmtDate(h.at)}</span> {h.by}: {h.text}</li>)}</ul></Section>
        </div>
      </ConfigPage>
      <DialogShell open={rel} onOpenChange={setRel} title={`Release ${p.name} v${p.version}`} requireReason reasonLabel="Reason for release (required)" confirmLabel="Release" onConfirm={release} consequence="The planning manager approves this weight set. A released profile is never edited in place; a later change drafts a new version." />
    </>
  )
}

// ============================================================================ benchmark
export function OptBench() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("opt-bench", { degraded: "The benchmark worker is behind: the newest version score may be missing. Showing the last complete scoring." })
  const [kpi, setKpi] = useState<"weighted" | "lateness" | "setup" | "makespan">("weighted")
  const v = s.opt.versions
  const verdict = (x: (typeof v)[number]) => x.weighted < 100
  const best = [...v].sort((a, b) => a.weighted - b.weighted)[0]
  const trend = v.map((x) => ({ v: x.id.replace("SOLV-", ""), value: x[kpi] }))
  const base = kpi === "weighted" ? 100 : kpi === "lateness" ? HEURISTIC.lateness : kpi === "setup" ? HEURISTIC.setup : HEURISTIC.makespan
  const score = () => st.run(() => {
    const r = mutate((d) => {
      const n = d.opt.versions.length + 6
      const id = `SOLV-0.${n}.0`
      const rnd = prng(hash(id))
      const k: Kpi = { lateness: r2(HEURISTIC.lateness * (0.6 + 0.55 * rnd())), setup: r2(HEURISTIC.setup * (0.75 + 0.4 * rnd())), wip: r2(HEURISTIC.wip * (0.8 + 0.3 * rnd())), overtime: r2(HEURISTIC.overtime * (0.8 + 0.3 * rnd())), makespan: r2(HEURISTIC.makespan * (0.85 + 0.2 * rnd())) }
      d.opt.versions.push({ id, date: "2026-10-09", lateness: k.lateness, setup: k.setup, makespan: k.makespan, weighted: weighted(k, d.opt.profiles[0].weights) })
    })
    return r.ok ? { ok: "New version scored over the benchmark set" } : r.error
  })
  const cfg: ChartConfig = { value: { label: kpi, color: "var(--chart-3)" } }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DashboardPage
        header={{ title: "Optimizer benchmark board", screenId: "OPT-BENCH-001", description: "Every solver version is scored against the heuristic over a maintained dataset of real order books: lateness, setup hours and makespan. A version that does not beat the heuristic on the weighted objective must not publish.", primary: <Button disabled={st.locked} onClick={score}>Score a new version</Button> }}
        tiles={[{ label: "Heuristic baseline", value: 100, hint: "Weighted objective, lower is better" }, { label: "Best version", value: best.id.replace("SOLV-", ""), hint: `weighted ${best.weighted}` }, { label: "Versions that may publish", value: `${v.filter(verdict).length} of ${v.length}` }, { label: "Shadow run", value: `${s.opt.shadow.days} of ${s.opt.shadow.of} days`, hint: `${s.opt.shadow.breaches} guardrail breaches`, tone: s.opt.shadow.breaches ? "attention" : "default" }]}
      >
        <DashboardCard title="Trend per KPI" action={<Select value={kpi} onValueChange={(x) => setKpi(x as typeof kpi)}><SelectTrigger aria-label="KPI" size="sm" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weighted">Weighted objective</SelectItem><SelectItem value="lateness">Weighted lateness (h)</SelectItem><SelectItem value="setup">Setup time (h)</SelectItem><SelectItem value="makespan">Makespan (days)</SelectItem></SelectContent></Select>}>
          {st.empty ? <p className="text-sm text-muted-foreground">No version scored yet.</p> : (
            <ChartContainer config={cfg} className="h-56 w-full">
              <LineChart data={trend}>
                <CartesianGrid vertical={false} /><XAxis dataKey="v" tickLine={false} axisLine={false} /><YAxis width={40} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <ReferenceLine y={base} strokeDasharray="4 4" stroke="var(--chart-5)" label={{ value: "heuristic", fontSize: 11, position: "insideTopRight" }} />
                <ChartTooltip content={<ChartTooltipContent />} /><Line isAnimationActive={false} dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          )}
        </DashboardCard>
        <DashboardCard title="Gate verdict per version">
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Version</TableHead><TableHead className="text-right">Lateness</TableHead><TableHead className="text-right">Setup</TableHead><TableHead className="text-right">Makespan</TableHead><TableHead className="text-right">Weighted</TableHead><TableHead>Verdict</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow className="text-muted-foreground"><TableCell>Heuristic</TableCell><TableCell className="tabular text-right">{HEURISTIC.lateness}</TableCell><TableCell className="tabular text-right">{HEURISTIC.setup}</TableCell><TableCell className="tabular text-right">{HEURISTIC.makespan}</TableCell><TableCell className="tabular text-right">100</TableCell><TableCell>Baseline</TableCell></TableRow>
              {st.rows(v).map((x) => <TableRow key={x.id}><TableCell className="font-mono">{x.id}</TableCell><TableCell className="tabular text-right">{x.lateness}</TableCell><TableCell className="tabular text-right">{x.setup}</TableCell><TableCell className="tabular text-right">{x.makespan}</TableCell><TableCell className="tabular text-right">{x.weighted}</TableCell><TableCell>{verdict(x) ? <Tag family="done" label="Beats the heuristic" /> : <Tag family="exception" label="Must not publish" />}</TableCell></TableRow>)}
            </TableBody></Table>
        </DashboardCard>
        <DashboardCard title="Shadow running beside the heuristic">
          <dl className="grid grid-cols-3 gap-3"><KV k="Days run">{s.opt.shadow.days} of {s.opt.shadow.of}</KV><KV k="Planner decision logs">{s.opt.shadow.days}</KV><KV k="Guardrail breaches">{s.opt.shadow.breaches}</KV></dl>
          <Progress value={(s.opt.shadow.days / s.opt.shadow.of) * 100} />
          <p className="text-xs text-muted-foreground">Activation needs one month of shadow running with decision logs showing no guardrail breach.</p>
        </DashboardCard>
        <DashboardCard title="Benchmark set">
          <p className="text-sm">12 anonymised order books from real planning cycles. <Chip kind="design">Design value</Chip></p>
          <p className="text-xs text-muted-foreground">Scores use the default profile's weights. The set is maintained: a version is always scored over the same books.</p>
        </DashboardCard>
      </DashboardPage>
    </>
  )
}
