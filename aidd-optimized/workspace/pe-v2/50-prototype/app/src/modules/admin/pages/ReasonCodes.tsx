// FX-CFG-REASONS Reason-code and lookup catalogs [DOC: Book IV A-12; RMA reasons p.26 §3.1]:
// catalogs for RMA reason, short-pack, scrap, hold, quotation loss, count variance and function block. Codes deactivate,
// never delete, so history on old documents keeps reading. Only the RMA, short-pack and Lead Disqualified values are the PRD's;
// the rest are seed values (design) and shown as such.

import { useState } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { addReason, deactivateReason, reactivateReason } from "../data/cfg-actions"
import type { CatalogId, ReasonCode } from "../data/cfg-types"
import { can } from "../lib/cfg"
import { Field, StateText } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

const CATALOGS: { id: CatalogId; label: string; note: string }[] = [
  { id: "rma", label: "RMA reason", note: "The nine RMA reasons of Book I A §3.1. Each drives the restocking fee default and who pays freight (RMA policy)." },
  { id: "shortpack", label: "Short-pack", note: "Short Pick, Damage and Hold: the reasons a Complete Pack Order may be short-packed." },
  { id: "scrap", label: "Scrap", note: "Production confirmation scrap reasons: post #20 to 5320 and feed the scrap pareto. Seed values." },
  { id: "hold", label: "Hold", note: "Production hold and andon reasons. Seed values." },
  { id: "loss", label: "Quotation lost", note: "Lost-quotation reasons and the required Lead Disqualified reason. Seed values apart from Disqualified." },
  { id: "count", label: "Count variance", note: "Reason a count variance is explained before approval (INV §7). Seed values." },
  { id: "block", label: "Function block", note: "Function-specific block reasons (Book II §4.5) and the recall campaign block. Seed values." },
]

export function ReasonCodes() {
  const [params, setParams] = useSearchParams()
  const cat = (params.get("catalog") as CatalogId) || "rma"
  const view = useView("FX-CFG-REASONS")
  const s = useSlice("adminCfg")
  const { role } = useCore()
  const [add, setAdd] = useState(false)
  const [off, setOff] = useState<ReasonCode | null>(null)
  const [f, setF] = useState({ code: "", label: "", usedBy: "" })
  const info = CATALOGS.find((c) => c.id === cat) ?? CATALOGS[0]
  const rows = view.empty ? [] : s.reasons.filter((r) => r.catalog === cat)
  const allowed = can.reason(role) && !view.writeError()
  return (
    <ConfigPage
      header={{
        title: "Reason codes and lookups",
        screenId: "FX-CFG-REASONS",
        description: "The picklists the process screens read. A code is never deleted: it is deactivated, and documents that used it keep reading it.",
        chips: <Chip kind="design" note="Route /configuration/reason-codes is a design value; the catalogs follow Book IV A-12">Design route</Chip>,
        actions: <StatePicker view={view} />,
        primary: <Button onClick={() => setAdd(true)} disabled={!allowed} title={can.reason(role) ? undefined : "The process owner or Plant IT maintains catalogs"}>Add reason</Button>,
      }}
      sections={CATALOGS.map((c) => ({ id: c.id, label: `${c.label} (${s.reasons.filter((r) => r.catalog === c.id && r.active).length})` }))}
      section={cat}
      onSectionChange={(id) => setParams({ catalog: id })}
    >
      <StateFrame view={view} cols={6} emptyTitle="No reasons in this catalog." emptyBody="A catalog keeps at least one active reason; Scenario reset restores the seed." degraded="Degraded: some screens may show a cached picklist for a few minutes." subject="this catalog">
        <p className="mb-2 max-w-3xl text-sm">{info.note}</p>
        <DataTable<ReasonCode>
          rows={rows}
          rowId={(r) => r.id}
          loading={view.loading}
          densityKey="FX-CFG-REASONS"
          caption={`${info.label} reasons`}
          searchText={(r) => `${r.code} ${r.label} ${r.usedBy}`}
          searchPlaceholder="Search reasons"
          columns={[
            { id: "c", header: "Code", value: (r) => r.code, mono: true, sortable: true },
            { id: "l", header: "Label shown to users", value: (r) => r.label, sortable: true },
            { id: "u", header: "Used by", value: (r) => r.usedBy, className: "max-w-[320px]" },
            { id: "s", header: "Source", value: (r) => r.source, filterable: true, cell: (r) => (r.source === "PRD" ? <span className="text-xs">Specification</span> : <Chip kind="design" note="The specification names the catalog but not this value">Seed value</Chip>) },
            { id: "st", header: "State", value: (r) => (r.active ? "Active" : "Inactive"), filterable: true, cell: (r) => <StateText tone={r.active ? "default" : "muted"}>{r.active ? `Active since ${fmtDate(r.validFrom)}` : `Inactive from ${fmtDate(r.deactivatedFrom ?? r.validFrom)}`}</StateText> },
            { id: "a", header: "", cell: (r) => r.active ? <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setOff(r)}>Deactivate</Button> : <Button size="sm" variant="outline" disabled={!allowed} onClick={() => view.run(() => reactivateReason(r.id))}>Reactivate</Button> },
          ]}
        />
      </StateFrame>
      <RulesPanel rules={[["A-12", "Reason-code catalogs are controlled lookups; usage is per screen", "DOC: Book IV A-12"], ["§3.1", "Nine RMA reasons; the reason drives restocking fee default and freight payer", "DOC:p.26 §3.1"], ["C-50", "A retired value is deactivated with a date, never deleted", "DOC:p.170"]]} />
      <DialogShell
        open={add}
        onOpenChange={(o) => { if (!o) { setAdd(false); setF({ code: "", label: "", usedBy: "" }) } }}
        title={`Add a ${info.label.toLowerCase()} reason`}
        consequence="The value appears in the picklist at once. It cannot be deleted later, only deactivated."
        confirmLabel="Add reason"
        onConfirm={() => { const e = view.run(() => addReason(cat, f.code, f.label, f.usedBy)); if (!e) { setAdd(false); setF({ code: "", label: "", usedBy: "" }) } return e }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="rc-code" label="Code" hint="For example SC-DIM"><Input id="rc-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <Field id="rc-label" label="Label"><Input id="rc-label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <Field id="rc-used" label="Used by (optional)" className="md:col-span-2"><Input id="rc-used" value={f.usedBy} onChange={(e) => setF({ ...f, usedBy: e.target.value })} /></Field>
        </div>
      </DialogShell>
      <DialogShell open={!!off} onOpenChange={(o) => !o && setOff(null)} title={`Deactivate ${off?.code ?? ""}`} consequence={`${off?.label ?? ""} leaves the picklist from today; documents that used it keep reading it.`} requireReason={off?.source === "PRD"} reasonLabel="Why it is retired (required for a specification value)" destructive confirmLabel="Deactivate" onConfirm={(r) => (off ? view.run(() => deactivateReason(off.id, r)) : null)} />
    </ConfigPage>
  )
}
