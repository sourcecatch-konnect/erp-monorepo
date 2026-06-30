import { api } from "@/lib/api";

import type {
  ApiResponse,
  Labour,
  CreateLabourBody,
  UpdateLabourBody,
  LabourWithRelations,
} from "@skerp/types";

import {
  ListQuery,
  ListResult,
  BulkImportResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../_shared/master-api";

export const labourApi = {
  list: async (
    query?: ListQuery
  ): Promise<ListResult<Labour>> => {
    try {
      const res = await api.get<
        ApiResponse<Labour[]>
      >("/labours", {
        params: query,
      });

      return unwrapListResponse(res);
    } catch (error) {
      console.error(
        "Failed to fetch labour list:",
        error
      );

      throw error;
    }
  },

  detail: async (id: string): Promise<LabourWithRelations> => {
  const res = await api.get<ApiResponse<LabourWithRelations>>(
    `/labour/${id}`,
  );

  if (!res.data.ok) {
    throw new Error(res.data.error.message);
  }

  return res.data.data;
},

  create: async (
    body: CreateLabourBody
  ): Promise<Labour> => {
    try {
      const res = await api.post<
        ApiResponse<Labour>
      >("/labours", body);

      return unwrapApiResponse(res);
    } catch (error) {
      console.error(
        "Failed to create labour:",
        error
      );

      throw error;
    }
  },

  update: async (
    id: string,
    body: UpdateLabourBody
  ): Promise<Labour> => {
    try {
      const res = await api.patch<
        ApiResponse<Labour>
      >(
        `/labours/${id}`,
        body
      );

      return unwrapApiResponse(res);
    } catch (error) {
      console.error(
        `Failed to update labour ${id}:`,
        error
      );

      throw error;
    }
  },

  remove: async (
    id: string
  ): Promise<void> => {
    try {
      const res = await api.delete<
        ApiResponse<null>
      >(`/labours/${id}`);

      unwrapApiResponse(res);
    } catch (error) {
      console.error(
        `Failed to delete labour ${id}:`,
        error
      );

      throw error;
    }
  },

  bulkRemove: async (
    ids: string[]
  ) => {
    try {
      const res =
        await api.post<
          ApiResponse<{
            count: number;
          }>
        >(
          "/labours/bulk-delete",
          { ids }
        );

      return unwrapApiResponse(res);
    } catch (error) {
      console.error(
        "Failed to bulk delete labour:",
        error
      );

      throw error;
    }
  },

  bulkImport: async (
    rows: CreateLabourBody[]
  ): Promise<BulkImportResult> => {
    try {
      const res =
        await api.post<
          ApiResponse<BulkImportResult>
        >(
          "/labours/bulk-import",
          { rows }
        );

      return unwrapApiResponse(res);
    } catch (error) {
      console.error(
        "Failed to import labour:",
        error
      );

      throw error;
    }
  },

  export: async (
    query?: ListQuery
  ): Promise<Blob> => {
    try {
      const res =
        await api.get<Blob>(
          "/labours/export",
          {
            params: query,
            responseType:
              "blob",
          }
        );

      return res.data;
    } catch (error) {
      console.error(
        "Failed to export labour:",
        error
      );

      throw error;
    }
  },

  search: async (
    q: string
  ): Promise<Labour[]> => {
    try {
      const res = await api.get<
        ApiResponse<Labour[]>
      >(
        "/labours/search",
        {
          params: { q },
        }
      );

      return unwrapApiResponse(
        res
      );
    } catch (error) {
      console.error(
        "Failed to search labour:",
        error
      );

      throw error;
    }
  },
};