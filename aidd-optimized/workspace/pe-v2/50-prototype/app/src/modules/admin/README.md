# Module group: admin

> **What this is.** The owner's guide for `src/modules/admin/`. Workflow and administration: the PRD's Workflow and Administration module (4) plus INV-CONFIG-PERIOD and INV-CONFIG-TAX from Book VII.
>
> **Where it stands.** Foundation pass, 11 October 2026. Routes stubbed; every screen below shows the "Not built yet" placeholder until a route here claims its path.
>
> **What we need from you.** Build the screens below inside this folder only. Anything you need outside it goes under "Requests to foundation" at the end.

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates` in the running app.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Built |
|---|---|---|---|---|---|---|
| WF-INBOX | Approvals Inbox | `/approvals` | Workbench | W1 | FL-01, FL-02, FL-03, FL-05, FL-06, FL-08, FL-09, FL-10 | partial |
| WF-DEF | Workflow Definitions | `/configuration/workflows` | Config | W1 | - | none |
| OPS-JOBS/INT | Job and Integration Consoles | `/operations/jobs, /operations/integrations` | Workbench (design value) | W1 (W1 skeleton, W7 hardened) | - | none |
| CFG-CORE | Core Configuration Set | `/configuration/core` | Config (design value) | W1 | FL-06 | none |
| INV-CONFIG-PERIOD | Period configuration | `/configuration/periods (design value)` | Config (design value) | W1 | FL-06 | none |
| INV-CONFIG-TAX | Tax configuration | `/configuration/tax (design value)` | Config (design value) | W1 | FL-01 | none |

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

- WF-INBOX is built (partial) in the foundation pass: the shared queue with a decide panel, plus the FL-09 queue below it. Extend it here; the engine's rules (store/core.ts `decideApproval`) are foundation-owned.

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *R-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
