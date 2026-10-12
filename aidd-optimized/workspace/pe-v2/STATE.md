# STATE - pe-v2

The live process tracker. The orchestrator reads this at session start and every agent
updates it when an artifact changes. Keep entries one line each; this is a ledger, not a
journal.

## Position

```yaml
phase: "2A"           # 0 precondition | 1 | 2A | 2B | 3 | handoff | closed
next_gate: "gate-1"         # gate-1 | gate-2 | gate-3 | client-validation | none
blockers: []          # short strings; empty means clear to proceed. Contradictions below are recorded, not blockers (user instruction 2026-10-09)
intake_class: "B"     # partial spec, set by spec-intake 2026-10-09; see 00-inputs/spec-intake.md
```

## Gate record

| Gate | Held on | Attendees | Result | Report |
|---|---|---|---|---|
| Problem confirmation (P1 exit) | 2026-10-09 (written checkpoint; D&D call not held by user instruction) | requesting user (SME/acting PO), written in-session | CONFIRMED as written, PS-1..PS-10 kept | 10-discovery/problem-statements.md |
| Gate 1 | | | | 80-gates/gate-1-report.md |
| Gate 2 | | | | 80-gates/gate-2-report.md |
| Gate 3 | | | | 80-gates/gate-3-report.md |
| Client validation | | | | 90-handoff/walkthrough-notes.md |

## Artifact freshness

Mark STALE when a dependency changed after last edit (dependency order: CLAUDE.md section 5).

