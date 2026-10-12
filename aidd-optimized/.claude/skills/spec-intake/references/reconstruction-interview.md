# Reconstruction Interview

For classes D, E and F: the project has no usable spec and must derive one. This is not a
requirements-gathering session. Requirements-gathering asks people what they want, and people
answer with solutions shaped by whatever software they last used. Reconstruction asks people
to narrate their world, and derives the spec from the narration.

Run it with the domain authority present. A hundred and five minutes is the working minimum (the six passes total ninety, plus a closing
of ten that is never cut, plus turnaround); two sessions
of seventy-five minutes beats one of two and a half hours, because the second session starts
with corrections to your first summary, and corrections are the highest-value minutes
available.

---

## Before the session

- Consent and recording confirmed on the record (interview-facilitation rules apply in full).
- Three-column capture sheet, [PO] [DA] [TEAM], plus SOLUTIONS-OFFERED and NEW-TERMS.
- Ask in advance for three real artifacts, redacted: one completed record, one that went wrong,
  and one report someone reads. If they arrive, read them before the call. Half the entity
  model is visible in a real document and none of it is visible in a description of one.
- If class E, walk the existing product first and bring specific screens to ask about.

---

## Pass 1: Goal (10 minutes)

Purpose: establish what "better" means before anyone describes a screen.

- "What is this part of the business responsible for delivering?"
- "How do you know, at the end of a month, whether it went well?"
- "What number does someone above you look at?"
- "What would have to be true for you to say this project was worth doing?"

Capture: the goal in their words, the measure, the current baseline value if they know it, and
who watches it. A goal with no measure is recorded as such; it becomes an open question, not an
invented KPI.

**Do not accept the first answer if it is a feature.** "We need a dashboard" is an answer to a
question nobody asked. Follow with: "and when you have that dashboard, what decision do you
make differently?"

---

## Pass 2: Actors (10 minutes)

Purpose: the role list, which drives the permission matrix, the userflow count, and half the
project's artifact volume.

- "Who touches this process, from the first trigger to the last thing that happens?"
- "For each: how often, and is this their main job or a corner of it?"
- "Who checks whose work?"
- "Who can override a rule, and how often does that actually happen?"
- "Who never touches the system but is affected when it is wrong?"

Capture: role, frequency, expertise, and override relationships. Expertise level is a design
input, not trivia: a role that uses the system eight hours a day gets density, keyboard paths
and shortcuts; a role that uses it twice a month gets guidance and confirmation.

The override question is the one that finds unwritten authority structures. Note that "the
manager approves it" and "the manager can approve it but Sandra actually does" are different
systems.

---

## Pass 3: Artifacts (20 minutes, the longest pass)

Purpose: the entity model, extracted from things rather than from abstractions.

Work from real documents where you have them. For each:

- "Walk me through this document. What does each part mean?"
- "Where does each field come from? Who fills it, and from what?"
- "Which fields does anyone actually read?"
- "What makes this one different from a normal one?"
- "What happens to this after it is done? Who keeps it, and for how long?"
- "Can this ever be changed after it is issued? By whom, and is there a record?"

Every noun that has a lifecycle is a candidate entity. Every noun that only ever appears as a
property of another noun is an attribute. Every list a person maintains outside the system
(spreadsheet, notebook, sticky notes on a monitor) is an entity the current system failed to
model, and is nearly always the most valuable finding of the session.

Capture into the NEW-TERMS list aggressively; classification into entity versus attribute
happens later with data-modeler, not live.

---

## Pass 4: Rules (20 minutes)

Purpose: the constraints, separated by authority, because legal rules and preferences look
identical in conversation and behave completely differently in prioritization.

- "What must always be true about a {entity} before it can be {issued/approved/sent}?"
- "What is never allowed, no matter who asks?"
- "Which of those is a law or a contract, and which is how you prefer to work?"
- "Who decided that rule, and could they un-decide it?"
- "What does the system currently let you do that it should not?"

