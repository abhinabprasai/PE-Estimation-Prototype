// Actions for the sales and service screens beyond FL-09. Each is one atomic write to the "sales"
// slice through the root store (a ProtoError changes nothing). Cross-module effects go out on the
// event bus after commit (ctx.emit). Role gates only where a PRD rule names the role (ASM-PERM-1);
// each gate is listed in the screen's RulesPanel.

import { ProtoError, store, type MutateCtx, type Result } from "@/store"
import type { DocRef, Role } from "@/data/domain"
import { USERS, userById } from "@/data/shared/users"
import { addDays, daysBetween, money, product, TODAY, type Activity, type Customer, type DB, type Quotation, type SalesOrder, type Schedule } from "./model"
import {
  AUTO_HOLD_EXEMPTABLE, CUSTOMER_CLASSES, DEFAULT_WIN_PROB, QUAL_CHECKLIST, QUARANTINE_WAREHOUSES, restockDefault, restockRoleLimit, freightDefault,
  type Attributable, type Condition, type CustAddress, type CustContact, type Disposition, type Ib, type Lead, type LeadSource, type PriorDecision, type PriorMatch,
  type RefType, type Requirement, type Rma, type RmaClass, type RmaLine, type RmaReason, type SettleStep, type SupplyOption,
} from "./ext-model"
import { CUSTOMER_BUFFERS, DESIGNS, DESIGN_OF_ITEM, QUARANTINE, valuationOf } from "./ext-seed"

const M = <T>(fn: (db: DB, ctx: MutateCtx) => T): Result<T> => store.mutate("sales", fn)
const act = (ctx: MutateCtx, text: string): Activity => ({ at: TODAY, by: ctx.role, text })
const pad = (n: number, w = 4) => String(n).padStart(w, "0")

export const FIN_ROLES: Role[] = ["Finance (credit)", "Controller", "CFO"]
export const CS_ROLES: Role[] = ["Customer service", "Customer Service Manager"]
export const INSPECT_ROLES: Role[] = ["Inspector", "Quality engineer", "Quality Manager"]
export const RECEIVING_ROLES: Role[] = ["Receiving clerk", "Warehouse operator", "Warehouse supervisor"]
const need = (ctx: MutateCtx, roles: Role[], what: string) => {
  if (!roles.includes(ctx.role)) throw new ProtoError(`${what} is done by ${roles.join(" or ")}. You are acting as ${ctx.role}; switch "Acting as" to continue.`)
}
export const userName = (id?: string) => (id ? userById(id)?.name ?? id : "Not recorded")

// ============================================================================ shared helpers
/** Business days from a to b (Mon-Fri), for the receipt-to-inspection SLA. */
export function businessDays(a: string, b: string) {
  let n = 0
  for (let d = a; d < b; d = addDays(d, 1)) {
    const day = new Date(d + "T12:00:00Z").getUTCDay()
    if (day !== 0 && day !== 6) n++
  }
  return n
}
export const rmaValue = (r: Rma) => (r.cls === "RC4" ? 0 : r.lines.reduce((s, l) => s + l.qtyAuth * l.origPrice, 0) * (1 - r.restockPct / 100))
export const rmaGross = (r: Rma) => r.lines.reduce((s, l) => s + l.qtyAuth * l.origPrice, 0)
export const rmaSlaBreached = (r: Rma) => r.status === "Received" && !!r.receivedDate && businessDays(r.receivedDate, TODAY) > 5
export const ageDays = (since: string) => daysBetween(since, TODAY)
/** Routing context for the RMA approval. No Reference: the CS Manager approves regardless of value
 *  (step 1 of every RMA route) and the Controller approval is mandatory for any credit [DOC:p.26 §3.9].
 *  The shared route has no no-reference flag (Request FR-12), so the Controller step is added through
 *  the route's goodwill flag; the screen shows this as reading SR-15. */
export const rmaApprovalCtx = (r: Rma) => ({
  rmaClass: (r.recallId ? "Recall" : r.cls) as RmaClass | "Recall",
  warranty: r.warranty === "Yes",
  goodwill: !!r.goodwill || (r.refType === "No Reference" && r.cls !== "RC4"),
})
/** Receipt-to-inspection SLA breach alerts the Quality Manager [DOC:p.27 §3.10, alert rules INV 15.11].
 *  Sweep run at start and after each RMA write; raises one alert per breach (module-only event). */
export function raiseRmaSlaAlerts(db: DB, ctx: MutateCtx) {
  for (const r of db.rmas) {
    if (!rmaSlaBreached(r) || r.slaAlert) continue
    const n = businessDays(r.receivedDate!, TODAY)
    r.slaAlert = { on: TODAY, to: "Quality Manager", businessDays: n }
    r.activity.push({ at: TODAY, by: "System", text: `Receipt-to-inspection SLA breached (${n} business days since receipt ${r.receivedDate}, limit 5): alert sent to the Quality Manager` })
    ctx.emit("sales.rmaSlaBreached", { rmaId: r.id, notify: "Quality Manager", businessDays: n })
  }
}

/** Warranty entitlement service (p.215 §7.4): start = ship date by default; contract may elect POD or
 *  commissioning date capped at ship + N months; duration from item + SO override; extensions dated
 *  with approval. N = 6 months is a design value (the PRD says "config"). */
export const ELECTION_CAP_MONTHS = 6
const addMonths = (iso: string, m: number) => {
  const d = new Date(iso + "T12:00:00Z")
  d.setUTCMonth(d.getUTCMonth() + m)
  return d.toISOString().slice(0, 10)
}
export function entitlement(ib: Ib, claimDate = TODAY, openRecall?: string) {
  const trail: string[] = []
  let start = ib.shipDate
  trail.push(`Ship date ${ib.shipDate} (default start).`)
  if (ib.warrantyBasis !== "Ship date") {
    const elected = ib.warrantyBasis === "POD date" ? ib.podDate : ib.commissioningDate
    const cap = addMonths(ib.shipDate, ELECTION_CAP_MONTHS)
    if (elected) {
      start = elected < cap ? elected : cap
      trail.push(`Contract elects ${ib.warrantyBasis.toLowerCase()} ${elected}${elected > cap ? `, capped at ship + ${ELECTION_CAP_MONTHS} months (${cap})` : ""}.`)
    } else trail.push(`Contract elects ${ib.warrantyBasis.toLowerCase()}, not captured yet: ship date applies.`)
  }
  const months = ib.soOverrideMonths ?? ib.warrantyMonths
  trail.push(ib.soOverrideMonths ? `Duration ${ib.soOverrideMonths} months from the sales order override (item default ${ib.warrantyMonths}).` : `Duration ${ib.warrantyMonths} months from the item.`)
  let end = addMonths(start, months)
  for (const x of ib.extensions)
    if (x.approved) {
      end = addMonths(end, x.months)
      trail.push(`Extension ${x.id} +${x.months} months (approved ${x.on}).`)
    } else if (x.decided?.outcome === "Rejected") trail.push(`Extension ${x.id} +${x.months} months was rejected and does not count.`)
    else trail.push(`Extension ${x.id} +${x.months} months is waiting for approval and does not count.`)
  if (ib.transfers.length) trail.push(`Ownership transferred ${ib.transfers.length} time(s); entitlement follows the unit.`)
  let verdict: "covered" | "not covered" | "conditional" = claimDate <= end ? "covered" : "not covered"
  if (verdict === "covered" && ib.status === "Scrapped") verdict = "not covered"
  if (verdict === "covered" && openRecall) {
    verdict = "conditional"
    trail.push(`Open campaign ${openRecall} on this unit: adjudication checks the exclusions catalog.`)
  }
  trail.push(`Claim date ${claimDate}: ${verdict}.`)
  return { verdict, start, end, months, trail }
}

// ============================================================================ OM-LEAD
export function priorBuildSearch(db: DB, req: Requirement): PriorMatch[] {
  const keys: (keyof Requirement)[] = ["kva", "primaryV", "secondaryV", "phases", "frequency", "vectorGroup", "cooling", "impedancePct", "tap", "standards"]
  const given = keys.filter((k) => req[k]?.trim())
  if (!given.length) return []
  const norm = (v?: string) => (v ?? "").toLowerCase().replace(/\s+/g, "")
  const out: PriorMatch[] = []
  for (const d of DESIGNS) {
    const matched = given.filter((k) => (k === "impedancePct" ? Math.abs(Number(req[k]) - Number(d.req[k])) <= 0.5 : norm(req[k]) === norm(d.req[k])))
    const score = Math.round((matched.length / given.length) * 100)
    if (score >= 30) out.push({ ref: d.ref, label: d.label, score, source: "Design library", matched: matched.map(String) })
  }
  // Installed base surfaces when the attribute set matches a shipped unit (p.249 Build Note).
  for (const ib of db.ib) {
    const design = DESIGN_OF_ITEM[ib.itemId]
    const hit = out.find((m) => m.ref === design && m.score >= 70)
    if (hit && !out.some((m) => m.ref === ib.id)) out.push({ ref: ib.id, label: `Shipped unit ${ib.serial} at ${ib.site.split(",")[0]} (${design})`, score: hit.score, source: "Installed base", matched: hit.matched })
  }
  return out.sort((a, b) => b.score - a.score)
}

const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? ""
export function duplicateCheck(db: DB, company: string, email: string, exceptId?: string) {
  const c = company.trim().toLowerCase()
  const dom = domainOf(email)
  const hits: string[] = []
  for (const l of db.leads) if (l.id !== exceptId && (l.company.toLowerCase() === c || (dom && domainOf(l.email) === dom))) hits.push(`${l.id} ${l.company}`)
  for (const cu of db.customers) if (cu.name.toLowerCase() === c || (dom && dom.includes(cu.id.toLowerCase()))) hits.push(`${cu.id} ${cu.name}`)
  return hits
}

export interface NewLead {
  title: string
  company: string
  contactName: string
  contactTitle: string
  email: string
  phone: string
  address: string
  source: LeadSource
  region: string
  estValue: number
  currency: "USD" | "CAD"
}
export const createLead = (f: NewLead, force: boolean) =>
  M((db, ctx) => {
    if (!f.company.trim()) throw new ProtoError("Company name is mandatory.", "company")
    if (!f.title.trim()) throw new ProtoError("Give the lead a short title.", "title")
    const dup = duplicateCheck(db, f.company, f.email)
    if (dup.length && !force) throw new ProtoError(`V-OM-40 possible duplicate on company name or email domain: ${dup.join("; ")}. Review, then save anyway if this is a new requirement.`, "duplicate")
    const id = `LEAD-TBD-${pad(db.seq2.lead++)}`
    db.leads.unshift({
      id, ...f, ownerId: ctx.userId, req: {}, awardDate: addDays(TODAY, 90), competitor: "", winProb: DEFAULT_WIN_PROB.Open, stage: "Open", stageSince: TODAY, created: TODAY,
      checklist: Object.fromEntries(QUAL_CHECKLIST.map((k) => [k, false])), quotationIds: [],
      activity: [act(ctx, `Lead created (${f.source})${dup.length ? `; duplicate warning acknowledged (${dup.join("; ")})` : ""}`)],
    })
    return id
  })

const findLead = (db: DB, id: string) => {
  const l = db.leads.find((x) => x.id === id)
  if (!l) throw new ProtoError(`Lead ${id} not found.`)
  return l
}
/** Owner scoping [DOC:p.248 OM-LEAD users]: sales reps own their records; the Sales Director reads all
 *  (and reassigns). A Sales rep acting on another rep's lead is refused. */
const ownLead = (db: DB, id: string, ctx: MutateCtx) => {
  const l = findLead(db, id)
  if (ctx.role === "Sales rep" && l.ownerId !== ctx.userId) throw new ProtoError(`${l.id} is owned by ${userName(l.ownerId)}. Sales reps work their own leads; ask the Sales Director to reassign it.`)
  return l
}
const closedLead = (l: Lead) => ["Won", "Lost", "Disqualified"].includes(l.stage)

export const updateLead = (id: string, patch: Partial<Pick<Lead, "contactName" | "contactTitle" | "email" | "phone" | "address" | "competitor" | "estValue" | "awardDate" | "winProb" | "req" | "region">>) =>
  M((db, ctx) => {
    const l = ownLead(db, id, ctx)
    if (closedLead(l)) throw new ProtoError(`${l.id} is ${l.stage}; it opens read-only.`)
    Object.assign(l, patch)
  })
export const toggleChecklist = (id: string, item: string) =>
  M((db, ctx) => {
    const l = ownLead(db, id, ctx)
    if (l.stage !== "Open") throw new ProtoError("The qualification checklist is worked while the lead is Open.")
    l.checklist[item] = !l.checklist[item]
  })
export const qualifyLead = (id: string) =>
  M((db, ctx) => {
    const l = ownLead(db, id, ctx)
    if (l.stage !== "Open") throw new ProtoError(`V-OM-41: stage transitions only along the defined path. ${l.id} is ${l.stage}; Qualify applies to Open leads.`)
    const missing = QUAL_CHECKLIST.filter((k) => !l.checklist[k])
    if (missing.length) throw new ProtoError(`Open to Qualified requires the qualification checklist complete. Missing: ${missing.join(", ")}.`, "checklist")
    l.stage = "Qualified"
    l.stageSince = TODAY
    l.oppId = `OPP-TBD-${pad(db.seq2.opp++)}`
    l.winProb = DEFAULT_WIN_PROB.Qualified
    l.activity.push(act(ctx, `Qualified to opportunity ${l.oppId}. Stage Open → Qualified`))
    return l.oppId
  })
