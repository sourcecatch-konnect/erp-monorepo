import type { ListQuery } from "../masters/_shared/master-api";

export const mrrrKeys = {
  all: ["mrrr"] as const,

  list: (query: ListQuery) =>
    ["mrrr", "list", query] as const,

  detail: (id: string) =>
    ["mrrr", "detail", id] as const,
};

export const mrrrLookupKeys = {
  all: ["mrrr-lookups"] as const,

  vpSchedules: (query?: ListQuery) =>
    ["mrrr-lookups", "vp-schedules", query] as const,

  preview: (vpScheduleId: string) =>
    ["mrrr-lookups", "vp-schedule-preview", vpScheduleId] as const,
};