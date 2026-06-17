export type PdfFieldValue = string | number | null | undefined;

export type PdfLayoutType = "compact-form" | "simple-report";

export type PdfField = {
  label: string;
  value: PdfFieldValue;
  width?: string;
};
export type PdfParty = {
  name?: PdfFieldValue;
  address?: PdfFieldValue;
  gstin?: PdfFieldValue;
  contact?: PdfFieldValue;
  /** Any extra rows rendered as label: value */
  extra?: { label: string; value: PdfFieldValue }[];
};

export type PdfSection = {
  title?: string;
  columns?: 1 | 2 | 3 | 4;
  variant?: "default" | "lr-strip" | "consignor-consignee";
  fields: PdfField[];
  consignor?: PdfParty;
  consignee?: PdfParty;
};

export type PdfTable = {
  title?: string;
  columns: string[];
  rows: PdfFieldValue[][];
};

export type PdfCompany = {
  name?: string;
  address?: string;
  cin?: string;
  email?: string;
  website?: string;
  headerImageSrc?: string;
  watermarkSrc?: string;
};

export type PdfFooterContact = {
  city: string;
  phone: string;
};

export type PdfDocument = {
  layout?: PdfLayoutType;

  title: string;
  subtitle?: string;
  documentNo?: PdfFieldValue;
  date?: PdfFieldValue;
  status?: PdfFieldValue;

  /** Displayed in a single meta-row below the last table: "Created: <date>  •  By: <name>" */
  createdAt?: string;
  createdBy?: string;

  company?: PdfCompany;
  footerContacts?: PdfFooterContact[];

  sections?: PdfSection[];
  tables?: PdfTable[];
  summary?: PdfField[];
  notes?: string[];
  signatures?: string[];
};