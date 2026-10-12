---
description: "Report current phase, blockers, gate state, artifact freshness, and the next three actions"
---
Produce the AIDD status report for the current project:

1. Read STATE.md and PROJECT_CONFIG.md.
2. Report: current phase and mode; next gate and its unmet exit criteria (pull them from
   the relevant gate command file); open blockers; open contradictions without owners;
   rework-log count by Phase 1 topic (flag any topic at 2, escalate at 3).
3. Run the freshness check against CLAUDE.md section 5 and list stale artifacts with the
   dependency that staled them.
4. Read the latest conformance snapshot ({workspace}/conformance/): report its headline,
   its age against the cadence (CLAUDE.md 7a), and any BLOCKING findings verbatim. If the
   snapshot is overdue, the first proposed action is /verify.
5. End with the next three concrete actions, each with its owning agent.
Keep it under a screen; this is a standup, not a report.
