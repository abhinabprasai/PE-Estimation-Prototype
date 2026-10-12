#!/usr/bin/env python3
"""
Render a share document to a single self-contained HTML file.

    python3 tools/render-share.py workspace/{project}/share/gate-2-brief.md
    python3 tools/render-share.py workspace/{project}/share/          # whole folder

No network, no dependencies, no build step. Inlines everything, prints cleanly,
and is readable on a phone. The point is that a client-facing document should
look like the studio made it rather than like a file someone forwarded.
"""

import html
import os
import re
import sys
import datetime as dt

CSS = """
:root{
  --ink:#14171a; --ink-2:#454c54; --ink-3:#6b747d;
  --line:#e3e6ea; --line-2:#c9cfd6;
  --bg:#ffffff; --bg-2:#f6f8fa; --accent:#1f5fa8; --accent-bg:#eef4fb;
  --warn-bg:#fff8e6; --warn-line:#e8c96a;
}
@media (prefers-color-scheme: dark){
  :root{
    --ink:#e8ebee; --ink-2:#b3bac2; --ink-3:#8b939c;
    --line:#2b3138; --line-2:#3d444d;
    --bg:#15181c; --bg-2:#1c2026; --accent:#7fb3f0; --accent-bg:#1a2430;
    --warn-bg:#2a2312; --warn-line:#6b5a24;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-variant-numeric:tabular-nums;
}
.wrap{max-width:46rem;margin:0 auto;padding:3.5rem 1.5rem 6rem}
h1{font-size:1.9rem;line-height:1.25;margin:0 0 .4rem;letter-spacing:-.02em;font-weight:650}
h2{font-size:1.25rem;line-height:1.3;margin:2.75rem 0 .75rem;font-weight:620;
   padding-top:1.25rem;border-top:1px solid var(--line)}
h2:first-of-type{border-top:0;padding-top:0}
h3{font-size:1.02rem;margin:1.75rem 0 .5rem;font-weight:620;color:var(--ink-2)}
p{margin:0 0 1rem}
a{color:var(--accent)}
ul,ol{margin:0 0 1rem;padding-left:1.35rem}
li{margin:.3rem 0}
strong{font-weight:620}
code{
  font:0.86em/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  background:var(--bg-2);border:1px solid var(--line);border-radius:4px;padding:.1em .35em;
}
blockquote{
  margin:0 0 1.75rem;padding:1.1rem 1.25rem;background:var(--accent-bg);
  border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:6px;
}
blockquote p{margin:0 0 .6rem}
blockquote p:last-child{margin:0}
table{border-collapse:collapse;width:100%;margin:0 0 1.5rem;font-size:.94rem}
th,td{text-align:left;vertical-align:top;padding:.6rem .7rem;border-bottom:1px solid var(--line)}
th{
  font-size:.74rem;font-weight:640;text-transform:uppercase;letter-spacing:.06em;
  color:var(--ink-3);border-bottom:1px solid var(--line-2);background:var(--bg-2);
}
tbody tr:last-child td{border-bottom:1px solid var(--line-2)}
td em{color:var(--ink-3);font-style:italic}
hr{border:0;border-top:1px solid var(--line);margin:2.5rem 0}
.meta{color:var(--ink-3);font-size:.86rem;margin:0 0 2.5rem}
.foot{margin-top:4rem;padding-top:1.25rem;border-top:1px solid var(--line);
      color:var(--ink-3);font-size:.82rem}
.tag{display:inline-block;padding:.12em .5em;border:1px solid var(--line-2);
     border-radius:99px;font-size:.78rem;color:var(--ink-2);background:var(--bg-2)}
@media print{
  body{background:#fff;color:#000}
  .wrap{max-width:none;padding:0}
  h2{break-after:avoid} table{break-inside:auto} tr{break-inside:avoid}
  blockquote{background:#f6f8fa;border-left:3px solid #666}
  a{color:#000;text-decoration:underline}
}
@media (max-width:34rem){
  .wrap{padding:2rem 1rem 4rem}
  h1{font-size:1.5rem} table{font-size:.88rem} th,td{padding:.5rem .45rem}
}
"""


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    return t


def md_to_html(md):
    out, i = [], 0
    lines = md.split("\n")
    n = len(lines)
    while i < n:
        ln = lines[i]
        s = ln.strip()

        if not s:
            i += 1
            continue

        if s.startswith("> "):
            block = []
            while i < n and lines[i].strip().startswith(">"):
                block.append(lines[i].strip().lstrip(">").strip())
                i += 1
            para, paras = [], []
            for b in block:
                if b:
                    para.append(b)
                elif para:
                    paras.append(" ".join(para)); para = []
            if para:
                paras.append(" ".join(para))
            out.append("<blockquote>" + "".join(f"<p>{inline(p)}</p>" for p in paras) + "</blockquote>")
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            lvl = min(len(m.group(1)), 4)
            out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>")
            i += 1
            continue

        if re.match(r"^-{3,}$|^\*{3,}$", s):
            out.append("<hr>")
            i += 1
            continue

        if s.startswith("|") and i + 1 < n and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip()):
            def cells(row):
                return [c.strip() for c in row.strip().strip("|").split("|")]
            head = cells(lines[i]); i += 2
            body = []
            while i < n and lines[i].strip().startswith("|"):
                body.append(cells(lines[i])); i += 1
            t = ["<table><thead><tr>"]
            t += [f"<th>{inline(h)}</th>" for h in head]
            t.append("</tr></thead><tbody>")
            for r in body:
                if all(not c or set(c) <= set("- :") for c in r):
                    continue
                t.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
            t.append("</tbody></table>")
            out.append("".join(t))
            continue

        if re.match(r"^[-*]\s+", s) or re.match(r"^\d+[.)]\s+", s):
            ordered = bool(re.match(r"^\d+[.)]\s+", s))
            items = []
            while i < n:
                c = lines[i].strip()
                if re.match(r"^[-*]\s+", c) or re.match(r"^\d+[.)]\s+", c):
                    items.append(re.sub(r"^([-*]|\d+[.)])\s+", "", c)); i += 1
                elif c and not c.startswith(("#", "|", ">")) and items:
                    items[-1] += " " + c; i += 1
                else:
                    break
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            continue

        para = []
        while i < n and lines[i].strip() and not re.match(
                r"^(#{1,4}\s|\||>|-{3,}|[-*]\s|\d+[.)]\s)", lines[i].strip()):
            para.append(lines[i].strip()); i += 1
        if para:
            out.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(out)


def render(path):
    md = open(path, encoding="utf-8").read()
    m = re.search(r"^#\s+(.*)$", md, re.M)
    title = m.group(1).strip() if m else os.path.basename(path)
    body = md_to_html(md)
    stamp = dt.date.today().strftime("%d %B %Y")
    doc = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<style>{CSS}</style>
</head><body><main class="wrap">
{body}
<p class="foot">Generated {stamp} from <code>{html.escape(os.path.basename(path))}</code>.
If anything here reads as jargon, that is a defect in the document - tell us and we will fix it.</p>
</main></body></html>
"""
    out = os.path.splitext(path)[0] + ".html"
    open(out, "w", encoding="utf-8").write(doc)
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    target = sys.argv[1]
    if os.path.isdir(target):
        made = [render(os.path.join(target, f)) for f in sorted(os.listdir(target))
                if f.endswith(".md")]
    elif os.path.isfile(target):
        made = [render(target)]
    else:
        sys.exit(f"not found: {target}")
    for p in made:
        print(p)


if __name__ == "__main__":
    main()
