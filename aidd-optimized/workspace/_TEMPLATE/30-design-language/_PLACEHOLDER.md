# 30-design-language/: the design system and the prompts

Owners: ui-designer (the craft), prompt-spec-writer (the file structure and the prompts).

```
style-guide.md     decisions and their reasons; human-readable; may run long
skills-md/         machine-readable slices a generator obeys; under ~150 lines each
prompts/{n}-{purpose}.md    versioned six-part prototype prompts
```

## The skills-md set

| File | Contents |
|---|---|
| `tokens.md` | Spacing scale, radii, border weights, elevation ramp, icon grid, density mode |
| `type.md` | Scale steps with sizes, line heights, weights; measure; numerals; case; truncation |
| `color.md` | Semantic role table per theme, the verified contrast table, status encoding map |
| `layout.md` | Grid, container widths, page skeleton, alignment, composition patterns |
| `components.md` | Per component: purpose, variants, full state list, API, accessibility contract |
| `forms.md` | Label position, required marking, validation timing, error placement, save model |
| `tables.md` | Density, sort and filter defaults, selection, all container states, narrow strategy |
| `states.md` | Universal states, container states, how ERD statuses map onto them |
| `motion.md` | Duration and easing tokens, what may animate, reduced-motion mapping |
| `content.md` | Voice, labels, error patterns, four empty states, confirmation tiers, formatting |
| `responsive.md` | Breakpoints with content reasons, order of collapse, target sizes |
| `a11y.md` | The floor, per-artifact obligations, testing ladder, recorded exceptions |

Not every project needs all twelve. Record which files this project has, so a prompt citing a
missing file is caught rather than silently ignored.

## Precedence, stated in every file header

`a11y.md` overrides everything. More specific beats more general (`forms.md` over
`components.md`). `tokens.md` is referenced by all and contradicted by none.
`shared-specs/EngineeringSpec.md` wins on anything about code structure and framework.

## Two rules that decide whether this folder is worth anything

1. **Every rule is violation-checkable.** Could a reviewer point at a build and cite it? If not,
   it is an aspiration and it does not ship.
2. **Domain decisions before aesthetic ones.** Density from the users and the volume; status
   encoding from the ERD's closed lists; target sizes from the environment. Colours and type
   chosen first get redone when the ERD arrives with fifteen statuses.

Delete this file once the folder holds a real system.
