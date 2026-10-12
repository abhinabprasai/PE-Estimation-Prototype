# FL-05 Returns and warranty (reference flow, TENTATIVE)

> **What this is.** How the specification says a customer return is authorised, received, inspected,
> decided and settled. It stands in for the current process, which nobody has described. Unlike most
> flows, the specification prints this one as an ordered eight-step sequence.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction).

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2, ASM-EXT-1 (credit notes post in the unsupplied ACC volume),
ASM-LABEL-1 (RMA label among the ten label types).

| Field | Value |
|---|---|
| Goal | Authorised return through disposition and financial settlement with linked-document closure [DOC:p.179 FL-05 f1] (asserted) |
| Trigger | Approved RMA per the policy matrix; reference document or the No-Reference exception path [DOC:p.179 f2] (asserted) |
| Owners | Customer Service to Authorized; Receiving and Quality the middle; Finance the settlement documents [DOC:p.179 f3] (asserted) |
| Terminal | Every line at a terminal disposition and all linked documents posted and closed [DOC:p.180 f12; p.21 step 8] (asserted) |
| Return classes | RC1 component, RC2 unit not energised, RC3 field return, RC4 billable repair [DOC:p.21 §3.1] (asserted) |
| Tests | TC-RMA-001 to 050 [DOC:p.180 f15] (asserted) |

## Steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Create the RMA from invoice, sales order or serial | Customer Service | RMA-LIST/CREATE | RMA: Draft | System pulls customer, serial, ship date, warranty status | none | none | [DOC:p.21 step 1; p.22; p.252] (asserted) | none |
| 2 | Submit and approve | CS Manager; Quality Manager (RC3); Controller | RMA-LIST/CREATE, WF-INBOX | RMA: Draft → Pending Approval → Authorized or Rejected | ≤$10k CS Manager; RC3 adds Quality Manager; over $50k adds Controller | none | none | [DOC:p.21 step 2; p.26; p.179 f4] (asserted) | Band between $10k and $50k |
| 3 | Issue return instructions with barcode | Customer Service | RMA-LIST/CREATE | RMA: Authorized | PDF emailed with label, dock, freight terms | none | none | [DOC:p.21 step 3; p.252] (asserted) | none |
| 4 | Receive the return | Receiving | RMA-RECEIPT | RMA: → Partially Received or Received; serial: → Returned; stock to Quarantine, QI Hold | Unauthorised extras need supervisor override | #17 to 1335 (none for customer property) | SP-19 | [DOC:p.21 step 4; p.26; p.180 f6; p.252] (asserted) | none |
| 5 | Inspect each line | Quality | RMA-DISP, QM-EXEC | RMA: Received → In Inspection | Inspection auto-created, plan type RMA; RC3 teardown and photos mandatory; receipt to inspection within 5 days | none | none stated | [DOC:p.21 step 5; p.180 f8, f14; p.253] (asserted) | Inspector title; scan at inspection |
| 6 | Propose and approve disposition; adjudicate warranty | Inspector proposes; authorised role approves | RMA-DISP | RMA: In Inspection → Disposition Pending → Settling | Restock, Repair, Replace, Scrap or Return As-Is; Warranty Approved or Denied; adjudicator is not the credit approver | none yet | none | [DOC:p.21 step 6; p.26; p.180 f13; p.253] (asserted) | Approver title per outcome |
| 7 | Execute settlement documents | System, Finance | RMA-DISP, RWO-001 | Credit memo request, replacement order, rework order or scrap created | Each outcome executes once, keyed on disposition ID; documents within 1 min | #18 restock; #19 credit, fee 4910; #20 scrap; #21 warranty repair vs 2610; #22 billable repair; #23 replacement | none | [DOC:p.21 step 7; p.180 f7, f9, f10, f14] (asserted) | none |
| 8 | Close | System | RMA-LIST/CREATE | RMA: Settling → Closed | Blocked while any linked document is open | none | none | [DOC:p.21 step 8; p.26] (asserted) | none |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| No reference document | CS Manager approval at any value; credit at list less 20%, Controller mandatory | [DOC:p.26 §3.9] (asserted) |
| Partial return | Received across receipts; Close Short by supervisor | [DOC:p.26 §3.9] (asserted) |
| Customer on credit hold | RMA allowed; settlement by credit blocked until hold clears | [DOC:p.22] (asserted) |
| Reopen | Within 30 days, Controller | [DOC:p.26; p.180 f11] (asserted) |
| Credit reversal | Via rebill | [DOC:p.180 f11] (asserted) |
| Warranty reserve | Monthly accrual #24; overflow to 6300 | [DOC:p.180 f7, f15] (asserted) |

## Handoffs

From FL-01, FL-09 (claims) and FL-08 (recall-class RMAs); rework into FL-04; NCR and SCAR into
quality; return events T12 into FL-11; reserve adequacy in FL-06 [DOC:p.180; p.207; p.211] (asserted).

## Contradictions this flow touches

K-03 (label type count; the RMA label is one), K-05 (Returns screen counts differ between books).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n fN]` the client's specification, page and closure field number · `(asserted)` said
once by the specification's author, unverified · **ASM-ID** assumption · **K-nn** a contradiction
inside the specification · **RMA** return material authorisation · **RC1-RC4** return classes ·
**QI Hold** held for quality inspection · **NCR / SCAR** non-conformance report, supplier corrective
action request · **#nn** money-posting template · **SP-nn** scan point.
