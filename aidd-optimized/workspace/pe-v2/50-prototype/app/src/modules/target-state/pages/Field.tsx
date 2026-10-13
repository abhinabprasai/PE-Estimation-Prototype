// SVO-001 service orders, DSP-BOARD-001 dispatch board, FX-FSM-MOBILE mobile execution set, FX-FSM-VAN van stock replenishment,
// FX-FSM-CONTRACTS service contracts and technician resources [Book IX §7]. Field work gets its own order, dispatch and stock,
// settles through the same accounts and writes the same genealogy as the plant. Entitlement reads contracts before warranty and
// is stamped at creation with its rule trail; it is shown, never editable. A service order settles to zero open cost.

import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Chip, EmptyState, KV, RulesPanel, ScanField, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, KioskFact, KioskPage, ListPage, WorkbenchPage } from "@/components/templates"
import { CUSTOMERS, MATERIALS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Field, Loading, Tag, TargetFrame, useScreenState } from "../components"
import { COST_RATE, SERVICE_RATE, SERVICE_TYPES, SVO_PATH, WARRANTY_MONTHS, WARRANTY_RESERVE, costOf, entitle, hrsOf, openCost, slaRemainingHrs, travelMin, weekdays, type Contract, type Svo, type Tech, type VanLine } from "../data/field"
import { DAY_CAPACITY_H, advance, assign, checkAssign, consumePart, nextOf, quoteFor, reserveUsed, svoFamily, triage } from "../fieldOps"
import { customerName, matDesc, money, nid } from "../lib"

const DECISION = "Full field service management is a Book IX target-state module (Book IX §7)"
const EVIDENCE = "ten field orders end to end across warranty, contract and billable cases, entitlement priced correctly, genealogy continuity audited, van stock counts clean"
const SVO_NOTE = "Service order status path is the PRD's (Book IX §7.1); the S-1..S-43 catalog has no list for it, so the status family is a reading"
const TODAY = "2026-10-09"
const sla = (v: Svo) => { const h = slaRemainingHrs(v); return h < 0 ? `${Math.abs(h)} h overdue` : `${h} h left` }
const slaTone = (v: Svo) => (slaRemainingHrs(v) < 0 ? "exception" : slaRemainingHrs(v) < 4 ? "pending" : "done") as "exception" | "pending" | "done"
const basisFamily = (b: Svo["entitlement"]["basis"]) => (b === "Contract" ? "done" : b === "Warranty" ? "active" : "pending")
const certState = (exp: string) => (exp < TODAY ? "expired" : exp < "2026-12-08" ? "soon" : "ok")
const SKILLS = ["HV bushing replacement", "Tap changer service", "Leak and radiator repair", "Oil handling", "Electrical test"]

// ============================================================================ list
export function ServiceOrders() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("svo-list", { validation: "Validation: choose the customer and a serial from their installed base, describe the problem, and add at least one task with a skill and hours." })
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ customerId: "", serial: "", service: SERVICE_TYPES[0], problem: "", task: "", skill: SKILLS[0], hrs: "2" })
  const [err, setErr] = useState<Record<string, string>>({})
  const fl = s.field
  const custs = [...new Set(fl.units.map((u) => u.customerId))]
  const units = fl.units.filter((u) => u.customerId === f.customerId)
  const preview = f.customerId && f.serial ? entitle(fl, f.customerId, f.serial, f.service, TODAY) : null
  const cols: Column<Svo>[] = [
    { id: "id", header: "Service order", value: (v) => v.id, mono: true, sortable: true },
    { id: "cust", header: "Customer", value: (v) => customerName(v.customerId), sortable: true, filterable: true },
    { id: "serial", header: "Installed base serial", value: (v) => v.serial, mono: true },
    { id: "problem", header: "Problem", value: (v) => v.problem },
    { id: "ent", header: "Entitlement", value: (v) => v.entitlement.basis, filterable: true, cell: (v) => <Tag family={basisFamily(v.entitlement.basis)} label={v.entitlement.basis} /> },
    { id: "cls", header: "Priority class", value: (v) => v.cls, filterable: true },
    { id: "status", header: "Status", value: (v) => SVO_PATH.indexOf(v.status), sortable: true, filterable: false, cell: (v) => <Tag family={svoFamily(v.status)} label={v.status} /> },
    { id: "sla", header: "Response clock", value: (v) => slaRemainingHrs(v), sortable: true, cell: (v) => (["New", "Triaged"].includes(v.status) ? <Tag family={slaTone(v)} label={sla(v)} /> : <span className="text-muted-foreground">Responded</span>) },
  ]
  const create = () => {
    const e: Record<string, string> = {}
    if (!f.customerId) e.customerId = "Choose a customer."
    if (!f.serial) e.serial = "Choose the installed base serial."
    if (!f.problem.trim()) e.problem = "Describe the problem."
    if (!f.task.trim()) e.task = "Add the first task."
    const h = Number(f.hrs)
    if (!(h > 0 && h <= 40)) e.hrs = "Planned hours between 0.5 and 40."
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => {
      const u = d.field.units.find((x) => x.serial === f.serial)!
      const ent = entitle(d.field, f.customerId, f.serial, f.service, TODAY)
      const c = ent.basis === "Contract" ? d.field.contracts.find((x) => x.id === ent.ref) : undefined
      d.field.seq += 1
      d.field.svos.push({ id: nid(d, "SVO").replace(/-\d+$/, `-${String(d.field.seq).padStart(4, "0")}`), customerId: f.customerId, ibId: u.id, serial: u.serial, site: u.site, region: u.region, problem: f.problem.trim(), service: f.service, entitlement: { ...ent, stampedAt: "2026-10-09 14:30" }, cls: c?.cls ?? "Standard", responseHrs: c?.responseHrs ?? 72, status: "New", tasks: [{ text: f.task.trim(), skill: f.skill, hrs: h, done: false }], parts: [], hoursLogged: 0, km: 0, createdAt: "2026-10-09 14:30", settledAmount: 0, findings: [], t12: [] })
    })
    if (!r.ok) return r.error
    setF({ ...f, problem: "", task: "" })
    return null
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ListPage
        header={{ title: "Service orders", screenId: "SVO-001", description: "Work at the customer site: installed base serial, problem, entitlement verdict with its rule trail stamped at creation, priority from the contract response class, tasks with skills.", chips: <Chip kind="oq" id="OQ-18" note={SVO_NOTE} />, primary: <Button disabled={st.locked} onClick={() => { setErr({}); setOpen(true) }}>New service order</Button> }}
        table={{ rows: st.rows(fl.svos), columns: cols, rowId: (v) => v.id, rowHref: (v) => `/target/field-service/orders/${v.id}`, searchText: (v) => `${v.id} ${customerName(v.customerId)} ${v.serial} ${v.problem}`, loading: st.loading, densityKey: "svo", empty: { title: "No service order yet", body: "Create one from an installed base serial." } }}
        below={<RulesPanel rules={[["FSM-1", "Entitlement reads contracts before warranty; the verdict and its rule trail are stamped at creation and never edited.", "Book IX §7.1"], ["FSM-2", "Warranty work settles against the reserve (overflow to warranty expense), contract work against the contract, everything else quotes at service rates before dispatch.", "Book IX §7.2"], ["FSM-3", "A service order settles to zero open cost, like a production order.", "Book IX §7.2"]]} />}
      />
      <DialogShell open={open} onOpenChange={setOpen} title="New service order" description="The entitlement service is called when you create the order. Its verdict is stamped and cannot be changed afterwards." confirmLabel="Create order" onConfirm={create} wide
        consequence={preview ? `Entitlement will be stamped: ${preview.basis}${preview.ref ? ` (${preview.ref})` : ""}. ${preview.basis === "Billable" ? `Quote at service rates (${money(SERVICE_RATE)} per hour) before dispatch.` : preview.basis === "Warranty" ? "Settles against the warranty reserve." : "Settles against the contract."}` : "Choose a customer and serial to see the entitlement verdict."}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer" id="so-c" error={err.customerId}><Select value={f.customerId} onValueChange={(v) => setF({ ...f, customerId: v, serial: "" })}><SelectTrigger id="so-c"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{custs.map((c) => <SelectItem key={c} value={c}>{customerName(c).slice(0, 44)}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Installed base serial" id="so-s" error={err.serial}><Select value={f.serial} onValueChange={(v) => setF({ ...f, serial: v })} disabled={!f.customerId}><SelectTrigger id="so-s"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.serial}>{u.serial}, {u.site}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Service" id="so-t"><Select value={f.service} onValueChange={(v) => setF({ ...f, service: v })}><SelectTrigger id="so-t"><SelectValue /></SelectTrigger><SelectContent>{SERVICE_TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Problem" id="so-p" error={err.problem}><Input id="so-p" value={f.problem} onChange={(e) => setF({ ...f, problem: e.target.value })} /></Field>
          <Field label="First task" id="so-k" error={err.task}><Input id="so-k" value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Skill needed" id="so-sk"><Select value={f.skill} onValueChange={(v) => setF({ ...f, skill: v })}><SelectTrigger id="so-sk"><SelectValue /></SelectTrigger><SelectContent>{SKILLS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><Field label="Planned hours" id="so-h" error={err.hrs}><Input id="so-h" inputMode="decimal" value={f.hrs} onChange={(e) => setF({ ...f, hrs: e.target.value })} /></Field></div>
        </div>
        {preview && <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{preview.trail.map((t) => <li key={t}>{t}</li>)}</ul>}
      </DialogShell>
    </>
  )
}

