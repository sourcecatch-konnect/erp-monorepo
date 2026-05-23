import { Router } from "express";
import {
  createVehicleSchema,
  updateVehicleSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.vehicle,
  createSchema: createVehicleSchema,
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
    defaultOrderBy: { vehicleNumber: "asc" },
  },
});

export default router;