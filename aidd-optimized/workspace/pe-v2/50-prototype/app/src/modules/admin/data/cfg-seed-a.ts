// Seed for the workflow-side configuration screens: alert rules (W.2), notification templates, KPI
// dictionary (Book IV §7.5) and access recertification (Book III C §3). Fictitious values (GUARDRAILS 7);
// the PRD's own values carry a source, the rest are design values (readings AR-32..AR-36 in the README).

import type { Role, UserId } from "@/data/domain"
import { USERS } from "@/data/shared"
import { THRESHOLDS } from "@/data/domain"
import { NOW, uid } from "./seed"
import type { AlertRule, Kpi, NotificationTemplate, RecertSheet } from "./cfg-types"

const none = { fired: 0, suppressed: 0, acknowledged: 0 }
function rule(r: Partial<AlertRule> & Pick<AlertRule, "id" | "name" | "trigger" | "when" | "condition" | "scope" | "severity" | "roles" | "owner" | "source">): AlertRule {
  return {
    users: [], channels: { inApp: true, email: false }, dedupeMinutes: 60, digest: "Off", enabled: true, version: 1,
    history: [{ at: "2025-12-15T09:00", by: "PRD seed", what: "Go-live seed (W.2 register, configuration workbook A-12)" }], noise: none, ...r,
  }
}

