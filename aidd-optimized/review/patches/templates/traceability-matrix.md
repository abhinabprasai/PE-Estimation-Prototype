# Traceability Matrix - {project}

Maintained by process-evaluation (gate-reviewer). An index of citations that already exist in
the artifacts; if a link must be invented to fill a cell, the finding is the uncited artifact,
not the empty cell. Updated on the standing cadence (end of phase, before gates, after every
Type B, weekly in 2B/3).

Legend: NONE = orphan candidate | NOT-YET = awaiting its phase | DESCOPED = on the descope
list (verify it is) | N/A = layer does not apply to this requirement.

## Matrix

| REQ-ID | Status | Outcome | To-be flow | Breakdown | ERD | Concepts | Hi-fi | Tested | Verification method | Last verified | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | OUT-{n} or NONE | | | | | | round + result | | | |

- **Outcome** (new): the `OUT-{n}` from `measurement-plan.md` this requirement serves. `NONE` is a
  legitimate value for a requirement that is mandatory by law or contract, and is a finding for
  anything in the optional partition: a requirement in the optional partition that serves no
  outcome was prioritized by seniority.
- **Concepts** (new): the `concepts.md` file, for screens in `concept-exploration`'s scope. `N/A`
  for out-of-scope screens.
- **Tested** (new): the `usability-testing` round and the task result for the flow this requirement
  sits in. `NOT-YET` before the round; `SUBSTITUTED` where the DA stood in for operators.

Verification methods: inspection (read the artifact) / demonstration (walk the flow or build) /
analysis (cross-check two artifacts) / DA confirmation / **observation (watched an operator do it)**.

## Diff since the previous snapshot

Sweep 1's actual work. Every line here is a finding with an owner.

| Change | REQ-ID | Detail | Owner | Date |
|---|---|---|---|---|
| new orphan | | | | |
| new ghost | | | | |
| link vanished | | which column, what it pointed at last time | | |
| newly linked | | | | |

## Orphan register (requirement nothing implements)

| REQ-ID | Classification (awaiting-phase / descoped-and-listed / forgotten) | Reason | Owner | Date |
|---|---|---|---|---|
| | | | | |

## Ghost register (behaviour with no requirement)

| Location | Behaviour | Disposition (new REQ via reconciler / removed / justified) | Owner | Date |
|---|---|---|---|---|
| | | | | |

## Staleness register

The sweep walks CLAUDE.md section 5, not the STATE freshness table alone. STATE's table is a
summary; this is the working record.

| Artifact | Last edited | Dependency that changed | When | Owner | Re-derive or patch | Closed |
|---|---|---|---|---|---|---|
| | | | | | | |

## Provenance register

| Class | Location | Claim | Current tag | Required tag | Owner | Closed |
|---|---|---|---|---|---|---|
| untagged / under-confirmed / [LLM] out of quarantine / register integrity | | | | | | |

## Drift register

| Comparison | Finding | Severity | Owner | Closed |
|---|---|---|---|---|
| requirements ↔ flows | | | | |
| ERD statuses ↔ encoding map and state matrices | | | | |
| ERD lifecycle ↔ affordances in specs | | | | |
| skills-md rules ↔ specs | | | | |
| glossary ↔ labels | | | | |

## Snapshot history

| Date | Headline | Orphans | Ghosts | Stale | Untagged | Blocking | Snapshot file |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
