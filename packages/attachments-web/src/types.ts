export type AntivirusStatus = "PENDING" | "CLEAN" | "INFECTED" | "FAILED";

export type ListMeta = {
  page: number;
  size: number;
  total: number;
};

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  meta?: ListMeta;
};

export type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  branchId: string | null;
  s3Key: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  uploaded: boolean;
  antivirusStatus: AntivirusStatus;
  scanError: string | null;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
};

export type PresignResponse = {
  attachmentId: string;
  s3Key: string;
  uploadUrl: string;
};

export type CreateAttachmentBody = {
  entityType: string;
  entityId: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
};
