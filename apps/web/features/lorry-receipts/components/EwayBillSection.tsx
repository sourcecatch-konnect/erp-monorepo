"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconFileInvoice, IconPencil, IconPlus } from "@tabler/icons-react";

import { addEwayBillSchema } from "@skerp/validators/lorry-receipt";
import type {
  AddEwayBillFormInput,
  AddEwayBillBody,
  EwayBill,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { formatDate } from "@/lib/format";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { lorryReceiptApi } from "../lorry-receipt.service";
import { lrKeys } from "../lorry-receipt.keys";
import { lrGroupKeys } from "../lr-group.keys";

type Props = {
  lrId: string;
  groupId: string;
  ewayBill: EwayBill | null;
  canEdit: boolean;
};
function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDate(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return "";
  }

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return formatDateInput(date);
}
export default function EwayBillSection({
  lrId,
  groupId,
  ewayBill,
  canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);

  const form = useForm<AddEwayBillFormInput, unknown, AddEwayBillBody>({
    resolver: zodResolver(addEwayBillSchema),
    defaultValues: {
      ewayBillNo: "",
      generatedAt: "" as unknown as Date,
      expiresAt: "" as unknown as Date,
      generatedBy: "",
      documentUrl: "",
    },
  });

  const isEditing = Boolean(ewayBill);

  const save = useMutation({
    mutationFn: (body: AddEwayBillBody) =>
      isEditing
        ? lorryReceiptApi.updateEwayBill(lrId, body)
        : lorryReceiptApi.addEwayBill(lrId, body),

    onSuccess: () => {
      toast.success(
        isEditing
          ? "E-way bill updated"
          : "E-way bill added",
      );

      setAddOpen(false);
      form.reset();

      queryClient.invalidateQueries({
        queryKey: lrKeys.detail(lrId),
      });

      queryClient.invalidateQueries({
        queryKey: lrKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey: lrGroupKeys.detail(groupId),
      });

      queryClient.invalidateQueries({
        queryKey: lrGroupKeys.all,
      });
    },

    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const onSubmit = (values: AddEwayBillBody) => {
    save.mutate(values);
  };
  const today = React.useMemo(() => formatDateInput(new Date()), []);

  const tomorrow = React.useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);

    return formatDateInput(date);
  }, []);

  const generatedAt = form.watch("generatedAt") as unknown as string;

  const minimumExpiryDate = generatedAt
    ? addDaysToDate(generatedAt, 1)
    : tomorrow;
  const openEwayBillForm = () => {
    if (ewayBill) {
      form.reset({
        ewayBillNo: ewayBill.ewayBillNo,
        generatedAt: ewayBill.generatedAt.slice(0, 10),
        expiresAt: ewayBill.expiresAt.slice(0, 10),
        generatedBy: ewayBill.generatedBy ?? "",
        documentUrl: ewayBill.documentUrl ?? "",
      });
    } else {
      form.reset({
        ewayBillNo: "",
        generatedAt: "",
        expiresAt: "",
        generatedBy: "",
        documentUrl: "",
      });
    }

    setAddOpen(true);
  };
  return (
    <div className="mt-5 space-y-3 border-t border-border pt-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <IconFileInvoice size={17} className="text-primary" /> E-way bill
        </h3>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={openEwayBillForm}
          >
            {ewayBill ? (
              <IconPencil size={14} className="mr-1" />
            ) : (
              <IconPlus size={14} className="mr-1" />
            )}

            {ewayBill ? "Edit" : "Add"}
          </Button>
        )}
      </div>

      {!ewayBill ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          No e-way bill has been added to this LR.
        </div>
      ) : (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-base font-semibold">
              {ewayBill.ewayBillNo}
            </span>
            <span
              className={`rounded-sm px-2 py-1 text-xs font-semibold ${new Date(ewayBill.expiresAt) < new Date() ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}
            >
              Expires {formatDate(ewayBill.expiresAt)}
            </span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Generated {formatDate(ewayBill.generatedAt)}
            {ewayBill.generatedBy ? ` by ${ewayBill.generatedBy}` : ""}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit E-Way Bill" : "Add E-Way Bill"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the e-way bill details before finalising the LR."
                : "Add the e-way bill details before finalising the LR."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                E-way bill number <span className="text-destructive">*</span>
              </label>
              <Input
                {...form.register("ewayBillNo")}
                placeholder="12-digit number"
                className="h-9"
              />
              {form.formState.errors.ewayBillNo?.message && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.ewayBillNo.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Generated on <span className="text-destructive">*</span>
                </label>

                <Input
                  {...form.register("generatedAt", {
                    onChange: (event) => {
                      const selectedGeneratedDate = event.target.value;

                      const currentExpiryDate = form.getValues(
                        "expiresAt",
                      ) as unknown as string;

                      if (
                        currentExpiryDate &&
                        currentExpiryDate <= selectedGeneratedDate
                      ) {
                        form.setValue("expiresAt", "" as unknown as Date, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }
                    },
                  })}
                  type="date"
                  max={today}
                  className="h-9"
                />

                {form.formState.errors.generatedAt?.message ? (
                  <p className="mt-1 text-xs text-destructive">
                    {String(form.formState.errors.generatedAt.message)}
                  </p>
                ) : null}

                <p className="mt-1 text-xs text-muted-foreground">
                  Future dates are not allowed.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Expires on <span className="text-destructive">*</span>
                </label>

                <Input
                  {...form.register("expiresAt")}
                  type="date"
                  min={minimumExpiryDate}
                  className="h-9"
                />

                {form.formState.errors.expiresAt?.message ? (
                  <p className="mt-1 text-xs text-destructive">
                    {String(form.formState.errors.expiresAt.message)}
                  </p>
                ) : null}

                <p className="mt-1 text-xs text-muted-foreground">
                  Select a date after the generated date.
                </p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Generated by
              </label>
              <Input
                {...form.register("generatedBy")}
                placeholder="Name or org"
                className="h-9"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending
                  ? "Saving…"
                  : isEditing
                    ? "Save changes"
                    : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
