// apps/web/src/features/vp-loading/vp-loading.service.ts

import { api } from "@/lib/api";

import type {
  ApiResponse,
  AssignOneLapTrackerBody,
  AvailableOneLapTracker,
  CancelVPLoadingBody,
  CompleteVPWagonLoadingBody,
  CreateVPLoadingAllocationBody,
  FinaliseVPScheduleLoadingBody,
  OneLapTrackerAssignmentDetail,
  ReleaseOneLapTrackerBody,
  ReplaceOneLapTrackerBody,
  UpdateVPWagonLoadingLabourBody,
  UpdateVPLoadingAllocationBody,
} from "@skerp/types";

import { unwrapApiResponse } from "../masters/_shared/master-api";

/* ------------------------------------------------------------------ */
/* Response Status Types                                              */
/* ------------------------------------------------------------------ */

export type VPScheduleLoadingStatus =
  | "DRAFT"
  | "PLANNED"
  | "MRRR_CREATED"
  | "LOADING"
  | "LOADED"
  | "VERIFIED"
  | "FINALISED"
  | "CANCELLED";

export type VPWagonLoadingStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "VERIFIED"
  | "CANCELLED";

export type VPLoadingStatus = "DRAFT" | "LOADED" | "CANCELLED";

/* ------------------------------------------------------------------ */
/* Shared Response Types                                              */
/* ------------------------------------------------------------------ */

export type BranchOption = {
  id: string;
  name: string;
  branchCode?: string;
};

export type AreaOption = {
  id: string;
  name: string;
  city?: {
    id: string;
    name: string;
  } | null;
};

export type CustomerOption = {
  id: string;
  name: string;
};

export type UserOption = {
  id: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
};

export type LabourOption = {
  id: string;
  name: string;
  mobileNo?: string | null;
  type?: string;
};

export type UnitOption = {
  id: string;
  code?: string;
  name?: string;
  symbol?: string | null;
};

/* ------------------------------------------------------------------ */
/* Schedule Responses                                                 */
/* ------------------------------------------------------------------ */

export type VPLoadingSchedule = {
  id: string;
  scheduleNumber: string;
  scheduleDate: string;
  scheduleName: string;
  status: VPScheduleLoadingStatus;

  fromBranchId: string;
  toBranchId: string;
  sourceAreaId: string;
  destinationAreaId: string;

  fromBranch: BranchOption;
  toBranch: BranchOption;
  sourceArea: AreaOption;
  destinationArea: AreaOption;

  mrRrSummary?: {
    id: string;
    mrRrNumber?: string | null;
    status: string;
  } | null;

  totalVpRows: number;
  loadingRows: Array<{
    id: string;
    rowNumber: number;
    rowLabel?: string | null;
    vpNo?: string | null;
    mrRrNo?: string | null;
    eligibleGrnCount: number;
    wagon?: {
      id: string;
      name: string;
      totalCft?: number | null;
      capacityMt?: number | null;
    } | null;
    vpWagonLoading?: VPWagonLoadingSummary | null;
  }>;
  loadingWagonCount: number;
  completedWagonCount: number;
  verifiedWagonCount: number;
};

export type VPWagonLoadingSummary = {
  id: string;
  status: VPWagonLoadingStatus;
  gateNo?: string | null;
  totalLoadedQty: number;
  activeLrCount: number;
  totalLoadedCft?: number | null;
  totalLoadedWeightMt?: number | null;
  capacityCheckStatus?: string | null;
  labourId?: string | null;
  labour?: LabourOption | null;
  labourCharge?: number | string | null;
  loadingSupervisorId?: string | null;
  loadingSupervisor?: LabourOption | null;
  loadingStartedAt?: string | null;
  loadingCompletedAt?: string | null;
  verifiedAt?: string | null;
  cancelledAt?: string | null;
  remarks?: string | null;
  cancelReason?: string | null;
  version: number;
};

export type MRRRRowPreview = {
  id: string;
  rowNumber: number;
  rowLabel: string;

  sequenceNo?: string | null;
  vpNo?: string | null;
  mrRrNo?: string | null;
  sealNo?: string | null;
  eligibleGrnCount?: number;

  wagonId: string;
  wagonTypeLabel: string;

  wagon: {
    id: string;
    name: string;
    totalCft?: number | null;
    capacityMt?: number | null;
    height?: number;
    width?: number;
    weight?: number;
  };

  vpWagonLoading?: VPWagonLoadingSummary | null;
};

