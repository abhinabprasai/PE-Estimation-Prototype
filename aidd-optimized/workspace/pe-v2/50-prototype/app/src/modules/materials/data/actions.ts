// Materials actions: every state change the screens make, as atomic mutates on the "materials" slice.
// A ProtoError leaves the state untouched and its message is shown to the user. Each rule names its
// PRD source; role gates exist only where a rule names the role (ASM-PERM-1), else they are readings.

import { ProtoError, store, type MutateCtx, type StoreApi } from "@/store"
import type { DocRef, Material, MaterialBlock, MaterialStatus, MaterialType, Role, UserId, VendorId } from "@/data/domain"
import { MATERIALS, TODAY, VENDORS, AVL, vendorById } from "@/data/shared"
import {
  ACCOUNTING_TASK,
  BLOCK_SETTER,
  COUNT_RULES,
  DUPLICATE_THRESHOLD,
  IR_DEVIATION_PCT,
  LIFECYCLE_NEXT,
  PRICE_CHANGE_PCT,
  SS_APPROVAL_PCT,
  TYPE_BEHAVIOR,
  addBusinessDays,
  completeness,
  docVariance,
  eoBucket,
  eoPct,
  fieldDef,
  isValuated,
  lineVariance,
  freezeMessage,
  freezingDoc,
  marginFloor,
  marginPct,
  matrixGaps,
  needsRecount,
  needsThirdCount,
  similarity,
  ssBase,
  ssDeltaPct,
  taskBlockedBy,
} from "../lib/rules"
import { TASK_FIELDS, defaultViews, emptyViews } from "./seed"
import { allMaterials, getMaterial, logChange, newMcrTasks, nextSeq, onHand, patchMaterial, rateOf, type MaterialsState } from "./state"
import type { AcctRow, CountDocRecord, CountLine, EoRunRecord, IrPriceRow, IrSource, MaterialViews, MchRecord, McrRecord, SalesPriceRow, SsReason, SupersessionRecord } from "./types"

const mutate = <T>(fn: (d: MaterialsState, ctx: MutateCtx) => T) => store.mutate("materials", fn)
const need = (ok: unknown, msg: string, field?: string) => {
  if (!ok) throw new ProtoError(msg, field)
}
const requireRole = (ctx: MutateCtx, roles: Role[], what: string) =>
  need(roles.includes(ctx.role), `${what} is done by the ${roles.join(" or ")}. Switch "Acting as" to continue.`)

// ============================================================================ MCR (§4.2, §4.3, §4.4)
export interface NewMcrInput {
  type: MaterialType
  description: string
  groupL1: string
  groupL2: string
  uom: string
  path: McrRecord["path"]
  manufacturer?: string
  mpn?: string
  estCost?: number
  duplicateNote?: string
  originRef?: DocRef
  /** QI at receipt for TRADE / SPARE (type default "Config"): drives the Quality task (RD-MM-03). */
  qi?: boolean
}
/** Fuzzy duplicate check on description (same group L1) and on manufacturer part number (§4.4). */
export function duplicateCandidates(s: MaterialsState, description: string, groupL1: string, mpn?: string) {
  const norm = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return allMaterials(s)
    .map((m) => {
      const v = s.views[m.id]
      const desc = (v?.groupPath[0] ?? "") === groupL1 ? similarity(description, m.description) : 0
      const part = mpn && mpn.trim().length >= 4 ? Math.max(0, ...(v?.mfrParts ?? []).map((p) => (norm(p.mpn) === norm(mpn) ? 1 : similarity(norm(mpn), norm(p.mpn))))) : 0
      return { m, score: Math.max(desc, part), by: part > desc ? `manufacturer part ${(v?.mfrParts ?? []).map((p) => p.mpn).join(", ")}` : "description" }
    })
    .filter((x) => x.score >= DUPLICATE_THRESHOLD - 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}
/** "New material" always starts an MCR (C-47): the number is reserved, the material sits in Draft. */
export function createMcr(i: NewMcrInput) {
  return mutate((d, ctx) => {
    need(i.description.trim().length >= 8, "Enter a short description of at least 8 characters.", "description")
    need(i.groupL1 && i.groupL2, "Choose material group levels 1 and 2.", "group")
    if (i.mpn && i.manufacturer) {
      const clash = allMaterials(d).find((m) => d.views[m.id]?.mfrParts.some((p) => p.mpn === i.mpn && p.manufacturer === i.manufacturer))
      need(!clash, `E-MM-02: ${i.manufacturer} part ${i.mpn} already exists on ${clash?.id}. Identical MPN and manufacturer is a hard block.`, "mpn")
    }
    const dup = duplicateCandidates(d, i.description, i.groupL1, i.mpn).filter((x) => x.score >= DUPLICATE_THRESHOLD)
    need(!dup.length || (i.duplicateNote ?? "").trim().length > 0, `Possible duplicate of ${dup.map((x) => x.m.id).join(", ")} (similarity at or above 0.9). Enter "not a duplicate because..." to continue.`, "duplicateNote")
    const n = nextSeq(d)
    const id = `${i.type}-TBD-N${n}` as Material["id"]
    const mcrId = `MCR-TBD-0${n}` as McrRecord["id"]
    const m: Material = { id, materialNo: id, type: i.type, description: i.description.trim(), groups: [i.type], baseUom: i.uom, status: "Draft", blocks: [], batchFlag: i.type === "RAW", valuationClass: "", profitCenterId: i.type === "TRADE" ? "PC-300" : i.type === "SPARE" || i.type === "SERV" ? "PC-400" : "PC-200" }
    d.created.push(m)
    d.views[id] = { ...emptyViews(m, [i.groupL1, i.groupL2]), mfrParts: i.mpn ? [{ manufacturer: i.manufacturer ?? "Not recorded", mpn: i.mpn, preferred: true }] : [] }
    if (i.qi != null) d.views[id].qiReceipt = i.qi
    d.mcrs.unshift({
      id: mcrId, materialId: id, requestedType: i.type, description: m.description, path: i.path, stage: "Draft", open: true, createdOn: ctx.today, createdBy: ctx.userId,
      group: `${i.groupL1} / ${i.groupL2}`, uom: i.uom, estCost: i.estCost, duplicateNote: i.duplicateNote?.trim() || undefined, originRef: i.originRef,
      tasks: newMcrTasks(i.type, ctx.today, { qi: i.qi ?? TYPE_BEHAVIOR[i.type].qiDefault.startsWith("On") }),
      activity: [{ at: ctx.today, by: ctx.role, text: `MCR created (${i.path}); number ${id} reserved in Draft` }],
    })
    logChange(d, ctx, id, "Record", "", "Number reserved (Draft)", mcrId)
    return mcrId
  })
}
/** Submit for completion: material Draft to Data Completion, task SLAs start (§4.1, §4.2). */
export function submitMcr(mcrId: string) {
  return mutate((d, ctx) => {
    const r = d.mcrs.find((x) => x.id === mcrId)
    need(r && r.stage === "Draft", "Only a Draft MCR can be submitted.")
    r!.stage = "Tasks open"
    r!.tasks = r!.tasks.map((t) => ({ ...t, slaDue: addBusinessDays(ctx.today, 2) }))
    r!.activity.unshift({ at: ctx.today, by: ctx.role, text: "Submitted for completion; tasks sent to their owners, SLA 2 business days each" })
    if (r!.materialId) {
      patchMaterial(d, r!.materialId, { status: "Data Completion" })
      logChange(d, ctx, r!.materialId, "Status", "Draft", "Data Completion", mcrId)
    }
  })
}
/** Complete my task: only the owning role; Accounting & Costing waits for Planning and Purchasing. */
export function completeTask(mcrId: string, taskId: string) {
  return mutate((d, ctx) => {
    const r = d.mcrs.find((x) => x.id === mcrId)
    need(r && r.stage === "Tasks open", "Tasks can be completed only while the MCR is open.")
    const t = r!.tasks.find((x) => x.id === taskId)!
    need(!t.done, "This task is already done.")
    requireRole(ctx, [t.ownerRole], `The ${t.view} task`)
    const blockers = taskBlockedBy(t, r!.tasks)
    need(!blockers.length, `${ACCOUNTING_TASK} needs ${blockers.join(" and ")} done first (§4.2): valuation method and first price basis depend on them.`)
    t.done = true
    t.doneOn = ctx.today
    t.doneBy = ctx.userId
    // The department completes its view: fill the fields this task owns from the type defaults.
    if (r!.materialId) {
      const m = getMaterial(d, r!.materialId)!
      const v = d.views[m.id]
      const def = defaultViews(m)
      for (const k of TASK_FIELDS[t.view] ?? []) if (v[k] == null || (Array.isArray(v[k]) && !(v[k] as unknown[]).length)) (v as unknown as Record<string, unknown>)[k] = def[k]
      if (t.view === "Accounting & Costing" && isValuated(m.type) && !d.valuations.some((x) => x.materialId === m.id))
        d.valuations.push({ materialId: m.id, plantId: "PL-TBD-01", entityId: "LE-TBD-10", valuationClass: v.valuationClass ?? "", method: v.method === "Standard" ? "Standard" : "MAV", stdCost: v.method === "Standard" ? r!.estCost : undefined, mav: v.method === "Standard" ? undefined : r!.estCost, validFrom: ctx.today })
    }
    r!.activity.unshift({ at: ctx.today, by: ctx.role, text: `${t.view} done` })
    if (r!.tasks.every((x) => x.done)) {
      r!.stage = "Ready to activate"
      r!.activity.unshift({ at: ctx.today, by: "System", text: "All tasks complete; waiting for the Materials Manager to activate" })
    }
  })
}
export function reassignTask(mcrId: string, taskId: string, userId: UserId) {
  return mutate((d, ctx) => {
    const r = d.mcrs.find((x) => x.id === mcrId)!
    const t = r.tasks.find((x) => x.id === taskId)!
    need(!t.done, "A done task cannot be reassigned.")
    need(t.ownerUserId !== userId, "The task is already assigned to that person.")
    t.ownerUserId = userId
    r.activity.unshift({ at: ctx.today, by: ctx.role, text: `${t.view} reassigned to ${userId}` })
  })
}
/** Reject to task with comments: Materials Manager reviews the assembled record (§4.2). */
export function rejectToTask(mcrId: string, taskId: string, comment: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Materials Manager"], "Rejecting an MCR back to a task")
    const r = d.mcrs.find((x) => x.id === mcrId)!
    need(r.stage === "Tasks open" || r.stage === "Ready to activate", "Only an open MCR can be sent back.")
    const t = r.tasks.find((x) => x.id === taskId)!
    t.done = false
    t.doneOn = undefined
    t.comment = comment
    t.slaDue = addBusinessDays(ctx.today, 2)
    r.stage = "Tasks open"
    r.activity.unshift({ at: ctx.today, by: ctx.role, text: `Returned to ${t.view}: ${comment}` })
  })
}
/** Activate: Materials Manager, all tasks done, V-MM-01 passes; unblocks the originating demand. */
export function activateMcr(mcrId: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Materials Manager"], "Activation")
    const r = d.mcrs.find((x) => x.id === mcrId)!
    need(r.stage === "Ready to activate", "Activation needs every task done.")
    const m = getMaterial(d, r.materialId!)!
    const c = completeness(m, d.views[m.id])
    need(c.pct === 100, `V-MM-01 failed: ${c.missing.join("; ")}.`)
    patchMaterial(d, m.id, { status: "Active" })
    r.stage = "Activated"
    r.open = false
    r.activatedOn = ctx.today
    r.activatedBy = ctx.userId
    r.activity.unshift({ at: ctx.today, by: ctx.role, text: `Activated; V-MM-01 passed${r.originRef ? `; ${r.originRef.id} unblocked` : ""}` })
    logChange(d, ctx, m.id, "Status", "Data Completion", "Active", r.id)
    ctx.emit("materials.materialActivated", { materialId: m.id, mcrId: r.id })
  })
}
/** Withdraw a Draft MCR: the only case where the Draft record may be deleted (zero references, §4.1). */
export function withdrawMcr(mcrId: string, reason: string) {
  return mutate((d, ctx) => {
    const r = d.mcrs.find((x) => x.id === mcrId)!
    need(r.stage === "Draft", "Only a Draft MCR can be withdrawn; an open one is sent back to a task instead.")
    r.stage = "Withdrawn"
    r.open = false
    r.activity.unshift({ at: ctx.today, by: ctx.role, text: `Withdrawn: ${reason}; Draft number released` })
    if (r.materialId) {
      d.created = d.created.filter((m) => m.id !== r.materialId)
      delete d.views[r.materialId]
      r.materialId = undefined
    }
  })
}

