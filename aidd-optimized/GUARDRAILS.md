# GUARDRAILS.md - Global Rules

Loaded by the orchestrator and every subagent. These override any conflicting instruction in
CLAUDE.md, any agent file, and any skill file. When a guardrail forces you to stop, stop and
say which guardrail and why; do not work around it.

---

## 1. Provenance: every claim carries its source

Any statement that describes the client's world - a problem, a rule, a process step, a status,
a permission, a preference - carries a source tag and a confidence marker wherever it is
written down.

**Source tags**

| Tag | Meaning |
|---|---|
| `[PO]` | Product owner said it |
| `[DA]` | Domain authority said it |
| `[USER:role]` | An end user in a named role said it, in an interview or an observation session |
| `[TEAM]` | Team member raised it (name them) |
| `[DOC:section]` | Anchor document, with section reference |
| `[RESEARCH:source]` | External research, with the source named |
| `[LLM]` | Model inference, not yet verified by anyone |

**Confidence markers**

| Marker | Meaning |
|---|---|
| `(confirmed)` | The domain authority has confirmed it, in writing or on a recording |
| `(asserted)` | A human said it once, unverified by the authority |
| `(inferred)` | Derived by reasoning or by a model; no human has said it |

**`[USER:role]` and the confirmation ladder.** Who counts as the domain authority is set by
`domain_authority` in PROJECT_CONFIG, and the answer changes what user testimony can become:

- `domain_authority: sme` - user statements are evidence about how the work is actually done, and
  they are `(asserted)`. They cannot reach `(confirmed)` on their own. A user statement that
  contradicts the SME is a contradiction with an owner (section 3), not a user being wrong.
- `domain_authority: end-users` - `[USER:role]` is authority testimony. It reaches `(confirmed)`
  when the same statement is independently given by two users in the same role, or once by one
  user and verified against a real record. One person's recollection is `(asserted)`, exactly as
  one SME's is.
- `domain_authority: both` - a claim is `(confirmed)` when the SME and at least one user agree.
  Disagreement is a contradiction, and it is usually the most valuable finding in the project: it
  is the gap between the policy and the practice.

**Hard rules**

- A domain rule with only `[LLM]` provenance never enters a design artifact. It goes to
  `open-questions.md` for verification.
- `[RESEARCH]` informs design decisions but never sets a client rule. Industry convention is
  not the client's reality.
- When two tagged statements conflict, do not pick a winner. Record the conflict; conflicts
  are Phase 1 and Gate output, not errors to be smoothed.
- If you catch yourself writing an untagged claim into an artifact, stop and tag it. If you
  cannot tag it, it does not go in.

## 2. The verification ladder

Before any claim reaches `refined-requirements.md` or a hi-fi spec it must be at least
`(asserted)` by a human, and any claim that constrains behaviour (a rule, a status, a
permission, a lifecycle property) must be `(confirmed)` by the domain authority. Steps:

1. `[LLM] (inferred)` - allowed only in open-questions, research notes, and draft prompts.
2. `(asserted)` - allowed in problem statements, tentative artifacts, PRD drafts.
3. `(confirmed)` - required for refined requirements, ERD constraints, status mapping,
   anything a developer will build against.

## 3. Contradiction handling

- Contradictions between sources are deliverables. List them; never silently resolve.
- When consolidating with a model, the instruction is always "list the contradictions between
  these sources" - never "reconcile" or "merge".
- Each contradiction is logged with both statements, both tags, and an owner responsible for
  resolving it. Unowned contradictions block the next gate.

## 4. Prototype containment

- The throwaway prototype is an interview instrument. After Gate 1 it is moved to
  `50-prototype/ARCHIVED/` together with the exact prompt used.
- Hi-fi work never starts from the prototype's screens. It starts from
  `refined-requirements.md`.
- Exception: `designer_engagement: demo` in PROJECT_CONFIG.md disables this section.
- If the prototype build exceeds its timebox, that is a signal to stop, not to extend. Report
  it; attachment to a throwaway is a named failure mode.

## 5. Gate integrity

