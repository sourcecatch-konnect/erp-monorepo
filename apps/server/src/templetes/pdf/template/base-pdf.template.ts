import type { PdfDocument, PdfFieldValue, PdfParty } from "../pdf.type.js";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const display = (value: PdfFieldValue) => {
  if (value === null || value === undefined || value === "") return "-";
  return escapeHtml(value);
};

const normalizeStatus = (status: PdfFieldValue) =>
  String(status ?? "").replace(/\s+/g, "").toLowerCase();

const statusLabel = (status: PdfFieldValue) => {
  const raw = String(status ?? "");
  if (!raw) return "-";

  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
};

const statusClass = (status: PdfFieldValue) => {
  const value = normalizeStatus(status);

  if (["completed", "complete"].includes(value)) return "status-completed";
  if (["cancelled", "canceled"].includes(value)) return "status-cancelled";
  if (["pending", "pendingapproval", "planned"].includes(value)) return "status-pending";
  if (["confirmed", "inprogress", "intransit"].includes(value)) return "status-active";
  if (["rejected"].includes(value)) return "status-rejected";

  return "status-default";
};

const renderBadge = (status: PdfFieldValue) => `
  <span class="status-badge ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
`;

const isStatusField = (label: string) => label.trim().toLowerCase() === "status";
const renderParty = (label: string, party: PdfParty | undefined) => {
  if (!party) return `<div class="cc-party"><div class="cc-party-label">${escapeHtml(label)}</div><div class="cc-empty">—</div></div>`;

  const rows: string[] = [];

  if (party.name)
    rows.push(`<div class="cc-name">${escapeHtml(String(party.name))}</div>`);

  if (party.address)
    rows.push(`<div class="cc-row"><span class="cc-row-label">Address</span><span class="cc-row-value">${escapeHtml(String(party.address))}</span></div>`);

  if (party.gstin)
    rows.push(`<div class="cc-row"><span class="cc-row-label">GSTIN</span><span class="cc-row-value">${escapeHtml(String(party.gstin))}</span></div>`);

  if (party.contact)
    rows.push(`<div class="cc-row"><span class="cc-row-label">Contact</span><span class="cc-row-value">${escapeHtml(String(party.contact))}</span></div>`);

  for (const ex of party.extra ?? []) {
    if (ex.value !== null && ex.value !== undefined && ex.value !== "")
      rows.push(`<div class="cc-row"><span class="cc-row-label">${escapeHtml(ex.label)}</span><span class="cc-row-value">${escapeHtml(String(ex.value))}</span></div>`);
  }

  return `
    <div class="cc-party">
      <div class="cc-party-label">${escapeHtml(label)}</div>
      ${rows.join("\n")}
    </div>`;
};

export const basePdfTemplate = (doc: PdfDocument) => {
  const sections = doc.sections ?? [];
  const tables = doc.tables ?? [];
  const summary = doc.summary ?? [];
  const notes = doc.notes ?? [];
  const signatures = doc.signatures ?? [];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: A4;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #111827;
      background: #ffffff;
      font-family: "Times New Roman", Times, serif;
      font-size: 12px;
      line-height: 1.42;
    }

    .page {
      width: 100%;
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      padding-bottom: 12px;
      border-bottom: 2px solid #111827;
    }

    .brand-name {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.2px;
      color: #991b1b;
      text-transform: uppercase;
    }

    .brand-meta {
      margin-top: 5px;
      max-width: 470px;
      color: #4b5563;
      font-size: 10.5px;
    }

     .brand { flex: 1; min-width: 0; }
     .brand-logo {
      display: block;
      width: 260px;
      max-width: 100%;
      height: 48px;
      object-fit: contain;
      object-position: left center;
      margin-bottom: 5px;
    }
    .doc-meta {
  min-width: 190px;
  text-align: right;
}

.doc-title {
  font-size: 21px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 8px;
}

