# Prototype Prompt: prototype-FL-09 (sales order to delivery)

> **What this is.** The brief for the throwaway prototype of one sales order travelling from a won quotation to proof of delivery at PE Transformer. It tells the builder which screens to make, which records and statuses they must show, which rules they must obey, what data to load and what to leave out. It is meant to make the prototype wrong in useful ways at Gate 1, not to look finished.
>
> **Where it stands.** Version 1, 9 October 2026. Not yet built or probed by the prototype engineer. Built from the knowledge base only; nothing in it is confirmed by the domain authority.
>
> **What we need from you.** Nothing now. At Gate 1, the requesting user is asked to correct the screens, statuses and the sides this build takes on eight known contradictions (listed after part 6).

Version: 1 · Author: prompt-spec-writer · Date: 2026-10-09 · Status: draft
Target process: FL-09 sales order to delivery, chosen because it carries the most Phase 1 contradictions and the most status values of any flow (STATE.md > Prototype; 40-models/as-is/README.md)
Timebox: 1 working day, declared in STATE.md on 2026-10-09 before generation. If the build runs past the day, stop and report (GUARDRAILS 4).
Stack: React + TypeScript + Vite + Tailwind v4 + shadcn/ui, in-memory mock data, no backend, no auth (PROJECT_CONFIG > Delivery stack).

