---
name: md-spec-loop
description: "Runs the cross-project loop at close: adjudicates every divergence with a developer, updates shared-specs, and records the four loop metrics. Use before close, never solo."
---

# The md-spec Loop

## Purpose
The only step in the whole flow that pays out on the NEXT project rather than this one: files
written at one close are consumed by the next project's prompts (prompt-authoring part 5), so
generated prototypes match real team conventions and developers can re-use the front end
rather than reference it. Because the payoff is deferred, this is the easiest step to skip and
the most expensive to have skipped. A stale file is worse than none: it produces confidently
non-conforming output that looks reviewable and is not.

This loop is also where the process itself is evaluated: the three metrics recorded here are
the only cross-project evidence of whether the whole system is getting better or just longer.

## The three files (shared-specs/, repo root, cross-project)

| File | Owner | Contents |
|---|---|---|
| design-system.md | Design + Dev jointly | tokens, components, spacing, states, naming |
| EngineeringSpec.md | Dev | architecture constraints, framework, state management, API conventions, generation constraints |
| CodeReadability.md | Dev | naming, file structure, comments, formatting |

## Close-review procedure (with a developer, mandatory)

1. **Gather the evidence first**: this project's style-guide.md and skills-md deltas (each
   carries its one-line reason, recorded at divergence time by visual-design and
   component-architecture), the dev team's actual built conventions (read the real code, not
   the intentions), and the build-time question log from handoff.
2. **Diff intent versus built**, file by file. Three outcomes per finding:
   - Project diverged deliberately (recorded reason exists) -> decide: adopt into the shared
     file, or keep as project-local and say why. The adopt-versus-local test: would the rule
     hold on a different client with a different brand? Yes -> shared. No -> project-local,
     referenced from the project's style guide only.
   - Project diverged silently -> adopt or revert, but record either way; silent forks are
     the decay mechanism.
   - Shared file asserted something nobody followed -> delete it; aspirational rules rot
     trust in the whole file. Deleting is the hardest and most valuable outcome; a file that
     only ever grows becomes a file nobody reads.
3. **Interrogate the build-time question log**: every question the dev team asked that the
   artifact set should have answered is a candidate rule for one of the three files ("which
   rule would have prevented this question?").
4. **Update, date, and version each file**; one-line change log per file, per finding.
5. **Record the loop metrics** (below) in the STATE.md loop-review row.
6. **Record the review** in STATE.md (date, attendees, files touched). Project close is
   blocked until this row exists.

## The three loop metrics

Recorded per project, compared across projects; all three should fall as the shared files
mature. They are the process's own scoreboard, and they are cheap: each is a count.

| Metric | Source | What a rise means |
|---|---|---|
| Requirements changed after Gate 2 (Type B count post-G2) | STATE.md rework-log | Discovery or reconciliation is converging too early |
| Build-time clarification requests | Handoff question log + dev team tally | The breakdown/spec layer is under-specifying; find the cluster |
| Share of generated front end re-used rather than rewritten | Dev estimate, honest | The shared-specs files or the prompts are drifting from real conventions |

A metric nobody records is a loop nobody runs; the numbers are the difference between "we
think the process works" and evidence.

## Freshness contract

The next project's prompt-authoring checks the dates; files older than one project without a
review trigger escalation before consumption (GUARDRAILS 9.8). The loop-review row is what
makes the dates trustworthy.

## Deciding factors
- The developer's presence is not ceremonial: EngineeringSpec and CodeReadability claims that
  no developer endorses are aspirations, and aspirations rot the file. Never run this solo.
- Where design and dev disagree on an adoption (a token the devs overrode for performance),
  the disagreement is recorded with both positions; the shared file carries what is actually
  true, plus the open question if it stays contested.
- Multiple concurrent projects: the last project to close runs the loop; mid-flight projects
  consuming half-updated files are told (a one-line note in the shared file's header:
  "review in progress, {date}").

## Probing prompts (for the close session)
- "Which generated component did the devs rewrite anyway, and which rule would have
  prevented it?"
- "Which rule in these files did nobody follow this project? Delete or enforce, pick."
- "What did this project decide that the next project will otherwise re-decide?"
- "Which build-time question cluster maps to a missing rule?"
- "If the next project's prototype obeyed these files perfectly, what would still look wrong
  to you?"

## Quality bar (self-evaluation)
- Every divergence adjudicated with one of the three outcomes and a recorded reason; zero
  silently-surviving forks.
- At least one deletion considered honestly (a review that never deletes is accumulating
  aspirations).
- All three metrics recorded with sources.
- Files dated, versioned, change-logged; loop-review row written.

## Metric 4: outcome movement

From the post-launch review in `measurement-plan.md`: per outcome, where the number started, where
it was meant to get to, where it actually got to, and whether the number that must not move did.

The first three metrics measure whether the system is getting cheaper to run: falling rework,
falling clarification requests, rising code reuse. All three can improve while the products get
worse, and a loop recording only those three has optimised itself and left the product unmeasured.
This is the one that is about the product.

It arrives late, months after close, and it arrives for the previous project rather than this one.
Record it against the project it belongs to and read it at the next loop review. A metric that is
inconvenient to collect is not the same as a metric that does not matter.

## Guardrails
- Never updated solo: the developer's presence is what makes EngineeringSpec and
  CodeReadability true rather than aspirational.
- ready-to-code engagements: the updated set is a mandatory handoff item; absence blocks
  close.
- Client-specific content never enters shared-specs; the files are cross-client by
  definition, and a client token or term in them is a confidentiality and correctness
  defect at once.

## Output
- Updated, dated shared-specs/ files with change logs
- STATE.md loop-review row with metrics

## Exit criteria
- All three files reviewed-or-consciously-unchanged, dated; metrics recorded; row recorded;
  close unblocked

## Failure modes
- Skipped at close: the next project's prompts consume stale rules and every generation
  needs manual conformance rework.
- Aspirational drift: rules nobody follows accumulate until the files stop being read.
- Metric amnesia: the loop runs but records nothing, so nobody can say whether the system
  is improving, and the argument for the front-loaded process rests on anecdote.
- Solo review: a designer updates EngineeringSpec alone, and the file now describes a
  codebase that does not exist.
