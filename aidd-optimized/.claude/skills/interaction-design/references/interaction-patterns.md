# Interaction Pattern Specifications

Per-pattern behaviour to specify in the interaction guide block. Each entry lists the decisions a
developer will otherwise make alone.

---

## Buttons and actions

- Busy state: the button shows it is working, keeps its width (no layout shift), and is not
  clickable twice. Double-submission protection is a spec item, not a developer's initiative.
- Disabled: always paired with a reason the user can perceive without hovering. A disabled primary
  action with no explanation is a dead end, and dead ends generate support tickets.
- Destructive actions never sit adjacent to the primary action in the tab order or in space.
- Loading a route from a button: the button shows busy until the new view paints, otherwise the
  user clicks again.

## Forms

- Label position, required marking, and helper text placement decided once, product-wide.
- Optional versus required: mark the minority. If most fields are required, mark the optional ones.
- Input masks: format as they type only where the format is unambiguous (phone, card). Never mask
  something the user might legitimately paste in another format; accept and normalise instead.
- Paste always works, in every field. Blocking paste in a reference-number field is the fastest
  way to make an expert user hate a product.
- Number inputs: no spinner arrows for values above small integers, no scroll-wheel increment
  (accidental changes), and never silently clamp a pasted out-of-range value without saying so.
- Autocomplete attributes set correctly so password managers and browser autofill work.
- Field-level help states the rule, cites nothing visible to the user, but traces to a REQ-ID in
  the spec.
- Multi-step forms preserve everything on backward navigation, always.

## Selects, combos, and pickers

| Options | Control |
|---|---|
| 2 | Radio pair, or a toggle if genuinely binary and the labels are short |
| 3 to 5 | Radios if the options need explaining, segmented control if they are short and parallel |
| 6 to 15 | Select |
| Over 15 | Searchable combobox with type-ahead |
| Over a few hundred, or server-backed | Async combobox with debounced search (roughly 250 to 350ms), a minimum query length, a loading state, a no-results state, and an error state |

Every async picker needs all four states specified. The no-results state must say what was
searched and offer a way forward (create, broaden, clear).

Multi-select: selected items visible without opening the control, individually removable, with a
clear-all. State the ordering: selection order or the list's order.

## Tables and lists

- Default sort and default filter are domain decisions, not defaults from the framework. Ask what
  the user is trying to see first.
- Sort indicators show the current column and direction. Multi-column sort, if offered, shows the
  precedence.
- Column resize, reorder, and show/hide: state which exist and whether they persist per user.
- Pagination versus infinite scroll: pagination for work where position matters and users need to
  know how much is left; infinite scroll only for exploratory feeds, and never where a footer
  contains anything. State the page size and whether it is adjustable.
- Row click behaviour: does it open, select, or nothing? A row that is clickable in some tables
  and not others is a product-level inconsistency.
- Row actions: always-visible for the primary, menu for the rest. Hover-only reveal is not the
  only path (touch, keyboard).
- Selection persistence across pages, sorts and filters: stated explicitly. "Select all" must say
  whether it means the visible page or the entire result set, and the count must be exact.
- Bulk actions: confirmation states the exact count and the exact operation. Partial failure is
  reported per item, not as a single failed toast.
- Empty, one-row, error, and loading states all specified (`content-design` writes the copy).
- Frozen columns and horizontal scroll behaviour on narrow viewports (`responsive-design`).

## Modals, drawers, and popovers

| Surface | Use | Rules |
|---|---|---|
| Modal | A decision that must be made now, or a short focused task | Focus trapped and returned; Escape closes; backdrop click closes only when there is no unsaved input; never nested |
| Drawer | Supporting detail or a secondary task alongside the main context | Main content stays visible and ideally usable; wide enough for real content |
| Popover | Small contextual controls, filters, menus | Dismiss on outside click and Escape; positioned to stay in the viewport; never contains a form long enough to scroll |
| Inline expansion | Detail that belongs with its row | Preferred over a modal whenever the context matters |
| Full page | Anything long, complex, or worth a URL | The default for real work. A modal is not a place to do a job |

Nested modals are prohibited. If a modal needs a modal, the first one should have been a page.

Unsaved input in any dismissible layer needs a guard on every dismissal path: Escape, backdrop,
close button, and browser back.

## Notifications and messaging

| Type | Use | Persistence |
|---|---|---|
| Toast | Confirmation of something the user just did, requiring no action | Auto-dismiss 4 to 6s; never for errors that need action; never the only record of an important event |
| Inline message | Feedback about the region it sits in | Persists until resolved |
| Banner | Page-level or system-level state (degraded service, a record locked) | Persists; dismissible only if the condition is not blocking |
| Dialog | Requires a decision before continuing | Until answered |
| Notification centre | A record of things that happened while away | Until read or dismissed; every item actionable or dismissible |

An error that requires the user to do something is never a toast. Toasts vanish, are missed, and
cannot be re-read.

## Search

- Instant search debounced at 250 to 350ms, with a minimum query length where the corpus is large.
- The query stays in the input and in the URL. Users share searches and refresh pages.
- Results state what was searched and how many matched.
- No results: state the query, suggest relaxations (spelling, filters applied, scope), and offer
  the adjacent action (create it, search everywhere).
- Recent and saved searches for expert tools. Filters and search compose predictably: state
  whether a filter narrows the search or replaces it.

## Dates, times, and ranges

- Show the format expected, and accept more formats than you show.
- Keyboard entry always available; a calendar-only date picker is a barrier for anyone entering a
  date from a document, which is most of this process's domain.
- Ranges cannot invert: selecting an end before the start either swaps or is prevented, and the
  choice is stated.
- Time zones: state which zone is displayed, everywhere a time appears, in any product where two
  users could be in different zones or where a legal deadline exists.
- Relative time ("2 hours ago") needs the absolute value available on hover or beside it. Relative
  alone is unusable for records and audit.

## Files

- State accepted types and the size limit before the user picks, not after they fail.
- Progress per file, cancellable.
- Partial failure in a multi-file upload reports which succeeded and which did not, and does not
  discard the successes.
- Drag-and-drop always accompanied by a click-to-browse path.
- Virus scanning, processing, or conversion delays are a pending state on the record, not a
  blocked screen.

## Permissions and denial

- Denied is explained, not hidden, unless the existence of the thing is itself confidential.
- The explanation says what permission is needed and how to get it, if a path exists.
- Hidden versus visible-disabled is decided per case in `userflows-sitemap` and specified here.
- A permission-denied route resolves to an explanation page, never a silent redirect to a
  dashboard, which teaches the user the product is broken.

## Session and connectivity

- Session expiry warns before it happens and preserves unsaved work through re-authentication.
- Offline or degraded connectivity: state whether the product queues, blocks, or fails. Silent
  failure while a user keeps typing is the worst of the three.
- Reconnection restores state without a full reload where possible, and tells the user what it
  did.