// ============================================================================ material lifecycle and blocks
export interface WhereUsedHit {
  kind: string
  ref: string
  note?: string
  /** Blocks Obsolete under V-MM-20 (open documents and live master rows). */
  open: boolean
}
/** Where-used sweep (§4.4 "Reference-data protection" [DOC:p.151]): stock, open POs / WOs / SOs,
 *  BOM lines, price rows, info records, source lists, inspection plans, open supersessions, MCHs and
 *  count documents. Documents held only in other modules are listed from the material's references. */
export function whereUsedSweep(d: MaterialsState, id: string, today: string): WhereUsedHit[] {
  const out: WhereUsedHit[] = []
  const qty = onHand(d, id)
  if (qty) out.push({ kind: "Stock", ref: `${qty} on hand`, note: [...new Set(d.stock.filter((r) => r.materialId === id && r.qty > 0).map((r) => `${r.warehouseId} ${r.status}`))].join(", "), open: true })
  for (const w of d.views[id]?.whereUsed ?? []) out.push({ kind: w.kind, ref: w.ref, note: w.note, open: !/^(Last |Production version)/.test(w.kind) })
  for (const ir of d.infoRecords.filter((x) => x.materialId === id && irStatus(d, x.id, today) === "Active")) out.push({ kind: "Info record", ref: ir.id, note: ir.vendorId, open: true })
  for (const r of d.sourceList.filter((x) => x.materialId === id && !x.blocked && (!x.validTo || x.validTo >= today))) out.push({ kind: "Source list row", ref: r.vendorId, note: r.fixed ? "Fixed" : undefined, open: true })
  for (const p of d.salesPrices.filter((x) => x.materialId === id && (x.status === "Active" || x.status === "Pending Approval" || x.status === "Draft"))) out.push({ kind: "Price row", ref: p.priceListId ?? p.customerId ?? p.id, note: `${p.status} from ${p.validFrom}`, open: true })
  for (const plan of d.views[id]?.plans ?? []) if (!out.some((x) => x.ref === plan)) out.push({ kind: "Inspection plan", ref: plan, open: true })
  for (const s of d.supersessions.filter((x) => (x.predecessorId === id || x.successorId === id) && x.stage !== "Closed" && x.stage !== "Rejected")) out.push({ kind: "Supersession", ref: s.id, note: s.stage, open: s.stage !== "Approved, run-out" || s.predecessorId !== id })
  for (const c of d.mchs.filter((x) => x.rows.some((r) => r.materialId === id && !r.appliedAt) && ["Draft", "In approval", "Approved", "Scheduled"].includes(x.stage))) out.push({ kind: "Change request", ref: c.id, note: c.stage, open: true })
  for (const c of d.countDocuments.filter((x) => x.status !== "Posted" && x.status !== "Void" && x.lines.some((l) => l.itemId === id))) out.push({ kind: "Count document", ref: c.id, note: c.status, open: true })
  return out
}
/** Lifecycle change per §4.1 (RD-MM-08: pressed by the Materials Manager). Obsolete needs V-MM-20. */
export function setLifecycle(id: string, to: MaterialStatus, reason: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Materials Manager"], "A lifecycle change")
    const m = getMaterial(d, id)!
    need(LIFECYCLE_NEXT[m.status].includes(to), `${m.status} cannot move to ${to} (§4.1).`)
    need(to !== "Active" || m.status !== "Data Completion", "Data Completion becomes Active only through MCR activation.")
    if (to === "Obsolete") {
      need(onHand(d, id) === 0, `V-MM-20: stock must be zero before Obsolete (on hand ${onHand(d, id)}).`)
      const open = whereUsedSweep(d, id, ctx.today).filter((x) => x.open && x.kind !== "Stock")
      need(!open.length, `V-MM-20: the where-used sweep must be empty; ${open.length} open reference(s), for example ${open[0]?.kind} ${open[0]?.ref}.`)
    }
    patchMaterial(d, id, { status: to, blocks: to === "Obsolete" ? [] : m.blocks })
    logChange(d, ctx, id, "Status", m.status, to, `Screen (${reason})`)
  })
}
/** Reject (Data Completion) or Delete (Draft): transition names with no status row (K-16, RD-MM-23). */
export function endMaterial(id: string, how: "Rejected" | "Deleted", reason: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Materials Manager"], how === "Rejected" ? "Rejecting a material" : "Deleting a Draft material")
    const m = getMaterial(d, id)
    need(m, `Material ${id} not found.`)
    need(reason.trim(), "Enter the reason.", "reason")
    if (how === "Rejected") need(m!.status === "Data Completion", "Reject ends a material in Data Completion (§4.1).")
    else {
      need(m!.status === "Draft", "Physical delete is allowed only in Draft (§4.1).")
      const refs = whereUsedSweep(d, id, ctx.today)
      need(!refs.length, `Delete needs zero references; ${refs.length} found, for example ${refs[0]?.kind} ${refs[0]?.ref}.`)
    }
    d.ended.push({ materialId: m!.id, how, on: ctx.today, by: ctx.userId, reason: reason.trim() })
    for (const r of d.mcrs.filter((x) => x.materialId === id && x.open)) {
      r.stage = how === "Rejected" ? "Rejected" : "Withdrawn"
      r.open = false
      r.activity.unshift({ at: ctx.today, by: ctx.role, text: `Material ${how.toLowerCase()}: ${reason.trim()}` })
    }
    logChange(d, ctx, id, "Status", m!.status, how, `Screen (${reason.trim()})`)
  })
}
/** Function-specific block chip (§4.5): additive, on Active or Restricted, set by the named role. */
export function setBlock(id: string, block: MaterialBlock, reason: string) {
  return mutate((d, ctx) => {
    const m = getMaterial(d, id)!
    need(m.status === "Active" || m.status === "Restricted", "Blocks apply to Active or Restricted materials (§4.5).")
    requireRole(ctx, [BLOCK_SETTER[block].role], block)
    need(!m.blocks.some((b) => b.block === block), `${block} is already set.`)
    patchMaterial(d, id, { blocks: [...m.blocks, { block, reason, setBy: ctx.userId, on: ctx.today }] })
    logChange(d, ctx, id, block, "", `set: ${reason}`, "Screen (Set block)")
  })
}
export function removeBlock(id: string, block: MaterialBlock) {
  return mutate((d, ctx) => {
    const m = getMaterial(d, id)!
    requireRole(ctx, [BLOCK_SETTER[block].role], `Removing ${block}`)
    patchMaterial(d, id, { blocks: m.blocks.filter((b) => b.block !== block) })
    logChange(d, ctx, id, block, "set", "removed", "Screen (Remove block)")
  })
}
/** Class 1 field edit by the owner role (§4.4); Class 2 goes through an MCH. */
export function saveClass1(id: string, key: keyof MaterialViews, value: string) {
  return mutate((d, ctx) => {
    const f = fieldDef(key)
    need(f && f.cls === 1, "Only Class 1 fields are edited in place; Class 2 changes run as an MCH.")
    // Only the owning role's screens edit a field group; every other view is read-only (§3.2 [DOC:p.141]).
    requireRole(ctx, [f!.owner], `Editing ${f!.label}`)
    const v = d.views[id]
    const old = String(v[key] ?? "")
    ;(v as unknown as Record<string, unknown>)[key] = f!.numeric ? Number(value) : value
    logChange(d, ctx, id, f!.label, old, value, "Screen (Class 1 edit)")
  })
}

