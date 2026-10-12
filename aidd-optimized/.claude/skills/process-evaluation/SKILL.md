---
name: process-evaluation
description: "Interprets and routes the conformance snapshot produced by tools/conformance.py. Covers what each sweep means, how to classify a finding, and the standing cadence. Use with /verify; run the script rather than reading the artifacts."
---

# Process Evaluation and Conformance

## Purpose
Everything else in this system produces artifacts; this skill checks that they still agree
with each other and with the documents they derive from. Gates verify conformance at
checkpoints with humans in the room; this skill verifies it continuously and cheaply, so that
gates spend their expensive minutes on domain judgment instead of on discovering that two
files disagree. The core instrument is the requirements traceability matrix: every REQ-ID
mapped to every artifact that implements, constrains, or renders it, with a verification
method and a current status per link.

The question this skill exists to answer, at any moment, in under a minute of reading: does
the work still match what the documents need and say, and if not, exactly where has it
drifted?

## The traceability matrix (`60-requirements/traceability.md`)

One row per REQ-ID, columns per artifact layer, built from the citations the other skills
already leave behind (flow steps cite REQ-IDs, breakdown rules cite REQ-IDs, hi-fi specs cite
REQ-IDs; the matrix is an index of existing citations, not a new bureaucracy).

| Column | Content |
|---|---|
| REQ-ID | From refined-requirements.md, the single source of IDs |
| Status | confirmed / asserted-open / superseded / retired (mirrors the entry) |
| To-be flow | Which flow step(s) implement it, or NONE |
| Breakdown | Which rule row(s) enforce it, or NONE |
| ERD | Which entity/constraint carries it, or N/A |
| Hi-fi | Which feature spec(s) render it, or NOT-YET / DESCOPED |
| Verification method | How conformance is checked: inspection (read the artifact), demonstration (walk the flow/prototype), analysis (cross-check two artifacts), or DA confirmation |
| Last verified | Date + by whom |
| Flags | ORPHAN (no implementing artifact), GHOST (artifact behaviour with no REQ), STALE (upstream changed after last verification), CONFLICT |

Two flag types carry the weight:
- **ORPHAN**: a requirement nothing implements. Either it awaits its phase (fine, marked
  NOT-YET), was descoped (must appear in prioritized-features' descope list; if not, someone
  dropped it silently), or was forgotten (a finding).
- **GHOST**: artifact behaviour citing no requirement. Either a missing requirement (route to
  the reconciler), or invention (route to the owning agent to justify or remove). Ghosts are
  how scope creeps in quietly and how untraceable behaviour reaches production.

## The four sweeps

Run all four for a full snapshot; individual sweeps run cheaply on demand.

### 1. Traceability sweep
Rebuild the matrix from current citations. Diff against the previous matrix: new orphans, new
ghosts, links that vanished. Every diff line is a finding with an owner.

### 2. Staleness sweep
Walk the dependency order (CLAUDE.md section 5). For each artifact: did anything it depends on
change after its last edit? Mark STALE in STATE.md's freshness table with the dependency that
staled it. Staleness is mechanical, not judgmental: a stale artifact may still be correct, but
nobody knows until its owner re-derives or re-affirms it, and the mark is what forces that
decision to happen visibly.

### 3. Provenance audit
Sample-based between gates, exhaustive before them:
- Untagged claims in any artifact (GUARDRAILS 1 violations); each one is fixed or removed.
- (asserted) claims sitting where (confirmed) is required (behaviour-constraining entries,
  ERD lifecycle, status mapping): each is either on the open-items list with an owner, or it
  is a defect.
- [LLM] (inferred) content outside its quarantine zones (open-questions, research notes,
  draft prompts): always a defect.
- Assumption-register integrity: every artifact with an ASSUMPTIONS box lists live register
  IDs; every register entry past its decision date is escalated.

### 4. Drift check
The direct document-versus-artifact comparison, per layer:
- Refined requirements vs the anchor document: every superseded [DOC] commitment appears as
  an entry with a Correction and rationale (supersession is explicit, never silent omission).
- Flows and breakdown vs refined requirements: the orphan checks both ways (to-be-design and
  process-breakdown own these; this sweep verifies they ran and spot-checks results).
- ERD vs breakdown: the state-machine check in both directions.
- Hi-fi vs everything: status mapping vs ERD; spec copy vs glossary; screen states vs status
  lists; content vs dummy-content shape rules.
- Glossary vs all artifacts: the collision scan (terms used that do not exist, entries that
  drifted from usage).

## The conformance snapshot

