// FX-WF-NOTIFTPL Notification template manager [Book IV §7.7; feature list]: versioned email templates with
// localisation slots and a sensitive-data preview. A template change is a new version: the active version stays in
// use until a draft is activated (C-50). Locales en-US and fr-CA follow the Canadian entity (design value, AR-34).

import { useState } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Chip, DataTable, KV, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { useCore, useSlice } from "@/store"
import { activateTemplate, saveTemplateDraft } from "../data/cfg-actions"
import { PLACEHOLDERS, SENSITIVE } from "../data/cfg-seed-a"
import type { Locale, NotificationTemplate } from "../data/cfg-types"
import { can, placeholdersIn, renderTemplate, templateOf, validateTemplateText } from "../lib/cfg"
import { fmtDate } from "@/lib/format"
import { Field, StateText, userName } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

const LOCALES: Locale[] = ["en-US", "fr-CA"]

export function NotificationTemplates() {
  const [params, setParams] = useSearchParams()
  const section = params.get("section") ?? "templates"
  const s = useSlice("adminCfg")
  const { role } = useCore()
  const view = useView("FX-WF-NOTIFTPL")
  const [editId, setEditId] = useState<string | null>(null)
  const [activate, setActivate] = useState<{ id: string; version: number } | null>(null)
  const [fallback, setFallback] = useState(false)
  const rows = view.empty ? [] : s.templates
  const tpl = s.templates.find((t) => t.id === (params.get("tpl") ?? ""))

  return (
    <ConfigPage
      header={{
        title: "Notification templates",
        screenId: "FX-WF-NOTIFTPL",
        description: "The email texts the workflow engine sends: approval requests, reminders, escalations, decisions, alert digests and the customer and vendor letters. Each template is versioned and has one slot per language.",
        chips: <Chip kind="design" note="Route /configuration/notification-templates, the locale list and the placeholder set are design values (AR-34)">Design route</Chip>,
        actions: <StatePicker view={view} />,
      }}
      sections={[{ id: "templates", label: `Templates (${s.templates.length})` }, { id: "placeholders", label: "Placeholders and sensitive data" }]}
      section={section}
      onSectionChange={(id) => setParams((p) => { const n = new URLSearchParams(p); n.set("section", id); return n })}
      effectiveDated
    >
      <StateFrame view={view} cols={6} emptyTitle="No templates." emptyBody="The email notification set ships with the build; Scenario reset restores it." degraded="Degraded: the mail relay is slow. Templates save and preview as usual; sending is queued.">
        {section === "templates" && (
          <DataTable<NotificationTemplate>
            rows={rows}
            rowId={(t) => t.id}
            loading={view.loading}
            densityKey="FX-WF-NOTIFTPL"
            caption="Notification templates"
            searchText={(t) => `${t.id} ${t.name} ${t.event}`}
            searchPlaceholder="Search templates"
            columns={[
              { id: "id", header: "Template", value: (t) => t.id, mono: true, sortable: true },
              { id: "name", header: "Name", value: (t) => t.name, sortable: true, cell: (t) => <span className="font-medium">{t.name}</span> },
              { id: "ev", header: "Event", value: (t) => t.event, mono: true },
              { id: "aud", header: "Audience", value: (t) => t.audience, filterable: true },
              { id: "act", header: "Active", value: (t) => templateOf(t, "active")?.version ?? 0, cell: (t) => { const a = templateOf(t, "active"); return a ? <span className="text-xs">v{a.version} from {fmtDate(a.effectiveFrom)}</span> : "None" } },
              { id: "dr", header: "Draft", value: (t) => templateOf(t, "draft")?.version ?? 0, cell: (t) => { const d = templateOf(t, "draft"); return d ? <span className="text-xs"><StateText tone="attention">v{d.version}</StateText>{!d.subject["fr-CA"].trim() ? " · fr-CA empty" : ""}</span> : <span className="text-xs text-muted-foreground">None</span> } },
              { id: "own", header: "Owner", value: (t) => t.owner, filterable: true },
              { id: "btn", header: "", cell: (t) => (
                <span className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditId(t.id)} disabled={!can.template(role, t)} title={can.template(role, t) ? undefined : `Owner: ${t.owner}`}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set("tpl", t.id); return n })}>Preview</Button>
                </span>
              ) },
            ]}
          />
        )}
        {section === "placeholders" && (
          <div className="flex max-w-3xl flex-col gap-4">
            <KV k="Available placeholders">
              <span className="flex flex-wrap gap-1">{PLACEHOLDERS.map((p) => <code key={p} className="rounded bg-muted px-1 text-xs">{p}</code>)}</span>
            </KV>
            <KV k="Sensitive: never allowed in an email body">
              <span className="flex flex-wrap gap-1">{SENSITIVE.map((p) => <code key={p} className="rounded bg-muted px-1 text-xs">{p}</code>)}</span>
            </KV>
            <p className="text-sm text-muted-foreground">Credit limits, tax ids, bank accounts and badge numbers are personal or financial data (Book III C §5, data protection). The editor refuses them. Money amounts are allowed but are masked in a preview until the viewer reveals them.</p>
          </div>
        )}
      </StateFrame>

      {tpl && <PreviewPanel tpl={tpl} onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete("tpl"); return n })} onEdit={() => setEditId(tpl.id)} onActivate={(v) => { setFallback(false); setActivate({ id: tpl.id, version: v }) }} canEdit={can.template(role, tpl)} />}

      <RulesPanel
        rules={[
          ["NT-1", "Email notification templates are a build item (feature list) driven by W.1 reminders, escalations and decisions", "DOC:pp.10-11 W.1"],
          ["NT-2", "A template change is a new version; the active version stays in use until a draft is activated", "DOC:p.170 §18.2 (C-50)"],
          ["NT-3", "A language slot left empty falls back to en-US, and activation says so before it runs", "Design value (AR-34)"],
        ]}
      />
      <EditDialog id={editId} onClose={() => setEditId(null)} view={view} />
      <DialogShell
        open={!!activate}
        onOpenChange={(o) => !o && setActivate(null)}
        title={`Activate ${activate?.id ?? ""} v${activate?.version ?? ""}`}
        consequence="The draft becomes the active version today and the current active version is retired. Mails already sent keep the version they were sent with."
        confirmLabel="Activate"
        onConfirm={() => view.run(() => activateTemplate(activate!.id, activate!.version, fallback))}
      >
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={fallback} onCheckedChange={(c) => setFallback(c === true)} /> If a language slot is empty, send the en-US text instead</label>
      </DialogShell>
    </ConfigPage>
  )
}

