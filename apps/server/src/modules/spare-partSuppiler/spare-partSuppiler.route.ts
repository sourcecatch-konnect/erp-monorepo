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
  hooks: {
  beforeDelete: async (id) => {
    const count = await db.sparePart.count({
      where: {
        supplierId: id,
      },
    });

    if (count > 0) {
      throw new Error(
        "Cannot delete supplier because spare parts are assigned to it."
      );
    }
  },
},
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
      blockDeleteIfExists: [
  {
    model: db.sparePart,
    label: "Spare Parts",
    where: (id: string) => ({ supplierId: id }),
  },
],
  },
});

export default router;