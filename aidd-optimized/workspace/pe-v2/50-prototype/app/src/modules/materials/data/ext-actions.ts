// Actions for the feature-list screens (12 October 2026). Same pattern as actions.ts: each one is an
// atomic mutate on the "materials" slice; a ProtoError leaves the state untouched and its message is
// shown. Role gates exist only where a rule names the role (ASM-PERM-1), otherwise a reading.

import { ProtoError, store, type MutateCtx, type StoreApi } from "@/store"
import type { Material, MaterialPlantData, MaterialStatus, Role, UserId, VendorId } from "@/data/domain"
import { checkValuation, irBasisAt, mergeBlockers, mergeWorklist, revalueMethod, statSuggestion, type ValuationInput } from "../lib/ext-rules"
import { liveRows, createMcr, type NewMcrInput } from "./actions"
import { TASK_FIELDS } from "./seed"
import { getMaterial, logChange, nextSeq, patchMaterial, type MaterialsState } from "./state"
import type { MchRecord, MaterialViews, SupersessionRecord } from "./types"
import type { AbcClass, SourceKind, SourcingRow, StatSafety } from "./ext"

const mutate = <T>(fn: (d: MaterialsState, ctx: MutateCtx) => T) => store.mutate("materials", fn)
const need = (ok: unknown, msg: string, field?: string) => {
  if (!ok) throw new ProtoError(msg, field)
}
const requireRole = (ctx: MutateCtx, roles: Role[], what: string) => need(roles.includes(ctx.role), `${what} is done by the ${roles.join(" or ")}. Switch "Acting as" to continue.`)

// ============================================================================ batch master (§15.1)
/** Attach a certificate (Mill cert per heat, CoA, CoC): GRN blocks Accept until the required ones attach (E-QM-06). */
export function attachCert(batchId: string, name: string, ref: string) {
  return mutate((d, ctx) => {
    const b = d.x.batches.find((x) => x.id === batchId)
    need(b, `Batch ${batchId} not found.`)
    need(name.trim(), "Choose the certificate type.", "name")
    need(ref.trim().length >= 4, "Enter the certificate reference (at least 4 characters).", "ref")
    need(!b!.certs.some((c) => c.ref === ref.trim()), "That certificate reference is already attached.", "ref")
    b!.certs.push({ name: name.trim(), ref: ref.trim(), attachedOn: ctx.today })
    if (b!.status === "QI Hold" && b!.alert?.includes("E-QM-06")) b!.alert = "Certificate attached; waiting for the inspection result"
    logChange(d, ctx, b!.materialId, `Batch ${b!.id} certificate`, "", `${name.trim()} ${ref.trim()}`, "Screen (Batch master)")
  })
}
/** Nightly job (§15.1): flips a batch to Expired at its expiry date; expired stock moves to Blocked with an alert. */
export function runExpiryJob() {
  return mutate((d, ctx) => {
    let n = 0
    for (const b of d.x.batches) {
      if (b.status === "Consumed" || b.status === "Expired" || !b.expiry || b.expiry >= ctx.today) continue
      b.status = "Expired"
      b.alert = `Expired on ${b.expiry}: stock moved to Blocked by the expiry job`
      for (const r of d.stock.filter((x) => x.batchId === b.id && x.qty > 0 && x.status !== "Blocked")) {
        const prev = r.status
        r.status = "Blocked"
        r.lastMovement = ctx.today
        ctx.emit("materials.stockStatusChanged", { batchId: b.id as `BAT-${string}`, from: prev, to: "Blocked", reason: "Expired (job)" })
      }
      n++
    }
    need(n > 0, "No batch has passed its expiry date since the last run.")
    return n
  })
}

