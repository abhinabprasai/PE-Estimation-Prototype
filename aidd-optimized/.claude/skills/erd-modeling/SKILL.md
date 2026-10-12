---
name: erd-modeling
description: "The entity model: closed status lists, cardinality proven by counterexample, lifecycle and temporal decisions, and the consequences note that tells designers what the interface may not offer. Use in Phase 2B, and in 2A for the tentative sketch."
---

# ERD Modeling

## Purpose
On rule-dense products the entity model IS the product, and getting it wrong is the most
expensive mistake available before build. The ERD is also where lifecycle rules live, and
lifecycle constrains the interface: records that are reversed rather than deleted cannot be
offered a delete button, however much a screen would prefer one. The consequences note is how
that constraint travels to every designer downstream.

## Entity card (templates/erd-entity.md, one per entity)

| Section | Content |
|---|---|
| Identity | How instances are identified by HUMANS (the number they say on the phone) and by the system; whether the human identifier can change, and what happens if it does |
| Attributes | name, type, required?, uniqueness, source (entered / derived / imported, and from where), [tag] per constraint |
| Relationships | related entity, cardinality (1-1 / 1-n / n-n), optionality (can it exist without?), on-delete/on-reverse behaviour |
| Status field | every value it can hold; the value list is closed and (confirmed); transitions with triggers and who may trigger |
| Permissions | per action (create / read / edit / void / reverse / export): which roles; field-level exceptions noted where a role may edit some attributes and not others |
| Lifecycle | immutable after which event? versioned? reversed-not-deleted? retention period and what "deletion" legally means here |
| Temporal | which attribute changes are historical facts (the price AT the time of the order) versus current-state lookups; see the temporal pass |
| Open items | every (asserted) constraint, with owner |

## Entity discovery and the split test

Seed entities from refined requirements, to-be flows, the discovery noun harvest (artifact
pass, workaround spreadsheets: every personal spreadsheet is an entity the current system
failed to model), and Gate 1's corrections to the tentative sketch. Cross-check against
incumbents' implied ERDs (incumbent-research draws them); diverge deliberately, with a
recorded why.

One entity or two, the test applied both ways:
- If two subsets of instances have different lifecycles or different permission sets, they are
  two entities wearing one name. Split.
- If two "entities" never differ in attributes, lifecycle, or permissions, and always appear
  together, they are one entity wearing two names (a glossary collision; route it).
- The suspicious cases are always the domain's central noun: "order", "case", "document".
  Central nouns accrete meanings for years; ask the DA the confusion probe ("which two of
  these do people confuse, and what goes wrong?").

## Status pass: the exhaustion protocol

For every entity with states, enumerate the closed value list WITH the DA:

1. Collect candidate values from every source: flows, the document, the incumbent's filter
   dropdowns, the current build's badges.
2. Read the list to the DA and ask "and what else can it be?" repeatedly until the answer is
   "nothing". Then probe the gaps: "what is it between X and Y?" (in-between states hide
   here), "what is it while it waits for Z?", "what is it if the user abandons it?", "has one
   ever been in two of these at once?" (if yes, there are two status fields wearing one name;
   split them).
3. For each value: trigger, who may trigger (permission matrix row), which transitions leave
   it, and which transitions are irreversible.
4. Terminal-state check: every status list has at least one terminal value, and every
   non-terminal value has a path to a terminal one. A record that can never finish is a queue
   that grows forever; a "terminal" state someone reopens is not terminal, and the reopening
   is a transition with a permission.

Every value becomes a screen state in Phase 3 (hifi-spec enumerates from this list); missing
values here are missing screens there, at Type B cost.

## Cardinality by counterexample

Ask for the counterexample, never the rule: "has there ever been an X with two Ys?" One real
counterexample beats any amount of "usually". The dangerous answers are "normally one" (which
means 1-n with a dominant case; model n, display for one) and "it depends" (which means a
condition nobody has stated; chase the condition, it is a rule). Optionality gets the same
treatment: "has an X ever existed without a Y, even for an hour?" Temporary orphans during
data entry are real states the interface must survive.

## Lifecycle pass (the expensive one)

Per entity, four questions, each requiring (confirmed):

1. **Immutability**: after which event can this no longer be edited (posted? approved?
   filed?)? Field-level nuance recorded: often the core is frozen and annotations stay open.
2. **Correction**: when it is wrong after that event, what happens? Reversal with a
   compensating record? A new version superseding the old? An authorized edit with an audit
   trail? The answer is a domain rule with legal weight in most rule-dense domains, and it is
   never "just fix it".
