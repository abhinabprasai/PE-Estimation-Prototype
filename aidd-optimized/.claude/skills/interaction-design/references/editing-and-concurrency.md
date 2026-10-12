# Editing and Concurrency

Reference for `interaction-design`. Loaded on demand.

## Contents

- Autosave, drafts, and dirty state
- Selection, inline editing, drag
- Concurrency

## Autosave, drafts, and dirty state

Decide once per surface and state it:

| Model | Cadence | Signals needed |
|---|---|---|
| Explicit save | User commits | Dirty indicator, unsaved-changes guard on navigate away, disabled save when clean |
| Autosave | On blur per field, or debounced roughly 800ms to 2s after typing stops | "Saving" then "Saved at HH:MM", persistently visible. Failure must be loud and must not be silently retried forever |
| Draft then commit | Autosave the draft, explicit action to commit | Both: draft state saved automatically, commit is deliberate. The right model for anything with a lifecycle |

The third model is usually correct in this process's domain, because entities have statuses and
committing changes the status. Autosaving a legal document into a submitted state is a category
error; autosaving the draft of it is a kindness.

Never navigate a user away from unsaved work without a guard, and never make the guard the only
protection: keep the draft.

## Selection, inline editing, drag

| Pattern | Specification points |
|---|---|
| Selection | Click selects, click elsewhere clears; Shift+click ranges; Cmd/Ctrl+click toggles. Selection survives sort and filter changes or is explicitly cleared with a notice. Selected count is always visible, and "select all" states whether it means the page or the whole result set (this ambiguity causes real damage in bulk operations) |
| Inline edit | Entry (click, double-click, or an explicit control) stated; Enter commits, Escape reverts, blur behaviour stated explicitly (commit or revert; ambiguity here loses work). The editable affordance must be discoverable without hover, because hover does not exist on touch |
| Drag | Always has a non-drag equivalent (a move-to control, keyboard reordering). Drop targets are visible before the drag starts or on drag-enter, never guessable. Cancel with Escape. Drag for reordering needs a live announcement of the new position for assistive technology |
| Expand and collapse | Expanded state persists across navigation where the user set it deliberately. The trigger states what will be revealed, not "more" |
| Hover-revealed actions | Never the only path. They are invisible on touch, to keyboard users, and to anyone who does not know to look. Row actions revealed only on hover need a persistent alternative (a row menu, or an always-visible reduced set) |

## Concurrency

Multi-user products need this decided or the developers will guess, and their guess is usually
last-write-wins with no notice.

| Situation | Handling |
|---|---|
| Two users edit different fields of one record | Field-level merge if the backend supports it, otherwise the second saver is told what changed and by whom |
| Two users edit the same field | The second saver sees both values and chooses. Never silently overwrite |
| The record changed status while the user was editing | Block the save, explain the new status, and offer to reload. This is the case that matters most in lifecycle-heavy products |
| A list the user is working through changes underneath them | Do not reorder or remove rows under the pointer. Show a "3 new items" affordance and let them choose |
| A record is deleted or voided while open | Tell them immediately, preserve their unsaved input somewhere recoverable |

Stale data is a state and needs a treatment: the user should be able to tell that what they are
looking at was true two minutes ago rather than now, on any surface where two minutes matters.

