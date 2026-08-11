// apps/web/src/features/vp-loading/hooks/use-vp-loading.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CancelVPLoadingBody,
  AssignOneLapTrackerBody,
  CompleteVPWagonLoadingBody,
  CreateVPLoadingAllocationBody,
  FinaliseVPScheduleLoadingBody,
  ReleaseOneLapTrackerBody,
  ReplaceOneLapTrackerBody,
  UpdateVPWagonLoadingLabourBody,
  UpdateVPLoadingAllocationBody,
} from "@skerp/types";

import { vpLoadingApi } from "../vp-loading.service";
import { vpLoadingKeys, vpLoadingLookupKeys } from "../vp-loading.key";
import { vpScheduleKeys } from "@/features/VP-Schedule/vp-schedule.key";

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

export const useVPLoadingSchedules = (scheduleDate?: string) => {
  return useQuery({
    queryKey: vpLoadingLookupKeys.schedules(scheduleDate),
    queryFn: () => vpLoadingApi.schedules(scheduleDate),
  });
};
export const useVPWagonLoadings = () => {
  return useQuery({
    queryKey: [...vpLoadingKeys.all, "wagons"],
    queryFn: () => vpLoadingApi.wagons(),
  });
};
export const useVPLoadingAllocations = () => {
  return useQuery({
    queryKey: [...vpLoadingKeys.all, "allocations"],
    queryFn: () => vpLoadingApi.allocations(),
  });
};

export const useVPLoadingSchedulePreview = (vpScheduleId?: string) => {
  return useQuery({
    queryKey: vpLoadingKeys.schedulePreview(vpScheduleId ?? ""),
    queryFn: () => vpLoadingApi.schedulePreview(vpScheduleId as string),
    enabled: Boolean(vpScheduleId),
  });
};

export const useVPLoadingFinalReview = (vpScheduleId?: string) => {
  return useQuery({
    queryKey: vpLoadingKeys.finalReview(vpScheduleId ?? ""),
    queryFn: () => vpLoadingApi.finalReview(vpScheduleId as string),
    enabled: Boolean(vpScheduleId),
  });
};

export const useVPLoadingTrackerAssignment = (vpScheduleId?: string) =>
  useQuery({
    queryKey: vpLoadingKeys.trackerAssignment(vpScheduleId ?? ""),
    queryFn: () => vpLoadingApi.trackerAssignment(vpScheduleId as string),
    enabled: Boolean(vpScheduleId),
  });

export const useAvailableOneLapTrackers = (
  vpScheduleId?: string,
  enabled = true,
) =>
  useQuery({
    queryKey: vpLoadingKeys.availableTrackers(vpScheduleId ?? ""),
    queryFn: () => vpLoadingApi.availableTrackers(vpScheduleId as string),
    enabled: Boolean(vpScheduleId) && enabled,
  });

const invalidateTrackerQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  scheduleId: string,
) => {
  queryClient.invalidateQueries({
    queryKey: vpLoadingKeys.trackerAssignment(scheduleId),
  });
  queryClient.invalidateQueries({
    queryKey: vpLoadingKeys.availableTrackers(scheduleId),
  });
  queryClient.invalidateQueries({
    queryKey: vpLoadingKeys.finalReview(scheduleId),
  });
  queryClient.invalidateQueries({
    queryKey: vpLoadingKeys.schedulePreview(scheduleId),
  });
  queryClient.invalidateQueries({ queryKey: ["one-lap-trackers"] });
  queryClient.invalidateQueries({ queryKey: ["tracking"] });
};

export const useAssignOneLapTracker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      body,
    }: {
      scheduleId: string;
      body: AssignOneLapTrackerBody;
    }) => vpLoadingApi.assignTracker(scheduleId, body),
    onSuccess: (_result, variables) =>
      invalidateTrackerQueries(queryClient, variables.scheduleId),
  });
};

export const useReplaceOneLapTracker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      body,
    }: {
      scheduleId: string;
      body: ReplaceOneLapTrackerBody;
    }) => vpLoadingApi.replaceTracker(scheduleId, body),
    onSuccess: (_result, variables) =>
      invalidateTrackerQueries(queryClient, variables.scheduleId),
  });
};

