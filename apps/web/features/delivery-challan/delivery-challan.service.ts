import type {
  ApiResponse,
  CreateDeliveryChallanBody,
  DeliveryChallanDestinationOption,
  DeliveryChallanPreviewItem,
  DeliveryChallanRakeOption,
  DeliveryChallanVpOption,
  UpdateDeliveryChallanBody,
} from "@skerp/types";

import {
  type ListQuery,
  type ListResult,
  unwrapApiResponse,
  unwrapListResponse,
} from "@/features/masters/_shared/master-api";
import { api } from "@/lib/api";

export type DeliveryChallanStatus = "DRAFT" | "ISSUED" | "CANCELLED";
export type DeliveryVehicleMode = "OWN" | "MARKET";

export type DeliveryChallanPreview = {
  branchGrnId: string;
  rake: {
    id: string;
    rakeNumber: string;
    scheduleNumber: string;
    scheduleDate: string;
  };
  vp: { id: string; vpNo?: string | null; rowLabel: string };
  sourceBranch: { id: string; name: string; branchCode: string };
  destinationOptions: DeliveryChallanDestinationOption[];
  items: DeliveryChallanPreviewItem[];
};

export type DeliveryChallanItem = {
  id: string;
  branchGrnItemId: string;
  quantity: number;
  lrNumberSnapshot: string;
  consigneeNameSnapshot?: string | null;
  goodsNameSnapshot: string;
  unitSnapshot?: string | null;
  deliveryAddressSnapshot?: string | null;
};

export type DeliveryChallanDetail = {
  id: string;
  challanNumber: string;
  branchGrnId: string;
  sourceBranchId: string;
  destinationAreaId?: string | null;
  destinationLocationId?: string | null;
  deliveryAddressSnapshot?: string | null;
  vehicleMode: DeliveryVehicleMode;
  transportId?: string | null;
  vehicleId?: string | null;
  transporterNameSnapshot?: string | null;
  vehicleNumberSnapshot?: string | null;
  vehicleTypeSnapshot?: string | null;
  driverName?: string | null;
  driverMobile?: string | null;
  totalQuantity: number;
  totalWeight?: string | number | null;
  freightAmount?: string | number | null;
  advanceAmount?: string | number | null;
  paymentBy?: string | null;
  loadingAt: string;
  supervisorId?: string | null;
  status: DeliveryChallanStatus;
  remarks?: string | null;
  issuedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  balancePayable: string | number;
  version: number;
  createdAt: string;
  updatedAt: string;
  branchGrn: {
    railRake: {
      id: string;
      rakeNumber: string;
      fromBranch: { id: string; name: string; branchCode: string };
      toBranch: { id: string; name: string; branchCode: string };
      vpSchedule: {
        scheduleNumber: string;
        scheduleDate: string;
        sourceArea: { id: string; name: string };
        destinationArea: { id: string; name: string };
      };
    };
    vpWagonLoading: {
      id: string;
      mrRrRow: { vpNo?: string | null; rowLabel: string };
    };
  };
  sourceBranch: { id: string; name: string; branchCode: string };
  destinationArea?: { id: string; name: string } | null;
  destinationLocation?: {
    id: string;
    name: string;
    address?: string | null;
  } | null;
  transport?: { id: string; name: string; phoneNo?: string | null } | null;
  vehicle?: {
    id: string;
    vehicleNumber: string;
    vehicleTypeRef?: { id: string; name: string };
  } | null;
  supervisor?: {
    id: string;
    name: string;
    mobileNo?: string | null;
  } | null;
  items: DeliveryChallanItem[];
};

export type DeliveryChallanListItem = DeliveryChallanDetail;

export type DeliveryChallanSupervisorOption = {
  id: string;
  name: string;
  mobileNo?: string | null;
};

export type DeliveryChallanTransportOption = {
  id: string;
  name: string;
  phoneNo: string;
};

