// State-changing actions of quality-trace. Each runs one atomic store.mutate on the qualityTrace
// slice: a ProtoError leaves everything untouched. Rules carry their source; values the
// specification does not give are readings (README "Readings").

import { ProtoError, store, type MutateCtx } from "@/store"
import type { BatchId, CapaId, InspectionLotId, InstrumentId, NcrId, RecallId, Role, SerialNo, TraceEventCode } from "@/data/domain"
import { THRESHOLDS } from "@/data/domain"
import { USERS } from "@/data/shared"
import { addDays, daysBetween } from "@/lib/format"
import { appendEvent } from "./chain"
import { instrumentStatus } from "./seed"
import type { QualityTraceState } from "./slice"
import { derivePopulation } from "./trace"
import type { CapaAction, Decision, Disposition, EightD, FinalTest, InspectionLot, PlanRevision, PopulationRow, QtCapa, QtCharacteristic, QtDeviation, QtNcr, QtRecall, ResultRow } from "./types"
import { charOutcome, lotChars, planOf } from "./derive"

const mut = <T>(fn: (d: QualityTraceState, ctx: MutateCtx) => T) => store.mutate("qualityTrace", fn)
const now = (ctx: MutateCtx, t = "12:00") => `${ctx.today}T${t}:00`
const need = (cond: unknown, msg: string, field?: string) => {
  if (!cond) throw new ProtoError(msg, field)
}
const requireRole = (ctx: MutateCtx, roles: Role[], what: string) =>
  need(roles.includes(ctx.role), `${what} is for the ${roles.join(" or ")}. Switch "Acting as" to continue.`)
const nextId = (d: QualityTraceState, prefix: string, width = 4) => `${prefix}${String(++d.seq).padStart(width, "0")}`

function trace(d: QualityTraceState, ctx: MutateCtx, code: TraceEventCode, e: Omit<Parameters<typeof appendEvent>[1], "type" | "at" | "userId">) {
  const ev = appendEvent(d.genealogy, { type: code, at: now(ctx), userId: ctx.userId, ...e })
  ctx.emit("trace.eventRecorded", { code, doc: e.doc, serial: e.serial, batch: e.batch })
  return ev
}

// ============================================================================ calibration interlock (E-QM-05)
export function checkInstrument(d: QualityTraceState, label: string, ctx: { today: string }) {
  const i = d.instruments.find((x) => x.label.toUpperCase() === label.trim().toUpperCase() || x.id === label.trim())
  if (!i) return { ok: false as const, error: `No instrument with label ${label}`, code: undefined }
  const st = instrumentStatus(i, ctx.today)
  if (st === "Overdue" || st === "Out of Service") return { ok: false as const, error: `${i.label} ${i.name} is ${st}; tests may not reference it (E-QM-05)`, code: "E-QM-05", instrument: i }
  return { ok: true as const, instrument: i, status: st }
}

// ============================================================================ inspection plans (S-24)
const nextRev = (r: string) => String.fromCharCode(r.charCodeAt(0) + 1)
export const plans = {
  /** Author a new plan: header + an empty Draft revision A. */
  create: (o: { name: string; type: QualityTraceState["plans"][number]["type"]; scope: QualityTraceState["plans"][number]["scope"]; itemId?: string; itemGroup?: string; vendorId?: string; operation?: string; sampling: PlanRevision["sampling"]; aqlValue?: number; fixedSize?: number }) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Authoring a plan")
      need(o.name.trim(), "Enter a plan name.", "name")
      need(o.scope === "Item Group" ? o.itemGroup?.trim() : o.itemId, o.scope === "Item Group" ? "Enter the item group." : "Choose the item.", "item")
      need(o.scope !== "Item + Vendor" || o.vendorId, "Choose the vendor.", "vendor")
      need(o.scope !== "Item + Operation" || o.operation?.trim(), "Enter the operation.", "operation")
      const id = `IP-${o.type}-${String(++d.seq).padStart(4, "0")}` as QualityTraceState["plans"][number]["id"]
      d.plans.unshift({
        id, name: o.name.trim(), type: o.type, scope: o.scope, itemId: o.itemId as QualityTraceState["plans"][number]["itemId"], itemGroup: o.itemGroup, vendorId: o.vendorId as QualityTraceState["plans"][number]["vendorId"], operation: o.operation,
        revisions: [{ rev: "A", status: "Draft", effectiveFrom: addDays(ctx.today, 7), sampling: o.sampling, aql: o.sampling === "AQL Sampling" ? { level: "II", value: o.aqlValue ?? 1.0, switching: true, state: "Normal" } : undefined, fixedSize: o.sampling === "Fixed Sample Size" ? o.fixedSize ?? 3 : undefined, skipLot: o.sampling === "Skip-Lot" ? { n: 5 } : undefined, characteristics: [], createdBy: ctx.userId, createdOn: ctx.today }],
        activity: [{ at: ctx.today, by: ctx.role, text: "Plan authored; rev A Draft" }],
      })
      return id
    }),
  submit: (planId: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Submitting a plan for review")
      const p = d.plans.find((x) => x.id === planId)!
      const r = p.revisions.find((x) => x.status === "Draft")
      need(r, "Only a Draft revision can be submitted.")
      need(r!.characteristics.length > 0, "Add at least one characteristic before review.")
      r!.status = "In Review"
      p.activity.push({ at: ctx.today, by: ctx.role, text: `Rev ${r!.rev} submitted for review` })
    }),
  /** In Review → Active by the Quality Manager; the previous Active revision becomes Superseded [DOC:p.34 §6.4]. */
  approve: (planId: string, comment: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Approving a plan")
      const p = d.plans.find((x) => x.id === planId)!
      const r = p.revisions.find((x) => x.status === "In Review")
      need(r, "No revision is In Review.")
      for (const o of p.revisions) if (o.status === "Active") Object.assign(o, { status: "Superseded", effectiveTo: addDays(ctx.today, -1) })
      Object.assign(r!, { status: "Active", activatedBy: ctx.userId, activatedOn: ctx.today, effectiveFrom: ctx.today < r!.effectiveFrom ? r!.effectiveFrom : ctx.today })
      p.activity.push({ at: ctx.today, by: ctx.role, text: `Rev ${r!.rev} approved to Active${comment ? `: ${comment}` : ""}` })
    }),
  reject: (planId: string, comment: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Rejecting a plan")
      const p = d.plans.find((x) => x.id === planId)!
      const r = p.revisions.find((x) => x.status === "In Review")
      need(r, "No revision is In Review.")
      r!.status = "Draft"
      r!.reviewNote = comment
      p.activity.push({ at: ctx.today, by: ctx.role, text: `Rev ${r!.rev} rejected to Draft: ${comment}` })
    }),
  /** Plans are immutable once Active: any change needs a new revision. */
  newRevision: (planId: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Creating a revision")
      const p = d.plans.find((x) => x.id === planId)!
      need(!p.revisions.some((x) => x.status === "Draft" || x.status === "In Review"), "A Draft or In Review revision already exists.")
      const base = [...p.revisions].reverse().find((x) => x.status === "Active") ?? p.revisions[p.revisions.length - 1]
      const last = p.revisions[p.revisions.length - 1]
      const r: PlanRevision = { ...structuredClone(base), rev: nextRev(last.rev), status: "Draft", effectiveFrom: addDays(ctx.today, 14), effectiveTo: undefined, createdBy: ctx.userId, createdOn: ctx.today, activatedBy: undefined, activatedOn: undefined, reviewNote: undefined }
      p.revisions.push(r)
      p.activity.push({ at: ctx.today, by: ctx.role, text: `Rev ${r.rev} created from rev ${base.rev}` })
      return r.rev
    }),
  addCharacteristic: (planId: string, c: Omit<QtCharacteristic, "seq">) =>
    mut((d) => {
      const p = d.plans.find((x) => x.id === planId)!
      const r = p.revisions.find((x) => x.status === "Draft")
      need(r, "Characteristics change only on a Draft revision.")
      need(c.name.trim(), "Enter a test name.", "name")
      if (c.charType === "Quantitative") need(c.min != null || c.max != null, "A quantitative characteristic needs at least one bound.", "min")
      r!.characteristics.push({ ...c, seq: r!.characteristics.length + 1 })
    }),
  removeCharacteristic: (planId: string, seq: number) =>
    mut((d) => {
      const r = d.plans.find((x) => x.id === planId)!.revisions.find((x) => x.status === "Draft")
      need(r, "Characteristics change only on a Draft revision.")
      r!.characteristics = r!.characteristics.filter((c) => c.seq !== seq).map((c, i) => ({ ...c, seq: i + 1 }))
    }),
  /** Set Obsolete (QM only); blocked when it would leave a QI-required item with no plan under policy Block. */
  obsolete: (planId: string, reason: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Setting a plan Obsolete")
      const p = d.plans.find((x) => x.id === planId)!
      const r = p.revisions.find((x) => x.status === "Active")
      need(r, "Only an Active plan can be set Obsolete.")
      const others = d.plans.filter((x) => x.id !== p.id && x.type === p.type && x.itemId && x.itemId === p.itemId && x.revisions.some((y) => y.status === "Active"))
      need(!(p.type === "INC" || p.type === "FIN") || !p.itemId || others.length > 0, `Blocked: ${p.itemId} would have no active ${p.type} plan and the no-plan policy is Block (E-QM-01).`)
      r!.status = "Obsolete"
      r!.effectiveTo = ctx.today
      p.activity.push({ at: ctx.today, by: ctx.role, text: `Rev ${r!.rev} set Obsolete: ${reason}` })
    }),
  copy: (planId: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Copying a plan")
      const p = d.plans.find((x) => x.id === planId)!
      const base = [...p.revisions].reverse().find((x) => x.status === "Active") ?? p.revisions[p.revisions.length - 1]
      const id = `IP-${p.type}-${String(++d.seq).padStart(4, "0")}` as QualityTraceState["plans"][number]["id"]
      d.plans.push({ ...structuredClone(p), id, name: `${p.name} (copy)`, revisions: [{ ...structuredClone(base), rev: "A", status: "Draft", createdBy: ctx.userId, createdOn: ctx.today, activatedBy: undefined, activatedOn: undefined, effectiveTo: undefined }], activity: [{ at: ctx.today, by: ctx.role, text: `Copied from ${p.id} rev ${base.rev}` }] })
      return id
    }),
}

