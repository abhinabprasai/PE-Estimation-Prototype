# Feature list - "PE Design Estimation - Oct 2026 - Completed"

> **What this is.** The user's feature list for pe-v2. It was supplied on 2026-10-12 as a Google Sheet,
> read through the user's browser and transcribed here in compact form. Format:
> `Feature [Priority, hours] - scope (PRD refs)`. A "Risk:" note is kept where the sheet gives one.
> The sheet totals 2,970 h base, then 3,564 h with 20% iteration, then 3,920 h with a 10% buffer.
>
> **Where it stands.** Filed read-only as a client input. It complements the PRD: the PRD is the domain
> authority, and this list sets the scope of features to build. Rows marked "Delta vs INV V3.0 / ACC V2.0"
> rest on external specs we do not hold (ASM-EXT-1).
>
> **What we need from you.** Nothing. Every row should end up visible in the prototype.

## Project Setup & Design Foundations
- Spec immersion & DG-1 design kickoff [High, 24] - map 8 archetypes to the 78+ Book VI screens, confirm DEC-01..10, RTM and frame-ID conventions (Book VIII §1; Book IV §1.2, §9.1)
- Figma setup: library, PE tokens & file architecture [High, 12] - PE tokens (brand, 6 status colours, Inter 13-14px, 16px kiosk, 8px grid, dense 32px / comfortable 40px rows) (Book V §10.1, §10.4)
- Screen template & nine mandatory state kit [High, 12] - normal, empty, loading skeleton, validation (inline + summary), authorization error, conflict (diff), offline, degraded, read-only; legal-hold chip with set/release dialog, archived read-only banner, extended archive-query loading (<60s) (Book V §10.3; Book IV §9.2, §9.4; Book III D §6)
- Eight screen archetypes as component sets [High, 24] - List, Detail with views, Workbench (act-from-row), Wizard with simulation, Kiosk, Dashboard, Governed Config, Decision Dialog (Book VIII §2)

## Bespoke Domain Component Library
- Status badge & lifecycle strip [High, 4] - colours for 18 lifecycles + timeline strip variant (Book V §10.2)
- Entity context bar / entity selector, audit trail & attachment panels [High, 9] - immutable Activity tab; attachment panel with checksum note & photo capture (Book V §10.2; Book I §1.2)
- Readiness chips (supply/credit/quality/docs) [High, 4] - chip states + hover evidence popover; on SO, delivery, WO release (Book V §5.1, §10.2)
- Approval strip [High, 6] - chain, current step, SLA clock, act buttons, delegation & parallel (CCB) votes, recall/reject-with-comment (W.1; Book V §10.2)
- Price waterfall panel [High, 6] - condition steps 10-50 (base, discount, commodity surcharge, freight, tax), price-source badge, margin-floor verdict, hover waterfall (Book I A §4.4; Book IV §5)
- Scan input & feedback flash [High, 6] - focus-locked scan field, <400ms success/fail flash, E-code red banner (scanned vs expected + next action), offline queue-depth amber banner, supervisor badge override (Book V §8.4; Book I F §4)
- Tree explorer (BOM / where-used / genealogy) [High, 10] - multi-level, level badges, status dots, forward/backward family-tree mode, node evidence drill, lazy-load; <10s for 5 levels (Book V §9; Book I C §3.1)
- Milestone strip (ETO) [High, 4] - 6 milestone slices with % and evidence status; invoice-request state (Book I B §4.4; Book V §5.2)
- Diff viewer [High, 6] - revision compare, PO revision summary, MCH before/after grid, conflict side-by-side (Book I C §3.3)
- GL preview panel [High, 5] - journal preview with accounts, CC/PC, rule # fired, matrix row lineage (Book I H §3; Book II §3.11)
- Exception worklist card & SLA aging indicators [High, 6] - count, aging colour, owner, one-click action, quick-stat pills; reused on every workbench (Book V §10.2)
- Kiosk control set [High, 8] - 48px+ targets, big start/complete, numeric keypad, hold/andon, badge-login, crew clock-in, high-contrast (Book V §7.6, §8.4)
- Finite schedule / Gantt & capacity load bars [High, 10] - WC buckets per shift, load bars, freeze-horizon shading, maintenance windows, sandbox banner, action-menu move -> validation dialog (Book III E §2-3)
- Board & pipeline cards (Kanban) [Medium, 4] - WIP board, lead pipeline, delivery status pipeline (Book VI §4, §9)
- Comparison grid (RFQ) [High, 7] - vendors as columns, qty bands, landed-cost normalisation, lowest highlight, weighted scoring, bid version selector, deviation list, sealed -> technical -> commercial stage indicator (Book I G §4; Book IV §3.4)
- Test characteristic row & calibration interlock [High, 4] - auto pass/fail, instrument binding, calibration-expired block E-QM-05, run history (Book I A §6.3; E §4, §7; F §3 SP-14)
- Data-viz set [High, 10] - KPI tile + sparkline, Pareto, trend, funnel, waterfall, gauge; drill ≤3 clicks; loading/empty/degraded; as-of chip, 'restated' marker; export-disclosure confirmation (Book VIII Archetype 6; Book IV §7.5)
- Simulation / preview pattern [Medium, 3] - per-row validation, effect summary, 'nothing posts' banner (Book VIII Archetype 4)
- Line tax override dialog & tax-status badges [Medium, 2] - Finance-only override with reason; Override / Pending recalculation / Recalculated badges on quote, SO, PO lines (Book I A §11.1)
- Data completeness bar & function-block chips [Medium, 2] - material completeness %, Purchasing/Sales/Production/Shipping/Posting block chips (Book II §3.1, §4.5)
- Component documentation & usage guidelines [Medium, 6] (Book V §10.2, §10.4)

