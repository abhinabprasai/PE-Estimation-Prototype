# Layout and Space Reference

## The spacing scale

One base unit generates everything. 4px is the right base for application UI: it divides evenly,
it aligns with common icon grids, and it gives enough steps without allowing arbitrary values.

| Token | px | Use |
|---|---|---|
| 0 | 0 | Deliberate flush edges |
| 1 | 4 | Icon-to-label, tight inline gaps |
| 2 | 8 | Inside a control, between tightly related items |
| 3 | 12 | Between form fields in a dense form, list item padding |
| 4 | 16 | Default gap between related elements, card padding (compact) |
| 5 | 24 | Between groups within a section, card padding (comfortable) |
| 6 | 32 | Between sections |
| 7 | 48 | Between major page regions |
| 8 | 64 | Page top and bottom margins on wide layouts |
| 9 | 96 | Marketing-scale separation only |

Rules:
- No value off the scale. If one is needed, the scale is missing a step; add it once, globally.
- **Proximity encodes relationship.** The gap between two related items must be visibly smaller
  than the gap to the next group. When a label sits closer to the field below it than to its own
  field above, the layout is lying about which label belongs to which input, and users will fill
  the wrong field.
- Spacing between groups scales with the hierarchy level, not with available room. Do not
  distribute leftover space evenly; leftover space belongs at the outside.
- Vertical rhythm: prefer gaps that are multiples of the base line height in text-heavy regions,
  so consecutive columns of text align across a page.

## Optical adjustment

The scale is the rule; the eye is the arbiter in three specific cases:

- **Optical centring.** Triangular and asymmetric glyphs and icons (a play triangle, a send arrow)
  need a nudge to look centred. Geometric centre is not visual centre.
- **Punctuation and quotes** hang outside the text edge in editorial layouts to keep the margin
  visually straight.
- **Different-sized elements on a shared baseline** need their optical, not geometric, alignment
  matched: a large numeral beside a small label aligns on the numeral's baseline, not its box.

These are the only sanctioned exceptions. Everything else off-scale is drift.

## Grids

| Grid | Columns | Gutter | Use |
|---|---|---|---|
| Desktop wide (1440+) | 12 | 24 | Standard application layout |
| Desktop (1024 to 1439) | 12 | 24 | Same grid, narrower columns |
| Tablet (768 to 1023) | 8 | 16 | |
| Mobile (below 768) | 4 | 16 | |

Twelve divides by 2, 3, 4 and 6, which is why it is standard: it holds halves, thirds, quarters
and sixths without fractional columns.

Container widths:

| Content | Max width | Reason |
|---|---|---|
| Prose and documentation | 65 to 75ch | Measure limit (see `type-scale.md`) |
| Forms, single column | 480 to 640px | Long input fields invite long answers and are harder to scan |
| Application content | 1280 to 1440px, or full width | Beyond 1440 the eye travels too far across a table row |
| Data tables | Full width, with the page gutter preserved | Horizontal space is the scarce resource |
| Dashboards | Full width with a max, so a 34-inch monitor does not stretch cards to absurdity | |

Full-bleed full-width is correct for dense data work and wrong for reading. Decide per surface.

## Alignment

- **One alignment edge per region.** Every element in a group shares a left edge unless it has a
  reason not to. Ragged left edges are the most visible cheapness signal in a layout and the
  easiest to fix.
- **Labels above fields** by default: it survives translation, long labels, and narrow viewports,
  and it keeps the form to one alignment edge. Labels beside fields save vertical space and cost
  a second alignment edge plus a translation risk; use only where vertical space is genuinely the
  binding constraint and the labels are short and controlled.
- **Right-align numbers, left-align text**, and align the column header with its content.
- **Actions align with the thing they act on.** A row action sits on its row; a form's actions
  align with the form's edge, not centred under it, so the eye finds them by following the same
  edge it read down.
- **Do not centre body text**, do not centre multi-line labels, and do not centre form content
  in a wide container. Centred text has no consistent edge to return to.

