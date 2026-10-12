# Using the AIDD Agent System

A practical guide for anyone on the team running a project through this system with Claude
Code. Read this once end to end (fifteen minutes); afterwards, `/phase-status` will always
tell you where you are and what happens next.

For the full treatment (how every mechanism works, agent cards, all 34 skills, troubleshooting
and extension rules) see **`docs/guide/AIDD-Guide.pdf`**, the 52-page Developer & Designer Guide.

---

## What this system is

An agentic implementation of the AI-Augmented Discovery and Design (AIDD) process: three
phases, three formal gates, and a set of specialist agents that carry the depth of a senior
product design team. You talk to the orchestrator (the main Claude session); it routes work to
agents; agents load skills; skills carry the craft. Nothing advances past a gate without the
gate's exit criteria met and its report filed, and a standing conformance engine checks
continuously that every artifact still agrees with the documents it derives from.

The one-paragraph philosophy: front-load discovery, tag every claim with its source and
confidence, prototype to be corrected rather than admired, reconcile corrections through one
central requirement document, and design only what was prioritized. Models draft, humans rule.

## Getting started

### Starting a new project

```
/new-project acme-invoicing
```

The orchestrator copies `workspace/_TEMPLATE/`, then asks you the five adaptation variables
(anchor document, domain authority, rule density, engagement type, designer engagement) plus
`minimum_set` and `users_reachable`. Answer honestly; they change how the whole process routes.
Do not guess who the domain authority is; if you do not know, that is the first thing to find
out, and Phase 1 blocks until you do.

Immediately after, spec intake runs:

```
/intake-spec
```

Give it whatever you have: a PRD, a gap document, a slide deck, a login to the old system, or
nothing at all. It classifies what arrived (class A through F), audits it against fourteen
dimensions, fills the PRD slot at `00-inputs/PRD.md`, and starts the substitute path if there
is no real spec. **A missing spec never blocks the project**; the reconstruction interview and
the assumption register carry it.

### Joining an existing project

Open a session in the repo. The orchestrator reads STATE.md and announces phase, blockers,
next gate, stale artifacts, and conformance status. Then:

```
/phase-status
```

for the standup view: where the project is, what blocks, the next three actions with owners.

## The commands

| Command | What it does | When |
|---|---|---|
| `/new-project {name}` | Creates the workspace, collects config, routes to spec intake | Day one |
| `/intake-spec` | Classifies and audits whatever arrived as the spec; runs the no-spec path | Day one, and whenever a new client document lands |
| `/phase-status` | Standup: phase, blockers, gate state, freshness, conformance headline, next three actions | Any time |
| `/verify` | Conformance snapshot: traceability, staleness, provenance, drift; findings with owners | Weekly in 2B/3, before gates, after corrections, or on demand |
| `/design-qa` | The seven-lens design critique on current artifacts | Before every gate; whenever a screen feels wrong |
| `/gate-1` `/gate-2` `/gate-3` | Runs the gate with attendance, exit criteria, correction classification, filed report | At phase boundaries |
| `/rework {correction}` | Classifies a correction Type A/B and routes it through the machinery | Whenever feedback arrives outside a gate |
| `/usability-round` | Runs the sessions with real operators and routes what they find | Before Gate 3 |
| `/share {gate-n\|walkthrough}` | Produces the client-facing version, in plain language | Before every review session |
| `/handover` | Writes the resume contract so this session can end cleanly | End of every phase, or when the session feels heavy |

## The path of a project

```
Phase 0   /intake-spec. Classify inputs, audit, open the assumption register.
Phase 1   Discovery: anchor analysis -> glossary -> questions -> the D&D call ->
          contradiction mining -> WRITTEN confirmation of the problem set.
Phase 2A  Parallel: research + knowledge base + as-is flows + style seed + prompts ->
          throwaway prototype (timeboxed, built to be corrected).
GATE 1    DA + PO. The set reviewed together. Heavy correction = success.
          Prototype archived. Corrections classified A/B and routed.
Phase 2B  Convergence: refined requirements -> ERD -> to-be flows -> process breakdown ->
          flow optimization -> information architecture -> userflows + sitemap ->
          prioritized feature list (signed).
GATE 2    DA + PO + developer. Model first, screens last. List locks (fixed-bid).
Phase 3   Hi-fi specs for prioritized features only: all screen states, dev notes,
          interactions, status mapping, real copy, realistic content.
GATE 3    Internal, line-by-line against requirements. Then client validation.
HANDOFF   Full artifact set, live walkthrough with the dev team, md-spec loop
          (updates shared-specs for the next project).
```

## Who does what (agents you will see)

| Agent | Owns |
|---|---|
| discovery-lead | Phase 1 end to end, spec intake, the D&D call |
| domain-researcher | Incumbent teardowns, research answers |
| kb-curator | The knowledge base; answers questions with citations |
| prompt-spec-writer | PRD draft, prototype prompts, style guide structure |
| flow-modeler | As-is, to-be, process breakdown |
| data-modeler | The ERD: entities, statuses, permissions, lifecycle |
| ux-architect | Flow optimization, information architecture, userflows, sitemap |
| ui-designer | Visual system, components, interaction behaviour, responsive |
| prototype-engineer | The throwaway prototype and its timebox |
| requirements-reconciler | The refined requirement document; every Type B correction |
| hifi-spec-designer | Phase 3 feature specs |
| design-critic | The seven-lens critique, accessibility, content quality |
| gate-reviewer | Every gate, every review, the conformance engine |
| handoff-manager | The package, the walkthrough, the md-spec loop |

