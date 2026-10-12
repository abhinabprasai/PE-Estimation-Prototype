---
name: visual-design
description: "Hierarchy, layout and spacing, type scale, semantic colour and status encoding, density chosen from the domain. Produces rules a reviewer can cite a violation of. Use when authoring the style guide and for every hi-fi screen."
---

# Visual Design

## Purpose
Everything above this skill decides what a screen must contain. This skill decides what a person
sees first, second, and third when they look at it, and it decides it with rules a reviewer can
point at rather than with taste a reviewer can only agree or disagree with.

Two disciplines run underneath every rule here. **Systematic**: every measurement comes from a
scale, every colour from a role, every type size from a step. Arbitrary values are the mechanism
by which a design becomes unmaintainable. **Purposeful**: every visual difference means
something. If two things look different, a user will assume they are different, and if they are
not, the design has lied.

Depth lives in the reference files; load the one you need:
- `references/type-scale.md`: scales, line height, measure, weight, numerals, truncation
- `references/color-system.md`: role architecture, ramps, contrast maths, status encoding, dark mode
- `references/layout-and-space.md`: grids, spacing scale, containers, alignment, density tables

## Inputs
- `shared-specs/design-system.md` when current (inherit; record deltas only)
- Client brand assets in `00-inputs/` (referenced, never re-uploaded externally)
- `20-research/incumbents/`: the density and conventions users arrive with
- `40-models/erd.md`: status value lists (every status needs a visual encoding)
- Spec audit dimensions 10 and 11: volume, platform, environment
- `00-inputs/assumptions.md` where brand or environment is unknown

## The hierarchy method

A screen has exactly one primary message. Establish it before any styling.

1. **Name the three levels.** Primary: the one thing this screen is for. Secondary: what supports
   the primary decision. Tertiary: everything present for completeness. Write them down for the
   screen before drawing. A screen with two primaries is two screens, or one screen with an
   unresolved argument in it.
2. **Spend the four tools in this order:** position, then size, then weight, then colour. Position
   is free and unambiguous; colour is expensive, limited, and already carrying status meaning in
   most of these products. A hierarchy that needs colour to work will collapse the moment a status
   badge appears next to it.
3. **Space separates, lines divide, boxes contain.** Reach for them in that order. A screen full
   of bordered cards has usually solved with boxes what space would have solved better, and it
   costs a border-weight of visual noise per element.
4. **One primary action per view.** Everything else is secondary or tertiary in treatment. Two
   filled buttons side by side is a decision the design failed to make on the user's behalf.
5. **The squint test.** Blur the screen until text is unreadable. The primary should still be
   obvious; the reading order should still be right. If everything blurs to uniform grey, the
   hierarchy is decorative rather than structural.
6. **The five-second test.** Show it for five seconds, take it away, ask what it was for and what
   they would do next. Two right answers out of three participants is a pass; below that, the
   primary is not primary.

## The systematic floor

| Element | Rule |
|---|---|
| Spacing | One base unit (4px, giving a usable 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 scale). No value off the scale, ever, including the ones that "look better"; if one genuinely looks better, the scale is wrong and gets fixed once |
| Type | One modular scale, six to eight steps. No sizes between steps |
| Colour | Semantic roles only. Components reference `surface`, `border-strong`, `text-muted`, never a hex or a palette index |
| Radius | Three values at most (small for controls, medium for containers, full for pills). Mixed radii on nested elements is the most visible amateur signal in a UI |
| Border | Two weights (hairline and emphasis). A third weight always turns out to be a shadow's job |
| Elevation | A ramp where each level means a z-order relationship, not a decorative depth |
| Icon | One family, one grid size, one stroke weight. Mixed icon families are visible from across a room |

Every one of these is violation-checkable, which is the test `style-guide-authoring` applies:
could a reviewer point at a build and cite the rule? If not, it is an aspiration, not a rule.

## Density

Density is a domain decision, not an aesthetic one, and importing consumer airiness into an
expert tool is the most common visual failure in this process.

| Mode | Table row | Control height | Base type | Choose when |
|---|---|---|---|---|
| Comfortable | 48px | 40px | 16px | Occasional users, mobile-primary, low rows per screen, public-facing |
| Compact | 40px | 32px | 14px | Daily users, moderate volume. The right default for most internal tools |
| Dense | 32px | 28px | 13px | Expert users, high volume, comparison and scanning as the primary task, wide screens |

