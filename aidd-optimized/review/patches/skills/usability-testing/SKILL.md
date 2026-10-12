---
name: usability-testing
description: "Runs task-based moderated sessions with real operators against the hi-fi set before Gate 3, and against the throwaway prototype at Gate 1 where users are reachable. Covers participant selection, task construction from the to-be flows, the moderation protocol, what to record, how to score task success, and how findings map into the existing S1-S4 severity and Type A/B routing. Use before Gate 3 on every project, and at Gate 1 whenever users_reachable is true. Also use when a design decision is contested and neither side has evidence."
---

# Usability Testing

## Purpose
Every other quality mechanism in this process asks whether the design agrees with a document.
This one asks whether a person can do the work. It is the only mechanism that can produce that
answer, and without it the process can ship an artifact set that is complete, traceable,
accessible, domain-correct and unusable.

The framing that matters: this is not a satisfaction survey and it is not a demo. It is an
instrument for producing **failures**, run on the cheapest artifact that can produce them, at
the last moment they are still cheap to fix. The same logic as the throwaway prototype at Gate 1,
applied to the interface rather than to the domain.

## Inputs
- `70-hifi/{feature}/spec.md` and `content.md` for every prioritized feature (or the prototype, at Gate 1)
- `60-requirements/prioritized-features.md`: the tasks come from here, in flow units
- `40-models/userflows/{role}-{task}.md`: the role and the entry point per task
- `40-models/flow-optimization/{goal}.md`: the cost table, which is the prediction this test checks
- `40-models/erd.md` consequences note: what is irreversible, so a session cannot cause real harm
- `00-inputs/assumptions.md`: register entries whose test is "watch someone try it" are due here

## Preconditions

- Gate 2 passed and the prioritized list signed. Testing an unprioritized set wastes the sessions
  on features that will be descoped.
- `design-critique` run at the full lens set with zero open S1. Sessions spent finding a missing
  empty state are sessions wasted; the critique is what makes the test worth its participants.
- A clickable artifact for the primary path of each feature under test. Static specs cannot be
  tested. Where no build exists, a linked prototype of the happy path plus the two most consequential
  exception paths is enough, and its roughness is declared to the participant.
- `dummy-content` populated. A test on lorem ipsum tests nothing, in this domain most of all:
  participants read the data before they read the interface.

## Participants

| Question | Answer |
|---|---|
| How many | Five per distinct role. Five finds the great majority of what a moderated round will find; the sixth session is better spent as the first session of the next round, after fixes |
| Who | People who do the work now, recruited by role from the actor list in the to-be flows. Not the SME, not the PO, not anyone who has seen the design |
| How many roles | Every role that owns a prioritized flow end to end. A role that only receives an exception gets one session, not five |
| Recency | Performed the task in the last two weeks. Recall degrades fast and it degrades toward the happy path |
| Recruitment | Through the PO, with the reason stated plainly: we are testing the design, not the person, and nothing they say reaches their manager attributed |

Where users are genuinely unreachable (`users_reachable: false`), this skill still runs, with the
DA as participant, and **every finding is marked (asserted) and the substitution is stated in the
gate's first sentence**. An SME's first click is a subject-matter expert's first click. This is a
mitigation of R-SME-SUB, not a satisfaction of it, and the risk row stays open.

## Task construction

Tasks come from the to-be flows, in whole units including their exception path. A task is:

1. **A goal, not an instruction.** "You have this invoice from a supplier and it does not match
   the order. Deal with it." Not "click Reconcile, then select the variance reason."
2. **Given with the real artifact in hand.** A printed record, a real email, the actual document
   the operator would be holding. Half the findings in domain products come from the mismatch
   between what the form asks for and the order the source document supplies it in.
3. **Ended by the participant, not the moderator.** They say when they think they are done. Whether
   they are is a finding.

