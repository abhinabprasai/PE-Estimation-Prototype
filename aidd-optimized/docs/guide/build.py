#!/usr/bin/env python3
"""Build the AIDD Developer & Designer Guide PDF.

Pipeline: assemble HTML sections -> render with headless Chrome -> locate section
start pages by extracting text -> re-render with real TOC page numbers -> stamp
running footers and page numbers -> add PDF outline bookmarks.
"""
import os, re, subprocess, sys, datetime, shutil, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "AIDD-Guide.pdf")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SECTIONS = ["01-front.html", "02-mechanics.html", "03-phases.html",
            "04-agents.html", "05-skills.html", "06-reference.html"]

# (anchor id, title, level)  level 0 = part, 1 = section
TOC = [
    ("s-howtoread", "How to read this guide", 0),
    ("s-part1", "Part 1 · Orientation", 0),
    ("s-1-1", "1.1 What this system is", 1),
    ("s-1-2", "1.2 The five ideas it is built on", 1),
    ("s-1-3", "1.3 The process at a glance", 1),
    ("s-1-4", "1.4 Quick start", 1),
    ("s-1-5", "1.5 Repository layout", 1),
    ("s-part2", "Part 2 · Core mechanics", 0),
    ("s-2-1", "2.1 Provenance: tags and confidence", 1),
    ("s-2-2", "2.2 The verification ladder", 1),
    ("s-2-3", "2.3 Contradictions are deliverables", 1),
    ("s-2-4", "2.4 Gates", 1),
    ("s-2-5", "2.5 Corrections and the rework machinery", 1),
    ("s-2-6", "2.6 Continuous conformance", 1),
    ("s-2-7", "2.7 Working without a spec", 1),
    ("s-2-8", "2.8 The five adaptation variables", 1),
    ("s-2-9", "2.9 The design floor", 1),
    ("s-part3", "Part 3 · The phases, step by step", 0),
    ("s-3-0", "3.1 Phase 0: Intake", 1),
    ("s-3-1", "3.2 Phase 1: Empathize and Define", 1),
    ("s-3-2", "3.3 Phase 2A: Initial Design", 1),
    ("s-3-3", "3.4 Gate 1", 1),
    ("s-3-4", "3.5 Phase 2B: Further Design", 1),
    ("s-3-5", "3.6 Gate 2", 1),
    ("s-3-6", "3.7 Phase 3: Test and Prototype", 1),
    ("s-3-7", "3.8 Gate 3", 1),
    ("s-3-8", "3.9 Handoff and the md-spec loop", 1),
    ("s-part4", "Part 4 · The agents", 0),
    ("s-4-0", "4.1 How agents, skills and the orchestrator relate", 1),
    ("s-4-1", "4.2 The routing table", 1),
    ("s-4-2", "4.3 Agent cards", 1),
    ("s-part5", "Part 5 · The skills", 0),
    ("s-5-0", "5.1 Skill anatomy", 1),
    ("s-5-1", "5.2 Intake and discovery", 1),
    ("s-5-2", "5.3 Research, knowledge and prototyping", 1),
    ("s-5-3", "5.4 Convergence", 1),
    ("s-5-4", "5.5 Production intent", 1),
    ("s-5-5", "5.6 Quality, gates and close", 1),
    ("s-part6", "Part 6 · Commands", 0),
    ("s-part7", "Part 7 · Artifacts and templates", 0),
    ("s-part8", "Part 8 · Reference", 0),
    ("s-8-1", "8.1 Artifact dependency order", 1),
    ("s-8-2", "8.2 Guardrails in summary", 1),
    ("s-8-3", "8.3 Troubleshooting", 1),
    ("s-8-4", "8.4 Adapting the process to the project", 1),
    ("s-8-5", "8.5 Extending the system", 1),
    ("s-8-6", "8.6 Glossary of system terms", 1),
]

# Unique probe strings used to find which page a section starts on.
PROBE = {i: f"⁣PG{n:02d}⁣" for n, (i, _, _) in enumerate(TOC)}


def build_toc_html(pages):
    rows = []
    for anchor, title, level in TOC:
        num = pages.get(anchor, "")
        if level == 0:
            rows.append(f'<div class="toc-part">{title}'
                        f'<span style="float:right;color:#2b7fa3">{num}</span></div>')
        else:
            rows.append(
                f'<div class="toc-row sub"><span class="t">{title}</span>'
                f'<span class="d"></span><span class="n">{num}</span></div>')
    return "\n".join(rows)


def assemble(pages, with_probes):
    css = open(os.path.join(HERE, "guide.css")).read()
    body = []
    for fn in SECTIONS:
        body.append(open(os.path.join(HERE, fn)).read())
    html = "\n".join(body)
    if with_probes:
        # inject an invisible probe right after each section's opening tag
        for anchor, _, _ in TOC:
            html = re.sub(
                r'(id="%s"[^>]*>)' % re.escape(anchor),
                r'\1<span style="font-size:1px;color:#fff">%s</span>' % PROBE[anchor],
                html, count=1)
    html = html.replace("{{TOC}}", build_toc_html(pages))
    html = html.replace("{{DATE}}", datetime.date.today().strftime("%d %B %Y"))
    return ("<!doctype html><html><head><meta charset='utf-8'>"
            "<title>AIDD Agent System — Developer &amp; Designer Guide</title>"
            f"<style>{css}</style></head><body>{html}</body></html>")


