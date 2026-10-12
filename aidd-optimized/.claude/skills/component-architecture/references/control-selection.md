# Control Selection

The control is a consequence of the decision's shape. Work from the decision, never from the
appearance of the screen.

---

## Four questions that pick the control

1. **How many options?** Sets the family (radio / segmented / select / combobox).
2. **Does the user need to compare them?** Comparison needs all options visible at once, which
   rules out anything that hides options behind a click.
3. **Does the choice take effect now or on save?** Immediate effect means a toggle or an action;
   deferred effect means a form control. Mixing these is why users lose changes.
4. **What is the cost of the wrong choice?** High cost earns visibility, confirmation, and
   prevention (`ux-flow-optimization` friction budget). Low cost earns speed.

## Single choice

| Options | Control | Reasoning |
|---|---|---|
| 2, opposing and short | Segmented control | Both visible; one tap; reads as a single decision |
| 2, one is a modifier of the other | Checkbox | "Include cancelled orders" is not a choice between two things |
| 2 to 5, need explanation | Radio group, vertical | Each option can carry a description line. Horizontal radios truncate labels and break at narrow widths |
| 3 to 4, short and parallel | Segmented control | Fast, no hidden state |
| 6 to 15 | Select | Compact; the list is knowable |
| 15 to a few hundred | Combobox with type-ahead | Scanning fails above about 15 items |
| Unbounded or server-backed | Async combobox | With debounce, minimum query, and all four result states |
| Hierarchical (category then subcategory) | Cascading selects or a tree picker | Never one flat list of 400 concatenated labels |

Radio groups always have a default or an explicit "none" option. A radio group where nothing is
selected and nothing can deselect is a trap the user cannot escape.

## Multiple choice

| Situation | Control |
|---|---|
| Under 8 options, all visible | Checkbox group |
| Over 8, or server-backed | Multi-select combobox with chips |
| Selecting rows for a bulk action | Table selection, not checkboxes in a separate list |
| Options with sub-options | Tri-state parent checkbox (checked, unchecked, indeterminate), with the indeterminate state specified |

Multi-select needs the selection visible while the picker is closed, or users lose track of what
they chose.

## Binary

| Situation | Control |
|---|---|
| Takes effect immediately, on or off | Toggle. Label the thing being switched, not the action ("Email notifications", not "Enable") |
| Part of a form saved later | Checkbox. A toggle in a save-button form implies immediacy and loses changes |
| Agreement or attestation | Checkbox, never pre-ticked, never defaulted (`ux-flow-optimization` defaults doctrine) |
| Filter on or off | Checkbox or a removable chip |

Toggles have no intermediate state and no "unset". If the value can be unknown, it is not a
toggle.

## Numeric

| Situation | Control |
|---|---|
| Exact value the user knows | Number input. No spinner arrows above small integers, no scroll-wheel increment |
| Value with a meaningful range where approximate is fine | Slider plus a numeric input beside it |
| Small integer adjusted often (quantity in a line item) | Stepper with a directly editable field |
| Money | Text input with the currency shown, correct decimal handling, no rounding on entry |
| Percentage | State whether the stored value is 0 to 1 or 0 to 100 and never make the user guess |
| Range (min and max) | Two inputs with an inversion rule stated |

Sliders alone are wrong for anything a user would state precisely, which is most domain data.

## Dates and time

| Situation | Control |
|---|---|
| Copying a date from a document | Text input first, calendar as an assist |
| Choosing relative to today | Calendar with presets (today, last 7 days, this month, last month, this quarter) |
| A period the domain defines | Named period picker using the client's periods, not generic months |
| Date and time together | Separate inputs or one field with a stated format; never a time buried in a calendar popover |
| A range | Range picker with the inversion rule stated and presets for the common ranges |

Domain periods matter more than calendar months in most of this process's work. If the client's
month ends on the 25th, a calendar month picker is wrong and will be worked around in a
spreadsheet.

## Text entry

| Situation | Control |
|---|---|
| Short, structured (reference, code) | Single-line input with format guidance; accept more formats than shown; never block paste |
| Free text under a paragraph | Single-line or a two-row textarea |
| Longer prose | Textarea, resizable, with the limit indicated near the limit |
| Rich content | A rich text editor only if formatting is genuinely part of the data. It is a large commitment: paste handling, accessibility, and sanitisation all become project work |
| Code or identifiers | Monospace input with a distinguishable zero |
| Search | Search input with debounce, clear control, and the query mirrored to the URL |

## Actions

| Situation | Control |
|---|---|
| The one thing this screen is for | Primary button, in the page header, same place on every page |
| Common alternatives | Secondary buttons |
| Rare or contextual | Overflow menu. An overflow menu with one item is a button |
| Destructive | Danger treatment, never adjacent to the primary, with the friction budget applied |
| Applies to a selection | Appears when the selection exists, states the exact count |
| Navigates | A link, which must behave like a link (middle-click, copy address, keyboard). A button that navigates breaks all three |

Links versus buttons is not cosmetic: it is the difference between navigation and action, and
users, browsers and assistive technology all rely on it.

## Containers for sets

| The task | Container |
|---|---|
| Compare items across shared attributes | Table |
| Find one known item | Table or list with search |
| Work through items one by one | List and detail, with keyboard advance to the next |
| Scan heterogeneous items with a dominant visual | Cards |
| Understand distribution or trend | Chart, with the underlying table reachable |
| Show a small fixed set of key figures | Stat tiles, with the definition of each figure available |

Cards for uniform tabular data is the most frequent container error in this process's domain. It
looks modern, triples the vertical space, and removes the column alignment that makes comparison
possible.

## Disclosure

| Situation | Control |
|---|---|
| Detail belonging to a row | Inline expansion, preferred over a modal because context is retained |
| Alternative views of the same object | Tabs, with the state addressable in the URL |
| Optional fields used by a minority | Collapsible section with a truthful label, never "Advanced" |
| A short task requiring a decision now | Modal |
| Supporting context alongside ongoing work | Drawer |
| Any job of real length | A page |

## Selection heuristics worth stating

- Visible beats hidden when the cost of missing the option is high.
- Fewer clicks matters less than fewer decisions. A control that removes a decision beats one that
  removes a click.
- The control that matches what the user already does on paper wins the first week; the control
  that matches the data model wins the first year. Where they conflict, ask which the user does
  more often.
- Any control that requires a hover to reveal its purpose fails for touch and keyboard, and needs
  a second path before it ships.
