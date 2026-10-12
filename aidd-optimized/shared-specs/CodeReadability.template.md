# CodeReadability.md

Owner: Development · Last reviewed: {date, project} · Version: {v}
Purpose: the conventions a generated front end must follow to read like the team's own code, so
it is reviewed and extended rather than rewritten. Consumed by prompt-authoring on every project;
reviewed at every project close by md-spec-loop, with a developer present.

Freshness contract: older than one project without a review triggers escalation before
consumption (GUARDRAILS 9.8).

Every rule here is violation-checkable. A rule the formatter or linter can enforce belongs in the
tooling, not in this file; this file holds what tooling cannot enforce.

## Naming
| Kind | Convention | Example |
|---|---|---|
| Files | | |
| Components | | |
| Functions | | |
| Variables | | |
| Booleans | | prefix convention (is/has/should) |
| Event handlers | | prop `onSomethingHappened`, handler `handleSomethingHappened` |
| Constants and enums | | |
| Test files | | |

**Domain naming binds to the glossary.** Entities, statuses and actions use the client's terms
from `10-discovery/glossary.md`, not industry synonyms and not database column names. This is the
point where the project's ubiquitous language either reaches the code or is lost; the handoff
walkthrough reads the rule-bearing terms aloud for exactly this reason.

## Structure
| Concern | Rule |
|---|---|
| File layout order | imports, types, constants, component, helpers, exports |
| Max component size before split | a number, not "when it feels long" |
| Colocation | where styles, tests and types live relative to the component |
| Directory organisation | by feature or by type; state which, and hold it |
| Barrel files | used or forbidden |
| Where shared code lives | and the rule of three before extracting it |

## Comments and docs
| Situation | Rule |
|---|---|
| Required | non-obvious rule implementations cite their REQ-ID, so a reader can trace behaviour to the requirement |
| Required | any deliberate deviation from a shared-specs rule, with its reason |
| Required | workarounds for external constraints, with the constraint named |
| Forbidden | restating what the code says |
| Forbidden | commented-out code; version control holds history |
| Component docs | what a consumer needs: purpose, required props, states it handles |

## Formatting
Formatter and config location: {path}. Linter and config location: {path}.
Anything the tooling cannot enforce, listed here explicitly:

| Rule | Why tooling cannot enforce it |
|---|---|

## Review expectations
What a reviewer checks that tooling does not: domain naming against the glossary, REQ-ID
citations on rule implementations, state coverage against the component's specified matrix, and
accessibility obligations (accessible name, keyboard pattern, focus management) present per
control.

## Change log
| Date | Project | Change | Why | Outcome (adopted / deleted / kept-local) |
|---|---|---|---|---|

Every row records an adjudication from a loop review. Consider at least one deletion honestly at
each review; a file that only grows becomes a file nobody reads.
