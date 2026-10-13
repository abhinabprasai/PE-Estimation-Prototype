// FX-MM-CREATEFLOW: Material creation flow, placeholder to activation [Book V §7.4; Book II §4.2-4.3].
// A guided, live walk through the real records: Engineering needs a part with no number (placeholder
// event) -> Materials opens an MCR with its task checklist -> each department completes its view ->
// the Materials Manager activates (V-MM-01) -> Engineering's EBOM line is unblocked. Every step acts
// on the same MCR, material and event bus the rest of the prototype uses, so the result also shows in
// the creation request queue and the EBOM. Materials are created only through an MCR (C-47).

import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WizardPage } from "@/components/templates"
import { Chip, EmptyState, FamilyBadge, RulesPanel } from "@/components/patterns"
import { store, useRole, useSlice } from "@/store"
import { fmtDate } from "@/lib/format"
import { ACCOUNTING_TASK, completeness, slaState, taskBlockedBy } from "../lib/rules"
import { activateMcr, completeTask, submitMcr } from "../data/actions"
import { raisePlaceholder } from "../data/ext-actions"
import { getMaterial, R } from "../data/state"
import { MatLink, MaterialStatus, Reading, Section, SlaTag, userName } from "../components/common"
import { useViewState } from "../components/states"
import { run } from "../components/run"

const ERS = [
  { id: "ER-TBD-0377", label: "ER-TBD-0377 Phase 2 design, three units from rev B" },
  { id: "ER-TBD-0301", label: "ER-TBD-0301 20 MVA ONAN/ONAF (closed: for the history only)" },
]

