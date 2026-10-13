// Engineering actions. Each runs inside store.mutate("engineering", ...) and throws ProtoError to
// refuse, which leaves the slice untouched (atomic write). Role gates only where a rule names the
// role (ASM-PERM-1): Engineering Manager assigns, releases ECOs, force-unlocks and releases
// documents [DOC:p.67 §7 Roles]; the ECO task owner completes a task; the CAD conflict resolver is
// the role that owns the field [DOC:p.199] (all asserted).

import { ProtoError, type MutateCtx } from "@/store"
import type { CustomerId, DocRef, EbomId, EcoId, EcrId, MaterialId, MbomId, Role, SalesOrderId, UserId } from "@/data/domain"
import { STATUS } from "@/data/domain"
import { addDays } from "@/lib/format"
import type { EngineeringState } from "./slice"
import type {
  CcbVoteValue, DesignType, DocRecord, DocTypeCode, EbomChange, EbomLineX, EcoRecord, EcoTaskX, EcrRecord, ErRecord, LlrDecision, MbomLineX, MbomRecord, StockDisposition, TitleBlock, TransmittalPurpose, TrResponse, WoDisposition,
} from "./types"
import { checklistFor, fakeSha } from "./seed"
import { LLR_MIRROR } from "./reference"
import { applyOps, ccbMembers, currentRev, hasEarFlag, ecoBlockers, itemInfo, nextRev, pvOverlaps, rowDone, validateEbom } from "./logic"

type D = EngineeringState
const pad4 = (n: number) => String(n).padStart(4, "0")
const pad5 = (n: number) => String(n).padStart(5, "0")
/** Specification ID formats for records created live [DOC:p.59 §2; p.60 §3; p.64 §5.1-5.2]. Engineering-only
 *  seed records use them too; the spine-referenced ones keep the foundation's TBD IDs (README R-9). */
export const newIds = {
  er: (d: D, ctx: MutateCtx) => `ER-${ctx.today.slice(0, 4)}-${pad4(next(d))}` as ErRecord["id"],
  ebom: (d: D) => `EBOM-${pad5(next(d))}` as EbomId,
  doc: (d: D, type: DocTypeCode) => `DOC-${type}-${pad5(next(d))}` as DocRecord["id"],
  tr: (d: D) => `TR-${next(d)}` as `TR-${string}`,
}
/** A ctx that records nothing: used for the all-or-nothing dry run before an ECO release. */
const quiet = (ctx: MutateCtx): MutateCtx => ({ ...ctx, emit: () => {}, link: () => {} })
const next = (d: D) => ++d.seq
const log = (rec: { activity: { at: string; by: string; text: string }[] }, ctx: MutateCtx, text: string) => rec.activity.push({ at: ctx.today, by: ctx.role, text })
const need = (ctx: MutateCtx, role: Role, what: string) => {
  if (ctx.role !== role) throw new ProtoError(`${what} is done by the ${role}. Switch "Acting as" to ${role}.`)
}
const find = <T extends { id: string }>(arr: T[], id: string, label: string) => {
  const x = arr.find((r) => r.id === id)
  if (!x) throw new ProtoError(`${label} ${id} not found.`)
  return x
}

// ================================================================== engineering request
export function newErFromOrder(d: D, ctx: MutateCtx, p: { soId: SalesOrderId; line: number; itemId: MaterialId; customerId: CustomerId; promisedShip?: string }) {
  const id = newIds.er(d, ctx)
  const promisedShip = p.promisedShip ?? addDays(ctx.today, 180)
  // Reading R-ER-1: the PRD does not say who picks the design type at auto-creation; a new request
  // opens as New Design and the Engineering Manager sets the type (setDesignType).
  const designType: DesignType = "New Design"
  const er: ErRecord = {
    id, soId: p.soId, soLine: p.line, customerId: p.customerId, itemId: p.itemId, title: `Design: ${p.itemId}, ${p.soId} line ${p.line}`, designType, status: "Open", releaseLevel: "Concept",
    assigneeIds: [], customerApprovalRequired: true, reviewLoops: 0, promisedShip, productionLeadDays: 98, longLeadDays: 45, due: addDays(promisedShip, -143),
    config: [["Configuration", `Read from ${p.soId} line ${p.line}`]], checklist: checklistFor(designType), createdOn: ctx.today, createdBy: ctx.userId,
    activity: [{ at: ctx.today, by: "System", text: `Created automatically at ${p.soId} confirmation (line ${p.line})` }],
  }
  d.requests.unshift(er)
  return er
}

export function assignEngineers(d: D, ctx: MutateCtx, id: string, users: UserId[]) {
  need(ctx, "Engineering Manager", "Assigning engineers")
  const er = find(d.requests, id, "Engineering request")
  if (er.status === "Closed") throw new ProtoError(`${id} is Closed.`)
  if (!users.length) throw new ProtoError("Pick at least one engineer.", "assignees")
  er.assigneeIds = users
  log(er, ctx, `Assigned ${users.join(", ")}`)
  if (er.status === "Open") {
    er.status = "In Design"
    log(er, ctx, "Status In Design")
  }
}
export function toggleCustomerApproval(d: D, ctx: MutateCtx, id: string) {
  const er = find(d.requests, id, "Engineering request")
  if (er.status === "Released" || er.status === "Closed") throw new ProtoError("The design is released; the approval loop can no longer change.")
  er.customerApprovalRequired = !er.customerApprovalRequired
  log(er, ctx, `Customer approval loop ${er.customerApprovalRequired ? "on" : "off"}`)
}
export function blockEr(d: D, ctx: MutateCtx, id: string, reason: string) {
  const er = find(d.requests, id, "Engineering request")
  if (er.status === "Blocked" || er.status === "Closed") throw new ProtoError(`${id} is ${er.status}.`)
  er.statusBeforeBlock = er.status
  er.status = "Blocked"
  er.blockedReason = reason
  log(er, ctx, `Blocked: ${reason}`)
}
export function unblockEr(d: D, ctx: MutateCtx, id: string) {
  const er = find(d.requests, id, "Engineering request")
  if (er.status !== "Blocked") throw new ProtoError(`${id} is not Blocked.`)
  er.status = er.statusBeforeBlock ?? "In Design"
  er.blockedReason = undefined
  log(er, ctx, `Unblocked; back to ${er.status}`)
}
export function advanceReleaseLevel(d: D, ctx: MutateCtx, id: string) {
  need(ctx, "Engineering Manager", "Moving the release level")
  const er = find(d.requests, id, "Engineering request")
  const levels = STATUS.releaseLevel.main
  const i = levels.indexOf(er.releaseLevel)
  if (i < 0 || i >= levels.length - 2) throw new ProtoError("No further level before Released for Production; that level is set by Release design.")
  er.releaseLevel = levels[i + 1]
  log(er, ctx, `Release level ${er.releaseLevel} (forward only, C-21)`)
}
export function releaseDesign(d: D, ctx: MutateCtx, id: string) {
  need(ctx, "Engineering Manager", "Releasing the design")
  const er = find(d.requests, id, "Engineering request")
  if (er.status !== "In Design" && er.status !== "Customer Review") throw new ProtoError(`Release needs In Design or Customer Review; ${id} is ${er.status}.`)
  const ebomRow = er.checklist.find((r) => r.key === "ebom")
  if (ebomRow && !rowDone(d, ebomRow)) throw new ProtoError("The EBOM is not Released yet.")
  if (er.customerApprovalRequired && !er.customerApprovalEvidence) throw new ProtoError("Customer approval is required: record an Approved or Approved as Noted response on a For Approval transmittal first.")
  const drawings = er.checklist.filter((r) => r.ref?.type === "document" && !rowDone(d, r))
  if (drawings.length) throw new ProtoError(`Drawings not Released: ${drawings.map((r) => r.ref!.id).join(", ")}.`)
  er.status = "Released"
  er.releaseLevel = "Released for Production"
  log(er, ctx, "Released; release level Released for Production")
}
export function completeEr(d: D, ctx: MutateCtx, id: string) {
  const er = find(d.requests, id, "Engineering request")
  if (er.status !== "Released") throw new ProtoError(`Complete needs Released; ${id} is ${er.status}.`)
  const open = er.checklist.filter((r) => !rowDone(d, r))
  if (open.length) throw new ProtoError(`The request completes only when every deliverable is done. Open: ${open.map((r) => r.item).join(", ")}.`)
  er.status = "Closed"
  log(er, ctx, "Closed: every deliverable done")
}
export function setChecklistDone(d: D, ctx: MutateCtx, id: string, key: string, done: boolean) {
  const er = find(d.requests, id, "Engineering request")
  const row = er.checklist.find((r) => r.key === key)
  if (!row) throw new ProtoError("Row not found.")
  if (row.ref && row.ref.type !== "costEstimate") throw new ProtoError("This row follows its linked object's status.")
  row.done = done
  log(er, ctx, `${row.item} marked ${done ? "done" : "open"}`)
}
export function setDueDate(d: D, ctx: MutateCtx, id: string, due: string) {
  need(ctx, "Engineering Manager", "Editing the design due date")
  const er = find(d.requests, id, "Engineering request")
  er.due = due
  log(er, ctx, `Design due date set to ${due}; schedule-impact warning sent to ${er.soId}`)
}

/** Design type [DOC:p.59 §2]: New Design; Variant of Existing (select base design: copies its EBOM and
 *  drawing set as the starting point); Repeat (released design, no engineering: the request
 *  auto-completes and the MBOM releases immediately). */
