import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createCashAccountSchema,
  updateCashAccountSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.cashAccount,
  createSchema: createCashAccountSchema as ZodTypeAny,
  updateSchema: updateCashAccountSchema as ZodTypeAny,
  permissionKey: "masters.cash-account",

  listOptions: {
    searchableFields: ["name", "bankName"],
    softDelete: true,
    defaultOrderBy: { name: "asc" },
    blockDeleteIfExists: [
      {
        model: db.cashPayment,
        label: "Cash payments",
        where: (id: string) => ({ fromAccountId: id }),
        select: { id: true, payeeName: true },
        getName: (row: { payeeName?: string; id: string }) =>
          row.payeeName ?? row.id,
      },
      {
        model: db.cashAccountBalance,
        label: "Day balances",
        where: (id: string) => ({ accountId: id }),
        select: { id: true },
        getName: (row: { id: string }) => row.id,
      },
    ],
  },
});

export default router;
