---
name: throwaway-prototype
description: "Generates the timeboxed interview instrument, spends fidelity where it produces corrections, frames it at Gate 1, and archives it after. Use when a complete six-part prompt exists, or when planning what the prototype should test."
---

# Throwaway Prototype

## Purpose
Make abstract discussion concrete so the domain authority can correct specifics. The
prototype is a question, not an answer; its success is measured in corrections produced,
not in approval received.

## Preconditions
- A complete six-part prompt (all parts present; incomplete prompts go back to
  prompt-authoring, they are not patched here)
- Target process chosen: the one with the most Phase 1 contradictions attached, agreed
  with the orchestrator
- Timebox declared in STATE.md BEFORE generation starts. Default anchors, overridable in
PROJECT_CONFIG: one working day at `rule_density: low`, two at `high`, three where the target
process spans more than four entities. A project that cannot say its timebox has not decided
what it is testing

## Procedure
1. Generate from the prompt as written. Resist in-tool improvisation: every manual patch
   is prompt debt that the next generation loses.
2. One process end to end beats many shallowly. If the build cannot complete the job in
   part 2 of the prompt, narrow until it can.
3. Record deltas in build-notes.md: what the generator got wrong, traced to which prompt
   part. Fix the part with prompt-authoring, regenerate if the timebox allows; otherwise
   note it for the gate.
4. Copy the exact prompt used to 50-prototype/prompt-used.md; the pair is what gets
   archived.
5. Gate framing, said out loud and verbatim in spirit: "This is disposable. I built it to
   be wrong in a useful way. Tell me where it is wrong." Never demo it as a preview of
   the product; approval-seeking here poisons the gate.
6. After Gate 1: move build + prompt to 50-prototype/ARCHIVED/, one-line note in
   STATE.md. Confirm to the orchestrator; hi-fi never starts from these screens
   (GUARDRAILS 4).

## Fidelity: what to build well and what to leave rough

The prototype is an interview instrument, and fidelity is spent where it produces corrections.
Get this backwards and the gate discusses spacing instead of the domain.

| Build it properly | Leave it obviously rough |
|---|---|
| Realistic content at realistic volume (`dummy-content`), including one negative, one zero, the longest plausible name, and every guessed status | Visual polish: colour, typography, shadows, icon craft |
| Every status the sketch entities can hold, visible somewhere | Anything the scope boundary excluded |
| The empty state and at least one error state | Animation and transitions |
| The complete happy path of the job in part 2, end to end | Auth, settings, exports, anything not on the path |
| Native, keyboard-operable controls with visible focus | Responsive behaviour, unless a role genuinely works on a tablet |
| The table or list at the client's real row count | Perfect alignment and off-scale nudging |

The reason is asymmetric: a DA looking at five badges will name the sixth status, and that is a
Type B correction worth days. A DA looking at slightly wrong spacing will comment on the spacing,
and that is worth nothing at this gate. Visible roughness in the visual layer actively protects
the gate's attention (GUARDRAILS 12).

Where `designer_engagement: demo`, this table inverts: the prototype is the deliverable, the
quality bar rises, and `visual-design`, `content-design` and `accessibility` apply in full.

## Deciding factors
- Timebox exceeded is a STOP signal, not an extension request. The named symptom of
  drift is feeling attached to the build. Report and stop.
- Realistic-enough data: use dummy-content rules even here; lorem ipsum in a rule-dense
  screen hides exactly the problems the gate should catch.
- demo engagement (config): this skill's framing and archive sections are OFF; quality
  bar rises; coordinate with hifi-spec for states and content instead.

## Probing prompts (bring to Gate 1 alongside the build)
- "Complete the job on this build in front of me; narrate where it lies."
- "Which screen would a new hire misread first?"
- "What does this build let you do that reality forbids?" (constraint leaks)
- "What does reality require that this build has no place for?" (missing entities/steps)

## Quality bar (self-evaluation before the gate)
- The job in prompt part 2 is completable end to end on the build, verified by actually
  completing it, not by inspecting screens.
- Every guessed status is visible somewhere on the build; the fidelity table's left column is
  fully served.
- build-notes.md traces every known delta to a prompt part.
- The framing script is planned into the gate agenda, not left to improvisation.

## Guardrails
- No prompt, no prototype; no exceptions
- Archive is unconditional post-Gate 1 outside demo engagements; anyone proposing to
  polish it into hi-fi triggers escalation (GUARDRAILS 9.5)
- A build violating a (confirmed) constraint is a prompt defect: loop prompt-authoring
  before regenerating

## Output
- The build, 50-prototype/prompt-used.md, build-notes.md; ARCHIVED/ after the gate

## Exit criteria
- Gate 1 held with the build as instrument; corrections captured and classified; archive
  confirmed in STATE.md

## Failure modes
- Attachment: the timebox stretches and the throwaway quietly becomes the design
- Approval demo: the gate produces nods instead of corrections, and the phase's cheapest
  learning window closes unused
