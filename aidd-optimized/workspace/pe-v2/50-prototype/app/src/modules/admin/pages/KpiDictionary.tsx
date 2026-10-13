// FX-WF-KPI KPI dictionary register [DOC:p.217 Book IV §7.5]: "one controlled row per KPI: formula, grain, filters,
// owner, target, source lineage, freshness class. A number that appears on two dashboards from two formulas is a
// defect." Freshness classes: real-time (operational queues), 15-minute (dashboards), daily (analytics). The formulas,
// targets and owners below are readings (AR-37); the PRD names the 15 seed KPIs, not their definitions.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Chip, ErrorAlert, KV, RulesPanel } from "@/components/patterns"
import { DialogShell, ListPage } from "@/components/templates"
import { ALL_ROLES, type Role } from "@/data/domain"
import { addDays, fmtDate } from "@/lib/format"
import { TODAY } from "@/data/shared"
import { useCore, useSlice } from "@/store"
import { addKpi, alignKpi, proposeKpi } from "../data/cfg-actions"
import type { Freshness, Kpi, KpiValue } from "../data/cfg-types"
import { inForce, nextOf, verState } from "../lib/cfg"
import { Field, SimpleSelect, StateText, userName } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

const FRESH: { value: Freshness; label: string }[] = [{ value: "Real-time", label: "Real-time (operational queues)" }, { value: "15-minute", label: "15-minute (dashboards)" }, { value: "Daily", label: "Daily (analytics)" }]
const blank: KpiValue = { formula: "", grain: "", filters: "", target: "", lineage: "", freshness: "Daily" }