// ============================================================================ MCH (§4.4, §16.1)
export interface MchRowDraft {
  materialId: string
  old: string
  new: string
  error?: string
}
export function readField(d: MaterialsState, materialId: string, key: string): string {
  const m = getMaterial(d, materialId)
  if (!m) return ""
  if (key === "profitCenterId") return m.profitCenterId
  const v = d.views[materialId] as unknown as Record<string, unknown> | undefined
  const raw = v?.[key]
  if (typeof raw === "boolean") return raw ? "Yes" : "No"
  return raw == null ? "" : String(raw)
}
/** Per-row validation in the simulation grid; failing rows are excluded and listed (§16.1). */
export function validateMchRow(d: MaterialsState, materialId: string, key: string, value: string): string | undefined {
  const m = getMaterial(d, materialId)
  if (!m) return "Material not found"
  if (m.status === "Obsolete") return "Obsolete materials are not changed"
  if (key === "mrpType" && (m.type === "NSTK" || m.type === "SERV") && value !== "None") return "V-MM-07: NSTK and SERV are forced to MRP type None"
  if (key === "procurement" && m.type === "RAW" && value !== "Buy") return "Type matrix: RAW is purchased only (§2.2)"
  if (key === "method" && (m.type === "SEMI" || m.type === "FIN") && value !== "Standard") return "§5.4: Standard is mandatory for make items"
  if ((key === "method" || key === "valuationClass" || key === "profitCenterId") && !isValuated(m.type)) return `${m.type} is not valuated`
  if (key === "plannedDeliveryDays" && (Number.isNaN(Number(value)) || Number(value) <= 0)) return "Enter a positive number of days"
  if (readField(d, materialId, key) === value) return "No change (new value equals current value)"
  return undefined
}
export function computeNew(old: string, mode: MchRecord["mode"], value: string, find?: string): string {
  if (mode === "Adjust %") {
    const n = Number(old)
    return Number.isNaN(n) ? old : String(Math.round(n * (1 + Number(value) / 100) * 100) / 100)
  }
  if (mode === "Find/replace") return find ? old.split(find).join(value) : old
  return value
}
export function createMch(i: { title: string; fieldKey: string; mode: MchRecord["mode"]; rows: MchRowDraft[]; apply: MchRecord["apply"]; effective?: string; reason: string; ecoRef?: string }) {
  return mutate((d, ctx) => {
    const f = fieldDef(i.fieldKey)
    need(f && f.cls !== 3, "Class 3 fields are never editable; the change is a supersession (§4.4).")
    const good = i.rows.filter((r) => !r.error)
    need(good.length > 0, "Every row failed validation; nothing to submit.")
    need(i.reason.trim(), "Enter the reason for the change.", "reason")
    need(i.apply === "Immediate" || (i.effective && i.effective > ctx.today), "An effective-dated change needs a future date.", "effective")
    const id = `MCH-2026-00${nextSeq(d)}` as MchRecord["id"]
    d.mchs.unshift({
      id, title: i.title || `${f!.label}: ${good.length} materials`, stage: "Draft", fieldKey: i.fieldKey, fieldClass: f!.cls as 1 | 2, mode: i.mode, apply: i.apply, effective: i.effective, approvalRefs: [],
      rows: good.map((r) => ({ materialId: r.materialId as Material["id"], field: f!.label, old: r.old, new: r.new })),
      excluded: i.rows.filter((r) => r.error).map((r) => ({ materialId: r.materialId as Material["id"], reason: r.error! })),
      reason: i.reason.trim(), ecoRef: i.ecoRef, createdOn: ctx.today, createdBy: ctx.userId, log: [],
      activity: [{ at: ctx.today, by: ctx.role, text: `Created from the simulation: ${good.length} rows, ${i.rows.length - good.length} excluded; Class ${f!.cls}` }],
    })
    return id
  })
}
function applyRows(d: MaterialsState, ctx: MutateCtx, c: MchRecord) {
  let errors = 0
  for (const r of c.rows) {
    if (r.appliedAt) continue
    const err = validateMchRow(d, r.materialId, c.fieldKey, r.new)
    if (err && !err.startsWith("No change")) {
      errors++
      c.log.push(`${ctx.today} row ${r.materialId} failed: ${err}`)
      continue
    }
    if (c.fieldKey === "profitCenterId") patchMaterial(d, r.materialId, { profitCenterId: r.new as Material["profitCenterId"] })
    else {
      const v = d.views[r.materialId] as unknown as Record<string, unknown>
      const f = fieldDef(c.fieldKey)!
      v[c.fieldKey] = c.fieldKey === "sellable" ? r.new === "Yes" : f.numeric ? Number(r.new) : r.new
    }
    r.appliedAt = ctx.today
    c.log.push(`${ctx.today} row ${r.materialId} applied`)
    logChange(d, ctx, r.materialId, r.field, r.old, r.new, c.id)
  }
  c.stage = errors ? "Applied with errors" : "Applied"
  c.activity.unshift({ at: ctx.today, by: ctx.role, text: `Applied: ${c.rows.length - errors} rows${errors ? `, ${errors} failed` : ""}` })
}
/** Apply now or effective-dated. Class 1 applies by the owner; Class 2 needs an approved request. */
export function applyMch(id: string, now = false) {
  return mutate((d, ctx) => {
    const c = d.mchs.find((x) => x.id === id)!
    if (c.fieldClass === 2) need(c.stage === "Approved" || c.stage === "Scheduled", "A Class 2 change applies only after approval through WF-INBOX.")
    else need(c.stage === "Draft" || c.stage === "Scheduled", "This change is not waiting to be applied.")
    if (c.apply === "Effective-dated" && c.effective && c.effective > ctx.today && !now) {
      c.stage = "Scheduled"
      c.activity.unshift({ at: ctx.today, by: ctx.role, text: `Scheduled for ${c.effective}` })
      return
    }
    applyRows(d, ctx, c)
  })
}
export function discardMch(id: string) {
  return mutate((d) => {
    const c = d.mchs.find((x) => x.id === id)!
    need(c.stage === "Draft", "Only a Draft change can be discarded.")
    d.mchs = d.mchs.filter((x) => x.id !== id)
  })
}

// ============================================================================ supersession (§4.6)
export function createSupersession(i: { predecessorId: string; successorId: string; policy: SupersessionRecord["policy"]; effective: string; relationship: SupersessionRecord["relationship"]; reason: string; disposition?: SupersessionRecord["disposition"] }) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Materials Manager"], "Starting a supersession")
    const p = getMaterial(d, i.predecessorId)
    const s = getMaterial(d, i.successorId)
    need(p && s, "Choose both materials.")
    need(i.predecessorId !== i.successorId, "Predecessor and successor must differ.")
    need(["Active", "Restricted", "Blocked"].includes(p!.status), "Supersede is enabled for Active, Restricted or Blocked materials (§3.14).")
    need(!d.supersessions.some((x) => x.predecessorId === i.predecessorId && x.stage !== "Closed" && x.stage !== "Rejected"), `${i.predecessorId} already has an open supersession.`)
    need(i.reason.trim(), "Enter the reason.", "reason")
    const id = `SUP-2026-00${nextSeq(d)}` as SupersessionRecord["id"]
    d.supersessions.unshift({
      id, predecessorId: p!.id, successorId: s!.id, policy: i.policy, effective: i.effective, relationship: i.relationship, stage: "Draft", reason: i.reason.trim(), disposition: i.policy === "Immediate" ? i.disposition ?? "Rework" : undefined,
      startQty: onHand(d, p!.id), createdOn: ctx.today, tasks: [], activity: [{ at: ctx.today, by: ctx.role, text: "Supersession record created" }],
    })
    return id
  })
}
export function updateSupersession(id: string, patch: Partial<Pick<SupersessionRecord, "policy" | "effective" | "disposition">>) {
  return mutate((d) => {
    const s = d.supersessions.find((x) => x.id === id)!
    need(s.stage === "Draft", "Run-out policy is fixed once the record is sent for approval.")
    Object.assign(s, patch)
    if (s.policy !== "Immediate") s.disposition = undefined
    else s.disposition ??= "Rework"
  })
}
export function toggleSupTask(id: string, taskId: string) {
  return mutate((d, ctx) => {
    const s = d.supersessions.find((x) => x.id === id)!
    need(s.stage === "Approved, run-out", "Worklist items are worked after approval.")
    const t = s.tasks.find((x) => x.id === taskId)!
    t.done = !t.done
    s.activity.unshift({ at: ctx.today, by: ctx.role, text: `${t.doc}: ${t.done ? "done" : "reopened"}` })
  })
}
/** Immediate switch: remaining predecessor stock routes to the chosen disposition (§4.6). */
export function executeDisposition(id: string) {
  return mutate((d, ctx) => {
    const s = d.supersessions.find((x) => x.id === id)!
    need(s.stage === "Approved, run-out" && s.policy === "Immediate", "Disposition runs only for an approved Immediate supersession.")
    const rows = d.stock.filter((r) => r.materialId === s.predecessorId && r.qty > 0 && r.bucket !== "Consignment")
    need(rows.length, "No predecessor stock left to disposition.")
    const qty = rows.reduce((a, r) => a + r.qty, 0)
    const notes = rows.map((r) => applyFreeze(d, ctx, r.warehouseId, r.bin, r.materialId, -r.qty)).filter(Boolean)
    for (const r of rows) r.qty = 0
    if (notes.length) s.activity.unshift({ at: ctx.today, by: "System", text: notes.join("; ") })
    s.activity.unshift({ at: ctx.today, by: ctx.role, text: `${qty} ${s.predecessorId} routed to ${s.disposition}` })
    for (const t of s.tasks) if (t.kind === "Stock") t.done = true
  })
}
/** Close: predecessor to Obsolete when V-MM-20 holds (zero stock, all worklist items closed). */
export function closeSupersession(id: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Materials Manager"], "Closing a supersession")
    const s = d.supersessions.find((x) => x.id === id)!
    need(s.stage === "Approved, run-out", "Only an approved supersession in run-out can be closed.")
    const left = onHand(d, s.predecessorId)
    need(left === 0, `V-MM-20: ${left} ${s.predecessorId} still on hand; run-out is not complete.`)
    need(s.tasks.every((t) => t.done), "V-MM-20: close every affected document on the worklist first.")
    s.stage = "Closed"
    s.closedOn = ctx.today
    const p = getMaterial(d, s.predecessorId)!
    patchMaterial(d, p.id, { status: "Obsolete", blocks: [] })
    logChange(d, ctx, p.id, "Status", p.status, "Obsolete", s.id)
    s.activity.unshift({ at: ctx.today, by: ctx.role, text: "Closed; predecessor Obsolete" })
  })
}

/** Document behaviour on approval (§4.6 [DOC:p.152], RD-MM-30): MRP flips proposals; buyer tasks for
 *  open POs on the predecessor; BOM lines flip per ECO effectivity; customer part cross-references
 *  carry to the successor; predecessor stock follows the run-out policy. */
export function supersessionWorklist(d: MaterialsState, s: SupersessionRecord): Omit<SupersessionRecord["tasks"][number], "id">[] {
  const out: Omit<SupersessionRecord["tasks"][number], "id">[] = [
    { doc: "MRP", kind: "Planning", action: `Flip new proposals to ${s.successorId} ${s.policy === "Use-up" ? "after predecessor stock is consumed" : "now"}`, done: s.policy === "Immediate" },
  ]
  for (const w of d.views[s.predecessorId]?.whereUsed ?? []) {
    if (/PO/.test(w.kind) && !/^Last/.test(w.kind)) out.push({ doc: w.ref, kind: "Open PO", action: `Buyer: ${s.policy === "Immediate" ? "cancel or change the line to " + s.successorId : "receive and close; no new lines for the predecessor"}`, done: false })
    else if (/BOM/.test(w.kind)) out.push({ doc: w.ref, kind: "BOM line", action: `Flip ${w.kind.replace(/^.*BOM /, "")} to ${s.successorId} per ECO effectivity${s.policy === "Use-up" ? " when predecessor stock is exhausted" : ""}`, done: false })
    else if (/Sales order|xref/i.test(w.kind)) out.push({ doc: w.ref, kind: "Sales xref", action: `Carry the customer part number cross-reference to ${s.successorId}`, done: false })
  }
  for (const p of d.salesPrices.filter((x) => x.materialId === s.predecessorId && x.kind === "Customer" && x.status === "Active"))
    if (!out.some((x) => x.doc === `Customer part xref ${p.customerId}`)) out.push({ doc: `Customer part xref ${p.customerId}`, kind: "Sales xref", action: `Carry the customer part number cross-reference to ${s.successorId}`, done: false })
  if (onHand(d, s.predecessorId) > 0) out.push({ doc: s.predecessorId, kind: "Stock", action: s.policy === "Immediate" ? `Disposition remaining stock: ${s.disposition ?? "Rework"}` : "Consume predecessor stock before the successor (use-up)", done: false })
  return out
}

