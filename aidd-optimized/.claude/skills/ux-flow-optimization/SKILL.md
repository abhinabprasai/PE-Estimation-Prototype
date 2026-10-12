---
name: ux-flow-optimization
description: "Reduces the cost of a task: step accounting, friction classes, the elimination ladder, defaults, recovery, and a friction budget sized to consequence. Use in Phase 2B before structure is decided, and whenever a task feels longer than it should."
---

# UX Flow Optimization

## Purpose
A to-be flow proves the process is correct. It does not prove the process is good. Correctness
is the flow-modeler's job; cost is this skill's. Cost is measured in the four things a task
takes from a person: decisions they must make, information they must supply, time they must
wait, and things they must remember. Every one of those is reducible, and reducing them is a
design activity with rules, not a matter of taste.

The output is not a redesign. It is an annotated flow: per step, what it costs, which friction
class it belongs to, what the fix is, and whether that fix touches a requirement (which makes
it Type B and routes through the reconciler before anything is drawn).

Depth: `references/defaults-recovery-waits.md` carries the defaults doctrine, progressive disclosure, error prevention, the recovery hierarchy and wait design. Load it when the step needs it, not before.

## Inputs
- `40-models/to-be/{goal}.md` (the corrected process; the unit of work here)
- `40-models/as-is/{goal}.md` (the baseline you are beating; without it, improvement is asserted)
- `40-models/process-breakdown.md` (rules, exceptions, downstream effects per step)
- `40-models/erd.md` consequences note (what the interface may not offer)
- Consequence data from discovery: detection latency and remediation cost per process area
- `00-inputs/assumptions.md` where the consequence data is missing

## Step accounting (do this before proposing anything)

Build the cost table per task, one row per step. This is the artifact; the recommendations hang
off it.

| Column | What it records |
|---|---|
| Step | from the to-be flow, same numbering |
| Decisions | choices the user must make here, and whether they have what they need to make them |
| Inputs | fields they must supply; mark each K (known to the system already), R (retrievable from elsewhere), or N (genuinely new information) |
| Waits | system waits with expected duration, and human waits with expected duration |
| Navigations | screen or context changes required to complete this step |
| Recalls | things the user must hold in their head from an earlier step or another system |
| Friction class | from the taxonomy below |
| Fix | the specific change proposed |
| Type | A if it changes only the interface, B if it changes a rule, status, permission or requirement |

Totals per task: decisions, N-inputs, waits, navigations, recalls. Record the as-is totals
alongside. A to-be that does not reduce the totals is a re-platforming, not an improvement, and
that is worth knowing before Gate 2 rather than after launch.

