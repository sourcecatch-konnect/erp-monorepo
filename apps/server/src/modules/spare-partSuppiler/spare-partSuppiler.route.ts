import { Router } from "express";
import {
  createSparePartSupplierSchema,
  updateSparePartSupplierSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.sparePartSupplier,
  createSchema: createSparePartSupplierSchema,
  updateSchema: updateSparePartSupplierSchema,
  permissionKey: "masters.spare-part-supplier",
  listOptions: {
    searchableFields: ["name", "shopName", "contactPhone", "mobileNo", "email"],
    defaultInclude: {
      city: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    defaultOrderBy: { name: "asc" },
  },
});

export default router;