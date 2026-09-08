"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { Input } from "@skerp/ui/components/input";
import { Button } from "@skerp/ui/components/button";
import { Label } from "@skerp/ui/components/lable";
import { ROUTES } from "@/config/routes";
import { requestPasswordReset } from "../services/auth.service";

type FormValues = { email: string };

/** Step 1 of password recovery — request a reset link by email. */
export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await requestPasswordReset(data.email);
      setSent(true);
    } catch (err) {
      // A 429 from the rate limiter lands here — surface its message.
      setFormError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-8">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="rounded-sm border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
              If <span className="font-medium">{getValues("email")}</span> is
              registered, a password reset link is on its way. The link expires
              in 30 minutes.
            </div>
            <Button asChild variant="primary" className="h-11 w-full">
              <Link href={ROUTES.login}>Back to sign in</Link>
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@sktranslines.com"
                  className="h-11 placeholder:px-2 px-2"
                  aria-invalid={!!errors.email}
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address",
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="h-11 w-full"
              >
                {isSubmitting ? "Sending…" : "Send reset link"}
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
