---
name: style-guide-authoring
description: "Authors the style guide and the machine-readable skills-md set that prompts and generators obey instead of adjectives. Five files as the Phase 2A seed, twelve as the Phase 2B system. Use whenever a design decision needs to become a checkable rule."
---

# Style Guide and skills-md Authoring

**Ownership.** ui-designer owns the craft content of every file and decides any disagreement
about what a rule says. prompt-spec-writer owns the file structure, the length discipline (under
about 150 lines, one concern per file), the precedence headers, and `content.md`. Where the two
disagree about which file a rule belongs in, prompt-spec-writer decides; where they disagree
about what the rule is, ui-designer decides. Left unstated, this split is the "split-brain
values" failure named at the end of this file.

## Purpose
Style is referenced, not described. These files are what "point at the style guide" points at,
they are what a generator obeys, and they are the project-local seed of the cross-project
`shared-specs/design-system.md`. Everything in them passes one test: could a reviewer point at a
build and say "that violates rule X"? If not, it is an aspiration and it does not ship.

This skill is the assembly point. The craft that fills these files lives in `visual-design`,
`component-architecture`, `interaction-design`, `content-design`, `responsive-design` and
`accessibility`; this skill decides what goes in which file, keeps each file short enough to be
obeyed, and holds the precedence rules between them.

## The two artifacts

**`style-guide.md`** is human-readable and holds the decisions and their reasons: the hierarchy
method, the density decision and why, the status encoding map, the friction budget policy, what
was inherited from `shared-specs` and what diverged and why. A reviewer reads this to understand
the design's logic. It is prose plus tables and it may run long.

**`skills-md/*.md`** are machine-readable slices a generator obeys. One concern per file, each a
short list of concrete rules with a tiny example, each under about 150 lines. Generators obey
short files and skim long ones; this constraint is functional, not stylistic. If a file exceeds
the limit, split the concern rather than shrinking the rules.

## The 2A seed versus the 2B system

The design language is authored twice, deliberately. Authoring the full system in Phase 2A against
an uncorrected entity model throws half of it away; authoring nothing in 2A leaves the prototype
prompt with no style reference and produces a build that teaches nothing at Gate 1.

**The Phase 2A seed - five files, each headed SEED:**

| File | In 2A it contains | In 2A it does NOT contain |
|---|---|---|
| `tokens.md` | Spacing base and scale, radius set, border weights, elevation ramp | - |
| `type.md` | The scale, line heights, the family decision | Per-component type assignments |
| `layout.md` | Grid, container widths, page skeleton, density mode with its domain reason | Per-screen composition |
| `color.md` | Roles and ramps, verified contrast for the roles that exist, and a **TENTATIVE status sketch** taken from the tentative ERD, the incumbents' filter values and the current build's badges, marked as a guess | The status encoding map. That needs closed lists |
| `a11y.md` | The floor, in full. It does not depend on the entity model and it is cheapest to state first | - |

**The Phase 2B system** adds `components.md`, `forms.md`, `tables.md`, `states.md`, `motion.md`,
`responsive.md`, `content.md`, and replaces the tentative sketch in `color.md` with the encoding
map derived from the ERD's closed lists.

A 2A seed file that has grown past its 2A column will be rewritten in 2B. The overrun is the
defect, not the rewrite.

## The skills-md file set

| File | Owner skill | Contents |
|---|---|---|
| `tokens.md` | visual-design | Spacing scale, radii, border weights, elevation ramp, icon grid, the density mode and its values |
| `type.md` | visual-design | Scale steps with size, line height and weight; measure limits; numerals; case rules; truncation strategies |
| `color.md` | visual-design + accessibility | Role table with values per theme, the verified contrast table, status encoding map, chart palette |
| `layout.md` | visual-design | Grid, container widths, page skeleton, alignment rules, composition patterns |
| `components.md` | component-architecture | Per component: purpose, variants, full state list, API, accessibility contract |
| `forms.md` | component-architecture + interaction-design | Label position, required marking, validation timing, error placement, save model |
| `tables.md` | component-architecture + responsive-design | Density, sort and filter defaults, selection rules, all container states, narrow strategy |
| `states.md` | component-architecture | The universal state set, the container state set, and how ERD statuses map onto them |
| `motion.md` | interaction-design | Duration and easing tokens, what may animate, choreography, reduced-motion mapping |
| `content.md` | content-design | Voice, label rules, error patterns, the four empty states, confirmation tiers, formatting |
| `responsive.md` | responsive-design | Breakpoints with their content reasons, order of collapse, target sizes, dense-data strategies |
| `a11y.md` | accessibility | The floor, the per-artifact obligations, the testing ladder, any recorded exceptions |

Not every project needs all twelve. A content-led project may fold `tables.md` into
`components.md`; a rule-dense data product will need `tables.md` to be the longest file in the set.
Decide the set at the start and record which files this project has, so a prompt citing a missing
file is caught rather than silently ignored.

## Precedence

Conflicts between files are inevitable and must resolve deterministically:

1. `a11y.md` wins over everything. The accessibility floor is not traded (GUARDRAILS design
   section).
2. The more specific file wins over the more general: `forms.md` over `components.md`,
   `tables.md` over `components.md`, `components.md` over `layout.md`.
3. `tokens.md` is referenced by all of them and contradicted by none. A value in another file that
   is not in `tokens.md` is a defect in one of the two.
4. `shared-specs/EngineeringSpec.md` wins on anything about code structure, framework and
   conventions; these files never specify implementation where that file has an opinion.

State this precedence in every file's header. A generator reading one file must know what
overrides it.

