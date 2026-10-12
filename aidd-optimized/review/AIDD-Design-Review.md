# AIDD Agent System — Design Review

**Reviewer stance:** Lead Product Designer, platform-scale product org (Google/Apple bar)
**Scope:** the full repository at `Downloads/aidd` — 1 orchestrator, 1 guardrails file, 14 agents, 34 skills, 9 commands, 16 templates, 3 shared-spec seeds, the workspace skeleton, and the 52-page guide with its build script.
**Method:** every file read. Every claim below carries a file and line reference so you can check it.
**Date:** 31 August 2026

---

## 1. Verdict

This is the best-articulated design process I have read from an agency, and it is not yet a design system for producing good products. Those two statements are both true and the gap between them is the whole of this report.

What you have built is an **epistemic and conformance machine**. It is genuinely excellent at four things: knowing where every claim came from, refusing to let a model's invention become a client rule, keeping a large artifact set mutually consistent as it changes, and making rework traceable. The provenance layer, the ERD lifecycle→interface consequences chain, and the ORPHAN/GHOST traceability engine are better than what most in-house design orgs actually run. I would adopt three of these mechanisms tomorrow.

What it does not yet have is a **quality layer**. There is no point in this process where anyone outside the project team attempts a task on the design; no point where more than one solution exists; no point where the product's success is defined, measured, or instrumented; and no place in any artifact where a design could be recorded as *good* rather than as *complete*. The system can prove, at handoff, that all 47 states of a screen are specified, that every one traces to a confirmed requirement, and that the contrast passes. It has no mechanism that would notice the screen should not have had 47 states.

That is a solvable problem, and it is a smaller change than it sounds — most of the missing pieces already exist in fragments elsewhere in the repo. Section 6 is the sequence.

Separately, the repo carries a class of hygiene defect that undercuts its own central argument: **11 citations point at `GUARDRAILS 10`, a section that does not exist** (`GUARDRAILS.md` runs 1–9, then 10a, 11, 12). A framework whose first principle is "every claim carries its source" ships eleven dangling pointers into its own rulebook. Section 5 is the full defect register.

**Overall grade by dimension**

| Dimension | Grade | One-line |
|---|---|---|
| Epistemics / provenance | A | Genuinely novel and correctly load-bearing |
| Domain modelling (ERD → interface) | A | Best treatment of lifecycle-constrains-affordance I have read |
| Process governance / gates | A− | Real operational scar tissue; "a quiet gate is a warning" is earned |
| Craft depth in the reference files | B+ | Strong content, hand-tuned tables presented as derived systems |
| Internal consistency | C | Eleven broken citations, three conflicting state lists, one impossible phase ordering |
| **User validation** | **F** | Phase 3 is named "Test" and contains no test |
| **Outcome measurement** | **F** | The business measure is scored at intake, then never referenced again |
| **Design exploration** | **F** | No step anywhere generates a second option |
| Adoption cost / operability | C+ | ~5,800 lines of skill instruction and no minimum viable path through it |

---

## 2. What is genuinely excellent

Short, because you did not ask me for praise, but these are the parts worth protecting from any change I propose below.

**The provenance system.** `GUARDRAILS.md:9-43`: six source tags crossed with three confidence markers, plus the hard rule that `[LLM]`-only domain claims go to `open-questions.md` and never into an artifact. Attaching *confidence* to *source* — and then making `(confirmed)` mean specifically "the domain authority verified it, on record" — is the right primitive. Most teams tag sources and stop.

**Contradictions as deliverables.** `GUARDRAILS.md:58` — "Contradictions between sources are deliverables. List them; never silently resolve." And the operational form of it: the instruction to a model is always *"list the contradictions"*, never *"reconcile"* (`GUARDRAILS.md:59-60`). This is a genuinely important LLM-era discipline and I have not seen it stated this cleanly anywhere.

**The ERD consequences note.** `erd-modeling` + `data-modeler.md:39-42` — one line per lifecycle rule that constrains the interface, in designer language: *"X is reversed, never deleted: no delete affordance anywhere; provide reverse with reason field."* This is the mechanism by which a data rule actually reaches a screen. It is the single most transferable idea in the repo and I would put it into a general design practice unchanged.

**The quiet-gate rule.** `GUARDRAILS.md:77-79` — little correction at Gate 1 is a warning, not a pass. Paired with `gate-review`'s post-gate verification ("corrections that evaporate teach everyone that gates are theatre"). Both are the product of someone having been burned, which is the only way anyone learns them.

**The elimination ladder with rung accounting.** `ux-flow-optimization` — record which rung a fix landed on *and why the rung above was unavailable*. Turns "we improved the flow" into an auditable claim.

**The reference files' craft content.** `motion-tokens.md`, `color-system.md`, `control-selection.md`, `component-states.md` are all above the level of most public design-system documentation. The interaction-design feedback-timing table and the optimistic/pending/confirmed three-condition test are correct, non-obvious, and stated better than in the sources they derive from.

---

## 3. The five structural findings

These are the ones that change what the system produces, not just how tidy it is.

---

### S1 — Phase 3 is called "Test" and contains no test

**Finding.** No user touches this design between the discovery call and handoff.

