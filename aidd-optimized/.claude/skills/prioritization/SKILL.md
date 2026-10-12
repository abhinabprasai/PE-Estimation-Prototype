---
name: prioritization
description: "Facilitates the signed feature list: mandatory partition audited against authority class, scoring on the optional partition only, ranked in whole flows including exception paths. Use before Gate 2."
---

# Prioritization

## Purpose
Phase 3 designs only what is on this list; narrowing hi-fi scope is what pays for the
front-loaded Phase 2 work. The list is a gating artifact: no agreed written list, no Gate 2
pass. The method matters less than most teams think and the inputs matter more: a defensible
list is one where every score's provenance is visible and the two domain rules were applied
after scoring, in the open.

## The value dimension

Every method below needs one, and until now this file supplied only the pain index, which counts
manual movements, error rows, waits, crossings and systems touched. That is process cost. It is
real evidence and it is not value: a flow can be expensive to run and worth nothing to improve,
and a flow can be cheap to run and be the one the business is losing money on.

The value dimension comes from `60-requirements/measurement-plan.md`. Per candidate:

| Input | Source |
|---|---|
| Outcome served | The `OUT-{n}` on the requirement entry |
| Expected movement in that number | Argued at the trade session, with the mechanism named |
| Confidence in that movement | high / medium / speculative, stated, never averaged away |
| Pain-index delta | `to-be-design`, as before |
| Effort | `[TEAM] (asserted)`, with an engineering voice in the room |

- **A candidate with no outcome does not get scored.** It goes back for one or it moves down the
  list. This is the single change that stops the list ranking by seniority.
- **Confidence is carried, never multiplied into the score and forgotten.** Three speculative
  high-value candidates at the top is a portfolio decision the PO should make knowingly.
- **A high pain-index delta serving no outcome is a candidate for elimination, not for design.**
  Sometimes the right answer is that the process should stop, and the pain index is the only
  evidence column that can say so.

## Method selection (pick one, record why)

| Situation | Method | Notes |
|---|---|---|
| MVP must be defined fast | Impact / Effort matrix (quick wins, big bets, fill-ins, money pits) | Fastest; coarse; fine when the candidate count is under ~20 |
| Client thinks in commitments | MoSCoW (must / should / could / will not) | The "must" partition is audited against the mandatory rule below; MoSCoW's known failure is everything becoming Must, and the audit is the antidote |
| Reach is estimable with any confidence | RICE (reach x impact x confidence / effort) | The confidence factor is the honest part; a reach number with no source gets confidence 50% and it shows |
| Sequencing under deadline pressure, cost of waiting differs per item | WSJF (cost of delay / duration) | The right frame when late delivery has different costs per flow (regulatory dates, contract renewals); requires the DA to help estimate what delay costs |
| The question is expectation versus differentiation | Kano (basic / performance / excitement) | Basics are close cousins of the mandatory partition: absence infuriates, presence is unnoticed. Useful lens even without the survey |
| User importance and satisfaction both measurable | Opportunity scoring (importance vs satisfaction gap) | Needs user input (users_reachable); the gap column is discovery data the interviews already hold |
| Business case still contested | Feasibility / Desirability / Viability scorecard | Surfaces WHICH axis the disagreement lives on, which is most of its value |
| The question is "what blocks launch" | P0-P2 urgency ranking | For late-stage scope fights, not for initial planning |

Estimates in any method carry their provenance: an Effort score is [TEAM] (asserted), a Reach
number cites its KB item or is marked guess. A score whose inputs are guesses is a guess with
arithmetic on top; the arithmetic does not upgrade it.

## The two domain rules (non-negotiable, applied after scoring)

1. **MANDATORY IS NOT A CANDIDATE.** Anything a (confirmed) DA rule or a [DOC] commitment
   requires is in by definition. Prioritize among the optional; a method that scores a legal
   requirement low has mis-scoped its inputs, not discovered a saving. The mandatory partition
   is auditable: each item cites its (confirmed)/[DOC] source, and the anchor-analysis
   authority classification (law / contract / policy / preference) is what keeps this
   partition honest; only law and contract are automatically mandatory, policy and preference
   compete like everything else unless the DA rules otherwise.
