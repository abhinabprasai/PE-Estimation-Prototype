---
name: prompt-authoring
description: "Writes the six-part prototype prompt and the provisional PRD, with the carry table that puts states, density, volume and the accessibility floor into every prompt. Use in Phase 2A once the knowledge base index exists."
---

# Prompt Authoring (and the PRD Draft)

## Purpose
A prompt is a design document: it is the artifact you keep, iterate, and archive with the
prototype. Refining a prompt costs minutes; regenerating a prototype costs hours. You own
that trade.

## The six mandatory parts
1. CONTEXT: domain, user role, the specific process being supported. Two to four
   sentences, sourced from the KB.
2. JOB TO BE DONE: the one task this prototype must let someone complete, end to end.
   One sentence. If it needs "and", it is two prototypes.
3. DATA MODEL SKETCH: the entities involved and their relationships, even roughly; the
   statuses that exist. Pull from the tentative ERD; where the ERD is silent, say
   "unknown, do not invent" in the prompt itself.
4. CONSTRAINTS: rules that must not be violated. Only (confirmed) or [DOC] items may
   appear as constraints; (asserted) items appear as "assume, flag visibly in the UI".
5. STYLE REFERENCE: point at 30-design-language/style-guide.md and the skills-md files by
   name, and at shared-specs/ when current. Adjectives are banned; "clean" and "modern"
   specify nothing. Cite the files the build actually needs, in this order, because
   generators weight what comes first. In Phase 2A cite only the five seed files (a11y.md,
   tokens.md, type.md, layout.md, color.md with its TENTATIVE status sketch); the other seven do
   not exist yet and a generator asked for them will invent their contents. In Phase 3 cite the
   full twelve: tokens.md, layout.md, type.md, color.md,
   components.md, then the specific ones (forms.md, tables.md, states.md, content.md,
   motion.md, responsive.md, a11y.md). State the precedence rule inline: a11y.md overrides
   everything, and the more specific file wins over the more general (style-guide-authoring).
6. SCOPE BOUNDARY: what this prototype must NOT attempt. As load-bearing as the job; the
   boundary is what keeps the timebox honest.

## What a prompt must carry beyond the six parts

These are not extra parts; they belong inside the parts above, and their absence is the most
common cause of a build that looks right and is unreviewable.

| Carry | Where | Why |
|---|---|---|
| Every status value the sketch entities can hold | Part 3 | A prototype missing a status cannot surface the missing screen at Gate 1 |
| The density mode, named | Part 5 | Otherwise the generator produces consumer airiness and the gate discusses spacing instead of the domain |
| Realistic content instruction | Part 5 | "Populate with realistic data per the shapes in content.md, including one negative, one zero, and the longest plausible name." Lorem ipsum in a rule-dense screen is the review that did not happen (dummy-content) |
| Row and record volume | Part 5 | "Show the table at 40 rows" produces a different and more honest build than the generator's default of five |
| The empty, loading and error states | Part 2 or 5 | Ask for them explicitly or you will not get them, and they are where half the domain questions live |
| The keyboard and accessibility floor | Part 4 | "Native controls only; every control keyboard-operable; visible focus" costs one line and prevents an unusable instrument |
| What is deliberately fake | Part 6 | Which parts are stubbed, so the gate does not spend its minutes on a known stub |

## Procedure
1. Choose the target process with prototype-engineer: the one with the most Phase 1
   contradictions attached yields the most correction at Gate 1.
2. Draft all six parts from KB citations; every claim in parts 1, 3, 4 carries its tag
   inline as a comment.
3. Read shared-specs/: current (reviewed at last project close) -> cite in part 5; stale
   -> escalate before consuming (GUARDRAILS 9.8).
4. Iterate on paper: run the prompt-review probes below, revise, version
   (prompts/{n}-{purpose}.md). Only then hand to prototype-engineer.
5. After generation, record deltas: what the build got wrong traces to which part; fix the
   part, not just the build.

## PRD draft procedure
- Structure mirrors refined-requirements-to-be: per requirement, statement + KB citation +
  tag + confidence. Where the KB is silent, the section literally says OPEN -> open-
  questions ref. Header states: PROVISIONAL, superseded by refined-requirements.md at
  Phase 2B.
- Structure the draft against the fourteen dimensions in
  `spec-intake/references/spec-audit-checklist.md`, so the same audit that scored the client's
  spec can score yours. A section you cannot fill is scored ABSENT and named, never smoothed.
- Where the project had no supplied spec, the draft's sources are the signed derived brief and
  the assumption register. Every section resting on a register entry carries its ASM-ID inline;
  the reader must be able to see which parts of the PRD are evidence and which are standing
  assumptions.
- The draft is never the substitute for a signed brief. It is a model-assisted consolidation and
  it is edited by a human before anyone treats it as a source (GUARDRAILS 7).

## Deciding factors
- Constraint vs assumption: would violating it make the DA say "that is wrong" (constraint)
  or "that is not how I pictured it" (assumption)? Assumptions are cheap to show and
  cheap to correct; constraints must hold.
- If part 3 is mostly "unknown", the prototype is premature: send the unknowns to the DA
  list first, or narrow the job.

## Prompt-review probes (run before every handoff)
- Could a stranger produce roughly the same build from this prompt? Where would they
  diverge? That divergence is your ambiguity.
- Which single sentence, if deleted, would change the build most? Strengthen it.
- Does any constraint rest on [LLM]-only provenance? Remove it (GUARDRAILS 2).
- Is the boundary specific enough to say no with? "No settings, no auth, no exports" beats
  "keep it simple".

## Quality bar (self-evaluation before handoff)
- All six parts present, plus every row of the carry table addressed or explicitly waived.
- Every claim in parts 1, 3 and 4 carries its inline tag; zero untagged domain facts.
- The stranger test run honestly: name the two places a stranger would diverge, and either
  tighten them or accept them knowingly.
- Version history intact: the prompt file shows what changed between versions and why (the
  delta log is what makes part-fixing after generation possible).

## Guardrails
- No prompt ships with a missing part; incomplete prompts are returned, not patched by the
  engineer
- Adjective ban in part 5 is absolute; style is referenced, not described
- Model-drafted prompt text is fine; model-invented domain facts are not

## Output
- 30-design-language/prompts/{n}-{purpose}.md (versioned)
- 60-requirements/prd-draft.md (provisional)

## Exit criteria
- Prompt versioned, probes passed, engineer accepted it as complete

## Failure modes
- Adjective styling: every generation looks different and none is reviewable
- Constraint smuggling: an (asserted) rule hardens into a constraint because it sounded
  authoritative
