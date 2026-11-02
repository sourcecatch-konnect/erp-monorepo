"use client";

import type { ReactNode } from "react";
import {
  IconAt,
  IconBrandWhatsapp,
  IconBuilding,
  IconBuildingStore,
  IconCalendarPlus,
  IconClockEdit,
  IconEdit,
  IconId,
  IconKey,
  IconMail,
  IconPhone,
  type Icon,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { useEmployee } from "../hooks/useEmployees";
import {
  RoleChip,
  UserAvatar,
  UserStatusBadge,
  formatDateTime,
  formatMobile,
  nameOf,
} from "./employee.ui";

function DetailRow({
  icon: RowIcon,
  label,
  children,
}: {
  icon: Icon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[105px_minmax(0,1fr)] items-start gap-2 py-1.5 sm:grid-cols-[115px_minmax(0,1fr)]">
      <dt className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
        <RowIcon
          className="size-3.5 shrink-0 text-muted-foreground/70"
          aria-hidden
        />
        {label}
      </dt>

      <dd className="min-w-0 break-words text-sm font-medium leading-5 text-foreground">
        {children}
      </dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="py-3 first:pt-0 last:pb-0">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>

      <dl>{children}</dl>
    </section>
  );
}

function Preference({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={
        enabled
          ? "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
          : "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      }
    >
      <span
        aria-hidden
        className={
          enabled
            ? "size-1.5 rounded-full bg-emerald-500"
            : "size-1.5 rounded-full bg-muted-foreground/40"
        }
      />
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export function EmployeeDetailSheet({
  employeeId,
  onClose,
  onEdit,
  onResetPassword,
}: {
  employeeId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onResetPassword: (id: string) => void;
}) {
  const employeeQuery = useEmployee(employeeId ?? undefined);
  const employee = employeeId ? employeeQuery.data : undefined;

  return (
    <Sheet
      open={employeeId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex min-h-0 flex-col gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        {employee ? (
          <>
            {/* Fixed profile header */}
            <SheetHeader className="shrink-0 gap-0 border-b border-border/70 bg-muted/20 p-0 text-left">
              <div className="px-5 pt-5 pr-12 sm:px-6 sm:pr-12">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Employee details
                </p>
              </div>

              <div className="flex items-start gap-3.5 px-5 pt-4 pb-5 sm:px-6">
                <UserAvatar
                  employee={employee}
                  className="size-14 shrink-0 text-base ring-4 ring-background"
                />

                <div className="min-w-0 flex-1">
                  <SheetTitle className="break-words text-lg font-semibold leading-tight tracking-tight">
                    {nameOf(employee)}
                  </SheetTitle>

                  <SheetDescription className="mt-1 break-all text-xs leading-relaxed">
                    {employee.email}
                  </SheetDescription>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <UserStatusBadge active={employee.status} />
                    <RoleChip name={employee.role.name} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-5 pb-4 sm:px-6">
                <Button
                  type="button"
                  className="h-9 gap-2 rounded-lg px-4 text-xs"
                  onClick={() => onEdit(employee.id)}
                >
                  <IconEdit className="size-3.5 shrink-0" aria-hidden />
                  Edit details
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2 rounded-lg bg-background px-3 text-xs shadow-none"
                  onClick={() => onResetPassword(employee.id)}
                >
                  <IconKey className="size-3.5 shrink-0" aria-hidden />
                  Reset password
                </Button>
              </div>
            </SheetHeader>

            {/* Scrollable flat details */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
              <div className="divide-y divide-border/70">
                <DetailSection title="Account & contact">
                  <DetailRow icon={IconId} label="Username">
                    <span className="font-mono text-xs">
                      {employee.userName}
                    </span>
                  </DetailRow>

                  <DetailRow icon={IconAt} label="Email">
                    <a
                      href={`mailto:${employee.email}`}
                      className="rounded-sm transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {employee.email}
                    </a>
                  </DetailRow>

                  <DetailRow icon={IconPhone} label="Phone">
                    {formatMobile(employee.mobile)}
                  </DetailRow>
                </DetailSection>

                <DetailSection title="Organisation">
                  <DetailRow icon={IconBuilding} label="Company">
                    {employee.company.name}
                  </DetailRow>

                  <DetailRow icon={IconBuildingStore} label="Branch">
                    {employee.branch.name}
                  </DetailRow>
                </DetailSection>

                <DetailSection title="Notification preferences">
                  <DetailRow icon={IconBrandWhatsapp} label="WhatsApp">
                    <Preference enabled={employee.whatsappOptIn} />
                  </DetailRow>

                  <DetailRow icon={IconMail} label="Email alerts">
                    <Preference enabled={employee.emailOptIn} />
                  </DetailRow>
                </DetailSection>

                <DetailSection title="Account history">
                  <DetailRow icon={IconCalendarPlus} label="Created">
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatDateTime(employee.createdAt)}
                    </span>
                  </DetailRow>

                  <DetailRow icon={IconClockEdit} label="Last updated">
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatDateTime(employee.updatedAt)}
                    </span>
                  </DetailRow>
                </DetailSection>
              </div>
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="shrink-0 border-b border-border/70 px-5 py-5 pr-12 sm:px-6 sm:pr-12">
              <SheetTitle className="text-base">
                Employee details
              </SheetTitle>

              <SheetDescription className="text-xs">
                {employeeQuery.isError
                  ? "We couldn’t load this employee."
                  : "Loading employee information…"}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {employeeQuery.isError ? (
                <div
                  role="alert"
                  className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4"
                >
                  <p className="break-words text-sm text-destructive">
                    {employeeQuery.error.message}
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void employeeQuery.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <div
                  role="status"
                  aria-label="Loading employee details"
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-14 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full max-w-56" />
                      <Skeleton className="h-5 w-28" />
                    </div>
                  </div>

                  {[0, 1, 2].map((section) => (
                    <div key={section} className="space-y-4">
                      <Skeleton className="h-3 w-28" />

                      {[0, 1].map((row) => (
                        <div
                          key={row}
                          className="grid grid-cols-[112px_minmax(0,1fr)] gap-3"
                        >
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}