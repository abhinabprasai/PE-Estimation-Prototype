// MI-MAP-001 signal mapping, DT-LOG-001 downtime log, OEE-DASH-001 OEE dashboard, FX-MI-TERMINAL terminal downtime coding
// and FX-MI-DELTAS deltas to core screens [Book IX §6]. Machines report what operators key and scan today and never remove
// the manual path: signals become the same confirmation and status events the terminal produces. Unmapped tags log and
// never post. OEE comes from posted data only; no manual OEE entry exists anywhere on these screens.

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { ConfigPage, DashboardCard, DashboardPage, DetailPage, DialogShell, KioskFact, KioskPage, WorkbenchPage } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Empty, Field, Loading, Tag, TargetFrame, useScreenState } from "../components"
import {
  GRACE_MIN, HARD_DOWN_MIN, MI_WCS, NOW, RECON_TOL_PCT, REASON_TREE, SHIFTS, dtMinutes, hardDown, isUncoded, liveValue, minsBetween, oeeOf, shiftEnded, shiftOf,
  type DowntimeRec, type Meaning, type OeeRow, type SignalRow,
} from "../data/machine"
import { nid, pct, wcStatusOf, raiseBreakdown, openBreakdown } from "../lib"

const DECISION = "Direct machine integration, OEE and downtime is a Book IX target-state module (Book IX §6; devices follow DEC-08)"
const EVIDENCE = "one pilot work center reporting a full month from signals, OEE reconciled against operator confirmations, uncoded downtime under five percent of down minutes"
const wcName = (id: string) => MI_WCS.find((w) => w.wc === id)?.name ?? id
const dtFamily = (s: DowntimeRec["state"]) => (s === "Coded" ? "done" : s === "Escalated" ? "exception" : "pending")
const reasonText = (r?: [string, string, string]) => (r ? `${r[0]} / ${r[1]} / ${r[2]}` : "Not coded")
const sigFamily = (s: SignalRow["status"]) => (s === "Active" ? "active" : s === "Draft" ? "draft" : "cancelled")
const MEANINGS: Meaning[] = ["State", "Cycle count", "Alarm code", "Measured value"]
const DEFAULT_MAP: Record<Meaning, string> = { State: "Machine state: run, idle, down, setup", "Cycle count": "Operation confirmation quantity (SP-11 event)", "Alarm code": "Downtime reason hint (operator still codes)", "Measured value": "" }

