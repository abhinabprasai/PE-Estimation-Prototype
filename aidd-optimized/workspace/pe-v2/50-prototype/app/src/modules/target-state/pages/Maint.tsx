// EQ-001 equipment register, MPLAN-001 maintenance plans, MO-001 maintenance orders, MAINT-BOARD-001 backlog board and
// FX-EAM-DASH maintenance dashboard (MTBF, MTTR) [Book IX §8]. Machines, ovens, cranes, test benches and tools become maintained
// assets whose care is planned and whose windows the finite schedule respects. Settlement goes to the owning cost center,
// never to product WIP. Calibration stays in the quality register and links here, so one asset view shows both.

import { useState } from "react"
import { Link, useParams } from "react-router"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Chip, EmptyState, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { ConfigPage, DashboardCard, DashboardPage, DetailPage, DialogShell, ListPage, WorkbenchPage } from "@/components/templates"
import { WORK_CENTERS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Field, Tag, TargetFrame, useScreenState } from "../components"
import { MAINT_LABOR_RATE, MO_TYPES, OP_HOURS_PER_DAY, PERIOD_DAYS, TODAY_M, costCenterOf, governedWc, moCost, nextDue, reliability, stdCostOf, wcOf, type Equipment, type MPlan, type Mo, type MoType } from "../data/maint"
import { MO_OPEN, conflictOf, eqTree, generatePreventive, issuePart, logLabor, moAdvance, newMo, planOverdue, syncBlock } from "../maintOps"
import { matDesc, money, wcStatusOf } from "../lib"

const DECISION = "Plant maintenance and EAM is a Book IX target-state module (Book IX §8)"
const EVIDENCE = "one quarter of preventive execution with schedule integration proven, breakdown flow from andon to restoration timed, spares consumption through standard movements only"
const critFamily = (c: Equipment["criticality"]) => (c === "A" ? "exception" : c === "B" ? "pending" : "draft")
const CRIT_NOTE = "Criticality classes A, B and C are design values"
const SPARES = ["SPARE-TBD-BSH145", "SPARE-TBD-GSKT20", "SPARE-TBD-OLTCK"]
const addD = (iso: string, d: number) => new Date(new Date(iso + "T12:00:00Z").getTime() + d * 86400000).toISOString().slice(0, 10)
const MO_NOTE = "Maintenance order status words follow the production order path (Book IX §8.1); the catalog has no separate list"

