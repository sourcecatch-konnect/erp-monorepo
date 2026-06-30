// vp-schedule.lookups.ts
import { branchApi } from "../masters/branch/branch.service";
import { areaApi } from "../masters/area/area.service";
import { wagonApi } from "../masters/wagon/wagon.service";
import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import { unwrapApiResponse } from "../masters/_shared/master-api";

export type VPScheduleOption = {
  value: string;
  label: string;
  cityId?: string | null;
};

export type VPScheduleWagonOption = VPScheduleOption & {
  totalCft?: number | null;
  capacityMt?: number | null;
};

const LOOKUP_QUERY = { size: 1000, sort: "name:asc" } as const;

export const vpScheduleLookups = {
  branches: async (): Promise<VPScheduleOption[]> => {
    const result = await branchApi.list(LOOKUP_QUERY);

    return result.data.map((branch) => ({
      value: branch.id,
      label: branch.name,
      cityId: branch.cityId,
    }));
  },

  areas: async (): Promise<VPScheduleOption[]> => {
    const result = await areaApi.list(LOOKUP_QUERY);

    return result.data.map((area) => ({
      value: area.id,
      label: area.city?.name
        ? `${area.name} - ${area.city.name}`
        : area.name,
      cityId: area.cityId,
    }));
  },

  wagons: async (): Promise<VPScheduleWagonOption[]> => {
    const result = await wagonApi.list(LOOKUP_QUERY);

    return result.data.map((wagon) => ({
      value: wagon.id,
      label: wagon.name,
      totalCft: wagon.totalCft,
      capacityMt: wagon.capacityMt,
    }));
  },

  availableWagons: async (
    sourceAreaId: string,
    destinationAreaId: string,
  ): Promise<VPScheduleWagonOption[]> => {
    const res = await api.get<
      ApiResponse<
        Array<{
          id: string;
          name: string;
          totalCft?: number | null;
          capacityMt?: number | null;
          isActive?: boolean | null;
        }>
      >
    >("/railway-freight/available-wagons", {
      params: { sourceAreaId, destinationAreaId },
    });

    return unwrapApiResponse(res).map((wagon) => ({
      value: wagon.id,
      label: wagon.name,
      totalCft: wagon.totalCft,
      capacityMt: wagon.capacityMt,
    }));
  },
};
