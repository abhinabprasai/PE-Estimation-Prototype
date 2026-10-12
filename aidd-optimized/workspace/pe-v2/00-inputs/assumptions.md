# Assumption Register - pe-v2

> **What this is.** Everything we are guessing because the specification does not say it, written down so the estimate can show which numbers rest on a guess. Each line says what we assumed, what breaks if we are wrong, the quickest way to check it, who can settle it and by when.
>
> **Where it stands.** Opened at intake on 9 October 2026 with 18 entries; ASM-ASIS-2 added the same day by the flow modeler (19). None has been confirmed. By your instruction we are not asking questions about them; we build as the specification reads and carry these openly.
>
> **What we need from you.** The requesting user, as subject expert and acting product owner, to accept or correct this list at estimation sign-off. Entries marked "blocks at Gate 2: yes" must be settled before Gate 2 if the project goes past estimation.

Owner of every entry: the requesting user (abhinabprasai@lftechnology.com), self-declared SME and
acting PO, written below as "Requesting user". Provenance of every assumption is `[LLM] (inferred)`
unless the row cites the document; nobody has confirmed any of them. Opened 2026-10-09.

"Blocks at Gate 2" is yes where the entry touches a rule, a status, a permission or a record
lifecycle (standing rule 3 below). Decision dates are "estimation sign-off" where only the estimate
depends on the entry, and "before Gate 2" where design would rest on it.

## Entries