def render(html, out_pdf):
    """Render with headless Chrome.

    Chrome sometimes writes the PDF and then fails to exit. Poll for the output
    file instead of waiting on the process, then terminate it.
    """
    src = os.path.join(HERE, "_build.html")
    open(src, "w").write(html)
    if os.path.exists(out_pdf):
        os.remove(out_pdf)
    tmp = tempfile.mkdtemp()
    proc = subprocess.Popen(
        [CHROME, "--headless", "--disable-gpu", "--no-sandbox",
         f"--user-data-dir={tmp}", "--no-pdf-header-footer",
         "--virtual-time-budget=12000", f"--print-to-pdf={out_pdf}", src],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import time
    deadline, stable, last = time.time() + 150, 0, -1
    while time.time() < deadline:
        if proc.poll() is not None:
            break
        if os.path.exists(out_pdf):
            size = os.path.getsize(out_pdf)
            # file must stop growing for two consecutive checks
            stable = stable + 1 if size == last and size > 0 else 0
            last = size
            if stable >= 2:
                break
        time.sleep(1.5)
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    shutil.rmtree(tmp, ignore_errors=True)
    if not os.path.exists(out_pdf) or os.path.getsize(out_pdf) == 0:
        raise RuntimeError(f"Chrome produced no PDF at {out_pdf}")
    return out_pdf


def find_pages(pdf_path):
    from pypdf import PdfReader
    r = PdfReader(pdf_path)
    found = {}
    for pno, page in enumerate(r.pages, start=1):
        try:
            t = page.extract_text() or ""
        except Exception:
            continue
        for anchor, probe in PROBE.items():
            if anchor in found:
                continue
            # probe survives as PGnn even if the invisible separators are dropped
            if re.search(r"PG%s" % probe[3:5], t):
                found[anchor] = pno
    return found


def stamp(pdf_path, final_path):
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.colors import HexColor
    from pypdf import Transformation
    import io

    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    W, H = A4
    total = len(reader.pages)

    for i, page in enumerate(reader.pages):
        if i > 0:  # never stamp the cover
            buf = io.BytesIO()
            c = canvas.Canvas(buf, pagesize=A4)
            c.setStrokeColor(HexColor("#dfe6ea"))
            c.setLineWidth(0.5)
            c.line(51, 42, W - 51, 42)
            c.setFont("Helvetica", 7)
            c.setFillColor(HexColor("#8695a0"))
            c.drawString(51, 32, "AIDD Agent System · Developer & Designer Guide")
            c.setFont("Helvetica-Bold", 7.5)
            c.setFillColor(HexColor("#2b7fa3"))
            c.drawRightString(W - 51, 32, str(i + 1))
            c.save()
            buf.seek(0)
            page.merge_page(PdfReader(buf).pages[0])
        writer.add_page(page)

    # outline bookmarks
    pages_map = find_pages(pdf_path)
    parent = None
    for anchor, title, level in TOC:
        p = pages_map.get(anchor)
        if not p:
            continue
        clean = title.replace(" · ", ": ")
        if level == 0:
            parent = writer.add_outline_item(clean, p - 1)
        else:
            writer.add_outline_item(clean, p - 1, parent=parent)

    writer.add_metadata({
        "/Title": "AIDD Agent System - Developer & Designer Guide",
        "/Author": "AI-Augmented Discovery and Design",
        "/Subject": "How the AIDD agent system works, and how to run a project through it",
        "/Keywords": "AIDD, product design, discovery, agents, skills, design system",
    })
    with open(final_path, "wb") as f:
        writer.write(f)


def main():
    pass1 = os.path.join(HERE, "_pass1.pdf")
    print("pass 1: rendering with probes ...")
    render(assemble({}, True), pass1)
    pages = find_pages(pass1)
    print(f"  located {len(pages)}/{len(TOC)} sections")
    missing = [a for a, _, _ in TOC if a not in pages]
    if missing:
        print("  WARNING unlocated:", ", ".join(missing))
    print("pass 2: rendering with real TOC page numbers ...")
    pass2 = os.path.join(HERE, "_pass2.pdf")
    render(assemble(pages, False), pass2)
    print("stamping footers, page numbers and bookmarks ...")
    stamp(pass2, OUT)
    from pypdf import PdfReader
    n = len(PdfReader(OUT).pages)
    size = os.path.getsize(OUT) / 1024
    print(f"done: {OUT}  ({n} pages, {size:.0f} KB)")
    for f in (pass1, pass2, os.path.join(HERE, "_build.html")):
        if os.path.exists(f):
            os.remove(f)


if __name__ == "__main__":
    main()
