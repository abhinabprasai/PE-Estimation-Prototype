# P3 — wiring `concept-exploration` into the system

Drop `skills/concept-exploration/` into `.claude/skills/`. Then six edits.

---

## 1. `.claude/agents/hifi-spec-designer.md` — frontmatter

```yaml
skills: hifi-spec, concept-exploration, dummy-content, visual-design, content-design, accessibility
```

Add to its **Operating rules**, between the current 3 and 4 (renumber the rest):

```markdown
4. **Three concepts before block 1, for the screens that earn it.** After the state enumeration
   table and before any specification: the feature's primary screen, any screen the team has
   already argued about, and any screen whose cost table claims the largest improvement each get
   three genuinely different compositions at deliberately low fidelity (`concept-exploration`).
   Kill two, one line each on why, naming the criterion. File all three. Everything else is drawn
   directly. Half a day per feature; if it is running longer the concepts are being drawn too
   well, which defeats the mechanism exactly as polishing the throwaway prototype does.
```

And to its **Quality bar**:

```markdown
- Every in-scope screen has three concepts on file with the winner marked and one line per loser
  naming the criterion; zero merges
```

## 2. `.claude/skills/hifi-spec/SKILL.md` — the procedure

Insert a new step between the current 3 and 4:

```markdown
3a. **Explore before specifying.** For this feature's primary screen (and any screen already
    argued about, or carrying the largest claimed improvement), run `concept-exploration`: three
    compositions differing on one stated axis, twenty minutes each, greyscale, real data. Judge
    against the cost table, the hierarchy method, exception load, state load and retraining cost.
    Kill two. File all three at `70-hifi/{feature}/concepts.md`. The winner enters block 1.

    The reason this step sits here and not earlier: the state enumeration table is what tells you
    how expensive each concept actually is, and state load is the criterion teams most reliably
    forget. The reason it sits before block 1: nine blocks per screen is a strong disincentive to
    reconsider a composition, so the reconsideration has to happen while it is still free.
```

And add to **Preconditions**:

```markdown
- The concepts round is run and its winner chosen, for every screen in `concept-exploration`'s scope
```

## 3. `CLAUDE.md` §4 — routing table

```markdown
| Concept exploration, composition alternatives, the kill decision | hifi-spec-designer |
```

## 4. `CLAUDE.md` §5 — artifact dependency order

```
refined-requirements + prioritized-list -> state-enumeration -> concepts -> hifi
```

(replacing `refined-requirements + prioritized-list -> hifi`)

## 5. `.claude/commands/gate-3.md` — pre-checks

```markdown
- `70-hifi/{feature}/concepts.md` present for every in-scope screen: three concepts, winner
  marked, one line per loser naming the criterion it lost on. A single composition arrived at
  directly is a first idea specified well
```

Add to **Protocol**:

```markdown
- Spot-check one concepts file. Read the three one-sentence statements. If two are the same
  sentence, the round produced variations rather than concepts and the decision is not yet made
```

## 6. `.claude/skills/design-critique/SKILL.md` — lens 1

Add to Lens 1 (Hierarchy):

```markdown
- Read the concepts file. Which alternative was rejected, and does the finding you are about to
  raise describe that alternative? If it does, the decision was made deliberately and your finding
  is a challenge to a recorded reason, which is a legitimate thing to raise and a different thing
  from a defect. Say which it is.
```

This is the highest-value line in the patch set for critique quality. Most "I would have done it
differently" findings are exactly the rejected concept, and being able to point at it converts an
unwinnable taste argument into a one-minute conversation about a recorded criterion.

---

## A note on cost

The obvious objection is that this adds half a day per feature to the most expensive phase. Two
answers.

First, it does not add half a day; it moves it. The cost currently lands as Type A patches during
Gate 3 and client validation, where it is more expensive and produces no record.

Second, the scope table is doing real work. A typical prioritized feature has **one or two** screens
in scope, not eight. Detail views, confirmations and settings are drawn directly. If a project finds
itself running concept rounds on twelve screens per feature, the scope table is being ignored and
that is the defect, not the skill.