export function setDesignType(d: D, ctx: MutateCtx, id: string, type: DesignType, baseEbomId?: string) {
  need(ctx, "Engineering Manager", "Setting the design type")
  const er = find(d.requests, id, "Engineering request")
  if (er.status !== "Open" && er.status !== "In Design") throw new ProtoError(`The design type is set while the request is Open or In Design; ${id} is ${er.status}.`)
  if (er.checklist.some((r) => r.ref && (r.ref.type === "ebom" || r.ref.type === "mbom"))) throw new ProtoError(`${id} already has its EBOM; the design type can no longer change.`, "designType")
  if (type === "New Design") {
    er.designType = type
    er.baseDesignEbomId = undefined
    er.checklist = checklistFor(type)
    log(er, ctx, "Design type New Design; deliverables checklist regenerated")
    return
  }
  if (!baseEbomId) throw new ProtoError("Select the base design (a Released EBOM).", "base")
  const base = find(d.eboms, baseEbomId, "EBOM")
  if (base.status !== "Released") throw new ProtoError(`${base.id} is ${base.status}; the base design must be a Released EBOM.`, "base")
  if (type === "Repeat") {
    const mbom = d.mboms.find((m) => m.ebomId === base.id && m.status === "Active" && m.ebomRev === base.rev)
    if (!mbom) throw new ProtoError(`${base.id} rev ${base.rev} has no Active MBOM for this revision; a Repeat needs a released design that is already transformed. Run MBOM-TRF first or choose Variant of Existing.`, "base")
    er.designType = type
    er.baseDesignEbomId = base.id
    er.checklist = checklistFor(type, { mbom: { type: "mbom", id: mbom.id } }, ["mbom"])
    er.status = "Closed"
    er.releaseLevel = "Released for Production"
    log(er, ctx, `Repeat of ${base.id} rev ${base.rev}: no engineering; request auto-completed (Closed) and ${mbom.id} rev ${mbom.revision} released to ${er.soId} line ${er.soLine}`)
    ctx.emit("engineering.mbomActivated", { mbomId: mbom.id as MbomId, ebomId: base.id })
    return
  }
  // Variant of Existing: copy the base EBOM and its drawing set.
  const ebomId = copyEbom(d, ctx, base.id, er.id)
  const copy = d.eboms.find((x) => x.id === ebomId)!
  copy.title = `EBOM ${er.itemId}, ${er.soId}, variant of ${base.id}`
  copy.baseDesign = `Variant of ${base.id} rev ${base.rev}`
  const keyOf: Partial<Record<DocTypeCode, string>> = { GA: "ga", NP: "np", SCH: "sch", COR: "cor", WND: "wnd", TNK: "tnk", TP: "tp" }
  const refs: Record<string, DocRef> = { ebom: { type: "ebom", id: ebomId } }
  const set = d.documents.filter((x) => base.engineeringRequestId && x.engineeringRequestId === base.engineeringRequestId && x.revisions.some((r) => r.status === "Released"))
  for (const src of set) {
    const rel = [...src.revisions].reverse().find((r) => r.status === "Released")!
    const nid = newIds.doc(d, src.typeCode)
    d.documents.unshift({
      id: nid, typeCode: src.typeCode, title: `${src.title.replace(/, rev [A-Z]+$/, "")} (variant for ${er.soId})`, security: src.security, createdOn: ctx.today, engineeringRequestId: er.id,
      linkedTo: [{ type: "salesOrder", id: er.soId }, { type: "ebom", id: ebomId }],
      revisions: [{ ...structuredClone(rel), rev: "A", status: "WIP", rendition: undefined, stamp: undefined, releasedOn: undefined, redlines: [], checkedOutBy: undefined, checkedOutSince: undefined, titleBlock: { ...rel.titleBlock, drawnBy: ctx.userId, checkedBy: undefined, approvedBy: undefined, project: er.soId } }],
      activity: [{ at: ctx.today, by: ctx.role, text: `Copied from ${src.id} rev ${rel.rev} as the starting point for ${er.id} (Variant of Existing)` }],
    })
    const k = keyOf[src.typeCode]
    if (k && !refs[k]) refs[k] = { type: "document", id: nid }
  }
  er.designType = type
  er.baseDesignEbomId = base.id
  er.checklist = checklistFor(type, refs)
  log(er, ctx, `Variant of ${base.id} rev ${base.rev}: ${ebomId} (Draft) and ${set.length} drawing${set.length === 1 ? "" : "s"} copied as the starting point`)
}

// ================================================================== EBOM
const draftEbom = (d: D, id: string) => {
  const e = find(d.eboms, id, "EBOM")
  if (e.status === "Released") throw new ProtoError(`${id} rev ${e.rev} is Released and immutable (C-14). Raise an ECR instead.`)
  if (e.status !== "Draft") throw new ProtoError(`${id} is ${e.status}; only a Draft EBOM can be edited.`)
  return e
}
export function addLine(d: D, ctx: MutateCtx, id: string, line: Omit<EbomLineX, "no" | "uom" | "scrapPct"> & Partial<EbomLineX>) {
  const e = draftEbom(d, id)
  const info = itemInfo(d, line.componentId)
  if (info.status === "Obsolete") throw new ProtoError(`${line.componentId} is Obsolete (C-16).`, "component")
  const siblings = e.lines.filter((l) => l.parent === line.parent)
  const base = line.parent ?? 0
  let no = line.no ?? (line.parent ? Math.max(base, ...siblings.map((l) => l.no)) + 1 : Math.floor(Math.max(0, ...siblings.map((l) => l.no)) / 10) * 10 + 10)
  if (line.no != null && e.lines.some((l) => l.no === no)) throw new ProtoError(`Find # ${no} is already used.`, "findNo")
  while (e.lines.some((l) => l.no === no)) no++
  e.lines.push({ scrapPct: 0, uom: info.uom, ...line, no })
  e.lines.sort((a, b) => a.no - b.no)
  log(e, ctx, `Line ${no} added: ${line.componentId}`)
  return no
}
export function updateLine(d: D, _ctx: MutateCtx, id: string, no: number, patch: Partial<EbomLineX>) {
  const e = draftEbom(d, id)
  const l = e.lines.find((x) => x.no === no)
  if (!l) throw new ProtoError(`Line ${no} not found.`)
  if (patch.qty != null && (!Number.isFinite(patch.qty) || patch.qty < 0)) throw new ProtoError("Quantity must be zero or more.", "qty")
  if (patch.scrapPct != null && (!Number.isFinite(patch.scrapPct) || patch.scrapPct < 0 || patch.scrapPct >= 100)) throw new ProtoError("Scrap % must be 0 or more and below 100.", "scrapPct")
  const from = patch.effFrom !== undefined ? patch.effFrom : l.effFrom
  const to = patch.effTo !== undefined ? patch.effTo : l.effTo
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  if (from && to && isDate(from) !== isDate(to)) throw new ProtoError("Effectivity From and To must both be dates or both be serial numbers.", "effectivity")
  if (from && to && to < from) throw new ProtoError("Effectivity To is before Effectivity From.", "effectivity")
  Object.assign(l, patch)
  if (patch.effFrom !== undefined || patch.effTo !== undefined) log(e, _ctx, `Line ${no} effectivity ${l.effFrom || "start"} to ${l.effTo || "open"}`)
}
export function removeLine(d: D, ctx: MutateCtx, id: string, no: number) {
  const e = draftEbom(d, id)
  if (e.lines.some((l) => l.parent === no)) throw new ProtoError(`Line ${no} has child lines; move or remove them first.`)
  e.lines = e.lines.filter((l) => l.no !== no)
  log(e, ctx, `Line ${no} removed`)
}
export function createPlaceholder(d: D, ctx: MutateCtx, id: string, p: { description: string; category: "RAW" | "SEMI" | "CONS" | "PACK"; uom: string; estCost: number; targetVendorId?: string; qty: number; parent?: number; consumeAtOp?: number }) {
  const e = draftEbom(d, id)
  if (!p.description.trim()) throw new ProtoError("Enter a description.", "description")
  if (!(p.qty > 0)) throw new ProtoError("Enter a quantity above 0.", "qty")
  const pid = `${p.category}-TBD-PH${pad4(next(d))}` as MaterialId
  const no = addLine(d, ctx, id, { componentId: pid, qty: p.qty, parent: p.parent, consumeAtOp: p.consumeAtOp, uom: p.uom })
  d.placeholders.push({ id: pid, description: p.description, category: p.category, uom: p.uom, estCost: p.estCost, targetVendorId: p.targetVendorId as never, ebomId: e.id, line: no, engineerId: ctx.userId, createdOn: ctx.today, status: "Draft" })
  log(e, ctx, `Placeholder ${pid} created inline (Draft, Engineering Placeholder); Item Creation Request sent to Materials`)
  ctx.emit("engineering.placeholderNeeded", { engineeringRequestId: (e.engineeringRequestId ?? "ER-TBD-0000") as never, description: `${pid}: ${p.description} (${e.id} line ${no})` })
  return pid
}
export function submitEbom(d: D, ctx: MutateCtx, id: string) {
  const e = draftEbom(d, id)
  const errors = validateEbom(d, e).filter((v) => v.severity === "error")
  if (errors.length) throw new ProtoError(`Validate found ${errors.length} error${errors.length > 1 ? "s" : ""}. Fix them before review: ${errors.slice(0, 3).map((x) => x.text).join(" ")}`)
  e.status = "In Review"
  e.submittedBy = ctx.userId
  log(e, ctx, "Submitted for review; locked")
}
export function commentEbom(d: D, ctx: MutateCtx, id: string, text: string, line?: number) {
  const e = find(d.eboms, id, "EBOM")
  if (e.status !== "In Review") throw new ProtoError("Reviewer comments are taken while the EBOM is In Review.")
  if (!text.trim()) throw new ProtoError("Enter a comment.")
  const c = { by: ctx.userId, on: ctx.today, text }
  if (line == null) e.reviewNotes.push(c)
  else {
    const l = e.lines.find((x) => x.no === line)
    if (!l) throw new ProtoError(`Line ${line} not found.`)
    l.comments = [...(l.comments ?? []), c]
  }
}
export function copyEbom(d: D, ctx: MutateCtx, fromId: string, erId?: string) {
  const src = find(d.eboms, fromId, "EBOM")
  if (src.status !== "Released") throw new ProtoError("Copy From takes a Released EBOM.")
  const id = newIds.ebom(d)
  d.eboms.unshift({
    ...structuredClone(src), id, rev: "A", status: "Draft", title: `${src.title.replace(/, rev [A-Z]+$/, "")} (copy)`, priorRevs: [], releasedOn: undefined, submittedBy: undefined, reviewNotes: [],
    baseDesign: `Copy From ${src.id} rev ${src.rev}`, engineeringRequestId: erId as never, createdOn: ctx.today, createdBy: ctx.userId, assigneeIds: [ctx.userId], cadAhead: undefined,
    activity: [{ at: ctx.today, by: ctx.role, text: `Copied from ${src.id} rev ${src.rev}; provenance stored as Base Design` }],
  })
  return id
}