export type VPLoadingSchedulePreview = {
  id: string;
  scheduleNumber: string;
  scheduleDate: string;
  scheduleName: string;
  status: VPScheduleLoadingStatus;

  fromBranchId: string;
  toBranchId: string;
  sourceAreaId: string;
  destinationAreaId: string;

  fromBranch: BranchOption;
  toBranch: BranchOption;
  sourceArea: AreaOption;
  destinationArea: AreaOption;
  railRake: {
    id: string;
    rakeNumber: string;
    status: string;
    generatedAt: string;
  } | null;
  mrRr: {
    id: string;
    mrRrNumber?: string | null;
    status: string;
    rakeType?: string | null;
    remarks?: string | null;
    rows: MRRRRowPreview[];
  };
};

export type VPLoadingFinalReviewIssue = {
  code: string;
  message: string;
  mrrrRowId?: string;
  vpNo?: string | null;
};

export type VPLoadingFinalReview = {
  schedule: {
    id: string;
    scheduleNumber: string;
    scheduleDate: string;
    scheduleName: string;
    status: VPScheduleLoadingStatus;
    remarks?: string | null;
    version: number;
    finalisedAt?: string | null;
    finalisedById?: string | null;
    finalisedBy?: UserOption | null;
    fromBranch: BranchOption;
    toBranch: BranchOption;
    sourceArea: AreaOption;
    destinationArea: AreaOption;
    railRake?: {
      id: string;
      rakeNumber: string;
      status: string;
      generatedAt: string;
    } | null;
    mrRr?: {
      id: string;
      mrRrNumber?: string | null;
      status: string;
      rakeType?: string | null;
      remarks?: string | null;
      version: number;
      rows: Array<{
        id: string;
        rowNumber: number;
        rowLabel: string;
        wagonTypeLabel: string;
        sequenceNo?: string | null;
        vpNo?: string | null;
        mrRrNo?: string | null;
        sealNo?: string | null;
        wagon: {
          id: string;
          name: string;
          capacityMt?: number | null;
          totalCft?: number | null;
        };
        vpWagonLoading?: {
          id: string;
          status: VPWagonLoadingStatus;
          gateNo?: string | null;
          totalLoadedQty: number;
          totalLoadedCft?: number | string | null;
          totalLoadedWeightMt?: number | string | null;
          capacityCheckStatus: string;
          labourCharge?: number | string | null;
          labour?: LabourOption | null;
          loadingSupervisor?: LabourOption | null;
          loadingStartedAt?: string | null;
          loadingCompletedAt?: string | null;
          verifiedAt?: string | null;
          verifiedBy?: UserOption | null;
          remarks?: string | null;
          version: number;
          allocations: Array<{
            id: string;
            loadingNumber: string;
            status: "LOADED";
            loadedQty: number;
            loadedCft?: number | string | null;
            loadedWeightMt?: number | string | null;
            remarks?: string | null;
            grn: {
              id: string;
              grnNumber: string;
              gateNo?: string | null;
              lorryReceipt: {
                id: string;
                lrNumber: string;
                group: {
                  id: string;
                  groupNumber: string;
                  consignor: CustomerOption;
                  consignee: CustomerOption;
                  originBranch: BranchOption;
                  destinationBranch: BranchOption;
                };
              };
            };
            goods: Array<{
              id: string;
              grnGoodsId: string;
              loadedQty: number;
              loadingDamageQty: number;
              loadedWeightMt?: number | string | null;
              loadedCft?: number | string | null;
              measurementSource: string;
              remarks?: string | null;
              grnGoods: {
                id: string;
                goodsName: string;
                description?: string | null;
                unit?: string | null;
                quantityUnit?: UnitOption | null;
                weightUnit?: UnitOption | null;
              };
            }>;
          }>;
        } | null;
      }>;
    } | null;
  };
  summary: {
    totalWagonRows: number;
    wagonLoadingsCreated: number;
    verifiedWagonCount: number;
    activeAllocationCount: number;
    sourceGoodsLineCount: number;
    totalLoadedQty: number;
    totalLoadingDamageQty: number;
  };
  canFinalise: boolean;
  validationIssues: VPLoadingFinalReviewIssue[];
};

