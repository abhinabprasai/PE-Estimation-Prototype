#!/usr/bin/env python3
"""
AIDD conformance engine.

Runs the four sweeps (traceability, staleness, provenance, drift) over a project
workspace and writes a snapshot. This is deliberately a script and not model work:
the sweeps are regex, set comparison and a dependency graph, and doing them by
reading every artifact into a context window costs roughly 100k tokens per run,
which is why the standing cadence never actually gets run.

Usage:
    python3 tools/conformance.py <workspace/project> [--sweep full|trace|stale|provenance|drift]
                                                     [--scope PATH_OR_REQID]
                                                     [--json]

Exit codes:  0 clean or minor findings   1 major findings   2 BLOCKING findings

The script reports and routes. It never edits an artifact. Independence is what
makes the findings trustworthy (CLAUDE.md 7a).
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
from collections import defaultdict

# --------------------------------------------------------------------------
# Configuration: the dependency graph from CLAUDE.md section 5.
# "A -> B" means B reads from A, so a change to A stales B.
# Keys and values are glob-ish path fragments relative to the project root.
# --------------------------------------------------------------------------

DEPENDS_ON = {
    "10-discovery/problem-statements.md": ["00-inputs/PRD.md", "10-discovery/transcripts/",
                                           "10-discovery/anchor-analysis.md"],
    "60-requirements/refined-requirements.md": ["10-discovery/problem-statements.md",
                                                "10-discovery/derived-brief.md",
                                                "00-inputs/assumptions.md"],
    "40-models/to-be/": ["60-requirements/refined-requirements.md", "40-models/as-is/"],
    "40-models/erd.md": ["60-requirements/refined-requirements.md",
                         "20-research/incumbents/"],
    "40-models/process-breakdown.md": ["60-requirements/refined-requirements.md",
                                       "40-models/erd.md"],
    "40-models/flow-optimization/": ["40-models/to-be/"],
    "40-models/ia.md": ["40-models/flow-optimization/", "40-models/erd.md",
                        "10-discovery/glossary.md"],
    "40-models/userflows/": ["40-models/ia.md", "40-models/erd.md"],
    "40-models/sitemap.md": ["40-models/ia.md", "40-models/erd.md"],
    "20-research/kb-index.md": ["10-discovery/open-questions.md"],
    "30-design-language/style-guide.md": ["40-models/erd.md", "20-research/incumbents/"],
    "30-design-language/skills-md/": ["30-design-language/style-guide.md"],
    "30-design-language/prompts/": ["30-design-language/skills-md/", "20-research/kb-index.md"],
    "60-requirements/prioritized-features.md": ["60-requirements/refined-requirements.md",
                                                "60-requirements/measurement-plan.md"],
    "70-hifi/": ["60-requirements/refined-requirements.md",
                 "60-requirements/prioritized-features.md",
                 "40-models/erd.md", "40-models/ia.md",
                 "30-design-language/skills-md/"],
    "70-hifi/status-mapping.md": ["40-models/erd.md"],
}

# The two staleness paths CLAUDE.md flags as easy to miss and expensive to skip.
NAMED_CASCADES = [
    ("40-models/erd.md",
     ["30-design-language/skills-md/color.md", "30-design-language/skills-md/components.md",
      "30-design-language/skills-md/states.md", "70-hifi/", "70-hifi/status-mapping.md"],
     "ERD status list changed: stales the status encoding map, every component state matrix "
     "displaying it, and every hi-fi screen state derived from it"),
    ("40-models/ia.md",
     ["40-models/userflows/", "40-models/sitemap.md"],
     "IA changed: stales every userflow, the sitemap and the route scheme"),
]

SOURCE_TAGS = ["PO", "DA", "USER", "TEAM", "DOC", "RESEARCH", "LLM"]
TAG_RE = re.compile(r"\[(?:" + "|".join(SOURCE_TAGS) + r")(?::[^\]]*)?\]")
CONF_RE = re.compile(r"\((?:confirmed|asserted|inferred)\)")
REQ_RE = re.compile(r"\bREQ-[A-Za-z0-9]+-\d+\b")
ASM_RE = re.compile(r"\bASM-[A-Za-z0-9]+-\d+\b")
PS_RE = re.compile(r"\bPS-\d+\b")
OUT_RE = re.compile(r"\bOUT-\d+\b")

# `[LLM] (inferred)` is allowed only in these zones.
LLM_QUARANTINE = ("10-discovery/open-questions.md", "20-research/research-notes/",
                  "30-design-language/prompts/", "_digests/")

# Files whose statements constrain behaviour and therefore need (confirmed).
CONFIRMED_REQUIRED = ("60-requirements/refined-requirements.md", "40-models/erd.md",
                      "70-hifi/status-mapping.md", "40-models/process-breakdown.md")

SKIP_DIRS = {"ARCHIVED", "conformance", "share", ".git", "_to_delete"}
SKIP_NAMES = {"_PLACEHOLDER.md", "README.md"}


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def walk_md(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(".md") and fn not in SKIP_NAMES:
                yield os.path.join(dirpath, fn)


def rel(root, p):
    return os.path.relpath(p, root).replace(os.sep, "/")


def newest_mtime(root, frag):
    """Latest mtime under a path fragment (file or directory)."""
    p = os.path.join(root, frag)
    if os.path.isfile(p):
        return os.path.getmtime(p)
    if os.path.isdir(p):
        best = 0.0
        for dp, dn, fns in os.walk(p):
            dn[:] = [d for d in dn if d not in SKIP_DIRS]
            for f in fns:
                if f.endswith(".md") and f not in SKIP_NAMES:
                    best = max(best, os.path.getmtime(os.path.join(dp, f)))
        return best or None
    return None


def exists(root, frag):
    return os.path.exists(os.path.join(root, frag))


PLACEHOLDER_RE = re.compile(r"^#\s.*\{[a-z_]+\}|Maintained by |Copy this, fill it|"
                            r"^# The (artifact header|key block)", re.M)


def raw_head(path, n=1200):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read(n)
    except OSError:
        return ""


def strip_noise(text):
    """Remove fenced code, block quotes and the artifact header/key blocks so the
    provenance sweep does not flag instructional prose."""
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"^>.*$", "", text, flags=re.M)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    return text


def is_claim_line(line):
    """A line that asserts something about the client's world and therefore needs a tag.

    Heuristic and deliberately conservative: table rows and bullets carrying a verb
    of assertion, at least eight words, not a heading, not a template placeholder."""
    s = line.strip()
    if len(s) < 40 or s.startswith("#") or s.startswith("|---") or s.startswith("---"):
        return False
    if "{" in s and "}" in s:          # template placeholder row
        return False
    if s.count("|") >= 2 and set(s.replace("|", "").strip()) <= set(" -:"):
        return False
    words = re.findall(r"[A-Za-z']+", s)
    if len(words) < 8:
        return False
    # instructional prose about the process itself, not a claim about the client's world
    if re.search(r"\b(this (file|document|template|section)|the (finding|sweep|matrix|snapshot|"
                 r"cadence|legend|template)|maintained by|updated on|copy this|fill it|"
                 r"see (CLAUDE|GUARDRAILS)|per (CLAUDE|GUARDRAILS))\b", s, re.I):
        return False
    if s.lstrip().startswith(("Legend:", "Key:", "Note:", "Kinds:", "Severity:", "Type:")):
        return False
    return bool(re.search(r"\b(is|are|was|were|must|may|cannot|can|will|shall|has|have|"
                          r"requires|allows|forbids|becomes|happens|occurs)\b", s, re.I))


def find_lines(path, pattern):
    out = []
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for i, line in enumerate(fh, 1):
                if pattern.search(line):
                    out.append((i, line.rstrip()))
    except OSError:
        pass
    return out


# --------------------------------------------------------------------------
# Sweep 1: traceability
# --------------------------------------------------------------------------

LAYERS = [
    ("to-be flow", "40-models/to-be/"),
    ("breakdown", "40-models/process-breakdown.md"),
    ("ERD", "40-models/erd.md"),
    ("userflows", "40-models/userflows/"),
    ("concepts", "70-hifi/"),
    ("hi-fi", "70-hifi/"),
]


def sweep_traceability(root, findings, metrics):
    reqs = {}
    src = os.path.join(root, "60-requirements/refined-requirements.md")
    if not os.path.exists(src):
        findings.append(dict(sweep="trace", sev="MAJOR",
                             finding="refined-requirements.md does not exist, so nothing can be traced",
                             loc="60-requirements/refined-requirements.md",
                             owner="requirements-reconciler", route="/rework"))
        metrics.update(requirements=0, orphans=0, ghosts=0)
        return {}

    text = open(src, encoding="utf-8", errors="replace").read()
    for rid in REQ_RE.findall(text):
        reqs.setdefault(rid, {"cites": defaultdict(list), "outcome": None})

    # outcome mapping, if the measurement plan exists
    mp = os.path.join(root, "60-requirements/measurement-plan.md")
    if os.path.exists(mp):
        for line in open(mp, encoding="utf-8", errors="replace"):
            rids, outs = REQ_RE.findall(line), OUT_RE.findall(line)
            if rids and outs:
                for r in rids:
                    if r in reqs:
                        reqs[r]["outcome"] = outs[0]
            elif rids and re.search(r"\bNONE\b", line):
                for r in rids:
                    if r in reqs:
                        reqs[r]["outcome"] = "NONE"

    # who cites what
    for p in walk_md(root):
        r = rel(root, p)
        if r.startswith("60-requirements/refined-requirements"):
            continue
        layer = next((name for name, frag in LAYERS if r.startswith(frag.rstrip("/"))), None)
        if layer is None:
            continue
        for ln, line in find_lines(p, REQ_RE):
            for rid in REQ_RE.findall(line):
                if rid in reqs:
                    reqs[rid]["cites"][layer].append(f"{r}:{ln}")
                else:
                    findings.append(dict(
                        sweep="trace", sev="MAJOR",
                        finding=f"{rid} is cited but does not exist in refined-requirements.md",
                        loc=f"{r}:{ln}", owner="requirements-reconciler", route="/rework"))

    orphans = [r for r, d in reqs.items() if not d["cites"]]
    for r in orphans:
        findings.append(dict(sweep="trace", sev="MAJOR",
                             finding=f"ORPHAN (a requirement nothing was built for): {r} is cited by no artifact",
                             loc="60-requirements/refined-requirements.md",
                             owner="requirements-reconciler", route="classify: awaiting-phase / descoped / forgotten"))

    # ghosts: behaviour-bearing artifacts with no REQ citation at all
    ghosts = []
    for p in walk_md(root):
        r = rel(root, p)
        if not (r.startswith("70-hifi/") or r.startswith("40-models/process-breakdown")):
            continue
        if r.endswith("concepts.md") or "/critiques/" in r or "/usability/" in r:
            continue
        body = strip_noise(open(p, encoding="utf-8", errors="replace").read())
        if not REQ_RE.search(body) and len(body.split()) > 120:
            ghosts.append(r)
            findings.append(dict(sweep="trace", sev="MAJOR",
                                 finding="GHOST (behaviour nobody asked for): artifact carries behaviour and cites no requirement",
                                 loc=r, owner="requirements-reconciler",
                                 route="new REQ via reconciler, or remove as invention"))

    # unmapped optional requirements (the outcome layer)
    if os.path.exists(mp):
        unmapped = [r for r, d in reqs.items() if d["outcome"] is None]
        for r in unmapped[:20]:
            findings.append(dict(sweep="trace", sev="MINOR",
                                 finding=f"{r} names no outcome. An optional requirement with no outcome was prioritized by seniority",
                                 loc="60-requirements/measurement-plan.md",
                                 owner="requirements-reconciler", route="map or move down the list"))
        metrics["unmapped_requirements"] = len(unmapped)

    metrics.update(requirements=len(reqs), orphans=len(orphans), ghosts=len(ghosts))
    return reqs


# --------------------------------------------------------------------------
# Sweep 2: staleness
# --------------------------------------------------------------------------

def sweep_staleness(root, findings, metrics):
    stale = 0
    for target, sources in DEPENDS_ON.items():
        t = newest_mtime(root, target)
        if t is None:
            continue
        for s in sources:
            m = newest_mtime(root, s)
            if m and m > t + 1:
                stale += 1
                age = int((m - t) / 86400)
                findings.append(dict(
                    sweep="stale", sev="MAJOR",
                    finding=f"{target} is out of date: {s} changed after it"
                            + (f" ({age} days later)" if age else ""),
                    loc=target, owner="the artifact's producing agent",
                    route="re-derive, do not patch"))

    for source, targets, why in NAMED_CASCADES:
        sm = newest_mtime(root, source)
        if sm is None:
            continue
        hit = [t for t in targets if (newest_mtime(root, t) or 0) < sm - 1 and exists(root, t)]
        if hit:
            findings.append(dict(
                sweep="stale", sev="BLOCKING",
                finding=why + ". Out of date: " + ", ".join(hit),
                loc=source, owner="ui-designer and hifi-spec-designer",
                route="re-derive each; a gate cannot run on this"))
    metrics["stale"] = stale
    return stale


# --------------------------------------------------------------------------
# Sweep 3: provenance
# --------------------------------------------------------------------------

def sweep_provenance(root, findings, metrics):
    untagged = under = llm_leak = 0
    for p in walk_md(root):
        r = rel(root, p)
        if r.startswith(("_digests/", "conformance/", "share/", "00-inputs/")):
            continue
        if "/transcripts/" in r or r.endswith("_KEY.md"):
            continue
        # script-generated indexes and unedited scaffolding carry guidance prose, not claims
        if r in ("60-requirements/traceability.md", "HANDOVER.md"):
            continue
        if PLACEHOLDER_RE.search(raw_head(p)):
            continue
        raw = open(p, encoding="utf-8", errors="replace").read()
        body = strip_noise(raw)
        tentative = "TENTATIVE" in raw[:400].upper()

        for i, line in enumerate(body.split("\n"), 1):
            if not is_claim_line(line):
                continue
            has_tag = bool(TAG_RE.search(line))
            if not has_tag and r.startswith(("10-discovery/", "40-models/", "60-requirements/")) \
                    and not tentative:
                untagged += 1
                if untagged <= 25:
                    findings.append(dict(
                        sweep="provenance", sev="MAJOR",
                        finding="untagged claim: describes the client's world with no source tag",
                        loc=f"{r}:{i}", owner="the artifact's producing agent",
                        route="tag it, or it does not go in (GUARDRAILS 1)",
                        quote=line.strip()[:120]))
            if has_tag and r.startswith(CONFIRMED_REQUIRED):
                if "(asserted)" in line or "(inferred)" in line:
                    if "open item" not in body[:body.find(line)][-400:].lower():
                        under += 1
                        if under <= 25:
                            findings.append(dict(
                                sweep="provenance", sev="BLOCKING",
                                finding="a behaviour-constraining statement is (asserted) where (confirmed) is required",
                                loc=f"{r}:{i}", owner="requirements-reconciler",
                                route="chase the written confirmation, or move to open items",
                                quote=line.strip()[:120]))
        if "[LLM]" in body and not r.startswith(LLM_QUARANTINE):
            llm_leak += 1
            findings.append(dict(
                sweep="provenance", sev="BLOCKING",
                finding="[LLM] content outside its quarantine zones (open-questions, research notes, draft prompts)",
                loc=r, owner="the artifact's producing agent",
                route="move to open-questions.md (GUARDRAILS 1)"))

    # assumption register integrity
    ar = os.path.join(root, "00-inputs/assumptions.md")
    open_asm = 0
    if os.path.exists(ar):
        txt = open(ar, encoding="utf-8", errors="replace").read()
        ids = set(ASM_RE.findall(txt))
        open_asm = len(ids)
        for line in txt.split("\n"):
            if ASM_RE.search(line) and line.count("|") >= 4:
                cells = [c.strip() for c in line.split("|")]
                if any(c in ("", "-", "TBD", "tbd") for c in cells[1:6]):
                    findings.append(dict(
                        sweep="provenance", sev="MAJOR",
                        finding="assumption register entry missing a required field (what breaks if wrong / test / owner / decision date)",
                        loc="00-inputs/assumptions.md", owner="discovery-lead",
                        route="complete it or retire it", quote=line.strip()[:120]))
        # ASM-IDs cited by artifacts that do not exist in the register
        for p in walk_md(root):
            for ln, line in find_lines(p, ASM_RE):
                for a in ASM_RE.findall(line):
                    if a not in ids:
                        findings.append(dict(
                            sweep="provenance", sev="MAJOR",
                            finding=f"{a} is cited but is not in the assumption register",
                            loc=f"{rel(root,p)}:{ln}", owner="discovery-lead", route="/rework"))
    metrics.update(untagged=untagged, under_confirmed=under, llm_leaks=llm_leak,
                   open_assumptions=open_asm)


# --------------------------------------------------------------------------
# Sweep 4: drift
# --------------------------------------------------------------------------

STATUS_LINE = re.compile(r"^\s*\|\s*`?([A-Za-z][A-Za-z0-9 _-]{1,28})`?\s*\|")


def erd_statuses(root):
    p = os.path.join(root, "40-models/erd.md")
    if not os.path.exists(p):
        return set()
    out, in_block = set(), False
    for line in open(p, encoding="utf-8", errors="replace"):
        low = line.lower()
        if re.match(r"^\s*#{2,}", line):
            in_block = "status" in low
            continue
        if in_block:
            m = STATUS_LINE.match(line)
            if m:
                v = m.group(1).strip()
                if v.lower() not in ("value", "status", "state", "---"):
                    out.add(v.lower())
    return out


def collect_statuses(root, frag):
    out = set()
    base = os.path.join(root, frag)
    paths = [base] if os.path.isfile(base) else (
        [os.path.join(dp, f) for dp, dn, fn in os.walk(base) for f in fn if f.endswith(".md")]
        if os.path.isdir(base) else [])
    for p in paths:
        for line in open(p, encoding="utf-8", errors="replace"):
            m = re.search(r"[Ss]tatus\s*[:|]\s*`?([A-Za-z][A-Za-z0-9 _-]{1,28})`?", line)
            if m:
                out.add(m.group(1).strip().lower())
    return out


def sweep_drift(root, findings, metrics):
    erd = erd_statuses(root)
    metrics["erd_statuses"] = len(erd)
    if not erd:
        return
    for frag, label, owner in [
        ("30-design-language/skills-md/color.md", "the status encoding map", "ui-designer"),
        ("70-hifi/", "the hi-fi specs", "hifi-spec-designer"),
        ("70-hifi/status-mapping.md", "status-mapping.md", "hifi-spec-designer"),
    ]:
        if not exists(root, frag):
            continue
        seen = collect_statuses(root, frag)
        invented = seen - erd
        missing = erd - seen if frag != "30-design-language/skills-md/color.md" else set()
        for v in sorted(invented):
            findings.append(dict(
                sweep="drift", sev="BLOCKING",
                finding=f"status '{v}' appears in {label} and the ERD does not contain it. "
                        "This is a rule change, not a design choice",
                loc=frag, owner=owner, route="/rework as Type B (a rule change)"))
        for v in sorted(missing):
            findings.append(dict(
                sweep="drift", sev="MAJOR",
                finding=f"ERD status '{v}' has no specified state in {label}. "
                        "An unspecified status is a missing screen",
                loc=frag, owner=owner, route="specify it, or prove it unreachable with a flow"))

    # glossary vs labels
    g = os.path.join(root, "10-discovery/glossary.md")
    ia = os.path.join(root, "40-models/ia.md")
    if os.path.exists(g) and os.path.exists(ia):
        terms = {m.group(1).strip().lower() for m in
                 re.finditer(r"^\s*\|\s*\*{0,2}([A-Za-z][A-Za-z0-9 /-]{2,40})\*{0,2}\s*\|",
                             open(g, encoding="utf-8", errors="replace").read(), re.M)}
        labels = {m.group(1).strip().lower() for m in
                  re.finditer(r"^\s*\|\s*([A-Za-z][A-Za-z0-9 /-]{2,40})\s*\|.*label",
                              open(ia, encoding="utf-8", errors="replace").read(), re.M | re.I)}
        for l in sorted(labels - terms)[:10]:
            findings.append(dict(
                sweep="drift", sev="MINOR",
                finding=f"IA label '{l}' has no glossary entry. That is a defect in one of the two files",
                loc="40-models/ia.md", owner="ux-architect and discovery-lead",
                route="add the entry, or use the client's word"))


# --------------------------------------------------------------------------
# reporting
# --------------------------------------------------------------------------

SEV_ORDER = {"BLOCKING": 0, "MAJOR": 1, "MINOR": 2}


def render(root, project, findings, metrics, sweeps, prev):
    today = dt.date.today().isoformat()
    findings.sort(key=lambda f: SEV_ORDER.get(f["sev"], 3))
    blocking = [f for f in findings if f["sev"] == "BLOCKING"]
    major = [f for f in findings if f["sev"] == "MAJOR"]

    if blocking:
        head = (f"{len(blocking)} blocking finding(s). A gate cannot run on this state until they "
                f"are closed or explicitly accepted.")
    elif major:
        head = f"No blocking findings. {len(major)} major finding(s) to close this phase."
    else:
        head = "Clean. Every requirement traces, nothing is out of date, tags are in order."

    L = []
    L.append(f"# Conformance Snapshot - {project}, {today}")
    L.append("")
    L.append("> **What this is.** An automatic check that the project's documents still agree with")
    L.append("> each other. It looks for four things: requirements nothing was built for, documents")
    L.append("> that went out of date when something they depend on changed, claims with no source")
    L.append("> recorded, and designs that have drifted from the data model.")
    L.append(">")
    L.append("> **Where it stands.** Produced by `tools/conformance.py`. Nothing here has been fixed;")
    L.append("> this report routes, it does not edit.")
    L.append(">")
    L.append("> **What we need from you.** Close or accept every blocking finding before the next")
    L.append("> gate. Everything else has an owner and a route.")
    L.append("")
    L.append("## Headline")
    L.append("")
    L.append(f"> {head}")
    L.append("")
    L.append(f"Sweeps run: {', '.join(sweeps)}")
    L.append("")
    L.append("## Metrics")
    L.append("")
    L.append("| Metric | This | Previous | Trend |")
    L.append("|---|---:|---:|---|")
    labels = [("requirements", "Requirements total"),
              ("orphans", "Requirements nothing was built for (ORPHAN)"),
              ("ghosts", "Behaviour nobody asked for (GHOST)"),
              ("unmapped_requirements", "Requirements naming no outcome"),
              ("stale", "Documents now out of date"),
              ("untagged", "Claims with no source tag"),
              ("under_confirmed", "Rules still unconfirmed where confirmation is required"),
              ("llm_leaks", "Files with model-inferred content outside quarantine"),
              ("open_assumptions", "Open assumptions"),
              ("erd_statuses", "Status values in the ERD")]
    for k, lab in labels:
        if k not in metrics:
            continue
        cur = metrics[k]
        old = prev.get(k) if prev else None
        if old is None:
            trend = "-"
        elif cur == old:
            trend = "flat"
        elif cur < old:
            trend = f"down {old - cur}"
        else:
            trend = f"UP {cur - old}"
        L.append(f"| {lab} | {cur} | {old if old is not None else '-'} | {trend} |")
    L.append("")
    L.append("A metric that has not moved between two snapshots during an active phase is itself")
    L.append("worth a line in the headline.")
    L.append("")
    L.append("## Findings")
    L.append("")
    if not findings:
        L.append("None.")
    else:
        L.append("| # | Sweep | Severity | Finding | Where | Owner | Route |")
        L.append("|---|---|---|---|---|---|---|")
        for i, f in enumerate(findings, 1):
            q = f" <br>`{f['quote']}`" if f.get("quote") else ""
            L.append(f"| {i} | {f['sweep']} | **{f['sev']}** | {f['finding']}{q} | "
                     f"`{f['loc']}` | {f['owner']} | {f['route']} |")
    L.append("")
    L.append("Severity: **BLOCKING** genuinely stops a gate - **MAJOR** must be fixed this phase -")
    L.append("**MINOR** batch it. Inflating BLOCKING burns the mechanism exactly as S4-flooding burns")
    L.append("a critique.")
    L.append("")
    if blocking:
        L.append("## Blocking findings, verbatim")
        L.append("")
        L.append("These are announced in the session, not filed quietly.")
        L.append("")
        for f in blocking:
            L.append(f"- **{f['loc']}** - {f['finding']} *(owner: {f['owner']})*")
        L.append("")
    L.append("## Next three actions")
    L.append("")
    L.append("| # | Action | Owner |")
    L.append("|---|---|---|")
    for i, f in enumerate(findings[:3], 1):
        L.append(f"| {i} | {f['route']} - `{f['loc']}` | {f['owner']} |")
    if not findings:
        L.append("| 1 | Nothing outstanding. Next snapshot on the standing cadence. | gate-reviewer |")
    L.append("")
    L.append("---")
    L.append("")
    L.append("**Key.** ORPHAN = a requirement nothing was built for. GHOST = behaviour in an artifact")
    L.append("that cites no requirement. Out of date = something this document depends on changed")
    L.append("after it was last edited. `(confirmed)` = the domain authority verified it, on record.")
    L.append("`[DA]` = domain authority, `[PO]` = product owner, `[USER:role]` = an end user,")
    L.append("`[LLM]` = inferred by a model and not yet verified by anyone.")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project", help="path to workspace/{project}")
    ap.add_argument("--sweep", default="full",
                    choices=["full", "trace", "stale", "provenance", "drift"])
    ap.add_argument("--scope", default=None, help="REQ-ID or path to scope the run to")
    ap.add_argument("--json", action="store_true", help="emit findings as JSON on stdout")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    root = os.path.abspath(a.project)
    if not os.path.isdir(root):
        sys.exit(f"not a directory: {root}")
    project = os.path.basename(root.rstrip("/"))

    findings, metrics = [], {}
    want = ["trace", "stale", "provenance", "drift"] if a.sweep == "full" else [a.sweep]
    if "trace" in want:
        sweep_traceability(root, findings, metrics)
    if "stale" in want:
        sweep_staleness(root, findings, metrics)
    if "provenance" in want:
        sweep_provenance(root, findings, metrics)
    if "drift" in want:
        sweep_drift(root, findings, metrics)

    if a.scope:
        findings = [f for f in findings if a.scope in f["loc"] or a.scope in f["finding"]]

    # previous metrics, for the trend column
    cdir = os.path.join(root, "conformance")
    os.makedirs(cdir, exist_ok=True)
    prev = {}
    hist = os.path.join(cdir, "metrics-history.json")
    if os.path.exists(hist):
        try:
            h = json.load(open(hist))
            if h:
                prev = h[-1]["metrics"]
        except (json.JSONDecodeError, KeyError, IndexError):
            prev = {}

    report = render(root, project, findings, metrics, want, prev)
    today = dt.date.today().isoformat()
    out = os.path.join(cdir, f"{today}-snapshot.md")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(report)

    try:
        h = json.load(open(hist)) if os.path.exists(hist) else []
    except json.JSONDecodeError:
        h = []
    h.append({"date": today, "sweeps": want, "metrics": metrics,
              "blocking": sum(1 for f in findings if f["sev"] == "BLOCKING"),
              "major": sum(1 for f in findings if f["sev"] == "MAJOR")})
    json.dump(h[-60:], open(hist, "w"), indent=1)

    if a.json:
        print(json.dumps({"metrics": metrics, "findings": findings}, indent=1))
    elif not a.quiet:
        print(report)
    print(f"\n[snapshot written to {rel(root, out)}]", file=sys.stderr)

    if any(f["sev"] == "BLOCKING" for f in findings):
        sys.exit(2)
    if any(f["sev"] == "MAJOR" for f in findings):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
