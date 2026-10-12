---
name: anchor-analysis
description: "Reads the anchor document forensically in three passes: claim inventory, commitment scan with authority class, and the silence map. Produces the verification agenda ordered by what depends on it. Use in Phase 1 once spec-intake has named the anchor."
---

# Anchor Document Analysis

## Purpose
The anchor document is the spine of Phase 1 and the baseline the refined requirement document
later supersedes. It is read to map the problem territory, not to absorb its proposed solution.
Gap documents describe deficiencies, not whole processes; the unspoken parts are usually where
the real complexity sits. This skill turns a document into four assets: a term list, a process
inventory, a prioritized verification agenda, and a silence map that seeds the highest-yield
questions the D&D call will ask.

The discipline underneath: a document is testimony, not truth. It was written by someone, for
someone, to achieve something, at a point in time. Forensic reading recovers all four and tags
every extracted claim so downstream work knows exactly how much weight each can bear.

## Inputs
- `00-inputs/PRD.md` and `00-inputs/spec-intake.md` (spec-intake has already classified and
  scored the document; do not repeat that audit, consume it)
- If intake class is C (gap document): read knowing deficiencies are the only [DOC] content
- If intake class is E (existing product): the "document" is the build; run this as an audit,
  reading screens and exports the way you would read sections (spec-intake's product-audit table)
- If intake class is F (nothing): this skill waits for `10-discovery/derived-brief.md` and then
  runs on it exactly as on a client document

## The three-pass reading protocol

Skimming produces generic questions. Three passes, each with a different job, none skippable:

**Pass 1: Read as the intended reader.** End to end, no notes. Absorb what the document wants
you to conclude. Then write one paragraph from memory: what is this document trying to get
approved, and by whom? That paragraph is your record of the document's rhetorical goal, and every
later extraction is checked against the pull of that goal.

**Pass 2: Read as an extractor.** Line by line, building the claim inventory (typology below).
Every item carries [DOC:section]. This is the slow pass; on a long document it is the one pass
that must not be sampled.

**Pass 3: Read as a skeptic.** For each described process and asserted gap: what would a
skeptical reader of the same facts conclude instead? What evidence would distinguish the two
readings? Anything where the skeptical reading is live becomes a verification question, not a
fact.

## Claim typology (pass 2 output)

Classify every extractable statement. The type decides where it goes and how hard it is verified.

| Type | Marker | Destination |
|---|---|---|
| TERM | A domain word you cannot define precisely, or that the document uses in a specific way | glossary-builder, with the document's implied definition attached |
| PROCESS | A described or implied sequence of work, with actors | Process inventory, one line each, actors named; feeds as-is-mapping |
| RULE | A commitment: must, shall, always, never, required by, within N days | Commitment scan (below); top of the DA verification agenda |
| GAP | An asserted deficiency or pain | Verbatim reference plus your paraphrase, marked (asserted) unless evidence is attached |
| NUMBER | Any quantity, threshold, date, rate, or volume | Constants table; single-mention constants are queued for verification (they are often stale) |
| ACTOR | A named role, team, or system | Actor inventory; feeds the role list and the permission surface |
| PROPOSAL | The document's own solution ideas | solution-hypotheses.md, tagged [DOC]; never into the problem set |
| ASSUMPTION | Anything the document treats as true without stating it | The silence map; these are the document's own blind spots |

## The commitment scan

Every sentence that reads as a commitment is a candidate rule, and rules are where legal and
regulatory constraints hide. For each commitment, extract four things:

1. **The rule as stated**, verbatim, [DOC:section].
2. **Its authority**: does the document say WHY (law, contract, policy, preference)? Most do not;
   the missing authority is a question, because a "legal requirement" that is actually a 2014
   policy choice changes what prioritization may do with it (GUARDRAILS 6: mandatory items are
   never deprioritization candidates, so misclassifying preference as law inflates the mandatory
   set).
3. **Its edges**: "always? even when...?" Write the edge question now, while the context is
   loaded; question-generation will ladder it.
4. **Its blast radius**: which entities, statuses, or flows the rule would constrain. High-radius
   commitments go first in the verification agenda.

## The silence taxonomy

Silences are findings. For each described process, walk the standard silence set; each unanswered
question becomes a SILENCE entry ("the document does not cover X") and seeds the exceptions
question group, which is the highest-yield group in the call.

| Silence class | The question the document does not answer |
|---|---|
| BEFORE | What triggers this process? How does the actor learn it started? |
| AFTER | What consumes this process's output? Who is downstream? |
| FAILURE | What happens when it goes wrong? Who handles it, at what cost? |
| VOLUME | How often, how many, how big? Peak versus normal? |
| EXCEPTION | When is the normal path abandoned, and what replaces it? |
| AUTHORITY | Who decides, who overrides, who is accountable? |
| BOUNDARY | Month-end, year-end, audit, cutover: what changes at the boundaries? |
| REVERSAL | Can this be undone? How are mistakes corrected today? |

Depth scales with rule_density: high means every process gets the full set; low means the top
three processes by actor count get the full set and the rest get BEFORE / AFTER / FAILURE.

## Author-intent analysis

Run once, after pass 3, and record it in the analysis file:

- Who wrote this, and what did they want the reader to conclude?
- What was happening in the business when it was written? A document written to win budget
  overstates pain; one written after an incident overweights that incident's process.
- Which voices are missing? A spec with no operational voice has an idealized as-is
  (spec-intake's scorecard reading applies); a spec with no product voice has no priorities.
- What does the document apologize for or pre-empt? Pre-emptive defenses mark the contested
  ground; the contested ground is where the call should spend time.

## Internal contradictions

Where the document disagrees with itself (section 3 says weekly, section 7 says daily), list the
pair with both references. Do not resolve; internal contradictions go to contradiction-mining
with everything else (GUARDRAILS 3). A document with zero internal contradictions over 20+ pages
is rare; if you found none, say so and treat it as a flag on your pass 2 thoroughness.

## Procedure

1. Confirm spec-intake has run (class recorded, audit scored). If not, run it first.
2. Pass 1; write the rhetorical-goal paragraph.
3. Pass 2; build the claim inventory with the full typology.
4. Commitment scan with authority, edges, and blast radius per commitment.
5. Silence pass per process, scaled by rule_density.
6. Pass 3; convert live skeptical readings into verification questions.
7. Author-intent analysis; internal contradictions list.
8. Assemble the verification agenda: commitments by blast radius, then single-mention constants,
   then unevidenced gaps. This ordering is what question-generation prioritizes from.
9. Hand off: term list to glossary-builder, full file to question-generation, process inventory
   to flow-modeler (as-is seeding), proposals to solution-hypotheses.md.

## Deciding factors
- A short document does not mean a short analysis; a two-page gap note usually carries the most
  silences per paragraph and deserves the full taxonomy on everything it touches.
- When the document is long, the commitment scan is the one pass never sampled.
- On existing-product intake, the "commitment scan" becomes a constraint scan of the build:
  every validation, every disabled state, every enforced sequence is a candidate rule, tagged
  [DOC:screen] (asserted) because shipped behaviour may be a three-year-old bug everyone works
  around.

## Probing prompts (ask these of the document, answer honestly)
- Who wrote this, and what did they want the reader to conclude? What would a skeptic conclude?
- Which described process has the most actors? That one is under-described, guaranteed.
- Which gap assertion has no evidence attached? Mark it (asserted), not fact.
- What number, date, or threshold appears exactly once? Queue it for verification.
- What is the newest thing in this document, and the oldest? Documents are sediment; date the
  layers where you can.
- If the writer read your analysis file, which entry would they push back on? That entry needs
  its evidence written down now.

## Quality bar (self-evaluation before handoff)
- Could question-generation produce specific, non-generic questions from this file alone?
- Does every extracted claim carry [DOC:section]? Are your own interpretations separately
  marked [LLM] (inferred)?
- Is at least one silence recorded per described process? Zero silences means the pass was
  skipped, not that the document is complete.
- Does the verification agenda have an order, not just a list?

## Guardrails
- Everything extracted is [DOC:section]; your interpretations are [LLM] (inferred) and are
  labelled as such in the analysis file.
- Do not resolve internal contradictions in the document; list them for contradiction-mining.
- The document is read-only. Corrections to it happen in refined-requirements.md, later.
- The document's proposals never enter the problem set; they go to solution-hypotheses.md.

## Output
`10-discovery/anchor-analysis.md` with sections: Rhetorical goal, Terms, Processes, Actors,
Asserted gaps, Commitments (with authority/edges/blast radius), Constants, Silences, Internal
contradictions, Verification agenda.

## Exit criteria
- All sections populated (or explicitly empty with a reason)
- Verification agenda ordered by blast radius
- Term list handed to glossary-builder; file handed to question-generation; process inventory
  handed to flow-modeler

## Failure modes
- Reading for the solution instead of the territory: symptom is an analysis file that
  paraphrases the document's proposals.
- Skipping the silence pass under time pressure: the exceptions question group will be empty,
  and exceptions are the highest-yield questions in the call.
- Authority inflation: every commitment treated as law, the mandatory set balloons, and
  prioritization loses its room to trade.
- Trusting the constants: a stale threshold from an old version of the business survives into
  the ERD because nobody queued it for verification.
