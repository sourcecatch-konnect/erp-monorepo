export type PdfAction = "download" | "print";

/**
 * Take a PDF `Blob` and either trigger a browser download or open it in a
 * hidden iframe and invoke the print dialog. Shared by the LR / GRN / Branch
 * GRN detail screens so the "with / without letterhead" menus behave the same.
 */
export const runPdfAction = (
  blob: Blob,
  action: PdfAction,
  fileName: string,
): void => {
  const url = window.URL.createObjectURL(blob);

  if (action === "download") {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    iframe.remove();
    window.URL.revokeObjectURL(url);
  }, 60_000);
};