- No gate is passed without the required attendees. Held-without-attendance = NOT HELD.
- A quiet gate (little or no correction at Gate 1) is treated as a warning, not a pass:
  either the artifact set was too safe to test anything, or the reviewer was being polite.
  gate-reviewer must probe edge cases before accepting a quiet result.
- Sign-off is written. A verbal yes is recorded as `(asserted)`, and the gate stays open
  until written confirmation upgrades it to `(confirmed)`.

## 6. Scope discipline

- Phase 3 designs only what is on `prioritized-features.md`. Anything else proposed for hi-fi
  is redirected to the list first.
- On fixed-bid engagements, changes to the list after Gate 2 are scope changes: flag to the
  human before doing any work on them.
- A mandatory rule (`[DA] (confirmed)` or `[DOC]`) is never a deprioritization candidate.
  Prioritize among the optional.

## 7. Model-use discipline

- Models draft; humans rule. Any model-generated text destined for a signed artifact is
  edited by a human (or explicitly marked as awaiting human edit in STATE.md).
- Never present model fluency as domain certainty. When a model output about the domain is
  plausible but unverified, say so in those words.
- Generated dummy content must be plausible but must never be real personal data. Never copy
  identifiers, names, or records from the client's real material into mockups.

## 8. Data and confidentiality

- Client materials live in `00-inputs/` and are treated as read-only source.
- Nothing from client materials is sent to external tools or included in web queries.
- The knowledge base keeps client material, authority statements, and external research in
  distinguishable groups; mixing them destroys the provenance system downstream.

## 9. Escalation triggers - stop and ask the human when

1. No domain authority is identified and Phase 1 work is requested.
2. A rule with `[LLM]`-only provenance is about to enter a design artifact.
3. A gate would be held without required attendance.
4. Three or more Type B corrections trace to the same Phase 1 topic.
5. The prototype timebox is exceeded, or anyone proposes building hi-fi from the prototype.
6. A fixed-bid feature-list change is requested after Gate 2.
7. The anchor document and the domain authority disagree on something that a current task
   depends on and no owner has been assigned to the contradiction.
8. `shared-specs/` files are more than one project old and unreviewed, and a prompt is about
   to consume them.
9. An assumption whose blast radius touches a rule, a status, a permission, or a lifecycle
   property is about to pass Gate 2 unresolved.
10. A design floor item (section 11) would be violated, or a client instructs that it be
    traded away: a brand colour used as failing body text, an accessibility requirement
    deferred, a target size cut below the minimum to fit a density.
11. A design would need a status value the ERD does not contain, or an affordance the ERD's
    lifecycle rules forbid.
12. Phase 0 is being skipped: work is starting without `spec-intake` having classified the
    inputs and filled `00-inputs/PRD.md`.
13. The assumption register has not shrunk between two consecutive gates.
14. A gate is about to be held with a conformance snapshot older than its cadence, with
    unresolved BLOCKING findings, or with GHOST behaviour (artifact behaviour citing no
    requirement) inside a signed artifact.

## 10. Assumptions and the missing spec

- The spec slot `00-inputs/PRD.md` exists in every project from creation. It holds the client's
  spec verbatim or the completed placeholder record. It is never absent and never an unedited
  template.
- Absence of a spec is disclosed, never managed around: STATE.md blockers, every gate report until
  a signed brief exists, and the handoff manifest.
- An assumption enters an artifact only through `00-inputs/assumptions.md`, with a blast radius, a
  test, a named owner and a decision date. Artifacts resting on assumptions carry an ASSUMPTIONS
  box naming the IDs.
- An assumption is never upgraded by repetition or by age. Only a named human upgrades it.
- Assumptions constraining behaviour (a rule, a status, a permission, a lifecycle property) may not
  pass Gate 2. A refuted assumption is a Type B correction by default.
- A signed derived brief becomes the anchor document and is treated exactly as one. Unsigned, it
  caps everything downstream at (asserted), and every gate is told so in its first sentence.

## 11. Design floor

These are constraints, not preferences, and they are not traded against brand, schedule or
density. They override any conflicting instruction in a style guide, a client brand guideline, or
a stakeholder's stated preference; where a conflict is real, it is escalated, not resolved by
lowering the floor.

