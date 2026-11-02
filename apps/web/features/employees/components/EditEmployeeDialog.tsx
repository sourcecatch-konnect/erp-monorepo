"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  IconBrandWhatsapp,
  IconDeviceFloppy,
  IconMail,
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
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Switch } from "@skerp/ui/components/switch";
import {
  useBranches,
  useCompanies,
  useEmployee,
  useRoles,
  useUpdateEmployee,
} from "../hooks/useEmployees";
import type { Employee } from "../types";
import { nameOf, toLocalMobile } from "./employee.ui";

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

/** A titled band of fields. */
function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-xs font-semibold text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** One notification-channel opt-in row. */
function PrefRow({
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
    <div className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0">
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

/**
 * Edit one user. A dialog, not a panel: it is a single focused task with one
 * Save, and it is kept separate from the read-only detail sheet so viewing a
 * user can never put the form on screen by accident.
 */
export function EditEmployeeDialog({
  employeeId,
  onClose,
}: {
  employeeId: string | null;
  onClose: () => void;
}) {
  const employeeQuery = useEmployee(employeeId ?? undefined);
  const employee = employeeId ? employeeQuery.data : undefined;
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
    formState: { errors, isDirty },
  } = useForm<FormValues>();

  const companyId = watch("companyId");
  const branches = useBranches(companyId);

  /*
   * Fill the form once per opening, before the selects mount. Resetting after
   * they mount makes Radix Select report "" and the role/branch look empty.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!employeeId || !employee || loadedFor === employeeId) return;
    reset(toFormValues(employee));
    updateMutation.reset();
    setLoadedFor(employeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, employee, loadedFor, reset]);

  useEffect(() => {
    if (!employeeId) setLoadedFor(null);
  }, [employeeId]);

  // Branches belong to one company, so a company change invalidates the pick.
  useEffect(() => {
    if (employee && companyId && companyId !== employee.companyId) {
      setValue("branchId", "");
    }
  }, [companyId, employee, setValue]);

  const submit = handleSubmit((values) =>
    updateMutation.mutate(
      {
        id: employeeId!,
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
      },
      {
        onSuccess: (updated) => {
          toast.success(`${nameOf(updated)} saved`);
          onClose();
        },
      },
    ),
  );

  const ready = Boolean(employee) && loadedFor === employeeId;

  return (
    <Dialog
      open={employeeId !== null}
      onOpenChange={(open) => {
        if (!open && !updateMutation.isPending) onClose();
      }}
    >
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>
            {employee ? `Edit ${nameOf(employee)}` : "Edit user"}
          </DialogTitle>
          <DialogDescription>
            Changes apply the next time they load a page. Use Reset password to
            give them new sign-in details.
          </DialogDescription>
        </DialogHeader>

        {!ready ? (
          <div className="space-y-4 px-5 py-5">
            {employeeQuery.isError ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-foreground">
                  {employeeQuery.error.message}
                </p>
                <Button
                  variant="outline"
                  onClick={() => void employeeQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-28 w-full" />
              </>
            )}
          </div>
        ) : (
          <form
            onSubmit={submit}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <Fieldset title="Name">
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
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="editMiddleName">
                      Middle name (optional)
                    </Label>
                    <Input id="editMiddleName" {...register("middleName")} />
                  </div>
                </div>
              </Fieldset>

              <Fieldset title="Contact">
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
              </Fieldset>

              <Fieldset title="Role and posting">
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
                          onValueChange={(v) => v && field.onChange(v)}
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
                          onValueChange={(v) => v && field.onChange(v)}
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
                          onValueChange={(v) => v && field.onChange(v)}
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
              </Fieldset>

              <Fieldset title="Alerts">
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <Controller
                    control={control}
                    name="whatsappOptIn"
                    render={({ field }) => (
                      <PrefRow
                        icon={<IconBrandWhatsapp size={16} />}
                        title="WhatsApp"
                        description="Send alerts to their phone over WhatsApp."
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="emailOptIn"
                    render={({ field }) => (
                      <PrefRow
                        icon={<IconMail size={16} />}
                        title="Email"
                        description="Send alerts to their email inbox."
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </Fieldset>

              {updateMutation.isError && (
                <p
                  role="alert"
                  className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {updateMutation.error.message}
                </p>
              )}
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-none border-t border-border bg-card px-5 py-3">
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || !isDirty}
              >
                <IconDeviceFloppy className="size-4" aria-hidden />
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
