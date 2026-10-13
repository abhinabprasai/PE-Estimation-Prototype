// Actions for the feature-list screens. Each is one atomic write to the "sales" slice (a ProtoError
// changes nothing). Role gates exist only where the PRD names the role (ASM-PERM-1); each gate is listed
// in the screen's RulesPanel.

import { ProtoError, store, type MutateCtx, type Result } from "@/store"
import type { Role } from "@/data/domain"
import { materialById } from "@/data/shared/materials"
import { addDays, listDate, money, orderValue, product, TODAY, type Activity, type DB, type SalesOrder } from "../data/model"
import { FIN_ROLES, createLead, updateLead, userName } from "../data/ext-actions"
import { runCreditCheck, ATP_LATER_DATE } from "../data/store"
import { billingPlanOf, defaultRunOpts, kitComponentAtp, planTotal, quoteExtOf, simulateRun, shipIdOf, type RunOpts } from "./derive"
import { defaultShip } from "./seed"
import {
  BILLING_KINDS, CARRIERS, EXPORT_CHECKLIST, cancelFeeDefault, ruleById,
  type BillingKind, type ChangeField, type DocKey, type ExportItem, type InboundCapture, type LossReason, type Milestone, type Exclusion, type TaxProfile, type ShipExt,
} from "./model"

const M = <T>(fn: (db: DB, ctx: MutateCtx) => T): Result<T> => store.mutate("sales", fn)
const act = (ctx: MutateCtx, text: string): Activity => ({ at: TODAY, by: ctx.role, text })
const pad = (n: number, w = 4) => String(n).padStart(w, "0")
const need = (ctx: MutateCtx, roles: Role[], what: string) => {
  if (!roles.includes(ctx.role)) throw new ProtoError(`${what} is done by ${roles.join(" or ")}. You are acting as ${ctx.role}; switch "Acting as" to continue.`)
}
const findOrder = (db: DB, id: string) => {
  const o = db.orders.find((x) => x.id === id)
  if (!o) throw new ProtoError(`Order ${id} not found.`)
  return o
}
const findDelivery = (db: DB, id: string) => {
  const d = db.deliveries.find((x) => x.id === id)
  if (!d) throw new ProtoError(`Delivery ${id} not found.`)
  return d
}
const shipOf = (db: DB, d: { id: string }) => {
  const d0 = findDelivery(db, d.id)
  db.fx.ship[d.id] ??= defaultShip(db, d0)
  return db.fx.ship[d.id]
}
export const SALES_ROLES: Role[] = ["Sales rep", "Sales admin", "Customer service", "Customer Service Manager", "Estimator", "Pricing Manager", "Sales Director"]
export const SHIP_ROLES: Role[] = ["Shipping office", "Shipping Manager", "Warehouse supervisor", "Warehouse operator"]

// ============================================================================ lead import and inbound capture
const COMPANY_DUP = (db: DB, company: string, email: string) => {
  const c = company.trim().toLowerCase()
  const dom = email.split("@")[1]?.toLowerCase() ?? ""
  const hits: string[] = []
  for (const l of db.leads) if (c && (l.company.toLowerCase() === c || (dom && l.email.split("@")[1]?.toLowerCase() === dom))) hits.push(`${l.id} ${l.company}`)
  for (const cu of db.customers) if (c && cu.name.toLowerCase() === c) hits.push(`${cu.id} ${cu.name}`)
  return hits
}
export interface CsvResult { batchId: string; rows: number; imported: number; rejected: number; errors: { row: number; message: string }[] }
/** Trade contact import: CSV with company, contact, title, email, phone, note. Row-level validation; valid rows
 *  land as inbound captures for review, never as leads directly. */
export const importCsv = (fileName: string, text: string) =>
  M((db, ctx): CsvResult => {
    need(ctx, SALES_ROLES, "Lead import")
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) throw new ProtoError("The file needs a header row and at least one contact row.", "file")
    const head = lines[0].toLowerCase().split(",").map((h) => h.trim())
    for (const h of ["company", "contact", "email"]) if (!head.includes(h)) throw new ProtoError(`Column "${h}" is missing from the header row. Expected: company, contact, title, email, phone, note.`, "file")
    const col = (r: string[], k: string) => (r[head.indexOf(k)] ?? "").trim()
    const batchId = `IMP-TBD-${pad(db.fx.seq.batch++)}`
    const errors: { row: number; message: string }[] = []
    let imported = 0
    lines.slice(1).forEach((ln, i) => {
      const r = ln.split(",")
      const company = col(r, "company"), email = col(r, "email")
      if (!company) return void errors.push({ row: i + 2, message: "Company name is empty" })
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void errors.push({ row: i + 2, message: "Email address is not valid" })
      const dup = COMPANY_DUP(db, company, email)
      const cap: InboundCapture = {
        id: `INB-TBD-${pad(db.fx.seq.inbound++)}`, channel: "Trade contact import", receivedAt: TODAY, batchId, company, contactName: col(r, "contact"), contactTitle: col(r, "title"), email, phone: col(r, "phone"),
        subject: `Imported from ${fileName}`, body: col(r, "note"), parsed: {}, confidence: 0.7, issues: dup.length ? [`V-OM-40 company already on ${dup.join("; ")}`] : [], status: dup.length ? "Possible duplicate" : "New",
      }
      db.fx.inbound.unshift(cap)
      imported++
    })
    db.fx.batches.unshift({ id: batchId, channel: "Trade contact import", fileName, at: TODAY, by: userName(ctx.userId), rows: lines.length - 1, imported, rejected: errors.length, errors })
    return { batchId, rows: lines.length - 1, imported, rejected: errors.length, errors }
  })

/** Accept an inbound capture as a lead: creates the lead (duplicate warning unless `force`) and carries the parsed
 *  requirement attributes into the requirement panel. */
export function acceptInbound(id: string, force: boolean): Result<string> {
  const db = store.getSlice("sales")
  const c = db.fx.inbound.find((x) => x.id === id)
  if (!c) return { ok: false, error: `Capture ${id} not found.` } as Result<string>
  if (["Accepted", "Merged", "Rejected"].includes(c.status)) return { ok: false, error: `${c.id} is already ${c.status}.` } as Result<string>
  if (!c.company.trim()) return { ok: false, error: "No company was found on this capture. Edit it or reject it as unrelated.", field: "company" } as Result<string>
  const r = createLead({ title: c.subject.slice(0, 70), company: c.company, contactName: c.contactName, contactTitle: c.contactTitle, email: c.email, phone: c.phone, address: "", source: c.channel === "Web form" ? "Website" : c.channel === "Email" ? "Direct" : "Trade Show", region: c.parsed.region ?? "US Midwest", estValue: 0, currency: "USD" }, force)
  if (!r.ok) return r as Result<string>
  const leadId = r.value
  const req = { kva: c.parsed.kva, primaryV: c.parsed.primaryV, secondaryV: c.parsed.secondaryV, standards: c.parsed.standards }
  updateLead(leadId, { req })
  const w = M((d, ctx) => {
    const x = d.fx.inbound.find((y) => y.id === id)!
    x.status = "Accepted"
    x.leadId = leadId
    x.decidedBy = userName(ctx.userId)
    d.leads.find((l) => l.id === leadId)?.activity.push(act(ctx, `Created from inbound capture ${id} (${c.channel}); parsed attributes carried into the requirement panel`))
    return leadId
  })
  return w
}
export const mergeInbound = (id: string, leadId: string) =>
  M((db, ctx) => {
    const x = db.fx.inbound.find((y) => y.id === id)
    if (!x) throw new ProtoError(`Capture ${id} not found.`)
    if (["Accepted", "Merged", "Rejected"].includes(x.status)) throw new ProtoError(`${x.id} is already ${x.status}.`)
    const l = db.leads.find((y) => y.id === leadId)
    if (!l) throw new ProtoError("Choose the lead to merge into.", "lead")
    l.activity.push(act(ctx, `Inbound capture ${id} merged: ${x.subject}`))
    x.status = "Merged"
    x.leadId = leadId
    x.decidedBy = userName(ctx.userId)
  })
export const rejectInbound = (id: string, reason: string) =>
  M((db, ctx) => {
    const x = db.fx.inbound.find((y) => y.id === id)
    if (!x) throw new ProtoError(`Capture ${id} not found.`)
    if (["Accepted", "Merged", "Rejected"].includes(x.status)) throw new ProtoError(`${x.id} is already ${x.status}.`)
    if (!reason.trim()) throw new ProtoError("Choose a reason to reject the capture.", "reason")
    x.status = "Rejected"
    x.reason = reason
    x.decidedBy = userName(ctx.userId)
  })

// ============================================================================ billing plan
const syncOrderMilestones = (o: SalesOrder, ms: Milestone[], kind: BillingKind) => {
  o.billingPlan = kind === "Milestone" ? `Milestone billing ${ms.map((m) => m.pct).join("/")}% (ACC)` : kind === "On Shipment" ? "Single invoice at goods issue" : "Single invoice at delivery confirmation"
  o.milestones = kind === "Milestone" ? ms.map((m) => ({ pct: m.pct, label: m.label, irId: m.irId, state: m.state === "Planned" ? ("Open" as const) : ("Invoice request posted" as const) })) : undefined
}
export const saveBillingPlan = (soId: string, kind: BillingKind, ms: Milestone[], reason: string) =>
  M((db, ctx) => {
    need(ctx, FIN_ROLES, "Billing plan edits (Finance role right, p.56 §6)")
    const o = findOrder(db, soId)
    if (["Cancelled", "Rejected", "Invoiced/Closed"].includes(o.status)) throw new ProtoError(`${o.id} is ${o.status}; its billing plan is read-only.`)
    if (!BILLING_KINDS.includes(kind)) throw new ProtoError("Choose a billing plan.", "kind")
    const cur = billingPlanOf(db, o)
    if (ms.some((m) => !m.label.trim())) throw new ProtoError("Every milestone needs a name.", "label")
    if (ms.some((m) => !(m.pct > 0))) throw new ProtoError("Every milestone needs a percentage above zero.", "pct")
    const total = planTotal({ milestones: ms })
    if (total !== 100) throw new ProtoError(`The plan totals ${total}%; it must total exactly 100% before it can be saved (${total > 100 ? "remove" : "add"} ${Math.abs(100 - total)}%).`, "total")
    for (const old of cur.milestones.filter((m) => m.state !== "Planned")) {
      const now = ms.find((m) => m.id === old.id)
      if (!now) throw new ProtoError(`${old.label} already raised invoice request ${old.irId ?? ""}; it cannot be removed.`, "locked")
      if (now.pct !== old.pct) throw new ProtoError(`${old.label} already raised invoice request ${old.irId ?? ""}; its percentage is locked at ${old.pct}%.`, "locked")
    }
    if (!reason.trim()) throw new ProtoError("Enter the reason for the change; the plan keeps its history.", "reason")
    const next = { soId, kind, milestones: structuredClone(ms), version: cur.version + 1, history: [...cur.history, act(ctx, `Plan v${cur.version + 1} saved: ${ms.map((m) => `${m.label} ${m.pct}%`).join(", ")}. Reason: ${reason}`)] }
    db.fx.billing[soId] = next
    syncOrderMilestones(o, next.milestones, kind)
    o.activity.push(act(ctx, `Billing plan changed to v${next.version} (${next.milestones.length} milestones, 100%). Reason: ${reason}`))
  })
