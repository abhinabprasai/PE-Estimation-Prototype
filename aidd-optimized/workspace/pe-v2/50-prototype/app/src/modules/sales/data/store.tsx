// FL-09 sales slice actions. Every action is atomic: it runs on a clone and either commits the whole
// clone or throws and changes nothing (R-13 falls out of this). Since the foundation pass the clone
// and commit are done by the root store (src/store/core.ts); the action bodies are unchanged.
import { huPackagingCost } from "./packaging"
import { useMemo, type ReactNode } from "react"
import { ProtoError, store, useRole, useSlice, type Result } from "@/store"
import {
  type Approval,
  type CreditCheck,
  type DB,
  type Delivery,
  type Role,
  type SalesOrder,
  type Schedule,
  OPEN_PERIOD,
  TODAY,
  addDays,
  fmtSO,
  listDate,
  money,
  orderValue,
  product,
} from "./model"

export { ProtoError }
export type { Result }

const ATP_LATER_DATE: Record<string, { date: string; constraint: string }> = {
  "FIN-TBD-2500PM": { date: "2026-10-30", constraint: "incoming stock from production order" },
}
export const HORIZON_DAYS = 7 // design value: the horizon length is not stated in the specification

const act = (by: string, text: string) => ({ at: TODAY, by, text })

function findOrder(db: DB, id: string) {
  const o = db.orders.find((x) => x.id === id)
  if (!o) throw new ProtoError(`Order ${id} not found`)
  return o
}
function findDelivery(db: DB, id: string) {
  const d = db.deliveries.find((x) => x.id === id)
  if (!d) throw new ProtoError(`Delivery ${id} not found`)
  return d
}
function nextSO(db: DB) {
  let id = fmtSO(db.seq.so)
  while (db.orders.some((o) => o.id === id)) {
    db.seq.so++
    id = fmtSO(db.seq.so)
  }
  db.seq.so++
  return id
}

function runCreditCheck(db: DB, o: SalesOrder, when: string): CreditCheck {
  const c = db.customers.find((x) => x.id === o.customerId)!
  const value = orderValue(o)
  const check: CreditCheck = {
    at: TODAY,
    when,
    exposure: c.exposure,
    orderValue: value,
    limit: c.creditLimit,
    pastDue30: c.pastDue30,
    passLimit: c.exposure + value <= c.creditLimit && !c.creditHold,
    passPastDue: !c.pastDue30,
  }
  o.creditChecks.push(check)
  return check
}

function syncLineAndOrderAfterDelivery(o: SalesOrder) {
  for (const l of o.lines) {
    const delivered = l.schedules.reduce((s, x) => s + x.deliveredQty, 0)
    if (delivered >= l.qty) l.status = "Shipped"
    else if (delivered > 0) l.status = "Partially Shipped"
  }
  const active = o.lines.filter((l) => l.status !== "Cancelled")
  if (active.every((l) => l.status === "Shipped")) o.status = "Shipped"
  else if (active.some((l) => l.status === "Shipped" || l.status === "Partially Shipped")) o.status = "Partially Shipped"
}

export function postingPreview(db: DB, d: Delivery) {
  const units = d.refs.map((r) => {
    const o = db.orders.find((x) => x.id === r.soId)!
    const l = o.lines.find((x) => x.no === r.line)!
    return { item: l.item, qty: r.qty, std: product(l.item).stdCost ?? 0 }
  })
  const cogs = units.reduce((s, u) => s + u.qty * u.std, 0)
  return {
    p25: { text: "#25 DR 5120 COGS / CR 1330 Finished Goods (qty × standard cost)", amount: cogs, detail: units.map((u) => `${u.qty} × ${u.item} at ${money(u.std)}`).join("; ") },
    p26:
      d.freightPaidBy === "PE-paid"
        ? { text: "#26 DR 6410 Freight Out / CR 2100 AP accrual (quoted freight, PE-paid terms)", amount: d.freight ?? 0, detail: d.freight == null ? "Freight not recorded" : "" }
        : { text: "#26 not posted: customer-paid freight", amount: null as number | null, detail: `${d.incoterms} terms` },
  }
}

export function reversalBlock(db: DB, d: Delivery, role: Role): string | null {
  if (d.status !== "PGI") return "Reverse PGI applies only to a delivery at PGI."
  const o = db.orders.find((x) => x.id === d.soId)!
  if (o.invoicePosted)
    return `PGI reversal refused: an invoice is already posted for ${o.id}. After invoice there is no reversal; use credit/rebill or an RMA (ACC, not built).`
  if (d.pgiPeriod !== OPEN_PERIOD)
    return `PGI reversal refused: ${d.pgiId} was posted in fiscal period ${d.pgiPeriod}; the open period is ${OPEN_PERIOD}. Reversal is allowed only in the same fiscal period.`
  if (role !== "Shipping Manager") return "Reverse PGI is available to the Shipping Manager only. Switch the acting role to Shipping Manager."
  return null
}

export function failingFlags(d: Delivery) {
  return (Object.entries(d.flags) as [string, string][]).filter(([, v]) => v !== "passed").map(([k]) => k)
}

