"use client";

import * as React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createTripExpenseSchema } from "@skerp/validators";
import type {
  TripExpenseFormInput,
  CreateTripExpenseBody,
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

import { paiseToRupees, formatPaise } from "@/lib/money";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import IconTextField from "../masters/_shared/fields/IconTextField";
import SelectField from "../masters/_shared/fields/SelectField";
import CheckboxField from "../masters/_shared/fields/CheckBoxField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { expenseApi, journeyLookups } from "./journey.service";
import { journeyKeys, journeyLookupKeys } from "./journey.keys";
import { EXPENSE_TYPE_LABELS } from "./journey-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: VehicleJourney;
  /** When set, the drawer edits this draft expense instead of creating. */
  expense?: TripExpense | null;
};

const EXPENSE_TYPE_OPTIONS = Object.entries(EXPENSE_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

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
            expenseType: expense.expenseType,
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
            expenseType: "DIESEL",
            paymentMode: "CASH",
            paidByDriver: true,
          },
    [expense, journey.id],
  );

  const form = useForm<TripExpenseFormInput, unknown, CreateTripExpenseBody>({
    resolver: zodResolver(createTripExpenseSchema),
    defaultValues: defaults(),
  });

  React.useEffect(() => {
    if (open) form.reset(defaults());
  }, [open, form, defaults]);

  const expenseType = form.watch("expenseType");
  const paymentMode = form.watch("paymentMode");
  const dieselQty = form.watch("dieselQty");
  const dieselRate = form.watch("dieselRate");
  const isDiesel = expenseType === "DIESEL";

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

  const onSubmit = async (values: CreateTripExpenseBody) => {
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
            <SelectField
              name="expenseType"
              label="Expense type"
              required
              options={EXPENSE_TYPE_OPTIONS}
            />
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

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Expense date
              </label>
              <Input type="datetime-local" {...form.register("expenseDate")} />
            </div>

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
            {submitting
              ? "Saving…"
              : expense
                ? "Save Expense"
                : "Add Expense"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
