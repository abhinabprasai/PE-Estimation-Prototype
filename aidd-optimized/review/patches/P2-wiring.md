# P2 — wiring `usability-testing` into the system

Drop `skills/usability-testing/` into `.claude/skills/`. Then eight edits.

---

## 1. `.claude/agents/design-critic.md` — frontmatter

```yaml
skills: design-critique, accessibility, content-design, usability-testing
```

design-critic is the right owner: it already owns the pre-gate quality bar, it already routes
findings into S1–S4 and Type A/B, and it is already the agent that runs *before* gate-reviewer.
Adding a fourth skill to an agent that has three is cheaper than a fifteenth agent.

Add to its **Operating rules**, after rule 9:

```markdown
10. **A critique is not a test.** Before Gate 3 the prioritized flows are attempted by real
    operators (`usability-testing`), not reviewed by you. Your lenses find what disagrees with
    a written rule; the sessions find what disagrees with how a person works. Run the critique
    first so the sessions are not spent on defects the team could have found itself, then run
    the sessions, then re-run only the lenses the findings touch.
```

Add to its **Escalate when**:

```markdown
- Users are unreachable and the round would run with the DA as participant: the substitution is
  declared in the gate's first sentence and R-SME-SUB stays open through handoff
- A usability finding is structural and the list is locked on a fixed-bid engagement
```

## 2. `CLAUDE.md` §1 — the phase table

Phase 3's owner list becomes:

```
| 3 | Test + Prototype | convergent and divergent | hifi-spec-designer, ui-designer, design-critic (critique, then usability round) |
```

## 3. `CLAUDE.md` §4 — routing table

Add a row:

```markdown
| Usability sessions, task construction, participant recruitment, session findings | design-critic |
```

## 4. `CLAUDE.md` §5 — artifact dependency order

```
hifi -> design-critique -> usability-round -> gate
```

(replacing `hifi -> design-critique -> gate`)

## 5. `CLAUDE.md` §9 — what you never do

```markdown
- Never let Gate 3 run without either a usability round on the prioritized flows or an explicit,
  recorded substitution stated in the gate's first sentence. An internal review is not validation.
```

## 6. `.claude/commands/gate-3.md` — pre-checks

Add:

```markdown
- `usability-testing` round run on every prioritized flow whose cost table claims an improvement:
  report filed at `70-hifi/usability/`, zero open S1 findings or each declared with an owner.
  Where users were unreachable, the DA substitution is stated in the gate's first sentence and
  R-SME-SUB is listed as still open
- Predicted versus observed recorded per tested flow, including where the prediction was wrong
```

And to **Protocol**:

```markdown
- Read the usability round's task x participant grid aloud before the line-by-line. A gate that
  reviews specs without knowing which tasks failed is reviewing the wrong thing first
```

## 7. `.claude/commands/gate-1.md` — pre-checks (conditional)

```markdown
- Where `users_reachable: true`: at least one operator attempted the prototype's target job
  (`usability-testing`, Gate 1 form: one task, one participant per key role, no scoring).
  The prototype is an interview instrument for the domain and it is free evidence about the
  interface at the same time
```

## 8. New command `.claude/commands/usability-round.md`

```markdown
---
description: "Run a usability round on the prioritized flows: task construction, sessions, scoring, and routing into the Type A/B machinery"
---
Run a usability round for $ARGUMENTS (a feature, a flow, or "all prioritized"). Delegate to
design-critic with the usability-testing skill.

Pre-checks (block and report which fail):
- Gate 2 passed; the prioritized list is signed
- `/design-qa` run at the full lens set with zero open S1. Sessions spent finding a missing empty
  state are sessions wasted
- A clickable artifact exists for each flow's primary path plus its two most consequential
  exception paths
- `dummy-content` populated. In this domain participants read the data before the interface
- Participants recruited: five per role, operators not proxies, performed the task in the last
  two weeks. Shortfalls are named now, not in the report

Protocol:
- Tasks are goals with the real source artifact in hand, three to five per session, the
  highest-consequence flow second, at least one exception path per session
- Two people: a moderator who watches the participant, a notetaker who watches the screen
- Do not help. Wait, then "what are you looking for?", then "what would you do if I were not
  here?" Record every rescue
- Debrief with the notetaker after each session, not at the end of the day

Scoring and routing:
- Record per task: completed unaided / with a prompt / **completed wrong** / abandoned; time;
  first click separately from destination; errors; verbatims
- "Completed wrong" is scored more severely than an abandonment. It is the defect that reaches
  production and gets found by an audit
- Two or more wrong completions, or unaided success below 3 of 5, is S1
- Anything a participant says about how the work actually happens that contradicts the flows is
  **Type B** and routes to requirements-reconciler before any screen changes
- Three or more S1/S2 on one flow means the flow's structure is wrong: re-open that flow's
  optimization, the same way three Type Bs on one Phase 1 topic re-opens that topic

Exit criteria:
- Every prioritized flow whose cost table claims an improvement has been attempted by an operator
- Report filed at `70-hifi/usability/{round}-{date}.md` and attached to the pre-Gate-3 critique
- Every Type B routed before any screen changed
- Predicted versus observed added to each tested flow's cost table
- STATE design quality record updated

A round with no failures is a warning, not a pass. Probe before accepting it and record the probes.
```

Update the command count in `README.md`, `docs/USAGE.md`'s command table, `docs/SKILL-INDEX.md`,
and `docs/guide/01-front.html` (9 commands → 10, 34 skills → 36 after P3).
