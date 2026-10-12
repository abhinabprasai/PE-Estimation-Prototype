# WCAG 2.2 AA, as design obligations

Criterion by criterion, expressed as what a design artifact must contain rather than as what code
must do. Level A and AA only; AAA items are marked where they are worth adopting selectively.

---

## Perceivable

**1.1.1 Non-text content (A).** Every image, icon and chart has a text alternative appropriate to
its purpose. Decorative images are explicitly marked decorative. Charts need the data available,
not a description of the shape. *Artifact obligation:* an alt text rule per image type in the
content guide, and a data-table alternative specified for every chart.

**1.2.x Time-based media (A, AA).** Captions for prerecorded and live video, audio description
for prerecorded video. *Artifact obligation:* if the product contains video or audio (training,
help, recorded evidence), captioning is a requirement, not a nice-to-have; route it to the
reconciler as a requirement with a cost.

**1.3.1 Info and relationships (A).** Structure conveyed visually is available programmatically:
headings, lists, tables with headers, form labels, groups with legends. *Artifact obligation:*
heading outline per screen; table header specification; every field label associated.

**1.3.2 Meaningful sequence (A).** Reading order matches visual order. *Artifact obligation:* the
DOM order stated where a visual layout differs from the source order (multi-column layouts are the
usual case).

**1.3.3 Sensory characteristics (A).** Instructions never rely on shape, size, position or sound
alone: no "click the round button on the right". *Artifact obligation:* content guide rule.

**1.3.4 Orientation (AA).** No locking to portrait or landscape unless essential. *Artifact
obligation:* both orientations specified for any mobile surface.

**1.3.5 Identify input purpose (AA).** Fields collecting user information carry the right
autocomplete purpose. *Artifact obligation:* per-field autocomplete mapping in the form spec.
Also a usability win: password managers and autofill start working.

**1.4.1 Use of colour (A).** Colour is never the only visual means of conveying information,
indicating an action, or distinguishing an element. *Artifact obligation:* status encoding map
with a non-colour channel per status; link styling that is not colour-only in body text; the
greyscale test recorded.

**1.4.3 Contrast minimum (AA).** 4.5:1 body, 3:1 large. *Artifact obligation:* verified table, all
roles, all themes, including hover and active variants.

**1.4.4 Resize text (AA).** Content and function available at 200 percent. *Artifact obligation:*
no fixed-height text containers; verification recorded.

**1.4.5 Images of text (AA).** Real text, not pictures of text, except logos. *Artifact
obligation:* no text baked into exported graphics.

**1.4.10 Reflow (AA).** Content reflows to one column at 320 CSS px equivalent with no
two-dimensional scrolling. Data tables may scroll within their own container. *Artifact
obligation:* the narrow strategy per table, and 400 percent zoom verified on the most complex
screen.

**1.4.11 Non-text contrast (AA).** UI component boundaries and meaningful graphics at 3:1.
*Artifact obligation:* input borders, control outlines, focus rings, chart marks and icon contrast
all in the verified table. Input borders are the single most commonly failed item here.

**1.4.12 Text spacing (AA).** No loss of content when the user increases line height to 1.5,
paragraph spacing to 2x, letter spacing to 0.12em and word spacing to 0.16em. *Artifact
obligation:* no fixed heights on text containers.

**1.4.13 Content on hover or focus (AA).** Hover and focus-revealed content is dismissible without
moving the pointer, hoverable (the pointer can move onto it), and persistent until dismissed.
*Artifact obligation:* tooltip and popover behaviour specified, including Escape to dismiss.

---

## Operable

**2.1.1 Keyboard (A).** All functionality available from a keyboard. *Artifact obligation:* the
written key sequence per task.

**2.1.2 No keyboard trap (A).** Focus can always move away. *Artifact obligation:* modal focus
trap released on Escape and on close; no embedded content that swallows focus.

**2.1.4 Character key shortcuts (A).** Single-character shortcuts can be turned off, remapped, or
are active only on focus. *Artifact obligation:* the shortcut table states which.

**2.2.1 Timing adjustable (A).** Time limits can be turned off, adjusted, or extended. *Artifact
obligation:* session expiry warns, offers extension, and preserves work.

**2.2.2 Pause, stop, hide (A).** Auto-moving content over five seconds is controllable. *Artifact
obligation:* carousels, tickers and auto-refreshing lists have controls.

**2.3.1 Three flashes (A).** Nothing flashes more than three times per second. Non-negotiable
seizure safety.

**2.4.1 Bypass blocks (A).** A skip link, or landmarks that make one unnecessary. *Artifact
obligation:* skip link in the page skeleton.

**2.4.2 Page titled (A).** Every page has a descriptive title naming the object, not the template.
*Artifact obligation:* the title pattern in the content guide, including what happens in a tab bar
of eleven similar records.

**2.4.3 Focus order (A).** Focus order preserves meaning and operability. *Artifact obligation:*
stated where the visual order and DOM order differ.

**2.4.4 Link purpose in context (A).** Link text says where it goes. *Artifact obligation:* no
"click here", no naked "view" repeated forty times in a table without an accessible name that
includes the row.

