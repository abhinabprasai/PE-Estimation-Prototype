# FL-11 End-to-end traceability contract (reference flow, TENTATIVE)

> **What this is.** The specification's list of thirteen moments where the system must record who
> did what to which batch or serial, plus the rules that keep that record complete and uneditable. It
> is not a sequence one person walks; it rides on the other flows. It stands in for the current
> process, which nobody has described.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction).

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2.

| Field | Value |
|---|---|
| Goal | Turn scan points and the genealogy model into a binding data contract: events, schema, correction rules, completeness controls, outputs [DOC:p.211 §4] (asserted) |
| Terminal | Not a closing flow; daily controls keep the chain complete [DOC:p.212 §4.3] (asserted) |
| Performance | Full tree under 10 s; archive queries under 60 s [DOC:p.212 §4.4] (asserted) |
| Tests | TC-TRC-001 to 040 [DOC:p.212] (asserted) |

## Event capture points

| Event | Captured at | Carrying flow | Screen | Scan | Source |
|---|---|---|---|---|---|
| *Tnn* | *transaction* | *FL-nn* | *screen ID* | *SP-nn* | *[DOC:p.n] (asserted)* |
| T01 Supplier source | PO release | FL-10 | PUR-PO-001/2 | none | [DOC:p.211 §4.1] (asserted) |
| T02 Receipt identity | GRN | FL-03, FL-10 | not named | SP-01 to SP-03 | [DOC:p.211 §4.1] (asserted) |
| T03 Incoming quality | Inspection close | FL-03 | QM-EXEC | SP-14 | [DOC:p.211 §4.1] (asserted) |
| T04 Stock movement | Every movement | all | not named | SP-04, SP-06, SP-15, SP-21 | [DOC:p.211 §4.1] (asserted) |
| T05 Reservation and issue | Issue or backflush | FL-04 | PP-SFT-001 | SP-08, SP-09 | [DOC:p.211 §4.1] (asserted) |
| T06 Install or remove child | Parent-child scan | FL-04 | PP-SFT-001 | SP-12 | [DOC:p.211 §4.1] (asserted) |
| T07 Operation confirmation | Confirm | FL-04 | PP-SFT-001 | SP-10, SP-11 | [DOC:p.211 §4.1] (asserted) |
| T08 Test or inspection | Final test, in-process QC | FL-02, FL-04 | QM-FIN-001 | none stated | [DOC:p.211 §4.1] (asserted) |
| T09 Finished receipt | FG receipt | FL-04 | PP-SFT-001 | none stated | [DOC:p.211 §4.1] (asserted) |
| T10 Pack / HU | Pack | FL-09 | OM-PACK-* | SP-16, SP-17 | [DOC:p.211 §4.1] (asserted) |
| T11 Ship / deliver | Load, PGI, POD | FL-09 | OM-DLV-001, OM-POD-001 | SP-18 | [DOC:p.211 §4.1] (asserted) |
| T12 Return / service | RMA receipt and rework | FL-05 | RMA-RECEIPT, RWO-001 | SP-19 | [DOC:p.211 §4.1] (asserted) |
| T13 Recall / containment | Campaign actions | FL-08 | RCL-001 | none | [DOC:p.211 §4.1] (asserted) |

## Control steps

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Source | Silent |
|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Write each event append-only, hash-chained per object | System | none | Event: Active | No update or delete; database privileges enforce it | [DOC:p.212 §4.2, §4.3] (asserted) | none |
| 2 | Correct a wrong event with a reversal and a replacement | not named | TRC-DASH (correction pair flow) | Original: Active → Reversed; new: Replacement | Both reference the original | [DOC:p.212 §4.2, §4.3; p.274] (asserted) | Who may correct |
| 3 | Run daily parity and completeness controls | System | TRC-DASH | Exceptions assigned to owners | One accepted event per traceability posting; serial has one active location, HU, parent, owner; batch quantity balance | [DOC:p.212 §4.3] (asserted) | none |
| 4 | Produce outputs | not named | TRC-EXPL | none | Backward and forward trace, as-built, recall population, certificate dossier one click per serial | [DOC:p.212 §4.4; p.274] (asserted) | none |

## Handoffs

Fed by FL-02, FL-03, FL-04, FL-05, FL-08, FL-09, FL-10; read by FL-08 for the recall population
[DOC:pp.211-212] (asserted).

## Contradictions this flow touches

K-10 (instrument capture at test, Phase 2 vs 3), K-03 (label types at pack).

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n]` the client's specification, page · `(asserted)` said once by the specification's
author, unverified · **ASM-ID** assumption · **K-nn** a contradiction inside the specification ·
**T01-T13** the document's traceability event codes · **HU** handling unit · **GRN** goods receipt ·
**PGI** post goods issue · **POD** proof of delivery · **SP-nn** scan point.
