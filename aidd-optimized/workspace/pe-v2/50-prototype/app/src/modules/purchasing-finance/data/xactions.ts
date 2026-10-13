// Actions for the feature-list screens of purchasing-finance. Same rules as actions.ts: every write goes
// through store.mutate (atomic, a ProtoError leaves the state untouched); a role gate appears only where
// the specification names the role (ASM-PERM-1), and the reading is shown on the screen. Approvals never
// happen here: they go through ApprovalButton to WF-INBOX (C-1).

import { ProtoError, store, type MutateCtx, type Result } from "@/store"
import type { CostCenterId, ISODate, MaterialId, Role, VendorId } from "@/data/domain"
import { COST_CENTERS, OPEN_PERIOD, PROFIT_CENTERS, TODAY } from "@/data/shared"
import type { PurchasingFinanceState } from "./slice"
import { allAvl, material, vendorEligibility, vendorOf } from "./logic"
import { allCenters } from "./centers"
import { breachRoute, effectiveFloor, landedOf, marginOf, parentAsOf, rateAt, scalePrice, whereUsedCc } from "./xlogic"
import type { ContractItem, ContractKind, ContractRec, DeviationKind, ScoringWeights, SkfChange, SupDevRec, VendorTaxProfile } from "./xtypes"
import type { PoLineX, PoRec, SkfValue } from "./types"

type D = PurchasingFinanceState
const m = <T>(fn: (d: D, ctx: MutateCtx) => T): Result<T> => store.mutate("purchasingFinance", fn)
const need = (ctx: MutateCtx, roles: Role[], what: string) => {
  if (!roles.includes(ctx.role)) throw new ProtoError(`${what} is done by ${roles.join(" or ")}. Switch "Acting as" to ${roles[0]}.`)
}
const r2 = (n: number) => Math.round(n * 100) / 100
const hist = (d: { history: { on: ISODate; by: string; text: string }[] }, ctx: MutateCtx, text: string) => d.history.push({ on: ctx.today, by: ctx.userId, text })

// ===================================================================== AVL (Book I G §2.2, §7)
export function addAvlRow(input: { itemId: MaterialId; vendorId: VendorId; rank: number; priceBasis: string; leadDays: number }) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Proposing an AVL row")
    if (!material(input.itemId)) throw new ProtoError("Choose an item.", "itemId")
    const v = vendorOf(d, input.vendorId)
    if (!v) throw new ProtoError("Choose a vendor.", "vendorId")
    if (v.onboarding !== "Active") throw new ProtoError(`${v.name} onboarding is ${v.onboarding}: only an Active vendor goes on the AVL (C-31).`, "vendorId")
    if (allAvl(d).some((a) => a.itemId === input.itemId && a.vendorId === input.vendorId)) throw new ProtoError("This item and vendor are already on the AVL.", "vendorId")
    if (!(input.rank >= 1)) throw new ProtoError("Rank starts at 1.", "rank")
    if (!input.priceBasis.trim()) throw new ProtoError("Enter the price basis (info record, contract or award).", "priceBasis")
    const id = `AVL-TBD-0${(d.seq += 1)}` as `AVL-TBD-${string}`
    d.avlAdded.push({ id, itemId: input.itemId, vendorId: input.vendorId, rank: input.rank, status: "Conditional", priceBasis: input.priceBasis })
    d.avlOverlay[id] = { leadDays: input.leadDays, note: ctx.role === "Purchasing Manager" ? `Approved by Purchasing Manager ${ctx.today}; first article pending` : "Proposed by Buyer: Purchasing Manager approval pending; Conditional until first article passes" }
    return id
  })
}
export function approveAvlRow(avlId: string) {
  return m((d, ctx) => {
    need(ctx, ["Purchasing Manager"], "AVL approval")
    const o = d.avlOverlay[avlId]
    if (!o?.note?.includes("approval pending")) throw new ProtoError("This row has no approval pending.")
    d.avlOverlay[avlId] = { ...o, note: `Approved by Purchasing Manager ${ctx.today}; first article pending` }
  })
}
export function setAvlRank(avlId: string, rank: number) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Changing AVL rank")
    const row = allAvl(d).find((a) => a.id === avlId)
    if (!row) throw new ProtoError("AVL row not found.")
    if (!(rank >= 1 && Number.isInteger(rank))) throw new ProtoError("Rank is a whole number from 1.", "rank")
    d.avlOverlay[avlId] = { ...d.avlOverlay[avlId], rank }
  })
}
/** The scorecard feeds status proposals; Quality decides qualification status [DOC:p.107 role table]. */
export function proposeAvlChange(avlId: string, to: "Qualified" | "Conditional" | "Suspended", reason: string, source: "Scorecard" | "Buyer" = "Buyer") {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Proposing an AVL status change")
    const row = allAvl(d).find((a) => a.id === avlId)
    if (!row) throw new ProtoError("AVL row not found.")
    if (row.status === to) throw new ProtoError(`The row is already ${to}.`)
    if (!reason.trim()) throw new ProtoError("Give the reason for the proposal.", "reason")
    if (d.avlProposals.some((p) => p.avlId === avlId && p.status === "Open")) throw new ProtoError("A proposal for this row is already open.")
    const id = `AVP-TBD-${String(d.avlProposals.length + 1).padStart(3, "0")}`
    d.avlProposals.unshift({ id, avlId, vendorId: row.vendorId, itemId: row.itemId, to, reason, source, status: "Open", by: ctx.userId, on: ctx.today })
    return id
  })
}
export function decideAvlProposal(id: string, apply: boolean) {
  return m((d, ctx) => {
    need(ctx, ["Quality Manager", "Quality engineer"], "Deciding an AVL status proposal")
    const p = d.avlProposals.find((x) => x.id === id)
    if (!p || p.status !== "Open") throw new ProtoError("The proposal is not open.")
    p.status = apply ? "Applied" : "Declined"
    p.decidedBy = ctx.userId
    p.decidedOn = ctx.today
    if (apply) d.avlOverlay[p.avlId] = { ...d.avlOverlay[p.avlId], status: p.to, note: `Set ${p.to} by ${ctx.role} on ${ctx.today} from proposal ${p.id}` }
  })
}

