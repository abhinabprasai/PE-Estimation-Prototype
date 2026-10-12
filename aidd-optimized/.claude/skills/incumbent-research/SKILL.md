---
name: incumbent-research
description: "Structured teardowns of comparable and incumbent products: task walks, heuristic passes, the implied data model, and graded research answers. Use in Phase 2A to answer open questions and to mine mature products for edge cases."
---

# Incumbent and Domain Research

## Purpose
Extraction, not admiration. Mature products in the domain encode years of edge cases in their
data structures and decades of user expectation in their screens. You mine four specific things
and record complaints as carefully as capabilities, because differentiation lives in the
complaints. The output is comparable notes (identical structure across products, so columns can
be read across) plus cited answers to the research plan's questions.

## Inputs
- `10-discovery/open-questions.md` (the research plan; work it top-down)
- Glossary (industry-term column, for search vocabulary; search with the industry term, record
  with the client term)
- Config rule_density (sets extraction priority order)

## The four extraction targets

1. **DATA STRUCTURES**: how does the product model these entities? Statuses, relationships,
   what is immutable, what links to what. Read them from the UI even without documentation:
   the filter values on a list ARE the status enum; the columns ARE the attributes; what a
   search matches reveals the identifiers; what an edit screen refuses to change after a point
   reveals the lifecycle. Their ERD choices encode edge cases you have not met; diverging from
   them should be deliberate (data-modeler consumes this).
2. **TERMINOLOGY**: what the industry calls things. Feeds the glossary's industry column. The
   client's term wins in artifacts; the industry term aids retrieval and developer onboarding.
3. **MENTAL MODELS**: what a user of this domain already expects a screen of this type to do:
   default sorts, grouping, which numbers are adjacent, what is one click versus three.
   Violating established expectation is expensive; do it on purpose or not at all
   (information-architecture consumes this for its convention-versus-invention calls).
4. **FAILURE PATTERNS**: where these products are notoriously painful. Complaints, workarounds
   people publish, "why is X so hard in Y" threads, and what the last two major releases fixed
   (roadmaps confess weaknesses). Differentiation lives here.

Priority order: rule_density high -> 1,2,3,4. Low -> 3,4,2,1.

## Product selection
- 3 to 5 products: the category leaders plus one adjacent-category product. Adjacent products
  solve shared sub-problems differently and break groupthink (an expense tool and a claims
  tool are both queue-plus-audit products; the adjacent one shows which conventions are
  category habits rather than necessities).
- Where the client migrates FROM a named product, that product is mandatory and gets the
  deepest note: its model is the users' current mental model, and every divergence from it is
  a retraining cost the design should spend deliberately.

## The teardown protocol (per walkable product)

Where a trial, demo, or the client's own instance is accessible, go beyond feature reading:

1. **Task walk**: execute the project's top three to-be-relevant tasks end to end. Record step
   counts, dead ends, and what the product refuses to allow (refusals encode hard-won rules;
   every "cannot delete a posted invoice" is a lifecycle rule someone learned expensively).
2. **Heuristic pass**: evaluate the walked screens against the standard usability heuristics
   (visibility of status, match to the real world, user control, consistency, error
   prevention, recognition over recall, flexibility, minimalism, error recovery, help). Note
   violations AND notably strong solutions, each with a severity: 0 not a problem, 1 cosmetic,
   2 minor, 3 major, 4 catastrophic. Severity discipline keeps the note comparative rather
   than a list of quibbles.