/** The trigger fired: creates an Invoice Request in the Finance queue (never an auto-posted invoice) [DOC:p.53 §4.4]. */
export const raiseMilestone = (soId: string, milestoneId: string) =>
  M((db, ctx) => {
    const o = findOrder(db, soId)
    const plan = billingPlanOf(db, o)
    const m = plan.milestones.find((x) => x.id === milestoneId)
    if (!m) throw new ProtoError("Milestone not found.")
    if (m.state !== "Planned") throw new ProtoError(`${m.label} already raised ${m.irId}.`)
    const idx = plan.milestones.indexOf(m)
    if (plan.milestones.slice(0, idx).some((x) => x.state === "Planned")) throw new ProtoError(`Earlier milestones are still planned: ${plan.milestones.slice(0, idx).filter((x) => x.state === "Planned").map((x) => x.label).join(", ")}. Milestones fire in order.`)
    m.state = "Invoice request raised"
    m.irId = `IR-TBD-${pad(db.seq.ir++)}`
    m.raisedOn = TODAY
    plan.history.push(act(ctx, `${m.label} (${m.pct}%) trigger fired: ${m.trigger}. Invoice request ${m.irId} created in the Finance queue with evidence: ${m.evidence}`))
    db.fx.billing[soId] = plan
    syncOrderMilestones(o, plan.milestones, plan.kind)
    o.activity.push(act(ctx, `Milestone ${m.label} (${m.pct}%): invoice request ${m.irId} created for Finance review`))
  })

/** engineering.designApproved: the customer drawing approval is the evidence for the Design Approval milestone
 *  [DOC:p.258]. The milestone stays Planned until Finance's trigger fires; the plan history and the order record the evidence. */
export function applyDesignApproved(db: DB, ctx: MutateCtx, p: { soId: string; transmittalId: string; response: string }) {
  const o = db.orders.find((x) => x.id === p.soId)
  if (!o) return
  const plan = db.fx.billing[p.soId]
  const note = `Customer drawing approval ${p.transmittalId} (${p.response}): evidence for the Design Approval milestone`
  o.activity.push(act(ctx, note))
  if (plan) {
    const m = plan.milestones.find((x) => x.label === "Design Approval")
    if (m) m.evidence = `Approved drawing transmittal ${p.transmittalId}`
    plan.history.push(act(ctx, note))
  }
}

// ============================================================================ ETO cost
export const postWipCharge = (soId: string, lineId: string, amount: number) =>
  M((db, ctx) => {
    const c = db.fx.etoCost[soId]
    if (!c) throw new ProtoError(`No ETO cost panel for ${soId}.`)
    const l = c.lines.find((x) => x.id === lineId)
    if (!l) throw new ProtoError("Choose a cost line.", "line")
    if (!(amount > 0)) throw new ProtoError("Enter an amount above zero.", "amount")
    l.actual += amount
    // WIP charges consume uncommitted remaining first, then open commitments.
    const fromRemaining = Math.min(l.remaining, amount)
    l.remaining -= fromRemaining
    l.committed = Math.max(0, l.committed - (amount - fromRemaining))
    findOrder(db, soId).activity.push(act(ctx, `ETO cost panel: WIP charge ${money(amount)} on ${l.label}`))
  })
export const rebaselineEto = (soId: string, deltaEstimate: number, reason: string) =>
  M((db, ctx) => {
    need(ctx, ["Estimator", "Cost accountant", "Controlling analyst", "Controller"], "Re-baselining the estimate")
    const c = db.fx.etoCost[soId]
    if (!c) throw new ProtoError(`No ETO cost panel for ${soId}.`)
    if (!reason.trim()) throw new ProtoError("A re-baseline needs the change order or reason behind it.", "reason")
    if (!deltaEstimate) throw new ProtoError("Enter the estimate change (positive or negative).", "delta")
    const total = c.lines.reduce((s, l) => s + l.estimate, 0)
    const mat = c.lines.find((l) => l.id === "mat")!
    mat.estimate += deltaEstimate
    c.baselines.push({ version: c.baselines.length + 1, at: TODAY, reason, estimate: total + deltaEstimate, by: ctx.role })
    findOrder(db, soId).activity.push(act(ctx, `ETO cost re-baselined to v${c.baselines.length}: estimate ${money(total)} → ${money(total + deltaEstimate)}. ${reason}`))
  })

// ============================================================================ kits
export const addKitLine = (docType: "quotation" | "salesOrder", docId: string, kitId: string, qty: number) =>
  M((db, ctx) => {
    need(ctx, SALES_ROLES, "Adding a kit line")
    const kit = db.fx.kits.find((k) => k.id === kitId)
    if (!kit) throw new ProtoError("Choose a kit.", "kit")
    if (kit.status !== "Released") throw new ProtoError(`${kit.id} has a ${kit.status} sales BOM; only a released BOM can be exploded.`)
    if (!(qty > 0)) throw new ProtoError("Quantity must be above zero.", "qty")
    const blocked = kit.components.map((c) => ({ c, m: materialById(c.item) })).filter((x) => x.m && ["Blocked", "Restricted"].includes(x.m.status))
    if (blocked.length) throw new ProtoError(`E-SAL-02: ${blocked.map((b) => `${b.c.item} is ${b.m!.status}`).join("; ")}. Components that cannot be sold block the kit line. Replace the component in the sales BOM or wait for the release.`)
    const price = kit.pricing === "Header price" ? kit.headerPrice : kit.components.reduce((s, c) => s + c.qty * c.price, 0)
    let lineNo: number
    if (docType === "quotation") {
      const q = db.quotations.find((x) => x.id === docId)
      if (!q) throw new ProtoError(`Quotation ${docId} not found.`)
      if (!["Draft", "Internal Review"].includes(q.status)) throw new ProtoError(`${q.id} is ${q.status}: issued content is locked. Revise the quotation first.`)
      lineNo = (q.lines.at(-1)?.no ?? 0) + 10
      q.lines.push({ no: lineNo, item: kit.id, qty, price, note: `Sales kit ${kit.name}` })
      q.activity.push(act(ctx, `Kit ${kit.id} added as line ${lineNo} and exploded into ${kit.components.length} component sub lines`))
    } else {
      const o = findOrder(db, docId)
      if (o.status !== "Draft") throw new ProtoError(`${o.id} is ${o.status}. Kit lines are added on a Draft order; after confirmation use a Sales Change Order.`)
      lineNo = (o.lines.at(-1)?.no ?? 0) + 10
      const rows = kitComponentAtp(db, kit, qty)
      const date = rows.map((r) => r.date).sort().at(-1) ?? TODAY
      o.lines.push({ no: lineNo, item: kit.id, qty, unitPrice: price, priceSource: "Price list", requestedShip: o.requestedShip, promisedShip: date, warehouse: "WH-TBD-01 Fargo, ND", status: "Open", schedules: [{ no: 10, reqQty: qty, reqDate: o.requestedShip, deliveredQty: 0, cancelledQty: 0, backorder: false, status: "Open" }] })
      o.activity.push(act(ctx, `Kit ${kit.id} added as line ${lineNo}; components exploded as sub lines. ATP runs on the components; the kit line confirms at the last component date ${date}`))
    }
    db.fx.kitLines.push({ key: `${docId}/${lineNo}`, docType, docId, lineNo, kitId, by: ctx.role, at: TODAY })
    return lineNo
  })

// ============================================================================ shipments
export const rejectTender = (dlvId: string, reason: string) =>
  M((db, ctx) => {
    need(ctx, SHIP_ROLES, "Recording a carrier rejection")
    const s = shipOf(db, { id: dlvId })
    if (!findDelivery(db, dlvId).carrier) throw new ProtoError("No carrier is assigned to this shipment.")
    if (!reason.trim()) throw new ProtoError("Record why the carrier rejected the tender.", "reason")
    s.tender = "Rejected"
    s.rejectedReason = reason
    s.carrierHistory.push(act(ctx, `${findDelivery(db, dlvId).carrier} rejected the tender: ${reason}`))
    findDelivery(db, dlvId).activity.push(act(ctx, `Carrier rejected the tender: ${reason}. Reassign a carrier before loading`))
  })
export const acceptTender = (dlvId: string) =>
  M((db, ctx) => {
    need(ctx, SHIP_ROLES, "Recording a carrier acceptance")
    const s = shipOf(db, { id: dlvId })
    if (!findDelivery(db, dlvId).carrier) throw new ProtoError("No carrier is assigned to this shipment.")
    s.tender = "Accepted"
    s.carrierHistory.push(act(ctx, `${findDelivery(db, dlvId).carrier} accepted the tender`))
  })
export const reassignCarrier = (dlvId: string, carrier: string, pro: string) =>
  M((db, ctx) => {
    need(ctx, SHIP_ROLES, "Reassigning the carrier")
    const d = findDelivery(db, dlvId)
    const s = shipOf(db, d)
    if (["PGI", "Delivered/Closed"].includes(d.status)) throw new ProtoError("The carrier is locked after PGI.")
    if (!carrier.trim()) throw new ProtoError("Choose the new carrier.", "carrier")
    if (carrier === d.carrier && s.tender !== "Rejected") throw new ProtoError(`${carrier} is already the carrier.`, "carrier")
    const old = d.carrier
    d.carrier = carrier
    d.pro = pro.trim() || undefined
    d.flags.documents = d.carrier && d.pro ? "passed" : "not passed"
    s.tender = "Tendered"
    s.rejectedReason = undefined
    s.carrierHistory.push(act(ctx, `Carrier reassigned ${old ?? "none"} → ${carrier}; tendered${d.pro ? `, ${d.pro}` : ", PRO/BOL # still to record"}`))
    d.activity.push(act(ctx, `Carrier reassigned ${old ?? "none"} → ${carrier}. Documents flag: ${d.flags.documents}`))
  })
