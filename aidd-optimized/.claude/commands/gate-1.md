---
description: "Run Gate 1 (validate prototype and other artifacts) via gate-reviewer with attendance and exit-criteria enforcement"
---
Run Gate 1 for the current project. Delegate to gate-reviewer with the gate-review skill.

Pre-checks (block the gate if any fail, report which):
- Attendees confirmed: domain authority + product owner
- The set is assembled: prototype + prompt-used.md, as-is flows, tentative ERD, tentative
  sitemap/to-be/userflows, kb-index current
- Phase 1 written confirmation exists (or, on a no-spec project, the derived brief's signature
  status is stated out loud in the gate's first sentence)
- `/verify` run and current: no unresolved BLOCKING findings, no unknown staleness. A gate on an
  unknown state reviews artifacts that may already disagree with each other
- `/design-qa` run at the pre-Gate 1 lens set (1, 3, 6, 7 only; the tentative set is built to be
  rough and polishing it defeats the mechanism), report attached, zero open S1 or each declared
- The 2A style seed exists: five files (`tokens.md`, `type.md`, `layout.md`, `color.md` with the
  status sketch marked TENTATIVE, `a11y.md`), each headed SEED. A seed that has grown into a full
  system is a finding, not diligence: it was authored against an entity model this gate is about
  to correct
- Assumption register read and ready to be read aloud: what is assumed, its blast radius, whose
  decision is outstanding
- The tentative set's open-questions boxes collected into the agenda's second half: the team
  asked for specific rulings, and this gate is where they get ruled

Exit criteria (all required to pass):
- The six Gate 1 questions asked; corrections captured, tagged, classified A/B, owned
- Quiet-review handling applied if correction volume was low (probes run and recorded)
- Type B corrections routed to requirements-reconciler; rework-log rows written
- Prototype + prompt archived to 50-prototype/ARCHIVED/ (unless designer_engagement=demo)
- gate-1-report.md filed in 80-gates/; STATE gate record updated; written sign-off
  tracked (passed-pending-written until it arrives)
- Post-gate verification scheduled within the week: every routed Type B produced its reconciler
  entry and stale marks, every Type A was patched or scheduled. Corrections that evaporate teach
  everyone that gates are theatre

On pass: set phase 2B, announce the reconciliation as the next action.
