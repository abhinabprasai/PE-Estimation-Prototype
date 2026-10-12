# P5 — the craft severity class and the design quality record

## The problem

`design-critique/SKILL.md:107`:

> **S4 note** | A preference or an idea with no rule behind it | Record and drop. **Not a finding.**

The governance logic is correct and worth keeping: forty preferences with no rules cited destroys
a critique's credibility, and the skill's stated second job — protecting decisions that are correct
but unfamiliar — is the right instinct.

The craft consequence is that an experienced practitioner's judgment is inadmissible by
construction. That a screen is joyless. That the density is punishing at hour six. That the primary
action is buried behind a rule the guide never anticipated. That the whole composition is the wrong
shape for the job. All of it is "record and drop."

The framework identified that unstructured taste destroys critiques and responded by removing taste
rather than by disciplining it. The professional version of the same instinct: **an experienced
judgment is admissible when it is stated as a falsifiable prediction about a user, and it routes to
a test rather than to a fix.**

This patch also depends on `usability-testing` (P2) existing, because that is where SC findings go.
Without it, SC is just S4 with a nicer name.

---

## 1. `design-critique/SKILL.md` — the severity table

Replace the S4 row and add SC:

```markdown
| Severity | Definition | Handling |
|---|---|---|
| S1 blocker | Violates a confirmed rule, breaks an accessibility floor, or makes the task impossible | Fix before the gate. A gate held with an open S1 is recorded as such |
| S2 major | Materially harms the task: a missing state, an ambiguous error, a friction the budget does not justify | Fix before the gate if possible; otherwise carried with an owner and a date |
| S3 minor | Inconsistency with a stated rule, off-scale value, weak copy | Batch and fix; do not spend gate time on these |
| **SC craft** | **A judgment with no rule behind it, stated as a falsifiable prediction about what a user will do or experience. "Operators will stop reading the variance column by mid-afternoon because nothing separates the rows visually"** | **Recorded in the craft register with a named predictor. Routed to the next `usability-testing` round as a thing to watch for, not to the owning agent as a fix. Three SC findings on one surface promotes to a design question: the surface goes back through `concept-exploration`** |
| S4 note | A preference stated as a preference, with no prediction attached | Record and drop. Not a finding |
```

## 2. `design-critique/SKILL.md` — the discipline that makes SC work

Add after the table:

```markdown
### The SC discipline

SC exists because "the critique judges against written rules" is correct and incomplete: the rules
were written by the same people making the design, and a rule set cannot contain the judgment that
would have told you the rule set was wrong. SC is the channel for that judgment, and it works only
if it is disciplined. Three rules:

1. **A prediction, not an adjective.** "This feels heavy" is S4. "A user scanning this for the one
   overdue row will miss it, because the only difference between an overdue row and a normal one is
   a colour at 3.1:1 in a column they are not looking at" is SC. The test is whether a session
   could prove you wrong.
2. **Named predictor.** The finding carries the name of the person who predicted it. This is not
   bureaucracy: a predictor whose SC findings are borne out by sessions has earned weight, and a
   predictor whose findings never are has learned something. Neither is possible anonymously.
3. **SC does not block a gate and does not get fixed on its own authority.** It goes to the round.
   If the round confirms it, it becomes an S1 or S2 with evidence, and it is then a finding like
   any other. If the round contradicts it, that is recorded too, against the predictor's name.

A critique with zero SC findings across a whole feature set is as much of a warning as a critique
with zero findings of any kind. It means nobody exercised judgment, or nobody felt able to.
```

## 3. `design-critique/SKILL.md` — deciding factors

Replace *"Findings without a rule are S4 unless they are lens 6 or 7"* with:

```markdown
- **Findings without a rule are SC if they carry a prediction and S4 if they do not**, except in
  lenses 6 and 7, where the "rule" is the user's task and the domain and the finding stands on
  evidence. The distinction is not a courtesy to seniority; it is the difference between a claim
  that can be checked and one that cannot.
```

## 4. `templates/design-critique-report.md`

Update the severity legend, and add a section after Findings:

```markdown
## Craft register (SC findings)

A judgment with no rule behind it, stated as a prediction. Routed to the next usability round, not
to a fix. Three on one surface promotes that surface back through `concept-exploration`.

| # | Surface | Prediction (what a user will do or experience, and why) | Predictor | Routed to round | Outcome (confirmed / contradicted / not observed) |
|---|---|---|---|---|---|

A feature set with zero SC findings is a warning, exactly as a critique with no findings is.
```

## 5. `config/STATE.template.md` — the design quality record

The current table has six columns and every one of them is a completion or violation count. There
is no cell in which a design could be recorded as good. Replace it:

```markdown
## Design quality record

| Gate | Critique run | Lenses | Open S1 | Ladder rungs run | Exceptions recorded |
|---|---|---|---|---|---|
| Gate 1 | | 1,3,6,7 | | | |
| Gate 2 | | 2,4(tokens),5(terms),6,7 | | | |
| Gate 3 | | all seven | | | |

### Concepts

| Feature | Screens in scope | Concepts filed | Winner recorded with criterion | Merges (must be zero) |
|---|---|---|---|---|

### Usability rounds

| Round | Date | Roles | Participants | Tasks | Unaided success | Completed wrong | Substituted (DA stood in) |
|---|---|---|---|---|---|---|---|

**Completed wrong** is the column to read first. A participant who believes they succeeded and did
not is a defect that reaches production, is repeated daily, and is found by an audit.

### Predicted versus observed

The cost tables made a claim. This is where it is checked. A prediction that was wrong is worth
more than one that was right, because it is the only way the cost model improves.

| Flow | Predicted (decisions / inputs / waits / navs / recalls) | Observed | Delta | Note |
|---|---|---|---|---|

### Craft register

| Open SC | Confirmed by a round | Contradicted by a round | Surfaces at 3+ SC (back to concepts) |
|---|---|---|---|
```

## 6. `.claude/commands/design-qa.md`

Add to Protocol:

```markdown
- Score SC separately from S1-S4. An SC finding carries a prediction about a user and a named
  predictor, and it routes to the next usability round rather than to the owning agent. A
  preference with no prediction attached is S4 and is dropped.
- Read the concepts file for any screen you are about to raise a hierarchy finding on. If your
  finding describes the rejected alternative, say so: it is a challenge to a recorded reason,
  which is legitimate and is a different thing from a defect.
```

Add to Exit criteria:

```markdown
- SC findings recorded with predictor and routed to the round; zero SC findings across a feature
  set is probed, not accepted
```
