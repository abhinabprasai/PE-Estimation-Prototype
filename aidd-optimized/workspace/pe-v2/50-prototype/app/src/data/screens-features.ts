// Feature-list screen entries. The user's feature list (00-inputs/feature-list-2026-10.md, 12 Oct 2026)
// is part of the prototype's scope together with the PRD. Rows that the 84-entry PRD screen plan
// (screens.ts) does not list (bespoke components, shell and system states, dashboards, dialogs, config
// pages, reports, print outputs, mobile flows, Book IX target-state modules) are registered here, so
// navigation, /coverage and the placeholders show them from day one. Ids marked FX- are ids made up
// for this registry (the feature list gives no id); ids with a PRD style (EDI-PART-001, SVO-001 ...)
// are the feature list's own. Routes are design values (routeSource "design") unless the feature list
// names a screen id, and even then the path is ours. `feature` is the feature-list section.
// Rows that are a tab or panel of an existing screen get no entry: they are scope of that screen and
// are listed in the owning group's README under "Feature rows". Foundation/feature-mapper-owned.

import { groupOfModule, type PrdModule } from "./modules"
import type { Archetype, FlowId, ScreenEntry, Wave } from "./screens"

type Spec = {
  id: string
  title: string
  route: string
  a: Archetype
  m: PrdModule
  w?: Wave
  flows?: FlowId[]
  extra?: string[]
  post?: string
  note?: string
  users?: string
}

const WAVE: Partial<Record<PrdModule, Wave>> = {
  Sales: "W2", Returns: "W5", Materials: "W2", "Inventory (Book VII)": "W2", Engineering: "W3", "CAD and Documents": "W3", Planning: "W4", Production: "W4",
  Quality: "W5", Purchasing: "W6", "Costing and Pricing": "W6", Controlling: "W6", "Traceability and Barcode": "W4", "Workflow and Administration": "W1",
  "Global Shell and System States": "W1", "Component Library": "W1", "Home and Dashboards": "W7", "Print Outputs": "W7", "Flow Prototypes and Handoff": "W7", "Inventory Operations": "W6",
}

const mk = (feature: string, list: Spec[]): ScreenEntry[] =>
  list.map((s) => {
    const target = groupOfModule(s.m) === "target-state"
    return {
      id: s.id,
      title: s.title,
      module: s.m,
      group: groupOfModule(s.m),
      route: s.route,
      extraRoutes: s.extra,
      routeSource: "design",
      archetype: s.a,
      archetypeText: s.a,
      archetypeSource: "design",
      wave: s.w ?? WAVE[s.m] ?? "W7",
      waveNote: target ? "Target state (Book IX): later phase, activation governed by the decision register" : undefined,
      flows: s.flows ?? [],
      flowBasis: "",
      users: s.users ?? "not extracted",
      postings: s.post ?? "none",
      built: "none",
      kiosk: s.a === "Kiosk" ? true : undefined,
      note: s.note,
      source: "feature-list",
      feature,
    }
  })

const SHELL_STATES = "Global Shell and System States" as const
const CMP = "Component Library" as const
const HOME = "Home and Dashboards" as const
const PRINT = "Print Outputs" as const
const FLOWP = "Flow Prototypes and Handoff" as const
const INVOPS = "Inventory Operations" as const

