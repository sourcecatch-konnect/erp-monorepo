import { AxiosError } from "axios";
import { api } from "@/lib/api";

import type {
  State,
  CreateStateBody,
  UpdateStateBody,
  ApiResponse,
} from "@skerp/types";

export const stateApi = {
  list: async (): Promise<State[]> => {
  try {
  const res =
  await api.get<ApiResponse<State[]>>(
    "/states"
  );

const response = res.data;

if (response.ok === false) {
  throw new Error(
    response.error.message
  );
}

return response.data;

  } catch (err) {
    const error =
      err as AxiosError<ApiResponse<State[]>>;

    throw new Error(
      error.response?.data?.error?.message ||
      "Failed to fetch states"
    );
  }
},

  create: async (
    body: CreateStateBody
  ): Promise<State> => {
    try {
      const res =
        await api.post<ApiResponse<State>>(
          "/states",
          body
        );

const response = res.data;
     if (response.ok === false) {
  throw new Error(
    response.error.message
  );
}

return response.data;

    } catch (err) {
      const error =
        err as AxiosError<ApiResponse<State>>;

      throw new Error(
        error.response?.data?.error?.message ||
        "Failed to create state"
      );
    }
  },

  update: async (
    id: string,
    body: UpdateStateBody
  ): Promise<State> => {
    try {
      const res =
        await api.patch<ApiResponse<State>>(
          `/states/${id}`,
          body
        );

     const response = res.data;

if (response.ok === false) {
  throw new Error(
    response.error.message
  );
}

return response.data;

    } catch (err) {
      const error =
        err as AxiosError<ApiResponse<State>>;

      throw new Error(
        error.response?.data?.error?.message ||
        "Failed to update state"
      );
    }
  },

  remove: async (
  id: string
): Promise<void> => {
  try {
    const res =
      await api.delete<ApiResponse<null>>(
        `/states/${id}`
      );

    const response = res.data;

    if (response.ok) {
      throw new Error(
        response.error.message
      );
    }

  } catch (err) {
    const error =
      err as AxiosError<ApiResponse<null>>;

    throw new Error(
      error.response?.data?.error?.message ||
      "Failed to delete state"
    );
  }
},
};