3. **State harvest**: screenshot empty states, error states, and boundary content (their demo
   data's long names and zero rows). Mature products' handled edge cases are a free checklist
   of states your design must also handle (component-architecture's matrices consume this).
4. **Model extraction**: from the walk, draw their implied ERD sketch: entities, statuses seen,
   relationships navigated. Two products' implied ERDs disagreeing about the same domain is a
   question for the DA, and a good one.

## Source-quality grading (for general research answers)

Every research note grades its sources; an answer's reliability is its weakest load-bearing
source.

| Grade | Source type | Weight |
|---|---|---|
| A | Primary: regulation text, standards documents, official product documentation, published pricing | Can support a research answer alone |
| B | Practitioner evidence: engineering blogs, conference talks, detailed reviews by named users, support forums with resolutions | Two independent B sources agree = usable |
| C | Marketing pages, analyst summaries, SEO listicles | Evidence of positioning only, never of behaviour |
| D | Unattributed aggregation, AI-generated summaries found in search | Not citable; use only as pointers to better sources |

Marketing pages are evidence of positioning, not of behaviour; label them C on sight.

## Procedure

1. Work `open-questions.md` top-down; every note cites which open question it answers, or says
   it answers none (which is also a finding: it means the plan missed a topic).
2. Per product, fill `templates/incumbent-product-note.md` completely; identical structure is
   what makes notes comparable rather than merely collected. Run the teardown protocol where
   the product is walkable.
3. Per note row, cite the source ([RESEARCH:url-or-doc]), its grade, and the date accessed.
4. For general research answers: quote sparingly, paraphrase mostly, always cite. Update
   open-questions.md status per question: answered / partial / DA-ONLY / raised-new.
5. Stop conditions per question, whichever comes first: two independent A/B sources agree; one
   A source settles it; or 30 minutes without progress (mark partial, note where you looked,
   move on). Research time is a budget, and unbounded question-chasing is how the plan's tail
   never gets worked.
6. Batch-hand completed notes to kb-curator for ingestion; do not let them live only in your
   working area.

## Deciding factors
- Two sources conflict on something load-bearing: record both, graded and tagged; do not pick
  (GUARDRAILS 3 applies to research too).
- A finding implies a client rule ("the industry always requires X"): that is a QUESTION for
  the DA, never a rule. Write it into open-questions.
- Feature parity pressure ("competitor has it, we need it") is not a research finding; the
  finding is what job the feature does and whether this client's users have that job.

## Probing prompts (ask of each product studied)
- What does this product refuse to let users do? Refusals encode hard-won rules.
- What is the most complained-about workflow, and what does the complaint reveal about the
  underlying model?
- Where does this product use a different noun than everyone else, and why might that be?
- What did their last two major releases fix?
- What does their demo data include that ours would not have thought of?
- Which of their conventions would our users arrive already trained on?

## Quality bar (self-evaluation)
- Notes are column-comparable: the same row filled for every product, or explicitly marked
  not-applicable.
- Every load-bearing claim has a graded citation with an access date.
- Every walkable product got the task walk; severity ratings present on heuristic findings.
- open-questions statuses current; no question silently abandoned.

## Guardrails
- No client-identifying detail ever enters a web query (GUARDRAILS 8): search the industry
  term, the anonymized pattern, never the client's name, data, or unreleased plans.
- Everything produced is [RESEARCH:source] (inferred); nothing here is (confirmed) by
  definition, and research never sets a client rule.
- Copyright: short quotes only, always attributed; summaries substantially your own words;
  screenshots of competitor products are working notes, not handoff assets.

## Output
- `20-research/incumbents/{product}.md` per product (note + teardown + implied ERD sketch)
- `20-research/research-notes/{topic}.md` per answered question, sources graded
- Updated open-questions.md statuses
- Handoff batch to kb-curator

## Exit criteria
- Every plan item answered, partial-with-reason, or DA-ONLY
- All notes ingested by kb-curator
- Implied-ERD disagreements and convention findings handed to data-modeler and
  information-architecture respectively

## Failure modes
- Feature tourism: notes list capabilities without jobs, models, or complaints.
- Research setting rules: an industry convention hardens into a client requirement nobody
  confirmed.
- C-grade laundering: a marketing claim cited as behaviour, propagating into the KB with
  unearned authority.
- Bottomless questions: one fascinating question consuming the research budget while the
  plan's tail starves.