3. **Deletion**: has one ever been deleted outright? What happened next? What must the client
   be able to prove at audit time about records that "no longer exist"? Regulatory retention
   and privacy erasure obligations pull in opposite directions; where both apply, that
   tension is a named open item for the DA and possibly their lawyer, not a modeling choice.
4. **Retention**: how long, in what form, and what happens at the end of it.

## Temporal pass

For each attribute that references another entity's data (a price, a rate, an address, a
name): is the value AT-THE-TIME (copied and frozen when the record is created: the invoice
keeps the price it was issued at) or CURRENT (a live lookup)? Getting this wrong corrupts
history silently and is among the most expensive late discoveries in data-heavy products. The
probe: "if the {price/address/rate} changes tomorrow, should last month's {invoice} change
with it?" The answer is almost always no, and every no is a frozen copy the model must hold.

## Permission pass

Per action per entity, from the role list. Permissions differences change userflows, not just
button visibility; hand the matrix to flow-modeler and ux-architect. Include the meta-rules:
who grants permissions, whether permission changes are audited, and whether any action needs
two people (four-eyes rules surface here and nowhere else).

## The consequences note

One line per lifecycle/permission rule that constrains the interface, written for designers:
"X is reversed, never deleted: no delete affordance anywhere; provide reverse with reason
field." "Y is immutable after posting: edit affordances disappear at posted, annotations
remain." "Z requires four-eyes on approval: the approve control must not work for the
creator." This note is a mandatory input to hifi-spec, ux-flow-optimization (recovery
affordances), and interaction-design (no undo on irreversible transitions).

## Procedure
1. Seed entities; run the split test; resolve names against the glossary.
2. Attribute pass with sources; identity decisions per entity.
3. Status pass with the exhaustion protocol, DA present.
4. Cardinality and optionality by counterexample.
5. Lifecycle pass; temporal pass; permission pass.
6. Write the consequences note.
7. Developer review before Gate 2: their structural objections are Type B; log them. Their
   acceptance is a Gate 2 exit criterion. Book them early.

## Deciding factors
- rule_density low: collapse cards to Attributes + Relationships; skip passes unless a status
  sneaks in via flows (then run the status pass for that entity; a status machine present
  means the entity is rule-bearing whatever the config says).
- Incumbent structures inform, never dictate: [RESEARCH] cannot set a client rule, but an
  incumbent modeling something you did not is a question worth asking the DA.
- Reference data (currencies, tax codes, units) gets lightweight cards: owner, change
  frequency, and who maintains it in production. Unowned reference data becomes hard-coded
  lists that rot.

## Probing prompts (for the DA)
- "Walk me through the life of one {entity} from creation to the last thing that ever happens
  to it."
- "After it is {posted/approved}, what can still legally change? Who can do that?"
- "Has one ever been deleted outright? What happened next?"
- "Which two of these do people confuse, and what goes wrong when they do?"
- "At audit time, what must you be able to prove about this record?"
- "If the {rate} changes tomorrow, should last month's {invoice} change with it?"
- "Has an {entity} ever needed to be in two of these statuses at once?"

## Quality bar (self-evaluation)
- Every entity has a full card or a declared collapse (rule_density low).
- Every status list closed by the exhaustion protocol with the DA, not from memory; terminal
  check run.
- Every cardinality carries its counterexample question's answer.
- Zero (asserted) lifecycle rules outside the open-items section.
- Consequences note delivered and acknowledged by hifi-spec-designer and ux-architect.

## Guardrails
- Closed status lists and lifecycle rules ship only (confirmed); (asserted) lives in open
  items and blocks Gate 2.
- Incumbent structures inform, never dictate.
- No entity without a card; partial cards are marked DRAFT in the header.
- Status values discovered after Gate 2 are Type B corrections, routed, never quietly added.

## Output
- `40-models/erd.md`: diagram + full cards + consequences note + open items
- Permission matrix handed to flow-modeler and ux-architect

## Exit criteria (Gate 2)
- Developer acceptance recorded; zero open lifecycle items; consequences note delivered

## Failure modes
- Status leakage: values discovered in Phase 3 as "oh, it can also be pending-review", each
  one a missing screen and a Type B.
- Interface-blind lifecycle: the delete button that legally cannot exist ships in hi-fi and
  dies expensively in review.
- Temporal corruption: current-state lookups where at-the-time copies were required,
  discovered when a price change rewrites a year of invoices.
- Central-noun collapse: "order" modeled once because it is one word, splitting into three
  entities during build.
