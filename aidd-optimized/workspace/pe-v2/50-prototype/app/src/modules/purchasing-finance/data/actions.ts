// purchasing-finance actions. Every write goes through store.mutate (atomic: a ProtoError leaves the
// state untouched). Role gates appear only where the specification names the role (ASM-PERM-1):
// Book I G §7 role table (Buyer, Purchasing Manager, Quality, Controller, Receiving / AP), Book I H §6
// (Controlling analyst, Controller, CFO) and Book I I §7 (Cost accountant, Controller, Pricing Manager,
// Estimator). Approvals never happen here: they go through ApprovalButton to WF-INBOX (C-1).

import { ProtoError, store, type MutateCtx, type Result } from "@/store"
import type { BatchId, CostCenterId, ISODate, MaterialId, Role, SerialNo, VendorId, WorkCenterId } from "@/data/domain"
import { THRESHOLDS } from "@/data/domain"
import { COST_CENTERS, FISCAL_PERIODS, MATERIALS, PROFIT_CENTERS, TODAY, WORK_CENTERS } from "@/data/shared"
import { computeAllocation, type PurchasingFinanceState } from "./slice"
import { allAvl, designReleaseBlocker, noStandardException, isQiCritical, ladder, llrRunningExposure, material, poTotal, providedValue, qualifiedSourceBlocker, stdOf, subcontractStd, vendorEligibility, vendorOf } from "./logic"
import { ceTotals } from "./seed"
import { sourceListBlocker, zeroPriceBlocker } from "./xlogic"
import type { AddedCostCenter, AddedProfitCenter, AllocCycleRec, AllocRun, AllocSegment, CenterChangeKind, CenterDraft, CeRec, ContractTerm, ExpediteEntry, PoLineX, PoRec, PrRec, RfqRec, RunItem, RunRec, VarianceRow, WcRateRec } from "./types"

type D = PurchasingFinanceState
const m = <T>(fn: (d: D, ctx: MutateCtx) => T): Result<T> => store.mutate("purchasingFinance", fn)
const need = (ctx: MutateCtx, roles: Role[], what: string) => {
  if (!roles.includes(ctx.role)) throw new ProtoError(`${what} is done by ${roles.join(" or ")}. Switch "Acting as" to ${roles[0]}.`)
}
const po = (d: D, id: string) => {
  const p = d.purchaseOrders.find((x) => x.id === id)
  if (!p) throw new ProtoError(`Purchase order ${id} not found.`)
  return p
}
const log = (p: { activity: { at: string; by: string; text: string }[] }, ctx: MutateCtx, text: string) => p.activity.push({ at: ctx.today, by: ctx.role, text })
const periodOpen = (entityId: string) => FISCAL_PERIODS.find((f) => f.entityId === entityId && f.month === TODAY.slice(0, 7))?.status === "Open"
const r2 = (n: number) => Math.round(n * 100) / 100
const pcOf = (itemId?: string) => MATERIALS.find((x) => x.id === itemId)?.profitCenterId ?? "PC-900"
const newJe = (d: D) => `JE-TBD-${(d.seq += 1) + 50000}` as const

// ===================================================================== requisitions
export function createRequisition(input: { title: string; origin: PrRec["origin"]; itemId: MaterialId; qty: number; needBy: ISODate; estPrice: number; costCenterId?: CostCenterId }) {
  return m((d, ctx) => {
    if (!input.title.trim()) throw new ProtoError("Enter a title.", "title")
    const mat = material(input.itemId)
    if (!mat) throw new ProtoError("Choose an item.", "itemId")
    if (mat.blocks.some((b) => b.block === "Purchasing Block")) throw new ProtoError(`${mat.id} carries a Purchasing Block (C-49): it cannot be requisitioned.`, "itemId")
    if (!(input.qty > 0)) throw new ProtoError("Quantity must be above zero.", "qty")
    if ((input.origin === "Expense" || mat.type === "NSTK" || mat.type === "SERV") && !input.costCenterId)
      throw new ProtoError("Cost center is mandatory for expense and MRO purchases (Book I G §3).", "costCenterId")
    const cc = COST_CENTERS.find((c) => c.id === input.costCenterId)
    if (cc && !cc.postable) throw new ProtoError(`${cc.id} ${cc.name} is a summary node and not postable (V-CO-01).`, "costCenterId")
    const ov = input.costCenterId ? d.centerOverlay[input.costCenterId]?.status : undefined
    if (ov === "Blocked" || cc?.status === "Blocked") throw new ProtoError(`${input.costCenterId} is Blocked for posting.`, "costCenterId")
    const id = `PR-TBD-0${(d.seq += 1)}` as PrRec["id"]
    const qi = isQiCritical(input.itemId)
    const avl = allAvl(d).filter((a) => a.itemId === input.itemId && (qi ? a.status === "Qualified" : a.status !== "Suspended")).sort((a, b) => a.rank - b.rank)[0]
    const pr: PrRec = {
      id, title: input.title.trim(), status: "Open", origin: input.origin, createdOn: ctx.today, createdBy: ctx.userId, entityId: "LE-TBD-10", requesterId: ctx.userId, buyerId: "USR-TBD-039",
      activity: [{ at: ctx.today, by: ctx.role, text: `Created (${input.origin})` }], poIds: [], costCenterId: input.costCenterId,
      budgetRemaining: input.costCenterId ? 25000 : undefined, suggestedVendorId: avl?.vendorId,
      lines: [{ no: 10, itemId: input.itemId, qty: input.qty, needBy: input.needBy, estPrice: input.estPrice }],
    }
    d.requisitions.unshift(pr)
    return id
  })
}
export function cancelRequisition(id: string, reason: string) {
  return m((d, ctx) => {
    const r = d.requisitions.find((x) => x.id === id)
    if (!r) throw new ProtoError("Requisition not found.")
    if (!["Open", "In Approval", "Approved"].includes(r.status)) throw new ProtoError(`A ${r.status} requisition cannot be cancelled.`)
    if (r.poIds.some((p) => d.purchaseOrders.find((x) => x.id === p && x.status !== "Cancelled"))) throw new ProtoError(`${r.id} already feeds a purchase order; cancel the PO first.`)
    r.status = "Cancelled"
    log(r, ctx, `Cancelled: ${reason}`)
  })
}
/** Start an RFQ from requisitions (policy: new items, expiring agreements, > $25k uncontracted). */
export function startRfq(prIds: string[]) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Starting an RFQ")
    const prs = d.requisitions.filter((r) => prIds.includes(r.id))
    if (!prs.length) throw new ProtoError("Select at least one requisition.")
    const bad = prs.find((r) => r.status !== "Approved" && r.status !== "Open")
    if (bad) throw new ProtoError(`${bad.id} is ${bad.status}; only Open or Approved requisitions can be sourced.`)
    const lines = prs.flatMap((r) => r.lines)
    const vendorIds = [...new Set(allAvl(d).filter((a) => lines.some((l) => l.itemId === a.itemId) && a.status !== "Suspended").map((a) => a.vendorId))]
    const stp = d.stps.find((t) => !t.superseded && lines.some((l) => l.itemId === t.itemId))
    const id = `RFQ-TBD-0${(d.seq += 1)}` as RfqRec["id"]
    d.rfqs.unshift({
      id, title: `RFQ: ${prs.map((r) => r.title).join("; ")}`, status: "Draft", sealed: true, dueOn: addBiz(ctx.today, 10), vendorIds, createdOn: ctx.today, createdBy: ctx.userId, buyerId: ctx.userId,
      lines: lines.map((l, i) => ({ no: (i + 1) * 10, itemId: l.itemId, qty: l.qty, stpId: stp?.itemId === l.itemId ? stp.id : undefined })),
      activity: [{ at: ctx.today, by: ctx.role, text: `Created from ${prIds.join(", ")}` }], prIds: prs.map((r) => r.id), technicalReviewed: false, poIds: [],
    })
    for (const r of prs) {
      r.rfqId = id
      log(r, ctx, `RFQ ${id} started`)
    }
    return id
  })
}
const addBiz = (iso: string, n: number) => {
  const dt = new Date(iso + "T12:00:00Z")
  while (n > 0) {
    dt.setUTCDate(dt.getUTCDate() + 1)
    if (dt.getUTCDay() % 6 !== 0) n--
  }
  return dt.toISOString().slice(0, 10)
}

