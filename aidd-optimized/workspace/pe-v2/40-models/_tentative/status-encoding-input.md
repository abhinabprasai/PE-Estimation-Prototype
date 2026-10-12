# TENTATIVE - Status encoding input - pe-v2 (Phase 2A)

> **What this is.** Every distinct status meaning in the transformer ERP, with duplicates merged
> and sorted into seven families (draft, pending approval, active or in progress, blocked or on
> hold, done, cancelled or rejected, exception). The UI designer uses it to sketch status colours
> and badge shapes, so one meaning always looks the same on every screen.
>
> **Where it stands.** TENTATIVE, 9 October 2026, built from `erd-sketch.md` section 3. Nothing is
> confirmed. Never overwritten; the Phase 2B version will be a new file.
>
> **What we need from you.** Nothing now. If a status sits in the wrong family, name its row.

**Sources.** `40-models/_tentative/erd-sketch.md` status catalog S-1 to S-43, which cites each page.
Every row here is `[DOC:p.n]` (the client's specification, with its page) and `(asserted)` (written
down once, not verified by the domain expert). The status names and colours are the specification's.
The sorting into seven families is our working grouping for the colour sketch, not a client rule; it
is carried as OQ-18 in `10-discovery/open-questions.md`.

**Read this first: one word, several meanings.** The same word means different things in different
lifecycles, so it can sit in two families. "Closed" on a handling unit means contents locked and
still moving [DOC:p.31]; "Closed" on a CAPA is the end [DOC:p.88]. "Open" on a requisition means
raised but not yet approved [DOC:p.102]; "Open" on a handling unit means being packed [DOC:p.31].
"Released" on a work order means on the floor and collecting costs [DOC:p.74]; "Released" on an EBOM
means immutable and in force [DOC:p.61]. Encode the meaning, not the word.

**What the specification already says about colour.** Six status colours, "used consistently across
every lifecycle": Draft/neutral gray #6B7280, In progress/review amber #B58221, Blocked/error red
#A33B3B, Active/passed green #3E7D4E, Info/released blue #2E5FA3, Terminal dark green #1F5F3F
[DOC:p.241 §10.1] (asserted). The lifecycle tables also use yellow, purple, teal and dark red, which
are not in that palette [DOC:p.26; p.36; p.54; p.149] (asserted). That clash is K-13 in STATE.md,
recorded and not resolved. The "PRD colours" column below lists what the lifecycle tables say.

**Floor reminder.** Status is never carried by colour alone (GUARDRAILS 11): every badge needs its
text label, and families need a second channel such as icon or shape.

---

## Family 1: Draft (being written, not yet in anyone's queue)

| # | Meaning | PRD names (record) | PRD colours | Source |
|---|---|---|---|---|
| *F1-0* | *Example: editable by its author, invisible to others* | *Draft (material)* | *gray* | *[DOC:p.149] (asserted)* |
| F1-1 | Being edited by its author; not submitted | Draft (quotation, sales order, RMA, EBOM, routing, inspection plan, RFQ, purchase order, vendor onboarding, cost estimate, price list, production version, material); Created (WO, "Draft; editable"); WIP (document) | gray | [DOC:p.51; p.54; p.26; p.61; p.73; p.34; p.103; p.104; p.101; p.119; p.122; p.214; p.149; p.74; p.64] (asserted) |
| F1-2 | Exists as a design idea only; nothing can be bought or built | Concept (design release level) | none given | [DOC:p.208 §3.1] (asserted) |
| F1-3 | Raised and waiting for its first action | Open (purchase requisition, schedule line, rework order); Queued (warehouse task); Planned (delivery); Generated (count document, expected quantities frozen); Expected (POD); Prospect (customer) | gray (Generated) | [DOC:p.102; p.206; p.79; p.215; p.207; p.36; p.49] (asserted) |

## Family 2: Pending approval or review (waiting on someone's decision)