export function KpiDictionary() {
  const [params, setParams] = useSearchParams()
  const s = useSlice("adminCfg")
  const a = useSlice("admin")
  const { role } = useCore()
  const view = useView("FX-WF-KPI")
  const open = s.kpis.find((k) => k.id === params.get("kpi"))
  const [dialog, setDialog] = useState<null | "new" | "edit">(null)
  const cur = (k: Kpi) => inForce(k.versions, a.instances)?.value
  const defects = s.kpis.filter((k) => k.competing?.length)
  const rows = view.empty ? [] : s.kpis
  const setKpi = (id?: string) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set("kpi", id); else n.delete("kpi"); return n })

  return (
    <div className="flex flex-col gap-4">
      <StateFrame view={view} cols={7} emptyTitle="The dictionary is empty." emptyBody="The 15 seed KPIs come from Book IV §7.5; Scenario reset restores them." degraded="Degraded: the reporting replica is behind by more than 15 minutes. Definitions here are unaffected; dashboard numbers may lag." subject="the KPI dictionary">
        {defects.length > 0 && (
          <ErrorAlert title={`${defects.length} KPI${defects.length === 1 ? "" : "s"} computed from two formulas`}>
            {defects.map((k) => <span key={k.id} className="block">{k.id} {k.name}: the dictionary row and {k.competing!.map((c) => c.where).join(", ")} disagree. That is a defect; the owner aligns it below.</span>)}
          </ErrorAlert>
        )}
        <ListPage<Kpi>
          header={{
            title: "KPI dictionary",
            screenId: "FX-WF-KPI",
            description: "One controlled row per KPI, read by every dashboard and report. A change is a new dated version approved by the KPI's owner.",
            chips: <Chip kind="design" note="Route /configuration/kpi-dictionary, the formulas, targets and owners are design values (AR-37)">Design route</Chip>,
            actions: <StatePicker view={view} />,
            primary: <Button onClick={() => setDialog("new")} disabled={!!view.writeError()}>Add KPI</Button>,
          }}
          table={{
            rows,
            rowId: (k) => k.id,
            loading: view.loading,
            caption: "KPI dictionary",
            searchText: (k) => `${k.id} ${k.name} ${k.owner} ${cur(k)?.formula ?? ""} ${cur(k)?.lineage ?? ""}`,
            searchPlaceholder: "Search KPIs",
            onRowClick: (k) => setKpi(k.id),
            activeId: open?.id,
            empty: { title: "No KPI matches." },
            columns: [
              { id: "id", header: "KPI", value: (k) => k.id, mono: true, sortable: true },
              { id: "name", header: "Name", value: (k) => k.name, sortable: true, cell: (k) => <span className="font-medium">{k.name}{k.competing?.length ? <span className="ml-2 text-xs font-semibold text-status-pending-ink">Two formulas</span> : null}</span> },
              { id: "formula", header: "Formula", value: (k) => cur(k)?.formula ?? "", className: "max-w-[340px]" },
              { id: "grain", header: "Grain", value: (k) => cur(k)?.grain ?? "" },
              { id: "target", header: "Target", value: (k) => cur(k)?.target ?? "", align: "right" },
              { id: "owner", header: "Owner", value: (k) => k.owner, filterable: true },
              { id: "fresh", header: "Freshness", value: (k) => cur(k)?.freshness ?? "", filterable: true },
              { id: "pend", header: "Next", value: (k) => (nextOf(k.versions, a.instances) ? "Pending" : ""), cell: (k) => { const n = nextOf(k.versions, a.instances); return n ? <StateText tone="attention">{verState(n, k.versions, a.instances)}</StateText> : "" } },
            ],
          }}
        />
        {open && (
          <section aria-label={`${open.id} detail`} className="flex flex-col gap-4 rounded-lg border p-4">
            <h3 className="flex items-center justify-between text-sm font-semibold">{open.id} {open.name}<span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setDialog("edit")} disabled={!!view.writeError()}>Propose change</Button><Button size="sm" variant="ghost" onClick={() => setKpi()}>Close</Button></span></h3>
            <dl className="grid gap-4 md:grid-cols-3">
              <KV k="Formula">{cur(open)?.formula}</KV>
              <KV k="Grain">{cur(open)?.grain}</KV>
              <KV k="Filters">{cur(open)?.filters}</KV>
              <KV k="Target">{cur(open)?.target}</KV>
              <KV k="Source lineage"><span className="font-mono text-xs">{cur(open)?.lineage}</span></KV>
              <KV k="Freshness class">{cur(open)?.freshness}</KV>
              <KV k="Owner">{open.owner}</KV>
              <KV k="Source">{open.source}</KV>
              <KV k="Shown on">{open.shownOn.join(", ")}</KV>
            </dl>
            {open.competing?.map((c) => (
              <div key={c.where} role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-status-exception p-3 text-sm">
                <span><span className="font-semibold">{c.where}</span> computes it as: {c.formula}</span>
                <Button size="sm" className="ml-auto" disabled={role !== open.owner || !!view.writeError()} title={role === open.owner ? undefined : `Owner: ${open.owner}`} onClick={() => view.run(() => alignKpi(open.id))}>Retire competing formula</Button>
              </div>
            ))}
            <ol className="text-xs text-muted-foreground">
              {[...open.versions].reverse().map((v, n) => (
                <li key={n}>{verState(v, open.versions, a.instances)} · from {fmtDate(v.effectiveFrom)} · {v.by === "PRD seed" ? "PRD seed" : userName(v.by)} · {v.note}{v.requestId && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${v.requestId}`}>{v.requestId}</Link></>}</li>
              ))}
            </ol>
          </section>
        )}
      </StateFrame>
      <RulesPanel
        rules={[
          ["7.5-a", "One controlled row per KPI: formula, grain, filters, owner, target, source lineage, freshness class", "DOC:p.217 §7.5"],
          ["7.5-b", "A number that appears on two dashboards from two formulas is a defect", "DOC:p.217 §7.5"],
          ["7.5-c", "Freshness classes: real-time (operational queues), 15-minute (dashboards), daily (analytics); late offline scans restate visibly", "DOC:p.217 §7.5"],
          ["C-50", "A row is never edited in place: a change is a new dated version", "DOC:p.170 §18.2"],
        ]}
      />
      <KpiDialog mode={dialog} kpi={open} onClose={() => setDialog(null)} view={view} />
    </div>
  )
}

function KpiDialog({ mode, kpi, onClose, view }: { mode: null | "new" | "edit"; kpi?: Kpi; onClose: () => void; view: ReturnType<typeof useView> }) {
  const a = useSlice("admin")
  const { role } = useCore()
  const base = mode === "edit" && kpi ? (inForce(kpi.versions, a.instances)?.value ?? blank) : blank
  const [d, setD] = useState<KpiValue | null>(null)
  const [name, setName] = useState("")
  const [owner, setOwner] = useState<Role>(role)
  const [shown, setShown] = useState("")
  const [from, setFrom] = useState(addDays(TODAY, 23))
  const v = d ?? base
  const set = (p: Partial<KpiValue>) => setD({ ...v, ...p })
  return (
    <DialogShell
      wide
      open={!!mode}
      onOpenChange={(o) => { if (!o) { setD(null); setName(""); setShown(""); onClose() } }}
      title={mode === "edit" ? `Propose a change to ${kpi?.name}` : "Add a KPI"}
      consequence={mode === "edit" ? `Creates a new version from ${from} and sends it to ${kpi && role === kpi.owner ? "the Process owner" : `the ${kpi?.owner}`} in WF-INBOX. The definition in force stays until then.` : "Creates the row and sends it to the Process owner. The KPI is in the dictionary once approved."}
      requireReason={mode === "edit"}
      reasonLabel="Why it changes (required)"
      confirmLabel={mode === "edit" ? "Send for approval" : "Add KPI"}
      onConfirm={(note) => view.run(() => (mode === "edit" ? proposeKpi(kpi!.id, v, from, note) : addKpi(name, owner, v, shown)))}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {mode === "new" && <Field id="kpi-name" label="Name"><Input id="kpi-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>}
        {mode === "new" && <Field id="kpi-owner" label="Owner"><SimpleSelect id="kpi-owner" value={owner} onChange={(x) => setOwner(x as Role)} options={ALL_ROLES.map((r) => ({ value: r, label: r }))} /></Field>}
        <Field id="kpi-formula" label="Formula" className="md:col-span-2"><Textarea id="kpi-formula" rows={2} value={v.formula} onChange={(e) => set({ formula: e.target.value })} /></Field>
        <Field id="kpi-grain" label="Grain"><Input id="kpi-grain" value={v.grain} onChange={(e) => set({ grain: e.target.value })} /></Field>
        <Field id="kpi-filters" label="Filters"><Input id="kpi-filters" value={v.filters} onChange={(e) => set({ filters: e.target.value })} /></Field>
        <Field id="kpi-target" label="Target"><Input id="kpi-target" value={v.target} onChange={(e) => set({ target: e.target.value })} /></Field>
        <Field id="kpi-fresh" label="Freshness class"><SimpleSelect id="kpi-fresh" value={v.freshness} onChange={(x) => set({ freshness: x as Freshness })} options={FRESH} /></Field>
        <Field id="kpi-lineage" label="Source lineage" className="md:col-span-2"><Input id="kpi-lineage" value={v.lineage} onChange={(e) => set({ lineage: e.target.value })} placeholder="fact_table.column, fact_table.column" /></Field>
        {mode === "edit" ? <Field id="kpi-from" label="Effective from"><Input id="kpi-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field> : <Field id="kpi-shown" label="Shown on" hint="Dashboards, comma separated"><Input id="kpi-shown" value={shown} onChange={(e) => setShown(e.target.value)} /></Field>}
      </div>
    </DialogShell>
  )
}
