---
description: "Run Gate 3 (internal final design review plus ERD reconciliation) via gate-reviewer"
---
Run Gate 3 for the current project. Delegate to gate-reviewer with the gate-review skill.

Pre-checks:
- Internal attendees only; every in-list feature's spec has all NINE blocks (no DRAFT headers)
- State enumeration table complete per feature: every cell specified or proved unreachable
- hifi-spec's self-reconciliation note (status mapping vs ERD) filed
- `/design-qa` run at the full seven-lens set, report attached, zero open S1 findings (or each
  declared with its owner in the gate's first two minutes)
- Accessibility testing ladder run with methods and dates recorded; any exception listed with a
  rationale and an owner
- Real copy in every screen state; no placeholders
- `usability-testing` round run on every prioritized flow whose cost table claims an improvement:
  report filed at `70-hifi/usability/`, zero open S1 or each declared with an owner. Where users
  were unreachable, the DA substitution is stated in the gate's first sentence and R-SME-SUB is
  listed as still open
- Predicted versus observed recorded per tested flow, including where the prediction was wrong
- `70-hifi/{feature}/concepts.md` present for every in-scope screen: three concepts, winner
  marked, one line per loser naming the criterion it lost on. A single composition arrived at
  directly is a first idea specified well
- `/verify` run and current: every prioritized REQ-ID has a hi-fi link in the traceability
  matrix, zero GHOST behaviour in the specs, no unresolved BLOCKING findings

Protocol:
- Line-by-line: each spec against its REQ-IDs in refined-requirements.md
- Independent re-run of the status-mapping-vs-ERD reconciliation (values, triggers,
  permissions, irreversibility)
- Independent re-run of critique lenses 3, 4 and 7 (state completeness, accessibility, domain
  fidelity). These three are where a self-critique is least reliable, because they require
  reading the ERD rather than looking at the screen
- Read the usability round's task-by-participant grid aloud before the line-by-line. A gate that
  reviews specs without knowing which tasks failed is reviewing the wrong thing first
- Spot-check one concepts file: read the three one-sentence statements. If two are the same
  sentence, the round produced variations rather than concepts and the decision is not yet made
- Assumption register read aloud; anything still open is listed in the report
- Corrections classified; Type B routed via the reconciler before spec edits

Exit criteria:
- Reconciliation clean; requirement check clean or corrections owned
- Zero open S1 design findings, or each declared, owned and dated
- gate-3-report.md filed; STATE updated
- Post-gate verification scheduled within the week

On pass: schedule client validation (handoff-manager); Gate 3 unlocks scheduling, not
shipping.
