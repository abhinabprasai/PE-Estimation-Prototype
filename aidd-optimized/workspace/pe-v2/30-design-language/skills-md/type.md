# SEED (PROVISIONAL) - type - pe-v2 (Phase 2A)

> **What this is.** The text sizes, weights and line heights for the transformer ERP prototype,
> for office screens and for shop-floor kiosks. It is for whoever builds the prototype.
>
> **Where it stands.** Seed, 9 October 2026, first version. Family and base sizes come from the
> specification; the step scale is a shadcn/Tailwind default arrangement. Nothing is final.
>
> **What we need from you.** Nothing now.

**PROVISIONAL: replace, do not merge.** The user's design language (prior prototype repo) is
pending and replaces this file when it arrives. Rows marked `[DOC]` stay.

**Precedence.** `a11y.md` overrides this file. Sizes here are the density values in
`tokens.md` section 5; if the two differ, `tokens.md` wins and this file is the defect.
`shared-specs/EngineeringSpec.md` wins on code structure.

## 1. Family

UI text is Inter or the system sans [DOC:p.241 §10.1] (asserted). Printed documents use Calibri
per the client's letterhead standard [DOC:p.241 §10.1] (asserted); that is the print templates'
concern, not the screens'.

**Rule Y-1.** `font-family: Inter, ui-sans-serif, system-ui, sans-serif` on `body`. shadcn's
Geist default is replaced. A screen rendering Geist is a violation.

## 2. Scale: office (office-dense and office-comfortable)

Grid text is 13-14 px [DOC:p.241 §10.1] (asserted).

| Step | Size / line height | Weight | Tailwind | Use |
|---|---|---|---|---|
| *body-dense* | *13 / 20 px* | *400* | *`text-[13px] leading-5`* | *Table cells, dense lists* |
| caption | 12 / 16 px | 400 | `text-xs` | Helper text, timestamps, column meta |
| body | 14 / 20 px | 400 | `text-sm` | Form fields, labels, comfortable tables, body copy |
| label | 14 / 20 px | 500 | `text-sm font-medium` | Field labels, table headers, badge text |
| body-lg | 16 / 24 px | 400 | `text-base` | Dialog body, empty-state text |
| title-sm | 18 / 28 px | 600 | `text-lg font-semibold` | Card titles, section heads |
| title | 20 / 28 px | 600 | `text-xl font-semibold` | Detail header record name |
| page | 24 / 32 px | 600 | `text-2xl font-semibold` | Page title, one per page |

## 3. Scale: floor-touch (kiosk and handheld)

Kiosk base is 16 px [DOC:p.241 §8.4] (asserted). Nothing on a floor-touch screen is below 16 px.

| Step | Size / line height | Weight | Use |
|---|---|---|---|
| *body* | *16 / 24 px* | *400* | *Instructions, row text* |
| label | 16 / 24 px | 600 | Field labels, button text, badge text |
| value-lg | 24 / 32 px | 600 | Quantities, the scanned item, the expected item |
| title | 24 / 32 px | 700 | Screen title, operation name |
| alert | 20 / 28 px | 700 | Scan failure banner headline |

**Rule Y-2.** On a floor-touch screen, any text below 16 px is a violation, including captions
and badge text.

## 4. Numerals and data

**Rule Y-3.** Every column of numbers, quantities, money, dates and IDs uses `tabular-nums` and
is right-aligned (numbers, money) or left-aligned (IDs, dates). Example: a quantity column without
`tabular-nums` is a violation.

**Rule Y-4.** Record identifiers (sales order, work order, serial, heat, lot numbers) render in
the body font with `tabular-nums`, never in a monospace font, so they read as text and stay
selectable.

## 5. Case and truncation

**Rule Y-5.** Sentence case for every label, button, heading and badge. ALL CAPS only for the
DUPLICATE reprint watermark, which the specification names [DOC:p.241 §8.4] (asserted).

**Rule Y-6.** Table cells truncate with an ellipsis after one line and expose the full value in a
tooltip that is also reachable by keyboard focus. Record IDs and status badge labels never
truncate; the column widens instead.

## 6. Measure

**Rule Y-7.** Running text (dialog bodies, help, empty states) is capped at `max-w-prose`
(65 characters). Tables are exempt.

---

**Key.**
`[DOC:p.n §x]` the client's own specification, with page and section ·
`(asserted)` written down once by the client, not yet verified by the domain authority.
**SEED** a Phase 2A file, rewritten in Phase 2B ·
**PROVISIONAL** placeholder visuals, replaced (not merged) when the user's design language arrives.
