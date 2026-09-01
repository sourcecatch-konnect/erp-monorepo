// features/masters/_shared/fields/CitySelectField.tsx
"use client";

import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FieldValues, Path, PathValue, useFormContext } from "react-hook-form";

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
      filter: stateId ? { stateId } : undefined,
    }),
    queryFn: ({ pageParam = 0 }) =>
      cityApi.list({
        page: pageParam,
        size: PAGE_SIZE,
        search: debouncedSearch,
        sort: "name:asc",
        ...(stateId ? { filter: { stateId } } : {}),
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

  const listedCities = React.useMemo(
    () => cities.data?.pages.flatMap((page) => page.data) ?? [],
    [cities.data],
  );

  const initialCityMatchesValue = Boolean(
    initialCity &&
    (valueMode === "name"
      ? initialCity.name === value
      : initialCity.id === value),
  );

  const listContainsValue = listedCities.some((city) =>
    valueMode === "name" ? city.name === value : city.id === value,
  );

  // A paginated city list does not guarantee that the saved city is on the
  // first page. Resolve the current id directly so edit forms work on their
  // first open even when the parent row omitted its city relation.
  const selectedCityQuery = useQuery({
    queryKey: cityKeys.detail(value ?? ""),
    queryFn: () => cityApi.detail(value!),
    enabled:
      valueMode === "id" &&
      Boolean(value) &&
      !initialCityMatchesValue &&
      !listContainsValue,
  });

  const cityOptions = React.useMemo(() => {
    const selectedFallback = initialCityMatchesValue
      ? initialCity
      : selectedCityQuery.data;

    if (
      selectedFallback &&
      !listedCities.some((city) => city.id === selectedFallback.id)
    ) {
      return [selectedFallback, ...listedCities];
    }

    return listedCities;
  }, [
    initialCity,
    initialCityMatchesValue,
    listedCities,
    selectedCityQuery.data,
  ]);

  const options = cityOptions.map((city) => ({
    label: city.name,
    value: city.id,
  }));

  const selectedCity =
    cityOptions.find((city) =>
      valueMode === "name" ? city.name === value : city.id === value,
    ) ?? null;

  const errorMessage = errors[name]?.message as string | undefined;

  // Notify the parent only when the resolved city *id* actually changes (e.g.
  // an edit form's saved id resolving async on first open). Firing on every
  // `selectedCity` object-identity change lets a parent that calls setState in
  // its handler spin into "Maximum update depth exceeded".
  const lastNotifiedCityIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const nextId = selectedCity?.id ?? null;
    if (lastNotifiedCityIdRef.current === nextId) return;
    lastNotifiedCityIdRef.current = nextId;
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
        emptyText={
          cities.isLoading || selectedCityQuery.isLoading
            ? "Loading cities..."
            : emptyText
        }
        disabled={disabled}
        invalid={!!errorMessage}
        searchValue={search}
        onSearchChange={setSearch}
        hasMore={!!cities.hasNextPage}
        isLoadingMore={cities.isFetchingNextPage}
        onChange={(cityId) => {
          const city = cityOptions.find((item) => item.id === cityId) ?? null;

          setValue(
            name,
            (valueMode === "name" ? (city?.name ?? "") : cityId) as PathValue<
              T,
              Path<T>
            >,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );

          lastNotifiedCityIdRef.current = city?.id ?? null;
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