// ============================================================================ detail
export function ServiceOrderDetail() {
  const { id } = useParams()
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("svo-detail", { validation: "Validation: the next step has a precondition (see the message when you press it)." })
  const [sign, setSign] = useState("")
  const [appr, setAppr] = useState<null | "Written" | "Portal">(null)
  const [sch, setSch] = useState({ techId: "", date: weekdays[0], startHr: "8" })
  const [pendingPart, setPendingPart] = useState("")
  const v = s.field.svos.find((x) => x.id === id)
  if (!v) return <EmptyState title="Service order not found">No service order has id {id}. <Link className="text-link underline" to="/target/field-service/orders">Back to service orders</Link></EmptyState>
  const tech = s.field.techs.find((t) => t.id === v.techId)
  const cost = costOf(v)
  const next = nextOf(v.status)
  const doMut = (fn: (d: Parameters<Parameters<typeof mutate>[0]>[0]) => void, ok: string) => st.run(() => { const r = mutate(fn); return r.ok ? { ok } : r.error })
  const check = sch.techId ? checkAssign(s.field, v, s.field.techs.find((t) => t.id === sch.techId)!, sch.date) : null
  const stepLabel = !next ? undefined : next === "Triaged" ? "Triage (call entitlement)" : next === "Scheduled" ? undefined : next === "Dispatched" ? "Dispatch" : next === "On Site" ? "Arrive on site" : next === "Work Complete" ? "Complete work" : next === "Customer Signed" ? "Record signature" : next === "Settled" ? "Settle" : "Close order"
  const header = (
    <>
      <Tag family={svoFamily(v.status)} label={v.status} /> <Tag family={basisFamily(v.entitlement.basis)} label={`Entitlement: ${v.entitlement.basis}`} /> <Chip kind="oq" id="OQ-18" note={SVO_NOTE} />
    </>
  )
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DetailPage
        header={{
          title: `${v.id}: ${v.problem}`, screenId: "SVO-001", crumbs: [{ label: "Service orders", to: "/target/field-service/orders" }, { label: v.id }], chips: header,
          description: `${customerName(v.customerId)}, ${v.site}. Created ${v.createdAt}, response class ${v.cls} (${v.responseHrs} h).`,
          primary: stepLabel ? <Button disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => advance(d, v.id, sign)); return r.ok ? { ok: `${v.id} is now ${next}` } : r.error })}>{stepLabel}</Button> : undefined,
          actions: <>
            {v.status === "Triaged" && v.entitlement.basis === "Billable" && !v.quote?.approved && <Button variant="outline" disabled={st.locked} onClick={() => setAppr("Written")}>Record customer approval</Button>}
            {!v.rmaId && !["Settled", "Closed"].includes(v.status) && <Button variant="outline" disabled={st.locked} onClick={() => doMut((d) => { const x = d.field.svos.find((q) => q.id === v.id)!; d.field.seq += 1; x.rmaId = `RMA-TBD-${String(3000 + d.field.seq).padStart(4, "0")}` }, "RMA raised: the unit returns to the plant, linked both ways")}>Raise RMA: unit must return</Button>}
          </>,
        }}
        summary={<><KV k="Serial">{v.serial}</KV><KV k="Technician">{tech ? `${tech.name}${v.date ? `, ${fmtDate(v.date)} ${String(v.startHr ?? 8).padStart(2, "0")}:00` : ""}` : "Not assigned"}</KV><KV k="Response clock">{["New", "Triaged"].includes(v.status) ? sla(v) : "Responded"}</KV><KV k="Open cost">{money(openCost(v), 2)}</KV></>}
        tabs={[
          { id: "ent", label: "Entitlement", content: (
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              <p className="text-base font-semibold">Verdict: {v.entitlement.basis}{v.entitlement.ref ? ` (${v.entitlement.ref})` : ""} <Chip kind="design" note="Immutable">Stamped {v.entitlement.stampedAt}, read-only</Chip></p>
              <ol className="list-decimal space-y-1 pl-5">{v.entitlement.trail.map((t) => <li key={t}>{t}</li>)}</ol>
              <p className="text-muted-foreground">Contracts are read before warranty (warranty term {WARRANTY_MONTHS} months is a design value). The verdict is never recomputed; a wrong verdict is fixed by a new order, not an edit.</p>
              {v.quote && <div className="rounded-lg border p-3"><p className="font-medium">Quote at service rates: {money(v.quote.amount)} {v.quote.approved ? <Tag family="done" label={`Approved, ${v.quote.via?.toLowerCase()}`} /> : <Tag family="pending" label="Awaiting customer approval" />}</p><p className="text-xs text-muted-foreground">{money(SERVICE_RATE)} per hour is a design value. Dispatch is blocked until the customer approves in writing or in the portal.</p></div>}
            </div>
          ) },
          { id: "tasks", label: "Tasks and parts", count: v.tasks.length, content: (
            <div className="flex flex-col gap-3">
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Task</TableHead><TableHead>Skill</TableHead><TableHead className="text-right">Planned h</TableHead><TableHead>Done</TableHead></TableRow></TableHeader>
                <TableBody>{v.tasks.map((t, i) => <TableRow key={i}><TableCell>{t.text}</TableCell><TableCell>{t.skill}</TableCell><TableCell className="tabular text-right">{t.hrs}</TableCell><TableCell><Checkbox aria-label={`Task ${i + 1} done`} checked={t.done} disabled={st.locked || !["On Site", "Dispatched"].includes(v.status)} onCheckedChange={(c) => doMut((d) => { d.field.svos.find((q) => q.id === v.id)!.tasks[i].done = !!c }, "Task updated")} /></TableCell></TableRow>)}</TableBody></Table>
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Planned part</TableHead><TableHead className="text-right">Planned</TableHead><TableHead className="text-right">Used</TableHead></TableRow></TableHeader>
                <TableBody>{v.parts.length === 0 ? <TableRow><TableCell colSpan={3} className="text-muted-foreground">No part planned.</TableCell></TableRow> : v.parts.map((p) => <TableRow key={p.materialId}><TableCell>{p.materialId} {matDesc(p.materialId)}</TableCell><TableCell className="tabular text-right">{p.qty}</TableCell><TableCell className="tabular text-right">{p.used}</TableCell></TableRow>)}</TableBody></Table>
              {!["Settled", "Closed"].includes(v.status) && <div className="flex items-end gap-2"><Field label="Plan a part" id="pp"><Select value={pendingPart} onValueChange={setPendingPart}><SelectTrigger id="pp" className="w-80"><SelectValue placeholder="Choose a spare" /></SelectTrigger><SelectContent>{MATERIALS.filter((m) => m.type === "SPARE").map((m) => <SelectItem key={m.id} value={m.id}>{m.id} {m.description.slice(0, 40)}</SelectItem>)}</SelectContent></Select></Field>
                <Button variant="outline" disabled={st.locked || !pendingPart} onClick={() => doMut((d) => { const x = d.field.svos.find((q) => q.id === v.id)!; const p = x.parts.find((q) => q.materialId === pendingPart); if (p) p.qty += 1; else x.parts.push({ materialId: pendingPart, qty: 1, used: 0 }); if (x.quote && !x.quote.approved) x.quote.amount = quoteFor(x) }, "Part planned")}>Add</Button></div>}
            </div>
          ) },
          { id: "sched", label: "Schedule", content: (
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              <p>{tech ? `Assigned to ${tech.name} on ${fmtDate(v.date)}.` : "Not scheduled."} Scheduling respects skills, territory and travel and reserves technician capacity like a work center slot. The dispatch board does the same by lane.</p>
              {["New", "Triaged", "Scheduled"].includes(v.status) ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Technician" id="sc-t"><Select value={sch.techId} onValueChange={(x) => setSch({ ...sch, techId: x })}><SelectTrigger id="sc-t"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{s.field.techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.status === "On leave" ? " (on leave)" : ""}</SelectItem>)}</SelectContent></Select></Field>
                    <Field label="Day" id="sc-d"><Select value={sch.date} onValueChange={(x) => setSch({ ...sch, date: x })}><SelectTrigger id="sc-d"><SelectValue /></SelectTrigger><SelectContent>{weekdays.map((x) => <SelectItem key={x} value={x}>{fmtDate(x)}</SelectItem>)}</SelectContent></Select></Field>
                    <Field label="Start hour" id="sc-h"><Input id="sc-h" inputMode="numeric" value={sch.startHr} onChange={(e) => setSch({ ...sch, startHr: e.target.value })} /></Field>
                  </div>
                  {check && <ul className="list-disc pl-5">{check.blocks.map((b) => <li key={b} className="text-destructive">{b}</li>)}{check.warns.map((w) => <li key={w}>{w}</li>)}{!check.blocks.length && !check.warns.length && <li>Skills, territory and capacity all fit.</li>}</ul>}
                  <div><Button variant="outline" disabled={st.locked || !sch.techId} onClick={() => st.run(() => { const r = mutate((d) => assign(d, v.id, sch.techId, sch.date, Number(sch.startHr) || 8)); return r.ok ? { ok: `${v.id} scheduled` } : r.error })}>Schedule</Button></div>
                </>
              ) : <p className="text-muted-foreground">Scheduling is closed once the order is dispatched.</p>}
            </div>
          ) },
          { id: "exec", label: "Execution and genealogy", content: (
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              <dl className="grid grid-cols-3 gap-3"><KV k="Labor logged">{v.hoursLogged} h</KV><KV k="Travel">{v.km} km</KV><KV k="Photos">{v.photos ?? 0}</KV></dl>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={st.locked || v.status !== "On Site"} onClick={() => doMut((d) => { d.field.svos.find((q) => q.id === v.id)!.hoursLogged += 0.5 }, "30 minutes of labor logged")}>Log 30 minutes</Button>
                <Button size="sm" variant="outline" disabled={st.locked || !["Dispatched", "On Site"].includes(v.status)} onClick={() => doMut((d) => { const x = d.field.svos.find((q) => q.id === v.id)!; x.km += 60 }, "60 km of travel logged")}>Log 60 km travel</Button>
              </div>
              <div><p className="font-medium">Removed and installed serials (T12 events)</p>{v.t12.length === 0 ? <p className="text-muted-foreground">None recorded. Swaps write the T12 events so the as-maintained record stays true.</p> : <ul className="list-disc pl-5">{v.t12.map((t, i) => <li key={i}>Removed {t.removed}, installed {t.installed}</li>)}</ul>}</div>
              <div><p className="font-medium">Findings</p>{v.findings.length === 0 ? <p className="text-muted-foreground">No finding recorded.</p> : <ul className="list-disc pl-5">{v.findings.map((t, i) => <li key={i}>{t}</li>)}</ul>}</div>
              <p>Customer signature: {v.signedBy ?? "not yet"}. {v.status === "Work Complete" && <span className="flex items-end gap-2 pt-2"><Input aria-label="Signer name" value={sign} onChange={(e) => setSign(e.target.value)} placeholder="Name of the person signing" className="max-w-xs" /></span>}</p>
              <p className="text-muted-foreground">Every visit updates the installed base history for {v.ibId}{v.rmaId && <> and links <span className="font-mono">{v.rmaId}</span> both ways</>}.</p>
            </div>
          ) },
          { id: "cost", label: "Cost (live)", content: (
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Element</TableHead><TableHead>Basis</TableHead><TableHead className="text-right">Actual</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell>Labor</TableCell><TableCell>{v.hoursLogged} h at {money(COST_RATE)} cost rate</TableCell><TableCell className="tabular text-right">{money(cost.labor, 2)}</TableCell></TableRow>
                  <TableRow><TableCell>Parts</TableCell><TableCell>Used at standard cost, from van stock</TableCell><TableCell className="tabular text-right">{money(cost.parts, 2)}</TableCell></TableRow>
                  <TableRow><TableCell>Travel</TableCell><TableCell>{v.km} km at $0.85</TableCell><TableCell className="tabular text-right">{money(cost.travel, 2)}</TableCell></TableRow>
                  <TableRow className="font-semibold"><TableCell>Total actual cost</TableCell><TableCell /><TableCell className="tabular text-right">{money(cost.total, 2)}</TableCell></TableRow>
                  <TableRow><TableCell>Settled</TableCell><TableCell /><TableCell className="tabular text-right">{money(v.settledAmount, 2)}</TableCell></TableRow>
                  <TableRow className="font-semibold"><TableCell>Open cost</TableCell><TableCell>Must be zero to close</TableCell><TableCell className="tabular text-right">{money(openCost(v), 2)}</TableCell></TableRow>
                </TableBody></Table>
              {v.settlement ? (
                <div className="rounded-lg border p-3"><p className="font-medium">Settled to {v.settlement.origin === "Billable" ? "a service invoice" : v.settlement.origin === "Warranty" ? "the warranty reserve" : "the contract"}</p><ul className="mt-1 list-disc pl-5">{v.settlement.lines.map((l) => <li key={l.label}>{l.label}: {money(l.amount, 2)}</li>)}</ul></div>
              ) : <p className="text-muted-foreground">Settlement per origin: warranty to the reserve ({money(WARRANTY_RESERVE)} reserve, {money(WARRANTY_RESERVE - reserveUsed(s.field))} left, design values) with overflow to warranty expense; contract to contract cost; billable through a service invoice at the service revenue and service COGS accounts already defined.</p>}
            </div>
          ) },
        ]}
      />
      <DialogShell open={!!appr} onOpenChange={(o) => !o && setAppr(null)} title="Record customer approval of the quote" confirmLabel="Record approval" consequence={`Marks the ${money(v.quote?.amount ?? 0)} quote approved. Dispatch is then allowed.`}
        onConfirm={() => { const g = st.guard(); if (g) return g; const r = mutate((d) => { const x = d.field.svos.find((q) => q.id === v.id)!; if (!x.quote) x.quote = { amount: quoteFor(x), approved: false }; x.quote.approved = true; x.quote.via = appr ?? "Written" }); return r.ok ? null : r.error }}>
        <Field label="Approved how" id="ap-v"><Select value={appr ?? "Written"} onValueChange={(x) => setAppr(x as "Written" | "Portal")}><SelectTrigger id="ap-v"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Written">In writing</SelectItem><SelectItem value="Portal">In the customer portal</SelectItem></SelectContent></Select></Field>
      </DialogShell>
    </>
  )
}