export type DeliveryChallanVehicleOption = {
  id: string;
  vehicleNumber: string;
  status: "AVAILABLE" | "ON_TRIP";
  capacityMT: number;
  vehicleTypeRef: { id: string; name: string; code: string };
};

const encode = encodeURIComponent;

export const deliveryChallanApi = {
  list: async (
    query: ListQuery,
  ): Promise<ListResult<DeliveryChallanListItem>> => {
    const params: Record<string, string | number> = {
      page: query.page ?? 0,
      size: query.size ?? 10,
    };
    if (query.search) params.search = query.search;
    if (query.sort) params.sort = query.sort;
    if (query.filter?.status) {
      params["filter[status]"] = String(query.filter.status);
    }
    const response = await api.get<ApiResponse<DeliveryChallanListItem[]>>(
      "/delivery-challans",
      { params },
    );
    return unwrapListResponse(response);
  },

  rakes: async (scheduleDate?: string) => {
    const response = await api.get<ApiResponse<DeliveryChallanRakeOption[]>>(
      "/delivery-challans/options/rakes",
      { params: scheduleDate ? { scheduleDate } : undefined },
    );
    return unwrapApiResponse(response);
  },

  vps: async (rakeId: string) => {
    const response = await api.get<ApiResponse<DeliveryChallanVpOption[]>>(
      "/delivery-challans/options/vps",
      { params: { rakeId } },
    );
    return unwrapApiResponse(response);
  },

  preview: async (branchGrnId: string) => {
    const response = await api.get<ApiResponse<DeliveryChallanPreview>>(
      `/delivery-challans/preview/${encode(branchGrnId)}`,
    );
    return unwrapApiResponse(response);
  },

  supervisors: async (branchGrnId: string) => {
    const response = await api.get<
      ApiResponse<DeliveryChallanSupervisorOption[]>
    >("/delivery-challans/options/supervisors", {
      params: { branchGrnId },
    });
    return unwrapApiResponse(response);
  },

  transports: async () => {
    const response = await api.get<
      ApiResponse<DeliveryChallanTransportOption[]>
    >("/delivery-challans/options/transports");
    return unwrapApiResponse(response);
  },

  vehicles: async (
    mode: DeliveryVehicleMode,
    transportId?: string,
  ) => {
    const response = await api.get<ApiResponse<DeliveryChallanVehicleOption[]>>(
      "/delivery-challans/options/vehicles",
      {
        params: { mode, ...(transportId ? { transportId } : {}) },
      },
    );
    return unwrapApiResponse(response);
  },

  detail: async (id: string) => {
    const response = await api.get<ApiResponse<DeliveryChallanDetail>>(
      `/delivery-challans/${encode(id)}`,
    );
    return unwrapApiResponse(response);
  },

  create: async (body: CreateDeliveryChallanBody) => {
    const response = await api.post<ApiResponse<DeliveryChallanDetail>>(
      "/delivery-challans",
      body,
    );
    return unwrapApiResponse(response);
  },

  update: async (id: string, body: UpdateDeliveryChallanBody) => {
    const response = await api.patch<ApiResponse<DeliveryChallanDetail>>(
      `/delivery-challans/${encode(id)}`,
      body,
    );
    return unwrapApiResponse(response);
  },

  issue: async (id: string, version: number) => {
    const response = await api.post<ApiResponse<DeliveryChallanDetail>>(
      `/delivery-challans/${encode(id)}/issue`,
      { version },
    );
    return unwrapApiResponse(response);
  },

  cancel: async (id: string, version: number, reason: string) => {
    const response = await api.post<ApiResponse<DeliveryChallanDetail>>(
      `/delivery-challans/${encode(id)}/cancel`,
      { version, reason },
    );
    return unwrapApiResponse(response);
  },

  remove: async (id: string) => {
    const response = await api.delete<
      ApiResponse<{ id: string; deleted: boolean }>
    >(`/delivery-challans/${encode(id)}`);
    return unwrapApiResponse(response);
  },
};