export function seedAlerts(): AlertRule[] {
  const T = THRESHOLDS
  return [
    rule({ id: "AL-01", name: "Stock below safety stock", trigger: "Event", when: "inventory.belowSafetyStock", condition: "Available quantity falls below the safety stock of the item and warehouse", scope: "All plants, planned items", severity: "Warning", roles: ["Planner"], owner: "Planning Manager", source: "W.2; Book I A §10", channels: { inApp: true, email: true }, dedupeMinutes: 720, noise: { fired: 14, suppressed: 31, acknowledged: 11 } }),
    rule({ id: "AL-02", name: "Calibration due", trigger: "Scheduled", when: "Daily 05:30", condition: `Instrument calibration due in ${T.calibrationAlertDays.join(" / ")} days`, scope: "Instruments, all labs", severity: "Warning", roles: ["Quality Manager"], users: [uid("Test technician")], owner: "Quality Manager", source: "W.2; Book I E (DOC:p.90)", channels: { inApp: true, email: true }, dedupeMinutes: 1440, noise: { fired: 6, suppressed: 12, acknowledged: 6 } }),
    rule({ id: "AL-03", name: "Unconfirmed purchase orders", trigger: "Scheduled", when: "Daily 07:00", condition: `PO not confirmed by the vendor ${T.unconfirmedPoBusinessDays} business days after transmission`, scope: "All vendors", severity: "Warning", roles: ["Buyer"], owner: "Purchasing Manager", source: "W.2; Book I G (DOC:p.104)", channels: { inApp: true, email: true }, dedupeMinutes: 1440, digest: "Daily 07:00", noise: { fired: 22, suppressed: 40, acknowledged: 17 } }),
    rule({ id: "AL-04", name: "Placeholder part aging", trigger: "Scheduled", when: "Daily 06:00", condition: "Engineering placeholder part older than 14 days without a released material", scope: "Engineering, all plants", severity: "Info", roles: ["Engineering Manager", "Material steward"], owner: "Engineering Manager", source: "W.2; Book I C (DOC:p.58)", dedupeMinutes: 1440, digest: "Weekly Monday 07:00", noise: { fired: 9, suppressed: 0, acknowledged: 3 } }),
    rule({ id: "AL-05", name: "Promise date at risk", trigger: "Event", when: "sales.promiseAtRisk", condition: "Promise date at risk after a supply, capacity or quality event", scope: "Open sales orders", severity: "Critical", roles: ["Customer Service Manager", "Production Scheduler"], owner: "Customer Service Manager", source: "W.2; Book III E §5", channels: { inApp: true, email: true }, dedupeMinutes: 240, noise: { fired: 3, suppressed: 2, acknowledged: 3 } }),
    rule({ id: "AL-06", name: "Dead-letter queue depth", trigger: "Event", when: "integration.dlqDepth", condition: "DLQ depth above 0 for more than 15 minutes on any interface (IF-01..IF-20)", scope: "All interfaces", severity: "Critical", roles: ["Plant IT"], owner: "Plant IT", source: "W.2; Book III B §4", channels: { inApp: true, email: true }, dedupeMinutes: 60, noise: { fired: 5, suppressed: 18, acknowledged: 5 } }),
    rule({ id: "AL-07", name: "SLO burn", trigger: "Scheduled", when: "Every 5 minutes", condition: "Error-budget burn rate above the paging threshold on a tier-1 service", scope: "Platform services", severity: "Critical", roles: ["Plant IT"], owner: "Plant IT", source: "W.2; Book III D", channels: { inApp: true, email: true }, dedupeMinutes: 30 }),
    rule({ id: "AL-08", name: "Certificate expiry", trigger: "Scheduled", when: "Daily 04:00", condition: "TLS or signing certificate expires in 30 days or less", scope: "Platform", severity: "Warning", roles: ["Plant IT"], owner: "Plant IT", source: "W.2; Book III C §5 (alerting at 30 days or more)", dedupeMinutes: 1440, noise: { fired: 1, suppressed: 0, acknowledged: 1 } }),
    rule({ id: "AL-09", name: "Count SLA", trigger: "Scheduled", when: "Daily 09:00", condition: "Count document not reconciled within its SLA", scope: "Count plans, all warehouses", severity: "Warning", roles: ["Warehouse supervisor"], owner: "Warehouse supervisor", source: "W.2; Book I A §7", dedupeMinutes: 1440, digest: "Daily 07:00", noise: { fired: 7, suppressed: 9, acknowledged: 5 } }),
    rule({ id: "AL-10", name: "Close checklist blocker", trigger: "Event", when: "finance.closeBlocked", condition: "A close-critical job failed or a pre-close item stays unresolved at period end", scope: "Entities with an open or soft-closed period", severity: "Critical", roles: ["Controller"], users: [uid("Cost accountant")], owner: "Controller", source: "W.2; INV §9, W.3", channels: { inApp: true, email: true }, dedupeMinutes: 120, noise: { fired: 2, suppressed: 1, acknowledged: 2 } }),
    rule({ id: "AL-11", name: "Invoice deviates from info record", trigger: "Event", when: "purchasing.invoiceDeviation", condition: `Invoice price deviates from the info record basis by more than ${T.infoRecordInvoiceDeviationPct}%`, scope: "AP invoices matched to POs", severity: "Warning", roles: ["Buyer"], owner: "Purchasing Manager", source: "Book II §7.2 (DOC:p.157)", dedupeMinutes: 0, noise: { fired: 11, suppressed: 0, acknowledged: 9 } }),
    rule({ id: "AL-12", name: "Economic nexus threshold at 80%", trigger: "Scheduled", when: "Monthly, 1st 06:00", condition: "Sales into a state reach 80% of its economic nexus threshold", scope: "US and Canada states", severity: "Warning", roles: ["Controller"], owner: "Controller", source: "INV §11 (DOC:pp.45-46)", dedupeMinutes: 43200, noise: { fired: 2, suppressed: 0, acknowledged: 2 } }),
    rule({ id: "AL-13", name: "Vendor compliance document expiring", trigger: "Scheduled", when: "Daily 06:30", condition: "Vendor compliance document expires in 30 days or less", scope: "Active vendors", severity: "Info", roles: ["Purchasing Manager", "Quality engineer"], owner: "Purchasing Manager", source: "Book I G (DOC:p.108)", dedupeMinutes: 1440, digest: "Weekly Monday 07:00", noise: { fired: 4, suppressed: 0, acknowledged: 2 } }),
    rule({ id: "AL-14", name: "Batch expired and auto-blocked", trigger: "Event", when: "materials.batchExpired", condition: "Expiry job moved stock to Blocked", scope: "Batch-managed items", severity: "Warning", roles: ["Material steward", "Quality engineer"], owner: "Materials Manager", source: "Book II §10 (DOC:p.165)", dedupeMinutes: 0, noise: { fired: 3, suppressed: 0, acknowledged: 3 } }),
    rule({ id: "AL-15", name: "Receipt-to-inspection SLA breach", trigger: "Scheduled", when: "Hourly", condition: "RMA receipt not inspected within 5 business days", scope: "RMA receipts", severity: "Warning", roles: ["Quality Manager"], owner: "Quality Manager", source: "Book I A §3.10 (alert rules INV 15.11)", channels: { inApp: true, email: true }, dedupeMinutes: 480, noise: { fired: 2, suppressed: 6, acknowledged: 2 } }),
    rule({ id: "AL-16", name: "No active inspection plan", trigger: "Event", when: "quality.noPlan", condition: "E-QM-01: no active inspection plan for the item and vendor", scope: "GRN lines, WO test operations", severity: "Warning", roles: ["Quality Manager"], owner: "Quality Manager", source: "Book I A §6.5", dedupeMinutes: 120, enabled: true, noise: { fired: 4, suppressed: 5, acknowledged: 4 } }),
    rule({ id: "AL-17", name: "Unsettled production order", trigger: "Scheduled", when: "Daily 08:00", condition: `Completed order unsettled for more than ${THRESHOLDS.woUnsettledBreachDays} days`, scope: "Production orders", severity: "Warning", roles: ["Cost accountant"], owner: "Cost accountant", source: "Book I D (DOC:p.126)", dedupeMinutes: 1440, digest: "Daily 07:00", enabled: false, noise: { fired: 0, suppressed: 0, acknowledged: 0 } }),
  ]
}

