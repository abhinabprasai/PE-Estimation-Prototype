# Spec Intake - pe-v2

> **What this is.** The record of what arrived as this project's specification and how complete it is. It decides the project's intake class (how far we can trust the document) and lists what the document leaves out. It is for anyone estimating or designing from the document.
>
> **Where it stands.** Done on 9 October 2026 from eight section summaries of the document. Not reviewed by a human yet.
>
> **What we need from you.** Nothing new. Gaps went to the assumption list and internal inconsistencies to the project tracker, because you asked us not to send questions. Next we read the document in detail (anchor analysis).

## 1. Inventory

| Input | What it is | Given by | Date | Class |
|---|---|---|---|---|
| `00-inputs/PRD2.pdf` | "Enterprise ERP - Unified Build Specification V1.0", 312 pp, Power Electronics / PE Transformer [DOC:p.1] | Requesting user (abhinabprasai@lftechnology.com), self-declared SME and acting PO | Document dated Jul 2026; supplied 2026-10-09 | B |
| `PRD2.extracted.txt`, `PRD2-sections/` | Our text copies of the PDF, split into 8 parts | Derived by us | 2026-10-09 | working copy |
| `_digests/PRD2-01..08` | One summary per part; this intake reads only these | source-extractor | 2026-10-09 | working copy |
| INV V3.0, ACC V2.0 | Base specifications the document amends and version-locks [DOC:p.204 §1.1] | Not supplied | n/a | missing (ASM-EXT-1) |
| Verbal instruction | Estimation purpose; no further questions; build as per the PRD where parts do not interconnect | Requesting user | 2026-10-09 | instruction, not spec |

The PDF keeps its supplied filename rather than an origin-and-date name, so that existing
references to it stay valid [LLM] (inferred).

## 2. Class: B, partial spec

The document is long and specific on rules, records, statuses, integrations, numbers and scope
[DOC:pp.10-312]. We did not score it class A for two reasons [LLM] (inferred):

- It is written as changes to INV V3.0 and ACC V2.0, which we do not have [DOC:p.204 §1.1]. Any
  base behaviour it relies on is unspecified for us.
- Users, permissions, devices per role and today's process are thin or missing (dimensions 2, 6,
  7, 11 below).

Only one dimension is ABSENT, so the rule "four or more ABSENT means treat it as class D" does not
apply. No reconstruction interview is needed. Under class B, thin areas would normally be weighted
in the question set; by user instruction they become assumption entries instead.

## 3. Audit scorecard (fourteen dimensions)

PRESENT: specified well enough to build against. PARTIAL: named, not fully specified. ABSENT: not there.

| # | Dimension | Score | Ref | Converts to |
|---|---|---|---|---|
| 1 | Business goal and measure | PARTIAL | KPIs, no baselines [DOC:p.167 §16.4, p.203] | ASM-GOAL-1 |
| 2 | Users and roles | PARTIAL | Role titles only [DOC:pp.56,67,91, p.203] | ASM-ROLE-1, ASM-VOL-1 |
| 3 | Entities and vocabulary | PRESENT | [DOC:p.128, pp.169-170, pp.222-226] | glossary-builder |
| 4 | Rules and constraints | PRESENT | [DOC:pp.10-11 §W, p.204 §1.1, pp.21-46] | anchor-analysis |
| 5 | States and lifecycle | PRESENT | [DOC:pp.22-26, 51, 54, 74-75, 101-107, 149] | anchor-analysis |
| 6 | Permissions | PARTIAL | Amount ladders, no role matrix [DOC:p.11 §W.4, p.188 §C] | ASM-PERM-1 |
| 7 | Current process | ABSENT | To-be only | ASM-ASIS-1, ASM-EXT-1 |
| 8 | Exceptions and failure handling | PARTIAL | Coded errors and queues [DOC:pp.41-42, 72, 93-97, 184-185] | ASM-EXC-1 |
| 9 | Integrations and data boundaries | PRESENT | IF-01..20 [DOC:pp.184-186 §B] | anchor-analysis |
| 10 | Non-functional expectations | PRESENT | [DOC:p.131 §K4, p.171, pp.189-193] | anchor-analysis; ASM-VOL-1 |
| 11 | Platform and environment | PARTIAL | Devices not mapped to roles [DOC:pp.238-242] | ASM-DEVICE-1, ASM-ENV-1 |
| 12 | Success and failure scenarios | PARTIAL | Flows and test packs only [DOC:pp.176-183, p.219] | ASM-SCEN-1 |
| 13 | Out of scope | PRESENT | [DOC:pp.204-205 §1.2] | ASM-SCOPE-3, descope column |
| 14 | Client's own open questions | PARTIAL | DEC register; IdP and CAD undecided [DOC:pp.204-205, 188, 198] | ASM-OQ-1, ASM-IDP-1, ASM-CAD-1 |

**Totals:** 6 PRESENT, 7 PARTIAL, 1 ABSENT. Reading: strong on dimensions 3-5 and 9-10, weak on
people (2, 6) and today's process (7). The document was written by product and systems people,
not from the shop floor [LLM] (inferred).

## 4. What was logged

- **Assumptions:** 18 entries in `00-inputs/assumptions.md`: 9 from PARTIAL or ABSENT dimensions,
  9 from document silences and inconsistencies (volumes, IdP, CAD, INV/ACC, Book IX timing, screen
  baseline, wave items, phase scope, labels). 5 would block at Gate 2.
- **Contradictions:** 9 rows (K-01 to K-09) in `STATE.md > Open contradictions`, all internal to
  the document, owned by the requesting user, marked "recorded, not to be resolved (user
  instruction)". K-09 is already closed by the document's own precedence rule.
- **Questions:** none, by user instruction.

## 5. Next action

`anchor-analysis` on the eight digests: process inventory, actor list and the commitment scan,
seeded with the screen baseline in ASM-SCOPE-1. Then `glossary-builder` from the 36-term glossary
[DOC:pp.222-226].

## 6. Framework notes (for the process owner, not the client)

- The spec-intake skill excludes "dimensions 7 (exceptions) and 11" from the ABSENT count, but in
  the checklist exceptions is dimension 8. We applied the exclusion by meaning (8 and 11); the
  class is B either way.
- The assumption register template asks for `[LLM] (inferred)` provenance, but the conformance
  script flags any `[LLM]` outside its quarantine folders, which do not include `00-inputs/`.
  Expect that finding on `/verify`.

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`[LLM]` inferred by a model and not yet verified by anyone ·
`(inferred)` nobody has said it; reasoning produced it.
**ASM-** an entry in `00-inputs/assumptions.md` · **K-nn** a row in `STATE.md > Open contradictions`.
**Class B** a partial spec: specific in some areas, thin in others.
