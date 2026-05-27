import { AxiosResponse } from "axios";
import type { ApiResponse, ListMeta } from "@skerp/types";

export type ListResult<T> = {
  data: T[];
  meta?: ListMeta;
};

export type ListQuery = {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  filter?: Record<string, string>;
};

export type BulkImportResult = {
  inserted: number;
  errors: { row: number; issues: string[] }[];
};

export const downloadBlob = (
  blob: Blob,
  filename: string
) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const parseCsvRows = <TRow extends Record<string, string>>(
  text: string
) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0];

  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());

    return headers.reduce((row, header, index) => {
      row[header as keyof TRow] = (values[index] ?? "") as TRow[keyof TRow];
      return row;
    }, {} as TRow);
  });
};

export const unwrapApiResponse = <T>(
  res: AxiosResponse<ApiResponse<T>>
): T => {
  const response = res.data;

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
};

export const unwrapListResponse = <T>(
  res: AxiosResponse<ApiResponse<T[]>>
): ListResult<T> => {
  const response = res.data;

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return {
    data: response.data,
    meta: response.meta,
  };
};