// ============================================================================ dispatch board
export function DispatchBoard() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("dsp-board", { degraded: "Technician calendars last synced 47 minutes ago; capacity checks use that data.", validation: "Validation: an assignment must pass the skill, certification and capacity guardrails." })
  const [queue, setQueue] = useState("unassigned")
  const [openId, setOpenId] = useState<string | null>(null)
  const [pick, setPick] = useState({ techId: "", date: weekdays[0], startHr: "8" })
  const [dragId, setDragId] = useState<string | null>(null)
  const f = s.field
  const unassigned = f.svos.filter((v) => !v.techId && v.status !== "Closed").sort((a, b) => slaRemainingHrs(a) - slaRemainingHrs(b))
  const upcoming = f.svos.filter((v) => v.techId && ["Scheduled", "Dispatched", "On Site"].includes(v.status))
  const rows = queue === "unassigned" ? unassigned : queue === "scheduled" ? upcoming : f.svos.filter((v) => v.status !== "Closed")
  const v = f.svos.find((x) => x.id === openId)
  const check = v && pick.techId ? checkAssign(f, v, f.techs.find((t) => t.id === pick.techId)!, pick.date) : null
  const doAssign = (id: string, techId: string, date: string, hr: number) => st.run(() => {
    const x = f.svos.find((q) => q.id === id)!
    const w = checkAssign(f, x, f.techs.find((t) => t.id === techId)!, date).warns
    const r = mutate((d) => assign(d, id, techId, date, hr))
    return r.ok ? { ok: `${id} scheduled${w.length ? ` with a warning: ${w[0]}` : ""}` } : r.error
  })
  const cols: Column<Svo>[] = [
    { id: "id", header: "Service order", value: (x) => x.id, mono: true, sortable: true },
    { id: "cust", header: "Customer", value: (x) => customerName(x.customerId).slice(0, 30) },
    { id: "region", header: "Site", value: (x) => x.region, filterable: true },
    { id: "ent", header: "Entitlement", value: (x) => x.entitlement.basis, filterable: true },
    { id: "skills", header: "Skills", value: (x) => [...new Set(x.tasks.map((t) => t.skill))].join(", ") },
    { id: "status", header: "Status", value: (x) => x.status, cell: (x) => <Tag family={svoFamily(x.status)} label={x.status} /> },
    { id: "sla", header: "SLA clock", value: (x) => slaRemainingHrs(x), sortable: true, cell: (x) => (["New", "Triaged"].includes(x.status) ? <Tag family={slaTone(x)} label={`${x.cls}: ${sla(x)}`} /> : "Responded") },
    { id: "drag", header: "", cell: (x) => <span draggable={!st.locked && !x.techId} onDragStart={() => setDragId(x.id)} className="cursor-grab text-xs text-muted-foreground">{!x.techId ? "Drag to a lane" : ""}</span> },
  ]
  const lane = (t: Tech, day: string) => f.svos.filter((x) => x.techId === t.id && x.date === day && x.status !== "Closed")
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{
          title: "Field dispatch board", screenId: "DSP-BOARD-001",
          description: "Technician lanes by day, an unassigned queue with SLA clocks, assignment within skill and capacity guardrails, and travel warnings. Drag a queue row to a lane cell, or open the row and assign from the panel.",
          children: (
            <div className="overflow-x-auto"><Table aria-label="Technician lanes by day"><TableHeader className="bg-table-head"><TableRow><TableHead>Technician</TableHead>{weekdays.map((d) => <TableHead key={d}>{fmtDate(d)}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{f.techs.map((t) => (
                <TableRow key={t.id}><TableCell className="whitespace-nowrap"><div className="font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.territory.join(", ")} {t.status === "On leave" && <Chip kind="hold">On leave</Chip>}</div></TableCell>
                  {weekdays.map((d) => {
                    const items = lane(t, d)
                    const hrs = items.reduce((a, x) => a + hrsOf(x) + travelMin(t, x.region) / 60, 0)
                    return <TableCell key={d} className="min-w-36 align-top" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) { doAssign(dragId, t.id, d, 8); setDragId(null) } }}>
                      {items.map((x) => <Link key={x.id} to={`/target/field-service/orders/${x.id}`} className="mb-1 block rounded border px-2 py-1 text-xs text-link underline-offset-2 hover:underline">{x.id.slice(-4)} {x.status}{x.status === "Scheduled" && <span className="sr-only"> scheduled</span>}</Link>)}
                      <span className="text-xs text-muted-foreground">{hrs ? `${hrs.toFixed(1)} of ${DAY_CAPACITY_H} h` : "Free"}</span>
                    </TableCell>
                  })}</TableRow>))}</TableBody></Table></div>
          ),
        }}
        kpis={[{ label: "Unassigned", value: unassigned.length }, { label: "SLA breached", value: f.svos.filter((x) => ["New", "Triaged"].includes(x.status) && slaRemainingHrs(x) < 0).length, hint: "Response clock past due" }, { label: "Dispatched or on site", value: f.svos.filter((x) => ["Dispatched", "On Site"].includes(x.status)).length }, { label: "Technicians on leave", value: f.techs.filter((t) => t.status === "On leave").length }]}
        queues={[{ id: "unassigned", label: "Unassigned queue", count: unassigned.length }, { id: "scheduled", label: "Scheduled and out", count: upcoming.length }, { id: "all", label: "All open", count: f.svos.filter((x) => x.status !== "Closed").length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows: st.rows(rows), columns: cols, rowId: (x) => x.id, onRowClick: (x) => { setOpenId(x.id); setPick({ techId: x.techId ?? "", date: x.date ?? weekdays[0], startHr: String(x.startHr ?? 8) }) }, activeId: openId ?? undefined, searchText: (x) => `${x.id} ${customerName(x.customerId)} ${x.problem}`, loading: st.loading, densityKey: "dsp", empty: { title: "Queue is clear", body: "Nothing waits for a technician." } }}
        panel={{ open: !!v, onOpenChange: (o) => !o && setOpenId(null), title: v?.id ?? "", description: v ? `${v.problem}, ${v.site}` : undefined,
          content: v && (
            <div className="flex flex-col gap-4 text-sm">
              <dl className="grid grid-cols-2 gap-3"><KV k="Entitlement">{v.entitlement.basis}{v.entitlement.ref ? ` ${v.entitlement.ref}` : ""}</KV><KV k="Priority class">{v.cls} ({v.responseHrs} h)</KV><KV k="Skills">{[...new Set(v.tasks.map((t) => t.skill))].join(", ")}</KV><KV k="Planned">{hrsOf(v)} h</KV></dl>
              {v.status === "New" && <div className="rounded-md border p-3"><p>New orders are triaged before they can be scheduled.</p><div className="mt-2"><Button variant="outline" disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => triage(d, v.id)); return r.ok ? { ok: `${v.id} triaged` } : r.error })}>Triage</Button></div></div>}
              {["Triaged", "Scheduled"].includes(v.status) && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Technician" id="db-t"><Select value={pick.techId} onValueChange={(x) => setPick({ ...pick, techId: x })}><SelectTrigger id="db-t"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{f.techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></Field>
                    <Field label="Day" id="db-d"><Select value={pick.date} onValueChange={(x) => setPick({ ...pick, date: x })}><SelectTrigger id="db-d"><SelectValue /></SelectTrigger><SelectContent>{weekdays.map((x) => <SelectItem key={x} value={x}>{fmtDate(x)}</SelectItem>)}</SelectContent></Select></Field>
                    <Field label="Start" id="db-h"><Input id="db-h" inputMode="numeric" value={pick.startHr} onChange={(e) => setPick({ ...pick, startHr: e.target.value })} /></Field>
                  </div>
                  {check && <ul className="list-disc pl-5">{check.blocks.map((b) => <li key={b} className="text-destructive">{b}</li>)}{check.warns.map((w) => <li key={w}>{w}</li>)}{!check.blocks.length && !check.warns.length && <li>Skills, territory and capacity all fit.</li>}</ul>}
                  <div className="flex gap-2"><Button disabled={st.locked || !pick.techId} onClick={() => doAssign(v.id, pick.techId, pick.date, Number(pick.startHr) || 8)}>Assign</Button>
                    {v.status === "Scheduled" && <Button variant="outline" disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => advance(d, v.id)); return r.ok ? { ok: `${v.id} dispatched` } : r.error })}>Dispatch</Button>}</div>
                </>
              )}
              <Link className="text-link underline" to={`/target/field-service/orders/${v.id}`}>Open the service order</Link>
            </div>
          ) }}
      />
    </>
  )
}

