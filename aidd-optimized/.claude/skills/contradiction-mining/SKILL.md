---
name: contradiction-mining
description: "Consolidates sources into attributed problem statements and typed, owned contradictions, without ever merging. Use after a call, and whenever two sources disagree about the client's world."
---

# Contradiction Mining

## Purpose
Consolidation that smooths disagreements away destroys the most valuable output of discovery.
This skill produces two things: problem statements everyone can sign, and the contradictions
between sources, listed, tagged, and owned. A contradiction surfaced in Phase 1 costs a
conversation; the same contradiction surfaced at Gate 2 costs a re-model; at build it costs a
sprint; in production it costs trust. The mining pass is where that cost curve is caught at its
cheapest point.

## Inputs
- `10-discovery/transcripts/` (capture sheets + recordings' AI notes)
- `10-discovery/anchor-analysis.md` (including its internal-contradictions list) and the
  anchor document itself
- `solution-hypotheses.md` (kept separate; consulted, not merged)
- `00-inputs/assumptions.md` (register entries a call answer may have closed or contradicted)

## The two-stage detection method

**Stage 1: model-assisted sweep.** Exact framing: "List every contradiction between these
sources. Do not resolve, reconcile, or merge anything. For each, quote both statements and name
the source of each." The verbs merge/reconcile/harmonize are banned in the instruction
(GUARDRAILS 3). Run the sweep pairwise where volume is high (document vs DA, DA vs PO, DA vs
users, call 1 vs call 2); pairwise sweeps catch cross-source conflicts a single-pass summary
flattens.

**Stage 2: human filter.** Models over-detect surface phrasing differences and under-detect
deep conflicts. For each candidate, apply the co-satisfiability test: if both statements were
true, could the same product satisfy both? Yes: it is phrasing, drop it. No: it is real, keep
it. Then run one deliberate under-detection pass yourself: for each (confirmed) or high-radius
commitment, ask "did anything in any session brush against this?" The deep conflicts hide as
near-misses, not as direct denials.

## Contradiction taxonomy

Type the kept contradictions; the type predicts who must resolve it and how urgent it is.

| Type | Pattern | Typical resolution path |
|---|---|---|
| FACT | Two sources state different values (daily vs weekly, 30 vs 45 days) | Cheap: one is stale or misremembered; DA rules, often same week |
| RULE | Sources disagree on what is allowed or required | Expensive and load-bearing: needs the authority holder, sometimes legal; blocks dependent ERD/requirement work |
| SCOPE | Sources disagree on what the project covers | PO-owned; unresolved scope contradictions poison prioritization |
| PROCESS | Sources describe different sequences for the same work | Often BOTH true (variant flows); the resolution is mapping the variants, not picking one |
| VOCABULARY | Same word, different meanings across factions | Glossary collision; route to glossary-builder with an owner |
| AUTHORITY | Sources disagree on who decides or may override | Politically hot; handle in a small setting, not a gate |
| DOC-VS-REALITY | The document commits to something the room says is not true | The classic Phase 1 finding; usually resolves as "document is old", but confirm, never assume |

## Ranking

Not all contradictions block equally. Rank by dependency weight: how many downstream artifacts
(glossary terms, ERD constraints, flows, requirements) rest on the answer. A RULE-type
contradiction touching a lifecycle constraint outranks ten FACT-type discrepancies in
narrative colour. The top of this ranking is what gets chased for resolution before Gate 1;
the bottom can park with owners.

## Problem statements

One entry each: **ID (PS-{n}, stable, never reused) | problem | source tag | current workaround | downstream consequence |
confidence.**

- A problem with no stated workaround gets the workaround question queued (people always cope
  somehow; an unknown coping mechanism means the problem is not yet understood).
- A problem with no downstream consequence stated is suspect (why is it a problem?) and gets
  the stake question queued.
- Verbatim phrasing preserved where it was load-bearing; the DA's own words in the problem
  statement measurably improve confirmation rates, because people sign what they recognize.
- Confidence assigned honestly: (confirmed) only where the DA said it or has verified it;
  (asserted) for single-human statements; (inferred) never appears in a problem statement,
  only in open-questions.
- Deduplicate across sessions but never across sources: if the PO and a user both raised the
  same pain, that is one problem with two tags, and the double attribution is evidence of
  priority.

## The confirmation loop

1. Send `problem-statements.md` and the contradictions table together. The covering note asks
   for three things explicitly: corrections, deletions ("which of these is not actually a
   problem?"), and rulings on the contradictions each recipient owns.
2. Track the reply state per entry: sent / verbally-acknowledged / corrected / confirmed in
   writing. A verbal yes upgrades nothing; written confirmation upgrades entries to
   (confirmed) and closes Phase 1.
3. Corrections received are processed as new statements (tagged, dated), not as silent edits;
   the entry's history stays visible.
4. Two chases without written confirmation: escalate with the specific list of what stays
   (asserted) and what that blocks downstream. Phase 1 can close on an explicit risk
   acceptance, never on silence.

## Procedure

1. Same-day after each session: stage-1 sweep over the new transcript against all prior
   sources; stage-2 filter; type and rank the keepers.
2. Update problem statements; queue workaround/stake questions for entries missing them.
3. Scan the assumption register: any entry answered or contradicted by this session is
   updated (refutations route as their blast radius demands).
4. Assign owners in the contradiction table: every row has a named human and a due date.
   Proposed owner defaults: FACT/RULE to the DA, SCOPE to the PO, VOCABULARY to
   glossary-builder's DA list, AUTHORITY to the PO with the DA present.
5. Push the table into STATE.md's contradictions section.
6. After the last planned session: run the confirmation loop.

## Deciding factors
- Volume check: a call that produced zero contradictions between [DOC] and the room is
  suspicious; either the document is unusually good or the anchoring step was skipped. Say
  which you believe and why.
- If the DA corrects the document heavily, do not rewrite the document; the corrections are
  Phase 2B material (refined requirements). Here they are contradictions with owners.
- PROCESS-type contradictions between roles are usually variant flows, not errors; hand the
  variant conditions to as-is-mapping instead of forcing a winner.

## Quality bar (self-evaluation)
- Every kept contradiction passes the co-satisfiability test and carries both quotes, both
  tags, a type, a rank, an owner, and a due date.
- Every problem statement has all five fields or a queued question for the missing one.
- The under-detection pass was run against the commitment list, not just accepted from the
  model.
- Zero (inferred) entries in the problem set.

## Guardrails
- Every entry tagged and marked; an untaggable claim does not enter the file (GUARDRAILS 1).
- Unowned contradictions block the Phase 1 exit; parking is allowed, owner-less parking is not.
- The model consolidation instruction never contains merge/reconcile/harmonize.
- Confidence inflation is the named corruption: (asserted) entries are never promoted because
  a deadline approaches.

## Output
- `10-discovery/problem-statements.md` (attributed, marked, confirmation-tracked)
- STATE.md contradictions table populated (typed, ranked, owned)
- `open-questions.md` extended with everything unanswered, DA-ONLY items flagged
- Assumption register updates where sessions closed or contradicted entries

## Exit criteria
- Written (confirmed) on the problem set from the DA, or an explicit escalation with risk
  acceptance
- Zero owner-less contradictions
- open-questions.md converted into the Phase 2A research plan

## Failure modes
- The model quietly harmonized and you shipped its harmony.
- Surface-noise flooding: forty phrasing differences drowning the three real conflicts,
  because stage 2 was skipped.
- Confidence inflation near deadlines.
- Contradiction hoarding: conflicts logged, never chased, arriving at Gate 2 still open and
  now expensive.
