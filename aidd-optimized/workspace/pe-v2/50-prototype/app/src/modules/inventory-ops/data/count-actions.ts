// Count actions for the handheld (FX-INV-MCOUNT) and the Count Plan wizard (FX-INV-COUNTSHEETS).
// Count documents belong to the materials slice; these write to them through the store, applying the
// same rules the materials screens apply (Book I Part A §7: blind entry, autosave, recount by a
// different counter R-CNT-02, third count R-CNT-03, zero needs Confirm Empty Location, unlisted
// batch, serial scan, the freeze E-CNT-01). The materials module is not imported.
import { ProtoError, store, type MutateCtx } from "@/store"
import type { Role, UserId } from "@/data/domain"
import { MATERIALS } from "@/data/shared"
import { COUNT_RULES, FLOOR_COUNT_ROLES } from "../lib/rules"
import { abcOf, freezingDoc, lineVar, needsRecount, needsThirdCount, previewSheets, rateOf, unitLabel, type CountDoc, type CountLine, type MatState, type SheetInput } from "../lib/count"
import { userName } from "../components/bits"

const mat = <T,>(fn: (d: MatState, ctx: MutateCtx) => T) => store.mutate("materials", fn)
const need: (ok: unknown, msg: string, field?: string) => asserts ok = (ok, msg, field) => {
  if (!ok) throw new ProtoError(msg, field)
}
const SUP: Role[] = ["Warehouse supervisor"]
const roleIn = (ctx: MutateCtx, roles: Role[], what: string) => need(roles.includes(ctx.role), `${what} is done by the ${roles.join(" or ")}. Switch "Acting as" to continue.`)
const doc = (d: MatState, id: string) => {
  const c = d.countDocuments.find((x) => x.id === id)
  need(c, `Count document ${id} not found.`)
  return c
}
const act = (c: CountDoc, ctx: MutateCtx, text: string) => c.activity.unshift({ at: ctx.today, by: ctx.role, text })
/** Which documents a counter's handheld lists: assigned to them and open for entry (Assigned to start,
 *  Counting for the first count) or Recount where they are the recounter (p.36 §7.3, R-CNT-02). */
export function mobileDocs(d: MatState, role: Role, userId: string) {
  if (!FLOOR_COUNT_ROLES.includes(role)) return []
  return d.countDocuments.filter((c) => ((c.status === "Assigned" || c.status === "Counting") && c.counterIds.includes(userId as UserId)) || (c.status === "Recount" && c.recounterId === userId))
}
/** Why a recount document is not open to this user, when it is not (R-CNT-02). */
export const recountRefusal = (c: CountDoc, userId: string) => (c.status === "Recount" && c.counterIds.includes(userId as UserId) ? `R-CNT-02: you counted ${c.id} first. A recount is done by a different counter.` : undefined)

const mayEnter = (c: CountDoc, ctx: MutateCtx) => {
  need(FLOOR_COUNT_ROLES.includes(ctx.role), `Counting is done by the ${FLOOR_COUNT_ROLES.join(" or ")}. Switch "Acting as" to continue.`)
  if (c.status === "Counting") need(c.counterIds.includes(ctx.userId), "This document is not assigned to you (§7.3).")
  else if (c.status === "Recount") {
    need(!c.counterIds.includes(ctx.userId), `R-CNT-02: you counted ${c.id} first. A recount is done by a different counter.`)
    need(c.recounterId === ctx.userId, "This recount is not assigned to you (§7.3).")
  } else need(false, "Count entry is open in Counting or Recount only.")
}

export const startCounting = (id: string) =>
  mat((d, ctx) => {
    const c = doc(d, id)
    need(c.status === "Assigned", "Counting starts from Assigned.")
    need(c.counterIds.includes(ctx.userId), "Only the assigned counter opens entry.")
    c.status = "Counting"
    act(c, ctx, "Counting started on the handheld")
  })

/** Autosave of one quantity (SP-20): the first count, or the recount in Recount. */
export const saveCount = (id: string, lineNo: number, qty: number) =>
  mat((d, ctx) => {
    const c = doc(d, id)
    mayEnter(c, ctx)
    need(Number.isFinite(qty) && qty >= 0, "Enter a quantity of zero or more.")
    const l = c.lines.find((x) => x.no === lineNo)
    need(l, "Line not found.")
    const fz = freezingDoc(d.countDocuments, c.warehouseId, l.bin)
    need(!fz || fz.id === c.id, `E-CNT-01: Location ${l.bin} is frozen for counting under ${fz?.id}.`)
    if (c.status === "Recount") {
      need(l.flags.includes("Recount Required"), "Only flagged lines are recounted.")
      need(!l.flags.includes("Third Count Required"), "This line needs the third count (R-CNT-03), entered by the supervisor with the finance witness.")
      l.recount = qty
    } else l.count = qty
    // A zero against stock needs the explicit Confirm Empty Location action (§7.4 item 5).
    if (qty === 0) l.confirmedEmpty = false
    else l.confirmedEmpty = undefined
    act(c, ctx, `${c.status === "Recount" ? "Recount" : "Count"} line ${lineNo}: ${qty} ${l.uom}`)
  })
