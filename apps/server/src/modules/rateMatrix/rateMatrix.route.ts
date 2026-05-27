import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createRateMatrixSchema,
  updateRateMatrixSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";

import { createCrudRouter }
from "../_shared/crud.factory.js";

const router: Router =
  createCrudRouter({
    model: db.rateMatrix,

    createSchema:
      createRateMatrixSchema as ZodTypeAny,

    updateSchema:
      updateRateMatrixSchema as ZodTypeAny,

    permissionKey:
      "masters.rate-matrix",

    listOptions: {
      searchableFields: [
        "remarks",
      ],

      defaultInclude: {
  agreement: {
    select: {
      id: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  route: {
    select: {
      id: true,
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
    },
  },
},

   defaultOrderBy: {
  rate: "asc",
},

      blockDeleteIfExists: [
        {
          model:
            db.vehicleTrip,

          label:
            "Vehicle Trips",

          where: (
            id: string
          ) => ({
            rateMatrixId: id,
          }),

          select: {
            tripId: true,
          },

          getName: (
            row: any
          ) => row.tripId,
        },
      ],
    },
  });

export default router;