function PreviewPanel({ tpl, onClose, onEdit, onActivate, canEdit }: { tpl: NotificationTemplate; onClose: () => void; onEdit: () => void; onActivate: (v: number) => void; canEdit: boolean }) {
  const [reveal, setReveal] = useState(false)
  const [which, setWhich] = useState<"active" | "draft">(templateOf(tpl, "draft") ? "draft" : "active")
  const v = templateOf(tpl, which) ?? templateOf(tpl, "active")!
  return (
    <section aria-label={`${tpl.name} preview`} className="flex flex-col gap-4 rounded-lg border p-4">
      <h3 className="flex items-center justify-between text-sm font-semibold">{tpl.id} {tpl.name}<Button size="sm" variant="ghost" onClick={onClose}>Close</Button></h3>
      <div className="flex flex-wrap items-center gap-4">
        <div role="tablist" aria-label="Version" className="flex gap-1">
          {(["active", "draft"] as const).map((w) => <Button key={w} size="sm" variant={which === w ? "default" : "outline"} disabled={!templateOf(tpl, w)} onClick={() => setWhich(w)}>{w === "active" ? "Active version" : "Draft"}{templateOf(tpl, w) ? ` v${templateOf(tpl, w)!.version}` : ""}</Button>)}
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={reveal} onCheckedChange={(c) => setReveal(c === true)} /> Reveal masked sample values</label>
        {which === "draft" && <Button size="sm" onClick={() => onActivate(v.version)} disabled={!canEdit}>Activate v{v.version}</Button>}
        <Button size="sm" variant="outline" onClick={onEdit} disabled={!canEdit}>Edit</Button>
      </div>
      <Tabs defaultValue="en-US">
        <TabsList>{LOCALES.map((l) => <TabsTrigger key={l} value={l}>{l}</TabsTrigger>)}</TabsList>
        {LOCALES.map((l) => {
          const empty = !v.subject[l].trim() || !v.body[l].trim()
          const subj = empty ? v.subject["en-US"] : v.subject[l]
          const body = empty ? v.body["en-US"] : v.body[l]
          return (
            <TabsContent key={l} value={l} className="pt-4">
              {empty && <p role="status" className="mb-2 rounded-md bg-offline-banner-bg px-3 py-1 text-sm text-status-pending-ink">The {l} slot is empty: recipients with this language receive the en-US text.</p>}
              <div className="rounded-md border p-4">
                <p className="text-sm font-semibold">{renderTemplate(subj, reveal)}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{renderTemplate(body, reveal)}</pre>
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
      <ol className="text-xs text-muted-foreground">{[...tpl.versions].reverse().map((x) => <li key={x.version}>v{x.version} · {x.state} · from {fmtDate(x.effectiveFrom)} · {x.by === "PRD seed" ? "PRD seed" : userName(x.by)} · {x.note}</li>)}</ol>
    </section>
  )
}

function EditDialog({ id, onClose, view }: { id: string | null; onClose: () => void; view: ReturnType<typeof useView> }) {
  const s = useSlice("adminCfg")
  const t = s.templates.find((x) => x.id === id)
  const base = t ? (templateOf(t, "draft") ?? templateOf(t, "active")) : undefined
  const [subject, setSubject] = useState<Record<Locale, string> | null>(null)
  const [body, setBody] = useState<Record<Locale, string> | null>(null)
  const subj = subject ?? base?.subject ?? { "en-US": "", "fr-CA": "" }
  const bod = body ?? base?.body ?? { "en-US": "", "fr-CA": "" }
  const used = [...new Set(LOCALES.flatMap((l) => placeholdersIn(subj[l] + " " + bod[l])))]
  const problem = t ? LOCALES.map((l) => validateTemplateText(subj[l] + " " + bod[l], t.placeholders)).find(Boolean) : null
  return (
    <DialogShell
      wide
      open={!!t}
      onOpenChange={(o) => { if (!o) { setSubject(null); setBody(null); onClose() } }}
      title={t ? `Edit ${t.id} ${t.name}` : ""}
      consequence="Saves a draft version. The active version stays in use until you activate the draft."
      requireReason
      reasonLabel="What changed (required)"
      confirmLabel="Save draft"
      onConfirm={(note) => view.run(() => saveTemplateDraft(t!.id, subj, bod, note))}
    >
      <Tabs defaultValue="en-US">
        <TabsList>{LOCALES.map((l) => <TabsTrigger key={l} value={l}>{l}{l === "fr-CA" && !subj[l].trim() ? " (empty)" : ""}</TabsTrigger>)}</TabsList>
        {LOCALES.map((l) => (
          <TabsContent key={l} value={l} className="flex flex-col gap-4 pt-4">
            <Field id={`tpl-subj-${l}`} label={`Subject (${l})`}><Input id={`tpl-subj-${l}`} value={subj[l]} onChange={(e) => setSubject({ ...subj, [l]: e.target.value })} /></Field>
            <Field id={`tpl-body-${l}`} label={`Body (${l})`}><Textarea id={`tpl-body-${l}`} rows={8} value={bod[l]} onChange={(e) => setBody({ ...bod, [l]: e.target.value })} /></Field>
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-muted-foreground">Available for this event: {t?.placeholders.join(" ")}. Used: {used.join(" ") || "none"}.</p>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
    </DialogShell>
  )
}
