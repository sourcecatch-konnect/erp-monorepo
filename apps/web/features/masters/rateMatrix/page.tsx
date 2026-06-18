"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { RateMatrix, CreateRateMatrixBody } from "@skerp/types";
import type { AgreementWithRelations } from "@skerp/types";

import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";

import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";


import { agreementApi } from "../Agreements/agreements.service";
import { rateMatrixApi } from "./rateMatrix.service";
import { rateMatrixKeys } from "./rateMatrix.key";
import { agreementKeys } from "../Agreements/agreements.key";

import AgreementRateMatrixAccordionList from "./agreementList";
import RateMatrixForm from "./rateMatrixForm";

/* ================= CSV TYPE ================= */
type CreateRateMatrixCsvRow = {
  agreementId: string;
  routeId: string;
  vehicleTypeId?: string;
  unitId?: string;
  transportType?: "RAIL_ROAD" | "ROAD";
  rate: string;
  transitDays?: string;
  remarks?: string;
};

export default function RateMatrixPage() {
  const queryClient = useQueryClient();

  /* ================= UI STATE ================= */
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<RateMatrix | null>(null);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);

  const [size, setSize] = React.useState(10);
  const debouncedSearch = useDebouncedValue(search);
const agreementListQuery = React.useMemo<ListQuery>(() => {
  return {
    page,
    size,
    sort: "createdAt:desc",
    ...(debouncedSearch.trim()
      ? { search: debouncedSearch.trim() }
      : {}),
  };
}, [page, size, debouncedSearch]);

const rateMatrixListQuery = React.useMemo<ListQuery>(() => {
  return {
    page: 0,
    size: 1000,
    sort: "rate:asc",
  };
}, []);
/* ================= LIST ================= */
const agreements = useQuery({
  queryKey: agreementKeys.list(agreementListQuery),
  queryFn: () => agreementApi.list(agreementListQuery),
});

React.useEffect(() => {
  setPage(0);
}, [debouncedSearch, size]);





  const bulkImportMutation = React.useMemo(
    () => ({
      mutateAsync: async (rows: CreateRateMatrixBody[]) => {
        await rateMatrixApi.bulkImport(rows);
        queryClient.invalidateQueries({ queryKey: rateMatrixKeys.all });
      },
      isPending: false,
    }),
    [queryClient]
  );

  const exportMutation = React.useMemo(
    () => ({
      mutate: (query: ListQuery) => {
        rateMatrixApi.export(query).then((blob) => {
          downloadBlob(blob, "rate-matrix.csv");
        });
      },
      isPending: false,
    }),
    []
  );

  /* ================= SUBMIT ================= */
 
  /* ================= IMPORT ================= */
  const handleImport = async (file: File) => {
    const text = await file.text();

    const rows = parseCsvRows<CreateRateMatrixCsvRow>(text);

const parsedRows: CreateRateMatrixBody[] = rows.map((row) => ({
  agreementId: row.agreementId,
  routeId: row.routeId,

  vehicleTypeId: row.vehicleTypeId || undefined,
  unitId: row.unitId || undefined,

  transportType: row.transportType || "ROAD",

  rate: Number(row.rate),
  transitDays: row.transitDays ? Number(row.transitDays) : undefined,
  remarks: row.remarks || undefined,
}));

    await bulkImportMutation.mutateAsync(parsedRows);
  };

  /* ================= UI ================= */
  return (
  <>
    <AgreementRateMatrixAccordionList
      agreements={(agreements.data?.data ?? []) as AgreementWithRelations[]}
      isLoading={agreements.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={agreements.data?.meta?.total ?? 0}
      onPageChange={setPage}
      onSizeChange={setSize}
      onAdd={() => {
        setSelected(null);
        setOpen(true);
      }}
      onImport={handleImport}
      onExport={() => exportMutation.mutate(rateMatrixListQuery)}
      isImporting={bulkImportMutation.isPending}
      isExporting={exportMutation.isPending}

 
    />
<RateMatrixForm open={open} onOpenChange={setOpen} row={selected} />

  </>
);
}