export type FinaliseVPScheduleLoadingResult = {
  railRake: {
    id: string;
    rakeNumber: string;
    railwayRakeNumber?: string | null;
    fyCode: string;
    status: "CREATED" | "DISPATCHED" | "UNLOADING" | "RECEIVED";
    generatedAt: string;
    version: number;
    fromBranch: BranchOption;
    toBranch: BranchOption;
  };
  schedule: {
    id: string;
    scheduleNumber: string;
    status: "FINALISED";
    version: number;
  };
  alreadyFinalised: boolean;
};

/* ------------------------------------------------------------------ */
/* Gate and Eligible GRN Responses                                    */
/* ------------------------------------------------------------------ */

export type VPLoadingGate = {
  gateNo: string;
  eligibleGrnCount: number;
  eligibleLrCount: number;
  totalAvailableQty: number;
};

export type EligibleVPLoadingGRN = {
  grnId: string;
  grnNumber: string;
  gateNo?: string | null;

  lrId: string;
  lrNumber: string;

  consignor: CustomerOption;
  consignee: CustomerOption;

  totalReceivedQty: number;
  allocatedQty: number;
  availableQty: number;
  fullyLoaded: boolean;
  goodsItemCount: number;
};

/* ------------------------------------------------------------------ */
/* Loading Preview Responses                                          */
/* ------------------------------------------------------------------ */

export type VPLoadingPreviewGoods = {
  grnGoodsId: string;
  goodsName: string;

  totalQty: number;
  receivedQty: number;
  alreadyAllocatedQty: number;
  availableQty: number;
  suggestedLoadQty: number;

  quantityUnit?: UnitOption | null;

  // Paperwork information only
  weightUnit?: UnitOption | null;
  weight?: number | string | null;
};
export type LoadingTotals = {
  loadedQty: number;
};

export type VPLoadingPreview = {
  schedule: {
    id: string;
    scheduleNumber: string;
    scheduleDate: string;
    scheduleName: string;
    status: VPScheduleLoadingStatus;

    fromBranch: BranchOption;
    toBranch: BranchOption;
    sourceArea: AreaOption;
    destinationArea: AreaOption;
  };
  railRake: {
    id: string;
    rakeNumber: string;
    status: string;
    generatedAt: string;
  } | null;
  mrRrRow: MRRRRowPreview & {
    mrRr?: unknown;
    vpWagonLoading?: VPWagonLoadingDetail | null;
  };

  vpWagonLoading?: VPWagonLoadingDetail | null;

  currentTotals: {
    loadedQty: number;
  };

  grn: {
    id: string;
    grnNumber: string;
    gateNo?: string | null;

    totalReceivedQty: number;
    allocatedQty: number;
    availableQty: number;
    fullyLoaded: boolean;

    lorryReceipt: {
      id: string;
      lrNumber: string;
      status: string;
      group?: {
        id?: string;
        groupNumber?: string;
        transportType?: string;
        consignor?: CustomerOption;
        consignee?: CustomerOption;
        originBranch?: BranchOption;
        destinationBranch?: BranchOption;
      } | null;
    };
  };

  goods: VPLoadingPreviewGoods[];

  selectedGrnProjection: {
    loadedQty: number;
  };
};

/* ------------------------------------------------------------------ */
/* Allocation Responses                                               */
/* ------------------------------------------------------------------ */
export type VPLoadingGoods = {
  id: string;
  vpLoadingId: string;
  grnGoodsId: string;

  loadedQty: number;
  loadingDamageQty: number;
  loadedWeightMt?: number | string | null;

  remarks?: string | null;

  grnGoods?: {
    id: string;
    goodsName: string;
    totalQty: number;
    receivedQty: number;
    quantityUnit?: UnitOption | null;
    weightUnit?: UnitOption | null;
  };
};
export type VPLoadingQuantitySummary = {
  totalReceivedQty: number;
  loadedInCurrentWagon: number;
  loadedInOtherWagons: number;
  totalLoadedQty: number;
  availableQty: number;
};

