# FL-02 Engineer-to-order quote to cash (reference flow, TENTATIVE)

> **What this is.** How the specification says a custom transformer goes from a won quote through
> design, build, test, shipment and milestone billing. It stands in for the current process, which
> nobody has described. It is the longest flow and walks most of the linkage spine.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction). If a step is in the wrong order, name
> the step number.

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2, ASM-EXT-1 (revenue recognition sits in the unsupplied ACC
volume), ASM-CAD-1 (drawings come from the assumed PDM). Step order: OQ-11.

| Field | Value |
|---|---|
| Goal | Custom transformer from firm quote through design, build, test, ship, milestone billing and revenue closure [DOC:p.177 FL-02 f1] (asserted) |
| Trigger | Firm quotation Won, giving a sales order with ETO lines and complete configuration attributes; released cost estimate linked; estimator and margin approval trail [DOC:p.177 f2] (asserted) |
| Owners | Sales order line is the commercial anchor; engineering request owns design; production order owns build; revenue contract owns recognition [DOC:p.177 f3] (asserted) |
| Terminal | Unit delivered, all milestones invoiced, revenue recognised, production order settled to zero WIP, genealogy complete, warranty record active [DOC:p.177 f12] (asserted) |
| Tests | TC-ETO-001 to 080 [DOC:p.177 f15] (asserted) |

## Steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Release the cost estimate that makes the price quotable | Estimator | CST-CE-001 | Cost estimate: Draft → Released | Quote margin panel reads Released estimates only | none | none | [DOC:p.119; p.270] (asserted) | none |
| 2 | Issue the quote and record the win | Sales | OM-QT-001/2 | Quote: Draft → Internal Review → Issued → Won | Internal review with estimator and pricing approval when margin is below target | none; tax estimate on save | none | [DOC:p.51; p.250; p.177 f2] (asserted) | Margin target value on this page |
| 3 | Convert to a sales order and confirm with a capacity promise | Sales | OM-SO-001/2, CTP-DLG | Sales order: Draft → Submitted → Confirmed; soft capacity reservation becomes firm load | Confirmation by capable-to-promise for ETO | none | none | [DOC:p.54; p.206 §2.1; p.250; p.260] (asserted) | none |
| 4 | Engineering request is created | System | ENG-REQ-001 | Engineering request: → Open → In Design | Created automatically when an ETO order confirms | none | none | [DOC:p.59; p.255] (asserted) | none |
| 5 | Author the EBOM, creating placeholder materials | Assigned engineers | ENG-BOM-002, MM-MCR-001/2 | EBOM: Draft → In Review → Released; MCR opened per placeholder | Engineer cannot approve own EBOM release | none | none | [DOC:p.61; p.177 f5, f13; p.245; p.255] (asserted) | Number of review rounds |
| 6 | Send drawings for customer approval | Engineering | TR-001 | Engineering request: In Design → Customer Review → Released | Response drives the design approval milestone; rejection loops via Revise and Resubmit | Design approval milestone money | none | [DOC:p.59; p.177 f8, f11; p.258] (asserted) | Customer response time limit |
| 7 | Transform EBOM to MBOM and pair with routing | Manufacturing engineer | MBOM-TRF, PV-001 | MBOM: Draft → In Review → Released; production version released | Costing invalidation flag raised | none | none | [DOC:p.73; p.256; p.276] (asserted) | none |
| 8 | Release the production order | Production Scheduler | PP-WO-001/2 | Production order: Created → Released; serial generated | Six release gates incl. drawings released and customer approval complete (E-PP-03) | none | none | [DOC:p.74 §5.2; p.177 f5; p.261] (asserted) | none |
| 9 | Issue material and confirm operations | Operator | PP-SFT-001 | Production order: Released → In Progress | Confirmation is atomic: issue, labour, genealogy, WIP journal | #28 issue to WIP; #34/#35 subcontract legs | SP-08, SP-10, SP-11, SP-12 | [DOC:p.177 f6, f9; p.262] (asserted) | none |
| 10 | Final test; pass generates the FTR and fires the Production Complete milestone | not named | QM-FIN-001 | Production order: In Progress → Testing → Completed | Final test and FTR gate the milestone; fail routes to rework with retest | Milestone trigger | SP-14 | [DOC:p.75; p.177 f8; p.265] (asserted) | Test engineer title |
| 11 | Receive finished goods into the order-pegged stock | System | PP-SFT-001 | FG receipt | At standard | #31 | none stated | [DOC:p.177 f6] (asserted) | Receipt scan |
| 12 | Ship (see FL-09 for delivery detail) | Warehouse | OM-DLV-001 | Sales order: → Shipped | Surcharge true-up for ship-date-adjusted contracts | #25; #38 | SP-18 | [DOC:p.177 f6-f7; p.251; p.271] (asserted) | none |
| 13 | Post each milestone invoice after evidence review | Finance | ACC volume | Milestone invoiced | Billing plan 20/10/20/30/15/5%; reviewer is not the sales order owner; one invoice request per milestone ID | #37 | none | [DOC:p.53; p.177 f4, f7, f10, f13] (asserted) | Invoice screen; ACC V2.0 not supplied |
| 14 | Settle the production order | not named | PP-SETTLE-001 | Production order: Completed → Closed (TECO) | WIP by order = 1320/1325 | #32 variances | none | [DOC:p.75; p.177 f7, f12; p.263] (asserted) | Settlement approver |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| Drawing rejected | Revise and Resubmit loop | [DOC:p.177 f11] (asserted) |
| Configuration change after Design Release | Only via ECR → Sales Change Order | [DOC:p.177 f11] (asserted) |
| Production order cancelled | Cancellation dispositions | [DOC:p.177 f11] (asserted) |
| Milestone reversal | Only via credit note with contract re-measurement | [DOC:p.177 f11] (asserted) |

## Handoffs

From the lead and quote stage of the spine; to FL-10 for long-lead and engineered buys; to FL-04
for build mechanics; to FL-09 for delivery; to FL-05 once the warranty record is active
[DOC:p.177; pp.276-277; p.229] (asserted).

## Contradictions this flow touches

K-09 (infinite vs finite capacity; the document says Book III controls), K-10 (instrument capture at
final test, Phase 2 vs Phase 3), K-05 (Production screen count 6 vs 8).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n fN]` the client's specification, page and closure field number · `(asserted)` said
once by the specification's author, unverified · **ASM-ID** assumption · **OQ-ID** open question ·
**K-nn** a contradiction inside the specification (STATE.md) · **#nn** money-posting template ·
**SP-nn** scan point · **ETO** engineer to order · **EBOM / MBOM** engineering and manufacturing bill
of materials · **MCR** material creation request · **FTR** final test report · **TECO** technically
complete · **WIP** work in progress.