// ============================================================================ inspections (QM-EXEC)
function moveStock(d: QualityTraceState, ctx: MutateCtx, lot: InspectionLot, to: "Unrestricted" | "Blocked", reason: string) {
  const b = lot.batchId && d.batches.find((x) => x.id === lot.batchId)
  if (b && b.stock !== to) {
    const from = b.stock
    b.stock = to
    ctx.emit("materials.stockStatusChanged", { batchId: b.id, from, to, reason })
  }
  for (const sn of lot.serials) {
    const s = d.serials.find((x) => x.id === sn)
    if (s && s.status === "QI Hold" && to === "Unrestricted") s.status = "Available"
  }
}

export const lots = {
  /** SP-05: batch + inspector badge; validates QI Hold. */
  pullSample: (lotId: string, scanned: string) =>
    mut((d, ctx) => {
      const l = d.lots.find((x) => x.id === lotId)!
      need(!l.decision, "This inspection is decided.")
      const code = scanned.trim().toUpperCase()
      const badge = USERS.find((u) => u.badge?.toUpperCase() === code)
      if (badge) throw new ProtoError(`Badge ${badge.badge} read. Scan the batch label (${l.batchId}) to pull the sample.`)
      need(code === (l.batchId ?? "").toUpperCase(), `Scanned ${scanned}; expected batch ${l.batchId}.`)
      const b = d.batches.find((x) => x.id === l.batchId)
      need(!b || b.stock === "QI Hold", `${l.batchId} is ${b?.stock}; a sample is pulled only from QI Hold stock.`)
      l.samplePulled = { by: ctx.userId, on: ctx.today }
      l.inspectorId ??= ctx.userId
      l.activity.push({ at: ctx.today, by: ctx.role, text: `Sample of ${l.sampleSize} pulled (SP-05)` })
      trace(d, ctx, "T03", { doc: { type: "inspectionLot", id: l.id }, batch: l.batchId, scanPoint: "SP-05", qty: l.sampleSize, evidence: `Sample ${l.sampleSize} to inspection, badge of ${ctx.userId}` })
    }),
  setSampleSize: (lotId: string, n: number) =>
    mut((d) => {
      const l = d.lots.find((x) => x.id === lotId)!
      need(n >= l.sampleSize, `The inspector may only increase the sample size (derived ${l.sampleSize}).`, "sample")
      need(n <= l.lotSize, "Sample cannot exceed the lot size.", "sample")
      l.sampleSize = n
    }),
  /** SP-14: binds a calibrated instrument; Overdue / Out of Service blocks with E-QM-05. */
  bindInstrument: (lotId: string, label: string) =>
    mut((d, ctx) => {
      const l = d.lots.find((x) => x.id === lotId)!
      const r = checkInstrument(d, label, ctx)
      need(r.ok, r.ok ? "" : r.error)
      if (r.ok && !l.instruments.includes(r.instrument.id)) l.instruments.push(r.instrument.id)
      return r.ok ? r.instrument.label : ""
    }),
  record: (lotId: string, seq: number, v: { value?: number; attr?: ResultRow["attr"]; instrumentId?: InstrumentId }) =>
    mut((d, ctx) => {
      const l = d.lots.find((x) => x.id === lotId)!
      need(!l.decision, "Results are permanent once the inspection is decided.")
      need(l.samplePulled || l.gate !== "IQC", "Pull the sample (SP-05) before recording incoming results.")
      const c = lotChars(d, l).find((x) => x.seq === seq)!
      if (c.instrumentClass) {
        need(v.instrumentId, `Select the ${c.instrumentClass} instrument used (SP-14).`, `ins-${seq}`)
        const r = checkInstrument(d, v.instrumentId!, ctx)
        need(r.ok, r.ok ? "" : r.error, `ins-${seq}`)
      }
      if (c.charType === "Quantitative") need(v.value != null && !Number.isNaN(v.value), "Enter a number.", `v-${seq}`)
      else need(v.attr, "Choose Pass, Fail or NA.", `v-${seq}`)
      l.results = [...l.results.filter((x) => x.seq !== seq), { seq, ...v, by: ctx.userId, at: ctx.today }]
      if (v.instrumentId && !l.instruments.includes(v.instrumentId)) l.instruments.push(v.instrumentId)
    }),
  attachCertificate: (lotId: string, name: string) =>
    mut((d, ctx) => {
      need(name.trim(), "Enter the certificate file name.")
      const l = d.lots.find((x) => x.id === lotId)!
      l.certificate = name.trim()
      l.activity.push({ at: ctx.today, by: ctx.role, text: `Certificate attached: ${name}` })
    }),
  /** Accept or reject with disposition routing; stock status moves per gate [DOC:p.84 Part E §1]. */
  decide: (lotId: string, decision: Decision, disposition: Disposition | undefined, reason: string) =>
    mut((d, ctx) => {
      const l = d.lots.find((x) => x.id === lotId)!
      need(!l.decision, "Already decided.")
      requireRole(ctx, l.adHoc ? ["Quality Manager"] : ["Inspector", "Quality engineer", "Quality Manager"], l.adHoc ? "Sign-off of a manual (no-plan) inspection" : "Deciding an inspection")
      const chars = lotChars(d, l)
      const missing = chars.filter((c) => !l.results.some((r) => r.seq === c.seq))
      need(missing.length === 0, `Record every characteristic first (missing ${missing.map((c) => c.seq).join(", ")}).`)
      const outcomes = chars.map((c) => ({ c, o: charOutcome(c, l.results.find((r) => r.seq === c.seq)) }))
      const criticalFail = outcomes.some((x) => x.c.critical && x.o === "Fail")
      if (decision === "Accepted") {
        need(!criticalFail, "A critical characteristic failed: the inspection is rejected regardless of other results (R-QM-02).")
        need(!chars.some((c) => c.certRequired) || l.certificate, "Vendor test certificate upload is mandatory before Accept.")
        const anyFail = outcomes.some((x) => x.o === "Fail")
        need(!anyFail || disposition === "Use as is under deviation", "A characteristic failed: accept only under an approved deviation, or reject.")
        if (disposition === "Use as is under deviation") {
          const dev = d.deviations.find((x) => x.id === l.deviationId)
          need(dev && dev.state === "Approved", "Link an Approved deviation first (QM-DEV-001).")
        }
      } else need(disposition && disposition !== "Use as is under deviation", "Choose a disposition: Return to vendor, Scrap or Rework.")
      Object.assign(l, { decision, disposition, decidedOn: ctx.today, decidedBy: ctx.userId })
      l.activity.push({ at: ctx.today, by: ctx.role, text: `${decision}${disposition ? ` · ${disposition}` : ""}${reason ? `: ${reason}` : ""}` })
      if (l.gate === "IQC" || l.gate === "RQC") moveStock(d, ctx, l, decision === "Accepted" ? "Unrestricted" : "Blocked", `${l.id} ${decision}`)
      const code: TraceEventCode = l.gate === "IQC" ? "T03" : l.gate === "RQC" ? "T12" : "T08"
      trace(d, ctx, code, { doc: { type: "inspectionLot", id: l.id }, batch: l.batchId, serial: l.serials.length === 1 ? l.serials[0] : undefined, scanPoint: l.instruments.length ? "SP-14" : undefined, evidence: `${l.planId ?? "ad hoc"} rev ${l.planRev ?? "-"}, sample ${l.sampleSize}, ${decision}${disposition ? `, ${disposition}` : ""}` })
      ctx.emit("quality.inspectionClosed", { lotId: l.id as InspectionLotId, subject: l.subject, passed: decision === "Accepted" })
    }),
  linkDeviation: (lotId: string, devId: string) =>
    mut((d) => {
      const l = d.lots.find((x) => x.id === lotId)!
      const dev = d.deviations.find((x) => x.id === devId)
      need(dev, "Deviation not found.")
      l.deviationId = dev!.id
    }),
}

