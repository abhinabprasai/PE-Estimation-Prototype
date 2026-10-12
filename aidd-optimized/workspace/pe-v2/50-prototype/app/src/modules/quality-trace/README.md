# Module group: quality-trace

> **What this is.** The owner's guide for `src/modules/quality-trace/`. Quality and traceability: the PRD's Quality (8) and Traceability and Barcode (3) modules.
>
> **Where it stands.** Module pass, 12 October 2026. All eleven screens are built and claimed "full" in `routes.tsx`; the hero thread SO-2026-00301 is walkable from incoming inspection to recall. Type-check is clean for this folder.
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

- Emits: `quality.inspectionClosed`, `quality.recallStageChanged`, `trace.eventRecorded`.
- Consumes: every `trace.eventRecorded`, `sales.pgiPosted` (T11), `purchasing.grnPosted` (T02), `production.confirmationPosted` (T07), `approval.decided` (recall notification, dual approval C-52).

Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder (see APP-ARCHITECTURE.md).

## Notes

- C-53: genealogy is append-only and hash-chained; corrections are reversal + replacement events.
- The hero recall RCL-2026-001 is at Contain; batch BAT-TBD-B0301 is Blocked and reserved for SO-2026-00377.

## What is built

| Screen | File | Template | Primary actions (all change state through the `qualityTrace` slice) |
|---|---|---|---|
| QM-DASH-001 | pages/Dashboard.tsx | DashboardPage | Drill to each queue: open inspections by gate, FPY, NCR funnel, vendor quality, cost of quality, hold inventory, calibration due, hero thread |
| QM-PLAN-001/2 | pages/Plans.tsx | ListPage + DetailPage | Author plan, add / remove characteristics on Draft, submit, approve to Active (supersedes), reject, new revision, copy, set Obsolete (E-QM-01 guard), revision compare, where used |
| QM-EXEC | pages/Inspections.tsx | ListPage (gate queues) + DetailPage | SP-05 sample pull, SP-14 instrument binding (E-QM-05), record results with pass / fail colouring, certificate, accept / reject with disposition, stock status move per gate, NCR, link deviation |
| QM-FIN-001 | pages/FinalTest.tsx | ListPage + DetailPage | Start run, SP-14 binding, partial save across sessions, complete run (Pass: FTR + `quality.ftrIssued` milestone; Fail: NCR mandatory), disposition Rework / Engineering Review / Scrap, retest scope, countersign, printable FTR |
| QM-CAPA/SCAR | pages/Capa.tsx | ListPage + DetailPage (CAPA, NCR links, SCAR) | CAPA lifecycle S-25 with root cause, actions with evidence, 30-day effectiveness gate, reopen; NCR sheet (open CAPA, raise SCAR, stage); SCAR 8D response, close with cost recovery, escalate, AVL enforcement (`quality.vendorScarRestriction`) |
| QM-DEV-001 | pages/Deviations.tsx | ListPage + DetailPage | Request, dual approval (QM + Engineering Manager), reject, customer evidence, record use, auto expiry |
| QM-CAL-001 | pages/Calibration.tsx | ListPage + side sheet | Record calibration (pass / fail), out-of-service toggle, certificates, measurements at risk |
| RCL-001 | pages/Recalls.tsx | WorkbenchPage + DetailPage | Open campaign, derive population (versioned), mass hold, notification text + ApprovalButton (dual, WF-INBOX), export list, request recall RMAs, dispositions, partial sign-off, advance to Closed |
| TRC-EXPL | pages/TraceExplorer.tsx | WorkbenchPage (tree table) | Trace backward / forward (5 levels), evidence drill with hash chain, correction pair, export dossier, feed a recall |
| TRC-DASH | pages/TraceDashboard.tsx | DashboardPage | Run control job, assign owners, resolve, correction pair hand-off |
| BC-ADMIN | pages/BarcodeAdmin.tsx | ConfigPage | Register / toggle printers, template drafts and publish, scan point policy toggles, reprint with reason, resolve scan exceptions |

Every list and detail has the loading skeleton (first visit), the empty state (`?sim=empty`) and the error state with retry (`?sim=error`), a design convenience for review.

Cross-module hand-offs:

