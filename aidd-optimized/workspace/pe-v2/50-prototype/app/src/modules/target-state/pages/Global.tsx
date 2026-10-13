// LOC-COUNTRY-001 country activation cockpit, FX-LOC-TAXREGIME tax regime configuration extension [Book IX §9] and
// FX-CAR-INTEGRATION carrier rating, tendering, tracking and e-POD IF-21 [DEC-04, Book IV]. A country is an activation kit from one
// framework with five layers; it goes live only when all five pass. Carrier integration adds an interface beside the manual
// path (carrier selection, PRO/BOL, freight accrual #26, POD) and never removes it.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, KV, PostingPreview, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { ConfigPage, DialogShell, WorkbenchPage } from "@/components/templates"
import type { Role } from "@/data/domain"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Empty, Field, Loading, Tag, TargetFrame, hash, useScreenState } from "../components"
import { LAYERS, PLAYBOOK, eligible, quoteOf, simulateTax, transitOf, type CarShipment, type Country, type Layer, type LayerRow, type TaxRegime } from "../data/global"
import { customerName, money } from "../lib"

const CONTROLLER = { roles: ["Controller", "CFO"] as Role[], why: "the compliance matrix is owned by the Controller and its row is the activation trigger (Book IX §9.1; CFO included as a reading)" }
const LOC_DECISION = "Broader international localization is a Book IX target-state module (Book IX §9)"
const LOC_EVIDENCE = "the first country closes one statutory period with returns generated from the system and reconciled, e-invoicing accepted by the authority where mandated, and the checklist archived as the template for the next country"
const layerFamily = (s: LayerRow["status"]) => (s === "Passed" ? "done" : s === "In progress" ? "active" : s === "Failed" ? "exception" : "draft")
const passed = (c: Country) => LAYERS.filter((l) => c.layers[l].status === "Passed").length
const done = (c: Country) => c.playbook.filter(Boolean).length
const countryStatus = (c: Country) => (c.decision?.outcome === "Go" ? "Live" : c.decision?.outcome === "No-go" ? "No-go" : passed(c) === 5 && done(c) === PLAYBOOK.length ? "Ready for the gate" : passed(c) + done(c) === 0 ? "Not started" : "In progress")
const statusFamily = (s: string) => (s === "Live" ? "done" : s === "No-go" ? "cancelled" : s === "Ready for the gate" ? "pending" : s === "In progress" ? "active" : "draft")
const OWNERS: Record<Layer, string> = { "Compliance matrix": "Controller", "Tax regime": "Cost accountant", Documents: "Document control", Language: "Customer Service Manager", Currency: "Controller" }
const EMPTY_LAYER = (l: Layer): LayerRow => ({ status: "Not started", owner: OWNERS[l], evidence: [], note: "" })

