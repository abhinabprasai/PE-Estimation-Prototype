# Build notes: FL-09 throwaway prototype

> **What this is.** A record of how the throwaway FL-09 prototype (sales order to delivery) was built from `prompt-used.md`. It covers where the build differs from the prompt and which prompt part each difference comes from, what was left rough on purpose, and how to run it.
>
> **Where it stands.** Built on 9 October 2026 by prototype-engineer, inside the 1-day timebox. The walked path in prompt part 2 was completed end to end against the real store actions. Waiting for Gate 1. On 11 October 2026 the full-PRD foundation was laid under it (section "Foundation" below); FL-09 still passes the same walked path.
>
> **What we need from you.** At Gate 1, open the build and say where it is wrong. The deltas below are the places most likely to produce corrections.

Version: 1 · Author: prototype-engineer · Date: 2026-10-09 · Status: built, awaiting Gate 1
Prompt: `prompt-used.md` (byte-identical copy of `30-design-language/prompts/prototype-FL-09.md` v1)

## How to run

```
cd workspace/pe-v2/50-prototype/app && npm install && npm run dev
```

Opens on http://localhost:5174 (pinned in `vite.config.ts`, because another local project uses 5173). `npm run build` passes with zero TypeScript errors. The data lives in memory only. **Scenario reset** in the header restores the seed, and a browser reload does the same.

**Gate framing, said out loud:** "This is disposable. I built it to be wrong in a useful way. Tell me where it is wrong."

## Routes

| Screen | Route |
|---|---|
| OM-QT-001/2 Quotations | `/sales/quotations`, `/sales/quotations/:id` (start: `/sales/quotations/QT-TBD-0412-V2`, also `/`) |
| OM-SO-001/2 Sales orders | `/sales/orders`, `/sales/orders/:id`, `/sales/orders/new` |
| CTP-DLG | `/sales/orders/SO-2026-00402?ctp=1` |
| WF-INBOX | `/approvals` |
| OM-DLV-001 Delivery cockpit | `/sales/deliveries` (side panel: `?d=DLV-TBD-nnnn`) |
| OM-PACK queue and station | `/sales/packing`, `/sales/packing/station/:id` (station route is a placeholder; prompt 6.2) |
| OM-POD-001/2 | `/sales/pod`, `/sales/pod/:id` |

## Walked path: verified

The path was verified by running every step of the part 2 table through the store's own actions (a throwaway script, since deleted), and by rendering each route in a browser with no console errors.

| Step | Result |
|---|---|
| 1-2 | QT-TBD-0412-V2 Issued → Won. Converted to **SO-2026-00412** in Draft. Lines and schedules are Open, and prices are frozen with Price Source = Quotation. |
| 3 | Submit without a PO is refused (R-7). With a PO, the order goes Draft → Submitted → Credit Hold, and available credit shows **−$13,350.00**. |
| 4 | Sales admin cannot release. Finance (credit) releases the hold: Credit Hold → Confirmed. Delegate is absent because $277,050 is over $250,000. |
| 5 | ATP partial dialog, Split. Line 10 schedule 10 (qty 2) goes to Allocated/Pegged. Line 10 schedule 20 (qty 1) is Confirmed for 2026-10-30 with the Backorder flag. Line 20 schedule 10 goes to Allocated/Pegged. |
| 6-7 | DLV-TBD-0071 is created at Planned, grouped by "Split, elective: schedules more than 7 days apart". It moves Released → Picking. The order goes to In Fulfillment and its lines to Ready to Ship. |
| 8 | HU-TBD-0203/0204/0205 each take one serial. The third HU's first reading of 4,420 kg (+2.6%) is refused (error 2). The re-weigh closes it, and the pack order completes as Packed. |
| 9-10 | Quality Cleared. Load plan saved: Great Plains Heavy Haul, PRO 7731-0092, 3 days, $3,450.00. A scan of a foreign HU is refused with E-BC-08. All three HUs are loaded, so the delivery is Loaded. |
| 11 | PGI posts PGI-TBD-0071 with #25 at $155,040.00 and #26 at $3,450.00. HUs and serials move to Shipped. Line 10 is Partially Shipped and line 20 Shipped, so the order is Partially Shipped. POD-TBD-0071 is created at Expected for 2026-10-12, and IR-TBD-0144 is created. |
| 12 | POD recorded with no damage: POD Received, delivery **Delivered/Closed**. The backordered schedule 20 is still Confirmed. |

