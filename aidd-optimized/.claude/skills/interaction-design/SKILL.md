---
name: interaction-design
description: "Specifies behaviour a picture cannot carry: feedback timing, what the screen shows while it saves, validation timing, save model, keyboard contract, motion tokens and concurrency. Use for every hi-fi interaction guide."
---

# Interaction Design

## Purpose
A static screen is a claim about what exists. Interaction design is the specification of what
happens between two states, and it is where most build-time clarification requests come from,
because it is the part a picture cannot carry. Every ambiguity left here is answered by a
developer under time pressure, once per component, differently each time.

The governing principle is that the system's state must be legible at all times: what is
happening, whether it worked, what is stale, and what the user's last action actually did.

Depth: `references/motion-tokens.md` (durations, easings, choreography),
`references/interaction-patterns.md` (per-pattern behaviour specs).

Depth: `references/editing-and-concurrency.md` carries autosave and dirty state, selection, inline editing, drag, and concurrent-edit handling. Load it when the step needs it, not before.

## Inputs
- `40-models/flow-optimization/{goal}.md`: friction budget, defaults, prevention rung, recovery
  affordance per step
- `40-models/erd.md` consequences note: what is irreversible (an undo affordance on an
  irreversible transition is a lie)
- `40-models/process-breakdown.md`: what is server-authoritative, what recalculates, downstream
  effects
- Non-functional expectations (spec audit dimension 10): latency, volume, concurrency

## Feedback timing

Human perception thresholds, which are physiology and not preference:

| Threshold | Perception | Design response |
|---|---|---|
| Under 100ms | Instantaneous; the user feels they caused it directly | No indicator. Any spinner here is noise and makes the product feel slower |
| 100ms to 300ms | Perceptible but unbroken; flow continues | Control shows a busy state. No layout change, no spinner |
| 300ms to 1s | Noticeable delay; attention still on task | Inline indicator on the affected region only |
| 1s to 10s | Attention wanders; the user needs to know it is alive | Skeleton or determinate progress, with the operation named |
| Over 10s | The user should be doing something else | Move off the critical path. Let them navigate away, notify on completion |

Corollaries:
- **Never show a spinner for something that usually takes 80ms.** The flash is worse than nothing.
  Delay the indicator by roughly 300ms so fast responses never show one.
- **Once shown, an indicator stays for a minimum of about 500ms.** A spinner that appears and
  vanishes in 60ms reads as a glitch, not as speed.
- **Skeletons beat spinners** where the shape of the result is known: they set the layout, prevent
  the content jump, and communicate what is coming. Skeletons must match the real layout, or they
  cause a jump anyway and are worse than a spinner.
- **Progress must be honest.** Indeterminate work gets an indeterminate indicator. A progress bar
  that sits at 90 percent destroys trust in every progress bar in the product.

## Optimistic, pending, and confirmed

The most consequential interaction decision in a data product, and one that must be decided per
action rather than per product.

Optimistic (show success immediately, reconcile later) is eligible only when all three hold:
1. The operation succeeds nearly always.
2. Failure is recoverable and the recovery is cheap.
3. The user would not take an irreversible real-world action on the strength of the false success.

That third condition rules out optimistic UI for most of what this process is used to design.
If someone reads "Payment sent" and tells a customer it was sent, an optimistic update that later
fails has caused harm outside the system that no rollback reaches.

| Mode | Presentation | Failure handling |
|---|---|---|
| Optimistic | Final state immediately, no indicator | Revert visibly, explain, restore the user's input, offer retry. Never a toast alone: the user has moved on |
| Pending | The new state shown with a visible pending treatment (not a spinner over everything) | The pending item resolves in place, success or failure |
| Confirmed | No change until the server responds | The control is busy; the rest of the page stays usable |

Whichever is chosen, the spec states it, because the developer cannot infer it from a picture.

## Validation timing

| Moment | Use |
|---|---|
| On change, before first blur | Never for errors. Correcting someone mid-word is hostile. Live *positive* affordances (a character count, a format hint filling in) are fine |
| On blur | The default for field-level validation. The user finished the thought; now tell them |
| On change, after the field has already errored | Yes. Once a field is in error, revalidate as they type so the error clears the moment it is fixed |
| On submit | Always, for everything, including cross-field and server rules. The last line, never the first |
| Server-side | Always authoritative. Client validation is a courtesy, and the spec says which rules are enforced where (`process-breakdown` Rule column) |

Error presentation:
- Beside the field, not only in a summary at the top. A summary is additionally useful on long
  forms and must link to the fields.
- The field keeps the user's input. Clearing an invalid field is the single most resented
  behaviour in form design.
- Focus moves to the first error on submit, and the error is announced to assistive technology
  (`accessibility`).
- Required-ness is marked before the user submits, not discovered by submitting.

## Keyboard contract

Not an accessibility afterthought. In expert tools it is the primary interface for the users who
matter most, and it is also the fastest way to find out whether the interaction model is coherent.

| Key | Contract |
|---|---|
| Tab / Shift+Tab | Moves through interactive elements in the visual order. If it does not match, the DOM order is wrong; fix the DOM, not the tab index |
| Enter | Activates the focused control; submits a single-input form; in a list, opens the focused item |
| Space | Toggles checkboxes and buttons; scrolls when nothing is focused |
| Escape | Closes the topmost dismissible layer, returning focus to the trigger. Never closes something with unsaved input without a guard |
| Arrow keys | Move within a composite widget (menu, tab list, table grid, radio group), not between widgets |
| Home / End | First and last within a composite |
| Cmd/Ctrl+Enter | Submits a multi-line form from within a textarea |
| Cmd/Ctrl+K | Command palette or search, if the product has one |

Focus rules:
- Focus is always visible, with a 3:1 indicator against adjacent colours. Never remove the
  outline without replacing it with something at least as visible.
