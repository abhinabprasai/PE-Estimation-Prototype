# P4 — the outcome layer

Three files drop in (`templates/measurement-plan.md`, the revised
`templates/refined-requirement-entry.md`, the revised `templates/traceability-matrix.md`). This
file is the wiring that makes them load-bearing rather than decorative.

The problem being fixed: `spec-audit-checklist.md` dimension 1 asks for the business goal and its
measure, warns that without it "every feature argument becomes taste", and then the answer appears
in no downstream artifact. Prioritization ranks by pain index, which is process cost. The three
loop metrics all measure the process. The system can prove every requirement is implemented and
cannot suggest that any of them mattered.

---

## 1. `.claude/agents/requirements-reconciler.md`

Frontmatter description, add: `Opens and maintains the measurement plan.`

Add to **Operating rules**:

```markdown
12. **Open `measurement-plan.md` at the start of Phase 2B**, from
    `templates/measurement-plan.md`, seeded from spec-audit dimension 1 and the consequences
    question group. Three to five outcomes, each with one indicator, a baseline with its source
    and date, a target with a by-when, and a counter-metric. Where the audit scored dimension 1
    ABSENT (which is common), the outcomes are derived in the reconstruction interview and carry
    `(asserted)` until the PO signs them at Gate 2.

13. **Every optional-partition entry names its outcome.** `NONE` is legitimate only for entries
    mandatory by law or contract, audited against the authority classes from `anchor-analysis`.
    Two findings come out of the mapping and both are surfaced at the trade session: an optional
    entry serving no outcome (prioritized by seniority), and an outcome served by no entry (either
    a gap in the list or an outcome not actually being pursued, which should be said out loud).

14. **Baselines are measured before Gate 2 where measurement is possible.** On an existing-product
    engagement the team has a login: status-transition timestamps, ticket volumes, export
    histories. One query answers in an hour what the as-is estimated from recall. Where it is
    genuinely impossible, the recalled figure is used and tagged `[DA] (asserted)` with its method
    stated. A baseline captured after the new system is in use is not a baseline.
```

## 2. `.claude/skills/prioritization/SKILL.md`

The method-selection table is good and stays. Add before it:

```markdown
## The value dimension

Every method in the table below needs one, and until now this file supplied only the pain index,
which counts manual movements, error rows, waits, crossings and systems touched. That is process
cost. It is real evidence and it is not value: a flow can be expensive to run and worth nothing to
improve, and a flow can be cheap to run and be the one the business is losing money on.

The value dimension comes from `60-requirements/measurement-plan.md`. Per candidate:

| Input | Source |
|---|---|
| Outcome served | The `OUT-{n}` on the requirement entry |
| Expected movement in that indicator | Argued at the trade session, with the mechanism named |
| Confidence in that movement | high / medium / speculative, stated, never averaged away |
| Pain-index delta | `to-be-design`, as before |
| Effort | `[TEAM] (asserted)`, with an engineering voice in the room |

Rules:

- **A candidate with no outcome does not get scored.** It goes back to the reconciler to find one
  or it moves down the list. This is the single change that stops the list ranking by seniority.
- **Confidence is carried, never multiplied into the score and forgotten.** Three speculative
  high-value candidates at the top of a list is a portfolio decision the PO should make knowingly.
- **A high pain-index delta serving no outcome is a candidate for automation or elimination, not
  for design.** Sometimes the right answer is that the process should stop, and the pain index is
  the only evidence column that can say so.
```

Amend the trade-session attendance line:

```markdown
The session is PO + DA + an engineering voice for effort. Where `users_reachable: true`, the
importance half of opportunity scoring comes from the Phase 1 user interviews rather than from
the room's intuition, and it is the only method in the table that gets a real value input without
one.
```

## 3. `.claude/skills/hifi-spec/SKILL.md` — block 3

Add to DEV NOTES:

```markdown
- **Instrumentation.** The events or records this feature must emit for its outcome's indicator to
  be readable, from `measurement-plan.md`. An indicator with no instrumentation row in any spec is
  an indicator nobody will be able to read after launch, and the plan becomes decorative. Nothing
  personal: aggregate by role, never by named operator.
```

## 4. `.claude/commands/gate-2.md`

Pre-checks:

```markdown
- `60-requirements/measurement-plan.md` drafted: three to five outcomes, one indicator each,
  baseline with source and date, target with a by-when, counter-metric named
- Every optional-partition requirement names its outcome or is explicitly listed as unmapped
- Baselines measured where measurement was possible; recalled baselines tagged with their method
```

Exit criteria:

```markdown
- Measurement plan signed by PO and DA alongside the prioritized list. The signature says the
  outcomes are the ones the business wants and the baselines are true
- Instrumentation requirements identified per outcome and assigned to a feature
```

## 5. `.claude/skills/handoff-package/SKILL.md`

Add to rule 1's package list: `the measurement plan with its baselines and its booked read-at date`.

Add a rule:

```markdown
12. **Book the post-launch review before you close.** The date is in the measurement plan and it
    is the only thing in this process that can eventually say whether the work was worth doing.
    A review with no date is a review that does not happen, and the plan then joins the artifacts
    that were produced correctly and read by nobody.
```

## 6. `.claude/skills/md-spec-loop/SKILL.md` — a fourth metric

```markdown
### Metric 4: outcome movement

From the post-launch review in `measurement-plan.md`: per outcome, the baseline, the target, and
the actual, with the counter-metric.

The first three metrics measure whether the system is getting cheaper to run: falling rework,
falling clarification requests, rising code reuse. All three can improve while the products get
worse, and a loop that records only those three has optimised itself and left the product
unmeasured. This is the metric that is about the product.

It arrives late - months after close - and it arrives for the previous project rather than this
one. Record it against the project it belongs to and read it at the next loop review. A metric
that is inconvenient to collect is not the same as a metric that does not matter.
```

## 7. `config/STATE.template.md`

```markdown
## Outcome record

Source: `60-requirements/measurement-plan.md`. Signed at Gate 2, read at the date below.

| Outcome | Indicator | Baseline (source, date) | Target (by) | Instrumented in | Owner | Read at | Actual |
|---|---|---|---|---|---|---|---|
```

## 8. `config/PROJECT_CONFIG.template.md`

Add to the derived-obligations checklist:

```markdown
- [ ] spec-audit dimension 1 scored ABSENT or PARTIAL -> outcomes are derived in the
      reconstruction interview, carry (asserted) until the PO signs at Gate 2, and the fact is
      disclosed in every gate report until then
- [ ] anchor_document = existing-product -> baselines are measured from the running system before
      Gate 2, not recalled
```
