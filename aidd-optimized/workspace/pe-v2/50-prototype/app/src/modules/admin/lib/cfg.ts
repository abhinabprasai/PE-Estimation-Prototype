// Pure helpers for the configuration screens: version state off the approval request, series format
// checks, alert and template validation, SoD pairs, GL ranges. No store access here.

import type { Role } from "@/data/domain"
import { TODAY } from "@/data/shared"
import type { WfInstance } from "../data/types"
import type { AlertRule, NotificationTemplate, Ver, VerState } from "../data/cfg-types"
import { PLACEHOLDERS, SENSITIVE } from "../data/cfg-seed-a"

// ---------------------------------------------------------------- versions
export type Instances = WfInstance[]
/** State of one request-backed fact: Pending approval, Rejected (also Recalled), or Active / Scheduled by date. */
export function requestState(requestId: string | undefined, effectiveFrom: string, instances: Instances): "Active" | "Scheduled" | "Pending approval" | "Rejected" {
  if (requestId) {
    const i = instances.find((x) => x.id === requestId)
    if (!i || !i.outcome) return "Pending approval"
    if (i.outcome !== "Approved") return "Rejected"
  }
  return effectiveFrom <= TODAY ? "Active" : "Scheduled"
}
export function verState<T>(v: Ver<T>, all: Ver<T>[], instances: Instances): VerState {
  const st = requestState(v.requestId, v.effectiveFrom, instances)
  if (st !== "Active") return st
  const latest = all.filter((x) => requestState(x.requestId, x.effectiveFrom, instances) === "Active").sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1)
  return latest === v ? "Active" : "Superseded"
}
export const inForce = <T,>(all: Ver<T>[], instances: Instances): Ver<T> | undefined => all.find((v) => verState(v, all, instances) === "Active")
export const nextOf = <T,>(all: Ver<T>[], instances: Instances): Ver<T> | undefined => [...all].reverse().find((v) => ["Pending approval", "Scheduled"].includes(verState(v, all, instances)))
export const hasPending = <T,>(all: Ver<T>[], instances: Instances) => all.some((v) => verState(v, all, instances) === "Pending approval")

// ---------------------------------------------------------------- number series format
const TOKEN = /\{(YYYY|MM|SEQ(?::\d+)?|TYPE|ENTITY|GROUP:\d+|FAMILY:\d+|CountPlan)\}/g
export interface FormatCheck {
  ok: boolean
  error?: string
  preview: string
  resets: string
}
/** Format tester: every token must be known, there is exactly one sequence token, and the preview shows a real number. */
export function checkFormat(format: string, next: number, entity = "PT"): FormatCheck {
  const f = format.trim()
  if (!f) return { ok: false, error: "Enter the format.", preview: "", resets: "" }
  const stripped = f.replace(TOKEN, "")
  if (/[{}]/.test(stripped)) return { ok: false, error: `Unknown token in ${f}. Allowed: {YYYY} {MM} {SEQ:n} {TYPE} {ENTITY} {GROUP:n} {FAMILY:n} {CountPlan}.`, preview: "", resets: "" }
  const seq = f.match(/\{SEQ(?::(\d+))?\}/g) ?? []
  if (seq.length !== 1) return { ok: false, error: "The format needs exactly one sequence token such as {SEQ:5}; without it numbers repeat.", preview: "", resets: "" }
  const width = Number(/\{SEQ:(\d+)\}/.exec(f)?.[1] ?? 1)
  const preview = f
    .replace("{YYYY}", "2026").replace("{MM}", "10").replace(/\{SEQ(?::\d+)?\}/, String(next).padStart(width, "0")).replace("{TYPE}", "TX").replace("{ENTITY}", entity)
    .replace(/\{GROUP:(\d+)\}/, (_, n) => "CRG".padEnd(Number(n), "X").slice(0, Number(n))).replace(/\{FAMILY:(\d+)\}/, (_, n) => "PAD".padEnd(Number(n), "X").slice(0, Number(n))).replace("{CountPlan}", "CP-2026-001")
  if (String(next).length > width && /\{SEQ:\d+\}/.test(f)) return { ok: false, error: `The next number ${next} is wider than {SEQ:${width}}.`, preview, resets: "" }
  const resets = f.includes("{MM}") ? "Resets every month" : f.includes("{YYYY}") ? "Resets every year" : "Never resets"
  return { ok: true, preview, resets }
}

