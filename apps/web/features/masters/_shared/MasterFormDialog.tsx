"use client";

import * as React from "react";
import {
  FieldValues,
  FormProvider,
  Path,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";

type Props<
  TFieldValues extends FieldValues,
  TSubmitValues extends FieldValues = TFieldValues
> = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  form: UseFormReturn<TFieldValues, unknown, TSubmitValues>;
  onSubmit: SubmitHandler<TSubmitValues>;
  isSubmitting?: boolean;
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  footerLeft?: React.ReactNode;
  contentClassName?: string;
};

const gridClassByColumns = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
};

const widthClassByColumns = {
  1: "sm:max-w-lg",
  2: "sm:max-w-3xl",
  3: "sm:max-w-5xl",
};

type ServerValidationDetails = {
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

const getValidationDetails = (
  error: unknown
): ServerValidationDetails | undefined => {
  if (!error || typeof error !== "object" || !("details" in error)) {
    return undefined;
  }

  const details = (error as { details?: unknown }).details;

  if (!details || typeof details !== "object") {
    return undefined;
  }

  return details as ServerValidationDetails;
};

export default function MasterFormDialog<
  TFieldValues extends FieldValues,
  TSubmitValues extends FieldValues = TFieldValues
>({
  open,
  onOpenChange,
  title,
  form,
  onSubmit,
  isSubmitting,
  children,
  columns = 1,
  footerLeft,
  contentClassName,
}: Props<TFieldValues, TSubmitValues>) {
  const rootError = form.formState.errors.root?.message;

  const handleValidSubmit: SubmitHandler<TSubmitValues> = async (values) => {
    form.clearErrors("root");

    try {
      await onSubmit(values);
    } catch (error) {
      const details = getValidationDetails(error);

      for (const [name, messages] of Object.entries(
        details?.fieldErrors ?? {}
      )) {
        const message = messages?.[0];

        if (message) {
          form.setError(name as Path<TFieldValues>, {
            type: "server",
            message,
          });
        }
      }

      const hasFieldErrors = Object.keys(details?.fieldErrors ?? {}).length > 0;

      if (!hasFieldErrors) {
        const message = details?.formErrors?.[0] || getErrorMessage(error);

        form.setError("root", {
          type: "server",
          message,
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement;

          if (target.closest(".pac-container")) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement;

          if (target.closest(".pac-container")) {
            event.preventDefault();
          }
        }}
        className={`${widthClassByColumns[columns]} max-h-[90vh] overflow-hidden ${contentClassName ?? ""
          }`}
      >
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>

          <DialogDescription>
            Fill in the details below to continue.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            className="flex max-h-[calc(90vh-120px)] flex-col"
            onSubmit={form.handleSubmit(handleValidSubmit)}
          >
            <div
              className={`grid ${gridClassByColumns[columns]} gap-4 overflow-y-auto px-1 py-3 pr-2`}
            >
              {children}
            </div>

            <DialogFooter className="mt-4 gap-2 border-t pt-4">
              {footerLeft && <div className="mr-auto">{footerLeft}</div>}

              {typeof rootError === "string" ? (
                <p className="mr-auto text-sm text-red-600">{rootError}</p>
              ) : null}

              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
