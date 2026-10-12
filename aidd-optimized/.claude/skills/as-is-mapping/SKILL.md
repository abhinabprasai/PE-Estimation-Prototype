---
name: as-is-mapping
description: "Maps how the work happens today: visibility layers, wait accounting, variants, and the pain index that the target process must beat. Use in Phase 2A once transcripts or a product audit describe a current process."
---

# As-Is Flow Mapping

## Purpose
Documentary, not aspirational: the record of the current process including everything
embarrassing about it. The workarounds ARE the findings, the handoffs between systems are where
most of the pain lives, and the as-is is the baseline every to-be is argued against. A to-be
without a mapped as-is is a description nobody can evaluate; beside its as-is it is a proposal
with a visible delta (to-be-design depends on this pairing).

The mapping borrows the load-bearing idea from service blueprinting: separate what the
requester experiences from the work that happens out of their sight. The line between those two
layers is where waiting happens, where status questions pile up, and where most of the design
opportunity sits.

## Inputs
- `10-discovery/transcripts/` (the PROCESS-group answers, observation-session notes)
- `problem-statements.md` (workarounds column; every problem must land on a flow row)
- anchor-analysis Processes + Silences (BEFORE/AFTER silences bound each flow)
- Modernize engagements: the existing build itself, walked and screenshotted per
  spec-intake's product-audit table

## Per-flow capture (one file per goal, `40-models/as-is/{goal}.md`)

| Field | What to record |
|---|---|
| Trigger | What starts the process, and how the actor learns it started |
| Step | One action per row, in order; one row per decision or data change |
| Actor | Who performs it (role, not name) |
| System | Where it happens (product, spreadsheet, email, paper, phone, head) |
| Layer | VISIBLE (the requester/customer sees or does this) or BACKSTAGE (work they never see). Mark the crossings; each crossing is a status-communication moment, done well or badly |
| Data movement | Re-keyed? exported? copied by hand? mark every manual move |
| Wait | Does the process stop for a person here? Typical and worst-case duration if known |
| Error handling | Is a mistake here caught? By whom, when? Or does it flow through silently? |
| Evidence | The physical or digital thing this step touches or produces (form, email, report). Real artifact examples beat descriptions; reference them |
| Tag | Provenance of this step's description |

Flow-level fields at the top of each file: goal, requester (whose need starts it), frequency
and volume (typical and peak), variants (see below), and the pain index (see below).

## Procedure

1. **Draft from transcript evidence**; every step tagged. A step nobody described is [LLM]
   (inferred): it goes to open-questions as "does step X exist between Y and Z?", never
   silently into the flow. Gaps in the story stay visible as gaps.
2. **Layer pass**: mark every step VISIBLE or BACKSTAGE from the requester's point of view, and
   flag every crossing. At each crossing ask: how does the requester learn the state changed?
   "They phone us to ask" is one of the most common and most valuable findings in this pass.
3. **Mark the pain**: highlight rows where problem-statements attach, with the problem IDs.
   The flow and the problem set must reconcile both ways: a problem with no home row means a
   missing step; a dreadful-looking row with no attached problem means either the team
   normalized it (ask) or it is not actually painful (also ask).
4. **Do NOT tidy.** Loops, redundant approvals, the same data entered three times: keep them
   visible. A neat as-is is usually a wrong one.
5. **Cross-system handoff pass**: for each change of System between consecutive rows, run the
   handoff probes (below). These seams are where the to-be will earn its keep.
6. **Wait accounting**: sum the waits versus the touch time. Most operational processes are
   overwhelmingly wait; knowing the ratio per flow tells to-be design where the time actually
   goes, and protects it from optimizing touch time that was never the problem.
7. **Variant mapping**: where multiple versions of the process exist, map the most common
   end-to-end, then list variants with their trigger conditions ("when the supplier is
   foreign...", "at quarter-end...") rather than forcing one diagram to hold all. A variant
   whose condition nobody can state precisely is an open question.
8. **Pain index**: close each file with the rollup: count of manual data movements, count of
   uncaught-error rows, total typical wait, count of layer crossings with no status
   communication, count of systems touched. These numbers are the before-column of
   ux-flow-optimization's cost table and the baseline the to-be must beat.
9. Keep it visibly rough for Gate 1 (GUARDRAILS 12): correction is the goal.

## Modernize variant (the build is the source)
- Walk each flow in the real system as each role, screenshotting every step into
  `00-inputs/audit/`.
- The build gives you steps and systems; it cannot give you waits, workarounds, or the
  spreadsheet beside the keyboard. Those come only from observation and interviews; a
  build-only as-is is systematically flattering and must be marked as such.
- Note where the build's enforced sequence differs from what people say they do; those
  differences are workarounds in the making or dead process the design can drop.

## Deciding factors
- Granularity: one row per decision or data change. "Processes the invoice" is too coarse;
  keystroke-level is too fine. The test: could a new hire execute the step from the row alone?
- Flow boundaries come from the goal, not the org chart: a flow ends when the requester's need
  is met, even if that crosses three departments. Cutting flows at department edges is how
  handoff pain escapes every diagram.
- When observation and interview disagree, record both, tagged; observed behaviour is
  (asserted) evidence of practice, interview answers are (asserted) evidence of intent, and
  the difference between them is a finding.

## Probing prompts (for the DA, per flow)
- "Where in this does someone keep a personal spreadsheet or notebook the official process
  does not know about?"
- "Which step do new people get wrong first?"
- "When this handoff fails, how long until someone notices, and who eats the cost?"
- "What happens to this flow at month-end / audit / peak load?"
- "While you wait at this step, does the requester know where things stand? How?"
- "Which of these steps exists only because of a mistake someone made years ago?"

## Quality bar (self-evaluation)
- Both reconciliation directions run: every problem statement lands on a row; every
  pain-marked row cites a problem ID.
- Every step has all nine step-level fields (Trigger is per-flow) or an explicit gap marker; zero silently-inferred bridging
  steps.
- Wait accounting and pain index computed per flow.
- Variants listed with trigger conditions, not merged into one impossible diagram.

## Guardrails
- Documentary discipline: no improvement suggestions in as-is files; park them in
  solution-hypotheses.
- Every step tagged; inference is quarantined to open-questions.
- Real artifacts referenced, never copied into mockups (GUARDRAILS 7 applies downstream).

## Output
- `40-models/as-is/{goal}.md` per goal: capture table, layer markings, pain markers with
  problem IDs, variants, wait accounting, pain index

## Exit criteria
- Every problem statement reconciles to at least one flow row, and vice versa
- Every flow reviewed by the DA at Gate 1 (corrections expected; a nod is a warning)

## Failure modes
- Tidied flows that get nodded at and correct nothing.
- Inferred bridging: gaps in the story filled by plausibility instead of questions.
- Org-chart flows: maps cut at department boundaries, hiding exactly the handoffs that hurt.
- Build-trusting on modernize: the audit-derived flow mistaken for the real process, missing
  every workaround, and the new system rebuilding the old system's fictions.
