import { Router } from "express";
import { createCitySchema, updateCitySchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.city,
  createSchema: createCitySchema,
  updateSchema: updateCitySchema,
  permissionKey: "masters.city",
  listOptions: {
    searchableFields: ["name"],
    defaultInclude: {
      state: {
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
