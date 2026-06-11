import { Router } from "express";
import {
  createRouteSchema,
  updateRouteSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";
import { BadRequestError } from "../../lib/error.js";

const router: Router = createCrudRouter({
  model: db.route,
  createSchema: createRouteSchema as ZodTypeAny,
  updateSchema: updateRouteSchema as ZodTypeAny,
  permissionKey: "masters.route",

  listOptions: {
    searchableFields: [],
    defaultInclude: {
      sourceCity: true,
      destinationCity: true,
    },
  },

  hooks: {
    beforeDelete: async (id) => {
      const [rateMatrices, vehicleTrips] =
        await Promise.all([
          db.rateMatrix.count({ where: { routeId: id } }),
          db.vehicleTrip.count({ where: { routeId: id } }),
        ]);

      const dependencies: string[] = [];

      if (rateMatrices)
        dependencies.push(`${rateMatrices} Rate Matrices`);

      if (vehicleTrips)
        dependencies.push(`${vehicleTrips} Vehicle Trips`);

      if (dependencies.length) {
        throw new BadRequestError(
          `Cannot delete Route. Linked records: ${dependencies.join(", ")}`
        );
      }
    },
  },
});
export default router;