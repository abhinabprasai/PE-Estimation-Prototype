---
description: "Initialize a new AIDD project workspace from the template, collect the five adaptation variables, run spec intake, and set STATE to Phase 0"
---
Initialize a new AIDD project named $ARGUMENTS.

1. Copy `workspace/_TEMPLATE/` to `workspace/$ARGUMENTS/` in full. Copy rather than creating
   folders one by one: that is what guarantees `00-inputs/PRD.md` and `00-inputs/assumptions.md`
   exist on day one. Do not delete the `_PLACEHOLDER.md` files; each is a visible gap until its
   real artifact lands.
2. Ask the human, one at a time, for the five adaptation variables (anchor_document,
   domain_authority + names, rule_density, engagement_type, designer_engagement) plus
   minimum_set and users_reachable. Record answers with who-set and date. Do not guess any value.
3. Ask two more that the design layer needs and that nobody volunteers:
   - **Accessibility obligation**: sector, procurement standard, or contractual commitment. The
     floor is WCAG 2.2 AA regardless; this asks whether it is higher. Unknown becomes an
     assumption register entry with a large blast radius.
   - **Device and environment per role**: what people use, where, and with what on their hands.
     Unknown here defaults silently to desktop, which is the most common late-discovered
     constraint in this process.
4. Walk the Derived obligations checklist in PROJECT_CONFIG and tick what applies; create STATE
   risk rows (for example R-SME-SUB) where triggered.
5. **Run `/intake-spec`.** This happens whatever the answer to anchor_document was, including
   "a PRD is coming next week". It classifies what actually arrived, fills `00-inputs/PRD.md`,
   scores the fourteen audit dimensions, opens the assumption register, and starts the substitute
   path where there is no spec. Phase 1 work does not start before it.
6. If anchor_document = supplied: request the file, store it in `00-inputs/` read-only, and
   confirm it filed. If none: the reconstruction interview is scheduled and the signed derived
   brief is the deliverable that closes the gap. If existing-product: note the audit weighting and
   use `00-inputs/audit/`.
7. Instantiate `shared-specs/` if the real files are absent: copy each `*.template.md` to its
   un-suffixed name (`design-system.md`, `EngineeringSpec.md`, `CodeReadability.md`) and date it
   as seeded-not-yet-reviewed. Every consumer references the un-suffixed name; without this step
   the ready-to-code escalation in the next sentence fires on project one, every time.
   Then read `shared-specs/` dates. Stale (older than one project and unreviewed) adds a STATE blocker
   to review-before-consumption (GUARDRAILS 9.8). Missing entirely on a ready-to-code engagement
   is an escalation, not a note.
8. Confirm the conformance scaffolding exists from the template: `conformance/` for snapshots and
   `60-requirements/traceability.md` seeded from `templates/traceability-matrix.md`. The matrix
   stays empty until refined-requirements has IDs; the folder existing on day one is what makes
   the cadence in CLAUDE.md 7a startable rather than retrofitted.
9. Set STATE phase "1", next_gate "problem confirmation", announce readiness, and route the first
   task (anchor-analysis, on whatever spec-intake identified as the anchor) to discovery-lead.