// ============================================================================ equipment list
export function EquipmentList() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("eq-list", { validation: "Validation: location, then machine, then component. A machine sits under a location; a component under a machine or component; a tool under a location. A work center links to one machine only." })
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: "", type: "Machine" as Equipment["type"], parentId: "", criticality: "B" as Equipment["criticality"], wc: "none" })
  const [err, setErr] = useState<Record<string, string>>({})
  const m = s.maint
  const tree = eqTree(m.equipment)
  const parents = m.equipment.filter((e) => (f.type === "Machine" || f.type === "Tool" ? e.type === "Location" : f.type === "Location" ? e.type === "Location" : e.type === "Machine" || e.type === "Component"))
  const cols: Column<(typeof tree)[number]>[] = [
    { id: "name", header: "Equipment", value: (r) => `${r.e.id} ${r.e.name}`, cell: (r) => <span style={{ paddingLeft: `${r.depth * 20}px` }} className="flex items-center gap-2">{r.e.type === "Location" ? <span>{r.e.name}</span> : <Link className="text-link underline" to={`/target/maintenance/equipment/${r.e.id}`}>{r.e.name}</Link>}<span className="font-mono text-xs text-muted-foreground">{r.e.id}</span></span> },
    { id: "type", header: "Level", value: (r) => r.e.type, filterable: true },
    { id: "crit", header: "Criticality", value: (r) => r.e.criticality, filterable: true, cell: (r) => <Tag family={critFamily(r.e.criticality)} label={`Class ${r.e.criticality}`} /> },
    { id: "wc", header: "Work center", value: (r) => governedWc(r.e, m.equipment) ?? "", cell: (r) => (r.e.workCenterId ? <span>{r.e.workCenterId} <StatusBadge kind="workCenter" status={wcStatusOf(m, r.e.workCenterId)} /></span> : "") },
    { id: "counters", header: "Counters", value: (r) => r.e.hours, mono: true, cell: (r) => (r.e.type === "Location" ? "" : `${r.e.hours} h${r.e.cycles ? `, ${r.e.cycles} cycles` : ""}`) },
    { id: "open", header: "Open orders", value: (r) => m.orders.filter((o) => o.equipmentId === r.e.id && MO_OPEN.includes(o.status)).length, mono: true },
  ]
  const save = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = "Name the equipment."
    if (f.type !== "Location" && !f.parentId) e.parentId = "Choose the parent in the hierarchy."
    if (f.wc !== "none") {
      if (f.type !== "Machine") e.wc = "Only a machine links to a work center."
      else if (m.equipment.some((x) => x.workCenterId === f.wc)) e.wc = `${f.wc} is already governed by ${m.equipment.find((x) => x.workCenterId === f.wc)!.id}.`
    }
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => { d.maint.seq += 1; d.maint.equipment.push({ id: `EQ-TBD-${String(d.maint.seq + 100).padStart(4, "0")}`, name: f.name.trim(), type: f.type, parentId: f.parentId || undefined, criticality: f.criticality, workCenterId: f.wc === "none" ? undefined : f.wc, hours: 0, cycles: 0, dailyHours: 8, spares: [], failures: [], docs: [] }) })
    if (!r.ok) return r.error
    setF({ ...f, name: "" })
    return null
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ListPage
        header={{ title: "Equipment register", screenId: "EQ-001", description: "Hierarchy from location to machine to component, linked to a work center or tool, with criticality class, counters, documents and a spare parts list.", chips: <Chip kind="design" note={CRIT_NOTE}>Criticality A/B/C</Chip>, primary: <Button disabled={st.locked} onClick={() => { setErr({}); setOpen(true) }}>New equipment</Button> }}
        table={{ rows: st.rows(tree), columns: cols, rowId: (r) => r.e.id, searchText: (r) => `${r.e.id} ${r.e.name}`, loading: st.loading, densityKey: "eq", empty: { title: "No equipment yet", body: "Start with the plant location, then machines." } }}
        below={<RulesPanel rules={[["EAM-1", "A work center whose governing equipment holds an open breakdown order shows Maintenance status automatically (S-20).", "Book IX §8.2"], ["EAM-2", "Calibration stays in the quality register and links to the equipment so one asset view shows both.", "Book IX §8.2"]]} />}
      />
      <DialogShell open={open} onOpenChange={setOpen} title="New equipment" confirmLabel="Create equipment" onConfirm={save} wide consequence="Adds the asset under its parent. Counters start at zero and are fed by confirmations or signals.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" id="ne-n" error={err.name}><Input id="ne-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Level" id="ne-t"><Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as Equipment["type"], parentId: "" })}><SelectTrigger id="ne-t"><SelectValue /></SelectTrigger><SelectContent>{["Location", "Machine", "Component", "Tool"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Parent" id="ne-p" error={err.parentId}><Select value={f.parentId} onValueChange={(v) => setF({ ...f, parentId: v })}><SelectTrigger id="ne-p"><SelectValue placeholder={f.type === "Location" ? "Top level or choose" : "Choose"} /></SelectTrigger><SelectContent>{parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Criticality" id="ne-c" hint={CRIT_NOTE}><Select value={f.criticality} onValueChange={(v) => setF({ ...f, criticality: v as Equipment["criticality"] })}><SelectTrigger id="ne-c"><SelectValue /></SelectTrigger><SelectContent>{["A", "B", "C"].map((x) => <SelectItem key={x} value={x}>Class {x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Linked work center" id="ne-w" error={err.wc}><Select value={f.wc} onValueChange={(v) => setF({ ...f, wc: v })}><SelectTrigger id="ne-w"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{WORK_CENTERS.map((w) => <SelectItem key={w.id} value={w.id}>{w.id} {w.name}</SelectItem>)}</SelectContent></Select></Field>
        </div>
      </DialogShell>
    </>
  )
}

// ============================================================================ equipment detail
export function EquipmentDetail() {
  const { id } = useParams()
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("eq-detail", { validation: "Validation: a corrective order needs a description and a window that ends on or after it starts." })
  const [dlg, setDlg] = useState(false)
  const [cf, setCf] = useState({ desc: "", from: TODAY_M, to: TODAY_M })
  const [err, setErr] = useState<Record<string, string>>({})
  const m = s.maint
  const e = m.equipment.find((x) => x.id === id)
  if (!e) return <EmptyState title="Equipment not found">No equipment has id {id}. <Link className="text-link underline" to="/target/maintenance/equipment">Back to the register</Link></EmptyState>
  const children = m.equipment.filter((x) => x.parentId === e.id)
  const chain: Equipment[] = []
  for (let cur: Equipment | undefined = m.equipment.find((x) => x.id === e.parentId); cur; cur = m.equipment.find((x) => x.id === cur!.parentId)) chain.unshift(cur)
  const plans = m.plans.filter((p) => p.equipmentId === e.id)
  const orders = m.orders.filter((o) => o.equipmentId === e.id)
  const wc = governedWc(e, m.equipment)
  const rel = reliability(e)
  const create = () => {
    const x: Record<string, string> = {}
    if (!cf.desc.trim()) x.desc = "Describe the fault."
    if (cf.to < cf.from) x.to = "The window ends before it starts."
    setErr(x)
    if (Object.keys(x).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => { newMo(d, { type: "Corrective", equipmentId: e.id, desc: cf.desc.trim(), from: cf.from, to: cf.to, tasks: [{ text: "Diagnose and repair", hrs: 2 }], source: "Operator report" }) })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DetailPage
        header={{ title: `${e.name} (${e.id})`, screenId: "EQ-001", crumbs: [{ label: "Equipment register", to: "/target/maintenance/equipment" }, { label: e.id }], chips: <><Tag family={critFamily(e.criticality)} label={`Criticality ${e.criticality}`} />{wc && <StatusBadge kind="workCenter" status={wcStatusOf(m, wc)} />}</>, description: `${e.type}${chain.length ? ` in ${chain.map((c) => c.name).join(" / ")}` : ""}. ${wc ? `Governs work center ${wc} ${wcOf(wc)?.name ?? ""}.` : ""}`, primary: e.type !== "Location" ? <Button disabled={st.locked} onClick={() => { setErr({}); setDlg(true) }}>New corrective order</Button> : undefined }}
        summary={<><KV k="Counters">{e.hours} h{e.cycles ? `, ${e.cycles} cycles` : ""}</KV><KV k="Cost center">{costCenterOf(e, m.equipment)}</KV><KV k="MTBF">{rel.mtbf ? `${rel.mtbf.toFixed(0)} h` : "No failure yet"}</KV><KV k="MTTR">{rel.mttr ? `${rel.mttr.toFixed(1)} h` : "No failure yet"}</KV></>}
        tabs={[
          { id: "hier", label: "Hierarchy and counters", content: (
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              <p>Parent chain: {chain.length ? chain.map((c) => c.name).join(" > ") : "top level"}. Children: {children.length ? children.map((c) => <Link key={c.id} className="mr-2 text-link underline" to={`/target/maintenance/equipment/${c.id}`}>{c.name}</Link>) : "none"}.</p>
              <dl className="grid grid-cols-3 gap-3"><KV k="Operating hours">{e.hours}</KV><KV k="Cycles">{e.cycles}</KV><KV k="Hours per day">{e.dailyHours}</KV></dl>
              <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={st.locked || e.type === "Location"} onClick={() => st.run(() => { const r = mutate((d) => { const x = d.maint.equipment.find((q) => q.id === e.id)!; x.hours += x.dailyHours; x.cycles += x.cycles ? Math.round(x.dailyHours * 6) : 0 }); return r.ok ? { ok: "One day of confirmations fed the counters" } : r.error })}>Feed one day of confirmations</Button><span className="text-xs text-muted-foreground">Counters are fed by confirmations or signals; there is no manual counter edit.</span></div>
              {e.calibration ? <p className="rounded-lg border p-3">Calibration (quality register): instrument <span className="font-mono">{e.calibration.instrumentId}</span>, {e.calibration.status}, due {fmtDate(e.calibration.due)}. <Chip kind="design">Linked, not copied</Chip></p> : <p className="text-muted-foreground">No calibrated instrument linked.</p>}
              <div><p className="font-medium">Documents</p>{e.docs.length ? <ul className="list-disc pl-5">{e.docs.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-muted-foreground">None attached.</p>}</div>
            </div>
          ) },
          { id: "plans", label: "Plans", count: plans.length, content: plans.length === 0 ? <EmptyState title="No plan">Add one on the maintenance plans screen.</EmptyState> : (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Plan</TableHead><TableHead>Cycle</TableHead><TableHead>Next due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{plans.map((p) => { const n = nextDue(p, e); return <TableRow key={p.id}><TableCell><span className="font-mono">{p.id}</span> {p.name}</TableCell><TableCell>Every {p.cycle.every} {p.cycle.unit}</TableCell><TableCell>{fmtDate(n.date)} {planOverdue(p, e) && <Chip kind="flag">Overdue</Chip>}</TableCell><TableCell>{p.status}</TableCell></TableRow> })}</TableBody></Table>
          ) },
          { id: "orders", label: "Open orders", count: orders.filter((o) => MO_OPEN.includes(o.status)).length, content: (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Order</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{orders.filter((o) => MO_OPEN.includes(o.status)).map((o) => <TableRow key={o.id}><TableCell><Link className="font-mono text-link underline" to={`/target/maintenance/orders/${o.id}`}>{o.id}</Link></TableCell><TableCell>{o.type}</TableCell><TableCell>{o.desc}</TableCell><TableCell><StatusBadge kind="productionOrder" status={o.status} /></TableCell></TableRow>)}{orders.filter((o) => MO_OPEN.includes(o.status)).length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No open order.</TableCell></TableRow>}</TableBody></Table>
          ) },
          { id: "hist", label: "History", count: orders.filter((o) => !MO_OPEN.includes(o.status)).length + e.failures.length, content: (
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              <p>In the last {PERIOD_DAYS} days: {rel.n} failure{rel.n === 1 ? "" : "s"}, {rel.downHrs.toFixed(1)} h down.</p>
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Failure start</TableHead><TableHead>Restored</TableHead><TableHead>Order</TableHead></TableRow></TableHeader><TableBody>{e.failures.map((f) => <TableRow key={f.start}><TableCell className="tabular">{f.start}</TableCell><TableCell className="tabular">{f.end}</TableCell><TableCell>{f.moId && <Link className="font-mono text-link underline" to={`/target/maintenance/orders/${f.moId}`}>{f.moId}</Link>}</TableCell></TableRow>)}{e.failures.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No failure recorded.</TableCell></TableRow>}</TableBody></Table>
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Closed order</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{orders.filter((o) => !MO_OPEN.includes(o.status)).map((o) => <TableRow key={o.id}><TableCell><Link className="font-mono text-link underline" to={`/target/maintenance/orders/${o.id}`}>{o.id}</Link> {o.desc}</TableCell><TableCell>{o.type}</TableCell><TableCell><StatusBadge kind="productionOrder" status={o.status} /></TableCell></TableRow>)}</TableBody></Table>
            </div>
          ) },
          { id: "spares", label: "Spares", count: e.spares.length, content: e.spares.length === 0 ? <EmptyState title="No spare listed">Add SPARE materials to the equipment's parts list.</EmptyState> : (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Spare</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Reorder point</TableHead><TableHead>Planning</TableHead></TableRow></TableHeader>
              <TableBody>{e.spares.map((x) => <TableRow key={x.materialId}><TableCell>{x.materialId} {matDesc(x.materialId)}</TableCell><TableCell className="tabular text-right">{x.qty}</TableCell><TableCell className="tabular text-right">{x.reorderPoint}</TableCell><TableCell>{x.qty <= x.reorderPoint ? <Tag family="exception" label="At or below reorder point: planned as a SPARE material" /> : "Covered"}</TableCell></TableRow>)}</TableBody></Table>
          ) },
        ]}
      />
      <DialogShell open={dlg} onOpenChange={setDlg} title={`New corrective order for ${e.name}`} confirmLabel="Create order" onConfirm={create} consequence="Creates a Created order and reserves the window as blocked capacity for the scheduler.">
        <div className="grid gap-3"><Field label="Fault" id="co-d" error={err.desc}><Input id="co-d" value={cf.desc} onChange={(x) => setCf({ ...cf, desc: x.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Window from" id="co-f"><Input id="co-f" type="date" value={cf.from} onChange={(x) => setCf({ ...cf, from: x.target.value })} /></Field><Field label="Window to" id="co-t" error={err.to}><Input id="co-t" type="date" value={cf.to} onChange={(x) => setCf({ ...cf, to: x.target.value })} /></Field></div></div>
      </DialogShell>
    </>
  )
}

// ============================================================================ plans
export function MaintPlans() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("mplan", { validation: "Validation: a cycle is a positive number; tolerance is zero or more days; the horizon is 1 to 90 days; a plan needs at least one task." })
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [f, setF] = useState({ equipmentId: "", name: "", kind: "Time" as "Time" | "Counter", every: "30", unit: "days" as MPlan["cycle"]["unit"], tol: "2", horizon: "14", task: "", hrs: "2" })
  const [err, setErr] = useState<Record<string, string>>({})
  const m = s.maint
  const cols: Column<MPlan>[] = [
    { id: "id", header: "Plan", value: (p) => p.id, mono: true, sortable: true },
    { id: "eq", header: "Equipment", value: (p) => m.equipment.find((e) => e.id === p.equipmentId)?.name ?? p.equipmentId, filterable: true },
    { id: "name", header: "Plan", value: (p) => p.name },
    { id: "cycle", header: "Cycle", value: (p) => `${p.cycle.kind}: every ${p.cycle.every} ${p.cycle.unit}` },
    { id: "tol", header: "Tolerance", value: (p) => p.toleranceDays, cell: (p) => `${p.toleranceDays} days` },
    { id: "next", header: "Next due (computed now)", value: (p) => nextDue(p, m.equipment.find((e) => e.id === p.equipmentId)!).date, sortable: true, cell: (p) => { const e = m.equipment.find((x) => x.id === p.equipmentId)!; const n = nextDue(p, e); return <span className="tabular">{fmtDate(n.date)} {planOverdue(p, e) && <Chip kind="flag">Overdue</Chip>}</span> } },
    { id: "hor", header: "Horizon", value: (p) => p.horizonDays, cell: (p) => `${p.horizonDays} days` },
    { id: "status", header: "Status", value: (p) => p.status, filterable: true, cell: (p) => <Tag family={p.status === "Active" ? "done" : "blocked"} label={p.status} /> },
    { id: "act", header: "", cell: (p) => <span className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setSel(p.id)}>Preview</Button><Button size="sm" variant="outline" disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => { const x = d.maint.plans.find((q) => q.id === p.id)!; x.status = x.status === "Active" ? "Paused" : "Active" }); return r.ok ? { ok: `${p.id} ${p.status === "Active" ? "paused" : "activated"}` } : r.error })}>{p.status === "Active" ? "Pause" : "Activate"}</Button></span> },
  ]
  const gen = (ids?: string[]) => st.run(() => {
    let made: string[] = []
    const r = mutate((d) => { made = generatePreventive(d, ids) })
    if (!r.ok) return r.error
    return made.length ? { ok: `Generated ${made.join(", ")} and reserved the windows as blocked capacity` } : "Nothing to generate: no active plan has a due date inside its horizon without an order already covering it."
  })
  const save = () => {
    const e: Record<string, string> = {}
    if (!f.equipmentId) e.equipmentId = "Choose the equipment."
    if (!f.name.trim()) e.name = "Name the plan."
    if (!(Number(f.every) > 0)) e.every = "The cycle is a positive number."
    if (!(Number(f.tol) >= 0)) e.tol = "Zero or more days."
    const h = Number(f.horizon)
    if (!(h >= 1 && h <= 90)) e.horizon = "1 to 90 days (design range)."
    if (!f.task.trim()) e.task = "Add the first task."
    if (!(Number(f.hrs) > 0)) e.hrs = "Hours above zero."
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => { d.maint.seq += 1; d.maint.plans.push({ id: `MPLAN-TBD-${String(d.maint.plans.length + 1).padStart(3, "0")}`, equipmentId: f.equipmentId, name: f.name.trim(), cycle: { kind: f.kind, every: Number(f.every), unit: f.kind === "Time" ? "days" : f.unit }, lastDone: TODAY_M, lastCounter: f.kind === "Counter" ? (f.unit === "hours" ? d.maint.equipment.find((x) => x.id === f.equipmentId)!.hours : d.maint.equipment.find((x) => x.id === f.equipmentId)!.cycles) : undefined, toleranceDays: Number(f.tol), horizonDays: h, tasks: [{ text: f.task.trim(), hrs: Number(f.hrs), parts: [] }], status: "Active" }) })
    return r.ok ? null : r.error
  }
  const p = m.plans.find((x) => x.id === sel)
  const pe = p && m.equipment.find((x) => x.id === p.equipmentId)!
  const preview = p && pe ? [0, 1, 2].map((i) => (p.cycle.kind === "Time" ? addD(nextDue(p, pe).date, p.cycle.every * i) : addD(nextDue(p, pe).date, Math.round((p.cycle.every / (p.cycle.unit === "hours" ? pe.dailyHours : Math.max(1, Math.round(pe.dailyHours * 6)))) * i)))) : []
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ConfigPage
        header={{ title: "Maintenance plans", screenId: "MPLAN-001", description: "Time-based or counter-based cycles per equipment, task lists with labor, parts and instructions, tolerance windows, and a next due date computed continuously. Generation inside the horizon reserves the equipment window as blocked capacity.", primary: <Button disabled={st.locked} onClick={() => { setErr({}); setOpen(true) }}>New plan</Button>, actions: <Button variant="outline" disabled={st.locked} onClick={() => gen()}>Generate due orders now</Button> }}
      >
        <DataTableLazy rows={st.rows(m.plans)} cols={cols} loading={st.loading} />
        {p && pe && (
          <section aria-label="Next due preview" className="mt-4 rounded-lg border p-4 text-sm">
            <h2 className="mb-2 flex items-center justify-between font-semibold">Next due preview: {p.id}<Button size="sm" variant="ghost" onClick={() => setSel(null)}>Close</Button></h2>
            <p>{nextDue(p, pe).detail}. Tolerance window of {p.toleranceDays} days: due {fmtDate(addD(nextDue(p, pe).date, -p.toleranceDays))} to {fmtDate(addD(nextDue(p, pe).date, p.toleranceDays))}.</p>
            <p>Next three occurrences: {preview.map((x) => fmtDate(x)).join(", ")}. Generation horizon: {p.horizonDays} days from today ({fmtDate(addD(TODAY_M, p.horizonDays))}).</p>
            <ul className="mt-2 list-disc pl-5">{p.tasks.map((t) => <li key={t.text}>{t.text}, {t.hrs} h{t.parts.length ? `, parts ${t.parts.map((x) => `${x.qty} x ${x.materialId}`).join(", ")}` : ""}</li>)}</ul>
            <div className="mt-3"><Button size="sm" variant="outline" disabled={st.locked || p.status !== "Active"} onClick={() => gen([p.id])}>Generate this plan's order</Button></div>
          </section>
        )}
        <div className="mt-4"><RulesPanel rules={[["EAM-3", "Preventive plans generate orders inside the planning horizon and reserve the equipment window in the finite schedule as blocked capacity, visible in the what-if sandbox before publishing.", "Book IX §8.2"], ["EAM-4", "Spares plan by reorder point as SPARE materials and are consumed to the order by the standard issue movement.", "Book IX §8.2"]]} /></div>
      </ConfigPage>
      <DialogShell open={open} onOpenChange={setOpen} title="New maintenance plan" confirmLabel="Create plan" onConfirm={save} wide consequence="Creates an Active plan. Its first order is generated when the due date comes inside the horizon.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Equipment" id="np-e" error={err.equipmentId}><Select value={f.equipmentId} onValueChange={(v) => setF({ ...f, equipmentId: v })}><SelectTrigger id="np-e"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{m.equipment.filter((e) => e.type !== "Location").map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Plan name" id="np-n" error={err.name}><Input id="np-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Cycle type" id="np-k"><Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as "Time" | "Counter", unit: v === "Time" ? "days" : "hours" })}><SelectTrigger id="np-k"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Time">Time based</SelectItem><SelectItem value="Counter">Counter based</SelectItem></SelectContent></Select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Every" id="np-v" error={err.every}><Input id="np-v" inputMode="numeric" value={f.every} onChange={(e) => setF({ ...f, every: e.target.value })} /></Field>
            <Field label="Unit" id="np-u"><Select value={f.unit} onValueChange={(v) => setF({ ...f, unit: v as MPlan["cycle"]["unit"] })} disabled={f.kind === "Time"}><SelectTrigger id="np-u"><SelectValue /></SelectTrigger><SelectContent>{(f.kind === "Time" ? ["days"] : ["hours", "cycles"]).map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field></div>
          <Field label="Tolerance (days)" id="np-t" error={err.tol}><Input id="np-t" inputMode="numeric" value={f.tol} onChange={(e) => setF({ ...f, tol: e.target.value })} /></Field>
          <Field label="Generation horizon (days)" id="np-h" error={err.horizon} hint="Design default 14"><Input id="np-h" inputMode="numeric" value={f.horizon} onChange={(e) => setF({ ...f, horizon: e.target.value })} /></Field>
          <Field label="First task" id="np-a" error={err.task}><Input id="np-a" value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} /></Field>
          <Field label="Task hours" id="np-r" error={err.hrs}><Input id="np-r" inputMode="decimal" value={f.hrs} onChange={(e) => setF({ ...f, hrs: e.target.value })} /></Field>
        </div>
      </DialogShell>
    </>
  )
}
import { DataTable } from "@/components/patterns"
function DataTableLazy<R extends { id: string }>({ rows, cols, loading }: { rows: R[]; cols: Column<R>[]; loading: boolean }) {
  return <DataTable rows={rows} columns={cols} rowId={(r) => r.id} searchText={(r) => JSON.stringify(r)} loading={loading} densityKey="mplan" empty={{ title: "No plan yet", body: "Create a plan for the first critical machine." }} />
}

