# PRD / Project Spec - pe-v2

> **What this is.** The slot where the client's specification lives. For this project it points at the 312-page ERP build specification the requesting user supplied on 9 October 2026, and says how complete we judged it to be. Read this file to know what the project is building from and what that document does not tell us.
>
> **Where it stands.** Filled on 9 October 2026 at intake. The original is filed unchanged. We judged it a strong but partial spec: it is detailed on rules, records and screens, and thin on users, permissions, devices per role and today's process.
>
> **What we need from you.** Nothing now. By your instruction we are not asking further questions; the gaps are logged as assumptions in `assumptions.md` for you to accept or correct at estimation sign-off.

---

## Header block (always filled)

| Field | Value |
|---|---|
| Intake class | **B, partial spec** [LLM] (inferred) - see `spec-intake.md` for why not A |
| Status | SUPPLIED |
| Origin | The requesting user (abhinabprasai@lftechnology.com), self-declared SME and acting PO |
| Received | 2026-10-09 |
| Client version | "Enterprise ERP - Unified Build Specification V1.0", dated July 2026, Power Electronics / PE Transformer [DOC:p.1] |
| Filed at | `00-inputs/PRD2.pdf` (verbatim, read-only). Working copies: `PRD2.extracted.txt`, `PRD2-sections/` (8 files). Digests: `_digests/PRD2-01..08` |
| Substitute path | None needed for the document itself. Thin areas become assumption entries, not questions (user instruction, 2026-10-09) |
| Audit | `00-inputs/spec-intake.md`, scored 2026-10-09 |
| Assumptions | `00-inputs/assumptions.md`, 18 open at intake (no gate held yet) |
| Superseded by | `60-requirements/refined-requirements.md` from Phase 2B |

---

## The supplied spec

<!-- CLIENT SPEC BEGINS -->

The client document is a binary and is not reproduced here. It is `00-inputs/PRD2.pdf`, 312 pages,
unedited. It is a to-be build specification for a transformer manufacturer's ERP, written as a set
of changes and additions to two external base specifications, INV V3.0 and ACC V2.0, which were
not supplied [DOC:p.204 §1.1]. It is organised in front matter plus nine Books:

| Part | Pages (approx.) | What it covers |
|---|---|---|
| Front matter + Section W | 1-12 | Module index, the claim of 78 screen entries and seven build waves [DOC:p.8]; one shared approval engine, 27 workflows [DOC:pp.10-12 §W] |
| Book I | 13-133 | Part A: nine inventory gap items (RMA, packing, inspection, counts, CVA, fiscal periods, safety stock, tax) [DOC:pp.13-46]. Parts B-E: Sales, Engineering, Production/MRP, Quality [DOC:pp.47-91]. Parts F-K: barcoding, procurement, controlling, costing/pricing, postings, data model, roadmap, NFRs, sign-off [DOC:pp.92-133] |
| Book II | 134-173 | Material management: material master, 9 material types, MCR/MCH change documents, valuation, special stock, serials, migration [DOC:pp.134-173] |
| Book III | 174-203 | Closure flows FL-01..08, interfaces IF-01..20, security, resilience tiers, scheduling, multi-plant, CAD connector, acceptance and migration [DOC:pp.174-203] |
| Book IV | 204-221 | Governance: go-live scope (IN / Phase 2 / Phase 3 / OUT), decision register, conflict register C-01..C-06, ADR-01..10, gates DG-1..3 [DOC:pp.204-221] |
| Book V | 222-243 | Designer's guide: 26 capabilities, 36-term glossary, per-module screen table (77 rows), Phase 1 devices, labels, design system [DOC:pp.222-243] |
| Book VI | 244-277 | Screen-by-screen build plan: 78 entries in 13 module sections, seven waves, linkage spine [DOC:pp.244-277] |
| Book VII | 278-288 | Go-live supplement: 6 supplemental screen entries, multi-plant, manifest, migration workbook, 10 label types [DOC:pp.278-288] |
| Book VIII | 289-303 | Design handbook: 8 screen archetypes, nine screen states, BPMN flows, phasing of 10 deferred capabilities [DOC:pp.289-303] |
| Book IX | 304-312 | Nine target-state modules, each activated by evidence under change control, undated [DOC:p.304, pp.300-312] |

