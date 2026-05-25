import { Router } from "express";
import {
  createCompanySchema,
  updateCompanySchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

const router: Router = createCrudRouter({
  model: db.company,
  createSchema: createCompanySchema as ZodTypeAny,
  updateSchema: updateCompanySchema as ZodTypeAny,
  permissionKey: "masters.company",
  listOptions: {
    searchableFields: [
      "name",
      "address",
      "country",
      "contactPhone",
      "companyPAN",
      "companyTAN",
    ],
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