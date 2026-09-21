import * as React from "react";
import Link from "next/link";
import type {
  Trip,
  TripLR,
  TripLRGroup,
  TripStatusHistoryRow,
  TripUnloadingPointRow,
} from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Button } from "@skerp/ui/components/button";
import {
  IconAlertTriangle,
  IconBan,
  IconBuildingWarehouse,
  IconCheck,
  IconFileText,
  IconId,
  IconPackage,
  IconPhone,
  IconPlus,
  IconTrain,
  IconTruck,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/format";
import { lrGroupDisplay } from "@/features/lorry-receipts";
import { timeAgo, TripStatusBadge } from "./trip-ui";

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

/** Flat detail card — 1px border, no shadow, per the design system. */
export function DetailCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            {Icon ? <Icon size={15} className="text-muted-foreground" /> : null}
            {title}
          </h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header: route hero                                                  */
/* ------------------------------------------------------------------ */

/** The trip's identity — origin → destination, scaled up as the page title. */
export function RouteHero({
  from,
  to,
}: {
  from: string | null | undefined;
  to: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
      <span className="size-2.5 shrink-0 rounded-full border-2 border-muted-foreground" />
      <span className="text-muted-foreground">{from ?? "?"}</span>
      <span className="w-10 shrink-0 border-t-2 border-dashed border-muted-foreground/50" />
      <span className="size-2.5 shrink-0 rounded-full bg-primary" />
      <span>{to ?? "?"}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lifecycle stepper                                                   */
/* ------------------------------------------------------------------ */

type StepState = "done" | "current" | "todo" | "cancelled";
type Step = {
  key: string;
  label: string;
  date: string | null;
  state: StepState;
  caption?: string;
};

const firstAt = (
  history: TripStatusHistoryRow[],
  status: string,
): string | null => history.find((h) => h.status === status)?.changedAt ?? null;

/**
 * Planned ── In Transit ── Closed with the actual timestamps under each
 * reached step. A cancelled trip shows only the steps it reached, then a
 * terminal Cancelled step.
 */
export function TripLifecycleStepper({ trip }: { trip: Trip }) {
  const history = trip.TripStatusHistory ?? [];
  // Prefer the operational timestamps the operator sets in the dispatch /
  // close / correction forms (and the back-dated start on an already-running
  // trip). The status-history `changedAt` — when the record flipped, which for
  // a back-filled or corrected trip isn't the real event time — is the
  // fallback only.
  const dates: Record<string, string | null> = {
    Planned: firstAt(history, "Planned") ?? trip.createdAt,
    InTransit: trip.startDateTime ?? firstAt(history, "InTransit"),
    Closed: trip.endDateTime ?? firstAt(history, "Closed"),
    Cancelled: firstAt(history, "Cancelled"),
  };
  // A trip created as "already dispatched" never had a distinct planned
  // stage — the Planned date above is really just the record's creation
  // time, which can be later than the backdated In Transit time below it.
  // Label it as such so the timeline doesn't read as an out-of-order bug.
  const plannedIsRecordCreation = !firstAt(history, "Planned");
  const labels: Record<string, string> = {
    Planned: "Planned",
    InTransit: "In Transit",
    Closed: "Closed",
    Cancelled: "Cancelled",
  };

  let steps: Step[];
  if (trip.status === "Cancelled") {
    const reached = ["Planned", ...(dates.InTransit ? ["InTransit"] : [])];
    steps = [
      ...reached.map<Step>((k) => ({
        key: k,
        label: labels[k]!,
        date: dates[k] ?? null,
        state: "done",
        caption: k === "Planned" && plannedIsRecordCreation ? "created" : undefined,
      })),
      {
        key: "Cancelled",
        label: "Cancelled",
        date: dates.Cancelled ?? null,
        state: "cancelled",
      },
    ];
  } else {
    const order = ["Planned", "InTransit", "Closed"];
    const idx = order.indexOf(trip.status);
    steps = order.map<Step>((k, i) => ({
      key: k,
      label: labels[k]!,
      date: dates[k] ?? null,
      state:
        i < idx || trip.status === "Closed"
          ? "done"
          : i === idx
            ? "current"
            : "todo",
      caption: k === "Planned" && plannedIsRecordCreation ? "created" : undefined,
    }));
  }

  return (
    <ol className="flex w-full">
      {steps.map((s, i) => (
        <li key={s.key} className="flex-1">
          <div className="flex items-center">
            <span
              className={cn(
                "h-px flex-1",
                i === 0
                  ? "bg-transparent"
                  : s.state === "todo"
                    ? "bg-border"
                    : s.state === "cancelled"
                      ? "bg-destructive/40"
                      : "bg-primary",
              )}
            />
            <StepDot state={s.state} />
            <span
              className={cn(
                "h-px flex-1",
                i === steps.length - 1
                  ? "bg-transparent"
                  : steps[i + 1]!.state === "todo"
                    ? "bg-border"
                    : steps[i + 1]!.state === "cancelled"
                      ? "bg-destructive/40"
                      : "bg-primary",
              )}
            />
          </div>
          <div className="mt-1.5 text-center">
            <div
              className={cn(
                "text-sm font-medium",
                s.state === "todo" && "text-muted-foreground",
                s.state === "cancelled" && "text-destructive",
              )}
            >
              {s.label}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.date ? formatDateTime(s.date) : "—"}
              {s.caption ? ` (${s.caption})` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <IconCheck size={12} />
      </span>
    );
  }
  if (state === "cancelled") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
        <IconX size={12} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background">
        <span className="size-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none" />
      </span>
    );
  }
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tiles                                                          */
/* ------------------------------------------------------------------ */

export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
        <Icon size={13} />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {sub ? (
        <div className="text-xs text-muted-foreground tabular-nums">{sub}</div>
      ) : null}
    </div>
  );
}

/** "2d 4h", "5h 20m", "45m" — trip duration for the stat tile. */
export function humanizeDuration(ms: number): string {
  if (ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/* ------------------------------------------------------------------ */
/* Cargo: close gate helper                                            */
/* ------------------------------------------------------------------ */

const openLR = (s: TripLR["status"]) => s === "DRAFT" || s === "FINALISED";
const openGroup = (s: TripLRGroup["status"]) =>
  s === "DRAFT" || s === "FINALISED";

/**
 * LR numbers blocking this trip from closing — the client-side mirror of the
 * server's `undeliveredLRNumbersForTrip` gate (a leg-1 group held at hub, or
 * already handed to leg 2, is exempt).
 */
export function tripBlockingLrNumbers(trip: Trip): string[] {
  const out: string[] = [];
  for (const g of trip.primaryGroups ?? []) {
    if (g.secondaryTripId || g.hubId) continue;
    if (!openGroup(g.status)) continue;
    for (const lr of g.lorryReceipts) if (openLR(lr.status)) out.push(lr.lrNumber);
  }
  for (const g of trip.secondaryGroups ?? []) {
    if (!openGroup(g.status)) continue;
    for (const lr of g.lorryReceipts) if (openLR(lr.status)) out.push(lr.lrNumber);
  }
  return out;
}

/**
 * True when an LR trip has never had any LR attached — the client-side
 * mirror of the server's TRIP_CLOSE_NO_LR gate. DC and empty trips never
 * carry an LR, so they're exempt.
 */
export function tripMissingLR(trip: Trip): boolean {
  if (trip.tripType !== "lr" || trip.isTripEmpty) return false;
  return (trip.primaryGroups?.length ?? 0) + (trip.secondaryGroups?.length ?? 0) === 0;
}

/* ------------------------------------------------------------------ */
/* Cargo: LR / group chips                                             */
/* ------------------------------------------------------------------ */

const LR_STATUS_LABELS: Record<TripLR["status"], string> = {
  DRAFT: "Draft",
  FINALISED: "Finalised",
  DELIVERED: "Delivered",
  ACKNOWLEDGED: "POD received",
  CANCELLED: "Cancelled",
};

const LR_STATUS_STYLES: Record<TripLR["status"], string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  FINALISED: "bg-primary/10 text-primary border-primary/20",
  DELIVERED:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  ACKNOWLEDGED:
    "bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-400",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

export function LRStatusChip({ status }: { status: TripLR["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-xs font-medium whitespace-nowrap",
        LR_STATUS_STYLES[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {LR_STATUS_LABELS[status]}
    </span>
  );
}

/** Neutral meta chip (leg position, seal, transport type…). */
function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/50 px-1.5 py-px text-xs font-medium text-muted-foreground whitespace-nowrap">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Cargo: LR group card                                                */
/* ------------------------------------------------------------------ */

/**
 * One attached LR group: where the goods run (branch flow incl. hub), whose
 * goods they are, and every LR with its paperwork state.
 */
export function LRGroupCard({
  group,
  leg,
}: {
  group: TripLRGroup;
  /** Whether this trip is the group's first or final leg. */
  leg: "primary" | "secondary";
}) {
  const heldAtHub =
    leg === "primary" && group.hubId !== null && group.secondaryTripId === null;
  const handedOver = leg === "primary" && group.secondaryTripId !== null;
  const display = lrGroupDisplay(group);

  return (
    <DetailCard
      title={display.isSingleton ? "Cargo — LR" : "Cargo — LR group"}
      icon={IconPackage}
      action={
        <div className="flex items-center gap-1.5">
          {leg === "secondary" ? <MetaChip>Leg 2 · final</MetaChip> : null}
          {handedOver ? <MetaChip>Handed to leg 2</MetaChip> : null}
          {heldAtHub ? (
            <MetaChip>
              <IconBuildingWarehouse size={11} /> Held at hub
            </MetaChip>
          ) : null}
          <LRStatusChip status={group.status} />
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/lorry-receipts/${group.id}`}
            className="font-mono text-sm font-medium text-primary hover:underline"
          >
            {display.title}
          </Link>
          {!display.isSingleton && (
            <MetaChip>{display.lrCount} LRs</MetaChip>
          )}
          <span className="text-sm text-muted-foreground">
            {group.consignor.name}
            <span className="mx-1.5 text-muted-foreground/60">→</span>
            {group.consignee.name}
          </span>
        </div>

        {/* Branch flow: origin ── (hub) ── destination */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="size-2 shrink-0 rounded-full border-[1.5px] border-muted-foreground" />
          <span className="whitespace-nowrap text-muted-foreground">
            {group.originBranch.name}
          </span>
          <span className="min-w-4 flex-1 border-t border-dashed border-muted-foreground/60" />
          {group.hub ? (
            <>
              <span
                className={cn(
                  "flex items-center gap-1 whitespace-nowrap",
                  heldAtHub ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                <IconBuildingWarehouse size={14} />
                {group.hub.name}
                {heldAtHub && group.hubArrivalAt ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    since {formatDate(group.hubArrivalAt)}
                  </span>
                ) : null}
              </span>
              <span className="min-w-4 flex-1 border-t border-dashed border-muted-foreground/60" />
            </>
          ) : null}
          <span className="size-2 shrink-0 rounded-full bg-foreground/70" />
          <span className="whitespace-nowrap font-medium">
            {group.destinationBranch.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <MetaChip>
            {group.transportType === "Road" ? (
              <IconTruck size={11} />
            ) : (
              <IconTrain size={11} />
            )}
            {group.transportType}
          </MetaChip>
          {group.priority !== "Normal" ? (
            <MetaChip>
              <IconAlertTriangle size={11} /> {group.priority}
            </MetaChip>
          ) : null}
          {group.sealNumber ? <MetaChip>Seal {group.sealNumber}</MetaChip> : null}
          {group.isMarketVehicle ? (
            <MetaChip>
              <IconTruck size={11} />
              Market{group.marketVehicleNumber ? ` · ${group.marketVehicleNumber}` : ""}
              {group.marketDriverName ? ` · ${group.marketDriverName}` : ""}
            </MetaChip>
          ) : null}
        </div>

        {/* LR rows */}
        <div className="divide-y rounded-md border">
          {group.lorryReceipts.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              No LRs yet.
            </p>
          ) : (
            group.lorryReceipts.map((lr) => <LRRow key={lr.id} lr={lr} />)
          )}
        </div>
      </div>
    </DetailCard>
  );
}

function LRRow({ lr }: { lr: TripLR }) {
  const weight =
    lr.totalWeight !== null
      ? `${Number(lr.totalWeight).toLocaleString("en-IN")} ${lr.unit ?? ""}`.trim()
      : null;
  return (
    <div className="px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-sm font-medium">{lr.lrNumber}</span>
        <LRStatusChip status={lr.status} />
        {weight ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {weight}
          </span>
        ) : null}
        {lr.invoiceNumber ? (
          <span className="text-sm text-muted-foreground">
            Inv {lr.invoiceNumber}
          </span>
        ) : null}
      </div>
      {lr.delivery ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Delivered {formatDateTime(lr.delivery.deliveredAt)}
          {lr.delivery.receiverName
            ? ` · received by ${lr.delivery.receiverName}`
            : ""}
          {lr.delivery.receiverPhone ? ` (${lr.delivery.receiverPhone})` : ""}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cargo: empty states                                                 */
/* ------------------------------------------------------------------ */

/** What to say when a trip has no LR group — depends on the trip flavour. */
export function CargoEmptyState({
  trip,
  canCreateLR,
}: {
  trip: Trip;
  canCreateLR: boolean;
}) {
  let icon: React.ComponentType<{ size?: number; className?: string }>;
  let heading: string;
  let body: string;
  let cta: React.ReactNode = null;

  if (trip.isTripEmpty) {
    icon = IconTruck;
    heading = "Empty repositioning leg";
    body = "This leg moves the vehicle without cargo — no LR applies.";
  } else if (trip.tripType === "dc") {
    icon = IconTrain;
    heading = "Rake (DC) trip";
    body = "Goods move on a delivery challan — rake trips carry no LR.";
  } else if (trip.status === "Planned") {
    icon = IconFileText;
    heading = "No LR attached yet";
    body = "The trip starts the moment its LR is created and attached.";
    cta = canCreateLR ? (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/lorry-receipts/new?tripId=${trip.id}`}>
          <IconPlus size={15} className="mr-1" /> Create LR
        </Link>
      </Button>
    ) : null;
  } else if (trip.status === "InTransit") {
    // Reachable via the "already dispatched" / direct-dispatch paths, which
    // skip the LR form entirely — see the TRIP_CLOSE_NO_LR close-time gate.
    icon = IconAlertTriangle;
    heading = "LR still missing — this trip can't close yet";
    body =
      "This trip was dispatched without going through the LR form. Attach an LR now, or this trip will be blocked when you try to close it.";
    cta = canCreateLR ? (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/lorry-receipts/new?tripId=${trip.id}`}>
          <IconPlus size={15} className="mr-1" /> Attach LR now
        </Link>
      </Button>
    ) : null;
  } else {
    // Closed with no LR — shouldn't be reachable going forward (the close
    // gate above blocks it), but older trips predating that gate may show
    // this.
    icon = IconFileText;
    heading = "Closed with no LR on record";
    body =
      "This trip closed without ever having an LR attached — there's no consignment record for it.";
  }

  const Icon = icon;
  return (
    <DetailCard title="Cargo — LR group" icon={IconPackage}>
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{heading}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
        {cta}
      </div>
    </DetailCard>
  );
}

/* ------------------------------------------------------------------ */
/* Side rail cards                                                     */
/* ------------------------------------------------------------------ */

export function DriverCard({
  driver,
}: {
  driver: NonNullable<Trip["driver"]>;
}) {
  const initials = driver.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const licenseExpired =
    driver.licenseExpiryDate != null &&
    new Date(driver.licenseExpiryDate).getTime() < Date.now();
  return (
    <DetailCard title="Driver" icon={IconUser}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{driver.name}</p>
          {driver.mobile ? (
            <a
              href={`tel:${driver.mobile}`}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <IconPhone size={13} /> {driver.mobile}
            </a>
          ) : null}
        </div>
      </div>
      {driver.licenseNo ? (
        <p className="mt-2.5 flex items-center gap-1 text-xs text-muted-foreground">
          <IconId size={13} />
          {driver.licenseNo}
          {driver.licenseExpiryDate ? (
            <span
              className={cn(
                licenseExpired && "font-medium text-amber-700 dark:text-amber-400",
              )}
            >
              · {licenseExpired ? "expired" : "valid till"}{" "}
              {formatDate(driver.licenseExpiryDate)}
            </span>
          ) : null}
        </p>
      ) : null}
    </DetailCard>
  );
}

export function VehicleCard({
  vehicle,
}: {
  vehicle: NonNullable<Trip["vehicle"]>;
}) {
  return (
    <DetailCard title="Vehicle" icon={IconTruck}>
      <span className="inline-flex items-center rounded-sm border border-border bg-muted/50 px-2 py-0.5 font-mono text-sm font-semibold uppercase">
        {vehicle.vehicleNumber}
      </span>
      <dl className="mt-2.5 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Ownership</dt>
          <dd className="capitalize">{vehicle.ownershipType}</dd>
        </div>
        {vehicle.capacityMT != null ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Capacity</dt>
            <dd className="tabular-nums">{vehicle.capacityMT} MT</dd>
          </div>
        ) : null}
        {vehicle.bodyType ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Body</dt>
            <dd>{vehicle.bodyType}</dd>
          </div>
        ) : null}
      </dl>
    </DetailCard>
  );
}

/* ------------------------------------------------------------------ */
/* Status history timeline                                             */
/* ------------------------------------------------------------------ */

export function StatusTimeline({
  history,
}: {
  history: TripStatusHistoryRow[];
}) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No history yet.</p>;
  }
  return (
    <ol className="relative ml-1.5 space-y-4 border-l border-border pl-4">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span
            className={cn(
              "absolute -left-[21.5px] top-1 size-2.5 rounded-full border-2 border-card",
              h.status === "Cancelled" ? "bg-destructive" : "bg-primary",
            )}
          />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <TripStatusBadge status={h.status} />
            <span className="text-xs text-muted-foreground">
              {formatDateTime(h.changedAt)}
              {timeAgo(h.changedAt) ? ` · ${timeAgo(h.changedAt)}` : ""}
            </span>
          </div>
          {h.note ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{h.note}</p>
          ) : null}
          {h.changedBy ? (
            <p className="text-xs text-muted-foreground">
              by {h.changedBy.firstName} {h.changedBy.lastName}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Unloading points                                                    */
/* ------------------------------------------------------------------ */

const qtyOrDash = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-IN");

export function UnloadingPointsCard({
  points,
}: {
  points: TripUnloadingPointRow[];
}) {
  return (
    <DetailCard title="Unloading points" icon={IconBuildingWarehouse}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-xs uppercase">#</TableHead>
              <TableHead className="text-xs uppercase">Stop</TableHead>
              <TableHead className="text-xs uppercase">Planned</TableHead>
              <TableHead className="text-xs uppercase">Arrived</TableHead>
              <TableHead className="text-xs uppercase">Unloaded</TableHead>
              <TableHead className="text-right text-xs uppercase">
                Recd / Dmg / Short
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm tabular-nums">
                  {p.sequence}
                </TableCell>
                <TableCell className="text-sm">
                  {p.city.name}
                  {p.location ? (
                    <span className="block text-xs text-muted-foreground">
                      {p.location.name}
                    </span>
                  ) : null}
                  {p.remarks ? (
                    <span className="block text-xs text-muted-foreground">
                      {p.remarks}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {p.plannedDate ? formatDate(p.plannedDate) : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {p.actualArrivalAt ? formatDateTime(p.actualArrivalAt) : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {p.actualUnloadingAt
                    ? formatDateTime(p.actualUnloadingAt)
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {qtyOrDash(p.receivedQty)} / {qtyOrDash(p.damageQty)} /{" "}
                  {qtyOrDash(p.shortageQty)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DetailCard>
  );
}

/* ------------------------------------------------------------------ */
/* Banners                                                             */
/* ------------------------------------------------------------------ */

export function CancelledBanner({ reason }: { reason: string | null }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <IconBan size={16} className="mt-0.5 shrink-0 text-destructive" />
      <div>
        <p className="text-sm font-medium text-destructive">Trip cancelled</p>
        {reason ? (
          <p className="text-sm text-muted-foreground">{reason}</p>
        ) : null}
      </div>
    </div>
  );
}

export function CloseBlockedBanner({
  lrNumbers,
  missingLR,
}: {
  lrNumbers: string[];
  missingLR?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <IconAlertTriangle
        size={16}
        className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400"
      />
      <div>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Trip can&apos;t close yet
        </p>
        <p className="text-sm text-muted-foreground">
          {missingLR ? (
            "This is an LR trip with no LR attached yet. Create and attach an LR before closing it."
          ) : (
            <>
              {lrNumbers.length} LR{lrNumbers.length > 1 ? "s are" : " is"} not
              delivered:{" "}
              <span className="font-mono">{lrNumbers.join(", ")}</span>.
              Finalise and deliver them, or hold the group at hub.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
