import * as React from "react";
import { IconReceiptRupee } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { ReceiptStatus } from "./receipt.service";

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

export const formatLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

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
            <IconReceiptRupee size={22} />
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

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

const RECEIPT_STATUS_STYLES: Record<ReceiptStatus, string> = {
  DRAFT: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",
  PENDING_APPROVAL:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  POSTED:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED:
    "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function ReceiptStatusBadge({
  status,
  className,
}: {
  status: ReceiptStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        RECEIPT_STATUS_STYLES[status],
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {RECEIPT_STATUS_LABELS[status]}
    </span>
  );
}

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  CHEQUE: "Cheque",
  BANK: "Bank transfer",
  UPI: "UPI",
};
