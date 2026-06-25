import type { ListQuery } from "../masters/_shared/master-api";

export const vpScheduleKeys = {
  all: ["vp-schedules"] as const,

  list: (query: ListQuery) =>
    ["vp-schedules", "list", query] as const,

  statusCounts: ["vp-schedules", "status-counts"] as const,

  detail: (id: string) =>
    ["vp-schedules", "detail", id] as const,
};

export const vpScheduleLookupKeys = {
  branches: ["vp-schedule-lookups", "branches"] as const,
  areas: ["vp-schedule-lookups", "areas"] as const,
  wagons: ["vp-schedule-lookups", "wagons"] as const,
};