import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createBranchSchema,
  updateBranchSchema,
  updateBranchRailheadsSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";
import { BadRequestError } from "../../lib/error.js";
import { NotFoundError, ValidationError } from "../../lib/error.js";
import { can, canAny } from "../../auth/can.middleware.js";
import { getParamId } from "../_shared/param.js";
import { sendOk } from "../_shared/response.js";

const plural = (count: number, singular: string, pluralName?: string) =>
  `${count} ${count === 1 ? singular : (pluralName ?? `${singular}s`)}`;

const router: Router = createCrudRouter({
  model: db.branch,
  createSchema: createBranchSchema as ZodTypeAny,
  updateSchema: updateBranchSchema as ZodTypeAny,
  permissionKey: "masters.branch",

  hooks: {
    beforeDelete: async (id) => {
      const [
        branch,
        users,
        userBranches,
        warehouses,
        agreements,
        workers,
        fromOrders,
        toOrders,
        originLRs,
        destinationLRs,
        hubLRs,
        railheadLRs,
        attachments,
      ] = await Promise.all([
        db.branch.findUnique({
          where: { id },
          select: {
            isHeadOffice: true,
          },
        }),

        db.user.count({
          where: { branchId: id },
        }),

        db.userBranch.count({
          where: { branchId: id },
        }),

        db.warehouse.count({
          where: { branchId: id },
        }),

        db.agreement.count({
          where: { leadGeneratedByBranchId: id },
        }),

        db.labour.count({
          where: { branchId: id },
        }),

        db.order.count({
          where: { fromBranchId: id },
        }),

        db.order.count({
          where: { toBranchId: id },
        }),

        db.lRGroup.count({
          where: { originBranchId: id },
        }),

        db.lRGroup.count({
          where: { destinationBranchId: id },
        }),

        db.lRGroup.count({
          where: { hubId: id },
        }),

        db.lRGroup.count({
          where: { railheadBranchId: id },
        }),

        db.attachment.count({
          where: { branchId: id },
        }),
      ]);

      if (!branch) {
        throw new BadRequestError("Branch not found.");
      }

      if (branch.isHeadOffice) {
        throw new BadRequestError(
          "This branch is marked as Head Office and cannot be deleted.",
        );
      }

      const dependencies: string[] = [];

      if (users) dependencies.push(plural(users, "user"));

      if (userBranches) {
        dependencies.push(plural(userBranches, "user branch access record"));
      }

      if (warehouses) {
        dependencies.push(plural(warehouses, "warehouse"));
      }

      if (agreements) {
        dependencies.push(plural(agreements, "agreement"));
      }

      if (workers) {
        dependencies.push(plural(workers, "worker"));
      }

      if (fromOrders) {
        dependencies.push(`${plural(fromOrders, "order")} as origin`);
      }

      if (toOrders) {
        dependencies.push(`${plural(toOrders, "order")} as destination`);
      }

      if (originLRs) {
        dependencies.push(`${plural(originLRs, "LR")} as origin`);
      }

      if (destinationLRs) {
        dependencies.push(`${plural(destinationLRs, "LR")} as destination`);
      }

      if (hubLRs) {
        dependencies.push(`${plural(hubLRs, "LR")} as hub`);
      }

      if (railheadLRs) {
        dependencies.push(`${plural(railheadLRs, "LR")} as railhead`);
      }

      if (attachments) {
        dependencies.push(plural(attachments, "attachment"));
      }

      if (dependencies.length) {
        throw new BadRequestError(
          `This branch cannot be deleted because it is linked with ${dependencies.join(
            ", ",
          )}. Please remove or update those records first.`,
        );
      }
    },
  },

  uniqueErrorMessages: {
    branchCode: "This branch code already exists.",
  },

  listOptions: {
    searchableFields: [
      "branchCode",
      "name",
      "address",
      "contactName",
      "contactPhone",
      "email",
      "gstNo",
    ],

    defaultInclude: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      city: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
});

const branchRailheadInclude = {
  area: {
    select: {
      id: true,
      name: true,
      cityId: true,
      isRailHead: true,
      city: { select: { id: true, name: true } },
    },
  },
} as const;

router.get(
  "/:id/railheads",
  canAny(
    "masters.branch.view",
    PERMS.VP_SCHEDULE.VIEW,
    PERMS.VP_SCHEDULE.CREATE,
    PERMS.VP_SCHEDULE.UPDATE,
    PERMS.LORRY_RECEIPT.CREATE,
    PERMS.LORRY_RECEIPT.UPDATE,
  ),
  async (req, res) => {
    const branchId = getParamId(req);
    const branch = await db.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError("Branch not found");

    const railheads = await db.branchRailheadArea.findMany({
      where: { branchId, isActive: true },
      include: branchRailheadInclude,
      orderBy: [{ area: { city: { name: "asc" } } }, { area: { name: "asc" } }],
    });

    return sendOk(res, railheads);
  },
);

router.put("/:id/railheads", can("masters.branch.update"), async (req, res) => {
  const branchId = getParamId(req);
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });
  if (!branch) throw new NotFoundError("Branch not found");

  const parsed = updateBranchRailheadsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const areaIds = [...new Set(parsed.data.areaIds)];
  const areas = areaIds.length
    ? await db.area.findMany({
        where: { id: { in: areaIds }, isRailHead: true },
        select: { id: true },
      })
    : [];

  if (areas.length !== areaIds.length) {
    throw new BadRequestError(
      "Every managed railhead must be an Area marked as Rail Head",
    );
  }

  const removedMappings = await db.branchRailheadArea.findMany({
    where: {
      branchId,
      isActive: true,
      ...(areaIds.length ? { areaId: { notIn: areaIds } } : {}),
    },
    select: { areaId: true, area: { select: { name: true } } },
  });

  for (const mapping of removedMappings) {
    const [vpSchedules, lrGroups] = await Promise.all([
      db.vPSchedule.count({
        where: {
          deletedAt: null,
          status: { not: "CANCELLED" },
          OR: [
            { fromBranchId: branchId, sourceAreaId: mapping.areaId },
            { toBranchId: branchId, destinationAreaId: mapping.areaId },
          ],
        },
      }),
      db.lRGroup.count({
        where: {
          deletedAt: null,
          status: { not: "CANCELLED" },
          OR: [
            {
              railheadBranchId: branchId,
              sourceRailheadAreaId: mapping.areaId,
            },
            {
              destinationBranchId: branchId,
              destinationRailheadAreaId: mapping.areaId,
            },
          ],
        },
      }),
    ]);

    if (vpSchedules || lrGroups) {
      throw new BadRequestError(
        `${mapping.area.name} cannot be removed from this branch because it is used by ${plural(vpSchedules, "active VP Schedule")} and ${plural(lrGroups, "active LR group")}`,
      );
    }
  }

  await db.$transaction(async (tx) => {
    await tx.branch.update({
      where: { id: branchId },
      data: { isRailHead: areaIds.length > 0 },
    });
    await tx.branchRailheadArea.updateMany({
      where: { branchId, isActive: true },
      data: { isActive: false },
    });

    for (const areaId of areaIds) {
      await tx.branchRailheadArea.upsert({
        where: { branchId_areaId: { branchId, areaId } },
        create: { branchId, areaId, isActive: true },
        update: { isActive: true },
      });
    }
  });

  const railheads = await db.branchRailheadArea.findMany({
    where: { branchId, isActive: true },
    include: branchRailheadInclude,
    orderBy: [{ area: { city: { name: "asc" } } }, { area: { name: "asc" } }],
  });

  return sendOk(res, railheads);
});

export default router;
