import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateVPScheduleBody,
  UpdateVPScheduleBody,
  ConfirmVPScheduleBody,
  CancelVPScheduleBody,
} from "@skerp/types";
import { vpScheduleKeys } from "../vp-schedule.key";
import { ListQuery } from "@/features/masters/_shared/master-api";
import { vpScheduleApi } from "../vp-schedule.service";


export const useVPSchedules = (query: ListQuery) => {
  return useQuery({
    queryKey: vpScheduleKeys.list(query),
    queryFn: () => vpScheduleApi.list(query),
  });
};

export const useVPScheduleStatusCounts = () => {
  return useQuery({
    queryKey: vpScheduleKeys.statusCounts,
    queryFn: vpScheduleApi.statusCounts,
  });
};

export const useVPScheduleDetail = (id: string) => {
  return useQuery({
    queryKey: vpScheduleKeys.detail(id),
    queryFn: () => vpScheduleApi.detail(id),
    enabled: Boolean(id),
  });
};

export const useCreateVPSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateVPScheduleBody) =>
      vpScheduleApi.create(body),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vpScheduleKeys.all });
    },
  });
};

export const useUpdateVPSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateVPScheduleBody & { version?: number };
    }) => vpScheduleApi.update(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: vpScheduleKeys.all });
      queryClient.invalidateQueries({
        queryKey: vpScheduleKeys.detail(variables.id),
      });
    },
  });
};

export const useConfirmVPSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: ConfirmVPScheduleBody;
    }) => vpScheduleApi.confirm(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: vpScheduleKeys.all });
      queryClient.invalidateQueries({
        queryKey: vpScheduleKeys.detail(variables.id),
      });
    },
  });
};

export const useCancelVPSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: CancelVPScheduleBody;
    }) => vpScheduleApi.cancel(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: vpScheduleKeys.all });
      queryClient.invalidateQueries({
        queryKey: vpScheduleKeys.detail(variables.id),
      });
    },
  });
};

export const useDeleteVPSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => vpScheduleApi.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vpScheduleKeys.all });
    },
  });
};