// ----------------------------------------------------------------------------
export function makeActions(mutate: <T>(fn: (db: DB) => T) => Result<T>, getRole: () => Role) {
  return {
    recordWin: (qtId: string) =>
      mutate((db) => {
        const q = db.quotations.find((x) => x.id === qtId)!
        if (q.status !== "Issued") throw new ProtoError("Only an Issued quotation can be recorded as won or lost.")
        q.status = "Won"
        q.activity.push(act(getRole(), "Win recorded. Status Issued → Won"))
        // OM-LEAD: Won is set only by the win recording on the linked quotation (p.249 §4.1).
        const lead = db.leads.find((l) => l.id === q.leadId || l.quotationIds.includes(q.id))
        if (lead && lead.stage === "Quoting") {
          lead.stage = "Won"
          lead.stageSince = TODAY
          lead.winProb = 100
          lead.activity.push(act("System", `Win recorded on ${q.id}. Stage Quoting → Won`))
        }
      }),
    recordLoss: (qtId: string, reason: string) =>
      mutate((db) => {
        const q = db.quotations.find((x) => x.id === qtId)!
        if (!reason.trim()) throw new ProtoError("Loss reason is required. Enter why the quotation was lost, then record the loss again.", "lossReason")
        q.status = "Lost"
        q.lossReason = reason.trim()
        q.activity.push(act(getRole(), `Loss recorded: ${reason.trim()}. Status Issued → Lost`))
        const lead = db.leads.find((l) => l.id === q.leadId || l.quotationIds.includes(q.id))
        const otherOpen = lead?.quotationIds.some((id) => id !== q.id && ["Draft", "Internal Review", "Issued"].includes(db.quotations.find((x) => x.id === id)?.status ?? ""))
        if (lead && lead.stage === "Quoting" && !otherOpen) {
          lead.stage = "Lost"
          lead.stageSince = TODAY
          lead.winProb = 0
          lead.activity.push(act("System", `Loss recorded on ${q.id} (${reason.trim()}). Stage Quoting → Lost`))
        }
      }),
    revise: (qtId: string) =>
      mutate((db) => {
        const q = db.quotations.find((x) => x.id === qtId)!
        if (q.status !== "Issued") throw new ProtoError("Revise is available on Issued quotations only.")
        const base = q.id.replace(/-V\d+$/, "")
        const nid = `${base}-V${q.version + 1}`
        db.quotations.unshift({ ...structuredClone(q), id: nid, version: q.version + 1, status: "Draft", predecessor: q.id, successor: undefined, activity: [act(getRole(), `Revision created from ${q.id}`)] })
        q.status = "Superseded"
        q.successor = nid
        const lead = db.leads.find((l) => l.id === q.leadId || l.quotationIds.includes(q.id))
        if (lead && !lead.quotationIds.includes(nid)) lead.quotationIds.push(nid)
        q.activity.push(act(getRole(), `Revised to ${nid}. Status Issued → Superseded`))
        return nid
      }),
    convert: (qtId: string) =>
      mutate((db) => {
        const q = db.quotations.find((x) => x.id === qtId)!
        if (q.status !== "Won") throw new ProtoError("Convert to order is available only on a Won quotation (R-8).")
        if (q.orderRef) throw new ProtoError(`Already converted to ${q.orderRef}.`)
        const c = db.customers.find((x) => x.id === q.customerId)!
        const id = nextSO(db)
        const reqShip = "2026-10-12" // design value: the quotation carries no requested ship date in the seed
        const o: SalesOrder = {
          id,
          customerId: c.id,
          customerPO: "",
          quoteRef: q.id,
          type: "MTS",
          directEntry: false,
          billTo: c.billTo,
          shipTo: c.shipTo,
          requestedShip: reqShip,
          incoterms: c.incoterms,
          freightTerms: c.incoterms === "EXW" ? "Customer-paid" : "PE-paid",
          billingPlan: "Single invoice at goods issue",
          currency: c.currency,
          bookedRate: c.currency === "CAD" ? "1.3600 CAD per USD" : "1.0000",
          status: "Draft",
          created: TODAY,
          lines: q.lines.map((l) => ({
            no: l.no,
            item: l.item,
            qty: l.qty,
            unitPrice: l.price,
            priceSource: "Quotation" as const,
            requestedShip: reqShip,
            warehouse: "WH-TBD-01 Fargo, ND",
            status: "Open",
            schedules: [{ no: 10, reqQty: l.qty, reqDate: reqShip, deliveredQty: 0, cancelledQty: 0, backorder: false, status: "Open" }],
          })),
          creditChecks: [],
          activity: [act(getRole(), `Created in Draft from ${q.id}: lines, prices (Price Source = Quotation, frozen) and configuration copied`)],
        }
        const chk = runCreditCheck(db, o, "at quote-to-order conversion")
        o.activity.push(
          act(
            "System",
            chk.passLimit && chk.passPastDue
              ? "Credit check at conversion: passed"
              : "Credit check at conversion: failed. Status stays Draft: the status table has no Draft → Credit Hold transition (Reading OQ-32)",
          ),
        )
        db.orders.unshift(o)
        q.orderRef = id
        q.activity.push(act(getRole(), `Converted to ${id}. Quotation locked with order cross-reference`))
        return id
      }),
    setPO: (soId: string, po: string) =>
      mutate((db) => {
        const o = findOrder(db, soId)
        if (o.status !== "Draft") throw new ProtoError("Customer PO # can be edited on a Draft order only.")
        o.customerPO = po
      }),
    submit: (soId: string) =>
      mutate((db) => {
        const o = findOrder(db, soId)
        if (o.status !== "Draft") throw new ProtoError("Only a Draft order can be submitted.")
        if (!o.customerPO.trim()) throw new ProtoError("Customer PO # is required. Enter the customer's purchase order number, then submit again (R-7).", "customerPO")
        const c = db.customers.find((x) => x.id === o.customerId)!
        if (c.status !== "Active")
          throw new ProtoError(
            `E-OM-02: customer ${c.id} is ${c.status}. Only Active customers can be on a sales order. The order stays in Draft; ask the customer master owner to reactivate the customer, or choose an Active customer on a new order.`,
            "customer",
          )
        o.status = "Submitted"
        o.activity.push(act(getRole(), "Submitted. Status Draft → Submitted"))
        const value = orderValue(o)
        if (o.directEntry && !o.quoteRef && value > 250000) {
          db.approvals.unshift({
            id: `APR-TBD-${String(db.seq.appr++).padStart(4, "0")}`,
            kind: "R-OM-02 no-quote order",
            soId: o.id,
            amount: value,
            currency: o.currency,
            forRoles: ["Sales Director"],
            reason: `Direct-entry order above $250,000.00 without a quotation`,
            raised: TODAY,
          })
          o.activity.push(act("System", `Above $250,000.00 without a quote: Sales Director approval requested (R-OM-02). Order stays Submitted (Reading OQ-31)`))
          return "sd"
        }
        if (o.directEntry && !o.quoteRef) o.activity.push(act("System", `No Sales Director item: ${money(value, o.currency)} is not above $250,000.00 (R-5)`))
        return applyCreditOutcome(db, o, "at submit", getRole())
      }),
    decide: (apprId: string, decision: "release" | "reject" | "approve" | "raise", newLimit?: number) =>
      mutate((db) => {
        const role = getRole()
        const a = db.approvals.find((x) => x.id === apprId)!
        if (a.decided) throw new ProtoError("This item is already decided.")
        if (!a.forRoles.includes(role)) throw new ProtoError(`This item is not in the ${role} queue.`)
        const o = findOrder(db, a.soId)
        const on = listDate(TODAY)
        if (a.kind === "Credit Release") {
          if (decision === "release") {
            if (role !== "Finance (credit)") throw new ProtoError("Release is a Finance (credit) action (Reading OQ-33).")
            o.status = "Confirmed"
            a.decided = { text: `Released by Finance (credit) on ${on}`, on: TODAY }
            o.activity.push(act(role, `Released by Finance (credit) on ${on}. Status Credit Hold → Confirmed`))
          } else if (decision === "reject") {
            if (role !== "Finance (credit)") throw new ProtoError("Reject is a Finance (credit) action.")
            o.status = "Cancelled"
            for (const l of o.lines) {
              l.status = "Cancelled"
              for (const s of l.schedules) {
                s.status = "Cancelled"
                s.cancelledQty = s.reqQty
              }
            }
            const c = db.customers.find((x) => x.id === o.customerId)!
            c.exposure = Math.max(0, c.exposure - orderValue(o))
            a.decided = { text: `Rejected by Finance (credit) on ${on}. Order set to Cancelled (Reading OQ-28)`, on: TODAY }
            o.activity.push(act(role, `Rejected by Finance (credit) on ${on}. Status Credit Hold → Cancelled (Reading OQ-28)`))
          } else if (decision === "raise") {
            if (role !== "Controller") throw new ProtoError("Raise limit is Controller only (R-2, Reading OQ-33).")
            const c = db.customers.find((x) => x.id === o.customerId)!
            if (!newLimit || newLimit <= c.creditLimit) throw new ProtoError(`Enter a new limit above the current ${money(c.creditLimit, c.currency)}.`, "limit")
            const old = c.creditLimit
            c.creditLimit = newLimit
            const passLimit = c.exposure <= newLimit && !c.creditHold
            const passPast = !c.pastDue30
            o.creditChecks.push({ at: TODAY, when: "after limit raise", exposure: c.exposure - orderValue(o), orderValue: orderValue(o), limit: newLimit, pastDue30: c.pastDue30, passLimit, passPastDue: passPast })
            if (!passLimit || !passPast) throw new ProtoError(`Credit check still fails at ${money(newLimit, c.currency)}${passPast ? "" : ": invoice more than 30 days past due"}. Nothing changed.`)
            o.status = "Confirmed"
            a.decided = { text: `Limit raised by Controller on ${on} (${money(old, c.currency)} → ${money(newLimit, c.currency)}); credit check passed`, on: TODAY }
            o.activity.push(act(role, `Credit limit raised ${money(old, c.currency)} → ${money(newLimit, c.currency)}. Credit check passed. Status Credit Hold → Confirmed`))
          }
        } else {
          if (role !== "Sales Director") throw new ProtoError("R-OM-02 items are decided by the Sales Director.")
          if (decision === "approve") {
            a.decided = { text: `Approved by Sales Director on ${on}`, on: TODAY }
            o.activity.push(act(role, `Approved by Sales Director on ${on} (R-OM-02)`))
            applyCreditOutcome(db, o, "after Sales Director approval", role)
          } else if (decision === "reject") {
            o.status = "Rejected"
            a.decided = { text: `Rejected by Sales Director on ${on}. Order set to Rejected (K-15)`, on: TODAY }
            o.activity.push(act(role, `Rejected by Sales Director on ${on}. Status Submitted → Rejected (K-15)`))
          }
        }
      }),
    atpCheck: (soId: string, db: DB) => {
      const o = db.orders.find((x) => x.id === soId)!
      return o.lines
        .filter((l) => l.schedules.some((s) => s.status === "Open"))
        .map((l) => ({ line: l.no, item: l.item, qty: l.schedules.filter((s) => s.status === "Open").reduce((a, s) => a + s.reqQty, 0), avail: db.atp[l.item] ?? 0 }))
    },
    confirmATP: (soId: string, choice: "later" | "split" | "backorder") =>
      mutate((db) => {
        const role = getRole()
        const o = findOrder(db, soId)
        if (o.status !== "Confirmed") throw new ProtoError("Confirm (ATP) runs on a Confirmed order. Release any credit hold first.")
        if (o.type !== "MTS") throw new ProtoError("This order is not MTS: Confirm runs CTP. Use the promise dialog.")
        for (const l of o.lines) {
          for (const s of [...l.schedules]) {
            if (s.status !== "Open") continue
            const avail = db.atp[l.item] ?? 0
            const peg = (sc: Schedule, qty: number) => {
              sc.status = "Allocated/Pegged"
              sc.peg = `Stock ${l.item}, ${l.warehouse}`
              db.atp[l.item] = (db.atp[l.item] ?? 0) - qty
              const free = db.serials.filter((x) => x.item === l.item && x.status === "Available").slice(0, qty)
              for (const ser of free) {
                ser.status = "Reserved"
                ser.peg = `${o.id}/${l.no}/${sc.no}`
              }
            }
            const confirmAt = (sc: Schedule, qty: number, date: string, constraint: string) => {
              sc.status = "Confirmed"
              sc.confQty = qty
              sc.confDate = date
              sc.constraint = constraint
              sc.snapshot = "PLN-SNAP-TBD-0919"
            }
            if (avail >= s.reqQty) {
              confirmAt(s, s.reqQty, s.reqDate, "on-hand stock")
              peg(s, s.reqQty)
              o.activity.push(act(role, `ATP line ${l.no} schedule ${s.no}: ${s.reqQty} available. Open → Confirmed → Allocated/Pegged (Reading OQ-32)`))
            } else {
              const later = ATP_LATER_DATE[l.item] ?? { date: addDays(s.reqDate, 21), constraint: "incoming stock from production order" }
              if (choice === "later" || avail === 0) {
                confirmAt(s, s.reqQty, later.date, later.constraint)
                o.activity.push(act(role, `ATP line ${l.no} schedule ${s.no}: short. Accepted later date ${later.date}. Open → Confirmed`))
              } else {
                const rest = s.reqQty - avail
                s.reqQty = avail
                confirmAt(s, avail, s.reqDate, "on-hand stock")
                peg(s, avail)
                const ns: Schedule = { no: s.no + 10, reqQty: rest, reqDate: s.reqDate, deliveredQty: 0, cancelledQty: 0, backorder: true, status: "Open" }
                if (choice === "split") confirmAt(ns, rest, later.date, later.constraint)
                l.schedules.push(ns)
                o.activity.push(
                  act(
                    role,
                    choice === "split"
                      ? `ATP line ${l.no}: ${avail} of ${avail + rest} available. Split: schedule ${s.no} (qty ${avail}) Open → Confirmed → Allocated/Pegged; schedule ${ns.no} (qty ${rest}) Confirmed at ${later.date}, Backorder flag on`
                      : `ATP line ${l.no}: ${avail} of ${avail + rest} available. Backorder: schedule ${s.no} (qty ${avail}) Allocated/Pegged; schedule ${ns.no} (qty ${rest}) Open, Backorder flag on`,
                  ),
                )
              }
            }
          }
          const dates = l.schedules.map((s) => s.confDate).filter(Boolean) as string[]
          if (dates.length) l.promisedShip = dates.sort().at(-1)
        }
      }),
    ctpDecide: (soId: string, decision: "accept" | "decline" | "review") =>
      mutate((db) => {
        const o = findOrder(db, soId)
        const s = o.lines[0].schedules[0]
        if (decision === "accept") {
          if (s.status !== "Open") throw new ProtoError("The promise was already decided.")
          s.status = "Confirmed"
          s.confQty = s.reqQty
          s.confDate = "2026-12-18"
          s.constraint = "Test bay capacity, weeks 47 to 49"
          s.snapshot = "PLN-SNAP-TBD-0921"
          o.lines[0].promisedShip = "2026-12-18"
          o.activity.push(act(getRole(), "CTP promise accepted: Dec 18, 2026, binding constraint test bay capacity weeks 47 to 49. Schedule 10 Open → Confirmed"))
        } else if (decision === "decline") {
          o.activity.push(act(getRole(), "CTP promise declined; soft reservation released. Schedule stays Open"))
        } else {
          o.activity.push(act(getRole(), "CTP: planner review requested (stub; planning screens not built)"))
        }
      }),
    createDeliveries: () =>
      mutate((db) => {
        const role = getRole()
        const horizonEnd = addDays(TODAY, HORIZON_DAYS)
        const created: string[] = []
        for (const o of db.orders) {
          if (!["Confirmed", "In Fulfillment", "Partially Shipped"].includes(o.status)) continue
          const due: { line: number; s: Schedule }[] = []
          let laterExists = false
          for (const l of o.lines)
            for (const s of l.schedules) {
              if (s.status === "Allocated/Pegged" && s.confDate && s.confDate <= horizonEnd && !s.deliveryId) due.push({ line: l.no, s })
              else if (["Confirmed", "Allocated/Pegged"].includes(s.status) && !s.deliveryId) laterExists = true
            }
          if (!due.length) continue
          const id = `DLV-TBD-${String(db.seq.dlv++).padStart(4, "0")}`
          const rule = laterExists ? "Split, elective: schedules more than 7 days apart" : "Grouped: same ship-to and Incoterms, all schedules due in the horizon"
          const d: Delivery = {
            id,
            soId: o.id,
            customerId: o.customerId,
            shipTo: o.shipTo,
            incoterms: o.incoterms,
            status: "Planned",
            rule,
            ruleId: "RULE-TBD",
            refs: due.map((x) => ({ soId: o.id, line: x.line, sched: x.s.no, qty: x.s.confQty ?? x.s.reqQty })),
            flags: { supply: "passed", credit: "not passed", quality: "not passed", documents: "not passed" },
            permits: [],
            freight: null,
            freightPaidBy: o.freightTerms,
            warehouse: "WH-TBD-01 Fargo, ND",
            activity: [act(role, `Delivery created at Planned by on-demand delivery creation. Grouped by: ${rule} (RULE-TBD)`)],
          }
          for (const x of due) {
            x.s.status = "Delivery Due"
            x.s.deliveryId = id
            for (const ser of db.serials) if (ser.peg === `${o.id}/${x.line}/${x.s.no}`) ser.deliveryId = id
          }
          o.activity.push(act(role, `Delivery ${id} created. Schedule lines ${due.map((x) => `${x.line}/${x.s.no}`).join(", ")} → Delivery Due`))
          db.deliveries.unshift(d)
          created.push(id)
        }
        if (!created.length) throw new ProtoError(`No allocated schedule lines are due within the ${HORIZON_DAYS}-day horizon (to ${listDate(horizonEnd)}). Nothing was created.`)
        return created
      }),
    release: (dlvId: string) =>
      mutate((db) => {
        const d = findDelivery(db, dlvId)
        if (d.status !== "Planned") throw new ProtoError("Release to warehouse applies to a Planned delivery.")
        const o = findOrder(db, d.soId)
        const c = db.customers.find((x) => x.id === o.customerId)!
        if (o.status === "Credit Hold" || c.creditHold)
          throw new ProtoError(`Shipment-release credit gate failed for ${o.id}: ${c.creditHold ? "customer credit hold flag is set" : "order is on Credit Hold"}. Sales roles cannot bypass this gate (R-12). Finance must release it in the Approvals inbox.`)
        d.flags.credit = "passed"
        d.status = "Released"
        d.activity.push(act(getRole(), `Shipment-release credit gate passed${o.activity.some((a) => a.text.startsWith("Released by Finance")) ? " (credit hold released by Finance (credit))" : ""}. Status Planned → Released`))
        if (o.status === "Confirmed") {
          o.status = "In Fulfillment"
          o.activity.push(act(getRole(), `${d.id} released to warehouse. Status Confirmed → In Fulfillment (Reading OQ-32)`))
        }
        for (const l of o.lines) if (["Open"].includes(l.status)) l.status = "Ready to Ship"
      }),
    confirmPick: (dlvId: string) =>
      mutate((db) => {
        const d = findDelivery(db, dlvId)
        if (d.status !== "Released") throw new ProtoError("Confirm pick applies to a Released delivery.")
        d.status = "Picking"
        d.activity.push(act(getRole(), "Pick confirmed (SP-15 stub). Status Released → Picking"))
      }),
    createHU: (dlvId: string) =>
      mutate((db) => {
        const d = findDelivery(db, dlvId)
        if (d.status !== "Picking") throw new ProtoError("HUs are created while the delivery is at Picking.")
        const units = d.refs.reduce((s, r) => s + r.qty, 0)
        const existing = db.hus.filter((h) => h.deliveryId === d.id)
        if (existing.length >= units) throw new ProtoError(`All ${units} transformers already have an HU. One transformer serial per primary HU.`)
        // next item without HU
        const items: string[] = []
        for (const r of d.refs) {
          const l = findOrder(db, r.soId).lines.find((x) => x.no === r.line)!
          for (let i = 0; i < r.qty; i++) items.push(l.item)
        }
        for (const h of existing) items.splice(items.indexOf(h.item), 1)
        const item = items[0]
        const n = db.seq.hu++
        const id = `HU-TBD-${String(n).padStart(4, "0")}`
        db.hus.push({ id, sscc: `0006141410000${String(1828 + n).padStart(5, "0")}`, deliveryId: d.id, item, expectedKg: product(item).huKg, status: "Open", labelPrinted: false, scaleAttempts: 0 })
        return id
      }),
    scanSerial: (dlvId: string, huId: string, code: string) =>
      mutate((db) => {
        const hu = db.hus.find((h) => h.id === huId)
        const v = code.trim().toUpperCase()
        if (!hu) throw new ProtoError("No HU selected. Create an HU first, then scan the serial.")
        if (hu.status !== "Open") throw new ProtoError(`${hu.id} is ${hu.status}. Scan serials into an Open HU.`)
        if (hu.serial) throw new ProtoError(`${hu.id} already holds ${hu.serial}. One transformer serial per primary HU. Create the next HU.`)
        const ser = db.serials.find((s) => s.id === v)
        if (!ser) throw new ProtoError(`SP-16 scan failed: "${code}" is not a known serial. Expected one of this pack order's reserved serials. Scan again.`)
        if (ser.deliveryId !== dlvId || ser.status !== "Reserved")
          throw new ProtoError(`SP-16 scan failed: ${ser.id} is ${ser.status}${ser.deliveryId ? ` on ${ser.deliveryId}` : ""}, not reserved for ${dlvId}. Scan a serial listed on the left.`)
        if (db.hus.some((h) => h.serial === ser.id)) throw new ProtoError(`SP-16 scan failed: ${ser.id} is already packed in another HU.`)
        if (ser.item !== hu.item) throw new ProtoError(`SP-16 scan failed: ${ser.id} is ${ser.item}; ${hu.id} expects ${hu.item}.`)
        hu.serial = ser.id
        return ser.id
      }),
    nextReading: (huId: string) =>
      mutate((db) => {
        const hu = db.hus.find((h) => h.id === huId)!
        const idx = db.hus.filter((h) => h.deliveryId === hu.deliveryId).indexOf(hu)
        const first = hu.scaleAttempts === 0
        hu.scaleAttempts++
        hu.actualKg = idx === 2 && first ? Math.round(hu.expectedKg * 1.02552) : Math.round(hu.expectedKg * (1 - 0.0012 * hu.scaleAttempts))
        return hu.actualKg
      }),
    closeHU: (huId: string) =>
      mutate((db) => {
        const hu = db.hus.find((h) => h.id === huId)!
        if (hu.status !== "Open") throw new ProtoError(`${hu.id} is already ${hu.status}.`)
        if (!hu.serial) throw new ProtoError(`Scan the transformer serial into ${hu.id} before closing it (SP-16).`)
        if (hu.actualKg == null) throw new ProtoError("No scale reading yet. Take a reading, then close the HU.")
        const dev = (hu.actualKg - hu.expectedKg) / hu.expectedKg
        if (Math.abs(dev) > 0.02)
          throw new ProtoError(
            `HU not closed: scale weight ${hu.actualKg.toLocaleString("en-US")} kg is ${(dev * 100).toFixed(1)}% from expected ${hu.expectedKg.toLocaleString("en-US")} kg; allowed ±2% (SP-17). Check the contents and re-weigh, then close again.`,
          )
        hu.status = "Closed"
        hu.labelPrinted = true
        const d = findDelivery(db, hu.deliveryId)
        d.activity.push(act(getRole(), `${hu.id} closed at ${hu.actualKg.toLocaleString("en-US")} kg (within ±2%). HU label printed. Posting #27 DR 5120 Packaging / CR 1360 Packaging on Hand`))
      }),
    reopenHU: (huId: string, reason: string) =>
      mutate((db) => {
        const hu = db.hus.find((h) => h.id === huId)!
        if (hu.status !== "Closed") throw new ProtoError("Reopen is allowed on a Closed HU, until it is Loaded (R-17).")
        if (!reason.trim()) throw new ProtoError("A reason is required to reopen an HU.", "reason")
        const d = findDelivery(db, hu.deliveryId)
        if (d.status !== "Picking") throw new ProtoError(`Delivery ${d.id} is ${d.status}; reopen while the pack order is open.`)
        hu.status = "Open"
        hu.actualKg = undefined
        hu.scaleAttempts = 0
        d.activity.push(act(getRole(), `${hu.id} reopened. Reason: ${reason.trim()}`))
      }),
    completePack: (dlvId: string) =>
      mutate((db) => {
        const d = findDelivery(db, dlvId)
        const units = d.refs.reduce((s, r) => s + r.qty, 0)
        const hus = db.hus.filter((h) => h.deliveryId === d.id)
        if (hus.length < units || hus.some((h) => h.status !== "Closed"))
          throw new ProtoError(`Pack order not complete: ${hus.filter((h) => h.status === "Closed").length} of ${units} HUs closed. Close every HU, then complete.`)
        d.status = "Packed"
        d.activity.push(act(getRole(), "Pack order completed. Status Picking → Packed (Reading OQ-32)"))
      }),
    passInspection: (dlvId: string) =>
      mutate((db) => {
        const d = findDelivery(db, dlvId)
        if (d.status !== "Packed") throw new ProtoError("Pre-shipment inspection is passed on a Packed delivery.")
        d.status = "Quality Cleared"
        d.flags.quality = "passed"
        d.activity.push(act(getRole(), "Pre-shipment inspection passed (QM-EXEC stub). Status Packed → Quality Cleared. Readiness flag quality: passed"))
      }),
    saveLoadPlan: (dlvId: string, f: { equipment: string; door: string; slot: string; carrier: string; pro: string; transitDays: number | undefined; freight: number | null; permits: string[] }) =>
      mutate((db) => {
        const d = findDelivery(db, dlvId)
        if (["PGI", "Delivered/Closed"].includes(d.status)) throw new ProtoError("The load plan is locked after PGI.")
        Object.assign(d, f)
        d.flags.documents = f.carrier.trim() && f.pro.trim() ? "passed" : "not passed"
        d.activity.push(act(getRole(), `Load plan saved: ${f.equipment || "equipment not set"}, dock door ${f.door || "-"}, slot ${f.slot || "-"}, carrier ${f.carrier || "not recorded"}, ${f.pro || "PRO/BOL not recorded"}. Documents flag: ${d.flags.documents} (Reading OQ-32)`))
      }),
    loadScan: (dlvId: string, code: string) =>
      mutate((db) => {
        const d = findDelivery(db, dlvId)
        const v = code.trim().toUpperCase()
        if (!["Quality Cleared", "Loaded"].includes(d.status)) throw new ProtoError(`Load scanning opens after pre-shipment inspection (delivery is ${d.status}).`)
        const hu = db.hus.find((h) => h.id === v || h.sscc === v)
        if (!hu || hu.deliveryId !== d.id)
          throw new ProtoError(`E-BC-08: ${code.trim() || "(empty scan)"} is not on this shipment. ${hu ? `It belongs to ${hu.deliveryId}. ` : ""}Expected one of: ${db.hus.filter((h) => h.deliveryId === d.id).map((h) => h.id).join(", ")}. Take the unit off the truck and scan the right HU.`)
        if (hu.status === "Open") throw new ProtoError(`${hu.id} is Open. Close it at the pack station before loading.`)
        if (hu.status === "Closed") hu.status = "Loaded"
        const all = db.hus.filter((h) => h.deliveryId === d.id)
        if (all.every((h) => h.status === "Loaded") && d.status === "Quality Cleared") {
          d.status = "Loaded"
          d.activity.push(act(getRole(), "All HUs scanned at the truck (SP-18). Status Quality Cleared → Loaded"))
        }
        return hu.id
      }),
    pgi: (dlvId: string) =>
      mutate((db) => {
        const role = getRole()
        const d = findDelivery(db, dlvId)
        if (d.status !== "Loaded") throw new ProtoError("Post goods issue needs the delivery at Loaded.")
        const fail = failingFlags(d)
        if (fail.length) throw new ProtoError(`Post goods issue blocked: readiness flags not passed: ${fail.join(", ")} (R-12).`)
        if (d.forcePgiFail)
          throw new ProtoError("Goods issue not posted. Nothing changed: stock, serials, ledger and invoice request are as they were. Reason: posting service unavailable (simulated). Try again, or leave the delivery at Loaded.")
        const prev = postingPreview(db, d)
        const o = findOrder(db, d.soId)
        const num = d.id.slice(-4)
        d.status = "PGI"
        d.shipDate = TODAY
        d.pgiId = `PGI-TBD-${num}`
        d.pgiPeriod = OPEN_PERIOD
        d.irId = `IR-TBD-${String(db.seq.ir++).padStart(4, "0")}`
        d.irWithdrawn = false
        for (const h of db.hus) if (h.deliveryId === d.id) h.status = "Shipped"
        for (const s of db.serials) if (s.deliveryId === d.id) s.status = "Shipped"
        for (const r of d.refs) {
          const l = o.lines.find((x) => x.no === r.line)!
          const s = l.schedules.find((x) => x.no === r.sched)!
          s.deliveredQty += r.qty
          s.status = s.deliveredQty >= (s.confQty ?? s.reqQty) ? "Delivered" : "Partially Delivered"
        }
        syncLineAndOrderAfterDelivery(o)
        const podId = `POD-TBD-${num}`
        const exp = addDays(TODAY, d.transitDays ?? 0)
        db.pods = db.pods.filter((p) => p.id !== podId)
        db.pods.unshift({ id: podId, deliveryId: d.id, status: "Expected", expectedDate: exp, milestoneFired: false, activity: [act("System", `POD row created at Expected; expected date ${exp} = ship date + ${d.transitDays ?? 0} transit days`)] })
        d.activity.push(
          act(role, `Goods issue posted ${d.pgiId} in period ${OPEN_PERIOD}. Status Loaded → PGI. HUs → Shipped. Serials Reserved → Shipped. ${prev.p25.text}: ${money(prev.p25.amount)}. ${prev.p26.amount == null ? prev.p26.text : `${prev.p26.text}: ${money(prev.p26.amount)}`}`),
          act("System", `Invoice request ${d.irId} created at PGI and handed to Finance (ACC)`),
        )
        o.activity.push(act(role, `${d.id} goods issue posted. Order status now ${o.status}. Invoice request ${d.irId} created at PGI`))
        return d.pgiId
      }),
    reversePGI: (dlvId: string, reason: string) =>
      mutate((db) => {
        const role = getRole()
        const d = findDelivery(db, dlvId)
        const block = reversalBlock(db, d, role)
        if (block) throw new ProtoError(block)
        if (!reason.trim()) throw new ProtoError("A reason is required to reverse PGI.", "reason")
        const o = findOrder(db, d.soId)
        d.status = "Packed"
        for (const h of db.hus) if (h.deliveryId === d.id) h.status = "Loaded"
        for (const s of db.serials) if (s.deliveryId === d.id) s.status = "Reserved"
        for (const r of d.refs) {
          const l = o.lines.find((x) => x.no === r.line)!
          const s = l.schedules.find((x) => x.no === r.sched)!
          s.deliveredQty = Math.max(0, s.deliveredQty - r.qty)
          s.status = s.deliveredQty > 0 ? "Partially Delivered" : "Delivery Due"
          l.status = l.schedules.some((x) => x.deliveredQty > 0) ? "Partially Shipped" : "Ready to Ship"
        }
        o.status = o.lines.some((l) => l.status === "Partially Shipped" || l.status === "Shipped") ? "Partially Shipped" : "In Fulfillment"
        d.irWithdrawn = true
        db.pods = db.pods.filter((p) => !(p.deliveryId === d.id && p.status === "Expected"))
        d.activity.push(
          act(role, `PGI ${d.pgiId} reversed. Reason: ${reason.trim()}. Mirror of #25/#26/#27 posted. Serials Shipped → Reserved; HUs → Loaded; status PGI → Packed`),
          act("System", `Invoice request ${d.irId} withdrawn`),
        )
        o.activity.push(act(role, `${d.id} PGI reversed. Order status now ${o.status}`))
      }),
    recordPOD: (podId: string, f: { receiver: string; date: string; condition: string; notes: string; docName: string; claimType?: "shortage" | "damage" | "refusal"; claimQty?: number; claimValue?: number; carrierRef?: string }) =>
      mutate((db) => {
        const p = db.pods.find((x) => x.id === podId)!
        if (p.status !== "Expected") throw new ProtoError(`POD ${p.id} is ${p.status}; it is recorded once.`)
        if (!f.receiver.trim()) throw new ProtoError("Receiver name is required.", "receiver")
        if (!f.date) throw new ProtoError("POD date is required.", "date")
        const d = findDelivery(db, p.deliveryId)
        Object.assign(p, { receiver: f.receiver.trim(), date: f.date, condition: f.condition, notes: f.notes, docName: f.docName || undefined })
        if (!p.milestoneFired) {
          p.milestoneFired = true
          p.activity.push(act("System", "Delivery/Commissioning milestone fired (exactly once)"))
        }
        if (f.condition === "No damage") {
          p.status = "Received"
          d.status = "Delivered/Closed"
          p.activity.push(act(getRole(), `POD recorded: received by ${p.receiver} on ${f.date}, no damage. Status Expected → Received`))
          d.activity.push(act(getRole(), `POD ${p.id} received. Status PGI → Delivered/Closed`))
        } else {
          if (!f.carrierRef?.trim()) throw new ProtoError("Carrier claim reference is required to open a claim.", "carrierRef")
          if (!f.claimQty && !f.claimValue) throw new ProtoError("Enter the claim quantity or value.", "claimValue")
          p.status = "Exception"
          p.claim = { id: `CLM-TBD-${String(db.seq.clm++).padStart(4, "0")}`, type: f.claimType ?? "damage", qty: f.claimQty, value: f.claimValue, carrierRef: f.carrierRef.trim() }
          p.activity.push(act(getRole(), `POD recorded with exception (${f.condition}). Claim ${p.claim.id} opened. Status Expected → Exception`))
        }
      }),
    resolveClaim: (podId: string, resolution: string) =>
      mutate((db) => {
        const p = db.pods.find((x) => x.id === podId)!
        if (p.status !== "Exception" || !p.claim) throw new ProtoError("Only a POD at Exception with a claim can be resolved.")
        p.claim.resolution = resolution
        p.status = "Resolved/Closed"
        const d = findDelivery(db, p.deliveryId)
        d.status = "Delivered/Closed"
        p.activity.push(act(getRole(), `Claim ${p.claim.id} resolution: ${resolution} (stub). Status Exception → Resolved/Closed`))
        d.activity.push(act(getRole(), `Claim resolved on ${p.id}. Status PGI → Delivered/Closed (Reading OQ-32)`))
      }),
    simulateInvoice: (soId: string) =>
      mutate((db) => {
        const o = findOrder(db, soId)
        if (o.status !== "Shipped") throw new ProtoError("Simulate invoice posted applies to a Shipped order.")
        o.invoicePosted = true
        o.status = "Invoiced/Closed"
        o.closedOn = TODAY
        for (const l of o.lines)
          if (l.status === "Shipped") {
            l.status = "Invoiced"
            for (const s of l.schedules) if (s.status === "Delivered") s.status = "Closed"
          }
        o.activity.push(act("ACC (simulated)", "Invoice posted (simulated, ACC). Status Shipped → Invoiced/Closed. Lines → Invoiced; schedules Delivered → Closed (Reading OQ-32)"))
      }),
    createDirectOrder: (f: { customerId: string; customerPO: string; requestedShip: string; lines: { item: string; qty: number }[] }) =>
      mutate((db) => {
        const c = db.customers.find((x) => x.id === f.customerId)
        if (!c) throw new ProtoError("Choose a customer.", "customer")
        if (c.status !== "Active") throw new ProtoError(`E-OM-02: ${c.name} is ${c.status}. Only Active customers can be on a sales order.`, "customer")
        const lines = f.lines.filter((l) => l.item && l.qty > 0)
        if (!lines.length) throw new ProtoError("Add at least one line with an item and a quantity.", "lines")
        const id = nextSO(db)
        const cad = c.currency === "CAD"
        db.orders.unshift({
          id,
          customerId: c.id,
          customerPO: f.customerPO,
          type: "MTS",
          directEntry: true,
          billTo: c.billTo,
          shipTo: c.shipTo,
          requestedShip: f.requestedShip,
          incoterms: c.incoterms,
          freightTerms: c.incoterms === "EXW" ? "Customer-paid" : "PE-paid",
          billingPlan: "Single invoice at goods issue",
          currency: c.currency,
          bookedRate: cad ? "1.3600 CAD per USD" : "1.0000",
          status: "Draft",
          created: TODAY,
          lines: lines.map((l, i) => ({
            no: (i + 1) * 10,
            item: l.item,
            qty: l.qty,
            unitPrice: cad ? Math.round(product(l.item).unitPrice * 1.36) : product(l.item).unitPrice,
            priceSource: "Price list" as const,
            requestedShip: f.requestedShip,
            warehouse: "WH-TBD-01 Fargo, ND",
            status: "Open",
            schedules: [{ no: 10, reqQty: l.qty, reqDate: f.requestedShip, deliveredQty: 0, cancelledQty: 0, backorder: false, status: "Open" }],
          })),
          creditChecks: [],
          activity: [act(getRole(), "Direct-entry order created in Draft (no quotation)")],
        })
        return id
      }),
  }
}

