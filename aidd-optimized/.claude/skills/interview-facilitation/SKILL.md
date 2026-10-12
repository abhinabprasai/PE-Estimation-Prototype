---
name: interview-facilitation
description: "Runs the discovery call and the observation session: capture by source, probes, bias counters, and the closing summary that produces corrections. Use when preparing for, running, or writing up any session with the client."
---

# Interview Facilitation

## Purpose
The call is where three kinds of truth arrive at once: the product owner's, the domain
authority's, and the team's. Facilitation keeps them apart at the moment of capture, because
separation after the fact is reconstruction. The second job is extraction quality: the
difference between a flat answer and a load-bearing one is almost entirely facilitator
technique, and technique is learnable, specifiable, and checkable.

Technique depth: `references/facilitation-technique.md` (probe mechanics, bias counters, the
observation protocol for contextual sessions, difficult-moment playbook).

## Setup (before the session)
- Recording and AI notes ready; consent requested in advance, confirmed on the record at the
  start. No consent: notes only, the fact logged, and every statement caps at (asserted) until
  confirmed in writing.
- `questions.md` facilitator version open; share-version was sent days ahead so the DA could
  pull real records and examples (the single cheapest improvement to answer quality available).
- A model in a side window for live terminology lookup, so an unknown term never makes you nod
  along or stall the room. Look it up, then verify the client's meaning anyway; the industry
  definition is a hypothesis, not an answer (GUARDRAILS 1).
- Capture sheet with three columns headed [PO] [DA] [TEAM], plus three side lists:
  SOLUTIONS-OFFERED, NEW-TERMS, and UNFOLDED (questions the team asked, answered or not).
- Roles set if more than one team member attends: one facilitator, one dedicated note-taker.
  A facilitator who is also the only scribe probes less, because writing competes with
  listening. If alone, lean on the recording and keep the sheet skeletal.

## In-session procedure

1. **Open.** Confirm consent on the recording. State the session goal in one sentence. Set the
   frame: "I will ask about how things work today; if I ask about something that seems obvious,
   it is because the obvious things are where systems go wrong."
2. **Anchor every discussion to the document.** When the conversation and [DOC] disagree, stop
   and say so out loud, neutrally: "the document says X, you are describing Y; both are useful,
   let me capture both." The disagreement is among the most valuable findings the call produces;
   capture both statements, tagged, and move on without resolving (GUARDRAILS 3).
3. **Capture by source.** Problem statements go into the column of whoever said them. Verbatim
   where the phrasing is load-bearing; paraphrase otherwise, marked (para). If two people say
   almost the same thing, capture both; "almost" is data.
4. **Separate solutions, live.** Experienced people answer problem questions with solutions;
   that is compressed expertise, not a failure. Acknowledge, capture in SOLUTIONS-OFFERED with
   its tag, then steer back: "that is useful and I will keep it; before that, what is happening
   today that makes it needed?" Never argue with an offered solution and never adopt one in the
   room; both end the flow of problems.
5. **Log requirement unfolding.** Every question a team member asks is logged in UNFOLDED with
   who asked, whether it was answered, and by whom. Unanswered ones go straight to
   open-questions. This list is also your Phase 1 topic map: where the team's questions cluster
   is where discovery is thinnest.
6. **Deliver ladders one rung at a time.** One question, then silence. Three to five seconds of
   silence after an answer is a tool, not an awkwardness; the sentence that follows unprompted
   silence is disproportionately often the finding. Use the echo probe (repeat their last few
   words with a question tone) before reaching for the next scripted rung.
7. **Ground abstractions immediately.** Any answer describing the ideal process gets "walk me
   through the last actual time" before the next question. Any answer with a number gets "is
   that typical or worst-case?"
8. **Watch for the four tells**, and probe when one appears: a hesitation before an answer
   (uncertainty or politics; ask "is that a rule or a habit?"), a laugh ("what is funny about
   that?" finds workarounds), the word "just" (compression; ladder down), and "obviously" or
   "of course" (an assumption the client cannot see; ask them to spell it out anyway).
9. **Handle disagreement in the room.** If the DA and PO start debating, let it run briefly and
   capture both sides tagged; live disagreement is high-grade evidence. Intervene only to keep
   it concrete ("can you each give me the last real example?") and to end it without a forced
   resolution: "I have both positions; this is exactly the kind of thing this phase exists to
   surface."
10. **Close, never rushed.** Summarize your understanding back in your own words, group by
    group, then run the closing set verbatim: "what did I get wrong?", "what did I not ask
    about?", "who sees this differently?", "what are you worried we will get wrong?" The
    closing summary is where mishearings get caught at their cheapest; cutting it to fit one
    more question is always a bad trade.

## User-interview variant (users_reachable = true)
- Same capture discipline, separate file; user statements tagged [USER:role].
- Behaviour over opinion: "show me" and "walk me through the last time" beat "would you".
- Recruit for recency (did the task this week), not for seniority.
- Never pitch solutions to users mid-interview; it contaminates every later answer.
- Where a screen share or site visit is possible, switch to the observation protocol
  (master-apprentice stance: they work, they narrate, you interrupt at moments of interest;
  full protocol in the reference file). Two hours of watching one person work beats ten hours
  of asking people what they do, because the workarounds are visible instead of remembered.

## Deciding factors
- If time runs short, cut whole low-priority questions; never rush the closing summary.
- If an answer opens a topic bigger than its slot, book the follow-up in the room ("that needs
  twenty minutes of its own; can I take them on Thursday?") rather than strip-mining it now.
- If the DA delegates a question ("ask Sandra"), capture the delegation as data: the org chart
  of who actually knows what is a Phase 1 deliverable hiding in plain sight.
- One question at a time when delivered; batching flattens answers (GUARDRAILS 12).

## Quality bar (self-evaluation, same day)
- Can every capture-sheet line be attributed without guessing? Single-column capture is
  attribution collapse at the source, unrecoverable later.
- Did every abstract answer get a concretize rung? Count the ones that did not; those topics
  are still soft.
- Was the closing summary corrected? Zero corrections usually means it was delivered as a
  formality, not as a genuine check.
- File the capture sheet the same day; memory decay is fast and unlogged.

## Guardrails
- No recording consent: notes only, logged, statements cap at (asserted).
- You do not resolve contradictions in the room; you capture them (GUARDRAILS 3).
- You never promise a solution in the call; SOLUTIONS-OFFERED is input, not commitment.
- Client materials shown in the session are never pasted into external tools (GUARDRAILS 8).

## Output
- `10-discovery/transcripts/{date}.md`: recording reference + capture sheet + side lists
- Feeds: contradiction-mining (everything), glossary-builder (NEW-TERMS),
  solution-hypotheses.md (SOLUTIONS-OFFERED), open-questions.md (unanswered UNFOLDED items)

## Exit criteria
- Closing summary delivered and corrections captured
- Capture sheet filed same day, side lists routed to their owners

## Failure modes
- Single-column capture: attribution collapse at the source.
- Debating the client instead of capturing them.
- Solutions absorbed into the problem set because steering back felt rude.
- Script slavery: reading the next question instead of laddering the last answer; the ladder
  in hand exists precisely so that following the conversation is safe.
- Filling silence: the facilitator answering their own question after one second because
  silence felt rude, and losing the sentence that was coming.
