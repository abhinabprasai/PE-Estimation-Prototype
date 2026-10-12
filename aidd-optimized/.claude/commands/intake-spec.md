---
description: "Classify whatever arrived as the project spec, audit it against the fourteen dimensions, fill the PRD placeholder, and start the substitute path when there is no spec"
---
Run spec intake for the current project. Delegate to discovery-lead with the spec-intake skill.
This runs before anchor-analysis, always, including when someone says a PRD is coming next week.

Optional argument: $ARGUMENTS names a newly arrived document to intake (re-run on a late spec).

1. **Inventory** every file, link, login and named conversation offered as input: what it is,
   who gave it, date.
2. **Classify** the set: A full spec / B partial / C gap document / D deck or notes /
   E existing product / F nothing. Record in `PROJECT_CONFIG.md > anchor_document` and STATE.
3. **File and freeze** everything into `00-inputs/` read-only, origin-and-date filenames.
4. **Fill the header block** on `00-inputs/PRD.md`: class, origin, date, supplied-by, substitute
   path. This file is never absent and never left as an unedited template.
5. **Audit** against the fourteen dimensions
   (`spec-intake/references/spec-audit-checklist.md`), scored PRESENT / PARTIAL / ABSENT with a
   section reference. Four or more ABSENT reclassifies the project to class D regardless of how
   the document looks.
6. **Convert absences**: each ABSENT and PARTIAL becomes a question for question-generation,
   grouped by who can answer it, or an assumption register entry where nobody can.
7. **Open `00-inputs/assumptions.md`** from `templates/assumption-register.md`. Every entry gets
   a blast radius, a cheapest test, a named owner and a decision date.
8. **Start the substitute path** for classes C through F: schedule the six-pass reconstruction
   interview, or run the product audit for class E.
9. **Disclose**: add the missing-spec fact to `STATE.md > blockers` if it applies, so it appears
   in every gate report until a signed brief exists.
10. **Hand off**: audit and questions to question-generation, term list to glossary-builder, the
    identified anchor to anchor-analysis.

Report: the class, the audit scorecard, the count of new questions and new assumptions, the
substitute path and its owner, and the next action.