export const runPriorSearch = (id: string) =>
  M((db, ctx) => {
    const l = ownLead(db, id, ctx)
    l.priorMatches = priorBuildSearch(db, l.req)
    l.activity.push(act(ctx, `Prior build search run on ${Object.values(l.req).filter(Boolean).length} attributes: ${l.priorMatches.length} match(es)`))
    return l.priorMatches.length
  })
export const choosePriorBuild = (id: string, ref: string, decision: PriorDecision) =>
  M((db, ctx) => {
    const l = ownLead(db, id, ctx)
    const m = l.priorMatches?.find((x) => x.ref === ref)
    if (!m && decision !== "New Design") throw new ProtoError("Pick a match from the search, or record New Design.")
    l.priorBuild = { ref: m?.ref ?? "none", score: m?.score ?? 0, decision }
    l.activity.push(act(ctx, `Prior build decision: ${decision}${m ? ` (${m.ref}, match ${m.score}%)` : ""}. Copies to the engineering request when the order confirms`))
  })
export const disqualifyLead = (id: string, reason: string, note: string) =>
  M((db, ctx) => {
    const l = ownLead(db, id, ctx)
    if (!["Open", "Qualified"].includes(l.stage)) throw new ProtoError(`V-OM-41: ${l.id} is ${l.stage}. Disqualify applies to Open or Qualified leads; Won and Lost come only from the quotation.`)
    if (!reason) throw new ProtoError("A reason code is required to disqualify.", "reason")
    l.stage = "Disqualified"
    l.stageSince = TODAY
    l.disqualifyReason = reason
    l.winProb = 0
    l.activity.push(act(ctx, `Disqualified: ${reason}${note ? `. ${note}` : ""}`))
  })
export const deleteLead = (id: string) =>
  M((db, ctx) => {
    const l = ownLead(db, id, ctx)
    if (l.quotationIds.length) throw new ProtoError(`E-OM-43: ${l.id} owns ${l.quotationIds.join(", ")}. A lead that owns a quotation cannot be deleted; disqualify it instead.`)
    db.leads = db.leads.filter((x) => x.id !== id)
  })
export const reassignLead = (id: string, ownerId: string) =>
  M((db, ctx) => {
    if (ctx.role !== "Sales Director") throw new ProtoError("The owner is reassigned only by the Sales Director (p.249 §4.1).")
    const l = findLead(db, id)
    l.ownerId = ownerId
    l.activity.push(act(ctx, `Owner reassigned to ${userName(ownerId)}`))
  })

export const ITEM_BY_KVA: Record<string, string> = { "20000": "FIN-TBD-20MVA", "7500": "FIN-TBD-7500MTO", "5000": "FIN-TBD-5000SS", "2500": "FIN-TBD-2500PM", "1000": "FIN-TBD-1000PM", "167": "FIN-TBD-0167PL" }
export const convertLeadToQuote = (id: string) =>
  M((db, ctx) => {
    const l = ownLead(db, id, ctx)
    if (l.stage !== "Qualified" && l.stage !== "Quoting") throw new ProtoError(`V-OM-41: convert from a Qualified lead. ${l.id} is ${l.stage}.`)
    const missing = [["company", l.company], ["contact name", l.contactName], ["email", l.email]].filter(([, v]) => !v?.trim()).map(([k]) => k)
    if (missing.length) throw new ProtoError(`V-OM-42: conversion blocked while mandatory contact fields are empty: ${missing.join(", ")}.`, "contact")
    let custId = l.customerId
    if (!custId) {
      custId = `CUS-TBD-${pad(db.seq2.cus++)}`
      const c: Customer = { id: custId, name: l.company, cls: "", status: "Prospect", currency: l.currency, incoterms: "DAP", creditLimit: 0, exposure: 0, creditHold: false, pastDue30: false, risk: "D", priority: "C", billTo: l.address || "Not recorded", shipTo: "Not recorded" }
      db.customers.push(c)
      db.custExt[custId] = {
        segment: "Not recorded", ownerId: l.ownerId, addresses: l.address ? [{ kind: "Bill-To", isDefault: true, site: "Head office", text: l.address }] : [],
        contacts: [{ name: l.contactName, title: l.contactTitle, roles: ["Purchasing"], email: l.email, phone: l.phone, primary: true }],
        paymentTerms: "Not set (ACC)", freightTerms: "Not set", invoiceDelivery: "Email PDF", consolidation: "Per shipment", taxExempt: false, nexus: [l.currency === "CAD" ? "CA" : "US"], exemptFromAutoHold: false, documents: [],
        activity: [act(ctx, `Prospect created from ${l.id}: no credit limit and no financial views until Finance activates it`)],
      }
      l.customerId = custId
    }
    const item = ITEM_BY_KVA[(l.req.kva ?? "").replace(/[^0-9]/g, "")] ?? "FIN-TBD-20MVA"
    const p = product(item)
    const unit = l.currency === "CAD" ? Math.round(p.unitPrice * 1.36) : p.unitPrice
    const qty = Math.max(1, Math.round(l.estValue / unit))
    const qid = `QT-TBD-0${db.seq2.qt++}-V1`
    const q: Quotation = {
      id: qid, version: 1, status: "Draft", customerId: custId, validUntil: addDays(TODAY, 30), lines: [{ no: 10, item, qty, price: unit }], leadId: l.id,
      config: Object.fromEntries(Object.entries(l.req).filter(([, v]) => v)) as Record<string, string>, priorBuildRef: l.priorBuild?.ref,
      activity: [act(ctx, `Created from ${l.id}${l.oppId ? ` (opportunity ${l.oppId})` : ""}: every captured attribute and the prior build reference carried forward`)],
    }
    db.quotations.unshift(q)
    l.quotationIds.push(qid)
    if (l.stage === "Qualified") {
      l.stage = "Quoting"
      l.stageSince = TODAY
      l.winProb = DEFAULT_WIN_PROB.Quoting
    }
    l.activity.push(act(ctx, `Converted to quotation ${qid}. Stage Qualified → Quoting (automatic at quotation creation)`))
    return qid
  })

// ============================================================================ OM-CUST
const findCust = (db: DB, id: string) => {
  const c = db.customers.find((x) => x.id === id)
  if (!c) throw new ProtoError(`Customer ${id} not found.`)
  return c
}
export const createCustomer = (f: { name: string; cls: string; currency: "USD" | "CAD"; incoterms: string }) =>
  M((db, ctx) => {
    if (!f.name.trim()) throw new ProtoError("Legal name is required.", "name")
    const dup = db.customers.find((c) => c.name.toLowerCase() === f.name.trim().toLowerCase())
    if (dup) throw new ProtoError(`${dup.id} already carries the legal name "${dup.name}".`, "name")
    const id = `CUS-TBD-${pad(db.seq2.cus++)}`
    db.customers.push({ id, name: f.name.trim(), cls: f.cls, status: "Prospect", currency: f.currency, incoterms: f.incoterms, creditLimit: 0, exposure: 0, creditHold: false, pastDue30: false, risk: "D", priority: "C", billTo: "Not recorded", shipTo: "Not recorded" })
    db.custExt[id] = { segment: "Not recorded", ownerId: ctx.userId, addresses: [], contacts: [], paymentTerms: "Not set (ACC)", freightTerms: "Not set", invoiceDelivery: "Email PDF", consolidation: "Per shipment", taxExempt: false, nexus: [f.currency === "CAD" ? "CA" : "US"], exemptFromAutoHold: false, documents: [], activity: [act(ctx, "Customer created in Prospect")] }
    return id
  })
export const addAddress = (id: string, a: CustAddress) =>
  M((db, ctx) => {
    const c = findCust(db, id)
    if (!a.text.trim()) throw new ProtoError("Enter the address.", "text")
    const x = db.custExt[id]
    if (a.isDefault) for (const o of x.addresses) if (o.kind === a.kind || a.kind === "Both") o.isDefault = false
    x.addresses.push(a)
    if ((a.kind === "Bill-To" || a.kind === "Both") && (a.isDefault || c.billTo === "Not recorded")) c.billTo = a.text
    if ((a.kind === "Ship-To" || a.kind === "Both") && (a.isDefault || c.shipTo === "Not recorded")) c.shipTo = a.text
    x.activity.push(act(ctx, `${a.kind} address added: ${a.site}`))
  })
export const addContact = (id: string, k: CustContact) =>
  M((db, ctx) => {
    findCust(db, id)
    if (!k.name.trim() || !k.email.includes("@")) throw new ProtoError("A contact needs a name and a valid email.", "contact")
    db.custExt[id].contacts.push(k)
    db.custExt[id].activity.push(act(ctx, `Contact added: ${k.name}`))
  })
const POSTAL = /(\b\d{5}(-\d{4})?\b)|(\b[A-Z]\d[A-Z] ?\d[A-Z]\d\b)/
export function activationCheck(db: DB, id: string): string[] {
  const x = db.custExt[id]
  const errs: string[] = []
  const bill = x.addresses.filter((a) => a.kind === "Bill-To" || a.kind === "Both")
  const ship = x.addresses.filter((a) => a.kind === "Ship-To" || a.kind === "Both")
  if (!bill.length || !ship.length) errs.push("V-OM-01: at least one Bill-To and one Ship-To address are needed before status Active.")
  for (const a of x.addresses) if (!POSTAL.test(a.text)) errs.push(`Address validation: "${a.site}" has no valid US ZIP or Canadian postal code.`)
  if (!x.priceList) errs.push("A price list is required for Active.")
  const c = db.customers.find((y) => y.id === id)
  if (c && !(CUSTOMER_CLASSES as readonly string[]).includes(c.cls)) errs.push("Customer Class is required: pick one of the listed classes (General tab).")
  return errs
}
export const setPriceList = (id: string, pl: string) =>
  M((db, ctx) => {
    findCust(db, id)
    db.custExt[id].priceList = pl
    db.custExt[id].activity.push(act(ctx, `Price list set to ${pl}`))
  })
export const activateCustomer = (id: string) =>
  M((db, ctx) => {
    need(ctx, FIN_ROLES, "Activation (Finance activates through the customer master path, p.249)")
    const c = findCust(db, id)
    if (!["Prospect", "Inactive", "On Hold"].includes(c.status)) throw new ProtoError(`${c.id} is ${c.status}; Activate applies to Prospect, On Hold or Inactive.`)
    const errs = activationCheck(db, id)
    if (errs.length) throw new ProtoError(errs.join(" "), "activation")
    const from = c.status
    c.status = "Active"
    db.custExt[id].activity.push(act(ctx, `Activated with address validation passed. Status ${from} → Active`))
  })
export const setCustomerStatus = (id: string, status: "On Hold" | "Blocked" | "Inactive", reason: string) =>
  M((db, ctx) => {
    need(ctx, FIN_ROLES, "Changing a customer to On Hold, Blocked or Inactive")
    const c = findCust(db, id)
    if (!reason.trim()) throw new ProtoError("A reason is required.", "reason")
    if (status === "Inactive" && db.orders.some((o) => o.customerId === id && !["Invoiced/Closed", "Cancelled", "Rejected"].includes(o.status))) throw new ProtoError(`${c.id} has open sales orders; close or cancel them before Inactive.`)
    const from = c.status
    c.status = status
    db.custExt[id].activity.push(act(ctx, `Status ${from} → ${status}. Reason: ${reason}`))
  })
export const toggleCreditHold = (id: string, reason: string) =>
  M((db, ctx) => {
    need(ctx, FIN_ROLES, "The credit hold toggle (Sales cannot release credit holds)")
    const c = findCust(db, id)
    if (!reason.trim()) throw new ProtoError("A reason is required.", "reason")
    c.creditHold = !c.creditHold
    db.custExt[id].activity.push(act(ctx, `Credit hold flag ${c.creditHold ? "set" : "released"}. Reason: ${reason}`))
  })
export const setCreditLimit = (id: string, limit: number) =>
  M((db, ctx) => {
    if (ctx.role !== "Controller") throw new ProtoError("Credit limit is a Controller-owned field (p.49 §2.1).")
    if (!(limit >= 0)) throw new ProtoError("Enter a limit of zero or more.", "limit")
    const c = findCust(db, id)
    const from = c.creditLimit
    c.creditLimit = limit
    db.custExt[id].lastReview = TODAY
    db.custExt[id].reviewer = ctx.userId
    db.custExt[id].activity.push(act(ctx, `Credit limit ${money(from, c.currency)} → ${money(limit, c.currency)}`))
  })
export const setRiskClass = (id: string, risk: Customer["risk"]) =>
  M((db, ctx) => {
    need(ctx, FIN_ROLES, "Credit tab edits")
    const c = findCust(db, id)
    c.risk = risk
    db.custExt[id].activity.push(act(ctx, `Risk class set to ${risk}`))
  })
/** Exempt from Auto Hold: Controller only, on Government or municipal class customers [DOC:p.49 §2.2]. */
export const setAutoHoldExempt = (id: string, exempt: boolean, reason: string) =>
  M((db, ctx) => {
    if (ctx.role !== "Controller") throw new ProtoError("Exempt from Auto Hold is set by the Controller only (p.49 §2.2).")
    const c = findCust(db, id)
    if (exempt && !AUTO_HOLD_EXEMPTABLE.includes(c.cls)) throw new ProtoError(`Only Government or municipal class customers can be exempt from automatic hold; ${c.name} is ${c.cls || "not classed"}.`)
    if (!reason.trim()) throw new ProtoError("Give the reason.", "reason")
    const x = db.custExt[id]
    x.exemptFromAutoHold = exempt
    x.activity.push(act(ctx, `Exempt from Auto Hold ${exempt ? "set" : "cleared"}. Reason: ${reason}`))
  })
