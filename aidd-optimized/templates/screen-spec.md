# Screen Spec: {feature} / {screen}

> **What this is.** One screen, in enough detail that a developer can build it without asking us anything. Every state it can be in, every word on it, and how it behaves.
>
> **Where it stands.** Draft until all nine sections are filled.
>
> **What we need from you.** Nothing - this is for the build team. What needs you is in the review session.

One per screen inside `70-hifi/{feature}/spec.md`. The nine feature-level blocks wrap these.

## Identity

| Field | Value |
|---|---|
| Screen | name, in glossary terms |
| Route | from `40-models/ia.md`'s route scheme |
| Entities shown | with the ERD statuses reachable here |
| Roles reaching it | and what each sees differently |
| Entry points | including deep-link entry |
| Exits | success, abandon, denied, and where each lands |
| REQ-IDs | everything this screen implements |
| ASM-IDs | any assumption register entries this rests on |

## Hierarchy

| Level | Element | Why |
|---|---|---|
| Primary | | the one thing this screen is for |
| Secondary | | what supports the primary decision |
| Tertiary | | present for completeness |

Squint-test expectation: a reviewer should see {x} first.

## Composition

| Slot | Content | Component | Notes |
|---|---|---|---|
| Page header | | | title names the object, not the template |
| Context bar | | | filters, search, view controls |
| Content | | | |
| Footer / actions | | | |

Density mode: {product default, or the exception with its reason}.

## States

| State | What the user sees | What they can do | Announcement | Copy |
|---|---|---|---|---|
| Empty (first use) | | | | |
| Empty (no results) | | | | |
| Loading (initial) | | | | |
| Loading (refresh) | | | | |
| Error (load) | | | | |
| Error (submit) | | | | |
| One item | | | | |
| Maximum plausible volume | | | | |
| Permission denied | | | | |
| Status: {value} | | | | |

One row per ERD status value reachable here. A value with no row is a missing screen state unless
proved unreachable, with the proof stated.

## Behaviour

| Aspect | Specification |
|---|---|
| Feedback timing per action | |
| Mutations: optimistic / pending / confirmed | and the failure behaviour of each |
| Validation timing | on blur, on change after error, on submit |
| Save model | explicit / autosave / draft-then-commit |
| Dirty state and navigation guard | |
| Keyboard sequence for the primary task | written out, key by key |
| Focus movement | on open, on close, on route change, on delete, on submit-with-errors |
| Selection behaviour | persistence across sort, filter and page |
| Concurrency | what the second saver sees |
| Motion | tokens by name, plus the reduced-motion equivalent |

## Responsive

| Breakpoint | Layout | Notes |
|---|---|---|
| Below 768 | | table strategy and its reason |
| 768 to 1023 | | |
| 1024 and up | | |

Order of collapse followed: {per `skills-md/responsive.md`}.

## Accessibility

| Item | Value |
|---|---|
| Contrast pairings verified | |
| Heading outline | |
| Landmarks | |
| Accessible names for icon-only controls | |
| Live regions and politeness | |
| Smallest target on the screen | |
| Exceptions | with rationale and owner |

## Dev notes

Validation rules with REQ-IDs, calculation logic, what recalculates when, what is
server-authoritative, what may be stale and for how long, what the API must supply that the
current model does not.

## Content

Every string on this screen, listed. Rule-bearing strings cite their REQ-ID.