**Error states verified:**
1. PGI on DLV-TBD-0088 fails and stays Loaded.
2. HU weight outside ±2% is refused.
3. A load scan of an HU not on the shipment is refused with E-BC-08.
4. Submitting SO-2026-00415 is refused with E-OM-02 (customer On Hold).
5. Reversal is refused on DLV-TBD-0059 (period 2026-09) and on DLV-TBD-0066 (invoice posted). DLV-TBD-0064 reverses inside the window and returns to Packed.

**Seed check:** every status in part 3 is present on at least one record. Volumes are 24 quotations, 40 orders, 30 deliveries, 8 pack orders once the walked delivery reaches Picking, 16 POD rows, and 6 inbox items after step 3.

## Deltas (traced to the prompt part)

| # | What the build does | Why | Prompt part |
|---|---|---|---|
| D-1 | SO-2026-00398 reaches exactly $250,000.00 with one FIN-TBD-5000SS line priced $250,000.00, tagged "Price list". | No combination of the seed's list prices adds up to exactly $250,000.00, so this price differs from the product table ($186,300.00). | 5.4 boundaries |
| D-2 | The credit check at quote-to-order conversion fails on the walked order, but the order stays Draft. The result is logged with a Reading OQ-32 note. | R-1 says a failure sets Credit Hold, but part 3 has no Draft → Credit Hold transition. | 4 R-1 vs 3 |
| D-3 | The shipment-release credit gate passes the walked delivery because Finance released the hold. Exposure is still above the limit. | R-1 calls shipment release the final gate. Re-running the arithmetic would block the path for good. | 4 R-1, 2 step 7 |
| D-4 | The delivery creation horizon is 7 days. This is a design value, shown on screen. | The horizon length is not stated. | 2 step 6 |
| D-5 | The documents readiness flag passes when a carrier and a PRO/BOL # are recorded (Reading OQ-32 chip). | The trigger for the documents flag is not stated. | 3, 4 R-12 |
| D-6 | The converted order's requested ship date is 2026-10-12. | The seed gives the quotation no date. | 5.4 walked records |
| D-7 | Serials go Available → Reserved at ATP allocation in step 5. | The prompt only says "Reserved before PGI". | 5.4 |
| D-8 | PGI reversal also sets schedules to Delivery Due, lines to Ready to Ship and the order to In Fulfillment, and removes the Expected POD row. The delivery goes to Packed while its HUs stay Loaded, as written. | R-16 does not say what happens to schedules, lines, the order or the POD. | 4 R-16 |
| D-9 | Resolving a claim moves the POD Exception → Resolved/Closed and the delivery PGI → Delivered/Closed (OQ-32). A POD at Exception leaves the delivery at PGI. | The delivery transition on a claim is not stated. | 3 POD, Delivery |
| D-10 | "Simulate invoice posted" sets lines to Invoiced and schedules Delivered → Closed (OQ-32). | Not stated. | 6.3 |
| D-11 | The CTP dialog's two alternatives (2026-12-04 and 2027-01-08) are design values. | Part 6.2 asks for "two alternatives" without giving their content. | 6.2 #4 |
| D-12 | Error 4 is shown on a seeded Draft order, SO-2026-00415, whose customer is now On Hold. | The picker disables non-Active customers (R-6), so no other route reaches E-OM-02. | 2 errors, 4 R-6 |
| D-13 | The inbox has 5 pending items plus 1 decided history entry in the seed. The walked submit makes 6 pending. | Count reading. | 5.4 volume |
| D-14 | Pack orders show the delivery's status, with no badge of their own. The packing empty state appears when filtering to WH-TBD-03. | The entity model has no pack-order status list. | 3, 2 empty states |
| D-15 | The sidebar's "seven entries" are counted as 6 Sales entries (one is a link to the CTP order) plus Approvals inbox. | Part 6.2 lists 7 screens, and one of them is a dialog. | 6.2 app shell |
| D-16 | The $250,000 threshold compares the raw amount, with no currency conversion (CA$312,480 counts as above). | FX handling is not stated. | 4 R-4, R-5 |
| D-17 | After submit, customer exposure includes the walked order, which is what makes −$13,350.00 visible. The seeded Credit Hold orders do not have their value added to exposure, so the seed is slightly inconsistent. | Seed shortcut. | 5.4 |
| D-18 | Roles gate Release and Reject (Finance (credit)), Raise limit (Controller), R-OM-02 Approve and Reject (Sales Director), Reverse PGI (Shipping Manager) and Reopen (Controller). Nothing else is gated. | Done as written. | 6.3 |