/** Group approved requisition lines into Draft POs, one per vendor (Book I G §1.4). */
export function groupIntoPos(prIds: string[], vendorFor: Record<string, VendorId | undefined> = {}, overrideReasons: Record<string, string> = {}) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Grouping requisitions into POs")
    const prs = d.requisitions.filter((r) => prIds.includes(r.id))
    if (!prs.length) throw new ProtoError("Select at least one requisition.")
    const groups = new Map<string, { vendorId: VendorId; prs: PrRec[] }>()
    for (const r of prs) {
      if (r.status !== "Approved") throw new ProtoError(`${r.id} is ${r.status}; only Approved requisitions group into POs.`)
      if (r.poIds.length) throw new ProtoError(`${r.id} already feeds ${r.poIds.join(", ")}.`)
      const vid = vendorFor[r.id] ?? r.suggestedVendorId
      const qi = r.lines.some((l) => qualifiedSourceBlocker(d, "", l.itemId) !== null)
      if (!vid) {
        if (qi) throw new ProtoError(`${r.id} has no source: ${r.lines[0]?.itemId} is QI-critical and has no Qualified AVL vendor (E-PUR-02). Start AVL qualification or an RFQ.`)
        throw new ProtoError(`${r.id} has no valid source of supply (EX-09). Choose a vendor or start an RFQ.`)
      }
      const v = vendorOf(d, vid)
      const el = vendorEligibility(v)
      if (!el.ok) throw new ProtoError(`${r.id}: ${el.reason}`)
      for (const l of r.lines) {
        const blk = qualifiedSourceBlocker(d, vid, l.itemId)
        if (blk) throw new ProtoError(`${r.id}: ${blk}`)
      }
      if (r.suggestedVendorId && vid !== r.suggestedVendorId) {
        const why = overrideReasons[r.id]?.trim()
        if (!why) throw new ProtoError(`${r.id}: the proposed source is ${r.suggestedVendorId}; give a reason to override it (Book I G §1.2).`, "overrideReason")
        log(r, ctx, `Source override ${r.suggestedVendorId} to ${vid}: ${why}`)
      }
      const value = r.lines.reduce((t, l) => t + l.qty * l.estPrice, 0)
      const avl = allAvl(d).find((a) => a.vendorId === vid && r.lines.some((l) => l.itemId === a.itemId))
      const contracted = !!avl && /info record|contract|award/i.test(avl.priceBasis)
      const awarded = r.rfqId && d.rfqs.find((q) => q.id === r.rfqId)?.status === "Awarded"
      if (value > THRESHOLDS.rfqRequiredAbove && !contracted && !awarded)
        throw new ProtoError(`${r.id} is ${value.toLocaleString("en-US", { style: "currency", currency: "USD" })} without a contract or info-record basis: policy routes it through an RFQ (above $25,000, Book I G §1.3).`)
      const g = groups.get(vid) ?? { vendorId: vid, prs: [] }
      g.prs.push(r)
      groups.set(vid, g)
    }
    const created: string[] = []
    for (const g of groups.values()) {
      const id = `PO-TBD-0${(d.seq += 1)}` as PoRec["id"]
      const v = vendorOf(d, g.vendorId)!
      const lines: PoLineX[] = g.prs.flatMap((r) => r.lines).map((l, i) => {
        const avl = allAvl(d).find((a) => a.vendorId === g.vendorId && a.itemId === l.itemId)
        return { no: (i + 1) * 10, itemId: l.itemId, qty: l.qty, price: l.estPrice, status: "Open", needBy: l.needBy, schedules: [{ no: 10, qty: l.qty, date: l.needBy }], received: 0, invoiced: 0, promiseHistory: [], peg: l.peg, stpId: d.stps.find((t) => !t.superseded && t.itemId === l.itemId)?.id, ...(avl ? {} : {}) }
      })
      d.purchaseOrders.unshift({
        id, title: `${v.name}: ${lines.map((l) => material(l.itemId)?.description.split(",")[0]).join(", ")}`, status: "Draft", vendorId: g.vendorId, createdOn: ctx.today, createdBy: ctx.userId,
        buyerId: ctx.userId, changePending: false, entityId: "LE-TBD-10", currency: v.currency, activity: [{ at: ctx.today, by: ctx.role, text: `Created from ${g.prs.map((r) => r.id).join(", ")}` }],
        type: "Standard", shipToWarehouseId: "WH-TBD-01", qualityClauses: lines.some((l) => material(l.itemId)?.batchFlag) ? ["Q1"] : [], buyAmerica: false, prIds: g.prs.map((r) => r.id),
        lines, revision: 0, revisions: [], expedite: [],
        restrictedOverride: undefined,
      })
      for (const r of g.prs) {
        r.poIds.push(id)
        log(r, ctx, `Grouped into ${id} (stays Approved until the PO is approved)`)
      }
      created.push(id)
    }
    return created
  })
}

// ===================================================================== RFQs (Book I G §4; FL-10 stage 8)
const rfqOf = (d: D, id: string) => {
  const q = d.rfqs.find((x) => x.id === id)
  if (!q) throw new ProtoError(`RFQ ${id} not found.`)
  return q
}
export function setRfqVendors(id: string, vendorIds: VendorId[], sealed: boolean, dueOn: ISODate) {
  return m((d) => {
    const q = rfqOf(d, id)
    if (q.status !== "Draft") throw new ProtoError("Vendors and the Sealed toggle can change only while the RFQ is Draft.")
    q.vendorIds = vendorIds
    q.sealed = sealed
    q.dueOn = dueOn
  })
}
export function issueRfq(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Issuing an RFQ")
    const q = rfqOf(d, id)
    if (q.status !== "Draft") throw new ProtoError(`RFQ is ${q.status}; only a Draft is issued.`)
    if (q.vendorIds.length < 1) throw new ProtoError("Invite at least one vendor.")
    if (q.dueOn <= ctx.today) throw new ProtoError("The due date must be after today.")
    for (const l of q.lines) {
      const t = l.stpId ? d.stps.find((x) => x.id === l.stpId) : undefined
      if (t?.superseded) throw new ProtoError(`${t.id} is superseded and cannot attach to a new document (E-DTS-03, C-22). Attach ${t.supersededBy}.`)
    }
    q.status = "Issued"
    for (const v of q.vendorIds) if (!d.rfqResponses.some((r) => r.rfqId === q.id && r.vendorId === v))
      d.rfqResponses.push({ rfqId: q.id, vendorId: v, prices: q.lines.map((l) => ({ line: l.no, price: 0, leadDays: 0 })), received: false, freightPct: 0, dutyPct: 0, validUntil: q.dueOn, buyAmerica: false })
    log(q, ctx, `Issued to ${q.vendorIds.length} vendors with STP attachments; responses due ${q.dueOn}`)
  })
}
export function recordResponse(id: string, vendorId: string, input: { price: number; leadDays: number; freightPct: number; dutyPct: number; validUntil: ISODate; buyAmerica: boolean }) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Keying a vendor response")
    const q = rfqOf(d, id)
    if (q.status !== "Issued" && q.status !== "Responses In") throw new ProtoError(`Responses are keyed only while the RFQ is Issued (now ${q.status}).`)
    if (!(input.price > 0)) throw new ProtoError("Enter the quoted unit price.", "price")
    const r = d.rfqResponses.find((x) => x.rfqId === id && x.vendorId === vendorId)
    if (!r) throw new ProtoError("Vendor was not invited.")
    Object.assign(r, { prices: q.lines.map((l) => ({ line: l.no, price: input.price, leadDays: input.leadDays })), received: true, receivedOn: ctx.today, freightPct: input.freightPct, dutyPct: input.dutyPct, validUntil: input.validUntil, buyAmerica: input.buyAmerica })
    log(q, ctx, `Response keyed for ${vendorId}`)
    if (!d.bidVersions.some((b) => b.rfqId === id && b.vendorId === vendorId)) {
      d.bidVersions.push({ rfqId: id, vendorId: vendorId as VendorId, version: 1, receivedOn: ctx.today, price: input.price, leadDays: input.leadDays, freightPct: input.freightPct, dutyPct: input.dutyPct, validUntil: input.validUntil, buyAmerica: input.buyAmerica, note: "Original bid", deviations: [] })
      const sc = (d.rfqScoring[id] ??= { weights: { landed: 50, lead: 20, quality: 20, buyAmerica: 10 }, selected: {} })
      sc.selected[vendorId] = 1
    }
    if (d.rfqResponses.filter((x) => x.rfqId === id).every((x) => x.received)) {
      q.status = "Responses In"
      log(q, ctx, "All responses in")
    }
  })
}
export function closeResponses(id: string) {
  return m((d, ctx) => {
    const q = rfqOf(d, id)
    if (q.status !== "Issued") throw new ProtoError("Only an Issued RFQ closes for responses.")
    if (!d.rfqResponses.some((x) => x.rfqId === id && x.received)) throw new ProtoError("No response received yet.")
    if (ctx.today < q.dueOn) throw new ProtoError(`Responses close at the due date ${q.dueOn}.`)
    q.status = "Responses In"
    log(q, ctx, "Closed for responses at due date")
  })
}
export function technicalReview(id: string, vendorId: string, pass: boolean, note: string) {
  return m((d, ctx) => {
    need(ctx, ["Engineer", "Engineering Manager"], "Technical pass or fail")
    const q = rfqOf(d, id)
    if (q.status !== "Responses In" && q.status !== "Issued") throw new ProtoError(`Technical review happens before award (RFQ is ${q.status}).`)
    const r = d.rfqResponses.find((x) => x.rfqId === id && x.vendorId === vendorId)
    if (!r?.received) throw new ProtoError("No response from this vendor.")
    r.technicalPass = pass
    r.technicalNote = note || (pass ? "Meets the STP" : "Does not meet the STP")
    if (d.rfqResponses.filter((x) => x.rfqId === id && x.received).every((x) => x.technicalPass != null)) {
      q.technicalReviewed = true
      log(q, ctx, "Technical review complete: commercial bids may open")
    }
  })
}
export function awardRfq(id: string, vendorId: VendorId, justification: string) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Award")
    const q = rfqOf(d, id)
    if (q.status !== "Responses In") throw new ProtoError(`Award needs Responses In (RFQ is ${q.status}).`)
    if (!q.technicalReviewed) throw new ProtoError("Engineering's technical pass or fail is recorded before commercial bids open (FL-10 stage 8).")
    const rs = d.rfqResponses.filter((x) => x.rfqId === id && x.received && x.technicalPass)
    const win = rs.find((x) => x.vendorId === vendorId)
    if (!win) throw new ProtoError("Award only to a vendor with a received response and a technical pass.")
    const landed = (x: typeof win) => x.prices[0].price * (1 + (x.freightPct + x.dutyPct) / 100)
    const lowest = rs.reduce((a, b) => (landed(b) < landed(a) ? b : a))
    if (lowest.vendorId !== vendorId && !justification.trim()) throw new ProtoError("Not the lowest landed cost: enter a justification note (Book I G §4).", "justification")
    const v = vendorOf(d, vendorId)
    const el = vendorEligibility(v)
    if (!el.ok) throw new ProtoError(`Award writes a PO: ${el.reason}`)
    q.status = "Awarded"
    q.awardedVendorId = vendorId
    q.awardNote = justification || "Lowest landed cost"
    // Award writes the AVL price basis (info record): an existing row or a new Conditional row
    for (const l of q.lines) {
      const row = allAvl(d).find((a) => a.itemId === l.itemId && a.vendorId === vendorId)
      const price = win.prices.find((p) => p.line === l.no) ?? win.prices[0]
      for (const old of d.infoRecords.filter((r) => r.itemId === l.itemId && r.vendorId === vendorId && r.status === "Active")) {
        old.status = "Expired"
        old.validTo = ctx.today
      }
      d.infoRecords.push({ id: `IR-00${4300 + (d.seq += 1)}`, itemId: l.itemId, vendorId, price: price.price, unit: material(l.itemId)?.baseUom ?? "EA", currency: v!.currency, validFrom: ctx.today, scales: [], source: "RFQ Award", leadDays: price.leadDays, status: "Active", ref: q.id })
      if (row) d.avlOverlay[row.id] = { ...d.avlOverlay[row.id], priceBasis: `Award ${q.id}: ${price.price} / ${price.leadDays} days`, leadDays: price.leadDays }
      else d.avlAdded.push({ id: `AVL-TBD-0${(d.seq += 1)}`, itemId: l.itemId, vendorId, rank: 9, status: "Conditional", priceBasis: `Award ${q.id}: ${price.price} / ${price.leadDays} days` })
    }
    const poId = `PO-TBD-0${(d.seq += 1)}` as PoRec["id"]
    const prs = d.requisitions.filter((r) => q.prIds.includes(r.id))
    d.purchaseOrders.unshift({
      id: poId, title: `${v!.name}: award of ${q.id}`, status: "Draft", vendorId, createdOn: ctx.today, createdBy: ctx.userId, buyerId: ctx.userId, changePending: false, entityId: "LE-TBD-10", currency: v!.currency,
      activity: [{ at: ctx.today, by: ctx.role, text: `Created on award of ${q.id}` }], type: "Standard", shipToWarehouseId: "WH-TBD-01", qualityClauses: ["Q1", "Q4"], buyAmerica: win.buyAmerica, prIds: q.prIds, rfqId: q.id,
      lines: q.lines.map((l) => {
        const p = win.prices.find((x) => x.line === l.no) ?? win.prices[0]
        const need = prs.flatMap((r) => r.lines).find((x) => x.itemId === l.itemId)?.needBy ?? ctx.today
        return { no: l.no, itemId: l.itemId, qty: l.qty, price: p.price, status: "Open", needBy: need, schedules: [{ no: 10, qty: l.qty, date: need }], received: 0, invoiced: 0, promiseHistory: [], stpId: l.stpId, peg: prs.flatMap((r) => r.lines).find((x) => x.itemId === l.itemId)?.peg }
      }),
      revision: 0, revisions: [], expedite: [], llrId: d.llrs.find((x) => x.state !== "Closed" && q.lines.some((l) => x.itemIds.includes(l.itemId)) && prs.some((r) => r.lines.some((pl) => pl.peg?.id === x.soId)))?.id,
    })
    q.poIds.push(poId)
    for (const r of prs) {
      r.poIds.push(poId)
      log(r, ctx, `${q.id} awarded; ${poId} created`)
    }
    log(q, ctx, `Awarded to ${vendorId}; regret notices to ${q.vendorIds.filter((x) => x !== vendorId).join(", ")}; ${poId} created`)
    return poId
  })
}
export function cancelRfq(id: string, reason: string) {
  return m((d, ctx) => {
    const q = rfqOf(d, id)
    if (q.status === "Awarded" || q.status === "Cancelled") throw new ProtoError(`A ${q.status} RFQ cannot be cancelled.`)
    q.status = "Cancelled"
    q.cancelReason = reason
    log(q, ctx, `Cancelled: ${reason}`)
  })
}

