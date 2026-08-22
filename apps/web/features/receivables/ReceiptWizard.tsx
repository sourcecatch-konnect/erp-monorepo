"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconReceipt2,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Card,
  CardContent,
  CardHeader,
} from "@skerp/ui/components/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { useAuth } from "@/features/auth";
import { branchApi } from "@/features/masters/branch/branch.service";
import { customerApi } from "@/features/masters/Customer/customer.service";
import { cashAccountApi } from "@/features/masters/cash-account/cash-account.service";
import {
  receiptApi,
  type OutstandingBill,
  type ReceiptPaymentMode,
} from "./receipt.service";
import {
  Field,
  PAYMENT_MODE_LABELS,
  StepHeading,
  formatDate,
  money,
  rupeesToPaise,
  today,
} from "./receipt.ui";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type AllocationDraft = {
  amountApplied: string;
  tds: string;
  tdsSection: string;
  damage: string;
  rateDiff: string;
};

const emptyAllocation = (outstandingAmountPaise: string): AllocationDraft => ({
  amountApplied: (Number(BigInt(outstandingAmountPaise)) / 100).toFixed(2),
  tds: "0",
  tdsSection: "",
  damage: "0",
  rateDiff: "0",
});

const settledPaise = (a: AllocationDraft) =>
  BigInt(rupeesToPaise(a.amountApplied || "0")) +
  BigInt(rupeesToPaise(a.tds || "0")) +
  BigInt(rupeesToPaise(a.damage || "0")) +
  BigInt(rupeesToPaise(a.rateDiff || "0"));

function AmountInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="0.00"
      className="h-8 w-24 text-right text-xs"
    />
  );
}

