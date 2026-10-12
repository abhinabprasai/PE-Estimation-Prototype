# Design Critique Report: {feature or set}, {date}

> **What this is.** The result of reviewing the design against our own written rules, before we show it to anyone. It lists what we found, how serious each thing is, and who is fixing it.
>
> **Where it stands.** Internal. Run before every review session.
>
> **What we need from you.** Nothing - this is for reference. The findings that matter to you appear in the review itself.

| Field | Value |
|---|---|
| Run for | pre-Gate 1 / pre-Gate 2 / pre-Gate 3 / on demand |
| Lenses run | 1 hierarchy, 2 consistency, 3 states, 4 accessibility, 5 content, 6 friction, 7 domain |
| Scope | which files, features and screens |
| Rules judged against | style-guide.md version, skills-md set, erd.md version, refined-requirements.md version, cost tables |
| Run by | |
| Attendees (if a session) | |

## Findings

| # | Lens | Location | Rule violated (or evidence) | Severity | Type | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | | | | S1/S2/S3/S4 | A/B | | open / fixed / routed |

Severity: **S1** blocker (violates a confirmed rule, breaks the accessibility floor, or makes the
task impossible) · **S2** major (materially harms the task) · **S3** minor (inconsistency with a
stated rule) · **S4** note (a preference; recorded and dropped).

Type: **A** touches a screen, drawing, wording or layout · **B** touches a rule, entity, status,
permission or requirement and routes to requirements-reconciler BEFORE any edit. When unsure, B.

## Perceptual and accessibility tests

| Test | Run on | Result | By | Date |
|---|---|---|---|---|
| Squint test | | | | |
| Five-second test | | | | |
| Greyscale / colour-blindness simulation | | | | |
| Keyboard-only pass | | | | |
| Zoom 200% and 400% reflow | | | | |
| Screen reader pass (name the software) | | | | |
| Automated scan (name the tool) | | | | |

An automated scan result is never reported as an accessibility assessment. A test not run is
recorded as not run.

## Recurring findings

The same finding on three or more surfaces is a rule problem, not three mistakes. List proposed
rule changes here for `style-guide-authoring`.

| Finding | Occurrences | Proposed rule change | File |
|---|---|---|---|
| *status badge uses colour only* | *11 screens* | *every status carries a word as well as a colour* | *skills-md/color.md* |

## Open S1 findings entering the gate

If any exist, they are declared in the gate's first two minutes. List them here with the reason
they could not be fixed and who owns them.

| # | Finding | Why unfixed | Owner | Date due |
|---|---|---|---|---|
| *1* | *focus ring invisible on the dark surface* | *needs a token change that repaints six screens* | *ui-designer* | *2026-04-05* |

## Quiet-result check

A critique with no findings is a warning, not a pass. If findings were unusually few, record which
probes were run before accepting it.

---

**Key.**
**S1** blocker - **S2** major, harms the task - **S3** minor - **SC** a craft judgment stated as a prediction, which goes to the next user session rather than to a fix - **S4** a preference, recorded and dropped.
