# Gate 1 agenda - pe-v2 (FL-09 sales order to delivery)

> **What this is.** The agenda for Gate 1. You use the throwaway FL-09 prototype and tell us where it
> is wrong. Each correction is then classified: **Type A** is a screen or wording fix, and **Type B**
> is a rule change, which goes through the requirements document first.
>
> **Where it stands.** The pre-checks are done:
> - The prototype is built at http://localhost:5174.
> - The pre-gate design critique is filed (32 findings, 1 S1). See `pre-gate-1-critique.md`.
> - The conformance snapshot from 2026-10-11 has no blocking findings.
> - Phase 1 was confirmed in writing on 2026-10-09.
>
> **What we need from you.** Answers to sections 2 to 4, in any form: a list, rough notes, or "no
> correction" for an item. Attendance is the domain authority plus the product owner, and both are
> the requesting user. The real users were not reachable, so the SME stands in for them (R-SME-SUB).

## 1. Framing

This build is disposable. It was built to be wrong in a useful way, and nothing in it is confirmed.
A lot of correction means it worked. Very little correction is treated as a warning, and the probes
in section 3 are then run before the gate can pass.

Before you start, one thing to avoid: **Revise** on the quotation screen breaks the walked path
until you press **Scenario reset** (F-09).

S1 declared: you cannot finish the pack station with the keyboard alone (F-01). It is a prototype
defect, and the hi-fi screens carry a rule against it. It is not a domain question.

## 2. The six questions (answer in order; any can be "nothing")

1. Where is the process shown factually wrong or incomplete?
2. Which steps are missing?
3. Which records or relationships are wrong (order, schedule line, delivery, handling unit, POD, invoice request)?
4. Which edge cases would break this?
5. Which words are wrong for how PE Transformer talks?
6. What must be true that is not shown here?

## 3. Probes (edge cases the critique found; each needs a ruling)

| # | What the build does today | Question for you | Ref |
|---|---|---|---|
| P1 | Releasing a delivery to the warehouse does not re-run the credit check. The walked order ships $13,350 over its limit. | Should the check re-run at shipment release, so it blocks again? | F-20, OQ-34 |
| P2 | A POD marked Exception (damage, shortage or refusal) still fires the Delivery/Commissioning billing milestone. | Should an exception POD hold the milestone back? | F-22, OQ-36 |
| P3 | Reversing a goods issue deletes the expected POD, and a re-post reuses the same document numbers. | What should a reversal leave behind? | F-23, OQ-37 |
| P4 | Nothing cancels an order or a delivery before goods issue, and the delivery status list has no Cancelled. | Who can cancel, and up to which status? | F-08, OQ-38 |
| P5 | The $250,000 thresholds compare Canadian dollars as if they were US dollars. | Which currency are the thresholds in? | F-21, OQ-35 |

Quiet-gate probes, run only if sections 2 and 3 produce little correction:
- Complete the job on this build and say where it lies.
- What does this let you do that reality forbids?

## 4. Readings that need a ruling (optional)

`10-discovery/open-questions.md` holds OQ-1 to OQ-43, and OQ-39 to OQ-43 also touch FL-09. If you do
not rule on an item, its reading stays as it is and carries into Phase 2B as an assumption.

---

**Key.** **Type A** a surface fix · **Type B** a rule, status, permission or requirement change ·
**S1** blocker · **F-nn** a finding in `pre-gate-1-critique.md` · **OQ-nn** an open question ·
**POD** proof of delivery · **PGI** post goods issue (shipment) · **R-SME-SUB** the risk that the SME
stands in for real users.
