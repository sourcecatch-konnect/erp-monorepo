import { Router } from "express";
import {
  createDriverSchema,
  updateDriverSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.driver,
  createSchema: createDriverSchema,
  updateSchema: updateDriverSchema,
  permissionKey: "masters.driver",
  listOptions: {
    searchableFields: [
      "name",
      "mobile",
      "alternateMobile",
      "licenseNo",
      "panNo",
      "aadharCardNo",
    ],
    defaultOrderBy: { name: "asc" },
  },
});

export default router;
