// GATP-SEQ-001 check sequences, GATP-SIM-001 global availability cockpit, FX-GATP-PROMISE promise dialog (extended for the
// network), FX-GATP-BACKORDER backorder workbench network delta [Book IX §3]. One availability service answers across every
// plant, lane and entity; every cross network promise is as auditable as a local one: the promise names the sourcing plant,
// the lane, the plan snapshot and the check sequence version. The network engine activates per DEC-07; until then one plant
// and one implicit lane.

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApprovalButton, Chip, DataTable, KV, RulesPanel, type Column } from "@/components/patterns"
import { ConfigPage, DialogShell, WorkbenchPage } from "@/components/templates"
import { CUSTOMERS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Empty, Field, Section, Tag, TargetFrame, useScreenState } from "../components"
import { ALL_STEPS, CUSTOMER_CLASSES, GROUP_LIST, MATERIAL_GROUPS, availOf, nextSnapshot, reserve, sequenceFor, walk, type GBackorder, type GSequence, type GStepName, type GatpState, type WalkResult } from "../data/network"
import { customerClass, customerName, nid } from "../lib"

const DECISION = "Global multi-plant ATP and CTP is a Book IX target-state module (Book IX §3; the network engine activates per DEC-07)"
const EVIDENCE = "the network test packs for planning, intercompany and recall green in the two plant configuration, plus a promise audit of fifty cross plant confirmations tracing to their snapshots"
const TODAY = "2026-10-09"
const MATS = Object.keys(MATERIAL_GROUPS)
const plantName = (net: GatpState, id?: string) => net.plants.find((p) => p.id === id)?.city ?? id ?? ""