Page ranges at Book boundaries are approximate [LLM] (inferred) from the digest page spans.

<!-- CLIENT SPEC ENDS -->

---

## The fourteen dimensions, at intake

PRESENT means the document specifies it well enough to build against. PARTIAL means it names the
thing but does not specify it fully. ABSENT means it is not there. Full reasoning is in
`spec-intake.md`.

| # | Dimension | Score | Evidence | Where it now lives |
|---|---|---|---|---|
| 1 | Business goal and measure | PARTIAL | KPIs and targets, no baselines [DOC:p.167 §16.4, p.203 §H] | ASM-GOAL-1 |
| 2 | Users and roles | PARTIAL | Role titles per module, no counts, frequency or expertise [DOC:pp.56,67,91, p.203] | ASM-ROLE-1, ASM-VOL-1 |
| 3 | Entities and vocabulary | PRESENT | Entity tables, 36-term glossary [DOC:p.128, pp.169-170, pp.222-226] | glossary-builder |
| 4 | Rules and constraints | PRESENT | Thresholds, approval ladders, precedence rule "Book IV outranks" [DOC:pp.10-11, p.204] | anchor-analysis |
| 5 | States and lifecycle | PRESENT | Closed status lists for RMA, SO, WO, PO, material and more [DOC:pp.22-26, 51, 74-75, 101-107, 149] | anchor-analysis |
| 6 | Permissions | PARTIAL | Amount ladders and role lists, no action-by-role matrix [DOC:p.11 §W.4, p.188 §C] | ASM-PERM-1 |
| 7 | Current process | ABSENT | To-be only; base INV/ACC specs not supplied [DOC:p.204] | ASM-ASIS-1, ASM-EXT-1 |
| 8 | Exceptions and failure handling | PARTIAL | Coded errors, exception queues, DLQ; no rollback or outage handling [DOC:pp.41-42, 72, 93-97, 184-185] | ASM-EXC-1 |
| 9 | Integrations and data boundaries | PRESENT | IF-01..20 with owners and controls [DOC:pp.184-186 §B] | anchor-analysis |
| 10 | Non-functional expectations | PRESENT | Numbers for volume, latency, availability, retention [DOC:p.131 §K4, p.171, pp.189-193] | anchor-analysis; user counts in ASM-VOL-1 |
| 11 | Platform and environment | PARTIAL | Device list and 48 px targets, not mapped to roles; no browser floor [DOC:pp.238-242] | ASM-DEVICE-1 |
| 12 | Success and failure scenarios | PARTIAL | Closure flows and test packs, no narrative scenarios [DOC:pp.176-183, p.219] | ASM-SCEN-1 |
| 13 | Out of scope | PRESENT | IN / Phase 2 / Phase 3 / OUT list [DOC:pp.204-205 §1.2] | prioritization descope column |
| 14 | Client's own open questions | PARTIAL | Decision register and undecided IdP/CAD, no open-questions section [DOC:pp.204-205, pp.188, 198] | ASM-OQ-1, ASM-IDP-1, ASM-CAD-1 |

Totals: 6 PRESENT, 7 PARTIAL, 1 ABSENT.

---

## If a spec arrives late

Do not delete this file. If a later version of PRD2, or INV V3.0 / ACC V2.0, arrives, add a row to
the header block with its arrival date, file it in `00-inputs/`, and run `spec-intake` again.
Every disagreement with work already derived is a contradiction with an owner, not a reason to
discard that work.

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`[LLM]` inferred by a model and not yet verified by anyone ·
`(inferred)` nobody has said it; reasoning produced it.
**ASM-** an entry in the assumption register, `00-inputs/assumptions.md`.