export const confirmEmpty = (id: string, lineNo: number) =>
  mat((d, ctx) => {
    const c = doc(d, id)
    mayEnter(c, ctx)
    const l = c.lines.find((x) => x.no === lineNo)
    need(l, "Line not found.")
    if (c.status === "Recount") l.recount = 0
    else l.count = 0
    l.confirmedEmpty = true
    act(c, ctx, `Line ${lineNo}: Confirm Empty Location`)
  })
export const addUnlisted = (id: string, i: { bin: string; itemId: string; batch: string; qty: number }) =>
  mat((d, ctx) => {
    const c = doc(d, id)
    mayEnter(c, ctx)
    need(c.status === "Counting", "Unlisted batches are recorded during the first count.")
    const m = MATERIALS.find((x) => x.id === i.itemId.trim().toUpperCase()) ?? d.created.find((x) => x.id === i.itemId.trim().toUpperCase())
    need(m, "Scan or enter a material number that exists.", "itemId")
    need(i.batch.trim(), "Enter the batch number found.", "batch")
    need(i.qty > 0, "Enter the quantity found.", "qty")
    need(!c.lines.some((l) => l.itemId === m.id && l.batch === i.batch.trim() && l.bin === i.bin.trim().toUpperCase()), "That batch is already on the sheet; count it on its line.", "batch")
    const no = Math.max(...c.lines.map((l) => l.no)) + 1
    c.lines.push({ no, bin: i.bin.trim().toUpperCase(), itemId: m.id, batch: i.batch.trim(), uom: m.baseUom, expected: 0, interim: 0, rate: rateOf(d, m.id), flags: ["Unlisted Batch"], count: i.qty, unlistedConfirmed: false })
    act(c, ctx, `Unlisted Batch line ${no}: ${i.qty} ${m.id} batch ${i.batch.trim()}; waits for supervisor confirmation`)
    return no
  })
export const scanSerial = (id: string, lineNo: number, serial: string) =>
  mat((d, ctx) => {
    const c = doc(d, id)
    mayEnter(c, ctx)
    const l = c.lines.find((x) => x.no === lineNo)
    need(l?.expectedSerials, "This line is not serialized.")
    const sn = serial.trim().toUpperCase()
    need(!(l.scannedSerials ?? []).includes(sn), `${sn} is already scanned on this line.`)
    l.scannedSerials = [...(l.scannedSerials ?? []), sn]
    if (c.status === "Recount") l.recount = l.scannedSerials.length
    else l.count = l.scannedSerials.length
    act(c, ctx, `Line ${lineNo}: serial ${sn} scanned${l.expectedSerials.includes(sn) ? "" : " (not on the sheet)"}`)
  })

/** Submit: lines beyond ±2% or ±$500 flag Recount Required and the counter is told nothing about them (blind). */
export const submitCount = (id: string) =>
  mat((d, ctx) => {
    const c = doc(d, id)
    need(c.status === "Counting", "Submit from Counting.")
    mayEnter(c, ctx)
    const open = c.lines.filter((l) => l.count == null)
    need(!open.length, `Count every line first (${open.map((l) => l.no).join(", ")} open).`)
    const zero = c.lines.filter((l) => l.count === 0 && l.expected > 0 && !l.confirmedEmpty)
    need(!zero.length, `A zero count needs "Confirm Empty Location" (line ${zero.map((l) => l.no).join(", ")}).`)
    for (const l of c.lines) if ((needsRecount(l) || l.flags.includes("Moved During Count")) && !l.flags.includes("Recount Required")) l.flags.push("Recount Required")
    c.status = "Submitted"
    act(c, ctx, `Submitted; ${c.lines.filter((l) => l.flags.includes("Recount Required")).length} line(s) flagged Recount Required`)
    ctx.emit("inventoryOps.countSubmitted", { docId: c.id, recount: false })
  })

