"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { generatePassword } from "@/lib/password";
import { useResetEmployeePassword } from "../hooks/useEmployees";
import type { EmployeeCredentials, EmployeeListRow } from "../types";

type FormValues = { password: string };

/** Sets a new password for an existing employee. */
export function ResetPasswordDialog({
  employee,
  onClose,
  onReset,
}: {
  employee: Pick<EmployeeListRow, "id" | "firstName" | "lastName"> | null;
  onClose: () => void;
  onReset: (credentials: EmployeeCredentials) => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { password: "" } });

  const resetMutation = useResetEmployeePassword();

  // Fresh generated password each time the dialog opens.
  useEffect(() => {
    if (employee) {
      reset({ password: generatePassword() });
      resetMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  const submit = handleSubmit(async (values) => {
    if (!employee) return;
    const result = await resetMutation.mutateAsync({
      id: employee.id,
      password: values.password,
    });
    onReset({
      name: `${result.employee.firstName} ${result.employee.lastName}`,
      email: result.employee.email,
      password: values.password,
      emailSent: result.emailSent,
    });
    onClose();
  });

  return (
    <Dialog
      open={Boolean(employee)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {employee
              ? `Set a new password for ${employee.firstName} ${employee.lastName}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <div className="flex gap-2">
              <Input
                id="newPassword"
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
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {resetMutation.isError && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(resetMutation.error as Error).message}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? "Saving…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
