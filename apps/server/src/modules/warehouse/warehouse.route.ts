import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { BadRequestError } from "../../lib/error.js";

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
      branch: true,
      state: true,
      city: true,
    },
  },

  hooks: {
    beforeDelete: async (id) => {
      const branches = await db.branch.count({
        where: { warehouseId: id },
      });

      if (branches) {
        throw new BadRequestError(
          `Cannot delete Warehouse. Linked records: ${branches} Branches`
        );
      }
    },
  },
});

export default router;