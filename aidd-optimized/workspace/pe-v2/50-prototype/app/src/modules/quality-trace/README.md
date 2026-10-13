# Module group: quality-trace

> **What this is.** The owner's guide for `src/modules/quality-trace/`. Quality and traceability: the PRD's Quality (8) and Traceability and Barcode (3) modules.
>
> **Where it stands.** Module pass, 12 October 2026, plus the feature-list pass (same day). All eleven PRD screens and all thirteen feature-list screens (FX-) are built and claimed "full" in `routes.tsx`; the four PARTIAL rows (QM-EXEC, QM-DASH-001, RCL-001, BC-ADMIN) are completed. The hero thread SO-2026-00301 is walkable from incoming inspection to recall. Type-check is clean for this folder.
>
> **What we need from you.** Build the screens below inside this folder only. Anything you need outside it goes under "Requests to foundation" at the end.

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates` in the running app.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Built |
|---|---|---|---|---|---|---|
| QM-DASH-001 | Quality Dashboard | `/quality/dashboard` | Dashboard | W5 | - | full |
| QM-PLAN-001/2 | Inspection Plans | `/quality/inspection-plans, /quality/inspection-plans/:id` | List | W2 (W2 config, W5 full) | FL-03, FL-02 | full |
| QM-EXEC | Inspection Execution | `/quality/inspections, /quality/inspections/:id (design value)` | Detail | W5 | FL-03, FL-10, FL-11 | full |
| QM-FIN-001 | Final Test and FTR | `/quality/final-test, /quality/final-test/:id` | Detail | W5 | FL-04, FL-02 | full |
| QM-CAPA/SCAR | CAPA and SCAR | `/quality/capa, /quality/capa/:id, /quality/scar, /quality/scar/:id` | List | W5 | FL-05, FL-08 | full |
| QM-DEV-001 | Deviations and Waivers | `/quality/deviations, /quality/deviations/:id` | List | W5 | FL-04 | full |
| QM-CAL-001 | Calibration Register | `/quality/calibration` | List | W5 | FL-04 | full |
| RCL-001 | Recall Campaigns | `/quality/recalls, /quality/recalls/:id` | Workbench | W5 | FL-08 | full |
| TRC-EXPL | Trace Explorer | `/traceability/explorer` | Workbench (design value) | W4 | FL-08, FL-11 | full |
| TRC-DASH | Traceability Completeness Dashboard | `/traceability/completeness` | Dashboard | W7 | FL-11 | full |
| BC-ADMIN | Label and Scan Administration | `/configuration/barcode` | Config | W4 | FL-11 | full |

Source: reference tables A [DOC:pp.245-282] (asserted); routes and archetypes marked "design value" are not in the specification.

## State

Slice key `qualityTrace`. `qualityTrace` (QualityTraceState): inspection plans, CAPA, SCAR, instruments, recalls, deviations, genealogy events, batches, serials, NCR link records.

## Spine documents to seed

Seed these in `data/slice.ts` with exactly these IDs and statuses (headers in `src/data/shared/spine.ts`):

| ID | Type | Status | Title |
|---|---|---|---|
| IL-TBD-0301 | inspectionLot | - | Incoming inspection, HV bushings |
| BAT-TBD-B0301 | batch | Blocked | Batch of 9 HV bushings, vendor batch HP-26-0412 |
| SN-TBD-20M-0301 | serial | Shipped | Transformer serial SN-TBD-20M-0301 |
| IL-TBD-0302 | inspectionLot | - | Final test and FTR, SN-TBD-20M-0301 |
| NCR-TBD-0044 | ncr | - | NCR: flange seal leak, HV bushing (INV 15.4) |
| SCAR-TBD-0009 | scar | - | SCAR to Hanseong Porcelain & Polymer |
| CAPA-TBD-0015 | capa | Analysis | CAPA: bushing flange seal escape |
| RCL-2026-001 | recall | Contain | Recall: HV bushing flange seal, batch BAT-TBD-B0301 |

## Cross-module events

- Emits: `quality.inspectionClosed`, `quality.recallStageChanged`, `trace.eventRecorded`, `materials.stockStatusChanged`, and the module-only `quality.ftrIssued`, `quality.ncrCreated`, `quality.vendorScarRestriction`, `quality.recallRmaRequested`, `quality.massHoldApplied`, `quality.deviationBlocked`, `quality.reworkRequested`, `quality.ecrRequested`, `quality.inspectionOpened`.
- Consumes: every `trace.eventRecorded` (a T10 for a delivery opens the OQC inspection), `sales.pgiPosted` (T11), `sales.rmaReceived` (T12 and the RQC inspection), `purchasing.grnPosted` (T02 and the IQC inspection), `production.confirmationPosted` (T07), `production.fgReceived` (T09), `production.orderReleased` (serial record), `production.inspectionRequested` (IPQC lot, or the final test record for the Final Test op), `production.reworkOrderCreated` (links the RWO back by NCR), `approval.decided` (recall notification, dual approval C-52). Events recorded from other modules are stamped with the scenario date.

Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder (see APP-ARCHITECTURE.md).

## Notes

- C-53: genealogy is append-only and hash-chained; corrections are reversal + replacement events.
- The hero recall RCL-2026-001 is at Contain; batch BAT-TBD-B0301 is Blocked and reserved for SO-2026-00377.

## What is built

| Screen | File | Template | Primary actions (all change state through the `qualityTrace` slice) |
|---|---|---|---|
| QM-DASH-001 | pages/Dashboard.tsx | DashboardPage | Drill to each queue: open inspections by gate, FPY by gate and by work center, NCR funnel by stage and severity with overdue CAPA count, vendor quality (updated by IQC decisions), cost of quality, hold inventory with value by warehouse and age, no-plan exception panel (Auto-Accept with Warning), calibration due, hero thread |
| QM-PLAN-001/2 | pages/Plans.tsx | ListPage + DetailPage | Author plan (AQL level S1-S4 / G1-G3 and value 0.65-4.0; scope limited by type), add / remove characteristics on Draft, submit, approve to Active (V-QM-01 overlap check; supersedes), reject, new revision, copy, delete a Draft, Export PDF (print), set Obsolete (E-QM-01 guard), revision compare, where used, Sampling tab (sample size from lot size + level, AQL switching state with Quality Manager approval of Reduced, skip-lot qualification) |
| QM-EXEC | pages/Inspections.tsx | ListPage (gate queues) + DetailPage | Inspections open from the gate triggers (GRN line, routing checkpoint, packed shipment, RMA receipt; no plan means Auto-Accept with Warning or a Manual Inspection with ad-hoc rows), SP-05 sample pull (badge and batch together), SP-14 instrument binding (E-QM-05), record results with pass / fail colouring, certificate, accept / reject with disposition, stock status move per gate, NCR, link deviation |
| QM-FIN-001 | pages/FinalTest.tsx | ListPage + DetailPage | Start run, SP-14 binding, partial save across sessions, complete run (Pass: FTR + `quality.ftrIssued` milestone; Fail: NCR mandatory), disposition Rework (asks Production planning for the RWO) / Engineering Review (ECR link or request) / Scrap (Controller and Engineering Manager approvals before Fail), retest scope, countersign, printable FTR; units arrive from orders at Testing, queue sorted by promised date; routine-test template now carries the PRD values (IR HV-LV / HV-G / LV-G / PI, no-load loss at 100% and 110% V, excitation %I, load loss W and %Z, BDV and moisture) |
| QM-CAPA/SCAR | pages/Capa.tsx | ListPage + DetailPage (CAPA, NCR links, SCAR) | CAPA lifecycle S-25 with root cause, actions with evidence, 30-day effectiveness gate, reopen, multi-link sources (add further NCRs, RMAs, SCARs); NCR sheet (open CAPA, raise SCAR, stage); SCAR from an NCR or from an RMA failure, 8D response, close with cost recovery, escalate, AVL enforcement (`quality.vendorScarRestriction`) |
| QM-DEV-001 | pages/Deviations.tsx | ListPage + DetailPage | Request (Use-As-Is waiver / Temporary Process Deviation / Customer-Approved Concession), approval by the Quality Manager and the Engineering Manager plus the Controller above the value threshold, reject, customer evidence (mandatory when the customer flag or contract requires), record use, auto expiry; approval writes genealogy evidence rows and the Trace Explorer discloses active deviations |
| QM-CAL-001 | pages/Calibration.tsx | ListPage + side sheet | Record calibration (pass / fail), out-of-service toggle, certificates, measurements at risk |
| RCL-001 | pages/Recalls.tsx | WorkbenchPage + DetailPage | Open campaign, derive population (versioned), mass hold, notification text + ApprovalButton (dual, WF-INBOX), export list, request recall RMAs, dispositions, partial sign-off, advance to Closed |
| TRC-EXPL | pages/TraceExplorer.tsx | WorkbenchPage (tree table) | Trace backward / forward (5 levels), evidence drill with hash chain, correction pair, export dossier, feed a recall |
| TRC-DASH | pages/TraceDashboard.tsx | DashboardPage | Run control job (no hard-coded exclusions), assign owners, resolve (an orphan event is closed by recording the missing T02 as a late capture), correction pair hand-off |
| BC-ADMIN | pages/BarcodeAdmin.tsx | ConfigPage | Register / toggle printers, template drafts and publish, scan point policy toggles, reprint with reason, resolve scan exceptions |

Every list and detail has the loading skeleton (first visit), the empty state (`?sim=empty`) and the error state with retry (`?sim=error`), a design convenience for review.

Cross-module hand-offs:

- Emits `quality.inspectionClosed` (materials moves QI Hold), `materials.stockStatusChanged` (IQC / RQC decisions, mass hold), `quality.recallStageChanged` (sales drafts recall RMAs at Recover), `trace.eventRecorded` (T03, T08, T12, T13 and correction pairs), plus module-only `quality.ftrIssued`, `quality.ncrCreated`, `quality.vendorScarRestriction`, `quality.recallRmaRequested`, `quality.massHoldApplied`, `quality.deviationBlocked`.
- Consumes `approval.decided` (Recall external notification moves Contain → Notify), `quality.recallStageChanged` (links the RMA Sales drafted back onto the population), `purchasing.grnPosted` (T02), `production.confirmationPosted` (T07), `production.fgReceived` (T09), `production.orderReleased` (serial record), `sales.pgiPosted` (T11, serial Shipped), `sales.rmaReceived` (T12), every `trace.eventRecorded`.

Hero thread: dashboard card → IL-TBD-0301 (IQC, accepted) → BAT-TBD-B0301 → IL-TBD-0302 (FTR-2026-0188) → SN-TBD-20M-0301 (trace tree) → IL-TBD-0304 (RQC) → NCR-TBD-0044 → SCAR-TBD-0009 / CAPA-TBD-0015 → RCL-2026-001 (Contain; approve the seeded APR request in WF-INBOX to reach Notify).

### Feature-list build (12 October 2026)

| Row | Where | What it does |
|---|---|---|
| FX-BC-EXCEPTIONS | pages/ScanExceptions.tsx | Workbench of offline replay conflicts: card shows the queued scan against the current state; supervisor accepts (original timestamp), re-posts or rejects with a reason; decision is attributed and logged to telemetry; resolved exceptions keep their history. |
| FX-BC-REPRINT | pages/ReprintGovernance.tsx | Reprint dialog (reason code, Quality approval for serial and nameplate labels, DUPLICATE watermark preview except location labels), approval queue for the Quality Manager, reprint log. The same dialog opens from BC-ADMIN. |
| FX-BC-RELABEL | pages/Relabel.tsx | Handheld flow (KioskPage with a 360 px TC77 task area): scan the bin, match found stock to the expected lines, print, or log a count exception. Supervisors only. |
| FX-BC-CAMERA | pages/CameraScan.tsx | Handheld camera-fallback scan (supervisors only, slower, logged as Camera in telemetry; a rejected scan is logged too). |
| FX-QM-SAMPLING | pages/Sampling.tsx | Per-plan sampling state (Normal, Tightened, Reduced), switching evidence, Reduced approval, vendor skip-lot qualification, sample size by lot size. |
| FX-QM-INVALIGN | pages/StockStatus.tsx | Stock status workbench (QI Hold, Blocked, Quarantine, Unrestricted), quality block and release with reasons, per-gate pass and fail moves, move ledger. |
| FX-QM-TESTIMPORT | pages/TestImport.tsx | Four-step wizard: unit and template, CSV file, column mapping, review. All or nothing with every row error listed and downloadable; instrument checked per row (E-QM-05). |
| FX-QM-ROUTINE | pages/RoutineTests.tsx | Nine routine-test forms with live pass and fail against the unit's design values; save writes into the open run through the same action as manual entry. |
| FX-QM-SCARRESP | pages/ScarResponse.tsx | External vendor form: D1 to D3 read-only, D4 to D8 to fill, attachments, submit, overdue and closed states. |
| FX-QM-SPC | pages/Spc.tsx, data/spc.ts | Individuals charts with locked limits, spec limits, moving range, Cp and Cpk band, trend alerts to acknowledge. |
| FX-QM-AUDIT | pages/Audits.tsx | Audit list and detail: schedule, start, checklist, findings, report, CAPA from a finding, close finding, close or cancel audit. |
| FX-TRC-ASBUILT | pages/AsBuilt.tsx | Dossier list and detail: assemble per serial (needs a countersigned FTR), contents, as-built BOM, revisions, transmit with a transmittal number. |
| FX-TRC-CORRECTION | pages/GenealogyCorrection.tsx | Three-step wizard (find the event, define the replacement, review the reversal and replacement pair); resolves unresolved corrections. |
| QM-EXEC (completed) | pages/Inspections.tsx | Conditional-pass option in the Accept dialog (restriction note, scope, expiry; Quality Manager only) and the Conditional badge in the queue and on the record. |
| QM-DASH-001 (completed) | pages/Dashboard.tsx | Pareto card (count or cost) with cumulative line, vital-few marking and drill to the NCR list. |
| RCL-001 (completed) | pages/RecallContacts.tsx, pages/Recalls.tsx | Contact log per customer (channel, person, outcome, note), not-reached flags, and the export now needs a purpose and an acknowledgement and writes a PII disclosure entry, shown in a log. |
| BC-ADMIN (completed) | pages/BarcodeQueues.tsx, pages/BarcodeAdmin.tsx | Failed-print queue (retry, redirect to a printer that carries the label type, cancel with a reason, fix the device), scan telemetry log with result filter, printer health, governed reprint section. |

Every new screen uses the nine-state frame (`components/states.tsx`): normal, empty, loading, validation, authorization, conflict, offline, degraded and read-only, with a "Review state" switch at the top (reading QT-R41).

## Readings

Choices made where the specification is silent; each shows on screen as a reading chip (`data/readings.ts`) and is to be numbered into `10-discovery/open-questions.md` by the integration pass.

| ID | Reading |
|---|---|
| QT-R01 | Inspection record has no status list; open until Accepted / Rejected; the subject's stock or serial status carries the badge. |
| QT-R02 | NCR stage words Open / Dispositioned / Closed and severities Critical / Major / Minor (NCR owned by INV 15.4). |
| QT-R03 | SLA for age colouring: IQC 3 days, IPQC and OQC 1 day (calendar days); RQC 5 business days (Mon-Fri). |
| QT-R04 | Vendor quality flag below 95% rolling 90-day lot acceptance. |
| QT-R05 | Instrument Due Soon within 30 days of due date. |
| QT-R06 | Recall stage triggers: mass hold (Identify → Contain), notification approval (Contain → Notify), RMA request (Notify → Recover). |
| QT-R07 | Recall-class RMAs requested one per customer. |
| QT-R08 | Deviation approvals recorded on QM-DEV-001 (no WF-INBOX kind). |
| QT-R09 | Plan approval recorded on QM-PLAN by the Quality Manager (no WF-INBOX kind). |
| QT-R10 | FTR issued at run completion; QM countersigns afterwards. |
| QT-R11 | Partial recovery sign-off recorded on RCL-001 (no WF-INBOX kind). |
| QT-R12 | Trace tree levels (5). |
| QT-R13 | Coverage % formula. |
| QT-R14 | Genealogy hash is a non-cryptographic stand-in. |
| QT-R15 | SCAR overdue = open, no response, due date passed. |
| QT-R16 | Reopened CAPA resumes at Actions In Progress. |
| QT-R17 | Recall population location words. |
| QT-R18 | Final-test Scrap: the Controller and the Engineering Manager (two people) approve on the screen before the result is Fail (no WF-INBOX kind). |
| QT-R19 | Dashboard FPY / CoQ / vendor figures are seeded summaries. |
| QT-R20 | SCAR state words shown as text. |
| QT-R21 | Final test queue stage words. |
| QT-R22 | Coverage attention below 99.5%. |
| QT-R23 | Recall RMA numbers come from Sales; linked back by serial. |
| QT-R24 | Numeric bands the specification does not give: winding resistance ±2% (it says design sheet ± tolerances); +10% on excitation current, no-load loss at 110% V and load loss; plan minimums for IR, PI, BDV, moisture. |
| QT-R25 | Sample-size table (level G2 base, G1 / G3 scaled, S1-S4 small samples; Tightened x1.5, Reduced x0.6) and the return from Tightened to Normal after 5 accepted lots. The specification gives the switching and skip-lot rules but no table. |
| QT-R26 | No-plan policy: Auto-Accept with Warning for non-QI-required items; for QI-required items the default Block cannot hold a GRN already posted, so a Manual Inspection with an E-QM-01 alert opens. |
| QT-R27 | Controller joins the deviation approval above 10,000 USD value impact; deviation evidence rows use T03 (batch) and T08 (serial). |
| QT-R28 | Conditional pass: the specification names a conditional pass with a restriction note at the shop-floor QC gate and lists conditional releases among Quality Manager actions, with no status list, expiry or scope rule. The prototype records Accepted with a restriction note, a scope and an optional expiry date; only the Quality Manager can do it; stock moves as for an acceptance. |
| QT-R29 | SPC (DEC-09, Phase 2) gives no rule set. The prototype draws an individuals chart with limits locked on the first 20 points (moving-range sigma), signals on four rules (one point beyond 3 sigma; seven in a row on one side; six rising or falling; two of three beyond 2 sigma), and bands Cpk 1.33 or more Capable, 1.00 to 1.33 Marginal, below 1.00 Not capable. |
| QT-R30 | Reprint reason codes (Damaged or unreadable, Lost, Data corrected, Printer fault, Template version change, Recall hold tag) are design values: the specification requires a reason code and gives no list. |
| QT-R31 | Quality approval of a serial or nameplate reprint is recorded on this screen by the Quality Manager; WF-INBOX has no approval kind for it yet (request R-11). |
| QT-R32 | Scan conflict decisions: Accept replays the scan with its original timestamp, Re-post posts it now, Reject discards it. The specification says conflicts go to supervisor resolution and are never silently dropped; the three decisions and the mandatory reason are design choices. |
| QT-R33 | Audit management (DEC-09, Phase 2) has no status list or type list. The prototype uses the types Internal process, Supplier, Customer and Certification, the state words Planned, In progress, Report issued, Closed and Cancelled shown as text, and closes a Major finding only after its CAPA is Closed. |
| QT-R34 | Stock status moves outside an inspection: a quality block (Unrestricted to Blocked or Quarantine) by the Quality engineer or Quality Manager; release by the Quality Manager only; QI Hold clears only by an inspection decision; a batch held by an open recall is released from the campaign. The specification lists the four statuses and the moves per gate, not manual moves. |
| QT-R35 | Failed-print queue: the specification names a printer registry per station with failover and a failed-print queue (retry, redirect). Device health words (Online, Offline, Paper out, Ribbon out, Head open) and the rule that a redirect needs an online printer that carries the label type are design values. |
| QT-R36 | Identify and Relabel matches found stock to the expected stock lines of the bin; the found quantity may not exceed the expected quantity; no match logs a count exception. Camera fallback scan rules (supervisors only, logged) are from the specification; the code check is a design value. |
| QT-R37 | The Pareto series on the dashboard (quality events by cause, 12 months) is a seeded summary; the specification names no Pareto for quality (it names one for scrap and for cost variance). |
| QT-R38 | Contact attempts: channels (Phone, Email, Letter, Site visit), outcomes and the rule that contact starts once the notification is approved (C-52) are design values. The specification lists a contact-attempt log on the recall campaign without fields. |
| QT-R39 | CSV import (DEC-08, Phase 2) specifies a template mapping from test-set software. The test-set templates, column names, the all-or-nothing rule and the numeric-only limit are design values. |
| QT-R40 | As-built dossier contents (as-built bill of material, FTR, certificate of conformance, material certificates, deviations, nameplate record) follow the specification's FTR, CoC and deviation disclosure rules; the checklist as one pack, the revision number and the Quality Manager countersign gate before transmittal are design values. |
| QT-R41 | The state switch at the top of each new screen (normal, empty, loading, validation, authorization, conflict, offline, degraded, read-only) is a review convenience for the nine mandatory states (Book V section 10.3); it is not a feature. |
| QT-R42 | SCAR vendor response form: the specification says the vendor answers D4 to D8 through an emailed form (portal in Phase 3) and gives no field list or link rule. The prototype shows the form inside the app with a review picker; a submission needs all five sections plus the respondent's name and email, is recorded as the vendor's and not as a PE role, and a closed SCAR is read-only. |
| QT-R43 | Genealogy correction pair flow: a wrong event is never edited (C-53). The flow records a reversal of the original and a replacement event, linked, and asks for a reason. Who may correct (Quality engineer, Quality Manager) and the rule that a correction needs evidence text are design values; the specification states only the reversal-plus-replacement principle. |
| QT-R44 | Routine-test capture forms group the plan's characteristics into the nine test types the specification lists. Derived values (mean winding resistance, polarization index, largest ratio deviation) and the field layout are design values; the specification gives the captured values and the pass criteria, not the form layout. |

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *R-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
| R-1 | src/data/domain (plan types) | Name the fifth plan type `RMA` (the specification's word, [DOC:p.33 §6.2]) where the shared entity says `RQC`; the gate stays RQC. | QM-PLAN | open |
| R-2 | src/data/domain/approvals.ts | Add approval kinds "Inspection plan approval" (Quality Manager), "Deviation approval" (Quality Manager + Engineering Manager), "Recall partial recovery" (Quality Manager + Executive), "Final test scrap" (Controller + Engineering Manager) so these go through ApprovalButton / WF-INBOX instead of on-screen recording (QT-R08, R09, R11, R18); the Controller as a third deviation approver above the value threshold (QT-R27). Today the approvals are recorded on the screens, with the PRD approvers enforced. | QM-PLAN, QM-DEV-001, RCL-001, QM-FIN-001; C-1 | open |
| R-3 | src/store/events.ts | Promote to the catalog: `quality.ftrIssued` (sales / finance milestone "Production Complete / Tested", planning WO status), `quality.vendorScarRestriction` (purchasing AVL Restricted), `quality.massHoldApplied` and `quality.deviationBlocked` (materials), `quality.recallRmaRequested` (sales, per-customer serial lists). Payloads are in `data/events.ts`. | QM-FIN-001 §4, QM-CAPA/SCAR §6, RCL-001 | open |
| R-4 | src/store/events.ts and modules/planning-production | Promote `quality.reworkRequested { ncrId, woId, serial, retestScope }` (declared in data/events.ts) to the catalog and have planning-production draft the RWO on it (origin = the NCR, kind "Test failure"); the final test links back on `production.reworkOrderCreated`. This module no longer invents an RWO number. | QM-FIN-001 fail → rework | open |
| R-5 | modules/sales (owner: sales agent) | `recallRmas` on `quality.recallStageChanged` drafts an RMA for the hero unit's bushings for any recall that enters Recover; it should use the campaign's field population (read `qualityTrace.recalls[].population` or consume `quality.recallRmaRequested`). Moving RCL-2026-003 to Recover today would draft a hero-unit RMA under the wrong campaign. | RCL-001 / FL-08 → FL-05 | open |
| R-6 | src/components/patterns/feedback.tsx | `SkeletonRows` renders `<tr>`s; a block variant (or doc note) for use outside tables (dashboards). Worked around with `SkeletonTable` in components/bits.tsx. | QM-DASH-001, TRC-DASH, BC-ADMIN | open |
| R-7 | src/data/domain/entities.ts | `Deviation.type` is "Deviation" / "Waiver"; the specification's types are Use-As-Is (waiver), Temporary Process Deviation, Customer-Approved Concession [DOC:p.215 Book IV §7.3]. QtDeviation overrides the type locally. | QM-DEV-001 | open |
| R-8 | src/store/events.ts and modules/engineering | Promote `quality.ecrRequested { ncrId, woId, serial, reason }` so engineering raises the ECR for a final test sent to Engineering Review (today the disposition links an existing ECR or records the request). Also `quality.inspectionOpened` for any module that shows the inspection state. | QM-FIN-001 | open |
| R-9 | modules/sales | The pre-shipment check is a stub on the delivery (Packed → Quality Cleared). It should wait for the OQC inspection this module opens on the T10 pack event and react to `quality.inspectionClosed`. | QM-EXEC OQC | open |
| R-10 | modules/purchasing-finance | `purchasing.grnPosted` carries no item or quantity; this module reads the GRN from the purchasing slice to open the IQC inspection. Add lines (materialId, qty, vendor) to the payload, as materials asked in its R-6. | QM-EXEC IQC | open |
| R-11 | src/data/domain/approvals.ts | Add approval kind "Reprint approval" (Quality Manager) so serial and nameplate reprints go through ApprovalButton and WF-INBOX; today the Quality Manager approves on the reprint governance screen (QT-R31). | FX-BC-REPRINT; C-1 | open |
| R-12 | src/App.tsx or app/module-types.ts | An "external" layout (no sidebar, no role switcher, no context bar) for pages that vendors or customers open from an emailed link. FX-QM-SCARRESP uses the office layout with an "External" chip and a review picker. | FX-QM-SCARRESP | open |
| R-13 | src/store/events.ts | Promote `trace.eventRecorded` carriers for camera scans (a `device` field and a `camera` flag) so the genealogy shows which events came from the camera fallback. Telemetry already flags them. | FX-BC-CAMERA | open |

## Feature-list entries (added 12 October 2026)

The user's feature list (`00-inputs/feature-list-2026-10.md`) is part of the prototype's scope together with the PRD. The feature mapper registered the rows below in `src/data/screens-features.ts`. Each has a placeholder route today. Build it at that path with `screenId` and a `built` claim, as for any registry screen. Routes, archetypes and ids marked FX- are design values. Rows that are a tab or panel of a screen you already own (for example Material Detail views, the RMA detail tabs, the Customer tax tab) have no entry: they are in the "Feature rows" list below and count as scope of that screen.

| Screen ID | Title | Route | Archetype | Wave | Flows | Feature-list section | Built |
|---|---|---|---|---|---|---|---|
| FX-BC-EXCEPTIONS | Scan exception queue (offline replay conflicts) | `/configuration/barcode/scan-exceptions` | Workbench (design value) | W4 | FL-11 | Barcode, Labels & Devices | full |
| FX-BC-REPRINT | Reprint governance dialog | `/configuration/barcode/reprint` | Dialog (design value) | W4 | FL-11 | Barcode, Labels & Devices | full |
| FX-BC-RELABEL | Identify and Relabel (mobile) | `/mobile/relabel` | Kiosk (design value) | W4 | FL-11 | Barcode, Labels & Devices | full |
| FX-BC-CAMERA | Supervisor camera-fallback scanning mode | `/mobile/camera-scan` | Kiosk (design value) | W4 | FL-11 | Barcode, Labels & Devices | full |
| FX-QM-SAMPLING | Sampling state panel | `/quality/sampling` | Detail (design value) | W5 | - | Quality Management | full |
| FX-QM-INVALIGN | Inventory quality screens alignment | `/quality/stock-status` | Workbench (design value) | W5 | FL-03 | Quality Management | full |
| FX-QM-TESTIMPORT | Test-set CSV import mapping | `/quality/test-import` | Wizard (design value) | W5 | FL-04 | Quality Management | full |
| FX-QM-ROUTINE | Transformer routine-test capture forms (nine types) | `/quality/routine-tests` | Detail (design value) | W5 | FL-04, FL-02 | Quality Management | full |
| FX-QM-SCARRESP | SCAR vendor response form (external) | `/quality/scar-response` | Detail (design value) | W5 | FL-05, FL-08 | Quality Management | full |
| FX-QM-SPC | SPC control charts, capability and trend alerts | `/quality/spc` | Dashboard (design value) | W5 | - | Quality Management | full |
| FX-QM-AUDIT | Quality audit management | `/quality/audits`, `/quality/audits/:id` | List (design value) | W5 | - | Quality Management | full |
| FX-TRC-ASBUILT | As-built record and certificate dossier | `/traceability/as-built`, `/traceability/as-built/:id` | Detail (design value) | W4 | FL-11, FL-02 | Traceability | full |
| FX-TRC-CORRECTION | Genealogy correction pair flow | `/traceability/genealogy-correction` | Wizard (design value) | W4 | FL-11 | Traceability | full |

