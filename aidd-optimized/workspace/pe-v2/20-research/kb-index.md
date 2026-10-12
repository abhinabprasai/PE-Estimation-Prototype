# Knowledge Base Index - pe-v2

> **What this is.** The map of everything the project knows about the client's transformer ERP, and where each fact lives. It is the first file to open when you need a screen ID, a status, an approval limit, a ledger posting or a barcode scan for any module or any of the eleven business flows. It is written for the prompt writer, who builds the throwaway prototype prompt from it next, and for anyone writing specs later.
>
> **Where it stands.** First version, 9 October 2026. Everything comes from the client's specification (PRD2) and the Phase 1 work built on it. Nobody from the business has been heard yet, so nothing is confirmed.
>
> **What we need from you.** Nothing - this is for reference. One item needs an owner's attention: the problem definition was confirmed in writing on 9 October, but the problem statements file still marks each problem "said once, unverified" (section 7).

**Lite mode, stated once.** `aidd_mode: lite`, `minimum_set: true` (CLAUDE.md 3a). The KB is kept proportionate: one index, two topic notes, and pointers to the digests and Phase 1 files rather than copies. There is no discovery call and no question round by user instruction (2026-10-09); the PRD stands as the domain authority's written statement, so every client fact is `[DOC]` (asserted). R-SME-SUB stays open.

ASSUMPTIONS this index points readers to (it adds none): ASM-SCOPE-1, ASM-SCOPE-2, ASM-EXT-1, ASM-PERM-1, ASM-LABEL-1.

## 1. How to use this KB (start here)

