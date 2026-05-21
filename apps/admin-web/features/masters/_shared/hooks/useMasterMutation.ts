"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

type MasterApi<TCreate, TUpdate, TResult> = {
  create: (body: TCreate) => Promise<TResult>;
  update: (id: string, body: TUpdate) => Promise<TResult>;
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
>({ api, queryKey }: Props<TCreate, TUpdate, TResult>) {
  const queryClient = useQueryClient();

  const create = useMutation<TResult, Error, TCreate>({
    mutationFn: api.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const update = useMutation<TResult, Error, { id: string; data: TUpdate }>({
    mutationFn: ({ id, data }) => api.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: api.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { create, update, remove };
}