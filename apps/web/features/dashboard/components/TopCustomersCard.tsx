"use client";

import { IconChartBar } from "@tabler/icons-react";
import type { DashboardCustomerRow } from "@skerp/types";
import { WidgetCard, WidgetEmpty } from "./WidgetCard";
import { count, exactMoney, shortMoney } from "./format";
import { DASHBOARD_ROUTES } from "../routes";

/**
 * Top customers by revenue, grouped on the service customer — who the freight
 * was hauled for, which is not always who pays the bill. Two columns at wide
 * sizes so ten rows fit without the card running tall.
 */
export function TopCustomersCard({
  rows,
  periodLabel,
  className,
}: {
  rows: DashboardCustomerRow[];
  periodLabel: string;
  className?: string;
}) {
  const top = rows[0]?.amountPaise ?? 0;

  return (
    <WidgetCard
      title="Top customers"
      icon={IconChartBar}
      meta={periodLabel}
      href={DASHBOARD_ROUTES.customers}
      className={className}
      bodyClassName="flex flex-col"
    >
      {rows.length === 0 ? (
        <WidgetEmpty>No revenue booked in this period.</WidgetEmpty>
      ) : (
        <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map((row) => (
            <li
              key={row.customerId}
              className="grid grid-cols-[1fr_4rem] items-center gap-3"
            >
              <div className="min-w-0">
                <p
                  className="truncate text-sm text-foreground"
                  title={row.name}
                >
                  {row.name}
                </p>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{
                      width: `${top > 0 ? (row.amountPaise / top) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <span
                className="text-right text-sm font-medium tabular-nums text-foreground"
                title={`${exactMoney(row.amountPaise)} · ${count(row.billCount)} ${
                  row.billCount === 1 ? "bill" : "bills"
                }`}
              >
                {shortMoney(row.amountPaise)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </WidgetCard>
  );
}