Per session: three to five tasks, roughly ten minutes each, ordered so the highest-consequence
flow runs second (first is warm-up, and attention drops after the third). Include at least one
**exception path** per session. The happy path is the part everyone already believes works.

Do not construct a task for a flow whose cost table predicts no improvement over the as-is. Test
where you made a claim.

## Moderation protocol

- **State the frame before anything.** "This is a design, not a finished product. I did not draw
  it and I have no stake in it. If something is confusing, that is information about the design.
  Please think out loud." Say the second sentence even if it is not quite true; it buys candour.
- **Do not help.** The instinct to rescue is the single biggest source of worthless sessions. When
  a participant is stuck, wait. Count to ten silently. Then: "What are you looking for?" Then:
  "What would you do if I were not here?" Help only after all three, and record that you did.
- **Never ask whether they like it.** Ask what they expected to happen, what they thought that
  control would do, and where they thought the thing they were looking for would be.
- **Two people.** A moderator who watches the participant and a notetaker who watches the screen.
  One person doing both moderates badly and records worse. The notetaker does not speak.
- **Record with consent**, screen and audio. Faces are not needed and asking for them costs
  consent rate.
- **Do not demo.** If the session becomes a walkthrough, the round is over; you will get politeness
  for the rest of the day and it will read as success.
- **Debrief between sessions, not at the end.** Five minutes with the notetaker while it is fresh.
  Findings reconstructed from a recording three days later drift toward whatever was memorable.

## What to record

Per task, per participant:

| Field | Detail |
|---|---|
| Completed | unaided / completed with a prompt / completed wrong (they believe they succeeded and did not) / abandoned |
| Time | wall clock, start to their declared end. Compare against the cost table's prediction, not against a target |
| Errors | every wrong turn, with what they expected instead |
| First click | where they went first, recorded separately from where they ended (the same discipline as the tree test in `information-architecture`) |
| Verbatims | the exact words, especially the ones that use a term the glossary does not contain |
| Domain findings | anything they say about how the work actually happens that contradicts the flows. These are Type B and they are common; the interface is a very effective interview instrument |

**"Completed wrong" is the most important row in this table.** A participant who believes they
succeeded and did not is a defect that will reach production, be repeated daily, and be discovered
by an audit. Score it as a failure, more severe than an abandonment.

## Scoring and routing

Findings enter the existing machinery. No new pipeline.

| Observation | Severity | Type |
|---|---|---|
| Two or more participants complete a task wrong, or a task's unaided success is below 3 of 5 | S1 | A unless the fix changes a rule |
| One participant completes wrong; or unaided success is 3 of 5 with the same wrong turn | S2 | A |
| A wrong turn appearing once, recovered unaided | S3 | A |
| A participant describes the work differently from the to-be flow | any | **B** - route to requirements-reconciler before touching a screen |
| A participant names an entity, status or rule that is not in the ERD or the glossary | any | **B** |
| A register assumption is refuted by what you watched | S1 | **B** by default (GUARDRAILS 10) |
| A participant dislikes something and completes the task unaided every time | SC | Record as a craft finding (`design-critique`), do not fix on one voice |

Three or more S1/S2 findings on one flow means the flow's structure is wrong, not that three
screens need patching. That is the design-side analogue of the three-Type-Bs-on-one-topic rule in
CLAUDE.md section 6, and it escalates the same way: re-open that flow's optimization, not the phase.

## Procedure

1. Confirm preconditions. Do not spend participants on a set with open S1 critique findings.
2. Pick the flows: every prioritized flow whose cost table claims an improvement, plus any flow
   carrying an unresolved register assumption whose test is observational.
3. Write the tasks as goals, with their real artifacts. Have the DA read them for domain plausibility
   and nothing else; a DA who edits a task toward the design has removed the test.
4. Recruit five per role through the PO, with the recency criterion stated.
5. Run the sessions, two people, one round. Debrief after each.
6. Compile: the task x participant grid, the finding list, the verbatims, the domain findings.
7. Route: Type B to requirements-reconciler **before any screen changes**; Type A to the owning
   agent; SC to the craft register.
