// Pure engineering rules shared by the slice, the actions and the screens. Each rule names its
// source; anything the PRD does not state is marked as a reading (see ../README.md "Readings").

import { AVL, MATERIALS, materialById, userById } from "@/data/shared"
import type { DocRef, Material, Role } from "@/data/domain"
import { addDays } from "@/lib/format"
import type { EngineeringState } from "./slice"
import type { ChecklistRow, DocRecord, DocRevisionX, EbomChange, EbomLineX, EbomRecord, EcoRecord, EcrRecord, ErRecord, MbomRecord, PvRecord } from "./types"
import { isKitId, KIT_HEADERS, routingFor } from "./reference"

export const userName = (id?: string) => (id ? (userById(id)?.name ?? id) : "Unassigned")

// ---------------------------------------------------------------- materials and placeholders
export interface ItemInfo {
  id: string
  description: string
  type: string
  uom: string
  status: Material["status"]
  stdCost?: number
  placeholder: boolean
  makeBuy: "Make" | "Buy"
  avl: { vendorId: string; rank: number; status: string }[]
  blocks: Material["blocks"]
}
export function itemInfo(s: Pick<EngineeringState, "placeholders">, id: string): ItemInfo {
  const ph = s.placeholders.find((p) => p.id === id)
  const m = materialById(id)
  const type = id.split("-")[0]
  const kit = KIT_HEADERS.find((k) => k.id === id)
  return {
    id,
    description: m?.description ?? ph?.description ?? kit?.description ?? "Unknown item",
    type,
    uom: m?.baseUom ?? ph?.uom ?? "EA",
    status: ph ? ph.status : (m?.status ?? "Draft"),
    stdCost: m?.stdCost ?? ph?.estCost,
    placeholder: !!ph && ph.status === "Draft",
    makeBuy: type === "SEMI" || type === "FIN" ? "Make" : "Buy",
    avl: AVL.filter((a) => a.itemId === id).map((a) => ({ vendorId: a.vendorId, rank: a.rank, status: a.status })),
    blocks: m?.blocks ?? [],
  }
}
/** Material picker for the EBOM editor: excludes Obsolete items (C-16). */
export const pickableMaterials = () => MATERIALS.filter((m) => m.status !== "Obsolete" && ["RAW", "SEMI", "PACK", "CONS", "SPARE"].includes(m.type))

// ---------------------------------------------------------------- EBOM structure
/** Level badge 1, 1.1, 1.1.1 for each line [DOC:p.60 §3.1] (asserted). */
export function levelLabels(lines: EbomLineX[]): Map<number, string> {
  const out = new Map<number, string>()
  const walk = (parent: number | undefined, prefix: string) => {
    const kids = lines.filter((l) => l.parent === parent).sort((a, b) => a.no - b.no)
    kids.forEach((k, i) => {
      const label = prefix ? `${prefix}.${i + 1}` : `${i + 1}`
      out.set(k.no, label)
      walk(k.no, label)
    })
  }
  walk(undefined, "")
  return out
}

