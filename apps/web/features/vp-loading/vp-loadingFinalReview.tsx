"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconPackage,
  IconRoute,
  IconScale,
  IconTrain,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Textarea } from "@skerp/ui/components/textarea";
import { PERMS } from "@skerp/types";

import { useCan } from "@/features/auth";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import {
  useFinaliseVPScheduleLoading,
  useVPLoadingFinalReview,
} from "./hook/useVP-loading";
import { useRouter } from "next/navigation";

const DASH = "-";

const formatDate = (value?: string | null) => {
  if (!value) return DASH;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatNumber = (value?: number | string | null) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(
        number,
      )
    : DASH;
};

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function VPLoadingFinalReview({
  scheduleId,
}: {
  scheduleId: string;
}) {
  const reviewQuery = useVPLoadingFinalReview(scheduleId);
  const finaliseSchedule = useFinaliseVPScheduleLoading();
  const canComplete = useCan(PERMS.VP_LOADING.COMPLETE);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [remarks, setRemarks] = React.useState("");
  const router = useRouter();
  const handleFinalise = async () => {
    if (!reviewQuery.data?.canFinalise) return;

    try {
      const result = await finaliseSchedule.mutateAsync({
        scheduleId,
        body: {
          version: reviewQuery.data.schedule.version,
          remarks: remarks.trim() || undefined,
        },
      });

      toast.success(`Rail Rake ${result.railRake.rakeNumber} generated`);
      setConfirmOpen(false);
      setRemarks("");

      router.replace(`/vp-management/vp-loading/${scheduleId}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (reviewQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-32 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          <p className="font-semibold">Unable to load final review</p>
          <p className="mt-1 text-sm">{getErrorMessage(reviewQuery.error)}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/vp-management/vp-loading/${scheduleId}`}>
              <IconArrowLeft size={15} className="mr-1.5" />
              Back to VP Loading
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const review = reviewQuery.data;
  const schedule = review.schedule;
  const rows = schedule.mrRr?.rows ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b bg-muted/20 p-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/vp-management/vp-loading/${schedule.id}`}>
              <IconArrowLeft size={16} className="mr-1.5" />
              Back to VP Loading
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">
                {schedule.scheduleNumber}
              </h1>
              <span className="rounded-md border bg-muted px-2.5 py-1 text-xs font-semibold">
                {schedule.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Final loading review before Rail Rake generation
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-2">
                <IconRoute size={16} className="text-muted-foreground" />
                {schedule.fromBranch.name} to {schedule.toBranch.name}
              </span>
              <span>{formatDate(schedule.scheduleDate)}</span>
              <span>MR/RR {schedule.mrRr?.mrRrNumber ?? DASH}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div
              className={`rounded-lg border px-4 py-3 ${
                review.canFinalise
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {review.canFinalise ? (
                  <IconCircleCheck size={18} />
                ) : (
                  <IconAlertTriangle size={18} />
                )}
                {review.canFinalise
                  ? "Ready for finalisation"
                  : schedule.railRake
                    ? `Rake ${schedule.railRake.rakeNumber}`
                    : "Review requires attention"}
              </div>
            </div>

            {review.canFinalise && canComplete ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => setConfirmOpen(true)}
              >
                <IconCircleCheck size={16} className="mr-1.5" />
                Finalise & Generate Rake
              </Button>
            ) : null}

            {schedule.railRake ? (
              <Button asChild type="button" className="w-full">
                <Link
                  href={`/vp-management/rail-rakes/${schedule.railRake.id}`}
                >
                  <IconTrain size={16} className="mr-1.5" />
                  View Rake
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="VP wagons"
          value={formatNumber(review.summary.totalWagonRows)}
          icon={<IconTrain size={18} />}
        />
        <Metric
          label="Loaded wagons"
          value={`${formatNumber(review.summary.verifiedWagonCount)} / ${formatNumber(
            review.summary.totalWagonRows,
          )}`}
          icon={<IconCircleCheck size={18} />}
        />
        <Metric
          label="Loaded quantity"
          value={formatNumber(review.summary.totalLoadedQty)}
          icon={<IconScale size={18} />}
        />
        <Metric
          label="Loading damage"
          value={formatNumber(review.summary.totalLoadingDamageQty)}
          icon={<IconPackage size={18} />}
        />
      </div>

      {review.validationIssues.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-amber-800">
            <IconAlertTriangle size={18} />
            Finalisation checks
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-700">
            {review.validationIssues.map((issue) => (
              <li key={`${issue.code}-${issue.mrrrRowId ?? "schedule"}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Loaded wagon details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review VP numbers, loaded GRNs and source goods before finalisation.
          </p>
        </div>

        <div className="divide-y">
          {rows.map((row) => {
            const loading = row.vpWagonLoading;

            return (
              <article key={row.id} className="space-y-4 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{row.vpNo || row.rowLabel}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.wagon.name} / {row.mrRrNo || DASH} / Seal{" "}
                      {row.sealNo || DASH}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="font-semibold">
                      {formatNumber(loading?.totalLoadedQty)} loaded
                    </p>
                    <p className="text-muted-foreground">
                      {loading?.status === "COMPLETED"
                        ? "LOADED"
                        : (loading?.status ?? "Loading missing")}
                    </p>
                  </div>
                </div>

                {loading?.allocations.length ? (
                  <div className="space-y-3">
                    {loading.allocations.map((allocation) => (
                      <div
                        key={allocation.id}
                        className="overflow-hidden rounded-lg border"
                      >
                        <div className="flex flex-col gap-2 bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">
                              GRN {allocation.grn.grnNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              LR {allocation.grn.lorryReceipt.lrNumber} /{" "}
                              {allocation.grn.lorryReceipt.group.consignor.name}{" "}
                              to{" "}
                              {allocation.grn.lorryReceipt.group.consignee.name}
                            </p>
                          </div>
                          <p className="font-semibold">
                            {formatNumber(allocation.loadedQty)} loaded
                          </p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-sm">
                            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="px-4 py-2.5 font-medium">
                                  Goods
                                </th>
                                <th className="px-4 py-2.5 font-medium">
                                  Unit
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                  Loaded
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                  Damage
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {allocation.goods.map((item) => (
                                <tr key={item.id}>
                                  <td className="px-4 py-3 font-medium">
                                    {item.grnGoods.goodsName}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {item.grnGoods.quantityUnit?.name ||
                                      item.grnGoods.unit ||
                                      DASH}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {formatNumber(item.loadedQty)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {formatNumber(item.loadingDamageQty)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No active loaded allocations found.
                  </p>
                )}

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>Gate: {loading?.gateNo || DASH}</span>
                  <span>Labour: {loading?.labour?.name || DASH}</span>
                  <span>
                    Supervisor: {loading?.loadingSupervisor?.name || DASH}
                  </span>
                  <span>
                    Marked loaded: {formatDate(loading?.loadingCompletedAt)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalise VP Schedule?</DialogTitle>
            <DialogDescription>
              This locks the complete VP loading and generates exactly one Rail
              Rake ID. Loading records cannot be changed afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="finalise-remarks" className="text-sm font-medium">
              Remarks
            </label>
            <Textarea
              id="finalise-remarks"
              value={remarks}
              maxLength={500}
              placeholder="Optional finalisation remarks"
              onChange={(event) => setRemarks(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={finaliseSchedule.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={finaliseSchedule.isPending}
              onClick={handleFinalise}
            >
              {finaliseSchedule.isPending
                ? "Generating Rake..."
                : "Confirm & Generate Rake"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
