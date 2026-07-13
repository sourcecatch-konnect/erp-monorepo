import { Router } from "express";
import { createGoodsSchema, updateGoodsSchema } from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

const router: Router = createCrudRouter({
  model: db.goods,

  createSchema: createGoodsSchema as ZodTypeAny,
  updateSchema: updateGoodsSchema as ZodTypeAny,

  permissionKey: "masters.goods",

  listOptions: {
    searchableFields: ["name", "description"],

    defaultOrderBy: {
      name: "asc",
    },

    blockDeleteIfExists: [
      {
        model: db.orderItem,
        label: "Order Items",

        where: (id: string) => ({
          goodsId: id,
        }),

        select: {
          id: true,
        },

        getName: (row: { id: string }) => row.id,
      },
    ],
  },
});

export default router;
