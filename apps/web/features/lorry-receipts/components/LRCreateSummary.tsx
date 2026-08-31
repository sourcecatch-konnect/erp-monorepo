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
    <div className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>

      <div className="min-w-0 font-medium text-foreground">{children}</div>
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
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="w-full whitespace-normal break-words leading-5 [overflow-wrap:anywhere]">
        {from ?? DASH}
      </span>

      <IconArrowRight
        size={13}
        className="ml-1 rotate-90 text-muted-foreground"
      />

      <span className="w-full whitespace-normal break-words leading-5 [overflow-wrap:anywhere]">
        {to ?? DASH}
      </span>
    </div>
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

  // Both sources declare their lines in the live form now — this is what
  // will actually become LRs, for either FROM_ORDER or INSTANT.
  const currentLines = (Array.isArray(lrs) ? lrs : []) as {
    loadingLocationId?: string;
    unloadingLocationId?: string;
    totalWeight?: number;
    totalWeightUnit?: string;
    goods?: {
      name?: string;
      quantity?: number;
      unit?: string;
    }[];
  }[];

  const lrCount = currentLines.length;

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
            {lrCount === 1
              ? "This will create 1 lorry receipt."
              : lrCount > 1
                ? `This will create ${lrCount} LRs travelling together on one truck.`
                : "Add consignment details to see what will be created."}
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
                      from={
                        order.fromBranch?.name ??
                        order.fromBranch?.branchCode ??
                        "—"
                      }
                      to={
                        order.toBranch?.name ??
                        order.toBranch?.branchCode ??
                        "—"
                      }
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
                  <div className="space-y-2">
                    <p className="whitespace-normal break-words text-sm font-semibold leading-5 text-foreground">
                      <span className="font-normal text-muted-foreground">
                        Consignor:{" "}
                      </span>
                      {order.consignor || "Not selected"}
                    </p>

                    <p className="whitespace-normal break-words text-sm font-semibold leading-5 text-foreground">
                      <span className="font-normal text-muted-foreground">
                        Consignee:{" "}
                      </span>
                      {order.consignee || "Not selected"}
                    </p>

                    {(!order.consignor || !order.consignee) && (
                      <p className="flex items-start gap-1.5 text-xs leading-snug text-amber-600">
                        <IconAlertTriangle
                          size={13}
                          className="mt-0.5 shrink-0"
                        />

                        <span>
                          Set the order&apos;s consignor and consignee before creating the LR.
                        </span>
                      </p>
                    )}
                  </div>
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
                <div className="py-2 text-center">
                  <IconPackage className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground" />

                  <p className="text-xs text-muted-foreground">
                    No consignment lines yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {currentLines.map((line, i) => {
                    const loading = labelOf(
                      locationOptions,
                      line.loadingLocationId,
                    );

                    const unloading = labelOf(
                      locationOptions,
                      line.unloadingLocationId,
                    );

                    const goods = (line.goods ?? [])
                      .map((g) =>
                        [
                          g.name,
                          g.quantity && g.unit
                            ? `${g.quantity} ${g.unit}`
                            : g.quantity
                              ? String(g.quantity)
                              : null,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      )
                      .filter(Boolean);

                    return (
                      <div
                        key={i}
                        className="py-3 first:pt-0 last:pb-0"
                      >
                        <p className="mb-2 text-sm font-semibold text-foreground">
                          LR {i + 1}
                        </p>

                        <div className="space-y-1.5 text-xs">
                          <p className="whitespace-normal break-words">
                            <span className="text-muted-foreground">
                              Loading point:{" "}
                            </span>

                            <span className="font-medium text-foreground">
                              {loading || "Not selected"}
                            </span>
                          </p>

                          <p className="whitespace-normal break-words">
                            <span className="text-muted-foreground">
                              Unloading point:{" "}
                            </span>

                            <span className="font-medium text-foreground">
                              {unloading || "Not selected"}
                            </span>
                          </p>

                          <p>
                            <span className="text-muted-foreground">
                              Total weight:{" "}
                            </span>

                            <span className="font-medium text-foreground">
                              {line.totalWeight
                                ? `${line.totalWeight} ${line.totalWeightUnit || ""
                                }`
                                : "Not entered"}
                            </span>
                          </p>

                          <div>
                            <span className="text-muted-foreground">
                              Goods:{" "}
                            </span>

                            {goods.length ? (
                              <div className="mt-1 space-y-0.5">
                                {goods.map((item, goodsIndex) => (
                                  <p
                                    key={goodsIndex}
                                    className="whitespace-normal break-words font-medium text-foreground"
                                  >
                                    {item}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <span className="font-medium text-foreground">
                                No goods added
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
            <Section icon={<IconTruck size={14} />} title="Vehicle">
              {VehicleRows}
            </Section>

            <Section
              icon={<IconReceipt2 size={14} />}
              title="Freight & priority"
            >
              {source === "FROM_ORDER" && (
                <Row label="Booking freight">
                  {order?.bookingFreightAmount != null
                    ? formatPaise(order.bookingFreightAmount)
                    : DASH}
                </Row>
              )}
              <Row label="Priority">{priority || "Normal"}</Row>
              {source === "FROM_ORDER" &&
                order?.bookingFreightAmount != null && (
                  <p className="text-xs text-muted-foreground">
                    Defaults the truck&apos;s base freight at finalise.
                  </p>
                )}
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}

function ConsignmentCard({
  index,
  loading,
  unloading,
  totalWeight,
  goods,
}: {
  index: number;
  loading?: string | null;
  unloading?: string | null;
  totalWeight?: number | null;
  goods: string[];
}) {
  return (
    <div className="max-w-full rounded-lg border bg-background p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          Consignment Line {index + 1}
        </p>

        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          LR {index + 1}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="rounded-md bg-muted/30 p-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
            Route
          </p>

          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <span className="min-w-0 break-words line-clamp-2 font-medium">
              {loading || "Loading not selected"}
            </span>

            <span className="shrink-0 text-muted-foreground">→</span>

            <span className="min-w-0 break-words line-clamp-2 font-medium">
              {unloading || "Unloading not selected"}
            </span>
          </div>
        </div>

        <div className="rounded-md border p-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
            Total weight
          </p>
          <p className="text-xs font-medium">
            {totalWeight != null ? totalWeight.toLocaleString() : "Not set"}
          </p>
        </div>

        <div className="rounded-md border p-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
            Goods
          </p>

          {goods.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {goods.map((item, idx) => (
                <span
                  key={idx}
                  className="max-w-[220px] rounded-md bg-muted px-2 py-1 text-[11px] font-medium leading-snug break-words line-clamp-2"
                  title={item}
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No goods added</p>
          )}
        </div>
      </div>
    </div>
  );
}
