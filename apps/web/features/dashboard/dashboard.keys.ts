import type { DashboardPeriod } from "@skerp/types";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  /** null branch = every branch the viewer can see. */
  overview: (period: DashboardPeriod, branch: string | null) =>
    ["dashboard", "overview", period, branch ?? "all"] as const,
};
