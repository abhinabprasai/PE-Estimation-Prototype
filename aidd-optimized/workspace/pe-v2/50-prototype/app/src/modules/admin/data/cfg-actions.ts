// Actions of the configuration screens. Each is one atomic store.mutate("adminCfg", ...) (after a pure check
// and, where the PRD routes a change to an approver, one request on the admin engine) and returns {ok, value}
// or {ok:false, error, field}. Rules cite the PRD; readings carry an AR-n id (README).

import type { Role, UserId } from "@/data/domain"
import { TODAY, CUSTOMERS, VENDORS, LEGAL_ENTITIES } from "@/data/shared"
import { ProtoError, store, type MutateCtx, type Result } from "@/store"
import { addDays } from "@/lib/format"
import { NOW } from "./seed"
import { decide, raiseCfg } from "./actions"
import type { AlertDraft } from "../lib/cfg"
import { can, checkFormat, hasPending, inForce, validateAlert, validateTemplateText, requestState } from "../lib/cfg"
import type { CfgState, DigestMode, DpsChecklist, Locale, NoPlanPolicy, PlantRecord, PlanType, ReasonCode, CatalogId } from "./cfg-types"
import type { Channel } from "./types"

const cfg = <T,>(fn: (d: CfgState, ctx: MutateCtx) => T): Result<T> => store.mutate("adminCfg", fn)
const state = () => store.getSlice("adminCfg")
const inst = () => store.getSlice("admin").instances
const role = () => store.getCore().role
const bad = (error: string, field?: string): Result<string> => ({ ok: false, error, field })
const need = (ok: boolean, who: string, what: string) => {
  if (!ok) throw new ProtoError(`${what} is for the ${who}; switch role to continue.`)
}
const NEXT_MONTH = () => addDays(TODAY, 23)

// ============================================================================ alert rules (W.2)
export function saveAlert(draft: AlertDraft, id: string | undefined, expectedVersion: number | undefined, note: string, forceConflict = false): Result<string> {
  return cfg((d, ctx) => {
    const cur = id ? d.alerts.find((x) => x.id === id) : undefined
    if (id && !cur) throw new ProtoError(`${id} not found.`)
    if (cur) need(can.alert(ctx.role, cur), cur.owner, "Editing this rule")
    if (cur && (forceConflict || (expectedVersion != null && cur.version !== expectedVersion))) throw new ProtoError(`Conflict: ${cur.id} is now version ${cur.version + 1}, saved by someone else after you opened it. Reload the rule and apply your change again.`)
    const err = validateAlert(draft, d.alerts, id)
    if (err) throw new ProtoError(err.error, err.field)
    if (cur && !note.trim()) throw new ProtoError("Say what changed; the version history keeps it.", "note")
    const body = {
      name: draft.name.trim(), trigger: draft.trigger, when: draft.when.trim(), condition: draft.condition.trim(), scope: draft.scope.trim(), severity: draft.severity,
      roles: draft.roles, users: draft.users as UserId[], channels: { inApp: draft.inApp, email: draft.email }, dedupeMinutes: draft.dedupeMinutes, digest: draft.digest as DigestMode,
    }
    if (cur) {
      Object.assign(cur, body)
      cur.version += 1
      cur.history.push({ at: NOW, by: ctx.userId, what: `Version ${cur.version}: ${note.trim()}` })
      return `${cur.id} saved as version ${cur.version}.`
    }
    const nid = `AL-${String(d.alerts.length + 1).padStart(2, "0")}`
    d.alerts.push({ id: nid, ...body, owner: ctx.role, enabled: true, version: 1, source: "Added on this screen", history: [{ at: NOW, by: ctx.userId, what: "Rule created" }], noise: { fired: 0, suppressed: 0, acknowledged: 0 } })
    return `${nid} created, owned by the ${ctx.role}.`
  })
}
export function toggleAlert(id: string, enabled: boolean, note: string): Result<string> {
  return cfg((d, ctx) => {
    const r = d.alerts.find((x) => x.id === id)
    if (!r) throw new ProtoError(`${id} not found.`)
    need(can.alert(ctx.role, r), r.owner, "Switching this rule")
    if (!enabled && r.severity === "Critical" && !note.trim()) throw new ProtoError("Disabling a Critical rule needs a reason; it is kept on the history.", "note")
    r.enabled = enabled
    r.history.push({ at: NOW, by: ctx.userId, what: `${enabled ? "Enabled" : "Disabled"}${note.trim() ? `: ${note.trim()}` : ""}` })
    return `${r.id} ${enabled ? "enabled" : "disabled"}.`
  })
}
/** The monthly noise review is owned by each rule's owner [DOC:p.10 W.2]. */
export function signNoiseReview(id: string, note: string): Result<string> {
  return cfg((d, ctx) => {
    const r = d.alerts.find((x) => x.id === id)
    if (!r) throw new ProtoError(`${id} not found.`)
    need(ctx.role === r.owner, r.owner, "The noise review of this rule")
    if (!note.trim()) throw new ProtoError("Record what the review decided (keep, tune or retire).", "note")
    r.noiseReview = { month: TODAY.slice(0, 7), by: ctx.userId, note: note.trim() }
    r.history.push({ at: NOW, by: ctx.userId, what: `Noise review ${TODAY.slice(0, 7)}: ${note.trim()}` })
    return `Noise review for ${r.id} signed off.`
  })
}

// ============================================================================ notification templates
export function saveTemplateDraft(id: string, subject: Record<Locale, string>, body: Record<Locale, string>, note: string): Result<string> {
  return cfg((d, ctx) => {
    const t = d.templates.find((x) => x.id === id)
    if (!t) throw new ProtoError(`${id} not found.`)
    need(can.template(ctx.role, t), t.owner, "Editing this template")
    if (!subject["en-US"].trim() || !body["en-US"].trim()) throw new ProtoError("The en-US subject and body are required: every other language falls back to it.", "en-US")
    for (const l of ["en-US", "fr-CA"] as Locale[])
      for (const txt of [subject[l], body[l]]) {
        const e = validateTemplateText(txt, t.placeholders)
        if (e) throw new ProtoError(`${l}: ${e}`, l)
      }
    if (!note.trim()) throw new ProtoError("Say what changed.", "note")
    const draft = [...t.versions].reverse().find((v) => v.state === "Draft")
    if (draft) {
      draft.subject = subject
      draft.body = body
      draft.note = note.trim()
      draft.by = ctx.userId
      return `${t.id} draft v${draft.version} saved.`
    }
    const v = Math.max(...t.versions.map((x) => x.version)) + 1
    t.versions.push({ version: v, state: "Draft", subject, body, effectiveFrom: NEXT_MONTH(), by: ctx.userId, note: note.trim() })
    return `${t.id} draft v${v} created; the active version stays in use until you activate it.`
  })
}
export function activateTemplate(id: string, version: number, acceptFallback: boolean): Result<string> {
  return cfg((d, ctx) => {
    const t = d.templates.find((x) => x.id === id)
    const v = t?.versions.find((x) => x.version === version)
    if (!t || !v) throw new ProtoError("Template version not found.")
    need(can.template(ctx.role, t), t.owner, "Activating a template")
    if (v.state !== "Draft") throw new ProtoError(`Version ${version} is ${v.state.toLowerCase()}; only a draft is activated.`)
    if (!v.subject["fr-CA"].trim() || !v.body["fr-CA"].trim()) if (!acceptFallback) throw new ProtoError("The fr-CA slot is empty: French recipients would get the English text. Fill it, or confirm the fallback.", "fallback")
    for (const o of t.versions) if (o.state === "Active") o.state = "Retired"
    v.state = "Active"
    v.effectiveFrom = TODAY
    return `${t.id} v${version} is active; v${t.versions.find((x) => x.state === "Retired")?.version ?? "?"} is retired and stays on the history.`
  })
}