2. **PROCESS COMPLETENESS OVER FEATURE COUNT.** A half-supported process is worth less than no
   support: it forces users to run two systems at once. Rank in units of complete to-be flows;
   a feature ships only with the rest of its flow, or the flow is explicitly descoped whole.
   "Complete" includes the flow's exception paths (process-breakdown's Exception rows): a flow
   whose happy path ships without its correction path is a half-supported process wearing a
   completeness costume.

## Procedure

1. Build the candidate list from to-be flows (the unit) with their features attached; annotate
   each flow with the pain-marked as-is rows it resolves, the pain-index delta it promises,
   and the REQ-IDs it implements. The pain-index numbers (as-is-mapping, to-be-design) are the
   evidence column most methods call "impact"; use them instead of fresh guesses.
2. Partition mandatory vs optional first (rule 1), with the authority audit.
3. Score only the optional partition with the chosen method. Record every estimate's
   provenance inline.
4. Facilitate the trade with PO + DA together, live: PO holds value, DA holds correctness
   cost; scoring apart produces lists that collide at the gate. Facilitation notes: score the
   easy candidates first to calibrate the scale; when two stakeholders disagree by more than
   one band on a score, the disagreement is data (ask what each knows that the other does
   not, and capture it); re-sort in front of everyone, no offline adjustments.
5. Draw the line; then run the completeness pass (rule 2): any flow cut in half is restored
   whole or descoped whole, and the delta is re-traded.
6. Sanity checks before writing: does the in-list serve every role, or does some role get
   nothing while their as-is pain stays? (A role descoped entirely is a decision the PO must
   make knowingly, and their old process keeps running; say so.) Does the in-list dissolve any
   flow dependency (a flow that feeds another cannot be descoped without the dependent flow
   inheriting a manual step; the coupling pass in process-breakdown lists these)?
7. Write `60-requirements/prioritized-features.md`: in-list (flows + features + REQ-IDs),
   descoped (with one-line reason each, and the as-is that keeps running), method used, scores
   with provenance, date, and the signatures block. Agreement is in WRITING from PO and DA.
8. fixed-bid: mark the list LOCKED AT GATE 2; later changes are scope changes and route
   through the human before any work (GUARDRAILS 6).

## Deciding factors
- Tie between flows: prefer the one resolving the oldest pain-marked as-is rows; longevity of
  pain is evidence of cost.
- A descoped flow keeps its as-is running: say so explicitly in the descope reason, so nobody
  believes the pain vanished.
- Method switching mid-project is a red flag: it usually means the first method produced an
  answer someone disliked. If the method must change, the reason is recorded and the old
  scores are kept visible.
- Effort estimates need a developer in the room or on review; [TEAM] effort scores with no
  engineering voice are systematically low, and the miss lands on the fixed-bid margin.

## Probing prompts (for the trade session)
- "If we ship only the in-list, which daily task still needs the old spreadsheet?"
  (completeness leak detector)
- "Which descoped item will the client ask about first at handoff? Pre-write that answer now."
- "Which score would change most if we are wrong about one estimate? Check that estimate's
  provenance."
- "Which 'must' here would the business actually launch without, if the date slipped? Then it
  is not a must."
- "Whose pain does the in-list not touch at all?"

## Quality bar (self-evaluation)
- Method recorded with why; every score carries provenance; no guess wearing arithmetic.
- Mandatory partition audited against authority classes.
- Completeness pass run, including exception paths; no half-flows.
- Role coverage and flow dependencies checked; descope reasons name the surviving as-is.
- Signatures in writing, or the gate is told exactly what is missing.

## Guardrails
- No unsigned list passes Gate 2; verbal agreement is (asserted) and insufficient.
- Mandatory partition is auditable: each item cites its (confirmed)/[DOC] source.
- Scores never overwrite the domain rules; the rules run after scoring, visibly.

## Output
- `60-requirements/prioritized-features.md`, signed, method-recorded, provenance-carrying

## Exit criteria
- Written PO + DA agreement; completeness pass clean; Gate 2 report cites the list

## Failure modes
- Skipped entirely: hi-fi expands to all requirements and the Phase 2 investment becomes
  overhead instead of a trade.
- Feature-count ranking: shipped halves of three processes instead of all of one.
- Must-inflation: MoSCoW without the authority audit, every stakeholder's favourite marked
  Must, and the method reporting consensus that does not exist.
- Provenance-free scores: a confident matrix built on guesses, defended at the gate with
  arithmetic instead of evidence.
