# workspace/

`_TEMPLATE/` is the project skeleton. `/new-project {name}` copies it whole to
`workspace/{name}/`, which is what guarantees the placeholders exist on day one, in particular
`00-inputs/PRD.md`. Nothing in this directory is shared between projects; cross-project assets
live in `shared-specs/` at repo root.

```
workspace/_TEMPLATE/     the skeleton, with a _PLACEHOLDER.md in every folder
workspace/{project}/
  PROJECT_CONFIG.md   the five adaptation variables; routing reads this
  STATE.md            live ledger: phase, gates, freshness, rework log, risks,
                      contradictions
  00-inputs/          PRD.md (the spec slot, never absent), spec-intake.md,
                      assumptions.md, audit/, client materials (read-only once filed)
  10-discovery/       anchor-analysis, glossary, questions, transcripts/,
                      problem-statements, solution-hypotheses, open-questions,
                      derived-brief (no-spec projects)
  20-research/        kb-index, client/, authority/, external/, incumbents/,
                      research-notes/
  30-design-language/ style-guide, skills-md/ (twelve slices), prompts/
  40-models/          as-is/, to-be/, flow-optimization/, erd, process-breakdown,
                      ia, ia-validation, userflows/, sitemap
  50-prototype/       prompt-used, build-notes, build; ARCHIVED/ after Gate 1
  60-requirements/    prd-draft (provisional), refined-requirements, prioritized-features
  70-hifi/            {feature}/spec + content, status-mapping, critiques/
  80-gates/           gate reports and pre-gate critiques
  90-handoff/         manifest, walkthrough-notes
```

## Files that exist from day one

`PROJECT_CONFIG.md`, `STATE.md`, `00-inputs/PRD.md` and `00-inputs/assumptions.md`. The PRD slot
holds the client's spec verbatim or the completed placeholder record; it is never blank and never
an unedited template past Phase 0. If it still looks like the template, nobody has decided how the
project will learn what it is building: run `/intake-spec`.

## Placeholders

Every folder ships with a `_PLACEHOLDER.md` naming what belongs there, which skill produces it,
what it depends on, and which gate checks it. Delete one when the real artifact lands. A
placeholder still present at its gate is a visible gap, which is the point.

## Freshness

An artifact is stale when a dependency (CLAUDE.md section 5) changed after its last edit.
`STATE.md` tracks it; `/phase-status` reports it. Two paths are easy to miss: a change to the
ERD's status list stales the status encoding map, every component state matrix that displays it,
and every hi-fi screen state derived from it; a change to the IA stales every userflow, the
sitemap and the route scheme.