## Global Shell, Navigation & System States
- App shell & sidebar navigation [High, 8] - 12 top-level modules with children, entity selector, collapse/responsive, breadcrumbs (Book V §3.1; Book I §2.1)
- Global search ('search everywhere') [Medium, 6] - materials (incl. legacy code), documents, customers, vendors, serials/batches; results, no-results, recent (ADR-04)
- Notification center [Medium, 5] - severity, digest, dedupe, deep links; W.2 alert catalog (W.2)
- User profile & preferences [Medium, 5] - delegation with date range (>$250k restriction message), digest prefs, table density (W.1; Book IV §7.7)
- SSO entry, session & step-up MFA states [High, 4] - SSO redirect/landing, session expired, step-up re-auth (payment release, matrix release, period reopen), kiosk inactivity lock (Book III C §2). Risk: IdP assumed Entra ID
- System error & degraded pages [Medium, 5] - 403 (explains missing role), 404, 500, maintenance, dependency-degraded banner (tax engine/broker/IdP/printer), WAN-down read-only (Book V §10.3; Book III D §3)
- Responsive & device breakpoint spec [High, 8] - desktop, tablet, Zebra TC77 4.7in (mobile work queue), Zebra WT6300 wrist (~3.2in, ring scan, no keyboard), 15.6in kiosk 1280×800 (ADR-09; Book V §8.2)

## Home & Role Dashboards
- Executive dashboard [Medium, 12] - bookings/billings/backlog, OTD, margin, WIP, quality, close status; drill ≤3 clicks (Book I §2.1; Book IV §7.5)
- Sales dashboard [Medium, 10] - open order book, at-risk lines, quote funnel, credit holds (Book I B §6)
- Production dashboard [Medium, 10] - order status, late orders, WC load, scrap, WIP aging (Book I D §12)
- Inventory dashboard delta (safety-stock breach tile) [Low, 2] (Book I A §10.4)
- Role -> landing page mapping [Medium, 2] (Book V §10.3)

## Workflow, Approvals & Administration
- WF-INBOX Approvals Inbox [High, 14] - unified queue across 27 workflows, SLA clocks, context cards per document type, inline approve/reject/delegate/recall, delegation banner (Book VI §15; Book V §7.12)
- Mobile approval view & email-action landing pages [High, 6] - signed-link confirm / expired / already-actioned / unauthorized (W.1; Book IV §7.7)
- Approval history, recall & reject dialogs [High, 4] - reject with mandatory comments, recall before first approval, resubmit preserving history (W.1)
- WF-DEF Workflow Definitions [High, 20] - catalog of 27; versioned, effective-dated editor with condition builder, sequential/parallel chain designer, SLA & escalation (Book VI §15; Book IV §7.7; W.4)
- Alert rules configuration [High, 8] - event/scheduled condition, scope, severity, recipients, channels, dedupe window, digest (W.2)
- Notification template manager [Low, 5] - versioned email templates, localisation slots, sensitive-data preview (Book IV §7.7)
- OPS-JOBS Job Console [High, 10] - run history, SLA timers, dependency chains, retry, close-criticality, failure escalation (Book VI §15; Book III D §5)
- OPS-INT Integration Operations Console [Medium, 17] - per-interface throughput/lag/DLQ depth; DLQ inspect / edit-and-replay / bulk replay / discard with reason; correlation search, saga step view; reconciliation-control panel; Controller approval on financial discard; replay audit diff (Book III B §4)
- Access recertification & SoD exception request [Medium, 8] - quarterly attestation, auto-revoke; SoD exception with CFO approval & expiry (Book III C §3; W.4)
- KPI dictionary register [Medium, 4] - formula, grain, owner, target, lineage, freshness class (Book IV §7.5)
- Workflow analytics dashboard [Low, 6] - SLA attainment, aging by step, bottleneck approvers, rejection/delegation/override rates (Book IV §7.7)

