---
name: glossary-builder
description: "Builds the project's binding vocabulary: verified definitions, rule-bearing versus descriptive classification, and the collision log. Use in Phase 1 after anchor analysis, and whenever a term's meaning is contested anywhere in the project."
---

# Glossary Builder

## Purpose
A shared, verified vocabulary, in the sense domain-driven design gives it: one language used
consistently by the client, the artifacts, the prototype, and eventually the code, so that a
term means exactly one thing everywhere it appears. Models are fluent about a domain in general
and frequently wrong about one client's implementation of it; the glossary is where that gap is
made visible and closed. It is also the labelling source for every navigation item and every
field label the product will ever show (information-architecture and content-design both bind
to it), which makes it one of the highest-leverage files in the workspace.

## Inputs
- Term list from `10-discovery/anchor-analysis.md` (with the document's implied definitions)
- New terms captured live in calls (interview-facilitation's NEW-TERMS list feeds you)
- Incumbent-research notes (industry terms the client may or may not use)
- The build itself on existing-product engagements (labels in the current UI are testimony
  about vocabulary, not proof of it; users may hate those labels)

## Entry anatomy

One entry per term, all columns, no partial rows:

| Column | Content |
|---|---|
| Term | The client's word, in the client's casing |
| Definition | One or two sentences, concrete enough to exclude near-misses |
| Class | D (descriptive) or RB (rule-bearing) |
| Includes / excludes | What is explicitly in and out; the excludes are where precision lives |
| Tag + confidence | [LLM] (inferred) at draft; upgraded only by a named human |
| Verified by, date | Who confirmed, when, in what medium |
| Client vs industry | Both words where they differ, client's word marked as the artifact term |
| Related terms | Links to terms it is confused with, contains, or borders |
| Collision notes | Where two client factions use it differently (see below) |

## Classification: descriptive versus rule-bearing

- **DESCRIPTIVE**: names a thing; getting it slightly wrong is cheap and self-correcting.
- **RULE-BEARING**: the definition constrains behaviour: a status, a document type with legal
  meaning, a threshold, a role, a period. Getting it wrong is expensive and silent.

The test, applied every time: if two people defined this term differently, would the product
behave differently? Yes means rule-bearing. When in doubt, rule-bearing; the cost asymmetry is
the same one that governs Type B classification.

Rule-bearing terms get three extras:
1. A place on the DA-verification list, sorted by how many artifacts will depend on the term.
2. The verification probes (below) attached, ready for the call.
3. A dependency note: which ERD entities, statuses, or requirements will rest on this
   definition. This is what makes "we can't verify it yet" a visible risk instead of a shrug.

## Verification probes (use in the call, one at a time)

- "When you say X, what exactly is included, and what is explicitly not?"
- "Is there a state where something is almost an X but legally is not? What is it called then?"
- "Can an X stop being an X? What happens to it?"
- "Who else in the company uses this word differently?"
- "If the system got the definition of X wrong, where would the damage show up first?"
- "Show me the last X you handled." (the artifact pass rule: a real example beats any
  definition; differences between the example and the stated definition are findings)

A hesitation on any probe is a finding, not an inconvenience: log the hesitation verbatim. The
DA pausing on "can an X stop being an X" almost always means an undocumented lifecycle edge that
erd-modeling must chase.

## Collisions and synonyms

Three defect patterns, policed continuously across every artifact, not just at Phase 1:

| Pattern | Symptom | Resolution |
|---|---|---|
| Two names, one thing | "Consignment" in ops, "shipment" in finance, same object | Pick the artifact term WITH the DA, record the loser as an alias, and enforce the winner everywhere. The alias stays searchable |
| One name, two things | "Order" means the customer's request in sales and the supplier PO in procurement | Split into qualified terms ("sales order", "purchase order"); an unqualified use anywhere is now a defect |
| Faction split | Two departments define the same term differently and both are internally correct | This is a contradiction, not a glossary entry: both definitions recorded, tagged by faction, sent to contradiction-mining with an owner. The glossary notes the split and blocks dependent artifacts until it is ruled on |

The maintenance rule: any term used in refined-requirements.md, the ERD, status mapping, or a
screen label must exist here first. Reject artifact edits that coin new terms silently; route
the new term through an entry, even a draft one, so it is visible.

## Client versus industry

Where the client's usage differs from industry usage, record BOTH with a "client says /
industry says" pair. Downstream artifacts use the client's term without exception; the industry
term is kept for research retrieval (incumbent-research searches with it) and for onboarding
developers who arrive speaking industry. Industry definitions inform; they never override
(GUARDRAILS 1: definitions are the client's reality).

## Lifecycle of an entry

```
[LLM] (inferred) draft
  -> (asserted): a human used or accepted the definition once
  -> (confirmed): the DA verified it, on the record, with the includes/excludes read back
  -> versioned: any later change bumps the entry with date, source, and reason,
     and marks dependent artifacts stale via the reconciler if the term is rule-bearing
```

A rule-bearing term changing after Gate 2 is a Type B correction by definition: the definition
IS a rule. Route it through requirements-reconciliation like any other structural change.

## Procedure

1. Seed entries from the anchor-analysis term list; model-draft definitions are fine and are
   all tagged [LLM] (inferred).
2. Classify every entry D or RB using the behaviour test.
3. Build the DA-verification list, sorted by dependency count, probes attached.
4. Verify in the call or in writing; record who, when, medium; upgrade tags.
5. After every call and every research batch: ingest NEW-TERMS, re-run the collision scan
   (search all artifacts for aliases and unqualified splits), update entries.
6. At each gate: report the count of rule-bearing terms still unverified, by dependency count.
   This number is part of the gate's readiness picture.

## Deciding factors
- Volume control: not every noun is a term. A word enters the glossary when it is domain-bearing
  (the client would correct a misuse) or contested. Padding the glossary with obvious words
  buries the twelve entries that matter.
- When the DA's definition contradicts the anchor document's implied one, that is a
  contradiction for the mining list, not a silent update.
- When the client's term is genuinely harmful (an internal word that collides with a legal term
  of art), raise it with the DA once, record the ruling, and follow it.

## Quality bar (self-evaluation)
- Could a new team member read any RB entry and correctly classify five borderline instances?
  If the includes/excludes would not settle a borderline case, the entry is not done.
- Does every RB entry have a dependency note?
- Has the collision scan actually been run against current artifacts, or only against Phase 1
  files?

## Guardrails
- An [LLM] definition of a rule-bearing term never silently supports an artifact; the
  dependency is either verified first or logged in open-questions with an owner.
- Definitions are the client's reality. Industry definitions inform, never override.
- Faction splits are contradictions with owners, never quietly resolved by the glossary.

## Output
`10-discovery/glossary.md`: full entry anatomy per term, DA-verification list with status,
collision log.

## Exit criteria (Phase 1)
- Every rule-bearing term either (confirmed) or on open-questions with an owner
- Zero unresolved collisions without owners
- Verification-status summary written into STATE.md

## Failure modes
- Treating fluency as verification: the glossary looks complete and is [LLM] throughout.
- Letting artifacts coin terms mid-project: two names for one thing, or one name for two,
  discovered at build when the API and the UI disagree.
- The dead glossary: verified once in Phase 1, never maintained, silently diverging from the
  artifacts it was supposed to govern.
- Definition by committee: entries grown vague enough that everyone can agree, which is the
  same as having no entry.
