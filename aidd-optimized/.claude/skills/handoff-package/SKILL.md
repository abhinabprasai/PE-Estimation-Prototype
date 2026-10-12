---
name: handoff-package
description: "Assembles the full artifact set with a versioned manifest, runs the what-if sweep, and holds the live walkthrough with the developer present. Use after Gate 3 passes."
---

# Handoff Package and Walkthrough

## Purpose
Handoff is a transfer of understanding, not a file drop. The file will not explain itself; the
walkthrough does, and the manifest makes gaps visible instead of discovered. The measurable
goal: build-time clarification requests approach zero for anything the artifact set already
answers, and the ones that do arrive route through the correction machinery instead of being
answered from a designer's memory (md-spec-loop tracks the number across projects).

## Package contents (templates/handoff-manifest.md rows)

| Item | Source |
|---|---|
| Hi-fi specs, all in-list features | 70-hifi/{feature}/spec.md |
| Consolidated status mapping | 70-hifi/status-mapping.md |
| Refined requirement document | 60-requirements/refined-requirements.md |
| Prioritized feature list (with descopes + reasons) | 60-requirements/prioritized-features.md |
| ERD with consequences note | 40-models/erd.md |
| Process breakdown | 40-models/process-breakdown.md |
| As-is / to-be pairs, userflows, sitemap, IA decisions | 40-models/ |
| Design language: style guide + skills-md set | 30-design-language/ |
| KB index (and KB location) | 20-research/kb-index.md |
| Glossary | 10-discovery/glossary.md |
| Assumption register, closed and open | 00-inputs/assumptions.md |
| Gate reports + critique reports | 80-gates/, 70-hifi/critiques/ |
| shared-specs set (mandatory on ready-to-code) | shared-specs/ |

Each manifest row: item, version, sign-off state, location. A gap is listed AS A GAP with its
reason; hiding gaps converts them into build-time surprises with your name on them.

## The annotation layer (prepare before the walkthrough)

The specs answer what the design is; developers ask what happens when. Before handoff, sweep
each in-list feature for the what-if surface and confirm each has an answer IN an artifact
(not in your head):

- Every mutation's optimistic/pending/confirmed decision and failure behaviour
  (interaction-design block present?)
- Every screen state including ERD statuses (hifi-spec enumeration complete?)
- Every exception path's landing state and resume point (process-breakdown rows?)
- Every irreversible transition's confirmation pattern (consequences note honoured?)
- Concurrency handling per multi-user surface
- The responsive/narrow strategy per dense table

Where a sweep item has no artifact answer, that is a spec gap patched THIS WEEK, before the
walkthrough, or listed as a manifest gap. The sweep list itself is filed with the manifest so
the dev team can see what was checked.

## Walkthrough procedure (live, always, developer present)

1. Order: requirements -> ERD (consequences note read aloud) -> breakdown -> flow pairs ->
   userflows/sitemap -> per-feature specs. Model before screens, same logic as Gate 2.
2. Per artifact: what it is, what it supersedes, where its open items live, who signed it.
3. Read the glossary's rule-bearing terms aloud with their definitions; the dev team will
   name variables and tables after these words, and this ten minutes is where the ubiquitous
   language either transfers or does not.
4. Land the routing rule explicitly: build-time questions about rules go to the reconciler
   path, not to a designer's memory; show them the rework-log so they see the mechanism
   working. Questions about visuals go to the style guide and skills-md first, the
   ui-designer second.
5. Walk one feature end to end at full depth (spec, states, content, interactions) so the
   team calibrates how much answer the artifacts carry; then survey the rest.
6. Capture questions; answer from artifacts where possible, and note every question the
   artifacts could NOT answer: each is a spec gap to patch this week, not someday. The list
   of artifact-answered versus memory-answered questions is the handoff's own quality score.

## Client-validation feedback
- Classify with gate-review. Type A absorbed; Type B via the reconciler even now, and the
  requirement updates BEFORE the changed screen ships.
- Validation sessions follow interview-facilitation discipline: capture by source, no
  designing in the room, closing summary.

## Deciding factors
- Descoped items: pre-write the "what about X" answer from prioritized-features.md reasons;
  the first handoff question is always a descope, and the answer includes which as-is keeps
  running.
- Walkthrough audience missing the developer: reschedule; a walkthrough without the builder
  transfers understanding to nobody who needs it.
- Phased builds: if development starts feature-by-feature, hand off the model layer
  (requirements, ERD, breakdown) once, in full, and the feature specs per phase; never slice
  the model.
- On demo engagements the package shrinks to what was actually produced, and the manifest
  says so plainly.

## Quality bar (self-evaluation)
- Manifest complete-or-gapped honestly; every row has version and sign-off state.
- What-if sweep run per feature with results filed.
- Walkthrough held with the dev team; question list captured and split
  artifact-answered / memory-answered; memory-answered items patched within the week.
- Routing rule demonstrated, not just stated.

## Guardrails
- Full set, not just designs; a Figma-only handoff is a named failure of this process.
- No close with unresolved Type B feedback outstanding.
- Client materials and the KB transfer under the same confidentiality rules they lived under
  (GUARDRAILS 8).

## Output
- `90-handoff/manifest.md`, `walkthrough-notes.md` (including the question split), the
  what-if sweep note

## Exit criteria
- Walkthrough held with the dev team; manifest complete-or-gapped honestly; feedback
  classified and routed; memory-answered gaps patched

## Failure modes
- File-drop handoff: three weeks of build-time questions that the breakdown already answered.
- Late Type B absorbed silently: the requirement document and the shipped screen now
  disagree, permanently.
- Memory dependence: the walkthrough goes well because the designer answered everything
  live, the designer rolls off, and the answers leave with them.
- Model slicing: feature specs handed off without the ERD and breakdown, and the dev team
  re-inventing the model per feature.