// ============================================================================ duplicate merge (Book IV §7.1)
export function decideNotDuplicate(dupId: string, note: string) {
  return mutate((d, ctx) => {
    const x = d.x.dupes.find((q) => q.id === dupId)
    need(x && !x.decision, "This candidate is already decided.")
    need(note.trim().length >= 8, 'Enter "not a duplicate because..." (at least 8 characters).', "note")
    x!.decision = { kind: "Not a duplicate", note: note.trim(), by: ctx.userId, on: ctx.today }
  })
}
/** Merge = supersession specialization: loser becomes Restricted with a supersession record, references are rewritten, stock moves to the survivor. Irreversible. */
export function mergeDuplicates(dupId: string, survivorId: string, typed: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Material steward", "Materials Manager"], "A duplicate merge")
    const x = d.x.dupes.find((q) => q.id === dupId)
    need(x && !x.decision, "This candidate is already decided.")
    need(survivorId === x!.aId || survivorId === x!.bId, "Choose the survivor from the two materials.")
    need(typed.trim().toUpperCase() === "MERGE", "Type MERGE to confirm: a merge cannot be undone.", "confirm")
    const loserId = (survivorId === x!.aId ? x!.bId : x!.aId) as string
    const blockers = mergeBlockers(d, loserId, survivorId)
    need(!blockers.length, `Merge blocked by ${blockers.length} unresolved reference(s): ${blockers[0]?.text}`)
    const items = mergeWorklist(d, loserId, survivorId)
    const L = getMaterial(d, loserId)!
    // stock moves to the survivor batch by batch
    for (const r of d.stock.filter((s) => s.materialId === loserId)) {
      r.materialId = survivorId as Material["id"]
      r.lastMovement = ctx.today
    }
    // info records: merge into the survivor's record for the same vendor keeping the better basis, else re-point
    for (const ir of d.infoRecords.filter((i) => i.materialId === loserId)) {
      const twin = d.infoRecords.find((i) => i.materialId === survivorId && i.vendorId === ir.vendorId)
      if (twin) {
        if (ir.price < twin.price) twin.price = ir.price
        ir.manualExpired = true
      } else ir.materialId = survivorId as Material["id"]
    }
    for (const r of d.sourceList.filter((s) => s.materialId === loserId && !s.blocked)) r.materialId = survivorId as Material["id"]
    if (L.status === "Active") patchMaterial(d, loserId, { status: "Restricted" })
    const supId = `SUP-2026-${String(nextSeq(d)).padStart(4, "0")}` as SupersessionRecord["id"]
    d.supersessions.unshift({
      id: supId, predecessorId: loserId as Material["id"], successorId: survivorId as Material["id"], policy: "Immediate", effective: ctx.today, relationship: "One-for-One", stage: "Approved, run-out", originRef: `${dupId} (duplicate merge)`,
      reason: `Duplicate merge: ${x!.basis}`, startQty: 0, createdOn: ctx.today, approvedOn: ctx.today,
      tasks: items.filter((i) => !i.auto).map((i, n) => ({ id: `K${n + 1}`, doc: i.ref, kind: i.kind, action: i.action, done: false })),
      activity: [{ at: ctx.today, by: ctx.role, text: `Merge executed: ${items.filter((i) => i.auto).length} reference(s) rewritten, ${items.filter((i) => !i.auto).length} task(s) raised` }],
    })
    x!.decision = { kind: "Merged", note: `Survivor ${survivorId}`, by: ctx.userId, on: ctx.today, survivor: survivorId as Material["id"], supersessionId: supId }
    logChange(d, ctx, loserId, "Status", L.status, "Restricted (merged)", supId)
    logChange(d, ctx, survivorId, "Merge", "", `Absorbed ${loserId}`, supId)
    return supId
  })
}

// ============================================================================ consignment settlement (§14.2)
export function settlementLines(d: MaterialsState, vendorId: string, period: string) {
  return d.x.withdrawals
    .filter((w) => w.vendorId === vendorId && !w.settledIn && w.on.startsWith(period))
    .map((w) => {
      const b = irBasisAt(d, w.materialId, vendorId, w.on)
      return { withdrawalId: w.id, materialId: w.materialId, qty: w.qty, uom: w.uom, on: w.on, ref: w.ref, basis: b?.perUnit ?? 0, ir: b?.ir, currency: b?.currency ?? ("USD" as const), amount: Math.round(w.qty * (b?.perUnit ?? 0) * 100) / 100 }
    })
}
export function runSettlement(vendorId: string, period: string, trueUp: number) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Cost accountant", "Controller"], "The consignment settlement")
    need(period < ctx.today.slice(0, 7), `Period ${period} has not ended: withdrawals settle after month-end.`)
    need(!d.x.settlements.some((s) => s.vendorId === vendorId && s.period === period), `Period ${period} is already settled for ${vendorId}.`)
    const lines = settlementLines(d, vendorId, period)
    need(lines.length > 0, `No unsettled withdrawals for ${vendorId} in ${period}.`)
    const missing = lines.find((l) => !l.ir)
    need(!missing, `No info record basis is valid on the withdrawal date of ${missing?.withdrawalId}: add one before settling.`)
    if (trueUp !== 0) requireRole(ctx, ["Controller"], "A true-up to 5215")
    const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100
    const id = `CSD-2026-${String(nextSeq(d)).padStart(4, "0")}`
    d.x.settlements.unshift({ id, vendorId: vendorId as VendorId, period, lines: lines.map((l) => ({ withdrawalId: l.withdrawalId, materialId: l.materialId, qty: l.qty, basis: l.basis, amount: l.amount })), total, trueUp, postedOn: ctx.today, by: ctx.userId, billRef: `ACC-6 self-bill SB-TBD-${String(d.x.settlements.length + 9).padStart(4, "0")}` })
    for (const w of d.x.withdrawals) if (lines.some((l) => l.withdrawalId === w.id)) w.settledIn = id
    return id
  })
}

