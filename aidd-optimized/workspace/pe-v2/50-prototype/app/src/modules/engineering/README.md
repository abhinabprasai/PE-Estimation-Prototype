# Module group: engineering

> **What this is.** The owner's guide for `src/modules/engineering/`. Engineering: the PRD's Engineering (6) and CAD and Documents (4) modules.
>
> **Where it stands.** Feature pass, 12 October 2026. All ten PRD screens and all ten feature-list screens (below) are built and claimed "full" in `routes.tsx`; the type-check is clean for this folder. The PDM connector (IF-17) is mocked in the slice.
>
> **What we need from you.** Build the screens below inside this folder only. Anything you need outside it goes under "Requests to foundation" at the end.

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates` in the running app.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Built |
|---|---|---|---|---|---|---|
| ENG-HOME-001 | Engineering Workspace | `/engineering` | Workbench | W3 | - | full |
| ENG-REQ-001 | Engineering Request | `/engineering/requests, /engineering/requests/:id` | Detail | W3 | FL-02, FL-10 | full |
| ENG-BOM-002 | EBOM Editor | `/engineering/boms/:id, /engineering/boms` | Detail | W3 | FL-02, FL-10 | full |
| ENG-ECR/ECO | Change Requests and Change Orders | `/engineering/change-requests, /engineering/change-requests/:id, /engineering/change-orders, /engineering/change-orders/:id` | List (design value) | W3 | FL-10 | full |
| MBOM-TRF | MBOM Transform | `/engineering/mbom-transform, /engineering/mbom-transform/:id (design value)` | Wizard | W3 | FL-02 | full |
| PV-001 | Production Versions | `/engineering/production-versions, /engineering/production-versions/:id` | List | W3 | - | full |
| ENG-DOC-001/2 | Controlled Documents | `/engineering/documents, /engineering/documents/:id` | List | W3 | FL-02, FL-10 | full |
| TR-001 | Transmittals | `/engineering/transmittals, /engineering/transmittals/:id` | Wizard | W3 | FL-02 | full |
| CAD-SYNC | CAD Sync Monitor and Conflict Queue | `/engineering/cad-sync` | Workbench | W3 (W3 with the connector) | - | full |
| CAD-IMP | CAD BOM Import | `/engineering/boms/:id/import (design value)` | Wizard | W3 | - | full |

Source: reference tables A [DOC:pp.245-282] (asserted); routes and archetypes marked "design value" are not in the specification.

## State

Slice key `engineering`. `engineering` (EngineeringState): engineering requests, EBOMs, MBOMs, production versions, documents, transmittals, ECRs, ECOs.

## Spine documents to seed

Seed these in `data/slice.ts` with exactly these IDs and statuses (headers in `src/data/shared/spine.ts`):

| ID | Type | Status | Title |
|---|---|---|---|
| ER-TBD-0301 | engineeringRequest | Closed | Design: 20 MVA ONAN/ONAF, 115 kV - 13.8 kV, OLTC 17 positions |
| DOC-TBD-0301-GA | document | Released | General arrangement drawing, rev C |
| TR-TBD-0301 | transmittal | - | Approval drawings to Midland Plains |
| EBOM-TBD-0301 | ebom | Released | EBOM FIN-TBD-20MVA, Omaha North, rev B |
| MBOM-TBD-0301 | mbom | Active | MBOM FIN-TBD-20MVA rev B |
| PV-TBD-0301 | productionVersion | Released | Production version 20 MVA, lot size 1-3 |
| ER-TBD-0377 | engineeringRequest | In Design | Design: phase 2, three units from rev B with bushing change |
| EBOM-TBD-0377 | ebom | Draft | EBOM FIN-TBD-20MVA, phase 2, rev A |

## Cross-module events

- Emits: `engineering.ebomReleased`, `engineering.mbomActivated`, `engineering.placeholderNeeded`, `engineering.ecoReleased`, `engineering.llrApproved`; module-only `engineering.designApproved`, `engineering.woHoldRequested`, `engineering.ecoCutover` (R-6, R-11).
- Consumes: `sales.lineNeedsEngineering` (opens an engineering request), `approval.decided` (EBOM release, production version release, ECR).

Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder (see APP-ARCHITECTURE.md).

## Notes

- C-14: a Released EBOM is immutable; offer "raise ECR" instead of Edit.
- MBOM-TRF and CAD-IMP routes are design values (the entries say "wizard from a released EBOM" and "wizard inside the EBOM editor").


## Feature-list entries (added 12 October 2026)

The user's feature list (`00-inputs/feature-list-2026-10.md`) is part of the prototype's scope together with the PRD. The feature mapper registered the rows below in `src/data/screens-features.ts`. Each has a placeholder route today. Build it at that path with `screenId` and a `built` claim, as for any registry screen. Routes, archetypes and ids marked FX- are design values. Rows that are a tab or panel of a screen you already own (for example Material Detail views, the RMA detail tabs, the Customer tax tab) have no entry: they are in the "Feature rows" list below and count as scope of that screen.

| Screen ID | Title | Route | Archetype | Wave | Flows | Feature-list section | Built |
|---|---|---|---|---|---|---|---|
| FX-ENG-RELEASE | EBOM review and release package | `/engineering/dialogs/ebom-release` | Dialog (design value) | W3 | FL-02, FL-10 | Engineering & BOM | full |
| FX-ENG-COPYFROM | EBOM Copy From and base-design picker | `/engineering/dialogs/copy-from` | Dialog (design value) | W3 | FL-10 | Engineering & BOM | full |
| FX-ENG-COMPARE | Compare revisions view | `/engineering/compare-revisions` | Detail (design value) | W3 | FL-10 | Engineering & BOM | full |
| FX-ENG-MASSREPLACE | Mass replace component dialog | `/engineering/dialogs/mass-replace` | Dialog (design value) | W3 | FL-10 | Engineering & BOM | full |
| FX-ENG-WHEREUSED | Where-Used explorer | `/engineering/where-used` | Workbench (design value) | W3 | FL-10, FL-08 | Engineering & BOM | full |
| FX-ENG-ITEMS | Engineering items view | `/engineering/items` | List (design value) | W3 | - | Engineering & BOM | full |
| FX-ENG-REPORTS | Engineering reports (five) | `/engineering/reports`, `/engineering/reports/:id` | Dashboard (design value) | W3 | - | Engineering & BOM | full |
| FX-DOC-REDLINE | PDF redline review layer | `/engineering/redline-review` | Detail (design value) | W3 | FL-02 | CAD & Document Control | full |
| FX-CAD-COMPARE | CAD vs EBOM structure comparison | `/engineering/cad-compare` | Detail (design value) | W3 | - | CAD & Document Control | full |
| FX-CAD-PDM | PDM linkage states | `/engineering/pdm-linkage` | Detail (design value) | W3 | - | CAD & Document Control | full |

### Feature-row notes (12 October 2026)

- Every FX page takes `?state=loading|empty|validation|denied|conflict|offline|degraded|readonly|error` (State preview control) for the nine states plus a service error; real actions also raise validation and conflict messages.
- The dialog entries are components in `dialogs.tsx` (opened from the EBOM editor: Review release package, Copy From, Mass replace; Where-Used opens Mass replace) and pages in `pages/Dialogs.tsx` showing each dialog inline and as a modal.
- ENG-BOM-002: added the Sales kits tab and the Sales kit usage block in the context panel [DOC:p.256 §6.1], the shared Compare view, and the keyboard grid contract (Enter next row, Shift+Enter previous, Tab next cell, Esc cancels, Enter past the last row lands on Add a line).
- ENG-DOC-001/2: new Rendition tab; every unreleased rendition (WIP, In Review) carries the NOT FOR MANUFACTURE watermark and a header chip, a Released one the RELEASED stamp, an Obsolete one OBSOLETE. Redline pins are placed on the PDF at /engineering/redline-review.
- ENG-REQ-001: verified the back-scheduled due date (promised ship minus production lead minus long-lead, edit with schedule-impact warning and an "Edited" chip) and added the release-level path strip Concept to Released for Production.
- The change cycle report holds eight pre-seed released changes in `data/extra.ts` and average design hours per type: both shown with Design value chips.

## Hero thread through this module

SO-2026-00301 line 10 → ER-TBD-0301 (Closed) → DOC-TBD-0301-GA rev C (Released) → TR-TBD-0301 (Approved as Noted: design approval evidence) → EBOM-TBD-0301 rev B (Released) → MBOM-TBD-0301 rev B (Active) → PV-TBD-0301 (Released). Phase 2: SO-2026-00377 → ER-TBD-0377 (In Design) → EBOM-TBD-0377 (Draft, two Draft placeholders block release) → CAD-IMP proposal IMP-TBD-0041. ECR-2026-0019 (from NCR-TBD-0044, recall RCL-2026-001) proposes the bushing seal change; ECO-2026-0008 carries the LLR-2026-0011 commercial decision on PO-TBD-0377. Every hop is a link in the DocumentFlowPanel.

## Extra routes (sub-pages, all under a registry path)

`/engineering/change-requests/new` (raise ECR wizard), `/engineering/mbom-transform/new[/:ebomId]` (transform wizard), `/engineering/transmittals/new` (send wizard, `?er=` / `?doc=`). Any page takes `?state=loading|empty|error` (the "State preview" control) to show its non-live states.

## Readings (PRD silent; shown on screen)

| # | Reading | Where shown |
|---|---|---|
| R-HOME-1 | Withdrawn: the 14-day placeholder aging threshold is the PRD's own rule ("placeholder parts older than 14 days" [DOC:p.58 §1]), not a reading. "Approve from the list" [DOC:p.255]: each row in "Awaiting my approval" opens that request in WF-INBOX (`/approvals?req=`), because approvals are decided only in the shared engine (C-1) | ENG-HOME-001 |
| R-ER-1 | An auto-created request opens as New Design; the PRD does not say who picks the design type, so the Engineering Manager sets it (Set design type) while the request is Open or In Design and has no EBOM | ENG-REQ-001 design chip |
| R-ER-2 | Repeat reuses the base design's Active MBOM for that EBOM revision (and refuses if none); the request goes straight to Closed and `engineering.mbomActivated` is sent for the order | ENG-REQ-001 dialog |
| R-ECR-4 | CCB decision rule (the PRD lists members and says votes are recorded): Approve needs every member; any Reject rejects; any Defer defers | ECR CCB tab design chip |
| R-ECR-5 | Date effectivity in the future: Release approves now and the ECO waits as "Awaiting effectivity"; the cutover (EBOM, drawings, staged MBOMs, production versions) runs on the date. The prototype clock is fixed, so "Run cutover" stands in for the date job | ECO detail design chip |
| R-ECR-6 | The role catalog has no Production Manager; the Production supervisor casts that CCB vote | ECR CCB tab design chip |
| R-MBOM-2 | "Production may adjust [scrap %] with Engineering approval": the Engineering Manager approves the changed lines in step 5 (no approval kind in the shared engine); scrap % must be 0 or more and below 100 (no PRD bound; the old 0-50 bound is removed) | MBOM-TRF step 5 design chip |
| R-DOC-1 | EAR flag holders: Ravi Shankar (Engineer), Hiro Tanaka (Engineering Manager), Paul Leblanc (Document control) | ENG-DOC-001 design chip |
| R-DOC-2 | Virus scan is simulated: a file name containing "EICAR" is the test signature and is refused | Check-in dialog design chip |
| R-DOC-3 | Restricted documents are not offered on transmittals because customers hold no EAR flag (the PRD states visibility, not a transmittal rule) | TR-001 rules |
| R-CAD-1 | Vault event delivery states Delivered, Retrying, Failed, Queued; vault-rule failures stay Failed on replay, transport failures deliver | CAD-SYNC OQ-21 chip |
| R-ECR-1 | ECR stage text Draft, Submitted to CCB, Approved, Rejected, Deferred; ECO stage Open, Awaiting effectivity, Released (no list in the PRD, OQ-21) | ECR/ECO stage text + OQ-21 chip |
| R-ECR-2 | Raising the "ECR (CCB)" request moves the ECR to Submitted to CCB; CCB Defer is recorded on the ECR by the Engineering Manager because WF-INBOX has Approve / Reject only | ECR detail |
| R-ECR-3 | ECR impact (open WOs, stock, POs) is a seeded snapshot until other groups publish where-used queries | ECR Impact tab design chip |
| R-MBOM-1 | Manufacturing additions (skid, crates, desiccant, weld wire, paint, oil top-up) and their quantities are design values | MBOM-TRF step 3 design chip |
| R-RTG-1 | Routing headers mirrored in `data/reference.ts` until planning-production exports routings | MBOM / PV design chip |
| R-TR-1 | Transmittal state is text (Not sent, Awaiting response, response word) | TR-001 OQ-21 chip |

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *R-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
| R-1 | src/data/domain/entities.ts | EngineeringRequest.designType words to New Design / Variant of Existing / Repeat [DOC:p.59 §2]; ControlledDocument type codes and security classes Internal / Customer-Shareable / Restricted [DOC:p.64 §5.1] | ENG-REQ-001, ENG-DOC-001/2 (worked around by intersection types in data/types.ts) | open |
| R-3 | planning-production index | Export routing headers + operations so MBOM-TRF and PV-001 stop using the mirror in data/reference.ts | MBOM-TRF, PV-001 | open |
| R-6 | src/store/events.ts + sales slice | Catalog entry `engineering.designApproved {engineeringRequestId, soId, transmittalId, response}`, and a Sales subscriber that sets the Design Approval milestone on the SO ("customer approval evidence on the ETO order" [DOC:p.258]) | TR-001, FL-02 | open (emitted; module-only augmentation in data/slice.ts; no consumer yet) |
| R-7 | src/store/core.ts / WF-INBOX | A Defer outcome for "ECR (CCB)" approvals [DOC:p.62 §4.1] | ENG-ECR/ECO | open (recorded on the ECR for now) |
| R-8 | production, inventory, purchasing indexes | Where-used queries (open WOs, stock, open POs by item) for the ECR impact panel | ENG-ECR/ECO | open (seeded snapshot) |
| R-9 | src/data/shared/spine.ts + other groups' seeds | Rename the seeded engineering IDs to the specification formats ER-{YYYY}-{SEQ:4}, EBOM-{SEQ:5}, DOC-{TYPE}-{SEQ:5}, TR-{SEQ} [DOC:p.59; p.60; p.64]. Records created live and every engineering-only seed record already use them; the nine spine-referenced IDs (ER-TBD-0301, -0352, -0366, -0377; EBOM-TBD-0244, -0301, -0377; DOC-TBD-0301-GA; TR-TBD-0301) keep the TBD IDs because the spine and other groups' seeds reference them | ENG-REQ-001, ENG-BOM-002, ENG-DOC-001/2, TR-001 | open |
| R-10 | src/data/domain/approvals.ts + roles.ts | "ECR (CCB)" route = Engineering Manager + Quality Manager + Production Manager (+ Controller above $10k), replacing the reading "CCB membership is not listed" [DOC:p.62 §4.1]; add the Production Manager role. Until then QM and Production supervisor votes are recorded on the ECR | ENG-ECR/ECO | open |
| R-11 | src/store/events.ts; planning-production, materials, purchasing-finance slices | Catalog entries for `engineering.woHoldRequested {ecoId, woIds}` and `engineering.ecoCutover {...}` and consumers: Production puts open WOs On Hold (Immediate), adds change tasks / pick-list deltas (Incorporate Change), raises RWOs (Rework, Stop & Rework); Inventory posts 5320 scrap and runs the Use-Up watch; Purchasing raises RTVs; Materials applies MCH rows, supersessions and the Production Block (Book II §6.2 ECOReleased); Planning/Quality release routing and inspection-plan revisions with the cutover [DOC:p.62 §4.2; p.63 §4.5] | ENG-ECR/ECO | open (emitted; hand-offs listed on the ECO) |
| R-12 | src/data/domain/entities.ts + spine.ts | Transmittal response words Approved / Approved as Noted / Revise & Resubmit [DOC:p.64 §5.2] (shared type and the spine note say "Approved as noted" / "Revise and resubmit") | TR-001 | open (overridden in data/types.ts) |
