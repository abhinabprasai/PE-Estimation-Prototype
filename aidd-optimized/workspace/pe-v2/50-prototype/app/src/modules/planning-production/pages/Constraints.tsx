// FX-PLN-CONSTRAINTS Scheduling constraint masters (Book III E §2-3) [DOC:p.193; feature list]:
// operator qualifications, tools, setup families, crew roster and the planned-maintenance calendar.
// PRD facts: finite scheduling honours work-center calendars, qualifications and maintenance windows;
// a window inside the path of a pegged promise raises an at-risk record. The record fields (levels
// 1 to 5, family changeover hours, heads per shift, tool statuses) are design values.

import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Chip, EmptyState, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import type { ISODate, MaterialId, UserId, WorkCenterId } from "@/data/domain"
import { MATERIALS, TODAY, USERS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { AccessNote, StateBanner, StatePreview, matDesc, useAct, useActDialog, useScreenState, userName } from "../components"
import * as ext from "../lib/actions-ext"
import { addWorkdays, allWorkCenters } from "../lib/plan"
import { workdayRange } from "../widgets/Gantt"
import type { CrewRoster, MaintWindow, SetupFamily, ToolRec } from "../data/extra"
import type { Qualification } from "../data/types"

const ROLES = ["Production Scheduler", "Planning Manager", "Production supervisor", "Manufacturing engineer"] as const
const SECTIONS = [
  { id: "qual", label: "Operator qualifications" },
  { id: "tools", label: "Tools" },
  { id: "setup", label: "Setup families" },
  { id: "crew", label: "Crew roster" },
  { id: "maint", label: "Maintenance calendar" },
]
const FLOOR_USERS = USERS.filter((u) => u.roles.some((r) => ext.FLOOR_SKILL_ROLES.includes(r)))
const MAKE_ITEMS = MATERIALS.filter((m) => m.type === "FIN" || m.type === "SEMI")

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1"><Label>{label}</Label>{children}</div>
}
function Multi<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <fieldset className="grid gap-1">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-sm">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2">
            <Checkbox checked={value.includes(o.id)} onCheckedChange={(c) => onChange(c ? [...value, o.id] : value.filter((x) => x !== o.id))} aria-label={o.label} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