export interface ValidationResult {
  severity: "error" | "warning"
  rule: string
  line?: number
  text: string
}
/** Validate: V-ENG rules + circular reference + UoM + duplicate warning + qty=0 error [DOC:pp.60-61 §3.2-3.3] (asserted). */
export function validateEbom(s: EngineeringState, e: EbomRecord): ValidationResult[] {
  const out: ValidationResult[] = []
  const seen = new Map<string, number>()
  const kit = e.usage === "Sales"
  for (const l of e.lines) {
    const info = itemInfo(s, l.componentId)
    if (kit) {
      // Sales kit: single level, components only, no phantoms, no nested kits [DOC:p.256 §6.1].
      if (l.parent != null) out.push({ severity: "error", rule: "Kit", line: l.no, text: `Line ${l.no}: a sales kit is single level; move it directly under ${e.parentItemId}.` })
      if (l.phantom) out.push({ severity: "error", rule: "Kit", line: l.no, text: `Line ${l.no}: a sales kit has no phantoms; untick Phantom or use a real component.` })
      if (isKitId(l.componentId)) out.push({ severity: "error", rule: "Kit", line: l.no, text: `Line ${l.no}: ${l.componentId} is a kit; kits cannot be nested.` })
    }
    if (!(l.qty > 0)) out.push({ severity: "error", rule: "Qty", line: l.no, text: `Line ${l.no}: quantity is 0. Enter the quantity per one ${e.parentItemId}.` })
    if (info.placeholder) out.push({ severity: "error", rule: "V-ENG-03", line: l.no, text: `Line ${l.no}: placeholder ${l.componentId} is still Draft. Release is blocked until its MCR completes.` })
    if (info.makeBuy === "Make" && !l.drawingId) out.push({ severity: "error", rule: "V-ENG-04", line: l.no, text: `Line ${l.no}: ${l.componentId} is a made part and needs a drawing reference.` })
    if (info.makeBuy === "Make" && info.type === "SEMI" && !s.eboms.some((x) => x.parentItemId === l.componentId && x.status === "Released"))
      out.push({ severity: "error", rule: "V-ENG-06", line: l.no, text: `Line ${l.no}: make item ${l.componentId} has no Released EBOM.` })
    if (!l.consumeAtOp && !kit) out.push({ severity: "warning", rule: "V-ENG-05", line: l.no, text: `Line ${l.no}: no Consume At Operation; mandatory before MBOM release.` })
    if (l.uom !== info.uom) out.push({ severity: "error", rule: "UoM", line: l.no, text: `Line ${l.no}: UoM ${l.uom} has no conversion to ${info.uom}.` })
    if (info.status === "Obsolete") out.push({ severity: "error", rule: "C-16", line: l.no, text: `Line ${l.no}: ${l.componentId} is Obsolete.` })
    if (info.blocks.length) out.push({ severity: "warning", rule: "Block", line: l.no, text: `Line ${l.no}: ${l.componentId} carries ${info.blocks.map((b) => b.block).join(", ")}.` })
    const key = `${l.parent ?? 0}:${l.componentId}`
    if (seen.has(key)) out.push({ severity: "warning", rule: "Duplicate", line: l.no, text: `Line ${l.no}: ${l.componentId} also on line ${seen.get(key)} under the same parent.` })
    else seen.set(key, l.no)
    if (l.componentId === e.parentItemId) out.push({ severity: "error", rule: "Circular", line: l.no, text: `Line ${l.no}: the parent item cannot be its own component.` })
    // circular through parent chain
    let p = l.parent
    const chain = new Set<number>([l.no])
    while (p != null) {
      if (chain.has(p)) {
        out.push({ severity: "error", rule: "Circular", line: l.no, text: `Line ${l.no}: circular parent chain.` })
        break
      }
      chain.add(p)
      p = e.lines.find((x) => x.no === p)?.parent
    }
  }
  return out
}

/** MBOMs derived from an older revision than the source EBOM's current Released revision [DOC:p.66 Dev Note]. */
export function ebomAhead(s: Pick<EngineeringState, "eboms">, m: MbomRecord): string | undefined {
  if (m.status !== "Active") return undefined
  const e = s.eboms.find((x) => x.id === m.ebomId)
  if (!e || e.status !== "Released" || e.rev === m.ebomRev) return undefined
  return `${e.id} is at rev ${e.rev}; this MBOM was transformed from rev ${m.ebomRev}`
}

// ---------------------------------------------------------------- documents
export const currentRev = (d: DocRecord): DocRevisionX => d.revisions[d.revisions.length - 1]
/** The document-level status is its newest revision's status. */
export const docStatus = (d: DocRecord) => currentRev(d).status
/** The revision the floor and customers may see: the current Released one, never a superseded one (C-18). */
export const releasedRev = (d: DocRecord) => [...d.revisions].reverse().find((r) => r.status === "Released")
export function whereUsedDoc(s: EngineeringState, id: string): DocRef[] {
  const out: DocRef[] = []
  for (const e of s.eboms) if (e.lines.some((l) => l.drawingId === id)) out.push({ type: "ebom", id: e.id })
  for (const t of s.transmittals) if (t.documentIds.includes(id as never)) out.push({ type: "transmittal", id: t.id })
  for (const r of s.requests) if (r.checklist.some((c) => c.ref?.id === id)) out.push({ type: "engineeringRequest", id: r.id })
  return out
}

