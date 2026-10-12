# FL-06 Period close (reference flow, TENTATIVE)

> **What this is.** How the specification says the month is closed: operational steps, allocations,
> reserves, and the tie-out of every subledger to the general ledger. It stands in for the current
> process, which nobody has described.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only. The detailed
> checklist steps live in a part we did not reopen (Book I Part J); they are listed here by number only.
>
> **What we need from you.** Nothing now (your instruction).

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2, ASM-EXT-1 (close journals and Hard Close sit in the
unsupplied ACC volume; see OQ-3), ASM-SCOPE-2 (close orchestration is a back-end service, K-06).
Step order: OQ-11.

| Field | Value |
|---|---|
| Goal | Monthly operational and financial close with subledger-to-GL tie-out across all volumes [DOC:p.180 FL-06 f1] (asserted) |
| Trigger | Close calendar; soft close at day -2 [DOC:p.180 f2] (asserted) |
| Owners | Controller owns the checklist; module owners execute their steps [DOC:p.180 f3] (asserted) |
| Terminal | Hard Close with zero unresolved checklist items and an archived close report [DOC:p.181 f12] (asserted) |
| Tests | TC-CLS-001 to 040 [DOC:p.181 f15] (asserted) |

## Steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Move the period to soft close | Controller | INV-CONFIG-PERIOD | Period: Open → Soft | One Open period, at most one Soft Close (R-PER-01); late postings get warnings | none | none | [DOC:p.180 f2, f4; p.181 f11; pp.41-42; p.281] (asserted) | none |
| 2 | Settle count postings and snapshot valuation | Module owners | INV-COUNT-DOC | Count documents settled | Valuation snapshot at inventory close | Count postings | none | [DOC:p.180 f6; p.280] (asserted) | Owner title |
| 3 | Settle production orders and reconcile WIP (step 6c, 6d) | Module owners | PP-SETTLE-001, PP-WIP-001 | Production orders → Closed (TECO) | WIP = 1320 + 1325; Completed over 5 days unsettled is a breach | #32 | none | [DOC:p.179 f12; p.263; p.262] (asserted) | none |
| 4 | Post warranty accrual and check reserve (step 9b) | Module owners | not named | none | No Settling RMAs with posted-document gaps (step 6e) | #24 | none | [DOC:p.180 FL-05 f12; p.180 FL-06 f7] (asserted) | Screen |
| 5 | Run the quarterly E&O reserve | not named | MM-EOR-001 | Reserve journal | Quarterly | DR 6320 / CR 5340 | none | [DOC:p.180 f6; p.248] (asserted) | none |
| 6 | Run allocations (step 5b) | Controller | CO-ALC-001/2 | Run ID ALC-YYYYMM-NN | Rerun = reversal plus repost; posting restricted to Controller | #36 | none | [DOC:p.180 f7; p.181 f10, f13; p.273] (asserted) | none |
| 7 | Reconcile intercompany pairs | Finance | not named | none | IC AR = IC AP per pair before Hard Close | none | none | [DOC:p.182 FL-07 f12] (asserted) | Screen |
| 8 | Auto-validate checklist steps | System | OPS-JOBS/INT | Checklist item passed or held | Each step queries its module report; failed steps hold the gate, never pass silently | none | none | [DOC:p.181 f9, f10; p.275] (asserted) | Checklist screen ID |
| 9 | Hard close | Controller | INV-CONFIG-PERIOD | Period: Soft → Hard | No back-posting into Closed (E-PER-01); target day +3 by M7 exit | Close journals per ACC | none | [DOC:p.180 f4, f7; p.181 f12, f14] (asserted) | Whether Hard Close is an ACC status (OQ-3) |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| Late posting | Soft-close warnings; corrections next period with a reference date | [DOC:p.181 f11] (asserted) |
| Reopen | Dual control, Controller plus CFO, tagged postings | [DOC:p.180 f4; p.181 f11, f13] (asserted) |
| Step executor | Not the step approver where flagged | [DOC:p.181 f13] (asserted) |

## Handoffs

Receives tie-outs from FL-01 (AR), FL-03 (GR/IR), FL-04 (WIP), FL-05 (reserve), FL-07 (IC pairs)
[DOC:pp.176-182 f12] (asserted).

## Contradictions this flow touches

K-06 (close orchestration named in the wave table but has no screen entry).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n fN]` the client's specification, page and closure field number · `(asserted)` said
once by the specification's author, unverified · **ASM-ID** assumption · **OQ-ID** open question ·
**K-nn** a contradiction inside the specification · **E&O** excess and obsolete stock · **IC**
intercompany · **WIP** work in progress · **#nn** money-posting template.
