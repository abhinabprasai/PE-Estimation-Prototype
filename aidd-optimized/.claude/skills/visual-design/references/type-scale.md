# Typography Reference

## Choosing a scale

A modular scale multiplies a base size by a ratio to generate steps. The ratio decides how much
contrast the type system can express.

| Ratio | Name | Character | Use for |
|---|---|---|---|
| 1.067 | Minor second | Almost no contrast | Never alone; too flat to build hierarchy with |
| 1.125 | Major second | Tight, controlled | Data-dense internal tools, admin products, anything with tables |
| 1.200 | Minor third | Balanced | The safe default for application UI |
| 1.250 | Major third | Expressive | Content-led products, marketing surfaces, documentation |
| 1.333 | Perfect fourth | Dramatic | Landing pages; too loud for application chrome |
| 1.414 / 1.618 | Augmented fourth / golden | Editorial | Display work only |

Application products use two ratios in practice: a tight one for the UI range (body, labels,
table text) and a wider one above it for headings, so headings can be distinct without the body
range becoming muddy. This is legitimate and worth stating explicitly rather than discovering.

## Worked scales

**Dense application scale**, base 13px, ratio 1.125 in the UI range:

| Step | Size | Line height | Weight | Use |
|---|---|---|---|---|
| xs | 11 | 16 | 500 | Table micro-labels, badge text, units |
| sm | 12 | 16 | 400 | Secondary metadata, helper text |
| base | 13 | 20 | 400 | Table cells, form values, body |
| md | 15 | 22 | 500 | Section labels, emphasized values |
| lg | 18 | 26 | 600 | Card and panel titles |
| xl | 22 | 30 | 600 | Page titles |
| 2xl | 28 | 36 | 600 | Rare: dashboard headline numbers |

**Compact application scale**, base 14px, ratio 1.2 (the most common correct default):

| Step | Size | Line height | Weight | Use |
|---|---|---|---|---|
| xs | 11 | 16 | 500 | Overlines, badges |
| sm | 12 | 18 | 400 | Helper, captions, timestamps |
| base | 14 | 22 | 400 | Body, table cells, inputs |
| md | 16 | 24 | 500 | Emphasized body, list primaries |
| lg | 20 | 28 | 600 | Panel titles |
| xl | 24 | 32 | 600 | Page titles |
| 2xl | 30 | 38 | 600 | Section heroes |
| 3xl | 36 | 44 | 700 | Display |

**Comfortable scale**, base 16px, ratio 1.25: multiply the compact scale accordingly. Use for
public-facing, occasional-use, or mobile-primary surfaces.

Never generate a size between steps. If a step is missing, the scale needs one more step, added
once, everywhere.

## Line height

Line height is a function of size and measure, not a single global value.

| Size range | Line height | Reason |
|---|---|---|
| Display, 30px and up | 1.1 to 1.2 | Large text needs less leading; loose display type looks disconnected |
| Headings, 18 to 28px | 1.25 to 1.35 | |
| Body, 13 to 17px | 1.45 to 1.6 | The reading range; 1.5 is the safe default and is also the WCAG-adjustable baseline |
| Small, 11 to 12px | 1.35 to 1.45 | Small text at 1.6 fragments into stripes |
| Single-line UI (buttons, inputs, table cells) | 1.0 to 1.2, with padding doing the work | Line height inside a control fights vertical centring |

Long measures need more leading; short measures need less. A 90-character line at 1.4 is hard to
track back from; the same text at 60 characters is fine.

## Measure (line length)

- Body prose: 45 to 75 characters. 66 is the classic target.
- UI text and form labels: 45 to 60.
- Anything above 90 characters loses the reader on the return sweep; anything below 35 fragments.
- Enforce with a max-width in `ch` units on text containers, not with a fixed pixel width, so it
  survives font-size changes and zoom.

In dense data screens this constraint applies to prose blocks only. A table row is not prose and
is scanned, not read.