## Configuration (Core Config Set)
- Number series delta [High, 2] - ~25 new entity-aware series (Book I §2.2; Book II §2.7) - Delta vs INV/ACC
- INV-CONFIG-PERIOD Fiscal Period Control [High, 14] - period grid per entity (Open/Closing/Closed), pre-close validation list with owners & Resolve, behaviour matrix, soft/hard close, dual-control reopen with step-up MFA, E-PER messages; period-status banner for every posting screen (E-PER-02 warn / E-PER-01/04 block), Reference Date field, 'Reopened Posting' tag + reopen-window postings list (Book I A §9; Book VII §3)
- INV-CONFIG-TAX Tax Configuration [High, 10] - engine mode, default codes, triggers, rounding, nexus register + economic threshold monitor, manual dated rate table (Book I A §11; Book VII §3)
- Customer / vendor tax profile tab [Medium, 4] - registrations, default code, exemption certificate, use-tax accrual, tax address role (Book I A §11.3)
- RMA policy configuration [High, 4] - approval matrix, restocking defaults, SLA, reopen window (Book I A §3.10)
- Sales / Production / Engineering / Quality settings [High, 12] - four settings pages incl. Quality no-plan policy per plan type, credit rules, pack-order creation rule (CFG-CORE; Book I A §6.5)
- Material settings [Medium, 8] - 3-level material group hierarchy (effective-dated), characteristic classes, serial profiles SN-FIN/COMP/SEMI/NONE, type behaviour matrix (Book II §2.2, §2.4, §15.2)
- MP-PLANT-001 Plant Master [Medium, 8] - list + detail, planning parameters, setup checklist steps 1-9, activate/deactivate (Book VII §4). Multi-plant activates on DEC-07
- MP-LANE-001 Transfer Lanes [Low, 4] - from/to plant, transit days, mode, calendar, cost/unit weight (Book VII §4)
- Intercompany relationships & transfer pricing [Medium, 6] - IC pairs, transfer price list / cost-plus markup, rationale attachment, effective dating (Book III F §3-4)
- Scheduling constraint masters [Medium, 13] - operator qualifications, tools, setup families, crew roster + planned-maintenance calendar view (Book III E §2-3)
- Reason-code & lookup catalogs [Low, 3] - scrap, hold, RMA, loss, count, block reasons (A-12)
- Denied-party interim onboarding checklist (customer & vendor) [Medium, 3] (Book III C §5)
- Denied-party screening review queue [Medium, 5] (Book III C §5)
- GL account mapping delta [High, 2] - 22 new accounts on GL account mapping (Book I §2.4; Book II §2.6)

## Barcode, Labels & Devices
- BC-ADMIN Label & Scan Administration [Medium, 14] - printer registry per station (with failover), label template versions & publish, 21 scan-point policy toggles, reprint audit log, failed-print queue (retry/redirect), scan telemetry log (Book VI §14; Book I F §2, §4; IF-19)
- Scan exception queue (offline replay conflicts) [High, 6] - conflict card (queued vs current, original timestamp), accept/reject/re-post, supervisor attribution; never silently dropped (Book I F §2; Book V §8.4)
- Reprint governance dialog [Medium, 3] - reason code, Quality approval for serial/nameplate, DUPLICATE watermark (Book I F §4)
- Identify & Relabel mobile flow [Low, 4] - TC77: resolve against expected bin stock, print, log exception (Book I F §4)
- Supervisor camera-fallback scanning mode [Low, 2] (Book I F §2)
- Label layouts - print-ready specs (11 classes) [Medium, 18] - HU 4×6 (+GS1/SSCC-18, hazmat, x-of-y), HU contents, batch 4×2, item 2×1, serial 4×2, location 4×1, traveler op strip, RMA return, operator badge, calibration 1×0.5, nameplate data sheet + serial plate (Book V §8.3; Book VII §7; Book I A §5.4; D §1.2)

