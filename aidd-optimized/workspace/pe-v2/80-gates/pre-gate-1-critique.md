# Design Critique Report: FL-09 throwaway prototype, pre-Gate 1, 2026-10-11

> **What this is.** Our own review of the throwaway sales-order-to-delivery prototype, done before the requesting user sees it at Gate 1. It checks four things only: whether each screen makes its main job obvious, whether every state a record can reach is handled, where the walked task stalls or misleads, and where the screens disagree with the specification. It does not judge looks; the build is meant to be rough.
>
> **Where it stands.** First run, 11 October 2026, read from the source code. 32 findings: 1 blocker (outside the four checks, see F-01), 13 major, 15 minor, 3 predictions for a user session.
>
> **What we need from you.** Nothing from the client. The gate facilitator should open Gate 1 by declaring F-01, and use the five probes listed at the end as the first questions to the domain authority.

| Field | Value |
|---|---|
| *Run for* | *pre-Gate 1* |
| Run for | pre-Gate 1 |
| Lenses run | 1 hierarchy, 3 state completeness, 6 flow friction, 7 domain fidelity. Lenses 2, 4 and 5 not run (they belong to Gates 2 and 3; the build is deliberately rough) |
| Scope | `50-prototype/app/src/` (pages/Quotations, Orders, Approvals, Deliveries, Packing, Pod; data/model.ts, seed.ts, store.tsx; components/common.tsx; App.tsx), `50-prototype/prompt-used.md` v1, `50-prototype/build-notes.md` v1 |
| Rules judged against | prompt-used.md part 4 rules R-1 to R-24 and part 3 status lists; `40-models/_tentative/erd-sketch.md` status catalog S-1 to S-8 and consequences C-10 to C-13, C-51, C-55; `40-models/as-is/FL-09-sales-order-to-delivery.md`; `20-research/client/2026-10-09-prd2-flow-cards.md` FL-01 and FL-09 cards; `30-design-language/skills-md/layout.md` L-4; STATE.md open contradictions K-01 to K-19. No style-guide.md, erd.md or refined-requirements.md exists yet. No flow-optimization cost tables exist (lite mode drops them), so lens 6 stands on the walked task, not on counts |
| Run by | design-critic (solo pass, source reading; the dev server was not used) |
| Attendees (if a session) | none, solo pass |

**Read this first.** Every rule above is (asserted): the specification says it, and nobody has confirmed it on record (risk R-NO-DD in STATE.md). So no finding below is a blocker on rule grounds alone. Domain findings are marked as questions for the domain authority, because the prototype exists to provoke exactly those corrections.

## Findings

Lens order: 1, 3, 6, 7. F-01 sits first because it is the only blocker.