export const togglePermit = (dlvId: string, item: string) =>
  M((db, ctx) => {
    need(ctx, SHIP_ROLES, "The permit checklist")
    const d = findDelivery(db, dlvId)
    if (["PGI", "Delivered/Closed"].includes(d.status)) throw new ProtoError("The permit checklist is locked after PGI.")
    d.permits = d.permits.includes(item) ? d.permits.filter((x) => x !== item) : [...d.permits, item]
    d.activity.push(act(ctx, `Permit checklist: ${item} ${d.permits.includes(item) ? "done" : "reopened"}`))
  })
export const generateDoc = (dlvId: string, key: DocKey) =>
  M((db, ctx) => {
    need(ctx, SHIP_ROLES, "Generating shipping documents")
    const d = findDelivery(db, dlvId)
    const s = shipOf(db, d)
    if (key === "BOL" && !(d.carrier && d.pro)) throw new ProtoError("The Bill of Lading (VICS format) needs the carrier and the PRO/BOL # on the load plan.")
    if (key === "Packing list" && d.status === "Planned") throw new ProtoError("The packing list is produced once the delivery is released; it prints a draft watermark until the pack order is complete.")
    if (key === "CoC" && s.psi.state !== "Passed") throw new ProtoError("E-OM-07: the Certificate of Conformance is generated when the pre-shipment inspection passes.")
    if (key === "Test reports (FTR)" && !["Packed", "Quality Cleared", "Loaded", "PGI", "Delivered/Closed"].includes(d.status)) throw new ProtoError("The test reports bundle needs the final test report on file (FTR issued at final test).")
    if (key === "Export documents" && !s.export) throw new ProtoError("This shipment is domestic: no export documents apply.")
    if (key === "Export documents" && s.export!.some((e) => e.state === "Not started")) throw new ProtoError(`Export checklist incomplete: ${s.export!.filter((e) => e.state === "Not started").map((e) => e.label).join("; ")}.`)
    const draft = key === "Packing list" && !["Packed", "Quality Cleared", "Loaded", "PGI", "Delivered/Closed"].includes(d.status)
    s.docs[key] = { state: draft ? "Draft" : "Generated", at: TODAY, by: ctx.role }
    d.activity.push(act(ctx, `${key} ${draft ? "draft generated (watermarked until the pack order is complete)" : "generated"}`))
  })
export const recordPsi = (dlvId: string, result: "Passed" | "Failed", reason: string) =>
  M((db, ctx) => {
    need(ctx, ["Inspector", "Quality engineer", "Quality Manager"], "Recording the pre-shipment inspection")
    const d = findDelivery(db, dlvId)
    const s = shipOf(db, d)
    if (d.status !== "Packed") throw new ProtoError(`The pre-shipment inspection is recorded on a Packed delivery (this one is ${d.status}).`)
    if (result === "Failed" && !reason.trim()) throw new ProtoError("Record why the inspection failed.", "reason")
    if (result === "Passed") {
      d.status = "Quality Cleared"
      d.flags.quality = "passed"
      s.psi = { state: "Passed", at: TODAY, by: ctx.role, cocId: `COC-TBD-${d.id.slice(-4)}` }
      s.docs.CoC = { state: "Generated", at: TODAY, by: "System" }
      d.activity.push(act(ctx, `Pre-shipment inspection passed (INV 15.3). Status Packed → Quality Cleared. Certificate of Conformance ${s.psi.cocId} generated (INV 15.5)`))
    } else {
      s.psi = { state: "Failed", reason, at: TODAY, by: ctx.role }
      d.flags.quality = "not passed"
      d.activity.push(act(ctx, `Pre-shipment inspection failed: ${reason}. PGI blocked (E-OM-07)`))
    }
  })
export const setExportItem = (dlvId: string, itemId: string, state: ExportItem["state"]) =>
  M((db, ctx) => {
    need(ctx, [...SHIP_ROLES, "Customer service", "Sales admin"], "The export checklist")
    const d = findDelivery(db, dlvId)
    const s = shipOf(db, d)
    if (!s.export) throw new ProtoError("This shipment is domestic: no export checklist applies.")
    const it = s.export.find((e) => e.id === itemId)
    if (!it) throw new ProtoError("Checklist item not found.")
    if (state === "Verified" && it.state === "Not started") throw new ProtoError("Prepare the document before it is verified.")
    it.state = state
    d.activity.push(act(ctx, `Export checklist: ${it.label} → ${state}`))
  })
export const startExportChecklist = (dlvId: string) =>
  M((db, ctx) => {
    const d = findDelivery(db, dlvId)
    const s = shipOf(db, d)
    if (s.export) throw new ProtoError("The export checklist already exists on this shipment.")
    s.export = EXPORT_CHECKLIST.map((e) => ({ ...e, state: "Not started" as const }))
    d.activity.push(act(ctx, "Export documentation checklist started: ship-to outside the origin country, tax zero-rated with export documents (Book I A §11.4)"))
  })

/** Load scan with sequence handling: wrong HU (not on this shipment) is E-BC-08; an HU out of the planned sequence
 *  needs an explicit confirmation with a reason, logged on the shipment. */
export const loadScanSeq = (dlvId: string, code: string, opts: { confirmOutOfSeq?: string } = {}) =>
  M((db, ctx) => {
    const d = findDelivery(db, dlvId)
    const s = shipOf(db, d)
    const v = code.trim().toUpperCase()
    if (s.tender === "Rejected") throw new ProtoError(`The carrier rejected this shipment (${s.rejectedReason ?? "no reason recorded"}). Reassign a carrier before loading.`)
    if (!["Quality Cleared", "Loaded"].includes(d.status)) throw new ProtoError(`Load scanning opens after pre-shipment inspection (delivery is ${d.status}).`)
    const hu = db.hus.find((h) => h.id === v || h.sscc === v)
    const mine = db.hus.filter((h) => h.deliveryId === d.id)
    if (!hu || hu.deliveryId !== d.id) {
      s.scanLog.unshift({ at: TODAY, code: v, result: "E-BC-08" })
      throw new ProtoError(`E-BC-08: ${code.trim() || "(empty scan)"} is not on this shipment. ${hu ? `It belongs to ${hu.deliveryId}. ` : ""}Expected one of: ${mine.map((h) => h.id).join(", ")}. Take the unit off the truck and scan the right HU.`)
    }
    if (hu.status === "Loaded") throw new ProtoError(`${hu.id} is already loaded.`)
    if (hu.status === "Open") throw new ProtoError(`${hu.id} is Open. Close it at the pack station before loading.`)
    const nextHu = s.loadSeq.find((id) => db.hus.find((h) => h.id === id)?.status !== "Loaded")
    if (nextHu && nextHu !== hu.id) {
      if (!opts.confirmOutOfSeq) throw new ProtoError(`OUT-OF-SEQUENCE: the loading sequence expects ${nextHu} next, not ${hu.id}. Confirm out of sequence with a reason, or scan ${nextHu}.`, "sequence")
      s.outOfSeq.push({ hu: hu.id, expected: nextHu, at: TODAY, by: ctx.role, reason: opts.confirmOutOfSeq })
    }
    hu.status = "Loaded"
    s.scanLog.unshift({ at: TODAY, code: hu.id, result: nextHu && nextHu !== hu.id ? "Loaded out of sequence" : "Loaded" })
    if (mine.every((h) => h.status === "Loaded") && d.status === "Quality Cleared") {
      d.status = "Loaded"
      d.activity.push(act(ctx, "All HUs scanned at the truck (SP-18). Status Quality Cleared → Loaded: PGI-ready"))
    }
    return hu.id
  })
export const reorderLoadSeq = (dlvId: string, huId: string, dir: -1 | 1) =>
  M((db, ctx) => {
    need(ctx, SHIP_ROLES, "The loading sequence")
    const s = shipOf(db, { id: dlvId })
    const i = s.loadSeq.indexOf(huId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= s.loadSeq.length) throw new ProtoError("The HU cannot move further.")
    if (db.hus.find((h) => h.id === huId)?.status === "Loaded") throw new ProtoError("A loaded HU keeps its place.")
    ;[s.loadSeq[i], s.loadSeq[j]] = [s.loadSeq[j], s.loadSeq[i]]
  })
export const CARRIER_LIST = CARRIERS

// ============================================================================ delivery creation run
export const executeRun = (opts: RunOpts, mode: "On demand" | "Nightly", scope: string) =>
  M((db, ctx) => {
    need(ctx, ["Shipping office", "Shipping Manager", "Sales admin", "Customer service"], "The delivery creation run")
    const sim = simulateRun(db, opts)
    if (!sim.groups.length) throw new ProtoError(`No allocated schedule lines are due within the ${opts.horizonDays}-day horizon (to ${listDate(addDays(TODAY, opts.horizonDays))}). Nothing was created.`)
    const created: { deliveryId: string; ruleId: string; soIds: string[] }[] = []
    for (const g of sim.groups) {
      // The FL-09 delivery record is single-order: a merge group becomes one delivery per order, linked by the merge group id.
      for (const soId of g.soIds) {
        const o = findOrder(db, soId)
        const part = g.items.filter((x) => x.soId === soId)
        let id = `DLV-TBD-${pad(db.seq.dlv++)}`
        while (db.deliveries.some((x) => x.id === id)) id = `DLV-TBD-${pad(db.seq.dlv++)}`
        const rule = ruleById(g.ruleId)!
        const d = {
          id, soId, customerId: o.customerId, shipTo: o.shipTo, incoterms: o.incoterms, status: "Planned", rule: rule.name, ruleId: g.ruleId,
          refs: part.map((x) => ({ soId, line: x.line, sched: x.sched, qty: x.qty })),
          flags: { supply: "passed" as const, credit: "not passed" as const, quality: "not passed" as const, documents: "not passed" as const },
          permits: [], freight: null, freightPaidBy: o.freightTerms, warehouse: g.warehouse,
          activity: [act(ctx, `Delivery created at Planned by the ${mode.toLowerCase()} delivery creation run. E-DLV-01 ${g.ruleId}: ${g.why}${g.mergeGroup ? ` Merge group ${g.mergeGroup}.` : ""}`)],
        }
        db.deliveries.unshift(d)
        db.fx.ship[id] = defaultShip(db, d)
        for (const x of part) {
          const sc = o.lines.find((l) => l.no === x.line)!.schedules.find((s) => s.no === x.sched)!
          sc.status = "Delivery Due"
          sc.deliveryId = id
          for (const ser of db.serials) if (ser.peg === `${soId}/${x.line}/${x.sched}`) ser.deliveryId = id
        }
        o.activity.push(act(ctx, `Delivery ${id} created by the run (${g.ruleId}). Schedule lines ${part.map((x) => `${x.line}/${x.sched}`).join(", ")} → Delivery Due`))
        created.push({ deliveryId: id, ruleId: g.ruleId, soIds: [soId] })
      }
    }
    const runId = `RUN-TBD-${pad(db.fx.seq.run++)}`
    db.fx.runs.unshift({ id: runId, at: TODAY, by: userName(ctx.userId), mode, horizonDays: opts.horizonDays, scope, created, held: sim.held.map((h) => ({ key: h.key, why: `${h.ruleId}: ${h.why}` })) })
    return { runId, created, held: sim.held }
  })
