"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  IconSearch,
  IconArrowUpRight,
  IconTruck,
  IconFilter,
  IconX,
} from "@tabler/icons-react";

import { ewbApi } from "./ewaybill.service";
import { ewbKeys } from "./ewaybill.keys";
import { StatusBadge } from "./components/StatusBadge";
import { ExpiryCountdown } from "./components/ExpiryCountdown";
import { Input } from "@skerp/ui/components/input";
import { Button } from "@skerp/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import type { EwbListFilters, EwbStatus, EwayBill } from "./types";

const STATUS_OPTIONS: EwbStatus[] = [
  "ACTIVE",
  "PART_B_PENDING",
  "IN_TRANSIT",
  "DELIVERED",
  "EXPIRED",
];

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default function EwaybillInbox() {
  const params = useSearchParams();
  const initialStatus = params.get("status") as EwbStatus | null;
  const initialFromState = params.get("fromState") ?? "";

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<EwbStatus | "ALL">(
    initialStatus ?? "ALL"
  );
  const [fromState, setFromState] = React.useState(initialFromState);

  const filters: EwbListFilters = React.useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status !== "ALL" ? { status } : {}),
      ...(fromState ? { fromState } : {}),
    }),
    [search, status, fromState]
  );

  const list = useQuery({
    queryKey: ewbKeys.list(filters),
    queryFn: () => ewbApi.list(filters),
    refetchInterval: 30_000,
  });

  const rows = list.data ?? [];
  const hasActiveFilter = status !== "ALL" || !!fromState || !!search;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            E-way bills assigned to you for transportation
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{rows.length}</span> result
          {rows.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border bg-card p-3">
        <div className="relative flex-1 min-w-[240px]">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="EWB no, vehicle, GSTIN, doc no, party…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as EwbStatus | "ALL")}
        >
          <SelectTrigger className="w-[170px]">
            <IconFilter className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="From state code"
          value={fromState}
          onChange={(e) => setFromState(e.target.value)}
          className="w-[140px]"
        />

        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatus("ALL");
              setFromState("");
            }}
          >
            <IconX className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>EWB</Th>
              <Th>Status</Th>
              <Th>Route</Th>
              <Th>Vehicle</Th>
              <Th className="text-right">Value</Th>
              <Th>Expiry</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {list.isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={7} className="p-3">
                      <div className="h-6 animate-pulse bg-muted/40" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => <Row key={row.ewbNo} row={row} />)}

            {!list.isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  No e-way bills match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ row }: { row: EwayBill }) {
  return (
    <tr className="border-t border-border transition-colors hover:bg-muted/40">
      <Td>
        <div className="flex flex-col">
          <Link
            href={`/ewaybills/${row.ewbNo}`}
            className="font-mono text-sm font-medium text-primary hover:underline"
          >
            {row.ewbNo}
          </Link>
          <span className="text-[11px] text-muted-foreground">
            {row.docType} · {row.docNo}
          </span>
        </div>
      </Td>
      <Td>
        <StatusBadge status={row.status} />
      </Td>
      <Td>
        <div className="flex min-w-0 max-w-[280px] flex-col">
          <span className="truncate text-sm">
            {row.fromPlace} → {row.toPlace}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {row.fromTrdName} → {row.toTrdName}
          </span>
        </div>
      </Td>
      <Td>
        {row.vehicleNo ? (
          <span className="inline-flex items-center gap-1 font-mono text-xs">
            <IconTruck className="size-3.5 text-muted-foreground" />
            {row.vehicleNo}
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground">
            Awaiting Part-B
          </span>
        )}
      </Td>
      <Td className="text-right font-mono text-xs tabular-nums">
        {fmtINR(row.totInvValue)}
      </Td>
      <Td>
        <ExpiryCountdown validUntil={row.validUntil} />
      </Td>
      <Td className="w-[40px]">
        <Link
          href={`/ewaybills/${row.ewbNo}`}
          className="inline-flex size-7 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <IconArrowUpRight className="size-4" />
        </Link>
      </Td>
    </tr>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={
        "px-3 py-2 font-medium " + (className ?? "")
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={"px-3 py-2 align-middle " + (className ?? "")}>
      {children}
    </td>
  );
}