- `CLAUDE.md:29` names Phase 3 "Test + Prototype". Its owners (`CLAUDE.md:39`) are `hifi-spec-designer, ui-designer, design-critic` — a spec writer, a system author, and an internal reviewer.
- Gate 3 attendance is "internal only" (`CLAUDE.md:207`, `gate-review/SKILL.md:33`). **The one gate that reviews actual screens has the weakest attendance requirement in the system.** Gates 1 and 2 mandate DA + PO (+ developer); the gate closest to what a human being will touch requires nobody outside the team.
- Usability testing is promised twice — `CLAUDE.md:59` ("add user interviews to Phase 1 and usability testing to Phase 3") and `PROJECT_CONFIG.template.md:25` — and implemented **zero** times. A repo-wide grep for `usability test` returns exactly three hits, all configuration comments. There is no skill, no agent, no command, no template, and no gate exit criterion covering it.
- The only empirical user instrument in the entire post-discovery process is the tree test at `information-architecture/SKILL.md:130-148`. It is well specified (8–12 real tasks, first click recorded separately from final destination, ~70% direct-success threshold on daily tasks). It tests **labels and structure only**, and it ships with an escape hatch at `:147-148`: *"On projects where users are not reachable, run it with the DA and mark the results (asserted)."*
- `STATE.template.md:86` logs `R-SME-SUB` — "SME standing in for end users on a user-facing product" — as a risk. Nothing in the system mitigates it. The risk register is where this concern goes to be acknowledged and then not addressed.

**Why this is the top finding.** Compare the effort allocation. `erd-modeling` gets a 176-line exhaustion protocol for closing a status list. `interview-facilitation` gets a skill plus a 92-line technique bank. `dummy-content` gets an adversarial-content pass. All of these are correct investments. And the question *"can anybody actually do the task on this?"* gets a routing instruction in a config comment pointing at nothing.

A domain-correct, fully-specified, WCAG-AA, provenance-clean product that operators cannot use is a failure with excellent documentation. The framework's own risk register knows this and its process does not act on it.

**What I would expect at this bar.** Five moderated sessions with real operators on the hi-fi prototype before Gate 3, task-based, with a task-success and time-on-task record, findings severity-mapped into the existing S1–S4/Type A–B machinery. Five sessions is a day and a half. Against a project that has already spent weeks on an exhaustion protocol, it is not a budget argument. Patch `P2` in `patches/` is the missing skill, written to fit the system's existing conventions.

---

### S2 — Nothing in this system generates a second option

**Finding.** The entire process is a single funnel from requirement to specified screen, with no divergence step at the design layer and no comparison of alternatives anywhere.

- `hifi-spec/SKILL.md` procedure: step 3 builds the state enumeration table, step 4 reads the cost table, step 5 is *"Write blocks 1 to 9."* There is no step between "here is what must be true" and "here is the screen."
- `CLAUDE.md:36` describes Phase 3 as "convergent and divergent at once," but the divergence it means is *"anything that changes a requirement diverges back through the reconciler"* (`hifi-spec-designer.md:11`). That is a correction path, not an exploration path.
- The IA skill is the sole exception and it proves the rule: `information-architecture` requires the navigation model to be recorded *"with its rejected alternatives"* (`ux-architect.md:81`). That discipline exists once, for one artifact, and is applied nowhere else. Not to screen composition, not to the interaction model, not to the flow, not to the component selection.
- `visual-design`'s hierarchy method (`SKILL.md:37-58`) is a method for *evaluating* one composition (squint, five-second), not for *generating and choosing between* several.

**Why this matters at this bar.** The mechanism that produces good design is not rigour applied to the first idea; it is *cheap parallel options killed against explicit criteria*. Three concepts at low fidelity, argued against each other for an hour, is the least expensive quality intervention available in any design process, and it is the one thing every strong product org does without exception.

The framework's greatest strength works against this. State-completeness discipline is expensive per screen — nine blocks, eleven generic states, one state per ERD status. That cost is a powerful disincentive to explore, because exploring means paying it more than once. So the system structurally guarantees the *first defensible idea* gets built out beautifully. There is no step at which anyone asks whether it was the right shape.

**What I would expect.** A `concept-exploration` skill invoked between the state enumeration table and block 1: three genuinely different compositions per *primary* screen (not per screen — per screen would be ruinous), at deliberately low fidelity, judged against the cost table and the hierarchy method, with the rejected two filed and one line of why each lost. Cost: half a day per feature. Patch `P3`.

---

### S3 — The outcome is scored at intake and then dropped

**Finding.** The system can prove every requirement is implemented. It cannot demonstrate that any of them mattered.

`spec-intake/references/spec-audit-checklist.md:14-20` opens with exactly the right dimension:

> "**1. Business goal and measure** — Does the document say what outcome the business wants, and how it will know it got it? PRESENT: a stated goal plus at least one measurable indicator with a current baseline. … Without this, prioritization has no ranking basis and **every feature argument becomes taste**."

Then trace it forward and it disappears at every station:

| Station | What carries the outcome | Reality |
|---|---|---|
| `templates/refined-requirement-entry.md` | 10 fields | No outcome, no measure, no target |
| `prioritization/SKILL.md` | 121 lines, 8 methods | Never mentions the business goal; its impact column is the **pain index**, which per `to-be-design/SKILL.md:109` counts manual movements, error rows, waits, crossings, systems touched — that is *process cost*, not value |
| `templates/traceability-matrix.md` | To-be / Breakdown / ERD / Hi-fi columns | No outcome column |
| `hifi-spec` block 3 DEV NOTES | validation, calculations, caching, server-authority | No instrumentation, no event taxonomy |
| `handoff-package` + `templates/handoff-manifest.md` | full artifact set | No measurement plan, no baseline capture, no post-launch review |
| `md-spec-loop/SKILL.md:51-60` — the loop metrics | Type B count after Gate 2, build-time clarifications, generated-code reuse | **All three measure the process. None measures the product.** |

`md-spec-loop/SKILL.md:16-17` claims these three metrics are "the only cross-project evidence of whether the whole system is getting better or just longer." They are evidence the system is getting **cheaper to run**. A design practice that can demonstrate falling rework and rising code reuse, and cannot demonstrate that anything improved for a user or the business, has optimised the meta-loop and left the product unmeasured.