Every K and R input is a defect until proven otherwise: the system is asking a person for
something it already has or could fetch. Prove each one ("the value can be stale, the user must
confirm it") or remove it.

## The six friction classes

Classify every costly step. The class determines the fix; skipping classification produces
generic advice.

| Class | Definition | Default fix |
|---|---|---|
| Unnecessary decision | The user chooses between options where one is right nearly always, or where the system knows which is right | Default it, and make the default visible and changeable |
| Unnecessary input | K or R input: the system has it, or could get it | Prefill, derive, or look up. Show it, do not ask for it |
| Unnecessary wait | The user is blocked on something that need not block them | Move it off the critical path, or let them proceed optimistically |
| Unnecessary navigation | Information or an action needed here lives somewhere else | Bring it to the point of decision, in place |
| Unnecessary recall | The user must remember a value, a code, or a rule | Show it at the moment it is needed, not before |
| Unnecessary rigour | Confirmation, validation, or ceremony out of proportion to the consequence | Downgrade per the friction budget below |

The sixth class is the one designers under-apply. Friction added out of caution costs the user
on every single pass and pays off only on the rare error, and nobody audits it because it looks
responsible.

## The elimination ladder

Apply in order. Stopping at a lower rung when a higher one was available is the most common
failure in this skill.

1. **Remove the step.** Ask why it exists. If its only answer is "it always has", or "so the
   system knows", it is a candidate for deletion. Removing beats speeding up, always.
2. **Move the step.** Same work, better moment: earlier when it prevents a later dead end, later
   when it is only needed by a minority of paths, off-path when the user does not need to watch
   it happen.
3. **Automate the step.** Only when the trigger and inputs are fully specified by (confirmed)
   entries (to-be-design's automation honesty rule). Otherwise it is "manual, candidate for
   automation" with the blocking open item named.
4. **Default the step.** The system chooses, the user can change it, and the choice is visible.
   See the defaults doctrine below.
5. **Speed the step.** Better control, fewer keystrokes, faster feedback. This is where most
   design effort goes and where the least value usually is.

Before removing any step, run the second-job check: a step that looks redundant is often doing
control, audit trail, training, or handoff-signalling work invisibly. Ask "who would notice if
this stopped happening, and when?" A step nobody would notice for a month was doing nothing. A
step someone notices the same day was load-bearing (to-be-design's probing prompts cover this;
this is where the answer gets used).

## Friction budget: sizing rigour to consequence

Rigour is paid for by the user on every pass. Size it against the consequence data from
discovery pass 6 (spec-intake's reconstruction interview) or from the DA directly.

| Detection latency | Remediation cost | Reversibility | Budget |
|---|---|---|---|
| Immediate | Cheap | Reversible | Zero ceremony. No confirm. Undo only |
| Immediate | Expensive | Reversible | Inline warning, undo, no blocking dialog |
| Delayed (days) | Cheap | Reversible | Prevention at entry; visible audit trail |
| Delayed | Expensive | Reversible | Confirmation with the consequence named; notify the person who would otherwise discover it late |
| Delayed | Expensive | Irreversible | Maximum: prevention, explicit confirmation, audit record, and a named human check if the domain has one |

Record the budget decision per task in the cost table. When someone later asks why this screen
confirms and that one does not, the answer is a row in a table, not a preference.

## Procedure

1. Take one to-be flow. Build the cost table with as-is baselines beside it.
2. Classify every costly step into a friction class. Unclassified friction gets generic fixes.
3. Apply the elimination ladder from rung 1 downward. Record which rung each fix landed on and
   why the rung above was unavailable.
4. Set the friction budget per task from the consequence data. Where consequence data is
   missing, open an assumption register entry rather than defaulting to caution.
5. Decide defaults, disclosure, prevention rung, and recovery affordance per step, using the
   sections above. Each decision is written down with its reason.
6. Separate Type A from Type B. Anything that changes what the process requires, who may do it,
   or when a status changes goes to requirements-reconciler BEFORE it is drawn.
7. Write the optimization note and hand it to `information-architecture` (which places the
   result in the navigation) and to `userflows-sitemap` (which draws it per role).
8. Re-run the totals. State the delta plainly: decisions, N-inputs, waits, navigations, recalls,
   before and after. If a total went up, say why it was worth it.

## Deciding factors

- **Frequency beats elegance.** Optimize the task someone does forty times a day before the one
  they do quarterly, even if the quarterly one is more interesting to design.
- **Expert users want density and keyboard paths; occasional users want guidance.** When one
  screen serves both, serve the expert by default and make the guidance available rather than
  imposed. Guidance that cannot be dismissed becomes an obstacle within a week.
- **A step the DA insists on keeping is evidence, not resistance.** It usually encodes an
  unwritten rule. Keep it, and route the rule to the reconciler so it stops being unwritten.
- **Do not optimize a flow that is still wrong.** If the to-be has open items on its rules, cost
  reduction is premature; you may be making a wrong process efficient.

## Probing prompts

For the DA and for real users:
- "Which part of this do you do so often you could do it with your eyes closed?" (optimize that)
- "Where do you keep having to go and look something up?" (recall friction, class five)
- "What do you fill in the same way every single time?" (default candidate)
- "Which step do you dread?" (usually a wait or a navigation, occasionally a decision made
  without enough information)
- "When you make a mistake here, how do you find out, and what do you do about it?" (sets the
  friction budget)
- "What do you do while you are waiting for that?"

Self-review:
- "Which N-input on this screen is actually a K or an R that I did not chase?"
- "Which confirmation here protects against something that has never happened?"
- "Which decision am I asking the user to make with information that is on another screen?"
- "If this user had done this task nine hundred times, what would they resent?"

## Guardrails

- Optimizations that change a rule, a status, a permission, or a requirement are Type B and
  route through requirements-reconciler first (CLAUDE.md section 6). Speed is never a reason to
  skip that.
- The ERD consequences note constrains what may be offered. No undo affordance on an
  irreversible transition, however much the flow would prefer one.
- Never remove a mandatory step because it is slow. Mandatory items are not deprioritization or
  optimization candidates (GUARDRAILS 6).
- Consequence data is evidence or it is an assumption register entry; friction budgets set by
  intuition are recorded as `[LLM] (inferred)`.

## Output
- `40-models/flow-optimization/{goal}.md`: cost table, friction classification, before-and-after
  totals, per-step decisions with reasons, and the Type A / Type B split
- Type B items handed to requirements-reconciler with the rationale already written
- Default, disclosure, prevention and recovery decisions handed to hifi-spec-designer

## Exit criteria (Gate 2)
- Every prioritized to-be flow has a cost table with as-is baselines
- Every costly step is classified and its fix names the ladder rung it landed on
- Friction budget set per task, sourced or registered as an assumption
- Type B items routed before any screen work started

## Failure modes
- **Speeding what should have been deleted.** Rung 5 applied where rung 1 was available; the
  most common and most expensive error here.
- **Caution as design.** Confirmations everywhere, sized to nobody's actual risk, paid for on
  every pass by every user.
- **Optimizing the demo path.** The flow shown at the gate gets three rounds of attention and
  the twice-daily correction path gets none.
- **Silent rule changes.** A step removed for speed turns out to have been a control, discovered
  at audit, with no reconciler entry explaining who decided.
