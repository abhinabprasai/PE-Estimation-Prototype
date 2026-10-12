# Message Patterns

Reference for `content-design`. Loaded on demand.

## Contents

- Errors
- The four empty states
- Confirmations, sized to consequence
- Helper text that carries a rule
- Numbers, dates and units
- Status and system messages

## Errors

Every error message answers three questions, in this order: what happened, why, and what to do
now. The third is the one most commonly missing and the only one the user actually needs.

| Rule | Detail |
|---|---|
| Say what to do | "Enter a date on or after the invoice date" beats "Invalid date" |
| Never blame | "You entered an invalid value" becomes "This needs to be a whole number" |
| Never expose internals | No stack traces, no constraint names, no error codes alone. A reference code the user can quote to support is fine, alongside plain language |
| State the rule, not the violation | The rule is reusable knowledge; the violation is not. Better still, state the rule in the helper text before they hit it |
| Be specific about which thing | In a list of twelve rows, "Save failed" is useless. Name the row |
| Preserve their input, always | Never silently discard what they typed |
| Match the severity | A field-level format issue is not a red banner. A failed submission of a legal document is not a quiet inline note |
| Distinguish the four kinds | Validation (the user can fix it), permission (they cannot, but someone can), system (nobody can right now, retry), and conflict (someone else changed it) each need a different shape of message |

Where the error expresses a domain rule, the spec cites the REQ-ID beside the copy. That is what
makes it auditable, and it is what stops a developer softening a mandatory rule into a suggestion.

## The four empty states

Collapsing these into one generic empty is the most common content defect in a data product.

| State | Copy job | Action |
|---|---|---|
| First use, nothing exists yet | Explain what will appear here and why it is worth having | The one action that creates the first one |
| No results after filtering or searching | State what was searched and which filters are applied | Clear filters, broaden, or search everywhere |
| Cleared by the user (all done) | Acknowledge the completion without celebrating too hard on the hundredth time | Where to go next |
| Failed to load | Explain plainly, distinguish from "empty" | Retry, and a path onward that does not need the failed thing |

An empty table that says "No data" for all four cases teaches the user nothing and, in the
filtered case, actively misleads: they conclude the records are gone.

## Confirmations, sized to consequence

Confirmation copy is written from the friction budget (`ux-flow-optimization`), not from caution.

| Consequence | Pattern |
|---|---|
| Reversible, cheap | No confirmation. Act, then offer undo. "Invoice archived. Undo" |
| Reversible, expensive (things leave the system) | Confirm, naming what happens outside: "This emails 47 suppliers. Send now?" |
| Irreversible by lifecycle rule | Name the object, name the irreversibility, and say it before the dialog as well as in it. "Once posted, INV-4471 cannot be edited or deleted. It can only be reversed with a credit note." |
| Irreversible and catastrophic | Require deliberate input (retyping the identifier, or an explicit re-selection), and name the blast radius exactly |

Rules:
- Name the specific object, never "this item".
- State the consequence, not the mechanism. Users do not care that it is a soft delete.
- The action button carries the verb and the object.
- Never use a confirmation to compensate for a design that made the mistake easy.
- Never pre-select the destructive option, and never make it the Enter-key default.

## Helper text that carries a rule

In rule-dense domains this is where a requirement most often meets the user.

- State the rule before the field, not after the error: "Must be within 30 days of the invoice
  date."
- Cite the REQ-ID in the spec (not in the UI) so a reviewer can trace it and a developer cannot
  weaken it.
- Where a rule has an exception, say who can grant it: "Approvals over 50,000 need a director.
  Ask your manager to route it."
- Do not restate the label. "Enter your delivery date" under a "Delivery date" label is noise
  that trains users to ignore helper text, including the helper text that matters.
- Where the rule is complex, the helper text states the common case and links to the full rule.

## Numbers, dates and units

Consistency here is read as competence, and inconsistency is read as unreliability.

- Currency: symbol or code per client convention, consistent decimal places, thousands separators
  per locale. State whether amounts are gross or net, everywhere they appear.
- Negative numbers: the domain's convention (parentheses in accounting contexts, minus elsewhere),
  plus a non-colour treatment.
- Dates: one unambiguous format, product-wide. Never a bare numeric format that differs between
  US and European readings unless the audience is unambiguously one of them.
- Times: state the time zone anywhere two users could be in different ones, or a deadline exists.
- Relative time is a secondary line, never the only value on a record or in an audit context.
- Units: in the column header when constant, beside the value when they vary, never both.
- Zero and empty read differently: "0" is a measured fact, " - " or "Not recorded" is an absence.
  Showing zero for unknown is a data lie that users will act on.
- Large numbers: abbreviate only in dashboards where precision is not the point, and make the
  exact value available.
- Ranges and precision: match the domain's precision, not the database's. Six decimal places on a
  currency amount is a bug in the design.

## Status and system messages

- Status names come from the ERD and are shown to the user in the glossary's words, not the
  database's. `PENDING_APPROVAL_L2` is not a status label.
- Transitions are announced in terms of what changed and what happens next: "Sent for approval.
  Marta has been notified."
- Progress messages name the operation: "Generating 340 statements", not "Loading".
- Success messages state the outcome and the next step where one exists. A success message that
  only says "Success" wastes the one moment the user was definitely reading.

