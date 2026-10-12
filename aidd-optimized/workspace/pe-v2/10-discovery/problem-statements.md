# Problem Statements - pe-v2

> **What this is.** The problems this ERP build is meant to solve, as the client's own specification states them, each with the page it comes from. It is the starting point for the estimate: everything we size later points back at one of these problems. It also lists the places where the specification disagrees with itself.
>
> **Where it stands.** First version, 9 October 2026. Taken from the specification only. Nobody has confirmed it yet. There was no discovery call, by your instruction.
>
> **What we need from you.** The requesting user, as subject expert and acting product owner, to confirm in writing the problem definition in the box at the bottom, or correct it. Until then everything here stays "said once, unverified".

**How this was produced, stated once.** The discovery call with the domain authority was not held, by user instruction on 2026-10-09 (purpose is estimation; no further questions; where PRD parts do not interconnect, leave them as-is and build as per the PRD). The PRD stands as the domain authority's written statement. Every problem below is therefore `[DOC]` (asserted), and none can become (confirmed) until the requesting user signs the box at the foot. R-SME-SUB stays open: no end user has described these problems.

The workaround and stake questions the method would normally queue are **not asked** (user instruction). Where the document is silent, the field says "none stated" and the gap is carried, not chased.

ASSUMPTIONS this file rests on: ASM-GOAL-1, ASM-EXT-1, ASM-ASIS-1, ASM-SCOPE-1.

## 1. Problem statements

Each problem is phrased close to the document's own words. The document's fixes ("Closed in §4" and similar) are its proposals; they are cited only so a reader can find them, and they are not part of the problem.

| ID | Problem | Source | Current workaround | Downstream consequence | Confidence |
|---|---|---|---|---|---|
| *PS-0* | *Returns have no process in the inventory system* | *[DOC:p.n]* | *none stated* | *none stated* | *(asserted)* |
| PS-1 | The released inventory specification (INV V3.0) left nine features without the details needed to build them: RMA, the sales tab, packing, inspection plans, count documents, cost variance analysis, fiscal periods, safety stock and tax. A design review gap register of June 2026 lists them | [DOC:p.15 §1; p.278 §2; pp.13-46 Part A] | none stated (INV V3.0 is "Released, build in progress") [DOC:p.15 §1] | Nine inventory capabilities cannot be built from the released volume alone | (asserted) |
| PS-2 | The released volumes cover only inventory and accounting. The manufacturing core (orders, engineering and BOM, production and MRP, quality, barcoding and traceability, procurement, returns, controlling, costing and pricing) has no field-level specification | [DOC:p.14; p.15 §1] | none stated | No end-to-end flow from lead to recall can run (the eight closure flows) [DOC:p.176 §A; pp.276-277 §16] | (asserted) |
| PS-3 | Planning, finite capacity and capable-to-promise were specified for a single plant only, with no place to set up more plants | [DOC:p.278 §1] | none stated | A second plant or international package cannot be added without redesign [DOC:p.195 §F] | (asserted) |
| PS-4 | The screen-level build plan was not design ready for every screen: six screens existed only inside bundles | [DOC:p.278 §1] | none stated | Some navigation items did not resolve to a buildable entry [DOC:p.278 §1] | (asserted) |
| PS-5 | Data migration lacked source-to-target workbooks, cleansing rules, transformation logic, opening balance rules and reconciliation scripts | [DOC:p.278 §1] | none stated | Cutover cannot be rehearsed; the document requires two mock conversions with zero manual fixes in mock 2 [DOC:pp.201-202 §H] | (asserted) |
| PS-6 | Barcode label samples were missing, with no statement of where and when each is printed and scanned | [DOC:p.278 §1] | none stated | 21 scan points and label printing cannot be designed or tested [DOC:pp.93-97 §F] | (asserted) |
| PS-7 | The system was "not SAP equivalent in every module" | [DOC:p.278 §1] | none stated | none stated; the document answers it by recording which capabilities ship at go-live and which are phased [DOC:p.278 §1] | (asserted) |
| PS-8 | Inventory and accounting are external volumes, so the build package is not standalone | [DOC:p.278 §1; p.204 §1.1] | none stated; the document keeps them as controlled, version-locked volumes [DOC:p.284 §5] | Base behaviour this build relies on is outside this document; we do not hold those volumes (ASM-EXT-1) | (asserted) |
| PS-9 | Material master data quality has targets but no stated current level: completeness ≥95%, creation lead time P80 ≤5 days, duplicates <2 per 1,000 | [DOC:p.167 §16.4] | none stated | none stated; no baseline exists to measure success against (ASM-GOAL-1) | (asserted) |
| PS-10 | Earlier parts of the specification contradicted each other (capacity model, vendor list columns, claim wording, safety stock, ATP); a conflict register was needed and Book IV was made to outrank Books I-III | [DOC:pp.204-206 §1.1, §1.3] | The document's precedence rule [DOC:p.204 §1.1] | Readers can build from a superseded statement if they miss the rule; further disagreements remain (section 2) | (asserted) |

**Count: 10 problem statements, all (asserted), none (inferred).**

Reply state for every entry: **not yet confirmed**. Corrections, when they arrive, are added as new dated statements beside the old ones, not as silent edits.

## 2. Contradictions

