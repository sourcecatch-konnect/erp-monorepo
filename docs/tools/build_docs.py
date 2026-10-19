"""
Builds the files readers use, from the Markdown pages in docs/:

    SKERP-User-Guide.pdf / .docx       for office staff, accounts, managers
    SKERP-Easy-Guide.pdf / .docx       for new users: what each part is, why, and how (docs/easy-guide/NN-*.md)
    SKERP-Developer-Guide.pdf / .docx  for developers
    SKERP-Reference.xlsx               glossary, modules, statuses, roles, permissions

    pip install -r docs/tools/requirements.txt       (once)
    python docs/tools/build_docs.py                   -> docs/exports/ (not committed)
    python docs/tools/build_docs.py --out D:\\Share   -> any other folder
    python docs/tools/build_docs.py --no-roles        -> skip the roles export (no Node needed)

New pages are picked up automatically:
    docs/user-guide/NN-*.md               -> User Guide, part 2 (in file-name order)
    docs/developer-guide/modules/*.md     -> Developer Guide, part 3
The Markdown in docs/ is the single source of truth: edit it there, then rebuild.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import markdown
from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

TOOLS = Path(__file__).resolve().parent               # docs/tools
DOCS = TOOLS.parent                                    # docs/
ROOT = DOCS / "exports"                                # output; --out overrides
BRAND = "0F5E9C"

OVERVIEW = ["00-overview/business-overview.md", "00-overview/erp-flow.md",
            "00-overview/glossary.md", "00-overview/modules.md", "00-overview/roles.md"]


def pages_in(folder: str) -> list[str]:
    return [f"{folder}/{p.name}" for p in sorted((DOCS / folder).glob("*.md"))]


# Easy Guide part -> chapter numbers (file-name prefix). Parts with no pages yet are skipped.
EASY_PARTS = [
    ("Part A — Start here", range(1, 5)),
    ("Part B — Masters (set up first)", range(5, 7)),
    ("Part C — Order to LR", range(7, 11)),
    ("Part D — Trucks on the road", range(11, 14)),
    ("Part E — Road + Rail", range(14, 15)),
    ("Part F — Delivery", range(15, 16)),
    ("Part G — Money", range(16, 19)),
    ("Part H — Others", range(19, 21)),
]


def easy_parts() -> list[tuple[str, list[str]]]:
    pages = pages_in("easy-guide")
    number = lambda page: int(Path(page).name.split("-", 1)[0])
    return [(title, [p for p in pages if number(p) in chapters]) for title, chapters in EASY_PARTS]


def books() -> dict[str, tuple[str, str, list[tuple[str, list[str]]]]]:
    """file name -> (title, subtitle, [(part title, pages)])"""
    return {
        "SKERP-User-Guide": (
            "SKERP — User Guide",
            "How to use the ERP, screen by screen. For office staff, accounts and managers.",
            [("Part 1 — Understand the ERP", OVERVIEW),
             ("Part 2 — My daily work", pages_in("user-guide/daily-work")),
             ("Part 3 — How to use each screen", pages_in("user-guide"))],
        ),
        "SKERP-Easy-Guide": (
            "SKERP — Easy Guide",
            "What each part of the ERP is, why it exists, and how to use it, step by step. For new users.",
            easy_parts(),
        ),
        "SKERP-Developer-Guide": (
            "SKERP — Developer Guide",
            "How the ERP is built and how to work on it. For developers.",
            [("Part 1 — The business", OVERVIEW[:3]),
             ("Part 2 — Working on the project",
              ["developer-guide/setup.md", "developer-guide/architecture.md",
               "developer-guide/conventions.md", "developer-guide/deployment.md"]),
             ("Part 3 — Module notes", pages_in("developer-guide/modules"))],
        ),
    }


# tab name -> (page, which tables: "all" | "first" | "last")
REFERENCE_TABS = {
    "Glossary": ("00-overview/glossary.md", "all"),
    "Modules": ("00-overview/modules.md", "all"),
    "Statuses": ("00-overview/erp-flow.md", "last"),
    "Default roles": ("00-overview/roles.md", "first"),
}


def find_browser() -> Path:
    """Edge or Chrome for HTML -> PDF. Override with SKERP_PDF_BROWSER."""
    candidates = [
        os.environ.get("SKERP_PDF_BROWSER", ""),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        shutil.which("msedge") or "", shutil.which("google-chrome") or "",
        shutil.which("chromium") or "", shutil.which("chrome") or "",
    ]
    for c in candidates:
        if c and Path(c).exists():
            return Path(c)
    raise SystemExit("No Edge/Chrome found for PDF output. Set SKERP_PDF_BROWSER to its path.")


# --------------------------------------------------------------------------- markdown helpers

LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")


def plain(text: str) -> str:
    return LINK.sub(r"\1", text).replace("**", "").replace("`", "")


def read(page: str) -> str:
    return (DOCS / page).read_text(encoding="utf-8")


def chapter_title(page: str) -> str:
    m = re.search(r"^#\s+(.*)$", read(page), re.M)
    return plain(m.group(1)) if m else Path(page).stem


def table_rows(lines: list[str]) -> list[list[str]]:
    rows = []
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
            continue
        rows.append(cells)
    return rows


def blocks(md_text: str):
    lines = md_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            yield "code", code
        elif line.startswith("|"):
            tbl = []
            while i < len(lines) and lines[i].startswith("|"):
                tbl.append(lines[i])
                i += 1
            yield "table", table_rows(tbl)
            continue
        elif m := re.match(r"^(#{1,4})\s+(.*)", line):
            yield f"h{len(m.group(1))}", m.group(2)
        elif line.startswith(">"):
            yield "note", line.lstrip("> ").strip()
        elif m := re.match(r"^\s*[-*]\s+(.*)", line):
            yield "bullet", m.group(1)
        elif m := re.match(r"^\s*\d+\.\s+(.*)", line):
            yield "number", m.group(1)
        elif line.strip() and line.strip() != "---":
            yield "para", line.strip()
        i += 1


# --------------------------------------------------------------------------- PDF

CSS = f"""
@page {{ size: A4; margin: 14mm 12mm; }}
body {{ font-family: "Segoe UI", Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #1d2433; }}
h1 {{ color: #{BRAND}; font-size: 20pt; border-bottom: 2px solid #{BRAND}; padding-bottom: 4px; }}
h2 {{ color: #{BRAND}; font-size: 14pt; margin-top: 18px; }}
h3 {{ font-size: 12pt; }}
table {{ width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9.5pt; }}
tr {{ page-break-inside: avoid; }}
th, td {{ border: 1px solid #d9e1ea; padding: 4px 6px; text-align: left; vertical-align: top; }}
th {{ background: #eef4fa; color: #{BRAND}; }}
pre {{ background: #f6f8fa; border: 1px solid #e1e4e8; padding: 8px; font-size: 8.5pt; white-space: pre; overflow: hidden; }}
blockquote {{ color: #5b6475; border-left: 3px solid #{BRAND}; margin: 6px 0; padding-left: 8px; }}
.cover {{ height: 240mm; display: flex; flex-direction: column; justify-content: center; }}
.cover h1 {{ border: 0; font-size: 32pt; margin-bottom: 4px; }}
.cover p {{ font-size: 13pt; color: #5b6475; }}
.toc h2 {{ margin-top: 14px; }}
.toc ol {{ margin: 4px 0 8px 18px; padding: 0; }}
.toc li {{ margin: 3px 0; }}
.toc a {{ color: #1d2433; }}
.part {{ page-break-before: always; height: 230mm; display: flex; align-items: center; }}
.part h1 {{ border: 0; font-size: 26pt; }}
.page {{ page-break-before: always; }}
a {{ color: inherit; text-decoration: none; }}
"""


def build_pdf(name: str, title: str, subtitle: str, parts) -> Path:
    toc, body, n = [], [], 0
    for part_title, pages in parts:
        if not pages:
            continue
        items = []
        body.append(f'<div class="part"><h1>{part_title}</h1></div>')
        for page in pages:
            n += 1
            items.append(f'<li><a href="#c{n}">{chapter_title(page)}</a></li>')
            html = markdown.markdown(read(page), extensions=["tables", "fenced_code"])
            body.append(f'<div class="page" id="c{n}">{html}</div>')
        toc.append(f"<h2>{part_title}</h2><ol>{''.join(items)}</ol>")
    html = (f"<!doctype html><html><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style></head><body>"
            f'<div class="cover"><h1>{title}</h1><p>{subtitle}</p></div>'
            f'<div class="page toc"><h1>Contents</h1>{"".join(toc)}</div>'
            f"{''.join(body)}</body></html>")
    ROOT.mkdir(parents=True, exist_ok=True)
    tmp = ROOT / f"_{name}.html"
    tmp.write_text(html, encoding="utf-8")
    out = ROOT / f"{name}.pdf"
    subprocess.run([str(find_browser()), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={out}", tmp.as_uri()], check=True, capture_output=True)
    tmp.unlink()
    return out


# --------------------------------------------------------------------------- Word

def add_runs(paragraph, text: str):
    text = LINK.sub(r"\1", text).replace("`", "")
    for i, piece in enumerate(text.split("**")):
        if piece:
            paragraph.add_run(piece).bold = i % 2 == 1


def shade(cell, hex_color: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def write_page(doc, page: str):
    for kind, payload in blocks(read(page)):
        if kind.startswith("h"):
            doc.add_heading(plain(payload), level=min(int(kind[1]) + 1, 4))
        elif kind == "note":
            p = doc.add_paragraph()
            add_runs(p, payload)
            for run in p.runs:
                run.italic = True
        elif kind == "bullet":
            add_runs(doc.add_paragraph(style="List Bullet"), payload)
        elif kind == "number":
            add_runs(doc.add_paragraph(style="List Number"), payload)
        elif kind == "para":
            add_runs(doc.add_paragraph(), payload)
        elif kind == "code":
            run = doc.add_paragraph().add_run("\n".join(payload))
            run.font.name = "Consolas"
            run.font.size = Pt(8)
        elif kind == "table" and payload:
            cols = max(len(r) for r in payload)
            table = doc.add_table(rows=0, cols=cols)
            table.style = "Table Grid"
            for r, row in enumerate(payload):
                cells = table.add_row().cells
                for c in range(cols):
                    para = cells[c].paragraphs[0]
                    add_runs(para, row[c] if c < len(row) else "")
                    for run in para.runs:
                        run.font.size = Pt(9)
                        if r == 0:
                            run.bold = True
                            run.font.color.rgb = RGBColor.from_string(BRAND)
                    if r == 0:
                        shade(cells[c], "EEF4FA")
            doc.add_paragraph()


def build_docx(name: str, title: str, subtitle: str, parts) -> Path:
    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(11)
    doc.add_heading(title, level=0)
    doc.add_paragraph(subtitle)
    page_break(doc)
    doc.add_heading("Contents", level=1)
    for part_title, pages in parts:
        if not pages:
            continue
        doc.add_paragraph(part_title).runs[0].bold = True
        for page in pages:
            doc.add_paragraph(chapter_title(page), style="List Number")
    for part_title, pages in parts:
        if not pages:
            continue
        page_break(doc)
        doc.add_heading(part_title, level=1)
        for page in pages:
            page_break(doc)
            write_page(doc, page)
    out = ROOT / f"{name}.docx"
    doc.save(out)
    return out


# --------------------------------------------------------------------------- Excel

def header_row(ws, row: int, cols: int):
    for c in range(1, cols + 1):
        cell = ws.cell(row, c)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=BRAND)
        cell.alignment = Alignment(wrap_text=True, vertical="top")


def build_reference_xlsx() -> Path:
    wb = Workbook()
    wb.remove(wb.active)
    for tab, (page, which) in REFERENCE_TABS.items():
        tables = [p for k, p in blocks(read(page)) if k == "table"]
        tables = {"first": tables[:1], "last": tables[-1:]}.get(which, tables)
        ws = wb.create_sheet(tab)
        row_no = 1
        for table in tables:
            for r, row in enumerate(table):
                for c, value in enumerate(row, start=1):
                    cell = ws.cell(row=row_no, column=c, value=plain(value))
                    cell.alignment = Alignment(wrap_text=True, vertical="top")
                if r == 0:
                    header_row(ws, row_no, len(row))
                row_no += 1
            row_no += 1
        for c in range(1, ws.max_column + 1):
            longest = max((len(str(ws.cell(r, c).value or "")) for r in range(1, ws.max_row + 1)), default=10)
            ws.column_dimensions[get_column_letter(c)].width = min(max(12, longest + 2), 60)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    roles_file = Path(tempfile.gettempdir()) / "skerp-roles.json"
    if roles_file.exists():
        data = json.loads(roles_file.read_text(encoding="utf-8"))
        roles = data["roles"]
        ws = wb.create_sheet("Permissions by role")
        ws.append(["Area", "Permission", "Key", *roles])
        header_row(ws, 1, 3 + len(roles))
        for row in sorted(data["rows"], key=lambda r: (r["area"], r["label"])):
            ws.append([row["area"], row["label"], row["key"],
                       *["✔" if row["roles"][r] else "" for r in roles]])
        for col, width in zip("ABC", (28, 44, 40)):
            ws.column_dimensions[col].width = width
        for c in range(4, 4 + len(roles)):
            ws.column_dimensions[get_column_letter(c)].width = 16
            for r in range(2, ws.max_row + 1):
                ws.cell(r, c).alignment = Alignment(horizontal="center")
        ws.freeze_panes = "D2"
        ws.auto_filter.ref = ws.dimensions

    out = ROOT / "SKERP-Reference.xlsx"
    wb.save(out)
    return out


# --------------------------------------------------------------------------- main

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build the SKERP User Guide, Developer Guide and Reference.")
    parser.add_argument("--out", help="output folder (default: docs/exports)")
    parser.add_argument("--no-roles", action="store_true", help="skip the roles export from the code")
    args = parser.parse_args()
    if args.out:
        ROOT = Path(args.out).resolve()
    ROOT.mkdir(parents=True, exist_ok=True)

    # Older builds wrote per-module booklets into sub-folders; keep the output to the 3 files.
    for old in ("PDF", "Word", "Sheets"):
        shutil.rmtree(ROOT / old, ignore_errors=True)

    if not args.no_roles:
        try:
            from export_roles import export_roles
            export_roles(Path(tempfile.gettempdir()) / "skerp-roles.json")
        except Exception as err:  # the guides still build; only the permissions tab may be stale
            print("Roles export skipped:", err)

    for name, (title, subtitle, parts) in books().items():
        print("PDF  ", build_pdf(name, title, subtitle, parts))
        print("Word ", build_docx(name, title, subtitle, parts))
    print("Excel", build_reference_xlsx())
