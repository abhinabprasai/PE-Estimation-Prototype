# Module group: planning-production

> **What this is.** The owner's guide for `src/modules/planning-production/`. Planning and production: the PRD's Planning (5) and Production (8) modules. CTP-DLG is a Planning entry already built inside the sales module for one FL-09 order.
>
> **Where it stands.** Gap-fix pass, 12 October 2026. 12 screens are built at their registry routes and claimed "full"; the type-check is clean for this folder. CTP-DLG is claimed "partial": the dialog and the planner's host page (`/production/at-risk/promise`, with "New promise check" for quote and order lines) are here, but the registry route is the sales module's and embedding the dialog on the sales pages is request R-1.
>
> **What we need from you.** Build the screens below inside this folder only. Anything you need outside it goes under "Requests to foundation" at the end.

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates` in the running app.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Built |
|---|---|---|---|---|---|---|
| PP-MRP-001 | MRP Workbench | `/production/mrp` | Workbench | W4 | FL-04 | full |
| PLO-001 | Planned Orders | `/production/planned-orders` | List | W4 | FL-04 | full |
| SCH-BOARD | Schedule Board | `/production/schedule` | Workbench | W4 | FL-04 | full |
| CTP-DLG | Promise Dialog | `/sales/orders/SO-2026-00402?ctp=1 (design value)` | Dialog | W4 | FL-01, FL-02 | partial (host `/production/at-risk/promise`; sales embedding R-1) |
| AT-RISK | At Risk Promises | `/production/at-risk` | Workbench | W4 | - | full |
| PP-WC-001/2 | Work Centers | `/production/work-centers, /production/work-centers/:id` | List | W4 | - | full |
| PP-RTG-001/2 | Routings | `/production/routings, /production/routings/:id` | List | W4 | - | full |
| PP-WO-001/2 | Production Orders | `/production/orders, /production/orders/:id` | List | W4 | FL-04, FL-02 | full |
| PP-DSP-001 | Dispatch List | `/production/dispatch` | Workbench | W4 | - | full |
| PP-SFT-001 | Shop Floor Terminal | `/production/terminal` | Kiosk | W4 | FL-04, FL-02 | full |
| PP-WIP-001 | WIP Board and Valuation | `/production/wip` | Workbench (design value) | W4 | FL-04 | full |
| RWO-001 | Rework Orders | `/production/rework, /production/rework/:id` | List | W4 | FL-05, FL-04 | full |
| PP-SETTLE-001 | Settlement Run | `/production/settlement` | Wizard | W4 | FL-04, FL-02 | full |

Source: reference tables A [DOC:pp.245-282] (asserted); routes and archetypes marked "design value" are not in the specification.

## State

Slice key `planningProduction`. `planningProduction` (PlanningProductionState): planned orders, routings, production orders, confirmations, rework orders, warehouse tasks. Work centers are shared (WORK_CENTERS, WC-050..WC-700).

## Spine documents to seed

Seed these in `data/slice.ts` with exactly these IDs and statuses (headers in `src/data/shared/spine.ts`):

| ID | Type | Status | Title |
|---|---|---|---|
| WO-TBD-0301 | productionOrder | Closed (TECO) | Production order, 20 MVA unit SN-TBD-20M-0301 |
| RWO-TBD-0012 | reworkOrder | Open | Rework: inspect and reseal returned bushing |
| PLO-TBD-0377 | plannedOrder | - | Planned orders for three 20 MVA units |

## Cross-module events

- Emits: `planning.plannedOrderConverted`, `production.orderReleased`, `production.confirmationPosted`, `production.fgReceived`, `production.orderSettled`, `posting.posted` (#28 to #33), `trace.eventRecorded` (T05 to T09), `planning.expediteRequested` (MRP EX-02/06 and Release Short), `production.cvaExceptionRaised`.
- Consumes: `engineering.mbomActivated`, `engineering.ecoReleased` (revalidation), `purchasing.poDeliveryDateChanged` (supply slip revalidation), `sales.orderConfirmed` (opens checks; firms only that order's own quote reservation), `quality.inspectionClosed`, `quality.recallStageChanged` (containment puts WOs On Hold), `approval.decided` (WO reopen).

Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder (see APP-ARCHITECTURE.md).

## Notes

- PP-SFT-001 is a Kiosk screen: register its route with `layout: "kiosk"` and build it on `KioskPage` + `ScanField`.
- C-26: a WO stays Testing until Pass or scrap disposition.

## How the screens hang together

- Files: `data/types.ts` (state), `data/seed.ts` (seed), `data/slice.ts` (search, links, subscriptions), `data/events.ts` (module events), `lib/actions.ts` (every state change), `lib/plan.ts` (calendar, finite scheduler, cost math), `lib/gates.ts` (release and close checks), `lib/ctp.ts` (capable-to-promise), `components.tsx`, `pages/*`.
- Hero thread SO-2026-00301: WO-TBD-0301 (Closed (TECO), settled by SET-TBD-0301, final test IL-TBD-0302, bushings SN-TBD-BSH-0301..0303 from BAT-TBD-B0301) at `/production/orders/WO-TBD-0301`; its promise CTP-TBD-0301 and at-risk record ARK-TBD-0014; RWO-TBD-0012 for the returned bushing. Phase 2 SO-2026-00377: PLO-TBD-0377 (Firmed, EX-07 until the MBOM activates), CTP-TBD-0377, ARK-TBD-0022.
- Every status of S-15 routing, S-20 work center, S-21 production order, S-22 rework order and S-23 warehouse task is seeded. Planned orders, promises and at-risk records have no status list (OQ-21): text, no badge.
- Postings: #28 (SP-08 and backflush), #29, #30 at the terminal; #31 Receive to stock; #32 settlement (and its reversal on reopen); #33 / #21 / #22 at rework settlement; vendor-caused rework has no template number. Each emits `posting.posted`.
- Trace: T05 (SP-08), T06 (SP-12), T08 (final test pass) emit `trace.eventRecorded`; T07 and T09 are recorded by quality-trace from `production.confirmationPosted` and `production.fgReceived`, so this module does not emit them twice.

## Readings (PRD silent; shown on screen as Design value or Reading chips)

| # | Where | Reading |
|---|---|---|
| RD-1 | SCH-BOARD, PP-WO-002 | PRD-given (not readings): backward scheduling from the due date is the default, forward from release on demand [DOC:p.74 §5.1; p.192 §3]; freeze horizon default 5 working days per work center, changes inside need Production Scheduler action with a reason [DOC:p.193 §3]; late pegged orders auto-escalate [DOC:p.74 §5.1]. Readings: Mon-Fri calendar; loading heuristic (priority order, latest free hours backward, earliest forward, forward fallback when backward does not fit); an escalated order gets priority 1; stock orders' due date = finish of a first forward pass; pegged orders' due date = promise less 3 working days staging. |
| RD-2 | CTP-DLG | PRD-given: soft reservation decays after 14 days (config) [DOC:p.193 §4]. Readings: ship date = completion + 3 working days; material lead times per item in `lib/ctp.ts`; Budgetary lead-time band = longest component lead + routing hours at 16 h per day, widened by the Budgetary ±25% [DOC:p.45]; the planner records Budgetary / Firm on the check because the sales quotation has no quote-type field yet. |
| RD-3 | AT-RISK | Transit buffer 3 days. "Revalidate now" is a manual planner run recorded with the trigger "Manual revalidation" (the four PRD triggers stay automatic). A supply slip is raised by the MRP "Re-date supply" action on EX-02 / EX-06 and by `purchasing.poDeliveryDateChanged` (R-7). |
| RD-4 | PP-DSP-001 | Resequence guardrail: running operations stay on top; nothing jumps ahead of a running operation. |
| RD-5 | PP-SFT-001 | Scrap reason list SR-01..SR-05; scrap supervisor threshold 5% of the started quantity (the rule "beyond threshold" gives no value); the ±20% hours guardrail is the PRD's and is checked against standard crew hours; outside it a supervisor badge plus reason lets the confirmation post; FIFO override reasons; offline queue replays in order and is idempotent by event ID. Skill flags on WC-210, WC-400, WC-500 operations and the QAL- register entries are seeded values; the interlock checks the badge-in operator. Work-instruction PDFs are a placeholder panel. |
| RD-6 | PP-WO-002 | After Final Test passes the order returns Testing → In Progress for paint and pack; Receive to Stock then sets Completed (C-26 keeps Testing until Pass or scrap disposition). Scrap disposition posts residual WIP as #30 to 5320, cancels open operations and sets Completed for settlement; an Open rework order that collected nothing does not block the close. |
| RD-7 | PP-WO-002 | Cancellation dispositions are the PRD's (finish / stop-scrap / hold). Readings: Finish unpegs the order and lets it run into FG stock; Stop-scrap needs the Controller when WIP carries cost ("per Controller decision") and posts the residual as #30 to 5320; Hold puts the order On Hold "SO cancellation pending disposition". Cancel operation: Production Scheduler or supervisor, never a QC checkpoint. Confirmation reversal: supervisor, latest confirmation first, before FG receipt. Primary production cost center = the work center with the most standard crew hours. |
| RD-8 | PP-RTG-002 | No routing reviewer role is named: any role may release (ASM-PERM-1). |
| RD-9 | PP-SETTLE-001 | Labor rate variance (5230) is zero: #29 applies labor at standard rates and payroll actuals are out of scope. Settlement role (Cost accountant) and the confirmer-is-not-settler check are PRD rules [DOC:p.263; p.179 f3], not readings. |
| RD-10 | RWO-001 | Actual labor rate per rework order 58-66 USD/h; re-inspection stand-in buttons until QM-INSP consumes `production.inspectionRequested`. |
| RD-11 | PP-WC-001/2 | Shift patterns, rate values, queue and move times are seeded design values. Rates are read-only here (link to CST-RATE-001). |
| RD-12 | PP-MRP-001 | Nightly regenerative run time 01:00. "Run regenerative now" re-plans unfirmed proposals from their need dates; firmed ones are kept. Buy conversion makes one PR per vendor (the vendor on the proposal's source hint). |
| RD-13 | PP-WIP-001 | Milestone % = confirmed milestone operations / milestone operations (count). "Scheduled" in order progress = the last published snapshot. |

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *R-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
| R-1 | src/modules/sales (quote and order detail) | Render `PromiseDialog` (exported from this module's index) on MTO/ETO quote lines and at order confirmation, replacing the FL-09 stub for SO-2026-00402 so only one implementation claims CTP-DLG; add a Quote Type field (Budgetary / Firm [DOC:p.45]) to the quotation and block sending a Firm ETO quote without a CTP result; listen to `planning.promiseDecided` to log the decision on the document. Order confirmation already opens a check per MTO/ETO line here (`sales.orderConfirmed`). Until then the dialog is hosted at `/production/at-risk/promise`. | CTP-DLG "dialog on quotes and orders" | open |
| R-2 | src/modules/quality-trace | Consume `production.inspectionRequested` (subject productionOrder or reworkOrder) to open IP-INP / final / re-inspection lots, and emit `quality.inspectionClosed` with the same lot ID. Until then PP-WO-002 and RWO-002 show stand-in Pass / Fail buttons. | PP-SFT-001 QC gate, RWO-001 re-inspection | open |
| R-3 | src/store/events.ts | Promote the module events in `data/events.ts` to the shared catalog (`planning.expediteRequested` for PUR-EXP-001, `planning.salesChangeOrderRequested` for sales, `production.ncrRaised` for quality, `planning.promiseDecided` for sales). | PP-MRP-001 EX-02/06, AT-RISK, PP-SFT-001 E-PP-07 | open |
| R-4 | src/data/domain/docflow.ts | Add a `routing` doc type (route `/production/routings/:id`, status kind `routing`) so routings appear in the document flow. | PP-RTG-002 | open |
| R-6 | src/modules/purchasing-finance | Consume `production.cvaExceptionRaised` (release check 5, no standard cost) into the CVA exception list. | PP-WO-002 check 5 [DOC:p.74 §5.2] | open |
| R-7 | src/modules/purchasing-finance + src/store/events.ts | Emit `purchasing.poDeliveryDateChanged` (declared here by augmentation) when a confirmed PO delivery date moves later; planning revalidates the pegged promises. Also consume `planning.expediteRequested` from Release Short. | AT-RISK "supply slip on a pegged PO" [DOC:p.193 §4]; PP-WO-002 check 2 | open |
