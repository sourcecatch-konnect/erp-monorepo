"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { RateMatrix, CreateRateMatrixBody } from "@skerp/types";
import type { AgreementWithRelations } from "@skerp/types";
import { agreementColumns } from "../Agreements/agreementsTable";
import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { rateMatrixApi } from "./rateMatrix.service";
import { rateMatrixKeys } from "./rateMatrix.key";
import { rateMatrixColumns } from "./rateMatrixTable";

import RateMatrixForm from "./rateMatrixForm";
import RateMatrixDetailDialog from "./rateMatrixDialog";

import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

import { agreementApi } from "../Agreements/agreements.service";
import { routeApi } from "../routes/routes.service";
import { vehicleTypeApi } from "../vehicleType/vehicleType.service";
import { agreementKeys } from "../Agreements/agreements.key";
import AgreementRateMatrixExpanded from "./Agreements(Company)/agreementRateMatrixEpanded";
import AgreementRateMatrixAccordionList from "./agreementList";

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
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);

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

const agreementOptions = useQuery({
  queryKey: agreementKeys.list({
    page: 0,
    size: 1000,
    sort: "createdAt:desc",
  }),
  queryFn: () =>
    agreementApi.list({
      page: 0,
      size: 1000,
      sort: "createdAt:desc",
    }),
});

const vehicleTypes = useQuery({
  queryKey: ["vehicleTypes"],
  queryFn: () => vehicleTypeApi.list(),
});

const rateUnits = useQuery({
  queryKey: ["rateMatrix", "units"],
  queryFn: () => rateMatrixApi.units.list(),
});

const routes = useQuery({
  queryKey: ["routes"],
  queryFn: () => routeApi.list(),
});



React.useEffect(() => {
  setPage(0);
}, [debouncedSearch, size]);

  /* ================= LIST ================= */
 

  /* ================= DETAIL ================= */
  const rateMatrixDetail = useQuery({
    queryKey: detailId
      ? rateMatrixKeys.detail(detailId)
      : ["rateMatrix-detail-empty"],
    queryFn: () => rateMatrixApi.detail(detailId as string),
    enabled: Boolean(detailOpen && detailId),
  });

  /* ================= MASTER DATA ================= */


  /* ================= MUTATIONS ================= */
  const { create, update, remove } = useMasterMutations({
    api: rateMatrixApi,
    queryKey: rateMatrixKeys.all,
    entityName: "Rate Matrix",
    
  });

  const bulkDeleteMutation = React.useMemo(
    () => ({
      mutateAsync: async (ids: string[]) => {
        await rateMatrixApi.bulkRemove(ids);
        queryClient.invalidateQueries({ queryKey: rateMatrixKeys.all });
        setSelectedIds([]);
      },
      isPending: false,
    }),
    [queryClient]
  );

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
  const handleSubmit = async (data: CreateRateMatrixBody) => {
    if (selected) {
      await update.mutateAsync({ id: selected.id, data });
    } else {
      await create.mutateAsync(data);
    }

    setOpen(false);
    setSelected(null);
  };

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
      routes={(routes.data?.data ?? []).map((r) => ({
        id: r.id,
        name: `${r.sourceCity?.name ?? "-"} to ${
          r.destinationCity?.name ?? "-"
        }`,
      }))}
      vehicleTypes={vehicleTypes.data?.data ?? []}
      rateUnits={rateUnits.data?.data ?? []}
    />

    <RateMatrixDetailDialog
      open={detailOpen}
      onOpenChange={setDetailOpen}
      data={rateMatrixDetail.data}
      isLoading={rateMatrixDetail.isLoading}
    />

    <RateMatrixForm
      open={open}
      onOpenChange={setOpen}
      row={selected}
      onSubmit={handleSubmit}
      isSubmitting={create.isPending || update.isPending}
      agreements={(
        (agreementOptions.data?.data ?? []) as AgreementWithRelations[]
      ).map((a) => ({
        id: a.id,
        name: `${a.company?.name ?? "-"} - ${a.client?.name ?? "-"}`,
      }))}
      routes={
        routes.data?.data.map((r) => ({
          id: r.id,
          name: `${r.sourceCity?.name ?? "-"} to ${
            r.destinationCity?.name ?? "-"
          }`,
        })) ?? []
      }
      vehicleTypes={vehicleTypes.data?.data ?? []}
      rateUnits={rateUnits.data?.data ?? []}
    />
  </>
);
}