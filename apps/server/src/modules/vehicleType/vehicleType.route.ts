import { Router } from "express";
import { ZodTypeAny } from "zod";
import {
  createVehicleTypeSchema,
  updateVehicleTypeSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.vehicleType,
  createSchema: createVehicleTypeSchema as ZodTypeAny,
  updateSchema: updateVehicleTypeSchema as ZodTypeAny,
  permissionKey: "masters.vehicle-type",
  listOptions: {
    searchableFields: ["code", "name"],
    defaultOrderBy: { name: "asc" },
    blockDeleteIfExists: [
      {
        model: db.vehicle,
        label: "Vehicles",
        where: (id: string) => ({ vehicleTypeId: id }),
        select: { id: true, vehicleNumber: true },
        getName: (row: { vehicleNumber?: string; id: string }) =>
          row.vehicleNumber ?? row.id,
      },
      {
        model: db.order,
        label: "Orders",
        where: (id: string) => ({ vehicleTypeId: id }),
        select: { id: true, orderNumber: true },
        getName: (row: { orderNumber?: string; id: string }) =>
          row.orderNumber ?? row.id,
      },
    ],
  },
});

export default router;
