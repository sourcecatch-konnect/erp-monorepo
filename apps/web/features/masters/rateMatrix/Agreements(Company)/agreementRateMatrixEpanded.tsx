"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@skerp/ui/components/tooltip";
import type {
  AgreementWithRelations,
  CreateRateMatrixBody,
  RateMatrixWithRelations,
  RateUnit,
  VehicleType,
} from "@skerp/types";
import {
  IconClock,
  IconRoute,
  IconTruck,
  IconPackage,
  IconFileText,
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
} from "@tabler/icons-react";

import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { rateMatrixKeys } from "../rateMatrix.key";
import { rateMatrixApi } from "../rateMatrix.service";
import { formatCurrencyFromPaise } from "../../_shared/dialog-parts";
import type { ListQuery } from "../../_shared/master-api";
import { toast } from "sonner";
import { Button } from "@skerp/ui/components/button";
import RateMatrixDetailDialog from "../rateMatrixDialog";
import RateMatrixForm from "../rateMatrixForm";
import { routeApi } from "../../routes/routes.service";
import { vehicleTypeApi } from "../../vehicleType/vehicleType.service";

type Props = {
  agreement: AgreementWithRelations;
};
export default function AgreementRateMatrixExpanded({
  agreement,

}: Props) {

  const query = useQuery({
    queryKey: rateMatrixKeys.byAgreement(agreement.id),
    queryFn: () =>
      rateMatrixApi.list({
        page: 0,
        size: 10,
        sort: "rate:asc",
        filter: {
          agreementId: agreement.id,
        },
      } as ListQuery),
    enabled: Boolean(agreement.id),
  });

  const rows = (query.data?.data ?? []) as RateMatrixWithRelations[];
const queryClient = useQueryClient();

const [formOpen, setFormOpen] = React.useState(false);
const [selectedRate, setSelectedRate] =
  React.useState<RateMatrixWithRelations | null>(null);

const rateQueryKey = rateMatrixKeys.byAgreement(agreement.id);
const [detailOpen, setDetailOpen] = React.useState(false);
const refreshRates = () => {
  queryClient.invalidateQueries({
    queryKey: rateQueryKey,
  });
};

const openCreate = () => {
  setSelectedRate(null);
  setFormOpen(true);
};

const openEdit = (rate: RateMatrixWithRelations) => {
  setSelectedRate(rate);
  setFormOpen(true);
};
const openDetail = (rate: RateMatrixWithRelations) => {
  setSelectedRate(rate);
  setDetailOpen(true);
};
const saveMutation = useMutation({
  mutationFn: async (values: CreateRateMatrixBody) => {
    const body: CreateRateMatrixBody = {
      ...values,
      agreementId: agreement.id,
    };

    if (selectedRate) {
      return rateMatrixApi.update(selectedRate.id, body);
    }

    return rateMatrixApi.create(body);
  },

  onSuccess: () => {
    toast.success(
      selectedRate ? "Rate matrix updated" : "Rate matrix added"
    );

    refreshRates();
    setFormOpen(false);
    setSelectedRate(null);
  },

  onError: (error) => {
    toast.error(
      error instanceof Error ? error.message : "Failed to save rate matrix"
    );
  },
});
const deleteMutation = useMutation({
  mutationFn: (id: string) => rateMatrixApi.remove(id),
  onSuccess: () => {
    toast.success("Rate matrix deleted");
    refreshRates();
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "Failed to delete rate matrix");
  },
});

