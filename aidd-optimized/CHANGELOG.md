# What changed in aidd-optimized

The original is untouched at `../aidd`. This folder is the rebuild. 113 files differ or are new.

Three problems were being solved: sessions running out of tokens in the early phases, artifacts
that designers found unreadable, and five structural gaps found in the design review
(`review/AIDD-Design-Review.md`).

---

## 1. Sessions stopped running out of room

Measured on a Phase 0+1 run: **about 122,000 tokens before, about 25,000 after.**

The framework was never the problem. Raw material was 68% of the budget and got read four times.

| Change | Where | Effect |
|---|---|---|
| `source-extractor` agent reads each raw source in its own context and returns a digest under 400 words | `.claude/agents/source-extractor.md`, `_digests/`, `templates/source-digest.md` | 82,000 -> 2,700 tokens for three transcripts, an anchor doc and client materials |
| The four conformance sweeps are now a script, not model work | `tools/conformance.py` (750 lines), rewritten `/verify` | `/verify` goes from ~100,000 to ~3,000 tokens, and becomes exhaustive rather than approximate |
| Agents load one skill at a time instead of listing six | routing block in all 14 agent files | 24,200 -> 5,600 tokens per Phase 1 invocation |
| Skill descriptions trimmed from an average of 427 characters to 222 | all 36 skills | registry floor 3,900 -> 2,300 tokens, on every session forever |
| Six oversized skills split into their `references/` directories | ux-flow-optimization, interaction-design, responsive-design, content-design, design-critique, information-architecture | no skill body over 250 lines; four previously empty `references/` dirs now carry the depth |
| `/handover` writes a resume contract so a session can end at a phase boundary | `.claude/commands/handover.md`, `CLAUDE.md` 3b | a project is no longer one conversation |
| Lite mode: six mechanisms instead of thirty-six | `CLAUDE.md` 3a, `aidd_mode` in PROJECT_CONFIG | a first project or a short engagement runs about a fifth of the instruction |

## 2. Artifacts are written for the people who read them

The old writing was compressed aphorism, for an expert re-reading their own notes.
`refined-requirement-entry.md` carried 16 framework terms per 100 words; the handoff manifest
carried 27. Twenty-three coded terms appeared in delivered artifacts with no definition a reader
could reach. "Read aloud" appeared six times, which was the symptom.

| Change | Where |
|---|---|
| GUARDRAILS 12 replaced: was three bullets about em dashes, now a checkable comprehension standard | `GUARDRAILS.md` |
| Every template opens with what this is / where it stands / what we need from you | all 20 templates, plus `templates/_ARTIFACT-HEADER.md` |
| Every coded term defined at the foot of the page it appears on | 20 files, plus `templates/_KEY.md` |
| 33 filled example rows added to tables that had a header and nothing else | all templates |
| Client-facing documents with no framework terms at all | `templates/share-gate-brief.md`, `share-handoff-walkthrough.md`, `/share`, `share/` |
| A renderer that turns those into a sendable page | `tools/render-share.py` |
| Three engineering terms renamed in designer-facing layers, kept in DEV NOTES | `templates/_KEY.md` |

## 3. The five structural gaps

| Gap | Fix |
|---|---|
| Phase 3 was called "Test" and contained no test | `usability-testing` skill, `/usability-round`, Gate 3 pre-check, GUARDRAILS 11 |
| Nothing generated a second option | `concept-exploration` skill, wired into `hifi-spec` step 3a and Gate 3 |
| The outcome was scored at intake and dropped | `templates/measurement-plan.md`, outcome row on the requirement entry, the value dimension in `prioritization`, a fourth loop metric, Gate 2 sign-off |
| The quality record had no column for quality | the `SC` craft severity class in `design-critique`, and a rebuilt design quality record in STATE |
| Accessibility was checked once, at the end | lens 4 split into 4a (tokens, Gate 2) and 4b (screens, Gate 3); lens 5 split the same way |

Plus the ordering defect: Phase 2A was required to produce a style system derived from an entity
model that does not exist until 2B. Resolved with a named five-file **2A seed** versus the
twelve-file 2B system.

## 4. Defects fixed

All 33 from the review, including: 11 citations to `GUARDRAILS 10`, a section that did not exist;
Gate 3 having two contradictory protocols; three mutually inconsistent screen-state lists;
`shared-specs` real files that nothing created; `[USER:role]` used but never defined, which
deadlocked the `domain_authority: end-users` configuration; nine routing variables of which
CLAUDE.md documented five; tentative 2A artifacts overwriting the Gate 1 evidence they were meant
to preserve; and the missing conformance snapshot template, now superseded by the script.

## Inventory

|  | before | after |
|---|---:|---:|
| agents | 14 | 15 |
| skills | 34 | 36 |
| commands | 9 | 12 |
| templates | 16 | 22 |
| reference files | 13 | 19 |
| scripts | 0 | 2 |

## To try it

```
cd aidd-optimized
python3 tools/conformance.py workspace/{project}        # the four sweeps
python3 tools/render-share.py workspace/{project}/share/ # client-facing HTML
```

In Claude Code: `/new-project acme` (set `aidd_mode: lite` if it is a short one), then
`/intake-spec`, then `/handover` at every phase boundary.
