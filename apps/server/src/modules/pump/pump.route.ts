import { Router } from "express";

import { createPumpSchema, updatePumpSchema } from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";

import { createCrudRouter } from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";

const moneyFields = ["currentDieselRate", "creditLimit"];

const router: Router = createCrudRouter({
  model: db.pump,

  createSchema: createPumpSchema,

  updateSchema: updatePumpSchema,

  permissionKey: "masters.pump",

  hooks: {
    beforeCreate: async (data) => {
      convertRupeeFieldsToPaise(data, moneyFields);

      if (data.currentDieselRate != null) {
        data.rateLastUpdated = new Date();
      }

      return data;
    },

    beforeUpdate: async (data) => {
      convertRupeeFieldsToPaise(data, moneyFields);

      if (data.currentDieselRate != null) {
        data.rateLastUpdated = new Date();
      }

      return data;
    },
  },

  listOptions: {
    searchableFields: [
      "name",
      "contactName",
      "contactPhone",
      "gstIn",
      "pan",
      "country",
    ],

    defaultInclude: {
      city: {
        select: {
          id: true,
          name: true,
        },
      },

      state: {
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
