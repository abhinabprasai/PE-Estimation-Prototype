# 50-prototype/: the throwaway

Owner: prototype-engineer. Precondition: a complete six-part prompt. No prompt, no prototype.

```
prompt-used.md    the exact prompt the build came from
build-notes.md    deltas: what the generator got wrong, traced to which prompt part
{the build}
ARCHIVED/         build + prompt, moved here after Gate 1
```

## What this is

An interview instrument. Its success is measured in corrections produced, not in approval
received. The framing at Gate 1, said out loud: "This is disposable. I built it to be wrong in a
useful way. Tell me where it is wrong."

## Fidelity: where to spend

Build properly: realistic content at realistic volume, every status the sketch entities can hold,
the empty state and one error state, the complete happy path end to end, native keyboard-operable
controls, the table at the client's real row count.

Leave obviously rough: colour, typography, shadows, icon craft, animation, responsive behaviour,
anything the scope boundary excluded. A domain authority looking at five badges will name the
sixth status, which is worth days. One looking at slightly wrong spacing will comment on the
spacing, which is worth nothing at this gate.

## After Gate 1

Build and prompt move to `ARCHIVED/`, with a one-line note in `STATE.md`. Hi-fi never starts from
these screens (GUARDRAILS 4). Opening the archive requires saying why, out loud, first.

Exception: `designer_engagement: demo` in PROJECT_CONFIG disables the archive rule, inverts the
fidelity table, and raises the quality bar.

Delete this file once the folder holds a real build.