// ============================================================================ KPI dictionary
export function proposeKpi(id: string, value: { formula: string; grain: string; filters: string; target: string; lineage: string; freshness: "Real-time" | "15-minute" | "Daily" }, from: string, note: string): Result<string> {
  const k = state().kpis.find((x) => x.id === id)
  if (!k) return bad(`${id} not found.`)
  if (hasPending(k.versions, inst())) return bad("A change to this KPI is already waiting for approval.")
  if (!value.formula.trim()) return bad("Give the formula.", "formula")
  if (!value.grain.trim() || !value.lineage.trim()) return bad("Grain and source lineage are part of every dictionary row.", "grain")
  if (!from || from <= TODAY) return bad("Effective date must be after today; a KPI row is never edited in place (C-50).", "from")
  if (!note.trim()) return bad("Say why the KPI changes.", "note")
  const dup = state().kpis.find((x) => x.id !== id && x.versions.some((v) => v.value.formula.trim().toLowerCase() === value.formula.trim().toLowerCase()))
  if (dup) return bad(`${dup.id} ${dup.name} already uses this formula: one formula per KPI.`, "formula")
  const steps: Role[] = role() === k.owner ? ["Process owner"] : [k.owner]
  const r = raiseCfg({ id: k.id, label: `KPI · ${k.name}`, route: `/configuration/kpi-dictionary?kpi=${k.id}`, title: `${k.name}: new definition from ${from}. ${note.trim()}`, steps, reading: "AR-37: a KPI row change goes to its owner; the owner's own change goes to the Process owner" })
  if (!r.ok) return r
  return cfg((d, ctx) => {
    d.kpis.find((x) => x.id === id)!.versions.push({ value, effectiveFrom: from, by: ctx.userId, note: note.trim(), requestId: r.value })
    return `${id} change raised as ${r.value} for the ${steps.join(", then the ")}.`
  })
}
export function addKpi(name: string, owner: Role, value: { formula: string; grain: string; filters: string; target: string; lineage: string; freshness: "Real-time" | "15-minute" | "Daily" }, shownOn: string): Result<string> {
  if (!name.trim()) return bad("Name the KPI.", "name")
  if (state().kpis.some((k) => k.name.trim().toLowerCase() === name.trim().toLowerCase())) return bad("A KPI with this name exists. A number on two dashboards from two formulas is a defect: change the existing row.", "name")
  if (!value.formula.trim() || !value.grain.trim() || !value.lineage.trim()) return bad("Formula, grain and source lineage are required.", "formula")
  if (state().kpis.some((k) => k.versions.some((v) => v.value.formula.trim().toLowerCase() === value.formula.trim().toLowerCase()))) return bad("This formula already defines another KPI.", "formula")
  const id = `KPI-${String(state().kpis.length + 1).padStart(2, "0")}`
  const r = raiseCfg({ id, label: `KPI · ${name.trim()}`, route: `/configuration/kpi-dictionary?kpi=${id}`, title: `New KPI ${name.trim()} (owner ${owner})`, steps: ["Process owner"], reading: "AR-37: a new KPI row is approved by the Process owner" })
  if (!r.ok) return r
  return cfg((d, ctx) => {
    d.kpis.push({ id, name: name.trim(), owner, source: "Added on this screen", shownOn: shownOn.split(",").map((x) => x.trim()).filter(Boolean), versions: [{ value, effectiveFrom: TODAY, by: ctx.userId, note: "New KPI", requestId: r.value }] })
    return `${id} raised as ${r.value}; it is in the dictionary once the Process owner approves.`
  })
}
export function alignKpi(id: string): Result<string> {
  return cfg((d, ctx) => {
    const k = d.kpis.find((x) => x.id === id)
    if (!k?.competing?.length) throw new ProtoError("This KPI has no competing formula.")
    need(ctx.role === k.owner, k.owner, "Aligning this KPI")
    k.shownOn = k.shownOn.filter((s) => !k.competing!.some((c) => c.where === s)).concat(k.competing.map((c) => `${c.where} (now reads this definition)`))
    k.competing = undefined
    return `${k.id}: the competing formula is retired; every screen reads the dictionary row.`
  })
}

// ============================================================================ access recertification (Book III C §3)
/** The attesting manager answers every row; Revoke rows are removed on approval. The attestation is the WF-27 request. */
export function attestSheet(sheetId: string, answers: Record<string, "Keep" | "Revoke">, comment: string, channel: Channel = "In-app"): Result<string> {
  const sh = state().recert.find((x) => x.id === sheetId)
  if (!sh) return bad(`${sheetId} not found.`)
  const open = sh.items.filter((i) => ((answers[i.id] ?? i.answer) as string) === "Pending")
  if (open.length) return bad(`${open.length} of ${sh.items.length} users have no answer yet. Keep or revoke every one.`)
  const revoked = sh.items.filter((i) => (answers[i.id] ?? i.answer) === "Revoke").length
  const r = decide(sh.requestId, "Approved", `${comment.trim() || "Attested"}${revoked ? `; ${revoked} revoked` : ""}`, channel)
  if (!r.ok) return r
  return cfg((d) => {
    const s = d.recert.find((x) => x.id === sheetId)!
    for (const i of s.items) i.answer = answers[i.id] ?? i.answer
    return `${sheetId} attested${revoked ? `, ${revoked} access rights revoked` : ""}.`
  })
}
export function failSheet(sheetId: string, reason: string): Result<string> {
  const sh = state().recert.find((x) => x.id === sheetId)
  if (!sh) return bad(`${sheetId} not found.`)
  if (!reason.trim()) return bad("Say why the attestation failed.", "reason")
  const r = decide(sh.requestId, "Rejected", reason.trim())
  if (!r.ok) return r
  return cfg((d) => {
    const s = d.recert.find((x) => x.id === sheetId)!
    for (const i of s.items) if (i.answer === "Pending") i.answer = "Revoke"
    s.autoRevoked = { on: NOW, reason: reason.trim() }
    return `${sheetId} failed: every unanswered access right is revoked automatically.`
  })
}
export function setRecertAnswer(sheetId: string, itemId: string, answer: "Keep" | "Revoke" | "Pending"): Result<string> {
  return cfg((d) => {
    const it = d.recert.find((x) => x.id === sheetId)?.items.find((x) => x.id === itemId)
    if (!it) throw new ProtoError("Item not found.")
    it.answer = answer
    return "Saved."
  })
}

