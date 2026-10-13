// Static seed for the shell group. All names, numbers and dates are fictitious (GUARDRAILS 7).
// W.2 alert catalog: every alert named across the Books registers here [DOC:p.10 W.2] (asserted).
// Severity names, the dedupe windows and the digest cadence are design values (shown as readings).

export type Severity = "Critical" | "Warning" | "Info"

export interface Notification {
  id: string
  severity: Severity
  /** W.2 alert-catalog rule that raised it. */
  rule: string
  title: string
  body: string
  source: string
  link: string
  on: string
  /** Dedupe: how many raises were folded into this one inside the rule's window. */
  folded: number
  read: boolean
  dismissed?: boolean
}

export const ALERT_CATALOG: { rule: string; severity: Severity; trigger: string; recipients: string; dedupe: string; digest: boolean; screen: string }[] = [
  { rule: "Below safety stock", severity: "Warning", trigger: "On-hand + inbound below safety stock for an item and plant", recipients: "Planner, Material steward", dedupe: "24 h per item", digest: true, screen: "/inventory/safety-stock" },
  { rule: "Calibration due", severity: "Warning", trigger: "Instrument due in 30, 14 and 3 days; Overdue blocks test (E-QM-05)", recipients: "Quality engineer, Test technician", dedupe: "one per threshold", digest: false, screen: "/quality/calibration" },
  { rule: "Unconfirmed POs", severity: "Warning", trigger: "PO Sent and not Confirmed after 3 business days", recipients: "Buyer", dedupe: "24 h per PO", digest: true, screen: "/purchasing/orders" },
  { rule: "Placeholder aging", severity: "Info", trigger: "Placeholder material older than its aging limit", recipients: "Material steward", dedupe: "7 d per material", digest: true, screen: "/materials/creation-requests" },
  { rule: "Promise-at-risk", severity: "Critical", trigger: "A confirmed delivery date cannot be met from current supply", recipients: "Sales admin, Planner", dedupe: "24 h per order line", digest: false, screen: "/sales/backorders" },
  { rule: "DLQ depth", severity: "Critical", trigger: "Dead-letter queue depth above threshold on an interface", recipients: "Plant IT", dedupe: "1 h per interface", digest: false, screen: "/operations/jobs" },
  { rule: "SLO burn", severity: "Warning", trigger: "Error budget burn above rate for a service-level objective", recipients: "Plant IT", dedupe: "1 h per SLO", digest: true, screen: "/operations/jobs" },
  { rule: "Certificate expiry", severity: "Warning", trigger: "Vendor compliance document or TLS certificate nearing expiry", recipients: "Buyer, Plant IT", dedupe: "7 d per certificate", digest: true, screen: "/purchasing/vendors" },
  { rule: "Count SLA", severity: "Warning", trigger: "A count document is open beyond its SLA", recipients: "Warehouse supervisor", dedupe: "24 h per document", digest: true, screen: "/inventory/counts" },
  { rule: "Close checklist blockers", severity: "Critical", trigger: "Period-close checklist has a blocker inside the soft-close window", recipients: "Controller", dedupe: "4 h per period", digest: false, screen: "/configuration/periods" },
]

