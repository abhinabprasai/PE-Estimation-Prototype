// FX-CFG-MATERIAL Material settings [DOC:pp.137-139 Book II §2.2, §2.4; Book II §15.2]: the three-level material group
// hierarchy (Materials Manager approval; effective-dated; nodes deactivate, never delete), characteristic classes
// (typed key-value attributes per material group, search and print data in Phase 1), serial profiles SN-FIN / SN-COMP /
// SN-SEMI / SN-NONE (configuration rows; a material references a profile, changing it follows V-MM-03 immutability),
// and the type behavior matrix (configuration seed data, not code).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, EmptyState, KV, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { MATERIALS, TODAY } from "@/data/shared"
import { addDays, fmtDate } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { addCharClass, proposeDeactivate, proposeGroupNode, proposeMatrixCell } from "../data/cfg-actions"
import type { CharacteristicClass, MatGroup, SerialProfile, TypeBehaviour } from "../data/cfg-types"
import { can, requestState } from "../lib/cfg"
import { Field, SimpleSelect, StateText } from "../components/common"
import { StateFrame, StatePicker, useView, type View } from "../components/states"

const TYPES = ["RAW", "SEMI", "FIN", "TRADE", "PACK", "SPARE", "CONS", "SERV", "NSTK"]
type NodeState = "Active" | "Scheduled" | "Pending approval" | "Rejected" | "Deactivation pending" | "Deactivates" | "Inactive"
const noRecords = (st: string) => st === "Draft" || st === "Data Completion"

