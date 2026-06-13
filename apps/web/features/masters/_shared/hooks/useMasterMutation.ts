"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

type MasterApi<TCreate, TUpdate, TResult> = {
  create: (body: TCreate) => Promise<TResult>;
  update: (id: string, body: TUpdate) => Promise<TResult>;
  remove: (id: string) => Promise<void>;
};

type Props<TCreate, TUpdate, TResult> = {
  api: MasterApi<TCreate, TUpdate, TResult>;
  queryKey: readonly unknown[];
  entityName?: string;
};
export default function getErrorMessage(
  error: unknown
): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data?.error;

    console.log("API Error:", apiError);

    // Validation field errors
    if (
      apiError?.details &&
      typeof apiError.details === "object"
    ) {
      return Object.entries(apiError.details)
        .flatMap(([field, messages]) =>
          (messages as string[]).map(
            (message) =>
              `${field}: ${message}`
          )
        )
        .join("\n");
    }

    // fallback message
    if (apiError?.message) {
      return apiError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}
export function useMasterMutations<TCreate, TUpdate, TResult>({
  api,
  queryKey,
  entityName = "Record",
}: Props<TCreate, TUpdate, TResult>) {
  const queryClient = useQueryClient();

  const create = useMutation<TResult, unknown, TCreate>({
    mutationFn: api.create,
    onSuccess: () => {
      toast.success(`${entityName} created successfully`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const update = useMutation<
    TResult,
    unknown,
    { id: string; data: TUpdate }
  >({
    mutationFn: ({ id, data }) => api.update(id, data),
    onSuccess: () => {
      toast.success(`${entityName} updated successfully`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const remove = useMutation<void, unknown, string>({
    mutationFn: api.remove,
    onSuccess: () => {
      toast.success(`${entityName} deleted successfully`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  return { create, update, remove };
}