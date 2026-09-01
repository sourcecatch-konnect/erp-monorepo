import { Router, type Request } from "express";
import { PERMS } from "@skerp/types";
import {
  calculateRailRakeOperationSchema,
  createRailRakeOperationSchema,
  submitRailRakeOperationSchema,
  updateRailRakeOperationSchema,
  type CalculateRailRakeOperationInput,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import type {
  Prisma,
  RailRakeChargeStatus,
  RailRakeOperationStage,
  RailRakeOperationStatus,
} from "../../../generated/prisma/index.js";
import { assertBranchAccess } from "../../auth/branch-scope.js";
import { canAny } from "../../auth/can.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { rupeesToPaise } from "../../lib/money.js";
import { parseListQuery } from "../_shared/list.query.js";
import { getParamId } from "../_shared/param.js";
import { sendOk } from "../_shared/response.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: Request) => {
  const id = req.user?.userId;
  if (!id) throw new BadRequestError("User context is missing");
  return id;
};

const branchSelect = {
  id: true,
  name: true,
  branchCode: true,
} satisfies Prisma.BranchSelect;

const areaSelect = {
  id: true,
  name: true,
  formattedAddress: true,
} satisfies Prisma.AreaSelect;

const operationInclude = {
  branch: { select: branchSelect },
  area: { select: areaSelect },
  railRake: {
    include: {
      fromBranch: { select: branchSelect },
      toBranch: { select: branchSelect },
      vpSchedule: {
        include: {
          sourceArea: { select: areaSelect },
          destinationArea: { select: areaSelect },
        },
      },
    },
  },
  placements: {
    orderBy: { sequence: "asc" },
  },
  charges: {
    orderBy: { type: "asc" },
    include: {
      waivers: { orderBy: { sequence: "asc" } },
      payments: { orderBy: { paymentAt: "asc" } },
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  submittedBy: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
} satisfies Prisma.RailRakeOperationInclude;

type OperationInput = CalculateRailRakeOperationInput;

const operationStages = new Set<RailRakeOperationStage>([
  "ORIGIN_RAILHEAD",
  "DESTINATION_BRANCH",
]);
const operationStatuses = new Set<RailRakeOperationStatus>([
  "DRAFT",
  "SUBMITTED",
  "CANCELLED",
]);
type OperationPermissionAction =
  | "VIEW"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "SUBMIT";

const operationPermission = (
  stage: RailRakeOperationStage,
  action: OperationPermissionAction,
) =>
  stage === "ORIGIN_RAILHEAD"
    ? PERMS.RAKE_AT_RAIL_HEAD[action]
    : PERMS.RAKE_AT_BRANCH[action];

const assertOperationPermission = (
  req: Request,
  stage: RailRakeOperationStage,
  action: OperationPermissionAction,
) => {
  const permission = operationPermission(stage, action);
  if (!req.ctx?.permissions.has(permission)) {
    throw new ForbiddenError(
      `Missing permission for ${
        stage === "ORIGIN_RAILHEAD" ? "Rake at Rail Head" : "Rake at Branch"
      }`,
    );
  }
};

const minutesBetween = (start: Date, end?: Date) =>
  end ? Math.max(Math.ceil((end.getTime() - start.getTime()) / 60_000), 0) : 0;

const toPaise = (value?: number) =>
  BigInt(rupeesToPaise(value === undefined ? 0 : value));

const calculateOperation = (input: OperationInput) => {
  const placements = [...input.placements]
    .sort((a, b) => a.sequence - b.sequence)
    .map((placement) => {
      const actualMinutes = minutesBetween(
        placement.placedAt,
        placement.removedAt,
      );
      const freeMinutes = Math.min(placement.freeMinutes, actualMinutes);
      return {
        ...placement,
        actualMinutes,
        freeMinutes,
        chargeableMinutes: Math.max(actualMinutes - freeMinutes, 0),
      };
    });

  const actualMinutes = placements.reduce(
    (total, item) => total + item.actualMinutes,
    0,
  );
  const freeMinutes = placements.reduce(
    (total, item) => total + item.freeMinutes,
    0,
  );
  const chargeableMinutes = placements.reduce(
    (total, item) => total + item.chargeableMinutes,
    0,
  );

  const charges = input.charges.map((charge) => {
    const ratePerHourPaise = toPaise(charge.ratePerHour);
    const billableHours =
      charge.type === "DEMURRAGE"
        ? placements.reduce(
            (total, placement) =>
              total + Math.ceil(placement.chargeableMinutes / 60),
            0,
          )
        : 0;
    const hasManualDemurrageAmount =
      charge.type === "DEMURRAGE" && charge.manualAmount !== undefined;
    const grossAmountPaise =
      charge.type === "DEMURRAGE"
        ? hasManualDemurrageAmount
          ? toPaise(charge.manualAmount)
          : BigInt(billableHours) * ratePerHourPaise
        : toPaise(charge.manualAmount);

    const waiver =
      charge.type === "DEMURRAGE" && charge.waiver?.enabled
        ? charge.waiver
        : undefined;
    let waiverAmountPaise = 0n;
    if (
      waiver &&
      (waiver.status === "APPROVED" || waiver.status === "RECEIVED")
    ) {
      if (waiver.approvedAmount !== undefined) {
        waiverAmountPaise = toPaise(waiver.approvedAmount);
      } else if (waiver.waiverPercentage !== undefined) {
        waiverAmountPaise =
          (grossAmountPaise *
            BigInt(Math.round(waiver.waiverPercentage * 100))) /
          10_000n;
      }
    }
    waiverAmountPaise =
      waiverAmountPaise > grossAmountPaise
        ? grossAmountPaise
        : waiverAmountPaise;

    const netPayableAmountPaise = grossAmountPaise - waiverAmountPaise;
    const payment = charge.payment?.enabled ? charge.payment : undefined;
    const paidAmountPaise =
      payment?.kind === "CHARGE_PAYMENT" && payment.status === "CONFIRMED"
        ? toPaise(payment.amount)
        : 0n;
    if (paidAmountPaise > netPayableAmountPaise) {
      throw new BadRequestError(
        `${charge.type} confirmed payment cannot exceed its net payable amount`,
      );
    }
    const effectivePaid =
      paidAmountPaise > netPayableAmountPaise
        ? netPayableAmountPaise
        : paidAmountPaise;
    const balanceAmountPaise = netPayableAmountPaise - effectivePaid;

    const status: RailRakeChargeStatus =
      grossAmountPaise === 0n || balanceAmountPaise === 0n
        ? waiverAmountPaise === grossAmountPaise && grossAmountPaise > 0n
          ? "WAIVED"
          : "SETTLED"
        : effectivePaid > 0n
          ? "PARTIALLY_SETTLED"
          : "ASSESSED";

    return {
      input: charge,
      calculation: {
        actualMinutes,
        freeMinutes,
        chargeableMinutes,
        billableHours,
        ratePerHourPaise,
        grossAmountPaise,
        waiverAmountPaise,
        netPayableAmountPaise,
        paidAmountPaise: effectivePaid,
        balanceAmountPaise,
        calculationVersion: 1,
        calculationCode:
          charge.type === "DEMURRAGE"
            ? hasManualDemurrageAmount
              ? "MANUAL_DEMURRAGE_OVERRIDE_V1"
              : "PER_RAKE_HOURLY_CEILING_V1"
            : "MANUAL_WHARFAGE_V1",
        status,
      },
    };
  });

  return { placements, charges };
};

const publicCalculation = (input: OperationInput) => {
  const result = calculateOperation(input);
  return result.charges.map(({ input: charge, calculation }) => ({
    type: charge.type,
    actualMinutes: calculation.actualMinutes,
    freeMinutes: calculation.freeMinutes,
    chargeableMinutes: calculation.chargeableMinutes,
    billableHours: calculation.billableHours,
    ratePerHourPaise: Number(calculation.ratePerHourPaise),
    grossAmountPaise: Number(calculation.grossAmountPaise),
    waiverAmountPaise: Number(calculation.waiverAmountPaise),
    netPayableAmountPaise: Number(calculation.netPayableAmountPaise),
    paidAmountPaise: Number(calculation.paidAmountPaise),
    balanceAmountPaise: Number(calculation.balanceAmountPaise),
    calculationVersion: calculation.calculationVersion,
    calculationCode: calculation.calculationCode,
  }));
};

const nestedOperationData = (input: OperationInput, userId: string) => {
  const result = calculateOperation(input);

  return {
    arrivalAt: input.arrivalAt ?? null,
    departureAt: input.departureAt ?? null,
    remarks: input.remarks ?? null,
    placements: {
      create: result.placements.map((placement) => ({
        sequence: placement.sequence,
        placedAt: placement.placedAt,
        removedAt: placement.removedAt ?? null,
        actualMinutes: placement.actualMinutes,
        freeMinutes: placement.freeMinutes,
        chargeableMinutes: placement.chargeableMinutes,
        calculationVersion: 1,
        calculationCode: "PLACEMENT_MINUTES_V1",
        remarks: placement.remarks ?? null,
      })),
    },
    charges: {
      create: result.charges.map(({ input: charge, calculation }) => {
        const waiver =
          charge.type === "DEMURRAGE" && charge.waiver?.enabled
            ? charge.waiver
            : undefined;
        const payment = charge.payment?.enabled ? charge.payment : undefined;
        return {
          type: charge.type,
          status: calculation.status,
          actualMinutes: calculation.actualMinutes,
          freeMinutes: calculation.freeMinutes,
          chargeableMinutes: calculation.chargeableMinutes,
          ratePerHour:
            charge.type === "DEMURRAGE" ? calculation.ratePerHourPaise : null,
          grossAmount: calculation.grossAmountPaise,
          approvedWaiverAmount: calculation.waiverAmountPaise,
          netPayableAmount: calculation.netPayableAmountPaise,
          paidAmount: calculation.paidAmountPaise,
          balanceAmount: calculation.balanceAmountPaise,
          chargeLetterDate: charge.chargeLetterDate ?? null,
          paymentBy: charge.paymentBy ?? null,
          calculationVersion: calculation.calculationVersion,
          calculationCode: calculation.calculationCode,
          remarks: charge.remarks ?? null,
          createdBy: { connect: { id: userId } },
          ...(waiver
            ? {
                waivers: {
                  create: {
                    sequence: 1,
                    status: waiver.status,
                    letterGivenAt: waiver.letterGivenAt ?? null,
                    letterApprovedAt: waiver.letterApprovedAt ?? null,
                    letterReceivedAt: waiver.letterReceivedAt ?? null,
                    waiverPercentage:
                      waiver.waiverPercentage === undefined
                        ? null
                        : waiver.waiverPercentage,
                    requestedAmount:
                      waiver.requestedAmount === undefined
                        ? null
                        : toPaise(waiver.requestedAmount),
                    approvedAmount:
                      waiver.approvedAmount === undefined
                        ? null
                        : toPaise(waiver.approvedAmount),
                    referenceNumber: waiver.referenceNumber ?? null,
                    remarks: waiver.remarks ?? null,
                    createdBy: { connect: { id: userId } },
                    approvedBy:
                      waiver.status === "APPROVED" ||
                      waiver.status === "RECEIVED"
                        ? { connect: { id: userId } }
                        : undefined,
                  },
                },
              }
            : {}),
          ...(payment
            ? {
                payments: {
                  create: {
                    kind: payment.kind,
                    status: payment.status,
                    amount: toPaise(payment.amount),
                    paymentBy: payment.paymentBy,
                    paymentMode: payment.paymentMode,
                    paymentAt: payment.paymentAt as Date,
                    referenceNumber: payment.referenceNumber ?? null,
                    remarks: payment.remarks ?? null,
                    createdBy: { connect: { id: userId } },
                    ...(payment.status === "CONFIRMED"
                      ? { confirmedBy: { connect: { id: userId } } }
                      : {}),
                    confirmedAt:
                      payment.status === "CONFIRMED" ? new Date() : null,
                  },
                },
              }
            : {}),
        };
      }),
    },
  };
};

const operationBranchFilter = (
  req: Request,
): Prisma.RailRakeOperationWhereInput =>
  req.ctx?.branchScope === "ALL"
    ? {}
    : { branchId: { in: req.ctx?.branchIds ?? [] } };

const getOperation = async (req: Request, id: string) => {
  const operation = await db.railRakeOperation.findFirst({
    where: { id, ...operationBranchFilter(req) },
    include: operationInclude,
  });
  if (!operation) throw new NotFoundError("Rake operation not found");
  return operation;
};

const getRakeContext = async (
  req: Request,
  railRakeId: string,
  stage: RailRakeOperationStage,
) => {
  const rake = await db.railRake.findUnique({
    where: { id: railRakeId },
    include: {
      fromBranch: { select: branchSelect },
      toBranch: { select: branchSelect },
      vpSchedule: {
        include: {
          sourceArea: { select: areaSelect },
          destinationArea: { select: areaSelect },
        },
      },
    },
  });
  if (!rake) throw new NotFoundError("Rail Rake not found");

  const branch = stage === "ORIGIN_RAILHEAD" ? rake.fromBranch : rake.toBranch;
  const area =
    stage === "ORIGIN_RAILHEAD"
      ? rake.vpSchedule.sourceArea
      : rake.vpSchedule.destinationArea;
  assertBranchAccess(req, branch.id);

  return { rake, branch, area };
};

router.get(
  "/options/rakes",
  canAny(PERMS.RAKE_AT_RAIL_HEAD.CREATE, PERMS.RAKE_AT_BRANCH.CREATE),
  async (req, res) => {
    const stage =
      typeof req.query.stage === "string"
        ? req.query.stage.toUpperCase()
        : undefined;
    if (
      !stage ||
      (stage !== "ORIGIN_RAILHEAD" && stage !== "DESTINATION_BRANCH")
    ) {
      throw new BadRequestError("Invalid Rake operation stage");
    }
    assertOperationPermission(req, stage as RailRakeOperationStage, "CREATE");

    const scope =
      req.ctx?.branchScope === "ALL"
        ? {}
        : stage === "ORIGIN_RAILHEAD"
          ? { fromBranchId: { in: req.ctx?.branchIds ?? [] } }
          : stage === "DESTINATION_BRANCH"
            ? { toBranchId: { in: req.ctx?.branchIds ?? [] } }
            : {
                OR: [
                  { fromBranchId: { in: req.ctx?.branchIds ?? [] } },
                  { toBranchId: { in: req.ctx?.branchIds ?? [] } },
                ],
              };

    const rakes = await db.railRake.findMany({
      where: scope,
      include: {
        fromBranch: { select: branchSelect },
        toBranch: { select: branchSelect },
        vpSchedule: {
          include: {
            sourceArea: { select: areaSelect },
            destinationArea: { select: areaSelect },
          },
        },
        operations: { select: { stage: true } },
      },
      orderBy: { generatedAt: "desc" },
      take: 500,
    });

    const options = rakes.flatMap((rake) => {
      const candidateStages: RailRakeOperationStage[] = stage
        ? [stage as RailRakeOperationStage]
        : ["ORIGIN_RAILHEAD", "DESTINATION_BRANCH"];

      const resolvedStage = candidateStages.find((candidate) => {
        if (rake.operations.some((row) => row.stage === candidate)) {
          return false;
        }
        if (req.ctx?.branchScope === "ALL") return true;
        const branchId =
          candidate === "ORIGIN_RAILHEAD" ? rake.fromBranchId : rake.toBranchId;
        return (req.ctx?.branchIds ?? []).includes(branchId);
      });

      if (!resolvedStage) return [];

      return [
        {
          id: rake.id,
          rakeNumber: rake.rakeNumber,
          status: rake.status,
          stage: resolvedStage,
          scheduleNumber: rake.vpSchedule.scheduleNumber,
          scheduleDate: rake.vpSchedule.scheduleDate,
          branch:
            resolvedStage === "ORIGIN_RAILHEAD"
              ? rake.fromBranch
              : rake.toBranch,
          area:
            resolvedStage === "ORIGIN_RAILHEAD"
              ? rake.vpSchedule.sourceArea
              : rake.vpSchedule.destinationArea,
          fromBranch: rake.fromBranch,
          toBranch: rake.toBranch,
          sourceArea: rake.vpSchedule.sourceArea,
          destinationArea: rake.vpSchedule.destinationArea,
        },
      ];
    });

    return sendOk(res, options);
  },
);

router.post(
  "/calculate",
  canAny(
    PERMS.RAKE_AT_RAIL_HEAD.CREATE,
    PERMS.RAKE_AT_RAIL_HEAD.UPDATE,
    PERMS.RAKE_AT_BRANCH.CREATE,
    PERMS.RAKE_AT_BRANCH.UPDATE,
  ),
  async (req, res) => {
    const parsed = calculateRailRakeOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    return sendOk(res, publicCalculation(parsed.data));
  },
);

router.get(
  "/",
  canAny(PERMS.RAKE_AT_RAIL_HEAD.VIEW, PERMS.RAKE_AT_BRANCH.VIEW),
  async (req, res) => {
    const query = parseListQuery(req);
    const stage = query.filter.stage?.toUpperCase();
    const status = query.filter.status?.toUpperCase();
    if (!stage || !operationStages.has(stage as RailRakeOperationStage)) {
      throw new BadRequestError("Invalid Rake operation stage");
    }
    assertOperationPermission(req, stage as RailRakeOperationStage, "VIEW");
    if (status && !operationStatuses.has(status as RailRakeOperationStatus)) {
      throw new BadRequestError("Invalid Rake operation status");
    }

    const where: Prisma.RailRakeOperationWhereInput = {
      ...operationBranchFilter(req),
      ...(stage ? { stage: stage as RailRakeOperationStage } : {}),
      ...(status ? { status: status as RailRakeOperationStatus } : {}),
      ...(query.search
        ? {
            OR: [
              {
                railRake: {
                  rakeNumber: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
              },
              {
                branch: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
              {
                area: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.railRakeOperation.findMany({
        where,
        include: operationInclude,
        skip: query.page * query.size,
        take: query.size,
        orderBy: { createdAt: "desc" },
      }),
      db.railRakeOperation.count({ where }),
    ]);

    return sendOk(res, rows, {
      page: query.page,
      size: query.size,
      total,
    });
  },
);

router.post(
  "/",
  canAny(PERMS.RAKE_AT_RAIL_HEAD.CREATE, PERMS.RAKE_AT_BRANCH.CREATE),
  async (req, res) => {
    const parsed = createRailRakeOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;
    assertOperationPermission(req, input.stage, "CREATE");
    const userId = actorId(req);
    const { branch, area } = await getRakeContext(
      req,
      input.railRakeId,
      input.stage,
    );

    const existing = await db.railRakeOperation.findUnique({
      where: {
        railRakeId_stage: {
          railRakeId: input.railRakeId,
          stage: input.stage,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError(
        "This Rake operation stage has already been created",
      );
    }

    const created = await db.railRakeOperation.create({
      data: {
        railRake: { connect: { id: input.railRakeId } },
        stage: input.stage,
        branch: { connect: { id: branch.id } },
        area: { connect: { id: area.id } },
        createdBy: { connect: { id: userId } },
        ...nestedOperationData(input, userId),
      },
      select: {
        id: true,
        status: true,
        version: true,
      },
    });

    return sendOk(res, created, undefined, 201);
  },
);

router.get(
  "/:id",
  canAny(PERMS.RAKE_AT_RAIL_HEAD.VIEW, PERMS.RAKE_AT_BRANCH.VIEW),
  async (req, res) => {
    const operation = await getOperation(req, getParamId(req));
    assertOperationPermission(req, operation.stage, "VIEW");
    return sendOk(res, operation);
  },
);

router.patch(
  "/:id",
  canAny(PERMS.RAKE_AT_RAIL_HEAD.UPDATE, PERMS.RAKE_AT_BRANCH.UPDATE),
  async (req, res) => {
    const parsed = updateRailRakeOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;
    const id = getParamId(req);
    const existing = await getOperation(req, id);
    assertOperationPermission(req, existing.stage, "UPDATE");
    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only a draft Rake operation can be edited");
    }
    if (existing.version !== input.version) {
      throw new ConflictError("Rake operation changed. Refresh before saving.");
    }
    const userId = actorId(req);

    const updated = await db.$transaction(async (tx) => {
      await tx.railRakeChargePayment.deleteMany({
        where: { charge: { operationId: id } },
      });
      await tx.railRakeChargeWaiver.deleteMany({
        where: { charge: { operationId: id } },
      });
      await tx.railRakeCharge.deleteMany({ where: { operationId: id } });
      await tx.railRakePlacement.deleteMany({ where: { operationId: id } });

      return tx.railRakeOperation.update({
        where: { id, version: existing.version },
        data: {
          updatedBy: { connect: { id: userId } },
          version: { increment: 1 },
          ...nestedOperationData(input, userId),
        },
        select: {
          id: true,
          status: true,
          version: true,
        },
      });
    });

    return sendOk(res, updated);
  },
);

router.post(
  "/:id/submit",
  canAny(PERMS.RAKE_AT_RAIL_HEAD.SUBMIT, PERMS.RAKE_AT_BRANCH.SUBMIT),
  async (req, res) => {
    const parsed = submitRailRakeOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const existing = await getOperation(req, getParamId(req));
    assertOperationPermission(req, existing.stage, "SUBMIT");
    if (existing.status === "SUBMITTED") {
      return sendOk(res, {
        id: existing.id,
        status: existing.status,
        version: existing.version,
      });
    }
    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only a draft Rake operation can be submitted");
    }
    if (existing.version !== parsed.data.version) {
      throw new ConflictError(
        "Rake operation changed. Refresh before submitting.",
      );
    }
    if (!existing.arrivalAt || !existing.departureAt) {
      throw new BadRequestError(
        "Arrival and departure are required before submission",
      );
    }
    if (
      !existing.placements.length ||
      existing.placements.some((placement) => !placement.removedAt)
    ) {
      throw new BadRequestError(
        "Every placement must have a removal time before submission",
      );
    }
    if (existing.charges.length !== 2) {
      throw new BadRequestError(
        "Demurrage and Wharfage records are required before submission",
      );
    }

    const submitted = await db.railRakeOperation.update({
      where: { id: existing.id, version: existing.version },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedById: actorId(req),
        updatedById: actorId(req),
        version: { increment: 1 },
      },
      select: {
        id: true,
        status: true,
        version: true,
      },
    });

    return sendOk(res, submitted);
  },
);

router.delete(
  "/:id",
  canAny(PERMS.RAKE_AT_RAIL_HEAD.DELETE, PERMS.RAKE_AT_BRANCH.DELETE),
  async (req, res) => {
    const existing = await getOperation(req, getParamId(req));
    assertOperationPermission(req, existing.stage, "DELETE");
    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only a draft Rake operation can be deleted");
    }
    await db.$transaction(async (tx) => {
      await tx.railRakeChargePayment.deleteMany({
        where: { charge: { operationId: existing.id } },
      });
      await tx.railRakeChargeWaiver.deleteMany({
        where: { charge: { operationId: existing.id } },
      });
      await tx.railRakeOperation.delete({ where: { id: existing.id } });
    });
    return sendOk(res, { id: existing.id, deleted: true });
  },
);

export default router;