export function MaterialSettings() {
  const [params, setParams] = useSearchParams()
  const section = params.get("section") ?? "groups"
  const s = useSlice("adminCfg")
  const a = useSlice("admin")
  const { role } = useCore()
  const view = useView("FX-CFG-MATERIAL")
  const [node, setNode] = useState<null | "add">(null)
  const [off, setOff] = useState<MatGroup | null>(null)
  const [char, setChar] = useState(false)
  const [cell, setCell] = useState<null | { behaviour: string; type: string }>(null)

  const nodeState = (n: MatGroup): NodeState => {
    const own = requestState(n.requestId, n.validFrom, a.instances)
    if (own === "Pending approval") return "Pending approval"
    if (own === "Rejected") return "Rejected"
    if (n.deactivateRequestId) {
      const d = requestState(n.deactivateRequestId, n.deactivatedFrom ?? TODAY, a.instances)
      if (d === "Pending approval") return "Deactivation pending"
      if (d === "Active") return "Inactive"
      if (d === "Scheduled") return "Deactivates"
    } else if (n.deactivatedFrom) return n.deactivatedFrom <= TODAY ? "Inactive" : "Deactivates"
    return own === "Scheduled" ? "Scheduled" : "Active"
  }
  const flat = (() => {
    const out: MatGroup[] = []
    const walk = (parent?: string) => { for (const g of s.matGroups.filter((x) => x.parentId === parent)) { out.push(g); walk(g.id) } }
    walk(undefined)
    return out.filter((g) => nodeState(g) !== "Rejected")
  })()
  const cellValue = (r: TypeBehaviour, t: string) => {
    const done = [...(r.pending ?? [])].reverse().find((p) => p.type === t && requestState(p.requestId, TODAY, a.instances) === "Active")
    return done?.value ?? r.cells[t]
  }
  const cellPending = (r: TypeBehaviour, t: string) => (r.pending ?? []).find((p) => p.type === t && requestState(p.requestId, TODAY, a.instances) === "Pending approval")
  const l1 = s.matGroups.filter((g) => g.level === 1)

  return (
    <ConfigPage
      header={{
        title: "Material settings",
        screenId: "FX-CFG-MATERIAL",
        description: "How the material master is organised and how each material type behaves: the group hierarchy, characteristic classes, serial profiles and the type behavior matrix.",
        chips: <Chip kind="design" note="Route /configuration/material-settings is a design value; the content is Book II §2.2, §2.4, §15.2">Design route</Chip>,
        actions: <StatePicker view={view} />,
        primary: section === "groups" ? <Button onClick={() => setNode("add")} disabled={!can.material(role) || !!view.writeError()} title={can.material(role) ? undefined : "Materials Manager or Material steward"}>Add group node</Button> : section === "characteristics" ? <Button onClick={() => setChar(true)} disabled={!can.material(role) || !!view.writeError()} title={can.material(role) ? undefined : "Materials Manager or Material steward"}>Add characteristic</Button> : undefined,
      }}
      sections={[{ id: "groups", label: `Material groups (${s.matGroups.length})` }, { id: "characteristics", label: `Characteristic classes (${s.charClasses.length})` }, { id: "serial", label: "Serial profiles" }, { id: "matrix", label: "Type behavior matrix" }]}
      section={section}
      onSectionChange={(id) => setParams({ section: id })}
      effectiveDated
    >
      <StateFrame view={view} cols={6} emptyTitle="No material settings." emptyBody="The hierarchy and matrix ship with the specification; Scenario reset restores them." degraded="Degraded: material search is rebuilding its index. Settings here are unaffected.">
        {section === "groups" && (
          <div className="flex flex-col gap-2">
            <DataTable<MatGroup>
              rows={view.empty ? [] : flat}
              rowId={(g) => g.id}
              loading={view.loading}
              densityKey="FX-CFG-MATERIAL-groups"
              caption="Material group hierarchy"
              searchText={(g) => `${g.code} ${g.name}`}
              searchPlaceholder="Search groups"
              columns={[
                { id: "code", header: "Code", value: (g) => g.code, mono: true, cell: (g) => <span style={{ paddingLeft: (g.level - 1) * 20 }} className={g.level === 1 ? "font-semibold" : undefined}>{g.code}</span> },
                { id: "name", header: "Name", value: (g) => g.name, cell: (g) => <span className={nodeState(g) === "Inactive" ? "text-muted-foreground line-through" : undefined}>{g.name}</span> },
                { id: "lvl", header: "Level", value: (g) => g.level, align: "right", mono: true, filterable: true },
                { id: "from", header: "Valid from", value: (g) => g.validFrom, cell: (g) => fmtDate(g.validFrom) },
                { id: "st", header: "State", value: (g) => nodeState(g), filterable: true, cell: (g) => { const st = nodeState(g); return <span className="text-xs"><StateText tone={["Pending approval", "Deactivation pending", "Deactivates"].includes(st) ? "attention" : st === "Inactive" ? "muted" : "default"}>{st === "Deactivates" ? `Deactivates ${fmtDate(g.deactivatedFrom)}` : st}</StateText>{(g.requestId || g.deactivateRequestId) && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${g.deactivateRequestId ?? g.requestId}`}>{g.deactivateRequestId ?? g.requestId}</Link></>}</span> } },
                { id: "chr", header: "Characteristics", value: (g) => (g.level === 1 ? s.charClasses.filter((c) => c.groupId === g.id).length : ""), align: "right", mono: true },
                { id: "act", header: "", cell: (g) => <Button size="sm" variant="outline" disabled={!can.material(role) || !["Active", "Scheduled"].includes(nodeState(g))} onClick={() => setOff(g)}>Deactivate</Button> },
              ]}
            />
            <p className="max-w-3xl text-xs text-muted-foreground">The hierarchy serves search, reporting, approval routing, material overhead rates and default valuation class, buyer and inspection plans. The {"{GROUP}"} token of a material number is the level 1 code, fixed at creation.</p>
          </div>
        )}
        {section === "characteristics" && (
          <div className="flex flex-col gap-2">
            <DataTable<CharacteristicClass>
              rows={view.empty ? [] : s.charClasses}
              rowId={(c) => c.id}
              loading={view.loading}
              densityKey="FX-CFG-MATERIAL-char"
              caption="Characteristic classes"
              columns={[
                { id: "g", header: "Material group", value: (c) => l1.find((g) => g.id === c.groupId)?.code ?? "", filterable: true, cell: (c) => { const g = l1.find((x) => x.id === c.groupId); return <span><span className="font-mono">{g?.code}</span> {g?.name}</span> } },
                { id: "k", header: "Characteristic", value: (c) => c.key, sortable: true },
                { id: "t", header: "Type", value: (c) => c.type, filterable: true },
                { id: "u", header: "Unit or values", value: (c) => c.unit ?? c.values ?? "" },
                { id: "s", header: "Search", value: (c) => (c.searchable ? "Yes" : "No") },
                { id: "p", header: "Print", value: (c) => (c.printable ? "Yes" : "No") },
              ]}
            />
            <p className="max-w-3xl text-xs text-muted-foreground">Characteristics are search and print data only in Phase 1. They become configuration-model inputs in the product-configuration phase flagged by the review (F-02), so none of them gates a transaction.</p>
          </div>
        )}
        {section === "serial" && <Serial rows={view.empty ? [] : s.serialProfiles} view={view} />}
        {section === "matrix" && (
          <div className="flex flex-col gap-2">
            <DataTable<TypeBehaviour>
              rows={view.empty ? [] : s.typeMatrix}
              rowId={(r) => r.behaviour}
              loading={view.loading}
              densityKey="FX-CFG-MATERIAL-matrix"
              caption="Type behavior matrix"
              columns={[
                { id: "b", header: "Behavior", value: (r) => r.behaviour },
                ...TYPES.map((t) => ({
                  id: t, header: t, value: (r: TypeBehaviour) => cellValue(r, t), align: "center" as const, filterable: false,
                  cell: (r: TypeBehaviour) => {
                    const p = cellPending(r, t)
                    return (
                      <button className="min-h-6 rounded px-1 text-xs hover:bg-muted" disabled={!can.material(role) || !!view.writeError() || !!p} title={p ? `${p.requestId} waits for the Materials Manager` : can.material(role) ? "Propose a change" : "Materials Manager or Material steward"} onClick={() => setCell({ behaviour: r.behaviour, type: t })}>
                        {cellValue(r, t)}{p && <span className="block text-status-pending-ink">→ {p.value}</span>}
                      </button>
                    )
                  },
                })),
              ]}
            />
            <p className="max-w-3xl text-xs text-muted-foreground">This matrix is configuration seed data, not code. Each cell is enforced by the Material Master save validations and by document entry. "Exception" for purchasable SEMI/FIN covers buy-complete cases and needs the Special Procurement key on the Planning view. A cell change goes to the Materials Manager (AR-38).</p>
          </div>
        )}
        {section === "matrix" && s.typeMatrix.length === 0 && <EmptyState title="No matrix." />}
      </StateFrame>
      <RulesPanel
        rules={[
          ["§2.4-a", "Material groups are a three-level hierarchy, maintained under Material Settings; Materials Manager approval; effective-dated; nodes deactivate, never delete", "DOC:p.139 §2.4"],
          ["§2.4-b", "A free characteristic panel of typed key-value attributes per material group supports parametric search; search and print data in Phase 1", "DOC:p.139 §2.4"],
          ["§15.2", "Profiles are configuration rows (profile, serial timing, format, warranty relevance, install-link allowed); documents read the profile, never per-material bespoke logic; changing a material's profile follows V-MM-03 immutability once records exist", "DOC:p.164 §15.2"],
          ["§2.2", "The matrix is configuration seed data, not code; a PO line for a SERV material can never create stock", "DOC:p.138 §2.2"],
        ]}
      />
      <NodeDialog open={node === "add"} onClose={() => setNode(null)} view={view} />
      <DialogShell open={!!off} onOpenChange={(o) => !o && setOff(null)} title={`Deactivate ${off?.code ?? ""} ${off?.name ?? ""}`} consequence="Sends the deactivation to the Materials Manager. After the effective date no new material can use this node; existing materials keep it and the node is never deleted." requireReason reasonLabel="Why it is deactivated (required)" confirmLabel="Send for approval" onConfirm={(note) => view.run(() => proposeDeactivate(off!.id, addDays(TODAY, 23), note))} />
      <CharDialog open={char} onClose={() => setChar(false)} view={view} />
      <CellDialog cell={cell} onClose={() => setCell(null)} view={view} />
    </ConfigPage>
  )
}

function Serial({ rows, view }: { rows: SerialProfile[]; view: View }) {
  const [matId, setMatId] = useState("")
  const [target, setTarget] = useState("")
  const m = MATERIALS.find((x) => x.id === matId)
  const cur = m?.serialProfileId
  const verdict = m && target ? (noRecords(m.status) || (cur?.replace("SP-", "SN-") ?? "SN-NONE") === target ? null : `Blocked (V-MM-03): ${m.id} is ${m.status} and has records, so its profile is immutable. Supersede the material (§4.6) instead.`) : undefined
  return (
    <div className="flex flex-col gap-4">
      <DataTable<SerialProfile>
        rows={rows}
        rowId={(p) => p.id}
        loading={view.loading}
        densityKey="FX-CFG-MATERIAL-serial"
        caption="Serial profiles"
        columns={[
          { id: "id", header: "Profile", value: (p) => p.id, mono: true },
          { id: "a", header: "Applies to", value: (p) => p.appliesTo, className: "max-w-[260px]" },
          { id: "t", header: "Serial timing", value: (p) => p.timing, className: "max-w-[260px]" },
          { id: "f", header: "Format", value: (p) => p.format, mono: true },
          { id: "w", header: "Warranty relevant", value: (p) => (p.warrantyRelevant ? "Yes" : "No"), filterable: true },
          { id: "i", header: "Install links (SP-12)", value: (p) => (p.installLinks ? "Allowed" : "No") },
          { id: "n", header: "Materials", value: (p) => MATERIALS.filter((x) => (x.serialProfileId ?? "SP-NONE") === p.legacyId).length, align: "right", mono: true },
        ]}
      />
      <section aria-label="Profile change check" className="flex max-w-3xl flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Can this material change profile?</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="sp-mat" label="Material"><SimpleSelect id="sp-mat" value={matId} onChange={setMatId} options={MATERIALS.filter((x) => x.type !== "SERV" && x.type !== "NSTK").map((x) => ({ value: x.id, label: `${x.id} · ${x.status}` }))} placeholder="Pick a material" /></Field>
          <Field id="sp-target" label="New profile"><SimpleSelect id="sp-target" value={target} onChange={setTarget} options={rows.map((p) => ({ value: p.id, label: p.id }))} placeholder="Pick a profile" /></Field>
        </div>
        {m && target && (verdict === null ? <p role="status" className="text-sm">{m.id} may take {target}: it has no records yet ({m.status}), or it already has this profile.</p> : <p role="alert" className="text-sm text-destructive">{verdict}</p>)}
        <p className="text-xs text-muted-foreground">Profile ids in the shared material master read SP-FIN, SP-COMP, SP-SEMI; the specification names them SN-FIN, SN-COMP, SN-SEMI (reading AR-43).</p>
      </section>
    </div>
  )
}

function NodeDialog({ open, onClose, view }: { open: boolean; onClose: () => void; view: View }) {
  const s = useSlice("adminCfg")
  const [level, setLevel] = useState<"2" | "3">("2")
  const [parent, setParent] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [from, setFrom] = useState(addDays(TODAY, 23))
  const parents = s.matGroups.filter((g) => g.level === Number(level) - 1 && !g.deactivatedFrom)
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => { if (!o) { setParent(""); setCode(""); setName(""); onClose() } }}
      title="Add a group node"
      description="Level 1 groups are fixed because the {GROUP} token in material numbers cannot change; add level 2 and 3 nodes."
      consequence={`Adds the node effective ${from} and sends it to the Materials Manager in WF-INBOX. Until approved it cannot be assigned.`}
      requireReason
      reasonLabel="Why it is added (required)"
      confirmLabel="Send for approval"
      onConfirm={(note) => view.run(() => proposeGroupNode({ level: Number(level) as 2 | 3, parentId: parent, code, name, from, note }))}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="gn-level" label="Level"><SimpleSelect id="gn-level" value={level} onChange={(v) => { setLevel(v as "2" | "3"); setParent("") }} options={[{ value: "2", label: "Level 2" }, { value: "3", label: "Level 3" }]} /></Field>
        <Field id="gn-parent" label="Parent node"><SimpleSelect id="gn-parent" value={parent} onChange={setParent} options={parents.map((g) => ({ value: g.id, label: `${g.code} ${g.name}` }))} placeholder="Pick the parent" /></Field>
        <Field id="gn-code" label="Code"><Input id="gn-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field id="gn-name" label="Name"><Input id="gn-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field id="gn-from" label="Effective from"><Input id="gn-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      </div>
    </DialogShell>
  )
}

function CharDialog({ open, onClose, view }: { open: boolean; onClose: () => void; view: View }) {
  const s = useSlice("adminCfg")
  const [groupId, setGroupId] = useState("")
  const [key, setKey] = useState("")
  const [type, setType] = useState<"Number" | "Text" | "List">("Number")
  const [unit, setUnit] = useState("")
  const [values, setValues] = useState("")
  const [searchable, setSearchable] = useState(true)
  const [printable, setPrintable] = useState(false)
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => { if (!o) { setKey(""); setUnit(""); setValues(""); onClose() } }}
      title="Add a characteristic"
      consequence="Adds a typed attribute to every material in the group for parametric search and printing. It does not gate any transaction in Phase 1."
      confirmLabel="Add characteristic"
      onConfirm={() => view.run(() => addCharClass({ groupId, key, type, unit, values, searchable, printable }))}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="ch-group" label="Level 1 material group"><SimpleSelect id="ch-group" value={groupId} onChange={setGroupId} options={s.matGroups.filter((g) => g.level === 1).map((g) => ({ value: g.id, label: `${g.code} ${g.name}` }))} placeholder="Pick a group" /></Field>
        <Field id="ch-key" label="Characteristic"><Input id="ch-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Voltage class" /></Field>
        <Field id="ch-type" label="Type"><SimpleSelect id="ch-type" value={type} onChange={(v) => setType(v as typeof type)} options={["Number", "Text", "List"].map((x) => ({ value: x, label: x }))} /></Field>
        {type === "Number" && <Field id="ch-unit" label="Unit"><Input id="ch-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kV" /></Field>}
        {type === "List" && <Field id="ch-vals" label="Values" hint="Comma separated, at least two"><Input id="ch-vals" value={values} onChange={(e) => setValues(e.target.value)} /></Field>}
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={searchable} onCheckedChange={(c) => setSearchable(c === true)} /> Searchable</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={printable} onCheckedChange={(c) => setPrintable(c === true)} /> Printed on documents</label>
      </div>
    </DialogShell>
  )
}

function CellDialog({ cell, onClose, view }: { cell: null | { behaviour: string; type: string }; onClose: () => void; view: View }) {
  const s = useSlice("adminCfg")
  const row = s.typeMatrix.find((r) => r.behaviour === cell?.behaviour)
  const [value, setValue] = useState("")
  const vocab = row ? [...new Set(Object.values(row.cells))] : []
  return (
    <DialogShell
      open={!!cell}
      onOpenChange={(o) => { if (!o) { setValue(""); onClose() } }}
      title={`Propose change: ${cell?.behaviour ?? ""} for ${cell?.type ?? ""}`}
      consequence={`Sends the change to the Materials Manager in WF-INBOX. Material master validations and document entry read the new value once it is approved. Today: ${row && cell ? row.cells[cell.type] : ""}.`}
      requireReason
      reasonLabel="Why it changes (required)"
      confirmLabel="Send for approval"
      onConfirm={(note) => view.run(() => proposeMatrixCell(cell!.behaviour, cell!.type, value, note))}
    >
      <Field id="mx-val" label="New value"><SimpleSelect id="mx-val" value={value} onChange={setValue} options={vocab.map((v) => ({ value: v, label: v }))} placeholder="Pick a value" /></Field>
      <KV k="Other types in this row">{row && Object.entries(row.cells).map(([t, v]) => `${t} ${v}`).join(" · ")}</KV>
    </DialogShell>
  )
}