## Material Management
- MM-MAT-001 Material Listing (delta) [High, 6] - type & lifecycle badges, completeness bars, plant chips, owner filters, stat pills, bulk assign/block/add-to-MCH (Book VI §3; Book II §3.1)
- Material Detail shell & global actions [High, 10] - tab bar, per-role field-group edit, lifecycle + block chips; Activate, Set Block, Supersede, Extend to Plant, Copy From, Simulate GL, Print Label; change-class affordances (Class 2 -> MCH pre-filled, pending-change chip, Class 3 lock -> Supersede, Sellable-override approval) (Book II §3.2, §3.12, §3.14, §4.4)
- View: General [High, 4]; Units & Dimensions [Medium, 3]; Planning (MRP) [High, 6] incl. embedded SS grid; Purchasing [High, 5] incl. embedded info-record & source-list grids; Production [Medium, 4] with EBOM-ahead banner; Warehouse & Storage [Medium, 3] FEFO; Quality [Medium, 3]; Accounting & Costing [High, 5] with GL determination preview (Book II §3.4-3.11)
- INV-ITEM-SALES Sales tab [High, 10] - sales data, price-list grid with breaks & margin, customer price grid, mass update (dated rows), price simulation, approvals (Book I A §4; Book VII §3)
- Reference tabs [Medium, 12] - BOM (read-only + EBOM-ahead), Documents, Stock Overview with special-stock buckets, Info Records/Sources, Where-Used, Change History (Book II §3.13)
- Material dialogs [High, 10] - function-specific block, Extend to Plant, Copy From checklist, duplicate side-by-side compare with 'not a duplicate because' note (Book II §3.14, §4.4-4.5)
- Lifecycle transition & impact-sweep dialogs [High, 3] - Restrict, Reinstate, Mark Obsolete (V-MM-20), Delete Draft, Recall to Draft; where-used impact panel (Book II §4.1, §4.4)
- MM-MCR-001/002 Material Creation Requests [High, 14] - queue with SLA aging; per-department task checklist, reassign, reject-to-task, activate; placeholder origin unblock (Book VI §3; Book II §4.2-4.3)
- MM-MCH-001 Material Change Request [High, 16] - selection, change definition (set/adjust %/find-replace), simulation grid, approval per class, apply now/dated with result log; valuation-change variant (period-boundary check, GR/IR warnings, revaluation delta + GL preview, Controller approval, E-MM-22) (Book VI §3; Book II §16.1, §5.4)
- MCH register & document detail [Medium, 4] - list by status/origin/effective date, cancel scheduled change, ECO link (Book II §4.4, §16.1)
- MM-SUP-001 Supersessions [Medium, 10] - predecessor/successor cards, run-out policy, affected-document worklist, run-out progress (Book II §4.6)
- Duplicate merge steward queue [Medium, 8] - usage counts, survivor selection, reference-rewrite worklist, irreversible-merge confirmation (Book IV §7.1)
- MM-IR-001/002 Purchasing Info Records [Medium, 14] - dated price rows, scales, surcharge link, rolling actuals, manual price approval (Book II §7.2)
- MM-SL-001 Source Lists [Medium, 8] - validity, fixed, blocked, MRP-relevant; overlap validation (Book II §7.4)
- MM-VAL-001 Account Determination Workbench [High, 14] - matrix event key × valuation class, version diff, journal simulation, completeness check E-MM-21, mark/release with step-up MFA (Book II §5.2-5.3)
- MM-EOR-001 E&O Reserve Run wizard [Medium, 8] (Book II §17.3)
- MM-DQ-001 Data Quality Dashboard [Medium, 10] (Book II §16.4)
- Bulk import templates upload flow [Low, 5] - XLSX per view, per-column diff rejection, creates MCR/MCH (Book II §16.2)
- Batch master delta [Medium, 6] - vendor batch/heat, CoO, expiry, certificates, measured characteristics; search with range filters, Expired badge (Book II §15.1)
- Special-stock & ownership deltas [Low, 3] - owner/peg columns, consignment & customer-property tags on GRN/WO, zero-cost customer-supplied badge (Book II §14.1-14.3)
- Consignment settlement run [Low, 8] - monthly per-vendor self-billing preview & post (Book II §14.2)
- Plant sourcing sequence & network MRP fields [Low, 3] - dormant until DEC-07 (Book VII §4.1, §4.4)
- MM reports R1-R8 [Low, 20] (Book II §17)
- Material creation flow prototype [High, 6] - placeholder -> MCR tasks -> activation -> EBOM unblock (Book V §7.4)

