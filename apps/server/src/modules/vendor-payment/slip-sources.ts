import type {
  Prisma,
  VendorPaymentSourceType,
} from "../../../generated/prisma/index.js";
import type { db } from "../../../prisma/prisma.js";
import { toTruck, truckSelect } from "./calculators/transporter-truck.js";

type DbClient = typeof db | Prisma.TransactionClient;

export type LineSourceLR = {
  lrNumber: string;
  unloadingPoint: string | null;
  deliveredAt: Date | null;
  detentionPaise: bigint;
  damagePaise: bigint;
};

/** What a slip line pays for, in words — shown on the slip and its print. */
export type LineSource = {
  /** e.g. "G-0045", "LR-1", "GRN/JAL/26-27/00012", "Rake RK/… · VP 1234". */
  label: string;
  vehicleNumber: string | null;
  /** The truck's LRs (truck line) or the one LR (legacy LR line). */
  lrs: LineSourceLR[];
};

type LineRef = { sourceType: VendorPaymentSourceType; sourceId: string };

const idsOf = (lines: LineRef[], type: VendorPaymentSourceType) =>
  lines.filter((line) => line.sourceType === type).map((line) => line.sourceId);

/** Resolve every line's source document to a readable description. */
export async function resolveLineSources(
  client: DbClient,
  lines: LineRef[],
): Promise<Map<string, LineSource>> {
  const truckIds = idsOf(lines, "LR_GROUP");
  const lrIds = idsOf(lines, "LR");
  const grnIds = idsOf(lines, "GRN_HAMALI");
  const branchGrnIds = idsOf(lines, "RAIL_BRANCH_GRN");
  const wagonIds = idsOf(lines, "VP_LOADING");

  const [trucks, lrs, grns, branchGrns, wagons] = await Promise.all([
    truckIds.length
      ? client.lRGroup.findMany({ where: { id: { in: truckIds } }, select: truckSelect })
      : [],
    lrIds.length
      ? client.lorryReceipt.findMany({
          where: { id: { in: lrIds } },
          select: {
            id: true,
            lrNumber: true,
            group: { select: { marketVehicleNumber: true } },
            delivery: { select: { deliveredAt: true } },
            acknowledgement: { select: { detentionAmount: true, damageAmount: true } },
          },
        })
      : [],
    grnIds.length
      ? client.gRN.findMany({
          where: { id: { in: grnIds } },
          select: { id: true, grnNumber: true },
        })
      : [],
    branchGrnIds.length
      ? client.railBranchGRN.findMany({
          where: { id: { in: branchGrnIds } },
          select: {
            id: true,
            railRake: { select: { rakeNumber: true } },
            vpWagonLoading: { select: { mrRrRow: { select: { vpNo: true } } } },
          },
        })
      : [],
    wagonIds.length
      ? client.vPWagonLoading.findMany({
          where: { id: { in: wagonIds } },
          select: { id: true, gateNo: true, mrRrRow: { select: { vpNo: true } } },
        })
      : [],
  ]);

  const sources = new Map<string, LineSource>();
  for (const row of trucks) {
    const truck = toTruck(row);
    sources.set(row.id, {
      label: truck.groupNumber,
      vehicleNumber: truck.vehicleNumber,
      lrs: truck.lrs.map((lr) => ({
        lrNumber: lr.lrNumber,
        unloadingPoint: lr.unloadingPoint,
        deliveredAt: lr.deliveredAt,
        detentionPaise: lr.detentionPaise,
        damagePaise: lr.damagePaise,
      })),
    });
  }
  for (const lr of lrs) {
    sources.set(lr.id, {
      label: lr.lrNumber,
      vehicleNumber: lr.group.marketVehicleNumber,
      lrs: [
        {
          lrNumber: lr.lrNumber,
          unloadingPoint: null,
          deliveredAt: lr.delivery?.deliveredAt ?? null,
          detentionPaise: lr.acknowledgement?.detentionAmount ?? 0n,
          damagePaise: lr.acknowledgement?.damageAmount ?? 0n,
        },
      ],
    });
  }
  for (const grn of grns) {
    sources.set(grn.id, { label: grn.grnNumber, vehicleNumber: null, lrs: [] });
  }
  for (const grn of branchGrns) {
    const vpNo = grn.vpWagonLoading.mrRrRow.vpNo;
    sources.set(grn.id, {
      label: `Rake ${grn.railRake.rakeNumber}${vpNo ? ` · VP ${vpNo}` : ""}`,
      vehicleNumber: null,
      lrs: [],
    });
  }
  for (const wagon of wagons) {
    const parts = [
      wagon.mrRrRow.vpNo ? `VP ${wagon.mrRrRow.vpNo}` : null,
      wagon.gateNo ? `Gate ${wagon.gateNo}` : null,
    ].filter(Boolean);
    sources.set(wagon.id, {
      label: parts.length ? parts.join(" · ") : "VP loading",
      vehicleNumber: null,
      lrs: [],
    });
  }
  return sources;
}

/** Adds `source` to every line of a loaded slip. */
export async function withLineSources<
  T extends { lines: (LineRef & Record<string, unknown>)[] },
>(client: DbClient, slip: T) {
  const sources = await resolveLineSources(client, slip.lines);
  return {
    ...slip,
    lines: slip.lines.map((line) => ({ ...line, source: sources.get(line.sourceId) ?? null })),
  };
}

const NARRATION_DETAIL_MAX = 400;

/**
 * One-line description of what a slip pays for, for voucher narrations:
 * "MH19AB1234: LR-1, LR-2; MH04CD5678: LR-7". Hamali slips list their
 * GRN / rake / gate labels.
 */
export async function describeSlipSources(
  client: DbClient,
  slipId: string,
): Promise<string | null> {
  const lines = await client.vendorPaymentSlipLine.findMany({
    where: { slipId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { sourceType: true, sourceId: true },
  });
  if (lines.length === 0) return null;

  const sources = await resolveLineSources(client, lines);
  const parts = lines.flatMap((line) => {
    const source = sources.get(line.sourceId);
    if (!source) return [];
    if (source.lrs.length === 0) return [source.label];
    const lrNumbers = source.lrs.map((lr) => lr.lrNumber).join(", ");
    return [source.vehicleNumber ? `${source.vehicleNumber}: ${lrNumbers}` : lrNumbers];
  });
  const detail = parts.join("; ");
  return detail.length > NARRATION_DETAIL_MAX
    ? `${detail.slice(0, NARRATION_DETAIL_MAX - 1)}…`
    : detail || null;
}
