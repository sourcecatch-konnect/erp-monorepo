import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateDeliveryChallanBody,
  UpdateDeliveryChallanBody,
} from "@skerp/types";

import type { ListQuery } from "@/features/masters/_shared/master-api";

import { deliveryChallanKeys } from "./delivery-challan.key";
import {
  deliveryChallanApi,
  type DeliveryVehicleMode,
} from "./delivery-challan.service";

export const useDeliveryChallans = (query: ListQuery) =>
  useQuery({
    queryKey: deliveryChallanKeys.list(query),
    queryFn: () => deliveryChallanApi.list(query),
  });

export const useDeliveryChallanDetail = (id?: string) =>
  useQuery({
    queryKey: deliveryChallanKeys.detail(id ?? ""),
    queryFn: () => deliveryChallanApi.detail(id as string),
    enabled: Boolean(id),
  });

export const useDeliveryChallanRakes = (scheduleDate?: string) =>
  useQuery({
    queryKey: deliveryChallanKeys.rakes(scheduleDate),
    queryFn: () => deliveryChallanApi.rakes(scheduleDate),
  });

export const useDeliveryChallanPreview = (railRakeId?: string) =>
  useQuery({
    queryKey: deliveryChallanKeys.preview(railRakeId),
    queryFn: () => deliveryChallanApi.preview(railRakeId as string),
    enabled: Boolean(railRakeId),
  });

export const useDeliveryChallanSupervisors = (railRakeId?: string) =>
  useQuery({
    queryKey: deliveryChallanKeys.supervisors(railRakeId),
    queryFn: () => deliveryChallanApi.supervisors(railRakeId as string),
    enabled: Boolean(railRakeId),
  });

export const useDeliveryChallanTransports = (enabled: boolean) =>
  useQuery({
    queryKey: deliveryChallanKeys.transports(),
    queryFn: deliveryChallanApi.transports,
    enabled,
  });

export const useDeliveryChallanVehicles = (
  mode: DeliveryVehicleMode,
  transportId?: string,
) =>
  useQuery({
    queryKey: deliveryChallanKeys.vehicles(mode, transportId),
    queryFn: () =>
      deliveryChallanApi.vehicles(mode, transportId),
    enabled: mode === "OWN" || (mode === "MARKET" && Boolean(transportId)),
  });

const useRefreshDeliveryChallans = () => {
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: deliveryChallanKeys.all });
    if (id) {
      queryClient.invalidateQueries({
        queryKey: deliveryChallanKeys.detail(id),
      });
    }
  };
};

export const useCreateDeliveryChallan = () => {
  const refresh = useRefreshDeliveryChallans();
  return useMutation({
    mutationFn: (body: CreateDeliveryChallanBody) =>
      deliveryChallanApi.create(body),
    onSuccess: (row) => refresh(row.id),
  });
};

export const useUpdateDeliveryChallan = () => {
  const refresh = useRefreshDeliveryChallans();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateDeliveryChallanBody;
    }) => deliveryChallanApi.update(id, body),
    onSuccess: (row) => refresh(row.id),
  });
};

export const useIssueDeliveryChallan = () => {
  const refresh = useRefreshDeliveryChallans();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      deliveryChallanApi.issue(id, version),
    onSuccess: (row) => refresh(row.id),
  });
};

export const useCancelDeliveryChallan = () => {
  const refresh = useRefreshDeliveryChallans();
  return useMutation({
    mutationFn: ({
      id,
      version,
      reason,
    }: {
      id: string;
      version: number;
      reason: string;
    }) => deliveryChallanApi.cancel(id, version, reason),
    onSuccess: (row) => refresh(row.id),
  });
};

export const useDeleteDeliveryChallan = () => {
  const refresh = useRefreshDeliveryChallans();
  return useMutation({
    mutationFn: deliveryChallanApi.remove,
    onSuccess: (_row, id) => refresh(id),
  });
};
