import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createRailwayFreightMatrixSchema,
  updateRailwayFreightMatrixSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";

import { createCrudRouter } from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";

const moneyFields = ["freightAmount"];

const validateAreaCity = async ({
  sourceCityId,
  sourceAreaId,
  destinationCityId,
  destinationAreaId,
}: {
  sourceCityId: string;
  sourceAreaId?: string | null;
  destinationCityId: string;
  destinationAreaId?: string | null;
}) => {
  if (sourceAreaId) {
    const sourceArea = await db.area.findFirst({
      where: {
        id: sourceAreaId,
        cityId: sourceCityId,
      },
      select: { id: true },
    });

    if (!sourceArea) {
      throw new Error("Source area does not belong to selected source city.");
    }
  }

  if (destinationAreaId) {
    const destinationArea = await db.area.findFirst({
      where: {
        id: destinationAreaId,
        cityId: destinationCityId,
      },
      select: { id: true },
    });

    if (!destinationArea) {
      throw new Error(
        "Destination area does not belong to selected destination city."
      );
    }
  }
};

const router: Router =
  createCrudRouter({
    model: db.railwayFreightMatrix,

    createSchema:
      createRailwayFreightMatrixSchema as ZodTypeAny,

    updateSchema:
      updateRailwayFreightMatrixSchema as ZodTypeAny,

    permissionKey: "masters.railway-freight",

    hooks: {
      beforeCreate: async (data: any) => {
        await validateAreaCity({
          sourceCityId: data.sourceCityId,
          sourceAreaId: data.sourceAreaId,
          destinationCityId: data.destinationCityId,
          destinationAreaId: data.destinationAreaId,
        });

        const exists = await db.railwayFreightMatrix.findFirst({
          where: {
            wagonId: data.wagonId,
            sourceCityId: data.sourceCityId,
            destinationCityId: data.destinationCityId,
            sourceAreaId: data.sourceAreaId ?? null,
            destinationAreaId: data.destinationAreaId ?? null,
          },
          select: { id: true },
        });

        if (exists) {
          throw new Error(
            "Railway freight already exists for this wagon, route and area."
          );
        }

        return convertRupeeFieldsToPaise(data, moneyFields);
      },

      beforeUpdate: async (data: any, row: any) => {
        const next = {
          wagonId: data.wagonId ?? row.wagonId,
          sourceCityId: data.sourceCityId ?? row.sourceCityId,
          sourceAreaId:
            data.sourceAreaId !== undefined
              ? data.sourceAreaId
              : row.sourceAreaId,
          destinationCityId:
            data.destinationCityId ?? row.destinationCityId,
          destinationAreaId:
            data.destinationAreaId !== undefined
              ? data.destinationAreaId
              : row.destinationAreaId,
        };

        await validateAreaCity({
          sourceCityId: next.sourceCityId,
          sourceAreaId: next.sourceAreaId,
          destinationCityId: next.destinationCityId,
          destinationAreaId: next.destinationAreaId,
        });

        const exists = await db.railwayFreightMatrix.findFirst({
          where: {
            wagonId: next.wagonId,
            sourceCityId: next.sourceCityId,
            destinationCityId: next.destinationCityId,
            sourceAreaId: next.sourceAreaId ?? null,
            destinationAreaId: next.destinationAreaId ?? null,
            NOT: {
              id: row.id,
            },
          },
          select: { id: true },
        });

        if (exists) {
          throw new Error(
            "Railway freight already exists for this wagon, route and area."
          );
        }

        return convertRupeeFieldsToPaise(data, moneyFields);
      },
    },

    listOptions: {
      searchableFields: [],

      defaultInclude: {
        sourceCity: {
          select: {
            id: true,
            name: true,
          },
        },

        destinationCity: {
          select: {
            id: true,
            name: true,
          },
        },

        sourceArea: {
          select: {
            id: true,
            name: true,
            cityId: true,
          },
        },

        destinationArea: {
          select: {
            id: true,
            name: true,
            cityId: true,
          },
        },

        wagon: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      defaultOrderBy: {
        createdAt: "desc",
      },

      blockDeleteIfExists: [],
    },
  });

export default router;
