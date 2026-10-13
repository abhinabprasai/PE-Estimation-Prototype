# Module group: sales

> **What this is.** The owner's guide for `src/modules/sales/`. Sales and service: the PRD's Sales (8) and Returns (5) modules. Holds the FL-09 build (moved here from src/pages and src/data in the foundation pass, behaviour unchanged).
>
> **Where it stands.** Feature-list pass, 12 October 2026. The 20 feature-list entries below are built at their routes and claimed "full"; the partial rows (quotations, orders, customer tax, cockpit, pack station, RMA detail, installed base, leads) are completed (see "Feature rows on screens already owned"). The earlier Sales pass of 11 October 2026 had every PRD screen built and claimed (first table). The pack station now runs on the shared `KioskPage` + `ScanField`, so critique F-01 is fixed there. The hero thread is walkable: LEAD-TBD-0301 → QT-TBD-0301-V1/V2 → SO-2026-00301 → DLV-TBD-0031 → POD-TBD-0031 → IB-TBD-0301 → RMA-TBD-0012.
>
> **What we need from you.** Build the screens below inside this folder only. Anything you need outside it goes under "Requests to foundation" at the end.

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates` in the running app.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Built |
|---|---|---|---|---|---|---|
| OM-LEAD-001/2 | Leads and Opportunities | `/sales/leads, /sales/leads/:id` | List | W2 | FL-02 | full |
| OM-CUST-001/2 | Customer Master | `/sales/customers, /sales/customers/:id` | List | W2 | FL-01, FL-02 | full |
| OM-QT-001/2 | Quotations | `/sales/quotations, /sales/quotations/:id` | List | W2 | FL-01, FL-02 | full |
| OM-SO-001/2 | Sales Orders with Schedule Lines | `/sales/orders, /sales/orders/:id, /sales/orders/new` | List | W2 | FL-01, FL-02, FL-09 | full |
| OM-BO-001 | Backorder Workbench | `/sales/backorders` | Workbench | W7 | FL-09 | full |
| OM-DLV-001 | Delivery Cockpit | `/sales/deliveries` | Workbench | W7 | FL-09, FL-01 | full |
| OM-PACK-* | Packing Queue and Pack Station | `/sales/packing, /sales/packing/station/:id` | Kiosk | W2 | FL-09, FL-01 | full |
| OM-POD-001 | POD and Claims | `/sales/pod, /sales/pod/:id` | List | W7 | FL-09 | full |
| RMA-LIST/CREATE | RMA Register and Authorization | `/sales/rma, /sales/rma/:id, /sales/rma/new` | List | W5 | FL-05, FL-08 | full |
| RMA-RECEIPT | Return Receipt | `/sales/rma/receipt (design value)` | Kiosk | W5 | FL-05 | full |
| RMA-DISP | Inspection and Disposition | `/sales/rma/:id/disposition` | Detail | W5 | FL-05 | full |
| IB-001 | Installed Base | `/service/installed-base, /service/installed-base/:id` | List | W5 | FL-05, FL-08 | full |
| SVC-SPF-001 | Spares Finder | `/service/spares-finder` | Workbench | W5 | - | full |

Source: reference tables A [DOC:pp.245-282] (asserted); routes and archetypes marked "design value" are not in the specification.

## State

Slice key `sales`. `sales` = the FL-09 `DB` (src/modules/sales/data/model.ts). Leads, customer master edits, RMAs and installed base can extend `DB` or live in a second slice (for example `service`) declared in this folder.

## Spine documents to seed

Seed these in `data/slice.ts` with exactly these IDs and statuses (headers in `src/data/shared/spine.ts`):

| ID | Type | Status | Title |
|---|---|---|---|
| CUS-TBD-0048 | customer | Active | Midland Plains Grid Constructors |
| LEAD-TBD-0301 | lead | - | Omaha North 115 kV substation: power transformer |
| OPP-TBD-0301 | opportunity | - | Omaha North phase 1, one 20 MVA unit |
| QT-TBD-0301-V1 | quotation | Superseded | Firm quotation V1 |
| QT-TBD-0301-V2 | quotation | Won | Firm quotation V2 |
| SO-2026-00301 | salesOrder | Shipped | ETO sales order, phase 1 |
| DLV-TBD-0031 | delivery | Delivered/Closed | Delivery to Omaha North, over-dimensional |
| POD-TBD-0031 | pod | Resolved/Closed | Proof of delivery, Omaha North |
| IR-TBD-0031 | invoiceRequest | - | Milestone invoice request: delivery (15%) |
| IB-TBD-0301 | installedBase | In Service | Installed base: SN-TBD-20M-0301 at Omaha North |
| RMA-TBD-0012 | rma | In Inspection | RMA: HV bushing oil weep at flange, SN-TBD-BSH-0302 |
| LEAD-TBD-0377 | lead | - | Omaha North phase 2: three more 20 MVA units |
| QT-TBD-0377-V1 | quotation | Won | Firm quotation, phase 2 |
| SO-2026-00377 | salesOrder | In Fulfillment | ETO sales order, phase 2 |

## Cross-module events

- Emits: `sales.pgiPosted`, `sales.pgiReversed`, `sales.podRecorded`, `posting.posted` (#25, #26) are already emitted after the FL-09 actions commit. To add: `sales.quotationWon`, `sales.orderConfirmed`, `sales.lineNeedsEngineering` (ETO/MTO lines, consumed by engineering), `sales.rmaReceived`.
- Consumes: `approval.decided` (credit release, R-OM-02 once FL-09 moves onto the shared engine; RMA approval), `quality.recallStageChanged` (recall RMAs), `production.fgReceived` (MTO/ETO line ready to ship).

Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder (see APP-ARCHITECTURE.md).

## Notes

- FL-09 is the regression baseline: the walked path in build-notes.md must still pass after every change here.
- FL-09's own approvals queue is still shown on WF-INBOX through `inboxSection` until it moves onto the shared engine (`store.raiseApproval`).
- The pack station runs on `KioskPage` + `ScanField` (SP-16): focus returns to the scan field only after a scan, an action or a dismiss, never on blur, so every button is reachable by Tab (F-01 fixed). Button labels and the FL-09 walked path are unchanged.
- Customers: the shared master `CUSTOMERS` (src/data/shared/customers.ts) and the FL-09 seed use the same IDs; credit exposure lives only in the FL-09 seed. Customer Class in the sales seed uses the PRD list (FR-15 asks the same of the shared master).
- The pack station closes an HU by SP-17 label scan-back (SSCC) once the serial is in and the scale reading is taken; "Close HU" stays as the keyboard path with the same ±2% check. #27 posts at HU close (SR-24).

## Where the screens are

| Screen | File | Template | Main actions (store slice `sales`) | Hand-offs |
|---|---|---|---|---|
| OM-LEAD-001/2 | pages/Leads.tsx | ListPage (board + register), DetailPage | create (duplicate warning), qualify, prior build search, disqualify, reassign, convert to quotation | lead → opportunity → quotation links |
| OM-CUST-001/2 | pages/Customers.tsx | ListPage, DetailPage (8 tabs) | create in Prospect, activate with address validation (Finance), status change, credit hold toggle, credit limit (Controller), priority (Sales Director) | none |
| OM-BO-001 | pages/Backorders.tsx | WorkbenchPage + Sheet | re-promise, split, substitute (approved alternates), propose reallocation, mass re-promise after MRP | `approval.requested/decided` "Reallocation of confirmed supply" (Sales Director) |
| RMA-LIST/CREATE | pages/Rma.tsx | ListPage (selectable, bulk bar), WizardPage (`/sales/rma/new`), DetailPage (Overview, Lines, Receipts, Inspection, Financials, Documents, Activity per p.26 §3.7) | create from reference document (warranty default from the entitlement service, goodwill flag, quarantine warehouse, owner, restocking-fee role limit), submit for approval, print / email instructions, cancel, close short, reopen; bulk Assign Owner, Print Return Instructions, Export | `approval.*` "RMA approval"; `quality.recallStageChanged` drafts recall RMAs |
| RMA-RECEIPT | pages/RmaReceipt.tsx | KioskPage + ScanField (SP-07 badge, SP-19) | receive full or partial, Customer Property flag (Receiving Supervisor only, RC3/RC4), bin proposal in the quarantine zone, unauthorized extra with supervisor badge, freight claim on damaged PE-paid returns | `posting.posted` #17, `trace.eventRecorded` T12, `sales.rmaReceived` |
| RMA-DISP | pages/RmaDisposition.tsx | DetailPage | start inspection, findings, RC3 teardown and mandatory photographs, adjudicate with the exclusions catalog, propose dispositions, goodwill replacement to the Controller (WF-INBOX), Quality Manager decision (local, FR-10), settlement steps with retry, close, convert denial to billable, SCAR | `posting.posted` #17 reversal (As-Is), #18, #20, #21-#23, #26; `sales.ncrRequested` (module-only) |
| IB-001 | pages/InstalledBase.tsx | ListPage, DetailPage | capture commissioning date, ownership transfer, extension request | created on `sales.pgiPosted`, Installed on `sales.podRecorded` |
| SVC-SPF-001 | pages/SparesFinder.tsx | WorkbenchPage | search serial / customer / SO, filter wear and safety-critical, ATP for stocked SPARE items, force the original part where policy allows, entitlement warning with the RMA path, create spares quotation | quotation with `ibId` link |

Every list takes `?state=empty` and `?state=error` to show those states; the first visit shows the loading skeleton.

## Readings (PRD silent; shown on screen as a design chip)

| ID | Where | Reading |
|---|---|---|
| SR-1 | OM-LEAD | Lead stages (p.249) drawn with family badges until the shared catalog has a lead row (FR-1). |
| SR-2 | OM-LEAD | Pipeline values in USD; CAD converted at the fixed 1.36 rate (OQ-42). |
| SR-3 | OM-LEAD | Win probability by stage 10/25/50/100/0/0%. |
| SR-4 | OM-LEAD | Qualification checklist: four design items. |
| SR-5 | OM-LEAD | Disqualify reason codes: six design values. |
| SR-6 | OM-LEAD | Prior build match score = share of matching attributes (impedance ±0.5 points); 30% shown, 70% surfaces installed base. |
| SR-7 | OM-CUST | Contact roles (Purchasing, Engineering, AP, Receiving); Inactive refused while sales orders are open. |
| SR-8 | OM-BO | Allocation order and fair share are the PRD's (p.207 §2.2). Readings: supply taken from the earliest option first; fair shares rounded to whole units by largest remainder; one supply option proposed per schedule (a short share splits the schedule); slipped promises left to a person. |
| SR-9 | RMA-LIST | The six quick-stat pills are the PRD's (p.22 §3.3). Reading is only which statuses each counts: Awaiting Receipt = Authorized + Partially Received; In Inspection = Received + In Inspection; Pending Credit = Settling with a credit memo step open; Aged > SLA = Received past 5 business days. |
| SR-10 | RMA-DISP, IB-001 | Warranty election cap N = 6 months after ship; claim date = RMA request date. |
| SR-11 | SVC-SPF-001 | CAD spares prices = USD × 1.36 (OQ-42). |
| SR-12 | RMA-DISP | "Return to Customer As-Is" freight accrual shown at $1,200.00 when PE pays (no quote source in the prototype). |
| SR-13 | RMA-RECEIPT | Route `/sales/rma/receipt` and the station "Dock 2, WH-TBD-01" are design values (registry marks the route design). |
| SR-14 | IB-001 | Warranty extension approver: the Customer Service Manager decides locally (PRD names no approver) until the shared engine has a "Warranty extension" kind (FR-9). Extensions therefore do not appear on WF-INBOX yet. |
| SR-15 | RMA-LIST/CREATE | No Reference: the Controller step (p.26 §3.9, asserted) is added to the RMA approval through the route's goodwill flag, because the route has no no-reference flag (FR-12). |
| SR-16 | RMA-DISP | Disposition approval is decided locally by the Quality Manager ("Inspectors propose, Quality Manager approves", p.253) until a separate "RMA disposition" kind exists (FR-10); the "RMA approval" route would put the CS Manager first. |
| SR-17 | RMA-LIST/CREATE | Restocking fee role limits: Customer service up to the reason's policy default, Customer Service Manager up to 25%. Above the limit the RMA carries a flag and the CS Manager approves the fee on the RMA approval (its step 1). |
| SR-18 | RMA-LIST/CREATE | Quarantine-type return warehouses (WH-TBD-01 zone Q1, WH-TBD-02 zone Q2) are design values: the shared warehouse master has no type (FR-14). |
| SR-19 | RMA-DISP | Exclusions catalog entries are design values under the PRD's two categories (site conditions, installation error, p.215 §7.4); an exclusion is required when a denial is attributed to Site Conditions or Installation Error. |
| SR-20 | SVC-SPF-001 | A spare part "relates to an open or attributable failure" when it (or one of its serials) is on an RMA of the unit that is open, or whose failure was attributed to Manufacturing Defect or Component Supplier. Quote anyway needs a reason, logged on the quotation. |
| SR-21 | SVC-SPF-001 | ATP for a stocked SPARE item = on hand less open sales order demand (no scheduled receipts in the prototype). Forcing the original is allowed when it has stock and is not on a blocked or recalled batch. |
| SR-22 | RMA-RECEIPT | Bin proposal: the putaway engine (INV 15.6) is not built; bins Qn-01..Qn-08 of the RMA's quarantine zone in line order, skipping bins held by open RMAs. Freight claim amount = damaged lines at valuation. |
| SR-23 | OM-LEAD | Product class of a lead = make class (ETO / MTO / MTS) of the catalogue item its kVA maps to (unmapped = ETO). Average age per stage = days since the lead entered its current stage. |
| SR-24 | OM-PACK-* | Packaging bill per transformer HU (1 heavy skid, 1 accessory crate, 2 desiccant bags) for #27 "backflush at standard" = $611.40. |
| SR-25 | FX-OM-LEADIMPORT | Inbound review statuses (New, Needs review, Possible duplicate, Accepted, Merged, Rejected) and the capture confidence figure are design values; the channels (web form, email, trade contact import) are the PRD's. |
| SR-26 | FX-OM-DLVRUN, OM-DLV-001 | The PRD says every split or merge stores the rule that fired and that E-DLV-01 names it, but gives no ids. Ids DLV-SPLIT-M1..M5, DLV-SPLIT-E1..E3, DLV-MERGE-1, DLV-GROUP-0 are design values; the rule texts are the PRD's (p.207 §2.3). Vehicle capacity 20,000 kg is a design value ("weight over vehicle capacity" has no figure); the 7-day window is the PRD's default N. A merge group becomes one delivery per order because the delivery record is single-order. |
| SR-27 | FX-OM-CHANGE | Cancellation fee is contract-based in the PRD with no figure: default 10% for ETO, 5% otherwise. "Production Manager" is not a role in the shared list: the work order disposition is decided by the Production supervisor, Planning Manager or Production Scheduler. |
| SR-28 | FX-OM-CHANGE, OM-QT, FX-OM-EAC, FX-OM-REPORTS | Margin target 22% and floor 15% (the PRD says "below target" and "floor" without figures; its examples are 22% and 18% per product class). A price change on a confirmed order below standard cost plus 15% is refused and goes through the Pricing Manager, Sales Director and CFO route. |
| SR-29 | OM-QT, OM-SO, FX-OM-CHANGE | The price waterfall (PB00 steps 1 to 4, then the discount) is the PRD's; the winning step is rebuilt from the line price (a price under the list rate reads as a customer agreement, at list as the price list, ETO lines come from the cost estimate). The October list change used by Reprice is +3.5% on list items. |
| SR-30 | all feature screens | The nine-state selector ("Show state", `?state=`) is a prototype device; the real app reaches each state by itself. |
| SR-32 | FX-OM-SCALE | Scale device states (connected, error, stale) are the feature list's; the stale limit of 10 s and the readout behaviour are design values (the PRD names only IF-20 and DEC-08). |
| SR-33 | FX-OM-REPORTS | "Config per company: reps see margin Y/N" [p.56 §6]: the prototype default is N, so Sales rep sees no margin report. |
| SR-34 | FX-OM-REPORTS | Bookings = value of orders created in the month (not Draft or Rejected); billings = invoice-posted orders in their closing month; backlog = running bookings less billings per dimension; entity = US or Canadian by order currency; CAD at 1.36 (OQ-42). |
| SR-37 | FX-RMA-BILLABLE | Repair quote validity 30 days. |
| SR-38 | OM-CUST tax tab | Default tax code list (S1, S1-CA, E-IC, Z-EXP): S1, U1 and E-IC are the PRD's codes, the Canadian and export codes are design values. |
| SR-39 | OM-PACK-* | Pack order # follows the delivery number (PK-{YYYY}-{SEQ:5} is the PRD's format); "per picklist" means one pack order per schedule line of the delivery, "per shipment" one for the whole delivery. |
| SR-40 | OM-PACK-* | Photos (four corners and the nameplate) are required for ETO and heavy units only and are shown at the station, not enforced at pack completion (the PRD says "config per item category"). |
| SR-41 | IB-001 | Unknown-site worklist: installed base records whose site is "Not recorded" (units bought by EPC contractors ship to a job site). Assignment is by Customer service, CS Manager or Sales admin. |

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself. Requests are numbered FR-n so they do not collide with the FL-09 rule IDs R-1..R-19 used on the Orders, Deliveries and Packing screens.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *FR-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
| FR-1 | src/data/domain/status.ts | Add a `lead` record kind with stages Open, Qualified, Quoting, Won, Lost, Disqualified [DOC:p.249 §4.1] so `StatusBadge kind="lead"` works | OM-LEAD-001/2 | open |
| FR-5 | src/store/events.ts | Catalog entry `sales.ncrRequested { rmaId, ncrId, attributable }` (today a module-only augmentation) so quality-trace can open the NCR | RMA-DISP, INV 15.4 | open |
| FR-6 | src/index.css | Tokens for return-class colours (RC1 blue, RC2 teal, RC3 orange, RC4 purple) | RMA register class badges | open |
| FR-9 | src/data/domain/approvals.ts | Approval kind "Warranty extension" (route not stated in the PRD; needs a reading) so IB-001 sends extensions through ApprovalButton and WF-INBOX instead of the local decision (SR-14) | IB-001 "Extend warranty with approval" [DOC:p.215 §7.4] | open |
| FR-10 | src/data/domain/approvals.ts | Approval kind "RMA disposition" routing to the Quality Manager only. Today disposition approval runs locally (`decideDispositions`, Quality Manager only, SR-16); it does not reuse "RMA approval" | RMA-DISP "Inspectors propose, Quality Manager approves" [DOC:p.253] | open |
| FR-11 | src/store/core.ts | A way to withdraw (recall) an open approval request, so Recall from Pending Approval closes the request instead of leaving it open and ignoring a later decision | RMA lifecycle "Approve, Reject, Recall" [DOC:p.26 §3.8] | open |
| FR-12 | src/data/domain/approvals.ts | `ApprovalContext.noReference` flag on "RMA approval" that adds the Controller step for any credit, instead of reusing `goodwill` (SR-15) | RMA No-Reference path [DOC:p.26 §3.9] | open |
| FR-13 | src/store/events.ts | Catalog entry `sales.rmaSlaBreached { rmaId, notify, businessDays }` (module-only today) so the alert rules can route it | RMA SLA alert [DOC:p.27 §3.10, INV 15.11] | open |
| FR-14 | src/data/shared/org.ts | Warehouse `type` (Quarantine, Finished goods, Spares ...) plus quarantine zones, so the RMA Return Warehouse lists quarantine warehouses from the master (SR-18) | RMA create "only warehouses of type Quarantine selectable" [DOC:p.23 §3.4.1] | open |
| FR-15 | src/data/shared/customers.ts | Customer `class` values to the PRD list: Investor-Owned Utility, Municipal Utility, Co-op, EPC Contractor, Distributor, OEM, Industrial, Government. The sales seed already uses them; the shared master still has the old design values | OM-CUST Customer Class [DOC:p.49 §2.1] | open |
| FR-16 | src/data/shared/materials.ts, src/data/domain/ids.ts | Material type KIT (non-stocked, non-valuated) and a sales BOM usage, so sales kit headers come from the master instead of the `db.fx.kits` design list | FX-OM-KIT [DOC:p.257 §6.1] | open |
| FR-17 | src/data/domain/status.ts | A pack order record kind with Not Started, In Progress, Packed, Cancelled [DOC:p.31 §5.2]; the pack queue draws these with family badges until then | OM-PACK-LIST-001 | open |
| FR-18 | src/store/events.ts | Promote `planning.promiseDecided` (planning request R-3) to the shared catalog; the sales slice already consumes it and writes the promise onto the quote or order line | CTP-DLG embed (OM-QT, OM-SO) | open |
| FR-19 | src/data/domain/approvals.ts | Approval kinds for "Sales change order" (price change below floor), "Cancellation fee waiver" and "De-peg" (Sales Director) so these go through ApprovalButton and WF-INBOX; today de-peg, credit memo release and billing plan edits are decided inside the screen by the named role | FX-OM-CHANGE, FX-OM-CREDIT, FX-RMA-CREDITMEMO | open |
| FR-20 | src/data/domain/docflow.ts | Document types for shipment (SHP-TBD-nnnn), credit memo request, repair quote and change order, so the DocumentFlowPanel can link them; they show as search hits only today | OM-SHP-001/002, FX-RMA-*, FX-OM-CHANGE | open |
| FR-21 | src/data/screens-features.ts | `CTP-DLG`'s registry route is the order SO-2026-00402; this module now claims `/sales/orders/SO-2026-00402` and renders the order with the planning Promise Dialog. Moving the registry route to `/production/at-risk/promise` (planning host) removes the duplicate claim | CTP-DLG | open |

## Feature-list entries (added 12 October 2026)

The user's feature list (`00-inputs/feature-list-2026-10.md`) is part of the prototype's scope together with the PRD. The feature mapper registered the rows below in `src/data/screens-features.ts`. Each has a placeholder route today. Build it at that path with `screenId` and a `built` claim, as for any registry screen. Routes, archetypes and ids marked FX- are design values. Rows that are a tab or panel of a screen you already own (for example Material Detail views, the RMA detail tabs, the Customer tax tab) have no entry: they are in the "Feature rows" list below and count as scope of that screen.

| Screen ID | Title | Route | Archetype | Wave | Flows | Feature-list section | Built |
|---|---|---|---|---|---|---|---|
| FX-OM-LEADIMPORT | Lead import and inbound capture review | `/sales/leads/import` | Workbench (design value) | W2 | FL-02 | Sales & Order Management | full |
| FX-OM-QT2SO | Quote to order conversion dialog | `/sales/dialogs/quote-to-order` | Dialog (design value) | W2 | FL-01, FL-02 | Sales & Order Management | full |
| FX-OM-KIT | Sales kit BOM explode on quote and order lines | `/sales/dialogs/kit-explode` | Dialog (design value) | W2 | FL-01 | Sales & Order Management | full |
| FX-OM-BILLPLAN | Billing plan and milestone editor | `/sales/billing-plan` | Detail (design value) | W2 | FL-02 | Sales & Order Management | full |
| FX-OM-EAC | ETO order cost panel (EAC) | `/sales/eto-cost` | Detail (design value) | W2 | FL-02 | Sales & Order Management | full |
| FX-OM-ATP | ATP partial-availability dialog | `/sales/dialogs/atp-partial` | Dialog (design value) | W2 | FL-01, FL-09 | Sales & Order Management | full |
| FX-OM-CHANGE | Sales change order, cancellation and reprice dialogs | `/sales/dialogs/change-cancel-reprice` | Dialog (design value) | W2 | FL-01, FL-02 | Sales & Order Management | full |
| FX-OM-CREDIT | Credit release and de-peg decision dialogs | `/sales/dialogs/credit-release-depeg` | Dialog (design value) | W2 | FL-09 | Sales & Order Management | full |
| FX-OM-CUSTPROP | Customer property return and SO closure reconciliation | `/sales/dialogs/customer-property` | Dialog (design value) | W2 | FL-05 | Sales & Order Management | full |
| FX-OM-DLVRUN | Delivery creation run wizard | `/sales/deliveries/create-run` | Wizard (design value) | W2 | FL-09, FL-01 | Sales & Order Management | full |
| OM-SHP-001/002 | Shipments | `/sales/shipments`, `/sales/shipments/:id` | List (design value) | W2 | FL-09, FL-01 | Sales & Order Management | full |
| FX-OM-EXPORT | Export documentation checklist on shipment | `/sales/dialogs/export-docs` | Dialog (design value) | W2 | FL-09 | Sales & Order Management | full |
| FX-OM-PGI | PGI confirmation and PGI reversal dialogs | `/sales/dialogs/pgi` | Dialog (design value) | W2 | FL-09, FL-01 | Sales & Order Management | full |
| FX-OM-LOADSHIP | Load and ship scan flow (TC77, SP-18) | `/sales/load-ship` | Kiosk (design value) | W2 | FL-09 | Sales & Order Management | full |
| FX-OM-SCALE | Pack station live scale readout | `/sales/dialogs/scale-readout` | Dialog (design value) | W2 | FL-09 | Sales & Order Management | full |
| FX-OM-REPORTS | Sales reports (seven) | `/sales/reports`, `/sales/reports/:id` | Dashboard (design value) | W2 | - | Sales & Order Management | full |
| FX-RMA-DIALOGS | RMA action dialogs | `/sales/dialogs/rma-actions` | Dialog (design value) | W5 | FL-05 | RMA, Warranty & Service | full |
| FX-RMA-CREDITMEMO | Credit memo request panel and Controller credit release | `/sales/dialogs/credit-memo` | Dialog (design value) | W5 | FL-05 | RMA, Warranty & Service | full |
| FX-RMA-BILLABLE | Billable repair quote and customer approval gate | `/sales/dialogs/billable-repair` | Dialog (design value) | W5 | FL-05 | RMA, Warranty & Service | full |
| FX-RMA-EXCLUSIONS | Warranty exclusions catalog | `/service/warranty-exclusions` | Config (design value) | W5 | FL-05 | RMA, Warranty & Service | full |

## Feature rows on screens already owned (completed 12 October 2026)

| Registry id | Route | What was added | Where |
|---|---|---|---|
| OM-QT-001/2 | `/sales/quotations/:id` | Tabs: Lines (price source badge and PB00 waterfall per line, lead time with the ±25% band on a Budgetary quote, per-line CTP chip from the planning module, commodity surcharge lines with index, base, date and math, kit lines), ETO configuration (datasheet), Cost and margin (estimate link, margin %, floor and target check, approval route), Versions (chain and side-by-side diff), Win and loss (structured reasons), Activity. Budgetary watermark banner; quote type switch on a Draft. "Convert to order" opens FX-OM-QT2SO | pages/Quotations.tsx, pages/fx/QuotationPanels.tsx |
| OM-SO-001/2 | `/sales/orders/:id` | Readiness chips (supply, credit, quality, documents), ETO milestone strip (six slices, invoice-request state), per-line price waterfall and source badge, planning Promise Dialog and per-line CTP chip (replaces the FL-09 CTP stub; `planning.promiseDecided` writes the promise back), links to the billing plan and the ETO cost panel, Change order / Reprice / Cancel / Add kit line / Credit decision dialogs, ATP dialog now FX-OM-ATP | pages/Orders.tsx |
| OM-LEAD-001/2 | `/sales/leads` | Verified: pipeline board beside the register (`?view=register`). Added the entry to Lead import and inbound review | pages/Leads.tsx |
| OM-CUST-001/2 | `/sales/customers/:id` | Tax tab: registrations per jurisdiction, default tax code, exemption certificates (read-only embed of ACC 19.2), use-tax accrual (vendor field, read-only), tax address role, determination precedence with the customer's result | pages/fx/CustomerTax.tsx |
| OM-DLV-001 | `/sales/deliveries` | E-DLV-01 rule ids on cards, in the panel and in the rules list; carrier tender state with Reassign carrier and Carrier accepted; hand-offs to the creation run wizard, shipments, load and ship, PGI dialogs and the PGI reversal checks; nine-state bar | pages/Deliveries.tsx |
| OM-PACK-* | `/sales/packing`, `/sales/packing/station/:id` | Queue: PK-{YYYY}-{SEQ:5}, pack order status (Not Started, In Progress, Packed), required ship date red when today or past, creation rule (per picklist / per shipment). Station: centre scan with the items on the left and the HU tree on the right, E-PCK-02 on a wrong scan, short-pack (Short Pick, Damage, Hold), nest HUs, move or split contents between HUs, photo checklist, live scale readout (connected, error, stale) | pages/Packing.tsx, pages/fx/ScaleReadout.tsx |
| RMA-LIST/CREATE | `/sales/rma/:id` | Verified: seven tabs (Overview, Lines, Receipts, Inspection, Financials, Documents, Activity), No-Reference and Recall-class variants. Added Approve or reject, Unauthorized-line decision, the credit memo panel and the billable repair quote on Financials | pages/Rma.tsx |
| IB-001 | `/service/installed-base` | Verified: service history (History tab) and warranty extension approval. Added the unknown-site worklist with bulk site assignment (`?view=unknown-site`) | pages/InstalledBase.tsx, pages/fx/UnknownSites.tsx |

### Data and state added

`db.fx` (src/modules/sales/fx/model.ts) lives inside the `sales` slice so one action can change an order and its feature record in a single atomic write. Seeded: nine inbound captures and one import batch, billing plans for the ETO orders, ETO cost panels for SO-2026-00301 and SO-2026-00377 (the spine values for CE-TBD-0301 and CE-TBD-0377), three sales kits, shipment extensions for every delivery (one carrier rejection on the Quality Cleared delivery, one failed PSI on a Packed delivery), eight demo orders that exercise each split and merge rule of the run wizard, a change order, a de-peg waiting for the Sales Director, customer property on SO-2026-00377 and SO-2026-00301, quotation extensions (budgetary, surcharges, win and loss), tax profiles for every customer, six warranty exclusions, a blocked credit memo (customer on credit hold, E-RMA-07), a repair quote waiting for the customer on RMA-TBD-0011, an Unauthorized Return line on RMA-TBD-0010 and unknown-site installed base units for the EPC customers.

Events: this module now consumes `planning.promiseDecided` (module event declared by the planning group). No new event is emitted: PGI, PGI reversal, POD and quotation won are emitted as before (FL-09 path unchanged).

Role gates follow the PRD only where it names a role (ASM-PERM-1): billing plan edits are Finance (p.56 §6), the credit release of a held credit memo is the Controller, a de-peg is decided by the Sales Director, reopen is the Controller within 30 days, cancel is the CS Manager, short-pack is a supervisor. The default acting role is Sales rep, so switch "Acting as" to try the others; a refused action says which role does it.

### Nine states

Every feature screen shows a "Show state" selector (`?state=normal|empty|loading|validation|authorization|conflict|offline|degraded|read-only`). Empty and loading replace the content, validation starts the forms with their messages, authorization / conflict / offline / read-only disable the write controls with the reason, degraded tags values Stale. Kiosk screens (load and ship, pack station) take the same states.
