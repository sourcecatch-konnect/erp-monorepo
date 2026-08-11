// apps/web/src/features/grn/grn.service.ts

import { api } from "@/lib/api";
import type {
  ApiResponse,
  GRN as GRNDetail,
  GRNVPLoadingSummary,
} from "@skerp/types";
import {
  ListQuery,
  ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type GRNStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";

export type GRNGoodsInput = {
  lrGoodsId?: string;
  goodsName: string;
  description?: string;
  totalQty: number;
  receivedQty: number;
  damageQty: number;
  shortageQty: number;
  quantityUnitId?: string;
  weightUnitId?: string;
  unit?: string;
  weight?: number;
  remarks?: string;
};

export type CreateGRNBody = {
  lorryReceiptId: string;

  gateNo: string;
  labourCount: number;
  inDateTime?: string;
  outDateTime?: string;
  unloadingMinutes?: number;
  totalWeightMt?: number;

  totalFreight?: number;
  balanceFreight?: number;
  freightPerMt?: number;
  labourName?: string;
  detentionDays?: number;
  detentionRate?: number;

  advanceAmount?: number;
  damageAmount?: number;
  tdsAmount?: number;
  hamaliAmount?: number;
  printingStationaryAmount?: number;

  labourId?: string;
  labourCharge?: number;
  unloadingSupervisorId?: string;

  damagesBy?: string;

  lrCopyChecked?: boolean;
  invoiceChecked?: boolean;
  kataReceiptChecked?: boolean;
  wayBillChecked?: boolean;
  sealNoChecked?: boolean;

  lrCopyRemark?: string;
  invoiceRemark?: string;
  kataReceiptRemark?: string;
  wayBillRemark?: string;
  sealNoRemark?: string;

  remarks?: string;

  goods: GRNGoodsInput[];

  // For now send [].
  // Later this will contain uploaded damage photo attachment ids.
  damagePhotoAttachmentIds: string[];
};

export type UpdateGRNBody = CreateGRNBody & {
  version?: number;
};

export type SubmitGRNBody = {
  version?: number;
  damagePhotoAttachmentIds: string[];
};

export type CancelGRNBody = {
  reason: string;
  version?: number;
};

export type GRN = {
  id: string;
  grnNumber: string;
  status: GRNStatus;
  lorryReceiptId: string;
  gateNo: string;
  labourCount: number;
  totalQty?: number;
  receivedQty?: number;
  damageQty?: number;
  shortageQty?: number;
  version?: number;
  createdAt?: string;
  updatedAt?: string | null;
  damagePhotos?: unknown[];
  vpLoadingSummary?: GRNVPLoadingSummary;
  [key: string]: unknown;
};

export type EligibleLR = {
  id: string;
  lrNumber: string;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type GRNPreviewGoods = {
  lrGoodsId: string;
  goodsName: string;
  description?: string | null;
  totalQty: number;
  receivedQty: number;
  damageQty: number;
  shortageQty: number;
  quantityUnitId?: string | null;
  weightUnitId?: string | null;
  quantityUnit?: {
    id: string;
    code: string;
    name: string;
  } | null;
  weightUnit?: {
    id: string;
    code: string;
    name: string;
  } | null;
  unit?: string | null;
  weight?: number | string | null;
  remarks?: string;
};

export type GRNPreview = {
  lorryReceipt: {
    id: string;
    lrNumber: string;
    status: string;
    fyCode?: string | null;
    createdAt?: string;
    invoiceNumber?: string | null;
    invoiceAmount?: number | string | null;
    totalWeight?: number | string | null;
    unit?: string | null;
    loadingLocation?: unknown;
    unloadingLocation?: unknown;
    ewayBill?: unknown;
    group?: unknown;
  };
  vehicleInfo: {
    type: "MARKET" | "OWN";
    vehicleNumber?: string | null;
    driverName?: string | null;
    driverMobile?: string | null;
    tripNumber?: string | null;
    tripName?: string | null;
  };
  chargeDefaults: {
    totalFreight?: number | string | null;
    advanceAmount?: number | string | null;
    hamaliAmount?: number | string | null;
    tdsAmount?: number | string | null;
    commissionAmount?: number | string | null;
  };
  goods: GRNPreviewGoods[];
  totals: {
    totalQty: number;
  };
};

const encodeGRNIdentifier = (identifier: string) =>
  encodeURIComponent(identifier);

/* ------------------------------------------------------------------ */
/* API                                                                */
/* ------------------------------------------------------------------ */

export const grnApi = {
  list: async (query?: ListQuery): Promise<ListResult<GRN>> => {
    const params: Record<string, string | number> = {};

    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;

    if (query?.filter?.status) {
      params["filter[status]"] = String(query.filter.status);
    }

    const res = await api.get<ApiResponse<GRN[]>>("/grn", {
      params,
    });

    return unwrapListResponse(res);
  },

  statusCounts: async (): Promise<Record<string, number>> => {
    const res =
      await api.get<ApiResponse<Record<string, number>>>("/grn/status-counts");

    return unwrapApiResponse(res);
  },
  getDamagePhotoViewUrl: async (
    grnId: string,
    photoId: string,
  ): Promise<{ viewUrl: string }> => {
    const res = await api.get(
      `/grn/${encodeURIComponent(grnId)}/damage-photos/${encodeURIComponent(
        photoId,
      )}/view-url`,
    );

    return res.data.data ?? res.data;
  },
  eligibleLRs: async (query?: ListQuery): Promise<ListResult<EligibleLR>> => {
    const params: Record<string, string | number> = {};

    if (query?.page !== undefined) params.page = query.page;
    if (query?.size !== undefined) params.size = query.size;
    if (query?.search) params.search = query.search;
    if (query?.sort) params.sort = query.sort;

    const res = await api.get<ApiResponse<EligibleLR[]>>("/grn/eligible-lrs", {
      params,
    });

    return unwrapListResponse(res);
  },

  preview: async (lrId: string): Promise<GRNPreview> => {
    const res = await api.get<ApiResponse<GRNPreview>>(
      `/grn/preview/${encodeURIComponent(lrId)}`,
    );

    return unwrapApiResponse(res);
  },

  detail: async (identifier: string): Promise<GRNDetail> => {
    const res = await api.get<ApiResponse<GRNDetail>>(
      `/grn/${encodeGRNIdentifier(identifier)}`,
    );

    return unwrapApiResponse(res);
  },

  create: async (body: CreateGRNBody): Promise<GRN> => {
    const res = await api.post<ApiResponse<GRN>>("/grn", {
      ...body,
      damagePhotoAttachmentIds: body.damagePhotoAttachmentIds ?? [],
    });

    return unwrapApiResponse(res);
  },

  update: async (identifier: string, body: UpdateGRNBody): Promise<GRN> => {
    const res = await api.put<ApiResponse<GRN>>(
      `/grn/${encodeGRNIdentifier(identifier)}`,
      {
        ...body,
        damagePhotoAttachmentIds: body.damagePhotoAttachmentIds ?? [],
      },
    );

    return unwrapApiResponse(res);
  },

  submit: async (identifier: string, body: SubmitGRNBody): Promise<GRN> => {
    const res = await api.post<ApiResponse<GRN>>(
      `/grn/${encodeGRNIdentifier(identifier)}/submit`,
      {
        ...body,
        damagePhotoAttachmentIds: body.damagePhotoAttachmentIds ?? [],
      },
    );

    return unwrapApiResponse(res);
  },

  cancel: async (identifier: string, body: CancelGRNBody): Promise<GRN> => {
    const res = await api.post<ApiResponse<GRN>>(
      `/grn/${encodeGRNIdentifier(identifier)}/cancel`,
      body,
    );

    return unwrapApiResponse(res);
  },
};