export const RUN_DEFAULTS = defaultRunOpts

// ============================================================================ change order, cancellation, reprice
const EDITABLE_AFTER_CONFIRM = ["Confirmed", "In Fulfillment", "Partially Shipped"]
export interface ChangeInput { soId: string; line: number; field: ChangeField; newValue: string; reason: string }
export function changePreview(db: DB, f: ChangeInput) {
  const o = db.orders.find((x) => x.id === f.soId)
  const l = o?.lines.find((x) => x.no === f.line)
  if (!o || !l) return null
  const before = orderValue(o)
  let oldValue = ""
  let after = before
  if (f.field === "Quantity") { oldValue = String(l.qty); after = before + (Number(f.newValue) - l.qty) * l.unitPrice }
  if (f.field === "Unit price") { oldValue = String(l.unitPrice); after = before + (Number(f.newValue) - l.unitPrice) * l.qty }
  if (f.field === "Requested ship date") oldValue = l.requestedShip
  if (f.field === "ETO configuration") oldValue = "Configuration as quoted (datasheet attributes)"
  return { o, l, oldValue, before, after, increases: after > before }
}
export const applyChangeOrder = (f: ChangeInput) =>
  M((db, ctx) => {
    need(ctx, ["Sales admin", "Customer service", "Customer Service Manager", "Sales Director", "Pricing Manager"], "A Sales Change Order")
    const o = findOrder(db, f.soId)
    const l = o.lines.find((x) => x.no === f.line)
    if (!l) throw new ProtoError("Choose an order line.", "line")
    if (["Draft"].includes(o.status)) throw new ProtoError("Before Confirmed the order is edited freely in Draft: use the order screen. A Sales Change Order applies after confirmation.")
    if (!EDITABLE_AFTER_CONFIRM.includes(o.status)) throw new ProtoError(`${o.id} is ${o.status}: a change order applies to a Confirmed, In Fulfillment or Partially Shipped order.`)
    if (["Shipped", "Invoiced", "Closed", "Cancelled"].includes(l.status)) throw new ProtoError(`Line ${l.no} is ${l.status}. Shipped lines are immutable; only new lines or cancellation of the remainder are possible after shipment.`)
    if (!f.reason.trim()) throw new ProtoError("Enter the reason for the change.", "reason")
    const p = changePreview(db, f)!
    let repromised: string | undefined
    let ecrRef: string | undefined
    if (f.field === "ETO configuration") {
      if (o.type !== "ETO") throw new ProtoError("Only ETO lines carry a technical configuration.")
      if (["In Production", "Ready to Ship"].includes(l.status)) throw new ProtoError("The ETO technical configuration is locked: the Design Release milestone has passed. The change requires an ECR (Part C §4) with a cost and schedule impact quote; the accepted impact comes back here as a change order referencing the ECO.")
      if (!f.newValue.trim()) throw new ProtoError("Describe the configuration change.", "newValue")
      ecrRef = "No ECR needed: before Design Release"
    } else if (f.field === "Quantity") {
      const n = Number(f.newValue)
      const delivered = l.schedules.reduce((s, x) => s + x.deliveredQty, 0)
      if (!Number.isFinite(n) || n <= 0) throw new ProtoError("Enter a quantity above zero.", "newValue")
      if (n < delivered) throw new ProtoError(`Line ${l.no} already delivered ${delivered}; the quantity cannot go below that.`, "newValue")
      if (n === l.qty) throw new ProtoError("The new quantity equals the old one.", "newValue")
      const open = l.schedules.filter((s) => !["Delivered", "Closed", "Cancelled"].includes(s.status))
      const last = open.at(-1)
      if (!last) throw new ProtoError("Every schedule line is already delivered or closed.")
      const diff = n - l.qty
      if (last.reqQty + diff < 0) throw new ProtoError("The reduction is larger than the open schedule quantity. Cancel the remainder instead.", "newValue")
      last.reqQty += diff
      if (last.confQty != null) last.confQty = Math.max(0, last.confQty + diff)
      l.qty = n
      repromised = last.status === "Open" ? undefined : "Dates re-promised on the open schedule line"
    } else if (f.field === "Requested ship date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.newValue)) throw new ProtoError("Enter the date as YYYY-MM-DD.", "newValue")
      if (f.newValue === l.requestedShip) throw new ProtoError("The new date equals the old one.", "newValue")
      for (const s of l.schedules) if (!["Delivered", "Closed", "Cancelled"].includes(s.status)) { s.reqDate = f.newValue; if (s.confDate && s.confDate < f.newValue) s.confDate = f.newValue }
      l.requestedShip = f.newValue
      if (l.promisedShip && l.promisedShip < f.newValue) l.promisedShip = f.newValue
      repromised = `Promised date ${l.promisedShip ?? "not set"}`
    } else if (f.field === "Unit price") {
      need(ctx, ["Pricing Manager", "Sales Director"], "A price change on a confirmed order")
      const n = Number(f.newValue)
      if (!Number.isFinite(n) || n <= 0) throw new ProtoError("Enter a unit price above zero.", "newValue")
      const floor = (product(l.item).stdCost ?? l.unitPrice * 0.8) * (o.currency === "CAD" ? 1.36 : 1) * 1.15
      if (n < floor) throw new ProtoError(`${money(n, o.currency)} is below the price floor ${money(floor, o.currency)} (standard cost plus 15%, reading SR-28): a below-floor price goes through Pricing Manager, Sales Director and CFO approval.`, "newValue")
      l.unitPrice = n
    }
    const after = orderValue(o)
    let creditRechecked = false
    let creditResult: "passed" | "failed" | undefined
    if (after > p.before) {
      creditRechecked = true
      const c = db.customers.find((x) => x.id === o.customerId)!
      const chk = runCreditCheck(db, o, "at a value-increasing change")
      c.exposure += after - p.before
      creditResult = chk.passLimit && chk.passPastDue ? "passed" : "failed"
      if (creditResult === "failed") {
        o.status = "Credit Hold"
        db.approvals.unshift({ id: `APR-TBD-${pad(db.seq.appr++)}`, kind: "Credit Release", soId: o.id, amount: after - p.before, currency: o.currency, forRoles: ["Finance (credit)", "Controller"], reason: `Credit check failed on a value-increasing change order (+${money(after - p.before, o.currency)})`, raised: TODAY })
      }
    } else if (after < p.before) {
      const c = db.customers.find((x) => x.id === o.customerId)!
      c.exposure = Math.max(0, c.exposure - (p.before - after))
    }
    const version = db.fx.changes.filter((x) => x.soId === o.id).length + 2
    const id = `SCO-TBD-${pad(db.fx.seq.sco++)}`
    db.fx.changes.unshift({ id, soId: o.id, line: l.no, field: f.field, oldValue: p.oldValue, newValue: f.field === "ETO configuration" ? f.newValue : f.newValue, reason: f.reason, initiator: ctx.role, at: TODAY, version, valueBefore: p.before, valueAfter: after, creditRechecked, creditResult, repromised, ecrRef, confirmationPdf: `Change Confirmation ${id}.pdf` })
    o.activity.push(act(ctx, `Sales Change Order ${id} (v${version}): line ${l.no} ${f.field} ${p.oldValue} → ${f.newValue}. Reason: ${f.reason}. Order value ${money(p.before, o.currency)} → ${money(after, o.currency)}${creditRechecked ? `. Credit re-check ${creditResult}${creditResult === "failed" ? ": status Credit Hold" : ""}` : ""}. Both versions retained; Change Confirmation PDF issued`))
    return { id, creditResult, version }
  })
