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

const moneyFields = ["freightAmount"];

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
    const exists = await db.railwayFreightMatrix.findFirst({
      where: {
        wagonType: data.wagonType,
        sourceCityId: data.sourceCityId,
        destinationCityId: data.destinationCityId,
      },
      select: { id: true },
    });

    if (exists) {
      throw new Error(
        "Railway freight already exists for this wagon and route."
      );
    }

    return convertRupeeFieldsToPaise(data, moneyFields);
  },

  beforeUpdate: async (data: any) =>
    convertRupeeFieldsToPaise(data, moneyFields),
},

    listOptions: {
      searchableFields: [
        "wagonType",
      ],

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