// ===================================================================== contracts and scheduling agreements (Book II §7.3, Phase 2)
export function createContract(input: { kind: ContractKind; title: string; vendorId: VendorId; validFrom: ISODate; validTo: ISODate; itemId: MaterialId; targetQty: number; price: number }) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Creating a contract")
    const v = vendorOf(d, input.vendorId)
    if (!v) throw new ProtoError("Choose a vendor.", "vendorId")
    if (!input.title.trim()) throw new ProtoError("Enter a title.", "title")
    if (!material(input.itemId)) throw new ProtoError("Choose an item.", "itemId")
    if (!input.validFrom || !input.validTo || input.validTo <= input.validFrom) throw new ProtoError("The end date must be after the start date.", "validTo")
    if (!(input.price > 0)) throw new ProtoError("Enter the contract price.", "price")
    if (!(input.targetQty > 0)) throw new ProtoError("Enter the target quantity.", "targetQty")
    const overlap = d.contracts.find((c) => c.vendorId === input.vendorId && c.state !== "Expired" && c.state !== "Closed" && c.items.some((i) => i.itemId === input.itemId) && c.validFrom <= input.validTo && c.validTo >= input.validFrom)
    if (overlap) throw new ProtoError(`${overlap.id} already covers this vendor and item in an overlapping period.`, "validFrom")
    const id = `CTR-TBD-${String(d.contracts.length + 1).padStart(4, "0")}` as ContractRec["id"]
    d.contracts.unshift({
      id, kind: input.kind, title: input.title.trim(), vendorId: input.vendorId, currency: v.currency, validFrom: input.validFrom, validTo: input.validTo, state: "Draft",
      items: [{ itemId: input.itemId, unit: material(input.itemId)?.baseUom ?? "EA", targetQty: input.targetQty, scales: [{ fromQty: 0, price: input.price }] }], releases: [], createdOn: ctx.today, createdBy: ctx.userId,
      history: [{ on: ctx.today, by: ctx.userId, text: "Created" }],
    })
    return id
  })
}
const ctr = (d: D, id: string) => {
  const c = d.contracts.find((x) => x.id === id)
  if (!c) throw new ProtoError(`Contract ${id} not found.`)
  return c
}
export function addContractScale(id: string, itemId: string, fromQty: number, price: number) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Maintaining contract prices")
    const c = ctr(d, id)
    if (c.state !== "Draft") throw new ProtoError(`A ${c.state} contract's prices are fixed; end it and create a new one.`)
    const it = c.items.find((x) => x.itemId === itemId)
    if (!it) throw new ProtoError("Item not on the contract.")
    if (!(price > 0)) throw new ProtoError("Enter a price.", "price")
    if (!(fromQty >= 0)) throw new ProtoError("From quantity cannot be negative.", "fromQty")
    if (it.scales.some((s) => s.fromQty === fromQty)) throw new ProtoError("A scale row already starts at this quantity.", "fromQty")
    it.scales = [...it.scales, { fromQty, price }].sort((a, b) => a.fromQty - b.fromQty)
    hist(c, ctx, `Scale row from ${fromQty} at ${price}`)
  })
}
export function activateContract(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Purchasing Manager"], "Activating a contract")
    const c = ctr(d, id)
    if (c.state !== "Draft") throw new ProtoError(`Only a Draft contract is activated (this one is ${c.state}).`)
    const v = vendorOf(d, c.vendorId)
    const el = vendorEligibility(v)
    if (!el.ok) throw new ProtoError(`Cannot activate: ${el.reason}`)
    if (c.validTo < ctx.today) throw new ProtoError("The validity ended before today.")
    c.state = "Active"
    hist(c, ctx, "Activated")
  })
}
export function closeContract(id: string, reason: string) {
  return m((d, ctx) => {
    need(ctx, ["Purchasing Manager"], "Closing a contract")
    const c = ctr(d, id)
    if (c.state !== "Active") throw new ProtoError(`Only an Active contract is closed early (this one is ${c.state}).`)
    if (!reason.trim()) throw new ProtoError("A reason is required.")
    c.state = "Closed"
    hist(c, ctx, `Closed early: ${reason}`)
  })
}
/** A release (call-off) creates a Draft PO line priced from the contract's scale and links back to it. A planned schedule line is released the same way. */
export function releaseAgainstContract(id: string, input: { itemId: MaterialId; qty: number; date: ISODate; plannedNo?: number }) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Releasing against a contract")
    const c = ctr(d, id)
    if (c.state !== "Active") throw new ProtoError(`Releases run against an Active contract (this one is ${c.state}).`)
    const it = c.items.find((x) => x.itemId === input.itemId)
    if (!it) throw new ProtoError("Item not on the contract.", "itemId")
    if (!(input.qty > 0)) throw new ProtoError("Enter the release quantity.", "qty")
    if (input.date < c.validFrom || input.date > c.validTo) throw new ProtoError(`The delivery date must fall inside ${c.validFrom} to ${c.validTo}.`, "date")
    const released = c.releases.filter((r) => r.itemId === input.itemId && r.state !== "Planned").reduce((t, r) => t + r.qty, 0)
    if (released + input.qty > it.targetQty) throw new ProtoError(`The release would exceed the target quantity: ${released} released of ${it.targetQty} ${it.unit}.`, "qty")
    const price = scalePrice(it.scales, input.qty)
    if (price == null) throw new ProtoError("No scale price covers this quantity.")
    const v = vendorOf(d, c.vendorId)!
    const el = vendorEligibility(v)
    if (!el.ok) throw new ProtoError(el.reason ?? "Vendor not eligible.")
    const poId = `PO-TBD-0${(d.seq += 1)}` as PoRec["id"]
    const line: PoLineX = { no: 10, itemId: input.itemId, qty: input.qty, price, status: "Open", needBy: input.date, schedules: [{ no: 10, qty: input.qty, date: input.date }], received: 0, invoiced: 0, promiseHistory: [] }
    d.purchaseOrders.unshift({
      id: poId, title: `${v.name}: release against ${c.id}`, status: "Draft", vendorId: c.vendorId, createdOn: ctx.today, createdBy: ctx.userId, buyerId: ctx.userId, changePending: false, entityId: "LE-TBD-10", currency: c.currency,
      activity: [{ at: ctx.today, by: ctx.role, text: `Created as a release against ${c.id} (price source Contract)` }], type: "Standard", shipToWarehouseId: "WH-TBD-01", qualityClauses: material(input.itemId)?.batchFlag ? ["Q1"] : [], buyAmerica: false,
      prIds: [], lines: [line], revision: 0, revisions: [], expedite: [],
    })
    const planned = input.plannedNo != null ? c.releases.find((r) => r.no === input.plannedNo && r.state === "Planned") : undefined
    if (planned) Object.assign(planned, { state: "Released", poId, poLine: 10, qty: input.qty, date: input.date })
    else c.releases.push({ no: Math.max(0, ...c.releases.map((r) => r.no)) + 1, itemId: input.itemId, qty: input.qty, date: input.date, state: "Released", poId, poLine: 10 })
    hist(c, ctx, `Release of ${input.qty} ${it.unit} to ${poId} at ${price}`)
    return poId
  })
}

