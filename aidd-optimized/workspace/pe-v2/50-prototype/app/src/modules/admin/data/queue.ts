// Unified queue: one engine, no module-specific approvals [DOC:pp.10-12 §W; p.275 §15 "Every W.4 workflow routes here"].
// 1. Seed requests for the W.4 rows whose subject documents live in other modules (WF-03, 04, 09, 11, 13, 17, 19) and
//    mirror the FL-09 sales items (credit release, R-OM-02) onto the shared engine, so every one of them carries an SLA
//    clock, the C-2 delegation rule, recall rules and an audit trail. They are raised at start and again after a
//    Scenario reset (the reset wipes the shared engine, not this slice), once per admin seed.
// 2. Bridge the decided outcome of those two sales kinds back to the sales order, because the sales slice does not yet
//    listen for them (Request R-8). Every write is guarded: it applies only to a still-undecided FL-09 item, so it is a
//    no-op if the sales group adds its own consumer.

import type { Role } from "@/data/domain"
import { ProtoError, store, type Result, type StoreApi } from "@/store"

type Api = StoreApi

const money = (n: number, cur = "USD") => `${cur === "CAD" ? "CA$" : "$"}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`

/** Raise as the role that would have raised it, then give the seat back. */
function raiseAs(api: Api, role: Role, input: Parameters<Api["raiseApproval"]>[0]) {
  store.setRole(role)
  api.raiseApproval(input)
}

export function ensureSharedSeeds(api: Api = store.api) {
  if (api.getSlice("admin").sharedSeeded) return
  api.mutate("admin", (d) => {
    d.sharedSeeded = true
  })
  const before = store.getCore().role
  try {
    // WF-03 credit release and R-OM-02 no-quote orders: the FL-09 items, on the shared engine.
    const sales = api.getSlice("sales")
    for (const a of sales.approvals) {
      if (a.decided) continue
      const o = sales.orders.find((x) => x.id === a.soId)
      const c = o ? sales.customers.find((x) => x.id === o.customerId) : undefined
      if (a.kind === "Credit Release")
        raiseAs(api, "Sales admin", { kind: "Credit release", subject: { type: "salesOrder", id: a.soId }, title: `${a.soId} ${c?.name ?? ""}: ${a.reason}`, amount: a.amount, currency: a.currency, note: `Mirrors FL-09 item ${a.id}` })
      else
        raiseAs(api, "Sales admin", { kind: "No-quote sales order", subject: { type: "salesOrder", id: a.soId }, title: `${a.soId} ${c?.name ?? ""}: direct-entry order of ${money(a.amount, a.currency)} without a quotation`, amount: a.amount, currency: a.currency, note: `Mirrors FL-09 item ${a.id}` })
    }
    // WF-04 price floor breach.
    raiseAs(api, "Sales rep", {
      kind: "Below price floor", subject: { type: "quotation", id: "QT-TBD-0402-V1" }, title: "QT-TBD-0402-V1 line 30, spare gasket kit: margin 15.8% on PC-100, 6.2 points below the 22% floor",
      amount: 1_936_000, ctx: { pointsBelowFloor: 6.2 },
    })
    // WF-09 ECR / CCB decision (cost delta above $10,000 adds the Controller).
    raiseAs(api, "Engineer", { kind: "ECR (CCB)", subject: { type: "ecr", id: "ECR-2026-0016" }, title: "ECR-2026-0016 phase 2 HV BIL raised to 550 kV at customer request: CCB decision, cost delta $48,000", ctx: { costDelta: 48_000 } })
    // WF-11 EBOM / production version release.
    raiseAs(api, "Engineer", { kind: "EBOM release", subject: { type: "ebom", id: "EBOM-00312" }, title: "EBOM-00312 FIN-TBD-7500MTO rev A, Lakeshore North substation: In Review, release" })
    raiseAs(api, "Manufacturing engineer", { kind: "Production version release", subject: { type: "productionVersion", id: "PV-TBD-0292" }, title: "PV-TBD-0292 Draft to Released" })
    // WF-13 material change (class 2 field), WF-19 safety stock change above 25%.
    raiseAs(api, "Material steward", { kind: "Material change", subject: { type: "material", id: "MCH-2026-0036" }, title: "MCH-2026-0036 spare parts to profit center PC-400: class 2 field, simulation done" })
    raiseAs(api, "Planner", { kind: "Safety stock change", subject: { type: "material", id: "SSC-TBD-0007" }, title: "SSC-TBD-0007 SPARE-TBD-OLTCK at WH-TBD-03: safety stock 4 → 8 (+100%), service level change" })
    // WF-17 count variance: the two documents in Variance Review, amounts from their counted lines.
    const mats = api.hasSlice("materials") ? api.getSlice("materials") : undefined
    for (const c of mats?.countDocuments.filter((x) => x.status === "Variance Review") ?? []) {
      const per = c.lines.filter((l) => l.count != null).map((l) => Math.abs(((l.thirdCount ?? l.recount ?? l.count!) - (l.expected + l.interim)) * l.rate))
      const abs = Math.round(per.reduce((a, b) => a + b, 0) * 100) / 100
      raiseAs(api, "Warehouse supervisor", { kind: "Count variance", subject: { type: "material", id: c.id }, title: `${c.id} ${c.location}: absolute variance ${money(abs)}`, amount: abs, ctx: { lineAmount: Math.max(0, ...per) } })
    }
  } finally {
    store.setRole(before)
  }
}