// ============================================================================ number series (new)
export function proposeNewSeries(seriesId: string, format: string, next: number, from: string, note: string): Result<string> {
  const s = state().series.find((x) => x.id === seriesId)
  if (!s) return bad(`${seriesId} not found.`)
  if (hasPending(s.versions, inst())) return bad("A change to this series is already waiting for approval.")
  const cur = inForce(s.versions, inst())?.value
  const chk = checkFormat(format, next)
  if (!chk.ok) return bad(chk.error!, "format")
  const floor = Math.max(...Object.values(s.counters))
  if (!Number.isInteger(next) || next < floor) return bad(`The next number cannot go below ${floor}: numbers already issued would repeat.`, "next")
  if (!from || from <= TODAY) return bad("Effective date must be after today; history is never edited in place (C-50).", "from")
  if (!note.trim()) return bad("Say why it changes.", "note")
  if (cur && cur.format === format.trim() && cur.next === next) return bad("Nothing changes: enter a new format or a higher next number.", "format")
  const r = raiseCfg({ id: s.id, label: `Number series · ${s.docType}`, route: `/configuration/number-series?series=${s.id}`, title: `${s.docType} series: ${cur?.format} → ${format.trim()}, next ${next}, effective ${from}`, steps: ["Plant IT"], reading: "AR-30: number series have no owner in the register; Plant IT approves a series that is not gap-free" })
  if (!r.ok) return r
  return cfg((d, ctx) => {
    d.series.find((x) => x.id === seriesId)!.versions.push({ value: { format: format.trim(), next }, effectiveFrom: from, by: ctx.userId, note: note.trim(), requestId: r.value })
    return `${seriesId} change raised as ${r.value} for Plant IT.`
  })
}

// ============================================================================ RMA policy and quality no-plan policy
export function proposeRestock(reasonId: string, pct: number, from: string, note: string): Result<string> {
  const rr = state().rmaReasons.find((x) => x.id === reasonId)
  if (!rr) return bad(`${reasonId} not found.`)
  if (hasPending(rr.versions, inst())) return bad("A change to this restocking default is already waiting for approval.")
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) return bad("A restocking fee is 0 to 50 percent (design limit; the specification gives 15% and 10% and 0 otherwise).", "pct")
  if (!from || from <= TODAY) return bad("Effective date must be after today (C-50).", "from")
  if (!note.trim()) return bad("Say why it changes.", "note")
  const cur = inForce(rr.versions, inst())?.value.restockPct
  if (cur === pct) return bad("Nothing changes: enter a different percentage.", "pct")
  const r = raiseCfg({ id: rr.id, label: `RMA policy · ${rr.reason}`, route: `/configuration/rma-policy?section=restocking`, title: `Restocking default for ${rr.reason}: ${cur}% → ${pct}%, effective ${from}`, steps: ["Customer Service Manager", "Controller"], reading: "AR-15: the policy owner approves; the Controller joins because the fee posts to 4910 (W.1 posting-gating)" })
  if (!r.ok) return r
  return cfg((d, ctx) => {
    d.rmaReasons.find((x) => x.id === reasonId)!.versions.push({ value: { restockPct: pct }, effectiveFrom: from, by: ctx.userId, note: note.trim(), requestId: r.value })
    return `${reasonId} change raised as ${r.value} for the Customer Service Manager, then the Controller.`
  })
}
/** Quality policy per plan type [DOC:pp.34-35 §6.5]: Auto-Accept with Warning is permitted only for non-QI-required items and never for FIN or PSI. */
export function proposeNoPlan(planType: PlanType, policy: NoPlanPolicy, from: string, note: string): Result<string> {
  const row = state().noPlan.find((x) => x.planType === planType)
  if (!row) return bad("Plan type not found.")
  if (hasPending(row.versions, inst())) return bad("A change to this plan type is already waiting for approval.")
  if (policy === "Auto-Accept with Warning" && (planType === "FIN" || planType === "PSI")) return bad(`Auto-Accept with Warning is never allowed for ${planType}: a finished unit cannot pass without a plan (§6.5).`, "policy")
  if (!from || from <= TODAY) return bad("Effective date must be after today (C-50).", "from")
  if (!note.trim()) return bad("Say why it changes.", "note")
  if (inForce(row.versions, inst())?.value.policy === policy) return bad("Nothing changes: choose a different policy.", "policy")
  const r = raiseCfg({ id: `NOPLAN-${planType}`, label: `Quality no-plan policy · ${planType}`, route: "/configuration/settings/quality?section=noplan", title: `No-plan policy for ${planType}: ${inForce(row.versions, inst())?.value.policy} → ${policy}, effective ${from}`, steps: ["Quality Manager"], reading: "AR-15: the Quality Manager owns the Quality Policy setting" })
  if (!r.ok) return r
  return cfg((d, ctx) => {
    d.noPlan.find((x) => x.planType === planType)!.versions.push({ value: { policy, qiRequiredOnly: policy === "Auto-Accept with Warning" }, effectiveFrom: from, by: ctx.userId, note: note.trim(), requestId: r.value })
    return `${planType} policy change raised as ${r.value} for the Quality Manager.`
  })
}

