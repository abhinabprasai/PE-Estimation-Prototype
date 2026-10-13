// FX-CFG-SETTINGS Sales, Production, Engineering and Quality settings (CFG-CORE) [DOC:p.276 §15; p.34-35 Book I A §6.5; p.15 B §2.2]:
// the hub at /configuration/settings and four pages. Settings rows are the same rows as CFG-CORE (admin slice); each change
// is a new dated version approved by the setting's owner. Extra on these pages: credit rules and the pack-order creation
// rule (Sales), and the Quality no-plan policy per plan type (Quality).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, KV, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell, ListPage } from "@/components/templates"
import { TODAY } from "@/data/shared"
import { addDays, fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { proposeNoPlan } from "../data/cfg-actions"
import type { NoPlanPolicy, NoPlanRow } from "../data/cfg-types"
import { inForce as verInForce, nextOf, verState } from "../lib/cfg"
import { Field, SimpleSelect, StateText } from "../components/common"
import { SettingsTable, inForce, nextVersion } from "../components/SettingsTable"
import { StateFrame, StatePicker, useView, type View } from "../components/states"

type Sec = "sales" | "production" | "engineering" | "quality"
const PAGES: Record<Sec, { title: string; id: string; blurb: string; extra: { id: string; label: string }[]; rules: [string, string, string][] }> = {
  sales: {
    title: "Sales settings", id: "FX-CFG-SETTINGS", blurb: "Pricing tolerances, quotation validity, ETO milestone billing, credit rules and the pack-order creation rule.",
    extra: [{ id: "credit", label: "Credit rules" }, { id: "pack", label: "Pack orders" }],
    rules: [["B§2.2-a", "Auto credit check at quotation to order conversion, SO submit, any SO change that raises value, and shipment release", "DOC:p.15 B §2.2"], ["B§2.2-b", "Check: exposure + new order value within the credit limit, and no invoice more than 30 days past due (config). Fail: Credit Hold; the Finance queue releases, rejects or raises the limit (Controller)", "DOC:p.15 B §2.2"], ["B§2.2-c", "The shipment-release gate cannot be bypassed by Sales roles; a Controller release is logged on the order", "DOC:p.15 B §2.2"], ["A§5", "Pack Order number PK-{YYYY}-{SEQ:5} is auto-created when a picklist completes (config: per picklist / per shipment)", "DOC:p.30 A §5"]],
  },
  production: { title: "Production settings", id: "FX-CFG-SETTINGS", blurb: "Labor booking guardrail, the unsettled-order breach, the terminal offline queue limit and the default work center efficiency.", extra: [], rules: [["D", "Labor booking guardrail, default efficiency 85%, unsettled orders breach after 5 days, offline queue holds 4 h", "DOC:pp.69-80, p.126, p.131"]] },
  engineering: { title: "Engineering settings", id: "FX-CFG-SETTINGS", blurb: "Placeholder part aging, the emergency ECR decision SLA and the cost delta that adds the Controller.", extra: [], rules: [["C", "Placeholder alert at 14 days; Emergency ECR CCB decision within 24 h; ECR cost delta above $10,000 adds the Controller", "DOC:p.58, p.62 §4.1"]] },
  quality: {
    title: "Quality settings", id: "FX-CFG-SETTINGS", blurb: "Inspection switching rules, calibration alerts, CAPA and SCAR thresholds, and what happens when a trigger fires with no inspection plan.",
    extra: [{ id: "noplan", label: "No-plan policy" }],
    rules: [["A§6.5-a", "When a trigger fires and no applicable Active plan exists, behavior follows the Quality Policy setting per plan type", "DOC:pp.34-35 A §6.5"], ["A§6.5-b", "Block is the default for INC on QI-required items and for FIN; the trigger cannot complete (E-QM-01)", "DOC:p.35 A §6.5"], ["A§6.5-c", "Auto-Accept with Warning is permitted only for non-QI-required items and never for FIN or PSI", "DOC:p.35 A §6.5"]],
  },
}

const TABS: { to: string; label: string }[] = [{ to: "/configuration/settings", label: "Overview" }, { to: "/configuration/settings/sales", label: "Sales" }, { to: "/configuration/settings/production", label: "Production" }, { to: "/configuration/settings/engineering", label: "Engineering" }, { to: "/configuration/settings/quality", label: "Quality" }]
const SubNav = ({ current }: { current: string }) => (
  <nav aria-label="Settings pages" className="flex flex-wrap gap-1 border-b">
    {TABS.map((t) => <Link key={t.to} to={t.to} aria-current={t.to === current ? "page" : undefined} className={`h-8 border-b-2 px-3 text-sm leading-8 ${t.to === current ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}>{t.label}</Link>)}
  </nav>
)

export function SettingsHub() {
  const s = useSlice("admin")
  const view = useView("FX-CFG-SETTINGS")
  const rows = (["sales", "production", "engineering", "quality"] as Sec[]).map((k) => {
    const xs = s.settings.filter((x) => x.section === k)
    return { key: k, title: PAGES[k].title, blurb: PAGES[k].blurb, count: xs.length, pending: xs.filter((x) => nextVersion(x)?.state === "Pending approval").length, scheduled: xs.filter((x) => nextVersion(x)?.state === "Scheduled").length }
  })
  return (
    <StateFrame view={view} cols={5} emptyTitle="No settings pages." subject="the settings">
      <ListPage<(typeof rows)[number]>
        header={{ title: "Settings", screenId: "FX-CFG-SETTINGS", description: "Sales, Production, Engineering and Quality settings. They are the same rows as the core configuration set, grouped by the module that owns them.", chips: <Chip kind="design" note="Routes /configuration/settings and the four sub-pages are design values">Design route</Chip>, actions: <StatePicker view={view} /> }}
        above={<SubNav current="/configuration/settings" />}
        table={{
          rows: view.empty ? [] : rows,
          rowId: (r) => r.key,
          loading: view.loading,
          caption: "Settings pages",
          rowHref: (r) => `/configuration/settings/${r.key}`,
          empty: { title: "No settings pages." },
          columns: [
            { id: "t", header: "Page", value: (r) => r.title },
            { id: "b", header: "What it holds", value: (r) => r.blurb, className: "max-w-[480px]" },
            { id: "n", header: "Settings", value: (r) => r.count, align: "right", mono: true },
            { id: "p", header: "Waiting for approval", value: (r) => r.pending, align: "right", mono: true, cell: (r) => (r.pending ? <StateText tone="attention">{r.pending}</StateText> : "0") },
            { id: "s", header: "Scheduled", value: (r) => r.scheduled, align: "right", mono: true },
          ],
        }}
        below={<p className="text-sm text-muted-foreground">Purchasing and Inventory settings, number series, periods and tax stay on the <Link className="text-link underline-offset-4 hover:underline" to="/configuration/core">core configuration set</Link>.</p>}
      />
    </StateFrame>
  )
}

export function SettingsSection({ section }: { section: Sec }) {
  const page = PAGES[section]
  const [params, setParams] = useSearchParams()
  const sub = params.get("section") ?? "settings"
  const view = useView(`FX-CFG-SETTINGS-${section}`)
  const s = useSlice("admin")
  const creditIds = ["SET-SD-CRDPTS", "SET-SD-CRDAGE", "SET-SD-CRDGATE", "SET-SD-NOQ"]
  const [pol, setPol] = useState<NoPlanRow | null>(null)
  return (
    <ConfigPage
      header={{
        title: page.title,
        screenId: page.id,
        description: page.blurb,
        crumbs: [{ label: "Settings", to: "/configuration/settings" }, { label: page.title }],
        chips: <Chip kind="design" note={`Route /configuration/settings/${section} is a design value; CFG-CORE holds the same rows`}>Design route</Chip>,
        actions: <StatePicker view={view} />,
      }}
      sections={[{ id: "settings", label: `All ${section} settings (${s.settings.filter((x) => x.section === section).length})` }, ...page.extra]}
      section={sub}
      onSectionChange={(id) => setParams({ section: id })}
      effectiveDated
    >
      <div className="flex flex-col gap-4">
        <SubNav current={`/configuration/settings/${section}`} />
        <StateFrame view={view} cols={6} emptyTitle="No settings." emptyBody="Scenario reset restores the seed." degraded="Degraded: the approval engine is slow. Proposals save and are routed when it recovers.">
          {sub === "settings" && <SettingsTable section={section} view={view} caption={`${page.title}`} densityKey={`FX-CFG-SETTINGS-${section}`} />}
          {section === "sales" && sub === "credit" && (
            <div className="flex flex-col gap-2">
              <SettingsTable ids={creditIds} view={view} caption="Credit rules" densityKey="FX-CFG-SETTINGS-credit" />
              <p className="max-w-3xl text-sm">The credit limit itself is a Controller-owned field on the customer; this page holds the rules the check applies. A failed check puts the order in Credit Hold and sends a Credit release request to <Link className="text-link underline-offset-4 hover:underline" to="/approvals">the approvals inbox</Link>.</p>
            </div>
          )}
          {section === "sales" && sub === "pack" && (
            <div className="flex flex-col gap-2">
              <SettingsTable ids={["SET-SD-PACK", "SET-INV-HU"]} view={view} caption="Pack orders" densityKey="FX-CFG-SETTINGS-pack" />
              <p className="max-w-3xl text-sm">"Per picklist" creates one pack order PK-{"{YYYY}"}-{"{SEQ:5}"} when each picklist completes; "per shipment" creates one when the shipment's last picklist completes. The change applies to picklists completed after the effective date.</p>
            </div>
          )}
          {section === "quality" && sub === "noplan" && <NoPlan view={view} onEdit={setPol} />}
        </StateFrame>
        <RulesPanel rules={[...page.rules, ["C-50", "A setting change is a new dated version approved by its owner; history stays visible", "DOC:p.170 §18.2"]]} />
      </div>
      <PolicyDialog row={pol} onClose={() => setPol(null)} view={view} />
    </ConfigPage>
  )
}

function NoPlan({ view, onEdit }: { view: View; onEdit: (r: NoPlanRow) => void }) {
  const c = useSlice("adminCfg")
  const a = useSlice("admin")
  return (
    <div className="flex flex-col gap-2">
      <DataTable<NoPlanRow>
        rows={view.empty ? [] : c.noPlan}
        rowId={(r) => r.planType}
        loading={view.loading}
        densityKey="FX-CFG-SETTINGS-noplan"
        caption="No-plan policy per plan type"
        columns={[
          { id: "t", header: "Plan type", value: (r) => r.planType, mono: true },
          { id: "l", header: "Fires on", value: (r) => r.label },
          { id: "p", header: "Policy in force", value: (r) => verInForce(r.versions, a.instances)?.value.policy ?? "", filterable: true, cell: (r) => <span className="font-medium">{verInForce(r.versions, a.instances)?.value.policy}</span> },
          { id: "n", header: "Next version", value: (r) => nextOf(r.versions, a.instances)?.value.policy ?? "", cell: (r) => { const n = nextOf(r.versions, a.instances); return n ? <span className="text-xs">{n.value.policy} from {fmtDate(n.effectiveFrom)} · <StateText tone="attention">{verState(n, r.versions, a.instances)}</StateText>{n.requestId && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${n.requestId}`}>{n.requestId}</Link></>}</span> : "" } },
          { id: "note", header: "Basis", value: (r) => r.versions[0].note, className: "max-w-[320px]" },
          { id: "act", header: "", cell: (r) => <Button size="sm" variant="outline" disabled={!!nextOf(r.versions, a.instances) && verState(nextOf(r.versions, a.instances)!, r.versions, a.instances) === "Pending approval"} onClick={() => onEdit(r)}>Propose change</Button> },
        ]}
      />
      <dl className="grid max-w-3xl gap-4 md:grid-cols-3">
        <KV k="Block">The trigger cannot complete; E-QM-01 names the item and vendor; the Quality Manager is alerted</KV>
        <KV k="Manual Inspection">An empty inspection is created; the inspector adds ad-hoc rows; Quality Manager sign-off is mandatory</KV>
        <KV k="Auto-Accept with Warning">Stock passes; a warning is logged. Non-QI-required items only; never FIN or PSI</KV>
      </dl>
    </div>
  )
}

