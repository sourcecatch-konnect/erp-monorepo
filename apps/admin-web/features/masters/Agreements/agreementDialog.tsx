"use client";

import * as React from "react";
import type { AgreementWithRelations } from "@skerp/types";

import {
  Dialog,
  DialogContent,
} from "@skerp/ui/components/dialog";

import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  IconBuilding,
  IconUser,
  IconMapPin,
  IconBuildingStore,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarX,
  IconTruck,
  IconId,
  IconClockEdit,
  IconCirclePlus,
  IconX,
  IconFileDescription,
  IconCircleCheckFilled,
} from "@tabler/icons-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: AgreementWithRelations;
  isLoading?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (value?: string | Date | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getDaysRemaining = (expiryDate?: string | Date | null) => {
  if (!expiryDate) return null;
  const diff = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  return diff;
};

const getProgress = (
  startDate?: string | Date | null,
  expiryDate?: string | Date | null
) => {
  if (!startDate || !expiryDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(expiryDate).getTime();
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  return Math.round(pct);
};

const getInitials = (name?: string | null) => {
  if (!name) return "??";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function Field({
  label,
  value,
  icon,
  mono = false,
  accent,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
  accent?: "warn" | "danger";
}) {
  const valueColor =
    accent === "warn"
      ? "text-amber-600"
      : accent === "danger"
        ? "text-red-500"
        : "text-foreground";

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </div>
      <p
        className={`text-sm font-medium leading-snug ${valueColor} ${mono ? "font-mono text-xs" : ""}`}
      >
        {value ?? "-"}
      </p>
    </div>
  );
}

function PartyCard({
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
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${colorClass}`}
      >
        {getInitials(name)}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">
          {name ?? "-"}
        </p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <span className="ml-auto text-muted-foreground/40">{icon}</span>
    </div>
  );
}

function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded" />
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded" />
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded" />
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AgreementDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  const daysRemaining = getDaysRemaining(data?.expiryDate);
  const progress = getProgress(data?.startDate, data?.expiryDate);

  const expiryAccent =
    daysRemaining === null
      ? undefined
      : daysRemaining < 30
        ? "danger"
        : daysRemaining < 90
          ? "warn"
          : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[580px] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[900px]">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconFileDescription size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Agreement Details
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                {!isLoading && data && (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                      <IconCircleCheckFilled size={10} />
                      Active
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── BODY ───────────────────────────────────────────── */}
        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="max-h-[calc(90vh-130px)] overflow-y-auto">

            {/* PARTIES */}
            <div className="px-5 py-5">
              <SectionLabel>Parties</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <PartyCard
                  label="Company"
                  name={data?.company?.name}
                  colorClass="bg-violet-100 text-violet-700"
                  icon={<IconBuilding size={15} />}
                />
                <PartyCard
                  label="Customer"
                  name={data?.client?.name}
                  colorClass="bg-teal-100 text-teal-700"
                  icon={<IconUser size={15} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* TIMELINE */}
            <div className="px-5 py-5">
              <SectionLabel>Timeline</SectionLabel>

              {/* Dot-and-line row */}
              <div className="relative mb-4 grid grid-cols-3">
                <div className="absolute top-[5px] left-[6px] right-[6px] h-px bg-border" />
                {[
                  {
                    label: "Agreement date",
                    value: formatDate(data?.agreementDate),
                    sub: null,
                    warn: false,
                  },
                  {
                    label: "Start date",
                    value: formatDate(data?.startDate),
                    sub: null,
                    warn: false,
                  },
                  {
                    label: "Expiry date",
                    value: formatDate(data?.expiryDate),
                    sub:
                      daysRemaining !== null
                        ? daysRemaining > 0
                          ? `${daysRemaining} days left`
                          : "Expired"
                        : null,
                    warn: expiryAccent === "warn" || expiryAccent === "danger",
                  },
                ].map((item) => (
                  <div key={item.label} className="relative z-10">
                    <div
                      className={`mb-2 size-[11px] rounded-full border-2 bg-background ${
                        item.warn ? "border-amber-500" : "border-primary"
                      }`}
                    />
                    <p className="mb-1 text-[10px] text-muted-foreground">
                      {item.label}
                    </p>
                    <p
                      className={`text-[13px] font-medium ${
                        item.warn ? "text-amber-600" : "text-foreground"
                      }`}
                    >
                      {item.value}
                    </p>
                    {item.sub && (
                      <p className="mt-0.5 text-[10px] text-amber-500">
                        {item.sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>

       
            </div>

            <div className="mx-5 border-t" />

            {/* LOCATION & LOGISTICS */}
            <div className="px-5 py-5">
              <SectionLabel>Location & Logistics</SectionLabel>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="City"
                  value={data?.city?.name}
                  icon={<IconMapPin size={12} />}
                />
                <Field
                  label="Branch"
                  value={data?.branch?.name}
                  icon={<IconBuildingStore size={12} />}
                />
                <Field
                  label="Carrying capacity"
                  value={
                    data?.carryingCapacity != null
                      ? `${data.carryingCapacity} Ton`
                      : "-"
                  }
                  icon={<IconTruck size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* SYSTEM INFO */}
            <div className="px-5 py-5">
              <SectionLabel>System info</SectionLabel>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Agreement ID"
                  value={data?.id ?? "-"}
                  icon={<IconId size={12} />}
                  mono
                />
                <Field
                  label="Created at"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCirclePlus size={12} />}
                />
                <Field
                  label="Last updated"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconClockEdit size={12} />}
                />
              </div>
            </div>

          </div>
        )}

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <IconCalendarCheck size={12} />
            Updated {formatDate(data?.updatedAt)}
          </span>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}