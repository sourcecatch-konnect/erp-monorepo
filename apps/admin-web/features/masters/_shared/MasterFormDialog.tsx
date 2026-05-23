"use client";

import * as React from "react";
import {
  FieldValues,
  FormProvider,
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
}: Props<TFieldValues, TSubmitValues>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${widthClassByColumns[columns]} max-h-[90vh] overflow-hidden`}
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
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div
              className={`grid ${gridClassByColumns[columns]} gap-4 overflow-y-auto px-1 py-3 pr-2`}
            >
              {children}
            </div>

            <DialogFooter className="mt-4 gap-2 border-t pt-4">
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