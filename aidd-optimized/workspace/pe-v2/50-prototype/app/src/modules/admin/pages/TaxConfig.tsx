// INV-CONFIG-TAX Tax Configuration (Config) [DOC:p.281 Book VII; pp.45-46 INV §11] (asserted):
// "Engine mode selector, default code panel, trigger point checkboxes, nexus register grid with the
// economic threshold monitor, manual rate table grayed in engine mode. Maintain nexus rows. Review
// reconciliation monthly. Manual mode edits as dated rows with approval." Users: Finance; the
// Controller approves manual rates. Serves FL-01 (tax nexus). Retroactive policy: posted documents
// are never restated by configuration changes.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Chip, DataTable, KV, RulesPanel, StatusBadge, useFirstVisitLoading } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { roleGroupOf, type LegalEntityId } from "@/data/domain"
import { CUSTOMERS, HERO, LEGAL_ENTITIES, WAREHOUSES } from "@/data/shared"
import { fmtMoney } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { DEFAULT_TAX_CODES, TAX_PRECEDENCE, TRIGGER_POINTS } from "../data/catalog"
import { addNexus, proposeRate, proposeTaxAdjustment, reviewRecon, setDefaultCode, setEngineMode, setTrigger } from "../data/actions"
import { fmtDateTime, fmtMonth } from "../lib/time"
import { act, Field, SimpleSelect, StateText, userName } from "../components/common"

const SECTIONS = [
  { id: "engine", label: "Engine, codes, triggers" },
  { id: "nexus", label: "Nexus register" },
  { id: "rates", label: "Manual rate table" },
  { id: "recon", label: "Monthly reconciliation" },
  { id: "determine", label: "Determination check" },
  { id: "audit", label: "Configuration audit" },
]

export function TaxConfig() {
  const [params, setParams] = useSearchParams()
  const section = params.get("section") ?? (params.get("doc") ? "determine" : "engine")
  const tax = useSlice("admin").tax
  const { role } = useCore()
  const finance = roleGroupOf(role) === "Finance"
  return (
    <ConfigPage
      header={{
        title: "Tax configuration",
        screenId: "INV-CONFIG-TAX",
        description: "The operational tax determination layer between Material Master tax data, customer and vendor tax profiles and the Avalara engine (ACC 19). ACC 19 owns tax codes, GL mapping and filing; this screen owns determination policy and region handling. Phase 1 scope: US and Canada.",
        chips: (
          <>
            <Chip kind="design" note="Route /configuration/tax is a design value; the PRD gives /inventory/configuration/tax">Design route</Chip>
            {!finance && <Chip kind="block" note="Tax configuration is maintained by Finance; you can read it">Read-only for {role}</Chip>}
          </>
        ),
      }}
      sections={SECTIONS}
      section={section}
      onSectionChange={(id) => setParams({ section: id })}
      effectiveDated
    >
      {section === "engine" && <EngineSection />}
      {section === "nexus" && <NexusSection />}
      {section === "rates" && <RatesSection />}
      {section === "recon" && <ReconSection />}
      {section === "determine" && <DetermineSection />}
      {section === "audit" && (
        <DataTable
          rows={[...tax.audit].reverse()}
          rowId={(a) => a.at + a.change}
          densityKey="INV-CONFIG-TAX-audit"
          caption="Configuration audit trail"
          empty={{ title: "No configuration changes yet." }}
          columns={[
            { id: "at", header: "When", value: (a) => a.at, cell: (a) => <span className="text-xs tabular">{fmtDateTime(a.at)}</span> },
            { id: "by", header: "Changed by", value: (a) => userName(a.by) },
            { id: "what", header: "Change", value: (a) => a.change },
            { id: "eff", header: "Effective", value: (a) => a.effectiveFrom, mono: true },
            { id: "first", header: "First document affected", value: (a) => a.firstDocument },
          ]}
        />
      )}
      <RulesPanel
        rules={[
          ["§11.1", "Determination precedence: each step fills only parameters the previous steps left empty", "DOC:p.45 §11.1"],
          ["§11.2", "RMA credits inherit the original invoice's codes: hard rule, not configurable; estimates (not commits) may be disabled", "DOC:p.45 §11.2"],
          ["§11.4", "Only states in the nexus register collect tax; sales into non-nexus states post tax $0 with reason Non-Nexus; crossing 80% of a threshold alerts the Controller", "DOC:p.46 §11.4"],
          ["§11.5-a", "Avalara mode: rates are never maintained in PE ERP; the manual rate table is read-only and grayed", "DOC:p.46 §11.5"],
          ["§11.5-b", "Manual mode: rate rows are effective-dated; edits create new rows (history immutable); changes route to Controller approval", "DOC:p.46 §11.5"],
          ["§11.5-c", "Posted documents are never restated; corrections by credit note + rebill or a tax-only adjustment JE (approval: Controller)", "DOC:p.46 §11.5"],
        ]}
      />
    </ConfigPage>
  )
}