/** The reason tree as a flat choice, planned separated from unplanned. */
function ReasonPicker({ value, onChange, idp = "rp" }: { value: [string, string, string] | null; onChange: (v: [string, string, string] | null) => void; idp?: string }) {
  const [t, c, r] = value ?? ["", "", ""]
  const tree = t ? REASON_TREE[t as "Planned" | "Unplanned"] : undefined
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Planned or unplanned" id={`${idp}-t`}>
        <Select value={t} onValueChange={(v) => onChange([v, "", ""])}><SelectTrigger id={`${idp}-t`}><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent><SelectItem value="Planned">Planned</SelectItem><SelectItem value="Unplanned">Unplanned</SelectItem></SelectContent></Select>
      </Field>
      <Field label="Category" id={`${idp}-c`}>
        <Select value={c} disabled={!tree} onValueChange={(v) => onChange([t, v, ""])}><SelectTrigger id={`${idp}-c`}><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{tree && Object.keys(tree).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
      </Field>
      <Field label="Reason" id={`${idp}-r`}>
        <Select value={r} disabled={!tree || !c} onValueChange={(v) => onChange([t, c, v])}><SelectTrigger id={`${idp}-r`}><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{tree && c && tree[c]?.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
      </Field>
    </div>
  )
}

// ============================================================================ MI-MAP-001
export function SignalMapping() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("mi-map", { validation: "Validation: a tag needs a machine, a meaning, a target, an effective date, and a tolerance for a cycle count or measured value.", degraded: "The device gateway reports a delay: live values may be a few minutes old. Mapping edits still save.", readOnly: "Read-only: mapping changes are frozen while a pilot month is being reconciled." })
  const [section, setSection] = useState("map")
  const [wcF, setWcF] = useState("all")
  const [dlg, setDlg] = useState<null | { base?: SignalRow }>(null)
  const empty = { wc: "WC-200", tag: "", meaning: "State" as Meaning, mapTo: DEFAULT_MAP.State, tol: "n/a", from: "2026-10-12" }
  const [f, setF] = useState(empty)
  const [err, setErr] = useState<Record<string, string>>({})
  const [probe, setProbe] = useState<string>("")
  const [tick, setTick] = useState(0)
  const [freeTag, setFreeTag] = useState("")
  const m = s.machine
  const rows = st.rows(m.signals.filter((x) => wcF === "all" || x.wc === wcF))
  const active = m.signals.filter((x) => x.status === "Active")
  const sig = m.signals.find((x) => x.id === probe) ?? active[0]
  const openDlg = (base?: SignalRow, prefillTag?: string, wc?: string) => {
    setErr({})
    setF(base ? { wc: base.wc, tag: base.tag, meaning: base.meaning, mapTo: base.mapTo, tol: base.tolerance, from: "2026-10-12" } : { ...empty, tag: prefillTag ?? "", wc: wc ?? "WC-200" })
    setDlg({ base })
  }
  const save = () => {
    const e: Record<string, string> = {}
    if (!f.tag.trim()) e.tag = "Enter the machine tag exactly as the gateway reports it."
    if (!f.mapTo.trim()) e.mapTo = f.meaning === "Measured value" ? "Name the capture template and field (the template field is what the value fills)." : "Name the target."
    if ((f.meaning === "Cycle count" || f.meaning === "Measured value") && (!f.tol.trim() || f.tol === "n/a")) e.tol = "A count or measured value needs a tolerance such as 2%."
    if (!f.from) e.from = "Enter the effective date."
    else if (f.from < "2026-10-09") e.from = "Mapping changes are effective dated and never rewrite the past: use today or later."
    const clash = m.signals.find((x) => x.status === "Active" && x.machine === (MI_WCS.find((w) => w.wc === f.wc)?.machine) && x.tag === f.tag.trim() && x.id !== dlg?.base?.id)
    if (clash) e.tag = `${clash.id} already maps this tag on this machine. Revise that row to create a new version.`
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => {
      const mc = MI_WCS.find((w) => w.wc === f.wc)!
      d.machine.seq += 1
      const base = dlg?.base && d.machine.signals.find((x) => x.id === dlg.base!.id)
      if (base) {
        base.status = "Superseded"
        base.effectiveTo = new Date(new Date(f.from + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10)
      }
      d.machine.signals.push({ id: nid(d, "SIG"), wc: f.wc, machine: mc.machine, tag: f.tag.trim(), meaning: f.meaning, mapTo: f.mapTo.trim(), tolerance: f.tol, effectiveFrom: f.from, version: (base?.version ?? 0) + 1, status: "Draft" })
      d.machine.unmapped = d.machine.unmapped.filter((u) => u.tag !== f.tag.trim())
    })
    return r.ok ? null : r.error
  }
  const activate = (x: SignalRow) => st.run(() => {
    const r = mutate((d) => { const y = d.machine.signals.find((q) => q.id === x.id)!; y.status = "Active" })
    return r.ok ? { ok: `${x.id} is active from ${fmtDate(x.effectiveFrom)}` } : r.error
  })
  const cols: Column<SignalRow>[] = [
    { id: "id", header: "Mapping", value: (x) => x.id, mono: true, sortable: true },
    { id: "wc", header: "Work center", value: (x) => `${x.wc} ${wcName(x.wc)}`, sortable: true },
    { id: "tag", header: "Machine tag", value: (x) => x.tag, mono: true },
    { id: "meaning", header: "Meaning", value: (x) => x.meaning, filterable: true },
    { id: "map", header: "Template field or event", value: (x) => x.mapTo },
    { id: "tol", header: "Tolerance", value: (x) => x.tolerance },
    { id: "eff", header: "Effective", value: (x) => x.effectiveFrom, cell: (x) => `${fmtDate(x.effectiveFrom)}${x.effectiveTo ? ` to ${fmtDate(x.effectiveTo)}` : ""}` },
    { id: "ver", header: "Version", value: (x) => x.version, mono: true },
    { id: "status", header: "Status", value: (x) => x.status, filterable: true, cell: (x) => <Tag family={sigFamily(x.status)} label={x.status} /> },
    { id: "act", header: "", cell: (x) => (
      <span className="flex gap-2">
        {x.status === "Draft" && <Button size="sm" variant="outline" disabled={st.locked} onClick={() => activate(x)}>Activate</Button>}
        {x.status === "Active" && <Button size="sm" variant="ghost" disabled={st.locked} onClick={() => openDlg(x)}>New version</Button>}
      </span>
    ) },
  ]
  const verdict = (x: SignalRow | undefined, v: string) => {
    if (!x) return ""
    if (x.status !== "Active") return `Mapping is ${x.status}: the value is logged but nothing posts.`
    if (x.meaning === "State") return `Becomes machine state "${v}" on ${x.machine}; state history keeps the edge timestamp.`
    if (x.meaning === "Cycle count") return `Count ${v} is compared with the operator confirmations each day (tolerance ${x.tolerance}); it never confirms an operation by itself.`
    if (x.meaning === "Alarm code") return v === "none" ? "No alarm." : `Alarm ${v} is offered as a reason hint on the open downtime; the operator still codes.`
    return `Fills ${x.mapTo} with ${v} (tolerance ${x.tolerance}).`
  }
  const freeHit = freeTag.trim() ? active.find((x) => x.tag === freeTag.trim()) : undefined
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ConfigPage
        header={{ title: "Machine signal mapping", screenId: "MI-MAP-001", description: "Per work center, a machine tag maps to a system meaning: a cycle count, a state (run, idle, down, setup), an alarm code, or a measured value that fills a capture template field. Unmapped tags are logged and never post.", primary: <Button disabled={st.locked} onClick={() => openDlg()}>Add tag mapping</Button> }}
        sections={[{ id: "map", label: "Tag map" }, { id: "test", label: "Live tag test" }, { id: "unmapped", label: `Unmapped tags (${m.unmapped.length})` }]}
        section={section}
        onSectionChange={setSection}
        effectiveDated
      >
        {section === "map" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Work center</span>
              <Select value={wcF} onValueChange={setWcF}><SelectTrigger aria-label="Work center" size="sm" className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All work centers</SelectItem>{MI_WCS.map((w) => <SelectItem key={w.wc} value={w.wc}>{w.wc} {w.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <DataTableLazy rows={rows} cols={cols} loading={st.loading} />
            <RulesPanel rules={[["MI-1", "Signals become the same confirmation and status events the terminal produces; no downstream consumer knows which source spoke.", "Book IX §6"], ["MI-2", "Unmapped tags must log and never post.", "Book IX §6.1"], ["MI-3", "Mapping is effective dated: a change is a new version, the old row is superseded, history stays.", "Book IX §6.3 (C-50)"]]} />
          </div>
        )}
        {section === "test" && (
          <div className="flex max-w-3xl flex-col gap-4">
            <p className="text-sm text-muted-foreground">Read a tag live and see what the system would do with it. The test never posts.</p>
            {st.loading ? <Loading rows={2} /> : active.length === 0 ? <Empty>No active mapping to test.</Empty> : (
              <div className="grid gap-3 sm:grid-cols-[2fr_auto]">
                <Field label="Mapped tag" id="mt-tag"><Select value={sig?.id} onValueChange={(v) => setProbe(v)}><SelectTrigger id="mt-tag"><SelectValue /></SelectTrigger><SelectContent>{active.map((x) => <SelectItem key={x.id} value={x.id}>{x.wc} {x.tag}</SelectItem>)}</SelectContent></Select></Field>
                <div className="flex items-end"><Button variant="outline" disabled={st.state === "offline"} onClick={() => setTick((t) => t + 1)}>Read tag now</Button></div>
              </div>
            )}
            {sig && tick > 0 && (
              <div role="status" className="rounded-lg border p-3 text-sm">
                <p>Value read at {NOW}: <span className="font-mono font-semibold">{liveValue(sig, tick)}</span></p>
                <p className="text-muted-foreground">{verdict(sig, liveValue(sig, tick))}</p>
              </div>
            )}
            {st.state === "offline" && <p className="text-sm text-muted-foreground">The gateway is offline: reads wait. It buffers four hours and replays in order.</p>}
            <Field label="Or try a tag that is not mapped" id="mt-free" hint="Type a tag name as the gateway reports it"><Input id="mt-free" value={freeTag} onChange={(e) => setFreeTag(e.target.value)} placeholder="ns=2;s=WC200.Winder.CoolantTemp" /></Field>
            {freeTag.trim() && <p role="status" className="text-sm">{freeHit ? `Mapped by ${freeHit.id}.` : "Not mapped: the value would be logged on the unmapped list and never post."}</p>}
          </div>
        )}
        {section === "unmapped" && (
          <div className="flex flex-col gap-3">
            {m.unmapped.length === 0 ? <Empty>No unmapped tag seen. Every tag the gateway reports is mapped or explicitly ignored.</Empty> : (
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Tag</TableHead><TableHead>Machine</TableHead><TableHead>Last seen</TableHead><TableHead className="text-right">Values logged</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{m.unmapped.map((u) => <TableRow key={u.tag}><TableCell className="font-mono text-xs">{u.tag}</TableCell><TableCell>{u.machine}</TableCell><TableCell className="tabular">{u.lastSeen}</TableCell><TableCell className="tabular text-right">{u.count}</TableCell><TableCell><Button size="sm" variant="outline" disabled={st.locked} onClick={() => openDlg(undefined, u.tag, MI_WCS.find((w) => w.machine === u.machine)?.wc)}>Map this tag</Button></TableCell></TableRow>)}</TableBody></Table>
            )}
            <p className="text-xs text-muted-foreground">Logged only. Nothing here reaches a confirmation, a state or a capture template.</p>
          </div>
        )}
      </ConfigPage>
      <DialogShell open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.base ? `New version of ${dlg.base.id}` : "Add tag mapping"} description="Creates a Draft row. It takes effect on the date you set, after you activate it." confirmLabel="Save mapping" onConfirm={save} consequence={dlg?.base ? `Supersedes ${dlg.base.id} the day before the new effective date; the old version stays in history.` : "Adds a Draft mapping. Until it is Active the tag stays unmapped and never posts."} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Work center" id="sm-wc"><Select value={f.wc} onValueChange={(v) => setF({ ...f, wc: v })} disabled={!!dlg?.base}><SelectTrigger id="sm-wc"><SelectValue /></SelectTrigger><SelectContent>{MI_WCS.map((w) => <SelectItem key={w.wc} value={w.wc}>{w.wc} {w.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Machine tag" id="sm-tag" error={err.tag}><Input id="sm-tag" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} /></Field>
          <Field label="Meaning" id="sm-mean"><Select value={f.meaning} onValueChange={(v) => setF({ ...f, meaning: v as Meaning, mapTo: DEFAULT_MAP[v as Meaning], tol: v === "Cycle count" ? "2%" : "n/a" })}><SelectTrigger id="sm-mean"><SelectValue /></SelectTrigger><SelectContent>{MEANINGS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label={f.meaning === "Measured value" ? "Capture template and field" : "Target"} id="sm-map" error={err.mapTo}><Input id="sm-map" value={f.mapTo} onChange={(e) => setF({ ...f, mapTo: e.target.value })} placeholder="Capture template DRY-01, field Vacuum (mbar)" /></Field>
          <Field label="Tolerance" id="sm-tol" error={err.tol} hint="Percent, or exact"><Input id="sm-tol" value={f.tol} onChange={(e) => setF({ ...f, tol: e.target.value })} /></Field>
          <Field label="Effective from" id="sm-from" error={err.from}><Input id="sm-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        </div>
      </DialogShell>
    </>
  )
}

