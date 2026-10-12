# FL-08 Recall and suspect-batch campaign (reference flow, TENTATIVE)

> **What this is.** How the specification says a suspect batch or serial population is found,
> held, notified, recovered and closed with evidence a regulator would accept. It stands in for the
> current process, which nobody has described. The recall campaign is the only new record type Book
> III introduces.
>
> **Where it stands.** First draft, 9 October 2026. Taken from the specification only.
>
> **What we need from you.** Nothing now (your instruction).

**ASSUMPTIONS:** ASM-ASIS-1, ASM-ASIS-2.

| Field | Value |
|---|---|
| Goal | Contain, notify, recover and disposition all product affected by a suspect batch or serial population, with regulator-ready evidence [DOC:p.182 FL-08 f1] (asserted) |
| Trigger | Quality Manager opens a campaign RCL-{YYYY}-{SEQ:3} from a suspect batch or serial (NCR, field failure, supplier notice) [DOC:p.182 f2] (asserted) |
| Owners | Quality Manager; executive approver for external notifications [DOC:p.182 f3] (asserted) |
| Terminal | Population fully accounted, dispositions complete, effectiveness check passed, total-cost report issued, CAPA linked; retained 10 years [DOC:p.182 f12] (asserted) |
| Tests | TC-RCL-001 to 030; an annual recall drill is an operating requirement [DOC:p.183 f15] (asserted) |

## Steps (the campaign's own stages, in the document's order)

| # | Step | Actor | Screen | Record: status change | Rule or threshold | Posting | Scan | Source | Silent |
|---|---|---|---|---|---|---|---|---|---|
| *0* | *one action* | *role* | *screen ID* | *record: from → to* | *rule, with code* | *template #* | *SP-nn* | *[DOC:p.n] (asserted)* | *what is missing* |
| 1 | Open the campaign and derive the population by forward trace | Quality Manager | RCL-001, TRC-EXPL | Campaign: → Identify | Affected serials, customers, sites, in-house stock, WIP, in-transit; under 60 s worst case | none | none | [DOC:p.182 f2, f4, f8; p.183 f14; p.266; p.274] (asserted) | none |
| 2 | Mass-hold all on-hand affected stock | System (bulk job) | RCL-001 | Campaign: Identify → Contain; stock → Blocked | Under 10 min for 10k units; a serial already held is a logged no-op | none | none | [DOC:p.182 f4, f6, f10; p.183 f14] (asserted) | none |
| 3 | Approve and export the customer notification list | Quality Manager plus executive | RCL-001 | Campaign: Contain → Notify | External text dual-approved; export logged as a PII disclosure | none | none | [DOC:p.182 f4, f9, f13] (asserted) | Executive title |
| 4 | Create recall-class RMAs in bulk | System (bulk job) | RCL-001, RMA-LIST/CREATE | Campaign: Notify → Recover; RMAs created | Freight paid by PE per reason code; per-item result log | Through FL-05 templates; costs tagged with campaign ID | SP-19 at receipt | [DOC:p.182 f4, f6, f7, f9; p.266] (asserted) | none |
| 5 | Disposition recovered units | not named | RMA-DISP | Campaign: Recover → Disposition | Per FL-05 | #17 to #23 | none | [DOC:p.182 f4, f7] (asserted) | none |
| 6 | Check effectiveness | Quality Manager | RCL-001 | Campaign: Disposition → Effectiveness → Closed | 100% accounted: recovered, field-corrected or documented exception | Reserve raise proposal if material (Controller) | none | [DOC:p.182 f4, f7, f8, f12] (asserted) | none |

## Exceptions and reversals

| Case | Rule | Source |
|---|---|---|
| *case* | *what happens* | *[DOC:p.n] (asserted)* |
| Customer unreachable | Documented attempts, escalation | [DOC:p.182 f11] (asserted) |
| Partial recovery | Accepted only with Quality Manager plus executive sign-off | [DOC:p.182 f11] (asserted) |
| Scope expands | Population re-derived with a diff; list versioned | [DOC:p.182 f10, f11] (asserted) |

## Handoffs

Reads genealogy built by FL-03, FL-04 and FL-09 (FL-11 events T01 to T12); writes T13; creates
FL-05 RMAs [DOC:p.182 f5, f7; p.211] (asserted).

## Contradictions this flow touches

None directly.

## Not captured

Visibility layer, waits, workarounds, pain index: no current-process evidence (ASM-ASIS-1).

---

**Key.** `[DOC:p.n fN]` the client's specification, page and closure field number · `(asserted)` said
once by the specification's author, unverified · **ASM-ID** assumption · **RMA** return material
authorisation · **CAPA** corrective and preventive action · **PII** personal data · **#nn**
money-posting template · **SP-nn** scan point.
