"use client";

import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FieldValues, Path, useFormContext } from "react-hook-form";
import type { TripVehicleChoice, Vehicle } from "@skerp/types";
import type { ComboboxOption } from "@skerp/ui/components/combobox";

import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { vehicleApi } from "@/features/masters/vehicle/vehicle.service";
import { vehicleKeys } from "@/features/masters/vehicle/vehicle.key";

const PAGE_SIZE = 20;

type VehicleOwnershipFilter = Vehicle["ownershipType"] | "all";

export type VehicleComboboxOption = ComboboxOption & {
  vehicle?: Vehicle;
  tripChoice?: TripVehicleChoice;
};

type BadgeTone = NonNullable<ComboboxOption["badgeTone"]>;

type Props<TFormValues extends FieldValues> = {
  name: Path<TFormValues>;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  required?: boolean;
  disabled?: boolean;
  ownershipType?: VehicleOwnershipFilter;
  selectionContext?: "default" | "trip" | "journey";
  showStatusBadge?: boolean;
  getBadge?: (vehicle: Vehicle) => string | undefined;
  getBadgeTone?: (vehicle: Vehicle) => BadgeTone | undefined;
  getHint?: (vehicle: Vehicle) => string | undefined;
};

const defaultStatusBadge = (vehicle: Vehicle) => {
  const badges: Record<Vehicle["status"], string | undefined> = {
    ON_TRIP: "On trip",
    AVAILABLE: "Available",
  };

  return badges[vehicle.status];
};

const defaultStatusTone = (vehicle: Vehicle): BadgeTone | undefined => {
  const tones: Record<Vehicle["status"], BadgeTone> = {
    ON_TRIP: "warning",
    AVAILABLE: "success",
  };

  return tones[vehicle.status];
};

const tripChoiceBadge = (choice: TripVehicleChoice) => {
  const badges: Record<TripVehicleChoice["selectionState"], string> = {
    AVAILABLE_FOR_NEW_JOURNEY: "Available",
    READY_FOR_NEXT_TRIP: "Ready for next trip",
    TRIP_PLANNED: "Trip planned",
    IN_TRANSIT: "In transit",
    INSURANCE_EXPIRED: "Insurance expired",
    UNAVAILABLE: "Unavailable",
  };

  return badges[choice.selectionState];
};

const journeyChoiceBadge = (choice: TripVehicleChoice) => {
  if (choice.selectionState === "AVAILABLE_FOR_NEW_JOURNEY") {
    return "Available";
  }
  if (choice.selectionState === "INSURANCE_EXPIRED") {
    return "Insurance expired";
  }
  if (choice.selectionState === "UNAVAILABLE") return "Unavailable";
  return "Assigned";
};

const tripChoiceTone = (choice: TripVehicleChoice): BadgeTone => {
  if (choice.selectionState === "AVAILABLE_FOR_NEW_JOURNEY") return "success";
  if (choice.selectionState === "READY_FOR_NEXT_TRIP") return "info";
  if (
    choice.selectionState === "INSURANCE_EXPIRED" ||
    choice.selectionState === "UNAVAILABLE"
  ) {
    return "danger";
  }
  return "warning";
};

