// FX-WF-ALERTS Alert rules configuration [DOC:p.10 W.2]: "rule = event or scheduled condition + scope filter + severity
// + recipients (roles/users) + channels (in-app, email; SMS reserved) + dedupe window. All alerts named across the Books
// register here. Alert fatigue control: per-rule dedupe, digest option for non-critical severities, and a monthly noise
// review owned by each rule's owner." Rule ownership and thresholds are readings (AR-32, AR-33).

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Chip, DataTable, KV, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { ALL_ROLES, type Role } from "@/data/domain"
import { USERS } from "@/data/shared"
import { useCore, useSlice } from "@/store"
import { useSearchParams } from "react-router"
import { saveAlert, signNoiseReview, toggleAlert } from "../data/cfg-actions"
import type { AlertRule, DigestMode } from "../data/cfg-types"
import { can, type AlertDraft } from "../lib/cfg"
import { fmtDateTime } from "../lib/time"
import { Field, MultiAdd, SimpleSelect, StateText, userName } from "../components/common"
import { StateFrame, StatePicker, useView, type View } from "../components/states"

const blank = (): AlertDraft => ({ name: "", trigger: "Event", when: "", condition: "", scope: "", severity: "Warning", roles: [], users: [], inApp: true, email: false, dedupeMinutes: 60, digest: "Off" })
const toDraft = (r: AlertRule): AlertDraft => ({ name: r.name, trigger: r.trigger, when: r.when, condition: r.condition, scope: r.scope, severity: r.severity, roles: r.roles, users: r.users, inApp: r.channels.inApp, email: r.channels.email, dedupeMinutes: r.dedupeMinutes, digest: r.digest })
const noisy = (r: AlertRule) => r.noise.fired + r.noise.suppressed > 0 && (r.noise.suppressed > r.noise.fired * 2 || r.noise.acknowledged < r.noise.fired / 2)
const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: r }))
const userOptions = USERS.map((u) => ({ value: u.id, label: `${u.name} (${u.roles[0]})` }))

