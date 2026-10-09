"use client";

import * as React from "react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";

import { useCan } from "@/features/auth";
import { PageHeader } from "@/features/vendor-payment/vendor-payment.ui";
import { driverFinanceApi, type DriverPayoutSource } from "./driver-finance.service";
import { DriverFinanceRegister } from "./DriverFinanceRegister";
import { NewSalaryAdvanceDialog } from "./NewSalaryAdvanceDialog";
import { PayDriverDialog } from "./PayDriverDialog";

export function SalaryAdvancesPage() {
  const canCreate = useCan(PERMS.DRIVER_FINANCE.ADVANCE_MANAGE);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver salary advances"
        description="Money given to a driver against his salary. It is deducted automatically in his next salary run. Trip advances are separate and settle on the log slip."
        actions={canCreate ? <Button onClick={() => setOpen(true)}>New salary advance</Button> : null}
      />
      <DriverFinanceRegister
        kind="salary-advances"
        title="Salary advances"
        emptyText="Salary advances will appear here once one is given."
        detailHeading="Reason"
        toRow={(a) => ({
          id: a.id,
          number: a.advanceNumber,
          driverName: a.driver.name,
          amountPaise: a.amountPaise,
          paidAt: a.paidAt,
          mode: a.mode,
          fundingName: a.fundingLedger.name,
          detail: a.status === "REVERSED" ? `Reversed: ${a.reverseReason ?? ""}` : (a.reason ?? "—"),
          status: a.status,
          journalEntryId: a.journalEntryId,
        })}
        reverse={driverFinanceApi.reverseSalaryAdvance}
        reversePermission={PERMS.DRIVER_FINANCE.ADVANCE_MANAGE}
        reverseHint="Posts a contra entry that cancels this advance in the driver's ledger and the cash / bank account."
      />
      <NewSalaryAdvanceDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

const SOURCE_LABELS: Record<DriverPayoutSource, string> = {
  SALARY_RUN: "Salary",
  LOG_SLIP: "Log slip balance",
  MANUAL: "Manual payment",
};

const MANUAL_TARGET = { kind: "MANUAL" } as const;

export function DriverPaymentsPage() {
  const canPay = useCan(PERMS.DRIVER_FINANCE.PAY);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver payments"
        description="Every payment made to a driver: salary, log slip balances paid in cash, and manual settlements."
        actions={canPay ? <Button onClick={() => setOpen(true)}>Pay driver</Button> : null}
      />
      <DriverFinanceRegister
        kind="payouts"
        title="Payments"
        emptyText="Driver payments will appear here once one is made."
        detailHeading="For"
        toRow={(p) => ({
          id: p.id,
          number: p.payoutNumber,
          driverName: p.driver.name,
          amountPaise: p.amountPaise,
          paidAt: p.paidAt,
          mode: p.mode,
          fundingName: p.fundingLedger.name,
          detail:
            p.status === "REVERSED"
              ? `Reversed: ${p.reverseReason ?? ""}`
              : p.source === "LOG_SLIP"
                ? `${SOURCE_LABELS.LOG_SLIP} ${p.logSlip?.logSlipNumber ?? ""}`
                : p.source === "SALARY_RUN"
                  ? `${SOURCE_LABELS.SALARY_RUN} ${p.salaryRun?.month ?? ""}`
                  : SOURCE_LABELS.MANUAL,
          status: p.status,
          journalEntryId: p.journalEntryId,
        })}
        reverse={driverFinanceApi.reversePayout}
        reversePermission={PERMS.DRIVER_FINANCE.PAY}
        reverseHint="Posts a contra entry that cancels this payment in the driver's ledger and the cash / bank account."
      />
      <PayDriverDialog open={open} onOpenChange={setOpen} target={MANUAL_TARGET} />
    </div>
  );
}
