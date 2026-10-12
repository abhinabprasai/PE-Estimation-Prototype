# AIDD — Execution Plan

**For approval before any repo change.** Research is done; every number below is measured from your repo, not estimated. Sources at the end.

Three workstreams, in the order I recommend building them:

| | Workstream | Your words | Status |
|---|---|---|---|
| **A** | Token and session economics | *"running out of session limit tokens frequently"* | Diagnosed. Root cause found and it is not what it looks like. |
| **B** | Designer-readable output | *"unreadable... technical jargon vomitted all over the place"* | Diagnosed. 23 undefined terms inventoried with locations. |
| **C** | The five structural gaps | From the review | Patches already written; this plan sequences them. |

---

# Part A — Token and session economics

## A.0 The diagnosis

I measured every load path. **The framework is not your problem.** Here is the actual budget for a Phase 0+1 session:

| What | Tokens | Share |
|---|---:|---:|
| Always-on registry (34 skill descriptions + 14 agents + 9 commands) | 5,700 | 5% |
| GUARDRAILS.md + CLAUDE.md | 6,100 | 5% |
| discovery-lead + its 6 skills + 4 reference files | 24,100 | 20% |
| Templates it reads | 3,400 | 3% |
| **Framework subtotal** | **39,300** | **32%** |
| Anchor document (20 pages) | 12,150 | 10% |
| **Three call transcripts (90 min each)** | **54,000** | **44%** |
| Client materials in `00-inputs/` | 16,200 | 13% |
| **Project content subtotal** | **82,350** | **68%** |
| **One-pass total** | **~122,000** | |

And that is *one pass*. Transcripts are read again by `glossary-builder`, again by `contradiction-mining`, again by `kb-curator` on ingestion, again by `as-is-mapping`. Realistic multiplier is 3–6×, which is why you die mid-Phase-1.

**Five root causes, in order of size:**

1. **Raw sources live in the main conversation.** Transcripts alone are 44% of the budget, and the framework's core Phase 1 move (contradiction mining across sources) is *defined* as holding them all at once.
2. **There is no digest layer.** The system has raw inputs and finished artifacts, and nothing cheap in between that later steps can read *instead of* the source. `kb-curator` actively forbids one: *"Whole documents, not excerpts."*
3. **Nothing is delegated in practice.** `CLAUDE.md:5` says "You route work to subagents" and then never names the mechanism — no Task tool, no `/agents`, nothing. So it runs as one long conversation and everything accumulates. A subagent gets a clean context window and returns ~1–2k; that saving is sitting unclaimed.
4. **Every conformance sweep is LLM work that should be a script.** `find . -name '*.py'` returns nothing outside the guide builder. Traceability (regex REQ-IDs, build a matrix), staleness (mtimes + a dependency graph), provenance (regex tag/confidence pairs), drift (set comparison) are all mechanical. Today `/verify` reads every artifact in the project. **Anthropic's own guidance: executable scripts cost no context, only their output does.**
5. **Agents load all their skills at once.** Skill *bodies* load on demand (only frontmatter preloads), but `discovery-lead` says "load GUARDRAILS first" and lists six skills, so the model pulls most of them. At any moment it is doing exactly one.

## A.1 The fixes, ranked by leverage

### A1 — Extraction subagents for every raw source *(biggest single win)*

Any step whose input is a raw document runs as a one-shot subagent that reads the source and returns **only** a structured extract capped at ~800 tokens. The main thread never sees the transcript.

New agent `.claude/agents/source-extractor.md` (run on a cheap model): reads one source, emits the tagged claim list, the new terms, the silences, the contradictions-with-X, and nothing else. Called once per transcript, per client document, per incumbent product.

- **Saves:** ~54k on transcripts + ~16k on client materials in Phase 1 alone.
- **Phase 1 goes from ~122k to ~45k.**
- **Cost:** one new agent file, a `## Extraction` section in five skills.

### A2 — Digest artifacts, and a read-this-not-that rule

Every raw source gets `{source}.digest.md`, capped at 400 words: what it is, who gave it, when, the tagged claims, what it does not answer. Downstream skills read the digest; they open the source only when the digest flags a reason.