export function AlertRules() {
  const [params, setParams] = useSearchParams()
  const section = params.get("section") ?? "rules"
  const s = useSlice("adminCfg")
  const { role } = useCore()
  const view = useView("FX-WF-ALERTS")
  const [edit, setEdit] = useState<null | { id?: string }>(null)
  const [test, setTest] = useState<AlertRule | null>(null)
  const [review, setReview] = useState<AlertRule | null>(null)
  const [off, setOff] = useState<AlertRule | null>(null)
  const open = params.get("rule")
  const rules = view.empty ? [] : s.alerts

  return (
    <ConfigPage
      header={{
        title: "Alert rules",
        screenId: "FX-WF-ALERTS",
        description: "One engine for every alert in the books: an event or a schedule, a scope, a severity, recipients, channels and a dedupe window. Each rule's owner reviews its noise monthly.",
        chips: <Chip kind="design" note="Route /configuration/alert-rules is a design value; the rule model is W.2">Design route</Chip>,
        actions: <StatePicker view={view} />,
        primary: <Button onClick={() => setEdit({})} disabled={!!view.writeError()}>New rule</Button>,
      }}
      sections={[{ id: "rules", label: `Rules (${s.alerts.length})` }, { id: "noise", label: "Noise review" }, { id: "model", label: "Rule model" }]}
      section={section}
      onSectionChange={(id) => setParams((p) => { const n = new URLSearchParams(p); n.set("section", id); return n })}
      effectiveDated
    >
      <StateFrame view={view} cols={7} emptyTitle="No alert rules yet." emptyBody="The standing rules come from the books (W.2). Create the first rule, or restore the seed with Scenario reset." degraded="Degraded: the notification service is slow. Rules save and test-fire, and email delivery is queued behind the in-app channel.">
        {section === "rules" && (
          <>
            <DataTable<AlertRule>
              rows={rules}
              rowId={(r) => r.id}
              loading={view.loading}
              densityKey="FX-WF-ALERTS"
              caption="Alert rules"
              activeId={open ?? undefined}
              searchText={(r) => `${r.id} ${r.name} ${r.condition} ${r.scope} ${r.roles.join(" ")}`}
              searchPlaceholder="Search rules"
              empty={{ title: "No rule matches." }}
              columns={[
                { id: "id", header: "Rule", value: (r) => r.id, mono: true, sortable: true },
                { id: "name", header: "Name", value: (r) => r.name, sortable: true, cell: (r) => <span className="font-medium">{r.name}{!r.enabled && <span className="ml-2 text-xs font-normal text-muted-foreground">Disabled</span>}</span> },
                { id: "trig", header: "Trigger", value: (r) => r.trigger, filterable: true, cell: (r) => <span className="text-xs">{r.trigger}: <span className="font-mono">{r.when}</span></span> },
                { id: "sev", header: "Severity", value: (r) => r.severity, filterable: true, cell: (r) => <StateText tone={r.severity === "Critical" ? "attention" : "default"}>{r.severity}</StateText> },
                { id: "rec", header: "Recipients", value: (r) => [...r.roles, ...r.users.map(userName)].join(", "), className: "max-w-[220px]" },
                { id: "ch", header: "Channels", value: (r) => [r.channels.inApp && "In-app", r.channels.email && "Email"].filter(Boolean).join(" + ") },
                { id: "ded", header: "Dedupe", align: "right", mono: true, value: (r) => r.dedupeMinutes, cell: (r) => (r.dedupeMinutes ? `${r.dedupeMinutes} min` : "None") },
                { id: "dig", header: "Digest", value: (r) => r.digest },
                { id: "own", header: "Owner", value: (r) => r.owner, filterable: true },
                { id: "act", header: "", cell: (r) => (
                  <span className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEdit({ id: r.id })}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setTest(r)}>Test</Button>
                    <Button size="sm" variant="ghost" onClick={() => (r.enabled ? setOff(r) : view.run(() => toggleAlert(r.id, true, "")))} disabled={!can.alert(role, r)} title={can.alert(role, r) ? undefined : `Owner: ${r.owner}`}>{r.enabled ? "Disable" : "Enable"}</Button>
                  </span>
                ) },
              ]}
              onRowClick={(r) => setParams((p) => { const n = new URLSearchParams(p); n.set("rule", r.id); return n })}
            />
            {open && s.alerts.find((r) => r.id === open) && <RuleDetail rule={s.alerts.find((r) => r.id === open)!} onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete("rule"); return n })} />}
          </>
        )}
        {section === "noise" && (
          <div className="flex flex-col gap-2">
            <p className="max-w-3xl text-sm">The last 30 days per rule. A rule is marked for review when dedupe suppressed more than twice what it sent, or fewer than half of what it sent was acknowledged (reading AR-33). Each owner signs the review for the month.</p>
            <DataTable<AlertRule>
              rows={rules}
              rowId={(r) => r.id}
              loading={view.loading}
              densityKey="FX-WF-ALERTS-noise"
              caption="Monthly noise review"
              columns={[
                { id: "id", header: "Rule", value: (r) => `${r.id} ${r.name}`, cell: (r) => <span><span className="font-mono">{r.id}</span> {r.name}</span> },
                { id: "f", header: "Sent", align: "right", mono: true, value: (r) => r.noise.fired, sortable: true },
                { id: "s", header: "Suppressed by dedupe", align: "right", mono: true, value: (r) => r.noise.suppressed, sortable: true },
                { id: "a", header: "Acknowledged", align: "right", mono: true, value: (r) => r.noise.acknowledged, cell: (r) => (r.noise.fired ? `${r.noise.acknowledged} of ${r.noise.fired}` : "none sent") },
                { id: "n", header: "Needs review", value: (r) => (noisy(r) ? "Yes" : "No"), filterable: true, cell: (r) => <StateText tone={noisy(r) ? "attention" : "muted"}>{noisy(r) ? "Noisy" : "Fine"}</StateText> },
                { id: "own", header: "Owner", value: (r) => r.owner },
                { id: "rev", header: `Review ${new Date("2026-10-09").toISOString().slice(0, 7)}`, value: (r) => r.noiseReview?.month ?? "", cell: (r) => (r.noiseReview ? <span className="text-xs">Signed by {userName(r.noiseReview.by)}: {r.noiseReview.note}</span> : <Button size="sm" variant="outline" disabled={role !== r.owner} title={role === r.owner ? undefined : `Owner: ${r.owner}`} onClick={() => setReview(r)}>Sign review</Button>) },
              ]}
            />
          </div>
        )}
        {section === "model" && (
          <dl className="grid max-w-3xl gap-4 md:grid-cols-2">
            <KV k="Trigger">An event (module.eventName) or a schedule (a time of day, an interval)</KV>
            <KV k="Scope filter">Entity, plant, item class or document set the rule looks at</KV>
            <KV k="Severity">Critical is sent at once; Warning and Info may go to a digest (design values, AR-32)</KV>
            <KV k="Recipients">Roles and named users; a role reaches every holder in scope</KV>
            <KV k="Channels">In-app and email. SMS is reserved and not offered</KV>
            <KV k="Dedupe window">Repeats of the same rule and subject inside the window collapse into one alert</KV>
          </dl>
        )}
      </StateFrame>

      <RulesPanel
        rules={[
          ["W.2-a", "Rule = event or scheduled condition + scope filter + severity + recipients (roles/users) + channels (in-app, email; SMS reserved) + dedupe window", "DOC:p.10 W.2"],
          ["W.2-b", "All alerts named across the Books register here (safety stock, calibration, unconfirmed POs, placeholder aging, promise-at-risk, DLQ depth, SLO burn, certificate expiry, count SLA, close checklist blockers)", "DOC:p.10 W.2"],
          ["W.2-c", "Alert fatigue control: per-rule dedupe, a digest for non-critical severities, a monthly noise review owned by each rule's owner", "DOC:p.10 W.2"],
          ["C-50", "A change is a new version with its reason; history stays visible", "DOC:p.170 §18.2"],
        ]}
      />
      <RuleDialog edit={edit} onClose={() => setEdit(null)} view={view} />
      <TestDialog rule={test} onClose={() => setTest(null)} />
      <DialogShell open={!!review} onOpenChange={(o) => !o && setReview(null)} title={`Sign the noise review: ${review?.name ?? ""}`} consequence="Records your decision for this month on the rule's history. It does not change the rule: edit the rule if the review decides to tune it." requireReason reasonLabel="Decision (keep, tune or retire, with the reason)" confirmLabel="Sign review" onConfirm={(note) => view.run(() => signNoiseReview(review!.id, note))} />
      <DialogShell open={!!off} onOpenChange={(o) => !o && setOff(null)} title={`Disable ${off?.name ?? ""}`} consequence={off ? `${off.id} stops raising alerts for ${off.roles.join(", ") || "its recipients"} until it is enabled again. ${off.severity === "Critical" ? "A Critical rule needs a reason." : ""}` : undefined} requireReason={off?.severity === "Critical"} reasonLabel="Reason (required for a Critical rule)" confirmLabel="Disable rule" destructive onConfirm={(note) => view.run(() => toggleAlert(off!.id, false, note))} />
    </ConfigPage>
  )
}