export interface CancelInput { soId: string; scope: "Full order" | "Line"; line?: number; feePct: number; reason: string; woChoice?: (typeof import("./model").WO_DISPOSITIONS)[number] }
export function cancelPreview(db: DB, f: { soId: string; scope: "Full order" | "Line"; line?: number; feePct: number }) {
  const o = db.orders.find((x) => x.id === f.soId)
  if (!o) return null
  const lines = o.lines.filter((l) => (f.scope === "Full order" || l.no === f.line) && !["Shipped", "Invoiced", "Closed", "Cancelled"].includes(l.status))
  const value = lines.reduce((s, l) => s + l.schedules.reduce((a, x) => a + Math.max(0, (x.confQty ?? x.reqQty) - x.deliveredQty - x.cancelledQty), 0) * l.unitPrice, 0)
  const wo = lines.flatMap((l) => l.schedules.filter((s) => s.peg?.startsWith("WO-") && !["Delivered", "Closed", "Cancelled"].includes(s.status)).map((s) => ({ line: l.no, woId: s.peg!, inProgress: ["In Production", "In Engineering"].includes(l.status) })))
  return { o, lines, value, fee: Math.round(value * f.feePct) / 100, wo, defaultPct: cancelFeeDefault(o.type) }
}
export const cancelOrder = (f: CancelInput) =>
  M((db, ctx) => {
    need(ctx, ["Sales admin", "Customer service", "Customer Service Manager", "Sales Director"], "Cancelling an order or line")
    const p = cancelPreview(db, f)
    if (!p) throw new ProtoError(`Order ${f.soId} not found.`)
    if (!["Confirmed", "In Fulfillment", "Partially Shipped", "Credit Hold"].includes(p.o.status)) throw new ProtoError(`${p.o.id} is ${p.o.status}. Cancellation applies to a Confirmed, In Fulfillment or Partially Shipped order (Draft orders are simply deleted).`)
    if (f.scope === "Line" && f.line == null) throw new ProtoError("Choose the line to cancel.", "line")
    if (!p.lines.length) throw new ProtoError("Nothing is left to cancel: the selected lines are shipped or already cancelled. Shipped lines are immutable.")
    if (!(f.feePct >= 0 && f.feePct <= 100)) throw new ProtoError("The fee percentage is between 0 and 100.", "feePct")
    if (!f.reason.trim()) throw new ProtoError("Enter the reason for the cancellation.", "reason")
    const live = p.wo.filter((w) => w.inProgress)
    if (live.length && !f.woChoice) throw new ProtoError(`${live.map((w) => w.woId).join(", ")} is in progress: the Production Manager's disposition (finish to stock, stop and scrap, or stop and hold) is needed before the line closes. Choose the disposition to send.`, "woChoice")
    const id = `CNL-TBD-${pad(db.fx.seq.cnl++)}`
    const feeRef = p.fee > 0 ? `SVC-FEE-TBD-${pad(db.fx.seq.fee++)}` : undefined
    for (const l of p.lines) {
      const hasLive = live.some((w) => w.line === l.no)
      if (hasLive) {
        l.status = l.status // closes only after the disposition
        continue
      }
      l.status = "Cancelled"
      for (const s of l.schedules) if (!["Delivered", "Closed", "Cancelled"].includes(s.status)) { s.cancelledQty = Math.max(0, (s.confQty ?? s.reqQty) - s.deliveredQty); s.status = "Cancelled"; s.peg = undefined }
    }
    const c = db.customers.find((x) => x.id === p.o.customerId)!
    c.exposure = Math.max(0, c.exposure - p.value)
    const pending = live.length > 0
    const woRec = pending ? { woId: live[0].woId, choice: f.woChoice, state: "Waiting for Production Manager" as const } : undefined
    db.fx.cancels.unshift({ id, soId: p.o.id, scope: f.scope, line: f.line, feePct: f.feePct, feeAmount: p.fee, feeLineRef: feeRef, reason: f.reason, at: TODAY, by: ctx.role, woDisposition: woRec, state: pending ? "Pending WO disposition" : "Complete" })
    if (!pending && p.o.lines.every((l) => l.status === "Cancelled")) p.o.status = "Cancelled"
    p.o.activity.push(act(ctx, `${f.scope === "Line" ? `Line ${f.line}` : "Order"} cancellation ${id}: ${money(p.value, p.o.currency)} cancelled. Fee ${f.feePct}% = ${money(p.fee, p.o.currency)}${feeRef ? ` invoiced through service line ${feeRef}` : ""}. Reason: ${f.reason}${pending ? `. Cancel signal sent to ${live[0].woId}; waiting for the Production Manager disposition (${f.woChoice})` : ""}`))
    return { id, pending }
  })
export const decideWoDisposition = (cancelId: string, choice: (typeof import("./model").WO_DISPOSITIONS)[number]) =>
  M((db, ctx) => {
    need(ctx, ["Production supervisor", "Planning Manager", "Production Scheduler"], "The WO disposition (the Production Manager's call; reading SR-27)")
    const c = db.fx.cancels.find((x) => x.id === cancelId)
    if (!c?.woDisposition || c.state !== "Pending WO disposition") throw new ProtoError("No disposition is waiting on this cancellation.")
    const o = findOrder(db, c.soId)
    c.woDisposition = { ...c.woDisposition, choice, state: "Decided", decidedBy: ctx.role, decidedAt: TODAY }
    c.state = "Complete"
    for (const l of o.lines) {
      if (c.scope === "Line" && l.no !== c.line) continue
      if (["Shipped", "Invoiced", "Closed", "Cancelled"].includes(l.status)) continue
      l.status = "Cancelled"
      for (const s of l.schedules) if (!["Delivered", "Closed", "Cancelled"].includes(s.status)) { s.cancelledQty = Math.max(0, (s.confQty ?? s.reqQty) - s.deliveredQty); s.status = "Cancelled"; s.peg = undefined }
    }
    if (o.lines.every((l) => l.status === "Cancelled")) o.status = "Cancelled"
    o.activity.push(act(ctx, `${c.woDisposition.woId} disposition decided: ${choice}. Cancelled lines closed (${c.id})`))
  })
export function repricePreview(db: DB, soId: string) {
  const o = db.orders.find((x) => x.id === soId)
  if (!o) return null
  const cad = o.currency === "CAD"
  const rows = o.lines.map((l) => {
    const p = product(l.item)
    const locked = ["Shipped", "Invoiced", "Closed", "Cancelled"].includes(l.status)
    const eto = p.kind === "ETO"
    const det = eto ? l.unitPrice : Math.round(p.unitPrice * (1 + db.fx.priceUplift) * (cad ? 1.36 : 1))
    return { line: l.no, item: l.item, qty: l.qty, old: l.unitPrice, next: locked ? l.unitPrice : det, locked, eto, source: l.priceSource }
  })
  const before = rows.reduce((s, r) => s + r.old * r.qty, 0)
  const after = rows.reduce((s, r) => s + r.next * r.qty, 0)
  return { o, rows, before, after }
}
export const applyReprice = (soId: string, reason: string) =>
  M((db, ctx) => {
    need(ctx, ["Sales admin", "Customer service", "Pricing Manager", "Sales Director"], "Reprice")
    const p = repricePreview(db, soId)
    if (!p) throw new ProtoError(`Order ${soId} not found.`)
    if (["Cancelled", "Rejected", "Invoiced/Closed"].includes(p.o.status)) throw new ProtoError(`${p.o.id} is ${p.o.status}: Reprice is not available.`)
    if (!p.rows.some((r) => r.next !== r.old)) throw new ProtoError("Price determination returns the same prices: nothing to change.")
    if (!reason.trim()) throw new ProtoError("Enter the reason for the reprice.", "reason")
    for (const r of p.rows) {
      const l = p.o.lines.find((x) => x.no === r.line)!
      if (r.next !== r.old) { l.unitPrice = r.next; l.priceSource = "Price list" }
    }
    const c = db.customers.find((x) => x.id === p.o.customerId)!
    if (p.after > p.before && !["Draft", "Submitted"].includes(p.o.status)) {
      const chk = runCreditCheck(db, p.o, "at a value-increasing reprice")
      c.exposure += p.after - p.before
      if (!(chk.passLimit && chk.passPastDue)) {
        p.o.status = "Credit Hold"
        db.approvals.unshift({ id: `APR-TBD-${pad(db.seq.appr++)}`, kind: "Credit Release", soId: p.o.id, amount: p.after - p.before, currency: p.o.currency, forRoles: ["Finance (credit)", "Controller"], reason: "Credit check failed on a value-increasing reprice", raised: TODAY })
      }
    } else if (p.after < p.before) c.exposure = Math.max(0, c.exposure - (p.before - p.after))
    p.o.activity.push(act(ctx, `Reprice confirmed after the diff: ${money(p.before, p.o.currency)} → ${money(p.after, p.o.currency)}. Reason: ${reason}. Frozen quotation prices replaced by re-determined prices (Price Source = Price list)`))
  })

// ============================================================================ credit release and de-peg
export const requestDePeg = (f: { soId: string; line: number; sched: number; toSo: string; toLine: number; toSched: number; reason: string }) =>
  M((db, ctx) => {
    need(ctx, SALES_ROLES.filter((r) => r !== "Estimator"), "Requesting a de-peg")
    const o = findOrder(db, f.soId)
    const s = o.lines.find((l) => l.no === f.line)?.schedules.find((x) => x.no === f.sched)
    if (!s?.peg) throw new ProtoError("That schedule line has no pegged stock to release.", "sched")
    if (!/^(Stock|SN-)/.test(s.peg) && !s.peg.startsWith("WO-")) throw new ProtoError("Nothing pegged on that schedule line.")
    const to = findOrder(db, f.toSo)
    if (!to.lines.find((l) => l.no === f.toLine)?.schedules.find((x) => x.no === f.toSched)) throw new ProtoError("Choose the receiving schedule line.", "toSo")
    if (f.toSo === f.soId && f.toLine === f.line && f.toSched === f.sched) throw new ProtoError("The receiver cannot be the same schedule line.", "toSo")
    if (!f.reason.trim()) throw new ProtoError("A de-peg needs a reason (Sales Director approval with reason).", "reason")
    if (db.fx.depegs.some((d) => d.soId === f.soId && d.line === f.line && d.sched === f.sched && d.state === "Waiting for Sales Director")) throw new ProtoError("A de-peg request for that schedule line is already waiting for the Sales Director.")
    const id = `DPG-TBD-${pad(db.fx.seq.depeg++)}`
    db.fx.depegs.unshift({ id, ...f, stock: s.peg, requestedBy: ctx.role, at: TODAY, state: "Waiting for Sales Director" })
    o.activity.push(act(ctx, `De-peg ${id} requested for line ${f.line}/${f.sched} (${s.peg}) to ${f.toSo}. Waiting for the Sales Director`))
    return id
  })
export const decideDePeg = (id: string, outcome: "Approved" | "Rejected", reason: string) =>
  M((db, ctx) => {
    need(ctx, ["Sales Director"], "The de-peg decision")
    const d = db.fx.depegs.find((x) => x.id === id)
    if (!d) throw new ProtoError(`De-peg ${id} not found.`)
    if (d.state !== "Waiting for Sales Director") throw new ProtoError(`${id} is already ${d.state}.`)
    if (outcome === "Rejected" && !reason.trim()) throw new ProtoError("Give the reason for rejecting.", "reason")
    const from = findOrder(db, d.soId)
    const to = findOrder(db, d.toSo)
    d.state = outcome
    d.decidedBy = ctx.role
    d.decidedAt = TODAY
    d.decisionReason = reason
    if (outcome === "Approved") {
      const fs = from.lines.find((l) => l.no === d.line)!.schedules.find((x) => x.no === d.sched)!
      const ts = to.lines.find((l) => l.no === d.toLine)!.schedules.find((x) => x.no === d.toSched)!
      fs.peg = undefined
      fs.status = "Confirmed"
      fs.confDate = undefined
      fs.constraint = "stock released by de-peg; waiting for the next supply"
      for (const ser of db.serials) if (ser.peg === `${d.soId}/${d.line}/${d.sched}`) ser.peg = `${d.toSo}/${d.toLine}/${d.toSched}`
      ts.peg = d.stock
      if (ts.status === "Open" || ts.status === "Confirmed") ts.status = "Allocated/Pegged"
    }
    const text = `De-peg ${id} ${outcome.toLowerCase()} by the Sales Director${reason ? `. ${reason}` : ""}`
    from.activity.push(act(ctx, `${text} (released from line ${d.line}/${d.sched})`))
    to.activity.push(act(ctx, `${text} (taken by line ${d.toLine}/${d.toSched})`))
  })

