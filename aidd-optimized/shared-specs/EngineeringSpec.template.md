# EngineeringSpec.md

Owner: Development · Last reviewed: {date, project} · Version: {v}
Purpose: constraints a generated front end must satisfy for the dev team to RE-USE it rather
than reference it. Consumed by prompt-authoring (part 5) on every project; reviewed at every
project close by md-spec-loop, with a developer present.

Freshness contract: older than one project without a review triggers escalation before
consumption (GUARDRAILS 9.8). A stale file is worse than none, because it produces confidently
non-conforming output that looks reviewable and is not.

Every rule here is violation-checkable: a reviewer can point at code and cite it. Anything that
fails that test is an aspiration and gets deleted at the next loop review.

## Stack and architecture
| Decision | Value | Notes |
|---|---|---|
| Framework + version | | |
| Language / type system | | strictness level, and what is exempt |
| State management | | local, server-cache, and global; which is the default for what |
| Routing | | file-based or config; route naming convention |
| Styling approach | | and what is forbidden (inline styles, global CSS, arbitrary values) |
| Component library baseline | | which primitives are adopted, which are wrapped, which are banned |
| Build tooling | | |
| Browser and device floor | | must match responsive-design's role-by-context table |

## Data and API conventions
| Concern | Rule |
|---|---|
| Fetching and caching pattern | |
| Server-authoritative versus client state | which values may never be trusted from the client |
| Error handling shape | what an error looks like coming back, and how the UI is expected to consume it |
| Loading and pending representation | must support interaction-design's optimistic / pending / confirmed distinction |
| Optimistic update support | available or not; if not, prompts must not request it |
| Form handling library and pattern | |
| Validation split | client hints versus server truth; the server is always authoritative |
| Concurrency and conflict handling | what the backend supports (field-level merge, version checks); this decides what interaction-design may specify |
| Date, time zone and money representation | the wire format and the display responsibility |

## Design system binding
| Concern | Rule |
|---|---|
| Token consumption | how `skills-md/tokens.md` values reach code (CSS variables, theme object, generated file) |
| Component API shape | props versus slots; how variants and states are expressed (closed literal sets, not boolean combinations) |
| Density mechanism | how the density mode from visual-design is implemented and switched |
| Theme switching | light/dark and any high-contrast mode; where the override is stored |
| Icon system | family, delivery mechanism, sizing |

If a design rule cannot be expressed under these constraints, that is a conversation at the loop
review, not a silent divergence in either direction.

## Accessibility implementation floor
Non-negotiable (GUARDRAILS 11); these are the code-side obligations.
- Native elements over ARIA; a custom control takes on its full keyboard pattern and state
  exposure, and that cost is accepted deliberately or the control is not built.
- Focus management at route changes, overlay open/close, and item deletion.
- Live regions for asynchronous status changes, with politeness levels per the spec.
- Automated a11y checks in CI, understood as a floor and never reported as an assessment.

## Generation constraints
What generated code must and must not do to be mergeable:
| Constraint | Rule |
|---|---|
| File boundaries and placement | |
| Import rules | what may import what; forbidden cross-layer imports |
| Forbidden dependencies | |
| Testing hooks expected | test ids, roles, or labels the generated markup must carry |
| What must never be generated | auth, payment handling, migrations, anything security-sensitive |
| Comment expectations | non-obvious rule implementations cite their REQ-ID |

## Change log
| Date | Project | Change | Why | Outcome (adopted / deleted / kept-local) |
|---|---|---|---|---|

Every row records an adjudication from a loop review. Rules that nobody followed are deleted
here, not quietly ignored.