| # | Lens | Location | What, and the rule or evidence | Severity | Type | Gate 1 question? | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| *F-00* | *7* | */sales/orders/:id* | *Example: a Delete control on an Invoiced/Closed order. Violates C-55 (terminal records read-only) [DOC:p.242 §10.2-10.3]* | *S2* | *B* | *yes* | *requirements-reconciler* | *open* |
| F-01 | 4 (found incidentally; lens not in the Gate 1 set) | /sales/packing/station/:id | The scan field pulls focus back on every blur (`Packing.tsx:230`, `:119`). A keyboard user who tabs to Create HU, Use next reading, Close HU or Complete pack order is returned to the field at once, so the pack task cannot be finished without a pointer. Breaks the floor "every task is completable by keyboard alone" (GUARDRAILS 11). Build-notes names the mechanism ("focus lock works by refocusing on blur") but not the consequence | S1 | A | no | prototype-engineer (declare); ui-designer (rule for hi-fi) | open, declared |
| F-02 | 1 | Every detail header: OM-QT-002, OM-SO-002, delivery side panel, OM-POD-002 | The lifecycle strip draws each status list as one straight chain (`model.ts:44-54`, `common.tsx:54-66`). It shows Credit Hold as a step every order passes, Cancelled and Rejected after Invoiced/Closed, Won › Lost › Expired › Superseded, and Received › Exception. The status catalog says these are branches and exits (erd-sketch S-2, S-3, S-5, S-7). A reader will correct the wrong thing ("why does Received lead to Exception?"). Recurring on 4 surfaces | S2 | A | partly: use the strip as a probe ("draw the real branches") | ui-designer (rule) | open |
| F-03 | 1 | /approvals | Each row carries a filled Release or Approve button beside other actions, so a full queue shows many primaries. Violates L-4 (one filled primary per view, `layout.md:72`). Already listed in build-notes "left rough on purpose" | S3 | A | no | prototype-engineer | open, known |
| F-04 | 1 | /sales/deliveries | Prediction: a shipping clerk looking for the delivery that is blocking goods issue will not find DLV-TBD-0083 (Loaded, documents flag missing) within 10 seconds. Eight columns at 224 px (`Deliveries.tsx:56-60`) put Loaded, PGI and Delivered/Closed beyond a 1280 px screen, and every Planned card also reads "Not passed: credit, quality, documents" (`Deliveries.tsx:84`; flags set at creation, `store.tsx:404`), so "Not passed" stops meaning "blocked" | SC | A | no | design-critic (predictor); next usability round | open |
| F-05 | 1 | /sales/orders/:id | Prediction: after Finance releases the hold, a sales admin will read "credit: not passed" on the order and conclude the hold is still on. With no delivery yet, the order shows all four readiness flags as not passed (`Orders.tsx:367-374`), although the order is Confirmed and credit-released | SC | A | no | design-critic (predictor); next usability round | open |
| F-06 | 3 | /approvals | Finance Reject sets the order, every line and every schedule line to Cancelled in one click (`Approvals.tsx:106`, `store.tsx:252-265`). Sales Director Reject sets Rejected in one click (`Approvals.tsx:129`, `store.tsx:286-290`). Both are terminal; neither warns, confirms or asks for a reason. Skill lens 3: the user must learn a transition is irreversible before triggering it | S2 | B | yes: is a reason mandatory on reject, and is Cancelled right for a Finance reject (OQ-28)? | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-07 | 3 | /sales/pod/:id | The three claim buttons say "Create credit memo request (ACC)", "Create redelivery", "Create repair (RMA path)". Each one immediately sets the POD to Resolved/Closed and the delivery to Delivered/Closed (`Pod.tsx:241-253`, `store.tsx:653-663`). The label promises a request; the effect closes two records with no warning. Build-notes D-9 | S2 | B | yes: is a claim resolved when a path is chosen, or when the credit memo, redelivery or repair completes? (OQ-36) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-08 | 3, 7 | OM-SO-002, OM-DLV-001 | No control anywhere cancels a sales order, schedule line or delivery before goods issue. Cancelled is reachable only through a Finance reject. The delivery status list has no Cancelled value (`model.ts:50`; erd-sketch S-6). The FL-01 card says "cancel before PGI releases reservation" [DOC:pp.176-177] (asserted). If the answer needs a delivery status the list lacks, that is escalation 9.11 | S2 | B | yes (OQ-38) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-09 | 3, 6 | /sales/quotations/QT-TBD-0412-V2 | Revise sits next to Record win on the first screen of the walked path. One click supersedes V2 and creates V3 in Draft (`store.tsx:136-147`). Draft and Internal Review quotations have no actions at all (`Quotations.tsx:113-155`), so V3 cannot be issued and V2 can no longer be won. The walked path is then impossible until Scenario reset. No confirmation names this | S2 | A | no | prototype-engineer; gate facilitator (warn at session start) | open |
| F-10 | 3, 6 | /sales/pod/:id | Record POD defaults to condition "No damage" and today's date (`Pod.tsx:117`) and submits with no confirmation (`Pod.tsx:224`). The action fires the Delivery/Commissioning milestone, which may fire only once, and closes the delivery (`store.tsx:636-644`). Neither can be undone in the build | S2 | B | yes: who may record POD, and can a wrong POD be corrected? | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-11 | 3 | OM-DLV-001 PGI confirmation | The goods issue dialog shows the posting preview but not the reversal window: Shipping Manager only, same fiscal period, before invoice (R-16, C-51). The user learns the limit only after posting (`Deliveries.tsx:432-463`) | S3 | A | no | prototype-engineer | open |
| F-12 | 3 | /sales/packing, /approvals | Two empty states say the wrong thing. Packing filtered to WH-TBD-03 shows "No completed picklists" instead of a filtered-to-nothing message (`Packing.tsx:38`). The inbox tells a Packer or Sales rep "Nothing waiting for you", which reads as an empty queue, not as "your role never approves" (`Approvals.tsx:58-59`) | S3 | A | no | prototype-engineer | open |
| F-13 | 3 | /approvals | A credit release item belongs to both Finance (credit) and Controller (`store.tsx:739`). Whoever acts first decides it; the other role sees no sign that someone is acting. Concurrency is unhandled | S3 | B | yes: one shared item, or one per role? (OQ-33) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-14 | 3 | All lists and details | Loading shows only on the first visit to a list (`common.tsx:108-121`). No list or detail has a load-error or refresh state. Expected in a throwaway; recorded so the Phase 3 state table covers it | S3 | A | no | hifi-spec-designer (state table) | open |
| F-15 | 6 | /approvals | Finance decides a credit release from a row showing only amount and a reason sentence (`Approvals.tsx:82-98`). Limit, exposure, available credit, past-due status and risk class are on the order page (`Orders.tsx:117-160`), one navigation away. Skill lens 6: a decision made without the information needed on this screen | S2 | A | no | ux-architect (2B) | open |
| F-16 | 6 | OM-SO-002 ATP partial dialog | Prediction: most reviewers will press Apply without reading the three options, because "Split line" is preselected (`Orders.tsx:227`). The choice the rule leaves to the user (R-9) is made for them | SC | A | no | design-critic (predictor); next usability round | open |
| F-17 | 6 | /sales/packing/station/:id, delivery side panel | Context is not carried. After Complete pack order the station stays put, and the next step (inspection) needs the cockpit with the delivery reopened by hand (`Packing.tsx:334`). Load plan edits live in local state and are lost if the panel closes before Save (`Deliveries.tsx:129-138`, `:302-322`) | S3 | A | no | ux-architect (2B) | open |
| F-18 | 6, 7 | /approvals Raise limit | The new limit is prefilled at the current limit plus $50,000 (`Approvals.tsx:117`), an invented default. No reason is captured for the raise | S3 | B | yes: is a justification required to raise a limit? | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-19 | 6 | Walked path, steps 9 to 11 | Two steps that gate goods issue are easy to miss. The documents flag passes only after the outline "Save load plan" (`store.tsx:543`). PGI with PE-paid freight unrecorded posts #26 at $0.00 rather than blocking (`store.tsx:98`) | S3 | B | yes: should PGI wait for quoted freight on PE-paid terms? | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-20 | 7 | OM-DLV-001 Release to warehouse | The shipment-release credit gate checks only the hold status and the manual flag (`store.tsx:423-433`). It does not re-run "exposure + order value ≤ limit". The walked order ships with available credit at −$13,350.00. R-1 calls shipment release "the final gate" [DOC:p.49 §2.2] (asserted). Build-notes D-3 | S2 | B | yes (OQ-34) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-21 | 7 | /sales/orders/new, /approvals | The $250,000 threshold compares the raw amount in any currency (`store.tsx:221`, `Approvals.tsx:80`). CA$312,480.00 on SO-2026-00405 raises a Sales Director item and removes Delegate, though it is under US$250,000 at the build's own rate. R-4 and R-5 [DOC:pp.10-11 §W; p.52 §4.1] (asserted). Build-notes D-16 | S2 | B | yes (OQ-35) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-22 | 7 | /sales/pod/:id | The Delivery/Commissioning milestone fires on any POD record, including Exception for damage, shortage or refusal (`store.tsx:636-639`). R-20 says POD or site acceptance fires it [DOC:p.207 §2.4] (asserted). Whether a refused delivery triggers billing is a money question the build has answered silently | S2 | B | yes (OQ-36) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-23 | 7 | OM-DLV-001 Reverse PGI | Reversal deletes the Expected POD row (`store.tsx:621`; `Pod.tsx:120` admits it). A re-post reuses the same PGI document number and POD number (`store.tsx:574-577`, `:590-593`). Removing a record and reusing a posted document number is the reversed-not-deleted case lens 7 exists for. The build also leaves the delivery at Packed with HUs at Loaded and the quality flag still passed (`store.tsx:609-626`), so a packing error cannot be fixed (HU reopen stops at Loaded, R-17). Build-notes D-8 | S2 | B | yes (OQ-37) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-24 | 7 | OM-SO-002 ATP, OM-DLV-001 delivery creation | The customer "no partial" flag is never read (only `seed.ts:40`, `model.ts:137`). ATP offers Split to every customer (`store.tsx:299-351`). Delivery creation never evaluates the mandatory splits (ship-to, Incoterms, hazmat, over-dimensional, no partial), and labels a delivery "Split, elective: schedules more than 7 days apart" whenever any later schedule exists, without checking 7 days (`store.tsx:377-419`, `:393`). R-11 [DOC:p.207 §2.3] (asserted) | S2 | B | yes (OQ-40) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-25 | 7 | /sales/pod/:id | A shortage or refusal claim changes nothing on the schedule line or order: delivered quantity stays full, open quantity stays 0, the order stays Shipped (`store.tsx:646-651`). Reality would leave units owed or returning | S2 | B | yes (OQ-39) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-26 | 7 | Delivery side panel, OM-SO-002 | Readiness flags are binary, "passed" or "not passed" (`model.ts:223`). That merges not-yet-checked with failed. The specification names the four flags but not their values [DOC:p.207 §2.4] (asserted) | S3 | B | yes (OQ-41) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-27 | 7 | OM-SO-002 credit panel | Test 1 fails whenever the manual credit hold flag is set, even when the arithmetic passes (`store.tsx:69`, `Orders.tsx:149`); the catalog treats the flag as separate (erd-sketch S-1). Exposure includes orders sitting on Credit Hold (`store.tsx:725`; build-notes D-17) | S3 | B | yes (OQ-43) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-28 | 7 | /sales/orders/new, OM-SO-002 | CAD direct-entry prices are the USD list price × 1.36, and the booked rate "1.3600 CAD per USD" is fixed (`store.tsx:170`, `:707`). Neither carries a reading flag, unlike every other invented value | S3 | B | yes (OQ-42) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-29 | 7 | /sales/pod/:id, PGI dialog | Money labels ignore the order currency. The claim field says "or value (USD)" for CAD customers (`Pod.tsx:214`). The #26 freight preview formats in USD (`Deliveries.tsx:447`) while the panel shows the same freight in CAD (`Deliveries.tsx:333`) | S3 | A | no | prototype-engineer; ui-designer (rule) | open |
| F-30 | 7 | OM-DLV-001 | Release to warehouse, Confirm pick, Pass inspection and Post goods issue are open to every role, including Sales rep (`Deliveries.tsx:238-245`, `:389`; build-notes D-18). No role-by-action matrix exists (ASM-PERM-1). R-12 says the shipment-release gate cannot be bypassed by sales roles [DOC:p.49 §2.2] (asserted) | S3 | B | yes: which roles may release, pick-confirm, pass inspection and post goods issue? | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-31 | 7 | OM-SO-002 after conversion | The credit check at conversion fails on the walked order, yet the order stays Draft, and the panel shows "failed" on a Draft order (`store.tsx:187-195`). Build-notes D-2, already Reading OQ-32 | S3 | B | yes (OQ-32) | requirements-reconciler via Gate 1 | routed to Gate 1 |
| F-32 | 3, 7 | OM-SO-002 schedule 20 | The backordered schedule line ends at Confirmed with no way forward: nothing moves Confirmed to Allocated/Pegged once stock arrives (`store.tsx:307` acts only on Open lines). Expected, because OM-BO is out of scope (R-21). Release also sets every Open line to Ready to Ship, including lines with no schedule on the delivery (`store.tsx:438`) | S3 | B | yes: who allocates a backorder when stock lands, and what triggers it? (OQ-32) | requirements-reconciler via Gate 1 | routed to Gate 1 |