// ===================================================================== supplier deviations (Book IV E-DTS-04)
const ENG: Role[] = ["Engineer", "Engineering Manager", "Manufacturing engineer"]
const QUAL: Role[] = ["Quality engineer", "Quality Manager"]
export function submitDeviation(input: { vendorId: VendorId; poId?: string; poLine?: number; rfqId?: string; stpId?: string; characteristic: string; kind: DeviationKind; original: string; proposed: string; reason: string; priceDelta?: number; leadDaysDelta?: number }) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Recording a supplier deviation on the vendor's behalf")
    if (!vendorOf(d, input.vendorId)) throw new ProtoError("Choose the vendor.", "vendorId")
    if (!input.characteristic.trim()) throw new ProtoError("Name the STP characteristic or PO line feature.", "characteristic")
    if (!input.original.trim() || !input.proposed.trim()) throw new ProtoError("State both the specified and the proposed value.", "proposed")
    if (!input.reason.trim()) throw new ProtoError("Give the vendor's reason.", "reason")
    if (!input.poId && !input.rfqId) throw new ProtoError("Link the deviation to a PO line or an RFQ.", "poId")
    if (input.poId) {
      const p = d.purchaseOrders.find((x) => x.id === input.poId)
      if (!p) throw new ProtoError("PO not found.", "poId")
      if (p.vendorId !== input.vendorId) throw new ProtoError(`${p.id} belongs to ${p.vendorId}, not this vendor.`, "poId")
      if (input.poLine && !p.lines.some((l) => l.no === input.poLine)) throw new ProtoError(`Line ${input.poLine} is not on ${p.id}.`, "poLine")
    }
    const id = `SDV-TBD-${String(d.supplierDeviations.length + 1).padStart(4, "0")}` as SupDevRec["id"]
    d.supplierDeviations.unshift({
      id, vendorId: input.vendorId, poId: input.poId, poLine: input.poLine, rfqId: input.rfqId, stpId: input.stpId as SupDevRec["stpId"], characteristic: input.characteristic.trim(), kind: input.kind, original: input.original, proposed: input.proposed,
      reason: input.reason, attachments: [], priceDelta: input.priceDelta, leadDaysDelta: input.leadDaysDelta, submittedOn: ctx.today, submittedBy: ctx.userId, engineering: { state: "Pending" }, quality: { state: "Pending" },
      activity: [{ at: ctx.today, by: ctx.role, text: "Recorded on the vendor's behalf; routed to Engineering and Quality" }],
    })
    return id
  })
}
export function decideDeviation(id: string, side: "engineering" | "quality", outcome: "Accepted" | "Rejected", note: string) {
  return m((d, ctx) => {
    need(ctx, side === "engineering" ? ENG : QUAL, side === "engineering" ? "The Engineering decision on a supplier deviation" : "The Quality decision on a supplier deviation")
    const x = d.supplierDeviations.find((v) => v.id === id)
    if (!x) throw new ProtoError("Deviation not found.")
    if (x.withdrawn) throw new ProtoError("The vendor withdrew this request.")
    if (x[side].state !== "Pending") throw new ProtoError(`${side === "engineering" ? "Engineering" : "Quality"} already decided (${x[side].state}).`)
    if (x.engineering.state === "Rejected" || x.quality.state === "Rejected") throw new ProtoError("Already rejected by the other side: the request is closed.")
    if (outcome === "Rejected" && !note.trim()) throw new ProtoError("A rejection needs a note for the vendor.", "note")
    x[side] = { state: outcome, by: ctx.userId, on: ctx.today, note: note.trim() || undefined }
    x.activity.push({ at: ctx.today, by: side === "engineering" ? "Engineering" : "Quality", text: `${outcome}${note.trim() ? `: ${note.trim()}` : ""}` })
    if (x.engineering.state === "Accepted" && x.quality.state === "Accepted" && x.stpId) {
      const t = d.stps.find((s) => s.id === x.stpId)
      const ack = t?.acknowledgements.find((a) => a.vendorId === x.vendorId)
      if (ack && ack.status === "Exception") {
        ack.status = "Acknowledged"
        ack.on = ctx.today
        x.activity.push({ at: ctx.today, by: "System", text: `Both accepted: the vendor's Exception on ${t!.id} is recorded as Acknowledged (reading OQ-PF-27)` })
      }
    }
  })
}
export function withdrawDeviation(id: string) {
  return m((d, ctx) => {
    const x = d.supplierDeviations.find((v) => v.id === id)
    if (!x) throw new ProtoError("Deviation not found.")
    if (x.withdrawn) throw new ProtoError("Already withdrawn.")
    if (x.engineering.state !== "Pending" || x.quality.state !== "Pending") throw new ProtoError("A request already decided cannot be withdrawn.")
    x.withdrawn = true
    x.activity.push({ at: ctx.today, by: ctx.role, text: "Withdrawn" })
  })
}
export const deviationState = (x: SupDevRec): "Withdrawn" | "Rejected" | "Accepted" | "In review" | "Submitted" =>
  x.withdrawn ? "Withdrawn" : x.engineering.state === "Rejected" || x.quality.state === "Rejected" ? "Rejected" : x.engineering.state === "Accepted" && x.quality.state === "Accepted" ? "Accepted" : x.engineering.state === "Accepted" || x.quality.state === "Accepted" ? "In review" : "Submitted"

// ===================================================================== PO line dialogs (Book I G §1 step 7, §2.1)
/** Short-close one line: its open quantity is closed with a reason; the PO moves to Received when no line stays open. Purchasing Manager only [DOC:p.100; p.107]. */
export function shortCloseLine(poId: string, lineNo: number, reason: string) {
  return m((d, ctx) => {
    need(ctx, ["Purchasing Manager"], "Short-close")
    const p = d.purchaseOrders.find((x) => x.id === poId)
    if (!p) throw new ProtoError(`PO ${poId} not found.`)
    const l = p.lines.find((x) => x.no === lineNo)
    if (!l) throw new ProtoError(`Line ${lineNo} not found.`)
    if (!["Sent", "Confirmed", "Partially Received"].includes(p.status)) throw new ProtoError(`A line is short-closed on a Sent, Confirmed or Partially Received PO (this one is ${p.status}).`)
    if (l.status !== "Partial" && l.status !== "Open") throw new ProtoError(`Line ${lineNo} is ${l.status}: nothing open to close.`)
    if (!reason.trim()) throw new ProtoError("A reason is required.", "reason")
    if (l.received <= 0) throw new ProtoError("Nothing is received on this line: cancel it with the PO instead of short-closing it.")
    const open = l.qty - l.received
    l.qty = l.received
    l.schedules = l.schedules.map((x) => ({ ...x })).filter((x) => x.qty > 0)
    let left = open
    for (const sc of [...l.schedules].reverse()) {
      const cut = Math.min(sc.qty, left)
      sc.qty -= cut
      left -= cut
    }
    l.schedules = l.schedules.filter((x) => x.qty > 0)
    l.status = "Received"
    p.activity.push({ at: ctx.today, by: ctx.role, text: `Line ${lineNo} short-closed (${open} open quantity closed): ${reason}` })
    if (p.lines.every((x) => ["Received", "Closed", "Cancelled"].includes(x.status))) {
      p.status = "Received"
      p.shortCloseReason = reason
      p.activity.push({ at: ctx.today, by: "System", text: "No open line left: PO moves to Received for matching" })
    }
    return open
  })
}

// ===================================================================== vendor tax profile (Part A §11.3)
const TAX_ROLES: Role[] = ["Controller", "AP clerk"]
export function saveVendorTax(vendorId: string, profile: Omit<VendorTaxProfile, "updatedOn" | "updatedBy" | "certificates"> & { certificates?: VendorTaxProfile["certificates"] }) {
  return m((d, ctx) => {
    need(ctx, TAX_ROLES, "Maintaining the vendor tax profile")
    const v = vendorOf(d, vendorId)
    if (!v) throw new ProtoError("Vendor not found.")
    if (!profile.taxAddressRole) throw new ProtoError("Tax address role is required: Ship-To (default) or Bill-To (services).", "taxAddressRole")
    const seen = new Set<string>()
    for (const r of profile.registrations) {
      if (!r.jurisdiction.trim()) throw new ProtoError("Every registration needs a jurisdiction (state or province).", "jurisdiction")
      if (!r.number.trim()) throw new ProtoError(`Enter the registration number for ${r.jurisdiction}.`, "registration")
      const k = r.jurisdiction.trim().toUpperCase()
      if (seen.has(k)) throw new ProtoError(`${k} appears twice: one registration per jurisdiction.`, "jurisdiction")
      seen.add(k)
    }
    d.vendorTax[vendorId] = { ...profile, certificates: profile.certificates ?? d.vendorTax[vendorId]?.certificates ?? [], updatedOn: ctx.today, updatedBy: ctx.userId }
    const o = (d.vendorOverlay[vendorId] ??= { history: [] })
    o.history.push({ on: ctx.today, by: ctx.userId, role: ctx.role, text: `Tax profile saved: ${profile.registrations.length} registration(s), use-tax accrual ${profile.useTaxAccrual ? "on" : "off"}, tax address ${profile.taxAddressRole}` })
  })
}

