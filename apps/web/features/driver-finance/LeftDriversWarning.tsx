"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconAlertTriangle } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";

import { useCan } from "@/features/auth";
import { formatDate, money } from "@/features/vendor-payment/vendor-payment.ui";
import { driverFinanceApi, driverFinanceKeys } from "./driver-finance.service";
import { PayDriverDialog, type PayDriverTarget } from "./PayDriverDialog";

/**
 * G9 — drivers who have left but whose account is not settled. They are in
 * no later salary run, so an unrecovered advance (or money we still owe) would
 * otherwise go unnoticed. Shows nothing when every leaver is settled.
 */
export function LeftDriversWarning() {
  const canPay = useCan(PERMS.DRIVER_FINANCE.PAY);
  const [payFor, setPayFor] = React.useState<PayDriverTarget | null>(null);
  const query = useQuery({
    queryKey: [...driverFinanceKeys.all, "left-with-balance"],
    queryFn: () => driverFinanceApi.leftWithBalance(),
  });
  const rows = query.data ?? [];
  if (!rows.length) return null;

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <IconAlertTriangle size={16} /> Drivers who left with a balance ({rows.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        They are not in any later salary run, so this won&apos;t settle by itself. Recover what a
        driver owes (record his cash in Cash Planning / Receipts) or pay what we owe him.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Driver</th>
              <th className="py-1 pr-3 font-medium">Left on</th>
              <th className="py-1 pr-3 text-right font-medium">Balance</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const balance = BigInt(r.balancePaise);
              const salaryDue = BigInt(r.salaryDuePaise);
              const weOwe = balance < 0n;
              const payable = weOwe ? -balance - salaryDue : 0n;
              return (
                <tr key={r.driverId} className="border-t border-amber-500/20">
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3">{formatDate(r.leavingDate)}</td>
                  <td className="py-2 pr-3 text-right">
                    {weOwe ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        We owe {money(-balance)}
                      </span>
                    ) : (
                      <span className="font-semibold text-destructive">Owes us {money(balance)}</span>
                    )}
                    {salaryDue > 0n ? (
                      <span className="block text-xs text-muted-foreground">
                        incl. {money(salaryDue)} approved salary ({r.salaryRuns.join(", ")}) — pay with
                        Pay salaries
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/ledger?tab=driver&party=${r.driverId}`}>Statement</Link>
                      </Button>
                      {canPay && payable > 0n ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            setPayFor({ kind: "MANUAL", driverId: r.driverId, driverName: r.name })
                          }
                        >
                          Pay {money(payable)}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {payFor ? (
        <PayDriverDialog
          open={Boolean(payFor)}
          onOpenChange={(open) => !open && setPayFor(null)}
          target={payFor}
        />
      ) : null}
    </div>
  );
}
