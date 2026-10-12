# 60-requirements/: the central artifact

Owners: prompt-spec-writer (the provisional draft), requirements-reconciler (everything after).

| File | What it is |
|---|---|
| `prd-draft.md` | PROVISIONAL. Structured against the fourteen audit dimensions, cited to the KB, superseded at Phase 2B. Sections the KB cannot answer say OPEN and point at open-questions |
| `refined-requirements.md` | The source of truth from Phase 2B onward. A reconciliation, not a rewrite |
| `prioritized-features.md` | The gating artifact for Phase 3. Signed by PO and DA in writing |
| `traceability.md` | The conformance matrix: every REQ-ID mapped to the flow steps, breakdown rules, ERD constraints and hi-fi specs that carry it. Maintained by process-evaluation on its cadence; `/verify` refreshes it |

## Entry structure in refined-requirements.md

`ID | Original [DOC:section] | Correction [DA] | Resolved | Rationale | Sources | Dependent rule |
Status`

The rationale column is the reason this document exists. Six weeks from now, "why does this rule
work this way" is answered there or by nobody. "The DA said so" is a tag, not a rationale; the
rationale names the tiebreaker.

## The header carries the supersession notice

This document replaces the anchor document as the source of truth, with date and version. The
anchor document is never edited; it is superseded.

## What blocks Gate 2

Any owner-less open item. Any behaviour-constraining entry (rule, status, permission, lifecycle)
still at (asserted). Any assumption whose blast radius touches one of those. An unsigned
prioritized list.

## The two prioritization rules that are not negotiable

1. **Mandatory is not a candidate.** Anything a (confirmed) DA rule or a [DOC] commitment
   requires is in by definition. Prioritize among the optional.
2. **Process completeness over feature count.** A half-supported process is worth less than no
   support, because it forces users to run two systems at once. Rank in units of complete to-be
   flows.

Delete this file once the folder holds real requirements.

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
