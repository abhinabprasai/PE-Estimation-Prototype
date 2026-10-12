# The guide source

`AIDD-Guide.pdf` is generated from the HTML sources in this folder. Edit the HTML, not the PDF.

## Rebuilding

```bash
cd docs/guide
python3 build.py
```

Requires headless Chrome (at the standard macOS path), plus `pypdf` and `reportlab`:

```bash
pip3 install --user pypdf reportlab
```

The build runs two render passes. The first injects invisible probe markers at each section
anchor and extracts text to find which page each section lands on; the second re-renders with
real page numbers in the table of contents. Footers, page numbers and PDF outline bookmarks are
then stamped on with `pypdf` and `reportlab`. Intermediate files are deleted at the end.

## Files

| File | Contents |
|---|---|
| `guide.css` | All print styling: page setup, cover, typography, tables, callouts, cards |
| `01-front.html` | Cover, table of contents placeholder, how-to-read, Part 1 orientation |
| `02-mechanics.html` | Part 2: provenance, gates, corrections, conformance, no-spec, variables, design floor |
| `03-phases.html` | Part 3: every phase and gate, step by step |
| `04-agents.html` | Part 4: agent cards for all 14 |
| `05-skills.html` | Part 5: all 34 skills grouped by phase |
| `06-reference.html` | Parts 6 to 8: commands, templates, reference, troubleshooting, glossary |
| `build.py` | The build pipeline, including the section-to-page map used by the TOC |

## Adding a section

Add the content with an `id="s-..."` on its heading, then add a matching row to the `TOC` list in
`build.py` with its anchor, title and level (0 for a part, 1 for a section). The page number and
the bookmark are then generated automatically.

## Keeping it accurate

The guide describes the system as it is, so it goes stale when the system changes. Update it when
a skill, agent or command is added or removed, when a guardrail changes, or when the phase
sequence changes. The counts on the cover (14 agents, 34 skills, 9 commands) are hard-coded in
`01-front.html`.
