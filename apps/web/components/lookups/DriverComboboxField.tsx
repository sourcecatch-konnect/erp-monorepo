"use client";

import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FieldValues, Path, useFormContext } from "react-hook-form";
import type { Driver } from "@skerp/types";
import type { ComboboxOption } from "@skerp/ui/components/combobox";

import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { driverApi } from "@/features/masters/driver/driver.service";
import { driverKeys } from "@/features/masters/driver/driver.key";

const PAGE_SIZE = 20;

export type DriverComboboxOption = ComboboxOption & {
  driver: Driver;
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
  showStatusBadge?: boolean;
  getBadge?: (driver: Driver) => string | undefined;
  getBadgeTone?: (driver: Driver) => BadgeTone | undefined;
  getHint?: (driver: Driver) => string | undefined;
  highlightDriverId?: string;
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

export default function DriverComboboxField<TFormValues extends FieldValues>({
  name,
  label = "Driver",
  placeholder,
  searchPlaceholder,
  emptyText,
  required,
  disabled,
  showStatusBadge = true,
  getBadge,
  getBadgeTone,
  getHint,
  highlightDriverId,
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
    enabled: !disabled,
  });

  const selectedDriver = useQuery({
    queryKey: driverKeys.detail(selectedId ?? ""),
    queryFn: () => driverApi.detail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const options = React.useMemo<DriverComboboxOption[]>(() => {
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
    selectedDriver.data,
    showStatusBadge,
    drivers.data,
  ]);

  return (
    <ComboboxField<TFormValues>
      name={name}
      label={label}
      required={required}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={
        emptyText ?? (drivers.isLoading ? "Loading drivers..." : "No drivers found")
      }
      disabled={disabled}
      searchValue={search}
      onSearchChange={setSearch}
      hasMore={Boolean(drivers.hasNextPage)}
      isLoadingMore={drivers.isFetchingNextPage}
      onScrollEnd={() => {
        if (drivers.hasNextPage && !drivers.isFetchingNextPage) {
          drivers.fetchNextPage();
        }
      }}
    />
  );
}