// ===================================================================== RFQ scoring and bid versions (Book IV §3.3)
const rfq = (d: D, id: string) => {
  const q = d.rfqs.find((x) => x.id === id)
  if (!q) throw new ProtoError(`RFQ ${id} not found.`)
  return q
}
export function setScoringWeights(rfqId: string, w: ScoringWeights) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Setting the scoring weights")
    const q = rfq(d, rfqId)
    if (q.status === "Awarded" || q.status === "Cancelled") throw new ProtoError(`A ${q.status} RFQ keeps its weights.`)
    const vals = Object.values(w)
    if (vals.some((v) => !Number.isFinite(v) || v < 0)) throw new ProtoError("Weights are numbers from 0.", "weights")
    const sum = vals.reduce((a, b) => a + b, 0)
    if (sum !== 100) throw new ProtoError(`The weights add up to ${sum}; they must add up to 100.`, "weights")
    const sc = (d.rfqScoring[rfqId] ??= { weights: w, selected: {} })
    sc.weights = w
    q.activity.push({ at: ctx.today, by: ctx.role, text: `Scoring weights set: landed ${w.landed}, lead ${w.lead}, quality ${w.quality}, Buy America ${w.buyAmerica}` })
  })
}
/** Copy the selected bid version into the response the grid and the award read. */
function syncResponse(d: D, rfqId: string, vendorId: string) {
  const sel = d.rfqScoring[rfqId]?.selected[vendorId]
  const b = d.bidVersions.find((x) => x.rfqId === rfqId && x.vendorId === vendorId && x.version === sel)
  const r = d.rfqResponses.find((x) => x.rfqId === rfqId && x.vendorId === vendorId)
  if (b && r) Object.assign(r, { prices: r.prices.map((p) => ({ ...p, price: b.price, leadDays: b.leadDays })), freightPct: b.freightPct, dutyPct: b.dutyPct, validUntil: b.validUntil, buyAmerica: b.buyAmerica, received: true, receivedOn: b.receivedOn })
}
export function selectBidVersion(rfqId: string, vendorId: string, version: number) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Choosing the bid version")
    const q = rfq(d, rfqId)
    if (q.status === "Awarded" || q.status === "Cancelled") throw new ProtoError(`The bid version is fixed once the RFQ is ${q.status}.`)
    if (!d.bidVersions.some((b) => b.rfqId === rfqId && b.vendorId === vendorId && b.version === version)) throw new ProtoError("That version does not exist.")
    const sc = (d.rfqScoring[rfqId] ??= { weights: { landed: 50, lead: 20, quality: 20, buyAmerica: 10 }, selected: {} })
    sc.selected[vendorId] = version
    syncResponse(d, rfqId, vendorId)
    q.activity.push({ at: ctx.today, by: ctx.role, text: `Bid version ${version} selected for ${vendorId}` })
  })
}
export function reviseBid(rfqId: string, vendorId: string, input: { price: number; leadDays: number; freightPct: number; dutyPct: number; validUntil: ISODate; buyAmerica: boolean; note: string; deviations: string[] }) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Keying a revised bid")
    const q = rfq(d, rfqId)
    if (q.status !== "Issued" && q.status !== "Responses In") throw new ProtoError(`A revised bid is keyed while the RFQ is Issued or Responses In (now ${q.status}).`)
    if (!d.bidVersions.some((b) => b.rfqId === rfqId && b.vendorId === vendorId)) throw new ProtoError("This vendor has no original bid to revise.")
    if (!(input.price > 0)) throw new ProtoError("Enter the revised unit price.", "price")
    if (!(input.leadDays > 0)) throw new ProtoError("Enter the lead time in days.", "leadDays")
    const version = Math.max(...d.bidVersions.filter((b) => b.rfqId === rfqId && b.vendorId === vendorId).map((b) => b.version)) + 1
    d.bidVersions.push({ rfqId, vendorId: vendorId as VendorId, version, receivedOn: ctx.today, price: input.price, leadDays: input.leadDays, freightPct: input.freightPct, dutyPct: input.dutyPct, validUntil: input.validUntil, buyAmerica: input.buyAmerica, note: input.note || "Revised bid", deviations: input.deviations })
    const sc = (d.rfqScoring[rfqId] ??= { weights: { landed: 50, lead: 20, quality: 20, buyAmerica: 10 }, selected: {} })
    sc.selected[vendorId] = version
    syncResponse(d, rfqId, vendorId)
    q.activity.push({ at: ctx.today, by: ctx.role, text: `Revised bid (version ${version}) keyed for ${vendorId}` })
    return version
  })
}
export { landedOf }

// ===================================================================== driver rates (Book I I §3.1)
export function addDriverVersion(id: string, rate: number, validFrom: ISODate, note: string) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant", "Controller"], "Maintaining driver rates")
    const r = d.driverRates.find((x) => x.id === id)
    if (!r) throw new ProtoError("Driver not found.")
    if (!(rate > 0)) throw new ProtoError("Enter a rate above zero.", "rate")
    if (!validFrom) throw new ProtoError("Enter the effective date.", "validFrom")
    const last = [...r.versions].sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
    if (validFrom <= last.validFrom) throw new ProtoError(`The effective date must be after the current version's ${last.validFrom}: released versions are never edited, a change is a new dated version.`, "validFrom")
    r.versions.push({ validFrom, rate: r2(rate), by: ctx.userId, note: note.trim() || "Rate maintained" })
    return r2((rate / last.rate - 1) * 100)
  })
}
export function addDriver(input: { driver: string; unit: string; family: string; rate: number; validFrom: ISODate; index?: string }) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant", "Controller"], "Maintaining driver rates")
    if (!input.driver.trim()) throw new ProtoError("Name the driver.", "driver")
    if (!input.unit.trim()) throw new ProtoError("Enter the unit.", "unit")
    if (!input.family.trim()) throw new ProtoError("Choose the product family.", "family")
    if (!(input.rate > 0)) throw new ProtoError("Enter a rate above zero.", "rate")
    if (d.driverRates.some((x) => x.family === input.family && x.driver.toLowerCase() === input.driver.trim().toLowerCase())) throw new ProtoError("This family already has that driver: add a new dated version instead.", "driver")
    const id = `DRV-${String(d.driverRates.length + 1).padStart(3, "0")}`
    d.driverRates.push({ id, driver: input.driver.trim(), unit: input.unit.trim(), family: input.family, index: input.index, versions: [{ validFrom: input.validFrom || TODAY, rate: r2(input.rate), by: ctx.userId, note: "First version" }] })
    return id
  })
}
const DRIVER_OF: Record<string, string> = { "RAW-TBD-CRGO23": "DRV-001", "RAW-TBD-CTC": "DRV-002" }
/** Refresh the Driver-rate lines of a Draft estimate to the rates effective today; a Released estimate locks its values (C-35). */
export function refreshEstimateRates(ceId: string) {
  return m((d, ctx) => {
    need(ctx, ["Estimator", "Cost accountant"], "Refreshing estimate rates")
    const c = d.costEstimates.find((x) => x.id === ceId)
    if (!c) throw new ProtoError("Estimate not found.")
    if (c.status !== "Draft") throw new ProtoError("A Released estimate locks its values (C-35). Supersede it to refresh the rates.")
    let n = 0
    let delta = 0
    for (const it of c.items) {
      const drv = d.driverRates.find((x) => x.id === DRIVER_OF[it.ref ?? ""] && x.family.startsWith("Power transformers"))
      if (!drv || it.source !== "Driver rate") continue
      const cur = rateAt(drv, ctx.today)
      if (!cur || Math.abs(cur.rate - it.rate) < 0.005) continue
      const before = it.value
      it.rate = cur.rate
      it.value = r2(it.qty * cur.rate)
      delta += it.value - before
      n++
    }
    if (!n) throw new ProtoError("Every driver-rate line is already at today's rate.")
    c.material = r2(c.items.filter((i) => i.component === "Material").reduce((t, i) => t + i.value, 0))
    c.total = r2(c.items.reduce((t, i) => t + i.value, 0))
    return { lines: n, delta: r2(delta) }
  })
}