// ---------------------------------------------------------------- notification templates
export const PLACEHOLDERS = [
  "{{request.id}}", "{{request.title}}", "{{request.amount}}", "{{approver.name}}", "{{sla.due}}", "{{link.open}}", "{{link.approve}}", "{{link.reject}}",
  "{{decision.outcome}}", "{{decision.by}}", "{{decision.comment}}", "{{rule.name}}", "{{alert.count}}", "{{customer.name}}", "{{rma.number}}", "{{rma.returnClass}}",
  "{{po.number}}", "{{po.total}}", "{{vendor.name}}",
] as const
/** Placeholders that carry sensitive data: never allowed in an email body, masked in every preview (Book III C §5). */
export const SENSITIVE = ["{{customer.creditLimit}}", "{{customer.taxId}}", "{{vendor.bankAccount}}", "{{employee.badge}}"] as const

function tpl(id: string, name: string, event: string, audience: NotificationTemplate["audience"], owner: Role, placeholders: string[], enSubject: string, enBody: string, frSubject: string, frBody: string, extra: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id, name, event, audience, owner, placeholders,
    versions: [{ version: 1, state: "Active", subject: { "en-US": enSubject, "fr-CA": frSubject }, body: { "en-US": enBody, "fr-CA": frBody }, effectiveFrom: "2026-01-01", by: "PRD seed", note: "Go-live seed (Book IV §7.7; email notification templates)" }],
    ...extra,
  }
}
export function seedTemplates(): NotificationTemplate[] {
  const list: NotificationTemplate[] = [
    tpl("NT-01", "Approval requested", "approval.requested", "Internal", "Plant IT", ["{{request.id}}", "{{request.title}}", "{{request.amount}}", "{{approver.name}}", "{{sla.due}}", "{{link.open}}", "{{link.approve}}", "{{link.reject}}"],
      "Approval needed: {{request.title}}", "Hello {{approver.name}},\n\n{{request.id}} waits for your decision ({{request.amount}}). Respond by {{sla.due}}.\n\nApprove: {{link.approve}}\nReject: {{link.reject}}\nOpen in the app: {{link.open}}",
      "Approbation requise : {{request.title}}", "Bonjour {{approver.name}},\n\n{{request.id}} attend votre décision ({{request.amount}}). Répondez avant {{sla.due}}.\n\nApprouver : {{link.approve}}\nRefuser : {{link.reject}}\nOuvrir : {{link.open}}"),
    tpl("NT-02", "Approval reminder", "approval.reminder", "Internal", "Plant IT", ["{{request.id}}", "{{request.title}}", "{{approver.name}}", "{{sla.due}}", "{{link.open}}"],
      "Reminder: {{request.id}} is due {{sla.due}}", "Hello {{approver.name}}, {{request.title}} is still waiting. Open it here: {{link.open}}",
      "Rappel : {{request.id}} est à traiter avant {{sla.due}}", "Bonjour {{approver.name}}, {{request.title}} est toujours en attente. Ouvrir : {{link.open}}"),
    tpl("NT-03", "Escalation to manager", "approval.escalated", "Internal", "Plant IT", ["{{request.id}}", "{{request.title}}", "{{approver.name}}", "{{link.open}}"],
      "Escalated: {{request.id}} missed its SLA", "{{request.title}} passed its SLA and is escalated to you, {{approver.name}}. Open: {{link.open}}",
      "Escalade : {{request.id}} a dépassé son délai", "{{request.title}} a dépassé son délai et vous est escaladé, {{approver.name}}. Ouvrir : {{link.open}}"),
    tpl("NT-04", "Request decided", "approval.decided", "Internal", "Plant IT", ["{{request.id}}", "{{request.title}}", "{{decision.outcome}}", "{{decision.by}}", "{{decision.comment}}", "{{link.open}}"],
      "{{request.id}} {{decision.outcome}}", "{{request.title}} was {{decision.outcome}} by {{decision.by}}.\nComment: {{decision.comment}}\n{{link.open}}",
      "{{request.id}} : {{decision.outcome}}", "{{request.title}} : {{decision.outcome}} par {{decision.by}}.\nCommentaire : {{decision.comment}}\n{{link.open}}"),
    tpl("NT-05", "Alert digest", "alert.digest", "Internal", "Plant IT", ["{{rule.name}}", "{{alert.count}}", "{{link.open}}"],
      "Alert digest: {{alert.count}} alerts", "{{alert.count}} alerts for {{rule.name}} since the last digest. Review: {{link.open}}",
      "Sommaire d'alertes : {{alert.count}} alertes", "{{alert.count}} alertes pour {{rule.name}} depuis le dernier sommaire. Consulter : {{link.open}}"),
    tpl("NT-06", "RMA authorization (customer)", "rma.authorized", "Customer", "Customer Service Manager", ["{{customer.name}}", "{{rma.number}}", "{{rma.returnClass}}"],
      "Return authorized: {{rma.number}}", "Dear {{customer.name}},\n\nYour return {{rma.number}} (class {{rma.returnClass}}) is authorized. The return instructions are attached.",
      "Retour autorisé : {{rma.number}}", "Madame, Monsieur {{customer.name}},\n\nVotre retour {{rma.number}} (classe {{rma.returnClass}}) est autorisé. Les instructions de retour sont jointes."),
    tpl("NT-07", "Warranty denial letter (customer)", "rma.warrantyDenied", "Customer", "Quality Manager", ["{{customer.name}}", "{{rma.number}}"],
      "Warranty decision for {{rma.number}}", "Dear {{customer.name}},\n\nAfter inspection, the warranty claim on {{rma.number}} was not accepted. You may convert the return to a billable repair.",
      "Décision de garantie pour {{rma.number}}", "Madame, Monsieur {{customer.name}},\n\nAprès inspection, la demande de garantie de {{rma.number}} n'a pas été acceptée. Vous pouvez convertir le retour en réparation facturable."),
    tpl("NT-08", "PO transmission (vendor)", "po.released", "Vendor", "Purchasing Manager", ["{{vendor.name}}", "{{po.number}}", "{{po.total}}"],
      "Purchase order {{po.number}}", "{{vendor.name}},\n\nPurchase order {{po.number}} ({{po.total}}) is attached. Please confirm within 3 business days.",
      "Bon de commande {{po.number}}", "{{vendor.name}},\n\nLe bon de commande {{po.number}} ({{po.total}}) est joint. Veuillez confirmer dans les 3 jours ouvrables."),
  ]
  // NT-01 carries a draft v2 and NT-06 a draft with an unfinished French slot, so the editor opens on real states.
  list[0].versions.push({ version: 2, state: "Draft", subject: { "en-US": "Approval needed: {{request.title}} ({{request.id}})", "fr-CA": "Approbation requise : {{request.title}} ({{request.id}})" }, body: { ...list[0].versions[0].body, "en-US": list[0].versions[0].body["en-US"] + "\n\nThis message was sent to you because you hold the approver role for this step." }, effectiveFrom: "2026-11-01", by: uid("Plant IT"), note: "Add the id to the subject; explain why the approver got it" })
  list[5].versions.push({ version: 2, state: "Draft", subject: { "en-US": "Return authorized: {{rma.number}}", "fr-CA": "" }, body: { "en-US": "Dear {{customer.name}},\n\nYour return {{rma.number}} is authorized.", "fr-CA": "" }, effectiveFrom: "2026-11-15", by: uid("Customer Service Manager"), note: "Shorter text; French wording pending from the translator" })
  return list
}