// ============================================================================ info records and source list (§7.2, §7.4)
export function irStatus(d: Pick<MaterialsState, "infoRecords">, irId: string, today: string): "Active" | "Expired" | "Blocked" {
  const ir = d.infoRecords.find((x) => x.id === irId)!
  const v = vendorById(ir.vendorId)
  const avl = AVL.find((a) => a.itemId === ir.materialId && a.vendorId === ir.vendorId)
  if (!v || v.onboarding !== "Active" || v.quality === "Disqualified" || avl?.status === "Suspended") return "Blocked"
  const live = ir.priceRows.filter((r) => !r.pending)
  const cur = live.find((r) => r.validFrom <= today && (!r.validTo || r.validTo >= today))
  return cur ? "Active" : "Expired"
}
export function currentPrice(ir: MaterialsState["infoRecords"][number], today: string) {
  return ir.priceRows.filter((r) => !r.pending && r.validFrom <= today && (!r.validTo || r.validTo >= today)).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
}
/** New price row: effective-dated, history immutable, no overlap (V-MM-31). Manual above 5% delta
 *  waits for the Purchasing Manager (no approval kind yet: README R-3). */
export function addPriceRow(irId: string, i: { price: number; validFrom: string; source: IrSource; ref?: string }) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Buyer", "Purchasing Manager"], "Maintaining info record prices")
    const ir = d.infoRecords.find((x) => x.id === irId)!
    need(i.price > 0, "Enter a price above zero.", "price")
    need(i.validFrom >= ctx.today, "Validity starts today or later; history is never edited (C-50).", "validFrom")
    need(i.source !== "RFQ Award" || !!i.ref?.trim(), "An RFQ award row names the RFQ.", "ref")
    const basis = currentPrice(ir, ctx.today)?.price ?? ir.price
    const delta = Math.abs(i.price - basis) / basis * 100
    const pending = i.source === "Manual" && delta > IR_DEVIATION_PCT
    if (!pending) {
      for (const r of ir.priceRows) if (!r.pending && (!r.validTo || r.validTo >= i.validFrom) && r.validFrom < i.validFrom) r.validTo = dayBefore(i.validFrom)
      need(!ir.priceRows.some((r) => !r.pending && r.validFrom === i.validFrom), "V-MM-31: a row already starts on that date.", "validFrom")
      ir.price = i.price
      ir.validFrom = i.validFrom
      ir.validTo = undefined
    }
    const row: IrPriceRow = { id: `${ir.id}-P${ir.priceRows.length + 1}`, price: i.price, validFrom: i.validFrom, source: i.source, ref: i.ref, pending, createdBy: ctx.userId }
    ir.priceRows.push(row)
    return { pending, delta }
  })
}
/** Withdraw a manual row still waiting for the Purchasing Manager (it never priced anything). Until
 *  request R-3 adds the approval kind, this is the only way a pending row leaves the list. */
export function withdrawPriceRow(irId: string, rowId: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Buyer", "Purchasing Manager"], "Withdrawing a pending price row")
    const ir = d.infoRecords.find((x) => x.id === irId)!
    const row = ir.priceRows.find((r) => r.id === rowId)
    need(row?.pending, "Only a row waiting for approval can be withdrawn; released history is never edited (C-50).")
    ir.priceRows = ir.priceRows.filter((r) => r.id !== rowId)
  })
}
const dayBefore = (iso: string) => {
  const dt = new Date(iso + "T12:00:00Z")
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}
export function expireIr(irId: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Buyer", "Purchasing Manager"], "Expiring an info record")
    const ir = d.infoRecords.find((x) => x.id === irId)!
    need(irStatus(d, irId, ctx.today) === "Active", "Only an Active info record can be expired.")
    for (const r of ir.priceRows) if (!r.pending && (!r.validTo || r.validTo >= ctx.today)) r.validTo = ctx.today
    ir.validTo = ctx.today
  })
}
export function createIr(i: { materialId: string; vendorId: string; price: number; leadDays: number; source: IrSource; ref?: string; vendorPart?: string }) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Buyer", "Purchasing Manager"], "Creating an info record")
    const v = vendorById(i.vendorId)
    need(v, "Choose a vendor.", "vendor")
    need(v!.onboarding === "Active", `Vendor must be Active (onboarding is ${v!.onboarding}) (§7.2).`, "vendor")
    const m = getMaterial(d, i.materialId)
    need(m && m.status !== "Obsolete" && m.status !== "Draft", "Choose a material that is not Draft or Obsolete.", "material")
    need(!d.infoRecords.some((x) => x.materialId === i.materialId && x.vendorId === i.vendorId && x.entityId === "LE-TBD-10" && irStatus(d, x.id, ctx.today) !== "Expired"), "V-MM-30: one active info record per material, vendor and entity.", "vendor")
    need(i.price > 0 && i.leadDays > 0, "Enter a price and a planned delivery time.", "price")
    const id = `IRC-00${4200 + nextSeq(d)}` as MaterialsState["infoRecords"][number]["id"]
    d.infoRecords.unshift({
      id, materialId: i.materialId as Material["id"], vendorId: i.vendorId as VendorId, entityId: "LE-TBD-10", price: i.price, currency: v!.currency, leadDays: i.leadDays, validFrom: ctx.today, priceUnit: 1, vendorPart: i.vendorPart,
      priceRows: [{ id: `${id}-P1`, price: i.price, validFrom: ctx.today, source: i.source, ref: i.ref, createdBy: ctx.userId }], scales: [], actuals: [],
    })
    return id
  })
}
const overlaps = (a: { validFrom: string; validTo?: string }, b: { validFrom: string; validTo?: string }) => a.validFrom <= (b.validTo ?? "9999") && b.validFrom <= (a.validTo ?? "9999")
/** Source list row: vendor must hold an Active info record (V-MM-33). */
export function addSourceRow(i: { materialId: string; vendorId: string; validFrom: string; validTo?: string; mrpRelevant: boolean }) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Purchasing Manager"], "Maintaining source lists")
    need(i.validFrom && (!i.validTo || i.validTo >= i.validFrom), "Valid To must be on or after Valid From.", "validTo")
    const ir = d.infoRecords.find((x) => x.materialId === i.materialId && x.vendorId === i.vendorId)
    need(ir && irStatus(d, ir.id, ctx.today) === "Active", "V-MM-33: the vendor must hold an Active info record for this material.", "vendor")
    const avl = AVL.find((a) => a.itemId === i.materialId && a.vendorId === i.vendorId)
    need(!d.views[i.materialId]?.vendorQualReq || !AVL.some((a) => a.itemId === i.materialId) || avl, "Vendor qualification is required for this material and the vendor has no AVL row.", "vendor")
    d.sourceList.push({ id: `SL-${nextSeq(d)}`, materialId: i.materialId as Material["id"], vendorId: i.vendorId as VendorId, validFrom: i.validFrom, validTo: i.validTo, fixed: false, blocked: false, mrpRelevant: i.mrpRelevant })
  })
}
/** Fix source for period: exactly one Fixed row per period (V-MM-34). */
export function fixSource(rowId: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Purchasing Manager"], "Fixing a source")
    const r = d.sourceList.find((x) => x.id === rowId)!
    need(!r.blocked, "A blocked source cannot be the fixed source.")
    const clash = d.sourceList.filter((x) => x.id !== r.id && x.materialId === r.materialId && x.fixed && overlaps(x, r))
    for (const x of clash) x.fixed = false
    r.fixed = !r.fixed
    return clash.map((x) => x.vendorId)
  })
}
/** Block source: explicit negative, hard block at PO entry (E-MM-35). */
export function blockSource(rowId: string, note: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Purchasing Manager"], "Blocking a source")
    const r = d.sourceList.find((x) => x.id === rowId)!
    r.blocked = !r.blocked
    if (r.blocked) {
      r.fixed = false
      r.note = note
    }
  })
}
export function toggleMrpRelevant(rowId: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Purchasing Manager"], "Changing MRP relevance")
    const r = d.sourceList.find((x) => x.id === rowId)!
    r.mrpRelevant = !r.mrpRelevant
  })
}

// ============================================================================ account determination (§5.2, §5.3)
export function classesInUse(d: MaterialsState) {
  const map = new Map<string, string[]>()
  for (const m of allMaterials(d)) {
    if (m.status === "Obsolete" || !isValuated(m.type)) continue
    const vc = d.views[m.id]?.valuationClass
    if (!vc) continue
    map.set(vc, [...(map.get(vc) ?? []), m.id])
  }
  return map
}
const sameKey = (a: AcctRow, b: AcctRow) => a.eventKey === b.eventKey && a.valuationClass === b.valuationClass && a.qualifier === b.qualifier
/** Rows valid at a posting date: per key, the released version with the latest Valid From on or
 *  before that date. Postings always use the version valid at the posting date (§5.3 [DOC:p.154]). */