// ===================================================================== margin floors (Book I I §6.3)
export function setItemFloor(itemId: string, floorPct: number, note: string) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager"], "Setting an item floor")
    const mt = material(itemId)
    if (!mt) throw new ProtoError("Choose an item.", "itemId")
    if (!(floorPct > 0 && floorPct < 80)) throw new ProtoError("The floor is a percentage above 0 and below 80.", "floorPct")
    const pc = PROFIT_CENTERS.find((p) => p.id === mt.profitCenterId)
    const pcFloor = d.addedProfitCenters.find((p) => p.id === pc?.id)?.priceFloorPct ?? pc?.priceFloorPct
    if (pcFloor != null && floorPct < pcFloor) throw new ProtoError(`An item floor is stricter than its profit center's: ${pc!.id} is ${pcFloor}%.`, "floorPct")
    if (!note.trim()) throw new ProtoError("Give the reason for the stricter floor.", "note")
    const ex = d.itemFloors.find((f) => f.itemId === itemId)
    if (ex) Object.assign(ex, { floorPct, note, setBy: ctx.userId, on: ctx.today })
    else d.itemFloors.push({ itemId: itemId as MaterialId, floorPct, note, setBy: ctx.userId, on: ctx.today })
  })
}
export function removeItemFloor(itemId: string) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager"], "Removing an item floor")
    if (!d.itemFloors.some((f) => f.itemId === itemId)) throw new ProtoError("No item floor to remove.")
    d.itemFloors = d.itemFloors.filter((f) => f.itemId !== itemId)
  })
}
/** Registers a breach found by the floor check; the approval itself goes through ApprovalButton "Below price floor" with subject `${id}:floor`. */
export function registerBreach(input: { source: "Quote" | "Sales order" | "Price list row" | "Agreement row"; ref: string; itemId: MaterialId; price: number; cost: number; justification: string }) {
  return m((d, ctx) => {
    const fl = effectiveFloor(d, input.itemId)
    if (fl.pct == null) throw new ProtoError("No floor is stated for this item's profit center: no breach is possible (reading OQ-PF-11).")
    if (!(input.price > 0) || !(input.cost > 0)) throw new ProtoError("Enter a price and a cost above zero.", "price")
    const margin = marginOf(input.price, input.cost)
    if (margin >= fl.pct) throw new ProtoError(`The margin ${margin}% meets the ${fl.pct}% floor: nothing to approve.`)
    if (!input.justification.trim()) throw new ProtoError("Every approval stores a justification: enter it before the request goes.", "justification")
    if (!input.ref.trim()) throw new ProtoError("Name the quote, order or row that breaches.", "ref")
    const points = r2(fl.pct - margin)
    const id = `FB-2026-${String(d.floorBreaches.length + 4).padStart(4, "0")}`
    d.floorBreaches.unshift({ id, on: ctx.today, source: input.source, ref: input.ref.trim(), itemId: input.itemId, price: input.price, cost: input.cost, marginPct: margin, floorPct: fl.pct, points, status: "Pending", justification: input.justification.trim(), route: breachRoute(points) })
    return id
  })
}

// ===================================================================== customer price agreements (Book I I §6.2)
const agr = (d: D, id: string) => {
  const a = d.agreements.find((x) => x.id === id)
  if (!a) throw new ProtoError(`Agreement ${id} not found.`)
  return a
}
const PRICING_ROLES: Role[] = ["Pricing Manager", "Sales admin"]
export function createAgreement(input: { customerId: string; name: string; validFrom: ISODate; validTo: ISODate; scope: string; contractTerm: "Fixed at Order" | "Ship-Date Adjusted"; baseListId?: string }) {
  return m((d, ctx) => {
    need(ctx, PRICING_ROLES, "Creating a customer price agreement")
    if (!input.customerId) throw new ProtoError("Choose the customer.", "customerId")
    if (!input.name.trim()) throw new ProtoError("Enter a name.", "name")
    if (!input.validFrom || !input.validTo || input.validTo <= input.validFrom) throw new ProtoError("The end date must be after the start date.", "validTo")
    if (!input.scope.trim()) throw new ProtoError("Name the scope (items or item groups).", "scope")
    const clash = d.agreements.find((a) => a.customerId === input.customerId && a.state !== "Expired" && a.validFrom <= input.validTo && a.validTo >= input.validFrom)
    if (clash) throw new ProtoError(`${clash.id} already covers this customer in an overlapping period.`, "validFrom")
    const id = `AGR-TBD-${String(d.agreements.length + 40).padStart(4, "0")}` as `AGR-${string}`
    d.agreements.unshift({ id, customerId: input.customerId as never, name: input.name.trim(), validFrom: input.validFrom, validTo: input.validTo, scope: input.scope.trim(), contractTerm: input.contractTerm, attachment: "", rows: [], state: "Draft", baseListId: input.baseListId as never, history: [{ on: ctx.today, by: ctx.userId, text: "Draft created" }] })
    return id
  })
}
export function addAgreementRow(id: string, itemId: MaterialId, price: number) {
  return m((d, ctx) => {
    need(ctx, PRICING_ROLES, "Maintaining agreement rows")
    const a = agr(d, id)
    if (a.state === "Expired") throw new ProtoError("An expired agreement is read-only.")
    if (!material(itemId)) throw new ProtoError("Choose an item.", "itemId")
    if (!(price > 0)) throw new ProtoError("Enter a price above zero.", "price")
    if (a.rows.some((r) => r.itemId === itemId)) throw new ProtoError("The item already has a row: remove it and add the new price.", "itemId")
    const row = { customerId: a.customerId, itemId, price, validFrom: a.validFrom, validTo: a.validTo }
    a.rows.push(row)
    d.customerPrices.push(row)
    a.history = [...(a.history ?? []), { on: ctx.today, by: ctx.userId, text: `Row ${itemId} at ${price}` }]
  })
}
export function removeAgreementRow(id: string, itemId: string) {
  return m((d, ctx) => {
    need(ctx, PRICING_ROLES, "Maintaining agreement rows")
    const a = agr(d, id)
    if (a.state !== "Draft") throw new ProtoError("Rows of an Active agreement are fixed: end the agreement and create a new one.")
    a.rows = a.rows.filter((r) => r.itemId !== itemId)
    d.customerPrices = d.customerPrices.filter((r) => !(r.customerId === a.customerId && r.itemId === itemId && r.validFrom === a.validFrom))
    a.history = [...(a.history ?? []), { on: ctx.today, by: ctx.userId, text: `Row ${itemId} removed` }]
  })
}
export function setAgreementRebate(id: string, tiers: { aboveAmount: number; pct: number }[]) {
  return m((d, ctx) => {
    need(ctx, PRICING_ROLES, "Maintaining rebate terms")
    const a = agr(d, id)
    if (a.state === "Expired") throw new ProtoError("An expired agreement is read-only.")
    for (const t of tiers) if (!(t.aboveAmount >= 0) || !(t.pct > 0 && t.pct <= 25)) throw new ProtoError("Each tier needs an amount from 0 and a percentage above 0 up to 25.", "tiers")
    a.rebateTiers = tiers
    a.rebate = tiers.length ? tiers.map((t) => `${t.pct}% volume rebate above $${t.aboveAmount.toLocaleString("en-US")} shipped`).join("; ") + " (accrual note to ACC)" : "None"
    a.history = [...(a.history ?? []), { on: ctx.today, by: ctx.userId, text: `Rebate terms: ${a.rebate}` }]
  })
}
export function attachAgreementContract(id: string, filename: string) {
  return m((d, ctx) => {
    need(ctx, PRICING_ROLES, "Attaching the signed contract")
    const a = agr(d, id)
    if (a.state === "Expired") throw new ProtoError("An expired agreement is read-only.")
    if (!/\.pdf$/i.test(filename.trim())) throw new ProtoError("Attach the signed contract as a PDF file.", "attachment")
    a.attachment = filename.trim()
    a.history = [...(a.history ?? []), { on: ctx.today, by: ctx.userId, text: `Signed contract attached: ${filename.trim()}` }]
  })
}
export function activateAgreement(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager"], "Activating an agreement")
    const a = agr(d, id)
    if (a.state !== "Draft") throw new ProtoError(`Only a Draft agreement is activated (this one is ${a.state ?? "Active"}).`)
    if (!a.rows.length) throw new ProtoError("Add at least one price row.")
    if (!a.attachment) throw new ProtoError("Attach the signed contract before activation.")
    a.state = "Active"
    a.history = [...(a.history ?? []), { on: ctx.today, by: ctx.userId, text: "Activated" }]
  })
}
export function expireAgreement(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager"], "Ending an agreement")
    const a = agr(d, id)
    if ((a.state ?? "Active") !== "Active") throw new ProtoError("Only an Active agreement is ended.")
    a.state = "Expired"
    a.validTo = a.validTo < ctx.today ? a.validTo : ctx.today
    a.history = [...(a.history ?? []), { on: ctx.today, by: ctx.userId, text: "Ended early" }]
  })
}

