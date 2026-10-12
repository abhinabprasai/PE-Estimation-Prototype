# AIDD Agent System

An agentic file system implementing the AI-Augmented Discovery and Design (AIDD) process end to
end: 15 subagents, 36 skills, 12 commands, 2 scripts, artifact templates, a conformance engine, and
a cross-project spec loop. Built to the Agent Skills open standard and Claude Code conventions, so
it can be dropped into a repository and used directly, or read by any agent runtime that
understands markdown instructions.

New here? Four entry points, shortest first:

| Document | For |
|---|---|
| `docs/USAGE.md` | Running a project. Fifteen minutes, operational |
| `docs/SKILL-INDEX.md` | Finding the right skill. One table, all 36 |
| `CLAUDE.md` sections 3a and 3b | Lite mode, and how to keep a session alive |
| `docs/guide/AIDD-Guide.pdf` | The full Developer & Designer Guide |

## What this implements

Three phases with three formal gates. A provenance system that tags every claim with its source
and confidence. A throwaway prototype used as an interview instrument. A refined requirement
document that reconciles the anchor document with the domain authority's corrections. Concept
exploration before any screen is specified, a usability round before the last gate, and a
measurement plan that says what the work was supposed to change.

```
PHASE 0  Intake                  classify what actually arrived; never skipped
PHASE 1  Empathize + Define      one activity: the D&D call, prepared, run, consolidated
GATE     written confirmation of the problem definition
PHASE 2A Initial Design Process  six parallel workstreams, ending in the throwaway prototype
GATE 1   validate the set together; heavy correction is success
PHASE 2B Further Design Process  requirements, entity model, flows, structure, the signed list
GATE 2   model first, developer present, list locks, measurement plan signed
PHASE 3  Test + Prototype        concepts, hi-fi specs, then a usability round with real operators
GATE 3   internal review against the requirements and the sessions
HANDOFF  full artifact set, live walkthrough, cross-project loop
```

## Layout

```
CLAUDE.md            orchestrator: state machine, routing, gates, lite mode, session discipline
GUARDRAILS.md        global rules; every agent loads this; overrides everything else
tools/               conformance.py (the four sweeps), render-share.py (client-facing HTML)
docs/                USAGE.md, SKILL-INDEX.md, guide/
config/              PROJECT_CONFIG and STATE templates
.claude/agents/      15 subagents, one per role, plus source-extractor
.claude/commands/    /new-project /intake-spec /phase-status /verify /design-qa /gate-1 /gate-2
                     /gate-3 /rework /usability-round /share /handover
.claude/skills/      36 skills, SKILL.md entry points, references/ for depth
templates/           artifact templates, plus _ARTIFACT-HEADER.md and _KEY.md
shared-specs/        design-system / EngineeringSpec / CodeReadability, cross-project
workspace/           _TEMPLATE/ skeleton, plus one folder per project
```

## Three things that make it survivable

### Sessions do not run out of room

The framework is not what fills a context window; the raw material is. A ninety minute transcript
is about 18,000 tokens and it used to be read four times by four different steps.

- **Raw sources never enter the main thread.** `source-extractor` reads each one in its own
  context and writes a digest under 400 words to `_digests/`. Everything downstream reads the
  digest; the source is reopened only when the digest names a reason.
- **Mechanical checks are scripts.** `tools/conformance.py` runs the four sweeps (traceability,
  staleness, provenance, drift) over the workspace and writes the snapshot. About 3,000 tokens
  against roughly 100,000 for the same work done by reading, and exhaustive where reading is
  approximate.
- **Agents load one skill at a time.** Each agent file routes the current step to a single skill
  rather than listing six.
- **Sessions end at phase boundaries.** `/handover` writes the resume contract.

Measured on a Phase 0+1 run: about 122,000 tokens before, about 20,000 after.

### Artifacts are written for the people who read them

The readers are designers, product owners and domain experts. Most are not technical and none of
them hold this framework in their head.

- Every artifact opens with three short paragraphs: what this is, where it stands, what we need
  from you.
- Every coded term is defined at the foot of the page it appears on, never in another file.
- Every table carries a filled example row.
- `share/` holds genuinely separate client-facing documents with no framework terms at all,
  rendered to a sendable page by `tools/render-share.py`.

GUARDRAILS 12 is the standard, and it is checkable. The test: hand it to a designer who has not
been in the project. If they cannot say what it decides and what is being asked of them within a
minute, it is not finished.

### The design is checked, not just documented

The process used to be able to prove a design was correct, complete, traceable and accessible, and
had no mechanism that would notice it was mediocre. Three additions close that:

- **`concept-exploration`** - three genuinely different compositions per primary screen, two
  killed against written criteria, before anything is specified.
- **`usability-testing`** - five real operators per role attempt the prioritized tasks before
  Gate 3. Findings route into the existing severity and Type A/B machinery.
- **`measurement-plan.md`** - three to five outcomes with a number, a baseline, a target and a
  counter-metric, signed at Gate 2 and read after launch.

Plus the **SC severity class**: a craft judgment with no rule behind it is admissible when it is
stated as a falsifiable prediction about a user, and it routes to the next session rather than to
a fix.

## Using it with Claude Code

1. Copy this folder into a repository root (or merge `.claude/` into an existing one).
2. Start Claude Code in the repo. `CLAUDE.md` is picked up automatically.
3. Run `/new-project <name>` and answer the adaptation variables. Set `aidd_mode: lite` if this is
   a short engagement or your first project.
4. Run `/intake-spec`, then work phase by phase. Gates block until their exit criteria are met.
5. Run `/handover` at every phase boundary.

## Using it without Claude Code

Everything is plain markdown. Load `CLAUDE.md` + `GUARDRAILS.md` as the system context, and paste
the relevant agent file and skill file when performing that role. The two scripts are plain Python
3 with no dependencies. Provenance tags, templates and gate reports work identically.

## Design decisions worth knowing

- Guardrails live in one file, referenced everywhere, so a rule change happens once.
- Skills carry the depth; agents are thin routers; the orchestrator only sequences.
- The provenance system (`[PO]` `[DA]` `[USER:role]` `[TEAM]` `[DOC]` `[RESEARCH]` `[LLM]` +
  confirmed / asserted / inferred) is the load-bearing wall. Most failure modes of this process
  are attribution collapse.
- Rework is first-class: corrections are surface (Type A) or structural (Type B), and Type B always
  routes through the refined requirement document before regeneration.
- Contradictions are deliverables, not errors. The instruction to a model is always "list the
  contradictions", never "reconcile".
- Anything mechanical is a script. Anything requiring judgment is a skill. Confusing the two is
  how a process becomes both expensive and unreliable.
