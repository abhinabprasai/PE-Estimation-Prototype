# Measurement Plan - {project}

Opened by requirements-reconciler at the start of Phase 2B, signed at Gate 2 alongside the
prioritized list, carried in the handoff manifest, and read at the loop review.

Its job is narrow and it is the piece this process has been missing: to make it possible, six
months from now, to say whether this work was worth doing. Every other artifact in the project
can prove the design is correct. Only this one can suggest it mattered.

The audit's dimension 1 opens with the right question - "Does the document say what outcome the
business wants, and how it will know it got it?" - and warns what happens without it: "prioritization
has no ranking basis and every feature argument becomes taste". This file is where that answer
lives for the rest of the project.

---

## Outcomes

Three to five. More than five means nothing is being chosen. Each one is a change in the world,
not a feature and not an output.

| Field | Guidance |
|---|---|
| ID | `OUT-{n}`, stable, never reused |
| Outcome | A change in what happens. "Invoice variances are resolved the day they are raised", not "a variance screen exists" |
| Whose | The role who experiences it, from the actor list |
| Indicator | The one number that moves if this is true. One. A second indicator is a second outcome or a vanity metric |
| Baseline | The current value, **with its source and date**. See the baseline rules below |
| Target | The value that would make this worth having done, with the by-when |
| Provenance | `[PO]` / `[DA]` / `[DOC:section]` + confidence, exactly as everywhere else |
| Counter-metric | The number that must NOT move. Every real target can be hit destructively; name how |
| Instrumentation | What must be captured for the indicator to be readable. Feeds hi-fi block 3 |
| Owner | The named human who reads it after launch |
| Read at | The date the reading happens |

### Outcome register

| ID | Outcome | Whose | Indicator | Baseline (source, date) | Target (by) | Counter-metric | Instrumentation | Owner | Read at | Provenance |
|---|---|---|---|---|---|---|---|---|---|---|
| OUT-1 | | | | | | | | | | |

---

## Baseline rules

The baseline is the part that gets skipped, and a target without one is a wish.

1. **Measured beats recalled.** Where the client has a running system, the baseline comes from its
   data: status-transition timestamps, ticket volumes, export histories, error logs. On a class-E
   engagement the team has a login, and one query answers in an hour what the as-is estimated from
   memory. Do this before Gate 2.
2. **Where measurement is impossible, say so and use the recalled figure, tagged.** `[DA] (asserted)`
   with the method: "the DA's estimate, from memory, across a typical week". An honest weak baseline
   beats a confident invented one.
3. **Where no baseline exists at all**, the first target is to establish one, and that is a
   legitimate outcome in its own right. Say it plainly rather than inventing a number to beat.
4. **A baseline captured after the new system is in use is not a baseline.** If it is not captured
   before handoff, it never will be.
5. Every baseline carries its source and its date, and both go in the cell.

---

## Requirement to outcome mapping

Every requirement in the **optional** partition names the outcome it serves. Mandatory requirements
(law, contract) may name `NONE`; that is what mandatory means.

| REQ-ID | Outcome | How this requirement moves that indicator | Confidence |
|---|---|---|---|
| | | | high / medium / speculative |

Two findings come out of this table and both are worth having before the prioritization session:

- **A requirement in the optional partition serving no outcome.** It was prioritized by seniority.
  Either find its outcome or move it down the list.
- **An outcome served by no requirement.** Either the outcome is not actually being pursued in this
  release, which should be said out loud, or the list has a gap.

---

## Instrumentation

What the build must capture. This becomes a row in `hifi-spec` block 3 (DEV NOTES) per feature and
a row in the handoff manifest. Without it, the indicator is unreadable and the plan is decorative.

| Indicator | Event or record needed | Where it is emitted | Who consumes it | In the spec? |
|---|---|---|---|---|
| | | | | REQ-ID / feature |

Two rules:

- **Nothing personal.** The same discipline as `dummy-content`: an indicator that requires
  identifying an individual operator's performance is a surveillance instrument, not a measurement
  plan, and it will be read that way by the people whose cooperation you need. Aggregate by role.
- **If it is not in a spec, it will not be built.** An instrumentation row with no REQ-ID or feature
  in the last column is a row that dies at handoff.

---

## Prioritization inputs

Filled during the Gate 2 trade session. This is what stops the pain index being the only evidence
column, which is what currently makes the prioritized list a ranking by process cost rather than
by value.

| REQ-ID / feature | Outcome served | Expected movement | Confidence in that | Pain-index delta | Effort [TEAM] | Rank |
|---|---|---|---|---|---|---|

A score whose inputs are guesses is a guess with arithmetic on top. Mark the guesses.

---

## Post-launch review

Booked at handoff, held at the date in the outcome register. Attendance: PO, DA, and whoever owns
each indicator.

| Outcome | Baseline | Target | Actual (date) | Counter-metric moved? | What we conclude | What we change |
|---|---|---|---|---|---|---|

This table is the fourth loop metric. It goes to `md-spec-loop` alongside the three process metrics
already recorded there, and it is the only one of the four that is about the product rather than
about the process.

---

## Sign-off

| Role | Name | Date | Confirms |
|---|---|---|---|
| Product owner | | | the outcomes and targets are the ones the business wants |
| Domain authority | | | the baselines are true and the counter-metrics are the right ones |
