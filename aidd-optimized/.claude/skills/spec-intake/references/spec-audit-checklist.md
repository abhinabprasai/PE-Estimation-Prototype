# Spec Audit Checklist (14 dimensions)

Score each PRESENT / PARTIAL / ABSENT. PRESENT requires a section reference. PARTIAL means the
document names the thing but does not specify it well enough to design or build against.
ABSENT is the useful score; resist the urge to round up.

Record as a table in `00-inputs/spec-intake.md`:

| # | Dimension | Score | Ref | Converts to |
|---|---|---|---|---|

---

## 1. Business goal and measure
Does the document say what outcome the business wants, and how it will know it got it?
- PRESENT: a stated goal plus at least one measurable indicator with a current baseline.
- PARTIAL: a goal with no measure, or a measure with no baseline.
- ABSENT: features listed with no stated outcome.
- **Converts to:** the consequences question group. Without this, prioritization has no
  ranking basis and every feature argument becomes taste.

## 2. Users and roles
Who uses it, in which role, how often, and with what expertise?
- PRESENT: named roles with their frequency of use and their expertise level.
- PARTIAL: "users" and "admins" with no further definition.
- **Converts to:** the ERD permission matrix and every userflow. This is the single highest
  leverage absence in the list; role count drives artifact count for the whole project.

## 3. Entities and their vocabulary
What things exist in this domain, and what does the client call them?
- PRESENT: nouns used consistently, with definitions.
- PARTIAL: nouns used inconsistently (two names for one thing, or one name for two).
- **Converts to:** glossary-builder term list and the tentative ERD.

## 4. Rules and constraints
What must always be true, what is never allowed, and which of those are legal or regulatory?
- PRESENT: stated rules with their source or authority.
- PARTIAL: rules stated as preferences ("ideally", "generally") with no authority.
- **Converts to:** DA verification list, top priority. Every rule found here is a candidate
  mandatory item that prioritization may never deprioritize (GUARDRAILS 6).

## 5. States and lifecycle
What statuses do the main records hold, and what can happen to a record after each event?
- PRESENT: closed status lists and the events that transition between them.
- PARTIAL: some statuses named in passing, no transitions.
- **Converts to:** erd-modeling status and lifecycle passes. Every missing status value is a
  missing screen in Phase 3; this dimension is where hi-fi scope is actually decided.

## 6. Permissions
Who may do what, and who can override whom?
- PRESENT: an action-by-role matrix, or prose that resolves to one.
- PARTIAL: "admins can do everything".
- **Converts to:** the ERD permission pass and the denied-experience design in userflows.

## 7. The current process
How is this done today, including the parts nobody is proud of?
- PRESENT: a described current process with actors and systems.
- PARTIAL: a description of the ideal current process (a common and misleading case).
- **Converts to:** as-is-mapping. Specs written by people who do not do the work daily score
  PARTIAL here almost always; treat a tidy as-is description as a warning.

## 8. Exceptions and failure handling
What happens when the normal path does not work?
- PRESENT: named exceptions with their handling and their handler.
- ABSENT is the default score here. Exceptions live in people's heads.
- **Converts to:** the exceptions question group, the highest yield per call minute.

## 9. Integrations and data boundaries
What other systems does this touch, in which direction, and who owns them?
- PRESENT: named systems, direction of flow, ownership, and sync expectations.
- **Converts to:** process-breakdown Downstream column and a technical risk row in STATE.

## 10. Non-functional expectations
Volume, concurrency, performance, availability, retention, audit, compliance.
- PRESENT: numbers, not adjectives. "10,000 rows per day", not "high volume".
- **Converts to:** density decisions in visual-design, table strategy in responsive-design,
  retention rules in the ERD lifecycle pass, and EngineeringSpec constraints.

## 11. Platform and environment
Desktop, mobile, tablet, offline, shared devices, hardware (scanners, printers, kiosks),
browser floor, assistive technology in use.
- PRESENT: named contexts with their share of usage.
- **Converts to:** responsive-design breakpoint decisions and accessibility target level.
  Warehouse gloves, bright sunlight, and shared terminals all change the design and none of
  them appear in a spec unless asked for.

## 12. Success and failure scenarios
What does a good day look like on this product, and what does a bad one look like?
- PRESENT: narrative scenarios with named actors.
- **Converts to:** ux-flow-optimization baselines and dummy-content shaping.

## 13. Out of scope
What is explicitly not being built?
- PRESENT: a stated exclusion list.
- ABSENT: the norm, and expensive. An unstated boundary is negotiated repeatedly, in every
  meeting, forever.
- **Converts to:** the scope boundary in prototype prompts (part 6) and the descope column of
  prioritized-features.

## 14. Open questions the client already knows about
Does the document admit what it does not know?
- PRESENT: an open-questions section. This is the strongest single quality signal a spec can
  carry; a document with no admitted unknowns was written to persuade, not to specify.
- **Converts to:** direct entries in open-questions.md, pre-owned.

---

## Reading the scorecard

| Pattern | Reading | Action |
|---|---|---|
| 10+ PRESENT | Rare and genuine. Verify commitments, do not re-derive. | Normal Phase 1, weighted to verification |
| Strong 1 to 6, weak 7 to 8 | Written by product, not by operations | Weight the call toward process and exceptions |
| Strong 7 to 8, weak 1 to 6 | Written by operations, not by product | Weight toward goals, measures, and scope |
| 4+ ABSENT | Reclassify as class D regardless of appearance | Reconstruction interview |
| 13 ABSENT with everything else PRESENT | A persuasion document | Trust its facts, distrust its confidence |
