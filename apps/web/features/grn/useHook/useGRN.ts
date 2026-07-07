// apps/web/src/features/grn/hooks/use-grn.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ListQuery } from "@/features/masters/_shared/master-api";
import {
  grnApi,
  type CancelGRNBody,
  type CreateGRNBody,
  type SubmitGRNBody,
  type UpdateGRNBody,
} from "../grn.service";
import { grnKeys, grnLookupKeys } from "../grn.key";
import { api } from "@/lib/api";
export type SupervisorOption = {
  id: string;
  name: string;
  email: string;
};
/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

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

export const useEligibleGRNLrs = (query: ListQuery) => {
  return useQuery({
    queryKey: grnLookupKeys.eligibleLRs(query),
    queryFn: () => grnApi.eligibleLRs(query),
  });
};

export const useGRNPreview = (lrId: string) => {
  return useQuery({
    queryKey: grnKeys.preview(lrId),
    queryFn: () => grnApi.preview(lrId),
    enabled: Boolean(lrId),
  });
};

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

export const useCreateGRN = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateGRNBody) => grnApi.create(body),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: grnKeys.all });

      // After GRN create, selected LR should disappear from eligible LR list.
      queryClient.invalidateQueries({ queryKey: ["grn-lookups"] });
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
      body: UpdateGRNBody;
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

export function useGrnSupervisors() {
  return useQuery({
    queryKey: ["grn-supervisors"],
    queryFn: async () => {
      const res = await api.get<{ data: SupervisorOption[] }>(
        "/grn/supervisors",
      );

      return res.data.data;
    },
  });
}