## Weight

- Two or three weights, no more. Regular (400), medium (500), semibold (600) covers application
  UI. Bold (700) only if the family's 600 is weak.
- Weight is a hierarchy tool of last resort among the four (position, size, weight, colour): it
  is the least visible at a glance and the most abused.
- Never use weight alone to distinguish two adjacent things of different kinds. Use it to
  distinguish two adjacent things of the same kind.
- Avoid weights below 400 for body text at any size; hairline weights fail contrast in practice
  even when they pass on paper, because contrast ratios are computed on colour and not on stroke.
- Faux bold and faux italic (synthesised by the browser when the family lacks the weight) look
  broken at large sizes. Ship the weights you use.

## Numerals

| Feature | When |
|---|---|
| Tabular figures (`font-variant-numeric: tabular-nums`) | Any column of numbers, any figure that updates in place (timers, counters, live totals). Without it, digits change width and the number jitters |
| Proportional figures | Running prose containing numbers |
| Lining figures | Default for UI |
| Oldstyle figures | Editorial contexts only; they collide with UI alignment |
| Slashed or dotted zero | Where the domain confuses O and 0 (codes, references, serials) |

If the chosen family has no tabular figures, that is a family selection error for a data
product. Check before committing to a typeface, not after the tables jitter.

## Family selection

- One family for the interface. A second only for a genuinely different job: monospace for code,
  identifiers, and diff-like content.
- The family must carry: the weights you use, tabular figures, the language coverage the client
  needs (including accented characters, and any non-Latin script in the client's data), and a
  distinguishable I / l / 1 and O / 0 if the domain contains codes.
- System font stacks are legitimate and often correct for internal tools: zero load cost, native
  feel, complete coverage. The design brief that rejects them should say why.
- Test the family with the client's real longest values, not with lorem ipsum
  (`dummy-content` supplies these).

## Case and styling

- Sentence case for everything by default: headings, buttons, labels, menu items. Title Case is a
  house style that must be chosen deliberately; mixed case across a product is the most common
  consistency defect and the easiest to catch.
- ALL CAPS only for short overlines and small labels, always with letter-spacing added (roughly
  0.04 to 0.08em), never for anything longer than three words, never for anything a screen reader
  should read naturally.
- Italic sparingly and never in the smallest sizes; it degrades badly at 11px on low-density
  displays.
- Underline reserved for links in text. An underlined non-link is a broken promise.
- Letter-spacing: tighten large display type slightly (-0.01 to -0.02em); leave body alone; open
  small caps and all-caps labels.

## Truncation and overflow

Decide per field, once, and record it:

| Strategy | Use when |
|---|---|
| Wrap to a second line | Space allows and the full value matters (names in a card, descriptions) |
| Clamp to n lines with an ellipsis | Descriptions in lists, where the first lines carry the meaning |
| Truncate at the end | The start carries the meaning (names, titles) |
| Truncate in the middle | Both ends carry meaning (file paths, long identifiers, dates in codes) |
| Never truncate | Money, quantities, statuses, identifiers used to communicate. Shrink the neighbours or widen the column instead |

Every truncation has a way to see the full value: a tooltip, the detail view, or an expand.
Truncation with no recovery is data loss the user cannot detect.

## Accessibility interactions

- Body text at 16px on public surfaces; 13 to 14px is acceptable for expert internal tools where
  users control zoom, but it is a decision with a reason, not a default.
- Text must survive 200 percent zoom and reflow at 400 percent without loss of content or
  function (WCAG 1.4.4 and 1.4.10). Fixed-height containers with text inside are where this fails.
- Users must be able to override letter, word and line spacing (WCAG 1.4.12) without clipping;
  fixed-height text containers break this too.
- Do not disable text selection, and do not disable browser zoom.
- Line height under 1.5 for body prose is a documented readability barrier; the exception for
  dense single-line UI text is fine, the exception for paragraphs is not.
