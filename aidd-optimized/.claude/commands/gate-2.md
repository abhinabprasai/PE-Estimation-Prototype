---
description: "Run Gate 2 (validate all artifacts, model first, developer present) via gate-reviewer"
---
Run Gate 2 for the current project. Delegate to gate-reviewer with the gate-review skill.

Pre-checks (block if any fail):
- Attendees: domain authority + product owner + at least one developer
- refined-requirements.md: zero owner-less open items; behaviour-constraining entries
  all (confirmed)
- ERD complete with lifecycle + consequences note; developer review booked
- process-breakdown rows complete for prioritized processes; to-be pairs ready;
  ia.md written with its validation results; userflows + sitemap cross-checked
- flow-optimization cost tables exist per prioritized flow, with as-is baselines and the
  Type A / Type B split already routed
- prioritized-features.md drafted with method recorded
- `60-requirements/measurement-plan.md` drafted: three to five outcomes, one number each, where
  that number stands today with its source, a target with a by-when, and the number that must not
  move. Baselines measured from the running system where that is possible, not recalled
- Every optional-partition requirement names the outcome it serves, or is listed as unmapped
- assumption register: zero open entries whose blast radius touches a rule, a status, a
  permission or a lifecycle property (GUARDRAILS 10)
- `/verify` run and current: no unresolved BLOCKING findings, no GHOST behaviour inside an
  artifact about to be signed, no unknown staleness
- process-breakdown's three cross-checks run and filed (state machine in BOTH directions,
  coupling pass, permission check), and the two-developer test run per section
- `/design-qa` run at the pre-Gate 2 lens set (2, 4a, 5a, 6, 7), report attached
- The verified contrast table exists in `skills-md/color.md` with real values for both themes

Review order enforced: refined requirements, ERD, breakdown, to-be pairs, flow-optimization
deltas, IA, userflows, sitemap. Screens last. Give the developer the two-developer-test results
as their reading guide.

Present the pain-index deltas (to-be versus as-is) per flow. A to-be that does not beat its
baseline is discussed as a finding, not hidden.

Exit criteria:
- Developer acceptance of the ERD recorded; breakdown read by the developer
- Prioritized list agreed IN WRITING by PO + DA (fixed-bid: marked LOCKED), with the mandatory
  partition audited against its authority classes and the completeness pass run including
  exception paths
- Measurement plan signed by PO and DA alongside the list: the outcomes are the ones the business
  wants, and the current numbers are right
- Corrections classified/owned; Type B routed; report filed; STATE updated
- Throwaway prototype confirmed archived
- Post-gate verification scheduled within the week

On pass: set phase 3; hifi-spec-designer starts from the list and the consequences note.
