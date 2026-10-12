# Refined Requirement Entry

> **What this is.** One rule this product has to follow. Where your original brief and what your team told us disagreed, this shows the disagreement, which answer we went with, and why.
>
> **Where it stands.** Draft until the domain expert confirms it in writing. Rules about who can do what must be confirmed before we design the screens.
>
> **What we need from you.** Confirm the rule, or correct it. A rule nobody confirms holds up every screen that depends on it.

| Field | Value |
|---|---|
| ID | REQ-{area}-{n} (stable across versions; never reused after retirement) |
| Original | as the anchor document stated it [DOC:section]; "none" where the document never had it |
| Correction | the authority's correction/addition [DA], date/source |
| Resolved | the statement the project builds against |
| Rationale | REQUIRED where Original and Correction disagree: why the resolution won |
| Sources | all contributing tags + confidence |
| **Outcome** | **`OUT-{n}` from `measurement-plan.md`, or `NONE` where the entry is mandatory by law or contract. An optional-partition entry with `NONE` was prioritized by seniority; find the outcome or move it down the list** |
| **Serves how** | **One line: the mechanism by which this requirement moves that outcome's indicator. "Reduces the wait at the approval crossing, which is 60% of OUT-2's cycle time." Not "improves efficiency"** |
| Dependent rule | glossary rule-bearing terms / ERD constraints this rests on |
| Depends on | REQ-IDs this entry requires |
| Feeds | REQ-IDs this entry enables |
| Status | confirmed / asserted-open (owner, deadline) / superseded (by version) / retired (reason) |

## The five quality rules (apply to every Resolved statement)

1. **Testable.** A reader can construct the passing case and the failing case from the statement
   alone. Test it with: if this entry were wrong, which gate should have caught it? If the answer
   is "none", it is untestable; rewrite.
2. **Atomic.** One requirement per entry. An "and" joining two obligations is two entries with
   their own IDs; compound entries break tracing because a step can implement half of one.
3. **Solution-free.** State what must be true, not which widget achieves it. "Approver sees the
   order total before deciding", not "a modal shows the total".
4. **Vocabulary-bound.** Every domain term exists in the glossary. A collision discovered here
   routes to glossary-builder before the entry closes.
5. **Quantified where quantifiable.** "Quickly", "large" and "rarely" are placeholders for
   numbers someone knows. Chase the number or mark the entry asserted-open.

## Rationale discipline

"The DA said so" is a tag, not a rationale. The rationale names the tiebreaker: a legal
requirement, a downstream cost, the authority's jurisdiction. Six weeks from now this column
answers "why does this rule work this way" or nobody does.

## Outcome discipline

The Outcome and Serves-how fields exist because a requirement document that can prove every
statement is implemented, and cannot say which of them mattered, ranks by seniority. Three rules:

- **`NONE` is legitimate and it is also a claim.** It says this entry is mandatory by law or
  contract, which means the authority class from `anchor-analysis` supports it. Policy and
  preference do not qualify; they compete like everything else in the optional partition.
- **Serves-how is a mechanism, not an adjective.** If the line could be written about any
  requirement in the project, it is not a mechanism.
- **The mapping is bidirectional and both directions are findings.** An optional entry serving no
  outcome, and an outcome served by no entry, both surface at the Gate 2 prioritization session.

## Dependency links

Depends-on and feeds turn Type B impact analysis into a lookup instead of an archaeology dig,
and they are what the staleness sweep walks to find every affected artifact. Unmaintained links
mean the next correction's blast radius is a guess.

## Version history

| Version | Date | Change | Source (gate, critique, refuted assumption, usability round) | Dependents marked stale |
|---|---|---|---|---|
| *4* | *2026-03-14* | *approval threshold 50,000, two approvers* | *Gate 1 correction* | *erd.md, 3 hi-fi specs, status-mapping.md* |

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.

**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