- Opening a modal moves focus into it, traps it there, and returns it to the trigger on close.
- Deleting the focused item moves focus to a sensible neighbour, never to the document body.
- Route changes move focus to the new page's heading, or the keyboard user is silently stranded.
- Content that appears on hover must also appear on focus, and must be dismissible without moving
  the pointer (WCAG 1.4.13).

Document shortcuts in the spec and make them discoverable in the product. An undiscoverable
shortcut helps only the person who wrote it.

## Motion

Full token table in `references/motion-tokens.md`. The rules:

- Motion has a job: showing where something came from, maintaining continuity across a change,
  directing attention to a change the user did not cause. Motion without one of those jobs is
  decoration, and decoration on the twentieth repetition is an obstacle.
- Duration by distance and size: small and local, 100 to 150ms; medium, 200 to 250ms; large or
  full-screen, 300 to 400ms. Above 400ms an interface feels slow, regardless of how nice it looks.
- Easing by direction: entering uses a decelerating curve (fast in, settle); exiting uses an
  accelerating one (slow start, fast out) and is roughly 30 percent faster than entering, because
  nobody wants to watch something leave.
- Animate `transform` and `opacity`. Animating layout properties causes reflow and jank on the
  low-end hardware that internal tools actually run on.
- **`prefers-reduced-motion` is respected, always.** Reduced motion means transitions become
  near-instant opacity changes, not that they disappear entirely: state changes still need to be
  perceivable. Motion that conveys meaning must have a static equivalent.
- Nothing loops indefinitely except a genuine progress indicator. Nothing flashes more than three
  times per second, ever (WCAG 2.3.1; this is a seizure risk, not a style opinion).

## Procedure

1. Read the friction budget and recovery decisions from `ux-flow-optimization`. Interaction
   ceremony is sized there, not here; here it is specified.
2. Read the ERD consequences note. Mark every irreversible transition; those get commit
   patterns, never undo.
3. Per feature, fill the interaction guide block of the hi-fi spec: feedback timing per action,
   optimistic/pending/confirmed per mutation, validation timing per form, save model, keyboard
   contract, selection and editing behaviour, concurrency handling.
4. Specify motion by naming tokens, not by describing feel: "enter with `motion-medium` and
   `ease-decelerate`", not "slides in nicely".
5. Specify the reduced-motion equivalent for anything that conveys meaning through movement.
6. Walk the whole feature by keyboard only, on paper if there is no build. Any step you cannot
   describe as a key sequence is a step that will be inaccessible.
7. Hand the state list to `visual-design` (every interaction state needs a visual treatment) and
   the announcement list to `accessibility`.

## Deciding factors

- **Perceived speed beats measured speed.** Immediate feedback on a slow operation feels faster
  than a delayed response to a fast one. Spend on the first 100ms.
- **Frequency inverts the ceremony budget.** An action performed forty times a day may not have a
  confirmation dialog; the same action performed twice a year may need one. Frequency data comes
  from the actor pass in discovery.
- **Undo beats confirm whenever undo is technically possible**, because it costs the user nothing
  on the 99 percent of occasions they meant it. Where the ERD forbids undo, the weight moves to
  the moment before the commit.
- **Touch removes hover.** Any product with a tablet or phone surface cannot carry meaning in
  hover, at all. This constraint is discovered late and expensively; decide it at the start.

## Probing prompts

Self-review:
- "What does the user see in the 400ms after they click this? Say it precisely."
- "If the server rejects this after the optimistic update, what exactly happens to what they are
  looking at now?"
- "Which control here is reachable only with a pointer?"
- "What happens if they hit Escape with unsaved text in this field?"
- "Two people open this record at the same time. Describe the second save."
- "What conveys meaning only through motion? What is its static equivalent?"
- "Which spinner in this feature will flash for 60ms on a fast connection?"

For the DA and users:
- "When you do this, how long do you expect to wait, and what do you do while waiting?"
- "Has anyone ever lost work in the current system? Doing what?"
- "Do two people ever work on the same record at the same time?"

## Guardrails

- No undo affordance on a transition the ERD marks irreversible. If the flow wants one, that is a
  question for the reconciler about the lifecycle rule, not a design decision.
- `prefers-reduced-motion` is honoured; nothing flashes more than three times per second.
- Focus is never removed without a replacement of at least equal visibility.
- Hover-only paths are never the only path to an action.
- Optimistic updates are prohibited where a false success could cause an irreversible action
  outside the system.
- Interaction behaviour that changes when a rule fires is specified against the REQ-ID, not
  invented (`process-breakdown` cross-check).

## Output

- The INTERACTION GUIDES block of each `70-hifi/{feature}/spec.md`
- `30-design-language/skills-md/motion.md` and `states.md`
- Keyboard contract table per feature; announcement list handed to `accessibility`

## Exit criteria (Gate 3)

- Every mutation classified optimistic / pending / confirmed with its failure behaviour written
- Validation timing and save model stated per form
- Keyboard path complete for every task, walked end to end
- Concurrency handling stated for every multi-user surface
- Reduced-motion equivalents specified for all meaning-bearing motion

## Failure modes

- **The picture-only spec.** Beautiful screens, no behaviour, and a developer inventing the
  answer to "what happens on blur" thirty times.
- **Spinner theatre.** Loading indicators on operations that complete before the eye can register
  them, making a fast product feel slow.
- **Dishonest optimism.** Optimistic updates on operations that fail often enough to matter,
  discovered by users telling customers something untrue.
- **Silent overwrite.** Two users, one record, last write wins, nobody told, and the discovery
  happens weeks later in an audit.
- **Keyboard as an afterthought.** Retrofitting focus management after the components are built,
  which costs several times what specifying it would have.