import { DataTable } from "@/components/patterns"
function DataTableLazy<R extends { id: string }>({ rows, cols, loading }: { rows: R[]; cols: Column<R>[]; loading: boolean }) {
  return <DataTable rows={rows} columns={cols} rowId={(r) => r.id} searchText={(r) => JSON.stringify(r)} loading={loading} densityKey="mi-map" empty={{ title: "No tag mapping yet", body: "Add the first tag for a work center." }} />
}

// ============================================================================ DT-LOG-001
export function DowntimeLog() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("dt-log", { validation: "Validation: choose the full path, planned or unplanned, category and reason, from the maintained tree.", degraded: "The gateway is slow: open downtime may lag by several minutes. Coding still saves.", readOnly: "Read-only: this period's downtime is locked for OEE reconciliation." })
  const [queue, setQueue] = useState("uncoded")
  const [shift, setShift] = useState("all")
  const [mach, setMach] = useState("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [rs, setRs] = useState<[string, string, string] | null>(null)
  const [manual, setManual] = useState(false)
  const [mf, setMf] = useState({ wc: "WC-100", start: "2026-10-09 10:00", end: "2026-10-09 10:20" })
  const [merr, setMerr] = useState<Record<string, string>>({})
  const all = s.machine.downtime
  const filt = all.filter((d) => (shift === "all" || d.shift === shift) && (mach === "all" || d.wc === mach))
  const uncoded = filt.filter(isUncoded)
  const shown = (queue === "uncoded" ? uncoded : queue === "escalated" ? filt.filter((d) => d.state === "Escalated") : queue === "coded" ? filt.filter((d) => !isUncoded(d)) : filt)
    .slice().sort((a, b) => (queue === "uncoded" ? dtMinutes(b) - dtMinutes(a) : b.start.localeCompare(a.start)))
  const downMin = all.reduce((t, d) => t + dtMinutes(d), 0)
  const uncodedMin = all.filter(isUncoded).reduce((t, d) => t + dtMinutes(d), 0)
  const share = downMin ? uncodedMin / downMin : 0
  const rec = all.find((d) => d.id === openId)
  const age = (d: DowntimeRec) => { const m = dtMinutes(d); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min` }

  const code = (d: DowntimeRec) => st.run(() => {
    if (!rs || !rs[0] || !rs[1] || !rs[2]) return "Choose planned or unplanned, a category and a reason from the tree."
    const r = mutate((x) => { const y = x.machine.downtime.find((q) => q.id === d.id)!; if (y.reason) throw new Error("conflict"); y.reason = rs; y.state = "Coded"; y.codedBy = "Supervisor" })
    if (!r.ok) return `${d.id} was coded by someone else a moment ago. Reload to see it.`
    setRs(null)
    return { ok: `${d.id} coded: ${rs[2]}` }
  })
  const escalate = (ids: string[]) => st.run(() => {
    mutate((x) => { for (const q of x.machine.downtime) if (ids.includes(q.id) && !q.reason) q.state = "Escalated" })
    return { ok: `${ids.length} record${ids.length === 1 ? "" : "s"} escalated to the supervisor` }
  })
  const raise = (d: DowntimeRec) => st.run(() => {
    let out = ""
    const r = mutate((x) => {
      const res = raiseBreakdown(x, d.wc, `Gateway down state beyond threshold (${d.wc})`, `${wcName(d.wc)}: down since ${d.start.slice(11)}`)
      if (!res) throw new Error("No equipment record governs this work center yet.")
      x.machine.downtime.find((q) => q.id === d.id)!.moId = res.id
      out = res.created ? `Breakdown order ${res.id} created` : `Linked to the open breakdown order ${res.id}`
    })
    return r.ok ? { ok: out } : r.error
  })
  const saveManual = () => {
    const e: Record<string, string> = {}
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(mf.start)) e.start = "Format YYYY-MM-DD HH:MM."
    if (mf.end && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(mf.end)) e.end = "Format YYYY-MM-DD HH:MM."
    if (!e.start && !e.end && mf.end && mf.end <= mf.start) e.end = "The end must be after the start."
    if (!e.start && mf.start > NOW) e.start = "The start cannot be in the future."
    setMerr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => { const mc = MI_WCS.find((w) => w.wc === mf.wc)!; d.machine.downtime.push({ id: nid(d, "DT"), wc: mf.wc, machine: mc.machine, start: mf.start, end: mf.end || undefined, shift: shiftOf(mf.start.slice(11)), state: "Open", source: "Manual" }) })
    return r.ok ? null : r.error
  }
  const cols: Column<DowntimeRec>[] = [
    { id: "id", header: "Downtime", value: (d) => d.id, mono: true, sortable: true },
    { id: "wc", header: "Work center", value: (d) => `${d.wc} ${wcName(d.wc)}`, sortable: true },
    { id: "start", header: "Started", value: (d) => d.start, mono: true, sortable: true },
    { id: "age", header: "Duration or age", value: (d) => dtMinutes(d), sortable: true, cell: (d) => <span className="tabular">{age(d)}{!d.end && " (still down)"} {hardDown(d) && <Chip kind="flag" note={`Down beyond ${HARD_DOWN_MIN} minutes (hard down threshold, design value)`}>Hard down</Chip>}</span> },
    { id: "shift", header: "Shift", value: (d) => d.shift, filterable: true },
    { id: "reason", header: "Reason", value: (d) => reasonText(d.reason), cell: (d) => (d.reason ? reasonText(d.reason) : <span className="text-muted-foreground">Not coded{!d.end ? "" : shiftEnded(d) ? ", shift ended" : ""}</span>) },
    { id: "state", header: "State", value: (d) => d.state, filterable: true, cell: (d) => <Tag family={dtFamily(d.state)} label={d.state} /> },
    { id: "src", header: "Source", value: (d) => d.source, filterable: true },
  ]
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{
          title: "Downtime log", screenId: "DT-LOG-001",
          description: "Open uncoded downtime first, oldest on top. The operator codes the reason at the terminal within the shift; here a supervisor can code it inline. Uncoded downtime escalates to the supervisor and never ages out silently.",
          primary: <Button disabled={st.locked} onClick={() => { setMerr({}); setManual(true) }}>Record manual downtime</Button>,
          children: (
            <div className="flex flex-wrap items-center gap-3">
              <Select value={shift} onValueChange={setShift}><SelectTrigger aria-label="Shift" size="sm" className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All shifts</SelectItem>{SHIFTS.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select>
              <Select value={mach} onValueChange={setMach}><SelectTrigger aria-label="Machine" size="sm" className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All machines</SelectItem>{MI_WCS.map((w) => <SelectItem key={w.wc} value={w.wc}>{w.wc} {w.name}</SelectItem>)}</SelectContent></Select>
            </div>
          ),
        }}
        kpis={[
          { label: "Uncoded now", value: uncoded.length, hint: uncoded[0] ? `oldest ${age(uncoded.slice().sort((a, b) => dtMinutes(b) - dtMinutes(a))[0])}` : "none open" },
          { label: "Escalated to supervisor", value: filt.filter((d) => d.state === "Escalated").length },
          { label: "Uncoded share of down minutes", value: pct(share), hint: share < 0.05 ? "Under the 5 percent evidence bar" : "Above the 5 percent evidence bar" },
          { label: "Grace before a record opens", value: `${GRACE_MIN} min`, hint: "Design value" },
        ]}
        queues={[{ id: "uncoded", label: "Uncoded", count: uncoded.length }, { id: "escalated", label: "Escalated", count: filt.filter((d) => d.state === "Escalated").length }, { id: "coded", label: "Coded", count: filt.filter((d) => !isUncoded(d)).length }, { id: "all", label: "All", count: filt.length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows: st.rows(shown), columns: cols, rowId: (d) => d.id, onRowClick: (d) => { setOpenId(d.id); setRs(d.reason ?? null) }, activeId: openId ?? undefined, searchText: (d) => `${d.id} ${d.wc} ${wcName(d.wc)} ${reasonText(d.reason)}`, loading: st.loading, densityKey: "dt-log", empty: { title: "No downtime in this queue", body: queue === "uncoded" ? "Every downtime record in this filter is coded." : "Nothing matches these filters." } }}
        bulkActions={(sel, clear) => <Button size="sm" variant="outline" disabled={st.locked} onClick={() => { escalate(sel); clear() }}>Escalate {sel.length} to supervisor</Button>}
        panel={{ open: !!rec, onOpenChange: (o) => !o && setOpenId(null), title: rec?.id ?? "", description: rec ? `${rec.wc} ${wcName(rec.wc)}, ${rec.start}` : undefined,
          content: rec && (
            <div className="flex flex-col gap-4 text-sm">
              <dl className="grid grid-cols-2 gap-3"><KV k="Machine">{rec.machine}</KV><KV k="Source">{rec.source}</KV><KV k="Duration">{age(rec)}{!rec.end && " and counting"}</KV><KV k="Shift">{SHIFTS.find((x) => x.id === rec.shift)?.label}</KV><KV k="State"><Tag family={dtFamily(rec.state)} label={rec.state} /></KV><KV k="Coded by">{rec.codedBy ?? "Nobody yet"}</KV></dl>
              {rec.moId && <p>Maintenance order <Link className="text-link underline" to={`/target/maintenance/orders/${rec.moId}`}>{rec.moId}</Link> closes the loop reason to work to restoration.</p>}
              {isUncoded(rec) ? (
                <>
                  <ReasonPicker value={rs} onChange={setRs} idp="dl" />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={st.locked} onClick={() => code(rec)}>Save reason</Button>
                    {rec.state !== "Escalated" && <Button variant="outline" disabled={st.locked} onClick={() => escalate([rec.id])}>Escalate to supervisor</Button>}
                  </div>
                </>
              ) : <p>Reason: {reasonText(rec.reason)}. Planned and unplanned stay separate in every loss report.</p>}
              {hardDown(rec) && !rec.moId && <div className="rounded-md border p-3"><p>Down for {age(rec)}, beyond the hard-down threshold of {HARD_DOWN_MIN} minutes. A breakdown order is raised once maintenance (module eight) is active.</p><div className="mt-2"><Button variant="outline" disabled={st.locked} onClick={() => raise(rec)}>Raise breakdown order</Button></div></div>}
            </div>
          ) }}
      />
      <DialogShell open={manual} onOpenChange={setManual} title="Record manual downtime" description="The manual path stays: a record keyed by hand is marked Manual and follows the same coding and escalation rules." confirmLabel="Save record" onConfirm={saveManual} consequence="Adds an uncoded downtime record. It counts in OEE availability like a gateway record.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Work center" id="md-wc"><Select value={mf.wc} onValueChange={(v) => setMf({ ...mf, wc: v })}><SelectTrigger id="md-wc"><SelectValue /></SelectTrigger><SelectContent>{MI_WCS.map((w) => <SelectItem key={w.wc} value={w.wc}>{w.wc} {w.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Start" id="md-s" error={merr.start}><Input id="md-s" value={mf.start} onChange={(e) => setMf({ ...mf, start: e.target.value })} /></Field>
          <Field label="End (blank if still down)" id="md-e" error={merr.end}><Input id="md-e" value={mf.end} onChange={(e) => setMf({ ...mf, end: e.target.value })} /></Field>
        </div>
      </DialogShell>
    </>
  )
}

// ============================================================================ OEE-DASH-001
interface Agg { wc: string; planned: number; run: number; ideal: number; count: number; good: number; machine: number; confirmed: number }
const sumRows = (rows: OeeRow[]): Agg[] =>
  MI_WCS.map((w) => {
    const r = rows.filter((x) => x.wc === w.wc)
    return { wc: w.wc, planned: r.reduce((a, x) => a + x.plannedMin, 0), run: r.reduce((a, x) => a + x.runMin, 0), ideal: r.reduce((a, x) => a + x.idealSec * x.count, 0), count: r.reduce((a, x) => a + x.count, 0), good: r.reduce((a, x) => a + x.good, 0), machine: r.reduce((a, x) => a + x.machineCount, 0), confirmed: r.reduce((a, x) => a + x.confirmed, 0) }
  }).filter((a) => a.planned > 0)
const factors = (a: Agg) => { const A = a.planned ? a.run / a.planned : 0; const P = a.run ? Math.min(1, a.ideal / (a.run * 60)) : 0; const Q = a.count ? a.good / a.count : 0; return { A, P, Q, oee: A * P * Q } }

export function OeeDashboard() {
  const s = useSlice("targetState")
  const st = useScreenState("oee", { degraded: "Yesterday's confirmations are still posting: today's quality factor may move. Showing posted data only.", readOnly: "Read-only: the OEE dashboard has no write controls; it computes from posted data only." })
  const [day, setDay] = useState("week")
  const [shift, setShift] = useState("all")
  const [drill, setDrill] = useState<string | null>(null)
  const days = [...new Set(s.machine.oee.map((x) => x.date))].sort()
  const rows = st.rows(s.machine.oee.filter((x) => (day === "week" || x.date === day) && (shift === "all" || x.shift === shift)))
  const agg = sumRows(rows)
  const total = sumRows(rows).reduce((t, a) => ({ ...t, planned: t.planned + a.planned, run: t.run + a.run, ideal: t.ideal + a.ideal, count: t.count + a.count, good: t.good + a.good }), { wc: "", planned: 0, run: 0, ideal: 0, count: 0, good: 0, machine: 0, confirmed: 0 })
  const tf = factors(total)
  const chart = agg.map((a) => { const f = factors(a); return { wc: a.wc, OEE: Math.round(f.oee * 100), Availability: Math.round(f.A * 100), Performance: Math.round(f.P * 100), Quality: Math.round(f.Q * 100) } })
  const cfg: ChartConfig = { OEE: { label: "OEE", color: "var(--chart-1)" }, Availability: { label: "Availability", color: "var(--chart-2)" }, Performance: { label: "Performance", color: "var(--chart-3)" }, Quality: { label: "Quality", color: "var(--chart-4)" } }
  // loss waterfall from the reason tree
  const dts = s.machine.downtime.filter((d) => d.end && (day === "week" || d.start.slice(0, 10) === day) && (shift === "all" || d.shift === shift))
  const bucket = new Map<string, number>()
  for (const d of dts) { const k = d.reason ? `${d.reason[0]}: ${d.reason[1]}` : "Uncoded"; bucket.set(k, (bucket.get(k) ?? 0) + dtMinutes(d)) }
  const losses = [...bucket.entries()].sort((a, b) => b[1] - a[1])
  let running = total.planned
  const water = [{ step: "Planned time", base: 0, value: total.planned }, ...losses.map(([k, v]) => { running -= v; return { step: k, base: Math.max(0, running), value: v } }), { step: "Run time", base: 0, value: total.run }]
  const wcfg: ChartConfig = { value: { label: "Minutes", color: "var(--chart-3)" } }
  const downTotal = dts.reduce((t, d) => t + dtMinutes(d), 0)
  const uncodedShare = downTotal ? (bucket.get("Uncoded") ?? 0) / downTotal : 0
  const drillRows = drill ? s.machine.oee.filter((x) => x.wc === drill && (day === "week" || x.date === day) && (shift === "all" || x.shift === shift)) : []
  const drillDt = drill ? s.machine.downtime.filter((d) => d.wc === drill && (day === "week" || d.start.slice(0, 10) === day) && (shift === "all" || d.shift === shift)) : []
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DashboardPage
        header={{
          title: "OEE dashboard", screenId: "OEE-DASH-001",
          description: "OEE per work center per shift from posted data only. Availability is run time over planned production time (capacity calendar). Performance is ideal cycle time times count over run time (routing standard). Quality is good over total (confirmations). No manual OEE entry exists.",
          children: (
            <div className="flex flex-wrap items-center gap-3">
              <Select value={day} onValueChange={setDay}><SelectTrigger aria-label="Day" size="sm" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">Last 7 days</SelectItem>{days.map((d) => <SelectItem key={d} value={d}>{fmtDate(d)}</SelectItem>)}</SelectContent></Select>
              <Select value={shift} onValueChange={setShift}><SelectTrigger aria-label="Shift" size="sm" className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All shifts</SelectItem>{SHIFTS.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select>
            </div>
          ),
        }}
        tiles={[{ label: "OEE", value: pct(tf.oee), hint: "Availability x performance x quality" }, { label: "Availability", value: pct(tf.A), hint: `${total.run} of ${total.planned} planned min` }, { label: "Performance", value: pct(tf.P) }, { label: "Quality", value: pct(tf.Q), hint: `${total.good} good of ${total.count}` }]}
      >
        <DashboardCard title="OEE and its three factors by work center">
          {st.loading ? <Loading rows={3} /> : chart.length === 0 ? <Empty>No posted data in this range.</Empty> : (
            <ChartContainer config={cfg} className="h-64 w-full">
              <BarChart data={chart}><CartesianGrid vertical={false} /><XAxis dataKey="wc" tickLine={false} axisLine={false} /><YAxis width={36} unit="%" tickLine={false} axisLine={false} domain={[0, 100]} /><ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="Availability" fill="var(--color-Availability)" isAnimationActive={false} /><Bar dataKey="Performance" fill="var(--color-Performance)" isAnimationActive={false} /><Bar dataKey="Quality" fill="var(--color-Quality)" isAnimationActive={false} /><Bar dataKey="OEE" fill="var(--color-OEE)" isAnimationActive={false} /></BarChart>
            </ChartContainer>
          )}
        </DashboardCard>
        <DashboardCard title="Loss waterfall from the reason tree (minutes)">
          {st.loading ? <Loading rows={3} /> : downTotal === 0 ? <Empty>No closed downtime in this range.</Empty> : (
            <ChartContainer config={wcfg} className="h-64 w-full">
              <BarChart data={water}><CartesianGrid vertical={false} /><XAxis dataKey="step" tickLine={false} axisLine={false} interval={0} fontSize={10} /><YAxis width={40} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} /><Bar dataKey="value" stackId="w" fill="var(--color-value)" isAnimationActive={false} /></BarChart>
            </ChartContainer>
          )}
          <p className="text-xs text-muted-foreground">Uncoded share of down minutes: {pct(uncodedShare)} {uncodedShare < 0.05 ? "(under the 5 percent evidence bar)" : "(above the 5 percent evidence bar)"}</p>
        </DashboardCard>
        <DashboardCard title="Per work center: drill to the records" className="lg:col-span-2">
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Work center</TableHead><TableHead className="text-right">Availability</TableHead><TableHead className="text-right">Performance</TableHead><TableHead className="text-right">Quality</TableHead><TableHead className="text-right">OEE</TableHead><TableHead className="text-right">Machine count vs confirmed</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{agg.map((a) => { const f = factors(a); const diff = a.confirmed ? Math.abs(a.machine - a.confirmed) / a.confirmed * 100 : 0; return (
              <TableRow key={a.wc}><TableCell>{a.wc} {wcName(a.wc)}</TableCell><TableCell className="tabular text-right">{pct(f.A)}</TableCell><TableCell className="tabular text-right">{pct(f.P)}</TableCell><TableCell className="tabular text-right">{pct(f.Q)}</TableCell><TableCell className="tabular text-right font-semibold">{pct(f.oee)}</TableCell>
                <TableCell className="tabular text-right">{a.machine} vs {a.confirmed} {diff > RECON_TOL_PCT && <Chip kind="flag" note={`Difference ${diff.toFixed(1)} percent is beyond the ${RECON_TOL_PCT} percent tolerance`}>Reconcile</Chip>}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => setDrill(a.wc)}>Drill to records</Button></TableCell></TableRow>) })}</TableBody></Table>
        </DashboardCard>
      </DashboardPage>
      <DialogShell open={!!drill} onOpenChange={(o) => !o && setDrill(null)} title={`${drill ?? ""} ${drill ? wcName(drill) : ""}: records behind the numbers`} description="Shift rows with their confirmations, then the downtime records that cost the availability." confirmLabel="Close" onConfirm={() => null} wide>
        <div className="flex max-h-[50vh] flex-col gap-4 overflow-auto text-sm">
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Date</TableHead><TableHead>Shift</TableHead><TableHead className="text-right">Run / planned</TableHead><TableHead className="text-right">Good / total</TableHead><TableHead className="text-right">OEE</TableHead><TableHead className="text-right">Machine vs confirmed</TableHead></TableRow></TableHeader>
            <TableBody>{drillRows.map((r) => <TableRow key={`${r.date}${r.shift}`}><TableCell className="tabular">{fmtDate(r.date)}</TableCell><TableCell>{r.shift}</TableCell><TableCell className="tabular text-right">{r.runMin} / {r.plannedMin}</TableCell><TableCell className="tabular text-right">{r.good} / {r.count}</TableCell><TableCell className="tabular text-right">{pct(oeeOf(r, r.plannedMin - r.runMin).oee)}</TableCell><TableCell className="tabular text-right">{r.machineCount} / {r.confirmed}</TableCell></TableRow>)}</TableBody></Table>
          {drillDt.length === 0 ? <p className="text-muted-foreground">No downtime in this range.</p> : <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Downtime</TableHead><TableHead>Started</TableHead><TableHead className="text-right">Minutes</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>{drillDt.map((d) => <TableRow key={d.id}><TableCell><Link className="font-mono text-link underline" to="/target/machine/downtime">{d.id}</Link></TableCell><TableCell className="tabular">{d.start}</TableCell><TableCell className="tabular text-right">{dtMinutes(d)}</TableCell><TableCell>{reasonText(d.reason)}</TableCell></TableRow>)}</TableBody></Table>}
        </div>
      </DialogShell>
    </>
  )
}

// ============================================================================ FX-MI-TERMINAL
export function TerminalDowntime() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("mi-terminal", { auth: "Not authorized: this badge is not assigned to the station. You can read the downtime but not code it.", degraded: "The gateway is slow. A machine that just stopped may take a minute to appear here.", readOnly: "Read-only: the shift is closed for coding." })
  const [wc, setWc] = useState("WC-200")
  const [picked, setPicked] = useState<string | null>(null)
  const [path, setPath] = useState<[string, string, string]>(["", "", ""])
  const [msg, setMsg] = useState<string | null>(null)
  const [queued, setQueued] = useState<{ id: string; r: [string, string, string] }[]>([])
  const open = st.rows(s.machine.downtime.filter((d) => d.wc === wc && isUncoded(d) && !queued.some((q) => q.id === d.id))).sort((a, b) => a.start.localeCompare(b.start))
  const cur = open.find((d) => d.id === picked) ?? open[0]
  const offline = st.state === "offline"
  const apply = (id: string, r: [string, string, string]) => mutate((x) => { const y = x.machine.downtime.find((q) => q.id === id); if (y && !y.reason) { y.reason = r; y.state = "Coded"; y.codedBy = "Operator" } })
  useEffect(() => {
    if (offline || !queued.length) return
    queued.forEach((q) => apply(q.id, q.r))
    setQueued([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline])
  const tree = path[0] ? REASON_TREE[path[0] as "Planned" | "Unplanned"] : undefined
  const save = () => {
    setMsg(null)
    if (st.state === "authorization") return setMsg(st.opts.auth ?? "Not authorized.")
    if (st.state === "read-only") return setMsg(st.opts.readOnly ?? "Read-only.")
    if (!cur) return
    if (!path[2]) return setMsg("Choose the reason before saving: planned or unplanned, then the category, then the reason.")
    if (st.state === "conflict") return setMsg(`${cur.id} was already coded by the supervisor a moment ago. Nothing was saved.`)
    const r: [string, string, string] = [path[0], path[1], path[2]]
    if (offline) { setQueued((q) => [...q, { id: cur.id, r }]); setMsg(`Saved on this terminal. ${queued.length + 1} waiting to send; they go out when the connection returns.`) } else { apply(cur.id, r); setMsg(`${cur.id} coded: ${r[2]}.`) }
    setPath(["", "", ""]); setPicked(null)
  }
  const btn = "h-14 rounded-lg border px-4 text-lg font-medium hover:bg-muted data-[on=true]:border-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"
  return (
    <KioskPage
      title="Downtime reason coding" screenId="FX-MI-TERMINAL" operator="R. Mendez (badge scanned)" station={`${wc} ${wcName(wc)}`} online={!offline} queued={queued.length}
      banners={<div className="flex flex-col gap-2"><TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />{msg && <p role="status" className="rounded-lg border px-4 py-2 text-base">{msg}</p>}</div>}
      actions={[{ label: "Save reason", onClick: save, primary: true, disabled: st.loading || !cur }, { label: "Skip for now", onClick: () => { setPicked(open.find((d) => d.id !== cur?.id)?.id ?? null); setPath(["", "", ""]) }, disabled: open.length < 2 }, { label: "Change station", onClick: () => { const i = MI_WCS.findIndex((w) => w.wc === wc); setWc(MI_WCS[(i + 1) % MI_WCS.length].wc); setPicked(null); setPath(["", "", ""]) } }]}
    >
      {st.loading ? <Loading rows={3} /> : !cur ? (
        <p className="rounded-lg border border-dashed p-8 text-xl">Nothing to code at this station. Every stop has a reason.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-8">
            <KioskFact label="Stopped at">{cur.start.slice(11)}</KioskFact>
            <KioskFact label="Down for">{dtMinutes(cur)} min{!cur.end && ", still down"}</KioskFact>
            <KioskFact label="Source">{cur.source}</KioskFact>
            <KioskFact label="Left to code">{open.length}</KioskFact>
          </div>
          <p className="text-lg">Code within the shift. If it is not coded, the supervisor is told.{!shiftEnded(cur) ? "" : " This shift has ended: it has been escalated."}</p>
          <div role="group" aria-label="Planned or unplanned" className="grid grid-cols-2 gap-4">{(["Planned", "Unplanned"] as const).map((t) => <button key={t} data-on={path[0] === t} className={btn} onClick={() => setPath([t, "", ""])}>{t}</button>)}</div>
          {tree && <div role="group" aria-label="Category" className="grid grid-cols-3 gap-4">{Object.keys(tree).map((c) => <button key={c} data-on={path[1] === c} className={btn} onClick={() => setPath([path[0], c, ""])}>{c}</button>)}</div>}
          {tree && path[1] && <div role="group" aria-label="Reason" className="grid grid-cols-3 gap-4">{tree[path[1]].map((r) => <button key={r} data-on={path[2] === r} className={btn} onClick={() => setPath([path[0], path[1], r])}>{r}</button>)}</div>}
          {open.length > 1 && <ul className="text-base text-muted-foreground">{open.filter((d) => d.id !== cur.id).slice(0, 3).map((d) => <li key={d.id}>Also waiting: {d.id} from {d.start.slice(11)}</li>)}</ul>}
        </>
      )}
    </KioskPage>
  )
}

// ============================================================================ FX-MI-DELTAS
interface TestFill { at: string; instrument: string; result: string }
export function MachineCoreDeltas() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("mi-deltas", { degraded: "The gateway is slow: machine state may lag a few minutes behind the floor.", readOnly: "Read-only: these four core-screen changes are shown for review." })
  const [tab, setTab] = useState("wc")
  const [ev, setEv] = useState({ wc: "WC-100", state: "down" })
  const [fills, setFills] = useState<TestFill[]>([])
  const [instrument, setInstrument] = useState("INS-TBD-0101")
  const [holdWc, setHoldWc] = useState("WC-230")
  const [cleared, setCleared] = useState<Record<string, string>>({})
  const m = s.machine
  const queue = (wc: string) => s.maint.prod.filter((p) => p.wc === wc)
  const stateOf = (wc: string) => m.states.find((x) => x.wc === wc)
  const simulate = () => st.run(() => {
    const cur = stateOf(ev.wc)
    if (cur?.state === ev.state) return `${ev.wc} is already ${ev.state}.`
    mutate((d) => {
      const x = d.machine.states.find((q) => q.wc === ev.wc)
      if (x) { x.state = ev.state as typeof x.state; x.since = NOW }
      if (ev.state === "down") {
        const mc = MI_WCS.find((w) => w.wc === ev.wc)!
        d.machine.downtime.push({ id: nid(d, "DT"), wc: ev.wc, machine: mc.machine, start: NOW, shift: shiftOf(NOW.slice(11)), state: "Open", source: "Gateway" })
      } else for (const q of d.machine.downtime) if (q.wc === ev.wc && !q.end) q.end = NOW
    })
    return { ok: ev.state === "down" ? `${ev.wc} is down: dispatch queue flagged, scheduler warned, downtime record opened (${GRACE_MIN} min grace is a design value)` : `${ev.wc} is ${ev.state}: open downtime closed` }
  })
  const raise = (wc: string, source: string) => st.run(() => {
    let out = ""
    const r = mutate((d) => { const res = raiseBreakdown(d, wc, source, `${wcName(wc)}: machine down`); if (!res) throw new Error("No equipment governs this work center."); out = res.created ? `Breakdown order ${res.id} created; ${wc} now shows Maintenance status` : `Breakdown order ${res.id} is already open` })
    return r.ok ? { ok: out } : r.error
  })
  const recon = useMemo(() => m.oee.filter((r) => r.confirmed && Math.abs(r.machineCount - r.confirmed) / r.confirmed * 100 > RECON_TOL_PCT).map((r) => ({ key: `${r.date}|${r.wc}|${r.shift}`, r })), [m.oee])
  const open = recon.filter((x) => !m.reconCleared.includes(x.key))
  const clear = (key: string, how: string) => st.run(() => { setCleared((c) => ({ ...c, [key]: how })); mutate((d) => { d.machine.reconCleared.push(key) }); return { ok: `Resolved: ${how}. Settlement of the order may proceed.` } })
  const loadResult = () => st.run(() => {
    if (instrument === "INS-TBD-0077") return "Interlock unchanged: instrument INS-TBD-0077 is overdue for calibration. The result file is not accepted into the capture template."
    setFills((f) => [{ at: NOW, instrument, result: "Impulse peak 142 kV; waveform within tolerance (file ImpulseBench/result.csv)" }, ...f])
    return { ok: `Capture template filled; instrument ${instrument} bound` }
  })
  const breakdowns = s.maint.orders.filter((o) => o.type === "Breakdown")
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DetailPage
        header={{ title: "Machine-integration deltas to core screens", screenId: "FX-MI-DELTAS", description: "Four changes to screens that already exist: work center status and dispatch queue, operation confirmation reconciliation, final test capture, and the terminal hold reason that raises a breakdown order. The manual path is never removed.", chips: <Chip kind="design">Deltas, not new screens</Chip> }}
        defaultTab={tab}
        tabs={[
          { id: "wc", label: "Work center and dispatch queue", content: (
            <div className="flex flex-col gap-4" onFocus={() => setTab("wc")}>
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Work center</TableHead><TableHead>Machine state</TableHead><TableHead>Work center status</TableHead><TableHead>Dispatch queue</TableHead><TableHead>Scheduler</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{MI_WCS.map((w) => { const x = stateOf(w.wc); const down = x?.state === "down"; const mins = x ? minsBetween(x.since, NOW) : 0; const bd = openBreakdown(s.maint, w.wc); return (
                  <TableRow key={w.wc}><TableCell>{w.wc} {w.name}</TableCell><TableCell>{x?.state ?? "unknown"} since {x?.since.slice(11)}</TableCell><TableCell><StatusBadge kind="workCenter" status={wcStatusOf(s.maint, w.wc)} /></TableCell>
                    <TableCell className="text-sm">{down ? <Chip kind="flag">Machine down: queue flagged</Chip> : "Clear"} {queue(w.wc).length ? `${queue(w.wc).map((p) => p.woId).join(", ")}` : "No order queued"}</TableCell>
                    <TableCell className="text-sm">{down ? `Warned: ${w.wc} down ${mins} min` : bd ? "Warned: Maintenance status" : "No warning"}</TableCell>
                    <TableCell>{down && mins >= HARD_DOWN_MIN && !bd && <Button size="sm" variant="outline" disabled={st.locked} onClick={() => raise(w.wc, `Gateway down state beyond threshold (${w.wc})`)}>Raise breakdown order</Button>}{bd && <Link className="text-sm text-link underline" to={`/target/maintenance/orders/${bd.id}`}>{bd.id}</Link>}</TableCell></TableRow>) })}</TableBody></Table>
              <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                <Field label="Simulate a gateway state event" id="sim-wc"><Select value={ev.wc} onValueChange={(v) => setEv({ ...ev, wc: v })}><SelectTrigger id="sim-wc" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{MI_WCS.map((w) => <SelectItem key={w.wc} value={w.wc}>{w.wc} {w.name}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="New state" id="sim-state"><Select value={ev.state} onValueChange={(v) => setEv({ ...ev, state: v })}><SelectTrigger id="sim-state" className="w-32"><SelectValue /></SelectTrigger><SelectContent>{["run", "idle", "down", "setup"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
                <Button disabled={st.locked} onClick={simulate}>Send state event</Button>
              </div>
              <p className="text-xs text-muted-foreground">A down state flags the dispatch queue and warns the scheduler. A hard down beyond {HARD_DOWN_MIN} minutes (design value) raises a maintenance order once the maintenance module is active. The status word comes from S-20: Active, Maintenance, Inactive.</p>
            </div>
          ) },
          { id: "conf", label: "Operation confirmations", count: open.length, content: (
            <div className="flex flex-col gap-3">
              <p className="text-sm">Machine counted quantities reconcile daily against operator confirmations. A difference beyond {RECON_TOL_PCT} percent (design value) lands here, on the production reconciliation worklist, before settlement. Neither number overwrites the other.</p>
              {open.length === 0 ? <Empty>Worklist clear: every shift reconciles within tolerance.</Empty> : (
                <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Date</TableHead><TableHead>Work center</TableHead><TableHead>Shift</TableHead><TableHead className="text-right">Machine count</TableHead><TableHead className="text-right">Confirmed</TableHead><TableHead className="text-right">Difference</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>{open.map(({ key, r }) => <TableRow key={key}><TableCell className="tabular">{fmtDate(r.date)}</TableCell><TableCell>{r.wc} {wcName(r.wc)}</TableCell><TableCell>{r.shift}</TableCell><TableCell className="tabular text-right">{r.machineCount}</TableCell><TableCell className="tabular text-right">{r.confirmed}</TableCell><TableCell className="tabular text-right">{((r.machineCount - r.confirmed) / r.confirmed * 100).toFixed(1)}%</TableCell>
                    <TableCell><span className="flex gap-2"><Button size="sm" variant="outline" disabled={st.locked} onClick={() => clear(key, "operator count kept, the difference explained as a counter fault")}>Keep operator count</Button><Button size="sm" variant="outline" disabled={st.locked} onClick={() => clear(key, "a correcting confirmation to be posted by the operator")}>Request correction</Button></span></TableCell></TableRow>)}</TableBody></Table>
              )}
              {Object.keys(cleared).length > 0 && <ul className="text-sm text-muted-foreground">{Object.entries(cleared).map(([k, v]) => <li key={k}>{k.replaceAll("|", " ")}: {v}</li>)}</ul>}
            </div>
          ) },
          { id: "test", label: "Final test capture", content: (
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="text-sm">Result files or direct reads from the test bench fill the final test capture template with the instrument identity bound. The calibration interlock is unchanged: an instrument out of calibration cannot supply a result.</p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Instrument on the bench" id="ft-i"><Select value={instrument} onValueChange={setInstrument}><SelectTrigger id="ft-i" className="w-72"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INS-TBD-0101">INS-TBD-0101 Impulse generator (In Cal)</SelectItem><SelectItem value="INS-TBD-0077">INS-TBD-0077 Divider (Overdue)</SelectItem></SelectContent></Select></Field>
                <Button disabled={st.locked} onClick={loadResult}>Read result file</Button>
              </div>
              {fills.length === 0 ? <Empty>No result read yet.</Empty> : <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Read at</TableHead><TableHead>Instrument bound</TableHead><TableHead>Template field values</TableHead></TableRow></TableHeader><TableBody>{fills.map((f, i) => <TableRow key={i}><TableCell className="tabular">{f.at}</TableCell><TableCell className="font-mono">{f.instrument}</TableCell><TableCell>{f.result}</TableCell></TableRow>)}</TableBody></Table>}
            </div>
          ) },
          { id: "hold", label: "Terminal hold reason", content: (
            <div className="flex flex-col gap-3">
              <p className="text-sm">The terminal hold reason <span className="font-semibold">machine down</span> creates a breakdown order for the work center's governing equipment, closing the loop reason to work to restoration.</p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Work center on hold" id="th-wc"><Select value={holdWc} onValueChange={setHoldWc}><SelectTrigger id="th-wc" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{["WC-100", "WC-200", "WC-210", "WC-230", "WC-500", "WC-600"].map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent></Select></Field>
                <Button disabled={st.locked} onClick={() => raise(holdWc, `Terminal hold reason: machine down (${holdWc})`)}>Hold with reason: machine down</Button>
              </div>
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Breakdown order</TableHead><TableHead>Equipment</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{breakdowns.map((o) => <TableRow key={o.id}><TableCell><Link className="font-mono text-link underline" to={`/target/maintenance/orders/${o.id}`}>{o.id}</Link></TableCell><TableCell>{o.equipmentId}</TableCell><TableCell className="text-sm">{o.source}</TableCell><TableCell><StatusBadge kind="productionOrder" status={o.status} /></TableCell></TableRow>)}</TableBody></Table>
            </div>
          ) },
        ]}
      />
    </>
  )
}
