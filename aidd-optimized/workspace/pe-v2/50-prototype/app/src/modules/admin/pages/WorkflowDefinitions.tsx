// WF-DEF Workflow Definitions (Config) [DOC:p.275 §15] (asserted): "Catalog grid of the twenty seven
// workflows, versioned definition editor with condition builder and chain designer. Version
// definitions. Effective date them." Definition schema per Book IV §7.7 [DOC:p.216]; versioning
// rule per W.1 [DOC:p.11]: effective-dated, in-flight instances finish on their version, changes need
// the owning role in W.4 plus the Controller when the workflow gates a posting.

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, EmptyState, ErrorAlert, KV, RulesPanel, useFirstVisitLoading, type Column } from "@/components/patterns"
import { ConfigPage } from "@/components/templates"
import { ALL_ROLES, type Role } from "@/data/domain"
import { TODAY, USERS } from "@/data/shared"
import { addDays } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { KINDS_OUTSIDE_W4, RULE_OPS, W1_ELEMENTS, W4, W4_ADDITIONS, escalationOf, fmtRule, w4ById, type RuleOp, type W4Row } from "../data/catalog"
import { RULE_FIELDS } from "../data/rules"
import { analyse, monthsOf, pct } from "../lib/analytics"
import { inboxRows } from "../lib/engine"
import { saveVersion } from "../data/actions"
import type { DefStep, DefVersion, Rule } from "../data/types"
import { act, Field, SimpleSelect, StateText, userName } from "../components/common"

type Section = "catalog" | "additions" | "outside" | "analytics" | "model"

