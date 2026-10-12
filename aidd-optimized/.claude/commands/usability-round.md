---
description: "Run a usability round on the prioritized flows: task construction, sessions, scoring, and routing into the Type A/B machinery"
---
Run a usability round for $ARGUMENTS (a feature, a flow, or "all prioritized"). Delegate to
design-critic with the usability-testing skill.

Pre-checks (block and report which fail):
- Gate 2 passed; the prioritized list is signed
- `/design-qa` run at the full lens set with zero open S1. Sessions spent finding a missing empty
  state are sessions wasted
- A clickable artifact exists for each flow's primary path plus its two most consequential
  exception paths
- `dummy-content` populated. In this domain participants read the data before the interface
- Participants recruited: five per role, operators not proxies, who performed the task in the
  last two weeks. Shortfalls are named now, not in the report

Protocol:
- Tasks are goals with the real source artifact in hand, three to five per session, the
  highest-consequence flow second, at least one exception path per session
- Two people: a moderator who watches the participant, a notetaker who watches the screen
- Do not help. Wait, then "what are you looking for?", then "what would you do if I were not
  here?" Record every rescue
- Debrief with the notetaker after each session, not at the end of the day

Scoring and routing:
- Record per task: completed unaided / with a prompt / **completed wrong** / abandoned; time;
  first click separately from destination; errors; verbatims
- "Completed wrong" is scored more severely than an abandonment. It is the defect that reaches
  production, gets repeated daily, and is found by an audit
- Two or more wrong completions, or unaided success below 3 of 5, is S1
- Anything a participant says about how the work actually happens that contradicts the flows is
  **Type B (a rule change)** and routes to requirements-reconciler before any screen changes
- Three or more S1/S2 on one flow means the flow's structure is wrong: re-open that flow's
  optimization, the same way three Type Bs on one Phase 1 topic re-opens that topic

Exit criteria:
- Every prioritized flow whose cost table claims an improvement has been attempted by an operator
- Report filed at `70-hifi/usability/{round}-{date}.md` and attached to the pre-Gate-3 critique
- Every Type B routed before any screen changed
- Predicted versus observed added to each tested flow's cost table
- STATE design quality record updated

A round with no failures is a warning, not a pass. Probe before accepting it, and record the
probes you ran.