## Sales & Order Management
- OM-LEAD-001/002 Leads & Opportunities [High, 24] - pipeline board + register; ETO requirement capture, prior-build search, qualification checklist, activity timeline; convert-to-quote & disqualify (Book VI §4, §4.1)
- Lead import & inbound capture review [Medium, 4] (Book VI §4)
- OM-CUST-001/002 Customer Master [High, 20] - tabs general, addresses (dock constraints), contacts, commercial, credit (read-only for sales), tax, history, documents; activate with address validation; credit hold (Book I B §2)
- OM-QT-001/002 Quotations [High, 16] - price elements, ETO datasheet panel, cost-estimate margin panel, surcharge lines, budgetary watermark, version chain & diff, issue/revise/win-loss; per-line CTP chip; lead-time band (Book I B §3)
- Quote -> order conversion dialog [High, 2] (Book I B §3.3)
- Sales kit BOM explode on quote/SO lines [Medium, 4] (Book VI §6.1)
- OM-SO-001/002 Sales Orders with schedule lines [High, 32] - readiness chips, ETO milestone strip, per-line price waterfall, pegging panel, serial assignment, credit-hold state (Book I B §4; Book IV §2.1)
- Billing plan / milestone editor [High, 4] - must total 100% (Book I B §4.4)
- ETO order cost panel (EAC) [Medium, 5] - estimate vs committed (incl. LLR) vs actual vs EAC vs margin-at-completion (Book IV §7.6)
- ATP partial-availability dialog [High, 12] - accept later date / split / backorder with promised-date write-back (Book I B §4.3)
- Sales change order, cancellation & reprice dialogs [High, 12] - diff with reason, re-credit check; cancellation fee + WO disposition hand-off; reprice diff (Book I B §4.5)
- Credit release & de-peg decision dialogs [High, 6] (Book I B §2.2; Book II §14.4)
- Customer property return & SO closure reconciliation [Low, 2] (Book II §14.3)
- OM-BO-001 Backorder Workbench [Medium, 16] (Book IV §2.2)
- OM-DLV-001 Delivery Cockpit [High, 20] - status pipeline Planned->Closed, readiness flags, split/merge explanations, load-planning panel, carrier assignment, print docs, PGI-when-green (Book IV §2.3-2.4)
- Delivery creation run wizard [High, 5] - horizon & scope -> simulated grouping with split/merge rule IDs (E-DLV-01) -> create -> result log (Book IV §2.3)
- OM-SHP-001/002 Shipments [High, 14] - carrier, equipment, permits checklist, HU list, PSI gate, documents bundle, POD capture (Book I B §5)
- Export documentation checklist on shipment [Low, 2] (Book I A §11.4; B §5.1)
- PGI confirmation & PGI reversal dialogs [High, 5] - gate checks, atomic post; reversal before invoice with reason & same-period guard (Book IV §2.5)
- Load & ship scan flow (TC77, SP-18) [High, 16] - HU load sequence with dock/appointment; scan-confirm; out-of-sequence & wrong-HU (E-BC-08); loaded -> PGI-ready; carrier rejected/reassign (Book IV §2.4, §2.6; Book I F §3)
- OM-POD-001 POD & Claims [Medium, 12] (Book IV §2.4)
- OM-PACK-LIST-001 Packing Queue [High, 5] (Book I A §5.2)
- OM-PACK-STATION-001 Pack Station (kiosk) [High, 24] - HU tree builder (nesting), centre scan, manual gross weight ±2% + supervisor flag, create/close HU, move/split, short-pack, photos, label print, all E-PCK states (Book I A §5.3)
- Pack station live scale readout [Medium, 2] - connected / error / stale (IF-20; DEC-08)
- Sales reports (7) [Low, 18] - open order book, BBB, OTD, margin by order (3-view), quote funnel, late & at-risk lines, lead pipeline (Book I B §6; Book VI §4.1)

## RMA, Warranty & Service
- RMA-LIST-001 [High, 6]; RMA-CREATE-001 [High, 8] incl. No-Reference path and Recall class variant; RMA Detail (7 tabs) [High, 6]; RMA action dialogs [Medium, 6] (approve/reject, cancel, close short, reopen, unauthorized-line decision) (Book I A §3.3-3.9)
- INV-RETURN redirect state [Low, 1] - opens RMA register filtered + banner (Book VII §3)
- RMA-RECEIPT [High, 12] - scan RMA barcode, partial receipt, condition + mandatory photos, unauthorized extra with supervisor override, E-RMA-03/04, ownership flag (Book I A §3.5)
- RMA-DISP [High, 16] - teardown checklist (RC3), entitlement verdict with rule trail, per-line disposition with outcome preview, warranty adjudication, convert-to-billable, NCR/SCAR triggers; Settling states (Book I A §3.6)
- Credit Memo Request panel & Controller credit release [Medium, 3] - E-RMA-07 (Book I A §3.2, §3.6.1, §3.9)
- Billable repair quote & customer approval gate [Medium, 3] (Book I A §3.6.1)
- IB-001 Installed Base [High, 13] - service history, ownership transfer, commissioning capture, warranty extension approval; unknown-site worklist with bulk site assignment (Book IV §7.4)
- SVC-SPF-001 Spares Finder [Medium, 16] (Book VI §5.1)
- Warranty exclusions catalog config [Low, 4] (Book IV §7.4)