export type VPLoadingOtherWagon = {
  allocationId: string;

  vpWagonLoadingId: string;

  scheduleId: string;
  scheduleNumber: string;

  mrrrRowId: string;

  vpNo?: string | null;

  wagonId?: string | null;
  wagonName?: string | null;

  gateNo?: string | null;

  loadedQty: number;
  status: VPWagonLoadingStatus;
};
export type VPLoadingAllocation = {
  id: string;
  loadingNumber: string;

  vpWagonLoadingId: string;
  grnId: string;

  status: VPLoadingStatus;
  loadedQty: number;

  remarks?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;

  version: number;
  createdAt: string;
  updatedAt: string;
  quantitySummary?: VPLoadingQuantitySummary;
  otherWagons?: VPLoadingOtherWagon[];
  grn: {
    id: string;
    grnNumber: string;
    gateNo?: string | null;
    totalWeightMt?: number | string | null;

    lorryReceipt: {
      id: string;
      lrNumber: string;
      status: string;
      createdAt: string;
      invoiceNumber?: string | null;
      invoiceAmount?: number | string | null;
      totalWeight?: number | string | null;
      unit?: string | null;
      weightUnit?: UnitOption | null;
      unloadingLocation?: {
        id: string;
        name: string;
        address?: string | null;
        city?: { id: string; name: string } | null;
      } | null;

      group?: {
        id: string;
        groupNumber: string;
        consignor?: CustomerOption;
        consignee?: CustomerOption;
        originBranch?: BranchOption;
        destinationBranch?: BranchOption;
      };
    };
  };

  goods: VPLoadingGoods[];

  createdBy?: UserOption;
  updatedBy?: UserOption | null;
  cancelledBy?: UserOption | null;

  vpWagonLoading?: VPWagonLoadingDetail;
};
export type VPWagonLoadingDetail = {
  id: string;
  mrRrRowId: string;

  status: VPWagonLoadingStatus;
  gateNo?: string | null;

  labourId?: string | null;
  labour?: LabourOption | null;
  labourCharge?: number | string | null;

  loadingSupervisorId?: string | null;
  loadingSupervisor?: LabourOption | null;

  totalLoadedQty: number;

  loadingStartedAt?: string | null;
  loadingCompletedAt?: string | null;
  verifiedAt?: string | null;
  cancelledAt?: string | null;

  remarks?: string | null;
  cancelReason?: string | null;

  version: number;

  allocations?: VPLoadingAllocation[];
};
export type CreateVPLoadingAllocationResult = {
  allocation: VPLoadingAllocation;
  vpWagonLoadingId: string;
  wagonVersion: number;
};
export type CancelVPLoadingAllocationResult = {
  allocation: VPLoadingAllocation;
  vpWagonLoadingId: string;
  gateReleased: boolean;
};
export type VPWagonLoadingListRow = {
  id: string;

  status: VPWagonLoadingStatus;

  totalLoadedQty: number;
  allocationCount: number;

  loadingStartedAt?: string | null;
  loadingCompletedAt?: string | null;
  verifiedAt?: string | null;
  cancelledAt?: string | null;

  remarks?: string | null;
  cancelReason?: string | null;

  version: number;
  createdAt: string;
  updatedAt: string;

  schedule: {
    id: string;
    scheduleNumber: string;
    scheduleDate: string;
    scheduleName?: string | null;
    status: VPScheduleLoadingStatus;

    fromBranch: BranchOption;
    toBranch: BranchOption;
    sourceArea: AreaOption;
    destinationArea: AreaOption;
  };

  mrRrRow: {
    id: string;
    rowNumber: number;
    rowLabel?: string | null;
    vpNo?: string | null;

    wagon?: {
      id: string;
      name: string;
      totalCft?: number | null;
      capacityMt?: number | null;
    } | null;
  };
};
export type VPLoadingListRow = {
  id: string;
  loadingNumber: string;
  status: VPLoadingStatus;
  loadedQty: number;
  remarks?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  grn: VPLoadingAllocation["grn"];
  schedule: {
    id: string;
    scheduleNumber: string;
    scheduleDate: string;
    scheduleName?: string | null;
    status: VPScheduleLoadingStatus;
    fromBranch: BranchOption;
    toBranch: BranchOption;
    sourceArea: AreaOption;
    destinationArea: AreaOption;
  };
  mrRr: {
    id: string;
    mrRrNumber?: string | null;
    status: string;
  };
  mrRrRow: {
    id: string;
    rowNumber: number;
    rowLabel?: string | null;
    vpNo?: string | null;
    mrRrNo?: string | null;
    wagon?: {
      id: string;
      name: string;
      totalCft?: number | null;
      capacityMt?: number | null;
    } | null;
  };
  vpWagonLoading: VPWagonLoadingSummary;
};
/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const encodeIdentifier = (value: string) => encodeURIComponent(value);

