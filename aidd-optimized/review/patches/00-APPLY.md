# Patch set — how to apply

Everything here is drop-in. Paths are relative to the repo root (`aidd/`).
Apply in tier order; each tier assumes the one above it landed.

| Patch | Fixes | Effort |
|---|---|---|
| `P1-hygiene.sh` + `P1-notes.md` | D-01, D-02, D-23, D-26, D-27, D-28, D-29, D-31, D-32, D-33, build.py probe leak | 30 min |
| `P1b-GUARDRAILS-sections.md` | The renumbering block for GUARDRAILS 10/10a/11/12, plus the `[USER:role]` tag (D-07) | 10 min |
| `templates/conformance-snapshot.md` | D-08 (new file) | drop in |
| `templates/traceability-matrix.md` | D-09 (replaces existing) | drop in |
| `templates/refined-requirement-entry.md` | S3 outcome row (replaces existing) | drop in |
| `templates/measurement-plan.md` | S3 (new file) | drop in |
| `P4-outcome-layer.md` | The edits that wire the measurement plan into prioritization, gates and the loop | 1 h |
| `P5-craft-severity.md` | S4 — the `SC` finding class and the new design quality record | 45 min |
| `P6-ordering.md` | S6 (lens 4 split) and S7 (the 2A style seed) | 1 h |
| `skills/usability-testing/SKILL.md` | S1 (new skill) | drop in + wiring in P2-wiring.md |
| `skills/concept-exploration/SKILL.md` | S2 (new skill) | drop in + wiring in P3-wiring.md |
| `P2-wiring.md`, `P3-wiring.md` | Agent / command / CLAUDE.md edits for the two new skills | 30 min each |

Two things I did **not** patch, deliberately:

- **D-25 (duplicated framework files).** The right fix depends on whether you want `config/` to survive at all. My recommendation is to delete `config/` and have `/new-project` read `workspace/_TEMPLATE/` directly, but that is your call.
- **§6.1 (the type scales).** Regenerating them needs your judgment about which two ratios you actually want. The honest interim is one sentence in `type-scale.md` above each table: *"Hand-tuned, not generated. Verified against the line-height and measure constraints below."*
