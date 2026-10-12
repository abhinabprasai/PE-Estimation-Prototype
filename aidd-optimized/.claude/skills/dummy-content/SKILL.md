---
name: dummy-content
description: "Produces shaped, boundary-inclusive content per screen: client-format identifiers with fictitious values, the longest plausible name, a negative and a zero. Use whenever a screen or prototype needs data that will actually stress it."
---

# Realistic Dummy Content

## Purpose
Placeholder text hides real problems: column widths, number formatting, truncation, alignment,
and whether a screen still behaves when a value is negative, zero, or absent. In rule-dense
domains, content shape is part of the spec, and a review conducted on five tidy sample rows is a
review of a screen that will never exist.

Content is also the cheapest design stress test available. Most layout defects are found by the
data, not by the designer.

## Shape rules

1. **IDENTIFIERS AND CODES.** Match the client's real format (glossary and KB: prefix, length,
   separator, check pattern) with fictitious values. If the format is unknown, that is an open
   question, not an invitation to invent one; an invented format mis-trains every reviewer who
   sees it and gets quoted back to you as a requirement.
2. **QUANTITIES AND MONEY.** Domain-plausible magnitudes with KB evidence for the typical range.
   Correct decimal places and thousands convention for the client's locale. Include at least one
   value at the top of the plausible range, because that is the one that breaks the column.
3. **DATES.** Realistic spread, never all today. Include one boundary per table: month-end,
   year-end, or the client's own period close, because that is where the domain rules bite.
   Include one date that is far in the past and one in the future if the domain allows both.
4. **NAMES AND PARTIES.** Long enough to truncate at least once per layout. Diverse, fictitious,
   and never derived from client records. Include at least one name with a diacritic, one with an
   apostrophe or hyphen, and one that is short, because all three break something different.
5. **BOUNDARIES, mandatory per numeric surface.** At least one negative (or the proof that
   negatives are impossible, cited to the ERD) and one zero. One maximum-length string per text
   column. One null or not-recorded value per nullable column, rendered distinguishably from zero.
6. **VOLUME.** Tables shown at the client's realistic row count (spec audit dimension 10), plus the
   empty state, the one-row state, and a filtered-to-nothing state. A table demonstrated at eight
   rows when the client's is eight hundred has demonstrated nothing about the design.
7. **STATUS SPREAD.** Every ERD status value the view can display appears at least once in the
   populated set. If a status never appears in the demo data, its treatment was never reviewed.

## Adversarial pass

After the plausible set, add the content that breaks things. This is where the value is.

| Content | Finds |
|---|---|
| The longest plausible value in every text column, simultaneously | Layout collapse, wrapping, truncation without recovery |
| A value that is a single character | Alignment and minimum-width failures |
| A number at the domain's maximum magnitude | Column width, thousand separators, tabular figure alignment |
| A negative in a column of positives | Sign treatment, colour-only encoding, total calculation display |
| Zero beside empty | Whether the design distinguishes a measured zero from an absence |
| A record in every status, adjacent | Whether statuses are distinguishable, including in greyscale |
| A row where every optional field is empty | Whether the row still reads as a row |
| A name that is entirely uppercase, and one entirely lowercase | Case-handling assumptions in labels and sorting |
| Text in a second script, if the client has any | Font coverage, line height, alignment |

Where the product will be localised, add one German or Finnish label expansion (roughly 35
percent longer than English) to every navigation and button surface.

## Procedure

1. Pull formats, ranges and volumes from the KB. List every format you had to guess and file the
   guesses as open questions, or as assumption register entries where nobody can answer them yet.
2. Generate the plausible set per feature, then the adversarial pass over it.
3. Store beside the spec at `70-hifi/{feature}/content.md` so review, prototype and build all use
   identical data. Divergent demo data is how two reviewers see two different products.
4. **Boundary audit.** Walk each populated screen and physically point at: the negative, the zero,
   the empty, the truncation, the boundary date, the longest name, and each status. Missing one
   means the set is incomplete, not that the screen is fine.
5. Hand the volume numbers to `responsive-design` (narrow strategies are chosen against real row
   counts) and the longest values to `visual-design` (column widths and truncation strategies).

## Deciding factors

- **Fidelity scales with rule density.** Financial and regulated screens get exact-format codes and
  period-boundary dates; a content page needs only truncation and volume realism.
- **Plausible beats pretty.** Data chosen to make the screen look good is data that hides the
  screen's problems, and it is the most common form of self-deception in a design review.
- **Where a format is genuinely unknowable before the DA answers**, use an obviously fictitious
  placeholder shape and label it as unknown in the spec, rather than a confident guess that will
  be mistaken for a decision.

## Probing prompts

- "Which column has never shown its widest plausible value?"
- "What does this total look like when one line is negative?"
- "Which date on this screen would trigger a period-close rule, and is it shown?"
- "Which ERD status has never appeared in any screenshot of this feature?"
- "Show me the zero and the empty side by side. Can you tell them apart?"
- "How many rows does the client actually have? Show me that many."

## Guardrails

- **Never real client data, names, or identifiers**, even "just for the demo" (GUARDRAILS 7).
  Resemblance is a defect, not a convenience; sanitised-but-real rows are the most common way
  client data leaks into a deck that gets forwarded.
- Formats are evidence-based or open-questioned; invented formats mis-train every reviewer.
- Content sets are versioned with the spec. A screenshot with different data from the spec's set
  is unreviewable.

## Output

- `70-hifi/{feature}/content.md` per feature (and per prototype build), boundary-audited
- Volume and longest-value findings handed to `responsive-design` and `visual-design`

## Exit criteria

- Boundary audit clean per populated screen
- Every ERD status represented in the set
- Adversarial pass run and its findings either fixed or recorded

## Failure modes

- **Lorem ipsum in a rule-dense screen.** The review that did not happen.
- **Sanitised-but-real client rows** leaking into mockups and then into a forwarded deck.
- **Demo-flattering data.** Eight short names, all positive, all this month, and a design that
  fails on contact with the client's actual database.
- **Divergent sets.** The prototype, the spec and the deck each populated differently, so nobody
  is reviewing the same product.