export const NOTIFICATION_SEED: Notification[] = [
  { id: "NTF-TBD-0001", severity: "Critical", rule: "Promise-at-risk", title: "SO-2026-00377 line 10: promise at risk", body: "Three 20 MVA units are promised for 2027-03-15. HV bushing batch BAT-TBD-B0301 is blocked by recall RCL-2026-001; six reserved bushings cannot ship.", source: "Sales", link: "/sales/orders/SO-2026-00377", on: "2026-10-09 07:40", folded: 3, read: false },
  { id: "NTF-TBD-0002", severity: "Critical", rule: "Close checklist blockers", title: "Period 2026-09: 2 checklist blockers", body: "Soft Close is set for the period. Unsettled production orders and 1 Draft GRN remain on the close checklist.", source: "Controlling", link: "/configuration/periods", on: "2026-10-09 06:15", folded: 1, read: false },
  { id: "NTF-TBD-0003", severity: "Warning", rule: "Below safety stock", title: "RAW-TBD-CRGO23 below safety stock", body: "On hand 41,000 kg against safety stock 60,000 kg. PR-TBD-0377 (54,000 kg) is approved; PO-TBD-0377 waits in approval.", source: "Inventory", link: "/inventory/items/RAW-TBD-CRGO23", on: "2026-10-09 05:02", folded: 5, read: false },
  { id: "NTF-TBD-0004", severity: "Warning", rule: "Unconfirmed POs", title: "PO-TBD-0302 not confirmed after 3 business days", body: "Sent 2026-10-02 to Hanseong Porcelain & Polymer; no vendor confirmation.", source: "Purchasing", link: "/purchasing/orders/PO-TBD-0302", on: "2026-10-08 16:30", folded: 1, read: false },
  { id: "NTF-TBD-0005", severity: "Warning", rule: "Calibration due", title: "Instrument due in 14 days", body: "Hipot tester calibration due 2026-10-23. At 3 days the final-test interlock warns; Overdue blocks the test (E-QM-05).", source: "Quality", link: "/quality/calibration", on: "2026-10-08 09:00", folded: 1, read: true },
  { id: "NTF-TBD-0006", severity: "Warning", rule: "Certificate expiry", title: "Vendor certificate expires in 21 days", body: "ISO 9001 certificate on file for VEN-TBD-0103 expires 2026-10-30.", source: "Purchasing", link: "/purchasing/vendors/VEN-TBD-0103", on: "2026-10-07 08:00", folded: 1, read: true },
  { id: "NTF-TBD-0007", severity: "Info", rule: "Placeholder aging", title: "2 placeholder materials older than 30 days", body: "Created from engineering requests; MCR tasks still open.", source: "Materials", link: "/materials/creation-requests", on: "2026-10-07 07:00", folded: 2, read: true },
  { id: "NTF-TBD-0008", severity: "Warning", rule: "Count SLA", title: "Count document beyond SLA", body: "Cycle count in WH-TBD-01 has been in Counting for 3 days.", source: "Inventory operations", link: "/inventory/counts", on: "2026-10-06 14:20", folded: 1, read: true },
  { id: "NTF-TBD-0009", severity: "Critical", rule: "DLQ depth", title: "Label print queue: dead-letter depth 14", body: "ZT411 at Pack station did not acknowledge 14 print jobs. Reprints need a reason.", source: "Plant IT", link: "/operations/jobs", on: "2026-10-06 11:05", folded: 4, read: true },
  { id: "NTF-TBD-0010", severity: "Info", rule: "SLO burn", title: "Scan feedback P95 near the 400 ms target", body: "P95 reached 360 ms on the pack station kiosk in the last hour.", source: "Plant IT", link: "/operations/jobs", on: "2026-10-05 10:45", folded: 1, read: true },
]

// ------------------------------------------------------------------------ validation register
export type ValidationKind = "Kiosk and scanner usability" | "Accessibility pass" | "Internal design QA" | "Design QA extended modules" | "Screen spec cards" | "DG-2 developer handoff"
export interface ValidationItem {
  id: string
  kind: ValidationKind
  subject: string
  owner: string
  state: "Not started" | "In progress" | "Findings open" | "Passed"
  findings: number
  note: string
  route: string
}
export const VALIDATION_SEED: ValidationItem[] = [
  { id: "VAL-001", kind: "Kiosk and scanner usability", subject: "Shop-floor terminal PP-SFT-001 on the 15.6 in kiosk, gloves on", owner: "Production supervisor + Operator", state: "Not started", findings: 0, note: "Targets 48 px and up; scan field keeps focus; 400 ms feedback (Book V section 8.4)", route: "/production/terminal" },
  { id: "VAL-002", kind: "Kiosk and scanner usability", subject: "Zebra TC77 warehouse moves and counts (4.7 in)", owner: "Warehouse supervisor", state: "Not started", findings: 0, note: "Single column; ring scanner RS5100; offline queue banner", route: "/shell/devices" },
  { id: "VAL-003", kind: "Kiosk and scanner usability", subject: "WT6300 wrist terminal pick (about 3.2 in, no keyboard)", owner: "Warehouse operator", state: "Not started", findings: 0, note: "Wrist-terminal support is an open decision in the feature list", route: "/shell/devices" },
  { id: "VAL-004", kind: "Accessibility pass", subject: "Status badges: icon plus word, 4.5:1 text contrast", owner: "Design", state: "In progress", findings: 2, note: "WCAG 2.2 AA floor, a11y.md", route: "/components/status-lifecycle" },
  { id: "VAL-005", kind: "Accessibility pass", subject: "Keyboard-only walk of every kiosk task", owner: "Design", state: "Not started", findings: 0, note: "Every task completable by keyboard alone (F-01)", route: "/components/kiosk-controls" },
  { id: "VAL-006", kind: "Internal design QA", subject: "Nine mandatory states on the screens built so far", owner: "Design QA", state: "Findings open", findings: 6, note: "Offline, degraded and authorization-error states are missing on module screens; the state kit offers them", route: "/components/state-kit" },
  { id: "VAL-007", kind: "Internal design QA", subject: "Status words verbatim from S-1..S-43", owner: "Design QA", state: "Passed", findings: 0, note: "Unknown-status badge shows any typo at once", route: "/components/status-lifecycle" },
  { id: "VAL-008", kind: "Design QA extended modules", subject: "Book IX target-state modules", owner: "Design QA", state: "Not started", findings: 0, note: "Phased activation; low priority in the feature list", route: "/coverage" },
  { id: "VAL-009", kind: "Screen spec cards", subject: "Spec card per screen (Book IV section 9.4): fields, actions, API calls, nine states, drill-through", owner: "Hi-fi spec", state: "In progress", findings: 0, note: "Frame names carry the screen ID so requirement linkage is mechanical", route: "/components/guidelines" },
  { id: "VAL-010", kind: "DG-2 developer handoff", subject: "Handoff per module: sales", owner: "Handoff", state: "Not started", findings: 0, note: "A frame without a spec link fails design review (gate DG-2)", route: "/coverage" },
  { id: "VAL-011", kind: "DG-2 developer handoff", subject: "Handoff per module: materials", owner: "Handoff", state: "Not started", findings: 0, note: "Same rule", route: "/coverage" },
  { id: "VAL-012", kind: "DG-2 developer handoff", subject: "Handoff per module: production and quality", owner: "Handoff", state: "Not started", findings: 0, note: "Same rule", route: "/coverage" },
]

