# PROJECT_CONFIG - {project name}

Set every variable before Phase 1 work starts. The orchestrator reads this file to route
work; unset variables block routing. Record who set each value and when.

## Adaptation variables

```yaml
project: ""              # short name, used as workspace folder name
client: ""
date_started: ""

anchor_document: ""      # supplied | none | existing-product
anchor_document_path: "" # 00-inputs/... when supplied; blank otherwise

domain_authority: ""     # sme | end-users | both
domain_authority_names: []   # who, exactly; "unknown" blocks Phase 1
product_owner: ""

rule_density: ""         # high | low
engagement_type: ""      # fixed-bid | t-and-m | augmentation
designer_engagement: ""  # demo | in-team | ready-to-code | modernize

aidd_mode: "full"          # lite | full  (lite = six mechanisms, see CLAUDE.md 3a)
minimum_set: false       # true = minimum artifact set only (see CLAUDE.md section 3)
users_reachable: false   # true adds user interviews (Phase 1) + a usability round (before Gate 3)
prototype_timebox: ""    # working days; default 1 at rule_density low, 2 at high

# Design layer variables. Nobody volunteers these; ask at /new-project.
intake_class: ""         # A full spec | B partial | C gap doc | D deck/notes | E existing product | F nothing
accessibility_level: ""  # AA (the floor, always) | AA+named-AAA-criteria | sector standard, named
accessibility_driver: "" # sector, procurement standard, or contract that raises the floor; "none known" is an answer
```

## Device and environment per role

Unknown here defaults silently to desktop, which is the most common late-discovered constraint in
this process. An unfilled row becomes an assumption register entry, not a blank.

| Role | Primary device | Secondary | Environment | Input | Session length |
|---|---|---|---|---|---|
| | | | | | |

Environment means the physical one: gloves, sunlight, shared terminals, old hardware, locked-down
browsers, interruption frequency, one-handed use. Each of these changes the design.

## Derived obligations (fill after setting the variables)

- [ ] anchor_document = none  -> discovery brief must be written and signed in Phase 1
- [ ] anchor_document = existing-product -> Phase 1 weighted toward product audit
- [ ] domain_authority = sme AND product is user-facing -> risk R-SME-SUB logged in STATE.md
- [ ] rule_density = high -> ERD + process breakdown mandatory, developer-reviewed at Gate 2
- [ ] engagement_type = fixed-bid -> feature list locks at Gate 2
- [ ] designer_engagement = demo -> prototype archive rule disabled (GUARDRAILS 4)
- [ ] designer_engagement = ready-to-code -> full shared-specs set mandatory at handoff
- [ ] intake_class = C, D, E or F -> substitute path owner named, signed brief is a Gate 1 exit
      item, and the missing spec is a STATE blocker until it is signed
- [ ] accessibility_driver names a standard -> the floor rises accordingly and the raised
      criteria are listed in `30-design-language/skills-md/a11y.md`
- [ ] any role's device row unfilled -> assumption register entry with a large blast radius
- [ ] aidd_mode = lite -> announce it at session start; the dropped artifacts are listed in
      CLAUDE.md 3a and their absence is not a gap
- [ ] users_reachable = false -> R-SME-SUB stays open, the usability round runs with the DA, and
      the substitution is stated in every gate's first sentence
- [ ] spec-audit dimension 1 (business goal and measure) scored ABSENT or PARTIAL -> outcomes are
      derived in the reconstruction interview and carry (asserted) until the PO signs at Gate 2
- [ ] anchor_document = existing-product -> baselines are measured from the running system before
      Gate 2, not recalled
- [ ] any role is touch, field, or gloved -> 44px target minimum, no hover-only paths anywhere,
      and responsive-design's environment rules apply from the start

## Sign-off

| Variable set by | Date | Confirmed by client? |
|---|---|---|
| | | |
