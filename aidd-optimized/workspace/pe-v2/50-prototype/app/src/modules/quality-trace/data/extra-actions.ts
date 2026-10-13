// State-changing actions of the feature-list screens of quality-trace. Same pattern as actions.ts:
// each runs one atomic store.mutate on the qualityTrace slice, a ProtoError leaves everything
// untouched, and rules carry their source. Values the specification does not give are readings.

import { ProtoError, store, type MutateCtx } from "@/store"
import type { CapaId, Role, ScanPointCode, TraceEventCode } from "@/data/domain"
import { SCAN_POINTS } from "@/data/domain"
import { appendEvent } from "./chain"
import { checkInstrument } from "./actions"
import { backward, flatten, treeDeviations } from "./trace"
import type { QualityTraceState } from "./slice"
import { isDuplicateMarked, needsQualityApproval, REPRINT_REASONS, type AuditFinding, type AuditType, type ContactAttempt, type PrintJob, type ScanTelemetry } from "./extra-types"
import type { QtCapa } from "./types"

const mut = <T>(fn: (d: QualityTraceState, ctx: MutateCtx) => T) => store.mutate("qualityTrace", fn)
const need = (cond: unknown, msg: string, field?: string) => {
  if (!cond) throw new ProtoError(msg, field)
}
const requireRole = (ctx: MutateCtx, roles: Role[], what: string) => need(roles.includes(ctx.role), `${what} is for the ${roles.join(" or ")}. Switch "Acting as" to continue.`)
const nextId = (d: QualityTraceState, prefix: string, width = 4) => `${prefix}${String(++d.seq).padStart(width, "0")}`
const stamp = (ctx: MutateCtx, t = "12:00") => `${ctx.today}T${t}`
const SUPERVISORS: Role[] = ["Warehouse supervisor", "Production supervisor"]
const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)

function log(d: QualityTraceState, e: Omit<ScanTelemetry, "id">) {
  d.telemetry.unshift({ id: nextId(d, "TLM-"), ...e })
}

// ============================================================================ scan exceptions (FX-BC-EXCEPTIONS)
export const scanX = {
  /** Supervisor decision on an offline replay conflict: accept (replay with the original timestamp), reject, or re-post (post now).
   *  Never silently dropped: every decision is attributed, logged to telemetry and kept on the card [DOC:p.94 Part F; Book V §8.4]. */
  decide: (id: string, decision: "Accepted" | "Rejected" | "Re-posted", reason: string) =>
    mut((d, ctx) => {
      requireRole(ctx, [...SUPERVISORS, "Plant IT", "Quality IT"], "Resolving a scan conflict")
      const x = d.scanExceptions.find((e) => e.id === id)!
      need(!x.resolvedOn, "This exception is already resolved.")
      need(reason.trim(), "A supervisor reason is required: no conflict is dropped without one.", "reason")
      const sp = SCAN_POINTS[x.sp]
      const code = sp.trace as TraceEventCode | undefined
      const delayedMin = minutesBetween(x.capturedAt, x.syncedAt)
      let resolution = ""
      if (decision === "Rejected") resolution = `Rejected by ${ctx.role}: ${reason.trim()}`
      else {
        resolution = `${decision === "Accepted" ? "Replayed with the original timestamp" : "Re-posted at the current time"}: ${reason.trim()}`
        if (code) {
          const isSerial = x.code.startsWith("SN-")
          const ev = appendEvent(d.genealogy, {
            type: code, at: decision === "Accepted" ? `${x.capturedAt}:00` : stamp(ctx), doc: { type: isSerial ? "serial" : "batch", id: x.code }, serial: isSerial ? (x.code as never) : undefined, batch: isSerial ? undefined : (x.code as never),
            scanPoint: x.sp, userId: ctx.userId, device: x.device, delayedMin, evidence: `${decision} scan exception ${x.id} from ${x.device} (captured ${x.capturedAt}, synced ${x.syncedAt}): ${reason.trim()}`,
          })
          ctx.emit("trace.eventRecorded", { code, doc: ev.doc, serial: ev.serial, batch: ev.batch })
        }
      }
      Object.assign(x, { resolvedOn: ctx.today, resolution, decision, supervisorId: ctx.userId, reason: reason.trim() })
      log(d, { at: stamp(ctx), device: x.device, userId: ctx.userId, sp: x.sp, payload: x.code, result: decision === "Rejected" ? "Rejected" : "Replayed", error: `Conflict ${x.id} ${decision.toLowerCase()} by supervisor` })
      for (const t of d.traceExceptions) if (!t.resolvedOn && t.kind === "Delayed offline event" && t.object === x.code) Object.assign(t, { resolvedOn: ctx.today, resolution: `Scan exception ${x.id} ${decision.toLowerCase()}` })
    }),
}

