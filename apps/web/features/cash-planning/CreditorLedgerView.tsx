"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconReceipt,
  IconCoins,
  IconUsers,
  IconCategory,
  IconChartBar,
  IconSearch,
} from "@tabler/icons-react";

import { Skeleton } from "@skerp/ui/components/skeleton";
import { Input } from "@skerp/ui/components/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@skerp/ui/components/accordion";
import { TooltipProvider } from "@skerp/ui/components/tooltip";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";
import { CompactMoney } from "./CompactMoney";
import { StatCard } from "./StatCard";

const labelOf = (v: string) =>
  v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function CreditorLedgerView() {
  const ledger = useQuery({
    queryKey: cashPlanningKeys.ledger(),
    queryFn: () => cashPlanningApi.ledger(),
  });

  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState<string[]>([]);

  if (ledger.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-md" />
          ))}
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-72 w-full rounded-md" />
      </div>
    );
  }

  const data = ledger.data;
  if (!data || data.groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <IconReceipt size={24} />
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium">No outstanding balances</p>
          <p className="text-xs text-muted-foreground">
            Add creditors with an outstanding amount in the Creditors master.
          </p>
        </div>
      </div>
    );
  }

  const creditorCount = data.groups.reduce((s, g) => s + g.creditors.length, 0);
  const largest = data.groups.reduce((m, g) => (g.subtotal > m.subtotal ? g : m));

  // Filter by search, sort each category biggest-first, drop empty categories.
  const q = search.trim().toLowerCase();
  const groups = data.groups
    .map((g) => {
      const creditors = [...g.creditors]
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
      return {
        category: g.category,
        creditors,
        subtotal: creditors.reduce((s, c) => s + c.outstandingBalance, 0),
      };
    })
    .filter((g) => g.creditors.length > 0);

  // While searching, force every matching category open.
  const openValue = q ? groups.map((g) => g.category) : open;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<IconCoins size={15} />}
            label="Total Outstanding"
            value={data.grandTotal}
          />
          <StatCard
            icon={<IconUsers size={15} />}
            label="Creditors"
            display={creditorCount}
          />
          <StatCard
            icon={<IconCategory size={15} />}
            label="Categories"
            display={data.groups.length}
          />
          <StatCard
            icon={<IconChartBar size={15} />}
            label="Largest Category"
            value={largest.subtotal}
            sub={labelOf(largest.category)}
          />
        </div>

        <div className="relative">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-9 pl-9"
            placeholder="Search creditors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {groups.length === 0 ? (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            No creditors match “{search}”.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <Accordion type="multiple" value={openValue} onValueChange={setOpen}>
              {groups.map((g) => {
                const share =
                  data.grandTotal > 0
                    ? Math.round((g.subtotal / data.grandTotal) * 100)
                    : 0;
                return (
                  <AccordionItem
                    key={g.category}
                    value={g.category}
                    className="px-4"
                  >
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {labelOf(g.category)}
                          </span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {g.creditors.length}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="hidden items-center gap-2 sm:flex">
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <span
                                className="block h-full rounded-full bg-primary"
                                style={{ width: `${share}%` }}
                              />
                            </span>
                            <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
                              {share}%
                            </span>
                          </span>
                          <CompactMoney
                            className="text-sm font-semibold"
                            value={g.subtotal}
                          />
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="divide-y divide-border/60">
                        {g.creditors.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 py-1.5"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate text-sm">{c.name}</span>
                            </span>
                            <CompactMoney
                              className="shrink-0 text-sm"
                              value={c.outstandingBalance}
                            />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
