---
name: question-generation
description: "Turns the verification agenda into a laddered, prioritized, linted question set plus the share-version sent to attendees. Use in Phase 1 before any call, and whenever a new open question needs asking well."
---

# Question Generation

## Purpose
The call is expensive and the DA's time is scarce. Questions are engineered from the anchor
analysis so that call minutes convert into rules, exceptions, and consequences rather than
re-statements of the document. A generic question set is the visible symptom of a skipped
anchor analysis; a good one is so specific to this client that it would be useless on any
other project.

Depth for the facilitator: `references/question-bank.md` carries the reusable primitives
(ladder patterns, JTBD timeline questions, per-silence-class stems) that this skill instantiates
with the project's specifics.

## Inputs
- `10-discovery/anchor-analysis.md`: processes, commitments (with edges pre-written), silences,
  constants, verification agenda
- `10-discovery/glossary.md`: rule-bearing terms awaiting verification, probes attached
- `00-inputs/assumptions.md`: register entries whose cheapest test is "ask the DA"
- PROJECT_CONFIG: users_reachable adds a user-interview set; existing-product weights toward
  the workaround and audit groups

## The four groups (plus one conditional)

1. **PROCESS**: how does this work today, step by step, and who touches it?
2. **RULES**: what must always be true? what is never allowed? which of these are legal or
   regulatory rather than preference?
3. **EXCEPTIONS**: when does the normal process break, and what happens then? who handles it?
4. **CONSEQUENCES**: what happens downstream if this is wrong? who finds out, and when?
5. **HISTORY** (conditional): when the project replaces something or the client has tried
   before, add a switch-interview group: what was tried, what pushed them to act now, what
   almost stopped them, what would have happened if they had done nothing. The four forces
   (push, pull, anxiety, habit) name the pattern: understanding why the last attempt failed or
   why now is the moment is requirements data of the highest grade, because it encodes the
   client's real success criteria.

Exceptions and consequences pay best per minute: the happy path is usually documented;
exceptions live in the DA's head, and consequences define which errors the design must make
impossible rather than merely unlikely.

## Derivation rules (what turns analysis into questions)

| Source item | Question produced |
|---|---|
| Each PROCESS | One process question ("walk me through the last time..."), one rules question, exception questions from its SILENCE entries |
| Each COMMITMENT | A rules question testing its edges ("always? even when...?"), using the edge already drafted in the commitment scan |
| Each COMMITMENT without authority | "Is that a law, a contract, or how you prefer it?" (this single question controls the mandatory set in prioritization) |
| Each single-mention CONSTANT | A verification question with the value read back ("the document says 30 days; is that current, and what happens on day 31?") |
| Each rule-bearing glossary term | Its verification probes, attached as written |
| Each register assumption testable by asking | The register's "cheapest test" question, ID-referenced so the answer closes the entry |
| Each SILENCE of class BOUNDARY | A month-end/audit/period-close question; these find the rules nobody thinks to mention |

## The probing ladder

Under each primary question, 2-4 pre-written follow-ups so probing in the room is a read, not
an improvisation. Standard ladder pattern:

- **Concretize**: "walk me through the last time that happened" (grounds in a real event, the
  single strongest defence against idealized answers)
- **Edge**: "when did that not work?"
- **Actor**: "who decides, and who can override them?"
- **Stake**: "what breaks downstream if this is wrong, and when is it noticed?"

Two additional rungs from the bank, used where they fit:
- **Ladder up** (values): "why does that matter?" applied at most twice; it converts an attribute
  answer into the underlying goal, which is what to-be design actually serves
- **Ladder down** (mechanics): "show me" or "what exactly do you type?" when the answer stays
  abstract

## Prioritization

1. **DA-only first**: questions nobody else can answer, ordered by the verification agenda's
   blast-radius ranking.
2. **Highest-dependency rules** next (the glossary's dependency counts and the commitment scan's
   radius drive this).
3. Everything else by expected yield.

Mark each question with its intended answerer ([DA]/[PO]/[TEAM]). Routing a rules question to
the PO wastes it and produces (asserted) noise that later has to be re-verified anyway.

Cut, do not compress: 12 well-laddered questions beat 30 flat ones. If the list exceeds the
slot, cut whole low-priority questions and log them as open questions for writing, rather than
asking everything shallowly.

## The lint pass (run on every question before it ships)

- **Open, not closed**: a yes/no primary question is a defect; rewrite as "how/when/walk me
  through".
- **No embedded answer**: "you probably just..." and "do you usually X?" are banned; both
  contaminate the answer.
- **No hypotheticals as primaries**: "would you use...?" produces opinions about an imagined
  future; "what did you do last time...?" produces evidence. Hypotheticals are allowed only as
  deliberate consequence probes, marked as such.
- **One question per question**: compound questions get partial answers; split them.
- **Askable in one breath**: if the question needs a paragraph of setup, the setup belongs in
  the share-version preamble, not in the question.
- **Answerable by the person asked**: check the answerer tag once more.

## Procedure

1. Run the derivation rules over the full anchor analysis; instantiate stems from the bank.
2. Build ladders under every primary; no ladder-less primaries.
3. Add the HISTORY group if a switch/replacement is in play.
4. Prioritize; assign answerers; cut to fit the slot.
5. Lint pass, every question.
6. Produce two versions: the share-version (questions only, no ladders, sent to attendees ahead
   of the call so the DA can pull records and examples) and the facilitator version (with
   ladders, stake notes, and register IDs).
7. Hand the facilitator version to interview-facilitation; log the cut questions to
   open-questions.md as ask-in-writing items.

## User-interview variant (users_reachable = true)
- A separate set focused on behaviour and workarounds, never on proposed features: "what do you
  do when..." not "would you use...".
- Add contextual-inquiry framing where a site visit or screen share is possible: the request is
  "do the task while I watch and narrate", and the questions become interruptions at moments of
  interest, not a script (interview-facilitation carries the observation protocol).
- Recruit for recency: people who did the task this week, not people who remember doing it.

## Deciding factors
- If the anchor analysis is thin (class D/F intake), the question set IS the reconstruction
  interview's six passes (spec-intake), and this skill's derivation rules run over the derived
  brief afterwards for the follow-up session instead.
- Follow-up sessions get regenerated, targeted sets: only what the last session opened or
  contradicted. Never re-ask what is already (confirmed); re-asking teaches the DA that
  answering carefully is pointless.

## Quality bar (self-evaluation)
- Trace test: every silence and every commitment from the anchor analysis is covered by at
  least one question, or explicitly waived with a reason.
- Specificity test: would this question set make sense for any other client? If yes, it is
  generic and the derivation was not run.
- Lint pass recorded as run, with the rewrites it caused.

## Guardrails
- Questions must be answerable by the person asked.
- Do not ask the document's questions back at the client: if [DOC] answers it, spend the time
  verifying the commitment's edges instead.
- The share-version never includes ladders; ladders read as interrogation prep and change how
  people answer.

## Output
`10-discovery/questions.md`: share-version on top; facilitator version below with groups,
priorities, ladders, answerer tags, and register/agenda cross-references.

## Exit criteria
- Every silence and commitment covered or waived with reason
- Every primary laddered; lint pass clean; answerers assigned
- Share-version sent to attendees ahead of the call

## Failure modes
- Generic questions any project could ask: symptom of a skipped anchor analysis.
- Ladder-less primaries: the call yields statements without edges, and Phase 2 inherits the
  ambiguity.
- Hypothetical creep: "would you" questions producing feature opinions that later masquerade as
  requirements.
- Over-asking: forty questions delivered flat, the DA exhausted by minute thirty, the
  consequences group never reached.