// ============================================================================ special stock: De-Peg (§14.4)
export function requestDepeg(stockId: string, reason: string) {
  return mutate((d, ctx) => {
    const r = d.stock.find((x) => x.id === stockId)
    need(r && r.bucket === "SO-Pegged", "Only SO-Pegged stock can be de-pegged.")
    need(reason.trim().length >= 8, "Enter the reason (at least 8 characters); it is logged on both SO lines.", "reason")
    r!.depeg = { reason: reason.trim(), by: ctx.userId, on: ctx.today }
  })
}
export function onDepegDecided(api: StoreApi, stockId: string, outcome: "Approved" | "Rejected") {
  api.mutate("materials", (d, ctx) => {
    const r = d.stock.find((x) => x.id === stockId)
    if (!r?.depeg) return
    if (outcome === "Approved") {
      logChange(d, ctx, r.materialId, "De-Peg", r.pegRef ?? "", "released to anonymous stock", "Sales Director approval")
      r.bucket = "Own"
      r.pegRef = undefined
    }
    r.depeg = undefined
  })
}

// ============================================================================ plant sourcing (Book VII §4.4)
export function setDec07(on: boolean) {
  return mutate((d) => {
    d.x.plantSrc.dec07 = on
    d.x.plantSrc.plants = d.x.plantSrc.plants.map((p) => (p.id === "PL-TBD-02" ? { ...p, status: on ? "Active" : "Planned" } : p))
  })
}
export function addSourcingRow(i: { materialId: string; plantId: string; source: SourceKind; fromPlant?: string; laneId?: string; note?: string }) {
  return mutate((d) => {
    need(getMaterial(d, i.materialId), "Choose a material.", "materialId")
    need(i.plantId, "Choose the plant.", "plantId")
    if (i.source === "Transfer") {
      need(i.fromPlant && i.fromPlant !== i.plantId, "A transfer source needs a supplying plant other than the receiving plant.", "fromPlant")
      const lane = d.x.plantSrc.lanes.find((l) => l.id === i.laneId)
      need(lane, "Choose the transfer lane.", "laneId")
      need(lane!.from === i.fromPlant && lane!.to === i.plantId, `Lane ${lane!.id} runs ${lane!.from} to ${lane!.to}, not ${i.fromPlant} to ${i.plantId}.`, "laneId")
    }
    const rank = Math.max(0, ...d.x.plantSrc.rows.filter((r) => r.materialId === i.materialId && r.plantId === i.plantId).map((r) => r.rank)) + 1
    need(!d.x.plantSrc.rows.some((r) => r.materialId === i.materialId && r.plantId === i.plantId && r.source === i.source && r.fromPlant === i.fromPlant), "That source is already in the sequence.")
    const row: SourcingRow = { id: `PS-${String(nextSeq(d)).padStart(2, "0")}`, materialId: i.materialId as Material["id"], plantId: i.plantId, rank, source: i.source, fromPlant: i.fromPlant, laneId: i.laneId, note: i.note }
    d.x.plantSrc.rows.push(row)
    return row.id
  })
}
export function removeSourcingRow(id: string) {
  return mutate((d) => {
    const r = d.x.plantSrc.rows.find((x) => x.id === id)
    need(r, "Row not found.")
    d.x.plantSrc.rows = d.x.plantSrc.rows.filter((x) => x.id !== id)
    for (const o of d.x.plantSrc.rows.filter((x) => x.materialId === r!.materialId && x.plantId === r!.plantId).sort((a, b) => a.rank - b.rank)) o.rank = d.x.plantSrc.rows.filter((x) => x.materialId === r!.materialId && x.plantId === r!.plantId && x.rank < o.rank).length + 1
  })
}
export function moveSourcingRow(id: string, dir: -1 | 1) {
  return mutate((d) => {
    const r = d.x.plantSrc.rows.find((x) => x.id === id)!
    const peer = d.x.plantSrc.rows.find((x) => x.materialId === r.materialId && x.plantId === r.plantId && x.rank === r.rank + dir)
    need(peer, dir < 0 ? "Already first in the sequence." : "Already last in the sequence.")
    peer!.rank = r.rank
    r.rank += dir
  })
}
export function setLaneActive(id: string, active: boolean) {
  return mutate((d) => {
    const l = d.x.plantSrc.lanes.find((x) => x.id === id)
    need(l, "Lane not found.")
    l!.active = active
  })
}