Note the second-order effect: `prioritization` is an unusually honest file — *"a score whose inputs are guesses is a guess with arithmetic on top"* (`:28-30`). But every method in its selection table needs a **value** dimension, and the file supplies only pain-index deltas and stakeholder opinion. It notices the engineering half of the problem (`:83-84`, "[TEAM] effort scores with no engineering voice are systematically low") and fixes it. The symmetric gap on the value side goes unremarked. Opportunity scoring is listed and gated on `users_reachable` — an orphan variable the orchestrator does not know exists (see D-06) — with no method for collecting the importance/satisfaction data.

**What I would expect.** An outcome row on the requirement entry, an outcome column on the traceability matrix, a `measurement-plan.md` artifact produced at Gate 2 and carried in the handoff manifest, and a fourth loop metric that is about the product. Patch `P4`.

---

### S4 — The quality record has no column for quality

**Finding.** `STATE.template.md:60-66`:

```
## Design quality record
| Gate | Critique run | Lenses | Open S1 | Ladder rungs run | Exceptions recorded |
```

Every column is a completion count or a violation count. *Was the critique run. Which lenses. How many blockers. Which accessibility rungs. How many exceptions.* There is no cell in which a design could be recorded as good.

The lens set confirms it. Of the seven lenses in `design-critique/SKILL.md:32-96`:

- Lenses **2** (consistency), **3** (state completeness), **4** (accessibility), **5** (content), **7** (domain fidelity) are pure conformance — each checks an artifact against a written rule. `:186` states this explicitly: *"The critique judges against written rules; where no rule exists, either the finding is evidence-based or it is S4."*
- Lens **6** (flow friction) checks against the cost table, which is a *cost* measure.
- Lens **1** (hierarchy) is the only craft lens. Its instruments are the squint test and a five-second test with a two-of-three pass bar. One paragraph of perceptual judgment against 214 lines of rule-checking.

And then the severity ladder makes senior judgment **inadmissible by construction**:

> `design-critique/SKILL.md:107` — "**S4 note** | A preference or an idea with no rule behind it | Record and drop. **Not a finding.**"

The *governance* logic is correct and I want to be fair to it: `:13-15` states the goal as protecting correct-but-unfamiliar decisions from taste, and `:117-118` correctly observes that forty S4 notes burns a critique's credibility. Both true. But the *craft* consequence is that a senior designer's judgment — that a screen is joyless, that the density is punishing at hour six, that the primary action is buried behind a rule the guide never anticipated, that the whole composition is the wrong shape for the job — is definitionally "record and drop."

The framework has correctly identified that unstructured taste destroys critiques. It has responded by removing taste entirely, rather than by *disciplining* it. The professional version of the same instinct is: an experienced practitioner's judgment is admissible **when it is stated as a falsifiable prediction about a user** and routed to a test rather than to a fix.

**What I would expect.** A fifth severity class — call it `SC`, craft — defined as *"a judgment with no rule behind it, stated as a prediction about user behaviour, that routes to a usability session rather than to a fix."* Three SC findings on one surface promotes to a design question for the next test round. Plus outcome columns on the design quality record. Patch `P5`.

---

### S5 — The rework machinery cannot represent "every rule is satisfied and the design is still wrong"

**Finding.** `CLAUDE.md:135-145` classifies every correction as Type A (surface: screen, flow, wording, layout — patch in place) or Type B (structural: rule, entity, status, permission, requirement — route to the reconciler first). Every Type B trigger is a *document* change.

There is no third class for a correct-by-every-rule design that does not work. Such a finding lands in Type A, gets patched in place, generates no rework-log row, and teaches the system nothing.

Contrast the discovery side, which has a genuinely clever early-convergence detector: `CLAUDE.md:147-149` — three or more Type B corrections traced to one Phase 1 topic means Phase 1 converged too early on that topic, and the recommendation is to reopen *that topic specifically*, not the phase. That is a well-designed learning loop.

Design has no analogue. Three failed screens on one flow produces three Type A patches and no signal. The system learns about its *discovery* quality across a project and learns nothing about its *design* quality.

Also in this class, and worth calling out on its own: **the prototype's interaction learning is discarded.** The throwaway-prototype containment logic is right (`hifi-spec/SKILL.md:181-182` names "prototype gravity" correctly). But the six Gate 1 questions (`gate-review/SKILL.md:66-71`) are all *domain* questions — as-is wrong, steps missing, entities wrong, edge cases, terminology, what is not shown. Not one asks whether anyone could operate it. The single most expensive artifact of Phase 2A is used to interrogate the domain and never the interface, then archived.

---

## 4. Two ordering defects that are structural, not cosmetic

These are severe enough to break a real project, so they sit above the general defect register.

### S6 — Accessibility is checked once, at the end, which its own skill names as the #1 failure mode

The lens schedule is consistent across five files (`design-critique/SKILL.md:18-21`, `STATE.template.md:64-66`, `gate-1.md:14`, `gate-2.md:22`, `design-qa.md:11-13`):

- Gate 1: lenses **1, 3, 6, 7**
- Gate 2: lenses **2, 6, 7**
- Gate 3: **all seven**

So **lens 4 (accessibility) and lens 5 (content) never run until pre-Gate 3** — the last internal checkpoint before the client sees it.

Meanwhile `accessibility/SKILL.md:206-208` names its own top failure mode:

> "**Audit-at-the-end.** Findings arrive when the tokens, the components and the flows are all settled, and half of them are unaffordable."

And every accessibility exit criterion in that file is labelled "(Gate 3)" (`:196`). And `GUARDRAILS.md:157` calls WCAG 2.2 AA a non-tradeable floor that overrides brand and schedule.

The process schedules exactly the failure its own skill warns against, for the one requirement it declares non-negotiable. A floor checked once, at the end, is a wish.

**Fix (cheap):** split lens 4 into a token-level check (contrast maths, focus ring, target sizes, status encoding greyscale) that runs at **Gate 2** against the design language, and a screen-level check that stays at Gate 3. Add content-terminology to Gate 2 as well, since the glossary already exists by then. Patch `P6`.