// ============================================================================ material settings
export function proposeGroupNode(input: { level: 2 | 3; parentId: string; code: string; name: string; from: string; note: string }): Result<string> {
  const c = state()
  const parent = c.matGroups.find((g) => g.id === input.parentId)
  if (!parent) return bad("Pick the parent node.", "parent")
  if (parent.level !== input.level - 1) return bad(`A level ${input.level} node sits under a level ${input.level - 1} node.`, "parent")
  if (!input.code.trim() || !input.name.trim()) return bad("Give the node a code and a name.", "code")
  if (c.matGroups.some((g) => g.parentId === input.parentId && (g.code.toLowerCase() === input.code.trim().toLowerCase() || g.name.toLowerCase() === input.name.trim().toLowerCase()))) return bad("A sibling node already has this code or name.", "code")
  if (!input.from || input.from <= TODAY) return bad("Effective date must be after today; the hierarchy is effective-dated.", "from")
  if (!input.note.trim()) return bad("Say why the node is added.", "note")
  const id = `G-NEW-${c.seq}`
  const r = raiseCfg({ id, label: `Material group · ${input.code.trim()}`, route: "/configuration/material-settings?section=groups", title: `Add level ${input.level} group ${input.code.trim()} ${input.name.trim()} under ${parent.code}, effective ${input.from}`, steps: ["Materials Manager"], reading: "Book II §2.4: the Materials Manager approves the hierarchy" })
  if (!r.ok) return r
  return cfg((d, ctx) => {
    d.matGroups.push({ id, level: input.level, parentId: input.parentId, code: input.code.trim(), name: input.name.trim(), validFrom: input.from, requestId: r.value, by: ctx.userId })
    d.seq++
    return `${input.code.trim()} raised as ${r.value} for the Materials Manager.`
  })
}
/** Nodes deactivate, never delete [DOC:p.139 §2.4]. */
export function proposeDeactivate(nodeId: string, from: string, note: string): Result<string> {
  const c = state()
  const n = c.matGroups.find((g) => g.id === nodeId)
  if (!n) return bad("Node not found.")
  if (n.deactivatedFrom || n.deactivateRequestId) return bad("This node is already deactivated or has a deactivation waiting.")
  if (c.matGroups.some((g) => g.parentId === nodeId && !g.deactivatedFrom)) return bad("Deactivate the active child nodes first: a parent cannot be inactive while a child is in use.")
  if (!from || from <= TODAY) return bad("Effective date must be after today.", "from")
  if (!note.trim()) return bad("Say why the node is deactivated.", "note")
  const r = raiseCfg({ id: `${n.id}-OFF`, label: `Material group · ${n.code}`, route: "/configuration/material-settings?section=groups", title: `Deactivate group ${n.code} ${n.name} from ${from}. Existing materials keep it; new ones cannot use it.`, steps: ["Materials Manager"], reading: "Book II §2.4: nodes deactivate, never delete" })
  if (!r.ok) return r
  return cfg((d) => {
    const x = d.matGroups.find((g) => g.id === nodeId)!
    x.deactivatedFrom = from
    x.deactivateRequestId = r.value
    return `Deactivation of ${n.code} raised as ${r.value}.`
  })
}
export function addCharClass(input: { groupId: string; key: string; type: "Number" | "Text" | "List"; unit: string; values: string; searchable: boolean; printable: boolean }): Result<string> {
  return cfg((d, ctx) => {
    need(can.material(ctx.role), "Materials Manager or Material steward", "Adding a characteristic")
    const g = d.matGroups.find((x) => x.id === input.groupId && x.level === 1)
    if (!g) throw new ProtoError("Characteristics are defined per level 1 material group.", "group")
    if (!input.key.trim()) throw new ProtoError("Name the characteristic.", "key")
    if (d.charClasses.some((c) => c.groupId === input.groupId && c.key.toLowerCase() === input.key.trim().toLowerCase())) throw new ProtoError(`${g.code} already has a characteristic named ${input.key.trim()}.`, "key")
    if (input.type === "Number" && !input.unit.trim()) throw new ProtoError("A numeric characteristic needs a unit.", "unit")
    if (input.type === "List" && input.values.split(",").filter((x) => x.trim()).length < 2) throw new ProtoError("A list needs at least two values, separated by commas.", "values")
    if (!input.searchable && !input.printable) throw new ProtoError("Phase 1 characteristics are search and print data: switch on at least one.", "searchable")
    const id = `CH-${String(d.charClasses.length + 1).padStart(2, "0")}`
    d.charClasses.push({ id, groupId: input.groupId, key: input.key.trim(), type: input.type, unit: input.unit.trim() || undefined, values: input.type === "List" ? input.values.trim() : undefined, searchable: input.searchable, printable: input.printable })
    return `${id} ${input.key.trim()} added to ${g.code}.`
  })
}
export function proposeMatrixCell(behaviour: string, type: string, value: string, note: string): Result<string> {
  const row = state().typeMatrix.find((x) => x.behaviour === behaviour)
  if (!row) return bad("Behavior not found.")
  if (row.pending?.some((p) => p.type === type && requestState(p.requestId, TODAY, inst()) === "Pending approval")) return bad("A change to this cell is already waiting for approval.")
  if (!value.trim()) return bad("Enter the new cell value.", "value")
  if (value.trim() === row.cells[type]) return bad("Nothing changes: enter a different value.", "value")
  if (type === "SERV" && behaviour === "Inventory-managed" && /^yes$/i.test(value.trim())) return bad("A SERV material can never create stock: Inventory-managed stays No for SERV (§2.2).", "value")
  if (!note.trim()) return bad("Say why it changes.", "note")
  const r = raiseCfg({ id: `MATRIX-${behaviour}-${type}`, label: `Type behavior · ${behaviour} / ${type}`, route: "/configuration/material-settings?section=matrix", title: `${behaviour} for ${type}: ${row.cells[type]} → ${value.trim()}`, steps: ["Materials Manager"], reading: "AR-38: the matrix is configuration seed data; a cell change goes to the Materials Manager" })
  if (!r.ok) return r
  return cfg((d) => {
    const x = d.typeMatrix.find((y) => y.behaviour === behaviour)!
    x.pending = [...(x.pending ?? []), { type, value: value.trim(), requestId: r.value }]
    return `Cell change raised as ${r.value} for the Materials Manager.`
  })
}

