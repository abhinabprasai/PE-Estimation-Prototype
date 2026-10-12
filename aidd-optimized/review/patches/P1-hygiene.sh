#!/usr/bin/env bash
# P1 - mechanical hygiene fixes for the AIDD repo.
# Run from the repo root. Review `git diff` before committing.
set -euo pipefail

if [ ! -f GUARDRAILS.md ] || [ ! -d .claude/skills ]; then
  echo "Run this from the aidd repo root." >&2
  exit 1
fi

# Portable in-place sed (GNU and BSD).
sedi() { if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi; }

echo "== D-01: repoint the eleven 'GUARDRAILS 10' citations to section 12 =="
# They all mean 'tentative artifacts stay visibly rough' / 'one question at a time' /
# 'no em dashes', which live in section 12. Do this BEFORE renumbering 10a -> 10,
# or the renumber will make the broken refs silently resolve to the wrong section.
grep -rl 'GUARDRAILS 10)' --include='*.md' . | while read -r f; do
  sedi 's/GUARDRAILS 10)/GUARDRAILS 12)/g' "$f"
  echo "  $f"
done

echo "== D-01b: renumber GUARDRAILS 10a -> 10 =="
sedi 's/^## 10a\. /## 10. /' GUARDRAILS.md
grep -rl 'GUARDRAILS 10a' --include='*.md' . | while read -r f; do
  sedi 's/GUARDRAILS 10a/GUARDRAILS 10/g' "$f"
  echo "  $f"
done

echo "== D-29: give the design floor an addressable number =="
grep -rl 'GUARDRAILS design section' --include='*.md' . | while read -r f; do
  sedi 's/GUARDRAILS design section/GUARDRAILS 11/g' "$f"
  echo "  $f"
done

echo "== D-23: SKILL-INDEX says six blocks; every other file says nine =="
sedi 's/Per-feature specs: six blocks, all states/Per-feature specs: nine blocks, all states/' docs/SKILL-INDEX.md

echo "== D-26: garbled conformance output path =="
sedi 's#filed at `90-handoff/../STATE-adjacent` as ##' .claude/skills/process-evaluation/SKILL.md

echo "== D-27: as-is step fields are nine, not ten (row 1 is per-flow) =="
sedi 's/Every step has all ten fields/Every step has all nine step-level fields (Trigger is per-flow)/' \
  .claude/skills/as-is-mapping/SKILL.md

echo "== D-31: HTML entity in README =="
sedi 's/Developer &amp; Designer Guide/Developer \& Designer Guide/' README.md

echo "== D-32: USAGE lists a docs/ file that does not exist =="
sedi 's/this guide, onboarding, the skill index/this guide, the usage guide, the skill index/' docs/USAGE.md

echo "== D-33: the house style bans em dashes and content-design has one =="
sedi 's/—/ - /g' .claude/skills/content-design/SKILL.md

echo "== D-30: stop leaking probe markers into the shipped PDF =="
sedi 's/render(assemble(pages, True), pass2)/render(assemble(pages, False), pass2)/' docs/guide/build.py
sedi 's#^CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"#import shutil as _shutil\nCHROME = os.environ.get("CHROME") or _shutil.which("google-chrome") or _shutil.which("chromium") or "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"#' docs/guide/build.py

echo
echo "Done. Manual edits still required - see P1-notes.md:"
echo "  D-02  delete the contradictory sentence in gate-review/SKILL.md:96"
echo "  D-28  repoint the two 'GUARDRAILS 1' glossary citations"
echo "  build.py  remove the dead 'total' variable (~line 175) and fix the"
echo "            's-3-N' anchor off-by-one (lines 36-44)"
echo
echo "Then re-run: python3 docs/guide/build.py"
