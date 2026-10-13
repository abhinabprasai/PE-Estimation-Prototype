// MP-PLANT-001 Plant Master [DOC:pp.282-283 Book VII §4]: "/configuration/plants, List + detail, IT admin drafts, Controller
// approves. Plant code, owning entity, address, working calendar link, default receiving and shipping warehouses, shipping
// points, planning parameters block, status. Create. Activate after the setup checklist steps 2 to 5 verify. Deactivate
// blocks new documents only." The network engine behaviors activate when DEC-07 fires; until then there is one plant.
// The plant state words (Draft, Active, Inactive) are not an S-row: shown as text (OQ-21, AR-1).

import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, EmptyState, KV, RulesPanel } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { LEGAL_ENTITIES, WAREHOUSES, WORK_CENTERS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { requestPlantState, savePlant, setSetupStep, type PlantDraft } from "../data/cfg-actions"
import type { PlantRecord } from "../data/cfg-types"
import { can, plantState } from "../lib/cfg"
import { fmtDateTime } from "../lib/time"
import { Field, SimpleSelect, StateText, userName } from "../components/common"
import { StateFrame, StatePicker, useView, type View } from "../components/states"

const entity = (id: string) => LEGAL_ENTITIES.find((e) => e.id === id)?.name ?? id
const blank = (n: number): PlantDraft => ({ code: `PL-TBD-${String(n).padStart(2, "0")}`, name: "", entityId: LEGAL_ENTITIES[0].id, address: "", calendar: "", receivingWarehouse: "", shippingWarehouse: "", shippingPoint: "", leadTimeDays: 2, planningTimeFenceDays: 14, mrpArea: "", safetyTimeDays: 1 })
const toDraft = (p: PlantRecord): PlantDraft => ({ code: p.code, name: p.name, entityId: p.entityId, address: p.address, calendar: p.calendar, receivingWarehouse: p.receivingWarehouse, shippingWarehouse: p.shippingWarehouse, shippingPoint: p.shippingPoints[0] ?? "", leadTimeDays: p.planning.leadTimeDays, planningTimeFenceDays: p.planning.planningTimeFenceDays, mrpArea: p.planning.mrpArea, safetyTimeDays: p.planning.safetyTimeDays })

function Dec07() {
  return <p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">Multi-plant activates on <Chip kind="oq" id="DEC-07" note="The network engine behaviors activate when DEC-07 fires; until then the screens run with one plant and one implicit lane">DEC-07</Chip>. Until then planning and ATP behave as for one plant; a second plant can be drafted, verified and approved here without changing the go-live path.</p>
}

// ============================================================================ list
export function PlantList() {
  const s = useSlice("adminCfg")
  const a = useSlice("admin")
  const { role } = useCore()
  const view = useView("MP-PLANT-001")
  const [dlg, setDlg] = useState(false)
  const rows = view.empty ? [] : s.plants
  return (
    <div className="flex flex-col gap-4">
      <StateFrame view={view} cols={6} emptyTitle="No plants." emptyBody="One plant exists at go-live; Scenario reset restores it." degraded="Degraded: the plant calendar service is slow. Plants and their setup list are unaffected." subject="the plant master">
        <ListPage<PlantRecord>
          header={{
            title: "Plant master",
            screenId: "MP-PLANT-001",
            description: "Every plant with its owning legal entity, calendar, warehouses and planning parameters. IT drafts a plant, the Controller approves its activation.",
            chips: <Chip kind="design" note="Route /configuration/plants is a design value; the screen is Book VII §4">Design route</Chip>,
            actions: <StatePicker view={view} />,
            primary: <Button onClick={() => setDlg(true)} disabled={!can.plantDraft(role) || !!view.writeError()} title={can.plantDraft(role) ? undefined : "Plant IT drafts plants"}>New plant</Button>,
          }}
          above={<Dec07 />}
          table={{
            rows,
            rowId: (p) => p.id,
            loading: view.loading,
            caption: "Plants",
            rowHref: (p) => `/configuration/plants/${p.id}`,
            searchText: (p) => `${p.code} ${p.name} ${entity(p.entityId)}`,
            searchPlaceholder: "Search plants",
            columns: [
              { id: "code", header: "Plant", value: (p) => p.code, mono: true, sortable: true },
              { id: "name", header: "Name", value: (p) => p.name, sortable: true },
              { id: "ent", header: "Owning entity", value: (p) => entity(p.entityId), filterable: true },
              { id: "st", header: "State", value: (p) => plantState(p, a.instances).state, filterable: true, cell: (p) => { const x = plantState(p, a.instances); return <StateText tone={x.pending ? "attention" : x.state === "Inactive" ? "muted" : "default"}>{x.state}{x.pending ? `, ${x.pending === "Active" ? "activation" : "deactivation"} pending` : ""}</StateText> } },
              { id: "chk", header: "Setup steps verified", value: (p) => p.steps.filter((x) => x.done).length, align: "right", mono: true, cell: (p) => `${p.steps.filter((x) => x.done).length} of 9` },
              { id: "wh", header: "Receiving / shipping", value: (p) => `${p.receivingWarehouse} / ${p.shippingWarehouse}` },
            ],
          }}
        />
      </StateFrame>
      <RulesPanel rules={[["§4-a", "IT admin drafts, the Controller approves", "DOC:p.282 §4 MP-PLANT-001"], ["§4-b", "Activate after setup checklist steps 2 to 5 verify; Deactivate blocks new documents only", "DOC:p.282 §4 MP-PLANT-001"], ["§4-c", "No table added from this point may assume single-plant or single-entity", "DOC:p.195 Book III F §2"]]} />
      <PlantDialog open={dlg} onClose={() => setDlg(false)} view={view} />
    </div>
  )
}

// ============================================================================ detail
export function PlantDetail() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const s = useSlice("adminCfg")
  const a = useSlice("admin")
  const { role } = useCore()
  const view = useView("MP-PLANT-001-detail")
  const [dlg, setDlg] = useState<null | "edit" | "activate" | "deactivate" | { verify: number }>(null)
  const [evidence, setEvidence] = useState("")
  const p = s.plants.find((x) => x.id === id)
  if (!p)
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={`Plant ${id} not found`}>It may have been cleared by Scenario reset.</EmptyState>
        <Button variant="outline" className="self-start" onClick={() => navigate("/configuration/plants")}>Back to plants</Button>
      </div>
    )
  const ps = plantState(p, a.instances)
  const whs = WAREHOUSES.filter((w) => w.plantId === p.id)
  const wcs = p.id === "PL-TBD-01" ? WORK_CENTERS.length : p.steps.find((x) => x.n === 3)?.evidence ? 6 : 0
  const readOnly = ps.state === "Inactive"
  const editable = can.plantDraft(role) && !view.writeError() && ps.state === "Draft"

  return (
    <div className="flex flex-col gap-4">
      <StateFrame view={view} cols={4} emptyTitle="Nothing to show." degraded="Degraded: the plant calendar service is slow. This record is unaffected." subject="this plant">
        <DetailPage
          header={{
            title: `${p.code} ${p.name}`,
            screenId: "MP-PLANT-001",
            crumbs: [{ label: "Plants", to: "/configuration/plants" }, { label: p.code }],
            description: `${entity(p.entityId)}. ${p.address}`,
            chips: (<><StateText tone={ps.pending ? "attention" : ps.state === "Inactive" ? "muted" : "default"}>{ps.state}{ps.pending ? `, ${ps.pending === "Active" ? "activation" : "deactivation"} waits for the Controller` : ""}</StateText>{readOnly && <Chip kind="design" note="An inactive plant takes no new documents; its record is read-only">Read-only</Chip>}</>),
            actions: (<><StatePicker view={view} /><Button variant="outline" onClick={() => setDlg("edit")} disabled={!editable}>Edit draft</Button>{ps.state === "Active" && !ps.pending && <Button variant="outline" onClick={() => setDlg("deactivate")} disabled={!can.plantDraft(role) || !!view.writeError()}>Deactivate</Button>}</>),
            primary: ps.state === "Draft" && !ps.pending ? <Button onClick={() => setDlg("activate")} disabled={!can.plantDraft(role) || !!view.writeError()} title={can.plantDraft(role) ? undefined : "Plant IT raises the activation; the Controller approves"}>Request activation</Button> : undefined,
          }}
          summary={
            <>
              <KV k="Owning entity">{entity(p.entityId)}</KV>
              <KV k="Working calendar">{p.calendar}</KV>
              <KV k="Receiving warehouse">{p.receivingWarehouse}</KV>
              <KV k="Shipping warehouse">{p.shippingWarehouse}</KV>
            </>
          }
          tabs={[
            { id: "overview", label: "Overview", content: (
              <div className="flex flex-col gap-4">
                <dl className="grid max-w-3xl gap-4 md:grid-cols-2">
                  <KV k="Plant code">{p.code}</KV>
                  <KV k="Shipping points">{p.shippingPoints.join(", ")}<span className="block text-xs text-muted-foreground">Phase 1: implicit, field reserved</span></KV>
                  <KV k="Warehouses in the plant master">{whs.length ? whs.map((w) => w.id).join(", ") : "None created yet (step 2)"}</KV>
                  <KV k="Work centers">{wcs ? `${wcs}${p.id === "PL-TBD-01" ? "" : " of 9 created"}` : "None created yet (step 3)"}</KV>
                </dl>
                {ps.state === "Draft" && <Dec07 />}
              </div>
            ) },
            { id: "planning", label: "Planning parameters", content: (
              <dl className="grid max-w-3xl gap-4 md:grid-cols-2">
                <KV k="MRP area">{p.planning.mrpArea}</KV>
                <KV k="Planned lead-time offset">{p.planning.leadTimeDays} days</KV>
                <KV k="Planning time fence">{p.planning.planningTimeFenceDays} days</KV>
                <KV k="Safety time">{p.planning.safetyTimeDays} days</KV>
                <p className="col-span-2 text-xs text-muted-foreground"><Chip kind="design">Planning block</Chip> The specification names a planning-parameters block without listing its fields; these four are design values (AR-44).</p>
              </dl>
            ) },
            { id: "setup", label: "Setup checklist", count: p.steps.filter((x) => x.done).length, content: (
              <div className="flex flex-col gap-2">
                <ol className="flex flex-col divide-y rounded-md border">
                  {p.steps.map((st) => (
                    <li key={st.n} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                      <span className="flex size-6 items-center justify-center rounded-full border text-xs">{st.done ? <Check className="size-3" aria-label="Verified" /> : st.n}</span>
                      <span className="min-w-60 flex-1"><span className="font-medium">{st.action}</span>{st.gate && <Chip kind="design" note="Steps 2 to 5 must verify before activation">Gate</Chip>}<span className="block text-xs text-muted-foreground">{st.where}{st.done ? ` · verified ${st.on ? fmtDate(st.on) : ""} by ${userName(st.by)}: ${st.evidence}` : ""}</span></span>
                      <Button size="sm" variant="outline" disabled={readOnly || !(can.plantDraft(role) || can.plantApprove(role)) || !!view.writeError()} onClick={() => (st.done ? view.run(() => setSetupStep(p.id, st.n, false, "")) : (setEvidence(""), setDlg({ verify: st.n })))}>{st.done ? "Reopen" : "Verify"}</Button>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">Activation needs steps 2 to 5 verified. The other steps are recorded and do not block activation.</p>
              </div>
            ) },
            { id: "audit", label: "History", content: <ol className="flex flex-col gap-1 text-sm">{[...p.history].reverse().map((h, n) => <li key={n}><span className="tabular text-xs text-muted-foreground">{fmtDateTime(h.at)}</span> {h.by === "PRD seed" ? "PRD seed" : userName(h.by)}: {h.what}</li>)}</ol> },
          ]}
          aside={<section aria-label="Related" className="flex flex-col gap-2 rounded-lg border p-4 text-sm"><h3 className="font-semibold">Related</h3><Link className="text-link underline-offset-4 hover:underline" to="/configuration/transfer-lanes">Transfer lanes</Link><Link className="text-link underline-offset-4 hover:underline" to="/configuration/intercompany">Intercompany pairing</Link><Link className="text-link underline-offset-4 hover:underline" to="/inventory/warehouses">Warehouses</Link></section>}
        />
      </StateFrame>
      <PlantDialog open={dlg === "edit"} plant={p} onClose={() => setDlg(null)} view={view} />
      <DialogShell open={dlg === "activate"} onOpenChange={(o) => !o && setDlg(null)} title={`Activate ${p.code}`} consequence={`Sends the activation to the Controller (WF-INBOX). On approval ${p.code} takes documents; steps ${p.steps.filter((x) => x.gate && !x.done).map((x) => x.n).join(", ") || "2 to 5"} must be verified first.`} confirmLabel="Send for approval" onConfirm={() => view.run(() => requestPlantState(p.id, "Active", ""))} />
      <DialogShell open={dlg === "deactivate"} onOpenChange={(o) => !o && setDlg(null)} title={`Deactivate ${p.code}`} consequence={`Sends the deactivation to the Controller. After approval ${p.code} takes no new documents; open documents continue and history stays readable.`} requireReason reasonLabel="Why it is deactivated (required)" destructive confirmLabel="Send for approval" onConfirm={(r) => view.run(() => requestPlantState(p.id, "Inactive", r))} />
      <DialogShell open={typeof dlg === "object" && !!dlg && "verify" in dlg} onOpenChange={(o) => !o && setDlg(null)} title={`Verify setup step ${typeof dlg === "object" && dlg && "verify" in dlg ? dlg.verify : ""}`} consequence="Records who verified the step and what was checked." confirmLabel="Mark verified" onConfirm={() => view.run(() => setSetupStep(p.id, (dlg as { verify: number }).verify, true, evidence))}>
        <Field id="vf-evidence" label="Evidence: what was checked"><Input id="vf-evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} /></Field>
      </DialogShell>
      <RulesPanel rules={[["§4-a", "IT admin drafts, the Controller approves", "DOC:p.282 §4"], ["§4-b", "Activate after steps 2 to 5 verify; Deactivate blocks new documents only", "DOC:p.282 §4"], ["C-55", "An inactive plant is read-only", "DOC:p.170"]]} />
    </div>
  )
}

function PlantDialog({ open, plant, onClose, view }: { open: boolean; plant?: PlantRecord; onClose: () => void; view: View }) {
  const s = useSlice("adminCfg")
  const [d, setD] = useState<PlantDraft | null>(null)
  const draft = d ?? (plant ? toDraft(plant) : blank(s.plants.length + 1))
  const set = (p: Partial<PlantDraft>) => setD({ ...draft, ...p })
  const num = (k: keyof PlantDraft) => (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: Number(e.target.value) } as Partial<PlantDraft>)
  return (
    <DialogShell
      wide
      open={open}
      onOpenChange={(o) => { if (!o) { setD(null); onClose() } }}
      title={plant ? `Edit draft ${plant.code}` : "New plant"}
      consequence="Saves a draft plant. It takes no documents until its setup steps 2 to 5 verify and the Controller approves the activation."
      confirmLabel="Save draft"
      onConfirm={() => view.run(() => savePlant(draft, plant?.id))}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="pl-code" label="Plant code" hint="Format not given yet (OQ-30): PL-TBD-nn"><Input id="pl-code" value={draft.code} disabled={!!plant} onChange={(e) => set({ code: e.target.value })} /></Field>
        <Field id="pl-name" label="Name"><Input id="pl-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field id="pl-ent" label="Owning legal entity"><SimpleSelect id="pl-ent" value={draft.entityId} onChange={(v) => set({ entityId: v })} options={LEGAL_ENTITIES.map((e) => ({ value: e.id, label: e.name }))} /></Field>
        <Field id="pl-addr" label="Address"><Input id="pl-addr" value={draft.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field id="pl-cal" label="Working calendar"><Input id="pl-cal" value={draft.calendar} onChange={(e) => set({ calendar: e.target.value })} /></Field>
        <Field id="pl-sp" label="Shipping point"><Input id="pl-sp" value={draft.shippingPoint} onChange={(e) => set({ shippingPoint: e.target.value })} /></Field>
        <Field id="pl-rw" label="Default receiving warehouse"><Input id="pl-rw" value={draft.receivingWarehouse} onChange={(e) => set({ receivingWarehouse: e.target.value })} /></Field>
        <Field id="pl-sw" label="Default shipping warehouse"><Input id="pl-sw" value={draft.shippingWarehouse} onChange={(e) => set({ shippingWarehouse: e.target.value })} /></Field>
        <Field id="pl-mrp" label="MRP area"><Input id="pl-mrp" value={draft.mrpArea} onChange={(e) => set({ mrpArea: e.target.value })} /></Field>
        <Field id="pl-lt" label="Lead-time offset (days)"><Input id="pl-lt" type="number" min={0} value={draft.leadTimeDays} onChange={num("leadTimeDays")} /></Field>
        <Field id="pl-ptf" label="Planning time fence (days)"><Input id="pl-ptf" type="number" min={0} value={draft.planningTimeFenceDays} onChange={num("planningTimeFenceDays")} /></Field>
        <Field id="pl-st" label="Safety time (days)"><Input id="pl-st" type="number" min={0} value={draft.safetyTimeDays} onChange={num("safetyTimeDays")} /></Field>
      </div>
    </DialogShell>
  )
}
void DataTable
