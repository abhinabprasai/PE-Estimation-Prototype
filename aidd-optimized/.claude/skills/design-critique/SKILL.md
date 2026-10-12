---
name: design-critique
description: "The seven-lens pre-gate review: findings located, scored, classified as a surface fix or a rule change, and routed. Use before every gate, and whenever a screen feels wrong and nobody can say why."
---

# Design Critique

Depth: `references/session-protocol.md` carries how to run a critique as a live session rather than a solo pass. Load it when the step needs it.

## Purpose
"It feels off" is a real signal and a useless finding. This skill converts it into a located,
classified, owned defect, and it does so before the client sees the work, so that the gate spends
its expensive minutes on domain correctness rather than on things the team could have caught.

The other half of its job is protecting design decisions that are correct but unfamiliar. A
critique run against stated rules distinguishes "this violates our density rule" from "this is not
how I would have done it", and only the first is a finding.

## When it runs
- **Before Gate 1**, on the prototype plus the tentative set: lenses 1, 3, 6 and 7 only. The set is
  deliberately rough (GUARDRAILS 12) and polishing it defeats its purpose.
- **Before Gate 2**, on flows, IA, structure and the design language: lenses 2, 4a, 5a, 6 and 7.
  4a and 5a run here because a token or a term fixed at Gate 2 costs a token or a term; the same
  fix at Gate 3 repaints every screen downstream of it.
- **Before Gate 3**, on every hi-fi spec: all seven, in full. This is the main event.
- **On demand**, when a screen feels wrong.

Gate 3 re-runs the ERD reconciliation independently (`gate-review`); this critique does not replace
that and does not substitute for it.

## The seven lenses

Run them in order. The order matters: structural problems make surface findings worthless, so
finding them first saves rework on the critique itself.

### Lens 1: Hierarchy
- Name the intended primary of each screen. Does the screen agree?
- Squint test: blur until text is unreadable. Is the primary still obvious? Is the reading order
  still right?
- Five-second test: show it, remove it, ask what it was for and what they would do next. Two of
  three correct is a pass.
- One primary action per view. Two filled buttons side by side is an unmade decision.
- Is anything visually prominent that is merely present for completeness?

### Lens 2: Consistency
- Are all spacing values on the scale? All type sizes on the scale? All colours from roles?
- Is the same component used for the same job everywhere, and a different one only where the job
  differs?
- Is the page skeleton identical across screens: primary action position, filter band, action
  placement?
- Does the same status render identically in every view?
- Does the same concept carry one name everywhere (`content-design` term map)?
- Are radii, border weights and icon family uniform?

### Lens 3: State completeness
- Against the component state matrices: which states are named but never drawn?
- Every ERD status value the screen can display: is each specified?
- The four empty states, distinguished?
- Loading (initial and refresh), error (load and submit), permission-denied, one-row, maximum
  plausible volume?
- Every irreversible transition: does the user learn it is irreversible before triggering it?
- Concurrency: what happens when two users hit this at once?

### Lens 4: Accessibility

Runs in two halves at two gates, because the two halves stop being affordable at different
moments. `accessibility` names its own top failure mode as "audit-at-the-end", and a floor checked
once, at the end, is a wish.

**4a. Tokens and system - runs at Gate 2, against the design language.** Nothing here needs a
screen to exist, and everything here repaints what is downstream of it if found late.
- Contrast computed for every text role against every surface it can legally sit on, both themes,
  including hover and active. The verified table with real values lives in `skills-md/color.md`
- Focus ring: one colour product-wide, 3:1 against every adjacent surface
- Target sizes in the density tables: nothing under 24 x 24, 44 x 44 where any role is touch
- Status encoding: greyscale pass on the map. Every status distinguishable without colour
- Every component in `components.md` carries its accessibility contract rows
- Where `accessibility_driver` names a standard, the raised criteria are in `skills-md/a11y.md`

**4b. Screens - runs at Gate 3, against the specs.** Testing ladder rungs 1 to 4, with rung 4 run
on each primary task. Plus:
- Contrast verified against real values, including hover and dark mode.
- Keyboard path written, and walked.
- Focus visible everywhere; focus movement specified at every transition.
- No single-channel encoding; greyscale pass clean.
- Every control has an accessible name; every async change has a stated announcement.
- No target under 24 x 24; no hover-only path.

