// Pure engineering rules shared by the slice, the actions and the screens. Each rule names its
// source; anything the PRD does not state is marked as a reading (see ../README.md "Readings").

import { AVL, MATERIALS, materialById, userById } from "@/data/shared"
import type { DocRef, Material, Role } from "@/data/domain"
import { addDays } from "@/lib/format"
import type { EngineeringState } from "./slice"
import type { ChecklistRow, DocRecord, DocRevisionX, EbomChange, EbomLineX, EbomRecord, EcoRecord, EcrRecord, ErRecord, MbomRecord, PvRecord } from "./types"
import { routingFor } from "./reference"

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
  return {
    id,
    description: m?.description ?? ph?.description ?? "Unknown item",
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
  for (const l of e.lines) {
    const info = itemInfo(s, l.componentId)
    if (!(l.qty > 0)) out.push({ severity: "error", rule: "Qty", line: l.no, text: `Line ${l.no}: quantity is 0. Enter the quantity per one ${e.parentItemId}.` })
    if (info.placeholder) out.push({ severity: "error", rule: "V-ENG-03", line: l.no, text: `Line ${l.no}: placeholder ${l.componentId} is still Draft. Release is blocked until its MCR completes.` })
    if (info.makeBuy === "Make" && !l.drawingId) out.push({ severity: "error", rule: "V-ENG-04", line: l.no, text: `Line ${l.no}: ${l.componentId} is a made part and needs a drawing reference.` })
    if (info.makeBuy === "Make" && info.type === "SEMI" && !s.eboms.some((x) => x.parentItemId === l.componentId && x.status === "Released"))
      out.push({ severity: "error", rule: "V-ENG-06", line: l.no, text: `Line ${l.no}: make item ${l.componentId} has no Released EBOM.` })
    if (!l.consumeAtOp) out.push({ severity: "warning", rule: "V-ENG-05", line: l.no, text: `Line ${l.no}: no Consume At Operation; mandatory before MBOM release.` })
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

export const itemDesc = (id: string) => materialById(id)?.description ?? id

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
