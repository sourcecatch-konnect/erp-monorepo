import type { AxiosInstance } from "axios";
import axios from "axios";
import type {
  ApiResponse,
  Attachment,
  CreateAttachmentBody,
  PresignResponse,
} from "./types";

const unwrap = <T>(response: { data: ApiResponse<T> | T }): T => {
  const body = response.data as ApiResponse<T>;
  return typeof body === "object" && body && "ok" in body
    ? body.data
    : (response.data as T);
};

export const createAttachmentApi = (api: AxiosInstance) => {
  /** Step 1: ask the server for a presigned PUT URL + create the pending row. */
  const presign = async (
    body: CreateAttachmentBody,
  ): Promise<PresignResponse> => {
    const response = await api.post<ApiResponse<PresignResponse>>(
      "/attachments",
      body,
    );
    return unwrap(response);
  };

  /**
   * Step 2: PUT the raw file straight to S3 with the presigned URL. Bytes never
   * touch our API server. Uses a bare axios (no withCredentials) so we don't
   * leak cookies to S3.
   */
  const uploadToS3 = async (
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<void> => {
    await axios.put(uploadUrl, file, {
      headers: { "Content-Type": file.type },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
  };

  /** Step 3: confirm the upload landed → server verifies + enqueues the AV scan. */
  const complete = async (attachmentId: string): Promise<Attachment> => {
    const response = await api.post<ApiResponse<Attachment>>(
      `/attachments/${attachmentId}/complete`,
    );
    return unwrap(response);
  };

  /** List attachments for a host entity. */
  const listByEntity = async (
    entityType: string,
    entityId: string,
  ): Promise<Attachment[]> => {
    const response = await api.get<ApiResponse<Attachment[]>>("/attachments", {
      params: { entityType, entityId },
    });
    return unwrap(response);
  };

  /** Resolve a presigned GET URL (server refuses non-CLEAN files with 409). */
  const getDownloadUrl = async (attachmentId: string): Promise<string> => {
    const response = await api.get<ApiResponse<{ downloadUrl: string }>>(
      `/attachments/${attachmentId}/download`,
    );
    return unwrap(response).downloadUrl;
  };

  const remove = async (attachmentId: string): Promise<void> => {
    await api.delete(`/attachments/${attachmentId}`);
  };

  /** Convenience: full presign → PUT → complete flow for one file. */
  const upload = async (
    body: CreateAttachmentBody,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<Attachment> => {
    const presigned = await presign(body);
    await uploadToS3(presigned.uploadUrl, file, onProgress);
    return complete(presigned.attachmentId);
  };

  return {
    presign,
    uploadToS3,
    complete,
    listByEntity,
    getDownloadUrl,
    remove,
    upload,
  };
};

export type AttachmentApi = ReturnType<typeof createAttachmentApi>;