| # | Meaning | PRD names (record) | PRD colours | Source |
|---|---|---|---|---|
| *F2-0* | *Example: locked while a reviewer decides* | *In Review (EBOM)* | *yellow* | *[DOC:p.61] (asserted)* |
| F2-1 | Submitted; system checks or a reviewer pending | Submitted (sales order, counter finished) | yellow (SO), purple (count) | [DOC:p.54; p.36] (asserted) |
| F2-2 | Waiting for an approver in the shared workflow | Pending Approval (RMA, price list); In Approval (requisition, purchase order); Internal Review (quotation) | yellow (RMA, quote) | [DOC:p.26; p.122; p.102; p.104; p.51] (asserted) |
| F2-3 | Locked for review; reviewers comment, then approve or reject | In Review (EBOM, document, inspection plan, routing); Under Review (vendor onboarding); Customer Review (engineering request) | yellow | [DOC:p.61; p.64; p.34; p.73; p.101; p.59] (asserted) |
| F2-4 | Waiting for missing input from several parties | Docs Pending (vendor onboarding); Data Completion (material, departments completing views) | yellow (material) | [DOC:p.101; p.149] (asserted) |
| F2-5 | A supervisor or authorised role must decide on results | Variance Review (count document); Disposition Pending (RMA) | amber | [DOC:p.36; p.26] (asserted) |
| F2-6 | Approved; ready for the next step but not yet acted on | Approved (requisition, purchase order, count document "ready to post"); Authorized (RMA, waiting for the goods) | green (count), blue (RMA) | [DOC:p.102; p.104; p.36; p.26] (asserted) |

## Family 3: Active or in progress (in force, or work under way)

| # | Meaning | PRD names (record) | PRD colours | Source |
|---|---|---|---|---|
| *F3-0* | *Example: in force and usable* | *Active (material)* | *green* | *[DOC:p.149] (asserted)* |
| F3-1 | In force and usable; the current version | Active (material, inspection plan, MBOM, price list, vendor onboarding, customer, cost/profit center, work center); Released (EBOM, document, routing, cost estimate, production version); Released for Production; In Cal (instrument); Qualified (AVL); Approved (vendor quality); Unrestricted (stock); Available (serial) | green; blue for "Info/released" in the palette | [DOC:p.149; p.34; p.66; p.122; p.101; p.49; p.111; p.71; p.61; p.64; p.73; p.119; p.214; p.209; p.90; p.84] (asserted) |
| F3-2 | Partly released for a limited purpose | Preliminary / RFQ Package (quotes only); Long-Lead Purchase Release (LLR); Approved for Purchase | none given | [DOC:pp.208-209 §3.1] (asserted) |
| F3-3 | Sent out and committed with the other party | Issued (quotation, RFQ); Sent (PO); Confirmed (sales order "contract in force", PO, schedule line); Acknowledged (STP) | blue (quote, SO) | [DOC:p.51; p.103; p.104; p.54; p.206; p.209] (asserted) |
| F3-4 | Work under way on the shop floor or in a team | In Progress (WO, rework order, warehouse task); In Fulfillment (SO); In Design (engineering request); In Engineering / In Production (SO line); In Production (serial); Testing (WO); In Inspection (RMA); Counting; Recount; Assigned (count document, warehouse task); Analysis / Actions In Progress / Implemented / Effectiveness Check (CAPA); Contain / Notify / Recover / Disposition / Effectiveness (recall); Responses In (RFQ); Settling (RMA, system executing outcomes) | purple (WO, SO, RMA), amber (Testing, Recount, Settling), yellow (Counting), blue (Assigned) | [DOC:pp.74-75; p.79; p.215; p.54; p.59; p.53; p.95; p.26; p.36; p.88; p.182; p.103] (asserted) |
| F3-5 | Logistics steps before goods leave | Released / Picking / Packed / Quality Cleared / Loaded (delivery); Ready to Ship (SO line); Allocated/Pegged / Delivery Due (schedule line); Reserved / Picked (serial); Open / Closed / Loaded (handling unit: packing, then contents locked, then on a shipment) | none given | [DOC:p.207; p.53; p.206; p.95; p.31] (asserted) |
| F3-6 | Partly done; remainder still open | Partially Received (RMA, PO); Partially Shipped (SO, SO line); Partially Delivered (schedule line); Partial (PO line) | teal (RMA, SO) | [DOC:p.26; p.104; p.54; p.53; p.206] (asserted) |
| F3-7 | Physically done; a closing step (settlement, billing, inspection) still pending | Received (RMA, PO, PO line, POD); Shipped (SO, SO line, serial); PGI (delivery); Completed (WO "awaiting settlement", rework order); Delivered (schedule line) | purple (RMA Received), green (SO Shipped, WO Completed) | [DOC:p.26; p.104; p.207; p.54; p.53; p.95; pp.74-75; p.79; p.206] (asserted) |
| F3-8 | Period closing; postings still allowed with a warning | Soft Close (finance); Closing (inventory label) | none given | [DOC:p.41 §9.1; p.42 §9.5] (asserted) |
| F3-9 | Unit in the customer's hands | Shipped / Installed / In Service (installed base) | none given | [DOC:p.215 §7.4] (asserted) |