// ================================================================== MBOM transform
/** Scrap % changed from the EBOM default: production may adjust it with Engineering approval [DOC:p.66 §6 step 5]. */
export const scrapChanges = (source: EbomLineX[], lines: MbomLineX[]) => lines.filter((l) => !l.mfgAdd && !l.fromPhantom && source.some((x) => x.no === l.no && x.scrapPct !== l.scrapPct))
export function releaseMbom(d: D, ctx: MutateCtx, p: { ebomId: string; routingId: string; routingRev: string; lines: MbomLineX[]; ecoId?: string; scrapApprovedBy?: UserId }) {
  const e = find(d.eboms, p.ebomId, "EBOM")
  if (e.status !== "Released") throw new ProtoError(`${e.id} is ${e.status}; the transform starts from a Released EBOM revision${e.status === "Obsolete" ? " (C-16)" : ""}.`)
  const unmapped = p.lines.filter((l) => !l.operation)
  if (unmapped.length) throw new ProtoError(`Unmapped lines: ${unmapped.map((l) => l.no).join(", ")}. Resolve every Consume At Operation (V-ENG-05).`)
  const eco = p.ecoId ? find(d.ecos, p.ecoId, "ECO") : undefined
  const change = eco?.changes.find((c) => c.ebomId === e.id)
  if (eco && (eco.stage !== "Open" || !change)) throw new ProtoError(`${eco.id} is ${eco.stage}${change ? "" : ` and does not change ${e.id}`}; the MBOM cannot be staged on it.`)
  const source = change ? applyOps(d, e.lines, change.ops).lines : e.lines
  const changedScrap = scrapChanges(source, p.lines)
  if (changedScrap.length && !p.scrapApprovedBy) throw new ProtoError(`Scrap % changed on line${changedScrap.length > 1 ? "s" : ""} ${changedScrap.map((l) => l.no).join(", ")}: Engineering approval is needed (step 5). Ask the Engineering Manager to approve the scrap changes.`, "scrap")
  const scrapNote = changedScrap.length ? `; scrap % changed on ${changedScrap.map((l) => l.no).join(", ")} with Engineering approval (${p.scrapApprovedBy})` : ""
  if (eco && change) {
    // ECO path: the regenerated MBOM is held on the ECO and activates at the atomic cutover [DOC:p.62 §4.2].
    const staged: MbomRecord = {
      id: `MBOM-TBD-${pad4(next(d))}` as never, ebomId: e.id, ebomRev: nextRev(e.rev), parentItemId: e.parentItemId, revision: "", status: "Active", plantId: e.plantId, routingId: p.routingId as never, routingRev: p.routingRev, lines: p.lines,
      releasedOn: "", releasedBy: ctx.userId, costingInvalidated: true,
      activity: [{ at: ctx.today, by: ctx.role, text: `Regenerated from ${e.id} rev ${nextRev(e.rev)} (as changed by ${eco.id}); staged on ${eco.id} until cutover${scrapNote}` }],
    }
    eco.stagedMboms = [...(eco.stagedMboms ?? []).filter((m) => m.ebomId !== e.id), staged]
    for (const t of eco.tasks) if (!t.done && t.text.startsWith("Update MBOM")) Object.assign(t, { done: true, doneBy: ctx.userId, doneOn: ctx.today, link: `/engineering/change-orders/${eco.id}` })
    log(eco, ctx, `MBOM ${staged.id} staged from ${e.id} rev ${nextRev(e.rev)}; releases with the ECO at effectivity${scrapNote}`)
    return staged.id as string
  }
  const prior = d.mboms.filter((m) => m.ebomId === e.id && m.plantId === e.plantId && m.status === "Active")
  const id = `MBOM-TBD-${pad4(next(d))}` as never
  const revision = prior.length ? nextRev(prior[0].revision) : "A"
  for (const m of prior) {
    m.status = "Superseded"
    m.supersededOn = ctx.today
    m.activity.push({ at: ctx.today, by: "System", text: `Superseded by ${id}` })
  }
  d.mboms.unshift({
    id, ebomId: e.id, ebomRev: e.rev, parentItemId: e.parentItemId, revision, status: "Active", plantId: e.plantId, routingId: p.routingId as never, routingRev: p.routingRev, lines: p.lines,
    releasedOn: ctx.today, releasedBy: ctx.userId, costingInvalidated: true,
    activity: [{ at: ctx.today, by: ctx.role, text: `Transformed from ${e.id} rev ${e.rev}; status Active; cost rollup invalidation flag set for ${e.parentItemId}${prior.length ? `; ${prior.map((m) => m.id).join(", ")} Superseded` : ""}${scrapNote}` }],
  })
  for (const er of d.requests) {
    if (!er.checklist.some((r) => r.ref?.type === "ebom" && r.ref.id === e.id)) continue
    const row = er.checklist.find((r) => r.key === "mbom")
    if (row) row.ref = { type: "mbom", id }
  }
  ctx.emit("engineering.mbomActivated", { mbomId: id, ebomId: e.id })
  return id as string
}

// ================================================================== production versions
export function createPv(d: D, ctx: MutateCtx, p: { materialId: MaterialId; mbomId: string; routingId: string; routingRev: string; lotSizeFrom: number; lotSizeTo: number; validFrom: string; validTo?: string }) {
  const m = find(d.mboms, p.mbomId, "MBOM")
  if (m.status !== "Active") throw new ProtoError(`${m.id} is ${m.status}; pair only the Active MBOM.`, "mbom")
  if (!(p.lotSizeFrom >= 1) || p.lotSizeTo < p.lotSizeFrom) throw new ProtoError("Lot size range: from must be at least 1 and not above to.", "lot")
  if (!p.validFrom) throw new ProtoError("Enter Valid From.", "validFrom")
  if (p.validTo && p.validTo < p.validFrom) throw new ProtoError("Valid To is before Valid From.", "validTo")
  const id = `PV-TBD-${pad4(next(d))}` as never
  d.productionVersions.unshift({
    id, materialId: p.materialId, plantId: m.plantId, lotSizeFrom: p.lotSizeFrom, lotSizeTo: p.lotSizeTo, validFrom: p.validFrom, validTo: p.validTo, mbomId: m.id, mbomRev: m.revision,
    routingId: p.routingId as never, routingRev: p.routingRev, status: "Draft", createdOn: ctx.today, activity: [{ at: ctx.today, by: ctx.role, text: `Paired ${m.id} rev ${m.revision} with ${p.routingId} rev ${p.routingRev}` }],
  })
  return id as string
}
export function endDatePv(d: D, ctx: MutateCtx, id: string, validTo: string) {
  need(ctx, "Engineering Manager", "End-dating a production version")
  const pv = find(d.productionVersions, id, "Production version")
  if (pv.status !== "Released") throw new ProtoError("Only a Released version is end-dated.")
  if (validTo < pv.validFrom) throw new ProtoError("Valid To is before Valid From.")
  pv.validTo = validTo
  pv.activity.push({ at: ctx.today, by: ctx.role, text: `Valid To set to ${validTo}` })
}
export const pvReleasable = (d: D, id: string) => {
  const pv = d.productionVersions.find((x) => x.id === id)
  return pv ? pvOverlaps(d, pv) : []
}

// ================================================================== documents
const doc = (d: D, id: string) => find(d.documents, id, "Document")
export function checkOut(d: D, ctx: MutateCtx, id: string) {
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.status !== "WIP") throw new ProtoError(`Rev ${r.rev} is ${r.status}; only a WIP revision is checked out. Start a new revision first.`)
  if (r.checkedOutBy) throw new ProtoError(`Locked by ${r.checkedOutBy} since ${r.checkedOutSince}.`)
  r.checkedOutBy = ctx.userId
  r.checkedOutSince = ctx.today
  log(x, ctx, `Checked out rev ${r.rev}`)
}
/** Native file types and size limit [DOC:p.64 §5.1]. */
export const NATIVE_TYPES = ["DWG", "DXF", "SLDDRW", "SLDPRT", "STEP", "PDF", "DOCX"]
export const MAX_FILE_MB = 500
/** Simulated virus scan (reading R-DOC-2): a file whose name contains "eicar" is the test signature and fails. */
export const scanFile = (name: string) => (/eicar/i.test(name) ? "Threat found (EICAR test signature)" : undefined)
export function checkIn(d: D, ctx: MutateCtx, id: string, files: { name: string; sizeMb: number }[], tb: TitleBlock) {
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.checkedOutBy !== ctx.userId) throw new ProtoError(r.checkedOutBy ? `Only ${r.checkedOutBy}, who holds the lock, can check in.` : "The document is not checked out.")
  const list = files.filter((f) => f.name.trim())
  if (!list.length) throw new ProtoError("Add at least one working file.", "files")
  for (const f of list) {
    const ext = f.name.split(".").pop()?.toUpperCase() ?? ""
    if (!NATIVE_TYPES.includes(ext)) throw new ProtoError(`${f.name}: file type ${ext || "(none)"} is not accepted. Allowed: ${NATIVE_TYPES.join(", ")}.`, "files")
    if (!(f.sizeMb > 0)) throw new ProtoError(`${f.name}: enter the file size.`, "files")
    if (f.sizeMb > MAX_FILE_MB) throw new ProtoError(`${f.name} is ${f.sizeMb} MB; the limit is ${MAX_FILE_MB} MB per native file.`, "files")
    const threat = scanFile(f.name)
    if (threat) throw new ProtoError(`Virus scan refused ${f.name}: ${threat}. Nothing was checked in; the file is quarantined.`, "files")
  }
  if (!tb.scale.trim() || !tb.sheet.trim()) throw new ProtoError("Title block: enter Scale and Sheet (x of y).", "titleBlock")
  if (!/^\d+ of \d+$/.test(tb.sheet.trim())) throw new ProtoError('Title block: Sheet is written "x of y", for example "1 of 3".', "titleBlock")
  const names = list.map((f) => f.name.trim())
  r.native = names
  r.files = names
  r.nativeFiles = list.map((f) => ({ name: f.name.trim(), sizeMb: f.sizeMb, checksum: fakeSha(f.name + f.sizeMb + ctx.today), scan: "Clean" as const }))
  r.checksum = fakeSha(names.join("|") + ctx.today)
  r.titleBlock = { ...r.titleBlock, ...tb, drawnBy: tb.drawnBy || r.titleBlock.drawnBy }
  r.checkedOutBy = undefined
  r.checkedOutSince = undefined
  log(x, ctx, `Checked in rev ${r.rev}: ${names.join(", ")}; virus scan clean, checksums stored; title block ${tb.size}-size, sheet ${tb.sheet}, scale ${tb.scale}${tb.project ? `, ${tb.project}` : ""} (nothing changes for consumers until release)`)
}
/** Restricted documents: access by an EAR-flag user is logged individually (Book III Part C §3). */
export function logRestrictedAccess(d: D, ctx: MutateCtx, id: string) {
  const x = doc(d, id)
  if (x.security !== "Restricted") return
  if (!hasEarFlag(ctx.userId)) throw new ProtoError(`${id} is Restricted (export-controlled): visible only to users with the EAR flag.`)
  log(x, ctx, `Viewed by ${ctx.userId} (EAR flag; Restricted access logged)`)
}
export function forceUnlock(d: D, ctx: MutateCtx, id: string, reason: string) {
  need(ctx, "Engineering Manager", "Force-releasing a lock")
  const x = doc(d, id)
  const r = currentRev(x)
  if (!r.checkedOutBy) throw new ProtoError("The document is not checked out.")
  log(x, ctx, `Lock held by ${r.checkedOutBy} force-released: ${reason} (C-17, logged)`)
  r.checkedOutBy = undefined
  r.checkedOutSince = undefined
}
export function submitDoc(d: D, ctx: MutateCtx, id: string, note: string) {
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.status !== "WIP") throw new ProtoError(`Rev ${r.rev} is ${r.status}.`)
  if (r.checkedOutBy) throw new ProtoError("Check the document in before review.")
  r.status = "In Review"
  r.rendition = r.rendition ?? `${x.id}_${r.rev}.pdf`
  if (note.trim()) r.redlines.push({ by: ctx.userId, on: ctx.today, text: note })
  log(x, ctx, `Rev ${r.rev} submitted for review`)
}
export function redline(d: D, ctx: MutateCtx, id: string, text: string) {
  const r = currentRev(doc(d, id))
  if (r.status !== "In Review") throw new ProtoError("Redlines are taken while the revision is In Review.")
  if (!text.trim()) throw new ProtoError("Enter the redline comment.")
  r.redlines.push({ by: ctx.userId, on: ctx.today, text })
}
/** Release stamps the rendition; the prior Released revision becomes Superseded [DOC:p.64 §5.2]. */
export function releaseDocRev(x: DocRecord, ctx: MutateCtx, via?: string, on = ctx.today) {
  const r = currentRev(x)
  for (const o of x.revisions) if (o !== r && o.status === "Released") o.status = "Superseded"
  r.status = "Released"
  r.releasedOn = on
  r.rendition = r.rendition ?? `${x.id}_${r.rev}.pdf`
  r.stamp = `RELEASED Rev ${r.rev} ${on}`
  r.titleBlock.approvedBy = ctx.userId
  x.activity.push({ at: on, by: ctx.role, text: `Rev ${r.rev} released${via ? ` by ${via}` : ""}; rendition stamped ${r.stamp}` })
}
export function releaseDoc(d: D, ctx: MutateCtx, id: string) {
  need(ctx, "Engineering Manager", "Releasing a document")
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.status !== "In Review") throw new ProtoError(`Rev ${r.rev} is ${r.status}; release takes an In Review revision.`)
  if (r.redlines.length && !r.titleBlock.checkedBy) r.titleBlock.checkedBy = ctx.userId
  releaseDocRev(x, ctx)
}
export function obsoleteDoc(d: D, ctx: MutateCtx, id: string, reason: string) {
  need(ctx, "Engineering Manager", "Obsoleting a document")
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.status !== "Released" && r.status !== "Superseded") throw new ProtoError(`Rev ${r.rev} is ${r.status}.`)
  for (const o of x.revisions) if (o.status === "Released") o.status = "Superseded"
  r.status = "Obsolete"
  r.stamp = `OBSOLETE Rev ${r.rev}`
  log(x, ctx, `Obsoleted: ${reason}. Excluded from all pick-up points.`)
}
export function newDocRev(d: D, ctx: MutateCtx, id: string) {
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.status !== "Released") throw new ProtoError(`A new revision starts from a Released one; rev ${r.rev} is ${r.status}.`)
  const nr = nextRev(r.rev)
  x.revisions.push({ ...structuredClone(r), rev: nr, status: "WIP", rendition: undefined, stamp: undefined, releasedOn: undefined, redlines: [], checkedOutBy: ctx.userId, checkedOutSince: ctx.today, titleBlock: { ...r.titleBlock, drawnBy: ctx.userId, checkedBy: undefined, approvedBy: undefined } })
  log(x, ctx, `Rev ${nr} started (WIP, checked out); rev ${r.rev} stays Released for consumers`)
}
export function createDoc(d: D, ctx: MutateCtx, p: { typeCode: DocRecord["typeCode"]; title: string; security: DocRecord["security"]; linkedTo: DocRef[]; erId?: string }) {
  if (!p.title.trim()) throw new ProtoError("Enter a title.", "title")
  const id = newIds.doc(d, p.typeCode)
  d.documents.unshift({
    id, typeCode: p.typeCode, title: p.title, security: p.security, createdOn: ctx.today, linkedTo: p.linkedTo, engineeringRequestId: p.erId as never,
    revisions: [{ rev: "A", status: "WIP", files: [], native: [], titleBlock: { drawnBy: ctx.userId, scale: "NTS", sheet: "1 of 1", size: "D" }, redlines: [], checksum: "not yet computed", checkedOutBy: ctx.userId, checkedOutSince: ctx.today }],
    activity: [{ at: ctx.today, by: ctx.role, text: "Created rev A (WIP, checked out)" }],
  })
  return id as string
}