`kb-curator`'s "whole documents" rule stays for **storage** (it is right — excerpting destroys evidence). The **reading** rule changes. This is the just-in-time retrieval pattern Anthropic recommends: keep lightweight identifiers in context, load the heavy thing only on demand.

- **Saves:** the 3–6× re-read multiplier, which is larger than any single-pass saving.

### A3 — Move the four conformance sweeps into a script *(highest ROI per hour of my time)*

One ~350-line Python script, `tools/conformance.py`, that walks the workspace and emits the snapshot:

- **traceability** — regex `REQ-[A-Z]+-\d+` across all artifacts, build the matrix, diff against the previous, emit orphans and ghosts
- **staleness** — file mtimes against the `CLAUDE.md §5` dependency graph, encoded as a dict
- **provenance** — regex for claim-shaped lines lacking a tag; tag/confidence pairs in the wrong zone; `[LLM]` outside quarantine
- **drift** — parse the ERD's status lists, the encoding map and the specs; set-compare

`/verify` then runs the script and the model reads only the findings.

- **`/verify` goes from ~100k to ~3k.** It becomes something you can run weekly without thinking about it, which is what the cadence already demands and nobody does.
- This also fixes a review finding for free: the conformance engine currently *cannot* be trusted to be exhaustive, because it is a model reading a hundred files and hoping.

### A4 — One skill at a time

Rewrite the agent files' skill lists as a routing block rather than a manifest:

```markdown
## Your skills — load ONE, for the step you are on
| If the current step is | Load |
|---|---|
| classifying what arrived as the spec | spec-intake |
| reading the anchor document | anchor-analysis |
...
Do not load a second skill until the first step's artifact is filed.
```

Plus: move the biggest sections of the four fattest skills (`ux-flow-optimization` 268, `interaction-design` 268, `responsive-design` 252, `content-design` 248) into their **currently empty** `references/` directories.

- **Saves:** ~12–18k per agent invocation.

### A5 — Trim the always-on registry

34 descriptions average 427 characters (max 497). Target 250. Saves ~1.5k on **every session forever**, at zero behavioural cost — the description only has to trigger reliably, not explain the skill.

### A6 — Make phases into bounded sessions

Add a `## Session boundaries` section to `CLAUDE.md`: each phase ends with a resume contract (STATE.md + the phase digest) that is sufficient to start a fresh session cold. Plus a `/handover` command that writes it. A session should never have to span a phase boundary.

### A7 — The Lite path

`minimum_set: true` currently reduces the *artifact* set and explicitly not the instruction set ("everything else becomes optional but its skill still applies"). Add `aidd_mode: lite | full`. Lite keeps six mechanisms — provenance tags, the contradiction rule, the ERD consequences note, Type A/B routing, the quiet-gate rule, the state enumeration table — and ~1,200 lines instead of 5,800.

## A.2 Expected result

| | Now | After A1–A5 |
|---|---:|---:|
| Framework floor per session | 39,300 | ~14,000 |
| Phase 1 project content in main thread | 82,350 | ~6,000 (digests) |
| `/verify` | ~100,000 | ~3,000 |
| **Phase 0+1 one-pass** | **~122,000** | **~20,000** |

Roughly a **6× reduction**, and the re-read multiplier largely disappears because the digests are what get re-read.

---

# Part B — Designer-readable output

## B.0 The diagnosis

I had the artifacts read as a non-technical designer would read them. The finding is sharper than "too much jargon."

**The framework writes in compressed aphorism — for an expert re-reading their own notes.** Every noun is a compressed process: *"the staleness sweep"*, *"the standing cadence"*, *"the finding"*. That is precisely the opposite of your audience.

Three measurements:

- `templates/refined-requirement-entry.md:36-40` — **16 framework-internal terms per 100 words.** Two sentences containing four nominalizations, and three metaphors (*archaeology dig*, *blast radius*, *walks*) sitting next to a real defined process state, so the reader cannot tell which words are figures of speech and which are vocabulary.
- `templates/handoff-manifest.md:37` — **27 per 100 words.** A seven-column table row, zero verbs, containing *mutations*, *optimistic/pending/confirmed*, *narrow strategy* — none of which is defined anywhere in the repo. This is in your most client-adjacent artifact.
- `templates/traceability-matrix.md:3-9` — **11 per 100.** Opens with a sentence fragment naming two internal roles.

