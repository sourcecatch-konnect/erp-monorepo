// features/masters/_shared/fields/CitySelectField.tsx
"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FieldValues, Path, useFormContext } from "react-hook-form";

import { Combobox } from "@skerp/ui/components/combobox";
import type { City } from "@skerp/types";

import { cityApi } from "../../city/city.service";
import { cityKeys } from "../../city/city.keys";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

type CityOption = Pick<City, "id" | "name">;

type Props<T extends FieldValues> = {
  name: Path<T>;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  initialCity?: CityOption | null;
  stateId?: string;
valueMode?: "id" | "name";
  onCityChange?: (city: CityOption | null) => void;
};

const PAGE_SIZE = 10;

export default function CitySelectField<T extends FieldValues>({
  name,
  label = "City",
  required = false,
  disabled = false,
  placeholder = "Select city",
  searchPlaceholder = "Search city...",
  emptyText = "No cities found",
  initialCity,
  onCityChange,
  stateId,
valueMode = "id",
}: Props<T>) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<T>();

  const value = watch(name) as string | undefined;

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

const cities = useInfiniteQuery({
  queryKey: cityKeys.list({
    search: debouncedSearch,
    size: PAGE_SIZE,
    sort: "name:asc",
    stateId,
  } as any),
  queryFn: ({ pageParam = 0 }) =>
    cityApi.list({
      page: pageParam,
      size: PAGE_SIZE,
      search: debouncedSearch,
      sort: "name:asc",
      ...(stateId ? { stateId } : {}),
    } as any),
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

const cityOptions = React.useMemo(() => {
  const list = cities.data?.pages.flatMap((page) => page.data) ?? [];

  if (!initialCity) return list;

  const hasInitialCity = list.some((city) =>
    valueMode === "name"
      ? city.name.toLowerCase() === initialCity.name.toLowerCase()
      : city.id === initialCity.id
  );

  const isCurrentValue =
    valueMode === "name"
      ? value === initialCity.name
      : value === initialCity.id;

  if (isCurrentValue && !hasInitialCity) {
    return [initialCity, ...list];
  }

  return list;
}, [cities.data, initialCity, value, valueMode]);

  const options = cityOptions.map((city) => ({
    label: city.name,
    value: city.id,
  }));

  const selectedCity =
  cityOptions.find((city) =>
    valueMode === "name" ? city.name === value : city.id === value
  ) ?? null;

  const errorMessage = errors[name]?.message as string | undefined;

  React.useEffect(() => {
    onCityChange?.(selectedCity);
  }, [selectedCity, onCityChange]);

  return (
    <div className="space-y-2">
      {label ? (
        <label className="text-sm font-medium">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </label>
      ) : null}

     <Combobox
  value={selectedCity?.id ?? ""}
  options={options}
  placeholder={placeholder}
  searchPlaceholder={searchPlaceholder}
  emptyText={cities.isLoading ? "Loading cities..." : emptyText}
  disabled={disabled}
  invalid={!!errorMessage}
  searchValue={search}
  onSearchChange={setSearch}
  hasMore={!!cities.hasNextPage}
  isLoadingMore={cities.isFetchingNextPage}
  onChange={(cityId) => {
  const city = cityOptions.find((item) => item.id === cityId) ?? null;

  setValue(name, (valueMode === "name" ? city?.name ?? "" : cityId) as any, {
    shouldDirty: true,
    shouldValidate: true,
  });

  onCityChange?.(city);
}}
  onScrollEnd={() => {
    if (cities.hasNextPage && !cities.isFetchingNextPage) {
      cities.fetchNextPage();
    }
  }}
/>

      {errorMessage ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}