// ================================================================== transmittals
export function sendTransmittal(d: D, ctx: MutateCtx, p: { erId?: string; customerId: CustomerId; soId?: SalesOrderId; purpose: TransmittalPurpose; recipients: string[]; documentIds: string[]; note?: string }) {
  if (!p.documentIds.length) throw new ProtoError("Pick at least one document.", "docs")
  if (!p.recipients.filter((r) => r.trim()).length) throw new ProtoError("Enter a recipient.", "recipients")
  const revsSent = p.documentIds.map((id) => {
    const x = doc(d, id)
    const rel = [...x.revisions].reverse().find((r) => r.status === "Released")
    if (!rel) throw new ProtoError(`${id} has no Released revision; the picker sends released revisions only.`)
    // Reading R-DOC-3: customers hold no EAR flag, so a Restricted (export-controlled) document is not sent.
    if (x.security === "Restricted") throw new ProtoError(`${id} is Restricted (export-controlled): visible only to users with the EAR flag, so it is not sent to a customer.`)
    return { documentId: x.id, rev: rel.rev }
  })
  const id = newIds.tr(d)
  d.transmittals.unshift({
    id, documentIds: revsSent.map((r) => r.documentId), revsSent, recipients: p.recipients, customerId: p.customerId, engineeringRequestId: p.erId as never, soId: p.soId, purpose: p.purpose,
    sentOn: ctx.today, sentBy: ctx.userId, createdOn: ctx.today, responses: [], note: p.note, activity: [{ at: ctx.today, by: ctx.role, text: `Sent ${p.purpose}: ${revsSent.map((r) => `${r.documentId} rev ${r.rev}`).join(", ")}` }],
  })
  const er = p.erId ? d.requests.find((r) => r.id === p.erId) : undefined
  if (er && p.purpose === "For Approval" && er.customerApprovalRequired && er.status === "In Design") {
    er.status = "Customer Review"
    log(er, ctx, `${id} sent For Approval; Customer Review`)
  }
  for (const eco of d.ecos) for (const t of eco.tasks) if (!t.done && t.text.startsWith("Customer re-approval") && p.purpose === "For Approval" && eco.docChanges.some((x) => p.documentIds.includes(x))) Object.assign(t, { done: true, doneBy: ctx.userId, doneOn: ctx.today })
  return id as string
}
export function recordResponse(d: D, ctx: MutateCtx, id: string, response: TrResponse, recipient: string) {
  const t = find(d.transmittals, id, "Transmittal")
  if (!t.sentOn) throw new ProtoError("The package has not been sent.")
  if (t.purpose !== "For Approval") throw new ProtoError(`${t.purpose} packages take no approval response.`)
  if (t.responses.some((r) => r.recipient === recipient)) throw new ProtoError(`${recipient} has already responded.`)
  t.responses.push({ recipient, response, on: ctx.today })
  log(t, ctx, `Response recorded: ${response}`)
  const er = t.engineeringRequestId ? d.requests.find((r) => r.id === t.engineeringRequestId) : undefined
  if (!er) return
  if (response === "Revise & Resubmit") {
    if (er.status === "Customer Review") er.status = "In Design"
    er.reviewLoops++
    log(er, ctx, `${id}: Revise & Resubmit; back to In Design (loop ${er.reviewLoops})`)
  } else {
    er.customerApprovalEvidence = t.id
    log(er, ctx, `${id}: ${response}; design approval milestone evidence recorded`)
    ctx.emit("engineering.designApproved", { engineeringRequestId: er.id, soId: er.soId, transmittalId: t.id, response })
  }
}

// ================================================================== ECR / ECO
export function createEcr(d: D, ctx: MutateCtx, p: Pick<EcrRecord, "title" | "source" | "classification" | "priority" | "description" | "reason"> & { affected: DocRef[]; sourceRef?: DocRef }) {
  if (!p.title.trim()) throw new ProtoError("Enter a title.", "title")
  if (!p.affected.length) throw new ProtoError("Name at least one affected object.", "affected")
  if (!p.description.trim() || !p.reason.trim()) throw new ProtoError("Describe what and why.", "description")
  const id = `ECR-2026-${pad4(next(d) - 470)}` as EcrId
  d.ecrs.unshift({
    id, title: p.title, source: p.source, sourceRef: p.sourceRef, requestedBy: ctx.userId, raisedOn: ctx.today, description: p.description, reason: p.reason, classification: p.classification, priority: p.priority,
    emergency: p.priority === "Emergency", stage: "Draft", affected: p.affected, impactSnapshot: "", narrative: "", risk: "", changes: [], docChanges: p.affected.filter((a) => a.type === "document").map((a) => a.id as never),
    impact: computeImpact(d, p.affected), activity: [{ at: ctx.today, by: ctx.role, text: `Raised (${p.source})` }],
  })
  return id as string
}
/** Impact analysis computed from this module's records; WOs, stock and POs are design values until those modules publish them. */
export function computeImpact(d: D, affected: DocRef[]): EcrRecord["impact"] {
  const ebomIds = affected.filter((a) => a.type === "ebom").map((a) => a.id)
  const eboms = d.eboms.filter((e) => ebomIds.includes(e.id))
  const cost = eboms.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.qty * (itemInfo(d, l.componentId).stdCost ?? 0), 0), 0)
  return { openWos: [], stock: [], openPos: [], openSoLines: [], costCurrent: Math.round(cost), customers: [] }
}
export function updateEcr(d: D, _ctx: MutateCtx, id: string, patch: Partial<Pick<EcrRecord, "narrative" | "risk" | "costDelta" | "changes" | "impact">>) {
  const e = find(d.ecrs, id, "ECR")
  if (e.stage !== "Draft") throw new ProtoError(`${id} is ${e.stage}; only a Draft ECR is edited.`)
  Object.assign(e, patch)
  if (patch.costDelta != null) e.impact.costSimulated = e.impact.costCurrent + patch.costDelta
}
export function simulateCost(d: D, ctx: MutateCtx, id: string) {
  const e = find(d.ecrs, id, "ECR")
  if (e.stage !== "Draft") throw new ProtoError(`${id} is ${e.stage}.`)
  let delta = 0
  for (const c of e.changes) {
    const eb = d.eboms.find((x) => x.id === c.ebomId)
    if (!eb) continue
    for (const op of c.ops) {
      const l = eb.lines.find((x) => op.kind !== "add" && x.no === op.line)
      const cost = (id: string) => itemInfo(d, id).stdCost ?? 0
      if (op.kind === "replace" && l) delta += l.qty * (cost(op.componentId) - cost(l.componentId))
      if (op.kind === "qty" && l) delta += (op.qty - l.qty) * cost(l.componentId)
      if (op.kind === "remove" && l) delta -= l.qty * cost(l.componentId)
      if (op.kind === "add") delta += op.line.qty * cost(op.line.componentId)
    }
  }
  e.costDelta = Math.round(delta)
  e.impact.costSimulated = e.impact.costCurrent + e.costDelta
  log(e, ctx, `Costing simulation: cost delta ${e.costDelta >= 0 ? "+" : ""}${e.costDelta}`)
}