| You need | Open | Section |
|---|---|---|
| *Everything about one flow, e.g. returns* | *`client/2026-10-09-prd2-flow-cards.md`* | *FL-05* |
| One flow end to end (records, statuses, rules, roles, screens, postings, scans) | `client/2026-10-09-prd2-flow-cards.md` | the FL-nn card |
| A screen ID, route, archetype, users, wave, or which flow it serves | `client/2026-10-09-prd2-reference-tables.md` | A |
| A ledger posting (#17 to #38) with accounts and trigger | same file | B |
| A barcode scan point SP-01 to SP-21 | same file | C |
| A traceability event T01 to T13 | same file | D |
| The status list of any record | same file | E |
| An approval limit or threshold | same file | F |
| Who owns each flow, and separation of duties | same file | G |
| A module's scope, complexity and wave | `10-discovery/anchor-analysis.md` | 2 |
| The meaning of a domain term | `10-discovery/glossary.md` | rule-bearing terms |
| Why we are building this | `10-discovery/problem-statements.md` | 1, 4 |
| What we are guessing | `00-inputs/assumptions.md` | entries |
| A model-inferred reading (LLM tag) | `10-discovery/open-questions.md` | OQ-1 to OQ-10 |
| Exact wording the KB does not hold | the digest for that book, then its block 6 page pointer | section 2 below |

**Answer rule.** Cite the item: "per {file} [DOC:p.n]: ...". If the KB cannot answer, say so and route the question to `10-discovery/open-questions.md`; never fill the gap from general knowledge.

**Precedence when two pages disagree** (the document's own rule, not ours): Book IV outranks Books I-III; a Book VI entry yields to the section it references [DOC:p.204 §1.1; p.277] (asserted). Known disagreements are in section 6; none is resolved here.

## 2. Item index

Groups: **client** the client's own document or a faithful extraction of it · **authority** statements by the domain authority or product owner · **external** outside research · **project** a Phase 1 artifact our team derived from the client document (cites it line by line) · **quarantine** model-inferred content, allowed only there.

LB means load-bearing: something downstream depends on this item, so it is not archived or changed quietly. No refined requirements, ERD or hi-fi spec exists yet, so LB marks here anticipate the next step and are re-checked at Gate 1.

| File | Group | Tag | One-line contents | Date | Ingested by | LB | Conflict marks |
|---|---|---|---|---|---|---|---|
| *`20-research/client/2026-10-09-prd2-flow-cards.md`* | *client* | *[DOC] (asserted)* | *FL-01 to FL-11 cards: records, statuses, rules, roles, screens, postings, scans* | *2026-10-09* | *kb-curator* | *LB* | *K-06, N-4* |
| `20-research/client/2026-10-09-prd2-flow-cards.md` | client | [DOC] (asserted) | FL-01 to FL-11 cards: records, statuses, rules, roles, screens, postings, scans, closure, tests, gaps | 2026-10-09 | kb-curator | LB | K-06, K-09, N-5 |
| `20-research/client/2026-10-09-prd2-reference-tables.md` | client | [DOC] (asserted) | 84 screen entries with route, wave, postings, scans, flows; templates #17-#38; SP-01-21; T01-T13; 24 status lists; approval limits; roles per flow | 2026-10-09 | kb-curator | LB | K-05, K-06, N-1 to N-4 |
| `00-inputs/PRD2.pdf` | client (binary original) | [DOC] | Anchor: Enterprise ERP Unified Build Specification V1.0, Jul 2026, 312 pp, nine Books | supplied 2026-10-09 | spec-intake | LB | K-01 to K-12 |
| `00-inputs/PRD2-sections/01..08-*.txt` | client (text extraction) | [DOC] | The PDF text split into eight book ranges; read only by targeted search when a digest's block 6 names the need | 2026-10-09 | source-extractor | - | - |
| `_digests/PRD2-01-frontmatter-W-bookI-partA.digest.md` | client (digest) | [DOC] (asserted) | Front matter, workflow engine W, Book I Part A nine inventory gaps (RMA, sales tab, packing, inspection, counts, CVA, periods, safety stock, tax), pp.1-46 | 2026-10-09 | source-extractor | - | N-3 |
| `_digests/PRD2-02-bookI-sales-eng-prod-quality.digest.md` | client (digest) | [DOC] (asserted) | Book I Sales, Engineering, Production/MRP, Quality, pp.47-91 | 2026-10-09 | source-extractor | - | N-1, N-2, K-11 |
| `_digests/PRD2-03-bookI-barcode-proc-ctrl-cost-datamodel.digest.md` | client (digest) | [DOC] (asserted) | Book I barcoding, procurement, controlling, costing/pricing, postings #17-38, data model, roadmap, NFRs, pp.92-133 | 2026-10-09 | source-extractor | - | N-4, K-05 |
| `_digests/PRD2-04-bookII-material-mgmt.digest.md` | client (digest) | [DOC] (asserted) | Book II Material Management: types, lifecycle, MCR/MCH, valuation matrix, special stock, serials, migration, pp.134-173 | 2026-10-09 | source-extractor | - | K-07, K-12 |
| `_digests/PRD2-05-bookIII-enterprise-completeness.digest.md` | client (digest) | [DOC] (asserted) | Book III closure flows FL-01 to FL-08, interfaces IF-01 to IF-20, security, resilience, multi-plant, CAD, acceptance, pp.174-203 | 2026-10-09 | source-extractor | - | K-09, K-10 |
| `_digests/PRD2-06-bookIV-V-governance-designers-guide.digest.md` | client (digest) | [DOC] (asserted) | Book IV governance (scope decisions, conflicts, FL-09/10/11, ADRs, gates) and Book V designer's guide (devices, labels, design system), pp.204-243 | 2026-10-09 | source-extractor | - | K-03, K-08, K-10, K-11, K-12 |
| `_digests/PRD2-07-bookVI-screen-by-screen.digest.md` | client (digest) | [DOC] (asserted) | Book VI 78 screen entries in 13 modules, seven waves, linkage spine, pp.244-277 | 2026-10-09 | source-extractor | - | K-01, K-05, K-06 |
| `_digests/PRD2-08-bookVII-VIII-IX-golive-handbook-targetstate.digest.md` | client (digest) | [DOC] (asserted) | Book VII go-live supplement (6 screens, labels, migration), Book VIII design handbook (archetypes, business map), Book IX target state, pp.278-312 | 2026-10-09 | source-extractor | - | K-02, K-03, K-04 |
| `10-discovery/anchor-analysis.md` | project | [DOC] (asserted) | Per-module scope for estimation (screens, waves, rules, postings, scans, interfaces, complexity), commitments, silences, contradictions | 2026-10-09 | discovery-lead | LB | K-01 to K-12 |
| `10-discovery/glossary.md` | project | [DOC] (asserted) | 29 rule-bearing and 12 descriptive terms with page sources; collision log | 2026-10-09 | discovery-lead | LB | K-12 (G-1) |
| `10-discovery/problem-statements.md` | project + authority (§4 written confirmation) | [DOC] (asserted); §4 confirmation by the requesting user in writing | PS-1 to PS-10; contradiction ranking; problem-confirmation checkpoint signed 2026-10-09 | 2026-10-09 | discovery-lead | LB | upgrade candidate U-1 |
| `00-inputs/assumptions.md` | project (register) | inferred, LLM tag on entries | 19 assumptions (ASM-ASIS-2 added by flow-modeler) with what breaks, test, owner, date | 2026-10-09 | discovery-lead | LB | - |
| `40-models/as-is/FL-01..FL-11-*.md` + `README.md` | project (pointer only) | [DOC] (asserted), TENTATIVE | Step-by-step reference flows for FL-01 to FL-11, standing in for the absent current process; produced in parallel, indexed from STATE.md and file headers, contents not re-read by kb-curator | 2026-10-09 | flow-modeler | - | check against flow cards at Gate 1 |
| `40-models/_tentative/erd-sketch.md`, `status-encoding-input.md` | project (pointer only) | TENTATIVE | Entity sketch (44 rows, 43 status lists) and status encoding input (7 families); produced in parallel, not re-read by kb-curator | 2026-10-09 | data-modeler / ui-designer | - | compare status lists with N-1 to N-4 |
| `10-discovery/open-questions.md` | quarantine | LLM tag (inferred) | OQ-1 to OQ-10 model readings used for the estimate | 2026-10-09 | discovery-lead | - | - |
| `20-research/authority/` | authority | - | empty: no transcripts, no written answers beyond the §4 confirmation above | - | - | - | thin group (section 8) |
| `20-research/external/`, `incumbents/`, `research-notes/` | external | - | empty: no outside research run in this phase | - | - | - | - |

## 3. Module index (13 Book VI modules + Book VII supplement)

Screens: table A of the reference tables. Rules, statuses and complexity: `anchor-analysis.md` section 2. The flow column says which cards to read.

| Module (Book VI §) | Entries | Waves | Key statuses (table E) | Postings (table B) | Scans (table C) | Flows |
|---|---|---|---|---|---|---|
| *Returns/Service §5* | *5* | *W5* | *RMA* | *#17-#24* | *SP-19* | *FL-05, FL-08* |
| Materials §3 | 10 | W1, W2, W6, W7 | material lifecycle | E&O DR 6320 / CR 5340; all postings resolve through MM-VAL-001 | none | FL-03, FL-06, FL-10 |
| Sales §4 | 8 | W2, W7 | quotation, SO, schedule line, delivery, HU, POD | #25, #26, #27 | SP-15 to SP-18 | FL-01, FL-02, FL-09 |
| Returns, Warranty, Service §5 | 5 | W5 | RMA | #17 to #24 | SP-19 | FL-05, FL-08 |
| Engineering §6 | 6 | W3 | EBOM, release level | none | none | FL-02, FL-10 |
| CAD and Documents §7 | 4 | W3 | not extracted | none | none | FL-02, FL-10 |
| Planning §8 | 5 | W4 | not extracted (MRP exceptions EX-01 to EX-07) | none | none | FL-04, FL-01/02 promise |
| Production §9 | 8 | W4 | WO | #21, #22, #28 to #33 | SP-07 to SP-13 | FL-04, FL-02, FL-05 (RWO) |
| Quality §10 | 8 | W2 config, W5 | inspection plan, recall, CAPA (names not extracted) | stock status moves | SP-05, SP-14 | FL-03, FL-04, FL-05, FL-08, FL-10 |
| Purchasing §11 | 6 | W6 | PR, RFQ, PO, STP acknowledgement | none at creation | SP-01 to SP-04 downstream (see OQ-9) | FL-03, FL-10 |
| Costing and Pricing §12 | 8 | W6 | none listed | #38; REVAL at costing release | none | FL-02, FL-03, FL-04 |
| Controlling §13 | 3 | W1, W6 | none listed | #36 | none | FL-06 |
| Traceability and Barcode §14 | 3 | W4, W7 | genealogy correction status | none | configures SP-01 to SP-21 | FL-08, FL-11 |
| Workflow and Administration §15 | 4 | W1, W7 | fiscal period | gates every posting | none | every flow with an approval; FL-06 |
| Book VII supplemental | 6 (5 buildable) | W1, W2, W5 | count document (9, names not extracted) | count variance | SP-20 | FL-05, FL-06, FL-01 |

Sources: Book VI [DOC:pp.244-276 §3-15]; Book VII [DOC:pp.279-282 §3] (asserted). Total 83 buildable entries (ASM-SCOPE-1).

## 4. Flow index (FL-01 to FL-11)

Full detail in the flow cards. "In KB" counts what the KB holds for that flow today, so the prototype pick can be made on evidence: S statuses fully listed for its main records, P posting templates listed, C scan points listed, R roles and separation of duties listed.

| Flow | What it covers | Main records | Book VI screens (count) | Postings | Scans | In KB | Source |
|---|---|---|---|---|---|---|---|
| *FL-05 RMA* | *authorised return to settled disposition* | *RMA, receipt, disposition, credit note, RWO* | *6 + INV-RETURN redirect* | *#17-#24* | *SP-19* | *S P C R* | *[DOC:pp.179-180]* |
| FL-01 MTS order to cash | stocked sale to cash closure | SO, schedule line, delivery, HU, invoice request | 9 | #25, #26, #27 | SP-15 to SP-18 | S P C R (ACC invoice statuses external) | [DOC:pp.176-177] |
| FL-02 ETO quote to cash | custom unit from quote to milestone billing and revenue | quote, SO, cost estimate, ER, EBOM, WO, milestone | 14 | #25, #28, #31, #32, #34, #35, #37, #38 | SP-14 + FL-04 set | S P C R (ER statuses not extracted) | [DOC:p.177] |
| FL-03 procure to pay | demand to paid supplier with three-way match | PR, RFQ, PO, GRN, vendor invoice | 10 (receiving screens are base INV) | GRN, match, #34, #35 | SP-01 to SP-05 | S P C R | [DOC:p.178] |
| FL-04 plan to produce | MRP to settled WO with zero WIP | planned order, WO, confirmation, RWO, settlement | 12 | #28 to #33 | SP-07 to SP-14 | S P C R | [DOC:pp.178-179] |
| FL-05 RMA and warranty | authorised return to settled disposition | RMA, receipt, disposition, credit note, RWO | 6 + redirect | #17 to #24 | SP-19 | S P C R | [DOC:pp.179-180] |
| FL-06 period close | monthly close and tie-out | checklist, period, allocation run, count doc | 6 (no close orchestration entry, K-06) | #24, #36, E&O | SP-20 | S P C R (ACC steps external) | [DOC:pp.180-181] |
| FL-07 intercompany | paired SO/PO between PE entities | paired SO and PO, IC relationship | 0 dedicated (uses OM-SO, PUR-PO) | IC pairs, FX 7100 | none named | S P R | [DOC:pp.181-182] |
| FL-08 recall | contain to 100% accounted population | recall campaign, population, recall RMAs | 4 | via FL-05 | T13 | S P R | [DOC:pp.182-183] |
| FL-09 sales order to delivery | MTS/MTO/ETO fulfillment execution | schedule line, delivery, HU, POD, claim | 6 | #25, #26, #27 and reversal | SP-15 to SP-18 | S P C R (16-stage table not in KB) | [DOC:pp.206-208] |
| FL-10 design to source | engineering need to revision-correct purchase | release level, LLR, STP, RFQ, PO | 12 | none own | SP-01 to SP-03 | S C R; 16 stages listed | [DOC:pp.208-210] |
| FL-11 traceability contract | event dictionary and genealogy rules | genealogy event T01 to T13 | 3 | none | all SP | S C | [DOC:pp.211-212] |

All rows (asserted). The Book VIII one-page business map ties stages to flows and screens [DOC:p.294 §3] (asserted).

## 5. Cross-cutting rules that touch every flow

| Rule | Source |
|---|---|
| *One shared approval engine, 27 workflows; no module-specific approvals* | *[DOC:pp.10-12 §W] (asserted)* |
| One shared approval engine, 27 workflows; no delegation above $250k for financial approvals | [DOC:pp.10-12 §W] (asserted) |
| Every posting goes through one Posting Service and the account determination matrix | [DOC:p.125 Part J; p.154; p.247] (asserted) |
| R-PER-01: one Open period, at most one Soft Close; reopen needs Controller + CFO | [DOC:pp.41-42 §9] (asserted) |
| Genealogy is append-only; corrections are reversal + replacement | [DOC:p.212 §4.3] (asserted) |
| Material type immutable; new material only via MCR | [DOC:p.137 §2.1; p.245] (asserted) |
| Nine screen states per screen; eight archetypes | [DOC:pp.218-220 §9-10; pp.289-293] (asserted) |
| Floor devices: scan feedback under 400 ms, 48 px targets, offline queue 4 h | [DOC:pp.241-242 §8.4, §10] (asserted) |

## 6. Conflict marks (recorded, not resolved)

**K-01 to K-12** are the document's internal contradictions, held in `STATE.md > Open contradictions` with both statements, tags and owner (the requesting user). Status for all: recorded, not to be resolved (user instruction 2026-10-09). Those that touch the KB tables: K-05 and K-06 (screen counts and wave items with no entry, table A), K-03 (labels, ASM-LABEL-1), K-12 (material types), K-09 (capacity model, closed by the document's own rule).

**N-1 to N-5** are new marks found at this ingestion. They compare a digest's count with the names listed on the source page, or note a missing table. They are not contradictions inside the client document, so they do not get K numbers. Routed to discovery-lead (contradiction-mining) to decide whether any becomes a K row. Owner: the requesting user. Due: before the ERD is drafted.

| # | Statement A | Statement B | Route |
|---|---|---|---|
| *N-0* | *digest: "X statuses"* | *page lists Y names [DOC:p.n]* | *discovery-lead* |
| N-1 | Digest 02: production order has 7 statuses | The WO lifecycle table lists 8 names: Created, Released, In Progress, Testing, Completed, Closed (TECO), On Hold, Cancelled [DOC:pp.74-75 §5.3] | discovery-lead; data-modeler at ERD |
| N-2 | Digest 02: sales order has 8 statuses | The SO table lists 9 names plus Rejected as an exit [DOC:p.54 §4.6] | discovery-lead; data-modeler at ERD |
| N-3 | Digest 01: RMA has 11 status rows | 10 rows read, plus Closed Short and Reopened as transition-only names [DOC:pp.22-26 §3.8] | discovery-lead; data-modeler at ERD |
| N-4 | Digest 03: RFQ has 4 statuses | The RFQ line lists 5 names: Draft, Issued, Responses In, Awarded, Cancelled [DOC:p.103 §4] | discovery-lead; data-modeler at ERD |
| N-5 | Book IV: test pack covers "the 16 stages" of Flow A [DOC:p.208 §2.6] | No FL-09 stage table was found in pp.206-208 as read; only stage 7 and stage 14 are referenced [DOC:p.205; p.207] | kb-curator reopens pp.204-208 when FL-09 is specified |

## 7. Upgrade scan (authority material this phase)

One authority item exists: the requesting user's written confirmation of the problem definition, 2026-10-09 (`10-discovery/problem-statements.md` §4; STATE.md gate record). The scan found one upgrade candidate.

| # | Entry that could be upgraded | Authority statement | Notify |
|---|---|---|---|
| *U-0* | *PS-n (asserted)* | *DA confirmed in writing, date* | *owning agent* |
| U-1 | PS-1 to PS-10, each marked (asserted), and the file header "Nobody has confirmed it yet" | Problem definition and PS-1 to PS-10 confirmed in writing by the requesting user, the domain authority (SME), 2026-10-09 (problem-statements §4 checkbox; STATE gate record) | discovery-lead (owner of problem-statements.md): consider upgrading PS-1 to PS-10 to (confirmed) for the problem framing only; the PRD's rules, statuses and thresholds stay (asserted) |

No other entry (glossary, assumptions, requirements) is upgraded by this confirmation: it confirms the problem, not the document's rules.

## 8. Health check (this ingestion)

- **Unindexed items in the group folders**: zero. `client/` holds the two notes above; `authority/`, `external/`, `incumbents/`, `research-notes/` are empty.
- **Group balance**: `authority/` is empty. Every domain fact in the KB comes from the client document; the only authority statement is a one-line written confirmation. Confirmations are therefore thin and this is a gate-relevant fact for Gate 1 (R-NO-DD, R-SME-SUB).
- **Index honesty sample** (three rows re-checked against their files): digest 05 one-liner matches its block 1; flow cards row matches (11 cards present); anchor-analysis row matches its section 2 table.
- **Not yet in the KB, and where to reopen**: count document, CAPA, vendor onboarding and inspection plan status names [DOC:pp.36-37; p.88; pp.101-107; p.35]; the 27-row workflow catalogue W.4 [DOC:pp.11-12]; field-level tables for any screen (each Book VI entry names its Book I/II section); IF-01 to IF-20 owners and controls [DOC:pp.185-186]; label samples [DOC:pp.285-286]. These are reopen pointers, not open questions: the document holds the answers.
- **Recurring questions**: none logged yet (first ingestion).

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
LLM tag: inferred by a model and not yet verified by anyone; such content lives only in `10-discovery/open-questions.md` and `20-research/research-notes/` ·
`(confirmed)` the domain authority verified it, on record ·
`(asserted)` a human said it once, unverified ·
`(inferred)` nobody has said it; reasoning produced it.
**LB** load-bearing: something else depends on this, so it cannot be changed quietly ·
**K-nn** a contradiction inside the client document, in `STATE.md > Open contradictions` · **N-n** a count or coverage mismatch found at this ingestion · **U-n** an upgrade candidate ·
**ASM-ID** an assumption in `00-inputs/assumptions.md` · **OQ-n** a model-inferred reading in `10-discovery/open-questions.md` · **PS-ID** a problem statement ·
**FL-nn** a closure flow · **SP-nn** a barcode scan point · **T01 to T13** a traceability event · **#nn** a journal posting template · **W1 to W7** build waves ·
**R-SME-SUB** the risk that the subject expert stands in for real users · **R-NO-DD** the risk logged because no discovery call was held.
