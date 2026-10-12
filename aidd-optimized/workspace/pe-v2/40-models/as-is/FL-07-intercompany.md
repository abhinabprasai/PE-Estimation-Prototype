# FL-07 Intercompany supply (reference flow, TENTATIVE)

> **What this is.** How the specification says one PE company sells to another: a paired sales order
> and purchase order, transfer prices, and the monthly matching of what one owes the other. It stands
> in for the current process, which nobody has described.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only. No screen is
> dedicated to this flow; it runs through the ordinary order screens (OQ-15).
>
> **What we need from you.** Nothing now (your instruction).

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2, ASM-OQ-1 (multi-plant activation DEC-07 stays off), ASM-EXT-1
(elimination runs in the unsupplied ACC volume). Step order: OQ-11.

| Field | Value |
|---|---|
| Goal | Cross-company sale or transfer between PE entities with transfer pricing, IC AR/AP and elimination-ready postings [DOC:p.181 FL-07 f1] (asserted) |
| Scope at go-live | PE Grid Components to PE Transformer merchandise flow; manufacturing transfers wait for plant 2 [DOC:p.181 f1] (asserted) |
| Trigger | IC relationship configured; transfer price list active; both entities' periods open [DOC:p.181 f2] (asserted) |
| Owners | Initiating entity's buyer or CSR; Finance owns IC reconciliation [DOC:p.181 f3] (asserted) |
| Terminal | Pair settled and reconciled [DOC:p.182 f12] (asserted) |
| Tests | TC-ICO-001 to 030 [DOC:p.182 f15] (asserted) |

## Steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Create the business event; both documents are made together | Buyer or CSR | PUR-PO-001/2 or OM-SO-001/2 | Seller sales order and buyer PO created as a pair, or neither | One transaction, both entity contexts (IF-14); under 2 s | none | none | [DOC:p.181 f3, f9; p.182 f14] (asserted) | Which screen starts it |
| 2 | Approve a price that deviates from the transfer price list | Controller, both sides | WF-INBOX | Pair proceeds | Controller approval on both sides | none | none | [DOC:p.181 f4] (asserted) | none |
| 3 | Ship from the seller | not named | OM-DLV-001 | Seller sales order: standard lifecycle; stock in transit | PGI at transfer price basis | DR IC AR / CR IC Revenue + tax; in-transit 1350 | none stated | [DOC:p.181 f6, f7] (asserted) | none |
| 4 | Receive at the buyer | not named | not named | Buyer PO: standard lifecycle | GRN at the transfer price | DR inventory / CR IC AP | none stated | [DOC:p.181 f6, f7] (asserted) | Receiving screen |
| 5 | Monitor mismatches | System | not named | Alert to Finance daily | Pairs whose values or statuses diverge | none | none | [DOC:p.181 f10] (asserted) | Alert screen |
| 6 | Reconcile monthly | Finance | not named | Pair reconciled | IC AR (seller) = IC AP (buyer) before Hard Close; FX differences to 7100 | FX to 7100 | none | [DOC:p.181 f11; p.182 f12] (asserted) | Reconciliation screen |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| Partial shipment | Mirrored on both sides | [DOC:p.181 f11] (asserted) |
| Return | Paired reversal documents | [DOC:p.181 f11] (asserted) |
| Transfer price maintenance | Controlling only | [DOC:p.182 f13] (asserted) |

## Handoffs

Uses FL-01/FL-09 (seller) and FL-03 (buyer) lifecycles; genealogy continues across entities in FL-11;
reconciliation feeds FL-06 [DOC:p.181 f4, f8; p.182 f12] (asserted).

## Contradictions this flow touches

None directly. Multi-plant screens exist but are switched off until DEC-07 [DOC:p.282 §4] (asserted).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n fN]` the client's specification, page and closure field number · `(asserted)` said
once by the specification's author, unverified · **ASM-ID** assumption · **OQ-ID** open question ·
**IC** intercompany · **AR / AP** receivable, payable · **PGI** post goods issue · **GRN** goods receipt ·
**FX** foreign exchange · **SP-nn** scan point.