export function CreateFlow() {
  const s = useSlice("materials")
  const eng = useSlice("engineering")
  const nav = useNavigate()
  const [role, setRole] = useRole()
  const st = useViewState("FX-MM-CREATEFLOW", { degradedWhat: "The engineering feed is slow" })
  const [mcrId, setMcrId] = useState("")
  const [er, setEr] = useState(ERS[0].id)
  const [desc, setDesc] = useState("Cooling fan 400 mm, 480 V, IP55, for radiator bank")
  const [err, setErr] = useState<string | null>(null)
  const waiting = eng.placeholders.filter((p) => p.status === "Draft")
  const open = s.mcrs.filter((r) => r.path === "Engineering Placeholder")
  const r = s.mcrs.find((x) => x.id === mcrId)
  const mat = r?.materialId ? getMaterial(s, r.materialId) : undefined
  const comp = mat ? completeness(mat, s.views[mat.id]) : undefined
  const ph = r?.materialId ? eng.placeholders.find((p) => p.id === r.materialId) : undefined
  const done = r?.tasks.filter((t) => t.done).length ?? 0
  const events = store.bus.recent().filter((e) => e.type === "materials.materialActivated" && (e.payload as { materialId?: string }).materialId === r?.materialId)
  const canWrite = st.canWrite
  return (
    <>
      {st.banners}
      <WizardPage
        header={{
          screenId: "FX-MM-CREATEFLOW",
          title: "Material creation flow",
          description: "From a placeholder that Engineering needs to an Active material that unblocks the EBOM. Every step acts on the live records.",
          chips: <Chip kind="oq" id="FL-10" note="Flow FL-10: Engineering placeholder to Materials activation">Flow FL-10</Chip>,
          actions: <>{st.toolbar}<Button variant="outline" asChild><Link to="/materials/creation-requests">Creation requests</Link></Button></>,
        }}
        finishLabel="Open the creation request"
        consequence={r ? `Closes this walk-through and opens ${r.id}. Nothing else changes: the material ${r.materialId} is ${mat?.status ?? ""}.` : "Start the flow by raising a placeholder."}
        onCancel={() => nav("/materials/creation-requests")}
        onFinish={() => {
          if (r) nav(R.mcr(r.id))
          return null
        }}
        steps={[
          {
            id: "placeholder",
            title: "Placeholder",
            validate: () => (r ? null : "Raise a placeholder, or pick up an open one, to continue."),
            content: (
              <div className="flex max-w-2xl flex-col gap-4">
                <p className="text-sm">Engineering needs a part that has no material number. It raises a placeholder against its engineering request; Materials reserves the number and opens the creation request with its tasks. The part sits in Data Completion, never Active, until the tasks are done (V-ENG-03).</p>
                {r ? (
                  <Section title="Placeholder raised">
                    <p className="text-sm"><MatLink id={r.materialId ?? ""} /> · {r.description} · {mat && <MaterialStatus m={mat} />}</p>
                    <p className="text-sm">Creation request <Link to={R.mcr(r.id)} className="font-mono text-link underline-offset-4 hover:underline">{r.id}</Link>, origin {r.originRef?.id ?? "none"}, {r.tasks.length} tasks.</p>
                    <Button size="sm" variant="ghost" className="w-fit" onClick={() => setMcrId("")}>Start over with another</Button>
                  </Section>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="cf-er">Engineering request</Label>
                      <Select value={er} onValueChange={setEr}>
                        <SelectTrigger id="cf-er"><SelectValue /></SelectTrigger>
                        <SelectContent>{ERS.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="cf-desc">Part description</Label>
                      <Input id="cf-desc" value={desc} onChange={(e) => setDesc(e.target.value)} aria-invalid={st.validation && desc.trim().length < 8 ? true : undefined} />
                      {(st.validation || err) && desc.trim().length < 8 && <p className="text-xs text-destructive">Describe the part in at least 8 characters.</p>}
                    </div>
                    {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
                    <Button className="w-fit" disabled={!canWrite} title={st.blockedWhy} onClick={() => {
                      const x = raisePlaceholder(er, desc)
                      if (!x.ok) return setErr(x.error)
                      setErr(null)
                      setMcrId(x.value)
                      toast.success(`${x.value} opened with its task checklist`)
                    }}>Raise placeholder from Engineering</Button>
                    {waiting.length > 0 && (
                      <div className="flex max-w-xl flex-col gap-1">
                        <Label htmlFor="cf-wait">Or follow a placeholder that is already on an EBOM</Label>
                        <Select
                          value=""
                          onValueChange={(id) => {
                            const p = waiting.find((x) => x.id === id)
                            if (!p) return
                            const have = s.mcrs.find((m) => m.materialId === p.id)
                            if (have) {
                              setErr(null)
                              setMcrId(have.id)
                              return
                            }
                            if (!canWrite) return
                            const erId = eng.eboms.find((e) => e.id === p.ebomId)?.engineeringRequestId ?? "ER-TBD-0377"
                            const x = raisePlaceholder(erId, `${p.id}: ${p.description} (${p.ebomId} line ${p.line})`)
                            if (!x.ok) return setErr(x.error)
                            setErr(null)
                            setMcrId(x.value)
                            toast.success(`${x.value} opened for ${p.id}: Engineering's line turns Active when it activates`)
                          }}
                        >
                          <SelectTrigger id="cf-wait"><SelectValue placeholder="Choose an EBOM placeholder" /></SelectTrigger>
                          <SelectContent>{waiting.map((p) => <SelectItem key={p.id} value={p.id}>{p.id} on {p.ebomId} line {p.line}: {p.description.slice(0, 40)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {open.length > 0 && (
                      <div className="flex max-w-xl flex-col gap-1">
                        <Label htmlFor="cf-open">Or follow a placeholder that is already open</Label>
                        <Select value="" onValueChange={setMcrId}>
                          <SelectTrigger id="cf-open"><SelectValue placeholder="Choose an engineering placeholder request" /></SelectTrigger>
                          <SelectContent>{open.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} · {x.stage} · {x.description.slice(0, 50)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </div>
            ),
          },
          {
            id: "tasks",
            title: "MCR tasks",
            validate: () => (r && (r.stage === "Ready to activate" || r.stage === "Activated") ? null : "Every task must be done before activation."),
            content: !r ? (
              <EmptyState title="No request yet">Raise a placeholder in step 1.</EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {r.stage === "Draft" && (
                  <p className="flex flex-wrap items-center gap-3 text-sm">
                    This request is still a Draft: the tasks have not been sent yet.
                    <Button size="sm" disabled={!canWrite} title={st.blockedWhy} onClick={() => run(submitMcr(r.id), `${r.id} submitted: tasks sent to their owners`)}>Submit for completion</Button>
                  </p>
                )}
                <p className="text-sm">{done} of {r.tasks.length} tasks done. Each task belongs to the owning role (SLA two business days); Accounting and Costing waits for Planning and Purchasing (§4.2). Acting as <strong>{role}</strong>.</p>
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Task (view)</TableHead><TableHead>Owner</TableHead><TableHead>SLA</TableHead><TableHead>State</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.tasks.map((t) => {
                      const blocked = taskBlockedBy(t, r.tasks)
                      return (
                        <TableRow key={t.id}>
                          <TableCell>{t.view}{t.view === ACCOUNTING_TASK && <span className="block text-xs text-muted-foreground">After Planning and Purchasing</span>}</TableCell>
                          <TableCell>{t.ownerRole}<span className="block text-xs text-muted-foreground">{userName(t.ownerUserId)}</span></TableCell>
                          <TableCell><SlaTag state={slaState(t)} due={fmtDate(t.slaDue)} /></TableCell>
                          <TableCell>{t.done ? <FamilyBadge family="done" label={`Done ${fmtDate(t.doneOn)}`} size="sm" /> : blocked.length ? <span className="text-xs text-muted-foreground">Waits for {blocked.join(" and ")}</span> : "Open"}</TableCell>
                          <TableCell>
                            {t.done || r.stage !== "Tasks open" ? null : role === t.ownerRole ? (
                              <Button size="sm" disabled={!canWrite || blocked.length > 0} title={st.blockedWhy} onClick={() => run(completeTask(r.id, t.id), `${t.view} done`)}>Complete task</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setRole(t.ownerRole)}>Act as {t.ownerRole}</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground">Switching "Acting as" is a prototype shortcut so one person can walk the whole flow; in production each role works its own queue.</p>
              </div>
            ),
          },
          {
            id: "activate",
            title: "Activation",
            validate: () => (r?.stage === "Activated" ? null : "Activate the material to continue."),
            content: !r ? (
              <EmptyState title="No request yet" />
            ) : (
              <div className="flex max-w-3xl flex-col gap-3">
                <p className="text-sm">The Materials Manager activates when every task is done and V-MM-01 (completeness) passes.</p>
                <p className="text-sm">Material {mat && <MatLink id={mat.id} />} {mat && <MaterialStatus m={mat} />} · completeness {comp?.pct ?? 0}%</p>
                {comp && comp.missing.length > 0 && <ul className="list-disc pl-6 text-sm">{comp.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
                {r.stage === "Activated" ? (
                  <p role="status" className="rounded-md border px-3 py-2 text-sm">Activated {fmtDate(r.activatedOn)}. The material is Active and the event materials.materialActivated has been sent.</p>
                ) : role !== "Materials Manager" ? (
                  <Button className="w-fit" variant="outline" onClick={() => setRole("Materials Manager")}>Act as Materials Manager</Button>
                ) : (
                  <Button className="w-fit" disabled={!canWrite || r.stage !== "Ready to activate"} title={st.blockedWhy ?? (r.stage !== "Ready to activate" ? "Complete every task first" : undefined)} onClick={() => run(activateMcr(r.id), `${r.materialId} is Active`)}>Activate material</Button>
                )}
              </div>
            ),
          },
          {
            id: "ebom",
            title: "EBOM unblock",
            content: !r ? (
              <EmptyState title="No request yet" />
            ) : (
              <div className="flex max-w-3xl flex-col gap-3 text-sm">
                {r.stage !== "Activated" ? (
                  <p role="status" className="rounded-md border px-3 py-2">Waiting: the EBOM line holding {r.materialId} stays a Draft placeholder until the material is Active (V-ENG-03).</p>
                ) : (
                  <>
                    <p>Event <span className="font-mono">materials.materialActivated</span> for <span className="font-mono">{r.materialId}</span> ({events.length ? "sent" : "sent earlier"}). Engineering reacts to it:</p>
                    {ph ? (
                      <p role="status" className="rounded-md border px-3 py-2">
                        Placeholder {ph.id} on <Link to={`/engineering/boms/${ph.ebomId}`} className="font-mono text-link underline-offset-4 hover:underline">{ph.ebomId}</Link> line {ph.line} is now <FamilyBadge family="active" label={ph.status} size="sm" />: the EBOM can be released.
                      </p>
                    ) : (
                      <p role="status" className="rounded-md border px-3 py-2">No EBOM line carries {r.materialId}: this placeholder was raised here, outside the EBOM editor. Raise one from an EBOM line in Engineering to see the line turn Active.</p>
                    )}
                  </>
                )}
                <p className="flex flex-wrap gap-2"><Reading id="RD-MM-05" /><Reading id="RD-MM-40" /></p>
              </div>
            ),
          },
        ]}
      />
      <RulesPanel
        rules={[
          ["Book V §7.4", "Placeholder to activation: Engineering raises a placeholder, Materials generates the task checklist, the departments complete their views, the Materials Manager activates, the originating demand unblocks.", "[Book V §7.4]"],
          ["§4.2", "Tasks per material type and view, SLA two business days, Accounting and Costing after Planning and Purchasing.", "[Book II §4.2]"],
          ["V-MM-01", "Activation requires every mandatory field of the type to be complete.", "[Book II §16.4]"],
          ["C-47", "A material is created only through an MCR; there is no create-material form.", "erd-sketch C-47"],
        ]}
      />
    </>
  )
}
