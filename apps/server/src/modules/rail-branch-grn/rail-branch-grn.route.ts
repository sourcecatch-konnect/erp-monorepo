import { Router } from "express";
import type { Request } from "express";
import { PERMS } from "@skerp/types";
import {
  createRailBranchGRNSchema,
  submitRailBranchGRNSchema,
  updateRailBranchGRNSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import type {
  Prisma,
  RailBranchGRNStatus,
} from "../../../generated/prisma/index.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess } from "../../auth/branch-scope.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { rupeesToPaise } from "../../lib/money.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import {
  branchSelect,
  labourSelect,
  userSelect,
} from "../vp-loading/vp-loading.service.js";
import { releaseActiveTrackerInTransaction } from "../one-lap-tracker/one-lap-tracker.assignment.service.js";

const router: Router = Router();
router.use(authMiddleware);

const branchGrnStatuses = new Set<RailBranchGRNStatus>(["DRAFT", "SUBMITTED"]);
const DAMAGE_PHOTO_ENTITY = "RAIL_BRANCH_GRN_DAMAGE";
const MAX_DAMAGE_PHOTO_BYTES = 2 * 1024 * 1024;

const actorId = (req: Request) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");
  return userId;
};

const getIdParam = (value: string | string[] | undefined, label: string) => {
  const id = decodeURIComponent(
    Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
  ).trim();
  if (!id) throw new BadRequestError(`${label} is required`);
  return id;
};

const destinationRakeFilter = (req: Request): Prisma.RailRakeWhereInput =>
  req.ctx?.branchScope === "ALL"
    ? {}
    : { toBranchId: { in: req.ctx?.branchIds ?? [] } };

const branchGrnFilter = (req: Request): Prisma.RailBranchGRNWhereInput => ({
  railRake: destinationRakeFilter(req),
});

