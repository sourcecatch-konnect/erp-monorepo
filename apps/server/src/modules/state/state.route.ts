import { Router } from "express";
import { createStateSchema, updateStateSchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.state,
  createSchema: createStateSchema,
  updateSchema: updateStateSchema,
  permissionKey: "masters.state",
  listOptions: {
    searchableFields: ["name"],
    defaultOrderBy: { name: "asc" },
  },
});

export default router;