export const liveRows = (rows: AcctRow[], date: string = TODAY) => {
  const eligible = rows.filter((r) => (r.state === "Released" || r.state === "Superseded") && (r.validFrom ?? "0000") <= date)
  return eligible.filter((r) => !eligible.some((o) => o !== r && sameKey(o, r) && ((o.validFrom ?? "0000") > (r.validFrom ?? "0000") || ((o.validFrom ?? "0000") === (r.validFrom ?? "0000") && o.version > r.version))))
}
/** Released rows whose replacement is released with a future effective date. */
export const scheduledRows = (rows: AcctRow[], date: string = TODAY) => rows.filter((r) => r.state === "Released" && (r.validFrom ?? "0000") > date)
export const candidateRows = (rows: AcctRow[]) => {
  const marked = rows.filter((r) => r.state === "Marked")
  return [...liveRows(rows).filter((r) => !marked.some((m) => sameKey(m, r))), ...marked]
}
export function addDraftRow(i: { eventKey: string; valuationClass?: string; qualifier?: string; drKey: string; crKey: string; note?: string }) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller", "Cost accountant"], "Drafting matrix rows")
    need(i.drKey.trim() && i.crKey.trim(), "Enter the debit and credit account keys.", "drKey")
    need(!d.acctDetermination.some((r) => (r.state === "Draft" || r.state === "Marked") && r.eventKey === i.eventKey && r.valuationClass === i.valuationClass && r.qualifier === i.qualifier), "A draft row for that key, class and qualifier already exists.")
    const v = Math.max(...d.acctDetermination.map((r) => r.version)) + (d.acctDetermination.some((r) => r.state === "Draft" || r.state === "Marked") ? 0 : 1)
    d.acctDetermination.push({ id: `ADM-${nextSeq(d)}`, eventKey: i.eventKey, valuationClass: i.valuationClass || undefined, qualifier: i.qualifier || undefined, drKey: i.drKey.trim(), crKey: i.crKey.trim(), version: v, state: "Draft", note: i.note, createdBy: ctx.userId })
  })
}
export function discardDraftRow(id: string) {
  return mutate((d) => {
    const r = d.acctDetermination.find((x) => x.id === id)!
    need(r.state === "Draft" || r.state === "Marked", "Released rows are never edited or deleted (C-50).")
    d.acctDetermination = d.acctDetermination.filter((x) => x.id !== id)
  })
}
export function markRows() {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller", "Cost accountant"], "Marking draft rows")
    const drafts = d.acctDetermination.filter((r) => r.state === "Draft")
    need(drafts.length, "No draft rows to mark.")
    for (const r of drafts) r.state = "Marked"
    return drafts.length
  })
}
/** Release with effective date: Controller only, step-up MFA (RD-MM-11); blocked while gaps exist (E-MM-21). */
export function releaseMatrix(effective: string, mfa: boolean) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller"], "Releasing the matrix")
    need(mfa, "Confirm the step-up verification before release.", "mfa")
    need(effective >= ctx.today, "The effective date is today or later; historical postings never restate.", "effective")
    const marked = d.acctDetermination.filter((r) => r.state === "Marked")
    need(marked.length, "Mark the draft rows first (two-step mark and release).")
    const gaps = matrixGaps(candidateRows(d.acctDetermination), classesInUse(d))
    need(!gaps.length, `E-MM-21: ${gaps.length} gap(s) remain, for example ${gaps[0]?.key} x ${gaps[0]?.vc}. Release is blocked.`)
    const version = Math.max(...d.acctDetermination.filter((r) => r.state === "Released" || r.state === "Superseded").map((r) => r.version)) + 1
    for (const m of marked) {
      // A future effective date leaves the replaced row live until that date (§5.3): it is noted, and
      // superseded only when the new row takes effect (liveRows resolves by posting date).
      for (const r of d.acctDetermination)
        if (r.state === "Released" && sameKey(r, m)) {
          if (effective <= ctx.today) r.state = "Superseded"
          else r.note = `${r.note ? r.note + "; " : ""}replaced from ${effective} by version ${version}`
        }
      m.state = "Released"
      m.version = version
      m.validFrom = effective
    }
    for (const r of d.acctDetermination) if (r.state === "Draft") r.version = version + 1
    return version
  })
}

// ============================================================================ count documents (Book I Part A §7)
const countDoc = (d: MaterialsState, id: string) => {
  const c = d.countDocuments.find((x) => x.id === id)
  need(c, `Count document ${id} not found.`)
  return c!
}
const act = (c: CountDocRecord, ctx: MutateCtx, text: string) => c.activity.unshift({ at: ctx.today, by: ctx.role, text })
const SUPERVISOR: Role[] = ["Warehouse supervisor"]
const COUNTERS: Role[] = ["Warehouse operator", "Warehouse supervisor"]
/** §7.3 / RD-MM-25: a counter sees only their documents, only in Counting (first count) or Recount (recount). */
export function counterMaySee(c: CountDocRecord, role: Role, userId: string) {
  if (role !== "Warehouse operator") return true
  return (c.status === "Counting" && c.counterIds.includes(userId as UserId)) || (c.status === "Recount" && c.recounterId === userId)
}
/** ABC class from the Planning view (RD-MM-14); no class uses the tightest (A) tolerance. */
export const abcOf = (d: MaterialsState, itemId: string): "A" | "B" | "C" => d.views[itemId]?.abc ?? "A"

/** Inventory freeze (Dev Note p.36, RD-MM-20): a movement on a frozen bin is refused with E-CNT-01,
 *  unless the document was created with Soft Freeze ON, in which case it posts, the line is flagged
 *  Moved During Count (forcing a recount) and the movement is kept as interim. Returns the flag note. */
export function applyFreeze(d: MaterialsState, ctx: MutateCtx, warehouseId: string, bin: string, itemId: string, qty: number) {
  const c = freezingDoc(d.countDocuments, warehouseId, bin)
  if (!c) return undefined
  need(c.softFreeze, freezeMessage(bin, c.id))
  for (const l of c.lines.filter((x) => x.bin === bin && x.itemId === itemId)) {
    l.interim += qty
    if (!l.flags.includes("Moved During Count")) l.flags.push("Moved During Count")
    if (c.status !== "Generated" && c.status !== "Assigned" && !l.flags.includes("Recount Required")) l.flags.push("Recount Required")
  }
  act(c, ctx, `Moved During Count: ${qty > 0 ? "+" : ""}${qty} ${itemId} at ${bin} (soft freeze)`)
  return `${bin} is under ${c.id} (soft freeze): line flagged Moved During Count`
}
/** Read-only freeze check for other modules' movements (exported from index.ts). */
export function frozenLocation(warehouseId: string, bin: string) {
  const c = freezingDoc(store.getSlice("materials").countDocuments, warehouseId, bin)
  return c ? { docId: c.id, soft: c.softFreeze, message: freezeMessage(bin, c.id) } : undefined
}

/** Generate Count Sheets on a count plan (§7.1): one document per counting unit; RD-MM-26 uses one per
 *  zone (bin's first letter). Expected quantities are frozen at the snapshot. */