// ---------------------------------------------------------------- KPI dictionary
const kv = (formula: string, grain: string, filters: string, target: string, lineage: string, freshness: Kpi["versions"][number]["value"]["freshness"]) => ({ formula, grain, filters, target, lineage, freshness })
function kpi(id: string, name: string, owner: Role, source: string, shownOn: string[], v: ReturnType<typeof kv>): Kpi {
  return { id, name, owner, source, shownOn, versions: [{ value: v, effectiveFrom: "2026-01-01", by: "PRD seed", note: "Seed catalog (Book IV §7.5)" }] }
}
export function seedKpis(): Kpi[] {
  const k = [
    kpi("KPI-01", "OTD %", "Sales Director", "Book IV §7.5", ["Sales dashboard", "Executive"], kv("Lines shipped on or before the committed date ÷ lines due in the period", "Order line, month", "Excludes cancelled and customer-delayed lines", "95%", "fact_delivery_line.actual_ship_date, fact_so_line.promise_date", "15-minute")),
    kpi("KPI-02", "Promise reliability", "Production Scheduler", "Book IV §7.5; Book III E §5", ["Production dashboard", "Sales dashboard"], kv("Orders delivered by the promise date ÷ orders promised, after re-promise changes", "Sales order, week", "Original and re-promised dates both stored", "92%", "fact_promise_history", "15-minute")),
    kpi("KPI-03", "FPY by gate", "Quality Manager", "Book IV §7.5", ["Quality dashboard"], kv("Units passing a gate with no rework ÷ units entering the gate", "Gate, work order, week", "Gates: core, coil, tank, final test", "96%", "fact_inspection_result", "15-minute")),
    kpi("KPI-04", "Scrap value %", "Production supervisor", "Book IV §7.5", ["Production dashboard"], kv("Scrap value posted (#20, 5320) ÷ production cost of the period", "Work center, month", "Posted scrap only", "1.5%", "fact_journal_line (5320), fact_confirmation", "Daily")),
    kpi("KPI-05", "PPV / IPV", "Cost accountant", "Book IV §7.5", ["Costing dashboard"], kv("Purchase and invoice price variance ÷ standard value of receipts", "Material group, month", "Posted variances only", "Within ±1%", "fact_journal_line (5210, 5215)", "Daily")),
    kpi("KPI-06", "Inventory turns", "Materials Manager", "Book IV §7.5", ["Inventory dashboard", "Executive"], kv("Cost of goods sold, trailing 12 months ÷ average inventory value", "Plant, month", "Excludes consignment (memo 1311)", "6.0", "fact_stock_value, fact_journal_line", "Daily")),
    kpi("KPI-07", "WIP aging", "Planning Manager", "Book IV §7.5", ["Production dashboard"], kv("Open WIP value by age since release, buckets 0-30, 31-60, 61-90, over 90 days", "Production order, day", "Released and not technically completed", "Over 60 days under 10%", "fact_production_order, fact_wip", "15-minute")),
    kpi("KPI-08", "Quote win rate", "Sales Director", "Book IV §7.5", ["Sales dashboard"], kv("Quotations Won ÷ quotations Won or Lost", "Quotation, quarter", "Superseded versions excluded", "35%", "fact_quotation", "Daily")),
    kpi("KPI-09", "Backlog (BBB)", "Sales Director", "Book IV §7.5", ["Sales dashboard", "Executive"], kv("Open order value not yet shipped, with booked-to-billed bridge", "Sales order, month", "Confirmed and later; excludes cancelled", "Not set", "fact_so_line, fact_invoice", "15-minute")),
    kpi("KPI-10", "Three-view order margin", "Controller", "Book IV §7.5", ["Costing dashboard", "Executive"], kv("Quoted, standard and actual margin per order, side by side", "Sales order, month", "Standard cost per released run", "Within 2 points of quote", "fact_so_line, fact_cost_estimate, fact_journal_line", "Daily")),
    kpi("KPI-11", "DSO", "Controller", "Book IV §7.5 (ACC)", ["Finance dashboard"], kv("Open receivables ÷ credit sales of the period × days in the period", "Entity, month", "ACC subledger; reconciles to GL", "45 days", "ACC receivables aging (external, ASM-EXT-1)", "Daily")),
    kpi("KPI-12", "Close cycle days", "Controller", "Book IV §7.5", ["Finance dashboard"], kv("Business days from month end to Hard Close", "Entity, month", "Reopen windows excluded", "6 days", "period history (INV-CONFIG-PERIOD)", "Daily")),
    kpi("KPI-13", "Traceability coverage %", "Quality Manager", "Book IV §7.5", ["Quality dashboard"], kv("Serials and batches with complete genealogy (T01..T13 events) ÷ serials and batches shipped", "Serial or batch, month", "FIN serials and batch-managed items", "100%", "fact_genealogy_event", "Daily")),
    kpi("KPI-14", "Data completeness", "Materials Manager", "Book IV §7.5; Book II §16.4", ["Inventory dashboard"], kv("Active materials with all mandatory fields ÷ active materials", "Material, week", "Per material type behavior matrix", "98%", "dim_material", "Daily")),
    kpi("KPI-15", "SLO attainment", "Plant IT", "Book IV §7.5", ["Platform health"], kv("Minutes within the service objective ÷ minutes in the period", "Service, month", "Tier-1 services", "99.5%", "platform telemetry", "Real-time")),
  ]
  // A conflicting second formula for OTD on the executive view: the defect the dictionary exists to catch.
  k[0].shownOn.push("Executive scorecard")
  k[0].competing = [{ where: "Executive scorecard", formula: "Shipments on or before the planned ship date ÷ shipments in the period (counts shipments, not lines)" }]
  return k
}

