"use client";

import * as React from "react";
import { Controller, useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus } from "@tabler/icons-react";

import { createTripExpenseSchema } from "@skerp/validators";
import type {
  TripExpenseFormInput,
  VehicleJourney,
  TripExpense,
} from "@skerp/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
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
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";

import { paiseToRupees, formatPaise } from "@/lib/money";
import { toValidDate } from "@/lib/date";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import IconTextField from "../masters/_shared/fields/IconTextField";
import SelectField from "../masters/_shared/fields/SelectField";
import CheckboxField from "../masters/_shared/fields/CheckBoxField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { expenseApi, expenseTypeApi, journeyLookups } from "./journey.service";
import { journeyKeys, journeyLookupKeys } from "./journey.keys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: VehicleJourney;
  /** When set, the drawer edits this draft expense instead of creating. */
  expense?: TripExpense | null;
};

const PAYMENT_MODE_OPTIONS = [
  { value: "CASH", label: "Cash (driver advance)" },
  { value: "CREDIT", label: "Credit (pump/vendor)" },
  { value: "CARD", label: "Card / fuel card" },
  { value: "BANK", label: "Bank" },
  { value: "UPI", label: "UPI" },
];

export default function TripExpenseDrawer({
  open,
  onOpenChange,
  journey,
  expense,
}: Props) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = React.useState(false);
  const [newTypeName, setNewTypeName] = React.useState("");

  const pumps = useQuery({
    queryKey: journeyLookupKeys.pumps,
    queryFn: journeyLookups.pumps,
    enabled: open,
  });
  const cities = useQuery({
    queryKey: journeyLookupKeys.cities,
    queryFn: journeyLookups.cities,
    enabled: open,
  });
  const expenseTypes = useQuery({
    queryKey: journeyLookupKeys.expenseTypes,
    queryFn: expenseTypeApi.list,
    enabled: open,
  });
  const legOptions = React.useMemo(
    () =>
      (journey.trips ?? [])
        .filter((l) => l.status !== "Cancelled")
        .map((l) => ({
          value: l.id,
          label: `Leg ${l.sequenceNo ?? "?"}: ${l.fromCity?.name ?? "?"} → ${l.toCity?.name ?? "?"}`,
        })),
    [journey.trips],
  );

  const defaults = React.useCallback(
    (): Partial<TripExpenseFormInput> =>
      expense
        ? {
            journeyId: journey.id,
            tripId: expense.tripId ?? undefined,
            expenseTypeId: expense.expenseTypeId,
            amount: paiseToRupees(expense.amountPaise),
            paymentMode: expense.paymentMode,
            cityId: expense.cityId ?? undefined,
            pumpId: expense.pumpId ?? undefined,
            dieselQty: expense.dieselQty ?? undefined,
            dieselRate: expense.dieselRatePaise
              ? paiseToRupees(expense.dieselRatePaise)
              : undefined,
            receiptNo: expense.receiptNo ?? undefined,
            paidByDriver: expense.paidByDriver,
            remarks: expense.remarks ?? undefined,
          }
        : {
            journeyId: journey.id,
            expenseTypeId: "",
            paymentMode: "CASH",
            paidByDriver: true,
          },
    [expense, journey.id],
  );

  const form = useForm<TripExpenseFormInput, unknown, TripExpenseFormInput>({
    // Validate rupee inputs in the browser, but leave the conversion to paise
    // to the server's schema so money fields are not transformed twice.
    resolver: zodResolver(createTripExpenseSchema, undefined, { raw: true }),
    defaultValues: defaults(),
  });

  const createExpenseType = useMutation({
    mutationFn: expenseTypeApi.create,
    onSuccess: (created) => {
      queryClient.setQueryData(
        journeyLookupKeys.expenseTypes,
        (current: typeof expenseTypes.data) => [...(current ?? []), created],
      );
      form.setValue("expenseTypeId", created.id, { shouldValidate: true });
      setNewTypeName("");
      setTypeDialogOpen(false);
      toast.success(`Expense type “${created.name}” added`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  React.useEffect(() => {
    if (open) form.reset(defaults());
  }, [open, form, defaults]);

  React.useEffect(() => {
    if (!open || expense || form.getValues("expenseTypeId")) return;
    const diesel = expenseTypes.data?.find(
      (type) => type.requiresDieselDetails,
    );
    const fallback = diesel ?? expenseTypes.data?.[0];
    if (fallback) form.setValue("expenseTypeId", fallback.id);
  }, [open, expense, expenseTypes.data, form]);

  const expenseTypeId = form.watch("expenseTypeId");
  const paymentMode = form.watch("paymentMode");
  const dieselQty = form.watch("dieselQty");
  const dieselRate = form.watch("dieselRate");
  const selectedExpenseType = expenseTypes.data?.find(
    (type) => type.id === expenseTypeId,
  );
  const isDiesel = selectedExpenseType?.requiresDieselDetails ?? false;

  // Diesel amount = qty × rate, auto-calculated as the operator types.
  React.useEffect(() => {
    if (!isDiesel) return;
    const qty = Number(dieselQty);
    const rate = Number(dieselRate);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
      form.setValue("amount", Math.round(qty * rate * 100) / 100);
    }
  }, [isDiesel, dieselQty, dieselRate, form]);

  // CASH normally means the driver paid from the advance.
  React.useEffect(() => {
    form.setValue("paidByDriver", paymentMode === "CASH");
  }, [paymentMode, form]);

  const onSubmit = async (values: TripExpenseFormInput) => {
    setSubmitting(true);
    try {
      if (expense) {
        await expenseApi.update(expense.id, values);
        toast.success("Expense updated");
      } else {
        const created = await expenseApi.create(values);
        toast.success(`Expense recorded (${formatPaise(created.amountPaise)})`);
      }
      queryClient.invalidateQueries({ queryKey: journeyKeys.all });
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {expense ? "Edit Expense" : "Add Expense"} — {journey.journeyNumber}
          </SheetTitle>
          <SheetDescription>
            Cash expenses settle against the driver advance at log slip time;
            credit and card expenses go to the pump/vendor ledger.
          </SheetDescription>
        </SheetHeader>

        <FormProvider {...form}>
          <form
            id="trip-expense-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 space-y-3 p-4"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <SelectField
                name="expenseTypeId"
                label="Expense type"
                required
                options={(expenseTypes.data ?? []).map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="mb-px"
                title="Add another expense type"
                aria-label="Add another expense type"
                onClick={() => setTypeDialogOpen(true)}
              >
                <IconPlus size={17} />
              </Button>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              Can’t find the right category? Add one with the + button.
            </p>
            <ComboboxField
              name="tripId"
              label="Trip leg"
              options={legOptions}
              placeholder="Whole journey"
            />
            <SelectField
              name="paymentMode"
              label="Payment mode"
              required
              options={PAYMENT_MODE_OPTIONS}
            />

            {isDiesel ? (
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <ComboboxField
                  name="pumpId"
                  label="Pump"
                  options={pumps.data ?? []}
                />
                <div className="grid grid-cols-2 gap-3">
                  <IconTextField<TripExpenseFormInput>
                    name="dieselQty"
                    label="Quantity (L)"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                  />
                  <IconTextField<TripExpenseFormInput>
                    name="dieselRate"
                    label="Rate / L"
                    type="number"
                    min={0}
                    step="0.01"
                    prefix="₹"
                  />
                </div>
              </div>
            ) : null}

            <IconTextField<TripExpenseFormInput>
              name="amount"
              label="Amount"
              type="number"
              min={0}
              step="0.01"
              prefix="₹"
              required
              hint={isDiesel ? "Auto-calculated from qty × rate" : undefined}
            />

            <ComboboxField
              name="cityId"
              label="City"
              options={cities.data ?? []}
            />

            <Controller
              name="expenseDate"
              control={form.control}
              render={({ field }) => (
                <DateTimePicker
                  label="Expense date"
                  selected={toValidDate(field.value)}
                  onSelect={field.onChange}
                  placeholder="Select expense date and time"
                />
              )}
            />

            <IconTextField<TripExpenseFormInput>
              name="receiptNo"
              label="Bill / receipt no."
            />

            <CheckboxField<TripExpenseFormInput>
              control={form.control}
              name="paidByDriver"
              label="Paid by driver from advance"
            />

            <TextAreaField<TripExpenseFormInput>
              name="remarks"
              label="Remarks"
              rows={2}
            />
          </form>
        </FormProvider>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="trip-expense-form" disabled={submitting}>
            {submitting ? "Saving…" : expense ? "Save Expense" : "Add Expense"}
          </Button>
        </SheetFooter>
      </SheetContent>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add expense type</DialogTitle>
            <DialogDescription>
              This category becomes available to every user for future trip
              expenses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="new-expense-type" className="text-sm font-medium">
              Type name
            </label>
            <Input
              id="new-expense-type"
              value={newTypeName}
              maxLength={80}
              autoFocus
              placeholder="Example: Border entry fee"
              onChange={(event) => setNewTypeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newTypeName.trim().length >= 2) {
                  event.preventDefault();
                  createExpenseType.mutate(newTypeName.trim());
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTypeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                newTypeName.trim().length < 2 || createExpenseType.isPending
              }
              onClick={() => createExpenseType.mutate(newTypeName.trim())}
            >
              {createExpenseType.isPending ? "Adding…" : "Add type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
