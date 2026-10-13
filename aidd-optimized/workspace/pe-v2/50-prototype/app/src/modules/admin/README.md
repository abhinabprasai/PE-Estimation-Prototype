# Module group: admin

> **What this is.** The owner's guide for `src/modules/admin/`. Workflow and administration: the PRD's Workflow and Administration module (4) plus INV-CONFIG-PERIOD and INV-CONFIG-TAX from Book VII.
>
> **Where it stands.** Admin build pass, 12 October 2026, plus the verifier fix pass the same day; feature-list pass completed 13 October 2026 (all 18 feature rows are built and claimed "full", plus the saga step view and the fiscal-period step-up gate). All six screens are built and claimed "full" (OPS-JOBS/INT on two routes). INV-CONFIG-PERIOD and INV-CONFIG-TAX are served at the PRD URLs /inventory/configuration/fiscal-periods and /inventory/configuration/tax (the registry paths redirect). Type-check is clean for this folder. Readings the PRD does not settle are listed below as AR-1..AR-31, and shared changes as R-1..R-9.
>
> **What we need from you.** Build the screens below inside this folder only. Anything you need outside it goes under "Requests to foundation" at the end.

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates` in the running app.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Built |
|---|---|---|---|---|---|---|
| WF-INBOX | Approvals Inbox | `/approvals` | Workbench | W1 | FL-01, FL-02, FL-03, FL-05, FL-06, FL-08, FL-09, FL-10 | full |
| WF-DEF | Workflow Definitions | `/configuration/workflows` | Config | W1 | - | full |
| OPS-JOBS/INT | Job and Integration Consoles | `/operations/jobs, /operations/integrations` | Workbench (design value) | W1 (W1 skeleton, W7 hardened) | - | full |
| CFG-CORE | Core Configuration Set | `/configuration/core` | Config (design value) | W1 | FL-06 | full |
| INV-CONFIG-PERIOD | Period configuration | `/inventory/configuration/fiscal-periods` (PRD URL; registry path `/configuration/periods` redirects) | Config (design value) | W1 | FL-06 | full |
| INV-CONFIG-TAX | Tax configuration | `/inventory/configuration/tax` (PRD URL; registry path `/configuration/tax` redirects) | Config (design value) | W1 | FL-01 | full |

Source: reference tables A [DOC:pp.245-282] (asserted); routes and archetypes marked "design value" are not in the specification.

## State

Slice key `admin`. `admin` (AdminState): workflow definitions and job runs. The shared approval engine itself lives in the store core (C-1), not here.

## Spine documents to seed

Seed these in `data/slice.ts` with exactly these IDs and statuses (headers in `src/data/shared/spine.ts`):

None owned by this group.

## Cross-module events

- Emits: `finance.periodStatusChanged` (period configuration), whatever the job console triggers.
- Consumes: `approval.requested` and `approval.decided` (WF-INBOX is the engine's queue).

Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder (see APP-ARCHITECTURE.md).

## Notes

- WF-INBOX holds every W.4 workflow on one queue. The FL-09 section (`inboxSection`) is no longer rendered: its credit-release and R-OM-02 items are mirrored onto the shared engine at start (data/queue.ts), so they carry an SLA clock, the C-2 delegation rule, recall rules and an audit trail, and their outcome is written back to the sales order (bridge, request R-8). The engine's rules (store/core.ts `decideApproval`) are foundation-owned.
- Requests for the W.4 rows whose documents live in other modules (WF-03, 04, 09, 11, 13, 17, 19) are raised at start from the admin slice and again from WF-INBOX after a Scenario reset (the reset empties the shared engine, not the admin slice).

## What each screen does

- **WF-INBOX** (`/approvals`): one queue over the shared engine (every ApprovalButton) and the admin engine queue (R-1), mapped to the 27-row W.4 register. Queues: waiting for me, escalated to me, my submissions, all open, decided. Per-step SLA clocks with escalation to the role's manager (AR-13); approve, reject with mandatory comment, recall and resubmit (admin queue), delegate a step, standing delegations with date range; delegation is never offered on a financial approval above $250,000 (C-2). Immutable audit trail with channel. The decided request's effect is applied (period reopen, configuration version, tax rate, tax adjustment JE) and `admin.workflowDecided` fires. Hero thread: APR-TBD-5007 (WF-06 sales change order on SO-2026-00301) with its DocumentFlowPanel.
- **WF-DEF** (`/configuration/workflows`): the 27 W.4 rows verbatim, the W.1 definition model, effective-dated versions (in-flight instances keep their version), steps, conditions, terminal actions, SLA and escalation; saving a version of a posting-gating workflow raises a Controller co-sign (AR-14). Shared-engine kinds outside W.4 are flagged per the W.4 Build Note.
- **OPS-JOBS/INT** (`/operations/jobs`, `/operations/integrations`): the W.3 job catalog with contract fields, runs (Scheduled, Running, Succeeded, Failed, Held (dependency)), run now, retry, period-end jobs with PostingPreview (#24, #36), severity matrix and incidents; IF-01..IF-20 with message monitor, dead letters, mark fixed, replay, edit-and-replay (AR-23), discard, correlation trace of the hero thread (COR-7F3A-0301); saga step view (SAGA-0015..0018: steps, compensators, retry a failed step, compensate in reverse order, AR-45).
- **CFG-CORE** (`/configuration/core`): number series, period and tax summaries, RMA, sales, production, engineering, quality, purchasing and inventory settings with the PRD's own values, SoD exceptions; every change is a new dated version approved by the setting's owner (AR-15, C-50).
- **INV-CONFIG-PERIOD** (`/configuration/periods`): one period per entity per month with Open, Soft Close, Hard Close; R-PER-01 enforced (one Open, at most one Soft Close); soft close, inventory close jobs, finance checklist, hard close blocked by failed close-critical jobs; reopen via WF-20 (Controller then CFO, C-43) with Reopened Posting tags; posting-date check with E-PER-01..04 and the module behavior matrix; `checkPostingDate` exported for other modules; emits `finance.periodStatusChanged`.
- **INV-CONFIG-TAX** (`/configuration/tax`): engine mode (Avalara or Manual Tables), default codes, trigger points, nexus register with the economic threshold monitor, manual rate table as dated rows approved by the Controller, monthly reconciliation and tax adjustment JE, determination check (hero IR-TBD-0031), configuration audit.

## Readings (PRD silent; shown on screen as design chips or notes)

| # | Reading |
|---|---|
| AR-1 | Records with no status list (workflow version, job run, interface message, incident, delegation) show their state as text, never a badge; the state words are design values (OQ-21). |
| AR-2 | SLA hours per step are design values except the PRD's 24 h ECR emergency and 2-day MCR steps. |
| AR-3 | Register owners not in the role list: "Warehouse Mgr" is versioned by the Warehouse supervisor, "ISO" by Plant IT. |
| AR-4 | A W.4 row counts as financial for the no-delegation-above-$250k rule when it routes on money (OQ-29). |
| AR-5 | WF-02 derived cost center owner resolves to the cost center's department head role. |
| AR-6 | WF-08 "authorized role" is the Quality Manager (register owner). |
| AR-7 | WF-12 department chain uses one role per view: Engineering, Purchasing, Costing, Quality, then Materials Manager. |
| AR-8 | Supersessions belong on WF-14; MM-SUP-001 currently sends them as "Material change". |
| AR-9 | WF-20 period reopen runs on the admin engine queue (no fiscal-period document type on the shared engine, R-2). |
| AR-10 | WF-21 vendor onboarding review step is the Quality engineer, then the Purchasing Manager activates. |
| AR-11 | WF-24 customer-notification step sits with the Customer Service Manager. |
| AR-12 | OM-BO reallocation uses the WF-25 de-peg chain and is counted under that row. |
| AR-13 | Escalation target is the role's manager; the PRD gives no reporting lines, so the map in data/catalog.ts is a reading. |
| AR-14 | The Controller co-sign required by W.1 Versioning for posting-gating workflows is raised as an approval request. |
| AR-15 | A CFG-CORE setting change is approved by the owner of its register row. |
| AR-16 | Not used. |
| AR-17 | Engine mode (Avalara or Manual Tables) is switched by the Controller. |
| AR-18 | Manual tax rate changes and tax adjustment JEs route to the Controller (INV §11.5); W.4 has no row for them. |
| AR-19 | Workflow ids WF-01..WF-27 are design ids; the register has no numbers. |
| AR-20 | The on-call role for Sev 1 and Sev 2 incidents is Plant IT. |
| AR-21 | Job SLA minutes, retry counts, owners and times of day are design values (names and calendars are W.3's). |
| AR-22 | Interface monitor figures and message state words are design values. |
| AR-23 | Edit-and-replay is restricted to Plant IT, Engineering IT and Quality IT. |
| AR-24 | A Soft Close period cannot return to Open once the next period is Open (R-PER-01 would see two Open periods). |
| AR-26 | "Finance Manager" (INV §7.5 count approval band) is not in the role list; the Controlling analyst seat carries that band in WF-17's definition. |
| AR-27 | Supplier Deviation is a W.4 addition (Book IV §3.4) with no register row: it is shown as WF-A1, Engineering and Quality vote as one parallel step and both must approve. |
| AR-28 | Job input values (the first §7.7 contract field) are read off each job's description; the PRD lists the field, not the values. |
| AR-29 | Reconciliation report run times and the severity of a failed control (S2 on a financially relevant interface, else S3) are design values; the control text is the PRD's. |
| AR-30 | Number series have no owner in the register: the Controller approves a gap-free series, Plant IT the others. |
| AR-31 | Workflow analytics formulas (SLA attainment, aging buckets, bottleneck, rejection rate, delegation usage, override = decided by a delegate or after the SLA breached) are readings; the PRD names the measures only. |
| AR-32 | Plant, lane and alert-rule maintenance roles (Plant IT drafts a plant and the Controller approves it; the Planning Manager maintains lanes; an alert's owner or Plant IT maintains it) are readings: the PRD gives no role-by-action matrix (ASM-PERM-1). |
| AR-33 | A noise review flags an alert rule when dedupe suppressed more than twice what it sent, or fewer than half of what it sent was acknowledged; each owner signs monthly. |
| AR-34 | Notification locales en-US and fr-CA, the placeholder set and the sensitive-field masking in previews are design values. |
| AR-35 | A SoD exception expires within 180 days at most. |
| AR-36 | The mobile approval view is held to a 390 px phone column inside KioskPage; recert and landing-page copy are design values. |
| AR-37 | KPI formulas, grains, targets, owners and freshness classes are readings; the PRD names the 15 seed KPIs and the freshness classes only. |
| AR-38 | The material type behavior matrix is configuration seed data; a cell change goes to the Materials Manager. |
| AR-39 | The Controller owns the intercompany markup table (the Controller's own change goes to the CFO); a new pair cannot trade until approved. |
| AR-40 | The denied-party reviewer is the Controller and must not be a person who ran part of the screening; list names and match scores are seed values. |
| AR-41 | The freight payer per RMA reason is a design value. |
| AR-42 | Number series per-entity counters and reset rules are readings. |
| AR-43 | The specification's serial profile names SN-FIN/COMP/SEMI are shown beside the shared master's SP-FIN/COMP/SEMI ids. |
| AR-44 | The plant planning-parameters block (lead-time offset, time fence, MRP area, safety time) lists design fields. |
| AR-45 | Saga ids, saga state words and who may compensate (Controller for IF-12 and IF-14, which carry financial commands; Plant IT, Engineering IT, Quality IT otherwise) are design values. |
| AR-25 | Economic nexus thresholds, monitored states and manual rate values are design values; the PRD says the table is maintained annually. |

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *R-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
| R-1 | src/data/domain/approvals.ts, src/store/core.ts | Add approval kinds for the W.4 rows with no shared-engine kind (WF-02, 05, 06, 08, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 26, 27), plus a generic `subject` for non-document subjects. Until then those rows run on the admin engine queue in this folder; WF-INBOX shows both queues as one. | WF-INBOX "every governed action routes here" [DOC:pp.11-12 W.4] | open |
| R-2 | src/data/domain/ids.ts / docflow | Add a `fiscalPeriod` document type so the shared "Period reopen" kind can attach to a period record. | INV-CONFIG-PERIOD reopen (WF-20) | open |
| R-3 | src/store/core.ts | Add `recallApproval(id, reason)` (initiator recall before first approval) and resubmit-with-history to the shared engine. | W.1 Recall and resubmit; WF-INBOX | open; admin covers both queues itself meanwhile (recall rejects the open step and marks it Recalled; resubmit raises a linked request with the earlier rounds) |
| R-4 | src/store/core.ts | `decideApproval` should accept `onBehalfOf` so a delegate's decision is recorded on the shared request, not only on the admin audit trail. | W.1 Delegation and absence | open |
| R-5 | src/store/events.ts | Promote `admin.workflowDecided` and `admin.configChanged` to the catalog so owning modules can apply decisions on admin-queue rows (e.g. WF-06 change order to sales). | WF-INBOX, CFG-CORE | open |
| R-7 | src/data/screens.ts; src/data/domain/roles.ts; src/data/domain/approvals.ts | (a) Change the registry paths of INV-CONFIG-PERIOD and INV-CONFIG-TAX to the PRD's /inventory/configuration/fiscal-periods and /inventory/configuration/tax [DOC:p.41, p.45]; admin serves them there and redirects the old paths. (b) Add a Finance Manager role and the "Count variance" route Supervisor → Finance Manager (above $2,000/line or $10,000/doc, or any ABC class-A variance) → Controller (above $25,000) [DOC:p.37 §7.5; p.12 W.4]; the shared route has no Finance Manager step and its $10k-$25k approver is stated as unknown. | INV-CONFIG-PERIOD, INV-CONFIG-TAX; WF-17 | open |
| R-8 | src/modules/sales (consumer) | Consume `approval.decided` for "Credit release" and "No-quote sales order" and apply the outcome to the order. Admin does this today through a guarded bridge in data/queue.ts (a no-op once the sales item is decided); when sales owns it, drop the bridge. Also let /sales screens link to /approvals instead of the FL-09 inbox section. | WF-INBOX one engine (C-1) | open |
| R-9 | src/store/core.ts | `reset()` should re-run slice start-up seeding (or keep seeded approvals); today requests raised at start (sales RMAs, admin W.4 seeds) vanish on Scenario reset and admin re-raises its own from WF-INBOX. | Scenario reset | open |
| R-10 | shell step-up state (src/modules/shell, src/store) | Publish a step-up state (`stepUpConfirmed(action)`) so INV-CONFIG-PERIOD reopen and the account-determination release read it. Until then the reopen dialog holds a local "Confirm step-up (prototype)" gate and links to /auth/step-up. | INV-CONFIG-PERIOD dual-control reopen | open |
| R-6 | src/data/domain/approvals.ts THRESHOLDS | Read thresholds through an effective-dated accessor fed by CFG-CORE so an approved setting version takes effect in every module. | CFG-CORE change control (C-50) | open |

## Feature-list entries (added 12 October 2026)

The user's feature list (`00-inputs/feature-list-2026-10.md`) is part of the prototype's scope together with the PRD. The feature mapper registered the rows below in `src/data/screens-features.ts`. Each has a placeholder route today. Build it at that path with `screenId` and a `built` claim, as for any registry screen. Routes, archetypes and ids marked FX- are design values. Rows that are a tab or panel of a screen you already own (for example Material Detail views, the RMA detail tabs, the Customer tax tab) have no entry: they are in the "Feature rows" list below and count as scope of that screen.

| Screen ID | Title | Route | Archetype | Wave | Flows | Feature-list section | Built |
|---|---|---|---|---|---|---|---|
| FX-WF-MOBILE | Mobile approval view and email-action landing pages | `/approvals/mobile`, `/approvals/action/:token` | Detail (design value) | W1 | FL-03, FL-06 | Workflow, Approvals & Administration | full |
| FX-WF-DIALOGS | Approval history, recall and reject dialogs | `/approvals/dialogs` | Dialog (design value) | W1 | - | Workflow, Approvals & Administration | full |
| FX-WF-ALERTS | Alert rules configuration | `/configuration/alert-rules` | Config (design value) | W1 | - | Workflow, Approvals & Administration | full |
| FX-WF-NOTIFTPL | Notification template manager | `/configuration/notification-templates` | Config (design value) | W1 | - | Workflow, Approvals & Administration | full |
| FX-WF-RECERT | Access recertification and SoD exception request | `/configuration/access-recertification` | Workbench (design value) | W1 | - | Workflow, Approvals & Administration | full |
| FX-WF-KPI | KPI dictionary register | `/configuration/kpi-dictionary` | List (design value) | W1 | - | Workflow, Approvals & Administration | full |
| FX-WF-ANALYTICS | Workflow analytics dashboard | `/approvals/analytics` | Dashboard (design value) | W1 | - | Workflow, Approvals & Administration | full |
| FX-CFG-NUMSERIES | Number series | `/configuration/number-series` | Config (design value) | W1 | - | Configuration (Core Config Set) | full |
| FX-CFG-RMAPOLICY | RMA policy configuration | `/configuration/rma-policy` | Config (design value) | W1 | FL-05 | Configuration (Core Config Set) | full |
| FX-CFG-SETTINGS | Sales, Production, Engineering and Quality settings | `/configuration/settings`, `/configuration/settings/sales`, `/configuration/settings/production`, `/configuration/settings/engineering`, `/configuration/settings/quality` | Config (design value) | W1 | - | Configuration (Core Config Set) | full |
| FX-CFG-MATERIAL | Material settings | `/configuration/material-settings` | Config (design value) | W1 | - | Configuration (Core Config Set) | full |
| MP-PLANT-001 | Plant Master | `/configuration/plants`, `/configuration/plants/:id` | List (design value) | W1 | - | Configuration (Core Config Set) | full |
| MP-LANE-001 | Transfer Lanes | `/configuration/transfer-lanes` | Config (design value) | W1 | - | Configuration (Core Config Set) | full |
| FX-CFG-IC | Intercompany relationships and transfer pricing | `/configuration/intercompany` | Config (design value) | W1 | FL-07 | Configuration (Core Config Set) | full |
| FX-CFG-REASONS | Reason-code and lookup catalogs | `/configuration/reason-codes` | Config (design value) | W1 | - | Configuration (Core Config Set) | full |
| FX-CFG-DPS-ONBOARD | Denied-party interim onboarding checklist | `/configuration/denied-party/onboarding` | Detail (design value) | W1 | - | Configuration (Core Config Set) | full |
| FX-CFG-DPS-REVIEW | Denied-party screening review queue | `/configuration/denied-party/review` | Workbench (design value) | W1 | - | Configuration (Core Config Set) | full |
| FX-CFG-GLMAP | GL account mapping | `/configuration/gl-mapping` | Config (design value) | W1 | - | Configuration (Core Config Set) | full |

