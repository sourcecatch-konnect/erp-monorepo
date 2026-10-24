import { api } from "@/lib/api";
import type {
  ApiResponse,
  TrainingAdminRole,
  TrainingMe,
  TrainingProgressBody,
  TrainingProgressEntry,
  TrainingQuizResult,
  TrainingQuizSubmitBody,
  TrainingQuizView,
  TrainingRoleUpdateBody,
  TrainingMissionView,
  TrainingTeamRow,
  TrainingVerifyResult,
} from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

export type TrainingTeamParams = {
  page: number;
  size: number;
  search?: string;
  roleId?: string;
  branchId?: string;
};

const teamQuery = ({ search, roleId, branchId }: Omit<TrainingTeamParams, "page" | "size">) => ({
  ...(search ? { search } : {}),
  ...(roleId ? { "filter[roleId]": roleId } : {}),
  ...(branchId ? { "filter[branchId]": branchId } : {}),
});

export const trainingApi = {
  me: async (): Promise<TrainingMe> =>
    unwrapApiResponse(await api.get<ApiResponse<TrainingMe>>("/training/me")),

  saveProgress: async (
    body: TrainingProgressBody,
  ): Promise<TrainingProgressEntry> =>
    unwrapApiResponse(
      await api.post<ApiResponse<TrainingProgressEntry>>(
        "/training/progress",
        body,
      ),
    ),

  undoProgress: async (stepKey: string): Promise<{ stepKey: string }> =>
    unwrapApiResponse(
      await api.delete<ApiResponse<{ stepKey: string }>>(
        `/training/progress/${encodeURIComponent(stepKey)}`,
      ),
    ),

  /** A6 — tick steps the user has already done for real. */
  verify: async (trackKey: string): Promise<TrainingVerifyResult> =>
    unwrapApiResponse(
      await api.post<ApiResponse<TrainingVerifyResult>>(
        `/training/verify/${encodeURIComponent(trackKey)}`,
      ),
    ),

  /* ---- A5: admin ---- */

  adminRoles: async (): Promise<TrainingAdminRole[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<TrainingAdminRole[]>>("/training/admin/roles"),
    ),

  updateRole: async (
    roleId: string,
    body: TrainingRoleUpdateBody,
  ): Promise<TrainingAdminRole> =>
    unwrapApiResponse(
      await api.put<ApiResponse<TrainingAdminRole>>(`/training/admin/roles/${roleId}`, body),
    ),

  adminBranches: async (): Promise<{ id: string; name: string }[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<{ id: string; name: string }[]>>("/training/admin/branches"),
    ),

  team: async ({
    page,
    size,
    ...filters
  }: TrainingTeamParams): Promise<ListResult<TrainingTeamRow>> =>
    unwrapListResponse(
      await api.get<ApiResponse<TrainingTeamRow[]>>("/training/admin/team", {
        params: { page, size, ...teamQuery(filters) },
      }),
    ),

  exportTeam: async (filters: Omit<TrainingTeamParams, "page" | "size">): Promise<Blob> => {
    const res = await api.get<Blob>("/training/admin/team/export/xlsx", {
      params: teamQuery(filters),
      responseType: "blob",
    });
    return res.data;
  },
};

/* ---- A10: quizzes ---- */

export const quizApi = {
  get: async (trackKey: string): Promise<TrainingQuizView> =>
    unwrapApiResponse(
      await api.get<ApiResponse<TrainingQuizView>>(
        `/training/quiz/${encodeURIComponent(trackKey)}`,
      ),
    ),

  submit: async (
    trackKey: string,
    body: TrainingQuizSubmitBody,
  ): Promise<TrainingQuizResult> =>
    unwrapApiResponse(
      await api.post<ApiResponse<TrainingQuizResult>>(
        `/training/quiz/${encodeURIComponent(trackKey)}`,
        body,
      ),
    ),
};

/* ---- A9: practice missions (training environment only) ---- */

export const missionsApi = {
  list: async (): Promise<TrainingMissionView[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<TrainingMissionView[]>>("/training/missions"),
    ),
};