function applyCreditOutcome(db: DB, o: SalesOrder, when: string, role: string) {
  const chk = runCreditCheck(db, o, when)
  const c = db.customers.find((x) => x.id === o.customerId)!
  c.exposure += chk.orderValue // the order now counts in exposure; available credit may go negative
  if (chk.passLimit && chk.passPastDue) {
    o.status = "Confirmed"
    o.activity.push(act("System", `Credit check ${when}: passed (both tests). Status Submitted → Confirmed`))
    return "confirmed"
  }
  o.status = "Credit Hold"
  const why = [!chk.passLimit && (c.creditHold ? "customer credit hold flag set" : "exposure + order value above credit limit"), !chk.passPastDue && "invoice more than 30 days past due"].filter(Boolean).join("; ")
  const appr: Approval = {
    id: `APR-TBD-${String(db.seq.appr++).padStart(4, "0")}`,
    kind: "Credit Release",
    soId: o.id,
    amount: chk.orderValue,
    currency: o.currency,
    forRoles: ["Finance (credit)", "Controller"],
    reason: `Credit check failed: ${why}`,
    raised: TODAY,
  }
  db.approvals.unshift(appr)
  o.activity.push(act("System", `Credit check ${when}: failed (${why}). Status Submitted → Credit Hold. Credit release item sent to Finance`))
  void role
  return "hold"
}

