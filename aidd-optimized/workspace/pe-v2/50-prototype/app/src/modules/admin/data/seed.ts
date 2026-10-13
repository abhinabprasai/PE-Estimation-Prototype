// Admin seed. Every name and number is fictitious (GUARDRAILS 7). IDs reuse the hero spine
// (src/data/shared/spine.ts) and the other modules' seeds wherever a request is about their document.
// Workflow-instance IDs use the APR-TBD-5nnn range so they never collide with the shared engine's
// APR-TBD-0nnn sequence.

import type { DocRef, LegalEntityId, Role, UserId } from "@/data/domain"
import { THRESHOLDS } from "@/data/domain"
import { LEGAL_ENTITIES, TODAY, defaultUserFor } from "@/data/shared"
import { W4_ALL, escalationOf, w4ById } from "./catalog"
import { RULES } from "./rules"
import { addHours } from "../lib/time"
import type {
  AuditEntry, Channel, DefVersion, Delegation, Incident, InstOutcome, InstStep, InterfaceMessage, InterfaceStat, JobRun, NumberSeries, Period, PreCloseItem,
  ReconRun, Setting, Subject, TaggedPosting, TaxConfig, WfInstance, WorkflowDefinition,
} from "./types"

/** The prototype clock: TODAY at 15:00 (design value; the shared seed has a date, not a time). */
export const NOW = `${TODAY}T15:00`
export const uid = (r: Role): UserId => defaultUserFor(r).id
const FIN_LIMIT = 250_000

// ============================================================================ workflow definitions
function seedDefinitions(): WorkflowDefinition[] {
  return W4_ALL.map((w) => {
    const steps = w.steps.map((st) => ({ role: st.role, slaHours: st.slaHours, escalateTo: escalationOf(st.role), parallel: st.parallel, reminderHours: Math.max(4, Math.round(st.slaHours / 3)), approver: st.approver, when: st.when }))
    const v1: DefVersion = {
      version: 1, effectiveFrom: "2026-01-01", trigger: w.chain, rules: RULES[w.id] ?? [], steps, terminalActions: w.terminalActions,
      changedBy: uid(w.ownerRole), changedOn: "2025-12-15", changeNote: "Go-live seed from the W.4 register (configuration workbook A-12)", state: "Active",
    }
    const versions: DefVersion[] = [v1]
    if (w.id === "WF-12") {
      v1.state = "Retired"
      v1.effectiveTo = "2026-06-30"
      v1.steps = v1.steps.map((x) => ({ ...x, slaHours: 72 }))
      versions.push({ ...v1, version: 2, effectiveFrom: "2026-07-01", effectiveTo: undefined, steps, changedOn: "2026-06-20", changeNote: "Department SLA 72 h → 48 h, to the 2-day SLA in Book II §4.2", state: "Active" })
    }
    if (w.id === "WF-01")
      versions.push({ ...v1, version: 2, effectiveFrom: "2026-11-01", steps: steps.map((x) => ({ ...x, reminderHours: 4 })), changedOn: "2026-10-02", changedBy: uid("Purchasing Manager"), changeNote: "Reminder cadence every 4 h on all PO steps", state: "Scheduled" })
    if (w.id === "WF-17")
      versions.push({ ...v1, version: 2, effectiveFrom: "2026-11-01", steps: steps.map((x) => ({ ...x, reminderHours: 4 })), changedOn: "2026-10-08", changedBy: uid("Warehouse supervisor"), changeNote: "Reminder cadence 8 h → 4 h during count weeks", state: "Pending co-sign", requestId: "APR-TBD-5033" })
    return { id: w.id, versions }
  })
}

// ============================================================================ admin engine instances
type Dec = [outcome: "Approved" | "Rejected", on: string, reason?: string, channel?: Channel, onBehalfOf?: Role]
type StepSpec = [role: Role, dec?: Dec]

function inst(
  id: `APR-${string}`, wfId: string, kindLabel: string, subject: Subject, title: string, raisedBy: Role, raisedAt: string, stepSpecs: StepSpec[],
  opts: { amount?: number; currency?: "USD" | "CAD"; outcome?: "Recalled"; effect?: WfInstance["effect"]; reading?: string; version?: number } = {},
): WfInstance {
  const row = w4ById(wfId)
  let opened = raisedAt
  const steps: InstStep[] = stepSpecs.map(([role, dec], n) => {
    const def = row?.steps.find((x) => x.role === role)
    const sla = def?.slaHours ?? 24
    const parallel = def?.parallel
    // A parallel run opens together: its members share the opening time of the first.
    const sameRun = parallel && n > 0 && stepSpecs[n - 1][0] && row?.steps.find((x) => x.role === stepSpecs[n - 1][0])?.parallel
    const step: InstStep = { role, slaHours: sla, escalateTo: escalationOf(role), openedAt: sameRun ? raisedAt : opened, parallel }
    if (dec) {
      const [outcome, on, reason, channel, behalf] = dec
      step.decided = { outcome, on, reason, channel: channel ?? "In-app", role: behalf ? (role === "Controller" ? "Controlling analyst" : role) : role, by: behalf ? uid("Controlling analyst") : uid(role), onBehalfOf: behalf ? uid(behalf) : undefined }
      if (!parallel) opened = on
    }
    return step
  })
  // Later steps open only once the one before is decided; a parallel run is one unit.
  let open = true
  for (let n = 0; n < steps.length; ) {
    let m = n + 1
    if (steps[n].parallel) while (m < steps.length && steps[m].parallel) m++
    const grp = steps.slice(n, m)
    if (!open) for (const st of grp) st.openedAt = undefined
    if (grp.some((x) => !x.decided)) open = false
    if (grp.every((x) => x.decided)) opened = grp.map((x) => x.decided!.on).sort().at(-1)!
    n = m
  }
  const rejected = steps.some((x) => x.decided?.outcome === "Rejected")
  const done = steps.every((x) => x.decided?.outcome === "Approved")
  const financial = row?.financial ?? false
  return {
    id, wfId, kindLabel, version: opts.version ?? 1, subject, title, amount: opts.amount, currency: opts.currency ?? (opts.amount != null ? "USD" : undefined),
    raisedBy, raisedByUser: uid(raisedBy), raisedAt, steps, outcome: opts.outcome ?? (rejected ? "Rejected" : done ? "Approved" : undefined),
    delegationAllowed: !(financial && (opts.amount ?? 0) > FIN_LIMIT), rounds: [], effect: opts.effect, reading: opts.reading ?? row?.reading,
  }
}
const R = (type: DocRef["type"], id: string): Subject => ({ ref: { type, id } })
const L = (id: string, label: string, route: string): Subject => ({ loose: { id, label, route } })

