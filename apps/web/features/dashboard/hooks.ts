import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardPeriod } from "@skerp/types";
import { dashboardApi } from "./dashboard.service";
import { dashboardKeys } from "./dashboard.keys";

/**
 * The Dashboard: aggregates move slowly compared with My Work's worklist, so
 * this refreshes every five minutes rather than every minute. Previous data is
 * kept while a new period loads, so switching period doesn't blank the page.
 */
export function useDashboard(period: DashboardPeriod, branch: string | null) {
  return useQuery({
    queryKey: dashboardKeys.overview(period, branch),
    queryFn: () => dashboardApi.overview(period, branch),
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}
