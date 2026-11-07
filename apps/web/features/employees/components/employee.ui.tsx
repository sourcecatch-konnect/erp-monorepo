"use client";

import { IconCircleCheck, IconCircleOff } from "@tabler/icons-react";
import { cn } from "@skerp/ui/lib/util";
import type { EmployeeListRow } from "../types";

/** A user's full name, skipping the parts they don't have. */
export const nameOf = (employee: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}) =>
  [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

/** Two letters for the avatar, from the first and last name. */
export const initialsOf = (employee: { firstName: string; lastName: string }) =>
  [employee.firstName, employee.lastName]
    .map((part) => part?.[0] ?? "")
    .join("")
    .toUpperCase() || "?";

/** Keep only the local 10-digit part for editing (strips +91 / country code). */
export const toLocalMobile = (value: string | null | undefined) =>
  value ? value.replace(/\D/g, "").slice(-10) : "";

/** Format a stored mobile (+91XXXXXXXXXX) for display: "+91 99999 99999". */
export const formatMobile = (value: string | null | undefined) => {
  const digits = toLocalMobile(value);
  if (digits.length !== 10) return value?.trim() || "Not set";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
};

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

/**
 * The round initials tile that stands in for a photo. One deterministic
 * colour per user (hashed from their id) so a face in the list is
 * recognisable at a glance instead of every row looking the same.
 */
const AVATAR_TONES = [
  "bg-learn-1-soft text-learn-1",
  "bg-learn-2-soft text-learn-2",
  "bg-learn-3-soft text-learn-3",
  "bg-learn-4-soft text-learn-4",
  "bg-learn-5-soft text-learn-5",
  "bg-learn-6-soft text-learn-6",
];

const toneFor = (id: string) => {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]!;
};

export function UserAvatar({
  employee,
  className,
}: {
  employee: Pick<EmployeeListRow, "id" | "firstName" | "lastName">;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        toneFor(employee.id),
        className,
      )}
    >
      {initialsOf(employee)}
    </span>
  );
}

/** Can this person sign in? Shown wherever a user is listed or opened. */
export function UserStatusBadge({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const Icon = active ? IconCircleCheck : IconCircleOff;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold",
        active
          ? "bg-success/10 text-success"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/** The user's role, as a quiet chip so it reads apart from plain text. */
export function RoleChip({ name }: { name: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-sm border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground">
      {name}
    </span>
  );
}
