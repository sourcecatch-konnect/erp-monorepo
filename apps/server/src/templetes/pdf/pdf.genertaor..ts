import puppeteer from "puppeteer";
import type { PdfDocument } from "./pdf.type.js";
import { basePdfTemplate } from "./template/base-pdf.template.js";

/** Render any ready-made HTML string to an A4 PDF buffer. */
export const generatePdfFromHtml = async (html: string) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // Reduce memory / image quality overhead
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--run-all-compositor-stages-before-draw",
      "--disable-extensions",
      "--disable-background-networking",
    ],
  });

  try {
    const page = await browser.newPage();

    // Limit viewport to A4 at 96 dpi — avoids Puppeteer loading a huge virtual screen
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

    await page.setContent(html, { waitUntil: "load" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
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

export const generatePdfBuffer = async (doc: PdfDocument) =>
  generatePdfFromHtml(basePdfTemplate(doc));