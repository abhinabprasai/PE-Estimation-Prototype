# Incumbent Product Note: {product}

> **What this is.** What we learned from studying an existing product in this space. What it does well, what it gets wrong, and what its design tells us about the rules of this domain.
>
> **Where it stands.** Research note. Nothing here is a decision about your product.
>
> **What we need from you.** Nothing - this is for reference.

Studied: {date} · Walkable: y/n (trial / demo / client instance) · Relationship to this project:
category leader / adjacent category / the product being migrated FROM
Everything here is [RESEARCH:source] (inferred). Nothing here can set a client rule.

Identical structure across products is what makes these notes comparable rather than merely
collected. Fill every section or mark it explicitly not-applicable.

## Source grades used
| Source | Grade (A primary / B practitioner / C marketing / D unattributed) | Accessed |
|---|---|---|
| *vendor API docs* | *A primary* | *2026-03-02* |

An answer's reliability is its weakest load-bearing source. Marketing pages are grade C:
evidence of positioning, never of behaviour. Grade D is not citable.

## 1 Data structures
Entities modelled, statuses observed, what is immutable, notable relationships.

| Entity | Statuses seen (from filters, badges, tabs) | Immutable after | Notable relationships |
|---|---|---|---|
| *Invoice* | *draft, submitted, approved, paid, void* | *once approved* | *one supplier, many invoices* |

Divergence candidates for our ERD, with why we would diverge deliberately:

## 2 Terminology
| Their term | Client's term (glossary ref) | Notes on the mismatch |
|---|---|---|
| *"hold"* | *"parked" (glossary)* | *same idea, different word; do not adopt theirs* |

## 3 Mental models
What a domain user expects a screen of each relevant type to do: default sorts, grouping, which
numbers sit adjacent, what is one click versus three. Conventions expensive to violate, and the
ones worth violating deliberately.

## 4 Failure patterns
Documented complaints, published workarounds, "why is X so hard in Y" evidence, what the last
two major releases fixed (roadmaps confess weaknesses).

| Complaint | Source + grade | What it reveals about the underlying model |
|---|---|---|
| *"can't undo an approval"* | *review site, C* | *approval is terminal in their model too* |

## Task walk (walkable products only)
The project's top three to-be-relevant tasks, executed end to end.

| Task | Steps | Dead ends hit | What surprised you |
|---|---|---|---|
| *approve an invoice* | *7* | *2 - no way back from the detail view* | *the approve control is disabled with no reason shown* |

## Refusals
What the product will not let users do. Every refusal encodes a hard-won rule.

| Refusal | The rule it implies | Question for the DA (never recorded as our rule) |
|---|---|---|
| *will not let you edit the amount after submission* | *the amount freezes at submission* | *"does your amount freeze at submission too?"* |

## Heuristic findings
Against the standard usability heuristics. Severity 0 not a problem, 1 cosmetic, 2 minor,
3 major, 4 catastrophic. Record notably strong solutions as carefully as violations.

| Location | Heuristic | Finding | Severity | Strong solution worth stealing? |
|---|---|---|---|---|
| *invoice list* | *visibility of system status* | *no indication which rows are awaiting you* | *3 major* | *no* |

## State harvest
Their handled edge cases are a free checklist for our component state matrices.

| State observed | Where | Worth copying? |
|---|---|---|
| Empty (first use) | | |
| Empty (no results) | | |
| Error | | |
| Loading | | |
| Boundary content (long names, zero rows, negatives) | | |

## Implied ERD sketch
Drawn from the walk: entities, statuses seen, relationships navigated. Two products disagreeing
about the same domain is a good question for the DA; hand this to data-modeler.

## Answers to open questions
| OQ-ID | Answered / partial | Where in this note |
|---|---|---|
| *OQ-07* | *partial* | *section 3, statuses* |

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