// ============================================================================ orders list
export function MaintOrders() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("mo-list", { validation: "Validation: choose equipment, describe the work, and give a window that ends on or after it starts; at least one task." })
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ type: "Corrective" as MoType, equipmentId: "", desc: "", from: TODAY_M, to: TODAY_M, task: "", hrs: "2", permit: "" })
  const [err, setErr] = useState<Record<string, string>>({})
  const m = s.maint
  const cols: Column<Mo>[] = [
    { id: "id", header: "Maintenance order", value: (o) => o.id, mono: true, sortable: true },
    { id: "type", header: "Type", value: (o) => o.type, filterable: true },
    { id: "eq", header: "Equipment", value: (o) => m.equipment.find((e) => e.id === o.equipmentId)?.name ?? o.equipmentId, filterable: true },
    { id: "desc", header: "Work", value: (o) => o.desc },
    { id: "win", header: "Window", value: (o) => o.window.from, sortable: true, cell: (o) => `${fmtDate(o.window.from)} to ${fmtDate(o.window.to)}` },
    { id: "status", header: "Status", value: (o) => o.status, filterable: true, cell: (o) => <StatusBadge kind="productionOrder" status={o.status} /> },
    { id: "src", header: "Source", value: (o) => o.source },
  ]
  const save = () => {
    const e: Record<string, string> = {}
    if (!f.equipmentId) e.equipmentId = "Choose the equipment."
    if (!f.desc.trim()) e.desc = "Describe the work."
    if (f.to < f.from) e.to = "The window ends before it starts."
    if (!f.task.trim()) e.task = "Add the first task."
    if (!(Number(f.hrs) > 0)) e.hrs = "Hours above zero."
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => { newMo(d, { type: f.type, equipmentId: f.equipmentId, desc: f.desc.trim(), from: f.from, to: f.to, tasks: [{ text: f.task.trim(), hrs: Number(f.hrs) }], permit: f.permit.trim(), source: f.type === "Breakdown" ? "Terminal hold reason: machine down" : f.type === "Inspection" ? "Planner" : "Operator report" }) })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ListPage
        header={{ title: "Maintenance orders", screenId: "MO-001", description: "Preventive, corrective, breakdown and inspection orders with tasks, parts reservations, a permit note and a planned window. The status path runs parallel to production orders; settlement goes to the owning cost center, never to product WIP.", chips: <Chip kind="oq" id="OQ-18" note={MO_NOTE} />, primary: <Button disabled={st.locked} onClick={() => { setErr({}); setOpen(true) }}>New maintenance order</Button> }}
        table={{ rows: st.rows(m.orders), columns: cols, rowId: (o) => o.id, rowHref: (o) => `/target/maintenance/orders/${o.id}`, searchText: (o) => `${o.id} ${o.desc} ${o.equipmentId}`, loading: st.loading, densityKey: "mo", empty: { title: "No maintenance order", body: "Preventive orders are generated from plans; breakdown orders from the terminal and the gateway." } }}
      />
      <DialogShell open={open} onOpenChange={setOpen} title="New maintenance order" confirmLabel="Create order" onConfirm={save} wide consequence="Creates the order in Created and reserves its window as blocked capacity on the governing work center.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" id="mo-t"><Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as MoType })}><SelectTrigger id="mo-t"><SelectValue /></SelectTrigger><SelectContent>{MO_TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Equipment" id="mo-e" error={err.equipmentId}><Select value={f.equipmentId} onValueChange={(v) => setF({ ...f, equipmentId: v })}><SelectTrigger id="mo-e"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{m.equipment.filter((e) => e.type !== "Location").map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Work" id="mo-d" error={err.desc}><Input id="mo-d" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field>
          <Field label="Permit note" id="mo-p" hint="Lockout or hot-work permit reference"><Input id="mo-p" value={f.permit} onChange={(e) => setF({ ...f, permit: e.target.value })} /></Field>
          <Field label="Window from" id="mo-f"><Input id="mo-f" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="Window to" id="mo-to" error={err.to}><Input id="mo-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Field label="First task" id="mo-k" error={err.task}><Input id="mo-k" value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} /></Field>
          <Field label="Task hours" id="mo-h" error={err.hrs}><Input id="mo-h" inputMode="decimal" value={f.hrs} onChange={(e) => setF({ ...f, hrs: e.target.value })} /></Field>
        </div>
      </DialogShell>
    </>
  )
}

