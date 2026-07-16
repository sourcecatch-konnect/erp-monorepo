import { Router } from "express";

import { createCreditorSchema, updateCreditorSchema } from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";

const moneyFields = ["outstandingBalance"];

const router: Router = createCrudRouter({
  model: db.creditor,
  createSchema: createCreditorSchema,
  updateSchema: updateCreditorSchema,
  permissionKey: "masters.creditor",

  hooks: {
    beforeCreate: async (data) => convertRupeeFieldsToPaise(data, moneyFields),
    beforeUpdate: async (data) => convertRupeeFieldsToPaise(data, moneyFields),
  },

  listOptions: {
    searchableFields: ["name", "phone"],
    softDelete: true,
    defaultOrderBy: { name: "asc" },
    defaultInclude: {
      branch: { select: { id: true, name: true } },
    },
    blockDeleteIfExists: [
      {
        model: db.cashPayment,
        label: "Cash payments",
        where: (id: string) => ({ creditorId: id }),
        select: { id: true, payeeName: true },
        getName: (row: { payeeName?: string; id: string }) =>
          row.payeeName ?? row.id,
      },
    ],
  },
});

export default router;