export const useReleaseOneLapTracker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      body,
    }: {
      scheduleId: string;
      body: ReleaseOneLapTrackerBody;
    }) => vpLoadingApi.releaseTracker(scheduleId, body),
    onSuccess: (_result, variables) =>
      invalidateTrackerQueries(queryClient, variables.scheduleId),
  });
};

export const useFinaliseVPScheduleLoading = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      body,
    }: {
      scheduleId: string;
      body: FinaliseVPScheduleLoadingBody;
    }) => vpLoadingApi.finaliseSchedule(scheduleId, body),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: vpLoadingKeys.finalReview(variables.scheduleId),
      });
      queryClient.invalidateQueries({
        queryKey: vpLoadingKeys.schedulePreview(variables.scheduleId),
      });
      queryClient.invalidateQueries({
        queryKey: vpLoadingKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: vpLoadingLookupKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: vpScheduleKeys.all,
      });
    },
  });
};

export const useVPLoadingGates = (mrrrRowId?: string) => {
  return useQuery({
    queryKey: vpLoadingLookupKeys.gates(mrrrRowId ?? ""),
    queryFn: () => vpLoadingApi.gates(mrrrRowId as string),
    enabled: Boolean(mrrrRowId),
  });
};

export const useEligibleVPLoadingGRNs = (
  mrrrRowId?: string,
  gateNo?: string,
) => {
  return useQuery({
    queryKey: vpLoadingLookupKeys.eligibleGRNs(mrrrRowId ?? "", gateNo ?? ""),
    queryFn: () =>
      vpLoadingApi.eligibleGRNs(mrrrRowId as string, gateNo as string),
    enabled: Boolean(mrrrRowId && gateNo),
  });
};

export const useVPLoadingPreview = (mrrrRowId?: string, grnId?: string) => {
  return useQuery({
    queryKey: vpLoadingKeys.loadingPreview(mrrrRowId ?? "", grnId ?? ""),
    queryFn: () =>
      vpLoadingApi.loadingPreview(mrrrRowId as string, grnId as string),
    enabled: Boolean(mrrrRowId && grnId),
  });
};

export const useVPWagonAllocations = (vpWagonLoadingId?: string) => {
  return useQuery({
    queryKey: vpLoadingKeys.wagonAllocations(vpWagonLoadingId ?? ""),
    queryFn: () => vpLoadingApi.wagonAllocations(vpWagonLoadingId as string),
    enabled: Boolean(vpWagonLoadingId),
  });
};

/* ------------------------------------------------------------------ */
/* Invalidation Helper                                                */
/* ------------------------------------------------------------------ */

type VPLoadingInvalidationValues = {
  scheduleId?: string;
  mrrrRowId?: string;
  gateNo?: string;
  grnId?: string;
  wagonId?: string;
  allocationId?: string;
};

const invalidateVPLoading = (
  queryClient: ReturnType<typeof useQueryClient>,
  values: VPLoadingInvalidationValues = {},
) => {
  queryClient.invalidateQueries({
    queryKey: vpLoadingKeys.all,
  });

  queryClient.invalidateQueries({
    queryKey: vpLoadingLookupKeys.all,
  });

  if (values.scheduleId) {
    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.schedulePreview(values.scheduleId),
    });
  }

  if (values.mrrrRowId) {
    queryClient.invalidateQueries({
      queryKey: vpLoadingLookupKeys.gates(values.mrrrRowId),
    });
  }

  if (values.mrrrRowId && values.gateNo) {
    queryClient.invalidateQueries({
      queryKey: vpLoadingLookupKeys.eligibleGRNs(
        values.mrrrRowId,
        values.gateNo,
      ),
    });
  }

  if (values.mrrrRowId && values.grnId) {
    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.loadingPreview(values.mrrrRowId, values.grnId),
    });
  }

  if (values.wagonId) {
    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.wagon(values.wagonId),
    });

    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.wagonAllocations(values.wagonId),
    });
  }

  if (values.allocationId) {
    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.allocation(values.allocationId),
    });
  }
};

