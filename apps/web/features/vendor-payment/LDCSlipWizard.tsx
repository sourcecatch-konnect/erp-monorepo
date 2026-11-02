"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { IconAlertTriangle, IconTruckDelivery } from "@tabler/icons-react";

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
  type EligibleLDCSource,
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

const PAGE_SIZE = 25;

/** A selected challan: the server's figures plus the broker's claim typed here. */
type ChallanDraft = {
  source: EligibleLDCSource;
  /** Broker's claimed detention, rupees. Blank = no separate claim. */
  claimed: string;
};

const big = (paise: string) => BigInt(paise);

/** Round-half-up, mirroring the server's roundPaiseByBps exactly (bps = 1/100%). */
const roundPaiseByBps = (amountPaise: bigint, rateBps: bigint) =>
  (amountPaise * rateBps + 5000n) / 10000n;

const claimedPaise = ({ source, claimed }: ChallanDraft) =>
  claimed.trim() === ""
    ? big(source.detentionPaise)
    : BigInt(rupeesToPaise(claimed));

/** The business pays whichever is lower: the broker's claim or the slab. */
const approvedDetentionPaise = (draft: ChallanDraft) => {
  const claim = claimedPaise(draft);
  const slab = big(draft.source.detentionPaise);
  return claim < slab ? claim : slab;
};

const linePreview = (draft: ChallanDraft, tdsRateBps: number) => {
  const freight = big(draft.source.freightPaise);
  const approved = approvedDetentionPaise(draft);
  const gross = freight + approved;
  const tds = roundPaiseByBps(gross, BigInt(tdsRateBps));
  const net = gross - big(draft.source.advancePaise) - tds;
  // What the broker billed beyond what is approved — the debit note.
  const debit = freight + claimedPaise(draft) - gross;
  return { gross, tds, net, debit };
};

/** Read-only amount cell. */
function AmountCell({
  paise,
  minus,
}: {
  paise: string | bigint;
  minus?: boolean;
}) {
  const zero = BigInt(paise) === 0n;
  return (
    <span className={zero ? "text-muted-foreground" : undefined}>
      {zero ? "—" : `${minus ? "− " : ""}${money(paise)}`}
    </span>
  );
}

/**
 * LDC (Local Delivery Challan) broker payment: pay the last-mile broker for
 * issued challans. Freight and advance come from the challan; detention from
 * the broker's slab. When the broker claims less, the lower figure is paid —
 * the server enforces the same rule, so this screen is only a preview.
 */