**23 coded terms appear in delivered artifacts with no definition the reader can reach**, including `[DA]`, `(confirmed)`, `Type A/B`, `S1`, `Lens 1–7`, `blast radius`, `orphan`, `load-bearing`, `pain index`, `optimistic/pending/confirmed`, `server-authoritative`. `Lens | 1,3,6,7` in `STATE.md:64` is a cell that asks a designer to record bare digits whose key exists in a different file.

**Structural failures:** seven templates are 62–91% table by line count. Five open with `| Field | Value |` as the literal first thing on the page. **14 of 16 templates contain a table with a header row and no example row.** Across 31 artifact files there is exactly **one** section titled "What this is."

**And the framework knows.** *"Read aloud"* appears six times — at gates, at handoff, for the assumption register, for the consequences note. It is the framework's substitute for a readable document: a human standing there translating. Meanwhile `content-design/SKILL.md:84` states the rule the framework breaks on itself: *"Never expose internals... alongside plain language."* It applies that standard to the products it designs and not to the documents it produces.

## B.1 The fixes

### B1 — The two-layer artifact *(one file, not two)*

You chose "working file + human read." I recommend doing it **in one file**, not two, with one exception.

Every artifact opens with this block, before any table:

```markdown
> **What this is.** One paragraph, plain language, no framework terms. What this
> document decides and who it is for.
>
> **Where it stands.** Draft / reviewed / signed, and what changed since last time.
>
> **What we need from you.** The specific decision or confirmation being asked for,
> or "nothing — this is for reference."

---
[the structured working content, unchanged]
```

**Why one file and not two:** the repo already ships five byte-identical duplicate files with no sync rule (review D-25). A separate "human version" will drift within one project, and the drifted one will be the one the client reads. One file, plain layer on top, cannot drift.

**The exception** — genuinely separate documents for the three client-facing moments, where the audience is outside the team and the framing is different, not just the wording: a gate brief, a handoff walkthrough, a validation pack. Those go in `share/`.

The pattern already exists in your repo and is applied to exactly one artifact out of thirty: `question-generation` produces a "share-version (questions only, no ladders, sent to attendees ahead)." Generalise it.

### B2 — Define at point of use, never in a distant file

The model is already in your repo, and it is the one thing done right: `design-critique-report.md:18-23` defines severity and type **inline, immediately under the table that uses them**, one sentence each, with the tiebreaker stated. Every coded term follows that pattern.

Mechanically: a `_KEY.md` per workspace folder, and a required footer key on any artifact that uses coded terms. So a filled `problem-statement.md` carries `[DA] = domain authority · (confirmed) = they verified it, in writing` at the bottom.

### B3 — Pair the code with the plain gloss on first use

Not renaming — the codes are compact and used constantly, and renaming `Type B` across 40 files is churn. Instead, first use per document is always paired:

- `Type B (a rule change)` · `Type A (a surface fix)`
- `ORPHAN (a requirement nothing was built for)` · `GHOST (behaviour nobody asked for)`
- `blast radius (what breaks if this turns out to be wrong)`
- `load-bearing (something else depends on this)`
- `(confirmed) (the domain authority verified it, on record)`

Three terms I would actually rename, because they are engineering vocabulary with no business in a designer's artifact: `optimistic/pending/confirmed` → **"what the screen shows while it saves"**, `server-authoritative` → **"decided by the system, not the screen"**, `mutations` → **"actions that change data"**.

### B4 — Replace GUARDRAILS §12

Today it is three bullets about em dashes and bullet usage. It governs punctuation and says nothing about being understood. Replace with a checkable writing standard:

- Define every coded term at its first use in the document. A term a reader cannot resolve from the page they are holding is a defect.
- Lead with the answer. Every document opens with what it decides, before how it was decided.
- Sentences average under 25 words. Active voice.
- One worked example per rule. A rule with no example is an aspiration.
- No compressed nominalizations. *"the staleness sweep walks the links"* becomes *"we check which documents are now out of date."*
- Tables carry one filled example row, always.