### Lens 5: Content

**5a. Terminology - runs at Gate 2, against the glossary and the IA.** The glossary exists by
then and drift is cheapest to fix before it is written into eighty strings.
- Every label in `ia.md` traces to a glossary entry
- No concept carries two names across the IA, the flows and the ERD
- Status labels use the client's words, not the industry's

**5b. Copy - runs at Gate 3, against the specs.**
- Real copy in every state, not placeholders.
- Every term in the glossary; no concept with two names.
- Errors say what to do; none blame the user; none expose internals.
- Confirmations name the object and the consequence, and are sized to the friction budget.
- Buttons carry verbs; labels carry nouns; nothing says "Submit".
- Numbers, dates and units formatted consistently; zero distinguished from empty.

### Lens 6: Flow friction
Against the cost table (`ux-flow-optimization`):
- Any input that is K or R and still being asked for?
- Any decision made without the information needed, on this screen, to make it?
- Any confirmation with no consequence behind it, or any consequence with no confirmation?
- Any wait with no design for what the user does during it?
- After completing the task, does the user return to a useful place with their context intact?
- Does the count of decisions, inputs, waits, navigations and recalls actually beat the as-is?

### Lens 7: Domain fidelity
The lens the rest of the design world does not have, and the one this process exists for.
- Does anything on screen contradict a (confirmed) requirement?
- Does any affordance offer something the lifecycle forbids? A delete on a reversed-not-deleted
  entity is the canonical case.
- Do the permissions shown match the ERD matrix, per role?
- Does the terminology match the client's, not the industry's?
- Is any status shown that the ERD does not contain, or any ERD status not handled?
- Would this screen survive month-end, period close, or audit?
- What does this screen let someone do that reality forbids? What does reality require that this
  screen has no place for?

## Severity and classification

Every finding gets both. Severity drives what happens now; classification drives where it routes.

| Severity | Definition | Handling |
|---|---|---|
| S1 blocker | Violates a confirmed rule, breaks an accessibility floor, or makes the task impossible | Fix before the gate. A gate held with an open S1 is recorded as such |
| S2 major | Materially harms the task: a missing state, an ambiguous error, a friction the budget does not justify | Fix before the gate if possible; otherwise carried with an owner and a date |
| S3 minor | Inconsistency with a stated rule, off-scale value, weak copy | Batch and fix; do not spend gate time on these |
| SC craft | A judgment with no rule behind it, stated as a falsifiable prediction about what a user will do or experience. "Operators will stop reading the variance column by mid-afternoon because nothing separates the rows visually" | Recorded in the craft register with a named predictor. Routed to the next `usability-testing` round as a thing to watch for, not to the owning agent as a fix. Three SC findings on one surface promotes it: that surface goes back through `concept-exploration` |
| S4 note | A preference stated as a preference, with no prediction attached | Record and drop. Not a finding |

Classification follows `gate-review`'s rule exactly: **Type A** touches a screen, a drawing,
wording or layout; **Type B** touches a rule, an entity, a status, a permission or a requirement,
and routes to requirements-reconciler before anything is edited. When unsure, it is Type B.

Lens 7 findings are Type B far more often than not. Lens 4 findings are usually Type A, with the
important exception of an accessibility requirement that changes what the product must do, which
is a requirement change.

### The SC discipline

SC exists because "the critique judges against written rules" is correct and incomplete: the rules
were written by the same people making the design, and a rule set cannot contain the judgment that
would have told you the rule set was wrong. It works only if it is disciplined.

1. **A prediction, not an adjective.** "This feels heavy" is S4. "A user scanning this for the one
   overdue row will miss it, because the only thing separating it from a normal row is a colour at
   3.1:1 in a column they are not looking at" is SC. The test is whether a session could prove you
   wrong.
2. **Named predictor.** A predictor whose SC findings are borne out by sessions has earned weight;
   one whose findings never are has learned something. Neither is possible anonymously.
