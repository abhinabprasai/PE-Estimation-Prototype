# design-system.md

Owner: Design + Development jointly · Last reviewed: {date, project} · Version: {v}
Consumed by: `style-guide-authoring` and `prompt-authoring` (part 5) on every project. Stale
(older than one project, unreviewed) triggers escalation before consumption (GUARDRAILS 9.8).

Every rule here passes the violation test: could a reviewer point at a build and cite it? If not,
delete it. An aspirational rule rots trust in the whole file, and `md-spec-loop` deletes them at
close.

## Tokens
Spacing base and scale · type scale steps with size, line height and weight · semantic colour
roles (not values alone) with the verified contrast table per theme · radii (three at most) ·
border weights (two) · elevation ramp with a meaning per level, specified for light AND dark ·
icon family, grid and stroke.

## Density
The modes this system supports (comfortable / compact / dense) with concrete values per mode:
control height, table row height, cell padding, card padding, field gap, section gap, icon size,
page gutter. Plus the rule that hit areas never drop below 24 x 24 CSS px regardless of mode.

## Components
Per component: purpose, variants, the FULL state list (default, hover, focus-visible, active,
disabled, read-only, error, loading, plus the container set: empty first-use, empty no-results,
loading initial, loading refresh, partial, error, one item, many, maximum, permission-denied),
API and naming, composition rules, and the accessibility contract (element or ARIA pattern, name
source, keyboard pattern, states exposed, target size).

A component documented only in its default state is not documented.

## Patterns
Forms (label position, required marking, validation timing, error placement, save model) ·
tables (density, sort and filter defaults, selection persistence, narrow-viewport strategy) ·
status display (how ERD statuses render, always with a non-colour channel) · destructive and
irreversible actions (confirmation tiers sized to consequence; reversal-not-deletion affordances)
· empty and error surfaces · notification surfaces and when each is used.

## Motion
Duration tokens, easing tokens, what may animate, choreography rules, and the reduced-motion
mapping per pattern.

## Content
Voice, case convention, label rules, the four empty states, the four error kinds, confirmation
copy tiers, number and date formatting.

## Responsive
Breakpoints with the content reason for each · order of collapse · target sizes · dense-data
strategies and when each applies.

## Accessibility floor
WCAG 2.2 AA as the baseline, the per-artifact obligations, the testing ladder, and any
organisation-level exceptions with owners. This section overrides every other section here.

## Naming
Component and token naming scheme the generator must follow. Where
`shared-specs/EngineeringSpec.md` has an opinion on code structure, it wins.

## Change log
| Date | Project | Change | Why |
|---|---|---|---|
