# Skill Index

All 34 skills, by phase, with what each produces and where its depth lives. Every skill file
follows the same anatomy: Purpose, Inputs, Method, Procedure, Deciding factors, Probing
prompts, Quality bar (self-evaluation), Guardrails, Output, Exit criteria, Failure modes.
Reference files under `references/` carry the reusable banks (question stems, WCAG criteria,
motion tokens, state matrices) the skill instantiates.

## Phase 0: intake

| Skill | Produces | Depth |
|---|---|---|
| spec-intake | Intake class, 14-dimension audit, filled PRD slot, assumption register, substitute path | references: spec-audit-checklist, reconstruction-interview |

## Phase 1: discovery

| Skill | Produces | Depth |
|---|---|---|
| anchor-analysis | Claim inventory, commitment scan, silence map, verification agenda | Three-pass protocol, claim typology, author-intent analysis |
| glossary-builder | The ubiquitous language: verified definitions, collision log | DDD-grade entry anatomy, rule-bearing classification, collision policing |
| question-generation | The laddered, prioritized, linted question set | references: question-bank (stems, ladders, JTBD switch group, anti-patterns) |
| interview-facilitation | Capture sheets, side lists, closing-summary corrections | references: facilitation-technique (probes, bias counters, observation protocol, difficult moments) |
| contradiction-mining | Attributed problem statements, typed and owned contradictions | Two-stage detection, taxonomy, confirmation loop |

## Phase 2A: divergence

| Skill | Produces | Depth |
|---|---|---|
| as-is-mapping | Blueprint-grade current-state flows with pain index | Visibility layers, wait accounting, variant mapping |
| incumbent-research | Comparable teardown notes, graded research answers | Task walks, heuristic passes with severity, implied-ERD extraction, source grading |
| knowledge-base | The indexed, three-group KB; cited answers | Upgrade scanning, load-bearing marks, health audit |
| style-guide-authoring | style-guide.md + machine-readable skills-md set | Violation-checkable rules; seeds from shared-specs |
| prompt-authoring | Six-part prototype prompts, provisional PRD | The carry table (states, density, volume, a11y floor in every prompt) |
| throwaway-prototype | The interview instrument, archived after Gate 1 | Fidelity asymmetry table (what to build well vs leave rough) |
| dummy-content | Shaped, boundary-inclusive content per screen | Format evidence rules, adversarial stress content |
| tentative-structure | Rough sitemap/to-be/userflow/ERD sketches | Derivation tracing, uncertainty marking, group ideation |

## Phase 2B: convergence

| Skill | Produces | Depth |
|---|---|---|
| requirements-reconciliation | THE central artifact: refined requirements | Quality rules (testable, atomic, solution-free), dependency links, conflict scan |
| erd-modeling | Entity cards, closed status lists, consequences note | Exhaustion protocol, counterexample cardinality, lifecycle + temporal passes |
| to-be-design | Target flows argued against as-is pairs | Improvement ladder, automation honesty + failure modes, pain-index delta |
| process-breakdown | The rule layer developers build against | Three cross-checks, two-developer test |
| ux-flow-optimization | Cost tables, friction classes, defaults, friction budget | Elimination ladder, defaults doctrine, recovery hierarchy |
| information-architecture | Navigation model, labels, wayfinding, routes | Structural inventory, tree testing, cross-cutting placement |
| userflows-sitemap | Role-based flows, the entity-derived sitemap | Permission-aware branching, denied-experience design |
| prioritization | The signed, gating feature list | Method selection table (RICE/WSJF/Kano/...), the two domain rules |

## Phase 3: production intent

| Skill | Produces | Depth |
|---|---|---|
| concept-exploration | Three compositions per primary screen, two killed against written criteria | The axes of disagreement, the three generative moves, the kill protocol |
| hifi-spec | Per-feature specs: nine blocks, all states | State enumeration before screens; ERD reconciliation |
| visual-design | Hierarchy, layout, colour, type, density decisions | references: type-scale, color-system (contrast maths), layout-and-space |
| component-architecture | Control selection, state matrices, APIs | references: component-states, control-selection |
| interaction-design | Behaviour: timing, validation, keyboard, concurrency | references: motion-tokens, interaction-patterns |
| responsive-design | Breakpoints, dense-data strategies, environment adaptations | Context table, order of collapse, zoom/reflow compliance |
| content-design | Every word: labels, errors, empties, confirmations | references: microcopy-patterns |
| accessibility | The WCAG 2.2 AA floor as design constraint | references: wcag-checklist (criterion by criterion) |

## Quality, gates, and close

| Skill | Produces | Depth |
|---|---|---|
| usability-testing | Task-by-participant grid, findings routed into the existing machinery | Participants, task construction, moderation, the completed-wrong rule |
| design-critique | Seven-lens findings, severity-scored, A/B-classified | Lens method, perceptual tests, session protocol |
| gate-review | Held-or-not, classified corrections, filed reports | Readiness pre-checks, quiet-gate probes, post-gate verification |
| process-evaluation | Interpretation and routing of the snapshot produced by `tools/conformance.py` | Four sweeps: traceability, staleness, provenance, drift. The script does the sweeping; this skill reads it |
| handoff-package | Manifest, annotation sweep, walkthrough | The what-if sweep; question-split quality score |
| md-spec-loop | Updated shared-specs + the three loop metrics | Adjudication outcomes; the cross-project scoreboard |

## Extending the system

New skill: one folder under `.claude/skills/{name}/` with SKILL.md (frontmatter: name,
description with when-to-use) following the standard anatomy; put reusable banks in
`references/`. Wire it into an agent's `skills:` list, add routing to CLAUDE.md section 4 if
it changes who does what, and add a row here. Keep SKILL.md under ~250 lines; depth beyond that belongs in `references/`, one level deep, with
a table of contents if the reference file passes 100 lines. Keep the `description` under about
250 characters: it is loaded into every session whether the skill is used or not, and 36 long
descriptions cost 2,000 tokens before any work starts.

## Scripts

Mechanical work is a script, not model work. Scripts cost no context; only their output does.

| Script | What it does | Called by |
|---|---|---|
| `tools/conformance.py` | The four conformance sweeps over a workspace, producing the snapshot | `/verify` |
| `tools/render-share.py` | Renders a share document to a self-contained HTML page | `/share` |
