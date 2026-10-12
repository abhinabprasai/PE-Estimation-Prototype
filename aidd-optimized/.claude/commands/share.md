---
description: "Produce the client-facing version of the current moment: a gate brief, a walkthrough pack, or a validation pack. Plain language, no framework terms"
---
Produce the client-facing document for $ARGUMENTS (`gate-1` / `gate-2` / `gate-3` /
`walkthrough` / `validation` / `status`).

**Who reads this.** The product owner, the domain authority, and whoever else the client puts in
the room. They have not read this framework and they are not going to. If the document needs
someone from our team standing next to it reading it aloud, it is not finished (GUARDRAILS 12).

This is the one place the process produces a genuinely separate document rather than a plain
layer on top of a working file. The framing is different, not just the wording: a working
artifact records what we decided; a share document asks for something.

1. **Pick the template** from `templates/`:
   - `share-gate-brief.md` for `gate-1`, `gate-2`, `gate-3`
   - `share-handoff-walkthrough.md` for `walkthrough`
   - `share-gate-brief.md`, retitled, for `validation` and `status`

2. **Assemble it from the working artifacts.** Read the artifacts' header blocks first; if a
   header block is missing or is written in framework language, that is a defect to fix in the
   artifact, not to work around here.

3. **Translate, do not summarize.** Every framework term is replaced, not glossed:

   | In the artifact | In the share document |
   |---|---|
   | Type B correction | a change to a rule |
   | ORPHAN / GHOST | something we listed and did not build / something we built that nobody asked for |
   | (asserted), not yet (confirmed) | one person told us, and nobody has confirmed it in writing |
   | ASM-3 has a large blast radius | if this assumption is wrong, these four things change |
   | S1 finding, open | a problem serious enough that we would not ship it |
   | the register has not shrunk | we have not closed any open questions since the last review |
   | pain index delta | how much shorter the new process is |

4. **Lead with the ask.** The first thing on the page is what we need decided today and by whom.
   Not the agenda, not the method, not what we did.

5. **Name what is not known.** Every share document states the open assumptions and what is still
   unconfirmed, in plain words. Disclosure is a rule, not a courtesy (GUARDRAILS 10), and a client
   who discovers an assumption at handoff has been managed rather than informed.

6. **Write it to `workspace/{project}/share/{name}.md`.**

7. **Render it** if you want something to send rather than something to open:

   ```
   python3 tools/render-share.py workspace/{project}/share/{name}.md
   ```

   Produces a self-contained HTML file beside it. No network, no build step, prints cleanly.

8. **Report** the path and the one-line ask the document makes.

**The test before you file it.** Hand it to someone who has not been in the project. If they
cannot say what is being asked of them within a minute, rewrite it.
