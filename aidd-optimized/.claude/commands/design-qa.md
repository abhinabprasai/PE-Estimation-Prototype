---
description: "Run the seven-lens design critique before a gate, or on demand when a screen feels wrong"
---
Run the design critique for $ARGUMENTS (a feature, a set, or "all"). Delegate to design-critic
with the design-critique skill.

Pre-checks:
- Run `/verify` first, not after. The conformance snapshot finds what disagrees mechanically
  (orphans, ghosts, staleness, tag violations); this critique finds what disagrees in craft and
  domain fidelity. Critiquing artifacts already known to be stale wastes both passes.
- Name which gate this is for; that decides the lens set. Pre-Gate 1: lenses 1, 3, 6, 7 only
  (the tentative set is built to be rough; polishing it defeats the mechanism). Pre-Gate 2: lenses 2, 4a (contrast, focus, targets, status greyscale, component
  contracts), 5a (labels against the glossary), 6 and 7. Pre-Gate 3: all seven.
- Gather the rules to judge against: style-guide.md, the skills-md set, erd.md,
  refined-requirements.md, and the flow-optimization cost tables. A critique with no rules to
  cite produces opinions.

Protocol:
- Run one lens at a time across the WHOLE set, never screen by screen through all seven. Every
  screen can pass individually while the set is incoherent.
- Score every finding S1 / S2 / S3 / S4 and classify it Type A or Type B. When unsure, Type B.
- Route Type B findings to requirements-reconciler BEFORE any fix is applied.
- Run the perceptual and accessibility tests: squint, five-second, greyscale and colour-blindness
  simulation, keyboard-only pass, zoom to 200 and 400 percent, and a screen reader pass on each
  primary task. Record which were run, on what, and by whom. An automated scan is never reported
  as an accessibility assessment.
- The same finding on three or more surfaces is a rule problem: report it as a proposed style
  guide or skills-md change, not as three defects.

Exit criteria:
- All applicable lenses run across the whole set
- Every finding located, scored, classified and owned
- Zero open S1 findings, or each declared with its reason and owner for the gate's first two
  minutes
- Report filed from `templates/design-critique-report.md` into `70-hifi/critiques/` or
  `80-gates/`

A critique with no findings is a warning, not a pass. Probe before accepting it, and record which
probes were run.
