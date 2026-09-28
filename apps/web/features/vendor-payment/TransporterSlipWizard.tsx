"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconAlertTriangle, IconTruck } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Card, CardContent, CardHeader } from "@skerp/ui/components/Card";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { branchApi } from "@/features/masters/branch/branch.service";
import { transportApi } from "@/features/masters/transport/transport.service";
import {
  vendorPaymentApi,
  type EligibleTransporterLR,
} from "./vendor-payment.service";
import {
  Field,
  LoadMoreFooter,
  SkeletonTableRows,
  StepHeading,
  money,
  rupeesToPaise,
  today,
} from "./vendor-payment.ui";

// Eligible LRs are fetched a chunk at a time — never the whole set.
const ELIGIBLE_CHUNK_SIZE = 25;

type LineDraft = {
  freight: string;
  detention: string;
  advance: string;
  commission: string;
  hamali: string;
  tds: string;
  damage: string;
  stationery: string;
};

const lineNetPaise = (l: LineDraft) =>
  BigInt(rupeesToPaise(l.freight || "0")) +
  BigInt(rupeesToPaise(l.detention || "0")) -
  BigInt(rupeesToPaise(l.advance || "0")) -
  BigInt(rupeesToPaise(l.commission || "0")) -
  BigInt(rupeesToPaise(l.hamali || "0")) -
  BigInt(rupeesToPaise(l.tds || "0")) -
  BigInt(rupeesToPaise(l.damage || "0")) -
  BigInt(rupeesToPaise(l.stationery || "0"));

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
      className="h-8 w-20 text-right text-xs"
    />
  );
}