// ---------------------------------------------------------------- bridge to the FL-09 sales items
const KIND_OF: Record<string, "Credit Release" | "R-OM-02 no-quote order"> = { "Credit release": "Credit Release", "No-quote sales order": "R-OM-02 no-quote order" }

/** The FL-09 item behind a mirrored request, if it is already decided (decided in sales, or by the bridge below). */
export function legacyOutcome(kind: string, soId: string): { outcome: "Approved" | "Rejected"; text: string } | undefined {
  const legacyKind = KIND_OF[kind]
  if (!legacyKind || !store.hasSlice("sales")) return undefined
  const a = store.getSlice("sales").approvals.find((x) => x.kind === legacyKind && x.soId === soId && x.decided)
  return a?.decided ? { outcome: a.decided.text.startsWith("Rejected") ? "Rejected" : "Approved", text: a.decided.text } : undefined
}

export function wireSalesBridge(api: Api) {
  api.on("approval.decided", ({ kind, subject, outcome, by }) => {
    if (subject.type !== "salesOrder" || !KIND_OF[kind]) return
    const when = store.getCore().approvals.find((a) => a.subject.id === subject.id && a.kind === kind)?.steps.at(-1)?.decided?.on ?? ""
    api.mutate("sales", (db, ctx) => {
      const a = db.approvals.find((x) => x.kind === KIND_OF[kind] && x.soId === subject.id && !x.decided)
      const o = db.orders.find((x) => x.id === subject.id)
      if (!a || !o) return
      const stamp = when || ctx.today
      const log = (text: string) => o.activity.push({ at: ctx.today, by, text })
      if (kind === "Credit release") {
        if (outcome === "Approved") {
          o.status = "Confirmed"
          a.decided = { text: `Released by Finance (credit) on ${stamp} (WF-INBOX)`, on: ctx.today }
          log(`Released by Finance (credit) in WF-INBOX. Status Credit Hold → Confirmed`)
          ctx.emit("sales.orderConfirmed", { soId: o.id as `SO-${string}`, type: o.type, lines: o.lines.map((l) => ({ no: l.no, itemId: l.item, qty: l.qty })) })
        } else {
          o.status = "Cancelled"
          for (const l of o.lines) {
            l.status = "Cancelled"
            for (const s of l.schedules) {
              s.status = "Cancelled"
              s.cancelledQty = s.reqQty
            }
          }
          const c = db.customers.find((x) => x.id === o.customerId)
          if (c) c.exposure = Math.max(0, c.exposure - a.amount)
          a.decided = { text: `Rejected by Finance (credit) on ${stamp}. Order set to Cancelled (Reading OQ-28)`, on: ctx.today }
          log(`Rejected by Finance (credit) in WF-INBOX. Status Credit Hold → Cancelled (Reading OQ-28)`)
        }
        return
      }
      // R-OM-02 no-quote order
      if (outcome === "Rejected") {
        o.status = "Rejected"
        a.decided = { text: `Rejected by Sales Director on ${stamp}. Order set to Rejected (K-15)`, on: ctx.today }
        log(`Rejected by Sales Director in WF-INBOX. Status Submitted → Rejected (K-15)`)
        return
      }
      a.decided = { text: `Approved by Sales Director on ${stamp}`, on: ctx.today }
      log(`Approved by Sales Director in WF-INBOX (R-OM-02)`)
      // the credit check runs after the approval, exactly as on the sales screen
      const c = db.customers.find((x) => x.id === o.customerId)
      if (!c) return
      const passLimit = c.exposure + a.amount <= c.creditLimit && !c.creditHold
      const passPast = !c.pastDue30
      o.creditChecks.push({ at: ctx.today, when: "after Sales Director approval", exposure: c.exposure, orderValue: a.amount, limit: c.creditLimit, pastDue30: c.pastDue30, passLimit, passPastDue: passPast })
      c.exposure += a.amount
      if (passLimit && passPast) {
        o.status = "Confirmed"
        log("Credit check after Sales Director approval: passed (both tests). Status Submitted → Confirmed")
        ctx.emit("sales.orderConfirmed", { soId: o.id as `SO-${string}`, type: o.type, lines: o.lines.map((l) => ({ no: l.no, itemId: l.item, qty: l.qty })) })
        return
      }
      o.status = "Credit Hold"
      const why = [!passLimit && (c.creditHold ? "customer credit hold flag set" : "exposure + order value above credit limit"), !passPast && "invoice more than 30 days past due"].filter(Boolean).join("; ")
      const id = `APR-TBD-${String(db.seq.appr++).padStart(4, "0")}`
      db.approvals.unshift({ id, kind: "Credit Release", soId: o.id, amount: a.amount, currency: a.currency, forRoles: ["Finance (credit)", "Controller"], reason: `Credit check failed: ${why}`, raised: ctx.today })
      log(`Credit check after Sales Director approval: failed (${why}). Status Submitted → Credit Hold. Credit release item sent to Finance`)
      // the new hold is a request on the shared engine too
      queueMicrotask(() => {
        const prev = store.getCore().role
        try {
          raiseAs(api, "Sales admin", { kind: "Credit release", subject: { type: "salesOrder", id: o.id }, title: `${o.id}: Credit check failed: ${why}`, amount: a.amount, currency: a.currency, note: `Mirrors FL-09 item ${id}` })
        } finally {
          store.setRole(prev)
        }
      })
    })
  })
}

