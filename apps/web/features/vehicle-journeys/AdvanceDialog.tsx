"use client";

import * as React from "react";
import { Controller, useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createDriverAdvanceSchema } from "@skerp/validators";
import type {
  DriverAdvanceFormInput,
  CreateDriverAdvanceBody,
  VehicleJourney,
} from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";

import { formatPaise } from "@/lib/money";
import { toValidDate } from "@/lib/date";
import ComboboxField from "../masters/_shared/fields/ComboboxField";
import IconTextField from "../masters/_shared/fields/IconTextField";
import SelectField from "../masters/_shared/fields/SelectField";
import TextAreaField from "../masters/_shared/fields/TextAreaField";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { advanceApi, journeyLookups } from "./journey.service";
import { journeyKeys, journeyLookupKeys } from "./journey.keys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: VehicleJourney;
};

const ADVANCE_MODE_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
];

/** Money handed to the driver for the journey — settled at log slip time. */
export default function AdvanceDialog({ open, onOpenChange, journey }: Props) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);

  const cashAccounts = useQuery({
    queryKey: journeyLookupKeys.cashAccounts,
    queryFn: journeyLookups.cashAccounts,
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

  const form = useForm<
    DriverAdvanceFormInput,
    unknown,
    CreateDriverAdvanceBody
  >({
    resolver: zodResolver(createDriverAdvanceSchema),
    defaultValues: { journeyId: journey.id, paymentMode: "CASH" },
  });

  React.useEffect(() => {
    if (open) form.reset({ journeyId: journey.id, paymentMode: "CASH" });
  }, [open, form, journey.id]);

  const onSubmit = async (values: CreateDriverAdvanceBody) => {
    setSubmitting(true);
    try {
      const created = await advanceApi.create(values);
      toast.success(`Advance recorded (${formatPaise(created.amountPaise)})`);
      queryClient.invalidateQueries({ queryKey: journeyKeys.all });
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Driver Advance — {journey.driver?.name ?? ""}
          </DialogTitle>
          <DialogDescription>
            Recorded against journey {journey.journeyNumber}; settles against
            the driver&apos;s cash expenses on the log slip.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            id="driver-advance-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-3"
          >
            <IconTextField<DriverAdvanceFormInput>
              name="amount"
              label="Amount"
              type="number"
              min={0}
              step="0.01"
              prefix="₹"
              required
            />
            <SelectField
              name="paymentMode"
              label="Payment mode"
              required
              options={ADVANCE_MODE_OPTIONS}
            />
            <ComboboxField
              name="cashAccountId"
              label="Cash account"
              options={cashAccounts.data ?? []}
              placeholder="Optional"
            />
            <ComboboxField
              name="tripId"
              label="Trip leg"
              options={legOptions}
              placeholder="Whole journey"
            />
            <Controller
              name="paidAt"
              control={form.control}
              render={({ field }) => (
                <DateTimePicker
                  label="Paid at"
                  selected={toValidDate(field.value)}
                  onSelect={field.onChange}
                  placeholder="Select payment date and time"
                />
              )}
            />
            <TextAreaField<DriverAdvanceFormInput>
              name="narration"
              label="Narration"
              rows={2}
            />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="driver-advance-form"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Record Advance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