The output artifact, filed at `90-handoff/../STATE-adjacent` as
`{workspace}/conformance/{date}-snapshot.md` (keep the last three; archive older):

1. **Headline**: CLEAN / FINDINGS ({n}) / BLOCKING ({n}), one line each for the four sweeps.
2. **Findings table**: finding | sweep | severity (blocking / major / minor) | owner | due.
   Blocking means a gate cannot honestly be held until resolved (unknown staleness, ghost
   behaviour in a signed artifact, (asserted) where (confirmed) is required at a gate
   boundary).
3. **Metrics strip**: orphan count, ghost count, stale count, open assumptions past due,
   unverified rule-bearing terms, Type B count this phase by Phase 1 topic. Trend arrows
   against the previous snapshot.
4. **Freshness table update** pushed to STATE.md in the same action.

## Cadence

| Trigger | Scope |
|---|---|
| End of each phase | Full snapshot |
| Before each gate (readiness pre-check input) | Full snapshot; gate-review consumes it |
| After every Type B lands | Staleness sweep + affected matrix rows |
| Weekly during Phase 2B and 3 | Traceability + staleness sweeps |
| On demand (/verify) | Caller chooses; default full |

The cadence is the monitoring the process promises: not a person remembering to check, but a
standing rhythm whose skipping is itself visible (a snapshot older than its cadence is a
finding in the next snapshot).

## Procedure
1. Establish or load the matrix; on first run, build it from refined-requirements and the
   existing citations (expect a wave of NOT-YET links early in 2B; that is honest, not
   alarming).
2. Run the sweeps in order (traceability, staleness, provenance, drift); each feeds the next.
3. Classify findings; assign owners (the owning agent per CLAUDE.md's routing table; never
   "the team").
4. Route: structural findings (ghost rules, silent supersessions, status mismatches) are
   Type B candidates via requirements-reconciler; surface findings go to the owning agent
   directly.
5. Write the snapshot; update STATE.md freshness and metrics in the same action.
6. Report the headline to the orchestrator; BLOCKING findings are announced, not filed
   quietly.

## Deciding factors
- Proportionality: a minimum_set project runs the same sweeps over fewer artifacts; the
  matrix has fewer columns, never fewer rows.
- Do not let the matrix become the work: it is an index of citations that must already
  exist. If maintaining it requires inventing links, the real defect is uncited artifacts,
  and that is the finding.
- Severity honesty: blocking is reserved for what genuinely blocks (the gate-integrity
  cases); inflating severity to get attention burns the mechanism's credibility exactly as
  S4-flooding burns a critique's.

## Probing prompts (self-audit of the evaluation itself)
- "Which artifact has not appeared in any finding for two snapshots?" (Either it is clean or
  the sweeps do not really read it; sample it to find out which.)
- "Which owner has the most open findings, and is that a workload problem or a process
  problem?"
- "If the DA read the metrics strip, what would they ask about first?"
- "What drifted that no sweep is designed to catch?" (Extend the drift check when the answer
  is not 'nothing'.)

## Quality bar (self-evaluation)
- Snapshot produced on cadence; the previous snapshot's findings all have dispositions
  (resolved / owned-with-date / escalated), none silently dropped.
- Matrix diff explained: every vanished link accounted for.
- STATE.md freshness table matches the snapshot (one source of truth, updated same action).

## Guardrails
- This skill reports and routes; it never fixes. Fixing happens through the owning agents
  and, for structural items, through the reconciler (CLAUDE.md section 6). An evaluator that
  edits artifacts destroys the independence that makes its findings trustworthy.
- Findings are evidence-based: every finding cites the two things that disagree. "Feels
  off" belongs in design-critique, not here.
- The snapshot never blocks on its own authority; it informs gates and the orchestrator,
  who block per the standing rules.

## Output
- `{workspace}/conformance/{date}-snapshot.md` (headline, findings, metrics, trends)
- `60-requirements/traceability.md` (the matrix, current)
- STATE.md freshness table and metrics updates
- Routed findings with owners

## Exit criteria (per run)
- All four sweeps run (or the on-demand subset named); findings classified, owned, routed;
  snapshot filed; STATE updated

## Failure modes
- Matrix theatre: a beautiful spreadsheet maintained by hand-invention over uncited
  artifacts, giving false confidence at exactly the moments that matter.
- Cadence decay: snapshots slipping from weekly to "before gates" to never, and the gate
  discovering three weeks of accumulated drift at attendee prices.
- Severity inflation: everything blocking, nothing believed.
- Evaluator capture: the evaluation run by the same agent whose artifacts it checks, findings
  softening accordingly; keep it with gate-reviewer, whose role is already adversarial.
