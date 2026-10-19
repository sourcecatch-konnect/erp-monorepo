import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { myWorkApi } from "./my-work.service";
import { myWorkKeys } from "./my-work.keys";

/** The My Work page: refreshes every minute and when the tab regains focus. */
export function useMyWork() {
  return useQuery({
    queryKey: myWorkKeys.overview,
    queryFn: myWorkApi.overview,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}

/** Sidebar badge. Shares the page's cache entry, so it adds no extra request
 *  while the page is open; elsewhere it refreshes at most every two minutes. */
export function useMyWorkCount(): number {
  const query = useQuery({
    queryKey: myWorkKeys.overview,
    queryFn: myWorkApi.overview,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
  return query.data?.summary.needsYou ?? 0;
}
