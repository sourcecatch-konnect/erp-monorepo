"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconAlertTriangle, IconUsers } from "@tabler/icons-react";

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
import { branchApi } from "@/features/masters/branch/branch.service";
import { labourApi } from "@/features/masters/labour/labour.service";
import {
  vendorPaymentApi,
  type EligibleHamaliSource,
  type HamaliSourceType,
} from "./vendor-payment.service";
import { Field, StepHeading, money, today } from "./vendor-payment.ui";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const SOURCE_TYPE_LABELS: Record<HamaliSourceType, string> = {
  GRN_HAMALI: "Origin GRN",
  RAIL_BRANCH_GRN: "Rail Branch GRN",
  VP_LOADING: "VP Wagon Loading",
};

const sourceKey = (s: { sourceType: HamaliSourceType; sourceId: string }) =>
  `${s.sourceType}|${s.sourceId}`;

/** Round-half-up, mirroring the server's roundPaiseByBps exactly (bps = 1/100%). */
const roundPaiseByBps = (amountPaise: bigint, rateBps: bigint) =>
  (amountPaise * rateBps + 5000n) / 10000n;

export function HamaliSlipWizard() {
  const router = useRouter();
  const { user } = useAuth();

  const [branchId, setBranchId] = React.useState(user?.branchId ?? "");
  const [labourId, setLabourId] = React.useState("");
  const [labourSearch, setLabourSearch] = React.useState("");
  const debouncedLabourSearch = useDebouncedValue(labourSearch, 250);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState(today());
  const [searched, setSearched] = React.useState(false);
  const [tdsPct, setTdsPct] = React.useState("2");

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const branches = useQuery({
    queryKey: ["vendor-payment", "branches"],
    queryFn: () => branchApi.list({ page: 0, size: 100 }),
  });

  const labours = useQuery({
    queryKey: ["vendor-payment", "labours", debouncedLabourSearch],
    queryFn: () =>
      labourApi.list({ page: 0, size: 20, search: debouncedLabourSearch || undefined }),
  });
  const labourOptions: ComboboxOption[] = (labours.data?.data ?? []).map((l) => ({
    label: l.name,
    value: l.id,
  }));

  const eligible = useQuery({
    queryKey: ["vendor-payment", "eligible-hamali-sources", labourId, branchId, from, to],
    queryFn: () =>
      vendorPaymentApi.eligibleHamaliSources({
        labourId,
        branchId: branchId || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: searched && Boolean(labourId),
  });
  const sources = eligible.data ?? [];
  const sourceByKey = new Map(sources.map((s) => [sourceKey(s), s]));

  const toggleSource = (s: EligibleHamaliSource, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(sourceKey(s));
      else next.delete(sourceKey(s));
      return next;
    });
  };

  const tdsRateBps = React.useMemo(() => {
    const parsed = Number(tdsPct);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [tdsPct]);

  const totals = React.useMemo(() => {
    let gross = 0n;
    let tds = 0n;
    for (const key of selected) {
      const s = sourceByKey.get(key);
      if (!s) continue;
      const g = BigInt(s.hamaliPaise);
      gross += g;
      tds += roundPaiseByBps(g, BigInt(tdsRateBps));
    }
    return { gross, tds, net: gross - tds };
  }, [selected, sourceByKey, tdsRateBps]);

  const canSave =
    selected.size > 0 && Boolean(branchId) && Boolean(labourId) && tdsRateBps >= 0 && tdsRateBps <= 10000;

  const buildBody = () => ({
    type: "HAMALI" as const,
    branchId,
    labourId,
    tdsRateBps,
    lines: [...selected].map((key) => {
      const s = sourceByKey.get(key)!;
      return {
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        freightPaise: "0",
        detentionPaise: "0",
        advancePaise: "0",
        commissionPaise: "0",
        hamaliPaise: s.hamaliPaise,
        tdsPaise: "0",
        damagePaise: "0",
        stationeryPaise: "0",
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
            title="Select labour"
            description="Choose the branch and labour, then load their unclaimed hamali across origin GRN, Rail Branch GRN and VP Wagon Loading."
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
          <Field label="Labour" className="xl:col-span-2">
            <Combobox
              options={labourOptions}
              value={labourId}
              onChange={setLabourId}
              searchValue={labourSearch}
              onSearchChange={setLabourSearch}
              placeholder="Select labour"
              searchPlaceholder="Search labour..."
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
              disabled={!labourId || !branchId}
              onClick={() => setSearched(true)}
            >
              Search eligible hamali
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
                title="Select sources"
                description="All three source types can be combined on one slip. Amounts are read from the source record — not editable here."
              />
              {sources.length ? (
                <span className="rounded-sm border bg-background px-3 py-1 text-xs font-medium">
                  {sources.length} eligible source{sources.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {eligible.isLoading ? (
              <Skeleton className="h-40" />
            ) : !sources.length ? (
              <div className="py-10 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <IconUsers size={20} />
                </span>
                <p className="mt-3 font-medium">No eligible hamali</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nothing unclaimed for this labour in the selected range.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Select</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Hamali</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((s) => {
                      const key = sourceKey(s);
                      const checked = selected.has(key);
                      return (
                        <TableRow key={key} className={checked ? "bg-primary/5" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleSource(s, v === true)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {SOURCE_TYPE_LABELS[s.sourceType]}
                          </TableCell>
                          <TableCell className="font-medium">{s.label}</TableCell>
                          <TableCell className="text-xs">
                            {s.occurredAt
                              ? new Date(s.occurredAt).toLocaleDateString("en-IN")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {money(s.hamaliPaise)}
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
              title="TDS and totals"
              description="TDS is applied to each selected source's hamali amount and recalculated by the server — this is a preview."
            />
          </CardHeader>
          <CardContent className="space-y-5">
            {tdsRateBps < 0 || tdsRateBps > 10000 ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>Enter a TDS percentage between 0 and 100.</p>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="TDS %">
                <Input
                  inputMode="decimal"
                  value={tdsPct}
                  onChange={(e) => setTdsPct(e.target.value)}
                  placeholder="2"
                />
              </Field>
            </div>
            <div className="grid gap-4 rounded-md border bg-muted/20 p-4 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Gross hamali</p>
                <p className="mt-1 text-base font-semibold">{money(totals.gross)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TDS</p>
                <p className="mt-1 text-base font-semibold">{money(totals.tds)}</p>
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