function EngineSection() {
  const tax = useSlice("admin").tax
  const { role } = useCore()
  const finance = roleGroupOf(role) === "Finance"
  const [codes, setCodes] = useState<Record<string, string>>(tax.defaultCodes)
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Tax engine mode" className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Tax engine mode</h2>
        <RadioGroup className="mt-2 flex gap-6" value={tax.engineMode} onValueChange={(v) => act(setEngineMode(v as "Avalara" | "Manual Tables"))} disabled={role !== "Controller"}>
          {(["Avalara", "Manual Tables"] as const).map((m) => (
            <div key={m} className="flex items-center gap-2">
              <RadioGroupItem id={`mode-${m}`} value={m} />
              <Label htmlFor={`mode-${m}`}>{m}{m === "Avalara" ? " (default)" : " (pre-integration and test systems)"}</Label>
            </div>
          ))}
        </RadioGroup>
        <p className="mt-2 text-xs text-muted-foreground">Engine mode is switched by the Controller (AR-17). Avalara unreachable → override rate with Override badge; documents post and the recalc queue retries every 15 min (JOB-10, <Link className="text-link underline-offset-4 hover:underline" to="/operations/jobs?job=JOB-10">job console</Link>).</p>
      </section>
      <section aria-label="Default tax codes" className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Default tax codes per document family</h2>
        <div className="mt-2 grid gap-4 md:grid-cols-4">
          {DEFAULT_TAX_CODES.map((c) => (
            <Field key={c.family} id={`code-${c.family}`} label={c.family} hint={c.note}>
              {c.configurable ? (
                <div className="flex gap-2">
                  <Input id={`code-${c.family}`} value={codes[c.family] ?? ""} disabled={!finance} onChange={(e) => setCodes({ ...codes, [c.family]: e.target.value })} />
                  <Button variant="outline" size="sm" disabled={!finance || codes[c.family] === tax.defaultCodes[c.family]} onClick={() => act(setDefaultCode(c.family, codes[c.family]))}>Save</Button>
                </div>
              ) : (
                <p className="text-sm">{c.code}</p>
              )}
            </Field>
          ))}
        </div>
      </section>
      <section aria-label="Calculation trigger points" className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Calculation trigger points (mirrors ACC 19.1.2)</h2>
        <ul className="mt-2 flex flex-wrap gap-6">
          {TRIGGER_POINTS.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <Checkbox id={`trg-${t.id}`} checked={tax.triggers[t.id]} disabled={!finance || t.kind === "commit"} onCheckedChange={(v) => act(setTrigger(t.id, v === true))} />
              <Label htmlFor={`trg-${t.id}`}>{t.label} <span className="text-xs text-muted-foreground">({t.event})</span></Label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Estimates can be disabled for performance; commits cannot.</p>
      </section>
      <dl className="grid gap-4 md:grid-cols-2">
        <KV k="Rounding">Line-level rounding, half-up, to currency minor unit; document total = sum of rounded lines (matches Avalara)</KV>
        <KV k="Freight taxability">Per state matrix maintained by Avalara; manual override list for Manual mode</KV>
      </dl>
    </div>
  )
}