export function ReceiptWizard() {
  const router = useRouter();
  const { user } = useAuth();

  const [branchId, setBranchId] = React.useState(user?.branchId ?? "");
  const [customerId, setCustomerId] = React.useState("");
  const [customerLabel, setCustomerLabel] = React.useState("");
  const [customerSearch, setCustomerSearch] = React.useState("");
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 250);
  const [truckNumber, setTruckNumber] = React.useState("");
  const [lrNumber, setLrNumber] = React.useState("");
  const [billNumber, setBillNumber] = React.useState("");
  const [uptoDate, setUptoDate] = React.useState(today());
  const [searched, setSearched] = React.useState(false);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [allocations, setAllocations] = React.useState<
    Record<string, AllocationDraft>
  >({});

  const [receivedAt, setReceivedAt] = React.useState(today());
  const [paymentMode, setPaymentMode] =
    React.useState<ReceiptPaymentMode>("CASH");
  const [receivedIntoAccountId, setReceivedIntoAccountId] = React.useState("");
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [remarks, setRemarks] = React.useState("");

  const branches = useQuery({
    queryKey: ["receivables", "branches"],
    queryFn: () => branchApi.list({ page: 0, size: 200 }),
  });

  const cashAccounts = useQuery({
    queryKey: ["receivables", "cash-accounts"],
    queryFn: () => cashAccountApi.list({ page: 0, size: 200 }),
  });
  const accessibleBranches = React.useMemo(() => {
    const all = branches.data?.data ?? [];
    if (!user?.branchIds || user.branchScope !== "ASSIGNED") return all;
    const allowed = new Set(user.branchIds);
    return all.filter((branch) => allowed.has(branch.id));
  }, [branches.data, user?.branchIds, user?.branchScope]);

  const customers = useQuery({
    queryKey: ["receivables", "customers", debouncedCustomerSearch],
    queryFn: () =>
      customerApi.list({
        page: 0,
        size: 20,
        search: debouncedCustomerSearch || undefined,
      }),
  });
  const customerOptions: ComboboxOption[] = (customers.data?.data ?? []).map(
    (c) => ({ label: c.name, value: c.id }),
  );

  const outstanding = useQuery({
    queryKey: [
      "receivables",
      "outstanding-bills",
      branchId,
      customerId,
      truckNumber,
      lrNumber,
      uptoDate,
      billNumber
    ],
    queryFn: () =>
      receiptApi.outstandingBills({
        branchId,
        customerId,
        truckNumber: truckNumber.trim() || undefined,
        lrNumber: lrNumber.trim() || undefined,
        uptoDate: uptoDate || undefined,
        billNumber: billNumber.trim() || undefined,
      }),
    enabled: searched && Boolean(branchId) && Boolean(customerId),
  });
  const toggleBill = (bill: OutstandingBill, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(bill.id);
      else next.delete(bill.id);
      return next;
    });
    setAllocations((prev) => {
      if (checked) {
        const existing = prev[bill.id];
        if (existing) return prev;

        const outstandingPaise = BigInt(bill.outstandingAmountPaise);
        const taxablePaise = BigInt(bill.taxableAmountPaise);
        const tdsPaise = (taxablePaise * 2n) / 100n;
        const receivedPaise = outstandingPaise - tdsPaise;

        return {
          ...prev,
          [bill.id]: {
            amountApplied: (Number(receivedPaise) / 100).toFixed(2),
            tds: (Number(tdsPaise) / 100).toFixed(2),
            tdsSection: "",
            damage: "0",
            rateDiff: "0",
          },
        };
      }
      const next = { ...prev };
      delete next[bill.id];
      return next;
    });
  };
  const updateAllocation = (
    billId: string,
    field: keyof AllocationDraft,
    value: string,
  ) => {
    setAllocations((prev) => {
      const current = prev[billId]!;
      const updated = { ...current, [field]: value };

      if (field === "tds" || field === "damage" || field === "rateDiff") {
        const bill = bills.find((b) => b.id === billId);
        if (bill) {
          const outstandingPaise = BigInt(bill.outstandingAmountPaise);
          const toPaise = (v: string) =>
            BigInt(Math.round((Number(v) || 0) * 100));
          const receivedPaise =
            outstandingPaise -
            toPaise(updated.tds) -
            toPaise(updated.damage) -
            toPaise(updated.rateDiff);
          updated.amountApplied = (Number(receivedPaise) / 100).toFixed(2);
        }
      }

      return { ...prev, [billId]: updated };
    });
  };
  const bills = outstanding.data ?? [];
  const billById = new Map(bills.map((bill) => [bill.id, bill]));

  const totals = React.useMemo(() => {
    let received = 0n;
    let tds = 0n;
    let damage = 0n;
    let rateDiff = 0n;
    for (const billId of selected) {
      const a = allocations[billId];
      if (!a) continue;
      received += BigInt(rupeesToPaise(a.amountApplied || "0"));
      tds += BigInt(rupeesToPaise(a.tds || "0"));
      damage += BigInt(rupeesToPaise(a.damage || "0"));
      rateDiff += BigInt(rupeesToPaise(a.rateDiff || "0"));
    }
    return { received, tds, damage, rateDiff };
  }, [selected, allocations]);

  // Rate difference can be negative (client actually paid more than billed) —
  // that's still a discrepancy worth approval, so check "not zero" not "> 0".
  const hasDeduction =
    totals.tds > 0n || totals.damage > 0n || totals.rateDiff !== 0n;

  const overAllocatedBillIds = [...selected].filter((billId) => {
    const bill = billById.get(billId);
    const a = allocations[billId];
    if (!bill || !a) return false;
    return settledPaise(a) > BigInt(bill.outstandingAmountPaise);
  });
  const zeroAllocationBillIds = [...selected].filter((billId) => {
    const a = allocations[billId];
    return !a || settledPaise(a) <= 0n;
  });

  const canSubmit =
    selected.size > 0 &&
    Boolean(receivedAt) &&
    Boolean(receivedIntoAccountId) &&
    overAllocatedBillIds.length === 0 &&
    zeroAllocationBillIds.length === 0;

  const createReceipt = useMutation({
    mutationFn: () =>
      receiptApi.create({
        branchId,
        customerId,
        receivedAt,
        paymentMode,
        receivedIntoAccountId,
        referenceNumber: referenceNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        allocations: [...selected].map((billId) => {
          const a = allocations[billId]!;
          return {
            billId,
            amountAppliedPaise: rupeesToPaise(a.amountApplied || "0"),
            tdsAmountPaise: rupeesToPaise(a.tds || "0"),
            tdsSection: a.tdsSection.trim() || undefined,
            damageAmountPaise: rupeesToPaise(a.damage || "0"),
            rateDiffAmountPaise: rupeesToPaise(a.rateDiff || "0"),
          };
        }),
      }),
    onSuccess: (receipt) => {
      const accountName = (cashAccounts.data?.data ?? []).find(
        (account) => account.id === receivedIntoAccountId,
      )?.name;
      toast.success(
        receipt.status === "PENDING_APPROVAL"
          ? "Receipt saved — pending approval because of a TDS/damage/rate-difference deduction"
          : accountName
            ? `Payment recorded and posted — credited to ${accountName}`
            : "Payment recorded and posted",
      );
      router.push(`/accounts/receipts/${receipt.id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not record the payment",
      ),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <StepHeading
            step={1}
            title="Select client"
            description="Choose the branch and client, then load their outstanding bills."
          />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Branch">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {accessibleBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Client" className="xl:col-span-2">
            <Combobox
              options={customerOptions}
              value={customerId}
              onChange={(value) => {
                setCustomerId(value);
                setCustomerLabel(
                  customerOptions.find((o) => o.value === value)?.label ?? "",
                );
              }}
              searchValue={customerSearch}
              onSearchChange={setCustomerSearch}
              placeholder="Select client"
              searchPlaceholder="Search clients..."
            />
          </Field>
          <Field label="Upto date">
            <Input
              type="date"
              value={uptoDate}
              onChange={(event) => setUptoDate(event.target.value)}
            />
          </Field>
          <Field label="Truck number">
            <Input
              value={truckNumber}
              onChange={(event) => setTruckNumber(event.target.value)}
              placeholder="e.g. MH19A-4105"
            />
          </Field>
          <Field label="LR number">
            <Input
              value={lrNumber}
              onChange={(event) => setLrNumber(event.target.value)}
              placeholder="e.g. SKT/JAL/00801"
            />
          </Field>
          <Field label="Bill number">
            <Input
              value={billNumber}
              onChange={(event) => setBillNumber(event.target.value)}
              placeholder="e.g. SKT/B/26-27/00801"
            />
          </Field>
          <div className="flex items-end xl:col-span-2">
            <Button
              type="button"
              className="w-full"
              disabled={!branchId || !customerId}
              onClick={() => setSearched(true)}
            >
              Search outstanding bills
            </Button>
          </div>
        </CardContent>
      </Card>

      {searched ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <StepHeading
                step={2}
                title="Select bills and enter amounts"
                description={`Outstanding bills for ${customerLabel || "this client"}. Check a bill, then enter what was received against it.`}
              />
              {bills.length ? (
                <span className="rounded-sm border bg-background px-3 py-1 text-xs font-medium">
                  {bills.length} outstanding bill{bills.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {outstanding.isLoading ? (
              <Skeleton className="h-40" />
            ) : !bills.length ? (
              <div className="py-10 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <IconReceipt2 size={20} />
                </span>
                <p className="mt-3 font-medium">No outstanding bills</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This client has nothing pending for the selected branch and
                  filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Select</TableHead>
                      <TableHead>Bill / LR</TableHead>
                      <TableHead>Truck</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead className="text-right">Damage</TableHead>
                      <TableHead className="text-right">Rate diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => {
                      const checked = selected.has(bill.id);
                      const a = allocations[bill.id];
                      const over = overAllocatedBillIds.includes(bill.id);
                      return (
                        <TableRow
                          key={bill.id}
                          className={checked ? "bg-primary/5" : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleBill(bill, value === true)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">
                              {bill.billNumber ?? "Draft"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bill.lrNumber ?? "—"}
                              {bill.additionalLRCount > 0
                                ? ` +${bill.additionalLRCount} more`
                                : ""}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="inline-flex items-center gap-1">
                              <IconTruckDelivery size={13} />
                              {bill.truckNumber ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(bill.billDate)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {money(bill.outstandingAmountPaise)}
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={a?.amountApplied ?? ""}
                              disabled={!checked}
                              onChange={(value) =>
                                updateAllocation(bill.id, "amountApplied", value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={a?.tds ?? ""}
                              disabled={!checked}
                              onChange={(value) =>
                                updateAllocation(bill.id, "tds", value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={a?.damage ?? ""}
                              disabled={!checked}
                              onChange={(value) =>
                                updateAllocation(bill.id, "damage", value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={a?.rateDiff ?? ""}
                              disabled={!checked}
                              onChange={(value) =>
                                updateAllocation(bill.id, "rateDiff", value)
                              }
                            />
                            {over ? (
                              <p className="mt-1 text-right text-[10px] font-medium text-destructive">
                                Exceeds outstanding
                              </p>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {selected.size > 0 ? (
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <StepHeading
              step={3}
              title="Payment details"
              description="Confirm how this payment was received, then post it."
            />
          </CardHeader>
          <CardContent className="space-y-5">
            {hasDeduction ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  This receipt includes a TDS, damage or rate-difference
                  deduction, so it will be saved as{" "}
                  <strong>Pending approval</strong> until someone with approval
                  rights confirms it.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 rounded-md border bg-muted/20 p-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Received amount</p>
                <p className="mt-1 text-base font-semibold">
                  {money(totals.received)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TDS</p>
                <p className="mt-1 text-base font-semibold">{money(totals.tds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Damage</p>
                <p className="mt-1 text-base font-semibold">
                  {money(totals.damage)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rate difference</p>
                <p className="mt-1 text-base font-semibold">
                  {money(totals.rateDiff)}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Date">
                <Input
                  type="date"
                  value={receivedAt}
                  onChange={(event) => setReceivedAt(event.target.value)}
                />
              </Field>
              <Field label="Payment mode">
                <Select
                  value={paymentMode}
                  onValueChange={(value) =>
                    setPaymentMode(value as ReceiptPaymentMode)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Received into">
                <Select
                  value={receivedIntoAccountId}
                  onValueChange={setReceivedIntoAccountId}
                >
                  <SelectTrigger aria-invalid={!receivedIntoAccountId || undefined}>
                    <SelectValue placeholder="Select cash account" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cashAccounts.data?.data ?? []).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference no.">
                <Input
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  placeholder="Cheque / UTR number"
                />
              </Field>
            </div>
            <Field label="Remark">
              <Textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                rows={2}
                className="resize-none"
              />
            </Field>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/accounts/receipts")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canSubmit || createReceipt.isPending}
                onClick={() => createReceipt.mutate()}
              >
                {createReceipt.isPending ? "Confirming..." : "Confirm payment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