## Left rough on purpose (6.1)

- No visual polish. The sidebar sits under the banner, colours and spacing are untuned, the shadcn Card ring is still there, and there is no dark-theme work.
- L-4 is broken in the inbox: each row has a filled Release or Approve button.
- The kiosk has no badge login, the "Online" marker never changes, and focus lock works by refocusing on blur.
- One 600 kB bundle and no responsive layout below 1280 px.

## Setup notes

- Stack: Vite 8.3.4, React 19.3.0, TypeScript 6.0.3, Tailwind 4.3.3 (`@tailwindcss/vite`), shadcn 4.21.4 (radix-nova style), react-router 8.4.0. Versions are pinned exactly in `package.json`, and `node_modules` stays inside `app/`.
- `shadcn init` wired the components to a third-party `cn` npm package. It was replaced with the standard `clsx` + `tailwind-merge` helper in `src/lib/utils.ts`, and the `cn` package was uninstalled.
- The tokens from `tokens.md` section 6 are pasted into `src/index.css`, with the `@theme inline` block expanded to one line per `--status-*` token. `badgeVariants` gained the seven families from color.md section 4.
- `50-prototype/_PLACEHOLDER.md` is left in place for the orchestrator to remove.

## Foundation (full-PRD build, 11 October 2026)

The user chose a full-PRD prototype that is kept as a deliverable (PROJECT_CONFIG "Prototype scope decision", STATE.md "Prototype (Phase 2A)"). This pass lays the shared foundation so six module agents can build in parallel, each inside its own folder. It adds no module screens beyond placeholders. The contract for module agents is `50-prototype/APP-ARCHITECTURE.md`.

**What was built**

| Area | Where | What |
|---|---|---|
| Restructure | `src/modules/<group>/` | Seven groups: sales, materials, engineering, planning-production, quality-trace, purchasing-finance, admin. Each has `index.ts(x)`, `routes.tsx`, `pages/`, `data/slice.ts` and `README.md`. The FL-09 code moved to `modules/sales/` with its action bodies unchanged |
| Domain model | `src/data/domain/` | Types for every entity E-1..E-44 plus link records owned by INV/ACC; status unions for S-1..S-43, verbatim, with family, main path and exits; template-literal typed IDs; `DocRef` / `DocLink` with 25 link kinds; posting templates #17..#38; scan points SP-01..SP-21; trace events T01..T13; the approval routing of table F; 41 roles in 10 groups |
| Seed spine | `src/data/shared/` | 4 legal entities, 1 plant, 3 warehouses, 20 cost centers, 5 profit centers, WC-050..WC-700 (14), fiscal periods, 44 users covering every role, 13 customers (US and Canada, same IDs as FL-09), 16 vendors + 10 AVL rows, 39 materials across all 9 types. Hero thread: 46 spine documents and 54 links (see below) |
| Store | `src/store/` | One root store composing module slices (registered from each folder; state typed by `SliceStates` augmentation), atomic `mutate` (the FL-09 R-13 behaviour, now for every slice), a typed event bus that fires after commit, runtime document links, and the shared approval engine (C-1) with sequential steps, a reject reason and two distinct users |
| Shared components | `src/components/patterns/`, `templates/` | StatusBadge (7 families, icon + word, unknown words flagged), LifecycleStrip (main path, then exits: fixes F-02), DataTable, DocumentFlowPanel, ApprovalButton, PostingPreview, ScanField (fixes F-01), chips; one template per archetype: ListPage, DetailPage, WorkbenchPage, WizardPage, KioskPage, DashboardPage, ConfigPage, DialogShell. Added shadcn: dropdown-menu, popover, command, calendar, progress, accordion, scroll-area, toggle, toggle-group, breadcrumb, chart, switch, radio-group, alert-dialog, hover-card, input-group |
| App shell | `src/app/` | Sidebar generated from the registry: 7 groups, 14 PRD module sections (13 Book VI + Book VII), every screen with a built marker; "Acting as" over all roles, grouped; global search (Ctrl K) over module documents, spine headers, master data and screens; Scenario reset with confirmation |
| Registry | `src/data/screens.ts` | 84 entries: id, title, route, archetype, module, group, wave, flows, users, postings, built. Every unclaimed route renders "Not built yet: <ID> <title>, wave Wn"; INV-RETURN redirects to `/sales/rma`. `/coverage` counts built and unbuilt per module, flow, group and wave |
| WF-INBOX | `src/modules/admin/pages/WorkflowInbox.tsx` | The shared engine's queue (Waiting for me / All open / Decided), with a decide panel and no filled buttons on rows (fixes F-03 for this queue). The FL-09 credit and R-OM-02 queue shows below it, unchanged |
| Gallery | `/dev/templates`, `/dev/kiosk` | Live examples of every template and pattern on hero-thread data. Not a PRD screen |