// ------------------------------------------------------------------------ legacy material codes (design value)
export const LEGACY_CODES: Record<string, string> = {
  "RAW-TBD-CRGO23": "10-4471",
  "RAW-TBD-OLTC": "10-9012",
  "FIN-TBD-20MVA": "FG-2000-20",
  "FIN-TBD-2500PM": "FG-1100-25",
}

// ------------------------------------------------------------------------ role to landing page (design value)
// Book VIII names six landing pages (Executive, Inventory, Finance, Production, Quality, Sales). The
// feature list builds four dashboards; the other roles land on the screen that holds their queue.
// The whole mapping is a reading: the PRD gives no role-to-page table.
export interface Landing {
  route: string
  label: string
  screen: string
}
const L = (route: string, label: string, screen: string): Landing => ({ route, label, screen })
const EXEC = L("/dashboards/executive", "Executive dashboard", "FX-DASH-EXEC")
const SALES = L("/dashboards/sales", "Sales dashboard", "FX-DASH-SALES")
const PROD = L("/dashboards/production", "Production dashboard", "FX-DASH-PROD")
const INV = L("/dashboards/inventory", "Inventory dashboard", "FX-DASH-INV")
const QUAL = L("/quality/dashboard", "Quality dashboard", "QM-DASH-001")
const ENG = L("/engineering", "Engineering workspace", "ENG-HOME-001")
const PUR = L("/purchasing/workbench", "Buyer workbench", "PUR-WB-001")
const CO = L("/controlling/reports", "Controlling reports", "CO-R1..R4")
export const ROLE_LANDING: Record<string, Landing> = {
  "Sales rep": SALES, "Sales admin": SALES, "Customer service": SALES, "Customer Service Manager": SALES, Estimator: SALES, "Pricing Manager": SALES, "Sales Director": SALES,
  "Finance (credit)": SALES, Controller: EXEC, CFO: EXEC, "Cost accountant": CO, "Controlling analyst": CO, "AP clerk": L("/approvals", "Approvals inbox", "WF-INBOX"),
  "Shipping office": L("/sales/deliveries", "Delivery cockpit", "OM-DLV-001"), Packer: L("/sales/packing", "Packing queue", "OM-PACK-*"), "Shipping Manager": L("/sales/deliveries", "Delivery cockpit", "OM-DLV-001"),
  "Receiving clerk": INV, "Warehouse operator": INV, "Warehouse supervisor": INV, "Material steward": INV, "Materials Manager": INV,
  Engineer: ENG, "Engineering Manager": ENG, "Manufacturing engineer": PROD, "Document control": L("/engineering/documents", "Controlled documents", "ENG-DOC-001/2"), "Engineering IT": L("/engineering/cad-sync", "CAD sync monitor", "CAD-SYNC"),
  Planner: PROD, "Planning Manager": PROD, "Production Scheduler": PROD, "Production supervisor": PROD, Operator: L("/production/terminal", "Shop floor terminal", "PP-SFT-001"),
  Inspector: QUAL, "Test technician": L("/quality/final-test", "Final test", "QM-FIN-001"), "Quality engineer": QUAL, "Quality Manager": QUAL, "Quality IT": QUAL,
  Buyer: PUR, "Purchasing Manager": PUR,
  "Process owner": L("/approvals", "Approvals inbox", "WF-INBOX"), "Plant IT": L("/operations/jobs", "Job console", "OPS-JOBS/INT"), Executive: EXEC,
}
export const DEFAULT_LANDING: Landing = L("/approvals", "Approvals inbox", "WF-INBOX")
