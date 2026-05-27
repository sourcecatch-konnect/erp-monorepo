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

  listOptions: {
    searchableFields: [
      "name",
      "ledgerName",
    ],
    defaultOrderBy: {
      name: "asc",
    },
  },
});

export default router;