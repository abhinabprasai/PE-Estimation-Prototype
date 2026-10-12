# {Project} - handover to the build team, {date}

> **What this is.** Everything the people building this need in order to build it without coming
> back to us, and a map of where each thing lives. It also lists, honestly, what is still open.
>
> **Who it is for.** The developers who will build this, their lead, and the product owner.
>
> **What we need from you.** Read this before the walkthrough session. Bring the questions it does
> not answer; those are our defects and we fix them that week.

---

## The product in one page

*Three or four paragraphs, plain language. What this product is for, who uses it, what the main
job is, and the two or three rules that shape everything else. Someone joining the build team in
month three should be able to read this page and be useful.*

---

## The five things that will surprise you

The rules that are not obvious from the screens, that developers get wrong when nobody tells
them, and that are expensive to retrofit.

| # | The rule | Where it comes from | What it means for the build |
|---|---|---|---|
| *1* | *A reversed invoice is never deleted* | *Confirmed by Priya, 12 March* | *There is no delete anywhere in the product for this record. Reversal creates a new linked record and the original stays* |
| | | | |

---

## Where everything lives

| What you need | File | Status |
|---|---|---|
| *The rules the product must follow* | *`60-requirements/refined-requirements.md`* | *Signed 12 March* |
| *The data model, and what it means for screens* | *`40-models/erd.md`* | *Signed, developer-reviewed* |
| *Screen-by-screen specifications* | *`70-hifi/{feature}/spec.md`* | *Complete for the twelve prioritized features* |
| *The words used on screen* | *`70-hifi/{feature}/content.md`* | *Complete* |
| *Colours, type, spacing, components* | *`30-design-language/skills-md/`* | *Complete* |
| *What each business term means* | *`10-discovery/glossary.md`* | *Binding - name your variables after these* |
| | | |

---

## What we did not build, and why

Nobody is being tricked. Each of these was considered and cut, and the reason is here so you do
not have to ask.

| What | Why it was cut | What people do instead, for now |
|---|---|---|
| *bulk approval* | *below the line at Gate 2* | *approve one at a time, as today* |
| | | |

---

## What is still open

Honesty here is the point. You inherit whatever is on this list.

| # | Still open | Who owns it | What happens if it stays open |
|---|---|---|---|
| *1* | *retention period for reversed invoices* | *Priya* | *the build defaults to seven years and may be wrong* |
| | | | |

---

## Where to take a question

| The question is about | Ask | Not |
|---|---|---|
| *A rule, a status, who can do what* | *The requirements document, then the product owner* | *A designer's memory* |
| *A colour, a spacing, a component* | *The design language files* | *A screenshot* |
| *What a word means* | *The glossary* | *Guessing from context* |
| *Something none of those answer* | *Raise it - it means a document has a gap and we will fix the document* | *Working around it quietly* |

A question that a document already answers means the document is hard to find or hard to read.
Tell us which; both are our problem.

---

## The words that matter

Name your tables, variables and endpoints after these. Where the client's word and the obvious
technical word differ, the client's word wins.

| Word | What it means here | What it does NOT mean |
|---|---|---|
| *parked* | *held pending a query* | *rejected, and not cancelled* |
| | | |

---

*Prepared by {name}, {date}.*