// ============================================================================ plants and lanes (Book VII §4)
export interface PlantDraft {
  code: string
  name: string
  entityId: string
  address: string
  calendar: string
  receivingWarehouse: string
  shippingWarehouse: string
  shippingPoint: string
  leadTimeDays: number
  planningTimeFenceDays: number
  mrpArea: string
  safetyTimeDays: number
}
export function savePlant(draft: PlantDraft, id?: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.plantDraft(ctx.role), "Plant IT (IT admin drafts, the Controller approves)", "Drafting a plant")
    const cur = id ? d.plants.find((p) => p.id === id) : undefined
    if (cur && cur.state !== "Draft") throw new ProtoError(`${cur.code} is ${cur.state.toLowerCase()}; its identity is fixed. Only a draft plant is edited.`)
    if (!/^PL-TBD-\d{2}$/.test(draft.code.trim())) throw new ProtoError("The plant code format is not given yet (OQ-30); use PL-TBD-nn.", "code")
    if (d.plants.some((p) => p.id !== id && p.code === draft.code.trim())) throw new ProtoError("Another plant has this code.", "code")
    if (!draft.name.trim() || !draft.address.trim() || !draft.calendar.trim()) throw new ProtoError("Name, address and working calendar are required (setup step 1).", "name")
    if (!draft.receivingWarehouse.trim() || !draft.shippingWarehouse.trim()) throw new ProtoError("Name the default receiving and shipping warehouses.", "receivingWarehouse")
    for (const [k, v] of [["leadTimeDays", draft.leadTimeDays], ["planningTimeFenceDays", draft.planningTimeFenceDays], ["safetyTimeDays", draft.safetyTimeDays]] as const) if (!Number.isInteger(v) || v < 0) throw new ProtoError("Planning parameters are whole days, zero or more.", k)
    const body = {
      code: draft.code.trim(), name: draft.name.trim(), entityId: draft.entityId as PlantRecord["entityId"], address: draft.address.trim(), calendar: draft.calendar.trim(),
      receivingWarehouse: draft.receivingWarehouse.trim(), shippingWarehouse: draft.shippingWarehouse.trim(), shippingPoints: [draft.shippingPoint.trim() || "Implicit shipping point"],
      planning: { leadTimeDays: draft.leadTimeDays, planningTimeFenceDays: draft.planningTimeFenceDays, mrpArea: draft.mrpArea.trim() || draft.code.trim(), safetyTimeDays: draft.safetyTimeDays },
    }
    if (cur) {
      Object.assign(cur, body)
      cur.history.push({ at: NOW, by: ctx.userId, what: "Draft edited" })
      return `${cur.code} saved.`
    }
    const steps: PlantRecord["steps"] = [
      ["Create the plant with entity, calendar and address", "MP-PLANT-001", false], ["Create its warehouses, zones and bins", "INV warehouse model", true], ["Create work centers, cost center nodes and rates for the plant", "Book I D §2, H, I §2", true],
      ["Extend materials to the plant with plant-level data completion", "MM Extend action, Book II §3.3", true], ["Pair production versions per material and plant", "Book IV §6.1", true], ["Define transfer lanes in both directions with transit times", "MP-LANE-001", false],
      ["Set sourcing rules per material and plant", "Planning view special procurement; §4.4 sourcing table", false], ["Configure intercompany pairing where the plants sit in different entities", "Book III F §3, FL-07", false],
      ["Run the multi-plant test packs and the cross-plant recall drill", "FL-04, FL-07, FL-08 in network configuration", false],
    ].map(([action, where, gate], i) => ({ n: i + 1, action: action as string, where: where as string, gate: gate as boolean, done: i === 0, ...(i === 0 ? { evidence: "Plant record created", by: ctx.userId, on: TODAY } : {}) }))
    d.plants.push({ id: body.code, ...body, state: "Draft", steps, history: [{ at: NOW, by: ctx.userId, what: "Draft plant created" }] })
    return `${body.code} created as a draft.`
  })
}
export function setSetupStep(plantId: string, n: number, done: boolean, evidence: string): Result<string> {
  return cfg((d, ctx) => {
    const p = d.plants.find((x) => x.id === plantId)
    const st = p?.steps.find((x) => x.n === n)
    if (!p || !st) throw new ProtoError("Step not found.")
    need(can.plantDraft(ctx.role) || can.plantApprove(ctx.role), "Plant IT or the Controller", "Verifying a setup step")
    if (p.state === "Inactive") throw new ProtoError("An inactive plant is read-only.")
    if (done && evidence.trim().length < 5) throw new ProtoError("Record the evidence (what was checked), at least 5 characters.", "evidence")
    st.done = done
    st.evidence = done ? evidence.trim() : undefined
    st.by = done ? ctx.userId : undefined
    st.on = done ? TODAY : undefined
    p.history.push({ at: NOW, by: ctx.userId, what: `Step ${n} ${done ? "verified" : "reopened"}` })
    return `Step ${n} ${done ? "verified" : "reopened"}.`
  })
}
export function requestPlantState(plantId: string, target: "Active" | "Inactive", reason: string): Result<string> {
  const c = state()
  const p = c.plants.find((x) => x.id === plantId)
  if (!p) return bad("Plant not found.")
  if (!can.plantDraft(role())) return bad("Activation and deactivation are raised by Plant IT (IT admin drafts) and approved by the Controller.")
  if (p.stateRequestId && requestState(p.stateRequestId, TODAY, inst()) === "Pending approval") return bad("A request on this plant is already waiting for the Controller.")
  if (target === "Active") {
    if (p.state === "Active") return bad("The plant is already active.")
    const missing = p.steps.filter((s) => s.gate && !s.done).map((s) => s.n)
    if (missing.length) return bad(`Setup steps ${missing.join(", ")} are not verified. Activate after steps 2 to 5 verify (Book VII §4).`)
  } else {
    if (p.state !== "Active") return bad("Only an active plant is deactivated.")
    if (c.plants.filter((x) => x.state === "Active").length <= 1) return bad(`${p.code} is the only active plant: deactivating it would stop every new document. Activate another plant first.`)
    if (!reason.trim()) return bad("Say why the plant is deactivated.", "reason")
  }
  const r = raiseCfg({ id: `${p.id}-${target}`, label: `Plant · ${p.code}`, route: `/configuration/plants/${p.id}`, title: `${target === "Active" ? "Activate" : "Deactivate"} ${p.code} ${p.name}${reason.trim() ? `. ${reason.trim()}` : ""}`, steps: ["Controller"], reading: "Book VII §4: IT admin drafts, the Controller approves. Deactivate blocks new documents only" })
  if (!r.ok) return r
  return cfg((d) => {
    const x = d.plants.find((y) => y.id === plantId)!
    x.stateRequestId = r.value
    x.stateTarget = target
    x.history.push({ at: NOW, by: store.getCore().userId, what: `${target === "Active" ? "Activation" : "Deactivation"} requested (${r.value})` })
    return `${target === "Active" ? "Activation" : "Deactivation"} raised as ${r.value} for the Controller.`
  })
}
export interface LaneDraft { fromPlant: string; toPlant: string; transitDays: number; mode: "Truck" | "Rail" | "Air" | "Ocean"; calendar: string; costPerKg: number }
export function saveLane(draft: LaneDraft, id?: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.lane(ctx.role), "Planning Manager", "Maintaining lanes")
    if (draft.fromPlant === draft.toPlant) throw new ProtoError("From and to plant must differ: a lane joins two plants, in one explicit direction.", "toPlant")
    if (!d.plants.some((p) => p.id === draft.fromPlant) || !d.plants.some((p) => p.id === draft.toPlant)) throw new ProtoError("Pick two plants from the plant master.", "fromPlant")
    if (!Number.isInteger(draft.transitDays) || draft.transitDays < 1 || draft.transitDays > 60) throw new ProtoError("Transit time is 1 to 60 whole days.", "transitDays")
    if (!Number.isFinite(draft.costPerKg) || draft.costPerKg < 0) throw new ProtoError("Cost per unit weight cannot be negative.", "costPerKg")
    if (!draft.calendar.trim()) throw new ProtoError("Name the lane calendar.", "calendar")
    if (d.lanes.some((l) => l.id !== id && l.fromPlant === draft.fromPlant && l.toPlant === draft.toPlant && l.mode === draft.mode && l.active)) throw new ProtoError(`An active ${draft.mode} lane already joins these plants in this direction; change it instead.`, "mode")
    const cur = id ? d.lanes.find((l) => l.id === id) : undefined
    if (cur) {
      Object.assign(cur, draft)
      cur.history.push({ at: NOW, by: ctx.userId, what: "Lane edited" })
      return `${cur.id} saved.`
    }
    const nid = `LN-${String(d.lanes.length + 1).padStart(3, "0")}`
    d.lanes.push({ id: nid, ...draft, active: true, history: [{ at: NOW, by: ctx.userId, what: "Lane created" }] })
    return `${nid} created${d.lanes.some((l) => l.fromPlant === draft.toPlant && l.toPlant === draft.fromPlant && l.active) ? "" : "; the reverse direction has no lane yet (setup step 6 asks for both)"}.`
  })
}
export function toggleLane(id: string, active: boolean): Result<string> {
  return cfg((d, ctx) => {
    need(can.lane(ctx.role), "Planning Manager", "Maintaining lanes")
    const l = d.lanes.find((x) => x.id === id)
    if (!l) throw new ProtoError("Lane not found.")
    l.active = active
    l.history.push({ at: NOW, by: ctx.userId, what: active ? "Activated" : "Deactivated: stops new transfer proposals only; open transfers continue" })
    return `${id} ${active ? "activated" : "deactivated; new transfer proposals stop, open transfers continue"}.`
  })
}

