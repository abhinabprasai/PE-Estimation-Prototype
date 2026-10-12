# The key block

Any artifact that uses a coded term carries the relevant lines of this key at its foot. Copy only
the lines the document actually uses; a key listing terms that do not appear is noise.

The rule this serves (GUARDRAILS 12): **a term whose definition lives in another file is
undefined for the person reading this one.**

---

## Copy-paste block

```markdown
---

**Key.**
`[DA]` domain authority - the person who rules on how the business actually works ·
`[PO]` product owner ·
`[USER:role]` an end user in that role ·
`[TEAM]` someone on our team ·
`[DOC:section]` the client's own document, with the section ·
`[RESEARCH:source]` outside research, with the source ·
`[LLM]` inferred by a model and not yet verified by anyone.

`(confirmed)` the domain authority verified it, on record ·
`(asserted)` a human said it once, unverified ·
`(inferred)` nobody has said it; reasoning produced it.

**Type A** a surface fix - a screen, wording, layout ·
**Type B** a rule change - a rule, a record type, a status, a permission, a requirement.
Type B goes through the requirements document before anything is redrawn.

**S1** blocker · **S2** major, harms the task · **S3** minor · **SC** a craft judgment stated as
a prediction, which goes to the next user session rather than to a fix · **S4** a preference,
recorded and dropped.

**ORPHAN** a requirement nothing was built for ·
**GHOST** behaviour in a design that no requirement asked for ·
**out of date** something this document depends on changed after it was last edited.

**REQ-ID** a numbered rule in the requirements document ·
**ASM-ID** a numbered assumption in the assumption register ·
**PS-ID** a numbered problem statement ·
**OUT-ID** a numbered outcome in the measurement plan.

**blast radius** what breaks if this turns out to be wrong ·
**load-bearing** something else depends on this, so it cannot be changed quietly ·
**pain index** how expensive the current process is to run, counted in manual steps, errors,
waiting time and systems touched.
```

---

## Terms that should not appear in a designer-facing artifact at all

Rename these where they occur. They are engineering vocabulary and they have no business in a
document a designer fills in. Keep the engineering term in the DEV NOTES block, where developers
read, and use the plain form everywhere else.

| Do not write | Write |
|---|---|
| optimistic / pending / confirmed | **what the screen shows while it saves** (and then describe the three choices in words) |
| server-authoritative | **decided by the system, not the screen** |
| mutations | **actions that change data** |
| cardinality | **how many of each** |
| at-the-time vs current | **frozen at the time vs looked up live** |
| temporal pass | **the check for which values should freeze** |
| co-satisfiability | **could both be true at once** |
| staleness sweep | **the check for documents that went out of date** |
| the standing cadence | **how often we run this** (then say how often) |

## The pattern to follow

The model is already in this repo and it is the one thing done right:
`templates/design-critique-report.md` defines severity and type **inline, immediately under the
table that uses them**, one sentence each, with the tiebreaker stated. Do that everywhere. A
reader should never have to leave the page.
