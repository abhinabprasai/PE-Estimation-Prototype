# 80-gates/: the only mechanism that stops work progressing

Owners: gate-reviewer (the gate), design-critic (the pre-gate critique).

```
pre-gate-{n}-critique.md    design-critique report, run before the gate
gate-{n}-report.md          the filed record; no report, no pass
```

## Attendance, before agenda

| Gate | Required |
|---|---|
| Problem confirmation (P1 exit) | Written confirmation from the domain authority |
| Gate 1 | Domain authority + product owner |
| Gate 2 | Those plus at least one developer |
| Gate 3 | Internal team, then client validation is scheduled |

Anyone required missing means the gate is NOT HELD, recorded as such, rescheduled. No authority
overrides this (GUARDRAILS 5).

## Every gate produces three things

A held-or-not-held fact, a classified correction list, and a filed report. Nothing else counts.

## Classification, at the gate, not later from memory

**Type A** (surface): a screen, a flow drawing, wording, layout. Patched in place, noted in STATE.
**Type B** (structural): a rule, entity, status, permission, or requirement. Routes to
requirements-reconciler FIRST, dependents stale-marked, rework-log row written. **When unsure, it
is Type B**; the cost asymmetry decides.

Three Type Bs tracing to one Phase 1 topic means Phase 1 converged too early on that topic:
escalate with a recommendation to re-open that topic specifically, not the whole phase.

## Reading the outcome

Heavy correction at Gate 1 is success; the instrument worked. Little correction is a warning, not
a pass: either the set was too safe to test anything, or the reviewer is being polite. Probe
before accepting a quiet result, and record in the report that the probes were run.

## Also read aloud at every gate

The assumption register: what is still assumed, its blast radius, whose decision is outstanding.
A register that has not shrunk since the last gate is itself a finding.

Delete this file once the folder holds real reports.

---

**Key.**
**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
