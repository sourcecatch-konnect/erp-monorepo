"use client";

import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FieldValues, Path, useFormContext } from "react-hook-form";
import type { Driver, TripDriverChoice } from "@skerp/types";
import type { ComboboxOption } from "@skerp/ui/components/combobox";

import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { driverApi } from "@/features/masters/driver/driver.service";
import { driverKeys } from "@/features/masters/driver/driver.key";

const PAGE_SIZE = 20;

export type DriverComboboxOption = ComboboxOption & {
  driver?: Driver;
  tripChoice?: TripDriverChoice;
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
  selectionContext?: "default" | "trip" | "journey";
  showStatusBadge?: boolean;
  getBadge?: (driver: Driver) => string | undefined;
  getBadgeTone?: (driver: Driver) => BadgeTone | undefined;
  getHint?: (driver: Driver) => string | undefined;
  highlightDriverId?: string;
  onTripChoiceSelect?: (choice: TripDriverChoice) => void;
};

const defaultStatusBadge = (driver: Driver) => {
  if (driver.blackListed) return "Blacklisted";
  if (driver.onLeave) return "On leave";
  if (driver.status === "ON_TRIP") return "On trip";
  if (driver.status === "AVAILABLE") return "Available";
  return undefined;
};

const defaultStatusTone = (driver: Driver): BadgeTone | undefined => {
  if (driver.blackListed) return "danger";
  if (driver.onLeave) return "warning";
  if (driver.status === "ON_TRIP") return "info";
  if (driver.status === "AVAILABLE") return "success";
  return undefined;
};

const tripChoiceBadge = (choice: TripDriverChoice) => {
  const badges: Record<TripDriverChoice["selectionState"], string> = {
    AVAILABLE_FOR_NEW_JOURNEY: "Available",
    ASSIGNED_READY_FOR_NEXT_TRIP: "Ready with vehicle",
    TRIP_PLANNED: "Trip planned",
    IN_TRANSIT: "In transit",
    ON_LEAVE: "On leave",
    BLACKLISTED: "Blacklisted",
    UNAVAILABLE: "Unavailable",
  };

  return badges[choice.selectionState];
};

const journeyChoiceBadge = (choice: TripDriverChoice) => {
  if (choice.selectionState === "AVAILABLE_FOR_NEW_JOURNEY") {
    return "Available";
  }
  if (choice.selectionState === "ON_LEAVE") return "On leave";
  if (choice.selectionState === "BLACKLISTED") return "Blacklisted";
  if (choice.selectionState === "UNAVAILABLE") return "Unavailable";
  return "Assigned";
};

const tripChoiceTone = (choice: TripDriverChoice): BadgeTone => {
  if (choice.selectionState === "AVAILABLE_FOR_NEW_JOURNEY") return "success";
  if (choice.selectionState === "ASSIGNED_READY_FOR_NEXT_TRIP") return "info";
  if (
    choice.selectionState === "BLACKLISTED" ||
    choice.selectionState === "UNAVAILABLE"
  ) {
    return "danger";
  }
  return "warning";
};

