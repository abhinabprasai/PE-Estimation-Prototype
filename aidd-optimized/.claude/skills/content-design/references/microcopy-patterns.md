# Microcopy Patterns

Worked patterns per surface. Examples use fictitious data throughout (`dummy-content` rules).

---

## Error messages by kind

### Validation (the user can fix it)
Pattern: **what is wrong + what is needed**, at the field.

| Weak | Better |
|---|---|
| Invalid date | Enter a date on or after the invoice date (14 Mar 2026) |
| Invalid value | Enter a whole number of units |
| Required field | Enter the supplier reference from the delivery note |
| Amount error | The amount cannot exceed the remaining balance of 4,120.00 |
| Format error | Use the format GRN-00000, for example GRN-04812 |

Where the rule is knowable in advance, move it into helper text and this message becomes a
reminder rather than a discovery.

### Permission (they cannot, but someone can)
Pattern: **what is blocked + who can + how to ask**.

> You cannot approve invoices over 50,000. Send this to a director for approval, or ask your
> manager to raise your limit.

Never a bare "Access denied", and never a silent redirect that pretends the record does not exist.

### System (nobody can right now)
Pattern: **plain cause + what was preserved + retry + a way onward**.

> We could not reach the payment provider. Nothing was sent and your entry is saved as a draft.
> Try again, or continue and send it later. Reference: RQ-8842.

Never a stack trace, never a raw constraint name, never a bare code with no words around it.

### Conflict (someone else changed it)
Pattern: **what changed + who + what happens to their work + the choice**.

> Marta posted this invoice while you were editing. Posted invoices cannot be changed. Your edits
> are saved as a note on the record. Open the posted version, or view your note.

This is the case developers invent alone most often, and it is the case where inventing it wrong
loses real work.

---

## Empty states

### First use
> **No purchase orders yet**
> Purchase orders you raise will appear here with their approval status.
> [Create purchase order]

### No results (filtered)
> **No purchase orders match these filters**
> Showing: status *Awaiting approval*, supplier *Northgate*, raised in the last 7 days.
> [Clear filters] [Search all purchase orders]

State the filters. A user who cannot see why the list is empty concludes the data is gone.

### Cleared
> **Nothing waiting for approval**
> Approved orders move to the Approved tab.
> [View approved]

### Failed to load
> **We could not load purchase orders**
> The order service did not respond. Your other work is unaffected.
> [Try again] Reference: RQ-8842

---

## Confirmations by consequence tier

### Reversible and cheap: no dialog
> Purchase order archived. [Undo]

### Reversible but expensive: confirm, name what leaves the system
> **Send 47 purchase orders for approval?**
> Each supplier contact receives an email. Approvers are notified immediately.
> [Send 47 orders] [Cancel]

### Irreversible by lifecycle rule
Before the dialog, on the screen: *Posting is permanent. Posted invoices are reversed with a
credit note, not edited.*

Then:
> **Post invoice INV-4471?**
> Once posted, INV-4471 cannot be edited or deleted. It can only be reversed with a credit note.
> The ledger entry is dated today, 29 Jul 2026.
> [Post invoice] [Keep as draft]

### Irreversible and catastrophic
> **Delete supplier Northgate Components and all 312 linked records?**
> This removes 312 purchase orders, 88 invoices and 4 contracts. It cannot be undone and the
> records cannot be recovered from a backup.
> Type NORTHGATE COMPONENTS to confirm.
> [Delete permanently] [Cancel]

The deliberate input is proportionate here and is theatre anywhere else. Use the friction budget
to decide, not instinct.

---

## Helper text carrying a rule

| Field | Helper text | Cites |
|---|---|---|
| Delivery date | Must be within 30 days of the order date | REQ-ORD-014 |
| Approval route | Orders over 50,000 need a director in addition to your manager | REQ-APP-003 |
| Credit note reason | Required for the audit file. Visible to the supplier | REQ-FIN-021 |
| Tax code | Defaults from the supplier. Change only if this line is treated differently | REQ-FIN-008 |

The citation is in the spec, not in the interface. It is what lets a reviewer verify the copy
against the requirement and stops a mandatory rule being reworded into a suggestion.

---

## Buttons

| Context | Weak | Better |
|---|---|---|
| Form submit | Submit | Create purchase order |
| Confirmation, destructive | Yes / No | Delete invoice / Keep invoice |
| Confirmation, safe | OK | Got it |
| Cancel out of a partly-filled form | Cancel | Discard draft |
| Save and continue | Next | Save and add lines |
| Bulk action | Apply | Approve 12 orders |
| Async action in progress | Loading… | Sending… |
| Retry | Retry | Try sending again |

A button whose label makes sense without the surrounding question is a button that works in a
screen reader, in a confirmation the user skimmed, and in a translation.

---

## Status transition messages

| Transition | Message |
|---|---|
| Draft to submitted | Sent for approval. Marta has been notified. |
| Approved | Approved by Dev Anand on 29 Jul 2026. Ready to post. |
| Rejected | Returned by Dev Anand: "Delivery address does not match the contract." Edit and resend. |
| Posted | Posted to the July ledger. This invoice can now only be reversed. |
| Reversed | Reversed by credit note CN-0912. Both records remain in the ledger. |

Say what happened, who did it, and what is possible now. The third part is what people actually
need and the part most often missing.

---

## Loading and progress

| Situation | Copy |
|---|---|
| Short, known operation | (nothing; the control shows busy) |
| Longer, known operation | Generating 340 statements… |
| Unknown duration | Still working. You can leave this page; we will email you when it is done. |
| Partial completion | 218 of 340 statements generated |
| Partial failure | 335 statements generated. 5 failed because the supplier has no email on file. [View the 5] |

Never "Loading…" alone where the operation has a name.

---

## Translation-safe writing

Where the product will be localised:

- No concatenated sentences from fragments. "Deleted " + count + " items" breaks in languages with
  grammatical number beyond singular and plural. Use whole-string templates with named
  placeholders.
- No word-order assumptions. Placeholders must be reorderable.
- Allow roughly 30 to 40 percent expansion from English for German, Finnish and others; labels
  must not sit in fixed-width containers.
- No text baked into images.
- Dates, numbers and currency formatted by locale, never by string manipulation.
- Avoid idiom and metaphor in anything functional; they translate badly and cost the translator
  time on every string.