| Artifact | Last edited | Status |
|---|---|---|
| 00-inputs/PRD.md | 2026-10-09 | current (spec-intake) |
| problem-statements.md | 2026-10-09 | current (10 PS, all asserted; unsigned) |
| kb-index.md | 2026-10-09 | current (lite KB: index + 2 client notes, flow cards FL-01..11 and reference tables; authority/ thin; N-1..N-5 count marks routed to discovery-lead; upgrade candidate U-1 for PS-1..10) |
| refined-requirements.md | | |
| erd.md | | |
| process-breakdown.md | | |
| flow-optimization/ | | |
| ia.md | | |
| userflows/ + sitemap.md | | |
| style-guide.md + skills-md/ | 2026-10-09 | current (2A SEED, 5 files: skills-md/tokens, type, layout, color, a11y; PROVISIONAL shadcn/ui + PRD starter p.241, replace-not-merge when the user's design-language repo arrives; status sketch TENTATIVE, 7 families; style-guide.md not written in 2A; OQ-25..27 added; awaiting human edit) |
| prioritized-features.md | | |
| status-mapping.md | | |
| as-is/ | 2026-10-09 | current (TENTATIVE; as-is absent, 11 reference flows from the PRD per ASM-ASIS-2; no pain index) |
| to-be/ | | |
| glossary.md | 2026-10-09 | current (29 rule-bearing, none confirmed) |
| 10-discovery/anchor-analysis.md | 2026-10-09 | current (per-module scope, 83 buildable entries) |
| 00-inputs/assumptions.md | 2026-10-09 | current (19 open; ASM-ASIS-2 added by flow-modeler) |
| 60-requirements/traceability.md | | |
| 70-hifi/ (all feature specs) | | |
| 40-models/_tentative/erd-sketch.md | 2026-10-09 | current (TENTATIVE; 44 entity rows, 43 status lists, never overwritten) |
| 40-models/_tentative/status-encoding-input.md | 2026-10-09 | current (TENTATIVE; 7 families, 40 meanings) |
| 30-design-language/prompts/prototype-FL-09.md | 2026-10-09 | current (v1, six parts + carry checklist; readings OQ-28..33 in open-questions.md; accepted by prototype-engineer 2026-10-09, copied to 50-prototype/prompt-used.md) |
| 50-prototype/ (app + prompt-used.md + build-notes.md) | 2026-10-09 | current (throwaway FL-09 build, awaiting Gate 1; archive to 50-prototype/ARCHIVED/ after the gate) |

Two staleness paths that are easy to miss: a change to the ERD's status list stales the status
encoding map, every component state matrix that displays it, and every hi-fi screen state derived
from it. A change to ia.md stales every userflow, the sitemap and the route scheme.

## Assumption register summary

Source: `00-inputs/assumptions.md`. Read aloud at every gate. A register that has not shrunk
between two consecutive gates is escalated (GUARDRAILS 9.13).

| Gate | Open | Confirmed | Refuted | Blocking (rule/status/permission/lifecycle) |
|---|---|---|---|---|
| Intake (2026-10-09) | 18 | 0 | 0 | 5 (ROLE-1, PERM-1, EXC-1, OQ-1, EXT-1) |
| Gate 1 | | | | |
| Gate 2 | | | | |
| Gate 3 | | | | |
| Handoff | | | | |

## Design quality record

Lenses: 1 hierarchy - 2 consistency - 3 state completeness - 4a accessibility (tokens, at Gate 2)
- 4b accessibility (screens, at Gate 3) - 5a terminology (at Gate 2) - 5b copy (at Gate 3)
- 6 flow friction - 7 domain fidelity.

| Gate | Critique run | Lenses | Open S1 | Ladder rungs run (of 4) | Exceptions recorded |
|---|---|---|---|---|---|
| Gate 1 | 2026-10-11 (80-gates/pre-gate-1-critique.md; 32 findings: 1 S1, 13 S2, 15 S3, 3 SC) | 1, 3, 6, 7 | 1 (F-01 pack-station keyboard trap, found outside the lens set; declare at gate) | 0 (lens 4 not in the Gate 1 set) | none |
| Gate 2 | | 2, 4a, 5a, 6, 7 | | | |
| Gate 3 | | all seven | | 1-4 | |

### Concepts

| Feature | Screens in scope | Concepts filed | Winner recorded with its criterion | Merges (must be zero) |
|---|---|---|---|---|
| *invoice-approval* | *2* | *6* | *yes* | *0* |

### Usability rounds

| Round | Date | Roles | Participants | Tasks | Unaided success | Completed wrong | DA stood in? |
|---|---|---|---|---|---|---|---|
| *1* | *2026-04-02* | *clerk, approver* | *10* | *4* | *31 of 40* | *2* | *no* |

**Completed wrong** is the column to read first: a participant who believes they succeeded and did
not is a defect that reaches production, gets repeated daily, and is found by an audit.

### Predicted versus observed

The cost tables made a claim. This is where it is checked. A prediction that was wrong is worth
more than one that was right, because it is the only way the estimate improves.

| Flow | Predicted (decisions / inputs / waits / navigations / recalls) | Observed | Note |
|---|---|---|---|
| *raise a variance* | *4 / 6 / 1 / 3 / 0* | *4 / 9 / 1 / 5 / 2* | *supplier code is not to hand; we assumed it was* |

### Craft register

| Open SC | Confirmed by a round | Contradicted by a round | Surfaces at 3+ SC (back to concepts) |
|---|---|---|---|

## Outcome record

Source: `60-requirements/measurement-plan.md`. Signed at Gate 2, read at the date below.

| Outcome | The number | Where it is today | Target (by) | Built into | Owner | Read at | Actual |
|---|---|---|---|---|---|---|---|
| *OUT-1 variances resolved same day* | *share resolved within 24h* | *31%* | *80% by Sept* | *invoice-approval* | *Priya* | *2026-12-01* | |

## Conformance record

Source: `conformance/{date}-snapshot.md`, produced by process-evaluation on its cadence
(CLAUDE.md 7a: phase end, pre-gate, post-Type-B, weekly in 2B/3). A snapshot older than its
cadence is itself a finding.

| Date | Trigger | Headline | Orphans | Ghosts | Stale | Blocking | Snapshot |
|---|---|---|---|---|---|---|---|
| 2026-10-09 | Phase 1 end | No blocking; 21 major (refined-requirements not yet created - expected; rest are legend/table lines read as untagged claims) | 0 | 0 | 0 | 0 (3 model-inference leaks fixed -> 10-discovery/open-questions.md, OQ-1..10) | conformance/2026-10-09-snapshot.md |

## Rework log (Type B only)

| Date | Correction | Source | Phase 1 topic it traces to | Artifacts regenerated |
|---|---|---|---|---|

## Prototype (Phase 2A)

| Field | Value |
|---|---|
| Target process | ALL flows FL-01..FL-11, all 83 buildable screens (user decision 2026-10-11); FL-09 built first |
| Timebox | FL-09: 1 day (met). Full scope: build per wave, foundation, then 6 module groups in parallel, then integration |
| Stack | React + shadcn/ui; styling provisional, token-driven, pending the user's prototype repo |
| Archive rule | DISABLED by user decision (prototype is kept, demo-equivalent) |
| Status | FL-09 built (7/84). Full build in progress |

## Engagement mode

aidd_mode: lite, minimum_set: true. Purpose: estimation. User instruction (2026-10-09): no further
questions; where PRD parts do not interconnect, leave them as-is and build per the PRD. Lite-mode
drops (CLAUDE.md 3a) are not gaps.

## Risks

| ID | Risk | Raised | Status |
|---|---|---|---|
| R-SME-SUB | SME standing in for end users on a user-facing product (users_reachable=false) | 2026-10-09 | OPEN |
| R-NO-SPEC | n/a - spec supplied (PRD2.pdf, 312 pp) | 2026-10-09 | N/A |
| R-DEVICE | Device and environment per role not supplied; derived from the Book V Phase 1 device list as ASM-DEVICE-1 | 2026-10-09 | OPEN |
| R-A11Y | Accessibility obligation beyond AA unconfirmed; AA floor applied | 2026-10-09 | OPEN |
| R-NO-DD | D&D call not held and no question round, by user instruction; the PRD stands as the domain authority's written statement, so every Phase 1 claim stays (asserted) and 29 rule-bearing glossary terms are unverified | 2026-10-09 | OPEN (accepted by user instruction; disclose at every gate) |
| R-PHASE-SPLIT | Phase assignment of EDI and IF-20 disagrees inside the PRD (K-10, K-11); both sides are outside go-live, so the estimate is unaffected unless Phase 2 is priced | 2026-10-09 | OPEN |

## Open contradictions

All rows: type internal (the anchor document against itself), owner the requesting user (SME/PO),
status **recorded, not to be resolved (user instruction 2026-10-09)**: build as per the PRD. Where
the estimate needs one side, the assumption register says which (ASM-SCOPE-1, ASM-SCOPE-2, ASM-LABEL-1).

| # | Statement A (tagged) | Statement B (tagged) | Owner | Due |
|---|---|---|---|---|
| K-01 | Front matter: screen entries sit in fifteen module sections [DOC:p.8] | Book VI has 13 module sections holding the 78 entries [DOC:pp.244-275] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-02 | Book VIII: ten capabilities phased beyond first go-live [DOC:p.289 §6] | Book IX: nine target-state modules; the tenth (advanced warehousing) appears only in Book VIII [DOC:p.304, pp.300-312] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-03 | Book V: 7 label types [DOC:p.239 §8] | Book VII: nine label samples with "remaining seven" [DOC:p.285], and ten label types in the list and usage matrix [DOC:pp.285-286 §7] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-04 | Book VII manifest: migration workbook is row 7 [DOC:p.284 §5] | Same manifest: workbook is row 4 [DOC:p.284 §5] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-05 | Book I: "75+" screens [DOC:pp.92-133 Part K]; Book V screen table: 77 rows [DOC:pp.231-237] | Book VI: 78 entries and "every screen appears below" [DOC:p.8, p.244]; Book VII adds 6 supplemental entries [DOC:pp.279-282]. Per-module counts also differ (e.g. Sales 9 vs 8, Production 6 vs 8) [DOC:pp.231-237 vs pp.244-275] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-06 | Book VI wave table names count documents, safety stock, pricing service surfaces and close orchestration [DOC:pp.244-245 §2] | Book VI has no entries for them; count documents and safety stock appear only in Book VII [DOC:pp.246-276, pp.279-282] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-07 | Book II: "12 new screens" [DOC:p.172] | Book II names 10 screen IDs [DOC:pp.141-170]; Book V lists 9 Material rows [DOC:pp.231-237]; Book VI has 10 Materials entries [DOC:pp.244-275] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-08 | Book IV conflict register is numbered C-01 to C-06 [DOC:pp.205-206 §1.3] | No C-02 row exists in it [DOC:pp.205-206 §1.3] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-09 | Book I: infinite-capacity planning [DOC:p.205 §1.3 C-01] | Book III: finite capacity with CTP; the document closes this itself, Book III controls [DOC:p.205 §1.3] | Requesting user (SME) | closed by the document's own rule; recorded only |
| K-10 | Book III: IF-20 scale/instrument capture is Phase 2 [DOC:p.186 §B] | Book IV: instrument interfaces and OEE/downtime automation (IF-20) are Phase 3 [DOC:p.205 §1.2] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-11 | Book I: invoice delivery by EDI is Phase 3 [DOC:p.49 §2] | Book IV: EDI 850/855/856/810 is Phase 2 [DOC:pp.204-205 §1.2] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-12 | Book II: nine material types incl. NSTK [DOC:p.137 §2.1] | Book V glossary: eight material types, no non-stock [DOC:p.224] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-13 | Book V: six status colours "used consistently across every lifecycle" (gray, amber, red, green, blue, dark green) [DOC:p.241 §10.1] | Lifecycle tables also use yellow, purple, teal and dark red (e.g. RMA Partially Received teal, SO In Fulfillment purple, material Obsolete dark red) [DOC:p.26; p.36; p.54; p.149] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-14 | RMA status table: 11 values, Draft to Rejected / Cancelled [DOC:p.26 §3.8] | Same table's transitions name Closed Short and Reopened, which have no row [DOC:p.26 §3.8] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-15 | Sales order status table has no Rejected row (9 rows) [DOC:p.54 §4.6] | Same table: Submitted exits to "Confirmed / Credit Hold / Rejected" [DOC:p.54 §4.6] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-16 | Material lifecycle has six statuses, Draft to Obsolete [DOC:p.149 §4.1] | Same table's transitions name Deleted (from Draft) and Rejected (from Data Completion), which have no row [DOC:p.149 §4.1] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-17 | Routing lifecycle "mirrors EBOM": Draft, In Review, Released, Superseded [DOC:p.73] | EBOM lifecycle has a fifth status, Obsolete [DOC:p.61 §3.4] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-18 | Workflow catalogue: EBOM / routing / plan / document release is Draft → In Review → Released [DOC:p.12 W.4] | Document lifecycle starts at WIP, not Draft, and adds Superseded and Obsolete [DOC:p.64 §5.2] | Requesting user (SME) | recorded, not to be resolved (user instruction) |
| K-19 | Book I: pegs sit on the sales order line (SOLine peg refs) [DOC:p.128 K1] | Book IV: pegging is schedule-level; Book I line-level pegs read as schedule 10 [DOC:p.206 §2]; Book IV outranks Books I-III [DOC:p.204 §1.1] | Requesting user (SME) | closed by the document's own rule; recorded only |

---

**Key.**
**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**S1** blocker - **S2** major, harms the task - **S3** minor - **SC** a craft judgment stated as a prediction, which goes to the next user session rather than to a fix - **S4** a preference, recorded and dropped.