// ===================================================================== hierarchy (Book I H §2)
const HIER_ROLES: Role[] = ["Controller"]
/** Effective-dated move of a cost center. Summary nodes only take children (V-CO-01); history is kept for comparative reporting. */
export function moveCostCenter(nodeId: string, toParent: string | undefined, effective: ISODate, reason: string) {
  return m((d, ctx) => {
    need(ctx, HIER_ROLES, "Hierarchy changes")
    const all = allCenters(d)
    const node = all.find((c) => c.id === nodeId)
    if (!node) throw new ProtoError("Cost center not found.")
    if (toParent === node.parentId && !d.hierarchyMoves.some((x) => x.nodeId === nodeId && x.effective > ctx.today)) throw new ProtoError("It already sits under that node.")
    if (toParent) {
      const p = all.find((c) => c.id === toParent)
      if (!p) throw new ProtoError("Target node not found.", "toParent")
      if (p.postable) throw new ProtoError(`${p.id} ${p.name} is postable: only a summary node can hold children (V-CO-01).`, "toParent")
      if (p.status === "Inactive") throw new ProtoError(`${p.id} is Inactive.`, "toParent")
      let cur: string | undefined = p.id
      while (cur) {
        if (cur === nodeId) throw new ProtoError("A node cannot move under itself or one of its own children.", "toParent")
        cur = all.find((c) => c.id === cur)?.parentId
      }
    }
    if (!effective) throw new ProtoError("Enter the effective date.", "effective")
    if (effective < `${OPEN_PERIOD}-01`) throw new ProtoError(`The effective date cannot be before the open period ${OPEN_PERIOD}: closed periods keep their reporting structure (reading OQ-PF-32).`, "effective")
    if (!reason.trim()) throw new ProtoError("A reason is required.", "reason")
    const id = `HM-2026-${String(d.hierarchyMoves.length + 1).padStart(3, "0")}`
    d.hierarchyMoves.push({ id, kind: "cost", nodeId, fromParent: node.parentId, toParent, effective, by: ctx.userId, on: ctx.today, reason: reason.trim() })
    if (effective <= ctx.today) {
      const o = (d.centerOverlay[nodeId] ??= { history: [] })
      o.parentId = toParent as CostCenterId | undefined
      o.history.push({ on: ctx.today, by: ctx.userId, text: `Moved under ${toParent ?? "no parent"} (${id}): ${reason.trim()}`, effective })
    }
    return { id, scheduled: effective > ctx.today }
  })
}
export function cancelScheduledMove(id: string) {
  return m((d, ctx) => {
    need(ctx, HIER_ROLES, "Hierarchy changes")
    const mv = d.hierarchyMoves.find((x) => x.id === id)
    if (!mv) throw new ProtoError("Move not found.")
    if (mv.effective <= ctx.today) throw new ProtoError("A move already in effect stays in the history: make a new move to reverse it.")
    d.hierarchyMoves = d.hierarchyMoves.filter((x) => x.id !== id)
  })
}
export function deactivateCostCenter(id: string, effective: ISODate, reason: string) {
  return m((d, ctx) => {
    need(ctx, HIER_ROLES, "Deactivating a cost center")
    const c = allCenters(d).find((x) => x.id === id)
    if (!c) throw new ProtoError("Cost center not found.")
    if (c.status === "Inactive") throw new ProtoError("Already Inactive.")
    const w = whereUsedCc(d, id)
    if (w.blocking > 0) throw new ProtoError(`Where-used check failed: ${[w.openWos.length && `${w.openWos.length} open production order(s)`, w.wcs.length && `${w.wcs.length} work center link(s)`, w.cycles.length && `${w.cycles.length} allocation cycle(s)`].filter(Boolean).join(", ")}. Re-link or close them first (reading OQ-PF-30).`)
    if (!reason.trim()) throw new ProtoError("A reason is required.", "reason")
    const o = (d.centerOverlay[id] ??= { history: [] })
    o.status = "Inactive"
    o.history.push({ on: ctx.today, by: ctx.userId, text: `Deactivated: ${reason.trim()}`, effective: effective || ctx.today })
  })
}
export function reparentCheck(d: D, nodeId: string, toParent: string | undefined, asOf: ISODate) {
  return parentAsOf(d, "cost", nodeId, toParent, asOf)
}

// ===================================================================== alternate hierarchies (reporting only, Phase 2)
const ALT_ROLES: Role[] = ["Controlling analyst", "Controller"]
const alt = (d: D, id: string) => {
  const a = d.altHierarchies.find((x) => x.id === id)
  if (!a) throw new ProtoError("Alternate hierarchy not found.")
  return a
}
export function createAlt(kind: "cost" | "profit", name: string, purpose: string) {
  return m((d, ctx) => {
    need(ctx, ALT_ROLES, "Defining an alternate hierarchy")
    if (!name.trim()) throw new ProtoError("Enter a name.", "name")
    if (d.altHierarchies.some((a) => a.kind === kind && a.name.toLowerCase() === name.trim().toLowerCase())) throw new ProtoError("An alternate hierarchy with this name exists.", "name")
    const id = `ALT-${kind === "cost" ? "CC" : "PC"}-${String(d.altHierarchies.filter((a) => a.kind === kind).length + 1).padStart(2, "0")}`
    d.altHierarchies.push({ id, kind, name: name.trim(), purpose: purpose.trim() || "Reporting only", groups: [], createdBy: ctx.userId, createdOn: ctx.today })
    return id
  })
}
export function addAltGroup(altId: string, name: string) {
  return m((d, ctx) => {
    need(ctx, ALT_ROLES, "Editing an alternate hierarchy")
    const a = alt(d, altId)
    if (!name.trim()) throw new ProtoError("Enter a group name.", "name")
    if (a.groups.some((g) => g.name.toLowerCase() === name.trim().toLowerCase())) throw new ProtoError("A group with this name exists.", "name")
    a.groups.push({ id: `g${Math.max(0, ...a.groups.map((g) => Number(g.id.slice(1)) || 0)) + 1}`, name: name.trim(), memberIds: [] })
  })
}
export function assignToAltGroup(altId: string, groupId: string, memberId: string) {
  return m((d, ctx) => {
    need(ctx, ALT_ROLES, "Editing an alternate hierarchy")
    const a = alt(d, altId)
    const g = a.groups.find((x) => x.id === groupId)
    if (!g) throw new ProtoError("Group not found.")
    const valid = a.kind === "cost" ? allCenters(d).some((c) => c.id === memberId && c.postable) : PROFIT_CENTERS.some((p) => p.id === memberId) || d.addedProfitCenters.some((p) => p.id === memberId)
    if (!valid) throw new ProtoError(a.kind === "cost" ? "Choose a postable cost center: summary nodes roll up from their members." : "Choose a profit center.", "memberId")
    for (const o of a.groups) o.memberIds = o.memberIds.filter((x) => x !== memberId)
    g.memberIds.push(memberId)
  })
}
export function removeFromAltGroup(altId: string, memberId: string) {
  return m((d, ctx) => {
    need(ctx, ALT_ROLES, "Editing an alternate hierarchy")
    for (const g of alt(d, altId).groups) g.memberIds = g.memberIds.filter((x) => x !== memberId)
  })
}
export function deleteAltGroup(altId: string, groupId: string) {
  return m((d, ctx) => {
    need(ctx, ALT_ROLES, "Editing an alternate hierarchy")
    const a = alt(d, altId)
    const g = a.groups.find((x) => x.id === groupId)
    if (g?.memberIds.length) throw new ProtoError("Move or remove the group's members first.")
    a.groups = a.groups.filter((x) => x.id !== groupId)
  })
}
export function deleteAlt(altId: string) {
  return m((d, ctx) => {
    need(ctx, ["Controller"], "Deleting an alternate hierarchy")
    alt(d, altId)
    d.altHierarchies = d.altHierarchies.filter((a) => a.id !== altId)
  })
}

