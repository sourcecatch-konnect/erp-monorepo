// mrrr.hook.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateMRRRBody,
  UpdateMRRRBody,
  UpdateMRRRRowsBody,
  SubmitMRRRBody,
  CancelMRRRBody,
} from "@skerp/types";
import type { ListQuery } from "@/features/masters/_shared/master-api";

import { mrrrApi } from "../mrrr.service";
import { mrrrKeys, mrrrLookupKeys } from "../mrr.key";


export const useMRRRList = (query: ListQuery) => {
  return useQuery({
    queryKey: mrrrKeys.list(query),
    queryFn: () => mrrrApi.list(query),
  });
};

export const useMRRRDetail = (id: string) => {
  return useQuery({
    queryKey: mrrrKeys.detail(id),
    queryFn: () => mrrrApi.detail(id),
    enabled: Boolean(id),
  });
};

export const useMRRRVPSchedules = (query?: ListQuery) => {
  return useQuery({
    queryKey: mrrrLookupKeys.vpSchedules(query),
    queryFn: () => mrrrApi.vpSchedules(query),
  });
};

export const useMRRRPreview = (
  vpScheduleId?: string,
  enabled = true,
) => {
  return useQuery({
    queryKey: mrrrLookupKeys.preview(vpScheduleId ?? ""),
    queryFn: () => mrrrApi.preview(vpScheduleId!),
    enabled: enabled && Boolean(vpScheduleId),
    retry: false,
  });
};

export const useCreateMRRR = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateMRRRBody) => mrrrApi.create(body),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mrrrKeys.all });
      queryClient.invalidateQueries({
        queryKey: mrrrLookupKeys.all,
      });
    },
  });
};

export const useUpdateMRRR = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateMRRRBody & { version?: number };
    }) => mrrrApi.update(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: mrrrKeys.all });
      queryClient.invalidateQueries({
        queryKey: mrrrKeys.detail(variables.id),
      });
    },
  });
};

export const useUpdateMRRRRows = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateMRRRRowsBody;
    }) => mrrrApi.updateRows(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: mrrrKeys.all });
      queryClient.invalidateQueries({
        queryKey: mrrrKeys.detail(variables.id),
      });
    },
  });
};

export const useSubmitMRRR = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: SubmitMRRRBody;
    }) => mrrrApi.submit(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: mrrrKeys.all });
      queryClient.invalidateQueries({
        queryKey: mrrrKeys.detail(variables.id),
      });
    },
  });
};

export const useCancelMRRR = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: CancelMRRRBody;
    }) => mrrrApi.cancel(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: mrrrKeys.all });
      queryClient.invalidateQueries({
        queryKey: mrrrKeys.detail(variables.id),
      });
    },
  });
};

export const useDeleteMRRR = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mrrrApi.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mrrrKeys.all });
      queryClient.invalidateQueries({
        queryKey: mrrrLookupKeys.all,
      });
    },
  });
};