---
name: content-design
description: "Every word on screen: labels, errors, empty states, confirmations and status wording, reviewed as a list rather than screen by screen. Use in Phase 3 for real copy, and whenever a message has to carry a rule."
---

# Content Design

## Purpose
The words are the interface. A user reads a label, an error, and a confirmation far more closely
than they look at a layout, and in rule-dense domains the microcopy is frequently where the
domain rule is actually communicated. Copy invented at build time is copy that contradicts the
glossary, hedges where the rule is firm, and blames the user for the system's ambiguity.

This skill treats copy as specification: written in the spec, traceable to a requirement or a
glossary entry, and reviewable before it ships.

Depth: `references/microcopy-patterns.md` (patterns and worked examples per surface).

Depth: `references/message-patterns.md` carries errors, the four empty states, confirmations, rule-bearing helper text, number and date formatting, and status messages. Load it when the step needs it, not before.

## Inputs
- `10-discovery/glossary.md`: the binding vocabulary source
- `60-requirements/refined-requirements.md`: the rules that helper text and errors express
- `40-models/erd.md`: status names as the user must see them
- `20-research/incumbents/`: the words users already know
- Client tone or brand guidance from `00-inputs/`, if any

## Terminology binding

The glossary is the source. This is the same hard rule that governs navigation labels
(`information-architecture`), applied to every word in the product.

- The client's term wins over the industry term, over the framework's default, over the shorter
  one, and over the designer's preference.
- One term, one concept, product-wide. Two words for one thing is the most common and most
  corrosive content defect: users conclude they are two things and design their work around the
  distinction.
- A word that appears in the product and not in the glossary is either a missing glossary entry
  or an invented concept. Both need resolving; neither is resolved by shipping.
- Where the client's term differs from the industry's, the client's is used and the industry's is
  kept for search and retrieval only (`glossary-builder`'s client-says / industry-says pair).

## Voice

Set once, stated concretely enough that a reviewer can cite a violation.

| Dimension | Default for this process's domain | Note |
|---|---|---|
| Person | Second person for the user ("your invoices"), first person plural for the system only where it acts ("we could not reach the payment provider") | Avoid "I" for the product |
| Tense | Present. "Saved", not "has been saved" | |
| Voice | Active. "The system rejected the entry" beats "the entry was rejected" where the actor matters | Passive is legitimate when the actor is genuinely irrelevant |
| Register | Plain and direct. Not chatty, not stiff | Expert users find jokes in error messages insulting on the fortieth reading |
| Humour | Not in errors, not in destructive confirmations, not in anything a user reaches when something has gone wrong | |
| Contractions | Fine, and they read as human | Consistency matters more than the choice |
| Case | Sentence case for everything: headings, buttons, labels, menu items, table headers | Title Case is a deliberate house style, chosen once |
| Punctuation | No trailing periods on labels, buttons, or single-sentence helper text. Periods in multi-sentence copy | |
| Length | The shortest wording that is still unambiguous. Brevity is not a goal on its own; ambiguity costs more than a word | |

## Labels

| Element | Rule |
|---|---|
| Field label | The noun the client uses, not an instruction. "Delivery date", not "Enter delivery date" |
| Button | The verb the user is performing, specific. "Create invoice", "Send for approval". Never "Submit", "OK", or "Yes" as a standalone |
| Menu and navigation item | A noun naming a place, from the glossary |
| Table column header | The attribute name, with the unit if constant |
| Tab | A noun naming a view of the same object |
| Section heading | What the section contains, in the user's terms |
| Toggle | The thing being switched, not the action. "Email notifications", not "Enable notifications" |
| Link | Where it goes. Never "click here"; never a bare "view" repeated in every row without an accessible name including the row |

Buttons in a confirmation must restate the action, so a user who reads only the buttons still
understands. "Delete invoice" and "Keep invoice" beats "Yes" and "No", which require the user to
have parsed the question correctly, in the state of mind where they are least likely to have done
so.

## Procedure

1. Read the glossary. Build the term-to-surface map: every user-facing word and its glossary
   source. Missing terms go back to `glossary-builder`.
2. Set voice rules concretely in `30-design-language/skills-md/content.md`.
3. Write the pattern set: labels, the four empty states, the four error kinds, confirmations by
   consequence tier, helper text, number and date formats.
4. Per hi-fi screen state, write the actual copy. Not "error message here"; the sentence.
5. Cite REQ-IDs beside any copy expressing a domain rule.
6. Review the copy alone, with no screens: read every string of a feature in a list. Contradictions,
   duplicate terms and tonal drift are obvious in a list and invisible on screens.
7. Check the whole set for terms outside the glossary and for one concept carrying two names.
8. Where the product will be translated, flag concatenated strings, embedded formatting, and
   anything relying on English word order.

## Deciding factors

- **Clarity over brevity, always.** An extra word that removes ambiguity is cheap. In domains
  where an error costs money, it is free.
- **Expert users want density in copy too.** Long explanatory sentences on a screen someone uses
  forty times a day become noise by the third day. State the rule once, tersely, in the place it
  applies.
- **Where the client's word is genuinely bad** (ambiguous internally, or colliding with another
  concept), that is a glossary conversation with the DA, not a unilateral improvement in the UI.
- **Do not write around a design problem.** Copy explaining why a confusing screen is laid out
  that way is a symptom; fix the screen.

## Probing prompts

Self-review:
- "Which word on this screen is not in the glossary?"
- "Which concept has two names in this feature?"
- "Read the buttons only. Is the action clear without the question?"
- "Does this error tell them what to do, or only what went wrong?"
- "Which of the four empty states have I collapsed into a generic one?"
- "Does this confirmation name the actual object and the actual consequence?"
- "Which helper text just restates its label?"
- "Would this message still make sense as the fortieth one today?"

For the DA:
- "Read this error out loud. Would you say that to a colleague?"
- "Is this the word you use, or the word the old system uses?"

## Guardrails

- Every user-facing term traces to `glossary.md` (GUARDRAILS 1: definitions are the client's
  reality).
- Copy expressing a domain rule cites its REQ-ID in the spec and may not soften a
  (confirmed) rule into a suggestion.
- Status labels come from the ERD's closed lists, rendered in the glossary's words.
- No real client names, identifiers or records in example copy (GUARDRAILS 7); use
  `dummy-content`.
- No em dashes in artifacts, per the house tone rules (GUARDRAILS 12). This applies to the
  artifacts; product copy follows the client's own conventions where they have any.

## Output

- `30-design-language/skills-md/content.md`: voice, label rules, error patterns, empty states,
  confirmation tiers, formatting rules
- Actual copy in every screen state of every `70-hifi/{feature}/spec.md`
- Term-to-surface map, with gaps returned to `glossary-builder`

## Exit criteria (Gate 3)

- Every screen state has real copy, not a placeholder
- Every term traces to the glossary; zero one-concept-two-names collisions
- All four empty states distinguished wherever a container exists
- Every rule-bearing string cites a REQ-ID
- Copy reviewed as a list, separately from the screens

## Failure modes

- **Placeholder copy shipped.** "Lorem" survives to build, or "Error occurred" becomes permanent.
- **Generic empties.** "No data" for all four cases, misleading users whose filter hid everything.
- **Database vocabulary leaking.** `PENDING_APPROVAL_L2` on a screen a customer sees.
- **Blame copy.** "You entered an invalid value", forty times a day, to an expert who entered
  exactly what the document said.
- **Two names, one thing.** The glossary said "consignment", the design says "shipment", and users
  spend a year asking which is which.
