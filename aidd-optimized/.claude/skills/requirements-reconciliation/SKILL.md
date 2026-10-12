---
name: requirements-reconciliation
description: "The central artifact: the refined requirement document that reconciles the original brief with the authority's corrections, with rationale, dependency links and the outcome each requirement serves. Use in Phase 2B and for every structural correction."
---

# Requirements Reconciliation

## Purpose
A reconciliation, not a rewrite. The document must show where the original and the authority
disagreed and why the resolution won. Six weeks from now, "why does this rule work this way"
is answered by the rationale column or by nobody. This is the single most valuable artifact
the process produces and the source every Phase 2B and Phase 3 artifact derives from; its
entry IDs (REQ-{area}-{n}) are the currency every flow step, breakdown rule, and hi-fi spec
cites, which is what makes end-to-end traceability checkable rather than aspirational.

## Entry structure (templates/refined-requirement-entry.md)

| Field | Content |
|---|---|
| ID | REQ-{area}-{n}, stable across versions; never reused after retirement |
| Original | the requirement as the anchor document stated it, [DOC:section]; "none" for requirements the document never had |
| Correction | the authority's correction or addition, [DA], with date/source |
| Resolved | the statement the project builds against |
| Rationale | REQUIRED where Original and Correction disagree: why the resolution won |
| Sources | all tags contributing, with confidence |
| Dependent rule | any glossary rule-bearing term or ERD constraint this rests on |
| Depends on / feeds | REQ-IDs this entry requires or enables (the dependency links that make impact analysis possible when a Type B lands) |
| Status | confirmed / asserted-open / superseded / retired |

## Requirement quality rules (applied to every Resolved statement)

- **Testable**: a reviewer can construct the passing case and the failing case from the
  statement alone. "The system supports flexible approval" fails; "orders over 50,000 require
  a director's approval in addition to the manager's" passes. If this entry were wrong, which
  gate should have caught it? If the answer is "none", the entry is untestable; rewrite until
  it is.
- **Atomic**: one requirement per entry. An "and" joining two obligations is two entries with
  their own IDs; compound entries break tracing, because a step can implement half of one.
- **Solution-free**: the entry states what must be true, not which widget achieves it.
  "Approver sees the order total before deciding" not "a modal shows the total". Solution
  language in a requirement forecloses design that has not happened yet. (Solution hypotheses
  are reconciled here, but as WHAT, not HOW: the hypothesis "auto-match invoices to POs"
  becomes "invoices matching an open PO on number and amount require no manual matching step".)
- **Vocabulary-bound**: every domain term in a Resolved statement exists in the glossary. A
  term collision discovered here routes to glossary-builder before the entry closes.
- **Quantified where quantifiable**: "quickly", "large", "rarely" are placeholders for
  numbers someone knows; chase the number or mark the entry asserted-open.

## Document structure
1. Header: SUPERSESSION NOTICE (this replaces {anchor doc} as source of truth), version, date,
   change log.
2. Entries grouped by area, ID-sorted.
3. Open items: every asserted-open entry with owner and decision deadline. Open items block
   Gate 2; visibility is the mechanism.
4. Retired entries kept, marked, with the retirement reason; deletion destroys the audit
   trail that makes "why did we drop that?" answerable.

## Build procedure (post-Gate 1)
1. Seed entries from: anchor-analysis commitments (authority class carried over), problem
   statements, PRD-draft sections, assumption-register entries being promoted, and every
   Gate 1 Type B correction.
2. Draft from the KB with citations; then EDIT BY HAND. An unedited model draft is not a
   requirement document (GUARDRAILS 7); the hand edit is where you notice the rationale gaps.
3. Apply the quality rules to every entry; split compounds, chase numbers, bind vocabulary.
4. Wire the dependency links (depends on / feeds); the ERD and breakdown cross-checks will
   consume them.
5. Confidence discipline: behaviour-constraining entries (rules, statuses, permissions,
   lifecycle) require (confirmed) to leave open items. Chase confirmations in writing; verbal
   stays (asserted).
6. Reconcile solution-hypotheses.md here, not earlier: each hypothesis either becomes part of
   a Resolved statement (tagged, solution-free), is parked with a reason, or is rejected with
   a reason. Nothing is silently dropped; the offerer will ask.

## Type B processing (any gate, any time)
1. Locate or create the entry; update Correction and Resolved; write the rationale; bump
   version; append change log.
2. Walk the dependency links: mark every entry and artifact downstream of the change stale
   per CLAUDE.md section 5; notify owning agents. The links make this a lookup instead of an
   archaeology dig.
3. Log in STATE.md rework-log with the Phase 1 topic it traces to. Three Type Bs on one
   topic: escalate (discovery converged too early on that topic).
4. Refuted register assumptions arrive here as Type Bs with their blast radius pre-written;
   process identically.

## Conflict-of-entries scan

Before Gate 2, run the pairwise scan within each area and spot-checks across areas: does any
Resolved contradict any other Resolved? The high-risk pairs are permissions versus flows
(an entry granting what another's process denies) and lifecycle versus function (an entry
requiring edits to something another entry froze). Contradictions found are handled as
contradictions (owner, ruling), never smoothed by editing one side quietly.

## Deciding factors
- Original and Correction both plausible: the rationale must name the tiebreaker (legal
  requirement, downstream cost, authority's jurisdiction). "DA said so" is a tag, not a
  rationale.
- An entry nobody can source: it does not exist; delete or send to open-questions.
- The DA corrects their own earlier correction: version it, both corrections visible, dated.
  Oscillation on one entry twice is a flag: the question under it is not settled, and the
  entry should say asserted-open until it is.
- Late-arriving client spec (spec-intake's arrival protocol): reconcile it INTO the entries
  as Corrections/contradictions; the refined document remains the source of truth.

## Probing prompts (run per entry before Gate 2)
- Could a developer implement Resolved without asking a question? Name the question they
  would ask; answer it in the entry.
- Does Resolved contradict any other Resolved?
- If this entry is wrong, which gate should have caught it?
- Which entry's rationale would not convince the person who lost the argument?

## Quality bar (self-evaluation)
- Every entry passes all five quality rules or carries its asserted-open reason.
- Rationale present wherever sources disagreed; zero "DA said so" rationales.
- Dependency links present; a sampled Type B can be impact-traced by links alone.
- Conflict scan run with results filed.
- Zero owner-less open items.

## Guardrails
- Rationale is mandatory where sources disagreed; an entry without it is incomplete.
- Versioning on every structural change; dependents stale-marked in the same action.
- The anchor document is never edited; it is superseded.
- IDs are stable and never reused; retirement is marked, not deleted.

## Output
- `60-requirements/refined-requirements.md`, versioned, change-logged, dependency-linked

## Exit criteria (Gate 2)
- Zero owner-less open items; all behaviour-constraining entries (confirmed); conflict scan
  clean or routed; DA sign-off in writing

## Failure modes
- Restatement: reads like a tidy PRD, shows no disagreement, loses the reason it exists.
- Rationale rot: corrections applied without why, and the document decays into assertions.
- Compound creep: entries with three "and"s that no flow can cite honestly.
- Link rot: dependency links unmaintained, so the next Type B's impact analysis is a guess
  and the stale marks miss a dependent artifact.
