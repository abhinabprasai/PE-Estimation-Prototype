---
name: spec-intake
description: "Classifies what actually arrived as the spec (class A-F), audits it against fourteen dimensions, fills the PRD slot, opens the assumption register, and runs the reconstruction interview when there is no spec. Use in Phase 0, before anything else, and whenever a new client document lands."
---

# Spec Intake and the No-Spec Path

## Purpose
Projects rarely arrive with the document the process assumes. They arrive with a slide deck,
a two-page gap note, a Jira export, a competitor's screenshots, a login to an existing
system, or a person saying "we will send it next week". This skill makes that normal instead
of blocking: it names what arrived, scores what is missing, and starts the substitute path in
the same session. The output is always the same shape, so every downstream agent reads one
predictable file no matter how the project began.

## The placeholder contract (this is why the placeholder exists)

`00-inputs/PRD.md` exists in every project from the moment `/new-project` runs. It is one of
exactly two things and never a third:

1. **The client's spec, filed verbatim.** Read-only. The header block on top records origin,
   received date, version, and who supplied it. The body below is untouched client text.
2. **The placeholder, filled in.** It declares NO SPEC SUPPLIED, names the intake class, names
   the substitute path that is running, and points at the artifact that is standing in for the
   spec until one exists.

It is never absent, and it is never left as an unedited template. An unedited placeholder in a
project past Phase 0 is a process defect: it means nobody decided how this project would learn
what it is building. Say so and fix it before any other work.

The placeholder never becomes the spec by aging. It is replaced by
`60-requirements/refined-requirements.md` at Phase 2B like any anchor document, or by the
signed discovery brief when the project began with nothing.

## Intake classes

Run this classification in the first session. Record the result in
`00-inputs/spec-intake.md` and in `PROJECT_CONFIG.md > intake_class` (the class), and set `anchor_document`
separately to supplied / none / existing-product.

| Class | What arrived | Config value | Trust level | Substitute path |
|---|---|---|---|---|
| A. Full spec | A document that states goals, users, rules, and scope | supplied | [DOC] on everything it states; silences still unknown | None. Audit it, then anchor-analysis normally. |
| B. Partial spec | Covers some areas properly, others by one line | supplied | [DOC] where specific, treat one-liners as headings not requirements | Audit marks thin areas; question-generation weights them |
| C. Gap document | Describes what is broken, not what exists or is wanted | supplied | [DOC] on the deficiencies only | As-is reconstruction interview; gaps are problems not requirements |
| D. Deck or notes | Slides, meeting notes, an email thread, a Jira export | supplied | (asserted) at best, even where it reads like a rule | Consolidate into a derived brief, then get it signed |
| E. Existing product | A login and "make it better" | existing-product | The build is evidence of behaviour, not of intent | Product audit as the anchor (see below) |
| F. Nothing | Verbal only, or "the spec is coming" | none | Nothing to trust | Reconstruction interview producing a signed discovery brief |

Classes D, E and F all resolve to the same obligation: something signed must exist before
Phase 2B, and it is produced by the project, not waited for.

## Procedure

1. **Inventory.** List every file, link, login, and named conversation offered as input. One
   row each: what it is, who gave it, date, and which class it belongs to. Multiple inputs are
   normal; classify the set by its strongest member, and keep the weaker ones as evidence.
2. **File and freeze.** Everything goes into `00-inputs/` read-only with origin-and-date
   filenames. Never edit a client document; corrections happen downstream in
   `refined-requirements.md`.
3. **Write the header block** on `00-inputs/PRD.md`: class, origin, date, supplied-by, and one
   line naming the substitute path if the class is not A.
4. **Audit** with `references/spec-audit-checklist.md`: fourteen dimensions, each scored
   PRESENT / PARTIAL / ABSENT with a section reference or a blank. Do not soften scores; the
   audit's value is entirely in its ABSENTs.
5. **Convert absences into questions.** Every ABSENT and every PARTIAL becomes a question for
   `question-generation`, grouped by whether the domain authority, the product owner, or
   research can answer it. An ABSENT nobody can answer becomes an assumption (step 6).
6. **Open the assumption register** (`templates/assumption-register.md`,
   filed at `00-inputs/assumptions.md`). Every assumption carries: the assumption, why it was
   needed, what it blocks if wrong, the cheapest way to test it, an owner, and a decision date.
   This is the file that lets design proceed without a spec honestly. It is reviewed at every
   gate and shrinks over time; a register that never shrinks means nobody is chasing answers.
7. **Start the substitute path** for classes C through F, using the matching section below.
8. **Hand off:** audit and question list to `question-generation`, term list to
   `glossary-builder`, whole file to `anchor-analysis` (which reads the spec itself, where one
   exists).

## Substitute paths

### Class D, E, F: the reconstruction interview
Full protocol in `references/reconstruction-interview.md`. The short version: you cannot ask
"what do you want built"; you ask people to narrate their world, and the spec is derived from
the narration. Six passes, in order, each timeboxed:

1. **Goal pass.** What is the business trying to achieve, and how is it measured today?
2. **Actor pass.** Who touches this process, in what role, how often, and who overrides whom?
3. **Artifact pass.** What documents, records, and numbers move through it? Ask to see real
   ones (redacted). Nouns collected here seed the entity model.
4. **Rule pass.** What must always be true, what is never allowed, and which of those is legal
   rather than preference?
5. **Exception pass.** When does it break, who fixes it, and what does the fix cost?
6. **Consequence pass.** If the system got this wrong for a month, what damage is done, who
   discovers it, and when?

