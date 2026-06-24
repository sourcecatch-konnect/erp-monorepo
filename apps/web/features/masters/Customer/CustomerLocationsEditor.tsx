"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { City } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Combobox } from "@skerp/ui/components/combobox";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { IconTrash, IconMapPin, IconPlus } from "@tabler/icons-react";

import getErrorMessage from "../_shared/hooks/useMasterMutation";
import {
  customerLocationApi,
  customerLocationKeys,
} from "./customerLocation.service";
import { areaApi } from "../area/area.service";

type Props = { customerId: string; cities: City[] };

export default function CustomerLocationsEditor({ customerId, cities }: Props) {
  const queryClient = useQueryClient();

  const [cityId, setCityId] = React.useState("");
  const [areaId, setAreaId] = React.useState("");
  const [areaSearch, setAreaSearch] = React.useState("");

  const cityOptions = cities.map((c) => ({ label: c.name, value: c.id }));

  const areas = useQuery({
    queryKey: ["customer-location-areas", cityId, areaSearch],
    queryFn: () =>
      areaApi.list({
        page: 0,
        size: 10,
        search: areaSearch.trim() || undefined,
        cityId,
      } as any),
    enabled: cityId.length > 0,
  });

  const areaOptions =
    areas.data?.data.map((area) => ({
      label: area.name,
      value: area.id,
    })) ?? [];

  const selectedArea = areas.data?.data.find((area) => area.id === areaId);

const locations = useQuery({
  queryKey: customerLocationKeys.list(customerId, cityId || undefined),
  queryFn: () =>
    customerLocationApi.list(customerId, {
      cityId: cityId || undefined,
    }),
});

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: customerLocationKeys.list(customerId),
    });

  const create = useMutation({
    mutationFn: () => {
      if (!selectedArea) {
        throw new Error("Please select area");
      }

      return customerLocationApi.create(customerId, {
        name: selectedArea.name,
        cityId,
        areaId,
        address: selectedArea.formattedAddress ?? undefined,
      });
    },
    onSuccess: () => {
      toast.success("Pickup location added");
      setCityId("");
      setAreaId("");
      setAreaSearch("");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => customerLocationApi.remove(id),
    onSuccess: () => {
      toast.success("Location removed");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const canAdd = cityId.length > 0 && areaId.length > 0;

  return (
    <div className="col-span-full space-y-3">
      {locations.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : locations.data && locations.data.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {locations.data.map((loc) => (
            <li
              key={loc.id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <IconMapPin size={15} className="text-muted-foreground" />

                <div>
  <div className="text-sm font-medium">
    {loc.area?.name ?? loc.name}
  </div>

  <div className="text-xs text-muted-foreground">
    {loc.city?.name ?? ""}
  </div>
</div>
              </div>

              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                onClick={() => remove.mutate(loc.id)}
                aria-label="Remove location"
              >
                <IconTrash size={16} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No saved pickup locations yet.
        </p>
      )}

      <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <Combobox
          options={cityOptions}
          value={cityId || undefined}
          onChange={(value) => {
            setCityId(value ?? "");
            setAreaId("");
            setAreaSearch("");
          }}
          placeholder="City"
        />

        <Combobox
          options={areaOptions}
          value={areaId || undefined}
          onSearchChange={setAreaSearch}
          onChange={(value) => setAreaId(value ?? "")}
          placeholder={cityId ? "Search area" : "Select city first"}
          disabled={!cityId}
        />

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canAdd || create.isPending}
          onClick={() => create.mutate()}
        >
          <IconPlus size={16} className="mr-1" />
          {create.isPending ? "Adding…" : "Add location"}
        </Button>
      </div>
    </div>
  );
}