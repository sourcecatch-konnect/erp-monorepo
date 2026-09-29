import * as React from "react";
import { IconTruckDelivery } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { TableCell, TableRow } from "@skerp/ui/components/table";
import { cn } from "@/lib/utils";
import type { VendorPaymentStatus } from "./vendor-payment.service";

export const today = () => new Date().toISOString().slice(0, 10);

export const money = (paise: string | bigint) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(BigInt(paise)) / 100);

export const rupeesToPaise = (rupees: string) => {
  const value = Number(rupees);
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 100));
};

export const formatDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "—";

export const Field = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <label className={cn("space-y-1.5 text-xs font-medium", className)}>
    <span>{label}</span>
    {children}
  </label>
);

export function StepHeading({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
        {step}
      </span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card p-5">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <IconTruckDelivery size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Placeholder rows shown while the next chunk of a list is being fetched. */
export function SkeletonTableRows({
  columns,
  rows = 3,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={`skeleton-${row}`}>
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              <Skeleton className="h-4 w-full max-w-28" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * Footer for a chunk-loaded list. Pass `total` when the server reports one;
 * lists that only know whether another chunk exists (the eligible-source
 * lists) omit it.
 */
export function LoadMoreFooter({
  shown,
  total,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  shown: number;
  total?: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        {total !== undefined
          ? `Showing ${shown} of ${total}`
          : hasNextPage
            ? `${shown} loaded so far`
            : `${shown} in total`}
      </p>
      {hasNextPage ? (
        <Button variant="outline" onClick={onLoadMore} disabled={isFetchingNextPage}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}

export const VENDOR_PAYMENT_STATUS_LABELS: Record<VendorPaymentStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const VENDOR_PAYMENT_STATUS_STYLES: Record<VendorPaymentStatus, string> = {
  DRAFT: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",
  PENDING_APPROVAL:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  APPROVED:
    "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  PARTIALLY_PAID:
    "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  PAID:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED:
    "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function VendorPaymentStatusBadge({
  status,
  className,
}: {
  status: VendorPaymentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        VENDOR_PAYMENT_STATUS_STYLES[status],
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {VENDOR_PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
