# Module group: sales

> **What this is.** The owner's guide for `src/modules/sales/`. Sales and service: the PRD's Sales (8) and Returns (5) modules. Holds the FL-09 build (moved here from src/pages and src/data in the foundation pass, behaviour unchanged).
>
> **Where it stands.** Sales pass, 11 October 2026. Every screen in the group is built and claimed (table below). The pack station now runs on the shared `KioskPage` + `ScanField`, so critique F-01 is fixed there. The hero thread is walkable: LEAD-TBD-0301 → QT-TBD-0301-V1/V2 → SO-2026-00301 → DLV-TBD-0031 → POD-TBD-0031 → IB-TBD-0301 → RMA-TBD-0012.
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
