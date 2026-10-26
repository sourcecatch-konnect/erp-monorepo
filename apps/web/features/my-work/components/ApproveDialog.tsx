"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { IconExternalLink } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import type { MyWorkPriorityRow, MyWorkQueueKey } from "@skerp/types";
import { driverFinanceApi } from "@/features/driver-finance";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { purchaseOrderApi } from "@/features/purchase-order";
import { receiptApi } from "@/features/receivables";
import { expenseApi } from "@/features/vehicle-journeys";
import { vendorPaymentApi } from "@/features/vendor-payment";
import { formatPaiseCompact } from "@/lib/money";
import { DueLabel } from "./urgency";

/**
 * Approvals that are a plain yes on the owning screen, so My Work can do them
 * in place. Each calls that feature's own approve; the server re-checks
 * permission and status. Rejecting or editing still happens on the document.
 */
const APPROVERS: Partial<
  Record<MyWorkQueueKey, { what: string; run: (id: string) => Promise<unknown> }>
> = {
  receipts_approve: { what: "receipt", run: (id) => receiptApi.approve(id) },
  vendor_payments: {
    what: "vendor payment",
    // Approval is version-checked; read the current version first.
    run: async (id) => {
      const slip = await vendorPaymentApi.slip(id);
      return vendorPaymentApi.approveSlip(id, slip.version);
    },
  },
  trip_expenses: { what: "trip expense", run: (id) => expenseApi.approve(id) },
  salary_runs: {
    what: "salary run",
    run: async (id) => {
      const run = await driverFinanceApi.salaryRun(id);
      return driverFinanceApi.approveSalaryRun(id, run.version);
    },
  },
  po_approve: { what: "purchase order", run: (id) => purchaseOrderApi.approve(id) },
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

export function ApproveDialog({
  row,
  onClose,
  onDone,
}: {
  row: MyWorkPriorityRow;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const approver = APPROVERS[row.queueKey];
  const approve = useMutation({
    mutationFn: () => approver!.run(row.id),
    onSuccess: async () => {
      toast.success(`${row.number} approved`);
      onClose();
      await onDone();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (!approver) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !approve.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve {approver.what}?</DialogTitle>
          <DialogDescription>
            Check the details. To reject or change it, open the full document.
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y rounded-md border px-3">
          <Fact label="Document">
            <span className="font-medium">{row.number}</span>
          </Fact>
          <Fact label="Party">{row.party}</Fact>
          {row.detail && <Fact label="Details">{row.detail}</Fact>}
          {row.amountPaise !== null && (
            <Fact label="Amount">
              <span className="font-semibold tabular-nums">
                {formatPaiseCompact(Number(row.amountPaise))}
              </span>
            </Fact>
          )}
          <Fact label="Waiting">
            <DueLabel
              ageDays={row.ageDays}
              lateAfterDays={row.lateAfterDays}
              isLate={row.isLate}
            />
          </Fact>
        </dl>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Button asChild variant="link" size="sm" className="px-0">
            <Link href={row.recordHref}>
              Open full document
              <IconExternalLink />
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={approve.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={approve.isPending}
              onClick={() => approve.mutate()}
            >
              {approve.isPending ? "Approving…" : "Approve"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
