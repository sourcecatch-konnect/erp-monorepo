import type { ApiResponse } from "@skerp/types";

import { api } from "@/lib/api";
import {
  type ListQuery,
  type ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "@/features/masters/_shared/master-api";

export type RailBranchGRNItem = {
  id: string;
  vpLoadingGoodsId: string;
  lrNumberSnapshot: string;
  consignorNameSnapshot?: string | null;
  consigneeNameSnapshot?: string | null;
  goodsNameSnapshot: string;
  unitSnapshot?: string | null;
  loadedQty: number;
  receivedQty: number;
  damageQty: number;
  shortageQty: number;
  remarks?: string | null;
  vpLoadingGoods: {
    id: string;
    loadingDamageQty: number;
    vpLoading: {
      id: string;
      loadingNumber: string;
      grn: { id: string; grnNumber: string };
    };
  };
};

export type RailBranchGRNDetail = {
  id: string;
  railRakeId: string;
  vpWagonLoadingId: string;
  status: "DRAFT" | "SUBMITTED";
  inDateTime?: string | null;
  outDateTime?: string | null;
  unloadingMinutes?: number | null;
  damagesBy:
  | "NONE"
  | "TRANSPORTER"
  | "LABOUR"
  | "RAILWAY"
  | "CUSTOMER"
  | "UNKNOWN";
  labourCount: number;
  labourLeaderId?: string | null;
  labourCharge?: string | number | null;
  unloadingSupervisorId?: string | null;
  unloadingSupervisor?: {
    id: string;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  totalLoadedQty: number;
  totalReceivedQty: number;
  totalDamageQty: number;
  totalShortageQty: number;
  remarks?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  damagePhotos: Array<{
    id: string;
    originalName?: string | null;
    mime: string;
    sizeBytes: number;
  }>;
  railRake: {
    id: string;
    rakeNumber: string;
    status: string;
    fromBranch: { id: string; name: string; branchCode: string };
    toBranch: { id: string; name: string; branchCode: string };
    vpSchedule: {
      id: string;
      scheduleNumber: string;
      scheduleName?: string | null;
      scheduleDate: string;

      sourceArea: {
        id: string;
        name: string;
      } | null;

      destinationArea: {
        id: string;
        name: string;
      } | null;
    };
  };
  vpWagonLoading: {
    id: string;
    status: string;
    mrRrRow: {
      id: string;
      rowLabel: string;
      vpNo?: string | null;
      mrRrNo?: string | null;
      sealNo?: string | null;
      wagon: { id: string; name: string };
    };
  };
  items: RailBranchGRNItem[];
};

export type RailBranchGRNListItem = Pick<
  RailBranchGRNDetail,
  | "id"
  | "status"
  | "totalLoadedQty"
  | "totalReceivedQty"
  | "totalDamageQty"
  | "totalShortageQty"
  | "inDateTime"
  | "outDateTime"
  | "submittedAt"
  | "createdAt"
  | "version"
> & {
  railRake: RailBranchGRNDetail["railRake"];
  vpWagonLoading: RailBranchGRNDetail["vpWagonLoading"];
};

export type RailBranchGRNPreviewItem = {
  vpLoadingGoodsId: string;
  lrNumber: string;
  grnNumber: string;
  loadingNumber: string;
  consignorName: string;
  consigneeName: string;
  goodsName: string;
  description?: string | null;
  unit?: string | null;
  loadedQty: number;
  loadingDamageQty: number;
  receivedQty: number;
  damageQty: number;
  shortageQty: number;
  remarks?: string | null;
};

export type RailBranchGRNPreview = {
  alreadyExists: boolean;
  branchGrn?: { id: string; status: string };
  railRake: RailBranchGRNDetail["railRake"];
  vpWagonLoading: {
    id: string;
    status: string;
    totalLoadedQty: number;
    row: RailBranchGRNDetail["vpWagonLoading"]["mrRrRow"];
  };
  totals?: {
    totalLoadedQty: number;
    totalGoodsLines: number;
  };
  items: RailBranchGRNPreviewItem[];
};

export type CreateRailBranchGRNItemInput = Omit<
  RailBranchGRNItemInput,
  "id"
> & {
  vpLoadingGoodsId: string;
};

export type CreateRailBranchGRNBody = Omit<
  UpdateRailBranchGRNBody,
  "version" | "items"
> & {
  railRakeId: string;
  vpWagonLoadingId: string;
  items: CreateRailBranchGRNItemInput[];
};

export type RailBranchGRNItemInput = {
  id: string;
  receivedQty: number;
  damageQty: number;
  shortageQty: number;
  remarks?: string;
};

export type UpdateRailBranchGRNBody = {
  version: number;
  inDateTime?: string;
  outDateTime?: string;
  unloadingMinutes?: number;
  damagesBy?: RailBranchGRNDetail["damagesBy"];
  labourCount?: number;
  labourLeaderId?: string;
  labourCharge?: number;
  unloadingSupervisorId?: string;
  remarks?: string;
  items: RailBranchGRNItemInput[];
  damagePhotoAttachmentIds?: string[];
};

export type RailBranchGRNSupervisor = {
  id: string;
  name: string;
  email: string;
};

export const railBranchGrnApi = {
  list: async (
    query: ListQuery,
  ): Promise<ListResult<RailBranchGRNListItem>> => {
    const params: Record<string, string | number> = {
      page: query.page ?? 0,
      size: query.size ?? 10,
    };
    if (query.search) params.search = query.search;
    if (query.sort) params.sort = query.sort;
    if (query.filter?.status) {
      params["filter[status]"] = String(query.filter.status);
    }
    const response = await api.get<ApiResponse<RailBranchGRNListItem[]>>(
      "/rail-branch-grns",
      { params },
    );
    return unwrapListResponse(response);
  },

  preview: async (railRakeId: string, vpWagonLoadingId: string) => {
    const response = await api.get<ApiResponse<RailBranchGRNPreview>>(
      "/rail-branch-grns/preview",
      { params: { railRakeId, vpWagonLoadingId } },
    );
    return unwrapApiResponse(response);
  },
  supervisors: async (railRakeId: string) => {
    const response = await api.get<ApiResponse<RailBranchGRNSupervisor[]>>(
      "/rail-branch-grns/supervisors",
      {
        params: {
          railRakeId,
        },
      },
    );

    return unwrapApiResponse(response);
  },

  create: async (body: CreateRailBranchGRNBody) => {
    const response = await api.post<
      ApiResponse<{
        branchGrn: RailBranchGRNDetail;
        alreadyExists: boolean;
      }>
    >("/rail-branch-grns", body);
    return unwrapApiResponse(response);
  },

  detail: async (id: string) => {
    const response = await api.get<ApiResponse<RailBranchGRNDetail>>(
      `/rail-branch-grns/${encodeURIComponent(id)}`,
    );
    return unwrapApiResponse(response);
  },

  update: async (id: string, body: UpdateRailBranchGRNBody) => {
    const response = await api.patch<ApiResponse<RailBranchGRNDetail>>(
      `/rail-branch-grns/${encodeURIComponent(id)}`,
      body,
    );
    return unwrapApiResponse(response);
  },

  submit: async (
    id: string,
    version: number,
    damagePhotoAttachmentIds: string[] = [],
  ) => {
    const response = await api.post<
      ApiResponse<{
        branchGrn: RailBranchGRNDetail;
        alreadySubmitted: boolean;
        railRake?: { id: string; rakeNumber: string; status: string };
        progress?: {
          verifiedWagonCount: number;
          submittedGrnCount: number;
          allReceived: boolean;
        };
      }>
    >(`/rail-branch-grns/${encodeURIComponent(id)}/submit`, {
      version,
      damagePhotoAttachmentIds,
    });
    return unwrapApiResponse(response);
  },

  remove: async (id: string) => {
    const response = await api.delete<
      ApiResponse<{ id: string; deleted: boolean }>
    >(`/rail-branch-grns/${encodeURIComponent(id)}`);
    return unwrapApiResponse(response);
  },
};
