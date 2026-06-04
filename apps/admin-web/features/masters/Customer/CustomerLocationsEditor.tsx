"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { City } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Combobox } from "@skerp/ui/components/combobox";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { IconTrash, IconMapPin, IconPlus } from "@tabler/icons-react";

import getErrorMessage from "../_shared/hooks/useMasterMutation";
import { customerLocationApi, customerLocationKeys } from "./customerLocation.service";

type Props = { customerId: string; cities: City[] };

export default function CustomerLocationsEditor({ customerId, cities }: Props) {
  const queryClient = useQueryClient();
  const cityOptions = cities.map((c) => ({ label: c.name, value: c.id }));

  const [name, setName] = React.useState("");
  const [cityId, setCityId] = React.useState("");
  const [address, setAddress] = React.useState("");

  const locations = useQuery({
    queryKey: customerLocationKeys.list(customerId),
    queryFn: () => customerLocationApi.list(customerId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: customerLocationKeys.list(customerId),
    });

  const create = useMutation({
    mutationFn: () =>
      customerLocationApi.create(customerId, { name, cityId, address }),
    onSuccess: () => {
      toast.success("Pickup location added");
      setName("");
      setCityId("");
      setAddress("");
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

  const canAdd = name.trim().length > 0 && cityId.length > 0;

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
                  <div className="text-sm font-medium">{loc.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {loc.city?.name ?? ""}
                    {loc.address ? ` · ${loc.address}` : ""}
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

      <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
        <Input
          placeholder="Location name (e.g. Indospace Pune)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Combobox
          options={cityOptions}
          value={cityId || undefined}
          onChange={setCityId}
          placeholder="City"
        />
        <Input
          placeholder="Address (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="sm:col-span-3">
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
    </div>
  );
}