/** Customer Class (dropdown, required) [DOC:p.49 §2.1]. */
export const setCustomerClass = (id: string, cls: string) =>
  M((db, ctx) => {
    if (!(CUSTOMER_CLASSES as readonly string[]).includes(cls)) throw new ProtoError("Pick a Customer Class from the list.", "cls")
    const c = findCust(db, id)
    const x = db.custExt[id]
    if (x && c.cls !== cls) x.activity.push(act(ctx, `Customer class ${c.cls || "not set"} → ${cls}`))
    c.cls = cls
    if (x && x.exemptFromAutoHold && !AUTO_HOLD_EXEMPTABLE.includes(cls)) {
      x.exemptFromAutoHold = false
      x.activity.push(act(ctx, "Exempt from Auto Hold cleared: the new class is not Government or municipal"))
    }
  })
export const setPriorityClass = (id: string, p: Customer["priority"]) =>
  M((db, ctx) => {
    if (ctx.role !== "Sales Director") throw new ProtoError("Customer priority class is owned by the Sales Director (p.207 §2.2).")
    const c = findCust(db, id)
    c.priority = p
    db.custExt[id].activity.push(act(ctx, `Priority class set to ${p}`))
  })

// ============================================================================ OM-BO
export interface BoRow {
  key: string
  soId: string
  line: number
  sched: number
  customerId: string
  item: string
  reqQty: number
  openQty: number
  reqDate: string
  confDate?: string
  status: string
  peg?: string
  kind: "Unconfirmed backorder" | "Slipped promise" | "At risk"
  rank: number
  priority: string
  created: string
  atRiskBy?: number
  /** Active contractual customer buffer for this customer and item (Book I A §10.3): allocated first. */
  buffer?: string
}
export function backorderRows(db: DB): BoRow[] {
  const rows: Omit<BoRow, "rank">[] = []
  for (const o of db.orders) {
    if (!["Confirmed", "In Fulfillment", "Partially Shipped"].includes(o.status)) continue
    const c = db.customers.find((x) => x.id === o.customerId)!
    for (const l of o.lines)
      for (const s of l.schedules) {
        if (["Delivered", "Closed", "Cancelled", "Partially Delivered", "Delivery Due"].includes(s.status)) continue
        const supply = db.supply.find((x) => x.ref === s.peg && x.kind === "Production order")
        const atRisk = !!supply && !!s.confDate && supply.date > s.confDate
        if (!s.backorder && !atRisk) continue
        rows.push({
          key: `${o.id}/${l.no}/${s.no}`, soId: o.id, line: l.no, sched: s.no, customerId: o.customerId, item: l.item, reqQty: s.reqQty, openQty: s.reqQty - s.deliveredQty - s.cancelledQty, reqDate: s.reqDate, confDate: s.confDate,
          status: s.status, peg: s.peg, kind: atRisk ? "At risk" : s.status === "Open" ? "Unconfirmed backorder" : "Slipped promise", priority: c.priority, created: o.created, atRiskBy: atRisk && supply && s.confDate ? daysBetween(s.confDate, supply.date) : undefined,
          buffer: CUSTOMER_BUFFERS.find((b) => b.customerId === o.customerId && b.item === l.item && b.validFrom <= TODAY && TODAY <= b.validTo)?.agreement,
        })
      }
  }
  // Priority order (p.207 §2.2): contractual buffers first, then customer priority class, then requested date, then entry time.
  const sorted = [...rows].sort((a, b) => Number(!a.buffer) - Number(!b.buffer) || a.priority.localeCompare(b.priority) || a.reqDate.localeCompare(b.reqDate) || a.created.localeCompare(b.created))
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }))
}
export const optionsFor = (db: DB, item: string) => db.supply.filter((x) => x.itemId === item || x.forItem === item)
/** Donor candidates: allocated confirmed supply of the same item on another order. */
export function donorsFor(db: DB, row: BoRow) {
  const out: { soId: string; line: number; sched: number; qty: number; customerId: string; priority: string; confDate?: string }[] = []
  for (const o of db.orders) {
    if (o.id === row.soId || !["Confirmed", "In Fulfillment"].includes(o.status)) continue
    const c = db.customers.find((x) => x.id === o.customerId)!
    for (const l of o.lines)
      if (l.item === row.item)
        for (const s of l.schedules) if (s.status === "Allocated/Pegged" && !s.deliveryId) out.push({ soId: o.id, line: l.no, sched: s.no, qty: s.confQty ?? s.reqQty, customerId: o.customerId, priority: c.priority, confDate: s.confDate })
  }
  return out.sort((a, b) => b.priority.localeCompare(a.priority))
}
function findSched(db: DB, soId: string, line: number, sched: number) {
  const o = db.orders.find((x) => x.id === soId)
  const l = o?.lines.find((x) => x.no === line)
  const s = l?.schedules.find((x) => x.no === sched)
  if (!o || !l || !s) throw new ProtoError(`Schedule ${soId}/${line}/${sched} not found.`)
  return { o, l, s }
}
const BO_ROLES: Role[] = ["Planner", "Planning Manager", "Sales admin", "Sales Director"]
function confirmTo(s: Schedule, qty: number, opt: SupplyOption) {
  s.confQty = qty
  s.confDate = opt.date
  s.constraint = opt.kind === "Production order" ? "incoming stock from production order" : opt.kind === "Stock in another warehouse" ? "stock transfer from another warehouse" : "engineering-approved alternate"
  s.snapshot = "PLN-SNAP-TBD-1006"
  s.peg = opt.ref
  s.status = "Confirmed"
  s.backorder = opt.date > s.reqDate // flag stays on while the promise is later than requested (p.206 §2.1)
}
export const repromise = (key: string, optId: string) =>
  M((db, ctx) => {
    need(ctx, BO_ROLES, "Re-promise")
    const [soId, line, sched] = key.split("/")
    const { o, l, s } = findSched(db, soId, Number(line), Number(sched))
    const opt = db.supply.find((x) => x.id === optId)
    if (!opt || opt.forItem) throw new ProtoError("Pick a supply option of the same item (alternates go through Substitute).")
    const qty = s.reqQty - s.deliveredQty - s.cancelledQty
    const releasing = db.supply.find((x) => x.ref === s.peg && x.id !== opt.id)
    if (opt.free < qty) throw new ProtoError(`${opt.ref} has ${opt.free} free; ${qty} needed. Use Split to confirm part now.`)
    opt.free -= qty
    if (releasing) releasing.free += qty
    const from = s.confDate
    confirmTo(s, qty, opt)
    l.promisedShip = l.schedules.map((x) => x.confDate).filter(Boolean).sort().at(-1)
    o.activity.push(act(ctx, `Re-promised line ${l.no} schedule ${s.no}: ${qty} on ${opt.ref} for ${s.confDate}${from ? ` (was ${from})` : ""}. Backorder flag ${s.backorder ? "stays on: promise later than requested" : "cleared"}`))
  })
export const splitSchedule = (key: string, optId: string, qtyNow: number) =>
  M((db, ctx) => {
    need(ctx, BO_ROLES, "Split")
    const [soId, line, sched] = key.split("/")
    const { o, l, s } = findSched(db, soId, Number(line), Number(sched))
    const opt = db.supply.find((x) => x.id === optId)
    const open = s.reqQty - s.deliveredQty - s.cancelledQty
    if (!opt || opt.forItem) throw new ProtoError("Pick a supply option of the same item.")
    if (!(qtyNow >= 1 && qtyNow < open)) throw new ProtoError(`Split quantity must be between 1 and ${open - 1}.`, "qty")
    if (opt.free < qtyNow) throw new ProtoError(`${opt.ref} has only ${opt.free} free.`, "qty")
    opt.free -= qtyNow
    const no = Math.max(...l.schedules.map((x) => x.no)) + 10
    l.schedules.push({ no, reqQty: open - qtyNow, reqDate: s.reqDate, deliveredQty: 0, cancelledQty: 0, backorder: true, status: "Open" })
    s.reqQty = qtyNow
    confirmTo(s, qtyNow, opt)
    o.activity.push(act(ctx, `Split line ${l.no} schedule ${s.no}: ${qtyNow} confirmed on ${opt.ref} for ${opt.date}; ${open - qtyNow} moved to schedule ${no} (Open, backorder)`))
  })
export const substitute = (key: string, optId: string, csConfirmed: boolean) =>
  M((db, ctx) => {
    need(ctx, BO_ROLES, "Substitute")
    const [soId, line, sched] = key.split("/")
    const { o, l, s } = findSched(db, soId, Number(line), Number(sched))
    const opt = db.supply.find((x) => x.id === optId)
    if (!opt?.forItem || opt.forItem !== l.item) throw new ProtoError("Substitution follows engineering-approved alternates only (Book I C §3.2); this item has none.")
    if (!csConfirmed) throw new ProtoError("A customer-visible substitution needs Customer service confirmation with the customer first.", "cs")
    const open = s.reqQty - s.deliveredQty - s.cancelledQty
    if (opt.free < open) throw new ProtoError(`Only ${opt.free} alternate unit(s) free; ${open} needed.`)
    opt.free -= open
    s.cancelledQty += open
    s.status = "Cancelled"
    s.backorder = false
    const no = Math.max(...o.lines.map((x) => x.no)) + 10
    const ns: Schedule = { no: 10, reqQty: open, reqDate: s.reqDate, deliveredQty: 0, cancelledQty: 0, backorder: false, status: "Open" }
    confirmTo(ns, open, opt)
    o.lines.push({ no, item: opt.itemId, qty: open, unitPrice: l.unitPrice, priceSource: l.priceSource, requestedShip: s.reqDate, promisedShip: ns.confDate, warehouse: l.warehouse, status: "Open", schedules: [ns] })
    o.activity.push(act(ctx, `Substituted line ${l.no} schedule ${s.no} (${open} × ${l.item}) with ${opt.itemId} on new line ${no} at the ordered price; customer confirmation recorded by Customer service`))
  })
export const proposeReallocation = (key: string, donorKey: string) =>
  M((db, ctx) => {
    need(ctx, BO_ROLES, "Proposing a reallocation")
    const [soId, line, sched] = key.split("/")
    const [dSo, dLine, dSched] = donorKey.split("/")
    const r = findSched(db, soId, Number(line), Number(sched))
    const d = findSched(db, dSo, Number(dLine), Number(dSched))
    if (d.l.item !== r.l.item) throw new ProtoError("Donor and receiver must be the same item.")
    if (d.s.status !== "Allocated/Pegged") throw new ProtoError("Only allocated confirmed supply can be reallocated.")
    if (db.reallocations.some((x) => x.state === "Waiting for Sales Director" && x.receiver.soId === soId)) throw new ProtoError(`${soId} already has a reallocation waiting for the Sales Director.`)
    const qty = Math.min(d.s.confQty ?? d.s.reqQty, r.s.reqQty - r.s.deliveredQty - r.s.cancelledQty)
    const id = `REA-TBD-${pad(db.seq2.rea++)}`
    db.reallocations.unshift({ id, item: r.l.item, qty, receiver: { soId, line: r.l.no, sched: r.s.no }, donor: { soId: dSo, line: d.l.no, sched: d.s.no }, proposedBy: ctx.role, on: TODAY, state: "Waiting for Sales Director" })
    return id
  })
/** Runs on approval.decided (Reallocation of confirmed supply). Writes the audit pair on both orders. */
export function applyReallocationDecision(db: DB, ctx: MutateCtx, soId: string, outcome: "Approved" | "Rejected", requestId: string, reason?: string) {
  const rea = db.reallocations.find((x) => x.state === "Waiting for Sales Director" && x.receiver.soId === soId)
  if (!rea) return
  rea.decidedOn = TODAY
  if (outcome === "Rejected") {
    rea.state = "Rejected"
    rea.reason = reason
    findSched(db, rea.receiver.soId, rea.receiver.line, rea.receiver.sched).o.activity.push(act(ctx, `Reallocation ${rea.id} rejected by the Sales Director (${requestId}). Reason: ${reason ?? "not given"}`))
    return
  }
  const r = findSched(db, rea.receiver.soId, rea.receiver.line, rea.receiver.sched)
  const d = findSched(db, rea.donor.soId, rea.donor.line, rea.donor.sched)
  const donorDate = d.s.confDate!
  // receiver takes the allocated stock
  r.s.confQty = rea.qty
  r.s.confDate = donorDate < r.s.reqDate ? r.s.reqDate : donorDate
  r.s.constraint = "on-hand stock (reallocated)"
  r.s.peg = d.s.peg
  r.s.status = "Allocated/Pegged"
  r.s.backorder = r.s.confDate > r.s.reqDate
  // donor loses it and goes back to the backorder queue
  d.s.status = "Open"
  d.s.confQty = undefined
  d.s.confDate = undefined
  d.s.peg = undefined
  d.s.backorder = true
  const audit = `Reallocation ${rea.id}: ${rea.qty} × ${rea.item} moved from ${d.o.id} line ${d.l.no}/${d.s.no} to ${r.o.id} line ${r.l.no}/${r.s.no}; approved by the Sales Director (${requestId})`
  r.o.activity.push(act(ctx, `${audit}. This order receives`))
  d.o.activity.push(act(ctx, `${audit}. This order gives; schedule back to Open with the backorder flag`))
  rea.state = "Approved and moved"
}
export interface RepromiseProposal {
  key: string
  optId: string
  ref: string
  date: string
  qty: number
  /** Open quantity of the schedule; qty below it means a split (the remainder stays Open, backorder). */
  open: number
  /** Fair share within a priority class [DOC:p.207 §2.2]: set when the class competes for too little supply. */
  fairShare?: { tier: string; available: number; classOpen: number }
}
/** Mass re-promise after an MRP run. Tiers in allocation order (contractual buffer, then priority class
 *  A/B/C); within a tier rows take supply in requested-date then entry order when it covers the whole
 *  tier, and when it does not, the tier's free supply is prorated by open quantity ("fair-share within a
 *  class prorates by open quantity", p.207 §2.2; whole units, largest remainder first). Supply is taken
 *  from the earliest option first (reading SR-8). Slipped promises are left to a person. */
