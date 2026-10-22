import { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import { BadRequestError } from "../../../lib/error.js";
import { claimedAmong } from "./claims.js";
import {
  afterPosition,
  decodeCursor,
  pageMerged,
  type StreamPage,
} from "./eligible-stream.js";

type DbClient = typeof db | Prisma.TransactionClient;

/*
 * Transporter payment, one line per TRUCK (LR group).
 *
 * The transporter is hired per truck: freight, advance, commission, hamali
 * and TDS are stored once on the LR group. Detention and damage come from
 * each LR's acknowledgement. So a truck line counts the truck amounts once
 * and adds every LR's detention/damage — a truck with 2 LRs is never paid
 * twice (ERP-58), and both LR numbers stay visible on the line.
 *
 * A truck is payable once every one of its live LRs is delivered (the
 * truck's job is done). Trucks still waiting on an LR are listed too, as not
 * ready, so the user can see which LR is holding them.
 */

const DELIVERED_LR_STATUSES = ["DELIVERED", "ACKNOWLEDGED"] as const;

/** LRs that count towards a truck: not deleted, not cancelled. */
const liveLrWhere = {
  deletedAt: null,
  status: { not: "CANCELLED" },
} satisfies Prisma.LorryReceiptWhereInput;

export type TruckLR = {
  lrId: string;
  lrNumber: string;
  status: string;
  /** Unloading point, e.g. "Customer A — Pune DC". */
  unloadingPoint: string | null;
  deliveredAt: Date | null;
  detentionPaise: bigint;
  damagePaise: bigint;
};

export type EligibleTransporterTruck = {
  groupId: string;
  groupNumber: string;
  originBranchId: string;
  vehicleNumber: string | null;
  /** True when every LR of the truck is delivered — only then can it be paid. */
  ready: boolean;
  /** LR numbers not delivered yet (empty when ready). */
  pendingLrNumbers: string[];
  lrs: TruckLR[];
  freightPaise: bigint;
  detentionPaise: bigint;
  advancePaise: bigint;
  commissionPaise: bigint;
  hamaliPaise: bigint;
  tdsPaise: bigint;
  damagePaise: bigint;
  stationeryPaise: bigint;
};

export const truckSelect = {
  id: true,
  createdAt: true,
  groupNumber: true,
  originBranchId: true,
  marketVehicleNumber: true,
  marketFreightAmount: true,
  marketAdvanceAmount: true,
  marketCommissionAmount: true,
  marketHamaliAmount: true,
  marketTdsAmount: true,
  lorryReceipts: {
    where: liveLrWhere,
    orderBy: [{ createdAt: "asc" }, { lrNumber: "asc" }],
    select: {
      id: true,
      lrNumber: true,
      status: true,
      unloadingLocation: {
        select: { name: true, customer: { select: { name: true } } },
      },
      delivery: { select: { deliveredAt: true } },
      acknowledgement: { select: { detentionAmount: true, damageAmount: true } },
    },
  },
} satisfies Prisma.LRGroupSelect;

export type TruckRow = Prisma.LRGroupGetPayload<{ select: typeof truckSelect }>;

const isDelivered = (status: string) =>
  (DELIVERED_LR_STATUSES as readonly string[]).includes(status);

export const toTruck = (group: TruckRow): EligibleTransporterTruck => {
  const lrs: TruckLR[] = group.lorryReceipts.map((lr) => ({
    lrId: lr.id,
    lrNumber: lr.lrNumber,
    status: lr.status,
    unloadingPoint: lr.unloadingLocation
      ? `${lr.unloadingLocation.customer.name} — ${lr.unloadingLocation.name}`
      : null,
    deliveredAt: lr.delivery?.deliveredAt ?? null,
    detentionPaise: lr.acknowledgement?.detentionAmount ?? 0n,
    damagePaise: lr.acknowledgement?.damageAmount ?? 0n,
  }));
  const pendingLrNumbers = lrs
    .filter((lr) => !isDelivered(lr.status))
    .map((lr) => lr.lrNumber);
  const sum = (key: "detentionPaise" | "damagePaise") =>
    lrs.reduce((total, lr) => total + lr[key], 0n);

  return {
    groupId: group.id,
    groupNumber: group.groupNumber,
    originBranchId: group.originBranchId,
    vehicleNumber: group.marketVehicleNumber,
    ready: lrs.length > 0 && pendingLrNumbers.length === 0,
    pendingLrNumbers,
    lrs,
    freightPaise: group.marketFreightAmount ?? 0n,
    detentionPaise: sum("detentionPaise"),
    advancePaise: group.marketAdvanceAmount ?? 0n,
    commissionPaise: group.marketCommissionAmount ?? 0n,
    hamaliPaise: group.marketHamaliAmount ?? 0n,
    tdsPaise: group.marketTdsAmount ?? 0n,
    damagePaise: sum("damagePaise"),
    // No stored source — the operator enters it, same as legacy.
    stationeryPaise: 0n,
  };
};

/** Market trucks of this transporter that are not deleted or cancelled. */
const transporterTruckWhere = (transportId: string): Prisma.LRGroupWhereInput => ({
  deletedAt: null,
  status: { not: "CANCELLED" },
  isMarketVehicle: true,
  marketTransportId: transportId,
});

/**
 * Which of these trucks already sit on an active slip — either as a truck
 * line, or through any of their LRs on a legacy per-LR line.
 */
export async function claimedTrucks(
  client: DbClient,
  trucks: { id: string; lorryReceipts: { id: string }[] }[],
  excludeSlipId?: string,
): Promise<Set<string>> {
  const lrIds = trucks.flatMap((truck) => truck.lorryReceipts.map((lr) => lr.id));
  const [claimedGroups, claimedLrs] = await Promise.all([
    claimedAmong(client, ["LR_GROUP"], trucks.map((truck) => truck.id), excludeSlipId),
    claimedAmong(client, ["LR"], lrIds, excludeSlipId),
  ]);
  return new Set(
    trucks
      .filter(
        (truck) =>
          claimedGroups.has(truck.id) ||
          truck.lorryReceipts.some((lr) => claimedLrs.has(lr.id)),
      )
      .map((truck) => truck.id),
  );
}

export type FindEligibleTransporterTrucksParams = {
  transportId: string;
  /** `{ originBranchId }` for a chosen branch, or the caller's branch scope. */
  branchWhere?: Prisma.LRGroupWhereInput;
  /** Delivery date range — a truck shows when any of its LRs is delivered in it. */
  from?: Date;
  to?: Date;
  /** Matched in the database against LR no., LR-group no. and vehicle no. */
  search?: string;
  cursor?: string;
  size: number;
};

const TRUCK_STREAM_RANK = 0;

/**
 * Trucks for the create-slip screen, one chunk at a time: every unclaimed
 * market truck of this transporter with at least one delivered LR. Trucks
 * still waiting on an LR come back with `ready: false`.
 */
export async function findEligibleTransporterTrucks(
  client: DbClient,
  params: FindEligibleTransporterTrucksParams,
): Promise<StreamPage<EligibleTransporterTruck>> {
  const search = params.search?.trim();
  const range =
    params.from || params.to
      ? {
          ...(params.from ? { gte: params.from } : {}),
          ...(params.to ? { lte: params.to } : {}),
        }
      : undefined;

  const base: Prisma.LRGroupWhereInput = {
    ...transporterTruckWhere(params.transportId),
    ...params.branchWhere,
    lorryReceipts: {
      some: {
        ...liveLrWhere,
        status: { in: [...DELIVERED_LR_STATUSES] },
        ...(range ? { delivery: { deliveredAt: range } } : {}),
      },
    },
    ...(search
      ? {
          OR: [
            { groupNumber: { contains: search, mode: "insensitive" } },
            { marketVehicleNumber: { contains: search, mode: "insensitive" } },
            {
              lorryReceipts: {
                some: { ...liveLrWhere, lrNumber: { contains: search, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };

  const page = await pageMerged<TruckRow>(
    [
      {
        rank: TRUCK_STREAM_RANK,
        fetch: (after, take) =>
          client.lRGroup.findMany({
            where: { AND: [base, afterPosition(TRUCK_STREAM_RANK, after)] },
            select: truckSelect,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take,
          }),
        dropClaimed: async (rows) => {
          const claimed = await claimedTrucks(client, rows);
          return rows.filter((row) => !claimed.has(row.id));
        },
      },
    ],
    params.cursor ? decodeCursor(params.cursor) : null,
    params.size,
  );

  return { items: page.items.map(toTruck), nextCursor: page.nextCursor };
}

/**
 * Re-derive every server-owned amount for the submitted truck ids straight
 * from the LR group and its LRs — never from client input — and re-check
 * that each truck belongs to this transporter, is fully delivered and is not
 * on another active slip. `excludeSlipId` lets a draft re-save its own lines.
 */
export async function reconcileTransporterTrucks(
  client: DbClient,
  transportId: string,
  groupIds: string[],
  excludeSlipId?: string,
): Promise<Map<string, EligibleTransporterTruck>> {
  if (groupIds.length === 0) return new Map();

  const rows = await client.lRGroup.findMany({
    where: { ...transporterTruckWhere(transportId), id: { in: groupIds } },
    select: truckSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, toTruck(row)]));

  const missing = groupIds.filter((id) => !byId.has(id));
  if (missing.length)
    throw new BadRequestError(
      `These trucks are not market trucks of this transporter: ${missing.join(", ")}`,
    );

  const notReady = [...byId.values()].filter((truck) => !truck.ready);
  if (notReady.length)
    throw new BadRequestError(
      `These trucks still have LRs to deliver: ${notReady
        .map((truck) => `${truck.groupNumber} (${truck.pendingLrNumbers.join(", ")})`)
        .join("; ")}`,
    );

  const claimed = await claimedTrucks(client, rows, excludeSlipId);
  if (claimed.size)
    throw new BadRequestError(
      `These trucks are already on another vendor payment slip: ${rows
        .filter((row) => claimed.has(row.id))
        .map((row) => row.groupNumber)
        .join(", ")}`,
    );

  return byId;
}
