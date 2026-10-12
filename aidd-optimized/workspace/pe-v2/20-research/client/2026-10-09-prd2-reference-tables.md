# PRD2 Reference Tables - pe-v2

> **What this is.** Lookup tables taken from the client's build specification (PRD2): every screen in the build plan with its route, wave, postings, scans and the flows it serves; the journal posting templates; the barcode scan points; the traceability events; the status lists; and the approval limits. Use it when a prompt or a spec needs an exact ID, status name or threshold.
>
> **Where it stands.** First version, 9 October 2026. Read from the eight section digests plus targeted page checks where a digest pointed back to the source. Not reviewed by a human. Nothing here is confirmed: the specification stands as the subject expert's written statement.
>
> **What we need from you.** Nothing - this is for reference. If a value below is wrong, name its table and row.

Group: `client/` (the client's own document only; no team reasoning, no outside research). Every row is `[DOC:p.n §x]` (asserted) unless it says otherwise. When two pages disagree, the document's own rule applies: Book IV outranks Books I-III, and a Book VI entry yields to the section it references [DOC:p.204 §1.1; p.277] (asserted). Known disagreements are listed in `20-research/kb-index.md` section 6, not resolved here.

Index of tables: A screens, B posting templates, C scan points, D traceability events, E status lists, F approval limits and thresholds, G roles named per flow.

---

## A. Screen catalogue (Book VI 78 entries + Book VII 6 supplemental)

Source for every Book VI row: the module section named in the heading, Book VI [DOC:pp.245-276 §3-15] (asserted). A "/2" entry is a list and detail pair counted as one entry [DOC:p.244 §1] (asserted). "Users" is what the entry states; "(cut)" means the extraction cut the list short, so reopen the entry before specifying permissions.

**Flows column basis.** **M** the flow is named for this screen in the Book VIII one-page business map [DOC:p.294 §3] · **F** the screen or its object is named in that flow's own text · **T** the screen posts a template or captures a scan point that the flow's closure spec names. A blank means the document does not tie the entry to a flow (master data or reporting).

| Screen ID | Title | Route / archetype | Users | Wave | Postings and scans | Flows (basis) |
|---|---|---|---|---|---|---|
| *RMA-DISP* | *Inspection and Disposition* | */sales/rma/{id}/disposition, Detail* | *Inspectors propose, Quality (cut)* | *W5* | *#18 to #23 per outcome* | *FL-05 (T)* |
| **Materials §3, pp.245-248** | | | | | | |
| MM-MAT-001 | Material Listing | /inventory/items, List | Steward, buyers, planners, all read | W2 | none | |
| INV 2.3 + MM views | Material Detail (ten views) | /inventory/items/{id}, Detail tabbed | View owners edit their view, all read | W2 | none directly; valuation fields drive every later posting | |
| MM-MCR-001/2 | Material Creation Requests | /materials/creation-requests, Workbench + detail | All departments, Materials | W2 | none | FL-10 (F stage 3), FL-03/FL-10 Source (M) |
| MM-MCH-001 | Material Change Requests | /materials/change-requests, Wizard | Owners request, class rules approve | W2 | none | |
| MM-SUP-001 | Supersessions | /materials/supersessions, Detail | Materials Manager | W6 | none | |
| MM-IR-001/2 | Purchasing Info Records | /purchasing/info-records, List + detail | Buyers; Purchasing Manager approves manual prices | W6 | none; invoice deviation over 5% raises a buyer alert | FL-03 (F field 5), Source (M) |
| MM-SL-001 | Source Lists | /purchasing/source-lists, Detail grid | Purchasing Manager | W6 | none | FL-03 (F field 5) |
| MM-VAL-001 | Account Determination Workbench | /materials/account-determination, Config | Controller, step-up MFA on release | W1 | none itself; everything else posts through it | every posting flow |
| MM-EOR-001 | Excess and Obsolete Reserve Run | /materials/eo-reserve, Wizard | Controller | W6 | DR 6320 CR 5340 on build, reverse on release | FL-06 (F field 6) |
| MM-DQ-001 | Data Quality Dashboard | /materials/data-quality, Dashboard | Materials Manager, stewards | W7 | none | |
| **Sales §4, pp.248-252** | | | | | | |
| OM-LEAD-001/2 | Leads and Opportunities | /sales/leads, List + detail | not extracted | W2 | none; no credit exposure before a quotation | spine start [DOC:p.276 §16] |
| OM-CUST-001/2 | Customer Master | /sales/customers, List + detail | Sales edits commercial, Finance edits credit | W2 | none | FL-01/FL-02 Lead and quote (M) |
| OM-QT-001/2 | Quotations | /sales/quotations, List + detail | Sales reps, estimators on ETO | W2 | none; tax estimate on save | FL-01/FL-02 (M) |
| OM-SO-001/2 | Sales Orders with Schedule Lines | /sales/orders, List + detail | Sales admin, CS (cut) | W2 | none directly; everything downstream pegs here | FL-01, FL-02 (M), FL-09 (F §2.1) |
| OM-BO-001 | Backorder Workbench | /sales/backorders, Workbench | Planners, sales admin, Sales (cut) | W7 | none | FL-09 (F §2.2), Order (M) |
| OM-DLV-001 | Delivery Cockpit | /sales/deliveries, Workbench | not extracted | W7 | PGI posts #25, #26, #27; loading scans SP-18 | FL-09 (M, F §2.4), FL-01 (T) |
| OM-PACK-* | Packing Queue and Pack Station | /sales/packing, Queue + kiosk | Packers | W2 | #27 at HU close; SP-16, SP-17 | FL-09 (M), FL-01 (T) |
| OM-POD-001 | POD and Claims | /sales/pod, List + detail | Shipping office, CS on claims | W7 | freight claim recovery per Book I A §3.9 when applicable | FL-09 (M, F §2.4) |
| **Returns, Warranty and Service §5, pp.252-254** | | | | | | |
| RMA-LIST/CREATE | RMA Register and Authorization | /sales/rma, List + detail | CS creates, managers approve per matrix | W5 | none until receipt | FL-05 (M, F) |
| RMA-RECEIPT | Return Receipt | scan driven, Kiosk | Receiving | W5 | #17 when ownership returns, none for customer property; SP-19 | FL-05 (T) |
| RMA-DISP | Inspection and Disposition | /sales/rma/{id}/disposition, Detail | Inspectors propose, Quality (cut) | W5 | #18 to #23 per outcome | FL-05 (T) |
| IB-001 | Installed Base | /service/installed-base, List + detail | CS maintains, all read | W5 | none | FL-05/FL-08 Service (M) |
| SVC-SPF-001 | Spares Finder | /service/spares-finder, Workbench | Customer service, service desk, spare parts sales | W5 | none; downstream quote, order, delivery carry the money | |
| **Engineering §6, pp.254-257** | | | | | | |
| ENG-HOME-001 | Engineering Workspace | /engineering, Workbench | Engineers, Engineering Manager | W3 | none | |
| ENG-REQ-001 | Engineering Request | /engineering/requests, Detail | Engineering Manager assigns, engineers execute | W3 | none | FL-02/FL-10 Design (M), FL-10 (F stage 1) |
| ENG-BOM-002 | EBOM Editor | /engineering/boms/{id}, Detail three panes | Assigned engineers, manager releases | W3 | none | FL-02/FL-10 Design (M) |
| ENG-ECR/ECO | Change Requests and Change Orders | /engineering/change-*, not extracted | not extracted | W3 | disposition outcomes post through their own documents | FL-10 (F stage 12) |
| MBOM-TRF | MBOM Transform | wizard from a released EBOM, Wizard | not extracted | W3 | none | spine [DOC:p.276 §16] |
| PV-001 | Production Versions | /engineering/production-versions, List + detail | Engineering | W3 | none | |
| **CAD and Documents §7, pp.257-259** | | | | | | |
| ENG-DOC-001/2 | Controlled Documents | /engineering/documents, List + detail | Engineers author, manager releases | W3 | none | FL-02/FL-10 Design (M) |
| TR-001 | Transmittals | /engineering/transmittals, Wizard + register | Engineers, document control | W3 | none | FL-02 (M, F field 8) |
| CAD-SYNC | CAD Sync Monitor and Conflict Queue | /engineering/cad-sync, Workbench | Engineering IT, engineers resolve conflicts | W3 with the connector | none | |
| CAD-IMP | CAD BOM Import | wizard inside the EBOM editor, Wizard | Engineers | W3 | none | |
| **Planning §8, pp.259-261** | | | | | | |
| PP-MRP-001 | MRP Workbench | /production/mrp, Workbench | Planners; buyers see their exceptions | W4 | none | FL-04 Build (M) |
| PLO-001 | Planned Orders | /production/planned-orders, List | Planners | W4 | none | FL-04 (F field 3) |
| SCH-BOARD | Schedule Board | /production/schedule, Workbench | not extracted | W4 | none | FL-04 Build (M) |
| CTP-DLG | Promise Dialog | dialog on quotes and orders, Dialog | not extracted | W4 | none | FL-01/FL-02 Lead and quote (M) |
| AT-RISK | At Risk Promises | /production/at-risk, Workbench | not extracted | W4 | none | |
| **Production §9, pp.261-263** | | | | | | |
| PP-WC-001/2 | Work Centers | /production/work-centers, List + detail | Manufacturing engineering (cut) | W4 | none | |
| PP-RTG-001/2 | Routings | /production/routings, List + detail | not extracted | W4 | none | |
| PP-WO-001/2 | Production Orders | /production/orders, List + detail | Scheduler, supervisors, cost accounting reads | W4 | postings happen through terminal confirmations and receipt, not here | FL-04 Build (M) |
| PP-DSP-001 | Dispatch List | /production/dispatch, Workbench | Supervisors | W4 | none | |
| PP-SFT-001 | Shop Floor Terminal | /production/terminal, Kiosk | not extracted | W4 | #28, #29, #30 per confirmation event; SP-07, 08, 10, 11, 12 [DOC:pp.248-276, digest 07] | FL-04 (M "kiosk terminal", T) |
| PP-WIP-001 | WIP Board and Valuation | /production/wip, Board + report | Supervisors, cost accounting | W4 | none | FL-04 (F field 12 WIP report) |
| RWO-001 | Rework Orders | /production/rework, List + detail | Supervisors, quality on retest gates | W4 | #21, #22, #33 per origin at settlement | FL-05 (T #21 #22), FL-04 (T #33) |
| PP-SETTLE-001 | Settlement Run | /production/settlement, Wizard | Cost accountant (cut) | W4 | #32 with the split of Book I A §8 | FL-04, FL-02 (T) |
| **Quality §10, pp.263-266** | | | | | | |
| QM-DASH-001 | Quality Dashboard | /quality/dashboard, Dashboard | not extracted | W5 | none | |
| QM-PLAN-001/2 | Inspection Plans | /quality/inspection-plans, List + detail | not extracted | W2 config, W5 full | none | FL-03 (F field 8), FL-02 (F field 5) |
| QM-EXEC | Inspection Execution | per gate queues, Detail | Inspectors | W5 | stock status moves per gate; SP-05, SP-14 | FL-03 (F field 8), FL-10 (F stage 14), FL-11 (T T03) |
| QM-FIN-001 | Final Test and FTR | /quality/final-test, Detail | Test technicians, Quality | W5 | milestone trigger; SP-14 instrument binding | FL-04 Test (M), FL-02 (F field 8) |
| QM-CAPA/SCAR | CAPA and SCAR | /quality/capa and /scar, List + detail | Quality engineers, manager closes | W5 | none | FL-05 (F SCAR path) |
| QM-DEV-001 | Deviations and Waivers | /quality/deviations, List + detail | not extracted | W5 | none | FL-04 Test (M) |
| QM-CAL-001 | Calibration Register | /quality/calibration, List | not extracted | W5 | none | FL-04 Test (M) |
| RCL-001 | Recall Campaigns | /quality/recalls, Workbench | Quality Manager; executive approves notifications | W5 | through the RMAs it creates | FL-08 (M, F) |
| **Purchasing §11, pp.266-269** | | | | | | |
| PUR-WB-001 | Buyer Workbench | /purchasing/workbench, Workbench | Buyers | W6 | none | |
| PUR-VEND-001/2 | Vendors and AVL | /purchasing/vendors, List + detail | Buyers (cut) | W6 | none | FL-03 (F field 5) |
| PUR-PR/RFQ | Requisitions and RFQs | /purchasing/requisitions and /rfqs, List + detail | Buyers (cut) | W6 | none | FL-03/FL-10 Source (M), FL-10 (F stages 8-9) |
| PUR-PO-001/2 | Purchase Orders | /purchasing/orders, List + detail | not extracted | W6 | none at creation; GRN and match post downstream | FL-03/FL-10 Source (M), FL-10 (F stage 10) |
| LLR-001 | Long Lead Releases | /purchasing/long-lead, Detail | not extracted | W6 | exposure feeds ETO committed cost | FL-10 (M, F §3.2) |
| PUR-EXP-001 | Expedite Board | /purchasing/expedite, Workbench | Buyers | W6 | none | Source (M) |
| **Costing and Pricing §12, pp.269-272** | | | | | | |
| CST-RATE-001 | Work Center Rates | /costing/work-center-rates | not extracted | W6 | none; confirmations absorb at these rates | |
| CST-CE-001 | Cost Estimates | /costing/estimates, Detail | Estimators, cost accountant | W6 | none | FL-02 (F field 2) |
| CST-RUN-001 | Costing Runs | /costing/runs, Wizard | not extracted | W6 | revaluation through the REVAL event key at release | |
| PRC-PL-001 | Price Lists and Agreements | /pricing/price-lists, List + detail | Pricing Manager (cut) | W6 | none | |
| PRC-SUR-001 | Surcharge Rules and Index Values | /pricing/surcharges, Config | not extracted | W6 | #38 true-up at PGI for ship-date-adjusted contracts | FL-02 (T field 7) |
| PRC-SIM | Price Simulation | dialog and /api/v1/pricing/simulate, Dialog | Sales, pricing, audit read | W6 | none | Lead and quote (M) |
| INV-CVA-001 | Cost Variance Workbench | /inventory/valuation/cost-variance, Workbench | Cost accountant, Controller | W6 | none; reads what others posted | FL-03 (F field 12) |
| PRC-MARG | Margin Analysis | /pricing/margin | not extracted | W6 | none | |
| **Controlling §13, pp.272-274** | | | | | | |
| CO-CC/PC-001/2 | Cost and Profit Center Masters | /controlling/*, List + detail + tree | not extracted | W1 | none; rule 7 fallbacks land on the exception report | |
| CO-ALC-001/2 | Allocation Cycles | /controlling/allocations, Config + wizard | Analyst defines (cut) | W6 | #36, net zero at entity level | FL-06 (T) |
| CO-R1..R4 | Controlling Reports (four) | /controlling/reports | not extracted | W6 | none | |
| **Traceability and Barcode §14, pp.274-275** | | | | | | |
| TRC-EXPL | Trace Explorer | /traceability/explorer | not extracted | W4 | none; reads the append-only event store | FL-08 (M), FL-11 (F §4.4) |
| TRC-DASH | Traceability Completeness Dashboard | /traceability/completeness, Dashboard | Quality IT, quality manager | W7 | none | FL-11 (F §4.3) |
| BC-ADMIN | Label and Scan Administration | /configuration/barcode, Config | Plant IT | W4 | none | |
| **Workflow and Administration §15, pp.275-276** | | | | | | |
| WF-INBOX | Approvals Inbox | /approvals, Workbench | not extracted | W1 | terminal actions release the gated postings | every flow with an approval |
| WF-DEF | Workflow Definitions | /configuration/workflows, Config | Process owners (cut) | W1 | none | |
| OPS-JOBS/INT | Job and Integration Consoles | /operations/* | not extracted | W1 skeleton, W7 hardened | none | |
| CFG-CORE | Core Configuration Set | /configuration/* | not extracted | W1 | period control gates every posting date | FL-06 |
| **Book VII supplemental entries [DOC:pp.279-282 §3]** | | | | | | |
| INV-RETURN | Return (redirect) | redirects, ships no screen | - | W5 | - | FL-05 |
| INV-ITEM-SALES | Item sales tab | not extracted | not extracted | W2 | not extracted | |
| INV-COUNT-DOC | Count documents | not extracted | not extracted | W2 | count variance adjustment [DOC:p.37 §7.6]; SP-20 | FL-06 (F field 6 "count postings settle") |
| INV-PLAN-SAFETY | Safety stock | not extracted | not extracted | W2 | not extracted | |
| INV-CONFIG-PERIOD | Period configuration | not extracted | not extracted | W1 | not extracted | FL-06 |
| INV-CONFIG-TAX | Tax configuration | not extracted | not extracted | W1 | not extracted | FL-01 (F field 5 tax nexus) |

Count check: 10 + 8 + 5 + 6 + 4 + 5 + 8 + 8 + 6 + 8 + 3 + 3 + 4 = 78 Book VI entries, plus 6 Book VII entries, of which INV-RETURN ships no screen: 83 buildable (ASM-SCOPE-1 in `00-inputs/assumptions.md`).

---

## B. Journal posting templates #17 to #38 [DOC:pp.124-125 Part J] (asserted)

Every template posts through the one shared Posting Service: account mapping, dimension derivation, period validation and source back-links in one place; no module posts to the ledger directly [DOC:p.125 Part J Dev Note] (asserted). Templates below #17 belong to the external INV/ACC volumes (ASM-EXT-1).

| # | Transaction | Debit | Credit | Amount basis | Trigger | Screen | Flow |
|---|---|---|---|---|---|---|---|
| *25* | *PGI, sales shipment* | *5120 COGS* | *1330 FG* | *qty x standard* | *shipment post* | *OM-DLV-001* | *FL-01, FL-02, FL-09* |
| 17 | RMA receipt (PE ownership) | 1335 RMA Inventory | 5120 COGS reversal | qty x valuation at original issue | RMA receipt post | RMA-RECEIPT | FL-05 |
| 18 | RMA restock | 1330/1310 Inventory | 1335 | valuation | disposition Restock | RMA-DISP | FL-05 |
| 19 | RMA credit note | 4100 Revenue (+2300 tax reversal) | 1200 AR; 4910 restocking fee portion | credit value | credit note from CMR (ACC 4) | RMA-DISP | FL-05 |
| 20 | RMA scrap | 5320 Scrap and Waste | 1335 | valuation | disposition Scrap | RMA-DISP | FL-05 |
| 21 | Warranty repair settlement | 2610 Warranty Reserve (overflow 6300) | 1325 WIP-Rework | actual repair cost | RWO close (warranty) | RMA-DISP, RWO-001 | FL-05 |
| 22 | Billable repair | 5130 COGS-Service / 1200 AR | 1325 / 4150 + 2300 | cost; invoice value | RWO close + service invoice | RMA-DISP, RWO-001 | FL-05 |
| 23 | Replacement shipment (warranty) | 6300 Warranty Expense | 1330 FG | standard cost | PGI on $0 replacement SO | RMA-DISP | FL-05 |
| 24 | Warranty reserve accrual | 6300 | 2610 | accrual % x FG shipments | month-end recurring JE | none named | FL-05, FL-06 |
| 25 | PGI, sales shipment | 5120 COGS | 1330 FG | qty x standard | shipment post | OM-DLV-001 | FL-01, FL-02, FL-09 |
| 26 | Freight out accrual | 6410 Freight Out | 2100 AP accrual | quoted freight | PGI on PE-paid terms | OM-DLV-001 | FL-01, FL-09 |
| 27 | Packing materials consumption | 5120 COGS (packaging) | 1360 Packaging on Hand | backflush at standard | HU close | OM-PACK-*, OM-DLV-001 | FL-01, FL-09 |
| 28 | Material issue to WO | 1320 WIP | 1310 RM | qty x valuation | SP-08 / backflush | PP-SFT-001 | FL-02, FL-04 |
| 29 | Labor + overhead applied | 1320 WIP | 7500 Absorption | hours x standard rates | operation confirmation | PP-SFT-001 | FL-04 |
| 30 | Operation scrap | 5320 | 1320 WIP | scrapped value | confirmation scrap qty | PP-SFT-001 | FL-04 |
| 31 | FG production receipt | 1330 FG | 1320 WIP | good qty x standard | receive to stock | not named in Book VI | FL-02, FL-04 |
| 32 | WO settlement variances | 5220/5230/5240/5250 | 1320 WIP | per Part A §8 formulas | order close | PP-SETTLE-001 | FL-02, FL-04 |
| 33 | Rework (production-caused) | 1325 WIP-Rework to parent 1320 | various | actuals | RWO settlement | RWO-001 | FL-04 |
| 34 | Subcontract provision | 1315 Subcontract at Vendor | 1310 RM | valuation | issue to subcontractor | none named | FL-02, FL-03, FL-04 |
| 35 | Subcontract receipt | 1320 WIP | 2110 GR/IR + 1315 | PO price + provided material; variance to 5260 | GRN subcontract | none named | FL-02, FL-03, FL-04 |
| 36 | Allocation cycle | receiver CC 7500 | sender CC 7500 | driver share | period-end run; net zero | CO-ALC-001/2 | FL-06 |
| 37 | Milestone invoice | 1200 AR | 2600 Contract Liability (or 4100 per ASC 606 timing) | milestone % | invoice request post | none named | FL-02 |
| 38 | Surcharge adjustment at PGI | 1200 AR | 4100 (surcharge element) | index delta | ship-date-adjusted contracts | PRC-SUR-001 | FL-02 |

Other postings named only in flow text: GRN DR 13xx / CR 2110 GR/IR, three-way match DR 2110 / CR 2100 with IPV to 5210 (FL-03) [DOC:p.178]; invoice DR 1200 / CR 4100 + 2300 (FL-01) [DOC:p.176]; intercompany pairs and FX to 7100 (FL-07) [DOC:pp.181-182]; E&O reserve DR 6320 / CR 5340 [DOC:p.247 §3] (all asserted).

---

## C. Barcode scan points SP-01 to SP-21 [DOC:pp.95-96 Part F] (asserted)

| SP | Step | Scans (in order) | Validates (error code) | Posts / records | Flow |
|---|---|---|---|---|---|
| *SP-19* | *RMA receipt* | *RMA barcode + serial/batch on crate* | *authorized line/serial (E-RMA-04)* | *return receipt lines* | *FL-05* |
| SP-01 | Receiving, start GRN line | PO barcode or select; item or vendor barcode | item on PO; open qty | GRN line begins | FL-03, FL-10 (T02) |
| SP-02 | Receiving, batch capture | new batch label printed and scanned back | label printed = record created | batch record with vendor batch/heat | FL-03, FL-11 |
| SP-03 | Receiving, serial capture | each serial | format; uniqueness | serial records, status Available / QI Hold | FL-03, FL-11 |
| SP-04 | Putaway | item/batch label + destination bin | bin allowed; capacity | bin transfer | FL-03, FL-11 (T04) |
| SP-05 | QI sample pull | batch + inspector badge | QI Hold status | sample qty to inspection | FL-03 |
| SP-06 | Stock transfer ship/receive | item/batch/serial + from/to bin | transfer doc lines | movements | FL-11 (T04) |
| SP-07 | Terminal login | operator badge | active user; WC assignment | session; labor attribution | FL-04 |
| SP-08 | Material issue to WO op | component batch/serial (+ bin) | component on op list (E-PP-07); batch Unrestricted; FEFO/FIFO or logged override | issue posting #28; genealogy row | FL-04 (T05) |
| SP-09 | Kit/stage delivery to WC | picklist + staging location | kit complete | staged status per op | FL-04 (T05) |
| SP-10 | Operation start | traveler op barcode | predecessors complete; QC gates clear; WO Released | op In Progress; labor clock on | FL-04 (T07) |
| SP-11 | Operation complete | traveler op barcode + qty | good + scrap + rework = started | confirmation; backflush; labor; next-op signal | FL-04 (T07) |
| SP-12 | Serialized component install | parent serial + child serial | child on BOM; child Available/Issued to this WO; not already linked (E-BC-05) | parent-child link; child In Production | FL-04 (T06) |
| SP-13 | Nameplate verification | nameplate serial at WC-600 | scanned = WO serial (E-BC-06) | verification event | FL-04 |
| SP-14 | Test execution | instrument CAL labels + serial | calibration current (E-QM-05) | instruments bound to test record | FL-02, FL-04, FL-03 (T03, T08) |
| SP-15 | Pick confirmation | bin + item/batch/serial + picklist | right batch per FEFO; serial Reserved | pick line confirm | FL-01, FL-09 (T04) |
| SP-16 | Pack, add to HU | HU + item/batch/serial | on pack order; picked | HU content line | FL-01, FL-09 (T10) |
| SP-17 | HU close and label | HU label scan-back + scale weight | weight sanity ±2% | HU Closed; label printed | FL-01, FL-09 (T10) |
| SP-18 | Load and ship | each HU at truck + shipment doc | HU on this shipment (E-BC-08); PSI passed; credit gate | HU Loaded; completeness enables PGI | FL-01, FL-09 (T11) |
| SP-19 | RMA receipt | RMA barcode + serial/batch | authorized line/serial (E-RMA-04) | return receipt lines | FL-05 (T12) |
| SP-20 | Cycle/physical count | bin + item/batch (+ serials) | on count doc; frozen state | count entry | FL-06 (counts) |
| SP-21 | Scrap bin confirmation | item/batch + scrap location | disposition approved | scrap issue posting | FL-04, FL-05 |

Platform rules: Code128 internal; offline queue 4 h; reprint needs a reason; scan feedback under 400 ms P95 [DOC:pp.93-97 §F; p.131 §K4; p.242 §10] (asserted). Flow column: FL-11 event IDs are from [DOC:p.211 §4.1]; other flow links are from each flow's field 8 (asserted).

---

## D. Traceability events T01 to T13 [DOC:p.211 Book IV §4.1] (asserted)

| Event | Captured at | Mandatory identity and evidence |
|---|---|---|
| *T11 Ship/deliver* | *SP-18 + PGI + POD* | *shipment, BOL, carrier, customer, site, PGI doc, POD, condition* |
| T01 Supplier source | PO release (FL-10 stage 10) | vendor, site, PO line, manufacturer/MPN, STP version |
| T02 Receipt identity | GRN (SP-01 to 03) | GRN, internal batch/serial, vendor batch/heat, qty, CoO, dates, certificate checksums |
| T03 Incoming quality | inspection close | plan + revision, sample, results, instrument (SP-14), inspector, disposition, NCR/SCAR |
| T04 Stock movement | SP-04/06/15/21 | from/to bin, stock status, ownership, batch/serial/HU, qty, user/device |
| T05 Reservation/issue | SP-08/09 | SO/WO/op, material, batch/serial, qty, bin, operator, event ID |
| T06 Parent-child install/remove | SP-12 + rework removals | parent, child, op, installed/removed, reason |
| T07 Operation confirmation | SP-10/11 | WO/op, MBOM + routing revisions, good/scrap/rework, labor, tool/machine |
| T08 Test/inspection | final test / IPQC | serial, plan revision, run, results, calibration state, tester |
| T09 Finished receipt | FG receipt | serial, WO, standard cost version, location, quality status |
| T10 Pack/HU | SP-16/17 | HU/SSCC, contents, weights, label IDs, seals |
| T11 Ship/deliver | SP-18 + PGI + POD | shipment, BOL, carrier, customer, site, PGI doc, POD, condition |
| T12 Return/service | SP-19 + RMA/RWO events | RMA, condition, repair/removal/install, replacement serial, disposition |
| T13 Recall/containment | FL-08 campaign actions | campaign, population version, holds, notifications, recovery, effectiveness |

Correction rule: genealogy rows are never updated or deleted; a correction is a reversal event plus a replacement event; correction status Active / Reversed / Replacement [DOC:p.212 §4.2-4.3] (asserted).

---

## E. Status lists

Names as listed in the source table, in order. "Count stated" is the count the digest or the document gives; where the names read differ from it, the row says so and the gap is logged in `kb-index.md` section 6 (not resolved here).

| Object | Statuses (in order) | Count stated | Source |
|---|---|---|---|
| *Handling unit* | *Open, Closed, Loaded, Shipped* | *4* | *[DOC:pp.31-32 §5] (asserted)* |
| Quotation | Draft, Internal Review, Issued, then Won / Lost / Expired / Superseded | 7 | [DOC:p.51 §3.3] (asserted) |
| Sales order | Draft, Submitted, Credit Hold, Confirmed, In Fulfillment, Partially Shipped, Shipped, Invoiced/Closed, Cancelled; Rejected appears as an exit from Submitted | 8 (digest 02); 9 names read | [DOC:p.54 §4.6] (asserted) |
| SO schedule line (Book IV) | Open, Confirmed, Allocated/Pegged, Delivery Due, Partially Delivered, Delivered, Closed / Cancelled | not stated | [DOC:p.206 §2.1] (asserted) |
| Delivery | Planned, Released, Picking, Packed, Quality Cleared, Loaded, PGI, Delivered/Closed | not stated | [DOC:p.207 §2.4] (asserted) |
| Handling unit | Open, Closed, Loaded, Shipped | 4 | [DOC:pp.31-32 §5] (asserted) |
| POD | Expected, Received / Exception, Resolved/Closed | not stated | [DOC:p.207 §2.4] (asserted) |
| RMA | Draft, Pending Approval, Authorized, Partially Received, Received, In Inspection, Disposition Pending, Settling, Closed, Rejected / Cancelled; transition-only names Closed Short and Reopened | 11 (digest 01); 10 rows read | [DOC:pp.22-26 §3.8] (asserted) |
| EBOM | Draft, In Review, Released, Superseded, Obsolete | 5 | [DOC:pp.61-62 §3.4] (asserted) |
| Release level (design package) | Concept, Preliminary/RFQ, Long-Lead Purchase Release, Approved for Purchase, Released for Production, Superseded/Obsolete; forward only except via ECO | not stated | [DOC:pp.208-209 §3.1] (asserted) |
| STP acknowledgement | Acknowledged, Exception, Rejected | 3 | [DOC:p.209 §3.3] (asserted) |
| Production order (WO) | Created, Released, In Progress, Testing, Completed, Closed (TECO), On Hold, Cancelled | 7 (digest 02); 8 names read | [DOC:pp.74-75 §5.3] (asserted) |
| Purchase requisition | Open, In Approval (manual/expense only), Approved, Converted / Rejected / Cancelled | 6 | [DOC:p.102 §3] (asserted) |
| RFQ | Draft, Issued, Responses In, Awarded / Cancelled | 4 (digest 03); 5 names read | [DOC:p.103 §4] (asserted) |
| Purchase order | Draft, In Approval, Approved, Sent, Confirmed, Partially Received, Received, Matched/Closed; Cancelled; Change Pending overlay | 9 | [DOC:p.104 §5] (asserted) |
| Inspection plan | Draft, In Review, Active, (rest not extracted) | not extracted | [DOC:p.35 §6.4] (asserted) |
| Material lifecycle | Draft, Data Completion, Active, Restricted, Blocked, Obsolete; function-specific blocks sit on top | 6 | [DOC:p.149 §4.1] (asserted) |
| Fiscal period (ACC-owned) | Open, Soft Close, Hard Close, Year-End Closed; one Open, at most one Soft Close (R-PER-01) | 4 | [DOC:pp.41-42 §9.1] (asserted) |
| Recall campaign | Identify, Contain, Notify, Recover, Disposition, Effectiveness, Closed | 7 | [DOC:p.182 FL-08 field 4] (asserted) |
| Genealogy event correction | Active, Reversed, Replacement | 3 | [DOC:p.212 §4.2] (asserted) |
| Serial (as seen in scan points) | Available, QI Hold, Reserved, In Production, Shipped (full list not extracted) | not stated | [DOC:pp.95-96 §F; p.208 §2.5] (asserted) |
| Count document | names not extracted | 9 | [DOC:pp.36-37 §7] (asserted) |
| CAPA | names not extracted | 7 | [DOC:p.88] (asserted) |
| Vendor onboarding | names not extracted | 4 | [DOC:pp.101-107 §G] (asserted) |

---

## F. Approval limits and thresholds

| Rule | Value | Approver / effect | Source |
|---|---|---|---|
| *PO approval ladder* | *≤$25k / ≤$250k / above / >$1M* | *Buyer / Purchasing Mgr / +Controller / +CFO* | *[DOC:p.11 §W.4; p.100; p.178] (asserted)* |
| Shared approval engine | one engine, 27 workflows, no module-specific approvals | delegation prohibited above $250k for financial approvals | [DOC:pp.10-12 §W] (asserted) |
| RFQ required | >$25k uncontracted | buyer must RFQ | [DOC:p.100 §G] (asserted) |
| Unconfirmed PO | 3 business days | surfaces for follow-up | [DOC:p.104 §G] (asserted) |
| PO price deviation | >5% | flag | [DOC:p.104 §G] (asserted) |
| Info record invoice deviation | >5% | buyer alert | [DOC:p.157 §7.2] (asserted) |
| RMA approval | ≤$10,000 CS Manager; RC3/warranty +Quality Mgr; >$50,000 +Controller; goodwill +Controller | | [DOC:p.21, p.27 §3] (asserted) |
| RMA SLA / reopen / restocking | 5 business days receipt-to-inspection; reopen within 30 days by Controller; restocking 15% / 10% / 0%; no-reference credit at list less 20% | | [DOC:pp.26-27 §3.8-3.10] (asserted) |
| No-quote sales order | >$250k | Sales Director (R-OM-02) | [DOC:p.52 §4.1] (asserted) |
| Price change on sales tab | >±5% | approval required | [DOC:pp.28-29 §4] (asserted) |
| Price floor | PC-100 22%, PC-300 18% | CFO if more than 5 points below floor | [DOC:p.122 §I6] (asserted) |
| Credit check | 4 points; unpaid >30 days blocks | Controller releases; Sales cannot release credit holds | [DOC:p.49 §2.2; p.176 field 13] (asserted) |
| Reallocation of confirmed supply | any | Sales Director; audit pair on both orders | [DOC:p.207 §2.2] (asserted) |
| PGI reversal | before invoice, same fiscal period | Shipping Manager, reason mandatory; after invoice only credit/rebill or RMA | [DOC:p.208 §2.5] (asserted) |
| HU gross weight | ±2% | blocks HU close | [DOC:p.32 §5; p.96 SP-17] (asserted) |
| ETO milestones | 20/10/20/30/15/5% | each invoice posted by Finance after evidence review | [DOC:p.53 §4.4; p.177] (asserted) |
| Budgetary quote | ±25%; validity 30 days default | | [DOC:p.50 §3.1] (asserted) |
| ECR Emergency | CCB within 24 h; CCB adds Controller if cost delta >$10k | | [DOC:p.62 §4.1] (asserted) |
| LLR approval | Engineering Mgr + Purchasing Mgr; Controller above $100k exposure or risk High; cap breach blocks POs (E-DTS-02) | | [DOC:p.209 §3.2] (asserted) |
| WO release | 6 hard checks; Release Short planner override | | [DOC:p.74 §5.2] (asserted) |
| Labor guardrail | ±20% | | [DOC:pp.78-80] (asserted) |
| WO unsettled | Completed >5 days is a breach | | [DOC:p.126; p.179] (asserted) |
| WO reopen | | Controller | [DOC:p.179 field 4] (asserted) |
| Count recount / approval | recount at ±2% or ±$500; supervisor ≤$2,000/line, ≤$10,000/doc; Controller >$25,000 | | [DOC:pp.36-37 §7] (asserted) |
| Period reopen | | Controller + CFO | [DOC:pp.41-42 §9; p.180] (asserted) |
| Safety stock change | >25% | Planning Manager | [DOC:pp.43-44 §10] (asserted) |
| Inspection switching | tighten at 2 of 5 rejected; reduce after 10 accepted; skip-lot N=5, ≥98% | ANSI/ASQ Z1.4 | [DOC:pp.33-35 §6] (asserted) |
| SCAR | 2 overdue restrict vendor | | [DOC:pp.88-90] (asserted) |
| IC price deviation | from transfer price list | Controller on both sides | [DOC:p.181 FL-07 field 4] (asserted) |
| Recall external notification | | dual approval Quality Manager + executive | [DOC:p.182 FL-08 field 4] (asserted) |
| Tax | Avalara; 6-step precedence; nexus alert at 80%; US + Canada | | [DOC:pp.45-46 §11] (asserted) |

---

## G. Roles named per flow (owners from field 3, separations from field 13)

| Flow | Owners named | Separation of duties stated | Source |
|---|---|---|---|
| *FL-05* | *Customer Service to Authorized; Receiving/Quality the middle; Finance settlement* | *adjudicator ≠ credit approver; receiving cannot disposition* | *[DOC:pp.179-180] (asserted)* |
| FL-01 | Sales Admin until Confirmed; Warehouse pick/pack/ship; Finance invoice to cash | Sales cannot release credit holds; shipping cannot edit prices; PGI role ≠ invoice-posting role | [DOC:p.176] (asserted) |
| FL-02 | SO line commercial anchor; Engineering Request owns design; WO owns build; revenue contract owns recognition | engineer cannot approve own EBOM release; milestone evidence reviewer ≠ SO owner; costing release ≠ costing mark | [DOC:p.177] (asserted) |
| FL-03 | Buyer to Confirmed; Receiving owns GRN; AP owns invoice and payment | PO create ≠ GRN post ≠ invoice approve ≠ payment release; vendor bank changes dual-approved | [DOC:p.178] (asserted) |
| FL-04 | Planner (planned order); Production Scheduler owns WO to close; operators own confirmations | WO confirm ≠ settlement approve; scrap beyond threshold needs supervisor + reason; standards never manually editable | [DOC:pp.178-179] (asserted) |
| FL-05 | Customer Service; Receiving/Quality; Finance | adjudicator ≠ credit approver; receiving cannot disposition; reopen restricted | [DOC:pp.179-180] (asserted) |
| FL-06 | Controller owns; module owners execute steps | executor ≠ approver where flagged; reopen dual control; allocation posting restricted to Controller | [DOC:pp.180-181] (asserted) |
| FL-07 | initiating entity buyer/CSR; Finance owns IC reconciliation | transfer price maintenance restricted to Controlling; entity data isolation | [DOC:pp.181-182] (asserted) |
| FL-08 | Quality Manager; executive approver for external notifications | dual approval on notification text | [DOC:p.182] (asserted) |
| FL-09 | BPMN lanes: Sales, Pricing, Credit/Finance, Planning, Engineering, Production, Warehouse, Quality, Shipping, Carrier, Accounting; Shipping Manager reverses PGI; Sales Director approves reallocation | not extracted | [DOC:pp.207-208 §2.2, §2.5, §2.6] (asserted) |
| FL-10 | Engineering Manager, Purchasing Manager, Controller (LLR); Engineering + Quality (supplier deviation) | technical pass/fail by Engineering before commercial bids open | [DOC:pp.209-210 §3.2-3.4] (asserted) |
| FL-11 | not stated as owners; completeness dashboard reports with assigned owners | database privileges enforce no destructive edit | [DOC:p.212 §4.3] (asserted) |

Role counts across the document: Sales 7, Engineering 5, Quality 5 roles [DOC:pp.56, 67, 91]; 12 sign-off roles [DOC:p.203] (asserted). No headcounts (ASM-VOL-1). A role-by-action matrix does not exist in the document (ASM-PERM-1).

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`(asserted)` a human said it once, unverified (here: the specification, supplied by the subject expert, not yet confirmed line by line) ·
**FL-nn** a closure flow (FL-01 to FL-08 in Book III, FL-09 to FL-11 in Book IV) · **SP-nn** a barcode scan point · **T01 to T13** a traceability event · **#nn** a journal posting template · **W1 to W7** the seven build waves · **IF-nn** an interface ·
**ASM-ID** a numbered assumption in `00-inputs/assumptions.md` ·
**M / F / T** how a screen is tied to a flow: named in the Book VIII map, named in the flow text, or shares a posting template or scan point with it.
