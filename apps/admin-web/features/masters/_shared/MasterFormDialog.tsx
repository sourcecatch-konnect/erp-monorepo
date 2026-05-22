"use client";

import * as React from "react";
import { FieldValues, FormProvider, UseFormReturn } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@skerp/ui/components/dialog";

import { Button } from "@skerp/ui/components/button";

type Props<TFormValues extends FieldValues> = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  form: UseFormReturn<TFormValues>;
  onSubmit: (data: TFormValues) => Promise<void>;
  isSubmitting?: boolean;
  children: React.ReactNode;
};

export default function MasterFormDialog<TFormValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  form,
  onSubmit,
  isSubmitting,
  children,
}: Props<TFormValues>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-semibold">
            {title}
          </DialogTitle>

          <DialogDescription>
            Fill in the details below to continue.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="grid gap-4 py-2">{children}</div>

            <DialogFooter className="gap-2">
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
