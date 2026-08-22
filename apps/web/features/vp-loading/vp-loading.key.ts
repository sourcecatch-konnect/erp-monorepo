// apps/web/src/features/vp-loading/vp-loading.key.ts

export const vpLoadingKeys = {
  all: ["vp-loading"] as const,

  schedules: (scheduleDate?: string) =>
    ["vp-loading", "schedules", scheduleDate ?? "all"] as const,

  schedulePreview: (vpScheduleId: string) =>
    ["vp-loading", "schedule-preview", vpScheduleId] as const,

  finalReview: (vpScheduleId: string) =>
    ["vp-loading", "final-review", vpScheduleId] as const,

  trackerAssignment: (vpScheduleId: string) =>
    ["vp-loading", "tracker-assignment", vpScheduleId] as const,

  availableTrackers: (vpScheduleId: string) =>
    ["vp-loading", "available-trackers", vpScheduleId] as const,

  eligibleGrns: (vpScheduleId: string) =>
    ["vp-loading", "eligible-grns", vpScheduleId] as const,

  loadingPreview: (mrrrRowId: string, grnId: string) =>
    ["vp-loading", "loading-preview", mrrrRowId, grnId] as const,

  wagon: (vpWagonLoadingId: string) =>
    ["vp-loading", "wagon", vpWagonLoadingId] as const,

  wagonAllocations: (vpWagonLoadingId: string) =>
    ["vp-loading", "wagon", vpWagonLoadingId, "allocations"] as const,

  allocation: (allocationId: string) =>
    ["vp-loading", "allocation", allocationId] as const,
};

export const vpLoadingLookupKeys = {
  all: ["vp-loading-lookups"] as const,

  schedules: (scheduleDate?: string) =>
    ["vp-loading-lookups", "schedules", scheduleDate ?? "all"] as const,
};
