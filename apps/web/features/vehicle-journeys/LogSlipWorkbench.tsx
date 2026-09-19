"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { generateLogSlipSchema } from "@skerp/validators";
import type {
  GenerateLogSlipFormInput,
  GenerateLogSlipBody,
  LogSlipLine,
} from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  IconArrowLeft,
  IconFileInvoice,
  IconPrinter,
  IconLockOpen,
  IconBuildingBank,
  IconAlertTriangle,
} from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { formatPaise } from "@/lib/money";
import { toValidDate } from "@/lib/date";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import IconTextField from "../masters/_shared/fields/IconTextField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";

import { journeyApi, logSlipApi } from "./journey.service";
import { journeyKeys } from "./journey.keys";
import { JourneyStatusBadge, formatDateTime } from "./journey-ui";

type LineView = Pick<
  LogSlipLine,
  "lineType" | "description" | "quantity" | "ratePaise" | "amountPaise"
>;

const sumAmount = (lines: LineView[]) =>
  lines.reduce((total, line) => total + Number(line.amountPaise), 0);

function LineTable({
  title,
  lines,
  showQty,
}: {
  title: string;
  lines: LineView[];
  showQty?: boolean;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm font-medium">
          {formatPaise(sumAmount(lines))}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="h-9 text-xs font-semibold uppercase text-muted-foreground">
              Description
            </TableHead>
            {showQty ? (
              <>
                <TableHead className="h-9 w-24 text-right text-xs font-semibold uppercase text-muted-foreground">
                  Qty (L)
                </TableHead>
                <TableHead className="h-9 w-24 text-right text-xs font-semibold uppercase text-muted-foreground">
                  Rate
                </TableHead>
              </>
            ) : null}
            <TableHead className="h-9 w-32 text-right text-xs font-semibold uppercase text-muted-foreground">
              Amount
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => (
            <TableRow key={index}>
              <TableCell className="text-sm">{line.description}</TableCell>
              {showQty ? (
                <>
                  <TableCell className="text-right text-sm">
                    {line.quantity?.toLocaleString("en-IN") ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {line.ratePaise ? formatPaise(line.ratePaise) : "—"}
                  </TableCell>
                </>
              ) : null}
              <TableCell className="text-right text-sm font-medium">
                {formatPaise(line.amountPaise)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function LogSlipWorkbench({ journeyId }: { journeyId: string }) {
  const queryClient = useQueryClient();
  const [reopenOpen, setReopenOpen] = React.useState(false);
  const [postOpen, setPostOpen] = React.useState(false);

  const canGenerate = useCan(PERMS.LOGSLIP.GENERATE);
  const canPost = useCan(PERMS.LOGSLIP.POST_ACCOUNTS);
  const canReopen = useCan(PERMS.LOGSLIP.REOPEN);
  const canPrint = useCan(PERMS.LOGSLIP.PRINT);

  const journeyQuery = useQuery({
    queryKey: journeyKeys.detail(journeyId),
    queryFn: () => journeyApi.detail(journeyId),
  });
  const journey = journeyQuery.data;

  const frozenSlipId =
    journey?.logSlip &&
      ["GENERATED", "POSTED_TO_ACCOUNTS", "TALLY_SYNCED"].includes(
        journey.logSlip.status,
      )
      ? journey.logSlip.id
      : null;

  const slipQuery = useQuery({
    queryKey: journeyKeys.logSlip(frozenSlipId ?? ""),
    queryFn: () => logSlipApi.detail(frozenSlipId!),
    enabled: Boolean(frozenSlipId),
  });

  const previewQuery = useQuery({
    queryKey: journeyKeys.logSlipPreview(journeyId),
    queryFn: () => logSlipApi.preview(journeyId),
    enabled: Boolean(journey) && !frozenSlipId,
  });

  const form = useForm<GenerateLogSlipFormInput, unknown, GenerateLogSlipBody>({
    resolver: zodResolver(generateLogSlipSchema, undefined, { raw: true }),
    defaultValues: { previousDieselQty: 0 },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: journeyKeys.all });
    queryClient.invalidateQueries({ queryKey: ["log-slips"] });
  };

  const generate = useMutation({
    mutationFn: (body: GenerateLogSlipBody) =>
      logSlipApi.generate(journeyId, body),
    onSuccess: (slip) => {
      toast.success(`Log slip ${slip.logSlipNumber ?? ""} generated`);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const post = useMutation({
    mutationFn: () => logSlipApi.postAccounts(frozenSlipId!),
    onSuccess: () => {
      toast.success("Log slip posted — journey settled");
      setPostOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const reopen = useMutation({
    mutationFn: (reason: string) => logSlipApi.reopen(frozenSlipId!, reason),
    onSuccess: () => {
      toast.success("Log slip reopened");
      setReopenOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handlePrint = async () => {
    if (!frozenSlipId) return;
    try {
      const blob = await logSlipApi.downloadPdf(frozenSlipId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `log-slip-${slipQuery.data?.logSlipNumber ?? frozenSlipId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  if (journeyQuery.isLoading || !journey) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const slip = frozenSlipId ? slipQuery.data : null;
  const preview = frozenSlipId ? null : previewQuery.data;

  const lines: LineView[] = slip?.lines ?? preview?.lines ?? [];
  const linesOf = (type: string) => lines.filter((l) => l.lineType === type);

  const totals = slip ?? preview;
  const driverPayable = Number(totals?.driverPayablePaise ?? 0);
  const driverReceivable = Number(totals?.driverReceivablePaise ?? 0);
  const netResult = Number(totals?.netVehicleResultPaise ?? 0);

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="icon-sm" variant="ghost" asChild>
                <Link
                  href={`/vehicle-journeys/${journeyId}`}
                  aria-label="Back to journey"
                >
                  <IconArrowLeft size={16} />
                </Link>
              </Button>
              <h1 className="text-lg font-semibold">
                Log Slip — {journey.journeyNumber}
              </h1>
              <JourneyStatusBadge status={journey.status} />
              {slip ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {slip.logSlipNumber} · {slip.status.replace(/_/g, " ")}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {journey.vehicle?.vehicleNumber} · {journey.driver?.name} · KM{" "}
              {journey.openingKm}
              {journey.closingKm !== null
                ? ` → ${journey.closingKm}`
                : ""} · {formatDateTime(journey.startedAt)}
              {journey.closedAt ? ` → ${formatDateTime(journey.closedAt)}` : ""}
            </p>
          </div>

          {/* One primary action by status */}
          <div className="flex flex-wrap items-center gap-2">
            {slip && canPrint ? (
              <Button
                variant={
                  slip.status === "GENERATED" && canPost ? "outline" : "default"
                }
                onClick={handlePrint}
              >
                <IconPrinter size={16} className="mr-1" /> Print
              </Button>
            ) : null}
            {slip && slip.status === "GENERATED" && canPost ? (
              <Button onClick={() => setPostOpen(true)}>
                <IconBuildingBank size={16} className="mr-1" /> Post to Accounts
              </Button>
            ) : null}
            {slip && canReopen ? (
              <Button variant="ghost" onClick={() => setReopenOpen(true)}>
                <IconLockOpen size={16} className="mr-1" /> Reopen
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Warnings (preview only) */}
      {preview && preview.warnings.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          {preview.warnings.map((warning, index) => (
            <p
              key={index}
              className="flex items-center gap-2 text-xs text-amber-700"
            >
              <IconAlertTriangle size={14} /> {warning}
            </p>
          ))}
        </div>
      ) : null}

      {/* Generate form — only when the journey is ready and no frozen slip */}
      {!slip && journey.status === "READY_FOR_LOGSLIP" && canGenerate ? (
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit((values) => generate.mutate(values))}
            className="rounded-lg border bg-card p-4"
          >
            <h3 className="text-sm font-semibold">Generate Log Slip</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Freezes the snapshot below with a log slip number. Reopening later
              requires permission and a reason.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <Controller
                name="logSlipDate"
                control={form.control}
                render={({ field }) => (
                  <DateTimePicker
                    label="Log slip date"
                    selected={toValidDate(field.value)}
                    onSelect={field.onChange}
                    placeholder="Select log slip date and time"
                  />
                )}
              />
              <IconTextField<GenerateLogSlipFormInput>
                name="previousDieselQty"
                label="Previous diesel (L)"
                type="number"
                min={0}
                step="0.01"
              />
              <IconTextField<GenerateLogSlipFormInput>
                name="dieselRate"
                label="Diesel rate / L"
                type="number"
                min={0}
                step="0.01"
                prefix="₹"
              />
              <IconTextField<GenerateLogSlipFormInput>
                name="standardAverage"
                label="Standard avg (KM/L)"
                type="number"
                min={0}
                step="0.01"
              />
              <div className="md:col-span-4">
                <TextAreaField<GenerateLogSlipFormInput>
                  name="remarks"
                  label="Remarks"
                  rows={2}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="submit"
                disabled={
                  generate.isPending ||
                  (preview?.warnings ?? []).some((w) =>
                    w.includes("still open"),
                  )
                }
              >
                <IconFileInvoice size={16} className="mr-1" />
                {generate.isPending ? "Generating…" : "Generate Log Slip"}
              </Button>
            </div>
          </form>
        </FormProvider>
      ) : null}

      {!slip && journey.status === "RETURNED" ? (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          The journey has returned but is not marked ready yet. Complete the
          settlement review on the{" "}
          <Link
            href={`/vehicle-journeys/${journeyId}`}
            className="text-primary hover:underline"
          >
            journey page
          </Link>{" "}
          (close legs, approve expenses), then mark it ready for log slip.
        </div>
      ) : null}

      {/* Totals */}
      {totals ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: "Total freight",
              value: formatPaise(Number(totals.totalFreightPaise)),
            },
            {
              label: "Total expenses",
              value: formatPaise(Number(totals.totalExpensePaise)),
            },
            {
              label:
                driverPayable > 0
                  ? "Payable to driver"
                  : "Receivable from driver",
              value: formatPaise(
                driverPayable > 0 ? driverPayable : driverReceivable,
              ),
            },
            {
              label: "Net vehicle result",
              value: formatPaise(netResult),
              accent: netResult >= 0,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p
                className={`mt-1 text-base font-semibold ${item.accent === undefined
                    ? ""
                    : item.accent
                      ? "text-green-700"
                      : "text-destructive"
                  }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Diesel account (frozen slip only — needs previous qty & averages) */}
      {slip ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            { label: "Total KM", value: slip.totalKm.toLocaleString("en-IN") },
            { label: "Days", value: slip.totalDays },
            {
              label: "Diesel (L)",
              value: slip.totalDieselQty.toLocaleString("en-IN"),
            },
            {
              label: "Actual avg",
              value: slip.actualAverage?.toFixed(2) ?? "—",
            },
            {
              label: "Standard avg",
              value: slip.standardAverage?.toFixed(2) ?? "—",
            },
            {
              label: "Short diesel (L)",
              value: slip.shortDieselQty?.toFixed(2) ?? "—",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Line tables */}
      {previewQuery.isLoading || (frozenSlipId && slipQuery.isLoading) ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-3">
          <LineTable title="Trip Freight" lines={linesOf("TRIP_FREIGHT")} />
          <LineTable title="Advances" lines={linesOf("ADVANCE")} />
          <LineTable title="Diesel" lines={linesOf("DIESEL")} showQty />
          <LineTable title="Other Expenses" lines={linesOf("EXPENSE")} />
          <LineTable
            title="Driver Settlement"
            lines={linesOf("DRIVER_SETTLEMENT")}
          />
        </div>
      )}

      <ConfirmDialog
        open={postOpen}
        onOpenChange={setPostOpen}
        title="Post log slip to accounts?"
        description="The journey is settled. Journal entries will flow to Tally once the accounts ledger is live."
        confirmLabel="Post to accounts"
        pendingLabel="Posting..."
        isPending={post.isPending}
        onConfirm={() => post.mutate()}
      />

      <ReasonDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title="Reopen log slip"
        description="Reopening is audited — who, when and why are recorded. Regenerating replaces the snapshot."
        confirmLabel="Reopen"
        destructive
        isPending={reopen.isPending}
        onConfirm={(reason) => reopen.mutate(reason)}
      />
    </div>
  );
}