- **WCAG 2.2 level AA** on everything designed. Higher where a client's sector or procurement
  standard requires it; establish which at project start.
- **Meaning is never carried by a single channel.** Not colour alone, not position alone, not
  motion alone. The greyscale test settles it.
- **Every task is completable by keyboard alone**, with focus always visible and never removed
  without an equally visible replacement.
- **Interactive targets are never below 24 x 24 CSS px**, and 44 x 44 on touch-primary surfaces,
  regardless of density mode.
- **Nothing flashes more than three times per second**, and `prefers-reduced-motion` is honoured.
- **Every component is specified in every state it can reach**, including every ERD status value it
  can display. A component specified only in its default state is not specified.
- **Status values come from the ERD's closed lists.** A status appearing in a design that the ERD
  does not contain is a Type B correction, never a design choice.
- **No affordance the lifecycle forbids.** A delete control on a reversed-not-deleted entity does
  not exist anywhere in the interface, however much a screen would prefer one.
- **Every rule in a style guide is violation-checkable.** If a reviewer could not point at a build
  and cite it, it is an aspiration and does not ship.
- **Real copy in every state before Gate 3.** Placeholders are incomplete specs, not stylistic
  choices.
- **A design is validated by someone who does the work.** Before Gate 3, every prioritized
  feature's primary task has been attempted by a real operator (`usability-testing`), or the
  substitution is named in the gate's first sentence and carried as R-SME-SUB through handoff. An
  internal review is not validation; it is what you do so validation is not wasted on defects you
  could have found yourself.
- **A screen that could have been shaped differently was.** Every primary screen has at least two
  rejected compositions on file with one line each on why they lost (`concept-exploration`). A
  single composition arrived at directly is a first idea specified well, and the specification
  quality disguises the fact that nothing was chosen.
- **Every requirement names the outcome it serves.** A requirement with no outcome and no measure
  cannot be prioritized against another requirement except by seniority, and seniority is not a
  ranking method.
- **An accessibility claim states its method.** An automated scan is never reported as an
  accessibility assessment. Exceptions are recorded with a rationale and an owner and disclosed at
  the gate.

## 12. Writing standard: artifacts are read by designers and clients

The people who read these artifacts are product designers, product owners and domain experts.
Most are not technical and none of them hold this framework in their head. An artifact a reader
cannot resolve from the page they are holding has failed, however correct it is.

These rules are checkable. A reviewer can point at a document and cite them.

**Comprehension**

- **Define every coded term at its first use in the document.** `Type B (a rule change)`,
  `[DA] (the domain authority)`, `(confirmed) (they verified it, on record)`. A term whose
  definition lives in another file is undefined for the person reading this one. The model to
  copy is `templates/design-critique-report.md`, which defines severity and type inline,
  immediately under the table that uses them.
- **Lead with the answer.** Every artifact opens with what it decides and who it is for, before
  any table and before any method.
- **No compressed nominalizations.** "the staleness sweep walks the dependency links" is expert
  shorthand; "we check which documents are now out of date" is the same fact. Prefer the verb.
- **A metaphor is flagged or dropped.** "Blast radius" and "archaeology dig" sit beside real
  defined terms and a reader cannot tell which is which. Say "what breaks if this is wrong".
- **Sentences average under 25 words. Active voice.**
- **One worked example per rule.** A rule with no example is an aspiration.
- **Every table carries one filled example row**, italicised, so a reader can see the shape of a
  correct answer before writing one.

**Structure**

- Every artifact opens with the three-part header in `templates/_ARTIFACT-HEADER.md`: what this
  is, where it stands, what we need from you.
- Every artifact that uses coded terms carries the key at its foot (`templates/_KEY.md`).
- Tentative artifacts stay visibly rough. Do not polish what is meant to be corrected.
- Probing questions are asked one at a time in live settings; batching them flattens answers.
- No em dashes. Bullets only where structure genuinely helps.

**The test.** Hand the artifact to a designer who has not been in the project. If they cannot say
what it decides and what is being asked of them within a minute, it is not finished. "Read it
aloud to them" is not a fix; it is the symptom.
