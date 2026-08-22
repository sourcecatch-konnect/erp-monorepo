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

// Eligibility depends only on the schedule's route, so this fetches once per
// schedule — every wagon (VP row) reuses the same cached list. The caller
// derives gate groupings and gate-locked filtering from this in memory
// (see vp-loadingForm.tsx) instead of issuing per-row/per-gate requests.
export const useVPScheduleEligibleGrns = (vpScheduleId?: string) => {
  return useQuery({
    queryKey: vpLoadingKeys.eligibleGrns(vpScheduleId ?? ""),
    queryFn: () => vpLoadingApi.eligibleGrns(vpScheduleId as string),
    enabled: Boolean(vpScheduleId),
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



/* ------------------------------------------------------------------ */
/* Invalidation Helper — FIXED                                        */
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
  // REMOVED: the two blanket calls that used to run here —
  //   queryClient.invalidateQueries({ queryKey: vpLoadingKeys.all })
  //   queryClient.invalidateQueries({ queryKey: vpLoadingLookupKeys.all })
  // invalidateQueries does a PREFIX match on the key array, so invalidating
  // the top-level "vp-loading" key also matched (and refetched) every other
  // query that happens to start with that same string — labours,
  // supervisors, tracker-assignment, available-trackers — none of which
  // have anything to do with, say, one wagon being marked loaded. That's
  // why toggling one switch fired ~10 network requests instead of the 2-3
  // that actually changed. Below, only what this specific mutation could
  // have actually affected gets invalidated.

  if (values.scheduleId) {
    // schedulePreview and finalReview are the two schedule-level views that
    // show the list/status of every wagon under a schedule — there is no
    // separate top-level "all wagons" key in vpLoadingKeys, so these two are
    // what actually need refreshing when one wagon's state changes.
    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.schedulePreview(values.scheduleId),
    });
    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.finalReview(values.scheduleId),
    });
  }

  if (values.mrrrRowId && values.grnId) {
    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.loadingPreview(values.mrrrRowId, values.grnId),
    });
  }

  if (values.wagonId) {
    // vpLoadingKeys.wagon(id) is ["vp-loading","wagon",id] and
    // vpLoadingKeys.wagonAllocations(id) is
    // ["vp-loading","wagon",id,"allocations"] — the wagon key is a literal
    // PREFIX of the wagonAllocations key. Without `exact: true`, invalidating
    // wagon(id) below ALSO matches and refetches wagonAllocations(id) as a
    // side effect (the same prefix-matching behavior that caused the
    // original bug, just one level deeper) — and then the very next line
    // invalidates wagonAllocations again on purpose. That double invalidation
    // on the same active query is exactly why the allocations request was
    // firing twice (once with real data, once as a wasted 304). `exact: true`
    // makes this line match only the wagon detail query, nothing else.
    queryClient.invalidateQueries({
      queryKey: vpLoadingKeys.wagon(values.wagonId),
      exact: true,
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