**Hero thread.** Midland Plains Grid Constructors (CUS-TBD-0048) buys 20 MVA ETO units (FIN-TBD-20MVA) for the Omaha North substation. Phase 1, SO-2026-00301, carries the whole spine: LEAD-TBD-0301 → OPP → CE-TBD-0301 → QT-TBD-0301-V1/V2 → SO → ER-TBD-0301 → DOC / TR / EBOM-TBD-0301 → MBOM → PV; MCR-TBD-0301 → RAW-TBD-OLTC; LLR-2026-0004, STP-000301 → PR-TBD-0301 → RFQ-TBD-0301 → PO-TBD-0301/0302 → GRN-TBD-0301 → BAT-TBD-B0301 → WO-TBD-0301 → SN-TBD-20M-0301 → IL-TBD-0302 final test → DLV-TBD-0031 → POD-TBD-0031 / IR-TBD-0031 → IB-TBD-0301 → RMA-TBD-0012 → NCR-TBD-0044 → SCAR-TBD-0009 / CAPA-TBD-0015 → RCL-2026-001 (Contain) → RWO-TBD-0012. Phase 2 is the FL-09 seed's SO-2026-00377: ER-TBD-0377 (In Design), EBOM-TBD-0377 (Draft), LLR-2026-0011 and PO-TBD-0377 waiting in WF-INBOX, and PLO-TBD-0377. The recall's 6 blocked bushings are reserved for phase 2, so the recall reaches back into an open order. Each header names the group that seeds its full record.

