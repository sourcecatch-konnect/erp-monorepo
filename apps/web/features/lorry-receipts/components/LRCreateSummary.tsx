"use client";

import * as React from "react";
import { useWatch, useFormContext } from "react-hook-form";
import {
  IconFileText,
  IconRoute,
  IconUsers,
  IconTruck,
  IconPackage,
  IconArrowRight,
  IconAlertTriangle,
  IconReceipt2,
} from "@tabler/icons-react";

import { Skeleton } from "@skerp/ui/components/skeleton";

import { formatPaise } from "@/lib/money";
import type { LROrderContext } from "../lorry-receipt.service";

type Option = { value: string; label: string; hint?: string };

type Props = {
  source: "FROM_ORDER" | "INSTANT";
  order: LROrderContext | undefined;
  orderLoading: boolean;
  customerOptions: Option[];
  branchOptions: Option[];
  tripOptions: Option[];
  locationOptions: Option[];
};

const labelOf = (opts: Option[], value?: string | null) =>
  value ? (opts.find((o) => o.value === value)?.label ?? null) : null;

const DASH = <span className="text-muted-foreground/60">—</span>;

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="text-muted-foreground/80">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

function Pair({
  from,
  to,
}: {
  from: React.ReactNode;
  to: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="truncate">{from ?? DASH}</span>
      <IconArrowRight size={13} className="shrink-0 text-muted-foreground" />
      <span className="truncate">{to ?? DASH}</span>
    </span>
  );
}

