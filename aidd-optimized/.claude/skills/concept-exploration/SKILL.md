---
name: concept-exploration
description: "Generates three genuinely different compositions for a primary screen and kills two against written criteria, at deliberately low fidelity. Use after the state enumeration table and before any screen is specified, and whenever a screen has been argued about twice."
---

# Concept Exploration

## Purpose
Everything upstream of this skill decides what must be true. Everything downstream specifies one
answer in exhaustive detail. This is the only step that produces more than one answer, and it
exists because the mechanism that produces good design is not rigour applied to the first idea; it
is cheap parallel options killed against explicit criteria.

The specific risk this addresses is created by the strength of the rest of the process. A hi-fi
spec here is expensive: nine blocks, eleven generic states, one state per ERD status value. That
cost is a powerful disincentive to explore, because exploring appears to mean paying it more than
once. It does not. Exploration happens at a fidelity where a concept costs twenty minutes, and the
whole point is that two of the three are thrown away before anything is specified.

The second thing it does is make a design decision **arguable**. A single composition arrived at
directly cannot be discussed, because there is nothing to compare it to; the conversation collapses
into taste, which is exactly the collapse `design-critique` is built to prevent. Two rejected
alternatives on file turn "I would have done it differently" into "here is the one you are
describing, and here is why it lost."

## Inputs
- The feature's state enumeration table (`hifi-spec`), which is the scope
- `40-models/flow-optimization/{goal}.md`: the cost table, which is the criterion
- `40-models/ia.md`: the structure and the route, which are fixed and not up for exploration
- `40-models/erd.md` consequences note: the constraints, which are fixed
- `30-design-language/skills-md/`: the system, which is fixed
- `20-research/incumbents/`: the model users arrive with, which is a cost to diverge from

Note what is fixed. Exploration is **composition** exploration inside a settled structure, model
and system. A concept that requires a different IA, a different entity model or a new component is
not a concept; it is a Type B correction or a request to `ui-designer`, and it routes there.

## Scope: which screens get this

Not every screen. Per prioritized feature:

| Screen | Concepts |
|---|---|
| The feature's primary screen, where the flow's main decision happens | Three |
| Any screen where two people on the team have already disagreed | Three |
| Any screen whose cost table claims the largest improvement | Three |
| Everything else: detail views, confirmations, settings, secondary lists | One, drawn directly |

A typical prioritized feature has one or two screens in the top three rows. Budget half a day per
feature. If it is running longer, the concepts are being drawn too well.

## What counts as a different concept

The most common failure is three variations of one idea, which produces the illusion of choice and
none of the value. Three concepts are genuinely different when they **disagree about something**.
The disagreement is usually one of these:

| Axis | The question the concepts answer differently |
|---|---|
| **What is on screen at once** | Everything in one view, versus progressive disclosure, versus a sequence of screens |
| **What the primary object is** | The record, the queue, the exception, the calendar, the person |
| **Where the decision is made** | In the list, in a detail pane, in a dedicated screen, in place inline |
| **What the user brings** | The design assumes they know what they are looking for, versus assumes they are scanning for anything wrong |
| **What is automated** | The system proposes and the user confirms, versus the user drives and the system checks |

Pick **one** axis per screen and generate along it. Three concepts that differ on five axes at once
cannot be compared, because you cannot tell which difference caused the outcome.

The test: state each concept in one sentence, without describing its layout. If two sentences are
the same sentence, you have two variations, not two concepts.

## The three generative moves

When the first concept arrives and the other two will not, these reliably produce them:

1. **Invert the container.** Whatever the first concept made primary, demote it. If the list is the
   screen and the detail is a pane, make the detail the screen and the list a rail. This is the
   cheapest move and it is right surprisingly often, because the first concept usually inherits the
   incumbent's container without anyone deciding to.
2. **Design for the exception.** The first concept always serves the happy path. Design a concept
   whose primary is the thing that goes wrong: the variance, the rejection, the overdue item. In
   this process's domain the exception is where the operator spends the day, and the happy path is
   the part the system already handles.
3. **Remove the screen.** Design the version where this screen does not exist because the decision
   is made somewhere upstream, or defaulted, or batched. Most of the time this concept loses. When
   it wins it is worth more than the other two combined, and it is the only way `ux-flow-optimization`'s
   top ladder rung gets a second chance after the flow is settled.

## Fidelity

Deliberately low, and this is a hard rule because it protects the mechanism.

- Boxes, real labels, real data at real volume from `dummy-content`. No colour beyond greyscale,
  no icons, no components from the system, no states beyond the populated one.
- Twenty minutes per concept. If one takes an hour, it is being specified rather than proposed.
- Hand-drawn, or a wireframe, or a markdown sketch of the regions and what is in them. A markdown
  sketch is legitimate and often better, because it cannot accidentally become attractive.

The reason is the same as the throwaway prototype's fidelity asymmetry: **a reviewer comments on
what looks finished.** Three polished concepts produce a conversation about which one is prettier.
Three grey boxes produce a conversation about which one is right, which is the conversation you are
paying for.

## Judging

Judged against written criteria, in this order. Do not score; argue and decide.

1. **Cost table.** Count decisions, inputs (K/R/N), waits, navigations and recalls for the primary
   task on each concept, the same way `ux-flow-optimization` counts them. This is the only
   quantitative input and it settles more arguments than people expect.
2. **Hierarchy.** Name the three levels for each concept (`visual-design`). A concept where the
   primary is contested is already losing.
