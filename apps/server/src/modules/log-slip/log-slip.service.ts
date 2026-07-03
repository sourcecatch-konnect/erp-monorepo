import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { computeJourneyTotals } from "../vehicle-journey/vehicle-journey.service.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Selects                                                            */
/* ------------------------------------------------------------------ */

export const logSlipListSelect = {
  id: true,
  journeyId: true,
  logSlipNumber: true,
  fyCode: true,
  logSlipDate: true,
  status: true,
  totalKm: true,
  totalFreightPaise: true,
  totalExpensePaise: true,
  netVehicleResultPaise: true,
  generatedAt: true,
  postedAt: true,
  createdAt: true,
  vehicle: { select: { id: true, vehicleNumber: true } },
  driver: { select: { id: true, name: true } },
  journey: {
    select: {
      id: true,
      journeyNumber: true,
      startedAt: true,
      closedAt: true,
    },
  },
} satisfies Prisma.LogSlipSelect;

export const logSlipInclude = {
  lines: { orderBy: { sortOrder: "asc" as const } },
  vehicle: { select: { id: true, vehicleNumber: true } },
  driver: { select: { id: true, name: true } },
  journey: {
    select: {
      id: true,
      journeyNumber: true,
      startedAt: true,
      closedAt: true,
      startCity: { select: { id: true, name: true } },
      returnCity: { select: { id: true, name: true } },
    },
  },
  generatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.LogSlipInclude;

/* ------------------------------------------------------------------ */
/* Settlement computation                                             */
/* ------------------------------------------------------------------ */

export type SnapshotLine = {
  lineType:
    | "TRIP_FREIGHT"
    | "ADVANCE"
    | "DIESEL"
    | "EXPENSE"
    | "DRIVER_SETTLEMENT"
    | "ADJUSTMENT";
  sourceType: string | null;
  sourceId: string | null;
  description: string;
  quantity: number | null;
  ratePaise: bigint | null;
  amountPaise: bigint;
  sortOrder: number;
  metadata: Prisma.InputJsonValue | undefined;
};

export type LogSlipComputation = {
  journey: NonNullable<
    Awaited<ReturnType<typeof loadJourneyForSettlement>>
  >;
  totalFreightPaise: bigint;
  totalAdvancePaise: bigint;
  totalDieselQty: number;
  totalDieselAmountPaise: bigint;
  totalCashExpensePaise: bigint;
  totalCreditExpensePaise: bigint;
  totalExpensePaise: bigint;
  netVehicleResultPaise: bigint;
  driverCashExpensePaise: bigint;
  driverReceivablePaise: bigint;
  driverPayablePaise: bigint;
  totalKm: number | null;
  totalDays: number | null;
  actualAverage: number | null;
  lines: SnapshotLine[];
  warnings: string[];
};

export const loadJourneyForSettlement = (journeyId: string) =>
  db.vehicleJourney.findFirst({
    where: { id: journeyId, deletedAt: null },
    select: {
      id: true,
      journeyNumber: true,
      fyCode: true,
      status: true,
      settlementStatus: true,
      vehicleId: true,
      driverId: true,
      openingKm: true,
      closingKm: true,
      startedAt: true,
      closedAt: true,
      vehicle: { select: { id: true, vehicleNumber: true } },
      driver: { select: { id: true, name: true } },
      logSlip: { select: { id: true, status: true, logSlipNumber: true } },
      trips: {
        where: { deletedAt: null, status: { not: "Cancelled" as const } },
        orderBy: { sequenceNo: "asc" as const },
        select: {
          id: true,
          sequenceNo: true,
          tripName: true,
          status: true,
          legType: true,
          onwardFreight: true,
          openingKm: true,
          closingKm: true,
          isTripEmpty: true,
          fromCity: { select: { name: true } },
          toCity: { select: { name: true } },
        },
      },
      advances: {
        where: { status: "POSTED" as const },
        orderBy: { paidAt: "asc" as const },
        select: {
          id: true,
          amountPaise: true,
          paymentMode: true,
          paidAt: true,
          narration: true,
        },
      },
      expenses: {
        where: {
          deletedAt: null,
          status: { in: ["APPROVED", "POSTED"] as const },
        },
        orderBy: { expenseDate: "asc" as const },
        select: {
          id: true,
          expenseType: true,
          amountPaise: true,
          paymentMode: true,
          dieselQty: true,
          dieselRatePaise: true,
          expenseDate: true,
          paidByDriver: true,
          receiptNo: true,
          remarks: true,
          pump: { select: { name: true } },
          city: { select: { name: true } },
        },
      },
    },
  });

const maxBigInt = (a: bigint, b: bigint) => (a > b ? a : b);

/**
 * Compute the full settlement for a journey: totals, driver balance, vehicle
 * result and the snapshot lines. Used live by the preview endpoint and frozen
 * by generate. Only APPROVED/POSTED expenses and POSTED advances count.
 */
export const computeLogSlip = async (
  journeyId: string,
): Promise<LogSlipComputation | null> => {
  const journey = await loadJourneyForSettlement(journeyId);
  if (!journey) return null;

  const totals = await computeJourneyTotals(db, journeyId, {
    approvedOnly: true,
  });

  const warnings: string[] = [];
  if (journey.status === "ACTIVE") {
    warnings.push("Journey has not returned to base yet");
  }
  if (totals.openLegCount > 0) {
    warnings.push(`${totals.openLegCount} leg(s) are still open`);
  }
  if (totals.unapprovedExpenseCount > 0) {
    warnings.push(
      `${totals.unapprovedExpenseCount} draft expense(s) are excluded from these figures`,
    );
  }
  if (journey.closingKm === null) {
    warnings.push("Journey closing KM is not recorded yet");
  }
  if (totals.totalDieselQty === 0) {
    warnings.push("No diesel captured on this journey");
  }

  // totalKm follows the legacy convention: closing − opening + 1.
  const totalKm =
    journey.closingKm !== null
      ? journey.closingKm - journey.openingKm + 1
      : null;
  const totalDays = journey.closedAt
    ? Math.max(
        1,
        Math.ceil(
          (journey.closedAt.getTime() - journey.startedAt.getTime()) /
            MS_PER_DAY,
        ),
      )
    : null;
  const actualAverage =
    totalKm !== null && totals.totalDieselQty > 0
      ? totalKm / totals.totalDieselQty
      : null;

  const netVehicleResultPaise =
    totals.totalFreightPaise - totals.totalExpensePaise;
  const driverReceivablePaise = maxBigInt(
    totals.totalAdvancePaise - totals.driverCashExpensePaise,
    0n,
  );
  const driverPayablePaise = maxBigInt(
    totals.driverCashExpensePaise - totals.totalAdvancePaise,
    0n,
  );

  /* ---- snapshot lines ---- */
  const lines: SnapshotLine[] = [];
  let sortOrder = 0;

  for (const leg of journey.trips) {
    lines.push({
      lineType: "TRIP_FREIGHT",
      sourceType: "VehicleTrip",
      sourceId: leg.id,
      description: `Leg ${leg.sequenceNo ?? "?"}: ${leg.fromCity?.name ?? "?"} → ${leg.toCity?.name ?? "?"}${leg.isTripEmpty ? " (empty)" : ""}`,
      quantity: null,
      ratePaise: null,
      amountPaise: leg.onwardFreight,
      sortOrder: sortOrder++,
      metadata: {
        tripName: leg.tripName,
        legType: leg.legType,
        openingKm: leg.openingKm,
        closingKm: leg.closingKm,
      },
    });
  }

  for (const advance of journey.advances) {
    lines.push({
      lineType: "ADVANCE",
      sourceType: "DriverAdvance",
      sourceId: advance.id,
      description: `Advance (${advance.paymentMode})${advance.narration ? ` — ${advance.narration}` : ""}`,
      quantity: null,
      ratePaise: null,
      amountPaise: advance.amountPaise,
      sortOrder: sortOrder++,
      metadata: { paidAt: advance.paidAt.toISOString() },
    });
  }

  for (const expense of journey.expenses) {
    const isDiesel = expense.expenseType === "DIESEL";
    const place = expense.pump?.name ?? expense.city?.name;
    lines.push({
      lineType: isDiesel ? "DIESEL" : "EXPENSE",
      sourceType: "TripExpense",
      sourceId: expense.id,
      description: isDiesel
        ? `Diesel${place ? ` — ${place}` : ""} (${expense.paymentMode})`
        : `${expense.expenseType}${place ? ` — ${place}` : ""} (${expense.paymentMode})${expense.remarks ? ` — ${expense.remarks}` : ""}`,
      quantity: isDiesel ? (expense.dieselQty ?? null) : null,
      ratePaise: isDiesel ? (expense.dieselRatePaise ?? null) : null,
      amountPaise: expense.amountPaise,
      sortOrder: sortOrder++,
      metadata: {
        paymentMode: expense.paymentMode,
        paidByDriver: expense.paidByDriver,
        expenseDate: expense.expenseDate.toISOString(),
        receiptNo: expense.receiptNo,
      },
    });
  }

  lines.push({
    lineType: "DRIVER_SETTLEMENT",
    sourceType: null,
    sourceId: null,
    description:
      driverPayablePaise > 0n
        ? "Payable to driver (cash expenses exceed advance)"
        : "Receivable from driver (unspent advance)",
    quantity: null,
    ratePaise: null,
    amountPaise:
      driverPayablePaise > 0n ? driverPayablePaise : driverReceivablePaise,
    sortOrder: sortOrder++,
    metadata: {
      totalAdvancePaise: totals.totalAdvancePaise.toString(),
      driverCashExpensePaise: totals.driverCashExpensePaise.toString(),
    },
  });

  return {
    journey,
    totalFreightPaise: totals.totalFreightPaise,
    totalAdvancePaise: totals.totalAdvancePaise,
    totalDieselQty: totals.totalDieselQty,
    totalDieselAmountPaise: totals.totalDieselAmountPaise,
    totalCashExpensePaise: totals.totalCashExpensePaise,
    totalCreditExpensePaise: totals.totalCreditExpensePaise,
    totalExpensePaise: totals.totalExpensePaise,
    netVehicleResultPaise,
    driverCashExpensePaise: totals.driverCashExpensePaise,
    driverReceivablePaise,
    driverPayablePaise,
    totalKm,
    totalDays,
    actualAverage,
    lines,
    warnings,
  };
};
