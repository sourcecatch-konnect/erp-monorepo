import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createRailwayFreightMatrixSchema,
  updateRailwayFreightMatrixSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";

import { createCrudRouter }
from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";
import { BadRequestError } from "../../lib/error.js";

const moneyFields = ["freightAmount"];

const getSearch = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const toRailwayFreightData = async (data: any) => {
  const { wagonType, ...payload } = data;
  const wagonRef = payload.wagonId ?? wagonType;

  if (wagonRef) {
    const wagon = await db.wagon.findFirst({
      where: {
        OR: [{ id: wagonRef }, { name: wagonRef }],
      },
      select: { id: true },
    });

    if (!wagon) {
      throw new BadRequestError("Selected wagon does not exist.");
    }

    payload.wagonId = wagon.id;
  }

  return convertRupeeFieldsToPaise(payload, moneyFields);
};

const router: Router =
  createCrudRouter({
    model:
      db.railwayFreightMatrix,

    createSchema:
      createRailwayFreightMatrixSchema as ZodTypeAny,

    updateSchema:
      updateRailwayFreightMatrixSchema as ZodTypeAny,

    permissionKey: "masters.railway-freight",

    hooks: {
  beforeCreate: async (data: any) => {
    const payload = await toRailwayFreightData(data);
    const exists = await db.railwayFreightMatrix.findFirst({
      where: {
        wagonId: payload.wagonId,
        sourceCityId: payload.sourceCityId,
        destinationCityId: payload.destinationCityId,
      },
      select: { id: true },
    });

    if (exists) {
      throw new Error(
        "Railway freight already exists for this wagon and route."
      );
    }

    return payload;
  },

  beforeUpdate: async (data: any) =>
    toRailwayFreightData(data),
},

    listOptions: {
      extraWhere: (req) => {
        const search = getSearch(req.query.search) ?? getSearch(req.query.q);

        return search
          ? {
              wagon: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            }
          : {};
      },

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

        wagon: {
          select: {
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
