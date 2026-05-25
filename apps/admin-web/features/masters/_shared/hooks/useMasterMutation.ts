"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

type MasterApi<TCreate, TUpdate, TResult> = {
  create: (body: TCreate) => Promise<TResult>;
  update: (
    id: string,
    body: TUpdate
  ) => Promise<TResult>;

  remove: (id: string) => Promise<void>;
};

type Props<TCreate, TUpdate, TResult> = {
  api: MasterApi<TCreate, TUpdate, TResult>;
  queryKey: readonly unknown[];
};

export function useMasterMutations<
  TCreate,
  TUpdate,
  TResult
>({
  api,
  queryKey,
}: Props<TCreate, TUpdate, TResult>) {
  const queryClient = useQueryClient();

  const commonMutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey,
      });
    },

    onError: (error: Error) => {
      toast.error(
        error.message || "Something went wrong"
      );
    },
  };

  const create = useMutation<
    TResult,
    Error,
    TCreate
  >({
    mutationFn: api.create,
    ...commonMutationOptions,
  });

  const update = useMutation<
    TResult,
    Error,
    { id: string; data: TUpdate }
  >({
    mutationFn: ({ id, data }) =>
      api.update(id, data),

    ...commonMutationOptions,
  });

  const remove = useMutation<
    void,
    Error,
    string
  >({
    mutationFn: api.remove,
    ...commonMutationOptions,
  });

  return { create, update, remove };
}