---
name: to-be-design
description: "Designs the target process against its as-is pair, using the improvement ladder and honest automation failure modes, and states the pain-index delta. Use in Phase 2B once refined requirements exist."
---

# To-Be Flow Design

## Purpose
The corrected target process, argued against the current one. A to-be shown alone reads as a
description; beside the as-is it reads as a proposal, and people argue with proposals.
Derivation source is refined-requirements.md, never the tentative sketches: re-derive, do not
polish. The as-is pair supplies the burden of proof: every claim of improvement points at the
pain-index numbers it moves (as-is-mapping computes them; ux-flow-optimization will verify the
step accounting after this skill runs).

## Inputs
- `60-requirements/refined-requirements.md` (the source; REQ-IDs cited per step)
- `40-models/as-is/{goal}.md` (the paired baseline, pain markers and pain index included)
- ERD consequences note (lifecycle constraints the new process must honour)
- `solution-hypotheses.md` (reconciled by the reconciler; hypotheses adopted into requirements
  arrive here as REQ-IDs, not as freelance ideas)

## Per-flow content (`40-models/to-be/{goal}.md`, filename pairs with as-is/)

| Field | Content |
|---|---|
| Replaces | which as-is rows this step replaces or removes (row refs) |
| Step / Actor / System | as in as-is capture |
| Layer | VISIBLE or BACKSTAGE, as in the as-is; every crossing gets a designed status communication, because "they phone us to ask" is one of the pains this flow exists to kill |
| Automation | automatic vs manual; for automatic, the trigger, the inputs, and the failure mode (below) |
| Human decision | where judgment remains, who holds it, and what they see to decide |
| Unhappy path | what happens when this step fails or is refused |
| Requirement | REQ-IDs this step implements |
| Tag | provenance |

## The improvement ladder (apply per pain-marked as-is row, in order)

1. **Eliminate**: remove the need for the step entirely. Ask "why does this step exist?"
   before "how do we improve it". Removing beats improving, always.
2. **Simplify**: fewer decisions, fewer inputs, fewer touches, same outcome.
3. **Integrate**: kill the re-keying and the handoff seam; the data moves itself.
4. **Automate**: the system performs the step. Last on the ladder deliberately: automating a
   step that should have been eliminated fossilizes it.

Every pain-marked as-is row must be addressed: replaced, removed, or explicitly kept-with-
reason. Unaddressed pain is a finding for prioritization, not a silent omission. Run the
second-job check before any elimination: a step that looks redundant is often doing control,
audit-trail, training, or handoff-signalling work invisibly; ask "who would notice if this
stopped, and when?" (ux-flow-optimization carries the same check; here is where it first runs).

## Automation honesty

A step is "automatic" only if its trigger and inputs are fully specified by (confirmed)
entries; otherwise it is "manual, candidate for automation" with the blocking open item named.
Optimism here is the most common to-be defect and it is discovered at build, expensively.

Every automatic step also specifies its failure mode, because automation does not remove the
unhappy path, it relocates it:

| Question | Must be answered in the flow |
|---|---|
| Detection | How does anyone learn the automatic step misfired or did not run? |
| Silence window | How long can it fail before someone notices, and is that acceptable given the consequence data? |
| Fallback | What is the manual path when the automation is down, and who is trained on it? |
| Override | Can a human override the automatic outcome? Who, and is the override recorded? |

An automatic step with no detection design is a silent-failure generator; feed anything new
the ERD must support (an error status, an override permission, an audit record) to
data-modeler now, not at build.

## Human decision points

Where judgment remains, design the decision, not just the checkpoint:
- Name the decider (role) and the decision's options, including "send back" and "escalate".
- List what they must see to decide well; every listed item must exist in the ERD or become a
  data-modeler request. A decision point whose information needs are unspecified becomes a
  screen a developer guesses at.
- State the service expectation (how long may this sit?), because queues without expectations
  become the new wait pain, and the as-is wait accounting is the number to beat.
- Where the DA insists on keeping a manual checkpoint that looks removable, keep it and record
  the rationale via the reconciler; that insistence usually encodes an unwritten rule worth
  surfacing.

## Unhappy paths

Per step, not per flow: refusal, timeout, invalid input, permission denied, upstream data
missing. Each unhappy path answers: what state is the record left in (an ERD status, not a
vague "flagged"), who is notified, and where does the flow resume. New statuses invented here
are Type B material and go through data-modeler, never inline.

## Requirement tracing, both ways

- Every step cites the REQ-IDs it implements.
- Every process-relevant REQ is implemented by some step.
- Run the orphan check in both directions and file the result with the flow. Orphan
  requirements (no step) are scope questions for prioritization; orphan steps (no REQ) are
  either missing requirements (route to the reconciler) or invention (delete).

## Procedure
1. Per goal, lay as-is and to-be side by side. Walk the improvement ladder over every
   pain-marked row; record the ladder rung and the second-job check result per decision.
2. Design the layer crossings: every VISIBLE/BACKSTAGE transition gets its status
   communication.
3. Apply automation honesty and failure-mode design to every automatic step.
4. Design each human decision point with its information needs and service expectation.
5. Write unhappy paths per step; route new ERD needs to data-modeler.
6. Run both orphan checks; file the results.
7. Compute the projected pain index (same rollup as as-is: manual movements, uncaught-error
   rows, waits, crossings without status, systems touched) and state the delta plainly. If a
   number got worse, say why it was worth it.
8. Present as pairs at Gate 2, model first per the gate's order.

## Deciding factors
- Eliminate vs automate: prefer eliminating (remove the need) over automating (do the same
  thing faster).
- Where two roles disagree about a to-be step, that is a contradiction with an owner, not a
  design coin-flip.
- Variants: as-is variants either collapse (the new design makes the distinction unnecessary,
  say why) or survive (map them, with their trigger conditions, as in as-is-mapping).

## Probing prompts (for the DA at Gate 2)
- "In this new flow, whose job changed the most? Have they seen it?"
- "Which removed step was secretly doing a second job (control, audit trail, training)?"
- "Run month-end on this flow: where does it jam?"
- "If the automated step misfires silently, when is it noticed and by whom?"
- "Where in this flow would you still keep a spreadsheet, honestly?"

## Quality bar (self-evaluation)
- Every pain-marked as-is row addressed with a ladder rung and second-job result recorded.
- Every automatic step has trigger, inputs, and all four failure-mode answers.
- Every decision point has decider, options, information needs, and service expectation.
- Both orphan checks clean or their exceptions routed.
- Pain-index delta computed and stated.

## Guardrails
- Derived from refined requirements; tentative sketches are superseded inputs at most.
- No step rests on an (asserted) rule without the open item visibly cited.
- New statuses and permissions go through data-modeler; the flow proposes, the ERD disposes.

## Output
- `40-models/to-be/{goal}.md` per goal, paired, requirement-traced, failure-mode-complete,
  with the pain-index delta

## Exit criteria (Gate 2)
- Both orphan checks clean; every pain-marked as-is row addressed; DA reviewed the pairs;
  pain-index deltas presented

## Failure modes
- Description drift: to-be presented alone, nodded at, uncorrected.
- Automation optimism: steps marked automatic on unconfirmed rules, discovered at build.
- Silent-failure automation: the misfire nobody detects until month-end.
- Pain shuffling: waits removed from one role's flow reappearing in another's queue, invisible
  because only one flow was read at a time (the projected pain index across flows catches
  this).
