# Conformance Snapshot - {project}, {date}

Produced by process-evaluation (gate-reviewer) on its cadence: end of every phase, before every
gate, after every Type B lands, weekly during Phases 2B and 3. A snapshot older than its cadence
is itself a finding (GUARDRAILS 9.14).

The evaluator reports and routes. The evaluator never fixes; independence is what makes the
findings trustworthy.

| Field | Value |
|---|---|
| Trigger | phase-end / pre-gate-{n} / post-Type-B / weekly / on-demand |
| Scope | full / trace / stale / provenance / drift / {REQ-ID or path} |
| Run by | |
| Previous snapshot | {date}, {file} |
| Days since previous | (against the cadence: overdue is a finding) |

## Headline

One sentence. What state is this artifact set in, and can a gate run on it.

> 

## Metrics strip

| Metric | This | Previous | Trend |
|---|---|---|---|
| Requirements total | | | |
| ORPHAN (requirement nothing implements) | | | |
| GHOST (behaviour citing no requirement) | | | |
| Stale artifacts | | | |
| Untagged claims found | | | |
| (asserted) where (confirmed) is required | | | |
| Open register entries | | | |
| Open register entries with a behaviour blast radius | | | |
| Owner-less contradictions | | | |
| BLOCKING findings open | | | |

A metric that has not moved between two snapshots during an active phase is itself worth a line
in the headline.

## Findings

Severity: **BLOCKING** genuinely stops a gate · **MAJOR** must be fixed this phase · **MINOR**
batch it. Severity honesty matters: inflating BLOCKING burns the mechanism exactly as S4-flooding
burns a critique.

| # | Sweep | Finding | Location | Severity | Owner | Route | Due | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | trace / stale / provenance / drift | | | | | /rework or agent | | open / routed / closed |

Route: structural findings go through `/rework` (Type B machinery). Surface findings go to the
owning agent per CLAUDE.md section 4.

---

## Sweep 1: Traceability

Source: `60-requirements/traceability.md`. The matrix is an index of citations that already exist;
if a link must be invented to fill a cell, the finding is the uncited artifact, not the empty cell.

**Diff against the previous matrix.** Every diff line is a finding with an owner.

| Change | REQ-ID | Detail | Owner |
|---|---|---|---|
| new orphan | | | |
| new ghost | | | |
| link vanished | | which column, and what it pointed at last time | |
| newly linked | | | |

Orphan classification (requirements-reconciler rules on each): awaiting-phase / descoped-and-listed
/ forgotten.

| REQ-ID | Classification | Reason | Owner |
|---|---|---|---|

## Sweep 2: Staleness

An artifact is stale when a dependency changed after its last edit. Walk the dependency order in
CLAUDE.md section 5, not the STATE freshness table alone.

| Artifact | Last edited | Dependency that changed | When | Owner | Re-derive or patch |
|---|---|---|---|---|---|

The two paths that are easy to miss and expensive to skip:

- [ ] ERD status list changed → status encoding map, every component state matrix displaying it,
      every hi-fi screen state derived from it
- [ ] `ia.md` changed → every userflow, the sitemap, the route scheme

## Sweep 3: Provenance

Four finding classes. Every hit is a finding, not a note.

| Class | Location | Claim | Current tag | Required | Owner |
|---|---|---|---|---|---|
| Untagged claim in an artifact | | | none | | |
| (asserted) where (confirmed) is required | | | | (confirmed) [DA] | |
| [LLM] outside its quarantine zones | | | [LLM] | open-questions only | |
| Register integrity: entry missing blast radius, test, owner or decision date | | | | | |

Quarantine zones for `[LLM] (inferred)`: `open-questions.md`, research notes, draft prompts.
Nowhere else.

Register health:

| Check | Result |
|---|---|
| Entries past their decision date | |
| Entries whose blast radius touches a rule, status, permission or lifecycle | |
| Register shrunk since the previous gate? (GUARDRAILS 9.13) | |

## Sweep 4: Drift

Document versus artifact, layer by layer.

| Comparison | Method | Result | Findings |
|---|---|---|---|
| refined-requirements ↔ to-be flows and breakdown | every rule row cites a REQ-ID that exists and still says this | | |
| ERD closed status lists ↔ status encoding map and component state matrices | value-by-value, both directions | | |
| ERD lifecycle ↔ affordances in the hi-fi specs | no affordance the lifecycle forbids | | |
| skills-md rules ↔ what the hi-fi specs actually do | spot-check five rules against five specs | | |
| glossary ↔ labels in the IA and the specs | every label traces to an entry | | |

State-machine direction check (jointly owned by flow-modeler and data-modeler):

- [ ] Every transition the breakdown produces exists in the ERD's closed lists
- [ ] Every transition in the ERD's lists is produced by some step

---

## Gate readiness

If a gate is scheduled, state explicitly which of its pre-checks now fail.

| Gate | Scheduled | Pre-check | Pass / fail | Blocking finding |
|---|---|---|---|---|

## Next three conformance actions

| # | Action | Owner | Due |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

BLOCKING findings are announced in the session, not filed quietly.
