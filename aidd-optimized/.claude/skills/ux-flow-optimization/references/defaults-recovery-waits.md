# Defaults, Recovery and Waits

Reference for `ux-flow-optimization`. Loaded on demand.

## Contents

- Defaults doctrine
- Progressive disclosure
- Error prevention over error messages
- Recovery hierarchy
- Wait design

## Defaults doctrine

Defaults are the highest-leverage tool here and the easiest to misuse.

| Rule | Detail |
|---|---|
| Default the common case | If one option is right for a clear majority, it is the default. Measure or ask; do not guess the majority |
| Never default a consequential irreversible field | Anything that commits money, sends something outward, or triggers an irreversible transition is chosen deliberately, every time |
| Never default a legal or attested field | Signatures, confirmations of accuracy, consent, regulatory classifications. A pre-ticked attestation is worthless as evidence and in some jurisdictions is a liability |
| Defaults are visible and labelled as defaults | A silently prefilled field the user does not notice is a wrong answer waiting to be submitted |
| Derived values show their derivation | "Due 30 Nov (30 days from invoice date)" beats "Due 30 Nov". The user can spot an upstream error only if they can see the input |
| Personal defaults beat global defaults | Where a role reliably wants a different value, remember it per user; where a client reliably wants one, make it configuration, not code |
| Smart defaults degrade safely | If the derivation cannot run, the field is empty and required, never silently zero |

## Progressive disclosure

Split or hide only for a reason, and the reason is never "the page looks busy".

| Question | Answer that justifies splitting |
|---|---|
| Is there a commit boundary? | Split where the user's mental state changes: "I am describing the thing" then "I am committing to it". Never split mid-thought to balance page lengths |
| Does a branch make later fields irrelevant? | Ask the branching question first, on its own, and show only the relevant continuation |
| Does the minority need it? | Fields used by under roughly a fifth of passes go behind a disclosure with a truthful label. "Advanced" is not a truthful label; "Tax and withholding" is |
| Can they finish without it? | Anything not required to complete the task moves off the primary path entirely |
| Is it long because the domain is long? | Then do not hide it. Hiding required complexity from an expert user makes them hunt. Dense and complete beats airy and scattered for daily-use screens |

Wizards earn their cost only when the branching is real, the steps are individually meaningful,
and the user can move backward without losing work. A wizard over a flat form with no branching
is added navigation, which is friction class four.

## Error prevention over error messages

Ranked by cost to the user, cheapest first. Design at the highest rung the domain allows.

1. **Make it impossible.** The invalid option does not exist: constrained pickers instead of
   free text, date ranges that cannot invert, quantities that cannot exceed stock.
2. **Make it visibly unavailable.** The control exists but is disabled with the reason stated
   next to it. A disabled control with no reason is a dead end and is worse than an error.
3. **Warn before commit.** Inline, at the point of entry, while the value is still in focus.
4. **Block at submit.** Last resort for cross-field rules that cannot be evaluated earlier.
   Never the first line of defence for something a picker could have prevented.
5. **Allow and recover.** Correct where the error is cheap and instantly visible: undo beats
   confirmation, every time, when undo is technically possible.

Cross-reference: every rule in `process-breakdown.md`'s Rule column should be traceable to a
rung here. A rule with no interface expression is a rule the user will violate, and the
violation will be caught at submit if you are lucky and at audit if you are not.

## Recovery hierarchy

Prefer, in order: **undo > confirm > warn > nothing**.

| Situation | Affordance |
|---|---|
| Reversible, cheap to reverse | Do it immediately, offer undo for a window sized to when the user would notice (typically 5 to 10 seconds for in-session, longer for anything backgrounded) |
| Reversible, expensive to reverse (notifications sent, downstream systems touched) | Confirm first, naming what will happen outside the system |
| Irreversible by lifecycle rule (ERD consequences note) | Confirm with the object named and typed or explicitly re-selected, and tell the user it is irreversible BEFORE the confirm dialog, not in it |
| Irreversible and catastrophic | Two-person rule if the domain has one, or a delay window during which it can be cancelled |

Undo is not always available; where the ERD says a transition is irreversible, an undo
affordance is a lie. In that case the design's job is to make the moment before the transition
carry the weight, which is `content-design`'s confirmation copy plus `interaction-design`'s
commit patterns.

## Wait design

| Wait | Design |
|---|---|
| Under 100ms | Nothing. Any indicator is noise |
| 100ms to 1s | Keep the interface responsive; no spinner, the control may show a pressed or busy state |
| 1s to 10s | Skeleton or progress with the operation named. The user stays on the page |
| Over 10s | Move it off the critical path. Let the user leave, and tell them when it is done |
| Human wait (approval, review) | The user's task ends here. Design the handoff, the notification, and the state they return to. Never leave them watching |
| Unknown duration | Never a determinate progress bar. Show what is happening, and offer a way out |

Optimistic updates are eligible when the operation nearly always succeeds, the failure is
recoverable, and the user would not act irreversibly on the false success. If any of those three
is untrue, show the pending state honestly.