export const FEATURE_SCREENS: ScreenEntry[] = [
  // ------------------------------------------------------------ Project setup and design foundations
  ...mk("Project Setup & Design Foundations", [
    { id: "FX-FND-TOKENS", title: "Design tokens and responsive breakpoints", route: "/components/tokens", a: "Detail", m: CMP, note: "Figma setup row: PE tokens, six status colours, row heights; also the responsive and device breakpoint spec" },
    { id: "FX-FND-ARCH", title: "Archetype map and traceability", route: "/components/archetype-map", a: "Detail", m: CMP, note: "Spec immersion row: the eight archetypes mapped to the screens, DEC-01..10 and frame-ID conventions" },
    { id: "FX-FND-STATES", title: "Nine mandatory states and legal hold", route: "/components/state-kit", a: "Detail", m: CMP, note: "Normal, empty, loading, validation, authorization error, conflict diff, offline, degraded, read-only; legal-hold chip and dialog, archived banner, archive-query loading" },
    { id: "FX-FND-ARCHETYPES", title: "Eight archetypes as component sets", route: "/components/archetypes", a: "Detail", m: CMP, note: "Live set of the eight templates; extends /dev/templates" },
  ]),
  // ------------------------------------------------------------ Bespoke domain component library
  ...mk("Bespoke Domain Component Library", [
    { id: "FX-CMP-STATUS", title: "Status badge and lifecycle strip", route: "/components/status-lifecycle", a: "Detail", m: CMP },
    { id: "FX-CMP-CONTEXT", title: "Entity context bar, audit trail and attachments", route: "/components/context-audit", a: "Detail", m: CMP },
    { id: "FX-CMP-READY", title: "Readiness chips", route: "/components/readiness-chips", a: "Detail", m: CMP },
    { id: "FX-CMP-APPROVAL", title: "Approval strip", route: "/components/approval-strip", a: "Detail", m: CMP },
    { id: "FX-CMP-WATERFALL", title: "Price waterfall panel", route: "/components/price-waterfall", a: "Detail", m: CMP },
    { id: "FX-CMP-SCAN", title: "Scan input and feedback flash", route: "/components/scan-feedback", a: "Detail", m: CMP },
    { id: "FX-CMP-TREE", title: "Tree explorer", route: "/components/tree-explorer", a: "Detail", m: CMP },
    { id: "FX-CMP-MILESTONE", title: "Milestone strip (ETO)", route: "/components/milestone-strip", a: "Detail", m: CMP },
    { id: "FX-CMP-DIFF", title: "Diff viewer", route: "/components/diff-viewer", a: "Detail", m: CMP },
    { id: "FX-CMP-GL", title: "GL preview panel", route: "/components/gl-preview", a: "Detail", m: CMP },
    { id: "FX-CMP-EXCEPTION", title: "Exception worklist card and SLA aging", route: "/components/exception-cards", a: "Detail", m: CMP },
    { id: "FX-CMP-KIOSK", title: "Kiosk control set", route: "/components/kiosk-controls", a: "Detail", m: CMP },
    { id: "FX-CMP-GANTT", title: "Finite schedule, Gantt and capacity bars", route: "/components/schedule-gantt", a: "Detail", m: CMP },
    { id: "FX-CMP-BOARD", title: "Board and pipeline cards", route: "/components/kanban", a: "Detail", m: CMP },
    { id: "FX-CMP-RFQGRID", title: "Comparison grid (RFQ)", route: "/components/rfq-comparison", a: "Detail", m: CMP },
    { id: "FX-CMP-TESTROW", title: "Test characteristic row and calibration interlock", route: "/components/test-characteristic", a: "Detail", m: CMP },
    { id: "FX-CMP-DATAVIZ", title: "Data-viz set", route: "/components/data-viz", a: "Detail", m: CMP },
    { id: "FX-CMP-SIM", title: "Simulation and preview pattern", route: "/components/simulation-preview", a: "Detail", m: CMP },
    { id: "FX-CMP-TAX", title: "Line tax override dialog and tax-status badges", route: "/components/tax-override", a: "Dialog", m: CMP },
    { id: "FX-CMP-COMPLETE", title: "Data completeness bar and function-block chips", route: "/components/completeness", a: "Detail", m: CMP },
    { id: "FX-CMP-GUIDE", title: "Component documentation and usage guidelines", route: "/components/guidelines", a: "Detail", m: CMP },
  ]),
  // ------------------------------------------------------------ Global shell, navigation and system states
  ...mk("Global Shell, Navigation & System States", [
    { id: "FX-SHL-NAV", title: "App shell, sidebar, entity selector and breadcrumbs", route: "/shell/navigation", a: "Detail", m: SHELL_STATES, note: "12 top-level modules with children, entity selector, collapse and responsive, breadcrumbs" },
    { id: "FX-SHL-SEARCH", title: "Global search results", route: "/search", a: "List", m: SHELL_STATES, note: "Materials incl. legacy code, documents, customers, vendors, serials and batches; results, no-results, recent (ADR-04)" },
    { id: "FX-SHL-NOTIF", title: "Notification center", route: "/notifications", a: "Workbench", m: SHELL_STATES, note: "Severity, digest, dedupe, deep links; W.2 alert catalog" },
    { id: "FX-SHL-PROFILE", title: "User profile and preferences", route: "/profile", a: "Config", m: SHELL_STATES, note: "Delegation with date range (over $250k restriction message), digest preferences, table density" },
    { id: "FX-SHL-SSO", title: "SSO entry, session and step-up MFA states", route: "/auth/sso", a: "Detail", m: SHELL_STATES, extra: ["/auth/session-expired", "/auth/step-up", "/auth/kiosk-lock"], note: "IdP assumed Entra ID (risk in the feature list)" },
    { id: "FX-SHL-ERRORS", title: "System error and degraded pages", route: "/errors/403", a: "Detail", m: SHELL_STATES, extra: ["/errors/404", "/errors/500", "/errors/maintenance", "/errors/degraded", "/errors/wan-down"], note: "403 explains the missing role; dependency-degraded banner (tax engine, broker, IdP, printer); WAN-down read-only" },
    { id: "FX-SHL-DEVICES", title: "Responsive and device breakpoints", route: "/shell/devices", a: "Detail", m: SHELL_STATES, note: "Desktop, tablet, Zebra TC77 4.7 in, Zebra WT6300 wrist about 3.2 in, 15.6 in kiosk 1280 x 800" },
  ]),
  // ------------------------------------------------------------ Home and role dashboards
  ...mk("Home & Role Dashboards", [
    { id: "FX-HOME-LANDING", title: "Role landing page", route: "/home", a: "Dashboard", m: HOME, w: "W1", note: "Role to landing page mapping" },
    { id: "FX-DASH-EXEC", title: "Executive dashboard", route: "/dashboards/executive", a: "Dashboard", m: HOME, users: "Executive roles" },
    { id: "FX-DASH-SALES", title: "Sales dashboard", route: "/dashboards/sales", a: "Dashboard", m: HOME, flows: ["FL-01", "FL-02"] },
    { id: "FX-DASH-PROD", title: "Production dashboard", route: "/dashboards/production", a: "Dashboard", m: HOME, flows: ["FL-04"] },
    { id: "FX-DASH-INV", title: "Inventory dashboard (safety-stock breach tile)", route: "/dashboards/inventory", a: "Dashboard", m: HOME },
  ]),
  // ------------------------------------------------------------ Print outputs, documents and notifications
  ...mk("Print Outputs, Documents & Notifications", [
    { id: "FX-PRN-QUOTE", title: "Quote PDF (commercial, ETO datasheet, terms)", route: "/print/quote", a: "Detail", m: PRINT, flows: ["FL-01", "FL-02"] },
    { id: "FX-PRN-ORDER", title: "Order and change confirmation PDFs", route: "/print/order-confirmation", a: "Detail", m: PRINT, flows: ["FL-01", "FL-02"] },
    { id: "FX-PRN-PACKLIST", title: "Packing list and transformer shipping addendum", route: "/print/packing-list", a: "Detail", m: PRINT, flows: ["FL-09"] },
    { id: "FX-PRN-RETURN", title: "Return instructions PDF and warranty denial letter", route: "/print/return-instructions", a: "Detail", m: PRINT, flows: ["FL-05"] },
    { id: "FX-PRN-TRAVELER", title: "Traveler and shop packet", route: "/print/traveler", a: "Detail", m: PRINT, flows: ["FL-04"] },
    { id: "FX-PRN-FTR", title: "Final Test Report (FTR)", route: "/print/ftr", a: "Detail", m: PRINT, flows: ["FL-04", "FL-02"] },
    { id: "FX-PRN-PO", title: "PO PDF, RFQ invite and regret notice", route: "/print/purchase-order", a: "Detail", m: PRINT, flows: ["FL-03", "FL-10"] },
    { id: "FX-PRN-CUTOVER", title: "Cutover fallback paper forms", route: "/print/cutover-forms", a: "Detail", m: PRINT },
    { id: "FX-PRN-SHIPDOCS", title: "BOL, CoC, certificate dossier cover and transmittal sheet", route: "/print/shipping-documents", a: "Detail", m: PRINT, flows: ["FL-09", "FL-02"] },
    { id: "FX-PRN-RFQRESP", title: "RFQ vendor response form", route: "/print/rfq-response", a: "Detail", m: PRINT, flows: ["FL-03", "FL-10"] },
    { id: "FX-PRN-COUNT", title: "Count document print (blind and expected)", route: "/print/count-document", a: "Detail", m: PRINT, flows: ["FL-06"] },
    { id: "FX-PRN-INSPPLAN", title: "Inspection plan PDF", route: "/print/inspection-plan", a: "Detail", m: PRINT },
    { id: "FX-PRN-INVSUPP", title: "Invoice supplement (packing data)", route: "/print/invoice-supplement", a: "Detail", m: PRINT, flows: ["FL-09"] },
    { id: "FX-PRN-SPARES", title: "As-built spares parts list PDF", route: "/print/spares-list", a: "Detail", m: PRINT, flows: ["FL-05"] },
    { id: "FX-PRN-EMAIL", title: "Email notification templates", route: "/print/email-templates", a: "List", m: PRINT },
    { id: "FX-PRN-LABELS", title: "Label layouts, print-ready (11 classes)", route: "/print/labels", a: "Detail", m: PRINT, flows: ["FL-11"], extra: ["/print/labels/:id"], note: "HU 4x6 (GS1, SSCC-18, hazmat, x-of-y), HU contents, batch 4x2, item 2x1, serial 4x2, location 4x1, traveler op strip, RMA return, operator badge, calibration 1x0.5, nameplate data sheet and serial plate" },
  ]),
  // ------------------------------------------------------------ Flow prototypes, validation and handoff
  ...mk("Flow Prototypes, Validation & Handoff", [
    { id: "FX-FLW-INDEX", title: "Flow prototypes A to G and portal / field-service", route: "/flows", a: "Detail", m: FLOWP, extra: ["/flows/:id"], flows: ["FL-01", "FL-02", "FL-03", "FL-04", "FL-05", "FL-09", "FL-10", "FL-11"], note: "A order to delivery, B engineering to procurement, C plan to produce, D procure to pay, E traceability, F RMA, G ETO quote to cash, plus portal and field-service" },
    { id: "FX-FLW-VALIDATION", title: "Validation and handoff register", route: "/flows/validation", a: "Detail", m: FLOWP, note: "Kiosk and scanner usability validation, accessibility pass, design QA, screen spec cards, DG-2 handoff per module" },
  ]),
  // ------------------------------------------------------------ Workflow, approvals and administration
  ...mk("Workflow, Approvals & Administration", [
    { id: "FX-WF-MOBILE", title: "Mobile approval view and email-action landing pages", route: "/approvals/mobile", a: "Detail", m: "Workflow and Administration", extra: ["/approvals/action/:token"], flows: ["FL-03", "FL-06"], note: "Signed-link confirm, expired, already actioned, unauthorized" },
    { id: "FX-WF-DIALOGS", title: "Approval history, recall and reject dialogs", route: "/approvals/dialogs", a: "Dialog", m: "Workflow and Administration", note: "Reject with mandatory comments, recall before first approval, resubmit preserving history" },
    { id: "FX-WF-ALERTS", title: "Alert rules configuration", route: "/configuration/alert-rules", a: "Config", m: "Workflow and Administration" },
    { id: "FX-WF-NOTIFTPL", title: "Notification template manager", route: "/configuration/notification-templates", a: "Config", m: "Workflow and Administration" },
    { id: "FX-WF-RECERT", title: "Access recertification and SoD exception request", route: "/configuration/access-recertification", a: "Workbench", m: "Workflow and Administration" },
    { id: "FX-WF-KPI", title: "KPI dictionary register", route: "/configuration/kpi-dictionary", a: "List", m: "Workflow and Administration" },
    { id: "FX-WF-ANALYTICS", title: "Workflow analytics dashboard", route: "/approvals/analytics", a: "Dashboard", m: "Workflow and Administration" },
  ]),
  // ------------------------------------------------------------ Configuration (core config set)
  ...mk("Configuration (Core Config Set)", [
    { id: "FX-CFG-NUMSERIES", title: "Number series", route: "/configuration/number-series", a: "Config", m: "Workflow and Administration", note: "About 25 new entity-aware series; delta vs INV V3.0 / ACC V2.0 (external specs, ASM-EXT-1)" },
    { id: "FX-CFG-RMAPOLICY", title: "RMA policy configuration", route: "/configuration/rma-policy", a: "Config", m: "Workflow and Administration", flows: ["FL-05"] },
    { id: "FX-CFG-SETTINGS", title: "Sales, Production, Engineering and Quality settings", route: "/configuration/settings", a: "Config", m: "Workflow and Administration", extra: ["/configuration/settings/sales", "/configuration/settings/production", "/configuration/settings/engineering", "/configuration/settings/quality"], note: "Quality no-plan policy per plan type, credit rules, pack-order creation rule (CFG-CORE)" },
    { id: "FX-CFG-MATERIAL", title: "Material settings", route: "/configuration/material-settings", a: "Config", m: "Workflow and Administration", note: "Three-level material group hierarchy (effective-dated), characteristic classes, serial profiles SN-FIN/COMP/SEMI/NONE, type behaviour matrix" },
    { id: "MP-PLANT-001", title: "Plant Master", route: "/configuration/plants", a: "List", m: "Workflow and Administration", extra: ["/configuration/plants/:id"], note: "Book VII section 4. Multi-plant activates on DEC-07" },
    { id: "MP-LANE-001", title: "Transfer Lanes", route: "/configuration/transfer-lanes", a: "Config", m: "Workflow and Administration", note: "Book VII section 4" },
    { id: "FX-CFG-IC", title: "Intercompany relationships and transfer pricing", route: "/configuration/intercompany", a: "Config", m: "Workflow and Administration", flows: ["FL-07"] },
    { id: "FX-CFG-REASONS", title: "Reason-code and lookup catalogs", route: "/configuration/reason-codes", a: "Config", m: "Workflow and Administration", note: "Scrap, hold, RMA, loss, count, block reasons (A-12)" },
    { id: "FX-CFG-DPS-ONBOARD", title: "Denied-party interim onboarding checklist", route: "/configuration/denied-party/onboarding", a: "Detail", m: "Workflow and Administration", note: "Customer and vendor" },
    { id: "FX-CFG-DPS-REVIEW", title: "Denied-party screening review queue", route: "/configuration/denied-party/review", a: "Workbench", m: "Workflow and Administration" },
    { id: "FX-CFG-GLMAP", title: "GL account mapping", route: "/configuration/gl-mapping", a: "Config", m: "Workflow and Administration", note: "22 new accounts; delta vs ACC V2.0 (external spec, ASM-EXT-1)" },
  ]),
  // ------------------------------------------------------------ Barcode, labels and devices
  ...mk("Barcode, Labels & Devices", [
    { id: "FX-BC-EXCEPTIONS", title: "Scan exception queue (offline replay conflicts)", route: "/configuration/barcode/scan-exceptions", a: "Workbench", m: "Traceability and Barcode", flows: ["FL-11"], note: "Conflict card, accept, reject or re-post, supervisor attribution; never silently dropped" },
    { id: "FX-BC-REPRINT", title: "Reprint governance dialog", route: "/configuration/barcode/reprint", a: "Dialog", m: "Traceability and Barcode", flows: ["FL-11"], note: "Reason code, Quality approval for serial and nameplate, DUPLICATE watermark" },
    { id: "FX-BC-RELABEL", title: "Identify and Relabel (mobile)", route: "/mobile/relabel", a: "Kiosk", m: "Traceability and Barcode", flows: ["FL-11"], note: "TC77: resolve against expected bin stock, print, log exception" },
    { id: "FX-BC-CAMERA", title: "Supervisor camera-fallback scanning mode", route: "/mobile/camera-scan", a: "Kiosk", m: "Traceability and Barcode", flows: ["FL-11"] },
  ]),
  // ------------------------------------------------------------ Material management
  ...mk("Material Management", [
    { id: "FX-MM-DIALOGS", title: "Material dialogs", route: "/inventory/dialogs/material", a: "Dialog", m: "Materials", note: "Function-specific block, Extend to Plant, Copy From checklist, duplicate side-by-side compare" },
    { id: "FX-MM-LIFECYCLE", title: "Lifecycle transition and impact-sweep dialogs", route: "/inventory/dialogs/lifecycle", a: "Dialog", m: "Materials", note: "Restrict, Reinstate, Mark Obsolete (V-MM-20), Delete Draft, Recall to Draft, where-used impact panel" },
    { id: "FX-MM-MCHREG", title: "Material change register and document detail", route: "/materials/change-register", a: "List", m: "Materials", extra: ["/materials/change-register/:id"] },
    { id: "FX-MM-DUPES", title: "Duplicate merge steward queue", route: "/materials/duplicates", a: "Workbench", m: "Materials", note: "Usage counts, survivor selection, reference-rewrite worklist, irreversible-merge confirmation" },
    { id: "FX-MM-IMPORT", title: "Bulk import templates upload flow", route: "/materials/import", a: "Wizard", m: "Materials", note: "XLSX per view, per-column diff rejection, creates MCR or MCH" },
    { id: "FX-MM-BATCH", title: "Batch master", route: "/inventory/batches", a: "List", m: "Materials", extra: ["/inventory/batches/:id"], flows: ["FL-08", "FL-11"], note: "Vendor batch and heat, CoO, expiry, certificates, measured characteristics, Expired badge" },
    { id: "FX-MM-SPECIAL", title: "Special stock and ownership", route: "/inventory/special-stock", a: "List", m: "Materials", note: "Owner and peg columns, consignment and customer-property tags, zero-cost customer-supplied badge" },
    { id: "FX-MM-CONSIGN", title: "Consignment settlement run", route: "/inventory/consignment-settlement", a: "Wizard", m: "Materials", note: "Monthly per-vendor self-billing preview and post" },
    { id: "FX-MM-PLANTSRC", title: "Plant sourcing sequence and network MRP fields", route: "/materials/plant-sourcing", a: "Config", m: "Materials", note: "Dormant until DEC-07" },
    { id: "FX-MM-REPORTS", title: "Material management reports R1 to R8", route: "/materials/reports", a: "Dashboard", m: "Materials", extra: ["/materials/reports/:id"] },
    { id: "FX-MM-CREATEFLOW", title: "Material creation flow (placeholder to activation)", route: "/materials/creation-flow", a: "Wizard", m: "Materials", flows: ["FL-10"], note: "Placeholder, MCR tasks, activation, EBOM unblock (Book V section 7.4)" },
    { id: "FX-MM-SSEXC", title: "Safety-stock exception report and projection delta", route: "/inventory/safety-stock/exceptions", a: "Workbench", m: "Inventory (Book VII)" },
    { id: "FX-MM-SSSTAT", title: "Statistical safety stock activation", route: "/inventory/safety-stock/statistical", a: "Wizard", m: "Inventory (Book VII)" },
  ]),
  // ------------------------------------------------------------ Sales and order management
  ...mk("Sales & Order Management", [
    { id: "FX-OM-LEADIMPORT", title: "Lead import and inbound capture review", route: "/sales/leads/import", a: "Workbench", m: "Sales", flows: ["FL-02"] },
    { id: "FX-OM-QT2SO", title: "Quote to order conversion dialog", route: "/sales/dialogs/quote-to-order", a: "Dialog", m: "Sales", flows: ["FL-01", "FL-02"] },
    { id: "FX-OM-KIT", title: "Sales kit BOM explode on quote and order lines", route: "/sales/dialogs/kit-explode", a: "Dialog", m: "Sales", flows: ["FL-01"] },
    { id: "FX-OM-BILLPLAN", title: "Billing plan and milestone editor", route: "/sales/billing-plan", a: "Detail", m: "Sales", flows: ["FL-02"], note: "Must total 100%" },
    { id: "FX-OM-EAC", title: "ETO order cost panel (EAC)", route: "/sales/eto-cost", a: "Detail", m: "Sales", flows: ["FL-02"], note: "Estimate vs committed (incl. LLR) vs actual vs EAC vs margin at completion" },
    { id: "FX-OM-ATP", title: "ATP partial-availability dialog", route: "/sales/dialogs/atp-partial", a: "Dialog", m: "Sales", flows: ["FL-01", "FL-09"], note: "Accept later date, split or backorder, with promised-date write-back" },
    { id: "FX-OM-CHANGE", title: "Sales change order, cancellation and reprice dialogs", route: "/sales/dialogs/change-cancel-reprice", a: "Dialog", m: "Sales", flows: ["FL-01", "FL-02"] },
    { id: "FX-OM-CREDIT", title: "Credit release and de-peg decision dialogs", route: "/sales/dialogs/credit-release-depeg", a: "Dialog", m: "Sales", flows: ["FL-09"] },
    { id: "FX-OM-CUSTPROP", title: "Customer property return and SO closure reconciliation", route: "/sales/dialogs/customer-property", a: "Dialog", m: "Sales", flows: ["FL-05"] },
    { id: "FX-OM-DLVRUN", title: "Delivery creation run wizard", route: "/sales/deliveries/create-run", a: "Wizard", m: "Sales", flows: ["FL-09", "FL-01"], note: "Horizon and scope, simulated grouping with split and merge rule IDs (E-DLV-01), create, result log" },
    { id: "OM-SHP-001/002", title: "Shipments", route: "/sales/shipments", a: "List", m: "Sales", extra: ["/sales/shipments/:id"], flows: ["FL-09", "FL-01"], note: "Carrier, equipment, permits checklist, HU list, PSI gate, documents bundle, POD capture" },
    { id: "FX-OM-EXPORT", title: "Export documentation checklist on shipment", route: "/sales/dialogs/export-docs", a: "Dialog", m: "Sales", flows: ["FL-09"] },
    { id: "FX-OM-PGI", title: "PGI confirmation and PGI reversal dialogs", route: "/sales/dialogs/pgi", a: "Dialog", m: "Sales", flows: ["FL-09", "FL-01"], post: "PGI posts #25, #26, #27; reversal before invoice, same-period guard" },
    { id: "FX-OM-LOADSHIP", title: "Load and ship scan flow (TC77, SP-18)", route: "/sales/load-ship", a: "Kiosk", m: "Sales", flows: ["FL-09"], post: "SP-18; E-BC-08 on wrong HU" },
    { id: "FX-OM-SCALE", title: "Pack station live scale readout", route: "/sales/dialogs/scale-readout", a: "Dialog", m: "Sales", flows: ["FL-09"], note: "Connected, error, stale (IF-20; DEC-08)" },
    { id: "FX-OM-REPORTS", title: "Sales reports (seven)", route: "/sales/reports", a: "Dashboard", m: "Sales", extra: ["/sales/reports/:id"], note: "Open order book, BBB, OTD, margin by order, quote funnel, late and at-risk lines, lead pipeline" },
  ]),
  // ------------------------------------------------------------ RMA, warranty and service
  ...mk("RMA, Warranty & Service", [
    { id: "FX-RMA-DIALOGS", title: "RMA action dialogs", route: "/sales/dialogs/rma-actions", a: "Dialog", m: "Returns", flows: ["FL-05"], note: "Approve or reject, cancel, close short, reopen, unauthorized-line decision" },
    { id: "FX-RMA-CREDITMEMO", title: "Credit memo request panel and Controller credit release", route: "/sales/dialogs/credit-memo", a: "Dialog", m: "Returns", flows: ["FL-05"], note: "E-RMA-07" },
    { id: "FX-RMA-BILLABLE", title: "Billable repair quote and customer approval gate", route: "/sales/dialogs/billable-repair", a: "Dialog", m: "Returns", flows: ["FL-05"] },
    { id: "FX-RMA-EXCLUSIONS", title: "Warranty exclusions catalog", route: "/service/warranty-exclusions", a: "Config", m: "Returns", flows: ["FL-05"] },
  ]),
  // ------------------------------------------------------------ Engineering and BOM
  ...mk("Engineering & BOM", [
    { id: "FX-ENG-RELEASE", title: "EBOM review and release package", route: "/engineering/dialogs/ebom-release", a: "Dialog", m: "Engineering", flows: ["FL-02", "FL-10"] },
    { id: "FX-ENG-COPYFROM", title: "EBOM Copy From and base-design picker", route: "/engineering/dialogs/copy-from", a: "Dialog", m: "Engineering", flows: ["FL-10"] },
    { id: "FX-ENG-COMPARE", title: "Compare revisions view", route: "/engineering/compare-revisions", a: "Detail", m: "Engineering", flows: ["FL-10"] },
    { id: "FX-ENG-MASSREPLACE", title: "Mass replace component dialog", route: "/engineering/dialogs/mass-replace", a: "Dialog", m: "Engineering", flows: ["FL-10"], note: "Auto-creates an ECO" },
    { id: "FX-ENG-WHEREUSED", title: "Where-Used explorer", route: "/engineering/where-used", a: "Workbench", m: "Engineering", flows: ["FL-10", "FL-08"] },
    { id: "FX-ENG-ITEMS", title: "Engineering items view", route: "/engineering/items", a: "List", m: "Engineering" },
    { id: "FX-ENG-REPORTS", title: "Engineering reports (five)", route: "/engineering/reports", a: "Dashboard", m: "Engineering", extra: ["/engineering/reports/:id"] },
  ]),
  // ------------------------------------------------------------ CAD and document control
  ...mk("CAD & Document Control", [
    { id: "FX-DOC-REDLINE", title: "PDF redline review layer", route: "/engineering/redline-review", a: "Detail", m: "CAD and Documents", flows: ["FL-02"] },
    { id: "FX-CAD-COMPARE", title: "CAD vs EBOM structure comparison", route: "/engineering/cad-compare", a: "Detail", m: "CAD and Documents" },
    { id: "FX-CAD-PDM", title: "PDM linkage states", route: "/engineering/pdm-linkage", a: "Detail", m: "CAD and Documents", note: "SolidWorks PDM baseline is an open decision in the feature list" },
  ]),
  // ------------------------------------------------------------ MRP and finite planning
  ...mk("MRP & Finite Planning", [
    { id: "FX-PLN-RUNMRP", title: "Run MRP dialog", route: "/production/dialogs/run-mrp", a: "Dialog", m: "Planning", flows: ["FL-04"], note: "Regenerative vs net-change, progress, summary" },
    { id: "FX-PLN-SCENARIOS", title: "Interactive schedule board and multi-scenario compare", route: "/production/schedule/scenarios", a: "Workbench", m: "Planning", flows: ["FL-04"] },
    { id: "FX-PLN-LOAD", title: "Work center load view", route: "/production/work-center-load", a: "Dashboard", m: "Planning", flows: ["FL-04"] },
    { id: "FX-PLN-RELIABILITY", title: "Promise reliability report", route: "/production/promise-reliability", a: "Dashboard", m: "Planning" },
    { id: "STO-001", title: "Stock Transport Orders", route: "/production/transport-orders", a: "List", m: "Planning", extra: ["/production/transport-orders/:id"], note: "After DEC-07 (multi-plant)" },
    { id: "FX-PLN-CONSTRAINTS", title: "Scheduling constraint masters", route: "/production/scheduling-masters", a: "Config", m: "Planning", flows: ["FL-04"], note: "Operator qualifications, tools, setup families, crew roster, planned-maintenance calendar view" },
  ]),
  // ------------------------------------------------------------ Production and shop floor
  ...mk("Production & Shop Floor", [
    { id: "FX-PRD-CAPTURE", title: "Capture template builder", route: "/production/capture-templates", a: "Config", m: "Production", flows: ["FL-04"] },
    { id: "FX-PRD-WODIALOGS", title: "Production order decision dialogs", route: "/production/dialogs/wo-decisions", a: "Dialog", m: "Production", flows: ["FL-04"], note: "Release Short override, hold, confirmation reversal dual sign-off, SO-cancellation disposition, WO cancel cost decision, close preconditions, settled reopen with JE-reversal preview" },
    { id: "FX-PRD-LABOR", title: "Labor export to payroll (IF-22) review", route: "/production/labor-export", a: "Workbench", m: "Production", flows: ["FL-04"] },
    { id: "FX-PRD-RECEIPT", title: "FG production receipt and subcontract operation views", route: "/production/receipts", a: "List", m: "Production", flows: ["FL-04", "FL-02"] },
    { id: "FX-PRD-REPORTS", title: "Production reports (six)", route: "/production/reports", a: "Dashboard", m: "Production", extra: ["/production/reports/:id"] },
  ]),
  // ------------------------------------------------------------ Quality management
  ...mk("Quality Management", [
    { id: "FX-QM-SAMPLING", title: "Sampling state panel", route: "/quality/sampling", a: "Detail", m: "Quality" },
    { id: "FX-QM-INVALIGN", title: "Inventory quality screens alignment", route: "/quality/stock-status", a: "Workbench", m: "Quality", flows: ["FL-03"] },
    { id: "FX-QM-TESTIMPORT", title: "Test-set CSV import mapping", route: "/quality/test-import", a: "Wizard", m: "Quality", flows: ["FL-04"], note: "DEC-08" },
    { id: "FX-QM-ROUTINE", title: "Transformer routine-test capture forms (nine types)", route: "/quality/routine-tests", a: "Detail", m: "Quality", flows: ["FL-04", "FL-02"] },
    { id: "FX-QM-SCARRESP", title: "SCAR vendor response form (external)", route: "/quality/scar-response", a: "Detail", m: "Quality", flows: ["FL-05", "FL-08"] },
    { id: "FX-QM-SPC", title: "SPC control charts, capability and trend alerts", route: "/quality/spc", a: "Dashboard", m: "Quality", note: "DEC-09" },
    { id: "FX-QM-AUDIT", title: "Quality audit management", route: "/quality/audits", a: "List", m: "Quality", extra: ["/quality/audits/:id"], note: "DEC-09" },
  ]),
  // ------------------------------------------------------------ Traceability
  ...mk("Traceability", [
    { id: "FX-TRC-ASBUILT", title: "As-built record and certificate dossier", route: "/traceability/as-built", a: "Detail", m: "Traceability and Barcode", extra: ["/traceability/as-built/:id"], flows: ["FL-11", "FL-02"] },
    { id: "FX-TRC-CORRECTION", title: "Genealogy correction pair flow", route: "/traceability/genealogy-correction", a: "Wizard", m: "Traceability and Barcode", flows: ["FL-11"] },
  ]),
  // ------------------------------------------------------------ Purchasing
  ...mk("Purchasing", [
    { id: "FX-PUR-AVL", title: "Approved Vendor Lists view", route: "/purchasing/avl", a: "List", m: "Purchasing", flows: ["FL-03"] },
    { id: "FX-PUR-CONTRACT", title: "Contract and scheduling agreement pricing object", route: "/purchasing/contracts", a: "List", m: "Purchasing", extra: ["/purchasing/contracts/:id"], flows: ["FL-03"] },
    { id: "FX-PUR-STP", title: "Supplier Technical Package (STP) view", route: "/purchasing/stp", a: "List", m: "Purchasing", extra: ["/purchasing/stp/:id"], flows: ["FL-10"] },
    { id: "FX-PUR-SUPDEV", title: "Supplier deviation request record", route: "/purchasing/supplier-deviations", a: "List", m: "Purchasing", extra: ["/purchasing/supplier-deviations/:id"], flows: ["FL-03"] },
    { id: "FX-PUR-SUBCON", title: "Subcontract PO variant", route: "/purchasing/subcontract-orders", a: "List", m: "Purchasing", extra: ["/purchasing/subcontract-orders/:id"], flows: ["FL-03", "FL-04"] },
    { id: "FX-PUR-POLINE", title: "PO line short-close and restricted-vendor override dialogs", route: "/purchasing/dialogs/po-line", a: "Dialog", m: "Purchasing", flows: ["FL-03"] },
    { id: "FX-PUR-SCORECARD", title: "Vendor performance and scorecard", route: "/purchasing/vendor-performance", a: "Dashboard", m: "Purchasing", flows: ["FL-03"] },
  ]),
  // ------------------------------------------------------------ Costing and pricing
  ...mk("Costing & Pricing", [
    { id: "FX-CST-DRIVER", title: "Parametric driver-rate tables", route: "/costing/driver-rates", a: "Config", m: "Costing and Pricing", flows: ["FL-02"] },
    { id: "FX-PRC-AGREEMENTS", title: "Customer price agreements", route: "/pricing/agreements", a: "List", m: "Costing and Pricing", extra: ["/pricing/agreements/:id"] },
    { id: "FX-PRC-FLOORS", title: "Margin floors and floor-breach approval", route: "/pricing/margin-floors", a: "Config", m: "Costing and Pricing", flows: ["FL-01", "FL-02"] },
    { id: "FX-CVA-REPORTS", title: "Cost variance report layouts R1 to R4", route: "/inventory/valuation/reports", a: "Dashboard", m: "Costing and Pricing", extra: ["/inventory/valuation/reports/:id"], flows: ["FL-03", "FL-06"] },
  ]),
  // ------------------------------------------------------------ Controlling
  ...mk("Controlling", [
    { id: "FX-CO-HIERARCHY", title: "Hierarchy tree editor", route: "/controlling/hierarchy", a: "Detail", m: "Controlling" },
    { id: "FX-CO-ALT", title: "Alternate CC and PC reporting hierarchies", route: "/controlling/alternate-hierarchies", a: "Detail", m: "Controlling" },
    { id: "CO-SKF-001", title: "Statistical Key Figures", route: "/controlling/statistical-key-figures", a: "List", m: "Controlling", flows: ["FL-06"] },
    { id: "FX-CO-BUDGET", title: "Cost center manager budget self-view", route: "/controlling/my-budget", a: "Dashboard", m: "Controlling" },
  ]),
  // ------------------------------------------------------------ Inventory operations (gap closure)
  ...mk("Inventory Operations (Gap Closure)", [
    { id: "FX-INV-MCOUNT", title: "Mobile count entry (TC77)", route: "/mobile/counts", a: "Kiosk", m: INVOPS, flows: ["FL-06"], post: "SP-20; count variance adjustment on settle", note: "Blind entry, autosave, recount by a different counter" },
    { id: "FX-INV-COUNTSHEETS", title: "Count plan: Generate Count Sheets", route: "/inventory-ops/count-sheets", a: "Wizard", m: INVOPS, flows: ["FL-06"] },
    { id: "FX-INV-WTASKS", title: "Warehouse task mobile work queue", route: "/mobile/warehouse-tasks", a: "Kiosk", m: INVOPS, flows: ["FL-03", "FL-09"], post: "SP-21 on scrap-bin confirmation", note: "Receiving, putaway, replenishment, pick, stage, pack, load, transfer; Queued, Assigned, In Progress, Done or Exception" },
    { id: "FX-INV-WBOARD", title: "Warehouse task supervisor board", route: "/inventory-ops/task-board", a: "Workbench", m: INVOPS },
    { id: "FX-INV-GRN", title: "Goods receipt with supplier technical package delta", route: "/inventory-ops/goods-receipts", a: "List", m: INVOPS, extra: ["/inventory-ops/goods-receipts/:id"], flows: ["FL-10", "FL-03"], post: "#17 on receipt; E-DTS-04 block", note: "STP chip, E-DTS-04 block, certificate-vs-STP checklist (FL-10)" },
    { id: "FX-INV-PCLOSE", title: "Period-close checklist additions", route: "/inventory-ops/period-close", a: "Detail", m: INVOPS, flows: ["FL-06"], note: "Steps 5b, 6b-6e, 9b; inventory tie-out by valuation class" },
    { id: "FX-INV-ICREC", title: "Intercompany pairing indicators and recon report", route: "/inventory-ops/intercompany-recon", a: "Dashboard", m: INVOPS, flows: ["FL-07"] },
  ]),
  // ------------------------------------------------------------ Target-state modules (Book IX)
  ...mk("Target-state modules (Book IX)", [
    { id: "EDI-PART-001", title: "EDI partner profiles", route: "/target/edi/partners", a: "List", m: "Full EDI", extra: ["/target/edi/partners/:id"] },
    { id: "EDI-MON-001", title: "EDI envelope monitor and reprocessing", route: "/target/edi/monitor", a: "Workbench", m: "Full EDI" },
    { id: "ML-COCKPIT-001", title: "Material Ledger cockpit", route: "/target/material-ledger/cockpit", a: "Workbench", m: "Periodic Actual Costing and Material Ledger", flows: ["FL-06"] },
    { id: "ML-MAT-001", title: "Material Ledger by material", route: "/target/material-ledger/materials", a: "List", m: "Periodic Actual Costing and Material Ledger", extra: ["/target/material-ledger/materials/:id"] },
    { id: "ML-CONFIG-001", title: "Material Ledger configuration", route: "/target/material-ledger/config", a: "Config", m: "Periodic Actual Costing and Material Ledger" },
    { id: "OPT-RUN-001", title: "Optimizer run", route: "/target/optimizer/runs", a: "Workbench", m: "Advanced Scheduling Optimizer", flows: ["FL-04"] },
    { id: "OPT-PROF-001", title: "Optimizer profiles", route: "/target/optimizer/profiles", a: "Config", m: "Advanced Scheduling Optimizer" },
    { id: "OPT-BENCH-001", title: "Optimizer benchmark", route: "/target/optimizer/benchmark", a: "Dashboard", m: "Advanced Scheduling Optimizer" },
    { id: "GATP-SEQ-001", title: "Global ATP sourcing sequence", route: "/target/gatp/sequence", a: "Config", m: "Global Multi-Plant ATP and CTP" },
    { id: "GATP-SIM-001", title: "Global ATP simulator", route: "/target/gatp/simulator", a: "Workbench", m: "Global Multi-Plant ATP and CTP" },
    { id: "FX-GATP-PROMISE", title: "Promise dialog, extended (network)", route: "/target/gatp/promise-dialog", a: "Dialog", m: "Global Multi-Plant ATP and CTP", flows: ["FL-01", "FL-02"] },
    { id: "FX-GATP-BACKORDER", title: "Backorder workbench, network delta", route: "/target/gatp/backorders", a: "Workbench", m: "Global Multi-Plant ATP and CTP", flows: ["FL-09"] },
    { id: "FX-PTL-SHELL", title: "Portal shell, external sign-in and invitation", route: "/target/portals", a: "Detail", m: "Supplier and Customer Portals", extra: ["/target/portals/sign-in", "/target/portals/invitation"] },
    { id: "FX-PTL-SUP-PO", title: "Supplier PO worklist with acknowledgement", route: "/target/portals/supplier/orders", a: "Workbench", m: "Supplier and Customer Portals", flows: ["FL-03"] },
    { id: "FX-PTL-SUP-DEV", title: "Supplier deviation request (portal)", route: "/target/portals/supplier/deviations", a: "Detail", m: "Supplier and Customer Portals", flows: ["FL-03"] },
    { id: "FX-PTL-SUP-ASN", title: "Supplier ASN creation", route: "/target/portals/supplier/asn", a: "Wizard", m: "Supplier and Customer Portals", flows: ["FL-03"] },
    { id: "FX-PTL-SUP-STATUS", title: "Supplier invoice and payment status, scorecard and SCAR response", route: "/target/portals/supplier/status", a: "Dashboard", m: "Supplier and Customer Portals", flows: ["FL-03", "FL-08"] },
    { id: "FX-PTL-CUS-ORDERS", title: "Customer order status", route: "/target/portals/customer/orders", a: "List", m: "Supplier and Customer Portals", extra: ["/target/portals/customer/orders/:id"], flows: ["FL-01"] },
    { id: "FX-PTL-CUS-DRAWINGS", title: "Customer drawing approvals with markup", route: "/target/portals/customer/drawings", a: "Workbench", m: "Supplier and Customer Portals", flows: ["FL-02"] },
    { id: "FX-PTL-CUS-SHIP", title: "Customer shipment tracking, dossier and e-POD", route: "/target/portals/customer/shipments", a: "List", m: "Supplier and Customer Portals", flows: ["FL-09"] },
    { id: "FX-PTL-CUS-RETURNS", title: "Customer returns request", route: "/target/portals/customer/returns", a: "Wizard", m: "Supplier and Customer Portals", flows: ["FL-05"] },
    { id: "MI-MAP-001", title: "Machine signal mapping", route: "/target/machine/signal-mapping", a: "Config", m: "Machine Integration, OEE and Downtime" },
    { id: "DT-LOG-001", title: "Downtime log", route: "/target/machine/downtime", a: "List", m: "Machine Integration, OEE and Downtime" },
    { id: "OEE-DASH-001", title: "OEE dashboard", route: "/target/machine/oee", a: "Dashboard", m: "Machine Integration, OEE and Downtime" },
    { id: "FX-MI-TERMINAL", title: "Terminal downtime reason coding", route: "/target/machine/terminal-downtime", a: "Kiosk", m: "Machine Integration, OEE and Downtime", flows: ["FL-04"] },
    { id: "FX-MI-DELTAS", title: "Machine-integration deltas to core screens", route: "/target/machine/core-deltas", a: "Detail", m: "Machine Integration, OEE and Downtime" },
    { id: "SVO-001", title: "Service orders", route: "/target/field-service/orders", a: "List", m: "Field Service Management", extra: ["/target/field-service/orders/:id"], flows: ["FL-05"] },
    { id: "DSP-BOARD-001", title: "Field dispatch board", route: "/target/field-service/dispatch", a: "Workbench", m: "Field Service Management" },
    { id: "FX-FSM-MOBILE", title: "Field service mobile execution set", route: "/target/field-service/mobile", a: "Kiosk", m: "Field Service Management" },
    { id: "FX-FSM-VAN", title: "Van stock replenishment", route: "/target/field-service/van-stock", a: "Workbench", m: "Field Service Management" },
    { id: "FX-FSM-CONTRACTS", title: "Service contracts and technician resources", route: "/target/field-service/contracts", a: "List", m: "Field Service Management", extra: ["/target/field-service/technicians"] },
    { id: "EQ-001", title: "Equipment register", route: "/target/maintenance/equipment", a: "List", m: "Plant Maintenance and EAM", extra: ["/target/maintenance/equipment/:id"] },
    { id: "MPLAN-001", title: "Maintenance plans", route: "/target/maintenance/plans", a: "List", m: "Plant Maintenance and EAM" },
    { id: "MO-001", title: "Maintenance orders", route: "/target/maintenance/orders", a: "List", m: "Plant Maintenance and EAM", extra: ["/target/maintenance/orders/:id"] },
    { id: "MAINT-BOARD-001", title: "Maintenance board", route: "/target/maintenance/board", a: "Workbench", m: "Plant Maintenance and EAM" },
    { id: "FX-EAM-DASH", title: "Maintenance dashboard (MTBF, MTTR)", route: "/target/maintenance/dashboard", a: "Dashboard", m: "Plant Maintenance and EAM" },
    { id: "LOC-COUNTRY-001", title: "Country activation cockpit", route: "/target/localization/countries", a: "Workbench", m: "International Localization" },
    { id: "FX-LOC-TAXREGIME", title: "Tax regime configuration extension", route: "/target/localization/tax-regimes", a: "Config", m: "International Localization" },
    { id: "FX-CAR-INTEGRATION", title: "Carrier rating, tendering, tracking and e-POD (IF-21)", route: "/target/carrier/integration", a: "Workbench", m: "Carrier Integration", flows: ["FL-09"], note: "On Delivery Cockpit and Shipments (DEC-04)" },
  ]),
]
