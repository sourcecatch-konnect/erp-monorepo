import { Router } from "express";

import { createLabourSchema, updateLabourSchema } from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";

import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.labour,

  createSchema: createLabourSchema,

  updateSchema: updateLabourSchema,

  permissionKey: "masters.labour",

  listOptions: {
    searchableFields: [
      "name",
      "contactName",
      "contactPhone",
      "mobileNo",
      "pan",
    ],

    defaultInclude: {
      city: {
        select: {
          id: true,
          name: true,
        },
      },

      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },

    defaultOrderBy: {
      name: "asc",
    },

    blockDeleteIfExists: [],
  },
});

export default router;