function RuleDetail({ rule: r, onClose }: { rule: AlertRule; onClose: () => void }) {
  return (
    <section aria-label={`${r.id} detail`} className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="flex items-center justify-between text-sm font-semibold">{r.id} {r.name} · version {r.version}<Button size="sm" variant="ghost" onClick={onClose}>Close</Button></h3>
      <dl className="grid gap-4 md:grid-cols-3">
        <KV k="Condition">{r.condition}</KV>
        <KV k="Scope">{r.scope}</KV>
        <KV k="Source">{r.source}</KV>
      </dl>
      <ol className="text-xs text-muted-foreground">{[...r.history].reverse().map((h, n) => <li key={n}>{fmtDateTime(h.at)} · {h.by === "PRD seed" ? "PRD seed" : userName(h.by)} · {h.what}</li>)}</ol>
    </section>
  )
}

function RuleDialog({ edit, onClose, view }: { edit: null | { id?: string }; onClose: () => void; view: View }) {
  const s = useSlice("adminCfg")
  const { role } = useCore()
  const cur = edit?.id ? s.alerts.find((r) => r.id === edit.id) : undefined
  const [d, setD] = useState<AlertDraft | null>(null)
  const draft = d ?? (cur ? toDraft(cur) : blank())
  const set = (p: Partial<AlertDraft>) => setD({ ...draft, ...p })
  const owned = !cur || can.alert(role, cur)
  return (
    <DialogShell
      wide
      open={!!edit}
      onOpenChange={(o) => { if (!o) { setD(null); onClose() } }}
      title={cur ? `Edit ${cur.id} ${cur.name}` : "New alert rule"}
      consequence={cur ? `Saves version ${cur.version + 1} of ${cur.id}; version ${cur.version} stays on the history. Open alerts keep the version they were raised on.` : `Creates the rule enabled, owned by the ${role}.`}
      requireReason={!!cur}
      reasonLabel="What changed (required)"
      confirmLabel={cur ? "Save new version" : "Create rule"}
      confirmDisabled={!owned}
      onConfirm={(note) => view.run(() => saveAlert(draft, cur?.id, cur?.version, note, view.conflict))}
    >
      {!owned && <p className="text-sm text-destructive">Only the {cur?.owner}, Plant IT or the Process owner edits this rule.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="al-name" label="Name"><Input id="al-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field id="al-trig" label="Trigger"><SimpleSelect id="al-trig" value={draft.trigger} onChange={(v) => set({ trigger: v as AlertDraft["trigger"], when: "" })} options={[{ value: "Event", label: "Event" }, { value: "Scheduled", label: "Scheduled" }]} /></Field>
        <Field id="al-when" label={draft.trigger === "Event" ? "Event" : "Schedule"} hint={draft.trigger === "Event" ? "module.eventName" : "For example Daily 07:00"}><Input id="al-when" value={draft.when} onChange={(e) => set({ when: e.target.value })} /></Field>
        <Field id="al-sev" label="Severity"><SimpleSelect id="al-sev" value={draft.severity} onChange={(v) => set({ severity: v as AlertDraft["severity"] })} options={["Critical", "Warning", "Info"].map((x) => ({ value: x, label: x }))} /></Field>
        <Field id="al-cond" label="Condition" className="md:col-span-2"><Textarea id="al-cond" rows={2} value={draft.condition} onChange={(e) => set({ condition: e.target.value })} /></Field>
        <Field id="al-scope" label="Scope filter" className="md:col-span-2"><Input id="al-scope" value={draft.scope} onChange={(e) => set({ scope: e.target.value })} /></Field>
        <MultiAdd id="al-roles" label="Recipient roles" values={draft.roles} options={roleOptions} onChange={(v) => set({ roles: v as Role[] })} />
        <MultiAdd id="al-users" label="Recipient users" values={draft.users} options={userOptions} onChange={(v) => set({ users: v })} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Channels</legend>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.inApp} onCheckedChange={(c) => set({ inApp: c === true })} /> In-app</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.email} onCheckedChange={(c) => set({ email: c === true })} /> Email</label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox checked={false} disabled /> SMS (reserved)</label>
        </fieldset>
        <div className="flex flex-col gap-4">
          <Field id="al-ded" label="Dedupe window (minutes)" hint="0 sends every event"><Input id="al-ded" type="number" min={0} value={draft.dedupeMinutes} onChange={(e) => set({ dedupeMinutes: Number(e.target.value) })} /></Field>
          <Field id="al-dig" label="Digest" hint="Non-critical severities only"><SimpleSelect id="al-dig" value={draft.digest} onChange={(v) => set({ digest: v as DigestMode })} options={["Off", "Daily 07:00", "Weekly Monday 07:00"].map((x) => ({ value: x, label: x }))} /></Field>
        </div>
      </div>
    </DialogShell>
  )
}

