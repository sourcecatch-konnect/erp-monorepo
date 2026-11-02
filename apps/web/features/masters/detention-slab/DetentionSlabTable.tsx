"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { DetentionSlab } from "@skerp/types";

import { formatDate } from "@/lib/format";
import { formatCurrencyFromPaise } from "../_shared/dialog-parts";
import { StatusPill } from "../_shared/StatusPill";

const unitWord = (slab: DetentionSlab) =>
  slab.basis === "DAY" ? "Day" : "Block";

/** "Days 1–2 ₹1,000 · Day 3+ ₹1,500" — the tiers as the business says them. */
export const describeBands = (slab: DetentionSlab) =>
  slab.bands
    .map((band) => {
      const unit = unitWord(slab);
      const range =
        band.toUnit === null
          ? `${unit} ${band.fromUnit}+`
          : band.toUnit === band.fromUnit
            ? `${unit} ${band.fromUnit}`
            : `${unit}s ${band.fromUnit}–${band.toUnit}`;
      return `${range} ${formatCurrencyFromPaise(band.ratePaise)}`;
    })
    .join(" · ");

/** "First & last day free" / "24h free, per 24h". */
export const describeRule = (slab: DetentionSlab) => {
  if (slab.basis === "HOUR") {
    return `${slab.freeHours ?? 0}h free, per ${slab.blockHours ?? "—"}h`;
  }
  if (slab.firstDayFree && slab.lastDayFree) return "First & last day free";
  if (slab.firstDayFree) return "First day free";
  if (slab.lastDayFree) return "Last day free";
  return "No free days";
};

const appliesTo = (slab: DetentionSlab) => {
  const parts = [
    slab.transport?.name,
    slab.vehicleType?.name,
    slab.customer?.name,
  ].filter(Boolean);
  if (slab.freightFromPaise !== null || slab.freightToPaise !== null) {
    parts.push(
      `Freight ${formatCurrencyFromPaise(slab.freightFromPaise)} – ${formatCurrencyFromPaise(slab.freightToPaise)}`,
    );
  }
  return parts.length ? parts.join(" · ") : "Any broker, any vehicle";
};

export const detentionSlabColumns: ColumnDef<DetentionSlab>[] = [
  {
    accessorKey: "name",
    header: "Slab",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">
          {appliesTo(row.original)}
        </span>
      </div>
    ),
  },
  {
    id: "rule",
    header: "Rule",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.basis === "DAY" ? "Day-wise" : "Hour-wise"}</span>
        <span className="text-xs text-muted-foreground">
          {describeRule(row.original)}
        </span>
      </div>
    ),
  },
  {
    id: "rates",
    header: "Rates",
    cell: ({ row }) => (
      <span className="text-sm">{describeBands(row.original)}</span>
    ),
  },
  {
    accessorKey: "priority",
    header: "Priority",
  },
  {
    accessorKey: "effectiveFrom",
    header: "Effective",
    cell: ({ row }) =>
      `${formatDate(row.original.effectiveFrom)} – ${
        row.original.effectiveTo ? formatDate(row.original.effectiveTo) : "open"
      }`,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) =>
      row.original.isActive ? (
        <StatusPill tone="emerald" label="Active" />
      ) : (
        <StatusPill tone="slate" label="Inactive" />
      ),
  },
];
