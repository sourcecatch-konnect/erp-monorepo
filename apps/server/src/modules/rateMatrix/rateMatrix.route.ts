import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createRateMatrixSchema,
  updateRateMatrixSchema,
  createRateUnitSchema,
  updateRateUnitSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";

import { createCrudRouter } from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";

const moneyFields = ["rate"];

async function ensureUniqueRateMatrix(data: any, id?: string) {
  const existing = await db.rateMatrix.findFirst({
    where: {
      agreementId: data.agreementId,
      routeId: data.routeId,
      vehicleTypeId: data.vehicleTypeId ?? null,
      unitId: data.unitId ?? null,
      transportType: data.transportType ?? "ROAD",
      ...(id
        ? {
            NOT: {
              id,
            },
          }
        : {}),
    },
  });

  if (existing) {
    throw new Error(
      "A rate matrix already exists for this Agreement, Route, Vehicle Type, Unit and Transport Type."
    );
  }
}
const rateMatrixRouter: Router = createCrudRouter({
  model: db.rateMatrix,

  createSchema: createRateMatrixSchema as ZodTypeAny,

  updateSchema: updateRateMatrixSchema as ZodTypeAny,

  permissionKey: "masters.rate-matrix",
  uniqueErrorMessages: {
  agreementId_routeId_vehicleTypeId_unitId_transportType:
    "A rate matrix already exists for this Agreement, Route, Vehicle Type, Unit and Transport Type.",
},
hooks: {
  beforeCreate: async (data: any) => {
    await ensureUniqueRateMatrix(data);

    return convertRupeeFieldsToPaise(data, moneyFields);
  },
  beforeUpdate: async (data: any) => {
    await ensureUniqueRateMatrix(data, data.id);

    return convertRupeeFieldsToPaise(data, moneyFields);
  },
},

  listOptions: {
    searchableFields: ["remarks"],

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

      vehicleType: {
        select: {
          id: true,
          name: true,
        },
      },

      unit: {
        select: {
          id: true,
          unitValue: true,
          unitType: true,
        },
      },
    },

    defaultOrderBy: {
      rate: "asc",
    },

    blockDeleteIfExists: [
  {
    model: db.vehicleTrip,

    label: "Vehicle Trips",

    where: (id: string) => ({
      rateMatrixId: id,
    }),

    select: {
      id: true,
      tripNumber: true,
      tripName: true,
    },

    getName: (row: any) => row.tripNumber || row.tripName || row.id,
  },
],
  },
});

/* --------------------------------
   RATE UNIT CRUD
--------------------------------- */

const rateUnitRouter: Router = createCrudRouter({
  model: db.rateUnit,

  createSchema: createRateUnitSchema as ZodTypeAny,

  updateSchema: updateRateUnitSchema as ZodTypeAny,

  permissionKey: "masters.rate-matrix",
  uniqueErrorMessages: {
  unitValue_unitType: "This rate unit already exists.",
},
  listOptions: {
    searchableFields: [],

    defaultOrderBy: {
      unitValue: "asc",
    },

    blockDeleteIfExists: [
      {
        model: db.rateMatrix,

        label: "Rate Matrix",

        where: (id: string) => ({
          unitId: id,
        }),

        select: {
          id: true,
        },

        getName: (row: any) => row.id,
      },
    ],
  },
});

/* --------------------------------
   COMBINED ROUTER
--------------------------------- */

const router: Router = Router();

/**
 * IMPORTANT:
 * Keep /units before /
 * Otherwise /units may be treated as /:id by rateMatrix router.
 */
router.use("/units", rateUnitRouter);

router.use("/", rateMatrixRouter);

export default router;
