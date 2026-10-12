# Question Bank

Reusable primitives. Instantiate with the project's specifics; never deliver a stem raw with a
generic noun in it. A question containing "your process" instead of the process's actual name
signals to the DA that the team did not read their document.

---

## Per-silence-class stems

| Silence class | Stems |
|---|---|
| BEFORE | "What has to happen before {process} can start?" / "How do you find out it is time to {task}?" / "Who or what tells you?" |
| AFTER | "When {process} finishes, who picks it up next?" / "What would they say if your output was late or wrong?" |
| FAILURE | "When did {process} last go wrong? Take me through it." / "How long until someone noticed, and who ate the cost?" |
| VOLUME | "How many {records} in a normal week? In the worst week you remember?" / "How long does one take, door to door?" |
| EXCEPTION | "What do you do when {rule} can't be satisfied but the work has to happen anyway?" / "Who is the person people go to when it breaks?" |
| AUTHORITY | "Who can approve that? Who can override the approval?" / "Has an override ever been overridden?" |
| BOUNDARY | "Run me through {process} at month-end. What is different?" / "What does the auditor ask about this every year?" |
| REVERSAL | "Tell me about the last time one of these had to be undone." / "Is the record corrected, reversed, or deleted, and who may do it?" |

## Ladder rungs

**Concretize** (always first when an answer is abstract):
- "Walk me through the most recent time that happened, start to finish."
- "Show me one." (the strongest question in the bank; a real record beats any description)
- "What exactly did you type / write / click?"

**Edge**:
- "When did that not work?"
- "Always? Even when {edge from the commitment scan}?"
- "What is the closest thing to an exception you have seen?"

**Actor**:
- "Who decides that? Who can override them, and how often does that actually happen?"
- "Whose job is it to notice when it is wrong?"

**Stake**:
- "If this were wrong for a month before anyone noticed, what would the damage be?"
- "What is the most expensive version of this mistake you have seen?"

**Ladder up** (attribute → consequence → value; stop after two rungs):
- "Why does that matter?"
- "And what does that get you / protect you from?"

**Ladder down** (abstraction → mechanics):
- "What does that look like on the screen / on paper?"
- "Which field, exactly?"

## JTBD switch/history group (when replacing something or a past attempt exists)

Timeline reconstruction, walked backwards from today:
- "When did you first think 'we need to change this'? What happened that day?"
- "What did you try between then and now?"
- "What happened to the last attempt at fixing this?"
- "What made this month the moment, rather than last year?"

The four forces, probed directly after the timeline exists:
- Push: "What is the cost of staying as you are?"
- Pull: "When you imagine this working, what specifically is better on a Tuesday morning?"
- Anxiety: "What almost stopped you from starting this project? What worries you about it now?"
- Habit: "What about the current way actually works well and must not be lost?"

The habit question is the sleeper: its answers are constraints the new design must honour, and
they are almost never in the anchor document.

## Workaround excavation (highest-yield in mature operations)

- "Where does someone keep a personal spreadsheet or notebook the official process doesn't know
  about?"
- "What do you re-type from one system into another?"
- "Which report do you export and then fix by hand before sending?"
- "What do new people get wrong in their first month?"
- "If {key person} won the lottery and left tomorrow, what would stop working?"

Every workaround is three findings at once: a requirement the current system missed, evidence of
its priority (someone spends effort on it weekly), and a sketch of the data model the user
actually needs (their spreadsheet's columns).

## Consequence probes (deliberate hypotheticals, marked as such)

- "If the system recorded this wrong and nobody noticed for a month, what happens?"
- "Which mistake here would you describe as unrecoverable?"
- "What would you never let the system do automatically, no matter how good it was?"

The last one maps the automation boundary better than any direct question about automation.

## Verification of constants

- "The document says {value}. Is that still right? Where does that number come from?"
- "What happens at {value} plus one?"
- "Who would know if this threshold changed last year?"

## Closing set (never cut, run verbatim)

- "What did I get wrong in what I just summarized?"
- "What should I have asked about that I haven't?"
- "Who sees this process completely differently from you?"
- "What are you worried we will get wrong in this project?"

## Anti-patterns (the lint pass looks for these)

| Banned form | Why | Rewrite |
|---|---|---|
| "Do you usually...?" | Yes/no plus embedded expectation | "Walk me through the last time..." |
| "You probably just X, right?" | Answer supplied in the question | "What happens next?" |
| "Would you use a feature that...?" | Opinion about an imagined future | "What do you do today when...?" |
| "How often do you X and who does Y?" | Compound; second half gets lost | Split |
| "Why don't you just...?" | Reads as criticism; produces defence, not data | "What has kept the current way in place?" |
| "Is that a problem for you?" | Invites polite agreement | "What does that cost you, if anything?" |
