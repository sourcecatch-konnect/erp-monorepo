"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { ComboboxOption } from "@skerp/ui/components/combobox";

import { unitOfMeasureKeys } from "./unitOfMeasure.key";
import { unitOfMeasureApi } from "./unitOfMeasure.service";

const unitOptionsQuery = {
  size: 50,
  sort: "name:asc",
} as const;

const toUnitOption = (unit: { code: string; name: string }): ComboboxOption => ({
  value: unit.code,
  label: unit.code,
});

export function useUnitOfMeasureOptions(enabled = true) {
  const query = useQuery({
    queryKey: unitOfMeasureKeys.list(unitOptionsQuery),
    queryFn: () => unitOfMeasureApi.list(unitOptionsQuery),
    enabled,
  });

  const options = React.useMemo(
    () =>
      (query.data?.data ?? [])
        .filter((unit) => unit.isActive)
        .map(toUnitOption),
    [query.data],
  );

  return { ...query, options };
}
