"use client";

import { useQuery } from "@tanstack/react-query";
import { PERMS } from "@skerp/types";
import { useCan } from "@/features/auth";
import { stockApi } from "../api/stock.service";

// Polling-adjacent, not real-time — a minute-old count is fine for a sidebar
// badge and keeps this from hammering the endpoint on every nav render.
export function useLowStockCount(): number {
  const canView = useCan(PERMS.WORKSHOP.INWARD_VIEW);
  const query = useQuery({
    queryKey: ["stock", "low-count"],
    queryFn: stockApi.lowCount,
    enabled: canView,
    staleTime: 60_000,
  });
  return canView ? (query.data ?? 0) : 0;
}