export function LDCSlipWizard() {
  const router = useRouter();
  const { user } = useAuth();

  const [branchId, setBranchId] = React.useState(user?.branchId ?? "");
  const [transportId, setTransportId] = React.useState("");
  const [transportSearch, setTransportSearch] = React.useState("");
  const debouncedTransportSearch = useDebouncedValue(transportSearch, 250);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState(today());
  const [searched, setSearched] = React.useState(false);
  const [challanSearch, setChallanSearch] = React.useState("");
  const debouncedChallanSearch = useDebouncedValue(challanSearch.trim(), 400);
  const [tdsPct, setTdsPct] = React.useState("1");

  // Selected challans, keyed by challan id — survive search and load-more.
  const [drafts, setDrafts] = React.useState<Record<string, ChallanDraft>>({});
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

  const eligible = useInfiniteQuery({
    queryKey: [
      "vendor-payment",
      "eligible-ldc",
      transportId,
      branchId,
      from,
      to,
      debouncedChallanSearch,
    ],
    queryFn: ({ pageParam }) =>
      vendorPaymentApi.eligibleLDCSources({
        transportId,
        branchId: branchId || undefined,
        from: from || undefined,
        to: to || undefined,
        search: debouncedChallanSearch || undefined,
        page: pageParam,
        size: PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      allPages.length * PAGE_SIZE < (lastPage.meta?.total ?? 0)
        ? allPages.length
        : undefined,
    placeholderData: keepPreviousData,
    enabled: searched && Boolean(transportId),
  });
  const challans = React.useMemo(
    () => eligible.data?.pages.flatMap((page) => page.data) ?? [],
    [eligible.data],
  );

  // A new broker or branch is a different set of challans.
  React.useEffect(() => setDrafts({}), [transportId, branchId]);

  const tdsRateBps = React.useMemo(() => {
    const parsed = Number(tdsPct);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : -1;
  }, [tdsPct]);
  const tdsValid = tdsRateBps >= 0 && tdsRateBps <= 10000;

  const toggle = (source: EligibleLDCSource, checked: boolean) => {
    setDrafts((prev) => {
      if (checked) {
        if (prev[source.sourceId]) return prev;
        return { ...prev, [source.sourceId]: { source, claimed: "" } };
      }
      const next = { ...prev };
      delete next[source.sourceId];
      return next;
    });
  };

  const updateClaimed = (sourceId: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [sourceId]: { ...prev[sourceId]!, claimed: value },
    }));
  };

  const totals = React.useMemo(() => {
    const sum = {
      freight: 0n,
      detention: 0n,
      gross: 0n,
      advance: 0n,
      tds: 0n,
      debit: 0n,
      net: 0n,
    };
    for (const draft of Object.values(drafts)) {
      const line = linePreview(draft, Math.max(tdsRateBps, 0));
      sum.freight += big(draft.source.freightPaise);
      sum.detention += approvedDetentionPaise(draft);
      sum.gross += line.gross;
      sum.advance += big(draft.source.advancePaise);
      sum.tds += line.tds;
      sum.debit += line.debit;
      sum.net += line.net;
    }
    return sum;
  }, [drafts, tdsRateBps]);

  const negative = Object.values(drafts).filter(
    (draft) => linePreview(draft, Math.max(tdsRateBps, 0)).net < 0n,
  );

  const canSave =
    selectedIds.length > 0 &&
    Boolean(branchId) &&
    Boolean(transportId) &&
    tdsValid &&
    negative.length === 0;

  // Only the claimed detention is read from the client — the server caps it
  // at the slab and re-derives freight, advance and TDS from the challan.
  const buildBody = () => ({
    type: "LDC_BROKER" as const,
    branchId,
    transportId,
    tdsRateBps,
    lines: Object.values(drafts).map((draft) => ({
      sourceType: "DELIVERY_CHALLAN" as const,
      sourceId: draft.source.sourceId,
      freightPaise: draft.source.freightPaise,
      detentionPaise: String(claimedPaise(draft)),
      advancePaise: draft.source.advancePaise,
      commissionPaise: "0",
      hamaliPaise: "0",
      tdsPaise: "0",
      damagePaise: "0",
      stationeryPaise: "0",
    })),
  });

  const saveDraft = useMutation({
    mutationFn: () => vendorPaymentApi.createSlip(buildBody()),
    onSuccess: (slip) => {
      toast.success(`Draft ${slip.slipNumber} saved`);
      router.push(`/accounts/vendor-payments/${slip.id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not save the draft",
      ),
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
      toast.error(
        error instanceof Error ? error.message : "Could not submit the slip",
      ),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <StepHeading
            step={1}
            title="Select broker"
            description="Choose the destination branch and the broker (transporter) whose trucks delivered the challans."
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
          <Field label="Broker" className="xl:col-span-2">
            <Combobox
              options={transportOptions}
              value={transportId}
              onChange={setTransportId}
              searchValue={transportSearch}
              onSearchChange={setTransportSearch}
              placeholder="Select broker"
              searchPlaceholder="Search transporters..."
            />
          </Field>
          <Field label="Loaded from">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Loaded to">
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <div className="flex items-end xl:col-span-5">
            <Button
              type="button"
              disabled={!transportId || !branchId}
              onClick={() => setSearched(true)}
            >
              Find challans
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
                title="Select challans"
                description="Issued, unpaid challans for this broker. Detention is calculated from the broker's slab. Enter the broker's claimed detention to compare — the lower figure is paid."
              />
              {selectedIds.length ? (
                <span className="rounded-sm border bg-background px-3 py-1 text-xs font-medium">
                  {selectedIds.length} challan
                  {selectedIds.length === 1 ? "" : "s"} selected
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={challanSearch}
              onChange={(event) => setChallanSearch(event.target.value)}
              placeholder="Search by challan no..."
              aria-label="Search challans"
              className="sm:max-w-sm"
            />
            {eligible.isLoading ? (
              <Skeleton className="h-40" />
            ) : eligible.isError ? (
              <div className="py-10 text-center">
                <p className="font-medium">Could not load challans</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => eligible.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : !challans.length ? (
              <div className="py-10 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <IconTruckDelivery size={20} />
                </span>
                <p className="mt-3 font-medium">
                  {debouncedChallanSearch
                    ? "No matching challans"
                    : "No challans to pay"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {debouncedChallanSearch
                    ? "No unpaid issued challan matches that number."
                    : "No issued, unpaid challan for this broker in the selected range."}
                </p>
              </div>
            ) : (
              <div
                aria-busy={eligible.isPlaceholderData}
                className={
                  eligible.isPlaceholderData ? "opacity-60" : undefined
                }
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Select</TableHead>
                        <TableHead>Challan</TableHead>
                        <TableHead>Loaded</TableHead>
                        <TableHead className="text-right">Freight</TableHead>
                        <TableHead className="text-right">
                          Detention (slab)
                        </TableHead>
                        <TableHead className="text-right">
                          Broker claimed
                        </TableHead>
                        <TableHead className="text-right">Approved</TableHead>
                        <TableHead className="text-right">Advance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challans.map((source) => {
                        const draft = drafts[source.sourceId];
                        const checked = Boolean(draft);
                        return (
                          <TableRow
                            key={source.sourceId}
                            className={checked ? "bg-primary/5" : undefined}
                          >
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                aria-label={`Select challan ${source.label}`}
                                onCheckedChange={(v) =>
                                  toggle(source, v === true)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{source.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {source.vehicleNumber ?? "No vehicle"}
                              </p>
                              {source.detentionWarnings.map((warning) => (
                                <p
                                  key={warning}
                                  className="mt-1 flex items-start gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                                >
                                  <IconAlertTriangle
                                    size={13}
                                    className="mt-0.5 shrink-0"
                                  />
                                  {warning}
                                </p>
                              ))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(source.occurredAt)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={source.freightPaise} />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={source.detentionPaise} />
                            </TableCell>
                            <TableCell>
                              <Input
                                inputMode="decimal"
                                value={draft?.claimed ?? ""}
                                disabled={!checked}
                                onChange={(event) =>
                                  updateClaimed(
                                    source.sourceId,
                                    event.target.value,
                                  )
                                }
                                placeholder="Same"
                                aria-label={`Broker claimed detention for ${source.label}`}
                                className="ml-auto h-8 w-24 text-right text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {draft ? (
                                <AmountCell
                                  paise={approvedDetentionPaise(draft)}
                                />
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <AmountCell paise={source.advancePaise} minus />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {eligible.isFetchingNextPage ? (
                        <SkeletonTableRows columns={8} />
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
                <LoadMoreFooter
                  shown={challans.length}
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
              title="TDS and totals"
              description="TDS is applied to each challan's freight plus approved detention. The server recalculates everything on save — this is a preview."
            />
          </CardHeader>
          <CardContent className="space-y-5">
            {!tdsValid ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>Enter a TDS percentage between 0 and 100.</p>
              </div>
            ) : null}
            {negative.length > 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  {negative.length} selected challan
                  {negative.length === 1 ? " has" : "s have"} an advance larger
                  than freight plus detention — fix before saving.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
              <Field label="TDS %">
                <Input
                  inputMode="decimal"
                  value={tdsPct}
                  onChange={(e) => setTdsPct(e.target.value)}
                  className="text-right"
                />
              </Field>
              <div className="grid gap-4 rounded-md border bg-muted/20 p-4 text-sm sm:grid-cols-3 xl:grid-cols-6">
                <div>
                  <p className="text-xs text-muted-foreground">Freight</p>
                  <p className="mt-1 font-semibold">{money(totals.freight)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Detention (approved)
                  </p>
                  <p className="mt-1 font-semibold">
                    {money(totals.detention)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bill amount</p>
                  <p className="mt-1 font-semibold">{money(totals.gross)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Advance</p>
                  <p className="mt-1 font-semibold">
                    − {money(totals.advance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TDS</p>
                  <p className="mt-1 font-semibold">− {money(totals.tds)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net payable</p>
                  <p className="mt-1 text-base font-semibold">
                    {money(totals.net)}
                  </p>
                </div>
              </div>
            </div>
            {totals.debit > 0n ? (
              <p className="text-sm text-muted-foreground">
                Broker claimed {money(totals.debit)} more detention than the
                slab allows. Only the approved amount is paid.
              </p>
            ) : null}
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
                {createAndSubmit.isPending
                  ? "Submitting..."
                  : "Save and submit"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