/** ECO with the task checklist generated from affected objects [DOC:p.62 §4.2] (asserted). */
export function spawnEco(d: D, ctx: MutateCtx, ecrIds: EcrId[], title: string, changes: EbomChange[], docChanges: string[], emergency: boolean): EcoRecord {
  const id = `ECO-2026-${pad4(next(d) - 480)}` as EcoId
  const due = addDays(ctx.today, emergency ? 2 : 14)
  const tasks: EcoTaskX[] = []
  const t = (text: string, ownerRole: Role, x: Partial<EcoTaskX> = {}) => tasks.push({ no: tasks.length + 1, text, ownerRole, done: false, due, ...x })
  for (const c of changes) {
    const e = d.eboms.find((x) => x.id === c.ebomId)
    t(`Revise ${c.ebomId} to rev ${e ? nextRev(e.rev) : "n+1"}`, "Engineer", { link: `/engineering/boms/${c.ebomId}` })
  }
  for (const dc of docChanges) t(`Revise drawing ${dc}`, "Engineer", { link: `/engineering/documents/${dc}` })
  t("Run costing simulation", "Cost accountant")
  if (changes.some((c) => d.mboms.some((m) => m.ebomId === c.ebomId && m.status === "Active"))) t("Update MBOM (regenerate through MBOM-TRF)", "Manufacturing engineer", { link: "/engineering/mbom-transform" })
  const ecrs = d.ecrs.filter((e) => ecrIds.includes(e.id))
  if (ecrs.some((e) => e.impact.stock.length || e.impact.openPos.length)) t("Notify purchasing", "Buyer")
  if (ecrs.some((e) => e.classification === "Quality/CAPA" || e.classification === "Safety/Regulatory")) t("Update inspection plan", "Quality engineer")
  const customerApproved = changes.some((c) => {
    const e = d.eboms.find((x) => x.id === c.ebomId)
    return d.requests.some((r) => r.customerApprovalRequired && r.customerApprovalEvidence && r.checklist.some((row) => row.ref?.id === e?.id))
  })
  if (customerApproved) t("Customer re-approval (design was customer-approved)", "Document control", { mandatory: true, link: "/engineering/transmittals/new" })
  if (emergency) t("Quality Manager joint release (Immediate effectivity)", "Quality Manager", { mandatory: true })
  const touched = new Set<string>()
  for (const e of ecrs) for (const a of e.affected) if (a.type === "material") touched.add(a.id)
  for (const c of changes) {
    const e = d.eboms.find((x) => x.id === c.ebomId)
    for (const op of c.ops) {
      if (op.kind === "replace") touched.add(op.componentId)
      const l = op.kind !== "add" ? e?.lines.find((x) => x.no === op.line) : undefined
      if (l) touched.add(l.componentId)
    }
  }
  const llrImpacts = LLR_MIRROR.filter((l) => l.open).flatMap((l) => l.pos.filter((p) => touched.has(p.itemId)).map((p) => ({ llrId: l.id, poId: p.poId, itemId: p.itemId })))
  const eco: EcoRecord = {
    id, ecrIds, title, effectivity: emergency ? "Immediate" : "Date", effectiveOn: emergency ? undefined : addDays(ctx.today, 21), stage: "Open", createdOn: ctx.today,
    stockDispositions: ecrs.flatMap((e) => e.impact.stock.map((s) => ({ itemId: s.itemId, onHand: s.qty, value: s.value }))),
    woDispositions: ecrs.flatMap((e) => e.impact.openWos.map((w) => ({ woId: w.id, rev: w.rev }))), llrImpacts, tasks, changes: structuredClone(changes), docChanges: docChanges as never,
    activity: [{ at: ctx.today, by: "System", text: `Spawned from ${ecrIds.join(", ") || "mass update"}${customerApproved ? "; customer re-approval task auto-added" : ""}` }],
  }
  d.ecos.unshift(eco)
  if (emergency) requestWoHold(eco, ctx)
  return eco
}
/** Immediate effectivity: all open WOs on the old revision are blocked instantly pending disposition [DOC:p.63 §4.5]. */
function requestWoHold(e: EcoRecord, ctx: MutateCtx) {
  if (e.woHoldRequestedOn) return
  e.woHoldRequestedOn = ctx.today
  const woIds = e.woDispositions.map((w) => w.woId)
  log(e, ctx, `Immediate effectivity: On Hold requested for ${woIds.length ? woIds.join(", ") : "open WOs on the old revision (none in the impact snapshot)"} pending disposition`)
  ctx.emit("engineering.woHoldRequested", { ecoId: e.id, woIds })
}
/** Mass update: replace component A with B across selected EBOMs always creates an ECO (C-15). */
export function massReplace(d: D, ctx: MutateCtx, ebomIds: string[], from: MaterialId, to: MaterialId) {
  if (!ebomIds.length) throw new ProtoError("Select at least one EBOM.", "ebomIds")
  if (from === to) throw new ProtoError("Pick a different replacement component.", "to")
  const fi = itemInfo(d, from)
  const ti = itemInfo(d, to)
  if (ti.status === "Obsolete") throw new ProtoError(`${to} is Obsolete (C-16); pick an active replacement.`, "to")
  if (ti.uom !== fi.uom) throw new ProtoError(`${to} is stocked in ${ti.uom} and ${from} in ${fi.uom}; there is no conversion, so the quantities cannot carry over.`, "to")
  const changes: EbomChange[] = []
  for (const id of ebomIds) {
    const e = find(d.eboms, id, "EBOM")
    if (e.status === "Obsolete") throw new ProtoError(`${e.id} is Obsolete (C-16).`, "ebomIds")
    // Conflict: another open ECO already changes this EBOM's use of the component.
    const clash = d.ecos.find((x) => x.stage !== "Released" && x.changes.some((c) => c.ebomId === e.id && c.ops.some((o) => o.kind !== "add" && e.lines.some((l) => l.no === o.line && l.componentId === from))))
    if (clash) throw new ProtoError(`${clash.id} (${clash.stage}) already changes ${from} on ${e.id}. Finish or amend that ECO first so two changes do not collide.`, "conflict")
    const ops = e.lines.filter((l) => l.componentId === from).map((l) => ({ kind: "replace" as const, line: l.no, componentId: to }))
    if (ops.length) changes.push({ ebomId: e.id, ops })
  }
  if (!changes.length) throw new ProtoError(`${from} is not used in the selected EBOMs.`)
  return spawnEco(d, ctx, [], `Mass update: replace ${from} with ${to}`, changes, [], false).id
}
export function setEffectivity(d: D, ctx: MutateCtx, id: string, mode: EcoRecord["effectivity"], value?: string) {
  const e = find(d.ecos, id, "ECO")
  if (e.stage !== "Open") throw new ProtoError(`${id} is ${e.stage}.`)
  need(ctx, "Engineering Manager", "The effectivity decision")
  e.effectivity = mode
  e.effectiveOn = mode === "Date" ? value : undefined
  e.fromSerial = mode === "Serial" ? value : undefined
  const joint = e.tasks.find((t) => t.text.startsWith("Quality Manager joint release"))
  if (mode === "Date" && value && value < ctx.today) throw new ProtoError("The effectivity date is in the past; choose today or later, or Immediate.", "effectivity")
  if (mode === "Immediate" && !joint) e.tasks.push({ no: e.tasks.length + 1, text: "Quality Manager joint release (Immediate effectivity)", ownerRole: "Quality Manager", done: false, due: addDays(ctx.today, 1), mandatory: true })
  if (mode !== "Immediate" && joint && !joint.done) e.tasks = e.tasks.filter((t) => t !== joint)
  log(e, ctx, `Effectivity ${mode}${value ? ` (${value})` : ""}`)
  if (mode === "Immediate") requestWoHold(e, ctx)
}
export function completeTask(d: D, ctx: MutateCtx, id: string, no: number) {
  const e = find(d.ecos, id, "ECO")
  if (e.stage !== "Open") throw new ProtoError(`${id} is ${e.stage}.`)
  const t = e.tasks.find((x) => x.no === no)
  if (!t || t.done) throw new ProtoError("Task already done.")
  if (t.text.startsWith("Update MBOM")) throw new ProtoError(`Task #${no} is done by regenerating the MBOM in MBOM-TRF from this ECO; the MBOM is held on the ECO and releases with it.`)
  const joint = t.text.startsWith("Quality Manager joint release")
  if (joint ? ctx.role !== "Quality Manager" : ctx.role !== t.ownerRole && ctx.role !== "Engineering Manager")
    throw new ProtoError(`Task #${no} belongs to the ${t.ownerRole}${joint ? " (joint release, C-20)" : ""}. Switch "Acting as" to ${t.ownerRole}.`)
  Object.assign(t, { done: true, doneBy: ctx.userId, doneOn: ctx.today })
  log(e, ctx, `Task #${no} done: ${t.text}`)
}
export function setStockDisposition(d: D, _ctx: MutateCtx, id: string, itemId: string, decision: StockDisposition) {
  const e = find(d.ecos, id, "ECO")
  if (e.stage !== "Open") throw new ProtoError(`${id} is ${e.stage}.`)
  const r = e.stockDispositions.find((x) => x.itemId === itemId)
  if (r) r.decision = decision
}
export function setWoDisposition(d: D, _ctx: MutateCtx, id: string, woId: string, decision: WoDisposition) {
  const e = find(d.ecos, id, "ECO")
  if (e.stage !== "Open") throw new ProtoError(`${id} is ${e.stage}.`)
  const r = e.woDispositions.find((x) => x.woId === woId)
  if (r) r.decision = decision
}
export function setLlrDecision(d: D, ctx: MutateCtx, id: string, poId: string, decision: LlrDecision) {
  const e = find(d.ecos, id, "ECO")
  if (e.stage !== "Open") throw new ProtoError(`${id} is ${e.stage}.`)
  const r = e.llrImpacts.find((x) => x.poId === poId)
  if (r) r.decision = decision
  log(e, ctx, `LLR commercial decision on ${poId}: ${decision}`)
}

/** Release: the Engineering Manager releases; every new revision (EBOM, MBOM, drawings, production
 *  versions) cuts over together at effectivity, or nothing does [DOC:p.62 §4.2; p.63 §4.5; p.256].
 *  Date effectivity in the future: the release is approved now and the cutover waits for the date
 *  (stage "Awaiting effectivity", reading R-ECR-5); Serial and Immediate cut over on release. */
export function releaseEco(d: D, ctx: MutateCtx, id: string) {
  need(ctx, "Engineering Manager", "Releasing an ECO")
  const e = find(d.ecos, id, "ECO")
  if (e.stage !== "Open") throw new ProtoError(`${id} is already ${e.stage}.`)
  const blockers = ecoBlockers(e)
  if (blockers.length) throw new ProtoError(`Release refused, nothing changed: ${blockers.join(" ")}`)
  // All-or-nothing: rehearse the whole cutover on a copy first, so a problem refuses the release up front.
  const probe = structuredClone(d)
  applyCutover(probe, quiet(ctx), find(probe.ecos, id, "ECO"), ctx.today)
  e.releasedBy = ctx.userId
  if (e.effectivity === "Date" && e.effectiveOn && e.effectiveOn > ctx.today) {
    e.stage = "Awaiting effectivity"
    log(e, ctx, `Release approved; atomic cutover scheduled for ${e.effectiveOn}. Until then every consumer keeps the current revisions; documents created on or after ${e.effectiveOn} take the new ones.`)
    return "scheduled" as const
  }
  applyCutover(d, ctx, e, ctx.today)
  return "released" as const
}
/** Effectivity date reached: run the scheduled cutover. The prototype clock is fixed, so a reviewer
 *  triggers this from the ECO (design control); a real system runs it on the date. */
export function runEffectivity(d: D, ctx: MutateCtx, id: string) {
  need(ctx, "Engineering Manager", "Running the effectivity cutover")
  const e = find(d.ecos, id, "ECO")
  if (e.stage !== "Awaiting effectivity" || !e.effectiveOn) throw new ProtoError(`${id} is ${e.stage}; only a release awaiting its effectivity date is cut over.`)
  applyCutover(d, ctx, e, e.effectiveOn)
}