const branchGrnListSelect = {
  id: true,
  status: true,
  totalLoadedQty: true,
  totalReceivedQty: true,
  totalDamageQty: true,
  totalShortageQty: true,
  inDateTime: true,
  outDateTime: true,
  submittedAt: true,
  version: true,
  createdAt: true,
  railRake: {
    select: {
      id: true,
      rakeNumber: true,
      status: true,
      fromBranch: { select: branchSelect },
      toBranch: { select: branchSelect },
      vpSchedule: {
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
        },
      },
    },
  },
  vpWagonLoading: {
    select: {
      id: true,
      status: true,
      mrRrRow: {
        select: {
          id: true,
          rowNumber: true,
          rowLabel: true,
          vpNo: true,
          mrRrNo: true,
          wagon: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.RailBranchGRNSelect;

const branchGrnDetailInclude = {
  railRake: {
    include: {
      fromBranch: { select: branchSelect },
      toBranch: { select: branchSelect },
      vpSchedule: {
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
          scheduleName: true,

          sourceArea: {
            select: {
              id: true,
              name: true,
            },
          },

          destinationArea: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  vpWagonLoading: {
    include: {
      mrRrRow: {
        include: {
          wagon: true,
        },
      },
    },
  },
  labourLeader: { select: labourSelect },
  unloadingSupervisor: { select: userSelect },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
  submittedBy: { select: userSelect },
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      vpLoadingGoods: {
        select: {
          id: true,
          loadingDamageQty: true,
          loadedWeightMt: true,
          loadedCft: true,
          grnGoods: {
            select: {
              id: true,
              goodsName: true,
              description: true,
              unit: true,
            },
          },
          vpLoading: {
            select: {
              id: true,
              loadingNumber: true,
              grn: {
                select: {
                  id: true,
                  grnNumber: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RailBranchGRNInclude;
const branchGrnSourceSelect = {
  id: true,
  status: true,
  totalLoadedQty: true,

  branchGrn: {
    select: {
      id: true,
      railRakeId: true,
      status: true,
    },
  },

  mrRrRow: {
    select: {
      id: true,
      rowNumber: true,
      rowLabel: true,
      vpNo: true,
      mrRrNo: true,

      wagon: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  allocations: {
    where: {
      status: "LOADED",
    },

    orderBy: {
      createdAt: "asc",
    },

    select: {
      id: true,
      loadingNumber: true,

      grn: {
        select: {
          id: true,
          grnNumber: true,

          lorryReceipt: {
            select: {
              id: true,
              lrNumber: true,

              group: {
                select: {
                  consignor: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },

                  consignee: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },

      goods: {
        orderBy: {
          createdAt: "asc",
        },

        select: {
          id: true,
          loadedQty: true,
          loadingDamageQty: true,

          grnGoods: {
            select: {
              id: true,
              goodsName: true,
              description: true,
              unit: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.VPWagonLoadingSelect;
type BranchGrnSourceLoading = Prisma.VPWagonLoadingGetPayload<{
  select: typeof branchGrnSourceSelect;
}>;

const mapSourceLines = (loading: BranchGrnSourceLoading) =>
  loading.allocations.flatMap((allocation) =>
    allocation.goods.map((goods) => ({
      vpLoadingGoodsId: goods.id,

      lrNumber: allocation.grn.lorryReceipt.lrNumber,
      grnNumber: allocation.grn.grnNumber,
      loadingNumber: allocation.loadingNumber,

      consignorName: allocation.grn.lorryReceipt.group.consignor.name,

      consigneeName: allocation.grn.lorryReceipt.group.consignee.name,

      goodsName: goods.grnGoods.goodsName,
      description: goods.grnGoods.description,
      unit: goods.grnGoods.unit,

      loadedQty: goods.loadedQty,
      loadingDamageQty: goods.loadingDamageQty,

      receivedQty: goods.loadedQty,
      damageQty: 0,
      shortageQty: 0,
      remarks: null,
    })),
  );

const getDamagePhotos = (branchGrnId: string) =>
  db.attachment.findMany({
    where: {
      entityType: DAMAGE_PHOTO_ENTITY,
      entityId: branchGrnId,
      deletedAt: null,
    },
    orderBy: { uploadedAt: "desc" },
  });

const withDamagePhotos = async <
  T extends {
    id: string;
  },
>(
  grn: T,
) => ({
  ...grn,
  damagePhotos: await getDamagePhotos(grn.id),
});

const validateDamagePhotoAttachments = async (
  branchGrnId: string,
  attachmentIds: string[],
) => {
  if (!attachmentIds.length) return;

  const uniqueIds = [...new Set(attachmentIds)];
  const attachments = await db.attachment.findMany({
    where: {
      id: { in: uniqueIds },
      entityType: DAMAGE_PHOTO_ENTITY,
      entityId: branchGrnId,
      deletedAt: null,
    },
  });

  if (attachments.length !== uniqueIds.length) {
    throw new BadRequestError(
      "One or more damage photos do not belong to this Branch GRN",
    );
  }

  for (const attachment of attachments) {
    if (!attachment.uploaded || attachment.antivirusStatus !== "CLEAN") {
      throw new BadRequestError("Damage photos must be uploaded and clean");
    }
    if (!attachment.mime.toLowerCase().startsWith("image/")) {
      throw new BadRequestError("Damage photos must be image files");
    }
    if (attachment.sizeBytes > MAX_DAMAGE_PHOTO_BYTES) {
      throw new BadRequestError("Damage photo must be less than 2 MB");
    }
  }
};

const getBranchGrn = async (req: Request, id: string) => {
  const grn = await db.railBranchGRN.findFirst({
    where: {
      id,
      ...branchGrnFilter(req),
    },
    include: branchGrnDetailInclude,
  });
  if (!grn) throw new NotFoundError("Rail Branch GRN not found");
  return withDamagePhotos(grn);
};

router.get(
  "/supervisors",
  can(PERMS.RAIL_BRANCH_GRN.VIEW),
  async (req, res) => {
    const railRakeId = getIdParam(
      req.query.railRakeId as string | string[] | undefined,
      "Rail Rake",
    );

    const rake = await db.railRake.findFirst({
      where: {
        OR: [{ id: railRakeId }, { rakeNumber: railRakeId }],
        ...destinationRakeFilter(req),
      },
      select: {
        id: true,
        toBranchId: true,
      },
    });

    if (!rake) {
      throw new NotFoundError("Rail Rake not found");
    }

    const supervisorRole = await db.role.findFirst({
      where: {
        name: "SuperVisor",
      },
      select: {
        id: true,
      },
    });

    if (!supervisorRole) {
      return sendOk(res, []);
    }

    const supervisors = await db.user.findMany({
      where: {
        status: true,
        roleId: supervisorRole.id,
        branchId: rake.toBranchId,
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
      },
      orderBy: {
        firstName: "asc",
      },
    });

    return sendOk(
      res,
      supervisors.map((user) => ({
        id: user.id,
        name:
          [user.firstName, user.middleName, user.lastName]
            .filter(Boolean)
            .join(" ") || user.email,
        email: user.email,
      })),
    );
  },
);

router.get("/preview", can(PERMS.RAIL_BRANCH_GRN.CREATE), async (req, res) => {
  const railRakeId = getIdParam(
    req.query.railRakeId as string | string[] | undefined,
    "Rail Rake",
  );

  const vpWagonLoadingId = getIdParam(
    req.query.vpWagonLoadingId as string | string[] | undefined,
    "VP Wagon Loading",
  );

  const rake = await db.railRake.findFirst({
    where: {
      OR: [
        {
          id: railRakeId,
        },
        {
          rakeNumber: railRakeId,
        },
      ],

      ...destinationRakeFilter(req),
    },

    select: {
      id: true,
      rakeNumber: true,
      status: true,
      vpScheduleId: true,
      toBranchId: true,

      fromBranch: {
        select: branchSelect,
      },

      toBranch: {
        select: branchSelect,
      },

      vpSchedule: {
        select: {
          id: true,
          scheduleNumber: true,
          scheduleName: true,
          scheduleDate: true,

          sourceArea: {
            select: {
              id: true,
              name: true,
            },
          },

          destinationArea: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!rake) {
    throw new NotFoundError("Rail Rake not found");
  }

  assertBranchAccess(req, rake.toBranchId);

  if (!["CREATED", "DISPATCHED", "UNLOADING"].includes(rake.status)) {
    throw new BadRequestError(
      "Branch GRN cannot be created after the Rail Rake has been fully received",
    );
  }

  const loading = await db.vPWagonLoading.findFirst({
    where: {
      id: vpWagonLoadingId,
      status: "VERIFIED",

      mrRrRow: {
        mrRr: {
          vpScheduleId: rake.vpScheduleId,
        },
      },
    },

    select: branchGrnSourceSelect,
  });

  if (!loading) {
    throw new NotFoundError(
      "Verified VP wagon does not belong to this Rail Rake",
    );
  }

  if (loading.branchGrn) {
    return sendOk(res, {
      alreadyExists: true,

      branchGrn: {
        id: loading.branchGrn.id,
        status: loading.branchGrn.status,
      },

      railRake: rake,
      vpWagonLoading: loading,
      items: [],
    });
  }

  const items = mapSourceLines(loading);

  if (!items.length) {
    throw new BadRequestError("VP wagon does not contain any loaded goods");
  }

  const totalLoadedQty = items.reduce(
    (total, item) => total + item.loadedQty,
    0,
  );

  if (totalLoadedQty !== loading.totalLoadedQty) {
    throw new ConflictError("VP wagon total does not match its loaded goods");
  }

  return sendOk(res, {
    alreadyExists: false,

    railRake: rake,

    vpWagonLoading: {
      id: loading.id,
      status: loading.status,
      totalLoadedQty: loading.totalLoadedQty,
      row: loading.mrRrRow,
    },

    totals: {
      totalLoadedQty,
      totalGoodsLines: items.length,
    },

    items,
  });
});

router.get("/", can(PERMS.RAIL_BRANCH_GRN.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const status = query.filter.status?.toUpperCase();
  if (status && !branchGrnStatuses.has(status as RailBranchGRNStatus)) {
    throw new BadRequestError("Invalid Branch GRN status");
  }

  const searchFilter: Prisma.RailBranchGRNWhereInput = query.search
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
          vpWagonLoading: {
            mrRrRow: {
              vpNo: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    }
    : {};

  const where: Prisma.RailBranchGRNWhereInput = {
    ...(status ? { status: status as RailBranchGRNStatus } : {}),
    AND: [branchGrnFilter(req), searchFilter],
  };

  const [grns, total] = await Promise.all([
    db.railBranchGRN.findMany({
      where,
      select: branchGrnListSelect,
      skip: query.page * query.size,
      take: query.size,
      orderBy: { createdAt: "desc" },
    }),
    db.railBranchGRN.count({ where }),
  ]);

  return sendOk(res, grns, {
    page: query.page,
    size: query.size,
    total,
  });
});
router.post(
  "/",
  can(PERMS.RAIL_BRANCH_GRN.CREATE),
  async (req, res) => {
    const parsed = createRailBranchGRNSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const input = parsed.data;
    const userId = actorId(req);

    /*
     * ========================================================
     * 1. FIND ACCESSIBLE RAKE OUTSIDE TRANSACTION
     * ========================================================
     */

    const accessibleRake = await db.railRake.findFirst({
      where: {
        OR: [
          {
            id: input.railRakeId,
          },
          {
            rakeNumber: input.railRakeId,
          },
        ],

        ...destinationRakeFilter(req),
      },

      select: {
        id: true,
        status: true,
        vpScheduleId: true,
        toBranchId: true,
      },
    });

    if (!accessibleRake) {
      throw new NotFoundError("Rail Rake not found");
    }

    assertBranchAccess(req, accessibleRake.toBranchId);

    if (
      !["CREATED", "DISPATCHED", "UNLOADING"].includes(
        accessibleRake.status,
      )
    ) {
      throw new BadRequestError(
        "Branch GRN cannot be created after the Rail Rake has been fully received",
      );
    }

    /*
     * ========================================================
     * 2. LOAD SOURCE WAGON OUTSIDE TRANSACTION
     * ========================================================
     */

    const loading = await db.vPWagonLoading.findFirst({
      where: {
        id: input.vpWagonLoadingId,
        status: "VERIFIED",

        mrRrRow: {
          mrRr: {
            vpScheduleId: accessibleRake.vpScheduleId,
          },
        },
      },

      select: branchGrnSourceSelect,
    });

    if (!loading) {
      throw new NotFoundError(
        "Verified VP wagon does not belong to this Rail Rake",
      );
    }

    /*
     * Return the existing GRN immediately.
     * Do not start a transaction for this.
     */

    if (loading.branchGrn) {
      if (loading.branchGrn.railRakeId !== accessibleRake.id) {
        throw new ConflictError(
          "VP wagon already belongs to another Branch GRN",
        );
      }

      const existingBranchGrn =
        await db.railBranchGRN.findUniqueOrThrow({
          where: {
            id: loading.branchGrn.id,
          },

          include: branchGrnDetailInclude,
        });

      return sendOk(
        res,
        {
          branchGrn: await withDamagePhotos(existingBranchGrn),
          alreadyExists: true,
        },
        undefined,
        200,
      );
    }

    /*
     * ========================================================
     * 3. VALIDATE SOURCE ITEMS OUTSIDE TRANSACTION
     * ========================================================
     */

    const sourceLines = mapSourceLines(loading);

    if (!sourceLines.length) {
      throw new BadRequestError(
        "VP wagon does not contain any loaded goods",
      );
    }

    const inputIds = input.items.map(
      (item) => item.vpLoadingGoodsId,
    );

    if (new Set(inputIds).size !== inputIds.length) {
      throw new BadRequestError(
        "The same goods source line cannot be submitted more than once",
      );
    }

    const sourceIds = new Set(
      sourceLines.map((item) => item.vpLoadingGoodsId),
    );

    if (
      inputIds.length !== sourceIds.size ||
      inputIds.some((id) => !sourceIds.has(id))
    ) {
      throw new BadRequestError(
        "Every loaded goods source line must be submitted exactly once",
      );
    }

    const inputBySourceId = new Map(
      input.items.map((item) => [
        item.vpLoadingGoodsId,
        item,
      ]),
    );

    const itemsToCreate = sourceLines.map((source) => {
      const submittedItem = inputBySourceId.get(
        source.vpLoadingGoodsId,
      );

      if (!submittedItem) {
        throw new BadRequestError(
          `${source.goodsName}: receiving information is missing`,
        );
      }

      const accountedQty =
        submittedItem.receivedQty +
        submittedItem.shortageQty;

      if (accountedQty > source.loadedQty) {
        throw new BadRequestError(
          `${source.goodsName}: received and shortage quantity cannot exceed loaded quantity`,
        );
      }

      if (
        submittedItem.damageQty >
        submittedItem.receivedQty
      ) {
        throw new BadRequestError(
          `${source.goodsName}: damage quantity cannot exceed received quantity`,
        );
      }

      return {
        vpLoadingGoodsId: source.vpLoadingGoodsId,

        lrNumberSnapshot: source.lrNumber,
        consignorNameSnapshot: source.consignorName,
        consigneeNameSnapshot: source.consigneeName,
        goodsNameSnapshot: source.goodsName,
        unitSnapshot: source.unit,

        loadedQty: source.loadedQty,
        receivedQty: submittedItem.receivedQty,
        damageQty: submittedItem.damageQty,
        shortageQty: submittedItem.shortageQty,

        remarks: submittedItem.remarks ?? null,
      };
    });

    /*
     * ========================================================
     * 4. VALIDATE LABOUR AND SUPERVISOR OUTSIDE TRANSACTION
     * ========================================================
     */

    const [labourLeader, unloadingSupervisor] =
      await Promise.all([
        input.labourLeaderId
          ? db.labour.findFirst({
            where: {
              id: input.labourLeaderId,
              branchId: accessibleRake.toBranchId,
            },

            select: {
              id: true,
            },
          })
          : Promise.resolve(null),

        input.unloadingSupervisorId
          ? db.user.findFirst({
            where: {
              id: input.unloadingSupervisorId,
              status: true,
              branchId: accessibleRake.toBranchId,
            },

            select: {
              id: true,
            },
          })
          : Promise.resolve(null),
      ]);

    if (input.labourLeaderId && !labourLeader) {
      throw new BadRequestError(
        "Labour leader must belong to the destination branch",
      );
    }

    if (
      input.unloadingSupervisorId &&
      !unloadingSupervisor
    ) {
      throw new BadRequestError(
        "Unloading supervisor must belong to the destination branch",
      );
    }

    /*
     * ========================================================
     * 5. CALCULATE TOTALS OUTSIDE TRANSACTION
     * ========================================================
     */

    const totals = itemsToCreate.reduce(
      (result, item) => {
        result.totalLoadedQty += item.loadedQty;
        result.totalReceivedQty += item.receivedQty;
        result.totalDamageQty += item.damageQty;
        result.totalShortageQty += item.shortageQty;

        return result;
      },
      {
        totalLoadedQty: 0,
        totalReceivedQty: 0,
        totalDamageQty: 0,
        totalShortageQty: 0,
      },
    );

    const unloadingMinutes =
      input.unloadingMinutes ??
      (input.inDateTime && input.outDateTime
        ? Math.max(
          0,
          Math.round(
            (input.outDateTime.getTime() -
              input.inDateTime.getTime()) /
            60_000,
          ),
        )
        : null);

    const labourCharge =
      input.labourCharge === undefined
        ? null
        : BigInt(rupeesToPaise(input.labourCharge));

    /*
     * ========================================================
     * 6. SHORT TRANSACTION
     * ========================================================
     *
     * Only:
     * - Lock rake
     * - Recheck status
     * - Recheck existing GRN
     * - Create GRN
     */

    const transactionResult = await db.$transaction(
      async (tx) => {
        /*
         * Keep your existing row lock.
         */

        await tx.$queryRaw`
          SELECT "id"
          FROM "RailRake"
          WHERE "id" = ${accessibleRake.id}
          FOR UPDATE
        `;

        /*
         * Recheck the fields that may have changed after the
         * validation outside the transaction.
         */

        const currentRake = await tx.railRake.findUnique({
          where: {
            id: accessibleRake.id,
          },

          select: {
            id: true,
            status: true,
            vpScheduleId: true,
          },
        });

        if (!currentRake) {
          throw new NotFoundError("Rail Rake not found");
        }

        if (
          !["CREATED", "DISPATCHED", "UNLOADING"].includes(
            currentRake.status,
          )
        ) {
          throw new BadRequestError(
            "Branch GRN cannot be created after the Rail Rake has been fully received",
          );
        }

        /*
         * Use a minimal select here.
         * Do not load source goods or full GRN details again.
         */

        const currentLoading =
          await tx.vPWagonLoading.findFirst({
            where: {
              id: input.vpWagonLoadingId,
              status: "VERIFIED",

              mrRrRow: {
                mrRr: {
                  vpScheduleId: currentRake.vpScheduleId,
                },
              },
            },

            select: {
              id: true,

              branchGrn: {
                select: {
                  id: true,
                  railRakeId: true,
                },
              },
            },
          });

        if (!currentLoading) {
          throw new NotFoundError(
            "Verified VP wagon does not belong to this Rail Rake",
          );
        }

        /*
         * Important concurrency recheck:
         *
         * Another request may have created the GRN after the
         * initial loading query but before this transaction
         * acquired the row lock.
         */

        if (currentLoading.branchGrn) {
          if (
            currentLoading.branchGrn.railRakeId !==
            currentRake.id
          ) {
            throw new ConflictError(
              "VP wagon already belongs to another Branch GRN",
            );
          }

          return {
            branchGrnId: currentLoading.branchGrn.id,
            alreadyExists: true,
          };
        }

        /*
         * Create the header and items atomically.
         *
         * Return only the ID. Do not use the large include
         * inside the transaction.
         */

        const createdBranchGrn =
          await tx.railBranchGRN.create({
            data: {
              railRakeId: currentRake.id,
              vpWagonLoadingId: currentLoading.id,

              status: "DRAFT",

              inDateTime: input.inDateTime ?? null,
              outDateTime: input.outDateTime ?? null,
              unloadingMinutes,

              damagesBy: input.damagesBy ?? "NONE",

              labourCount: input.labourCount ?? 0,
              labourLeaderId:
                input.labourLeaderId ?? null,

              labourCharge,

              unloadingSupervisorId:
                input.unloadingSupervisorId ?? null,

              remarks: input.remarks ?? null,

              totalLoadedQty: totals.totalLoadedQty,
              totalReceivedQty:
                totals.totalReceivedQty,
              totalDamageQty: totals.totalDamageQty,
              totalShortageQty:
                totals.totalShortageQty,

              createdById: userId,

              items: {
                create: itemsToCreate,
              },
            },

            select: {
              id: true,
            },
          });

        return {
          branchGrnId: createdBranchGrn.id,
          alreadyExists: false,
        };
      },
    );

    /*
     * ========================================================
     * 7. FETCH COMPLETE DETAILS AFTER TRANSACTION COMMIT
     * ========================================================
     */

    const branchGrn =
      await db.railBranchGRN.findUniqueOrThrow({
        where: {
          id: transactionResult.branchGrnId,
        },

        include: branchGrnDetailInclude,
      });

    const branchGrnWithPhotos =
      await withDamagePhotos(branchGrn);

    return sendOk(
      res,
      {
        branchGrn: branchGrnWithPhotos,
        alreadyExists:
          transactionResult.alreadyExists,
      },
      undefined,
      transactionResult.alreadyExists ? 200 : 201,
    );
  },
);
router.get("/:id", can(PERMS.RAIL_BRANCH_GRN.VIEW), async (req, res) => {
  const id = getIdParam(req.params.id, "Rail Branch GRN");
  return sendOk(res, await getBranchGrn(req, id));
});

router.patch("/:id", can(PERMS.RAIL_BRANCH_GRN.UPDATE), async (req, res) => {
  const id = getIdParam(req.params.id, "Rail Branch GRN");
  const parsed = updateRailBranchGRNSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const existing = await getBranchGrn(req, id);
  if (!["DRAFT", "SUBMITTED"].includes(existing.status)) {
    throw new BadRequestError(
      "Only a DRAFT or SUBMITTED Branch GRN can be updated",
    );
  }
  if (existing.version !== parsed.data.version) {
    throw new ConflictError(
      "Branch GRN changed. Please refresh before saving.",
    );
  }

  await validateDamagePhotoAttachments(
    existing.id,
    parsed.data.damagePhotoAttachmentIds,
  );

  const inputIds = new Set(parsed.data.items.map((item) => item.id));
  const existingIds = new Set(existing.items.map((item) => item.id));
  if (
    inputIds.size !== parsed.data.items.length ||
    inputIds.size !== existingIds.size ||
    [...inputIds].some((itemId) => !existingIds.has(itemId))
  ) {
    throw new BadRequestError(
      "Every Branch GRN source goods line must be provided exactly once",
    );
  }

  const sourceById = new Map(existing.items.map((item) => [item.id, item]));
  for (const item of parsed.data.items) {
    const source = sourceById.get(item.id)!;

    if (item.receivedQty + item.shortageQty > source.loadedQty) {
      throw new BadRequestError(
        `${source.goodsNameSnapshot}: received and shortage quantity cannot exceed loaded quantity`,
      );
    }

    if (item.damageQty > item.receivedQty) {
      throw new BadRequestError(
        `${source.goodsNameSnapshot}: damage quantity cannot exceed received quantity`,
      );
    }

    if (
      existing.status === "SUBMITTED" &&
      item.receivedQty + item.shortageQty !== source.loadedQty
    ) {
      throw new BadRequestError(
        `${source.goodsNameSnapshot}: received quantity plus shortage quantity must equal loaded quantity`,
      );
    }

    if (
      existing.status === "SUBMITTED" &&
      (item.damageQty > 0 || item.shortageQty > 0) &&
      !item.remarks?.trim()
    ) {
      throw new BadRequestError(
        `${source.goodsNameSnapshot}: reason is required for damage or shortage`,
      );
    }
  }

  if (parsed.data.labourLeaderId) {
    const labour = await db.labour.findFirst({
      where: {
        id: parsed.data.labourLeaderId,
        branchId: existing.railRake.toBranchId,
      },
      select: { id: true },
    });
    if (!labour) {
      throw new BadRequestError(
        "Labour leader must belong to the destination branch",
      );
    }
  }
  if (parsed.data.unloadingSupervisorId) {
    const supervisor = await db.user.findFirst({
      where: {
        id: parsed.data.unloadingSupervisorId,
        status: true,
        branchId: existing.railRake.toBranchId,
      },
      select: {
        id: true,
      },
    });

    if (!supervisor) {
      throw new BadRequestError(
        "Unloading supervisor must belong to the destination branch",
      );
    }
  }
  const totalReceivedQty = parsed.data.items.reduce(
    (total, item) => total + item.receivedQty,
    0,
  );
  const totalDamageQty = parsed.data.items.reduce(
    (total, item) => total + item.damageQty,
    0,
  );
  const totalShortageQty = parsed.data.items.reduce(
    (total, item) => total + item.shortageQty,
    0,
  );

  if (
    existing.status === "SUBMITTED" &&
    totalDamageQty > 0 &&
    (parsed.data.damagesBy ?? "NONE") === "NONE"
  ) {
    throw new BadRequestError(
      "Damages by is required when damage quantity is entered",
    );
  }

  if (existing.status === "SUBMITTED" && totalDamageQty > 0) {
    const damagePhotoCount = await db.attachment.count({
      where: {
        entityType: DAMAGE_PHOTO_ENTITY,
        entityId: existing.id,
        deletedAt: null,
        uploaded: true,
        antivirusStatus: "CLEAN",
      },
    });

    if (!damagePhotoCount) {
      throw new BadRequestError(
        "A photo is required when damage quantity is entered",
      );
    }
  }

  const unloadingMinutes =
    parsed.data.unloadingMinutes ??
    (parsed.data.inDateTime && parsed.data.outDateTime
      ? Math.max(
        0,
        Math.round(
          (parsed.data.outDateTime.getTime() -
            parsed.data.inDateTime.getTime()) /
          60_000,
        ),
      )
      : null);

  const updated = await db.$transaction(async (tx) => {
    await Promise.all(
      parsed.data.items.map((item) =>
        tx.railBranchGRNItem.update({
          where: { id: item.id, railBranchGrnId: existing.id },
          data: {
            receivedQty: item.receivedQty,
            damageQty: item.damageQty,
            shortageQty: item.shortageQty,
            remarks: item.remarks ?? null,
          },
        }),
      ),
    );

    return tx.railBranchGRN.update({
      where: { id: existing.id, version: existing.version },
      data: {
        inDateTime: parsed.data.inDateTime ?? null,
        outDateTime: parsed.data.outDateTime ?? null,
        unloadingMinutes,
        damagesBy: parsed.data.damagesBy ?? "NONE",
        labourCount: parsed.data.labourCount ?? 0,
        labourLeaderId: parsed.data.labourLeaderId ?? null,
        labourCharge:
          parsed.data.labourCharge === undefined
            ? null
            : BigInt(rupeesToPaise(parsed.data.labourCharge)),
        unloadingSupervisorId: parsed.data.unloadingSupervisorId ?? null,
        remarks: parsed.data.remarks ?? null,
        totalReceivedQty,
        totalDamageQty,
        totalShortageQty,
        updatedById: actorId(req),
        version: { increment: 1 },
      },
      include: branchGrnDetailInclude,
    });
  });

  return sendOk(res, await withDamagePhotos(updated));
});

router.post(
  "/:id/submit",
  can(PERMS.RAIL_BRANCH_GRN.SUBMIT),
  async (req, res) => {
    const id = getIdParam(req.params.id, "Rail Branch GRN");
    const parsed = submitRailBranchGRNSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const accessible = await db.railBranchGRN.findFirst({
      where: { id, ...branchGrnFilter(req) },
      select: { id: true, railRakeId: true },
    });
    if (!accessible) throw new NotFoundError("Rail Branch GRN not found");

    await validateDamagePhotoAttachments(
      accessible.id,
      parsed.data.damagePhotoAttachmentIds,
    );

    const userId = actorId(req);
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`
      SELECT "id"
      FROM "RailRake"
      WHERE "id" = ${accessible.railRakeId}
      FOR UPDATE
    `;

      const grn = await tx.railBranchGRN.findUnique({
        where: { id: accessible.id },
        include: {
          items: true,
          railRake: {
            select: {
              id: true,
              rakeNumber: true,
              status: true,
              vpScheduleId: true,
            },
          },
        },
      });
      if (!grn) throw new NotFoundError("Rail Branch GRN not found");

      if (grn.status === "SUBMITTED") {
        const detail = await tx.railBranchGRN.findUniqueOrThrow({
          where: { id: grn.id },
          include: branchGrnDetailInclude,
        });
        return {
          branchGrn: detail,
          railRakeStatus: grn.railRake.status,
          alreadySubmitted: true,
        };
      }
      if (grn.status !== "DRAFT") {
        throw new BadRequestError("Only a DRAFT Branch GRN can be submitted");
      }
      if (grn.version !== parsed.data.version) {
        throw new ConflictError(
          "Branch GRN changed. Please refresh before submitting.",
        );
      }
      if (!grn.items.length) {
        throw new BadRequestError("Branch GRN has no source goods lines");
      }
      if (grn.labourCount < 1) {
        throw new BadRequestError("Number of labour must be at least 1");
      }
      if (grn.labourCharge === null) {
        throw new BadRequestError("Labour charge is required");
      }
      if (!grn.unloadingSupervisorId) {
        throw new BadRequestError("Unloading supervisor is required");
      }

      for (const item of grn.items) {
        if (item.receivedQty + item.shortageQty !== item.loadedQty) {
          throw new BadRequestError(
            `${item.goodsNameSnapshot}: received quantity plus shortage quantity must equal loaded quantity`,
          );
        }
        if (item.damageQty > item.receivedQty) {
          throw new BadRequestError(
            `${item.goodsNameSnapshot}: damage quantity cannot exceed received quantity`,
          );
        }
        if (
          (item.damageQty > 0 || item.shortageQty > 0) &&
          !item.remarks?.trim()
        ) {
          throw new BadRequestError(
            `${item.goodsNameSnapshot}: reason is required for damage or shortage`,
          );
        }
      }

      if (grn.totalDamageQty > 0 && grn.damagesBy === "NONE") {
        throw new BadRequestError(
          "Damages by is required when damage quantity is entered",
        );
      }

      if (grn.totalDamageQty > 0) {
        const damagePhotoCount = await tx.attachment.count({
          where: {
            entityType: DAMAGE_PHOTO_ENTITY,
            entityId: grn.id,
            deletedAt: null,
            uploaded: true,
            antivirusStatus: "CLEAN",
          },
        });

        if (!damagePhotoCount) {
          throw new BadRequestError(
            "A photo is required when damage quantity is entered",
          );
        }
      }

      const submittedAt = new Date();
      const submitted = await tx.railBranchGRN.update({
        where: { id: grn.id, version: grn.version },
        data: {
          status: "SUBMITTED",
          submittedAt,
          submittedById: userId,
          updatedById: userId,
          version: { increment: 1 },
        },
        include: branchGrnDetailInclude,
      });

      const [verifiedWagonCount, submittedGrnCount] = await Promise.all([
        tx.vPWagonLoading.count({
          where: {
            status: "VERIFIED",
            mrRrRow: {
              mrRr: { vpScheduleId: grn.railRake.vpScheduleId },
            },
          },
        }),
        tx.railBranchGRN.count({
          where: {
            railRakeId: grn.railRake.id,
            status: "SUBMITTED",
          },
        }),
      ]);

      const allReceived =
        verifiedWagonCount > 0 && submittedGrnCount === verifiedWagonCount;
      const rake = await tx.railRake.update({
        where: { id: grn.railRake.id },
        data: allReceived
          ? {
            status: "RECEIVED",
            receivedAt: submittedAt,
            version: { increment: 1 },
          }
          : ["CREATED", "DISPATCHED"].includes(grn.railRake.status)
            ? {
              status: "UNLOADING",
              unloadingStartedAt: submittedAt,
              version: { increment: 1 },
            }
            : { version: { increment: 1 } },
        select: {
          id: true,
          rakeNumber: true,
          status: true,
          receivedAt: true,
          version: true,
        },
      });

      if (allReceived) {
        await releaseActiveTrackerInTransaction(
          tx,
          grn.railRake.vpScheduleId,
          {
            userId,
            reason: "RAKE_RECEIVED",
            releasedAt: submittedAt,
            remarks: `Rake ${grn.railRake.rakeNumber} received`,
          },
        );
      }

      return {
        branchGrn: submitted,
        railRake: rake,
        progress: {
          verifiedWagonCount,
          submittedGrnCount,
          allReceived,
        },
        alreadySubmitted: false,
      };
    });

    return sendOk(res, {
      ...result,
      branchGrn: await withDamagePhotos(result.branchGrn),
    });
  },
);
router.delete("/:id", can(PERMS.RAIL_BRANCH_GRN.DELETE), async (req, res) => {
  const id = getIdParam(req.params.id, "Rail Branch GRN");

  const existing = await db.railBranchGRN.findFirst({
    where: {
      id,
      ...branchGrnFilter(req),
    },

    select: {
      id: true,
      status: true,
      railRakeId: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Rail Branch GRN not found");
  }

  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a DRAFT Branch GRN can be deleted");
  }
  await db.$transaction(async (tx) => {
    await tx.railBranchGRNItem.deleteMany({
      where: {
        railBranchGrnId: existing.id,
      },
    });

    await tx.railBranchGRN.delete({
      where: {
        id: existing.id,
      },
    });
  });

  return sendOk(res, {
    id: existing.id,
    deleted: true,
  });
});
export default router;