// ============================================================================ failed print queue (BC-ADMIN)
const supports = (labelTypes: string[], template: string) => labelTypes.some((t) => template.toLowerCase().startsWith(t.toLowerCase().split(" (")[0]) || t.toLowerCase().startsWith(template.toLowerCase().split(" v")[0]))
export const printQ = {
  /** Retry on the same printer: succeeds only when the device is online again. */
  retry: (id: string) =>
    mut((d, ctx) => {
      const j = d.printJobs.find((x) => x.id === id)!
      need(j.status === "Failed", "Only a failed job can be retried.")
      const p = d.printers.find((x) => x.id === j.printerId)
      j.attempts += 1
      if (!p?.active || (p.health && p.health !== "Online")) {
        j.error = `${p?.station ?? j.printerId} is ${!p?.active ? "inactive" : p.health}`
        return { printed: false as const, message: `${j.id} failed again: ${j.error}. Fix the printer or redirect the job.` }
      }
      Object.assign(j, { status: "Printed", resolvedOn: ctx.today, resolvedBy: ctx.userId })
      return { printed: true as const, message: `${j.id} printed on ${p.station}` }
    }),
  /** Redirect to another registered printer that carries the label type (printer failover per station). */
  redirect: (id: string, printerId: string) =>
    mut((d, ctx) => {
      const j = d.printJobs.find((x) => x.id === id)!
      need(j.status === "Failed", "Only a failed job can be redirected.")
      const p = d.printers.find((x) => x.id === printerId)
      need(p, "Choose a printer.", "printer")
      need(p!.id !== j.printerId, "Choose a different printer.", "printer")
      need(p!.active && (!p!.health || p!.health === "Online"), `${p!.station} is ${p!.active ? p!.health : "inactive"}; choose an online printer.`, "printer")
      need(supports(p!.labelTypes, j.template), `${p!.station} does not carry this label type (${j.template}).`, "printer")
      Object.assign(j, { status: "Printed", redirectedTo: p!.id, resolvedOn: ctx.today, resolvedBy: ctx.userId })
      j.attempts += 1
    }),
  cancel: (id: string, reason: string) =>
    mut((d, ctx) => {
      const j = d.printJobs.find((x) => x.id === id)!
      need(j.status === "Failed", "Only a failed job can be cancelled.")
      need(reason.trim(), "A cancellation needs a reason.", "reason")
      Object.assign(j, { status: "Cancelled", resolvedOn: ctx.today, resolvedBy: ctx.userId, error: `${j.error}. Cancelled: ${reason.trim()}` })
    }),
  /** Simulated field fix: reload paper, replace ribbon, close the head, reconnect. */
  fixPrinter: (printerId: string) =>
    mut((d) => {
      const p = d.printers.find((x) => x.id === printerId)!
      need(p.active, "Activate the printer in the registry first.")
      p.health = "Online"
    }),
  jobFor: (d: Pick<QualityTraceState, "printers">, j: PrintJob) => d.printers.find((p) => p.id === j.printerId),
  alternatives: (d: Pick<QualityTraceState, "printers">, j: PrintJob) => d.printers.filter((p) => p.id !== j.printerId && p.active && (!p.health || p.health === "Online") && supports(p.labelTypes, j.template)),
}

