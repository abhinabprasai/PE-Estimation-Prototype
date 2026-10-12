# P6 — the two ordering fixes

Small edits, large consequences. Neither requires new content; both require the artifact contracts
to be made consistent with reasoning that is already correct elsewhere in the repo.

---

## Part 1 — S6: accessibility is checked once, at the end

### The defect

The lens schedule is consistent across five files: Gate 1 = lenses 1,3,6,7 · Gate 2 = 2,6,7 ·
Gate 3 = all seven. So **lens 4 (accessibility) and lens 5 (content) never run before pre-Gate 3**,
the last internal checkpoint.

`accessibility/SKILL.md:206-208` names its own top failure mode:

> **Audit-at-the-end.** Findings arrive when the tokens, the components and the flows are all
> settled, and half of them are unaffordable.

And every accessibility exit criterion in that file is labelled "(Gate 3)". And `GUARDRAILS.md:157`
calls WCAG 2.2 AA a non-tradeable floor. The process schedules the exact failure its own skill
warns against, for the one requirement it declares non-negotiable.

### The fix

Split lens 4 by what it examines rather than by when it is convenient. At Gate 2 the design
language exists and the screens do not, so the token-level half is both possible and cheap. At
Gate 3 the screens exist and the screen-level half is the only half left.

**`design-critique/SKILL.md` — Lens 4, replace the heading and add the split:**

```markdown
### Lens 4: Accessibility

Runs in two halves, at two gates, because the two halves become unaffordable at different moments.

**4a. Token and system level — runs at Gate 2, against the design language.**
Nothing here needs a screen to exist, and every item here repaints everything downstream of it if
found late.
- Contrast computed for every text role against every surface role it can legally appear on, in
  both themes, including hover and active variants. The verified table exists in
  `skills-md/color.md` with real values
- Focus ring: one colour product-wide, 3:1 against every adjacent surface it can sit on
- Target sizes in the density tables: nothing under 24 x 24, 44 x 44 where any role is
  touch-primary. The hit area is checked, not the visual size
- Status encoding: greyscale pass on the encoding map. Every ERD status distinguishable without
  colour
- Every component in `components.md` has its accessibility contract row set: element or ARIA
  pattern, name source, keyboard pattern, states exposed, target size
- The raised floor, where `accessibility_driver` names one, is listed in `skills-md/a11y.md`

**4b. Screen level — runs at Gate 3, against the specs.**
- Testing ladder rungs 1 to 4, recorded with method, subject and date
- Keyboard path written and walked, per task
- Focus movement specified at every transition
- Every async change has a stated announcement with its politeness level
- No single-channel encoding on any populated screen; greyscale pass clean
- Every control has an accessible name; no hover-only path
- Zoom 200% and reflow at 400% (WCAG 1.4.4, 1.4.10)
```

**Also add lens 5a at Gate 2.** The glossary exists by then and terminology drift is cheapest to
fix before it is written into eighty strings:

```markdown
### Lens 5: Content

**5a. Terminology — runs at Gate 2, against the glossary and the IA.**
- Every label in `ia.md` traces to a glossary entry
- No concept carries two names across the IA, the flows and the ERD
- Status labels use the client's words, not the industry's

**5b. Copy — runs at Gate 3, against the specs.**
(the existing lens 5 items)
```

**Then update the schedule in all five places:**

| File | Change |
|---|---|
| `design-critique/SKILL.md` "When it runs" | Gate 2: "lenses 2, 4a, 5a, 6 and 7" |
| `.claude/commands/design-qa.md:12` | Pre-Gate 2: lenses 2, 4a, 5a, 6, 7 |
| `.claude/commands/gate-2.md` | `/design-qa` at the pre-Gate-2 set, plus a new pre-check: "the verified contrast table exists in `skills-md/color.md` with real values for both themes" |
| `config/STATE.template.md` design quality record | Gate 2 lenses `2,4a,5a,6,7` |
| `accessibility/SKILL.md:196` | Split the exit criteria into "(Gate 2)" and "(Gate 3)" groups matching 4a and 4b |

**And fix D-17 while you are in there:** `accessibility:199` requires rung 4 on each primary task;
the only invocation (`design-critique:61`) runs rungs 1 to 3. Rung 4 belongs in 4b above.

### Why this is worth doing first among the Tier-2 items

A contrast failure found at Gate 2 is a token change. The same failure found at pre-Gate 3 is a
repaint of every screen downstream of that token, discovered in the week you have the least room.
This is the cheapest structural fix in the whole patch set.

---

## Part 2 — S7: Phase 2A cannot produce what Phase 2A must produce

### The defect

A genuine circular dependency:

