// CFG-CORE Core Configuration Set (Config screens) [DOC:p.276 §15] (asserted): "Number series, fiscal
// periods, tax determination, RMA policies, sales and production and engineering and quality settings,
// each per its specification. Maintain under change control. Creates or updates the seed data catalog
// of the configuration workbook. Period control gates every posting date." Users: per owner column.
// Values are the PRD's own thresholds (src/data/domain/approvals.ts THRESHOLDS); a change is a new
// effective-dated version routed to the setting's owner (AR-15), never an in-place edit (C-50).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, ErrorAlert, KV, RulesPanel, StatusBadge, useFirstVisitLoading } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { LEGAL_ENTITIES, TODAY } from "@/data/shared"
import { addDays } from "@/lib/format"
import { useSlice } from "@/store"
import { INVENTORY_LABEL } from "../data/catalog"
import { proposeSeries, proposeSetting } from "../data/actions"
import type { NumberSeries, Setting } from "../data/types"
import { act, Field, StateText, userName } from "../components/common"

const SETTING_SECTIONS: [string, string][] = [
  ["rma", "RMA policies"],
  ["sales", "Sales settings"],
  ["production", "Production settings"],
  ["engineering", "Engineering settings"],
  ["quality", "Quality settings"],
  ["purchasing", "Purchasing settings"],
  ["inventory", "Inventory settings"],
]

