// FX-PRD-CAPTURE Capture template builder: per-operation data capture the terminal shows at the work
// center (feature list; PP-SFT-001 "capture templates" view). A template belongs to work centers,
// has typed fields with limits, and is versioned: Draft, Published, Superseded. A published template
// is never edited in place; a new version supersedes it on publish. One published template per work
// center. The field kinds, limits and publish roles are design values: the PRD names capture only as
// a terminal view [DOC:p.76 §6].

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Chip, EmptyState, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import type { WorkCenterId } from "@/data/domain"
import { fmtDate } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { AccessNote, ActivityList, StateBanner, StatePreview, useAct, useActDialog, useScreenState } from "../components"
import * as ext from "../lib/actions-ext"
import { captureIssues } from "../lib/capture"
import { allWorkCenters } from "../lib/plan"
import type { CaptureField, CaptureKind, CaptureTemplate } from "../data/extra"

const ROLES = ["Manufacturing engineer", "Engineer", "Engineering Manager", "Quality engineer", "Quality Manager"] as const
const KINDS: CaptureKind[] = ["number", "text", "pass-fail", "choice", "scan", "attachment"]
const stat = (s: CaptureTemplate["status"]) => <span className="inline-flex rounded-md border px-2 py-0.5 text-xs font-medium">{s}</span>

