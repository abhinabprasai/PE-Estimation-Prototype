# Glossary - pe-v2

> **What this is.** The project's shared vocabulary for the transformer ERP. Each word is defined the way the client's specification uses it, and marked by whether a different reading would make the system behave differently. Designers, estimators and developers use these words and no others for labels, fields and statuses.
>
> **Where it stands.** First version, 9 October 2026. Definitions come from the specification itself. Nobody has confirmed them, because by your instruction there is no call and no question round.
>
> **What we need from you.** Nothing now. At estimation sign-off, the requesting user may correct any definition. One clash needs a side picked if the project goes past estimation: whether there are eight or nine material types (K-12).

**Status of every entry.** The discovery call was not held (user instruction, 2026-10-09). The PRD stands as the domain authority's written statement, so definitions quoted from it are `[DOC]` (asserted). None is (confirmed). "Verified by" is therefore blank for every row and is not repeated per row. R-SME-SUB stays open.

**Class.** **RB** rule-bearing: if two people defined it differently, the system would behave differently. **D** descriptive: a name for a thing; a slight misreading is cheap. When unsure, we chose RB.

**Depends** (RB only) counts the module rows in `anchor-analysis.md` section 2 whose screens or rules rest on the definition. The count is our reading (see OQ-1); the modules named are from the document.

## Rule-bearing terms

