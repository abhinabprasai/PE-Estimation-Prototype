# Project workspace template

`/new-project {name}` copies this whole folder to `workspace/{name}/`. Copying rather than
creating folders one at a time is what guarantees the placeholders exist on day one, particularly
`00-inputs/PRD.md`.

Every folder below carries a `_PLACEHOLDER.md` naming what belongs in it, which skill produces it,
what it depends on, and which gate checks it. Delete a placeholder when the real artifact lands;
a placeholder still present at its gate is a visible gap, which is the point.

## Where everything goes

| Folder | Contents | Produced by | Checked at |
|---|---|---|---|
| `00-inputs/` | `PRD.md` (the spec slot), `spec-intake.md`, `assumptions.md`, `audit/`, client materials | spec-intake | Every gate |
| `10-discovery/` | anchor-analysis, glossary, questions, transcripts, problem-statements, solution-hypotheses, open-questions, derived-brief | discovery-lead | P1 exit, Gate 1 |
| `20-research/` | kb-index, client/, authority/, external/, incumbents/, research-notes/ | domain-researcher, kb-curator | Gate 1, Gate 2 |
| `30-design-language/` | style-guide, skills-md/, prompts/ | ui-designer, prompt-spec-writer | Gate 1 (seed), Gate 2 |
| `40-models/` | as-is/, to-be/, flow-optimization/, erd, process-breakdown, ia, ia-validation, userflows/, sitemap | flow-modeler, data-modeler, ux-architect | Gate 1 (tentative), Gate 2 |
| `50-prototype/` | prompt-used, build-notes, the build; `ARCHIVED/` after Gate 1 | prototype-engineer | Gate 1 |
| `60-requirements/` | prd-draft (provisional), refined-requirements, prioritized-features | prompt-spec-writer, requirements-reconciler | Gate 2 |
| `70-hifi/` | `{feature}/spec.md`, `{feature}/content.md`, status-mapping, critiques/ | hifi-spec-designer, design-critic | Gate 3 |
| `80-gates/` | gate reports and pre-gate critiques | gate-reviewer, design-critic | Continuously |
| `90-handoff/` | manifest, walkthrough-notes | handoff-manager | Close |

## Files that exist from day one and are never absent

- `PROJECT_CONFIG.md`: the five adaptation variables. Unset variables block routing.
- `STATE.md`: the live ledger. Read at every session start.
- `00-inputs/PRD.md`: the spec slot. Holds the client's spec verbatim or the completed
  placeholder record. Never blank, never an unedited template past Phase 0.
- `00-inputs/assumptions.md`: the assumption register. Opened by spec-intake, read aloud at every
  gate, and expected to shrink between gates.

## Freshness

An artifact is stale when a dependency changed after its last edit. The dependency order is in
CLAUDE.md section 5; `STATE.md` tracks it and `/phase-status` reports it. Two staleness paths are
easy to miss: a change to the ERD's status list stales the status encoding map, the component
state matrices and every hi-fi screen state derived from it; a change to the IA stales every
userflow, the sitemap and the route scheme.