// ===================================================================== purchase orders (Book I G §5)
/** Checks shared by "send for approval" and "send" (C-31, C-32, E-DTS-02, E-DTS-03). Returns a reason or null. */
export function poBlocker(d: D, p: PoRec): string | null {
  const el = vendorEligibility(vendorOf(d, p.vendorId))
  if (!el.ok) return el.reason ?? "Vendor not eligible."
  if (el.needsOverride && !p.restrictedOverride) return el.reason ?? null
  for (const l of p.lines) {
    const t = l.stpId ? d.stps.find((x) => x.id === l.stpId) : undefined
    if (t?.superseded && p.status === "Draft") return `Line ${l.no}: ${t.id} is superseded (E-DTS-03, C-22). Attach ${t.supersededBy}.`
    const mt = material(l.itemId)
    if (mt?.blocks.some((b) => b.block === "Purchasing Block")) return `Line ${l.no}: ${mt.id} carries a Purchasing Block (C-49).`
    if (p.status === "Draft" || p.status === "Approved") {
      const q = qualifiedSourceBlocker(d, p.vendorId, l.itemId)
      if (q) return `Line ${l.no}: ${q}`
    }
  }
  const sl = sourceListBlocker(d, p)
  if (sl) return sl
  const zero = zeroPriceBlocker(p)
  if (zero) return zero
  const dts = designReleaseBlocker(p)
  if (dts) return dts
  if (p.llrId) {
    const llr = d.llrs.find((x) => x.id === p.llrId)
    if (llr && llr.state === "Closed") return `${llr.id} is closed; no further POs under it.`
    if (llr) {
      const exposure = llrRunningExposure(d, llr)
      if (exposure > llr.valueCap.amount) return `LLR cap breached: running exposure ${exposure.toLocaleString("en-US")} above cap ${llr.valueCap.amount.toLocaleString("en-US")} (E-DTS-02).`
    }
  }
  return null
}
export function sendPo(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Sending a PO")
    const p = po(d, id)
    if (p.status !== "Approved") throw new ProtoError(`Only an Approved PO is sent (this one is ${p.status}).`)
    const b = poBlocker(d, p)
    if (b) throw new ProtoError(b)
    if (p.llrId) {
      const llr = d.llrs.find((x) => x.id === p.llrId)
      if (llr && llr.state !== "Approved") throw new ProtoError(`${llr.id} is ${llr.state}: a PO under a long-lead release is sent only once the release is approved (reading OQ-PF-3).`)
    }
    if (p.type === "Intercompany" && p.ic && !periodOpen(p.ic.sellerEntityId)) throw new ProtoError("Both entities' periods must be open for an intercompany pair (FL-07 trigger).")
    p.status = "Sent"
    p.sentOn = ctx.today
    log(p, ctx, `Sent to vendor as PDF (IF-01)${p.llrId ? `; lines flagged Long-Lead: Preliminary Revision under ${p.llrId}` : ""}`)
    ctx.emit("purchasing.poReleased", { poId: p.id, vendorId: p.vendorId })
    ctx.emit("trace.eventRecorded", { code: "T01", doc: { type: "purchaseOrder", id: p.id } })
  })
}
export function confirmPo(id: string, dates: Record<number, ISODate>, stpAck: "Acknowledged" | "Exception" | "Rejected" | undefined) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Capturing vendor confirmation")
    const p = po(d, id)
    if (p.status !== "Sent" && !(p.changePending && (p.status === "Confirmed" || p.status === "Partially Received"))) throw new ProtoError(`Confirmation is captured on a Sent PO or a revision (this one is ${p.status}).`)
    for (const l of p.lines) if (l.status !== "Cancelled") {
      const dt = dates[l.no]
      if (!dt) throw new ProtoError(`Enter the confirmed date for line ${l.no}.`)
      l.confirmedDate = dt
      l.promiseHistory.push({ on: ctx.today, date: dt, by: ctx.userId })
      if (l.stpId) {
        if (!stpAck) throw new ProtoError(`Line ${l.no} carries ${l.stpId}: record the vendor's STP acknowledgement.`)
        const t = d.stps.find((x) => x.id === l.stpId)
        if (t) t.acknowledgements = [...t.acknowledgements.filter((a) => a.vendorId !== p.vendorId), { vendorId: p.vendorId, status: stpAck, on: ctx.today }]
      }
    }
    if (p.status === "Sent") p.status = "Confirmed"
    p.confirmedOn = ctx.today
    p.changePending = false
    log(p, ctx, `Vendor confirmation captured (IF-02)${stpAck ? `; STP ${stpAck}` : ""}`)
  })
}
export function overrideRestricted(id: string, reason: string) {
  return m((d, ctx) => {
    need(ctx, ["Purchasing Manager"], "Restricted-vendor override")
    const p = po(d, id)
    const v = vendorOf(d, p.vendorId)
    if (v?.quality !== "Restricted") throw new ProtoError("The vendor is not Restricted; no override needed.")
    p.restrictedOverride = { by: ctx.userId, on: ctx.today, reason }
    log(p, ctx, `Restricted-vendor override: ${reason}`)
  })
}
/** PO change order (Book I G §5.3): an edit after Sent creates a revision with a change summary;
 *  re-approval when value increases beyond threshold; confirmation resets on changed lines. */
export function revisePo(id: string, changes: { line: number; qty?: number; price?: number; date?: ISODate }[]) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Revising a PO")
    const p = po(d, id)
    if (["Matched/Closed", "Cancelled", "Received"].includes(p.status)) throw new ProtoError(`A ${p.status} PO cannot be revised.`)
    const before = poTotal(p)
    const summary: { field: string; old: string; new: string }[] = []
    for (const c of changes) {
      const l = p.lines.find((x) => x.no === c.line)
      if (!l) continue
      if (c.qty != null && c.qty !== l.qty) {
        if (c.qty < l.received) throw new ProtoError(`Line ${l.no}: quantity cannot drop below the ${l.received} already received.`)
        summary.push({ field: `Line ${l.no} quantity`, old: String(l.qty), new: String(c.qty) })
        l.qty = c.qty
        l.schedules = [{ no: 10, qty: c.qty, date: l.schedules[0]?.date ?? l.needBy }]
      }
      if (c.price != null && c.price !== l.price) {
        summary.push({ field: `Line ${l.no} unit price`, old: String(l.price), new: String(c.price) })
        l.price = c.price
      }
      if (c.date && c.date !== l.needBy) {
        summary.push({ field: `Line ${l.no} delivery date`, old: l.needBy, new: c.date })
        l.needBy = c.date
        l.schedules = l.schedules.map((s, i) => (i === 0 ? { ...s, date: c.date! } : s))
      }
      if (summary.some((s) => s.field.startsWith(`Line ${l.no}`))) l.confirmedDate = undefined
    }
    if (!summary.length) throw new ProtoError("Nothing changed.")
    if (p.status === "Draft") {
      log(p, ctx, `Edited before send: ${summary.map((s) => s.field).join(", ")}`)
      return { reapproval: false }
    }
    const after = poTotal(p)
    const reapproval = after > before * (1 + THRESHOLDS.poPriceDeviationPct / 100) || ladder(after).steps.length > ladder(before).steps.length
    p.revision += 1
    p.revisions.push({ rev: p.revision, on: ctx.today, by: ctx.userId, changes: summary, reapproval })
    p.changePending = true
    log(p, ctx, `Revision ${p.revision}: ${summary.length} change(s)${reapproval ? "; re-approval needed (value increase beyond threshold)" : "; vendor re-confirmation needed"}`)
    if (reapproval)
      queueMicrotask(() => store.raiseApproval({ kind: "PO approval", subject: { type: "purchaseOrder", id: p.id }, title: `${p.id} revision ${p.revision}: value ${before} to ${after}`, amount: after, currency: p.currency }))
    return { reapproval }
  })
}
export function cancelPo(id: string, reason: string) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Cancelling a PO")
    const p = po(d, id)
    if (p.lines.some((l) => l.received > 0)) throw new ProtoError("Goods are already received: short-close the PO instead (Purchasing Manager).")
    if (["Matched/Closed", "Cancelled", "Received"].includes(p.status)) throw new ProtoError(`A ${p.status} PO cannot be cancelled.`)
    if (!reason.trim()) throw new ProtoError("A reason is required.")
    const afterConfirm = p.lines.some((l) => l.confirmedDate && l.confirmedDate <= TODAY)
    p.status = "Cancelled"
    p.cancelReason = reason
    p.changePending = false
    for (const l of p.lines) l.status = "Cancelled"
    log(p, ctx, `Cancelled: ${reason}${afterConfirm ? " (after confirmed date: cancellation exposure noted for AP)" : ""}`)
  })
}
export function shortClose(id: string, reason: string) {
  return m((d, ctx) => {
    need(ctx, ["Purchasing Manager"], "Short-close")
    const p = po(d, id)
    if (p.status !== "Partially Received") throw new ProtoError("Short-close applies to a Partially Received PO.")
    for (const l of p.lines) if (l.status === "Partial" || l.status === "Open") {
      l.qty = l.received
      l.status = l.received > 0 ? "Received" : "Cancelled"
    }
    p.status = "Received"
    p.shortCloseReason = reason
    log(p, ctx, `Short-closed: ${reason}`)
  })
}

