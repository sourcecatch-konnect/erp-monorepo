import type { ListQuery } from "../masters/_shared/master-api";

export const vpScheduleKeys = {
  all: ["vp-schedules"] as const,

  list: (query: ListQuery) =>
    ["vp-schedules", "list", query] as const,

  detail: (id: string) =>
    ["vp-schedules", "detail", id] as const,

  freightPreview: (
    sourceAreaId: string,
    destinationAreaId: string,
    wagons: string,
  ) =>
    [
      "vp-schedules",
      "freight-preview",
      sourceAreaId,
      destinationAreaId,
      wagons,
    ] as const,
};

export const vpScheduleLookupKeys = {
  branches: ["vp-schedule-lookups", "branches"] as const,
  areas: ["vp-schedule-lookups", "areas"] as const,
  wagons: ["vp-schedule-lookups", "wagons"] as const,
  availableWagons: (sourceAreaId: string, destinationAreaId: string) =>
    [
      "vp-schedule-lookups",
      "available-wagons",
      sourceAreaId,
      destinationAreaId,
    ] as const,
};
