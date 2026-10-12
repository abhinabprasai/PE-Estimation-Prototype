# 90-handoff/: transfer of understanding

Owner: handoff-manager. Precondition: Gate 3 passed.

```
manifest.md            every item, its version, its sign-off state, its location
walkthrough-notes.md   questions asked, answers given, and the gaps you could not answer
```

## The package is the full artifact set, not just designs

Hi-fi specs, consolidated status mapping, refined requirements, prioritized features with descope
reasons, the ERD with its consequences note, the process breakdown, as-is and to-be pairs, the IA
and its validation, userflows and sitemap, the KB index and location, the glossary, the style
guide and skills-md set, the assumption register, all gate reports, and the shared-specs set
(mandatory on ready-to-code engagements).

A Figma-only handoff is a named failure of this process.

## Gaps are listed as gaps

Each with its reason. Hiding a gap converts it into a build-time surprise with your name on it.
Open assumptions and recorded accessibility exceptions are listed here too, with their owners.

## Walkthrough order: model before screens

Requirements, ERD (consequences note read aloud), process breakdown, flow pairs, IA, userflows and
sitemap, then per-feature specs. The developer must be present; a walkthrough without the builder
transfers understanding to nobody who needs it.

Land the routing rule explicitly: build-time questions about rules go through the reconciler path,
not to a designer's memory. Show them the rework log so they see the mechanism working.

## Before close

The md-spec loop runs with a developer: review `shared-specs/design-system.md`,
`EngineeringSpec.md` and `CodeReadability.md` against what this project actually built, adopt or
revert every divergence, delete rules nobody followed, date and version each file, and record the
review in `STATE.md`. Project close is blocked until that row exists. A stale spec file is worse
than none.

Delete this file once the folder holds a real handoff.