/** Goods receipt against the PO (INV 5.1, SP-01..SP-03). Posts DR 13xx / CR 2110 GR/IR with PPV to 5210. */
export function postGrn(id: string, input: { line: number; qty: number; batch?: BatchId; serials: SerialNo[] }) {
  return m((d, ctx) => {
    need(ctx, ["Receiving clerk", "Warehouse operator"], "Posting a goods receipt")
    const p = po(d, id)
    if (!["Sent", "Confirmed", "Partially Received"].includes(p.status)) throw new ProtoError(`Receipt needs a Sent, Confirmed or Partially Received PO (this one is ${p.status}).`)
    const l = p.lines.find((x) => x.no === input.line)
    if (!l || l.status === "Cancelled" || l.status === "Closed") throw new ProtoError("Choose an open PO line.", "line")
    if (l.stpId) {
      const t = d.stps.find((x) => x.id === l.stpId)
      const ack = t?.acknowledgements.find((a) => a.vendorId === p.vendorId)
      if (!ack || ack.status !== "Acknowledged") throw new ProtoError(`E-DTS-04: the vendor never acknowledged ${l.stpId}${ack ? ` (state ${ack.status})` : ""}. Receipt is hard-blocked (C-23).`)
    }
    if (!(input.qty > 0)) throw new ProtoError("Quantity must be above zero.", "qty")
    if (l.received + input.qty > l.qty) throw new ProtoError(`E-MM-11: over-receipt. Open quantity is ${l.qty - l.received}; tolerance 0% (design value).`, "qty")
    const mt = material(l.itemId)
    if (mt?.serialProfileId && input.serials.length !== input.qty) throw new ProtoError(`Scan ${input.qty} serial(s) at SP-03; ${input.serials.length} captured.`)
    if (mt?.batchFlag && !input.batch) throw new ProtoError("Print and scan back the batch label at SP-02.")
    const gid = `GRN-TBD-0${(d.seq += 1)}` as `GRN-${string}`
    const s = stdOf(d, l.itemId) ?? l.price
    if (stdOf(d, l.itemId) == null) noStandardException(d, l.itemId, { type: "grn", id: gid }, ctx.today)
    d.grns.unshift({ id: gid, poId: p.id, on: ctx.today, batches: input.batch ? [input.batch] : [], serials: input.serials, postedBy: ctx.userId, lines: [{ poLine: l.no, itemId: l.itemId, qty: input.qty, price: l.price, std: s }] })
    l.received += input.qty
    l.status = l.received >= l.qty ? "Received" : "Partial"
    const open = p.lines.filter((x) => x.status !== "Cancelled")
    p.status = open.every((x) => x.status === "Received" || x.status === "Closed") ? "Received" : "Partially Received"
    const value = r2(input.qty * l.price)
    const ppv = r2((l.price - s) * input.qty)
    if (p.type !== "Subcontract" && Math.abs(ppv) >= 0.01)
      d.variances.push(varRow(d, "PPV", ppv, s * input.qty, input.qty, { type: "grn", id: gid }, "CC-2000", pcOf(l.itemId), { itemId: l.itemId, vendorId: p.vendorId }))
    // SPV = (subcontract price - standard subcontract cost) x qty; at receipt the PO price stands in for the
    // invoice, and the invoice adds its own delta at match (reading OQ-PF-20).
    const subStd = p.type === "Subcontract" ? subcontractStd(d, p, l) : 0
    if (p.type === "Subcontract") {
      const spv = r2((l.price - subStd) * input.qty)
      if (Math.abs(spv) >= 0.01) d.variances.push(varRow(d, "SPV", spv, subStd * input.qty, input.qty, { type: "grn", id: gid }, "CC-1150", "PC-200", { itemId: l.itemId, vendorId: p.vendorId }))
    }
    log(p, ctx, `${gid} posted: ${input.qty} ${mt?.baseUom ?? ""} on line ${l.no}${input.batch ? `, batch ${input.batch}` : ""}${input.serials.length ? `, ${input.serials.length} serial(s)` : ""}; stock to QI Hold`)
    ctx.emit("purchasing.grnPosted", { grnId: gid, poId: p.id, batches: input.batch ? [input.batch] : [], serials: input.serials })
    ctx.emit("posting.posted", p.type === "Subcontract" ? { template: 35, amount: r2(value + providedValue(d, p, l, input.qty)), currency: p.currency, source: { type: "grn", id: gid } } : { template: "grn", amount: value, currency: p.currency, source: { type: "grn", id: gid } })
    if (input.batch) ctx.emit("trace.eventRecorded", { code: "T02", doc: { type: "grn", id: gid }, batch: input.batch })
    for (const sn of input.serials) ctx.emit("trace.eventRecorded", { code: "T02", doc: { type: "grn", id: gid }, serial: sn })
    ctx.link({ from: { type: "purchaseOrder", id: p.id }, to: { type: "grn", id: gid }, kind: "receives" })
    if (input.batch) ctx.link({ from: { type: "grn", id: gid }, to: { type: "batch", id: input.batch }, kind: "receives" })
    return gid
  })
}
function varRow(d: D, type: VarianceRow["type"], variance: number, std: number, qty: number, source: VarianceRow["source"], cc: CostCenterId, pc: VarianceRow["profitCenterId"], extra: Partial<VarianceRow> = {}): VarianceRow {
  return { id: `VAR-${type}-L${(d.seq += 1)}`, type, period: TODAY.slice(0, 7), on: TODAY, variance: r2(variance), stdBasis: r2(std), actual: r2(std + variance), qty, source, journalId: newJe(d), costCenterId: cc, profitCenterId: pc, ...extra }
}
/** Three-way match (ACC volume, shown here so the PO reaches Matched/Closed): DR 2110 / CR 2100, IPV to 5210.
 *  Recognised per invoice on the matched quantity, so partial deliveries and partial invoices match
 *  (Part A §8.4). `qtys` is the quantity this invoice covers per line (default: received and not yet invoiced). */
export function matchInvoice(id: string, invoiceNo: string, prices: Record<number, number>, qtys: Record<number, number> = {}) {
  return m((d, ctx) => {
    need(ctx, ["AP clerk"], "Three-way match")
    const p = po(d, id)
    if (!["Partially Received", "Received"].includes(p.status)) throw new ProtoError(`Match needs goods received against the PO (this one is ${p.status}).`)
    if (!invoiceNo.trim()) throw new ProtoError("Enter the vendor invoice number.", "invoice")
    if (d.purchaseOrders.some((x) => x.vendorId === p.vendorId && (x.invoices ?? (x.invoice ? [x.invoice] : [])).some((i) => i.no === invoiceNo.trim()))) throw new ProtoError("Duplicate (vendor, invoice #) is blocked (FL-03 step 8).", "invoice")
    if (p.createdBy === ctx.userId) throw new ProtoError("Separation of duties: the PO creator cannot approve the invoice (FL-03).")
    let total = 0
    const invLines: { line: number; price: number; qty: number }[] = []
    for (const l of p.lines) {
      if (l.status === "Cancelled" || l.status === "Closed") continue
      const open = l.received - l.invoiced
      if (open <= 0) continue
      const q = qtys[l.no] ?? open
      if (q <= 0) continue
      if (q > open) throw new ProtoError(`Line ${l.no}: only ${open} received and not yet invoiced; the invoice cannot match ${q}.`)
      const inv = prices[l.no] ?? l.price
      total += inv * q
      const ipv = r2((inv - l.price) * q)
      if (Math.abs(ipv) >= 0.01) {
        // subcontract: the invoice delta is the SPV invoice leg; everything else is IPV
        const type = p.type === "Subcontract" ? "SPV" : "IPV"
        d.variances.push(varRow(d, type, ipv, l.price * q, q, { type: "purchaseOrder", id: p.id }, p.type === "Subcontract" ? "CC-1150" : "CC-2000", p.type === "Subcontract" ? "PC-200" : pcOf(l.itemId), { itemId: l.itemId, vendorId: p.vendorId }))
      }
      l.invoiced += q
      invLines.push({ line: l.no, price: inv, qty: q })
      if (l.invoiced >= l.qty && l.received >= l.qty) l.status = "Closed"
    }
    if (!invLines.length) throw new ProtoError("Nothing received and uninvoiced to match.")
    const inv = { no: invoiceNo.trim(), on: ctx.today, lines: invLines }
    p.invoices = [...(p.invoices ?? []), inv]
    p.invoice = { no: inv.no, on: inv.on, lines: invLines.map((x) => ({ line: x.line, price: x.price })) }
    const live = p.lines.filter((x) => x.status !== "Cancelled")
    const allClosed = live.every((x) => x.status === "Closed")
    if (allClosed) {
      p.status = "Matched/Closed"
      p.changePending = false
    }
    log(p, ctx, `Invoice ${invoiceNo} matched on ${invLines.map((x) => `line ${x.line} x ${x.qty}`).join(", ")}${allClosed ? "; PO closed" : "; PO stays open for the remaining receipt or invoice"}`)
    ctx.emit("posting.posted", { template: "match", amount: r2(total), currency: p.currency, source: { type: "purchaseOrder", id: p.id } })
  })
}
/** Subcontract material provision (#34): issue the provided components to the vendor. */
export function issueProvided(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Warehouse operator", "Receiving clerk", "Buyer"], "Issuing components to the subcontractor")
    const p = po(d, id)
    if (p.type !== "Subcontract" || !p.provided?.length) throw new ProtoError("Not a subcontract PO with provided components.")
    if (!["Sent", "Confirmed", "Partially Received"].includes(p.status)) throw new ProtoError("Issue to the vendor after the PO is Sent.")
    const open = p.provided.filter((x) => !x.issued)
    if (!open.length) throw new ProtoError("Components already issued.")
    const value = r2(open.reduce((t, x) => t + x.qty * (stdOf(d, x.itemId) ?? 0), 0))
    for (const x of open) x.issued = true
    log(p, ctx, `Provided components issued to the vendor (stock At Subcontractor ${p.vendorId})`)
    ctx.emit("posting.posted", { template: 34, amount: value, currency: p.currency, source: { type: "purchaseOrder", id: p.id } })
  })
}