// ---------------------------------------------------------------- engineering request
export function rowDone(s: EngineeringState, r: ChecklistRow): boolean {
  if (!r.ref) return r.done
  if (r.ref.type === "document") {
    const d = s.documents.find((x) => x.id === r.ref!.id)
    return !!d && !!releasedRev(d)
  }
  if (r.ref.type === "ebom") return s.eboms.find((x) => x.id === r.ref!.id)?.status === "Released"
  if (r.ref.type === "mbom") return s.mboms.find((x) => x.id === r.ref!.id)?.status === "Active"
  return r.done
}
export function rowStatus(s: EngineeringState, r: ChecklistRow): { kind?: "document" | "ebom" | "mbom"; value: string } {
  if (r.ref?.type === "document") {
    const d = s.documents.find((x) => x.id === r.ref!.id)
    return { kind: "document", value: d ? docStatus(d) : "WIP" }
  }
  if (r.ref?.type === "ebom") return { kind: "ebom", value: s.eboms.find((x) => x.id === r.ref!.id)?.status ?? "Draft" }
  if (r.ref?.type === "mbom") return { kind: "mbom", value: s.mboms.find((x) => x.id === r.ref!.id)?.status ?? "Active" }
  return { value: r.done ? "Done" : "Open" }
}
export const checklistProgress = (s: EngineeringState, er: ErRecord) => {
  const done = er.checklist.filter((r) => rowDone(s, r)).length
  return { done, total: er.checklist.length }
}

// ---------------------------------------------------------------- production versions
/** V-PV-01: exactly one valid PV per material, plant, lot-size band and date [DOC:p.214] (asserted). */
export function pvOverlaps(s: Pick<EngineeringState, "productionVersions">, pv: PvRecord): PvRecord[] {
  const end = (x: PvRecord) => x.validTo ?? "9999-12-31"
  return s.productionVersions.filter(
    (o) =>
      o.id !== pv.id && o.status === "Released" && o.materialId === pv.materialId && o.plantId === pv.plantId &&
      o.lotSizeFrom <= pv.lotSizeTo && pv.lotSizeFrom <= o.lotSizeTo && o.validFrom <= end(pv) && pv.validFrom <= end(o),
  )
}
export function pvPairingProblems(s: EngineeringState, pv: Pick<PvRecord, "mbomId" | "routingId" | "routingRev" | "materialId">): string[] {
  const out: string[] = []
  const m = s.mboms.find((x) => x.id === pv.mbomId)
  if (!m) out.push("Select an MBOM.")
  else {
    if (m.status !== "Active") out.push(`${m.id} is ${m.status}; only the Active MBOM revision can be paired.`)
    if (m.parentItemId !== pv.materialId) out.push(`${m.id} is for ${m.parentItemId}, not ${pv.materialId}.`)
  }
  const r = routingFor(pv.routingId, pv.routingRev)
  if (!r) out.push("Select a routing revision.")
  else if (r.status !== "Released") out.push(`${r.id} rev ${r.rev} is ${r.status}; both revisions must be Released.`)
  return out
}