## Engineering & BOM
- ENG-HOME-001 Engineering Workspace [Medium, 10]; ENG-REQ-001 Engineering Requests [High, 14] (release level Concept->Released, back-scheduled due date, customer-approval loop); ENG-BOM-001 EBOM List [Medium, 4]
- ENG-BOM-002 EBOM Editor (3-pane) [High, 32] - tree, keyboard-first grid, context panel, inline placeholder create, consume-at-op, validate panel, sales-kit usage (Book I C §3)
- EBOM review & release package [High, 5]; EBOM Copy From & base-design picker [High, 3]; Compare revisions view [High, 3]; Mass replace component dialog [Medium, 3] (auto-creates ECO); Where-Used explorer [Medium, 5] (Book I C §3, §7)
- ENG-ECR-001 Change Requests [High, 16] - impact panel, CCB votes, emergency SLA; ENG-ECO Change Orders [High, 16] - effectivity date/serial/immediate, old-stock & open-WO disposition grids, LLR impacts, atomic release (Book I C §4)
- MBOM-TRF Transform wizard [High, 14]; PV-001 Production Versions [Medium, 8]; Engineering Items view [Low, 3]; Engineering reports (5) [Low, 10]

## CAD & Document Control
- ENG-DOC-001 Document Register [Medium, 6]; ENG-DOC-002 Document Detail [High, 16] (native vs rendition, title-block metadata, check-out/in, release stamp, EAR-restricted, NOT FOR MANUFACTURE watermark); PDF redline review layer [Medium, 8]
- TR-001 Transmittals [High, 12] - response capture Approved / As Noted / Revise & Resubmit loop
- CAD-SYNC Sync Monitor & Conflict Queue [High, 14]; CAD-IMP CAD BOM Import wizard [High, 12]; CAD vs EBOM structure comparison [Medium, 3]; PDM linkage states [Medium, 3] (Book III G)

## MRP & Finite Planning
- PP-MRP-001 MRP Workbench [High, 22] - EX-01..EX-10 cards, proposal grid with pegging drill, run history with snapshot IDs, mass-convert; Run MRP dialog (regenerative vs net-change, progress, summary)
- PLO-001 Planned Orders [Medium, 6]; SCH-BOARD Schedule Board [High, 20] (what-if sandbox, publish-diff, reschedule proposals, freeze-override reason, scheduling modes, snapshot chip); Interactive schedule board & multi-scenario compare [Medium, 10]; WC Load View [Medium, 5]
- CTP-DLG Promise Dialog [High, 8]; AT-RISK At-Risk Promises [Medium, 10]
- INV-PLAN-SAFETY Safety Stock maintenance [High, 10]; Safety-stock exception report & projection delta [Low, 3]; Statistical safety stock activation [Medium, 3]
- STO-001 Stock Transport Orders [Low, 8] (after DEC-07); Promise reliability report [Low, 3]

## Production & Shop Floor
- PP-WC-001/002 Work Centers [Medium, 10]; PP-RTG-001/002 Routings [High, 16]; Capture template builder [Medium, 8]
- PP-WO-001/002 Production Orders [High, 24]; WO decision dialogs [High, 9] (Release Short override, hold, confirmation reversal dual sign-off, SO-cancellation disposition, WO cancel cost decision, close preconditions, settled reopen with JE-reversal preview)
- PP-DSP-001 Dispatch List [High, 12]
- PP-SFT-001 Shop Floor Terminal (kiosk) [High, 50] - ~13 kiosk views: badge login, crew clock-in, dispatch queue, start/complete by scan, component scan states, capture templates, QC gate, good/scrap/rework qty, hold/andon, rework path, oven multi-order batch confirm, WI/drawing viewer, skill interlock, offline queue, child-serial install (SP-12, E-BC-05), nameplate verification (SP-13, E-BC-06), WC-400 accessory checklist, manual hours ±20%
- PP-WIP-001 WIP Board, Valuation & Order Progress [Medium, 12]; Labor export to payroll (IF-22) review [Medium, 3]; RWO-001 Rework Orders [Medium, 10]; PP-SETTLE-001 Settlement Run [Medium, 10]; FG production receipt & subcontract operation views [Medium, 7]; Production reports (6) [Low, 15]

