import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { masterRegistry } from "../../registry";

export function useMaster<T extends keyof typeof masterRegistry>(key: T) {
  const config = masterRegistry[key];
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: config.queryKey,
    queryFn: config.api.list,
  });

  const create = useMutation({
    mutationFn: config.api.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: config.queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: any) =>
      config.api.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: config.queryKey }),
  });

  const remove = useMutation({
    mutationFn: config.api.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: config.queryKey }),
  });

  return {
    ...list,
    create,
    update,
    remove,
    config,
  };
}