// ===================================================================== statistical key figures (CO-SKF-001; Book I H §5)
export const SKF_FIELDS = ["headcount", "sqft", "machineHours", "laborHours", "revenueShare"] as const
export type SkfField = (typeof SKF_FIELDS)[number]
const SKF_ROLES: Role[] = ["Controlling analyst", "Controller"]
const skfCheck = (field: SkfField, v: number) => {
  if (!Number.isFinite(v) || v < 0) throw new ProtoError("Values are numbers from 0.", field)
  if ((field === "headcount" || field === "sqft") && !Number.isInteger(v)) throw new ProtoError(`${field === "sqft" ? "Square feet" : "Headcount"} is a whole number.`, field)
  if (field === "revenueShare" && v > 100) throw new ProtoError("Revenue share is a percentage up to 100.", field)
}
export function editSkfCell(cc: CostCenterId, period: string, field: SkfField, value: number) {
  return m((d, ctx) => {
    need(ctx, SKF_ROLES, "Statistical key figure maintenance")
    skfCheck(field, value)
    const row = d.skf.find((x) => x.costCenterId === cc && x.period === period)
    if (!row) throw new ProtoError(`No row for ${cc} in ${period}.`)
    if (row[field] === value) throw new ProtoError("The value is unchanged.")
    d.skfHistory.unshift({ id: `SKC-${String(d.skfHistory.length + 1).padStart(3, "0")}`, costCenterId: cc, period, field, old: row[field], new: value, by: ctx.userId, on: ctx.today, via: "Edit" })
    row[field] = value
  })
}
export function startQuarter(period: string) {
  return m((d, ctx) => {
    need(ctx, SKF_ROLES, "Statistical key figure maintenance")
    if (!/^\d{4}-Q[1-4]$/.test(period)) throw new ProtoError("A quarter looks like 2026-Q4.", "period")
    if (d.skf.some((r) => r.period === period)) throw new ProtoError(`${period} already exists.`, "period")
    const latest = [...new Set(d.skf.map((r) => r.period))].sort().pop()
    const src = d.skf.filter((r) => r.period === latest)
    for (const r of src) d.skf.push({ ...r, period })
    d.skfHistory.unshift({ id: `SKC-${String(d.skfHistory.length + 1).padStart(3, "0")}`, costCenterId: src[0].costCenterId, period, field: "all rows", old: 0, new: src.length, by: ctx.userId, on: ctx.today, via: "Edit" })
    return src.length
  })
}
export interface SkfImportRow {
  line: number
  costCenterId: string
  headcount: number
  sqft: number
  machineHours: number
  laborHours: number
  revenueShare: number
}
/** Import from a workbook (XLSX is read by the import service; the prototype takes the rows as pasted text). All rows apply or none do. */
export function importSkf(period: string, rows: SkfImportRow[]) {
  return m((d, ctx) => {
    need(ctx, SKF_ROLES, "Statistical key figure import")
    if (!rows.length) throw new ProtoError("The file has no data rows.")
    const errors: string[] = []
    for (const r of rows) {
      const cc = COST_CENTERS.find((c) => c.id === r.costCenterId)
      if (!cc) errors.push(`Row ${r.line}: ${r.costCenterId || "(empty)"} is not a cost center.`)
      else if (!cc.postable) errors.push(`Row ${r.line}: ${cc.id} is a summary node; key figures belong to postable centers.`)
      for (const f of SKF_FIELDS)
        try { skfCheck(f, r[f]) } catch (e) { errors.push(`Row ${r.line}: ${(e as Error).message} (${f})`) }
    }
    if (errors.length) throw new ProtoError(`${errors.length} row error(s), nothing imported. ${errors.slice(0, 3).join(" ")}`)
    const changes: SkfChange[] = []
    for (const r of rows) {
      let row = d.skf.find((x) => x.costCenterId === r.costCenterId && x.period === period)
      if (!row) {
        row = { costCenterId: r.costCenterId as CostCenterId, period, headcount: 0, sqft: 0, machineHours: 0, laborHours: 0, revenueShare: 0 } as SkfValue
        d.skf.push(row)
      }
      for (const f of SKF_FIELDS)
        if (row[f] !== r[f]) {
          changes.push({ id: `SKC-${String(d.skfHistory.length + changes.length + 1).padStart(3, "0")}`, costCenterId: row.costCenterId, period, field: f, old: row[f], new: r[f], by: ctx.userId, on: ctx.today, via: "Import" })
          row[f] = r[f]
        }
    }
    d.skfHistory.unshift(...changes.reverse())
    return { rows: rows.length, changes: changes.length }
  })
}

// ===================================================================== budgets (ACC 21 stand-in; Book I H §4)
export function saveBudget(cc: CostCenterId, fy: number, group: string, annual: number) {
  return m((d, ctx) => {
    const mgr = d.centerOverlay[cc]?.managerId
    if (ctx.role !== "Controller" && mgr !== ctx.userId) throw new ProtoError(`Budget entry for ${cc} is done by its manager${mgr ? "" : " (none named)"} or the Controller: you act as ${ctx.role} and are not the named manager (reading OQ-PF-34).`)
    if (!Number.isFinite(annual) || annual < 0) throw new ProtoError("Enter an annual amount from 0.", "annual")
    const c = allCenters(d).find((x) => x.id === cc)
    if (!c?.postable) throw new ProtoError("Budgets belong to postable cost centers.")
    const ex = d.budgets.find((b) => b.costCenterId === cc && b.fy === fy && b.group === group)
    if (ex?.status === "Approved" && ctx.role !== "Controller") throw new ProtoError("An approved budget line changes through the Controller.")
    if (ex) Object.assign(ex, { annual: Math.round(annual), by: ctx.userId, status: ctx.role === "Controller" ? "Approved" : "Draft" })
    else d.budgets.push({ costCenterId: cc, fy, group, annual: Math.round(annual), status: ctx.role === "Controller" ? "Approved" : "Draft", by: ctx.userId })
  })
}
export function approveBudget(cc: CostCenterId, fy: number) {
  return m((d, ctx) => {
    need(ctx, ["Controller"], "Budget approval")
    const lines = d.budgets.filter((b) => b.costCenterId === cc && b.fy === fy)
    if (!lines.length) throw new ProtoError("No budget lines to approve.")
    for (const l of lines) l.status = "Approved"
    return lines.length
  })
}
export type { ContractItem }