// ============================================================================ reprint governance (FX-BC-REPRINT)
export const reprintX = {
  /** Any reprint needs a reason code; serial and nameplate reprints also need Quality approval; every reprint carries DUPLICATE except location labels [DOC:p.93, p.97 Part F]. */
  request: (o: { labelId: string; kind: string; reasonCode: string; note: string; printerId: string; template: string }) =>
    mut((d, ctx) => {
      need(o.labelId.trim(), "Scan or enter the label ID.", "label")
      need(o.kind, "Choose the label kind.", "kind")
      need((REPRINT_REASONS as readonly string[]).includes(o.reasonCode), "Choose a reason code.", "reason")
      const p = d.printers.find((x) => x.id === o.printerId)
      need(p?.active && (!p.health || p.health === "Online"), "Choose an active, online printer.", "printer")
      need(o.reasonCode !== "Data corrected" || o.note.trim(), "Say what was corrected (the reason code needs a note).", "note")
      const awaiting = needsQualityApproval(o.kind)
      const id = nextId(d, "RPR-TBD-")
      d.reprints.unshift({ id, labelId: o.labelId.trim(), template: o.template, printerId: o.printerId, by: ctx.userId, on: stamp(ctx), reason: `${o.reasonCode}${o.note.trim() ? `: ${o.note.trim()}` : ""}`, reasonCode: o.reasonCode, kind: o.kind, watermark: isDuplicateMarked(o.kind), state: awaiting ? "Awaiting Quality approval" : "Printed" })
      return { id, awaiting }
    }),
  decide: (id: string, approve: boolean, note: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Approving a serial or nameplate reprint")
      const r = d.reprints.find((x) => x.id === id)!
      need(r.state === "Awaiting Quality approval", "This reprint is not waiting for approval.")
      need(approve || note.trim(), "Say why the reprint is rejected.", "note")
      r.state = approve ? "Printed" : "Rejected"
      r.approvedBy = ctx.userId
      r.approvedOn = ctx.today
      if (note.trim()) r.reason += ` (Quality: ${note.trim()})`
    }),
}

// ============================================================================ identify and relabel (FX-BC-RELABEL) and camera fallback (FX-BC-CAMERA)
export const relabelX = {
  /** Resolve found, unlabeled stock against the expected inventory of the bin; print; log the exception [DOC:p.97 Part F "Unlabeled stock exception"]. */
  resolve: (o: { bin: string; lineIndex: number | null; qty: number; printerId: string; note: string }) =>
    mut((d, ctx) => {
      requireRole(ctx, SUPERVISORS, "Identify and Relabel")
      const b = d.binExpected.find((x) => x.bin === o.bin.trim().toUpperCase())
      need(b, `Bin ${o.bin} is not known.`, "bin")
      need(o.qty > 0, "Enter the quantity found.", "qty")
      if (o.lineIndex == null) {
        const id = nextId(d, "RLB-TBD-")
        d.relabels.unshift({ id, bin: b!.bin, qty: o.qty, printerId: "-", by: ctx.userId, on: stamp(ctx), outcome: "No expected match: count exception", note: o.note.trim() || undefined })
        log(d, { at: stamp(ctx), device: "TC77", userId: ctx.userId, sp: "SP-20", payload: `${b!.bin} unlabeled qty ${o.qty}`, result: "Failed", error: "No expected match; count exception logged" })
        return { id, matched: false as const }
      }
      const line = b!.lines[o.lineIndex]
      need(line, "Choose the expected stock line it matches.", "line")
      need(o.qty <= line.qty, `Found quantity ${o.qty} is above the ${line.qty} ${line.uom} expected in ${b!.bin}; count it as an exception instead.`, "qty")
      const p = d.printers.find((x) => x.id === o.printerId)
      need(p?.active && (!p.health || p.health === "Online"), "Choose an active, online printer.", "printer")
      const id = nextId(d, "RLB-TBD-")
      d.relabels.unshift({ id, bin: b!.bin, materialId: line.materialId, batchId: line.batchId, qty: o.qty, printerId: o.printerId, labelId: line.batchId, by: ctx.userId, on: stamp(ctx), outcome: "Resolved to expected stock", note: o.note.trim() || undefined })
      log(d, { at: stamp(ctx), device: "TC77", userId: ctx.userId, sp: "SP-20", payload: `${b!.bin} ${line.batchId} relabel`, result: "OK" })
      return { id, matched: true as const, batchId: line.batchId }
    }),
}