/** The walk of a check sequence: each step accepted or rejected, and why. */
export function WalkView({ net, w }: { net: GatpState; w: WalkResult }) {
  return (
    <Table>
      <TableHeader className="bg-table-head"><TableRow><TableHead>Step</TableHead><TableHead>Plant</TableHead><TableHead>Result</TableHead><TableHead>Why</TableHead><TableHead>Date</TableHead><TableHead>Lane</TableHead></TableRow></TableHeader>
      <TableBody>
        {w.steps.map((x, i) => (
          <TableRow key={i}>
            <TableCell>{x.step}</TableCell><TableCell>{plantName(net, x.plant) || "-"}</TableCell>
            <TableCell>{!x.reached ? <span className="text-muted-foreground">Not reached</span> : x.ok ? <Tag family="done" label="Accepted" /> : <Tag family="exception" label="Rejected" />}</TableCell>
            <TableCell className="max-w-md whitespace-normal text-sm">{x.detail}</TableCell><TableCell className="tabular">{x.date ?? x.offered ? fmtDate(x.date ?? x.offered) : ""}{!x.ok && x.offered ? " (offered)" : ""}</TableCell><TableCell className="font-mono text-xs">{x.lane ?? ""}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function singlePlant(net: GatpState): GatpState {
  const p = net.plants[0].id
  return { ...net, plants: [net.plants[0]], lanes: [], stocks: net.stocks.filter((s) => s.plantId === p) }
}

// ============================================================================ sequences
export function GatpSequences() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("gatp-seq", { validation: "Validation: a sequence needs at least one step; purchase lead time may only be last and only where policy allows it." })
  const [section, setSection] = useState("sequences")
  const net = s.gatp
  const [dlg, setDlg] = useState(false)
  const [f, setF] = useState({ group: GROUP_LIST[0], cls: CUSTOMER_CLASSES[0], steps: [...ALL_STEPS.slice(0, 3)] as GStepName[], purchase: false, eff: "2026-11-01" })
  const [err, setErr] = useState("")
  const [sim, setSim] = useState({ seq: net.sequences.find((x) => x.status === "Draft")?.id ?? net.sequences[0].id, mat: "FIN-TBD-2500PM", qty: "2", date: "2026-11-10" })
  const [res, setRes] = useState<WalkResult | null>(null)
  const move = (i: number, d: number) => { const a = [...f.steps]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setF({ ...f, steps: a }) }
  const create = () => {
    if (f.steps.length === 0) return setErr("A sequence needs at least one step."), "A sequence needs at least one step."
    const pi = f.steps.indexOf("Purchase lead time")
    if (pi >= 0 && pi !== f.steps.length - 1) return setErr("Purchase lead time is the last resort: move it to the end."), "Purchase lead time is the last resort: move it to the end."
    if (pi >= 0 && !f.purchase) return setErr("Policy must allow purchase lead time before the step can be used."), "Policy must allow purchase lead time before the step can be used."
    if (f.eff <= TODAY) return setErr("Effective date must be after today."), "Effective date must be after today."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => {
      const v = Math.max(0, ...d.gatp.sequences.filter((x) => x.group === f.group && x.customerClass === f.cls).map((x) => x.version)) + 1
      d.gatp.sequences.push({ id: nid(d, "GSEQ"), group: f.group, customerClass: f.cls, steps: f.steps, allowPurchase: f.purchase, version: v, effectiveFrom: f.eff, status: "Draft" })
    })
    setErr("")
    return r.ok ? null : r.error
  }
  const release = (x: GSequence) => st.run(() => {
    mutate((d) => { const q = d.gatp.sequences.find((y) => y.id === x.id)!; q.status = "Released" })
    return { ok: `${x.id} v${x.version} released, effective ${fmtDate(x.effectiveFrom)}` }
  })
  const cols: Column<GSequence>[] = [
    { id: "id", header: "Sequence", value: (x) => x.id, mono: true },
    { id: "g", header: "Material group", value: (x) => x.group, filterable: true },
    { id: "c", header: "Customer class", value: (x) => x.customerClass, filterable: true },
    { id: "s", header: "Ordered walk", value: (x) => x.steps.join(" > "), cell: (x) => <ol className="flex flex-wrap gap-1">{x.steps.map((t, i) => <li key={t} className="rounded-md border px-1 text-xs">{i + 1}. {t}</li>)}</ol> },
    { id: "v", header: "Version", value: (x) => x.version, align: "right" },
    { id: "e", header: "Effective from", value: (x) => x.effectiveFrom, sortable: true },
    { id: "st", header: "State", value: (x) => x.status, filterable: true, cell: (x) => <span className="flex items-center gap-2"><Tag family={x.status === "Released" ? "done" : "draft"} label={x.status} />{x.status === "Draft" && <Button size="sm" variant="outline" disabled={st.locked} onClick={() => release(x)}>Release</Button>}</span> },
  ]
  const runSim = () => st.run(() => {
    const sq = net.sequences.find((x) => x.id === sim.seq)!
    const qty = Number(sim.qty)
    if (!Number.isFinite(qty) || qty <= 0) return "Quantity must be greater than zero."
    if (MATERIAL_GROUPS[sim.mat] !== sq.group) return `The sample material belongs to ${MATERIAL_GROUPS[sim.mat]}; this sequence is for ${sq.group}. Pick a material in the group.`
    setRes(walk(net, sq, { materialId: sim.mat, qty, date: sim.date, today: TODAY, home: "PL-TBD-01" }))
  })
  const sqSel = net.sequences.find((x) => x.id === sim.seq)
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ConfigPage
        effectiveDated
        header={{ title: "Global ATP check sequences", screenId: "GATP-SEQ-001", description: "Sequence rows per material group and customer class: an ordered walk of own plant stock, named partner plant stock plus lane transit, production CTP at each plant holding a valid production version, and purchase lead time as the last resort where policy allows.", primary: <Button disabled={st.locked} onClick={() => { setErr(""); setDlg(true) }}>New sequence draft</Button> }}
        sections={[{ id: "sequences", label: "Sequences" }, { id: "sim", label: "Simulate a sample check" }]}
        section={section}
        onSectionChange={setSection}
      >
        {section === "sequences" && <DataTable densityKey="GATP-SEQ-001" rows={st.rows(net.sequences)} columns={cols} rowId={(x) => x.id} loading={st.loading} searchText={(x) => `${x.group} ${x.customerClass} ${x.id}`} empty={{ title: "No check sequence", body: "Without a sequence a global check has no walk." }} />}
        {section === "sim" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Runs the walk of the chosen sequence, draft or released, against current stock, lanes and slots. Nothing is reserved.</p>
            <div className="grid max-w-3xl gap-3 sm:grid-cols-4">
              <Field label="Sequence" id="gs-s"><Select value={sim.seq} onValueChange={(v) => setSim({ ...sim, seq: v })}><SelectTrigger id="gs-s"><SelectValue /></SelectTrigger><SelectContent>{net.sequences.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} v{x.version} {x.status}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Material" id="gs-m"><Select value={sim.mat} onValueChange={(v) => setSim({ ...sim, mat: v })}><SelectTrigger id="gs-m"><SelectValue /></SelectTrigger><SelectContent>{MATS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Quantity" id="gs-q"><Input id="gs-q" inputMode="numeric" value={sim.qty} onChange={(e) => setSim({ ...sim, qty: e.target.value })} /></Field>
              <Field label="Requested date" id="gs-d"><Input id="gs-d" type="date" value={sim.date} onChange={(e) => setSim({ ...sim, date: e.target.value })} /></Field>
            </div>
            <div><Button disabled={st.locked} onClick={runSim}>Simulate check</Button></div>
            {sqSel && <p className="text-xs text-muted-foreground">{sqSel.group} for {sqSel.customerClass}: {sqSel.steps.join(", then ")}.</p>}
            {res ? <WalkView net={net} w={res} /> : <Empty>Run a sample check to see each step accepted or rejected, and why.</Empty>}
          </div>
        )}
      </ConfigPage>
      <DialogShell open={dlg} onOpenChange={setDlg} title="New check sequence draft" confirmLabel="Create draft" onConfirm={create} consequence="Creates a draft with the next version number for this group and class. It does not apply until released and its effective date arrives." wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Material group" id="gn-g"><Select value={f.group} onValueChange={(v) => setF({ ...f, group: v })}><SelectTrigger id="gn-g"><SelectValue /></SelectTrigger><SelectContent>{GROUP_LIST.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Customer class" id="gn-c"><Select value={f.cls} onValueChange={(v) => setF({ ...f, cls: v as typeof f.cls })}><SelectTrigger id="gn-c"><SelectValue /></SelectTrigger><SelectContent>{CUSTOMER_CLASSES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></Field>
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium">Ordered walk</p>
            <ul className="flex flex-col gap-1">{ALL_STEPS.map((t) => { const i = f.steps.indexOf(t); return (
              <li key={t} className="flex items-center gap-2 text-sm"><Checkbox aria-label={`Use ${t}`} checked={i >= 0} onCheckedChange={(v) => setF({ ...f, steps: v ? [...f.steps, t] : f.steps.filter((x) => x !== t) })} />{i >= 0 ? `${i + 1}. ` : ""}{t}
                {i >= 0 && <><Button size="sm" variant="ghost" aria-label={`Move ${t} up`} onClick={() => move(i, -1)}>Up</Button><Button size="sm" variant="ghost" aria-label={`Move ${t} down`} onClick={() => move(i, 1)}>Down</Button></>}</li>) })}</ul>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.purchase} onCheckedChange={(v) => setF({ ...f, purchase: v })} />Policy allows purchase lead time</label>
          <Field label="Effective from" id="gn-e"><Input id="gn-e" type="date" value={f.eff} onChange={(e) => setF({ ...f, eff: e.target.value })} /></Field>
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      </DialogShell>
    </>
  )
}

// ============================================================================ the network promise dialog
export interface PromiseReq { soId: string; line: number; materialId: string; qty: number; date: string; customerId: string }

/** The existing promise dialog, extended: it also shows the sourcing plant and lane, and lets sales prefer a plant where
 *  commercial terms demand it (logged). Reusable by the order screens through the shared domain. */
export function NetworkPromiseDialog({ open, onOpenChange, req, networkActive, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; req: PromiseReq; networkActive: boolean; onDone?: (msg: string) => void }) {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const [prefer, setPrefer] = useState("")
  const net = networkActive ? s.gatp : singlePlant(s.gatp)
  const cls = customerClass(req.customerId)
  const seq = sequenceFor(net, req.materialId, cls)
  const w = seq ? walk(net, seq, { materialId: req.materialId, qty: req.qty, date: req.date, today: TODAY, home: "PL-TBD-01", prefer: prefer || undefined }) : null
  const confirm = (reason: string) => {
    if (!seq || !w) return `No check sequence is released for ${MATERIAL_GROUPS[req.materialId] ?? "this material group"} and ${cls}. Configure one in GATP-SEQ-001.`
    if (!w.winner) return w.offered ? `No step meets ${fmtDate(req.date)}. The earliest offer is ${fmtDate(w.offered.offered)} from ${plantName(net, w.offered.plant)}. Back-order the line or change the requested date.` : "No step can supply this line. Back-order it."
    const win = w.winner
    const r = mutate((d) => {
      reserve(d.gatp, win.plant, req.materialId, win.step, req.qty)
      d.gatp.promises.unshift({ id: nid(d, "GP"), soId: req.soId, materialId: req.materialId, qty: req.qty, requestDate: req.date, plant: win.plant, lane: win.lane, snapshot: nextSnapshot(d.gatp), sequence: `${seq.id} v${seq.version}`, promiseDate: win.date ?? req.date, prefer: prefer ? { plant: prefer, reason } : undefined, at: "2026-10-09 14:30" })
    })
    if (r.ok) onDone?.(`Promise confirmed from ${plantName(net, win.plant)}${win.lane ? ` over ${win.lane}` : ""}`)
    return r.ok ? null : r.error
  }
  const backorder = () => {
    mutate((d) => { d.gatp.backorders.push({ id: nid(d, "BO"), soId: req.soId, line: req.line, customerId: req.customerId, prio: CUSTOMERS.find((c) => c.id === req.customerId)?.priority ?? "C", materialId: req.materialId, qty: req.qty, requestDate: req.date, home: "PL-TBD-01", status: "Backordered" }) })
    onDone?.("Line back-ordered; the global re-promise run will pick it up")
    onOpenChange(false)
  }
  return (
    <DialogShell
      open={open} onOpenChange={onOpenChange} wide title={`Promise ${req.soId}, line ${req.line}`}
      description={`${req.qty} x ${req.materialId} for ${customerName(req.customerId)}, requested ${fmtDate(req.date)}. ${networkActive ? "Network check across all plants." : "Single plant check: one plant and one implicit lane."}`}
      confirmLabel="Confirm promise" requireReason={!!prefer} reasonLabel="Why this plant (logged with the promise)" onConfirm={confirm} confirmDisabled={!w?.winner}
      consequence={w?.winner ? `Confirms a promise from ${plantName(net, w.winner.plant)}${w.winner.lane ? ` over lane ${w.winner.lane}` : ""} for ${fmtDate(w.winner.date)}, and holds a soft reservation at that plant. It decays like a local reservation.` : "No step accepts this line. You can back-order it."}
      secondary={<Button variant="outline" onClick={backorder}>Back-order</Button>}
    >
      {!seq && <p role="alert" className="text-sm text-destructive">No check sequence is released for {MATERIAL_GROUPS[req.materialId] ?? "this material group"} and {cls}.</p>}
      {w && (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4"><KV k="Sourcing plant">{w.winner ? plantName(net, w.winner.plant) : "None"}</KV><KV k="Lane">{w.winner?.lane ?? (networkActive ? "None (local)" : "Implicit lane")}</KV><KV k="Check sequence">{seq?.id} v{seq?.version}</KV><KV k="Plan snapshot">{w.winner ? "SNAP on confirm" : "Not taken"}</KV></dl>
          {networkActive && (
            <Field label="Prefer a plant (commercial terms)" id="np-p" hint="Where commercial terms demand a plant; the preference is logged with its reason.">
              <Select value={prefer || "none"} onValueChange={(v) => setPrefer(v === "none" ? "" : v)}><SelectTrigger id="np-p"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No preference</SelectItem>{s.gatp.plants.map((p) => <SelectItem key={p.id} value={p.id}>{p.city}</SelectItem>)}</SelectContent></Select>
            </Field>
          )}
          <WalkView net={net} w={w} />
          <p className="text-xs text-muted-foreground">Computed in {w.ms} ms (a single line global check must return within ten seconds).</p>
        </div>
      )}
    </DialogShell>
  )
}

export function GatpPromiseDialogPage() {
  const s = useSlice("targetState")
  const st = useScreenState("gatp-promise")
  const [open, setOpen] = useState<string | null>(null)
  const [net, setNet] = useState(true)
  const [note, setNote] = useState("")
  const variants: { id: string; label: string; what: string; req: PromiseReq }[] = [
    { id: "own", label: "Own plant covers it", what: "Local stock accepts at step one", req: { soId: "SO-2026-00377", line: 20, materialId: "FIN-TBD-0167PL", qty: 8, date: "2026-10-30", customerId: "CUS-TBD-0027" } },
    { id: "partner", label: "Partner plant and lane", what: "Own stock short; the Regina plant covers it over a lane", req: { soId: "SO-2026-00355", line: 10, materialId: "FIN-TBD-2500PM", qty: 3, date: "2026-10-30", customerId: "CUS-TBD-0031" } },
    { id: "price", label: "Transfer price expired", what: "A cross entity step rejected: the transfer price is not valid", req: { soId: "SO-2026-00362", line: 20, materialId: "FIN-TBD-1000PM", qty: 8, date: "2026-10-14", customerId: "CUS-TBD-0027" } },
    { id: "none", label: "No step accepts", what: "Capacity cannot meet the date; back-order", req: { soId: "SO-2026-00340", line: 10, materialId: "FIN-TBD-20MVA", qty: 1, date: "2026-12-01", customerId: "CUS-TBD-0017" } },
    { id: "nosq", label: "No check sequence", what: "No sequence for this group and customer class (validation)", req: { soId: "SO-2026-00358", line: 10, materialId: "TRADE-TBD-FCI", qty: 10, date: "2026-10-20", customerId: "CUS-TBD-0031" } },
  ]
  const cur = variants.find((v) => v.id === open)
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <div className="flex flex-col gap-4">
        <div className="mb-2 border-b pb-4"><h1 className="text-xl font-semibold">Promise dialog, extended for the network <span className="rounded-md border bg-muted px-2 font-mono text-xs text-muted-foreground">FX-GATP-PROMISE</span></h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">The existing promise dialog (Confirm, Split, Back-order) must additionally show the sourcing plant and lane, and let sales prefer a plant where commercial terms demand it, logged. This page opens it in each of its states; the same component serves the order screens.</p></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={net} onCheckedChange={setNet} aria-label="Network engine active" />Network engine active (DEC-07). Off: one plant and one implicit lane, the go-live path.</label>
        {note && <p role="status" className="rounded-md border p-3 text-sm">{note}</p>}
        {st.loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <ul className="grid gap-3 md:grid-cols-2">{variants.map((v) => <li key={v.id} className="flex flex-col gap-2 rounded-lg border p-4"><span className="font-medium">{v.label}</span><span className="text-sm text-muted-foreground">{v.what}</span><span className="text-xs">{v.req.qty} x {v.req.materialId}, requested {fmtDate(v.req.date)}</span><div><Button variant="outline" disabled={st.locked} onClick={() => { const g = st.guard(); if (g) return st.setMsg(g); setOpen(v.id) }}>Open the dialog</Button></div></li>)}</ul>
        )}
        <Section title={`Promises recorded in this session (${s.gatp.promises.length})`}>
          {s.gatp.promises.length === 0 ? <Empty>No promise yet. Confirm one from the dialog.</Empty> : (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Promise</TableHead><TableHead>Order</TableHead><TableHead>Plant</TableHead><TableHead>Lane</TableHead><TableHead>Snapshot</TableHead><TableHead>Sequence</TableHead><TableHead>Promise date</TableHead><TableHead>Preference</TableHead></TableRow></TableHeader>
              <TableBody>{s.gatp.promises.map((p) => <TableRow key={p.id}><TableCell className="font-mono">{p.id}</TableCell><TableCell>{p.soId}</TableCell><TableCell>{plantName(s.gatp, p.plant)}</TableCell><TableCell>{p.lane ?? "Local"}</TableCell><TableCell className="font-mono">{p.snapshot}</TableCell><TableCell>{p.sequence}</TableCell><TableCell>{fmtDate(p.promiseDate)}</TableCell><TableCell className="text-xs">{p.prefer ? `${plantName(s.gatp, p.prefer.plant)}: ${p.prefer.reason}` : "None"}</TableCell></TableRow>)}</TableBody></Table>
          )}
        </Section>
      </div>
      {cur && <NetworkPromiseDialog open onOpenChange={(o) => !o && setOpen(null)} req={cur.req} networkActive={net} onDone={setNote} />}
    </>
  )
}