## Quality Management
- QM-DASH-001 [High, 13] incl. no-plan exception panel; QM-PLAN-001 list [Medium, 5]; QM-PLAN-002 Plan editor [High, 16]; Sampling state panel [Medium, 3]
- QM-EXEC Inspection Execution & gate queues [High, 24] incl. conditional-pass dialog + Conditional badge; INV quality screens alignment [Medium, 8]
- QM-FIN-001 Final Test & FTR [High, 20]; Test-set CSV import mapping [Medium, 6] (DEC-08); Transformer routine-test capture forms (9 types) [High, 6]
- QM-CAPA-001 [Medium, 14]; SCAR (8D) list + detail [Medium, 12]; SCAR vendor response form (external) [Medium, 5]
- QM-DEV-001 Deviations & Waivers [Medium, 10]; QM-CAL-001 Calibration Register [Medium, 10]
- RCL-001 Recall Campaigns [High, 23] - population versions, mass hold, dual-approved notifications, recovery tracker, 7-stage lifecycle strip, contact-attempt log, partial-recovery dual sign-off, PII export confirmation, cost tab, CAPA link (FL-08)
- SPC control charts, capability & trend alerts [Medium, 16] (DEC-09); Quality audit management [Medium, 12] (DEC-09)

## Traceability
- TRC-EXPL Trace Explorer [High, 13]; As-built record & certificate dossier [Medium, 6]; Genealogy correction pair flow [Medium, 6]; TRC-DASH [Medium, 10] (Book IV §4.3-4.4)

## Purchasing
- PUR-WB-001 Buyer Workbench [High, 19]; PUR-VEND-001/002 Vendors & AVL [Medium, 18]; Approved Vendor Lists view [Medium, 5]; PUR-PR-001 [Medium, 10]; RFQ list + detail [High, 22] (sealed bids, technical before commercial, award writes info records, regret notice)
- PUR-PO-001/002 Purchase Orders [High-scope, Medium, 26] - quality clauses, Buy America, delivery schedules, STP chip, LLR flag, approval ladder, revisions; price-source badge, stale-basis flag, E-MM-32, E-MM-35
- Contract / scheduling agreement pricing object [Medium, 6]; Supplier Technical Package (STP) view [Medium, 6]; Supplier deviation request record [Medium, 5]; Subcontract PO variant [Medium, 5]; PO line short-close & restricted-vendor override dialogs [Medium, 3]
- LLR-001 Long-Lead Releases [Medium, 10]; PUR-EXP-001 Expedite Board [Medium, 12]; Vendor Performance & scorecard [Low, 8]

## Costing & Pricing
- CST-RATE-001 [Medium, 10]; CST-CE-001 Cost Estimates [Medium, 16]; Parametric driver-rate tables [Medium, 5]; CST-RUN-001 [Medium, 14]
- PRC-PL-001 Price Lists [Medium, 12]; Customer Price Agreements [Medium, 10]; PRC-SUR-001 [Medium, 8]; Margin floors & floor-breach approval [Medium, 5]; PRC-SIM [High, 8]
- INV-CVA-001 Cost Variance Workbench [Medium, 18]; CVA report layouts R1-R4 [Low, 8]; PRC-MARG Margin Analysis report set [Medium, 12]

## Controlling
- CO-CC-001/002 Cost Centers [High, 8]; CO-PC-001/002 Profit Centers [High, 6]; Hierarchy tree editor [High, 10]; Alternate CC/PC reporting hierarchies [Medium, 4]; CO-SKF-001 Statistical Key Figures [Low, 5]; CO-ALC-001 cycle definitions [Medium, 10]; CO-ALC-002 run wizard [Medium, 8]; CO-R1..R4 [Low, 11]; Cost center manager budget self-view [Low, 4]

## Inventory Operations (Gap Closure)
- INV-COUNT-DOC-001 list [High, 5]; INV-COUNT-DOC-002 detail [High, 16]; Mobile count entry (TC77) [High, 10] - blind entry, SP-20, autosave, recount by different counter; Count plan 'Generate Count Sheets' delta [Medium, 3]
- Warehouse task mobile work queue [Medium, 13] - receiving/putaway/replenishment/pick/stage/pack/load/transfer tasks Queued->Assigned->In Progress->Done/Exception; scrap-bin confirmation SP-21 (Book IV §7.2; Book VIII §5.3)
- Warehouse task supervisor board [Medium, 6]
- GRN delta for supplier technical package (FL-10) [High, 3] - STP chip, E-DTS-04 block, certificate-vs-STP checklist
- Period-close checklist additions [Low, 5] - steps 5b, 6b-6e, 9b; inventory tie-out by valuation class (Book I Part J; Book II §13)
- Intercompany pairing indicators & recon report [Low, 6] (FL-07)

