"use client";

import * as React from "react";
import { IconDownload } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";

import { ledgerApi, type StatementFilters } from "../api/ledger.service";

type Props = {
  customerId: string;
  filters: StatementFilters;
  disabled?: boolean;
};

/** ACCT-R6 — download the on-screen statement (same customer + filters) as a
 *  server-generated PDF or Excel file. */
export function StatementExportButton({ customerId, filters, disabled }: Props) {
  const [busy, setBusy] = React.useState<"pdf" | "xlsx" | null>(null);

  const download = async (format: "pdf" | "xlsx") => {
    if (!customerId) return;
    setBusy(format);
    try {
      const blob = await ledgerApi.downloadStatement(customerId, filters, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement-${customerId}.${format === "xlsx" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || busy !== null}>
          <IconDownload className="mr-1.5 size-4" />
          {busy ? "Preparing…" : "Download"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => download("pdf")}>PDF (print / email)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => download("xlsx")}>Excel (working copy)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
