"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";

import { Button } from "@skerp/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import {
  Field,
  LoadMoreFooter,
  PageHeader,
  SkeletonTableRows,
  formatDate,
  money,
} from "@/features/vendor-payment/vendor-payment.ui";
import { driverFinanceApi, driverFinanceKeys } from "./driver-finance.service";
import { SalaryRunStatusBadge } from "./driver-finance.ui";
import { LeftDriversWarning } from "./LeftDriversWarning";

const CHUNK_SIZE = 20;

/** "YYYY-MM" of the month that just ended — the usual one to run. */
const lastMonth = () => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
};

function NewSalaryRunDialog({
  open,
  onOpenChange,
  branchName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchName: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [month, setMonth] = React.useState(lastMonth());

  React.useEffect(() => {
    if (open) setMonth(lastMonth());
  }, [open]);

  const create = useMutation({
    mutationFn: () => driverFinanceApi.createSalaryRun({ month }),
    onSuccess: (run) => {
      toast.success(`${run.runNumber} created for ${run.monthLabel}`);
      queryClient.invalidateQueries({ queryKey: driverFinanceKeys.all });
      onOpenChange(false);
      router.push(`/accounts/driver-salary-runs/${run.id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New salary run</DialogTitle>
          <DialogDescription>
            Adds every driver who has a salary in the Driver master, with this month&apos;s salary
            advances and log slips filled in. You then type absent days.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Month">
            <Input
              id="salary-run-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
          <Field label="Branch">
            <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
              {branchName}
            </p>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!month || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create salary run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SalaryRunsPage() {
  const router = useRouter();
  const canManage = useCan(PERMS.DRIVER_FINANCE.SALARY_MANAGE);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const settings = useQuery({
    queryKey: ["driver-finance", "settings"],
    queryFn: () => driverFinanceApi.settings(),
  });
  const testingMode =
    settings.data && (!settings.data.makerChecker || settings.data.earlyApproval);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);

  const query = useInfiniteQuery({
    queryKey: driverFinanceKeys.salaryRuns(debouncedSearch),
    queryFn: ({ pageParam }) =>
      driverFinanceApi.salaryRuns({
        page: pageParam,
        size: CHUNK_SIZE,
        search: debouncedSearch || undefined,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < (lastPage.meta?.total ?? 0) ? allPages.length : undefined;
    },
    placeholderData: keepPreviousData,
  });
  const runs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages.at(-1)?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver salary runs"
        description="The monthly driver salary sheet: salary for days worked, minus salary advances and log slip balances. Approve it, then pay."
        actions={
          canManage && settings.data?.canRunSalary ? (
            <Button onClick={() => setOpen(true)}>New salary run</Button>
          ) : null
        }
      />

      {settings.data ? (
        <p className="text-sm text-muted-foreground">
          Driver salary is run at{" "}
          <span className="font-medium text-foreground">{settings.data.headOffice.name}</span> for
          the whole company, starting with{" "}
          <span className="font-medium text-foreground">{formatDate(settings.data.startDate)}</span>.
          Runs go in month order: approve each month before the next.
        </p>
      ) : null}

      <LeftDriversWarning />

      {testingMode ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-semibold">Testing mode is on</p>
          <ul className="mt-1 list-disc pl-5">
            {settings.data!.earlyApproval ? (
              <li>A run can be approved before its month ends (DRIVER_SALARY_ALLOW_EARLY_APPROVAL).</li>
            ) : null}
            {!settings.data!.makerChecker ? (
              <li>The person who created a run can approve it (DRIVER_SALARY_MAKER_CHECKER).</li>
            ) : null}
          </ul>
          <p className="mt-1">Remove these settings from the server before going live.</p>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Salary runs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a run to open its salary sheet.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by run number or month (2026-10)…"
            aria-label="Search salary runs"
            className="sm:max-w-sm"
          />
          {query.isLoading ? (
            <Skeleton className="h-60" />
          ) : query.isError ? (
            <div className="py-10 text-center">
              <p className="font-medium">Could not load the salary runs</p>
              <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
                Try again
              </Button>
            </div>
          ) : !runs.length ? (
            <div className="py-10 text-center">
              <p className="font-medium">No salary runs yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create one for a month to start the salary sheet.
              </p>
            </div>
          ) : (
            <div className={query.isPlaceholderData ? "opacity-60" : undefined}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Run no.</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Drivers</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Net pay</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/accounts/driver-salary-runs/${run.id}`)}
                      >
                        <TableCell className="font-medium">{run.monthLabel}</TableCell>
                        <TableCell className="text-sm">{run.runNumber}</TableCell>
                        <TableCell className="text-sm">{run.branch.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {run._count?.salaries ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(run.totalEarnedPaise)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(run.totalNetPaise)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(run.paidPaise)}</TableCell>
                        <TableCell>
                          <SalaryRunStatusBadge status={run.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {query.isFetchingNextPage ? <SkeletonTableRows columns={8} /> : null}
                  </TableBody>
                </Table>
              </div>
              <LoadMoreFooter
                shown={runs.length}
                total={total}
                hasNextPage={Boolean(query.hasNextPage)}
                isFetchingNextPage={query.isFetchingNextPage}
                onLoadMore={() => query.fetchNextPage()}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {settings.data && !settings.data.canRunSalary ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Driver salary is run at <strong>{settings.data.headOffice.name}</strong>. Your login
          doesn&apos;t have access to that branch, so salary runs are not shown here.
        </div>
      ) : null}

      <NewSalaryRunDialog
        open={open}
        onOpenChange={setOpen}
        branchName={settings.data?.headOffice.name ?? "Head office"}
      />
    </div>
  );
}
