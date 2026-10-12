# Handoff Manifest: {project}

> **What this is.** The complete list of what we are handing to the build team, where each thing lives, and what is still open. Nothing is hidden: gaps are listed as gaps.
>
> **Where it stands.** Final. Produced at project close.
>
> **What we need from you.** Read the 'still open' section before the walkthrough. You inherit whatever is on it.

Assembled: {date} · Walkthrough: {date, attendees incl. developer}
Final conformance snapshot: {date, headline} · Open findings inherited by the dev team: {n}

A gap is listed AS A GAP with its reason. Hiding gaps converts them into build-time surprises
with your name on them.

## Package contents

| Item | Version | Sign-off state | Location | Gap? (reason) |
|---|---|---|---|---|
| Hi-fi specs (all in-list features, nine blocks each) | | | 70-hifi/ | |
| Content sets per feature | | | 70-hifi/{feature}/content.md | |
| Consolidated status mapping | | | 70-hifi/status-mapping.md | |
| Refined requirement document | | | 60-requirements/ | |
| Prioritized list (+descopes with reasons) | | | 60-requirements/ | |
| Traceability matrix | | | 60-requirements/traceability.md | |
| ERD + consequences note | | | 40-models/erd.md | |
| Process breakdown | | | 40-models/ | |
| As-is/to-be pairs (+pain-index deltas) | | | 40-models/ | |
| Flow optimization: cost tables and friction decisions | | | 40-models/flow-optimization/ | |
| IA, route scheme, validation results | | | 40-models/ia.md, ia-validation.md | |
| Userflows, sitemap | | | 40-models/ | |
| Style guide + skills-md set | | | 30-design-language/ | |
| KB index (+ KB location + named second person) | | | 20-research/ | |
| Glossary (rule-bearing terms marked) | | | 10-discovery/ | |
| Assumption register (open and closed) | | | 00-inputs/assumptions.md | |
| Gate reports + critique reports | | | 80-gates/, 70-hifi/critiques/ | |
| shared-specs set (ready-to-code: mandatory) | | | shared-specs/ | |

## What-if sweep (run before the walkthrough)

Per in-list feature, confirm an ARTIFACT answers each, not your memory. Anything unanswered is
patched this week or listed above as a gap.

| Feature | Mutations classified (optimistic/pending/confirmed) + failure behaviour | All screen states incl. ERD statuses | Exception landing states + resume points | Irreversible transitions' confirmation patterns | Concurrency per multi-user surface | Narrow strategy per dense table |
|---|---|---|---|---|---|---|

## Walkthrough record

Order followed: requirements -> ERD (consequences note read aloud) -> breakdown -> flow pairs
-> userflows/sitemap -> per-feature specs. Model before screens.

| Step | Done | Notes |
|---|---|---|
| Glossary rule-bearing terms read aloud with definitions | | The dev team names variables after these words |
| One feature walked end to end at full depth | | Calibrates how much answer the artifacts carry |
| Routing rule landed and demonstrated (rework log shown) | | Rules -> reconciler path; visuals -> style guide/skills-md |

### Question split (the handoff's own quality score)
| Questions asked | Answered from an artifact | Answered from memory |
|---|---|---|
| {n} | {n} | {n} |

Every memory-answered question is a spec gap patched this week, not someday:

| Question | Which artifact should have answered it | Patched (date) |
|---|---|---|
| *"what happens if the second approver is on leave?"* | *process-breakdown, exception rows* | *2026-05-02* |

## Descope pre-answers
For each descoped flow: the one-paragraph "what about X" answer, naming which as-is process
keeps running. The first handoff question is always a descope.

| Descoped item | Reason | Surviving as-is | Pre-written answer |
|---|---|---|---|
| *bulk approval* | *below the line at Gate 2* | *approvers keep approving one at a time, as today* | *"it is on the list for the next phase; nothing gets worse in the meantime"* |

## Feedback routing
Type A: owner patches in place, STATE note. Type B: via requirements-reconciler, and the
requirement updates BEFORE the changed screen ships, even at this late stage. Listen for
feedback revealing a rule wearing small talk ("we could never show that column to branch
staff") rather than a preference.

## md-spec loop (before close, with a developer, never solo)

| File | Reviewed | Divergences adjudicated (adopt / keep-local / delete) | Dated + versioned |
|---|---|---|---|
| shared-specs/design-system.md | | | |
| shared-specs/EngineeringSpec.md | | | |
| shared-specs/CodeReadability.md | | | |

### Loop metrics (recorded in the STATE.md loop-review row)
| Metric | This project | Previous project | Trend |
|---|---|---|---|
| Requirements changed after Gate 2 (Type B count post-G2) | | | |
| Build-time clarification requests | | | |
| Share of generated front end re-used rather than rewritten | | | |

All three should fall as the shared files mature. A loop that records nothing cannot show
whether the system is improving.

---

**Key.**
**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
