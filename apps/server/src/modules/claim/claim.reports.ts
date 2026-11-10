import ExcelJS from "exceljs";
import type {
  ClaimAgeing,
  ClaimCostGroupBy,
  ClaimCostSummary,
  ClaimListRow,
  DashboardClaims,
} from "@skerp/types";
import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError } from "../../lib/error.js";
import { claimMoneyTotals, COUNTED_RECOVERY_STATUSES } from "./claim.compute.js";
import { ageClaims, routeLabel, summariseCost } from "./claim.reports.compute.js";

/**
 * C8 — register rows (shared by the list and the export), export, ageing,
 * damage-cost summary and the dashboard card. Every query takes the
 * register's `where`, so a report always matches what the register shows.
 */

const countedRecoveries = {
  where: { status: { in: [...COUNTED_RECOVERY_STATUSES] } },
  select: { status: true, amountPaise: true },
} satisfies Prisma.ClaimRecoveryFindManyArgs;

export const claimListInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  customer: { select: { id: true, name: true } },
  lr: { select: { id: true, lrNumber: true, groupId: true } },
  recoveries: countedRecoveries,
} satisfies Prisma.ClaimInclude;

type ListClaim = Prisma.ClaimGetPayload<{ include: typeof claimListInclude }>;

export const toClaimListRow = (claim: ListClaim): ClaimListRow => {
  const totals = claimMoneyTotals(claim);
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    claimDate: claim.claimDate.toISOString(),
    claimType: claim.claimType,
    origin: claim.origin,
    causedBy: claim.causedBy,
    status: claim.status,
    damagedQty: claim.damagedQty.toNumber(),
    shortageQty: claim.shortageQty.toNumber(),
    claimedAmountPaise: Number(claim.claimedAmountPaise),
    settledAmountPaise: claim.settledAmountPaise === null ? null : Number(claim.settledAmountPaise),
    recoveredAmountPaise: Number(totals.recoveredAmountPaise),
    netLossPaise: totals.netLossPaise === null ? null : Number(totals.netLossPaise),
    branch: claim.branch,
    customer: claim.customer,
    lr: claim.lr,
    createdAt: claim.createdAt.toISOString(),
  };
};

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

/** An export is a working file, not a data dump — narrow the filters past this. */
const EXPORT_LIMIT = 10_000;

const TYPE: Record<string, string> = { DAMAGE: "Damage", SHORTAGE: "Shortage", LOSS: "Loss" };
const STATUS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  SETTLED: "Settled",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};
const CAUSE: Record<string, string> = {
  TRANSPORTER: "Transporter",
  LABOUR: "Labour",
  RAILWAY: "Railway",
  CUSTOMER: "Customer",
  DRIVER: "Driver",
  INSURED_EVENT: "Insured event",
  UNKNOWN: "Unknown",
};
const ORIGIN: Record<string, string> = {
  LR_ACK: "LR acknowledgement",
  GRN: "GRN at rail head",
  RAIL_BRANCH_GRN: "GRN at branch",
  MANUAL: "Raised by hand",
};

const HEADERS = [
  "Claim No",
  "Date",
  "LR No",
  "Customer",
  "Branch",
  "Type",
  "Raised from",
  "Caused by",
  "Status",
  "Damaged qty",
  "Short qty",
  "Claimed (₹)",
  "Settled (₹)",
  "Recovered (₹)",
  "Net loss (₹)",
];

const rupees = (paise: number | null) => (paise === null ? null : paise / 100);
const day = (iso: string) => iso.slice(0, 10);

const exportCells = (row: ClaimListRow) => [
  row.claimNumber,
  day(row.claimDate),
  row.lr.lrNumber,
  row.customer.name,
  row.branch.name,
  TYPE[row.claimType] ?? row.claimType,
  ORIGIN[row.origin] ?? row.origin,
  row.causedBy ? (CAUSE[row.causedBy] ?? row.causedBy) : "",
  STATUS[row.status] ?? row.status,
  row.damagedQty,
  row.shortageQty,
  rupees(row.claimedAmountPaise),
  rupees(row.settledAmountPaise),
  rupees(row.recoveredAmountPaise),
  rupees(row.netLossPaise),
];

/** Same totals as the register's columns: blanks (unsettled) count as 0. */
const totalCells = (rows: ClaimListRow[]) => {
  const sum = (pick: (row: ClaimListRow) => number | null) =>
    rows.reduce((total, row) => total + (pick(row) ?? 0), 0) / 100;
  return [
    `Total (${rows.length} claims)`,
    ...Array(10).fill(""),
    sum((row) => row.claimedAmountPaise),
    sum((row) => row.settledAmountPaise),
    sum((row) => row.recoveredAmountPaise),
    sum((row) => row.netLossPaise),
  ];
};