function TestDialog({ rule, onClose }: { rule: AlertRule | null; onClose: () => void }) {
  if (!rule) return null
  const who = [...rule.roles, ...rule.users.map(userName)].join(", ")
  const ch = [rule.channels.inApp && "in-app", rule.channels.email && "email"].filter(Boolean).join(" and ")
  return (
    <DialogShell open onOpenChange={(o) => !o && onClose()} title={`Test ${rule.id} ${rule.name}`} description="A dry run: nothing is sent." confirmLabel="Close" onConfirm={() => null}>
      <ol className="flex flex-col gap-2 text-sm">
        <li><span className="font-medium">First event.</span> {rule.digest !== "Off" && rule.severity !== "Critical" ? `Held for the ${rule.digest} digest to ${who}.` : `Sent now to ${who} by ${ch}.`}</li>
        <li><span className="font-medium">Same subject again{rule.dedupeMinutes ? ` within ${rule.dedupeMinutes} min` : ""}.</span> {rule.dedupeMinutes ? "Suppressed and counted in the noise review." : "Sent again: this rule has no dedupe window."}</li>
        <li><span className="font-medium">Same subject after the window.</span> Sent as a new alert.</li>
      </ol>
      {!rule.enabled && <p className="text-sm text-destructive">The rule is disabled: in production none of this would happen.</p>}
    </DialogShell>
  )
}