function applyCutover(d: D, ctx: MutateCtx, e: EcoRecord, on: string) {
  const cutover: NonNullable<EcoRecord["cutover"]> = []
  const handoffs: NonNullable<EcoRecord["handoffs"]> = []
  const materialChanges: { from: MaterialId; to: MaterialId }[] = []
  const newRev = new Map<string, string>()
  // 1. EBOM revisions
  for (const c of e.changes) {
    const eb = find(d.eboms, c.ebomId, "EBOM")
    if (eb.status === "Obsolete" || eb.status === "Superseded") throw new ProtoError(`${eb.id} is ${eb.status}; release refused, nothing changed.`)
    for (const op of c.ops) {
      if (op.kind !== "replace") continue
      const l = eb.lines.find((x) => x.no === op.line)
      if (l && l.componentId !== op.componentId && !materialChanges.some((m) => m.from === l.componentId && m.to === op.componentId)) materialChanges.push({ from: l.componentId, to: op.componentId })
    }
    const applied = applyOps(d, eb.lines, c.ops)
    if (applied.error) throw new ProtoError(`${eb.id} has ${applied.error}; release refused, nothing changed.`)
    if (eb.status === "Released") {
      const from = eb.rev
      eb.priorRevs.unshift({ rev: from, status: "Superseded", releasedOn: eb.releasedOn ?? on, supersededOn: on, reason: `${e.id} (${e.effectivity} effectivity)`, lines: eb.lines })
      eb.rev = nextRev(from)
      eb.releasedOn = on
      eb.lines = applied.lines
      eb.activity.push({ at: on, by: ctx.role, text: `Rev ${eb.rev} released atomically by ${e.id}; rev ${from} Superseded` })
      newRev.set(eb.id, eb.rev)
      cutover.push({ ref: { type: "ebom", id: eb.id }, from, to: eb.rev })
      ctx.emit("engineering.ebomReleased", { ebomId: eb.id, parentItemId: eb.parentItemId, rev: eb.rev })
    } else {
      eb.lines = applied.lines
      eb.activity.push({ at: on, by: ctx.role, text: `Lines updated by ${e.id} (EBOM still ${eb.status})` })
      cutover.push({ ref: { type: "ebom", id: eb.id }, from: eb.rev, to: eb.rev })
    }
  }
  // 2. Drawings and documents
  for (const docId of e.docChanges) {
    const x = doc(d, docId)
    const r = currentRev(x)
    const prevRel = [...x.revisions].reverse().find((v) => v.status === "Released")
    if (r.status === "WIP" && r.checkedOutBy) throw new ProtoError(`${docId} rev ${r.rev} is still checked out; release refused, nothing changed.`)
    if (r.status === "Released") x.revisions.push({ ...structuredClone(r), rev: nextRev(r.rev), status: "In Review", redlines: [] })
    releaseDocRev(x, ctx, e.id, on)
    cutover.push({ ref: { type: "document", id: x.id }, from: prevRel?.rev ?? "-", to: currentRev(x).rev })
  }
  // 3. MBOM revisions regenerated on the ECO, and 4. the production versions that pair them
  for (const staged of e.stagedMboms ?? []) {
    const eb = find(d.eboms, staged.ebomId, "EBOM")
    const prior = d.mboms.filter((m) => m.ebomId === staged.ebomId && m.plantId === staged.plantId && m.status === "Active")
    const m: MbomRecord = { ...structuredClone(staged), ebomRev: newRev.get(eb.id) ?? eb.rev, revision: prior.length ? nextRev(prior[0].revision) : "A", releasedOn: on }
    for (const o of prior) {
      o.status = "Superseded"
      o.supersededOn = on
      o.activity.push({ at: on, by: "System", text: `Superseded by ${m.id} at ${e.id} cutover` })
    }
    m.activity.push({ at: on, by: ctx.role, text: `Active at ${e.id} cutover (EBOM rev ${m.ebomRev}); cost rollup invalidation flag set for ${m.parentItemId}${prior.length ? `; ${prior.map((o) => o.id).join(", ")} Superseded` : ""}` })
    d.mboms.unshift(m)
    cutover.push({ ref: { type: "mbom", id: m.id }, from: prior[0]?.revision ?? "-", to: m.revision })
    for (const er of d.requests) {
      const row = er.checklist.find((r) => r.key === "mbom")
      if (row && er.checklist.some((r) => r.ref?.type === "ebom" && r.ref.id === eb.id)) row.ref = { type: "mbom", id: m.id }
    }
    ctx.emit("engineering.mbomActivated", { mbomId: m.id, ebomId: eb.id })
    for (const pv of d.productionVersions.filter((x) => x.status === "Released" && prior.some((o) => o.id === x.mbomId))) {
      const until = addDays(on, -1)
      pv.validTo = until < pv.validFrom ? pv.validFrom : until
      pv.status = "Superseded/Obsolete"
      const nid = `PV-TBD-${pad4(next(d))}` as never
      pv.activity.push({ at: on, by: "System", text: `Superseded/Obsolete at ${e.id} cutover; valid to ${pv.validTo}; replaced by ${nid}` })
      d.productionVersions.unshift({
        ...structuredClone(pv), id: nid, mbomId: m.id, mbomRev: m.revision, validFrom: on, validTo: undefined, status: "Released", createdOn: on,
        activity: [{ at: on, by: ctx.role, text: `Released at ${e.id} cutover: ${m.id} rev ${m.revision} paired with ${pv.routingId} rev ${pv.routingRev}, lots ${pv.lotSizeFrom}-${pv.lotSizeTo}; supersedes ${pv.id}` }],
      })
      cutover.push({ ref: { type: "productionVersion", id: nid }, from: pv.id, to: nid })
    }
  }
  // 5. Hand-offs to the owning modules: their documents post the outcomes [DOC:p.62 §4.2; p.256]
  for (const t of e.tasks) {
    if (t.text.startsWith("Update inspection plan")) handoffs.push({ what: "Inspection plan revision releases with this cutover", owner: "Quality" })
    if (t.text.startsWith("Update routing")) handoffs.push({ what: "Routing revision releases with this cutover", owner: "Planning and production" })
  }
  for (const mc of materialChanges) handoffs.push({ what: `MCH row and supersession: ${mc.from} superseded by ${mc.to}`, owner: "Materials" })
  if (e.effectivity === "Immediate" && materialChanges.length) handoffs.push({ what: `Production Block on ${materialChanges.map((m) => m.from).join(", ")} (Immediate effectivity)`, owner: "Materials" })
  for (const x of e.stockDispositions) {
    if (x.decision === "Rework") handoffs.push({ what: `Rework order (RWO) for ${x.onHand} of ${x.itemId}`, owner: "Planning and production", ref: x.itemId })
    if (x.decision === "Scrap") handoffs.push({ what: `Scrap of ${x.onHand} ${x.itemId}: posting 5320 with approval per inventory thresholds`, owner: "Inventory", ref: x.itemId })
    if (x.decision === "Return to Vendor (RTV)") handoffs.push({ what: `Return to vendor: ${x.onHand} of ${x.itemId}`, owner: "Purchasing", ref: x.itemId })
    if (x.decision === "Use-Up") handoffs.push({ what: `Use-Up: consume the remaining ${x.onHand} of ${x.itemId}; the revision flips automatically when stock reaches zero`, owner: "Inventory", ref: x.itemId })
  }
  for (const w of e.woDispositions) {
    if (w.decision === "Incorporate Change") handoffs.push({ what: `${w.woId}: change task and pick-list deltas added to the WO`, owner: "Planning and production", ref: w.woId })
    if (w.decision === "Stop & Rework") handoffs.push({ what: `${w.woId}: stopped; rework order (RWO) raised`, owner: "Planning and production", ref: w.woId })
  }
  e.stage = "Released"
  e.releasedOn = on
  e.releasedBy = e.releasedBy ?? ctx.userId
  e.cutover = cutover
  e.handoffs = handoffs
  e.materialChanges = materialChanges
  const eff = e.effectivity === "Date" ? `date ${e.effectiveOn}` : e.effectivity === "Serial" ? `serial ${e.fromSerial} onward` : "Immediate: open WOs on the old revision held pending disposition"
  e.activity.push({ at: on, by: ctx.role, text: `Released atomically (${eff}): ${cutover.map((c) => `${c.ref.id} ${c.from} to ${c.to}`).join("; ") || "task set only"}` })
  ctx.emit("engineering.ecoReleased", { ecoId: e.id, affected: cutover.map((c) => c.ref) })
  ctx.emit("engineering.ecoCutover", {
    ecoId: e.id, effectivity: e.effectivity, effectiveOn: on, fromSerial: e.fromSerial, materialChanges, productionBlock: e.effectivity === "Immediate" ? materialChanges.map((m) => m.from) : [],
    stock: e.stockDispositions.map((x) => ({ itemId: x.itemId, qty: x.onHand, decision: x.decision })), wos: e.woDispositions.map((w) => ({ woId: w.woId, decision: w.decision })),
  })
}

// ================================================================== CAD connector (IF-17, mocked)
export function resolveConflict(d: D, ctx: MutateCtx, id: string, side: "ERP" | "PDM") {
  const c = find(d.conflicts, id, "Conflict")
  if (c.resolved) throw new ProtoError("Already resolved.")
  if (ctx.role !== c.resolverRole) throw new ProtoError(`${c.field} is owned by ${c.owner}; the resolver is the ${c.resolverRole}. Switch "Acting as" to ${c.resolverRole}.`)
  c.resolved = { value: side === "ERP" ? c.erpValue : c.pdmValue, by: ctx.userId, on: ctx.today, side }
}
export function replayEvents(d: D, ctx: MutateCtx, ids: string[]) {
  const evs = d.vaultEvents.filter((e) => ids.includes(e.id) && e.state !== "Delivered")
  if (!evs.length) throw new ProtoError("Select failed, retrying or queued events to replay.")
  let ok = 0
  for (const e of evs) {
    e.attempts++
    // Vault-rule failures stay failed until the source is fixed; transport failures deliver on replay.
    if (e.error && /blocked|Broken external reference/i.test(e.error)) {
      e.state = "Failed"
      continue
    }
    e.state = "Delivered"
    e.error = undefined
    ok++
    if (e.kind === "Rendition publish" && e.ref?.type === "document") {
      const x = d.documents.find((z) => z.id === e.ref!.id)
      if (x && currentRev(x).status === "In Review") releaseDocRev(x, ctx, `PDM release (${e.vaultTx})`)
    }
  }
  return ok
}
export function simulateVault(d: D, ctx: MutateCtx, kind: "Assembly extraction" | "New part" | "Check-in", ebomId = "EBOM-TBD-0377") {
  const n = next(d)
  const vaultTx = `VTX-${884300 + n}`
  const at = `${ctx.today} ${String(9 + (n % 8)).padStart(2, "0")}:${String((n * 7) % 60).padStart(2, "0")}`
  if (kind === "Assembly extraction") {
    const src = d.proposals.find((p) => p.ebomId === ebomId && !p.committed) ?? d.proposals[0]
    const pid = `IMP-TBD-${pad4(n)}`
    d.proposals.unshift({ ...structuredClone(src), id: pid, ebomId: ebomId as never, vaultTx, createdOn: ctx.today, committed: undefined, source: "Vault assembly extraction" })
    d.vaultEvents.unshift({ id: `VE-TBD-${10500 + n}`, at, vaultTx, kind, object: `Assembly for ${ebomId}`, ref: { type: "ebom", id: ebomId }, state: "Delivered", attempts: 1, proposalId: pid })
    return pid
  }
  if (kind === "New part") {
    d.vaultEvents.unshift({ id: `VE-TBD-${10500 + n}`, at, vaultTx, kind, object: "Gasket, conservator flange (no ERP number)", state: "Delivered", attempts: 1 })
    return createPlaceholderFromCad(d, ctx, ebomId)
  }
  d.vaultEvents.unshift({ id: `VE-TBD-${10500 + n}`, at, vaultTx, kind, object: "PE-20MVA-PH2-GA.SLDDRW A.4", ref: { type: "document", id: "DOC-GA-00377" }, state: "Queued", attempts: 0 })
  return vaultTx
}
function createPlaceholderFromCad(d: D, ctx: MutateCtx, ebomId: string) {
  const pid = `RAW-TBD-PH${pad4(next(d))}` as MaterialId
  d.placeholders.push({ id: pid, description: "Gasket, conservator flange (from CAD part card)", category: "RAW", uom: "EA", estCost: 85, ebomId: ebomId as never, line: 0, engineerId: ctx.userId, createdOn: ctx.today, status: "Draft", fromCad: true })
  ctx.emit("engineering.placeholderNeeded", { engineeringRequestId: (d.eboms.find((e) => e.id === ebomId)?.engineeringRequestId ?? "ER-TBD-0000") as never, description: `${pid}: Gasket, conservator flange (CAD new-part flow, IF-17); number returned to the PDM attribute` })
  return pid
}

