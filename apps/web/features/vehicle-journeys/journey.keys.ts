import type { ListQuery } from "../masters/_shared/master-api";

export const journeyKeys = {
  all: ["vehicle-journeys"] as const,
  list: (query: ListQuery) => ["vehicle-journeys", "list", query] as const,
  statusCounts: ["vehicle-journeys", "status-counts"] as const,
  detail: (id: string) => ["vehicle-journeys", "detail", id] as const,
  logSlipPreview: (journeyId: string) =>
    ["vehicle-journeys", "log-slip-preview", journeyId] as const,
  logSlip: (id: string) => ["log-slips", "detail", id] as const,
};

export const journeyLookupKeys = {
  ownVehicles: ["lookup", "own-vehicles"] as const,
  routes: ["lookup", "journey-routes"] as const,
  customers: ["lookup", "customers"] as const,
  cities: ["lookup", "cities"] as const,
  branches: ["lookup", "branches"] as const,
  pumps: ["lookup", "pumps"] as const,
  cashAccounts: ["lookup", "cash-accounts"] as const,
  expenseTypes: ["lookup", "trip-expense-types"] as const,
};
