---
name: information-architecture
description: "Decides the navigation model, labels, wayfinding, cross-cutting placement and route scheme, derived from entities and roles rather than the feature list, and validates it with a tree test. Use in Phase 2B after flow optimization."
---

# Information Architecture

## Purpose
Structure is the part of a design users cannot see and cannot avoid. It decides whether the
product feels like their world or like a menu of the team's backlog. The rule this skill
enforces is that structure derives from the entity model plus roles, never from the feature
list, and its labels come from the glossary, never from industry synonyms or from the design
tool's defaults.

`userflows-sitemap` draws the map. This skill decides what shape the map should be, why, and
what everything on it is called.

Depth: `references/validation-and-crosscutting.md` carries the tree test and reverse card sort protocol, and where cross-cutting content belongs. Load it when the step needs it.

## Inputs
- `40-models/erd.md`: entities, their lifecycles, and the permission matrix (the structural
  source)
- `10-discovery/glossary.md`: the client's words (the labelling source, non-negotiable)
- `40-models/to-be/` and `40-models/flow-optimization/`: what each role does and how often
- `20-research/incumbents/`: the mental models users arrive with
- `60-requirements/prioritized-features.md`: coverage check only, run last

## Step 1: Structural inventory

Before choosing a shape, count. The counts choose the pattern; taste does not.

| Count | How to get it | What it drives |
|---|---|---|
| Primary entities | ERD entities with their own lifecycle (not attribute-like) | Number of top-level areas |
| Roles | ERD permission matrix rows | Whether one map serves everyone or the map varies |
| Role overlap | Share of areas any two roles both reach | Single adaptive map versus separate role homes |
| Daily tasks per role | to-be flows weighted by frequency | What sits at depth 0 |
| Rare-but-critical tasks | Exceptions from process-breakdown | What must be findable but not prominent |
| Cross-cutting areas | Settings, admin, reporting, notifications, help, audit | Placement decisions, section below |

Write the inventory down. Most structural arguments are actually disagreements about these
numbers, and they dissolve once the numbers are on the table.

## Step 2: Choose the navigation model

| Pattern | Fits when | Breaks when |
|---|---|---|
| Flat top navigation | 3 to 7 primary areas, one dominant role, shallow hierarchy | Areas exceed 7, or a role sees a different subset |
| Persistent side navigation | 5 to 15 areas, expert daily users, deep hierarchy, wide screens | Mobile-primary usage, or fewer than 4 areas (it becomes decoration) |
| Hub and spoke | Occasional users, task-shaped rather than object-shaped work, one clear starting point per session | Users need to move between spokes without returning to the hub |
| Master and detail | One dominant entity that people work through in volume (queues, inboxes, case lists) | The work spans several entities equally |
| Workspace or context switcher | Users operate inside one client, project, or period at a time and cross-context work is rare | Cross-context comparison is a real task; then it is a filter, not a switcher |
| Role-partitioned homes | Roles have near-disjoint work and shared vocabulary is thin | Roles hand work to each other constantly; the partition becomes the friction |
| Command-first | Power users, very high task variety, keyboard culture | Anyone occasional, or where discovery of capability matters |

Real products combine two: commonly a persistent side navigation whose primary area opens into
master-detail. Combining three is a smell that the entity model has not settled.

Record the choice with its reasons, and record what you rejected and why. Six months later the
alternative will be proposed again by someone who was not in the room.

## Step 3: Depth versus breadth

The three-click rule is folklore and measurably false: users abandon on uncertainty, not on
clicks. A fourth click down a confidently-labelled path costs nothing; a second click down an
ambiguous one costs the session.

Working rules:

- **Depth 0 (always visible):** what the dominant role touches daily. If two roles disagree
  about what that is, the navigation adapts by role rather than growing to hold both.
- **Depth 1:** everything else with its own lifecycle.
- **Depth 2:** views and filters of depth-1 things, not new concepts.
- **Depth 3+:** acceptable only along a path where each label at each level is unambiguous to the
  role that walks it. Test it (step 7) rather than asserting it.
- **Breadth ceiling at depth 0:** roughly seven items before scanning degrades into reading. At
  eight or more, group; and grouping requires a grouping principle a user shares, not one the
  team invented.
