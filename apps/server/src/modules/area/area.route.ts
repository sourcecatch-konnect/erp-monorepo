import { Router } from "express";
import { createAreaSchema, updateAreaSchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.area,
  createSchema: createAreaSchema,
  updateSchema: updateAreaSchema,
  permissionKey: "masters.area",
  listOptions: {
    searchableFields: ["name"],
    defaultInclude: {
      city: {
        select: {
          id: true,
          name: true,
          state: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    defaultOrderBy: { name: "asc" },
  },
});

export default router;