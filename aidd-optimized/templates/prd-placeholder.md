# PRD / Project Spec - {project}

> **What this is.** The slot where your specification lives. It holds your document exactly as you sent it, or - if there was no document - a record of what we received instead and how we are filling the gap.
>
> **Where it stands.** Never empty. If it still looks like a blank form, nobody has decided how this project learns what it is building.
>
> **What we need from you.** Nothing, unless the substitute path section names you.

> **THIS FILE IS THE SPEC SLOT.** It exists in every project from creation and is never
> deleted, never left blank, and never left as an unedited template. It holds exactly one of
> two things:
>
> 1. **The client's supplied spec**, filed verbatim below the header block, read-only.
> 2. **The placeholder record**, completed by `spec-intake`, declaring what is missing and
>    which substitute path is running.
>
> An unedited copy of this template in a project past Phase 0 is a process defect: it means
> nobody decided how this project will learn what it is building. Run the `spec-intake` skill.

---

## Header block (always filled)

| Field | Value |
|---|---|
| Intake class | A full spec / B partial / C gap doc / D deck or notes / E existing product / F nothing |
| Status | SUPPLIED / PLACEHOLDER / SUPERSEDED |
| Origin | who supplied it, or "not supplied" |
| Received | date, or "n/a" |
| Client version | their version or revision label, if any |
| Filed at | `00-inputs/{filename}` for the verbatim original |
| Substitute path | the artifact standing in for a spec, if class is not A |
| Audit | `00-inputs/spec-intake.md`, scored on {date} |
| Assumptions | `00-inputs/assumptions.md`, {n} open at last gate |
| Superseded by | `60-requirements/refined-requirements.md` from Phase 2B, or the signed derived brief |

---

## If a spec was supplied

Paste or reference the client document below this line, unedited. Do not correct it, do not
reformat it, do not summarize it here. Corrections happen in
`60-requirements/refined-requirements.md`, which records what the document said, what the
domain authority corrected, and why the resolution won.

Where the document is a binary (PDF, DOCX, deck), keep the original in `00-inputs/` and put its
filename plus a one-paragraph description of what it covers here.

<!-- CLIENT SPEC BEGINS -->

{paste or reference here}

<!-- CLIENT SPEC ENDS -->

---

## If no spec was supplied (the placeholder record)

### What we have instead

| Input | Type | Source | Date | What it evidences |
|---|---|---|---|---|
| *Ops process deck* | *slides* | *Priya, by email* | *2026-02-28* | *the approval chain and the roles in it* |
| | | | | |

### What is running in its place

- [ ] Reconstruction interview scheduled or held: `10-discovery/derived-brief.md`
- [ ] Product audit (class E): `00-inputs/audit/`
- [ ] Assumption register opened: `00-inputs/assumptions.md`
- [ ] Absences converted to questions: `10-discovery/questions.md`

Owner of the substitute path: {name}
Target date for a signed brief: {date}

### The fourteen dimensions, at intake

Copy the scored table from `00-inputs/spec-intake.md` here so a reader of this file alone knows
what the project does and does not know.

| # | Dimension | Score | Where it now lives |
|---|---|---|---|
| 1 | Business goal and measure | | |
| 2 | Users and roles | | |
| 3 | Entities and vocabulary | | |
| 4 | Rules and constraints | | |
| 5 | States and lifecycle | | |
| 6 | Permissions | | |
| 7 | Current process | | |
| 8 | Exceptions and failure handling | | |
| 9 | Integrations and data boundaries | | |
| 10 | Non-functional expectations | | |
| 11 | Platform and environment | | |
| 12 | Success and failure scenarios | | |
| 13 | Out of scope | | |
| 14 | Client's own open questions | | |

### Disclosure

The absence of a supplied spec is stated in `STATE.md > blockers`, in every gate report until a
signed brief exists, and in the handoff manifest. It is not managed around quietly.

---

## If a spec arrives late

Do not delete this file. Add a row to the header block recording the arrival date, file the new
document in `00-inputs/`, and run `spec-intake` again on it. Then reconcile: everything the
project already derived is compared against the new document, and every disagreement is a
contradiction with an owner (GUARDRAILS 3), not a reason to discard the derived work.
