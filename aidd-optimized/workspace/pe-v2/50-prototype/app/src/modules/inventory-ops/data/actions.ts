// inventory-ops actions. Every write goes through store.mutate (atomic: a ProtoError leaves the
// state untouched). Warehouse tasks, dock receipts, close sign-offs and intercompany explanations
// are written to this module's slice; counts are written to the materials slice through the store
// (documents stay the system of record, Book IV §7.2), as README "Integration" says.
import { ProtoError, store, type MutateCtx } from "@/store"
import type { Role, UserId } from "@/data/domain"
import { MATERIALS, TODAY, USERS } from "@/data/shared"
import type { CertDoc, InboundReceipt, InvTask, InventoryOpsState, TaskPriority } from "./types"
import { SUPERVISOR_ROLES, SCAN_ERROR, TASK_CFG, blocksAccept, blocksPost, canWorkTask, receiptChecklist, round2 } from "../lib/rules"
import { evaluateClose, closeKey } from "../lib/close"
import { userName } from "../components/bits"

type D = InventoryOpsState
const io = <T,>(fn: (d: D, ctx: MutateCtx) => T) => store.mutate("inventoryOps", fn)
const need: (ok: unknown, msg: string, field?: string) => asserts ok = (ok, msg, field) => {
  if (!ok) throw new ProtoError(msg, field)
}
const roleIn = (ctx: MutateCtx, roles: Role[], what: string) => need(roles.includes(ctx.role), `${what} is done by the ${roles.join(" or ")}. Switch "Acting as" to continue.`)
const stamp = (ctx: MutateCtx) => `${ctx.today}T${new Date().toISOString().slice(11, 16)}`
const task = (d: D, id: string) => {
  const t = d.tasks.find((x) => x.id === id)
  need(t, `Task ${id} not found.`)
  return t
}
const log = (t: InvTask, ctx: MutateCtx, text: string) => t.history.push({ at: stamp(ctx), by: userName(ctx.userId), text })
const stdOf = (id?: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0

// ============================================================================ warehouse tasks
export type ScanResult = { ok: true; message: string; done: boolean } | { ok: false; errorCode?: string; expected: string; next: string; message: string }

/** Take a Queued task from the queue: Queued to Assigned (the worker claims it). */
export const claimTask = (id: string) =>
  io((d, ctx) => {
    const t = task(d, id)
    need(t.status === "Queued", `${t.id} is ${t.status}; only a Queued task can be taken.`)
    need(canWorkTask(ctx.role, t.type), `${t.type} tasks are worked by ${TASK_CFG[t.type].roles.join(" or ")} (RD-IO-03). Switch "Acting as" to continue.`)
    t.status = "Assigned"
    t.assigneeId = ctx.userId
    t.device = t.device ?? `TC77-${ctx.userId.slice(-2)}`
    log(t, ctx, `Taken from the queue by ${userName(ctx.userId)}`)
  })

/** Assigned to In Progress. Only the assignee, or the supervisor, starts it. */
export const startTask = (id: string) =>
  io((d, ctx) => {
    const t = task(d, id)
    need(t.status === "Assigned", `${t.id} is ${t.status}; start an Assigned task.`)
    need(t.assigneeId === ctx.userId || SUPERVISOR_ROLES.includes(ctx.role), `${t.id} is assigned to ${userName(t.assigneeId)}.`)
    t.status = "In Progress"
    t.startedAt = stamp(ctx)
    log(t, ctx, `Started on ${t.device ?? "handheld"}`)
  })

/** One scan against the next expected step. A wrong scan changes nothing and says what was expected. */
export const scanTask = (id: string, raw: string) =>
  io<ScanResult>((d, ctx) => {
    const t = task(d, id)
    need(t.status === "In Progress", `${t.id} is ${t.status}; scan while In Progress.`)
    need(t.assigneeId === ctx.userId, `${t.id} is assigned to ${userName(t.assigneeId)}.`)
    const code = raw.trim().toUpperCase()
    const i = t.scans.length
    const step = t.steps[i]
    if (!step) return { ok: true, message: "All scans done. Complete the task.", done: true }
    // SP-21: the disposition must be approved before anything is scanned at the scrap bin.
    if (t.scrap && !t.scrap.approvedBy) return { ok: false, errorCode: "SP-21", message: "Scrap disposition not approved", expected: `${step.label} (${step.code}) after the supervisor approves the disposition`, next: "Ask the Warehouse supervisor to approve the scrap disposition on the task board, then scan again." }
    if (code !== step.code.toUpperCase()) {
      return { ok: false, errorCode: SCAN_ERROR[t.scanPoint], message: `${step.label} does not match this task`, expected: `${step.label} ${step.code}`, next: `Scan the ${step.label.toLowerCase()} for ${t.id}.` }
    }
    t.scans.push(code)
    log(t, ctx, `Scanned ${step.label.toLowerCase()} ${code} (${t.scanPoint})`)
    return { ok: true, message: `${step.label} confirmed`, done: t.scans.length === t.steps.length }
  })

/** Every scan done: Done/Exception with outcome Done. A scrap task posts at the scrap bin (SP-21). */
export const completeTask = (id: string) =>
  io((d, ctx) => {
    const t = task(d, id)
    need(t.status === "In Progress", `${t.id} is ${t.status}; complete a task that is In Progress.`)
    need(t.assigneeId === ctx.userId, `${t.id} is assigned to ${userName(t.assigneeId)}.`)
    need(t.scans.length === t.steps.length, `Scan ${t.steps.slice(t.scans.length).map((s) => s.label.toLowerCase()).join(" and ")} first (${t.scanPoint}).`)
    t.status = "Done/Exception"
    t.outcome = "Done"
    t.doneAt = stamp(ctx)
    log(t, ctx, t.scrap ? `Done: scrapped at ${t.scrap.binCode} (SP-21)` : `Done: ${t.type.toLowerCase()} confirmed by scan (${t.scanPoint})`)
    if (t.scrap) {
      t.scrap.confirmedAt = stamp(ctx)
      const template = t.scrap.source === "RMA" ? 20 : 30
      ctx.emit("posting.posted", { template, amount: t.scrap.amount, currency: "USD", source: t.scrap.srcRef })
    }
    if (t.batch && ["Putaway", "Replenishment", "Transfer", "Pick"].includes(t.type)) ctx.emit("trace.eventRecorded", { code: "T04", doc: { type: "batch", id: t.batch }, batch: t.batch })
    ctx.emit("inventoryOps.taskCompleted", { taskId: t.id, type: t.type, outcome: "Done" })
    return { scrapPosted: t.scrap ? { template: t.scrap.source === "RMA" ? 20 : 30, amount: t.scrap.amount } : undefined }
  })

export const raiseTaskException = (id: string, reason: string) =>
  io((d, ctx) => {
    const t = task(d, id)
    need(t.status === "In Progress" || t.status === "Assigned", `${t.id} is ${t.status}; an exception is raised on an Assigned or In Progress task.`)
    need(t.assigneeId === ctx.userId || SUPERVISOR_ROLES.includes(ctx.role), `${t.id} is assigned to ${userName(t.assigneeId)}.`)
    need(reason.trim(), "Enter what went wrong.", "reason")
    t.status = "Done/Exception"
    t.outcome = "Exception"
    t.doneAt = stamp(ctx)
    t.exception = { reason: reason.trim(), at: stamp(ctx), by: ctx.userId }
    log(t, ctx, `Exception: ${reason.trim()}`)
    ctx.emit("inventoryOps.taskCompleted", { taskId: t.id, type: t.type, outcome: "Exception" })
  })

// ---- supervisor board (RD-IO-04)
const sup = (ctx: MutateCtx, what: string) => roleIn(ctx, SUPERVISOR_ROLES, what)
export const assignTasks = (ids: string[], userId: UserId, device?: string) =>
  io((d, ctx) => {
    sup(ctx, "Assigning tasks")
    need(ids.length, "Choose at least one task.")
    need(userId, "Choose who gets the tasks.", "userId")
    let n = 0
    for (const id of ids) {
      const t = task(d, id)
      need(t.status === "Queued" || t.status === "Assigned", `${t.id} is ${t.status}; only Queued or Assigned tasks are assigned.`)
      const u = USERS.find((x) => x.id === userId)
      need(u?.roles.some((r) => canWorkTask(r, t.type)), `${userName(userId)} (${u?.roles[0]}) cannot work ${t.type} tasks (RD-IO-03).`)
      t.status = "Assigned"
      t.assigneeId = userId
      if (device) t.device = device
      log(t, ctx, `Assigned to ${userName(userId)}`)
      n++
    }
    return n
  })
export const releaseTasks = (ids: string[]) =>
  io((d, ctx) => {
    sup(ctx, "Releasing tasks")
    for (const id of ids) {
      const t = task(d, id)
      need(t.status === "Assigned", `${t.id} is ${t.status}; only an Assigned task goes back to the queue.`)
      t.status = "Queued"
      t.assigneeId = undefined
      log(t, ctx, "Released to the queue")
    }
    return ids.length
  })
export const setPriority = (ids: string[], p: TaskPriority) =>
  io((d, ctx) => {
    sup(ctx, "Changing priority")
    for (const id of ids) {
      const t = task(d, id)
      need(t.status !== "Done/Exception", `${t.id} is finished; priority no longer applies.`)
      t.priority = p
      log(t, ctx, `Priority ${p}`)
    }
    return ids.length
  })
export const approveScrap = (id: string, reason: string) =>
  io((d, ctx) => {
    sup(ctx, "Approving a scrap disposition")
    const t = task(d, id)
    need(t.scrap, `${t.id} is not a scrap task.`)
    need(!t.scrap.approvedBy, "The disposition is already approved.")
    need(reason.trim(), "Enter the reason for the scrap.", "reason")
    t.scrap.approvedBy = ctx.userId
    t.scrap.approvedReason = reason.trim()
    t.scrap.approvedOn = ctx.today
    log(t, ctx, `Scrap disposition approved: ${reason.trim()}`)
  })
/** After an exception the supervisor puts the work back in the queue as a new task; the finished one stays as it was. */
export const requeueTask = (id: string) =>
  io((d, ctx) => {
    sup(ctx, "Requeueing a task")
    const t = task(d, id)
    need(t.status === "Done/Exception" && t.outcome === "Exception", `${t.id} did not end in an exception.`)
    need(!d.tasks.some((x) => x.followsUp === t.id), `${t.id} already has a follow-up task.`)
    const nid = `WT-TBD-0${++d.seq + 700}`
    d.tasks.unshift({ ...structuredClone(t), id: nid, status: "Queued", outcome: undefined, assigneeId: undefined, device: undefined, scans: [], startedAt: undefined, doneAt: undefined, exception: undefined, createdAt: stamp(ctx), followsUp: t.id, priority: "High", history: [{ at: stamp(ctx), by: userName(ctx.userId), text: `Requeued after the exception on ${t.id}` }] })
    log(t, ctx, `Follow-up ${nid} queued`)
    return nid
  })

// ============================================================================ goods receipt delta (FL-10)
type PF = ReturnType<typeof store.getSlice<"purchasingFinance">>
const RECEIVERS: Role[] = ["Receiving clerk", "Warehouse operator"]
const ACCEPTERS: Role[] = ["Receiving clerk", "Inspector", "Quality engineer", "Quality Manager", "Warehouse supervisor"]
const CERT_ATTACHERS: Role[] = ["Receiving clerk", "Warehouse operator", "Inspector", "Quality engineer", "Quality Manager"]

export function stpFor(pf: PF, poId: string, line: number) {
  const po = pf.purchaseOrders.find((p) => p.id === poId)
  const l = po?.lines.find((x) => x.no === line)
  const stp = l?.stpId ? pf.stps.find((s) => s.id === l.stpId) : undefined
  return { po, l, stp }
}

/** Receipt of a dock delivery against the PO line: E-DTS-04 hard block first (C-23), then the same
 *  posting the PO screen makes (DR 13xx / CR 2110 GR/IR; flow text p.178, RD-IO-10). The price
 *  variance rows are not created here (README Requests to foundation R-IO-1). */
export const postReceipt = (receiptId: string, batch: string) => {
  const pre = store.getSlice("inventoryOps")
  const r = pre.inbound.find((x) => x.id === receiptId)
  if (!r) return { ok: false as const, error: `Receipt ${receiptId} not found.` }
  const res = store.mutate("purchasingFinance", (pf, ctx) => {
    roleIn(ctx, RECEIVERS, "Posting a goods receipt")
    need(!r.postedAs, `${r.id} is already posted as ${r.postedAs}.`)
    const { po, l, stp } = stpFor(pf, r.poId, r.line)
    need(po && l, `${r.poId} line ${r.line} not found.`)
    need(["Sent", "Confirmed", "Partially Received"].includes(po.status), `Receipt needs a Sent, Confirmed or Partially Received PO (this one is ${po.status}).`)
    need(l.status !== "Cancelled" && l.status !== "Closed", "Choose an open PO line.")
    const rows = receiptChecklist({ itemId: l.itemId, vendorId: po.vendorId, stp, certs: r.certs, vendorBatch: r.vendorBatch, posted: false })
    const blocked = blocksPost(rows)
    need(!blocked.length, `${blocked[0]?.code ?? "E-DTS-04"}: ${blocked[0]?.label.toLowerCase()}: ${blocked[0]?.found}. ${l.stpId ? `The vendor never acknowledged ${l.stpId}` : ""}. Receipt is hard-blocked (C-23); the vendor acknowledges on the purchase order.`.replace(/\.\./g, "."))
    need(r.qty > 0, "Quantity must be above zero.")
    need(l.received + r.qty <= l.qty, `E-MM-11: over-receipt. Open quantity is ${l.qty - l.received}; tolerance 0% (design value).`)
    const mt = MATERIALS.find((m) => m.id === l.itemId)
    need(!mt?.serialProfileId, "Serialized items are received on the purchase order screen, where SP-03 captures each serial.")
    need(!mt?.batchFlag || batch.trim(), "Print and scan back the batch label at SP-02.", "batch")
    const gid = `GRN-TBD-0${(pf.seq += 1)}` as `GRN-${string}`
    const s = pf.standards[l.itemId]?.std ?? stdOf(l.itemId) ?? l.price
    pf.grns.unshift({ id: gid, poId: po.id, on: ctx.today, batches: batch.trim() ? [batch.trim() as `BAT-${string}`] : [], serials: [], postedBy: ctx.userId, lines: [{ poLine: l.no, itemId: l.itemId, qty: r.qty, price: l.price, std: s }] })
    l.received += r.qty
    l.status = l.received >= l.qty ? "Received" : "Partial"
    const openLines = po.lines.filter((x) => x.status !== "Cancelled")
    po.status = openLines.every((x) => x.status === "Received" || x.status === "Closed") ? "Received" : "Partially Received"
    po.activity.push({ at: ctx.today, by: ctx.role, text: `${gid} posted from dock receipt ${r.id}: ${r.qty} on line ${l.no}${batch.trim() ? `, batch ${batch.trim()}` : ""}; stock to QI Hold` })
    ctx.emit("purchasing.grnPosted", { grnId: gid, poId: po.id, batches: batch.trim() ? [batch.trim()] : [], serials: [] })
    ctx.emit("posting.posted", { template: "grn", amount: round2(r.qty * l.price), currency: po.currency, source: { type: "grn", id: gid } })
    if (batch.trim()) ctx.emit("trace.eventRecorded", { code: "T02", doc: { type: "grn", id: gid }, batch: batch.trim() })
    ctx.link({ from: { type: "purchaseOrder", id: po.id }, to: { type: "grn", id: gid }, kind: "receives" })
    return { grnId: gid, value: round2(r.qty * l.price), currency: po.currency }
  })
  if (!res.ok) return res
  const out = res.value
  const w = io((d, ctx) => {
    const rc = d.inbound.find((x) => x.id === receiptId)!
    rc.postedAs = out.grnId
    const existing = d.grnChecks.find((c) => c.grnId === out.grnId)
    if (existing) {
      existing.certs = structuredClone(rc.certs)
      existing.vendorBatch = rc.vendorBatch
    } else d.grnChecks.push({ grnId: out.grnId, certs: structuredClone(rc.certs), vendorBatch: rc.vendorBatch })
    ctx.emit("inventoryOps.receiptPosted", { receiptId, grnId: out.grnId, poId: rc.poId })
  })
  return w.ok ? { ok: true as const, value: out } : w
}

/** Attach or replace a certificate on a dock receipt or a posted GRN (E-QM-06). */
export const attachCert = (target: { receiptId: string } | { grnId: string }, cert: Omit<CertDoc, "attachedOn">) =>
  io((d, ctx) => {
    roleIn(ctx, CERT_ATTACHERS, "Attaching a certificate")
    need(cert.docNo.trim(), "Enter the certificate's document number.", "docNo")
    const full: CertDoc = { ...cert, docNo: cert.docNo.trim(), cites: cert.cites?.trim() || undefined, attachedOn: ctx.today }
    if ("receiptId" in target) {
      const r = d.inbound.find((x) => x.id === target.receiptId)
      need(r, "Receipt not found.")
      need(!r.postedAs, `${r.id} is posted; attach the certificate on ${r.postedAs}.`)
      r.certs = [...r.certs.filter((c) => c.type !== full.type), full]
    } else {
      let c = d.grnChecks.find((x) => x.grnId === target.grnId)
      if (!c) d.grnChecks.push((c = { grnId: target.grnId, certs: [] }))
      need(!c.accepted, "The receipt is accepted; it is read-only.")
      c.certs = [...c.certs.filter((x) => x.type !== full.type), full]
    }
  })

/** Accept the receipt: blocked until every required certificate is attached and right (E-QM-06; wrong
 *  revision blocks acceptance with the STP diff, p.210 §3.3). */
export const acceptReceipt = (grnId: string, note: string) =>
  io((d, ctx) => {
    roleIn(ctx, ACCEPTERS, "Accepting a receipt")
    let c = d.grnChecks.find((x) => x.grnId === grnId)
    if (!c) d.grnChecks.push((c = { grnId, certs: [] }))
    need(!c.accepted, "Already accepted.")
    const pf = store.getSlice("purchasingFinance")
    const g = pf.grns.find((x) => x.id === grnId)
    const line = g?.lines[0]
    const { po, stp } = g && line ? stpFor(pf, g.poId, line.poLine) : { po: undefined, stp: undefined }
    const rows = receiptChecklist({ itemId: line?.itemId ?? "", vendorId: po?.vendorId ?? "", stp, certs: c.certs, vendorBatch: c.vendorBatch, posted: true })
    const bad = blocksAccept(rows)
    need(!bad.length, bad.map((b) => (b.diff ? `Wrong-revision documentation: ${b.label} cites ${b.diff.found} but the STP requires ${b.diff.required} of ${b.diff.drawing}.` : `${b.code ?? "E-QM-06"}: ${b.label}: ${b.found}.`)).join(" "))
    c.accepted = { by: ctx.userId, on: ctx.today, note: note.trim() || undefined }
  })

// ============================================================================ period close (Book I Part J)
const CLOSE_RUNNERS: Role[] = ["Controller", "CFO", "Cost accountant", "Controlling analyst"]
const SIGNERS: Role[] = ["Controller", "CFO"]
const slices = () => ({
  admin: store.getSlice("admin"),
  materials: store.getSlice("materials"),
  pf: store.getSlice("purchasingFinance"),
  pp: store.getSlice("planningProduction"),
  sales: store.getSlice("sales"),
})
export const runCloseValidation = (entityId: string, month: string) =>
  io((d, ctx) => {
    roleIn(ctx, CLOSE_RUNNERS, "Running the close validation")
    const key = closeKey(entityId, month)
    d.closeRuns = d.closeRuns.filter((r) => r.key !== key)
    d.closeRuns.push({ key, at: stamp(ctx), by: ctx.userId })
    const v = evaluateClose(entityId, month, { ...slices(), io: d })
    const held = v.steps.filter((s) => s.result === "Held").length
    ctx.emit("inventoryOps.closeValidated", { entityId, month, held })
    return { held, steps: v.steps.length }
  })
export const signOffStep = (entityId: string, month: string, stepId: string, note: string) =>
  io((d, ctx) => {
    roleIn(ctx, SIGNERS, "Signing off a close step")
    const key = closeKey(entityId, month)
    const v = evaluateClose(entityId, month, { ...slices(), io: d })
    const s = v.steps.find((x) => x.id === stepId)
    need(s, "Step not found.")
    need(s.flagged, `Step ${stepId} is not flagged for a separate approver (RD-IO-15).`)
    need(s.result === "Passed", `Step ${stepId} is ${s.result.toLowerCase()}; only a passed step is signed off.`)
    need(!s.signoff, "Already signed off.")
    need(!s.executor || s.executor !== ctx.userId, `Separation of duties: ${userName(ctx.userId)} executed step ${stepId}; a different person approves it (FL-06 field 13).`)
    d.signoffs.push({ key, step: stepId, by: ctx.userId, at: stamp(ctx), note: note.trim() || undefined })
  })
/** Step 9b: post the proposed top-up (#24, DR 6300 / CR 2610). */
export const postWarrantyTopUp = (entityId: string, month: string) =>
  io((d, ctx) => {
    roleIn(ctx, ["Controller", "Cost accountant"], "Posting the warranty top-up")
    const key = closeKey(entityId, month)
    const v = evaluateClose(entityId, month, { ...slices(), io: d })
    need(v.warranty && v.warranty.shortfall > 0, "The reserve already covers open warranty exposure; nothing to top up.")
    need(!d.topUps.some((t) => t.key === key), "A top-up was already posted for this period.")
    const rwo = store.getSlice("planningProduction").reworkOrders.find((r) => r.originKind === "RMA warranty" && r.status !== "Settled")
    const je = `JE-TBD-${++d.seq + 52000}`
    d.topUps.push({ key, amount: v.warranty.shortfall, by: ctx.userId, at: stamp(ctx), je })
    ctx.emit("posting.posted", { template: 24, amount: v.warranty.shortfall, currency: "USD", source: { type: "reworkOrder", id: rwo?.id ?? "RWO-TBD-0000" } })
    return { je, amount: v.warranty.shortfall }
  })
/** Explain a class-level difference in the inventory tie-out (a mapping error shows here, not as a plug). */
export const explainTieDiff = (entityId: string, month: string, vc: string, resolution: string) =>
  io((d, ctx) => {
    roleIn(ctx, ["Controller", "Cost accountant"], "Explaining a tie-out difference")
    need(resolution.trim(), "Enter the explanation and the correcting action.", "resolution")
    const key = closeKey(entityId, month)
    const rows = d.tieDiffs.filter((x) => x.key === key && x.valuationClass === vc && !x.resolvedAt)
    need(rows.length, `No open difference on ${vc}.`)
    for (const r of rows) Object.assign(r, { resolvedBy: ctx.userId, resolvedAt: stamp(ctx), resolution: resolution.trim() })
  })

// ============================================================================ intercompany (FL-07)
const IC_ROLES: Role[] = ["Controller", "Cost accountant", "Controlling analyst"]
export const explainIcPair = (id: string, reason: string) =>
  io((d, ctx) => {
    roleIn(ctx, IC_ROLES, "Explaining an intercompany pair (Finance owns the reconciliation)")
    const p = d.icPairs.find((x) => x.id === id)
    need(p, `Pair ${id} not found.`)
    need(!p.explained, "Already explained.")
    need(reason.trim(), "Enter the reason for the difference.", "reason")
    p.explained = { by: ctx.userId, at: stamp(ctx), reason: reason.trim() }
  })
export const runIcRecon = (month: string) =>
  io((d, ctx) => {
    roleIn(ctx, IC_ROLES, "Running the intercompany reconciliation")
    d.icRecon = d.icRecon.filter((r) => r.month !== month)
    d.icRecon.push({ month, at: stamp(ctx), by: ctx.userId })
  })

export const TODAY_ISO = `${TODAY}T12:00`
export type { InboundReceipt }