// ---------------------------------------------------------------- ECO
/** Why an ECO cannot release yet: open tasks (C-19), missing dispositions, unresolved LLR impacts. */
export function ecoBlockers(eco: EcoRecord): string[] {
  const out: string[] = []
  const open = eco.tasks.filter((t) => !t.done)
  if (open.length) out.push(`${open.length} task${open.length > 1 ? "s" : ""} open: ${open.map((t) => `#${t.no}`).join(", ")} (C-19).`)
  const sd = eco.stockDispositions.filter((x) => x.onHand > 0 && !x.decision)
  if (sd.length) out.push(`Old-stock disposition missing for ${sd.map((x) => x.itemId).join(", ")}.`)
  const wd = eco.woDispositions.filter((x) => !x.decision)
  if (wd.length) out.push(`Open-WO disposition missing for ${wd.map((x) => x.woId).join(", ")}.`)
  const ll = eco.llrImpacts.filter((x) => !x.decision)
  if (ll.length) out.push(`Unresolved LLR impact on ${ll.map((x) => `${x.poId} (${x.llrId})`).join(", ")} blocks release.`)
  if (eco.effectivity === "Date" && !eco.effectiveOn) out.push("Choose the effectivity date.")
  if (eco.effectivity === "Serial" && !eco.fromSerial) out.push("Enter the first serial the change applies to.")
  return out
}

/** Next revision letter: A -> B ... Z -> AA. */
export const nextRev = (r: string) => (r === "Z" ? "AA" : r.length === 1 ? String.fromCharCode(r.charCodeAt(0) + 1) : r + "A")

export const itemDesc = (id: string) => materialById(id)?.description ?? KIT_HEADERS.find((k) => k.id === id)?.description ?? id

// ---------------------------------------------------------------- export control (EAR flag)
/** Users holding the EAR flag. Restricted (export-controlled) documents are visible only to them
 *  [DOC:p.64 §5.1; Book III Part C §3]. Which users hold the flag is a design value (reading R-DOC-1). */
export const EAR_FLAG_USERS: string[] = ["USR-TBD-022", "USR-TBD-024", "USR-TBD-026"]
export const hasEarFlag = (userId?: string) => !!userId && EAR_FLAG_USERS.includes(userId)
export const canSeeDoc = (d: Pick<DocRecord, "security">, userId?: string) => d.security !== "Restricted" || hasEarFlag(userId)

// ---------------------------------------------------------------- CCB [DOC:p.62 §4.1]
/** CCB = Engineering Manager + Quality Manager + Production Manager + (cost delta above $10k) Controller.
 *  The role catalog has no "Production Manager"; the Production supervisor stands for it (reading R-ECR-6). */
export const CCB_COST_THRESHOLD = 10_000
export function ccbMembers(costDelta?: number): Role[] {
  const m: Role[] = ["Engineering Manager", "Quality Manager", "Production supervisor"]
  if ((costDelta ?? 0) > CCB_COST_THRESHOLD) m.push("Controller")
  return m
}
export const ccbLabel = (r: Role) => (r === "Production supervisor" ? "Production Manager (Production supervisor)" : r)
/** Emergency: the CCB decides within 24 hours. The prototype clock is a date, so 24 h = the next day. */
export function ccbSla(e: Pick<EcrRecord, "priority" | "stage" | "submittedOn" | "ccbDueBy">, today: string): { due?: string; ageDays?: number; breached: boolean } {
  if (e.priority !== "Emergency" || !e.submittedOn) return { breached: false }
  const due = e.ccbDueBy ?? addDays(e.submittedOn, 1)
  const ageDays = Math.round((Date.parse(today) - Date.parse(e.submittedOn)) / 86_400_000)
  return { due, ageDays, breached: e.stage === "Submitted to CCB" && today > due }
}

// ---------------------------------------------------------------- applying proposed changes
/** Applies ECR/ECO operations to a copy of EBOM lines. Returns the new lines or the problem. */
export function applyOps(s: Pick<EngineeringState, "placeholders">, lines: EbomLineX[], ops: EbomChange["ops"]): { lines: EbomLineX[]; error?: string } {
  const out = structuredClone(lines)
  for (const op of ops) {
    if (op.kind === "add") {
      out.push(structuredClone(op.line))
      continue
    }
    const l = out.find((x) => x.no === op.line)
    if (!l) return { lines: out, error: `no line ${op.line}` }
    if (op.kind === "replace") Object.assign(l, { componentId: op.componentId, uom: itemInfo(s, op.componentId).uom })
    if (op.kind === "qty") l.qty = op.qty
    if (op.kind === "remove") out.splice(out.indexOf(l), 1)
  }
  return { lines: out.sort((a, b) => a.no - b.no) }
}

// ---------------------------------------------------------------- sales kits [DOC:p.256 §6.1]
/** Kit memberships of a component: "Where used from any component lists its kit memberships". */
export function kitMemberships(s: Pick<EngineeringState, "eboms">, componentId: string) {
  return s.eboms
    .filter((e) => e.usage === "Sales" && e.status !== "Obsolete" && e.status !== "Superseded")
    .flatMap((e) => e.lines.filter((l) => l.componentId === componentId).map((l) => ({ ebom: e, line: l })))
}
/** Kits that carry any component of an item's own structure, or the item itself (recommended spares, commissioning). */
export function kitsForDesign(s: Pick<EngineeringState, "eboms" | "requests">, e: EbomRecord) {
  const comps = new Set(e.lines.map((l) => l.componentId))
  const kits = s.eboms.filter((k) => k.usage === "Sales" && k.id !== e.id && k.status !== "Obsolete" && k.status !== "Superseded")
  return kits.map((k) => ({ kit: k, shared: k.lines.filter((l) => comps.has(l.componentId)), sameFamily: k.parentItemId.includes(e.parentItemId.split("-").pop()!.replace(/MVA|SS|PM|PL|MTO/, "")) }))
    .filter((x) => x.shared.length > 0 || x.sameFamily)
}
/** Report-only cost rollup of a kit: sum of component standards [DOC:p.256 §6.1 Costing view]. */
export const kitStandard = (s: Pick<EngineeringState, "placeholders">, e: EbomRecord) => e.lines.reduce((t, l) => t + l.qty * (itemInfo(s, l.componentId).stdCost ?? 0), 0)

// ---------------------------------------------------------------- where-used explosion [DOC:p.61 §3.3; p.67 §7]
export interface WhereUsedNode {
  level: number
  kind: "EBOM" | "MBOM" | "Sales kit"
  recordId: string
  rev: string
  status: string
  parentItemId: string
  line: number
  qty: number
  uom: string
  /** The component this node used at that level. */
  via: string
  active: boolean
  path: string[]
}
const ACTIVE_BOM = new Set(["Draft", "In Review", "Released", "Active"])
/** Multi-level where-used for an item: every EBOM / MBOM / sales kit holding it, then where each parent is used, up to maxLevel. */
export function whereUsedExplosion(s: Pick<EngineeringState, "eboms" | "mboms">, itemId: string, maxLevel = 6): WhereUsedNode[] {
  const out: WhereUsedNode[] = []
  const walk = (id: string, level: number, path: string[]) => {
    if (level > maxLevel) return
    const parents = new Set<string>()
    for (const e of s.eboms)
      for (const l of e.lines)
        if (l.componentId === id) {
          out.push({ level, kind: e.usage === "Sales" ? "Sales kit" : "EBOM", recordId: e.id, rev: e.rev, status: e.status, parentItemId: e.parentItemId, line: l.no, qty: l.qty, uom: l.uom, via: id, active: ACTIVE_BOM.has(e.status), path: [...path, e.parentItemId] })
          if (e.status === "Released" || e.status === "Draft" || e.status === "In Review") parents.add(e.parentItemId)
        }
    for (const m of s.mboms)
      for (const l of m.lines)
        if (l.componentId === id && !l.mfgAdd)
          out.push({ level, kind: "MBOM", recordId: m.id, rev: m.revision, status: m.status, parentItemId: m.parentItemId, line: l.no, qty: l.qty, uom: l.uom, via: id, active: ACTIVE_BOM.has(m.status), path: [...path, m.parentItemId] })
    for (const p of parents) if (!path.includes(p) && p !== itemId) walk(p, level + 1, [...path, p])
  }
  walk(itemId, 1, [])
  return out
}

// ---------------------------------------------------------------- revision pool and diff [DOC:p.61 §3.3]
export interface RevisionOption {
  key: string
  ebomId: string
  rev: string
  status: string
  label: string
  parentItemId: string
  releasedOn?: string
  lines: EbomLineX[]
}
/** Every revision of every EBOM that shares a parent item: the current record and its superseded revisions. */
export function revisionPool(s: Pick<EngineeringState, "eboms">, parentItemId?: string): RevisionOption[] {
  return s.eboms
    .filter((e) => (!parentItemId || e.parentItemId === parentItemId))
    .flatMap((e) => [
      { key: `${e.id}@${e.rev}`, ebomId: e.id, rev: e.rev, status: e.status, label: `${e.id} rev ${e.rev} (${e.status})`, parentItemId: e.parentItemId, releasedOn: e.releasedOn, lines: e.lines },
      ...e.priorRevs.map((r) => ({ key: `${e.id}@${r.rev}`, ebomId: e.id, rev: r.rev, status: r.status, label: `${e.id} rev ${r.rev} (${r.status})`, parentItemId: e.parentItemId, releasedOn: r.releasedOn, lines: r.lines })),
    ])
}
export type DiffKind = "Added" | "Removed" | "Changed" | "Same"
export interface DiffRow {
  no: number
  kind: DiffKind
  a?: EbomLineX
  b?: EbomLineX
  fields: string[]
}
const FIELDS: [string, (l: EbomLineX) => string | number | boolean | undefined][] = [
  ["Component", (l) => l.componentId], ["Qty", (l) => l.qty], ["UoM", (l) => l.uom], ["Scrap %", (l) => l.scrapPct], ["Ref des", (l) => l.refDes ?? ""],
  ["Phantom", (l) => !!l.phantom], ["Consume at op", (l) => l.consumeAtOp ?? 0], ["Drawing", (l) => l.drawingId ?? ""], ["Parent", (l) => l.parent ?? 0],
]
/** Line-by-line diff keyed on the stable Find # [DOC:p.60 §3.2]: added, removed, changed (which fields), same. */
export function diffLines(from: EbomLineX[], to: EbomLineX[]): DiffRow[] {
  const nos = [...new Set([...from.map((l) => l.no), ...to.map((l) => l.no)])].sort((x, y) => x - y)
  return nos.map((no) => {
    const a = from.find((l) => l.no === no)
    const b = to.find((l) => l.no === no)
    if (!a) return { no, kind: "Added" as const, b, fields: [] }
    if (!b) return { no, kind: "Removed" as const, a, fields: [] }
    const fields = FIELDS.filter(([, f]) => f(a) !== f(b)).map(([n]) => n)
    return { no, kind: fields.length ? ("Changed" as const) : ("Same" as const), a, b, fields }
  })
}

// ---------------------------------------------------------------- CAD vs EBOM [DOC:p.198 §3 Structure comparison]
export interface CadDiffRow {
  key: string
  kind: "Added in CAD" | "Removed from CAD" | "Qty changed" | "Same"
  partNo: string
  description: string
  erpQty?: number
  cadQty?: number
  erpLine?: number
  cadLine?: number
}
/** Diff of the current ERP EBOM against the vault assembly: added / removed / qty-changed lines, matched on part number. */
export function cadDiff(e: EbomRecord, cad: { lines: { findNo: number; partNo: string; description: string; qty: number }[] }): CadDiffRow[] {
  const erp = new Map<string, { qty: number; no: number }>()
  for (const l of e.lines) {
    const cur = erp.get(l.componentId)
    erp.set(l.componentId, { qty: (cur?.qty ?? 0) + l.qty, no: cur?.no ?? l.no })
  }
  // A part may sit on several lines in either structure: compare totals per part number.
  const cadTotals = new Map<string, { qty: number; line: number; description: string }>()
  for (const c of cad.lines) {
    const key = c.partNo || `MPN:${c.description}`
    const cur = cadTotals.get(key)
    cadTotals.set(key, { qty: (cur?.qty ?? 0) + c.qty, line: cur?.line ?? c.findNo, description: c.description })
  }
  const seen = new Set<string>()
  const rows: CadDiffRow[] = []
  for (const [key, c] of cadTotals) {
    seen.add(key)
    const partNo = key.startsWith("MPN:") ? "" : key
    const m = partNo ? erp.get(partNo) : undefined
    if (!m) rows.push({ key, kind: "Added in CAD", partNo, description: c.description, cadQty: c.qty, cadLine: c.line })
    else rows.push({ key, kind: m.qty === c.qty ? "Same" : "Qty changed", partNo, description: c.description, erpQty: m.qty, cadQty: c.qty, erpLine: m.no, cadLine: c.line })
  }
  for (const [id, m] of erp) if (!seen.has(id)) rows.push({ key: id, kind: "Removed from CAD", partNo: id, description: itemDesc(id), erpQty: m.qty, erpLine: m.no })
  return rows
}

// ---------------------------------------------------------------- engineering items [FX-ENG-ITEMS]
export interface EngItem {
  id: string
  description: string
  type: string
  status: Material["status"]
  makeBuy: "Make" | "Buy"
  placeholder: boolean
  kit: boolean
  usedIn: number
  parentOf: number
  releasedEbom?: string
  hasBlock: boolean
}
export function engineeringItems(s: EngineeringState): EngItem[] {
  const ids = new Set<string>()
  for (const e of s.eboms) {
    ids.add(e.parentItemId)
    for (const l of e.lines) ids.add(l.componentId)
  }
  for (const p of s.placeholders) ids.add(p.id)
  return [...ids].sort().map((id) => {
    const info = itemInfo(s, id)
    const rel = s.eboms.find((e) => e.parentItemId === id && e.status === "Released" && e.usage === "Production") ?? s.eboms.find((e) => e.parentItemId === id && e.status === "Released")
    return {
      id, description: info.description, type: isKitId(id) ? "KIT" : info.type, status: info.status, makeBuy: info.makeBuy, placeholder: info.placeholder, kit: isKitId(id),
      usedIn: s.eboms.filter((e) => e.lines.some((l) => l.componentId === id)).length, parentOf: s.eboms.filter((e) => e.parentItemId === id).length, releasedEbom: rel?.id, hasBlock: info.blocks.length > 0,
    }
  })
}

/** Production EBOMs only: sales kits are not transformed to an MBOM [DOC:p.256 §6.1]. */
export const isProductionEbom = (e: Pick<EbomRecord, "usage">) => e.usage !== "Sales"