// ================================================================== CAD BOM import (CAD-IMP)
export type MatchState = "Matched (material code)" | "Matched (MPN)" | "Changed" | "Unmatched: placeholder proposal" | "Error"
export interface ImportRow {
  findNo: number
  partNo: string
  mpn?: string
  description: string
  qty: number
  refDes?: string
  state: MatchState
  matchId?: string
  note: string
}
const MPN_INDEX: Record<string, MaterialId> = { "MRC-FOT-8CH": "RAW-TBD-PH0412" }
export function matchRows(d: D, ebomId: string, rows: Omit<ImportRow, "state" | "note" | "matchId">[]): ImportRow[] {
  const e = d.eboms.find((x) => x.id === ebomId)
  return rows.map((r) => {
    if (!(r.qty > 0)) return { ...r, state: "Error", note: "Quantity is 0 or missing" }
    const byCode = r.partNo && (itemInfo(d, r.partNo).description !== "Unknown item" ? r.partNo : undefined)
    const byMpn = !byCode && r.mpn ? MPN_INDEX[r.mpn] : undefined
    const id = byCode || byMpn
    if (!id) return { ...r, state: "Unmatched: placeholder proposal", note: "No material by code or manufacturer part #; becomes a placeholder" }
    const cur = e?.lines.find((l) => l.no === r.findNo)
    if (cur && cur.componentId === id && cur.qty !== r.qty) return { ...r, matchId: id, state: "Changed", note: `Qty ${cur.qty} in EBOM, ${r.qty} in CAD` }
    return { ...r, matchId: id, state: byCode ? "Matched (material code)" : "Matched (MPN)", note: cur ? (cur.componentId === id ? "Same as EBOM line" : `Replaces ${cur.componentId}`) : "New line" }
  })
}
/** Transactional commit: all or nothing [DOC:p.61 §3.3] (asserted). Returns an error log on refusal. */
export function commitImport(d: D, ctx: MutateCtx, ebomId: string, rows: ImportRow[], accepted: number[], proposalId?: string) {
  const e = draftEbom(d, ebomId)
  const take = rows.filter((r) => accepted.includes(r.findNo))
  if (!take.length) throw new ProtoError("Accept at least one line.")
  const errs = take.filter((r) => r.state === "Error")
  if (errs.length) throw new ProtoError(`Commit refused, nothing changed. Error log: ${errs.map((r) => `find ${r.findNo} "${r.description}": ${r.note}`).join("; ")}`)
  let added = 0
  let placeholders = 0
  for (const r of take) {
    let comp = r.matchId as MaterialId | undefined
    if (r.state === "Unmatched: placeholder proposal") {
      comp = `RAW-TBD-PH${pad4(next(d))}` as MaterialId
      d.placeholders.push({ id: comp, description: r.description, category: "RAW", uom: "EA", estCost: 0, ebomId: e.id, line: r.findNo, engineerId: ctx.userId, createdOn: ctx.today, status: "Draft", fromCad: true })
      ctx.emit("engineering.placeholderNeeded", { engineeringRequestId: (e.engineeringRequestId ?? "ER-TBD-0000") as never, description: `${comp}: ${r.description}${r.mpn ? ` (MPN ${r.mpn})` : ""} (${e.id} find ${r.findNo}, CAD import)` })
      placeholders++
    }
    const cur = e.lines.find((l) => l.no === r.findNo)
    if (cur) Object.assign(cur, { componentId: comp!, qty: r.qty, refDes: r.refDes ?? cur.refDes, uom: itemInfo(d, comp!).uom })
    else {
      e.lines.push({ no: r.findNo, componentId: comp!, qty: r.qty, uom: itemInfo(d, comp!).uom, scrapPct: 0, refDes: r.refDes })
      added++
    }
  }
  e.lines.sort((a, b) => a.no - b.no)
  e.cadAhead = undefined
  log(e, ctx, `CAD BOM import committed: ${take.length} lines (${added} new, ${placeholders} placeholders)`)
  const p = proposalId ? d.proposals.find((x) => x.id === proposalId) : undefined
  if (p) p.committed = { on: ctx.today, by: ctx.userId, added, placeholders }
  return { added, placeholders }
}

// ================================================================== ECR: CCB submission, defer, proposed changes
/** Called when the ECR (CCB) approval request is raised in the shared engine (C-1). */
export function markEcrSubmitted(d: D, ctx: MutateCtx, id: string) {
  const e = d.ecrs.find((x) => x.id === id)
  if (!e || e.stage !== "Draft") return
  e.stage = "Submitted to CCB"
  e.submittedOn = ctx.today
  e.votes = []
  e.ccbDueBy = e.priority === "Emergency" ? addDays(ctx.today, 1) : undefined
  log(e, ctx, `Submitted to CCB: ${ccbMembers(e.costDelta).join(", ")}${e.ccbDueBy ? `; Emergency, decision due by ${e.ccbDueBy} (24 h)` : ""}`)
}
/** A CCB member's vote [DOC:p.62 §4.1]. Engineering Manager and Controller vote through the shared
 *  engine (WF-INBOX); the other members record theirs here (foundation request R-10). */
export function recordVote(d: D, ctx: MutateCtx, id: string, vote: CcbVoteValue, reason?: string) {
  const e = find(d.ecrs, id, "ECR")
  if (e.stage !== "Submitted to CCB") throw new ProtoError(`${id} is ${e.stage}; votes are taken while it is Submitted to CCB.`)
  const members = ccbMembers(e.costDelta)
  if (!members.includes(ctx.role)) throw new ProtoError(`The CCB is ${members.join(", ")}. Switch "Acting as" to a member.`)
  if ((ctx.role === "Engineering Manager" || ctx.role === "Controller") && vote !== "Defer") throw new ProtoError(`The ${ctx.role} approves or rejects in WF-INBOX (the shared approval engine, C-1).`)
  if (vote !== "Approve" && !reason?.trim()) throw new ProtoError(`${vote} needs a reason.`, "reason")
  e.votes = [...(e.votes ?? []).filter((v) => v.role !== ctx.role), { role: ctx.role, vote, by: ctx.userId, on: ctx.today, reason }]
  log(e, ctx, `CCB vote: ${ctx.role} ${vote}${reason ? `. ${reason}` : ""}`)
  settleCcb(d, ctx, e)
}
/** Outcome from the recorded votes (reading R-ECR-4: Approve needs every member; any Reject rejects; any Defer defers). */
export function settleCcb(d: D, ctx: MutateCtx, e: EcrRecord) {
  if (e.stage !== "Submitted to CCB") return
  const votes = e.votes ?? []
  const rej = votes.find((v) => v.vote === "Reject")
  const def = votes.find((v) => v.vote === "Defer")
  if (rej) {
    e.stage = "Rejected"
    e.ccbOutcome = "Reject"
    e.ccbReason = rej.reason
    log(e, ctx, `CCB: Reject (${rej.role}). ${rej.reason ?? ""}`)
  } else if (def) {
    e.stage = "Deferred"
    e.ccbOutcome = "Defer"
    e.ccbReason = def.reason
    log(e, ctx, `CCB: Defer (${def.role}). ${def.reason ?? ""}`)
  } else if (ccbMembers(e.costDelta).every((m) => votes.some((v) => v.role === m && v.vote === "Approve"))) {
    e.stage = "Approved"
    e.ccbOutcome = "Approve"
    const eco = spawnEco(d, ctx, [e.id], e.title, e.changes, e.docChanges, e.priority === "Emergency")
    e.ecoId = eco.id
    log(e, ctx, `CCB: Approve (all members); ${eco.id} spawned`)
  }
}
/** Defer: a CCB outcome [DOC:p.62 §4.1] the shared engine does not offer (Approve / Reject only), so it is recorded here (R-7). */
export function deferEcr(d: D, ctx: MutateCtx, id: string, reason: string) {
  need(ctx, "Engineering Manager", "Recording a CCB Defer")
  recordVote(d, ctx, id, "Defer", reason)
}
export function reopenEcr(d: D, ctx: MutateCtx, id: string) {
  const e = find(d.ecrs, id, "ECR")
  if (e.stage !== "Deferred") throw new ProtoError(`${id} is ${e.stage}; only a Deferred ECR is reopened.`)
  e.stage = "Draft"
  e.ccbOutcome = undefined
  e.votes = []
  e.submittedOn = undefined
  e.ccbDueBy = undefined
  log(e, ctx, "Reopened to Draft after Defer")
}
export function addEcrOp(d: D, _ctx: MutateCtx, id: string, ebomId: string, op: EbomChange["ops"][number]) {
  const e = find(d.ecrs, id, "ECR")
  if (e.stage !== "Draft") throw new ProtoError(`${id} is ${e.stage}; only a Draft ECR is edited.`)
  const eb = find(d.eboms, ebomId, "EBOM")
  if (op.kind !== "add" && !eb.lines.some((l) => l.no === op.line)) throw new ProtoError(`${eb.id} has no line ${op.line}.`)
  if (op.kind === "qty" && !(op.qty > 0)) throw new ProtoError("Quantity must be above 0.")
  let c = e.changes.find((x) => x.ebomId === eb.id)
  if (!c) e.changes.push((c = { ebomId: eb.id, ops: [] }))
  c.ops.push(op)
  if (!e.affected.some((a) => a.type === "ebom" && a.id === eb.id)) e.affected.push({ type: "ebom", id: eb.id })
}
export function removeEcrOp(d: D, _ctx: MutateCtx, id: string, ebomId: string, index: number) {
  const e = find(d.ecrs, id, "ECR")
  if (e.stage !== "Draft") throw new ProtoError(`${id} is ${e.stage}.`)
  const c = e.changes.find((x) => x.ebomId === ebomId)
  if (!c) return
  c.ops.splice(index, 1)
  if (!c.ops.length) e.changes = e.changes.filter((x) => x !== c)
}