## Target-state modules (Book IX; activation governed by the decision register)
- Full EDI: EDI-PART-001 Partner profiles [Medium, 6]; EDI-MON-001 Envelope monitor & reprocessing [Medium, 10] (Book IX §5.2)
- Periodic Actual Costing & Material Ledger: ML-COCKPIT-001 [Low, 12]; ML-MAT-001 [Low, 10]; ML-CONFIG-001 [Low, 6] (Book IX §1.3)
- Advanced Scheduling Optimizer: OPT-RUN-001 [Low, 14]; OPT-PROF-001 [Low, 5]; OPT-BENCH-001 [Low, 8] (Book IX §2.2)
- Global Multi-Plant ATP/CTP: GATP-SEQ-001 [Low, 6]; GATP-SIM-001 [Low, 12]; Promise dialog extended [Low, 3]; Backorder workbench network delta [Low, 3] (Book IX §3)
- Supplier & Customer Portals: portal shell + external sign-in & invitation [Low, 10]; Supplier PO worklist with acknowledgement [Low, 12]; Supplier deviation request [Low, 6]; Supplier ASN creation [Low, 10]; Supplier invoice/payment status, scorecard & SCAR response [Low, 12]; Customer order status [Low, 8]; Customer drawing approvals with markup [Low, 12]; Customer shipment tracking, dossier & e-POD [Low, 8]; Customer returns request [Low, 6] (Book IX §4)
- Machine Integration, OEE & Downtime: MI-MAP-001 Signal mapping [Low, 8]; DT-LOG-001 Downtime log [Low, 8]; OEE-DASH-001 [Low, 10]; terminal downtime reason coding delta [Low, 3]; machine-integration deltas to core screens [Low, 4] (Book IX §6)
- Field Service Management: SVO-001 Service orders [Low, 14]; DSP-BOARD-001 Dispatch board [Low, 14]; Mobile execution set [Low, 20]; Van stock replenishment [Low, 6]; Service contracts & technician resources [Low, 14] (Book IX §7)
- Plant Maintenance & EAM: EQ-001 Equipment register [Low, 12]; MPLAN-001 [Low, 8]; MO-001 [Low, 12]; MAINT-BOARD-001 [Low, 10]; Maintenance dashboard MTBF/MTTR [Low, 6] (Book IX §8)
- International Localization: LOC-COUNTRY-001 Country activation cockpit [Low, 8]; Tax regime configuration extension [Low, 4] (Book IX §9)
- Carrier Integration: carrier rating, tendering, tracking & e-POD (IF-21) on Delivery Cockpit & Shipments [Low, 6] (DEC-04)

## Print Outputs, Documents & Notifications
- Quote PDF (commercial + ETO datasheet + T&C) [High, 6]; Order & change confirmation PDFs [Medium, 4]; Packing list + transformer shipping addendum [High, 5]; Return instructions PDF & warranty denial letter [Medium, 5]; Traveler / shop packet [High, 6]; Final Test Report (FTR) [High, 6]; PO PDF, RFQ invite & regret notice [Medium, 5]; Cutover fallback paper forms [Medium, 4]; BOL, CoC, certificate dossier cover & transmittal sheet [Medium, 7]; RFQ vendor response form [Medium, 3]; Count document print (blind / expected) [Low, 2]; Inspection plan PDF [Low, 2]; Invoice supplement - packing data [Low, 1]; As-built spares parts list PDF [Low, 2]; Email notification templates [Medium, 8]

## Flow Prototypes, Validation & Handoff
- Prototype A Sales order to delivery (FL-01/09) [High, 10]; B Engineering to procurement (FL-10) [High, 10]; C Plan to produce incl. kiosk (FL-04) [High, 10]; D Procure to pay (FL-03) [Medium, 8]; E End-to-end traceability (FL-11) [Medium, 8]; F RMA & warranty (FL-05) [Medium, 8]; G ETO quote to cash (FL-02) [High, 8] (lead with prior-build search -> quote datasheet -> SO milestone strip -> engineering request -> transmittal approval loop -> milestone invoice request); Portal & field-service flow prototypes [Low, 16]
- Kiosk & scanner usability validation [High, 16]; Accessibility pass [Medium, 12]; Internal design QA [High, 55]; Design QA extended modules [Low, 16]; Screen spec cards (Book IV §9.4) [High, 45]; DG-2 developer handoff per module [High, 40]

## Sheet notes (summary)
- Scope: every screen, component, print output and flow across Books I-IX, including the extended capabilities. Their activation timing is governed by the PRD decision register.
- Every screen includes the nine mandatory states (Book V §10.3), plus responsive behaviour on mobile, wrist and kiosk.
- Excluded: Accounting-spec finance screens (AR/AP/GL, invoice queues, revenue contracts); customer-contract-only quality tools (control plans/FMEA/APQP/PPAP); in-app migration tooling; EWM-class warehousing.
- Open decisions: IdP (Entra ID assumed), CAD/PDM toolchain (SolidWorks PDM baseline), Avalara mode, letterhead, label printer DPI, wrist-terminal support, KPI dictionary.