// ============================================================================ customer property
export const receiveCustProp = (soId: string, description: string, ref: string, qty: number) =>
  M((db, ctx) => {
    need(ctx, ["Receiving clerk", "Warehouse operator", "Warehouse supervisor", "Sales admin"], "Receiving customer property")
    findOrder(db, soId)
    if (!description.trim()) throw new ProtoError("Describe the customer-supplied item.", "description")
    if (!(qty > 0)) throw new ProtoError("Quantity must be above zero.", "qty")
    const id = `CP-TBD-${pad(db.fx.seq.cp++)}`
    db.fx.custProp.push({ id, soId, item: `CUSTPROP-TBD-${pad(db.fx.seq.cp, 3)}`, description, batchOrSerial: ref || "Not recorded", received: qty, consumed: 0, returned: 0, scrapped: 0, log: [act(ctx, `Received ${qty} as Customer Property: zero value, never in ATP, never in E&O`)] })
    db.fx.soClosure[soId] = { reconciled: false }
    return id
  })
export const customerPropAction = (id: string, kind: "consume" | "return" | "scrap", qty: number, note: string) =>
  M((db, ctx) => {
    const c = db.fx.custProp.find((x) => x.id === id)
    if (!c) throw new ProtoError(`${id} not found.`)
    const left = c.received - c.consumed - c.returned - c.scrapped
    if (!(qty > 0)) throw new ProtoError("Quantity must be above zero.", "qty")
    if (qty > left) throw new ProtoError(`Only ${left} of ${c.received} remain with PE; ${qty} cannot be ${kind === "consume" ? "consumed" : kind === "return" ? "returned" : "scrapped"}.`, "qty")
    if (kind === "scrap" && !note.trim()) throw new ProtoError("Scrapping customer property needs a reason.", "note")
    if (kind === "consume") { c.consumed += qty; c.log.push(act(ctx, `Consumed ${qty} into a work order: no material value posted; genealogy records the consumption`)) }
    if (kind === "return") {
      c.returned += qty
      c.returnNote ??= `CPR-TBD-${pad(db.fx.seq.cp++ + 100)}`
      c.returnDelivery ??= `ZVD-TBD-${pad(db.fx.seq.cp)}`
      c.log.push(act(ctx, `Returned ${qty} on zero-value delivery ${c.returnDelivery} with property return note ${c.returnNote}`))
    }
    if (kind === "scrap") { c.scrapped += qty; c.log.push(act(ctx, `Scrapped ${qty} with the customer's consent: ${note}`)) }
    db.fx.soClosure[c.soId] = { reconciled: false }
  })
export const reconcileClosure = (soId: string) =>
  M((db, ctx) => {
    need(ctx, ["Sales admin", "Customer service", "Customer Service Manager", "Controller"], "The SO closure checklist")
    const open = db.fx.custProp.filter((c) => c.soId === soId && c.received - c.consumed - c.returned - c.scrapped > 0)
    if (open.length) throw new ProtoError(`Customer property is not reconciled: ${open.map((c) => `${c.description} (${c.received - c.consumed - c.returned - c.scrapped} still with PE)`).join("; ")}. Consume, return or scrap it first.`)
    db.fx.soClosure[soId] = { reconciled: true, at: TODAY, by: ctx.role }
    findOrder(db, soId).activity.push(act(ctx, "SO closure checklist: customer property reconciled"))
  })

// ============================================================================ quotations
export const recordQuoteOutcome = (qtId: string, outcome: "Won" | "Lost", f: { reason?: LossReason; notes: string; competitor?: string }) => {
  const db = store.getSlice("sales")
  const q = db.quotations.find((x) => x.id === qtId)
  if (!q) return { ok: false, error: `Quotation ${qtId} not found.` } as Result<void>
  if (outcome === "Lost" && !f.reason) return { ok: false, error: "A loss reason is mandatory when a quotation goes to Lost: Price, Lead Time, Technical, Relationship, No-Bid or Other with notes.", field: "reason" } as Result<void>
  if (outcome === "Lost" && f.reason === "Other" && !f.notes.trim()) return { ok: false, error: "Other needs notes.", field: "notes" } as Result<void>
  return M((d, ctx) => {
    const qq = d.quotations.find((x) => x.id === qtId)!
    if (qq.status !== "Issued") throw new ProtoError("Only an Issued quotation can be recorded as won or lost.")
    if (outcome === "Won") {
      qq.status = "Won"
      qq.activity.push(act(ctx, "Win recorded. Status Issued → Won"))
      const lead = d.leads.find((l) => l.id === qq.leadId || l.quotationIds.includes(qq.id))
      if (lead && lead.stage === "Quoting") { lead.stage = "Won"; lead.stageSince = TODAY; lead.winProb = 100; lead.activity.push(act(ctx, `Win recorded on ${qq.id}. Stage Quoting → Won`)) }
    } else {
      qq.status = "Lost"
      qq.lossReason = `${f.reason}${f.notes.trim() ? `: ${f.notes.trim()}` : ""}`
      qq.activity.push(act(ctx, `Loss recorded. Status Issued → Lost. Reason ${qq.lossReason}`))
      const lead = d.leads.find((l) => l.id === qq.leadId || l.quotationIds.includes(qq.id))
      if (lead && lead.stage === "Quoting") { lead.stage = "Lost"; lead.stageSince = TODAY; lead.winProb = 0; lead.activity.push(act(ctx, `Loss recorded on ${qq.id} (${f.reason}). Stage Quoting → Lost`)) }
    }
    const ext = quoteExtOf(d, qq)
    d.fx.quoteExt[qtId] = { ...ext, winLoss: { outcome, reason: f.reason, notes: f.notes, at: TODAY, by: ctx.role, competitor: f.competitor } }
    if (outcome === "Won") ctx.emit("sales.quotationWon", { quotationId: qtId as `QT-${string}`, customerId: qq.customerId as `CUS-${string}` })
  })
}
export const setQuoteType = (qtId: string, type: "Budgetary" | "Firm") =>
  M((db, ctx) => {
    const q = db.quotations.find((x) => x.id === qtId)
    if (!q) throw new ProtoError("Quotation not found.")
    if (q.status !== "Draft") throw new ProtoError(`${q.id} is ${q.status}; the quote type is set while the quotation is a Draft.`)
    const ext = quoteExtOf(db, q)
    if (type === "Firm" && product(q.lines[0].item).kind === "ETO" && !ext.ceId) throw new ProtoError("A Firm ETO quotation needs a linked Cost Estimate CE-# (Book I Part I §3). Link the estimate first.", "ce")
    db.fx.quoteExt[qtId] = { ...ext, type }
    q.activity.push(act(ctx, `Quote type set to ${type}${type === "Budgetary" ? " (±25%, watermarked BUDGETARY, no ATP)" : " (binding, full costing)"}`))
  })
export const runQuoteCtp = (qtId: string, line: number) =>
  M((db, ctx) => {
    const q = db.quotations.find((x) => x.id === qtId)
    if (!q) throw new ProtoError("Quotation not found.")
    const ext = quoteExtOf(db, q)
    if (ext.type === "Budgetary") throw new ProtoError("Budgetary quotes quote a lead-time band without CTP and carry the watermark.")
    const l = q.lines.find((x) => x.no === line)
    if (!l) throw new ProtoError("Line not found.")
    const weeks = ext.leadTimeWeeks[line] ?? 8
    ext.ctp[line] = { state: "Feasible", date: addDays(TODAY, weeks * 7), constraint: "Test bay capacity (simulated promise for the quotation)" }
    db.fx.quoteExt[qtId] = ext
    q.activity.push(act(ctx, `CTP run for line ${line}: feasible ${ext.ctp[line].date}`))
  })

// ============================================================================ tax profile (Book I A §11.3)
export const saveTaxProfile = (custId: string, patch: Partial<Pick<TaxProfile, "defaultTaxCode" | "addressRole">>, reason: string) =>
  M((db, ctx) => {
    need(ctx, [...FIN_ROLES, "Customer Service Manager", "Controller"], "Tax profile edits")
    const t = db.fx.tax[custId]
    if (!t) throw new ProtoError(`No tax profile for ${custId}.`)
    if (!reason.trim()) throw new ProtoError("Enter the reason; tax profile changes apply to documents from their effective date.", "reason")
    Object.assign(t, patch)
    db.custExt[custId]?.activity.push(act(ctx, `Tax profile changed: ${Object.entries(patch).map(([k, v]) => `${k} ${v}`).join(", ")}. ${reason}`))
  })
export const addTaxRegistration = (custId: string, jurisdiction: string, number: string, type: TaxProfile["registrations"][number]["type"]) =>
  M((db, ctx) => {
    need(ctx, [...FIN_ROLES, "Customer Service Manager"], "Tax registrations")
    const t = db.fx.tax[custId]
    if (!t) throw new ProtoError(`No tax profile for ${custId}.`)
    if (!jurisdiction.trim() || !number.trim()) throw new ProtoError("Enter the jurisdiction and the registration number.", "number")
    if (t.registrations.some((r) => r.jurisdiction === jurisdiction && r.number === number)) throw new ProtoError("That registration is already on the profile.", "number")
    t.registrations.push({ jurisdiction, number, type, verified: false })
  })

// ============================================================================ warranty exclusions catalog (config)
const CATALOG_ROLES: Role[] = ["Quality Manager", "Process owner", "Customer Service Manager"]
export const saveExclusion = (code: string | null, f: { category: Exclusion["category"]; text: string }, reason: string) =>
  M((db, ctx) => {
    need(ctx, CATALOG_ROLES, "The exclusions catalog")
    if (!f.text.trim()) throw new ProtoError("Describe the exclusion.", "text")
    if (!reason.trim()) throw new ProtoError("Effective-dated records keep their history: enter the reason for the change.", "reason")
    if (code === null) {
      const n = db.fx.exclusions.filter((e) => e.category === f.category).length + 1
      const c = `EXC-${f.category === "Site conditions" ? "SC" : "IE"}-${pad(n, 2)}`
      db.fx.exclusions.push({ code: c, category: f.category, text: f.text.trim(), active: true, version: 1, effectiveFrom: TODAY, history: [] })
      return c
    }
    const e = db.fx.exclusions.find((x) => x.code === code)
    if (!e) throw new ProtoError(`${code} not found.`)
    if (e.text === f.text.trim() && e.category === f.category) throw new ProtoError("Nothing changed.", "text")
    e.history.push({ version: e.version, text: e.text, effectiveFrom: e.effectiveFrom, changedBy: ctx.role, reason })
    e.version += 1
    e.text = f.text.trim()
    e.category = f.category
    e.effectiveFrom = TODAY
    return code
  })
