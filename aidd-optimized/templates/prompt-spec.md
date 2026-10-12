# Prototype Prompt: {n}-{purpose}

> **What this is.** The brief we give the tool that builds the throwaway prototype. It exists so the prototype is wrong in useful ways rather than random ones.
>
> **Where it stands.** Internal working document.
>
> **What we need from you.** Nothing - this is for reference.

Version: {v} · Author · Date · Status: draft / probed / used (copied to prompt-used.md)
Target process: {which}, chosen because it carries the most Phase 1 contradictions
Timebox: {declared in STATE.md before generation starts}

## 1 Context
Domain, user role, the specific process supported. Two to four sentences, sourced from the KB,
every domain claim carrying its tag inline as a comment.

## 2 Job to be done
One sentence, one task, end to end. "And" means two prototypes.

## 3 Data model sketch
Entities, relationships, and EVERY status each entity can hold (a prototype missing a status
cannot surface the missing screen at Gate 1). Unknowns say "unknown, do not invent" in the
prompt itself. Tags inline.

## 4 Constraints
Only (confirmed)/[DOC] items appear as constraints. (asserted) items appear as "assume, flag
visibly in the UI". Nothing here may rest on [LLM]-only provenance (GUARDRAILS 2). Tags inline.

Include the accessibility floor in one line: native controls only; every control
keyboard-operable; visible focus.

## 5 Style reference
Point at files BY NAME, in the order a generator should weight them, with the precedence rule
stated inline (a11y.md overrides everything; more specific beats more general):

**Phase 2A prompts cite the seed** - five files: `skills-md/a11y.md`, `tokens.md`, `type.md`,
`layout.md`, `color.md`. The status treatments in `color.md` are marked TENTATIVE and the prompt
says so, because a generator shown a guessed status list produces a screen that makes the guess
visible, which is exactly what Gate 1 needs to correct. **Phase 3 specs cite the full twelve.**
A 2A prompt citing a file the seed does not contain is citing a file that does not exist, and the
generator will invent its contents.

Full set: `skills-md/tokens.md`, `layout.md`, `type.md`, `color.md`, `components.md`, then the specific
ones (`forms.md`, `tables.md`, `states.md`, `content.md`, `motion.md`, `responsive.md`,
`a11y.md`), plus `style-guide.md` and `shared-specs/design-system.md` if current.

No adjectives. "Clean" and "modern" specify nothing.

State inline: the density mode by name, the realistic-content instruction with volume ("populate
per the shapes in content.md, including one negative, one zero, and the longest plausible name;
show the table at 40 rows"), and an explicit request for the empty, loading and error states.

## 6 Scope boundary
What this must NOT attempt, concretely ("no settings, no auth, no exports"). As load-bearing as
the job. Name what is deliberately stubbed, so the gate does not spend minutes on a known stub.

## Carry checklist (inside the six parts, not extra parts)
| Carry | Part | Present? |
|---|---|---|
| Every status the sketch entities can hold | 3 | |
| Density mode, named | 5 | |
| Realistic-content instruction | 5 | |
| Row and record volume | 5 | |
| Empty, loading and error states requested | 2 or 5 | |
| Accessibility floor | 4 | |
| What is deliberately fake | 6 | |

Their absence is the most common cause of a build that looks right and is unreviewable.

## Probe record
| Probe | Result |
|---|---|
| Stranger test: could a stranger produce roughly this build? Where would they diverge? | |
| Which single sentence, if deleted, would change the build most? | |
| Does any constraint rest on [LLM]-only provenance? | |
| Is the boundary specific enough to say no with? | |

Date probed: {date} · Accepted as complete by prototype-engineer: y/n

## Version delta log
| Version | Changed | Why (which build defect traced to which part) |
|---|---|---|
| *v2* | *added the six statuses to part 3* | *the build showed three badges and the DA could not name the missing ones* |

Fix the part, not just the build. Every manual patch to a generated build is prompt debt the
next generation loses.

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