export function WorkflowDefinitions() {
  const [params, setParams] = useSearchParams()
  const wf = params.get("wf")
  const [section, setSection] = useState<Section>("catalog")
  const admin = useSlice("admin")
  const core = useCore()
  const loading = useFirstVisitLoading("WF-DEF")
  const row = wf ? w4ById(wf) : undefined

  const openCount = (w: W4Row) =>
    admin.instances.filter((i) => i.wfId === w.id && !i.outcome).length + core.approvals.filter((a) => !a.outcome && w.coreKinds.includes(a.kind)).length

  const columns: Column<W4Row>[] = [
    { id: "id", header: "Id", value: (w) => w.id, sortable: true, mono: true },
    { id: "workflow", header: "Workflow", value: (w) => w.workflow, sortable: true },
    { id: "chain", header: "Trigger / chain summary", value: (w) => w.chain, className: "max-w-[340px]" },
    { id: "owner", header: "Owner", value: (w) => w.owner, filterable: true },
    { id: "spec", header: "Specified in", value: (w) => w.specifiedIn },
    { id: "queue", header: "Engine queue", value: (w) => (w.coreKinds.length ? "Shared engine" : "Admin engine"), filterable: true, cell: (w) => (w.coreKinds.length ? <span>Shared: {w.coreKinds.join(", ")}</span> : <span>Admin engine <span className="text-xs text-muted-foreground">(R-1)</span></span>) },
    { id: "version", header: "In force", value: (w) => inForce(admin.definitions.find((d) => d.id === w.id)!.versions)?.version ?? 0, cell: (w) => { const v = admin.definitions.find((d) => d.id === w.id)!.versions; const f = inForce(v); const pend = v.find((x) => x.state === "Scheduled" || x.state === "Pending co-sign"); return <span className="text-xs">v{f?.version}{pend ? ` · v${pend.version} ${pend.state.toLowerCase()}` : ""}</span> } },
    { id: "open", header: "Open requests", value: (w) => openCount(w), align: "right", sortable: true, mono: true },
    { id: "flags", header: "Gates posting", value: (w) => (w.gatesPosting ? "Yes" : "No"), filterable: true },
  ]

  if (row) return <DefinitionDetail row={row} onBack={() => setParams({})} />

  return (
    <ConfigPage
      header={{
        title: "Workflow definitions",
        screenId: "WF-DEF",
        description: "The W.4 Workflow Catalog is the binding register: 27 governed workflows, each a versioned, effective-dated definition the one approval engine runs [DOC:pp.11-12 §W.4] (asserted). Open a row to version it.",
        chips: <Chip kind="design" note="Workflow ids WF-01..WF-27 are design ids; the register has no numbers (AR-19)">Design ids</Chip>,
      }}
      sections={[
        { id: "catalog", label: `W.4 catalog (${W4.length})` },
        { id: "additions", label: `W.4 additions (${W4_ADDITIONS.length})` },
        { id: "outside", label: `Kinds outside W.4 (${KINDS_OUTSIDE_W4.length})` },
        { id: "analytics", label: "Workflow analytics" },
        { id: "model", label: "Engine model (W.1)" },
      ]}
      section={section}
      onSectionChange={(s) => setSection(s as Section)}
      effectiveDated
    >
      {wf && !row && (
        <ErrorAlert title={`Workflow ${wf} not found`} onDismiss={() => setParams({})}>The W.4 register has 27 rows, WF-01 to WF-27.</ErrorAlert>
      )}
      {section === "catalog" && (
        <DataTable
          rows={W4}
          columns={columns}
          rowId={(w) => w.id}
          loading={loading}
          rowHref={(w) => `/configuration/workflows?wf=${w.id}`}
          searchText={(w) => `${w.id} ${w.workflow} ${w.chain} ${w.owner} ${w.specifiedIn}`}
          searchPlaceholder="Search the register"
          densityKey="WF-DEF"
          caption="W.4 workflow catalog"
          empty={{ title: "The register is empty." }}
        />
      )}
      {section === "additions" && (
        <section className="flex flex-col gap-4">
          <p className="max-w-3xl text-sm">
            The specification names these governed actions as additions to the W.4 register without giving them a row. They run on the admin engine queue and are versioned like any other workflow. Per the Build Note they go through change control before they ship.
          </p>
          <DataTable
            rows={W4_ADDITIONS}
            columns={columns}
            rowId={(w) => w.id}
            rowHref={(w) => `/configuration/workflows?wf=${w.id}`}
            densityKey="WF-DEF-additions"
            caption="W.4 additions"
            empty={{ title: "No additions." }}
          />
        </section>
      )}
      {section === "analytics" && <WorkflowAnalytics />}
      {section === "outside" && (
        <section className="flex flex-col gap-4">
          <p className="max-w-3xl text-sm">
            The shared engine also runs these approval kinds, which the specification states elsewhere but the W.4 register does not list. Its Build Note: “a governed action not present in this register is either added through change control or it does not ship.” Each is flagged for change control.
          </p>
          <ul className="flex flex-col gap-2">
            {KINDS_OUTSIDE_W4.map((k) => (
              <li key={k.kind} className="flex flex-wrap items-center gap-2 rounded-md border px-4 py-2 text-sm">
                <span className="font-medium">{k.kind}</span>
                <span className="text-xs text-muted-foreground">{k.source}</span>
                <Chip kind="flag" note="Not in the W.4 register; needs change control before it ships">Not in W.4</Chip>
                <span className="ml-auto text-xs">{core.approvals.filter((a) => a.kind === k.kind && !a.outcome).length} open</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">Also outside the register and run on the admin engine queue: workflow definition change (W.1 versioning), configuration change (CFG-CORE), manual tax rate change and tax adjustment JE (INV §11.5).</p>
        </section>
      )}
      {section === "model" && (
        <dl className="grid max-w-4xl gap-4">
          {W1_ELEMENTS.map(([k, v]) => <KV key={k} k={k}>{v}</KV>)}
          <KV k="Definition schema (Book IV §7.7)">{"{ workflow_id, version, document_type, trigger, conditions[] (field, operator, value), steps[] (order, type sequential/parallel, approver resolution role/user/derived, sla_hours, escalation_target), terminal_actions[], effective_from/to, owner, approval_ref }"}</KV>
        </dl>
      )}
    </ConfigPage>
  )
}

const inForce = (vs: DefVersion[]) => vs.filter((v) => v.state === "Active" && v.effectiveFrom <= TODAY).sort((a, b) => b.version - a.version)[0]

function DefinitionDetail({ row, onBack }: { row: W4Row; onBack: () => void }) {
  const admin = useSlice("admin")
  const core = useCore()
  const def = admin.definitions.find((d) => d.id === row.id)!
  const current = inForce(def.versions) ?? def.versions[0]
  const [editing, setEditing] = useState(false)
  const instances = useMemo(
    () => [
      ...admin.instances.filter((i) => i.wfId === row.id).map((i) => ({ id: i.id, subject: "ref" in i.subject ? i.subject.ref.id : i.subject.loose.id, version: `v${i.version}`, outcome: i.outcome ?? "Pending", raised: i.raisedAt.slice(0, 10) })),
      ...core.approvals.filter((a) => row.coreKinds.includes(a.kind)).map((a) => ({ id: a.id, subject: a.subject.id, version: "shared engine", outcome: a.outcome ?? "Pending", raised: a.raisedOn })),
    ],
    [admin.instances, core.approvals, row],
  )
  const canEdit = core.role === row.ownerRole || core.role === "Process owner"
  const pending = def.versions.find((v) => v.state === "Pending co-sign")

  return (
    <ConfigPage
      header={{
        title: `${row.id} ${row.workflow}`,
        screenId: "WF-DEF",
        crumbs: [{ label: "Workflow definitions", to: "/configuration/workflows" }, { label: row.id }],
        description: `${row.chain} · Specified in ${row.specifiedIn} · Owner ${row.owner}`,
        chips: (
          <>
            {row.gatesPosting && <Chip kind="flag" note="Changes need the owner plus the Controller [DOC:p.11 W.1]">Gates a posting</Chip>}
            {row.reading && <Chip kind="design" note={row.reading}>Reading</Chip>}
          </>
        ),
        actions: <Button variant="ghost" onClick={onBack}>Back to catalog</Button>,
        primary: !editing ? (
          <Button onClick={() => setEditing(true)} disabled={!canEdit || !!pending} title={!canEdit ? `Versioning needs the owning role (${row.ownerRole}) or a Process owner` : pending ? `v${pending.version} waits for the Controller co-sign` : undefined}>
            New version
          </Button>
        ) : undefined,
      }}
      effectiveDated
    >
      <div className="flex flex-col gap-6">
        {editing ? (
          <VersionEditor row={row} base={def.versions[def.versions.length - 1]} onDone={() => setEditing(false)} />
        ) : (
          <section aria-label={`Version ${current.version} in force`} className="flex flex-col gap-4 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">v{current.version} in force since {current.effectiveFrom}</h2>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KV k="Document type">{row.documentType}</KV>
              <KV k="Engine queue">{row.coreKinds.length ? `Shared: ${row.coreKinds.join(", ")}` : "Admin engine (R-1)"}</KV>
              <KV k="Financial approval">{row.financial ? "Yes: no delegation above $250,000" : "No"}</KV>
              <KV k="Flows">{row.flows.join(", ") || "None named"}</KV>
            </dl>
            <div>
              <h3 className="text-xs text-muted-foreground">Condition rules</h3>
              <ul className="list-disc pl-6 text-sm">{current.rules.map((c, n) => <li key={n}><span className="font-mono text-xs">{fmtRule(c)}</span></li>)}</ul>
            </div>
            <div>
              <h3 className="text-xs text-muted-foreground">Approver chain</h3>
              <ol className="flex flex-wrap items-center gap-2 text-sm">
                {current.steps.map((s, n) => (
                  <li key={n} className="rounded-md border px-2 py-1">
                    {n + 1}. <span className="font-medium">{approverLabel(s)}</span> <span className="text-xs text-muted-foreground">{s.when ? `only when ${s.when} · ` : ""}SLA {s.slaHours} h · reminder {s.reminderHours} h · escalates to {s.escalateTo}{s.parallel ? " · parallel" : ""}</span>
                  </li>
                ))}
              </ol>
              {row.coreKinds.length > 0 && <p className="mt-1 text-xs text-muted-foreground">The shared engine computes the steps per request from the approval limits table (data/domain/approvals.ts); this chain supplies the SLA, reminder and escalation.</p>}
            </div>
            <div>
              <h3 className="text-xs text-muted-foreground">Terminal actions</h3>
              <p className="text-sm">{current.terminalActions.join("; ")}</p>
            </div>
          </section>
        )}

        <section aria-label="Versions">
          <h2 className="mb-2 text-sm font-semibold">Versions ({def.versions.length})</h2>
          <DataTable
            rows={[...def.versions].reverse()}
            rowId={(v) => String(v.version)}
            densityKey="WF-DEF-versions"
            caption="Definition versions"
            columns={[
              { id: "v", header: "Version", value: (v) => `v${v.version}`, mono: true },
              { id: "from", header: "Effective", value: (v) => `${v.effectiveFrom}${v.effectiveTo ? ` → ${v.effectiveTo}` : ""}`, mono: true },
              { id: "state", header: "State", value: (v) => v.state, cell: (v) => <StateText tone={v.state === "Pending co-sign" ? "attention" : v.state === "Retired" || v.state === "Rejected" ? "muted" : "default"}>{v.state}</StateText> },
              { id: "note", header: "Change", value: (v) => v.changeNote },
              { id: "by", header: "Changed by", value: (v) => `${userName(v.changedBy)} · ${v.changedOn}` },
              { id: "req", header: "Co-sign", value: (v) => v.requestId ?? "", cell: (v) => (v.requestId ? <Link to={`/approvals?req=${v.requestId}`} className="font-mono text-link underline-offset-4 hover:underline">{v.requestId}</Link> : "") },
            ]}
          />
          <p className="mt-1 text-xs text-muted-foreground">State words are design values (AR-1); the specification names versioning but no version status list.</p>
        </section>

        <section aria-label="Requests on this workflow">
          <h2 className="mb-2 text-sm font-semibold">Requests on this workflow ({instances.length})</h2>
          {instances.length === 0 ? (
            <EmptyState title="No requests yet.">Requests appear here when a screen raises one through ApprovalButton or the admin engine.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {instances.map((i) => (
                <li key={i.id} className="flex flex-wrap gap-2">
                  <Link to={`/approvals?req=${i.id}`} className="font-mono text-link underline-offset-4 hover:underline">{i.id}</Link>
                  <span className="font-mono text-xs">{i.subject}</span>
                  <span className="text-xs text-muted-foreground">{i.version} · raised {i.raised}</span>
                  <StateText tone="muted">{i.outcome}</StateText>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-muted-foreground">In-flight requests complete on the version they started [DOC:p.11 W.1].</p>
        </section>

        <RulesPanel
          rules={[
            ["W.1-V", "Definitions are effective-dated and versioned; in-flight instances complete on the version they started", "DOC:p.11 W.1"],
            ["W.1-O", "Changes require the owning role in W.4 plus Controller when the workflow gates a posting", "DOC:p.11 W.1"],
            ["C-50", "Effective-dated records are never edited in place", "DOC:p.170 §18.2"],
            ["W.4-BN", "The register is configuration seed data; each row becomes a workflow definition with its tests in the TC-WF range", "DOC:p.12 W.4"],
          ]}
        />
      </div>
    </ConfigPage>
  )
}

function VersionEditor({ row, base, onDone }: { row: W4Row; base: DefVersion; onDone: () => void }) {
  const [effectiveFrom, setEffectiveFrom] = useState(addDays(TODAY, 23))
  const [steps, setSteps] = useState<DefStep[]>(base.steps.map((s) => ({ ...s })))
  const [rules, setRules] = useState<Rule[]>(base.rules.map((r) => ({ ...r })))
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const upd = (i: number, patch: Partial<DefStep>) => setSteps(steps.map((s, n) => (n === i ? { ...s, ...patch } : s)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSteps(next)
  }
  const save = () => {
    const r = saveVersion(row.id, { effectiveFrom, steps, rules, changeNote: note })
    const e = act(r)
    setError(e)
    if (!e) onDone()
  }
  return (
    <section aria-label="New version" className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">New version of {row.id} (from v{base.version})</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="ve-from" label="Effective from" hint="After today; the version in force today ends the day before.">
          <Input id="ve-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
        <Field id="ve-note" label="Change note" className="md:col-span-2">
          <Input id="ve-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changes and why" />
        </Field>
      </div>
      <div>
        <h3 className="text-xs text-muted-foreground">Condition builder: field, operator, value, then</h3>
        <datalist id="rule-fields">{RULE_FIELDS.map((f) => <option key={f} value={f} />)}</datalist>
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left text-xs">
            <tr><th className="p-2">Field</th><th className="p-2">Operator</th><th className="p-2">Value</th><th className="p-2">Then</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {rules.map((c, i) => {
              const unary = c.op === "is set" || c.op === "is true"
              const updRule = (patch: Partial<Rule>) => setRules(rules.map((x, n) => (n === i ? { ...x, ...patch } : x)))
              return (
                <tr key={i} className="border-t">
                  <td className="p-2"><Input aria-label={`Rule ${i + 1} field`} list="rule-fields" value={c.field} onChange={(e) => updRule({ field: e.target.value })} /></td>
                  <td className="p-2 w-32"><SimpleSelect value={c.op} onChange={(v) => updRule({ op: v as RuleOp, value: v === "is set" || v === "is true" ? "" : c.value })} options={RULE_OPS.map((o) => ({ value: o, label: o }))} /></td>
                  <td className="p-2"><Input aria-label={`Rule ${i + 1} value`} value={c.value} disabled={unary} placeholder={unary ? "not needed" : "value"} onChange={(e) => updRule({ value: e.target.value })} /></td>
                  <td className="p-2"><Input aria-label={`Rule ${i + 1} effect on the chain`} value={c.then} placeholder="e.g. + Controller" onChange={(e) => updRule({ then: e.target.value })} /></td>
                  <td className="p-2"><Button size="icon" variant="ghost" aria-label={`Remove rule ${i + 1}`} onClick={() => setRules(rules.filter((_, n) => n !== i))}><Trash2 aria-hidden="true" /></Button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Button className="mt-2" variant="outline" onClick={() => setRules([...rules, { field: "", op: ">", value: "", then: "" }])}><Plus aria-hidden="true" /> Add rule</Button>
        <p className="mt-1 text-xs text-muted-foreground">The grammar reads any document field; the field list offers the ones the register uses [DOC:p.216 §7.7].</p>
      </div>
      <div>
        <h3 className="text-xs text-muted-foreground">Chain designer</h3>
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left text-xs">
            <tr><th className="p-2">Step</th><th className="p-2">Approver resolution</th><th className="p-2">SLA hours</th><th className="p-2">Reminder hours</th><th className="p-2">Escalates to</th><th className="p-2">Parallel</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 tabular">{i + 1}</td>
                <td className="p-2 w-72">
                  <div className="flex flex-col gap-1">
                    <SimpleSelect
                      value={s.approver?.kind ?? "role"}
                      onChange={(v) => upd(i, { approver: v === "role" ? undefined : v === "user" ? { kind: "user", userId: USERS.find((u) => u.roles[0] === s.role)?.id } : { kind: "derived", derived: "Cost Center Manager" } })}
                      options={[{ value: "role", label: "Role" }, { value: "user", label: "Named user" }, { value: "derived", label: "Derived owner" }]}
                    />
                    {(s.approver?.kind ?? "role") === "role" && <SimpleSelect value={s.role} onChange={(v) => upd(i, { role: v as Role, escalateTo: escalationOf(v as Role) })} options={ALL_ROLES.map((r) => ({ value: r, label: r }))} />}
                    {s.approver?.kind === "user" && (
                      <SimpleSelect
                        value={s.approver.userId ?? ""}
                        placeholder="Choose a person"
                        onChange={(v) => { const u = USERS.find((x) => x.id === v); upd(i, { approver: { kind: "user", userId: v }, ...(u ? { role: u.roles[0] as Role, escalateTo: escalationOf(u.roles[0] as Role) } : {}) }) }}
                        options={USERS.map((u) => ({ value: u.id, label: `${u.name} · ${u.roles[0]}` }))}
                      />
                    )}
                    {s.approver?.kind === "derived" && (
                      <>
                        <Input aria-label={`Step ${i + 1} derived owner`} value={s.approver.derived ?? ""} onChange={(e) => upd(i, { approver: { kind: "derived", derived: e.target.value } })} placeholder="Derived owner, e.g. Cost Center Manager" />
                        <SimpleSelect value={s.role} onChange={(v) => upd(i, { role: v as Role, escalateTo: escalationOf(v as Role) })} options={ALL_ROLES.map((r) => ({ value: r, label: `Stands in: ${r}` }))} />
                      </>
                    )}
                    {s.when && <span className="text-xs text-muted-foreground">Only when {s.when}</span>}
                  </div>
                </td>
                <td className="p-2 w-28"><Input aria-label={`Step ${i + 1} SLA hours`} type="number" min={1} value={s.slaHours} onChange={(e) => upd(i, { slaHours: Number(e.target.value) })} /></td>
                <td className="p-2 w-28"><Input aria-label={`Step ${i + 1} reminder hours`} type="number" min={1} value={s.reminderHours} onChange={(e) => upd(i, { reminderHours: Number(e.target.value) })} /></td>
                <td className="p-2 text-xs">{s.escalateTo}</td>
                <td className="p-2"><Checkbox aria-label={`Step ${i + 1} parallel`} checked={!!s.parallel} onCheckedChange={(v) => upd(i, { parallel: v === true })} /></td>
                <td className="p-2">
                  <span className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label={`Move step ${i + 1} up`} onClick={() => move(i, -1)}><ArrowUp aria-hidden="true" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Move step ${i + 1} down`} onClick={() => move(i, 1)}><ArrowDown aria-hidden="true" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Remove step ${i + 1}`} onClick={() => setSteps(steps.filter((_, n) => n !== i))}><Trash2 aria-hidden="true" /></Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button className="mt-2" variant="outline" onClick={() => setSteps([...steps, { role: row.ownerRole, slaHours: 24, reminderHours: 8, escalateTo: escalationOf(row.ownerRole) }])}><Plus aria-hidden="true" /> Add step</Button>
        <p className="mt-1 text-xs text-muted-foreground">Escalation target is the role's manager (reading AR-13: the specification gives no reporting lines). Steps flagged parallel next to each other open together and all must approve (CCB votes) [DOC:p.10 W.1]. A derived owner resolves from the document; the stand-in seat decides until it does (AR-5).</p>
      </div>
      {row.gatesPosting && <p className="rounded-md bg-muted px-4 py-2 text-sm">{row.workflow} gates a posting: saving raises a co-sign request to the Controller in WF-INBOX; the version stays “Pending co-sign” until then.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button onClick={save}>Save v{base.version + 1}{row.gatesPosting ? " and ask for co-sign" : ""}</Button>
      </div>
    </section>
  )
}

/** "Cost Center Manager (derived, stands in: Controller)", "Jordan Reyes (named user)", or the role. */
function approverLabel(st: DefStep): string {
  if (st.approver?.kind === "derived") return `${st.approver.derived} (derived; ${st.role} stands in)`
  if (st.approver?.kind === "user") return `${USERS.find((u) => u.id === st.approver?.userId)?.name ?? "Named user"} (named user, ${st.role})`
  return st.role
}

function WorkflowAnalytics() {
  const admin = useSlice("admin")
  const core = useCore()
  const rows = useMemo(() => inboxRows(core.approvals, admin), [core.approvals, admin])
  const months = useMemo(() => monthsOf(rows), [rows])
  const [month, setMonth] = useState("all")
  const a = useMemo(() => analyse(rows, month), [rows, month])
  const total = a.workflows.reduce((t, w) => ({ steps: t.steps + w.stepsDecided, ok: t.ok + w.stepsWithinSla, rej: t.rej + w.rejectedRequests, dec: t.dec + w.decidedRequests, del: t.del + w.delegated, ovr: t.ovr + w.overrides }), { steps: 0, ok: 0, rej: 0, dec: 0, del: 0, ovr: 0 })
  return (
    <section aria-label="Workflow analytics" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <p className="max-w-3xl text-sm">
          Monthly review for each workflow owner; it feeds the W.4 governance loop [DOC:p.217 §7.7]. Both queues are counted, the shared engine and the admin engine.
        </p>
        <Field id="an-month" label="Month" className="w-44">
          <SimpleSelect id="an-month" value={month} onChange={setMonth} options={[{ value: "all", label: "All months" }, ...months.map((m) => ({ value: m, label: m }))]} />
        </Field>
      </div>
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KV k="SLA attainment">{pct(total.ok, total.steps)} <span className="text-xs text-muted-foreground">of {total.steps} steps</span></KV>
        <KV k="Rejection rate">{pct(total.rej, total.dec)} <span className="text-xs text-muted-foreground">of {total.dec} decided</span></KV>
        <KV k="Delegation usage">{total.del} <span className="text-xs text-muted-foreground">steps by a delegate</span></KV>
        <KV k="Override frequency">{pct(total.ovr, total.steps)} <span className="text-xs text-muted-foreground">{total.ovr} steps</span></KV>
        <KV k="Open over SLA">{a.workflows.reduce((t, w) => t + w.aging.over, 0)}</KV>
      </dl>
      <DataTable
        rows={a.workflows}
        rowId={(w) => w.wfId}
        densityKey="WF-DEF-analytics"
        caption="Per workflow"
        empty={{ title: "No requests in this month." }}
        columns={[
          { id: "wf", header: "Workflow", value: (w) => `${w.wfId} ${w.workflow}`, sortable: true, cell: (w) => (w4ById(w.wfId) ? <Link className="text-link underline-offset-4 hover:underline" to={`/configuration/workflows?wf=${w.wfId}`}><span className="font-mono text-xs">{w.wfId}</span> {w.workflow}</Link> : <span>{w.workflow} <span className="text-xs text-muted-foreground">(not a W.4 row)</span></span>) },
          { id: "owner", header: "Owner", value: (w) => w.owner, filterable: true },
          { id: "req", header: "Requests", value: (w) => w.requests, align: "right", mono: true, sortable: true },
          { id: "sla", header: "SLA attainment", value: (w) => (w.stepsDecided ? w.stepsWithinSla / w.stepsDecided : -1), align: "right", sortable: true, cell: (w) => pct(w.stepsWithinSla, w.stepsDecided) },
          { id: "rej", header: "Rejection rate", value: (w) => (w.decidedRequests ? w.rejectedRequests / w.decidedRequests : -1), align: "right", sortable: true, cell: (w) => pct(w.rejectedRequests, w.decidedRequests) },
          { id: "age", header: "Open: within / near / over SLA", value: (w) => w.aging.over, align: "right", mono: true, cell: (w) => `${w.aging.within} / ${w.aging.near} / ${w.aging.over}` },
          { id: "del", header: "Delegation usage", value: (w) => w.delegated, align: "right", mono: true },
          { id: "ovr", header: "Overrides", value: (w) => w.overrides, align: "right", mono: true },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Aging by step (open requests)</h2>
          <DataTable
            rows={a.aging}
            rowId={(x) => `${x.wfId}-${x.step}`}
            densityKey="WF-DEF-aging"
            caption="Aging by step"
            empty={{ title: "Nothing open." }}
            columns={[
              { id: "wf", header: "Workflow", value: (x) => x.wfId, mono: true },
              { id: "step", header: "Step", value: (x) => x.step },
              { id: "w", header: "Within 50%", value: (x) => x.within, align: "right", mono: true },
              { id: "n", header: "50 to 100%", value: (x) => x.near, align: "right", mono: true },
              { id: "o", header: "Over SLA", value: (x) => x.over, align: "right", mono: true, sortable: true },
            ]}
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Bottleneck approvers</h2>
          <DataTable
            rows={a.bottlenecks}
            rowId={(x) => x.role}
            densityKey="WF-DEF-bottleneck"
            caption="Bottleneck approvers"
            empty={{ title: "No approver data." }}
            columns={[
              { id: "role", header: "Approver", value: (x) => x.role },
              { id: "d", header: "Steps decided", value: (x) => x.stepsDecided, align: "right", mono: true },
              { id: "avg", header: "Mean time to decide (h)", value: (x) => Math.round(x.avgHours * 10) / 10, align: "right", mono: true, sortable: true },
              { id: "open", header: "Waiting now", value: (x) => x.open, align: "right", mono: true },
              { id: "over", header: "Over SLA now", value: (x) => x.overdue, align: "right", mono: true, sortable: true },
            ]}
          />
        </div>
      </div>
      <p className="max-w-3xl text-xs text-muted-foreground">
        <Chip kind="design" note="The PRD names the six measures, not their formulas (AR-31)">Formulas</Chip> SLA attainment = steps decided within their SLA hours of opening. Aging buckets compare the open step's age with its SLA (prototype clock 2026-10-09 15:00). Delegation usage counts steps decided by a delegate. An override is a step decided by a delegate or after its SLA had breached and escalated. Rejection rate = rejected requests of those decided. Requests on the shared engine have their step opening times read from the previous decision, or 09:00 on the day raised.
      </p>
    </section>
  )
}
