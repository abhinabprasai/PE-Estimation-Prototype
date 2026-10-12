---
name: accessibility
description: "The WCAG 2.2 AA floor as a design constraint rather than an audit: token-level checks at Gate 2, screen-level and the testing ladder at Gate 3. Use while designing, never afterwards."
---

# Accessibility

## Purpose
Accessibility retrofitted is several times the cost of accessibility designed in, and it is
usually retrofitted badly, because the decisions that make it hard (colour choices, custom
controls, hover-only paths, fixed heights) were made months earlier. This skill puts the
constraints at the point where those decisions are taken.

The floor is **WCAG 2.2 level AA**. In this process it is treated the way a legal domain rule is
treated: not a preference to be traded against brand or timeline, and not a phase. Many of the
clients this process serves are also subject to procurement or regulatory accessibility
requirements (public sector, healthcare, finance, education, and anyone selling into them), which
makes it a contractual matter as well as an ethical one. Ask early which apply; the answer can
raise the floor to AAA on specific criteria.

Depth: `references/wcag-checklist.md` (criterion by criterion, with what it means for a design
artifact rather than for code).

## Inputs
- `visual-design` colour roles and status encoding (contrast is verified there, enforced here)
- `component-architecture` per-component accessibility contract
- `interaction-design` keyboard contract and focus management
- `content-design` error and label copy
- `responsive-design` target sizes, zoom and reflow
- Client obligations: sector, procurement standard, any existing VPAT or accessibility statement

## The seven design-time constraints

Everything else follows from these. If a design satisfies these seven, the remaining criteria are
mostly implementation.

### 1. Contrast
- Body text 4.5:1; large text (24px regular, 18.66px bold and above) 3:1.
- UI component boundaries needed to identify a control: 3:1.
- Focus indicator: 3:1 against adjacent colours.
- Meaningful icons and graphics: 3:1.
- Verified against real values on real backgrounds, including hover and active variants, and
  including dark mode separately (`visual-design/references/color-system.md` carries the maths).
- Brand colours that fail become accents or backgrounds behind large text; they do not become body
  text. This is the sentence to have ready before the brand conversation, not after.

### 2. Never encode meaning in one channel
Colour alone, position alone, shape alone, or motion alone all fail for someone. Every status,
every error, every required field, every selected row carries at least two of: colour, an icon or
shape, and text. The greyscale test settles it in seconds.

### 3. Complete keyboard operation
Every task completable with a keyboard alone, in an order that matches the visual order, with
focus always visible and never trapped anywhere except a modal that releases it on Escape.

Walk it. Not "it should work"; actually walk the task and write the key sequence. Any step you
cannot write is a step that does not work.

Focus management belongs to specific moments: opening and closing overlays, route changes,
deleting the focused item, and submitting a form with errors. `interaction-design` specifies each;
this skill checks none is missing.

### 4. Programmatic name, role, value, state
Every control has an accessible name (icon-only controls are the usual failure). Every control
uses the right native element or the complete ARIA pattern for what it is. Every state a sighted
user can see (expanded, selected, checked, busy, invalid, current) is exposed programmatically.

The first rule of ARIA is not to use ARIA: a native `button`, `select`, `input` or `a` carries all
of this for free and correctly on every platform. A custom control takes on the full keyboard
pattern, the full state exposure, and the maintenance of both.

### 5. Structure a screen reader can navigate
Headings in order, describing the actual hierarchy, one h1 per page naming the page. Landmarks
(banner, navigation, main, complementary, contentinfo) present and unique. Lists marked as lists.
Tables with real header cells, scope, and a caption or accessible name. A skip link to main
content.

Screen reader users navigate by heading and landmark far more than they read linearly. A screen
with no heading structure is a wall of text with no way in.

### 6. Errors identified, described, and announced
Errors are identified in text (not colour alone), described well enough to fix
(`content-design`), associated with their field programmatically, and announced when they appear
asynchronously. Focus moves to the first error on submit. The user's input is never discarded.

WCAG 2.2 adds obligations worth designing for directly: redundant entry (do not ask for
information the user already gave in the same process) and accessible authentication (no
cognitive function test such as transcribing a code from memory with no alternative). Both are
also plain usability wins.

### 7. Motion, timing and safety
`prefers-reduced-motion` honoured. Nothing flashes more than three times per second. Anything
auto-moving for more than five seconds can be paused. Time limits are adjustable, extendable, or
absent; a session timeout that discards work is both an accessibility failure and the thing users
hate most.

## Per-artifact obligations

This is what makes it design-time rather than audit-time. Each artifact carries its own row.

| Artifact | Obligation |
|---|---|
| `skills-md/tokens.md` and `color.md` | Verified contrast table, all roles, both themes |
| `skills-md/components.md` | Per component: element or ARIA pattern, name source, keyboard pattern, states exposed, target size |
| Hi-fi screen states | Every state's announcement stated: what changed, what is announced, and how (live region politeness) |
| Interaction guide | Focus movement at every transition; key sequence for the whole task |
| Status mapping | Non-colour encoding per status; the announcement when a status changes |
| Content guide | Error message pattern, label rules, link text rules, alt text rules |
| Userflows | The keyboard-only path through the flow, and the assistive-technology experience of a permission denial |