You rarely address agents directly; describe what you need and the orchestrator routes it.

## The provenance system (the part you must not skip)

Every claim about the client's world carries a source tag and a confidence marker:

- Tags: `[PO]` `[DA]` `[USER:role]` `[TEAM]` `[DOC:section]` `[RESEARCH:source]` `[LLM]`
- Confidence: `(confirmed)` = the domain authority verified it, on record. `(asserted)` = a
  human said it once. `(inferred)` = a model or reasoning produced it; no human has.

The rules that matter daily: an `[LLM] (inferred)` domain rule never enters a design artifact
(it goes to open-questions); anything that constrains behaviour (a rule, status, permission,
lifecycle) must be `(confirmed)` before Gate 2; contradictions between sources are deliverables
to surface, never conflicts to quietly resolve.

When you paste notes, forward emails, or relay a call, SAY WHO SAID WHAT. The system can do
nothing honest with "the client wants X".

## How the system stays conformant (monitoring)

Three layers keep the end results from drifting away from what the documents say:

1. **Continuous**: the conformance engine (`/verify`) maintains a traceability matrix (every
   REQ-ID -> the flows, rules, ERD constraints, and screens that carry it) and sweeps for
   staleness, provenance violations, and drift. ORPHANs (requirements nothing implements) and
   GHOSTs (behaviour citing no requirement) get owners. Runs weekly in 2B/3, before gates,
   after every structural correction.
2. **Pre-gate**: the design critique (`/design-qa`) runs its lenses; open S1 findings are
   declared or fixed before attendee time is spent.
3. **Gates**: humans with authority verify the domain truth; every correction is classified
   (Type A surface / Type B structural) and routed; Type B always updates the requirement
   document BEFORE any artifact is patched, and the post-gate check verifies corrections
   actually landed.

If you remember one mechanism, remember this: **corrections route through
requirements-reconciler first when they touch a rule, entity, status, permission, or
requirement.** That is what keeps the documents and the design in agreement for the whole
project.

## Working without a spec

Normal, not exceptional. The system runs a reconstruction interview (six passes: goal, actors,
artifacts, rules, exceptions, consequences), derives a brief, gets it signed, and runs the
project on it. Anything unknown becomes an assumption register entry with a blast radius, an
owner, and a decision date, disclosed at every gate. What is never allowed: a silent guess.

## Keeping a session alive

The framework is not what fills up a session; the raw material is. A ninety minute transcript is
about 18,000 tokens, and without care it gets read four times by four different steps. Three
habits, and they are worth more than any of the artifacts:

1. **Never paste a transcript or a long document into the conversation.** Put it in the workspace
   and let `source-extractor` digest it. Everything downstream reads `_digests/`, which is under
   400 words per source.
2. **Run `/handover` at the end of every phase**, and any time the session feels heavy. It writes
   `HANDOVER.md`, which with STATE.md is enough to start the next session cold. A project is not
   meant to be one conversation.
3. **Use `/verify`, do not ask for a manual check.** It runs `tools/conformance.py`, which is
   exhaustive where a manual read is approximate, and costs about 3,000 tokens against roughly
   100,000 for the same work done by reading.

If a project is small, or this is your first, set `aidd_mode: lite` at `/new-project`. It runs six
mechanisms instead of thirty-six and can be upgraded at any phase boundary (CLAUDE.md 3a).

## Documents your client actually reads

Every artifact opens with three short paragraphs in plain language: what it is, where it stands,
and what we need from you. Coded terms are defined at the foot of the page they appear on.

For review sessions and handover there are separate documents in `share/`, written with no
framework terms at all. Produce them with `/share`, and render them to a page you can send with
`python3 tools/render-share.py workspace/{project}/share/`.

The test, before any document goes out: hand it to a designer who has not been in the project. If
they cannot say what it decides and what is being asked of them within a minute, it is not
finished. Reading it aloud to them is not a fix; it is the symptom.

## Day-to-day tips

- Feed the system evidence: transcripts, real (redacted) documents, screenshots, exports. One
  real record beats three paragraphs of description.
- When the client sends feedback, run `/rework` with the verbatim feedback rather than
  paraphrasing it into the artifacts yourself.
- Trust the gates' strictness. A gate refusing to run because an attendee is missing or a
  pre-check failed is the system working, not bureaucracy.
- The glossary is binding. If the client's word for something changes, that goes through the
  glossary (and the reconciler if the term is rule-bearing), not directly into a screen.
- Everything is plain markdown. Read the artifacts; they are written for humans, and every
  skill file (`.claude/skills/*/SKILL.md`) explains its own craft if you want the why.

## Where things live

```
workspace/{project}/     everything project-specific (layout: CLAUDE.md section 8)
  00-inputs/PRD.md       the spec slot: the client's spec or the completed placeholder
  00-inputs/assumptions.md   the assumption register
  60-requirements/       refined requirements, prioritized list, traceability matrix
  conformance/           conformance snapshots
shared-specs/            cross-project: design-system, EngineeringSpec, CodeReadability
templates/               artifact templates the skills reference
docs/                    this guide, the usage guide, the skill index
```
