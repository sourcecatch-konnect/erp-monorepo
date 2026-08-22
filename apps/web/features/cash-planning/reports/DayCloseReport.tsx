"use client";

import * as React from "react";

import type { CashPlanDayView } from "@skerp/types";

const labelOf = (v: string) =>
  v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Exact INR, dropping the decimals for whole-rupee amounts (cleaner on paper). */
const money = (paise: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);

/** Print rules: only the report prints, at A5. */
const printCss = `
@media print {
  @page { size: A5 portrait; margin: 12mm; }
  html, body {
    height: auto !important;
    overflow: visible !important;
  }
  body * { visibility: hidden !important; }
  #day-close-report, #day-close-report * { visibility: visible !important; }
  #day-close-report {
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    overflow: visible !important;
    box-shadow: none !important;
  }
  #day-close-report .day-close-row {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;

function Row({
  label,
  segment,
  amount,
}: {
  label: string;
  segment?: string | null;
  amount: number;
}) {
  return (
    <div className="day-close-row flex items-center justify-between gap-2 py-1 text-sm">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{label}</span>
        {segment ? (
          <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium uppercase text-muted-foreground">
            {segment}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 tabular-nums">{money(amount)}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="border-t border-foreground/10">{children}</div>
    </div>
  );
}

/** A5 day-close sheet for stakeholders. Print-only via the embedded styles. */
export function DayCloseReport({ day }: { day: CashPlanDayView }) {
  const approved = day.payments.filter((p) => p.status === "APPROVED");
  const accountNameById = new Map(
    day.balances.map((b) => [b.accountId, b.account.name]),
  );
  const dateLabel = new Date(day.date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <div
        id="day-close-report"
        className="mx-auto w-[148mm] max-w-full bg-white px-[12mm] py-[10mm] text-foreground shadow-sm print:w-full print:p-0 print:shadow-none"
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-foreground/15 pb-3">
          <div>
            <p className="text-base font-semibold tracking-tight">
              SK Translines
            </p>
            <p className="text-xs text-muted-foreground">
              Cash Planning — Day Close Report
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{dateLabel}</p>
            <p className="text-xs text-muted-foreground">
              {day.status === "CLOSED" ? "Closed" : "Open · draft"}
            </p>
          </div>
        </div>

        {/* opening balances */}
        <Section title="Opening Balances">
          {day.balances.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No accounts.</p>
          ) : (
            day.balances.map((b) => (
              <Row
                key={b.accountId}
                label={b.account.name}
                amount={b.openingBalance}
              />
            ))
          )}
          <div className="mt-1 flex items-center justify-between border-t border-foreground/15 pt-1.5 text-sm font-semibold">
            <span>Total Opening</span>
            <span className="tabular-nums">{money(day.totalOpening)}</span>
          </div>
        </Section>

        {/* payments */}
        <Section title="Payments (Approved)">
          {approved.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No approved payments.
            </p>
          ) : (
            approved.map((p) => (
              <Row
                key={p.id}
                label={p.payeeName}
                segment={p.segment ? labelOf(p.segment) : null}
                amount={p.amount}
              />
            ))
          )}
          <div className="mt-1 flex items-center justify-between border-t border-foreground/15 pt-1.5 text-sm font-semibold">
            <span>Total Payments</span>
            <span className="tabular-nums">{money(day.approvedTotal)}</span>
          </div>
        </Section>

        {/* adjustments (add-funds / receipt credits / corrections) */}
        {day.adjustments.length > 0 ? (
          <Section title="Adjustments">
            {day.adjustments.map((a) => (
              <Row
                key={a.id}
                label={`${accountNameById.get(a.accountId) ?? "Account"} — ${a.reason}`}
                amount={a.amountPaise}
              />
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-foreground/15 pt-1.5 text-sm font-semibold">
              <span>Total Adjustments</span>
              <span className="tabular-nums">{money(day.totalAdjustments)}</span>
            </div>
          </Section>
        ) : null}

        {/* closing */}
        <Section title="Closing">
          <div className="flex items-center justify-between py-1 text-sm">
            <span>Total Opening</span>
            <span className="tabular-nums">{money(day.totalOpening)}</span>
          </div>
          {day.totalAdjustments !== 0 ? (
            <div className="flex items-center justify-between py-1 text-sm">
              <span>{day.totalAdjustments >= 0 ? "Add: Adjustments" : "Less: Adjustments"}</span>
              <span className="tabular-nums">
                {day.totalAdjustments >= 0 ? "+" : "−"}
                {money(Math.abs(day.totalAdjustments))}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between py-1 text-sm">
            <span>Less: Payments</span>
            <span className="tabular-nums">−{money(day.approvedTotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-foreground/15 pt-1.5 text-base font-semibold">
            <span>Closing / Available Cash</span>
            <span className="tabular-nums">{money(day.availableCash)}</span>
          </div>
        </Section>

        {/* footer */}
        <div className="mt-6 flex items-center justify-between border-t border-foreground/15 pt-2 text-[10px] text-muted-foreground">
          <span>Generated {generatedOn}</span>
          <span>System-generated · SK ERP</span>
        </div>
      </div>

      <style>{printCss}</style>
    </>
  );
}