.doc-info-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.meta-line {
  color: #374151;
  font-size: 11.5px;
  line-height: 1.25;
}

    .status-badge {
      display: inline-block;
      margin-top: 7px;
      padding: 4px 9px;
      border-radius: 999px;
      font-size: 11px;
      line-height: 1;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.35px;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .status-pending {
      color: #92400e;
      background: #fef3c7;
      border-color: #f59e0b;
    }

    .status-completed {
      color: #065f46;
      background: #d1fae5;
      border-color: #10b981;
    }

    .status-cancelled,
    .status-rejected {
      color: #991b1b;
      background: #fee2e2;
      border-color: #ef4444;
    }

    .status-active {
      color: #1e40af;
      background: #dbeafe;
      border-color: #3b82f6;
    }

    .status-default {
      color: #374151;
      background: #f3f4f6;
      border-color: #d1d5db;
    }

    .section {
      margin-top: 13px;
      break-inside: avoid;
    }

    .section-title,
    .table-title,
    .summary-title,
    .notes-title {
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 800;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.35px;
    }

    .fields {
      display: grid;
      gap: 7px;
    }

    .cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

    .field {
      min-height: 44px;
      padding: 8px 9px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #ffffff;
    }

    .label {
      margin-bottom: 3px;
      color: #6b7280;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.35px;
    }

    .value {
      color: #111827;
      font-size: 12px;
      font-weight: 700;
      word-break: break-word;
    }

    /* ── Consignor / Consignee strip ─────────────────────────────────── */
    .cc-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border: 1px solid #111827;
      border-radius: 4px;
      overflow: hidden;
    }

    /* dividing line between left and right */
    .cc-party + .cc-party {
      border-left: 1px solid #111827;
    }

    .cc-party {
      padding: 10px 12px;
      background: #ffffff;
    }

    .cc-party-label {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #ffffff;
      background: #111827;
      display: inline-block;
      padding: 2px 7px;
      border-radius: 2px;
      margin-bottom: 8px;
    }

    .cc-name {
      font-size: 15px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 6px;
      line-height: 1.3;
    }

    .cc-row {
      display: flex;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 12px;
      line-height: 1.35;
    }

    .cc-row-label {
      flex-shrink: 0;
      min-width: 52px;
      color: #6b7280;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding-top: 1px;
    }

    .cc-row-value {
      color: #111827;
      word-break: break-word;
    }

    .cc-empty { color: #9ca3af; font-style: italic; font-size: 10.5px; }
   table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
      font-size: 12px;
      break-inside: avoid;
      font-family: "Times New Roman", Times, serif;
    }

    th {
      padding: 7px 8px;
      text-align: left;
      color: #ffffff;
      background: #111827;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    td {
      padding: 7px 8px;
      border: 1px solid #d1d5db;
      vertical-align: top;
      word-break: break-word;
    }

    tbody tr:nth-child(even) td { background: #f9fafb; }
    .summary {
      margin-top: 13px;
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: #f9fafb;
      break-inside: avoid;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 4px 0;
      font-size: 11.5px;
    }

    .summary-row strong { font-size: 13px; }

    /* ── Notes ───────────────────────────────────────────────────────── */
    .notes { margin-top: 12px; color: #374151; font-size: 12px; }
    .notes ul { margin: 4px 0 0; padding-left: 16px; }

    /* ── Created row ─────────────────────────────────────────────────── */
    .created-row {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #d1d5db;
      color: #4b5563;
      font-size: 12px;
    }

    .created-row {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #d1d5db;
      color: #4b5563;
      font-size: 12px;
    }

    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 34px;
      break-inside: avoid;
    }

    .signature {
      padding-top: 24px;
      border-top: 1px solid #111827;
      text-align: center;
      color: #374151;
      font-size: 12px;
      font-weight: 700;
    }

    .footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #d1d5db;
      color: #6b7280;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
  <div class="brand">
    ${doc.company?.headerImageSrc
      ? `<img class="brand-logo" src="${doc.company.headerImageSrc}" alt="${escapeHtml(doc.company.name)}" />`
      : `<div class="brand-name">${escapeHtml(doc.company?.name ?? "S K TRANS LINES PVT. LTD.")}</div>`
    }

    <div class="brand-meta">
      ${escapeHtml(doc.company?.address ?? "")}
      ${doc.company?.cin ? ` • CIN: ${escapeHtml(doc.company.cin)}` : ""}
      ${doc.company?.email ? ` • ${escapeHtml(doc.company.email)}` : ""}
      ${doc.company?.website ? ` • ${escapeHtml(doc.company.website)}` : ""}
    </div>
  </div>

  <div class="doc-meta">
    <div class="doc-title">${escapeHtml(doc.title)}</div>
    <div class="doc-info-row">
  ${doc.documentNo ? `<div class="meta-line"><strong>No:</strong> ${display(doc.documentNo)}</div>` : ""}
  ${doc.date ? `<div class="meta-line"><strong>Date:</strong> ${display(doc.date)}</div>` : ""}
  ${doc.status ? `<div>${renderBadge(doc.status)}</div>` : ""}
</div>
  </div>
</header>

    ${sections.map((section) => {
      // ── Consignor / Consignee variant ──────────────────────────────
      if (section.variant === "consignor-consignee") {
        return `
          <section class="section">
            ${section.title ? `<div class="section-title">${escapeHtml(section.title)}</div>` : ""}
            <div class="cc-strip">
              ${renderParty("Consignor", section.consignor)}
              ${renderParty("Consignee", section.consignee)}
            </div>
          </section>`;
      }

      // ── Default grid variant ────────────────────────────────────────
      const cols = section.columns ?? 2;
      return `
        <section class="section">
          ${section.title ? `<div class="section-title">${escapeHtml(section.title)}</div>` : ""}
          <div class="fields cols-${cols}">
            ${section.fields.map((field) => `
              <div class="field" style="${field.width ? `grid-column: span ${escapeHtml(field.width)};` : ""}">
                <div class="label">${escapeHtml(field.label)}</div>
                <div class="value">
                  ${isStatusField(field.label) ? renderBadge(field.value) : display(field.value)}
                </div>
              </div>`).join("")}
          </div>
        </section>`;
    }).join("")}

    <!-- ── Tables ──────────────────────────────────────────────────── -->
    ${tables.map((table) => `
      <section class="section">
        ${table.title ? `<div class="table-title">${escapeHtml(table.title)}</div>` : ""}
        <table>
          <thead>
            <tr>${table.columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${table.rows.length
        ? table.rows.map((row) => `
                  <tr>${row.map((cell, i) => {
          const col = table.columns[i] ?? "";
          return `<td>${col.toLowerCase() === "status" ? renderBadge(cell) : display(cell)}</td>`;
        }).join("")}</tr>`).join("")
        : `<tr><td colspan="${table.columns.length}">No records found</td></tr>`
      }
          </tbody>
        </table>
      </section>`).join("")}

    <!-- ── Summary ─────────────────────────────────────────────────── -->
    ${summary.length ? `
      <section class="summary">
        <div class="summary-title">Summary</div>
        ${summary.map((item) => `
          <div class="summary-row">
            <span>${escapeHtml(item.label)}</span>
            <strong>${display(item.value)}</strong>
          </div>`).join("")}
      </section>` : ""}

    <!-- ── Notes ───────────────────────────────────────────────────── -->
    ${notes.length ? `
      <section class="notes">
        <div class="notes-title">Notes</div>
        <ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
      </section>` : ""}

    <!-- ── Created row ─────────────────────────────────────────────── -->
    ${doc.createdAt || doc.createdBy ? `
      <div class="created-row">
        ${doc.createdAt ? `<strong>Created:</strong> ${escapeHtml(doc.createdAt)}` : ""}
        ${doc.createdAt && doc.createdBy ? " &nbsp;&bull;&nbsp; " : ""}
        ${doc.createdBy ? `<strong>By:</strong> ${escapeHtml(doc.createdBy)}` : ""}
      </div>` : ""}

    <!-- ── Signatures ───────────────────────────────────────────────── -->
    ${signatures.length ? `
      <section class="signatures">
        ${signatures.map((label) => `<div class="signature">${escapeHtml(label)}</div>`).join("")}
      </section>` : ""}

    <!-- ── Footer ──────────────────────────────────────────────────── -->
    ${doc.footerContacts?.length ? `
      <footer class="footer">
        ${doc.footerContacts.map((c) => `${escapeHtml(c.city)}: ${escapeHtml(c.phone)}`).join(" | ")}
      </footer>` : ""}

  </main>
</body>
</html>`;
};