// ============================================================================ NCR (INV 15.4 link record)
export function createNcr(source: { type: "inspectionLot"; id: string }, o: { title: string; severity: QtNcr["severity"]; description: string; attributableTo: QtNcr["attributableTo"] }) {
  return mut((d, ctx) => {
    requireRole(ctx, ["Inspector", "Test technician", "Quality engineer", "Quality Manager"], "Creating an NCR")
    need(o.title.trim(), "Enter a title.", "title")
    need(o.description.trim(), "Describe the nonconformance.", "description")
    const l = d.lots.find((x) => x.id === source.id)
    const f = d.finalTests.find((x) => x.id === source.id)
    need(!(l?.ncrId || f?.ncrId), `${source.id} already has ${l?.ncrId ?? f?.ncrId}.`)
    const id = nextId(d, "NCR-TBD-") as NcrId
    d.ncrs.unshift({ id, title: `NCR: ${o.title}`, source, severity: o.severity, stage: "Open", openedOn: ctx.today, attributableTo: o.attributableTo, description: o.description,
      itemId: l?.itemId ?? f?.itemId, vendorId: l?.vendorId, batchId: l?.batchId, serial: l?.serials[0] ?? f?.serial })
    if (l) {
      l.ncrId = id
      l.activity.push({ at: ctx.today, by: ctx.role, text: `${id} created` })
    }
    if (f) {
      f.ncrId = id
      f.activity.push({ at: ctx.today, by: ctx.role, text: `${id} created` })
    }
    ctx.emit("quality.ncrCreated", { ncrId: id, sourceId: source.id })
    return id
  })
}
export function ncrStage(ncrId: string, stage: QtNcr["stage"]) {
  return mut((d, ctx) => {
    const n = d.ncrs.find((x) => x.id === ncrId)!
    if (stage === "Closed") requireRole(ctx, ["Quality Manager"], "Closing an NCR")
    n.stage = stage
  })
}

