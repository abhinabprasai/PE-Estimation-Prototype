# P1 — the manual edits the script cannot do safely

## D-02 — Gate 3 has two contradictory protocols

`.claude/skills/gate-review/SKILL.md:96` currently says:

> The design-critique report for each feature is an input; Gate 3 does not re-run the seven lenses, it verifies the critique ran and spot-checks its claims.

`.claude/commands/gate-3.md:22` says the opposite, and the guide agrees with the command. Keep the command's behaviour — an independent re-run of the three lenses where self-critique is least reliable is exactly right. Replace the sentence in the skill with:

```markdown
The design-critique report for each feature is an input. Gate 3 does not re-run all seven
lenses; it verifies the critique ran, spot-checks its claims, and independently re-runs
lenses 3 (state completeness), 4 (accessibility) and 7 (domain fidelity). Those three
require reading the ERD rather than looking at the screen, which is where a self-critique
is least reliable.
```

## D-28 — misattributed glossary citations

Two files cite `GUARDRAILS 1` for "the glossary is the source":

- `.claude/skills/information-architecture/SKILL.md:83`
- `.claude/skills/userflows-sitemap/SKILL.md:91`

GUARDRAILS 1 is the provenance tag table and says nothing about definitions. Either drop the citation or, better, add the missing rule to GUARDRAILS 1 so the citation becomes true:

```markdown
- A domain term in an artifact uses the glossary's definition, or it is a glossary defect.
  A label with no glossary entry is a defect in one of the two files, never a local choice.
```

## build.py — two remaining items

**Dead variable**, around line 175:

```python
total = len(reader.pages)   # assigned, never used - delete
```

**Anchor / label off-by-one**, lines 36–44. The TOC entries read:

```python
("s-3-0", "3.1 Phase 0: Intake"),
...
("s-3-8", "3.9 Handoff"),
```

Anchor indices are permanently one behind their displayed numbers. Harmless today, compounding on every future insert. Renumber the anchors to match the labels, then update the corresponding `id=` attributes in `03-phases.html`.

**Also at line 33**, the TOC repeats the "five adaptation variables" error (D-06). Once CLAUDE.md §3 is corrected to nine, change:

```python
("s-2-8", "2.8 The five adaptation variables", 1),
```

to

```python
("s-2-8", "2.8 The adaptation variables", 1),
```

and rebuild.

## D-06 — the adaptation variables (do this by hand, it needs judgment)

`CLAUDE.md:53` says "The five adaptation variables". The config declares nine that affect routing. Worse, two of them claim the same routing effect with no precedence:

- `CLAUDE.md:59` — `domain_authority: end-users|both` → "add user interviews to Phase 1 and usability testing to Phase 3"
- `PROJECT_CONFIG.template.md:25` — `users_reachable: true` → "adds user interviews (Phase 1) + usability tests (Phase 3)"

Recommended resolution — they are genuinely different questions and both should survive:

- `domain_authority` answers **who rules on domain truth**. It should *not* carry the research routing.
- `users_reachable` answers **can we get to operators at all**. It should carry the research routing, because it is the thing that is actually true or false about a project.

So: delete the routing clause from the `domain_authority` row in CLAUDE.md §3, keep `sme only on a user-facing product → log R-SME-SUB`, and add these four rows to the table:

```markdown
| minimum_set | true / false | true: only the minimum artifact set is mandatory (section 3, below the table). Every skill still applies when invoked. |
| users_reachable | true / false | true: user interviews in Phase 1, usability testing before Gate 3 (`usability-testing`), opportunity scoring available to prioritization. false: log R-SME-SUB and state the substitution in every gate report. |
| intake_class | A / B / C / D / E / F | Set by `spec-intake`, never guessed. C-F: substitute path owner named, signed brief is a Gate 1 exit item. E: as-is work is an audit of the build. |
| accessibility_level / accessibility_driver | AA (floor) / AA+named / sector standard | Above AA: the raised criteria are listed in `skills-md/a11y.md` and checked at the Gate 2 token pass. |
```

and change the heading to `## 3. The adaptation variables`.
