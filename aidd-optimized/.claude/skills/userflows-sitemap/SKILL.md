---
name: userflows-sitemap
description: "Draws the per-role flows and the entity-derived sitemap, including permission-aware branching and the designed denied experience. Use in Phase 2B once the information architecture is settled."
---

# Userflows and Sitemap

## Purpose
Userflows specify the experience per role; permission differences change the flow itself, not
just button visibility. The sitemap is the drawn form of the structure that
`information-architecture` decided: this skill renders and cross-checks it, it does not re-decide
it.

Division of labour: `information-architecture` decides the shape, the labels and the routes.
`ux-flow-optimization` decides what each task costs and what the fixes are. This skill draws the
result per role and proves the coverage.

## Inputs
- `40-models/ia.md`: navigation model, labels, depth map, routes
- `40-models/erd.md`: the permission matrix (the source for what each role may do)
- `40-models/to-be/` and `40-models/flow-optimization/`: the optimized process
- `40-models/process-breakdown.md`: exceptions that route to a human, and where they land

## Userflows procedure

1. Enumerate role x primary-task pairs from the ERD permission matrix and the to-be flows. One
   file per pair: `40-models/userflows/{role}-{task}.md`.
2. Per flow, record: entry point (including deep-link entry, which is how most real sessions
   start), screens and steps in order, the decisions the user makes and **what they see in order
   to make them**, exits (success, abandon, denied), and exception joins where a
   `process-breakdown` Exception routes a human here.
3. Per step, carry through from the cost table: the default, the disclosure decision, the
   prevention rung, and the recovery affordance. The flow shows what the user experiences; the
   cost table explains why.
4. **Design the denied experience per case.** Where a role lacks a permission, the flow states
   which of these applies and why:

   | Treatment | Use when |
   |---|---|
   | Hidden entirely | The existence of the thing is itself confidential |
   | Visible, disabled, reason shown | The user should know it exists and why they cannot |
   | Visible with a request-access path | A route to permission exists and is worth offering |
   | Visible, read-only | They may see but not change; the most common case and the most often mis-specified as hidden |

   Denial that is discovered late and expensively is a design defect. The probe is: is discovering
   the denial cheap and early, or does the user fill in a form first?
5. **Return context.** State where each flow leaves the user on success, on abandon, and on
   denial, and whether their filters, scroll position and selection survive. This is the most
   skipped row and the most felt.
6. Cross-check both directions: every to-be human-decision row appears in some role's flow, and
   every flow step is reachable from its entry point in the IA.

## Sitemap procedure

1. Render the structure from `40-models/ia.md`: areas, depth, labels, and the route per node.
2. Annotate per node: which roles reach it, its entity, and whether it is depth-0 daily work or
   rare-but-critical.
3. Mark the cross-cutting placements (settings, admin, reporting, notifications, search, audit)
   as decided in the IA.
4. Coverage check LAST, against the prioritized feature list, as a check and never as a source. A
   feature with no home raises the question of which entity it serves, not which menu it gets.
5. Where the sitemap and the IA disagree, the IA is wrong or the drawing is; resolve it there, not
   by quietly redrawing.

## Deciding factors

- **Two roles, one flow or two?** One file with a role branch beats two files until the branches
  exceed about a third of the flow; then split. Two near-identical files drift within a month.
- **Depth of denied-experience design scales with how adversarial denial is** in this domain:
  finance approvals, very; content drafts, barely.
- **Exception joins are flows too.** The person who receives an escalation has a task, and if it
  is not drawn, it is invented at build.
- **A flow with no unhappy path is unfinished.** Every flow has at least one refusal, timeout, or
  invalid-input exit.

## Probing prompts

- "Which role's real workflow crosses these areas most often? Does the map make that crossing one
  step or four?" (ask the DA)
- "For each denied branch: is discovering the denial cheap and early, or expensive and late?"
- "Which glossary term is missing from the map entirely? Why?"
- "After finishing this task, where is the user, and did they keep their filters?"
- "Who receives this exception, and is their flow drawn?"
- "Which step here requires information from a screen the user has already left?"

## Guardrails

- The ERD permission matrix is the source; flows never grant what the matrix denies.
- The IA is the structural source; this skill draws it and reports disagreements rather than
  resolving them locally.
- Labels come from `glossary.md`. A label with no glossary entry is a defect in one of the two
  files, never a local choice (GUARDRAILS 1).
- TENTATIVE Phase 2A sketches live in `40-models/_tentative/` and are superseded, never edited
  and never overwritten: the 2B file is a new file at the real path (GUARDRAILS 12).

## Output

- `40-models/userflows/{role}-{task}.md` set
- `40-models/sitemap.md`, annotated with roles, entities and routes

## Exit criteria (Gate 2)

- Cross-checks clean in both directions
- Denied experience specified per case, with the treatment and its reason
- Return context stated per flow
- Every exception join has a receiving flow
- PO has reviewed the sitemap; every prioritized feature has a home

## Failure modes

- **Backlog navigation.** Menus mirroring the feature list, confusing every real user.
- **Permission afterthought.** Denied branches unspecified and invented by developers at build,
  usually as a silent redirect.
- **Happy path only.** No refusal, no timeout, no invalid input, and every one of them designed
  under pressure later.
- **Lost context.** The user completes a task and is returned to an unfiltered list at the top,
  every time, forever.
