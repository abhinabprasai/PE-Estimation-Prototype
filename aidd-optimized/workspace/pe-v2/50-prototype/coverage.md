# Prototype coverage against the PRD - pe-v2

> **What this is.** Every screen entry in the PRD (Book VI 78 plus Book VII 6) and whether the FL-09
> throwaway prototype builds it. The source list is `20-research/client/2026-10-09-prd2-reference-tables.md` section A.
>
> **Where it stands.** The prototype covers 7 of 84 entries. By design it covers one flow
> (FL-09) end to end. The other ten flows (FL-01 to FL-08, FL-10, FL-11) are specified in the
> knowledge base and the reference flows, but they are not in the prototype.
>
> **What we need from you.** A decision: keep the one-flow prototype for Gate 1, or extend it.

| Module | Entries | In prototype |
|---|---|---|
| Materials | 10 | 0 |
| Sales | 8 | 5 |
| Returns | 5 | 0 |
| Engineering | 6 | 0 |
| CAD and Documents | 4 | 0 |
| Planning | 5 | 1 |
| Production | 8 | 0 |
| Quality | 8 | 0 |
| Purchasing | 6 | 0 |
| Costing and Pricing | 8 | 0 |
| Controlling | 3 | 0 |
| Traceability and Barcode | 3 | 0 |
| Workflow and Administration | 4 | 1 |
| Book VII supplemental entries [DOC:pp.279-282 | 6 | 0 |
| **Total** | **84** | **7** |

| Screen ID | Title | Wave | Flows | Prototype |
|---|---|---|---|---|
| **Materials** | | | | |
| MM-MAT-001 | Material Listing | W2 | - | not built |
| INV 2.3 + MM views | Material Detail (ten views) | W2 | - | not built |
| MM-MCR-001/2 | Material Creation Requests | W2 | FL-10 (F stage 3), FL-03/FL-10 Source (M) | not built |
| MM-MCH-001 | Material Change Requests | W2 | - | not built |
| MM-SUP-001 | Supersessions | W6 | - | not built |
| MM-IR-001/2 | Purchasing Info Records | W6 | FL-03 (F field 5), Source (M) | not built |
| MM-SL-001 | Source Lists | W6 | FL-03 (F field 5) | not built |
| MM-VAL-001 | Account Determination Workbench | W1 | every posting flow | not built |
| MM-EOR-001 | Excess and Obsolete Reserve Run | W6 | FL-06 (F field 6) | not built |
| MM-DQ-001 | Data Quality Dashboard | W7 | - | not built |
| **Sales** | | | | |
| OM-LEAD-001/2 | Leads and Opportunities | W2 | spine start [DOC:p.276 §16] | not built |
| OM-CUST-001/2 | Customer Master | W2 | FL-01/FL-02 Lead and quote (M) | not built |
| OM-QT-001/2 | Quotations | W2 | FL-01/FL-02 (M) | full |
| OM-SO-001/2 | Sales Orders with Schedule Lines | W2 | FL-01, FL-02 (M), FL-09 (F §2.1) | full |
| OM-BO-001 | Backorder Workbench | W7 | FL-09 (F §2.2), Order (M) | not built |
| OM-DLV-001 | Delivery Cockpit | W7 | FL-09 (M, F §2.4), FL-01 (T) | full |
| OM-PACK-* | Packing Queue and Pack Station | W2 | FL-09 (M), FL-01 (T) | full |
| OM-POD-001 | POD and Claims | W7 | FL-09 (M, F §2.4) | full |
| **Returns** | | | | |
| RMA-LIST/CREATE | RMA Register and Authorization | W5 | FL-05 (M, F) | not built |
| RMA-RECEIPT | Return Receipt | W5 | FL-05 (T) | not built |
| RMA-DISP | Inspection and Disposition | W5 | FL-05 (T) | not built |
| IB-001 | Installed Base | W5 | FL-05/FL-08 Service (M) | not built |
| SVC-SPF-001 | Spares Finder | W5 | - | not built |
| **Engineering** | | | | |
| ENG-HOME-001 | Engineering Workspace | W3 | - | not built |
| ENG-REQ-001 | Engineering Request | W3 | FL-02/FL-10 Design (M), FL-10 (F stage 1) | not built |
| ENG-BOM-002 | EBOM Editor | W3 | FL-02/FL-10 Design (M) | not built |
| ENG-ECR/ECO | Change Requests and Change Orders | W3 | FL-10 (F stage 12) | not built |
| MBOM-TRF | MBOM Transform | W3 | spine [DOC:p.276 §16] | not built |
| PV-001 | Production Versions | W3 | - | not built |
| **CAD and Documents** | | | | |
| ENG-DOC-001/2 | Controlled Documents | W3 | FL-02/FL-10 Design (M) | not built |
| TR-001 | Transmittals | W3 | FL-02 (M, F field 8) | not built |
| CAD-SYNC | CAD Sync Monitor and Conflict Queue | W3 with the connector | - | not built |
| CAD-IMP | CAD BOM Import | W3 | - | not built |
| **Planning** | | | | |
| PP-MRP-001 | MRP Workbench | W4 | FL-04 Build (M) | not built |
| PLO-001 | Planned Orders | W4 | FL-04 (F field 3) | not built |
| SCH-BOARD | Schedule Board | W4 | FL-04 Build (M) | not built |
| CTP-DLG | Promise Dialog | W4 | FL-01/FL-02 Lead and quote (M) | partial (one order) |
| AT-RISK | At Risk Promises | W4 | - | not built |
| **Production** | | | | |
| PP-WC-001/2 | Work Centers | W4 | - | not built |
| PP-RTG-001/2 | Routings | W4 | - | not built |
| PP-WO-001/2 | Production Orders | W4 | FL-04 Build (M) | not built |
| PP-DSP-001 | Dispatch List | W4 | - | not built |
| PP-SFT-001 | Shop Floor Terminal | W4 | FL-04 (M "kiosk terminal", T) | not built |
| PP-WIP-001 | WIP Board and Valuation | W4 | FL-04 (F field 12 WIP report) | not built |
| RWO-001 | Rework Orders | W4 | FL-05 (T #21 #22), FL-04 (T #33) | not built |
| PP-SETTLE-001 | Settlement Run | W4 | FL-04, FL-02 (T) | not built |
| **Quality** | | | | |
| QM-DASH-001 | Quality Dashboard | W5 | - | not built |
| QM-PLAN-001/2 | Inspection Plans | W2 config, W5 full | FL-03 (F field 8), FL-02 (F field 5) | not built |
| QM-EXEC | Inspection Execution | W5 | FL-03 (F field 8), FL-10 (F stage 14), FL-11 (T T03) | not built |
| QM-FIN-001 | Final Test and FTR | W5 | FL-04 Test (M), FL-02 (F field 8) | not built |
| QM-CAPA/SCAR | CAPA and SCAR | W5 | FL-05 (F SCAR path) | not built |
| QM-DEV-001 | Deviations and Waivers | W5 | FL-04 Test (M) | not built |
| QM-CAL-001 | Calibration Register | W5 | FL-04 Test (M) | not built |
| RCL-001 | Recall Campaigns | W5 | FL-08 (M, F) | not built |
| **Purchasing** | | | | |
| PUR-WB-001 | Buyer Workbench | W6 | - | not built |
| PUR-VEND-001/2 | Vendors and AVL | W6 | FL-03 (F field 5) | not built |
| PUR-PR/RFQ | Requisitions and RFQs | W6 | FL-03/FL-10 Source (M), FL-10 (F stages 8-9) | not built |
| PUR-PO-001/2 | Purchase Orders | W6 | FL-03/FL-10 Source (M), FL-10 (F stage 10) | not built |
| LLR-001 | Long Lead Releases | W6 | FL-10 (M, F §3.2) | not built |
| PUR-EXP-001 | Expedite Board | W6 | Source (M) | not built |
| **Costing and Pricing** | | | | |
| CST-RATE-001 | Work Center Rates | W6 | - | not built |
| CST-CE-001 | Cost Estimates | W6 | FL-02 (F field 2) | not built |
| CST-RUN-001 | Costing Runs | W6 | - | not built |
| PRC-PL-001 | Price Lists and Agreements | W6 | - | not built |
| PRC-SUR-001 | Surcharge Rules and Index Values | W6 | FL-02 (T field 7) | not built |
| PRC-SIM | Price Simulation | W6 | Lead and quote (M) | not built |
| INV-CVA-001 | Cost Variance Workbench | W6 | FL-03 (F field 12) | not built |
| PRC-MARG | Margin Analysis | W6 | - | not built |
| **Controlling** | | | | |
| CO-CC/PC-001/2 | Cost and Profit Center Masters | W1 | - | not built |
| CO-ALC-001/2 | Allocation Cycles | W6 | FL-06 (T) | not built |
| CO-R1..R4 | Controlling Reports (four) | W6 | - | not built |
| **Traceability and Barcode** | | | | |
| TRC-EXPL | Trace Explorer | W4 | FL-08 (M), FL-11 (F §4.4) | not built |
| TRC-DASH | Traceability Completeness Dashboard | W7 | FL-11 (F §4.3) | not built |
| BC-ADMIN | Label and Scan Administration | W4 | - | not built |
| **Workflow and Administration** | | | | |
| WF-INBOX | Approvals Inbox | W1 | every flow with an approval | partial (FL-09 approvals only) |
| WF-DEF | Workflow Definitions | W1 | - | not built |
| OPS-JOBS/INT | Job and Integration Consoles | W1 skeleton, W7 hardened | - | not built |
| CFG-CORE | Core Configuration Set | W1 | FL-06 | not built |
| **Book VII supplemental entries [DOC:pp.279-282** | | | | |
| INV-RETURN | Return (redirect) | W5 | FL-05 | not built |
| INV-ITEM-SALES | Item sales tab | W2 | - | not built |
| INV-COUNT-DOC | Count documents | W2 | FL-06 (F field 6 "count postings settle") | not built |
| INV-PLAN-SAFETY | Safety stock | W2 | - | not built |
| INV-CONFIG-PERIOD | Period configuration | W1 | FL-06 | not built |
| INV-CONFIG-TAX | Tax configuration | W1 | FL-01 (F field 5 tax nexus) | not built |

**Flows in the prototype:** FL-09 (sales order to delivery), complete. The MTS order-to-cash part of
FL-01 is partly exercised through it. **Not in the prototype:** FL-02 ETO quote-to-cash, FL-03 procure-to-pay,
FL-04 plan-to-produce, FL-05 RMA and warranty, FL-06 period close, FL-07 intercompany, FL-08 recall,
FL-10 design-to-source, FL-11 end-to-end traceability.