// ---- expedite (Book I G §7)
export function expedite(id: string, entry: { kind: ExpediteEntry["kind"]; line?: number; newDate?: ISODate; text: string }, exceptionId?: string) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager"], "Expedite actions")
    const p = po(d, id)
    const l = entry.line != null ? p.lines.find((x) => x.no === entry.line) : undefined
    if ((entry.kind === "Promise" || entry.kind === "Push out" || entry.kind === "Pull in") && (!l || !entry.newDate)) throw new ProtoError("Choose the line and the new date.")
    if (entry.kind === "Promise" && l && entry.newDate) {
      l.confirmedDate = entry.newDate
      l.promiseHistory.push({ on: ctx.today, date: entry.newDate, by: ctx.userId })
    }
    if ((entry.kind === "Push out" || entry.kind === "Pull in") && l && entry.newDate) {
      if (entry.kind === "Push out" && entry.newDate <= l.needBy) throw new ProtoError("A push-out date must be later than the current date.")
      if (entry.kind === "Pull in" && entry.newDate >= l.needBy) throw new ProtoError("A pull-in date must be earlier than the current date.")
      l.schedules = l.schedules.map((s, i) => (i === l.schedules.length - 1 || l.schedules.length === 1 ? { ...s, date: entry.newDate! } : s))
      l.needBy = entry.newDate
    }
    if (entry.kind === "Escalate" && !entry.text.trim()) throw new ProtoError("Say what you are escalating.")
    p.expedite.push({ on: ctx.today, by: ctx.userId, kind: entry.kind, line: entry.line, newDate: entry.newDate, text: entry.text || `${entry.kind}${entry.newDate ? ` to ${entry.newDate}` : ""}` })
    if (exceptionId) {
      const x = d.mrpExceptions.find((e) => e.id === exceptionId)
      if (x && entry.kind !== "Call" && entry.kind !== "Email") x.done = true
    }
    log(p, ctx, `Expedite: ${entry.kind}${entry.newDate ? ` ${entry.newDate}` : ""}${entry.text ? `, ${entry.text}` : ""}`)
  })
}

// ===================================================================== vendors and AVL (Book I G §2)
export function setVendorOnboarding(vendorId: string, to: "Docs Pending" | "Under Review" | "Active") {
  return m((d, ctx) => {
    const v = vendorOf(d, vendorId)
    if (!v) throw new ProtoError("Vendor not found.")
    const order = ["Draft", "Docs Pending", "Under Review", "Active"]
    if (order.indexOf(to) !== order.indexOf(v.onboarding) + 1) throw new ProtoError(`Onboarding moves one step at a time (now ${v.onboarding}).`)
    if (to === "Active") need(ctx, ["Controller"], "Vendor onboarding financial release")
    else need(ctx, ["Buyer", "Purchasing Manager"], "Onboarding steps")
    if (to === "Under Review" && v.complianceDocs.length === 0) throw new ProtoError("Compliance documents are missing: attach W-9, insurance and ISO certificates before review.")
    const o = (d.vendorOverlay[vendorId] ??= { history: [] })
    o.onboarding = to
    o.history.push({ on: ctx.today, by: ctx.userId, role: ctx.role, text: `Onboarding ${v.onboarding} to ${to}` })
  })
}
export function setVendorQuality(vendorId: string, to: "Approved" | "Conditional" | "Restricted" | "Disqualified", reason: string) {
  return m((d, ctx) => {
    need(ctx, ["Quality Manager", "Quality engineer", "Purchasing Manager"], "Restricting or disqualifying a vendor")
    const v = vendorOf(d, vendorId)
    if (!v) throw new ProtoError("Vendor not found.")
    if (v.quality === to) throw new ProtoError(`Vendor is already ${to}.`)
    if (v.quality === "Disqualified" && to !== "Conditional") throw new ProtoError("A Disqualified vendor returns through Conditional (requalification).")
    const o = (d.vendorOverlay[vendorId] ??= { history: [] })
    o.quality = to
    o.history.push({ on: ctx.today, by: ctx.userId, role: ctx.role, text: `Quality ${v.quality} to ${to}: ${reason}` })
    let n = 0
    if (to === "Disqualified")
      for (const a of allAvl(d).filter((x) => x.vendorId === vendorId && x.status !== "Suspended")) {
        d.avlOverlay[a.id] = { ...d.avlOverlay[a.id], status: "Suspended", note: `Cascade: vendor Disqualified ${ctx.today}` }
        n++
      }
    for (const p of d.purchaseOrders.filter((x) => x.vendorId === vendorId && (x.status === "Draft" || x.status === "In Approval" || x.status === "Approved")))
      log(p, ctx, `Vendor ${to}: ${to === "Disqualified" ? "PO hard-blocked (C-32)" : to === "Restricted" ? "Purchasing Manager override needed (C-32)" : "eligibility changed"}`)
    return n
  })
}
export function setAvlStatus(avlId: string, to: "Qualified" | "Conditional" | "Suspended") {
  return m((d, ctx) => {
    need(ctx, ["Quality Manager", "Quality engineer"], "AVL qualification status")
    d.avlOverlay[avlId] = { ...d.avlOverlay[avlId], status: to, note: `Set ${to} by ${ctx.role} on ${ctx.today}` }
  })
}

// ===================================================================== LLR and STP (Book IV §3.2, §3.3)
export function decideEcoImpact(llrId: string, ecoId: string, poId: string, decision: "Proceed" | "Change order to vendor" | "Stop with exposure booking", exposureBooked: number) {
  return m((d, ctx) => {
    need(ctx, ["Buyer", "Purchasing Manager", "Engineering Manager"], "Commercial decision on an ECO impact")
    const l = d.llrs.find((x) => x.id === llrId)
    const x = l?.ecoImpacts.find((i) => i.ecoId === ecoId && i.poId === poId)
    if (!l || !x) throw new ProtoError("Impact not found.")
    x.decision = decision
    x.on = ctx.today
    x.exposureBooked = decision === "Stop with exposure booking" ? exposureBooked : 0
    const p = d.purchaseOrders.find((q) => q.id === poId)
    if (p) {
      log(p, ctx, `${ecoId} decision on ${llrId}: ${decision}`)
      if (decision === "Proceed") p.changePending = false
    }
  })
}
export function closeLlr(id: string, note: string) {
  return m((d, ctx) => {
    need(ctx, ["Purchasing Manager", "Engineering Manager", "Buyer"], "Closing an LLR")
    const l = d.llrs.find((x) => x.id === id)
    if (!l) throw new ProtoError("LLR not found.")
    if (l.state !== "Approved") throw new ProtoError(`Only an Approved LLR closes (this one is ${l.state}).`)
    const open = l.ecoImpacts.filter((x) => !x.decision)
    if (open.length) throw new ProtoError(`${open.length} PO impact(s) still need a disposition: the LLR closes on final release or full disposition (Book IV §3.2).`)
    l.state = "Closed"
    l.closedOn = ctx.today
    l.closeNote = note
  })
}
export function newStpVersion(id: string, change: string) {
  return m((d, ctx) => {
    need(ctx, ["Engineer", "Engineering Manager", "Buyer"], "Creating an STP version")
    const t = d.stps.find((x) => x.id === id)
    if (!t) throw new ProtoError("STP not found.")
    if (t.superseded) throw new ProtoError(`${t.id} is already superseded by ${t.supersededBy}.`)
    if (!change.trim()) throw new ProtoError("Say what changed.")
    const nid = `STP-000${(d.seq += 1)}` as `STP-${string}`
    const hex = Array.from({ length: 64 }, (_, i) => "0123456789abcdef"[(i * 7 + d.seq) % 16]).join("")
    d.stps.unshift({ ...structuredClone(t), id: nid, version: t.version + 1, title: t.title.replace(/version \d+.*/, `version ${t.version + 1}`), createdOn: ctx.today, checksum: `sha256:${hex}`, superseded: false, supersededBy: undefined, acknowledgements: [], specs: [...t.specs, change.trim()] })
    t.superseded = true
    t.supersededBy = nid
    // Open POs on the old version: vendor must acknowledge the revised package before receipt (E-DTS-04)
    for (const p of d.purchaseOrders) for (const l of p.lines) if (l.stpId === id && !["Matched/Closed", "Cancelled", "Received"].includes(p.status) && l.status !== "Cancelled") {
      l.stpId = nid
      p.changePending = true
      log(p, ctx, `Line ${l.no} moved to revised ${nid}; vendor acknowledgement needed before receipt (E-DTS-04)`)
    }
    return nid
  })
}

