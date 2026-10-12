# FL-03 Procure to pay (reference flow, TENTATIVE)

> **What this is.** How the specification says a demand becomes a purchase order, a receipt, a
> matched invoice and a payment. It stands in for the current process, which nobody has described.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction). If a step is in the wrong order, name
> the step number.

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2, ASM-EXT-1 (invoice matching and payment sit in the
unsupplied ACC volume), ASM-PERM-1 (approval ladder). Step order: OQ-11. Receiving scans: OQ-9.

| Field | Value |
|---|---|
| Goal | Demand to paid supplier with three-way-match integrity, PPV capture and supplier-account reconciliation [DOC:p.178 FL-03 f1] (asserted) |
| Trigger | MRP, reorder or manual PR; source resolved; vendor Active; material purchasable [DOC:p.178 f2] (asserted) |
| Owners | Buyer owns PR → PO to Confirmed; Receiving owns the GRN; AP owns invoice and payment [DOC:p.178 f3] (asserted) |
| Terminal | PO lines Received and Matched/Closed, GR/IR cleared, payment executed or scheduled, no open NCR or SCAR on the receipts [DOC:p.178 f12] (asserted) |
| Tests | TC-P2P-001 to 070 [DOC:p.178 f15] (asserted) |

## Steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Raise a requisition | Planner (MRP) or requester | PP-MRP-001, PUR-PR/RFQ | PR: Open → In Approval (manual and expense only) → Approved | MRP PRs pre-approved by policy | none | none | [DOC:p.102; p.178 f2; p.259; p.267] (asserted) | Requester role titles |
| 2 | Resolve the source | Buyer | MM-SL-001, PUR-VEND-001/2 | Vendor must be Active | Source order per Book II §7.5; no PO before vendor Active | none | none | [DOC:p.101; p.178 f2, f5; p.247] (asserted) | none |
| 3 | Run an RFQ where policy demands | Buyer | PUR-PR/RFQ | RFQ: Draft → Issued → Responses In → Awarded | Award writes info records | none | none | [DOC:p.103; p.267] (asserted) | none |
| 4 | Group PRs into a PO and approve it | Buyer, approvers | PUR-WB-001, PUR-PO-001/2 | PR: → Converted; PO: Draft → In Approval → Approved | Buyer ≤$25k → Purchasing Manager ≤$250k → Controller → CFO >$1M | none | none | [DOC:p.104; p.178 f4; p.266; p.267] (asserted) | Controller band upper limit |
| 5 | Send the PO and capture vendor confirmation | Buyer | PUR-PO-001/2 | PO: Approved → Sent → Confirmed | Email PDF in Phase 1 (IF-01); confirmation via IF-02 | none | none | [DOC:p.104; p.178 f9] (asserted) | none |
| 6 | Receive goods | Receiving | not named in Book VI | PO: → Partially Received or Received; stock to QI Hold | GRN is atomic; over-receipt beyond tolerance blocked (E-MM-11); duplicate GRN prevented by open-quantity lock | DR 13xx / CR 2110 GR/IR, with PPV | SP-01 to SP-03 | [DOC:p.104; p.178 f6, f9, f10; p.277] (asserted) | Receiving screen ID |
| 7 | Inspect incoming goods | not named | QM-EXEC | Stock: QI Hold → released or rejected | Certificates enforced (E-QM-06); vendor rating updates | Stock status moves | SP-05, SP-14 (inspection screen entry) | [DOC:p.178 f8; p.264] (asserted) | Inspector title |
| 8 | Match the vendor invoice | AP | ACC volume | PO: → Matched/Closed | Three-way match; duplicate (vendor, invoice #) blocked; exceptions to AP approval queue | DR 2110 / CR 2100, IPV to 5210 | none | [DOC:p.178 f4, f7, f10] (asserted) | Match screen; ACC V2.0 not supplied |
| 9 | Pay | AP | ACC volume | Payment executed | Payment run per ACC 8; payment release is a separate person | per ACC 8 | none | [DOC:p.178 f7, f13] (asserted) | All of it |
| 10 | Reconcile | AP, Finance | not named | none | GR/IR items over 30 days worked weekly; supplier statements monthly | none | none | [DOC:p.178 f12] (asserted) | Who works the aging list |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| Return to vendor | GRN reversal with PPV mirror | [DOC:p.178 f11] (asserted) |
| Invoice variance | Routed to AP approval queue | [DOC:p.178 f4, f11] (asserted) |
| Short close | With reason | [DOC:p.178 f11] (asserted) |
| Vendor bank change | Dual-approved | [DOC:p.178 f13] (asserted) |
| Separation of duties | PO create, GRN post, invoice approve and payment release are four different people | [DOC:p.178 f13] (asserted) |

## Handoffs

From FL-04 (MRP PRs) and FL-10 (engineered buys); stock released to FL-04; GRN starts the
traceability chain in FL-11 (T02); GR/IR tie-out in FL-06 [DOC:p.178; p.211] (asserted).

## Contradictions this flow touches

K-11 (EDI purchase orders Phase 2 vs Phase 3), K-12 (nine vs eight material types; decides what is
purchasable).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n fN]` the client's specification, page and closure field number · `(asserted)` said
once by the specification's author, unverified · **ASM-ID** assumption · **OQ-ID** open question ·
**K-nn** a contradiction inside the specification · **PR / PO / RFQ** purchase requisition, purchase
order, request for quotation · **GRN** goods receipt · **GR/IR** the account that holds received but
not yet invoiced value · **PPV / IPV** purchase and invoice price variance · **QI Hold** stock held for
quality inspection · **SP-nn** scan point.