Severity: **S1** blocker (violates a confirmed rule, breaks the accessibility floor, or makes the
task impossible) · **S2** major (materially harms the task) · **S3** minor (inconsistency with a
stated rule) · **SC** a craft prediction for the next user session, not a fix · **S4** note (a
preference; recorded and dropped). None this run.

Type: **A** touches a screen, drawing, wording or layout · **B** touches a rule, entity, status,
permission or requirement and routes to requirements-reconciler BEFORE any edit. When unsure, B.
No refined requirements document exists yet, so every Type B goes to Gate 1 as a question first.

**Gate 1 question?** "yes" means the finding is a question for the domain authority, not a build
defect. The build did what its prompt said; the prompt may be wrong.

## Perceptual and accessibility tests

| Test | Run on | Result | By | Date |
|---|---|---|---|---|
| *Squint test* | *OM-DLV-001* | *primary still obvious* | *design-critic* | *2026-10-11* |
| Squint test | none | not run: source reading only, by instruction | design-critic | 2026-10-11 |
| Five-second test | none | not run: needs rendered screens and three observers | design-critic | 2026-10-11 |
| Greyscale / colour-blindness simulation | none | not run: lens 4 is not in the Gate 1 set | design-critic | 2026-10-11 |
| Keyboard-only pass | none | not run as a pass. F-01 was found by reading the code, not by walking it | design-critic | 2026-10-11 |
| Zoom 200% and 400% reflow | none | not run: lens 4 not in set; fixed 1280 px build | design-critic | 2026-10-11 |
| Screen reader pass | none | not run: lens 4 not in set | design-critic | 2026-10-11 |
| Automated scan | none | not run | design-critic | 2026-10-11 |