// ===================================================================== costing (Book I I)
export function computeRateDraft(validFrom: ISODate, upliftPct: number) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant", "Controller"], "Computing a rate draft")
    if (d.wcRates.some((r) => r.validFrom === validFrom)) throw new ProtoError(`A rate version effective ${validFrom} already exists; released versions are never edited (C-50).`)
    const latest = (wc: WorkCenterId) => d.wcRates.filter((r) => r.workCenterId === wc && r.state === "Released").sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
    for (const w of WORK_CENTERS) {
      const prev = latest(w.id)
      if (!prev) continue
      const f = 1 + upliftPct / 100
      const rec: WcRateRec = { ...prev, validFrom, state: "Draft", releasedBy: undefined, plannedLaborCost: Math.round(prev.plannedLaborCost * f), plannedOverheadPool: Math.round(prev.plannedOverheadPool * f), plannedMachinePool: Math.round(prev.plannedMachinePool * f) }
      rec.laborRate = r2(rec.plannedLaborCost / rec.plannedHours)
      rec.overheadRate = r2(rec.plannedOverheadPool / rec.plannedHours)
      rec.machineRate = rec.machineHours ? r2(rec.plannedMachinePool / rec.machineHours) : 0
      d.wcRates.push(rec)
    }
  })
}
export function editRateDraft(wc: WorkCenterId, validFrom: ISODate, patch: { plannedLaborCost?: number; plannedOverheadPool?: number; plannedHours?: number }) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant", "Controller"], "Editing a rate draft (the cost accountant drafts)")
    const r = d.wcRates.find((x) => x.workCenterId === wc && x.validFrom === validFrom)
    if (!r) throw new ProtoError("Rate row not found.")
    if (r.state === "Released") throw new ProtoError("Released rates are never edited in place (C-50); compute a new dated draft.")
    Object.assign(r, patch)
    if (!(r.plannedHours > 0)) throw new ProtoError("Planned hours must be above zero.")
    r.laborRate = r2(r.plannedLaborCost / r.plannedHours)
    r.overheadRate = r2(r.plannedOverheadPool / r.plannedHours)
  })
}
export function releaseRates(validFrom: ISODate) {
  return m((d, ctx) => {
    need(ctx, ["Controller"], "Releasing work center rates")
    const rows = d.wcRates.filter((r) => r.validFrom === validFrom && r.state === "Draft")
    if (!rows.length) throw new ProtoError("No draft rates at that effective date.")
    for (const r of rows) {
      r.state = "Released"
      r.releasedBy = ctx.userId
    }
    return rows.length
  })
}

export function createEstimate(itemId: MaterialId, basis: CeRec["basis"], title: string, quotationId?: string) {
  return m((d, ctx) => {
    need(ctx, ["Estimator", "Cost accountant"], "Creating a cost estimate")
    const tpl = basis === "Parametric ETO model" ? d.costEstimates.find((c) => c.id === "CE-TBD-0301")! : d.costEstimates.find((c) => c.itemId === itemId) ?? d.costEstimates.find((c) => c.id === "CE-TBD-0410")!
    const id = `CE-TBD-0${(d.seq += 1)}` as CeRec["id"]
    const items = structuredClone(tpl.items)
    d.costEstimates.unshift({ id, itemId, status: "Draft", title: title || `Cost estimate, ${itemId}`, basis, version: 1, createdOn: ctx.today, createdBy: ctx.userId, items, drivers: basis === "Parametric ETO model" ? structuredClone(tpl.drivers) : undefined, quotationId: quotationId as CeRec["quotationId"], ...ceTotals(items) })
    return id
  })
}
/** Parametric re-estimate: driver quantities x maintained driver rates (Book I I §3.1). */
export function reEstimate(id: string, drivers: { name: string; qty: number; unit: string }[]) {
  return m((d, ctx) => {
    need(ctx, ["Estimator", "Cost accountant"], "Estimating")
    const c = d.costEstimates.find((x) => x.id === id)
    if (!c) throw new ProtoError("Estimate not found.")
    if (c.status !== "Draft") throw new ProtoError("A Released estimate locks its values (C-35). Supersede it to change.")
    const q = (n: string) => drivers.find((x) => x.name.startsWith(n))?.qty
    for (const it of c.items) {
      let qty: number | undefined
      if (it.ref === "RAW-TBD-CRGO23") qty = q("Core weight")
      if (it.ref === "RAW-TBD-CTC") qty = q("Copper weight") != null ? Math.round(q("Copper weight")! * 0.758) : undefined
      if (it.ref === "RAW-TBD-FOIL") qty = q("Copper weight") != null ? Math.round(q("Copper weight")! * 0.242) : undefined
      if (it.ref === "RAW-TBD-OIL") qty = q("Oil volume") != null ? Math.round(q("Oil volume")! * 3.785) : undefined
      if (it.ref === "RAW-TBD-PLATE") qty = q("Tank steel")
      if (it.ref === "RAW-TBD-BSH145") qty = q("HV bushings")
      if (it.ref === "RAW-TBD-OLTC") qty = q("OLTC")
      if (qty != null) {
        it.qty = qty
        it.value = r2(qty * it.rate)
      }
    }
    c.drivers = drivers
    Object.assign(c, ceTotals(c.items))
  })
}
export function overrideCostItem(id: string, index: number, rate: number, note: string) {
  return m((d, ctx) => {
    need(ctx, ["Estimator", "Cost accountant"], "A manual cost override")
    const c = d.costEstimates.find((x) => x.id === id)
    if (!c) throw new ProtoError("Estimate not found.")
    if (c.status !== "Draft") throw new ProtoError("A Released estimate locks its values (C-35).")
    if (!note.trim()) throw new ProtoError("A manual override needs a note (Book I I §3.1).")
    const it = c.items[index]
    it.rate = rate
    it.value = r2(it.qty * rate)
    it.source = "Manual override"
    it.note = note
    Object.assign(c, ceTotals(c.items))
  })
}
export function releaseEstimate(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Estimator", "Cost accountant"], "Releasing an estimate")
    const c = d.costEstimates.find((x) => x.id === id)
    if (!c) throw new ProtoError("Estimate not found.")
    if (c.status !== "Draft") throw new ProtoError(`Only a Draft estimate is released (this one is ${c.status}).`)
    if (c.total <= 0) throw new ProtoError("The estimate has no value.")
    c.status = "Released"
    c.releasedOn = ctx.today
    // the predecessor this version replaces becomes Superseded now that the new one is quotable
    for (const o of d.costEstimates) if (o.supersededBy === c.id && o.status === "Released") o.status = "Superseded"
  })
}
export function supersedeEstimate(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Estimator", "Cost accountant"], "Superseding an estimate")
    const c = d.costEstimates.find((x) => x.id === id)
    if (!c) throw new ProtoError("Estimate not found.")
    if (c.status !== "Released") throw new ProtoError("Only a Released estimate is superseded.")
    if (c.supersededBy) throw new ProtoError(`A successor ${c.supersededBy} already exists.`)
    const nid = `CE-TBD-0${(d.seq += 1)}` as CeRec["id"]
    d.costEstimates.unshift({ ...structuredClone(c), id: nid, status: "Draft", version: c.version + 1, createdOn: ctx.today, createdBy: ctx.userId, releasedOn: undefined, supersededBy: undefined, quotationId: undefined })
    c.supersededBy = nid
    return nid
  })
}

export function rollRun(scopeKind: RunRec["scopeKind"], groups: string[]) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant", "Controller"], "Rolling up standards")
    const cands = MATERIALS.filter((x) => ["FIN", "SEMI", "RAW", "SPARE", "TRADE", "PACK", "CONS"].includes(x.type) && x.status !== "Obsolete")
      .filter((x) => scopeKind === "All standard-cost items" || (scopeKind === "Item groups" ? groups.includes(x.type) : scopeKind === "New items only" ? x.status === "Data Completion" || x.status === "Draft" : ["FIN-TBD-1000PM", "FIN-TBD-2500PM", "SEMI-TBD-CORE25", "SEMI-TBD-CORE20"].includes(x.id)))
    const rate = d.wcRates.filter((r) => r.state === "Released").sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
    const items: RunItem[] = cands.map((x, i) => {
      const old = stdOf(d, x.id) ?? 0
      if (!old && x.type !== "RAW") return { itemId: x.id, oldStd: 0, newStd: 0, onHand: 0, error: x.type === "SEMI" ? "Missing rate: WC-600 in Maintenance, no released rate" : "BOM not released: no rollup basis" }
      if (!old && x.type === "RAW") return { itemId: x.id, oldStd: 0, newStd: 0, onHand: 0, error: "Missing AVL basis: no rank-1 vendor" }
      const f = 1 + (((i * 37) % 9) - 3) / 100
      return { itemId: x.id, oldStd: old, newStd: r2(old * f), onHand: x.type === "RAW" ? 1000 + ((i * 1337) % 20000) : (i % 7) + 1 }
    })
    const id = `CR-TBD-2026R${(d.seq += 1)}` as const
    d.costingRuns.unshift({ id, period: TODAY.slice(0, 7), scope: `Plant PL-TBD-01, ${scopeKind}${groups.length ? ` (${groups.join(", ")})` : ""}; rates from ${rate?.validFrom ?? "n/a"}`, scopeKind, marked: false, released: false, stage: "Rolled", createdOn: ctx.today, createdBy: ctx.userId, items })
    return id
  })
}
export function markRun(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant"], "Marking a costing run")
    const r = d.costingRuns.find((x) => x.id === id)
    if (!r) throw new ProtoError("Run not found.")
    if (r.stage !== "Rolled") throw new ProtoError(`Only a Rolled run is marked (this one is ${r.stage}).`)
    r.stage = "Marked"
    r.marked = true
    r.markedBy = ctx.userId
  })
}
/** Release revalues on-hand stock (RVV, INV Sec 12 #15: 1310/1330 vs 5330) and stamps new standards. */
export function releaseRun(id: string, effectiveFrom: ISODate) {
  return m((d, ctx) => {
    need(ctx, ["Controller"], "Releasing a costing run")
    const r = d.costingRuns.find((x) => x.id === id)
    if (!r) throw new ProtoError("Run not found.")
    if (r.stage !== "Marked") throw new ProtoError("Release follows Mark (two-step, INV 8.2).")
    if (r.markedBy === ctx.userId) throw new ProtoError("The person who marked the run cannot release it.")
    for (const it of r.items) {
      if (it.error) continue
      d.standards[it.itemId] = { std: it.newStd, effectiveFrom, runId: r.id }
      const rvv = r2(it.onHand * (it.newStd - it.oldStd))
      if (Math.abs(rvv) >= 0.01) d.variances.push(varRow(d, "RVV", rvv, it.onHand * it.oldStd, it.onHand, { type: "material", id: it.itemId }, "CC-2000", pcOf(it.itemId), { itemId: it.itemId }))
    }
    const reval = r2(r.items.filter((it) => !it.error).reduce((t, it) => t + it.onHand * (it.newStd - it.oldStd), 0))
    // Revaluation through the REVAL event key at release (Book II §5.2): the Posting Service books on-hand delta to 5330.
    ctx.emit("posting.posted", { template: "reval" as unknown as "grn", amount: reval, currency: "USD", source: { type: "approval", id: r.id } })
    r.stage = "Released"
    r.released = true
    r.releasedBy = ctx.userId
    r.releasedOn = ctx.today
    r.effectiveFrom = effectiveFrom
  })
}

