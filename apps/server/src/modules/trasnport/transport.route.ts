import { Router } from "express";
import {
  createTransportSchema,
  updateTransportSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.transport,
  createSchema: createTransportSchema,
  updateSchema: updateTransportSchema,
  permissionKey: "masters.transport",
  listOptions: {
    searchableFields: ["name", "phoneNo", "country"],
    defaultInclude: {
      state: {
        select: {
          id: true,
          name: true,
        },
      },
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