export const cameraX = {
  /** Camera fallback scanning is permitted for supervisors only, slower, and logged [DOC:p.94 Part F]. */
  scan: (sp: ScanPointCode, code: string) =>
    mut((d, ctx) => {
      requireRole(ctx, SUPERVISORS, "Camera fallback scanning")
      need(code.trim(), "Hold the label in the frame, or type the code the camera could not read.", "code")
      const c = code.trim().toUpperCase()
      const known = /^(BAT|SN|BIN|HU|PO|WO|CAL|BDG|IL|RMA|DLV|GRN)-/.test(c) || /^CAL-\d{4}$/.test(c)
      const ok = known && c.length >= 6
      log(d, { at: stamp(ctx, "12:00"), device: `CAM-${ctx.userId.slice(-3)}`, userId: ctx.userId, sp, payload: c, result: ok ? "OK" : "Rejected", error: ok ? undefined : "Code not recognised (not a PE label format)", camera: true })
      // a rejected camera scan is logged too, so it returns a result instead of throwing (a throw would roll the log back)
      return ok ? { code: c, accepted: true as const, message: "" } : { code: c, accepted: false as const, message: `${c} is not a PE label format (batch, serial, bin, HU, PO, WO, CAL or badge). Rescan or move closer.` }
    }),
}

// ============================================================================ SPC (FX-QM-SPC)
export const spcX = {
  acknowledge: (key: string, note: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Acknowledging a trend alert")
      need(note.trim(), "Record what was checked or done about the signal.", "note")
      need(!d.spcAcks.some((a) => a.key === key), "This alert is already acknowledged.")
      d.spcAcks.unshift({ key, by: ctx.userId, on: ctx.today, note: note.trim() })
    }),
}

