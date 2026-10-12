# Anchor Analysis - pe-v2

> **What this is.** A close reading of the 312-page ERP build specification, organised by module, so the team can size the build. For each module it lists the screens, when they are built, the rules and statuses that drive them, what they post to the ledger, which barcode scans they use, and which outside systems they talk to. It also lists what the document does not say.
>
> **Where it stands.** First version, 9 October 2026, read from the eight section summaries with a few page checks. Not reviewed by a human.
>
> **What we need from you.** Nothing new. By your instruction there is no question set and no call. The gaps below are carried as assumptions; you accept or correct them at estimation sign-off.

**Phase 1 substitution, stated once.** The discovery call with the domain authority was not held, by user instruction on 2026-10-09 (purpose is estimation; no further questions; build as per the PRD where parts do not interconnect). The PRD stands as the domain authority's written statement. Every claim below is therefore `[DOC]` (asserted). R-SME-SUB stays open. Lite mode applies (CLAUDE.md 3a): `rule_density: low`, so the full silence set is run on the three processes with the most actors and the rest get before / after / failure only.

ASSUMPTIONS this file rests on: ASM-SCOPE-1, ASM-SCOPE-2, ASM-SCOPE-3, ASM-EXT-1, ASM-TIME-1, ASM-LABEL-1, ASM-CAD-1.

## 1. What the document is trying to get approved

It asks a steering group to approve one complete to-be ERP for a single-plant transformer manufacturer: close nine inventory gaps, add sales, engineering, production, quality, procurement and the money layer, and ship it in seven waves over 26 weeks [DOC:p.8; p.130 §K3; p.278 §2] (asserted). It is written by systems and product people, with numbers and IDs everywhere and no operator voice (see OQ-10). It pre-empts doubt by repeating "every screen appears below" and a precedence rule, "Book IV outranks Books I-III" [DOC:p.244; p.204 §1.1] (asserted). The contested ground is scope counting: screen totals, label counts and deferred-module counts disagree with each other (section 7).

## 2. Per-module scope for estimation

Screen counts are the Book VI entries [DOC:pp.244-276 §3-15] plus Book VII supplemental entries [DOC:pp.279-282 §3] (asserted). A "/2" entry is a list and detail pair counted as one entry [DOC:p.244 §1] (asserted). Complexity comes from Book VI's own grouping as summarised in digest 07: posting or scan heavy, structural, or simple [DOC:pp.248-276] (asserted). Waves: W1 weeks 1-4, W2 3-8, W3 6-12, W4 10-18, W5 14-20, W6 16-22, W7 20-26 [DOC:p.244 §1] (asserted).