// ===================================================================== pricing (Book I I §6)
export function massUpdateList(baseId: string, pct: number, validFrom: ISODate, name: string) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager"], "Mass update of a price list")
    const b = d.priceLists.find((x) => x.id === baseId)
    if (!b) throw new ProtoError("Base list not found.")
    if (b.transfer) throw new ProtoError("Transfer prices are maintained by Controlling only (FL-07).")
    const id = `PL-PRC-TBD-M${(d.seq += 1)}` as `PL-PRC-${string}`
    const round = (p: number) => (b.rounding === "Nearest $5" ? Math.round(p / 5) * 5 : b.rounding === "Nearest $1" ? Math.round(p) : r2(p))
    d.priceLists.unshift({ ...structuredClone(b), id, name: name || `${b.name} ${pct >= 0 ? "+" : ""}${pct}%`, status: "Draft", validFrom, validTo: undefined, basis: "Derived", derivation: `${b.id} ${pct >= 0 ? "+" : ""}${pct}%, ${b.rounding}`,
      rates: b.rates.map((x) => ({ itemId: x.itemId, price: round(x.price * (1 + pct / 100)), validFrom })), history: [{ on: ctx.today, by: ctx.userId, text: `Mass update from ${b.id}: new dated rows` }] })
    return id
  })
}
export function addRateRow(listId: string, itemId: MaterialId, price: number, validFrom: ISODate) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager", ...(d.priceLists.find((x) => x.id === listId)?.transfer ? (["Controller", "Controlling analyst"] as Role[]) : [])], "Maintaining rates")
    const l = d.priceLists.find((x) => x.id === listId)
    if (!l) throw new ProtoError("List not found.")
    if (l.transfer && ctx.role === "Pricing Manager") throw new ProtoError("Transfer prices are maintained by Controlling only (FL-07).")
    if (l.status === "Archived") throw new ProtoError("An Archived list takes no new rows.")
    if (!(price > 0)) throw new ProtoError("Enter a price.", "price")
    if (l.rates.some((r) => r.itemId === itemId && r.validFrom === validFrom)) throw new ProtoError("A row for this item and date exists; rows are effective-dated and never overlap (C-50).", "validFrom")
    l.rates.push({ itemId, price, validFrom })
    l.history.push({ on: ctx.today, by: ctx.userId, text: `New dated row ${itemId} ${price} from ${validFrom}` })
    if (l.status === "Active") {
      l.status = "Pending Approval"
      l.history.push({ on: ctx.today, by: ctx.userId, text: "Rate change on an Active list rides the approval (Pricing Manager; Controller when a row breaches the floor)" })
    }
  })
}
export function archiveList(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager"], "Archiving a price list")
    const l = d.priceLists.find((x) => x.id === id)
    if (!l || l.status !== "Active") throw new ProtoError("Only an Active list is archived.")
    if (CUSTOMER_LISTS.has(l.id)) throw new ProtoError(`${l.id} is assigned to customers; assign a successor first.`)
    l.status = "Archived"
    l.history.push({ on: ctx.today, by: ctx.userId, text: "Archived" })
  })
}
const CUSTOMER_LISTS = new Set(["PL-PRC-TBD-US26", "PL-PRC-TBD-CA26"])
export function setAgreementTerm(id: string, term: ContractTerm) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager"], "Maintaining agreements")
    const a = d.agreements.find((x) => x.id === id)
    if (!a) throw new ProtoError("Agreement not found.")
    a.contractTerm = term
  })
}

export function postIndexValue(index: string, month: string, value: number, source: string) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant"], "Posting a monthly index value")
    if (!/^\d{4}-\d{2}$/.test(month)) throw new ProtoError("Month as yyyy-mm.", "month")
    if (d.indexValues.some((v) => v.index === index && v.month === month)) throw new ProtoError(`${index} ${month} is already posted; history is immutable (Book I I §6.4).`, "month")
    if (!(value > 0)) throw new ProtoError("Enter the index value.", "value")
    if (!source.trim()) throw new ProtoError("Add a source note.", "source")
    d.indexValues.push({ index, month, value, postedOn: ctx.today, postedBy: ctx.userId, source })
  })
}
export function newSurchargeVersion(id: string, patch: { baseValue: number; contentPerUnit: number; passThroughPct: number; shipDateAdjusted: boolean; validFrom: ISODate }) {
  return m((d, ctx) => {
    need(ctx, ["Pricing Manager"], "Maintaining surcharge rules")
    const r = d.surchargeRules.find((x) => x.id === id)
    if (!r) throw new ProtoError("Rule not found.")
    if (patch.validFrom <= r.validFrom) throw new ProtoError("The new version must start after the current one (C-50).", "validFrom")
    if (patch.passThroughPct < 0 || patch.passThroughPct > 100) throw new ProtoError("Pass-through is 0 to 100%.", "passThroughPct")
    const nid = `SUR-TBD-0${(d.seq += 1)}` as `SUR-${string}`
    d.surchargeRules.unshift({ ...structuredClone(r), id: nid, ...patch, shareOfPricePct: patch.passThroughPct, maintainedBy: ctx.userId })
    return nid
  })
}

// ===================================================================== controlling (Book I H)
type CenterInput = CenterDraft["input"]
/** Validates a master change without applying it (used when drafting and again when approving). */
function checkCenterChange(d: D, id: string, action: CenterChangeKind, input: CenterInput & { whereUsed?: number }) {
  if (action === "New cost center") {
    if (!input.name?.trim()) throw new ProtoError("Enter the cost center name.", "name")
    if (input.parentId && ![...COST_CENTERS, ...d.addedCenters].some((c) => c.id === input.parentId && !c.postable)) throw new ProtoError("The parent must be a summary node.", "parentId")
    if (input.postable && !input.defaultProfitCenterId) throw new ProtoError("A postable cost center needs a default profit center.", "defaultProfitCenterId")
    if ([...COST_CENTERS, ...d.addedCenters].some((c) => c.id === id)) throw new ProtoError(`${id} already exists.`, "id")
    if (!/^CC-\d{4}$/.test(id)) throw new ProtoError("Cost center ids look like CC-1234.", "id")
    return { status: "Active" as const }
  }
  if (action === "New profit center") {
    if (!input.name?.trim()) throw new ProtoError("Enter the profit center name.", "name")
    if ([...PROFIT_CENTERS, ...d.addedProfitCenters].some((c) => c.id === id)) throw new ProtoError(`${id} already exists.`, "id")
    if (!/^PC-\d{3}$/.test(id)) throw new ProtoError("Profit center ids look like PC-500.", "id")
    return { status: "Active" as const }
  }
  const o = d.centerOverlay[id]
  const base = COST_CENTERS.find((c) => c.id === id) ?? d.addedCenters.find((c) => c.id === id)
  if (!base) throw new ProtoError("Center not found.")
  const status = o?.status ?? base.status
  if (action === "Block" && status !== "Active") throw new ProtoError(`Only an Active center is blocked (now ${status}).`)
  if (action === "Unblock" && status !== "Blocked") throw new ProtoError("Center is not Blocked.")
  if (action === "Deactivate") {
    if ((input.whereUsed ?? 0) > 0) throw new ProtoError(`Where-used check failed: ${input.whereUsed} open use(s). Clear them before deactivation (Book I H §2).`)
    if (status === "Inactive") throw new ProtoError("Already Inactive.")
  }
  if (action === "Move") {
    if (!input.parentId) throw new ProtoError("Choose the new parent node.")
    if (input.parentId === id) throw new ProtoError("A center cannot be its own parent.")
  }
  if (action === "Maintain" && !input.managerId) throw new ProtoError("Choose the manager.", "managerId")
  return { status }
}
/** Controlling analyst drafts a master change (H §6); nothing changes until the approver decides it. */
export function draftCenterChange(id: string, kind: CenterChangeKind, input: CenterInput & { whereUsed?: number }) {
  return m((d, ctx) => {
    need(ctx, ["Controlling analyst"], "Drafting a cost or profit center change (the Controller approves)")
    checkCenterChange(d, id, kind, input)
    const { whereUsed: _w, ...keep } = input
    void _w
    const nid = `CCD-${String((d.seq += 1))}` as CenterDraft["id"]
    d.centerDrafts.unshift({ id: nid, centerId: id, kind, input: keep, draftedBy: ctx.userId, draftedOn: ctx.today, status: "Draft" })
    return nid
  })
}
/** The Controller approves cost center masters; the CFO owns profit center structure [DOC:p.115 §6]. */
export function decideCenterChange(draftId: string, outcome: "Approved" | "Rejected", reason: string, whereUsed = 0) {
  return m((d, ctx) => {
    const dr = d.centerDrafts.find((x) => x.id === draftId)
    if (!dr) throw new ProtoError("Draft not found.")
    if (dr.status !== "Draft") throw new ProtoError(`${draftId} is already ${dr.status}.`)
    const approver: Role = dr.kind === "New profit center" ? "CFO" : "Controller"
    need(ctx, [approver], `Approving a ${dr.kind} change`)
    if (dr.draftedBy === ctx.userId) throw new ProtoError("The drafter cannot approve their own change.")
    if (outcome === "Rejected" && !reason.trim()) throw new ProtoError("A reason is required to reject.", "reason")
    dr.status = outcome
    dr.decidedBy = ctx.userId
    dr.decidedOn = ctx.today
    dr.reason = reason || undefined
    if (outcome === "Rejected") return
    const input = dr.input
    const id = dr.centerId
    checkCenterChange(d, id, dr.kind, { ...input, whereUsed })
    if (dr.kind === "New cost center") {
      d.addedCenters.push({ id: id as CostCenterId, name: input.name!.trim(), parentId: input.parentId, postable: !!input.postable, entityId: input.entityId ?? "LE-TBD-10", defaultProfitCenterId: input.defaultProfitCenterId as AddedCostCenter["defaultProfitCenterId"], status: "Active", validFrom: input.effective })
      d.centerOverlay[id] = { ...(d.centerOverlay[id] ?? { history: [] }), managerId: (input.managerId as `USR-${string}` | undefined) ?? d.centerOverlay[id]?.managerId, history: [{ on: ctx.today, by: dr.draftedBy, text: `Created (${draftId}), approved by ${ctx.role}`, effective: input.effective }] }
      return
    }
    if (dr.kind === "New profit center") {
      d.addedProfitCenters.push({ id: id as AddedProfitCenter["id"], name: input.name!.trim(), scope: input.scope ?? "", status: "Active", priceFloorPct: input.priceFloorPct, validFrom: input.effective })
      return
    }
    const o = (d.centerOverlay[id] ??= { history: [] })
    if (dr.kind === "Block") o.status = "Blocked"
    if (dr.kind === "Unblock") o.status = "Active"
    if (dr.kind === "Deactivate") o.status = "Inactive"
    if (dr.kind === "Move") o.parentId = input.parentId
    if (dr.kind === "Maintain" && input.managerId) o.managerId = input.managerId as `USR-${string}`
    o.history.push({ on: ctx.today, by: dr.draftedBy, text: `${input.text || `${dr.kind}${input.parentId ? ` under ${input.parentId}` : ""}`} (${draftId}, approved by ${ctx.role})`, effective: input.effective })
  })
}
export function editSkf(cc: CostCenterId, field: "headcount" | "sqft" | "machineHours" | "laborHours", value: number) {
  return m((d, ctx) => {
    need(ctx, ["Controlling analyst", "Controller"], "Statistical key figure maintenance")
    const row = d.skf.find((x) => x.costCenterId === cc)
    if (!row) throw new ProtoError("No SKF row.")
    if (value < 0) throw new ProtoError("Values cannot be negative.")
    row[field] = value
  })
}
export function postAllocation(cycleId: string, period: string) {
  return m((d, ctx) => {
    need(ctx, ["Controller"], "Posting an allocation run")
    const c = d.allocationCycles.find((x) => x.id === cycleId)
    if (!c) throw new ProtoError("Cycle not found.")
    const prior = d.allocRuns.filter((r) => r.cycleId === cycleId && r.period === period && r.state === "Posted")
    if (prior.length) throw new ProtoError(`${prior[0].id} is already posted for ${period}. Use Rerun: it reverses and reposts, both retained.`)
    const before = d.allocationCycles.filter((x) => x.sequence < c.sequence)
    const missing = before.find((x) => !d.allocRuns.some((r) => r.cycleId === x.id && r.period === period && r.state === "Posted"))
    if (missing) throw new ProtoError(`Cycles run in defined order: post ${missing.id} (sequence ${missing.sequence}) first.`)
    return postRun(d, ctx, c, period)
  })
}
function postRun(d: D, ctx: MutateCtx, c: PurchasingFinanceState["allocationCycles"][number], period: string, replaces?: AllocRun["id"]) {
  for (const s of c.senderCostCenterIds) {
    const st = d.centerOverlay[s]?.status ?? COST_CENTERS.find((x) => x.id === s)?.status
    if (st === "Blocked") throw new ProtoError(`Sender ${s} is Blocked for posting; unblock it or remove it from the cycle.`)
  }
  for (const r of c.receiverCostCenterIds) {
    const st = d.centerOverlay[r]?.status ?? COST_CENTERS.find((x) => x.id === r)?.status
    if (st === "Blocked" || st === "Inactive") throw new ProtoError(`Receiver ${r} is ${st}.`)
  }
  const lines = computeAllocation(c, period, d.skf)
  const total = r2(lines.reduce((t, l) => t + l.amount, 0))
  const nn = d.allocRuns.filter((r) => r.period === period).length + 1
  const id = `ALC-${period.replace("-", "")}-${String(nn).padStart(2, "0")}` as AllocRun["id"]
  d.allocRuns.push({ id, cycleId: c.id, period, state: "Posted", postedOn: ctx.today, postedBy: ctx.userId, lines, total, replaces })
  c.status = "Posted"
  ctx.emit("posting.posted", { template: 36, amount: total, currency: "USD", source: { type: "approval", id } })
  return id
}
export function rerunAllocation(cycleId: string, period: string) {
  return m((d, ctx) => {
    need(ctx, ["Controller"], "Rerunning an allocation")
    const c = d.allocationCycles.find((x) => x.id === cycleId)
    if (!c) throw new ProtoError("Cycle not found.")
    const prior = d.allocRuns.find((r) => r.cycleId === cycleId && r.period === period && r.state === "Posted")
    if (!prior) throw new ProtoError("Nothing posted for this period yet: use Post.")
    const id = postRun(d, ctx, c, period, prior.id)
    prior.state = "Reversed"
    prior.reversedBy = id
    ctx.emit("posting.posted", { template: 36, amount: -prior.total, currency: "USD", source: { type: "approval", id: prior.id } })
    return id
  })
}