// ---------------------------------------------------------------- access recertification
const byRole = (r: Role) => USERS.find((u) => u.roles.includes(r))!
const item = (sheet: string, n: number, userId: UserId, role: Role, entitlements: string, lastUsed: string, answer: "Pending" | "Keep" | "Revoke" = "Pending") => ({ id: `${sheet}-${n}`, userId, role, entitlements, lastUsed, answer })
export function seedRecert(): RecertSheet[] {
  const eng: Role[] = ["Engineer", "Engineer", "Engineering Manager", "Manufacturing engineer", "Document control", "Engineering IT"]
  const engUsers = USERS.filter((u) => u.roles.some((r) => eng.includes(r)))
  const shp = USERS.filter((u) => u.roles.some((r) => ["Shipping office", "Packer", "Shipping Manager", "Receiving clerk", "Warehouse operator", "Warehouse supervisor"].includes(r)))
  const pur = USERS.filter((u) => u.roles.some((r) => ["Buyer", "Purchasing Manager"].includes(r)))
  const ent = (r: Role) => (r === "Engineering Manager" ? "ECR/CCB vote, MBOM release" : r === "Engineering IT" ? "CAD/PDM connector admin" : r === "Document control" ? "Release documents, transmittals" : "EBOM edit, ECR raise")
  const sheets: RecertSheet[] = [
    { id: "ARC-2026Q3-ENG", campaign: "2026 Q3", department: "Engineering", managerRole: "Engineering Manager", requestId: "APR-TBD-5029", dueOn: "2026-10-16", items: engUsers.map((u, n) => item("ENG", n + 1, u.id, u.roles[0], ent(u.roles[0]), n % 3 === 0 ? "2026-10-08" : "2026-10-05")) },
    { id: "ARC-2026Q3-SHP", campaign: "2026 Q3", department: "Shipping", managerRole: "Shipping Manager", requestId: "APR-TBD-5030", dueOn: "2026-10-16", items: shp.map((u, n) => item("SHP", n + 1, u.id, u.roles[0], "Shipments, packing, PGI per role", "2026-10-07", "Keep")) },
    { id: "ARC-2026Q3-PUR", campaign: "2026 Q3", department: "Purchasing", managerRole: "Purchasing Manager", requestId: "APR-TBD-5031", dueOn: "2026-10-16", items: pur.map((u, n) => item("PUR", n + 1, u.id, u.roles[0], u.roles[0] === "Buyer" ? "PO create, RFQ, vendor info records" : "PO approval to $250,000, AVL", u.name === "Ahmed Karimi" ? "2026-06-02" : "2026-10-06", u.name === "Ahmed Karimi" ? "Revoke" : "Keep")), autoRevoked: { on: "2026-10-03T11:00", reason: "Ahmed Karimi no longer needs PO release rights; failed attestation, auto-revoke." } },
  ]
  void byRole
  return sheets
}
export const RECERT_NOW = NOW