## Family 4: Blocked or on hold (stopped until someone acts)

| # | Meaning | PRD names (record) | PRD colours | Source |
|---|---|---|---|---|
| *F4-0* | *Example: stopped pending Finance release* | *Credit Hold (sales order)* | *red* | *[DOC:p.54] (asserted)* |
| F4-1 | Fully stopped; reason recorded | Credit Hold (SO); On Hold (WO, customer); Blocked (material, engineering request, customer, cost/profit center, stock) | red | [DOC:p.54; p.75; p.49; p.149; p.59; p.111; p.84] (asserted) |
| F4-2 | Partly restricted: existing work finishes, new use blocked or needs override | Restricted (material use-up; vendor quality); Conditional (vendor quality; AVL, first article pending); Suspended (AVL); Maintenance (work center, blocks new dispatch) | amber (material) | [DOC:p.149; p.101; p.71] (asserted) |
| F4-3 | Stock held for quality | QI Hold (stock, serial); Quarantine (stock) | none given | [DOC:p.84; p.85; p.95] (asserted) |
| F4-4 | One document family blocked on an otherwise usable record (chip, not a status) | Purchasing Block, Sales Block, Production Block, Shipping Block, Posting Block (material) | none given | [DOC:p.151 §4.5] (asserted) |
| F4-5 | Change in progress over a live document (overlay) | Change Pending (PO) | none given | [DOC:p.104] (asserted) |
| F4-6 | Instrument due or past due; inspections at risk or blocked | Due Soon (amber), Overdue (red), Out of Service (instrument) | amber, red | [DOC:p.90] (asserted) |

## Family 5: Done (finished, or retired from use)

| # | Meaning | PRD names (record) | PRD colours | Source |
|---|---|---|---|---|
| *F5-0* | *Example: all billing posted; terminal* | *Invoiced / Closed (sales order)* | *dark green* | *[DOC:p.54] (asserted)* |
| F5-1 | Finished; books settled; locked | Invoiced / Closed (SO); Invoiced, Closed (SO line); Closed (TECO) (WO); Posted (count document); Closed (RMA, CAPA, engineering request, recall, schedule line, PO line); Settled (rework order); Matched/Closed (PO); Delivered/Closed (delivery); Resolved/Closed (POD); Done (warehouse task) | dark green (SO, WO, count), green (RMA) | [DOC:p.54; p.53; p.75; p.36; p.26; p.88; p.59; p.182; p.206; p.104; p.79; p.207; p.215] (asserted) |
| F5-2 | Won; outcome reached and handed on | Won (quotation); Converted (requisition, PO link); Awarded (RFQ) | green (Won) | [DOC:p.51; p.102; p.103] (asserted) |
| F5-3 | Period closed to posting | Hard Close, Year-End Closed (finance); Closed (inventory label) | none given | [DOC:p.41 §9.1] (asserted) |
| F5-4 | Replaced by a newer version; kept for history | Superseded (quotation, EBOM, document, inspection plan, MBOM, routing, cost estimate, production version, design release level) | blue (EBOM, document, inspection plan) | [DOC:p.51; p.61; p.64; p.34; p.66; p.73; p.119; p.214; p.209] (asserted) |
| F5-5 | Retired from use; kept for history | Obsolete (EBOM, document, inspection plan, material, production version, release level); Archived (price list); Inactive (customer, cost/profit center, work center) | red (EBOM, document, inspection plan), dark red (material) | [DOC:p.61; p.64; p.34; p.149; p.214; p.209; p.122; p.49; p.111; p.71] (asserted) |
| F5-6 | Lapsed without an outcome | Expired (quotation) | gray | [DOC:p.51] (asserted) |
| F5-7 | Unit's service life ended | Returned, Scrapped (installed base) | none given | [DOC:p.215 §7.4] (asserted) |

