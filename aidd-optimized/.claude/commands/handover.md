---
description: "Close the session cleanly: write the resume contract so the next session can start cold without re-reading anything"
---
Write the handover for the current project so this session can end here.

Run this at every phase boundary, before any long break, and the moment the session feels heavy.
A session should never have to span a phase.

**Why this exists.** The expensive thing in this process is not the framework; it is the raw
material - transcripts, client documents, exports - accumulating in one long conversation and
being re-read four times. A session that ends cleanly and resumes from a written contract costs a
fraction of a session that runs until it falls over.

1. **Update STATE.md fully.** It is the resume contract, not a journal:
   - `phase`, `next_gate`, `blockers`
   - the freshness table, from the last conformance run
   - the rework log, if anything landed this session
   - open contradictions, with owners and due dates
   - the assumption register summary counts

2. **Write `workspace/{project}/HANDOVER.md`**, overwriting the previous one:

   ```markdown
   # Handover - {project}, {date}

   > **What this is.** Everything the next session needs to start cold. If you are picking this
   > up, read this file and STATE.md and nothing else until you know what you are doing.

   ## Where we got to
   Two or three sentences in plain language. What was decided, not what was done.

   ## What is true now that was not true this morning
   The decisions, corrections and confirmations that landed. One line each, with who.

   ## What is in flight
   Started and unfinished, with the file it lives in and what "finished" looks like.

   ## The next three actions
   | # | Action | Owning agent | Blocked by |

   ## What NOT to re-read
   The sources already digested this session, with their digest paths. The next session reads
   the digest, never the source, unless the digest's block 6 says otherwise.

   ## Open questions for a human
   Anything waiting on a person, with who and since when.
   ```

3. **Confirm every raw source read this session has a digest** in `_digests/`. A source read
   without a digest means the next session will read it again, which is the exact cost this
   command exists to remove. If one is missing, run source-extractor on it now.

4. **Run `/verify`** if the last snapshot is older than its cadence, so the next session starts
   on a known state rather than an unknown one.

5. **Report** the three next actions and say plainly that the session can be ended here.
