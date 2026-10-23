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
  type EligibleTransporterTruck,
} from "./vendor-payment.service";
import {
  Field,
  LoadMoreFooter,
  SkeletonTableRows,
  StepHeading,
  formatDate,
  money,
  rupeesToPaise,
  today,
} from "./vendor-payment.ui";

// Eligible trucks are fetched a chunk at a time — never the whole set.
const ELIGIBLE_CHUNK_SIZE = 25;

/** A selected truck: the server's figures plus the one amount typed here. */
type TruckDraft = {
  truck: EligibleTransporterTruck;
  stationery: string;
};

const big = (paise: string) => BigInt(paise);

/** Freight + detention, before deductions. */
const truckGrossPaise = (t: EligibleTransporterTruck) =>
  big(t.freightPaise) + big(t.detentionPaise);

const truckNetPaise = ({ truck: t, stationery }: TruckDraft) =>
  truckGrossPaise(t) -
  big(t.advancePaise) -
  big(t.commissionPaise) -
  big(t.hamaliPaise) -
  big(t.tdsPaise) -
  big(t.damagePaise) -
  BigInt(rupeesToPaise(stationery || "0"));

/** Read-only amount cell — the server derives it from the truck and its LRs. */
function AmountCell({ paise, minus }: { paise: string; minus?: boolean }) {
  const zero = big(paise) === 0n;
  return (
    <span className={zero ? "text-muted-foreground" : undefined}>
      {zero ? "—" : `${minus ? "− " : ""}${money(paise)}`}
    </span>
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

  // Selected trucks, keyed by LR group id.
  const [drafts, setDrafts] = React.useState<Record<string, TruckDraft>>({});
  const selectedIds = Object.keys(drafts);

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
  // next, and the search term is matched in the database against every truck
  // (LR no., group no. or vehicle no.) — not just the chunks already on
  // screen. Selections live in `drafts`, so changing the search or loading
  // more never drops one.
  const eligible = useInfiniteQuery({
    queryKey: [
      "vendor-payment",
      "eligible-transporter-trucks",
      transportId,
      branchId,
      from,
      to,
      debouncedLrSearch,
    ],
    queryFn: ({ pageParam }) =>
      vendorPaymentApi.eligibleTransporterTrucks({
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
  const trucks = React.useMemo(
    () => eligible.data?.pages.flatMap((page) => page.items) ?? [],
    [eligible.data],
  );

  const toggleTruck = (truck: EligibleTransporterTruck, checked: boolean) => {
    setDrafts((prev) => {
      if (checked) {
        if (prev[truck.groupId]) return prev;
        return { ...prev, [truck.groupId]: { truck, stationery: "" } };
      }
      const next = { ...prev };
      delete next[truck.groupId];
      return next;
    });
  };

  const updateStationery = (groupId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [groupId]: { ...prev[groupId]!, stationery: value } }));
  };

  const totals = React.useMemo(() => {
    let gross = 0n;
    let net = 0n;
    for (const draft of Object.values(drafts)) {
      gross += truckGrossPaise(draft.truck);
      net += truckNetPaise(draft);
    }
    return { gross, deductions: gross - net, net };
  }, [drafts]);

  const negativeTrucks = Object.values(drafts).filter((draft) => truckNetPaise(draft) < 0n);

  const canSave =
    selectedIds.length > 0 &&
    Boolean(branchId) &&
    Boolean(transportId) &&
    negativeTrucks.length === 0;

  // Amounts other than stationery are sent as a prefill only — the server
  // re-derives every one of them from the truck and its LRs.
  const buildBody = () => ({
    type: "TRANSPORTER" as const,
    branchId,
    transportId,
    lines: Object.values(drafts).map(({ truck: t, stationery }) => ({
      sourceType: "LR_GROUP" as const,
      sourceId: t.groupId,
      freightPaise: t.freightPaise,
      detentionPaise: t.detentionPaise,
      advancePaise: t.advancePaise,
      commissionPaise: t.commissionPaise,
      hamaliPaise: t.hamaliPaise,
      tdsPaise: t.tdsPaise,
      damagePaise: t.damagePaise,
      stationeryPaise: rupeesToPaise(stationery || "0"),
    })),
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
            description="Choose the branch and market-vehicle transporter, then load their trucks. A truck is paid once, with all its LRs."
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
              Find trucks
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
                title="Select trucks"
                description="Each row is one truck with its LRs. Freight, advance, commission, hamali and TDS are the truck's, counted once; detention and damage come from each LR's signed copy. A truck can be paid once all its LRs are delivered."
              />
              {selectedIds.length ? (
                <span className="rounded-sm border bg-background px-3 py-1 text-xs font-medium">
                  {selectedIds.length} truck{selectedIds.length === 1 ? "" : "s"} selected
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={lrSearch}
              onChange={(event) => setLrSearch(event.target.value)}
              placeholder="Search by LR no., group no. or vehicle no..."
              aria-label="Search trucks"
              className="sm:max-w-sm"
            />
            {eligible.isLoading ? (
              <Skeleton className="h-40" />
            ) : eligible.isError ? (
              <div className="py-10 text-center">
                <p className="font-medium">Could not load trucks</p>
                <Button variant="outline" className="mt-3" onClick={() => eligible.refetch()}>
                  Try again
                </Button>
              </div>
            ) : !trucks.length ? (
              <div className="py-10 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <IconTruck size={20} />
                </span>
                <p className="mt-3 font-medium">
                  {debouncedLrSearch ? "No matching trucks" : "No trucks to pay"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {debouncedLrSearch
                    ? "No unpaid truck matches that LR no., group no. or vehicle no."
                    : "No delivered, unpaid truck for this transporter in the selected range."}
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
                      <TableHead>Truck / LR</TableHead>
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
                    {trucks.map((truck) => {
                      const draft = drafts[truck.groupId];
                      const checked = Boolean(draft);
                      const net = draft ? truckNetPaise(draft) : null;
                      return (
                        <React.Fragment key={truck.groupId}>
                          <TableRow
                            className={
                              checked
                                ? "bg-primary/5"
                                : truck.ready
                                  ? undefined
                                  : "text-muted-foreground"
                            }
                          >
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                disabled={!truck.ready}
                                aria-label={`Select truck ${truck.groupNumber}`}
                                onCheckedChange={(v) => toggleTruck(truck, v === true)}
                              />
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">
                                {truck.vehicleNumber ?? "—"} · {truck.groupNumber}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {truck.lrs.length} LR{truck.lrs.length === 1 ? "" : "s"}:{" "}
                                {truck.lrs.map((lr) => lr.lrNumber).join(", ")}
                              </p>
                              {!truck.ready ? (
                                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                                  Waiting on {truck.pendingLrNumbers.join(", ")} to be delivered
                                </p>
                              ) : null}
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={truck.freightPaise} />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={truck.detentionPaise} />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={truck.advancePaise} minus />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={truck.commissionPaise} minus />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={truck.hamaliPaise} minus />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={truck.tdsPaise} minus />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={truck.damagePaise} minus />
                            </TableCell>
                            <TableCell>
                              <Input
                                inputMode="decimal"
                                value={draft?.stationery ?? ""}
                                disabled={!checked}
                                onChange={(event) =>
                                  updateStationery(truck.groupId, event.target.value)
                                }
                                placeholder="0.00"
                                aria-label={`Stationery for ${truck.groupNumber}`}
                                className="ml-auto h-8 w-20 text-right text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {net === null ? "—" : money(net)}
                              {net !== null && net < 0n ? (
                                <p className="mt-1 text-right text-[10px] font-medium text-destructive">
                                  Negative net
                                </p>
                              ) : null}
                            </TableCell>
                          </TableRow>
                          {truck.lrs.map((lr) => (
                            <TableRow
                              key={lr.lrId}
                              className={checked ? "bg-primary/5 text-xs" : "text-xs"}
                            >
                              <TableCell />
                              <TableCell className="pl-6">
                                <p className="font-medium">{lr.lrNumber}</p>
                                {lr.unloadingPoint ? (
                                  <p className="text-muted-foreground">{lr.unloadingPoint}</p>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                {lr.deliveredAt ? formatDate(lr.deliveredAt) : "Not delivered"}
                              </TableCell>
                              <TableCell />
                              <TableCell className="text-right">
                                <AmountCell paise={lr.detentionPaise} />
                              </TableCell>
                              <TableCell colSpan={4} />
                              <TableCell className="text-right">
                                <AmountCell paise={lr.damagePaise} minus />
                              </TableCell>
                              <TableCell colSpan={2} />
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {eligible.isFetchingNextPage ? <SkeletonTableRows columns={12} /> : null}
                  </TableBody>
                </Table>
                </div>
                <LoadMoreFooter
                  shown={trucks.length}
                  hasNextPage={Boolean(eligible.hasNextPage)}
                  isFetchingNextPage={eligible.isFetchingNextPage}
                  onLoadMore={() => eligible.fetchNextPage()}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {selectedIds.length > 0 ? (
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <StepHeading
              step={3}
              title="Review and save"
              description="Totals below are recalculated by the server on save — this is a preview."
            />
          </CardHeader>
          <CardContent className="space-y-5">
            {negativeTrucks.length > 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  {negativeTrucks.length} selected truck{negativeTrucks.length === 1 ? " has" : "s have"}{" "}
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