// ============================================================================ audits (FX-QM-AUDIT)
const auditLog = (a: { activity: { at: string; by: string; text: string }[] }, ctx: MutateCtx, text: string) => a.activity.push({ at: ctx.today, by: ctx.role, text })
export const auditX = {
  create: (o: { title: string; type: AuditType; scope: string; auditee: string; plannedOn: string; vendorId?: string; checklist: string[] }) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Scheduling an audit")
      need(o.title.trim(), "Name the audit.", "title")
      need(o.scope.trim(), "State the scope.", "scope")
      need(o.auditee.trim(), "Name the auditee.", "auditee")
      need(o.plannedOn >= ctx.today, "The planned date cannot be in the past.", "plannedOn")
      need(o.type !== "Supplier" || o.vendorId, "Choose the vendor for a supplier audit.", "vendor")
      const n = Math.max(0, ...d.audits.map((a) => Number(a.id.slice(-4)))) + 1
      const id = `AUD-${ctx.today.slice(0, 4)}-${String(n).padStart(4, "0")}`
      d.audits.unshift({
        id, title: o.title.trim(), type: o.type, scope: o.scope.trim(), vendorId: o.vendorId as never, auditorId: ctx.userId, auditee: o.auditee.trim(), plannedOn: o.plannedOn, state: "Planned",
        checklist: o.checklist.filter((q) => q.trim()).map((q) => ({ q: q.trim() })), findings: [], activity: [{ at: ctx.today, by: ctx.role, text: "Audit scheduled" }],
      })
      return id
    }),
  start: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Starting an audit")
      const a = d.audits.find((x) => x.id === id)!
      need(a.state === "Planned", "Only a planned audit can be started.")
      a.state = "In progress"
      a.startedOn = ctx.today
      auditLog(a, ctx, "Audit started")
    }),
  answer: (id: string, idx: number, result: "Conforming" | "Nonconforming" | "NA", note: string) =>
    mut((d) => {
      const a = d.audits.find((x) => x.id === id)!
      need(a.state === "In progress", "Answers are recorded while the audit is in progress.")
      need(result !== "Nonconforming" || note.trim(), "Describe the nonconformity.", "note")
      Object.assign(a.checklist[idx], { result, note: note.trim() || undefined })
    }),
  addFinding: (id: string, o: { clause: string; text: string; grade: AuditFinding["grade"]; dueOn?: string }) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Recording a finding")
      const a = d.audits.find((x) => x.id === id)!
      need(a.state === "In progress", "Findings are recorded while the audit is in progress.")
      need(o.clause.trim() && o.text.trim(), "Give the clause and the finding text.", "text")
      need(o.grade === "Observation" || o.dueOn, "Set a due date for the response.", "dueOn")
      need(!o.dueOn || o.dueOn >= ctx.today, "The due date cannot be in the past.", "dueOn")
      const f: AuditFinding = { id: `F${a.findings.length + 1}`, clause: o.clause.trim(), text: o.text.trim(), grade: o.grade, dueOn: o.dueOn || undefined, state: "Open" }
      a.findings.push(f)
      auditLog(a, ctx, `Finding ${f.id} recorded (${f.grade})`)
    }),
  issueReport: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Issuing an audit report")
      const a = d.audits.find((x) => x.id === id)!
      need(a.state === "In progress", "Only an audit in progress can issue its report.")
      const open = a.checklist.filter((q) => !q.result).length
      need(open === 0, `Answer every checklist question first (${open} open).`)
      const ncNoFinding = a.checklist.filter((q) => q.result === "Nonconforming").length > a.findings.length
      need(!ncNoFinding, "Every nonconforming answer needs a finding before the report is issued.")
      a.state = "Report issued"
      a.reportOn = ctx.today
      auditLog(a, ctx, `Report issued with ${a.findings.length} finding(s)`)
    }),
  /** CAPA sources include audit findings [DOC:p.88 §5]. The CAPA is created here and the finding links to it. */
  raiseCapa: (id: string, findingId: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Opening a CAPA")
      const a = d.audits.find((x) => x.id === id)!
      const f = a.findings.find((x) => x.id === findingId)!
      need(!f.capaId, `${findingId} already has ${f.capaId}.`)
      need(f.grade !== "Observation", "An observation does not need a CAPA; grade it Minor or Major first.")
      const capaId = nextId(d, "CAPA-TBD-") as CapaId
      const c: QtCapa = { id: capaId, title: `CAPA: ${f.text.slice(0, 70)}`, status: "Open", ncrIds: [], sources: [], problem: `Audit ${a.id} finding ${f.id} (${f.clause}): ${f.text}`, actions: [], ownerId: ctx.userId, openedOn: ctx.today, activity: [{ at: ctx.today, by: ctx.role, text: `Opened from audit finding ${a.id} ${f.id}` }] }
      d.capas.unshift(c)
      f.capaId = capaId
      auditLog(a, ctx, `${capaId} opened for finding ${f.id}`)
      return capaId
    }),
  closeFinding: (id: string, findingId: string, note: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality engineer", "Quality Manager"], "Closing a finding")
      const a = d.audits.find((x) => x.id === id)!
      const f = a.findings.find((x) => x.id === findingId)!
      need(f.state === "Open", "Already closed.")
      need(note.trim(), "Record the evidence that closes the finding.", "note")
      const capa = f.capaId ? d.capas.find((c) => c.id === f.capaId) : undefined
      need(f.grade !== "Major" || capa?.status === "Closed", "A Major finding closes after its CAPA is Closed (reading QT-R33).")
      Object.assign(f, { state: "Closed", closedOn: ctx.today, closeNote: note.trim() })
      auditLog(a, ctx, `Finding ${f.id} closed`)
    }),
  close: (id: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Closing an audit")
      const a = d.audits.find((x) => x.id === id)!
      need(a.state === "Report issued", "Issue the report before closing.")
      const open = a.findings.filter((f) => f.state === "Open").length
      need(open === 0, `${open} finding(s) are still open.`)
      a.state = "Closed"
      a.closedOn = ctx.today
      auditLog(a, ctx, "Audit closed")
    }),
  cancel: (id: string, reason: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager"], "Cancelling an audit")
      const a = d.audits.find((x) => x.id === id)!
      need(a.state === "Planned", "Only a planned audit can be cancelled.")
      need(reason.trim(), "A cancellation needs a reason.", "reason")
      a.state = "Cancelled"
      auditLog(a, ctx, `Cancelled: ${reason.trim()}`)
    }),
}

