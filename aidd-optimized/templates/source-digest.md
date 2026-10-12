# Digest: {source file name}

> **What this is.** A short, tagged summary of one raw source - a call, a document, a product, an
> export. The project reads this instead of the source. The source itself stays on disk and is
> opened again only when block 6 below says it must be.
>
> **Where it stands.** Produced by source-extractor on {date}. Not reviewed by a human unless a
> line below says so.
>
> **What we need from you.** Nothing, unless block 5 lists a conflict with your name against it.

| Field | Value |
|---|---|
| Source file | `20-research/client/2026-03-04-acme-ops-call.md` |
| Type | call transcript / client document / anchor section / product teardown / email thread / export |
| Who gave it | *Priya Shah, operations lead* |
| Date of the source | *2026-03-04* |
| Size | *90 minutes / 18 pages* |
| Extracted by | *source-extractor, 2026-03-05* |

---

## 1. What this is

*One sentence. Ninety minute call with the operations lead and two invoice clerks, covering the
supplier invoice process end to end.*

## 2. Claims

Every line carries a source tag and a confidence marker. A line without both does not go here.

| # | Claim | Said by | Tag | Confidence |
|---|---|---|---|---|
| *1* | *An invoice over 50,000 needs a second approver* | *Priya Shah* | *`[DA]`* | *(asserted)* |
| *2* | *Reversals happen about four times a month* | *Sam Okonkwo, clerk* | *`[USER:clerk]`* | *(asserted)* |
| | | | | |

## 3. New terms

The client's exact word and how they used it. Do not define it here; the glossary does that.

| Term | Used to mean | Said by |
|---|---|---|
| *"parked"* | *an invoice held pending a query, not the same as rejected* | *Sam Okonkwo* |
| | | |

## 4. Silences

What a reader would expect this source to cover and it does not.

| Kind | What is missing |
|---|---|
| *exception* | *nothing said about what happens when the second approver is on leave* |
| *volume* | *no figure for invoices per month* |
| | |

Kinds: before, after, failure, volume, exception, authority, boundary, reversal.

## 5. Conflicts with other sources

Both statements, both tags. Never resolve one here.

| This source says | Tag | Another source says | Tag | Where |
|---|---|---|---|---|
| *reversal is four times a month* | *`[USER:clerk]`* | *"reversals are rare, maybe twice a year"* | *`[DOC:3.2]`* | *`00-inputs/PRD.md`* |
| | | | | |

## 6. Open the source again when

Be specific enough that a reader knows whether to reopen it without reopening it.

- *You need the exact wording of the escalation rule. Priya states it around the midpoint and the
  phrasing matters because it names a job title, not a person.*
- *You are building the as-is wait accounting and need the four durations Sam gives near the end.*

---

**Key.** `[DA]` = domain authority - `[PO]` = product owner - `[USER:role]` = an end user in that
role - `[DOC:section]` = the client's document - `[LLM]` = inferred by a model, not verified by
anyone. `(confirmed)` = the domain authority verified it, on record - `(asserted)` = a human said
it once - `(inferred)` = nobody has said it.