export function generateCountSheets(i: { warehouseId: string; planId?: string; blind: boolean; softFreeze: boolean }) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Generating count sheets")
    const rows = d.stock.filter((r) => r.warehouseId === i.warehouseId && r.qty > 0 && r.bucket !== "Consignment" && r.bucket !== "Customer Property" && r.bucket !== "In-Transit")
    need(rows.length, `No countable stock in ${i.warehouseId}.`)
    const plans = [...new Set(d.countDocuments.map((c) => c.planId))].sort()
    const planId = i.planId || `CP-2026-0${Number(plans[plans.length - 1]?.slice(-2) ?? "10") + 1}`
    const busy = rows.filter((r) => freezingDoc(d.countDocuments, r.warehouseId, r.bin))
    const free = rows.filter((r) => !busy.includes(r))
    need(free.length, `Every bin with stock in ${i.warehouseId} is already under an open count document.`)
    const zones = new Map<string, typeof free>()
    for (const r of free) zones.set(r.bin.charAt(0), [...(zones.get(r.bin.charAt(0)) ?? []), r])
    const existing = d.countDocuments.filter((c) => c.planId === planId).length
    const ids: string[] = []
    let k = existing
    for (const [zone, zr] of [...zones].sort()) {
      const id = `CD-${planId}-${String(++k).padStart(3, "0")}` as CountDocRecord["id"]
      const lines: CountLine[] = zr.map((r, n) => ({
        no: n + 1, bin: r.bin, itemId: r.materialId, batch: r.batchId, uom: getMaterial(d, r.materialId)?.baseUom ?? "EA", expected: r.qty, interim: 0, rate: rateOf(d, r.materialId), flags: [],
        expectedSerials: r.serials?.length ? [...r.serials] : undefined,
      }))
      d.countDocuments.unshift({
        id, plan: planId, planId, location: `${i.warehouseId} / Zone ${zone}`, warehouseId: i.warehouseId as CountDocRecord["warehouseId"], zone: `Zone ${zone}`, status: "Generated", blind: i.blind, softFreeze: i.softFreeze,
        snapshotAt: ctx.today, generatedBy: ctx.userId, counterIds: [], lines, activity: [{ at: ctx.today, by: ctx.role, text: `Generated from ${planId}; ${lines.length} line(s); expected quantities frozen at snapshot` }],
      })
      ids.push(id)
    }
    return { planId, ids, skipped: busy.length }
  })
}
export function assignCounter(id: string, userId: UserId) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Assigning counters")
    const c = countDoc(d, id)
    need(c.status === "Generated", "Counters are assigned to a Generated document.")
    c.counterIds = [userId]
    c.status = "Assigned"
    act(c, ctx, `Assigned to ${userId}; mobile entry opens for that user only`)
  })
}
/** Supervisor may reassign during Counting; in Recount it assigns the recounter (R-CNT-02). */
export function reassignCounter(id: string, userId: UserId) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Reassigning a counter")
    const c = countDoc(d, id)
    need(c.status === "Assigned" || c.status === "Counting" || c.status === "Recount", "Reassign in Assigned, Counting or Recount.")
    if (c.status === "Recount") {
      need(!c.counterIds.includes(userId), "R-CNT-02: the recounter must differ from the first counter.")
      c.recounterId = userId
      act(c, ctx, `Recount assigned to ${userId}`)
    } else {
      need(!c.counterIds.includes(userId), "That counter is already assigned.")
      c.counterIds = [userId]
      act(c, ctx, `Counter reassigned to ${userId}`)
    }
  })
}
export function voidCount(id: string, reason: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Voiding a count document")
    const c = countDoc(d, id)
    need(c.status === "Generated", "Void is allowed before counting only (Generated).")
    c.status = "Void"
    c.voidReason = reason
    act(c, ctx, `Void: ${reason}`)
  })
}
export function startCounting(id: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, COUNTERS, "Counting")
    const c = countDoc(d, id)
    need(c.status === "Assigned", "Counting starts from Assigned.")
    need(c.counterIds.includes(ctx.userId) || ctx.role === "Warehouse supervisor", "Only the assigned counter opens entry.")
    c.status = "Counting"
    act(c, ctx, "Counting started")
  })
}
/** Count or recount entry (SP-20). Recounter must differ from the counter (R-CNT-02). */
export function enterCount(id: string, lineNo: number, qty: number) {
  return mutate((d, ctx) => {
    requireRole(ctx, COUNTERS, "Count entry")
    const c = countDoc(d, id)
    need(c.status === "Counting" || c.status === "Recount", "Count entry is open in Counting or Recount only.")
    need(counterMaySee(c, ctx.role, ctx.userId), "This document is not assigned to you (§7.3).")
    need(qty >= 0 && Number.isFinite(qty), "Enter a quantity of zero or more.")
    const l = c.lines.find((x) => x.no === lineNo)!
    if (c.status === "Recount") {
      need(!c.counterIds.includes(ctx.userId), "R-CNT-02: the recount is done by a different counter than the first count.")
      need(l.flags.includes("Recount Required"), "Only flagged lines are recounted.")
      need(!l.flags.includes("Third Count Required"), "This line needs the third count (R-CNT-03), entered by the supervisor with the finance witness.")
      l.recount = qty
    } else {
      l.count = qty
    }
    if (qty === 0 && l.expected > 0 && !l.confirmedEmpty) l.confirmedEmpty = false
    act(c, ctx, `${c.status === "Recount" ? "Recount" : "Count"} line ${lineNo}: ${qty} ${l.uom}`)
  })
}
/** R-CNT-03: third count, supervisor and finance jointly present (RD-MM-19); the third count is final. */
export function enterThirdCount(id: string, lineNo: number, qty: number, witness: UserId) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "The third count")
    const c = countDoc(d, id)
    need(c.status === "Recount", "The third count is entered while the document is in Recount.")
    const l = c.lines.find((x) => x.no === lineNo)!
    need(l.flags.includes("Third Count Required"), "Only lines flagged Third Count Required take a third count.")
    need(qty >= 0 && Number.isFinite(qty), "Enter a quantity of zero or more.")
    need(witness, "Name the finance witness present at the third count.", "witness")
    l.thirdCount = qty
    l.thirdBy = ctx.userId
    l.thirdWitness = witness
    act(c, ctx, `Third count line ${lineNo}: ${qty} ${l.uom}, witness ${witness} (final)`)
  })
}
export function confirmEmpty(id: string, lineNo: number) {
  return mutate((d, ctx) => {
    const c = countDoc(d, id)
    need(counterMaySee(c, ctx.role, ctx.userId), "This document is not assigned to you (§7.3).")
    const l = c.lines.find((x) => x.no === lineNo)!
    l.count = 0
    l.confirmedEmpty = true
    act(c, ctx, `Line ${lineNo}: Confirm Empty Location`)
  })
}
/** §7.4 item 4: a batch found that is not on the sheet becomes an Unlisted Batch line. */
export function addUnlistedBatch(id: string, i: { bin: string; itemId: string; batch: string; qty: number }) {
  return mutate((d, ctx) => {
    requireRole(ctx, COUNTERS, "Adding an unlisted batch")
    const c = countDoc(d, id)
    need(c.status === "Counting" || c.status === "Recount", "Unlisted batches are recorded during counting.")
    need(counterMaySee(c, ctx.role, ctx.userId), "This document is not assigned to you (§7.3).")
    const m = getMaterial(d, i.itemId)
    need(m, "Enter a material number.", "itemId")
    need(i.batch.trim(), "Enter the batch number found.", "batch")
    need(!c.lines.some((l) => l.itemId === i.itemId && l.batch === i.batch.trim() && l.bin === i.bin), "That batch is already on the sheet; count it on its line.", "batch")
    need(i.qty > 0, "Enter the quantity found.", "qty")
    const no = Math.max(...c.lines.map((l) => l.no)) + 1
    c.lines.push({ no, bin: i.bin.trim().toUpperCase(), itemId: m!.id, batch: i.batch.trim(), uom: m!.baseUom, expected: 0, interim: 0, rate: rateOf(d, m!.id), flags: ["Unlisted Batch"], count: i.qty, unlistedConfirmed: false })
    act(c, ctx, `Unlisted Batch line ${no}: ${i.qty} ${m!.id} batch ${i.batch.trim()} at ${i.bin}; waits for supervisor confirmation`)
  })
}
export function confirmUnlisted(id: string, lineNo: number) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Confirming an unlisted batch")
    const c = countDoc(d, id)
    const l = c.lines.find((x) => x.no === lineNo)!
    need(l.flags.includes("Unlisted Batch") && !l.unlistedConfirmed, "Nothing to confirm on this line.")
    l.unlistedConfirmed = true
    act(c, ctx, `Unlisted Batch line ${lineNo} confirmed; batch record correction for ${l.batch} raised`)
  })
}
/** Serial scan on a serialized line (§7.4 item 4); missing / unexpected lists are derived. */
export function scanSerial(id: string, lineNo: number, serial: string) {
  return mutate((d, ctx) => {
    const c = countDoc(d, id)
    need(c.status === "Counting" || c.status === "Recount", "Serials are scanned during counting.")
    need(counterMaySee(c, ctx.role, ctx.userId), "This document is not assigned to you (§7.3).")
    const l = c.lines.find((x) => x.no === lineNo)!
    need(l.expectedSerials, "This line is not serialized.")
    const sn = serial.trim().toUpperCase()
    need(!(l.scannedSerials ?? []).includes(sn), `${sn} is already scanned on this line.`)
    l.scannedSerials = [...(l.scannedSerials ?? []), sn]
    if (c.status === "Recount") l.recount = l.scannedSerials.length
    else l.count = l.scannedSerials.length
    act(c, ctx, `Line ${lineNo}: serial ${sn} scanned${l.expectedSerials!.includes(sn) ? "" : " (not expected)"}`)
  })
}
/** Submit: lines beyond ±2% or ±$500 auto-flag Recount Required (§7.2, §7.5). */
export function submitCount(id: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, COUNTERS, "Submitting a count")
    const c = countDoc(d, id)
    need(c.status === "Counting", "Submit from Counting.")
    need(counterMaySee(c, ctx.role, ctx.userId), "This document is not assigned to you (§7.3).")
    const open = c.lines.filter((l) => l.count == null)
    need(!open.length, `Count every line first (${open.map((l) => l.no).join(", ")} open).`)
    const zero = c.lines.filter((l) => l.count === 0 && l.expected > 0 && !l.confirmedEmpty)
    need(!zero.length, `A zero against non-zero expected needs "Confirm Empty Location" (line ${zero.map((l) => l.no).join(", ")}).`)
    for (const l of c.lines) {
      if (needsRecount(l) || l.flags.includes("Moved During Count")) {
        if (!l.flags.includes("Recount Required")) l.flags.push("Recount Required")
      }
    }
    c.status = "Submitted"
    act(c, ctx, `Submitted; ${c.lines.filter((l) => l.flags.includes("Recount Required")).length} line(s) flagged Recount Required`)
  })
}
/** Route a Submitted document: Recount when lines are flagged, otherwise Variance Review. */
export function routeCount(id: string, recounter?: UserId) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Routing a submitted count")
    const c = countDoc(d, id)
    need(c.status === "Submitted", "Route a Submitted document.")
    const flagged = c.lines.some((l) => l.flags.includes("Recount Required") && l.recount == null)
    if (flagged) {
      need(recounter && !c.counterIds.includes(recounter), "R-CNT-02: choose a recounter other than the first counter.", "recounter")
      c.recounterId = recounter
    }
    c.status = flagged ? "Recount" : "Variance Review"
    if (!flagged) autoApprove(d, c)
    act(c, ctx, flagged ? `Sent to Recount by ${recounter} (blind to the first count)` : "Sent to Variance Review")
  })
}
/** Force recount: the supervisor sends chosen lines back for a recount by a different counter. */
export function forceRecount(id: string, lineNos: number[], recounter: UserId, reason: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Forcing a recount")
    const c = countDoc(d, id)
    need(c.status === "Submitted" || c.status === "Variance Review", "Force a recount from Submitted or Variance Review.")
    need(lineNos.length, "Choose the lines to recount.")
    need(!c.counterIds.includes(recounter), "R-CNT-02: the recounter must differ from the first counter.", "recounter")
    for (const l of c.lines)
      if (lineNos.includes(l.no)) {
        l.recount = undefined
        l.flags = l.flags.filter((f) => f !== "Auto-Approved")
        if (!l.flags.includes("Recount Required")) l.flags.push("Recount Required")
      }
    c.recounterId = recounter
    c.status = "Recount"
    act(c, ctx, `Recount forced on line(s) ${lineNos.join(", ")}: ${reason}`)
  })
}
function autoApprove(d: MaterialsState, c: CountDocRecord) {
  for (const l of c.lines) {
    if (l.flags.includes("Unlisted Batch")) continue
    const { qty } = lineVariance(l)
    const base = l.expected + l.interim
    const pct = base === 0 ? (qty === 0 ? 0 : 100) : (Math.abs(qty) / base) * 100
    if (pct <= COUNT_RULES.abcTolerancePct[abcOf(d, l.itemId)] && !l.flags.includes("Auto-Approved")) l.flags.push("Auto-Approved")
  }
}
/** Finish the recount; a recount that differs from the first count beyond threshold again forces a
 *  third count (R-CNT-03), which must be entered before the document moves on. */
export function finishRecount(id: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, COUNTERS, "Finishing a recount")
    const c = countDoc(d, id)
    need(c.status === "Recount", "Finish a Recount document.")
    const open = c.lines.filter((l) => l.flags.includes("Recount Required") && l.recount == null)
    need(!open.length, `Recount every flagged line (${open.map((l) => l.no).join(", ")}).`)
    const third = c.lines.filter((l) => l.flags.includes("Recount Required") && needsThirdCount(l) && l.thirdCount == null)
    if (third.length) {
      for (const l of third) if (!l.flags.includes("Third Count Required")) l.flags.push("Third Count Required")
      act(c, ctx, `R-CNT-03: recount differs again on line(s) ${third.map((l) => l.no).join(", ")}; third count required with supervisor and finance present`)
      return { third: third.map((l) => l.no) }
    }
    c.status = "Variance Review"
    autoApprove(d, c)
    act(c, ctx, "Recount finished; Variance Review")
    return { third: [] as number[] }
  })
}
/** Supervisor reconciles: reject lines (they reopen in Counting). Approval of the variance goes
 *  through ApprovalButton "Count variance" with the §7.5 ladder (RD-MM-14). */
export function rejectCountLines(id: string, lineNos: number[], reason: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Rejecting count lines")
    const c = countDoc(d, id)
    need(c.status === "Variance Review", "Lines are rejected in Variance Review.")
    need(lineNos.length, "Choose the lines to reject.")
    for (const l of c.lines)
      if (lineNos.includes(l.no)) {
        l.count = undefined
        l.recount = undefined
        l.thirdCount = undefined
        l.scannedSerials = l.expectedSerials ? [] : undefined
        l.flags = l.flags.filter((f) => f === "Moved During Count" || f === "Unlisted Batch")
        l.lineDecision = "Rejected"
      }
    c.status = "Counting"
    act(c, ctx, `Rejected line(s) ${lineNos.join(", ")}: ${reason}; reopened for counting`)
  })
}
/** Post: one stock adjustment per document, approvals already satisfied (§7.6). */
export function postCount(id: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, SUPERVISOR, "Posting a count")
    const c = countDoc(d, id)
    need(c.status === "Approved", "Post an Approved document.")
    const v = docVariance(c)
    for (const x of v.lines) {
      if (!x.qty) continue
      const row = d.stock.find((r) => r.materialId === x.l.itemId && r.bin === x.l.bin && (!x.l.batch || r.batchId === x.l.batch))
      if (row) row.qty = Math.max(0, row.qty + x.qty)
      else if (x.qty > 0) d.stock.push({ id: `STK-${nextSeq(d)}`, materialId: x.l.itemId, warehouseId: c.warehouseId, bin: x.l.bin, batchId: x.l.batch, status: "Unrestricted", qty: x.qty, bucket: "Own", lastMovement: ctx.today })
      if (row) row.lastMovement = ctx.today
    }
    c.status = "Posted"
    c.postedOn = ctx.today
    c.adjustmentRef = `SA-TBD-${nextSeq(d)}`
    act(c, ctx, `Posted: stock adjustment ${c.adjustmentRef}, net ${v.net.toFixed(2)} USD (DR/CR 13xx vs 5310 ADJ)`)
    const left = d.countDocuments.filter((x) => x.planId === c.planId && x.status !== "Posted" && x.status !== "Void")
    if (!left.length) act(c, ctx, `Count plan ${c.planId} reaches Posted: every document is Posted or Void`)
  })
}

