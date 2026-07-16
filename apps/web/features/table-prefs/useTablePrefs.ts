"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { VisibilityState } from "@tanstack/react-table";
import type { TablePrefData } from "@skerp/types";

import { tablePrefApi, tablePrefKeys } from "./table-prefs.service";

/**
 * A stored order may predate columns added later (or hold junk) — keep the
 * known ids in their saved order and append anything new at the end.
 */
const sanitizeOrder = (stored: unknown, known: readonly string[]): string[] => {
  const valid = Array.isArray(stored)
    ? stored.filter(
        (id): id is string => typeof id === "string" && known.includes(id),
      )
    : [];
  return [...valid, ...known.filter((id) => !valid.includes(id))];
};

const SAVE_DEBOUNCE_MS = 800;

/**
 * Per-user table layout (column order + visibility), persisted server-side
 * under `tableKey` so it follows the account across devices. Renders the
 * default layout until the saved one loads; changes are debounce-saved.
 */
export function useTablePrefs(
  tableKey: string,
  defaultOrder: readonly string[],
) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>([
    ...defaultOrder,
  ]);
  const hydrated = React.useRef(false);
  const lastSaved = React.useRef<string | null>(null);

  const pref = useQuery({
    queryKey: tablePrefKeys.pref(tableKey),
    queryFn: () => tablePrefApi.get(tableKey),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (hydrated.current || pref.data === undefined) return;
    const visibility = pref.data?.visibility ?? {};
    const order = sanitizeOrder(pref.data?.order, defaultOrder);
    setColumnVisibility(visibility);
    setColumnOrder(order);
    lastSaved.current = JSON.stringify({ order, visibility });
    hydrated.current = true;
  }, [pref.data, defaultOrder]);

  const save = useMutation({
    mutationFn: (prefs: TablePrefData) => tablePrefApi.save(tableKey, prefs),
  });
  const saveRef = React.useRef(save.mutate);
  saveRef.current = save.mutate;

  React.useEffect(() => {
    if (!hydrated.current) return;
    const snapshot = JSON.stringify({
      order: columnOrder,
      visibility: columnVisibility,
    });
    if (snapshot === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = snapshot;
      saveRef.current({ order: columnOrder, visibility: columnVisibility });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [columnOrder, columnVisibility]);

  return { columnVisibility, setColumnVisibility, columnOrder, setColumnOrder };
}
