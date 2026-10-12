# FL-09 Sales order to delivery, consolidated (reference flow, TENTATIVE)

> **What this is.** How the specification says an order is promised, allocated, grouped into
> deliveries, packed, shipped and closed with proof of delivery, across stocked, made-to-order and
> engineered orders. It extends FL-01 and FL-02 with the execution detail. It stands in for the
> current process, which nobody has described. It is the first-ranked prototype candidate.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction).

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2, ASM-OQ-1 (DEC-04: carrier and tracking manual in Phase 1).
The document cites "16 stages" but no stage list appears in the text (OQ-14). Step order: OQ-11.

| Field | Value |
|---|---|
| Goal | One execution design across MTS, MTO and ETO: schedule lines, deterministic delivery split and merge, allocation and backorder, carrier and POD closure, controlled PGI reversal [DOC:p.206 §2] (asserted) |
| Trigger | Confirmed schedule lines due inside the horizon [DOC:p.251] (asserted) |
| Terminal | Schedule line Closed; delivery Delivered/Closed; POD Resolved/Closed [DOC:pp.206-207] (asserted) |
| Tests | TC-FLA-001 to 080; TC-O2C-061 to 070 for reversals [DOC:p.208] (asserted) |

## Status lists this flow carries

| Record | Statuses | Source |
|---|---|---|
| *record* | *A → B → C* | *[DOC:p.n] (asserted)* |
| Schedule line | Open → Confirmed → Allocated/Pegged → Delivery Due → Partially Delivered → Delivered → Closed / Cancelled | [DOC:p.206 §2.1] (asserted) |
| Delivery | Planned → Released → Picking → Packed → Quality Cleared → Loaded → PGI → Delivered/Closed | [DOC:p.207 §2.4] (asserted) |
| Handling unit | Open → Closed → Loaded → Shipped | [DOC:p.31] (asserted) |
| Proof of delivery | Expected → Received / Exception → Resolved/Closed | [DOC:p.207 §2.4] (asserted) |
| Sales order | Draft, Submitted, Credit Hold, Confirmed, In Fulfillment, Partially Shipped, Shipped, Invoiced/Closed, Cancelled | [DOC:p.54] (asserted) |

## Steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Confirm each schedule line | System on order confirm | OM-SO-001/2, CTP-DLG | Schedule line: Open → Confirmed | ATP for MTS, CTP for MTO/ETO; constraint named and plan snapshot ID stored | none | none | [DOC:p.206 §2.1; p.250; p.260] (asserted) | none |
| 2 | Peg or allocate supply | System | OM-SO-001/2 | Schedule line: Confirmed → Allocated/Pegged | Short MTS supply allocated by customer buffers, then priority class A/B/C, then requested date, then entry time; fair share within a class | none | none | [DOC:pp.206-207 §2.2] (asserted) | none |
| 3 | Work backorders and re-promise | not named; Sales Director approves reallocation | OM-BO-001 | Backorder flag set when Confirmed < Requested | Taking supply from one order for another needs Sales Director approval and writes an audit pair; substitutes only from approved alternates | none | none | [DOC:p.207 §2.2; p.251] (asserted) | none |
| 4 | Run delivery creation | Shipping (nightly or on demand) | OM-DLV-001 | Schedule line: → Delivery Due; delivery: → Planned | Mandatory and elective split rules (default window 7 days); merge rules; each grouping stores the rule ID (E-DLV-01) | none | none | [DOC:p.207 §2.3; p.228; p.251] (asserted) | none |
| 5 | Release to warehouse and pick | Warehouse | OM-DLV-001 | Delivery: Planned → Released → Picking | Delivery consumes schedule lines, never raw order lines | none | none stated | [DOC:p.176 f3; p.206 §2.1; p.207 §2.4; p.251] (asserted) | Pick scan |
| 6 | Pack into handling units | Packers | OM-PACK-* | Delivery: → Packed; HU: Open → Closed | Weight sanity at close (±2%) | #27 at HU close | SP-16, SP-17 | [DOC:p.207; p.31; p.251] (asserted) | none |
| 7 | Pre-shipment inspection | not named | QM-EXEC | Delivery: Packed → Quality Cleared | Readiness flags: supply, quality, credit, documents | none | none stated | [DOC:p.207 §2.4; p.264] (asserted) | Inspector title |
| 8 | Plan the load and load the truck | Shipping | OM-DLV-001 | Delivery: → Loaded; HU: → Loaded | Equipment type, permit checklist, dock and slot; carrier and BOL entered manually | none | SP-18 confirms sequence | [DOC:p.207 §2.4] (asserted) | none |
| 9 | Post goods issue when green | Shipping | OM-DLV-001 | Delivery: Loaded → PGI; schedule line: → Partially Delivered or Delivered; expected POD row created | Atomic; failure leaves delivery at Loaded with the error shown | #25, #26, #27; invoice request | none | [DOC:p.208 §2.5; p.251; p.252] (asserted) | none |
| 10 | Record proof of delivery | Shipping office | OM-POD-001 | POD: Expected → Received or Exception; delivery → Delivered/Closed | Missing POD after expected date + N days alerts; POD or site acceptance fires the final milestone once | Freight claim recovery when applicable | none | [DOC:p.207 §2.4; p.252] (asserted) | Value of N |
| 11 | Resolve a claim | CS | OM-POD-001 | POD: Exception → Resolved/Closed | Shortage, damage or refusal; resolve via credit memo, redelivery or repair; reuses RMA and credit paths | Through FL-05 or credit | none | [DOC:p.207 §2.4; p.252] (asserted) | none |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| Reverse PGI before invoice | Shipping Manager, same fiscal period, reason mandatory; mirror of #25-#27; serials back to Reserved; HU → Loaded; delivery → Packed; invoice request withdrawn | [DOC:p.208 §2.5] (asserted) |
| After invoice | No PGI reversal; credit and rebill or RMA (FL-05) | [DOC:p.208 §2.5] (asserted) |
| Customer "no partial" flag | Waits for full quantity instead of splitting | [DOC:p.207 §2.3] (asserted) |

## Handoffs

From FL-01 and FL-02 (order entry); supply from FL-04 and FL-03; invoice request to Finance (FL-01
step 7); claims to FL-05; events T10 and T11 to FL-11 [DOC:p.206; p.207; p.211] (asserted).

## Contradictions this flow touches

K-03 (label count at pack), K-05 (Sales screen count 9 vs 8), K-09 (finite capacity CTP at
confirmation), K-11 (EDI 856 dispatch advice phase).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n]` the client's specification, page · `(asserted)` said once by the specification's
author, unverified · **ASM-ID** assumption · **OQ-ID** open question · **K-nn** a contradiction inside
the specification · **ATP / CTP** available-to-promise, capable-to-promise · **MTS / MTO / ETO** make to
stock, make to order, engineer to order · **HU** handling unit · **PGI** post goods issue · **POD**
proof of delivery · **BOL** bill of lading · **#nn** money-posting template · **SP-nn** scan point.
