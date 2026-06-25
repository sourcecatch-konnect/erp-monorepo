export const cashPlanningKeys = {
  all: ["cash-planning"] as const,
  day: (date: string) => [...cashPlanningKeys.all, "day", date] as const,
  days: () => [...cashPlanningKeys.all, "days"] as const,
  ledger: () => [...cashPlanningKeys.all, "ledger"] as const,
};