export default function LRCreateSummary({
  source,
  order,
  orderLoading,
  customerOptions,
  branchOptions,
  tripOptions,
  locationOptions,
}: Props) {
  const { control } = useFormContext();

  const [
    truckIndex,
    transportType,
    priority,
    isMarketVehicle,
    marketVehicleNumber,
    marketDriverName,
    primaryTripId,
    consignorId,
    consigneeId,
    originBranchId,
    destinationBranchId,
    lrs,
  ] = useWatch({
    control,
    name: [
      "truckIndex",
      "transportType",
      "priority",
      "isMarketVehicle",
      "marketVehicleNumber",
      "marketDriverName",
      "primaryTripId",
      "consignorId",
      "consigneeId",
      "originBranchId",
      "destinationBranchId",
      "lrs",
    ],
  });

  const selectedTruck = Number(truckIndex) || null;

  // FROM_ORDER: the lines that will become LRs for the chosen truck.
  const truckLines = React.useMemo(
    () =>
      source === "FROM_ORDER" && order && selectedTruck != null
        ? order.lines.filter((l) => l.truckIndex === selectedTruck)
        : [],
    [source, order, selectedTruck],
  );

  const instantLines = (Array.isArray(lrs) ? lrs : []) as {
    loadingLocationId?: string;
    unloadingLocationId?: string;
    goods?: { name?: string; quantity?: number; unit?: string }[];
  }[];

  const lrCount =
    source === "FROM_ORDER" ? truckLines.length : instantLines.length;

  const tripLabel = labelOf(tripOptions, primaryTripId);
  const transportLabel =
    transportType === "RoadAndRail" ? "Road & Rail" : "Road";

  const VehicleRows = (
    <>
      {isMarketVehicle ? (
        <>
          <Row label="Market vehicle">{marketVehicleNumber || DASH}</Row>
          <Row label="Driver">{marketDriverName || DASH}</Row>
        </>
      ) : (
        <Row label="Trip">{tripLabel ?? DASH}</Row>
      )}
    </>
  );

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <p className="text-sm font-semibold">Summary</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lrCount > 0
              ? `This will generate ${lrCount} lorry receipt${lrCount === 1 ? "" : "s"} in one group.`
              : "Configure the group to see what will be created."}
          </p>
        </div>

        {source === "FROM_ORDER" && orderLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {source === "FROM_ORDER" && order && (
              <>
                <Section icon={<IconFileText size={14} />} title="Order">
                  <Row label="Order">{order.orderNumber}</Row>
                  {order.status && <Row label="Status">{order.status}</Row>}
                </Section>

                <Section icon={<IconRoute size={14} />} title="Route">
                  <Row label="Branches">
                    <Pair
                      from={order.fromBranch?.shortCode}
                      to={order.toBranch?.shortCode}
                    />
                  </Row>
                  {order.route &&
                    (order.route.source || order.route.destination) && (
                      <Row label="Cities">
                        <Pair
                          from={order.route.source}
                          to={order.route.destination}
                        />
                      </Row>
                    )}
                  <Row label="Mode">{transportLabel}</Row>
                </Section>

                <Section icon={<IconUsers size={14} />} title="Parties">
                  <Row label="Consignor → Consignee">
                    <Pair from={order.consignor} to={order.consignee} />
                  </Row>
                  {!order.consignee && (
                    <p className="flex items-center gap-1 text-xs text-amber-600">
                      <IconAlertTriangle size={13} />
                      Set the order's consignee before creating the group.
                    </p>
                  )}
                </Section>

                <Section icon={<IconTruck size={14} />} title="This truck">
                  <Row label="Truck">
                    {selectedTruck != null ? (
                      <>
                        #{selectedTruck}
                        {order.truckQuantity ? (
                          <span className="text-muted-foreground">
                            {" "}
                            of {order.truckQuantity}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      DASH
                    )}
                  </Row>
                  <Row label="Generates">
                    {lrCount > 0 ? (
                      `${lrCount} LR${lrCount === 1 ? "" : "s"}`
                    ) : (
                      <span className="text-amber-600">No lines</span>
                    )}
                  </Row>
                </Section>
              </>
            )}

            {source === "INSTANT" && (
              <>
                <Section icon={<IconUsers size={14} />} title="Parties">
                  <Row label="Consignor → Consignee">
                    <Pair
                      from={labelOf(customerOptions, consignorId)}
                      to={labelOf(customerOptions, consigneeId)}
                    />
                  </Row>
                </Section>
                <Section icon={<IconRoute size={14} />} title="Route">
                  <Row label="Branches">
                    <Pair
                      from={labelOf(branchOptions, originBranchId)}
                      to={labelOf(branchOptions, destinationBranchId)}
                    />
                  </Row>
                  <Row label="Mode">Road</Row>
                </Section>
              </>
            )}

            {/* Consignment lines — the core "what will be created" detail. */}
            <Section
              icon={<IconPackage size={14} />}
              title={`Consignments (${lrCount} LR${lrCount === 1 ? "" : "s"})`}
            >
              {lrCount === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No consignment lines yet.
                </p>
              ) : (
                <ol className="space-y-2">
                  {source === "FROM_ORDER"
                    ? truckLines.map((l, i) => (
                        <SummaryLine
                          key={i}
                          index={i}
                          loading={l.loadingLocation}
                          unloading={l.unloadingLocation}
                          goods={l.goods
                            .map((g) =>
                              [g.name, g.quantity && g.unit ? `${g.quantity} ${g.unit}` : null]
                                .filter(Boolean)
                                .join(" · "),
                            )
                            .filter(Boolean)}
                        />
                      ))
                    : instantLines.map((l, i) => (
                        <SummaryLine
                          key={i}
                          index={i}
                          loading={labelOf(locationOptions, l.loadingLocationId)}
                          unloading={labelOf(
                            locationOptions,
                            l.unloadingLocationId,
                          )}
                          goods={(l.goods ?? [])
                            .map((g) =>
                              [g.name, g.quantity && g.unit ? `${g.quantity} ${g.unit}` : null]
                                .filter(Boolean)
                                .join(" · "),
                            )
                            .filter(Boolean)}
                        />
                      ))}
                </ol>
              )}
            </Section>

            <Section icon={<IconTruck size={14} />} title="Vehicle">
              {VehicleRows}
            </Section>

            <Section icon={<IconReceipt2 size={14} />} title="Freight & priority">
              {source === "FROM_ORDER" && (
                <Row label="Booking freight">
                  {order?.bookingFreightAmount != null
                    ? formatPaise(order.bookingFreightAmount)
                    : DASH}
                </Row>
              )}
              <Row label="Priority">{priority || "Normal"}</Row>
              {source === "FROM_ORDER" && order?.bookingFreightAmount != null && (
                <p className="text-xs text-muted-foreground">
                  Defaults the group's base freight at finalise.
                </p>
              )}
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}

function SummaryLine({
  index,
  loading,
  unloading,
  goods,
}: {
  index: number;
  loading: string | null;
  unloading: string | null;
  goods: string[];
}) {
  return (
    <li className="rounded-md border bg-background p-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
          LR {index + 1}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-xs">
          <span className="truncate">{loading ?? DASH}</span>
          <IconArrowRight size={12} className="shrink-0 text-muted-foreground" />
          <span className="truncate">{unloading ?? DASH}</span>
        </span>
      </div>
      {goods.length > 0 && (
        <p className="mt-1.5 truncate text-xs text-muted-foreground">
          {goods.join("  •  ")}
        </p>
      )}
    </li>
  );
}
