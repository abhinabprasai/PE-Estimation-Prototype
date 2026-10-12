# PROJECT_CONFIG - pe-v2

Set every variable before Phase 1 work starts. The orchestrator reads this file to route
work; unset variables block routing. Record who set each value and when.

## Adaptation variables

```yaml
project: "pe-v2"              # short name, used as workspace folder name
client: "Power Electronics / PE Transformer (per PRD cover)"
date_started: "2026-10-09"

anchor_document: "supplied"      # supplied | none | existing-product
anchor_document_path: "00-inputs/PRD2.pdf (text copy: 00-inputs/PRD2.extracted.txt)" # 00-inputs/... when supplied; blank otherwise

domain_authority: "sme"     # sme | end-users | both
domain_authority_names: ["the requesting user (self-declared SME)"]   # who, exactly; "unknown" blocks Phase 1
product_owner: "the requesting user (acting)"

rule_density: "low"         # user: "just for estimation so keep it loose"; PRD itself is rule-heavy - high | low
engagement_type: "t-and-m"      # fixed-bid | t-and-m | augmentation
designer_engagement: "ready-to-code"  # demo | in-team | ready-to-code | modernize

aidd_mode: "lite"          # lite | full  (lite = six mechanisms, see CLAUDE.md 3a)
minimum_set: true       # true = minimum artifact set only (see CLAUDE.md section 3)
users_reachable: false   # true adds user interviews (Phase 1) + a usability round (before Gate 3)
prototype_timebox: "1"    # working days; default 1 at rule_density low, 2 at high

# Design layer variables. Nobody volunteers these; ask at /new-project.
intake_class: "B"        # set by spec-intake 2026-10-09 (partial spec; see 00-inputs/spec-intake.md) - A full spec | B partial | C gap doc | D deck/notes | E existing product | F nothing
accessibility_level: "AA"  # AA (the floor, always) | AA+named-AAA-criteria | sector standard, named
accessibility_driver: "none known" # sector, procurement standard, or contract that raises the floor; "none known" is an answer
```

## Device and environment per role

Unknown here defaults silently to desktop, which is the most common late-discovered constraint in
this process. An unfilled row becomes an assumption register entry, not a blank.

| Role | Primary device | Secondary | Environment | Input | Session length |
|---|---|---|---|---|---|
| All roles | Not supplied (user declined further questions) | - | Derive from PRD (shop floor terminal, scanners named there) | - | - |

Recorded as ASM-DEVICE-1 in 00-inputs/assumptions.md (roles mapped to the Book V Phase 1 device list [DOC:pp.238-239]).

Environment means the physical one: gloves, sunlight, shared terminals, old hardware, locked-down
browsers, interruption frequency, one-handed use. Each of these changes the design.

## Derived obligations (fill after setting the variables)

- [ ] anchor_document = none  -> discovery brief must be written and signed in Phase 1
- [ ] anchor_document = existing-product -> Phase 1 weighted toward product audit
- [x] domain_authority = sme AND product is user-facing -> risk R-SME-SUB logged in STATE.md
- [ ] rule_density = high -> ERD + process breakdown mandatory, developer-reviewed at Gate 2
- [ ] engagement_type = fixed-bid -> feature list locks at Gate 2
- [ ] designer_engagement = demo -> prototype archive rule disabled (GUARDRAILS 4)
- [x] designer_engagement = ready-to-code -> full shared-specs set mandatory at handoff
- [ ] intake_class = C, D, E or F -> substitute path owner named, signed brief is a Gate 1 exit
      item, and the missing spec is a STATE blocker until it is signed
- [ ] accessibility_driver names a standard -> the floor rises accordingly and the raised
      criteria are listed in `30-design-language/skills-md/a11y.md`
- [x] any role's device row unfilled -> assumption register entry with a large blast radius
- [x] aidd_mode = lite -> announce it at session start; the dropped artifacts are listed in
      CLAUDE.md 3a and their absence is not a gap
- [x] users_reachable = false -> R-SME-SUB stays open, the usability round runs with the DA, and
      the substitution is stated in every gate's first sentence
- [x] spec-audit dimension 1 (business goal and measure) scored ABSENT or PARTIAL -> outcomes are
      carried as ASM-GOAL-1 (no reconstruction interview: class B and user instruction); otherwise derived in the reconstruction interview and carry (asserted) until the PO signs at Gate 2
- [ ] anchor_document = existing-product -> baselines are measured from the running system before
      Gate 2, not recalled
- [ ] any role is touch, field, or gloved -> 44px target minimum, no hover-only paths anywhere,
      and responsive-design's environment rules apply from the start

## Sign-off

| Variable set by | Date | Confirmed by client? |
|---|---|---|
| Requesting user (abhinabprasai@lftechnology.com), 2026-10-09 | 2026-10-09 | No - user instruction: estimation only, keep loose, no further questions, build as per PRD |

## Engagement note (2026-10-09, from the user)

Purpose is estimation. User instruction: no further questions; where parts of the PRD do not
interconnect, leave them as-is and build as per the PRD. Contradictions are therefore recorded,
not raised for resolution.

## Delivery stack and pending inputs (2026-10-09, from the user)

- Goal: a prototype from the PRD quickly, then the code-ready version.
- UI component library: **shadcn/ui** (React). Applies to the throwaway prototype as well as to the code-ready build.
- Design language source: the user's earlier prototype repo. **Pending**; the user will send it when needed.
  Until then the style seed is shadcn defaults and is marked provisional; nothing visual is finalised.
- Coding guidelines: **pending** from the user. When they arrive they replace or extend
  `shared-specs/CodeReadability.md` and `shared-specs/EngineeringSpec.md`.
- Prototype stance: the framework default (GUARDRAILS 4). It is throwaway, covers one process end to end, and is archived after Gate 1.
  The code-ready version is built from refined requirements plus the user's design language.
  The user can switch to `designer_engagement: demo` to keep and polish the prototype instead.

## Prototype scope decision (2026-10-11, from the user)

The user chose a **full-PRD prototype**: all 11 flows and all 83 buildable screen entries
(`50-prototype/coverage.md`), kept as a deliverable. This disables the GUARDRAILS 4 archive rule for
the prototype (the same effect as `demo`), and the user decided it. `designer_engagement` stays
`ready-to-code`: the code-ready handoff is still required. The FL-09 build is extended, not replaced.
The build runs in the PRD's wave order: one shared foundation, then module groups in parallel, then
an integration pass that walks every flow end to end.