// ============================================================================ as-built dossier (FX-TRC-ASBUILT)
export const asBuiltX = {
  assemble: (serial: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager", "Quality engineer", "Document control"], "Assembling a certificate dossier")
      const f = d.finalTests.find((x) => x.serial === serial && x.finalResult === "Pass")
      need(f?.ftrId, `No Final Test Report for ${serial}: the dossier needs an issued FTR.`)
      need(f!.qmCountersign, `${f!.ftrId} is not countersigned by the Quality Manager yet.`)
      const tree = backward({ genealogy: d.genealogy, batches: d.batches, serials: d.serials, deviations: d.deviations }, { type: "serial", id: serial })
      const nodes = flatten(tree)
      const noCert = nodes.filter((n) => n.kind === "batch" && !d.batches.find((b) => b.id === n.id)?.certificate && d.batches.find((b) => b.id === n.id)?.vendorId).length
      const devs = treeDeviations({ genealogy: d.genealogy, batches: d.batches, serials: d.serials, deviations: d.deviations }, tree)
      const oqc = d.lots.find((l) => l.gate === "OQC" && l.serials.includes(serial as never) && l.decision === "Accepted")
      const rev = Math.max(0, ...d.asBuiltDossiers.filter((x) => x.serial === serial).map((x) => x.revision)) + 1
      const id = nextId(d, "ABD-TBD-")
      d.asBuiltDossiers.unshift({
        id, serial: serial as never, revision: rev, assembledOn: ctx.today, by: ctx.userId,
        items: [
          { key: "bom", label: `As-built bill of material with batch and serial genealogy (${nodes.length} nodes)` },
          { key: "ftr", label: "Final Test Report", ref: f!.ftrId },
          ...(oqc ? [{ key: "coc", label: `Certificate of conformance (OQC ${oqc.id})`, ref: oqc.id }] : []),
          { key: "mat", label: `Material and component certificates (${nodes.filter((n) => n.kind === "batch").length - noCert} on file${noCert ? `, ${noCert} missing` : ""})` },
          { key: "dev", label: devs.length ? `Deviations and waivers disclosed: ${devs.map((x) => x.id).join(", ")}` : "Deviations and waivers: none applied" },
          { key: "np", label: "Nameplate record (SP-13)" },
        ],
      })
      return id
    }),
  transmit: (dossierId: string, to: string) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager", "Document control"], "Transmitting a dossier")
      const x = d.asBuiltDossiers.find((r) => r.id === dossierId)!
      need(!x.transmittedOn, `${x.id} was already transmitted on ${x.transmittedOn}.`)
      need(to.trim(), "Name the recipient.", "to")
      x.transmittedTo = to.trim()
      x.transmittedOn = ctx.today
      x.transmittalNo = nextId(d, "TRN-TBD-")
    }),
}

