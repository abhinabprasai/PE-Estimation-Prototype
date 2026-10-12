---
name: gate-review
description: "Runs a gate: attendance, readiness pre-checks, the probing questions, reading a quiet result, classifying every correction, and the filed report. Use whenever a gate is requested or a review outcome needs processing."
---

# Gate Review

## Purpose
Gates are the only mechanism that stops work progressing; this skill makes them mean
something. A gate produces three things: a held-or-not-held fact, a classified correction
list, and a filed report. Nothing else counts as a gate. The gate is also the system's
monitoring checkpoint: it is where conformance between what the documents require and what
the artifacts contain is verified by humans with authority, which is why its integrity rules
are absolute.

## Readiness pre-check (before scheduling, not at the gate)

Run the gate's pre-checks from its command file plus the standing set:
- The pre-gate critique has run (design-critique, the lenses that gate requires) with zero
  open S1 findings, or the S1s declared.
- The conformance snapshot is current (process-evaluation's traceability and staleness
  checks); a gate entered with unknown staleness is a gate reviewing artifacts that may
  already disagree with each other.
- The assumption register summary is prepared for reading aloud (spec-intake's disclosure
  rule).
- KB health audit run (knowledge-base) where the gate is 1 or 2.

A failed pre-check delays the gate. Holding a gate on unready artifacts converts expensive
attendee time into a list of things the team already knew.

## Universal protocol (all gates)

1. **ATTENDANCE FIRST.** Gate 1: DA + PO. Gate 2: DA + PO + developer. Gate 3: internal team.
   Anyone required missing: the gate is NOT HELD, recorded as such, rescheduled. No authority
   overrides this (GUARDRAILS 5).
2. **Review against the written exit criteria** in the gate's command file; check them off
   explicitly in the room.
3. **Read the register and the contradictions aloud**: open assumptions and unresolved
   contradictions relevant to what is being reviewed are stated before the review starts, so
   acceptance is informed acceptance.
4. **Capture every correction verbatim-ish with its source tag**, then classify in the room:
   - TYPE A (surface): changes a screen, a flow drawing, wording, layout. Owner patches in
     place; STATE.md notes it.
   - TYPE B (structural): changes a rule, entity, status, permission, or requirement. Routes
     to requirements-reconciler FIRST; dependents stale-marked; rework-log row written. WHEN
     UNSURE, IT IS TYPE B; the cost asymmetry decides.
   - Correction ownership assigned in the room, per item; an unowned correction is a blocker,
     not a note.
5. **Sign-off is written.** Verbal yes is (asserted); the gate report records the gate as
   passed-pending-written until confirmation arrives.
6. **File the report** (templates/gate-report.md) in 80-gates/ and update STATE.md's gate
   record in the same action. No report, no pass.
7. **Post-gate verification, within the week**: confirm every routed Type B produced its
   reconciler entry and stale marks, and every Type A was patched or scheduled. A gate whose
   corrections evaporate teaches everyone that gates are theatre; this check is what makes
   them cumulative instead.

## Gate 1 specifics: validate prototype and other artifacts
- Review THE SET TOGETHER (prototype + as-is + tentative ERD/sitemap/flows), never artifact by
  artifact; a screen can be accepted while its data model is rejected, and only a joint review
  catches it.
- Open with the prototype-engineer's framing script (disposable, built to be wrong usefully);
  the facilitation discipline from interview-facilitation applies here in full: one question
  at a time, silence after answers, capture by source.
- The six questions, asked in order:
  1. Where is the as-is process factually wrong or incomplete?
  2. Which steps are missing?
  3. Which entities or relationships are wrong?
  4. Which edge cases would break this?
  5. Which terminology is wrong for this domain?
  6. What must be true that is not shown here?
- Use the tentative set's open-questions boxes as the agenda's second half: the team asked for
  specific rulings; get them ruled.
- OUTCOME READING: heavy correction is SUCCESS (the instrument worked). Little correction is a
  WARNING, not a pass: either the set was too safe to test anything or the reviewer is being
  polite. Before accepting a quiet result, probe: "complete the job on this build in front of
  me and narrate where it lies", "run month-end on this flow", "what does this let you do that
  reality forbids?" Only after those may a quiet gate pass, and the report says the probes
  were run.

## Gate 2 specifics: validate all artifacts
- ORDER IS MODEL FIRST, SCREENS LAST: refined requirements, ERD, process breakdown, to-be
  pairs, userflows, sitemap. Screen-first review hides model contradictions.
- Developer attendance is the point: ERD acceptance and a read of the breakdown are exit
  criteria; their structural objections are cheap now and multiples later. Give the developer
  the two-developer-test results (process-breakdown) as their reading guide.
- The prioritized list is checked signed; unsigned blocks the gate. On fixed-bid, the LOCK is
  stated in the room.
- The pain-index deltas (to-be versus as-is) are presented; a to-be that does not beat its
  baseline is discussed as a finding, not hidden.

## Gate 3 specifics: final design review (internal)
- Line-by-line: each in-list feature's spec against its REQ-IDs.
- Re-run the status-mapping-vs-ERD reconciliation independently of hifi-spec's self-check;
  the mismatch is the most common defect here.
- The design-critique report for each feature is an input. Gate 3 does not re-run all seven
  lenses; it verifies the critique ran, spot-checks its claims, and independently re-runs lenses
  3 (state completeness), 4 (accessibility) and 7 (domain fidelity). Those three require reading
  the ERD rather than looking at the screen, which is where a self-critique is least reliable.
- Passing Gate 3 unlocks scheduling client validation, not shipping.

## Client validation processing
- Same classification discipline; Type B still routes through the reconciler even this late,
  and the changed requirement updates before the changed screen ships.
- Client-validation feedback arriving as preferences ("I'd like it blue") is Type A at most;
  feedback revealing a rule ("we could never show that column to branch staff") is Type B
  wearing small talk; listen for the second kind.

## Deciding factors
- Three Type Bs tracing to one Phase 1 topic: escalate per CLAUDE.md 6; recommend re-opening
  that topic, not the phase.
- A gate that keeps rescheduling on attendance is itself a finding about the client's
  engagement; raise it with the PO rather than quietly downgrading attendance.
- Remote gates: same rules; recording consent per interview-facilitation; screen-share the
  artifacts rather than pre-circulating only, because the joint-set effect requires seeing
  reactions live.

## Quality bar (self-evaluation, per gate)
- Report filed same day; every correction classified and owned in the room, not
  reconstructed later.
- Register and contradictions were read aloud; the report says so.
- Quiet-review probes run and recorded where correction volume was low.
- Post-gate verification completed within the week, with its result noted in STATE.md.

## Guardrails
- Not-held gates are recorded, never papered over.
- Classification happens at the gate, not later from memory; late classification drifts
  toward Type A because patching is easier than reconciling.
- The report's correction table is the canonical record; side notes do not count.
- No gate passes with unknown artifact staleness or undisclosed open S1 findings.

## Output
- `80-gates/gate-{n}-report.md`, classification tables included
- STATE.md updates: gate record, rework log rows for Type B, freshness marks
- Post-gate verification note

## Exit criteria
- Report filed same day; every correction classified and owned; post-gate verification
  scheduled

## Failure modes
- Polite-quiet passes: the phase's cheapest learning window closes unused.
- Late classification: corrections reconstructed from memory drift toward Type A.
- Evaporating corrections: routed items nobody verified landed, discovered at the next gate
  as the same corrections again.
- Ceremony creep: the gate becomes a demo with applause instead of an examination with
  findings; the six questions and the probes are the antidote.
