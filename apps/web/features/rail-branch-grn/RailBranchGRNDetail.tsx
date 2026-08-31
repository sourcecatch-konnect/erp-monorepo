"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCalendarTime,
  IconDownload,
  IconEdit,
  IconEye,
  IconLoader2,
  IconPackage,
  IconPrinter,
  IconRoute,
  IconTrain,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { formatPaise } from "@/lib/money";
import { runPdfAction, type PdfAction } from "@/lib/pdf-actions";

import { RailBranchGRNStatusBadge } from "./RailBranchGRNStatusBadge";
import { railBranchGrnApi } from "./rail-branch-grn.service";
import { useRailBranchGRNDetail } from "./useRailBranchGRN";

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
    : "—";

const formatNumber = (value?: number | null) =>
  value == null ? "—" : new Intl.NumberFormat("en-IN").format(value);

const fullName = (
  supervisor?: {
    name?: string | null;
  } | null,
) =>
  supervisor?.name || "—";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

export default function RailBranchGRNDetail({ id }: { id: string }) {
  const query = useRailBranchGRNDetail(id);
  const canUpdate = useCan(PERMS.RAIL_BRANCH_GRN.UPDATE);
  const [pdfBusy, setPdfBusy] = useState(false);

  const handlePdf = async (action: PdfAction, withLetterhead: boolean) => {
    try {
      setPdfBusy(true);
      const blob = await railBranchGrnApi.downloadPdf(id, withLetterhead);
      const suffix = withLetterhead ? "" : "-plain";
      runPdfAction(blob, action, `branch-grn-${id.slice(-6)}${suffix}.pdf`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPdfBusy(false);
    }
  };

  const openPrintPreview = (withLetterhead: boolean) => {
    window.open(
      `/api/rail-branch-grns/${encodeURIComponent(id)}/print-preview?letterhead=${withLetterhead}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <section className="rounded-lg border bg-card p-5">
          <p className="font-semibold">Branch GRN not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getErrorMessage(query.error)}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/vp-management/branch-grn">Back to Branch GRNs</Link>
          </Button>
        </section>
      </div>
    );
  }

  const grn = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/vp-management/branch-grn">
          <IconArrowLeft size={16} className="mr-1.5" />
          Back to Branch GRNs
        </Link>
      </Button>

      <header className="flex flex-col gap-4 rounded-lg border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <IconTrain size={22} />
            <h1 className="text-xl font-semibold">
              {grn.railRake.rakeNumber} · VP{" "}
              {grn.vpWagonLoading.mrRrRow.vpNo || "—"}
            </h1>
            <RailBranchGRNStatusBadge status={grn.status} />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <IconRoute size={16} />
            {grn.railRake.fromBranch.name} → {grn.railRake.toBranch.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" disabled={pdfBusy}>
                {pdfBusy ? (
                  <IconLoader2 size={16} className="mr-1.5 animate-spin" />
                ) : (
                  <IconDownload size={16} className="mr-1.5" />
                )}
                {pdfBusy ? "Preparing…" : "Print / PDF"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Download</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handlePdf("download", true)}>
                <IconDownload size={16} className="mr-2" /> With letterhead
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePdf("download", false)}>
                <IconDownload size={16} className="mr-2" /> Without letterhead
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Print</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handlePdf("print", true)}>
                <IconPrinter size={16} className="mr-2" /> With letterhead
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePdf("print", false)}>
                <IconPrinter size={16} className="mr-2" /> Without letterhead
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Preview</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => openPrintPreview(true)}>
                <IconEye size={16} className="mr-2" /> With letterhead
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openPrintPreview(false)}>
                <IconEye size={16} className="mr-2" /> Without letterhead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canUpdate && ["DRAFT", "SUBMITTED"].includes(grn.status) ? (
            <Button asChild variant="outline">
              <Link href={`/vp-management/branch-grn/${grn.id}/edit`}>
                <IconEdit size={16} className="mr-1.5" />
                {grn.status === "SUBMITTED" ? "Correct GRN" : "Edit"}
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 border-b pb-3 font-semibold">
          <IconCalendarTime size={18} />
          Receiving summary
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Schedule"
            value={grn.railRake.vpSchedule.scheduleNumber}
          />
          <Field
            label="Schedule date"
            value={formatDateTime(grn.railRake.vpSchedule.scheduleDate)}
          />
          <Field label="Wagon" value={grn.vpWagonLoading.mrRrRow.wagon.name} />
          <Field label="MR/RR" value={grn.vpWagonLoading.mrRrRow.mrRrNo} />
          <Field label="In date/time" value={formatDateTime(grn.inDateTime)} />
          <Field
            label="Out date/time"
            value={formatDateTime(grn.outDateTime)}
          />
          <Field
            label="Unloading Time"
            value={
              grn.unloadingMinutes == null
                ? "—"
                : `${(grn.unloadingMinutes / 60).toFixed(1)} Hr`
            }
          />
          <Field label="Damages by" value={grn.damagesBy} />
          <Field label="No. of labour" value={grn.labourCount} />
          <Field label="Labour charge" value={formatPaise(grn.labourCharge)} />
          <Field
            label="Unloading supervisor"
            value={fullName(grn.unloadingSupervisor)}
          />
          <Field label="Created" value={formatDateTime(grn.createdAt)} />
          <Field label="Submitted" value={formatDateTime(grn.submittedAt)} />
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Loaded", grn.totalLoadedQty],
          ["Received", grn.totalReceivedQty],
          ["Damage", grn.totalDamageQty],
          ["Shortage", grn.totalShortageQty],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">
              {formatNumber(Number(value))}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <IconPackage size={18} />
            Received goods
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>LR / GRN</TableHead>
                <TableHead>Goods</TableHead>

                <TableHead className="text-right">Loaded</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Damage</TableHead>
                <TableHead className="text-right">Shortage</TableHead>

              </TableRow>
            </TableHeader>
            <TableBody>
              {grn.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.lrNumberSnapshot}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.vpLoadingGoods.vpLoading.grn.grnNumber}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{item.goodsNameSnapshot}</p>

                  </TableCell>

                  <TableCell className="text-right">
                    {formatNumber(item.loadedQty)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.receivedQty)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.damageQty)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.shortageQty)}
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {(grn.damagePhotos ?? []).length ? (
        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Damage / shortage photos</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(grn.damagePhotos ?? []).map((photo) => (
              <div
                key={photo.id}
                className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
              >
                <p className="truncate font-medium">
                  {photo.originalName || "Damage photo"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {photo.mime} · {(photo.sizeBytes / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
