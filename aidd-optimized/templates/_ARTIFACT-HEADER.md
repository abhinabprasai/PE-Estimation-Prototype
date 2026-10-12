# The artifact header

Every artifact in this process opens with this block, before any table and before any method.
It is three short paragraphs and it is not optional (GUARDRAILS 12).

Copy this, fill it, delete the guidance in brackets.

```markdown
> **What this is.** [One paragraph, plain language, no framework terms. What this document
> decides, and who it is for. A designer who has not been in the project should be able to read
> this paragraph and know whether the rest of the file is for them.]
>
> **Where it stands.** [Draft / reviewed / signed, and what changed since the last version. One
> or two sentences. If nothing has changed, say so.]
>
> **What we need from you.** [The specific decision or confirmation being asked for, and from
> whom. If nothing is being asked, write "Nothing - this is for reference."]
```

## Why this exists

The artifacts in this process are read by product designers, product owners and domain experts.
Most are not technical, and none of them carry this framework in their heads. Before this header
existed, a reader opening `refined-requirements.md` met a table on line three and had to infer
from column names what the document was for.

Three things go wrong without it, and all three cost the project real time:

- The reader asks someone what the file is, which is a meeting that should have been a paragraph.
- The client is handed a document that a team member then has to read aloud to them. "Read aloud"
  appeared six times in this framework's own instructions, which was the symptom.
- Nobody can tell what changed since the last version, so the whole file gets re-read or, more
  often, none of it does.

## Rules

- **Plain language means plain.** No `[DA]`, no `(confirmed)`, no `Type B`, no `ORPHAN` in this
  block. Those belong in the body, where the key at the foot of the file defines them.
- **Lead with the decision, not the method.** "This decides which twelve features we build first"
  beats "This is the output of the prioritization skill".
- **"What we need from you" is a real question or it is "nothing".** A vague ask ("review and
  feedback") produces a vague answer, and then the gate produces the correction that this
  paragraph was supposed to prevent.
- **Under 150 words for the whole block.** A long header is a second document.

## Worked example

Poor:

```markdown
> **What this is.** The refined requirement document produced by requirements-reconciliation,
> reconciling the anchor document against DA corrections per GUARDRAILS 2, with dependency links
> and provenance tags per entry.
```

Good:

```markdown
> **What this is.** The single list of rules this product has to follow. Where your original
> brief and what your team told us disagreed, this is where we recorded the disagreement, which
> answer we went with, and why. Everything else we design points back at a line in here.
>
> **Where it stands.** Version 4, updated after the 12 March review. Six rules changed, all of
> them about who can approve an invoice. Those six are marked in the change log at the bottom.
>
> **What we need from you.** Priya to confirm rules 14 to 19 in writing. Until she does, we
> cannot start designing the approval screens.
```

Same document. The second one can be sent to a client.
