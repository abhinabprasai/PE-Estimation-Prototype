# Traceability Matrix - {project}

> **What this is.** A checklist that every rule we agreed has actually been designed, and that nothing has been designed that no rule asked for.
>
> **Where it stands.** Rebuilt automatically by tools/conformance.py. Do not edit by hand.
>
> **What we need from you.** Nothing - this is an internal check.

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
| *REQ-INV-9* | *awaiting-phase* | *branch permissions are Phase 3* | *requirements-reconciler* | *2026-04-01* |
| | | | | |

## Ghost register (behaviour with no requirement)

| Location | Behaviour | Disposition (new REQ via reconciler / removed / justified) | Owner | Date |
|---|---|---|---|---|
| *70-hifi/invoice-approval/spec.md* | *an "escalate" button nothing asked for* | *new REQ via reconciler* | *requirements-reconciler* | *2026-04-01* |
| | | | | |

## Staleness register

The sweep walks CLAUDE.md section 5, not the STATE freshness table alone. STATE's table is a
summary; this is the working record.

| Artifact | Last edited | Dependency that changed | When | Owner | Re-derive or patch | Closed |
|---|---|---|---|---|---|---|
| *70-hifi/invoice-approval/spec.md* | *2026-03-30* | *40-models/erd.md* | *2026-04-02* | *hifi-spec-designer* | *re-derive* | |
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

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.

**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**ORPHAN** a requirement nothing was built for - **GHOST** behaviour in a design that no requirement asked for - **out of date** something this document depends on changed after it was last edited.