export async function exportRows(
  where: Prisma.ClaimWhereInput,
  orderBy: Prisma.ClaimOrderByWithRelationInput[],
) {
  const count = await db.claim.count({ where });
  if (count > EXPORT_LIMIT)
    throw new BadRequestError(
      `${count} claims match — narrow the filters to ${EXPORT_LIMIT.toLocaleString("en-IN")} or fewer to export`,
    );
  const claims = await db.claim.findMany({ where, include: claimListInclude, orderBy });
  return claims.map(toClaimListRow);
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const claimsCsv = (rows: ClaimListRow[]) =>
  [HEADERS, ...rows.map(exportCells), totalCells(rows)]
    .map((cells) => cells.map(csvCell).join(","))
    .join("\n");

export async function claimsXlsx(rows: ClaimListRow[], generatedAt: Date): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SK ERP";
  wb.created = generatedAt;
  const ws = wb.addWorksheet("Damage claims");
  [22, 12, 18, 28, 16, 10, 20, 14, 11, 12, 10, 14, 14, 14, 14].forEach(
    (width, i) => (ws.getColumn(i + 1).width = width),
  );
  ws.addRow(HEADERS).font = { bold: true };
  for (const row of rows) ws.addRow(exportCells(row));
  ws.addRow(totalCells(rows)).font = { bold: true };
  for (const col of [12, 13, 14, 15]) ws.getColumn(col).numFmt = "#,##0.00";
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ------------------------------------------------------------------ */
/* Ageing / cost summary                                               */
/* ------------------------------------------------------------------ */

/** Open claims under the register's filters, by days since raised. */
export async function claimAgeing(where: Prisma.ClaimWhereInput, now: Date): Promise<ClaimAgeing> {
  const open = await db.claim.findMany({
    where: { AND: [where, { status: { in: ["PENDING", "ACTIVE"] } }] },
    select: { createdAt: true, claimedAmountPaise: true },
  });
  return { buckets: ageClaims(open, now), openCount: open.length };
}

/** Settled claims under the register's filters, grouped. */
export async function claimCostSummary(
  where: Prisma.ClaimWhereInput,
  groupBy: ClaimCostGroupBy,
): Promise<ClaimCostSummary> {
  const city = { select: { city: { select: { name: true } } } } as const;
  const claims = await db.claim.findMany({
    where: { AND: [where, { status: "SETTLED" }] },
    select: {
      settledAmountPaise: true,
      causedBy: true,
      customer: { select: { id: true, name: true } },
      recoveries: countedRecoveries,
      lr: {
        select: {
          loadingLocation: city,
          unloadingLocation: city,
          group: {
            select: {
              isMarketVehicle: true,
              marketTransport: { select: { id: true, name: true } },
              originBranch: { select: { name: true } },
              destinationBranch: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  const { rows, totals } = summariseCost(
    claims.map((claim) => ({
      settledAmountPaise: claim.settledAmountPaise ?? 0n,
      recoveredAmountPaise: claimMoneyTotals(claim).recoveredAmountPaise,
      cause: claim.causedBy,
      customer: claim.customer,
      transporter: claim.lr.group.isMarketVehicle ? claim.lr.group.marketTransport : null,
      route: routeLabel({
        fromCity: claim.lr.loadingLocation?.city.name ?? null,
        toCity: claim.lr.unloadingLocation?.city.name ?? null,
        fromBranch: claim.lr.group.originBranch.name,
        toBranch: claim.lr.group.destinationBranch.name,
      }),
    })),
    groupBy,
  );
  return { groupBy, rows, totals };
}

/* ------------------------------------------------------------------ */
/* Dashboard card                                                      */
/* ------------------------------------------------------------------ */

/**
 * Open claims and what they could still cost, plus this month's net loss
 * (claims settled this calendar month). `branchWhere` is the viewer's scope.
 */
export async function claimsDashboard(
  branchWhere: Prisma.ClaimWhereInput,
  now: Date,
): Promise<DashboardClaims> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const base: Prisma.ClaimWhereInput = { deletedAt: null, ...branchWhere };
  const [open, settledThisMonth] = await Promise.all([
    db.claim.aggregate({
      where: { ...base, status: { in: ["PENDING", "ACTIVE"] } },
      _count: { _all: true },
      _sum: { claimedAmountPaise: true },
    }),
    db.claim.findMany({
      where: { ...base, status: "SETTLED", settledAt: { gte: monthStart } },
      select: { settledAmountPaise: true, recoveries: countedRecoveries },
    }),
  ]);
  const netLoss = settledThisMonth.reduce(
    (sum, claim) => sum + (claimMoneyTotals(claim).netLossPaise ?? 0n),
    0n,
  );
  return {
    openCount: open._count._all,
    openClaimedPaise: (open._sum.claimedAmountPaise ?? 0n).toString(),
    settledThisMonthCount: settledThisMonth.length,
    netLossThisMonthPaise: netLoss.toString(),
  };
}