// ============================================================================ intercompany (Book III F §3-4)
export function proposeMarkup(markupId: string, pct: number, rationale: string, from: string, note: string): Result<string> {
  const m = state().icMarkups.find((x) => x.id === markupId)
  if (!m) return bad("Markup row not found.")
  if (!can.transferPrice(role())) return bad("Transfer price maintenance is restricted to Controlling (Book III F §3, SoD).")
  if (hasPending(m.versions, inst())) return bad("A change to this markup is already waiting for approval.")
  if (!Number.isFinite(pct) || pct < 0 || pct > 40) return bad("Markup is 0 to 40 percent (design limit).", "pct")
  if (rationale.trim().length < 10) return bad("Attach the rationale (tax compliance file reference): a markup change without one is not accepted.", "rationale")
  if (!from || from <= TODAY) return bad("Effective date must be after today; a markup is effective-dated and never edited in place.", "from")
  if (!note.trim()) return bad("Say why it changes.", "note")
  const pair = state().icPairs.find((p) => p.id === m.pairId)
  const steps: Role[] = role() === "Controller" ? ["CFO"] : ["Controller"]
  const cur = inForce(m.versions, inst())?.value.markupPct
  const r = raiseCfg({ id: m.id, label: `IC markup · ${m.family}`, route: "/configuration/intercompany?section=markups", title: `${pair?.id} ${m.family}: ${cur}% → ${pct}% from ${from}`, steps, reading: "AR-39: the Controller owns the markup table; the Controller's own change goes to the CFO" })
  if (!r.ok) return r
  return cfg((d, ctx) => {
    d.icMarkups.find((x) => x.id === markupId)!.versions.push({ value: { markupPct: pct, rationale: rationale.trim() }, effectiveFrom: from, by: ctx.userId, note: note.trim(), requestId: r.value })
    return `${markupId} change raised as ${r.value} for the ${steps[0]}.`
  })
}
export function addPair(seller: string, buyer: string, priceList: string, taxTreatment: string): Result<string> {
  const c = state()
  if (!can.transferPrice(role())) return bad("Intercompany configuration is maintained by Controlling.")
  if (seller === buyer) return bad("Seller and buyer must be different entities.", "buyer")
  if (c.icPairs.some((p) => p.seller === seller && p.buyer === buyer)) return bad("This pair is already defined; the direction matters, so define the reverse separately.", "buyer")
  if (!priceList.trim()) return bad("Give the transfer price list.", "priceList")
  if (!taxTreatment.trim()) return bad("Give the tax treatment.", "taxTreatment")
  const id = `IC-${String(c.icPairs.length + 1).padStart(2, "0")}`
  const r = raiseCfg({ id, label: `IC pair · ${id}`, route: "/configuration/intercompany", title: `Add intercompany pair ${seller} sells to ${buyer}, price list ${priceList.trim()}`, steps: [role() === "Controller" ? "CFO" : "Controller"], reading: "AR-39" })
  if (!r.ok) return r
  return cfg((d) => {
    d.icPairs.push({ id, seller: seller as never, buyer: buyer as never, priceList: priceList.trim(), accountPair: "IC accounts per ACC (not in the KB)", taxTreatment: taxTreatment.trim(), live: false, requestId: r.value })
    return `${id} raised as ${r.value}; the pair cannot trade until it is approved.`
  })
}
export function addTransferPrice(pairId: string, material: string, price: number, from: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.transferPrice(ctx.role), "Controller or Controlling analyst", "Maintaining transfer prices")
    const pair = d.icPairs.find((p) => p.id === pairId)
    if (!pair) throw new ProtoError("Pick a pair.", "pair")
    if (!material.trim()) throw new ProtoError("Enter the material.", "material")
    if (!Number.isFinite(price) || price <= 0) throw new ProtoError("The price must be above zero.", "price")
    const open = d.icPrices.find((p) => p.pairId === pairId && p.material === material.trim() && !p.validTo)
    if (!from || (open && from <= open.validFrom)) throw new ProtoError(`The new row must start after ${open?.validFrom ?? "today"}: price rows are never overwritten.`, "from")
    if (open) open.validTo = addDays(from, -1)
    const cur = LEGAL_ENTITIES.find((e) => e.id === pair.seller)?.currency ?? "USD"
    d.icPrices.push({ id: `IP-${String(d.icPrices.length + 1).padStart(2, "0")}`, pairId, material: material.trim(), price, currency: cur, validFrom: from })
    return `Transfer price ${material.trim()} added from ${from}${open ? `; the earlier row ends ${addDays(from, -1)}` : ""}.`
  })
}