// ============================================================================ simulator
export function GatpSimulator() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("gatp-sim", { degraded: "The plan snapshot is 47 minutes old: the capacity slots may have moved. The walk uses the last good snapshot." })
  const net = s.gatp
  const [f, setF] = useState({ mat: "FIN-TBD-2500PM", qty: "3", date: "2026-10-30", cust: "CUS-TBD-0031", prefer: "", reason: "" })
  const [w, setW] = useState<WalkResult | null>(null)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const stocks = net.stocks.filter((x) => x.materialId === f.mat)
  type StockRow = (typeof stocks)[number]
  const cls = customerClass(f.cust)
  const seq = sequenceFor(net, f.mat, cls)
  const check = () => st.run(() => {
    const qty = Number(f.qty)
    if (!Number.isFinite(qty) || qty <= 0) return "Quantity must be greater than zero."
    if (!seq) return `No released check sequence for ${MATERIAL_GROUPS[f.mat]} and ${cls}. Configure one in GATP-SEQ-001.`
    if (f.prefer && !f.reason.trim()) return "Preferring a plant needs a reason: it is logged."
    setW(walk(net, seq, { materialId: f.mat, qty, date: f.date, today: TODAY, home: "PL-TBD-01", prefer: f.prefer || undefined }))
  })
  const record = () => st.run(() => {
    if (!w?.winner || !seq) return "Run a check that accepts a step first."
    const win = w.winner
    const r = mutate((d) => {
      reserve(d.gatp, win.plant, f.mat, win.step, Number(f.qty))
      d.gatp.promises.unshift({ id: nid(d, "GP"), soId: "Simulated", materialId: f.mat, qty: Number(f.qty), requestDate: f.date, plant: win.plant, lane: win.lane, snapshot: nextSnapshot(d.gatp), sequence: `${seq.id} v${seq.version}`, promiseDate: win.date ?? f.date, prefer: f.prefer ? { plant: f.prefer, reason: f.reason } : undefined, at: "2026-10-09 14:30" })
    })
    if (!r.ok) return r.error
    setW(null)
    return { ok: "Promise recorded with a soft reservation at the sourcing plant" }
  })
  const cols: Column<StockRow>[] = [
    { id: "p", header: "Plant", value: (x) => plantName(net, x.plantId) },
    { id: "oh", header: "On hand", align: "right", value: (x) => x.onHand },
    { id: "rs", header: "Reserved", align: "right", value: (x) => x.reserved },
    { id: "av", header: "Available", align: "right", value: (x) => availOf(x), cell: (x) => <span className="font-semibold">{availOf(x)}</span> },
    { id: "in", header: "Inbound", value: (x) => x.inbound.map((i) => `${i.qty} on ${i.date}`).join("; "), cell: (x) => (x.inbound.length ? x.inbound.map((i) => `${i.qty} on ${fmtDate(i.date)}`).join("; ") : "None") },
    { id: "sl", header: "Capacity slots", value: (x) => x.slots.map((i) => `${i.qty} on ${i.date}`).join("; "), cell: (x) => (!x.validVersion ? <Tag family="blocked" label="No valid production version" /> : x.slots.filter((i) => i.qty > 0).length ? x.slots.filter((i) => i.qty > 0).map((i) => `${i.qty} on ${fmtDate(i.date)}`).join("; ") : "None") },
    { id: "ln", header: "Lane to the home plant", value: (x) => net.lanes.find((l) => l.from === x.plantId && l.to === "PL-TBD-01")?.id ?? "", cell: (x) => { const l = net.lanes.find((q) => q.from === x.plantId && q.to === "PL-TBD-01"); return l ? `${l.id}, ${l.transitDays} d${l.crossEntity ? `, transfer price to ${fmtDate(l.transferPriceValidTo)}` : ""}` : "Home plant" } },
  ]
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{
          title: "Global availability cockpit", screenId: "GATP-SIM-001",
          description: "One material across all plants: stock, inbound, capacity slots and lanes, then the walk of the check sequence with each step accepted or rejected, and why.",
          primary: <Button disabled={st.locked} onClick={check}>Run global check</Button>,
          actions: <Button variant="outline" disabled={st.locked || !w?.winner} onClick={record}>Record promise (soft reservation)</Button>,
          children: (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Field label="Material" id="sm-m"><Select value={f.mat} onValueChange={(v) => { setF({ ...f, mat: v }); setW(null) }}><SelectTrigger id="sm-m"><SelectValue /></SelectTrigger><SelectContent>{MATS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Quantity" id="sm-q"><Input id="sm-q" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
                <Field label="Requested date" id="sm-d"><Input id="sm-d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
                <Field label="Customer" id="sm-c" hint={`Class: ${cls}`}><Select value={f.cust} onValueChange={(v) => setF({ ...f, cust: v })}><SelectTrigger id="sm-c"><SelectValue /></SelectTrigger><SelectContent>{CUSTOMERS.filter((c) => c.status === "Active").map((c) => <SelectItem key={c.id} value={c.id}>{c.name.slice(0, 40)}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Prefer a plant" id="sm-p"><Select value={f.prefer || "none"} onValueChange={(v) => setF({ ...f, prefer: v === "none" ? "" : v })}><SelectTrigger id="sm-p"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No preference</SelectItem>{net.plants.map((p) => <SelectItem key={p.id} value={p.id}>{p.city}</SelectItem>)}</SelectContent></Select></Field>
                {f.prefer && <Field label="Reason (logged)" id="sm-r"><Input id="sm-r" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>}
              </div>
              <p className="text-sm text-muted-foreground">{seq ? `Check sequence ${seq.id} v${seq.version}: ${seq.steps.join(", then ")}.` : `No released sequence for ${MATERIAL_GROUPS[f.mat]} and ${cls}.`}</p>
              {w && (
                <Section title={w.winner ? `Accepted: ${plantName(net, w.winner.plant)}${w.winner.lane ? ` over ${w.winner.lane}` : ""}, ${fmtDate(w.winner.date)}` : w.offered ? `No step meets the date. Earliest offer ${fmtDate(w.offered.offered)} from ${plantName(net, w.offered.plant)}` : "No step can supply this line"}>
                  <WalkView net={net} w={w} />
                  <p className="text-xs text-muted-foreground">Computed in {w.ms} ms against the ten second budget. Soft reservations hold stock and capacity at the sourcing plant and decay like local reservations.</p>
                </Section>
              )}
            </div>
          ),
        }}
        kpis={[{ label: "Plants", value: net.plants.length, hint: "Two plant configuration" }, { label: "Lanes", value: net.lanes.length }, { label: "Network available", value: stocks.reduce((a, x) => a + Math.max(0, availOf(x)), 0), hint: f.mat }, { label: "Promises recorded", value: net.promises.length }]}
        table={{ rows: st.rows(stocks), columns: cols, rowId: (x) => x.plantId, onRowClick: (x) => setOpenRow(x.plantId), activeId: openRow ?? undefined, loading: st.loading, empty: { title: "No stock record for this material", body: "No plant holds a record for the material." } }}
      />
      <p className="mt-4 text-sm"><Link className="text-link underline" to="/target/gatp/promise-dialog">See the extended promise dialog</Link> · <Link className="text-link underline" to="/target/gatp/backorders">Global backorders</Link></p>
      <RulesPanel rules={[["GATP-1", "Every step of the walk respects the availability definition already binding.", "Book IX §3.1"], ["GATP-2", "Cross entity steps respect intercompany pairing rules, including transfer price validity.", "Book IX §3.1"], ["GATP-3", "The promise record names the sourcing plant, the lane, the plan snapshot and the check sequence version.", "Book IX §3.1"], ["GATP-4", "A single line global check returns within ten seconds.", "Book IX §3.1"]]} />
    </>
  )
}

