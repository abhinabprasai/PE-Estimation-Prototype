// Material dialogs (FX-MM-DIALOGS) and lifecycle / impact-sweep dialogs (FX-MM-LIFECYCLE), Book II
// §3.14, §4.1, §4.4-4.5. Each is a DialogShell: it names the object and the consequence, asks for a
// reason where the PRD requires one, and has one primary. They are opened from Material Detail and
// the material list, and shown in every state on /inventory/dialogs/material and /lifecycle.

import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { Check, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import type { MaterialBlock, MaterialStatus } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { cn } from "@/lib/utils"
import { useRole, useSlice } from "@/store"
import { BLOCK_SETTER, similarity, DUPLICATE_THRESHOLD } from "../lib/rules"
import { getMaterial, onHand, R } from "../data/state"
import { endMaterial, removeBlock, setBlock, setLifecycle, whereUsedSweep } from "../data/actions"
import { COPY_GROUPS, copyFrom, extendToPlant, recallToDraft } from "../data/ext-actions"
import { MatLink, MaterialStatus as MaterialStatusBadge, Reading, TypeBadge } from "./common"
import { confirmRun } from "./run"

/** What a dialog is told about the screen state it is previewed in (see states.tsx). */
export interface DialogSim {
  offline?: boolean
  degraded?: boolean
  conflict?: boolean
  readOnly?: boolean
  /** Role gate shown as authorization failure (the action itself also checks the role). */
  unauthorized?: boolean
}
const simBlock = (sim?: DialogSim, needsSweep = false) =>
  sim?.offline ? "Offline: reconnect to commit (master-data changes are not queued)."
  : sim?.conflict ? "Conflict: another user changed this record; reload before committing."
  : sim?.unauthorized ? "Not authorised for your role: switch Acting as."
  : sim?.readOnly ? "Read-only: the record is in a terminal status."
  : needsSweep && sim?.degraded ? "Degraded: the where-used sweep is incomplete (purchasing did not answer). This action needs a complete sweep."
  : undefined

// ============================================================================ impact panel (§4.4 reference-data protection)
export function ImpactPanel({ id, forObsolete = false, title = "Impact: where used", degraded = false }: { id: string; forObsolete?: boolean; title?: string; degraded?: boolean }) {
  const s = useSlice("materials")
  const hits = useMemo(() => whereUsedSweep(s, id, TODAY), [s, id])
  const blocking = hits.filter((h) => h.open)
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-lg border p-3">
      <h3 className="flex items-center justify-between text-sm font-semibold">
        <span>
          {title} ({hits.length})
        </span>
        {forObsolete && <Chip kind="oq" id="V-MM-20" note="Obsolete needs zero stock and an empty where-used sweep" />}
      </h3>
      {degraded && <p className="text-xs text-destructive">Partial result: open purchase orders were not checked (service degraded).</p>}
      {hits.length ? (
        <ul className="max-h-48 overflow-y-auto text-sm">
          {hits.map((h, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-1">
              <span>{h.kind}</span> <span className="font-mono">{h.ref}</span>
              {h.note && <span className="text-muted-foreground">· {h.note}</span>}
              {forObsolete && h.open && <span className="text-destructive">· blocks Obsolete</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No references found.</p>
      )}
      {forObsolete && (
        <p className="text-xs text-muted-foreground">
          {blocking.length === 0 ? "The sweep is empty: Obsolete may proceed." : `${blocking.length} open reference(s) must be closed first. `}
          <Reading id="RD-MM-38" />
        </p>
      )}
    </section>
  )
}

// ============================================================================ lifecycle dialogs (§4.1)
export type LifecycleKind = "restrict" | "reinstate" | "obsolete" | "delete" | "recall"
export const LIFECYCLE_DIALOGS: Record<LifecycleKind, { label: string; from: MaterialStatus[]; to?: MaterialStatus; verb: string; role: string; destructive: boolean; needsSweep: boolean }> = {
  restrict: { label: "Restrict", from: ["Active", "Blocked"], to: "Restricted", verb: "Restrict", role: "Materials Manager", destructive: false, needsSweep: false },
  reinstate: { label: "Reinstate", from: ["Restricted", "Blocked"], to: "Active", verb: "Reinstate", role: "Materials Manager", destructive: false, needsSweep: false },
  obsolete: { label: "Mark Obsolete", from: ["Active", "Restricted", "Blocked"], to: "Obsolete", verb: "Mark Obsolete", role: "Materials Manager", destructive: true, needsSweep: true },
  delete: { label: "Delete Draft", from: ["Draft"], verb: "Delete draft", role: "Materials Manager", destructive: true, needsSweep: true },
  recall: { label: "Recall to Draft", from: ["Data Completion"], to: "Draft", verb: "Recall to Draft", role: "Materials Manager", destructive: false, needsSweep: false },
}
/** Why a lifecycle dialog cannot be used on this material right now. */
export function lifecycleBlocker(kind: LifecycleKind, status: MaterialStatus) {
  const c = LIFECYCLE_DIALOGS[kind]
  return c.from.includes(status) ? undefined : `${c.label} starts from ${c.from.join(" or ")}; this material is ${status}.`
}

export function LifecycleDialog({ kind, materialId, open, onOpenChange, sim }: { kind: LifecycleKind; materialId: string; open: boolean; onOpenChange: (o: boolean) => void; sim?: DialogSim }) {
  const s = useSlice("materials")
  const [role] = useRole()
  const c = LIFECYCLE_DIALOGS[kind]
  const m = getMaterial(s, materialId)
  const sweep = useMemo(() => whereUsedSweep(s, materialId, TODAY), [s, materialId])
  if (!m) return null
  const qty = onHand(s, materialId)
  const openRefs = sweep.filter((h) => h.open && h.kind !== "Stock")
  const wrongStatus = lifecycleBlocker(kind, m.status)
  const refsForDelete = sweep.length
  const gate =
    simBlock(sim, c.needsSweep) ??
    wrongStatus ??
    (role !== c.role ? `${c.label} is pressed by the ${c.role}; you are acting as ${role}.` : undefined) ??
    (kind === "obsolete" && qty > 0 ? `V-MM-20: stock must be zero first (${qty} ${m.baseUom} on hand).` : undefined) ??
    (kind === "obsolete" && openRefs.length ? `V-MM-20: ${openRefs.length} open reference(s) in the where-used sweep.` : undefined) ??
    (kind === "delete" && refsForDelete ? `Physical delete needs zero references; ${refsForDelete} found.` : undefined)
  const consequence: Record<LifecycleKind, string> = {
    restrict: `${m.id} becomes Restricted: existing stock stays consumable and open documents finish, but NEW demand is blocked (no new BOM lines, no new PO, SO or WO except closure of existing).`,
    reinstate: `${m.id} returns to Active (Materials Manager). New demand is allowed again; blocks set on it stay until removed.`,
    obsolete: `${m.id} becomes Obsolete: terminal, read-only, kept for traceability. It cannot be reversed here; stock must be zero and every document closed (V-MM-20).`,
    delete: `${m.id} is physically deleted. Draft is the only status where this is allowed, and only with zero references (§4.1). The change history keeps a line.`,
    recall: `${m.id} goes back from Data Completion to Draft: its creation request returns to Draft, the department tasks are reset and the SLA clocks stop.`,
  }
  const run = (reason: string) => {
    if (gate) return gate
    if (kind === "delete") return confirmRun(endMaterial(m.id, "Deleted", reason), `${m.id} deleted`)
    if (kind === "recall") return confirmRun(recallToDraft(m.id, reason), `${m.id} recalled to Draft`)
    return confirmRun(setLifecycle(m.id, c.to!, reason), `${m.id} is now ${c.to}`)
  }
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`${c.label}: ${m.id}`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          {m.description} <MaterialStatusBadge m={m} />
        </span>
      }
      consequence={consequence[kind]}
      requireReason
      reasonLabel={kind === "obsolete" ? "Reason code and note (required)" : "Reason (required)"}
      confirmLabel={c.verb}
      destructive={c.destructive}
      confirmDisabled={!!gate}
      onConfirm={run}
    >
      {gate && (
        <p role="status" className={cn("rounded-md border px-3 py-2 text-sm", "border-status-blocked")}>
          {gate}
        </p>
      )}
      {kind === "obsolete" && (
        <ul className="flex flex-col gap-1 rounded-lg border p-3 text-sm" aria-label="V-MM-20 checks">
          <li className="flex items-center gap-2">
            {qty === 0 ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4 text-destructive" aria-hidden="true" />} Stock is zero ({qty} {m.baseUom} on hand)
          </li>
          <li className="flex items-center gap-2">
            {openRefs.length === 0 ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4 text-destructive" aria-hidden="true" />} Where-used sweep is empty ({openRefs.length} open)
          </li>
          {(qty > 0 || openRefs.length > 0) && (
            <li className="text-xs text-muted-foreground">
              Replace it instead: <Link to={`/materials/supersessions?new=${m.id}`} className="text-link underline">start a supersession</Link>, which restricts it and runs the stock out.
            </li>
          )}
        </ul>
      )}
      <ImpactPanel id={m.id} forObsolete={kind === "obsolete"} title={kind === "delete" ? "References (must be zero)" : "Impact: where used"} degraded={sim?.degraded && c.needsSweep} />
    </DialogShell>
  )
}

// ============================================================================ function-specific block (§4.5)
export function FunctionBlockDialog({ materialId, open, onOpenChange, sim }: { materialId: string; open: boolean; onOpenChange: (o: boolean) => void; sim?: DialogSim }) {
  const s = useSlice("materials")
  const [role] = useRole()
  const m = getMaterial(s, materialId)
  const [block, setBlk] = useState<MaterialBlock>("Purchasing Block")
  if (!m) return null
  const setter = BLOCK_SETTER[block]
  const gate =
    simBlock(sim) ?? (m.status !== "Active" && m.status !== "Restricted" ? `Blocks apply to Active or Restricted materials (§4.5); this one is ${m.status}.` : undefined) ?? (role !== setter.role ? `${block} is set by the ${setter.role}; you are acting as ${role}.` : undefined)
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`Set block: ${m.id}`}
      description="Blocks are additive chips with a reason code, set-by and date; each blocks one document family, not the whole record (§4.5)."
      consequence={`${block} stops: ${setter.blocks}. Set by the ${setter.role}.`}
      requireReason
      reasonLabel="Reason code and note (required)"
      confirmLabel="Set block"
      confirmDisabled={!!gate}
      onConfirm={(reason) => (gate ? gate : confirmRun(setBlock(m.id, block, reason), `${block} set on ${m.id}`))}
    >
      {m.blocks.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Blocks now set">
          {m.blocks.map((b) => (
            <li key={b.block} className="flex flex-wrap items-center gap-2">
              <Chip kind="block">{b.block}</Chip> {b.reason} <span className="text-xs text-muted-foreground">set {b.on}</span>
              <Button size="sm" variant="ghost" className="ml-auto" disabled={!!simBlock(sim)} onClick={() => confirmRun(removeBlock(m.id, b.block), `${b.block} removed`)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No block is set on this material.</p>
      )}
      <Label htmlFor="fb-block">Block to set</Label>
      <Select value={block} onValueChange={(x) => setBlk(x as MaterialBlock)}>
        <SelectTrigger id="fb-block">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(BLOCK_SETTER) as MaterialBlock[]).map((b) => (
            <SelectItem key={b} value={b} disabled={m.blocks.some((x) => x.block === b)}>
              {b} (set by {BLOCK_SETTER[b].role})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {gate && (
        <p role="status" className="rounded-md border border-status-blocked px-3 py-2 text-sm">
          {gate}
        </p>
      )}
      <ImpactPanel id={m.id} />
    </DialogShell>
  )
}

// ============================================================================ extend to plant (§3.3, §3.14)
export function ExtendToPlantDialog({ materialId, open, onOpenChange, sim }: { materialId: string; open: boolean; onOpenChange: (o: boolean) => void; sim?: DialogSim }) {
  const s = useSlice("materials")
  const m = getMaterial(s, materialId)
  const plants = s.x.plantSrc.plants.filter((p) => p.id !== "PL-TBD-01")
  const [plant, setPlant] = useState("PL-TBD-02")
  const [planning, setPlanning] = useState(true)
  const [purchasing, setPurchasing] = useState(true)
  if (!m) return null
  const done: string[] = s.plantData.filter((p) => p.materialId === m.id).map((p) => p.plantId)
  const gate =
    simBlock(sim) ??
    (!s.x.plantSrc.dec07 ? "Multi-plant is not enabled (DEC-07 has not fired): one plant at go-live (§3.3)." : undefined) ??
    (m.status !== "Active" ? `Extend to Plant needs an Active material; this one is ${m.status}.` : undefined) ??
    (done.includes(plant) ? `${m.id} is already extended to ${plant}.` : undefined)
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`Extend to plant: ${m.id}`}
      description="Copies plant-level defaults and starts a data-completion workflow for the new plant (§3.14). Global data, stock and history are never copied."
      consequence={`${m.id} gets plant data at ${plant} in Data Completion; the plant's planner, buyer and warehouse tasks complete the views before it can be used there.`}
      confirmLabel="Extend to plant"
      confirmDisabled={!!gate}
      onConfirm={() => (gate ? gate : confirmRun(extendToPlant(m.id, plant, { planning, purchasing }), `${m.id} extended to ${plant}`))}
    >
      <Label htmlFor="ep-plant">Target plant</Label>
      <Select value={plant} onValueChange={setPlant}>
        <SelectTrigger id="ep-plant">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {plants.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.id} {p.name} ({p.status})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Plant defaults to copy</legend>
        <label className="flex items-center gap-2">
          <Checkbox checked={planning} onCheckedChange={(x) => setPlanning(!!x)} /> Planning: MRP type {s.plantData.find((p) => p.materialId === m.id)?.mrpType ?? "None"}, procurement {s.plantData.find((p) => p.materialId === m.id)?.procurement ?? "Buy"}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={purchasing} onCheckedChange={(x) => setPurchasing(!!x)} /> Purchasing: planned delivery time {s.plantData.find((p) => p.materialId === m.id)?.leadTimeDays ?? 0} days
        </label>
      </fieldset>
      {done.length > 0 && <p className="text-xs text-muted-foreground">Already at: {done.join(", ")}</p>}
      {gate && (
        <p role="status" className="rounded-md border border-status-blocked px-3 py-2 text-sm">
          {gate} {!s.x.plantSrc.dec07 && <Link to="/materials/plant-sourcing" className="text-link underline">Open plant sourcing</Link>}
        </p>
      )}
      <Reading id="RD-MM-35" />
    </DialogShell>
  )
}

// ============================================================================ copy from (§3.14)
export function CopyFromDialog({ materialId, open, onOpenChange, sim }: { materialId: string; open: boolean; onOpenChange: (o: boolean) => void; sim?: DialogSim }) {
  const s = useSlice("materials")
  const nav = useNavigate()
  const m = getMaterial(s, materialId)
  const v = s.views[materialId]
  const [desc, setDesc] = useState(`${m?.description ?? ""} (copy)`)
  const [groups, setGroups] = useState<string[]>(["general", "planning", "purchasing", "warehouse", "quality"])
  const [note, setNote] = useState("")
  const [prev, setPrev] = useState(materialId)
  if (prev !== materialId) {
    setPrev(materialId)
    setDesc(`${m?.description ?? ""} (copy)`)
  }
  if (!m || !v) return null
  const score = similarity(desc, m.description)
  const dup = score >= DUPLICATE_THRESHOLD
  const gate = simBlock(sim)
  const toggle = (id: string) => setGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`Copy from ${m.id}`}
      description="Create mode: a deep copy of this material as a template, minus stock and history. Only the field groups you check are copied (§3.14)."
      consequence="Creates a new material creation request and a Draft material with the checked groups copied. The number is new; steward, buyer and planner are not copied; the department tasks still run."
      confirmLabel="Create request"
      confirmDisabled={!!gate}
      onConfirm={() => {
        if (gate) return gate
        const made = copyFrom(
          m.id,
          { type: m.type, description: desc, groupL1: v.groupPath[0] ?? "", groupL2: v.groupPath[1] ?? "", uom: m.baseUom, path: "Purchasing Initiated", duplicateNote: dup ? note : undefined },
          groups,
        )
        if (!made.ok) return made.error
        const id = made.value.mcrId
        setTimeout(() => nav(R.mcr(id)), 0)
        return confirmRun(made, `${id} created with ${made.value.copied} field(s) copied`)
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="cf-desc">Short description of the new material</Label>
        <Input id="cf-desc" value={desc} onChange={(e) => setDesc(e.target.value)} aria-invalid={dup && !note.trim()} />
        <p className="text-xs text-muted-foreground">
          Similarity to {m.id}: {score.toFixed(2)} {dup ? "(at or above 0.9: side-by-side compare and a note are required, §4.4)" : "(below the 0.9 duplicate threshold)"}
        </p>
      </div>
      {dup && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="cf-note">Not a duplicate because (required)</Label>
          <Textarea id="cf-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}
      <fieldset className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
        <legend className="px-1 font-medium">Field groups to copy</legend>
        {COPY_GROUPS.map((g) => (
          <label key={g.id} className="flex items-start gap-2">
            <Checkbox className="mt-0.5" checked={groups.includes(g.id)} onCheckedChange={() => toggle(g.id)} />
            <span>
              {g.label} <span className="block text-xs text-muted-foreground">{g.note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted-foreground">Never copied: stock, change history, info records, source lists, price rows, serial and batch history, manufacturer parts. The material type is kept ({m.type}, immutable).</p>
      {gate && (
        <p role="status" className="rounded-md border border-status-blocked px-3 py-2 text-sm">
          {gate}
        </p>
      )}
    </DialogShell>
  )
}

// ============================================================================ duplicate compare (§4.4)
const COMPARE_ROWS: { label: string; get: (s: ReturnType<typeof useSlice<"materials">>, id: string) => string }[] = [
  { label: "Type", get: (s, id) => getMaterial(s, id)?.type ?? "" },
  { label: "Description", get: (s, id) => getMaterial(s, id)?.description ?? "" },
  { label: "Group", get: (s, id) => s.views[id]?.groupPath.join(" / ") ?? "" },
  { label: "Base UoM", get: (s, id) => getMaterial(s, id)?.baseUom ?? "" },
  { label: "Manufacturer part", get: (s, id) => s.views[id]?.mfrParts.map((p) => `${p.manufacturer} ${p.mpn}`).join("; ") ?? "" },
  { label: "Characteristics", get: (s, id) => s.views[id]?.characteristics.map((c) => `${c.key} ${c.value}`).join("; ") ?? "" },
  { label: "Lifecycle", get: (s, id) => getMaterial(s, id)?.status ?? "" },
  { label: "On hand", get: (s, id) => String(onHand(s, id)) },
  { label: "Info records", get: (s, id) => String(s.infoRecords.filter((x) => x.materialId === id).length) },
  { label: "Planned delivery (days)", get: (s, id) => String(s.views[id]?.plannedDeliveryDays ?? "") },
]
/** Side-by-side compare of a new request (or a candidate) with an existing material; creating anyway needs a "not a duplicate because" note. */
export function CompareTable({ aId, bId }: { aId: string; bId: string }) {
  const s = useSlice("materials")
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" aria-label={`Compare ${aId} and ${bId}`}>
        <thead className="bg-table-head text-left">
          <tr>
            <th scope="col" className="w-40 px-3 py-2" />
            <th scope="col" className="px-3 py-2 font-mono">
              {aId}
            </th>
            <th scope="col" className="px-3 py-2 font-mono">
              {bId}
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((r) => {
            const a = r.get(s, aId)
            const b = r.get(s, bId)
            return (
              <tr key={r.label} className="border-t">
                <th scope="row" className="px-3 py-1 text-left font-normal text-muted-foreground">
                  {r.label}
                </th>
                <td className={cn("px-3 py-1", a !== b && "font-semibold")}>{a || "Not recorded"}</td>
                <td className={cn("px-3 py-1", a !== b && "font-semibold")}>{b || "Not recorded"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="border-t px-3 py-1 text-xs text-muted-foreground">Rows that differ are in bold. Similarity {similarity(getMaterial(s, aId)?.description ?? "", getMaterial(s, bId)?.description ?? "").toFixed(2)} on description.</p>
    </div>
  )
}
export function DuplicateCompareDialog({ aId, bId, open, onOpenChange, onNotDuplicate, sim }: { aId: string; bId: string; open: boolean; onOpenChange: (o: boolean) => void; onNotDuplicate?: (note: string) => string | null; sim?: DialogSim }) {
  const s = useSlice("materials")
  const a = getMaterial(s, aId)
  const b = getMaterial(s, bId)
  const hard = (s.views[aId]?.mfrParts ?? []).some((p) => (s.views[bId]?.mfrParts ?? []).some((q) => q.mpn === p.mpn && q.manufacturer === p.manufacturer))
  if (!a || !b) return null
  const gate = simBlock(sim) ?? (hard ? "E-MM-02: identical manufacturer and part number is a hard block; no note can override it." : undefined)
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Possible duplicate: compare side by side"
      description={
        <span>
          <MatLink id={a.id} /> <TypeBadge type={a.type} /> and <MatLink id={b.id} /> <TypeBadge type={b.type} />. Fuzzy match on description and manufacturer part within group L1 (§4.4).
        </span>
      }
      consequence="Creating anyway stores your note on the request. If it is a duplicate, use the existing material instead."
      requireReason
      reasonLabel="Not a duplicate because... (required)"
      confirmLabel="Create anyway"
      confirmDisabled={!!gate || !onNotDuplicate}
      secondary={
        <Button variant="outline" asChild>
          <Link to={R.material(b.id)}>Open {b.id}</Link>
        </Button>
      }
      onConfirm={(note) => (gate ? gate : (onNotDuplicate?.(note) ?? "Open this from a request to record the note."))}
    >
      <CompareTable aId={aId} bId={bId} />
      {gate && (
        <p role="status" className="rounded-md border border-status-blocked px-3 py-2 text-sm">
          {gate}
        </p>
      )}
      <div className="flex gap-2 text-xs">
        <MaterialStatusBadge m={a} /> <MaterialStatusBadge m={b} />
      </div>
    </DialogShell>
  )
}