// ============================================================================ LOC-COUNTRY-001
export function LocCountries() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("loc-country", { validation: "Validation: a country code is two letters and unique; a currency is three letters; a layer passes only with evidence; a failed layer needs a note.", readOnly: "Read-only: the activation checklists are frozen for the statutory audit." })
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [dlg, setDlg] = useState(false)
  const [nf, setNf] = useState({ code: "", name: "", currency: "", entity: "", template: true })
  const [err, setErr] = useState<Record<string, string>>({})
  const [ev, setEv] = useState<{ layer: Layer | null; text: string }>({ layer: null, text: "" })
  const [decide, setDecide] = useState<null | "Go" | "No-go">(null)
  const cs = s.loc.countries
  const c = cs.find((x) => x.code === openCode)
  const cols: Column<Country>[] = [
    { id: "country", header: "Country", value: (x) => `${x.code} ${x.name}`, sortable: true, cell: (x) => <span><span className="font-mono">{x.code}</span> {x.name}</span> },
    { id: "entity", header: "Entity", value: (x) => x.entity },
    { id: "cur", header: "Functional currency", value: (x) => x.currency },
    { id: "layers", header: "Layers passed", value: (x) => passed(x), cell: (x) => <span className="tabular">{passed(x)} of 5</span> },
    { id: "play", header: "Playbook", value: (x) => done(x), cell: (x) => <span className="tabular">{done(x)} of {PLAYBOOK.length}</span> },
    { id: "status", header: "Activation", value: (x) => countryStatus(x), filterable: true, cell: (x) => <Tag family={statusFamily(countryStatus(x))} label={countryStatus(x)} /> },
  ]
  const setLayer = (code: string, layer: Layer, patch: Partial<LayerRow>) =>
    st.run(() => {
      const row = c!.layers[layer]
      const next = { ...row, ...patch }
      if (patch.status === "Passed" && next.evidence.length === 0) return `A layer passes only with evidence: add at least one evidence link to ${layer}.`
      if (patch.status === "Failed" && !next.note.trim()) return "A failed layer needs a note saying what failed."
      if (c!.decision) return `${c!.name} already has a go decision on record; the checklist is archived.`
      const r = mutate((d) => { const x = d.loc.countries.find((q) => q.code === code)!; x.layers[layer] = next })
      return r.ok ? { ok: `${layer}: ${patch.status ?? "updated"}` } : r.error
    }, layer === "Compliance matrix" ? CONTROLLER : undefined)
  const tick = (i: number) => st.run(() => {
    if (c!.decision) return "The playbook is archived with the go decision."
    const on = c!.playbook[i]
    if (!on && i > 0 && !c!.playbook[i - 1]) return `Follow the written playbook in order: finish "${PLAYBOOK[i - 1]}" first.`
    if (on && c!.playbook[i + 1]) return `Untick "${PLAYBOOK[i + 1]}" first: steps are undone in reverse order.`
    if (!on && PLAYBOOK[i] === "Gate" && passed(c!) < 5) return "The gate needs all five layers passed."
    const r = mutate((d) => { d.loc.countries.find((q) => q.code === c!.code)!.playbook[i] = !on })
    return r.ok ? { ok: `${PLAYBOOK[i]} ${on ? "reopened" : "done"}` } : r.error
  })
  const addEv = () => {
    if (!ev.layer || !ev.text.trim()) return "Enter the evidence reference."
    const g = st.guard(ev.layer === "Compliance matrix" ? CONTROLLER : undefined)
    if (g) return g
    const r = mutate((d) => { d.loc.countries.find((q) => q.code === c!.code)!.layers[ev.layer!].evidence.push(ev.text.trim()) })
    if (r.ok) setEv({ layer: null, text: "" })
    return r.ok ? null : r.error
  }
  const decideGo = (reason: string) => {
    const g = st.guard(CONTROLLER)
    if (g) return g
    if (decide === "Go") {
      if (passed(c!) < 5) return `A country goes live only when all five layers pass: ${5 - passed(c!)} still open.`
      if (done(c!) < PLAYBOOK.length) return "The written playbook is not complete: every step through the gate is needed."
    }
    const r = mutate((d) => { d.loc.countries.find((q) => q.code === c!.code)!.decision = { outcome: decide!, by: "Controller", on: "2026-10-09", reason: reason.trim() } })
    return r.ok ? null : r.error
  }
  const create = () => {
    const e: Record<string, string> = {}
    if (!/^[A-Za-z]{2}$/.test(nf.code)) e.code = "Two letters, for example BR."
    else if (cs.some((x) => x.code === nf.code.toUpperCase())) e.code = "This country already has a kit."
    if (!nf.name.trim()) e.name = "Enter the country name."
    if (!/^[A-Za-z]{3}$/.test(nf.currency)) e.currency = "Three letters, for example BRL."
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => {
      d.loc.countries.push({ code: nf.code.toUpperCase(), name: nf.name.trim(), currency: nf.currency.toUpperCase(), entity: nf.entity.trim() || "Not yet planned", layers: Object.fromEntries(LAYERS.map((l) => [l, EMPTY_LAYER(l)])) as Record<Layer, LayerRow>, playbook: PLAYBOOK.map(() => false) })
    })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision={LOC_DECISION} evidence={LOC_EVIDENCE} />
      <WorkbenchPage
        header={{ title: "Country activation cockpit", screenId: "LOC-COUNTRY-001", description: "One framework, five layers per country: compliance matrix, tax regime, documents, language and currency, each with an owner, evidence links and a status. The go decision record sits at the bottom of each checklist. Each new country is a kit, never a fork.", primary: <Button disabled={st.locked} onClick={() => { setErr({}); setDlg(true) }}>Start a country kit</Button> }}
        kpis={[{ label: "Live countries", value: cs.filter((x) => countryStatus(x) === "Live").length }, { label: "In progress", value: cs.filter((x) => ["In progress", "Ready for the gate"].includes(countryStatus(x))).length }, { label: "Layers failed", value: cs.reduce((a, x) => a + LAYERS.filter((l) => x.layers[l].status === "Failed").length, 0), hint: "Needs a fix before the gate" }, { label: "Template", value: "CA", hint: "Archived checklist of the live country" }]}
        table={{ rows: st.rows(cs), columns: cols, rowId: (x) => x.code, onRowClick: (x) => setOpenId(x.code), activeId: openCode ?? undefined, searchText: (x) => `${x.code} ${x.name}`, loading: st.loading, densityKey: "loc", empty: { title: "No country kit yet", body: "Start with the first target country." } }}
        panel={{ open: !!c, onOpenChange: (o) => !o && setOpenCode(null), title: c ? `${c.name} (${c.currency})` : "", description: c ? `Entity: ${c.entity}` : undefined,
          content: c && (
            <div className="flex flex-col gap-4 text-sm">
              <div><p className="mb-1 flex justify-between"><span className="font-medium">Five layer checklist</span><span className="tabular">{passed(c)} of 5 passed</span></p><Progress value={(passed(c) / 5) * 100} /></div>
              {LAYERS.map((l) => { const r = c.layers[l]; return (
                <div key={l} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{l}</span><Tag family={layerFamily(r.status)} label={r.status} /><span className="text-xs text-muted-foreground">Owner: {r.owner}</span></div>
                  {r.note && <p className="mt-1 text-xs">{r.note}</p>}
                  <ul className="mt-1 list-disc pl-5 text-xs">{r.evidence.map((x) => <li key={x}>{x}</li>)}{r.evidence.length === 0 && <li className="list-none text-muted-foreground">No evidence yet.</li>}</ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Select value={r.status} onValueChange={(v) => setLayer(c.code, l, { status: v as LayerRow["status"] })}><SelectTrigger aria-label={`${l} status`} size="sm" className="w-36"><SelectValue /></SelectTrigger><SelectContent>{["Not started", "In progress", "Passed", "Failed"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
                    <Button size="sm" variant="outline" disabled={st.locked} onClick={() => setEv({ layer: l, text: "" })}>Add evidence</Button>
                    {r.status === "Failed" && <Button size="sm" variant="ghost" disabled={st.locked} onClick={() => setLayer(c.code, l, { status: "In progress", note: "" })}>Reopen</Button>}
                  </div>
                </div>) })}
              <div className="rounded-lg border p-3"><p className="mb-2 font-medium">Playbook (in order)</p>
                <ol className="flex flex-col gap-1">{PLAYBOOK.map((p, i) => <li key={p} className="flex items-center gap-2"><Checkbox aria-label={p} checked={c.playbook[i]} disabled={st.locked} onCheckedChange={() => tick(i)} />{i + 1}. {p}</li>)}</ol></div>
              <div className="rounded-lg border p-3"><p className="mb-1 font-medium">Go decision record</p>
                {c.decision ? <p><Tag family={c.decision.outcome === "Go" ? "done" : "cancelled"} label={c.decision.outcome} /> by {c.decision.by} on {fmtDate(c.decision.on)}. {c.decision.reason} {c.decision.outcome === "Go" && <Chip kind="design">Checklist archived as the template</Chip>}</p>
                  : <div className="flex flex-col gap-2"><p className="text-muted-foreground">No decision yet. Go needs all five layers passed and the playbook complete.</p><div className="flex gap-2"><Button disabled={st.locked} onClick={() => setDecide("Go")}>Record go decision</Button><Button variant="outline" disabled={st.locked} onClick={() => setDecide("No-go")}>Record no-go</Button></div></div>}</div>
            </div>
          ) }}
      />
      <DialogShell open={!!ev.layer} onOpenChange={(o) => !o && setEv({ layer: null, text: "" })} title={`Add evidence to ${ev.layer ?? ""}`} confirmLabel="Add evidence" onConfirm={addEv} consequence="The reference is stored on the checklist; the document itself stays in document control.">
        <Field label="Evidence reference" id="ev-t"><Input id="ev-t" value={ev.text} onChange={(e) => setEv({ ...ev, text: e.target.value })} placeholder="EVID-TBD-XX-nn short description" /></Field>
      </DialogShell>
      <DialogShell open={!!decide} onOpenChange={(o) => !o && setDecide(null)} title={decide === "Go" ? `Go decision for ${c?.name}` : `No-go decision for ${c?.name}`} requireReason reasonLabel="Decision rationale (required)" confirmLabel={decide === "Go" ? "Record go" : "Record no-go"} destructive={decide === "No-go"} onConfirm={decideGo}
        consequence={decide === "Go" ? "Marks the country live and archives this checklist as the template for the next country. The matrix row is the activation trigger." : "Stops activation of this country. The checklist stays; a new kit is needed to try again."} />
      <DialogShell open={dlg} onOpenChange={setDlg} title="Start a country kit" confirmLabel="Create kit" onConfirm={create} wide consequence="Adds the five layers with their default owners and an empty eight-step playbook. Nothing goes live from here.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Country code" id="nc-c" error={err.code}><Input id="nc-c" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} maxLength={2} /></Field>
          <Field label="Country name" id="nc-n" error={err.name}><Input id="nc-n" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} /></Field>
          <Field label="Functional currency" id="nc-u" error={err.currency}><Input id="nc-u" value={nf.currency} onChange={(e) => setNf({ ...nf, currency: e.target.value })} maxLength={3} /></Field>
          <Field label="Entity" id="nc-e" hint="Leave blank if not yet planned"><Input id="nc-e" value={nf.entity} onChange={(e) => setNf({ ...nf, entity: e.target.value })} /></Field>
        </div>
      </DialogShell>
    </>
  )
  function setOpenId(code: string) { setOpenCode(code) }
}