function Section({ title, hint, add, can, children }: { title: string; hint: string; add: () => void; can: boolean; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{hint}</span>
        <Button size="sm" className="ml-auto" disabled={!can} title={!can ? "Changes need a scheduling or engineering role" : undefined} onClick={add}>Add</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">{children}</div>
    </section>
  )
}
const Head = ({ cols }: { cols: string[] }) => <TableHeader className="bg-table-head"><TableRow>{cols.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>

type Dlg = null | { kind: "qual"; v: Partial<Qualification> } | { kind: "tool"; v: Partial<ToolRec> } | { kind: "setup"; v: Partial<SetupFamily> } | { kind: "crew"; v: Partial<CrewRoster> } | { kind: "maint"; v: Partial<MaintWindow> }

export function SchedulingMasters() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PLN-CONSTRAINTS")
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const [section, setSection] = useState("qual")
  const [dlg, setDlg] = useState<Dlg>(null)
  const can = (ROLES as readonly string[]).includes(role) && !st.readOnly
  const wcs = useMemo(() => allWorkCenters(s), [s])
  const wcOpts = wcs.map((w) => ({ id: w.id as WorkCenterId, label: `${w.id} ${w.name}` }))
  const empty = st.empty
  const days = useMemo(() => workdayRange(TODAY as ISODate, 30), [])
  const edit = (kind: Dlg extends infer D ? (D extends { kind: infer K } ? K : never) : never, v: object) => setDlg({ kind, v } as Dlg)
  const daysLeft = (iso: string) => Math.round((Date.parse(iso) - Date.parse(TODAY)) / 86400000)

  return (
    <>
      <ConfigPage
        header={{
          title: "Scheduling constraint masters",
          screenId: "FX-PLN-CONSTRAINTS",
          description: "What the finite scheduler may rely on: who is qualified, which tools exist, which items share a setup, who crews a work center and when it is down for maintenance.",
          chips: <Chip kind="design" note="The PRD says finite scheduling honours calendars, qualifications and maintenance windows; tool, family and crew record fields are prototype values">Record fields: design</Chip>,
          actions: <><StatePreview extended /><Button variant="outline" asChild><Link to="/production/schedule">Schedule board</Link></Button></>,
        }}
        sections={SECTIONS} section={section} onSectionChange={setSection} effectiveDated
      >
        <StateBanner st={st} />
        <AccessNote roles={ROLES} role={role} what="Maintaining scheduling masters" />
        {st.loading ? <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading"><div className="h-10 rounded-md border" /><div className="h-40 rounded-lg border" /></div>
          : st.error ? <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{st.error} <button className="underline" onClick={st.retry}>Try again</button></p>
          : section === "qual" ? (
            <Section title="Operator qualifications" hint="The terminal interlock checks these at start (E-skill)." can={can} add={() => edit("qual", { userId: FLOOR_USERS[0].id as UserId, level: 3, expires: "2027-10-01" as ISODate })}>
              {empty || !s.qualifications.length ? <EmptyState title="No qualifications recorded">Operations that name a required skill will not start until an operator holds it.</EmptyState> : (
                <Table><Head cols={["Record", "Operator", "Skill", "Level", "Expires", "Status", ""]} /><TableBody>
                  {s.qualifications.map((q) => {
                    const left = daysLeft(q.expires)
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono text-xs">{q.id}</TableCell><TableCell>{userName(q.userId)}</TableCell><TableCell>{q.skill}</TableCell><TableCell className="tabular">{q.level}</TableCell><TableCell className="tabular">{fmtDate(q.expires)}</TableCell>
                        <TableCell>{left < 0 ? <Chip kind="flag" note="Expired: the interlock blocks start">Expired</Chip> : left <= 30 ? <Chip kind="flag" note="Renew before it expires">Expires in {left} d</Chip> : "Valid"}</TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="ghost" disabled={!can} onClick={() => edit("qual", q)}>Edit</Button><Button size="sm" variant="ghost" disabled={!can} onClick={() => run((d, c) => ext.removeQualification(d, c, q.id), "Qualification removed")}>Remove</Button></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody></Table>
              )}
            </Section>
          ) : section === "tools" ? (
            <Section title="Tools" hint="A work center cannot run an operation while its tool is out of service or in calibration." can={can} add={() => edit("tool", { wcIds: [], qty: 1, status: "Available" })}>
              {empty || !s.tools.length ? <EmptyState title="No tools recorded" /> : (
                <Table><Head cols={["Tool", "Name", "Work centers", "Qty", "Status", "Location", "Used for", ""]} /><TableBody>
                  {s.tools.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.id}</TableCell><TableCell>{t.name}</TableCell><TableCell className="font-mono text-xs">{t.wcIds.join(", ")}</TableCell><TableCell className="tabular">{t.qty}</TableCell>
                      <TableCell>{t.status === "Available" || t.status === "In use" ? t.status : <Chip kind="flag" note="Not usable for planning today">{t.status}</Chip>}</TableCell><TableCell className="text-xs">{t.location}</TableCell><TableCell className="text-xs">{t.usedFor}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" disabled={!can} onClick={() => edit("tool", t)}>Edit</Button><Button size="sm" variant="ghost" disabled={!can} onClick={() => run((d, c) => ext.removeTool(d, c, t.id), "Tool removed")}>Remove</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </Section>
          ) : section === "setup" ? (
            <Section title="Setup families" hint="Changing between families on a work center adds the changeover hours." can={can} add={() => edit("setup", { wcId: "WC-210" as WorkCenterId, items: [], changeoverHours: 1 })}>
              {empty || !s.setupFamilies.length ? <EmptyState title="No setup families" /> : (
                <Table><Head cols={["Family", "Name", "Work center", "Items", "Changeover", ""]} /><TableBody>
                  {s.setupFamilies.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.id}</TableCell><TableCell>{f.name}</TableCell><TableCell className="font-mono text-xs">{f.wcId}</TableCell><TableCell className="max-w-72 text-xs">{f.items.map((i) => `${i} ${matDesc(i)}`).join("; ")}</TableCell><TableCell className="tabular">{f.changeoverHours} h</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" disabled={!can} onClick={() => edit("setup", f)}>Edit</Button><Button size="sm" variant="ghost" disabled={!can} onClick={() => run((d, c) => ext.removeSetupFamily(d, c, f.id), "Family removed")}>Remove</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </Section>
          ) : section === "crew" ? (
            <Section title="Crew roster" hint="Heads available per shift; the finite engine uses the operation's crew size." can={can} add={() => edit("crew", { wcId: "WC-210" as WorkCenterId, shift: "Day (06:00-14:30)", heads: 2, members: [], active: true })}>
              {empty || !s.crewRoster.length ? <EmptyState title="No crews" /> : (
                <Table><Head cols={["Crew", "Name", "Shift", "Work center", "Lead", "Members", "Heads", "State", ""]} /><TableBody>
                  {s.crewRoster.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell><TableCell>{c.name}</TableCell><TableCell className="text-xs">{c.shift}</TableCell><TableCell className="font-mono text-xs">{c.wcId}</TableCell><TableCell>{userName(c.leadId)}</TableCell><TableCell className="text-xs">{c.members.map(userName).join(", ")}</TableCell><TableCell className="tabular">{c.heads}</TableCell><TableCell>{c.active ? "Active" : "Inactive"}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" disabled={!can} onClick={() => edit("crew", c)}>Edit</Button><Button size="sm" variant="ghost" disabled={!can} onClick={() => run((d, c2) => ext.removeCrew(d, c2, c.id), "Crew removed")}>Remove</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </Section>
          ) : (
            <Section title="Planned-maintenance calendar" hint="A window removes the work center from the plan for its days; the plan re-runs and pegged promises are revalidated." can={can} add={() => edit("maint", { wcId: "WC-230" as WorkCenterId, kind: "Planned", from: addWorkdays(TODAY as ISODate, 5), to: addWorkdays(TODAY as ISODate, 6) })}>
              {empty ? <EmptyState title="No maintenance windows" /> : (
                <>
                  <div className="overflow-x-auto p-3">
                    <div role="table" aria-label="Maintenance calendar, next 30 working days" className="min-w-[760px] text-xs">
                      <div role="row" className="grid" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
                        <span role="columnheader" className="sr-only">Work center</span>
                        {days.map((d) => <span key={d} role="columnheader" className="tabular text-center text-[10px] text-muted-foreground">{d.slice(8)}</span>)}
                      </div>
                      {wcs.filter((w) => w.status !== "Inactive").map((w) => (
                        <div key={w.id} role="row" className="grid items-center border-t" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
                          <span role="rowheader" className="font-mono">{w.id}</span>
                          {days.map((d) => {
                            const m = s.maintWindows.find((x) => x.wcId === w.id && (x.status === "Scheduled" || x.status === "In progress") && d >= x.from && d <= x.to)
                            return <span key={d} title={m ? `${m.id} ${m.kind}: ${m.note}` : undefined} className={`h-5 border-l ${m ? "bg-status-pending" : ""}`} aria-label={m ? `${w.id} ${d} ${m.kind}` : undefined} />
                          })}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Shaded days are blocked windows. Working days only; day of the month shown.</p>
                  </div>
                  <Table><Head cols={["Window", "Work center", "From", "To", "Kind", "Note", "Status", ""]} /><TableBody>
                    {s.maintWindows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.id}</TableCell><TableCell className="font-mono text-xs">{m.wcId}</TableCell><TableCell className="tabular">{fmtDate(m.from)}</TableCell><TableCell className="tabular">{fmtDate(m.to)}</TableCell><TableCell>{m.kind}</TableCell><TableCell className="max-w-72 text-xs">{m.note}</TableCell><TableCell>{m.status}</TableCell>
                        <TableCell className="text-right">
                          {(m.status === "Scheduled" || m.status === "In progress") && <>
                            <Button size="sm" variant="ghost" disabled={!can} onClick={() => run((d, c) => ext.setMaintStatus(d, c, m.id, "Done"), "Window marked Done; the plan re-ran")}>Mark done</Button>
                            <Button size="sm" variant="ghost" disabled={!can} onClick={() => run((d, c) => ext.setMaintStatus(d, c, m.id, "Cancelled"), "Window cancelled; the plan re-ran")}>Cancel</Button>
                          </>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody></Table>
                </>
              )}
            </Section>
          )}
        <RulesPanel rules={[
          ["Finite", "Scheduling honours calendars, qualifications and maintenance windows", "DOC:p.193 Book III E §2-3"],
          ["Window", "A maintenance window inside the path of a pegged promise raises an at-risk record", "DOC:p.193 §4"],
          ["Calibration", "Calibration due-soon alerts at 30, 14 and 3 days", "DOC:Book I calibration (INV 15.11)"],
          ["Interlock", "The terminal blocks a start when the badge-in operator lacks the required skill", "DOC:p.76 §6"],
        ]} />
      </ConfigPage>

      <DialogShell open={dlg?.kind === "qual"} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.kind === "qual" && dlg.v.id ? `Edit ${dlg.v.id}` : "Add qualification"} confirmLabel="Save"
        consequence="The terminal interlock reads this record at the next start." onConfirm={() => dlg?.kind === "qual" ? runD((d, c) => ext.saveQualification(d, c, dlg.v as never), "Qualification saved") : null}>
        {dlg?.kind === "qual" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Operator"><Select value={dlg.v.userId} onValueChange={(v) => setDlg({ kind: "qual", v: { ...dlg.v, userId: v as UserId } })}><SelectTrigger aria-label="Operator"><SelectValue /></SelectTrigger><SelectContent>{FLOOR_USERS.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Skill"><Input aria-label="Skill" value={dlg.v.skill ?? ""} onChange={(e) => setDlg({ kind: "qual", v: { ...dlg.v, skill: e.target.value } })} /></Field>
            <Field label="Level (1 to 5)"><Input aria-label="Level" type="number" min={1} max={5} value={dlg.v.level ?? ""} onChange={(e) => setDlg({ kind: "qual", v: { ...dlg.v, level: Number(e.target.value) } })} /></Field>
            <Field label="Expires"><Input aria-label="Expires" type="date" value={dlg.v.expires ?? ""} onChange={(e) => setDlg({ kind: "qual", v: { ...dlg.v, expires: e.target.value as ISODate } })} /></Field>
          </div>
        )}
      </DialogShell>

      <DialogShell open={dlg?.kind === "tool"} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.kind === "tool" && dlg.v.id ? `Edit ${dlg.v.id}` : "Add tool"} confirmLabel="Save" onConfirm={() => dlg?.kind === "tool" ? runD((d, c) => ext.saveTool(d, c, { name: "", wcIds: [], qty: 1, status: "Available", location: "", usedFor: "", ...dlg.v } as never), "Tool saved") : null}>
        {dlg?.kind === "tool" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input aria-label="Name" value={dlg.v.name ?? ""} onChange={(e) => setDlg({ kind: "tool", v: { ...dlg.v, name: e.target.value } })} /></Field>
            <Field label="Quantity"><Input aria-label="Quantity" type="number" min={1} value={dlg.v.qty ?? 1} onChange={(e) => setDlg({ kind: "tool", v: { ...dlg.v, qty: Number(e.target.value) } })} /></Field>
            <Field label="Status"><Select value={dlg.v.status} onValueChange={(v) => setDlg({ kind: "tool", v: { ...dlg.v, status: v as ToolRec["status"] } })}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent>{["Available", "In use", "Calibration due", "Out of service"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Location"><Input aria-label="Location" value={dlg.v.location ?? ""} onChange={(e) => setDlg({ kind: "tool", v: { ...dlg.v, location: e.target.value } })} /></Field>
            <div className="sm:col-span-2"><Multi label="Work centers" options={wcOpts} value={dlg.v.wcIds ?? []} onChange={(v) => setDlg({ kind: "tool", v: { ...dlg.v, wcIds: v } })} /></div>
            <div className="sm:col-span-2"><Field label="Used for"><Input aria-label="Used for" value={dlg.v.usedFor ?? ""} onChange={(e) => setDlg({ kind: "tool", v: { ...dlg.v, usedFor: e.target.value } })} /></Field></div>
          </div>
        )}
      </DialogShell>

      <DialogShell open={dlg?.kind === "setup"} onOpenChange={(o) => !o && setDlg(null)} wide title={dlg?.kind === "setup" && dlg.v.id ? `Edit ${dlg.v.id}` : "Add setup family"} confirmLabel="Save" onConfirm={() => dlg?.kind === "setup" ? runD((d, c) => ext.saveSetupFamily(d, c, { name: "", wcId: "WC-210" as WorkCenterId, items: [], changeoverHours: 0, ...dlg.v } as never), "Family saved") : null}>
        {dlg?.kind === "setup" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name"><Input aria-label="Name" value={dlg.v.name ?? ""} onChange={(e) => setDlg({ kind: "setup", v: { ...dlg.v, name: e.target.value } })} /></Field>
            <Field label="Work center"><Select value={dlg.v.wcId} onValueChange={(v) => setDlg({ kind: "setup", v: { ...dlg.v, wcId: v as WorkCenterId } })}><SelectTrigger aria-label="Work center"><SelectValue /></SelectTrigger><SelectContent>{wcOpts.map((w) => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Changeover hours"><Input aria-label="Changeover hours" type="number" min={0} step={0.5} value={dlg.v.changeoverHours ?? 0} onChange={(e) => setDlg({ kind: "setup", v: { ...dlg.v, changeoverHours: Number(e.target.value) } })} /></Field>
            <div className="sm:col-span-3"><Multi<MaterialId> label="Items in the family" options={MAKE_ITEMS.map((m) => ({ id: m.id as MaterialId, label: `${m.id}` }))} value={dlg.v.items ?? []} onChange={(v) => setDlg({ kind: "setup", v: { ...dlg.v, items: v } })} /></div>
          </div>
        )}
      </DialogShell>

      <DialogShell open={dlg?.kind === "crew"} onOpenChange={(o) => !o && setDlg(null)} wide title={dlg?.kind === "crew" && dlg.v.id ? `Edit ${dlg.v.id}` : "Add crew"} confirmLabel="Save" onConfirm={() => dlg?.kind === "crew" ? runD((d, c) => ext.saveCrew(d, c, { name: "", members: [], leadId: dlg.v.members?.[0] ?? ("" as UserId), ...dlg.v } as never), "Crew saved") : null}>
        {dlg?.kind === "crew" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input aria-label="Name" value={dlg.v.name ?? ""} onChange={(e) => setDlg({ kind: "crew", v: { ...dlg.v, name: e.target.value } })} /></Field>
            <Field label="Work center"><Select value={dlg.v.wcId} onValueChange={(v) => setDlg({ kind: "crew", v: { ...dlg.v, wcId: v as WorkCenterId } })}><SelectTrigger aria-label="Work center"><SelectValue /></SelectTrigger><SelectContent>{wcOpts.map((w) => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Shift"><Select value={dlg.v.shift} onValueChange={(v) => setDlg({ kind: "crew", v: { ...dlg.v, shift: v as CrewRoster["shift"] } })}><SelectTrigger aria-label="Shift"><SelectValue /></SelectTrigger><SelectContent>{["Day (06:00-14:30)", "Evening (14:30-23:00)"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Heads per shift"><Input aria-label="Heads per shift" type="number" min={1} value={dlg.v.heads ?? 1} onChange={(e) => setDlg({ kind: "crew", v: { ...dlg.v, heads: Number(e.target.value) } })} /></Field>
            <div className="sm:col-span-2"><Multi<UserId> label="Members" options={FLOOR_USERS.map((u) => ({ id: u.id as UserId, label: u.name }))} value={dlg.v.members ?? []} onChange={(v) => setDlg({ kind: "crew", v: { ...dlg.v, members: v } })} /></div>
            <Field label="Lead"><Select value={dlg.v.leadId} onValueChange={(v) => setDlg({ kind: "crew", v: { ...dlg.v, leadId: v as UserId } })}><SelectTrigger aria-label="Lead"><SelectValue placeholder="Choose lead" /></SelectTrigger><SelectContent>{(dlg.v.members ?? []).map((u) => <SelectItem key={u} value={u}>{userName(u)}</SelectItem>)}</SelectContent></Select></Field>
            <label className="flex items-center gap-2 pt-6 text-sm"><Checkbox checked={dlg.v.active ?? true} onCheckedChange={(c) => setDlg({ kind: "crew", v: { ...dlg.v, active: !!c } })} aria-label="Active" />Active</label>
          </div>
        )}
      </DialogShell>

      <DialogShell open={dlg?.kind === "maint"} onOpenChange={(o) => !o && setDlg(null)} wide title="Add maintenance window" confirmLabel="Add window"
        consequence="The work center has no capacity on these days. The schedule re-runs now, and a pegged promise in the path is revalidated (at-risk record)."
        onConfirm={() => dlg?.kind === "maint" ? runD((d, c) => ext.addMaintWindow(d, c, { wcId: "WC-230" as WorkCenterId, from: "" as ISODate, to: "" as ISODate, kind: "Planned", note: "", ...dlg.v } as never), (r) => `${r.id} added${r.atRisk.length ? `; ${r.atRisk.length} promise(s) moved to at-risk review` : ""}`) : null}>
        {dlg?.kind === "maint" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Work center"><Select value={dlg.v.wcId} onValueChange={(v) => setDlg({ kind: "maint", v: { ...dlg.v, wcId: v as WorkCenterId } })}><SelectTrigger aria-label="Work center"><SelectValue /></SelectTrigger><SelectContent>{wcOpts.map((w) => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Kind"><Select value={dlg.v.kind} onValueChange={(v) => setDlg({ kind: "maint", v: { ...dlg.v, kind: v as MaintWindow["kind"] } })}><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger><SelectContent>{["Planned", "Calibration", "Breakdown"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="From"><Input aria-label="From" type="date" value={dlg.v.from ?? ""} onChange={(e) => setDlg({ kind: "maint", v: { ...dlg.v, from: e.target.value as ISODate } })} /></Field>
            <Field label="To"><Input aria-label="To" type="date" value={dlg.v.to ?? ""} onChange={(e) => setDlg({ kind: "maint", v: { ...dlg.v, to: e.target.value as ISODate } })} /></Field>
            <div className="sm:col-span-2"><Field label="What it is for"><Textarea aria-label="Note" value={dlg.v.note ?? ""} onChange={(e) => setDlg({ kind: "maint", v: { ...dlg.v, note: e.target.value } })} /></Field></div>
          </div>
        )}
      </DialogShell>
    </>
  )
}
