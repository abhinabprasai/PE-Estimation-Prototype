---
name: process-breakdown
description: "Writes the rule layer developers build against: testable rules citing a requirement, mandatory exception rows, and three cross-checks against the entity model. Use in Phase 2B on rule-dense projects."
---

# Process Breakdown

## Purpose
Where the flow shows sequence, the breakdown shows rules. This is the artifact that prevents
the majority of build-time clarification requests, and with the ERD it is what developers
actually build against. Its quality metric is external and measurable: the count of build-time
questions whose answer was already in the breakdown should approach the count of build-time
questions (md-spec-loop tracks this number across projects).

## Per-step row (templates/process-step.md)

| Field | Content |
|---|---|
| Step | what happens, one action |
| Actor | who or what performs it |
| System | where |
| Input | what must exist beforehand (data, state, permission), named against ERD attributes |
| Output | what exists afterwards (data created/changed, status transitions), named against ERD attributes and status values |
| Rule | what must be true for the step to be valid, REQ-ID cited |
| Exception | what happens when the rule is not met: blocked? queued? overridden by whom? and the state the record is left in |
| Downstream | what this changes elsewhere (other entities, notifications, reports, other flows' Inputs) |

## Rule column discipline

- Every rule cites a REQ-ID or an ERD constraint. A rule you cannot cite is either missing
  upstream (send to reconciler) or invented (delete).
- Rules are written testably: a reader can construct the passing case and the failing case
  from the row alone. "Amount must be valid" is not a rule; "amount > 0 and <= remaining
  balance of the linked PO (REQ-FIN-012)" is.
- Where a rule has a tolerance or a threshold, the value is in the row, not in someone's
  head, and its provenance is the REQ entry's.
- Client-side versus server-side enforcement is stated where it matters (interaction-design
  consumes this split for validation timing; the server is always authoritative).

## Exception column discipline

Mandatory per row, not per section. "N/A" requires a reason ("input guaranteed by step 3's
output"). Each exception answers four things: what blocks or diverts, who handles it, what
state the record is left in (an ERD status, not "flagged"), and where the flow resumes.
Exceptions that route to a human must land in that human's userflow (userflows-sitemap
cross-check); exceptions that create new statuses go through data-modeler, never invented
inline.

## The three cross-checks (what makes the breakdown load-bearing)

1. **State-machine check, against the ERD.** Collect every status transition appearing in any
   Output column. Each must exist in the ERD's closed lists with a matching trigger and
   permission. Then invert: every ERD transition must be produced by some step somewhere, or
   be explicitly marked as out of the modelled processes' scope. Mismatches in either
   direction are Type B candidates for data-modeler. This inverse direction is the one that
   catches status leakage before Phase 3 turns it into missing screens.
2. **Coupling pass, whole-document, last.** For each Output, search other flows for steps
   whose Input it satisfies or breaks. Undeclared coupling found here is cheap; found in build
   it is not. Record discovered couplings in both rows' Downstream columns, so neither flow
   can be changed in ignorance of the other.
3. **Permission check.** Every Actor performing a step must hold the permission the ERD matrix
   grants for that action. A step the matrix forbids is a contradiction with an owner, not a
   drafting detail.

## The two-developer test

Per section, before Gate 2: "which row would two developers implement differently?" For each
candidate row, tighten the Rule until the divergence closes. This is the cheapest hardening
pass available, and it is also the right preparation for the developer's Gate 2 read: rows
that survive the test read as specifications; rows that fail it read as intentions.

## Depth control

- Required or optional: rule_density high, or any flow with 2+ roles, or any status machine
  present -> required. Pure content/presentation flows -> optional, say so in STATE.md.
- Prioritized processes get full rows; unprioritized ones get Step/Actor/System only, marked
  THIN, upgradeable if promoted. A THIN section is a recorded decision, not neglect.
- Sequence lives in the flow; law lives here. If a row is restating the flow's ordering
  without adding Input/Output/Rule content, it is padding; developers read the pair together
  (flow for shape, breakdown for law), so duplication is cost, not safety.

## Procedure
1. One breakdown section per to-be flow, one row per step, same ordering, paired filenames.
2. Fill rows with the Rule and Exception disciplines; name Inputs and Outputs against ERD
   attributes as you go (vagueness here is where the state-machine check later fails).
3. Run the three cross-checks; route mismatches (data-modeler for status/permission, the
   reconciler for missing rules).
4. Run the two-developer test per section; tighten failing rows.
5. Book the developer read-through; their questions are findings (each one marks a row that
   failed in the wild), and their acceptance is a Gate 2 exit criterion.

## Deciding factors
- Calculation-heavy steps: the formula belongs in the row (or an appendix the row points at),
  with worked examples including the boundary cases. "System calculates the fee" is a
  clarification request with a due date.
- Notifications are Downstream entries with a recipient and a trigger, not a general "user is
  notified"; who, about what, through what channel, and can they turn it off.
- Batch and scheduled steps: the schedule, the batch boundary, and what happens to records
  that miss the batch are all Rule/Exception content; month-end lives here.

## Probing prompts (per section, before Gate 2)
- "Which row would two developers implement differently?"
- "Which Exception routes to a human? Does that human's userflow include receiving it?"
- "Pick a row at random: can I name the exact ERD attributes its Input reads and its Output
  writes?"
- "Which Downstream entry would surprise the owner of the flow it touches?"
- "Where does this section hide a calculation nobody has written down?"

## Quality bar (self-evaluation)
- Zero uncited rules; zero reason-less N/A exceptions.
- All three cross-checks run with results filed; the state-machine check run in both
  directions.
- Two-developer test run per section, with the rows it tightened listed.
- Every prioritized process fully rowed; THIN sections declared in STATE.md.

## Guardrails
- No uncited rules; the breakdown asserts nothing on its own authority.
- Exceptions that create new statuses go through data-modeler, never invented inline.
- The breakdown never contradicts the ERD; where it wants to, one of them is wrong and the
  conflict routes as Type B.

## Output
- `40-models/process-breakdown.md`, sectioned per flow, cross-checked, developer-read

## Exit criteria (Gate 2)
- Every prioritized process fully rowed; all cross-checks clean or routed; developer has read
  it and their acceptance is recorded

## Failure modes
- Sequence duplication: the breakdown restates the flow and specifies nothing.
- Exception hand-waving: "show an error" rows that each become a build-time question.
- Unwritten calculations: the formula that existed only in the DA's spreadsheet, discovered
  during UAT.
- Coupling blindness: two flows writing the same entity with different assumptions, found in
  production as data corruption with two innocent authors.
