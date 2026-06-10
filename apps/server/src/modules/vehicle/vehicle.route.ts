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
  updateSchema: updateVehicleSchema,
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
      vehicleTypeRef: { select: { id: true, name: true, code: true } },
    },
    defaultOrderBy: { vehicleNumber: "asc" },
  },
});

export default router;