function NexusSection() {
  const tax = useSlice("admin").tax
  const { role } = useCore()
  const loading = useFirstVisitLoading("INV-CONFIG-TAX-nexus")
  const finance = roleGroupOf(role) === "Finance"
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ state: "IA", country: "US" as "US" | "CA", entityId: "LE-TBD-10", type: "Economic" as "Physical" | "Economic", effectiveFrom: "2026-11-01", registrationNo: "", filingFrequency: "Quarterly" as "Monthly" | "Quarterly" | "Annual" })
  return (
    <div className="flex flex-col gap-6">
      <DataTable
        rows={tax.nexus}
        rowId={(n) => n.id}
        loading={loading}
        densityKey="INV-CONFIG-TAX-nexus"
        caption="Nexus register"
        searchText={(n) => `${n.state} ${n.entityId} ${n.registrationNo}`}
        searchPlaceholder="Search states and registrations"
        empty={{ title: "No nexus rows: no state collects tax.", body: "Sales into a state not in this register post tax $0 with reason Non-Nexus." }}
        toolbar={<Button onClick={() => setOpen(true)} disabled={!finance} title={finance ? undefined : "Finance maintains nexus rows"}>Add nexus row</Button>}
        columns={[
          { id: "state", header: "State / jurisdiction", value: (n) => n.state, sortable: true, mono: true },
          { id: "entity", header: "Entity", value: (n) => LEGAL_ENTITIES.find((e) => e.id === n.entityId)?.name ?? n.entityId, filterable: true },
          { id: "type", header: "Nexus type", value: (n) => n.type, filterable: true },
          { id: "from", header: "Effective from", value: (n) => n.effectiveFrom, mono: true, sortable: true },
          { id: "reg", header: "Registration #", value: (n) => n.registrationNo, mono: true },
          { id: "freq", header: "Filing frequency", value: (n) => n.filingFrequency, filterable: true },
        ]}
      />
      <section aria-label="Economic nexus monitor">
        <h2 className="mb-2 text-sm font-semibold">Economic nexus monitor (rolling 12 months, JOB-05 daily)</h2>
        <DataTable
          rows={tax.thresholds}
          rowId={(t) => t.state}
          densityKey="INV-CONFIG-TAX-monitor"
          caption="Economic nexus monitor"
          columns={[
            { id: "state", header: "State", value: (t) => t.state, mono: true },
            { id: "sales", header: "Rolling 12-month sales", value: (t) => t.rolling12Sales, align: "right", mono: true, sortable: true, cell: (t) => fmtMoney(t.rolling12Sales) },
            { id: "thr", header: "Threshold", value: (t) => t.salesThreshold, align: "right", mono: true, cell: (t) => `${fmtMoney(t.salesThreshold)}${t.txnThreshold ? ` or ${t.txnThreshold} txns` : ""}` },
            { id: "txn", header: "Transactions", value: (t) => t.rolling12Txns, align: "right", mono: true },
            { id: "pct", header: "Of threshold", value: (t) => Math.round((t.rolling12Sales / t.salesThreshold) * 100), align: "right", sortable: true, cell: (t) => { const p = Math.round((t.rolling12Sales / t.salesThreshold) * 100); return <span className={p >= 80 ? "font-semibold text-status-pending-ink" : ""}>{p}%</span> } },
            { id: "alert", header: "Alert to Controller", value: (t) => t.alertRaisedOn ?? "", cell: (t) => (t.alertRaisedOn ? <span className="text-xs">Raised {t.alertRaisedOn}{tax.nexus.some((n) => n.state === t.state) ? " · registered" : " · register?"}</span> : "") },
          ]}
        />
        <p className="mt-1 text-xs text-muted-foreground">Crossing 80% of a threshold raises an alert to the Controller to register [DOC:p.46 §11.4]. Threshold values and monitored states are design values (AR-25); the PRD says the table is maintained annually.</p>
      </section>
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title="Add nexus row"
        consequence={`${f.state} starts collecting tax for ${LEGAL_ENTITIES.find((e) => e.id === f.entityId)?.name} on documents with a tax point on or after ${f.effectiveFrom}. Posted documents are never restated.`}
        confirmLabel="Add to register"
        onConfirm={() => act(addNexus({ ...f, entityId: f.entityId as LegalEntityId, state: f.state.toUpperCase() }))}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field id="nx-state" label="State or province code"><Input id="nx-state" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} /></Field>
          <Field id="nx-entity" label="Entity"><SimpleSelect id="nx-entity" value={f.entityId} onChange={(v) => setF({ ...f, entityId: v, country: v === "LE-TBD-30" ? "CA" : "US" })} options={LEGAL_ENTITIES.map((e) => ({ value: e.id, label: e.name }))} /></Field>
          <Field id="nx-type" label="Nexus type"><SimpleSelect id="nx-type" value={f.type} onChange={(v) => setF({ ...f, type: v as "Physical" | "Economic" })} options={["Physical", "Economic"].map((x) => ({ value: x, label: x }))} /></Field>
          <Field id="nx-from" label="Effective from"><Input id="nx-from" type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></Field>
          <Field id="nx-reg" label="Registration #"><Input id="nx-reg" value={f.registrationNo} onChange={(e) => setF({ ...f, registrationNo: e.target.value })} /></Field>
          <Field id="nx-freq" label="Filing frequency"><SimpleSelect id="nx-freq" value={f.filingFrequency} onChange={(v) => setF({ ...f, filingFrequency: v as "Monthly" | "Quarterly" | "Annual" })} options={["Monthly", "Quarterly", "Annual"].map((x) => ({ value: x, label: x }))} /></Field>
        </div>
      </DialogShell>
    </div>
  )
}

