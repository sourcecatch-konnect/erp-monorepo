import { api } from "@/lib/api";
import type {
  ApiResponse,
  TrainingMe,
  TrainingProgressBody,
  TrainingProgressEntry,
} from "@skerp/types";
import { unwrapApiResponse } from "@/features/masters/_shared/master-api";

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
};
