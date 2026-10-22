# Docs tools

Builds the **3 files people read** from the Markdown in `docs/`:

| File | For |
|---|---|
| **SKERP-User-Guide.pdf / .docx** | Office staff, accounts, managers. Part 1: understand the ERP. Part 2: how to use each screen |
| **SKERP-Developer-Guide.pdf / .docx** | Developers. Part 1: the business. Part 2: setup, architecture, rules, deployment. Part 3: module notes |
| **SKERP-Reference.xlsx** | Everyone. Tabs: Glossary · Modules · Statuses · Default roles · Permissions by role |

Use the `.docx` in Google Docs and the `.xlsx` in Google Sheets: upload to Google Drive, then **Open with**.

## Build

```
pip install -r docs/tools/requirements.txt          (once)
python docs/tools/build_docs.py                     → docs/exports/ (not committed)
python docs/tools/build_docs.py --out D:\Share      → any folder, e.g. a Google Drive folder
python docs/tools/build_docs.py --no-roles          → skip the permissions export (no Node needed)
```

Needs Python 3.10+, Microsoft Edge or Google Chrome (for the PDFs; set `SKERP_PDF_BROWSER` if needed), and, for the permissions tab, the project's Node dependencies.

## Adding a module

Nothing to change in the tool. New pages are picked up automatically:
- `docs/user-guide/NN-<module>.md` → **User Guide**, Part 2 (in file-name order)
- `docs/developer-guide/modules/<module>.md` → **Developer Guide**, Part 3

Then run the build again.
