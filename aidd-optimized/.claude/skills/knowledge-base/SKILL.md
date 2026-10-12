---
name: knowledge-base
description: "Builds and queries the project knowledge base: three source groups kept separate, an index written in the same action as the file, and answers that cite the item. Use for every ingestion and whenever an answer should come from evidence rather than memory."
---

# Knowledge Base Construction and Query

## Purpose
The single asset everything downstream reads: PRD drafts, prompts, spec documents, dummy
content. Coverage makes it useful; hygiene keeps provenance recoverable; the index makes it
real. The KB is also the mechanism that keeps a model-augmented team honest: an agent that must
answer "per which file?" cannot drift into fluent invention, which is the failure this whole
system exists to prevent (GUARDRAILS 7).

## Structure
```
20-research/
  kb-index.md            the map; an unindexed item does not exist
  client/                client-supplied material (mirrors 00-inputs where useful)
  authority/             DA and PO statements: transcripts, confirmations, written answers
  external/              research notes, incumbent notes, articles
```
Three groups, never mixed in one file. Mixing destroys the ability to know, later, whether an
answer came from the client's reality or industry convention (GUARDRAILS 8). A mixed file is
split on discovery, immediately, and the split is noted in the index so stale references can be
chased.

The groups also rank: for any domain question, authority/ beats client/ beats external/. A
conflict between groups is presented as a conflict (both cited), but the ranking tells the
asker which way the verification burden points: an external claim contradicting an authority
statement is a research error or a genuine finding for the DA; it is never silently preferred.

## Ingestion procedure

1. **Whole documents, not excerpts**; retrieval needs surrounding context, and excerpting is a
   silent editorial act that destroys evidence.
2. **Filename carries origin and date**: `{yyyy-mm-dd}-{source}-{slug}.md`. Binary originals
   stay in 00-inputs; the KB holds the text extraction plus a pointer.
3. **Index entry in the same action as the file**: file | group | provenance tag | one-line
   contents | date | ingested-by. Deferred indexing never happens; an unindexed week of
   ingestion is a KB nobody can trust to be complete.
4. **Upgrade scan on authority ingestion**: every new authority/ item is scanned for statements
   that upgrade existing (asserted) entries elsewhere (glossary, problem statements, register
   assumptions, requirement drafts). Notify the owning agent of each candidate upgrade; the
   scan is the mechanism by which written confirmations actually propagate instead of sitting
   unread in a folder.
5. **Load-bearing marks**: anything cited by refined-requirements.md, the ERD, or a hi-fi spec
   is marked (LB) in the index so nobody archives it and so the gate audit can check the
   citations still resolve.
6. **Conflict marks**: when an ingested item contradicts an existing item, mark both (CONFLICT
   #n) and route the pair to contradiction-mining. Ingestion is where cross-source conflicts
   surface earliest; catching them here is cheaper than at a gate.

## Query procedure (when another agent asks)

1. Search the index first, then inside candidate files.
2. Answer with the item cited: "per {file} [{tag}]: ...". Quote or tight-paraphrase; do not
   embellish.
3. The KB cannot answer: say exactly that, and route the question to open-questions.md. Never
   bridge with general knowledge; a confident unsourced answer is the failure this system
   exists to prevent. If general knowledge is genuinely useful, it is offered separately and
   labelled [LLM] (inferred), never blended into the cited answer.
4. Conflicting items across groups: present both with tags and the group ranking note; do not
   adjudicate.
5. Log recurring questions: three agents asking the same question means the answer belongs
   somewhere more visible (the glossary, the requirement entry, a README), and the pattern is
   reported to the orchestrator.

## Health audit (run at each gate, results into the gate readiness picture)

- **Citation resolution**: every (confirmed) claim in refined-requirements.md traces to an
  authority/ item that still exists and still says what is claimed. Broken citations are
  gate-relevant defects.
- **Group balance**: which group grew least since the last gate? A thin authority/ group means
  confirmations are verbal and unrecoverable; say so.
- **Index honesty**: pick three random index rows; does the one-liner still match the
  contents?
- **Coverage against the plan**: which open-questions remain unanswered with no research note
  attached?
- **LB integrity**: every (LB) item still referenced by something; every heavy-referenced item
  marked (LB).

## Deciding factors
- Curate late, not early: prune only when retrieval demonstrably suffers, and prune to an
  archive folder, never delete. Early curation optimizes for tidiness at the cost of evidence.
- Transcription quality: AI meeting notes are ingested as-is but tagged as machine notes; the
  human capture sheet is the authoritative version of the same session, and the index links
  them.
- The KB is shared infrastructure: workspace location, a second person named, listed in the
  handoff manifest. A KB in one person's personal tool is a project risk, not a convenience.

## Probing prompts (self-audit)
- Can every (confirmed) claim in refined-requirements.md be traced to an authority/ item?
- Which group grew least since last gate?
- Pick three random index rows: does the one-liner still match the contents?
- Which agent has NOT asked the KB anything this phase? (They are answering from memory;
  name the pattern to the orchestrator.)

## Quality bar (self-evaluation)
- Zero unindexed files in the three group folders.
- Every authority ingestion this phase ran its upgrade scan, with notifications sent.
- Conflict marks current; none silently resolved.

## Guardrails
- Client material never leaves the KB toward external tools or queries (GUARDRAILS 8).
- Group boundaries are hard; a mixed file is split on discovery, immediately.
- Never answer past the evidence: "the KB cannot answer that" is a correct and complete
  answer, and it routes the question rather than burying it.

## Output
- `kb-index.md`, current at all times
- Cited answers on demand; upgrade notifications; conflict routings
- Gate-time health audit note

## Exit criteria (per phase)
- Gate 1: all Phase 2A research and all transcripts ingested and indexed
- Gate 2: every refined-requirements citation resolvable; health audit clean or exceptions
  owned

## Failure modes
- Lazy base: everything downstream degrades quietly and the symptom appears as "subtly wrong
  PRD" two phases later.
- Personal-tool capture: the curator rolls off and the project loses its research memory.
- Silent bridging: a fluent answer with no citation enters a draft, hardens by repetition,
  and no gate can trace where it came from.
- Upgrade rot: written confirmations ingested but never scanned, so the artifacts they
  confirm stay (asserted) and block Gate 2 anyway.