The document is the only source, so every contradiction is internal (the document against itself). Statements, tags and owners are in `STATE.md > Open contradictions`; they are not copied here. Every row: owner the requesting user (SME/PO), status **recorded, not to be resolved (user instruction)**. Where the estimate needs one side, the assumption register says which.

Ranked by how much of the estimate rests on the answer. Rank 1 moves the most.

| Rank | # | Type | What it is about | Estimate side taken |
|---|---|---|---|---|
| *-* | *K-nn* | *FACT* | *two counts of the same thing* | *ASM entry* |
| 1 | K-05 | SCOPE | Screen totals: "75+", 77, 78, plus 6 supplemental | 83 buildable (ASM-SCOPE-1) |
| 2 | K-06 | SCOPE | Wave items with no Book VI entry | ASM-SCOPE-2 |
| 3 | K-02 | SCOPE | Ten versus nine deferred target-state modules | out of go-live (ASM-TIME-1) |
| 4 | K-11 (new) | SCOPE | EDI invoice delivery Phase 3 [DOC:p.49 §2] versus EDI 810 Phase 2 [DOC:pp.204-205 §1.2] | out of go-live either way (ASM-SCOPE-3) |
| 5 | K-10 (new) | SCOPE | IF-20 instrument capture Phase 2 [DOC:p.186 §B] versus Phase 3 with OEE [DOC:p.205 §1.2]; manual entry at Phase 1 [DOC:p.86] | out of go-live either way (ASM-SCOPE-3) |
| 6 | K-12 (new) | FACT / VOCABULARY | Nine material types including NSTK [DOC:p.137 §2.1] versus eight in the glossary [DOC:p.224] | build nine, per the field spec (see OQ-5) |
| 7 | K-07 | FACT | Materials screens: 12, 10, 9 | 10 (ASM-SCOPE-1) |
| 8 | K-03 | FACT | 7, 9 or 10 label types | 10 (ASM-LABEL-1) |
| 9 | K-01 | FACT | Fifteen versus 13 module sections | no estimate effect |
| 10 | K-04 | FACT | Workbook manifest row 7 versus row 4 | no estimate effect |
| 11 | K-08 | FACT | Conflict register has no C-02 | no estimate effect |
| 12 | K-09 | RULE | Infinite versus finite capacity; closed by the document's own rule | finite with CTP |

**Types.** FACT two values for one thing · RULE disagreement on what is allowed · SCOPE disagreement on what the project covers · VOCABULARY one word, two meanings.

**Checks run.** Each new candidate was tested with "could both be true at once?"; all three fail it. The approval ladder for purchase orders was checked across its three statements [DOC:p.11 §W.4; p.100; p.178] and they agree. Count approval bands [DOC:p.37 §7.5] have no gap between supervisor and Controller (a Finance Manager band sits between). No document-versus-reality contradictions exist, because no one from the business was heard; that absence is a limit of this method here, not evidence that the document matches practice.

## 3. Open questions (model inferences, not rules)

- K-12 sizing choice: see OQ-5.
- PS-1 to PS-8 status: see OQ-6.

## 4. Problem-confirmation checkpoint

The problem definition the requesting user is asked to confirm:

> PE Transformer has released inventory (INV V3.0) and accounting (ACC V2.0) specifications, but its manufacturing core has no field-level specification, and a June 2026 design review found nine inventory features left underspecified [DOC:p.15 §1; p.278 §2]. The problem this project addresses is to build one ERP for a single plant with four legal entities that covers orders, engineering, production and planning, quality, barcoding and traceability, procurement, returns, controlling, and costing and pricing, on top of those two volumes [DOC:p.14; p.195 §F]. It must close the nine gaps and the readiness findings on multi-plant setup, migration, labels and screen readiness [DOC:p.278 §1]. Scope is the go-live set in Book IV, delivered in seven waves over 26 weeks; deferred and target-state modules are excluded [DOC:p.204 §1.2; p.244 §1]. Success is measured by the document's own targets, which have no current baseline [DOC:p.167 §16.4] (ASM-GOAL-1).

| Field | Value |
|---|---|
| Confirming person | the requesting user (abhinabprasai@lftechnology.com), self-declared SME and acting PO |
| Problem definition above | ☑ confirmed as written (summary wording put to the user in session; same scope as above) |
| PS-1 to PS-10 | ☑ all real problems (no IDs deleted) |
| Contradictions K-01 to K-12 | Recorded, not to be resolved (user instruction 2026-10-09); no ruling requested |
| Substitution acknowledged | The D&D call was not held by user instruction; the PRD stands as the domain authority's written statement; R-SME-SUB stays open |
| Signature, date, medium | Confirmed in writing by the requesting user, 2026-10-09, via Claude Code session (selected "Confirm") |

A verbal yes upgrades nothing. Phase 1 closes on written confirmation, or on an explicit recorded risk acceptance.

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`LLM` tag: inferred by a model and not yet verified; such content lives only in `open-questions.md` ·
`(confirmed)` the domain authority verified it, on record ·
`(asserted)` a human said it once, unverified ·
`(inferred)` nobody has said it; reasoning produced it.
**PS-ID** a numbered problem statement · **ASM-ID** a numbered assumption in `00-inputs/assumptions.md` ·
**K-nn** a row in `STATE.md > Open contradictions` · **D&D call** the discovery call with the domain authority ·
**R-SME-SUB** the risk that the subject expert stands in for real users · **CTP** capable to promise ·
**IF-nn** an interface · **EDI** electronic data interchange with trading partners.
