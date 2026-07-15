"use client";

import * as React from "react";
import { TableCell, TableRow } from "@skerp/ui/components/table";
import { IconDatabaseOff } from "@tabler/icons-react";

type Props = {
  colSpan: number;
  message: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

/** Full-width empty row for a list table with no results. */
export function TableEmptyState({
  colSpan,
  message,
  icon: Icon = IconDatabaseOff,
}: Props) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-14 text-center text-muted-foreground"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Icon size={18} />
          </div>
          <span className="text-sm font-medium">{message}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}
