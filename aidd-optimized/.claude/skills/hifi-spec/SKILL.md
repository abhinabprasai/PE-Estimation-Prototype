---
name: hifi-spec
description: "Writes the nine-block production-intent feature spec: state enumeration first, every screen state including every entity status, dev notes, interaction guides, real copy and the accessibility contract. Use in Phase 3 after Gate 2."
---

# Hi-Fi Feature Specification

## Purpose
Production intent for the prioritized list, exactly, with completeness that survives contact with
development. A hi-fi spec in this process is not a set of pictures. It is a document a developer
can build from without asking a question, and a reviewer can audit without the designer in the
room.

Two defects dominate here and this skill is built around preventing them: status-mapping-versus-
ERD mismatch, and states that were named but never designed.

## Preconditions
- Gate 2 passed; the feature is on `60-requirements/prioritized-features.md`
- The ERD consequences note is in hand
- The style guide and skills-md set exist (`style-guide-authoring`)
- The flow's cost table and friction budget exist (`ux-flow-optimization`)
- The IA places this feature (`information-architecture`)

## The state enumeration table (build this first, before any screen)

Feature x entity x status, one cell per combination. Each cell is either a screen state to
specify or an explicit "not reachable here" with the reason. This table is the scope of the
feature, and building it first is what stops states being discovered late.

| Entity | Status | Screen or view | Specified? | Notes |
|---|---|---|---|---|

Take the status values from the ERD's closed lists. Never re-derive them from memory; that is how
a value goes missing and reappears in Phase 3 as a Type B correction.

## The nine spec blocks

`70-hifi/{feature}/spec.md` carries a DRAFT header until all nine are present. No silent partials.

### 1. SCREEN STATES
The generic set: empty (first use), empty (no results), loading (initial), loading (refresh),
partial, error (load), error (submit), success, permission denied, one item, maximum plausible
volume. Plus one state per ERD status value the feature's entities can hold, from the enumeration
table.

Each state carries: what the user sees, what they can do, what is announced to assistive
technology, and the real copy (`content-design`, not "error message here").

### 2. SCREEN COMPOSITION
The part most specs omit and every build then invents. Per screen:
- The three hierarchy levels named: primary, secondary, tertiary (`visual-design`)
- The page skeleton slot each element occupies (`skills-md/layout.md`)
- Which component carries each element, cited from `components.md`, with the selection reason
  where it was not obvious (`component-architecture`)
- Density mode if it differs from the product default, with the reason
- The squint-test result: what a reviewer should see first

### 3. DEV NOTES
Behaviour the visual cannot carry: validation rules with REQ-IDs cited, calculation logic, what
recalculates when, what is server-authoritative versus client-side, what is cached and how stale
it may be, what the API must supply that the current model does not.
Plus **instrumentation**: the events or records this feature must emit for its outcome's number
to be readable, from `measurement-plan.md`. A number with no instrumentation row in any spec is a
number nobody can read after launch, and the plan becomes decorative. Nothing personal: aggregate
by role, never by named operator.

### 4. INTERACTION GUIDES
From `interaction-design`: feedback timing per action, optimistic / pending / confirmed per
mutation with its failure behaviour, validation timing, save model and dirty-state handling,
keyboard contract with the written key sequence, selection and inline-edit behaviour, concurrency
handling, motion tokens by name with their reduced-motion equivalents.

### 5. STATUS MAPPING
Per status: the trigger, who may trigger it (from the ERD permission matrix), which transitions
are irreversible, what every role sees in that status, and what is announced when it changes.

### 6. SCREEN FLOW
How screens connect across the feature's userflows, with exception paths drawn rather than
implied. Every `process-breakdown` Exception that routes here is shown, including where it comes
from and where the human who receives it goes next.

### 7. CONTENT
Real copy for every state and control (`content-design`): labels, helper text with REQ-IDs cited
in the spec, all four empty states, all four error kinds, confirmation copy at the tier the
friction budget sets, status labels in glossary terms.

### 8. ACCESSIBILITY
From `accessibility`: contrast verified for this feature's specific pairings, the keyboard path
written and walked, focus movement at every transition, the announcement per asynchronous change
with its politeness level, target sizes, and any recorded exception with an owner.

### 9. RESPONSIVE AND DUMMY CONTENT
Adaptation per breakpoint for every surface any role reaches on a non-desktop device
(`responsive-design`), including the narrow strategy for every table with its reason. Plus the
content set per `dummy-content`: shaped identifiers, boundary values, longest plausible strings,
a negative and a zero per numeric surface, stored beside the spec at
`70-hifi/{feature}/content.md` so review and build use identical data.

## Procedure

1. **Scope check.** The feature is on the prioritized list or it is redirected to the list. No
   exceptions mid-phase, and on fixed-bid engagements a list change after Gate 2 is a scope change
   that escalates before any work (GUARDRAILS 6).
2. **Open the ERD consequences note before designing.** Every lifecycle and permission constraint
   is designed in from the start. "Reversed, never deleted" means no delete affordance exists
   anywhere in this feature, and discovering that after the screens are drawn is a repaint.