// ============================================================================ E&O reserve (§17.3)
export function computeEo(runId: string | undefined, period: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller"], "The E&O run")
    let run = runId ? d.eoRuns.find((x) => x.id === runId) : undefined
    need(!run || run.stage !== "Posted", "A posted run is final.")
    const last = d.eoRuns.filter((r) => r.stage === "Posted").sort((a, b) => (b.postedOn ?? "").localeCompare(a.postedOn ?? ""))[0]
    const rows: EoRunRecord["rows"] = []
    for (const m of allMaterials(d)) {
      if (!isValuated(m.type)) continue
      const stock = d.stock.filter((r) => r.materialId === m.id && r.qty > 0 && r.bucket !== "Consignment" && r.bucket !== "Customer Property")
      const existing = last?.rows.find((r) => r.materialId === m.id)?.reserve ?? 0
      if (!stock.length && !existing) continue
      const qty = stock.reduce((a, r) => a + r.qty, 0)
      const lastMove = stock.reduce((a, r) => (r.lastMovement > a ? r.lastMovement : a), "1900-01-01")
      const value = Math.round(qty * rateOf(d, m.id) * 100) / 100
      const bucket = qty ? eoBucket(lastMove, ctx.today) : "No stock"
      const { pct, note } = qty ? eoPct(d.eoPolicy, m.type, bucket, m.id) : { pct: 0, note: "Stock scrapped or consumed: reserve released" }
      const reserve = Math.round(value * pct) / 100
      if (!reserve && !existing) continue
      rows.push({ materialId: m.id, bucket, value, pct, reserve, existing, reserveDelta: Math.round((reserve - existing) * 100) / 100, lastMovement: qty ? lastMove : ctx.today, note })
    }
    if (!run) {
      const [y, q] = period.split("-Q")
      const id = `EOR-${y}${String(Number(q) * 3).padStart(2, "0")}-0${d.eoRuns.filter((r) => r.period === period).length + 1}` as EoRunRecord["id"]
      run = { id, period, policyVersion: d.eoPolicy.version, stage: "Computed", rows }
      d.eoRuns.unshift(run)
    } else {
      run.rows = rows
      run.stage = "Computed"
      run.policyVersion = d.eoPolicy.version
    }
    return run.id
  })
}
export function reviewEo(runId: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller"], "Reviewing the E&O run")
    const r = d.eoRuns.find((x) => x.id === runId)!
    need(r.stage === "Computed", "Compute the run first.")
    r.stage = "Reviewed"
  })
}
/** Post: DR 6320 / CR 5340 for builds, reverse for releases; valuation only, never a quantity change. */
export function postEo(runId: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller"], "Posting the E&O reserve")
    const r = d.eoRuns.find((x) => x.id === runId)!
    need(r.stage === "Reviewed", "Review the run before posting.")
    const build = r.rows.filter((x) => x.reserveDelta > 0).reduce((a, x) => a + x.reserveDelta, 0)
    const release = r.rows.filter((x) => x.reserveDelta < 0).reduce((a, x) => a - x.reserveDelta, 0)
    r.stage = "Posted"
    r.postedOn = ctx.today
    r.journalRef = `JE-TBD-EO-${nextSeq(d)}`
    if (build) ctx.emit("posting.posted", { template: "eoReserve", amount: Math.round(build * 100) / 100, currency: "USD", source: { type: "material", id: r.id } })
    if (release) ctx.emit("posting.posted", { template: "eoReserve", amount: -Math.round(release * 100) / 100, currency: "USD", source: { type: "material", id: r.id } })
    return { build, release }
  })
}
export function setEoRate(type: MaterialType, idx: 0 | 1 | 2, pct: number) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller"], "Editing the E&O policy")
    need(pct >= 0 && pct <= 100, "Enter a percentage from 0 to 100.")
    d.eoPolicy.rates[type][idx] = pct
    d.eoPolicy.version = `EO-POL-2026.${Number(d.eoPolicy.version.split(".").pop()) + 1}`
    d.eoPolicy.validFrom = ctx.today
  })
}
export function addEoOverride(materialId: string, pct: number, reason: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller"], "Adding an E&O override")
    need(reason.trim(), "An override needs a reason.", "reason")
    need(getMaterial(d, materialId), "Choose a material.")
    d.eoPolicy.overrides = [...d.eoPolicy.overrides.filter((o) => o.materialId !== materialId), { materialId: materialId as Material["id"], pct, reason: reason.trim() }]
  })
}

// ============================================================================ safety stock (Book I Part A §10)
const SS_EDITORS: Role[] = ["Planner", "Warehouse supervisor"]
/** One path for every safety stock change (value, reset to default, seasonal profile): audited with a
 *  reason code; above 25% delta it waits for the Planning Manager (§10.1 [DOC:p.43], RD-MM-22). */
function proposeSs(d: MaterialsState, ctx: MutateCtx, rowId: string, change: { newSs?: number; reset?: boolean; newMultipliers?: number[] }, reason: SsReason, note: string) {
  requireRole(ctx, SS_EDITORS, "Changing safety stock")
  const r = d.safetyStock.find((x) => x.id === rowId)!
  need(!r.pending, "A change on this row is already waiting for approval.")
  const oldBase = ssBase(r)
  const newBase = change.reset ? r.defaultSs : change.newSs ?? oldBase
  const newMult = change.newMultipliers ?? r.multipliers
  need(newBase >= 0 && Number.isFinite(newBase), "Enter a quantity of zero or more.", "ss")
  if (change.newMultipliers) need(change.newMultipliers.length === 12 && change.newMultipliers.every((x) => Number.isFinite(x) && x > 0), "Enter twelve multipliers above zero.", "multipliers")
  const sameMult = JSON.stringify(newMult ?? []) === JSON.stringify(r.multipliers ?? [])
  need(!(newBase === oldBase && sameMult && !(change.reset && r.ss != null)), "The new setting equals the current one.", "ss")
  const pct = ssDeltaPct(oldBase, r.multipliers, newBase, newMult)
  const what = change.reset ? "Reset to item default" : change.newMultipliers ? "Seasonal profile" : "Safety stock"
  if (pct > SS_APPROVAL_PCT) {
    r.pending = { changeId: `SSC-TBD-${String(nextSeq(d)).padStart(4, "0")}`, newSs: change.reset ? undefined : newBase, reset: change.reset, newMultipliers: change.newMultipliers, pct, reason, note, by: ctx.userId, on: ctx.today }
    return { pending: true, pct, changeId: r.pending.changeId }
  }
  r.history.unshift({ on: ctx.today, by: ctx.userId, old: oldBase, new: newBase, reason, what })
  if (change.reset) r.ss = undefined
  else if (change.newSs != null) r.ss = change.newSs
  if (change.newMultipliers) r.multipliers = change.newMultipliers
  return { pending: false, pct, changeId: undefined }
}
export function changeSs(rowId: string, newSs: number, reason: SsReason, note: string) {
  return mutate((d, ctx) => proposeSs(d, ctx, rowId, { newSs }, reason, note))
}
export function changeMultipliers(rowId: string, multipliers: number[], reason: SsReason, note: string) {
  return mutate((d, ctx) => proposeSs(d, ctx, rowId, { newMultipliers: multipliers }, reason, note))
}
export function withdrawSsChange(rowId: string) {
  return mutate((d) => {
    const r = d.safetyStock.find((x) => x.id === rowId)!
    need(r.pending, "Nothing is pending on this row.")
    r.pending = undefined
  })
}
/** Reset to the item default: same reason code and the same 25% test as any other change. */
export function resetToDefault(rowId: string, reason: SsReason, note: string) {
  return mutate((d, ctx) => {
    const r = d.safetyStock.find((x) => x.id === rowId)!
    need(r.ss != null, "The row already inherits the item default.")
    return proposeSs(d, ctx, rowId, { reset: true }, reason, note)
  })
}

// ============================================================================ item sales tab (Book I Part A §4.2-4.3)
const PRICE_EDITORS: Role[] = ["Sales admin", "Pricing Manager"]
const overlapsPrice = (a: { validFrom: string; validTo?: string }, b: { validFrom: string; validTo?: string }) => a.validFrom <= (b.validTo ?? "9999") && b.validFrom <= (a.validTo ?? "9999")
const priceKey = (r: Pick<SalesPriceRow, "kind" | "priceListId" | "customerId">) => (r.kind === "Price list" ? `L:${r.priceListId}` : `C:${r.customerId}`)
/** Approval needed for a new dated row: below the margin floor, or a change above ±5% against the
 *  row in force (§4.2-4.3 [DOC:p.29], W.4). */