1. `CLAUDE.md:126`: `erd (statuses) + incumbents (density) -> style-guide -> skills-md -> {prompts, hifi}`
2. The ERD is a Phase **2B** artifact.
3. `style-guide-authoring:3` and `SKILL-INDEX:32` place style-guide authoring in Phase **2A**, and
   `:92` requires "status encoding from the ERD's value lists" as a pre-aesthetic decision.
4. `templates/prompt-spec.md:30-32` requires the 2A prototype prompt to cite **all twelve**
   skills-md files by name.
5. `CLAUDE.md:116-118` explicitly forbids authoring them: *"ui-designer in 2A settles only the
   density decision and the status encoding sketch; a full visual system authored against an
   uncorrected entity model is half thrown away."*

The reasoning at (5) is right. The artifact contracts were never updated to match it.

### The fix: name the 2A style seed

**Add to `style-guide-authoring/SKILL.md`, before the twelve-file list:**

```markdown
## The 2A seed versus the 2B system

The design language is authored twice, deliberately, and the two are different artifacts with
different obligations. Authoring the full system in 2A against an uncorrected entity model throws
half of it away; authoring nothing in 2A leaves the prototype prompt with no style reference and
produces a build that teaches nothing.

**The Phase 2A seed — five files, marked SEED in each header:**

| File | Contains in 2A | Does not contain in 2A |
|---|---|---|
| `tokens.md` | Spacing base and scale, radius set, border weights, elevation ramp | - |
| `type.md` | The scale, line heights, the family decision | Per-component type assignments |
| `layout.md` | Grid, container widths, the page skeleton, the density mode with its domain reason | Per-screen composition |
| `color.md` | Roles and ramps, verified contrast for the roles that exist, and a **TENTATIVE status sketch** taken from the tentative ERD, the incumbents' filter values and the current build's badges, marked as a guess | The status encoding map. That needs closed lists |
| `a11y.md` | The floor, in full. It does not depend on the entity model and it is cheapest to state first | - |

**The Phase 2B system** adds `components.md`, `forms.md`, `tables.md`, `states.md`, `motion.md`,
`responsive.md`, `content.md`, and replaces the tentative status sketch in `color.md` with the
encoding map derived from the ERD's closed lists.

A 2A seed file that has grown past its 2A column is a file that will be rewritten in 2B; the
overrun is the defect, not the rewrite.
```

**`templates/prompt-spec.md` part 5 — replace the twelve-file list:**

```markdown
Cite by name, in the order a generator should weight them, with the precedence rule stated inline
(`a11y.md` overrides everything; more specific beats more general).

**Phase 2A prompts cite the seed:** `skills-md/a11y.md`, `tokens.md`, `type.md`, `layout.md`,
`color.md`. Five files. The status treatments in `color.md` are marked TENTATIVE and the prompt
says so, because a generator shown a guessed status list will produce a screen that makes the
guess visible, which is exactly what Gate 1 needs to correct.

**Phase 3 prompts and specs cite the full twelve.**

A 2A prompt citing a file the seed does not contain is citing a file that does not exist, and the
generator will invent its contents.
```

**`prompt-authoring/SKILL.md` part 5** — same replacement (this also fixes D-16, where the skill's
list drops `motion.md` and `responsive.md` from the twelve).

**`CLAUDE.md:126`, the dependency order** — replace the single line with two:

```
incumbents (density) + tentative-erd (status sketch) -> style-seed (2A) -> prompts -> prototype
erd (closed statuses) -> style-system (2B) -> skills-md -> hifi
```

**`docs/SKILL-INDEX.md:32`** — `style-guide-authoring` produces "the 2A seed (five files) and the
2B system (twelve)", and appears in both the Phase 2A and Phase 2B tables.

**`.claude/commands/gate-1.md` pre-checks** — add:

```markdown
- The 2A style seed exists: five files, each marked SEED, with the status sketch in `color.md`
  marked TENTATIVE. A seed that has grown into a system is a finding, not diligence: it was
  authored against an entity model this gate is about to correct
```

### And while you are here: D-21, the two owners

`style-guide-authoring` is listed in both `ui-designer.md` and `prompt-spec-writer.md`, and
`CLAUDE.md:82-83` splits the outputs without a precedence rule. This is the "split-brain values"
failure the skill itself names at `:183`. Add to the skill's header:

```markdown
**Ownership.** ui-designer owns the craft content of every file and is the decider on any
disagreement about what a rule says. prompt-spec-writer owns the file structure, the length
discipline (under about 150 lines, one concern per file), the precedence headers, and `content.md`.
Where the two disagree about whether a rule belongs in this file or that one, prompt-spec-writer
decides; where they disagree about what the rule is, ui-designer decides.
```
