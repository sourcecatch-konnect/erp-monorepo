import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { railRakeKeys } from "@/features/rail-rake/rail-rake.key";

import {
  railBranchGrnApi,
  type CreateRailBranchGRNBody,
  type UpdateRailBranchGRNBody,
} from "./rail-branch-grn.service";
import { railBranchGrnKeys } from "./rail-branch-grn.key";
import type { ListQuery } from "@/features/masters/_shared/master-api";

export const useRailBranchGRNs = (query: ListQuery) =>
  useQuery({
    queryKey: railBranchGrnKeys.list(query),
    queryFn: () => railBranchGrnApi.list(query),
  });

export const useRailBranchGRNPreview = (
  railRakeId?: string,
  vpWagonLoadingId?: string,
) =>
  useQuery({
    queryKey: railBranchGrnKeys.preview(
      railRakeId ?? "",
      vpWagonLoadingId ?? "",
    ),
    queryFn: () =>
      railBranchGrnApi.preview(
        railRakeId as string,
        vpWagonLoadingId as string,
      ),
    enabled: Boolean(railRakeId && vpWagonLoadingId),
  });

export const useRailBranchGRNDetail = (id?: string) =>
  useQuery({
    queryKey: railBranchGrnKeys.detail(id ?? ""),
    queryFn: () => railBranchGrnApi.detail(id as string),
    enabled: Boolean(id),
  });

export const useRailBranchGRNSupervisors = (
  railRakeId?: string,
) =>
  useQuery({
    queryKey: [
      ...railBranchGrnKeys.all,
      "supervisors",
      railRakeId,
    ],
    queryFn: () =>
      railBranchGrnApi.supervisors(railRakeId!),
    enabled: Boolean(railRakeId),
  });
export const useCreateRailBranchGRN = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRailBranchGRNBody) =>
      railBranchGrnApi.create(body),
    onSuccess: (result, body) => {
      queryClient.setQueryData(
        railBranchGrnKeys.detail(result.branchGrn.id),
        result.branchGrn,
      );
      queryClient.invalidateQueries({ queryKey: railRakeKeys.incoming });
      queryClient.invalidateQueries({
        queryKey: [...railRakeKeys.detail(body.railRakeId), "available-vps"],
      });
      queryClient.invalidateQueries({ queryKey: railBranchGrnKeys.all });
    },
  });
};

export const useDeleteRailBranchGRN = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => railBranchGrnApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: railBranchGrnKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: railBranchGrnKeys.all });
      queryClient.invalidateQueries({ queryKey: railRakeKeys.all });
    },
  });
};

export const useUpdateRailBranchGRN = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRailBranchGRNBody }) =>
      railBranchGrnApi.update(id, body),
    onSuccess: (result) => {
      queryClient.setQueryData(railBranchGrnKeys.detail(result.id), result);
      queryClient.invalidateQueries({ queryKey: railBranchGrnKeys.all });
    },
  });
};

export const useSubmitRailBranchGRN = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      damagePhotoAttachmentIds,
    }: {
      id: string;
      version: number;
      damagePhotoAttachmentIds?: string[];
    }) => railBranchGrnApi.submit(id, version, damagePhotoAttachmentIds),
    onSuccess: (result) => {
      queryClient.setQueryData(
        railBranchGrnKeys.detail(result.branchGrn.id),
        result.branchGrn,
      );
      queryClient.invalidateQueries({ queryKey: railBranchGrnKeys.all });
      queryClient.invalidateQueries({ queryKey: railRakeKeys.all });
    },
  });
};