// ============================================================================ extend to plant (§3.14)
export function extendToPlant(materialId: string, plantId: string, copy: { planning: boolean; purchasing: boolean }) {
  return mutate((d, ctx) => {
    const m = getMaterial(d, materialId)
    need(m, "Material not found.")
    need(d.x.plantSrc.dec07, "Extend to Plant is enabled when multi-plant is switched on (DEC-07 has not fired: one plant at go-live, §3.3).")
    need(m!.status === "Active", `Extend to Plant needs an Active material (it is ${m!.status}).`)
    need(plantId !== "PL-TBD-01", "The material already exists in the home plant.")
    need(d.x.plantSrc.plants.some((p) => p.id === plantId && p.status === "Active"), `Plant ${plantId} is not active.`)
    need(!d.plantData.some((p) => p.materialId === materialId && p.plantId === plantId), `${materialId} is already extended to ${plantId}.`)
    const home = d.plantData.find((p) => p.materialId === materialId && p.plantId === "PL-TBD-01")
    const row: MaterialPlantData = { materialId: m!.id, plantId: plantId as MaterialPlantData["plantId"], mrpType: copy.planning ? (home?.mrpType ?? "None") : "None", procurement: copy.planning ? (home?.procurement ?? "Buy") : "Buy", leadTimeDays: copy.purchasing ? (home?.leadTimeDays ?? 0) : 0, safetyStock: 0, status: "Data Completion" }
    d.plantData.push(row)
    logChange(d, ctx, materialId, `Plant ${plantId}`, "", "Extended; plant data completion started", "Screen (Extend to Plant)")
  })
}

// ============================================================================ copy from (§3.14)
export const COPY_GROUPS: { id: string; label: string; views: string[]; note: string }[] = [
  { id: "general", label: "General and classification", views: ["General + classification + UoM"], note: "Group, weights, dimensions; never the number, description or steward" },
  { id: "planning", label: "Planning (MRP)", views: ["Planning (MRP)"], note: "MRP type, procurement, lot sizing, reorder point" },
  { id: "purchasing", label: "Purchasing", views: ["Purchasing + first Info Record"], note: "Delivery time, source policy, tax category; info records and source lists are never copied" },
  { id: "production", label: "Production", views: ["Production"], note: "Scheduler, issue warehouse, batch size" },
  { id: "warehouse", label: "Warehouse and storage", views: ["Warehouse"], note: "Putaway, picking, storage conditions" },
  { id: "quality", label: "Quality", views: ["Quality (+ inspection plan check)"], note: "QI at receipt, certificates, plans" },
  { id: "accounting", label: "Accounting and costing", views: ["Accounting & Costing"], note: "Valuation class and method; standard and moving average are never copied" },
  { id: "sales", label: "Sales", views: ["Sales (when sellable)"], note: "Sales UoM, tax category, warranty" },
]
/** Copy From (create mode): creates the MCR, then copies only the checked field groups, never stock, history, info records or prices. */
export function copyFrom(sourceId: string, input: NewMcrInput, groupIds: string[]) {
  const made = createMcr(input)
  if (!made.ok) return made
  const mcrId = made.value
  const r = mutate((d, ctx) => {
    const mcr = d.mcrs.find((x) => x.id === mcrId)!
    const src = d.views[sourceId]
    need(src && mcr.materialId, "The source material has no view data.")
    const dst = d.views[mcr.materialId!] as unknown as Record<string, unknown>
    const copied: string[] = []
    for (const g of COPY_GROUPS.filter((x) => groupIds.includes(x.id)))
      for (const view of g.views) for (const k of TASK_FIELDS[view] ?? []) {
        if (k === "stewardId" || k === "plannerId" || k === "buyerId") continue
        const val = (src as unknown as Record<string, unknown>)[k as keyof MaterialViews]
        if (val != null && !(Array.isArray(val) && !val.length)) {
          dst[k as string] = Array.isArray(val) ? [...val] : val
          copied.push(`${g.label}: ${String(k)}`)
        }
      }
    mcr.activity.unshift({ at: ctx.today, by: ctx.role, text: `Copied from ${sourceId}: ${groupIds.length ? COPY_GROUPS.filter((x) => groupIds.includes(x.id)).map((x) => x.label).join(", ") : "no field groups"} (no stock, history, info records or prices)` })
    return { mcrId, copied: copied.length }
  })
  return r
}