// ===================================================================== allocation cycles: Define (Book I H §5)
const ccStatus = (d: D, id: string) => d.centerOverlay[id]?.status ?? COST_CENTERS.find((c) => c.id === id)?.status ?? d.addedCenters.find((c) => c.id === id)?.status
const ccPostable = (d: D, id: string) => (COST_CENTERS.find((c) => c.id === id) ?? d.addedCenters.find((c) => c.id === id))?.postable
function checkSegment(d: D, seg: { senderIds: CostCenterId[]; receiverIds: CostCenterId[]; driver: AllocSegment["driver"]; accountRange: string; fixedPct?: Record<string, number> }) {
  if (!seg.senderIds.length) throw new ProtoError("Choose at least one sender cost center.", "senders")
  if (!seg.receiverIds.length) throw new ProtoError("Choose at least one receiver cost center.", "receivers")
  if (!/^\d{4}-\d{4}$/.test(seg.accountRange.trim())) throw new ProtoError("Account range as 6000-6999.", "accountRange")
  for (const x of [...seg.senderIds, ...seg.receiverIds]) {
    if (ccPostable(d, x) !== true) throw new ProtoError(`${x} is not a postable cost center (V-CO-01).`)
    if (ccStatus(d, x) === "Inactive") throw new ProtoError(`${x} is Inactive.`)
  }
  const both = seg.senderIds.filter((x) => seg.receiverIds.includes(x))
  if (both.length) throw new ProtoError(`${both.join(", ")} cannot be both sender and receiver in one segment.`)
  if (seg.driver === "Fixed %") {
    const t = seg.receiverIds.reduce((a, r) => a + (seg.fixedPct?.[r] ?? 0), 0)
    if (Math.abs(t - 100) > 0.001) throw new ProtoError(`Fixed percentages add up to ${t}, not 100.`, "fixedPct")
  }
}
/** Define a new cycle with its first segment (Controlling analyst defines; the Controller posts). */
export function defineCycle(input: { name: string; entityId?: `LE-${string}`; senderIds: CostCenterId[]; receiverIds: CostCenterId[]; driver: AllocSegment["driver"]; accountRange: string; fixedPct?: Record<string, number> }) {
  return m((d, ctx) => {
    need(ctx, ["Controlling analyst"], "Defining an allocation cycle (the Controller posts)")
    if (!input.name.trim()) throw new ProtoError("Enter a cycle name.", "name")
    checkSegment(d, input)
    const sequence = d.allocationCycles.reduce((t, c) => Math.max(t, c.sequence), 0) + 1
    const id = `ALC-CYC-${String(sequence).padStart(2, "0")}` as AllocCycleRec["id"]
    d.allocationCycles.push({
      id, name: input.name.trim(), sequence, entityId: input.entityId ?? "LE-TBD-10", senderCostCenterIds: input.senderIds, receiverCostCenterIds: input.receiverIds, driver: input.driver, period: TODAY.slice(0, 7), status: "Defined",
      segments: [{ no: 10, senderIds: input.senderIds, accountRange: input.accountRange.trim(), receiverIds: input.receiverIds, driver: input.driver, fixedPct: input.driver === "Fixed %" ? input.fixedPct : undefined }],
    })
    return id
  })
}
const cycleOf = (d: D, id: string) => {
  const c = d.allocationCycles.find((x) => x.id === id)
  if (!c) throw new ProtoError("Cycle not found.")
  if (d.allocRuns.some((r) => r.cycleId === id && r.state === "Posted")) throw new ProtoError(`${id} has a posted run: posted cycles keep their definition. Define a new cycle or rerun after the key figures change.`)
  return c
}
const syncCycle = (c: AllocCycleRec) => {
  c.senderCostCenterIds = [...new Set(c.segments.flatMap((g) => g.senderIds))]
  c.receiverCostCenterIds = [...new Set(c.segments.flatMap((g) => g.receiverIds))]
  c.driver = c.segments[0]?.driver ?? c.driver
}
export function addSegment(cycleId: string, seg: { senderIds: CostCenterId[]; receiverIds: CostCenterId[]; driver: AllocSegment["driver"]; accountRange: string; fixedPct?: Record<string, number> }) {
  return m((d, ctx) => {
    need(ctx, ["Controlling analyst"], "Defining an allocation segment")
    const c = cycleOf(d, cycleId)
    checkSegment(d, seg)
    c.segments.push({ no: (c.segments[c.segments.length - 1]?.no ?? 0) + 10, senderIds: seg.senderIds, accountRange: seg.accountRange.trim(), receiverIds: seg.receiverIds, driver: seg.driver, fixedPct: seg.driver === "Fixed %" ? seg.fixedPct : undefined })
    syncCycle(c)
  })
}
export function removeSegment(cycleId: string, no: number) {
  return m((d, ctx) => {
    need(ctx, ["Controlling analyst"], "Editing an allocation segment")
    const c = cycleOf(d, cycleId)
    if (c.segments.length <= 1) throw new ProtoError("A cycle keeps at least one segment.")
    c.segments = c.segments.filter((g) => g.no !== no)
    syncCycle(c)
  })
}
export function renameCycle(cycleId: string, name: string) {
  return m((d, ctx) => {
    need(ctx, ["Controlling analyst"], "Editing an allocation cycle")
    const c = d.allocationCycles.find((x) => x.id === cycleId)
    if (!c) throw new ProtoError("Cycle not found.")
    if (!name.trim()) throw new ProtoError("Enter a cycle name.", "name")
    c.name = name.trim()
  })
}

// ===================================================================== CVA explanations and exception alerts (Part A §8)
export function explainVariance(type: VarianceRow["type"], key: string, text: string) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant", "Controller"], "Recording a variance explanation")
    if (!text.trim()) throw new ProtoError("Write the explanation.", "text")
    d.explanations.unshift({ id: `EXP-${(d.seq += 1)}`, type, key, text: text.trim(), by: ctx.userId, role: ctx.role, on: ctx.today })
  })
}
export function acknowledgeException(id: string) {
  return m((d, ctx) => {
    need(ctx, ["Cost accountant"], "Acknowledging a costing alert")
    const x = d.cvaExceptions.find((e) => e.id === id)
    if (!x) throw new ProtoError("Exception not found.")
    if (x.acknowledgedBy) throw new ProtoError("Already acknowledged.")
    x.acknowledgedBy = ctx.userId
    x.acknowledgedOn = ctx.today
  })
}