export function massRepromisePlan(db: DB): RepromiseProposal[] {
  const free = Object.fromEntries(db.supply.map((x) => [x.id, x.free]))
  const out: RepromiseProposal[] = []
  const rows = backorderRows(db).filter((r) => r.kind !== "Slipped promise")
  const tierOf = (r: BoRow) => (r.buffer ? "Contractual buffer" : `Priority ${r.priority}`)
  for (const item of [...new Set(rows.map((r) => r.item))]) {
    const opts = db.supply.filter((x) => x.itemId === item && !x.forItem).sort((a, b) => a.date.localeCompare(b.date))
    const itemRows = rows.filter((r) => r.item === item)
    for (const tier of [...new Set(itemRows.map(tierOf))]) {
      const group = itemRows.filter((r) => tierOf(r) === tier)
      const available = opts.reduce((s, o) => s + free[o.id], 0)
      if (!available) break
      const classOpen = group.reduce((s, r) => s + r.openQty, 0)
      let shares: number[]
      if (available >= classOpen) shares = group.map((r) => r.openQty)
      else {
        const exact = group.map((r) => (available * r.openQty) / classOpen)
        shares = exact.map(Math.floor)
        let left = available - shares.reduce((a, b) => a + b, 0)
        for (const i of exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i)) {
          if (!left) break
          if (shares[i] < group[i].openQty) {
            shares[i]++
            left--
          }
        }
      }
      group.forEach((r, i) => {
        let want = shares[i]
        for (const o of opts) {
          if (!want) break
          const take = Math.min(want, free[o.id])
          if (!take) continue
          // One proposal per schedule: the first option that can give anything; the rest stays open.
          free[o.id] -= take
          want -= take
          out.push({ key: r.key, optId: o.id, ref: o.ref, date: o.date, qty: take, open: r.openQty, fairShare: available < classOpen ? { tier, available, classOpen } : undefined })
          break
        }
      })
    }
  }
  return out
}
export const applyMassRepromise = (plan: RepromiseProposal[]) =>
  M((db, ctx) => {
    need(ctx, BO_ROLES, "Mass re-confirmation")
    if (!plan.length) throw new ProtoError("Nothing to re-confirm: no backordered schedule has a supply option covering its open quantity.")
    for (const p of plan) {
      const [soId, line, sched] = p.key.split("/")
      const { o, l, s } = findSched(db, soId, Number(line), Number(sched))
      const opt = db.supply.find((x) => x.id === p.optId)!
      if (opt.free < p.qty) throw new ProtoError(`${opt.ref} no longer has ${p.qty} free. Re-run the plan.`)
      opt.free -= p.qty
      const open = s.reqQty - s.deliveredQty - s.cancelledQty
      const old = db.supply.find((x) => x.ref === s.peg && x.id !== opt.id)
      if (old) old.free += Math.min(open, s.confQty ?? open)
      let note = ""
      if (p.qty < open) {
        const no = Math.max(...l.schedules.map((x) => x.no)) + 10
        l.schedules.push({ no, reqQty: open - p.qty, reqDate: s.reqDate, deliveredQty: 0, cancelledQty: 0, backorder: true, status: "Open" })
        s.reqQty = p.qty + s.deliveredQty + s.cancelledQty
        note = `; ${open - p.qty} split to schedule ${no} (Open, backorder)${p.fairShare ? `, fair share of ${p.fairShare.available} across ${p.fairShare.classOpen} open in ${p.fairShare.tier}` : ""}`
      }
      confirmTo(s, p.qty, opt)
      l.promisedShip = l.schedules.map((x) => x.confDate).filter(Boolean).sort().at(-1)
      o.activity.push(act(ctx, `Mass re-confirmation after MRP run MRP-TBD-1006: line ${l.no} schedule ${s.no} confirmed ${p.qty} on ${opt.ref} for ${opt.date}${note}`))
    }
    return plan.length
  })

// ============================================================================ RMA register and create
export interface NewRma {
  customerId: string
  cls: RmaClass
  refType: RefType
  refDoc?: string
  warranty: boolean
  reason: RmaReason
  reasonDetail: string
  freight: Rma["freight"]
  carrier?: string
  rc3?: Rma["rc3"]
  restockPct: number
  expectedReturn?: string
  lines: { itemId: string; serial?: string; batch?: string; qtyAuth: number; origPrice: number; expected?: RmaLine["expected"]; maxQty?: number }[]
  ibId?: string
  goodwill?: boolean
  /** Return warehouse: quarantine-type warehouses only (p.23 §3.4.1); default the receiving plant's quarantine. */
  warehouse?: string
  /** Owner (user lookup, defaults to creator). */
  ownerId?: string
}
/** Warranty window of a referenced serial: its own installed base record, or the unit it was built into
 *  (a serialized component returned against the unit serial). Calls the entitlement service (p.216 §7.4). */
export function serialWarranty(db: DB, serial: string | undefined, refDoc?: string) {
  if (!serial) return null
  const ib = db.ib.find((x) => x.serial === serial) ?? (refDoc ? db.ib.find((x) => x.serial === refDoc && (db.asBuilt[refDoc] ?? []).some((a) => a.serials?.includes(serial))) : undefined)
  if (!ib) return null
  const recall = ib.history.find((h) => h.doc?.type === "recall")?.doc?.id
  return { ib, ...entitlement(ib, TODAY, recall) }
}
/** Warranty Claim default: ON when every referenced serial is inside its warranty window (Warranty End ≥
 *  today) [DOC:p.23 §3.4.1]; the check calls the entitlement service [DOC:p.216 §7.4]. No serials: OFF. */
export function warrantyDefault(db: DB, serials: (string | undefined)[], refDoc?: string) {
  const s = serials.filter(Boolean) as string[]
  if (!s.length) return false
  return s.every((x) => {
    const w = serialWarranty(db, x, refDoc)
    return !!w && w.end >= TODAY && w.verdict !== "not covered"
  })
}
export interface RefLine {
  itemId: string
  serial?: string
  qty: number
  price: number
  shipDate?: string
}
/** Lines a reference document supplies (shipped items, quantities, serials, net prices, ship dates). */
export function referenceLines(db: DB, refType: RefType, refDoc: string): RefLine[] {
  if (refType === "Serial Number") {
    const ser = db.serials.find((s) => s.id === refDoc)
    const ib = db.ib.find((x) => x.serial === refDoc)
    if (!ser && !ib) return []
    const d = db.deliveries.find((x) => x.id === (ser?.deliveryId ?? ib?.deliveryId))
    const o = d && db.orders.find((x) => x.id === d.soId)
    const itemId = ser?.item ?? ib!.itemId
    const price = o?.lines.find((l) => l.item === itemId)?.unitPrice ?? product(itemId).unitPrice
    const lines: RefLine[] = [{ itemId, serial: refDoc, qty: 1, price, shipDate: d?.shipDate }]
    // A unit's serialized components (as-built) can be returned against the unit serial.
    for (const a of db.asBuilt[refDoc] ?? []) for (const s of a.serials ?? []) if (a.level === 2) lines.push({ itemId: a.itemId, serial: s, qty: 1, price: product(a.successor ?? a.itemId).unitPrice, shipDate: d?.shipDate })
    return lines
  }
  const dels = refType === "Sales Order" ? db.deliveries.filter((d) => d.soId === refDoc && d.shipDate) : db.deliveries.filter((d) => d.irId === refDoc)
  const out: RefLine[] = []
  for (const d of dels) {
    const o = db.orders.find((x) => x.id === d.soId)
    for (const r of d.refs) {
      const l = o?.lines.find((x) => x.no === r.line)
      if (!l) continue
      const sers = db.serials.filter((s) => s.deliveryId === d.id && s.item === l.item)
      if (sers.length) for (const s of sers) out.push({ itemId: l.item, serial: s.id, qty: 1, price: l.unitPrice, shipDate: d.shipDate })
      else out.push({ itemId: l.item, qty: r.qty, price: l.unitPrice, shipDate: d.shipDate })
    }
  }
  return out
}
/** Shipped less already returned (V-RMA-01). */
export function returnableQty(db: DB, itemId: string, serial: string | undefined, shipped: number, exceptRma?: string) {
  const already = db.rmas.filter((r) => r.id !== exceptRma && !["Rejected", "Cancelled"].includes(r.status)).flatMap((r) => r.lines).filter((l) => l.itemId === itemId && (serial ? l.serial === serial : !l.serial)).reduce((s, l) => s + l.qtyAuth, 0)
  return Math.max(0, shipped - already)
}
export function rmaSubmitErrors(r: Rma): string[] {
  const e: string[] = []
  if (r.refType !== "No Reference" && !r.refDoc) e.push("Reference document is required unless Reference Type = No Reference.")
  if (r.reasonDetail.trim().length < 20) e.push("Reason detail needs at least 20 characters.")
  if (!r.lines.length) e.push("Add at least one line.")
  for (const l of r.lines) if (l.qtyAuth < 1) e.push(`Line ${l.no}: quantity authorized must be at least 1.`)
  if (r.cls === "RC3" && !r.rc3) e.push("RC3 needs the oil and transport fields: oil drained, oil volume, nitrogen blanket, impact recorder.")
  return e
}
export const createRma = (f: NewRma) =>
  M((db, ctx) => {
    need(ctx, CS_ROLES, "Creating an RMA (Customer Service creates, p.27 §3.10)")
    if (!f.customerId) throw new ProtoError("Pick the customer.", "customerId")
    if (f.refType !== "No Reference" && !f.refDoc) throw new ProtoError("Reference document is required unless Reference Type = No Reference.", "refDoc")
    if (f.reasonDetail.trim().length < 20) throw new ProtoError("Reason detail: free text, at least 20 characters.", "reasonDetail")
    if (!f.lines.length) throw new ProtoError("Add at least one line.", "lines")
    if (f.cls === "RC3" && !f.rc3) throw new ProtoError("RC3 needs the oil and transport fields.", "rc3")
    for (const l of f.lines) {
      if (l.qtyAuth < 1) throw new ProtoError(`${l.itemId}: quantity authorized must be at least 1.`, "lines")
      if (l.maxQty != null && l.qtyAuth > l.maxQty) throw new ProtoError(`V-RMA-01: ${l.itemId}${l.serial ? ` ${l.serial}` : ""} quantity ${l.qtyAuth} exceeds shipped less already returned (${l.maxQty}).`, "lines")
    }
    const warehouse = f.warehouse ?? QUARANTINE
    if (!(QUARANTINE_WAREHOUSES as readonly string[]).includes(warehouse)) throw new ProtoError("Return warehouse: only warehouses of type Quarantine can be selected.", "warehouse")
    if (!(f.restockPct >= 0 && f.restockPct <= 100)) throw new ProtoError("Restocking fee must be between 0% and 100%.", "restockPct")
    if (f.goodwill && f.warranty) throw new ProtoError("Goodwill replacement applies to an out-of-warranty return; switch the warranty claim off or clear goodwill.", "goodwill")
    const limit = restockRoleLimit(ctx.role, f.reason)
    const id = `RMA-TBD-${pad(db.seq2.rma++)}`
    const unverified = (s?: string) => f.refType === "No Reference" && !!s && !db.serials.some((x) => x.id === s) && !db.ib.some((x) => x.serial === s)
    const lines: RmaLine[] = f.lines.map((l, i) => ({
      no: (i + 1) * 10, itemId: l.itemId, serial: l.serial, batch: l.batch, qtyAuth: l.qtyAuth, qtyRecd: 0, origPrice: f.refType === "No Reference" ? Math.round(product(l.itemId).unitPrice * 0.8 * 100) / 100 : l.origPrice,
      valuation: valuationOf(l.itemId, l.origPrice), expected: l.expected, customerProperty: l.expected === "Repair" || f.cls === "RC4", unverifiedSerial: unverified(l.serial),
    }))
    const anyUnverified = lines.some((l) => l.unverifiedSerial)
    db.rmas.unshift({
      id, cls: f.cls, status: "Draft", warranty: anyUnverified ? "Denied" : f.warranty ? "Yes" : "No", customerId: f.customerId, refType: f.refType, refDoc: f.refDoc, reason: f.reason, reasonDetail: f.reasonDetail.trim(),
      warehouse, freight: f.freight, carrier: f.carrier, rc3: f.rc3, restockPct: f.restockPct, expectedReturn: f.expectedReturn, ownerId: f.ownerId ?? ctx.userId, requested: TODAY, statusSince: TODAY,
      lines, receipts: [], settlement: [], linked: [], ibId: f.ibId, goodwill: f.goodwill || undefined,
      restockAboveLimit: f.restockPct > limit ? { pct: f.restockPct, limit, role: ctx.role } : undefined,
      activity: [act(ctx, `RMA created from ${f.refType === "No Reference" ? "the No-Reference exception path (credit basis list price less 20%)" : `${f.refType} ${f.refDoc}`}. Status Draft${anyUnverified ? ". Unverified serial: warranty automatically Denied pending manual verification" : ""}`)],
    })
    const c = db.customers.find((x) => x.id === f.customerId)
    if (c?.creditHold) db.rmas[0].activity.push(act(ctx, "Customer on credit hold: RMA creation allowed; settlement by credit is blocked later until the hold clears"))
    if (f.restockPct > limit) db.rmas[0].activity.push(act(ctx, `Restocking fee ${f.restockPct}% is above the ${ctx.role} limit of ${limit}%: the Customer Service Manager approves it on the RMA approval`))
    if (f.goodwill) db.rmas[0].activity.push(act(ctx, "Goodwill replacement (out of warranty): the RMA approval adds the Controller step at any value (p.27 §3.10)"))
    return id
  })