// ================================================================== CAD: CSV proposal (CAD-IMP)
export function stageCsvProposal(d: D, ctx: MutateCtx, ebomId: string, lines: ImportRow[]) {
  const n = next(d)
  const id = `IMP-TBD-${pad4(n)}`
  d.proposals.unshift({ id, ebomId: ebomId as never, source: "CSV upload", createdOn: ctx.today, lines: lines.map(({ findNo, partNo, mpn, description, qty, refDes }) => ({ findNo, partNo, mpn, description, qty, refDes })) })
  return id
}


// ================================================================== sales kit usage [DOC:p.256 §6.1]
export function setUsage(d: D, ctx: MutateCtx, id: string, usage: "Production" | "Sales") {
  const e = draftEbom(d, id)
  if (usage === e.usage) return
  e.usage = usage
  log(e, ctx, `Usage set to ${usage}${usage === "Sales" ? " (sales kit: single level, components only, no phantoms, no nested kits)" : ""}`)
}

// ================================================================== Copy From, subtree [DOC:p.61 §3.3]
/** Copy a subtree of a Released EBOM into a Draft EBOM, re-numbering Find # and placing it under `parent`. */
export function copySubtree(d: D, ctx: MutateCtx, fromId: string, rootLine: number, toId: string, parent?: number) {
  const src = find(d.eboms, fromId, "EBOM")
  if (src.status !== "Released") throw new ProtoError("Copy From takes a Released EBOM.", "source")
  const target = draftEbom(d, toId)
  if (src.id === target.id) throw new ProtoError("Pick a different target EBOM.", "target")
  const root = src.lines.find((l) => l.no === rootLine)
  if (!root) throw new ProtoError("Choose the line to copy from.", "root")
  if (parent != null && !target.lines.some((l) => l.no === parent)) throw new ProtoError(`Line ${parent} does not exist on ${target.id}.`, "parent")
  const ids = new Set<number>([rootLine])
  for (let grew = true; grew; ) {
    grew = false
    for (const l of src.lines) if (l.parent != null && ids.has(l.parent) && !ids.has(l.no)) (ids.add(l.no), (grew = true))
  }
  const sub = src.lines.filter((l) => ids.has(l.no)).sort((a, b) => a.no - b.no)
  let n = Math.floor(Math.max(0, ...target.lines.map((l) => l.no)) / 10) * 10 + 10
  const map = new Map<number, number>()
  for (const l of sub) {
    map.set(l.no, n)
    n += 1
  }
  for (const l of sub) {
    const c = structuredClone(l)
    c.no = map.get(l.no)!
    c.parent = l.no === rootLine ? parent : map.get(l.parent!)
    c.comments = undefined
    target.lines.push(c)
  }
  target.lines.sort((a, b) => a.no - b.no)
  target.baseDesign = target.baseDesign ?? `Copy From ${src.id} rev ${src.rev} (subtree)`
  log(target, ctx, `Copied subtree of line ${rootLine} (${root.componentId}, ${sub.length} line${sub.length === 1 ? "" : "s"}) from ${src.id} rev ${src.rev}; provenance kept as Base Design`)
  return sub.length
}

// ================================================================== PDF redline layer [DOC:p.64 §5.2]
export function addMarkup(d: D, ctx: MutateCtx, id: string, p: { x: number; y: number; page: number; text: string }) {
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.status !== "In Review") throw new ProtoError(`Markups are placed on the PDF while the revision is In Review; rev ${r.rev} is ${r.status}.`)
  if (!p.text.trim()) throw new ProtoError("Enter the markup comment.", "text")
  r.redlines.push({ id: `MK-${next(d)}`, by: ctx.userId, on: ctx.today, text: p.text.trim(), page: p.page, x: p.x, y: p.y })
  log(x, ctx, `Markup added on rev ${r.rev}, sheet ${p.page}`)
}
export function resolveMarkup(d: D, ctx: MutateCtx, id: string, markupId: string, resolved: boolean) {
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.status !== "In Review") throw new ProtoError(`Rev ${r.rev} is ${r.status}; markups are read-only.`)
  const m = r.redlines.find((k) => k.id === markupId)
  if (!m) throw new ProtoError("Markup not found.")
  m.resolved = resolved
  m.resolvedBy = resolved ? ctx.userId : undefined
  log(x, ctx, `Markup ${markupId} ${resolved ? "resolved" : "reopened"}`)
}
export function reviewerApprove(d: D, ctx: MutateCtx, id: string, note: string) {
  const x = doc(d, id)
  const r = currentRev(x)
  if (r.status !== "In Review") throw new ProtoError(`Reviewer approvals are recorded while the revision is In Review; rev ${r.rev} is ${r.status}.`)
  r.reviewerApprovals = [...(r.reviewerApprovals ?? []).filter((a) => a.by !== ctx.userId), { by: ctx.userId, on: ctx.today, note: note.trim() || undefined }]
  log(x, ctx, `Reviewer approval recorded on rev ${r.rev}`)
}

// ================================================================== CAD vs EBOM [DOC:p.198 §3]
export function reviewCad(d: D, ctx: MutateCtx, assemblyId: string, note: string) {
  const c = find(d.cad, assemblyId, "Assembly")
  if (!note.trim()) throw new ProtoError("State why no structure change is needed.", "note")
  const e = find(d.eboms, c.ebomId, "EBOM")
  c.reviewed = { on: ctx.today, by: ctx.userId, note: note.trim() }
  c.alignedRev = c.vaultRev
  e.cadAhead = undefined
  log(e, ctx, `CAD assembly ${c.id} ${c.vaultRev} reviewed: ${note.trim()}`)
}
/** Stage the current vault assembly as an import proposal for CAD-IMP (Draft EBOM only; commit stays engineer-confirmed). */
export function stageAssembly(d: D, ctx: MutateCtx, assemblyId: string) {
  const c = find(d.cad, assemblyId, "Assembly")
  const e = find(d.eboms, c.ebomId, "EBOM")
  if (e.status !== "Draft") throw new ProtoError(`${e.id} is ${e.status}; extraction proposals import into a Draft EBOM. Raise an ECR for a structural change to a released EBOM.`)
  const had = d.proposals.find((p) => p.ebomId === e.id && p.vaultTx === c.vaultTx && !p.committed)
  if (had) return had.id
  const pid = `IMP-TBD-${pad4(next(d))}`
  d.proposals.unshift({ id: pid, ebomId: e.id, source: "Vault assembly extraction", vaultTx: c.vaultTx, createdOn: ctx.today, lines: structuredClone(c.lines) })
  log(e, ctx, `Vault assembly ${c.id} ${c.vaultRev} staged as import proposal ${pid}`)
  return pid
}

// ================================================================== PDM linkage [Book III Part G §4]
const pdm = (d: D, id: string) => find(d.pdm, id, "PDM link")
/** PDM release requires the linked ERP ECO task set to be release-ready (the connector checks via API). */
export function pdmReadiness(d: D, link: { linkedEco?: string }): string[] {
  if (!link.linkedEco) return ["No ERP ECO is linked to this PDM change; the release sequence needs one."]
  const eco = d.ecos.find((x) => x.id === link.linkedEco)
  if (!eco) return [`${link.linkedEco} not found.`]
  return ecoBlockers(eco)
}
export function confirmPdmEcr(d: D, ctx: MutateCtx, linkId: string) {
  const l = pdm(d, linkId)
  if (l.state !== "Change order opened") throw new ProtoError(`${l.id} is ${l.state}; the ECR proposal applies to an opened PDM change order.`)
  if (l.linkedEcr) throw new ProtoError(`${l.linkedEcr} is already linked.`)
  const x = doc(d, l.documentId)
  const id = createEcr(d, ctx, {
    title: `PDM ${l.pdmCo}: change to ${l.documentId}`, source: "Engineering", classification: "Documentation Only", priority: "Standard",
    description: `A PDM change order ${l.pdmCo} was opened on ${x.title} (vault rev ${l.vaultRev}).`, reason: `Cross-reference ${l.pdmCo}; engineer confirmed the link.`, affected: [{ type: "document", id: l.documentId }],
  })
  l.linkedEcr = id as never
  l.activity.push({ at: ctx.today, by: ctx.role, text: `ECR ${id} created and cross-referenced to ${l.pdmCo}` })
  return id
}
export function pdmRelease(d: D, ctx: MutateCtx, linkId: string) {
  const l = pdm(d, linkId)
  if (l.state !== "Release approved") throw new ProtoError(`${l.id} is ${l.state}; the release round-trip runs from Release approved.`)
  const blockers = pdmReadiness(d, l)
  if (blockers.length) throw new ProtoError(`PDM release is sequenced after the ERP ECO: ${blockers.join(" ")}`)
  const blocked = d.vaultEvents.find((e) => e.ref?.id === l.documentId && e.kind === "Release" && e.state !== "Delivered" && e.error)
  if (blocked) throw new ProtoError(`The vault rule still blocks the release set: ${blocked.error}`)
  l.state = "Released, rendition published"
  l.lastEvent = `${ctx.today} (publish)`
  l.activity.push({ at: ctx.today, by: ctx.role, text: "Rendition published; ERP ECO release now executes the atomic cutover. The floor keys off ERP effectivity, not PDM state." })
}
export function pdmReplay(d: D, ctx: MutateCtx, linkId: string) {
  const l = pdm(d, linkId)
  const ids = d.vaultEvents.filter((e) => e.ref?.id === l.documentId && e.state !== "Delivered").map((e) => e.id)
  if (!ids.length) throw new ProtoError("Nothing queued for this document.")
  const ok = replayEvents(d, ctx, ids)
  if (ok > 0) {
    l.state = "Released, rendition published"
    l.note = "Replayed (at-least-once, idempotent on the vault transaction ID); rendition delivered."
  }
  l.activity.push({ at: ctx.today, by: ctx.role, text: ok > 0 ? "Publish replayed; delivered" : "Publish replayed; still blocked by a vault rule (fix the source in the vault)" })
  return ok
}
/** ERP document follows an Obsolete-in-PDM state only after the where-used sweep warns on active usage. */
export function pdmObsolete(d: D, ctx: MutateCtx, linkId: string, reason: string) {
  const l = pdm(d, linkId)
  if (l.state !== "Obsolete in PDM") throw new ProtoError(`${l.id} is ${l.state}.`)
  if (!reason.trim()) throw new ProtoError("Enter a reason.")
  obsoleteDoc(d, ctx, l.documentId, reason)
  l.activity.push({ at: ctx.today, by: ctx.role, text: `ERP document obsoleted after the where-used sweep: ${reason}` })
}