- Emits `quality.inspectionClosed` (materials moves QI Hold), `materials.stockStatusChanged` (IQC / RQC decisions, mass hold), `quality.recallStageChanged` (sales drafts recall RMAs at Recover), `trace.eventRecorded` (T03, T08, T12, T13 and correction pairs), plus module-only `quality.ftrIssued`, `quality.ncrCreated`, `quality.vendorScarRestriction`, `quality.recallRmaRequested`, `quality.massHoldApplied`, `quality.deviationBlocked`.
- Consumes `approval.decided` (Recall external notification moves Contain → Notify), `quality.recallStageChanged` (links the RMA Sales drafted back onto the population), `purchasing.grnPosted` (T02), `production.confirmationPosted` (T07), `production.fgReceived` (T09), `production.orderReleased` (serial record), `sales.pgiPosted` (T11, serial Shipped), `sales.rmaReceived` (T12), every `trace.eventRecorded`.

Hero thread: dashboard card → IL-TBD-0301 (IQC, accepted) → BAT-TBD-B0301 → IL-TBD-0302 (FTR-2026-0188) → SN-TBD-20M-0301 (trace tree) → IL-TBD-0304 (RQC) → NCR-TBD-0044 → SCAR-TBD-0009 / CAPA-TBD-0015 → RCL-2026-001 (Contain; approve the seeded APR request in WF-INBOX to reach Notify).

## Readings

Choices made where the specification is silent; each shows on screen as a reading chip (`data/readings.ts`) and is to be numbered into `10-discovery/open-questions.md` by the integration pass.

| ID | Reading |
|---|---|
| QT-R01 | Inspection record has no status list; open until Accepted / Rejected; the subject's stock or serial status carries the badge. |
| QT-R02 | NCR stage words Open / Dispositioned / Closed and severities Critical / Major / Minor (NCR owned by INV 15.4). |
| QT-R03 | SLA for age colouring: IQC 3 days, IPQC and OQC 1 day, RQC 5 business days. |
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
| QT-R18 | Final-test Scrap dual sign-off recorded by the QM (no WF-INBOX kind). |
| QT-R19 | Dashboard FPY / CoQ / vendor figures are seeded summaries. |
| QT-R20 | SCAR state words shown as text. |
| QT-R21 | Final test queue stage words. |
| QT-R22 | Coverage attention below 99.5%. |
| QT-R23 | Recall RMA numbers come from Sales; linked back by serial. |

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *R-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
| R-1 | src/data/domain (plan types) | Name the fifth plan type `RMA` (the specification's word, [DOC:p.33 §6.2]) where the shared entity says `RQC`; the gate stays RQC. | QM-PLAN | open |
| R-2 | src/data/domain/approvals.ts | Add approval kinds "Inspection plan approval" (Quality Manager), "Deviation approval" (Quality Manager + Engineering Manager), "Recall partial recovery" (Quality Manager + Executive), "Final test scrap" (Controller + Engineering Manager) so these go through ApprovalButton / WF-INBOX instead of on-screen recording (QT-R08, R09, R11, R18). | QM-PLAN, QM-DEV-001, RCL-001, QM-FIN-001; C-1 | open |
| R-3 | src/store/events.ts | Promote to the catalog: `quality.ftrIssued` (sales / finance milestone "Production Complete / Tested", planning WO status), `quality.vendorScarRestriction` (purchasing AVL Restricted), `quality.massHoldApplied` and `quality.deviationBlocked` (materials), `quality.recallRmaRequested` (sales, per-customer serial lists). Payloads are in `data/events.ts`. | QM-FIN-001 §4, QM-CAPA/SCAR §6, RCL-001 | open |
| R-4 | src/store/events.ts | Add `quality.reworkRequested { ncrId, woId, rwoId, retestScope }` so planning-production opens the RWO for a failed final test (today the RWO id is only recorded here). | QM-FIN-001 fail → rework | open |
| R-5 | modules/sales (owner: sales agent) | `recallRmas` on `quality.recallStageChanged` drafts an RMA for the hero unit's bushings for any recall that enters Recover; it should use the campaign's field population (read `qualityTrace.recalls[].population` or consume `quality.recallRmaRequested`). Moving RCL-2026-003 to Recover today would draft a hero-unit RMA under the wrong campaign. | RCL-001 / FL-08 → FL-05 | open |
| R-6 | src/components/patterns/feedback.tsx | `SkeletonRows` renders `<tr>`s; a block variant (or doc note) for use outside tables (dashboards). Worked around with `SkeletonTable` in components/bits.tsx. | QM-DASH-001, TRC-DASH, BC-ADMIN | open |
