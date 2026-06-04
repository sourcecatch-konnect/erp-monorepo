import { Router } from "express";
import {
  createBranchSchema,
  updateBranchSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";
import { BadRequestError } from "../../lib/error.js";

const router: Router = createCrudRouter({
  model: db.branch,
  createSchema: createBranchSchema as ZodTypeAny,
  updateSchema: updateBranchSchema as ZodTypeAny,
  permissionKey: "masters.branch",

  hooks: {
    beforeDelete: async (id) => {
      const [
        users,
        warehouses,
        agreements,
        workers,
        fromOrders,
        toOrders,
      ] = await Promise.all([
        db.user.count({ where: { branchId: id } }),
        db.warehouse.count({ where: { branchId: id } }),
        db.agreement.count({
          where: { leadGeneratedByBranchId: id },
        }),
        db.labour.count({ where: { branchId: id } }),
        db.order.count({
          where: { fromBranchId: id },
        }),
        db.order.count({
          where: { toBranchId: id },
        }),
      ]);

      const dependencies: string[] = [];

      if (users)
        dependencies.push(`${users} Users`);

      if (warehouses)
        dependencies.push(`${warehouses} Warehouses`);

      if (agreements)
        dependencies.push(`${agreements} Agreements`);

      if (workers)
        dependencies.push(`${workers} Workers`);

      if (fromOrders)
        dependencies.push(`${fromOrders} From Orders`);

      if (toOrders)
        dependencies.push(`${toOrders} To Orders`);

      if (dependencies.length) {
        throw new BadRequestError(
          `Cannot delete Branch. Linked records: ${dependencies.join(
            ", "
          )}`
        );
      }
    },
  },

  listOptions: {
    searchableFields: [
      "branchCode",
      "shortCode",
      "name",
      "address",
      "contactName",
      "contactPhone",
      "email",
      "gstNo",
    ],
  },
});

export default router;