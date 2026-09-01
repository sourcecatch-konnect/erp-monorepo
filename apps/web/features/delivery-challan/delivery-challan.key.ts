export const deliveryChallanKeys = {
  all: ["delivery-challans"] as const,
  lists: () => [...deliveryChallanKeys.all, "list"] as const,
  list: (query: object) => [...deliveryChallanKeys.lists(), query] as const,
  detail: (id: string) => [...deliveryChallanKeys.all, "detail", id] as const,
  rakes: (scheduleDate?: string) =>
    [
      ...deliveryChallanKeys.all,
      "options",
      "rakes",
      scheduleDate ?? "",
    ] as const,
  preview: (railRakeId?: string) =>
    [...deliveryChallanKeys.all, "preview", railRakeId ?? ""] as const,
  supervisors: (railRakeId?: string) =>
    [
      ...deliveryChallanKeys.all,
      "options",
      "supervisors",
      railRakeId ?? "",
    ] as const,
  transports: () =>
    [...deliveryChallanKeys.all, "options", "transports"] as const,
  vehicles: (mode?: string, transportId?: string) =>
    [
      ...deliveryChallanKeys.all,
      "options",
      "vehicles",
      mode ?? "",
      transportId ?? "",
    ] as const,
};
