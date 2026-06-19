import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { BadRequestError } from "../../lib/error.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";

const moneyFields = ["monthlyRent", "securityDeposit"];

const router: Router = createCrudRouter({
  model: db.warehouse,
  createSchema: createWarehouseSchema as ZodTypeAny,
  updateSchema: updateWarehouseSchema as ZodTypeAny,
  permissionKey: "masters.warehouse",

  listOptions: {
    searchableFields: [
      "name",
      "type",
      "address",
      "contactName",
      "contactPhone",
    ],

       defaultInclude: {
      city: {
        select: {
          id: true,
          name: true,
        },
      },
      state: {
        select: {
          id: true,
          name: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  hooks: {
    beforeCreate: async (data: any) => convertRupeeFieldsToPaise(data, moneyFields),

    beforeUpdate: async (data: any) => convertRupeeFieldsToPaise(data, moneyFields),

   beforeDelete: async (id) => {
  const branches = await db.branch.count({
    where: { warehouseId: id },
  });

  const dependencies: string[] = [];

  if (branches) {
    dependencies.push(`${branches} Branches`);
  }

  if (dependencies.length) {
    throw new BadRequestError(
      `Cannot delete Warehouse. Linked records: ${dependencies.join(", ")}`
    );
  }
},
  },
});

export default router;