**2.4.5 Multiple ways (AA).** More than one way to find a page: navigation plus search, or a
sitemap. *Artifact obligation:* the IA provides both browse and find paths.

**2.4.6 Headings and labels (AA).** Descriptive. *Artifact obligation:* content guide label rules.

**2.4.7 Focus visible (AA).** Keyboard focus indicator is visible. *Artifact obligation:* one
focus ring token, product-wide, specified against every surface it appears on.

**2.4.11 Focus not obscured, minimum (AA, new in 2.2).** The focused element is not entirely
hidden by sticky headers, footers or overlays. *Artifact obligation:* scroll padding accounted for
wherever a sticky element exists. Sticky headers over long forms are the classic failure.

**2.5.1 Pointer gestures (A).** Multipoint or path-based gestures have a single-pointer
alternative. *Artifact obligation:* every swipe, pinch and drag has a button or menu equivalent.

**2.5.2 Pointer cancellation (A).** Actions trigger on release, not on press, and can be aborted.
*Artifact obligation:* no destructive action on mousedown.

**2.5.3 Label in name (A).** A control's accessible name contains its visible label text, so voice
control users can say what they see. *Artifact obligation:* never an aria-label that contradicts
the visible label.

**2.5.4 Motion actuation (A).** Device motion (shake, tilt) has an interface alternative.

**2.5.7 Dragging movements (AA, new in 2.2).** Anything achieved by dragging has a
non-drag alternative. *Artifact obligation:* reorder and kanban interfaces need a move-to control
or keyboard reordering.

**2.5.8 Target size minimum (AA, new in 2.2).** 24 x 24 CSS px, with defined exceptions for inline
targets and spacing. *Artifact obligation:* the density tables never reduce hit areas below this.

---

## Understandable

**3.1.1 Language of page (A)** and **3.1.2 Language of parts (AA).** Language declared, including
for passages in another language. *Artifact obligation:* relevant wherever client data is
multilingual.

**3.2.1 On focus (A)** and **3.2.2 On input (A).** Focusing or changing a control does not
unexpectedly change context. *Artifact obligation:* no auto-submit on select change, no auto-
navigation on focus. If a change does trigger something, warn beforehand.

**3.2.3 Consistent navigation (AA)** and **3.2.4 Consistent identification (AA).** Repeated
components appear in the same order and the same thing is named the same everywhere. *Artifact
obligation:* the page skeleton and the glossary-bound labelling rules deliver both.

**3.2.6 Consistent help (A, new in 2.2).** Help mechanisms appear in the same relative place on
every page. *Artifact obligation:* the help affordance is in the page skeleton, not scattered.

**3.3.1 Error identification (A).** Errors identified in text and described. *Artifact
obligation:* the error message pattern in the content guide.

**3.3.2 Labels or instructions (A).** Provided where input is required. *Artifact obligation:*
persistent labels, never placeholder-as-label; format expectations stated before entry, not after
failure.

**3.3.3 Error suggestion (AA).** Where a correction is known, suggest it. *Artifact obligation:*
error copy says what to do, not just what is wrong.

**3.3.4 Error prevention, legal financial data (AA).** For anything legal, financial, or that
modifies user-controlled data: reversible, checked, or confirmed. *Artifact obligation:* this is
where the `ux-flow-optimization` friction budget becomes a conformance requirement, not a
preference. Most of this process's domains fall under it.

**3.3.7 Redundant entry (A, new in 2.2).** Do not ask for the same information twice in one
process; auto-populate or offer selection. *Artifact obligation:* the K and R input audit in the
cost table already finds these.

**3.3.8 Accessible authentication, minimum (AA, new in 2.2).** No cognitive function test
(remembering, transcribing, puzzle-solving) without an alternative. Paste must work in
authentication fields. *Artifact obligation:* password managers work; no "type the third and
seventh character of your memorable word" without an alternative.

---

## Robust

**4.1.2 Name, role, value (A).** Every UI component exposes all three, and states are exposed as
they change. *Artifact obligation:* the per-component accessibility contract.

**4.1.3 Status messages (AA).** Status changes not receiving focus are announced programmatically.
*Artifact obligation:* every asynchronous state change in the hi-fi spec states its announcement
and its politeness level: `polite` for confirmations and result counts, `assertive` only for
errors that interrupt.

---

## AAA criteria worth adopting selectively

| Criterion | Adopt when |
|---|---|
| 1.4.6 Contrast enhanced (7:1) | Primary reading surfaces in all-day products; outdoor or bright-environment use |
| 1.4.8 Visual presentation | Long-form reading surfaces |
| 2.2.6 Timeouts | Any product where losing work is expensive; warn about data loss from inactivity |
| 2.4.8 Location | Deep hierarchies; a breadcrumb satisfies it |
| 2.5.5 Target size enhanced (44px) | Any touch, field, or gloved-use surface. Adopt by default there |
| 3.3.5 Help | Rule-dense forms where the domain rule is not obvious |
| 3.3.6 Error prevention (all) | Extend 3.3.4's protections to every form, not only legal and financial |

Adopt explicitly, per criterion, recorded in the style guide. Do not claim a level you have not
measured.
