---
name: tentative-structure
description: "The rough Phase 2A sketch set - sitemap, target flows, userflows, entity model - written to be corrected, kept in _tentative and never overwritten. Use in Phase 2A to give Gate 1 something specific to be wrong about."
---

# Tentative Structure

## Purpose
First attempts intended to be corrected. These exist so Gate 1 has structure to reject, not
just a prototype to react to; an authority who accepts a screen will often reject the data
model behind it once both are visible, and only presenting them together catches that. Polished
artifacts get approved; rough ones get corrected, and correction is the point of this phase.

The craft here is controlled roughness: rough enough that reviewers feel licensed to correct,
derived enough that every element can defend its existence, and uncertainty-marked enough that
reviewers' attention lands exactly where the team is least sure.

## What gets drafted (all marked TENTATIVE in the header)
- **Sitemap sketch**: candidate areas, derived loosely from entities and roles seen so far.
  Do not run the full information-architecture method here; that skill runs properly in 2B.
  This sketch exists to be wrong in front of the DA.
- **To-be sketches**: per as-is flow, the obvious candidate improvement, one per file,
  explicitly labelled "candidate, unvalidated". Address the pain-marked rows; do not design
  the mechanism deeply.
- **Userflow sketches**: the 2-3 highest-traffic role+task pairs only.
- **ERD sketch**: entities named, key relationships drawn, statuses guessed and marked
  (inferred) where guessed. The noun harvest from discovery (artifact pass, workaround
  spreadsheets) is the seed stock.

## Derivation discipline

Derive, do not invent: every element traces to an as-is row, a problem statement, a glossary
term, an incumbent note, or a team ideation output. Free-floating structure is decoration, and
it is also dangerous: an invented entity that looks plausible can survive Gate 1 unexamined
precisely because nobody owns the claim behind it.

Practical trace mechanism: each sketch carries a sources line ("derived from: as-is/invoicing
rows 4-11, problem PS-07, incumbent note X section 3"). One line, not a bibliography; enough
that a reviewer can ask "why does this exist?" and get an answer.

## Uncertainty marking

Reviewers correct what is visibly uncertain and politely ignore what looks decided. Mark
uncertainty ON the artifact:

- "(inferred)" labels on guessed statuses and relationships
- "?" edges on relationships whose cardinality is unknown
- An open-questions box in the corner of each sketch, listing the two or three things the team
  most wants ruled on
- Where the ERD sketch and the prototype's data assumptions differ, keep BOTH visible for the
  gate; the difference is a question, not an error to pre-resolve

The open-questions box is the strongest single reviewing aid: it converts a passive review
("looks fine") into a directed one ("you asked about X; X is wrong, and so is the thing next
to it").

## Group ideation clause

Prompt-led exploration diverges only along lines already in the KB. Before Gate 1, hold at
least one team ideation session using the KB as shared input; capture its outputs here as
additional candidates, tagged [TEAM]. Do not let the model be the only source of divergence.
Session shape: 45-60 minutes, the KB's problem statements and as-is pain rows on the wall,
each participant sketches candidate structures alone first (silent divergence), then the group
compares; convergence is NOT the goal, the candidate set is.

## Timeboxing

Timebox the whole set and declare it in STATE.md; roughness is enforced by the clock. If a
diagram is taking long enough to look finished, it has exceeded its purpose. The named failure
is polish creep: each pass "just cleaning up" until the artifact signals doneness and reviewers
stop correcting it. Low-fidelity presentation (hand-drawn look, sketch tools, visible
annotation) is a legitimate technique for keeping correction licensed, not unprofessionalism.

## Procedure
1. Declare the timebox in STATE.md.
2. Harvest: entities and statuses from discovery nouns and as-is rows; areas from entities and
   roles; to-be candidates from pain-marked rows.
3. Draft the four sketch sets with sources lines and uncertainty marks.
4. Run the group ideation session; fold its candidates in, tagged [TEAM].
5. Fill each sketch's open-questions box with the rulings the team most needs.
6. Present the set to Gate 1 together with the as-is flows and the prototype, as one set,
   never artifact by artifact.

## Deciding factors
- Coverage over depth: a shallow sketch of everything beats a deep sketch of one corner;
  depth is Phase 2B's job.
- Disagreement between candidates is an asset at this stage: presenting two candidate sitemaps
  with the open question "which mental model is yours?" outperforms presenting one and asking
  "is this right?"
- If discovery was thin somewhere (few nouns, no as-is), the sketch for that area is thin too,
  and says so. Padding a thin area with invention hides exactly the gap Gate 1 should see.

## Probing prompts (attach to the set for reviewers)
- "Which of these areas should not exist at all?"
- "Which entity here is actually two things? Which two are actually one?"
- "Which candidate to-be would break at month-end or audit?"
- "Which of these names is not the word you use?"
- "What is missing entirely: what do you touch weekly that has no home here?"

## Quality bar (self-evaluation)
- Every element has a sources line; zero free-floating structure.
- Every sketch has visible uncertainty marks and a filled open-questions box.
- The timebox held, or the overrun is reported (not absorbed).
- The set looks rough. If it looks finished, roughen the presentation or expect approval
  instead of correction.

## Guardrails
- TENTATIVE headers are mandatory; downstream agents must not cite these as sources.
- Phase 2B re-derives from refined requirements; it never polishes these files
  (GUARDRAILS 12).
- Superseded markers added once 2B versions exist, same action as the 2B file's creation.

## Output
- `40-models/_tentative/sitemap.md`, `_tentative/to-be-{goal}.md`, `_tentative/userflow-{role}-{task}.md`,
  `_tentative/erd.md`, all headed TENTATIVE, sources-lined, uncertainty-marked.
  Tentative files live in `_tentative/` and are NEVER written to the 2B path. The 2B artifact is
  a new file at the real path; the tentative one stays as the Gate 1 evidence the DA corrected.

## Exit criteria
- Set reviewed at Gate 1; corrections classified; TENTATIVE files superseded once 2B versions
  exist

## Failure modes
- Polish creep: the set gets approved instead of corrected, and the phase's cheapest learning
  window closes unused.
- Invention: structure with no traceable source survives into 2B unexamined.
- Empty open-questions boxes: the team asked for a general blessing instead of specific
  rulings, and got a nod worth nothing.
- Single-candidate anchoring: one sitemap presented alone becomes "the" sitemap in everyone's
  head, and 2B inherits an unexamined frame.