const findRma = (db: DB, id: string) => {
  const r = db.rmas.find((x) => x.id === id)
  if (!r) throw new ProtoError(`RMA ${id} not found.`)
  return r
}
const setStatus = (r: Rma, s: Rma["status"]) => {
  r.status = s
  r.statusSince = TODAY
}
export const deleteDraftRma = (id: string) =>
  M((db, ctx) => {
    need(ctx, CS_ROLES, "Deleting a draft RMA")
    const r = findRma(db, id)
    if (r.status !== "Draft") throw new ProtoError("Only a Draft RMA can be deleted; cancel an authorized one instead.")
    db.rmas = db.rmas.filter((x) => x.id !== id)
  })
/** Register bulk action "Assign Owner" [DOC:p.22 §3.3]. */
export const assignRmaOwner = (ids: string[], ownerId: string) =>
  M((db, ctx) => {
    need(ctx, CS_ROLES, "Assigning an RMA owner")
    const u = userById(ownerId)
    if (!u) throw new ProtoError("Pick the new owner.", "ownerId")
    if (!ids.length) throw new ProtoError("Select at least one RMA.")
    for (const id of ids) {
      const r = findRma(db, id)
      if (r.ownerId === ownerId) continue
      r.activity.push(act(ctx, `Owner ${userName(r.ownerId)} → ${u.name}`))
      r.ownerId = ownerId
    }
    return ids.length
  })
export const cancelRma = (id: string, reason: string) =>
  M((db, ctx) => {
    need(ctx, ["Customer Service Manager"], "Cancel RMA (CS Manager, p.27 §3.10)")
    const r = findRma(db, id)
    if (r.status !== "Authorized") throw new ProtoError(`Cancel is allowed until first receipt, from Authorized. ${r.id} is ${r.status}.`)
    if (!reason.trim()) throw new ProtoError("A reason is required to cancel.", "reason")
    setStatus(r, "Cancelled")
    r.cancelReason = reason
    r.activity.push(act(ctx, `Cancelled before receipt. Reason: ${reason}`))
  })
export const rmaNote = (id: string, text: string) =>
  M((db, ctx) => {
    const r = findRma(db, id)
    if (!["Authorized", "Partially Received"].includes(r.status)) throw new ProtoError("Return instructions are printed or emailed after authorization.")
    r.activity.push(act(ctx, text))
  })
/** approval.requested for an RMA subject: Draft → Pending Approval. */
export function onRmaRequested(db: DB, ctx: MutateCtx, id: string, requestId: string) {
  const r = db.rmas.find((x) => x.id === id)
  if (r?.status === "Disposition Pending" && needsGoodwill(r) && !r.goodwillDecision) {
    r.goodwillReq = requestId
    r.activity.push(act(ctx, `Goodwill replacement submitted for Controller approval (${requestId})`))
    return
  }
  if (r?.status === "Draft") {
    r.recalledReq = undefined
    setStatus(r, "Pending Approval")
    r.activity.push(act(ctx, `Submitted for approval (${requestId}). Status Draft → Pending Approval`))
  }
}
/** Recall from Pending Approval (lifecycle: Approve, Reject, Recall → Draft) [DOC:p.26 §3.8]. The shared
 *  engine cannot withdraw a request yet (Request FR-11): the request stays open, a decision on it while
 *  the RMA is Draft is ignored, and Resubmit puts the RMA back on that same request. */
export const recallRma = (id: string, reason: string) =>
  M((db, ctx) => {
    need(ctx, CS_ROLES, "Recall from approval (Customer Service, the requester side)")
    const r = findRma(db, id)
    if (r.status !== "Pending Approval") throw new ProtoError(`Recall applies to an RMA in Pending Approval; ${r.id} is ${r.status}.`)
    if (!reason.trim()) throw new ProtoError("Say why the RMA is recalled.", "reason")
    const open = store.getCore().approvals.find((a) => !a.outcome && a.kind === "RMA approval" && a.subject.type === "rma" && a.subject.id === r.id)
    r.recalledReq = open?.id
    setStatus(r, "Draft")
    r.activity.push(act(ctx, `Recalled from approval${open ? ` (${open.id})` : ""}. Reason: ${reason}. Status Pending Approval → Draft; edit and resubmit`))
  })
export const resubmitRma = (id: string) =>
  M((db, ctx) => {
    need(ctx, CS_ROLES, "Resubmit for approval")
    const r = findRma(db, id)
    if (r.status !== "Draft" || !r.recalledReq) throw new ProtoError("Resubmit applies to a recalled Draft RMA whose request is still open; otherwise submit for approval.")
    const errs = rmaSubmitErrors(r)
    if (errs.length) throw new ProtoError(errs.join(" "))
    const req = r.recalledReq
    r.recalledReq = undefined
    setStatus(r, "Pending Approval")
    r.activity.push(act(ctx, `Resubmitted for approval on the open request ${req}. Status Draft → Pending Approval`))
  })
/** approval.decided for an RMA subject. Authorization while Pending Approval; disposition approval while Disposition Pending. */
export function onRmaDecided(db: DB, ctx: MutateCtx, id: string, outcome: "Approved" | "Rejected", requestId: string, reason?: string) {
  const r = db.rmas.find((x) => x.id === id)
  if (!r) return
  if (r.status === "Draft" && r.recalledReq === requestId) {
    r.recalledReq = undefined
    r.activity.push(act(ctx, `${requestId} was decided (${outcome}) after the RMA was recalled; the decision does not apply. Submit the Draft again for a new request`))
    return
  }
  if (r.status === "Disposition Pending" && r.goodwillReq === requestId) {
    r.goodwillDecision = { outcome, requestId, on: TODAY, reason }
    r.goodwill = outcome === "Approved"
    r.activity.push(act(ctx, outcome === "Approved" ? `Goodwill replacement approved (${requestId}, Controller step). The replacement posts to 5120 COGS (#23)` : `Goodwill replacement rejected (${requestId}). Reason: ${reason}. Reject the dispositions and choose another outcome`))
    return
  }
  if (r.status === "Pending Approval") {
    if (outcome === "Approved" && r.goodwill) r.goodwillDecision = { outcome, requestId, on: TODAY }
    setStatus(r, outcome === "Approved" ? "Authorized" : "Rejected")
    r.activity.push(act(ctx, outcome === "Approved" ? `Approved (${requestId}). Status Authorized. RMA barcode ${r.id} (Code128) ready on the return instructions` : `Rejected (${requestId}). Reason: ${reason}. Status Rejected`))
  } else if (r.status === "Disposition Pending") applyDispositionDecision(db, ctx, r, outcome, requestId, reason)
}
function applyDispositionDecision(db: DB, ctx: MutateCtx, r: Rma, outcome: "Approved" | "Rejected", by: string, reason?: string) {
  if (outcome === "Rejected") {
    setStatus(r, "In Inspection")
    r.activity.push(act(ctx, `Dispositions rejected (${by}). Reason: ${reason}. Back to In Inspection for the inspector`))
    return
  }
  setStatus(r, "Settling")
  r.activity.push(act(ctx, `Dispositions approved (${by}). Status Settling; the system runs each outcome as a separate retry-safe step`))
  planSettlement(db, ctx, r)
  for (const s of r.settlement) runStepIn(db, ctx, r, s)
}
/** Segregation of duties (FL-05): the warranty adjudicator is not the credit approver. */
export const adjudicatorIsActor = (r: Rma, role: Role, userId: string) => !!r.adjudication && (r.adjudication.byUser ? r.adjudication.byUser === userId : r.adjudication.by === role)
/** RMA-DISP "Inspectors propose, Quality Manager approves" [DOC:p.253]: the Quality Manager decides the
 *  proposed dispositions. Runs locally until the shared engine has an "RMA disposition" kind routing to
 *  the Quality Manager only (Request FR-10); the "RMA approval" route would put the CS Manager first. */
export const decideDispositions = (id: string, outcome: "Approved" | "Rejected", reason?: string) =>
  M((db, ctx) => {
    need(ctx, ["Quality Manager"], "Approving dispositions (Quality Manager approves, p.253 RMA-DISP)")
    const r = findRma(db, id)
    if (r.status !== "Disposition Pending") throw new ProtoError(`Dispositions are decided while Disposition Pending; ${r.id} is ${r.status}.`)
    if (adjudicatorIsActor(r, ctx.role, ctx.userId))
      throw new ProtoError(`Segregation of duties: ${userName(r.adjudication!.byUser) !== "Not recorded" ? userName(r.adjudication!.byUser) : r.adjudication!.by} recorded the warranty adjudication on ${r.id}, so cannot approve the disposition that creates the credit. Another Quality Manager decides.`)
    if (outcome === "Rejected" && !reason?.trim()) throw new ProtoError("A reason is required to reject.", "reason")
    if (outcome === "Approved" && needsGoodwill(r) && r.goodwillDecision?.outcome !== "Approved")
      throw new ProtoError(r.goodwillDecision?.outcome === "Rejected" ? "The Controller rejected the goodwill replacement: reject the dispositions so the inspector picks another outcome." : "Replace on an out-of-warranty or denied line is a goodwill replacement: the Controller approves it first (any value, p.27 §3.10). Submit it to the approvals inbox.")
    r.dispositionDecision = { outcome, byUser: ctx.userId, on: TODAY, reason }
    applyDispositionDecision(db, ctx, r, outcome, `Quality Manager ${userName(ctx.userId)}`, reason)
  })

// ============================================================================ RMA-RECEIPT (SP-19)
export function openForReceipt(db: DB, code: string): { ok: true; rma: Rma } | { ok: false; error: string; errorCode?: string } {
  const r = db.rmas.find((x) => x.id === code.trim().toUpperCase())
  if (!r) return { ok: false, error: `no RMA ${code} on record`, errorCode: "SP-19" }
  if (!["Authorized", "Partially Received"].includes(r.status)) return { ok: false, error: `${r.id} is ${r.status}; only Authorized or Partially Received RMAs can be received`, errorCode: "E-RMA-04" }
  return { ok: true, rma: r }
}
export interface ReceiveLine {
  line: number
  qty: number
  condition: Condition
  photo?: string
  serial?: string
  /** Customer Property flag as set at receipt; changing it is a Receiving Supervisor action (p.24 §3.5 Dev Note). */
  customerProperty?: boolean
}
/** Putaway proposal inside the RMA's quarantine zone (putaway rules engine INV 15.6, p.24 §3.5). The
 *  engine is not in the prototype: bins Qn-01..Qn-08 by line order, skipping bins already used by open
 *  RMAs (reading SR-22). */
