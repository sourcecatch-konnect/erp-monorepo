import { useQuery } from "@tanstack/react-query";

import { railRakeApi } from "./rail-rake.service";
import { railRakeKeys } from "./rail-rake.key";

export const useRailRakeDetail = (rakeId?: string) =>
  useQuery({
    queryKey: railRakeKeys.detail(rakeId ?? ""),
    queryFn: () => railRakeApi.detail(rakeId as string),
    enabled: Boolean(rakeId),
  });

export const useIncomingRailRakes = () =>
  useQuery({
    queryKey: railRakeKeys.incoming,
    queryFn: () => railRakeApi.incoming(),
  });

export const useAvailableRailRakeVPs = (rakeId?: string) =>
  useQuery({
    queryKey: [...railRakeKeys.detail(rakeId ?? ""), "available-vps"],
    queryFn: () => railRakeApi.availableVPs(rakeId as string),
    enabled: Boolean(rakeId),
  });
