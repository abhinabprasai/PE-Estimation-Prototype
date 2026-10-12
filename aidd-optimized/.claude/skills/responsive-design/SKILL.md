---
name: responsive-design
description: "Breakpoints derived from where content breaks, dense-data strategies per table, and adaptation to the real device and environment each role works in. Use whenever any role reaches a surface on something other than a desktop."
---

# Responsive and Adaptive Design

## Purpose
Responsive is not "it shrinks". It is the specification of what the design becomes when the
viewport, the input method, or the physical environment changes, and which of those changes are
real for this client's roles. Most of the cost here comes from discovering the answer late: a
design proven on one laptop, then met with "the warehouse team uses tablets" in Gate 3.

The question this skill answers first is not "what are the breakpoints". It is "who uses this,
on what, where, and with what on their hands".

Depth: `references/narrow-touch-zoom.md` carries dense-data strategies on narrow screens, touch and pointer rules, zoom and reflow compliance, density preference, and print. Load it when the step needs it, not before.

## Inputs
- Spec audit dimension 11 (platform and environment) and dimension 10 (volume)
- The actor pass from discovery: role by role, what device and what context
- `40-models/ia.md`: what the navigation must become when the chrome cannot persist
- `visual-design` density decision and `references/layout-and-space.md` grids
- `00-inputs/assumptions.md` where device context is unknown (it usually is, and it is usually
  assumed to be desktop)

## Establish the real context first

One table, filled from evidence, before any breakpoint is chosen:

| Role | Primary device | Secondary | Environment | Input | Session length |
|---|---|---|---|---|---|

Environment is not a formality. Each of these changes the design and none of them appears in a
spec unless asked for:

- **Gloves or wet hands** (warehouse, field, clinical): touch targets go to 44px minimum and
  often larger; small controls and precise gestures are unusable.
- **Bright sunlight or glare**: contrast requirements rise well above the AA floor; light-on-dark
  becomes unreadable outdoors.
- **Shared terminals**: fast user switching, no personal preferences, no saved sessions, and
  privacy on screen matters.
- **Old hardware and small screens**: 1366 x 768 is still extremely common on corporate desktops.
  A layout designed at 1920 and never checked at 1366 loses its right-hand column.
- **Locked-down browsers**: an old browser floor changes what is available; ask, do not assume.
- **Noise or interruption**: long uninterrupted forms fail where the user is interrupted every
  few minutes; the save model must tolerate walking away (`interaction-design` autosave).
- **One-handed use** (holding a clipboard, a phone, a scanner): primary actions must sit in the
  thumb's reach.

Where the answer is unknown, it becomes an assumption register entry with a blast radius, not a
silent default to desktop.

## Breakpoints

Breakpoints come from where the content breaks, not from device names. Device widths change every
year; a three-column layout's failure point does not.

Method: build the layout at its widest, then narrow it continuously until something fails
(a column becomes unreadably narrow, a table clips, a label wraps badly, the nav crowds the
content). That width is a breakpoint. Repeat.

A conventional starting set, to be adjusted by the above:

| Range | Layout |
|---|---|
| Under 480 | One column. Nav in a drawer or bottom bar. Tables become cards or scroll |
| 480 to 767 | One column, more comfortable spacing |
| 768 to 1023 | Two columns possible. Nav can be a rail |
| 1024 to 1279 | Full application layout; persistent nav; side panels appear |
| 1280 to 1439 | Comfortable application layout. Verify at 1366, a very common real width |
| 1440 and up | Max-width container, or full width for data work with a ceiling |

Fewer breakpoints, each doing real work, beats many that each nudge a padding. Three or four is
usually right.

## Order of collapse

When space runs out, things yield in this order. Decide it once and apply it everywhere, or each
screen collapses differently and the product feels unrelated to itself.

1. **Decorative space.** Gutters and section gaps step down the spacing scale.
2. **Chrome.** Side navigation becomes a rail, then a drawer. Chrome yields before content.
3. **Secondary panels.** Metadata and activity panels move below the primary content, or behind a
   control.
