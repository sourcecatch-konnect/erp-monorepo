"use client";

import * as React from "react";

import type {
  CashPlanDayView,
  CreditorLedgerGroup,
  CreditorLedgerView,
  PaymentStatus,
  ReceivablesView,
} from "@skerp/types";
import { formatPaiseCompact } from "@/lib/money";

type BaseReportProps = {
  day: CashPlanDayView;
  reportDate: string;
};

type Props = BaseReportProps & {
  ledger: CreditorLedgerView;
  receivables: ReceivablesView;
};

type ReceivableRow = ReceivablesView["receivables"][number];

const labelOf = (value: string) =>
  value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

const money = formatPaiseCompact;

const isoDate = (value: Date | string): string =>
  new Date(value).toISOString().slice(0, 10);

const dateLabel = (value: Date | string | null | undefined): string =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })
    : "-";

const printCss = `
.cash-report-ledger-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 0.75rem;
}
.cash-report-ledger-group {
  min-width: 0;
  width: 100%;
}
.cash-report-receivable-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.375rem 0.5rem;
}
.cash-report-checkbox {
  display: inline-block;
  width: 0.78rem;
  height: 0.78rem;
  border: 1px solid currentColor;
}
@media (max-width: 768px) {
  .cash-report-ledger-columns,
  .cash-report-receivable-grid {
    grid-template-columns: 1fr;
  }
}
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  html, body {
    height: auto !important;
    overflow: visible !important;
  }
  body * { visibility: hidden !important; }
  #cash-planning-a4-report, #cash-planning-a4-report * {
    visibility: visible !important;
  }
  #cash-planning-a4-report {
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    overflow: visible !important;
    box-shadow: none !important;
  }
  #cash-planning-a4-report table {
    page-break-inside: auto;
  }
  #cash-planning-a4-report thead {
    display: table-header-group;
  }
  #cash-planning-a4-report tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #cash-planning-a4-report .cash-report-table-frame {
    overflow: visible !important;
    break-inside: auto;
    page-break-inside: auto;
    border-radius: 0 !important;
  }
  #cash-planning-a4-report .cash-report-ledger-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2mm 5mm;
    break-inside: auto;
    page-break-inside: auto;
  }
  #cash-planning-a4-report .cash-report-ledger-group {
    break-inside: auto;
    page-break-inside: auto;
  }
  #cash-planning-a4-report .cash-report-receivable-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2mm 3mm;
  }
  #cash-planning-a4-report .cash-report-queue-row {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #cash-planning-a4-report .cash-report-page-start {
    break-before: page;
    page-break-before: always;
  }
  .a4-avoid-break {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-red-700"
        : "text-foreground";

  return (
    <div className="rounded border border-foreground/10 px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-xs font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`mt-4 border-t border-foreground/10 pt-2 ${className ?? ""}`}>
      <div className="flex items-end justify-between gap-3 border-b border-foreground/15 pb-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {aside ? (
          <div className="text-right text-[11px] text-muted-foreground">
            {aside}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ReportHeader({
  title,
  day,
  reportDate,
}: BaseReportProps & { title: string }) {
  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const reportDateLabel = new Date(`${reportDate}T00:00:00`).toLocaleDateString(
    "en-IN",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  return (
    <header className="flex items-start justify-between gap-6 border-b border-foreground/15 pb-3">
      <div>
        <p className="text-base font-semibold tracking-tight">SK Translines</p>
        <p className="mt-0.5 text-xs font-medium">{title}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold">{reportDateLabel}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {day.status === "CLOSED" ? "Closed day" : "Open day draft"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Generated {generatedOn}
        </p>
      </div>
    </header>
  );
}

function ReportFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        id="cash-planning-a4-report"
        className="mx-auto w-[210mm] max-w-full bg-white px-[9mm] py-[7mm] text-foreground shadow-sm print:w-full print:p-0 print:shadow-none"
      >
        {children}
      </div>

      <style>{printCss}</style>
    </>
  );
}

function FullMetrics({
  day,
  ledger,
  receivables,
  expectedDueByReportDate,
  projectedCash,
  netAfterCreditors,
}: {
  day: CashPlanDayView;
  ledger: CreditorLedgerView;
  receivables: ReceivablesView;
  expectedDueByReportDate: number;
  projectedCash: number;
  netAfterCreditors: number;
}) {
  return (
    <section className="mt-3 grid grid-cols-4 gap-1.5">
      <Metric label="Opening cash" value={money(day.totalOpening)} />
      <Metric label="Approved payments" value={money(day.approvedTotal)} />
      <Metric label="Available cash" value={money(day.availableCash)} />
      <Metric label="Pending payments" value={money(day.pendingTotal)} />
      <Metric label="Creditor outstanding" value={money(ledger.grandTotal)} />
      <Metric label="Receivable pending" value={money(receivables.totalPending)} />
      <Metric
        label="Expected by date"
        value={money(expectedDueByReportDate)}
        sub="Receivable slices due by report date"
        tone="positive"
      />
      <Metric
        label="Net after creditors"
        value={money(netAfterCreditors)}
        tone={netAfterCreditors < 0 ? "negative" : "positive"}
        sub={`Projected cash ${money(projectedCash)}`}
      />
    </section>
  );
}

function QueueOnlyMetrics({ day }: { day: CashPlanDayView }) {
  const approvedCount = day.payments.filter((row) => row.status === "APPROVED").length;
  const pendingCount = day.payments.filter((row) => row.status === "PENDING").length;
  const holdCount = day.payments.filter((row) => row.status === "HOLD").length;
  const rejectedCount = day.payments.filter((row) => row.status === "REJECTED").length;

  return (
    <section className="mt-3 grid grid-cols-4 gap-1.5">
      <Metric label="Opening cash" value={money(day.totalOpening)} />
      <Metric label="Available cash" value={money(day.availableCash)} />
      <Metric label="Approved payments" value={money(day.approvedTotal)} />
      <Metric label="Pending payments" value={money(day.pendingTotal)} />
      <Metric label="Queue rows" value={day.payments.length} />
      <Metric label="Approved rows" value={approvedCount} />
      <Metric label="Pending rows" value={pendingCount} />
      <Metric label="Hold / rejected" value={`${holdCount} / ${rejectedCount}`} />
    </section>
  );
}

const paymentLabel = (value: string | null | undefined) =>
  value ? labelOf(value) : "-";

const paymentRowClass: Record<PaymentStatus, string> = {
  PENDING: "",
  APPROVED: "text-muted-foreground line-through decoration-foreground/50",
  HOLD: "text-muted-foreground",
  REJECTED: "text-muted-foreground line-through decoration-foreground/50",
};

function PaymentQueueSection({ day }: { day: CashPlanDayView }) {
  return (
    <Section
      title="Payment Queue"
      aside={`${day.payments.length} rows, ${money(day.pendingTotal)} pending`}
    >
      <div className="cash-report-table-frame mt-2 overflow-hidden rounded border border-foreground/10">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-foreground/10 bg-muted/50 text-left text-[9px] uppercase tracking-wide text-muted-foreground">
              <th className="w-5 px-1.5 py-1 font-semibold">Tick</th>
              <th className="w-8 px-1.5 py-1 text-right font-semibold">#</th>
              <th className="px-1.5 py-1 font-semibold">Payee</th>
              <th className="px-1.5 py-1 font-semibold">Type</th>
              <th className="px-1.5 py-1 font-semibold">Mode</th>
              <th className="px-1.5 py-1 font-semibold">Segment</th>
              <th className="px-1.5 py-1 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {day.payments.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-2 py-5 text-center text-muted-foreground"
                >
                  No payments queued.
                </td>
              </tr>
            ) : (
              day.payments.map((payment, index) => (
                <tr
                  key={payment.id}
                  className={`cash-report-queue-row border-b border-foreground/5 last:border-0 ${paymentRowClass[payment.status]}`}
                >
                  <td className="px-1.5 py-1 text-center">
                    <span className="cash-report-checkbox" />
                  </td>
                  <td className="px-1.5 py-1 text-right tabular-nums">
                    {index + 1}
                  </td>
                  <td className="max-w-[62mm] truncate px-1.5 py-1 font-medium">
                    {payment.payeeName}
                  </td>
                  <td className="px-1.5 py-1">{paymentLabel(payment.category)}</td>
                  <td className="px-1.5 py-1">{paymentLabel(payment.mode)}</td>
                  <td className="px-1.5 py-1">{paymentLabel(payment.segment)}</td>
                  <td className="px-1.5 py-1 text-right font-semibold tabular-nums">
                    {money(payment.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function CreditorGroupTable({ group }: { group: CreditorLedgerGroup }) {
  const creditors = [...group.creditors].sort(
    (a, b) =>
      b.outstandingBalance - a.outstandingBalance ||
      a.name.localeCompare(b.name, "en-IN", { sensitivity: "base" }),
  );

  return (
    <div className="cash-report-ledger-group cash-report-table-frame mb-2 overflow-hidden rounded border border-foreground/10">
      <div className="flex items-center justify-between bg-muted/50 px-2 py-1 text-[11px] font-semibold">
        <span>{labelOf(group.category)}</span>
        <span className="tabular-nums">{money(group.subtotal)}</span>
      </div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-1 font-semibold">Creditor</th>
            <th className="px-2 py-1 text-right font-semibold">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {creditors.map((creditor) => (
            <tr
              key={creditor.id}
              className="border-b border-foreground/5 last:border-0"
            >
              <td className="px-2 py-1">{creditor.name}</td>
              <td className="px-2 py-1 text-right tabular-nums">
                {money(creditor.outstandingBalance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceivableTable({ rows }: { rows: ReceivableRow[] }) {
  return (
    <div className="cash-report-table-frame overflow-hidden rounded border border-foreground/10">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-foreground/10 bg-muted/50 text-left text-[9px] uppercase tracking-wide text-muted-foreground">
            <th className="px-1.5 py-1 font-semibold">Party</th>
            <th className="px-1.5 py-1 text-right font-semibold">Pend.</th>
            <th className="px-1.5 py-1 text-right font-semibold">Exp.</th>
            <th className="px-1.5 py-1 text-right font-semibold">Recv.</th>
            <th className="px-1.5 py-1 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-foreground/5 last:border-0"
            >
              <td className="max-w-[34mm] truncate px-1.5 py-1 font-medium">
                {row.partyName}
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums">
                {money(row.totalAmount)}
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums">
                {row.expectedAmount > 0 ? money(row.expectedAmount) : "-"}
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums">
                {(row.receivedAmount ?? 0) > 0
                  ? money(row.receivedAmount ?? 0)
                  : "-"}
              </td>
              <td className="whitespace-nowrap px-1.5 py-1 tabular-nums">
                {dateLabel(row.expectedDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CashPlanningA4Report({
  day,
  ledger,
  receivables,
  reportDate,
}: Props) {
  const creditorGroups = ledger.groups
    .filter((group) => group.creditors.length > 0 || group.subtotal > 0)
    .sort((a, b) => b.subtotal - a.subtotal);
  const creditorCount = creditorGroups.reduce(
    (sum, group) => sum + group.creditors.length,
    0,
  );
  const largestCategory = creditorGroups[0];

  const openReceivables = receivables.receivables.filter(
    (row) => !row.ackReceived,
  );
  const settledReceivables =
    receivables.receivables.length - openReceivables.length;
  const receivedTotal = receivables.receivables.reduce(
    (sum, row) => sum + (row.receivedAmount ?? 0),
    0,
  );
  const expectedDueByReportDate = openReceivables
    .filter(
      (row) =>
        row.expectedDate &&
        row.expectedAmount > 0 &&
        isoDate(row.expectedDate) <= reportDate,
    )
    .reduce((sum, row) => sum + row.expectedAmount, 0);
  const projectedCash = day.availableCash + expectedDueByReportDate;
  const netAfterCreditors = projectedCash - ledger.grandTotal;

  const receivableRows = [...receivables.receivables].sort((a, b) => {
    const statusRank = (row: ReceivableRow) =>
      row.ackReceived
        ? 3
        : row.expectedAmount > 0
          ? 0
          : row.receivedAmount
            ? 1
            : 2;

    const expectedTime = (row: ReceivableRow) =>
      row.expectedDate
        ? new Date(row.expectedDate).getTime()
        : Number.MAX_SAFE_INTEGER;

    return (
      statusRank(a) - statusRank(b) ||
      expectedTime(a) - expectedTime(b) ||
      b.totalAmount - a.totalAmount ||
      a.partyName.localeCompare(b.partyName, "en-IN", { sensitivity: "base" })
    );
  });
  const receivableMidpoint = Math.ceil(receivableRows.length / 2);
  const receivableColumns = [
    receivableRows.slice(0, receivableMidpoint),
    receivableRows.slice(receivableMidpoint),
  ].filter((rows) => rows.length > 0);

  return (
    <ReportFrame>
      <ReportHeader
        title="Cash Planning Ledger and Receivables Report"
        day={day}
        reportDate={reportDate}
      />

      <FullMetrics
        day={day}
        ledger={ledger}
        receivables={receivables}
        expectedDueByReportDate={expectedDueByReportDate}
        projectedCash={projectedCash}
        netAfterCreditors={netAfterCreditors}
      />

      <PaymentQueueSection day={day} />

        <Section
          title="Ledger Summary"
          aside={`${creditorCount} creditors across ${creditorGroups.length} categories`}
        >
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Metric label="Grand total" value={money(ledger.grandTotal)} />
            <Metric
              label="Largest category"
              value={largestCategory ? labelOf(largestCategory.category) : "-"}
              sub={
                largestCategory ? money(largestCategory.subtotal) : undefined
              }
            />
            <Metric
              label="Average per creditor"
              value={
                creditorCount
                  ? money(Math.round(ledger.grandTotal / creditorCount))
                  : "-"
              }
            />
          </div>

          {creditorGroups.length === 0 ? (
            <p className="mt-3 rounded border border-dashed py-5 text-center text-xs text-muted-foreground">
              No creditor ledger entries.
            </p>
          ) : (
            <div className="cash-report-ledger-columns mt-2">
              {creditorGroups.map((group) => (
                <CreditorGroupTable key={group.category} group={group} />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Receivables"
          aside={`${openReceivables.length} open, ${settledReceivables} settled`}
          className="cash-report-page-start"
        >
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Metric label="Open receivables" value={openReceivables.length} />
            <Metric
              label="Pending amount"
              value={money(receivables.totalPending)}
            />
            <Metric
              label="Next expected"
              value={money(receivables.totalExpected)}
            />
            <Metric label="Already received" value={money(receivedTotal)} />
          </div>

          {receivableRows.length === 0 ? (
            <p className="mt-3 rounded border border-dashed py-5 text-center text-xs text-muted-foreground">
              No receivables recorded.
            </p>
          ) : (
            <div className="cash-report-receivable-grid mt-3">
              {receivableColumns.map((rows, index) => (
                <ReceivableTable key={index} rows={rows} />
              ))}
            </div>
          )}
        </Section>

        <footer className="mt-6 flex items-center justify-between border-t border-foreground/15 pt-2 text-[10px] text-muted-foreground">
          <span>Generated from Cash Planning</span>
          <span>System-generated report</span>
        </footer>
    </ReportFrame>
  );
}

export function CashPlanningQueueA4Report({ day, reportDate }: BaseReportProps) {
  return (
    <ReportFrame>
      <ReportHeader
        title="Cash Planning Payment Queue Report"
        day={day}
        reportDate={reportDate}
      />
      <QueueOnlyMetrics day={day} />
      <PaymentQueueSection day={day} />
      <footer className="mt-6 flex items-center justify-between border-t border-foreground/15 pt-2 text-[10px] text-muted-foreground">
        <span>Generated from Cash Planning</span>
        <span>System-generated queue report</span>
      </footer>
    </ReportFrame>
  );
}