An automated scan result is never reported as an accessibility assessment. A test not run is
recorded as not run.

## Recurring findings

The same finding on three or more surfaces is a rule problem, not three mistakes. These are for
Phase 2B, not for the throwaway.

| Finding | Occurrences | Proposed rule change | File |
|---|---|---|---|
| *status badge uses colour only* | *11 screens* | *every status carries a word as well as a colour* | *skills-md/color.md* |
| Lifecycle strip drawn as one straight line (F-02) | 4 detail headers | A lifecycle strip shows the main path, then lists exits and branches apart from it. No exit status is drawn after a terminal status | component state rules (ui-designer, 2B) |
| One-click actions into a terminal status, a posting or a milestone (F-06, F-07, F-09, F-10, plus Record win and Convert at `Quotations.tsx:117-152`) | 7 controls on 3 screens | Any action that ends a record, posts, or fires a milestone names the object and the consequence before it runs, and asks for a reason where the specification requires one | content and form rules (ui-designer, prompt-spec-writer, 2B) |
| Money without its currency (F-21, F-28, F-29) | 4 places | Every amount shows its currency; every threshold states the currency it is measured in | `skills-md/type.md` numerals section (ui-designer) |
| Focus pulled back on blur (F-01) | 1 surface, but it is the kiosk pattern | Scan focus returns only after a scan or a dismiss, never on blur; every kiosk control is reachable by Tab | `skills-md/a11y.md` (ui-designer) |