8. File `70-hifi/usability/{round}-{date}.md`. Attach to the pre-Gate-3 critique.
9. Where fixes land on an S1 flow, re-run **that flow only**, with two fresh participants. A full
   second round on a small change is ceremony.

## Deciding factors

- **Five per role, one round, then fix, then two.** Fifteen sessions in one round before any fix
  is the classic waste: sessions 6 through 15 rediscover what sessions 1 through 5 found.
- **Test earlier than feels ready.** The cost of a finding rises with the fidelity of the thing it
  is found in. This process concentrates fidelity in Phase 3, which is exactly why the test must
  sit before Gate 3 and not after client validation.
- **The moderator is not the designer, where the team allows it.** A designer moderating their own
  work rescues participants without noticing.
- **Do not test what you cannot change.** If the list is locked and the finding would be a scope
  change, you have bought an argument, not an improvement. Say so before the round.

## Probing prompts

For the participant, in the moment:
- "What did you expect that to do?"
- "Where would you look for that?"
- "You paused there. What were you thinking?"
- "Is that what usually happens?" (the highest-yield question in domain work)
- "What would you do next, in real life, after this?"

For the team, after:
- "Which finding did we all already know about and had decided to live with?"
- "Which participant did we help, and what would have happened if we had not?"
- "Which of these is the design and which is the process being genuinely hard?"
- "What did somebody say that is not in the glossary?"

## Guardrails

- No participant does anything on a real record. Test data only (`dummy-content`), on a
  non-production surface. An irreversible transition triggered in a session is a real-world event.
- Attribution: participants are identified by role and number in every artifact, never by name.
  Their manager does not read the transcript. This is not a courtesy; it is the condition on which
  the second participant tells you anything true.
- Findings that contradict the flows are Type B and route through the reconciler before any screen
  is touched (CLAUDE.md section 6). The interface is an interview instrument here and it produces
  domain corrections at the same rate as the Gate 1 prototype.
- A round with no failures is a warning, not a pass, exactly as a quiet gate is (GUARDRAILS 5).
  Either the tasks were too easy, the moderator helped, or the participants were not operators.
  Probe before accepting it, and record which probes were run.
- An accessibility finding from a session does not replace the testing ladder (`accessibility`),
  and the ladder does not replace this. Where a participant uses assistive technology, that is a
  session, not an audit.

## Output

- `70-hifi/usability/{round}-{date}.md`: participants by role, tasks, the task x participant grid
  with completion and time, the finding list scored and classified, verbatims, domain findings
- Type B findings routed to requirements-reconciler with rationale drafted
- SC findings to the craft register
- STATE.md: the round recorded in the design quality record; refuted assumptions marked
- A one-line addition to every affected cost table: predicted versus observed

## Exit criteria (before Gate 3)

- Every prioritized flow whose cost table claims an improvement has been attempted by an operator
- Five participants per role, or the shortfall is named in the gate's first sentence
- Zero open S1 findings, or each declared with an owner and a date
- Every Type B routed before any screen changed
- Predicted versus observed recorded per tested flow, including where the prediction was wrong

## Failure modes

- **The demo in disguise.** The moderator narrates, the participant nods, the report says validated.
- **Rescue.** Help arrives at the two-second mark, every stuck moment is smoothed, and the round
  produces nothing the team did not already believe.
- **Testing the happy path only.** The exceptions are where this process's products actually live,
  and they are the part nobody thinks to script.
- **The SME as participant, unmarked.** The substitution happens, the mark does not, and R-SME-SUB
  closes on evidence that is not evidence.
- **Fifteen sessions, one round, no fixes in between.** Ten wasted sessions and a large report.
- **Findings without routing.** A list of observations filed next to the gate report, none of them
  owned, all of them dead by Friday.
