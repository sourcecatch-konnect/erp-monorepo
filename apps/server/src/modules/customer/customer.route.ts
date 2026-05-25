import { Router } from "express";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

const router: Router = createCrudRouter({
  model: db.customer,
  createSchema: createCustomerSchema as ZodTypeAny,
  updateSchema: updateCustomerSchema,
  permissionKey: "masters.customer",
  listOptions: {
    searchableFields: [
      "name",
      "shortName",
      "customerPAN",
      "gstNo",
      "contactPhone",
      "primaryEmail",
      "contactPerson",
      "mobileNo",
      "website",
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