# Gate {n} Report: {project}

> **What this is.** The record of a review session: who was there, what we showed, what you corrected, and what happens to each correction.
>
> **Where it stands.** Filed the same day as the session.
>
> **What we need from you.** Nothing - this is the record. Anything needing you appears in the corrections table with your name.

Held: {date} · Attendees: {names+roles} · Attendance requirement met: y/n
Result: PASSED / PASSED-PENDING-WRITTEN / NOT HELD / FAILED
Written sign-off: {who, date, where filed}

A gate held without its required attendees is recorded as NOT HELD, whatever else happened in
the room. No authority overrides this (GUARDRAILS 5).

## Readiness pre-checks (run before scheduling)
| Check | Result | Evidence |
|---|---|---|
| Pre-gate critique run, zero open S1 (or S1s declared) | | 80-gates/pre-gate-{n}-critique.md |
| Conformance snapshot current, no unresolved BLOCKING | | conformance/{date}-snapshot.md |
| Assumption register summary prepared for reading aloud | | 00-inputs/assumptions.md |
| KB health audit (Gates 1 and 2) | | |
| Gate-specific pre-checks from the command file | | |

A failed pre-check delays the gate. Holding a gate on unready artifacts converts expensive
attendee time into a list of things the team already knew.

## Disclosures made in the room, before review
| Disclosed | Detail |
|---|---|
| Open assumptions relevant to what is under review | ASM-IDs read aloud |
| Unresolved contradictions | numbers and owners |
| Open S1 findings, if any | |
| Unsigned artifacts, if any | |

Acceptance is only informed acceptance if these were stated first.

## Exit criteria checklist
Copied from the gate command file, each ticked with evidence.

## Corrections
| # | Correction (tagged) | Type A/B | Severity | Owner | Routed to | Rework-log row |
|---|---|---|---|---|---|---|
| *1* | *"an invoice over 50,000 needs two approvers, not one" `[DA]`* | *B (a rule change)* | *S1* | *requirements-reconciler* | *REQ-INV-4* | *2026-03-14* |

Classification happens in the room, not later from memory; late classification drifts toward
Type A because patching is easier than reconciling. When unsure, it is Type B.

## Quiet-review handling (Gate 1 especially)
Correction volume low? y/n

Heavy correction is SUCCESS. Little correction is a WARNING, not a pass: either the set was too
safe to test anything or the reviewer is being polite. Probes run and reviewer responses,
verbatim-ish:

- "Complete the job on this build in front of me; narrate where it lies."
- "Run month-end on this flow: where does it jam?"
- "What does this let you do that reality forbids?"

## Gate 1 only: the six questions
| # | Question | Response summary (tagged) |
|---|---|---|
| 1 | Where is the as-is process factually wrong or incomplete? | |
| 2 | Which steps are missing? | |
| 3 | Which entities or relationships are wrong? | |
| 4 | Which edge cases would break this? | |
| 5 | Which terminology is wrong for this domain? | |
| 6 | What must be true that is not shown here? | |

Tentative-set open-questions boxes ruled on: y/n (the team asked for specific rulings; get them)
Prototype archived to 50-prototype/ARCHIVED/ (unless demo engagement): y/n, STATE row written.

## Gate 2 only: model-first review record
| Artifact, in review order | Reviewed | Developer present for it | Objections (Type) |
|---|---|---|---|
| Refined requirements | | | |
| ERD (+ consequences note) | | | |
| Process breakdown | | | |
| To-be pairs (with pain-index deltas) | | | |
| Userflows, sitemap, IA | | | |

Developer acceptance of the ERD recorded: y/n · Breakdown read by the developer: y/n
Prioritized list signed by PO and DA in writing: y/n · fixed-bid LOCK stated in the room: y/n

## Gate 3 only: reconciliation re-run
Status-mapping vs ERD, run independently of hifi-spec's self-check: clean / mismatches listed
with owners. This is the most common Gate 3 defect.

Line-by-line requirement check: each in-list feature's spec against its REQ-IDs.

## Post-gate verification (complete within the week)
| Check | Date | Result |
|---|---|---|
| Every routed Type B produced its reconciler entry, version bump and stale marks | | |
| Every Type A patched or scheduled with an owner | | |
| STATE.md updated: gate record, rework log, freshness, conformance record | | |

Corrections that evaporate teach everyone that gates are theatre. This check is what makes them
cumulative.

## Notes
Anything that changes STATE (blockers, risks, stale marks) with the STATE row written.

---

**Key.**
**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**S1** blocker - **S2** major, harms the task - **S3** minor - **SC** a craft judgment stated as a prediction, which goes to the next user session rather than to a fix - **S4** a preference, recorded and dropped.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