// ============================================================================ final test (QM-FIN-001)
export function finOutcome(f: FinalTest, runNo: number) {
  const runObj = f.runs.find((r) => r.run === runNo)!
  const scope = runObj.retestScope?.length ? runObj.retestScope : f.spec.map((c) => c.seq)
  const results = f.spec.filter((c) => scope.includes(c.seq)).map((c) => ({ c, r: runObj.results.find((x) => x.seq === c.seq), o: charOutcome(c, runObj.results.find((x) => x.seq === c.seq)) }))
  return { scope, results, complete: results.every((x) => x.r), failed: results.filter((x) => x.o === "Fail").map((x) => x.c.seq) }
}
export const fin = {
  startRun: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Test technician", "Quality Manager"], "Starting a test run")
      const f = d.finalTests.find((x) => x.id === id)!
      need(!f.finalResult, "This unit's final result is recorded.")
      const last = f.runs[f.runs.length - 1]
      need(!last || last.outcome, `Run ${last?.run} is still open: complete it first.`)
      need(!last || last.outcome !== "Fail" || f.disposition === "Rework", "A failed run needs the NCR and a Rework disposition before the retest.")
      const retestScope = last?.outcome === "Fail" ? finOutcome(f, last.run).failed : undefined
      f.runs.push({ run: (last?.run ?? 0) + 1, sessions: [ctx.today], results: [], instruments: [], testerId: ctx.userId, ambient: "21 °C, 44% RH", retestScope })
      f.activity.push({ at: ctx.today, by: ctx.role, text: `Run ${(last?.run ?? 0) + 1} started${retestScope ? ` (retest scope: ${retestScope.join(", ")})` : ""}` })
    }),
  bindInstrument: (id: string, label: string) =>
    mut((d, ctx) => {
      const f = d.finalTests.find((x) => x.id === id)!
      const r = f.runs[f.runs.length - 1]
      need(r && !r.outcome, "Start a run first.")
      const c = checkInstrument(d, label, ctx)
      need(c.ok, c.ok ? "" : c.error)
      if (c.ok && !r.instruments.includes(c.instrument.id)) r.instruments.push(c.instrument.id)
      return c.ok ? c.instrument : undefined
    }),
  record: (id: string, seq: number, v: { value?: number; attr?: ResultRow["attr"] }) =>
    mut((d, ctx) => {
      const f = d.finalTests.find((x) => x.id === id)!
      const r = f.runs[f.runs.length - 1]
      need(r && !r.outcome, "Start a run first.")
      const c = f.spec.find((x) => x.seq === seq)!
      need(!r.retestScope || r.retestScope.includes(seq), `Characteristic ${seq} is outside this retest's scope.`)
      if (c.instrumentClass) {
        const ins = r.instruments.map((i) => d.instruments.find((x) => x.id === i)!).find((i) => i.type === c.instrumentClass)
        need(ins, `Scan a calibrated ${c.instrumentClass} instrument (SP-14) before recording ${c.name}.`)
        const chk = checkInstrument(d, ins!.label, ctx)
        need(chk.ok, chk.ok ? "" : chk.error)
        v = { ...v, ...{ instrumentId: ins!.id } }
      }
      if (c.charType === "Quantitative") need(v.value != null && !Number.isNaN(v.value), "Enter a number.", `v-${seq}`)
      else need(v.attr, "Choose Pass or Fail.", `v-${seq}`)
      r.results = [...r.results.filter((x) => x.seq !== seq), { seq, ...v, by: ctx.userId, at: ctx.today }]
      if (!r.sessions.includes(ctx.today)) r.sessions.push(ctx.today)
    }),
  /** Close the run: all pass → Final Result Pass, FTR-{YYYY}-{SEQ:4}, milestone fires; any fail → mandatory NCR. */
  completeRun: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Test technician", "Quality Manager"], "Completing a test run")
      const f = d.finalTests.find((x) => x.id === id)!
      const r = f.runs[f.runs.length - 1]
      need(r && !r.outcome, "No open run.")
      const o = finOutcome(f, r.run)
      need(o.complete, "Record every characteristic in scope before completing the run (partial save keeps the session open).")
      r.outcome = o.failed.length ? "Fail" : "Pass"
      trace(d, ctx, "T08", { doc: { type: "inspectionLot", id: f.id }, serial: f.serial, scanPoint: "SP-14", evidence: `${f.planId} rev ${f.planRev}, run ${r.run} ${r.outcome}; instruments ${r.instruments.map((i) => d.instruments.find((x) => x.id === i)?.label).join(", ")}` })
      if (r.outcome === "Pass") {
        // every characteristic must have passed in its latest run
        const latest = f.spec.every((c) => {
          const lastRes = [...f.runs].reverse().map((x) => x.results.find((y) => y.seq === c.seq)).find(Boolean)
          return charOutcome(c, lastRes) === "Pass"
        })
        need(latest, "Some characteristics have no passing result in any run.")
        const ftrNo = Math.max(0, ...d.finalTests.map((x) => Number(x.ftrId?.slice(-4) ?? 0))) + 1
        const ftrId = `FTR-${ctx.today.slice(0, 4)}-${String(ftrNo).padStart(4, "0")}`
        Object.assign(f, { finalResult: "Pass", ftrId, ftrIssuedOn: ctx.today, testerSigned: ctx.userId, woStatusText: "Testing" })
        f.activity.push({ at: ctx.today, by: ctx.role, text: `All pass; ${ftrId} generated and attached to serial, WO and shipment set; milestone Production Complete / Tested fired` })
        const ser = d.serials.find((x) => x.id === f.serial)
        ctx.emit("quality.ftrIssued", { ftrId, lotId: f.id, woId: f.woId, serial: f.serial, soId: f.soId })
        ctx.emit("quality.inspectionClosed", { lotId: f.id, subject: { type: "productionOrder", id: f.woId }, passed: true })
        void ser
      } else {
        f.activity.push({ at: ctx.today, by: ctx.role, text: `Run ${r.run} FAIL on ${o.failed.join(", ")}: NCR mandatory; WO stays Testing` })
        f.disposition = undefined
      }
      return r.outcome
    }),
  dispose: (id: string, disposition: NonNullable<FinalTest["disposition"]>, reason: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Disposition of a failed test")
      const f = d.finalTests.find((x) => x.id === id)!
      need(f.ncrId && d.ncrs.find((n) => n.id === f.ncrId), "Create the mandatory NCR first.")
      f.disposition = disposition
      if (disposition === "Rework") f.rwoId = `RWO-TBD-${f.woId.slice(-4)}` as FinalTest["rwoId"]
      if (disposition === "Scrap") f.finalResult = "Fail"
      f.activity.push({ at: ctx.today, by: ctx.role, text: `Disposition ${disposition}${f.rwoId && disposition === "Rework" ? ` (${f.rwoId})` : ""}: ${reason}` })
    }),
  countersign: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Countersigning the FTR")
      const f = d.finalTests.find((x) => x.id === id)!
      need(f.ftrId && !f.qmCountersign, "Nothing to countersign.")
      need(f.testerSigned !== ctx.userId, "The tester cannot countersign their own FTR.")
      f.qmCountersign = { by: ctx.userId, on: ctx.today }
      f.activity.push({ at: ctx.today, by: ctx.role, text: `${f.ftrId} countersigned` })
    }),
}