export function CoreConfig() {
  const [params, setParams] = useSearchParams()
  const section = params.get("section") ?? "numbers"
  const s = useSlice("admin")
  const loading = useFirstVisitLoading("CFG-CORE")
  const [editing, setEditing] = useState<Setting | null>(null)
  const [editingSeries, setEditingSeries] = useState<NumberSeries | null>(null)

  return (
    <ConfigPage
      header={{
        title: "Core configuration set",
        screenId: "CFG-CORE",
        description: "The seed catalog of the configuration workbook (A-12): number series, period control, tax determination, RMA policies and module settings, each maintained by the owner of its register row under change control.",
        chips: <Chip kind="design" note="Route /configuration/core and the section grouping are design values; Book VI gives /configuration/*">Design route</Chip>,
      }}
      sections={[
        { id: "numbers", label: "Number series" },
        { id: "periods", label: "Fiscal periods" },
        { id: "tax", label: "Tax determination" },
        ...SETTING_SECTIONS.map(([id, label]) => ({ id, label })),
        { id: "sod", label: "SoD exceptions" },
      ]}
      section={section}
      onSectionChange={(id) => setParams({ section: id })}
      effectiveDated
    >
      {!["numbers", "periods", "tax", "sod", ...SETTING_SECTIONS.map(([id]) => id)].includes(section) && (
        <ErrorAlert title={`Section "${section}" not found`} onDismiss={() => setParams({ section: "numbers" })}>The core configuration set has ten sections; pick one from the section list.</ErrorAlert>
      )}
      {section === "numbers" && (
        <DataTable
          rows={s.series}
          rowId={(n) => n.id}
          loading={loading}
          densityKey="CFG-CORE-series"
          caption="Number series"
          columns={[
            { id: "obj", header: "Object", value: (n) => n.object, sortable: true },
            { id: "fmt", header: "Format", value: (n) => n.format, mono: true },
            { id: "next", header: "Next number", value: (n) => n.next, align: "right", mono: true, cell: (n) => (n.next ? n.next : "ACC") },
            { id: "gap", header: "Gap policy", value: (n) => (n.gapFree ? "Gap-free" : "Gap-tolerant"), filterable: true },
            { id: "src", header: "Source", value: (n) => n.source },
            { id: "chg", header: "Next version", value: (n) => n.changes.find((c) => c.state !== "Rejected")?.format ?? "", cell: (n) => { const c = n.changes.filter((x) => x.state !== "Rejected").at(-1); return c ? <span className="text-xs">{c.format}, next {c.next} from {c.effectiveFrom} · <StateText tone={c.state === "Pending approval" ? "attention" : "muted"}>{c.state}</StateText></span> : <span className="text-xs text-muted-foreground">None</span> } },
            { id: "act", header: "", cell: (n) => <Button size="sm" variant="outline" disabled={n.next === 0 || n.changes.some((c) => c.state === "Pending approval")} title={n.next === 0 ? "Invoice numbers come from ACC (V2.0), outside the knowledge base" : undefined} onClick={() => setEditingSeries(n)}>Propose change</Button> },
          ]}
        />
      )}
      {section === "numbers" && <p className="mt-2 text-xs text-muted-foreground">Document numbers come from gap-free series where finance requires (invoices) and gap-tolerant elsewhere (performance), per series configuration [DOC:p.185 B §2]. Formats marked Placeholder carry TBD until the client gives them (OQ-30).</p>}

      {section === "periods" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm">Period control gates every posting date. One period record per entity per month; the full control lives on <Link className="text-link underline-offset-4 hover:underline" to="/inventory/configuration/fiscal-periods">INV-CONFIG-PERIOD</Link>.</p>
          <dl className="grid gap-4 md:grid-cols-2">
            {LEGAL_ENTITIES.map((e) => {
              const ps = s.periods.filter((p) => p.entityId === e.id && (p.status === "Open" || p.status === "Soft Close"))
              return (
                <KV key={e.id} k={`${e.name} (${e.currency})`}>
                  <span className="flex flex-wrap items-center gap-2">
                    {ps.map((p) => (
                      <Link key={p.id} to={`/inventory/configuration/fiscal-periods?section=${e.id}&p=${p.id}`} className="flex items-center gap-1">
                        <span className="font-mono text-link">{p.month}</span>
                        <StatusBadge kind="fiscalPeriod" status={p.status} size="sm" />
                        <span className="text-xs text-muted-foreground">inventory {INVENTORY_LABEL[p.status]}</span>
                      </Link>
                    ))}
                  </span>
                </KV>
              )
            })}
          </dl>
          <Button variant="outline" className="self-start" asChild><Link to="/inventory/configuration/fiscal-periods?section=check">Check a posting date</Link></Button>
        </div>
      )}

      {section === "tax" && (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-4 md:grid-cols-3">
            <KV k="Engine mode">{s.tax.engineMode}</KV>
            <KV k="Nexus rows">{s.tax.nexus.length} across {new Set(s.tax.nexus.map((n) => n.entityId)).size} entities</KV>
            <KV k="Threshold alerts open">{s.tax.thresholds.filter((t) => t.alertRaisedOn && !s.tax.nexus.some((n) => n.state === t.state)).map((t) => t.state).join(", ") || "None"}</KV>
          </dl>
          <Button variant="outline" className="self-start" asChild><Link to="/inventory/configuration/tax">Open tax configuration</Link></Button>
        </div>
      )}

      {SETTING_SECTIONS.some(([id]) => id === section) && (
        <div className="flex flex-col gap-2">
          <DataTable
            rows={s.settings.filter((x) => x.section === section)}
            rowId={(x) => x.id}
            loading={loading}
            densityKey="CFG-CORE-settings"
            caption={SETTING_SECTIONS.find(([id]) => id === section)?.[1]}
            empty={{ title: "No settings in this section." }}
            columns={[
              { id: "label", header: "Setting", value: (x) => x.label, sortable: true },
              { id: "value", header: "In force", value: (x) => inForce(x)?.value ?? "", cell: (x) => <span className="font-medium">{inForce(x)?.value}</span> },
              { id: "next", header: "Next version", value: (x) => nextVersion(x)?.value ?? "", cell: (x) => { const n = nextVersion(x); return n ? <span className="text-xs">{n.value} from {n.effectiveFrom} · <StateText tone={n.state === "Pending approval" ? "attention" : "muted"}>{n.state}</StateText>{n.requestId && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${n.requestId}`}>{n.requestId}</Link></>}</span> : "" } },
              { id: "owner", header: "Owner", value: (x) => x.owner, filterable: true },
              { id: "src", header: "Source", value: (x) => x.source, cell: (x) => <span className="text-xs">[DOC:{x.source}]</span> },
              { id: "hist", header: "History", value: (x) => x.versions.length, align: "right", mono: true },
              { id: "act", header: "", cell: (x) => <Button size="sm" variant="outline" disabled={x.versions.some((v) => v.state === "Pending approval")} onClick={() => setEditing(x)}>Propose change</Button> },
            ]}
          />
          <p className="text-xs text-muted-foreground">Values shown are the PRD's own (asserted). Other modules read them from the shared domain today; an approved change here is the next dated version of the workbook row and is not yet read by them (R-6).</p>
        </div>
      )}

      {section === "sod" && (
        <DataTable
          rows={s.sod}
          rowId={(x) => x.id}
          densityKey="CFG-CORE-sod"
          caption="SoD exceptions"
          empty={{ title: "No SoD exceptions granted." }}
          columns={[
            { id: "id", header: "Exception", value: (x) => x.id, mono: true },
            { id: "user", header: "User", value: (x) => userName(x.user) },
            { id: "grant", header: "Grant", value: (x) => x.grant },
            { id: "exp", header: "Expires", value: (x) => x.expires, mono: true },
            { id: "state", header: "State", value: (x) => x.state, filterable: true, cell: (x) => <StateText tone={x.state === "Pending approval" ? "attention" : x.state === "Expired" ? "muted" : "default"}>{x.state}</StateText> },
            { id: "req", header: "CFO approval (WF-26)", value: (x) => x.requestId ?? "", cell: (x) => (x.requestId ? <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${x.requestId}`}>{x.requestId}</Link> : "") },
          ]}
        />
      )}

      <RulesPanel
        rules={[
          ["CFG", "Maintain under change control; creates or updates the seed data catalog of the configuration workbook", "DOC:p.276 §15"],
          ["C-50", "Effective-dated records are never edited in place; history stays visible", "DOC:p.170 §18.2"],
          ["C-44", "Master data is not period-controlled", "DOC:p.41 §9.2"],
          ["W.1-O", "Changes to a posting-gating configuration add the Controller", "DOC:p.11 W.1"],
          ["B§2", "Gap-free series where finance requires (invoices), gap-tolerant elsewhere", "DOC:p.185 B §2"],
          ["CFG-NS", "Number series are maintained under change control: a change is a new dated version, never an in-place edit; the next number never goes down", "DOC:p.276 §15; p.170 §18.2"],
        ]}
      />
      <ChangeDialog setting={editing} onClose={() => setEditing(null)} />
      <SeriesDialog series={editingSeries} onClose={() => setEditingSeries(null)} />
    </ConfigPage>
  )
}

