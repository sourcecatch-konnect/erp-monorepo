import { Router } from "express";
import {
  createSparePartSchema,
  updateSparePartSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.sparePart,
  createSchema: createSparePartSchema,
  updateSchema: updateSparePartSchema,
  permissionKey: "masters.sparePart",
  listOptions: {
    searchableFields: ["name", "unit", "description"],
    defaultInclude: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
          shopName: true,
        },
      },
    },
    defaultOrderBy: { name: "asc" },
  },
});

export default router;