## Family 6: Cancelled or rejected (stopped for good)

| # | Meaning | PRD names (record) | PRD colours | Source |
|---|---|---|---|---|
| *F6-0* | *Example: stopped before completion; terminal* | *Cancelled (WO)* | *red* | *[DOC:p.75] (asserted)* |
| F6-1 | Cancelled before completion | Cancelled (SO, SO line, WO, RMA, requisition, RFQ, PO, PO line, schedule line) | red (SO, WO, RMA) | [DOC:p.54; p.53; p.75; p.26; p.102; p.103; p.104; p.206] (asserted) |
| F6-2 | Turned down by an approver or the other party | Rejected (RMA, requisition, STP acknowledgement; named as an SO exit); Lost (quotation, with reason); Disqualified (vendor, hard-blocks POs) | red (RMA, quote) | [DOC:p.26; p.102; p.209; p.54; p.51; p.101] (asserted) |
| F6-3 | Voided before work started, reason mandatory | Void (count document) | red | [DOC:p.36] (asserted) |
| F6-4 | Remainder cancelled, rest kept | Closed Short (RMA, supervisor; named only in transitions, K-14) | none given | [DOC:p.26 §3.8-3.9] (asserted) |
| F6-5 | Physically removed (only from Draft with zero references) | Deleted (material; named only in transitions, K-16) | none given | [DOC:p.149] (asserted) |

## Family 7: Exception (needs attention outside the normal path)

| # | Meaning | PRD names (record) | PRD colours | Source |
|---|---|---|---|---|
| *F7-0* | *Example: a step failed and needs resolution* | *Exception (POD)* | *none given* | *[DOC:p.207] (asserted)* |
| F7-1 | Normal path failed; resolution needed | Exception (POD, warehouse task, STP acknowledgement "deviation raised") | none given | [DOC:p.207; p.215; p.209] (asserted) |
| F7-2 | Reopened after being finished | Reopened (RMA, Controller, 30 days; CAPA, failed effectiveness check) | none given | [DOC:p.26; p.88] (asserted) |
| F7-3 | Line flags that force a check | Recount Required, Moved During Count (count line); Unverified Serial (RMA line); Shortage badge (WO released short) | none given | [DOC:p.36; p.26; p.74] (asserted) |
| F7-4 | Warranty decision on a return | Yes (amber), No (gray), Approved (green), Denied (red) (warranty claim badge) | amber, gray, green, red | [DOC:p.22 §3.3] (asserted) |

---

## Totals

7 families, 40 distinct meanings (F1-1 to F7-4, examples excluded), drawn from 43 status lists
[DOC: see erd-sketch.md S-1 to S-43] (asserted).

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`(asserted)` written down once, not verified by the domain authority.
**TENTATIVE** a Phase 2A sketch meant to be corrected; never overwritten.
**K-nn** a row in `STATE.md > Open contradictions` · **OQ-nn** a row in `10-discovery/open-questions.md` ·
**F n-n** a status meaning row in this file · **S-n** a status list in `erd-sketch.md`.
**Overlay / chip** a marker shown beside the main status, not replacing it.
