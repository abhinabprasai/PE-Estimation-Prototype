# PRD2 Flow Cards - pe-v2

> **What this is.** One card per business flow in the client's build specification, FL-01 to FL-11. Each card gathers, in one place, what a designer or a prompt writer needs to build that flow end to end: the records involved, their statuses, the rules and approval limits, who does what, which screens carry it, what it posts to the ledger, and which barcode scans it uses. Every line points back to a page of the specification.
>
> **Where it stands.** First version, 9 October 2026. Built from the eight section digests plus a targeted read of the flow pages the digests pointed to (Book III pp.176-183, Book IV pp.206-212). Not reviewed by a human. Nothing is confirmed.
>
> **What we need from you.** Nothing - this is for reference. If a card misstates the specification, name the flow and the field.

Group: `client/` (the client's own document only). Every line is `[DOC:p.n §x]` (asserted): the specification, supplied by the subject expert and accepted as the written statement of the domain authority, not yet confirmed line by line. Exact IDs for screens, postings, scans and statuses are in `2026-10-09-prd2-reference-tables.md` (tables A to G); this file cites them by ID. Known disagreements: `20-research/kb-index.md` section 6.

**How a card is laid out.** Every Book III flow (FL-01 to FL-08) is written in the document on a 15-field template [DOC:p.176 §A] (asserted); the card keeps the field numbers in brackets so a reader can go back to the page. FL-09 to FL-11 are Book IV contracts with their own structure. The card shape, with one filled example line:

| Card line | What it holds | Example (FL-05) |
|---|---|---|
| *Entities* | *the records the flow creates or changes* | *RMA, RMA line, return receipt, credit note, RWO, replacement SO [DOC:pp.179-180 FL-05 fields 3, 9] (asserted)* |

Lines used on every card: Objective · Trigger · Owners and roles · Entities · Statuses · Rules and thresholds · Screens (Book VI IDs) · Postings · Scans and trace events · Interfaces · Exceptions and reversals · Closure · Tests · Not in the KB.

---

## FL-01 Make-to-Stock order to cash [DOC:pp.176-177 Book III §A]

- **Objective** (1): sell stocked components and standard transformers from FG with credit-safe, tax-correct, reconciled cash closure (asserted).
- **Trigger** (2): confirmed SO with MTS lines; customer Active with Bill-To/Ship-To; price resolved; credit check passed (asserted).
- **Owners and roles** (3, 13): Sales Admin until Confirmed; Warehouse pick/pack/ship; Finance invoice to cash. Sales cannot release credit holds; shipping cannot edit prices; PGI role is not the invoice-posting role (asserted).
- **Entities**: sales order, SO schedule line (Book IV §2.1), delivery, handling unit, invoice request, invoice, cash application (asserted).
- **Statuses** (4): SO lifecycle (table E); shipment statuses per Book I A §5 (HU); invoice/payment statuses live in ACC 3/5, not supplied (ASM-EXT-1). Terminal: Invoiced/Closed (asserted).
- **Rules and thresholds**: credit release by Finance; price-floor breaches need approval (table F: price floor, credit check). Pre-shipment inspection blocks PGI (E-OM-07) (asserted).
- **Screens**: OM-CUST, OM-QT, CTP-DLG, PRC-SIM (lead and quote); OM-SO, OM-BO (order); OM-DLV, OM-PACK, OM-POD (ship and deliver, governed by FL-09) [DOC:p.294 §3] (asserted).
- **Postings** (6, 7): reservation at confirm; pick/pack no GL; PGI #25; packaging #27; freight accrual #26; invoice DR 1200 / CR 4100 + 2300 with Avalara commit (asserted).
- **Scans and trace events** (8): SP-15 pick, SP-16/17 pack, SP-18 load and ship (serial ship status and customer/site write); T10, T11 (asserted).
- **Interfaces** (9): IF-04 SO events, IF-07 shipment events, IF-09 invoice request. PGI is one atomic transaction: stock + serial + journal + invoice request via outbox (asserted).
- **Exceptions and reversals** (10, 11): partial shipment by line split; cancel before PGI releases reservation; after PGI, correction only via RMA (FL-05) or credit/rebill; duplicate PGI structurally impossible; Avalara failover with 15-min recalc queue; bad debt write-off needs Controller (asserted).
- **Closure** (12): all lines Shipped + Invoiced, cash applied or receivable approved open, no open credit requests. Daily PGI COGS vs FG; monthly AR subledger = 1200 (asserted).
- **Tests** (15): TC-O2C-001 to 060, plus 061 to 070 for PGI reversal (Book IV §2.5) (asserted).
- **Performance** (14): PGI under 2 s P95; invoice request visible to Finance under 1 min (asserted).
- **Not in the KB**: ACC invoice and payment statuses (ASM-EXT-1); field tables for OM-SO (reopen Book I B §4, pp.52-54).

## FL-02 Engineer-to-Order quote to cash [DOC:p.177 Book III §A]

- **Objective** (1): custom transformer from firm quote through design, build, test, ship, milestone billing and revenue closure (asserted).
- **Trigger** (2): firm quotation Won, SO with ETO lines (config attributes complete); released cost estimate CE-# linked; estimator and margin approval trail (asserted).
- **Owners and roles** (3, 13): SO line is the commercial anchor; Engineering Request owns design; WO owns build; revenue contract (ACC 24) owns recognition. Engineer cannot approve own EBOM release; milestone evidence reviewer is not the SO owner; costing release is not costing mark (asserted).
- **Entities**: quotation, sales order (ETO lines), cost estimate, engineering request, EBOM, MBOM, production version, transmittal, MCR (placeholder to active), WO, milestone invoice request, revenue contract (asserted).
- **Statuses** (4): SO; engineering request lifecycle (not extracted); EBOM; WO (table E); milestone approvals (asserted).
- **Rules and thresholds**: milestones 20/10/20/30/15/5%; Finance posts each invoice request after evidence review; config change after Design Release only via ECR then Sales Change Order; drawing set released before WO (E-PP-03) (asserted).
- **Screens**: OM-QT, CTP-DLG, PRC-SIM, OM-SO; ENG-REQ-001, ENG-BOM-002, ENG-DOC-001/2, TR-001 (design); CST-CE-001; PP-WO, PP-SFT, QM-FIN-001; PP-SETTLE-001; PRC-SUR-001 [DOC:p.177; p.294 §3] (asserted).
- **Postings** (6, 7): issues to WIP #28; subcontract #34/#35; FG receipt #31 into SO-pegged bucket; PGI #25; milestone invoices #37 (ASC 606, billing plan is not revenue timing); settlement #32; surcharge #38 at PGI (asserted).
- **Scans and trace events** (8): in-process gates per routing; final test + FTR gates the Production Complete milestone (SP-14); full genealogy (asserted).
- **Interfaces** (9): IF-03 engineering events, IF-05 WO events, IF-06 confirmation postings, IF-09 invoice requests; confirmation is atomic: issue + labor + genealogy + WIP journal (asserted).
- **Exceptions and reversals** (11): drawing rejection loop (Revise and Resubmit); WO cancellation dispositions; milestone reversal only via credit note with contract re-measurement; promise-date change control (asserted).
- **Closure** (12): unit delivered, all milestones invoiced, revenue recognised, WO settled to zero WIP, genealogy complete, warranty record active (asserted).
- **Tests** (15): TC-ETO-001 to 080 (asserted).
- **Not in the KB**: what happens to milestones when an ECO changes scope mid-order (anchor-analysis §5 silence); price-floor and discount limits for sales roles (digest 02 silence); ACC 24 revenue rules (ASM-EXT-1).

## FL-03 Procure to pay [DOC:p.178 Book III §A]

- **Objective** (1): demand to paid supplier with three-way-match integrity, PPV capture and supplier-account reconciliation (asserted).
- **Trigger** (2): MRP, reorder or manual PR; source resolved; vendor Active; material purchasable per type matrix (asserted).
- **Owners and roles** (3, 13): Buyer owns PR to PO Confirmed; Receiving owns GRN; AP owns invoice and payment. Four-way separation: PO create, GRN post, invoice approve, payment release; vendor bank changes dual-approved (asserted).
- **Entities**: PR, RFQ, PO, vendor, info record, source list / AVL, GRN, batch/serial, inspection lot, vendor invoice, payment (asserted).
- **Statuses**: PR, RFQ, PO (table E); vendor onboarding 4 (names not extracted) (asserted).
- **Rules and thresholds**: PO ladder Buyer ≤$25k, PM ≤$250k, Controller, CFO >$1M; RFQ if >$25k uncontracted; unconfirmed PO surfaces after 3 business days; over-receipt beyond tolerance blocked (E-MM-11); certificates enforced (E-QM-06) (asserted).
- **Screens**: PUR-WB-001, PUR-VEND-001/2, PUR-PR/RFQ, PUR-PO-001/2, PUR-EXP-001, MM-IR-001/2, MM-SL-001, MM-MCR-001/2, QM-EXEC, INV-CVA-001 [DOC:p.178; p.294 §3] (asserted). Receiving/GRN screens belong to base INV V3.0 (see OQ-9 in `10-discovery/open-questions.md`).
- **Postings** (6, 7): GRN DR 13xx (or MAV) / CR 2110 GR/IR with PPV; QI Hold until inspection; three-way match DR 2110 / CR 2100, IPV to 5210; subcontract #34/#35 with 5260; consignment fill-up posts nothing (asserted).
- **Scans and trace events** (8): SP-01 to SP-05; T01, T02, T03 (asserted).
- **Interfaces** (9): IF-01 PO transmission (email PDF in Phase 1, EDI reserved), IF-02 vendor confirmation, IF-08 GRN events, IF-10 AP match; GRN is atomic (asserted).
- **Exceptions and reversals** (10, 11): duplicate GRN prevented by open-qty lock; duplicate vendor invoice by (vendor, invoice #); RTV with GRN reversal and PPV mirror; short-close with reason (asserted).
- **Closure** (12): PO lines Received + Matched/Closed, GR/IR cleared, payment executed or scheduled, no open NCR/SCAR; GR/IR items over 30 days worked weekly (asserted).
- **Tests** (15): TC-P2P-001 to 070. **Performance**: GRN scan under 400 ms P95; match job under 5 min (asserted).
- **Not in the KB**: base INV receiving screens and ACC AP screens (ASM-EXT-1).

## FL-04 Plan to produce [DOC:pp.178-179 Book III §A]

- **Objective** (1): demand netting to settled production with zero residual WIP and complete genealogy (asserted).
- **Trigger** (2): MRP run inputs; released MBOM + routing (E-PP-01); materials Active; standards released (else warning + CVA exception) (asserted).
- **Owners and roles** (3, 13): Planner owns planned order; Production Scheduler owns WO to close; operators own confirmations at work centers. WO confirm is not settlement approve; scrap beyond threshold needs supervisor + reason; standards never manually editable (asserted).
- **Entities**: planned order, production order (WO), routing, work center, production version, confirmation, genealogy rows, rework order, settlement (asserted).
- **Statuses** (4): WO (table E) with 6 release gates; Release Short override (planner flag); reopen needs Controller (asserted).
- **Rules and thresholds**: finite capacity with CTP at go-live (K-09 closed by the document); MRP exceptions EX-01 to EX-07; nightly run; labor guardrail ±20%; Completed WO unsettled over 5 days is a breach; wrong-material scan hard-blocks (E-PP-07) with auto-NCR on override (asserted).
- **Screens**: PP-MRP-001, PLO-001, SCH-BOARD, PP-WO-001/2, PP-DSP-001, PP-SFT-001, PP-WIP-001, RWO-001, PP-SETTLE-001; test stage QM-FIN-001, QM-CAL-001, QM-DEV-001 [DOC:p.179; p.294 §3] (asserted).
- **Postings** (6, 7): issues/backflush #28; labor/overhead #29; scrap #30; FG receipt #31; settlement #32 to 5220-5250; rework via 1325 (#33); subcontract #34/#35 (asserted).
- **Scans and trace events** (8): SP-07 to SP-13 (SP-14 at test); T05, T06, T07, T08, T09 (asserted).
- **Interfaces** (9): IF-05 WO events, IF-06 confirmation postings, IF-11 MRP proposals; MRP publishes a run-ID-stamped proposal set atomically (asserted).
- **Exceptions and reversals** (10, 11): confirmation idempotent on (WO, op, event UUID), offline replay-safe; shortage release; rework loops; WO cancellation dispositions (finish / stop-scrap / hold); confirmation correction by mirror reversal; settlement reversal on reopen (asserted).
- **Closure** (12): TECO with variances posted and genealogy complete; settled orders leave exactly zero WIP; WIP report = GL 1320 + 1325 (asserted).
- **Tests** (15): TC-PTP-001 to 070. **Performance**: full MRP under 30 min; dispatch refresh under 2 s; terminal offline queue 4 h (asserted).
- **Not in the KB**: what operators do when the offline queue exceeds 4 h; WO settlement across a Soft Close period (anchor-analysis §5 silences).

## FL-05 RMA and warranty resolution [DOC:pp.179-180 Book III §A; Book I Part A §3 pp.21-27]

- **Objective** (1): authorised return through disposition and financial settlement with linked-document closure (asserted).
- **Trigger** (2): approved RMA per policy matrix §3.10; reference document, or the No-Reference exception path (asserted).
- **Owners and roles** (3, 13): Customer Service owns to Authorized; Receiving and Quality own the middle; Finance owns settlement documents. Adjudicator is not the credit approver; receiving cannot disposition; reopen restricted (asserted).
- **Entities**: RMA, RMA line, return receipt, inspection result, disposition (per line), credit note, rework order (RWO), replacement SO, NCR/SCAR, warranty record, installed base entry (asserted).
- **Statuses** (4): RMA (table E); warranty adjudication mandatory when claimed (asserted).
- **Rules and thresholds**: classes RC1 to RC4; approval ≤$10,000 CS Manager, RC3/warranty + Quality Manager, >$50,000 + Controller, goodwill + Controller; receipt-to-inspection 5 business days with alerting; reopen 30 days by Controller; restocking 15% / 10% / 0%; no-reference credit at list less 20% (asserted).
- **Screens**: RMA-LIST/CREATE, RMA-RECEIPT, RMA-DISP, IB-001, RWO-001, QM-CAPA/SCAR; INV-RETURN redirects (Book VII) [DOC:pp.252-254 §5; p.294 §3] (asserted).
- **Postings** (6, 7): receipt #17 to 1335 (or non-valuated customer property); restock #18; credit note #19 with restocking fee 4910; scrap #20; warranty repair #21 against 2610 (overflow 6300); billable repair #22; replacement shipment #23; reserve accrual #24 monthly (asserted).
- **Scans and trace events** (8): SP-19 (E-RMA-04 on unauthorised line/serial); T12 (asserted).
- **Interfaces** (9): IF-12 RMA events feed credit note, RWO and replacement SO, each idempotent on RMA line disposition ID (asserted).
- **Exceptions and reversals** (10, 11): full register Book I A §3.9: no-reference, unauthorised extra, credit hold, wrong serial, freight claims; disposition outcomes run as separate retry-safe steps visible on Settling; credit note reversal via rebill (asserted).
- **Closure** (12): every line at a terminal disposition and all linked documents posted and closed; close checklist 6e: no Settling RMAs with posted-document gaps (asserted).
- **Tests** (15): TC-RMA-001 to 050. **Performance**: settlement documents created under 1 min after disposition approval (asserted).
- **Not in the KB**: how a posted disposition is reversed; return volume per month (anchor-analysis §5 silences); RMA field tables and screen layouts (reopen Book I A §3, pp.21-27).

## FL-06 Period close [DOC:pp.180-181 Book III §A]

- **Objective** (1): monthly operational and financial close with subledger-to-GL tie-out across all volumes (asserted).
- **Trigger** (2): close calendar (ACC 26.1); soft close at day -2 (asserted).
- **Owners and roles** (3, 13): Controller owns the close checklist instance; module owners execute their steps. Executor is not approver where flagged; reopen dual control; allocation posting restricted to Controller (asserted).
- **Entities**: close checklist instance, period, allocation run (ALC-YYYYMM-NN), count document, E&O reserve run, accrual JEs (asserted).
- **Statuses** (4): period Open, Soft, Hard per matrix; R-PER-01 one Open, max one Soft Close; reopen Controller + CFO (asserted).
- **Rules and thresholds**: no back-posting into Closed (E-PER-01); errors E-PER-01 to 04; target day+3 hard close by M7 exit (asserted).
- **Screens**: CFG-CORE (period control), INV-CONFIG-PERIOD, CO-ALC-001/2, MM-EOR-001, INV-COUNT-DOC, INV-CVA-001 (asserted). Close orchestration has no Book VI entry (K-06; ASM-SCOPE-2).
- **Postings** (6, 7): allocations #36; warranty accrual #24; count postings settle; E&O reserve quarterly (DR 6320 / CR 5340); close JEs per ACC (asserted).
- **Scans**: SP-20 counts (asserted).
- **Interfaces** (9): IF-13 close-checklist automation; each auto step queries its module report API (asserted).
- **Exceptions and reversals** (10, 11): steps re-runnable; allocation rerun = reversal + repost; failed batch steps hold the gate; late postings via Soft-Close warnings; corrections next period with Reference Date (asserted).
- **Closure** (12): Hard Close with zero unresolved checklist items and archived close report (asserted).
- **Tests** (15): TC-CLS-001 to 040 (asserted).
- **Not in the KB**: ACC 26 checklist steps (ASM-EXT-1); whether Hard Close and Year-End Closed are ACC statuses (OQ-3).

## FL-07 Intercompany supply [DOC:pp.181-182 Book III §A]

- **Objective** (1): cross-company sale or transfer between PE entities with transfer pricing, IC AR/AP and elimination-ready postings; live at go-live for PE Grid Components and PE Transformer merchandise; full multi-plant transfers activate with plant 2 (asserted).
- **Trigger** (2): IC relationship configured; transfer price list active; both entities' periods open (asserted).
- **Owners and roles** (3, 13): initiating entity buyer/CSR; Finance owns IC reconciliation. Transfer price maintenance restricted to Controlling (asserted).
- **Entities**: paired selling-entity SO (auto) and buying-entity PO, IC relationship, transfer price list (asserted).
- **Statuses** (4): standard SO and PO lifecycles (asserted).
- **Rules and thresholds**: IC price deviations need Controller approval on both sides; pairing is atomic, both documents or neither (asserted).
- **Screens**: no dedicated Book VI entry in the KB; uses OM-SO-001/2 and PUR-PO-001/2. Multi-plant screens build in W4 but stay off until DEC-07 [DOC:p.282 §4] (asserted).
- **Postings** (6, 7): seller DR IC AR / CR IC Revenue + tax; buyer DR inventory / CR IC AP; in-transit 1350; FX differences to 7100 (asserted).
- **Interfaces** (9): IF-14 IC pairing (asserted).
- **Closure** (12): IC AR (seller) = IC AP (buyer) per pair before Hard Close (asserted).
- **Tests** (15): TC-ICO-001 to 030 (asserted).
- **Not in the KB**: IC configuration screen (reopen Book III §F3, p.196).

## FL-08 Recall and suspect-batch campaign [DOC:pp.182-183 Book III §A]

- **Objective** (1): contain, notify, recover and disposition all product affected by a suspect batch or serial population, with regulator-ready evidence (asserted).
- **Trigger** (2): Quality Manager opens a campaign from a suspect batch/serial (NCR, field failure, supplier notice); object RCL-{YYYY}-{SEQ:3}, the only net-new functional object (asserted).
- **Owners and roles** (3): Quality Manager owns; executive approver for external notifications (asserted).
- **Entities**: recall campaign, population (versioned), holds, notification list, recall RMAs (asserted).
- **Statuses** (4): Identify, Contain, Notify, Recover, Disposition, Effectiveness, Closed; external notification text needs dual approval (Quality Manager + executive) (asserted).
- **Rules and thresholds**: Contain mass-applies Blocked status to on-hand affected stock; forward trace under 10 s per tree; effectiveness needs 100% of the population accounted (recovered, field-corrected or documented exception) (asserted).
- **Screens**: RCL-001, TRC-EXPL, IB-001, RMA-LIST/CREATE [DOC:p.294 §3] (asserted).
- **Postings** (7): recall RMAs post per FL-05 templates; campaign cost tagged with campaign ID; reserve raise proposal to Controller (asserted).
- **Trace events**: T13 (asserted).
- **Interfaces** (9): IF-15 campaign bulk jobs with per-item result log; resumable, per-item idempotent (asserted).
- **Tests**: TC-RCL-001 to 030 [DOC:pp.177-199 §A, G, digest 05] (asserted).
- **Not in the KB**: fields 11 to 15 beyond the above (reopen p.183).

## FL-09 Sales order to delivery (Flow A) [DOC:pp.206-208 Book IV §2]

- **Objective**: one execution design for MTS, MTO and ETO fulfillment, adding schedule lines, deterministic delivery split/merge, allocation and backorder, carrier/POD closure and controlled PGI reversal; extends Book I B and INV 5.7 without changing them (asserted).
- **Owners and roles**: BPMN lanes Sales, Pricing, Credit/Finance, Planning, Engineering, Production, Warehouse, Quality, Shipping, Carrier, Accounting; Sales Director approves reallocations; Shipping Manager reverses PGI; CS confirms customer-visible substitutions (asserted).
- **Entities**: SO schedule line (new sub-object), allocation, backorder, delivery, handling unit, load plan, POD, claim (asserted).
- **Statuses**: schedule line; delivery; POD (table E). A schedule line is the unit of confirmation, allocation, backorder and closure; deliveries consume schedule lines, never raw order lines (asserted).
- **Rules and thresholds**: allocation priority: contractual buffers, then customer class A/B/C, then requested date, then entry time; fair-share prorates by open qty. Split mandatory on ship-to, Incoterms, hazmat, over-dimensional, "no partial" flag; elective split default 7 days apart; every split/merge stores the rule ID (E-DLV-01). Carrier and tracking manual in Phase 1 (DEC-04) until IF-21. Missing POD after expected date + N days alerts. POD or site acceptance fires the Delivery/Commissioning milestone exactly once (asserted).
- **Screens**: OM-SO-001/2, CTP-DLG, OM-BO-001, OM-DLV-001, OM-PACK-*, OM-POD-001. UX pack named: order workbench, promise dialog, allocation/backorder, delivery cockpit, pick/pack/load, PGI confirmation, POD/claim [DOC:p.208 §2.6; p.294 §3] (asserted).
- **Postings**: PGI #25, #26, #27; reversal before invoice is an atomic mirror of #25/#26/#27 (asserted).
- **Scans and trace events**: SP-15, SP-16, SP-17, SP-18; T10, T11 (asserted).
- **Exceptions and reversals**: PGI reversal before invoice, same fiscal period, Shipping Manager, reason mandatory (serials Shipped back to Reserved, HUs to Loaded, delivery to Packed, invoice request withdrawn); after invoice only credit/rebill or RMA; a failed PGI leaves the delivery at Loaded; claims (shortage, damage, refusal) reuse RMA/credit paths (asserted).
- **Tests**: TC-FLA-001 to 080 over 16 stages; TC-O2C-061 to 070 (asserted).
- **Not in the KB**: the 16-stage table itself was not found in the pages read (only "stage 7" readiness and "stage 14" freight claims are referenced) [DOC:p.205; p.207]; reopen pp.206-208 or the BPMN-FLA set before specifying stages.

## FL-10 Design to source, engineering to purchasing (Flow B) [DOC:pp.208-210 Book IV §3]

- **Objective**: how an engineering need becomes a revision-correct, compliance-checked purchase, and how engineering change hits open purchase documents; adds release levels, the long-lead purchase release (LLR) and the immutable supplier technical package (STP) (asserted).
- **Owners and roles**: Engineering Manager + Purchasing Manager approve LLRs, Controller above $100k exposure or risk High; Engineering does technical pass/fail before commercial bids open; supplier deviations route to Engineering + Quality (asserted).
- **Entities**: engineering request, release level, placeholder MCR, LLR (LLR-{YYYY}-{SEQ:4}), STP (STP-{SEQ:6}, SHA-256 manifest), RFQ, PR, PO, supplier acknowledgement, supplier deviation, ECO, GRN (asserted).
- **Statuses**: release levels; STP acknowledgement (table E) (asserted).
- **Rules and thresholds**: Preliminary level allows RFQs, blocks POs (E-DTS-01); LLR cap breach blocks further POs (E-DTS-02); superseded STP cannot attach (E-DTS-03); receipt against an unacknowledged revised STP hard-blocks (E-DTS-04); no valid source raises EX-09; an ETO order cannot invoice its Materials milestone with an open LLR exposure decision (asserted).
- **Stages (16)**: 1 trigger, 2 preliminary design + placeholders, 3 MCR, 4 make/buy, 5 LLR decision, 6 STP, 7 source determination, 8 RFQ/technical bid, 9 PR + budget approval, 10 PO creation/release, 11 supplier acknowledgement, 12 engineering change impact, 13 ASN/receipt/provenance, 14 incoming quality, 15 release to production, 16 closure [DOC:p.210 §3.4] (asserted).
- **Screens**: ENG-REQ-001, ENG-BOM-002, ENG-DOC-001/2, TR-001, ENG-ECR/ECO, MM-MCR-001/2, MM-IR-001/2, PUR-PR/RFQ, PUR-PO-001/2, LLR-001, PUR-EXP-001, QM-EXEC [DOC:p.294 §3; p.210] (asserted).
- **Postings**: none of its own; GRN and match per FL-03; LLR exposure feeds ETO committed cost (asserted).
- **Scans and trace events**: SP-01 to SP-03 at receipt; T01 to T04 (asserted).
- **Closure**: PO matched/closed (FL-03), ECO impacts resolved, no open deviation, LLR closed (asserted).
- **Tests**: TC-DTS-001 to 040 (asserted).

## FL-11 End-to-end traceability contract (Flow C) [DOC:pp.211-212 Book IV §4]

- **Objective**: turns the scan points and genealogy model into a binding data contract: event dictionary, mandatory schema, immutable corrections, completeness controls, required outputs (asserted).
- **Entities**: genealogy event (13 types T01 to T13), serial link, batch consumption; schema groups identity, causality, time, product, location/ownership, process references, evidence, integrity (asserted).
- **Statuses**: correction status Active / Reversed / Replacement (asserted).
- **Rules**: no destructive edit (reversal + replacement, enforced by database privileges); every traceability-relevant posting produces exactly one event; a serial has at most one active location, HU, parent and ownership state; batch quantity balance; revision proof (revision effective at execution, never resolved at query time); certificate lineage immutable; recall completeness 100%; daily parity and orphan checks (asserted).
- **Screens**: TRC-EXPL, TRC-DASH, BC-ADMIN; event capture happens in the scan-driven screens of FL-03, FL-04, FL-05, FL-09 (asserted).
- **Scans**: all SP-01 to SP-21 feed events (table D) (asserted).
- **Outputs**: backward trace, forward trace, as-built record, recall population report, certificate dossier (one click per serial), completeness dashboard; tree under 10 s, archive under 60 s (asserted).
- **Tests**: TC-TRC-001 to 040 (asserted).

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`(asserted)` a human said it once, unverified (here: the specification, supplied by the subject expert) ·
**FL-nn** a closure flow · **SP-nn** a barcode scan point · **T01 to T13** a traceability event · **#nn** a journal posting template · **IF-nn** an interface · **E-xxx / EX-nn / V-xxx** an error, exception or validation code in the specification · **TC-xxx** a test case range ·
**K-nn** a row in `STATE.md > Open contradictions` · **ASM-ID** an assumption in `00-inputs/assumptions.md` · **OQ-n** a model-inferred reading held in `10-discovery/open-questions.md` ·
**MTS / MTO / ETO** make to stock / make to order / engineer to order · **PGI** the moment shipped stock leaves the books · **TECO** technically complete · **GR/IR** goods received / invoice received clearing account.