| Module | Screens | Wave | Key rules and statuses | Postings (template #) | Scan points | Interfaces | Complexity note |
|---|---|---|---|---|---|---|---|
| *Example: Returns/Service* | *5* | *W5* | *RMA 11 statuses; classes RC1-RC4* | *#17-#23* | *SP-19* | *IF-12* | *two posting-heavy screens* |
| Materials | 10 (MM-MAT, MCR, MCH, SUP, IR, SL, VAL, EOR, DQ...) | W1, W2, W6, W7 | 9 material types, type immutable; lifecycle 6 states (Draft to Obsolete); MCR SLA 2 business days; duplicate check trigram ≥0.9 [DOC:pp.137-151] | MM-EOR DR 6320 CR 5340 [DOC:p.248]; matrix resolves every posting [DOC:p.154; p.247] | none | IF-03 in | MM-EOR posting heavy; MM-DQ simple |
| Sales | 8 (OM-LEAD, CUST, QT, SO, BO, DLV, PACK, POD) | W2, W7 | 5 SO types; SO 8 statuses, quote 7; credit check at 4 points; no-quote order >$250k needs Sales Director; price change >±5% approval; ETO milestones 20/10/20/30/15/5%; HU 4 statuses, weight ±2% [DOC:pp.28-32, 48-53] | #25-#27 | SP-15 to SP-18 | IF-04, IF-07, IF-09, IF-16 | OM-SO, OM-LEAD structural; OM-DLV, OM-PACK posting and scan heavy |
| Returns/Service | 5 (RMA-LIST, RMA-RECEIPT, RMA-DISP, IB-001, SVC-SPF-001) | W5 | RMA 11 statuses, RC1-RC4; approval ≤$10k CS Mgr, >$50k +Controller; receipt-to-inspection 5 business days; restocking 15/10/0% [DOC:pp.21-27 §3] | #17-#23 | SP-19 | IF-09, IF-12 | RMA-DISP, RMA-RECEIPT posting heavy |
| Engineering | 6 (ENG-HOME, REQ, BOM-002, DOC, ECR/ECO, MBOM/versions) | W3 | EBOM 5 statuses; ECR Emergency 24 h CCB; CCB +Controller if cost delta >$10k; 3 effectivity modes; ECO atomic release [DOC:pp.54, 61-63] | none | none | IF-03 out | ENG-BOM-002, ECR/ECO structural; ENG-HOME simple |
| CAD/Docs | 4 (CAD-SYNC, CAD-IMP...) | W3 | 10 document types; native files ≤500 MB; floor follows ERP effectivity [DOC:p.64 §5.1; pp.198-199 §G] | none | none | IF-17 | rests on ASM-CAD-1 (PDM undecided) |
| Planning | 5 (PP-MRP-001, CTP, schedule board...) | W4 | Finite capacity with CTP; MRP exceptions EX-01 to EX-07; nightly run; MRP <30 min; CTP <10 s [DOC:p.72 §3; pp.191-193; p.205 §1.2] | none | none | IF-11 | rule heavy, few postings |
| Production | 8 (PP-WC, RTG, WO, DSP, SFT, WIP, RWO-001, SETTLE) | W4 | WO 7 statuses; 6 hard release gates; 14 work centers, efficiency 85%; labor guardrail ±20%; WO unsettled limit 5 days [DOC:pp.69-80; p.126] | #21, #22, #28-#30, #32, #33 | SP-07 to SP-13 | IF-05, IF-06 | PP-SFT, PP-SETTLE, RWO-001 heaviest in the build; PP-WO structural; PP-WIP simple |
| Quality | 8 (QM-DASH, PLAN, EXEC, FIN, CAPA, DEV, CAL, RCL-001) | W5 (QM-PLAN config W2) | Plan types INC/INP/FIN/PSI/RMA; Z1.4 switching (tighten 2 of 5, reduce after 10, skip-lot N=5); CAPA 7 statuses; 2 overdue SCARs restrict vendor; calibration alerts 30/14/3 days [DOC:pp.33-35; pp.86-90] | stock status moves per gate | SP-05, SP-14 | IF-15, IF-20 (deferred) | QM-EXEC, QM-FIN scan heavy; QM-DASH simple; RCL is the only net-new object [DOC:p.183] |
| Purchasing | 6 (PUR-WB, VEND, PR, RFQ, PO, EXP) | W6 | PO 9 statuses, PR 6, vendor 4, RFQ 4; ladder Buyer ≤$25k, Mgr ≤$250k, +Controller, +CFO >$1M; RFQ if >$25k uncontracted; unconfirmed PO flagged after 3 business days [DOC:pp.100-107 §G] | none at creation | SP-01 to SP-04 downstream | IF-01, IF-02, IF-08, IF-10 | moderate; ladder shared with workflow engine |
| Costing/Pricing | 8 (CST-RATE, CE, RUN, PRC-PL, SUR, SIM, INV-CVA, PRC-MARG) | W6 | Standard costing; full run annually, new items weekly, run <60 min; floors PC-100 22%, PC-300 18%, CFO if >5 pts below; 8 CVA variance types, drill ≤3 clicks [DOC:pp.39-40; pp.117-122] | #38; REVAL at release | none | IF-16 (tax on quotes) | PRC-SUR posting heavy; PRC-MARG simple |
| Controlling | 3 (CO-CC/PC, CO-ALC, CO-R1..R4) | W1, W6 | 7 derivation rules; 6 allocation drivers; run ID ALC-YYYYMM-NN [DOC:pp.109-114 §H] | #36 | none | IF-13, IF-14 | CO-ALC posting heavy; CO-R1..R4 is four simple reports |
| Traceability/Barcode | 3 (TRC-EXPL, TRC-DASH, BC-ADMIN) | W4, W7 | Events T01-T13; trace tree <10 s, 5 levels; offline queue 4 h; reprint needs reason [DOC:pp.93-98 §F; pp.211-212] | none | owns SP-01 to SP-21 config | IF-19 | TRC-DASH simple; scan platform is shared infrastructure |
| Workflow/Admin | 4 (WF-INBOX, WF-DEF, OPS-JOBS, period/number series) | W1 (OPS-JOBS hardened W7) | One shared approval engine, 27 workflows; no delegation above $250k; R-PER-01 one Open period, max one Soft Close [DOC:pp.10-12 §W; pp.41-42 §9] | gates every posting | none | IF-18 | foundation: nothing financial ships before W1 [DOC:p.244 §2] |
| Book VII supplemental | 6 listed, 5 buildable (INV-ITEM-SALES, COUNT-DOC, PLAN-SAFETY, CONFIG-PERIOD, CONFIG-TAX; INV-RETURN redirects) | W1, W2 (INV-RETURN W5) | Count doc 9 statuses, recount ±2% or ±$500; safety stock change >25% needs Planning Mgr; Avalara, nexus alert 80% [DOC:pp.36-46; pp.279-282] | count variance adjustment [DOC:p.37 §7.6] | SP-20 | IF-16 | count docs and safety stock appear in the W2 wave list (K-06) |

**Working total: 78 + 5 = 83 buildable entries** (ASM-SCOPE-1). Shared items not counted as screens: 22 posting templates #17-#38 [DOC:pp.124-126 §J], 10 label types (ASM-LABEL-1), the 10-object migration workbook with 12 scripts [DOC:pp.284-285 §6], multi-plant screens built in W4 but switched off until DEC-07 [DOC:p.282 §4], and 20 interfaces [DOC:pp.184-186 §B] (all asserted). Screen ID lists marked "..." were partly read from a targeted search of Book VI and are not complete.

## 3. Processes and actors

The eight closure flows are the process inventory: FL-01 MTS order to cash, FL-02 ETO quote to cash, FL-03 procure to pay, FL-04 plan to produce, FL-05 RMA, FL-06 period close, FL-07 intercompany, FL-08 recall [DOC:p.176 §A] (asserted). FL-09 to FL-11 test packs gate go-live [DOC:p.219 §9.3] (asserted). Actors are titles only: Sales 7, Engineering 5, Quality 5 roles [DOC:pp.56, 67, 91], the approval ladder titles [DOC:p.11 §W.4] and 12 sign-off roles [DOC:p.203] (asserted). No headcounts (ASM-ROLE-1, ASM-VOL-1).

## 4. Commitments, ranked by what they constrain

Authority class: the document states no source (law, contract, policy) for any of these, so all are read as **policy** (see OQ-7), except tax and the Z1.4 sampling standard, which cite an outside standard.

| # | Rule as stated | Authority | What it constrains | Ranked |
|---|---|---|---|---|
| *C-0* | *"one shared approval engine" [DOC:p.10 §W.1]* | *policy* | *every approval screen and status* | *1* |
| C-1 | One shared approval engine, 27 workflows, no module-specific approvals [DOC:pp.10-12 §W] | policy | every approval in every module | 1 |
| C-2 | Book IV outranks Books I-III; referenced section wins on disagreement [DOC:p.204 §1.1; p.277] | policy | how every contradiction in section 7 reads | 2 |
| C-3 | Every posting resolves through the account determination matrix [DOC:p.154; p.247] | policy | all 22 templates, all financial screens | 3 |
| C-4 | R-PER-01 one Open period, max one Soft Close; reopen needs Controller + CFO [DOC:pp.41-42 §9] | policy | every posting date in every module | 4 |
| C-5 | WO release: 6 hard checks [DOC:p.74 §5.2] | policy | production, planning, materials readiness | 5 |
| C-6 | Material type immutable; new material only via MCR [DOC:p.137 §2.1; p.245] | policy | materials, engineering placeholder path | 6 |
| C-7 | PO and RMA amount ladders [DOC:p.11; p.21] | policy | purchasing, returns, workflow | 7 |
| C-8 | Inspection switching per ANSI/ASQ Z1.4 [DOC:pp.33-35 §6] | outside standard | quality plans and execution | 8 |
| C-9 | Tax: Avalara, 6-step precedence, US + Canada [DOC:pp.45-46 §11] | outside service | sales, RMA, pricing | 9 |

## 5. Silences

Full set on the three processes with most actors (FL-02, FL-04, FL-05); before / after / failure on the rest.

| Process | Class | The document does not say |
|---|---|---|
| *FL-05 RMA* | *REVERSAL* | *how a wrong disposition is undone after posting* |
| FL-02 ETO | VOLUME | how many ETO orders run at once [DOC silent, digest 02] |
| FL-02 ETO | AUTHORITY | price floor and discount limits for sales roles [DOC silent, digest 02] |
| FL-02 ETO | EXCEPTION | what happens to billing milestones when an ECO changes scope mid-order |
| FL-04 plan to produce | FAILURE | what operators do when the kiosk offline queue exceeds 4 h [DOC:p.93 states only the limit] |
| FL-04 plan to produce | BOUNDARY | WO settlement across a Soft Close period |
| FL-05 RMA | REVERSAL | how a posted disposition is reversed |
| FL-05 RMA | VOLUME | return volume per month |
| FL-03, FL-06, FL-07, FL-08 | FAILURE | integration outage handling beyond DLQ after 24 h [DOC:pp.184-185] (ASM-EXC-1) |
| Migration | FAILURE | rollback if mock 2 or cutover fails [DOC silent, digest 04] |
| All | BEFORE / BOUNDARY | base INV V3.0 and ACC V2.0 behaviour these flows extend (ASM-EXT-1) |

## 6. Asserted gaps

Nine inventory gap items (RMA, sales tab, packing, inspection, counts, CVA, fiscal periods, safety stock, tax) [DOC:pp.13-46; p.278 §2] (asserted). No evidence of the pain behind them is attached; they are stated as deficiencies of INV V3.0, which we do not have.

## 7. Internal contradictions

Listed, not resolved. K-01 to K-09 are in `STATE.md > Open contradictions`. Three new ones found in this pass and the glossary pass (K-12):

| # | Statement A | Statement B |
|---|---|---|
| *K-nn* | *what one page says [DOC:p.x]* | *what another page says [DOC:p.y]* |
| K-10 | IF-20 scale/instrument capture is Phase 2 [DOC:p.186 §B] | IF-20 instrument interfaces and OEE automation are Phase 3 [DOC:p.205 §1.2] |
| K-11 | Invoice delivery by EDI is Phase 3 [DOC:p.49 §2] | EDI 850/855/856/810 is Phase 2 [DOC:pp.204-205 §1.2] |
| K-12 | Nine material types including NSTK (non-stock) [DOC:p.137 §2.1] | Glossary lists eight types, no non-stock [DOC:p.224] |

## 8. Verification agenda (ordered; no call by user instruction)

Carried in the assumption register, not asked: (1) ASM-EXT-1 base specs, (2) ASM-PERM-1 role matrix, (3) ASM-ROLE-1, (4) ASM-EXC-1, (5) ASM-OQ-1, then estimate-only items ASM-SCOPE-1/2, ASM-LABEL-1, ASM-CAD-1, ASM-VOL-1.

## 9. Open questions (model inferences, not rules)

- Authority class "policy": see OQ-7.
- Book VI vs Book V counts: see OQ-8.
- Receiving scans: see OQ-9.

Hand-offs: terms to `glossary.md`; FL-01 to FL-08 as the process inventory for to-be flows.

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`LLM` tag: inferred by a model and not yet verified; such content lives only in `open-questions.md` ·
`(asserted)` a human said it once, unverified ·
`(inferred)` nobody has said it; reasoning produced it.
**ASM-** an entry in `00-inputs/assumptions.md` · **K-nn** a row in `STATE.md > Open contradictions` ·
**FL-nn** a closure flow in Book III · **SP-nn** a barcode scan point · **IF-nn** an interface ·
**W1 to W7** the seven build waves · **#nn** a journal posting template.
**Authority class** why a rule exists: law, contract, policy or preference ·
**R-SME-SUB** the risk that the subject expert stands in for real users.