## Testing ladder

Cheapest first. The first three are free and catch most of it; none of them replaces the fourth.

1. **Keyboard-only pass.** Unplug the mouse and complete the task. Finds focus traps, invisible
   focus, hover-only paths, and unreachable controls, in minutes.
2. **Greyscale and colour-blindness simulation.** Finds every single-channel encoding.
3. **Zoom to 200 and 400 percent.** Finds fixed heights, clipping and reflow failures.
4. **Screen reader pass.** VoiceOver on macOS or iOS, NVDA on Windows, TalkBack on Android. Ten
   minutes on the primary task finds naming and structure problems nothing else finds.
5. **Automated scan** (axe, Lighthouse, or equivalent) at build. Catches roughly a third of
   issues; a clean automated scan is not an accessible product and must never be reported as one.
6. **Testing with disabled users**, where the engagement allows. The only method that finds
   whether the product is usable rather than merely conformant.

Record which rungs were run, on what, and when, in the critique report. "Accessible" with no
recorded method is an assertion.

## Procedure

1. Establish the obligation level at project start: sector, procurement standard, contractual
   commitments. Record it in PROJECT_CONFIG and STATE. If nobody knows, that is an assumption
   entry with a large blast radius.
2. Set tokens with contrast verified before any screen is designed. Fixing a token later repaints
   everything downstream of it.
3. Per component, write the accessibility contract as part of its specification, not after.
4. Per screen state, state the announcement.
5. Per flow, walk the keyboard path and write the key sequence.
6. Run the testing ladder rungs 1 to 3 on every prioritized feature before Gate 3; rung 4 on the
   primary task of each feature.
7. File the results in the design critique report with the method named.
8. Anything that cannot be fixed within the design is a recorded exception with a rationale and an
   owner, disclosed at the gate and in the handoff manifest. Never an omission.

## Deciding factors

- **Native beats custom, always**, unless the native control genuinely cannot do the job. The cost
  of a custom select is paid every year, on every platform, forever.
- **Where AA conflicts with a brand guideline, AA wins**, and the conversation happens early with
  the asset in hand and the contrast number computed. It is a much shorter conversation with a
  number in it.
- **Where AA conflicts with density**, the hit area grows while the visual stays dense. These are
  separable and the trade is usually imagined.
- **AAA is worth adopting selectively** on primary reading surfaces and on error-critical flows in
  products used all day. Adopt it explicitly per criterion; do not claim a level you have not
  measured.

## Probing prompts

For the client:
- "Does anyone using this have an accessibility requirement you know of?" (frequently yes, and
  frequently a specific person whose workarounds are informative)
- "Are you subject to a procurement or regulatory accessibility standard?"
- "Has anyone ever been unable to use the current system? What did they do instead?"

Self-review, per screen:
- "Complete this task with the keyboard. Write the key sequence." (if you cannot, it does not work)
- "Which control here has no accessible name?"
- "Desaturate it. What information disappeared?"
- "When this loads asynchronously, what does a screen reader user hear, and when?"
- "Where does focus go after this deletes the row it is on?"
- "What is the smallest hit area on this screen?"

## Guardrails

- WCAG 2.2 AA is a floor and is not traded against brand, timeline or density
  (GUARDRAILS 11).
- Focus indicators are never removed without an equally visible replacement.
- Meaning is never carried by a single channel.
- Automated scan results are never reported as an accessibility assessment.
- Exceptions are recorded with a rationale and an owner and are disclosed at the gate; they are
  never absorbed silently.
- Accessibility requirements discovered late that change a rule or a requirement are Type B and
  route through the reconciler like anything else.

## Output

- Verified contrast table in `30-design-language/skills-md/color.md`
- Per-component accessibility contract in `components.md`
- Announcement specifications in every hi-fi screen state
- Keyboard path per flow
- Testing ladder results, with methods and dates, in the critique report
- An exceptions list with owners, if any exist

## Exit criteria (Gate 3)

- Contrast verified for every role pairing in every theme
- Keyboard path written and walked for every prioritized task
- Announcements specified for every asynchronous state change
- Ladder rungs 1 to 3 run on every prioritized feature, rung 4 on each primary task
- Zero single-channel encodings; zero hover-only paths; zero targets under 24 x 24
- Exceptions, if any, recorded with owners and disclosed

## Failure modes

- **Audit-at-the-end.** Findings arrive when the tokens, the components and the flows are all
  settled, and half of them are unaffordable.
- **Automated-scan confidence.** A green Lighthouse score on a product no keyboard user can
  operate.
- **Icon-only everything.** A dense, elegant toolbar that is entirely unnamed.
- **Focus removed for looks.** The outline deleted early in the project, and nobody able to see
  where they are for the rest of it.
- **Brand override.** A failing brand colour used for body text because the conversation happened
  too late to have any other outcome.
