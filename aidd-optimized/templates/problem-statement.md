# Problem Statement Entry

> **What this is.** One problem, in the words of the person who described it, with who said it and how sure we are.
>
> **Where it stands.** Draft until the domain expert confirms it in writing.
>
> **What we need from you.** Confirm this is a real problem and that we have described it the way you would.

| Field | Value |
|---|---|
| ID | PS-{n} |
| Problem | one sentence, the client's phrasing where load-bearing |
| Source | [PO] / [DA] / [TEAM:name] / [DOC:section] |
| Current workaround | how they cope today; "none stated" queues the workaround question |
| Downstream consequence | what it costs when it bites; "none stated" queues the stake question |
| Confidence | (confirmed) / (asserted) |
| Confirmation | who confirmed, date, written? |
| Linked flow rows | as-is/{goal}.md row refs once mapped |

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
