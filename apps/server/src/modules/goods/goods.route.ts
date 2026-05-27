import { Router } from "express";
import {
  createGoodsSchema,
  updateGoodsSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

const router: Router = createCrudRouter({
  model: db.goods,

  createSchema: createGoodsSchema as ZodTypeAny,
  updateSchema: updateGoodsSchema as ZodTypeAny,

  permissionKey: "masters.goods",

  listOptions: {
    searchableFields: [
      "name",
      "description",
    ],

    defaultOrderBy: {
      name: "asc",
    },

    blockDeleteIfExists: [
      {
        model: db.orderGoods,
        label: "Order Goods",

        where: (id: string) => ({
          goodsId: id,
        }),

        select: {
          id: true,
        },

        getName: (row: any) => row.id,
      },

    ],
  },
});

export default router;