// ============================================================================ reason codes (A-12)
export function addReason(catalog: CatalogId, code: string, label: string, usedBy: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.reason(ctx.role), "Process owner or Plant IT", "Maintaining catalogs")
    if (!/^[A-Z]{2,4}-?[A-Z0-9]{1,6}$/.test(code.trim())) throw new ProtoError("The code is 2 to 4 capital letters, an optional dash, then up to 6 letters or digits, for example SC-DIM.", "code")
    if (!label.trim()) throw new ProtoError("Give the label users will see.", "label")
    if (d.reasons.some((r) => r.catalog === catalog && (r.code === code.trim() || r.label.toLowerCase() === label.trim().toLowerCase()))) throw new ProtoError("This catalog already has a reason with this code or label.", "code")
    const rc: ReasonCode = { id: `${catalog}-${code.trim()}`, catalog, code: code.trim(), label: label.trim(), source: "Design value", active: true, validFrom: TODAY, usedBy: usedBy.trim() || "Not yet wired", history: [{ at: NOW, by: ctx.userId, what: "Added" }] }
    d.reasons.push(rc)
    return `${rc.code} added to the ${catalog} catalog.`
  })
}
/** Reasons deactivate, never delete: history on old documents must still read. */
export function deactivateReason(id: string, note: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.reason(ctx.role), "Process owner or Plant IT", "Maintaining catalogs")
    const r = d.reasons.find((x) => x.id === id)
    if (!r) throw new ProtoError("Reason not found.")
    if (!r.active) throw new ProtoError("Already inactive.")
    if (r.source === "PRD" && !note.trim()) throw new ProtoError("This reason is in the specification: say why it is retired.", "note")
    const left = d.reasons.filter((x) => x.catalog === r.catalog && x.active && x.id !== id).length
    if (left < 1) throw new ProtoError("A catalog keeps at least one active reason.")
    r.active = false
    r.deactivatedFrom = TODAY
    r.history.push({ at: NOW, by: ctx.userId, what: `Deactivated${note.trim() ? `: ${note.trim()}` : ""}` })
    return `${r.code} deactivated; documents that used it keep reading it.`
  })
}
export function reactivateReason(id: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.reason(ctx.role), "Process owner or Plant IT", "Maintaining catalogs")
    const r = d.reasons.find((x) => x.id === id)
    if (!r || r.active) throw new ProtoError("Nothing to reactivate.")
    r.active = true
    r.deactivatedFrom = undefined
    r.history.push({ at: NOW, by: ctx.userId, what: "Reactivated" })
    return `${r.code} is active again.`
  })
}

// ============================================================================ denied-party screening (Book III C §5)
export function startChecklist(partyType: "Customer" | "Vendor", partyId: string): Result<string> {
  return cfg((d) => {
    if (d.dpsChecklists.some((c) => c.partyId === partyId && !c.result)) throw new ProtoError("An open checklist already exists for this party.")
    const party = partyType === "Customer" ? CUSTOMERS.find((x) => x.id === partyId) : VENDORS.find((x) => x.id === partyId)
    if (!party) throw new ProtoError("Party not found.")
    const texts = partyType === "Customer"
      ? ["Search the legal name and every trade name on the consolidated screening lists", "Search each owner of 25% or more and each named signatory", "Check the bill-to and ship-to countries against embargoed destinations", "Record the end use and end user statement", "Attach the screening result (PDF or screenshot) to the party record", "A second person reviews any potential match before the party is activated"]
      : ["Search the legal name and every trade name on the consolidated screening lists", "Search each owner of 25% or more and each named signatory", "Check the vendor country and the ship-from sites against embargoed destinations", "Confirm the beneficial ownership declaration is on file", "Attach the screening result (PDF or screenshot) to the party record", "A second person reviews any potential match before the vendor is activated"]
    const id = `DPC-${String(d.dpsChecklists.length + 1).padStart(3, "0")}`
    const country = "country" in party ? (party as { country: string }).country : "currency" in party && (party as { currency: string }).currency === "CAD" ? "CA" : "US"
    d.dpsChecklists.push({ id, partyType, partyId, partyName: party.name, country, items: texts.map((text, n) => ({ id: `${id}-${n + 1}`, text, state: "Open" as const })) })
    return `${id} started for ${party.name}.`
  })
}
export function setChecklistItem(checklistId: string, itemId: string, st: "Open" | "Done" | "Not applicable", note: string): Result<string> {
  return cfg((d, ctx) => {
    const c = d.dpsChecklists.find((x) => x.id === checklistId)
    const it = c?.items.find((x) => x.id === itemId)
    if (!c || !it) throw new ProtoError("Item not found.")
    if (c.result) throw new ProtoError("A completed checklist is read-only: start a new one for a re-screen.")
    if (st === "Not applicable" && note.trim().length < 5) throw new ProtoError("Say why the step does not apply.", "note")
    it.state = st
    it.note = note.trim() || undefined
    it.by = st === "Open" ? undefined : ctx.userId
    it.on = st === "Open" ? undefined : TODAY
    return "Saved."
  })
}
export function completeChecklist(checklistId: string, result: NonNullable<DpsChecklist["result"]>): Result<string> {
  return cfg((d, ctx) => {
    const c = d.dpsChecklists.find((x) => x.id === checklistId)
    if (!c) throw new ProtoError("Checklist not found.")
    const open = c.items.filter((i) => i.state === "Open")
    if (open.length) throw new ProtoError(`${open.length} steps are still open; finish them before recording a result.`)
    if (result !== "Clear" && d.dpsHits.some((h) => h.partyId === c.partyId && (h.state === "New" || h.state === "In review"))) throw new ProtoError("This party already has a hit in the review queue.")
    c.result = result
    c.completedBy = ctx.userId
    c.completedOn = TODAY
    if (result !== "Clear") d.dpsHits.unshift({ id: `DPH-${String(d.dpsHits.length + 4).padStart(4, "0")}`, partyType: c.partyType, partyId: c.partyId, partyName: c.partyName, list: "Manual interim screening", listedName: c.partyName, score: result === "Confirmed match" ? 100 : 70, runOn: TODAY, state: "New" })
    return result === "Clear" ? `${c.partyName}: clear; the party may be activated.` : `${c.partyName}: ${result.toLowerCase()} sent to the review queue; the party stays inactive until a reviewer decides.`
  })
}
export function takeHit(id: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.dps(ctx.role), "Controller (reading AR-40: the specification names no reviewer)", "Reviewing a hit")
    const h = d.dpsHits.find((x) => x.id === id)
    if (!h || h.state !== "New") throw new ProtoError("Only a new hit is taken into review.")
    h.state = "In review"
    h.reviewer = ctx.userId
    return `${id} is in review with you.`
  })
}
export function decideHit(id: string, decision: "Cleared" | "Confirmed match", reason: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.dps(ctx.role), "Controller (reading AR-40)", "Deciding a hit")
    const h = d.dpsHits.find((x) => x.id === id)
    if (!h) throw new ProtoError("Hit not found.")
    if (h.state === "Cleared" || h.state === "Confirmed match") throw new ProtoError(`${id} is already decided; the decision is not edited, re-screen the party instead.`)
    if (h.state === "New") throw new ProtoError("Take the hit into review first.")
    if (reason.trim().length < 20) throw new ProtoError("Give the basis for the decision in at least 20 characters (names, registration numbers, addresses compared).", "reason")
    const performers = d.dpsChecklists.filter((c) => c.partyId === h.partyId).flatMap((c) => c.items.map((i) => i.by))
    if (performers.includes(ctx.userId)) throw new ProtoError("A second person reviews a potential match: you recorded part of this screening.")
    h.state = decision
    h.decision = reason.trim()
    h.decidedOn = TODAY
    h.reviewer = ctx.userId
    return decision === "Cleared" ? `${id} cleared: false positive on record.` : `${id} confirmed: the party must be set to Blocked in the customer or vendor master.`
  })
}