function autoApprove(d: MatState, c: CountDoc) {
  for (const l of c.lines) {
    if (l.flags.includes("Unlisted Batch")) continue
    const { qty } = lineVar(l)
    const base = l.expected + l.interim
    const pct = base === 0 ? (qty === 0 ? 0 : 100) : (Math.abs(qty) / base) * 100
    if (pct <= COUNT_RULES.abcTolerancePct[abcOf(d, l.itemId)] && !l.flags.includes("Auto-Approved")) l.flags.push("Auto-Approved")
  }
}
/** Finish the recount; a recount that differs from the first count beyond the threshold again forces a third count (R-CNT-03). */
export const finishRecount = (id: string) =>
  mat((d, ctx) => {
    const c = doc(d, id)
    need(c.status === "Recount", "Finish a Recount document.")
    mayEnter(c, ctx)
    const open = c.lines.filter((l) => l.flags.includes("Recount Required") && l.recount == null)
    need(!open.length, `Recount every flagged line (${open.map((l) => l.no).join(", ")}).`)
    const third = c.lines.filter((l) => l.flags.includes("Recount Required") && needsThirdCount(l) && l.thirdCount == null)
    ctx.emit("inventoryOps.countSubmitted", { docId: c.id, recount: true })
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
/** Supervisor routes a Submitted document: Recount (with a recounter other than the first counter) or Variance Review. */
export const routeCount = (id: string, recounter?: UserId) =>
  mat((d, ctx) => {
    roleIn(ctx, SUP, "Routing a submitted count")
    const c = doc(d, id)
    need(c.status === "Submitted", "Route a Submitted document.")
    const flagged = c.lines.some((l) => l.flags.includes("Recount Required") && l.recount == null)
    if (flagged) {
      need(recounter, "Choose who recounts.", "recounter")
      need(!c.counterIds.includes(recounter), "R-CNT-02: choose a recounter other than the first counter.", "recounter")
      c.recounterId = recounter
    }
    c.status = flagged ? "Recount" : "Variance Review"
    if (!flagged) autoApprove(d, c)
    act(c, ctx, flagged ? `Sent to Recount by ${userName(recounter)} (blind to the first count)` : "Sent to Variance Review")
    return flagged
  })

// ============================================================================ Generate Count Sheets (p.36 §7.1)
export interface SheetRequest extends SheetInput {
  planId?: string
  blind: boolean
  softFreeze: boolean
  /** Counter team: one counter per document, dealt in turn (RD-IO-06). Empty leaves documents Generated. */
  team: UserId[]
}
export const generateSheets = (i: SheetRequest) =>
  mat((d, ctx) => {
    roleIn(ctx, SUP, "Generating count sheets")
    need(i.warehouseId, "Choose a warehouse.", "warehouseId")
    const pv = previewSheets(d, i, (id) => rateOf(d, id))
    need(pv.total, `No countable stock in ${i.warehouseId}.`)
    need(pv.units.length, `Every bin with stock in ${i.warehouseId} is already under an open count document.`)
    need(!i.team.length || !i.team.some((u) => !u), "Choose counters from the list.")
    const plans = [...new Set(d.countDocuments.map((c) => c.planId))].sort()
    const planId = i.planId?.trim() || `CP-2026-0${Number(plans[plans.length - 1]?.slice(-2) ?? "10") + 1}`
    const existing = d.countDocuments.filter((c) => c.planId === planId).length
    const ids: string[] = []
    let k = existing
    let turn = 0
    for (const u of pv.units) {
      const id = `CD-${planId}-${String(++k).padStart(3, "0")}` as CountDoc["id"]
      const lines: CountLine[] = u.rows.map((r, n) => ({
        no: n + 1, bin: r.bin, itemId: r.materialId, batch: r.batchId, uom: (MATERIALS.find((m) => m.id === r.materialId) ?? d.created.find((m) => m.id === r.materialId))?.baseUom ?? "EA", expected: r.qty, interim: 0, rate: rateOf(d, r.materialId), flags: [],
        expectedSerials: r.serials?.length ? [...r.serials] : undefined,
      }))
      const counter = i.team.length ? i.team[turn++ % i.team.length] : undefined
      d.countDocuments.unshift({
        id, plan: planId, planId, location: `${i.warehouseId} / ${unitLabel(i.basis, u.key)}`, warehouseId: i.warehouseId as CountDoc["warehouseId"], zone: unitLabel(i.basis, u.key), status: counter ? "Assigned" : "Generated", blind: i.blind, softFreeze: i.softFreeze,
        snapshotAt: ctx.today, generatedBy: ctx.userId, counterIds: counter ? [counter] : [], lines,
        activity: [{ at: ctx.today, by: ctx.role, text: `Generated from ${planId} (one per ${i.basis.toLowerCase()}); ${lines.length} line(s); expected quantities frozen at snapshot${counter ? `; counter ${userName(counter)} assigned` : ""}` }],
      })
      ids.push(id)
    }
    ctx.emit("inventoryOps.countSheetsGenerated", { planId, docIds: ids })
    return { planId, ids, skipped: pv.skipped }
  })