function RatesSection() {
  const tax = useSlice("admin").tax
  const { role } = useCore()
  const manual = tax.engineMode === "Manual Tables"
  const finance = roleGroupOf(role) === "Finance"
  const [open, setOpen] = useState(false)
  const [jur, setJur] = useState("NE state")
  const [rate, setRate] = useState("5.5")
  const [from, setFrom] = useState("2026-11-01")
  return (
    <div className={manual ? "flex flex-col gap-4" : "flex flex-col gap-4 opacity-60"} aria-disabled={!manual}>
      <p className="text-sm">{manual ? "Manual Tables mode: rate rows are effective-dated; a change creates a new row and routes to the Controller." : "Avalara mode: rates are never maintained in PE ERP. The table is read-only and grayed."}</p>
      <DataTable
        rows={tax.manualRates}
        rowId={(r) => r.id}
        densityKey="INV-CONFIG-TAX-rates"
        caption="Manual rate table"
        toolbar={<Button variant="outline" disabled={!manual || !finance} title={!manual ? "Read-only in Avalara mode" : !finance ? "Finance maintains rates" : undefined} onClick={() => setOpen(true)}>New dated row</Button>}
        columns={[
          { id: "id", header: "Row", value: (r) => r.id, mono: true },
          { id: "jur", header: "Jurisdiction", value: (r) => r.jurisdiction, sortable: true },
          { id: "rate", header: "Rate %", value: (r) => r.ratePct, align: "right", mono: true, cell: (r) => r.ratePct.toFixed(3) },
          { id: "from", header: "Valid from", value: (r) => r.validFrom, mono: true, sortable: true },
          { id: "to", header: "Valid to", value: (r) => r.validTo ?? "", mono: true },
          { id: "state", header: "State", value: (r) => r.state, filterable: true, cell: (r) => <StateText tone={r.state === "Pending approval" ? "attention" : r.state === "Active" ? "default" : "muted"}>{r.state}</StateText> },
          { id: "req", header: "Approval", value: (r) => r.requestId ?? "", cell: (r) => (r.requestId ? <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${r.requestId}`}>{r.requestId}</Link> : "") },
        ]}
      />
      <p className="text-xs text-muted-foreground">Documents always use the rate valid on their tax point date (invoice date). Rate values are design values (AR-25).</p>
      <DialogShell open={open} onOpenChange={setOpen} title="New dated rate row" consequence={`Adds ${jur} at ${rate}% from ${from} as a new row (history immutable) and sends it to the Controller. The current row ends the day before once approved.`} confirmLabel="Send to Controller" onConfirm={() => act(proposeRate(jur, Number(rate), from))}>
        <div className="grid grid-cols-3 gap-4">
          <Field id="mr-jur" label="Jurisdiction"><Input id="mr-jur" value={jur} onChange={(e) => setJur(e.target.value)} /></Field>
          <Field id="mr-rate" label="Rate %"><Input id="mr-rate" type="number" step="0.001" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
          <Field id="mr-from" label="Valid from"><Input id="mr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        </div>
      </DialogShell>
    </div>
  )
}

function ReconSection() {
  const tax = useSlice("admin").tax
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Monthly, the Tax Reconciliation report (ACC 19.3) is reviewed; unexplained GL-vs-Avalara differences become tax adjustment JEs (approval: Controller).</p>
      <DataTable
        rows={tax.recon}
        rowId={(r) => r.id}
        densityKey="INV-CONFIG-TAX-recon"
        caption="Tax reconciliation"
        columns={[
          { id: "m", header: "Month", value: (r) => r.month, sortable: true, cell: (r) => fmtMonth(r.month) },
          { id: "e", header: "Entity", value: (r) => LEGAL_ENTITIES.find((x) => x.id === r.entityId)?.name ?? r.entityId },
          { id: "gl", header: "GL tax", value: (r) => r.glTax, align: "right", mono: true, cell: (r) => fmtMoney(r.glTax, r.entityId === "LE-TBD-30" ? "CAD" : "USD") },
          { id: "av", header: "Avalara", value: (r) => r.avalaraTax, align: "right", mono: true, cell: (r) => fmtMoney(r.avalaraTax, r.entityId === "LE-TBD-30" ? "CAD" : "USD") },
          { id: "ex", header: "Explained", value: (r) => r.explained, align: "right", mono: true, cell: (r) => fmtMoney(r.explained) },
          { id: "un", header: "Unexplained", value: (r) => r.avalaraTax - r.glTax - r.explained, align: "right", mono: true, cell: (r) => { const u = Math.round((r.avalaraTax - r.glTax - r.explained) * 100) / 100; return <span className={u ? "font-semibold text-status-pending-ink" : ""}>{fmtMoney(u)}</span> } },
          { id: "rev", header: "Reviewed", value: (r) => r.reviewedOn ?? "", cell: (r) => (r.reviewedOn ? <span className="text-xs">{userName(r.reviewedBy)} · {r.reviewedOn}</span> : <Button size="sm" variant="outline" onClick={() => act(reviewRecon(r.id))}>Mark reviewed</Button>) },
          { id: "adj", header: "Adjustment JE", value: (r) => r.adjustmentRequestId ?? "", cell: (r) => { const u = Math.round((r.avalaraTax - r.glTax - r.explained) * 100) / 100; return r.adjustmentRequestId ? <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${r.adjustmentRequestId}`}>{r.adjustmentRequestId}</Link> : u ? <Button size="sm" variant="ghost" onClick={() => act(proposeTaxAdjustment(r.id))}>Propose to Controller</Button> : "" } },
        ]}
      />
      <p className="text-xs text-muted-foreground">Amounts are design values. The adjustment JE posts on the ACC side and has no Part J template number.</p>
    </div>
  )
}

