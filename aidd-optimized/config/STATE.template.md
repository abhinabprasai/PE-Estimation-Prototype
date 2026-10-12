# STATE - {project name}

The live process tracker. The orchestrator reads this at session start and every agent
updates it when an artifact changes. Keep entries one line each; this is a ledger, not a
journal.

## Position

```yaml
phase: "0"            # 0 precondition | 1 | 2A | 2B | 3 | handoff | closed
next_gate: ""         # gate-1 | gate-2 | gate-3 | client-validation | none
blockers: []          # short strings; empty means clear to proceed
```

## Gate record

| Gate | Held on | Attendees | Result | Report |
|---|---|---|---|---|
| Problem confirmation (P1 exit) | | | | 10-discovery/problem-statements.md |
| Gate 1 | | | | 80-gates/gate-1-report.md |
| Gate 2 | | | | 80-gates/gate-2-report.md |
| Gate 3 | | | | 80-gates/gate-3-report.md |
| Client validation | | | | 90-handoff/walkthrough-notes.md |

## Artifact freshness

Mark STALE when a dependency changed after last edit (dependency order: CLAUDE.md section 5).

| Artifact | Last edited | Status |
|---|---|---|
| 00-inputs/PRD.md | | |
| problem-statements.md | | |
| kb-index.md | | |
| refined-requirements.md | | |
| erd.md | | |
| process-breakdown.md | | |
| flow-optimization/ | | |
| ia.md | | |
| userflows/ + sitemap.md | | |
| style-guide.md + skills-md/ | | |
| prioritized-features.md | | |
| status-mapping.md | | |
| as-is/ | | |
| to-be/ | | |
| glossary.md | | |
| 00-inputs/assumptions.md | | |
| 60-requirements/traceability.md | | |
| 70-hifi/ (all feature specs) | | |

Two staleness paths that are easy to miss: a change to the ERD's status list stales the status
encoding map, every component state matrix that displays it, and every hi-fi screen state derived
from it. A change to ia.md stales every userflow, the sitemap and the route scheme.

## Assumption register summary

Source: `00-inputs/assumptions.md`. Read aloud at every gate. A register that has not shrunk
between two consecutive gates is escalated (GUARDRAILS 9.13).

| Gate | Open | Confirmed | Refuted | Blocking (rule/status/permission/lifecycle) |
|---|---|---|---|---|
| Gate 1 | | | | |
| Gate 2 | | | | |
| Gate 3 | | | | |
| Handoff | | | | |

## Design quality record

Lenses: 1 hierarchy - 2 consistency - 3 state completeness - 4a accessibility (tokens, at Gate 2)
- 4b accessibility (screens, at Gate 3) - 5a terminology (at Gate 2) - 5b copy (at Gate 3)
- 6 flow friction - 7 domain fidelity.

| Gate | Critique run | Lenses | Open S1 | Ladder rungs run (of 4) | Exceptions recorded |
|---|---|---|---|---|---|
| Gate 1 | | 1, 3, 6, 7 | | | |
| Gate 2 | | 2, 4a, 5a, 6, 7 | | | |
| Gate 3 | | all seven | | 1-4 | |

### Concepts

| Feature | Screens in scope | Concepts filed | Winner recorded with its criterion | Merges (must be zero) |
|---|---|---|---|---|
| *invoice-approval* | *2* | *6* | *yes* | *0* |

### Usability rounds

| Round | Date | Roles | Participants | Tasks | Unaided success | Completed wrong | DA stood in? |
|---|---|---|---|---|---|---|---|
| *1* | *2026-04-02* | *clerk, approver* | *10* | *4* | *31 of 40* | *2* | *no* |

**Completed wrong** is the column to read first: a participant who believes they succeeded and did
not is a defect that reaches production, gets repeated daily, and is found by an audit.

### Predicted versus observed

The cost tables made a claim. This is where it is checked. A prediction that was wrong is worth
more than one that was right, because it is the only way the estimate improves.

| Flow | Predicted (decisions / inputs / waits / navigations / recalls) | Observed | Note |
|---|---|---|---|
| *raise a variance* | *4 / 6 / 1 / 3 / 0* | *4 / 9 / 1 / 5 / 2* | *supplier code is not to hand; we assumed it was* |

### Craft register

| Open SC | Confirmed by a round | Contradicted by a round | Surfaces at 3+ SC (back to concepts) |
|---|---|---|---|

## Outcome record

Source: `60-requirements/measurement-plan.md`. Signed at Gate 2, read at the date below.

| Outcome | The number | Where it is today | Target (by) | Built into | Owner | Read at | Actual |
|---|---|---|---|---|---|---|---|
| *OUT-1 variances resolved same day* | *share resolved within 24h* | *31%* | *80% by Sept* | *invoice-approval* | *Priya* | *2026-12-01* | |

## Conformance record

Source: `conformance/{date}-snapshot.md`, produced by process-evaluation on its cadence
(CLAUDE.md 7a: phase end, pre-gate, post-Type-B, weekly in 2B/3). A snapshot older than its
cadence is itself a finding.

| Date | Trigger | Headline | Orphans | Ghosts | Stale | Blocking | Snapshot |
|---|---|---|---|---|---|---|---|

## Rework log (Type B only)

| Date | Correction | Source | Phase 1 topic it traces to | Artifacts regenerated |
|---|---|---|---|---|

## Risks

| ID | Risk | Raised | Status |
|---|---|---|---|
| R-SME-SUB | SME standing in for end users on a user-facing product | | |
| R-NO-SPEC | No supplied spec; running on a derived brief, unsigned as of {date} | | |
| R-DEVICE | Device and environment per role unknown; desktop assumed | | |
| R-A11Y | Accessibility obligation beyond AA unknown or unconfirmed | | |

## Open contradictions

| # | Statement A (tagged) | Statement B (tagged) | Owner | Due |
|---|---|---|---|---|

---

**Key.**
**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**S1** blocker - **S2** major, harms the task - **S3** minor - **SC** a craft judgment stated as a prediction, which goes to the next user session rather than to a fix - **S4** a preference, recorded and dropped.