/** Controller only: raise the customer's credit limit for a credit hold [DOC:p.49 §2.2; OQ-33], then re-run the check.
 *  A pass releases the order; the FL-09 item is closed and the request shows as decided. */
export function raiseCreditLimit(soId: string, newLimit: number): Result<string> {
  return store.mutate("sales", (db, ctx) => {
    if (ctx.role !== "Controller") throw new ProtoError("Raise limit is Controller only (R-2, Reading OQ-33).")
    const a = db.approvals.find((x) => x.kind === "Credit Release" && x.soId === soId && !x.decided)
    const o = db.orders.find((x) => x.id === soId)
    if (!a || !o) throw new ProtoError(`${soId} has no open credit release.`)
    const c = db.customers.find((x) => x.id === o.customerId)!
    if (!newLimit || newLimit <= c.creditLimit) throw new ProtoError(`Enter a new limit above the current ${money(c.creditLimit, c.currency)}.`, "limit")
    const old = c.creditLimit
    c.creditLimit = newLimit
    const passLimit = c.exposure <= newLimit && !c.creditHold
    const passPast = !c.pastDue30
    o.creditChecks.push({ at: ctx.today, when: "after limit raise", exposure: c.exposure - a.amount, orderValue: a.amount, limit: newLimit, pastDue30: c.pastDue30, passLimit, passPastDue: passPast })
    if (!passLimit || !passPast) throw new ProtoError(`Credit check still fails at ${money(newLimit, c.currency)}${passPast ? "" : ": invoice more than 30 days past due"}. Nothing changed.`)
    o.status = "Confirmed"
    a.decided = { text: `Limit raised by Controller on ${ctx.today} (${money(old, c.currency)} → ${money(newLimit, c.currency)}); credit check passed`, on: ctx.today }
    o.activity.push({ at: ctx.today, by: ctx.role, text: `Credit limit raised ${money(old, c.currency)} → ${money(newLimit, c.currency)}. Credit check passed. Status Credit Hold → Confirmed` })
    ctx.emit("sales.orderConfirmed", { soId: o.id as `SO-${string}`, type: o.type, lines: o.lines.map((l) => ({ no: l.no, itemId: l.item, qty: l.qty })) })
    return `Limit raised to ${money(newLimit, c.currency)}; ${soId} released.`
  })
}
