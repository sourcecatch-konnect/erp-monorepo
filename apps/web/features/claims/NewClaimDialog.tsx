"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClaimSchema } from "@skerp/validators/claims/claim";
import type { ClaimEligibleLr, CreateClaimFormInput } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Combobox } from "@skerp/ui/components/combobox";
import { Input } from "@skerp/ui/components/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import SelectField from "@/features/masters/_shared/fields/SelectField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import TextField from "@/features/masters/_shared/fields/TextField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import { CLAIM_CAUSE_LABELS, CLAIM_TYPE_LABELS, optionsOf, todayInput } from "./claim.ui";

const FORM_ID = "new-claim-form";

const emptyValues = (): CreateClaimFormInput => ({
  lrId: "",
  claimDate: todayInput(),
  claimType: "DAMAGE",
  customerId: "",
  causedBy: undefined,
  goodsValue: "",
  claimedAmount: "",
  basisDescription: "",
  items: [],
});

/**
 * Raise a claim by hand — a customer's letter with no ack/GRN damage on
 * record. Opens the new claim afterwards, where photos and the letter are
 * attached.
 */
export function NewClaimDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [lr, setLr] = React.useState<ClaimEligibleLr | null>(null);

  const form = useForm<CreateClaimFormInput>({
    resolver: zodResolver(createClaimSchema, undefined, { raw: true }),
    defaultValues: emptyValues(),
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(emptyValues());
    setLr(null);
    setSearch("");
  }, [open, form]);

  const lrs = useQuery({
    queryKey: claimKeys.eligibleLrs(debounced),
    queryFn: () => claimApi.eligibleLrs(debounced),
    enabled: open,
  });
  const lrOptions = [
    ...(lr ? [lr] : []),
    ...(lrs.data ?? []).filter((row) => row.id !== lr?.id),
  ];

  const pickLr = (id: string) => {
    const picked = lrOptions.find((row) => row.id === id) ?? null;
    setLr(picked);
    form.setValue("lrId", id, { shouldValidate: true });
    form.setValue("customerId", picked?.consignor.id ?? "");
    form.setValue(
      "items",
      (picked?.goods ?? []).map((line) => ({ lrGoodsId: line.id, damagedQty: "", shortageQty: "" })),
    );
  };

  const create = useMutation({
    mutationFn: (values: CreateClaimFormInput) => claimApi.create(values),
    onSuccess: (claim) => {
      toast.success(`Claim ${claim.claimNumber} raised — attach the claim letter and photos here`);
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      onOpenChange(false);
      router.push(`/claims/${claim.id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const errors = form.formState.errors;
  const itemsError = errors.items?.message ?? errors.items?.root?.message;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-screen w-full overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>New damage claim</SheetTitle>
          <SheetDescription>
            For a customer&apos;s claim with no damage recorded on the acknowledgement or a GRN.
          </SheetDescription>
        </SheetHeader>

        <FormProvider {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          >
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Delivered LR <span className="text-red-600">*</span>
              </label>
              <Combobox
                options={lrOptions.map((row) => ({
                  value: row.id,
                  label: row.lrNumber,
                  hint: `${row.consignor.name} → ${row.consignee.name}`,
                }))}
                value={lr?.id ?? ""}
                onChange={pickLr}
                placeholder="Search a delivered LR"
                searchPlaceholder="Type the LR number"
                emptyText={lrs.isLoading ? "Searching…" : "No delivered LR found"}
                searchValue={search}
                onSearchChange={setSearch}
                invalid={Boolean(errors.lrId)}
                className="min-h-9 rounded-md"
              />
              {errors.lrId?.message ? (
                <p className="text-xs text-red-600">Pick the LR</p>
              ) : null}
            </div>

            {lr ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Claim date <span className="text-red-600">*</span>
                    </label>
                    <Controller
                      control={form.control}
                      name="claimDate"
                      render={({ field }) => (
                        <Input
                          type="date"
                          value={typeof field.value === "string" ? field.value : ""}
                          onChange={field.onChange}
                          max={todayInput()}
                        />
                      )}
                    />
                  </div>
                  <SelectField<CreateClaimFormInput>
                    name="claimType"
                    label="Type"
                    required
                    options={optionsOf(CLAIM_TYPE_LABELS)}
                  />
                  <SelectField<CreateClaimFormInput>
                    name="customerId"
                    label="Claimed by"
                    required
                    options={[
                      { value: lr.consignor.id, label: `${lr.consignor.name} (consignor)` },
                      ...(lr.consignee.id !== lr.consignor.id
                        ? [{ value: lr.consignee.id, label: `${lr.consignee.name} (consignee)` }]
                        : []),
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Goods damaged or short <span className="text-red-600">*</span>
                  </p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Goods</TableHead>
                          <TableHead className="text-right">Booked</TableHead>
                          <TableHead className="w-28">Damaged</TableHead>
                          <TableHead className="w-28">Short</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lr.goods.map((line, index) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.name}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.quantity}
                              {line.unit ? ` ${line.unit}` : ""}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                aria-label={`${line.name} damaged`}
                                className="h-8"
                                {...form.register(`items.${index}.damagedQty`)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                aria-label={`${line.name} short`}
                                className="h-8"
                                {...form.register(`items.${index}.shortageQty`)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {itemsError ? <p className="text-xs text-red-600">{itemsError}</p> : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField<CreateClaimFormInput>
                    name="claimedAmount"
                    label="Claimed amount (₹)"
                    placeholder="0.00"
                    required
                  />
                  <TextField<CreateClaimFormInput>
                    name="goodsValue"
                    label="Goods value (₹)"
                    placeholder="Can be filled at assessment"
                  />
                  <SelectField<CreateClaimFormInput>
                    name="causedBy"
                    label="Caused by"
                    placeholder="Not known yet"
                    options={optionsOf(CLAIM_CAUSE_LABELS)}
                  />
                </div>

                <TextAreaField<CreateClaimFormInput>
                  name="basisDescription"
                  label="Basis of claim"
                  placeholder="e.g. Customer letter dated 2 Nov: 5 cartons crushed, invoice value ₹8,000 each"
                  rows={3}
                  maxLength={1000}
                />
              </>
            ) : null}
          </form>
        </FormProvider>

        <SheetFooter className="shrink-0 border-t bg-background sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!lr || create.isPending}>
            {create.isPending ? "Raising…" : "Raise claim"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