function seedInstances(): WfInstance[] {
  return [
    // WF-02 PR approval (manual/expense): derived cost center owner, + Controller when the budget check fails (AR-5)
    inst("APR-TBD-5001", "WF-02", "PR approval (manual/expense)", R("requisition", "PR-TBD-0049"), "Expense PR: dielectric oil test kits, CC-1500 Quality; budget check passed", "Quality engineer", "2026-10-07T10:20", [["Quality Manager"]], { amount: 8450 }),
    inst("APR-TBD-5002", "WF-02", "PR approval (manual/expense)", R("requisition", "PR-TBD-0051"), "Expense PR: overhead crane annual inspection, CC-1300 Assembly; budget check failed (over by $3,900)", "Production Scheduler", "2026-10-06T08:05", [["Production supervisor", ["Approved", "2026-10-06T11:40"]], ["Controller"]], { amount: 14200 }),
    inst("APR-TBD-5003", "WF-02", "PR approval (manual/expense)", R("requisition", "PR-TBD-0053"), "Expense PR: CAD workstation refresh, 4 seats, CC-3000 Engineering", "Engineer", "2026-09-29T09:00", [["Engineering Manager", ["Rejected", "2026-09-30T16:10", "Defer to the Q1 2027 IT budget; reuse the two spare seats meanwhile."]]], { amount: 22800 }),
    // WF-05 Quotation internal review (hero QT-TBD-0301-V2)
    inst("APR-TBD-5004", "WF-05", "Quotation internal review", R("quotation", "QT-TBD-0301-V2"), "Omaha North phase 1: quoted margin 26.1% below target 28.0%, 1 × FIN-TBD-20MVA", "Sales rep", "2025-12-10T09:30", [["Estimator", ["Approved", "2025-12-10T14:00"]], ["Pricing Manager", ["Approved", "2025-12-11T10:15", undefined, "Email link"]]], { amount: 1284000 }),
    inst("APR-TBD-5005", "WF-05", "Quotation internal review", R("quotation", "QT-TBD-0402-V1"), "Lakeshore Municipal Light & Water: quoted margin 24.8% below target 28.0%", "Sales rep", "2026-10-08T13:10", [["Estimator"], ["Pricing Manager"]], { amount: 1936000 }),
    inst("APR-TBD-5006", "WF-05", "Quotation internal review", R("quotation", "QT-TBD-0400-V1"), "Granite Peak Mining: 4 × 5 MVA pad-mount, quoted margin 25.5% below target", "Sales rep", "2026-10-05T10:00", [["Estimator", ["Approved", "2026-10-06T09:00"]], ["Pricing Manager"]], { amount: 612400 }),
    // WF-06 Sales change order (hero SO-2026-00301, phase 2 SO-2026-00377)
    inst("APR-TBD-5007", "WF-06", "Sales change order", R("salesOrder", "SO-2026-00301"), "Add factory witness test day and spare gasket kit (+$18,400); credit re-check passed, exposure $1.30M of $5.0M", "Sales admin", "2026-03-03T10:00", [["Sales Director", ["Approved", "2026-03-04T08:45"]]], { amount: 18400 }),
    inst("APR-TBD-5008", "WF-06", "Sales change order", R("salesOrder", "SO-2026-00377"), "Pull requested date 2027-03-15 → 2027-02-26 with expedite fee +$42,000; credit re-check on increase", "Sales admin", "2026-10-08T16:30", [["Sales Director"]], { amount: 42000 }),
    inst("APR-TBD-5009", "WF-06", "Sales change order", R("salesOrder", "SO-2026-00340"), "Change incoterms DAP → FCA, freight credit −$6,800", "Sales admin", "2026-10-02T09:00", [["Sales Director"]], { amount: 6800, outcome: "Recalled" }),
    // WF-08 RMA disposition & warranty adjudication (hero RMA-TBD-0012)
    inst("APR-TBD-5010", "WF-08", "RMA disposition & warranty adjudication", R("rma", "RMA-TBD-0012"), "Inspector proposes warranty repair (RC3) through RWO-TBD-0012: reseal flange of bushing SN-TBD-BSH-0302, est. $4,600", "Inspector", "2026-10-05T11:00", [["Quality Manager"]], { amount: 4600 }),
    inst("APR-TBD-5011", "WF-08", "RMA disposition & warranty adjudication", R("rma", "RMA-TBD-0007"), "Goodwill replacement out of warranty, Prairie Ridge Electric Cooperative", "Inspector", "2026-09-22T09:00", [["Quality Manager", ["Approved", "2026-09-22T15:00"]], ["Controller", ["Approved", "2026-09-23T10:00"]]], { amount: 11900 }),
    // WF-10 ECO task set & release
    inst("APR-TBD-5012", "WF-10", "ECO task set & release", R("eco", "ECO-TBD-0038"), "Task checklist complete: HV lead exit change, effectivity from the next unit released", "Engineer", "2026-10-08T09:40", [["Engineering Manager"]]),
    inst("APR-TBD-5013", "WF-10", "ECO task set & release", R("eco", "ECO-TBD-0024"), "Radiator bracket gauge change, atomic effectivity release", "Engineer", "2026-08-18T13:00", [["Engineering Manager", ["Approved", "2026-08-19T09:20"]]]),
    // WF-12 MCR data-completion (hero MCR-TBD-0301)
    inst("APR-TBD-5014", "WF-12", "MCR data-completion", R("mcr", "MCR-TBD-0301"), "Create RAW-TBD-OLTC (17-position OLTC): department views then activation", "Material steward", "2026-01-20T09:00", [["Engineer", ["Approved", "2026-01-21T11:00"]], ["Buyer", ["Approved", "2026-01-23T10:30"]], ["Cost accountant", ["Approved", "2026-01-26T15:00"]], ["Quality engineer", ["Approved", "2026-01-29T09:45"]], ["Materials Manager", ["Approved", "2026-02-02T08:30"]]]),
    inst("APR-TBD-5015", "WF-12", "MCR data-completion", R("mcr", "MCR-TBD-0377"), "Create 145 kV polymer bushing for phase 2 after the recall: purchasing view", "Material steward", "2026-10-03T10:00", [["Engineer", ["Approved", "2026-10-03T15:00"]], ["Buyer"], ["Cost accountant"], ["Quality engineer"], ["Materials Manager"]], { version: 2 }),
    inst("APR-TBD-5016", "WF-12", "MCR data-completion", R("mcr", "MCR-TBD-0402"), "Create spare gasket kit for 20 MVA units: costing view", "Material steward", "2026-10-07T09:00", [["Engineer", ["Approved", "2026-10-07T13:00"]], ["Buyer", ["Approved", "2026-10-08T10:00"]], ["Cost accountant"], ["Quality engineer"], ["Materials Manager"]], { version: 2 }),
    // WF-14 Supersession
    inst("APR-TBD-5017", "WF-14", "Supersession", L("SUP-TBD-0007", "Supersession", "/materials/supersessions"), "Supersede RAW-TBD-BSH015 by RAW-TBD-BSH015B; run-out policy: use up stock first", "Material steward", "2026-10-08T11:00", [["Materials Manager"]]),
    // WF-15 Valuation class change (hero material RAW-TBD-OLTC)
    inst("APR-TBD-5018", "WF-15", "Valuation method / class change", R("material", "RAW-TBD-OLTC"), "Valuation class 3000 → 3010 (long-lead purchased components) at the period boundary 2026-11-01", "Cost accountant", "2026-10-07T14:00", [["Controller"]]),
    // WF-16 Account determination matrix release
    inst("APR-TBD-5019", "WF-16", "Account determination matrix release", L("ADM-MATRIX-v14", "Account determination matrix", "/materials/account-determination"), "Matrix v14: rows for valuation class 3010; completeness check 100%", "Cost accountant", "2026-10-08T10:00", [["Controller"]]),
    // WF-18 Costing run mark / release; WC rate release
    inst("APR-TBD-5020", "WF-18", "Costing run mark/release", L("CR-TBD-0045", "Costing run", "/costing/runs"), "October 2026 standard cost run: marked; release posts revaluation −$38,214", "Cost accountant", "2026-10-06T09:00", [["Cost accountant", ["Approved", "2026-10-06T09:05", "Marked"]], ["Controller"]], { amount: 38214 }),
    inst("APR-TBD-5021", "WF-18", "WC rate release", L("WCR-2027", "Work center rates 2027", "/costing/work-center-rates"), "2027 work center rates release", "Cost accountant", "2026-09-26T10:00", [["Cost accountant", ["Approved", "2026-09-26T10:02", "Marked"]], ["Controller", ["Rejected", "2026-09-28T09:30", "WC-230 drying oven still uses the 2025 energy tariff; recalculate and mark again."]]]),
    // WF-21 Vendor onboarding
    inst("APR-TBD-5022", "WF-21", "Vendor onboarding", L("VEN-TBD-0110", "Vendor · Meridian Relay & Control", "/purchasing/vendors"), "Onboard Meridian Relay & Control (protective relays); ISO 9001 on file", "Buyer", "2026-10-01T09:00", [["Quality engineer", ["Approved", "2026-10-02T14:00"]], ["Purchasing Manager"]]),
    inst("APR-TBD-5023", "WF-21", "Vendor onboarding", L("VEN-TBD-0116", "Vendor · Great Plains Heavy Haul", "/purchasing/vendors"), "Onboard Great Plains Heavy Haul (over-dimensional transport); USDOT and insurance certificates", "Buyer", "2026-03-06T09:00", [["Quality engineer", ["Approved", "2026-03-09T10:00"]], ["Purchasing Manager", ["Approved", "2026-03-10T08:15"]]]),
    // WF-22 SCAR escalation (hero SCAR-TBD-0009)
    inst("APR-TBD-5024", "WF-22", "SCAR escalation", R("scar", "SCAR-TBD-0009"), "Hanseong Porcelain & Polymer: response due 2026-10-16 (flange seal leak, vendor batch HP-26-0412)", "Quality engineer", "2026-10-02T12:00", [["Quality Manager"]]),
    inst("APR-TBD-5025", "WF-22", "SCAR escalation", R("scar", "SCAR-TBD-0005"), "Tri-State Bushing Components: second overdue SCAR, AVL to Restricted", "Quality engineer", "2026-08-29T08:00", [["Quality Manager", ["Approved", "2026-08-30T09:00"]]]),
    // WF-24 Promise-date change / at-risk (phase 2 order hit by the recall)
    inst("APR-TBD-5026", "WF-24", "Promise-date change / at-risk", R("salesOrder", "SO-2026-00377"), "At risk: 6 reserved HV bushings Blocked by RCL-2026-001; recovery decision, then customer notice", "Planner", "2026-10-03T08:00", [["Production Scheduler"], ["Customer Service Manager"]]),
    // WF-25 De-peg SO stock
    inst("APR-TBD-5027", "WF-25", "De-peg SO stock", R("salesOrder", "SO-2026-00349"), "De-peg 1 × 5 MVA unit from SO-2026-00349 to SO-2026-00352 (storm replacement); logged on both orders", "Sales admin", "2026-09-17T15:00", [["Sales Director", ["Approved", "2026-09-18T08:30"]]]),
    // WF-26 SoD exception grant
    inst("APR-TBD-5028", "WF-26", "SoD exception grant", L("SOD-TBD-004", "SoD exception", "/configuration/core?section=sod"), "Ray Dumont (AP clerk): vendor bank-detail edit during month-end, expires 2026-10-31", "Controller", "2026-10-09T08:30", [["CFO"]], { effect: { type: "sodGrant", sodId: "SOD-TBD-004" } }),
    // WF-27 Access recertification (generated by JOB-12 on 2026-10-01)
    inst("APR-TBD-5029", "WF-27", "Access recertification", L("ARC-2026Q3-ENG", "Access review · Engineering", "/operations/jobs?job=JOB-12"), "Q3 2026 attestation: Engineering, 6 users", "Plant IT", "2026-10-01T06:00", [["Engineering Manager"]]),
    inst("APR-TBD-5030", "WF-27", "Access recertification", L("ARC-2026Q3-SHP", "Access review · Shipping", "/operations/jobs?job=JOB-12"), "Q3 2026 attestation: Shipping, 6 users", "Plant IT", "2026-10-01T06:00", [["Shipping Manager", ["Approved", "2026-10-02T10:10"]]]),
    inst("APR-TBD-5031", "WF-27", "Access recertification", L("ARC-2026Q3-PUR", "Access review · Purchasing", "/operations/jobs?job=JOB-12"), "Q3 2026 attestation: Purchasing, 3 users", "Plant IT", "2026-10-01T06:00", [["Purchasing Manager", ["Rejected", "2026-10-03T11:00", "Ahmed Karimi no longer needs PO release rights; failed attestation, auto-revoke."]]]),
    // W.4 addition: Supplier Deviation, routed to Engineering + Quality as one parallel step (Book IV §3.4)
    inst("APR-TBD-5036", "WF-A1", "Supplier Deviation", R("deviation", "DEV-2026-0012"), "Waiver: CTC enamel build 0.048 mm per side on batch BAT-TBD-CT1003, vendor VEN-TBD-0102; valid for 3,900 kg", "Quality engineer", "2026-10-08T14:00", [["Engineering Manager"], ["Quality Manager"]]),
    inst("APR-TBD-5037", "WF-A1", "Supplier Deviation", R("deviation", "DEV-2026-0010"), "Use tank plate A36 instead of A572 on WO-TBD-0398, vendor VEN-TBD-0106", "Quality engineer", "2026-09-12T10:00", [["Engineering Manager", ["Rejected", "2026-09-14T09:30", "Yield strength margin insufficient for vacuum rating."]], ["Quality Manager"]]),
    inst("APR-TBD-5038", "WF-A1", "Supplier Deviation", R("deviation", "DEV-2026-0009"), "Radiator fin pitch 52 mm on batch BAT-TBD-R2507, temporary until 2026-09-30", "Quality engineer", "2026-07-01T11:00", [["Engineering Manager", ["Approved", "2026-07-03T10:00"]], ["Quality Manager", ["Approved", "2026-07-03T13:00"]]]),
    // WF-20 Fiscal period reopen (history: July reopened for a late freight accrual)
    inst("APR-TBD-5032", "WF-20", "Fiscal period reopen", L("FP-TBD-10-2026-07", "Fiscal period 2026-07 · PE Transformer", "/inventory/configuration/fiscal-periods?p=FP-TBD-10-2026-07"), "Reopen 2026-07 PE Transformer: late freight accrual on DLV-TBD-0024", "Controller", "2026-08-04T09:00", [["Controller", ["Approved", "2026-08-04T09:05"]], ["CFO", ["Approved", "2026-08-04T13:30"]]], { effect: { type: "periodReopen", periodId: "FP-TBD-10-2026-07" } }),
    // W.1 versioning: owner change on a posting-gating workflow needs the Controller
    inst("APR-TBD-5033", "W.1-VER", "Workflow definition change", L("WF-17 v2", "Workflow definition · Count variance approvals", "/configuration/workflows?wf=WF-17"), "Count variance approvals v2: reminder cadence 8 h → 4 h, effective 2026-11-01", "Warehouse supervisor", "2026-10-08T15:00", [["Controller"]], { effect: { type: "defVersion", wfId: "WF-17", version: 2 }, reading: "AR-14: the Controller co-sign required by W.1 Versioning is raised as an approval request" }),
    // CFG-CORE change control
    inst("APR-TBD-5034", "CFG-CHG", "Configuration change", L("SET-QM-CAL", "Setting · Calibration alert days", "/configuration/core?section=quality"), "Calibration alert days 30/14/3 → 45/14/3, effective 2026-11-01", "Process owner", "2026-10-07T11:30", [["Quality Manager"]], { effect: { type: "configChange", settingId: "SET-QM-CAL", changeId: "CHG-TBD-0002" }, reading: "AR-15: CFG-CORE changes route to the setting's owner (+ Controller when it gates a posting)" }),
    // INV §11.5 tax adjustment JE (Controller)
    inst("APR-TBD-5035", "TAX-ADJ", "Tax adjustment JE", L("TXR-2026-08-10", "Tax reconciliation · Aug 2026 PE Transformer", "/inventory/configuration/tax?section=recon"), "Tax adjustment JE: Aug 2026 PE Transformer, unexplained GL vs Avalara −$412.18", "Controller", "2026-10-06T10:00", [["Controller"]], { amount: 412.18, effect: { type: "taxAdjustment", reconId: "TXR-2026-08-10" } }),
  ]
}

