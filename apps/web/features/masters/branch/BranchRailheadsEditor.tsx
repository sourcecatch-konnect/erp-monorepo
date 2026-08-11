"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { IconTrain } from "@tabler/icons-react";

import { areaApi } from "../area/area.service";
import getErrorMessage from "../_shared/hooks/useMasterMutation";
import { branchApi } from "./branch.service";
import { branchKeys } from "./branch.key";

type Props = {
  branchId: string;
  onHasRailheadsChange?: (hasRailheads: boolean) => void;
};

export default function BranchRailheadsEditor({
  branchId,
  onHasRailheadsChange,
}: Props) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const areas = useQuery({
    queryKey: ["branch-railhead-area-options"],
    queryFn: () =>
      areaApi.list({
        page: 0,
        size: 1000,
        sort: "name:asc",
        filter: { isRailHead: "true" },
      }),
  });

  const mappings = useQuery({
    queryKey: branchKeys.railheads(branchId),
    queryFn: () => branchApi.railheads(branchId),
  });

  React.useEffect(() => {
    if (mappings.data) {
      setSelectedIds(mappings.data.map((item) => item.areaId));
      onHasRailheadsChange?.(mappings.data.length > 0);
    }
  }, [mappings.data, onHasRailheadsChange]);

  const save = useMutation({
    mutationFn: () =>
      branchApi.updateRailheads(branchId, { areaIds: selectedIds }),
    onSuccess: (railheads) => {
      toast.success("Managed railheads updated");
      onHasRailheadsChange?.(railheads.length > 0);
      queryClient.invalidateQueries({
        queryKey: branchKeys.railheads(branchId),
      });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (areas.isLoading || mappings.isLoading) {
    return <Skeleton className="col-span-full h-20" />;
  }

  const options = areas.data?.data ?? [];

  return (
    <div className="col-span-full space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium">Managed Railheads</p>
        <p className="text-xs text-muted-foreground">
          Select the physical railhead Areas this branch can operate.
        </p>
      </div>

      {options.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((area) => {
            const checked = selectedIds.includes(area.id);
            return (
              <label
                key={area.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    setSelectedIds((current) =>
                      value
                        ? [...new Set([...current, area.id])]
                        : current.filter((id) => id !== area.id),
                    )
                  }
                />
                <IconTrain size={14} className="text-muted-foreground" />
                <span>
                  {area.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({area.city?.name ?? "No city"})
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No Areas are marked as Rail Head yet.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save railheads"}
        </Button>
      </div>
    </div>
  );
}