**Verified.** `npm run build` passes with zero TypeScript errors (oxlint: warnings only, no errors). The FL-09 walked path was re-run through the moved store actions in the browser: same results as the table above (SO-2026-00412, Credit Hold, Finance release, ATP split, DLV-TBD-0071, HU-TBD-0203..0205 with the 2.6% refusal, E-BC-08, PGI-TBD-0071, order Partially Shipped, POD to Delivered/Closed). The PGI and POD now also emit `sales.pgiPosted`, `posting.posted` (#25, #26) and `sales.podRecorded`. Every placeholder route sampled renders, `/inventory/returns` redirects, the shared engine routes LLR-2026-0011 through Engineering Manager, Purchasing Manager and Controller in sequence and refuses a reject with no reason, and no console errors appear on a fresh load.

**Deltas in the foundation (all design values unless cited)**

| # | What | Why |
|---|---|---|
| F-D1 | FL-09 badges and lifecycle strips now come from the shared catalog. The strip shows the main path, then the exits apart from it | Fixes critique F-02. Statuses and families are unchanged |
| F-D2 | The FL-09 `Role` type is now the app-wide union; "Acting as" lists every PRD role, grouped | Prompt: role switcher over all PRD roles. The FL-09 role checks are unchanged |
| F-D3 | `TODAY` (2026-10-09) and `OPEN_PERIOD` (2026-10) moved to `src/data/shared/org.ts`; FL-09 re-exports them | One clock for every module |
| F-D4 | Scenario reset now uses an AlertDialog instead of `window.confirm`, and resets every slice | Shell is shared |
| F-D5 | Legal entity, plant, warehouse and user IDs use `TBD` placeholders (OQ-30). Cost centers, profit centers and work centers keep the specification's codes | Spec gives codes for CC, PC and WC only |
| F-D6 | Warranty claim badge values (S-10) all map to F7 | status-encoding-input F7-4 |
| F-D7 | Approvers that table F leaves unstated are routed with a visible "Routing reading": RMA $10k to $50k → CS Manager; count $10k to $25k → supervisor + Controller; price change → Pricing Manager; price list → Pricing Manager; MCH → Materials Manager; ECR CCB → Engineering Manager. Credit release goes to Finance (credit), as in FL-09, although table F names the Controller | Shown on the ApprovalButton popover and in the inbox panel |
| F-D8 | Routes the specification does not give are design values, flagged in the registry and on the placeholder: RMA-RECEIPT, MBOM-TRF, CAD-IMP, QM-EXEC, PRC-SIM and the five Book VII entries without a route | Reference table A says "not extracted" or names no path |
| F-D9 | Archetypes for entries that say "not extracted" are design values: ENG-ECR/ECO List, CST-RATE-001 Config, PRC-MARG Dashboard, CO-R1..R4 Dashboard, TRC-EXPL Workbench, OPS-JOBS/INT Workbench, CFG-CORE Config, PP-WIP-001 Workbench, and the Book VII entries | Same |
| F-D10 | The pack station still refocuses on blur (F-01) because it keeps its FL-09 layout. `KioskPage` + `ScanField` fix the pattern for every new kiosk screen; the sales agent should move the station onto them | Foundation adds no module screens |

**Left for module agents.** 77 unbuilt entries, and full records for the 46 spine headers (each README lists its own). FL-09's approvals still use its own queue until moved onto the shared engine. The single 755 kB bundle has no code splitting yet.

---

**Key.** **OQ-nn** a reading held in `10-discovery/open-questions.md` · **K-nn** a contradiction in `STATE.md` · **R-n** a rule row in part 4 of the prompt · **PGI** post goods issue · **POD** proof of delivery · **HU** handling unit · **ATP / CTP** available / capable to promise.

## Integration (13 October 2026)

Integrator pass over all ten module groups. `npm run build` passes (tsc -b and vite build, 3,106 modules); `npm run dev` boots (HTTP 200) and was stopped. The bundle is one 5.9 MB chunk (warning only; code-splitting is not done on purpose for a prototype).

**Registry.** 285 entries (84 PRD plus 201 feature list). Checked by loading the module registry and comparing every `built` claim to the registry: 284 claimed, 1 unclaimed, which is INV-RETURN (a redirect from /inventory/returns to /sales/rma, by design). No claim lacks a registry entry. CTP-DLG is claimed twice (planning-production and sales, both "partial"; sales renders the order with the planning Promise Dialog, sales FR-21). No duplicate route paths across modules.

**Hero thread.** All 46 spine documents (SPINE_DOCS) exist in their owner's slice under the spine ID, so the chain lead, quote, SO-2026-00301, ER-TBD-0301, EBOM-TBD-0301, MBOM-TBD-0301, PR/PO, GRN-TBD-0301, WO-TBD-0301, IL-TBD-0302, DLV-TBD-0031, RMA-TBD-0012, RCL-2026-001 carries consistent IDs. Event consumers are registered for: sales.lineNeedsEngineering (engineering), engineering.mbomActivated and ecoReleased (planning, purchasing), planning.plannedOrderConverted (purchasing), production.orderReleased, fgReceived, confirmationPosted, inspectionRequested (quality), production.fgReceived (sales), sales.pgiPosted (quality, purchasing-finance), sales.rmaReceived (quality), quality.recallStageChanged (sales, planning, quality), approval.requested and decided (every owner). Events with no consumer are display feeds read from `store.bus.recent()`, or open requests (see below).

**Seams fixed**
1. core.seq started at 100 and collided with seeded APR-TBD-0101; now 200 (purchasing R-2).
2. Scenario reset wiped approvals raised at start. New optional `afterReset` hook on SliceDef (store/core.ts); sales re-raises seeded RMA approvals and SLA alerts, admin re-seeds the shared W.4 requests. Verified: 18 requests before and after reset, no duplicate IDs (admin R-9).
3. Recall RMAs: sales drafted a hero-unit RMA for any campaign entering Recover. It now reads the campaign's In-field population from quality-trace and drafts for that population only; only RCL-2026-001 falls back to the seeded serials (quality R-5).
4. engineering.designApproved now has a sales consumer: the customer drawing approval is recorded as evidence on the Design Approval milestone and the order. The invoice request is still raised by Finance's trigger action (engineering R-6).
5. quality.reworkRequested now has a planning-production consumer that drafts the RWO (origin = the NCR, kind "Test failure"); quality links it back on production.reworkOrderCreated (quality R-4).
6. `/` redirects to /home (shell R-1). The FL-09 quotation is still at /sales/quotations/QT-TBD-0412-V2.
7. Registry routes for INV-COUNT-DOC, INV-PLAN-SAFETY, INV-CONFIG-PERIOD and INV-CONFIG-TAX changed to the PRD routes (routeSource "doc"); the old paths remain as redirects (materials R-9, admin R-7a).
8. Thirteen approval kinds added to the shared engine with routes: Manual info record price, Valuation change, Consignment true-up, Inspection plan approval, Deviation approval, Recall partial recovery, Final test scrap, Reprint approval, RMA disposition, Warranty extension, Sales change order, Cancellation fee waiver, De-peg. Routes without a PRD source show a `reading`. The kinds exist; the owning screens still record those decisions locally and have not been rewired to ApprovalButton.

**Requests to foundation: disposition**
- Implemented: admin R-9; purchasing R-2; quality R-4 (planning side), R-5; engineering R-6 (consumer); shell R-1; materials R-9; admin R-7a; approval kinds in materials R-3, R-13, R-14, quality R-2 (kinds only), R-11 (kind only), sales FR-9, FR-10, FR-19 (kinds only).
- Module-only events (promotion not needed): events declared by module augmentation already type-check and have their consumers; the catalog promotions (admin R-5, materials R-6 payload lines, planning R-3, quality R-3/R-8/R-13, sales FR-5, FR-13, FR-18, engineering R-11) are declined as unnecessary. Where a consumer is still missing, it is listed under open.
- Declined, with reason: new roles (Finance Manager, Production Manager; admin R-7b, engineering R-10, materials R-8) since roles drive exhaustive maps and the stated stand-ins are shown as readings; type renames and new status lists (engineering R-1, R-12, quality R-1, R-7, materials R-1, R-12, sales FR-1, FR-17) because the screens already override locally and the PRD words are shown there; spine ID renames (engineering R-9); data master changes (purchasing R-1, sales FR-14 to FR-16, materials R-4); the `reval` posting key (purchasing R-7) because the PRD gives no accounts for it; SkeletonRows fix (purchasing R-5, quality R-6, handled by SkeletonTable); external layout (quality R-12); CSS return-class tokens (sales FR-6); effective-dated thresholds (admin R-6) and step-up state (admin R-10), which need a design decision; docflow doc types and where-used queries (planning R-4, R-8, materials R-2, R-7, R-15, sales FR-20); recall (withdraw) of approvals in the shared engine (admin R-3, R-4, sales FR-11).
- Open seams, not wired: planning R-6 (cvaExceptionRaised to controlling), R-7 (poDeliveryDateChanged has no emitter in purchasing, so the supply-slip path only runs from planning's own UI), R-9, R-10 (STO and subcontract postings to inventory and purchasing); quality R-9, R-10 (OQC gate on the delivery, GRN lines in the payload); sales R-8 admin (sales consumes Credit release and No-quote decisions through the admin bridge); engineering woHoldRequested and ecoCutover consumers; quality.ftrIssued, vendorScarRestriction, massHoldApplied, deviationBlocked have no consumer in sales, purchasing or materials. These are the main places where a click in one module does not yet change another.

**Run-time check not done.** The hero thread was checked for ID and consumer consistency by code and store inspection, not by clicking the whole thread in a browser.