4. **Column count.** Three to two to one, with the demotion order stated per layout.
5. **Optional content.** Tertiary information collapses behind disclosure.
6. **Primary content.** Only ever adapts its presentation, never disappears. If content is
   dropped at a narrow width, the design has decided that mobile users get less product, and that
   is a decision for the client, not for the designer.

## Procedure

1. Fill the role-by-context table from evidence. Unknowns become assumption entries.
2. Decide which surfaces are multi-device and which are legitimately desktop-only. State the
   desktop-only decision explicitly; do not leave it implied.
3. Find the breakpoints by narrowing the widest layout until it breaks.
4. Write the order of collapse once, product-wide.
5. Choose the dense-data strategy per table, from the task, and record the reason.
6. Set target sizes from the environment, not from the default.
7. Remove every hover-only path; specify the persistent alternative.
8. Verify zoom and reflow at 200 and 400 percent on the most complex screen, not the simplest.
9. Verify at 1366 x 768 as well as at the design width.
10. Record all of it in `30-design-language/skills-md/responsive.md` and per-feature in the hi-fi
    spec's screen states.

## Deciding factors

- **Mobile-first or desktop-first** is decided by where the work actually happens. Mobile-first
  discipline is valuable for content products; for a rule-dense data tool used at a desk eight
  hours a day, designing the dense case first and adapting up is honest and produces a better
  primary experience.
- **Adapt or separate.** A separate mobile experience is justified only when the mobile task is
  genuinely a different, narrower task (a field worker capturing one record versus an office
  worker reconciling hundreds). Same task, smaller screen, is a responsive problem.
- **Do not design for devices nobody uses.** A tablet layout nobody asked for is unpaid work that
  still needs maintaining. Get the context table filled first.

## Probing prompts

For the DA and users:
- "Where are you sitting when you do this? What is on your screen at the same time?"
- "Does anyone do this away from a desk?"
- "What size are the monitors in that team?" (the answer is often surprising and always useful)
- "Does this ever get printed or emailed as a PDF? To whom?"
- "Is the screen ever shared, or visible to someone who should not see it?"

Self-review:
- "Which action here is reachable only by hovering?"
- "At 1366 wide, what falls off?"
- "At 400 percent zoom, does the page scroll sideways?"
- "In this table's narrow strategy, which column did I drop, and would the user have relied on it?"
- "Which fixed height on this screen would clip if the user increased line spacing?"

## Guardrails

- Target sizes never fall below 24 x 24 CSS px regardless of density
  (GUARDRAILS 11, `accessibility`).
- Reflow at 400 percent zoom without two-dimensional scrolling, tables excepted within their own
  container.
- No content is dropped at narrow widths without a stated, client-visible decision.
- Hover-only paths are prohibited on any surface reachable by touch or keyboard, which is all of
  them.
- Device context is evidence or it is an assumption register entry; "everyone uses a laptop" is
  an assumption with a large blast radius.

## Output

- `30-design-language/skills-md/responsive.md`: breakpoints with the content reason for each,
  order of collapse, target sizes, density rules
- Role-by-context table, filed with the IA
- Per-feature adaptation notes in `70-hifi/{feature}/spec.md` screen states
- Print requirements routed to the reconciler where they are really export features

## Exit criteria

- Role-by-context table complete or its gaps registered as assumptions
- Breakpoints derived from content failure points, each with a recorded reason
- Dense-data strategy chosen and justified per table
- Zoom and reflow verified at 200 and 400 percent on the most complex screen
- Zero hover-only paths

## Failure modes

- **Desktop-only by neglect.** Nobody asked about devices; the tablet team is discovered at Gate 3.
- **Stacked comparison tables.** A table converted to cards on narrow screens, destroying the
  comparison the table existed for.
- **Silent column loss.** Columns dropped responsively with no indication, and users quietly
  migrating to spreadsheets.
- **Fixed heights.** Zoom, text spacing and translated labels all clip, and every fix is a
  separate one.
- **Designed at 1920.** Shipped to a client estate of 1366 x 768 laptops where the last column is
  never seen.
