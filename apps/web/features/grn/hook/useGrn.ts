import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateGRNBody,
  UpdateGRNBody,
  SubmitGRNBody,
  CancelGRNBody,
} from "@skerp/types";

import type { ListQuery } from "@/features/masters/_shared/master-api";

import { grnKeys } from "../grn.key";
import { grnApi } from "../grn.service";

export const useGRNs = (query: ListQuery) => {
  return useQuery({
    queryKey: grnKeys.list(query),
    queryFn: () => grnApi.list(query),
  });
};

export const useGRNStatusCounts = () => {
  return useQuery({
    queryKey: grnKeys.statusCounts,
    queryFn: grnApi.statusCounts,
  });
};

export const useGRNDetail = (id: string) => {
  return useQuery({
    queryKey: grnKeys.detail(id),
    queryFn: () => grnApi.detail(id),
    enabled: Boolean(id),
  });
};

export const useGRNLRPreview = (lorryReceiptId: string) => {
  return useQuery({
    queryKey: grnKeys.lrPreview(lorryReceiptId),
    queryFn: () => grnApi.previewLR(lorryReceiptId),
    enabled: Boolean(lorryReceiptId),
  });
};

export const useCreateGRN = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateGRNBody) =>
      grnApi.create(body),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: grnKeys.all });
    },
  });
};

export const useUpdateGRN = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateGRNBody & { version?: number };
    }) => grnApi.update(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: grnKeys.all });
      queryClient.invalidateQueries({
        queryKey: grnKeys.detail(variables.id),
      });
    },
  });
};

export const useSubmitGRN = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: SubmitGRNBody;
    }) => grnApi.submit(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: grnKeys.all });
      queryClient.invalidateQueries({
        queryKey: grnKeys.detail(variables.id),
      });
    },
  });
};

export const useCancelGRN = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: CancelGRNBody;
    }) => grnApi.cancel(id, body),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: grnKeys.all });
      queryClient.invalidateQueries({
        queryKey: grnKeys.detail(variables.id),
      });
    },
  });
};

export const useDeleteGRN = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      grnApi.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: grnKeys.all });
    },
  });
};