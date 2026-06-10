import puppeteer from "puppeteer";
import type { PdfDocument } from "./pdf.type.js";
import { basePdfTemplate } from "./template/base-pdf.template.js";
export const generatePdfBuffer = async (doc: PdfDocument) => {
  const html = basePdfTemplate(doc);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

await page.setContent(html, {
  waitUntil: "load",
});

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};