function seedAudit(instances: WfInstance[]): AuditEntry[] {
  const out: AuditEntry[] = []
  for (const i of instances) {
    out.push({ at: i.raisedAt, requestId: i.id, action: "Raised", by: i.raisedByUser, role: i.raisedBy, channel: "In-app" })
    for (const st of i.steps)
      if (st.decided) out.push({ at: st.decided.on, requestId: i.id, action: st.decided.outcome, by: st.decided.by, role: st.decided.role, channel: st.decided.channel, comment: st.decided.reason, onBehalfOf: st.decided.onBehalfOf })
    if (i.outcome === "Recalled") out.push({ at: "2026-10-02T11:20", requestId: i.id, action: "Recalled", by: i.raisedByUser, role: i.raisedBy, channel: "In-app", comment: "Customer withdrew the incoterms change." })
  }
  out.push({ at: "2026-10-03T15:00", requestId: "APR-TBD-5015", action: "Reminder sent", by: uid("Plant IT"), role: "Plant IT", channel: "Email link", comment: "Reminder to Buyer (cadence 16 h)" })
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

function seedDelegations(): Delegation[] {
  return [
    { id: "DLG-TBD-0007", fromUser: uid("Controller"), fromRole: "Controller", toUser: uid("Controlling analyst"), toRole: "Controlling analyst", validFrom: "2026-10-08", validTo: "2026-10-16", scope: "All workflows", reason: "Annual leave", createdBy: uid("Controller"), createdOn: "2026-10-01" },
    { id: "DLG-TBD-0008", fromUser: uid("Quality Manager"), fromRole: "Quality Manager", toUser: uid("Quality engineer"), toRole: "Quality engineer", validFrom: "2026-10-20", validTo: "2026-10-24", scope: ["WF-08", "WF-22"], reason: "Supplier audit trip", createdBy: uid("Quality Manager"), createdOn: "2026-10-06" },
    { id: "DLG-TBD-0005", fromUser: uid("Purchasing Manager"), fromRole: "Purchasing Manager", toUser: uid("Buyer"), toRole: "Buyer", validFrom: "2026-09-01", validTo: "2026-09-05", scope: ["WF-01", "WF-21"], reason: "Trade show", createdBy: uid("Purchasing Manager"), createdOn: "2026-08-28" },
    { id: "DLG-TBD-0006", fromUser: uid("Engineering Manager"), fromRole: "Engineering Manager", toUser: uid("Manufacturing engineer"), toRole: "Manufacturing engineer", validFrom: "2026-09-21", validTo: "2026-10-31", scope: ["WF-10", "WF-11"], reason: "Covering during design review week", createdBy: uid("Engineering Manager"), createdOn: "2026-09-19", revokedOn: "2026-09-25" },
  ]
}

// ============================================================================ jobs, interfaces, incidents
const HERO_COR = "COR-7F3A-0301"
function seedRuns(): JobRun[] {
  const r = (id: string, jobId: string, scheduledAt: string, state: JobRun["state"], extra: Partial<JobRun> = {}): JobRun => ({
    id, jobId, scheduledAt, state, attempt: 1, correlationId: `COR-${id.slice(-5)}`,
    startedAt: state === "Scheduled" || state === "Held (dependency)" ? undefined : scheduledAt,
    endedAt: state === "Succeeded" || state === "Failed" ? addHours(scheduledAt, 0.2) : undefined,
    ...extra,
  })
  return [
    r("RUN-TBD-40118", "JOB-01", "2026-10-06T01:00", "Succeeded", { output: "MRP-TBD-1006 (pegged SO-2026-00377 line 10)", correlationId: HERO_COR }),
    r("RUN-TBD-40131", "JOB-01", "2026-10-07T01:00", "Succeeded", { output: "MRP-TBD-1007: 214 proposals, 31 exceptions" }),
    r("RUN-TBD-40144", "JOB-01", "2026-10-08T01:00", "Succeeded", { output: "MRP-TBD-1008: 209 proposals, 28 exceptions" }),
    r("RUN-TBD-40157", "JOB-01", "2026-10-09T01:00", "Succeeded", { output: "MRP-TBD-1009: 216 proposals, 33 exceptions" }),
    r("RUN-TBD-40170", "JOB-01", "2026-10-10T01:00", "Scheduled"),
    r("RUN-TBD-40101", "JOB-02", "2026-10-01T02:00", "Succeeded", { output: "1,284 items classified" }),
    r("RUN-TBD-40150", "JOB-03", "2026-10-08T00:30", "Succeeded", { output: "0 expired batches" }),
    r("RUN-TBD-40156", "JOB-03", "2026-10-09T00:30", "Succeeded", { output: "2 expired batches moved to Blocked" }),
    r("RUN-TBD-40159", "JOB-04", "2026-10-09T03:00", "Failed", { attempt: 3, error: "Timeout reading GRN events: IF-08 lag 41 min above the 30 min read window" }),
    r("RUN-TBD-40146", "JOB-04", "2026-10-08T03:00", "Succeeded", { output: "16 vendors scored" }),
    r("RUN-TBD-40160", "JOB-05", "2026-10-09T04:00", "Succeeded", { output: "IA at 84% of threshold: alert to Controller" }),
    r("RUN-TBD-40061", "JOB-07", "2026-10-01T22:00", "Failed", { period: "2026-09", entityId: "LE-TBD-10", attempt: 3, error: "Posting rejected: account 2610 Warranty Reserve has no determination row for valuation class 3010 in matrix v13", incidentId: "INC-TBD-0041" }),
    r("RUN-TBD-40062", "JOB-07", "2026-10-01T22:00", "Succeeded", { period: "2026-09", entityId: "LE-TBD-20", output: "JE-TBD-W2609-20", posting: { template: 24, amount: 6120 } }),
    r("RUN-TBD-40063", "JOB-07", "2026-10-01T22:00", "Succeeded", { period: "2026-09", entityId: "LE-TBD-30", output: "JE-TBD-W2609-30", posting: { template: 24, amount: 9870 } }),
    r("RUN-TBD-40064", "JOB-06", "2026-10-02T06:00", "Held (dependency)", { period: "2026-09", entityId: "LE-TBD-10", error: "Waits for JOB-07 Warranty accrual (failed)" }),
    r("RUN-TBD-40065", "JOB-06", "2026-10-02T06:00", "Succeeded", { period: "2026-09", entityId: "LE-TBD-20", output: "ALC-202609-01 posted, net zero" }),
    r("RUN-TBD-40066", "JOB-08", "2026-10-02T07:00", "Succeeded", { period: "2026-09", entityId: "LE-TBD-10", output: "E&O reserve run, quarter Q3" }),
    r("RUN-TBD-40020", "JOB-07", "2026-09-01T22:00", "Succeeded", { period: "2026-08", entityId: "LE-TBD-10", output: "JE-TBD-W2608-10 (incl. SN-TBD-20M-0301 shipment)", posting: { template: 24, amount: 38520 }, correlationId: HERO_COR }),
    r("RUN-TBD-40021", "JOB-06", "2026-09-02T06:00", "Succeeded", { period: "2026-08", entityId: "LE-TBD-10", output: "ALC-202608-01 posted, net zero" }),
    r("RUN-TBD-40133", "JOB-09", "2026-10-06T08:00", "Succeeded", { output: "CR-TBD-0045 marked (release in WF-INBOX)" }),
    r("RUN-TBD-40161", "JOB-10", "2026-10-09T14:45", "Succeeded", { output: "3 documents recalculated, 0 discrepancies" }),
    r("RUN-TBD-40162", "JOB-10", "2026-10-09T15:00", "Running", { output: "1 document queued (SO-2026-00402 estimate)" }),
    r("RUN-TBD-40163", "JOB-10", "2026-10-09T15:15", "Scheduled"),
    r("RUN-TBD-40158", "JOB-11", "2026-10-09T05:00", "Succeeded", { output: "42 KPIs computed" }),
    r("RUN-TBD-40100", "JOB-12", "2026-10-01T06:00", "Succeeded", { output: "3 attestations raised (WF-27)" }),
  ]
}

function seedMessages(): InterfaceMessage[] {
  const m = (id: string, interfaceId: string, at: string, summary: string, state: InterfaceMessage["state"], extra: Partial<InterfaceMessage> = {}): InterfaceMessage => ({
    id, interfaceId, at, summary, state, attempts: state === "Delivered" ? 1 : 3, correlationId: `COR-${id.slice(-4)}-${interfaceId.slice(3)}`,
    envelope: { message_id: id, interface: interfaceId, produced_at: at, schema: `${interfaceId.toLowerCase()}.v1`, idempotency_key: `${interfaceId}:${id}` }, ...extra,
  })
  const hero = (id: string, interfaceId: string, at: string, docRef: DocRef, summary: string, extra: Partial<InterfaceMessage> = {}) => m(id, interfaceId, at, summary, "Delivered", { correlationId: HERO_COR, docRef, ...extra })
  return [
    // hero thread: one correlation id from the sales order through the recall
    hero("MSG-TBD-10011", "IF-04", "2026-01-08T10:12", { type: "salesOrder", id: "SO-2026-00301" }, "SO-2026-00301 confirmed: peg line 10 schedule 10"),
    hero("MSG-TBD-10019", "IF-11", "2026-01-27T01:24", { type: "requisition", id: "PR-TBD-0301" }, "MRP proposal: PR-TBD-0301 OLTC and HV bushings"),
    hero("MSG-TBD-10024", "IF-01", "2026-02-10T09:02", { type: "purchaseOrder", id: "PO-TBD-0301" }, "PO-TBD-0301 sent to Rheinwerk Tap Changers (email PDF)"),
    hero("MSG-TBD-10026", "IF-02", "2026-02-12T07:40", { type: "purchaseOrder", id: "PO-TBD-0301" }, "Vendor confirmation captured, delivery 2026-05-29"),
    hero("MSG-TBD-10031", "IF-03", "2026-03-18T16:05", { type: "ebom", id: "EBOM-TBD-0301" }, "EBOM-TBD-0301 rev B released: costing invalidation flag set"),
    hero("MSG-TBD-10036", "IF-05", "2026-04-06T07:15", { type: "productionOrder", id: "WO-TBD-0301" }, "WO-TBD-0301 released, serial SN-TBD-20M-0301 born"),
    hero("MSG-TBD-10041", "IF-08", "2026-05-04T13:20", { type: "grn", id: "GRN-TBD-0301" }, "GRN-TBD-0301: 9 HV bushings, batch BAT-TBD-B0301"),
    hero("MSG-TBD-10043", "IF-10", "2026-05-06T09:10", { type: "purchaseOrder", id: "PO-TBD-0302" }, "Three-way match basis PO-TBD-0302 / GRN-TBD-0301"),
    hero("MSG-TBD-10055", "IF-06", "2026-07-24T18:40", { type: "productionOrder", id: "WO-TBD-0301" }, "Confirmation op 0400 WC-400: bushings SN-TBD-BSH-0301..0303 installed (SP-12)"),
    hero("MSG-TBD-10061", "IF-19", "2026-08-10T10:05", { type: "serial", id: "SN-TBD-20M-0301" }, "Nameplate and shipping labels printed", { attempts: 2 }),
    hero("MSG-TBD-10062", "IF-07", "2026-08-11T15:30", { type: "delivery", id: "DLV-TBD-0031" }, "PGI DLV-TBD-0031 posted (#25)"),
    hero("MSG-TBD-10066", "IF-16", "2026-08-14T11:02", { type: "invoiceRequest", id: "IR-TBD-0031" }, "Avalara commit IR-TBD-0031, ship-to NE, tax collected"),
    hero("MSG-TBD-10067", "IF-09", "2026-08-14T11:03", { type: "invoiceRequest", id: "IR-TBD-0031" }, "Invoice request IR-TBD-0031 (delivery milestone 15%) to ACC"),
    hero("MSG-TBD-10081", "IF-15", "2026-10-02T14:10", { type: "recall", id: "RCL-2026-001" }, "Mass hold: 6 bushings of BAT-TBD-B0301 in stock → Blocked"),
    m("MSG-TBD-10082", "IF-15", "2026-10-02T14:11", "RMA batch creation for 2 field bushings on SN-TBD-20M-0301", "Dead-lettered", { correlationId: HERO_COR, docRef: { type: "recall", id: "RCL-2026-001" }, error: "RMA creation rejected: IB-TBD-0301 already has open RMA-TBD-0012 for SN-TBD-BSH-0302 (duplicate guard); batch aborted, 0 of 2 created" }),
    // other dead letters and retries
    m("MSG-TBD-10090", "IF-16", "2026-10-09T14:32", "Avalara timeout on SO-2026-00402 estimate; failover rate used, queued for recalc", "Retrying", { docRef: { type: "salesOrder", id: "SO-2026-00402" }, error: "HTTP 504 from Avalara after 8 s" }),
    m("MSG-TBD-10088", "IF-09", "2026-10-08T17:45", "Invoice request IR-TBD-0044 to ACC, Coopérative d'électricité du Lac-Saint-Jean", "Dead-lettered", { docRef: { type: "invoiceRequest", id: "IR-TBD-0044" }, error: "ACC rejected: customer tax registration for QC (QST) missing on the tax profile" }),
    m("MSG-TBD-10089", "IF-19", "2026-10-09T09:12", "Packing list print for HU-TBD-0412 at PRN-PACK-02", "Dead-lettered", { error: "Printer PRN-PACK-02 offline" }),
    m("MSG-TBD-10086", "IF-17", "2026-10-08T12:00", "PDM part card sync for EBOM-TBD-0377 line 50", "Dead-lettered", { docRef: { type: "ebom", id: "EBOM-TBD-0377" }, error: "Sync conflict: material group differs (PDM 'BUSHING-POLY', ERP 'BUSHING')" }),
    m("MSG-TBD-10091", "IF-08", "2026-10-09T14:50", "GRN-TBD-0288 events to ACC / QM", "Retrying", { docRef: { type: "grn", id: "GRN-TBD-0288" }, error: "Consumer lag 41 min" }),
    m("MSG-TBD-10077", "IF-14", "2026-09-30T16:20", "IC pairing: PE Grid Components PO ↔ PE Transformer SO for 12 × TRADE-TBD-ARRESTER", "Dead-lettered", { error: "Transfer price list missing row for TRADE-TBD-ARRESTER; pairing rolled back (both documents or neither)" }),
    m("MSG-TBD-10070", "IF-18", "2026-10-03T11:05", "SCIM deprovision: Ahmed Karimi PO release role (WF-27 auto-revoke)", "Delivered"),
    // routine traffic
    ...["IF-04", "IF-05", "IF-07", "IF-08", "IF-06", "IF-11", "IF-03", "IF-01", "IF-02", "IF-12", "IF-13", "IF-09", "IF-16", "IF-19"].map((ifId, n) =>
      m(`MSG-TBD-1${String(1100 + n)}`, ifId, `2026-10-09T${String(8 + (n % 7)).padStart(2, "0")}:${String((n * 7) % 60).padStart(2, "0")}`, `Routine ${ifId} message ${n + 1} of today`, "Delivered"),
    ),
  ]
}

function seedStats(): InterfaceStat[] {
  const rows: [string, number, number, number, number][] = [
    ["IF-01", 6, 40, 0, 0], ["IF-02", 4, 120, 0, 0], ["IF-03", 22, 3, 0, 0], ["IF-04", 38, 2, 0, 0], ["IF-05", 51, 2, 0.1, 0], ["IF-06", 340, 1, 0.2, 0], ["IF-07", 12, 2, 0, 0],
    ["IF-08", 26, 2460, 3.8, 41], ["IF-09", 14, 4, 7.1, 1275], ["IF-10", 18, 5, 0, 0], ["IF-11", 1, 0, 0, 0], ["IF-12", 3, 6, 0, 0], ["IF-13", 9, 1, 0, 0], ["IF-14", 2, 3, 50, 13000],
    ["IF-15", 2, 1, 50, 10370], ["IF-16", 64, 8, 1.6, 28], ["IF-17", 7, 15, 14.3, 180], ["IF-18", 5, 1, 0, 0], ["IF-19", 96, 1, 1, 348], ["IF-20", 0, 0, 0, 0],
  ]
  return rows.map(([interfaceId, throughputPerHour, lagSeconds, errorRatePct, oldestUnprocessedMin]) => ({ interfaceId, throughputPerHour, lagSeconds, errorRatePct, oldestUnprocessedMin }))
}

function seedIncidents(): Incident[] {
  return [
    { id: "INC-TBD-0041", severity: "S2", title: "Close-critical job failed: Warranty accrual, PE Transformer 2026-09", source: { kind: "job", id: "RUN-TBD-40061" }, openedAt: "2026-10-01T22:40", openedBy: uid("Plant IT"), responseDue: "2026-10-02T09:00", state: "Acknowledged", onCall: "Plant IT", paged: [{ at: "2026-10-01T22:41", to: "Plant IT", reason: "Close-critical job failed after 3 attempts" }] },
    { id: "INC-TBD-0042", severity: "S2", title: "Reconciliation failed: IF-09 Invoice requests, 1 orphan (IR-TBD-0044 dead-lettered, no invoice)", source: { kind: "interface", id: "IF-09" }, openedAt: "2026-10-09T10:00", openedBy: uid("Plant IT"), responseDue: "2026-10-09T11:00", state: "Open", onCall: "Plant IT" },
    { id: "INC-TBD-0043", severity: "S2", title: "Reconciliation failed: IF-14 Intercompany pairing, 1 pair rolled back (monthly IC recon)", source: { kind: "interface", id: "IF-14" }, openedAt: "2026-10-01T08:10", openedBy: uid("Plant IT"), responseDue: "2026-10-01T09:10", state: "Acknowledged", onCall: "Plant IT" },
    { id: "INC-TBD-0044", severity: "S3", title: "Reconciliation failed: IF-17 CAD/PDM connector, sync conflict queue has 1 open conflict", source: { kind: "interface", id: "IF-17" }, openedAt: "2026-10-09T12:00", openedBy: uid("Plant IT"), responseDue: "Queued", state: "Open", onCall: "Plant IT" },
    { id: "INC-TBD-0045", severity: "S3", title: "Reconciliation failed: IF-08 GRN events, GR/IR aging report shows consumer lag 41 min", source: { kind: "interface", id: "IF-08" }, openedAt: "2026-10-09T06:05", openedBy: uid("Plant IT"), responseDue: "Queued", state: "Open", onCall: "Plant IT" },
    { id: "INC-TBD-0040", severity: "S3", title: "Failed-print queue: PRN-PACK-02 offline", source: { kind: "message", id: "MSG-TBD-10089" }, openedAt: "2026-10-09T09:20", openedBy: uid("Plant IT"), responseDue: "Queued", state: "Open", onCall: "Plant IT" },
  ]
}

/** Scheduled reconciliation reports (one run per interface on 2026-10-09; failures raised an incident per Part D §5). */
function seedRecon(): ReconRun[] {
  const clean = (interfaceId: string, at: string, finding: string): ReconRun => ({ id: `REC-${interfaceId}-1009`, interfaceId, at, by: "Scheduler", result: "Clean", exceptions: 0, finding })
  const bad = (interfaceId: string, at: string, finding: string, incidentId: string, exceptions = 1): ReconRun => ({ id: `REC-${interfaceId}-1009`, interfaceId, at, by: "Scheduler", result: "Exceptions", exceptions, finding, incidentId })
  const at = (h: string) => `2026-10-09T${h}`
  return [
    clean("IF-01", at("07:00"), "No unconfirmed PO older than 3 days"), clean("IF-02", at("07:00"), "No confirmed-vs-need-date exceptions"), clean("IF-03", at("12:00"), "No EBOM-ahead exception, placeholder aging within 14 days"),
    clean("IF-04", at("05:30"), "Open-order book equals pegged supply"), clean("IF-05", at("06:00"), "WIP report ties to GL"), clean("IF-06", at("06:00"), "Scan telemetry count equals posted confirmations (yesterday)"),
    clean("IF-07", at("06:00"), "Shipped-not-invoiced report empty"), bad("IF-08", at("06:05"), "GR/IR aging: consumer lag 41 min on GRN-TBD-0288 events", "INC-TBD-0045"),
    bad("IF-09", at("10:00"), "Request-to-invoice latency: IR-TBD-0044 has no invoice (orphan)", "INC-TBD-0042"), clean("IF-10", at("06:30"), "Match exception queue age within limit"),
    clean("IF-11", at("01:20"), "MRP-TBD-1009: 216 proposals, 33 exceptions, within trend"), clean("IF-12", "2026-10-02T08:00", "Close step 6e: no settling gaps"), clean("IF-13", "2026-10-02T08:00", "Checklist read APIs consistent"),
    bad("IF-14", "2026-10-01T08:10", "Monthly IC recon: TRADE-TBD-ARRESTER pair rolled back, both documents out of balance", "INC-TBD-0043"), clean("IF-15", at("14:15"), "Per-item result log complete; 1 dead letter already tracked (MSG-TBD-10082)"),
    clean("IF-16", "2026-10-01T09:00", "Tax reconciliation report (ACC 19.3) for September within tolerance"), bad("IF-17", at("12:00"), "Sync conflict queue: EBOM-TBD-0377 line 50 material group", "INC-TBD-0044"),
    clean("IF-18", "2026-07-01T09:00", "Quarterly access recertification attested"),
    { id: "REC-IF-19-1009", interfaceId: "IF-19", at: at("09:15"), by: "Scheduler", result: "Exceptions", exceptions: 1, finding: "Failed-print queue: PRN-PACK-02 offline, reprint audit open", incidentId: "INC-TBD-0040" },
  ]
}

// ============================================================================ periods
const MONTHS = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
export const periodId = (entityId: LegalEntityId, month: string) => `FP-${entityId.slice(3)}-${month}` as const

function seedPeriods(): Period[] {
  const out: Period[] = []
  for (const e of LEGAL_ENTITIES) {
    for (const month of MONTHS) {
      const p: Period = { id: periodId(e.id, month), entityId: e.id, month, status: "Hard Close", history: [] }
      const nextMonthDay = (d: number) => {
        const [y, m] = month.split("-").map(Number)
        const ny = m === 12 ? y + 1 : y
        const nm = m === 12 ? 1 : m + 1
        return `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      }
      if (month === "2025-12") p.status = "Year-End Closed"
      else if (month === "2026-10") p.status = "Open"
      else if (month === "2026-09" && e.id !== "LE-TBD-40") p.status = "Soft Close"
      if (p.status !== "Open") {
        p.softClosedAt = `${month}-28T17:00`
        p.history.push({ at: `${month}-28T17:00`, from: "Open", to: "Soft Close", by: uid("Controller") })
      }
      if (p.status === "Hard Close" || p.status === "Year-End Closed") {
        p.inventoryCloseRunAt = `${nextMonthDay(2)}T10:00`
        p.inventoryCloseBy = uid("Controller")
        p.financeChecklistDone = true
        p.hardClosedAt = `${nextMonthDay(3)}T16:00`
        p.history.push({ at: p.hardClosedAt, from: "Soft Close", to: "Hard Close", by: uid("Controller") })
      }
      if (p.status === "Year-End Closed") p.history.push({ at: "2026-01-20T12:00", from: "Hard Close", to: "Year-End Closed", by: uid("Controller") })
      if (month === "2026-07" && e.id === "LE-TBD-10") {
        p.reopen = { reason: "Late freight accrual on DLV-TBD-0024 (carrier invoice received after hard close)", requestId: "APR-TBD-5032", openedAt: "2026-08-04T13:30", closedAt: "2026-08-06T15:00" }
        p.history.push({ at: "2026-08-04T13:30", from: "Hard Close", to: "Soft Close", by: uid("CFO"), note: "Reopen APR-TBD-5032 (Controller + CFO)" })
        p.history.push({ at: "2026-08-06T15:00", from: "Soft Close", to: "Hard Close", by: uid("Controller"), note: "Reopen window closed" })
        p.hardClosedAt = "2026-08-06T15:00"
      }
      if (month === "2026-09" && e.id === "LE-TBD-20") p.inventoryCloseRunAt = "2026-10-05T09:30"
      if (month === "2026-09" && e.id === "LE-TBD-20") p.inventoryCloseBy = uid("Controller")
      if (p.status === "Open") p.history.push({ at: `${month}-01T00:00`, from: "—", to: "Open", by: uid("Controller"), note: "Opened automatically at the previous period's first Soft Close (R-PER-01)" })
      out.push(p)
    }
  }
  return out
}

function seedPreClose(): PreCloseItem[] {
  const p10 = periodId("LE-TBD-10", "2026-09")
  const p30 = periodId("LE-TBD-30", "2026-09")
  return [
    { id: "PCV-TBD-01", periodId: p10, kind: "Draft GRN", ref: { type: "grn", id: "GRN-TBD-0288" }, description: "Draft GRN, Prairie Plate & Fab tank plate: received 2026-09-30, keyed 2026-10-01 (post with posting date = receipt date)", owner: "Receiving clerk" },
    { id: "PCV-TBD-02", periodId: p10, kind: "Open count", loose: { id: "CD-WH01-014", route: "/inventory/counts" }, description: "Cycle count WH-TBD-01 aisle C, in Variance Review", owner: "Warehouse supervisor" },
    { id: "PCV-TBD-03", periodId: p10, kind: "Unsettled WO", ref: { type: "productionOrder", id: "WO-TBD-0012" }, description: "Technically complete 2026-09-24, not settled (breach after 5 days)", owner: "Cost accountant" },
    { id: "PCV-TBD-04", periodId: p10, kind: "Close-critical job", loose: { id: "RUN-TBD-40061", route: "/operations/jobs?run=RUN-TBD-40061" }, description: "Warranty accrual (#24) failed; the close gate holds until it succeeds (W.3)", owner: "Controller", jobRunId: "RUN-TBD-40061" },
    { id: "PCV-TBD-05", periodId: p10, kind: "Draft GRN", ref: { type: "grn", id: "GRN-TBD-0266" }, description: "Draft GRN, Keystone Copper Conductors CTC", owner: "Receiving clerk", resolved: { by: uid("Receiving clerk"), at: "2026-10-01T10:15", note: "Posted with posting date 2026-09-29" } },
    { id: "PCV-TBD-06", periodId: p30, kind: "Open count", loose: { id: "CD-WH02-006", route: "/inventory/counts" }, description: "Cycle count WH-TBD-02 Regina spares", owner: "Warehouse supervisor", resolved: { by: uid("Warehouse supervisor"), at: "2026-10-02T14:00", note: "Count posted" } },
    { id: "PCV-TBD-07", periodId: p30, kind: "Draft GRN", ref: { type: "grn", id: "GRN-TBD-0262" }, description: "Draft GRN, Laurentian Insulation Papers", owner: "Receiving clerk", resolved: { by: uid("Receiving clerk"), at: "2026-10-01T09:00", note: "Deleted: duplicate of GRN-TBD-0259" } },
  ]
}

function seedTagged(): TaggedPosting[] {
  return [{ at: "2026-08-05T10:20", periodId: periodId("LE-TBD-10", "2026-07"), template: "#26", amount: 3850, currency: "USD", source: { type: "delivery", id: "DLV-TBD-0024" }, tag: "Reopened Posting" }]
}

// ============================================================================ tax
function seedTax(): TaxConfig {
  const c = uid("Controller")
  return {
    engineMode: "Avalara",
    defaultCodes: { Sales: "S1", Purchases: "U1", Intercompany: "E-IC" },
    triggers: { quote: true, so: true, invoice: true, credit: true, void: true },
    nexus: [
      { id: "NX-01", state: "ND", country: "US", entityId: "LE-TBD-10", type: "Physical", effectiveFrom: "2019-01-01", registrationNo: "ND-STX-0048821", filingFrequency: "Monthly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-02", state: "MN", country: "US", entityId: "LE-TBD-10", type: "Economic", effectiveFrom: "2021-04-01", registrationNo: "MN-STX-7731904", filingFrequency: "Quarterly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-03", state: "SD", country: "US", entityId: "LE-TBD-10", type: "Economic", effectiveFrom: "2020-07-01", registrationNo: "SD-STX-1180332", filingFrequency: "Quarterly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-04", state: "NE", country: "US", entityId: "LE-TBD-10", type: "Economic", effectiveFrom: "2025-07-01", registrationNo: "NE-STX-0559210", filingFrequency: "Monthly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-05", state: "WI", country: "US", entityId: "LE-TBD-10", type: "Economic", effectiveFrom: "2022-01-01", registrationNo: "WI-STX-4402187", filingFrequency: "Quarterly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-06", state: "WA", country: "US", entityId: "LE-TBD-10", type: "Economic", effectiveFrom: "2023-10-01", registrationNo: "WA-UBI-603992114", filingFrequency: "Quarterly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-07", state: "IN", country: "US", entityId: "LE-TBD-10", type: "Economic", effectiveFrom: "2024-04-01", registrationNo: "IN-RRMC-0071245", filingFrequency: "Annual", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-08", state: "ND", country: "US", entityId: "LE-TBD-20", type: "Physical", effectiveFrom: "2019-01-01", registrationNo: "ND-STX-0048822", filingFrequency: "Monthly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-09", state: "CA-GST/HST", country: "CA", entityId: "LE-TBD-30", type: "Physical", effectiveFrom: "2018-03-01", registrationNo: "81234 5678 RT0001", filingFrequency: "Quarterly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-10", state: "QC-QST", country: "CA", entityId: "LE-TBD-30", type: "Physical", effectiveFrom: "2018-03-01", registrationNo: "1219876543 TQ0001", filingFrequency: "Quarterly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-11", state: "SK-PST", country: "CA", entityId: "LE-TBD-30", type: "Physical", effectiveFrom: "2019-06-01", registrationNo: "SK-PST-7012299", filingFrequency: "Monthly", addedBy: c, addedOn: "2025-11-20" },
      { id: "NX-12", state: "BC-PST", country: "CA", entityId: "LE-TBD-30", type: "Economic", effectiveFrom: "2021-04-01", registrationNo: "PST-1288-4471", filingFrequency: "Quarterly", addedBy: c, addedOn: "2025-11-20" },
    ],
    thresholds: [
      { state: "IA", salesThreshold: 100000, rolling12Sales: 84100, rolling12Txns: 61, alertRaisedOn: "2026-10-09" },
      { state: "MO", salesThreshold: 100000, rolling12Sales: 88700, rolling12Txns: 14, alertRaisedOn: "2026-09-14" },
      { state: "CO", salesThreshold: 100000, rolling12Sales: 62500, rolling12Txns: 9 },
      { state: "IL", salesThreshold: 100000, txnThreshold: 200, rolling12Sales: 41000, rolling12Txns: 38 },
      { state: "KS", salesThreshold: 100000, rolling12Sales: 12400, rolling12Txns: 3 },
      { state: "MI", salesThreshold: 100000, txnThreshold: 200, rolling12Sales: 0, rolling12Txns: 0 },
    ],
    manualRates: [
      { id: "MR-01", jurisdiction: "ND state", ratePct: 5, validFrom: "2026-01-01", state: "Active", createdBy: c, createdOn: "2025-12-01" },
      { id: "MR-02", jurisdiction: "NE state", ratePct: 5.5, validFrom: "2026-01-01", state: "Active", createdBy: c, createdOn: "2025-12-01" },
      { id: "MR-03", jurisdiction: "MN state", ratePct: 6.875, validFrom: "2026-01-01", state: "Active", createdBy: c, createdOn: "2025-12-01" },
      { id: "MR-04", jurisdiction: "SD state", ratePct: 4.5, validFrom: "2023-01-01", validTo: "2023-06-30", state: "Superseded", createdBy: c, createdOn: "2022-12-01" },
      { id: "MR-05", jurisdiction: "SD state", ratePct: 4.2, validFrom: "2023-07-01", state: "Active", createdBy: c, createdOn: "2023-06-15" },
      { id: "MR-06", jurisdiction: "WI state", ratePct: 5, validFrom: "2026-01-01", state: "Active", createdBy: c, createdOn: "2025-12-01" },
    ],
    recon: [
      { id: "TXR-2026-07-10", month: "2026-07", entityId: "LE-TBD-10", glTax: 41882.1, avalaraTax: 41882.1, explained: 0, reviewedBy: c, reviewedOn: "2026-08-08" },
      { id: "TXR-2026-08-10", month: "2026-08", entityId: "LE-TBD-10", glTax: 186904.55, avalaraTax: 187316.73, explained: 0, reviewedBy: c, reviewedOn: "2026-10-06", adjustmentRequestId: "APR-TBD-5035" },
      { id: "TXR-2026-09-10", month: "2026-09", entityId: "LE-TBD-10", glTax: 52118.4, avalaraTax: 52090.15, explained: 28.25 },
      { id: "TXR-2026-09-30", month: "2026-09", entityId: "LE-TBD-30", glTax: 31402.77, avalaraTax: 31402.77, explained: 0 },
    ],
    audit: [
      { at: "2025-07-01T09:00", by: c, change: "Nexus row NE (Economic) added", effectiveFrom: "2025-07-01", firstDocument: "IR-TBD-0019" },
      { at: "2023-06-15T09:00", by: c, change: "Manual rate SD 4.500% → 4.200% (new dated row)", effectiveFrom: "2023-07-01", firstDocument: "No document (Avalara mode)" },
    ],
  }
}

// ============================================================================ CFG-CORE settings
function seedSettings(): Setting[] {
  const T = THRESHOLDS
  const st = (id: string, section: string, label: string, value: string, owner: Role, source: string, extra: Partial<Setting> = {}): Setting => ({
    id, section, label, owner, source, versions: [{ value, effectiveFrom: "2026-01-01", by: "PRD seed", note: "Configuration workbook seed (A-12)", state: "Active", changeId: `CHG-SEED-${id}` }], ...extra,
  })
  const settings: Setting[] = [
    st("SET-SD-PRICE", "sales", "Price change on the sales tab needs approval above", `±${T.priceChangePct}%`, "Pricing Manager", "pp.28-29 §4"),
    st("SET-SD-BUDG", "sales", "Budgetary quotation tolerance", `±${T.budgetaryQuoteTolerancePct}%`, "Sales Director", "p.50 §3.1"),
    st("SET-SD-BUDV", "sales", "Budgetary quotation validity", `${T.budgetaryQuoteValidityDays} days`, "Sales Director", "p.50 §3.1"),
    st("SET-SD-ETO", "sales", "ETO milestone billing split", T.etoMilestonesPct.join(" / ") + " %", "Controller", "p.53 §4.4; p.177", { gatesPosting: true }),
    st("SET-SD-FLOOR", "sales", "Price floor by profit center", `PC-100 ${T.priceFloorPct["PC-100"]}%, PC-300 ${T.priceFloorPct["PC-300"]}%`, "Pricing Manager", "p.122 §6.3"),
    st("SET-SD-CRDAGE", "sales", "Credit check: block when an invoice is past due more than", "30 days", "Controller", "Book I B §2.2 (config)", { gatesPosting: true }),
    st("SET-SD-CRDPTS", "sales", "Credit check runs at", "Quotation to order conversion, SO submit, any SO change that raises value, shipment release", "Controller", "Book I B §2.2"),
    st("SET-SD-CRDGATE", "sales", "Shipment-release credit gate", "Cannot be bypassed by Sales roles; a Controller release is logged on the order", "Controller", "Book I B §2.2", { gatesPosting: true }),
    st("SET-SD-PACK", "sales", "Pack order creation", "Per picklist", "Shipping Manager", "Book I A §5 (config: per picklist / per shipment)"),
    st("SET-SD-NOQ", "sales", "Order without quotation needs Sales Director above", "$250,000", "Sales Director", "p.52 §4.1 R-OM-02"),
    st("SET-RMA-INSP", "rma", "Receipt to inspection", `${T.rmaReceiptToInspectionBusinessDays} business days`, "Customer Service Manager", "pp.26-27 §3.8"),
    st("SET-RMA-REOPEN", "rma", "RMA reopen window", `${T.rmaReopenDays} days`, "Customer Service Manager", "pp.26-27 §3.8"),
    st("SET-RMA-RESTOCK", "rma", "Restocking fee tiers", T.rmaRestockingPct.join(" / ") + " %", "Customer Service Manager", "pp.26-27 §3.10", { gatesPosting: true }),
    st("SET-RMA-NOREF", "rma", "Credit without invoice reference", `list less ${T.noReferenceCreditListLessPct}%`, "Customer Service Manager", "pp.26-27 §3.10", { gatesPosting: true }),
    st("SET-RMA-MATRIX", "rma", "RMA approval matrix", "CS Manager to $10,000; RC3 or warranty + Quality Manager; + Controller above $50,000 or goodwill", "Customer Service Manager", "p.21; p.27 §3; p.12 W.4"),
    st("SET-PP-LABOR", "production", "Labor booking guardrail", `${T.laborGuardrailPct}% over standard`, "Production supervisor", "pp.78-80"),
    st("SET-PP-SETTLE", "production", "Unsettled order breach after technical completion", `${T.woUnsettledBreachDays} days`, "Cost accountant", "p.126; p.179", { gatesPosting: true }),
    st("SET-PP-OFFLINE", "production", "Terminal offline queue limit", `${T.offlineQueueHours} h`, "Production supervisor", "p.131 §K4"),
    st("SET-PP-EFF", "production", "Default work center efficiency", "85%", "Planning Manager", "pp.69, 71"),
    st("SET-ENG-PH", "engineering", "Placeholder part aging alert", "14 days", "Engineering Manager", "p.58 §1"),
    st("SET-ENG-ECR", "engineering", "Emergency ECR CCB decision SLA", "24 h", "Engineering Manager", "p.62 §4.1"),
    st("SET-ENG-CTRL", "engineering", "ECR cost delta that adds the Controller", "$10,000", "Engineering Manager", "p.62 §4.1"),
    st("SET-QM-TIGHT", "quality", "Switch to tightened inspection", `${T.inspectionTightenRejectedOf5} of 5 lots rejected`, "Quality Manager", "pp.33-35 §6"),
    st("SET-QM-REDUCE", "quality", "Switch to reduced inspection", `${T.inspectionReduceAfterAccepted} lots accepted`, "Quality Manager", "pp.33-35 §6"),
    st("SET-QM-CAL", "quality", "Calibration due alerts", T.calibrationAlertDays.join(" / ") + " days", "Quality Manager", "p.90"),
    st("SET-QM-CAPA", "quality", "CAPA effectiveness check, minimum", `${T.capaEffectivenessMinDays} days`, "Quality Manager", "p.88"),
    st("SET-QM-SCAR", "quality", "Overdue SCARs that restrict a vendor", `${T.scarOverdueRestrictsVendor}`, "Quality Manager", "pp.88-90"),
    st("SET-PUR-RFQ", "purchasing", "RFQ required for uncontracted spend above", "$25,000", "Purchasing Manager", "p.100 §G"),
    st("SET-PUR-UNCONF", "purchasing", "Unconfirmed PO alert after", `${T.unconfirmedPoBusinessDays} business days`, "Purchasing Manager", "p.104 §G"),
    st("SET-PUR-DEV", "purchasing", "PO price deviation tolerance", `${T.poPriceDeviationPct}%`, "Purchasing Manager", "p.104 §G"),
    st("SET-PUR-IRDEV", "purchasing", "Info record vs invoice deviation", `${T.infoRecordInvoiceDeviationPct}%`, "Purchasing Manager", "p.157 §7.2", { gatesPosting: true }),
    st("SET-INV-RECOUNT", "inventory", "Recount when variance exceeds", `${T.countRecountPct}% or $${T.countRecountAmount}`, "Warehouse supervisor", "pp.36-37 §7"),
    st("SET-INV-COUNTAPP", "inventory", "Count approval by supervisor alone up to", "$2,000 per line, $10,000 per document", "Warehouse supervisor", "p.37 §7.5", { gatesPosting: true }),
    st("SET-INV-COUNTFIN", "inventory", "Count Finance approval band (Supervisor → Finance Manager)", "Above the supervisor band, or any ABC class-A item variance", "Warehouse supervisor", "p.37 §7.5; p.12 W.4", { gatesPosting: true }),
    st("SET-INV-COUNTCTL", "inventory", "Count Controller band (third approval)", "Document net variance above $25,000", "Warehouse supervisor", "p.37 §7.5; p.12 W.4", { gatesPosting: true }),
    st("SET-INV-SS", "inventory", "Safety stock change needs approval above", `${T.safetyStockChangePct}% delta`, "Planning Manager", "pp.43-44 §10"),
    st("SET-INV-HU", "inventory", "Handling unit weight tolerance", `±${T.huWeightTolerancePct}%`, "Shipping Manager", "p.32 §5; p.96 SP-17"),
  ]
  // Pending change on the calibration alerts (APR-TBD-5034)
  const cal = settings.find((x) => x.id === "SET-QM-CAL")!
  cal.versions.push({ value: "45 / 14 / 3 days", effectiveFrom: "2026-11-01", by: uid("Process owner"), note: "Long-lead calibration vendors need 45 days notice", state: "Pending approval", requestId: "APR-TBD-5034", changeId: "CHG-TBD-0002" })
  // History on the PO deviation tolerance (C-50: history stays visible)
  const dev = settings.find((x) => x.id === "SET-PUR-UNCONF")!
  dev.versions.unshift({ value: "5 business days", effectiveFrom: "2025-10-01", by: uid("Purchasing Manager"), note: "Legacy system value before go-live", state: "Superseded", changeId: "CHG-TBD-0001" })
  return settings
}

function seedSeries(): NumberSeries[] {
  return [
    { id: "NS-SO", object: "Sales order", format: "SO-{YYYY}-{SEQ:5}", next: 403, gapFree: false, source: "PRD format", changes: [] },
    { id: "NS-LLR", object: "Long-lead release", format: "LLR-{YYYY}-{SEQ:4}", next: 12, gapFree: false, source: "PRD format", changes: [] },
    { id: "NS-STP", object: "Supplier technical package", format: "STP-{SEQ:6}", next: 412, gapFree: false, source: "PRD format", changes: [] },
    { id: "NS-RCL", object: "Recall campaign", format: "RCL-{YYYY}-{SEQ:3}", next: 2, gapFree: false, source: "PRD format", changes: [] },
    { id: "NS-DEV", object: "Deviation / waiver", format: "DEV-{YYYY}-{SEQ:4}", next: 19, gapFree: false, source: "PRD format", changes: [] },
    { id: "NS-CD", object: "Count document", format: "CD-{plan}-{SEQ:3}", next: 15, gapFree: false, source: "PRD format", changes: [] },
    { id: "NS-ALC", object: "Allocation run", format: "ALC-{YYYYMM}-{NN}", next: 2, gapFree: false, source: "PRD format", changes: [] },
    { id: "NS-INV", object: "Customer invoice (ACC)", format: "Not in the KB (ACC V2.0)", next: 0, gapFree: true, source: "Gap-free where finance requires (invoices) [Book III B §2]", changes: [] },
    { id: "NS-PO", object: "Purchase order", format: "PO-TBD-{SEQ:4}", next: 412, gapFree: false, source: "Placeholder (OQ-30)", changes: [] },
    { id: "NS-WO", object: "Production order", format: "WO-TBD-{SEQ:4}", next: 409, gapFree: false, source: "Placeholder (OQ-30)", changes: [] },
    { id: "NS-RMA", object: "RMA", format: "RMA-TBD-{SEQ:4}", next: 20, gapFree: false, source: "Placeholder (OQ-30)", changes: [] },
    { id: "NS-APR", object: "Approval request", format: "APR-TBD-{SEQ:4}", next: 5036, gapFree: false, source: "Placeholder (OQ-30)", changes: [] },
  ]
}

export interface SodException {
  id: string
  user: UserId
  grant: string
  expires: string
  requestId?: string
  state: "Active" | "Expired" | "Pending approval"
}
function seedSod(): SodException[] {
  return [
    { id: "SOD-TBD-002", user: uid("AP clerk"), grant: "Vendor master edit during Q2 vendor clean-up", expires: "2026-06-30", state: "Expired" },
    { id: "SOD-TBD-003", user: uid("Buyer"), grant: "Goods receipt posting at the Regina warehouse (one receiver on leave)", expires: "2026-10-20", state: "Active" },
    { id: "SOD-TBD-004", user: uid("AP clerk"), grant: "Vendor bank-detail edit during month-end", expires: "2026-10-31", requestId: "APR-TBD-5028", state: "Pending approval" },
  ]
}

export function seedAll() {
  const instances = seedInstances()
  return {
    definitions: seedDefinitions(),
    instances,
    audit: seedAudit(instances),
    /** Shared-engine requests: recalled marks and the earlier rounds kept across a resubmit (the shared engine has no such field, R-3). */
    sharedLineage: {} as Record<string, { recalled?: boolean; rounds: { steps: InstStep[]; outcome: InstOutcome; closedAt: string }[] }>,
    delegations: seedDelegations(),
    runs: seedRuns(),
    messages: seedMessages(),
    stats: seedStats(),
    incidents: seedIncidents(),
    recon: seedRecon(),
    periods: seedPeriods(),
    preClose: seedPreClose(),
    tagged: seedTagged(),
    tax: seedTax(),
    settings: seedSettings(),
    series: seedSeries(),
    sod: seedSod(),
    sharedSeeded: false,
    seq: 5039,
    runSeq: 40200,
    incSeq: 46,
    reconSeq: 1,
    chgSeq: 3,
  }
}
