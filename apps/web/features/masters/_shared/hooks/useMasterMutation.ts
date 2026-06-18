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
export default function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    console.log("FULL API ERROR:", data);
console.log("ERROR FULL:", error);
console.log("ERROR RESPONSE:", (error as any)?.response?.data);
    // Case 1: { error: { message } }
    if (data?.error?.message) {
      return data.error.message;
    }

    // Case 2: { message }
    if (data?.message) {
      return data.message;
    }

    // Case 3: validation errors
    if (data?.error?.details && typeof data.error.details === "object") {
      return Object.entries(data.error.details)
        .flatMap(([field, messages]) =>
          (messages as string[]).map(
            (msg) => `${field}: ${msg}`
          )
        )
        .join("\n");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
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
  console.log("FULL ERROR OBJECT:", error);
  console.log("RESPONSE:", (error as any)?.response);
  console.log("DATA:", (error as any)?.response?.data);

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