# _digests/

> **What this is.** One short summary per raw source - a call, a client document, an export, a
> product teardown. The project reads these instead of the sources.
>
> **Where it stands.** Filled as sources arrive.
>
> **What we need from you.** Nothing.

## Why this folder exists

A ninety minute transcript is roughly 18,000 tokens, and without this folder it gets read four
times: once by the glossary, once by contradiction mining, once on knowledge base ingestion, once
by as-is mapping. Four reads of three transcripts is most of a working session, and it is why
projects used to run out of room before Phase 1 closed.

`source-extractor` reads each source once, in its own context, and writes a digest under 400 words
here. Every downstream step reads the digest. The source stays in `00-inputs/` or `20-research/`
and is reopened only when a digest's block 6 names the reason.

| Produced by | Template | Read by | Checked at |
|---|---|---|---|
| source-extractor | `templates/source-digest.md` | every agent, instead of the source | every gate |

**The rule:** never read a raw source into the main thread when a digest exists. Never write a
digest by reading the source into the main thread either - delegate it.