function DetermineSection() {
  const tax = useSlice("admin").tax
  const [params] = useSearchParams()
  const [customerId, setCustomerId] = useState<string>(params.get("customer") ?? HERO.customerId)
  const [family, setFamily] = useState("Sales")
  const c = CUSTOMERS.find((x) => x.id === customerId)!
  const shipTo = c.taxProfile.nexus[0]
  const entityId = c.entityId
  const shipFrom = WAREHOUSES[c.currency === "CAD" ? 1 : 0]
  const nexus = tax.nexus.find((n) => n.entityId === entityId && (n.state === shipTo || n.state.startsWith(`${shipTo}-`) || (c.currency === "CAD" && n.state === "CA-GST/HST")))
  const steps: [string, string][] = [
    ["Manual override", "None on this line (Finance only, reason mandatory)"],
    ["Exemption certificate", c.taxProfile.exempt ? `Verified certificate for ${shipTo}: exemption code set, Avalara returns $0` : "No exemption certificate on file"],
    ["Tax profile", family === "RMA credits" ? "RMA credits inherit the original invoice’s codes (hard rule)" : `Default code ${tax.defaultCodes[family] ?? "S1"}; Tax Address Role Ship-To`],
    ["Item tax data", "Tax Category Taxable, product tax code from the Sales tab (design value for FIN-TBD-20MVA)"],
    ["Jurisdiction", `Ship-from ${shipFrom.name}; ship-to ${shipTo}. ${nexus ? `Nexus ${nexus.state} (${nexus.type}, ${nexus.registrationNo}): tax collected` : "No nexus row: tax $0 with reason Non-Nexus"}`],
    ["Failover", tax.engineMode === "Avalara" ? "Avalara reachable; on timeout the override rate applies and the document queues for recalc (JOB-10)" : "Manual Tables mode: rate valid on the tax point date"],
  ]
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <p className="text-sm">Tax questions from any document land here: the resolution walks the precedence in order, each step filling only what the earlier steps left empty.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="dt-cust" label="Customer"><SimpleSelect id="dt-cust" value={customerId} onChange={setCustomerId} options={CUSTOMERS.map((x) => ({ value: x.id, label: `${x.name} (${x.taxProfile.nexus[0]})` }))} /></Field>
        <Field id="dt-fam" label="Document family"><SimpleSelect id="dt-fam" value={family} onChange={setFamily} options={["Sales", "Intercompany", "RMA credits"].map((x) => ({ value: x, label: x }))} /></Field>
      </div>
      {customerId === HERO.customerId && (
        <p className="flex flex-wrap items-center gap-2 text-sm">Hero thread: <Link className="font-mono text-link underline-offset-4 hover:underline" to="/sales/orders?ir=IR-TBD-0031">IR-TBD-0031</Link> milestone invoice for <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/sales/orders/${HERO.phase1Order}`}>{HERO.phase1Order}</Link><StatusBadge kind="salesOrder" status="Shipped" size="sm" /> committed to Avalara on 2026-08-14 (IF-16).</p>
      )}
      <ol className="flex flex-col gap-2">
        {TAX_PRECEDENCE.map(([name, rule], i) => (
          <li key={name} className="rounded-md border px-4 py-2 text-sm">
            <p className="font-medium">{i + 1}. {name}</p>
            <p className="text-xs text-muted-foreground">{rule}</p>
            <p className="mt-1">{steps[i][1]}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
