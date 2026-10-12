---
name: component-architecture
description: "Picks the control from the shape of the decision, writes the full state matrix per component including every entity status, and sets composition, naming and the accessibility contract. Use when a screen needs a control the system does not define."
---

# Component Architecture

## Purpose
Two failures live here and both are expensive. The first is picking the wrong control, which
makes a correct flow feel wrong and produces data entry errors nobody traces back to the picker.
The second is an incomplete state matrix, which is the single largest source of build-time
clarification requests in this process: a component specified in its default state and nothing
else gets seven states invented by a developer, differently each time.

A component system is not a collection of drawings. It is a set of contracts: what each control
is for, every state it can be in, how it composes, and what it is called.

Depth: `references/component-states.md` (the full matrix per component family),
`references/control-selection.md` (which control for which decision, with the reasoning).

## Inputs
- `shared-specs/design-system.md` when current: inherit the component set, record deltas only
- `40-models/erd.md`: statuses, permissions, and lifecycle, which drive state coverage
- `40-models/flow-optimization/`: defaults, disclosure and prevention decisions per step
- `20-research/incumbents/`: the controls users already expect for this kind of work
- `visual-design` foundations: tokens, density mode, status encoding

## Control selection

The control is chosen from the shape of the decision and the size of the option set, not from
what looks tidy. Full reasoning in `references/control-selection.md`; the operative table:

| The user is | Options | Control |
|---|---|---|
| Choosing one, needs to compare | 2 to 5 | Radio group (vertical, so labels can be read) |
| Choosing one, options are short and parallel | 2 to 4 | Segmented control |
| Choosing one from a known list | 6 to 15 | Select |
| Choosing one from a large or server-backed list | 15+ | Searchable combobox |
| Choosing several | any | Checkbox group under 8, multi-select combobox above |
| Setting a binary that applies immediately | 2 | Toggle. A toggle that needs a save button is a checkbox wearing a costume |
| Setting a binary as part of a form | 2 | Checkbox |
| Entering a value with meaningful precision | n/a | Text or number input. Sliders lose precision and are wrong for anything a user would state exactly |
| Entering a value where approximate is fine and the range matters | n/a | Slider, with a numeric input beside it |
| Picking a date from a document in their hand | n/a | Text input with a calendar assist. Calendar-only is a barrier |
| Picking a date by relationship to now | n/a | Calendar with presets |

Container choices follow the same logic:

| The content is | Container |
|---|---|
| Rows compared on shared attributes | Table. The default for anything with more than two attributes per item |
| Items scanned for one target | List |
| Items with a dominant visual or heterogeneous attributes | Cards. Cards for uniform tabular data is the most common wrong choice; it triples the vertical space and destroys comparison |
| A decision that must happen now | Modal |
| Supporting detail alongside the work | Drawer or side panel |
| A job of any real length | A page with a URL |

## The state matrix

Every component is specified in every state it can reach. A component drawn only in default is
not specified.

**Universal states** (every interactive component):
default, hover, focus-visible, active/pressed, disabled, read-only, error, loading/busy.

Note that disabled and read-only are different and are routinely conflated: disabled means you
cannot act, read-only means the value is real and final but not editable here. They look
different and they announce differently to assistive technology.

**Container states** (anything that displays a set):
empty (first use), empty (no results after filtering), loading (initial), loading (refreshing
existing content), partial (some loaded, more available), error (failed to load), error (loaded
but stale), one item, many items, maximum plausible items, permission-denied.

The two empties are different states with different copy and different actions, and collapsing
them is the most common container defect (`content-design` covers the copy).

**Domain states**: one per ERD status value the component can display. These come from the ERD's
closed lists, never from memory. A status value with no specified treatment is a missing screen
state, and it surfaces in Phase 3 as a Type B correction.

The matrix is written as a table per component before any drawing, exactly as `hifi-spec` builds
its feature x entity x status enumeration. Cells that are unreachable are marked unreachable
with the reason, not left blank.

## Composition rules

- **Container and content separate.** A card knows how to be a card; it does not know what is
  inside it. A component that hard-codes its content cannot be reused and will be copied instead,
  which is how a system forks.
- **Slots, not props, for content.** Named regions (header, body, actions, aside) rather than a
  growing list of content properties. When a component's property list is mostly strings, it
  wants slots.
- **Layout belongs to the parent.** A component does not set its own outer margin. Spacing between
  siblings is the parent's decision, or every layout becomes a fight with defaults.
- **The rule of three.** Do not create a component for the first use. On the second, note the
  duplication. On the third, extract it, and extract it from the three real cases rather than
  from an imagined general case. Premature abstraction produces components with nine properties
  that fit nothing well.
- **Variants versus new components.** Same purpose, different emphasis or size is a variant.
  Different purpose is a new component. If a variant changes what the thing is *for*, it is not a
  variant, and the giveaway is a variant name that is a noun rather than an adjective.
- **Depth limit.** A component composed of components composed of components is usually one
  abstraction too many. Three levels is a warning; four is a rewrite.

## Naming and API

The generator obeys what is written here, so it must be concrete enough to obey.

- Component names are nouns in the client's or the system's vocabulary, singular:
  `DataTable`, `StatusBadge`, `RecordHeader`. Not `Wrapper`, `Container2`, `Box`.
- Variant properties take a closed set of literal values, never booleans that combine into
  impossible states. `variant: "primary" | "secondary" | "danger"` beats three booleans that can
  all be true at once.
- State properties reflect real state: `loading`, `disabled`, `readOnly`, `invalid`. Do not
  express state through class names the consumer must know.
