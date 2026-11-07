"use client";

import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import type { ChallanAck } from "./ack.service";

/**
 * The broker's claim on a delivery challan, as staff transcribed it.
 *
 * This was once a side-by-side of the supervisor's account against the
 * broker's, with every disagreement called out — the fraud control described
 * in CONTEXT.md §5.2. The supervisor acknowledgement was dropped on
 * 2026-11-07: he is a `Labour` record with no ERP login, so both columns
 * were always typed by the same staff. What remains is the broker's claim,
 * the Labour supervisor's name for context, and the slab ceiling applied on
 * the payment slip, which pays the lower of claim and slab.
 */

const CLAIM_ROWS = [
  { key: "reportingDate", label: "Reporting date", kind: "date" },
  { key: "unloadingDate", label: "Unloading date", kind: "date" },
  { key: "collectionDate", label: "Collection date", kind: "date" },
  { key: "claimedDetentionDays", label: "Detention days", kind: "count" },
  { key: "claimedDetentionPaise", label: "Detention amount", kind: "money" },
  { key: "parkingPaise", label: "Parking", kind: "money" },
  { key: "labourPaise", label: "Labour", kind: "money" },
  { key: "otherPaise", label: "Other expenses", kind: "money" },
  { key: "damagePaise", label: "Damage", kind: "money" },
] as const;

const rupees = (paise: string) =>
  `₹${(Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const dash = <span className="text-muted-foreground">—</span>;

const show = (kind: "date" | "money" | "count", raw: string | number | null) => {
  if (raw === null || raw === undefined) return dash;
  if (kind === "money") return rupees(String(raw));
  if (kind === "date") return day(String(raw));
  return String(raw);
};

export function ChallanAckComparison({
  broker,
  supervisor,
}: {
  broker: ChallanAck | null;
  /** The Labour supervisor who ran the unloading — context, not a claim. */
  supervisor: { id: string; name: string } | null;
}) {
  if (!broker)
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          The broker&apos;s claim has not been entered for this challan yet.
        </p>
        {supervisor ? (
          <p className="text-xs text-muted-foreground">
            Unloading supervisor: {supervisor.name}
          </p>
        ) : null}
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Broker&apos;s claim</p>
          <p className="text-xs text-muted-foreground">
            Entered by{" "}
            {broker.filedBy
              ? `${broker.filedBy.firstName} ${broker.filedBy.lastName}`
              : "—"}{" "}
            · {day(broker.filedAt)}
          </p>
        </div>
        {supervisor ? (
          <p className="text-xs text-muted-foreground">
            Unloading supervisor: {supervisor.name}
          </p>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Head</TableHead>
            <TableHead className="text-right">Claimed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CLAIM_ROWS.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {show(row.kind, broker[row.key])}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>Shortage (qty)</TableCell>
            <TableCell className="text-right tabular-nums">
              {broker.totalShortageQty}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Damaged (qty)</TableCell>
            <TableCell className="text-right tabular-nums">
              {broker.totalDamageQty}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {broker.remarks ? (
        <p className="text-xs text-muted-foreground">
          Remarks: {broker.remarks}
        </p>
      ) : null}
    </div>
  );
}
