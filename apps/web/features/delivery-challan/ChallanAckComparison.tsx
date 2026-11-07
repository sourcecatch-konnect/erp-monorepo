"use client";

import * as React from "react";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import type { AckMismatch, ChallanAck } from "./ack.service";

/**
 * The supervisor's account beside the broker's, with every disagreement
 * called out.
 *
 * This layout *is* the control. CONTEXT.md §5.2: the broker files their own
 * claim and it is "often inflated", so an approver has to be able to see at
 * a glance where the two accounts part company before deciding which to
 * trust. A tidier single-column summary would defeat the purpose.
 *
 * The mismatch list comes from the server — it is not recomputed here, so
 * what the approver sees cannot drift from what the comparison actually
 * found.
 */

const FIELD_LABELS: Record<string, string> = {
  reportingDate: "Reporting date",
  unloadingDate: "Unloading date",
  collectionDate: "Collection date",
  claimedDetentionDays: "Detention days",
  claimedDetentionPaise: "Detention amount",
  parkingPaise: "Parking",
  otherPaise: "Other expenses",
  labourPaise: "Labour",
  damagePaise: "Damage",
  shortageQty: "Shortage (qty)",
  damageQty: "Damaged (qty)",
};

const MONEY_FIELDS = new Set([
  "claimedDetentionPaise",
  "parkingPaise",
  "otherPaise",
  "labourPaise",
  "damagePaise",
]);
const DATE_FIELDS = new Set([
  "reportingDate",
  "unloadingDate",
  "collectionDate",
]);

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

/** Render a compared value the way its field should read. */
const show = (field: string, raw: string | null) => {
  if (raw === null) return <span className="text-muted-foreground">—</span>;
  if (MONEY_FIELDS.has(field)) return rupees(raw);
  if (DATE_FIELDS.has(field)) return day(raw);
  return raw;
};

function PartyHeader({
  title,
  ack,
}: {
  title: string;
  ack: ChallanAck | null;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {ack ? (
        <p className="text-xs text-muted-foreground">
          {ack.filedBy
            ? `${ack.filedBy.firstName} ${ack.filedBy.lastName}`
            : "—"}{" "}
          · {day(ack.filedAt)}
        </p>
      ) : (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Not filed
        </p>
      )}
    </div>
  );
}

export function ChallanAckComparison({
  supervisor,
  broker,
  mismatches,
  bothFiled,
}: {
  supervisor: ChallanAck | null;
  broker: ChallanAck | null;
  mismatches: AckMismatch[];
  bothFiled: boolean;
}) {
  if (!supervisor && !broker)
    return (
      <p className="text-sm text-muted-foreground">
        Neither the supervisor nor the broker has filed an acknowledgement for
        this challan yet.
      </p>
    );

  return (
    <div className="space-y-4">
      {!bothFiled ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Only one side has filed, so there is nothing to compare against.
            You can still approve, but you would be ruling on a single account.
          </span>
        </div>
      ) : mismatches.length === 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <IconCheck size={16} className="mt-0.5 shrink-0 text-primary" />
          <span>
            Both accounts agree on every field.
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            The two accounts differ on {mismatches.length} field
            {mismatches.length === 1 ? "" : "s"}, highlighted below.
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Field</TableHead>
              <TableHead>
                <PartyHeader title="SK supervisor" ack={supervisor} />
              </TableHead>
              <TableHead>
                <PartyHeader title="Broker" ack={broker} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mismatches.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-sm text-muted-foreground"
                >
                  No differences to show.
                </TableCell>
              </TableRow>
            ) : (
              mismatches.map((row) => (
                <TableRow
                  key={row.field}
                  className="bg-amber-50/50 dark:bg-amber-950/20"
                >
                  <TableCell className="text-sm font-medium">
                    {FIELD_LABELS[row.field] ?? row.field}
                  </TableCell>
                  <TableCell className="text-sm">
                    {show(row.field, row.supervisor)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {show(row.field, row.broker)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Per-LR quantities, side by side. Shortage is the server's derived
          figure, never recomputed here. */}
      {supervisor || broker ? (
        <div className="overflow-x-auto">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Per-LR quantities
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>LR</TableHead>
                <TableHead className="text-right">Supervisor rcvd</TableHead>
                <TableHead className="text-right">Supervisor short</TableHead>
                <TableHead className="text-right">Broker rcvd</TableHead>
                <TableHead className="text-right">Broker short</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ...new Set([
                  ...(supervisor?.items ?? []).map((i) => i.lrNumberSnapshot),
                  ...(broker?.items ?? []).map((i) => i.lrNumberSnapshot),
                ]),
              ].map((lr) => {
                const s = supervisor?.items.find(
                  (i) => i.lrNumberSnapshot === lr,
                );
                const b = broker?.items.find((i) => i.lrNumberSnapshot === lr);
                const differs =
                  (s?.receivedQty ?? null) !== (b?.receivedQty ?? null);
                return (
                  <TableRow
                    key={lr}
                    className={
                      differs ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                    }
                  >
                    <TableCell className="text-sm font-medium">{lr}</TableCell>
                    <TableCell className="text-right text-sm">
                      {s ? `${s.receivedQty} / ${s.totalQty}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {s ? s.shortageQty : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {b ? `${b.receivedQty} / ${b.totalQty}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {b ? b.shortageQty : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