const tripChoiceHint = (choice: TripVehicleChoice) => {
  const location = choice.currentCityName
    ? `At ${choice.currentCityName}`
    : null;
  const journey = choice.journeyNumber
    ? `Journey ${choice.journeyNumber}`
    : null;

  if (choice.selectionState === "AVAILABLE_FOR_NEW_JOURNEY") {
    return "Starts a new journey";
  }
  if (choice.selectionState === "READY_FOR_NEXT_TRIP") {
    return [
      location,
      journey,
      choice.lastTripNumber
        ? `${choice.lastTripNumber} closed`
        : choice.lastTripSequenceNo
          ? `trip ${choice.lastTripSequenceNo} closed`
          : "previous trip closed",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (choice.selectionState === "TRIP_PLANNED") {
    return [location, journey, "dispatch or cancel the planned trip first"]
      .filter(Boolean)
      .join(" · ");
  }
  if (choice.selectionState === "IN_TRANSIT") {
    return [journey, "current trip must be closed first"]
      .filter(Boolean)
      .join(" · ");
  }
  if (choice.selectionState === "INSURANCE_EXPIRED") {
    return "Renew the vehicle insurance before assigning it";
  }
  return "Not eligible for another trip";
};

export default function VehicleComboboxField<TFormValues extends FieldValues>({
  name,
  label = "Vehicle",
  placeholder,
  searchPlaceholder,
  emptyText,
  required,
  disabled,
  ownershipType = "Own_Vehicle",
  selectionContext = "default",
  showStatusBadge = true,
  getBadge,
  getBadgeTone,
  getHint,
}: Props<TFormValues>) {
  const { watch } = useFormContext<TFormValues>();
  const selectedId = watch(name) as string | undefined;
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const vehicles = useInfiniteQuery({
    queryKey: vehicleKeys.lookup({
      search: debouncedSearch,
      ownershipType,
    }),
    queryFn: ({ pageParam = 0 }) =>
      vehicleApi.lookup({
        page: pageParam,
        size: PAGE_SIZE,
        search: debouncedSearch,
        ownershipType: ownershipType === "all" ? undefined : ownershipType,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((page) => page.data).length;
      const total = lastPage.meta?.total;

      if (typeof total === "number") {
        return loaded < total ? allPages.length : undefined;
      }

      return lastPage.data.length === PAGE_SIZE ? allPages.length : undefined;
    },
    enabled: selectionContext === "default" && !disabled,
  });

  const tripChoices = useInfiniteQuery({
    queryKey: [
      ...vehicleKeys.all,
      "trip-options",
      { search: debouncedSearch, selectionContext },
    ],
    queryFn: ({ pageParam = 0 }) =>
      vehicleApi.tripOptions({
        page: pageParam,
        size: PAGE_SIZE,
        search: debouncedSearch,
        context: selectionContext === "journey" ? "journey" : undefined,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((page) => page.data).length;
      const total = lastPage.meta?.total;

      if (typeof total === "number") {
        return loaded < total ? allPages.length : undefined;
      }

      return lastPage.data.length === PAGE_SIZE ? allPages.length : undefined;
    },
    enabled: selectionContext !== "default" && !disabled,
  });

  const selectedVehicle = useQuery({
    queryKey: vehicleKeys.detail(selectedId ?? ""),
    queryFn: () => vehicleApi.detail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const options = React.useMemo<VehicleComboboxOption[]>(() => {
    if (selectionContext !== "default") {
      const choices =
        tripChoices.data?.pages.flatMap((page) => page.data) ?? [];
      const contextualOptions: VehicleComboboxOption[] = choices.map(
        (choice) => ({
          value: choice.id,
          label: choice.vehicleNumber,
          hint: tripChoiceHint(choice),
          badge:
            selectionContext === "journey"
              ? journeyChoiceBadge(choice)
              : tripChoiceBadge(choice),
          badgeTone: tripChoiceTone(choice),
          disabled:
            selectionContext === "journey"
              ? choice.selectionState !== "AVAILABLE_FOR_NEW_JOURNEY"
              : !choice.selectable,
          tripChoice: choice,
        }),
      );

      const selected = selectedVehicle.data ?? null;
      if (
        selected &&
        !contextualOptions.some((option) => option.value === selected.id)
      ) {
        contextualOptions.unshift({
          value: selected.id,
          label: selected.vehicleNumber,
          badge: defaultStatusBadge(selected),
          badgeTone: defaultStatusTone(selected),
          vehicle: selected,
        });
      }

      return contextualOptions;
    }

    const list = vehicles.data?.pages.flatMap((page) => page.data) ?? [];
    const selected = selectedVehicle.data ?? null;

    const merged =
      selected && !list.some((vehicle) => vehicle.id === selected.id)
        ? [selected, ...list]
        : list;

    return merged.map((vehicle) => ({
      value: vehicle.id,
      label: vehicle.vehicleNumber,
      hint: getHint?.(vehicle),
      badge:
        getBadge?.(vehicle) ??
        (showStatusBadge ? defaultStatusBadge(vehicle) : undefined),
      badgeTone:
        getBadgeTone?.(vehicle) ??
        (showStatusBadge ? defaultStatusTone(vehicle) : undefined),
      vehicle,
    }));
  }, [
    getBadge,
    getBadgeTone,
    getHint,
    selectionContext,
    selectedVehicle.data,
    showStatusBadge,
    tripChoices.data,
    vehicles.data,
  ]);

  const activeQuery = selectionContext === "default" ? vehicles : tripChoices;

  return (
    <ComboboxField<TFormValues>
      name={name}
      label={label}
      required={required}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={
        emptyText ??
        (activeQuery.isLoading ? "Loading vehicles..." : "No vehicles found")
      }
      disabled={disabled}
      searchValue={search}
      onSearchChange={setSearch}
      hasMore={Boolean(activeQuery.hasNextPage)}
      isLoadingMore={activeQuery.isFetchingNextPage}
      onScrollEnd={() => {
        if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
          activeQuery.fetchNextPage();
        }
      }}
    />
  );
}
