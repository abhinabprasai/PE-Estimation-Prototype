# Module group: materials

> **What this is.** The owner's guide for `src/modules/materials/`. Materials and inventory: the PRD's Materials module (10) and the Book VII inventory entries INV-RETURN, INV-ITEM-SALES, INV-COUNT-DOC, INV-PLAN-SAFETY.
>
> **Where it stands.** Module pass, 11 October 2026. All 13 buildable screens are built and claimed "full" in `routes.tsx`; INV-RETURN stays the shell's redirect to /sales/rma. Type-check is clean for this folder.
>
> **What we need from you.** Build the screens below inside this folder only. Anything you need outside it goes under "Requests to foundation" at the end.

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates` in the running app.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Built |
|---|---|---|---|---|---|---|
| MM-MAT-001 | Material Listing | `/inventory/items` | List | W2 | - | full |
| INV 2.3 + MM views | Material Detail (ten views) | `/inventory/items/:id` | Detail | W2 | - | full |
| MM-MCR-001/2 | Material Creation Requests | `/materials/creation-requests, /materials/creation-requests/:id` | Workbench | W2 | FL-10, FL-03 | full |
| MM-MCH-001 | Material Change Requests | `/materials/change-requests` | Wizard | W2 | - | full |
| MM-SUP-001 | Supersessions | `/materials/supersessions` | Detail | W6 | - | full |
| MM-IR-001/2 | Purchasing Info Records | `/purchasing/info-records, /purchasing/info-records/:id` | List | W6 | FL-03 | full |
| MM-SL-001 | Source Lists | `/purchasing/source-lists` | Detail | W6 | FL-03 | full |
| MM-VAL-001 | Account Determination Workbench | `/materials/account-determination` | Config | W1 | FL-01, FL-02, FL-03, FL-04, FL-05, FL-06, FL-09 | full |
| MM-EOR-001 | Excess and Obsolete Reserve Run | `/materials/eo-reserve` | Wizard | W6 | FL-06 | full |
| MM-DQ-001 | Data Quality Dashboard | `/materials/data-quality` | Dashboard | W7 | - | full |
| INV-RETURN | Return (redirect) | `/inventory/returns (design value)` | List (design value) | W5 | FL-05 | redirect (ships no screen) |
| INV-ITEM-SALES | Item sales tab | `/inventory/items/:id/sales` (PRD: /inventory/items/{id} Sales view) | Detail | W2 | - | full |
| INV-COUNT-DOC | Count documents (INV-COUNT-DOC-001 / -002) | `/inventory/counting/count-documents, .../:id` (old `/inventory/counts` redirects) | List + detail + mobile entry | W2 | FL-06 | full |
| INV-PLAN-SAFETY | Safety stock (INV-PLAN-SAFETY-001) | `/inventory/planning/safety-stock` (old `/inventory/safety-stock` redirects) | Config grid | W2 | - | full |

Source: reference tables A [DOC:pp.245-282] and Book VII [DOC:pp.280-281] (asserted); routes and archetypes marked "design value" are not in the specification.

## State

Slice key `materials`. `materials` (MaterialsState in data/slice.ts): MCRs, MCHs, supersessions, info records, source lists, account determination rows, count documents, E&O runs, plant data, valuations. The material master itself is shared (src/data/shared/materials.ts); keep module edits in your slice and resolve by ID.

## Spine documents to seed

Seed these in `data/slice.ts` with exactly these IDs and statuses (headers in `src/data/shared/spine.ts`):

| ID | Type | Status | Title |
|---|---|---|---|
| MCR-TBD-0301 | mcr | - | Create RAW-TBD-OLTC (17-position OLTC) |
| RAW-TBD-OLTC | material | Active | On-load tap changer, 115 kV class, 17 positions |
| GRN-TBD-0301 | grn | - | Goods receipt, HV bushings (INV) |

## Cross-module events

- Emits: `materials.materialActivated` (MCR done), `materials.stockStatusChanged`.
- Consumes: `engineering.placeholderNeeded` (opens an MCR), `purchasing.grnPosted`, `quality.inspectionClosed` (QI Hold to Unrestricted).

Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder (see APP-ARCHITECTURE.md).

## Notes

- C-47: materials are created only through an MCR; there is no "create material" form.
- INV-RETURN ships no screen: the shell already redirects /inventory/returns to /sales/rma. Claim it only if that changes.

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *R-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
| R-1 | src/data/domain/status.ts | Add an info-record status row: Active, Expired, Blocked [Book II §7.2] | MM-IR-001/2 shows a FamilyBadge until then (RD-MM-09) | open |
| R-2 | src/data/domain/docflow.ts | Add DocTypes `mch`, `supersession`, `countDocument`, `safetyStockChange` (and `infoRecord`) with routes `/materials/change-requests?mch=`, `/materials/supersessions?id=`, `/inventory/counts/`, `/inventory/safety-stock`, `/purchasing/info-records/` | Approvals from MM-MCH-001, MM-SUP-001, INV-COUNT-DOC and INV-PLAN-SAFETY use subject `{type: "material", id: <record id>}` as a workaround, so the WF-INBOX subject link opens /inventory/items/<id> instead of the record; supersession and count pages show the material's document flow instead of their own | open |
| R-3 | src/data/domain/approvals.ts | Add ApprovalKind "Manual info record price" routed to the Purchasing Manager [DOC:p.247] | MM-IR-001/2: a manual price row above 5% delta is saved as pending and cannot be approved until this kind exists (C-1 forbids a local approve button); meanwhile the buyer can withdraw the pending row | open |
| R-4 | src/data/domain/entities.ts | Make `AcctDeterminationRow.valuationClass` optional (key-only fallback rows, Book II §5.2) | MM-VAL-001 relaxes it locally in data/types.ts | open |
| R-5 | src/components/patterns/PostingPreview.tsx | Accept `OTHER_POSTINGS` keys (eoReserve, grn) and a count-adjustment line in addition to #17-#38 | MM-EOR-001 and INV-COUNT-DOC use a local TextPostingPreview with the same layout | open |
| R-6 | src/store/events.ts | Add lines (materialId, qty) to the `purchasing.grnPosted` payload | The materials slice resolves the material only for the spine POs; other GRNs are listed as unresolved (RD-MM-17) | open |
| R-8 | src/data/domain/approvals.ts (+ roles.ts) | "Count variance": Finance step (Finance Manager role, or name the stand-in), a class-A trigger in ApprovalContext, and a third Controller step when the document NET variance exceeds $25,000 [DOC:p.37 §7.5] | INV-COUNT-DOC computes the PRD ladder (lib/rules.ts countLadder) and shows it; the engine gives only supervisor + Controller (RD-MM-14) | open |
| R-9 | src/data/screens.ts:159-160 | INV-COUNT-DOC path `/inventory/counting/count-documents` (+ `/:id`), archetype "List + detail + mobile entry", IDs INV-COUNT-DOC-001/-002; INV-PLAN-SAFETY path `/inventory/planning/safety-stock`, archetype "Config grid" (users: Planners edit, Planning Manager approves large deltas) [Book VII p.280-281; DOC:p.36, p.43] | Old registry paths redirect to the PRD routes until then | open |
| R-10 | src/data/domain/approvals.ts | "Below price floor" from the item sales tab: a customer-price row needs the Controller (not only the Pricing Manager) [DOC:p.29 §4.3] | INV-ITEM-SALES (RD-MM-13) | open |
| R-11 | src/data/domain/approvals.ts | "Material change" for Sellable ON on a default-OFF type: Sales admin then Materials Manager [DOC:p.147 §3.12, p.151 §4.4] | MM-MCH-001 (RD-MM-28) | open |
| R-12 | src/data/domain/status.ts | Status rows for sales price-list assignment (Draft / Active / Expired) and customer price (Draft / Pending Approval / Active / Expired) [DOC:p.29 §4.2-4.3] | INV-ITEM-SALES shows family badges until then | open |
| R-7 | src/data/domain/docflow.ts | Route DocType `grn` to the material stock view (`/inventory/items/<material>?tab=stock&grn=<id>`) or a GRN page, instead of the traceability explorer | GRN-TBD-0301 in the hero thread lands on the explorer rather than the receipt | open |


## Readings (PRD-silent choices shown on screen)

Each is shown as a "Reading RD-MM-nn" chip where it applies; the text is in `lib/rules.ts` READINGS.

| ID | Choice |
|---|---|
| RD-MM-01 | Warehouse Manager is not a role; the MCR Warehouse task goes to the Warehouse supervisor. |
| RD-MM-02 | SPARE uses the TRADE column and NSTK the SERV column of the MCR task matrix. |
| RD-MM-03 | TRADE Quality task (matrix says Config) is included only when QI at receipt is ON. |
| RD-MM-04 | Engineering placeholders are created in Data Completion (p.150 says Draft; p.149 and p.156 allow only Data Completion). |
| RD-MM-05 | The placeholder event carries no type; a RAW number is reserved. |
| RD-MM-06 | Identifier formats MCR-TBD-nnnn and IRC-nnnnnn (IR- is taken by invoice requests). |
| RD-MM-07 | A supersession is sent for approval only when the successor is Active. |
| RD-MM-08 | Lifecycle changes Active to Restricted or Blocked and back are pressed by the Materials Manager. |
| RD-MM-09 | Info record status shown with a family badge until a catalog row exists (R-1). |
| RD-MM-10 | E&O reserve percentages per type and bucket are design values. |
| RD-MM-11 | Step-up MFA on matrix release is an attestation checkbox. |
| RD-MM-12 | Inventory Admin is not a role; the Warehouse supervisor stands in beside the Planner for safety stock. |
| RD-MM-13 | Item sales tab approvals through the shared kinds; Controller step on below-floor customer prices waits for R-10; row statuses as family badges; margin floor from table F. |
| RD-MM-14 | Count ladder computed per §7.5 and shown; the engine's Controller step stands in for the Finance Manager (and the third approval in the Controller band) until R-8; ABC from the Planning view, none = class A tolerance. |
| RD-MM-15 | Counter and Count Supervisor are not roles; Warehouse operator counts, Warehouse supervisor supervises. |
| RD-MM-16 | Completeness uses a subset of each view's mandatory fields (Section 18 not extracted). |
| RD-MM-17 | GRN events without lines resolve the material only for the spine POs (R-6). |
| RD-MM-18 | Run-out progress is predecessor stock against stock at approval. |
| RD-MM-19 | Third count (R-CNT-03) keeps the document in Recount; entered by the supervisor with a named finance witness. |
| RD-MM-20 | Inventory freeze keyed by warehouse and bin; Soft Freeze ON posts and flags Moved During Count, OFF refuses with E-CNT-01. Event-driven receipts already posted upstream are flagged or listed as an exception. |
| RD-MM-21 | E&O aging from last consumption. |
| RD-MM-22 | Suggested SS / Service Level reserved empty (Phase 2); multiplier edits use the same 25% test month by month; over-buffered from the 12-month breach count. |
| RD-MM-23 | Rejected / Deleted have no status row (K-16): the material leaves the lists, history kept. |
| RD-MM-24 | My Materials = acting user is steward, buyer or planner. |
| RD-MM-25 | Counter sees own documents only in Counting / Recount; supervisor assigns the recounter. |
| RD-MM-26 | Generate Count Sheets: one document per warehouse zone (bin's first letter). |
| RD-MM-27 | SLA escalation manager per role. |
| RD-MM-28 | Sellable ON on a default-OFF type runs as a Class 2 MCH; Sales admin step waits for R-11. |
| RD-MM-29 | Simulation dimensions per Part H §3 rules 2-4; warehouse cost center from the shared master. |
| RD-MM-30 | Supersession worklist generated from the predecessor's where-used references. |

Other design values on screen: the empty and error states are previewed with the "Live data / Preview" selector on each list (the prototype has no backend that can fail).

## Hero thread through this module

SO-2026-00301 (sales) -> ER-TBD-0301 -> EBOM-TBD-0301 -> **MCR-TBD-0301** (`/materials/creation-requests/MCR-TBD-0301`, Activated) -> **RAW-TBD-OLTC** (`/inventory/items/RAW-TBD-OLTC`, Active; info record IRC-004206 from RFQ-TBD-0301; source list row VEN-TBD-0103) -> PO-TBD-0301 -> GRN-TBD-0298. HV bushings: PO-TBD-0302 -> **GRN-TBD-0301** (`/inventory/items/RAW-TBD-BSH145?tab=stock&grn=GRN-TBD-0301`, batch BAT-TBD-B0301, six serials Blocked by RCL-2026-001 and pegged to SO-2026-00377) -> SUP-2026-0014 (Draft, to RAW-TBD-BSH145B from MCR-TBD-0377). The 20 MVA unit's item sales tab (`/inventory/items/FIN-TBD-20MVA/sales`) lists SO-2026-00301 and SO-2026-00377.

## Role gates used (ASM-PERM-1: only where a rule names the role)

MCR tasks: the owning role per the task matrix; activation and reject-to-task: Materials Manager. Blocks: the role named per block (§4.5). Supersession create and close: Materials Manager. Info records: Buyer or Purchasing Manager; source lists: Purchasing Manager. Matrix drafts: Controller or Cost accountant; release: Controller. E&O run: Controller. Counts: Warehouse operator or supervisor count, supervisor assigns, voids, routes, rejects and posts. Safety stock: Planner or Warehouse supervisor (RD-MM-12).
