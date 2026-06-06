import { Prisma } from "@prisma/client";
import { db } from "../../../prisma/prisma.js";

type Tx = Prisma.TransactionClient;

/**
 * Indian financial year code for a date — April..March.
 * 2026-06-02 -> "26-27", 2026-02-15 -> "25-26".
 */
export const fyCodeFor = (date: Date): string => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1; // month 3 = April
  const pad = (y: number) => String(y % 100).padStart(2, "0");
  return `${pad(startYear)}-${pad(startYear + 1)}`;
};

/**
 * Atomically reserve the next sequence number for (branchCode, fyCode, docType)
 * and return it. Single upsert+increment statement → safe under concurrency.
 */
export const nextSequence = async (
  tx: Tx,
  branchCode: string,
  fyCode: string,
  docType: string
): Promise<number> => {
  const rows = await tx.$queryRaw<{ seq: number }[]>`
    INSERT INTO "DocumentSequence" ("id", "branchCode", "fyCode", "docType", "nextSeq", "updatedAt")
    VALUES (gen_random_uuid()::text, ${branchCode}, ${fyCode}, ${docType}, 2, now())
    ON CONFLICT ("branchCode", "fyCode", "docType")
    DO UPDATE SET "nextSeq" = "DocumentSequence"."nextSeq" + 1, "updatedAt" = now()
    RETURNING ("nextSeq" - 1) AS seq
  `;
  return Number(rows[0]?.seq ?? 1);
};

/**
 * Build a document number: SKT/<branchCode>/<fyCode>/<00001>.
 */
export const formatDocNumber = (
  branchCode: string,
  fyCode: string,
  seq: number
) => `SKT/${branchCode}/${fyCode}/${String(seq).padStart(5, "0")}`;

export type FreightResult = {
  amount: number | null;
  matched: boolean;
  source: "RateMatrix" | "Manual" | "None";
};

/**
 * Resolve booking freight for a Truck order:
 *   customer -> agreement(s) -> route(fromBranch.city -> toBranch.city)
 *   -> RateMatrix (prefer exact vehicleType, else the null/any row) x truckQuantity.
 * Item orders price manually (no matrix) — returns Manual.
 */
export const computeFreight = async (args: {
  orderType: "Truck" | "Item";
  customerId: string;
  fromBranchId: string;
  toBranchId: string;
  vehicleTypeId?: string | null;
  truckQuantity?: number | null;
}): Promise<FreightResult> => {
  if (args.orderType !== "Truck") {
    return { amount: null, matched: false, source: "Manual" };
  }

  const [fromBranch, toBranch] = await Promise.all([
    db.branch.findUnique({ where: { id: args.fromBranchId }, select: { cityId: true } }),
    db.branch.findUnique({ where: { id: args.toBranchId }, select: { cityId: true } }),
  ]);

  if (!fromBranch?.cityId || !toBranch?.cityId) {
    return { amount: null, matched: false, source: "None" };
  }

  const route = await db.route.findFirst({
    where: { sourceCityId: fromBranch.cityId, destinationCityId: toBranch.cityId },
    select: { id: true },
  });
  if (!route) return { amount: null, matched: false, source: "None" };

  const agreements = await db.agreement.findMany({
    where: { clientId: args.customerId },
    select: { id: true },
  });
  if (agreements.length === 0) return { amount: null, matched: false, source: "None" };

  const agreementIds = agreements.map((a) => a.id);

  // Prefer an exact vehicleType match; fall back to the wildcard (null) row.
  const match = await db.rateMatrix.findFirst({
    where: {
      agreementId: { in: agreementIds },
      routeId: route.id,
      OR: [
        ...(args.vehicleTypeId ? [{ vehicleTypeId: args.vehicleTypeId }] : []),
        { vehicleTypeId: null },
      ],
    },
    orderBy: { vehicleTypeId: { sort: "desc", nulls: "last" } },
    select: { rate: true },
  });

  if (!match) return { amount: null, matched: false, source: "None" };

  const qty = args.truckQuantity && args.truckQuantity > 0 ? args.truckQuantity : 1;
  return { amount: match.rate * qty, matched: true, source: "RateMatrix" };
};
export const orderListSelect = {
  id: true,
  orderNumber: true,
  status: true,
  orderType: true,
  pickupDate: true,
  bookingFreightAmount: true,
  truckQuantity: true,

  customer: {
    select: {
      id: true,
      name: true,
    },
  },

  fromBranch: {
    select: {
      id: true,
      shortCode: true,
    },
  },

  toBranch: {
    select: {
      id: true,
      shortCode: true,
    },
  },

  vehicleType: {
    select: {
      id: true,
      name: true,
    },
  },

  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },

  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.OrderSelect;
export const orderQuickViewSelect = {
  id: true,
  orderNumber: true,
  status: true,
  pickupDate: true,
  orderType: true,
  truckQuantity: true,
  bookingFreightAmount: true,
  contactPersonName: true,
  contactMobile: true,
  contactEmail: true,
  pickupAddressOverride: true,

  customer: {
    select: { id: true, name: true },
  },
  fromBranch: {
    select: { id: true, shortCode: true },
  },
  toBranch: {
    select: { id: true, shortCode: true },
  },
  vehicleType: {
    select: { id: true, name: true },
  },
  customerLocation: {
    select: { id: true, name: true },
  },
} satisfies Prisma.OrderSelect;
/** Standard include for returning a fully-hydrated order to the client. */
export const orderInclude = {
  customer: { select: { id: true, name: true, disallowNewLRBooking: true } },
  fromBranch: { select: { id: true, name: true, shortCode: true } },
  toBranch: { select: { id: true, name: true, shortCode: true } },
  vehicleType: { select: { id: true, code: true, name: true } },
  customerLocation: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  items: { include: { goods: { select: { id: true, name: true } } } },
  events: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: { select: { id: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.OrderInclude;

/** Append an audit event to an order's timeline. */
export const writeOrderEvent = async (
  tx: Tx,
  orderId: string,
  actorId: string,
  eventType: string,
  note?: string | null,
  payloadDiff?: Prisma.InputJsonValue
) => {
  await tx.orderEvent.create({
    data: { orderId, actorId, eventType, note: note ?? null, payloadDiff },
  });
};
