"use client";

import type { ReactNode } from "react";
import {
  IconAt,
  IconBuildingStore,
  IconCalendarPlus,
  IconCircleCheck,
  IconCircleX,
  IconClockEdit,
  IconId,
  IconMail,
  IconShieldLock,
  IconUser,
} from "@tabler/icons-react";
import type { AuthUser } from "@/features/auth/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@skerp/ui/components/Card";

const fullName = (user: AuthUser): string =>
  [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

type Row = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
};

function DetailRow({ icon, label, value }: Row) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="truncate text-sm font-medium text-foreground">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
        active
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {active ? (
        <IconCircleCheck className="size-3.5" />
      ) : (
        <IconCircleX className="size-3.5" />
      )}
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function ProfileDetailsCard({ user }: { user: AuthUser }) {
  const personal: Row[] = [
    {
      icon: <IconUser className="size-5" />,
      label: "Full name",
      value: fullName(user),
    },
    {
      icon: <IconAt className="size-5" />,
      label: "Username",
      value: user.userName,
    },
    {
      icon: <IconMail className="size-5" />,
      label: "Email",
      value: user.email,
    },
  ];

  const account: Row[] = [
    {
      icon: <IconShieldLock className="size-5" />,
      label: "Role",
      value: user.role?.name,
    },
    {
      icon: <IconCircleCheck className="size-5" />,
      label: "Status",
      value: <StatusPill active={user.status} />,
    },
    {
      icon: <IconBuildingStore className="size-5" />,
      label: "Branch scope",
      value: user.branchScope === "ALL" ? "All branches" : "Assigned branches",
    },
    {
      icon: <IconId className="size-5" />,
      label: "User ID",
      value: <span className="font-mono text-xs">{user.id}</span>,
    },
    {
      icon: <IconCalendarPlus className="size-5" />,
      label: "Member since",
      value: formatDate(user.createdAt),
    },
    {
      icon: <IconClockEdit className="size-5" />,
      label: "Last updated",
      value: formatDate(user.updatedAt),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>
            Your name and contact details on this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {personal.map((row) => (
            <DetailRow key={row.label} {...row} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account &amp; access</CardTitle>
          <CardDescription>
            Role, status and access scope assigned by your administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-6 sm:grid-cols-2 [&>*]:border-b [&>*]:border-border">
          {account.map((row) => (
            <DetailRow key={row.label} {...row} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