| ID | Assumption (what we build as) | Origin | What breaks if wrong | Cheapest test | Owner | Decision date | Blocks at Gate 2 | Status |
|---|---|---|---|---|---|---|---|---|
| *ASM-AREA-n* | *Approvals are single-step* | *audit dim 6* | *every approval screen; Type B* | *one question to the PO* | *named person* | *before Gate 2* | *yes* | *example row* |
| ASM-GOAL-1 | The business goal is to close the nine INV gap items and deliver Book IV go-live scope; success is measured by the document's own KPIs (master data completeness ≥95%, MCR P80 ≤5 days, duplicates <2 per 1,000 [DOC:p.167 §16.4]; training ≥95% [DOC:p.203 §H]) with no baseline [LLM] (inferred) | Audit dim 1 PARTIAL | No outcome ranking for prioritization; measurement plan has no baselines. Type A for the estimate, Type B if a different goal reorders scope | Ask for one current-state figure per KPI | Requesting user | before Gate 2 | no | open |
| ASM-ROLE-1 | The roles to design for are exactly those the document names: Sales 7, Engineering 5, Quality 5 [DOC:pp.56,67,91], the approval ladder titles [DOC:p.11 §W.4] and the 12 sign-off roles [DOC:p.203]; one persona per named role, expertise "trained daily user" [LLM] (inferred) | Audit dim 2 PARTIAL | Persona count, userflow count, permission matrix size; Type B if roles merge or split | Compare the role list with the client's org chart | Requesting user | before Gate 2 | yes | open |
| ASM-PERM-1 | Permissions are role-based per module, plus the amount ladders in the document (PO: Buyer ≤$25k, Purchasing Mgr ≤$250k, Controller, CFO >$1M [DOC:p.11 §W.4]); the action-by-role matrix is derived by us as one work item [LLM] (inferred) | Audit dim 6 PARTIAL | Every screen's denied state and every approval route; Type B | SME review of a derived matrix for one module | Requesting user | before Gate 2 | yes | open |
| ASM-ASIS-1 | No as-is mapping is done; the build is to-be only, from the document [LLM] (inferred) | Audit dim 7 ABSENT | Migration rules and change management miss real current workarounds; Type A for estimate | Ask what system and spreadsheets run today | Requesting user | estimation sign-off | no | open |
| ASM-ASIS-2 | The specification's own flows stand in for the as-is: FL-01 to FL-08 [DOC:pp.176-183], FL-09 to FL-11 [DOC:pp.206-212] and the linkage spine [DOC:pp.276-277] are the reference baseline for to-be work and the prototype (`40-models/as-is/`). Step order inside the fifteen-field flows is our reading (OQ-11); no waits, workarounds or pain index exist (inferred) | Audit dim 7 ABSENT; flow-modeler 2026-10-09 | The to-be cannot show a before and after; flow optimization has no before-column; any real workaround is missed. Type A for the estimate | SME names the system and spreadsheets used today for one flow | Requesting user | estimation sign-off | no | open |
| ASM-EXC-1 | Exception handling is limited to the coded validations, errors and queues the document names (E-PER-01..04 [DOC:pp.41-42], EX-01..07 [DOC:p.72], scan exception queue [DOC:pp.93-97], DLQ after 24 h [DOC:pp.184-185]); everything else uses one generic error and retry pattern [LLM] (inferred) | Audit dim 8 PARTIAL | Unsized screens for migration rollback and integration outage; Type B where a handler or status is missing | Ask for the three most common failures today | Requesting user | before Gate 2 | yes | open |
| ASM-DEVICE-1 | Devices by role, from the Phase 1 device list [DOC:pp.238-239 §8]: shop-floor operators use the 15 shared kiosks with the 8 SR handheld scanners; stores and warehouse staff use the 10 TC77 mobile computers, 6 RS5100 ring scanners and 4 ER long-range scanners; packing, shipping and RMA receiving use the 6 DS9308 presentation scanners, 2 bench scales and 1 floor scale, printing on 5 ZT411 and 3 ZD621 printers; quality inspectors use kiosks or TC77 at stations; all office roles (sales, engineering, purchasing, planning, costing, controlling, finance, admin, approvers) use a desktop browser. Touch targets 48 px on floor devices [DOC:p.242 §10]. Role-to-device mapping is [LLM] (inferred) | PROJECT_CONFIG device table; audit dim 11 PARTIAL | Archetype mix (kiosk vs desktop vs handheld), breakpoints, offline queue scope, screen count per device; mostly Type A, large estimate swing | SME marks each role's primary device on this list | Requesting user | estimation sign-off | no | open |
| ASM-ENV-1 | Browser floor is current evergreen desktop browsers plus the TC77/RS5100 vendor browser; no assistive technology beyond WCAG 2.2 AA is in use [LLM] (inferred) | Audit dim 11 PARTIAL | Test matrix and accessibility scope; Type A | Ask IT for the managed browser list | Requesting user | estimation sign-off | no | open |
| ASM-SCEN-1 | The closure flows FL-01..11 and their test packs [DOC:pp.176-183, p.219] stand in for success and failure scenarios; no narrative scenarios are written [LLM] (inferred) | Audit dim 12 PARTIAL | Usability tasks and dummy content shaped on tests, not real days; Type A | SME narrates one normal day | Requesting user | before Gate 2 | no | open |
| ASM-OQ-1 | Every decision register item without a recorded outcome is built per the document's stated default, and DEC-07 (multi-plant activation) stays off [DOC:p.282 §4] [LLM] (inferred) | Audit dim 14 PARTIAL | Scope of any decision that lands differently; Type B | SME reads the DEC register and marks undecided rows | Requesting user | before Gate 2 | yes | open |
| ASM-VOL-1 | No named-user or concurrency count exists [DOC silent, digests 01, 05, 06]; capacity is sized from the transaction NFRs (40k scans/day, 2,000 SO lines/month, 300 WOs/month [DOC:p.131 §K4]) with 3× peak headroom [DOC:p.189 §C6], not from user counts [LLM] (inferred) | Silence in volume, digests 01-08 | Infra, licence and IdP cost lines in the estimate; Type A | Ask for named users per role | Requesting user | estimation sign-off | no | open |
| ASM-IDP-1 | Identity provider is undecided [DOC:pp.188-189 §C]; we estimate one OIDC/SAML IdP with SCIM provisioning, leaver deactivation within 1 h [DOC:p.188 §C] [LLM] (inferred) | Digest 05 silence (authority) | Login, provisioning and recertification work; Type A | Ask which IdP the client runs | Requesting user | estimation sign-off | no | open |
| ASM-CAD-1 | CAD toolchain is undecided; we estimate the stated baseline, SolidWorks PDM Professional via IF-17 [DOC:pp.198-199 §G] [LLM] (inferred) | Digest 05 silence (authority) | CAD connector effort and 4 CAD/Docs screens; Type A | Ask which PDM is licensed | Requesting user | estimation sign-off | no | open |
| ASM-EXT-1 | INV V3.0 and ACC V2.0 are referenced and version-locked [DOC:p.204 §1.1] but not supplied. We estimate PRD2 content only; base INV/ACC functions outside PRD2 are assumed built or estimated separately [LLM] (inferred) | Digest 01 silence (boundary) | Any base function PRD2 relies on but does not specify is missing from the estimate; potentially the largest gap; Type B | Ask whether INV V3.0 and ACC V2.0 are built, and supply them if not | Requesting user | estimation sign-off | yes | open |
| ASM-TIME-1 | Book IX modules and the Book VIII extra (advanced warehousing) are out of the go-live estimate; they are undated and activate only on evidence [DOC:p.289 §6, p.304] and are at most listed as optional line items [LLM] (inferred) | Digest 08 silence (after) | A large optional scope block; Type A for estimate | Ask whether any Book IX module must be priced now | Requesting user | estimation sign-off | no | open |
| ASM-SCOPE-1 | The screen baseline for estimation is the 78 Book VI entries [DOC:p.244] plus the 6 Book VII supplemental entries [DOC:pp.279-282], with INV-RETURN counted as a redirect that ships no screen, so 83 buildable entries; the 77-row table and "75+" are not used [LLM] (inferred) | Contradictions K-01, K-05 | Screen count drives most of the estimate; Type A | SME confirms the 83-entry list | Requesting user | estimation sign-off | no | open |
| ASM-SCOPE-2 | Wave items without a Book VI entry: count documents and safety stock are the Book VII entries INV-COUNT-DOC and INV-PLAN-SAFETY [DOC:pp.279-282]; pricing service surfaces and close orchestration are back-end services sized inside PRC-* and period-control entries [LLM] (inferred) | Contradiction K-06 | Two possibly unsized screens; Type A | SME says whether either needs its own screen | Requesting user | estimation sign-off | no | open |
| ASM-SCOPE-3 | Phase 2 items (EDI, SPC, audit) and Phase 3 items (actual costing, configurator, IF-21, portals, IF-20 OEE, optimizer) are excluded; field service execution is OUT [DOC:pp.204-205 §1.2] [LLM] (inferred) | Audit dim 13 (PRESENT, applied) | Estimate scope boundary; Type A | None needed unless the SME wants phases priced | Requesting user | estimation sign-off | no | open |
| ASM-LABEL-1 | Ten label types are built, the enumerated Book VII list [DOC:pp.285-286 §7], not seven [DOC:p.239] [LLM] (inferred) | Contradiction K-03 | Label template and print work; Type A | SME confirms the label list | Requesting user | estimation sign-off | no | open |

