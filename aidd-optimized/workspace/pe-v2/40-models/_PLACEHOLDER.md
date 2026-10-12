# 40-models/: process, entities, structure

Owners: flow-modeler (process), data-modeler (entities), ux-architect (structure and cost).

```
as-is/{goal}.md               how it works today, workarounds included, not tidied
to-be/{goal}.md               the corrected target process, paired filename with as-is
flow-optimization/{goal}.md   cost tables, friction classes, before-and-after totals
erd.md                        entity cards, statuses, permissions, lifecycle, consequences note
process-breakdown.md          per-step rules, exceptions and downstream effects
ia.md                         navigation model, depth, labels, wayfinding, routes
ia-validation.md              tree test and reverse card sort results
userflows/{role}-{task}.md    per role per task, permission-aware
sitemap.md                    the drawn structure, annotated with roles and entities
```

## The chain, in order

```
erd (permission matrix, statuses)
  -> as-is  ->  to-be  ->  flow-optimization  ->  ia  ->  userflows + sitemap
```

Each arrow is a seam with a reason. Optimizing before the process is correct optimizes the wrong
process. Drawing userflows before the structure is chosen means redrawing them.

## The rules that matter most here

- **Do not tidy the as-is.** The workarounds are the findings; a neat as-is is usually a wrong one.
- **Every to-be is presented beside its as-is pair.** Alone it reads as a description; paired it
  reads as a proposal, and people argue with proposals.
- **Structure derives from entities plus roles**, never from the feature list. The feature list is
  a coverage check, run last.
- **Labels come from `10-discovery/glossary.md`.** A label with no glossary entry is a defect in
  one of the two files.
- **A step is "automatic" only if its trigger and inputs are fully specified by (confirmed)
  entries.** Otherwise it is "manual, candidate for automation" with the blocking item named.
- **Every flow has at least one unhappy path.** Refusal, timeout, invalid input, permission denied.

Delete this file once the folder holds real models.

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.
