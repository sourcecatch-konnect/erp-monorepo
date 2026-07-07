// apps/web/app/(dashboard)/vp-management/grn/page.tsx

"use client";

import Link from "next/link";
import { IconEye, IconPlus } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useGRNs } from "./useHook/useGRN";
import { formatPaise } from "@/lib/money";

const DASH = "—";

const formatDate = (value: unknown) => {
  if (!value) return DASH;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return DASH;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function GrnListPage() {
  const grns = useGRNs({
    page: 0,
    size: 25,
    search: "",
  });

  const rows = grns.data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">GRN</h1>
          <p className="text-sm text-muted-foreground">
            Goods Receipt Note list
          </p>
        </div>

        <Button asChild>
          <Link href="/vp-management/grn/new">
            <IconPlus size={16} className="mr-2" />
            Create GRN
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {grns.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">
            Loading GRN list...
          </div>
        ) : grns.isError ? (
          <div className="p-6 text-sm text-red-600">
            Failed to load GRN list.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No GRN found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>GRN No</TableHead>
                  <TableHead>LR No</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gate No</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Damage</TableHead>
                  <TableHead>Shortage</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((grn: any) => (
                  <TableRow key={grn.id}>
                    <TableCell className="font-medium">
                      {grn.grnNumber || DASH}
                    </TableCell>

                    <TableCell>
                      {grn.lorryReceipt?.lrNumber || DASH}
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">
                        {grn.status || DASH}
                      </span>
                    </TableCell>

                    <TableCell>{grn.gateNo || DASH}</TableCell>

                    <TableCell>{grn.receivedQty ?? DASH}</TableCell>

                    <TableCell>{grn.damageQty ?? DASH}</TableCell>

                    <TableCell>{grn.shortageQty ?? DASH}</TableCell>

                    <TableCell>{formatPaise(grn.netAmount)}</TableCell>

                    <TableCell>{formatDate(grn.createdAt)}</TableCell>

                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                   
                        <Link href={`/vp-management/grn/${grn.id}`}>
                          <IconEye size={14} className="mr-1" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}