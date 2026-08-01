import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CalculateRailRakeOperationBody,
  CreateRailRakeOperationBody,
  RailRakeOperationStage,
  UpdateRailRakeOperationBody,
} from "@skerp/types";

import type { ListQuery } from "@/features/masters/_shared/master-api";

import { railRakeOperationKeys } from "./rail-rake-operation.key";
import { railRakeOperationApi } from "./rail-rake-operation.service";

export const useRailRakeOperations = (query: ListQuery) =>
  useQuery({
    queryKey: railRakeOperationKeys.list(query),
    queryFn: () => railRakeOperationApi.list(query),
  });

export const useRailRakeOperationRakes = (stage: RailRakeOperationStage) =>
  useQuery({
    queryKey: railRakeOperationKeys.rakes(stage),
    queryFn: () => railRakeOperationApi.rakes(stage),
  });

export const useRailRakeOperationDetail = (id?: string) =>
  useQuery({
    queryKey: railRakeOperationKeys.detail(id ?? ""),
    queryFn: () => railRakeOperationApi.detail(id as string),
    enabled: Boolean(id),
  });

export const useCalculateRailRakeOperation = () =>
  useMutation({
    mutationFn: (body: CalculateRailRakeOperationBody) =>
      railRakeOperationApi.calculate(body),
  });

const useRefresh = () => {
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: railRakeOperationKeys.all });
    if (id) {
      queryClient.invalidateQueries({
        queryKey: railRakeOperationKeys.detail(id),
      });
    }
  };
};

export const useCreateRailRakeOperation = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: CreateRailRakeOperationBody) =>
      railRakeOperationApi.create(body),
    onSuccess: (row) => refresh(row.id),
  });
};

export const useUpdateRailRakeOperation = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateRailRakeOperationBody;
    }) => railRakeOperationApi.update(id, body),
    onSuccess: (row) => refresh(row.id),
  });
};

export const useSubmitRailRakeOperation = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      railRakeOperationApi.submit(id, version),
    onSuccess: (row) => refresh(row.id),
  });
};

export const useDeleteRailRakeOperation = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: railRakeOperationApi.remove,
    onSuccess: (_row, id) => refresh(id),
  });
};