// ============================================================================ FX-LOC-TAXREGIME
const AFTER = "2027-01-01"
export function TaxRegimes() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("loc-tax", { validation: "Validation: at least one rate; rates between 0 and 100; an e-invoicing mandate needs an adapter; release needs a simulation of this version and an effective date after today.", readOnly: "Read-only: the tax regimes are frozen for the period close." })
  const [id, setId] = useState(s.loc.regimes[0]?.id ?? "")
  const [section, setSection] = useState("rates")
  const [sim, setSim] = useState({ flow: "Domestic sale" as Parameters<typeof simulateTax>[2], net: "10000" })
  const [simOut, setSimOut] = useState<ReturnType<typeof simulateTax> | null>(null)
  const [nx, setNx] = useState({ jurisdiction: "", regNo: "", from: "2027-01-01" })
  const [nr, setNr] = useState({ cls: "", pct: "" })
  const [rel, setRel] = useState(false)
  const r = s.loc.regimes.find((x) => x.id === id)
  const edit = (fn: (x: TaxRegime) => void, note: string, needsRole = false) =>
    st.run(() => {
      const res = mutate((d) => {
        const x = d.loc.regimes.find((q) => q.id === id)!
        if (x.status === "Released") { x.inForce = x.version; x.version += 1; x.effectiveFrom = x.effectiveFrom < AFTER ? AFTER : x.effectiveFrom; x.history.unshift({ at: "2026-10-09", by: "Cost accountant", text: `Version ${x.version} draft opened: version ${x.inForce} stays in force until ${x.effectiveFrom}` }) }
        else if (x.status === "Simulated") x.history.unshift({ at: "2026-10-09", by: "Cost accountant", text: "Changed after simulation: simulate again before release" })
        fn(x)
        x.status = "Draft"
      })
      return res.ok ? { ok: note } : res.error
    }, needsRole ? { roles: ["Controller", "Cost accountant", "CFO"] as Role[], why: "tax regime changes are made by the cost accountant and released by the Controller (reading)" } : undefined)
  const runSim = () => st.run(() => {
    const net = Number(sim.net)
    if (!(net > 0)) return "Enter a net amount above zero."
    const out = simulateTax(r!, net, sim.flow)
    setSimOut(out)
    const res = mutate((d) => { const x = d.loc.regimes.find((q) => q.id === id)!; if (x.status === "Draft") { x.status = "Simulated"; x.history.unshift({ at: "2026-10-09", by: "Cost accountant", text: `Version ${x.version} simulated (${sim.flow})` }) } })
    return res.ok ? { ok: "Simulation run through the existing determination precedence" } : res.error
  })
  const release = () => {
    const g = st.guard({ roles: ["Controller", "CFO"] as Role[], why: "release of governed configuration is a Controller decision (reading)" })
    if (g) return g
    const x = r!
    if (x.status !== "Simulated") return "Simulate this version before release: governed configuration is simulated first."
    if (x.effectiveFrom <= "2026-10-09" && x.version > 1 && x.inForce) return "A new version needs an effective date after today; the version in force is never changed in place."
    if (x.nexus.length === 0) return "No registration in the nexus register: registrations are approved before the first transaction."
    if (x.einvoice.mandate !== "None" && x.einvoice.adapter === "None") return "An e-invoicing mandate needs an adapter on the tax interface."
    const res = mutate((d) => { const y = d.loc.regimes.find((q) => q.id === id)!; y.status = "Released"; y.inForce = undefined; y.history.unshift({ at: "2026-10-09", by: "Controller", text: `Version ${y.version} released, effective ${y.effectiveFrom}` }) })
    return res.ok ? null : res.error
  }
  const cols: Column<TaxRegime>[] = [
    { id: "id", header: "Regime", value: (x) => x.id, mono: true },
    { id: "name", header: "Name", value: (x) => x.name },
    { id: "type", header: "Type", value: (x) => x.type, filterable: true },
    { id: "ver", header: "Version", value: (x) => x.version, mono: true },
    { id: "eff", header: "Effective", value: (x) => x.effectiveFrom, cell: (x) => fmtDate(x.effectiveFrom) },
    { id: "status", header: "Status", value: (x) => x.status, filterable: true, cell: (x) => <Tag family={x.status === "Released" ? "done" : x.status === "Simulated" ? "pending" : "draft"} label={x.status} /> },
  ]
  void cols
  return (
    <>
      <TargetFrame st={st} decision={LOC_DECISION} evidence={LOC_EVIDENCE} />
      <ConfigPage
        header={{ title: "Tax regime configuration", screenId: "FX-LOC-TAXREGIME", description: "Extends the existing tax screens: VAT and GST regimes run through the existing determination precedence, with registrations in the nexus register, reverse charge and import tax as regime configuration, and e-invoicing mandates as adapters. Effective dated and simulated before release.", primary: <Button disabled={st.locked || !r || r.status === "Released"} onClick={() => setRel(true)}>Release this version</Button> }}
        sections={[{ id: "rates", label: "Rates" }, { id: "rules", label: "Reverse charge and import tax" }, { id: "einv", label: "E-invoicing adapter" }, { id: "nexus", label: "Nexus register" }, { id: "sim", label: "Simulate" }, { id: "hist", label: "History" }]}
        section={section}
        onSectionChange={setSection}
        effectiveDated
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={id} onValueChange={(v) => { setId(v); setSimOut(null) }}><SelectTrigger aria-label="Regime" className="w-72"><SelectValue /></SelectTrigger><SelectContent>{s.loc.regimes.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>
          {r && <><Tag family={r.status === "Released" ? "done" : r.status === "Simulated" ? "pending" : "draft"} label={r.status} /><span className="text-sm">Version {r.version}, effective {fmtDate(r.effectiveFrom)}</span>{r.inForce && <Chip kind="change" note={`Version ${r.inForce} stays in force until the new one takes effect`}>Version {r.inForce} in force</Chip>}</>}
        </div>
        {st.loading ? <Loading /> : !r ? <Empty>No regime configured.</Empty> : (
          <>
            {section === "rates" && (
              <div className="flex max-w-3xl flex-col gap-3">
                <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Rate class</TableHead><TableHead className="w-40 text-right">Percent</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>{r.rates.map((x, i) => <TableRow key={x.cls}><TableCell>{x.cls}</TableCell><TableCell className="text-right"><Input aria-label={`${x.cls} percent`} className="ml-auto w-24 text-right" inputMode="decimal" defaultValue={x.pct} key={`${r.version}${x.cls}${x.pct}`} onBlur={(e) => { const v = Number(e.target.value); if (v === x.pct) return; if (!(v >= 0 && v <= 100)) return st.setMsg("A rate is between 0 and 100 percent."); edit((q) => { q.rates[i].pct = v }, `${x.cls} set to ${v}%`, true) }} /></TableCell><TableCell><Button size="sm" variant="ghost" disabled={st.locked || r.rates.length < 2} onClick={() => edit((q) => { q.rates.splice(i, 1) }, `${x.cls} removed`, true)}>Remove</Button></TableCell></TableRow>)}</TableBody></Table>
                <div className="flex items-end gap-2"><Field label="New rate class" id="rt-c"><Input id="rt-c" value={nr.cls} onChange={(e) => setNr({ ...nr, cls: e.target.value })} /></Field><Field label="Percent" id="rt-p"><Input id="rt-p" className="w-24" inputMode="decimal" value={nr.pct} onChange={(e) => setNr({ ...nr, pct: e.target.value })} /></Field>
                  <Button variant="outline" disabled={st.locked} onClick={() => { const v = Number(nr.pct); if (!nr.cls.trim() || nr.pct === "" || !(v >= 0 && v <= 100)) return st.setMsg("Enter a class name and a percent between 0 and 100."); if (r.rates.some((x) => x.cls.toLowerCase() === nr.cls.trim().toLowerCase())) return st.setMsg("This rate class already exists."); edit((q) => { q.rates.push({ cls: nr.cls.trim(), pct: v }) }, "Rate class added", true); setNr({ cls: "", pct: "" }) }}>Add rate</Button></div>
                <p className="text-xs text-muted-foreground">The first row is the standard rate used by the simulation. Rates are design values.</p>
              </div>
            )}
            {section === "rules" && (
              <div className="flex max-w-2xl flex-col gap-4">
                <label className="flex items-center gap-3"><Switch checked={r.reverseCharge} disabled={st.locked} onCheckedChange={(v) => edit((q) => { q.reverseCharge = v }, `Reverse charge ${v ? "on" : "off"}`, true)} aria-label="Reverse charge" />Reverse charge applies to qualifying purchases (self-assessed)</label>
                <Field label="Import tax rule" id="it"><Input id="it" key={`${r.version}${r.importTax}`} defaultValue={r.importTax} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== r.importTax) edit((q) => { q.importTax = e.target.value.trim() }, "Import tax rule updated", true) }} /></Field>
                <p className="text-xs text-muted-foreground">Determination keeps its existing precedence; these are regime configuration, not new code paths.</p>
              </div>
            )}
            {section === "einv" && (
              <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <Field label="Mandate" id="ei-m"><Input id="ei-m" key={`${r.version}${r.einvoice.mandate}`} defaultValue={r.einvoice.mandate} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== r.einvoice.mandate) edit((q) => { q.einvoice.mandate = e.target.value.trim() }, "Mandate updated", true) }} /></Field>
                <Field label="Adapter on the tax interface" id="ei-a"><Input id="ei-a" key={`${r.version}${r.einvoice.adapter}`} defaultValue={r.einvoice.adapter} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== r.einvoice.adapter) edit((q) => { q.einvoice.adapter = e.target.value.trim() }, "Adapter updated", true) }} /></Field>
                <Field label="Clearance model" id="ei-c" hint="Clearance before invoice issue where the country demands it"><Select value={r.einvoice.clearance} onValueChange={(v) => edit((q) => { q.einvoice.clearance = v as TaxRegime["einvoice"]["clearance"] }, "Clearance model updated", true)}><SelectTrigger id="ei-c"><SelectValue /></SelectTrigger><SelectContent>{["Before invoice issue", "Reporting after issue", "Not required"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
              </div>
            )}
            {section === "nexus" && (
              <div className="flex max-w-3xl flex-col gap-3">
                {r.nexus.length === 0 ? <Empty>No registration yet. Registrations are approved before the first transaction.</Empty> : <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Nexus</TableHead><TableHead>Jurisdiction</TableHead><TableHead>Registration number</TableHead><TableHead>From</TableHead></TableRow></TableHeader><TableBody>{r.nexus.map((x) => <TableRow key={x.id}><TableCell className="font-mono">{x.id}</TableCell><TableCell>{x.jurisdiction}</TableCell><TableCell className="font-mono">{x.regNo}</TableCell><TableCell className="tabular">{fmtDate(x.from)}</TableCell></TableRow>)}</TableBody></Table>}
                <div className="grid gap-2 sm:grid-cols-4"><Field label="Jurisdiction" id="nx-j"><Input id="nx-j" value={nx.jurisdiction} onChange={(e) => setNx({ ...nx, jurisdiction: e.target.value })} /></Field><Field label="Registration number" id="nx-r"><Input id="nx-r" value={nx.regNo} onChange={(e) => setNx({ ...nx, regNo: e.target.value })} /></Field><Field label="Effective from" id="nx-f"><Input id="nx-f" type="date" value={nx.from} onChange={(e) => setNx({ ...nx, from: e.target.value })} /></Field><div className="flex items-end"><Button variant="outline" disabled={st.locked} onClick={() => { if (!nx.jurisdiction.trim() || !nx.regNo.trim()) return st.setMsg("Enter the jurisdiction and the registration number."); edit((q) => { q.nexus.push({ id: `NEX-TBD-${q.country}-${String(q.nexus.length + 1).padStart(2, "0")}`, jurisdiction: nx.jurisdiction.trim(), regNo: nx.regNo.trim(), from: nx.from }) }, "Registration added to the nexus register", true); setNx({ jurisdiction: "", regNo: "", from: "2027-01-01" }) }}>Add registration</Button></div></div>
              </div>
            )}
            {section === "sim" && (
              <div className="flex max-w-3xl flex-col gap-3">
                <p className="text-sm text-muted-foreground">Run a sample transaction through this regime before release. The result is shown, never posted.</p>
                <div className="flex flex-wrap items-end gap-3"><Field label="Flow" id="sm-f"><Select value={sim.flow} onValueChange={(v) => setSim({ ...sim, flow: v as typeof sim.flow })}><SelectTrigger id="sm-f" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{["Domestic sale", "Export", "Import purchase", "Reverse-charge purchase"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><Field label="Net amount" id="sm-n"><Input id="sm-n" className="w-36" inputMode="decimal" value={sim.net} onChange={(e) => setSim({ ...sim, net: e.target.value })} /></Field><Button disabled={st.locked} onClick={runSim}>Run simulation</Button></div>
                {simOut && <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">Percent</TableHead><TableHead className="text-right">Tax</TableHead></TableRow></TableHeader><TableBody>{simOut.map((l) => <TableRow key={l.label}><TableCell>{l.label}</TableCell><TableCell className="tabular text-right">{money(l.base, 2)}</TableCell><TableCell className="tabular text-right">{l.pct}%</TableCell><TableCell className="tabular text-right">{money(l.tax, 2)}</TableCell></TableRow>)}</TableBody></Table>}
              </div>
            )}
            {section === "hist" && <ul className="max-w-3xl space-y-1 text-sm">{r.history.length === 0 ? <li className="text-muted-foreground">No history yet.</li> : r.history.map((h, i) => <li key={i}><span className="tabular">{fmtDate(h.at)}</span> {h.by}: {h.text}</li>)}</ul>}
          </>
        )}
      </ConfigPage>
      <div className="mt-4"><RulesPanel rules={[["LOC-1", "VAT and GST regimes run through the existing determination precedence with the tax engine.", "Book IX §9.1"], ["LOC-2", "Regime configuration is effective dated and simulated before release like every governed configuration.", "Book IX §9.2"], ["LOC-3", "E-invoicing mandates are adapters on the tax interface; clearance happens before invoice issue where the country demands it.", "Book IX §9.1"]]} /></div>
      <DialogShell open={rel} onOpenChange={setRel} title={`Release ${r?.name ?? ""} version ${r?.version ?? ""}`} confirmLabel="Release" onConfirm={release} consequence={`Version ${r?.version} takes effect on ${r ? fmtDate(r.effectiveFrom) : ""}. Documents dated earlier keep the version that was in force.`} />
    </>
  )
}

