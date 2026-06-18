import { Router } from "express";

import {
  createSpareCategorySchema,
  updateSpareCategorySchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.spareCategory,

  createSchema: createSpareCategorySchema,
  updateSchema: updateSpareCategorySchema,

  permissionKey: "masters.spare-category",
   hooks: {
  beforeDelete: async (id) => {
  const partsCount = await db.sparePart.count({
    where: {
      categoryId: id,
    },
  });

  if (partsCount > 0) {
    throw new Error(
      "Cannot delete spare category because spare parts are assigned to it."
    );
  }
},
  },
  listOptions: {
    searchableFields: [
      "name",
      "ledgerName",
    ],
    defaultOrderBy: {
      name: "asc",
    },
     blockDeleteIfExists: [
  {
    model: db.sparePart,
    label: "Spare Parts",
    where: (id: string) => ({ categoryId: id }),
  },
],
  },
 
   
});

export default router;