export const setExclusionActive = (code: string, active: boolean, reason: string) =>
  M((db, ctx) => {
    need(ctx, CATALOG_ROLES, "The exclusions catalog")
    const e = db.fx.exclusions.find((x) => x.code === code)
    if (!e) throw new ProtoError(`${code} not found.`)
    if (e.active === active) throw new ProtoError(`${code} is already ${active ? "active" : "inactive"}.`)
    if (!reason.trim()) throw new ProtoError("Enter the reason.", "reason")
    // a deactivated exclusion stays on past adjudications; only new adjudications stop offering it
    if (!active && db.rmas.some((r) => r.adjudication?.exclusion === code && !["Closed", "Cancelled", "Rejected"].includes(r.status))) throw new ProtoError(`${code} is cited by an open RMA adjudication. Finish or close that RMA before deactivating it.`)
    e.history.push({ version: e.version, text: e.text, effectiveFrom: e.effectiveFrom, changedBy: ctx.role, reason: `${active ? "Activated" : "Deactivated"}: ${reason}` })
    e.version += 1
    e.active = active
    e.effectiveFrom = TODAY
  })

// ============================================================================ RMA: credit memo, billable repair, unauthorized line
export const rmaCreditBasis = (db: DB, rmaId: string) => {
  const r = db.rmas.find((x) => x.id === rmaId)
  if (!r) return null
  const gross = r.lines.reduce((s, l) => s + (l.qtyRecd || l.qtyAuth) * l.origPrice, 0)
  const restocking = Math.round(gross * r.restockPct) / 100
  const cust = db.customers.find((c) => c.id === r.customerId)
  return { r, gross, restocking, net: gross - restocking, onHold: !!cust?.creditHold, cust }
}
export const requestCreditMemo = (rmaId: string, forceHold?: boolean) =>
  M((db, ctx) => {
    need(ctx, ["Customer service", "Customer Service Manager", "Controller"], "A credit memo request")
    const b = rmaCreditBasis(db, rmaId)
    if (!b) throw new ProtoError(`RMA ${rmaId} not found.`)
    if (!["Disposition Pending", "Settling", "Received", "In Inspection"].includes(b.r.status)) throw new ProtoError(`${b.r.id} is ${b.r.status}: a credit memo request follows the disposition (Settling).`)
    if (b.r.cls === "RC4") throw new ProtoError("RC4 is a billable repair: there is no credit to request.")
    if (db.fx.creditMemos.some((c) => c.rmaId === rmaId && !["Rejected"].includes(c.state))) throw new ProtoError("A credit memo request already exists for this RMA.")
    const hold = b.onHold || !!forceHold
    const id = `CMR-TBD-${pad(db.fx.seq.cmr++)}`
    db.fx.creditMemos.unshift({ id, rmaId, amount: b.net, restocking: b.restocking, state: hold ? "Blocked: credit hold" : "Requested", requestedAt: TODAY, requestedBy: ctx.role, note: hold ? "E-RMA-07 Customer is on credit hold: credit requires Controller release" : undefined })
    b.r.activity.push(act(ctx, hold ? `Credit memo request ${id} blocked: E-RMA-07 customer is on credit hold, credit requires Controller release` : `Credit memo request ${id} created for ${money(b.net)} (restocking fee ${money(b.restocking)} posts to 4910)`))
    return { id, blocked: hold }
  })
export const decideCreditMemo = (id: string, outcome: "release" | "reject" | "post", reason: string) =>
  M((db, ctx) => {
    const c = db.fx.creditMemos.find((x) => x.id === id)
    if (!c) throw new ProtoError(`${id} not found.`)
    const r = db.rmas.find((x) => x.id === c.rmaId)!
    if (outcome === "post") {
      need(ctx, ["Finance (credit)", "Controller"], "Posting the credit memo")
      if (c.state !== "Requested" && c.state !== "Released by Controller") throw new ProtoError(`${id} is ${c.state}; it cannot be posted yet.`)
      c.state = "Posted"
      for (const st of r.settlement) if (st.template === 19 && !st.done) { st.done = true; st.error = undefined; st.label = st.label.replace("Credit memo request", `Credit memo request ${c.id}`) }
      r.activity.push(act(ctx, `Credit memo ${id} posted (${money(c.amount)})`))
      return
    }
    need(ctx, ["Controller"], "The Controller credit release")
    if (c.state !== "Blocked: credit hold") throw new ProtoError(`${id} is ${c.state}; only a blocked request is released or rejected by the Controller.`)
    if (!reason.trim()) throw new ProtoError("The Controller release is logged with a reason.", "reason")
    c.state = outcome === "release" ? "Released by Controller" : "Rejected"
    if (outcome === "release") for (const s of r.settlement) if (s.template === 19 && !s.done) { s.released = true; s.error = undefined }
    c.releasedBy = ctx.role
    c.releasedAt = TODAY
    c.reason = reason
    r.activity.push(act(ctx, `Credit memo ${id} ${outcome === "release" ? "released" : "rejected"} by the Controller despite the credit hold. ${reason}`))
  })
export const createRepairQuote = (rmaId: string, lines: { label: string; qty: number; price: number }[]) =>
  M((db, ctx) => {
    need(ctx, ["Customer service", "Customer Service Manager", "Estimator"], "A billable repair quote")
    const r = db.rmas.find((x) => x.id === rmaId)
    if (!r) throw new ProtoError(`RMA ${rmaId} not found.`)
    if (!(r.cls === "RC4" || r.lines.some((l) => l.disposition === "Repair — Billable"))) throw new ProtoError("A billable repair quote applies to an RC4 return or a line dispositioned Repair — Billable.")
    if (db.fx.repairQuotes.some((q) => q.rmaId === rmaId && ["Draft", "Sent to customer", "Approved"].includes(q.state))) throw new ProtoError("An open repair quote already exists for this RMA.")
    const ok = lines.filter((l) => l.label.trim() && l.qty > 0 && l.price >= 0)
    if (!ok.length) throw new ProtoError("Add at least one quote line with a description and a quantity.", "lines")
    const id = `RQ-TBD-${pad(db.fx.seq.rq++)}`
    db.fx.repairQuotes.unshift({ id, rmaId, lines: ok, state: "Draft" })
    r.activity.push(act(ctx, `Billable repair quote ${id} drafted (${money(ok.reduce((s, l) => s + l.qty * l.price, 0))})`))
    return id
  })
export const repairQuoteStep = (id: string, step: "send" | "approve" | "decline", f: { by?: string; reason?: string } = {}) =>
  M((db, ctx) => {
    const q = db.fx.repairQuotes.find((x) => x.id === id)
    if (!q) throw new ProtoError(`${id} not found.`)
    const r = db.rmas.find((x) => x.id === q.rmaId)!
    if (step === "send") {
      need(ctx, ["Customer service", "Customer Service Manager"], "Sending the quote")
      if (q.state !== "Draft") throw new ProtoError(`${id} is ${q.state}.`)
      q.state = "Sent to customer"
      q.sentOn = TODAY
      q.validUntil = addDays(TODAY, 30)
      r.activity.push(act(ctx, `Repair quote ${id} sent to the customer, valid to ${q.validUntil}`))
      return
    }
    if (q.state !== "Sent to customer") throw new ProtoError(`${id} is ${q.state}: the customer decides on a quote that was sent.`)
    if (step === "approve") {
      if (!f.by?.trim()) throw new ProtoError("Record who at the customer approved, and the reference of the approval (purchase order or signed quote).", "by")
      q.state = "Approved"
      q.decidedOn = TODAY
      q.decidedBy = f.by
      q.approvalRef = f.reason
      r.activity.push(act(ctx, `Customer approved repair quote ${id} (${f.by}${f.reason ? `, ${f.reason}` : ""}). Rework order work may start`))
    } else {
      if (!f.reason?.trim()) throw new ProtoError("Record why the customer declined.", "reason")
      q.state = "Declined"
      q.decidedOn = TODAY
      q.decidedBy = f.by
      q.reason = f.reason
      r.activity.push(act(ctx, `Customer declined repair quote ${id}: ${f.reason}. No work starts; the unit returns as-is at customer cost`))
    }
  })
export const decideUnauthorized = (rmaId: string, lineNo: number, decision: "append" | "return", reason: string) =>
  M((db, ctx) => {
    need(ctx, ["Customer Service Manager", "Warehouse supervisor"], "The unauthorized-line decision")
    const r = db.rmas.find((x) => x.id === rmaId)
    if (!r) throw new ProtoError(`RMA ${rmaId} not found.`)
    const l = r.lines.find((x) => x.no === lineNo)
    if (!l?.unauthorized) throw new ProtoError("Choose a line flagged Unauthorized Return.")
    if (l.unauthorizedDecision) throw new ProtoError(`Line ${lineNo} was already decided: ${l.unauthorizedDecision.decision}.`)
    if (!l.condition) throw new ProtoError("The unauthorized line is inspected first (its own inspection) before the decision.")
    if (!reason.trim()) throw new ProtoError("Enter the reason for the decision.", "reason")
    if (decision === "append") {
      l.qtyAuth = Math.max(l.qtyAuth, l.qtyRecd)
      l.unauthorizedDecision = { decision: "Appended via change (re-approval required)", by: ctx.role, on: TODAY, reason }
      r.activity.push(act(ctx, `Unauthorized line ${lineNo} appended to the RMA via a change. Re-approval required. ${reason}`))
    } else {
      l.unauthorizedDecision = { decision: "Returned to customer at customer cost", by: ctx.role, on: TODAY, reason }
      r.activity.push(act(ctx, `Unauthorized line ${lineNo} returned to the customer at customer cost. ${reason}`))
    }
    return decision
  })