// ============================================================================ GL account mapping (Book I §2.4; Book II §2.6)
export function confirmGl(keys: string[]): Result<string> {
  return cfg((d, ctx) => {
    need(can.gl(ctx.role), "Controller", "Confirming GL accounts")
    let n = 0
    for (const k of keys) {
      const g = d.gl.find((x) => x.key === k)
      if (!g || g.status !== "Proposed") continue
      g.status = "Confirmed"
      g.history.push({ at: NOW, by: ctx.userId, what: `Confirmed as ${g.account}` })
      n++
    }
    if (!n) throw new ProtoError("Nothing to confirm: pick accounts that are still Proposed.")
    return `${n} account${n === 1 ? "" : "s"} confirmed.`
  })
}
export function remapGl(key: string, account: number, note: string): Result<string> {
  return cfg((d, ctx) => {
    need(can.gl(ctx.role), "Controller", "Remapping a GL account")
    const g = d.gl.find((x) => x.key === key)
    if (!g) throw new ProtoError("Mapping key not found.")
    if (!Number.isInteger(account) || account < 1000 || account > 9999) throw new ProtoError("A GL account number has four digits.", "account")
    if (account === g.account) throw new ProtoError("Nothing changes: enter a different account number.", "account")
    const clash = d.gl.find((x) => x.account === account && x.key !== key)
    if (clash) throw new ProtoError(`${account} is already mapped to ${clash.name} (${clash.key}).`, "account")
    if (!note.trim()) throw new ProtoError("Say why the account is remapped; it is kept on the history.", "note")
    g.history.push({ at: NOW, by: ctx.userId, what: `Remapped ${g.account} to ${account}: ${note.trim()}` })
    g.account = account
    g.status = "Remapped"
    return `${key} now points to ${account}. Posting rules read the key, so no posting rule changes.`
  })
}

// ============================================================================ email-action links
export type LinkResolution =
  | { state: "invalid" }
  | { state: "expired"; requestId: string; expiresAt: string }
  | { state: "actioned"; requestId: string; outcome: string; by?: string; on?: string }
  | { state: "unauthorized"; requestId: string; forRole: Role; forUser: UserId }
  | { state: "confirm"; requestId: string; action: "Approve" | "Reject"; forRole: Role }
export function actionByLink(token: string, outcome: "Approved" | "Rejected", comment: string): Result<string> {
  const l = state().links.find((x) => x.token === token)
  if (!l) return bad("This link is not valid.")
  const r = decide(l.requestId, outcome, comment.trim() || undefined, "Email link")
  if (!r.ok) return r
  return cfg((d, ctx) => {
    for (const x of d.links) if (x.requestId === l.requestId && x.forRole === l.forRole && !x.usedAt) {
      x.usedAt = NOW
      x.usedBy = ctx.userId
    }
    return r.value
  })
}

// ============================================================================ sagas (Book III B §2.3)
export function retrySagaStep(id: string): Result<string> {
  return cfg((d, ctx) => {
    const s = d.sagas.find((x) => x.id === id)
    if (!s) throw new ProtoError("Saga not found.")
    need(can.sagaOps(ctx.role), "Plant IT, Engineering IT, Quality IT or the Controller", "Retrying a saga step")
    if (s.state !== "Failed") throw new ProtoError(`${id} is ${s.state.toLowerCase()}; only a failed saga is retried.`)
    const f = s.steps.find((x) => x.state === "Failed")!
    f.state = "Done"
    f.at = NOW
    f.error = undefined
    for (const st of s.steps) if (st.state === "Pending") {
      st.state = "Done"
      st.at = NOW
    }
    s.state = "Completed"
    s.log.push({ at: NOW, by: ctx.userId, what: `Retried step ${f.n} (${f.name}); the saga completed. Original event_id kept, so idempotency holds` })
    return `${id}: step ${f.n} succeeded; the saga is completed.`
  })
}
export function compensateSaga(id: string, reason: string): Result<string> {
  return cfg((d, ctx) => {
    const s = d.sagas.find((x) => x.id === id)
    if (!s) throw new ProtoError("Saga not found.")
    if (s.state !== "Failed") throw new ProtoError(`${id} is ${s.state.toLowerCase()}; only a failed saga is compensated.`)
    const financial = ["IF-12", "IF-14"].includes(s.interfaceId)
    need(financial ? can.sagaFinancial(ctx.role) : can.sagaOps(ctx.role), financial ? `Controller (${s.interfaceId} carries a financially relevant command)` : "Plant IT or the Controller", "Compensating this saga")
    if (reason.trim().length < 10) throw new ProtoError("Give the reason for compensating, at least 10 characters.", "reason")
    const done = s.steps.filter((x) => x.state === "Done").sort((a, b) => b.n - a.n)
    for (const st of done) {
      st.state = "Compensated"
      s.log.push({ at: NOW, by: ctx.userId, what: `Compensated step ${st.n}: ${st.compensator}` })
    }
    for (const st of s.steps) if (st.state === "Pending") st.state = "Skipped"
    s.state = "Compensated"
    s.log.push({ at: NOW, by: ctx.userId, what: `Compensated by ${ctx.role}: ${reason.trim()}` })
    return `${id} compensated: ${done.length} step${done.length === 1 ? "" : "s"} reversed in reverse order.`
  })
}

/** A fresh signed link for the same approver and action, valid 7 days; the old link stays expired. The new link is mailed, not shown to the requester;
 *  the prototype returns the token so the screen can offer it. */
export function reissueLink(token: string): Result<string> {
  return cfg((d) => {
    const old = d.links.find((x) => x.token === token)
    if (!old) throw new ProtoError("This link is not valid.")
    const inst = store.getSlice("admin").instances.find((i) => i.id === old.requestId)
    const shared = store.getCore().approvals.find((a) => a.id === old.requestId)
    if ((inst && inst.outcome) || (shared && shared.outcome)) throw new ProtoError("The request is already decided; no new link is needed.")
    if (old.expiresAt > NOW) throw new ProtoError("This link has not expired yet.")
    const nt = `n${d.seq++}${old.token.slice(1, 12)}`
    d.links.push({ token: nt, requestId: old.requestId, forRole: old.forRole, forUser: old.forUser, action: old.action, issuedAt: NOW, expiresAt: addDays(TODAY, 7) + "T15:00" })
    return nt
  })
}