**ASSUMPTIONS this prompt rests on:** ASM-EXT-1 (the invoice, credit note, journal, serial and fiscal period records belong to volumes not supplied, so they appear as links or read-only text only), ASM-PERM-1 (no role-by-action matrix exists; only the separations of duty the PRD states are enforced), ASM-DEVICE-1 (office desktop for sales, finance and shipping office; kiosk for packing), ASM-ASIS-2 (the PRD's reference flow stands in for the absent current process). Model readings used by this build are open questions OQ-28 to OQ-33 in `10-discovery/open-questions.md`; each one is shown in the UI as a small "Reading OQ-nn" flag where it applies.

---

## 1 Context

PE Transformer builds and sells power and distribution transformers to US and Canadian utilities, contractors and industrial buyers [DOC:cover; pp.45-46 §11] (asserted). FL-09 is the single execution design for getting a confirmed sales order to the customer across stocked (MTS), made-to-order (MTO) and engineered (ETO) orders: schedule lines, deterministic delivery split and merge, allocation and backorder, carrier and proof-of-delivery closure, and controlled reversal of post goods issue [DOC:p.206 §2] (asserted). It extends the commercial path of FL-01 (quote, order, credit check) and hands the invoice request to Finance [DOC:pp.176-177; p.206] (asserted). The people on this path are the sales admin and customer service on the order, Finance on credit release, the Sales Director on large no-quote orders, the shipping office in the delivery cockpit, packers at a kiosk pack station, and the Shipping Manager for reversals [DOC:p.52 §4.1; p.49 §2.2; p.208 §2.5; pp.250-252] (asserted).

## 2 Job to be done

Let one person, switching roles, take a won quotation for stocked transformers through order submission, credit hold and release, ATP confirmation with a split schedule line, delivery creation, pick, pack, inspection, loading, post goods issue and proof of delivery, ending with the delivery Delivered/Closed and an invoice request handed to Finance.

The path is the MTS branch, because it is the only branch the eight Sales screens can finish without engineering and production screens [DOC:p.176 f1; p.53 §4.3] (asserted). The CTP promise dialog is built on one seeded MTO order so the promise step is visible (section 6.2, screen 4), but it is not on the walked path.

**The walked path, step by step.** Build exactly this, in this order. Each step names the screen, the acting role (role switcher, section 6.3) and the status changes the step must cause.

| # | Step | Screen | Acting role | Status changes the step causes | Source |
|---|---|---|---|---|---|
| *0* | *Example shape* | *screen ID* | *role* | *record: from → to* | *[DOC:p.n] (asserted)* |
| 1 | Open quotation QT-TBD-0412-V2 (Issued), record the win | OM-QT-002 | Sales rep | Quotation: Issued → Won | [DOC:p.51 §3.3] (asserted) |
| 2 | Convert to order: lines, prices (Price Source = Quotation, frozen) and configuration copy; quote locks with the order cross-reference | OM-QT-002 → OM-SO-002 | Sales rep | Sales order created in Draft; SO lines Open; one schedule line per line, Open | [DOC:p.51; p.52 §4.1; p.206 §2.1] (asserted) |
| 3 | Enter Customer PO number (mandatory), submit; the credit check runs: exposure + new order value must be ≤ credit limit and no invoice > 30 days past due | OM-SO-002 | Sales admin | Sales order: Draft → Submitted → Credit Hold (the seed makes this fail; section 5.4) | [DOC:p.49 §2.2; p.52 §4.1; p.54 §4.6] (asserted) |
| 4 | Release the credit hold from the Finance queue. The delegate option is absent because the order is over $250,000 | WF-INBOX | Finance (credit) | Sales order: Credit Hold → Confirmed (the only other exit is Cancelled; Finance Reject maps there, OQ-28) | [DOC:p.49 §2.2; p.54 §4.6; pp.10-11 §W] (asserted) |
| 5 | Run Confirm on the schedule lines (Book VI: "Confirm runs ATP or CTP per branch"); ATP runs per line, flagged Reading OQ-32 because the order is already Confirmed after release. Line 10 is short (2 available of 3); the partial dialog offers accept later date / split / backorder. Choose split | OM-SO-002 | Sales admin | Line 10 schedule 10 (qty 2): Open → Confirmed → Allocated/Pegged. Line 10 schedule 20 (qty 1): Open → Confirmed at the later date, Backorder flag on. Line 20 schedule 10: Open → Confirmed → Allocated/Pegged | [DOC:p.53 §4.3; p.206 §2.1] (asserted) |
| 6 | Run delivery creation (on demand). Schedules due in the horizon group into one delivery; the grouping shows the rule that fired | OM-DLV-001 | Shipping office | Schedule lines: → Delivery Due. Delivery: created at Planned | [DOC:p.207 §2.3; p.251] (asserted) |
| 7 | Release to warehouse, then confirm pick (stub for SP-15) | OM-DLV-001 | Shipping office | Delivery: Planned → Released → Picking. Sales order: Confirmed → In Fulfillment. SO lines: → Ready to Ship | [DOC:p.207 §2.4; p.54; p.53 §4.2] (asserted) |
| 8 | At the kiosk, create one HU per transformer, scan the serial in (SP-16), close the HU with scale weight inside ±2% (SP-17); complete the pack order | OM-PACK-* | Packer | HU: Open → Closed (one per serial). Delivery: Picking → Packed. Posting #27 shown at each HU close | [DOC:p.31 §5; pp.95-96 SP-16, SP-17; p.251] (asserted) |
| 9 | Mark pre-shipment inspection passed (stub for QM-EXEC) | OM-DLV-001 | Shipping office | Delivery: Packed → Quality Cleared. Readiness flag "quality" turns passed | [DOC:p.176 f8; p.207 §2.4] (asserted) |
| 10 | Load plan: equipment type, dock door, slot; carrier and PRO/BOL typed by hand; scan each HU at the truck (SP-18) | OM-DLV-001 | Shipping office | HU: Closed → Loaded. Delivery: Quality Cleared → Loaded | [DOC:p.205 DEC-04; p.207 §2.4; p.96 SP-18] (asserted) |
| 11 | Post goods issue when all four readiness flags are green; confirm the posting preview | OM-DLV-001 | Shipping office | Delivery: Loaded → PGI. HU: Loaded → Shipped. Serials: Reserved → Shipped. Schedule lines: → Delivered. SO line 10: → Partially Shipped (2 of 3); SO line 20: → Shipped. Sales order: → Partially Shipped (schedule 20 still open). POD row created at Expected. Invoice request created. Postings #25 and #26 shown | [DOC:p.208 §2.5; p.176 f6, f9; p.207 §2.4; p.54] (asserted) |
| 12 | Record POD: receiver name, date, condition "no damage" | OM-POD-002 | Shipping office | POD: Expected → Received. Delivery: PGI → Delivered/Closed | [DOC:p.207 §2.4; p.252] (asserted) |

Path end state: delivery Delivered/Closed, POD Received, invoice request visible as handed to Finance, sales order Partially Shipped with one backordered schedule line still Confirmed. The order reaching Invoiced/Closed belongs to Finance (ACC volume) and is shown only on seeded records.

**Required non-path states (ask for all of them; they are where the domain questions live).**

- **Empty**: Approvals inbox for a role with nothing to decide ("Nothing waiting for you. Credit releases and no-quote order approvals for your role appear here."); Packing queue with no completed picklists; POD queue filtered to nothing, with a clear-filter action.
- **Loading**: every list shows skeleton rows for 600 ms on first visit (simulated); the PGI button shows "Posting goods issue…" and is disabled for 1.5 s (PGI under 2 s P95 [DOC:p.176 f14] (asserted)).
- **Error, at least these five**, each with the wording rules in section 5.5:
  1. PGI fails on seeded delivery DLV-TBD-0088 and leaves it at Loaded with the error shown, never half-posted [DOC:p.208 §2.5] (asserted). The cause is simulated.
  2. HU close blocked: scale weight outside ±2% of expected (SP-17) [DOC:p.32 §5; p.96] (asserted).
  3. SP-18 load scan of an HU that is not on this shipment, E-BC-08 [DOC:p.96] (asserted).
  4. Direct-entry order with a customer that is not Active, E-OM-02 [DOC:p.52 §4.1] (asserted).
  5. PGI reversal refused: the PGI is in a different fiscal period, or an invoice is already posted [DOC:p.208 §2.5] (asserted).

## 3 Data model sketch

Source: `40-models/_tentative/erd-sketch.md` rows E-1 to E-6 and status lists S-1 to S-8, plus the PRD pages cited. TENTATIVE: every list is (asserted), none confirmed.

**Entities and links**

| Entity | Key fields to model | Links | Source |
|---|---|---|---|
| *Handling unit* | *hu_id, type, weights, sscc, contents* | *delivery; one transformer serial per primary HU* | *[DOC:p.128; p.31 §5] (asserted)* |
| Customer (+ address, contact) | customer_id, name, class, status, credit_limit, credit_exposure, available_credit (= limit − exposure, may be negative), credit_hold_flag (manual), risk class A to D, priority class A/B/C, past_due_over_30 (yes/no), Incoterms default, currency, Bill-To and Ship-To addresses | quotations, sales orders | [DOC:p.49 §2.1-2.2; p.207 §2.2] (asserted) |
| Quotation / quote line | qt_id, version, status, valid_until; line: item, kVA rating, primary and secondary voltage, qty, price | customer; converts to one sales order | [DOC:p.128; p.51; p.249 §4.1] (asserted) |
| Sales order / SO line | so_id SO-{YYYY}-{SEQ:5}, customer, Customer PO # (mandatory), quote reference, order type (MTS / MTO / ETO / Service / Replacement), Bill-To, Ship-To, requested ship date, Incoterms, freight terms, carrier, billing plan, currency and booked rate, status; line: line # (10, 20, 30), item, qty, unit price, price source, requested and promised ship date, warehouse, line status | customer, quotation, schedule lines | [DOC:p.52-53 §4.1-4.2] (asserted) |
| Schedule line | sched # (10, 20 within the SO line), requested qty/date, confirmed qty/date, constraint named, plan snapshot ID, delivered qty, open qty (= confirmed − delivered − cancelled), backorder flag, peg reference, status | SO line; consumed by deliveries, never raw order lines | [DOC:p.206 §2.1] (asserted) |
| Delivery | delivery_id, ship-to, status, split/merge rule that fired, four readiness flags (supply, quality, credit, documents), load plan (equipment type, permit checklist, HU loading sequence, dock door, appointment slot), carrier, PRO/BOL #, planned transit days, expected POD date (= ship date + transit) | schedule lines (many), HUs, POD | [DOC:p.207 §2.3-2.4] (asserted) |
| Handling unit / HU line | hu_id, SSCC, type, gross weight expected and actual, status, label printed (yes/no); line: serial | delivery; exactly one transformer serial per primary HU | [DOC:p.128; p.31 §5] (asserted) |
| POD / claim | POD: status, receiver name, date, condition notes, signed document (upload stub); claim: type (shortage, damage, refusal), quantity or value, carrier claim reference, resolution (credit via credit memo request, redelivery, repair) | one POD per delivery; claims reuse RMA and credit paths | [DOC:p.207 §2.4] (asserted) |
| Linked only (no screens, no status lists of their own here) | invoice request, PGI document, journal postings #25 #26 #27, serial, fiscal period name, approval request | owned by INV V3.0, ACC V2.0 or the shared approval engine | [DOC:p.128; p.10 W.1] (asserted); ASM-EXT-1 |

**Every status each entity can hold.** Badge text is the status name exactly as written here. Every value must appear on at least one seeded record (seed manifest, section 5.4).

| Entity | Statuses, in lifecycle order | Transitions the build must honour | Source |
|---|---|---|---|
| *Handling unit* | *Open, Closed, Loaded, Shipped* | *Open → Closed → Loaded → Shipped; reopen with a reason until Loaded; PGI reversal sets HUs back to Loaded* | *[DOC:p.31 §5; p.208] (asserted)* |
| Customer (5) | Prospect, Active, On Hold, Blocked, Inactive. Credit hold is a separate manual flag, shown as a chip, not a status | not stated; only Active customers are selectable on a sales order | [DOC:p.49 §2; p.52 §4.1; p.249 §4.1] (asserted) |
| Quotation (7) | Draft, Internal Review, Issued, Won, Lost, Expired, Superseded | Draft → Internal Review → Issued → Won / Lost / Expired; Revise on Issued creates -V(n+1) in Draft and sets the predecessor Superseded | [DOC:p.51 §3.3] (asserted) |
| Sales order (9, plus Rejected, see K-15) | Draft, Submitted, Credit Hold, Confirmed, In Fulfillment, Partially Shipped, Shipped, Invoiced/Closed, Cancelled; Rejected as an exit from Submitted | Draft → Submitted → Confirmed / Credit Hold / Rejected; Credit Hold → Confirmed / Cancelled; Confirmed → In Fulfillment → Partially Shipped / Shipped → Invoiced/Closed; reopen of Invoiced/Closed is Controller only | [DOC:p.54 §4.6] (asserted) |
| SO line (9) | Open, In Engineering, In Production, Ready to Ship, Partially Shipped, Shipped, Invoiced, Closed, Cancelled | transitions not stated; set by the step table in part 2 | [DOC:p.53 §4.2] (asserted) |
| Schedule line (8) | Open, Confirmed, Allocated/Pegged, Delivery Due, Partially Delivered, Delivered, Closed, Cancelled | Open → Confirmed → Allocated/Pegged → Delivery Due → Partially Delivered → Delivered → Closed / Cancelled | [DOC:p.206 §2.1] (asserted) |
| Delivery (8) | Planned, Released, Picking, Packed, Quality Cleared, Loaded, PGI, Delivered/Closed | in that order; a failed PGI stays at Loaded; PGI reversal sets the delivery back to Packed | [DOC:p.207 §2.4; p.208 §2.5] (asserted) |
| Handling unit (4) | Open, Closed, Loaded, Shipped | as the example row | [DOC:p.31 §5; p.208] (asserted) |
| POD (4) | Expected, Received, Exception, Resolved/Closed | Expected → Received / Exception → Resolved/Closed | [DOC:p.207 §2.4] (asserted) |
| Serial (partial) | Available, Reserved, Shipped are the only values this build shows | Reserved → Shipped at PGI; Shipped → Reserved on PGI reversal. The full list is not in the KB: show no other serial value | [DOC:pp.95-96 §F; p.208 §2.5] (asserted); OQ-24 |

Total: 8 entities with full lists, 54 status values, plus Rejected on the sales order (K-15) and 3 partial serial values.

**Unknown, do not invent.** Write these words into the code comments and render the gaps as plain text, never as made-up badges:

- Claim status: the PRD gives no list. Show the claim's type, value, carrier reference and resolution path; no status badge.
- Approval request status: the PRD gives no list (OQ-21). The inbox shows pending items and, after a decision, an activity entry "Released by {role} on {date}"; no status badge.
- Invoice request status: owned by ACC (ASM-EXT-1). Show "Invoice request IR-TBD-nnnn created at PGI" and, after a reversal, "withdrawn" as activity text only [DOC:p.208 §2.5] (asserted).
- The "16 stages" of Flow A: no stage table exists in the text read (OQ-14). Do not number stages anywhere. The only stage reference allowed is the readiness flags "per Flow A stage 7" [DOC:p.207] (asserted).
- The value of N in "missing POD after expected date + N days alerts": not stated [DOC:p.207 §2.4] (asserted). Show aging in days and a text line "Alert threshold N not set in the specification"; never colour a row by an invented N.
- Split and merge rule IDs: the rule behaviour is stated, the ID values are not [DOC:p.207 §2.3] (asserted). Show the rule by its name (for example "Split, mandatory: different ship-to sites") and a placeholder ID "RULE-TBD".
- The order status while a no-quote order over $250,000 waits for the Sales Director: not stated. Keep it at Submitted with the pending approval visible (OQ-31).
- Status transition triggers the PRD gives only as an order of statuses (when a delivery becomes Packed, when a schedule line becomes Closed): use the step table in part 2 and flag "Reading OQ-32" on those transitions.

## 4 Constraints

Only `[DOC]` items appear here. None is (confirmed): the PRD stands as the domain authority's written statement and every line is (asserted). Because the user instructed "build as per the PRD", these are enforced in the build; each enforced rule is also listed in a "Rules on this screen" disclosure (a collapsed panel at the bottom of each screen) with its page reference, so the reviewer can challenge it at Gate 1.

| # | Rule the build must not violate | What the interface does | Source |
|---|---|---|---|
| *R-0* | *Example: HU reopen only until Loaded* | *Reopen disappears at Loaded; reopen asks for a reason* | *[DOC:p.31 §5] (asserted)* |
| R-1 | Credit check runs at quote-to-order conversion, at submit, on any change that increases value, and at shipment release (the final gate): exposure + new order value ≤ credit limit and no invoices more than 30 days past due; failure sets Credit Hold | Show the check result as a panel with both tests, the numbers and pass/fail in words | [DOC:p.49 §2.2] (asserted) |
| R-2 | Sales roles cannot release credit holds; release, reject and raise-limit live in the Finance queue; raise limit is Controller only | No release control on OM-SO-002 for any role; the order shows "Waiting for Finance credit release" with a link to the inbox item | [DOC:p.49 §2.2; p.176 f13] (asserted); erd-sketch C-12 |
| R-3 | One shared approval engine; no module-specific approval UI | All approve / release / reject decisions happen in WF-INBOX at /approvals, in one pattern | [DOC:p.10 W.1] (asserted) |
| R-4 | No delegation of financial approvals above $250,000 | The Delegate action is absent (not disabled) on items over $250,000, with a line "Delegation not allowed above $250,000" | [DOC:pp.10-11 §W] (asserted); applies to credit release per OQ-29 |
| R-5 | Manual orders above $250,000 without a quote need Sales Director approval (R-OM-02) | Direct-entry orders above $250,000.00 raise a Sales Director item in the inbox at submit; exactly $250,000.00 does not | [DOC:p.52 §4.1] (asserted) |
| R-6 | Only Active customers on a sales order (E-OM-02); a Prospect is never selectable | The customer picker lists non-Active customers disabled with their status badge and the E-OM-02 reason | [DOC:p.52 §4.1; p.249 §4.1] (asserted) |
| R-7 | Customer PO # is mandatory | Submit is refused with an inline field error and a summary | [DOC:p.52 §4.1] (asserted) |
| R-8 | Convert to order only from Won; prices copied and frozen, Price Source = Quotation; Issued quote content is locked | Convert appears only on Won; price cells on the order are read-only text with a "Quotation" source tag; Issued quotes show no Edit, only Revise | [DOC:p.51 §3.3] (asserted) |
| R-9 | MTS ATP per line; partial availability offers accept later date, split line, or backorder; the confirmed date stores the constraint named and the plan snapshot ID | Partial dialog with exactly these three options; the schedule line shows constraint and snapshot ID | [DOC:p.53 §4.3; p.206 §2.1] (asserted) |
| R-10 | Pegging is schedule-level; deliveries consume schedule lines, never raw order lines | Pegging panel and delivery contents list schedule lines (SO line / sched #), never bare order lines | [DOC:p.206 §2.1] (asserted); Book IV precedence, K-19 |
| R-11 | Delivery split is mandatory on different ship-to, different Incoterms, hazmat segregation, over-dimensional units, and the customer "no partial" flag (waits for full quantity); elective split when schedules are more than 7 days apart; every grouping stores the rule that fired (E-DLV-01) | Each delivery shows "Grouped by: {rule name}" | [DOC:p.207 §2.3] (asserted) |
| R-12 | PGI only when the readiness flags (supply, quality, credit, documents) are all passed; pre-shipment inspection blocks PGI (E-OM-07); the shipment-release credit gate cannot be bypassed by sales roles | Post goods issue is disabled with the failing flags named in words | [DOC:p.207 §2.4; p.176 f8; p.49 §2.2] (asserted) |
| R-13 | PGI is one atomic transaction: stock, serial, journal and invoice request together; a failure leaves the delivery at Loaded, never half-posted | On failure nothing changes on any record; the error says so | [DOC:p.176 f9; p.208 §2.5] (asserted) |
| R-14 | PGI posts #25 (DR 5120 COGS / CR 1330 FG, qty × standard), #26 (DR 6410 Freight Out / CR 2100 AP accrual, quoted freight, only on PE-paid terms); #27 (DR 5120 packaging / CR 1360 Packaging on Hand) posts at HU close | Posting preview in the PGI confirmation; #26 reads "not posted: customer-paid freight" on EXW orders | [DOC:pp.124-125 Part J] (asserted) |
| R-15 | PGI role is not the invoice-posting role; shipping cannot edit prices | No price field is editable in the cockpit; the invoice is not postable anywhere in this build | [DOC:p.176 f13] (asserted) |
| R-16 | PGI reversal: Shipping Manager only, before the invoice is posted, in the same fiscal period, reason mandatory; atomic mirror of #25/#26/#27; serials Shipped → Reserved; HUs → Loaded; delivery → Packed; invoice request withdrawn. After invoice: no reversal, only credit/rebill or RMA | "Reverse PGI" shows only for the Shipping Manager role inside that window, with a required reason; outside it the reason it is unavailable is stated | [DOC:p.208 §2.5] (asserted); erd-sketch C-51 |
| R-17 | HU close needs gross weight within ±2% of expected; HU reopen allowed until Loaded with a reason; one transformer serial per primary HU | Close refused outside ±2%; Reopen absent from Loaded onward | [DOC:p.31-32 §5; p.96 SP-17; p.128] (asserted) |
| R-18 | SP-18 load scan accepts only HUs on this shipment (E-BC-08); completeness enables PGI | Load list ticks each HU; unknown HU raises the scan failure banner | [DOC:p.96 SP-18] (asserted) |
| R-19 | Carrier and tracking are manual in Phase 1 (DEC-04); expected POD date = ship date + planned transit days | Typed carrier, PRO/BOL #, transit days; no rating, tendering or tracking feed | [DOC:p.205 DEC-04; p.207 §2.4] (asserted) |
| R-20 | POD or site acceptance fires the Delivery/Commissioning milestone exactly once; claims reuse RMA and credit paths, never parallel ones | Claim resolution buttons are links "Create credit memo request (ACC)", "Create redelivery", "Create repair (RMA path)" that open a stub notice | [DOC:p.207 §2.4] (asserted) |
| R-21 | Reallocation of confirmed supply needs Sales Director approval and an audit pair on both orders | No reallocate control anywhere in this build (OM-BO-001 is out of scope); backorder flags are display only | [DOC:p.207 §2.2] (asserted) |
| R-22 | Closed sales orders reopen only by the Controller; terminal records open read-only | Invoiced/Closed and Cancelled orders render values as text; Reopen visible only to Controller | [DOC:p.54 §4.6; p.242 §10.2-10.3] (asserted) |
| R-23 | Every Detail header carries a status badge and a lifecycle strip | OM-QT-002, OM-SO-002, delivery side panel and OM-POD-002 each show badge plus strip of the entity's statuses in order | [DOC:p.242 §10.2] (asserted) |
| R-24 | Floor devices: 48 px minimum targets, 16 px base font, scan feedback under 400 ms with sound and a visual change, no silent failure | Pack station follows `a11y.md` section 2 and `layout.md` section 4 | [DOC:p.241 §8.4] (asserted) |

**Assume, flag visibly in the UI** (readings, not rules; each carries a "Reading OQ-nn" flag where it shows):
- Finance "Reject" in the credit release queue sets the order to Cancelled (OQ-28).
- The $250,000 no-delegation rule applies to credit release items (OQ-29).
- Identifier formats other than SO-{YYYY}-{SEQ:5} are placeholders (OQ-30).
- Order stays Submitted while waiting for the Sales Director (OQ-31).
- Transition triggers taken from status order (OQ-32).
- Finance (credit) releases; Controller alone raises limits (OQ-33).

**Accessibility floor, one line:** native controls and shadcn/Radix primitives only; every control keyboard-operable with tab order following reading order; visible 2 px focus ring never removed; status never by colour alone (word + icon + fill); WCAG 2.2 AA (`a11y.md` A-1 to A-20).

## 5 Style reference

### 5.1 Files, in the order a generator should weight them

1. `30-design-language/skills-md/a11y.md`: the floor. **Overrides every other file.**
2. `30-design-language/skills-md/tokens.md`: paste section 6 ("globals.css block") into `src/index.css` verbatim, including the `@theme inline` additions with one line per `--status-*` token. Density values: section 5.
3. `30-design-language/skills-md/type.md`: numerals (`tabular-nums`, Y-3, Y-4), sentence case (Y-5), truncation (Y-6).
4. `30-design-language/skills-md/layout.md`: density per screen type (section 2), office skeleton (section 3), floor-touch skeleton (section 4).
5. `30-design-language/skills-md/color.md`: roles, contrast, and the **TENTATIVE** status sketch in section 4. The status families are a guess meant to be corrected at Gate 1; build them exactly as written so the guess is visible.

Precedence, stated once: `a11y.md` overrides everything; where two files disagree, the more specific file wins over the more general. There is no `style-guide.md`, `components.md`, `forms.md`, `tables.md`, `states.md`, `content.md`, `motion.md` or `responsive.md` in this phase: do not look for them and do not invent their contents. No `shared-specs/` file is cited; the user's coding guidelines and design language are pending (PROJECT_CONFIG > Delivery stack).

### 5.2 Status badge encoding

Extend shadcn `badgeVariants` (cva) with seven variants, `draft`, `pending`, `active`, `blocked`, `done`, `cancelled`, `exception`, per `color.md` section 4: icon (lucide-react) plus status word always (C-2), text verbatim from part 3 (C-3), family chosen per entity and status pair, never per word (C-4). Use this mapping, taken from `40-models/_tentative/status-encoding-input.md` (TENTATIVE, OQ-18):

| Entity | draft | pending | active | blocked | done | cancelled | exception |
|---|---|---|---|---|---|---|---|
| *Handling unit* | *-* | *-* | *Open, Closed, Loaded* | *-* | *-* | *-* | *-* |
| Customer | Prospect | - | Active | On Hold, Blocked | Inactive | - | - |
| Quotation | Draft | Internal Review | Issued | - | Won, Superseded, Expired | Lost | - |
| Sales order | Draft | Submitted | Confirmed, In Fulfillment, Partially Shipped, Shipped | Credit Hold | Invoiced/Closed | Cancelled, Rejected | - |
| SO line | Open | - | In Engineering, In Production, Ready to Ship, Partially Shipped, Shipped | - | Invoiced, Closed | Cancelled | - |
| Schedule line | Open | - | Confirmed, Allocated/Pegged, Delivery Due, Partially Delivered, Delivered | - | Closed | Cancelled | - |
| Delivery | Planned | - | Released, Picking, Packed, Quality Cleared, Loaded, PGI | - | Delivered/Closed | - | - |
| Handling unit | - | - | Open, Closed, Loaded, Shipped | - | - | - | - |
| POD | Expected | - | Received | - | Resolved/Closed | - | Exception |
| Serial | - | - | Available, Reserved, Shipped | - | - | - | - |

Markers beside a badge are chips, never replacements (C-5): customer credit hold flag (F4 outline, `Ban`), schedule line Backorder flag (F7 outline, `TriangleAlert`), "Reading OQ-nn" (plain outline, `Info`), "K-nn" contradiction marker (plain outline, `GitCompare`).

Status colours: only the six PRD hues as the tokens define them. Yellow, purple, teal and dark red from the PRD's lifecycle tables are not used (K-13; section 7).

### 5.3 Density per screen

| Screen | Mode |
|---|---|
| *OM-SO-001 order list* | *office-dense, with the "Compact rows / Comfortable rows" switch (L-3)* |
| OM-QT-001, OM-SO-001, OM-DLV-001, OM-PACK queue, OM-POD-001, WF-INBOX | office-dense, switchable |
| OM-QT-002, OM-SO-002, OM-POD-002 | office-comfortable; their line tables office-dense |
| CTP-DLG, ATP partial dialog, PGI confirmation, reversal dialog | inherits the opening screen's mode |
| OM-PACK station | floor-touch, always; fixed 1280 x 800; light theme only (L-2, L-6) |

One filled primary button per view (L-4).

### 5.4 Realistic content and volume

All names, numbers and identifiers below are fictitious. None is copied from client material (GUARDRAILS 7). Locale en-US: `$1,234,567.89`, dates `Oct 9, 2026` in lists and `2026-10-09` in detail fields. Today in the prototype is Friday, October 9, 2026; the open fiscal period is 2026-10.

**Identifier formats.** Sales order uses the PRD format SO-{YYYY}-{SEQ:5}, for example SO-2026-00412 [DOC:p.52 §4.1] (asserted). Quotation revisions end in -V(n) [DOC:p.51] (asserted). Every other format is unknown (OQ-30) and uses an obviously placeholder shape with "TBD": QT-TBD-0412-V2, CUS-TBD-0031, DLV-TBD-0071, HU-TBD-0203, POD-TBD-0071, CLM-TBD-0007, IR-TBD-0144, PGI-TBD-0071, item FIN-TBD-2500PM. SSCC is 18 digits, for example 000614141000002031.

**Volume.** Quotation list 24 rows; sales order list 40 rows; delivery cockpit 30 deliveries across its columns; packing queue 8 pack orders; POD queue 16 rows; approvals inbox 6 items across roles. Every list also needs its empty state and a filtered-to-nothing state (part 2). These are design values: the PRD gives no volumes (ASM-VOL-1).

**Products (all MTS from finished goods unless stated).** Ratings are shown in the PRD's field "kVA rating" with MVA in brackets [DOC:p.249 §4.1] (asserted).

| Item | Description | kVA rating | Voltages | Unit price | Standard cost |
|---|---|---|---|---|---|
| *FIN-TBD-2500PM* | *Three-phase pad-mount transformer* | *2,500 (2.5 MVA)* | *12.47 kV – 480Y/277 V* | *$78,400.00* | *$61,200.00* |
| FIN-TBD-1000PM | Three-phase pad-mount transformer | 1,000 (1 MVA) | 13.2 kV – 208Y/120 V | $41,850.00 | $32,640.00 |
| FIN-TBD-0167PL | Single-phase pole-mount transformer | 167 | 7.2 kV – 120/240 V | $6,980.00 | $5,410.00 |
| FIN-TBD-5000SS | Secondary unit substation transformer, liquid-filled | 5,000 (5 MVA) | 34.5 kV – 4.16 kV | $186,300.00 | $149,900.00 |
| FIN-TBD-20MVA (ETO, list only) | Substation power transformer, ONAN/ONAF | 20,000 (20 MVA) | 115 kV – 13.8 kV | $1,284,000.00 | n/a |
| FIN-TBD-7500MTO (MTO, CTP only) | Pad-mount transformer, stainless tank | 7,500 (7.5 MVA) | 24.94 kV – 600Y/347 V | $243,700.00 | n/a |

**The walked-path records.**

- Customer CUS-TBD-0031 "Prairie Ridge Electric Cooperative", Utility, Active, USD, Incoterms DAP, credit limit $750,000.00, exposure before the order $486,300.00, no invoices past 30 days, risk class B, priority class A.
- Quotation QT-TBD-0412-V2 (Issued; predecessor QT-TBD-0412-V1 Superseded): line 10, 3 × FIN-TBD-2500PM = $235,200.00; line 20, 1 × FIN-TBD-1000PM = $41,850.00; total $277,050.00.
- Credit check at submit: $486,300.00 + $277,050.00 = $763,350.00 > $750,000.00, so the order goes to Credit Hold. Available credit then shows **−$13,350.00** (the negative). The inbox item is over $250,000, so Delegate is absent (R-4).
- ATP: FIN-TBD-2500PM has 2 available; the third unit's later date is Oct 30, 2026 (constraint "incoming stock from production order", snapshot ID PLN-SNAP-TBD-0919). FIN-TBD-1000PM has 4 available.
- Serials for the 3 shipped units: PE-TBD-25-004417, PE-TBD-25-004418, PE-TBD-10-002093 (placeholder shape, OQ-30), each Reserved before PGI. Expected HU gross weights 7,940 kg, 7,940 kg, 4,310 kg; the kiosk scale's simulated reading is within ±2% except on the first attempt for the third HU (4,420 kg, +2.6%), which triggers error 2.
- Carrier typed by hand: "Great Plains Heavy Haul" (fictitious), PRO 7731-0092, transit 3 days, flatbed, dock door 4, slot Oct 13, 2026 08:00–10:00. Freight quoted $3,450.00 on PE-paid terms, so #26 posts.

**Boundaries the seed must contain (point at each in the boundary audit).**

| Boundary | Where |
|---|---|
| *Negative* | *Available credit −$13,350.00 on CUS-TBD-0031 after submit* |
| Zero | Freight $0.00 on an EXW delivery (DLV-TBD-0064), with #26 "not posted: customer-paid freight"; open qty 0 on a Delivered schedule line |
| Zero beside empty | Freight "$0.00" on DLV-TBD-0064 next to "Not recorded" on a Planned delivery with no carrier yet |
| Exactly at threshold | Direct-entry order SO-2026-00398 at $250,000.00: no Sales Director item |
| Above threshold | Direct-entry order SO-2026-00405 at CA$312,480.00, customer "Coopérative d'électricité du Lac-Saint-Jean" (diacritic, apostrophe), waiting for Sales Director |
| Longest plausible name | "Northern Saskatchewan Municipal Power and Light Utility Commission, Prince Albert Regional Distribution District" on 3 orders, 2 deliveries and 1 POD |
| Hyphen and apostrophe | "O'Hara-Bell Electrical Contractors, Inc." |
| Short name | "Volt Co." |
| Maximum magnitude | ETO order SO-2026-00377 at $3,852,000.00 (3 × 20 MVA) in the order list |
| Month-end boundary | PGI on Sep 30, 2026 (period 2026-09) on DLV-TBD-0059: reversal refused, different fiscal period (error 5) |
| Far past and future | Order SO-2025-00911 Invoiced/Closed on Nov 14, 2025; ETO requested ship date Mar 15, 2027 |

Customers for the rest of the seed: 12 fictitious US and Canadian buyers (utilities, EPC contractors, a distributor, an industrial plant, a municipal government), Canadian ones in CAD.

**Seed manifest: every status on a named record.** The builder fills the record IDs; the rule is that each status below appears at least once in the loaded data.

| Entity | Statuses that must be seeded | Example |
|---|---|---|
| *Delivery* | *all 8* | *DLV-TBD-0088 at Loaded (PGI fails), DLV-TBD-0059 at PGI (Sep 30)* |
| Customer | Prospect, Active, On Hold, Blocked, Inactive; one Active customer with the credit hold flag set | customer picker on a new direct-entry order |
| Quotation | Draft, Internal Review, Issued, Won, Lost (with loss reason), Expired, Superseded | quotation list |
| Sales order | all 9 plus Rejected (K-15 marker) | order list |
| SO line | all 9 (In Engineering and In Production on the ETO and MTO orders) | order details |
| Schedule line | all 8, including one Partially Delivered and one Cancelled | order details |
| Handling unit | Open, Closed, Loaded, Shipped | pack station and cockpit |
| POD | Expected (one 6 days past expected date), Received, Exception (damage claim CLM-TBD-0007, $18,600.00), Resolved/Closed | POD queue |
| Serial | Available, Reserved, Shipped | pack station |

### 5.5 Words on screen

Real copy in every state, no lorem ipsum. Errors name what happened, what was expected, the PRD code where one exists, and the next action. Example for error 1: "Goods issue not posted. Nothing changed: stock, serials, ledger and invoice request are as they were. Reason: posting service unavailable (simulated). Try again, or leave the delivery at Loaded." Scan failures stay on screen until the next scan or a dismiss, never a disappearing toast (A-17).

## 6 Scope boundary

### 6.1 Fidelity rule

Build domain fidelity properly: every status, transition, rule R-1 to R-24, posting preview, readiness flag, threshold and error in this prompt must behave as written. Leave visual polish rough: no custom illustrations, no animation beyond the scan flash, no responsive work below 1280 px, no dark theme tuning, no pixel alignment passes. A reviewer should argue about the rules, not the spacing.

### 6.2 Screens to build (Book VI IDs and routes)

| # | Screen | Route | Built for this path | Source |
|---|---|---|---|---|
| *0* | *ID, title* | *route* | *what to include* | *[DOC:p.n] (asserted)* |
| 1 | OM-QT-001/2 Quotations | /sales/quotations, /sales/quotations/:id | List with status filter; detail with line grid, version chain, Record win or loss (loss reason required), Convert to order (Won only), Revise (Issued only). No PDF, no margin panel | [DOC:p.250; p.51] (asserted) |
| 2 | OM-SO-001/2 Sales Orders with Schedule Lines | /sales/orders, /sales/orders/:id, /sales/orders/new | Header, line grid, expandable schedule lines per line, readiness chips (supply, credit, quality, documents), pegging panel at schedule level, credit check panel, Submit, Confirm (ATP + partial dialog), activity log. Direct entry only to show R-5, R-6, R-7 | [DOC:p.250; pp.52-54] (asserted) |
| 3 | WF-INBOX Approvals Inbox | /approvals | Credit Release items (Release, Reject, Raise limit for Controller only) and R-OM-02 items (Approve, Reject for Sales Director); Delegate absent over $250,000 | [DOC:p.275 §15; p.49 §2.2; p.52] (asserted) |
| 4 | CTP-DLG Promise Dialog | dialog on the MTO order SO-2026-00402 | Seeded result: feasible date Dec 18, 2026, binding constraint "Test bay capacity, weeks 47 to 49" in words, two alternatives, soft-reservation countdown 15:00 (design value), Accept / Decline / Request planner review | [DOC:pp.259-261 §8 CTP-DLG] (asserted) |
| 5 | OM-DLV-001 Delivery Cockpit | /sales/deliveries | Status columns Planned to Delivered/Closed, readiness flags per delivery, "Grouped by" rule, load planning side panel with SP-18 scan field, Run delivery creation, Release to warehouse, Confirm pick (stub), Pass inspection (stub), PGI confirmation with posting preview, Reverse PGI (Shipping Manager). Print documents is a stub notice | [DOC:p.251; p.207 §2.4] (asserted) |
| 6 | OM-PACK-* Packing Queue and Pack Station | /sales/packing, /sales/packing/station/:id (station route not stated; placeholder) | Queue of pack orders; kiosk with left panel of items to pack, right panel HU tree, centre scan input with focus lock, scale readout; Create HU, scan in (SP-16), Close HU with weight check (SP-17), Complete pack order, Reopen with reason. Scans are typed into the field (keyboard wedge) | [DOC:pp.251-252] (asserted) |
| 7 | OM-POD-001 POD and Claims | /sales/pod, /sales/pod/:id | Expected POD queue with aging; Record POD (receiver, date, condition, signed document upload as a filename only); Open claim (type, quantity or value, carrier reference); resolution links as stubs | [DOC:p.252; p.207 §2.4] (asserted) |

App shell: shadcn Sidebar with these seven entries grouped "Sales" and "Approvals", entity context bar at the top (`layout.md` section 3).

### 6.3 Deliberately fake (the gate should not spend time on these)

- **Role switcher** in the header ("Acting as": Sales rep, Sales admin, Customer service, Finance (credit), Controller, Sales Director, Shipping office, Packer, Shipping Manager). There is no login. Roles gate only the controls named in R-2, R-4, R-5, R-16, R-22.
- **Pick (SP-15)** is one "Confirm pick" button in the cockpit; picklists live in INV, not built.
- **Pre-shipment inspection** is one "Pass inspection" button; QM-EXEC is not built.
- **Scanner and scale**: typed input and a simulated reading with a "Use next reading" button.
- **Posting Service**: postings are shown as previews and an activity entry; no ledger.
- **ACC invoice**: a dev-only "Simulate invoice posted (ACC)" button on a Shipped order, so R-16's after-invoice block and Invoiced/Closed can be demonstrated.
- **PGI failure** on DLV-TBD-0088 is forced by the seed.
- **Scenario reset** button restores the seed.
- Everything labelled "TBD" in identifiers.

### 6.4 Must NOT attempt

- No OM-LEAD (leads and opportunities): its stage list (Open, Qualified, Quoting, Won, Lost, Disqualified [DOC:p.249 §4.1] (asserted)) is not in the tentative entity model yet, and a status outside the model may not enter a design (GUARDRAILS 9.11). The path starts at an Issued quotation.
- No OM-CUST customer master screens (customer data is read-only in order headers and the picker), no OM-BO backorder workbench, no reallocation, no substitution.
- No pricing simulation, price-floor approvals, surcharges, tax (Avalara) or margin panel.
- No MTO or ETO execution: no engineering request, production order, milestone billing, revenue contract. CTP-DLG shows a seeded result only.
- No sales change order dialog, no cancellation fee logic, no order copy.
- No invoice, credit memo, RMA or redelivery screens; claim resolutions are stubs.
- No labels or label-type picker beyond "HU label printed" (K-03), no document printing, no EDI 856/810 or carrier API (K-11, DEC-04), no tracking feed.
- No fiscal period screens; period appears as text only.
- No settings, no auth, no exports, no reports, no dashboards, no notifications, no email.
- No backend, no persistence beyond memory, no tests beyond a smoke run of the walked path.
- No 16-stage numbering (OQ-14).

## 7 Contradictions this build takes a side on

The user instructed "build as per the PRD"; where the PRD has a precedence rule (Book IV outranks Books I to III; a Book VI entry yields to the section it references [DOC:p.204 §1.1; p.277] (asserted)), the build follows it. These are sides taken for the build, not resolutions. Each appears in the UI as a "K-nn" chip where it shows, so the gate can probe it. All rows are recorded in `STATE.md > Open contradictions`, owner the requesting user.

| K | Where it shows | Side the build takes | Basis |
|---|---|---|---|
| *K-nn* | *screen* | *what the build does* | *precedence rule or user instruction* |
| K-15 | Sales order status | Rejected is rendered as a reachable exit from Submitted (cancelled family), seeded once, with a K-15 chip, although the status table has no Rejected row | User instruction: both statements are in the PRD; build the transition as written [DOC:p.54 §4.6] |
| K-19 | Pegging panel, delivery contents | Pegs sit on schedule lines; Book I line-level pegs read as schedule 10 | Book IV outranks Book I [DOC:p.206 §2.1; p.204 §1.1] |
| K-09 | CTP-DLG | Finite capacity: the binding constraint can be capacity | Closed by the PRD's own conflict register, Book III controls [DOC:p.205 §1.3 C-01] |
| K-13 | Every badge | The six Book V palette hues only, in the seed's seven families; lifecycle-table yellow, purple, teal, dark red not used | `color.md` seed; Book IV precedence does not cover Book V; OQ-25 |
| K-05 | Sidebar | Sales module = the 8 Book VI entries (not 9 from Book V) | OQ-8 reading of Book VI as the itemised plan |
| K-03 | Pack station | One label at HU close, "HU label"; no label-type list (7 vs 10 types unresolved) | Neither count needed for one HU label |
| K-11 | Cockpit documents | No EDI dispatch advice; carrier manual per DEC-04 | Excluded either way (Phase 2 vs 3); Book IV DEC-04 sets manual carrier |
| N-2 / OQ-13 | Sales order status | 9 table rows, not the digest's 8 | Page table over digest (OQ-20) |

## Carry checklist

| Carry | Part | Present? |
|---|---|---|
| *Every status the sketch entities can hold* | *3* | *yes: 8 entities, 54 values + Rejected + 3 serial* |
| Every status the sketch entities can hold | 3, 5.4 manifest | yes |
| Density mode, named | 5.3 | yes |
| Realistic-content instruction | 5.4 | yes |
| Row and record volume | 5.4 | yes |
| Empty, loading and error states requested | 2 | yes (3 empty, 2 loading, 5 error) |
| Accessibility floor | 4 | yes |
| What is deliberately fake | 6.3 | yes |

## Probe record

| Probe | Result |
|---|---|
| *Probe* | *answer* |
| Stranger test: where would a stranger diverge? | (1) When a delivery moves between statuses: tightened by the step table in part 2 and OQ-32 flags. (2) Which seeded record carries which status: tightened by the manifest; record IDs still left to the builder, accepted knowingly |
| Which single sentence, if deleted, would change the build most? | "Deliveries consume schedule lines, never raw order lines" (R-10): without it the cockpit is built on order lines and the schedule-line split in step 5 teaches nothing |
| Does any constraint rest on model-only provenance? | No. Part 4 rules are all [DOC]; readings sit under "Assume, flag visibly" and point at OQ-28 to OQ-33 |
| Is the boundary specific enough to say no with? | Yes: section 6.4 names screens, features and integrations |

Date probed: 2026-10-09 (author self-probe) · Accepted as complete by prototype-engineer: not yet

## Version delta log

| Version | Changed | Why (which build defect traced to which part) |
|---|---|---|
| *v2* | *added the six statuses to part 3* | *the build showed three badges and the DA could not name the missing ones* |
| v1 | First version | - |

---

**Key.**
`[DOC:p.n §x]` the client's own document (PRD2), with page and section ·
`(asserted)` a human said it once, unverified (here: the specification, supplied by the subject expert) ·
`(confirmed)` the domain authority verified it, on record; nothing in this prompt is.
**K-nn** a contradiction inside the specification, in `STATE.md > Open contradictions` · **N-n** a count mismatch in `kb-index.md` section 6 · **OQ-nn** a reading held in `10-discovery/open-questions.md` · **ASM-ID** an assumption in `00-inputs/assumptions.md` · **C-n** a consequence row in `erd-sketch.md` section 4 · **R-n** a rule row in part 4 of this prompt.
**MTS / MTO / ETO** make to stock / make to order / engineer to order · **ATP** available to promise (is there stock by that date) · **CTP** capable to promise (can we make it by that date) · **HU** handling unit, a numbered package with its own barcode · **SSCC** the shipping-unit licence plate number · **PGI** post goods issue, the moment shipped stock leaves the books · **POD** proof of delivery · **PRO/BOL** carrier tracking number / bill of lading · **SP-nn** a barcode scan point · **#nn** a ledger posting template · **E-xxx** an error code in the specification · **R-OM-02** the specification's rule for no-quote orders over $250,000.
**TENTATIVE** a Phase 2A sketch meant to be corrected · **TBD** an identifier format the specification does not give.
**load-bearing** something else depends on this, so it cannot be changed quietly.