// ============================================================================ backorders
export function GatpBackorders() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("gatp-bo", { degraded: "Planning has not published this cycle's snapshot yet. The re-promise run would use last cycle's snapshot; it is disabled until the new one arrives." })
  const [queue, setQueue] = useState("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const net = s.gatp
  const rows = net.backorders
  const shown = queue === "open" ? rows.filter((b) => b.status === "Backordered") : queue === "done" ? rows.filter((b) => b.status === "Re-promised") : queue === "realloc" ? rows.filter((b) => b.status === "Reallocation proposed") : rows
  const bo = rows.find((b) => b.id === openId)
  const runAll = () => st.run(() => {
    const open = rows.filter((b) => b.status === "Backordered" || b.status === "Reallocation proposed")
    if (open.length === 0) return "No backorder is open: nothing to re-promise."
    const r = mutate((d) => {
      const snap = nextSnapshot(d.gatp)
      const order = d.gatp.backorders.filter((b) => b.status !== "Re-promised").sort((a, b) => (a.prio === b.prio ? a.requestDate.localeCompare(b.requestDate) : a.prio.localeCompare(b.prio)))
      let done = 0, prop = 0
      for (const b of order) {
        const cls = customerClass(b.customerId)
        const seq = sequenceFor(d.gatp, b.materialId, cls)
        const w = seq ? walk(d.gatp, seq, { materialId: b.materialId, qty: b.qty, date: b.requestDate, today: TODAY, home: b.home }) : null
        if (w?.winner) {
          reserve(d.gatp, w.winner.plant, b.materialId, w.winner.step, b.qty)
          Object.assign(b, { status: "Re-promised", plant: w.winner.plant, lane: w.winner.lane, promiseDate: w.winner.date, snapshot: snap })
          done++
        } else if (b.realloc) { b.status = "Reallocation proposed"; b.snapshot = snap; prop++ }
        else b.snapshot = snap
      }
      d.gatp.runs.unshift({ id: `GBR-TBD-${String(d.gatp.runs.length + 1).padStart(3, "0")}`, at: "2026-10-09 14:30", snapshot: snap, repromised: done, remaining: order.length - done - prop, proposed: prop })
    })
    return r.ok ? { ok: "Global re-promise run finished, priority classes honored across the network" } : r.error
  })
  const cols: Column<GBackorder>[] = [
    { id: "id", header: "Backorder", value: (b) => b.id, mono: true },
    { id: "so", header: "Order / line", value: (b) => `${b.soId} / ${b.line}`, cell: (b) => <Link className="text-link underline" to={`/sales/orders/${b.soId}`}>{b.soId} / {b.line}</Link> },
    { id: "c", header: "Customer", value: (b) => customerName(b.customerId).slice(0, 34), filterable: true },
    { id: "pr", header: "Priority class", value: (b) => b.prio, filterable: true, sortable: true },
    { id: "m", header: "Item", value: (b) => b.materialId, mono: true },
    { id: "q", header: "Qty", align: "right", value: (b) => b.qty },
    { id: "rd", header: "Requested", value: (b) => b.requestDate, sortable: true, cell: (b) => fmtDate(b.requestDate) },
    { id: "s", header: "State", value: (b) => b.status, filterable: true, cell: (b) => (b.status === "Re-promised" ? <Tag family="done" label="Re-promised" /> : b.status === "Reallocation proposed" ? <Tag family="pending" label="Reallocation proposed" /> : <Chip kind="backorder" />) },
    { id: "pl", header: "Sourcing plant", value: (b) => b.plant ?? "", cell: (b) => (b.plant ? plantName(net, b.plant) : "-") },
    { id: "ln", header: "Lane", value: (b) => b.lane ?? "", cell: (b) => b.lane ?? (b.plant ? "Local" : "-") },
    { id: "pd", header: "New promise", value: (b) => b.promiseDate ?? "", cell: (b) => (b.promiseDate ? fmtDate(b.promiseDate) : "-") },
  ]
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{ title: "Backorder workbench: network delta", screenId: "FX-GATP-BACKORDER", description: "A global backorder run re-promises across the network after every planning cycle, honoring priority classes globally. Reallocation between plants needs the same approvals as reallocation between orders. The sourcing plant, lane and snapshot are added to each row.", primary: <Button disabled={st.locked || st.state === "degraded"} onClick={runAll}>Run global re-promise</Button> }}
        kpis={[{ label: "Open backorders", value: rows.filter((b) => b.status === "Backordered").length }, { label: "Re-promised", value: rows.filter((b) => b.status === "Re-promised").length }, { label: "Reallocation proposed", value: rows.filter((b) => b.status === "Reallocation proposed").length, hint: "Waiting for approval" }, { label: "Runs", value: net.runs.length, hint: net.runs[0] ? `last ${net.runs[0].snapshot}` : "None yet" }]}
        queues={[{ id: "all", label: "All", count: rows.length }, { id: "open", label: "Open", count: rows.filter((b) => b.status === "Backordered").length }, { id: "realloc", label: "Reallocation", count: rows.filter((b) => b.status === "Reallocation proposed").length }, { id: "done", label: "Re-promised", count: rows.filter((b) => b.status === "Re-promised").length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows: st.rows(shown), columns: cols, rowId: (b) => b.id, onRowClick: (b) => setOpenId(b.id), activeId: openId ?? undefined, searchText: (b) => `${b.id} ${b.soId} ${b.materialId}`, loading: st.loading, empty: { title: "No backorder in this queue", body: "Re-promised lines leave the open queue." } }}
        panel={{ open: !!bo, onOpenChange: (o) => !o && setOpenId(null), title: bo?.id ?? "", description: bo ? `${bo.soId} line ${bo.line}, priority class ${bo.prio}` : undefined,
          content: bo && (
            <div className="flex flex-col gap-3 text-sm">
              <dl className="grid grid-cols-2 gap-3"><KV k="Item">{bo.materialId}</KV><KV k="Quantity">{bo.qty}</KV><KV k="Sourcing plant">{bo.plant ? plantName(net, bo.plant) : "None yet"}</KV><KV k="Lane">{bo.lane ?? "None"}</KV><KV k="Plan snapshot">{bo.snapshot ?? "None"}</KV><KV k="New promise">{bo.promiseDate ? fmtDate(bo.promiseDate) : "None"}</KV></dl>
              {bo.realloc && <div className="rounded-md border p-3"><p>Only supply: {plantName(net, bo.realloc.plant)} stock reserved for {bo.realloc.soId}. Taking it is a reallocation of confirmed supply between plants and needs the same approval as between orders.</p>
                <div className="mt-2"><ApprovalButton kind="Reallocation of confirmed supply" subject={{ type: "salesOrder", id: bo.realloc.soId }} title={`Reallocate supply from ${bo.realloc.soId} to ${bo.soId}`} label="Request reallocation approval" stay disabled={st.locked} /></div></div>}
            </div>
          ) }}
      />
      {net.runs.length > 0 && <Section title="Global re-promise runs"><Table><TableHeader className="bg-table-head"><TableRow><TableHead>Run</TableHead><TableHead>At</TableHead><TableHead>Snapshot</TableHead><TableHead className="text-right">Re-promised</TableHead><TableHead className="text-right">Reallocation proposed</TableHead><TableHead className="text-right">Still open</TableHead></TableRow></TableHeader><TableBody>{net.runs.map((r) => <TableRow key={r.id}><TableCell className="font-mono">{r.id}</TableCell><TableCell>{r.at}</TableCell><TableCell className="font-mono">{r.snapshot}</TableCell><TableCell className="tabular text-right">{r.repromised}</TableCell><TableCell className="tabular text-right">{r.proposed}</TableCell><TableCell className="tabular text-right">{r.remaining}</TableCell></TableRow>)}</TableBody></Table></Section>}
      <RulesPanel rules={[["GATP-5", "The global backorder run re-promises across the network after every planning cycle, honoring priority classes globally.", "Book IX §3.1"], ["GATP-6", "Reallocation between plants demands the same approvals as reallocation between orders.", "Book IX §3.1"], ["GATP-7", "Substitution across plants follows approved alternates only.", "Book IX §3.1"]]} />
    </>
  )
}