Choosing:
- Sessions measured in hours and rows measured in hundreds: dense. The user's cost is scrolling
  and eye travel, not comprehension.
- Rule-dense work where a mistake is expensive: compact, not dense. The extra space buys
  legibility at the moment of a consequential decision.
- The same product serving both: pick per surface, not per product, and expose a density control
  if the split runs through one screen. Density is a legitimate user preference; brand is not.

Density never reduces touch targets below the accessibility floor (24px minimum, 44px for
touch-primary surfaces). Where dense mode would violate it, the pointer size sets the floor and
the visual can be tighter than the hit area (see `accessibility`).

## Status encoding

Every ERD status value needs a visual treatment, decided once and applied everywhere. This is
where visual design meets the entity model, and inconsistency here is read by users as
inconsistency in the domain.

| Rule | Detail |
|---|---|
| Never colour alone | Colour plus a shape, an icon, or a word. Roughly one in twelve men has a colour vision deficiency, and every screenshot pasted into a monochrome report loses colour entirely |
| One treatment per status, product-wide | If `pending` is amber-with-clock in one place, it is amber-with-clock everywhere. A status that looks different in two views reads as two statuses |
| Semantic mapping is stated, not assumed | Which statuses are positive, neutral, warning, negative, and terminal is a domain question. In some domains `closed` is success and in others it is failure. Ask; do not assume from the word |
| Terminal and irreversible statuses look different from transient ones | The user should be able to see, without reading, that a record has passed a point of no return |
| Neutral is the default, not grey-as-disabled | Most statuses are neutral facts. Reserve the alarming treatments for the few that need action |
| Count the values first | If the ERD gives fifteen statuses, fifteen distinct colours is unreadable. Group into four or five semantic families and differentiate within a family by label, not by hue |

## Data display

For products where the screen is mostly numbers and records (which is most of what this process
is used for):

- Numerals in tabular (monospaced-figure) form in any column of numbers, so digits align and
  magnitude is visible without reading.
- Numbers right-aligned, text left-aligned, and the column header aligned with its content.
- Decimals aligned on the point. Fixed decimal places per column, from the domain, not from the
  data.
- Negative values encoded per domain convention (parentheses in accounting contexts, minus sign
  elsewhere) plus a treatment that survives greyscale.
- Units in the column header where they are constant, beside the value where they vary. Never
  both.
- Zero and empty are visually different. Zero is a fact; empty is an absence; showing "0" for
  "we do not know" is a data lie that users act on.
- Long identifiers truncate from the middle when the ends carry meaning (dates, sequence
  numbers), from the end when only the start does.
- Dates in an unambiguous format for the client's locale, and the same format everywhere. A mix
  of relative ("2 days ago") and absolute is fine only when relative is the secondary line.

## Elevation and layering

Elevation is a z-order language, not decoration. Assign each level a meaning and never use a
level for a different meaning.

| Level | Meaning | Typical use |
|---|---|---|
| 0 | The page surface | Background |
| 1 | Content resting on the page | Cards, panels, table containers |
| 2 | Content that overlaps on interaction | Dropdowns, popovers, tooltips |
| 3 | Content that blocks the page | Modals, dialogs |
| 4 | Content above everything, including blockers | Toasts, critical alerts |

On light surfaces, elevation reads as shadow. On dark surfaces, shadow is nearly invisible and
elevation reads as a lighter surface tint; carrying a light-mode shadow ramp into dark mode is
why dark modes go flat. Specify both.

## Motion, briefly

Motion is `interaction-design`'s domain. Visual design owns only this: the design must work
completely with all motion removed. Anything communicated only by an animation is not
communicated to a user with reduced-motion set, and is not communicated in a screenshot.

## Procedure

1. Inherit or author the system: check `shared-specs/design-system.md` freshness, inherit its
   tokens, record deltas with a one-line reason each.
2. Set the foundations before any screen: spacing base and scale, type scale and measure, colour
   roles and ramps, radius set, border weights, elevation ramp, icon family, density mode. These
   go into `30-design-language/skills-md/` as short machine-readable files (see
   `style-guide-authoring`).
