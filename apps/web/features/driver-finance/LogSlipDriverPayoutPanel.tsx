"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconCash, IconAlertTriangle } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";

import { useCan } from "@/features/auth";
import { formatDate, money } from "@/features/vendor-payment/vendor-payment.ui";
import { driverFinanceApi, driverFinanceKeys } from "./driver-finance.service";
import { PAYMENT_MODE_LABELS } from "./driver-finance.ui";
import { PayDriverDialog, type PayDriverTarget } from "./PayDriverDialog";

/**
 * On a log slip that ends with "payable to driver", the office hands that
 * amount over in cash at journey close. Recording it here posts Dr driver /
 * Cr cash, so the driver's ledger is settled and the salary run does not pay
 * the same amount again.
 */
export function LogSlipDriverPayoutPanel({ logSlipId }: { logSlipId: string }) {
  const canView = useCan(PERMS.DRIVER_FINANCE.SALARY_VIEW);
  const canPay = useCan(PERMS.DRIVER_FINANCE.PAY);
  const [open, setOpen] = React.useState(false);

  const status = useQuery({
    queryKey: driverFinanceKeys.logSlipPayout(logSlipId),
    queryFn: () => driverFinanceApi.logSlipPayoutStatus(logSlipId),
    enabled: canView,
  });

  const target = React.useMemo<PayDriverTarget | null>(
    () =>
      status.data
        ? {
            kind: "LOG_SLIP",
            logSlipId,
            logSlipNumber: status.data.logSlipNumber,
            driverId: status.data.driver.id,
            driverName: status.data.driver.name,
            remainingPaise: status.data.remainingPaise,
          }
        : null,
    [logSlipId, status.data],
  );

  if (!canView || !status.data || BigInt(status.data.payablePaise) <= 0n) return null;
  const s = status.data;

  // An approved salary run already paid whatever was left on this log slip.
  if (s.settledBySalaryRun && BigInt(s.paidPaise) < BigInt(s.payablePaise)) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Driver payment for this log slip</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Payable {money(s.payablePaise)} · Paid in cash {money(s.paidPaise)} · The rest is settled in
          salary run{" "}
          <Link
            href={`/accounts/driver-salary-runs/${s.settledBySalaryRun.id}`}
            className="text-primary hover:underline"
          >
            {s.settledBySalaryRun.runNumber}
          </Link>
          .
        </p>
      </div>
    );
  }

  // Older log slips were paid in cash before the ERP tracked driver money.
  if (s.settledBeforeStart) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Driver payment for this log slip</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Payable {money(s.payablePaise)} · Settled before {formatDate(s.startDate)}, outside the ERP.
          Nothing to pay here.
        </p>
      </div>
    );
  }

  const remaining = BigInt(s.remainingPaise);
  const overpaid = BigInt(s.paidPaise) > BigInt(s.payablePaise);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Driver payment for this log slip</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Payable {money(s.payablePaise)} · Paid {money(s.paidPaise)} ·{" "}
            <span className={remaining > 0n ? "font-medium text-foreground" : undefined}>
              Unpaid {money(remaining)}
            </span>
          </p>
        </div>
        {canPay && remaining > 0n ? (
          s.postedToAccounts ? (
            <Button onClick={() => setOpen(true)}>
              <IconCash size={16} className="mr-1" /> Paid in cash
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Post the log slip to accounts before recording the payment.
            </p>
          )
        ) : null}
      </div>

      {overpaid ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-amber-700">
          <IconAlertTriangle size={14} />
          More was paid than this log slip now shows as payable — it was probably regenerated after
          the payment. Reverse the extra payment from Driver Payments if needed.
        </p>
      ) : null}

      {s.payouts.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {s.payouts.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 border-t pt-1">
              <span>
                {p.payoutNumber} · {formatDate(p.paidAt)} · {PAYMENT_MODE_LABELS[p.mode]}
              </span>
              <span className="tabular-nums">{money(p.amountPaise)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {target ? <PayDriverDialog open={open} onOpenChange={setOpen} target={target} /> : null}
    </div>
  );
}
