# As-is flows - pe-v2 (TENTATIVE)

> **What this is.** We were asked to map how the work happens today. We cannot: the specification
> describes only the future system, and nobody has described the current one. So this folder holds
> the specification's own end-to-end flows, eleven of them, written step by step. Later design work
> and the throwaway prototype use these as the reference. It is for designers and the product owner.
>
> **Where it stands.** First draft, 9 October 2026. Rough on purpose. Nothing here is verified by a
> person beyond the specification itself.
>
> **What we need from you.** The requesting user (subject expert and product owner): nothing now, by
> your instruction. Later, pick one of the three prototype candidates at the bottom, or let the
> orchestrator pick.

## 1. The as-is is absent, and what we did instead

- **Rung used.** Rung 2 of the missing-answer ladder (client evidence in `00-inputs/`: the specification)
  for the flow content, and rung 5 (the assumption register) for the substitution itself. The specification has no section on the current process. The intake
  audit scored that dimension ABSENT [DOC:00-inputs/PRD.md, dimension 7] (asserted). No interviews or
  observation are possible: users are not reachable and the user asked for no questions
  (PROJECT_CONFIG, 2026-10-09).
- **Assumptions.** ASM-ASIS-1 (no as-is mapping; build to-be only) and ASM-ASIS-2 (the specified flows
  stand in as the reference baseline), both in `00-inputs/assumptions.md`.
- **Substitution.** Each file `FL-nn-*.md` writes one specified flow as ordered steps: who acts, on
  which screen, which record changes status, the rule, the money posting, the scan, and the handoff to
  the next flow. Sources: Book III closure flows FL-01 to FL-08 [DOC:pp.176-183] (asserted), Book IV
  flows FL-09 to FL-11 [DOC:pp.206-212] (asserted), and screen entries in Book VI [DOC:pp.245-277]
  (asserted).
- **What this cannot give you.** Waiting time, workarounds, personal spreadsheets, re-keying, and
  who-phones-whom. Those exist only in the real operation. So there is **no pain index** and no
  before-column for any later cost table. A to-be built from these files cannot prove it beats
  today. It can only prove it matches the specification.
- **Step order.** The Book III flows are written as fifteen fields, not as a sequence. We put the
  fields in the order the document's own lifecycles imply. That ordering is a reading (OQ-11). The
  Book V flow pictures that might show the order are images, not text [DOC:pp.228-229] (asserted).

## 2. The flows

| File | Flow | Pages | Main records and status lists | Test range |
|---|---|---|---|---|
| *FL-nn-slug.md* | *name* | *[DOC:p.n]* | *record: count of statuses* | *TC-xxx* |
| FL-01-mts-order-to-cash.md | Make-to-stock order to cash | [DOC:pp.176-177] | Sales order 9 rows, handling unit 4 | TC-O2C-001..060 |
| FL-02-eto-quote-to-cash.md | Engineer-to-order quote to cash | [DOC:p.177] | Quote, sales order, engineering request, EBOM, MBOM, production order | TC-ETO-001..080 |
| FL-03-procure-to-pay.md | Procure to pay | [DOC:p.178] | Requisition, RFQ, vendor, purchase order 9+ | TC-P2P-001..070 |
| FL-04-plan-to-produce.md | Plan to produce | [DOC:pp.178-179] | Planned order, production order 8 rows, rework order 4 | TC-PTP-001..070 |
| FL-05-rma-warranty.md | Returns and warranty | [DOC:pp.179-180] | RMA 11 rows | TC-RMA-001..050 |
| FL-06-period-close.md | Period close | [DOC:pp.180-181] | Fiscal period Open, Soft, Hard | TC-CLS-001..040 |
| FL-07-intercompany.md | Intercompany supply | [DOC:pp.181-182] | Paired sales order and purchase order | TC-ICO-001..030 |
| FL-08-recall-campaign.md | Recall and suspect-batch campaign | [DOC:pp.182-183] | Recall campaign 7 stages | TC-RCL-001..030 |
| FL-09-sales-order-to-delivery.md | Sales order to delivery (consolidated) | [DOC:pp.206-208] | Schedule line 8, delivery 8, proof of delivery 4 | TC-FLA-001..080, TC-O2C-061..070 |
| FL-10-design-to-source.md | Design to source | [DOC:pp.208-210] | Release level 6, long-lead release, supplier package | TC-DTS-001..040 |
| FL-11-traceability-contract.md | End-to-end traceability | [DOC:pp.211-212] | Events T01 to T13 | TC-TRC-001..040 |

## 3. The linkage spine