// ---------------------------------------------------------------- alert rule validation (W.2)
export interface AlertDraft {
  name: string
  trigger: "Event" | "Scheduled"
  when: string
  condition: string
  scope: string
  severity: AlertRule["severity"]
  roles: Role[]
  users: string[]
  inApp: boolean
  email: boolean
  dedupeMinutes: number
  digest: AlertRule["digest"]
}
export function validateAlert(d: AlertDraft, others: AlertRule[], selfId?: string): { field: string; error: string } | null {
  if (!d.name.trim()) return { field: "name", error: "Name the rule." }
  if (others.some((r) => r.id !== selfId && r.name.trim().toLowerCase() === d.name.trim().toLowerCase())) return { field: "name", error: "Another rule has this name." }
  if (!d.when.trim()) return { field: "when", error: d.trigger === "Event" ? "Name the event, for example inventory.belowSafetyStock." : "Give the schedule, for example Daily 07:00." }
  if (d.trigger === "Event" && !/^[a-z]+(\.[A-Za-z]+)+$/.test(d.when.trim())) return { field: "when", error: "An event is written as module.eventName, for example sales.promiseAtRisk." }
  if (!d.condition.trim()) return { field: "condition", error: "State the condition that raises the alert." }
  if (!d.scope.trim()) return { field: "scope", error: "Give the scope (entity, plant, item class) the rule applies to." }
  if (d.roles.length + d.users.length === 0) return { field: "roles", error: "Pick at least one recipient role or user." }
  if (!d.inApp && !d.email) return { field: "channels", error: "Pick a channel: in-app or email. SMS is reserved." }
  if (!Number.isInteger(d.dedupeMinutes) || d.dedupeMinutes < 0 || d.dedupeMinutes > 43200) return { field: "dedupe", error: "The dedupe window is 0 to 43,200 minutes (30 days)." }
  if (d.digest !== "Off" && d.severity === "Critical") return { field: "digest", error: "A digest is for non-critical severities only: a Critical alert is always sent at once." }
  return null
}

// ---------------------------------------------------------------- notification template validation
export const SAMPLE: Record<string, string> = {
  "{{request.id}}": "APR-TBD-5001", "{{request.title}}": "Expense PR: dielectric oil test kits", "{{request.amount}}": "$8,450.00", "{{approver.name}}": "Nathan Brooks", "{{sla.due}}": "Oct 10, 2026 15:00",
  "{{link.open}}": "https://pe.example/approvals?req=APR-TBD-5001", "{{link.approve}}": "https://pe.example/approvals/action/k3Qx9v-…", "{{link.reject}}": "https://pe.example/approvals/action/p8Zd2a-…",
  "{{decision.outcome}}": "approved", "{{decision.by}}": "Nathan Brooks", "{{decision.comment}}": "Within budget", "{{rule.name}}": "Unconfirmed purchase orders", "{{alert.count}}": "7",
  "{{customer.name}}": "Midland Plains Grid Constructors", "{{rma.number}}": "RMA-2026-0038", "{{rma.returnClass}}": "RC2", "{{po.number}}": "PO-2026-PT-00532", "{{po.total}}": "$184,300.00", "{{vendor.name}}": "Northstar Electrical Steel Co.",
  "{{customer.creditLimit}}": "$5,000,000", "{{customer.taxId}}": "47-1234567", "{{vendor.bankAccount}}": "021000021 / 4410096", "{{employee.badge}}": "BDG-7041",
}
export const placeholdersIn = (text: string) => [...new Set(text.match(/\{\{[^}]*\}\}/g) ?? [])]
export function validateTemplateText(text: string, allowed: string[]): string | null {
  for (const p of placeholdersIn(text)) {
    if ((SENSITIVE as readonly string[]).includes(p)) return `${p} carries sensitive data and is not allowed in an email body.`
    if (!(PLACEHOLDERS as readonly string[]).includes(p)) return `${p} is not a known placeholder.`
    if (!allowed.includes(p)) return `${p} is not available for this event; use one of: ${allowed.join(" ")}.`
  }
  return null
}
/** Values hidden in a preview unless the viewer reveals them: the sensitive set, plus money amounts (Book III C §5 data protection). */
export const PREVIEW_MASKED: string[] = [...SENSITIVE, "{{request.amount}}", "{{po.total}}"]
export function renderTemplate(text: string, reveal: boolean): string {
  return text.replace(/\{\{[^}]*\}\}/g, (p) => {
    const sensitive = PREVIEW_MASKED.includes(p)
    const v = SAMPLE[p]
    if (v == null) return `[${p}: unknown]`
    return sensitive && !reveal ? "••••••" : v
  })
}
export const templateOf = (t: NotificationTemplate, which: "active" | "draft") => (which === "active" ? t.versions.find((v) => v.state === "Active") : [...t.versions].reverse().find((v) => v.state === "Draft"))