3. Map every ERD status to a treatment. Take the value lists from the ERD, not from memory; a
   status without a treatment is a missing screen state in Phase 3.
4. Per screen: name the three hierarchy levels first, in writing, before drawing anything.
5. Compose: place the primary, arrange the secondary around the decision it supports, demote the
   tertiary. Use position and space before size and colour.
6. Verify contrast with real values against the real backgrounds (`references/color-system.md`
   carries the maths, `accessibility` carries the thresholds). Do this while designing, not after;
   a contrast failure found at review is a repaint of everything downstream of the token.
7. Run the checks: squint test, five-second test, greyscale pass, and a scan for off-scale values.
8. Record every decision that a future reviewer might read as arbitrary, with its reason.

## Deciding factors

- **Inherit unless the domain demands otherwise.** Divergence from `shared-specs` is allowed and
  gets one line of why. Silent divergence is how the next project inherits a fork nobody recorded.
- **Convention beats invention on anything the user did not come here to learn.** Novel controls
  cost attention that the domain work needs. Spend novelty where the product is genuinely
  different, which is almost never the date picker.
- **Brand pressure versus legibility.** Where a brand colour fails contrast at body size, it
  becomes an accent, a background behind larger text, or a darkened variant. It does not become
  body text. This is a non-negotiable (see `accessibility`), and it is worth having the
  conversation early with the asset in hand.
- **When the screen feels busy,** the fault is usually hierarchy, not quantity. Removing content
  the domain needs is the wrong fix; demoting the tertiary and increasing the space between
  groups is usually the right one.

## Probing prompts

Self-review, per screen:
- "What did I intend the user to see first? Squint. Is that what happens?"
- "Which two elements look different but mean the same thing? Which look the same but differ?"
- "Which value on this screen is off the spacing or type scale, and why did I let it be?"
- "Print this in greyscale. What information disappeared?"
- "Which status here has a treatment I invented rather than took from the map?"
- "If this table had eight hundred rows and the longest plausible name in every cell, what
  breaks?" (`dummy-content` should have already made this visible)
- "What does this screen look like on the client's actual monitor?" Expert tools are often used
  on old, small, badly-calibrated displays in bright rooms; a design proven only on a laptop
  Retina panel in a dark studio has not been proven.

## Guardrails

- Contrast thresholds are a floor, not a target, and they are not negotiable against brand
  preference (`accessibility`, GUARDRAILS 11).
- Status treatments come from the ERD's closed value lists. Inventing a status to fill a visual
  gap is a Type B correction routed through the reconciler, not a design choice.
- Client brand assets stay in `00-inputs/` and are never uploaded to external tools
  (GUARDRAILS 8).
- No adjective survives into a rule. "Generous spacing" states the value or it does not ship
  (`style-guide-authoring`).
- Never encode meaning in colour alone, in position alone, or in motion alone.

## Output

- `30-design-language/skills-md/tokens.md`, `layout.md`, `type.md`, `color.md`, `states.md`
- `30-design-language/style-guide.md` sections: hierarchy method, density decision with reason,
  status encoding map, data display rules
- Per-screen hierarchy notes inside `70-hifi/{feature}/spec.md`

## Exit criteria

- Every foundation set and expressed as a rule a reviewer could cite a violation of
- Every ERD status value has exactly one treatment, colour-independent
- Contrast verified against real backgrounds for every text and control role
- Density mode chosen with a recorded domain reason
- Squint, five-second and greyscale checks run per prioritized screen

## Failure modes

- **Adjective styling.** "Clean and modern" in the guide, three different button paddings in the
  build, no basis on which to call either wrong.
- **Consumer airiness in an expert tool.** Eleven rows visible where the user needs sixty, and a
  team that cannot understand why the client keeps exporting to Excel.
- **Colour-only status.** Works in the review, fails for a colour-blind user, fails in every
  printed report, and fails in the screenshot pasted into the escalation email.
- **Decorative depth.** Shadows and borders on everything, so nothing is above anything, and the
  modal reads as part of the page.
- **Off-scale drift.** Fourteen spacing values in the build, none of them wrong enough to fix,
  all of them making the next screen harder to align.
