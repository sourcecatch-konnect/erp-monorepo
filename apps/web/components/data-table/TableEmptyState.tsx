"use client";

import * as React from "react";
import { TableCell, TableRow } from "@skerp/ui/components/table";
import { EmptyState } from "@skerp/ui/components/empty-state";
import { IconDatabaseOff } from "@tabler/icons-react";

type Props = {
  colSpan: number;
  message: string;
  /** What to do next, or what has to exist first (shown under the message). */
  description?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Optional next step, e.g. a "Clear filters" or "Retry" button. */
  action?: React.ReactNode;
};

/** Full-width empty row for a list table with no results. */
export function TableEmptyState({
  colSpan,
  message,
  description,
  icon: Icon = IconDatabaseOff,
  action,
}: Props) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="whitespace-normal p-0">
        <EmptyState
          className="py-14"
          icon={<Icon size={18} />}
          title={message}
          description={description}
          action={action}
        />
      </TableCell>
    </TableRow>
  );
}
