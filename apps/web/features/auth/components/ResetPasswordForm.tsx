"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@skerp/ui/components/input";
import { Button } from "@skerp/ui/components/button";
import { Label } from "@skerp/ui/components/lable";
import { ROUTES } from "@/config/routes";
import { resetPassword } from "../services/auth.service";

type FormValues = {
  password: string;
  confirmPassword: string;
};

/** Step 2 of password recovery — set a new password using the emailed token. */
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await resetPassword(token, data.password);
      setDone(true);
      setTimeout(() => router.replace(ROUTES.login), 2500);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Could not reset your password. Try again.",
      );
    }
  });

  const invalidLink = !token;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-8">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Choose a new password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your reset link is valid for 30 minutes.
          </p>
        </div>

        {invalidLink ? (
          <div className="space-y-6">
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              This reset link is missing its token. Request a new link and try
              again.
            </div>
            <Button asChild variant="primary" className="h-11 w-full">
              <Link href={ROUTES.forgotPassword}>Request a new link</Link>
            </Button>
          </div>
        ) : done ? (
          <div className="space-y-6">
            <div className="rounded-sm border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
              Your password has been reset. Redirecting you to sign in…
            </div>
            <Button asChild variant="primary" className="h-11 w-full">
              <Link href={ROUTES.login}>Go to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            {formError && (
              <div className="mb-5 rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="h-11 pr-16 placeholder:px-2 px-2"
                    aria-invalid={!!errors.password}
                    {...register("password", {
                      required: "Password is required",
                      minLength: {
                        value: 8,
                        message: "Password must be at least 8 characters",
                      },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  className="h-11 placeholder:px-2 px-2"
                  aria-invalid={!!errors.confirmPassword}
                  {...register("confirmPassword", {
                    required: "Please confirm your password",
                    validate: (value) =>
                      value === watch("password") || "Passwords do not match",
                  })}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="h-11 w-full"
              >
                {isSubmitting ? "Resetting…" : "Reset password"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link
                href={ROUTES.login}
                className="font-medium text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