// ============================================================================ order detail
export function MaintOrderDetail() {
  const { id } = useParams()
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("mo-detail", { validation: "Validation: the next step has a precondition (see the message when you press it)." })
  const [hold, setHold] = useState<null | "On Hold" | "Cancelled">(null)
  const [lab, setLab] = useState({ who: "Maintenance crew", hrs: "1" })
  const [win, setWin] = useState<{ from: string; to: string } | null>(null)
  const m = s.maint
  const o = m.orders.find((x) => x.id === id)
  if (!o) return <EmptyState title="Maintenance order not found">No maintenance order has id {id}. <Link className="text-link underline" to="/target/maintenance/orders">Back to maintenance orders</Link></EmptyState>
  const e = m.equipment.find((x) => x.id === o.equipmentId)!
  const wc = governedWc(e, m.equipment)
  const cost = moCost(o)
  const cc = costCenterOf(e, m.equipment)
  const clash = conflictOf(s, o)
  const step = (to: string, reason?: string) => st.run(() => { const r = mutate((d) => moAdvance(d, o.id, to, reason)); return r.ok ? { ok: `${o.id} is now ${to}` } : r.error })
  const nextTo = o.status === "Created" ? "Released" : o.status === "Released" ? "In Progress" : o.status === "In Progress" ? "Completed" : o.status === "Completed" ? "Closed (TECO)" : o.status === "On Hold" ? "In Progress" : undefined
  const nextLabel = nextTo === "Released" ? "Release order" : nextTo === "In Progress" ? (o.status === "On Hold" ? "Resume" : "Start work") : nextTo === "Completed" ? "Complete" : nextTo === "Closed (TECO)" ? "Close and settle" : undefined
  const winEdit = ["Created", "Released"].includes(o.status)
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DetailPage
        header={{
          title: `${o.id}: ${o.desc}`, screenId: "MO-001", crumbs: [{ label: "Maintenance orders", to: "/target/maintenance/orders" }, { label: o.id }],
          chips: <><StatusBadge kind="productionOrder" status={o.status} /><Tag family={o.type === "Breakdown" ? "exception" : "active"} label={o.type} /><Chip kind="oq" id="OQ-18" note={MO_NOTE} /></>,
          description: `${e.name}. Source: ${o.source}.${o.permit ? ` Permit: ${o.permit}.` : ""}`,
          primary: nextTo ? <Button disabled={st.locked} onClick={() => step(nextTo)}>{nextLabel}</Button> : undefined,
          actions: <>{["Released", "In Progress"].includes(o.status) && <Button variant="outline" disabled={st.locked} onClick={() => setHold("On Hold")}>Put on hold</Button>}{["Created", "Released", "On Hold"].includes(o.status) && <Button variant="outline" disabled={st.locked} onClick={() => setHold("Cancelled")}>Cancel order</Button>}</>,
        }}
        summary={<><KV k="Equipment"><Link className="text-link underline" to={`/target/maintenance/equipment/${e.id}`}>{e.name}</Link></KV><KV k="Window">{fmtDate(o.window.from)} to {fmtDate(o.window.to)}</KV><KV k="Cost center">{cc}</KV><KV k="Actual cost">{money(cost.total, 2)}</KV></>}
        tabs={[
          { id: "tasks", label: "Tasks", count: o.tasks.length, content: (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Task</TableHead><TableHead className="text-right">Planned h</TableHead><TableHead>Done</TableHead></TableRow></TableHeader>
              <TableBody>{o.tasks.map((t, i) => <TableRow key={i}><TableCell>{t.text}</TableCell><TableCell className="tabular text-right">{t.hrs}</TableCell><TableCell><Checkbox aria-label={`Task ${i + 1} done`} checked={t.done} disabled={st.locked || o.status !== "In Progress"} onCheckedChange={(c) => st.run(() => { const r = mutate((d) => { d.maint.orders.find((q) => q.id === o.id)!.tasks[i].done = !!c }); return r.ok ? { ok: "Task updated" } : r.error })} /></TableCell></TableRow>)}</TableBody></Table>
          ) },
          { id: "parts", label: "Parts", count: o.parts.length, content: (
            <div className="flex flex-col gap-3">
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Spare</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Value</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{o.parts.map((p) => <TableRow key={p.materialId}><TableCell>{p.materialId} {matDesc(p.materialId)}</TableCell><TableCell className="tabular text-right">{p.qty}</TableCell><TableCell className="tabular text-right">{p.issued}</TableCell><TableCell className="tabular text-right">{money(p.issued * stdCostOf(p.materialId), 2)}</TableCell><TableCell><Button size="sm" variant="outline" disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => issuePart(d, o.id, p.materialId)); return r.ok ? { ok: `${p.materialId} issued by the standard movement and valued at standard cost` } : r.error })}>Issue one</Button></TableCell></TableRow>)}{o.parts.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No reservation.</TableCell></TableRow>}</TableBody></Table>
              {winEdit && <div className="flex items-end gap-2"><Field label="Reserve a spare" id="rp"><Select value="" onValueChange={(v) => st.run(() => { const r = mutate((d) => { const x = d.maint.orders.find((q) => q.id === o.id)!; const p = x.parts.find((q) => q.materialId === v); if (p) p.qty += 1; else x.parts.push({ materialId: v, qty: 1, issued: 0 }) }); return r.ok ? { ok: `${v} reserved` } : r.error })}><SelectTrigger id="rp" className="w-80"><SelectValue placeholder="Choose a spare" /></SelectTrigger><SelectContent>{SPARES.map((x) => <SelectItem key={x} value={x}>{x} {matDesc(x).slice(0, 36)}</SelectItem>)}</SelectContent></Select></Field></div>}
              <p className="text-xs text-muted-foreground">Spares are consumed only through the standard issue movement and valued like any stock issue.</p>
            </div>
          ) },
          { id: "labor", label: "Labor", count: o.labor.length, content: (
            <div className="flex flex-col gap-3">
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Who</TableHead><TableHead className="text-right">Hours</TableHead><TableHead className="text-right">At {money(MAINT_LABOR_RATE)}</TableHead></TableRow></TableHeader><TableBody>{o.labor.map((l, i) => <TableRow key={i}><TableCell>{l.who}</TableCell><TableCell className="tabular text-right">{l.hrs}</TableCell><TableCell className="tabular text-right">{money(l.hrs * MAINT_LABOR_RATE, 2)}</TableCell></TableRow>)}{o.labor.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No labor booked.</TableCell></TableRow>}</TableBody></Table>
              <div className="flex items-end gap-2"><Field label="Who" id="lb-w"><Input id="lb-w" value={lab.who} onChange={(e) => setLab({ ...lab, who: e.target.value })} className="w-56" /></Field><Field label="Hours" id="lb-h"><Input id="lb-h" inputMode="decimal" value={lab.hrs} onChange={(e) => setLab({ ...lab, hrs: e.target.value })} className="w-24" /></Field><Button variant="outline" disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => logLabor(d, o.id, lab.who, Number(lab.hrs))); return r.ok ? { ok: "Labor booked" } : r.error })}>Book labor</Button></div>
              <p className="text-xs text-muted-foreground">Labor rate {money(MAINT_LABOR_RATE)} per hour is a design value.</p>
            </div>
          ) },
          { id: "window", label: "Window", content: (
            <div className="flex max-w-2xl flex-col gap-3 text-sm">
              <p>Planned window {fmtDate(o.window.from)} to {fmtDate(o.window.to)}{wc ? <>, reserved as blocked capacity on {wc} {wcOf(wc)?.name}</> : ", no work center governed (nothing to block)"}.</p>
              {clash && <p className="rounded-lg border border-status-exception p-3"><Chip kind="flag">Schedule conflict</Chip> Production order {clash.woId} runs on {clash.wc} from {fmtDate(clash.from)} to {fmtDate(clash.to)}. The scheduler sees this block in the what-if sandbox before publishing.</p>}
              {winEdit ? (
                <div className="flex items-end gap-2"><Field label="From" id="w-f"><Input id="w-f" type="date" value={(win ?? o.window).from} onChange={(e) => setWin({ ...(win ?? o.window), from: e.target.value })} /></Field><Field label="To" id="w-t"><Input id="w-t" type="date" value={(win ?? o.window).to} onChange={(e) => setWin({ ...(win ?? o.window), to: e.target.value })} /></Field>
                  <Button variant="outline" disabled={st.locked || !win} onClick={() => st.run(() => { if (win && win.to < win.from) return "The window ends before it starts."; const r = mutate((d) => { const x = d.maint.orders.find((q) => q.id === o.id)!; x.window = win!; syncBlock(d, x) }); if (r.ok) setWin(null); return r.ok ? { ok: "Window moved; blocked capacity updated" } : r.error })}>Move window</Button></div>
              ) : <p className="text-muted-foreground">The window is fixed once work has started.</p>}
              <p>Permit note: {o.permit || "none recorded"}.</p>
            </div>
          ) },
          { id: "settle", label: "Settlement", content: (
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Basis</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell>Owning cost center expense ({cc})</TableCell><TableCell>Spares stock</TableCell><TableCell className="tabular text-right">{money(cost.parts, 2)}</TableCell><TableCell>Issued parts at standard cost</TableCell></TableRow>
                  <TableRow><TableCell>Owning cost center expense ({cc})</TableCell><TableCell>Labor absorption</TableCell><TableCell className="tabular text-right">{money(cost.labor, 2)}</TableCell><TableCell>Booked hours at the labor rate</TableCell></TableRow>
                </TableBody></Table>
              <p>Order actual cost at close: <span className="font-semibold">{money(cost.total, 2)}</span>. {o.settled ? <Tag family="done" label={`Settled ${fmtDate(o.settled.at)}: ${money(o.settled.amount, 2)}`} /> : "Not settled yet."}</p>
              <p className="text-muted-foreground">Never touches product WIP. The expense feeds the work center rate pools next cycle. The account numbers follow the posting matrix; the PRD gives no template number for this posting, so none is shown.</p>
            </div>
          ) },
        ]}
      />
      <DialogShell open={!!hold} onOpenChange={(x) => !x && setHold(null)} title={hold === "Cancelled" ? `Cancel ${o.id}` : `Put ${o.id} on hold`} confirmLabel={hold === "Cancelled" ? "Cancel order" : "Hold order"} destructive={hold === "Cancelled"} requireReason reasonLabel="Reason (required)"
        consequence={hold === "Cancelled" ? "Cancels the order and releases the blocked capacity. It cannot be reopened." : "Holds the order. The window stays reserved until you resume or cancel."}
        onConfirm={(reason) => { const g = st.guard(); if (g) return g; const r = mutate((d) => moAdvance(d, o.id, hold!, reason)); return r.ok ? null : r.error }} />
    </>
  )
}

