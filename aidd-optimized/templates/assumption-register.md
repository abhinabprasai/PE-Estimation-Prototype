# Assumption Register - {project}

> **What this is.** Everything we are guessing, written down. Each line says what we assumed, what breaks if we are wrong, who can settle it, and by when. Nothing here is internal: this list is read out at every review.
>
> **Where it stands.** Live for the whole project. It should get shorter between reviews, not longer.
>
> **What we need from you.** Look down the 'who can settle it' column. Where your name appears, we need an answer by the date beside it.

Live for the project's life. Opened by spec-intake, reviewed at every gate, shrinks over time.
A register that has not shrunk between two gates means nobody is chasing answers; raise it.

Every artifact that depends on an entry here carries an ASSUMPTIONS box near its top listing
the IDs. A design built on an unlisted assumption is a design nobody can audit.

## Entries

### ASM-{area}-{n}

| Field | Content |
|---|---|
| Assumption | The statement being assumed true, written as a rule a developer could implement |
| Why needed | Which artifact or decision could not proceed without it |
| Origin | Which spec-audit ABSENT, open question, or gate discussion produced it |
| Provenance | `[LLM] (inferred)` unless a human has asserted it; upgrade only with a name and date |
| Blast radius | What becomes wrong if this is false: name the artifacts, the screens, and the rework class (Type A or Type B) |
| Cheapest test | The single question, document, or five-minute check that would settle it |
| Owner | A named person, never a role and never "the team" |
| Decision date | The date after which proceeding on this assumption becomes a risk, not a choice |
| Status | open / confirmed / refuted / superseded |
| Resolution | On close: what the answer was, who gave it, and which REQ-ID now carries it |

## Standing rules

1. An assumption is never upgraded by repetition or by age. Only a named human upgrades it.
2. A refuted assumption is a Type B correction by default: route to requirements-reconciler,
   mark dependents stale, log it in STATE.md rework-log (CLAUDE.md section 6).
3. An assumption with a blast radius touching a rule, a status, a permission, or a lifecycle
   property may not be carried past Gate 2. It blocks (GUARDRAILS 2).
4. An assumption with a blast radius limited to layout, wording, or visual treatment may be
   carried to handoff, listed in the manifest as a known open.
5. Assumptions are disclosed to the client at every gate, as a list, read aloud. Nothing here is
   internal.

## Register summary (update at each gate)

| Gate | Open | Confirmed | Refuted | Blocking |
|---|---|---|---|---|
| Gate 1 | | | | |
| Gate 2 | | | | |
| Gate 3 | | | | |
| Handoff | | | | |

---

**Key.**
`[DA]` domain authority, the person who rules on how the business actually works - `[PO]` product owner - `[USER:role]` an end user in that role - `[TEAM]` someone on our team - `[DOC:section]` your own document - `[RESEARCH:source]` outside research - `[LLM]` inferred by a model, not verified by anyone.
`(confirmed)` the domain authority verified it, on record - `(asserted)` a human said it once - `(inferred)` nobody has said it.

**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**blast radius** what breaks if this turns out to be wrong - **load-bearing** something else depends on this, so it cannot be changed quietly - **pain index** how expensive the current process is to run, counted in manual steps, errors, waiting time and systems touched.
