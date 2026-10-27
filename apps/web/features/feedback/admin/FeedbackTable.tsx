"use client";

import { format } from "date-fns";
import { formatFeedbackNumber, type FeedbackListItem } from "@skerp/types";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  FeedbackCategoryBadge,
  FeedbackSeverityBadge,
  FeedbackStatusBadge,
} from "../components/badges";

const DATA_COLUMNS = 7;

// Radix sets data-state="checked"; the shared Checkbox's `data-checked:` fill never matches.
const CHECKBOX_CLASS =
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";

export function FeedbackTable({
  rows,
  loading,
  selectable,
  selected,
  emptyMessage,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: FeedbackListItem[] | undefined;
  loading: boolean;
  selectable: boolean;
  selected: Set<string>;
  emptyMessage: string;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const columnCount = DATA_COLUMNS + (selectable ? 1 : 0);
  const allSelected =
    rows !== undefined && rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable ? (
            <TableHead className="w-10">
              <Checkbox
                className={CHECKBOX_CLASS}
                checked={allSelected}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
                aria-label="Select all on this page"
              />
            </TableHead>
          ) : null}
          <TableHead className="w-24">FB #</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>What was reported</TableHead>
          <TableHead>Reported by</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reported on</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 8 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: columnCount }).map((__, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : null}

        {!loading && rows?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columnCount} className="py-10 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : null}

        {!loading
          ? rows?.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                data-state={selected.has(row.id) ? "selected" : undefined}
                onClick={() => onOpen(row.id)}
              >
                {selectable ? (
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      className={CHECKBOX_CLASS}
                      checked={selected.has(row.id)}
                      onCheckedChange={() => onToggle(row.id)}
                      aria-label={`Select ${formatFeedbackNumber(row.number)}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="font-medium text-foreground">
                  {formatFeedbackNumber(row.number)}
                </TableCell>
                <TableCell>
                  <FeedbackCategoryBadge category={row.category} />
                </TableCell>
                <TableCell className="max-w-md whitespace-normal">
                  <button
                    type="button"
                    className="text-left font-medium text-foreground transition-colors duration-150 hover:text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(row.id);
                    }}
                  >
                    {row.title}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {row.pageTitle} · {row.moduleLabel}
                  </p>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <p className="text-foreground">{row.reporterName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.reporterRole}
                    {row.reporterBranch ? `, ${row.reporterBranch}` : ""}
                  </p>
                </TableCell>
                <TableCell>
                  <FeedbackSeverityBadge severity={row.severity} />
                </TableCell>
                <TableCell>
                  <FeedbackStatusBadge status={row.status} />
                  {row.reporterConfirmedAt ? (
                    <p className="mt-1 text-xs text-primary">Confirmed by tester</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(row.createdAt), "dd MMM yyyy, h:mm a")}
                </TableCell>
              </TableRow>
            ))
          : null}
      </TableBody>
    </Table>
  );
}