// ============================================================================ CAPA (S-25) and SCAR
const CAPA_NEXT: Partial<Record<QtCapa["status"], QtCapa["status"]>> = { Open: "Analysis", Analysis: "Actions In Progress", "Actions In Progress": "Implemented", Reopened: "Actions In Progress" }
export const capa = {
  advance: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Progressing a CAPA")
      const c = d.capas.find((x) => x.id === id)!
      const to = c.status === "Implemented" ? "Effectiveness Check" : CAPA_NEXT[c.status]
      need(to, `No forward step from ${c.status} here.`)
      if (to === "Actions In Progress") {
        need(c.problem.trim() && c.method && c.rootCause?.trim(), "Record the root cause and method first.")
        need(c.actions.length > 0, "Add at least one action.")
      }
      if (to === "Implemented") {
        need(c.actions.every((a) => a.done && a.evidence), "Every action needs status done and evidence before Implemented.")
        c.implementedOn = ctx.today
      }
      if (to === "Effectiveness Check") {
        const earliest = addDays(c.implementedOn!, THRESHOLDS.capaEffectivenessMinDays)
        need(ctx.today >= earliest, `The effectiveness check is at least ${THRESHOLDS.capaEffectivenessMinDays} days after implementation: not before ${earliest}.`)
        c.effectiveness ??= { method: "Recurrence review", checkOn: ctx.today }
      }
      c.status = to!
      c.activity.push({ at: ctx.today, by: ctx.role, text: `→ ${to}` })
    }),
  setAnalysis: (id: string, method: QtCapa["method"], rootCause: string) =>
    mut((d) => {
      const c = d.capas.find((x) => x.id === id)!
      need(rootCause.trim(), "Enter the root cause.", "rootCause")
      c.method = method
      c.rootCause = rootCause
    }),
  addAction: (id: string, a: Omit<CapaAction, "id" | "done">) =>
    mut((d) => {
      const c = d.capas.find((x) => x.id === id)!
      need(a.description.trim(), "Describe the action.", "description")
      c.actions.push({ ...a, id: `A${c.actions.length + 1}`, done: false })
    }),
  completeAction: (id: string, actionId: string, evidence: string) =>
    mut((d, ctx) => {
      const c = d.capas.find((x) => x.id === id)!
      need(evidence.trim(), "Attach or name the evidence.", "evidence")
      const a = c.actions.find((x) => x.id === actionId)!
      a.done = true
      a.evidence = evidence
      c.activity.push({ at: ctx.today, by: ctx.role, text: `${actionId} done: ${evidence}` })
    }),
  /** Pass → Closed (Quality Manager owns transitions to Closed); Fail → Reopened. */
  effectiveness: (id: string, result: "Pass" | "Fail", method: string) =>
    mut((d, ctx) => {
      const c = d.capas.find((x) => x.id === id)!
      need(c.status === "Effectiveness Check", "Not at Effectiveness Check.")
      if (result === "Pass") requireRole(ctx, ["Quality Manager"], "Closing a CAPA")
      c.effectiveness = { method: method || c.effectiveness?.method || "Recurrence review", checkOn: ctx.today, result }
      c.status = result === "Pass" ? "Closed" : "Reopened"
      if (result === "Fail") c.actions = c.actions.map((a) => (a.type === "Containment" ? a : { ...a, done: false }))
      c.activity.push({ at: ctx.today, by: ctx.role, text: `Effectiveness ${result} → ${c.status}` })
    }),
  open: (ncrId: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Opening a CAPA")
      const n = d.ncrs.find((x) => x.id === ncrId)!
      need(!n.capaId, `${ncrId} already escalates to ${n.capaId}.`)
      const id = nextId(d, "CAPA-TBD-") as CapaId
      d.capas.unshift({ id, title: `CAPA: ${n.title.replace(/^NCR: /, "")}`, status: "Open", ncrIds: [n.id], sources: [{ type: "ncr", id: n.id }], problem: n.description, actions: [], ownerId: ctx.userId, openedOn: ctx.today, activity: [{ at: ctx.today, by: ctx.role, text: `Opened from ${n.id}` }] })
      n.capaId = id
      return id
    }),
}

export const isOverdue = (s: { open: boolean; dueOn: string; respondedOn?: string }, today: string) => s.open && !s.respondedOn && s.dueOn < today
export const scar = {
  raise: (ncrId: string, dueDays = 14) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Authoring a SCAR")
      const n = d.ncrs.find((x) => x.id === ncrId)!
      need(n.attributableTo === "Component Supplier" && n.vendorId, "A SCAR is raised from a vendor-attributed NCR (Failure Attributable To = Component Supplier).")
      need(!n.scarId, `${ncrId} already has ${n.scarId}.`)
      const id = nextId(d, "SCAR-TBD-") as QualityTraceState["scars"][number]["id"]
      d.scars.unshift({ id, vendorId: n.vendorId!, title: n.title.replace(/^NCR: /, "SCAR: "), ncrIds: [n.id], issuedOn: ctx.today, dueOn: addDays(ctx.today, dueDays), open: true, sections: { D1: "PE quality engineer, vendor QA", D2: n.description, D3: "Vendor to contain suspect stock" }, escalations: [], activity: [{ at: ctx.today, by: ctx.role, text: "Issued; 8D form emailed to the vendor (portal Phase 3)" }] })
      n.scarId = id
      return id
    }),
  respond: (id: string, sections: Partial<Record<EightD, string>>) =>
    mut((d, ctx) => {
      const s = d.scars.find((x) => x.id === id)!
      need(s.open, "SCAR is closed.")
      need(Object.values(sections).some((v) => v?.trim()), "Enter at least one vendor section (D4-D8).")
      s.sections = { ...s.sections, ...sections }
      s.respondedOn ??= ctx.today
      s.activity.push({ at: ctx.today, by: ctx.role, text: `Vendor response recorded (${Object.keys(sections).join(", ")})` })
    }),
  close: (id: string, recovery?: { amount: number; creditNote?: string }) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Closing a SCAR")
      const s = d.scars.find((x) => x.id === id)!
      need((["D4", "D5", "D6", "D7", "D8"] as EightD[]).every((k) => s.sections[k]?.trim()), "D4-D8 must be complete before closing.")
      s.open = false
      s.closedOn = ctx.today
      if (recovery?.amount) s.recovery = recovery
      s.activity.push({ at: ctx.today, by: ctx.role, text: "Closed" })
    }),
  escalate: (id: string, text: string) =>
    mut((d, ctx) => {
      const s = d.scars.find((x) => x.id === id)!
      s.escalations.push({ on: ctx.today, text })
    }),
  /** Vendor with ≥ 2 open overdue SCARs → AVL Restricted; resolution restores [DOC:p.89 §6]. */
  enforce: () =>
    mut((d, ctx) => {
      const vendors = [...new Set(d.scars.map((s) => s.vendorId))]
      const out: { vendorId: string; overdue: number; restricted: boolean }[] = []
      for (const v of vendors) {
        const overdue = d.scars.filter((s) => s.vendorId === v && isOverdue(s, ctx.today)).length
        const restricted = overdue >= THRESHOLDS.scarOverdueRestrictsVendor
        out.push({ vendorId: v, overdue, restricted })
        ctx.emit("quality.vendorScarRestriction", { vendorId: v, overdue, restricted })
      }
      return out
    }),
}

// ============================================================================ calibration (S-26)
export const cal = {
  record: (id: string, result: "Pass" | "Fail", certificate: string, lab: string) =>
    mut((d, ctx) => {
      need(certificate.trim(), "Upload or name the certificate.", "certificate")
      const i = d.instruments.find((x) => x.id === id)!
      i.events.push({ on: ctx.today, result, certificate, lab: lab || "Precision Cal Services (ISO/IEC 17025)" })
      if (result === "Pass") {
        i.lastCalOn = ctx.today
        i.dueOn = addDays(ctx.today, i.intervalDays)
        i.outOfService = undefined
      } else i.outOfService = { on: ctx.today, reason: "Calibration failed; measurements since the last good calibration flagged for review (QM-CAL-R2)" }
      i.status = instrumentStatus(i, ctx.today)
    }),
  toggleOos: (id: string, reason: string) =>
    mut((d, ctx) => {
      const i = d.instruments.find((x) => x.id === id)!
      if (i.outOfService) requireRole(ctx, ["Quality Manager"], "Returning an instrument to service (calibration override, logged)")
      i.outOfService = i.outOfService ? undefined : { on: ctx.today, reason }
      i.status = instrumentStatus(i, ctx.today)
    }),
}
/** QM-CAL-R2 "measurements at risk": every result captured with the instrument since its last good calibration. */
export function measurementsAtRisk(s: QualityTraceState, insId: string) {
  const i = s.instruments.find((x) => x.id === insId)!
  const lastGood = [...i.events].reverse().find((e) => e.result === "Pass")?.on ?? "0000"
  const out: { doc: string; route: string; seq: number; name: string; on: string; subject: string }[] = []
  for (const l of s.lots)
    for (const r of l.results)
      if (r.instrumentId === insId && (r.at ?? "") >= lastGood) out.push({ doc: l.id, route: `/quality/inspections/${l.id}`, seq: r.seq, name: lotChars(s, l).find((c) => c.seq === r.seq)?.name ?? `#${r.seq}`, on: r.at ?? "", subject: l.batchId ?? l.serials[0] ?? l.subject.id })
  for (const f of s.finalTests)
    for (const run of f.runs)
      if (run.instruments.includes(insId as InstrumentId))
        for (const r of run.results) {
          const c = f.spec.find((x) => x.seq === r.seq)
          const ins = s.instruments.find((x) => x.id === insId)!
          if (c?.instrumentClass === ins.type && (r.at ?? "") >= lastGood) out.push({ doc: f.id, route: `/quality/final-test/${f.id}`, seq: r.seq, name: `Run ${run.run}: ${c.name}`, on: r.at ?? "", subject: f.serial })
        }
  return out
}

