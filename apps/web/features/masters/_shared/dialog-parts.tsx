// _shared/detail-dialog-parts.tsx

import { Skeleton } from "@skerp/ui/components/skeleton";
import * as React from "react";
import { formatPaise, formatRupees } from "@/lib/money";
export const formatCurrency = (
  value?: number | null
) => {
  if (value == null) return "-";

  return formatRupees(value);
};

export const formatCurrencyFromPaise = (
  value?: number | null
) => {
  if (value == null) return "-";

  return formatPaise(value);
};

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
      {children}
    </p>
  );
}

export function Field({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </div>

      <p
        className={`text-sm font-medium leading-snug ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value ?? "-"}
      </p>
    </div>
  );
}

export const formatDate = (value?: string | Date | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const getInitials = (name?: string | null) => {
  if (!name) return "??";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
};


export function PartyCard({
  label,
  name,
  subtitle,
  colorClass,
  icon,
}: {
  label: string;
  name?: string | null;
  subtitle?: string;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${colorClass}`}>
        {getInitials(name)}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">
          {name ?? "-"}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <span className="ml-auto text-muted-foreground/40">{icon}</span>
    </div>
  );
}
export const getDaysRemaining = (expiryDate?: string | Date | null) => {
  if (!expiryDate) return null;

  return Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
};

export const getProgress = (
  startDate?: string | Date | null,
  expiryDate?: string | Date | null
) => {
  if (!startDate || !expiryDate) return null;

  const start = new Date(startDate).getTime();
  const end = new Date(expiryDate).getTime();
  const now = Date.now();

  return Math.round(
    Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  );
};

export function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>

      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <div className="grid grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
