import { Router } from "express";
import { createAreaSchema, updateAreaSchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { BadRequestError } from "../../lib/error.js";

const assertAreaNotInRailUse = async (areaId: string) => {
  const [branchMappings, schedules, freightMatrices, lrGroups] =
    await Promise.all([
      db.branchRailheadArea.count({ where: { areaId, isActive: true } }),
      db.vPSchedule.count({
        where: {
          deletedAt: null,
          OR: [{ sourceAreaId: areaId }, { destinationAreaId: areaId }],
        },
      }),
      db.railwayFreightMatrix.count({
        where: {
          OR: [{ sourceAreaId: areaId }, { destinationAreaId: areaId }],
        },
      }),
      db.lRGroup.count({
        where: {
          deletedAt: null,
          OR: [
            { sourceRailheadAreaId: areaId },
            { destinationRailheadAreaId: areaId },
          ],
        },
      }),
    ]);

  if (branchMappings || schedules || freightMatrices || lrGroups) {
    throw new BadRequestError(
      "This Area is used as a railhead. Remove its active Branch, VP, Railway Freight and LR references first.",
    );
  }
};

const router: Router = createCrudRouter({
  model: db.area,
  createSchema: createAreaSchema,
  updateSchema: updateAreaSchema,
  permissionKey: "masters.area",
  hooks: {
    beforeUpdate: async (data, row) => {
      if (data.isRailHead === false) {
        const areaId = (row as { id: string }).id;
        await assertAreaNotInRailUse(areaId);
      }
      return data;
    },
    beforeDelete: assertAreaNotInRailUse,
  },
  uniqueErrorMessages: {
    cityId_name: "This area already exists in the selected city.",
    googlePlaceId: "This Google Place already exists.",
  },
  listOptions: {
    searchableFields: ["name", "formattedAddress"],
    defaultSelect: {
      id: true,
      name: true,
      cityId: true,
      isRailHead: true,
      googlePlaceId: true,
      formattedAddress: true,
      latitude: true,
      longitude: true,
      city: {
        select: {
          id: true,
          name: true,
          state: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    defaultOrderBy: { name: "asc" },

    extraWhere: (req) => {
      const cityId =
        typeof req.query.cityId === "string" && req.query.cityId.trim()
          ? req.query.cityId.trim()
          : undefined;

      return cityId ? { cityId } : {};
    },
  },
});

export default router;