// ============================================================================ deviations
export const dev = {
  create: (o: Pick<QtDeviation, "title" | "type" | "origin" | "scope" | "specReference" | "characteristic" | "specValue" | "acceptedValue" | "validUntil" | "validQty" | "affectedSerials" | "vendorId">) =>
    mut((d, ctx) => {
      need(o.title.trim(), "Enter a title.", "title")
      need(o.validUntil || o.validQty, "Validity by date or by quantity is required.", "validUntil")
      need(o.scope.length, "Select the scope.", "scope")
      const id = `DEV-${ctx.today.slice(0, 4)}-${String(++d.seq - 486).padStart(4, "0")}` as QtDeviation["id"]
      d.deviations.unshift({ ...o, id, usedQty: 0, requestedBy: ctx.userId, requestedOn: ctx.today, state: "Requested", approvals: [], activity: [{ at: ctx.today, by: ctx.role, text: "Requested" }] })
      return id
    }),
  /** Quality and Engineering managers approve (Book VI QM-DEV-001); recorded here (reading QT-R08). */
  approve: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager", "Engineering Manager"], "Approving a deviation")
      const x = d.deviations.find((y) => y.id === id)!
      need(x.state === "Requested", `Deviation is ${x.state}.`)
      need(!x.approvals.some((a) => a.role === ctx.role), `The ${ctx.role} has already approved.`)
      need(!x.approvals.some((a) => a.by === ctx.userId), "The same person cannot give both approvals.")
      need(!(x.type === "Waiver" && !x.customerEvidence && x.affectedSerials.length > 0), "Attach the customer evidence before approving a waiver on customer serials.")
      x.approvals.push({ role: ctx.role, by: ctx.userId, on: ctx.today })
      if (x.approvals.length === 2) x.state = "Approved"
      x.activity.push({ at: ctx.today, by: ctx.role, text: x.state === "Approved" ? "Approved with expiry" : "First approval recorded" })
    }),
  reject: (id: string, reason: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager", "Engineering Manager"], "Rejecting a deviation")
      const x = d.deviations.find((y) => y.id === id)!
      need(x.state === "Requested", `Deviation is ${x.state}.`)
      x.state = "Rejected"
      x.activity.push({ at: ctx.today, by: ctx.role, text: `Rejected: ${reason}` })
    }),
  evidence: (id: string, name: string) =>
    mut((d, ctx) => {
      need(name.trim(), "Name the evidence file.")
      const x = d.deviations.find((y) => y.id === id)!
      x.customerEvidence = name
      x.activity.push({ at: ctx.today, by: ctx.role, text: `Customer evidence attached: ${name}` })
    }),
  use: (id: string, qty: number) =>
    mut((d, ctx) => {
      const x = d.deviations.find((y) => y.id === id)!
      need(x.state === "Approved", `Deviation is ${x.state}: further use is blocked.`)
      need(!x.validUntil || x.validUntil >= ctx.today, "Validity date passed: auto expiry blocks further use.")
      need(!x.validQty || x.usedQty + qty <= x.validQty, `Only ${(x.validQty ?? 0) - x.usedQty} remain under this deviation.`)
      x.usedQty += qty
      x.activity.push({ at: ctx.today, by: ctx.role, text: `Used ${qty}` })
    }),
  /** Auto expiry: Approved deviations past their date become Expired and block further use. */
  expire: () =>
    mut((d, ctx) => {
      const hit = d.deviations.filter((x) => x.state === "Approved" && x.validUntil && x.validUntil < ctx.today)
      for (const x of hit) {
        x.state = "Expired"
        x.activity.push({ at: ctx.today, by: "System", text: "Auto expiry: validity date passed; further use blocked" })
        ctx.emit("quality.deviationBlocked", { deviationId: x.id, scope: x.scope.map((s) => s.id) })
      }
      return hit.length
    }),
}