export function proposeBin(db: DB, r: Rma, line: number) {
  const zone = r.warehouse.match(/zone (Q\d)/)?.[1] ?? "Q1"
  const used = new Set(db.rmas.filter((x) => x.id !== r.id && x.warehouse === r.warehouse && !["Closed", "Cancelled", "Rejected"].includes(x.status)).flatMap((x) => x.receipts.flatMap((c) => c.lines.map((l) => l.bin))).filter(Boolean))
  const free = Array.from({ length: 8 }, (_, i) => `${zone}-${pad(i + 1, 2)}`).filter((b) => !used.has(b))
  const idx = r.lines.filter((l) => !l.unauthorized).findIndex((l) => l.no === line)
  return free[Math.max(0, idx) % Math.max(1, free.length)] ?? `${zone}-01`
}
export const RECEIVING_SUPERVISOR: Role = "Warehouse supervisor"
const DAMAGED: Condition[] = ["Damaged Packaging", "Damaged Product"]
export const receiveRma = (id: string, operatorId: string, lines: ReceiveLine[]) =>
  M((db, ctx) => {
    const op = userById(operatorId)
    if (!op || !op.roles.some((x) => RECEIVING_ROLES.includes(x))) throw new ProtoError("Receipts are posted by Receiving. Log in with a receiving badge (SP-07).")
    const r = findRma(db, id)
    if (!["Authorized", "Partially Received"].includes(r.status)) throw new ProtoError(`${r.id} is ${r.status}; it cannot be received.`)
    const take = lines.filter((x) => x.qty > 0)
    if (!take.length) throw new ProtoError("Nothing to receive: enter a quantity or scan a serial on at least one line.")
    const sup = op.roles.includes(RECEIVING_SUPERVISOR)
    for (const x of take) {
      const l = r.lines.find((y) => y.no === x.line)!
      if (x.customerProperty != null && x.customerProperty !== l.customerProperty) {
        if (!sup) throw new ProtoError(`Line ${l.no}: the Customer Property flag is changed at receipt by the Receiving Supervisor only. Ask a Warehouse supervisor to log in.`, "customerProperty")
        if (x.customerProperty && r.cls !== "RC3" && r.cls !== "RC4") throw new ProtoError(`Line ${l.no}: only RC3 and RC4 lines can be customer property (p.24 §3.5).`, "customerProperty")
        if (l.qtyRecd > 0) throw new ProtoError(`Line ${l.no}: already partly received with Customer Property ${l.customerProperty ? "on" : "off"}; the flag cannot change between receipts.`, "customerProperty")
        r.activity.push({ at: TODAY, by: op.name, text: `Customer Property on line ${l.no} changed ${l.customerProperty ? "on → off (PE ownership: #17 posts)" : "off → on (customer property: non-valuated, no #17)"} by the Receiving Supervisor` })
        l.customerProperty = x.customerProperty
      }
    }
    let posted = 0
    const bins: Record<number, string> = {}
    for (const x of take) {
      const l = r.lines.find((y) => y.no === x.line)!
      bins[l.no] = proposeBin(db, r, l.no)
      if (l.qtyRecd + x.qty > l.qtyAuth) throw new ProtoError(`E-RMA-03 over-receipt: line ${l.no} authorized ${l.qtyAuth}, already received ${l.qtyRecd}, now ${x.qty}. Book the extra as an unauthorized return.`)
      if (l.serial && x.serial !== l.serial) throw new ProtoError(`E-RMA-04: line ${l.no} needs serial ${l.serial} scanned before receipt.`)
      if (x.condition !== "Undamaged" && !x.photo) throw new ProtoError(`Line ${l.no}: a photo is mandatory when the condition is ${x.condition}.`, "photo")
      l.qtyRecd += x.qty
      l.condition = x.condition
      l.photo = x.photo ?? l.photo
      if (!l.customerProperty) posted += x.qty * l.valuation
      const ib = l.serial ? db.ib.find((y) => y.serial === l.serial) : undefined
      if (ib && !l.customerProperty) {
        ib.status = "Returned"
        ib.history.push({ on: TODAY, text: `Returned on ${r.id}; serial status Returned, quality status QI Hold in quarantine`, doc: { type: "rma", id: r.id } })
      }
    }
    const rid = `RCP-TBD-${pad(db.seq2.rcp++)}`
    r.receipts.push({ id: rid, date: TODAY, by: op.name, lines: take.map((x) => ({ line: x.line, qty: x.qty, condition: x.condition, photo: x.photo, serial: x.serial, bin: bins[x.line], customerProperty: r.lines.find((l) => l.no === x.line)!.customerProperty })), posted17: posted })
    // Damaged-in-transit with PE freight: Condition = Damaged opens the freight claim sub-record (p.27 §3.9).
    const damaged = take.filter((x) => DAMAGED.includes(x.condition))
    if (damaged.length && r.freight === "PE Pays" && !r.freightClaim) {
      const amount = damaged.reduce((s, x) => s + x.qty * r.lines.find((l) => l.no === x.line)!.valuation, 0)
      r.freightClaim = { carrier: r.carrier ?? "Return carrier per the instructions", claimNo: `FCL-TBD-${pad(db.seq2.rcp)}`, amount, status: "Filed", opened: TODAY }
      r.activity.push({ at: TODAY, by: op.name, text: `Damaged on arrival with PE-paid freight: freight claim ${r.freightClaim.claimNo} opened against ${r.freightClaim.carrier} for ${money(amount)} (damaged lines at valuation). Tracked on the Financials tab` })
    }
    r.receivedDate = r.receivedDate ?? TODAY
    const all = r.lines.filter((l) => !l.unauthorized).every((l) => l.qtyRecd >= l.qtyAuth)
    const from = r.status
    setStatus(r, all ? "Received" : "Partially Received")
    r.activity.push({ at: TODAY, by: op.name, text: `Return receipt ${rid} into ${r.warehouse}, QI Hold: ${take.map((x) => `line ${x.line} × ${x.qty} ${x.condition}`).join("; ")}. ${posted ? `#17 posted ${money(posted)}` : "Customer property: non-valuated, no #17"}. Status ${from} → ${r.status}. Return inspection created per line` })
    const serials = take.map((x) => x.serial).filter(Boolean) as string[]
    if (posted) ctx.emit("posting.posted", { template: 17, amount: posted, currency: "USD", source: { type: "rma", id: r.id } })
    ctx.emit("trace.eventRecorded", { code: "T12", doc: { type: "rma", id: r.id }, serial: serials[0] })
    ctx.emit("sales.rmaReceived", { rmaId: r.id as `RMA-${string}`, serials })
    return rid
  })
/** Freight claim recovery received: DR 1010 Bank / CR 6410 Freight Out (p.27 §3.9; no numbered template). */
export const recordFreightRecovery = (id: string, amount: number) =>
  M((db, ctx) => {
    need(ctx, [...FIN_ROLES, "Customer Service Manager"], "Recording a freight claim recovery")
    const r = findRma(db, id)
    if (!r.freightClaim) throw new ProtoError(`${r.id} has no freight claim.`)
    if (r.freightClaim.status === "Recovered") throw new ProtoError(`${r.freightClaim.claimNo} is already recovered.`)
    if (!(amount > 0)) throw new ProtoError("Enter the amount received from the carrier.", "amount")
    r.freightClaim.status = "Recovered"
    r.freightClaim.recoveredOn = TODAY
    r.freightClaim.amount = amount
    r.activity.push(act(ctx, `Freight claim ${r.freightClaim.claimNo} recovered: ${money(amount)} received, DR 1010 Bank / CR 6410 Freight Out`))
  })
export const bookUnauthorized = (id: string, operatorId: string, f: { itemId: string; serial?: string; qty: number; condition: Condition; photo?: string; badge: string; reason: string }) =>
  M((db) => {
    const sup = USERS.find((u) => u.badge === f.badge.trim().toUpperCase() && u.roles.includes("Warehouse supervisor"))
    if (!sup) throw new ProtoError("Supervisor override needed: scan or type a Warehouse supervisor badge.", "badge")
    if (!f.reason.trim()) throw new ProtoError("Give the override reason.", "reason")
    if (!(f.qty >= 1)) throw new ProtoError("Quantity must be at least 1.", "qty")
    if (f.condition !== "Undamaged" && !f.photo) throw new ProtoError(`A photo is mandatory when the condition is ${f.condition}.`, "photo")
    const r = findRma(db, id)
    const op = userById(operatorId)
    const no = Math.max(...r.lines.map((l) => l.no)) + 10
    r.lines.push({ no, itemId: f.itemId, serial: f.serial, qtyAuth: 0, qtyRecd: f.qty, origPrice: 0, valuation: valuationOf(f.itemId, product(f.itemId).unitPrice), customerProperty: true, unauthorized: true, condition: f.condition, photo: f.photo, notes: f.reason })
    r.activity.push({ at: TODAY, by: op?.name ?? "Receiving", text: `Unauthorized Return line ${no}: ${f.qty} × ${f.itemId}${f.serial ? ` ${f.serial}` : ""} booked with supervisor override by ${sup.name}. Reason: ${f.reason}. Own inspection required; append by change (re-approval) or return at customer cost` })
    return no
  })
export const closeShort = (id: string, reason: string) =>
  M((db, ctx) => {
    need(ctx, ["Customer Service Manager", "Warehouse supervisor"], "Close Short (supervisor action, p.26 §3.8)")
    const r = findRma(db, id)
    if (r.status !== "Partially Received") throw new ProtoError("Close Short applies to a Partially Received RMA.")
    if (!reason.trim()) throw new ProtoError("Document why the remainder is closed short.", "reason")
    const cut = r.lines.map((l) => `${l.no}: ${l.qtyAuth - l.qtyRecd}`).join(", ")
    for (const l of r.lines) l.qtyAuth = l.qtyRecd
    setStatus(r, "Received")
    r.activity.push(act(ctx, `Closed short: open remainder cancelled (${cut}). Reason: ${reason}. Status Partially Received → Received`))
  })

// ============================================================================ RMA-DISP
export const startInspection = (id: string) =>
  M((db, ctx) => {
    need(ctx, INSPECT_ROLES, "Starting the return inspection")
    const r = findRma(db, id)
    if (r.status !== "Received") throw new ProtoError(`Inspection starts on a Received RMA; ${r.id} is ${r.status}.`)
    setStatus(r, "In Inspection")
    r.activity.push(act(ctx, `Return inspection started (plan type RMA)${r.cls === "RC3" ? "; teardown checklist applies, photographs mandatory" : ""}. Status Received → In Inspection`))
  })
export interface Findings {
  findings: string
  teardown: Record<string, string>
  attributable?: Attributable
  verdict?: "Warranty Approved" | "Warranty Denied"
  justification: string
  exclusion?: string
  dispositions: Record<number, Disposition | undefined>
}
export const saveFindings = (id: string, f: Findings) =>
  M((db, ctx) => {
    need(ctx, INSPECT_ROLES, "Recording inspection results (receiving cannot disposition)")
    const r = findRma(db, id)
    if (r.status !== "In Inspection") throw new ProtoError(`Results are recorded while In Inspection; ${r.id} is ${r.status}.`)
    r.findings = f.findings
    r.teardown = f.teardown
    r.attributable = f.attributable
    for (const l of r.lines) l.disposition = f.dispositions[l.no]
    if (f.verdict) r.adjudication = { verdict: f.verdict, justification: f.justification, by: ctx.role, on: TODAY, byUser: ctx.userId, exclusion: f.exclusion }
    r.activity.push(act(ctx, "Inspection results saved"))
  })
/** RC3 inspection photographs are mandatory attachments (p.21 §3.2 step 5). */
export const attachInspectionPhoto = (id: string) =>
  M((db, ctx) => {
    need(ctx, INSPECT_ROLES, "Attaching inspection photographs")
    const r = findRma(db, id)
    if (r.status !== "In Inspection") throw new ProtoError(`Photographs are attached while In Inspection; ${r.id} is ${r.status}.`)
    const name = `insp-${r.id.toLowerCase()}-${(r.inspectionPhotos?.length ?? 0) + 1}.jpg`
    r.inspectionPhotos = [...(r.inspectionPhotos ?? []), name]
    r.activity.push(act(ctx, `Inspection photograph ${name} attached`))
    return name
  })
/** Exclusion needed when a warranty denial rests on a site or installation cause (reading SR-19). */
export const exclusionNeeded = (verdict?: string, a?: Attributable) => verdict === "Warranty Denied" && (a === "Site Conditions" || a === "Installation Error")
export function dispositionErrors(r: Rma): string[] {
  const e: string[] = []
  if (!r.findings?.trim()) e.push("Findings summary is required.")
  if (r.cls === "RC3" && !r.inspectionPhotos?.length) e.push("RC3: photographs are mandatory attachments; attach at least one inspection photograph.")
  if (r.adjudication && exclusionNeeded(r.adjudication.verdict, r.attributable) && !r.adjudication.exclusion) e.push("Warranty Denied for site conditions or installation error: cite the exclusions catalog entry.")
  if (r.cls === "RC3") for (const t of ["Winding condition", "Core condition", "Oil test results", "Bushing condition", "Tap changer condition"]) if (!r.teardown?.[t]?.trim()) e.push(`RC3 teardown checklist: ${t} is empty.`)
  if (r.warranty === "Yes" && !r.attributable) e.push("Failure Attributable To is mandatory for a warranty claim.")
  if (r.warranty === "Yes" && !r.adjudication) e.push("Warranty adjudication (Approved or Denied) is mandatory when Warranty Claim = Yes.")
  if (r.adjudication && !r.adjudication.justification.trim()) e.push("Warranty adjudication needs a justification.")
  for (const l of r.lines) if (!l.disposition) e.push(`Line ${l.no}: choose a disposition.`)
  if (r.adjudication?.verdict === "Warranty Denied" && r.lines.some((l) => l.disposition === "Repair — Warranty")) e.push("Warranty denied: Repair — Warranty is not available; convert the denial to billable or pick another outcome.")
  return e
}
/** Goodwill replacement: Replace on a line that is out of warranty (no claim) or whose claim was denied
 *  [DOC:p.25 §3.6.1 Replace "5120 COGS (goodwill, needs Controller approval)"; p.27 §3.10]. */
export const needsGoodwill = (r: Rma) => r.cls !== "RC4" && r.lines.some((l) => l.disposition === "Replace") && (r.warranty === "No" || r.warranty === "Denied" || r.adjudication?.verdict === "Warranty Denied")
/** Value the goodwill approval is asked for: the replacement units at valuation (standard cost, #23 basis). */
export const goodwillValue = (r: Rma) => r.lines.filter((l) => l.disposition === "Replace").reduce((s, l) => s + (l.qtyRecd || l.qtyAuth) * l.valuation, 0)
export const ncrForced = (a?: Attributable) => a === "Manufacturing Defect" || a === "Component Supplier"
export const proposeDispositions = (id: string) =>
  M((db, ctx) => {
    need(ctx, INSPECT_ROLES, "Proposing dispositions (inspectors propose)")
    const r = findRma(db, id)
    if (r.status !== "In Inspection") throw new ProtoError(`${r.id} is ${r.status}.`)
    const errs = dispositionErrors(r)
    if (errs.length) throw new ProtoError(errs.join(" "))
    if (ncrForced(r.attributable) && !r.ncrId) {
      r.ncrId = `NCR-TBD-${pad(db.seq2.ncr++)}`
      r.linked.push({ type: "ncr", id: r.ncrId })
      r.activity.push(act(ctx, `NCR Required forced on (${r.attributable}): ${r.ncrId} created and linked (INV 15.4)`))
      ctx.emit("sales.ncrRequested", { rmaId: r.id, ncrId: r.ncrId, attributable: r.attributable! })
    }
    if (r.adjudication?.verdict === "Warranty Approved") r.warranty = "Approved"
    if (r.adjudication?.verdict === "Warranty Denied") r.warranty = "Denied"
    if (needsGoodwill(r)) {
      if (r.goodwillDecision?.outcome !== "Approved") {
        r.goodwill = true
        r.goodwillDecision = undefined
        r.goodwillReq = undefined
      }
      r.activity.push(act(ctx, r.goodwillDecision?.outcome === "Approved" ? "Replace on an out-of-warranty line: goodwill already approved by the Controller on the RMA approval" : "Replace on an out-of-warranty or denied line is a goodwill replacement: the Controller approves it (any value) before the dispositions are approved"))
    }
    setStatus(r, "Disposition Pending")
    r.activity.push(act(ctx, `Dispositions proposed: ${r.lines.map((l) => `line ${l.no} ${l.disposition}`).join("; ")}. Status In Inspection → Disposition Pending; the Quality Manager approves`))
  })
export const createScar = (id: string) =>
  M((db, ctx) => {
    const r = findRma(db, id)
    if (r.attributable !== "Component Supplier") throw new ProtoError("Create SCAR is offered when the failure is attributable to a component supplier.")
    if (r.scarId) throw new ProtoError(`${r.scarId} already exists.`)
    r.scarId = `SCAR-TBD-${pad(db.seq2.ncr + 900)}`
    r.linked.push({ type: "scar", id: r.scarId })
    r.activity.push(act(ctx, `SCAR ${r.scarId} requested from the RMA (Part E §8)`))
  })
export const convertDenialToBillable = (id: string) =>
  M((db, ctx) => {
    need(ctx, INSPECT_ROLES, "Convert denial to billable")
    const r = findRma(db, id)
    if (r.adjudication?.verdict !== "Warranty Denied") throw new ProtoError("Record Warranty Denied with its justification first.")
    if (!["In Inspection", "Disposition Pending"].includes(r.status)) throw new ProtoError(`${r.id} is ${r.status}.`)
    r.cls = "RC4"
    r.reason = "Billable Repair"
    r.warranty = "Denied"
    for (const l of r.lines) {
      l.disposition = "Repair — Billable"
      l.customerProperty = true
    }
    r.activity.push(act(ctx, "Warranty denied: customer letter generated from template; converted to RC4 billable repair (service quote before work starts)"))
  })

function planSettlement(db: DB, ctx: MutateCtx, r: Rma) {
  const steps: SettleStep[] = []
  let n = 1
  const fee = r.restockPct / 100
  for (const l of r.lines) {
    if (l.unauthorized && !l.disposition) continue
    const qty = l.qtyRecd
    const val = qty * l.valuation
    const credit = Math.round(qty * l.origPrice * (1 - fee) * 100) / 100
    const S = (label: string, template: SettleStep["template"], amount: number | null, detail: string): SettleStep => ({ id: `S${n++}`, line: l.no, label, template, amount, detail, done: false })
    switch (l.disposition) {
      case "Restock":
        steps.push(S(`Stock transfer ${QUARANTINE} → ${l.itemId.startsWith("FIN") ? "WH-TBD-01 finished goods" : "WH-TBD-01"}; quality status Unrestricted`, 18, l.customerProperty ? null : val, `${qty} × ${l.itemId} at ${money(l.valuation)} valuation`))
        steps.push(S("Credit memo request → ACC credit note", 19, credit, `Return value ${money(qty * l.origPrice)}${fee ? ` less ${r.restockPct}% restocking fee (${money(qty * l.origPrice * fee)} to 4910)` : ""}`))
        break
      case "Repair — Warranty":
        steps.push(S("Rework order (RWO) with settlement receiver 2610 Warranty Reserve; unit stays customer property", 21, null, "#21 posts actual repair cost at RWO close (overflow to 6300)"))
        break
      case "Repair — Billable":
        steps.push(S("Rework order with receiver COGS-Service and a service quote for customer approval before work starts", 22, null, "#22 posts cost and service invoice at RWO close"))
        break
      case "Replace":
        steps.push(S(`Replacement sales order at $0 net price referencing the RMA${r.goodwill ? " (goodwill, Controller approved)" : ""}`, 23, null, `#23 posts at the replacement order's PGI: standard cost to ${r.goodwill ? "5120 COGS (goodwill)" : "6300 Warranty Expense"} / CR 1330`))
        steps.push(S("Credit memo request for the original line, credited in full → ACC credit note", 19, Math.round(qty * l.origPrice * 100) / 100, "Original line credited in full"))
        break
      case "Scrap":
        steps.push(S("Goods issue to scrap from quarantine; serial → Scrapped", 20, l.customerProperty ? null : val, `${qty} × ${l.itemId} at ${money(l.valuation)}; cost center CC-1500 Quality`))
        break
      case "Return to Customer As-Is":
        steps.push(S("Reverse the receipt entry: ownership returns to the customer (DR 5120 / CR 1335)", 17, l.customerProperty ? null : -val, l.customerProperty ? "Customer property: received non-valuated, no #17 to reverse" : `Reversal of #17: ${qty} × ${l.itemId} at ${money(l.valuation)} valuation`))
        steps.push(S(`Return shipment to customer${r.freight === "PE Pays" ? "; freight DR 6410 / CR 2100" : ""}`, 26, r.freight === "PE Pays" ? 1200 : null, r.freight === "PE Pays" ? "Freight out accrual, quoted $1,200.00 (design value)" : "Customer pays freight: no #26"))
        break
    }
  }
  r.settlement = steps
  void db
  void ctx
}
function runStepIn(db: DB, ctx: MutateCtx, r: Rma, s: SettleStep) {
  if (s.done) return
  const c = db.customers.find((x) => x.id === r.customerId)!
  const l = r.lines.find((x) => x.no === s.line)
  if (s.template === 19 && c.creditHold && !s.released) {
    s.error = "E-RMA-07 Customer is on credit hold — credit requires Controller release"
    return
  }
  s.error = undefined
  if (s.template === 21 || s.template === 22) {
    const rwo = `RWO-TBD-${pad(db.seq2.rwo++)}`
    s.doc = { type: "reworkOrder", id: rwo }
    r.linked.push(s.doc)
    if (s.template === 22) {
      const qid = `QT-TBD-0${db.seq2.qt++}-V1`
      db.quotations.unshift({ id: qid, version: 1, status: "Draft", customerId: r.customerId, validUntil: addDays(TODAY, 30), lines: [{ no: 10, item: "SERV-TBD-FIELD", qty: 4, price: product("SERV-TBD-FIELD").unitPrice, serial: l?.serial, note: `Billable repair on ${r.id}` }], activity: [act(ctx, `Service quote generated from ${r.id} (RC4 billable repair) for customer approval before work starts`)] })
      r.linked.push({ type: "quotation", id: qid })
    }
  }
  if (s.template === 23) {
    const id = nextSoId(db)
    const src = db.orders.find((o) => o.id === r.refDoc) ?? db.orders.find((o) => o.customerId === r.customerId)
    const cu = db.customers.find((x) => x.id === r.customerId)!
    const so: SalesOrder = {
      id, customerId: r.customerId, customerPO: `Replacement for ${r.id}`, type: "Replacement", directEntry: false, billTo: cu.billTo, shipTo: cu.shipTo, requestedShip: addDays(TODAY, 14), incoterms: cu.incoterms, freightTerms: "PE-paid",
      billingPlan: "No invoice: $0 replacement", currency: cu.currency, bookedRate: src?.bookedRate ?? "1.0000", status: "Draft", created: TODAY, rmaRef: r.id,
      lines: [{ no: 10, item: l?.itemId ?? "FIN-TBD-1000PM", qty: l?.qtyRecd || 1, unitPrice: 0, priceSource: "Price list", requestedShip: addDays(TODAY, 14), warehouse: "WH-TBD-01 Fargo, ND", status: "Open", schedules: [{ no: 10, reqQty: l?.qtyRecd || 1, reqDate: addDays(TODAY, 14), deliveredQty: 0, cancelledQty: 0, backorder: false, status: "Open" }] }],
      creditChecks: [], activity: [act(ctx, `Replacement order at $0 net price created from ${r.id} line ${s.line}`)],
    }
    db.orders.unshift(so)
    s.doc = { type: "salesOrder", id }
    r.linked.push(s.doc)
  }
  if (s.template === 19) {
    const cmr = `CMR-TBD-${pad(db.seq2.cmr++)}`
    s.label = s.label.replace("Credit memo request", `Credit memo request ${cmr}`)
  }
  if (s.template === 20 && l?.serial) {
    const ib = db.ib.find((x) => x.serial === l.serial)
    if (ib) {
      ib.status = "Scrapped"
      ib.history.push({ on: TODAY, text: `Scrapped on ${r.id} disposition`, doc: { type: "rma", id: r.id } })
    }
  }
  if (s.template === 18 && l?.serial) {
    const ib = db.ib.find((x) => x.serial === l.serial)
    if (ib) ib.history.push({ on: TODAY, text: `Restocked to finished goods on ${r.id}`, doc: { type: "rma", id: r.id } })
  }
  s.done = true
  if (s.amount != null && s.template && s.template !== 19) ctx.emit("posting.posted", { template: s.template, amount: s.amount, currency: "USD", source: { type: "rma", id: r.id } })
  r.activity.push(act(ctx, `Settlement step ${s.id} done: ${s.label}${s.amount != null && s.template !== 19 ? ` (#${s.template} ${money(s.amount)})` : ""}`))
}
function nextSoId(db: DB) {
  let n = db.seq.so
  let id = `SO-2026-${String(n).padStart(5, "0")}`
  while (db.orders.some((o) => o.id === id)) id = `SO-2026-${String(++n).padStart(5, "0")}`
  db.seq.so = n + 1
  return id
}
export const retryStep = (id: string, stepId: string) =>
  M((db, ctx) => {
    const r = findRma(db, id)
    if (r.status !== "Settling") throw new ProtoError("Steps run while the RMA is Settling.")
    const s = r.settlement.find((x) => x.id === stepId)!
    runStepIn(db, ctx, r, s)
    if (s.error) throw new ProtoError(s.error)
  })
export const closeRma = (id: string) =>
  M((db, ctx) => {
    const r = findRma(db, id)
    if (r.status !== "Settling") throw new ProtoError(`${r.id} is ${r.status}.`)
    const open = r.settlement.filter((s) => !s.done)
    if (open.length) throw new ProtoError(`Closure blocked while a linked document is open: ${open.map((s) => `${s.id} ${s.error ?? s.label}`).join("; ")}.`)
    setStatus(r, "Closed")
    r.closedOn = TODAY
    r.activity.push(act(ctx, "Every line at a terminal disposition and all linked documents created or posted. Status Settling → Closed"))
  })
export const reopenRma = (id: string, reason: string) =>
  M((db, ctx) => {
    if (ctx.role !== "Controller") throw new ProtoError("Reopen is Controller only (p.27 §3.10).")
    const r = findRma(db, id)
    if (r.status !== "Closed" || !r.closedOn) throw new ProtoError("Reopen applies to a Closed RMA.")
    if (daysBetween(r.closedOn, TODAY) > 30) throw new ProtoError(`Reopen window is 30 days after Closed; ${r.id} closed ${r.closedOn} (${daysBetween(r.closedOn, TODAY)} days ago).`)
    if (!reason.trim()) throw new ProtoError("A reason is required.", "reason")
    setStatus(r, "Disposition Pending")
    r.activity.push(act(ctx, `Reopened by the Controller. Reason: ${reason}. Status Closed → Disposition Pending`))
  })

// ============================================================================ IB-001
const findIb = (db: DB, id: string) => {
  const x = db.ib.find((y) => y.id === id)
  if (!x) throw new ProtoError(`Installed base record ${id} not found.`)
  return x
}
export const captureCommissioning = (id: string, date: string) =>
  M((db, ctx) => {
    need(ctx, CS_ROLES, "Installed base maintenance (CS maintains, all read)")
    const ib = findIb(db, id)
    if (!date || date < ib.shipDate) throw new ProtoError(`Commissioning date must be on or after the ship date ${ib.shipDate}.`, "date")
    if (date > TODAY) throw new ProtoError("Commissioning date cannot be in the future.", "date")
    if (["Returned", "Scrapped"].includes(ib.status)) throw new ProtoError(`${ib.id} is ${ib.status}.`)
    ib.commissioningDate = date
    const from = ib.status
    ib.status = "In Service"
    ib.history.push({ on: date, text: `Commissioning date captured from field evidence. Status ${from} → In Service` })
  })
export const recordTransfer = (id: string, toCustomerId: string, document: string) =>
  M((db, ctx) => {
    need(ctx, CS_ROLES, "Ownership transfer")
    const ib = findIb(db, id)
    if (!toCustomerId || toCustomerId === ib.customerId) throw new ProtoError("Pick the new owner.", "to")
    if (!document.trim()) throw new ProtoError("An ownership transfer needs its document (resale or assignment).", "document")
    ib.transfers.push({ on: TODAY, fromCustomerId: ib.customerId, toCustomerId, document, by: ctx.role })
    const from = db.customers.find((c) => c.id === ib.customerId)?.name
    ib.customerId = toCustomerId
    ib.history.push({ on: TODAY, text: `Ownership transferred from ${from} to ${db.customers.find((c) => c.id === toCustomerId)?.name} (${document})` })
  })
export const proposeExtension = (id: string, months: number, reason: string) =>
  M((db, ctx) => {
    need(ctx, CS_ROLES, "Warranty extension request")
    const ib = findIb(db, id)
    if (!(months >= 1 && months <= 60)) throw new ProtoError("Extension between 1 and 60 months.", "months")
    if (!reason.trim()) throw new ProtoError("A reason is required.", "reason")
    const ext = `EXT-TBD-${pad(db.seq2.ext++)}`
    ib.extensions.push({ id: ext, months, reason, on: TODAY, by: ctx.role, approved: false, byUser: ctx.userId })
    ib.history.push({ on: TODAY, text: `Warranty extension ${ext} +${months} months requested; dated record waits for approval` })
  })
/** "Extend warranty with approval" [DOC:p.253 IB-001; p.215 §7.4]. The approver is not stated: reading
 *  SR-14 routes it to the Customer Service Manager (CS maintains IB-001), never the requester. Runs
 *  locally until the shared engine has a "Warranty extension" kind (Request FR-9). */
export const EXTENSION_APPROVER: Role = "Customer Service Manager"
export const decideExtension = (id: string, extId: string, outcome: "Approved" | "Rejected", reason?: string) =>
  M((db, ctx) => {
    need(ctx, [EXTENSION_APPROVER], "Approving a warranty extension (reading SR-14)")
    const ib = findIb(db, id)
    const x = ib.extensions.find((e) => e.id === extId)
    if (!x) throw new ProtoError(`Extension ${extId} not found.`)
    if (x.decided) throw new ProtoError(`${extId} is already ${x.decided.outcome.toLowerCase()}.`)
    if (x.byUser && x.byUser === ctx.userId) throw new ProtoError("The person who requested the extension cannot approve it.")
    if (outcome === "Rejected" && !reason?.trim()) throw new ProtoError("A reason is required to reject.", "reason")
    x.decided = { outcome, by: userName(ctx.userId), on: TODAY, reason }
    x.approved = outcome === "Approved"
    ib.history.push({ on: TODAY, text: `Warranty extension ${extId} +${x.months} months ${outcome === "Approved" ? "approved; entitlement end moves out" : `rejected (${reason})`} by ${userName(ctx.userId)}` })
  })
/** sales.pgiPosted: one installed base record per shipped FIN serial (created automatically at PGI). */
export function ibFromPgi(db: DB, deliveryId: string, serials: string[]) {
  const d = db.deliveries.find((x) => x.id === deliveryId)
  if (!d) return
  for (const s of serials) {
    if (db.ib.some((x) => x.serial === s)) continue
    const ser = db.serials.find((x) => x.id === s)
    if (!ser || !ser.item.startsWith("FIN")) continue
    db.ib.unshift({
      id: `IB-TBD-${db.seq2.ib++}`, serial: s, itemId: ser.item, customerId: d.customerId, site: d.shipTo, soId: d.soId, deliveryId: d.id, shipDate: d.shipDate ?? TODAY, status: "Shipped",
      warrantyBasis: "Ship date", warrantyMonths: ser.item === "FIN-TBD-5000SS" ? 24 : 18, extensions: [], transfers: [],
      history: [{ on: TODAY, text: `Shipped on ${d.id} (${d.pgiId}). Installed base record created at PGI`, doc: { type: "delivery", id: d.id } }],
    })
    if (!db.asBuilt[s]) db.asBuilt[s] = []
  }
}
export function ibFromPod(db: DB, podId: string, deliveryId: string) {
  const p = db.pods.find((x) => x.id === podId)
  for (const ib of db.ib.filter((x) => x.deliveryId === deliveryId && x.status === "Shipped")) {
    ib.status = "Installed"
    ib.podDate = p?.date ?? TODAY
    ib.history.push({ on: ib.podDate, text: `${podId} recorded. Status Shipped → Installed (POD date)`, doc: { type: "pod", id: podId } })
  }
}
/** quality.recallStageChanged to Recover: draft recall RMAs for the field population on the hero unit. */
export function recallRmas(db: DB, ctx: MutateCtx, recallId: string) {
  if (db.rmas.some((r) => r.recallId === recallId)) return
  const ib = db.ib.find((x) => x.id === "IB-TBD-0301")
  if (!ib) return
  // Field population of THIS campaign (quality-trace): rows In field whose parent is the installed unit.
  // Without a population for the campaign, only the hero campaign falls back to its seeded field serials.
  const campaign = store.hasSlice("qualityTrace") ? store.getSlice("qualityTrace").recalls.find((r) => r.id === recallId) : undefined
  const popSerials = campaign?.population.filter((p) => p.where === "In field" && p.parentSerial === ib.serial && !p.rmaId).map((p) => p.serial) ?? []
  const field = popSerials.length ? popSerials : recallId === "RCL-2026-001" ? ["SN-TBD-BSH-0301", "SN-TBD-BSH-0303"] : []
  if (!field.length) return
  const id = `RMA-TBD-${pad(db.seq2.rma++)}`
  db.rmas.unshift({
    id, cls: "RC3", status: "Draft", warranty: "Yes", customerId: ib.customerId, refType: "Serial Number", refDoc: ib.serial, reason: "Recall", reasonDetail: `Campaign ${recallId}: recover the remaining suspect HV bushings from ${ib.serial}.`,
    warehouse: QUARANTINE, freight: freightDefault("Recall"), restockPct: restockDefault("Recall"), ownerId: "USR-TBD-003", requested: TODAY, statusSince: TODAY, ibId: ib.id, recallId,
    rc3: { oilDrained: true, oilGal: 9, nitrogen: false, impactRecorder: false },
    lines: field.map((s, i) => ({ no: (i + 1) * 10, itemId: "RAW-TBD-BSH145", serial: s, batch: "BAT-TBD-B0301", qtyAuth: 1, qtyRecd: 0, origPrice: 26400, valuation: 18900, expected: "Replace", customerProperty: false })),
    receipts: [], settlement: [], linked: [], activity: [act(ctx, `Draft created by campaign ${recallId} entering Recover: field population on ${ib.serial}`)],
  })
  ib.history.push({ on: TODAY, text: `Recall RMA ${id} drafted for ${field.join(", ")}`, doc: { type: "rma", id } })
}

// ============================================================================ SVC-SPF-001 and quotation issue
/** ATP for a stocked SPARE material [DOC:p.254 §5.1 "Stocked SPARE materials show ATP"]: on hand less
 *  open sales order demand for the item (no scheduled receipts in the prototype; reading SR-21). */
export function spareAtp(db: DB, itemId: string) {
  const onHand = db.spareStock[itemId]?.qty ?? 0
  const demand = db.orders.filter((o) => !["Closed", "Cancelled", "Shipped"].includes(o.status)).flatMap((o) => o.lines).filter((l) => l.item === itemId).flatMap((l) => l.schedules).filter((x) => !["Delivered", "Closed", "Cancelled"].includes(x.status)).reduce((s, x) => s + Math.max(0, x.reqQty - x.deliveredQty - x.cancelledQty), 0)
  return { onHand, demand, atp: Math.max(0, onHand - demand) }
}
/** Spares entitlement check [DOC:p.254 §5.1]: when the unit is under warranty and the part relates to an
 *  open or attributable failure, the screen warns and offers the RMA path instead of a sale. "Relates" is
 *  reading SR-20: the part (built item, orderable or one of its serials) is on an RMA of this unit that is
 *  still open, or whose failure was attributed to a Manufacturing Defect or Component Supplier. */
export function spareFailureLinks(db: DB, ib: Ib, part: { itemId: string; orderable: string; serials?: string[] }) {
  const ent = entitlement(ib, TODAY, ib.history.find((h) => h.doc?.type === "recall")?.doc?.id)
  if (ent.verdict === "not covered") return []
  const unitSerials = new Set([ib.serial, ...(db.asBuilt[ib.serial] ?? []).flatMap((a) => a.serials ?? [])])
  return db.rmas
    .filter((r) => r.ibId === ib.id || r.lines.some((l) => l.serial && unitSerials.has(l.serial)))
    .filter((r) => !["Closed", "Cancelled", "Rejected"].includes(r.status) || r.attributable === "Manufacturing Defect" || r.attributable === "Component Supplier")
    .filter((r) => r.lines.some((l) => l.itemId === part.itemId || l.itemId === part.orderable || (l.serial && part.serials?.includes(l.serial))))
    .map((r) => ({ rmaId: r.id, status: r.status, why: ["Closed", "Cancelled", "Rejected"].includes(r.status) ? `failure attributed to ${r.attributable}` : `open failure (${r.status})` }))
}
export interface SpareLine {
  itemId: string
  built: string
  serials?: string[]
  qty: number
  price: number
  engineeringReview: boolean
  hazardous: boolean
}
export const createSparesQuote = (ibId: string, lines: SpareLine[], overrideReason?: string) =>
  M((db, ctx) => {
    need(ctx, [...CS_ROLES, "Sales rep", "Sales admin"], "Creating a spares quotation")
    const ib = findIb(db, ibId)
    if (!lines.length) throw new ProtoError("Select at least one line.")
    const warn = lines.flatMap((l) => spareFailureLinks(db, ib, { itemId: l.built, orderable: l.itemId, serials: l.serials }).map((x) => `${l.itemId}: ${x.rmaId} ${x.why}`))
    if (warn.length && !overrideReason?.trim()) throw new ProtoError(`Unit ${ib.serial} is under warranty and ${warn.join("; ")}. Use the RMA path instead of a sale, or give a reason to quote anyway.`, "rmaPath")
    const id = `QT-TBD-0${db.seq2.qt++}-V1`
    const c = db.customers.find((x) => x.id === ib.customerId)!
    const cad = c.currency === "CAD"
    db.quotations.unshift({
      id, version: 1, status: "Draft", customerId: ib.customerId, validUntil: addDays(TODAY, 30), ibId,
      lines: lines.map((l, i) => ({ no: (i + 1) * 10, item: l.itemId, qty: l.qty, price: cad ? Math.round(l.price * 1.36) : l.price, serial: ib.serial, note: l.built !== l.itemId ? `Built part ${l.built}` : undefined, engineeringReview: l.engineeringReview })),
      complianceRequired: lines.some((l) => l.hazardous), complianceDone: false,
      activity: [act(ctx, `Spares quotation created from the spares finder for ${ib.serial} (${ib.id}); the serial is carried on every line`), ...(warn.length ? [act(ctx, `Entitlement warning overridden (RMA path offered: ${warn.join("; ")}). Reason: ${overrideReason}`)] : [])],
    })
    ib.history.push({ on: TODAY, text: `Spares quotation ${id} (${lines.length} line(s))`, doc: { type: "quotation", id } })
    return id
  })
export const issueQuote = (id: string) =>
  M((db, ctx) => {
    const q = db.quotations.find((x) => x.id === id)
    if (!q) throw new ProtoError(`Quotation ${id} not found.`)
    if (!["Draft", "Internal Review"].includes(q.status)) throw new ProtoError(`Issue applies to Draft or Internal Review; ${q.id} is ${q.status}.`)
    const rev = q.lines.filter((l) => l.engineeringReview)
    if (rev.length) throw new ProtoError(`Lines ${rev.map((l) => l.no).join(", ")} have neither stock nor an info-record lead time: an engineering review task must finish before the quotation can issue (no promise is invented).`)
    if (q.complianceRequired && !q.complianceDone) throw new ProtoError("Hazardous or export-controlled lines: complete the compliance checklist before issuing.")
    const from = q.status
    q.status = "Issued"
    q.activity.push(act(ctx, `Issued (PDF). Status ${from} → Issued`))
  })
export const completeCompliance = (id: string) =>
  M((db, ctx) => {
    const q = db.quotations.find((x) => x.id === id)!
    q.complianceDone = true
    q.activity.push(act(ctx, "Compliance checklist completed (hazardous goods: oil transport classification and SDS attached)"))
  })
export const clearEngineeringReview = (id: string, line: number) =>
  M((db, ctx) => {
    if (!["Engineer", "Engineering Manager"].includes(ctx.role)) throw new ProtoError("The engineering review task is closed by Engineering.")
    const q = db.quotations.find((x) => x.id === id)!
    const l = q.lines.find((x) => x.no === line)!
    l.engineeringReview = false
    l.note = `${l.note ? l.note + "; " : ""}engineering review done: lead time 12 weeks confirmed`
    q.activity.push(act(ctx, `Engineering review on line ${line} closed: lead time 12 weeks confirmed`))
  })

export type { DocRef }