### S7 — Phase 2A is required to produce artifacts that cannot exist until Phase 2B

A genuine circular dependency at the centre of the design chain:

1. `CLAUDE.md:126` dependency order: `erd (statuses) + incumbents (density) -> style-guide -> skills-md -> {prompts, hifi}`
2. The ERD is a Phase **2B** artifact (`CLAUDE.md:106`, the 2B chain begins with data-modeler).
3. `style-guide-authoring/SKILL.md:92` requires "status encoding from the ERD's value lists" as a pre-aesthetic decision, and `:3` says "Use in **Phase 2A** alongside prompt work". `docs/SKILL-INDEX.md:32` files it under Phase 2A.
4. `templates/prompt-spec.md:30-32` — a Phase 2A artifact — requires the prototype prompt to cite **all twelve** skills-md files by name.
5. But `CLAUDE.md:116-118` explicitly forbids authoring them: *"ui-designer in 2A settles only the density decision and the status encoding sketch; a full visual system authored against an uncorrected entity model is half thrown away."*

So the 2A prompt must reference twelve files that 2A is forbidden to write, derived from an ERD that does not exist yet. The rationale in `CLAUDE.md:116-118` is *correct* — this is not a case of the reasoning being wrong. The artifact contracts were never updated to match it.

**Fix:** define a named "2A style seed" — five files (`tokens.md`, `type.md`, `layout.md`, `color.md` with the *tentative* status sketch, `a11y.md`) — make that the 2A deliverable, and amend `prompt-spec.md` and `prompt-authoring` to cite the seed rather than the twelve. Patch `P6`.

---

## 5. Defect register

Verified against the files. `Sev`: **1** = will break or mislead a real project · **2** = will cost time or produce a wrong artifact · **3** = hygiene.