export function priceCheck(d: MaterialsState, i: { materialId: string; kind: SalesPriceRow["kind"]; priceListId?: string; customerId?: string; price: number; validFrom: string }) {
  const m = getMaterial(d, i.materialId)
  const std = rateOf(d, i.materialId)
  const margin = std ? marginPct(i.price, std) : undefined
  const floor = m ? marginFloor(m.profitCenterId) : undefined
  const prev = d.salesPrices
    .filter((r) => r.materialId === i.materialId && priceKey(r) === priceKey(i as SalesPriceRow) && r.status === "Active" && r.validFrom < i.validFrom)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
  const changePct = prev ? ((i.price - prev.price) / prev.price) * 100 : undefined
  const belowFloor = margin != null && floor != null && margin < floor
  const kind: SalesPriceRow["approvalKind"] = belowFloor ? "Below price floor" : changePct != null && Math.abs(changePct) > PRICE_CHANGE_PCT ? "Price change on sales tab" : undefined
  return { std, margin, floor, prev, changePct, belowFloor, kind, pointsBelowFloor: belowFloor ? Math.round((floor! - margin!) * 10) / 10 : 0 }
}
export function addSalesPrice(i: { materialId: string; kind: SalesPriceRow["kind"]; priceListId?: string; customerId?: string; currency: "USD" | "CAD"; price: number; validFrom: string; validTo?: string; agreement?: string; note?: string; breaks?: SalesPriceRow["breaks"] }) {
  return mutate((d, ctx) => {
    requireRole(ctx, PRICE_EDITORS, "Maintaining sales prices")
    const v = d.views[i.materialId]
    need(v?.sellable, "The material is not sellable; switch Sellable ON through an MCH first (§4.1).")
    need(i.kind === "Price list" ? !!i.priceListId : !!i.customerId, i.kind === "Price list" ? "Choose the price list." : "Choose the customer.", "key")
    need(i.price > 0 && Number.isFinite(i.price), "Enter a unit price above zero.", "price")
    need(i.validFrom >= ctx.today, "Validity starts today or later; history is never edited, new rows are dated (C-50).", "validFrom")
    need(!i.validTo || i.validTo >= i.validFrom, "Valid To must be on or after Valid From.", "validTo")
    const clash = d.salesPrices.find((r) => r.materialId === i.materialId && priceKey(r) === priceKey(i as SalesPriceRow) && r.status !== "Expired" && r.status !== "Rejected" && r.validFrom >= i.validFrom && overlapsPrice(r, i))
    need(!clash, `${i.kind === "Price list" ? "V-SAL-02" : "V-SAL-03"}: overlapping validity with ${clash?.id} from ${clash?.validFrom}.`, "validFrom")
    const chk = priceCheck(d, i)
    // the row in force is closed the day before the new row starts (no overlap, history kept)
    if (chk.prev && (!chk.prev.validTo || chk.prev.validTo >= i.validFrom) && !chk.kind) chk.prev.validTo = dayBefore(i.validFrom)
    const id = `SPR-${String(nextSeq(d)).padStart(4, "0")}`
    d.salesPrices.push({
      id, materialId: i.materialId as Material["id"], kind: i.kind, priceListId: i.kind === "Price list" ? i.priceListId : undefined, customerId: i.kind === "Customer" ? (i.customerId as `CUS-${string}`) : undefined,
      currency: i.currency, price: i.price, validFrom: i.validFrom, validTo: i.validTo, breaks: i.breaks ?? [], agreement: i.agreement, status: chk.kind ? "Pending Approval" : "Active", approvalKind: chk.kind,
      createdBy: ctx.userId, createdOn: ctx.today, note: i.note,
    })
    logChange(d, ctx, i.materialId, i.kind === "Price list" ? `Price list ${i.priceListId}` : `Customer price ${i.customerId}`, chk.prev ? String(chk.prev.price) : "", `${i.price} from ${i.validFrom}`, "Screen (Sales tab)")
    return { id, kind: chk.kind }
  })
}
/** Mass update: percentage adjustment across selected rows creates new dated rows (§4.4 buttons). */
export function massUpdatePrices(rowIds: string[], pct: number, validFrom: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, PRICE_EDITORS, "Mass update")
    need(rowIds.length, "Select the rows to update.")
    need(Number.isFinite(pct) && pct !== 0, "Enter a percentage other than zero.", "pct")
    need(validFrom > ctx.today, "Mass update creates rows from a future date.", "validFrom")
    const made: { id: string; kind?: string }[] = []
    for (const rid of rowIds) {
      const r = d.salesPrices.find((x) => x.id === rid)!
      need(r.status === "Active", `${rid} is not Active; only active rates are updated.`)
      const price = Math.round(r.price * (1 + pct / 100) * 100) / 100
      const chk = priceCheck(d, { materialId: r.materialId, kind: r.kind, priceListId: r.priceListId, customerId: r.customerId, price, validFrom })
      if (!chk.kind && (!r.validTo || r.validTo >= validFrom)) r.validTo = dayBefore(validFrom)
      const id = `SPR-${String(nextSeq(d)).padStart(4, "0")}`
      d.salesPrices.push({ ...r, id, price, validFrom, validTo: undefined, breaks: r.breaks.map((b) => ({ ...b, price: Math.round(b.price * (1 + pct / 100) * 100) / 100 })), status: chk.kind ? "Pending Approval" : "Active", approvalKind: chk.kind, approvalRef: undefined, createdBy: ctx.userId, createdOn: ctx.today, note: `Mass update ${pct > 0 ? "+" : ""}${pct}% of ${r.id}` })
      made.push({ id, kind: chk.kind })
    }
    return made
  })
}
export function withdrawSalesPrice(id: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, PRICE_EDITORS, "Withdrawing a price row")
    const r = d.salesPrices.find((x) => x.id === id)!
    need(r.status === "Draft" || r.status === "Pending Approval", "Only a Draft or pending row is withdrawn; active rows are ended by a new dated row.")
    d.salesPrices = d.salesPrices.filter((x) => x.id !== id)
  })
}
export function onPriceDecided(api: StoreApi, id: string, outcome: "Approved" | "Rejected", requestId: string) {
  api.mutate("materials", (d, ctx) => {
    const r = d.salesPrices.find((x) => x.id === id)
    if (!r || r.status !== "Pending Approval") return
    r.approvalRef = requestId
    if (outcome === "Rejected") {
      r.status = "Rejected"
      return
    }
    for (const o of d.salesPrices) if (o !== r && o.materialId === r.materialId && priceKey(o) === priceKey(r) && o.status === "Active" && o.validFrom < r.validFrom && (!o.validTo || o.validTo >= r.validFrom)) o.validTo = dayBefore(r.validFrom)
    r.status = "Active"
    logChange(d, ctx, r.materialId, r.kind === "Price list" ? `Price list ${r.priceListId}` : `Customer price ${r.customerId}`, "pending", `${r.price} approved in ${requestId}`, "WF-INBOX")
  })
}
/** Price waterfall (§4.4): customer price, then the customer's price list with quantity breaks, then
 *  the item default; no price is E-SAL-01. Manual override is a document-line level, not simulated. */
export function priceWaterfall(d: MaterialsState, materialId: string, customerId: string, qty: number, date: string, customerList?: string) {
  const live = (r: SalesPriceRow) => r.materialId === materialId && r.status === "Active" && r.validFrom <= date && (!r.validTo || r.validTo >= date)
  const cust = d.salesPrices.find((r) => live(r) && r.kind === "Customer" && r.customerId === customerId)
  const list = customerList ? d.salesPrices.find((r) => live(r) && r.kind === "Price list" && r.priceListId === customerList) : undefined
  const brk = list ? [...list.breaks].sort((a, b) => b.fromQty - a.fromQty).find((b) => qty >= b.fromQty) : undefined
  const m = getMaterial(d, materialId)
  const levels = [
    { level: "1 Manual override", price: undefined as number | undefined, note: "Entered on the document line; not simulated" },
    { level: "2 Customer agreement", price: cust?.price, note: cust ? `${cust.id}${cust.agreement ? `, ${cust.agreement}` : ""}` : "No active customer price" },
    { level: "3 Price list", price: list ? brk?.price ?? list.price : undefined, note: list ? `${list.priceListId}${brk ? `, break from ${brk.fromQty}` : ""}` : customerList ? `No active rate on ${customerList}` : "Customer has no price list" },
    { level: "4 Item default", price: m?.listPrice, note: m?.listPrice ? "Item pricing method (fixed price)" : "No item default" },
  ]
  const won = levels.find((l) => l.price != null)
  return { levels, won, error: won ? undefined : `E-SAL-01: No valid price for item ${materialId} / customer ${customerId} on ${date}` }
}

// ============================================================================ data quality worklist
export function assignDq(key: string, userId: UserId) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Materials Manager", "Material steward"], "Assigning data-quality owners")
    d.dqAssignments = [...d.dqAssignments.filter((a) => a.key !== key), { key, userId, on: ctx.today }]
  })
}

// ============================================================================ approval outcomes (from subscribe)
export function onMchOrSupDecided(api: StoreApi, id: string, outcome: "Approved" | "Rejected", requestId: string, reason?: string) {
  api.mutate("materials", (d, ctx) => {
    const c = d.mchs.find((x) => x.id === id)
    if (c) {
      c.approvalRefs.push(requestId as MchRecord["approvalRefs"][number])
      if (outcome === "Rejected") {
        c.stage = "Rejected"
        c.activity.unshift({ at: ctx.today, by: "WF-INBOX", text: `Rejected in ${requestId}: ${reason ?? ""}` })
        return
      }
      c.stage = "Approved"
      c.activity.unshift({ at: ctx.today, by: "WF-INBOX", text: `Approved in ${requestId}` })
      if (c.apply === "Effective-dated" && c.effective && c.effective > ctx.today) {
        c.stage = "Scheduled"
        c.activity.unshift({ at: ctx.today, by: "System", text: `Scheduled for ${c.effective}` })
      } else applyRows(d, ctx, c)
      return
    }
    const s = d.supersessions.find((x) => x.id === id)
    if (s) {
      if (outcome === "Rejected") {
        s.stage = "Rejected"
        s.activity.unshift({ at: ctx.today, by: "WF-INBOX", text: `Rejected in ${requestId}: ${reason ?? ""}` })
        return
      }
      s.stage = "Approved, run-out"
      s.approvedOn = ctx.today
      s.startQty = onHand(d, s.predecessorId)
      const p = getMaterial(d, s.predecessorId)!
      if (p.status === "Active") {
        patchMaterial(d, p.id, { status: "Restricted" })
        logChange(d, ctx, p.id, "Status", "Active", "Restricted", s.id)
      }
      for (const t of supersessionWorklist(d, s)) if (!s.tasks.some((x) => x.doc === t.doc && x.kind === t.kind)) s.tasks.push({ ...t, id: `K${s.tasks.length + 1}` })
      s.activity.unshift({ at: ctx.today, by: "WF-INBOX", text: `Approved in ${requestId}; predecessor ${p.status === "Active" ? "Active to Restricted" : `stays ${p.status}`}` })
    }
  })
}
export function onCountDecided(api: StoreApi, id: string, outcome: "Approved" | "Rejected", requestId: string, reason?: string) {
  api.mutate("materials", (d, ctx) => {
    const c = d.countDocuments.find((x) => x.id === id)
    if (!c || c.status !== "Variance Review") return
    if (outcome === "Approved") {
      c.status = "Approved"
      for (const l of c.lines) l.lineDecision = "Approved"
      act(c, ctx, `Variances approved in ${requestId}; ready to post`)
    } else {
      for (const l of c.lines) if (!l.flags.includes("Auto-Approved")) (l.count = undefined), (l.recount = undefined), (l.lineDecision = "Rejected")
      c.status = "Counting"
      act(c, ctx, `Rejected in ${requestId}: ${reason ?? ""}; rejected lines reopen`)
    }
  })
}
export function onSsDecided(api: StoreApi, changeId: string, outcome: "Approved" | "Rejected", requestId: string) {
  api.mutate("materials", (d) => {
    const r = d.safetyStock.find((x) => x.pending?.changeId === changeId)
    if (!r || !r.pending) return
    if (outcome === "Approved") {
      const p = r.pending
      r.history.unshift({ on: p.on, by: p.by, old: r.ss ?? r.defaultSs, new: p.reset ? r.defaultSs : p.newSs ?? r.ss ?? r.defaultSs, reason: p.reason, approval: requestId, what: p.reset ? "Reset to item default" : p.newMultipliers ? "Seasonal profile" : "Safety stock" })
      if (p.reset) r.ss = undefined
      else if (p.newSs != null) r.ss = p.newSs
      if (p.newMultipliers) r.multipliers = p.newMultipliers
    }
    r.pending = undefined
  })
}

/** Vendors usable on new rows (onboarding Active). */
export const ACTIVE_VENDORS = VENDORS.filter((v) => v.onboarding === "Active")
export const SHARED_IDS = new Set(MATERIALS.map((m) => m.id))
