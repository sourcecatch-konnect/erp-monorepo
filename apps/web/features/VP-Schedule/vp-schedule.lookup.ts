// vp-schedule.lookups.ts
import { branchApi } from "../masters/branch/branch.service";
import { areaApi } from "../masters/area/area.service";
import { wagonApi } from "../masters/wagon/wagon.service";

export type VPScheduleOption = {
  value: string;
  label: string;
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
    }));
  },

  areas: async (): Promise<VPScheduleOption[]> => {
    const result = await areaApi.list(LOOKUP_QUERY);

    return result.data.map((area) => ({
      value: area.id,
      label: area.city?.name
        ? `${area.name} - ${area.city.name}`
        : area.name,
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
};