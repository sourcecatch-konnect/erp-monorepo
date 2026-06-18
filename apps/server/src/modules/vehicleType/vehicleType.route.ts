import { Router } from "express";
import { ZodTypeAny } from "zod";
import {
  createVehicleTypeSchema,
  updateVehicleTypeSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";

const moneyFields = ["freightRangeFrom", "freightRangeTo"];

const router: Router = createCrudRouter({
  model: db.vehicleType,
  createSchema: createVehicleTypeSchema as ZodTypeAny,
  updateSchema: updateVehicleTypeSchema as ZodTypeAny,
  permissionKey: "masters.vehicle-type",
  hooks: {
    beforeCreate: async (data: any) => convertRupeeFieldsToPaise(data, moneyFields),
    beforeUpdate: async (data: any) => convertRupeeFieldsToPaise(data, moneyFields),  beforeDelete: async (id: string) => {
    const vehicle = await db.vehicle.findFirst({
      where: { vehicleTypeId: id },
      select: { id: true },
    });

    const order = await db.order.findFirst({
      where: { vehicleTypeId: id },
      select: { id: true },
    });

    const rateMatrix = await db.rateMatrix.findFirst({
      where: { vehicleTypeId: id },
      select: { id: true },
    });

    if (vehicle || order || rateMatrix) {
      throw new Error(
        "This vehicle type cannot be deleted because existing Vehicles, Orders, or Rate Matrices are linked to it. To preserve historical data, mark the vehicle type as inactive instead."
      );
    }
  },
    
  },
  uniqueErrorMessages: {
  code: "This vehicle type code already exists.",
},
  listOptions: {
    searchableFields: ["code", "name"],
    defaultOrderBy: { name: "asc" },
 
  },
});

export default router;