- Event handlers say what happened, not what to do: `onSelectionChange`, not `updateTable`.
- Every component that renders text exposes the way to override it, because the copy is
  `content-design`'s and will change after the component is built.
- Token references only: no hard-coded colour, spacing or type values inside a component
  (`visual-design` systematic floor).

Where `shared-specs/EngineeringSpec.md` states framework conventions, they win over anything here;
this section fills the gaps it leaves.

## Accessibility contract per component

Specified with the component, not retrofitted (`accessibility` owns the standard; this is the
per-component obligation):

| Requirement | Applies to |
|---|---|
| Correct native element or full ARIA pattern | Everything. A `div` with a click handler is not a button, and making it one costs more than using a button |
| Accessible name | Every control, including icon-only ones |
| Keyboard operation | Every control; composite widgets follow their standard key pattern (arrows within, Tab between) |
| Focus visible | Every focusable element, 3:1 against adjacent colours |
| State announced | Expanded, selected, checked, busy, invalid, and the associated error message |
| Live region | Anything that changes without the user's action: async results, validation summaries, toasts |
| Target size | 24 x 24 CSS px minimum, 44 x 44 on touch-primary surfaces |

Icon-only controls are the most frequent failure: they need an accessible name, and a tooltip is
not an accessible name unless it is wired as one.

## Anti-patterns

| Pattern | Why it fails |
|---|---|
| Nested modals | The user cannot form a mental model of where they are, and Escape becomes ambiguous |
| Disabled with no reason | A dead end. Either explain it or do not show it |
| Toast for an error needing action | It vanishes, it cannot be re-read, and the action is lost |
| Cards for uniform tabular data | Triples the space, destroys column comparison, and makes sorting meaningless |
| Toggle inside a form with a save button | Toggles imply immediate effect; users will not save, and their change is lost |
| Placeholder as label | The label vanishes on focus, which is exactly when it is needed; it also usually fails contrast |
| Hover-only actions | Invisible to touch, keyboard, and anyone not already looking |
| Infinite scroll over work queues | The user cannot tell how much is left, cannot return to a position, and cannot reach the footer |
| Icon-only without a name | Ambiguous to sighted users, invisible to screen readers |
| A generic `Box` or `Wrapper` in the library | Not a component. It is a styling escape hatch that will absorb every inconsistency in the product |

## Procedure

1. Inherit from `shared-specs/design-system.md` where current; list this project's deltas with a
   one-line reason each.
2. Inventory the controls the prioritized features actually need. Do not build a library
   speculatively; every unused component is maintenance with no payer.
3. Per component: pick it from the selection tables with the reason recorded, then write the full
   state matrix including every relevant ERD status value.
4. Write the accessibility contract row set for it.
5. Write the API: name, variants, state properties, slots, events.
6. Specify composition: what it contains, what contains it, and what it must never contain.
7. Cross-check against `interaction-design` for behaviour and against `content-design` for the
   copy each state carries.
8. File it in `30-design-language/skills-md/components.md` (plus `forms.md` and `tables.md` for
   the two families that always need their own file), keeping each under about 150 lines so a
   generator will actually obey it.

## Deciding factors

- **Convention beats invention** for anything the user did not come here to learn. Novel controls
  spend attention the domain work needs.
- **Native beats custom** unless the native control genuinely cannot do the job. Custom selects
  are a permanent accessibility and mobile liability, taken on knowingly or not at all.
- **Specificity precedence:** where two rule files disagree, the more specific wins (`forms.md`
  over `components.md`). State the precedence in each file's header.
- **Density is a system property, not a component one.** A component reads the density mode; it
  does not carry its own spacing opinions.

## Probing prompts

Self-review:
- "Which state of this component have I named but never drawn?"
- "What does this look like with the longest plausible content, and with none?"
- "Which of these is disabled somewhere in the product with no reason shown?"
- "Is this a variant, or is it a different thing wearing the same name?"
- "If a developer read only `components.md`, what would they get wrong?" (move that into the file)
- "How many ERD status values can this display, and have I specified all of them?"
- "Can this be operated entirely from the keyboard? Say the key sequence."

## Guardrails

- Domain states come from the ERD's closed lists. A component displaying a status the ERD does not
  contain is either a spec error or a Type B correction; it is never a design choice.
- No hard-coded values inside components; tokens only (`visual-design`).
- The accessibility contract is not optional per component and is not deferred to a later pass
  (GUARDRAILS 11).
- Inherited components diverge from `shared-specs` only with a recorded reason, or the next
  project inherits a fork nobody knows about (`md-spec-loop`).

## Output

- `30-design-language/skills-md/components.md`, `forms.md`, `tables.md`
- A state matrix per component, filed with it
- Deltas from `shared-specs/design-system.md`, with reasons, for the close-review

## Exit criteria

- Every component the prioritized features need is selected with a recorded reason
- Every component has a complete state matrix, including all reachable ERD status values
- Accessibility contract stated per component
- API and naming written concretely enough for a generator to obey

## Failure modes

- **Default-state-only specs.** Seven states per component invented at build, inconsistently.
- **Speculative library.** Forty components, eleven used, all maintained.
- **Wrong container.** Cards for tabular data, or a table for heterogeneous items, decided by
  appearance rather than by task.
- **Boolean explosion.** Five boolean properties producing thirty-two states, of which nine are
  impossible and none are documented.
- **Silent fork.** The project rebuilds a `shared-specs` component with different behaviour, and
  the next project inherits the confusion.