export function TransporterSlipWizard() {
  const router = useRouter();
  const { user } = useAuth();

  const [branchId, setBranchId] = React.useState(user?.branchId ?? "");
  const [transportId, setTransportId] = React.useState("");
  const [transportSearch, setTransportSearch] = React.useState("");
  const debouncedTransportSearch = useDebouncedValue(transportSearch, 250);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState(today());
  const [searched, setSearched] = React.useState(false);
  const [lrSearch, setLrSearch] = React.useState("");
  const debouncedLrSearch = useDebouncedValue(lrSearch.trim(), 400);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [lines, setLines] = React.useState<Record<string, LineDraft>>({});

  const branches = useQuery({
    queryKey: ["vendor-payment", "branches"],
    queryFn: () => branchApi.list({ page: 0, size: 100 }),
  });

  const transports = useQuery({
    queryKey: ["vendor-payment", "transports", debouncedTransportSearch],
    queryFn: () =>
      transportApi.list({
        page: 0,
        size: 20,
        search: debouncedTransportSearch || undefined,
      }),
  });
  const transportOptions: ComboboxOption[] = (transports.data?.data ?? []).map(
    (t) => ({ label: t.name, value: t.id }),
  );

  // Chunked, server-side: each request returns one chunk plus a cursor for the
  // next, and the search term is matched in the database against every
  // eligible LR — not just the chunks already on screen. Selected LRs and
  // their amounts live in `selected`/`lines`, so changing the search or
  // loading more never drops a selection.
  const eligible = useInfiniteQuery({
    queryKey: [
      "vendor-payment",
      "eligible-transporter-lrs",
      transportId,
      branchId,
      from,
      to,
      debouncedLrSearch,
    ],
    queryFn: ({ pageParam }) =>
      vendorPaymentApi.eligibleTransporterLRs({
        transportId,
        branchId: branchId || undefined,
        from: from || undefined,
        to: to || undefined,
        search: debouncedLrSearch || undefined,
        cursor: pageParam,
        size: ELIGIBLE_CHUNK_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: searched && Boolean(transportId),
  });
  const lrs = React.useMemo(
    () => eligible.data?.pages.flatMap((page) => page.items) ?? [],
    [eligible.data],
  );

  const toLineDraft = (lr: EligibleTransporterLR): LineDraft => ({
    freight: (Number(BigInt(lr.freightPaise)) / 100).toFixed(2),
    detention: (Number(BigInt(lr.detentionPaise)) / 100).toFixed(2),
    advance: (Number(BigInt(lr.advancePaise)) / 100).toFixed(2),
    commission: (Number(BigInt(lr.commissionPaise)) / 100).toFixed(2),
    hamali: (Number(BigInt(lr.hamaliPaise)) / 100).toFixed(2),
    tds: (Number(BigInt(lr.tdsPaise)) / 100).toFixed(2),
    damage: (Number(BigInt(lr.damagePaise)) / 100).toFixed(2),
    stationery: (Number(BigInt(lr.stationeryPaise)) / 100).toFixed(2),
  });

  const toggleLR = (lr: EligibleTransporterLR, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(lr.lrId);
      else next.delete(lr.lrId);
      return next;
    });
    setLines((prev) => {
      if (checked) {
        if (prev[lr.lrId]) return prev;
        return { ...prev, [lr.lrId]: toLineDraft(lr) };
      }
      const next = { ...prev };
      delete next[lr.lrId];
      return next;
    });
  };

  const updateLine = (lrId: string, field: keyof LineDraft, value: string) => {
    setLines((prev) => ({ ...prev, [lrId]: { ...prev[lrId]!, [field]: value } }));
  };

  const totals = React.useMemo(() => {
    let gross = 0n;
    let deductions = 0n;
    let net = 0n;
    for (const lrId of selected) {
      const l = lines[lrId];
      if (!l) continue;
      const g = BigInt(rupeesToPaise(l.freight || "0")) + BigInt(rupeesToPaise(l.detention || "0"));
      const n = lineNetPaise(l);
      gross += g;
      deductions += g - n;
      net += n;
    }
    return { gross, deductions, net };
  }, [selected, lines]);

  const negativeLineLrIds = [...selected].filter((lrId) => {
    const l = lines[lrId];
    return l ? lineNetPaise(l) < 0n : false;
  });

  const canSave =
    selected.size > 0 && Boolean(branchId) && Boolean(transportId) && negativeLineLrIds.length === 0;

  const buildBody = () => ({
    type: "TRANSPORTER" as const,
    branchId,
    transportId,
    lines: [...selected].map((lrId) => {
      const l = lines[lrId]!;
      return {
        sourceType: "LR" as const,
        sourceId: lrId,
        freightPaise: rupeesToPaise(l.freight || "0"),
        detentionPaise: rupeesToPaise(l.detention || "0"),
        advancePaise: rupeesToPaise(l.advance || "0"),
        commissionPaise: rupeesToPaise(l.commission || "0"),
        hamaliPaise: rupeesToPaise(l.hamali || "0"),
        tdsPaise: rupeesToPaise(l.tds || "0"),
        damagePaise: rupeesToPaise(l.damage || "0"),
        stationeryPaise: rupeesToPaise(l.stationery || "0"),
      };
    }),
  });

  const saveDraft = useMutation({
    mutationFn: () => vendorPaymentApi.createSlip(buildBody()),
    onSuccess: (slip) => {
      toast.success(`Draft ${slip.slipNumber} saved`);
      router.push(`/accounts/vendor-payments/${slip.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save the draft"),
  });

  const createAndSubmit = useMutation({
    mutationFn: async () => {
      const slip = await vendorPaymentApi.createSlip(buildBody());
      return vendorPaymentApi.submitSlip(slip.id, slip.version);
    },
    onSuccess: (slip) => {
      toast.success(
        slip.status === "APPROVED"
          ? `${slip.slipNumber} auto-approved and posted`
          : `${slip.slipNumber} submitted — pending approval`,
      );
      router.push(`/accounts/vendor-payments/${slip.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit the slip"),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <StepHeading
            step={1}
            title="Select transporter"
            description="Choose the branch and market-vehicle transporter, then load their delivered, unclaimed LRs."
          />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Branch">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger aria-invalid={!branchId || undefined}>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {(branches.data?.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Transporter" className="xl:col-span-2">
            <Combobox
              options={transportOptions}
              value={transportId}
              onChange={setTransportId}
              searchValue={transportSearch}
              onSearchChange={setTransportSearch}
              placeholder="Select transporter"
              searchPlaceholder="Search transporters..."
            />
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex items-end xl:col-span-5">
            <Button
              type="button"
              disabled={!transportId || !branchId}
              onClick={() => setSearched(true)}
            >
              Search eligible LRs
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
                title="Select LRs and confirm amounts"
                description="Delivered LRs for this transporter with no active claim. Amounts are prefilled from the LR group's market-vehicle figures and the acknowledgement — adjust as needed."
              />
              {selected.size ? (
                <span className="rounded-sm border bg-background px-3 py-1 text-xs font-medium">
                  {selected.size} selected
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={lrSearch}
              onChange={(event) => setLrSearch(event.target.value)}
              placeholder="Search by LR no., group no. or vehicle no..."
              aria-label="Search eligible LRs"
              className="sm:max-w-sm"
            />
            {eligible.isLoading ? (
              <Skeleton className="h-40" />
            ) : eligible.isError ? (
              <div className="py-10 text-center">
                <p className="font-medium">Could not load eligible LRs</p>
                <Button variant="outline" className="mt-3" onClick={() => eligible.refetch()}>
                  Try again
                </Button>
              </div>
            ) : !lrs.length ? (
              <div className="py-10 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <IconTruck size={20} />
                </span>
                <p className="mt-3 font-medium">
                  {debouncedLrSearch ? "No matching LRs" : "No eligible LRs"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {debouncedLrSearch
                    ? "No eligible LR matches that LR no., group no. or vehicle no."
                    : "Nothing delivered and unclaimed for this transporter in the selected range."}
                </p>
              </div>
            ) : (
              <div
                aria-busy={eligible.isPlaceholderData}
                className={eligible.isPlaceholderData ? "opacity-60" : undefined}
              >
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Select</TableHead>
                      <TableHead>LR</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead className="text-right">Freight</TableHead>
                      <TableHead className="text-right">Detention</TableHead>
                      <TableHead className="text-right">Advance</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Hamali</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead className="text-right">Damage</TableHead>
                      <TableHead className="text-right">Stationery</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lrs.map((lr) => {
                      const checked = selected.has(lr.lrId);
                      const l = lines[lr.lrId];
                      const negative = l ? lineNetPaise(l) < 0n : false;
                      return (
                        <TableRow key={lr.lrId} className={checked ? "bg-primary/5" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleLR(lr, v === true)}
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{lr.lrNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {lr.marketVehicleNumber ?? "—"}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs">
                            {lr.deliveredAt
                              ? new Date(lr.deliveredAt).toLocaleDateString("en-IN")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={l?.freight ?? ""}
                              disabled={!checked}
                              onChange={(v) => updateLine(lr.lrId, "freight", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={l?.detention ?? ""}
                              disabled={!checked}
                              onChange={(v) => updateLine(lr.lrId, "detention", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={l?.advance ?? ""}
                              disabled={!checked}
                              onChange={(v) => updateLine(lr.lrId, "advance", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={l?.commission ?? ""}
                              disabled={!checked}
                              onChange={(v) => updateLine(lr.lrId, "commission", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={l?.hamali ?? ""}
                              disabled={!checked}
                              onChange={(v) => updateLine(lr.lrId, "hamali", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={l?.tds ?? ""}
                              disabled={!checked}
                              onChange={(v) => updateLine(lr.lrId, "tds", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={l?.damage ?? ""}
                              disabled={!checked}
                              onChange={(v) => updateLine(lr.lrId, "damage", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={l?.stationery ?? ""}
                              disabled={!checked}
                              onChange={(v) => updateLine(lr.lrId, "stationery", v)}
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {l ? money(lineNetPaise(l)) : "—"}
                            {negative ? (
                              <p className="mt-1 text-right text-[10px] font-medium text-destructive">
                                Negative net
                              </p>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {eligible.isFetchingNextPage ? <SkeletonTableRows columns={12} /> : null}
                  </TableBody>
                </Table>
                </div>
                <LoadMoreFooter
                  shown={lrs.length}
                  hasNextPage={Boolean(eligible.hasNextPage)}
                  isFetchingNextPage={eligible.isFetchingNextPage}
                  onLoadMore={() => eligible.fetchNextPage()}
                />
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
              title="Review and save"
              description="Totals below are recalculated by the server on save — this is a preview."
            />
          </CardHeader>
          <CardContent className="space-y-5">
            {negativeLineLrIds.length > 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  {negativeLineLrIds.length} selected LR{negativeLineLrIds.length === 1 ? " has" : "s have"}{" "}
                  deductions exceeding its freight + detention — fix before saving.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 rounded-md border bg-muted/20 p-4 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Gross payable</p>
                <p className="mt-1 text-base font-semibold">{money(totals.gross)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total deductions</p>
                <p className="mt-1 text-base font-semibold">{money(totals.deductions)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net payable</p>
                <p className="mt-1 text-base font-semibold">{money(totals.net)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/accounts/vendor-payments")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canSave || saveDraft.isPending}
                onClick={() => saveDraft.mutate()}
              >
                {saveDraft.isPending ? "Saving..." : "Save draft"}
              </Button>
              <Button
                type="button"
                disabled={!canSave || createAndSubmit.isPending}
                onClick={() => createAndSubmit.mutate()}
              >
                {createAndSubmit.isPending ? "Submitting..." : "Save and submit"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