// ============================================================================ lifecycle: recall to draft (§4.1)
export function recallToDraft(id: string, reason: string) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Materials Manager"], "Recall to Draft")
    const m = getMaterial(d, id)
    need(m, "Material not found.")
    need(m!.status === "Data Completion", `Recall to Draft starts from Data Completion (it is ${m!.status}).`)
    need(reason.trim().length >= 4, "Enter the reason.", "reason")
    const mcr = d.mcrs.find((x) => x.materialId === id && x.open)
    patchMaterial(d, id, { status: "Draft" as MaterialStatus })
    if (mcr) {
      mcr.stage = "Draft"
      mcr.tasks = mcr.tasks.map((t) => ({ ...t, done: false, doneOn: undefined, doneBy: undefined }))
      mcr.activity.unshift({ at: ctx.today, by: ctx.role, text: `Recalled to Draft: ${reason.trim()}; tasks reset, SLA stopped` })
    }
    logChange(d, ctx, id, "Status", "Data Completion", "Draft", `Screen (${reason.trim()})`)
  })
}

// ============================================================================ MCH register: cancel a scheduled change (§4.4)
export function cancelScheduledMch(id: string, reason: string) {
  return mutate((d, ctx) => {
    const c = d.mchs.find((x) => x.id === id)
    need(c, "Change request not found.")
    need(c!.stage === "Scheduled", "Only a scheduled change can be cancelled; an applied change is reversed by a new change.")
    need(reason.trim().length >= 4, "Enter the reason for cancelling.", "reason")
    c!.stage = "Cancelled"
    c!.log.push(`${ctx.today} cancelled before ${c!.effective}: ${reason.trim()}`)
    c!.activity.unshift({ at: ctx.today, by: ctx.role, text: `Scheduled change cancelled: ${reason.trim()}` })
  })
}