// ============================================================================ mobile
export function FieldMobile() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("fsm-mobile", { auth: "Not authorized: this order is assigned to another technician.", degraded: "Weak signal: photos upload later; the order itself still saves.", readOnly: "Read-only: the day is closed for this device.", validation: "Validation: the next step needs its inputs (see the message)." })
  const [techId, setTechId] = useState("TECH-TBD-01")
  const [openId, setOpenId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [clock, setClock] = useState<string | null>(null)
  const [finding, setFinding] = useState("")
  const [sw, setSw] = useState({ removed: "", installed: "" })
  const [sig, setSig] = useState("")
  const offline = st.state === "offline"
  const tech = s.field.techs.find((t) => t.id === techId)!
  const mine = st.rows(s.field.svos.filter((v) => v.techId === techId && !["Settled", "Closed"].includes(v.status))).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
  const v = s.field.svos.find((x) => x.id === openId)
  useEffect(() => { if (!offline && s.field.queued > 0) { mutate((d) => { d.field.queued = 0 }); setMsg("Back online: queued changes sent.") } }, [offline]) // eslint-disable-line react-hooks/exhaustive-deps
  const write = (fn: (d: Parameters<Parameters<typeof mutate>[0]>[0]) => void, ok: string) => {
    setMsg(null)
    if (st.state === "authorization") return setMsg(st.opts.auth ?? "Not authorized.")
    if (st.state === "read-only") return setMsg(st.opts.readOnly ?? "Read-only.")
    if (st.state === "conflict") return setMsg("Conflict: the dispatcher changed this order while you were out of signal. Nothing was saved. Reopen the order to see the latest.")
    const r = mutate((d) => { fn(d); if (offline) d.field.queued += 1 })
    setMsg(r.ok ? `${ok}${offline ? " (kept on this device until the connection returns)" : ""}` : r.error)
  }
  const stage = v?.status
  const actions = !v
    ? [{ label: "Sync now", onClick: () => setMsg(offline ? `Still offline: ${s.field.queued} waiting.` : "Everything is sent."), primary: true }]
    : [
        stage === "Dispatched" ? { label: "Arrive on site", primary: true, onClick: () => write((d) => advance(d, v.id), "Arrived: order is On Site") }
        : stage === "On Site" ? { label: "Complete work", primary: true, onClick: () => write((d) => advance(d, v.id), "Work complete") }
        : stage === "Work Complete" ? { label: "Capture signature", primary: true, onClick: () => { if (!sig.trim()) return setMsg("The customer signs first: type the signer's name."); write((d) => advance(d, v.id, sig), "Signed by the customer") } }
        : { label: "Nothing to do now", primary: true, onClick: () => setMsg(`This order is ${stage}.`) },
        { label: "Back to my day", onClick: () => { setOpenId(null); setMsg(null) } },
      ]
  return (
    <KioskPage title="Field service" screenId="FX-FSM-MOBILE" operator={tech.name} station={tech.van} online={!offline} queued={s.field.queued} exitTo="/target/field-service/orders" actions={actions}
      banners={<div className="flex flex-col gap-2"><TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />{msg && <p role="status" className="rounded-lg border px-4 py-2 text-base">{msg}</p>}</div>}
      scan={v && ["On Site", "Dispatched"].includes(v.status) ? <ScanField scanPoint="SP-06" expected="Scan the spare part label on the van shelf" disabled={st.locked} onScan={(code) => { const r = mutate((d) => { consumePart(d, v.id, code); if (offline) d.field.queued += 1 }); return r.ok ? { ok: true, message: `${code} consumed from van stock` } : { ok: false, expected: "A spare planned on this order and stocked on your van", next: "Check the label or request a transfer", message: r.error } }} /> : undefined}>
      {st.loading ? <Loading rows={3} /> : !v ? (
        <>
          <div className="flex items-center gap-4"><span className="text-lg">My day</span>
            <Select value={techId} onValueChange={(x) => { setTechId(x); setMsg(null) }}><SelectTrigger aria-label="Technician" className="h-12 w-72 text-base"><SelectValue /></SelectTrigger><SelectContent>{s.field.techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
            <Chip kind="design">Prototype: choose the technician</Chip></div>
          {mine.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-xl">No open order for {tech.name}. {tech.status === "On leave" && "This technician is on leave."}</p> : (
            <ul className="flex flex-col gap-3">{mine.map((x) => <li key={x.id}><button className="flex min-h-16 w-full items-center gap-4 rounded-lg border px-4 py-3 text-left text-lg hover:bg-muted" onClick={() => { setOpenId(x.id); setMsg(null) }}><span className="font-mono">{x.id}</span><span className="flex-1">{x.problem}<span className="block text-base text-muted-foreground">{x.site}</span></span><span className="text-base">{x.date ? fmtDate(x.date) : ""}</span><Tag family={svoFamily(x.status)} label={x.status} /></button></li>)}</ul>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-8"><KioskFact label="Order">{v.id}</KioskFact><KioskFact label="Status">{v.status}</KioskFact><KioskFact label="Entitlement">{v.entitlement.basis}</KioskFact><KioskFact label="Labor logged">{v.hoursLogged} h</KioskFact></div>
          <p className="text-lg">{v.problem}. {v.site}.</p>
          <div className="flex flex-wrap gap-3">
            <Button className="h-12 text-base" variant="outline" disabled={st.locked || v.status !== "On Site"} onClick={() => { if (clock) { write((d) => { d.field.svos.find((q) => q.id === v.id)!.hoursLogged += 1 }, `Labor stopped: 1 h logged since ${clock}`); setClock(null) } else { setClock("14:30"); setMsg("Labor clock started at 14:30.") } }}>{clock ? "Stop labor clock" : "Start labor clock"}</Button>
            {v.tasks.map((t, i) => <Button key={i} className="h-12 text-base" variant={t.done ? "default" : "outline"} disabled={st.locked || v.status !== "On Site"} onClick={() => write((d) => { const x = d.field.svos.find((q) => q.id === v.id)!.tasks[i]; x.done = !x.done }, `Task ${i + 1} ${t.done ? "reopened" : "done"}`)}>{t.done ? "Done: " : ""}{t.text.slice(0, 34)}</Button>)}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2"><p className="text-lg font-medium">Findings and photos ({v.photos ?? 0})</p>
              <Textarea aria-label="Finding" className="text-base" value={finding} onChange={(e) => setFinding(e.target.value)} placeholder="What you found" />
              <div className="flex gap-3"><Button className="h-12 text-base" variant="outline" disabled={st.locked || !finding.trim()} onClick={() => { write((d) => { d.field.svos.find((q) => q.id === v.id)!.findings.push(finding.trim()) }, "Finding saved"); setFinding("") }}>Save finding</Button><Button className="h-12 text-base" variant="outline" disabled={st.locked} onClick={() => write((d) => { const x = d.field.svos.find((q) => q.id === v.id)!; x.photos = (x.photos ?? 0) + 1 }, "Photo added")}>Add photo</Button></div></div>
            <div className="flex flex-col gap-2"><p className="text-lg font-medium">Removed and installed serials (T12)</p>
              <Input aria-label="Removed serial" className="h-12 text-base" value={sw.removed} onChange={(e) => setSw({ ...sw, removed: e.target.value })} placeholder="Removed serial" /><Input aria-label="Installed serial" className="h-12 text-base" value={sw.installed} onChange={(e) => setSw({ ...sw, installed: e.target.value })} placeholder="Installed serial" />
              <Button className="h-12 text-base" variant="outline" disabled={st.locked} onClick={() => { if (!sw.removed.trim() || !sw.installed.trim()) return setMsg("Both serials are needed to write the T12 event."); write((d) => { d.field.svos.find((q) => q.id === v.id)!.t12.push({ removed: sw.removed.trim(), installed: sw.installed.trim() }) }, "T12 event written"); setSw({ removed: "", installed: "" }) }}>Record swap</Button></div>
          </div>
          {v.status === "Work Complete" && <Input aria-label="Signer name" className="h-14 max-w-md text-lg" value={sig} onChange={(e) => setSig(e.target.value)} placeholder="Customer signs: type the name" />}
          <p className="text-base text-muted-foreground">Parts used: {v.parts.map((p) => `${p.materialId} ${p.used}/${p.qty}`).join(", ") || "none planned"}. Labor clock and scans keep working offline and queue.</p>
        </>
      )}
    </KioskPage>
  )
}

// ============================================================================ van stock
const lineId = (l: VanLine) => `${l.techId}|${l.materialId}`
export function VanStock() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("fsm-van", { degraded: "Van counts are from the last monthly count; consumption since then may not be posted.", validation: "Validation: only lines below minimum with no open transfer can be proposed." })
  const [queue, setQueue] = useState("below")
  const [openId, setOpenId] = useState<string | null>(null)
  const f = s.field
  const techName = (id: string) => f.techs.find((t) => t.id === id)?.name ?? id
  const pending = (l: VanLine) => f.transfers.some((t) => t.techId === l.techId && t.lines.some((x) => x.materialId === l.materialId))
  const below = f.van.filter((l) => l.onHand < l.min)
  const countDue = f.van.filter((l) => l.lastCount < "2026-09-09")
  const rows = queue === "below" ? below : queue === "count" ? countDue : f.van
  const line = f.van.find((l) => lineId(l) === openId)
  const create = (ids: string[]) => st.run(() => {
    const ls = f.van.filter((l) => ids.includes(lineId(l)) && l.onHand < l.min && !pending(l))
    if (!ls.length) return "Nothing to propose: the selected lines are not below minimum, or a transfer already covers them."
    const r = mutate((d) => {
      for (const tid of new Set(ls.map((l) => l.techId))) d.field.transfers.push({ id: nid(d, "TO"), techId: tid, from: "WH-TBD-03", lines: ls.filter((l) => l.techId === tid).map((l) => ({ materialId: l.materialId, qty: l.max - l.onHand })), createdOn: TODAY, status: "Created" })
    })
    return r.ok ? { ok: `${new Set(ls.map((l) => l.techId)).size} transfer order(s) created from WH-TBD-03` } : r.error
  })
  const receive = (toId: string) => st.run(() => {
    const r = mutate((d) => {
      const t = d.field.transfers.find((x) => x.id === toId)!
      for (const l of t.lines) { const v = d.field.van.find((x) => x.techId === t.techId && x.materialId === l.materialId); if (v) { v.onHand += l.qty; v.lastCount = TODAY } }
      d.field.transfers = d.field.transfers.filter((x) => x.id !== toId)
    })
    return r.ok ? { ok: `${toId} received on the van` } : r.error
  })
  const cols: Column<VanLine>[] = [
    { id: "tech", header: "Technician and van", value: (l) => techName(l.techId), sortable: true, filterable: true, cell: (l) => <span>{techName(l.techId)} <span className="text-xs text-muted-foreground">{f.techs.find((t) => t.id === l.techId)?.van}</span></span> },
    { id: "mat", header: "Spare", value: (l) => `${l.materialId} ${matDesc(l.materialId)}` },
    { id: "on", header: "On hand", value: (l) => l.onHand, mono: true, align: "right", sortable: true },
    { id: "min", header: "Min", value: (l) => l.min, mono: true, align: "right" },
    { id: "max", header: "Max", value: (l) => l.max, mono: true, align: "right" },
    { id: "prop", header: "Proposed transfer", value: (l) => (l.onHand < l.min ? l.max - l.onHand : 0), mono: true, align: "right", cell: (l) => (pending(l) ? <Tag family="active" label="Transfer open" /> : l.onHand < l.min ? <span className="tabular">{l.max - l.onHand}</span> : "None") },
    { id: "cnt", header: "Last count", value: (l) => l.lastCount, cell: (l) => <span>{fmtDate(l.lastCount)} {l.lastCount < "2026-09-09" && <Chip kind="flag" note="Monthly count is overdue (design interval 30 days)">Count due</Chip>}</span> },
  ]
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{
          title: "Van stock replenishment", screenId: "FX-FSM-VAN",
          description: "Each technician's van is a warehouse of type van, replenished by transfer orders against min and max per spare and counted monthly by the standard count documents.",
          primary: <Button disabled={st.locked} onClick={() => create(below.map(lineId))}>Create transfers for all below min</Button>,
          children: f.transfers.length ? (
            <div className="rounded-lg border p-3 text-sm"><p className="mb-2 font-medium">Transfer orders created</p>
              <ul className="flex flex-col gap-2">{f.transfers.map((t) => <li key={t.id} className="flex flex-wrap items-center gap-3"><span className="font-mono">{t.id}</span><span>{t.from} to {techName(t.techId)}: {t.lines.map((l) => `${l.qty} x ${l.materialId}`).join(", ")}</span><Button size="sm" variant="outline" disabled={st.locked} onClick={() => receive(t.id)}>Post receipt on the van</Button></li>)}</ul></div>
          ) : undefined,
        }}
        kpis={[{ label: "Lines below minimum", value: below.length }, { label: "Open transfers", value: f.transfers.length }, { label: "Counts due", value: countDue.length, hint: "Monthly, standard count documents" }, { label: "Vans", value: f.techs.length }]}
        queues={[{ id: "below", label: "Below minimum", count: below.length }, { id: "all", label: "All van lines", count: f.van.length }, { id: "count", label: "Count due", count: countDue.length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows: st.rows(rows), columns: cols, rowId: lineId, onRowClick: (l) => setOpenId(lineId(l)), activeId: openId ?? undefined, searchText: (l) => `${techName(l.techId)} ${l.materialId}`, loading: st.loading, densityKey: "van", empty: { title: "Nothing below minimum", body: "Every van line holds at least its minimum." } }}
        bulkActions={(sel, clear) => <Button size="sm" disabled={st.locked} onClick={() => { create(sel); clear() }}>Create transfers for {sel.length} selected</Button>}
        panel={{ open: !!line, onOpenChange: (o) => !o && setOpenId(null), title: line ? matDesc(line.materialId) : "", description: line ? `${techName(line.techId)}, ${line.materialId}` : undefined,
          content: line && <div className="flex flex-col gap-3 text-sm"><dl className="grid grid-cols-3 gap-3"><KV k="On hand">{line.onHand}</KV><KV k="Min">{line.min}</KV><KV k="Max">{line.max}</KV></dl>
            <p>{line.onHand < line.min ? `Below minimum by ${line.min - line.onHand}. Proposed transfer: ${line.max - line.onHand} to bring the van to its maximum.` : "At or above minimum: no transfer proposed."}</p>
            <div><Button disabled={st.locked || line.onHand >= line.min || pending(line)} onClick={() => create([lineId(line)])}>Create transfer</Button></div></div> }}
      />
    </>
  )
}