/* ------------------------------------------------------------------ */
/* Allocation Mutations                                               */
/* ------------------------------------------------------------------ */

export const useCreateVPLoadingAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mrrrRowId,
      body,
    }: {
      mrrrRowId: string;
      gateNo: string;
      grnId: string;
      body: CreateVPLoadingAllocationBody;
    }) => vpLoadingApi.createAllocation(mrrrRowId, body),

    onSuccess: (result, variables) => {
      invalidateVPLoading(queryClient, {
        mrrrRowId: variables.mrrrRowId,
        gateNo: variables.gateNo,
        grnId: variables.grnId,
        wagonId: result.vpWagonLoadingId,
        allocationId: result.allocation.id,
      });
    },
  });
};

export const useUpdateVPLoadingAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      allocationId,
      body,
    }: {
      allocationId: string;
      vpWagonLoadingId: string;
      mrrrRowId: string;
      gateNo: string;
      grnId: string;
      body: UpdateVPLoadingAllocationBody;
    }) => vpLoadingApi.updateAllocation(allocationId, body),

    onSuccess: (_allocation, variables) => {
      invalidateVPLoading(queryClient, {
        allocationId: variables.allocationId,
        mrrrRowId: variables.mrrrRowId,
        gateNo: variables.gateNo,
        grnId: variables.grnId,
        wagonId: variables.vpWagonLoadingId,
      });
    },
  });
};

export const useCancelVPLoadingAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      allocationId,
      body,
    }: {
      allocationId: string;
      vpWagonLoadingId: string;
      mrrrRowId: string;
      gateNo: string;
      grnId: string;
      body: CancelVPLoadingBody;
    }) => vpLoadingApi.cancelAllocation(allocationId, body),

    onSuccess: (_allocation, variables) => {
      invalidateVPLoading(queryClient, {
        allocationId: variables.allocationId,
        mrrrRowId: variables.mrrrRowId,
        gateNo: variables.gateNo,
        grnId: variables.grnId,
        wagonId: variables.vpWagonLoadingId,
      });
    },
  });
};

/* ------------------------------------------------------------------ */
/* Wagon Mutations                                                    */
/* ------------------------------------------------------------------ */

export const useCompleteVPWagonLoading = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      vpWagonLoadingId,
      body,
    }: {
      vpWagonLoadingId: string;
      mrrrRowId: string;
      scheduleId: string;
      body: CompleteVPWagonLoadingBody;
    }) => vpLoadingApi.completeWagon(vpWagonLoadingId, body),

    onSuccess: (_wagon, variables) => {
      invalidateVPLoading(queryClient, {
        scheduleId: variables.scheduleId,
        mrrrRowId: variables.mrrrRowId,
        wagonId: variables.vpWagonLoadingId,
      });
    },
  });
};

export const useUpdateVPWagonLoadingLabour = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      vpWagonLoadingId,
      body,
    }: {
      vpWagonLoadingId: string;
      mrrrRowId: string;
      scheduleId: string;
      body: UpdateVPWagonLoadingLabourBody;
    }) => vpLoadingApi.updateWagonLabour(vpWagonLoadingId, body),

    onSuccess: (_wagon, variables) => {
      invalidateVPLoading(queryClient, {
        scheduleId: variables.scheduleId,
        mrrrRowId: variables.mrrrRowId,
        wagonId: variables.vpWagonLoadingId,
      });
    },
  });
};

export const useCancelVPWagonLoading = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      vpWagonLoadingId,
      body,
    }: {
      vpWagonLoadingId: string;
      mrrrRowId: string;
      scheduleId: string;
      body: CancelVPLoadingBody;
    }) => vpLoadingApi.cancelWagon(vpWagonLoadingId, body),

    onSuccess: (_wagon, variables) => {
      invalidateVPLoading(queryClient, {
        scheduleId: variables.scheduleId,
        mrrrRowId: variables.mrrrRowId,
        wagonId: variables.vpWagonLoadingId,
      });
    },
  });
};