// ============================================================================ valuation-change variant (§5.4)
export function createValuationMch(i: { title: string; ids: string[]; input: ValuationInput; reason: string; ecoRef?: string }) {
  return mutate((d, ctx) => {
    need(i.reason.trim(), "Enter the reason for the change.", "reason")
    const chk = checkValuation(d, i.ids, i.input, ctx.today)
    need(!chk.global.length, chk.global[0])
    const good = chk.rows.filter((r) => !r.error)
    need(good.length > 0, "Every row failed validation; nothing to submit.")
    const live = liveRows(d.acctDetermination)
    const isMethod = i.input.fieldKey === "method"
    const rv = isMethod ? revalueMethod(d, good.map((r) => r.materialId), i.input.value as "Standard" | "Moving Average", live) : { reval: [], total: 0, glDebit: "", glCredit: "" }
    const date = i.input.apply === "Immediate" ? ctx.today : (i.input.effective as string)
    const id = `MCH-2026-${String(nextSeq(d)).padStart(4, "0")}` as MchRecord["id"]
    const label = isMethod ? "Valuation method" : "Price unit"
    d.mchs.unshift({
      id, title: i.title || `${label} to ${i.input.value}: ${good.length} materials`, stage: "Draft", fieldKey: i.input.fieldKey, fieldClass: 2, mode: "Set", apply: i.input.apply, effective: i.input.apply === "Effective-dated" ? date : undefined, approvalRefs: [],
      rows: good.map((r) => ({ materialId: r.materialId as Material["id"], field: label, old: r.old, new: r.new })),
      excluded: chk.rows.filter((r) => r.error).map((r) => ({ materialId: r.materialId as Material["id"], reason: r.error! })),
      reason: i.reason.trim(), ecoRef: i.ecoRef, createdOn: ctx.today, createdBy: ctx.userId, log: [],
      valuation: { kind: isMethod ? "Method change" : "Price unit change", effective: date, grirWarnings: good.flatMap((r) => d.x.grir.filter((g) => g.materialId === r.materialId).map((g) => ({ materialId: g.materialId, grnId: g.grnId, value: g.value }))), reval: rv.reval, totalDelta: rv.total, glDebit: rv.glDebit, glCredit: rv.glCredit },
      activity: [{ at: ctx.today, by: ctx.role, text: `Valuation change simulated: ${good.length} rows${isMethod ? `, revaluation delta ${rv.total}` : ""}; Class 2, Controller approval` }],
    })
    return id
  })
}
/** The Controller applies the approved valuation change (README R-13): at the period boundary only. */
export function applyValuationMch(id: string, atBoundary = false) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Controller"], "Releasing a valuation change")
    const c = d.mchs.find((x) => x.id === id)
    need(c?.valuation, "This is not a valuation change.")
    need(c!.stage === "Approved" || c!.stage === "Scheduled", "A valuation change applies only after approval through WF-INBOX.")
    const eff = c!.valuation!.effective
    need(eff <= ctx.today || atBoundary, `E-MM-22 / §5.4: this change applies at the period boundary ${eff}; it stays scheduled until then.`)
    const key = c!.fieldKey
    for (const r of c!.rows) {
      const v = d.views[r.materialId]
      if (!v) continue
      if (key === "method") {
        const std = getMaterial(d, r.materialId)?.stdCost ?? v.futureStd ?? 0
        const cur = d.valuations.filter((x) => x.materialId === r.materialId).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
        v.method = r.new as MaterialViews["method"]
        d.valuations.push({ materialId: r.materialId, plantId: "PL-TBD-01", entityId: "LE-TBD-10", valuationClass: v.valuationClass ?? cur?.valuationClass ?? "", method: r.new === "Standard" ? "Standard" : "MAV", stdCost: r.new === "Standard" ? std : undefined, mav: r.new === "Standard" ? undefined : (cur?.stdCost ?? std), validFrom: eff })
      } else v.priceUnit = Number(r.new) as 1 | 100 | 1000
      r.appliedAt = ctx.today
      c!.log.push(`${ctx.today} row ${r.materialId} applied (${c!.valuation!.kind})`)
      logChange(d, ctx, r.materialId, r.field, r.old, r.new, c!.id)
    }
    c!.valuation!.controllerApplied = { by: ctx.userId as UserId, on: ctx.today }
    c!.stage = "Applied"
    c!.activity.unshift({ at: ctx.today, by: ctx.role, text: `Released by the Controller${key === "method" ? `; REVAL ${c!.valuation!.totalDelta} posted` : ""}` })
  })
}

// ============================================================================ statistical safety stock (Phase 2)
export function activateStatistical(levels: StatSafety["levels"], rowIds: string[]) {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Planning Manager"], "Activating statistical safety stock")
    need(levels.A >= levels.B && levels.B >= levels.C, "Service levels must not fall from class A to C (A at least B at least C).")
    const sugg: StatSafety["suggestions"] = {}
    for (const r of d.safetyStock.filter((x) => rowIds.includes(x.id) && x.adu > 0)) {
      const v = d.views[r.materialId]
      sugg[r.id] = statSuggestion(r, (v?.abc ?? "A") as AbcClass, v?.xyz, levels)
    }
    need(Object.keys(sugg).length > 0, "Choose at least one row with demand (ADU above zero).")
    d.x.stat = { active: true, activatedOn: ctx.today, by: ctx.userId, levels, suggestions: sugg }
    return Object.keys(sugg).length
  })
}
export function deactivateStatistical() {
  return mutate((d, ctx) => {
    requireRole(ctx, ["Planning Manager"], "Switching statistical safety stock off")
    d.x.stat = { active: false, levels: d.x.stat.levels, suggestions: {} }
  })
}


// ============================================================================ creation flow: raise a placeholder (Book V §7.4)
/** Engineering asks for a part that has no number: the same event the EBOM editor emits; Materials opens an MCR with its tasks. */
export function raisePlaceholder(engineeringRequestId: string, description: string) {
  if (!/^ER-[A-Za-z0-9-]+$/.test(engineeringRequestId.trim())) return { ok: false as const, error: "Choose the engineering request the part is needed for.", field: "er" }
  if (description.trim().length < 8) return { ok: false as const, error: "Describe the part in at least 8 characters.", field: "description" }
  const before = store.getSlice("materials").mcrs.length
  store.bus.emit("engineering.placeholderNeeded", { engineeringRequestId: engineeringRequestId.trim() as `ER-${string}`, description: description.trim() })
  const mcr = store.getSlice("materials").mcrs[0]
  if (store.getSlice("materials").mcrs.length === before || !mcr) return { ok: false as const, error: "Materials did not open a request: try again.", field: undefined }
  return { ok: true as const, value: mcr.id as string }
}