const handleDelete = (rate: RateMatrixWithRelations) => {
  if (!window.confirm("Delete this rate matrix?")) return;
  deleteMutation.mutate(rate.id);
};
 return (
  <TooltipProvider delayDuration={200}>
    <div className="bg-muted/10">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            Rate Matrix
          </p>
{!query.isLoading && rows.length > 0 ? (
  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
    <span>
      {rows.length} rate{rows.length === 1 ? "" : "s"}
    </span>
  </span>
) : null}
        </div>

        <Button size="sm" onClick={openCreate} className="h-8 gap-1.5">
          <IconPlus size={14} />
          Add Rate
        </Button>
      </div>

      {query.isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : rows.length === 0 ? (
        <div className="m-4 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">
            No rate matrix found
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add route-wise rate details for this agreement.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-9 w-[190px] text-xs font-semibold uppercase text-muted-foreground">
                  Route
                </TableHead>

                <TableHead className="h-9 w-[150px] text-xs font-semibold uppercase text-muted-foreground">
                  Vehicle
                </TableHead>

                <TableHead className="h-9 w-[90px] text-xs font-semibold uppercase text-muted-foreground">
                  Unit
                </TableHead>

                <TableHead className="h-9 w-[110px] text-xs font-semibold uppercase text-muted-foreground">
                  Transport
                </TableHead>

                <TableHead className="h-9 w-[120px] text-right text-xs font-semibold uppercase text-muted-foreground">
                  Rate
                </TableHead>

                <TableHead className="h-9 w-[90px] text-xs font-semibold uppercase text-muted-foreground">
                  Transit
                </TableHead>

                <TableHead className="h-9 w-[130px] text-xs font-semibold uppercase text-muted-foreground">
                  Remarks
                </TableHead>

                <TableHead className="h-9 w-[110px] text-right text-xs font-semibold uppercase text-muted-foreground">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((rate) => {
                const sourceCity = rate.route?.sourceCity?.name ?? "-";
                const destinationCity =
                  rate.route?.destinationCity?.name ?? "-";

                const vehicleTypeName = rate.vehicleType?.name ?? "-";

                const unitName = rate.unit
                  ? `${rate.unit.unitValue} ${rate.unit.unitType}`
                  : "-";

                const transportName =
                  rate.transportType === "RAIL_ROAD"
                    ? "Rail + Road"
                    : "Road";

                return (
                  <TableRow
                    key={rate.id}
                    className="group bg-background hover:bg-muted/30"
                  >
                    <TableCell className="h-11">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                          <IconRoute size={14} />
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <span className="max-w-[70px] truncate">
                              {sourceCity}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="max-w-[70px] truncate">
                              {destinationCity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="h-11">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                          <IconTruck size={14} />
                        </span>

                        <span className="max-w-[110px] truncate text-sm font-medium">
                          {vehicleTypeName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="h-11">
                      <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs font-medium">
                        <IconPackage size={12} />
                        {unitName}
                      </span>
                    </TableCell>

                    <TableCell className="h-11">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {transportName}
                      </span>
                    </TableCell>

                    <TableCell className="h-11 text-right">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrencyFromPaise(rate.rate)}
                      </span>
                    </TableCell>

                    <TableCell className="h-11">
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        <IconClock size={12} />
                        {rate.transitDays ? `${rate.transitDays} days` : "-"}
                      </span>
                    </TableCell>

                    <TableCell className="h-11">
                      <RemarkCell value={rate.remarks} />
                    </TableCell>

                    <TableCell className="h-11 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openDetail(rate)}
                        >
                          <IconEye size={15} />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(rate)}
                        >
                          <IconEdit size={15} />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(rate)}
                        >
                          <IconTrash size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>

  <RateMatrixDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  id={selectedRate?.id}
/>

   <RateMatrixForm
  open={formOpen}
  onOpenChange={setFormOpen}
  row={selectedRate}
  agreementId={agreement.id}
/>
  </TooltipProvider>
);
}
function RemarkCell({ value }: { value?: string | null }) {
  const text = value?.trim();

  if (!text) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconFileText size={13} className="shrink-0" />
        <span className="text-sm">-</span>
      </div>
    );
  }

  const LIMIT = 18;
  const isLong = text.length > LIMIT;
  const displayText = isLong ? `${text.slice(0, LIMIT)}...` : text;

  const content = (
    <div className="flex max-w-[130px] items-center gap-2 text-muted-foreground">
      <IconFileText size={13} className="shrink-0" />
      <span
        className={[
          "truncate text-sm",
          isLong ? "cursor-help decoration-dotted underline-offset-4 hover:underline" : "",
        ].join(" ")}
      >
        {displayText}
      </span>
    </div>
  );

  if (!isLong) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>

      <TooltipContent
        side="top"
        align="start"
        sideOffset={6}
        className="max-w-[160px] whitespace-pre-wrap break-words text-left leading-relaxed"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}