// ============================================================================ pack station
export const ATP_LATER = ATP_LATER_DATE
export const shortPack = (dlvId: string, reason: "Short Pick" | "Damage" | "Hold", qty: number, note: string) =>
  M((db, ctx) => {
    need(ctx, ["Warehouse supervisor", "Shipping Manager", "Customer Service Manager"], "A short-pack")
    const d = findDelivery(db, dlvId)
    if (d.status !== "Picking") throw new ProtoError(`E-PCK-TBD: ${d.id} is ${d.status}; short-pack applies while the pack order is in progress (Picking).`)
    const units = d.refs.reduce((s, r) => s + r.qty, 0)
    if (!(qty > 0) || qty >= units) throw new ProtoError(`E-PCK-03: short-pack quantity must be between 1 and ${units - 1} (the pack order has ${units}).`, "qty")
    if (!note.trim()) throw new ProtoError("Add a note for the short-pack.", "note")
    let left = qty
    for (const r of [...d.refs].reverse()) {
      const take = Math.min(left, r.qty)
      r.qty -= take
      left -= take
      const sc = db.orders.find((o) => o.id === r.soId)?.lines.find((l) => l.no === r.line)?.schedules.find((s) => s.no === r.sched)
      if (sc && take) { sc.backorder = true }
      if (!left) break
    }
    d.refs = d.refs.filter((r) => r.qty > 0)
    const pe = (db.fx.packExt[dlvId] ??= { deliveryId: dlvId, nodes: [], creationRule: "Per picklist", photos: [], scaleLog: [] })
    pe.shortPack = { reason, qty, by: ctx.role, at: TODAY, note }
    d.activity.push(act(ctx, `Short-pack ${qty} (${reason}): ${note}. The open remainder stays on its schedule line with the Backorder flag. The pack order can now complete`))
  })
export const attachPhoto = (dlvId: string, hu: string, kind: string) =>
  M((db, ctx) => {
    const pe = (db.fx.packExt[dlvId] ??= { deliveryId: dlvId, nodes: [], creationRule: "Per picklist", photos: [], scaleLog: [] })
    if (pe.photos.some((p) => p.hu === hu && p.kind === kind)) throw new ProtoError(`${kind} is already attached to ${hu}.`)
    pe.photos.push({ hu, kind, at: TODAY })
    findDelivery(db, dlvId).activity.push(act(ctx, `Photo attached to ${hu}: ${kind}`))
  })
export const nestHu = (dlvId: string, hu: string, parent: string | "") =>
  M((db, ctx) => {
    const pe = (db.fx.packExt[dlvId] ??= { deliveryId: dlvId, nodes: [], creationRule: "Per picklist", photos: [], scaleLog: [] })
    const node = pe.nodes.find((n) => n.hu === hu)
    if (!node) throw new ProtoError(`E-PCK-TBD: ${hu} is not on this pack order.`)
    if (parent && parent === hu) throw new ProtoError("An HU cannot nest inside itself.")
    const status = (id: string) => db.hus.find((h) => h.id === id)?.status
    if (status(hu) !== "Open") throw new ProtoError(`E-PCK-TBD: ${hu} is ${status(hu)}. Reopen it before changing its nest.`)
    if (parent && pe.nodes.find((n) => n.hu === parent)?.parent === hu) throw new ProtoError("That would nest the HUs inside each other.")
    node.parent = parent || undefined
    findDelivery(db, dlvId).activity.push(act(ctx, parent ? `${hu} nested under ${parent}` : `${hu} moved to the top of the HU tree`))
  })
export const moveContents = (dlvId: string, from: string, to: string, idx: number, qty: number) =>
  M((db, ctx) => {
    const pe = (db.fx.packExt[dlvId] ??= { deliveryId: dlvId, nodes: [], creationRule: "Per picklist", photos: [], scaleLog: [] })
    const a = pe.nodes.find((n) => n.hu === from)
    const b = pe.nodes.find((n) => n.hu === to)
    if (!a || !b) throw new ProtoError("Choose both handling units.")
    if (from === to) throw new ProtoError("Choose a different target HU.", "to")
    for (const h of [from, to]) if (db.hus.find((x) => x.id === h)?.status !== "Open") throw new ProtoError(`E-PCK-TBD: ${h} is ${db.hus.find((x) => x.id === h)?.status}. Reopen it with a reason before moving contents.`)
    const line = a.contents[idx]
    if (!line) throw new ProtoError("Choose a contents line.", "line")
    if (!(qty > 0) || qty > line.qty) throw new ProtoError(`E-PCK-03: quantity cannot exceed ${line.qty} (the quantity in ${from}).`, "qty")
    const split = qty < line.qty
    line.qty -= qty
    const t = b.contents.find((x) => x.item === line.item && x.note === line.note)
    if (t) t.qty += qty
    else b.contents.push({ item: line.item, qty, note: line.note })
    if (line.qty === 0) a.contents.splice(idx, 1)
    findDelivery(db, dlvId).activity.push(act(ctx, `${split ? "Split" : "Moved"} ${qty} × ${line.item} from ${from} to ${to}`))
  })
export const manualWeight = (huId: string, kg: number, reason: string, badge: string) =>
  M((db, ctx) => {
    const hu = db.hus.find((h) => h.id === huId)
    if (!hu) throw new ProtoError("HU not found.")
    if (hu.status !== "Open") throw new ProtoError(`${hu.id} is ${hu.status}.`)
    if (!(kg > 0)) throw new ProtoError("Enter the gross weight in kg.", "kg")
    if (!badge.trim()) throw new ProtoError("Manual weight entry needs a supervisor badge (flagged on the HU).", "badge")
    if (!reason.trim()) throw new ProtoError("Enter why the scale reading could not be used.", "reason")
    hu.actualKg = kg
    const pe = (db.fx.packExt[hu.deliveryId] ??= { deliveryId: hu.deliveryId, nodes: [], creationRule: "Per picklist", photos: [], scaleLog: [] })
    pe.scaleLog.unshift({ at: TODAY, kg, state: "error" })
    findDelivery(db, hu.deliveryId).activity.push(act(ctx, `${hu.id}: gross weight ${kg} kg entered manually with supervisor flag (${badge}). ${reason}`))
  })
export const quoteShipId = shipIdOf
export const KIT_ATP = kitComponentAtp
export const SIM_RUN = simulateRun
export const userNameOf = userName
export const plannedShip = (db: DB, d: { id: string }): ShipExt | undefined => db.fx.ship[d.id]

// ============================================================================ planning hand-off (CTP-DLG, planning request R-1)
/** The Promise Dialog (planning module) decided a quote or order line: write the promise onto the document. */
export function applyPromiseDecision(db: DB, ctx: MutateCtx, p: { doc: { type: string; id: string }; line: number; decision: string; shipDate?: string; binding?: string; snapshotId?: string }) {
  if (p.doc.type === "salesOrder") {
    const o = db.orders.find((x) => x.id === p.doc.id)
    const l = o?.lines.find((x) => x.no === p.line)
    if (!o || !l) return
    if (p.decision === "Accepted" && p.shipDate) {
      for (const s of l.schedules) if (s.status === "Open") { s.status = "Confirmed"; s.confQty = s.reqQty; s.confDate = p.shipDate; s.constraint = p.binding; s.snapshot = p.snapshotId }
      l.promisedShip = p.shipDate
      o.activity.push(act(ctx, `CTP promise accepted on line ${p.line}: ship ${p.shipDate}${p.binding ? `, binding constraint ${p.binding}` : ""}. Open schedule lines Open → Confirmed`))
    } else o.activity.push(act(ctx, `CTP promise ${p.decision.toLowerCase()} on line ${p.line}${p.decision === "Declined" ? "; soft reservation released, schedule stays Open" : ""}`))
  } else if (p.doc.type === "quotation") {
    const q = db.quotations.find((x) => x.id === p.doc.id)
    if (!q) return
    const ext = quoteExtOf(db, q)
    if (p.decision === "Accepted" && p.shipDate) ext.ctp[p.line] = { state: "Feasible", date: p.shipDate, constraint: p.binding }
    else if (p.decision === "Planner review") ext.ctp[p.line] = { state: "Pending", constraint: "Planner review requested" }
    db.fx.quoteExt[q.id] = ext
    q.activity.push(act(ctx, `CTP ${p.decision.toLowerCase()} for line ${p.line}${p.shipDate ? `: feasible ${p.shipDate}` : ""}`))
  }
}

// ============================================================================ pack station: tree sync and creation rule
const TYPE_BY_KG = (kg: number) => (kg > 10000 ? "Heavy skid" : kg > 2000 ? "Pallet" : "Accessory crate")
/** One node per HU of the delivery, so the HU tree builder has a place to nest and move contents. */
export const syncPackNodes = (dlvId: string) =>
  M((db) => {
    const d = findDelivery(db, dlvId)
    const pe = (db.fx.packExt[dlvId] ??= { deliveryId: dlvId, nodes: [], creationRule: db.fx.packRule, photos: [], scaleLog: [] })
    let added = 0
    for (const h of db.hus.filter((x) => x.deliveryId === d.id))
      if (!pe.nodes.some((n) => n.hu === h.id)) {
        pe.nodes.push({ hu: h.id, type: TYPE_BY_KG(h.expectedKg), contents: [{ item: "PACK-TBD-DESIC", qty: 2, note: "Desiccant bags" }] })
        added++
      }
    pe.nodes = pe.nodes.filter((n) => db.hus.some((h) => h.id === n.hu))
    return added
  })
export const setPackRule = (rule: "Per picklist" | "Per shipment") =>
  M((db, ctx) => {
    need(ctx, ["Process owner", "Shipping Manager", "Warehouse supervisor"], "The pack order creation rule (configuration)")
    db.fx.packRule = rule
  })

// ============================================================================ installed base: unknown-site worklist
export const assignSites = (ibIds: string[], site: string) =>
  M((db, ctx) => {
    need(ctx, ["Customer service", "Customer Service Manager", "Sales admin"], "Assigning an installed base site")
    if (!ibIds.length) throw new ProtoError("Select at least one installed base record.")
    if (!site.trim()) throw new ProtoError("Enter or choose the site.", "site")
    let n = 0
    for (const id of ibIds) {
      const x = db.ib.find((i) => i.id === id)
      if (!x) continue
      if (x.status === "Scrapped") throw new ProtoError(`${x.id} is Scrapped: its site is read-only.`)
      x.site = site.trim()
      x.history.push({ on: TODAY, text: `Site assigned: ${site.trim()} (bulk assignment, ${ibIds.length} record(s))` })
      n++
    }
    return n
  })