// ============================================================================ test import (FX-QM-TESTIMPORT, DEC-08 Phase 2)
export interface ImportRow {
  seq: number
  value: number
  instrument: string
}
export function validateImport(d: QualityTraceState, finalTestId: string, rows: ImportRow[], today: string): string[] {
  const errs: string[] = []
  const f = d.finalTests.find((x) => x.id === finalTestId)
  if (!f) return [`No final test ${finalTestId}.`]
  const run = f.runs[f.runs.length - 1]
  if (!run || run.outcome) errs.push("The unit has no open run: start a run first (Final Test and FTR).")
  rows.forEach((r, i) => {
    const line = `Row ${i + 1}`
    const c = f.spec.find((x) => x.seq === r.seq)
    if (!c) return void errs.push(`${line}: characteristic ${r.seq} is not on this unit's plan.`)
    if (run?.retestScope && !run.retestScope.includes(r.seq)) errs.push(`${line}: ${c.name} is outside this retest's scope.`)
    if (c.charType !== "Quantitative") errs.push(`${line}: ${c.name} is attributive; import numeric characteristics only.`)
    if (Number.isNaN(r.value)) errs.push(`${line}: ${c.name} has a value that is not a number.`)
    if (!r.instrument.trim()) errs.push(`${line}: ${c.name} has no instrument ID.`)
    else {
      const k = checkInstrument(d, r.instrument, { today })
      if (!k.ok) errs.push(`${line}: ${k.error}`)
      else if (c.instrumentClass && k.instrument.type !== c.instrumentClass) errs.push(`${line}: ${k.instrument.label} is a ${k.instrument.type}; ${c.name} needs a ${c.instrumentClass} instrument.`)
    }
  })
  const dup = rows.map((r) => r.seq).filter((s, i, a) => a.indexOf(s) !== i)
  if (dup.length) errs.push(`Characteristic(s) ${[...new Set(dup)].join(", ")} appear more than once.`)
  return errs
}
export const importX = {
  /** All or nothing: any row error rejects the whole file and lists every error (downloadable log) [DOC:p.86 §3 Phase 2; import is transactional]. */
  commit: (finalTestId: string, rows: ImportRow[], meta: { template: string; fileName: string }) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Test technician", "Quality Manager"], "Importing test-set results")
      need(rows.length > 0, "The file has no rows.")
      const errs = validateImport(d, finalTestId, rows, ctx.today)
      need(errs.length === 0, `${errs.length} error(s): nothing was imported. First: ${errs[0]}`)
      const f = d.finalTests.find((x) => x.id === finalTestId)!
      const run = f.runs[f.runs.length - 1]
      for (const r of rows) {
        const k = checkInstrument(d, r.instrument, ctx)
        if (!k.ok) continue
        if (!run.instruments.includes(k.instrument.id)) run.instruments.push(k.instrument.id)
        run.results = [...run.results.filter((x) => x.seq !== r.seq), { seq: r.seq, value: r.value, instrumentId: k.instrument.id, by: ctx.userId, at: ctx.today }]
      }
      if (!run.sessions.includes(ctx.today)) run.sessions.push(ctx.today)
      const id = nextId(d, "TIM-TBD-")
      d.testImports.unshift({ id, finalTestId, run: run.run, template: meta.template, fileName: meta.fileName, rows: rows.length, recorded: rows.length, on: ctx.today, by: ctx.userId })
      f.activity.push({ at: ctx.today, by: ctx.role, text: `Imported ${rows.length} result(s) from ${meta.fileName} (${meta.template}) into run ${run.run}` })
      return { id, run: run.run }
    }),
}