// ----------------------------------------------------------------------------
type Actions = ReturnType<typeof makeActions>
let actionsSingleton: Actions | null = null
/** The FL-09 actions bound to the root store's "sales" slice and the app-wide acting role. */
export function salesActions(): Actions {
  if (actionsSingleton) return actionsSingleton
  const base = makeActions((fn) => store.mutate("sales", (db) => fn(db)), () => store.getCore().role)
  const db = () => store.getSlice("sales")
  // sales.orderConfirmed once the order reaches Confirmed; ETO / MTO lines also raise
  // sales.lineNeedsEngineering for engineering to open its request (consumer: engineering).
  const emitConfirmed = (soId: string) => {
    const o = db().orders.find((x) => x.id === soId)
    if (!o || o.status !== "Confirmed") return
    store.bus.emit("sales.orderConfirmed", { soId: soId as `SO-${string}`, type: o.type, lines: o.lines.map((l) => ({ no: l.no, itemId: l.item, qty: l.qty })) })
    if (o.type === "ETO" || o.type === "MTO") for (const l of o.lines) store.bus.emit("sales.lineNeedsEngineering", { soId: soId as `SO-${string}`, line: l.no, itemId: l.item })
  }
  // Cross-module events (foundation addition): emitted after the FL-09 action commits; the action
  // bodies are unchanged. Consumers: quality-trace (genealogy T11), purchasing-finance (postings).
  actionsSingleton = {
    ...base,
    recordWin: (qtId: string) => {
      const r = base.recordWin(qtId)
      if (r.ok) {
        const q = db().quotations.find((x) => x.id === qtId)!
        store.bus.emit("sales.quotationWon", { quotationId: qtId as `QT-${string}`, customerId: q.customerId as `CUS-${string}` })
      }
      return r
    },
    submit: (soId: string) => {
      const r = base.submit(soId)
      if (r.ok) emitConfirmed(soId)
      return r
    },

    pgi: (dlvId: string) => {
      const r = base.pgi(dlvId)
      if (r.ok) {
        const d = db().deliveries.find((x) => x.id === dlvId)!
        const prev = postingPreview(db(), d)
        const source = { type: "delivery" as const, id: dlvId }
        store.bus.emit("sales.pgiPosted", { deliveryId: dlvId as `DLV-${string}`, soId: d.soId as `SO-${string}`, serials: db().serials.filter((x) => x.deliveryId === dlvId).map((x) => x.id) })
        store.bus.emit("posting.posted", { template: 25, amount: prev.p25.amount, currency: "USD", source })
        if (prev.p26.amount != null) store.bus.emit("posting.posted", { template: 26, amount: prev.p26.amount, currency: "USD", source })
      }
      return r
    },
    closeHU: (huId: string) => {
      const r = base.closeHU(huId)
      if (r.ok) {
        const hu = db().hus.find((h) => h.id === huId)!
        store.bus.emit("posting.posted", { template: 27, amount: huPackagingCost(), currency: "USD", source: { type: "delivery", id: hu.deliveryId } })
      }
      return r
    },
    reversePGI: (dlvId: string, reason: string) => {
      const r = base.reversePGI(dlvId, reason)
      if (r.ok) store.bus.emit("sales.pgiReversed", { deliveryId: dlvId as `DLV-${string}`, reason })
      return r
    },
    recordPOD: (podId: string, f: Parameters<Actions["recordPOD"]>[1]) => {
      const r = base.recordPOD(podId, f)
      if (r.ok) {
        const p = db().pods.find((x) => x.id === podId)!
        store.bus.emit("sales.podRecorded", { podId: podId as `POD-${string}`, deliveryId: p.deliveryId as `DLV-${string}`, exception: p.status === "Exception" })
      }
      return r
    },
  }
  return actionsSingleton
}

/** Kept for the FL-09 pages: the provider is now a pass-through (state lives in the root store). */
export function StoreProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const db = useSlice("sales")
  const [role, setRole] = useRole()
  const actions = useMemo(() => salesActions(), [])
  return { db, role, setRole, actions, reset: () => store.reset() }
}
