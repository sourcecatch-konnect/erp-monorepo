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
      const convertedData = convertRupeeFieldsToPaise(data, moneyFields);

      if (convertedData.currentDieselRate != null) {
        convertedData.rateLastUpdated = new Date();
      }

      return convertedData;
    },

    beforeUpdate: async (data) => {
      const convertedData = convertRupeeFieldsToPaise(data, moneyFields);

      if (convertedData.currentDieselRate != null) {
        convertedData.rateLastUpdated = new Date();
      }

      return convertedData;
    },
  },

  listOptions: {
    searchableFields: [
      "name",
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
