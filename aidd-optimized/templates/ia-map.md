# Information Architecture: {project}

> **What this is.** How the product is organised: what the main areas are, what they are called, and how someone finds their way around.
>
> **Where it stands.** Draft until the tree test results are in.
>
> **What we need from you.** Check the names. If we have called something by a word your team does not use, tell us - the names come from your vocabulary, not ours.

Filed at `40-models/ia.md`. Produced by `information-architecture`; drawn by `userflows-sitemap`.

## Structural inventory

| Count | Value | Source |
|---|---|---|
| Primary entities (own lifecycle) | | erd.md |
| Roles | | erd.md permission matrix |
| Role overlap (share of areas any two roles both reach) | | |
| Daily tasks per role | | to-be flows, weighted by frequency |
| Rare-but-critical tasks | | process-breakdown exceptions |
| Cross-cutting areas | | |

## Navigation model

**Chosen:** {pattern}
**Because:** {reason, from the counts above}
**Rejected:** {alternatives, each with one line of why not}

## Depth map

| Depth | Area | Entity | Roles | Daily / occasional / rare |
|---|---|---|---|---|
| 0 | | | | |
| 1 | | | | |
| 2 | | | | |

Breadth at depth 0: {n} items. Above about seven, state the grouping principle and whose principle
it is.

## Labelling

| Area or item | Label | Glossary entry | Notes |
|---|---|---|---|
| *the queue of invoices awaiting action* | *Work queue* | *"work queue", confirmed* | *your team says "the queue"; we use their word* |

Every label traces to a glossary entry. A label with no entry means either a missing glossary term
or an invented area; resolve which.

## Wayfinding

| Element | Decision |
|---|---|
| Current location marking | |
| Page title pattern | names the object, not the template |
| Breadcrumbs | where, and whether the hierarchy is real |
| Back behaviour | including deep-link entry with no history |
| Cross-links between related records | from ERD relationships |
| Return context after task completion | filters, scroll, selection: preserved or not |

## Cross-cutting placement

| Area | Placement | Reason |
|---|---|---|
| Settings (per-user / per-workspace / system) | | split by scope, never pooled |
| Admin | | |
| Reporting | | who reads it decides where it lives |
| Notifications | | |
| Search (global or scoped) | | |
| Audit and history | | |
| Help | | in place, at the moment of the rule |
| Bulk operations | | with the list they operate on |

## Route scheme

| Route | Area | Notes |
|---|---|---|
| `/{area}` | | glossary terms, client vocabulary |
| `/{area}/{id}` | | human identifier, not a surrogate key |
| `/{area}/{id}/{tab}` | | every tab addressable |
| `?filter=&sort=&page=` | | view state in the query string |

Permission-denied routes resolve to an explanation, never a silent redirect.

## Validation

| Method | Participants | Date | Result |
|---|---|---|---|
| Tree test | | | first-click and final-destination success per task |
| Reverse card sort | | | groupings and their names |

Daily tasks below roughly 70 percent direct success are reworked before anything is drawn.

## Coverage check (run LAST)

| Prioritized feature | Home | Entity it serves |
|---|---|---|
| *raise a variance* | *Work queue > invoice detail* | *Invoice* |

A feature with no home raises the question of which entity it serves, not which menu it gets.