| Term | Definition (client's words, shortened) | Includes / excludes | Source | Depends | Related, collisions |
|---|---|---|---|---|---|
| *Production Version* | *The approved pairing of one MBOM and one routing for a plant; orders always pick a version* | *excludes loose BOM + routing picks* | *[DOC:p.224] (asserted)* | *3: Engineering, Planning, Production* | *MBOM, Routing* |
| Material Type | The category that decides how a material behaves everywhere; immutable once set | Book II: 9 (RAW, SEMI, FIN, TRADE, PACK, SPARE, CONS, SERV, NSTK). Book V: 8, no non-stock | [DOC:p.137 §2.1; p.224] (asserted) | 6: Materials, Sales, Planning, Production, Purchasing, Costing | **Collision K-12** (8 vs 9) |
| Material lifecycle status | Draft, Data Completion, Active, Restricted, Blocked, Obsolete | excludes function-specific blocks, which sit on top | [DOC:p.149 §4.1] (asserted) | 6 | Function-specific block |
| Function-specific block | An additive block chip that stops one document family for a material, with a reason code | does not change lifecycle status | [DOC:p.148, §4.5] (asserted) | 4: Materials, Sales, Purchasing, Production | Material lifecycle status |
| MCR / MCH | Material creation request / material change request: the only ways to create or change a material | excludes bare record creation | [DOC:p.150 §4.2; p.245] (asserted) | 3: Materials, Engineering, Purchasing | Engineering Placeholder |
| Engineering Placeholder | A Draft item created from engineering with the number reserved, flagged until completed by MCR | Draft only | [DOC:p.60; p.148 §4.3] (asserted) | 2: Engineering, Materials | MCR |
| Production Order (WO) | The document that authorises building one item, collects its costs and carries its serial; 7 statuses | excludes planned orders | [DOC:p.224; pp.74-75] (asserted) | 4: Planning, Production, Quality, Costing | alias "WO"; Planned Order |
| Release Short | Override letting a WO release with shortages; order carries a Shortage badge, items go to the Expedite Board | planner flag only | [DOC:p.74 §5.2] (asserted) | 3: Production, Planning, Purchasing | WO release gates |
| TECO | Closed, technically complete: settlement run performed, variances posted, order locked | requires genealogy complete | [DOC:p.75; p.179] (asserted) | 3: Production, Costing, Controlling | Settlement |
| Settlement | Closing an order's books: actual versus standard, variances posted | WO unsettled >5 days is a breach | [DOC:p.224; p.126] (asserted) | 3 | TECO, Standard Cost |
| Standard Cost | The frozen planned cost of an item, rebuilt by a costing run | excludes Moving Average items | [DOC:p.224] (asserted) | 5: Materials, Production, Costing, Controlling, Purchasing | Moving Average |
| Moving Average | A cost that re-averages with every purchase receipt; used for bought items; method change only at period boundary | | [DOC:p.224; p.155 §5.4] (asserted) | 3 | Standard Cost |
| Valuation Class | The tag deciding which balance-sheet account a material's stock sits in; drives the account matrix | | [DOC:p.224; p.140] (asserted) | 5 | Account determination |
| Soft Close | Period state between Open and Hard Close; R-PER-01 allows max one at a time | periods owned by Finance (ACC) | [DOC:p.41 §9.1] (asserted) | every posting module (11) | Hard Close, R-PER-01 |
| QI Hold | Quality stock status that blocks use until inspection releases it to Unrestricted | | [DOC:p.21; p.84] (asserted) | 4: Returns, Quality, Purchasing, Production | Stock status |
| Soft Freeze | Count lock that blocks movements on counted bins; if off, moved lines are flagged and recounted | | [DOC:p.36 §7] (asserted) | 2: Book VII counts, Traceability | Count document |
| Handling Unit (HU) | A numbered physical package with contents, weights and its own barcode; Open, Closed, Loaded, Shipped | | [DOC:p.225; p.31 §5] (asserted) | 2: Sales, Traceability | SSCC |
| Serial | One physical unit tracked for life: build, test, customer, returns; profiles SN-FIN, SN-COMP, SN-SEMI, SN-NONE | | [DOC:p.225; p.164 §15.2] (asserted) | 5 | Genealogy |
| Batch / Heat | A lot tracked as one identity; for steel and copper the mill heat number is the key | | [DOC:p.225] (asserted) | 4 | Genealogy |
| Peg / De-Peg | Stock reserved to a sales order is invisible to anonymous ATP; release needs a formal De-Peg | | [DOC:p.163] (asserted) | 4: Sales, Planning, Production, Materials | ATP / CTP |
| ATP / CTP | ATP: is there stock by that date. CTP: can we make it by that date, checking materials and capacity | finite capacity at go-live | [DOC:p.224; p.205 §1.2] (asserted) | 3: Sales, Planning, Production | K-09 |
| ECR / ECO | Change request (asks, analyses) and change order (executes, atomic release) | | [DOC:p.225; pp.62-63] (asserted) | 4: Engineering, CAD, Materials, Production | Effectivity |
| Effectivity | When a change takes effect: by date, by serial, or immediately | 3 modes only | [DOC:p.225; p.62] (asserted) | 3 | ECO |
| RMA class | RC1-RC4; sets approvers and disposition paths | | [DOC:p.21 §3] (asserted) | 3: Returns, Quality, Sales | RMA statuses (11) |
| Safety Stock | A quantity floor MRP protects; change >25% needs Planning Mgr | | [DOC:p.225; pp.43-44 §10] (asserted) | 2: Planning, Book VII | SS-BREACH |
| Milestone Billing | Invoicing an ETO order in agreed slices (20/10/20/30/15/5%) | ETO only | [DOC:p.225; p.53 §4.4] (asserted) | 3: Sales, Engineering, Costing | ASC 606 |
| Three-Way Match / GR/IR | Invoice pays only when PO, receipt and invoice agree; GR/IR must net out | | [DOC:p.224] (asserted) | 2: Purchasing, Controlling | IF-10 |
| PGI | The moment shipped stock leaves the books and COGS posts | | [DOC:p.224] (asserted) | 3: Sales, Costing, Traceability | |
| Variance types (CVA) | PPV, IPV, MUV, LRV, LEV, OAV, SPV, RVV | 8 only | [DOC:pp.39-40 §8] (asserted) | 3: Costing, Production, Controlling | PPV |

**Rule-bearing count: 29 terms.**

## Descriptive terms

| Term | Definition | Source |
|---|---|---|
| *Routing* | *The ordered list of operations, with times and work centers, to build something* | *[DOC:p.224] (asserted)* |
| Work Center | A machine, station or crew where operations happen; carries capacity and rates | [DOC:p.224] (asserted) |
| BOM / EBOM / MBOM | Parts list; EBOM as engineering designs it, MBOM as the factory builds it | [DOC:p.224] (asserted) |
| MFG-Add | MBOM lines added by manufacturing that never sync back to the EBOM | [DOC:p.66] (asserted) |
| "EBOM ahead" | Banner when a released EBOM has a newer revision than the active MBOM | [DOC:p.145; p.198] (asserted) |
| STAGE-OUT | FG bin where pegged direct-ship goods wait until PGI | [DOC:p.78] (asserted) |
| Kitting / Staging, Backflush, Confirmation | Delivering components ahead of an operation; automatic consumption on confirm; the operator's report of quantity, scrap, time | [DOC:p.224] (asserted) |
| Info Record, Source List / AVL | Vendor-material commercial memory; allowed and fixed vendors | [DOC:p.225] (asserted) |
| SSCC, FEFO, Genealogy | Shipping-unit licence plate; first-expired-first-out; a serial's permanent family tree | [DOC:p.225] (asserted) |
| Build wave, closure flow, linkage spine, "Arrives from" | Document structure words: W1-W7, FL-01..11, lead-to-recall chain, an entry's inbound link | [DOC:p.244; p.176; pp.276-277] (asserted) |
| Archetype | One of 8 screen patterns (List, Detail, Workbench, Wizard, Kiosk, Dashboard, Config, Dialog) | [DOC:pp.289-293] (asserted) |
| Scan Exception queue, Identify & Relabel, hypercare, LLR, STP | Named in the document; definitions not yet extracted | [DOC:pp.93-97; p.203; pp.206-216] (asserted) |

## Collision log

| # | Pattern | Detail | Owner | Status |
|---|---|---|---|---|
| *G-0* | *one name, two things* | *"order" for sales and production* | *requesting user* | *example* |
| G-1 | Fact split | Material Type 9 [DOC:p.137] vs 8 [DOC:p.224]: logged as K-12 | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| G-2 | One name, two things | Unqualified "order" means sales order or production order. Artifacts write "sales order" or "production order (WO)" (see OQ-2) | Requesting user (SME) | convention, no ruling needed for estimate |

## Open questions (model inferences, not rules)

- Hard Close and Year-End Closed: see OQ-3.
- Last-row descriptive terms: see OQ-4.

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`LLM` tag: inferred by a model and not yet verified; such content lives only in `open-questions.md` ·
`(asserted)` a human said it once, unverified ·
`(inferred)` nobody has said it; reasoning produced it.
**RB** rule-bearing · **D** descriptive · **K-nn** a row in `STATE.md > Open contradictions` ·
**ASM-** an entry in `00-inputs/assumptions.md` · **R-SME-SUB** the risk that the subject expert stands in for real users.