- **Rare but critical stays findable:** not on the top bar, but reachable by search and by one
  obvious path. Month-end, audit, and correction tasks live here, and burying them is the most
  common IA failure in rule-dense products because they never come up during a demo.

## Step 4: Labelling

The glossary is the source. This is a hard rule, not a preference: the glossary definition is
the one an artifact uses, and a label with no entry is a defect in one of the two files
(GUARDRAILS 1).

| Rule | Detail |
|---|---|
| Client term wins | Even when the industry term is better known, even when it is longer, even when the design tool's template says otherwise |
| One term, one concept | If two areas would carry the same label, the entity model has a split or merge problem. Send it to data-modeler; do not solve it with a longer label |
| Nouns for places, verbs for actions | Navigation goes to places. A nav item called "Create invoice" is an action in a place's slot |
| No invented umbrella words | "Operations", "Management", "Tools", "More". If no client word covers the group, the group is not a group |
| Abbreviations only if the client speaks them | If they say "GRN" out loud in meetings, use GRN. If only their software says it, expand it |
| Test the label alone | Would the right role, seeing only this word, know what is behind it? If it needs the sibling items for context, it is weak |

Every navigation label traces to a glossary entry. A label with no glossary entry means either
the term is missing from the glossary (add it) or the area is a design invention (question it).

## Step 5: Wayfinding

Three questions must be answerable at every point without thinking: where am I, where can I go,
how do I get back.

| Element | Rule |
|---|---|
| Current location | Marked in the navigation at every level that is visible, not just the top one |
| Page title | Names the object, not the template: "Invoice INV-4471", not "Invoice detail" |
| Breadcrumbs | Only where the hierarchy is real and deeper than two. A breadcrumb over a flat structure is decoration; a breadcrumb that lies about how the user arrived is worse |
| Back | The browser back button works and is never the only way back. Deep-linked entry means the user may have no history |
| Cross-links | A record links to the records it relates to, using ERD relationships. This is what makes an entity-derived structure pay off |
| Return context | After completing a task, the user returns to where the task made sense to start, with their filters, scroll position and selection intact |

That last row is the most-skipped and most-felt: losing a filtered list after editing one of its
rows is the thing that makes people describe a product as tedious without being able to say why.

## Step 6: Cross-cutting areas

These have no natural home and get placed by default if nobody decides. Decide.

| Area | Placement rule |
|---|---|
| Settings | Split by scope, never pooled. Per-user preferences near the user's own menu; per-workspace configuration inside the workspace; system administration in its own permission-gated area. A single "Settings" holding all three is the classic dumping ground |
| Admin | Separate area, permission-gated, never interleaved with daily work. Admins doing daily work switch into it deliberately |
| Reporting | Depends on who reads it. If operations read reports to do their job, reports live beside the work. If management reads them, a separate area. If both, both, drawing the same data |
| Notifications | Global surface plus in-context markers. The global list is a queue, not an archive: everything in it must be actionable or dismissible |
| Search | Global if entities are many and identifiers are how people refer to things (invoice numbers, case IDs). Scoped-only if the product is small or if global results would be unrankable across types |
| Audit and history | Attached to the record, not in a separate area, unless the domain has auditors as a role, in which case both |
| Help and documentation | In place, at the moment of the rule. A help section people must navigate to is a section people do not read |
| Bulk operations | Live with the list they operate on, never in a separate "tools" area |

## Step 8: Route scheme

The URL is the structure made addressable, and it is a design artifact, not an engineering
detail. Developers will invent one otherwise, and it will mirror their controllers.

- Routes mirror the IA hierarchy and use glossary terms in the client's vocabulary.
- Every addressable thing is addressable: a record, a filtered list, a tab within a record. If a
  user cannot send a colleague a link to what they are looking at, the structure is not finished.
- Identifiers in routes are the ones humans use (the invoice number they say out loud), not
  internal surrogate keys, unless the domain identifier is not stable.
- State that belongs to the view (filters, sort, page, selected tab) lives in the query string,
  so return-context and sharing both work for free.