3. **Exception load.** How many of the feature's exception paths does this concept accommodate
   without a new screen? A concept that handles the happy path elegantly and needs three extra
   screens for the exceptions is a concept that has hidden its cost.
4. **State load.** From the state enumeration table: how many states does each concept have to
   carry, and where do the ugly ones go? A concept with fewer states is cheaper to build and
   cheaper to keep correct, and this is a legitimate reason to prefer it.
5. **Retraining cost.** How far is this from the incumbent's model (`20-research/incumbents/`)?
   Divergence is allowed and sometimes necessary; it is never free, and the cost is paid in the
   first month by every operator.
6. **Craft judgment, stated last and stated as a prediction.** "I think concept B will feel
   relentless at hour six because there is no visual rest anywhere in it." This is admissible here
   in a way it is not in a critique, because at this stage it is cheap to act on and because the
   prediction can be handed to `usability-testing` rather than being resolved by seniority.

## The kill protocol

- Decide in one sitting, with at least one person who did not draw them. Concepts left open
  overnight merge into a fourth concept that has all the disadvantages of each.
- **Kill, do not merge.** Merging is how you get a composition with two primaries, which
  `visual-design` correctly identifies as an unresolved argument left on the screen. If one concept
  has an element the winner needs, that is one element imported into the winner, decided explicitly,
  and recorded. It is not a merge.
- Write **one line per loser** on why it lost, naming the criterion. "Concept C needed two extra
  screens for the exception paths." Not "we preferred A."
- If the decision is genuinely close, it is a candidate for `usability-testing`. Two concepts at
  this fidelity can be tested against each other in five sessions, and that is the highest-value
  test the round can carry.
- If no concept is good, say so and go back to the flow. Three bad concepts is a finding about the
  structure, not a reason to specify the least bad one.

## Procedure

1. Confirm the screen is in scope (the table above). Most are not.
2. Pick the axis of disagreement. One.
3. Generate three, twenty minutes each, using the three moves where they do not arrive on their own.
4. State each in one sentence with no layout in it. If two sentences match, generate again.
5. Count the cost table for the primary task on each.
6. Judge on the six criteria, in order, out loud, with a second person.
7. Kill two. One line each on why, naming the criterion.
8. File all three in `70-hifi/{feature}/concepts.md`, winner marked, with the criteria and the
   decision.
9. Hand the winner to block 1 of `hifi-spec`. The losers stay on file for the life of the project.

## Deciding factors

- **Three, not five and not two.** Two is a comparison, which the first idea usually wins by
  familiarity. Five is a survey and nobody argues properly about five.
- **Explore composition, not the system.** A concept that wants a new component is a conversation
  with `ui-designer` about a system rule, not a concept. One-off exceptions are how a design system
  forks (`component-architecture`).
- **The disagreement is the deliverable.** Even when the first concept wins, the round has produced
  a recorded reason, which is what makes the decision survivable at Gate 3 and at handoff.
- **Never explore on a locked fixed-bid scope after Gate 2** without checking that the winner is
  inside the list. A better concept that is a scope change is a conversation with the PO, not a
  quiet substitution (GUARDRAILS 6).

## Probing prompts

- "Say each of these in one sentence with no layout in it. Are they the same sentence?"
- "Which of these did we draw first, and did the other two arrive as arguments against it or as
  siblings?"
- "Where does the exception live in each of these?"
- "Which concept has the fewest states, and is that a reason or an accident?"
- "What does the incumbent do? Which of these is furthest from it, and who pays for that?"
- "If we had to ship one of these on Monday, which one, and what does that tell us?"
- "What is the version where this screen does not exist?"

## Guardrails

- Concepts are drawn inside the settled IA, entity model and design system. Anything requiring a
  change to those routes as a Type B (rules, entities, statuses, permissions) or as a system request
  to `ui-designer`, before the concept round continues.
- Fidelity stays low. A polished concept round is a critique of the drawings and produces nothing.
- Losers are filed, not deleted. `handoff-package`'s walkthrough is materially better when the dev
  team can see what was considered, and it is the cheapest defence against relitigating a decision
  in build.
- No merging. An element imported from a loser into the winner is recorded as a decision with a
  reason.
- Craft judgment is admissible here and is stated as a falsifiable prediction, so it can be tested
  rather than settled by seniority.

## Output

- `70-hifi/{feature}/concepts.md`: three concepts, one sentence each, the cost-table counts, the
  criteria, the decision, one line per loser
- The winner, handed to `hifi-spec` block 1
- Any close call flagged as a `usability-testing` candidate
- Any system gap found while exploring, raised with `ui-designer` as a rule request

## Exit criteria

- Every in-scope screen has three concepts on file with the winner marked
- Each concept stated in one sentence containing no layout
- Cost-table counts recorded per concept for the primary task
- One line per loser naming the criterion it lost on
- Zero merges

## Failure modes

- **Three variations.** Same idea, different padding. The round produces the illusion of a decision.
- **Polish.** The concepts get drawn well, the review becomes a critique, and the team picks the
  prettiest.
- **The merge.** All three combined into a fourth with two primaries and everyone's favourite
  element, which is the worst screen of the four.
- **Retroactive concepts.** Two losers drawn after the winner was already chosen, to satisfy the
  gate. Detectable: they are always worse in the same way, and neither ever changes anyone's mind.
- **Exploring everything.** Three concepts for the settings screen, and no time left for the one
  screen the product is actually about.