export function CaptureBuilder() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PRD-CAPTURE")
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const [selId, setSelId] = useState("CAP-TBD-0003")
  const [draft, setDraft] = useState<{ id?: string; name: string; wcIds: WorkCenterId[]; fields: CaptureField[] } | null>(null)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [dlg, setDlg] = useState<null | "new" | "publish" | "delete">(null)
  const [newName, setNewName] = useState("")
  const can = (ROLES as readonly string[]).includes(role) && !st.readOnly
  const list = st.empty ? [] : s.captureTemplates
  const sel = s.captureTemplates.find((t) => t.id === selId) ?? list[0]
  const wcs = allWorkCenters(s)
  const working = draft && sel && draft.id === sel.id ? draft : null
  const view = working ?? (sel ? { id: sel.id, name: sel.name, wcIds: sel.wcIds, fields: sel.fields } : null)
  const editable = sel?.status === "Draft" && can
  const preview = view ? ({ ...sel, fields: view.fields } as CaptureTemplate) : undefined
  const issues = captureIssues(preview, vals)
  const set = (patch: Partial<NonNullable<typeof view>>) => view && setDraft({ ...view, id: sel!.id, ...patch } as never)
  const setField = (i: number, patch: Partial<CaptureField>) => set({ fields: view!.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })

  return (
    <>
      <ConfigPage
        header={{
          title: "Capture template builder",
          screenId: "FX-PRD-CAPTURE",
          description: "Define what an operator records at a work center: typed fields, limits and what blocks completion. Published templates are versioned, never edited in place.",
          chips: <Chip kind="design" note="Field kinds, limits and who publishes are prototype values; the PRD lists capture templates as a terminal view only">Design values</Chip>,
          actions: <><StatePreview extended /><Button variant="outline" asChild><Link to="/production/terminal">Open the terminal</Link></Button></>,
          primary: <Button disabled={!can} onClick={() => (setNewName(""), setDlg("new"))}>New template</Button>,
        }}
        effectiveDated
      >
        <StateBanner st={st} />
        <AccessNote roles={ROLES} role={role} what="Building and publishing capture templates" />
        {st.loading ? <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading"><div className="h-24 rounded-lg border" /><div className="h-48 rounded-lg border" /></div>
          : st.error ? <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{st.error} <button className="underline" onClick={st.retry}>Try again</button></p>
          : !list.length ? <EmptyState title="No capture templates">Operations record only quantities and hours until a template is published for their work center.</EmptyState> : (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <nav aria-label="Templates"><ul className="flex flex-col gap-1">
              {list.map((t) => (
                <li key={t.id}>
                  <button className={`w-full rounded-md border px-3 py-2 text-left text-sm ${t.id === sel?.id ? "bg-secondary font-semibold" : "hover:bg-accent"}`} aria-current={t.id === sel?.id ? "true" : undefined} onClick={() => (setSelId(t.id), setDraft(null), setVals({}))}>
                    <span className="flex items-center justify-between gap-2">{t.name} {stat(t.status)}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{t.id} · v{t.version} · {t.wcIds.join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul></nav>

            {sel && view && (
              <div className="flex min-w-0 flex-col gap-6">
                <section aria-label="Template" className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{sel.name} · version {sel.version}</h2>{stat(sel.status)}
                    {sel.effectiveFrom && <span className="text-xs text-muted-foreground">effective {fmtDate(sel.effectiveFrom)}</span>}
                    <span className="ml-auto flex flex-wrap gap-2">
                      {sel.status === "Draft" && <>
                        <Button size="sm" variant="outline" disabled={!editable || !working} onClick={() => run((d, c) => ext.saveCaptureTemplate(d, c, { ...working!, id: sel.id }), "Draft saved")}>Save draft</Button>
                        <Button size="sm" disabled={!can} onClick={() => setDlg("publish")}>Publish</Button>
                        <Button size="sm" variant="ghost" disabled={!can} onClick={() => setDlg("delete")}>Delete draft</Button>
                      </>}
                      {sel.status === "Published" && <Button size="sm" variant="outline" disabled={!can} onClick={() => { const id = run((d, c) => ext.newCaptureVersion(d, c, sel.id), (id) => `Draft ${id} created`); if (id) (setSelId(id), setDraft(null)) }}>New version</Button>}
                    </span>
                  </div>
                  {sel.status !== "Draft" && <p className="text-sm text-muted-foreground">{sel.status === "Published" ? "Published templates are read-only: create a new version to change a field. Terminals at these work centers use it now." : "Superseded: kept for history; results already captured keep their version."}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1"><Label htmlFor="cap-name">Name</Label><Input id="cap-name" disabled={!editable} value={view.name} onChange={(e) => set({ name: e.target.value })} /></div>
                    <fieldset className="grid gap-1"><legend className="text-sm font-medium">Applies to work centers</legend>
                      <div className="flex max-h-24 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-sm">
                        {wcs.filter((w) => w.status !== "Inactive").map((w) => (
                          <label key={w.id} className="flex items-center gap-2"><Checkbox disabled={!editable} checked={view.wcIds.includes(w.id as WorkCenterId)} aria-label={`${w.id} ${w.name}`} onCheckedChange={(c) => set({ wcIds: c ? [...view.wcIds, w.id as WorkCenterId] : view.wcIds.filter((x) => x !== w.id) })} />{w.id}</label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="bg-table-head text-left"><tr>{["Label", "Kind", "Unit", "Min", "Max", "Out of range", "Required", "Options", ""].map((h) => <th key={h} scope="col" className="px-2 py-2">{h}</th>)}</tr></thead>
                      <tbody className="[&_td]:px-2 [&_td]:py-1 [&_tr]:border-t">
                        {view.fields.map((f, i) => (
                          <tr key={f.id}>
                            <td><Input aria-label={`Label ${i + 1}`} disabled={!editable} value={f.label} onChange={(e) => setField(i, { label: e.target.value })} /></td>
                            <td><Select disabled={!editable} value={f.kind} onValueChange={(v) => setField(i, { kind: v as CaptureKind })}><SelectTrigger size="sm" aria-label={`Kind ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select></td>
                            <td className="w-20"><Input aria-label={`Unit ${i + 1}`} disabled={!editable || f.kind !== "number"} value={f.unit ?? ""} onChange={(e) => setField(i, { unit: e.target.value })} /></td>
                            <td className="w-20"><Input aria-label={`Min ${i + 1}`} type="number" disabled={!editable || f.kind !== "number"} value={f.min ?? ""} onChange={(e) => setField(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })} /></td>
                            <td className="w-20"><Input aria-label={`Max ${i + 1}`} type="number" disabled={!editable || f.kind !== "number"} value={f.max ?? ""} onChange={(e) => setField(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })} /></td>
                            <td><Select disabled={!editable || f.kind !== "number"} value={f.limit ?? "hard"} onValueChange={(v) => setField(i, { limit: v as "hard" | "soft" })}><SelectTrigger size="sm" aria-label={`Limit ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hard">Block</SelectItem><SelectItem value="soft">Warn only</SelectItem></SelectContent></Select></td>
                            <td className="text-center"><Checkbox disabled={!editable} checked={f.required} aria-label={`Required ${i + 1}`} onCheckedChange={(c) => setField(i, { required: !!c })} /></td>
                            <td><Input aria-label={`Options ${i + 1}`} disabled={!editable || f.kind !== "choice"} placeholder="A, B, C" value={f.options?.join(", ") ?? ""} onChange={(e) => setField(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></td>
                            <td><Button size="sm" variant="ghost" disabled={!editable} onClick={() => set({ fields: view.fields.filter((_, j) => j !== i) })}>Remove</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button size="sm" variant="outline" className="self-start" disabled={!editable} onClick={() => set({ fields: [...view.fields, { id: `f${Date.now() % 100000}`, label: "", kind: "number", required: false, limit: "hard" }] })}>Add field</Button>
                </section>

                <section aria-label="Terminal preview" className="flex flex-col gap-2 rounded-lg border p-4">
                  <h2 className="text-base font-semibold">As the operator sees it</h2>
                  <p className="text-xs text-muted-foreground">Try values: a hard limit blocks Complete, a soft limit warns, a missing required field blocks.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {view.fields.filter((f) => f.label).map((f) => {
                      const iss = issues.find((x) => x.field.id === f.id)
                      return (
                        <div key={f.id} className="grid gap-1">
                          <Label htmlFor={`pv-${f.id}`}>{f.label}{f.unit ? ` (${f.unit})` : ""}{f.required ? " *" : ""}</Label>
                          {f.kind === "pass-fail" ? (
                            <Select value={vals[f.label] ?? ""} onValueChange={(v) => setVals({ ...vals, [f.label]: v })}><SelectTrigger id={`pv-${f.id}`}><SelectValue placeholder="Pass or Fail" /></SelectTrigger><SelectContent><SelectItem value="Pass">Pass</SelectItem><SelectItem value="Fail">Fail</SelectItem></SelectContent></Select>
                          ) : f.kind === "choice" ? (
                            <Select value={vals[f.label] ?? ""} onValueChange={(v) => setVals({ ...vals, [f.label]: v })}><SelectTrigger id={`pv-${f.id}`}><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                          ) : f.kind === "attachment" ? <Input id={`pv-${f.id}`} type="file" disabled aria-label={`${f.label} (attachment)`} /> : (
                            <Input id={`pv-${f.id}`} inputMode={f.kind === "number" ? "decimal" : undefined} value={vals[f.label] ?? ""} onChange={(e) => setVals({ ...vals, [f.label]: e.target.value })} aria-invalid={!!iss && iss.level !== "soft"} />
                          )}
                          {iss && <span className={`text-xs ${iss.level === "soft" ? "text-status-pending-ink" : "text-destructive"}`} role="status">{iss.level === "soft" ? "Warning: " : ""}{iss.text}</span>}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-sm">{issues.some((i) => i.level !== "soft") ? <span className="text-destructive">Complete is blocked: {issues.filter((i) => i.level !== "soft").length} issue(s).</span> : <span className="text-status-passed-ink">Complete is allowed{issues.length ? " with a warning" : ""}.</span>}</p>
                </section>
                <section aria-label="History"><h2 className="mb-2 text-base font-semibold">History</h2><ActivityList items={sel.activity} /></section>
              </div>
            )}
          </div>
        )}
        <RulesPanel rules={[
          ["Versioning", "A published template is not edited in place; a new version supersedes it", "design (C-50 pattern)"],
          ["One per work center", "Only one template is published per work center; publishing the new version supersedes the old", "design"],
          ["Terminal", "Capture templates are a terminal view; required fields block Complete", "DOC:p.76 §6"],
        ]} />
      </ConfigPage>

      <DialogShell open={dlg === "new"} onOpenChange={(o) => !o && setDlg(null)} title="New capture template" confirmLabel="Create draft" consequence="A Draft is created with one starter field. It affects no terminal until published."
        onConfirm={() => runD((d, c) => ext.saveCaptureTemplate(d, c, { name: newName, wcIds: ["WC-210" as WorkCenterId], fields: [{ id: "f1", label: "Reading", kind: "number", required: true, limit: "hard" }] }), (id) => { setSelId(id); setDraft(null); return `Draft ${id} created` })}>
        <div className="grid gap-1"><Label htmlFor="cap-new">Name</Label><Input id="cap-new" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
      </DialogShell>
      <DialogShell open={dlg === "publish"} onOpenChange={(o) => !o && setDlg(null)} title={`Publish ${sel?.name} version ${sel?.version}`} confirmLabel="Publish"
        consequence={`Terminals at ${sel?.wcIds.join(", ")} use this template from the next operation opened. The previous version of "${sel?.name}" becomes Superseded.${working ? " Unsaved edits are saved first." : ""}`}
        onConfirm={() => runD((d, c) => { if (working) ext.saveCaptureTemplate(d, c, { ...working, id: sel!.id }); ext.publishCaptureTemplate(d, c, sel!.id); setDraft(null) }, "Published")} />
      <DialogShell open={dlg === "delete"} onOpenChange={(o) => !o && setDlg(null)} title={`Delete draft ${sel?.id}`} confirmLabel="Delete draft" destructive consequence="The draft is removed. Published versions are never deleted."
        onConfirm={() => runD((d, c) => { ext.deleteCaptureDraft(d, c, sel!.id); setSelId("CAP-TBD-0001"); setDraft(null) }, "Draft deleted")} />
    </>
  )
}