- Permission-denied routes resolve to an explanation, not to a redirect that pretends the thing
  does not exist. Silent redirects teach users the product is broken.

## Procedure

1. Build the structural inventory (step 1). Get the counts from the ERD, not from memory.
2. Choose the navigation model (step 2) and record the rejected alternatives.
3. Place primary entities, then set depth and breadth (step 3).
4. Label everything from the glossary; queue any missing term to glossary-builder (step 4).
5. Decide wayfinding and cross-cutting placement (steps 5 and 6).
6. Validate with a tree test and a reverse card sort (step 7). Rework before drawing.
7. Write the route scheme (step 8).
8. Coverage check LAST: every prioritized feature has a home, and every home traces to an entity
   or a role's daily work. A feature with no home is a question about which entity it serves.
9. Hand the structure to `userflows-sitemap` to draw and to `responsive-design` to adapt.

## Deciding factors

- **Two roles, one product or two?** Separate homes only when overlap is genuinely thin and
  handoffs between them are rare. Most products that split by role should have adapted one
  structure instead, and discover this after building two.
- **A new feature with no home.** The question is never which menu it gets. It is which entity it
  serves; if the answer is "a new one", that is a data-modeler conversation, not an IA one.
- **Incumbent conventions.** Where users arrive with a strong expectation from an incumbent,
  matching it is cheap and diverging is expensive. Diverge deliberately with a recorded reason
  (`incumbent-research` target 3), never by accident.
- **Structure versus filter.** If two candidate areas hold the same entity in different states,
  they are one area with a filter, not two areas. Statuses are not places.

## Probing prompts

For the DA:
- "Which of these areas would you never use, and which would you live in?"
- "In one day, how many times do you move between these two areas?" (frequent crossing means
  they are one area or they need a direct link)
- "What do you call this group of things when you talk to each other?"
- "Where would you look for {rare-but-critical task}?" (asked cold, without showing the map)

Self-review:
- "Which label did I choose because it is conventional rather than because they say it?"
- "Which area exists because a feature needed a home rather than because a thing exists?"
- "Where does a permission-denied user land, and does that page explain or just refuse?"
- "After finishing the most common task, where does the user end up, and is it where they
  started?"

## Guardrails

- Labels come from `glossary.md`. A label with no glossary entry is a defect in one of the two
  files; fix the right one.
- The ERD permission matrix constrains what appears per role; the structure never advertises what
  the matrix denies, and never hides denial so completely that users cannot request access
  (`userflows-sitemap` owns the denied-experience decision per case).
- Feature-derived navigation is a named failure of this process. The coverage check runs last and
  is a check, not a source.
- Tentative sitemaps from Phase 2A live in `40-models/_tentative/` and are superseded, never
  edited and never overwritten: the 2B file is a new file at the real path (GUARDRAILS 12).

## Output

- `40-models/ia.md`: structural inventory, chosen navigation model with rejected alternatives,
  depth map, labelling table with glossary references, wayfinding decisions, cross-cutting
  placements, route scheme
- `40-models/ia-validation.md`: tree test and card sort results with participants and dates
- Handoff: the structure to `userflows-sitemap`, adaptation questions to `responsive-design`,
  new terms to `glossary-builder`

## Exit criteria (Gate 2)

- Navigation model chosen with recorded reasons and rejected alternatives
- Every label traces to a glossary entry
- Tree test run, results recorded, sub-threshold paths reworked
- Every prioritized feature has a home; every home traces to an entity or a role's daily work
- Route scheme written and reviewed by a developer

## Failure modes

- **Backlog navigation.** Menus mirroring the feature list; every real user confused, nobody able
  to say why.
- **Umbrella labels.** "Management", "Tools", "More": groups with no shared principle, which
  users learn by trial and never by reading.
- **Statuses as places.** Separate areas for pending, approved and archived, when they are one
  list with a filter, tripling the navigation and splitting the user's mental model.
- **Buried exceptions.** Month-end and correction paths four levels down because they never came
  up in a demo, then hand-run in a spreadsheet forever.
- **Untested assertion.** A structure that looked obvious to its author, shipped without a tree
  test, discovered wrong at client validation.
