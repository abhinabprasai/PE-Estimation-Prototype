# Component State Matrices

Write the matrix before drawing. Mark unreachable cells "unreachable" with the reason; never
leave a cell blank.

---

## Button

| State | Specification |
|---|---|
| Default | Per variant: primary (filled, one per view), secondary (outlined or tinted), tertiary (text), danger (filled or outlined, never adjacent to primary) |
| Hover | Background shifts one ramp step; text contrast re-verified against the new background |
| Focus-visible | Focus ring, 3:1 against both the button and the surface behind it. Present on keyboard focus, and not suppressed on click |
| Active | A further step, plus optional 1px translate. No scale on small controls; it looks broken |
| Disabled | Reduced contrast, no pointer cursor, not focusable. Always accompanied by a visible reason nearby |
| Loading | Spinner or busy indicator inside, label retained or replaced with a busy label, width held so nothing shifts, second click ignored |
| Icon-only | Accessible name required; tooltip on hover and focus; minimum 24 x 24 target, 44 on touch |
| With badge or count | Count position fixed; behaviour above 99 stated ("99+") |

## Text input

| State | Specification |
|---|---|
| Empty | Label visible (not a placeholder), optional/required marked, helper text if there is a rule to state |
| Focused | Border emphasis plus focus ring; helper text remains, does not swap for something else |
| Filled | Value legible at full contrast; long values do not clip without a way to see them |
| Invalid | Error border, error icon, message beside the field, input preserved, `aria-invalid` and `aria-describedby` wired |
| Valid (explicit) | Only where confirmation genuinely helps (a checked availability, a verified code). Not as decoration on every field |
| Disabled | Reduced contrast, not focusable, reason nearby |
| Read-only | Full contrast, focusable, selectable and copyable, visually distinct from both editable and disabled |
| Loading | For async-validated or async-populated fields: busy indicator inside the field, input not cleared |
| With prefix/suffix | Unit or symbol inside the field boundary, not overlapping the text, and excluded from the value |
| Character-limited | Count shown from about 80 percent of the limit, not from zero |

## Select and combobox

| State | Specification |
|---|---|
| Closed, no selection | Label plus a truthful empty indication. "Select a warehouse", never a blank |
| Closed, selected | Value shown in full; truncation strategy stated if it can overflow |
| Open | List positioned to stay in the viewport, active option highlighted, keyboard navigation working |
| Searching (async) | Debounced, loading state inside the list, previous results not cleared until new ones arrive |
| No results | States the query, offers a way forward (broaden, clear, create) |
| Load error | Distinguishable from no-results, with a retry |
| Disabled / read-only | As for text input |
| Multi-select | Chips or a count visible while closed; each removable; clear-all present; ordering rule stated |
| Grouped options | Group headers non-selectable and skipped by keyboard navigation |

## Table

| State | Specification |
|---|---|
| Loading (initial) | Skeleton rows matching the real row height and column layout, so nothing jumps |
| Loading (refresh) | Existing rows stay visible and readable, with a subtle busy indication. Never blank the table on refresh |
| Empty (first use) | Explains what will appear here and offers the action that creates the first one |
| Empty (no results) | States the active filters and search, offers to clear them. Different copy, different action from first-use empty |
| One row | Layout holds; no "1 results"; header still meaningful |
| Many rows | Pagination or virtualisation stated; sticky header; row count visible |
| Maximum plausible | Tested against the client's real volume (spec audit dimension 10), not against ten sample rows |
| Error | Explains the failure, retains any usable cached content, offers retry |
| Row hover | Row emphasis, actions revealed only in addition to an always-available path |
| Row selected | Selection treatment that survives greyscale; selected count visible; selection persistence across sort and page stated |
| Row disabled or locked | Reason available; the row is still readable |
| Cell overflow | Truncation strategy per column with a way to see the full value |
| Sorted column | Direction indicator; multi-sort precedence shown if multi-sort exists |
| Column with no data | Empty cell treatment distinguishable from zero |
| Permission-denied rows | Either filtered out with a count of hidden rows, or shown redacted. The choice is a design decision recorded per case |

## List item / record row

| State | Specification |
|---|---|
| Default, hover, focus, selected, disabled | As above |
| With status | Status treatment from the encoding map; never colour alone |
| With unread or new indication | Survives greyscale; clears on a stated event |
| Overflowing content | Clamp strategy stated per line |
| Nested or grouped | Indentation from the spacing scale; expand state persistence stated |

## Modal / dialog

| State | Specification |
|---|---|
| Entering | `motion-slow`, `ease-decelerate`; backdrop fades with it; focus moves in |
| Open | Focus trapped; Escape closes; backdrop click closes only when there is no unsaved input; page behind does not scroll |
| Busy (submitting) | Actions disabled, busy indication on the confirming action, close still possible or explicitly blocked with a reason |
| Error within | Error shown inside the modal, not as a toast behind it |
| Exiting | `motion-fast` to `motion-medium`, `ease-accelerate`; focus returns to the trigger |
| Scrolling content | Header and actions stay fixed; the scroll area is visibly scrollable |

## Form (as a whole)

| State | Specification |
|---|---|
| Pristine | Save disabled or absent; no error shown anywhere |
| Dirty | Save enabled; navigation guard armed; draft saved if the model is draft-then-commit |
| Validating | Per-field busy state; submit disabled with a reason |
| Invalid on submit | Error summary at the top linking to fields; focus moved to the first error; every invalid field marked |
| Submitting | Submit busy; fields read-only rather than disabled, so values stay readable |
| Submitted, success | Stated outcome and the next step. Where does the user go now? |
| Submitted, server error | Error explained, all input preserved, retry available |
| Partially saved | If the backend can partially apply, state exactly what saved and what did not |

## Status badge

| State | Specification |
|---|---|
| One per ERD status value | Family (positive / warning / negative / info / neutral), icon or shape, label text from the glossary |
| Terminal versus transient | Visually distinguishable without reading |
| Unknown or missing status | A defined treatment. Data will arrive with a status you did not plan for, and the fallback must not be a blank badge |
| Truncated | Never. Widen or wrap; a truncated status is a wrong status |

## Navigation item

| State | Specification |
|---|---|
| Default, hover, focus, active (current section) | Current must be distinguishable without colour |
| With count or badge | Behaviour when the count is zero (hide, not show a zero) |
| Disabled by permission | Hidden or visible-disabled per the decision recorded in `userflows-sitemap`, never inconsistently |
| Collapsed (icon-only rail) | Accessible names retained; tooltips on hover and focus |
| Nested | Expansion state persists; the current item's ancestors are visibly expanded |

## Empty, error and permission surfaces (page level)

| Surface | Contents |
|---|---|
| Empty, first use | What this is, why it is empty, the one action that changes that |
| Empty, filtered | The filters applied, and a one-click way to clear them |
| Error, load failed | Plain-language cause, retry, and a path onward that does not require the failed thing |
| Error, unexpected | An identifier the user can quote to support, without exposing internals |
| Permission denied | What is needed, and how to request it if a path exists. Never a bare redirect |
| Not found | Distinguish "does not exist" from "you cannot see it" only where confidentiality allows |
| Offline or degraded | What still works, what does not, and what happens to work in progress |