Capture each rule with its authority: legal / contractual / policy / preference. Then mark
which are (confirmed) by this DA and which are hearsay about someone else's rule. A "legal
requirement" that nobody can name the source of goes into open-questions; roughly a third of
them turn out to be a policy from 2014 that nobody has revisited.

The last question in the list is the leak detector. Every answer is a constraint the current
system does not enforce, which means a workaround exists, which means there is a step in the
as-is that nobody has mentioned yet.

---

## Pass 5: Exceptions (20 minutes)

Purpose: the part of the domain that exists only in people's heads, and the reason this process
front-loads discovery at all.

- "When did this last go wrong? Take me through it."
- "What do you do when {a rule from pass 4} cannot be satisfied but the work has to happen?"
- "Which of these exceptions happens weekly? Which has happened once, ever, and still matters?"
- "Who gets called when it breaks, and what do they have that others do not?"
- "What does the paperwork look like after an exception? Is the record different?"

Capture frequency and cost separately. A weekly exception with a cheap fix is an interface
problem; a rare exception with a catastrophic cost is a rule the design must make impossible to
violate. These are different design responses and conflating them produces both over-engineered
common paths and under-defended rare ones.

Every exception that routes to a human becomes a step in someone's userflow later
(userflows-sitemap), so capture who receives it.

---

## Pass 6: Consequences (10 minutes)

Purpose: the error budget. This determines how much friction the design is allowed to spend on
prevention, which is otherwise decided by taste.

- "If the system recorded this wrong and nobody noticed for a month, what happens?"
- "Who discovers the mistake, and how?"
- "What does fixing it cost, in time and in anything else?"
- "Which mistake here would you describe as unrecoverable?"

Capture per process area: detection latency, detection mechanism, remediation cost, and whether
recovery is possible at all. Feed directly to ux-flow-optimization: irreversible plus expensive
earns a confirmation step and an undo window; cheap and instantly visible earns neither, and
adding one there is friction with no buyer.

---

## Closing (10 minutes, never cut)

Summarize back in your own words, pass by pass. Then:

- "What did I get wrong?"
- "What did I not ask about that I should have?"
- "Who else sees a completely different version of this process?"

The last question sources the next interview. Reconstruction is rarely complete after one
person, because roles see disjoint slices and each believes they see the whole.

---

## After the session

1. Write `10-discovery/derived-brief.md` the same day. Structure it exactly like a spec so it
   can be audited by the same 14-dimension checklist: goal and measure, actors, entities, rules,
   states, permissions, current process, exceptions, integrations, non-functional, platform,
   scenarios, out of scope, open questions.
2. Score it with `spec-audit-checklist.md`. Your own brief will have ABSENTs. Good; they are now
   visible instead of imagined.
3. Send it for written confirmation. State plainly in the covering note: "this is my
   reconstruction of what you told me, and where I have guessed I have marked it. Correct
   anything wrong; I will build from this." Corrections to a written brief are far cheaper and
   far more forthcoming than answers to open questions.
4. Once signed, `derived-brief.md` becomes the anchor document. Record the supersession pointer
   in `00-inputs/PRD.md` and set `anchor_document: supplied` with a note that it was derived.
5. Unsigned after two chases: escalate. Everything downstream is capped at (asserted), and
   Gate 1 must be told this in its first sentence.

---

## Anti-patterns

- **Asking for features.** Produces a wish list shaped by the last tool they used, with no
  underlying model. If someone offers features anyway, capture in SOLUTIONS-OFFERED and steer
  back (interview-facilitation step 4).
- **Accepting the tidy version.** People describe the process as it is supposed to work. Every
  pass needs at least one "walk me through the last actual time" to break the abstraction.
- **Interviewing only management.** Management knows the intent; operations knows the truth. A
  reconstruction with no operational voice produces a beautiful, wrong brief.
- **Filling gaps with plausibility.** A gap in the narration is an open question. The brief's
  credibility rests entirely on the marks being honest.
