"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  IconBell,
  IconBrandWhatsapp,
  IconBuilding,
  IconCalendarTime,
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
  IconId,
  IconMail,
  IconPhone,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";
import { Switch } from "@skerp/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import {
  useBranches,
  useCompanies,
  useRoles,
  useUpdateEmployee,
} from "../hooks/useEmployees";
import type { Employee } from "../types";

type FormValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  roleId: string;
  mobile: string;
  companyId: string;
  branchId: string;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
};

const fieldError = "text-xs text-destructive";

/** Keep only the local 10-digit part for editing (strips +91 / country code). */
const toLocalMobile = (value: string | null | undefined) => {
  if (!value) return "";
  return value.replace(/\D/g, "").slice(-10);
};

/** Format a stored mobile (+91XXXXXXXXXX) for display: "+91 99999 99999". */
const formatMobile = (value: string | null | undefined) => {
  const digits = toLocalMobile(value);
  if (digits.length !== 10) return value?.trim() || "Not set";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
};

const toFormValues = (employee: Employee): FormValues => ({
  firstName: employee.firstName,
  middleName: employee.middleName ?? "",
  lastName: employee.lastName,
  email: employee.email,
  roleId: employee.roleId,
  mobile: toLocalMobile(employee.mobile),
  companyId: employee.companyId,
  branchId: employee.branchId,
  whatsappOptIn: employee.whatsappOptIn,
  emailOptIn: employee.emailOptIn,
});

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const initialsOf = (employee: Employee) =>
  [employee.firstName, employee.lastName]
    .map((part) => part?.[0] ?? "")
    .join("")
    .toUpperCase() || "?";

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-sm bg-muted text-muted-foreground">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A spec-sheet panel: bordered container with an internal 2-column grid. */
function DetailPanel({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 overflow-hidden rounded-sm border border-border bg-card sm:grid-cols-2">
      {children}
    </dl>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-border px-3.5 py-2.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0 sm:odd:border-r">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

/** A single notification-channel opt-in row with an icon, copy, and a Switch. */
function PrefToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-3.5 py-3 last:border-b-0">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function EmployeeDetailDialog({
  employee,
  onClose,
  onUpdated,
}: {
  employee: Employee | null;
  onClose: () => void;
  onUpdated: (employee: Employee) => void;
}) {
  const [editing, setEditing] = useState(false);
  const updateMutation = useUpdateEmployee();
  const companies = useCompanies();
  const roles = useRoles();
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  const companyId = watch("companyId");
  const branches = useBranches(companyId);

  useEffect(() => {
    if (employee) {
      reset(toFormValues(employee));
      setEditing(false);
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, reset]);

  useEffect(() => {
    if (employee && companyId && companyId !== employee.companyId) {
      setValue("branchId", "");
    }
  }, [companyId, employee, setValue]);

  if (!employee) return null;

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const submit = handleSubmit(async (values) => {
    const updated = await updateMutation.mutateAsync({
      id: employee.id,
      data: {
        firstName: values.firstName.trim(),
        middleName: values.middleName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        roleId: values.roleId,
        mobile: values.mobile.trim() ? `+91${values.mobile.trim()}` : null,
        companyId: values.companyId,
        branchId: values.branchId,
        whatsappOptIn: values.whatsappOptIn,
        emailOptIn: values.emailOptIn,
      },
    });
    onUpdated(updated);
    reset(toFormValues(updated));
    setEditing(false);
  });

  return (
    <Dialog
      open={Boolean(employee)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-x-hidden overflow-y-auto rounded-sm p-0 sm:max-w-lg">
        <div className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initialsOf(employee)}
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-lg leading-tight">
                  {editing ? "Edit employee" : fullName}
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate">
                  {employee.email}
                </DialogDescription>
                <span
                  className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold ${
                    employee.status
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {employee.status ? (
                    <IconCheck size={13} />
                  ) : (
                    <IconX size={13} />
                  )}
                  {employee.status ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {editing ? (
          <form onSubmit={submit} noValidate>
            <div className="space-y-6 px-5 py-5">
            <Section title="Profile" icon={<IconUser size={15} />}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="editFirstName">First name</Label>
                  <Input
                    id="editFirstName"
                    {...register("firstName", {
                      required: "First name is required",
                    })}
                  />
                  {errors.firstName && (
                    <p className={fieldError}>{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editLastName">Last name</Label>
                  <Input
                    id="editLastName"
                    {...register("lastName", {
                      required: "Last name is required",
                    })}
                  />
                  {errors.lastName && (
                    <p className={fieldError}>{errors.lastName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editMiddleName">Middle name (optional)</Label>
                  <Input id="editMiddleName" {...register("middleName")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Enter a valid email address",
                      },
                    })}
                  />
                  {errors.email && (
                    <p className={fieldError}>{errors.email.message}</p>
                  )}
                </div>
              </div>
            </Section>

            <Section title="Contact" icon={<IconPhone size={16} />}>
              <div className="space-y-1.5">
                <Label htmlFor="editMobile">Phone number (optional)</Label>
                <div className="flex">
                  <span className="inline-flex select-none items-center rounded-l-sm border border-r-0 border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
                    +91
                  </span>
                  <Input
                    id="editMobile"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    placeholder="9999999999"
                    className="rounded-l-none"
                    aria-invalid={errors.mobile ? true : undefined}
                    {...register("mobile", {
                      onChange: (e) => {
                        e.target.value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                      },
                      validate: (value) =>
                        !value ||
                        /^\d{10}$/.test(value) ||
                        "Enter a 10-digit phone number",
                    })}
                  />
                </div>
                {errors.mobile && (
                  <p className={fieldError}>{errors.mobile.message}</p>
                )}
              </div>
            </Section>

            <Section title="Assignment" icon={<IconBuilding size={16} />}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Role</Label>
                  <Controller
                    control={control}
                    name="roleId"
                    rules={{ required: "Role is required" }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={roles.isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.data?.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.roleId && (
                    <p className={fieldError}>{errors.roleId.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Controller
                    control={control}
                    name="companyId"
                    rules={{ required: "Company is required" }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.data?.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.companyId && (
                    <p className={fieldError}>{errors.companyId.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Controller
                    control={control}
                    name="branchId"
                    rules={{ required: "Branch is required" }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!companyId || branches.isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              companyId
                                ? "Select branch"
                                : "Select a company first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.data?.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.branchId && (
                    <p className={fieldError}>{errors.branchId.message}</p>
                  )}
                </div>
              </div>
            </Section>

            <Section title="Notification Preferences" icon={<IconBell size={15} />}>
              <div className="overflow-hidden rounded-sm border border-border bg-card">
                <Controller
                  control={control}
                  name="whatsappOptIn"
                  render={({ field }) => (
                    <PrefToggleRow
                      icon={<IconBrandWhatsapp size={16} />}
                      title="WhatsApp notifications"
                      description="Send alerts to this employee's phone over WhatsApp."
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="emailOptIn"
                  render={({ field }) => (
                    <PrefToggleRow
                      icon={<IconMail size={16} />}
                      title="Email notifications"
                      description="Send alerts to this employee's email inbox."
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            </Section>

              {updateMutation.isError && (
                <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {(updateMutation.error as Error).message}
                </div>
              )}
            </div>

            <DialogFooter className="sticky bottom-0 mx-0 mb-0 rounded-none border-t border-border bg-card px-5 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset(toFormValues(employee));
                  setEditing(false);
                  updateMutation.reset();
                }}
              >
                <IconX size={16} />
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                <IconDeviceFloppy size={16} />
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>
            <div className="space-y-6 px-5 py-5">
              <Section title="Profile" icon={<IconId size={15} />}>
                <DetailPanel>
                  <DetailRow label="Full name" value={fullName} />
                  <DetailRow label="Username" value={employee.userName} />
                  <DetailRow
                    label="Middle name"
                    value={employee.middleName?.trim() || "Not set"}
                  />
                  <DetailRow label="Role" value={employee.role.name} />
                </DetailPanel>
              </Section>

              <Section title="Contact" icon={<IconMail size={15} />}>
                <DetailPanel>
                  <DetailRow label="Email" value={employee.email} />
                  <DetailRow
                    label="Phone number"
                    value={formatMobile(employee.mobile)}
                  />
                </DetailPanel>
              </Section>

              <Section title="Assignment" icon={<IconBuilding size={15} />}>
                <DetailPanel>
                  <DetailRow label="Company" value={employee.company.name} />
                  <DetailRow label="Branch" value={employee.branch.name} />
                </DetailPanel>
              </Section>

              <Section
                title="Notification Preferences"
                icon={<IconBell size={15} />}
              >
                <DetailPanel>
                  <DetailRow
                    label="WhatsApp"
                    value={employee.whatsappOptIn ? "Enabled" : "Disabled"}
                  />
                  <DetailRow
                    label="Email"
                    value={employee.emailOptIn ? "Enabled" : "Disabled"}
                  />
                </DetailPanel>
              </Section>

              <Section title="Timeline" icon={<IconCalendarTime size={15} />}>
                <DetailPanel>
                  <DetailRow
                    label="Created"
                    value={formatDate(employee.createdAt)}
                  />
                  <DetailRow
                    label="Updated"
                    value={formatDate(employee.updatedAt)}
                  />
                </DetailPanel>
              </Section>
            </div>

            <DialogFooter className="sticky bottom-0 mx-0 mb-0 rounded-none border-t border-border bg-card px-5 py-3">
              <Button variant="outline" onClick={onClose}>
                <IconX size={16} />
                Close
              </Button>
              <Button onClick={() => setEditing(true)}>
                <IconEdit size={16} />
                Edit
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
