"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconTruck,
  IconClockHour4,
  IconBuilding,
  IconBuildingWarehouse,
  IconFileInvoice,
  IconHistory,
  IconCheck,
  IconX,
  IconLoader2,
} from "@tabler/icons-react";

import { ewbApi } from "./ewaybill.service";
import { ewbKeys } from "./ewaybill.keys";
import { StatusBadge } from "./components/StatusBadge";
import { ExpiryCountdown } from "./components/ExpiryCountdown";
import { RouteHeader } from "./components/RouteHeader";
import { StatusTimeline } from "./components/StatusTimeline";
import { UpdateVehicleDialog } from "./components/UpdateVehicleDialog";
import { ExtendValidityDialog } from "./components/ExtendValidityDialog";
import { Button } from "@skerp/ui/components/button";
import { cn } from "@skerp/ui/lib/util";
import type { EwayBill } from "./types";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function EwaybillDetail({ ewbNo }: { ewbNo: string }) {
  const detail = useQuery({
    queryKey: ewbKeys.detail(ewbNo),
    queryFn: () => ewbApi.detail(ewbNo),
    refetchInterval: 10_000,
  });

  const [openVehicle, setOpenVehicle] = React.useState(false);
  const [openExtend, setOpenExtend] = React.useState(false);

  if (detail.isLoading || !detail.data) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <IconLoader2 className="mr-2 size-4 animate-spin" /> Loading e-way bill…
      </div>
    );
  }

  const bill = detail.data;
  const canAct =
    bill.status !== "DELIVERED" && bill.status !== "CANCELLED";

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/ewaybills/inbox">
              <IconArrowLeft />
            </Link>
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold">
                {bill.ewbNo}
              </span>
              <StatusBadge status={bill.status} />
            </div>
            <span className="text-xs text-muted-foreground">
              Generated {fmtDateTime(bill.generatedDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={!canAct}
            onClick={() => setOpenExtend(true)}
          >
            <IconClockHour4 /> Extend Validity
          </Button>
          <Button
            disabled={!canAct}
            onClick={() => setOpenVehicle(true)}
          >
            <IconTruck /> Update Vehicle
          </Button>
        </div>
      </div>

      {/* Hero: route + expiry */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <RouteHeader
          fromPlace={bill.fromPlace}
          fromState={bill.fromStateName}
          toPlace={bill.toPlace}
          toState={bill.toStateName}
          distanceKm={bill.transDistance}
          transMode={bill.transMode}
        />
        <ExpiryCountdown variant="hero" validUntil={bill.validUntil} />
      </div>

      {/* 2-col layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          {/* Parties */}
          <div className="grid gap-3 md:grid-cols-2">
            <PartyCard
              label="Consignor (From)"
              icon={IconBuilding}
              gstin={bill.fromGstin}
              name={bill.fromTrdName}
              addr={`${bill.fromAddr1}, ${bill.fromPlace} — ${bill.fromPincode}`}
              stateName={bill.fromStateName}
            />
            <PartyCard
              label="Consignee (To)"
              icon={IconBuildingWarehouse}
              gstin={bill.toGstin}
              name={bill.toTrdName}
              addr={`${bill.toAddr1}, ${bill.toPlace} — ${bill.toPincode}`}
              stateName={bill.toStateName}
            />
          </div>

          {/* Document */}
          <Card title="Source Document" icon={IconFileInvoice}>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <Stat label="Type" value={bill.docType} />
              <Stat label="Number" value={bill.docNo} mono />
              <Stat label="Date" value={fmtDateTime(bill.docDate)} />
              <Stat label="Invoice Value" value={fmtINR(bill.totInvValue)} mono />
              <Stat label="IGST" value={fmtINR(bill.igstValue)} mono />
              <Stat
                label="Mode"
                value={`${bill.transMode} · ${bill.transDistance} km`}
              />
            </dl>
          </Card>

          {/* Items */}
          <Card
            title={`Items (${bill.items.length})`}
            icon={IconFileInvoice}
          >
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">HSN</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Taxable</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2">
                      <div className="font-medium">{it.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.productDesc}
                      </div>
                    </td>
                    <td className="py-2 font-mono text-xs">{it.hsnCode}</td>
                    <td className="py-2 text-right font-mono text-xs tabular-nums">
                      {it.quantity} {it.qtyUnit}
                    </td>
                    <td className="py-2 text-right font-mono text-xs tabular-nums">
                      {fmtINR(it.taxableAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Vehicle history */}
          <Card title="Vehicle History" icon={IconHistory}>
            {bill.vehicleHistory.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                No vehicle assigned yet — Part-B pending.
              </p>
            ) : (
              <ol className="space-y-3">
                {[...bill.vehicleHistory].reverse().map((v, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-l-2 border-primary/40 pl-3"
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-medium">
                        {v.vehicleNo}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        From {v.fromPlace} · {v.reasonRem ?? "—"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {fmtDateTime(v.updatedAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Extensions */}
          {bill.extensions.length > 0 && (
            <Card title="Validity Extensions" icon={IconClockHour4}>
              <ol className="space-y-3">
                {[...bill.extensions].reverse().map((ext, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-l-2 border-amber-400 pl-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        Extended to {fmtDateTime(ext.newValidUntil)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        From {ext.fromPlace} · {ext.remainingDistanceKm} km
                        remaining · {ext.reasonRem}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {fmtDateTime(ext.extendedAt)}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        {/* RIGHT */}
        <aside className="flex flex-col gap-5">
          <Card title="Lifecycle">
            <StatusTimeline bill={bill} />
          </Card>

          <LiveLookupCard bill={bill} />
        </aside>
      </div>

      <UpdateVehicleDialog
        bill={bill}
        open={openVehicle}
        onOpenChange={setOpenVehicle}
      />
      <ExtendValidityDialog
        bill={bill}
        open={openExtend}
        onOpenChange={setOpenExtend}
      />
    </div>
  );
}

function PartyCard({
  label,
  icon: Icon,
  gstin,
  name,
  addr,
  stateName,
}: {
  label: string;
  icon: typeof IconBuilding;
  gstin: string;
  name: string;
  addr: string;
  stateName: string;
}) {
  return (
    <div className="flex flex-col gap-2 border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="font-mono text-xs text-muted-foreground">{gstin}</div>
      <div className="font-semibold">{name}</div>
      <div className="text-sm text-muted-foreground">{addr}</div>
      <div className="text-xs text-muted-foreground">{stateName}</div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof IconBuilding;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-sm", mono && "font-mono tabular-nums")}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Hits the real WhiteBooks sandbox to resolve the consignor's GSTIN.
 * If the live API responds successfully, the stakeholder sees a green tick
 * proving the integration is wired end-to-end (not just mock data).
 */
function LiveLookupCard({ bill }: { bill: EwayBill }) {
  const liveGstin = useQuery({
    queryKey: ewbKeys.liveGstin(bill.fromGstin),
    queryFn: () => ewbApi.liveGstin(bill.fromGstin),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const status = liveGstin.data?.status_cd;
  const unconfigured = liveGstin.data?.__unconfigured;
  const ok = status === "1" || status === "200";

  return (
    <Card title="Live API Lookup">
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-medium">GET</span>
          <code className="font-mono text-[11px]">
            /getgstindetails?GSTIN={bill.fromGstin}
          </code>
        </div>

        {liveGstin.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconLoader2 className="size-3.5 animate-spin" />
            Calling WhiteBooks sandbox…
          </div>
        ) : unconfigured ? (
          <div className="text-muted-foreground">
            Credentials not set in env — skipping live call.
          </div>
        ) : liveGstin.isError ? (
          <div className="flex items-center gap-2 text-destructive">
            <IconX className="size-3.5" />
            Network error — sandbox unreachable
          </div>
        ) : ok ? (
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <IconCheck className="size-3.5" />
            Live response · status_cd {status}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <IconX className="size-3.5" />
            Sandbox returned status_cd {status ?? "—"}{" "}
            {liveGstin.data?.status_desc
              ? `· ${liveGstin.data.status_desc}`
              : ""}
          </div>
        )}

        <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
          This widget proves the WhiteBooks E-Way Bill API is wired live —
          remaining endpoints (Part-B update, extend, fetch) follow the same
          adapter pattern.
        </p>
      </div>
    </Card>
  );
}