| # | Sev | Defect | Evidence | Fix |
|---|---|---|---|---|
| D-01 | 1 | **`GUARDRAILS 10` does not exist.** `GUARDRAILS.md` runs 1–9, then `10a`, 11, 12. Eleven files cite section 10; all eleven mean section 12 (tentative artifacts stay rough / one question at a time / no em dashes). | `GUARDRAILS.md:9,45,56,64,74,83,92,101,108,134,150,180`; citations in `design-critique:19,187`, `information-architecture:216`, `userflows-sitemap:92`, `as-is-mapping:72`, `tentative-structure:110`, `throwaway-prototype:54`, `interview-facilitation:92`, `content-design:222`, `design-critic.md:32`, `flow-modeler.md:40` | Renumber `10a` → `10`; repoint the eleven to 12. `patches/P1` has the sed. |
| D-02 | 1 | **Gate 3 has two contradictory protocols.** `gate-review/SKILL.md:96` — "Gate 3 **does not re-run** the seven lenses". `gate-3.md:22` — "**Independent re-run** of critique lenses 3, 4 and 7". gate-reviewer loads both. | as cited; the guide (`03-phases.html:428`) sides with the command | Keep the independent re-run of 3/4/7; delete the sentence in the skill. |
| D-03 | 1 | **Three mutually inconsistent canonical screen-state lists.** `hifi-spec:41-43` demands 11 states (incl. `partial`, `success`). `templates/screen-spec.md:44-52` has rows for 9 (no `partial`, no `success`). `shared-specs/design-system.template.md:24-26` adds `many` and drops the error split. A designer cannot satisfy block 1 using the supplied template. | as cited | One list, in `hifi-spec`. Template and shared-spec derive from it. |
| D-04 | 1 | **"All four empty states" has nowhere to live.** `content-design:94-103` defines four (first use / no results / **cleared by the user** / **failed to load**). `hifi-spec:80` requires all four. `hifi-spec:41` and `screen-spec.md` enumerate two. `design-critique:54` audits four against a structure holding two. | as cited | Add the two missing rows everywhere. "Cleared by the user" is the one that distinguishes a good queue product. |
| D-05 | 1 | **`shared-specs/` real files do not exist and nothing creates them.** Only `*.template.md` ship. Every consumer references the un-suffixed name. `new-project.md:30-32` makes their absence an **escalation** on ready-to-code — which therefore fires on project one, every time. | `ls shared-specs/`; `md-spec-loop:23-25`, `style-guide-authoring:87`, `ui-designer.md:23`, `prompt-spec.md:32` | `/new-project` instantiates the three from templates on first run. |
| D-06 | 1 | **Nine routing variables, five documented, one contradictory.** `CLAUDE.md:53` "The five adaptation variables"; the config declares nine. `users_reachable` (`PROJECT_CONFIG:25`) and `domain_authority` (`CLAUDE.md:59`) claim the **same** routing effect with no precedence. `prioritization:24` gates method selection on `users_reachable`, which the orchestrator cannot route. | as cited | Promote all nine into CLAUDE.md §3; delete the duplicated routing from one of the two. |
| D-07 | 1 | **`[USER:role]` is an undeclared tag, and it deadlocks a supported configuration.** `GUARDRAILS.md:19-24` defines six tags; `[USER]` is not one. On `domain_authority: end-users` (a legal value), user testimony carries a tag the guardrail table cannot resolve, so nothing users say can be promoted past `(asserted)` — and nothing `(asserted)` may enter refined requirements (`GUARDRAILS.md:48-49`). | `USAGE.md:120` lists it; `interview-facilitation:77`; `discovery-lead.md:61` | Add `[USER:role]` to the tag table and state how it interacts with the confirmation ladder. |
| D-08 | 1 | **No template for the conformance snapshot** — the system's most-cited monitoring artifact. `process-evaluation:90-98` specifies its four parts; `gate-report.md:14` requires it as gate evidence; `GUARDRAILS.md:130-132` makes a stale one blocking. 16 templates ship, including one for a 13-line solution hypothesis. This is not among them. | as cited | `patches/templates/conformance-snapshot.md` |
| D-09 | 2 | **`templates/traceability-matrix.md` supports 1.5 of the 4 sweeps.** No diff/vanished-link register (sweep 1's actual instruction at `process-evaluation:52-54`), no staleness structure, and **no structure at all** for the provenance (4 finding classes, `:64-72`) or drift (5 comparisons, `:74-83`) sweeps. | as cited | Revised template in `patches/`. |
| D-10 | 2 | **STATE.md's freshness table omits six artifacts on the dependency path** the staleness sweep is told to walk: `as-is/`, `to-be/`, `glossary.md`, `assumptions.md`, `traceability.md`, and the hi-fi specs. | `STATE.template.md:31-42` vs `CLAUDE.md:120-131` | Add the rows. |
| D-11 | 2 | **CLAUDE.md §8's workspace map is stale.** Omits `60-requirements/traceability.md` and the entire `conformance/` directory — the two artifacts §7a is built on and `new-project.md:33-36` verifies. Also omits `10-discovery/anchor-analysis.md` and `60-requirements/prd-draft.md`. | `CLAUDE.md:210-227` | Sync the map. |
| D-12 | 2 | **Tentative 2A artifacts and validated 2B artifacts write to identical paths.** `tentative-structure:114` outputs `40-models/sitemap.md`, `to-be/{goal}.md`, `userflows/…`, `erd.md`. The rule is "superseded, not edited" (`userflows-sitemap:92`) — but superseding at an identical path is overwriting, and the Gate 1 evidence the DA corrected is destroyed. No naming convention is specified anywhere. | as cited | `40-models/_tentative/` or a `.TENTATIVE.md` suffix. |
| D-13 | 2 | **The 4+ ABSENT reclassification rule fires on almost every real spec, and collides with the scorecard.** `spec-intake:150` reclassifies to class D at 4 ABSENT. The checklist itself declares two dimensions ABSENT-by-default (`spec-audit-checklist.md:65,95`). Two more from dimensions 9–12 is routine. Meanwhile `:113` and `:115` prescribe different actions for overlapping inputs with no precedence. | as cited | Weight the dimensions, or exclude the ABSENT-by-default two from the count. |
| D-14 | 2 | **spec-intake records the class in a field that cannot hold it.** `:37-38` says record in `PROJECT_CONFIG > anchor_document`; classes A–D all map to `supplied` (`:42-45`). The correct field, `intake_class` (`PROJECT_CONFIG:28`), is never named by the skill. Consequence: D-13's reclassification changes nothing observable. | as cited | Point the skill at `intake_class`. |
| D-15 | 2 | **The problem-statement ID has three formats and one authoring source that mints none.** `contradiction-mining:63` defines five fields, no ID. `as-is-mapping:53,104` requires "the problem IDs" as a gate. `templates/problem-statement.md:5` says `PS-{n}`; `tentative-structure:38` says `P-07`. | as cited | Mint `PS-{n}` in contradiction-mining; use it everywhere. |
| D-16 | 2 | **`prompt-authoring` part 5 drops two skills-md files** (`motion.md`, `responsive.md`) that `style-guide-authoring:35-46` and `templates/prompt-spec.md:30-32` both list. Since `throwaway-prototype:48` leaves responsive rough by default, nothing catches the omission. | as cited | Sync the list, or cite the seed (S7 fix). |
| D-17 | 2 | **`accessibility` requires a testing rung nobody runs.** `accessibility:199` requires "rung 4 on each primary task"; the only invocation, `design-critique:61`, runs "rungs 1 to 3". | as cited | Put rung 4 in the pre-Gate-3 lens 4 procedure. |
| D-18 | 2 | **`research-plan` is a node in the dependency graph with no owner.** `CLAUDE.md:123` — `problem-statements + open-questions -> research-plan -> kb`. No skill outputs it; `incumbent-research:17` silently substitutes `open-questions.md`. | as cited | Delete the node or assign it. |
| D-19 | 2 | **The reconstruction interview does not fit its own timebox.** `reconstruction-interview.md:8` — "Ninety minutes is the working minimum." The six passes total 90 minutes, plus a closing at `:149` marked "10 minutes, **never cut**" = 100 minutes in a 90-minute minimum. | as cited | State 105–120, or shorten a pass. |
| D-20 | 2 | **The one timebox with a guardrail attached has no number.** `throwaway-prototype:18,60-61` and `GUARDRAILS.md:114` make exceeding the prototype timebox a stop signal and an escalation. No default, range, or rule-density-scaled anchor is given anywhere — while `reconstruction-interview.md` budgets to the minute and `incumbent-research:94-96` gives "30 minutes without progress". | as cited | Give a default (e.g. 1 day low rule-density / 2 days high) and let config override. |
| D-21 | 2 | **`style-guide-authoring` has two owning agents and no arbitration.** Listed in both `ui-designer.md:5` and `prompt-spec-writer.md:5`; `CLAUDE.md:82-83` splits the outputs but the single skill produces both. This is precisely the "split-brain values" failure the skill itself names at `:183`. | as cited | State precedence in the skill header: ui-designer owns content, prompt-spec-writer owns structure and length. |
| D-22 | 3 | **The declared skill anatomy is false for all 34 skills.** `SKILL-INDEX.md:4-5` claims eleven standard sections. Measured: `## Method` missing in **34/34**; `## Inputs` missing in **18/34**; `## Quality bar` missing in **14/34**; `## Probing prompts` missing in 7/34. `README.md:120` states a *different, weaker* contract, so the two index files also disagree. | as cited | Fix the index to describe what exists, or backfill. The weaker README contract is the true one. |
| D-23 | 3 | **`SKILL-INDEX.md:55` says hifi-spec produces "six blocks."** Every other file in the repo — skill (×3), agent (×2), `/gate-3`, handoff manifest, placeholder, and the PDF — says nine. SKILL-INDEX is the lone wrong file. | as cited | One-word fix. |
| D-24 | 3 | **Four `references/` directories are empty**: `design-critique`, `information-architecture`, `responsive-design`, `ux-flow-optimization` — the four largest skills, three of them at 246–268 lines against a stated ~300 cap. Either dead scaffolding or lost content. | `ls`; `SKILL-INDEX.md:78` | Move the perceptual-test bank, the tree-test protocol, and the friction-class table into them. |
| D-25 | 3 | **Five framework files ship as byte-identical duplicates with no sync rule.** `config/STATE.template.md` == `workspace/_TEMPLATE/STATE.md`; same for PROJECT_CONFIG, traceability-matrix, prd-placeholder, assumption-register. A framework built on "one source of truth" has five of its own files in two copies. | `diff` | Symlink, or delete `config/` and point at the template. |
| D-26 | 3 | **Garbled output path in the conformance engine.** `process-evaluation:87-88` — "filed at `90-handoff/../STATE-adjacent` as `{workspace}/conformance/{date}-snapshot.md`". Two mutually exclusive locations, one of which is not a path. | as cited | Keep the second. |
| D-27 | 3 | **`as-is-mapping`'s quality bar can never pass.** `:105` requires "all ten fields" per step; the capture table's first row is **Trigger** — "what starts the process" — which is per-flow. Steps have nine. | as cited | Nine. |
| D-28 | 3 | **Misattributed citations.** `information-architecture:83` and `userflows-sitemap:91` cite "GUARDRAILS 1" for "the glossary is the source"; GUARDRAILS 1 is provenance tagging and says nothing about definitions. | as cited | Repoint or drop. |
| D-29 | 3 | **Section 11 (the design floor) is cited by number zero times.** Eight files say "GUARDRAILS 11" because it has no addressable handle in practice. The one guardrail declared non-negotiable is the only one that is not violation-checkable — which is the exact test `style-guide-authoring:12` applies to everything else. | `grep` | Cite `GUARDRAILS 11` everywhere. |
| D-30 | 3 | **The shipped PDF's text layer is polluted.** `build.py:229` re-renders pass 2 with probe markers still on; extracting text from `AIDD-Guide.pdf` returns 47 `PGnn` markers. Search, copy-paste and screen readers all get them — in a document whose Part 2 §2.9 is the accessibility floor. Also: hard-coded macOS Chrome path (`:12`, no fallback, dies with an unhelpful error on Linux), dead variable (`:175`), fragile two-digit probe regex (`:159`), anchor/label off-by-one (`:36-44`), and the TOC repeats the "five variables" error (`:33`). | as cited | `render(assemble(pages, False), pass2)`; `shutil.which` fallback. |
| D-31 | 3 | HTML entity leaking into markdown: `README.md:15` renders "Developer &amp; Designer Guide". | as cited | `&` |
| D-32 | 3 | `USAGE.md:183` lists "onboarding" as a file in `docs/`. No such file exists. | as cited | Remove or write it. |
| D-33 | 3 | **The house style bans em dashes** (`GUARDRAILS.md:182`) and one survives, in `content-design/SKILL.md`. Trivial, but it is the file about writing. | `grep` | — |

---

## 6. Craft-level critique of the design layer

The five structural findings are about what the process omits. This section is about the quality of what it contains — judged as a design system, not as a process document.

### 6.1 The worked scales are hand-tuned and presented as derived

`visual-design/SKILL.md:79` states the rule hard: *"One modular scale, six to eight steps. **No sizes between steps.**"* Then `references/type-scale.md` ships two worked scales that are not generated by their stated ratios:

- **Dense scale, "ratio 1.125"**: 13 → 15 ✓ (14.6), but then 18 (1.125 gives 16.9), 22 (gives 20.25), 28 (gives 24.75). The three largest steps are hand-set.
- **Compact scale, "ratio 1.2"**: 14 → 16.8→16 ✓, 20 ✓, 24 ✓, then **30** (1.2 gives 28.8), and downward 12 where 1.2 gives 11.67 and 11 where it gives 10.

The file half-acknowledges this — *"Application products use two ratios in practice: a tight one for the UI range and a wider one above it"* — but never states the second ratio or which steps it governs. So the reader is told "no values off the scale, ever" and handed a scale that is off itself.

Same pattern in the line-height table: the rule says small text (11–12px) sits at 1.35–1.45, and the compact worked scale ships `sm 12/18` = **1.5**. And the dense scale ships `sm 12/16` = **1.33**, below its own floor.

This is not pedantry. The whole argument of `style-guide-authoring` is *"could a reviewer point at a build and cite the rule?"* If the reference tables do not validate against the rules in the same repo, the first reviewer who checks stops trusting the tables — and the tables are the good part.

**Fix:** either publish the two ratios and their crossover step and regenerate the tables, or relabel the tables honestly as *"a hand-tuned scale, verified against these constraints"* and give the constraints. The second is more truthful and just as usable.

### 6.2 The contrast layer treats WCAG 2.x numbers as ground truth

`color-system.md` gives the relative-luminance maths and the AA thresholds correctly, and the verification procedure (compute every text role against every surface role it can legally appear on; re-verify for dark mode; desaturate; simulate deuteranopia) is better than most teams manage.

What is missing is that **the WCAG 2.x contrast formula is known to be perceptually inaccurate**, particularly for dark backgrounds and for light thin text — precisely the two cases this system's products hit (dark mode is specified in detail; dense mode drives type down to 11–13px). A pairing at 4.6:1 on a dark surface can be materially less legible than a 4.6:1 pairing on light, and the formula does not see it. The file's own instinct is right at `type-scale.md`: *"hairline weights fail contrast in practice even when they pass on paper, because contrast ratios are computed on colour and not on stroke."* That observation is stranded — it never becomes a rule.

**Fix:** name APCA (the WCAG 3 / Silver contrast method) as a secondary check for dark mode and for any text under 14px, keep WCAG 2.2 AA as the compliance floor since that is what procurement audits against, and turn the stroke observation into a rule: *no body text below weight 400, and any text under 14px in dark mode carries a second check.*

Also absent: no mention of P3/wide-gamut displays (a brand colour authored in P3 and verified in sRGB will not match what ships), and no mention of the sub-pixel/anti-aliasing difference between light-on-dark and dark-on-light, which is why the same pairing needs different treatment in the two themes.

### 6.3 The system specifies structure exceptionally and never specifies feel

Read `motion-tokens.md` and `interaction-design` end to end and you have a complete, correct, implementable specification of *behaviour*. Durations, easings, what may animate, choreography, reduced-motion mapping, feedback thresholds, optimistic/pending/confirmed, keyboard contracts, concurrency. It is excellent.

Now look for anything that tells you whether the result is **good**. There is nothing. `ease-emphasized` is described as "large, important transitions that should feel considered" — the only sentence in the design layer that reaches for a quality, and it does so with an adjective the same repo bans everywhere else.

That is the tell. The system has correctly identified that adjectives are unenforceable and has removed them. But the thing adjectives were badly gesturing at is real, and the professional answer is not "delete the adjective" — it is *"replace the adjective with a reference implementation."* A style guide that says "considered" is useless. A style guide that says "considered means this: [a 15-frame reference clip / a live example / this named product's dialog transition]" is enforceable and carries the quality the adjective was reaching for.

There is no reference-implementation mechanism anywhere in this repo. No exemplar screens, no benchmark set, no "this is the bar" artifact. `incumbent-research` is close — it studies competitors for *domain* extraction ("extraction, not admiration", `:22`) and explicitly refuses to look at them for craft. That refusal is correct in Phase 2A and wrong as a permanent policy.

**Fix:** a `shared-specs/exemplars.md` — five to eight reference implementations, per surface type, with a line each on what specifically is exemplary. It costs an afternoon, it is the cheapest quality lever available, and it plugs directly into the existing `md-spec-loop`.

### 6.4 Density is treated as a single global decision

`visual-design`'s density table (Comfortable / Compact / Dense) is good and the domain-first reasoning is right: *"Rule-dense work where a mistake is expensive: compact, not dense. The extra space buys legibility at the moment of a consequential decision."* That is a real insight.

But density is set once, per surface at best (`:120` — "pick per surface, not per product"), and never modulated **within** a screen by consequence. The system already has the vocabulary for this — `ux-flow-optimization`'s friction budget is sized to consequence, and `interaction-design` correctly says frequency inverts the ceremony budget. Density should obey the same law: the row of a 400-row triage table can be 32px tall while the confirmation step that commits an irreversible transition gets comfortable spacing on the same screen. Nothing in the repo says this, and the "one density per surface" rule as written forbids it.

### 6.5 No first-run, migration, or maturity design

`information-architecture:79` correctly flags buried month-end and correction paths as "the most common IA failure in rule-dense products." Good catch. But nothing in the system covers:

- **Data migration from the incumbent.** `domain-researcher` is required to give the deepest teardown to the product the client is migrating *from* (`domain-researcher.md:32-35`) and correctly notes every divergence is a retraining cost. The retraining is never designed. There is no migration state, no dual-running period, no "where did my thing go" affordance.
- **First 90 days.** The empty state is covered as one copy state. An operations product on day one has no history, no saved filters, no exceptions yet, and a workforce that has never seen it. That is a different product from the same product in month six, and it is the version everybody judges.
- **Maturity.** The dense table with 800 rows is specified (`dummy-content` handles the boundary content well). The dense table with 4 rows, in week two, looks broken, and nothing says so.

### 6.6 Smaller substantive gaps

- **No performance dimension.** `ux-flow-optimization:174-187` specifies wait *design* by tier beautifully. Nothing anywhere sets a latency target, and `EngineeringSpec.template.md` has no latency row. You can design the 1–10s treatment perfectly and never commit to which operations should be under 1s.
- **Single-evaluator heuristic evaluation, presented as a protocol.** `incumbent-research:57-62` runs Nielsen's heuristics with Nielsen's 0–4 severity scale, unattributed, and stripped of the part that makes it work: independent evaluators. The method assumes 3–5 raters precisely because one rater's severity ratings are noise. Either state a rater count or stop calling it a rating.
- **"Two independent B sources agree" has no independence test** (`incumbent-research:78`). Two engineering blogs paraphrasing one vendor changelog are not independent, and that is exactly how a C-grade marketing claim launders to B-grade agreement — the failure mode the file names at `:149`.
- **The prototype session has no protocol.** `throwaway-prototype:68` — "complete the job on this build in front of me" — is a moderated think-aloud, and it is the entire protocol. No task list, no no-help rule, no observer/notetaker split, no way to distinguish "the DA misread the screen" from "the domain forbids this." `facilitation-technique.md:45-66` has a full observation protocol; the skill that most needs it never points at it.
- **Discovery has no saturation or sampling rule.** `incumbent-research` has hard stop conditions (`:94-97`); interviews have none. No role × site coverage matrix, no recency criterion outside the user path, no saturation test ("two consecutive sessions produce no new entities, no new exceptions, no new terms").
- **Nothing in discovery measures anything.** Every as-is number comes from recall (`as-is-mapping:37` — "duration *if known*"). On a class-E (existing product) engagement the team has a login to the running system, and the audit protocol reads screens, filters and empty states — and never once mentions the data behind them. One query against status-transition timestamps would falsify or confirm most of the pain index in an hour. The pain index is then declared "the baseline the to-be must beat" while summing incommensurable units (systems touched + error rows + minutes of wait) with no weighting.
- **RTL/bidi and time boundaries are missing from an otherwise excellent adversarial content pass.** `dummy-content:41-58` is one of the strongest sections in the repo. It has "text in a second script" — a font-coverage test, not a direction test. Missing: mirrored layout, LTR identifiers inside RTL sentences, neutral-character ordering, timezone/DST boundaries, fiscal-year offset, and identifiers that get numerically coerced (leading zeros). Also `:57-58`'s "roughly 35 percent longer" is the *long-string* figure; short UI labels commonly expand 100–200%, which is precisely where the rule is aimed.
- **Transcripts are unmanaged personal data.** `GUARDRAILS.md:98-99` bans real personal data in mockups and `dummy-content:94` enforces it hard. Meanwhile `10-discovery/transcripts/` stores named employees, recordings, and candid statements — with attribution mandated as a discipline (`facilitation-technique.md:95` — "single-column capture is attribution collapse"), a protocol that explicitly designs for job-loss anxiety (`:78`), and **no retention period, no redaction step, no deletion trigger at handoff, and no statement of who may read them.** Attribution-by-default plus client-readable transcripts plus job-security fear is a known way to lose your best informant in week two. The framework is scrupulous about PII downstream and silent about it at source.

---

## 7. Operability

A note on adoption, because it affects whether any of the above matters.

The skill layer is **5,801 lines** across 34 files, plus 14 agent files, plus a 245-line orchestrator, plus 185 lines of guardrails, plus 932 lines of templates. There is a `minimum_set` flag (`CLAUDE.md:64-67`) and it reduces the *artifact* set, not the *instruction* set — every skill still applies when invoked.

Three consequences:

1. **No graduated path.** A designer's first project runs the whole machine or nothing. There is no "AIDD Lite" — the six mechanisms that carry 80% of the value (provenance tags, the contradiction rule, the ERD consequences note, Type A/B routing, the quiet-gate rule, the state enumeration table) are not separable from the other twenty-eight.
2. **Context cost.** In a Claude Code session, loading GUARDRAILS + orchestrator + agent + two or three skills with references is a substantial fraction of the window before any project content is read. The 150-line discipline for `skills-md` files shows you understand this problem for *generators*; it is not applied to the skills themselves, where four files run 246–268 lines with empty `references/` directories sitting next to them (D-24).
3. **The three loop metrics do not include time.** `md-spec-loop:51-60` measures Type B count, clarification requests, and code reuse. A process this heavy needs to demonstrate that its front-loading pays back in *elapsed time to a correct build*, and that number is not collected. Without it, the argument for the process rests on the same anecdote it correctly refuses to accept from anyone else.

---

## 8. Recommended sequence

Ordered by value per unit of effort. The first tier is a day; the second is the one that changes what you ship.

### Tier 0 — half a day, pure hygiene, do it first

Fixes D-01, D-02, D-23, D-26, D-27, D-28, D-29, D-31, D-32, D-33 and the `build.py` probe leak. All mechanical. `patches/P1` has the sed script. Do this before anything else because every later change lands on top of it.

### Tier 1 — one day, closes the defects that will break a project

D-03/D-04 (one canonical state list), D-05 (instantiate shared-specs), D-06 (nine variables in CLAUDE.md §3), D-07 (`[USER:role]`), D-08 (conformance snapshot template), D-12 (tentative path collision), D-14 (`intake_class`), D-21 (style-guide ownership precedence). Patches supplied for D-05, D-07, D-08.

### Tier 2 — the ordering fixes, half a day

S6 (split lens 4 across Gate 2 and Gate 3) and S7 (define the 2A style seed; amend `prompt-spec.md` and `prompt-authoring`). Patch `P6`. These are small edits with large consequences: S6 alone moves your non-negotiable floor from "checked once at the end" to "checked when it is still affordable."

### Tier 3 — the quality layer. This is the work.

In this order, because each makes the next one cheaper:

1. **`usability-testing` skill + Gate 3 attendance change.** (Patch `P2`.) Five moderated sessions on the hi-fi set before Gate 3; findings mapped into the existing S1–S4 / Type A–B machinery; task success and time-on-task recorded. Change Gate 3 from "internal only" to "internal, with the usability report filed as a pre-check." This single change is worth more than everything else in this report.
2. **`concept-exploration` skill.** (Patch `P3`.) Three low-fidelity compositions for each *primary* screen, judged against the cost table and the hierarchy method, rejected two filed with one line of why. Inserted between the state enumeration table and block 1 of `hifi-spec`.
3. **The outcome layer.** (Patch `P4`.) Outcome row on the requirement entry; outcome column on the traceability matrix; `measurement-plan.md` produced at Gate 2 and carried in the handoff manifest; a fourth loop metric that is about the product.
4. **The craft severity class + design quality record.** (Patch `P5`.) `SC` findings: a judgment with no rule behind it, stated as a falsifiable prediction about user behaviour, routed to the next usability round rather than to a fix. Three SC on one surface promotes to a design question. Replaces the current "record and drop."
5. **`shared-specs/exemplars.md`.** Five to eight reference implementations with one line each on what is exemplary. An afternoon. Reviewed in the `md-spec-loop` like everything else.

### Tier 4 — the craft gaps, opportunistic

§6.1 (honest scale tables), §6.2 (APCA secondary check for dark mode and sub-14px), §6.4 (density modulated by consequence), §6.5 (first-run and migration design), plus the smaller items in §6.6. Take these as they come up on real projects rather than as a batch.

---

## 9. The one-sentence version

You have built an unusually rigorous machine for guaranteeing that a design is **correct, complete, consistent, traceable, and defensible** — and every quality signal it collects answers either *"does artifact A agree with artifact B"* or *"did step X run."* Add a user, a second option, and an outcome, and it becomes a machine for producing good products rather than good documentation.

---

*Patches referenced above are in `patches/`. Start with `patches/00-APPLY.md`.*