// ============================================================================ board
const critRank = (c: string) => (c === "A" ? 0 : c === "B" ? 1 : 2)
export function MaintBoard() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("maint-board", { degraded: "Production schedule last synced 47 minutes ago: conflict flags use that schedule." })
  const [queue, setQueue] = useState("overdue")
  const [openId, setOpenId] = useState<string | null>(null)
  const [win, setWin] = useState<{ from: string; to: string } | null>(null)
  const m = s.maint
  const open = m.orders.filter((o) => MO_OPEN.includes(o.status) || o.status === "Completed")
  const eqOf = (o: Mo) => m.equipment.find((e) => e.id === o.equipmentId)!
  const overdue = (o: Mo) => o.window.to < TODAY_M && o.status !== "Completed"
  const dueWeek = (o: Mo) => o.window.to >= TODAY_M && o.window.from <= addD(TODAY_M, 7)
  const sets: Record<string, Mo[]> = { overdue: open.filter(overdue), week: open.filter(dueWeek), conflict: open.filter((o) => conflictOf(s, o)), all: open }
  const rows = (sets[queue] ?? open).slice().sort((a, b) => critRank(eqOf(a).criticality) - critRank(eqOf(b).criticality) || a.window.to.localeCompare(b.window.to))
  const o = m.orders.find((x) => x.id === openId)
  const cols: Column<Mo>[] = [
    { id: "id", header: "Order", value: (x) => x.id, mono: true, sortable: true },
    { id: "crit", header: "Equipment criticality", value: (x) => eqOf(x).criticality, filterable: true, sortable: true, cell: (x) => <Tag family={critFamily(eqOf(x).criticality)} label={`Class ${eqOf(x).criticality}`} /> },
    { id: "eq", header: "Equipment", value: (x) => eqOf(x).name },
    { id: "type", header: "Type", value: (x) => x.type, filterable: true },
    { id: "win", header: "Window", value: (x) => x.window.from, cell: (x) => `${fmtDate(x.window.from)} to ${fmtDate(x.window.to)}` },
    { id: "flags", header: "Flags", value: (x) => (overdue(x) ? "Overdue" : conflictOf(s, x) ? "Conflict" : ""), cell: (x) => <span className="flex flex-wrap gap-1">{overdue(x) && <Chip kind="flag">Overdue</Chip>}{conflictOf(s, x) && <Chip kind="block" note={`Production order ${conflictOf(s, x)!.woId} on the same work center`}>Production conflict</Chip>}</span> },
    { id: "status", header: "Status", value: (x) => x.status, cell: (x) => <StatusBadge kind="productionOrder" status={x.status} /> },
  ]
  const gen = () => st.run(() => { let made: string[] = []; const r = mutate((d) => { made = generatePreventive(d) }); if (!r.ok) return r.error; return made.length ? { ok: `Generated ${made.join(", ")}` } : "No plan has a due date inside its horizon without an order already covering it." })
  const conf = o && conflictOf(s, o)
  const newWin = win ?? o?.window
  const newConf = o && newWin ? conflictOf(s, { ...o, window: newWin }) : undefined
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{
          title: "Maintenance backlog board", screenId: "MAINT-BOARD-001",
          description: "Due and overdue orders ordered by equipment criticality, with schedule conflicts against production highlighted. Blocked capacity below is what the scheduler sees in the what-if sandbox.",
          primary: <Button disabled={st.locked} onClick={gen}>Generate due preventive orders</Button>,
          children: m.blocked.length ? <div className="text-sm"><p className="mb-1 font-medium">Blocked capacity (equipment windows reserved for the scheduler)</p><ul className="flex flex-wrap gap-2">{m.blocked.map((b) => <li key={b.id} className="rounded border px-2 py-1 text-xs">{b.wc ?? b.equipmentId} {fmtDate(b.from)} to {fmtDate(b.to)} for {b.moId}</li>)}</ul></div> : undefined,
        }}
        kpis={[{ label: "Overdue", value: sets.overdue.length }, { label: "Due within 7 days", value: sets.week.length }, { label: "Conflicts with production", value: sets.conflict.length, hint: "Same work center, overlapping dates" }, { label: "Class A equipment with open orders", value: open.filter((x) => eqOf(x).criticality === "A").length }]}
        queues={[{ id: "overdue", label: "Overdue", count: sets.overdue.length }, { id: "week", label: "Due this week", count: sets.week.length }, { id: "conflict", label: "Conflicts", count: sets.conflict.length }, { id: "all", label: "All open", count: open.length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows: st.rows(rows), columns: cols, rowId: (x) => x.id, onRowClick: (x) => { setOpenId(x.id); setWin(null) }, activeId: openId ?? undefined, searchText: (x) => `${x.id} ${x.desc} ${eqOf(x).name}`, loading: st.loading, densityKey: "mboard", empty: { title: "Backlog clear", body: "Nothing is due or overdue in this queue." } }}
        panel={{ open: !!o, onOpenChange: (x) => !x && setOpenId(null), title: o?.id ?? "", description: o ? `${eqOf(o).name}: ${o.desc}` : undefined,
          content: o && newWin && (
            <div className="flex flex-col gap-3 text-sm">
              <dl className="grid grid-cols-2 gap-3"><KV k="Type">{o.type}</KV><KV k="Status"><StatusBadge kind="productionOrder" status={o.status} /></KV><KV k="Criticality">Class {eqOf(o).criticality}</KV><KV k="Source">{o.source}</KV></dl>
              {conf ? <p className="rounded-md border border-status-exception p-3">Conflict: production order {conf.woId} runs on {conf.wc} from {fmtDate(conf.from)} to {fmtDate(conf.to)}. Move the maintenance window, or ask the scheduler to move the production order. Breakdowns do not wait.</p> : <p>No conflict with the production schedule.</p>}
              {["Created", "Released"].includes(o.status) && <>
                <div className="grid grid-cols-2 gap-2"><Field label="From" id="bw-f"><Input id="bw-f" type="date" value={newWin.from} onChange={(e) => setWin({ ...newWin, from: e.target.value })} /></Field><Field label="To" id="bw-t"><Input id="bw-t" type="date" value={newWin.to} onChange={(e) => setWin({ ...newWin, to: e.target.value })} /></Field></div>
                {win && <p>{newConf ? `The new window still overlaps ${newConf.woId} on ${newConf.wc}.` : "The new window is clear of production."}</p>}
                <div className="flex gap-2"><Button variant="outline" disabled={st.locked || !win} onClick={() => st.run(() => { if (win && win.to < win.from) return "The window ends before it starts."; const r = mutate((d) => { const x = d.maint.orders.find((q) => q.id === o.id)!; x.window = win!; syncBlock(d, x) }); if (r.ok) setWin(null); return r.ok ? { ok: "Window moved; blocked capacity updated" } : r.error })}>Move window</Button>
                  {o.status === "Created" && <Button disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => moAdvance(d, o.id, "Released")); return r.ok ? { ok: `${o.id} released` } : r.error })}>Release</Button>}</div></>}
              <Link className="text-link underline" to={`/target/maintenance/orders/${o.id}`}>Open the order</Link>
            </div>
          ) }}
      />
    </>
  )
}

