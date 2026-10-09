"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { generatePassword } from "@/lib/password";
import {
  useBranches,
  useCompanies,
  useCreateEmployee,
  useRoles,
} from "../hooks/useEmployees";
import type { EmployeeCredentials } from "../types";

type FormValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  password: string;
  companyId: string;
  branchId: string;
  roleId: string;
};

const emptyValues = (): FormValues => ({
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  password: generatePassword(),
  companyId: "",
  branchId: "",
  roleId: "",
});

const fieldError = "text-xs text-destructive";

export function CreateEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (credentials: EmployeeCredentials) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: emptyValues() });

  const companyId = watch("companyId");
  const companies = useCompanies();
  const branches = useBranches(companyId);
  const roles = useRoles();
  const createMutation = useCreateEmployee();

  // Fresh form (and password) each time the dialog opens.
  useEffect(() => {
    if (open) {
      reset(emptyValues());
      createMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Clear the branch whenever the company changes.
  useEffect(() => {
    setValue("branchId", "");
  }, [companyId, setValue]);

  const submit = handleSubmit(async (values) => {
    const result = await createMutation.mutateAsync({
      firstName: values.firstName,
      middleName: values.middleName.trim() || undefined,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      companyId: values.companyId,
      branchId: values.branchId,
      roleId: values.roleId,
    });
    onCreated({
      name: `${result.employee.firstName} ${result.employee.lastName}`,
      email: result.employee.email,
      password: values.password,
      emailSent: result.emailSent,
    });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Select a role and create login credentials for this user.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                {...register("firstName", {
                  required: "First name is required",
                })}
              />
              {errors.firstName && (
                <p className={fieldError}>{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                {...register("lastName", {
                  required: "Last name is required",
                })}
              />
              {errors.lastName && (
                <p className={fieldError}>{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="middleName">Middle name (optional)</Label>
            <Input id="middleName" {...register("middleName")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Controller
                control={control}
                name="companyId"
                rules={{ required: "Company is required" }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                          companyId ? "Select branch" : "Select a company first"
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

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setValue("password", generatePassword(), {
                    shouldValidate: true,
                  })
                }
              >
                Regenerate
              </Button>
            </div>
            {errors.password && (
              <p className={fieldError}>{errors.password.message}</p>
            )}
          </div>

          {createMutation.isError && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(createMutation.error as Error).message}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