/* ------------------------------------------------------------------ */
/* API                                                                */
/* ------------------------------------------------------------------ */
export const vpLoadingApi = {
  allocations: async (): Promise<VPLoadingListRow[]> => {
    const response = await api.get<ApiResponse<VPLoadingListRow[]>>(
      "/vp-loading/allocations",
    );

    return unwrapApiResponse(response);
  },
  wagons: async (): Promise<VPWagonLoadingListRow[]> => {
    const response =
      await api.get<ApiResponse<VPWagonLoadingListRow[]>>("/vp-loading/wagons");

    return unwrapApiResponse(response);
  },
  schedules: async (scheduleDate?: string): Promise<VPLoadingSchedule[]> => {
    const params: Record<string, string> = {};

    if (scheduleDate) {
      params.scheduleDate = scheduleDate;
    }

    const response = await api.get<ApiResponse<VPLoadingSchedule[]>>(
      "/vp-loading/schedules",
      {
        params,
      },
    );

    return unwrapApiResponse(response);
  },

  schedulePreview: async (
    vpScheduleId: string,
  ): Promise<VPLoadingSchedulePreview> => {
    const response = await api.get<ApiResponse<VPLoadingSchedulePreview>>(
      `/vp-loading/schedules/${encodeIdentifier(vpScheduleId)}/preview`,
    );

    return unwrapApiResponse(response);
  },

  finalReview: async (vpScheduleId: string): Promise<VPLoadingFinalReview> => {
    const response = await api.get<ApiResponse<VPLoadingFinalReview>>(
      `/vp-loading/schedules/${encodeIdentifier(vpScheduleId)}/final-review`,
    );

    return unwrapApiResponse(response);
  },

  finaliseSchedule: async (
    vpScheduleId: string,
    body: FinaliseVPScheduleLoadingBody,
  ): Promise<FinaliseVPScheduleLoadingResult> => {
    const response = await api.post<
      ApiResponse<FinaliseVPScheduleLoadingResult>
    >(`/vp-loading/schedules/${encodeIdentifier(vpScheduleId)}/finalise`, body);

    return unwrapApiResponse(response);
  },

  trackerAssignment: async (
    vpScheduleId: string,
  ): Promise<OneLapTrackerAssignmentDetail | null> => {
    const response = await api.get<
      ApiResponse<OneLapTrackerAssignmentDetail | null>
    >(
      `/vp-loading/schedules/${encodeIdentifier(
        vpScheduleId,
      )}/tracker-assignment`,
    );
    return unwrapApiResponse(response);
  },

  availableTrackers: async (
    vpScheduleId: string,
  ): Promise<AvailableOneLapTracker[]> => {
    const response = await api.get<ApiResponse<AvailableOneLapTracker[]>>(
      `/vp-loading/schedules/${encodeIdentifier(
        vpScheduleId,
      )}/available-trackers`,
    );
    return unwrapApiResponse(response);
  },

  assignTracker: async (
    vpScheduleId: string,
    body: AssignOneLapTrackerBody,
  ): Promise<OneLapTrackerAssignmentDetail> => {
    const response = await api.post<ApiResponse<OneLapTrackerAssignmentDetail>>(
      `/vp-loading/schedules/${encodeIdentifier(
        vpScheduleId,
      )}/tracker-assignment`,
      body,
    );
    return unwrapApiResponse(response);
  },

  replaceTracker: async (
    vpScheduleId: string,
    body: ReplaceOneLapTrackerBody,
  ): Promise<OneLapTrackerAssignmentDetail> => {
    const response = await api.post<ApiResponse<OneLapTrackerAssignmentDetail>>(
      `/vp-loading/schedules/${encodeIdentifier(
        vpScheduleId,
      )}/tracker-assignment/replace`,
      body,
    );
    return unwrapApiResponse(response);
  },

  releaseTracker: async (
    vpScheduleId: string,
    body: ReleaseOneLapTrackerBody,
  ): Promise<OneLapTrackerAssignmentDetail> => {
    const response = await api.post<ApiResponse<OneLapTrackerAssignmentDetail>>(
      `/vp-loading/schedules/${encodeIdentifier(
        vpScheduleId,
      )}/tracker-assignment/release`,
      body,
    );
    return unwrapApiResponse(response);
  },

  // Eligibility depends only on the schedule's route, not the wagon/VP row —
  // one call covers every wagon in the schedule. Gate grouping and the
  // gate-locked-row filter happen client-side over this single list (see
  // vp-loadingForm.tsx) instead of two more round trips.
  eligibleGrns: async (
    vpScheduleId: string,
  ): Promise<EligibleVPLoadingGRN[]> => {
    const response = await api.get<ApiResponse<EligibleVPLoadingGRN[]>>(
      `/vp-loading/schedules/${encodeIdentifier(vpScheduleId)}/eligible-grns`,
    );

    return unwrapApiResponse(response);
  },

  loadingPreview: async (
    mrrrRowId: string,
    grnId: string,
  ): Promise<VPLoadingPreview> => {
    const response = await api.get<ApiResponse<VPLoadingPreview>>(
      `/vp-loading/rows/${encodeIdentifier(
        mrrrRowId,
      )}/grns/${encodeIdentifier(grnId)}/preview`,
    );

    return unwrapApiResponse(response);
  },

  /*
   * Wagon loading is created automatically when the
   * first GRN allocation is added.
   */
  createAllocation: async (
    mrrrRowId: string,
    body: CreateVPLoadingAllocationBody,
  ): Promise<CreateVPLoadingAllocationResult> => {
    const response = await api.post<
      ApiResponse<CreateVPLoadingAllocationResult>
    >(`/vp-loading/rows/${encodeIdentifier(mrrrRowId)}/allocations`, body);

    return unwrapApiResponse(response);
  },

  updateAllocation: async (
    allocationId: string,
    body: UpdateVPLoadingAllocationBody,
  ): Promise<VPLoadingAllocation> => {
    const response = await api.patch<ApiResponse<VPLoadingAllocation>>(
      `/vp-loading/allocations/${encodeIdentifier(allocationId)}`,
      body,
    );

    return unwrapApiResponse(response);
  },

  cancelAllocation: async (
    allocationId: string,
    body: CancelVPLoadingBody,
  ): Promise<CancelVPLoadingAllocationResult> => {
    const response = await api.post<
      ApiResponse<CancelVPLoadingAllocationResult>
    >(`/vp-loading/allocations/${encodeIdentifier(allocationId)}/cancel`, body);

    return unwrapApiResponse(response);
  },

  wagonAllocations: async (
    vpWagonLoadingId: string,
  ): Promise<VPLoadingAllocation[]> => {
    const response = await api.get<ApiResponse<VPLoadingAllocation[]>>(
      `/vp-loading/wagons/${encodeIdentifier(vpWagonLoadingId)}/allocations`,
    );

    return unwrapApiResponse(response);
  },

  completeWagon: async (
    vpWagonLoadingId: string,
    body: CompleteVPWagonLoadingBody,
  ): Promise<VPWagonLoadingDetail> => {
    const response = await api.post<ApiResponse<VPWagonLoadingDetail>>(
      `/vp-loading/wagons/${encodeIdentifier(vpWagonLoadingId)}/complete`,
      body,
    );

    return unwrapApiResponse(response);
  },

  updateWagonLabour: async (
    vpWagonLoadingId: string,
    body: UpdateVPWagonLoadingLabourBody,
  ): Promise<VPWagonLoadingDetail> => {
    const response = await api.patch<ApiResponse<VPWagonLoadingDetail>>(
      `/vp-loading/wagons/${encodeIdentifier(vpWagonLoadingId)}/labour`,
      body,
    );

    return unwrapApiResponse(response);
  },

  cancelWagon: async (
    vpWagonLoadingId: string,
    body: CancelVPLoadingBody,
  ): Promise<VPWagonLoadingDetail> => {
    const response = await api.post<ApiResponse<VPWagonLoadingDetail>>(
      `/vp-loading/wagons/${encodeIdentifier(vpWagonLoadingId)}/cancel`,
      body,
    );

    return unwrapApiResponse(response);
  },
};
