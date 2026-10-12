# Module group: purchasing-finance

> **What this is.** The owner's guide for `src/modules/purchasing-finance/`. Purchasing and finance: the PRD's Purchasing (6), Costing and Pricing (8) and Controlling (3) modules.
>
> **Where it stands.** Module pass, 12 October 2026. All 17 screens are built and claimed "full" at their registry paths; the spine documents below are seeded with their IDs and statuses; type-check clean for this folder.
>
> **What we need from you.** Build the screens below inside this folder only. Anything you need outside it goes under "Requests to foundation" at the end.

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates` in the running app.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Built |
|---|---|---|---|---|---|---|
| PUR-WB-001 | Buyer Workbench | `/purchasing/workbench` | Workbench | W6 | - | full |
| PUR-VEND-001/2 | Vendors and AVL | `/purchasing/vendors, /purchasing/vendors/:id` | List | W6 | FL-03 | full |
| PUR-PR/RFQ | Requisitions and RFQs | `/purchasing/requisitions, /purchasing/requisitions/:id, /purchasing/rfqs, /purchasing/rfqs/:id` | List | W6 | FL-03, FL-10 | full |
| PUR-PO-001/2 | Purchase Orders | `/purchasing/orders, /purchasing/orders/:id` | List | W6 | FL-03, FL-10, FL-07 | full |
| LLR-001 | Long Lead Releases | `/purchasing/long-lead, /purchasing/long-lead/:id` | Detail | W6 | FL-10, FL-02 | full |
| PUR-EXP-001 | Expedite Board | `/purchasing/expedite` | Workbench | W6 | FL-03, FL-10 | full |
| CST-RATE-001 | Work Center Rates | `/costing/work-center-rates` | Config (design value) | W6 | - | full |
| CST-CE-001 | Cost Estimates | `/costing/estimates, /costing/estimates/:id` | Detail | W6 | FL-02 | full |
| CST-RUN-001 | Costing Runs | `/costing/runs` | Wizard | W6 | - | full |
| PRC-PL-001 | Price Lists and Agreements | `/pricing/price-lists, /pricing/price-lists/:id` | List | W6 | - | full |
| PRC-SUR-001 | Surcharge Rules and Index Values | `/pricing/surcharges` | Config | W6 | FL-02 | full |
| PRC-SIM | Price Simulation | `/pricing/simulate (design value)` | Dialog | W6 | FL-01, FL-02 | full |
| INV-CVA-001 | Cost Variance Workbench | `/inventory/valuation/cost-variance` | Workbench | W6 | FL-03, FL-06 | full |
| PRC-MARG | Margin Analysis | `/pricing/margin` | Dashboard (design value) | W6 | - | full |
| CO-CC/PC-001/2 | Cost and Profit Center Masters | `/controlling/cost-centers, /controlling/cost-centers/:id, /controlling/profit-centers, /controlling/profit-centers/:id` | List | W1 | - | full |
| CO-ALC-001/2 | Allocation Cycles | `/controlling/allocations, /controlling/allocations/:id` | Config | W6 | FL-06 | full |
| CO-R1..R4 | Controlling Reports (four) | `/controlling/reports, /controlling/reports/:id` | Dashboard (design value) | W6 | - | full |

Source: reference tables A [DOC:pp.245-282] (asserted); routes and archetypes marked "design value" are not in the specification.

## State

Slice key `purchasingFinance`. `purchasingFinance` (PurchasingFinanceState): requisitions, RFQs and responses, purchase orders, GRN link records, LLRs, STPs, cost estimates, costing runs, work center rates, price lists, customer prices, surcharge rules, index values, allocation cycles. Vendors and AVL are shared (VENDORS, AVL).

## Spine documents to seed

Seed these in `data/slice.ts` with exactly these IDs and statuses (headers in `src/data/shared/spine.ts`):

| ID | Type | Status | Title |
|---|---|---|---|
| CE-TBD-0301 | costEstimate | Released | Cost estimate, FIN-TBD-20MVA, Omaha North configuration |
| LLR-2026-0004 | llr | - | Long-lead release: CRGO steel and OLTC |
| STP-000301 | stp | - | Supplier technical package, OLTC, version 1 |
| PR-TBD-0301 | requisition | Converted | Requisition: OLTC and HV bushings |
| RFQ-TBD-0301 | rfq | Awarded | RFQ: OLTC, three vendors, sealed |
| PO-TBD-0301 | purchaseOrder | Matched/Closed | PO to Rheinwerk Tap Changers: 1 x OLTC |
| PO-TBD-0302 | purchaseOrder | Matched/Closed | PO to Hanseong Porcelain & Polymer: 9 x HV bushing 145 kV |
| LLR-2026-0011 | llr | - | Long-lead release: CRGO steel and 3 OLTCs, phase 2 |
| PR-TBD-0377 | requisition | Approved | Requisition: CRGO steel for three cores |
| PO-TBD-0377 | purchaseOrder | In Approval | PO to Northstar Electrical Steel: CRGO 54,000 kg |

## Cross-module events

- Emits: `purchasing.poReleased`, `purchasing.grnPosted`, `finance.periodStatusChanged`, `posting.posted` (#34 to #38, GRN, match).
- Consumes: `approval.decided` (PO ladder, LLR, price list, below-floor), `planning.plannedOrderConverted` (PR from MRP), `engineering.ecoReleased` (open PO impact), every `posting.posted` (cost variance, controlling reports).

Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder (see APP-ARCHITECTURE.md).

## Notes

- C-31, C-32: no PO for a vendor whose onboarding is not Active; Restricted needs a Purchasing Manager override; Disqualified hard-blocks.
- PO approval routes through `ApprovalButton kind="PO approval"`; the ladder is in src/data/domain/approvals.ts.

## Requests to foundation

Write one row per change you need in a shared file. Do not edit the shared file yourself.

| # | File | Change | Why (screen / rule) | Status |
|---|---|---|---|---|
| *R-0* | *src/data/domain/entities.ts* | *Example: add `incoterms` to Delivery* | *OM-DLV-001 load plan* | *example* |
| R-1 | src/data/shared/vendors.ts | Add VEN-TBD-0120 (PE Grid Components, intercompany seller) and RFQ prospects VEN-TBD-0121..0125 to `VENDORS`. Held locally as `EXTRA_VENDORS` in `data/logic.ts` until then. | PUR-PR/RFQ "AVL + prospects" (Book I G §4); FL-07 intercompany PO | open |
| R-2 | src/store/core.ts | `core.seq` starts at 100, so the first `raiseApproval` issues APR-TBD-0101, which collides with the seeded APR-TBD-0101 (LLR-2026-0011). `decideApproval` then maps both entries and the LLR request disappears. Start the sequence above the highest seeded id (for example 200). | LLR-001, PUR-PO-001/2: approval of the hero thread fails once any module raises an approval first | open |
| R-3 | src/data/domain/docflow.ts | Add doc types `priceList` (route `/pricing/price-lists/:id`) and `allocationRun` so price list approvals and #36 postings carry their own reference instead of `approval` (reading OQ-PF-9). | PRC-PL-001, CO-ALC-001/2 | open |
| R-4 | src/store/events.ts | `posting.posted` could carry `costCenterId` / `profitCenterId`; today CO-R4 derives them per template (reading OQ-PF-14). | CO-R1..R4 | open |
| R-5 | src/components/patterns/feedback.tsx | `SkeletonRows` renders bare `<tr>`; outside a table it logs a DOM nesting error. Worked around with `SkeletonTable` in `components/bits.tsx`. | every loading state | open |
| R-6 | 10-discovery/open-questions.md | Register readings OQ-PF-1..OQ-PF-17 (table below) as OQ numbers. | all screens | open |

## Readings taken (PRD silent)

Shown on screen as `Chip kind="oq"` with the id below (source `components/common.tsx` READINGS). Each is a reading, not a rule.

| Id | Reading | Screens |
|---|---|---|
| OQ-PF-1 | Expense and manual requisitions route through the PO value ladder; no requisition approver is named [DOC:p.102]. | PUR-PR/RFQ |
| OQ-PF-2 | A requisition moves to Converted when the PO it feeds is approved (spine: PR-TBD-0377 Approved while PO-TBD-0377 In Approval). | PUR-PR/RFQ, PUR-PO-001/2 |
| OQ-PF-3 | A PO under a long-lead release is sent only after the LLR is approved. | PUR-PO-001/2, LLR-001 |
| OQ-PF-4 | AVL price basis of info record, contract or award counts as contracted for the RFQ policy above $25,000. | PUR-WB-001 |
| OQ-PF-5 | PO revision re-approval: total rises more than 5% or moves into a higher ladder band. | PUR-PO-001/2 |
| OQ-PF-6 | Over-receipt tolerance 0% until a value is given. | PUR-PO-001/2 receipt |
| OQ-PF-7 | A rejected PO approval returns the PO to Draft (no Rejected on S-35). | PUR-PO-001/2 |
| OQ-PF-8 | Quality Manager, Quality engineer or Purchasing Manager restricts or disqualifies; Disqualified suspends the vendor's AVL rows. | PUR-VEND-001/2 |
| OQ-PF-9 | Price lists and allocation runs have no doc type; their approvals and postings carry an approval-type reference. | PRC-PL-001, CO-ALC-001/2 |
| OQ-PF-10 | Supersede creates the next version as Draft; the Released one turns Superseded when the successor is released. | CST-CE-001 |
| OQ-PF-11 | Floor-check margin = (net price less surcharge and freight − standard cost) / that price; PC-200 and PC-400 have no stated floor. | PRC-SIM, PRC-PL-001, PRC-MARG |
| OQ-PF-12 | Intercompany direction at go-live: PE Transformer buys merchandise from PE Grid Components. | PUR-PO-001/2 (FL-07) |
| OQ-PF-13 | Planned productive hours = capacity h/day × 250 working days × efficiency. | CST-RATE-001 |
| OQ-PF-14 | Posting events carry no cost / profit center; the journal derives them per template. | CO-R1..R4 |
| OQ-PF-15 | LLR states Draft, Awaiting approval, Approved, Closed shown as text (OQ-21). | LLR-001 |
| OQ-PF-16 | The person who marks a costing run cannot release it. | CST-RUN-001 |
| OQ-PF-17 | Vendor onboarding Under Review to Active is the Controller's financial release; earlier steps Buyer or Purchasing Manager. | PUR-VEND-001/2 |

Design values (shown as `Chip kind="design"`): routes and archetypes the registry marks as design (CST-RATE-001, PRC-SIM, PRC-MARG, CO-R1..R4); budget figures standing in for ACC 21 (CO-R1, CST-RATE-001 compute); revenue and COGS by profit center (CO-R2); confirmed hours per month from the SKF (CO-R3); costing-run stage words; allocation-cycle state words.

## Build notes

- Data states: every screen has the 600 ms first-visit skeleton, and a reviewer "States" menu (or `?state=loading|empty|error`) previews loading, empty and error.
- Hero thread through these screens: CE-TBD-0301 → LLR-2026-0004 → STP-000301 → PR-TBD-0301 → RFQ-TBD-0301 → PO-TBD-0301 / PO-TBD-0302 → GRN-TBD-0300 / GRN-TBD-0301 → variances (PPV, IPV, MUV, LRV, LEV, OAV on WO-TBD-0301) on INV-CVA-001 → order margin three ways on PRC-MARG. Phase 2: LLR-2026-0011 → PR-TBD-0377 → PO-TBD-0377 (approve in WF-INBOX, then Send) and PO-TBD-0378.
- Walked in the running app on 12 October: all 30 routes render; PO-TBD-0377 approval (WF-INBOX) → PR-TBD-0377 Converted → LLR-2026-0011 Approved (`engineering.llrApproved`; re-raised because of R-2) → Send (`purchasing.poReleased`, T01); GRN on PO-TBD-0311 with SP-01 and SP-02 scans (`purchasing.grnPosted`, `posting.posted`, T02). Scenario reset afterwards.
- Statuses with no list in the specification (LLR, STP version, allocation cycle, costing run) show as text, never a badge.