## Rule quality

Every rule passes the violation test. Worked examples:

| Not a rule | A rule |
|---|---|
| Generous spacing | Section gaps use spacing step 6 (32px) at compact density |
| Clean, modern look | Two border weights only: 1px `border-subtle`, 1px `border-strong`. No shadows below elevation 2 |
| Clear hierarchy | One filled primary button per view. Secondary actions use the outlined variant |
| Accessible colours | Every text role meets 4.5:1 against every surface role it may appear on. The verified table is in `color.md` |
| Consistent forms | Labels sit above fields. Required fields are unmarked and optional fields are marked "(optional)" |
| Responsive | Below 768px the side navigation becomes a drawer; content columns collapse in the order stated in `responsive.md` |
| Subtle animation | Enter at `motion-medium` with `ease-decelerate`; exit at `motion-fast` with `ease-accelerate` |

The pattern: a rule names the thing, the value, and the condition. An adjective names none of them.

## Procedure

1. **Seed check.** Read `shared-specs/design-system.md`. Current (reviewed at the last project
   close) means inherit its tokens and component rules and record only deltas. Stale or absent
   means author from scratch and note that this project's close must feed it back
   (`md-spec-loop`); a stale file consumed silently triggers escalation (GUARDRAILS 9.8).
2. **Set the domain-driven decisions before the aesthetic ones.** Density from the users and the
   volume; status encoding from the ERD's value lists; target sizes from the environment table;
   friction budget policy from the consequence data. These constrain everything after them, and
   deciding them last means redoing the work.
3. **Author the foundations** (`visual-design`): spacing, type, colour roles with verified
   contrast, radii, borders, elevation, icons.
4. **Author the component rules** (`component-architecture`), including the state matrices and the
   accessibility contract per component.
5. **Author behaviour, content and adaptation** (`interaction-design`, `content-design`,
   `responsive-design`).
6. **Author `a11y.md`** with the floor, the obligations and the ladder.
7. **Write `style-guide.md`**: the decisions, their reasons, the inheritance record, and the
   divergence list with one line of why per divergence.
8. **Version alongside prompts.** A style change mid-phase bumps the prompt version too
   (`prompt-authoring`), or the next generation silently mixes two systems.
9. **Self-test:** read only the skills-md set, as a generator would, and ask what it would get
   wrong. Whatever it gets wrong belongs in the files.

## The mood board clause

This flow dropped mood boards deliberately. Reinstate one only when there is a genuine brand or
tone question that a token sheet cannot settle: a new brand with no assets, a consumer-facing
surface where feel is a business requirement, or a contested aesthetic direction between
stakeholders who need to point at something.

Where the client has brand assets, the answer is not a mood board; it is reading the assets and
recording the decisions. Where the product is an internal expert tool, the answer is almost never
a mood board; it is the density decision and the incumbents' conventions.

Never let the prototype decide brand by default. A generated aesthetic that nobody chose becomes
the de-facto brand because it was the first thing anyone saw, and it is then argued about for the
rest of the project.

## Deciding factors

- **Inherit unless the domain demands divergence**, and give every divergence one line of why.
  Silent divergence is the mechanism by which the next project inherits a fork nobody recorded.
- **Author for the generator, not for the portfolio.** These files are read by a machine and by a
  developer at 6pm. Short, concrete, scannable.
- **Rules that nobody follows are deleted, not enforced retroactively.** An aspirational rule in a
  file rots trust in the whole file (`md-spec-loop` applies the same test at close).
- **When two designers would apply a rule differently, the rule is not finished.** Tighten it until
  they would not.

## Probing prompts

Self-review:
- "Which rule here would two reasonable designers apply differently?" Tighten it.
- "What did the incumbents' density teach that this guide ignores?"
- "If a generator read only the skills-md set and never the style guide, what would it get wrong?"
  Move that into a skills-md file.
- "Which of these rules is aspirational? Delete it or make it checkable."
- "Which decision here did I inherit without checking whether this domain wants it?"
- "Which value appears in two files with different numbers?"

## Guardrails

- No adjective survives without operationalisation; "generous spacing" states the value or it does
  not ship.
- `a11y.md` overrides every other file, and its floor is not negotiable against brand or schedule.
- Client brand assets live in `00-inputs/`, are referenced, and are never uploaded to external
  tools (GUARDRAILS 8).
- Status treatments derive from the ERD's closed value lists, never from the designer's sense of
  which statuses exist.
- Divergences from `shared-specs` are recorded with reasons, for the close-review.

## Output

- `30-design-language/style-guide.md`
- `30-design-language/skills-md/` file set, each under about 150 lines, each with a precedence
  header
- A divergence list for `md-spec-loop` at close

## Exit criteria

- Prompts can cite these files instead of any adjective; `prompt-authoring`'s adjective ban is
  satisfiable
- Every rule passes the violation test
- Contrast table verified and present in `color.md`
- Density, status encoding, target sizes and friction policy all decided from domain evidence
- Precedence stated in every file header
- Inheritance and divergence recorded

## Failure modes

- **Aspirational guide.** Reads beautifully, decides nothing, and every generation drifts.
- **Files too long to obey.** A 600-line `components.md` that the generator skims and the developer
  never opens.
- **Aesthetic-first ordering.** Colours and type chosen before density and status encoding, then
  redone when the ERD arrives with fifteen statuses.
- **Silent fork.** Divergence from `shared-specs` with no recorded reason, inherited as confusion
  by the next project.
- **Split-brain values.** The same spacing value stated differently in two files, with builds
  quietly picking one each.