## Composition patterns

| Pattern | Structure | Fits |
|---|---|---|
| List and detail (side by side) | List pane fixed or resizable, detail fills | Queue work, high-volume triage, where context of the list matters while working an item |
| List then detail (navigate away) | Full-width list, full-page detail | Deep detail work, narrow viewports, when the list is a directory rather than a queue |
| Detail with side panel | Primary content, secondary panel for metadata, activity, related records | Record-centric products |
| Dashboard grid | Cards on the grid, each one question | Overview surfaces; keep to one question per card and put the answer, not the chart, in the largest type |
| Wizard | Sequential steps with a persistent progress indicator | Real branching, meaningful individual steps, backward movement without data loss (`ux-flow-optimization`) |
| Split editor | Input on one side, result or preview on the other | Authoring and configuration work with a visible outcome |
| Full-page form | Single column, grouped sections | Long structured data entry; resist multi-column forms, which break the reading path |

Multi-column forms are the most commonly mis-applied layout. Two columns are defensible only for
short, genuinely parallel field pairs (a from-and-to date, a quantity and a unit). Anything else
in two columns forces the user to guess the tab order, and the tab order will disagree with the
visual order for someone.

## Page anatomy

A consistent page skeleton is worth more than any individual screen's cleverness.

```
[ global nav                                       ]
[ page header: title, status, primary action       ]
[ context bar: filters, search, view controls      ]
[ content region                                   ]
[ footer actions (forms) or pagination (lists)     ]
```

- The primary action sits in the page header, in the same place on every page, always.
- Filters and view controls sit in a consistent band, never mixed into the content.
- Form actions sit at the end of the form, and stick to the viewport bottom when the form is
  longer than the screen. A save button the user must scroll to find on a long form is a support
  ticket.
- Bulk actions appear in place of, or directly above, the list when a selection exists; they do
  not live in a permanent toolbar that is disabled 95 percent of the time.

## Density tables

Concrete values per density mode. These are targets; adjust once, globally, not per screen.

| Element | Comfortable | Compact | Dense |
|---|---|---|---|
| Base type | 16 | 14 | 13 |
| Control height | 40 | 32 | 28 |
| Table row height | 48 | 40 | 32 |
| Table cell padding (x) | 16 | 12 | 8 |
| Card padding | 24 | 16 | 12 |
| Form field vertical gap | 24 | 16 | 12 |
| Section gap | 48 | 32 | 24 |
| Icon size | 20 | 16 | 16 |
| Page gutter | 32 | 24 | 16 |

The interactive hit area never shrinks below 24 x 24 CSS px regardless of the visual size
(WCAG 2.2 target size minimum), and 44 x 44 on touch-primary surfaces. In dense mode this means
the visual control is smaller than its hit area, achieved with padding or a pseudo-element, not
by giving up the density.

## Responsive behaviour of layout

Covered fully in `responsive-design`. The layout-side rules:

- Breakpoints come from where the content breaks, not from device names. Add a breakpoint when a
  layout stops working, and only then.
- The grid changes column count at breakpoints; the spacing scale does not change, though which
  step a given gap uses may.
- Side navigation collapses before content columns do. Chrome yields to content.
- A three-column layout becomes two, then one, and the collapse order is a decision: which column
  is most important, and where does the demoted one go (above, below, or behind a control)?

## Layout review checklist

- Every element aligns to a column edge or to a stated exception.
- Every gap is on the scale.
- Proximity matches relationship: nothing is closer to a stranger than to its own group.
- One alignment edge per region.
- The primary action is where it is on every other page.
- Nothing depends on a fixed height that text could overflow.
- The layout holds with the longest plausible content in every slot (`dummy-content`).
- The layout holds with the shortest: one row, empty, and zero.
- At 400 percent zoom, content reflows into one column without horizontal scrolling
  (WCAG 1.4.10); the exception is data tables, which may scroll in their own container.