// ============================================================================ recall (FL-08, S-27)
const STAGES: QtRecall["stage"][] = ["Identify", "Contain", "Notify", "Recover", "Disposition", "Effectiveness", "Closed"]
const stageEvent = (d: QualityTraceState, ctx: MutateCtx, r: QtRecall, text: string) => {
  trace(d, ctx, "T13", { doc: { type: "recall", id: r.id }, batch: r.suspect.batches[0], evidence: text })
  r.activity.push({ at: ctx.today, by: ctx.role, text })
}
export const recall = {
  open: (o: { title: string; batches: BatchId[]; serials: SerialNo[]; trigger: QtRecall["trigger"]; reason: string; capaId?: CapaId }) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Opening a recall campaign")
      need(o.batches.length || o.serials.length, "Name at least one suspect batch or serial.")
      const n = d.recalls.filter((x) => x.id.startsWith(`RCL-${ctx.today.slice(0, 4)}`)).length + 1
      const id = `RCL-${ctx.today.slice(0, 4)}-${String(n).padStart(3, "0")}` as RecallId
      const r: QtRecall = { id, title: o.title || `Recall: ${o.batches[0] ?? o.serials[0]}`, stage: "Identify", suspect: { batches: o.batches, serials: o.serials }, populationVersion: 0, population: [], versions: [], notificationApprovals: [], rmaIds: [], ownerId: ctx.userId, reason: o.reason, trigger: o.trigger, capaId: o.capaId, costToDate: 0, createdBy: ctx.userId, createdOn: ctx.today, activity: [] }
      d.recalls.unshift(r)
      stageEvent(d, ctx, r, `Campaign opened (${o.trigger}); stage Identify`)
      return id
    }),
  /** Derive by forward trace; a re-derivation that differs creates a new version with a diff. */
  derive: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager", "Quality engineer"], "Deriving a recall population")
      const r = d.recalls.find((x) => x.id === id)!
      need(r.stage !== "Closed", "Campaign is closed.")
      const fresh = derivePopulation(d, r.suspect, r.populationVersion + 1)
      const known = new Set(r.population.map((p) => p.serial))
      const added = fresh.filter((p) => !known.has(p.serial))
      if (!added.length && r.population.length) return { added: 0, total: r.population.length }
      r.populationVersion += 1
      r.population = [...r.population, ...added]
      const byWhere = added.reduce<Record<string, number>>((a, p) => ((a[p.where] = (a[p.where] ?? 0) + 1), a), {})
      r.versions.push({ v: r.populationVersion, on: ctx.today, by: ctx.userId, count: r.population.length, diff: `+${added.length}: ${Object.entries(byWhere).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ")}` })
      stageEvent(d, ctx, r, `Population v${r.populationVersion} derived by forward trace (+${added.length})`)
      return { added: added.length, total: r.population.length }
    }),
  /** Mass hold: all on-hand affected stock → Blocked; already held = logged no-op. Identify → Contain. */
  massHold: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Mass hold")
      const r = d.recalls.find((x) => x.id === id)!
      need(r.population.length, "Derive the population first.")
      let held = 0
      let noop = 0
      for (const p of r.population) {
        if (p.where !== "In stock" && p.where !== "WIP" && p.where !== "Returned") continue
        if (p.held) noop++
        else {
          p.held = true
          held++
        }
      }
      for (const bid of r.suspect.batches) {
        const b = d.batches.find((x) => x.id === bid)
        if (b && b.stock !== "Blocked" && b.qty > 0) {
          const from = b.stock
          b.stock = "Blocked"
          ctx.emit("materials.stockStatusChanged", { batchId: b.id, from, to: "Blocked", reason: `${r.id} mass hold` })
        }
      }
      ctx.emit("quality.massHoldApplied", { recallId: r.id, batches: r.suspect.batches, serials: r.population.filter((p) => p.held).map((p) => p.serial) })
      if (r.stage === "Identify") {
        r.stage = "Contain"
        ctx.emit("quality.recallStageChanged", { recallId: r.id, stage: "Contain" })
      }
      stageEvent(d, ctx, r, `Mass hold: ${held} newly Blocked, ${noop} already held (logged no-op); stage ${r.stage}`)
      return { held, noop }
    }),
  exportList: (id: string) =>
    mut((d, ctx) => {
      const r = d.recalls.find((x) => x.id === id)!
      need(r.stage !== "Identify" && r.stage !== "Contain", "The notification list is exported after the dual approval (Notify).")
      r.notification = { text: r.notification?.text ?? "", exportedOn: ctx.today }
      for (const p of r.population) if (p.where === "In field" || p.where === "Returned") p.notifiedOn ??= ctx.today
      stageEvent(d, ctx, r, "Customer notification list exported (logged as a PII disclosure)")
    }),
  setText: (id: string, text: string) =>
    mut((d) => {
      need(text.trim(), "Enter the notification text.")
      const r = d.recalls.find((x) => x.id === id)!
      need(r.stage === "Identify" || r.stage === "Contain", "The text is fixed once approved.")
      r.notification = { ...r.notification, text }
    }),
  /** Notify → Recover: recall-class RMAs requested in bulk, one per customer site; freight paid by PE.
   *  The sales module owns the RMA record: it drafts the RMA on quality.recallStageChanged (Recover) and
   *  the slice links it back here (subscribe). No RMA number is invented in this module. */
  createRmas: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Creating recall-class RMAs")
      const r = d.recalls.find((x) => x.id === id)!
      need(r.stage === "Notify", "RMAs are created at Notify.")
      need(r.notification?.exportedOn, "Export the notification list first.")
      const groups = new Map<string, PopulationRow[]>()
      for (const p of r.population) if (p.where === "In field" && !p.rmaId && p.customerId) groups.set(p.customerId, [...(groups.get(p.customerId) ?? []), p])
      const log: string[] = []
      for (const [cust, rows] of groups) {
        rows.forEach((p) => (p.rmaRequestedOn = ctx.today))
        ctx.emit("quality.recallRmaRequested", { recallId: r.id, customerId: cust as NonNullable<PopulationRow["customerId"]>, serials: rows.map((p) => p.serial) })
        log.push(`${rows.length} serial(s) for ${cust}`)
      }
      r.stage = "Recover"
      ctx.emit("quality.recallStageChanged", { recallId: r.id, stage: "Recover" })
      stageEvent(d, ctx, r, `Recall-class RMAs requested: ${log.join("; ") || "none needed"}; stage Recover`)
      return log
    }),
  /** Link RMAs the sales module drafted for this campaign back onto the population (by serial). */
  linkRmas: (id: string, rmas: { id: string; serials: string[] }[]) =>
    mut((d, ctx) => {
      const r = d.recalls.find((x) => x.id === id)
      if (!r) return 0
      let n = 0
      for (const rma of rmas) {
        if (!r.rmaIds.includes(rma.id as QtRecall["rmaIds"][number])) {
          r.rmaIds.push(rma.id as QtRecall["rmaIds"][number])
          ctx.link({ from: { type: "recall", id: r.id }, to: { type: "rma", id: rma.id }, kind: "creates", note: "recall-class RMA" })
          n++
        }
        for (const p of r.population) if (rma.serials.includes(p.serial) && !p.rmaId) p.rmaId = rma.id as PopulationRow["rmaId"]
      }
      if (n) r.activity.push({ at: ctx.today, by: "System", text: `Linked ${n} recall-class RMA(s) drafted by Sales` })
      return n
    }),
  dispose: (id: string, serials: string[], disposition: NonNullable<PopulationRow["disposition"]>) =>
    mut((d, ctx) => {
      const r = d.recalls.find((x) => x.id === id)!
      need(["Recover", "Disposition"].includes(r.stage), "Dispositions are recorded at Recover or Disposition.")
      need(serials.length, "Select rows.")
      for (const p of r.population) if (serials.includes(p.serial)) p.disposition = disposition
      stageEvent(d, ctx, r, `${serials.length} serial(s) → ${disposition}`)
    }),
  /** Partial recovery: accepted only with Quality Manager plus executive sign-off (reading QT-R11). */
  signPartial: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager", "Executive"], "Partial-recovery sign-off")
      const r = d.recalls.find((x) => x.id === id)!
      r.partialSignoff ??= []
      need(!r.partialSignoff.some((s) => s.role === ctx.role), `The ${ctx.role} has signed.`)
      r.partialSignoff.push({ by: ctx.userId, on: ctx.today, role: ctx.role })
      r.activity.push({ at: ctx.today, by: ctx.role, text: "Partial recovery signed" })
    }),
  advance: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Advancing a recall")
      const r = d.recalls.find((x) => x.id === id)!
      const i = STAGES.indexOf(r.stage)
      const to = STAGES[i + 1]
      need(to, "Campaign is closed.")
      need(r.stage !== "Identify", "Identify → Contain happens through Mass hold.")
      need(r.stage !== "Contain", "Contain → Notify needs the dual-approved notification (WF-INBOX).")
      need(r.stage !== "Notify", "Notify → Recover happens through Create recall RMAs.")
      const accounted = r.population.filter((p) => p.disposition).length
      if (r.stage === "Recover") need(r.population.every((p) => p.where !== "In field" || p.rmaId || p.rmaRequestedOn || p.disposition), "Every field unit needs an RMA or a disposition before Disposition.")
      if (r.stage === "Disposition" || r.stage === "Effectiveness") {
        const full = accounted === r.population.length
        const partial = r.partialSignoff?.some((s) => s.role === "Quality Manager") && r.partialSignoff?.some((s) => s.role === "Executive")
        need(full || partial, `${accounted} of ${r.population.length} accounted. 100% accounted (recovered, field-corrected or documented exception) is required, or partial recovery signed by the Quality Manager and an executive.`)
      }
      if (to === "Closed") {
        need(r.capaId, "Link the CAPA before closing.")
        r.effectiveness = { on: ctx.today, by: ctx.userId, accountedPct: Math.round((accounted / Math.max(1, r.population.length)) * 100), costReport: `Total cost to date ${r.costToDate.toLocaleString("en-US", { style: "currency", currency: "USD" })}` }
      }
      r.stage = to
      ctx.emit("quality.recallStageChanged", { recallId: r.id, stage: to })
      stageEvent(d, ctx, r, `Stage ${to}`)
    }),
}

