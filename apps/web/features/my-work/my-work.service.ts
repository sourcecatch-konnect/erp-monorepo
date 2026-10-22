import { api } from "@/lib/api";
import type {
  ApiResponse,
  MyWorkCountResponse,
  MyWorkModule,
  MyWorkPriorityResponse,
  MyWorkQueueKey,
  MyWorkResponse,
  MyWorkScope,
  MyWorkUrgency,
} from "@skerp/types";
import { unwrapApiResponse } from "../masters/_shared/master-api";

/** What the My Work list is narrowed to. */
export type MyWorkListFilter = {
  /** Work area card; null = all areas. */
  module: MyWorkModule | null;
  /** One step inside the area; null = all its steps. */
  queue: MyWorkQueueKey | null;
  urgency: MyWorkUrgency;
  /** active = waiting work, stale = old leftovers. */
  scope: MyWorkScope;
  search: string;
  /** One branch; null = every branch the user can see. */
  branch: string | null;
};

export const myWorkApi = {
  overview: async (branch: string | null): Promise<MyWorkResponse> => {
    const res = await api.get<ApiResponse<MyWorkResponse>>("/my-work", {
      params: { branch: branch ?? undefined },
    });
    return unwrapApiResponse(res);
  },

  /** Just the badge number — far lighter than the overview. */
  count: async (): Promise<MyWorkCountResponse> => {
    const res = await api.get<ApiResponse<MyWorkCountResponse>>("/my-work/count");
    return unwrapApiResponse(res);
  },

  list: async (
    filter: MyWorkListFilter,
    skip: number,
    size: number,
  ): Promise<MyWorkPriorityResponse> => {
    const res = await api.get<ApiResponse<MyWorkPriorityResponse>>(
      "/my-work/priority",
      {
        params: {
          module: filter.module ?? undefined,
          queue: filter.queue ?? undefined,
          urgency: filter.urgency,
          scope: filter.scope,
          search: filter.search || undefined,
          branch: filter.branch ?? undefined,
          skip,
          size,
        },
      },
    );
    return unwrapApiResponse(res);
  },
};