The first row, in italics, is a worked example of the shape and is not an entry.

## Standing rules

1. An assumption is never upgraded by repetition or by age. Only a named human upgrades it.
2. A refuted assumption is a Type B correction by default: route to requirements-reconciler,
   mark dependents stale, log it in STATE.md rework-log.
3. An assumption touching a rule, a status, a permission, or a lifecycle property may not be
   carried past Gate 2. It blocks (GUARDRAILS 2).
4. An assumption limited to layout, wording, or visual treatment may be carried to handoff,
   listed in the manifest as a known open.
5. Assumptions are disclosed to the client at every gate, as a list. Nothing here is internal.

## Register summary (update at each gate)

| Gate | Open | Confirmed | Refuted | Blocking |
|---|---|---|---|---|
| Intake (2026-10-09) | 18 | 0 | 0 | 5 at Gate 2 (ROLE-1, PERM-1, EXC-1, OQ-1, EXT-1) |
| Gate 1 | | | | |
| Gate 2 | | | | |
| Gate 3 | | | | |
| Handoff | | | | |

---

**Key.**
`[DOC:p.n §x]` the client's own document, with page and section ·
`[LLM]` inferred by a model and not yet verified by anyone ·
`(inferred)` nobody has said it; reasoning produced it.
**Type A** a surface fix: a screen, wording, layout · **Type B** a rule change: a rule, a record
type, a status, a permission, a requirement. Type B goes through the requirements document before
anything is redrawn.
**K-nn** a row in `STATE.md > Open contradictions`.