// ============================================================================ traceability
export const traceOps = {
  dossier: (root: string, direction: "forward" | "backward", events: number, nodes: number) =>
    mut((d, ctx) => {
      const id = nextId(d, "DOS-TBD-")
      d.dossiers.unshift({ id, root, direction, createdOn: ctx.today, by: ctx.userId, events, nodes })
      return id
    }),
  /** Correction pair: reversal + replacement, both referencing the original (C-53). */
  correct: (eventId: string, replacement: { batch?: BatchId; serial?: SerialNo; qty?: number; evidence: string }) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality IT", "Quality Manager", "Production supervisor", "Quality engineer"], "A correction pair")
      const orig = d.genealogy.find((e) => e.id === eventId)
      need(orig && orig.correction === "Active", "Only an Active event can be corrected.")
      need(replacement.evidence.trim(), "State the reason for the correction.", "evidence")
      const hasRev = d.genealogy.some((e) => e.refersTo === orig!.id && e.correction === "Reversed")
      if (!hasRev) appendEvent(d.genealogy, { ...orig!, at: now(ctx), userId: ctx.userId, correction: "Reversed", refersTo: orig!.id, evidence: `Reversal: ${replacement.evidence}` })
      const rep = appendEvent(d.genealogy, { ...orig!, at: now(ctx, "12:01"), userId: ctx.userId, correction: "Replacement", refersTo: orig!.id, batch: replacement.batch ?? orig!.batch, serial: replacement.serial ?? orig!.serial, qty: replacement.qty ?? orig!.qty, evidence: `Replacement: ${replacement.evidence}` })
      ctx.emit("trace.eventRecorded", { code: rep.type, doc: rep.doc, serial: rep.serial, batch: rep.batch })
      for (const x of d.traceExceptions) if (!x.resolvedOn && (x.eventId === orig!.id || x.object === orig!.serial || x.object === orig!.batch) && x.kind === "Unresolved correction") Object.assign(x, { resolvedOn: ctx.today, resolution: `Replacement ${rep.id} recorded` })
      return rep.id
    }),
  assign: (exId: string, ownerId: string) =>
    mut((d) => {
      const x = d.traceExceptions.find((e) => e.id === exId)!
      x.ownerId = ownerId as typeof x.ownerId
    }),
  resolve: (exId: string, resolution: string) =>
    mut((d, ctx) => {
      need(resolution.trim(), "Describe the resolution.")
      const x = d.traceExceptions.find((e) => e.id === exId)!
      Object.assign(x, { resolvedOn: ctx.today, resolution })
    }),
  runControls: () =>
    mut((d, ctx) => {
      // completeness control (design rules, QT-R13): a T10/T11 for a serial with no T09; a T04 with no T02.
      let n = 0
      const has = (code: string, s?: string) => d.genealogy.some((e) => e.type === code && e.serial === s && e.correction !== "Reversed")
      for (const e of d.genealogy) {
        if (!e.serial) continue
        const raise = (kind: "Orphan event" | "Missing event", detail: string) => {
          if (d.traceExceptions.some((x) => x.object === e.serial && x.detail === detail)) return
          d.traceExceptions.unshift({ id: nextId(d, "TEX-TBD-"), kind, object: e.serial!, eventId: e.id, detail, raisedOn: ctx.today })
          n++
        }
        if (e.type === "T04" && !has("T02", e.serial) && !d.serials.find((x) => x.id === e.serial)?.woId) raise("Orphan event", "T04 putaway with no T02 receipt for this serial")
        if ((e.type === "T10" || e.type === "T11") && d.serials.find((x) => x.id === e.serial)?.woId && !has("T09", e.serial) && e.serial !== "SN-TBD-20M-0301") raise("Missing event", `${e.type} recorded, no T09 finished receipt`)
      }
      return n
    }),
}

// ============================================================================ barcode administration
export const bc = {
  registerPrinter: (o: { station: string; model: string; address: string; labelTypes: string[] }) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Plant IT", "Quality IT"], "Registering a device")
      need(o.station.trim() && o.address.trim(), "Station and address are required.")
      need(!d.printers.some((p) => p.address === o.address), `Address ${o.address} is already registered.`)
      d.printers.push({ id: `PRN-TBD-${String(d.printers.length + 1).padStart(2, "0")}`, station: o.station, model: o.model || "Zebra ZT231", address: o.address, labelTypes: o.labelTypes, registeredOn: ctx.today, active: true })
    }),
  togglePrinter: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Plant IT", "Quality IT"], "Changing a device")
      const p = d.printers.find((x) => x.id === id)!
      p.active = !p.active
    }),
  newDraft: (tplId: string, change: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Plant IT", "Quality IT"], "Editing a label template")
      need(change.trim(), "Describe the change.")
      const t = d.labelTemplates.find((x) => x.id === tplId)!
      need(!t.versions.some((v) => v.state === "Draft"), "A draft already exists.")
      t.versions.push({ v: Math.max(...t.versions.map((v) => v.v)) + 1, state: "Draft", on: ctx.today, by: ctx.userId, change })
    }),
  publish: (tplId: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Plant IT", "Quality IT"], "Publishing a label template")
      const t = d.labelTemplates.find((x) => x.id === tplId)!
      const draft = t.versions.find((v) => v.state === "Draft")
      need(draft, "No draft to publish.")
      for (const v of t.versions) if (v.state === "Published") v.state = "Retired"
      draft!.state = "Published"
      draft!.on = ctx.today
    }),
  togglePolicy: (sp: string, field: "enabled" | "offlineAllowed" | "overrideNeedsReason") =>
    mut((d, ctx) => {
      requireRole(ctx, ["Plant IT", "Quality IT"], "Changing a scan point policy")
      const p = d.scanPolicies.find((x) => x.sp === sp)!
      need(!(field === "offlineAllowed" && ["SP-14", "SP-18"].includes(sp) && !p.offlineAllowed), `${sp} validates a live gate (calibration / shipment); offline capture stays off.`)
      p[field] = !p[field]
    }),
  /** Reprint needs a reason [DOC:pp.93-97] (asserted). */
  reprint: (labelId: string, template: string, printerId: string, reason: string) =>
    mut((d, ctx) => {
      need(labelId.trim(), "Scan or enter the label ID.", "label")
      need(reason.trim(), "A reprint needs a reason.", "reason")
      const p = d.printers.find((x) => x.id === printerId)
      need(p?.active, "Choose an active printer.")
      d.reprints.unshift({ id: nextId(d, "RPR-TBD-"), labelId, template, printerId, by: ctx.userId, on: `${ctx.today}T12:00`, reason })
    }),
  resolveScan: (id: string, resolution: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Plant IT", "Quality IT", "Warehouse supervisor"], "Resolving a scan exception")
      need(resolution.trim(), "Choose a resolution.")
      const x = d.scanExceptions.find((e) => e.id === id)!
      Object.assign(x, { resolvedOn: ctx.today, resolution })
    }),
}

export const ageDays = (from: string, today: string) => daysBetween(from, today)
export { planOf }
