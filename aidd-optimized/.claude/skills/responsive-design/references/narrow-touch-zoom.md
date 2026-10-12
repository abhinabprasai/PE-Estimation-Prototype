# Narrow Screens, Touch, Zoom and Print

Reference for `responsive-design`. Loaded on demand.

## Contents

- Dense data on narrow screens
- Touch and pointer
- Zoom and reflow
- Density and preference
- Print and export

## Dense data on narrow screens

The hardest problem in this domain, and the one where the default answer is usually wrong.

| Strategy | How | Fits |
|---|---|---|
| Priority columns | Rank every column: essential, useful, rare. Drop from the bottom as width decreases, with a way to see the full record | Tables where a few columns carry the decision |
| Horizontal scroll with a frozen key column | The identifying column stays; the rest scrolls | Comparison work where all columns matter and the user knows what they are looking for |
| Row to card | Each row becomes a stacked card with labelled values | Small result sets, scanning rather than comparing |
| Summary then detail | Narrow shows a compact summary row; tapping opens the full record | Queue and triage work |
| Do not adapt | The table stays a table, in a scrolling container, and the design says this surface is desktop-only | Genuinely desktop-only work, stated explicitly rather than implied by neglect |

Choosing:
- If the task is **comparison**, preserve the columns; scroll rather than stack. Stacked cards
  destroy comparison, which was the whole point of the table.
- If the task is **finding one item**, cards or summary rows are fine.
- Never silently drop columns. A user who cannot see a column they rely on will assume the data
  is gone, and will export to a spreadsheet, permanently.

Row-to-card conversion needs every value labelled; an unlabelled stack of values is unreadable
where the table header was doing the labelling.

## Touch and pointer

| Rule | Value |
|---|---|
| Minimum target, any input | 24 x 24 CSS px (WCAG 2.2, 2.5.8) |
| Recommended target, touch-primary | 44 x 44 |
| Gloved or field use | 48 x 48 or larger |
| Spacing between adjacent targets | At least 8px, more for destructive actions beside safe ones |
| Visual size versus hit area | The hit area may exceed the visual control; padding or a pseudo-element does this without giving up density |
| Thumb reach on phones | Primary actions in the lower half; destructive actions away from the natural thumb arc |
| Bottom bars | Keep clear of system gesture areas and the on-screen keyboard |

**Hover does not exist on touch.** Anything revealed only on hover is invisible to a large share
of users, including every keyboard user. Every hover-revealed action needs a persistent path.
This constraint, decided at the start, costs nothing; discovered at Gate 3, it is a rework of
every list in the product.

Pointer precision also varies on desktop: trackpads, touchscreens on laptops, and users with
tremor all benefit from the same generosity. The 24px floor is a floor, not a target.

## Zoom and reflow

These are accessibility requirements with a direct layout cost, and they are cheap to meet if
designed in and expensive to retrofit.

- **200 percent zoom** (WCAG 1.4.4): all content and function remain available. Fixed-height
  containers holding text are the usual failure.
- **400 percent zoom** (WCAG 1.4.10, reflow): content reflows to a single column with no
  two-dimensional scrolling, at a viewport equivalent of 320 CSS px wide. Data tables are the
  permitted exception and may scroll within their own container; the page itself must not.
- **Text spacing override** (WCAG 1.4.12): the user can increase line height, letter and word
  spacing without content clipping. Again, fixed heights are the failure.
- Building with relative units and letting containers grow satisfies all three almost for free.
  Building with fixed pixel heights fails all three and is discovered in an audit.

## Density and preference

- Density mode may vary by surface (a dense table page, a comfortable settings page) but the
  variation must be principled and recorded, not incidental.
- Where one screen serves both expert and occasional users, offer a density control and remember
  it per user. Density is a legitimate preference.
- Automatic density switching by viewport width is a reasonable default; overriding it must be
  possible, because a user on a large monitor may still want comfortable.
- `prefers-reduced-motion`, `prefers-color-scheme` and `prefers-contrast` are all honoured and all
  overridable in-product, with the override stored.

## Print and export

Frequently the real "second platform" in this process's domain, and almost always forgotten.

- Which screens get printed? Ask; the answer is usually "the ones we send to auditors".
- Print styles: no navigation chrome, no interactive-only affordances, tables that break across
  pages with repeated headers, URLs where links carried meaning, and a header stating what the
  document is and when it was generated.
- Everything must survive greyscale, which the status encoding rule already guarantees
  (`visual-design`).
- Where the real need is a document rather than a printed screen, that is an export feature and a
  requirement, not a stylesheet. Route it to the reconciler.

