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
  const formatValue = (value: unknown): string | null => {
    if (!value) return null;

    if (typeof value === "string") return value;

    if (Array.isArray(value)) {
      return value.map(String).join("\n");
    }

    if (typeof value === "object") {
      const messages = Object.entries(value)
        .flatMap(([field, fieldValue]) => {
          if (Array.isArray(fieldValue)) {
            return fieldValue.map((msg) => `${field}: ${msg}`);
          }

          if (typeof fieldValue === "string") {
            return [`${field}: ${fieldValue}`];
          }

          if (fieldValue && typeof fieldValue === "object") {
            return [formatValue(fieldValue)].filter(Boolean) as string[];
          }

          return [];
        })
        .filter(Boolean);

      return messages.length > 0 ? messages.join("\n") : null;
    }

    return String(value);
  };

  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    console.log("API ERROR DATA:", data);

    const detailsMessage =
      formatValue(data?.details) ||
      formatValue(data?.error?.details) ||
      formatValue(data?.errors) ||
      formatValue(data?.error?.errors);

    if (detailsMessage) {
      return detailsMessage;
    }

    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof data?.error === "string") {
      return data.error;
    }

    return error.message || "Unexpected error";
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