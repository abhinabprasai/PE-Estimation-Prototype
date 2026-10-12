# FL-10 Design to source (reference flow, TENTATIVE)

> **What this is.** How the specification says an engineering need becomes a correct, compliant
> purchase, including buying long-lead parts before design is final and handling engineering changes
> that hit open purchase orders. It stands in for the current process, which nobody has described.
> The specification prints this one as a 16-stage table, so the order is the document's own.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction).

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2, ASM-OQ-1 (DEC-05: ASN is Phase 2), ASM-PERM-1.

| Field | Value |
|---|---|
| Goal | Engineering need becomes a revision-correct, compliance-checked purchase; engineering change reaches open purchase documents [DOC:p.208 §3] (asserted) |
| New controls | Release levels, long-lead purchase release (LLR), supplier technical package (STP) [DOC:p.208 §3] (asserted) |
| Release levels | Concept → Preliminary/RFQ → Long-Lead Purchase Release → Approved for Purchase → Released for Production → Superseded/Obsolete; forward only except via ECO [DOC:pp.208-209 §3.1] (asserted) |
| Terminal | PO matched/closed, ECO impacts resolved, no open deviation, LLR closed [DOC:p.210 stage 16] (asserted) |
| Tests | TC-DTS-001 to 040 [DOC:p.210] (asserted) |

## Steps (the document's 16 stages)

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Trigger: ETO order, ECO, obsolescence, NCR or make/buy review | System | ENG-REQ-001 | Engineering request created | Trigger type, owner, due date, links | none | none | [DOC:p.210 stage 1; p.255] (asserted) | none |
| 2 | Preliminary design with placeholders | Engineering | ENG-BOM-002 | Release level: Preliminary; placeholder MCRs open | RFQs allowed, POs blocked (E-DTS-01) | none | none | [DOC:p.208 §3.1; p.210 stage 2] (asserted) | none |
| 3 | Create the material | MCR task owners | MM-MCR-001/2 | MCR → Active material | Activation blocked until mandatory views complete | none | none | [DOC:p.210 stage 3; p.245] (asserted) | none |
| 4 | Decide make or buy and source strategy | not named | not named | Decision recorded | Approved decision, effective date, owner | none | none | [DOC:p.210 stage 4] (asserted) | Screen and actor |
| 5 | Decide a long-lead release | Engineering Manager + Purchasing Manager; Controller above $100k or High risk | LLR-001 | LLR approved | Caps, risk class, accepted cancellation exposure | Exposure feeds ETO committed cost | none | [DOC:p.209 §3.2; p.210 stage 5; p.268] (asserted) | none |
| 6 | Build the supplier technical package | not named | not named | STP version created, immutable, checksummed | Superseded STP cannot attach to new documents (E-DTS-03) | none | none | [DOC:p.209 §3.3; p.210 stage 6] (asserted) | Screen for STP |
| 7 | Determine the source | Buyer | MM-SL-001, PUR-VEND-001/2 | Eligible source and reason | AVL qualification; EX-09 when none | none | none | [DOC:p.210 stage 7] (asserted) | none |
| 8 | Run RFQ and technical bid | Buyer; Engineering for technical pass | PUR-PR/RFQ | RFQ: → Awarded | Technical pass or fail before commercial opens; award writes AVL and info record | none | none | [DOC:p.210 stage 8; p.267] (asserted) | none |
| 9 | Approve PR and budget | Approvers | PUR-PR/RFQ, WF-INBOX | PR: → Approved | Budget evidence | none | none | [DOC:p.210 stage 9] (asserted) | none |
| 10 | Create and release the PO | Buyer | PUR-PO-001/2 | PO: released revision; transmission record | STP version and LLR flag on the line; LLR cap breach blocks (E-DTS-02) | Commitment | none | [DOC:p.209 §3.2; p.210 stage 10] (asserted) | none |
| 11 | Capture supplier acknowledgement | Buyer | PUR-PO-001/2 | Line: Acknowledged / Exception / Rejected | Vendor confirms quantity, date, price and STP version | none | none | [DOC:p.209 §3.3; p.210 stage 11] (asserted) | none |
| 12 | Handle engineering change | Engineering, Buyer | ENG-ECR/ECO, LLR-001 | Per-line disposition before effectivity | Proceed, change order or stop with exposure booking; unresolved LLR impacts block ECO release | Exposure booking | none | [DOC:p.209 §3.2; p.210 stage 12; p.256] (asserted) | none |
| 13 | Receive with provenance | Receiving | not named | Traceability starts (T01, T02) | Receipt hard-blocks if vendor never acknowledged a revised STP (E-DTS-04) | GRN per FL-03 | SP-01 to SP-03 | [DOC:p.209 §3.3; p.210 stage 13] (asserted) | Receiving screen |
| 14 | Inspect against the STP | Quality | QM-EXEC, QM-DEV-001 | Accept, conditional, reject, RTV, NCR or SCAR | Wrong-revision documents block acceptance with the STP diff shown | none | SP-05, SP-14 (inspection screen entry) | [DOC:p.210 §3.3, stage 14; p.264; p.265] (asserted) | none |
| 15 | Release to production | System | not named | Stock → Unrestricted with lineage (T03, T04) | Stock status rules | none | none | [DOC:p.210 stage 15] (asserted) | none |
| 16 | Close | Buyer, Engineering | LLR-001 | LLR closed | ETO order cannot invoice its Materials milestone with an open LLR exposure decision | none | none | [DOC:p.209 §3.2; p.210 stage 16] (asserted) | none |

## Handoffs

From FL-02 (engineering request); PO execution and payment in FL-03; events T01 to T04 in FL-11
[DOC:p.208; p.211] (asserted).

## Contradictions this flow touches

K-12 (material types at MCR), K-07 (Book II screen count), K-11 (EDI phase; ASN Phase 2 per DEC-05).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n]` the client's specification, page · `(asserted)` said once by the specification's
author, unverified · **ASM-ID** assumption · **K-nn** a contradiction inside the specification ·
**LLR** long-lead purchase release · **STP** supplier technical package · **MCR** material creation
request · **AVL** approved vendor list · **ECO** engineering change order · **RTV** return to vendor ·
**ASN** advance shipping notice · **T01-T13** traceability events (FL-11) · **SP-nn** scan point.
