# P1b — GUARDRAILS edits

Two changes. Apply after `P1-hygiene.sh`.

---

## 1. The tag table (D-07)

`GUARDRAILS.md` section 1 currently defines six source tags. `[USER:role]` is used in three files
(`USAGE.md:120`, `interview-facilitation/SKILL.md:77`, `discovery-lead.md:61`) and defined in none.

This is not cosmetic. On a `domain_authority: end-users` project — a legal configuration — user
testimony carries a tag the confirmation ladder cannot resolve. Section 2 requires
behaviour-constraining claims to be `(confirmed)` *by the domain authority*; if users **are** the
domain authority, the ladder has no rung for them and nothing users say can enter refined
requirements. The configuration deadlocks.

**Replace the source-tag table with:**

```markdown
| Tag | Meaning |
|---|---|
| `[PO]` | Product owner said it |
| `[DA]` | Domain authority said it |
| `[USER:role]` | An end user in a named role said it, in an interview or an observation session |
| `[TEAM]` | Team member raised it (name them) |
| `[DOC:section]` | Anchor document, with section reference |
| `[RESEARCH:source]` | External research, with the source named |
| `[LLM]` | Model inference, not yet verified by anyone |
```

**And add this paragraph immediately after the confidence-marker table:**

```markdown
`[USER:role]` and the confirmation ladder. Who counts as the domain authority is set by
`domain_authority` in PROJECT_CONFIG:

- `domain_authority: sme` — `[USER:role]` statements are evidence about how the work is
  actually done, and they are `(asserted)`. They cannot reach `(confirmed)` on their own.
  Where a user statement contradicts the SME, that is a contradiction with an owner
  (section 3), not a user being wrong.
- `domain_authority: end-users` — `[USER:role]` is authority testimony. It reaches
  `(confirmed)` when the same statement is independently given by two users in the same role,
  or once by one user and verified against a real record. One person's recollection is
  `(asserted)`, exactly as one SME's is.
- `domain_authority: both` — a claim is `(confirmed)` when the SME and at least one user agree.
  Disagreement is a contradiction, and it is usually the most valuable finding in the project:
  it is the gap between the policy and the practice.
```

---

## 2. Section 11, the design floor — three additions

The floor is good. Three items are missing that this process's own skills already assume.

**Add to the section 11 list:**

```markdown
- **A design is validated by someone who does the work.** Before Gate 3, every prioritized
  feature's primary task has been attempted by a real operator on the hi-fi set
  (`usability-testing`), or the substitution is named in the gate's first sentence and carried
  as R-SME-SUB through handoff. An internal review is not validation; it is the thing you do
  so that validation is not wasted on defects you could have found yourself.

- **A screen that could have been shaped differently was.** Every primary screen has at least
  two rejected compositions on file with one line each on why they lost
  (`concept-exploration`). A single composition arrived at directly is a first idea specified
  well, and the specification quality disguises the fact that nothing was chosen.

- **Every requirement names the outcome it serves.** A requirement with no outcome and no
  measure cannot be prioritized against another requirement except by seniority, and
  seniority is not a ranking method.
```

Note that all three are stated in the same violation-checkable form as the existing floor items:
a reviewer can point at a project and cite them. That is the test `style-guide-authoring:12`
applies, and the current section 11 passes it — these additions must too.
