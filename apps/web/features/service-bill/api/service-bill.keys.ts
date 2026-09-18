export const serviceBillKeys = {
  all: ["service-bill"] as const,
  list: (params?: unknown) => [...serviceBillKeys.all, "list", params] as const,
  detail: (id: string) => [...serviceBillKeys.all, "detail", id] as const,
  payments: (id: string) => [...serviceBillKeys.all, "payments", id] as const,
  unbilledLines: (serviceProviderId: string, uptoDate?: string) =>
    [...serviceBillKeys.all, "unbilled", serviceProviderId, uptoDate] as const,
  branches: ["service-bill", "branches"] as const,
  serviceProviders: ["service-bill", "service-providers"] as const,
  cashAccounts: ["service-bill", "cash-accounts"] as const,
};