3. **SC never blocks a gate and is never fixed on its own authority.** It goes to the round. If
   the round confirms it, it becomes an S1 or S2 with evidence and is a finding like any other. If
   the round contradicts it, that is recorded too.

A critique with zero SC findings across a whole feature set is as much of a warning as a critique
with no findings at all: nobody exercised judgment, or nobody felt able to.

The S4 row is deliberate. A critique that produces forty S4 notes has spent the team's attention on
taste and will be ignored the next time it produces an S1.

## Procedure

1. State which gate this critique is for, and therefore which lenses run.
2. Gather the rules the critique judges against: style guide, skills-md files, ERD, refined
   requirements, cost tables. A critique with no rules to cite produces opinions.
3. Run the lenses in order, one at a time, across the whole set. Do not review screen by screen
   through all seven lenses; a single lens run across everything finds inconsistency that
   screen-by-screen review cannot see.
4. Record each finding: lens, location, what rule it violates, severity, Type A or B, owner.
5. Run the perceptual tests (squint, five-second, greyscale, keyboard) and record that they were
   run, on what, and by whom.
6. Route Type B findings to requirements-reconciler before any fix is made.
7. File the report (`templates/design-critique-report.md`) in `70-hifi/critiques/` or
   `80-gates/` as appropriate.
8. Re-run only the failed lenses after fixes. A full re-run of all seven on a small change is
   ceremony.

## Deciding factors

- **A critique with no findings is a warning, not a pass**, exactly as a quiet gate is
  (GUARDRAILS 5). Either the set was too safe to test anything or the critique was not run
  properly. Probe before accepting it.
- **Do not critique roughness in artifacts that are meant to be rough.** Phase 2A tentative work is
  built to be corrected; polishing it defeats the mechanism.
- **Findings without a rule are S4** unless they are lens 6 or 7, where the "rule" is the user's
  task and the domain, and the finding stands on evidence instead.
- **A recurring finding is a rule problem.** The same S3 appearing on eleven screens means a
  missing or unclear rule in the style guide, not eleven mistakes. Fix the rule.

## Probing prompts

- "Which screen here would a new hire misread first, and what would they conclude?"
- "Point at the one thing this screen is for. Now squint. Is that it?"
- "Which state on this screen have I named but never drawn?"
- "What does this let someone do that reality forbids?"
- "Complete the task on this with the keyboard. Narrate where it fails."
- "Which of these findings is a rule and which is my preference? Say it out loud for each."
- "If the same defect appears three times, what rule is missing?"

## Guardrails

- Type B findings route through requirements-reconciler before any artifact is edited
  (CLAUDE.md section 6).
- Accessibility floor violations are S1 and are never downgraded to fit a schedule
  (GUARDRAILS 11).
- Preferences are labelled as preferences; a critique that presents taste as a defect loses the
  authority it needs for real findings.
- The critique judges against written rules; where no rule exists, either the finding is evidence-
  based or it is S4.
- Tentative Phase 2A artifacts are not critiqued for polish (GUARDRAILS 12).

## Output

- `70-hifi/critiques/{feature}-{date}.md` or `80-gates/pre-gate-{n}-critique.md`, using
  `templates/design-critique-report.md`
- Type B findings routed, with rationale drafted
- Recurring findings summarised as proposed style guide or skills-md rule changes

## Exit criteria (before each gate)

- All applicable lenses run across the whole set, one lens at a time
- Every finding located, scored, classified and owned
- Perceptual and accessibility tests run, with methods recorded
- Zero open S1 findings, or the gate is entered with them declared
- Type B findings routed before any fixes were applied

## Failure modes

- **Taste critique.** Forty preferences, no rules cited, and a team that stops attending.
- **Screen-by-screen review.** Every screen passes individually; the set is inconsistent and
  nobody sees it.
- **Late classification.** Findings reconstructed from memory afterwards drift toward Type A,
  and structural problems become screen edits.
- **Polished roughness.** The Phase 2A set is critiqued into looking finished, so Gate 1 approves
  it instead of correcting it, and the cheapest learning window closes unused.
- **Silent S1.** An accessibility or rule violation carried into a gate without being declared,
  discovered by the client.