Output is `10-discovery/derived-brief.md`, tagged throughout, and it goes to the domain
authority for written confirmation. Once signed it IS the anchor document for the project and
`00-inputs/PRD.md` records the supersession pointer. Unsigned, it caps everything downstream
at (asserted) and Gate 1 opens with that fact stated out loud.

### Class E: the product audit
The build is the document. Read it the way you would read sections:

| Read this | To extract |
|---|---|
| Every screen reachable by each role | The de-facto sitemap and permission surface |
| Every form field, including disabled ones | Attributes, required-ness, validation rules |
| Every status badge, filter value, and empty state | The closed status lists (compare later to what the DA says) |
| Every list view's default sort and filter | What the users actually optimise for |
| Export and report outputs | What the business measures, and what downstream systems consume |
| Admin and settings areas | The configuration surface nobody mentions until build |

Screenshot everything into `00-inputs/audit/` with a per-screen note. Critical discipline: the
build shows what the system DOES, never what it SHOULD do, and never why. Every audit finding
is `[DOC:screen-name] (asserted)`, because a shipped behaviour can be a bug that everyone has
worked around for three years. Ask the DA about each one; the ones they are surprised by are
the highest-value findings in the phase.

### Class C: gap documents
A gap document lists deficiencies. Deficiencies are problem statements, not requirements. Two
hard rules: the gap document never seeds a requirement directly, and the absence of a complaint
about an area is not evidence the area works. Run the as-is reconstruction for every process the
gaps touch, and add the untouched adjacent processes to open-questions.

## Working without a spec, for downstream agents

Any agent that hits a missing answer follows this ladder, in order, and stops at the first rung
that produces something honest:

1. **Knowledge base.** Ask `kb-curator` with a citation requirement. If the KB answers, use it.
2. **Client evidence.** Existing build, exports, screenshots, real documents in `00-inputs/`.
   Tag `[DOC:source] (asserted)`.
3. **Domain authority.** Queue it. If the answer blocks work today, escalate as DA-ONLY rather
   than guessing.
4. **Research.** Incumbent behaviour and domain convention. `[RESEARCH:source] (inferred)`.
   Informs a design decision; never sets a client rule (GUARDRAILS 1).
5. **Assumption.** Write it into the register with its blast radius and its test, mark the
   artifact it feeds with a visible assumption reference, and continue.

Rung 5 is legitimate and expected. What is never legitimate is skipping to rung 5 silently, or
producing an artifact whose reader cannot tell which parts stand on rung 1 and which on rung 5.
Every artifact built on assumptions carries an ASSUMPTIONS box near the top listing the register
IDs it depends on.

## Deciding factors

- **Sign or proceed.** A signature is worth waiting a few days for and is never worth waiting a
  phase for. Proceed on the assumption register, and put the unsigned status in the gate report
  rather than in a footnote.
- **Spec quality vs spec presence.** A bad spec is more dangerous than no spec, because it is
  trusted. Dimensions 7 (exceptions) and 11 (environment) are ABSENT by default in almost every real spec
and are excluded from this count. When the audit scores four or more of the REMAINING twelve ABSENT, treat the project as class D
  regardless of how the document looks, and say why in the intake file.
- **Stale spec.** Written more than six months before the project, or written for a version of
  the business that has since changed: date-check every quantitative claim in it against the DA.
  Old numbers in a confident document are the most reliable source of wrong requirements.
- **Multiple contradicting specs.** Do not choose. File both, list the contradictions, assign
  owners (GUARDRAILS 3). Which document wins is a client decision with consequences.

## Probing prompts

For whoever supplied the spec (or would have):
- "Which part of this is decided, and which part is somebody's opening position?"
- "What did the last version of this document say that this one does not?"
- "Who disagreed with this document, and what did they disagree with?"
- "If we build exactly this and it fails, what will the failure look like?"
- "What is deliberately not in here?"

For no-spec projects:
- "Describe the last full working day this process ran normally, start to finish."
- "What did you have to fix by hand last week?"
- "If I shadowed one person for a day to understand this, who would it be, and why them?"

## Guardrails

- Client documents are read-only in `00-inputs/`; corrections live downstream (GUARDRAILS 8).
- Nothing from a client spec goes into a web query, including for "checking what this term
  means" (GUARDRAILS 8).
- An assumption is never upgraded by repetition. Only a human upgrades it, and the register
  records who and when.
- The placeholder is never quietly deleted. If a real spec arrives late, the placeholder becomes
  the intake record and points at the new file with its arrival date.
- Absence of a spec is disclosed, not managed around: it appears in STATE.md blockers, in the
  gate report, and in the handoff manifest.

## Output

- `00-inputs/PRD.md` (client spec with header block, or the completed placeholder)
- `00-inputs/spec-intake.md` (inventory, class, audit scores, absence-to-question mapping)
- `00-inputs/assumptions.md` (the register, live for the project's life)
- `10-discovery/derived-brief.md` (classes D, E, F) once the reconstruction runs
- `00-inputs/audit/` (class E screenshots and per-screen notes)

## Exit criteria

- Class recorded in PROJECT_CONFIG and STATE
- All fourteen audit dimensions scored, each ABSENT converted to a question or a register entry
- For classes C through F: substitute path started and its owner named
- Every register entry has an owner and a decision date

## Failure modes

- **Waiting.** Two weeks lost to "the PRD is coming", with a discovery call that could have run
  on day one.
- **Deck laundering.** Slide bullets become requirements because they were formatted like
  requirements.
- **Silent assumption.** A designer answers a missing rule plausibly, nobody logs it, and it
  surfaces at build as a defect with no owner.
- **Audit flattery.** Every dimension scored PARTIAL to avoid the awkward conversation, which
  produces a question list that targets nothing.
