import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createRailwayFreightMatrixSchema,
  updateRailwayFreightMatrixSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";

import { createCrudRouter }
from "../_shared/crud.factory.js";

const router: Router =
  createCrudRouter({
    model:
      db.railwayFreightMatrix,

    createSchema:
      createRailwayFreightMatrixSchema as ZodTypeAny,

    updateSchema:
      updateRailwayFreightMatrixSchema as ZodTypeAny,

    permissionKey: "masters.railway-freight",

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