function PolicyDialog({ row, onClose, view }: { row: NoPlanRow | null; onClose: () => void; view: View }) {
  const a = useSlice("admin")
  const [policy, setPolicy] = useState("")
  const [from, setFrom] = useState(addDays(TODAY, 23))
  const cur = row ? verInForce(row.versions, a.instances)?.value.policy : undefined
  const options: NoPlanPolicy[] = ["Block", "Manual Inspection", "Auto-Accept with Warning"]
  return (
    <DialogShell
      open={!!row}
      onOpenChange={(o) => { if (!o) { setPolicy(""); onClose() } }}
      title={`Propose change: no-plan policy for ${row?.planType ?? ""}`}
      consequence={row ? `Creates a new version (${policy || "new policy"} from ${from}) and sends it to the Quality Manager in WF-INBOX. ${cur} stays in force until then.` : undefined}
      requireReason
      reasonLabel="Why it changes (required)"
      confirmLabel="Send for approval"
      onConfirm={(note) => view.run(() => proposeNoPlan(row!.planType, policy as NoPlanPolicy, from, note))}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field id="np-pol" label="Policy" hint={row && (row.planType === "FIN" || row.planType === "PSI") ? "Auto-Accept is never allowed for this plan type" : undefined}><SimpleSelect id="np-pol" value={policy} onChange={setPolicy} options={options.map((o) => ({ value: o, label: o }))} placeholder={cur} /></Field>
        <Field id="np-from" label="Effective from"><Input id="np-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      </div>
    </DialogShell>
  )
}
void inForce