3. **Build the state enumeration table.** This is the scope.
3a. **Explore before specifying.** For this feature's primary screen, and any screen already
    argued about or carrying the largest claimed improvement, run `concept-exploration`: three
    compositions differing on one stated axis, twenty minutes each, greyscale, real data. Judge
    against the cost table, the hierarchy method, exception load, state load and retraining cost.
    Kill two. File all three at `70-hifi/{feature}/concepts.md`; the winner enters block 1.
    This step sits after the enumeration table because that table is what tells you how expensive
    each concept actually is, and state load is the criterion teams most reliably forget. It sits
    before block 1 because nine blocks per screen is a strong disincentive to reconsider a
    composition, so the reconsideration has to happen while it is still free.
4. **Read the cost table and friction budget** for this feature's flow. The confirmations, defaults
   and disclosure are already decided there; here they are specified, not re-argued.
5. **Write blocks 1 to 9**, citing REQ-IDs throughout. The spec must be self-auditing: a reviewer
   traces any behaviour to its source without you in the room.
6. **Self-reconcile the status mapping against the ERD**: values, triggers, permissions,
   irreversibility. File the check note. Gate 3 re-runs it independently; finding your own
   mismatches is far cheaper.
7. **Run `design-critique`** across all seven lenses before requesting the gate. Fix S1 and S2;
   route Type B findings through the reconciler before editing anything.
8. **Route feedback correctly.** Visual corrections are Type A and are absorbed. Anything touching
   a rule, status, permission or requirement is Type B and goes through the reconciler BEFORE the
   spec changes.

## Deciding factors

- **A state that seems unreachable** is proved with the flow ("no path sets this status here") or
  it is specified. Unproven unreachability is a missing screen, and it is the most common source of
  a Phase 3 surprise.
- **Ambiguity found mid-spec is upstream debt.** Route it to the reconciler or data-modeler; do not
  resolve it locally with a plausible choice. A plausible local resolution is an unlogged
  assumption that a developer will later treat as a requirement.
- **Depth scales with reach.** A screen three roles use daily gets every state fully specified; a
  rarely-reached admin screen may specify the generic set and the reachable statuses only, marked
  as such. Say which you did.
- **Where the spec and the style guide disagree**, the style guide wins or the style guide changes.
  A one-off exception in a spec is how a system starts to fork; if the exception is right, it is a
  rule.

## Probing prompts (self-review, per feature)

- "Which state here have I named but never actually drawn?"
- "For each irreversible transition: where does the user learn it is irreversible BEFORE
  triggering it?"
- "What does the permission-denied user see, and is discovering the denial cheap and early?"
- "Which dev note would a developer skip reading? Move it into the drawing."
- "Which ERD status is missing from this feature's enumeration, and can I prove it is
  unreachable?"
- "Complete this feature's main task with the keyboard. Write the sequence."
- "Which piece of copy here is still a placeholder?"
- "What does this screen look like at the client's real volume, with their longest values?"
- "What does this let someone do that the lifecycle forbids?"

## Guardrails

- `ARCHIVED/` stays closed. Hi-fi starts from `refined-requirements.md`, the ERD and the flows,
  never from the prototype's screens (GUARDRAILS 4). Opening the archive requires saying why, out
  loud, first.
- No spec ships against an (asserted) behaviour-constraining rule; that blocks and escalates
  (GUARDRAILS 2).
- Status values come from the ERD's closed lists. A status appearing here that the ERD lacks is a
  Type B correction, not a design decision.
- The accessibility floor is met or the exception is recorded with an owner and disclosed
  (GUARDRAILS 11).
- DRAFT header until all nine blocks are present.
- Dummy content is plausible and never real client data (GUARDRAILS 7).

## Output

- `70-hifi/{feature}/spec.md` per feature, nine blocks
- `70-hifi/{feature}/content.md` per feature
- `70-hifi/status-mapping.md` consolidated across features
- The self-reconciliation check note
- `70-hifi/critiques/{feature}-{date}.md` from `design-critique`

## Exit criteria (Gate 3)

- All nine blocks per in-list feature, no DRAFT headers
- State enumeration table complete, every cell specified or proved unreachable
- Self-reconciliation clean
- Design critique run, zero open S1 findings
- Keyboard path written per feature; announcements specified
- Line-by-line requirement check ready

## Failure modes

- **Status leakage surfacing here.** Each newly discovered value is a missing screen and a Type B,
  and three of them on one topic means Phase 1 converged too early (CLAUDE.md section 6).
- **Prototype gravity.** Hi-fi quietly refines the archived screens and inherits their uncorrected
  assumptions along with their look.
- **Picture-only specs.** Blocks 1 and 2 present, blocks 3 to 8 thin, and thirty build-time
  questions that the spec was supposed to answer.
- **Placeholder copy.** Every state drawn, none of them written, and the developer inventing the
  error messages.
- **Local resolution of upstream ambiguity.** A plausible guess specified confidently, discovered
  wrong at client validation, with no reconciler entry naming who decided.
