# FL-01 Make-to-stock order to cash (reference flow, TENTATIVE)

> **What this is.** How the specification says a stocked product is sold, shipped, invoiced and paid
> for. It stands in for the current process, which nobody has described. Designers use it to see
> which screen each step lands on and what changes status.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction). If a step is in the wrong order, name
> the step number.

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2 (no current process; this flow is the reference), ASM-EXT-1
(the accounting volume ACC V2.0 is not supplied, so invoice and cash steps stop at its boundary).
Step order: OQ-11.

| Field | Value |
|---|---|
| Goal | Sell stocked components and standard transformers from finished goods with credit-safe, tax-correct, reconciled cash closure [DOC:p.176 FL-01 f1] (asserted) |
| Trigger | Confirmed sales order with MTS lines; customer Active with Bill-To and Ship-To; price resolved; credit check passed [DOC:p.176 f2] (asserted) |
| Owners | Sales Admin until Confirmed; Warehouse for pick, pack, ship; Finance for invoice to cash [DOC:p.176 f3] (asserted) |
| Terminal | All lines Shipped and Invoiced, cash applied or receivable approved open, no open credit requests; status Invoiced/Closed [DOC:p.176 f12] (asserted) |
| Tests | TC-O2C-001 to 060 [DOC:p.177 f15] (asserted) |
| Execution detail | FL-09 extends the delivery part of this flow (schedule lines, cockpit, proof of delivery) [DOC:p.206 §2] (asserted) |

## Steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent (the specification does not say) |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Submit the sales order; system runs credit and price checks | Sales Admin | OM-SO-001/2 | Sales order: Draft → Submitted → Confirmed, Credit Hold or Rejected | Price-floor breaches need approval; credit check at submit | none | none | [DOC:p.176 f4; p.54; p.250] (asserted) | Price-floor approver title on this page |
| 2 | Release a credit hold | Finance | OM-SO-001/2 | Sales order: Credit Hold → Confirmed or Cancelled | Sales cannot release credit holds | none | none | [DOC:p.176 f4, f13; p.54] (asserted) | Time a hold may wait |
| 3 | Confirm; stock is reserved | System | OM-SO-001/2 | Sales order: Confirmed (supply pegged); reservation created | Reservation at confirm | none | none | [DOC:p.176 f6; p.54; p.250] (asserted) | none |
| 4 | Pick and pack into handling units | Warehouse, Packers | OM-DLV-001, OM-PACK-* | Sales order: → In Fulfillment; handling unit: Open → Closed | Pick and pack post nothing to the ledger; weight sanity at HU close | Packaging backflush #27 at HU close | SP-16, SP-17 | [DOC:p.176 f6; p.31; p.251] (asserted) | Pick scan for this flow |
| 5 | Pre-shipment inspection | Quality | QM-EXEC | Delivery blocked until inspection passes | Gate blocks PGI (E-OM-07); CoC generated | none | none stated | [DOC:p.176 f8; p.264] (asserted) | Inspector role title; which scan, if any |
| 6 | Post goods issue | Warehouse | OM-DLV-001 | Sales order: → Partially Shipped or Shipped; serial: shipped, customer and site written; HU: Loaded → Shipped | One atomic transaction: stock, serial, journal, invoice request; PGI role is not the invoice-posting role; under 2 s P95 | #25 DR COGS / CR FG at standard; #26 freight accrual; #27 | SP-18 | [DOC:p.176 f6, f9, f13, f14; p.251] (asserted) | none |
| 7 | Post the invoice from the invoice request | Finance | ACC volume (not in this document) | Sales order: Shipped → Invoiced/Closed | Invoice request visible to Finance under 1 min; tax committed with Avalara | DR 1200 AR / CR 4100 + 2300 | none | [DOC:p.176 f7, f14; p.54] (asserted) | Invoice screen; ACC V2.0 not supplied |
| 8 | Apply cash | Finance | ACC volume | Invoice paid | per ACC 5 | per ACC 5 | none | [DOC:p.176 f7] (asserted) | All of it; ACC V2.0 not supplied |
| 9 | Reconcile | Finance | not named | none | Daily PGI COGS vs FG movement; monthly AR subledger = 1200 | none | none | [DOC:p.176 f12] (asserted) | Who runs the daily check |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| Partial shipment | Line split | [DOC:p.176 f11] (asserted) |
| Cancel before PGI | Releases the reservation | [DOC:p.176 f11] (asserted) |
| Correction after PGI | Only through RMA (FL-05) or credit and rebill | [DOC:p.176 f11] (asserted) |
| Bad debt | Write-off with Controller approval | [DOC:p.176 f11] (asserted) |
| Tax engine down | Rate override and 15-minute recalculation queue | [DOC:p.176 f10] (asserted) |
| Duplicate PGI | Structurally impossible: one state change with a lock | [DOC:p.176 f10] (asserted) |

## Handoffs

To FL-09 for delivery execution detail; to FL-05 when goods come back; to FL-06 for the monthly AR
tie-out [DOC:p.176 f11-f12; p.206] (asserted).

## Contradictions this flow touches

K-03 (how many label types exist, used at pack and ship), K-05 (Sales screen count 9 vs 8), K-11
(EDI invoice delivery Phase 3 vs Phase 2).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n fN]` the client's specification, page and closure field number · `(asserted)` said
once by the specification's author, unverified · **ASM-ID** assumption in `00-inputs/assumptions.md` ·
**OQ-ID** open question in `10-discovery/open-questions.md` · **K-nn** a contradiction inside the
specification (STATE.md) · **#nn** money-posting template · **SP-nn** scan point · **PGI** post goods
issue, the moment stock leaves · **HU** handling unit, a packed crate or pallet · **CoC** certificate
of conformance · **P95** 95 of 100 attempts.