const inForce = (x: Setting) => x.versions.filter((v) => (v.state === "Active" || v.state === "Scheduled") && v.effectiveFrom <= TODAY).at(-1)
const nextVersion = (x: Setting) => x.versions.find((v) => (v.state === "Pending approval" || v.state === "Scheduled") && v.effectiveFrom > TODAY)

function ChangeDialog({ setting, onClose }: { setting: Setting | null; onClose: () => void }) {
  const [value, setValue] = useState("")
  const [from, setFrom] = useState(addDays(TODAY, 23))
  const steps = setting ? (setting.gatesPosting && setting.owner !== "Controller" ? `${setting.owner}, then the Controller` : setting.owner) : ""
  return (
    <DialogShell
      open={!!setting}
      onOpenChange={(o) => {
        if (!o) {
          setValue("")
          onClose()
        }
      }}
      title={`Propose change: ${setting?.label ?? ""}`}
      consequence={setting ? `Creates a new version (${value || "new value"} from ${from}) and sends it to the ${steps} in WF-INBOX. The value in force (${inForce(setting)?.value}) stays until then.` : undefined}
      requireReason
      reasonLabel="Why it changes (required)"
      confirmLabel="Send for approval"
      onConfirm={(note) => (setting ? act(proposeSetting(setting.id, value, from, note)) : "No setting.")}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field id="chg-val" label="New value"><Input id="chg-val" value={value} onChange={(e) => setValue(e.target.value)} placeholder={setting ? inForce(setting)?.value : ""} /></Field>
        <Field id="chg-from" label="Effective from"><Input id="chg-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      </div>
      {setting && (
        <ol className="text-xs text-muted-foreground">
          {setting.versions.map((v) => <li key={v.changeId}>{v.value} · from {v.effectiveFrom} · {v.state} · {v.by === "PRD seed" ? "PRD seed" : userName(v.by)} · {v.note}</li>)}
        </ol>
      )}
    </DialogShell>
  )
}

function SeriesDialog({ series, onClose }: { series: NumberSeries | null; onClose: () => void }) {
  const [format, setFormat] = useState("")
  const [next, setNext] = useState("")
  const [from, setFrom] = useState(addDays(TODAY, 23))
  const owner = series ? (series.gapFree ? "Controller" : "Plant IT") : ""
  return (
    <DialogShell
      open={!!series}
      onOpenChange={(o) => {
        if (!o) {
          setFormat("")
          setNext("")
          onClose()
        }
      }}
      title={`Propose change: ${series?.object ?? ""} number series`}
      consequence={series ? `Creates a new version (${format || series.format}, next ${next || series.next} from ${from}) and sends it to the ${owner} in WF-INBOX. Numbers already issued and the series in force stay as they are; a gap-free series stays gap-free.` : undefined}
      requireReason
      reasonLabel="Why it changes (required)"
      confirmLabel="Send for approval"
      onConfirm={(note) => (series ? act(proposeSeries(series.id, format || series.format, Number(next || series.next), from, note)) : "No series.")}
    >
      <div className="grid grid-cols-3 gap-4">
        <Field id="ns-fmt" label="Format" hint="Keep a sequence token, for example {SEQ:5}."><Input id="ns-fmt" value={format} onChange={(e) => setFormat(e.target.value)} placeholder={series?.format} /></Field>
        <Field id="ns-next" label="Next number" hint={series ? `Not below ${series.next}.` : undefined}><Input id="ns-next" type="number" value={next} onChange={(e) => setNext(e.target.value)} placeholder={String(series?.next ?? "")} /></Field>
        <Field id="ns-from" label="Effective from"><Input id="ns-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      </div>
      <p className="text-xs text-muted-foreground">The register names no owner for a number series (AR-30): the Controller approves a gap-free series, Plant IT the others.</p>
    </DialogShell>
  )
}