// ============================================================================ stock status moves (FX-QM-INVALIGN)
const ALLOWED: Record<string, string[]> = { Unrestricted: ["Blocked", "Quarantine"], Blocked: ["Unrestricted", "Quarantine"], Quarantine: ["Unrestricted", "Blocked"], "QI Hold": [] }
export const stockX = {
  move: (batchId: string, to: "Unrestricted" | "Blocked" | "Quarantine", reason: string) =>
    mut((d, ctx) => {
      const b = d.batches.find((x) => x.id === batchId)!
      need(b.stock !== "QI Hold", "QI Hold clears only by an inspection decision (IQC): open the inspection.")
      need(ALLOWED[b.stock]?.includes(to), `${b.stock} cannot move to ${to} here.`)
      requireRole(ctx, to === "Unrestricted" ? ["Quality Manager"] : ["Quality engineer", "Quality Manager"], to === "Unrestricted" ? "Releasing blocked stock" : "A quality block")
      need(reason.trim(), "A stock status move needs a reason.", "reason")
      const recall = d.recalls.find((r) => r.stage !== "Closed" && r.suspect.batches.includes(batchId as never))
      need(to !== "Unrestricted" || !recall, `${batchId} is held by recall ${recall?.id}; release it from the campaign.`)
      const open = d.lots.find((l) => l.batchId === batchId && !l.decision)
      need(to !== "Unrestricted" || !open, `${open?.id} is still open for this batch; decide it first.`)
      const from = b.stock
      b.stock = to
      d.stockMoves.unshift({ id: nextId(d, "SMV-TBD-"), at: ctx.today, batchId: b.id, from, to, gate: "Manual", source: "Quality workbench", reason: reason.trim(), by: ctx.userId })
      ctx.emit("materials.stockStatusChanged", { batchId: b.id, from, to, reason: reason.trim() })
    }),
}

// ============================================================================ recall contact attempts (RCL-001)
export const contactX = {
  add: (o: Pick<ContactAttempt, "recallId" | "customerId" | "channel" | "contactName" | "outcome" | "note">) =>
    mut((d, ctx) => {
      requireRole(ctx, ["Quality Manager", "Quality engineer", "Customer service", "Customer Service Manager"], "Logging a contact attempt")
      const r = d.recalls.find((x) => x.id === o.recallId)!
      need(r.stage !== "Identify" && r.stage !== "Contain", "Customers are contacted after the notification is approved (C-52): the campaign must be at Notify or later.")
      need(r.population.some((p) => p.customerId === o.customerId), "That customer is not in this campaign's population.", "customer")
      need(o.contactName.trim(), "Name the person contacted.", "contactName")
      need(o.note.trim(), "Add a short note on what was said or sent.", "note")
      const id = nextId(d, "CNT-TBD-")
      d.contacts.unshift({ id, ...o, contactName: o.contactName.trim(), note: o.note.trim(), at: stamp(ctx), by: ctx.userId })
      r.activity.push({ at: ctx.today, by: ctx.role, text: `Contact attempt ${id}: ${o.channel}, ${o.outcome}` })
      return id
    }),
}


// ============================================================================ SCAR vendor response form (FX-QM-SCARRESP)
export const scarX = {
  /** The vendor answers D4-D8 on the emailed form (portal in Phase 3) [DOC:p.89 §6]. A submission needs all five sections,
   *  the respondent's name and email; it is recorded as the vendor's, not as the acting PE role. */
  submit: (id: string, o: { sections: Partial<Record<"D4" | "D5" | "D6" | "D7" | "D8", string>>; respondent: string; email: string; attachments: string[] }) =>
    mut((d, ctx) => {
      const s = d.scars.find((x) => x.id === id)!
      need(s.open, "This SCAR is closed; the form no longer accepts a response.")
      need(o.respondent.trim(), "Enter your name.", "respondent")
      need(/^\S+@\S+\.\S+$/.test(o.email.trim()), "Enter a valid email address.", "email")
      for (const k of ["D4", "D5", "D6", "D7", "D8"] as const) need(o.sections[k]?.trim(), `${k} is required.`, k)
      s.sections = { ...s.sections, ...Object.fromEntries(Object.entries(o.sections).map(([k, v]) => [k, (v ?? "").trim()])) }
      s.respondedOn = ctx.today
      s.activity.push({ at: ctx.today, by: "Vendor (emailed form)", text: `Vendor response D4-D8 submitted by ${o.respondent.trim()} (${o.email.trim()})${o.attachments.length ? `; attachments: ${o.attachments.join(", ")}` : ""}` })
      d.vendorResponses.unshift({ id: nextId(d, "VRS-TBD-"), scarId: id, on: stamp(ctx), respondent: o.respondent.trim(), email: o.email.trim(), attachments: o.attachments })
    }),
}