// ---------------------------------------------------------------- SoD (Book III C §3)
export const SOD_PAIRS: { id: string; pair: [string, string]; rule: string; roles: [Role[], Role[]] }[] = [
  { id: "P2P", pair: ["PO create", "GRN post"], rule: "PO create vs GRN post vs invoice approve vs payment release", roles: [["Buyer", "Purchasing Manager"], ["Receiving clerk", "Warehouse operator", "Warehouse supervisor"]] },
  { id: "INV-PAY", pair: ["Invoice approve", "Payment release"], rule: "PO create vs GRN post vs invoice approve vs payment release", roles: [["AP clerk"], ["Controller", "CFO"]] },
  { id: "WO", pair: ["WO confirm", "Settlement approve"], rule: "WO confirm vs settlement", roles: [["Production supervisor", "Operator"], ["Cost accountant", "Controlling analyst"]] },
  { id: "PRICE", pair: ["Price edit", "Price approve"], rule: "Price edit vs approve", roles: [["Sales admin", "Sales rep"], ["Pricing Manager"]] },
  { id: "COUNT", pair: ["Count", "Count approve"], rule: "Count vs approve", roles: [["Warehouse operator"], ["Warehouse supervisor"]] },
  { id: "MATRIX", pair: ["Matrix edit", "Matrix release"], rule: "Matrix edit vs release", roles: [["Cost accountant"], ["Controller"]] },
  { id: "MCR", pair: ["MCR task", "Material activation"], rule: "MCR task vs activation", roles: [["Material steward"], ["Materials Manager"]] },
]
export function toxicPairsFor(roles: Role[]): typeof SOD_PAIRS {
  return SOD_PAIRS.filter((p) => roles.some((r) => p.roles[0].includes(r)) && roles.some((r) => p.roles[1].includes(r)))
}

// ---------------------------------------------------------------- GL
export const glRangeNote = (account: number, type: string): string | null => {
  const first = Math.floor(account / 1000)
  const t = type.toLowerCase()
  const fits = t.includes("asset") && !t.includes("contra") ? [1].includes(first) : t.includes("liability") ? [2].includes(first) : t.includes("revenue") ? [4].includes(first) : t.includes("expense") || t.includes("contra") ? [5, 6, 7, 1].includes(first) : t.includes("memo") ? [1].includes(first) : true
  return fits ? null : `${account} is outside the usual range for ${type} (13xx inventory, 2xxx liabilities, 4xxx revenue, 5xxx variances, 6xxx operating expense).`
}

// ---------------------------------------------------------------- who may do what
// The specification has no role-by-action matrix (ASM-PERM-1). A control is gated only where a rule names the role;
// the rest are readings listed in the README (AR-32..AR-50).
export const can = {
  alert: (role: Role, r: Pick<AlertRule, "owner">) => role === r.owner || role === "Plant IT" || role === "Process owner",
  template: (role: Role, t: Pick<NotificationTemplate, "owner">) => role === t.owner || role === "Plant IT",
  plantDraft: (role: Role) => role === "Plant IT",
  plantApprove: (role: Role) => role === "Controller",
  lane: (role: Role) => role === "Planning Manager",
  transferPrice: (role: Role) => role === "Controller" || role === "Controlling analyst",
  gl: (role: Role) => role === "Controller",
  material: (role: Role) => role === "Materials Manager" || role === "Material steward",
  dps: (role: Role) => role === "Controller",
  reason: (role: Role) => role === "Process owner" || role === "Plant IT",
  sagaFinancial: (role: Role) => role === "Controller",
  sagaOps: (role: Role) => role === "Plant IT" || role === "Controller" || role === "Engineering IT" || role === "Quality IT",
}

// ---------------------------------------------------------------- plants
import type { PlantRecord } from "../data/cfg-types"
/** The state shown: the stored state, or the target of an approved activation or deactivation request. */
export function plantState(p: PlantRecord, instances: Instances): { state: PlantRecord["state"]; pending?: "Active" | "Inactive" } {
  if (p.stateRequestId && p.stateTarget) {
    const st = requestState(p.stateRequestId, TODAY, instances)
    if (st === "Pending approval") return { state: p.state, pending: p.stateTarget }
    if (st === "Active") return { state: p.stateTarget }
  }
  return { state: p.state }
}
