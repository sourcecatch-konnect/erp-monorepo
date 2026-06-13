import { Router } from "express";
import {
  createVehicleSchema,
  updateVehicleSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

const router: Router = createCrudRouter({
  model: db.vehicle,
  createSchema: createVehicleSchema as ZodTypeAny,
  updateSchema: updateVehicleSchema as ZodTypeAny,
  permissionKey: "masters.vehicle",

  listOptions: {
    searchableFields: [
      "vehicleNumber",
      "chasisNumber",
      "engineNumber",
      "insuranceNumber",
      "insuranceCompany",
    ],
    defaultInclude: {
      vehicleTypeRef: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    defaultOrderBy: {
      vehicleNumber: "asc",
    },
  },

  hooks: {
    beforeDelete: async (id: string) => {
      const usedInTrip = await db.vehicleTrip.findFirst({
        where: {
          vehicleId: id,
        },
        select: {
          id: true,
          tripNumber: true,
        },
      });

      if (usedInTrip) {
        throw new Error(
          `Cannot delete this vehicle because it is already used in vehicle trip ${
            usedInTrip.tripNumber ?? usedInTrip.id
          }.`
        );
      }
    },
  },
});

export default router;