// ============================================================================ FX-CAR-INTEGRATION
const carFamily = (t: CarShipment["tender"]["state"]) => (t === "Accepted" ? "done" : t === "Tendered" ? "active" : t === "Rejected" ? "exception" : t === "Expired" ? "cancelled" : "draft")
export function CarrierIntegration() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("car-if21", { validation: "Validation: a manual selection needs a carrier that can take the load and a PRO number; a POD needs a signer.", degraded: "Interface IF-21 is not answering: rating, tendering, tracking and e-POD by interface are unavailable. The manual path below still works.", offline: "Offline: the interface and writes wait for the connection." })
  const [queue, setQueue] = useState("action")
  const [openId, setOpenId] = useState<string | null>(null)
  const [pick, setPick] = useState("")
  const [man, setMan] = useState({ carrierId: "", pro: "" })
  const [ev, setEv] = useState("")
  const [signer, setSigner] = useState("")
  const [reason, setReason] = useState<null | "exception">(null)
  const car = s.carrier
  const api = st.state !== "degraded"
  const rows = car.shipments
  const sh = rows.find((x) => x.id === openId)
  const carName = (id?: string) => car.carriers.find((c) => c.id === id)?.name ?? "None"
  const needs = rows.filter((x) => !x.carrierId && x.status !== "Delivered/Closed")
  const filtered = queue === "action" ? needs : queue === "transit" ? rows.filter((x) => x.carrierId && x.tender.state === "Accepted" && x.epod.state === "Expected") : queue === "epod" ? rows.filter((x) => ["Received", "Exception"].includes(x.epod.state) || (x.events.some((e) => e.status === "Delivered") && x.epod.state === "Expected")) : rows
  const upd = (id: string, fn: (x: CarShipment) => void, ok: string) => st.run(() => { const r = mutate((d) => fn(d.carrier.shipments.find((q) => q.id === id)!)); return r.ok ? { ok } : r.error })
  const ifOnly = (fn: () => void) => { if (!api) return st.setMsg("IF-21 is not answering. Use the manual path: select the carrier and key the PRO number, tracking events and the POD by hand."); fn() }
  const cols: Column<CarShipment>[] = [
    { id: "id", header: "Shipment", value: (x) => x.id, mono: true, sortable: true },
    { id: "so", header: "Delivery and sales order", value: (x) => `${x.deliveryId} ${x.soId}` },
    { id: "cust", header: "Customer", value: (x) => customerName(x.customerId).slice(0, 30) },
    { id: "lane", header: "Lane", value: (x) => `${x.origin} to ${x.dest}`, cell: (x) => <span>{x.origin} to {x.dest} <span className="text-xs text-muted-foreground">{x.km} km, {x.kg.toLocaleString()} kg</span> {x.overDimensional && <Chip kind="flag">Over-dimensional</Chip>}</span> },
    { id: "status", header: "Delivery", value: (x) => x.status, filterable: true, cell: (x) => <StatusBadge kind="delivery" status={x.status} /> },
    { id: "car", header: "Carrier", value: (x) => carName(x.carrierId) },
    { id: "tender", header: "Tender", value: (x) => x.tender.state, filterable: true, cell: (x) => <Tag family={carFamily(x.tender.state)} label={x.tender.state} /> },
    { id: "pod", header: "POD", value: (x) => x.epod.state, cell: (x) => <StatusBadge kind="pod" status={x.epod.state} /> },
  ]
  const options = sh ? car.carriers.filter((c) => eligible(c, sh) && !sh.tender.rejectedBy.includes(c.id)).map((c) => ({ c, q: quoteOf(c, sh), t: transitOf(c, sh) })).sort((a, b) => a.q - b.q) : []
  const proFor = (id: string) => `PRO ${String(hash(id) % 9000 + 1000)}-${String(hash(id + "x") % 9000 + 1000)}`
  const accrual = sh?.quote ?? 0
  return (
    <>
      <TargetFrame st={st} decision="Carrier rating, tendering, tracking and e-POD is Phase 3 as interface IF-21; go-live is manual (DEC-04)" evidence="DEC-04 decision and the carrier contract; the manual path (carrier selection, PRO/BOL, freight accrual #26, POD capture) is never removed" />
      <WorkbenchPage
        header={{ title: "Carrier integration (IF-21)", screenId: "FX-CAR-INTEGRATION", description: "The same Delivery Cockpit and Shipments screens gain carrier rating, tendering, tracking and e-POD through interface IF-21. Everything also works by hand: manual carrier selection, PRO/BOL capture, tracking events and POD capture stay.", chips: <Chip kind="design" note="IF-21 is reserved in the interface catalog; here it is simulated">{api ? "IF-21 simulated: up" : "IF-21 down"}</Chip> }}
        kpis={[{ label: "Needs a carrier", value: needs.length }, { label: "Tendered, awaiting reply", value: rows.filter((x) => x.tender.state === "Tendered").length }, { label: "In transit", value: rows.filter((x) => x.events.some((e) => e.status === "In transit") && x.epod.state === "Expected").length }, { label: "POD open", value: rows.filter((x) => ["Expected", "Exception"].includes(x.epod.state) && x.carrierId).length }]}
        queues={[{ id: "action", label: "Needs carrier", count: needs.length }, { id: "transit", label: "With carrier", count: rows.filter((x) => x.carrierId && x.tender.state === "Accepted" && x.epod.state === "Expected").length }, { id: "epod", label: "e-POD", count: rows.filter((x) => ["Received", "Exception"].includes(x.epod.state)).length }, { id: "all", label: "All shipments", count: rows.length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows: st.rows(filtered), columns: cols, rowId: (x) => x.id, onRowClick: (x) => { setOpenId(x.id); setPick(""); setMan({ carrierId: "", pro: "" }) }, activeId: openId ?? undefined, searchText: (x) => `${x.id} ${x.deliveryId} ${x.soId}`, loading: st.loading, densityKey: "car", empty: { title: "No shipment here", body: "Shipments leave this list when a carrier is accepted and the POD is closed." } }}
        panel={{ open: !!sh, onOpenChange: (o) => !o && setOpenId(null), title: sh?.id ?? "", description: sh ? `${sh.deliveryId}, ${sh.origin} to ${sh.dest}` : undefined,
          content: sh && (
            <div className="flex flex-col gap-4 text-sm">
              <dl className="grid grid-cols-2 gap-3"><KV k="Carrier">{carName(sh.carrierId)}</KV><KV k="PRO / BOL">{sh.pro ?? "Not yet"}</KV><KV k="Tender"><Tag family={carFamily(sh.tender.state)} label={sh.tender.state} /></KV><KV k="Freight quote">{sh.quote ? money(sh.quote) : "None"}</KV></dl>
              {sh.tender.rejectedBy.length > 0 && <p>Rejected by {sh.tender.rejectedBy.map(carName).join(", ")}. Rate shopping skips them.</p>}
              {!sh.carrierId || sh.tender.state === "Rejected" ? (
                <>
                  <div><p className="mb-1 font-medium">Rate shop (IF-21)</p>
                    {options.length === 0 ? <p className="text-muted-foreground">No eligible carrier left. Use the manual path or split the load.</p> : (
                      <Table><TableHeader className="bg-table-head"><TableRow><TableHead /><TableHead>Carrier</TableHead><TableHead className="text-right">Quote</TableHead><TableHead className="text-right">Transit days</TableHead></TableRow></TableHeader>
                        <TableBody>{options.map(({ c, q, t }, i) => <TableRow key={c.id}><TableCell><input type="radio" name="car" aria-label={`Select ${c.name}`} checked={(pick || options[0].c.id) === c.id} onChange={() => setPick(c.id)} /></TableCell><TableCell>{c.name} <span className="text-xs text-muted-foreground">{c.scac}, {c.equipment}</span>{i === 0 && <> <Chip kind="design">Lowest</Chip></>}</TableCell><TableCell className="tabular text-right">{money(q)}</TableCell><TableCell className="tabular text-right">{t}</TableCell></TableRow>)}</TableBody></Table>)}
                    <div className="mt-2"><Button disabled={st.locked || options.length === 0} onClick={() => ifOnly(() => { const cid = pick || options[0].c.id; const o = options.find((x) => x.c.id === cid)!; upd(sh.id, (x) => { x.carrierId = cid; x.quote = o.q; x.tender = { state: "Tendered", rejectedBy: x.tender.rejectedBy, at: "2026-10-09 14:30" } }, `Tendered to ${o.c.name} through IF-21`) })}>Tender through IF-21</Button></div></div>
                  <div className="rounded-lg border p-3"><p className="mb-1 font-medium">Manual path</p>
                    <div className="grid grid-cols-2 gap-2"><Field label="Carrier" id="mc-c"><Select value={man.carrierId} onValueChange={(v) => setMan({ ...man, carrierId: v })}><SelectTrigger id="mc-c"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{car.carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field><Field label="PRO / BOL" id="mc-p"><Input id="mc-p" value={man.pro} onChange={(e) => setMan({ ...man, pro: e.target.value })} /></Field></div>
                    <div className="mt-2"><Button variant="outline" disabled={st.locked} onClick={() => { const c = car.carriers.find((x) => x.id === man.carrierId); if (!c) return st.setMsg("Choose the carrier."); if (!eligible(c, sh)) return st.setMsg(sh.overDimensional ? `${c.name} cannot move an over-dimensional load; only heavy haul can.` : `${c.name} cannot take ${sh.kg.toLocaleString()} kg on this equipment.`); if (!man.pro.trim()) return st.setMsg("A PRO or BOL number is needed to select a carrier by hand."); upd(sh.id, (x) => { x.carrierId = c.id; x.quote = quoteOf(c, x); x.pro = man.pro.trim(); x.tender = { state: "Accepted", rejectedBy: x.tender.rejectedBy, at: "2026-10-09 14:30" } }, `${c.name} selected manually with ${man.pro.trim()}`) }}>Select manually</Button></div></div>
                </>
              ) : (
                <>
                  {sh.tender.state === "Tendered" && <div className="rounded-lg border p-3"><p className="mb-1 font-medium">Waiting for {carName(sh.carrierId)}</p><p className="text-muted-foreground">Simulated reply from the carrier interface:</p><div className="mt-2 flex gap-2"><Button disabled={st.locked} onClick={() => ifOnly(() => upd(sh.id, (x) => { x.tender.state = "Accepted"; x.pro = proFor(x.id) }, "Carrier accepted; PRO number received"))}>Carrier accepts</Button><Button variant="outline" disabled={st.locked} onClick={() => ifOnly(() => upd(sh.id, (x) => { x.tender = { state: "Rejected", rejectedBy: [...x.tender.rejectedBy, x.carrierId!], at: "2026-10-09 14:30" }; x.carrierId = undefined; x.quote = undefined }, "Carrier rejected: pick the next carrier"))}>Carrier rejects</Button><Button variant="ghost" disabled={st.locked} onClick={() => upd(sh.id, (x) => { x.tender = { state: "Expired", rejectedBy: x.tender.rejectedBy, at: x.tender.at }; x.carrierId = undefined }, "Tender expired without a reply")}>Reply window expired</Button></div></div>}
                  {sh.tender.state === "Accepted" && (
                    <>
                      {accrual > 0 && sh.status === "Loaded" && <PostingPreview title="Posting on PGI (PE-paid terms)" lines={[{ template: 26, amount: accrual, detail: `${carName(sh.carrierId)} ${sh.pro}` }]} />}
                      {sh.status === "Loaded" && <div><Button disabled={st.locked} onClick={() => upd(sh.id, (x) => { x.status = "PGI" }, `PGI posted: freight accrual #26 of ${money(accrual)}`)}>Post PGI with freight accrual</Button></div>}
                      <div><p className="mb-1 font-medium">Tracking</p>
                        <ul className="mb-2 list-disc pl-5">{sh.events.map((e, i) => <li key={i}><span className="tabular">{e.at}</span> {e.status}, {e.loc} <span className="text-xs text-muted-foreground">({e.source})</span></li>)}{sh.events.length === 0 && <li className="list-none text-muted-foreground">No event yet.</li>}</ul>
                        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={st.locked} onClick={() => ifOnly(() => upd(sh.id, (x) => { const n = x.events.length; x.events.push({ at: "2026-10-09 14:30", status: n === 0 ? "Picked up" : n === 1 ? "In transit" : "Delivered", loc: n === 0 ? x.origin : n === 1 ? "En route" : x.dest, source: "IF-21" }); if (n >= 2) x.status = "Delivered/Closed" }, "Tracking event received through IF-21"))}>Receive next IF-21 event</Button></div>
                        <div className="mt-2 flex items-end gap-2"><Field label="Manual tracking note" id="tr-m"><Input id="tr-m" value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Called the driver: at Sioux Falls" /></Field><Button size="sm" variant="outline" disabled={st.locked} onClick={() => { if (!ev.trim()) return st.setMsg("Type the tracking note."); upd(sh.id, (x) => { x.events.push({ at: "2026-10-09 14:30", status: ev.trim(), loc: "", source: "Manual" }) }, "Manual tracking event added"); setEv("") }}>Add</Button></div></div>
                    </>
                  )}
                </>
              )}
              <div className="rounded-lg border p-3"><p className="mb-1 font-medium">Proof of delivery <StatusBadge kind="pod" status={sh.epod.state} /></p>
                {sh.epod.signedBy && <p>Signed by {sh.epod.signedBy} at {sh.epod.at} ({sh.epod.source}).</p>}
                {sh.epod.state === "Expected" && sh.carrierId && (
                  <div className="flex flex-wrap items-end gap-2"><Button size="sm" disabled={st.locked} onClick={() => ifOnly(() => upd(sh.id, (x) => { x.epod = { state: "Received", signedBy: "Consignee (electronic signature)", at: "2026-10-09 14:30", source: "IF-21" }; x.status = "Delivered/Closed" }, "e-POD received through IF-21"))}>Receive e-POD (IF-21)</Button>
                    <Field label="Or capture by hand: signer" id="pod-s"><Input id="pod-s" className="w-48" value={signer} onChange={(e) => setSigner(e.target.value)} /></Field><Button size="sm" variant="outline" disabled={st.locked} onClick={() => { if (!signer.trim()) return st.setMsg("A POD needs the name of the person who signed."); upd(sh.id, (x) => { x.epod = { state: "Received", signedBy: signer.trim(), at: "2026-10-09 14:30", source: "Manual" }; x.status = "Delivered/Closed" }, "POD captured by hand"); setSigner("") }}>Capture POD</Button></div>
                )}
                {sh.epod.state === "Received" && <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={st.locked} onClick={() => upd(sh.id, (x) => { x.epod.state = "Resolved/Closed" }, "POD closed")}>Accept and close</Button><Button size="sm" variant="outline" disabled={st.locked} onClick={() => setReason("exception")}>Raise exception</Button></div>}
                {sh.epod.state === "Exception" && <div className="mt-2"><Button size="sm" variant="outline" disabled={st.locked} onClick={() => upd(sh.id, (x) => { x.epod.state = "Resolved/Closed" }, "Exception resolved and POD closed")}>Resolve and close</Button></div>}
              </div>
            </div>
          ) }}
      />
      <RulesPanel rules={[["CAR-1", "Go-live is manual carrier selection, PRO/BOL capture, freight accrual #26 and POD capture; carrier API rating, tendering, tracking and e-POD is Phase 3 as IF-21.", "DEC-04"], ["CAR-2", "The manual path is never removed: every IF-21 action has a hand-keyed equivalent.", "Book IV"]]} />
      <DialogShell open={!!reason} onOpenChange={(o) => !o && setReason(null)} title={`Raise POD exception on ${sh?.id ?? ""}`} requireReason reasonLabel="What is wrong (required)" confirmLabel="Raise exception" consequence="Moves the POD to Exception and keeps the delivery open until it is resolved. A claim follows the freight claims process." onConfirm={() => { const g = st.guard(); if (g) return g; const r = mutate((d) => { const x = d.carrier.shipments.find((q) => q.id === sh!.id)!; x.epod.state = "Exception"; x.status = "PGI" }); return r.ok ? null : r.error }} />
    </>
  )
}