### B5 — Templates get an opener and an example row

All 16 templates: a "What this is / Who reads it / When it's done" opener, and one filled italic example row in every table. This is mechanical and I can do all of it.

### B6 — `share/` exports for the three client moments

`share/gate-{n}-brief.md`, `share/handoff-walkthrough.md`, `share/validation-pack.md`. Plain language, no codes, decisions and questions only.

**Optional, and I'd like your call:** a small script that renders the `share/` set to a single styled HTML page you can send or open in a review. Cheap to build, and it is the difference between emailing markdown and sending something that looks like Leapfrog made it.

---

# Part C — The five structural gaps

Patches are written and sitting in `review/patches/`. Sequencing only:

| Tier | What | Effort |
|---|---|---|
| 0 | Hygiene script — 11 broken `GUARDRAILS 10` citations and 10 other defects | 30 min |
| 1 | The 8 defects that will break a real project (state lists, `shared-specs`, `[USER:role]`, the missing snapshot template) | 1 day |
| 2 | Ordering fixes — accessibility split across Gate 2/3, the 2A style seed | half day |
| 3 | The quality layer — `usability-testing`, `concept-exploration`, the outcome layer, the craft severity class | 3–4 days |

---

# Recommended build order

I want to do **A before C**, because every hour you spend running the framework before A lands costs you a session.

| Step | Work | Est. |
|---|---|---|
| **1** | **A3** — the conformance script | 3 h |
| **2** | **A1 + A2** — extraction subagent + digest layer | 4 h |
| **3** | **A4 + A5** — one-skill-at-a-time, registry trim, split the four fat skills | 3 h |
| **4** | **Tier 0 + Tier 1** hygiene and breaking defects | 1.5 days |
| **5** | **B4 + B5 + B2** — the writing standard, all 16 templates, the key files | 1 day |
| **6** | **B1 + B3** — two-layer block across every artifact, glossed terms | 1 day |
| **7** | **A6 + A7** — session boundaries, `/handover`, the Lite path | half day |
| **8** | **B6** — `share/` exports (+ HTML renderer if you want it) | half day |
| **9** | **Tier 2** ordering fixes | half day |
| **10** | **Tier 3** the quality layer | 3–4 days |

Steps 1–3 alone should end the session-limit problem. Steps 5–6 are the readability fix.

---

# Four decisions I need from you

1. **One file or two, for the plain-language layer?** I recommend one file with a plain block on top (B1), plus genuinely separate `share/` documents for the three client moments. The alternative — a parallel human version of every artifact — will drift.

2. **Do you want the HTML renderer for `share/`?** Half a day. Turns the client-facing set into something you can send. Not needed if you always present live.

3. **Build the Lite path (A7)?** Worth it if junior designers or short engagements are common; skip it if every project is a full domain-heavy build.

4. **Rename the three engineering terms** (`optimistic/pending/confirmed`, `server-authoritative`, `mutations`), or keep them and gloss them? Renaming is clearer for designers; the current names are what a developer expects to read at handoff. My instinct is: rename in the designer-facing layer, keep the engineering term in `DEV NOTES` where developers read.

---

**Sources**

- [Effective context engineering for AI agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — compaction, structured note-taking, sub-agent architectures returning 1,000–2,000 token summaries, just-in-time vs pre-loading retrieval, the "right altitude" principle
- [Skill authoring best practices — Claude Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — three-stage progressive disclosure, SKILL.md under 500 lines, references one level deep with a TOC above 100 lines, and that executable scripts consume no context
- [Subagents and context isolation — ClaudeWorld](https://claude-world.com/tutorials/s04-subagents-and-context-isolation/) — clean context window per subagent, only results flow back
- [Principles of plain language — Digital.gov](https://digital.gov/guides/plain-language/principles) — write for the specific audience, active voice, topic sentences, summarize up front
- [Federal Plain Language Guidelines](https://wid.org/wp-content/uploads/2022/03/FederalPLGuidelines.pdf)