The document states one chain that every screen either advances, feeds or reports on
[DOC:pp.276-277 §16] (asserted). Each link below names the flow file that carries it.

| This record | Creates next | Money and identity effect | Flow |
|---|---|---|---|
| *Record* | *what it creates* | *posting or identity* | *FL-nn* |
| Lead | Opportunity, then quotation | No money; prospect customer with no credit exposure | FL-02 |
| Quotation | Sales order on win | Prices frozen; estimate linked on ETO | FL-02 |
| Sales order schedule line | Reservation, engineering request, planned order or PR per branch | Credit exposure; the peg everything downstream carries | FL-01, FL-02, FL-09 |
| Engineering request | EBOM, drawings, transmittals | Design approval milestone money on ETO | FL-02, FL-10 |
| Released EBOM | MBOM through transform, production version | Costing invalidation flag | FL-02 |
| MCR | Active material | Valuation class and profit center set before first use | FL-10 |
| PR | RFQ or PO per source policy | Budget check on expense demand | FL-03, FL-10 |
| PO | Vendor confirmation, GRN | Commitment; long-lead exposure when preliminary | FL-03, FL-10 |
| GRN | Inspection, stock, match basis | Stock and GR/IR postings; batch and heat identity born; scans SP-01 to SP-03 | FL-03, FL-11 |
| Production order | Confirmations, genealogy, finished receipt | #28, #29, #30, #31, #32; serial born at release | FL-04 |
| Delivery | Pick, pack, pre-shipment inspection, goods issue | #25, #26, #27; serial to customer at SP-18 | FL-01, FL-09 |
| Invoice request | Invoice, cash application | Revenue and tax per the external accounting volume | FL-01, FL-02 |
| RMA | Receipt, inspection, disposition documents | #17 to #24; serial history continues | FL-05 |
| Recall campaign | Holds, notifications, recall RMAs | Population 100% accounted before closure | FL-08 |

## 4. Prototype candidates

The prototype covers one process end to end in one working day (PROJECT_CONFIG, prototype_timebox 1).
We ranked the flows on three counts taken from the flow files: record types touched, status values
shown, and contradictions K-01 to K-12 (STATE.md) that the flow surfaces. Then we removed any flow
that cannot finish in one build. The ranking is our reading, logged as OQ-12.

| Rank | Flow | Records | Status values | Contradictions | Screens | Why it fits one build |
|---|---|---|---|---|---|---|
| *n* | *FL-nn* | *count* | *count* | *K-ids* | *count* | *one line* |
| 1 | FL-09 sales order to delivery (with FL-01 money steps) | 8 | 33 (sales order 9, schedule line 8, delivery 8, handling unit 4, proof of delivery 4) | K-03, K-05, K-09, K-11 | 5, one module | One module, one queue screen, every status list printed on pp.206-208 |
| 2 | FL-05 returns and warranty | 8 | 18 (RMA 11 rows, 7 disposition and warranty outcomes) | K-03, K-05 | 4 | Self-contained; one eight-step sequence printed on p.21; one status table on p.26 |
| 3 | FL-04 plan to produce | 7 | 18 (production order 8, rework order 4, requisition 6) | K-05, K-09, K-10 | 6 | Spine middle; shop floor terminal is the heaviest screen, so it tests the hardest surface |

Not ranked: FL-02 covers most of the spine but spans more than 12 screens in five modules; it cannot finish in
one day. FL-08 is small but needs seeded genealogy from FL-03, FL-04 and FL-09 to mean anything.

## 5. Possible new contradictions for the orchestrator to log

Found while reading. Not logged as K-rows here (this agent writes only these files).
- Sales order statuses: digest 02 says 8; the table on p.54 has 9 rows (OQ-13).
- FL-09's test pack covers "16 stages" [DOC:p.208] and the cockpit cites "Flow A stage 7"
  [DOC:p.207]; no 16-stage list appears in the text on pp.206-208 (OQ-14).

---

**Key.**
`[DOC:p.n]` the client's own document (PRD2.pdf), with the page ·
`(asserted)` a human said it once, unverified; here the human is the specification's author ·
**ASM-ID** a numbered assumption in `00-inputs/assumptions.md` ·
**OQ-ID** a numbered open question in `10-discovery/open-questions.md` ·
**K-nn** a contradiction inside the specification, listed in STATE.md ·
**#nn** a numbered money-posting template in the specification (Book I Part J) ·
**SP-nn** a numbered scan point (Book I Part F) ·
**pain index** how expensive the current process is to run, counted in manual steps, errors, waiting
time and systems touched; not computable here.
