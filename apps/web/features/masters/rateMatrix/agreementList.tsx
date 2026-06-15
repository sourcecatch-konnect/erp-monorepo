"use client";

import * as React from "react";
import {
    IconBuilding,
    IconCalendarCheck,
  IconCalendarEvent,
  IconDownload,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconUpload,
  IconUser,
} from "@tabler/icons-react";

import type { AgreementWithRelations } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@skerp/ui/components/accordion";

import AgreementRateMatrixExpanded from "./Agreements(Company)/agreementRateMatrixEpanded";

type Option = {
  id: string;
  name: string;
};

type Props = {
  agreements: AgreementWithRelations[];
  isLoading: boolean;

  search: string;
  onSearchChange: (value: string) => void;

  page: number;
  size: number;
  total: number;
  onPageChange: (page: number) => void;

  routes: Option[];
  vehicleTypes: any[];
  rateUnits: any[];

  onAdd: () => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
  onSizeChange: (size: number) => void;
  isImporting?: boolean;
  isExporting?: boolean;
};

function display(value?: string | null) {
  return value?.trim() || "-";
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function AgreementRateMatrixAccordionList({
  agreements,
  isLoading,
  search,
  onSearchChange,
  page,
  size,
  total,
  onPageChange,
  onSizeChange,
  routes,
  vehicleTypes,
  rateUnits,
  onAdd,
  onImport,
  onExport,
  isImporting,
  isExporting,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / size));
  const canGoPrev = page > 0;
  const canGoNext = page + 1 < totalPages;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Rate Matrix
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage agreement-wise freight rates, routes, vehicle types and
              units.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={onAdd}>
              <IconPlus size={16} />
              Add Rate
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isImporting}
              onClick={() => inputRef.current?.click()}
            >
              <IconUpload size={16} />
              Import
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isExporting}
              onClick={onExport}
            >
              <IconDownload size={16} />
              Export
            </Button>

            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];

                if (!file) return;

                await onImport(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4 max-w-md">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />

          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search agreement, company, client..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Accordion List */}
      {/* Agreement List */}
<div className="space-y-3">
 <div className="flex items-center justify-between">
  <div>
    <h2 className="text-sm font-semibold text-foreground">
      Agreement List
    </h2>
    <p className="text-xs text-muted-foreground">
      Open an agreement to manage its route-wise rate matrix.
    </p>
  </div>

<div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
  <span>
    {total} agreement{total === 1 ? "" : "s"}
  </span>
</div>
</div>

  {isLoading ? (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>
    </div>
  ) : agreements.length === 0 ? (
    <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
      <p className="text-sm font-medium">No agreements found</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Try changing your search or add a new rate matrix.
      </p>
    </div>
  ) : (
    <Accordion type="multiple" className="space-y-3">
      {agreements.map((agreement) => {
        const companyName = agreement.company?.name;
        const clientName = agreement.client?.name;
        const cityName = agreement.city?.name;

        return (
 <AccordionItem
  key={agreement.id}
  value={agreement.id}
  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md "
>
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex w-full flex-col gap-2 pr-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 text-left">
  {/* Main company/client line */}
  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
      <IconBuilding size={14} className="shrink-0 text-muted-foreground" />
      <span className="max-w-[220px] truncate">
        {display(companyName)}
      </span>
    </span>

    <span className="text-xs font-medium text-muted-foreground">→</span>

    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
      <IconUser size={14} className="shrink-0 text-muted-foreground" />
      <span className="max-w-[220px] truncate">
        {display(clientName)}
      </span>
    </span>
  </div>

  {/* Meta info - separated cleanly */}
 <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
  <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <IconMapPin size={13} className="shrink-0" />
    <span className="font-medium">City:</span>
    <span>{display(cityName)}</span>
  </div>

  <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <IconCalendarEvent size={13} className="shrink-0" />
    <span className="font-medium">Agreement:</span>
    <span>{formatDate(agreement.agreementDate)}</span>
  </div>

  <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <IconCalendarCheck size={13} className="shrink-0" />
    <span className="font-medium">Expiry:</span>
    <span>{formatDate(agreement.expiryDate)}</span>
  </div>
</div>
</div>

   <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
  <IconCalendarCheck size={14} className="shrink-0" />
  <span>Starts</span>
  <span className="font-semibold text-foreground">
    {formatDate(agreement.startDate)}
  </span>
</div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="border-t bg-background p-0">
  <AgreementRateMatrixExpanded
    agreement={agreement}
    routes={routes}
    vehicleTypes={vehicleTypes}
    rateUnits={rateUnits}
  />
</AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  )}
</div>

      <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm">
  <div className="text-muted-foreground">
    Page <span className="font-medium text-foreground">{page + 1}</span>{" "}
    of <span className="font-medium text-foreground">{totalPages}</span>
  </div>

  <div className="flex items-center gap-3">
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Rows</span>

      <select
        value={size}
        onChange={(event) => {
          onSizeChange(Number(event.target.value));
          onPageChange(0);
        }}
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={30}>30</option>
      </select>
    </div>

    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!canGoPrev}
      onClick={() => onPageChange(page - 1)}
    >
      Previous
    </Button>

    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!canGoNext}
      onClick={() => onPageChange(page + 1)}
    >
      Next
    </Button>
  </div>
</div>
    </div>
  );
}