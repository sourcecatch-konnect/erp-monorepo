import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { myWorkApi } from "./my-work.service";
import { myWorkKeys } from "./my-work.keys";

/** The My Work page: refreshes every minute and when the tab regains focus. */
export function useMyWork(branch: string | null) {
  return useQuery({
    queryKey: myWorkKeys.overview(branch),
    queryFn: () => myWorkApi.overview(branch),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}

/** Sidebar badge, on every screen: its own one-count-per-queue endpoint,
 *  refreshed at most every two minutes. */
export function useMyWorkCount(): number {
  const query = useQuery({
    queryKey: myWorkKeys.count,
    queryFn: myWorkApi.count,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
  return query.data?.needsYou ?? 0;
}