// ===================================================================== STP acknowledgement (Book IV §3.3; S-19)
/** Capture the vendor's acknowledgement of a package on the vendor's behalf (the portal does it in Book IX). A superseded package takes none (C-22). */
export function recordStpAck(stpId: string, vendorId: string, status: "Acknowledged" | "Exception" | "Rejected") {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Recording an STP acknowledgement")
    const t = d.stps.find((x) => x.id === stpId)
    if (!t) throw new ProtoError("STP not found.")
    if (t.superseded) throw new ProtoError(`${t.id} is superseded by ${t.supersededBy}: acknowledge the current version (C-22).`)
    if (!vendorOf(d, vendorId)) throw new ProtoError("Choose the vendor.", "vendorId")
    t.acknowledgements = [...t.acknowledgements.filter((a) => a.vendorId !== vendorId), { vendorId: vendorId as VendorId, status, on: ctx.today }]
    for (const p of d.purchaseOrders.filter((x) => x.vendorId === vendorId && x.lines.some((l) => l.stpId === stpId))) p.activity.push({ at: ctx.today, by: ctx.role, text: `STP ${stpId} acknowledgement recorded: ${status}` })
  })
}

// ===================================================================== subcontract PO variant (Book I G §6)
/** A subcontract PO: the line is a service item (the operation) and the PO carries the components provided to the vendor [DOC:p.106 §6]. */
export function createSubcontractPo(input: { vendorId: VendorId; serviceItemId: MaterialId; qty: number; price: number; needBy: ISODate; provided: { itemId: MaterialId; qty: number }[]; pegSo?: string }) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Creating a subcontract PO")
    const v = vendorOf(d, input.vendorId)
    if (!v) throw new ProtoError("Choose the subcontractor.", "vendorId")
    const el = vendorEligibility(v)
    if (!el.ok) throw new ProtoError(el.reason ?? "Vendor not eligible.", "vendorId")
    const svc = material(input.serviceItemId)
    if (!svc || svc.type !== "SERV") throw new ProtoError("The line is a service item: choose the operation (type SERV).", "serviceItemId")
    if (!(input.qty > 0)) throw new ProtoError("Enter the quantity.", "qty")
    if (!(input.price > 0)) throw new ProtoError("Enter the service price.", "price")
    if (!input.needBy || input.needBy <= ctx.today) throw new ProtoError("The need-by date must be after today.", "needBy")
    for (const x of input.provided) {
      if (!material(x.itemId)) throw new ProtoError("A provided component is not an item.", "provided")
      if (!(x.qty > 0)) throw new ProtoError(`Enter the quantity of ${x.itemId} provided.`, "provided")
    }
    const id = `PO-TBD-0${(d.seq += 1)}` as PoRec["id"]
    d.purchaseOrders.unshift({
      id, title: `Subcontract: ${svc.description.toLowerCase().replace("subcontract ", "")}`, status: "Draft", vendorId: input.vendorId, createdOn: ctx.today, createdBy: ctx.userId, buyerId: ctx.userId, changePending: false, entityId: "LE-TBD-10", currency: v.currency,
      activity: [{ at: ctx.today, by: ctx.role, text: "Subcontract PO created" }], type: "Subcontract", shipToWarehouseId: "WH-TBD-01", qualityClauses: [], buyAmerica: false, prIds: [],
      lines: [{ no: 10, itemId: input.serviceItemId, qty: input.qty, price: input.price, status: "Open", needBy: input.needBy, schedules: [{ no: 10, qty: input.qty, date: input.needBy }], received: 0, invoiced: 0, promiseHistory: [], peg: input.pegSo ? { type: "salesOrder", id: input.pegSo } : undefined }],
      revision: 0, revisions: [], expedite: [], provided: input.provided.map((x) => ({ ...x, issued: false })),
    })
    return id
  })
}

export function updateBreachJustification(id: string, text: string) {
  return m((d, ctx) => {
    need(ctx, ["Sales rep", "Sales admin", "Estimator", "Pricing Manager", "Sales Director"], "Editing a breach justification")
    const b = d.floorBreaches.find((x) => x.id === id)
    if (!b) throw new ProtoError("Breach not found.")
    if (b.status !== "Pending") throw new ProtoError("A decided breach keeps its justification.")
    if (!text.trim()) throw new ProtoError("Every approval stores a justification.", "justification")
    b.justification = text.trim()
  })
}

// ===================================================================== PO delivery schedule and quality clauses (Book I G §5.1, §5.2)
/** Delivery schedule sub-rows per line: date plus quantity, summing to the line quantity; each sub-row is receivable independently. After Sent an edit is a PO revision (§5.3). */
export function editSchedule(poId: string, lineNo: number, rows: { qty: number; date: ISODate }[]) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Editing the delivery schedule")
    const p = d.purchaseOrders.find((x) => x.id === poId)
    if (!p) throw new ProtoError(`PO ${poId} not found.`)
    const l = p.lines.find((x) => x.no === lineNo)
    if (!l) throw new ProtoError("Line not found.")
    if (["Matched/Closed", "Cancelled", "Received"].includes(p.status) || l.status === "Cancelled") throw new ProtoError(`A ${p.status} PO cannot be rescheduled.`)
    if (!rows.length) throw new ProtoError("A line needs at least one delivery.")
    for (const r of rows) {
      if (!(r.qty > 0)) throw new ProtoError("Every delivery needs a quantity above zero.", "qty")
      if (!r.date) throw new ProtoError("Every delivery needs a date.", "date")
    }
    const sum = rows.reduce((t, r) => t + r.qty, 0)
    if (Math.abs(sum - l.qty) > 1e-6) throw new ProtoError(`The deliveries add up to ${sum}, the line quantity is ${l.qty}: they must match.`, "qty")
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
    // receipts already booked fill the earliest deliveries first: the sub-rows they cover cannot shrink below what is received
    let left = l.received
    for (const r of sorted) {
      const got = Math.min(r.qty, left)
      left -= got
    }
    if (left > 0) throw new ProtoError(`${l.received} is already received: the schedule must still cover it.`, "qty")
    const next = sorted.map((r, i) => ({ no: (i + 1) * 10, qty: r.qty, date: r.date }))
    const before = l.schedules.map((x) => `${x.qty} on ${x.date}`).join("; ")
    const after = next.map((x) => `${x.qty} on ${x.date}`).join("; ")
    if (before === after) throw new ProtoError("Nothing changed.")
    l.schedules = next
    l.needBy = next[0].date
    if (p.status === "Draft") {
      p.activity.push({ at: ctx.today, by: ctx.role, text: `Line ${lineNo} delivery schedule set: ${after}` })
      return { revision: false }
    }
    p.revision += 1
    p.revisions.push({ rev: p.revision, on: ctx.today, by: ctx.userId, reapproval: false, changes: [{ field: `Line ${lineNo} delivery schedule`, old: before, new: after }] })
    p.changePending = true
    l.confirmedDate = undefined
    p.activity.push({ at: ctx.today, by: ctx.role, text: `Revision ${p.revision}: line ${lineNo} delivery schedule changed; vendor re-confirmation needed` })
    return { revision: true }
  })
}
export function setPoClauses(poId: string, clauses: ("Q1" | "Q2" | "Q3" | "Q4" | "Q5")[]) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager", "Quality Manager", "Quality engineer"], "Setting the quality clauses")
    const p = d.purchaseOrders.find((x) => x.id === poId)
    if (!p) throw new ProtoError(`PO ${poId} not found.`)
    if (p.status !== "Draft") throw new ProtoError(`Clauses are set on a Draft PO; a ${p.status} PO changes by revision.`)
    p.qualityClauses = clauses
    p.activity.push({ at: ctx.today, by: ctx.role, text: `Quality clauses: ${clauses.join(", ") || "none"}` })
  })
}