// ============================================================================ contracts
const CLASS_DEFAULT: Record<"A" | "B" | "C", [number, number]> = { A: [4, 48], B: [24, 120], C: [72, 240] }
export function ServiceContracts() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("fsm-contracts", { validation: "Validation: a contract needs a customer, a validity that ends after it starts, and at least one covered service; a serial-set contract needs serials." })
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ customerId: "", kind: "Customer" as "Customer" | "Serial set", serials: "", cls: "B" as "A" | "B" | "C", covered: [SERVICE_TYPES[1]] as string[], billing: "Non-covered work at service rates, billed per visit", from: "2026-10-12", to: "2027-10-11" })
  const [err, setErr] = useState<Record<string, string>>({})
  const [t, setT] = useState({ customerId: "CUS-TBD-0027", serial: "SN-TBD-5000-0188", service: "Onsite repair", date: TODAY })
  const verdict = entitle(s.field, t.customerId, t.serial, t.service, t.date)
  const cols: Column<Contract>[] = [
    { id: "id", header: "Contract", value: (c) => c.id, mono: true, sortable: true },
    { id: "cust", header: "Customer", value: (c) => customerName(c.customerId), sortable: true, filterable: true },
    { id: "cov", header: "Coverage", value: (c) => (c.coverage.kind === "Customer" ? "Whole customer" : `Serial set: ${c.coverage.serials.join(", ")}`) },
    { id: "cls", header: "Response class", value: (c) => c.cls, filterable: true, cell: (c) => `${c.cls}: ${c.responseHrs} h response, ${c.resolutionHrs} h resolution` },
    { id: "svc", header: "Covered services", value: (c) => c.covered.join(", ") },
    { id: "billing", header: "Non-covered work", value: (c) => c.billing },
    { id: "valid", header: "Validity", value: (c) => c.validFrom, sortable: true, cell: (c) => <span>{fmtDate(c.validFrom)} to {fmtDate(c.validTo)} {c.validTo < TODAY ? <Tag family="cancelled" label="Expired" /> : c.validFrom > TODAY ? <Tag family="draft" label="Not yet valid" /> : <Tag family="done" label="Valid" />}</span> },
  ]
  const save = () => {
    const e: Record<string, string> = {}
    if (!f.customerId) e.customerId = "Choose a customer."
    if (f.kind === "Serial set" && !f.serials.trim()) e.serials = "List the serials, comma separated."
    if (!f.covered.length) e.covered = "Choose at least one covered service."
    if (f.to <= f.from) e.to = "Validity must end after it starts."
    const ser = f.serials.split(",").map((x) => x.trim()).filter(Boolean)
    if (f.kind === "Serial set") { const bad = ser.find((x) => !s.field.units.some((u) => u.serial === x && u.customerId === f.customerId)); if (bad) e.serials = `${bad} is not in this customer's installed base.` }
    const overlap = s.field.contracts.find((c) => c.customerId === f.customerId && c.validFrom <= f.to && f.from <= c.validTo && (c.coverage.kind === "Customer" || f.kind === "Customer" || c.coverage.serials.some((x) => ser.includes(x))))
    if (overlap && !e.customerId) e.customerId = `${overlap.id} already covers this customer and period. Supersede it instead of overlapping.`
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => { d.field.seq += 1; d.field.contracts.push({ id: nid(d, "SCT").replace(/-\d+$/, `-${String(d.field.contracts.length + 1).padStart(4, "0")}`), customerId: f.customerId, coverage: { kind: f.kind, serials: f.kind === "Serial set" ? ser : [] }, cls: f.cls, responseHrs: CLASS_DEFAULT[f.cls][0], resolutionHrs: CLASS_DEFAULT[f.cls][1], covered: f.covered, billing: f.billing, validFrom: f.from, validTo: f.to }) })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ListPage
        header={{ title: "Service contracts", screenId: "FX-FSM-CONTRACTS", description: "Coverage per customer or serial set, response and resolution targets, covered services, billing terms for non-covered work, validity. Entitlement reads contracts before warranty.", actions: <Button variant="outline" asChild><Link to="/target/field-service/technicians">Technician resources</Link></Button>, primary: <Button disabled={st.locked} onClick={() => { setErr({}); setOpen(true) }}>New service contract</Button> }}
        above={
          <section aria-label="Entitlement tester" className="mb-4 rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-semibold">Try the entitlement service <Chip kind="design">Read-only check</Chip></h2>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Customer" id="et-c"><Select value={t.customerId} onValueChange={(x) => setT({ ...t, customerId: x, serial: s.field.units.find((u) => u.customerId === x)?.serial ?? "" })}><SelectTrigger id="et-c"><SelectValue /></SelectTrigger><SelectContent>{[...new Set(s.field.units.map((u) => u.customerId))].map((c) => <SelectItem key={c} value={c}>{customerName(c).slice(0, 36)}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Serial" id="et-s"><Select value={t.serial} onValueChange={(x) => setT({ ...t, serial: x })}><SelectTrigger id="et-s"><SelectValue /></SelectTrigger><SelectContent>{s.field.units.filter((u) => u.customerId === t.customerId).map((u) => <SelectItem key={u.id} value={u.serial}>{u.serial}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Service" id="et-v"><Select value={t.service} onValueChange={(x) => setT({ ...t, service: x })}><SelectTrigger id="et-v"><SelectValue /></SelectTrigger><SelectContent>{SERVICE_TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="On date" id="et-d"><Input id="et-d" type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} /></Field>
            </div>
            <p role="status" className="mt-2 text-sm font-medium">Verdict: {verdict.basis}{verdict.ref ? ` (${verdict.ref})` : ""}</p>
            <ol className="list-decimal pl-5 text-xs text-muted-foreground">{verdict.trail.map((x) => <li key={x}>{x}</li>)}</ol>
          </section>
        }
        table={{ rows: st.rows(s.field.contracts), columns: cols, rowId: (c) => c.id, searchText: (c) => `${c.id} ${customerName(c.customerId)}`, loading: st.loading, densityKey: "sct", empty: { title: "No service contract yet", body: "Without a contract, warranty and then billable rules apply." } }}
      />
      <DialogShell open={open} onOpenChange={setOpen} title="New service contract" confirmLabel="Create contract" onConfirm={save} wide consequence="New service orders for this customer are priced against this contract from the validity date. Existing orders keep the verdict stamped at their creation.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer" id="sc-c" error={err.customerId}><Select value={f.customerId} onValueChange={(x) => setF({ ...f, customerId: x })}><SelectTrigger id="sc-c"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{CUSTOMERS.filter((c) => c.status === "Active").map((c) => <SelectItem key={c.id} value={c.id}>{c.name.slice(0, 40)}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Coverage" id="sc-k"><Select value={f.kind} onValueChange={(x) => setF({ ...f, kind: x as "Customer" | "Serial set" })}><SelectTrigger id="sc-k"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Customer">Whole customer</SelectItem><SelectItem value="Serial set">Serial set</SelectItem></SelectContent></Select></Field>
          {f.kind === "Serial set" && <Field label="Serials" id="sc-s" error={err.serials}><Input id="sc-s" value={f.serials} onChange={(e) => setF({ ...f, serials: e.target.value })} /></Field>}
          <Field label="Response class" id="sc-cl" hint={`Response ${CLASS_DEFAULT[f.cls][0]} h, resolution ${CLASS_DEFAULT[f.cls][1]} h (design values)`}><Select value={f.cls} onValueChange={(x) => setF({ ...f, cls: x as "A" | "B" | "C" })}><SelectTrigger id="sc-cl"><SelectValue /></SelectTrigger><SelectContent>{(["A", "B", "C"] as const).map((x) => <SelectItem key={x} value={x}>Class {x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Valid from" id="sc-f"><Input id="sc-f" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="Valid to" id="sc-t" error={err.to}><Input id="sc-t" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <fieldset className="flex flex-col gap-1"><legend className="text-sm font-medium">Covered services</legend>{SERVICE_TYPES.map((x) => <label key={x} className="flex items-center gap-2 text-sm"><Checkbox checked={f.covered.includes(x)} onCheckedChange={(c) => setF({ ...f, covered: c ? [...f.covered, x] : f.covered.filter((y) => y !== x) })} />{x}</label>)}{err.covered && <span role="alert" className="text-xs text-destructive">{err.covered}</span>}</fieldset>
          <Field label="Billing terms for non-covered work" id="sc-b"><Textarea id="sc-b" value={f.billing} onChange={(e) => setF({ ...f, billing: e.target.value })} /></Field>
        </div>
      </DialogShell>
    </>
  )
}

export function Technicians() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("fsm-techs", { validation: "Validation: territory is a comma separated list of state or province codes; the calendar is required." })
  const [edit, setEdit] = useState<Tech | null>(null)
  const [tf, setTf] = useState({ territory: "", calendar: "" })
  const [err, setErr] = useState("")
  const f = s.field
  const cols: Column<Tech>[] = [
    { id: "id", header: "Technician", value: (t) => t.id, mono: true, sortable: true, cell: (t) => <span><span className="font-mono">{t.id}</span> {t.name}</span> },
    { id: "terr", header: "Service territory", value: (t) => t.territory.join(", "), filterable: true },
    { id: "skills", header: "Skills and certifications (qualification register)", value: (t) => t.skills.map((k) => k.skill).join(", "), cell: (t) => <ul className="text-xs">{t.skills.map((k) => <li key={k.cert}>{k.skill} <span className="font-mono">{k.cert}</span> {certState(k.expires) === "expired" ? <Tag family="exception" label={`Expired ${fmtDate(k.expires)}`} /> : certState(k.expires) === "soon" ? <Tag family="pending" label={`Expires ${fmtDate(k.expires)}`} /> : <span className="text-muted-foreground">to {fmtDate(k.expires)}</span>}</li>)}</ul> },
    { id: "cal", header: "Calendar", value: (t) => t.calendar },
    { id: "van", header: "Van stock", value: (t) => t.van, cell: (t) => <span>{t.van} <span className="text-xs text-muted-foreground">{f.van.filter((l) => l.techId === t.id && l.onHand < l.min).length} below min</span></span> },
    { id: "status", header: "Status", value: (t) => t.status, filterable: true, cell: (t) => <Tag family={t.status === "Active" ? "done" : "blocked"} label={t.status} /> },
    { id: "act", header: "", cell: (t) => <span className="flex gap-2"><Button size="sm" variant="outline" disabled={st.locked} onClick={() => { setErr(""); setTf({ territory: t.territory.join(", "), calendar: t.calendar }); setEdit(t) }}>Edit</Button><Button size="sm" variant="ghost" disabled={st.locked} onClick={() => st.run(() => { const r = mutate((d) => { const x = d.field.techs.find((q) => q.id === t.id)!; x.status = x.status === "Active" ? "On leave" : "Active" }); return r.ok ? { ok: `${t.name} is now ${t.status === "Active" ? "On leave" : "Active"}` } : r.error })}>{t.status === "Active" ? "Set on leave" : "Set active"}</Button></span> },
  ]
  const save = () => {
    if (!tf.calendar.trim() || !tf.territory.trim()) { setErr("Territory and calendar are both required."); return "Fix the marked fields." }
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => { const x = d.field.techs.find((q) => q.id === edit!.id)!; x.territory = tf.territory.split(",").map((y) => y.trim().toUpperCase()).filter(Boolean); x.calendar = tf.calendar.trim() })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ListPage
        header={{ title: "Technician resources", screenId: "FX-FSM-CONTRACTS", description: "Skills and certifications come from the qualification register and are read here, not retyped. Territory, calendar and the assigned van stock are held on the technician.", actions: <Button variant="outline" asChild><Link to="/target/field-service/contracts">Service contracts</Link></Button> }}
        table={{ rows: st.rows(f.techs), columns: cols, rowId: (t) => t.id, searchText: (t) => `${t.name} ${t.territory.join(" ")}`, loading: st.loading, densityKey: "tech", empty: { title: "No technician yet", body: "Technicians are users with a field role and a van." } }}
        below={<RulesPanel rules={[["FSM-4", "Technician resource: skills and certifications from the qualification register, service territory, calendar, assigned van stock.", "Book IX §7.1"], ["FSM-5", "Scheduling must respect skills, territory and travel and reserves technician capacity like a work center slot.", "Book IX §7.2"]]} />}
      />
      <DialogShell open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={`Edit ${edit?.name ?? ""}`} confirmLabel="Save" onConfirm={save} consequence="Territory and calendar apply to the dispatch board from the next assignment. Orders already scheduled are not moved.">
        <div className="grid gap-3"><Field label="Service territory" id="te-t" error={err && !tf.territory.trim() ? err : null}><Input id="te-t" value={tf.territory} onChange={(e) => setTf({ ...tf, territory: e.target.value })} /></Field><Field label="Calendar" id="te-c" error={err && !tf.calendar.trim() ? err : null}><Input id="te-c" value={tf.calendar} onChange={(e) => setTf({ ...tf, calendar: e.target.value })} /></Field></div>
      </DialogShell>
    </>
  )
}
