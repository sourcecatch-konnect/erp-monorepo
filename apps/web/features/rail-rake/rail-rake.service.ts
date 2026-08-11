import type { ApiResponse } from "@skerp/types";

import { api } from "@/lib/api";
import { unwrapApiResponse } from "@/features/masters/_shared/master-api";

export type RailRakeStatus =
  | "CREATED"
  | "DISPATCHED"
  | "UNLOADING"
  | "RECEIVED";

type BranchRef = {
  id: string;
  name: string;
  branchCode: string;
};

type UserRef = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  userName?: string | null;
};

export type RailRakeDetail = {
  id: string;
  rakeNumber: string;
  railwayRakeNumber?: string | null;
  fyCode: string;
  status: RailRakeStatus;
  generatedAt: string;
  expectedArrivalAt?: string | null;
  dispatchedAt?: string | null;
  unloadingStartedAt?: string | null;
  receivedAt?: string | null;
  dispatchRemarks?: string | null;
  remarks?: string | null;
  version: number;
  fromBranch: BranchRef;
  toBranch: BranchRef;
  generatedBy: UserRef;
  dispatchedBy?: UserRef | null;
  vpSchedule: {
    id: string;
    scheduleNumber: string;
    scheduleName?: string | null;
    scheduleDate: string;
    status: string;
    sourceArea: { id: string; name: string };
    destinationArea: { id: string; name: string };
    mrRr?: {
      id: string;
      mrRrNumber?: string | null;
      status: string;
      rakeType?: string | null;
      rows: Array<{
        id: string;
        rowNumber: number;
        rowLabel: string;
        vpNo?: string | null;
        mrRrNo?: string | null;
        sealNo?: string | null;
        wagonTypeLabel: string;
        wagon: { id: string; name: string };
        vpWagonLoading?: {
          id: string;
          status: string;
          gateNo?: string | null;
          totalLoadedQty: number;
          totalLoadedCft?: string | number | null;
          totalLoadedWeightMt?: string | number | null;
          verifiedAt?: string | null;
          branchGrn?: {
            id: string;
            status: string;
            totalLoadedQty: number;
            totalReceivedQty: number;
            totalDamageQty: number;
            totalShortageQty: number;
            submittedAt?: string | null;
          } | null;
          _count: { allocations: number };
        } | null;
      }>;
    } | null;
  };
  branchGrns: Array<{
    id: string;
    vpWagonLoadingId: string;
    status: string;
    totalLoadedQty: number;
    totalReceivedQty: number;
    totalDamageQty: number;
    totalShortageQty: number;
    createdAt: string;
    submittedAt?: string | null;
  }>;
  summary: {
    totalWagons: number;
    verifiedWagons: number;
    branchGrnsStarted: number;
    branchGrnsSubmitted: number;
    totalLoadedQty: number;
  };
};

export type IncomingRailRake = {
  id: string;
  rakeNumber: string;
  railwayRakeNumber?: string | null;
  status: RailRakeStatus;
  dispatchedAt?: string | null;
  expectedArrivalAt?: string | null;
  fromBranch: BranchRef;
  toBranch: BranchRef;
  vpSchedule: {
    id: string;
    scheduleNumber: string;
    scheduleDate: string;
    scheduleName?: string | null;
  };
  _count: { branchGrns: number };
};

export type AvailableRailRakeVP = {
  value: string;
  vpWagonLoadingId: string;
  vpNo: string;
  status: "COMPLETED" | "VERIFIED";
  totalLoadedQty: number;
  allocationCount: number;
  row: {
    id: string;
    rowNumber: number;
    rowLabel: string;
    mrRrNo?: string | null;
    sealNo?: string | null;
    wagon: {
      id: string;
      name: string;
      totalCft?: number | null;
      capacityMt?: number | null;
    };
  };
};

const encodeIdentifier = (value: string) => encodeURIComponent(value);

export const railRakeApi = {
  detail: async (rakeId: string) => {
    const response = await api.get<ApiResponse<RailRakeDetail>>(
      `/rail-rakes/${encodeIdentifier(rakeId)}`,
    );
    return unwrapApiResponse(response);
  },

  incoming: async () => {
    const response = await api.get<ApiResponse<IncomingRailRake[]>>(
      "/rail-rakes/incoming",
    );
    return unwrapApiResponse(response);
  },

  availableVPs: async (rakeId: string) => {
    const response = await api.get<ApiResponse<AvailableRailRakeVP[]>>(
      `/rail-rakes/${encodeIdentifier(rakeId)}/available-vps`,
    );
    return unwrapApiResponse(response);
  },
};
