---
description: "Process a correction from any source through the Type A/B classification and routing machinery"
---
Process this correction: $ARGUMENTS

Corrections arrive from anywhere: a gate, a design critique, client validation, a refuted
assumption, or a conformance finding. All of them route through this same machinery.

1. Delegate classification to gate-reviewer: TYPE A (screen/flow/wording/layout) or
   TYPE B (rule/entity/status/permission/requirement). When unsure, Type B; the cost
   asymmetry decides. A refuted assumption register entry is Type B by default, and its
   blast radius is already written in the register.
2. TYPE A: route to the owning agent (CLAUDE.md section 4) to patch in place; STATE note; done.
3. TYPE B: route to requirements-reconciler FIRST, before any artifact is touched. Sequence:
   entry located or created; Correction and Resolved updated; rationale written (naming the
   tiebreaker, not "the DA said so"); version bumped; the entry's dependency links walked to
   find every dependent; dependents stale-marked per CLAUDE.md section 5; owning agents
   notified to re-derive rather than patch; rework-log row written with the Phase 1 topic.
4. Run the staleness sweep (`/verify stale`) after the marks are written. The conformance
   cadence requires it after every Type B, and it catches dependents the links missed.
5. Check the rework-log: if this makes three Type Bs on one Phase 1 topic, escalate with a
   recommendation to re-open that topic specifically, not the whole phase (CLAUDE.md 6).
6. Report what was touched, what is now stale, the regeneration order, and which agent owns
   each regeneration.