## Open S1 findings entering the gate

Declared in the gate's first two minutes.

| # | Finding | Why unfixed | Owner | Date due |
|---|---|---|---|---|
| *1* | *focus ring invisible on the dark surface* | *needs a token change that repaints six screens* | *ui-designer* | *2026-04-05* |
| F-01 | Pack station cannot be completed by keyboard alone (focus returns to the scan field on every blur) | This critique fixes nothing by instruction. The prototype is archived after Gate 1 and hi-fi never starts from it (GUARDRAILS 4), so the fix that matters is the a11y.md rule above. If the reviewer drives the station by keyboard at the gate, use the mouse | prototype-engineer (declare at gate); ui-designer (rule) | Gate 1 |

## Quiet-result check

Not quiet: 32 findings, 3 of them predictions. Probes run: "what does this let someone do that
reality forbids?" (found F-08, F-20, F-23, F-24); "which state is named but never reachable?" (found
F-08, F-32); "which irreversible step gives no warning?" (found F-06, F-07, F-09, F-10). Lens 6
could not compare against the current process, because the current process is not described
(ASM-ASIS-1); that is a limit of this run, not a pass.

## Probes for Gate 1, in order

Ask one at a time. Each is a Type B question; any correction goes to requirements-reconciler.

1. **Shipment-release credit gate (F-20, OQ-34).** "This order shipped while the customer was $13,350 over limit, because Finance had released the hold. Is that right, or does release to warehouse re-run the check?"
2. **Milestone on a refused delivery (F-22, OQ-36).** "The customer refused the transformer, and the Delivery milestone fired anyway. Should a refusal or damage POD fire it?"
3. **Reversing goods issue (F-23, OQ-37).** "After a reversal the expected POD row disappears, and re-posting reuses the same document numbers. What should the record trail look like?"
4. **Cancelling before goods issue (F-08, OQ-38).** "There is no way to cancel an order or a delivery here. Who cancels, at which statuses, and what status does the delivery take?"
5. **The $250,000 line in Canadian dollars (F-21, OQ-35).** "CA$312,480 went to the Sales Director. In US dollars it is under $250,000. Which currency is the threshold in?"

---

**Key.**
`[DOC:p.n]` the client's own specification (PRD2), with page and section ·
`(asserted)` a human said it once, unverified (here: the specification) ·
`(confirmed)` the domain authority verified it, on record; nothing here is.

**Type A** a surface fix: a screen, wording, layout ·
**Type B** a rule change: a rule, a record type, a status, a permission, a requirement.
Type B goes through the requirements document before anything is redrawn.

**S1** blocker · **S2** major, harms the task · **S3** minor · **SC** a craft judgment stated as
a prediction, which goes to the next user session rather than to a fix · **S4** a preference,
recorded and dropped.

**R-n** a rule row in part 4 of `prompt-used.md` · **D-n** a build delta in `build-notes.md` ·
**S-n / C-n** a status list / consequence row in `erd-sketch.md` · **L-4** the one-primary-button
rule in `skills-md/layout.md` · **K-nn** a contradiction in `STATE.md` · **OQ-nn** a model reading
in `10-discovery/open-questions.md` · **ASM-ID** an assumption in `00-inputs/assumptions.md` ·
**R-NO-DD** the STATE.md risk that no domain-authority call was held.
**PGI** post goods issue · **POD** proof of delivery · **HU** handling unit · **ATP** available to
promise · **CAD / USD** Canadian / US dollars.
