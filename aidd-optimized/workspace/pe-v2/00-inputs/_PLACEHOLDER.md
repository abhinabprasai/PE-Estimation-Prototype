# 00-inputs/: the spec slot and everything the client gave us

**This is where the actual PRD or project spec goes.** Put the client's document here, verbatim,
and record it in `PRD.md`'s header block.

## Files

| File | Status | Owner |
|---|---|---|
| `PRD.md` | Exists from day one. Client spec verbatim, or the completed placeholder record | spec-intake |
| `spec-intake.md` | Inventory, intake class, the fourteen audit scores, absence-to-question mapping | spec-intake |
| `assumptions.md` | The assumption register, live for the project's life | spec-intake, then everyone |
| `audit/` | Screenshots and per-screen notes when the anchor is an existing product | spec-intake |
| `{yyyy-mm-dd}-{source}-{slug}.{ext}` | Every client material, origin-and-date named | whoever receives it |

## Rules

1. **Read-only once filed.** Client documents are never edited. Corrections happen in
   `60-requirements/refined-requirements.md`, which records what the document said, what the
   domain authority corrected, and why the resolution won.
2. **Nothing here goes into a web query**, including for checking what a term means
   (GUARDRAILS 8).
3. **`PRD.md` is never absent and never an unedited template** past Phase 0. If it still looks
   like the template, nobody has decided how this project will learn what it is building; run
   `/intake-spec`.
4. **A late-arriving spec does not delete anything.** File it, run `spec-intake` again, and
   reconcile it against what the project already derived. Disagreements are contradictions with
   owners (GUARDRAILS 3), not a reason to discard derived work.

## If there is no spec

That is a supported starting condition, not a blocker. `spec-intake` classifies it (class D, E or
F), opens the assumption register, and runs the six-pass reconstruction interview that produces
`10-discovery/derived-brief.md`. Once signed, that brief is the anchor document. The absence is
disclosed in `STATE.md` blockers, in every gate report until a signed brief exists, and in the
handoff manifest.

Delete this file once the folder holds real inputs.
