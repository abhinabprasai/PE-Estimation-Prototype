# Entity Card: {entity}

> **What this is.** One record type in the product - what it is, what it holds, which states it can be in, who may do what to it, and what happens to it over time. The last section translates all of that into what the screens may and may not offer.
>
> **Where it stands.** Draft until a developer has read it and the domain expert has confirmed the states.
>
> **What we need from you.** Confirm the list of states is complete, and that nothing can be deleted that should only be reversed.

Status: DRAFT / COMPLETE · Developer reviewed: {name, date} · Glossary term: {ref}

## Identity
| Question | Answer |
|---|---|
| How humans identify it | the number or name they say on the phone |
| How the system identifies it | surrogate key, if different |
| Can the human identifier change? | y/n; if yes, what happens to references to the old one |

## Attributes
| Name | Type | Required | Unique | Source (entered / derived / imported, from where) | Constraint tag |
|---|---|---|---|---|---|
| *supplier_ref* | *text, 12 chars* | *yes* | *yes* | *imported, from the supplier feed* | *must match the SUP-nnnnnn format* |

## Relationships
| Related entity | Cardinality | Optional? | Counterexample answer | On delete/void/reverse | Tag |
|---|---|---|---|---|---|
| *Supplier* | *one supplier, many invoices* | *no* | *"has an invoice ever had two suppliers?" - no, never* | *supplier cannot be deleted while invoices exist* | *frozen at the time* |

Cardinality is proven by counterexample ("has there ever been an X with two Ys?"), never by
rule. "Normally one" means 1-n with a dominant case: model n, display for one. "It depends"
means a condition nobody has stated yet; chase it, it is a rule.

## Status field
Closed value list, established with the DA by the exhaustion protocol ("and what else can it
be?" until the answer is nothing). Each value becomes a Phase 3 screen state.

| Value | Meaning | Trigger | Who may trigger | Transitions out | Irreversible? | Terminal? | Tag+confidence |
|---|---|---|---|---|---|---|---|
| *parked* | *held pending a query, not rejected* | *a clerk raises a query* | *clerk, approver* | *submitted, cancelled* | *no* | *no* | *`[DA]` (confirmed)* |

Terminal check: at least one terminal value exists, and every non-terminal value has a path to
one. A "terminal" state someone reopens is not terminal; the reopening is a transition with a
permission.

## Permissions
| Action | Roles allowed | Field-level exceptions | Two-person rule? | Tag |
|---|---|---|---|---|
| create / read / edit / void / reverse / export | | | | |

Meta-rules: who grants permissions, whether permission changes are audited.

## Lifecycle
| Question | Answer | Tag (must be confirmed) |
|---|---|---|
| Immutable after which event? | | |
| Field-level nuance (core frozen, annotations open?) | | |
| Correction mechanism when wrong afterwards (reverse / version / audited edit) | | |
| Has one ever been deleted outright? What happened next? | | |
| What must be provable at audit time? | | |
| Retention period and what "deletion" legally means here | | |

## Temporal
Per attribute referencing another entity's data: frozen at-the-time, or live current?

| Attribute | References | AT-THE-TIME / CURRENT | Probe answer ("if X changes tomorrow, should last month's record change?") |
|---|---|---|---|
| *unit_price* | *Product.price* | *AT-THE-TIME* | *"if the price changes tomorrow, should last month's invoice change with it?" - no* |

Getting this wrong corrupts history silently and is among the most expensive late discoveries
in data-heavy products.

## Interface consequences
One line per lifecycle/permission rule that constrains the UI, written for designers. Feeds
hifi-spec, ux-flow-optimization (recovery affordances) and interaction-design (commit patterns).

Example shapes:
- "{entity} is reversed, never deleted: no delete affordance anywhere; provide reverse with a
  reason field."
- "{entity} is immutable after posting: edit affordances disappear at posted, annotations remain."
- "{entity} approval requires four eyes: the approve control must not work for the creator."

## Open items
| Item | Why it is still (asserted) | Owner | Deadline |
|---|---|---|---|
| *whether a reversed invoice can be re-raised* | *Priya has not answered in writing* | *Priya* | *20 March* |

Open lifecycle items block Gate 2.

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.