const tripChoiceHint = (choice: TripDriverChoice) => {
  const location = choice.currentCityName
    ? `At ${choice.currentCityName}`
    : null;
  const journey = choice.journeyNumber
    ? `Journey ${choice.journeyNumber}`
    : null;
  const vehicle = choice.vehicleNumber
    ? `Vehicle ${choice.vehicleNumber}`
    : null;

  if (choice.selectionState === "AVAILABLE_FOR_NEW_JOURNEY") {
    return "Available for a new journey";
  }
  if (choice.selectionState === "ASSIGNED_READY_FOR_NEXT_TRIP") {
    return [
      location,
      journey,
      vehicle,
      choice.lastTripNumber
        ? `${choice.lastTripNumber} closed`
        : "previous trip closed",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (choice.selectionState === "TRIP_PLANNED") {
    return [
      location,
      journey,
      vehicle,
      choice.lastTripNumber
        ? `${choice.lastTripNumber} awaiting dispatch`
        : "assigned trip awaiting dispatch",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (choice.selectionState === "IN_TRANSIT") {
    return [journey, vehicle, "currently travelling"]
      .filter(Boolean)
      .join(" · ");
  }
  if (choice.selectionState === "ON_LEAVE") {
    return "Driver is marked on leave";
  }
  if (choice.selectionState === "BLACKLISTED") {
    return "Driver is blacklisted";
  }
  return "Not eligible for another trip";
};

export default function DriverComboboxField<TFormValues extends FieldValues>({
  name,
  label = "Driver",
  placeholder,
  searchPlaceholder,
  emptyText,
  required,
  disabled,
  selectionContext = "default",
  showStatusBadge = true,
  getBadge,
  getBadgeTone,
  getHint,
  highlightDriverId,
  onTripChoiceSelect,
}: Props<TFormValues>) {
  const { watch } = useFormContext<TFormValues>();
  const selectedId = watch(name) as string | undefined;
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const drivers = useInfiniteQuery({
    queryKey: driverKeys.lookup({ search: debouncedSearch }),
    queryFn: ({ pageParam = 0 }) =>
      driverApi.lookup({
        page: pageParam,
        size: PAGE_SIZE,
        search: debouncedSearch,
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
      ...driverKeys.all,
      "trip-options",
      { search: debouncedSearch, selectionContext },
    ],
    queryFn: ({ pageParam = 0 }) =>
      driverApi.tripOptions({
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

  const selectedDriver = useQuery({
    queryKey: driverKeys.detail(selectedId ?? ""),
    queryFn: () => driverApi.detail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const options = React.useMemo<DriverComboboxOption[]>(() => {
    if (selectionContext !== "default") {
      const choices =
        tripChoices.data?.pages.flatMap((page) => page.data) ?? [];
      const contextualOptions: DriverComboboxOption[] = choices.map(
        (choice) => ({
          value: choice.id,
          label: choice.name,
          hint: tripChoiceHint(choice),
          badge:
            highlightDriverId && choice.id === highlightDriverId
              ? "Journey driver"
              : selectionContext === "journey"
                ? journeyChoiceBadge(choice)
                : tripChoiceBadge(choice),
          badgeTone:
            highlightDriverId && choice.id === highlightDriverId
              ? "info"
              : tripChoiceTone(choice),
          disabled:
            selectionContext === "journey"
              ? choice.selectionState !== "AVAILABLE_FOR_NEW_JOURNEY"
              : !choice.selectable,
          tripChoice: choice,
        }),
      );

      const selected = selectedDriver.data ?? null;
      if (
        selected &&
        !contextualOptions.some((option) => option.value === selected.id)
      ) {
        contextualOptions.unshift({
          value: selected.id,
          label: selected.name,
          badge:
            highlightDriverId && selected.id === highlightDriverId
              ? "Journey driver"
              : defaultStatusBadge(selected),
          badgeTone:
            highlightDriverId && selected.id === highlightDriverId
              ? "info"
              : defaultStatusTone(selected),
          driver: selected,
        });
      }

      return contextualOptions;
    }

    const list = drivers.data?.pages.flatMap((page) => page.data) ?? [];
    const selected = selectedDriver.data ?? null;

    const merged =
      selected && !list.some((driver) => driver.id === selected.id)
        ? [selected, ...list]
        : list;

    return merged.map((driver) => ({
      value: driver.id,
      label: driver.name,
      hint: getHint?.(driver),
      badge:
        getBadge?.(driver) ??
        (highlightDriverId && driver.id === highlightDriverId
          ? "Journey driver"
          : showStatusBadge
            ? defaultStatusBadge(driver)
            : undefined),
      badgeTone:
        getBadgeTone?.(driver) ??
        (highlightDriverId && driver.id === highlightDriverId
          ? "info"
          : showStatusBadge
            ? defaultStatusTone(driver)
            : undefined),
      driver,
    }));
  }, [
    getBadge,
    getBadgeTone,
    getHint,
    highlightDriverId,
    selectionContext,
    selectedDriver.data,
    showStatusBadge,
    tripChoices.data,
    drivers.data,
  ]);

  const activeQuery = selectionContext === "default" ? drivers : tripChoices;

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
        (activeQuery.isLoading ? "Loading drivers..." : "No drivers found")
      }
      disabled={disabled}
      searchValue={search}
      onSearchChange={setSearch}
      onValueChange={(value) => {
        const choice = options.find(
          (option) => option.value === value,
        )?.tripChoice;
        if (choice) onTripChoiceSelect?.(choice);
      }}
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
