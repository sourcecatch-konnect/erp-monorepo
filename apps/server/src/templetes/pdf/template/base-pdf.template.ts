import type { PdfDocument, PdfFieldValue, PdfSection, PdfTable } from "../pdf.type.js";

const safeValue = (value: PdfFieldValue) => {
  if (value === null || value === undefined || value === "") return "-";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const renderHeader = (doc: PdfDocument) => {
  return `
    <div class="letterhead">
      ${
        doc.company?.cin
          ? `<div class="header-cin">CIN : ${safeValue(doc.company.cin)}</div>`
          : ""
      }

      ${
        doc.company?.headerImageSrc
          ? `<img class="header-image" src="${safeValue(doc.company.headerImageSrc)}" />`
          : doc.company?.name
          ? `<div class="company-name">${safeValue(doc.company.name)}</div>`
          : ""
      }

      ${
        doc.company?.address
          ? `<div class="header-address">${safeValue(doc.company.address)}</div>`
          : ""
      }
    </div>
  `;
};

const renderDocumentTitle = (doc: PdfDocument) => {
  return `
    <div class="document-title-row">
      <div class="document-title">
        ${safeValue(doc.title)}
        ${doc.subtitle ? `<div class="document-subtitle">${safeValue(doc.subtitle)}</div>` : ""}
      </div>

      <div class="document-meta">
        ${
          doc.documentNo
            ? `
              <div class="meta-row">
                <strong>No.</strong>
                <span>${safeValue(doc.documentNo)}</span>
              </div>
            `
            : ""
        }

        ${
          doc.date
            ? `
              <div class="meta-row">
                <strong>Date</strong>
                <span>${safeValue(doc.date)}</span>
              </div>
            `
            : ""
        }
      </div>
    </div>
  `;
};

const renderSection = (section: PdfSection) => {
  const columns = section.columns || 2;

  return `
    <div class="section">
      ${section.title ? `<div class="section-title">${safeValue(section.title)}</div>` : ""}

      <div class="field-grid cols-${columns}">
        ${section.fields
          .map(
            (field) => `
              <div class="field">
                <div class="field-label">${safeValue(field.label)}</div>
                <div class="field-value">${safeValue(field.value)}</div>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
};

const renderTable = (table: PdfTable) => {
  return `
    <div class="table-section">
      ${table.title ? `<div class="section-title">${safeValue(table.title)}</div>` : ""}

      <table>
        <thead>
          <tr>
            ${table.columns.map((column) => `<th>${safeValue(column)}</th>`).join("")}
          </tr>
        </thead>

        <tbody>
          ${
            table.rows.length > 0
              ? table.rows
                  .map(
                    (row) => `
                      <tr>
                        ${row.map((cell) => `<td>${safeValue(cell)}</td>`).join("")}
                      </tr>
                    `
                  )
                  .join("")
              : `
                <tr>
                  <td colspan="${table.columns.length}" class="empty-cell">
                    No records available
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
};

const renderSummary = (doc: PdfDocument) => {
  if (!doc.summary || doc.summary.length === 0) return "";

  return `
    <div class="summary-wrapper">
      <div class="summary-box">
        ${doc.summary
          .map(
            (item) => `
              <div class="summary-row">
                <span>${safeValue(item.label)}</span>
                <strong>${safeValue(item.value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
};

const renderNotes = (doc: PdfDocument) => {
  if (!doc.notes || doc.notes.length === 0) return "";

  return `
    <div class="notes-section">
      <div class="section-title">Notes / Terms</div>
      <ol>
        ${doc.notes.map((note) => `<li>${safeValue(note)}</li>`).join("")}
      </ol>
    </div>
  `;
};

const renderSignatures = (doc: PdfDocument) => {
  if (!doc.signatures || doc.signatures.length === 0) return "";

  return `
    <div class="signatures">
      ${doc.signatures
        .map(
          (signature) => `
            <div class="signature-box">
              <div class="signature-space"></div>
              <div class="signature-line"></div>
              <div class="signature-label">${safeValue(signature)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

const renderFooter = (doc: PdfDocument) => {
  const contacts =
    doc.footerContacts
      ?.map(
        (item) => `
          <span class="footer-contact">
            ${safeValue(item.city)} : ${safeValue(item.phone)}
          </span>
        `
      )
      .join("") || "";

  if (!contacts && !doc.company?.email && !doc.company?.website) return "";

  return `
    <div class="footer">
      ${
        contacts
          ? `
            <div class="footer-contact-row">
              ${contacts}
            </div>
          `
          : ""
      }

      ${
        doc.company?.email || doc.company?.website
          ? `
            <div class="footer-main-row">
              ${
                doc.company?.email
                  ? `<span>E-Mail: ${safeValue(doc.company.email)}</span>`
                  : ""
              }

              ${
                doc.company?.website
                  ? `<span>Visit us: ${safeValue(doc.company.website)}</span>`
                  : ""
              }
            </div>
          `
          : ""
      }
    </div>
  `;
};
const baseCss = `
  * {
    box-sizing: border-box;
  }

  @page {
    size: A4;
    margin: 0;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    background: #ffffff;
    font-size: 9.5px;
  }

  @media screen {
    body {
      background: #e5e7eb;
      padding: 16px 0;
    }

    .page {
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
    }
  }

  @media print {
    body {
      background: #ffffff;
      padding: 0;
    }

    .page {
      box-shadow: none;
      margin: 0;
    }
  }

 .page {
  width: 210mm;
  height: 297mm;
  margin: 0 auto;
  background: #ffffff;
  padding: 5mm 7mm 24mm;
  position: relative;
  overflow: hidden;
}

.content {
  position: relative;
  z-index: 1;
  padding-bottom: 22mm;
}

  .watermark {
    position: absolute;
    top: 132mm;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70mm;
    opacity: 0.04;
    z-index: 0;
  }

  .letterhead {
    width: 100%;
    margin-bottom: 4px;
  }

  .header-cin {
  text-align: right;
  font-size: 10px;
  font-weight: 800;
  color: #111;
  line-height: 1.15;
  margin-bottom: 2px;
}
 .header-image {
  display: block;
  width: 100%;
  height: 26mm;
  max-height: 26mm;
  object-fit: contain;
  object-position: center;
}

  .company-name {
    text-align: center;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.8px;
    padding: 8px 0 4px;
  }

.header-address {
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  color: #111;
  line-height: 1.3;
  margin-top: 2px;
}

  .document-title-row {
    display: grid;
    grid-template-columns: 1fr 52mm;
    border: 1px solid #111;
    margin-top: 4px;
  }

  .document-title {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.35px;
    padding: 4px 8px;
  }

  .document-subtitle {
    font-size: 8px;
    font-weight: 700;
    margin-top: 2px;
    text-transform: none;
  }

  .document-meta {
    border-left: 1px solid #111;
  }

  .meta-row {
    display: grid;
    grid-template-columns: 18mm 1fr;
    border-bottom: 1px solid #111;
    min-height: 8mm;
  }

  .meta-row:last-child {
    border-bottom: none;
  }

  .meta-row strong,
  .meta-row span {
    padding: 4px 5px;
  }

  .meta-row strong {
    border-right: 1px solid #111;
  }

  .section,
  .table-section,
  .notes-section {
    border-left: 1px solid #111;
    border-right: 1px solid #111;
    border-bottom: 1px solid #111;
    page-break-inside: avoid;
  }

  .section-title {
    background: #f5f5f5;
    border-bottom: 1px solid #111;
    padding: 4px 6px;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .field-grid {
    display: grid;
  }

  .field-grid.cols-1 {
    grid-template-columns: 1fr;
  }

  .field-grid.cols-2 {
    grid-template-columns: 1fr 1fr;
  }

  .field-grid.cols-3 {
    grid-template-columns: 1fr 1fr 1fr;
  }

  .field-grid.cols-4 {
    grid-template-columns: 1fr 1fr 1fr 1fr;
  }

  .field {
    display: grid;
    grid-template-columns: 35% 65%;
    min-height: 8mm;
    border-right: 1px solid #111;
    border-bottom: 1px solid #111;
  }

  .field:nth-last-child(-n + 2) {
    border-bottom: none;
  }

  .cols-1 .field {
    border-right: none;
  }

  .cols-2 .field:nth-child(2n) {
    border-right: none;
  }

  .cols-3 .field:nth-child(3n) {
    border-right: none;
  }

  .cols-4 .field:nth-child(4n) {
    border-right: none;
  }

  .field-label {
    padding: 4px 5px;
    font-weight: 900;
    border-right: 1px solid #111;
    background: #fafafa;
  }

  .field-value {
    padding: 4px 5px;
    font-weight: 700;
    word-break: break-word;
    line-height: 1.25;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border-right: 1px solid #111;
    border-bottom: 1px solid #111;
    padding: 5px 6px;
    vertical-align: top;
    text-align: left;
    line-height: 1.25;
    word-break: break-word;
  }

  th:last-child,
  td:last-child {
    border-right: none;
  }

  tr:last-child td {
    border-bottom: none;
  }

  th {
    font-size: 8.5px;
    font-weight: 900;
    text-transform: uppercase;
    background: #f5f5f5;
  }

  .empty-cell {
    text-align: center;
    color: #777;
    font-style: italic;
  }

  .summary-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
    page-break-inside: avoid;
  }

  .summary-box {
    width: 75mm;
    border: 1px solid #111;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 7px;
    border-bottom: 1px solid #111;
  }

  .summary-row:last-child {
    border-bottom: none;
    background: #f5f5f5;
  }

  .notes-section {
    margin-top: 6px;
  }

  .notes-section ol {
    margin: 0;
    padding: 6px 8px 6px 18px;
  }

  .notes-section li {
    font-size: 8px;
    line-height: 1.25;
    margin-bottom: 2px;
  }

  .signatures {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    margin-top: 22mm;
    page-break-inside: avoid;
  }

  .signature-box {
    text-align: center;
  }

  .signature-space {
    height: 20mm;
  }

  .signature-line {
    border-top: 1px solid #111;
  }

  .signature-label {
    padding-top: 4px;
    font-weight: 900;
  }


.footer {
  position: absolute;
  left: 7mm;
  right: 7mm;
  bottom: 5mm;
  text-align: center;
    color: #344d74;
  line-height: 1.45;
  z-index: 2;
}
.footer-contact-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  column-gap: 8px;
  row-gap: 2px;
  margin-bottom: 3px;
}

.footer-contact {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  font-size: 8.8px;
  font-weight: 900;
}
.footer-contact::before {
  content: "✣";
  color: #7f1d1d;
  font-size: 9px;
  margin-right: 3px;
}

.footer-main-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 9px;
  font-weight: 900;
  color: #344d74;
}
`;

export const basePdfTemplate = (doc: PdfDocument) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />

        <style>
          ${baseCss}
        </style>
      </head>

      <body>
        <div class="page">
          ${
            doc.company?.watermarkSrc
              ? `<img class="watermark" src="${safeValue(doc.company.watermarkSrc)}" />`
              : ""
          }

          <div class="content">
            ${renderHeader(doc)}
            ${renderDocumentTitle(doc)}

            ${(doc.sections || []).map(renderSection).join("")}

            ${(doc.tables || []).map(renderTable).join("")}

            ${renderSummary(doc)}
            ${renderNotes(doc)}
            ${renderSignatures(doc)}
          </div>

          ${renderFooter(doc)}
        </div>
      </body>
    </html>
  `;
};