// ============================================================================ dashboard
const MTBF_REVIEW = 500
const MTTR_REVIEW = 8
export function MaintDashboard() {
  const s = useSlice("targetState")
  const st = useScreenState("eam-dash", { degraded: "Failure history from the gateway lags: the newest failure may be missing from MTBF.", readOnly: "Read-only: the dashboard has no write controls." })
  const m = s.maint
  const rows = st.rows(m.equipment.filter((e) => e.type !== "Location").map((e) => ({ e, r: reliability(e) })))
  const withF = rows.filter((x) => x.r.n > 0)
  const fleetMtbf = withF.length ? withF.reduce((a, x) => a + (x.r.mtbf ?? 0), 0) / withF.length : 0
  const fleetMttr = withF.length ? withF.reduce((a, x) => a + (x.r.mttr ?? 0), 0) / withF.length : 0
  const review = (x: (typeof rows)[number]) => x.r.n > 0 && ((x.r.mtbf ?? Infinity) < MTBF_REVIEW || (x.r.mttr ?? 0) > MTTR_REVIEW)
  const chart = withF.map((x) => ({ name: x.e.name.slice(0, 18), MTBF: Math.round(x.r.mtbf ?? 0), MTTR: Math.round((x.r.mttr ?? 0) * 10) / 10 }))
  const cfg: ChartConfig = { MTBF: { label: "MTBF (h)", color: "var(--chart-2)" }, MTTR: { label: "MTTR (h)", color: "var(--chart-4)" } }
  const breakdowns = m.orders.filter((o) => o.type === "Breakdown")
  const lowSpares = m.equipment.flatMap((e) => e.spares.filter((x) => x.qty <= x.reorderPoint).map((x) => ({ e, x })))
  const overduePlans = m.plans.filter((p) => p.status === "Active" && planOverdue(p, m.equipment.find((e) => e.id === p.equipmentId)!))
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DashboardPage
        header={{ title: "Maintenance dashboard", screenId: "FX-EAM-DASH", description: `MTBF and MTTR per equipment, computed from the state history and order durations over the last ${PERIOD_DAYS} days (${OP_HOURS_PER_DAY} operating hours a day, a design value). The results feed criticality reviews.` }}
        tiles={[{ label: "Fleet MTBF", value: fleetMtbf ? `${fleetMtbf.toFixed(0)} h` : "n/a", hint: "Equipment with a failure" }, { label: "Fleet MTTR", value: fleetMttr ? `${fleetMttr.toFixed(1)} h` : "n/a" }, { label: "Open breakdown orders", value: breakdowns.filter((o) => MO_OPEN.includes(o.status)).length, tone: breakdowns.some((o) => MO_OPEN.includes(o.status)) ? "attention" : "default", to: "/target/maintenance/orders" }, { label: "Overdue preventive plans", value: overduePlans.length, to: "/target/maintenance/plans" }]}
      >
        <DashboardCard title="MTBF and MTTR by equipment">
          {st.loading ? <p className="text-sm text-muted-foreground">Loading</p> : chart.length === 0 ? <p className="text-sm text-muted-foreground">No failure in the period.</p> : (
            <ChartContainer config={cfg} className="h-64 w-full"><BarChart data={chart}><CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} fontSize={10} /><YAxis width={44} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="MTBF" fill="var(--color-MTBF)" isAnimationActive={false} /><Bar dataKey="MTTR" fill="var(--color-MTTR)" isAnimationActive={false} /></BarChart></ChartContainer>
          )}
        </DashboardCard>
        <DashboardCard title="Criticality review candidates">
          <p className="text-xs text-muted-foreground">Reading: MTBF under {MTBF_REVIEW} h or MTTR over {MTTR_REVIEW} h puts an asset on the review list. <Chip kind="design">Design thresholds</Chip></p>
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Equipment</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Failures</TableHead><TableHead className="text-right">MTBF h</TableHead><TableHead className="text-right">MTTR h</TableHead><TableHead>Review</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((x) => <TableRow key={x.e.id}><TableCell><Link className="text-link underline" to={`/target/maintenance/equipment/${x.e.id}`}>{x.e.name}</Link></TableCell><TableCell>{x.e.criticality}</TableCell><TableCell className="tabular text-right">{x.r.n}</TableCell><TableCell className="tabular text-right">{x.r.mtbf ? x.r.mtbf.toFixed(0) : "n/a"}</TableCell><TableCell className="tabular text-right">{x.r.mttr ? x.r.mttr.toFixed(1) : "n/a"}</TableCell><TableCell>{review(x) ? <Tag family="exception" label="Review criticality" /> : ""}</TableCell></TableRow>)}</TableBody></Table>
        </DashboardCard>
        <DashboardCard title="Breakdown flow, andon to restoration">
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Order</TableHead><TableHead>Equipment</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{breakdowns.map((o) => { const e = m.equipment.find((x) => x.id === o.equipmentId)!; return <TableRow key={o.id}><TableCell><Link className="font-mono text-link underline" to={`/target/maintenance/orders/${o.id}`}>{o.id}</Link></TableCell><TableCell>{e.name}</TableCell><TableCell className="text-xs">{o.source}</TableCell><TableCell><StatusBadge kind="productionOrder" status={o.status} /></TableCell></TableRow> })}</TableBody></Table>
        </DashboardCard>
        <DashboardCard title="Spares at or below reorder point">
          {lowSpares.length === 0 ? <p className="text-sm text-muted-foreground">Every spare is above its reorder point.</p> : <ul className="space-y-1 text-sm">{lowSpares.map(({ e, x }) => <li key={e.id + x.materialId}>{e.name}: {x.materialId} {x.qty} on hand, reorder point {x.reorderPoint}</li>)}</ul>}
        </DashboardCard>
      </DashboardPage>
    </>
  )
}
