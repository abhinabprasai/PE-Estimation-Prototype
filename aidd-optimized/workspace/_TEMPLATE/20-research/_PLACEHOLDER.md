# 20-research/: the knowledge base

Owners: domain-researcher (produces), kb-curator (structures, indexes, answers queries).

```
kb-index.md        the map; an unindexed item does not exist
client/            client-supplied material
authority/         DA and PO statements: transcripts, confirmations, written answers
external/          research notes, articles
incumbents/        one note per product studied, identical structure so they compare
research-notes/    one per answered open question
```

## The three groups are never mixed in one file

Mixing destroys the ability to know, later, whether an answer came from the client's reality or
from industry convention (GUARDRAILS 8). A mixed file is split on discovery, immediately.

## Index entry per item

`file | group | provenance tag | one-line contents | date | ingested-by`, written in the same
action as the file. Deferred indexing never happens. Items cited by `refined-requirements.md` or
the ERD are marked load-bearing so nobody archives them.

## What research may and may not do

`[RESEARCH:source] (inferred)` informs design decisions and never sets a client rule. A finding
that implies a client rule ("the industry always requires X") is a question for the domain
authority, written into `open-questions.md`.

Delete this file once the folder holds real research.

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
