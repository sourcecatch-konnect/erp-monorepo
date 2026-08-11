import path from "node:path";
import { Prisma } from "../../../generated/prisma/index.js";
import { imageToBase64Src } from "../_shared/pdf.helper.js";
import { logSlipInclude } from "./log-slip.service.js";
import { logSlipPdfTemplate } from "./log-slip-pdf.template.js";

const headerImageSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/skt_logo.svg"),
);

export type LogSlipPdfData = Prisma.LogSlipGetPayload<{
  include: typeof logSlipInclude;
}>;

export const buildLogSlipPdfHtml = (slip: LogSlipPdfData) =>
  logSlipPdfTemplate(slip, { headerImageSrc });
