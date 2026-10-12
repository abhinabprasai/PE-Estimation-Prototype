# FL-04 Plan to produce (reference flow, TENTATIVE)

> **What this is.** How the specification says demand is planned, built on the shop floor and settled
> with no money left in work in progress. It stands in for the current process, which nobody has
> described.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction). If a step is in the wrong order, name
> the step number.

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2, ASM-DEVICE-1 (shop-floor kiosks and scanners). Step order:
OQ-11.

| Field | Value |
|---|---|
| Goal | Demand netting to settled production with zero residual WIP and complete genealogy [DOC:p.178 FL-04 f1] (asserted) |
| Trigger | MRP run inputs; released MBOM and routing (E-PP-01); materials Active; standards released [DOC:p.179 f2] (asserted) |
| Owners | Planner owns the planned order; Production Scheduler owns the production order to Close; operators own confirmations [DOC:p.179 f3] (asserted) |
| Terminal | TECO with variances posted and genealogy complete [DOC:p.179 f12] (asserted) |
| Tests | TC-PTP-001 to 070 [DOC:p.179 f15] (asserted) |

## Steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Run MRP and work the exceptions | Planner | PP-MRP-001 | Proposal set published with a run ID, all or nothing | Full MRP under 30 min; exceptions EX-01 to EX-07 | none | none | [DOC:p.179 f9, f14; p.72; p.259] (asserted) | none |
| 2 | Firm and convert planned orders | Planner | PLO-001 | Planned order → production order draft or PR | Pegs preserved | none | none | [DOC:p.179 f3; p.259] (asserted) | none |
| 3 | Release the production order | Production Scheduler | PP-WO-001/2 | Production order: Created → Released; serial generated; dispatch entries created | Six hard release gates; Release Short needs the Planner flag | none | none | [DOC:p.74 §5.2; p.179 f4; p.261] (asserted) | none |
| 4 | Sequence work at each work center | not named | PP-DSP-001, SCH-BOARD | Dispatch queue updated | Resequence inside guardrails | none | none | [DOC:p.260; p.262] (asserted) | Who sequences |
| 5 | Badge in, start, issue material, install child serials | Operator | PP-SFT-001 | Production order: Released → In Progress | Wrong-material scan hard-blocks (E-PP-07), auto-NCR on override; idempotent on (order, op, event ID) | #28 issue or backflush | SP-07, SP-10, SP-08, SP-12 | [DOC:p.179 f6, f8, f10; p.262] (asserted) | none |
| 6 | Complete the operation with quantities | Operator | PP-SFT-001 | Confirmation posted | QC checkpoint operations block completion; 4-hour offline queue | #29 labour and overhead; #30 scrap | SP-11 | [DOC:p.179 f7, f8, f14; p.262] (asserted) | none |
| 7 | Inspect at checkpoints and final test | not named | QM-EXEC, QM-FIN-001 | Production order: → Testing | Results stored on the serial | none | SP-14 | [DOC:p.75; p.264; p.265] (asserted) | Inspector title |
| 8 | Rework when needed | not named | RWO-001 | Rework order: Open → In Progress → Completed → Settled | Re-inspection mandatory when origin is test failure or RMA | rework via 1325; #33 at settlement | none | [DOC:p.79; p.179 f6; p.263] (asserted) | Rework actor |
| 9 | Receive finished goods | System | PP-SFT-001 | Production order: → Completed | none | #31 | none stated | [DOC:p.75; p.179 f6] (asserted) | Receipt scan |
| 10 | Settle | not named (approval at close) | PP-SETTLE-001 | Production order: Completed → Closed (TECO) | Settlement approval; confirmer is not the settlement approver; Completed over 5 days unsettled is a breach | #32 variances to 5220-5250 | none | [DOC:p.75; p.179 f4, f7, f12, f13; p.263] (asserted) | Settlement approver title |
| 11 | Reconcile WIP | not named | PP-WIP-001 | none | WIP report = GL 1320 + 1325; settled orders leave zero WIP | none | none | [DOC:p.179 f12; p.262] (asserted) | none |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| Shortage | Release Short with Planner flag | [DOC:p.179 f4, f11] (asserted) |
| Cancellation | Finish, stop-scrap or hold | [DOC:p.179 f11] (asserted) |
| Confirmation wrong | Reversal confirmation with mirror postings | [DOC:p.179 f11] (asserted) |
| Reopen | Controller only; settlement reversed | [DOC:p.179 f4, f11] (asserted) |
| Scrap over threshold | Supervisor plus reason | [DOC:p.179 f13] (asserted) |

## Handoffs

From FL-01, FL-02 and FL-09 demand; PRs to FL-03; finished goods to FL-09; genealogy to FL-11
(T05 to T09); WIP tie-out in FL-06 [DOC:p.179; p.211] (asserted).

## Contradictions this flow touches

K-09 (infinite vs finite capacity), K-10 (instrument and OEE capture Phase 2 vs 3), K-05 (Production
screen count 6 vs 8).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n fN]` the client's specification, page and closure field number · `(asserted)` said
once by the specification's author, unverified · **ASM-ID** assumption · **OQ-ID** open question ·
**K-nn** a contradiction inside the specification · **MRP** material requirements planning · **WIP**
work in progress · **TECO** technically complete · **NCR** non-conformance report · **#nn** money-posting
template · **SP-nn** scan point.
